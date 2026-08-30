#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-football-scope-v3-$STAMP"
mkdir -p "$BACKUP"
cp -a scripts/api_server.js "$BACKUP/api_server.js"

INDEX_BEFORE="$(sha256sum public/index.html | awk '{print $1}')"
APP_BEFORE="$(sha256sum public/app.html | awk '{print $1}')"
LIVEIA_BEFORE="$(sha256sum public/live-ia.html | awk '{print $1}')"

rollback(){
  echo "ERREUR — restauration automatique de scripts/api_server.js"
  cp -a "$BACKUP/api_server.js" scripts/api_server.js
  docker compose up -d --no-deps --build api >/dev/null 2>&1 || true
}
trap rollback ERR

echo "[1/8] Etat avant correction"
echo "BRANCHE=$(git branch --show-current)"
echo "COMMIT=$(git rev-parse HEAD)"
echo "SHA_API_AVANT=$(sha256sum scripts/api_server.js | awk '{print $1}')"

echo "[2/8] Installation du périmètre football sur le code réel"
python3 - <<'PY'
from pathlib import Path
p=Path('scripts/api_server.js')
s=p.read_text(encoding='utf-8')
orig=s

if 'TLM-NFL-SOURCE-GUARD-20260830' not in s:
    raise SystemExit('Garde-fou NFL absent — arrêt sans modification')

marker='TLM-PUBLIC-FOOTBALL-SCOPE-V3-20260830'
if marker not in s:
    anchor='async function fetchFromFootballData() {'
    pos=s.find(anchor)
    if pos < 0:
        raise SystemExit('fetchFromFootballData introuvable')
    helper=r'''// TLM-PUBLIC-FOOTBALL-SCOPE-V3-20260830
// Périmètre client : football/soccer uniquement, compétitions reconnues.
// Les pays/ligues faibles sont éliminés avant les traitements coûteux.
const PUBLIC_FOOTBALL_BLOCKED_COUNTRIES = new Set([
  "usa", "us", "united states", "united states of america", "canada",
  "costa rica", "nicaragua", "ecuador", "chile", "paraguay",
  "afghanistan", "iraq", "algeria", "algerie", "tunisia", "tunisie",
  "morocco", "maroc", "kazakhstan", "azerbaijan", "uzbekistan"
]);

function tlmScopeNorm(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function tlmScopeCountry(match) {
  const direct = tlmScopeNorm(match?.country || match?.league?.country || match?.area?.name);
  if (direct) return direct;
  const comp = tlmScopeNorm([
    typeof match?.competition === "string" ? match.competition : match?.competition?.name,
    typeof match?.league === "string" ? match.league : match?.league?.name,
  ].filter(Boolean).join(" · "));
  const checks = [
    ["united states of america","usa"],["united states","usa"],["usa","usa"],["canada","canada"],
    ["costa rica","costa rica"],["costa-rica","costa rica"],["nicaragua","nicaragua"],
    ["ecuador","ecuador"],["chile","chile"],["paraguay","paraguay"],
    ["afghanistan","afghanistan"],["iraq","iraq"],["algeria","algeria"],["algerie","algerie"],
    ["tunisia","tunisia"],["tunisie","tunisie"],["morocco","morocco"],["maroc","maroc"],
    ["kazakhstan","kazakhstan"],["azerbaijan","azerbaijan"],["uzbekistan","uzbekistan"],
    ["mexico","mexico"],["brazil","brazil"],["brasil","brazil"]
  ];
  for (const [needle,value] of checks) if (comp.includes(needle)) return value;
  return "";
}

function isPublicFootballScopeMatch(match) {
  if (!match || isAmericanFootballMatch(match)) return false;
  const sport = tlmScopeNorm(match.sport || "Football");
  if (!(sport.includes("football") || sport.includes("soccer"))) return false;
  if (isWomenMatch(match) || isCategoryBanned(match) || isUsaOrCanadaMatch(match)) return false;

  const country = tlmScopeCountry(match);
  if (PUBLIC_FOOTBALL_BLOCKED_COUNTRIES.has(country)) return false;
  if (isLowTrustCompetition(match)) return false;

  const comp = tlmScopeNorm([
    typeof match?.competition === "string" ? match.competition : match?.competition?.name,
    typeof match?.league === "string" ? match.league : match?.league?.name,
    match?.country,
  ].filter(Boolean).join(" · "));

  // Mexique : Liga MX uniquement. Les divisions semi-pro restent hors périmètre.
  if (country === "mexico" && !/\bliga mx\b/.test(comp)) return false;

  // Par défaut seules les ligues déjà reconnues par le moteur passent.
  const tier = leagueTier(match);
  return tier === "trusted_major" || tier === "trusted_secondary";
}

'''
    s=s[:pos]+helper+s[pos:]

