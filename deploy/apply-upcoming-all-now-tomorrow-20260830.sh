#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-upcoming-$STAMP"

mkdir -p "$BACKUP"
cp -a public/index.html "$BACKUP/index.html"
cp -a scripts/api_server.js "$BACKUP/api_server.js"

rollback() {
  echo "ERREUR — restauration automatique des fichiers précédents"
  cp -a "$BACKUP/index.html" public/index.html || true
  cp -a "$BACKUP/api_server.js" scripts/api_server.js || true
  docker compose up -d --build api >/dev/null 2>&1 || true
  echo "Restauration terminée : $BACKUP"
}
trap rollback ERR

echo "[1/6] Correction ciblée des fichiers"
python3 <<'PY'
from pathlib import Path

api_path = Path('scripts/api_server.js')
home_path = Path('public/index.html')
api = api_path.read_text(encoding='utf-8')
home = home_path.read_text(encoding='utf-8')

def replace_once(text, old, new, label):
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ANCRE INVALIDE [{label}] : {count} occurrence(s), aucune modification écrite")
    return text.replace(old, new, 1)

# 1) Utiliser le jour civil Europe/Paris, pas UTC. A 00:33 en France le serveur
# pouvait encore demander les rencontres de la veille.
helper = '''function tlmParisDateKey(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(ms));
  const get = (type) => parts.find(p => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

'''
anchor = '// ── Matchs à venir (pré-match) — demande de Greg le 31/07/2026 ───────────────\n'
if 'function tlmParisDateKey(' not in api:
    if anchor not in api:
        raise SystemExit('ANCRE INVALIDE [paris-helper]')
    api = api.replace(anchor, helper + anchor, 1)

api = replace_once(
    api,
    'const todayStr = new Date().toISOString().slice(0, 10);',
    'const todayStr = tlmParisDateKey();',
    'prematch-date-paris'
)
api = replace_once(
    api,
    '    const now = new Date();\n    const today = now.toISOString().slice(0, 10);\n    const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);',
    '    const now = new Date();\n    const today = tlmParisDateKey(now.getTime());\n    const tomorrow = tlmParisDateKey(now.getTime() + 86400000);',
    'upcoming-date-paris'
)

# 2) football-data doit aussi regarder demain et distinguer SCHEDULED de LIVE.
api = replace_once(
    api,
    '    const today = new Date().toISOString().slice(0, 10);\n    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);',
    '    const today = tlmParisDateKey();\n    const tomorrow = tlmParisDateKey(Date.now() + 86400000);\n    const yesterday = tlmParisDateKey(Date.now() - 86400000);',
    'football-data-date-paris'
)
api = replace_once(
    api,
    'httpGet(`https://api.football-data.org/v4/matches?status=SCHEDULED,TIMED&dateFrom=${today}&dateTo=${today}`, { "X-Auth-Token": FOOTBALL_DATA_KEY })',
    'httpGet(`https://api.football-data.org/v4/matches?status=SCHEDULED,TIMED&dateFrom=${today}&dateTo=${tomorrow}`, { "X-Auth-Token": FOOTBALL_DATA_KEY })',
    'football-data-tomorrow'
)
api = replace_once(
    api,
    '    status: m.status === "FINISHED" ? "FINISHED" : "IN_PLAY",',
    '    status: m.status === "FINISHED" ? "FINISHED" : (["SCHEDULED","TIMED"].includes(m.status) ? "SCHEDULED" : "IN_PLAY"),',
    'football-data-status'
)

