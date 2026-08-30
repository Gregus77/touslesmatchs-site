#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-football-scope-v2-$STAMP"
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

echo "[1/7] Etat avant correction"
echo "BRANCHE=$(git branch --show-current)"
echo "COMMIT=$(git rev-parse HEAD)"
echo "SHA_API_AVANT=$(sha256sum scripts/api_server.js | awk '{print $1}')"

echo "[2/7] Installation du périmètre football robuste"
python3 - <<'PY'
from pathlib import Path
import re
p=Path('scripts/api_server.js')
s=p.read_text(encoding='utf-8')
orig=s

if 'TLM-NFL-SOURCE-GUARD-20260830' not in s:
    raise SystemExit('Garde-fou NFL absent — arrêt sans modification')

marker='TLM-PUBLIC-FOOTBALL-SCOPE-V2-20260830'
if marker not in s:
    anchor='async function fetchFromFootballData() {'
    pos=s.find(anchor)
    if pos < 0:
        raise SystemExit('fetchFromFootballData introuvable')
    helper=r'''// TLM-PUBLIC-FOOTBALL-SCOPE-V2-20260830
// Produit public TousLesMatchs : football/soccer uniquement, ligues reconnues.
// Les ligues/pays hors périmètre sont éliminés avant H2H, cotes et analyses IA.
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
  const aliases = {
    "united states":"usa", "united states of america":"usa",
    "costa-rica":"costa rica", "algeria":"algeria", "algerie":"algerie",
    "tunisia":"tunisia", "tunisie":"tunisie", "morocco":"morocco", "maroc":"maroc"
  };
  for (const raw of PUBLIC_FOOTBALL_BLOCKED_COUNTRIES) {
    const c=tlmScopeNorm(raw);
    const esc=c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\\ /g,"[ -]?");
    if (c.length >= 4 && new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`).test(comp)) return aliases[c] || c;
  }
  if (/\bmexico\b/.test(comp)) return "mexico";
  if (/\bbrazil\b|\bbrasil\b/.test(comp)) return "brazil";
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

  // Mexique : Liga MX uniquement. Les divisions semi-pro ne sont pas le produit.
  if (country === "mexico" && !/\bliga mx\b/.test(comp)) return false;

  // Refus par défaut : une ligue inconnue/non classée ne consomme pas d'IA.
  const tier = leagueTier(match);
  return tier === "trusted_major" || tier === "trusted_secondary";
}

'''
    s=s[:pos]+helper+s[pos:]

# Ajouter le pays structure aux trois normalisations quand il n'existe pas deja.
api_start=s.find('function normalizeApiSportsFootballFixture')
api_end=s.find('const CATEGORY_BAN_KEYWORDS',api_start)
api_block=s[api_start:api_end]
if 'country: f.league?.country || "",' not in api_block:
    old='    utcDate: f.fixture.date,'
    if old not in api_block: raise SystemExit('utcDate API-Sports introuvable')
    api_block=api_block.replace(old,'    country: f.league?.country || "",\n'+old,1)
    s=s[:api_start]+api_block+s[api_end:]

fd_start=s.find('function formatFDMatch')
fd_end=s.find('function normalizeFootballDataMatch',fd_start)
fd_block=s[fd_start:fd_end]
if 'country: m.area?.name' not in fd_block:
    old='    utcDate: m.utcDate,'
    if old not in fd_block: raise SystemExit('utcDate Football-Data introuvable')
    fd_block=fd_block.replace(old,'    country: m.area?.name || m.competition?.area?.name || "",\n'+old,1)
    s=s[:fd_start]+fd_block+s[fd_end:]

ts_start=s.find('function normalizeTheSportsDbLiveEvent')
ts_end=s.find('async function fetchFromTheSportsDb',ts_start)
ts_block=s[ts_start:ts_end]
if 'country: event?.strCountry' not in ts_block:
    old='    utcDate: event?.dateEvent || event?.strTimestamp || new Date().toISOString(),'
    if old not in ts_block: raise SystemExit('utcDate TheSportsDB introuvable')
    ts_block=ts_block.replace(old,'    country: event?.strCountry || event?.strLeagueCountry || "",\n'+old,1)
    s=s[:ts_start]+ts_block+s[ts_end:]

