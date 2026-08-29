#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess, shutil

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "public" / "index.html"
API = ROOT / "scripts" / "api_server.js"
BASE = "1df672659936258d2d7e7424a479c8f48692acb7"
BACKUP = Path("/opt/backups") / f"tlm-home-restore-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
BACKUP.mkdir(parents=True, exist_ok=True)
shutil.copy2(INDEX, BACKUP / "index.before.html")
shutil.copy2(API, BACKUP / "api.before.js")

# 1) Revenir EXACTEMENT à l'accueil stable d'avant le hotfix du 29/08.
idx = subprocess.check_output(["git", "show", f"{BASE}:public/index.html"], cwd=ROOT, text=True)

# 2) Forcer un nouveau cache navigateur.
idx = idx.replace("tlm-app-v8-proof-and-upcoming-20260828", "tlm-app-v10-homepage-upcoming-20260829")

# 3) Ajouter uniquement la présentation demandée : fanions/logos, horaires, pays, championnat.
css_anchor = ".upcoming-lock-btn{font-size:11.5px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--indigo),var(--violet));padding:6px 12px;border-radius:8px;border:none;cursor:pointer;white-space:nowrap}"
css_extra = r'''
.upcoming-day-group{margin:18px 0 9px;padding:9px 12px;border-radius:10px;background:rgba(62,201,232,.10);border:1px solid rgba(62,201,232,.28);font-size:13px;font-weight:900;color:#fff}
.upcoming-country-group{display:flex;align-items:center;gap:8px;margin:12px 0 6px;padding:5px 8px;font-size:13px;font-weight:900;color:#dfe7ff}
.upcoming-league-group{display:flex;align-items:center;gap:7px;margin:6px 0;padding:5px 8px;border-left:3px solid var(--cyan);font-size:11.5px;font-weight:850;color:var(--muted)}
.upcoming-row-logo{width:36px;height:36px;min-width:36px;display:inline-grid;place-items:center;overflow:hidden;border-radius:9px;padding:3px;background:rgba(255,255,255,.07);font-size:9px;font-weight:900;color:#dfe7ff}
.upcoming-row-logo img{width:100%;height:100%;object-fit:contain}
.upcoming-time-badge{font-size:12px;font-weight:850;color:#7de8ff;background:rgba(62,201,232,.10);padding:5px 8px;border-radius:8px;white-space:nowrap}
.upcoming-row-center{flex:1;min-width:0}
.upcoming-row-teams{font-size:14px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:560px){.upcoming-item{padding:11px 10px;gap:8px}.upcoming-row-logo{width:32px;height:32px;min-width:32px}.upcoming-row-teams{font-size:12.5px}.upcoming-time-badge{font-size:11px;padding:4px 6px}}
'''
if css_anchor not in idx:
    raise SystemExit("BLOQUE: ancre CSS accueil introuvable")
idx = idx.replace(css_anchor, css_anchor + css_extra, 1)

start = idx.find("function renderUpcomingItem(p){")
end = idx.find("function upcomingTeamLogo", start)
if start < 0 or end < 0:
    raise SystemExit("BLOQUE: renderer matchs à venir introuvable")
new_renderer = r'''function upcomingCountryLeague(p){
  var comp=splitComp(p.competition||'');
  return {country:comp.country||p.country||'International',league:comp.league||p.competition||'Championnat'};
}
function upcomingTime(p){try{var d=new Date(p.kickoff);return isNaN(d.getTime())?'':d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}catch(e){return '';}}
function renderUpcomingItem(p){
  var cl=upcomingCountryLeague(p),kt=upcomingTime(p),flag=COUNTRY_FLAGS[cl.country]||'🌍';
  return '<div class="upcoming-item">'
    +'<span class="upcoming-row-logo">'+logo(p.home_logo,p.home)+'</span>'
    +'<div class="upcoming-row-center">'
      +'<div class="upcoming-row-teams">'+esc(p.home)+' — '+esc(p.away)+'</div>'
      +'<div class="upcoming-comp">'+flag+' '+esc(cl.country)+' · 🏆 '+esc(cl.league)+'</div>'
    +'</div>'
    +(kt?'<span class="upcoming-time-badge">'+esc(kt)+'</span>':'')
    +'<span class="upcoming-row-logo">'+logo(p.away_logo,p.away)+'</span>'
    +'</div>';
}
function upcomingDayKey(p){try{var d=new Date(p.kickoff);return isNaN(d.getTime())?'':d.toLocaleDateString('fr-CA');}catch(e){return '';}}
function upcomingDayLabel(p){try{var d=new Date(p.kickoff),n=new Date(),a=new Date(n.getFullYear(),n.getMonth(),n.getDate()),b=new Date(d.getFullYear(),d.getMonth(),d.getDate()),diff=Math.round((b-a)/86400000);if(diff===0)return 'AUJOURD’HUI · '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});if(diff===1)return 'DEMAIN · '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();}catch(e){return 'À VENIR';}}
function renderUpcomingGrouped(list){
  var arr=(list||[]).slice().sort(function(a,b){
    var da=new Date(a.kickoff),db=new Date(b.kickoff),daya=upcomingDayKey(a),dayb=upcomingDayKey(b);
    if(daya!==dayb)return da-db;
    var ca=upcomingCountryLeague(a),cb=upcomingCountryLeague(b);
    var c=ca.country.localeCompare(cb.country,'fr',{sensitivity:'base'});if(c)return c;
    var l=ca.league.localeCompare(cb.league,'fr',{sensitivity:'base'});if(l)return l;
    return da-db;
  });
  var html='',lastDay='',lastCountry='',lastLeague='';
  arr.forEach(function(p){var cl=upcomingCountryLeague(p),day=upcomingDayKey(p),flag=COUNTRY_FLAGS[cl.country]||'🌍';
    if(day!==lastDay){html+='<div class="upcoming-day-group">'+esc(upcomingDayLabel(p))+'</div>';lastDay=day;lastCountry='';lastLeague='';}
    if(cl.country!==lastCountry){html+='<div class="upcoming-country-group"><span>'+flag+'</span><span>'+esc(cl.country)+'</span></div>';lastCountry=cl.country;lastLeague='';}
    if(cl.league!==lastLeague){html+='<div class="upcoming-league-group"><span>🏆</span><span>'+esc(cl.league)+'</span></div>';lastLeague=cl.league;}
    html+=renderUpcomingItem(p);
  });
  return html;
}
'''
idx = idx[:start] + new_renderer + idx[end:]

