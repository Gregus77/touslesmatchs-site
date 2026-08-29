#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-home-live-upcoming-$STAMP"
mkdir -p "$BACKUP"
cp -a public/index.html "$BACKUP/index.html"
cp -a scripts/api_server.js "$BACKUP/api_server.js"
rollback(){
  echo "ERREUR — restauration automatique"
  cp -a "$BACKUP/index.html" public/index.html || true
  cp -a "$BACKUP/api_server.js" scripts/api_server.js || true
  docker compose up -d --build api >/dev/null 2>&1 || true
  echo "Restauration : $BACKUP"
}
trap rollback ERR

echo "[1/5] Ajout du flux accueil live + à venir"
python3 <<'PY'
from pathlib import Path
api_p=Path('scripts/api_server.js'); home_p=Path('public/index.html')
api=api_p.read_text(encoding='utf-8'); home=home_p.read_text(encoding='utf-8')

API_MARK='// TLM-HOME-FIXTURES-20260830'
if API_MARK not in api:
    anchor='app.get("/upcoming-picks", async (req, res) => {'
    if anchor not in api:
        raise SystemExit('Ancre API introuvable')
    block=r'''
// TLM-HOME-FIXTURES-20260830
function tlmParisDay(ms = Date.now()) {
  const p = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(ms));
  const g=t=>p.find(x=>x.type===t)?.value||"";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
let tlmHomeFixturesCache={ts:0,data:null};
app.get("/homepage-fixtures", async (req,res)=>{
  try{
    res.set("Cache-Control","no-store, max-age=0");
    if(tlmHomeFixturesCache.data && Date.now()-tlmHomeFixturesCache.ts<120000) return res.json(tlmHomeFixturesCache.data);
    const now=Date.now(), today=tlmParisDay(now), tomorrow=tlmParisDay(now+86400000);
    const liveRaw=await fetchLiveMatches();
    const live=(Array.isArray(liveRaw)?liveRaw:[]).filter(m=>{
      const s=String(m?.status||"").toUpperCase();
      return !["FINISHED","SCHEDULED","TIMED","NS","POSTPONED","CANCELLED"].includes(s);
    }).map(m=>({
      id:m.id,home:m.home,away:m.away,competition:m.competition||"Football",country:(String(m.competition||"").split(/\s*[·•]\s*/).pop()||""),sport:m.sport||"Football",
      kickoff:m.utcDate||null,home_logo:m.home_logo||null,away_logo:m.away_logo||null,score_home:m.score_home,score_away:m.score_away,minute:m.minute,status:m.status||"IN_PLAY"
    }));
    const upcoming=[], seen=new Set();
    const push=x=>{
      if(!x||!x.home||!x.away||!x.kickoff) return;
      const t=new Date(x.kickoff).getTime(); if(!Number.isFinite(t)||t<=now) return;
      const k=(x.home+'|'+x.away+'|'+Math.floor(t/1800000)).toLowerCase(); if(seen.has(k)) return; seen.add(k); upcoming.push(x);
    };
    if(API_SPORTS_KEY){
      try{
        const [a,b]=await Promise.all([
          httpGet(`https://v3.football.api-sports.io/fixtures?date=${today}&status=NS`,{"x-apisports-key":API_SPORTS_KEY}),
          httpGet(`https://v3.football.api-sports.io/fixtures?date=${tomorrow}&status=NS`,{"x-apisports-key":API_SPORTS_KEY})
        ]);
        for(const f of [...(a.response||[]),...(b.response||[])]) push({id:`as-${f.fixture?.id||""}`,home:f.teams?.home?.name||"",away:f.teams?.away?.name||"",competition:f.league?.name||"Football",country:f.league?.country||"",country_flag:f.league?.flag||null,sport:"Football",kickoff:f.fixture?.date||null,home_logo:f.teams?.home?.logo||null,away_logo:f.teams?.away?.logo||null});
      }catch(e){console.warn('[homepage-fixtures] API-Sports:',e.message)}
    }
    if(FOOTBALL_DATA_KEY){
      try{
        const fd=await httpGet(`https://api.football-data.org/v4/matches?status=SCHEDULED,TIMED&dateFrom=${today}&dateTo=${tomorrow}`,{"X-Auth-Token":FOOTBALL_DATA_KEY});
        for(const m of (fd.matches||[])) push({id:`fd-${m.id}`,home:m.homeTeam?.name||m.homeTeam?.shortName||"",away:m.awayTeam?.name||m.awayTeam?.shortName||"",competition:m.competition?.name||"Football",country:m.area?.name||m.competition?.area?.name||"",country_flag:m.area?.flag||m.competition?.area?.flag||null,sport:"Football",kickoff:m.utcDate||null,home_logo:m.homeTeam?.crest||null,away_logo:m.awayTeam?.crest||null});
      }catch(e){console.warn('[homepage-fixtures] football-data:',e.message)}
    }
    upcoming.sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
    const data={ok:true,live,upcoming,today,tomorrow}; tlmHomeFixturesCache={ts:Date.now(),data};
    console.log(`[homepage-fixtures] live=${live.length} upcoming=${upcoming.length} ${today}->${tomorrow}`);
    res.json(data);
  }catch(e){console.error('[homepage-fixtures]',e.message);res.status(500).json({ok:false,error:'internal_error'})}
});

'''
    api=api.replace(anchor,block+anchor,1)