# TheSportsDB : filtrer a sa sortie. Ainsi l'enrichissement du cache ne peut
# plus reinjecter USA/feminin/ligue faible, quelle que soit sa mise en forme.
fetch_ts_start=s.find('async function fetchFromTheSportsDb')
fetch_ts_end=s.find('function sameLiveTeamName',fetch_ts_start)
if fetch_ts_start < 0 or fetch_ts_end < 0: raise SystemExit('fetchFromTheSportsDb introuvable')
block=s[fetch_ts_start:fetch_ts_end]
needle='.filter((event) => event && wanted.has(event.sport));'
replacement='.filter((event) => event && wanted.has(event.sport))\n    .filter(isPublicFootballScopeMatch);'
if needle in block:
    block=block.replace(needle,replacement,1)
elif '.filter(isPublicFootballScopeMatch);' not in block:
    raise SystemExit('Sortie TheSportsDB inattendue')
s=s[:fetch_ts_start]+block+s[fetch_ts_end:]

# Cache chaud : après le garde NFL, appliquer le scope avant tout retour.
fetch_start=s.find('async function fetchLiveMatches()')
fetch_end=s.find('function getMockMatches',fetch_start)
if fetch_start < 0 or fetch_end < 0: raise SystemExit('fetchLiveMatches introuvable')
block=s[fetch_start:fetch_end]
if 'cachedInScope' not in block:
    m=re.search(r'(const\s+cachedNoNfl\s*=\s*liveMatchesCache\.data\.filter\([^\n]+\);\s*\n)(\s*)(if\s*\(cachedNoNfl\.length[^\n]+\n\s*return\s+await\s+enrichFootballOnlyLiveCache\(cachedNoNfl\);)',block)
    if not m:
        raise SystemExit('Cache live apres garde NFL introuvable')
    repl=(m.group(1)+m.group(2)+'const cachedInScope = cachedNoNfl.filter(isPublicFootballScopeMatch);\n'
          +m.group(2)+'if (cachedInScope.length !== liveMatchesCache.data.length) liveMatchesCache = { data: cachedInScope, ts: liveMatchesCache.ts };\n'
          +m.group(2)+'return await enrichFootballOnlyLiveCache(cachedInScope);')
    block=block[:m.start()]+repl+block[m.end():]

# Sortie finale : conserver la resolution des finis sur le brut, puis filtrer
# seulement ce qui part au site/aux observateurs IA.
if 'const productMatches = matches.filter(isPublicFootballScopeMatch);' not in block:
    needle2='  const visibleMatches = matches.filter(m => !isFinishedOrTooLateForLiveIa(m));'
    if needle2 not in block: raise SystemExit('visibleMatches introuvable')
    block=block.replace(needle2,'  const productMatches = matches.filter(isPublicFootballScopeMatch);\n  const visibleMatches = productMatches.filter(m => !isFinishedOrTooLateForLiveIa(m));',1)
s=s[:fetch_start]+block+s[fetch_end:]

# Pré-match : filtre AVANT fetchH2H / fetchRealOdds.
pre_start=s.find('async function computeUpcomingPicks()')
pre_end=s.find('app.get("/upcoming-picks"',pre_start)
if pre_start < 0 or pre_end < 0: raise SystemExit('computeUpcomingPicks introuvable')
block=s[pre_start:pre_end]
if 'if (!isPublicFootballScopeMatch(compObj)) continue;' not in block:
    # Insérer juste après la fermeture de compObj, avant les anciens filtres/calls.
    key='''      const compObj = {\n        competition: f.league?.name || "",\n        league: f.league?.name || "",\n        country: f.league?.country || "",\n        sport: "Football",\n        home: f.teams.home?.name || "",\n        away: f.teams.away?.name || "",\n      };'''
    if key not in block: raise SystemExit('compObj upcoming introuvable')
    block=block.replace(key,key+'\n      if (!isPublicFootballScopeMatch(compObj)) continue;',1)
