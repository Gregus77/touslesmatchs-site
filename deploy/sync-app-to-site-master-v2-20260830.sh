#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-app-site-master-v2-$STAMP"
mkdir -p "$BACKUP"

INDEX_BEFORE="$(sha256sum public/index.html | awk '{print $1}')"
APP_BEFORE="$(sha256sum public/app.html | awk '{print $1}')"
cp -a public/app.html "$BACKUP/app.html"

rollback() {
  echo "ERREUR — restauration automatique de public/app.html"
  cp -a "$BACKUP/app.html" public/app.html
}
trap rollback ERR

echo "[1/6] Protection du site maître"
echo "INDEX_SHA256_AVANT=$INDEX_BEFORE"
echo "APP_SHA256_AVANT=$APP_BEFORE"

echo "[2/6] Synchronisation ciblée de public/app.html"
python3 - <<'PY'
from pathlib import Path
import re

p = Path('public/app.html')
s = p.read_text(encoding='utf-8')
orig = s
marker = 'TLM-APP-SITE-MASTER-V2-20260830'

# Marqueur robuste : ne dépend pas du titre exact de l'app.
if marker not in s:
    if '</head>' not in s:
        raise SystemExit('Balise </head> introuvable — aucun changement')
    s = s.replace('</head>', '<!-- '+marker+' -->\n</head>', 1)

# 1) LIVE : l'app doit choisir le même type de match que le site maître.
# On remplace uniquement le tri situé dans loadLive(), entre la construction
# de la liste et renderAppHero().
start = s.find('  function loadLive() {')
if start < 0:
    start = s.find('function loadLive() {')
if start < 0:
    raise SystemExit('loadLive app introuvable — aucun changement')
end = s.find('\n  //', start)
if end < 0:
    end = s.find('\nfunction ', start + 20)
if end < 0:
    raise SystemExit('Fin loadLive app introuvable — aucun changement')
block = s[start:end]

sort_pattern = re.compile(r"\n\s*list\.sort\(function\(a,b\)\{.*?\}\);(?=\s*\n\s*renderAppHero\()", re.S)
new_sort = '''
      list.sort(function(a,b){
        function quality(m){
          return (appHomeLogo(m)?2:0)+(appAwayLogo(m)?2:0)+(appHomeScore(m)!==''?2:0)+(appAwayScore(m)!==''?2:0);
        }
        function rank(m){
          var minute=Number(String(m&&m.minute||'').replace(/[^0-9.]/g,''));
          if(!isFinite(minute)) minute=999;
          // Priorité absolue : fenêtre d'analyse 15'-40'.
          // Le plus récent à être entré dans la fenêtre passe devant.
          if(minute>=15&&minute<=40) return 100000-((minute-15)*100)+quality(m);
          // Ensuite ceux qui approchent de 15'.
          if(minute>0&&minute<15) return 50000+(minute*100)+quality(m);
          // Les fins de match restent visibles mais passent derrière.
          if(minute>40) return 10000-Math.min(minute,999)+quality(m);
          return quality(m);
        }
        return rank(b)-rank(a);
      });'''

if 'minute>=15&&minute<=40' not in block:
    block2, n = sort_pattern.subn(new_sort, block, count=1)
    if n != 1:
        raise SystemExit('Tri live app non reconnu — aucun changement')
    s = s[:start] + block2 + s[end:]

# 2) PERFORMANCES : même source de vérité que la page d'accueil.
# On remplace la fonction loadPerf entière, de manière indépendante de son contenu exact.
perf_start = s.find('  function loadPerf() {')
if perf_start < 0:
    perf_start = s.find('function loadPerf() {')
render_start = s.find('  function renderPerf()', perf_start)
if render_start < 0:
    render_start = s.find('function renderPerf()', perf_start)
if perf_start < 0 or render_start < 0:
    raise SystemExit('Bloc performances app introuvable — aucun changement')

if 'function fetchAppHistory(maxRows)' not in s:
    new_perf = '''  function appWasSent(a) {
    var sent=(a&&a.sent)||{};
    return !!(a&&(a.delivery_proven||a.diffused||a.signal_delivered||sent.standard||sent.premium));
  }

  function fetchAppHistory(maxRows) {
    var all=[],offset=0,pageSize=100,first=null,maximum=Math.max(pageSize,Number(maxRows)||2000);
    function next(){
      return get('/api/analysis-history?limit='+pageSize+'&offset='+offset+'&t='+Date.now()).then(flagOffline).then(function(d){
        if(!d||!d.ok) throw new Error((d&&d.error)||'Historique indisponible');
        if(!first) first=d;
        var page=d.analyses||[];
        all=all.concat(page);
        if(page.length<pageSize||all.length>=maximum){
          first=first||{ok:true};
          first.analyses=all.slice(0,maximum);
          return first;
        }
        offset+=pageSize;
        return next();
      });
    }
    return next();
  }

  function loadPerf() {
    fetchAppHistory(2000).then(function(d){
      perf.stats=(d&&d.stats&&(d.stats.abonnes||d.stats))||null;
      perf.rows=((d&&d.analyses)||[]).filter(function(a){
        return isTotal25Row(a)&&appMatchAllowed(a)&&appWasSent(a);
      });
      renderPerf();
    }).catch(function(){
      perf.rows=[];perf.stats=null;renderPerf();
    });
  }
'''
    s = s[:perf_start] + new_perf + s[render_start:]

