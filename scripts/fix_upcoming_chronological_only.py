#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil, subprocess

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "public" / "index.html"
API = ROOT / "scripts" / "api_server.js"
BACKUP = Path("/opt/backups") / f"tlm-upcoming-only-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
BACKUP.mkdir(parents=True, exist_ok=True)
shutil.copy2(INDEX, BACKUP / "index.before.html")
shutil.copy2(API, BACKUP / "api.before.js")

idx = INDEX.read_text(encoding="utf-8")
api = API.read_text(encoding="utf-8")

# ------------------------------------------------------------------
# API : exposer les fixtures fiables déjà collectées par API-Sports.
# Ne change aucune logique Concile / Telegram / historique.
# ------------------------------------------------------------------
old_cache = "_upcomingPicksCache = { ts: Date.now(), data: top, featuredMatch, stats };"
new_cache = "_upcomingPicksCache = { ts: Date.now(), data: top, fixtures: trustedFixtures.slice().sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff)).slice(0,60), featuredMatch, stats };"
if old_cache in api:
    api = api.replace(old_cache, new_cache, 1)

if "fixtures: (result.fixtures || [])" not in api:
    marker = "      featuredMatch: featured ? {"
    if marker not in api:
        raise SystemExit("BLOQUE_API: ancre upcoming introuvable")
    fixtures_block = '''      fixtures: (result.fixtures || [])\n        .filter(p => new Date(p.kickoff).getTime() > Date.now())\n        .sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff))\n        .map(p => ({\n          home: p.home, away: p.away, competition: p.competition, country: p.country,\n          sport: p.sport || "Football", kickoff: p.kickoff,\n          home_logo: p.home_logo || null, away_logo: p.away_logo || null,\n          status: p.status || "scheduled"\n        })),\n'''
    api = api.replace(marker, fixtures_block + marker, 1)

API.write_text(api, encoding="utf-8")
subprocess.check_call(["node", "--check", str(API)])

# ------------------------------------------------------------------
# FRONT : remplacer UNIQUEMENT le bloc Matchs à venir.
# Tout ce qui est avant/après (dont les 5 derniers jours) reste intact.
# ------------------------------------------------------------------
start_marker = "/* ══ MATCHS A VENIR"
end_marker = "/* ══ DERNIERS VERDICTS DU CONCILE"
start = idx.find(start_marker)
end = idx.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("BLOQUE_HTML: bloc Matchs à venir introuvable")

new_section = r'''/* ══ MATCHS A VENIR — CHRONOLOGIQUES ══ */
function tlmUpcomingCountryLeague(p){
  var comp=splitComp(p.competition||'');
  return {
    country:String(comp.country||p.country||'International').trim(),
    league:String(comp.league||p.competition||'Championnat').trim()
  };
}
function tlmUpcomingKickoff(p){
  try{var d=new Date(p.kickoff);return isNaN(d.getTime())?null:d;}catch(e){return null;}
}
function tlmUpcomingTime(p){
  var d=tlmUpcomingKickoff(p);
  return d?d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
}
function tlmUpcomingDayKey(p){
  var d=tlmUpcomingKickoff(p);
  if(!d)return '9999-99-99';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function tlmUpcomingDayLabel(p){
  var d=tlmUpcomingKickoff(p);if(!d)return 'DATE À CONFIRMER';
  var n=new Date(),today=new Date(n.getFullYear(),n.getMonth(),n.getDate()),matchDay=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  var diff=Math.round((matchDay-today)/86400000);
  if(diff===0)return 'AUJOURD’HUI — '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  if(diff===1)return 'DEMAIN — '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
}
function tlmUpcomingLogo(src,name){
  return '<span class="tlm-up-logo">'+logo(src,name)+'</span>';
}
function tlmUpcomingRow(p){
  var cl=tlmUpcomingCountryLeague(p),time=tlmUpcomingTime(p),flag=COUNTRY_FLAGS[cl.country]||'🌍';
  return '<div class="upcoming-item tlm-up-row">'
    +tlmUpcomingLogo(p.home_logo,p.home)
    +'<div class="tlm-up-main">'
      +'<div class="tlm-up-teams">'+esc(p.home)+' — '+esc(p.away)+'</div>'
      +'<div class="upcoming-comp">'+flag+' '+esc(cl.country)+' · 🏆 '+esc(cl.league)+'</div>'
    +'</div>'
    +(time?'<div class="tlm-up-time">'+esc(time)+'</div>':'')
    +tlmUpcomingLogo(p.away_logo,p.away)
    +'</div>';
}
function tlmRenderUpcomingChronological(list){
  var arr=(list||[]).filter(function(p){var d=tlmUpcomingKickoff(p);return !d||d.getTime()>Date.now();}).sort(function(a,b){
    var da=tlmUpcomingKickoff(a),db=tlmUpcomingKickoff(b);
    return (da?da.getTime():Number.MAX_SAFE_INTEGER)-(db?db.getTime():Number.MAX_SAFE_INTEGER);
  });
  var html='',lastDay='';
  arr.forEach(function(p){
    var day=tlmUpcomingDayKey(p);
    if(day!==lastDay){html+='<div class="tlm-up-day">📅 '+esc(tlmUpcomingDayLabel(p))+'</div>';lastDay=day;}
    html+=tlmUpcomingRow(p);
  });
  return html;
}
async function loadUpcoming(){
  var box=document.getElementById('upcoming-rows');
  var hl=document.getElementById('upcoming-highlight');
  if(!box)return;
  try{
    var r=await fetch('/api/upcoming-picks?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    var d=await r.json();
    var source=(d.fixtures&&d.fixtures.length)?d.fixtures:(d.picks||[]);
    var matches=source.filter(tlmMatchAllowed).filter(function(p){var kd=tlmUpcomingKickoff(p);return !kd||kd.getTime()>Date.now();});
    matches.sort(function(a,b){var da=tlmUpcomingKickoff(a),db=tlmUpcomingKickoff(b);return (da?da.getTime():Number.MAX_SAFE_INTEGER)-(db?db.getTime():Number.MAX_SAFE_INTEGER);});
    if(!matches.length){
      if(hl)hl.innerHTML='';
      box.innerHTML='<div class="empty-note">Aucun match à venir disponible pour le moment.</div>';
      return;
    }
    var first=matches[0],cl=tlmUpcomingCountryLeague(first),flag=COUNTRY_FLAGS[cl.country]||'🌍',time=tlmUpcomingTime(first),day=tlmUpcomingDayLabel(first);
    if(hl)hl.innerHTML='<div class="upcoming-highlight">'
      +'<div class="upcoming-highlight-badge">⏭ PROCHAIN MATCH</div>'
      +tlmUpcomingLogo(first.home_logo,first.home)
      +'<div><div class="upcoming-highlight-teams">'+esc(first.home)+' — '+esc(first.away)+'</div>'
      +'<div class="upcoming-highlight-sub">📅 '+esc(day)+' · '+flag+' '+esc(cl.country)+' · 🏆 '+esc(cl.league)+(time?' · '+esc(time):'')+'</div></div>'
      +tlmUpcomingLogo(first.away_logo,first.away)
      +'</div>';
    box.innerHTML=tlmRenderUpcomingChronological(matches.slice(1));
  }catch(e){
    box.innerHTML='<div class="empty-note">Les matchs à venir sont momentanément indisponibles.</div>';
  }
}
loadUpcoming();

'''
idx = idx[:start] + new_section + idx[end:]

