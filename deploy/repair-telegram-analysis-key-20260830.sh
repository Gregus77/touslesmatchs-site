#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
TARGET="scripts/api_server.js"
DB="data/tlm.db"
BACKUP_DIR="/opt/backups/tlm-telegram-analysis-key-$(date +%Y%m%d-%H%M%S)"

test -f "$TARGET" || { echo "BLOQUE: $TARGET absent"; exit 1; }
test -f "$DB" || { echo "BLOQUE: $DB absent"; exit 1; }

install -d -m 700 "$BACKUP_DIR"
cp -a "$TARGET" "$BACKUP_DIR/api_server.js"
sqlite3 "$DB" ".timeout 10000" ".backup '$BACKUP_DIR/tlm.db'"
BEFORE_SHA="$(sha256sum "$TARGET" | awk '{print $1}')"

rollback() {
  echo "ERREUR: restauration automatique du code et de la base"
  cp -a "$BACKUP_DIR/api_server.js" "$TARGET"
  cp -a "$BACKUP_DIR/tlm.db" "$DB"
  docker compose build api
  docker compose up -d --no-deps api
}
trap rollback ERR

python3 - "$TARGET" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
source = path.read_text(encoding="utf-8")
marker = "// Cle canonique partagee par analyse, preuve Telegram et resultat final."

if marker not in source:
    old_call = "  saveConcileAnalysis(match, analysisResult, pickBet);"
    new_call = f'''  {marker}
  const persistedAnalysisMatchKey = saveConcileAnalysis(match, analysisResult, pickBet);
  analysisResult.match_key = persistedAnalysisMatchKey || analysisResult.match_key;'''
    if source.count(old_call) != 1:
        raise SystemExit("BLOQUE: appel saveConcileAnalysis absent ou ambigu")
    source = source.replace(old_call, new_call, 1)

    old_delivery_key = "      const _ligneAnalysee = getPredictionSnapshotKey(match);"
    new_delivery_key = "      const _ligneAnalysee = persistedAnalysisMatchKey || getPredictionSnapshotKey(match);"
    if source.count(old_delivery_key) != 1:
        raise SystemExit("BLOQUE: cle de livraison absente ou ambigue")
    source = source.replace(old_delivery_key, new_delivery_key, 1)

    old_end = '''    console.log(
      `[concile-trace] saved ${matchKey} | ${match.competition || match.league || "competition inconnue"} | ` +
      `${match.home} vs ${match.away} | minute=${minute ?? "?"} | ` +
      `score=${match.score_home ?? "?"}-${match.score_away ?? "?"} | ` +
      `bet=${result.best_bet} | confidence=${result.confidence} | tier=${sigTier || "none"} | reason=${String(result.raison || "").slice(0, 180)}`
    );
  } catch(e) { console.error("[concile-trace] save:", e.message); }
}'''
    new_end = '''    console.log(
      `[concile-trace] saved ${matchKey} | ${match.competition || match.league || "competition inconnue"} | ` +
      `${match.home} vs ${match.away} | minute=${minute ?? "?"} | ` +
      `score=${match.score_home ?? "?"}-${match.score_away ?? "?"} | ` +
      `bet=${result.best_bet} | confidence=${result.confidence} | tier=${sigTier || "none"} | reason=${String(result.raison || "").slice(0, 180)}`
    );
    return matchKey;
  } catch(e) {
    console.error("[concile-trace] save:", e.message);
    return null;
  }
}'''
    if source.count(old_end) != 1:
        raise SystemExit("BLOQUE: fin saveConcileAnalysis absente ou ambigue")
    source = source.replace(old_end, new_end, 1)

path.write_text(source, encoding="utf-8")
PY

node --check "$TARGET"
AFTER_SHA="$(sha256sum "$TARGET" | awk '{print $1}')"
test "$BEFORE_SHA" != "$AFTER_SHA" || { echo "BLOQUE: aucun changement de code applique"; exit 1; }