# Pays structuré : API-Sports football.
a=s.find('function normalizeApiSportsFootballFixture')
b=s.find('const CATEGORY_BAN_KEYWORDS',a)
block=s[a:b]
if 'country: f.league?.country || "",' not in block:
    needle='    utcDate: f.fixture.date,'
    if needle not in block: raise SystemExit('utcDate API-Sports introuvable')
    block=block.replace(needle,'    country: f.league?.country || "",\n'+needle,1)
    s=s[:a]+block+s[b:]

# Pays structuré : Football-Data.
a=s.find('function formatFDMatch')
b=s.find('function normalizeFootballDataMatch',a)
block=s[a:b]
if 'country: m.area?.name' not in block:
    needle='    utcDate: m.utcDate,'
    if needle not in block: raise SystemExit('utcDate Football-Data introuvable')
    block=block.replace(needle,'    country: m.area?.name || m.competition?.area?.name || "",\n'+needle,1)
    s=s[:a]+block+s[b:]

# Pays structuré : TheSportsDB.
a=s.find('function normalizeTheSportsDbLiveEvent')
b=s.find('async function fetchFromTheSportsDb',a)
block=s[a:b]
if 'country: event?.strCountry' not in block:
    needle='    utcDate: event?.dateEvent || event?.strTimestamp || new Date().toISOString(),'
    if needle not in block: raise SystemExit('utcDate TheSportsDB introuvable')
    block=block.replace(needle,'    country: event?.strCountry || event?.strLeagueCountry || "",\n'+needle,1)
    s=s[:a]+block+s[b:]

# TheSportsDB : filtrage dès la sortie de la source.
a=s.find('async function fetchFromTheSportsDb')
b=s.find('function sameLiveTeamName',a)
block=s[a:b]
needle='    .filter((event) => event && wanted.has(event.sport));'
replacement='    .filter((event) => event && wanted.has(event.sport))\n    .filter(isPublicFootballScopeMatch);'
if needle in block:
    block=block.replace(needle,replacement,1)
elif '.filter(isPublicFootballScopeMatch);' not in block:
    raise SystemExit('Sortie TheSportsDB incompatible')
s=s[:a]+block+s[b:]

# Enrichissement cache : ne jamais réinjecter un hors périmètre.
a=s.find('async function enrichFootballOnlyLiveCache')
b=s.find('async function fetchLiveMatches',a)
block=s[a:b]
needle='''    const enrichedMatches = mergeLiveMatchSources(cacheData, theSportsDbMatches)\n      .filter(m => !isFinishedOrUnavailableForLiveDisplay(m));'''
replacement='''    const enrichedMatches = mergeLiveMatchSources(cacheData, theSportsDbMatches)\n      .filter(isPublicFootballScopeMatch)\n      .filter(m => !isFinishedOrUnavailableForLiveDisplay(m));'''
if needle in block:
    block=block.replace(needle,replacement,1)
elif '.filter(isPublicFootballScopeMatch)' not in block:
    raise SystemExit('Enrichissement cache incompatible')
s=s[:a]+block+s[b:]

# fetchLiveMatches : cache chaud + sortie finale.
a=s.find('async function fetchLiveMatches()')
b=s.find('function getMockMatches',a)
block=s[a:b]
old='''    const cachedNoNfl = liveMatchesCache.data.filter((match) => !isAmericanFootballMatch(match));\n    if (cachedNoNfl.length !== liveMatchesCache.data.length) liveMatchesCache = { data: cachedNoNfl, ts: liveMatchesCache.ts };\n    return await enrichFootballOnlyLiveCache(cachedNoNfl);'''
new='''    const cachedNoNfl = liveMatchesCache.data.filter((match) => !isAmericanFootballMatch(match));\n    const cachedInScope = cachedNoNfl.filter(isPublicFootballScopeMatch);\n    if (cachedInScope.length !== liveMatchesCache.data.length) liveMatchesCache = { data: cachedInScope, ts: liveMatchesCache.ts };\n    return await enrichFootballOnlyLiveCache(cachedInScope);'''
if old in block:
    block=block.replace(old,new,1)
elif 'const cachedInScope = cachedNoNfl.filter(isPublicFootballScopeMatch);' not in block:
    raise SystemExit('Cache live incompatible')
