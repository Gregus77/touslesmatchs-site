#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-app-site-master-$STAMP"
mkdir -p "$BACKUP"

INDEX_BEFORE="$(sha256sum public/index.html | awk '{print $1}')"
cp -a public/app.html "$BACKUP/app.html"

rollback() {
  echo "ERREUR — restauration automatique de public/app.html"
  cp -a "$BACKUP/app.html" public/app.html
}
trap rollback ERR

echo "[1/6] Protection de la page d'accueil"
echo "INDEX_SHA256_AVANT=$INDEX_BEFORE"

echo "[2/6] Synchronisation ciblée de l'application"
python3 - <<'PY'
from pathlib import Path

p=Path('public/app.html')
s=p.read_text(encoding='utf-8')
orig=s

marker='TLM-APP-SITE-MASTER-20260830'
if marker not in s:
    anchor='<title>TousLesMatchs — Concile IA</title>'
    if anchor not in s:
        raise SystemExit('Titre app introuvable — aucun changement')
    s=s.replace(anchor, anchor+'\n<!-- '+marker+' -->', 1)

# 1) Le match vedette de l'app suit la même logique métier que le site maître :
# priorité aux rencontres venant d'entrer dans la fenêtre 15-40, puis celles proches de 15,
# les fins de match passent derrière.
old_sort="""list.sort(function(a,b){function q(m){return (appHomeLogo(m)?2:0)+(appAwayLogo(m)?2:0)+(appHomeScore(m)!==''?2:0)+(appAwayScore(m)!==''?2:0)+Math.min(1,Number(m.minute||0)/100);}return q(b)-q(a);});"""
new_sort="""list.sort(function(a,b){
        function q(m){return (appHomeLogo(m)?2:0)+(appAwayLogo(m)?2:0)+(appHomeScore(m)!==''?2:0)+(appAwayScore(m)!==''?2:0);}
        function rank(m){
          var minute=Number(String(m&&m.minute||'').replace(/[^0-9.]/g,''));
          if(!isFinite(minute)) minute=999;
          if(minute>=15&&minute<=40) return 100000-((minute-15)*100)+q(m);
          if(minute>0&&minute<15) return 50000+(minute*100)+q(m);
          if(minute>40) return 10000-Math.min(minute,999)+q(m);
          return q(m);
        }
        return rank(b)-rank(a);
      });"""
if old_sort in s:
    s=s.replace(old_sort,new_sort,1)
elif new_sort not in s:
    raise SystemExit('Tri live app inattendu — aucun changement')

# 2) Les statistiques de l'app utilisent les mêmes stats abonnés que la page d'accueil
# et n'affichent dans le détail que les signaux réellement diffusés.
old_perf="""  function loadPerf() {
    get(\"/api/analysis-history?limit=160\").then(flagOffline).then(function (d) {
      perf.rows = ((d && d.analyses) || []).filter(function(a){return isTotal25Row(a)&&appMatchAllowed(a);});
      renderPerf();
    });
  }
"""
new_perf="""  function appWasSent(a) {
    var sent=(a&&a.sent)||{};
    return !!(a&&(a.delivery_proven||a.diffused||a.signal_delivered||sent.standard||sent.premium||sent.elite));
  }

  function fetchAppHistory(maxRows) {
    var all=[],offset=0,pageSize=100,first=null,maximum=Math.max(pageSize,Number(maxRows)||2000);
    function next(){
      return get('/api/analysis-history?limit='+pageSize+'&offset='+offset+'&t='+Date.now()).then(flagOffline).then(function(d){
        if(!d||!d.ok) throw new Error((d&&d.error)||'Historique indisponible');
        if(!first) first=d;
        var page=d.analyses||[];
        all=all.concat(page);
        if(page.length<pageSize||all.length>=maximum){first=first||{ok:true};first.analyses=all.slice(0,maximum);return first;}
        offset+=pageSize;
        return next();
      });
    }
    return next();
  }

  function loadPerf() {
    fetchAppHistory(2000).then(function (d) {
      perf.stats = (d&&d.stats&&(d.stats.abonnes||d.stats)) || null;
      perf.rows = ((d && d.analyses) || []).filter(function(a){return isTotal25Row(a)&&appMatchAllowed(a)&&appWasSent(a);});
      renderPerf();
    }).catch(function(){perf.rows=[];perf.stats=null;renderPerf();});
  }
"""
if old_perf in s:
    s=s.replace(old_perf,new_perf,1)
elif 'function fetchAppHistory(maxRows)' not in s:
    raise SystemExit('Bloc performances app inattendu — aucun changement')