# Rattache les preuves deja acceptees par Telegram a la cle canonique de leur
# analyse. Aucun message n'est renvoye et aucun quota n'est consomme.
BEFORE_ORPHANS="$(sqlite3 "$DB" "SELECT COUNT(*) FROM telegram_signal_deliveries td LEFT JOIN concile_analyses ca ON ca.match_key=td.match_key WHERE td.ok=1 AND td.telegram_message_id IS NOT NULL AND ca.id IS NULL AND td.created_at>=datetime('now','-48 hours');")"
MIGRATION_CANDIDATES="$(sqlite3 "$DB" "SELECT COUNT(*) FROM telegram_signal_deliveries td WHERE td.ok=1 AND td.telegram_message_id IS NOT NULL AND EXISTS (SELECT 1 FROM concile_analyses ca WHERE td.match_key LIKE ca.match_key || '_%' AND td.match_key<>ca.match_key);")"
sqlite3 "$DB" <<'SQL'
.timeout 10000
BEGIN IMMEDIATE;
UPDATE telegram_signal_deliveries AS td
SET match_key=(
  SELECT ca.match_key FROM concile_analyses ca
  WHERE td.match_key LIKE ca.match_key || '_%'
  ORDER BY ca.analysed_at DESC LIMIT 1
)
WHERE td.ok=1 AND td.telegram_message_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM concile_analyses ca
    WHERE td.match_key LIKE ca.match_key || '_%' AND td.match_key<>ca.match_key
  );
UPDATE concile_analyses SET sig_sent_standard=1 WHERE EXISTS (
  SELECT 1 FROM telegram_signal_deliveries td WHERE td.match_key=concile_analyses.match_key
    AND td.channel='standard' AND td.ok=1 AND td.telegram_message_id IS NOT NULL
);
UPDATE concile_analyses SET sig_sent_premium=1 WHERE EXISTS (
  SELECT 1 FROM telegram_signal_deliveries td WHERE td.match_key=concile_analyses.match_key
    AND td.channel='premium' AND td.ok=1 AND td.telegram_message_id IS NOT NULL
);
UPDATE concile_analyses SET sig_sent_free=1 WHERE EXISTS (
  SELECT 1 FROM telegram_signal_deliveries td WHERE td.match_key=concile_analyses.match_key
    AND td.channel='free' AND td.ok=1 AND td.telegram_message_id IS NOT NULL
);
COMMIT;
SQL
AFTER_ORPHANS="$(sqlite3 "$DB" "SELECT COUNT(*) FROM telegram_signal_deliveries td LEFT JOIN concile_analyses ca ON ca.match_key=td.match_key WHERE td.ok=1 AND td.telegram_message_id IS NOT NULL AND ca.id IS NULL AND td.created_at>=datetime('now','-48 hours');")"
echo "MIGRATION_PREUVES=avant:$BEFORE_ORPHANS candidates:$MIGRATION_CANDIDATES apres:$AFTER_ORPHANS"

docker compose build api
docker compose up -d --no-deps api
sleep 10

docker exec touslesmatchs-api sh -lc '
  grep -q "Cle canonique partagee par analyse" /app/server.js
  grep -q "persistedAnalysisMatchKey || getPredictionSnapshotKey" /app/server.js
  grep -q "return matchKey;" /app/server.js
  grep -q "CLIENT_OU25_MIN_CONFIDENCE = 72" /app/server.js
'

curl -fsS https://www.touslesmatchs.com/api/health |
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["ok"] and d["integrations"]["telegram"]["ok"]; print("API=OK TELEGRAM=OK")'

docker logs touslesmatchs-api --since 2m 2>&1 | tail -n 250 > /tmp/tlm-telegram-analysis-key.log
! grep -qE "SyntaxError|CRASH-GUARD|Cannot find module|SQLITE_(ERROR|CORRUPT)" /tmp/tlm-telegram-analysis-key.log

docker exec touslesmatchs-api node - <<'NODE'
const D=require("better-sqlite3");
const db=new D("/data/tlm.db",{readonly:true});
const rows=db.prepare(`
  SELECT td.created_at,ca.home,ca.away,td.channel,td.telegram_message_id
  FROM telegram_signal_deliveries td
  JOIN concile_analyses ca ON ca.match_key=td.match_key
  WHERE td.ok=1 AND td.telegram_message_id IS NOT NULL
    AND td.created_at>=datetime("now","-6 hours")
  ORDER BY td.created_at DESC LIMIT 12
`).all();
if (!rows.some(r => r.home && r.away && ["standard","premium"].includes(r.channel))) {
  throw new Error("aucune preuve client rattachee a une analyse");
}
console.log("PREUVES_RATTACHEES=", rows);
NODE

trap - ERR
echo "VERDICT=OK"
echo "SIGNAL_TELEGRAM=DEJA_LIVRE_STANDARD_ET_PREMIUM"
echo "CLE_ANALYSE_TELEGRAM=CORRIGEE"
echo "DOUBLON_ENVOYE=NON"
echo "SEUIL_72=CONSERVE"
echo "SAUVEGARDE=$BACKUP_DIR"