HOME_MARK='TLM-HOME-FIXTURES-UI-20260830'
if HOME_MARK not in home:
    end='</body>'
    if end not in home: raise SystemExit('Ancre HTML introuvable')
    ui=r'''
<script>
/* TLM-HOME-FIXTURES-UI-20260830 */
(function(){
  const FLAGS={France:'🇫🇷',England:'🏴',Spain:'🇪🇸',Italy:'🇮🇹',Germany:'🇩🇪',Portugal:'🇵🇹',Netherlands:'🇳🇱',Belgium:'🇧🇪',Scotland:'🏴',Turkey:'🇹🇷',Austria:'🇦🇹',Switzerland:'🇨🇭',Poland:'🇵🇱',Greece:'🇬🇷',Denmark:'🇩🇰',Sweden:'🇸🇪',Norway:'🇳🇴',Finland:'🇫🇮',Brazil:'🇧🇷',Argentina:'🇦🇷',Japan:'🇯🇵',Mexico:'🇲🇽',Croatia:'🇭🇷',Colombia:'🇨🇴',Australia:'🇦🇺',World:'🌍'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials=s=>String(s||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const logo=(src,n)=>src?'<img src="'+esc(src)+'" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain" onerror="this.style.display=\'none\'">':esc(initials(n));
  const flag=x=>x.country_flag?'<img src="'+esc(x.country_flag)+'" alt="'+esc(x.country||'')+'" style="width:24px;height:17px;display:inline-block;object-fit:cover;border-radius:3px;vertical-align:-3px;margin-right:6px" onerror="this.style.display=\'none\'">':('<span style="margin-right:6px">'+(FLAGS[x.country]||'🌍')+'</span>');
  function liveRow(m){const sh=m.score_home??'-',sa=m.score_away??'-';return '<div class="live-row"><div class="live-comp"><div class="live-comp-name">⚽ '+flag(m)+esc(m.country||m.competition||'Football')+'</div><div class="live-comp-min">'+esc(m.minute?m.minute+"'":'LIVE')+'</div></div><div class="live-logo">'+logo(m.home_logo,m.home)+'</div><div class="live-team-name">'+esc(m.home)+'</div><div class="live-score">'+esc(sh)+'-'+esc(sa)+'</div><div class="live-logo">'+logo(m.away_logo,m.away)+'</div><div class="live-team-name">'+esc(m.away)+'</div></div>'}
  function upcomingRow(m){let d=new Date(m.kickoff),when='';if(!isNaN(d)) when=d.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit'})+' · '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});return '<div class="upcoming-item"><div class="upcoming-highlight-logo">'+logo(m.home_logo,m.home)+'</div><div class="upcoming-info"><div class="upcoming-teams">⚽ '+flag(m)+esc(m.home)+' — '+esc(m.away)+'</div><div class="upcoming-comp">'+esc(m.country||'International')+' · '+esc(m.competition||'Football')+(when?' · '+esc(when):'')+'</div></div><div class="upcoming-highlight-logo">'+logo(m.away_logo,m.away)+'</div></div>'}
  async function refreshHomeFixtures(){try{const r=await fetch('/api/homepage-fixtures?t='+Date.now(),{cache:'no-store'}),d=await r.json();if(!d.ok)return;const live=document.getElementById('live-rows'),up=document.getElementById('upcoming-rows'),hl=document.getElementById('upcoming-highlight');if(live)live.innerHTML=(d.live||[]).length?(d.live||[]).map(liveRow).join(''):'<div class="empty-note">Aucun match en direct actuellement.</div>';if(hl)hl.innerHTML='';if(up)up.innerHTML=(d.upcoming||[]).length?(d.upcoming||[]).map(upcomingRow).join(''):'<div class="empty-note">Aucun match programmé d’ici demain.</div>';}catch(e){console.error('[home-fixtures-ui]',e)}}
  refreshHomeFixtures(); setInterval(refreshHomeFixtures,60000);
})();
</script>
'''
    home=home.replace(end,ui+end,1)

api_p.write_text(api,encoding='utf-8'); home_p.write_text(home,encoding='utf-8')
print('OK')
PY

echo "[2/5] Vérification syntaxe"
node --check scripts/api_server.js
grep -q 'TLM-HOME-FIXTURES-20260830' scripts/api_server.js
grep -q 'TLM-HOME-FIXTURES-UI-20260830' public/index.html

echo "[3/5] Reconstruction API"
docker compose up -d --build api

echo "[4/5] Test du flux"
sleep 4
curl -fsS http://127.0.0.1:3001/homepage-fixtures | python3 -c 'import json,sys;d=json.load(sys.stdin);print("LIVE:",len(d.get("live",[])),"| A VENIR:",len(d.get("upcoming",[])))'

echo "[5/5] Test accueil"
curl -fsS https://www.touslesmatchs.com/ | grep -q 'TLM-HOME-FIXTURES-UI-20260830'
trap - ERR
echo "TERMINE — sauvegarde : $BACKUP"