old_calc="""    var rows = perf.rows || [];
    var done = rows.filter(function(a){ return a.outcome === 'win' || a.outcome === 'loss'; });
    var wins = done.filter(function(a){ return a.outcome === 'win'; }).length;
    var losses = done.filter(function(a){ return a.outcome === 'loss'; }).length;
    var total = done.length;
    var wr = total ? Math.round((wins / total) * 100) : 0;
    var profit = done.reduce(function(sum, a){
      var odd = num(a.real_odd || a.odd || a.cote || 0);
      if (a.outcome === 'win') return sum + ((odd > 1 ? odd : 1.3) - 1) * 10;
      if (a.outcome === 'loss') return sum - 10;
      return sum;
    }, 0);
    var roi = total ? Math.round((profit / (total * 10)) * 100) : 0;
"""
new_calc="""    var rows = perf.rows || [];
    var done = rows.filter(function(a){ return a.outcome === 'win' || a.outcome === 'loss'; });
    var calcWins = done.filter(function(a){ return a.outcome === 'win'; }).length;
    var calcLosses = done.filter(function(a){ return a.outcome === 'loss'; }).length;
    var calcProfit = done.reduce(function(sum, a){
      var odd = num(a.real_odd || a.odd || a.cote || 0);
      if (a.outcome === 'win') return sum + ((odd > 1 ? odd : 1.3) - 1) * 10;
      if (a.outcome === 'loss') return sum - 10;
      return sum;
    }, 0);
    var verified=perf.stats||{};
    var total=Number(verified.total!=null?verified.total:done.length)||0;
    var wins=Number(verified.wins!=null?verified.wins:calcWins)||0;
    var losses=Number(verified.losses!=null?verified.losses:calcLosses)||0;
    var wr=Number(verified.winrate!=null?verified.winrate:(total?Math.round((wins/total)*100):0))||0;
    var profit=Number(verified.profit10!=null?verified.profit10:calcProfit)||0;
    var roi=total?Math.round((profit/(total*10))*100):0;
"""
if old_calc in s:
    s=s.replace(old_calc,new_calc,1)
elif 'var verified=perf.stats||{};' not in s:
    raise SystemExit('Calcul statistiques app inattendu — aucun changement')

# 3) Suppression des textes visibles de l'ancienne stratégie +0,5.
repls={
  'content:"+0,5"':'content:"O/U 2,5"',
  'Accès membre Goal plus 0,5':'Accès membre Over / Under 2,5',
  '+0,5 but — accès membre':'Over / Under 2,5 — accès membre',
  "Équipe sélectionnée +0,5":"Sélection Over / Under 2,5",
  'Aucun match validé +0,5':'Aucun signal Over / Under 2,5 validé',
  "signal.bet || (signal.team ? signal.team + ' +0,5 but' : '+0,5 but')":"signal.bet || 'Over / Under 2,5'",
  'Les sélections exactes +0,5 et les alertes membres sont disponibles à partir de 4,90€/mois.':'Les sélections Over / Under 2,5 et les alertes membres sont disponibles à partir de 4,90€/mois.'
}
for a,b in repls.items():
    s=s.replace(a,b)

if s==orig:
    raise SystemExit('Aucune modification nécessaire')
p.write_text(s,encoding='utf-8')
print('OK — app.html synchronisé sans toucher index.html')
PY

echo "[3/6] Vérifications syntaxiques et marqueurs"
grep -q 'TLM-APP-SITE-MASTER-20260830' public/app.html
grep -q 'function fetchAppHistory(maxRows)' public/app.html
grep -q 'var verified=perf.stats||{}' public/app.html
grep -q 'minute>=15&&minute<=40' public/app.html

echo "[4/6] Vérification que l'accueil n'a pas changé"
INDEX_AFTER="$(sha256sum public/index.html | awk '{print $1}')"
echo "INDEX_SHA256_APRES=$INDEX_AFTER"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "ERREUR: index.html a changé"; false; }

echo "[5/6] Vérification des flux serveur existants"
curl -fsS http://127.0.0.1:3001/live-matches >/tmp/tlm-app-live.json
curl -fsS 'http://127.0.0.1:3001/analysis-history?limit=5' >/tmp/tlm-app-history.json
python3 - <<'PY'
import json
live=json.load(open('/tmp/tlm-app-live.json'))
hist=json.load(open('/tmp/tlm-app-history.json'))
print('LIVE_API=',len(live.get('matches') or live.get('live') or []))
print('HISTORY_API_OK=',bool(hist.get('ok')),'ROWS=',len(hist.get('analyses') or []))
if not hist.get('ok'): raise SystemExit('Historique API KO')
PY

echo "[6/6] Vérification publique app + accueil"
curl -fsS https://www.touslesmatchs.com/app.html | grep -q 'TLM-APP-SITE-MASTER-20260830'
curl -fsS https://www.touslesmatchs.com/ >/dev/null

trap - ERR
echo "TERMINE — application synchronisée sur le site maître"
echo "SAUVEGARDE=$BACKUP"
echo "IMPORTANT: public/index.html n'a pas été modifié."
