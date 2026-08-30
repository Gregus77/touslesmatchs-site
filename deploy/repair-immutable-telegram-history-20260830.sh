#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
TARGET="scripts/api_server.js"
DB="data/tlm.db"
BACKUP_DIR="/opt/backups/tlm-immutable-telegram-history-$(date +%Y%m%d-%H%M%S)"

[ -f "$TARGET" ] || { echo "BLOQUE: $TARGET absent"; exit 1; }
[ -f "$DB" ] || { echo "BLOQUE: $DB absent"; exit 1; }
install -d -m 700 "$BACKUP_DIR"
cp -a "$TARGET" "$BACKUP_DIR/api_server.js"
sqlite3 "$DB" ".timeout 10000" ".backup '$BACKUP_DIR/tlm.db'"

rollback() {
  echo "ERREUR — restauration automatique"
  docker compose stop api >/dev/null 2>&1 || true
  cp -a "$BACKUP_DIR/api_server.js" "$TARGET"
  cp -a "$BACKUP_DIR/tlm.db" "$DB"
  docker compose build api
  docker compose up -d --no-deps --force-recreate api
}
trap rollback ERR

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
source = path.read_text(encoding="utf-8")

start = source.find("function isVerifiedClientOu25Row(row) {")
end = source.find("\nfunction displayDeliveryChannels(row) {", start)
if start < 0 or end < 0:
    raise SystemExit("BLOQUE: fonction isVerifiedClientOu25Row introuvable")

old = source[start:end]
new = r'''function isVerifiedClientOu25Row(row) {
  const day = String(row?.analysed_at || "").slice(0, 10);
  // Historique ancien : comportement conserve.
  if (day && day < CLIENT_HISTORY_REPAIR_DATE) return true;

  // REGLE FONDATEUR 30/08/2026 : une livraison Telegram reussie est une preuve
  // definitive. Une analyse deja envoyee a un client ne peut PLUS disparaitre
  // du site ou de l'application parce qu'une observation ulterieure change
  // diffusion_block, le consensus courant, la cote ou l'eligibilite live.
  // Apres livraison, seuls le score final et outcome (win/loss) peuvent evoluer.
  const delivery = storedTelegramDelivery(row);
  const channels = day >= CLIENT_TELEGRAM_PROOF_SINCE
    ? delivery.channels
    : legacySentChannels(row);
  const deliveredToClient = ["free", "standard", "premium", "elite"]
    .some(channel => channels.has(channel));

  return deliveredToClient && isOu25Bet(row?.best_bet);
}
'''

if "REGLE FONDATEUR 30/08/2026" not in old:
    source = source[:start] + new + source[end:]
else:
    print("CODE_DEJA_CORRIGE=1")

path.write_text(source, encoding="utf-8")
PY

node --check "$TARGET"

# Reconciliation : la table de livraison Telegram est la preuve de verite.
# On restaure les marqueurs historiques sans supprimer ni inventer de signal.
sqlite3 "$DB" <<'SQL'
.timeout 10000
BEGIN IMMEDIATE;

UPDATE concile_analyses
SET diffusion_block = NULL
WHERE EXISTS (
  SELECT 1
  FROM telegram_signal_deliveries td
  WHERE td.match_key = concile_analyses.match_key
    AND td.ok = 1
    AND td.telegram_message_id IS NOT NULL
    AND td.channel IN ('free','standard','premium','elite')
);

UPDATE concile_analyses
SET sig_sent_free = 1
WHERE EXISTS (
  SELECT 1 FROM telegram_signal_deliveries td
  WHERE td.match_key = concile_analyses.match_key
    AND td.ok = 1 AND td.telegram_message_id IS NOT NULL AND td.channel = 'free'
);
UPDATE concile_analyses
SET sig_sent_standard = 1
WHERE EXISTS (
  SELECT 1 FROM telegram_signal_deliveries td
  WHERE td.match_key = concile_analyses.match_key
    AND td.ok = 1 AND td.telegram_message_id IS NOT NULL AND td.channel = 'standard'
);
UPDATE concile_analyses
SET sig_sent_premium = 1
WHERE EXISTS (
  SELECT 1 FROM telegram_signal_deliveries td
  WHERE td.match_key = concile_analyses.match_key
    AND td.ok = 1 AND td.telegram_message_id IS NOT NULL AND td.channel = 'premium'
);
UPDATE concile_analyses
SET sig_sent_elite = 1
WHERE EXISTS (
  SELECT 1 FROM telegram_signal_deliveries td
  WHERE td.match_key = concile_analyses.match_key
    AND td.ok = 1 AND td.telegram_message_id IS NOT NULL AND td.channel = 'elite'
);

COMMIT;
SQL

docker compose build api
docker compose up -d --no-deps --force-recreate api
sleep 12

docker exec touslesmatchs-api node --check /app/server.js
docker exec touslesmatchs-api grep -q "REGLE FONDATEUR 30/08/2026" /app/server.js

curl -fsS https://www.touslesmatchs.com/api/health | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d.get("ok") is True, d
assert d.get("integrations",{}).get("telegram",{}).get("ok") is True, d
print("API=OK TELEGRAM=OK")
'

# Regression obligatoire : le signal reel du 30/08 ne doit plus pouvoir disparaitre.
curl -fsS "https://www.touslesmatchs.com/api/analysis-history?limit=100&t=$(date +%s)" | python3 -c '
import json,sys
d=json.load(sys.stdin)
rows=[x for x in d.get("analyses",[]) if "atletico paranaense" in str(x.get("home","")).lower() and "fluminense" in str(x.get("away","")).lower()]
assert rows, "ECHEC: Atletico Paranaense-Fluminense absent de analysis-history"
x=rows[0]
assert x.get("outcome")=="win", x
assert x.get("final_score")=="3-3", x
sent=x.get("sent",{})
assert sent.get("standard") and sent.get("premium"), x
print("ATLETICO_FLUMINENSE=VISIBLE", x.get("outcome"), x.get("final_score"), sent)
'

# Audit global : chaque livraison client reussie depuis le 27/08 doit avoir sa
# ligne canonique en base. On n'envoie aucun nouveau message Telegram ici.
MISSING=$(sqlite3 "$DB" <<'SQL'
SELECT COUNT(*)
FROM (
  SELECT DISTINCT td.match_key
  FROM telegram_signal_deliveries td
  LEFT JOIN concile_analyses ca ON ca.match_key = td.match_key
  WHERE td.ok=1
    AND td.telegram_message_id IS NOT NULL
    AND td.channel IN ('free','standard','premium','elite')
    AND date(td.created_at) >= '2026-08-27'
    AND ca.match_key IS NULL
);
SQL
)

echo "LIVRAISONS_SANS_ANALYSE=$MISSING"
[ "$MISSING" = "0" ] || { echo "BLOQUE: certaines livraisons Telegram n'ont aucune ligne concile_analyses"; exit 1; }

trap - ERR
echo "VERDICT=OK"
echo "SOURCE_VERITE=telegram_signal_deliveries"
echo "SITE_ET_APP=/api/analysis-history"
echo "SIGNAL_ENVOYE=JAMAIS_SUPPRIME"
echo "RESULTAT=MISE_A_JOUR_WIN_LOSS_APRES_FIN"
echo "TELEGRAM_NOUVEL_ENVOI=NON"
echo "SAUVEGARDE=$BACKUP_DIR"