s=s[:pre_start]+block+s[pre_end:]

# Garde ultime : aucun appel d'analyse live ne doit accepter un hors-scope.
obs_start=s.find('function shouldAutoObserveMatch')
if obs_start >= 0:
    obs_end=s.find('\n}',obs_start)
    if obs_end > obs_start:
        obs_block=s[obs_start:obs_end]
        if 'isPublicFootballScopeMatch(match)' not in obs_block:
            first_nl=s.find('\n',obs_start)
            s=s[:first_nl+1]+'  if (!isPublicFootballScopeMatch(match)) return false;\n'+s[first_nl+1:]

if s == orig:
    print('Déjà installé — aucun changement')
else:
    p.write_text(s,encoding='utf-8')
    print('OK — périmètre football appliqué au flux, cache et pré-match')
PY

echo "[3/7] Vérification syntaxique"
node --check scripts/api_server.js
grep -q 'TLM-PUBLIC-FOOTBALL-SCOPE-V2-20260830' scripts/api_server.js
grep -q 'cachedInScope' scripts/api_server.js
grep -q 'filter(isPublicFootballScopeMatch)' scripts/api_server.js

echo "[4/7] Protection du frontend"
[ "$INDEX_BEFORE" = "$(sha256sum public/index.html | awk '{print $1}')" ]
[ "$APP_BEFORE" = "$(sha256sum public/app.html | awk '{print $1}')" ]
[ "$LIVEIA_BEFORE" = "$(sha256sum public/live-ia.html | awk '{print $1}')" ]

echo "[5/7] Rebuild du SEUL service API"
docker compose up -d --no-deps --build api
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3001/health >/dev/null

echo "[6/7] Vérification réelle du flux public"
curl -fsS http://127.0.0.1:3001/live-matches > /tmp/tlm-scope-live-v2.json
python3 - <<'PY'
import json,re
D=json.load(open('/tmp/tlm-scope-live-v2.json'))
rows=D.get('matches') or D.get('live') or (D if isinstance(D,list) else [])
blocked=re.compile(r'\b(?:nfl|american football|usa|united states|canada|costa[ -]?rica|nicaragua|ecuador|chile|paraguay|afghanistan|iraq|algeria|algerie|tunisia|tunisie|morocco|maroc|kazakhstan|azerbaijan|uzbekistan)\b',re.I)
women=re.compile(r'\bwomen\b|\bfemenil\b|\bfeminine\b|(?:\s|\()W\)?$',re.I)
bad=[]; fem=[]
for m in rows:
    text=' '.join(str(m.get(k) or '') for k in ('sport','competition','country','home','away'))
    if blocked.search(text): bad.append((m.get('home'),m.get('away'),m.get('competition'),m.get('country')))
    if women.search(str(m.get('home') or '')) or women.search(str(m.get('away') or '')) or women.search(str(m.get('competition') or '')):
        fem.append((m.get('home'),m.get('away')))
print('MATCHS_RETOURNES=',len(rows))
print('PAYS_LIGUES_BLOQUES_RETOURNES=',len(bad))
print('FEMININS_RETOURNES=',len(fem))
for m in rows[:20]: print(' OK:',m.get('country') or '?','|',m.get('competition'),'|',m.get('home'),'—',m.get('away'))
if bad or fem:
    print('BLOQUES_ENCORE=',bad[:10],fem[:10])
    raise SystemExit('Un match hors périmètre est encore retourné')
PY

echo "[7/7] Site / app / Live IA toujours accessibles"
curl -fsS https://www.touslesmatchs.com/ >/dev/null
curl -fsS https://www.touslesmatchs.com/app.html >/dev/null
curl -fsS https://www.touslesmatchs.com/live-ia >/dev/null

trap - ERR
echo "TERMINE — PERIMETRE FOOTBALL NETTOYE A LA SOURCE V2"
echo "SHA_API_APRES=$(sha256sum scripts/api_server.js | awk '{print $1}')"
echo "SAUVEGARDE=$BACKUP"
echo "Frontend / Telegram / Hermes / Stripe / Brevo / DB inchangés."