# 4) Utiliser les fixtures complètes si elles existent ; sinon conserver les picks.
old_source = "var allPicks=(d.picks||[]).filter(tlmMatchAllowed);"
new_source = "var sourceUpcoming=(d.fixtures&&d.fixtures.length)?d.fixtures:(d.picks||[]); var allPicks=sourceUpcoming.filter(tlmMatchAllowed);"
if old_source not in idx:
    raise SystemExit("BLOQUE: source matchs à venir introuvable")
idx = idx.replace(old_source, new_source, 1)

# 5) Conserver le panneau et afficher le prochain match en tête, puis TOUS les autres groupés.
block_start = idx.find("    // Le meilleur pick (confiance la plus haute, verrouille ou non) mis en")
block_end_marker = "    box.innerHTML=rest.map(renderUpcomingItem).join('');"
block_end = idx.find(block_end_marker, block_start)
if block_start < 0 or block_end < 0:
    raise SystemExit("BLOQUE: bloc ancien sélection introuvable")
block_end += len(block_end_marker)
new_block = r'''    var sorted=picks.slice().sort(function(a,b){return new Date(a.kickoff)-new Date(b.kickoff);});
    var top=sorted[0],rest=sorted.slice(1),cl0=upcomingCountryLeague(top),flag0=COUNTRY_FLAGS[cl0.country]||'🌍',kt0=upcomingTime(top);
    hl.innerHTML='<div class="upcoming-highlight">'
      +'<div class="upcoming-highlight-badge">PROCHAIN MATCH</div>'
      +upcomingTeamLogo(top.home_logo,top.home)
      +'<div><div class="upcoming-highlight-teams">'+esc(top.home)+' — '+esc(top.away)+'</div>'
      +'<div class="upcoming-highlight-sub">'+flag0+' '+esc(cl0.country)+' · 🏆 '+esc(cl0.league)+(kt0?' · '+esc(kt0):'')+'</div></div>'
      +upcomingTeamLogo(top.away_logo,top.away)+'</div>';
    box.innerHTML=renderUpcomingGrouped(rest);'''
idx = idx[:block_start] + new_block + idx[block_end:]

for token in ("renderUpcomingGrouped", "upcoming-row-logo", "sourceUpcoming", "PROCHAIN MATCH"):
    if token not in idx: raise SystemExit("BLOQUE validation accueil: "+token)
INDEX.write_text(idx, encoding="utf-8")

# 6) Backend : exposer seulement les fixtures fiables déjà calculées. AUCUNE logique Telegram/Hermes modifiée.
api = API.read_text(encoding="utf-8")
old_cache = "_upcomingPicksCache = { ts: Date.now(), data: top, featuredMatch, stats };"
new_cache = "_upcomingPicksCache = { ts: Date.now(), data: top, fixtures: trustedFixtures.slice().sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff)).slice(0,60), featuredMatch, stats };"
if old_cache in api:
    api = api.replace(old_cache, new_cache, 1)
marker = "      featuredMatch: featured ? {"
fixtures_block = '''      fixtures: (result.fixtures || []).filter(p => new Date(p.kickoff).getTime() > Date.now()).map(p => ({\n        home: p.home, away: p.away, competition: p.competition, country: p.country,\n        sport: p.sport || "Football", kickoff: p.kickoff,\n        home_logo: p.home_logo || null, away_logo: p.away_logo || null,\n        status: p.status || "scheduled",\n      })),\n'''
if "fixtures: (result.fixtures || [])" not in api:
    if marker not in api: raise SystemExit("BLOQUE: ancre API upcoming introuvable")
    api = api.replace(marker, fixtures_block + marker, 1)
API.write_text(api, encoding="utf-8")
subprocess.check_call(["node", "--check", str(API)])

print("REPARATION=OK")
print("ACCUEIL=RESTAURE_PUIS_CORRIGE")
print("MATCHS_A_VENIR=OUI")
print("HORAIRES=OUI")
print("PAYS_ET_CHAMPIONNATS=OUI")
print("FANIONS_EQUIPES=OUI")
print("BACKUP="+str(BACKUP))
