#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-site-hero-priority-rock-$STAMP"
mkdir -p "$BACKUP"
cp -a public/index.html "$BACKUP/index.html"

rollback(){
  echo "ERREUR — restauration automatique de public/index.html"
  cp -a "$BACKUP/index.html" public/index.html
}
trap rollback ERR

BEFORE="$(sha256sum public/index.html | awk '{print $1}')"
echo "[1/5] Sauvegarde"
echo "SHA_AVANT=$BEFORE"

echo "[2/5] Verrouillage de la priorité du grand encart"
python3 - <<'PY'
from pathlib import Path
import re

p=Path('public/index.html')
s=p.read_text(encoding='utf-8')

start=s.find('async function loadHeroLive()')
if start < 0:
    raise SystemExit('loadHeroLive introuvable — aucune modification')
end=s.find('loadHeroLive();setInterval', start)
if end < 0:
    raise SystemExit('Fin loadHeroLive introuvable — aucune modification')
hero=s[start:end]

# Le hero doit travailler sur tous les matchs live autorisés, pas uniquement ceux déjà validés.
if '.filter(tlmHomepageAnalyzedMatch)' in hero:
    if hero.count('.filter(tlmHomepageAnalyzedMatch)') != 1:
        raise SystemExit('Filtre hero ambigu — aucune modification')
    hero=hero.replace('.filter(tlmHomepageAnalyzedMatch)', '.filter(tlmMatchAllowed)', 1)
elif '.filter(tlmMatchAllowed)' not in hero:
    raise SystemExit('Filtre hero inconnu — aucune modification')

sort_start=hero.find('matches.sort(function(a,b){')
if sort_start < 0:
    raise SystemExit('Tri hero introuvable — aucune modification')
sort_end=hero.find('tlmHasLiveMatch=', sort_start)
if sort_end < 0:
    raise SystemExit('Fin tri hero introuvable — aucune modification')

new_sort='''/* TLM-HERO-PRIORITY-ROCK-20260830 */
    matches.sort(function(a,b){
      function minuteOf(m){
        var vals=[m&&m.minute,m&&m.elapsed,m&&m.status&&m.status.elapsed,m&&m.time&&m.time.elapsed];
        for(var i=0;i<vals.length;i++){
          var raw=vals[i];
          if(typeof raw==='number'&&isFinite(raw))return raw;
          var txt=String(raw==null?'':raw).trim();
          var hit=txt.match(/^(\\d+)(?:\\+(\\d+))?/);
          if(hit){var n=Number(hit[1])+(hit[2]?Number(hit[2]):0);if(isFinite(n))return n;}
        }
        return -1;
      }
      function group(m){
        var n=minuteOf(m);
        if(n>=15&&n<=40)return 0;  /* priorité absolue */
        if(n>=0&&n<15)return 1;    /* prochain à entrer dans la fenêtre */
        return 2;                  /* >40', 90'+ ou minute inconnue */
      }
      function quality(m){
        return (liveHomeLogo(m)?2:0)+(liveAwayLogo(m)?2:0)+(liveHomeScore(m)!==''?2:0)+(liveAwayScore(m)!==''?2:0);
      }
      var ga=group(a),gb=group(b),ma=minuteOf(a),mb=minuteOf(b);
      if(ga!==gb)return ga-gb;
      /* 15'-40' : le match ayant démarré le plus récemment (minute la plus basse) gagne. */
      if(ga===0&&ma!==mb)return ma-mb;
      /* Avant 15' : celui qui est le plus proche de 15' gagne. */
      if(ga===1&&ma!==mb)return mb-ma;
      /* Après 40' : le moins avancé reste devant un 90'+. Minute inconnue tout au fond. */
      if(ga===2){
        if(ma<0&&mb>=0)return 1;
        if(mb<0&&ma>=0)return -1;
        if(ma!==mb)return ma-mb;
      }
      return quality(b)-quality(a);
    });
    '''
hero=hero[:sort_start]+new_sort+hero[sort_end:]
s=s[:start]+hero+s[end:]

# Garde-fous essentiels.
for token in ['TLM-HOME-FIXTURES-UI-20260830','async function loadLive()','async function loadHeroLive()','upcoming-rows','TLM-HERO-PRIORITY-ROCK-20260830']:
    if token not in s:
        raise SystemExit('Garde-fou absent: '+token)

p.write_text(s,encoding='utf-8')
print('OK — règle 15-40 verrouillée dans le hero')
PY

echo "[3/5] Test du flux live réel"
curl -fsS 'http://127.0.0.1:3001/live-matches' > /tmp/tlm-live-rock.json
python3 - <<'PY'
import json,re
D=json.load(open('/tmp/tlm-live-rock.json'))
rows=D.get('matches') or D.get('live') or []

def minute(m):
    vals=[m.get('minute'),m.get('elapsed'),(m.get('status') or {}).get('elapsed') if isinstance(m.get('status'),dict) else None,(m.get('time') or {}).get('elapsed') if isinstance(m.get('time'),dict) else None]
    for v in vals:
        if isinstance(v,(int,float)): return float(v)
        z=re.match(r'^(\d+)(?:\+(\d+))?',str(v or '').strip())
        if z:return float(z.group(1))+float(z.group(2) or 0)
    return -1

def rank(m):
    n=minute(m)
    if 15<=n<=40:return (0,n)
    if 0<=n<15:return (1,-n)
    return (2,9999 if n<0 else n)

ordered=sorted(rows,key=rank)
print('MATCHS LIVE=',len(rows))
print('CANDIDATS 15-40:')
for m in sorted([x for x in rows if 15<=minute(x)<=40],key=minute)[:10]:
    print(' -',m.get('home'),'—',m.get('away'),'|',minute(m),"'")
if ordered:
    m=ordered[0]
    print('PRIORITE CALCULEE=',m.get('home'),'—',m.get('away'),'|',minute(m),"'")
PY

echo "[4/5] Vérification structure + accueil public"
grep -q 'TLM-HERO-PRIORITY-ROCK-20260830' public/index.html
grep -q 'if(n>=15&&n<=40)return 0' public/index.html
curl -fsS 'https://www.touslesmatchs.com/?t='"$STAMP" | grep -q 'TLM-HERO-PRIORITY-ROCK-20260830'

echo "[5/5] TERMINE"
trap - ERR
AFTER="$(sha256sum public/index.html | awk '{print $1}')"
echo "SHA_APRES=$AFTER"
echo "SAUVEGARDE=$BACKUP"
echo "REGLE GRAVEE: 15-40 prioritaire; dans cette fenêtre, la minute la plus basse passe devant."
echo "Application / API / Telegram / Stripe / DB inchangés."
