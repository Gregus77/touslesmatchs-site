#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/touslesmatchs
TARGET="${1:?Commit de réparation requis}"
[[ "$TARGET" =~ ^[0-9a-f]{40}$ ]] || exit 1
[[ "$(git branch --show-current)" == main ]] || { echo 'STOP: branche différente de main'; exit 1; }
[[ "$(git rev-parse --abbrev-ref '@{upstream}')" == origin/main ]] || exit 1
git remote get-url origin | grep -Eq 'github.com[:/]Gregus77/touslesmatchs-site(\.git)?$' || exit 1
git diff --quiet && git diff --cached --quiet || { echo 'STOP: fichiers suivis modifiés'; exit 1; }
[[ "$(git rev-parse origin/main)" == "$TARGET" ]] || { echo 'STOP: main a évolué, nouvelle vérification nécessaire'; exit 1; }
BEFORE="$(git rev-parse HEAD)"
git merge-base --is-ancestor "$BEFORE" "$TARGET" || { echo 'STOP: branches divergentes'; exit 1; }
mapfile -t FILES < <(git diff --name-only "$BEFORE" "$TARGET")
for file in "${FILES[@]}"; do
  case "$file" in
    .github/workflows/deploy-public-data-repair.yml) ;;
    scripts/test_homepage_consensus_20260905.js) ;;
    scripts/api_server.js|public/index.html|public/performances.html|public/js/i18n.js|public/js/signal-rules.js|public/sw.js|scripts/test_public_data_repair_20260905.js|scripts/test_stale_result_resolution_date_guard.js|scripts/repair_lyon_auxerre_20260904.js|scripts/audit_votes_readonly_20260905.js|deploy/fix-premature-final-score-lyon-auxerre-20260904.sh|deploy/apply-public-data-repair-20260905.sh|CHANGELOG.md) ;;
    *) echo "STOP: modification hors périmètre: $file"; exit 1 ;;
  esac
done
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/opt/backups/tlm-public-data-$STAMP"
mkdir -m 700 -p "$BACKUP"
git archive "$BEFORE" | gzip > "$BACKUP/source-before.tar.gz"
printf '%s\n' "$BEFORE" > "$BACKUP/commit-before"
docker inspect -f '{{.Image}}' touslesmatchs-api > "$BACKUP/api-image-before"
OLD_IMAGE="$(cat "$BACKUP/api-image-before")"
docker tag "$OLD_IMAGE" "tlm-api-rollback:$STAMP"
API_TAG="$(docker compose config --images 2>/dev/null | grep -E '(^|[-_/])api(:|$)' | head -n 1)"
[[ -n "$API_TAG" ]] || { echo 'STOP: nom image API non identifié'; exit 1; }
docker exec -i touslesmatchs-api node - "$STAMP" <<'NODE'
const Database=require('better-sqlite3'),fs=require('fs'),path=require('path');
const db=new Database(process.env.DB_PATH||'/data/tlm.db');
const target=path.join(path.dirname(db.name),'tlm-before-public-data-'+process.argv[2]+'.db');
db.backup(target).then(()=>{fs.chmodSync(target,0o600);console.log('Sauvegarde SQLite: OK');})
 .catch(()=>{console.error('Sauvegarde SQLite: FAILED');process.exitCode=1;}).finally(()=>db.close());