old2='''  const visibleMatches = matches.filter(m => !isFinishedOrUnavailableForLiveDisplay(m));\n  liveMatchesCache = { data: visibleMatches, ts: Date.now() };\n  return visibleMatches;'''
new2='''  const productMatches = matches.filter(isPublicFootballScopeMatch);\n  const visibleMatches = productMatches.filter(m => !isFinishedOrUnavailableForLiveDisplay(m));\n  liveMatchesCache = { data: visibleMatches, ts: Date.now() };\n  return visibleMatches;'''
if old2 in block:
    block=block.replace(old2,new2,1)
elif 'const productMatches = matches.filter(isPublicFootballScopeMatch);' not in block:
    raise SystemExit('Sortie fetchLiveMatches incompatible')
s=s[:a]+block+s[b:]

# Auto-Concile : garde ultime avant toute analyse IA.
a=s.find('function shouldAutoObserveMatch(match) {')
b=s.find('function hasPredictionSnapshot',a)
block=s[a:b]
needle='''function shouldAutoObserveMatch(match) {\n  if (!match || match.scoreConflict) return false;'''
replacement='''function shouldAutoObserveMatch(match) {\n  if (!match || match.scoreConflict) return false;\n  if (!isPublicFootballScopeMatch(match)) return false;'''
if needle in block:
    block=block.replace(needle,replacement,1)
elif 'if (!isPublicFootballScopeMatch(match)) return false;' not in block:
    raise SystemExit('shouldAutoObserveMatch incompatible')
s=s[:a]+block+s[b:]

# Pré-match : filtrage AVANT H2H/cotes.
a=s.find('async function computeUpcomingPicks()')
b=s.find('app.get("/upcoming-picks"',a)
block=s[a:b]
needle='''      const compObj = {\n        competition: f.league?.name || "",\n        league: f.league?.name || "",\n        country: f.league?.country || "",\n        sport: "Football",\n        home: f.teams.home?.name || "",\n        away: f.teams.away?.name || "",\n      };'''
if needle not in block:
    raise SystemExit('compObj upcoming incompatible')
if 'if (!isPublicFootballScopeMatch(compObj)) continue;' not in block:
    block=block.replace(needle,needle+'\n      if (!isPublicFootballScopeMatch(compObj)) continue;',1)
s=s[:a]+block+s[b:]

# Homepage : le flux upcoming appelle directement API-Sports/Football-Data.
# Le filtre doit donc être dans push(), sinon ces matchs réapparaissent sur l'accueil.
a=s.find('// TLM-HOME-FIXTURES-20260830')
b=s.find('app.get("/upcoming-picks"',a)
block=s[a:b]
needle='''    const push=x=>{\n      if(!x||!x.home||!x.away||!x.kickoff) return;'''
replacement='''    const push=x=>{\n      if(!x||!x.home||!x.away||!x.kickoff) return;\n      if(!isPublicFootballScopeMatch(x)) return;'''
if needle in block:
    block=block.replace(needle,replacement,1)
elif 'if(!isPublicFootballScopeMatch(x)) return;' not in block:
    raise SystemExit('push homepage incompatible')
s=s[:a]+block+s[b:]

# /live-matches : un ancien signal épinglé hors scope ne doit pas être réinjecté.
a=s.find('app.get("/live-matches", async (req, res) => {')
if a < 0: raise SystemExit('route live-matches introuvable')
b=s.find('app.get(',a+20)
if b < 0: b=len(s)
block=s[a:b]
needle='''    for (const ps of pinned) {\n      const alreadyLive = matches.some(m =>'''
replacement='''    for (const ps of pinned) {\n      if (!isPublicFootballScopeMatch(ps)) continue;\n      const alreadyLive = matches.some(m =>'''
if needle in block:
    block=block.replace(needle,replacement,1)
elif 'if (!isPublicFootballScopeMatch(ps)) continue;' not in block:
    raise SystemExit('pinned live incompatible')
s=s[:a]+block+s[b:]

if s == orig:
    print('Déjà installé — aucun changement')
else:
    p.write_text(s,encoding='utf-8')
    print('OK — scope football V3 installé sur live, homepage et pré-match')
PY

echo "[3/8] Vérification syntaxique"
node --check scripts/api_server.js
grep -q 'TLM-PUBLIC-FOOTBALL-SCOPE-V3-20260830' scripts/api_server.js
grep -q 'cachedInScope' scripts/api_server.js
grep -q 'productMatches = matches.filter(isPublicFootballScopeMatch)' scripts/api_server.js
grep -q 'if(!isPublicFootballScopeMatch(x)) return;' scripts/api_server.js
grep -q 'if (!isPublicFootballScopeMatch(match)) return false;' scripts/api_server.js