# CSS unique, ajouté sans toucher aux autres styles.
css_id = "/* TLM-UPCOMING-CHRONO-20260829 */"
if css_id not in idx:
    css = r'''
/* TLM-UPCOMING-CHRONO-20260829 */
.tlm-up-day{margin:16px 0 8px;padding:9px 12px;border-radius:10px;background:rgba(62,201,232,.10);border:1px solid rgba(62,201,232,.28);font-size:13px;font-weight:900;color:#fff}
.tlm-up-row{display:flex;align-items:center;gap:10px}
.tlm-up-logo{width:36px;height:36px;min-width:36px;display:inline-grid;place-items:center;overflow:hidden;border-radius:9px;padding:3px;background:rgba(255,255,255,.07);font-size:9px;font-weight:900;color:#dfe7ff}
.tlm-up-logo img{width:100%;height:100%;object-fit:contain}
.tlm-up-main{flex:1;min-width:0}
.tlm-up-teams{font-size:14px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tlm-up-time{font-size:12px;font-weight:900;color:#7de8ff;background:rgba(62,201,232,.10);padding:5px 8px;border-radius:8px;white-space:nowrap}
@media(max-width:560px){.tlm-up-row{gap:7px}.tlm-up-logo{width:31px;height:31px;min-width:31px}.tlm-up-teams{font-size:12.5px}.tlm-up-time{font-size:11px;padding:4px 6px}}
'''
    pos=idx.rfind("</style>")
    if pos<0: raise SystemExit("BLOQUE_CSS: </style> introuvable")
    idx=idx[:pos]+css+"\n"+idx[pos:]

# Forcer une nouvelle version du service worker sans toucher au reste.
idx=idx.replace("tlm-app-v8-proof-and-upcoming-20260828","tlm-app-v11-upcoming-chrono-20260829")
idx=idx.replace("tlm-app-v9-upcoming-groups-20260829","tlm-app-v11-upcoming-chrono-20260829")
idx=idx.replace("tlm-app-v10-homepage-upcoming-20260829","tlm-app-v11-upcoming-chrono-20260829")

INDEX.write_text(idx,encoding="utf-8")

# Vérifications de sécurité : le bloc historique doit toujours être présent.
check=INDEX.read_text(encoding="utf-8")
required=["DERNIERS VERDICTS DU CONCILE","tlmRenderUpcomingChronological","PROCHAIN MATCH","tlm-up-logo"]
for token in required:
    if token not in check: raise SystemExit("BLOQUE_VALIDATION: "+token)

print("FIX=OK")
print("BACKUP="+str(BACKUP))
print("ORDRE=PROCHAIN_A_PLUS_LOINTAIN")
print("DATE=OUI")
print("HEURE=OUI")
print("PAYS=OUI")
print("CHAMPIONNAT=OUI")
print("LOGOS_CLUBS=OUI")
print("HISTORIQUE=NON_MODIFIE")
print("TELEGRAM=NON_MODIFIE")