NODE
rollback(){
  trap - ERR
  echo 'FAILED: restauration des fichiers et de l’image API précédente'
  if [[ ${#FILES[@]} -gt 0 ]]; then git restore --source="$BEFORE" --worktree -- "${FILES[@]}"; fi
  docker tag "$OLD_IMAGE" "$API_TAG"
  docker compose up -d --no-deps --no-build api
  for attempt in {1..30}; do
    if curl -fsS --max-time 2 http://127.0.0.1:3001/health >/dev/null; then
      echo "ROLLBACK sain. Commit courant=$TARGET; fichiers restaurés depuis $BEFORE; ne pas lancer git pull."
      exit 1
    fi
    sleep 1
  done
  echo "ROLLBACK PARTIAL: vérifier l’API; sauvegarde=$BACKUP"
  exit 1
}
git merge --ff-only "$TARGET"
trap rollback ERR
docker exec -i touslesmatchs-api node --check < scripts/api_server.js
docker compose build api
docker compose up -d --no-deps --no-build api
healthy=0
for attempt in {1..45}; do
  if curl -fsS --max-time 2 http://127.0.0.1:3001/health >/dev/null; then healthy=1; break; fi
  sleep 1
done
[[ "$healthy" == 1 ]]
LOCAL_HASH="$(sha256sum scripts/api_server.js | cut -d' ' -f1)"
RUN_HASH="$(docker exec touslesmatchs-api sha256sum /app/server.js | cut -d' ' -f1)"
[[ "$LOCAL_HASH" == "$RUN_HASH" ]]
curl -fsS --max-time 20 "https://www.touslesmatchs.com/api/public-signal-rules?repair=$STAMP" > "$BACKUP/public-rules.json"
docker exec -i touslesmatchs-api node - <<'NODE'
(async()=>{
 const r=await fetch('http://127.0.0.1:3001/public-signal-rules');const d=await r.json();
 if(!r.ok||!d.ok||!Number.isFinite(d.to_minute)||d.min_votes!==4)throw Error('règles non vérifiées');
 console.log('Règles API:',JSON.stringify(d));
 const fs=require('fs'),vm=require('vm'),src=fs.readFileSync('/app/server.js','utf8');
 const ctx=vm.createContext({});
 function section(a,b){return src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)+a.length));}
 vm.runInContext(section('function recoveryNormalize(', 'function recoveryLeagueAllowed('),ctx);
 vm.runInContext(section('function ownerExpandedLeagueAllowed(', '// trusted_major |'),ctx);
 vm.runInContext(section('function recoveryLeagueAllowed(', 'function recoveryNumber('),ctx);
 for(const [country,league] of [['Brazil','Serie A'],['Brazil','Serie B'],['Argentina','Liga Profesional Argentina'],['Denmark','Superliga'],['Australia','A-League'],['Ireland','Premier Division'],['Netherlands','Eredivisie']]){
   if(!ctx.recoveryLeagueAllowed({country,league}))throw Error('Championnat absent: '+country);
 }
 console.log('Championnats autorisés dans le code exécuté: 7/7 OK');
 for(const authorization of ['', 'Bearer invalid-homepage-verification']){
   const r=await fetch('https://www.touslesmatchs.com/api/homepage-live',
     {headers:authorization?{Authorization:authorization}:{},signal:AbortSignal.timeout(20000)});
   const d=await r.json();
   if(!r.ok||!d.ok||d.locked!==true||!Array.isArray(d.matches))throw Error('accès accueil non vérifié');
   for(const m of d.matches){
     if(m.ou25?.locked!==true||m.ou25.over_count!==null||m.ou25.under_count!==null
       ||m.ou25.votes.some(v=>v.direction!=null||v.label!=null||v.confidence!=null))throw Error('direction publique non masquée');
   }
   console.log('Accueil anonyme masqué:',d.matches.length,'matchs; jeton invalide:',!!authorization);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
NODE
curl -fsS --max-time 20 "https://www.touslesmatchs.com/?repair=$STAMP" > "$BACKUP/public-home.html"
grep -q 'signal-rules.js?v=20260905' "$BACKUP/public-home.html"
grep -q 'data-history-day' "$BACKUP/public-home.html"
git diff --quiet && git diff --cached --quiet
[[ "$(git rev-parse HEAD)" == "$TARGET" ]]
trap - ERR
echo "CODE_INSTALLE: main $TARGET; source/conteneur identiques; santé et routes publiques OK"
# Separate reversible data repair: failure leaves the verified code in place.
docker cp scripts/repair_lyon_auxerre_20260904.js touslesmatchs-api:/app/tlm-score-repair.js
if ! docker exec touslesmatchs-api node /app/tlm-score-repair.js; then
  echo 'PARTIAL: ancien score à vérifier, aucun score inventé ni message Telegram envoyé'
fi
docker cp scripts/audit_votes_readonly_20260905.js touslesmatchs-api:/app/tlm-vote-audit.js
docker exec touslesmatchs-api node /app/tlm-vote-audit.js || echo 'PARTIAL: audit des votes incomplet'
docker logs --since 30m touslesmatchs-api 2>&1 | python3 -c '
import sys,re,json
s=sys.stdin.read()
cycles=re.findall(r"\[auto-concile\] live=\d+ eligible=\d+ analysed_this_cycle=\d+ skipped_low_trust=\d+ skipped_sans_cote_reelle=\d+",s)
categories={k:len(re.findall(p,s,re.I)) for k,p in {
 "observer_error":r"\[auto-concile\] (?:cycle|analyse):",
 "no_real_odds":r"\[auto-concile\] sans cote reelle",
 "rate_limit":r"rate.?limit|too many requests",
 "timeout":r"timeout|timed out",
 "budget_block":r"\[LIMIT\]",
 "snapshot_launched":r"\[auto-concile\] analyse snapshot:"
}.items()}
print(json.dumps({"observer_cycles":cycles[-8:],"log_counts_30m":categories}))'
docker compose ps
echo 'PARTIAL: contrôle navigateur et prochain vote réel nécessaires pour valider la réparation complète'