# 3) Source dédiée au PROGRAMME PUBLIC : elle ne dépend pas du seuil de confiance
# et possède un fallback football-data si API-Sports est temporairement bloquée.
public_fn = r'''let _publicUpcomingFixturesCache = { ts: 0, data: [] };
async function fetchPublicUpcomingFixtures() {
  if (_publicUpcomingFixturesCache.data.length && Date.now() - _publicUpcomingFixturesCache.ts < 5 * 60000) {
    return _publicUpcomingFixturesCache.data.filter(x => new Date(x.kickoff).getTime() > Date.now());
  }
  const today = tlmParisDateKey();
  const tomorrow = tlmParisDateKey(Date.now() + 86400000);
  const rows = [];
  const seen = new Set();
  const push = (x) => {
    if (!x || !x.home || !x.away || !x.kickoff) return;
    const t = new Date(x.kickoff).getTime();
    if (!Number.isFinite(t) || t <= Date.now()) return;
    const key = `${String(x.home).toLowerCase()}|${String(x.away).toLowerCase()}|${Math.floor(t/1800000)}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(x);
  };

  if (API_SPORTS_KEY) {
    try {
      const [a, b] = await Promise.all([
        httpGet(`https://v3.football.api-sports.io/fixtures?date=${today}&status=NS`, { "x-apisports-key": API_SPORTS_KEY }),
        httpGet(`https://v3.football.api-sports.io/fixtures?date=${tomorrow}&status=NS`, { "x-apisports-key": API_SPORTS_KEY }),
      ]);
      for (const f of [...(a.response || []), ...(b.response || [])]) {
        push({
          id: `as-${f.fixture?.id || ""}`,
          home: f.teams?.home?.name || "",
          away: f.teams?.away?.name || "",
          competition: f.league?.name || "Football",
          country: f.league?.country || "",
          country_flag: f.league?.flag || null,
          sport: "Football",
          kickoff: f.fixture?.date || null,
          home_logo: f.teams?.home?.logo || null,
          away_logo: f.teams?.away?.logo || null,
          source: "api-sports"
        });
      }
    } catch (e) {
      console.warn("[upcoming-public] API-Sports indisponible:", e.message);
    }
  }

  if (FOOTBALL_DATA_KEY) {
    try {
      const fd = await httpGet(
        `https://api.football-data.org/v4/matches?status=SCHEDULED,TIMED&dateFrom=${today}&dateTo=${tomorrow}`,
        { "X-Auth-Token": FOOTBALL_DATA_KEY }
      );
      for (const m of (fd.matches || [])) {
        push({
          id: `fd-${m.id}`,
          home: m.homeTeam?.name || m.homeTeam?.shortName || "",
          away: m.awayTeam?.name || m.awayTeam?.shortName || "",
          competition: m.competition?.name || "Football",
          country: m.area?.name || "",
          country_flag: m.area?.flag || null,
          sport: "Football",
          kickoff: m.utcDate || null,
          home_logo: m.homeTeam?.crest || null,
          away_logo: m.awayTeam?.crest || null,
          source: "football-data"
        });
      }
    } catch (e) {
      console.warn("[upcoming-public] football-data indisponible:", e.message);
    }
  }

  rows.sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff));
  _publicUpcomingFixturesCache = { ts: Date.now(), data: rows };
  console.log(`[upcoming-public] ${rows.length} matchs programmés (${today} -> ${tomorrow})`);
  return rows;
}

'''
route_anchor = 'app.get("/upcoming-picks", async (req, res) => {\n'
if 'async function fetchPublicUpcomingFixtures()' not in api:
    if route_anchor not in api:
        raise SystemExit('ANCRE INVALIDE [upcoming-public-route]')
    api = api.replace(route_anchor, public_fn + route_anchor, 1)

api = replace_once(
    api,
    '    const result = await computeUpcomingPicks();',
    '    const [result, publicFixtures] = await Promise.all([computeUpcomingPicks(), fetchPublicUpcomingFixtures()]);',
    'upcoming-public-call'
)
api = replace_once(
    api,
    '    res.json({\n      ok: true,\n      picks: stillUpcoming.map(p => ({',
    '    res.json({\n      ok: true,\n      fixtures: publicFixtures,\n      picks: stillUpcoming.map(p => ({',
    'upcoming-public-response'
)

