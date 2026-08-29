#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "scripts" / "api_server.js"
INDEX = ROOT / "public" / "index.html"
BACKUP = Path("/opt/backups") / f"tlm-hotfix-20260829-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
BACKUP.mkdir(parents=True, exist_ok=True)

for f in (API, INDEX):
    shutil.copy2(f, BACKUP / f.name)


def must_replace(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    n = text.count(old)
    if n < count:
        raise SystemExit(f"BLOQUE {label}: motif introuvable")
    return text.replace(old, new, count)

# -----------------------------------------------------------------------------
# 1) TELEGRAM / CONCILE : la regle commerciale est 4 votes concordants sur 5.
#    Une IA muette ne doit pas transformer 4 bulletins valides en blocage total.
# -----------------------------------------------------------------------------
api = API.read_text(encoding="utf-8")
api = api.replace(
    "const fiveOu25SeatsPresent = Number(voteInfo.vote_active || 0) === 5;",
    "const enoughOu25SeatsPresent = Number(voteInfo.vote_active || 0) >= CLIENT_OU25_MIN_VOTES;",
)
api = api.replace(
    "if (!fiveOu25SeatsPresent) return `sieges O/U 2,5 incomplets: ${Number(voteInfo.vote_active || 0)}/5`;",
    "if (!enoughOu25SeatsPresent) return `sieges O/U 2,5 insuffisants: ${Number(voteInfo.vote_active || 0)}/5 (<4)`;",
)
api = api.replace(
    "&& clientOu25MatchEligible && ou25Only && fiveOu25SeatsPresent",
    "&& clientOu25MatchEligible && ou25Only && enoughOu25SeatsPresent",
)
if "fiveOu25SeatsPresent" in api:
    raise SystemExit("BLOQUE TELEGRAM: ancienne barriere 5/5 encore presente")
if "enoughOu25SeatsPresent" not in api:
    raise SystemExit("BLOQUE TELEGRAM: nouvelle barriere 4/5 absente")

# -----------------------------------------------------------------------------
# 2) API MATCHS A VENIR : exposer les fixtures fiables avec logos/pays, sans
#    forcer l'accueil a n'afficher que les anciens picks H2H multi-marches.
# -----------------------------------------------------------------------------
old_cache = "_upcomingPicksCache = { ts: Date.now(), data: top, featuredMatch, stats };"
new_cache = "_upcomingPicksCache = { ts: Date.now(), data: top, fixtures: trustedFixtures.slice().sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff)).slice(0,60), featuredMatch, stats };"
api = must_replace(api, old_cache, new_cache, "CACHE FIXTURES")

marker = "      featuredMatch: featured ? {"
fixtures_block = """      fixtures: (result.fixtures || []).filter(p => new Date(p.kickoff).getTime() > Date.now()).map(p => ({
        home: p.home, away: p.away, competition: p.competition, country: p.country,
        sport: p.sport || \"Football\", kickoff: p.kickoff,
        home_logo: p.home_logo || null, away_logo: p.away_logo || null,
        status: p.status || \"scheduled\",
      })),
"""
if fixtures_block not in api:
    api = must_replace(api, marker, fixtures_block + marker, "REPONSE FIXTURES")

API.write_text(api, encoding="utf-8")

# -----------------------------------------------------------------------------
# 3) ACCUEIL : vraies lignes de matchs, logos, date, pays, championnat.
# -----------------------------------------------------------------------------
idx = INDEX.read_text(encoding="utf-8")

# Force une nouvelle version du SW pour eviter que l'ancien accueil reste cache.
idx = idx.replace(
    "tlm-app-v8-proof-and-upcoming-20260828",
    "tlm-app-v9-upcoming-groups-20260829",
)

# CSS groupes + logos.
css_marker = ".upcoming-lock-btn{font-size:11.5px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--indigo),var(--violet));padding:6px 12px;border-radius:8px;border:none;cursor:pointer;white-space:nowrap}"
css_extra = r'''
.upcoming-day-group{margin:20px 0 10px;padding:10px 14px;border-radius:11px;background:linear-gradient(135deg,rgba(79,214,242,.18),rgba(138,104,255,.14));border:1px solid rgba(79,214,242,.35);font-size:14px;font-weight:900;color:#fff}
.upcoming-country-group{display:flex;align-items:center;gap:8px;margin:14px 0 7px;padding:7px 10px;font-size:13px;font-weight:900;color:#dfe7ff}
.upcoming-country-group .flag{font-size:20px}
.upcoming-league-group{display:flex;align-items:center;gap:7px;margin:7px 0 7px;padding:5px 10px;border-left:3px solid var(--cyan);font-size:11.5px;font-weight:850;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.upcoming-row-logo{width:34px;height:34px;min-width:34px;display:inline-grid;place-items:center;overflow:hidden;border-radius:9px;padding:3px;background:rgba(255,255,255,.07);font-size:9px;font-weight:900;color:#dfe7ff}
.upcoming-row-logo img{width:100%;height:100%;object-fit:contain}
.upcoming-teamline{display:flex;align-items:center;gap:9px;min-width:0}
.upcoming-teamline .upcoming-teams{flex:1;min-width:0}
.upcoming-time-badge{font-size:12px;font-weight:850;color:#7de8ff;background:rgba(62,201,232,.10);padding:5px 9px;border-radius:8px;white-space:nowrap}
'''
if ".upcoming-day-group{" not in idx:
    idx = must_replace(idx, css_marker, css_marker + css_extra, "CSS ACCUEIL")

# Remplace le renderer des lignes.
start = idx.find("function renderUpcomingItem(p){")
end = idx.find("function upcomingTeamLogo", start)
if start == -1 or end == -1:
    raise SystemExit("BLOQUE ACCUEIL: renderUpcomingItem introuvable")
new_renderer = r'''function renderUpcomingItem(p){
  var comp=splitComp(p.competition||'');
  var kt='';
  try{var kd=new Date(p.kickoff);if(!isNaN(kd.getTime()))kt=kd.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}catch(e){}
  return '<div class="upcoming-item">'
    +'<span class="upcoming-row-logo">'+logo(p.home_logo,p.home)+'</span>'
    +'<div class="upcoming-info"><div class="upcoming-teamline"><div class="upcoming-teams">'+esc(p.home)+' — '+esc(p.away)+'</div>'
    +(kt?'<span class="upcoming-time-badge">'+esc(kt)+'</span>':'')+'</div>'
    +'<div class="upcoming-comp">'+esc(comp.league)+(comp.country?' · '+esc(comp.country):'')+'</div></div>'
    +'<span class="upcoming-row-logo">'+logo(p.away_logo,p.away)+'</span>'
    +'</div>';
}
function upcomingDayKey(p){try{var d=new Date(p.kickoff);if(isNaN(d.getTime()))return 'date-inconnue';return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}catch(e){return 'date-inconnue';}}
function upcomingDayLabel(p){try{var d=new Date(p.kickoff),n=new Date(),t=new Date(n.getFullYear(),n.getMonth(),n.getDate()),x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),diff=Math.round((x-t)/86400000);if(diff===0)return '📅 AUJOURD’HUI — '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});if(diff===1)return '📅 DEMAIN — '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});return '📅 '+d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();}catch(e){return '📅 DATE À CONFIRMER';}}
function renderUpcomingGrouped(list){
  var arr=(list||[]).slice().sort(function(a,b){return new Date(a.kickoff)-new Date(b.kickoff);});
  var html='',lastDay='',lastCountry='',lastLeague='';
  arr.forEach(function(p){
    var comp=splitComp(p.competition||''),day=upcomingDayKey(p),country=comp.country||p.country||'International',league=comp.league||'Championnat',flag=COUNTRY_FLAGS[country]||'🌍';
    if(day!==lastDay){html+='<div class="upcoming-day-group">'+upcomingDayLabel(p)+'</div>';lastDay=day;lastCountry='';lastLeague='';}
    if(country!==lastCountry){html+='<div class="upcoming-country-group"><span class="flag">'+flag+'</span><span>'+esc(country)+'</span></div>';lastCountry=country;lastLeague='';}
    if(league!==lastLeague){html+='<div class="upcoming-league-group"><span>🏆</span><span>'+esc(league)+'</span></div>';lastLeague=league;}
    html+=renderUpcomingItem(p);
  });
  return html;
}
'''
idx = idx[:start] + new_renderer + idx[end:]

# L'accueil doit afficher les fixtures fiables, pas les anciens picks H2H.
idx = must_replace(
    idx,
    "var allPicks=(d.picks||[]).filter(tlmMatchAllowed);",
    "var allPicks=(d.fixtures||d.picks||[]).filter(tlmMatchAllowed);",
    "SOURCE FIXTURES ACCUEIL",
)

# Remplace le bloc 'Notre selection' base sur l'ancien marche prematch par un
# simple prochain match + la liste groupee par jour/pays/championnat.
block_start = idx.find("    // Le meilleur pick (confiance la plus haute, verrouille ou non) mis en")
block_end_marker = "    box.innerHTML=rest.map(renderUpcomingItem).join('');"
block_end = idx.find(block_end_marker, block_start)
if block_start == -1 or block_end == -1:
    raise SystemExit("BLOQUE ACCUEIL: bloc ancien prochain pick introuvable")
block_end += len(block_end_marker)
new_block = r'''    // Affichage programme : prochain match en tete, puis classement lisible.
    var sorted=picks.slice().sort(function(a,b){return new Date(a.kickoff)-new Date(b.kickoff);});
    var top=sorted[0],rest=sorted.slice(1),comp0=splitComp(top.competition||''),flag0=COUNTRY_FLAGS[comp0.country]||'🌍',kt0='';
    try{var kd0=new Date(top.kickoff);if(!isNaN(kd0.getTime()))kt0=kd0.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+' · '+kd0.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}catch(e){}
    hl.innerHTML='<div class="upcoming-highlight">'
      +'<div class="upcoming-highlight-badge">⏭ PROCHAIN MATCH</div>'
      +upcomingTeamLogo(top.home_logo,top.home)
      +'<div><div class="upcoming-highlight-teams">'+flag0+' '+esc(top.home)+' — '+esc(top.away)+'</div>'
      +'<div class="upcoming-highlight-sub">🏆 '+esc(comp0.league)+(comp0.country?' · '+esc(comp0.country):'')+(kt0?' · '+esc(kt0):'')+'</div></div>'
      +upcomingTeamLogo(top.away_logo,top.away)+'</div>';
    box.innerHTML=renderUpcomingGrouped(rest);'''
idx = idx[:block_start] + new_block + idx[block_end:]

# Validation : aucun ancien marche ne doit etre genere par le renderer accueil.
for required in ("renderUpcomingGrouped", "upcoming-day-group", "d.fixtures||d.picks", "PROCHAIN MATCH"):
    if required not in idx:
        raise SystemExit("BLOQUE VALIDATION ACCUEIL: "+required)

INDEX.write_text(idx, encoding="utf-8")

print("HOTFIX=OK")
print("BACKUP="+str(BACKUP))
print("TELEGRAM_QUORUM=4_SUR_5")
print("ACCUEIL=DATE_PAYS_CHAMPIONNAT_LOGOS")
print("ANCIENS_MARCHES_PREMATCH=MASQUES_SUR_ACCUEIL")
