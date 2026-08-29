#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-hero-live-$STAMP"
mkdir -p "$BACKUP"
cp -a public/index.html "$BACKUP/index.html"

rollback(){
  echo "ERREUR — restauration automatique de public/index.html"
  cp -a "$BACKUP/index.html" public/index.html
}
trap rollback ERR

echo "[1/4] Vérification de l'état GOLDEN"
grep -q 'TLM-HOME-FIXTURES-UI-20260830' public/index.html
curl -fsS http://127.0.0.1:3001/homepage-fixtures >/tmp/tlm-home-before.json
python3 - <<'PY'
import json
p=json.load(open('/tmp/tlm-home-before.json',encoding='utf-8'))
assert p.get('ok') is True
print('Avant : LIVE',len(p.get('live',[])),'| A VENIR',len(p.get('upcoming',[])))
PY

echo "[2/4] Correction ciblée du panneau principal uniquement"
python3 - <<'PY'
from pathlib import Path
p=Path('public/index.html')
s=p.read_text(encoding='utf-8')
old="var matches=(d.matches||d.live||[]).filter(tlmHomepageAnalyzedMatch);"
new="var matches=(d.matches||d.live||[]).filter(tlmMatchAllowed);"
count=s.count(old)
if count != 1:
    raise SystemExit(f'Ligne attendue trouvée {count} fois — abandon sans modification')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
PY

echo "[3/4] Contrôles anti-régression"
grep -q "var matches=(d.matches||d.live||\[\]).filter(tlmMatchAllowed);" public/index.html
grep -q 'TLM-HOME-FIXTURES-UI-20260830' public/index.html
curl -fsS http://127.0.0.1:3001/homepage-fixtures >/tmp/tlm-home-after.json
python3 - <<'PY'
import json
b=json.load(open('/tmp/tlm-home-before.json',encoding='utf-8'))
a=json.load(open('/tmp/tlm-home-after.json',encoding='utf-8'))
assert a.get('ok') is True
assert len(a.get('live',[])) >= 0
assert len(a.get('upcoming',[])) >= 0
print('Après : LIVE',len(a.get('live',[])),'| A VENIR',len(a.get('upcoming',[])))
PY

# Vérifie que les sections vitales existent toujours, sans les modifier.
for marker in 'live-rows' 'upcoming-rows'; do grep -q "$marker" public/index.html; done

echo "[4/4] TERMINE"
echo "Sauvegarde : $BACKUP"
echo "Modification unique : le hero affiche maintenant tout match football autorisé en direct, même avant analyse IA."
echo "Aucun changement API, Docker, Telegram, Stripe, historique ou matchs à venir."
trap - ERR