# 4) Accueil : afficher le programme complet avant les éventuels picks.
home = replace_once(
    home,
    '<span data-i18n="live_upcoming">Matchs à venir — prochaines 24h</span>',
    '<span data-i18n="live_upcoming">Matchs à venir — maintenant jusqu’à demain</span>',
    'home-title'
)

program_block = r'''    var program=(d.fixtures||[]).filter(tlmMatchAllowed).filter(function(f){
      var kd=new Date(f.kickoff);
      return !isNaN(kd.getTime()) && kd.getTime()>Date.now();
    }).sort(function(a,b){ return new Date(a.kickoff)-new Date(b.kickoff); });
    if(program.length){
      hl.innerHTML='';
      box.innerHTML=program.map(function(f){
        var country=String(f.country||splitComp(f.competition||'').country||'').trim();
        var flagText=COUNTRY_FLAGS[country]||'';
        var flagHtml=f.country_flag
          ? '<img src="'+esc(f.country_flag)+'" alt="'+esc(country)+'" loading="lazy" style="width:24px;height:17px;object-fit:cover;border-radius:3px;display:inline-block;vertical-align:-3px;margin-right:5px" onerror="this.style.display=\'none\'">'
          : (flagText?'<span style="margin-right:5px">'+flagText+'</span>':'<span style="margin-right:5px">🌍</span>');
        var ico=SPORT_ICO[f.sport]||'⚽';
        var when='';
        try{
          var kd=new Date(f.kickoff);
          when=kd.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit'})+' · '+kd.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
        }catch(e){}
        return '<div class="upcoming-item">'+
          '<div class="upcoming-highlight-logo">'+logo(f.home_logo,f.home)+'</div>'+
          '<div class="upcoming-info">'+
            '<div class="upcoming-teams">'+ico+' '+flagHtml+esc(f.home)+' — '+esc(f.away)+'</div>'+
            '<div class="upcoming-comp">'+esc(country||'International')+' · '+esc(f.competition||'Football')+(when?' · '+esc(when):'')+'</div>'+
          '</div>'+
          '<div class="upcoming-highlight-logo">'+logo(f.away_logo,f.away)+'</div>'+
        '</div>';
      }).join('');
      return;
    }
'''
insert_anchor = "    tlmFeaturedMatch=(d.featuredMatch&&tlmMatchAllowed(d.featuredMatch))?d.featuredMatch:null;\n    var allPicks=(d.picks||[]).filter(tlmMatchAllowed);"
if 'var program=(d.fixtures||[])' not in home:
    if insert_anchor not in home:
        raise SystemExit('ANCRE INVALIDE [home-program]')
    home = home.replace(
        insert_anchor,
        "    tlmFeaturedMatch=(d.featuredMatch&&tlmMatchAllowed(d.featuredMatch))?d.featuredMatch:null;\n" + program_block + "    var allPicks=(d.picks||[]).filter(tlmMatchAllowed);",
        1
    )

# On écrit seulement après validation de TOUTES les ancres.
api_path.write_text(api, encoding='utf-8')
home_path.write_text(home, encoding='utf-8')
print('Patch ciblé appliqué')
PY

echo "[2/6] Vérification syntaxe API"
node --check scripts/api_server.js

echo "[3/6] Vérification des marqueurs"
grep -q 'fetchPublicUpcomingFixtures' scripts/api_server.js
grep -q 'maintenant jusqu’à demain' public/index.html
grep -q 'var program=(d.fixtures||\[\])' public/index.html

echo "[4/6] Reconstruction API uniquement"
docker compose up -d --build api

echo "[5/6] Contrôle API"
sleep 3
curl -fsS http://127.0.0.1:3001/upcoming-picks | python3 -c 'import json,sys; d=json.load(sys.stdin); print("API OK —", len(d.get("fixtures",[])), "matchs programmés ;", len(d.get("picks",[])), "picks IA")'

echo "[6/6] Contrôle site"
curl -fsS https://www.touslesmatchs.com/ | grep -q 'maintenant jusqu’à demain'

trap - ERR
echo "TERMINÉ — sauvegarde : $BACKUP"
