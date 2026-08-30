#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
TARGET="scripts/api_server.js"
DB="data/tlm.db"
BACKUP_DIR="/opt/backups/tlm-homepage-sent-results-$(date +%Y%m%d-%H%M%S)"

test -f "$TARGET" || { echo "BLOQUE: $TARGET absent"; exit 1; }
test -f "$DB" || { echo "BLOQUE: $DB absent"; exit 1; }
install -d -m 700 "$BACKUP_DIR"
cp -a "$TARGET" "$BACKUP_DIR/api_server.js"
sqlite3 "$DB" ".timeout 10000" ".backup '$BACKUP_DIR/tlm.db'"

rollback() {
  echo "ERREUR: restauration automatique"
  docker compose stop api >/dev/null 2>&1 || true
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

consensus_anchor = '''  let state = { complete: false, voteCount: 0, bet: null };
  try {
    const placeholders = CONCILE_AGENT_NAMES.map(() => "?").join(",");'''
consensus_replacement = '''  let state = { complete: false, voteCount: 0, bet: null };
  // Preuve exacte du scrutin qui a produit cette analyse. Les predictions
  // multi-marches portent une cle de snapshot (minute/score), tandis que
  // concile_analyses porte la cle canonique du match : les joindre strictement
  // masquait donc sur l'accueil des signaux pourtant livres et resolus.
  try {
    const persistedAgents = JSON.parse(row?.agents_json || "[]");
    const official = new Map();
    for (const agent of persistedAgents) {
      const name = String(agent?.name || "");
      const bet = String(agent?.bet || "").trim();
      if (CONCILE_AGENT_NAMES.includes(name) && isOu25Bet(bet)) official.set(name, bet);
    }
    const counts = {};
    for (const bet of official.values()) counts[bet] = (counts[bet] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (official.size === 5) {
      state = { complete: true, voteCount: Number(top?.[1] || 0), bet: top?.[0] || null };
      storedOu25ConsensusCache.set(key, state);
      return state;
    }
  } catch (_) {}
  try {
    const placeholders = CONCILE_AGENT_NAMES.map(() => "?").join(",");'''

if "Preuve exacte du scrutin qui a produit cette analyse" not in source:
    if source.count(consensus_anchor) != 1:
        raise SystemExit("BLOQUE: storedOu25Consensus absent ou ambigu")
    source = source.replace(consensus_anchor, consensus_replacement, 1)

trace_old = '''    const motif = _blockReason || _tierBlock || null;
    // Meme correction que markSignalSent : cibler la ligne exacte. Ecrire le
    // motif sur toutes les lignes du jour ecrasait celui des analyses
    // precedentes du meme match, y compris celles qui avaient ete diffusees.
    const _ligne = getPredictionSnapshotKey(match);
    const maj = db.prepare("UPDATE concile_analyses SET diffusion_block = ? WHERE match_key = ?").run(motif, _ligne);'''
trace_new = '''    const motif = _blockReason || _tierBlock || null;
    // Une nouvelle observation du meme match ne doit jamais transformer un
    // signal deja accepte par Telegram en "non diffuse". La preuve de livraison
    // est prioritaire sur le motif technique d'un passage ulterieur.
    const _ligne = persistedAnalysisMatchKey || getPredictionSnapshotKey(match);
    const dejaLivre = db.prepare(`SELECT 1 FROM telegram_signal_deliveries
      WHERE match_key = ? AND ok = 1 AND telegram_message_id IS NOT NULL LIMIT 1`).get(_ligne);
    const motifAEnregistrer = dejaLivre ? null : motif;
    const maj = db.prepare("UPDATE concile_analyses SET diffusion_block = ? WHERE match_key = ?").run(motifAEnregistrer, _ligne);'''
if "Une nouvelle observation du meme match ne doit jamais transformer" not in source:
    if source.count(trace_old) != 1:
        raise SystemExit("BLOQUE: trace diffusion absente ou ambigue")
    source = source.replace(trace_old, trace_new, 1)
    fallback_old = ''').run(motif, match.home, match.away);'''
    fallback_new = ''').run(motifAEnregistrer, match.home, match.away);'''
    if source.count(fallback_old) != 1:
        raise SystemExit("BLOQUE: repli diffusion absent ou ambigu")
    source = source.replace(fallback_old, fallback_new, 1)

path.write_text(source, encoding="utf-8")
PY

node --check "$TARGET"

# Une preuve Telegram reussie rend nul tout blocage ajoute par une observation
# ulterieure. Aucun resultat n'est invente et aucun message n'est renvoye.
sqlite3 "$DB" <<'SQL'
.timeout 10000
BEGIN IMMEDIATE;
UPDATE concile_analyses
SET diffusion_block=NULL
WHERE EXISTS (
  SELECT 1 FROM telegram_signal_deliveries td
  WHERE td.match_key=concile_analyses.match_key
    AND td.ok=1 AND td.telegram_message_id IS NOT NULL
);
COMMIT;
SQL

docker compose build api
docker compose up -d --no-deps api
sleep 10

docker exec touslesmatchs-api sh -lc '
  grep -q "Preuve exacte du scrutin qui a produit cette analyse" /app/server.js
  grep -q "motifAEnregistrer = dejaLivre ? null : motif" /app/server.js
  grep -q "CLIENT_OU25_MIN_CONFIDENCE = 72" /app/server.js
'

curl -fsS https://www.touslesmatchs.com/api/health |
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["ok"] and d["integrations"]["telegram"]["ok"]; print("API=OK TELEGRAM=OK")'

curl -fsS "https://www.touslesmatchs.com/api/analysis-history?limit=100&t=$(date +%s)" |
python3 -c 'import json,sys; d=json.load(sys.stdin); rows=[x for x in d.get("analyses",[]) if "atletico paranaense" in x.get("home","").lower() and "fluminense" in x.get("away","").lower()]; assert rows, "Atletico-Fluminense absent de API"; x=rows[0]; assert x.get("outcome")=="win" and x.get("final_score")=="3-3"; assert x.get("delivery_proven") and x.get("sent",{}).get("standard") and x.get("sent",{}).get("premium"); print("ACCUEIL_API=OK",x["home"],x["away"],x["outcome"],x["final_score"],x["sent"])'

curl -fsS "https://www.touslesmatchs.com/?t=$(date +%s)" | grep -q 'id="daily-accordion"'
docker logs touslesmatchs-api --since 2m 2>&1 | tail -n 250 > /tmp/tlm-homepage-results.log
! grep -qE "SyntaxError|CRASH-GUARD|Cannot find module|SQLITE_(ERROR|CORRUPT)" /tmp/tlm-homepage-results.log

trap - ERR
echo "VERDICT=OK"
echo "ATLETICO_FLUMINENSE=VISIBLE_DANS_API_ACCUEIL"
echo "RESULTAT=GAGNE_3-3"
echo "TELEGRAM=INCHANGE"
echo "DOUBLON_ENVOYE=NON"
echo "SEUIL_72=CONSERVE"
echo "SAUVEGARDE=$BACKUP_DIR"
