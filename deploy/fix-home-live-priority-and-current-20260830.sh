#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-home-live-priority-$STAMP"
mkdir -p "$BACKUP"
cp -a public/index.html "$BACKUP/index.html"

rollback() {
  echo "ERREUR — restauration automatique de public/index.html"
  cp -a "$BACKUP/index.html" public/index.html
}
trap rollback ERR

echo "[1/5] Sauvegarde + contrôle avant modification"
BEFORE_SHA="$(sha256sum public/index.html | awk '{print $1}')"
echo "SHA avant: $BEFORE_SHA"
curl -fsS http://127.0.0.1:3001/homepage-fixtures | python3 -c 'import json,sys; d=json.load(sys.stdin); print("Flux actuel — LIVE:",len(d.get("live",[])),"| A VENIR:",len(d.get("upcoming",[]))); assert d.get("ok")'

echo "[2/5] Correction ciblée de deux fonctions de l'accueil"
python3 - <<'PY'
from pathlib import Path

p = Path('public/index.html')
s = p.read_text(encoding='utf-8')
original = s

# 1) Bloc "Matchs en cours" : afficher les matchs réellement live autorisés,
# même avant validation du Concile.
start_live = s.find('async function loadLive()')
if start_live < 0:
    raise SystemExit('loadLive() introuvable — aucune modification')
end_live = s.find('async function loadHeroLive()', start_live)
if end_live < 0:
    end_live = s.find('/* ══ HERO STADE', start_live)
if end_live < 0:
    raise SystemExit('Limite de loadLive() introuvable — aucune modification')

live_block = s[start_live:end_live]
if '.filter(tlmHomepageAnalyzedMatch)' in live_block:
    if live_block.count('.filter(tlmHomepageAnalyzedMatch)') != 1:
        raise SystemExit('Filtre loadLive non unique — aucune modification')
    live_block = live_block.replace('.filter(tlmHomepageAnalyzedMatch)', '.filter(tlmMatchAllowed)', 1)
elif '.filter(tlmMatchAllowed)' not in live_block:
    raise SystemExit('Filtre loadLive inconnu — aucune modification')
s = s[:start_live] + live_block + s[end_live:]

# 2) Hero : même source live autorisée, puis priorité fonctionnelle.
start_hero = s.find('async function loadHeroLive()')
if start_hero < 0:
    raise SystemExit('loadHeroLive() introuvable — aucune modification')
end_hero = s.find('loadHeroLive();setInterval', start_hero)
if end_hero < 0:
    raise SystemExit('Fin de loadHeroLive() introuvable — aucune modification')

hero = s[start_hero:end_hero]
if '.filter(tlmHomepageAnalyzedMatch)' in hero:
    if hero.count('.filter(tlmHomepageAnalyzedMatch)') != 1:
        raise SystemExit('Filtre hero non unique — aucune modification')
    hero = hero.replace('.filter(tlmHomepageAnalyzedMatch)', '.filter(tlmMatchAllowed)', 1)
elif '.filter(tlmMatchAllowed)' not in hero:
    raise SystemExit('Filtre hero inconnu — aucune modification')

marker = 'TLM-HERO-LIVE-PRIORITY-20260830'
if marker not in hero:
    sort_start = hero.find('matches.sort(function(a,b){')
    sort_end = hero.find('tlmHasLiveMatch=', sort_start)
    if sort_start < 0 or sort_end < 0:
        raise SystemExit('Tri hero introuvable — aucune modification')
    old_sort = hero[sort_start:sort_end]
    if 'return quality(b)-quality(a);' not in old_sort:
        raise SystemExit('Tri hero différent de la version connue — aucune modification')

    new_sort = '''/* TLM-HERO-LIVE-PRIORITY-20260830 */
    matches.sort(function(a,b){
      function minuteOf(m){var n=Number(m&&m.minute);return isFinite(n)?n:-1;}
      function group(m){var n=minuteOf(m);if(n>=15&&n<=40)return 0;if(n>=0&&n<15)return 1;return 2;}
      function quality(m){return (liveHomeLogo(m)?2:0)+(liveAwayLogo(m)?2:0)+(liveHomeScore(m)!==''?2:0)+(liveAwayScore(m)!==''?2:0);}
      var ga=group(a),gb=group(b),ma=minuteOf(a),mb=minuteOf(b);
      if(ga!==gb)return ga-gb;
      /* 15-40' : le match qui vient le plus récemment d'entrer dans la fenêtre passe devant. */
      if(ga===0&&ma!==mb)return ma-mb;
      /* Avant 15' : celui qui approche le plus de la fenêtre passe devant. */
      if(ga===1&&ma!==mb)return mb-ma;
      /* Après 40' : le moins avancé passe devant un match à 90'+. */
      if(ga===2&&ma!==mb)return ma-mb;
      return quality(b)-quality(a);
    });
    '''
    hero = hero[:sort_start] + new_sort + hero[sort_end:]

s = s[:start_hero] + hero + s[end_hero:]

# Garde-fous : les blocs qui viennent d'être sécurisés doivent toujours exister.
required = [
    'TLM-HOME-FIXTURES-UI-20260830',
    'async function loadLive()',
    'async function loadHeroLive()',
    'TLM-HERO-LIVE-PRIORITY-20260830',
    'upcoming-rows',
]
for token in required:
    if token not in s:
        raise SystemExit(f'Garde-fou absent: {token} — aucune modification')

if s == original:
    print('Déjà corrigé — aucun octet à changer')
else:
    p.write_text(s, encoding='utf-8')
    print('OK — uniquement liste live + priorité du grand encart corrigées')
PY

echo "[3/5] Vérification structurelle"
python3 - <<'PY'
from pathlib import Path
s=Path('public/index.html').read_text(encoding='utf-8')
assert 'TLM-HOME-FIXTURES-UI-20260830' in s
assert 'TLM-HERO-LIVE-PRIORITY-20260830' in s
start=s.index('async function loadLive()')
end=s.index('async function loadHeroLive()',start)
assert '.filter(tlmMatchAllowed)' in s[start:end]
h=s.index('async function loadHeroLive()')
he=s.index('loadHeroLive();setInterval',h)
assert '.filter(tlmMatchAllowed)' in s[h:he]
print('OK — matchs à venir et structure GOLDEN conservés')
PY

echo "[4/5] Vérification API live + accueil public"
curl -fsS http://127.0.0.1:3001/homepage-fixtures | python3 -c 'import json,sys; d=json.load(sys.stdin); print("Flux après patch — LIVE:",len(d.get("live",[])),"| A VENIR:",len(d.get("upcoming",[]))); assert d.get("ok")'
curl -fsS https://www.touslesmatchs.com/ | grep -q 'TLM-HERO-LIVE-PRIORITY-20260830'

echo "[5/5] TERMINE"
trap - ERR
AFTER_SHA="$(sha256sum public/index.html | awk '{print $1}')"
echo "SHA après: $AFTER_SHA"
echo "SAUVEGARDE=$BACKUP"
echo "Aucun rebuild Docker. Aucun changement API/Telegram/Stripe/DB."
