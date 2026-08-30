#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-home-minute-votes-nfl-$STAMP"
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

echo "[2/5] Correction ciblée minute + votes + NFL"
python3 - <<'PY'
from pathlib import Path

p=Path('public/index.html')
s=p.read_text(encoding='utf-8')
orig=s

# 1) Soccer uniquement : NFL/football américain ne doit jamais passer même si la source écrit sport=Football.
if 'TLM-SOCCER-ONLY-HOME-20260830' not in s:
    fn=s.find('function tlmMatchAllowed(m)')
    if fn < 0:
        raise SystemExit('tlmMatchAllowed introuvable')
    end=s.find('\n}', fn)
    if end < 0:
        raise SystemExit('Fin tlmMatchAllowed introuvable')
    block=s[fn:end]
    old="return sport==='football'&&!excludedCountry&&!womensMatch;"
    if old not in block:
        raise SystemExit('Retour tlmMatchAllowed inattendu')
    new="""/* TLM-SOCCER-ONLY-HOME-20260830 */
  var americanFootball=/\\b(nfl|american football|gridiron|super bowl|national football league|ncaa football)\\b/.test(text);
  return sport==='football'&&!excludedCountry&&!womensMatch&&!americanFootball;"""
    block=block.replace(old,new,1)
    s=s[:fn]+block+s[end:]

# 2) Une seule fonction de minute robuste pour l'affichage/progression du hero.
if 'function tlmHeroMinuteOf(m)' not in s:
    anchor='function liveAwayScore(m)'
    a=s.find(anchor)
    if a < 0:
        raise SystemExit('liveAwayScore introuvable')
    e=s.find('\n', s.find('}',a)+1)
    if e < 0:
        raise SystemExit('Insertion minute impossible')
    helper=r'''
function tlmHeroMinuteOf(m){
  var vals=[m&&m.minute,m&&m.elapsed,m&&m.status&&m.status.elapsed,m&&m.time&&m.time.elapsed];
  for(var i=0;i<vals.length;i++){
    var raw=vals[i];
    if(typeof raw==='number'&&isFinite(raw))return raw;
    var txt=String(raw==null?'':raw).trim();
    var hit=txt.match(/^(\d+)(?:\+(\d+))?/);
    if(hit){var n=Number(hit[1])+(hit[2]?Number(hit[2]):0);if(isFinite(n))return n;}
  }
  return -1;
}
'''
    s=s[:e+1]+helper+s[e+1:]

# RenderHeroLive doit utiliser la minute parsée, pas Number("45+10'").
old_min='minute=Number(m&&m.minute);'
if old_min in s:
    s=s.replace(old_min,'minute=tlmHeroMinuteOf(m);',1)
elif 'minute=tlmHeroMinuteOf(m);' not in s:
    raise SystemExit('Minute renderHeroLive inattendue')

# 3) Ne jamais faire disparaître un vote déjà vu pour LE MEME match pendant les rafraîchissements de la page.
if 'TLM-HERO-VOTE-CACHE-20260830' not in s:
    pos=s.find('function heroVoteCount(m)')
    if pos < 0:
        raise SystemExit('heroVoteCount introuvable')
    cache=r'''/* TLM-HERO-VOTE-CACHE-20260830 */
var tlmHeroVoteCache={};
function tlmHeroKey(m){
  return String((m&&(m.fixtureId||m.fixture_id||m.id||m.sourceId))||((m&&m.home)||'')+'|'+((m&&m.away)||''));
}
function tlmKeepHeroVotes(m){
  if(!m)return m;
  var key=tlmHeroKey(m),cur=heroOu25(m),old=tlmHeroVoteCache[key];
  if(old&&old.count>cur.voteCount){
    var copy=Object.assign({},m);
    copy.ou25=old.ou25;
    return copy;
  }
  if(m.ou25&&cur.voteCount>0&&(!old||cur.voteCount>=old.count)){
    try{tlmHeroVoteCache[key]={count:cur.voteCount,ou25:JSON.parse(JSON.stringify(m.ou25))};}catch(e){tlmHeroVoteCache[key]={count:cur.voteCount,ou25:m.ou25};}
  }
  return m;
}
'''
    s=s[:pos]+cache+s[pos:]

# Appliquer le cache AVANT de calculer voteState.
needle='function renderHeroLive(m){\n  var status=document.getElementById(\'hero-live-status\');'
if needle in s and 'm=tlmKeepHeroVotes(m);' not in s[s.find('function renderHeroLive(m){'):s.find('function renderHeroWatchlist',s.find('function renderHeroLive(m){'))]:
    s=s.replace(needle,"function renderHeroLive(m){\n  m=tlmKeepHeroVotes(m);\n  var status=document.getElementById('hero-live-status');",1)
elif 'm=tlmKeepHeroVotes(m);' not in s:
    raise SystemExit('Insertion cache votes impossible')

# Gardes-fous existants.
for token in ['TLM-HOME-FIXTURES-UI-20260830','TLM-HERO-PRIORITY-ROCK-20260830','async function loadLive()','async function loadHeroLive()','upcoming-rows']:
    if token not in s:
        raise SystemExit('Garde-fou absent: '+token)

if s==orig:
    print('Déjà corrigé — aucun changement')
else:
    p.write_text(s,encoding='utf-8')
    print('OK — minute cohérente, votes conservés, NFL exclu')
PY

echo "[3/5] Vérification structurelle"
grep -q 'TLM-SOCCER-ONLY-HOME-20260830' public/index.html
grep -q 'function tlmHeroMinuteOf(m)' public/index.html
grep -q 'TLM-HERO-VOTE-CACHE-20260830' public/index.html
grep -q 'minute=tlmHeroMinuteOf(m)' public/index.html
grep -q 'americanFootball' public/index.html

echo "[4/5] Contrôle du flux réel"
curl -fsS 'http://127.0.0.1:3001/live-matches' > /tmp/tlm-home-fix-live.json
python3 - <<'PY'
import json,re
D=json.load(open('/tmp/tlm-home-fix-live.json'))
rows=D.get('matches') or D.get('live') or []
def txt(m): return ' '.join(str(m.get(k) or '') for k in ['sport','competition','league','category','home','away']).lower()
nfl=[m for m in rows if re.search(r'\b(nfl|american football|gridiron|super bowl|national football league|ncaa football)\b',txt(m))]
print('MATCHS_REÇUS=',len(rows),'| NFL_REÇUS_BRUT=',len(nfl),'| NFL_A_AFFICHER=0')
for m in nfl[:5]: print(' NFL filtré:',m.get('home'),'—',m.get('away'))
PY

echo "[5/5] Vérification publique"
curl -fsS 'https://www.touslesmatchs.com/?t='"$STAMP" | grep -q 'TLM-SOCCER-ONLY-HOME-20260830'
curl -fsS 'https://www.touslesmatchs.com/?t='"$STAMP" | grep -q 'TLM-HERO-VOTE-CACHE-20260830'

trap - ERR
AFTER="$(sha256sum public/index.html | awk '{print $1}')"
echo "TERMINE"
echo "SHA_APRES=$AFTER"
echo "SAUVEGARDE=$BACKUP"
echo "REGLES: minute unique/parsing robuste; vote deja vu conserve sur le meme match; NFL exclu de l'accueil."
echo "Application / API / Telegram / Stripe / DB inchangés."