# 3) Calculs KPI : priorité aux stats officielles renvoyées par le serveur,
# identiques à celles utilisées par le site maître.
render_start = s.find('  function renderPerf()')
if render_start < 0:
    render_start = s.find('function renderPerf()')
kpipos = s.find('$("perf-kpis")', render_start)
if kpipos < 0:
    raise SystemExit('KPI performances app introuvables — aucun changement')
calc_start = s.find('    var rows = perf.rows || [];', render_start, kpipos)
if calc_start < 0:
    raise SystemExit('Début calcul performances app introuvable — aucun changement')

if 'var verified=perf.stats||{};' not in s[calc_start:kpipos]:
    new_calc = '''    var rows = perf.rows || [];
    var done = rows.filter(function(a){ return a.outcome === 'win' || a.outcome === 'loss'; });
    var calcWins = done.filter(function(a){ return a.outcome === 'win'; }).length;
    var calcLosses = done.filter(function(a){ return a.outcome === 'loss'; }).length;
    var calcProfit = done.reduce(function(sum,a){
      var odd=num(a.real_odd||a.odd||a.cote||0);
      if(a.outcome==='win') return sum+((odd>1?odd:1.3)-1)*10;
      if(a.outcome==='loss') return sum-10;
      return sum;
    },0);
    var verified=perf.stats||{};
    var total=Number(verified.total!=null?verified.total:done.length)||0;
    var wins=Number(verified.wins!=null?verified.wins:calcWins)||0;
    var losses=Number(verified.losses!=null?verified.losses:calcLosses)||0;
    var wr=Number(verified.winrate!=null?verified.winrate:(total?Math.round((wins/total)*100):0))||0;
    var profit=Number(verified.profit10!=null?verified.profit10:calcProfit)||0;
    var roi=total?Math.round((profit/(total*10))*100):0;
'''
    s = s[:calc_start] + new_calc + s[kpipos:]

# 4) Nettoyage uniquement des textes VISIBLES de l'ancienne stratégie +0,5.
repls = {
  'content:"+0,5"':'content:"O/U 2,5"',
  'Accès membre Goal plus 0,5':'Accès membre Over / Under 2,5',
  '+0,5 but — accès membre':'Over / Under 2,5 — accès membre',
  'Équipe sélectionnée +0,5':'Sélection Over / Under 2,5',
  'Aucun match validé +0,5':'Aucun signal Over / Under 2,5 validé',
  "signal.bet || (signal.team ? signal.team + ' +0,5 but' : '+0,5 but')":"signal.bet || 'Over / Under 2,5'",
  'Les sélections exactes +0,5 et les alertes membres sont disponibles à partir de 4,90€/mois.':'Les sélections Over / Under 2,5 et les alertes membres sont disponibles à partir de 4,90€/mois.'
}
for a,b in repls.items():
    s=s.replace(a,b)

if s == orig:
    raise SystemExit('Aucune modification nécessaire')
p.write_text(s, encoding='utf-8')
print('OK — app.html synchronisé sur le site maître')
PY

echo "[3/6] Vérifications structurelles"
grep -q 'TLM-APP-SITE-MASTER-V2-20260830' public/app.html
grep -q 'minute>=15&&minute<=40' public/app.html
grep -q 'function fetchAppHistory(maxRows)' public/app.html
grep -q 'var verified=perf.stats||{}' public/app.html

echo "[4/6] Vérification stricte de la page d'accueil"
INDEX_AFTER="$(sha256sum public/index.html | awk '{print $1}')"
echo "INDEX_SHA256_APRES=$INDEX_AFTER"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "ERREUR: public/index.html a changé"; false; }

echo "[5/6] Vérification des flux serveur"
curl -fsS http://127.0.0.1:3001/live-matches > /tmp/tlm-app-v2-live.json
curl -fsS 'http://127.0.0.1:3001/analysis-history?limit=5' > /tmp/tlm-app-v2-history.json
python3 - <<'PY'
import json
live=json.load(open('/tmp/tlm-app-v2-live.json'))
hist=json.load(open('/tmp/tlm-app-v2-history.json'))
print('LIVE_API=',len(live.get('matches') or live.get('live') or []))
print('HISTORY_API_OK=',bool(hist.get('ok')),'ROWS=',len(hist.get('analyses') or []))
if not hist.get('ok'):
    raise SystemExit('Historique API KO')
PY

echo "[6/6] Vérification publique"
curl -fsS 'https://www.touslesmatchs.com/app.html?t='"$STAMP" | grep -q 'TLM-APP-SITE-MASTER-V2-20260830'
curl -fsS https://www.touslesmatchs.com/ >/dev/null

APP_AFTER="$(sha256sum public/app.html | awk '{print $1}')"
trap - ERR
echo "TERMINE — application synchronisée sur le site maître"
echo "APP_SHA256_APRES=$APP_AFTER"
echo "SAUVEGARDE=$BACKUP"
echo "IMPORTANT: public/index.html n'a pas été modifié."