echo "[4/8] Protection frontend"
[ "$INDEX_BEFORE" = "$(sha256sum public/index.html | awk '{print $1}')" ]
[ "$APP_BEFORE" = "$(sha256sum public/app.html | awk '{print $1}')" ]
[ "$LIVEIA_BEFORE" = "$(sha256sum public/live-ia.html | awk '{print $1}')" ]

echo "[5/8] Rebuild du SEUL service API"
docker compose up -d --no-deps --build api
for i in $(seq 1 35); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3001/health >/dev/null

echo "[6/8] Vérification réelle /live-matches"
curl -fsS 'http://127.0.0.1:3001/live-matches?force=1' > /tmp/tlm-scope-v3-live.json
python3 - <<'PY'
import json,re
D=json.load(open('/tmp/tlm-scope-v3-live.json'))
rows=D.get('matches') or D.get('live') or (D if isinstance(D,list) else [])
blocked=re.compile(r'\b(?:nfl|american football|usa|united states|canada|costa[ -]?rica|nicaragua|ecuador|chile|paraguay|afghanistan|iraq|algeria|tunisia|morocco|maroc|kazakhstan|azerbaijan|uzbekistan)\b',re.I)
women=re.compile(r'\bwomen\b|\bfemenil\b|\bfeminine\b|(?:\s|\()W\)?$',re.I)
bad=[]
for m in rows:
    text=' '.join(str(m.get(k) or '') for k in ('sport','competition','country','home','away'))
    if blocked.search(text) or women.search(text): bad.append((m.get('home'),m.get('away'),m.get('competition'),m.get('country')))
print('LIVE_MATCHS_RETOURNES=',len(rows))
print('LIVE_HORS_PERIMETRE=',len(bad))
for m in rows[:20]: print(' LIVE OK:',m.get('country') or '?','|',m.get('competition'),'|',m.get('home'),'—',m.get('away'))
if bad:
    print('LIVE_BLOQUES_ENCORE=',bad[:10])
    raise SystemExit('Match live hors périmètre encore présent')
PY

echo "[7/8] Vérification réelle /homepage-fixtures"
curl -fsS 'http://127.0.0.1:3001/homepage-fixtures' > /tmp/tlm-scope-v3-home.json
python3 - <<'PY'
import json,re
D=json.load(open('/tmp/tlm-scope-v3-home.json'))
rows=(D.get('live') or [])+(D.get('upcoming') or [])
blocked=re.compile(r'\b(?:nfl|american football|usa|united states|canada|costa[ -]?rica|nicaragua|ecuador|chile|paraguay|afghanistan|iraq|algeria|tunisia|morocco|maroc|kazakhstan|azerbaijan|uzbekistan)\b',re.I)
women=re.compile(r'\bwomen\b|\bfemenil\b|\bfeminine\b|(?:\s|\()W\)?$',re.I)
bad=[]
for m in rows:
    text=' '.join(str(m.get(k) or '') for k in ('sport','competition','country','home','away'))
    if blocked.search(text) or women.search(text): bad.append((m.get('home'),m.get('away'),m.get('competition'),m.get('country')))
print('HOME_LIVE=',len(D.get('live') or []),'HOME_UPCOMING=',len(D.get('upcoming') or []))
print('HOME_HORS_PERIMETRE=',len(bad))
if bad:
    print('HOME_BLOQUES_ENCORE=',bad[:10])
    raise SystemExit('Match homepage hors périmètre encore présent')
PY

echo "[8/8] Vérification site / app / Live IA"
curl -fsS https://www.touslesmatchs.com/ >/dev/null
curl -fsS https://www.touslesmatchs.com/app.html >/dev/null
curl -fsS https://www.touslesmatchs.com/live-ia >/dev/null

trap - ERR
echo "TERMINE — PERIMETRE FOOTBALL V3 ACTIF"
echo "SHA_API_APRES=$(sha256sum scripts/api_server.js | awk '{print $1}')"
echo "SAUVEGARDE=$BACKUP"
echo "Frontend / Telegram / Hermes / Stripe / Brevo / DB inchangés."
echo "Les appels globaux live restent nécessaires, mais les H2H/cotes/IA hors périmètre sont bloqués avant traitement coûteux."
