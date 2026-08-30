#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
BACKUP="/opt/backups/tlm-openrouter-capacity-$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$BACKUP"
cp -a .env "$BACKUP/.env"

rollback() {
  echo "ERREUR — restauration automatique"
  cp -a "$BACKUP/.env" .env
  docker compose up -d --no-deps --force-recreate api
}
trap rollback ERR

python3 - <<'PY'
from pathlib import Path
import re

path=Path(".env")
text=path.read_text(encoding="utf-8")
values={
  "OPENROUTER_MAX_MATCHES_PER_DAY":"120",
  "OPENROUTER_MAX_REQUESTS_PER_DAY":"750",
  "OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY":"180",
}
for key,value in values.items():
    pattern=rf"(?m)^{re.escape(key)}=.*$"
    if re.search(pattern,text):
        text=re.sub(pattern,f"{key}={value}",text)
    else:
        text=text.rstrip()+f"\n{key}={value}\n"
path.write_text(text,encoding="utf-8")
PY

docker compose config --quiet
docker compose up -d --no-deps --force-recreate api
sleep 25

docker exec -i touslesmatchs-api node <<'NODE'
const Database=require("better-sqlite3");
const db=new Database("/data/tlm.db",{readonly:true});
const expected={
  OPENROUTER_MAX_MATCHES_PER_DAY:"120",
  OPENROUTER_MAX_REQUESTS_PER_DAY:"750",
  OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY:"180",
  OPENROUTER_DAILY_BUDGET_EUR:"3",
  OPENROUTER_HARD_STOP:"true"
};
let valid=true;
for(const [key,value] of Object.entries(expected)){
  const actual=String(process.env[key]||"");
  console.log(`${key}=${actual}`);
  if(actual!==value) valid=false;
}
for(const key of ["TELEGRAM_RU_FREE_CHANNEL_ID","TELEGRAM_RU_STANDARD_CHANNEL_ID","TELEGRAM_RU_PREMIUM_CHANNEL_ID"]){
  const ok=Boolean(String(process.env[key]||"").trim());
  console.log(`${key}=${ok?"PRESENTE":"ABSENTE"}`);
  if(!ok) valid=false;
}
const used=db.prepare(`
 SELECT COUNT(DISTINCT match_key) total
 FROM ai_call_budget_log
 WHERE date(created_at)=date('now') AND status='ok'
`).get().total;
console.log(`MATCHS_DEJA_COMPTABILISES=${used}`);
console.log(`CAPACITE_RESTANTE=${Math.max(0,120-used)}`);
if(!valid || used>=120) process.exit(1);
NODE

curl -fsS https://www.touslesmatchs.com/api/health |
python3 -c 'import json,sys;d=json.load(sys.stdin);assert d.get("ok") is True;assert d.get("integrations",{}).get("telegram",{}).get("ok") is True;print("API=OK TELEGRAM=OK")'

if docker logs touslesmatchs-api --since 2m 2>&1 | grep -Ei "uncaughtException|CRASH-GUARD|SyntaxError" >/dev/null; then
  echo "BLOQUE: erreur API apres redemarrage"
  exit 1
fi

trap - ERR
echo "BUDGET_EUROS=INCHANGE_3"
echo "ARRET_SECURITE=CONSERVE"
echo "TELEGRAM_FR_RU=INCHANGE"
echo "VERDICT=OK"
echo "SAUVEGARDE=$BACKUP"
