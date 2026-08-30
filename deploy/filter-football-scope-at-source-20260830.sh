#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-football-scope-$STAMP"
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

echo "[2/7] Installation du périmètre football public"
python3 - <<'PY'
from pathlib import Path
p=Path('scripts/api_server.js')
s=p.read_text(encoding='utf-8')
orig=s

# Ce correctif doit s'ajouter au garde-fou NFL déjà validé en production.
if 'TLM-NFL-SOURCE-GUARD-20260830' not in s:
    raise SystemExit('Garde-fou NFL absent — arrêt sans modification')

marker='TLM-PUBLIC-FOOTBALL-SCOPE-20260830'
if marker not in s:
    anchor='async function fetchFromFootballData() {'
    pos=s.find(anchor)
    if pos < 0:
        raise SystemExit('fetchFromFootballData introuvable')
    helper=r'''// TLM-PUBLIC-FOOTBALL-SCOPE-20260830
// Périmètre unique du produit : football/soccer, compétitions reconnues,
// pas de ligues faibles/exotiques, pas de féminin, pas USA/Canada.
const PUBLIC_FOOTBALL_BLOCKED_COUNTRIES = new Set([
  "usa", "us", "united states", "united states of america", "canada",
  "costa rica", "nicaragua", "ecuador", "chile", "paraguay",
  "afghanistan", "iraq", "algeria", "tunisia", "morocco", "maroc",
  "kazakhstan", "azerbaijan", "uzbekistan"
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
  for (const c of PUBLIC_FOOTBALL_BLOCKED_COUNTRIES) {
    if (c.length >= 4 && new RegExp(`(^|[^a-z])${c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^a-z]|$)`).test(comp)) return c;
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

  // Au Mexique, seule Liga MX est dans le périmètre public. Cela élimine
  // notamment Liga Premier / Serie A-B semi-pro sans toucher à Liga MX.
  if (country === "mexico" && !/\bliga mx\b/.test(comp)) return false;

  // Refus par défaut des ligues non classées : seules les compétitions déjà
  // reconnues par le moteur comme majeures ou secondaires fiables passent.
  const tier = leagueTier(match);
  return tier === "trusted_major" || tier === "trusted_secondary";
}

'''
    s=s[:pos]+helper+s[pos:]

# Ajouter le pays structuré aux objets API-Sports football : le filtre ne doit
# pas dépendre uniquement du nom de ligue.
old='''    competition: f.league.name + (f.league.country !== "World" ? " · " + f.league.country : ""),\n    utcDate: f.fixture.date,'''
new='''    competition: f.league.name + (f.league.country !== "World" ? " · " + f.league.country : ""),\n    country: f.league?.country || "",\n    utcDate: f.fixture.date,'''
if old in s:
    s=s.replace(old,new,1)
elif 'country: f.league?.country || "",' not in s[s.find('function normalizeApiSportsFootballFixture'):s.find('const CATEGORY_BAN_KEYWORDS')]:
    raise SystemExit('Ajout country API-Sports impossible')

# Football-Data : même principe si area est disponible.
old_fd='''    competition: m.competition?.name || "International",\n    utcDate: m.utcDate,'''
new_fd='''    competition: m.competition?.name || "International",\n    country: m.area?.name || m.competition?.area?.name || "",\n    utcDate: m.utcDate,'''
if old_fd in s:
    s=s.replace(old_fd,new_fd,1)

# TheSportsDB : conserver le pays pour le filtrage des ligues/pays.
old_ts='''    competition: event?.strLeague || event?.strLeagueAlternate || sport,\n    utcDate: event?.dateEvent || event?.strTimestamp || new Date().toISOString(),'''
new_ts='''    competition: event?.strLeague || event?.strLeagueAlternate || sport,\n    country: event?.strCountry || event?.strLeagueCountry || "",\n    utcDate: event?.dateEvent || event?.strTimestamp || new Date().toISOString(),'''
if old_ts in s:
    s=s.replace(old_ts,new_ts,1)

# Le cache chaud doit lui aussi respecter le périmètre, sinon d'anciennes
# entrées peuvent survivre jusqu'au prochain rafraîchissement réseau.
old_cache='''    const cachedNoNfl = liveMatchesCache.data.filter((match) => !isAmericanFootballMatch(match));\n    if (cachedNoNfl.length !== liveMatchesCache.data.length) liveMatchesCache = { data: cachedNoNfl, ts: liveMatchesCache.ts };\n    return await enrichFootballOnlyLiveCache(cachedNoNfl);'''
new_cache='''    const cachedNoNfl = liveMatchesCache.data.filter((match) => !isAmericanFootballMatch(match));\n    const cachedInScope = cachedNoNfl.filter(isPublicFootballScopeMatch);\n    if (cachedInScope.length !== liveMatchesCache.data.length) liveMatchesCache = { data: cachedInScope, ts: liveMatchesCache.ts };\n    return await enrichFootballOnlyLiveCache(cachedInScope);'''
if old_cache in s:
    s=s.replace(old_cache,new_cache,1)
elif 'const cachedInScope = cachedNoNfl.filter(isPublicFootballScopeMatch);' not in s:
    raise SystemExit('Cache NFL courant inattendu')

# Enrichissement TheSportsDB du cache : ne réinjecte jamais une ligue hors scope.
old_enrich='''    const enrichedMatches = mergeLiveMatchSources(cacheData, theSportsDbMatches)\n      .filter(m => !isFinishedOrTooLateForLiveIa(m));'''
new_enrich='''    const enrichedMatches = mergeLiveMatchSources(cacheData, theSportsDbMatches)\n      .filter(isPublicFootballScopeMatch)\n      .filter(m => !isFinishedOrTooLateForLiveIa(m));'''
if old_enrich in s:
    s=s.replace(old_enrich,new_enrich,1)
elif '.filter(isPublicFootballScopeMatch)' not in s[s.find('async function enrichFootballOnlyLiveCache'):s.find('async function fetchLiveMatches')]:
    raise SystemExit('Enrichissement cache inattendu')

# Après fusion, on résout encore les anciens résultats à partir de TOUS les
# matchs récupérés, puis seulement ensuite on réduit le flux public/IA.
old_visible='''  const visibleMatches = matches.filter(m => !isFinishedOrTooLateForLiveIa(m));\n  liveMatchesCache = { data: visibleMatches, ts: Date.now() };\n  return visibleMatches;'''
new_visible='''  const productMatches = matches.filter(isPublicFootballScopeMatch);\n  const visibleMatches = productMatches.filter(m => !isFinishedOrTooLateForLiveIa(m));\n  liveMatchesCache = { data: visibleMatches, ts: Date.now() };\n  return visibleMatches;'''
if old_visible in s:
    s=s.replace(old_visible,new_visible,1)
elif 'const productMatches = matches.filter(isPublicFootballScopeMatch);' not in s:
    raise SystemExit('Sortie fetchLiveMatches inattendue')

# Pipeline pré-match : appliquer le même périmètre AVANT les appels H2H/cotes.
old_pre='''      if (isCategoryBanned(compObj) || (!isUefaCompetition(compObj) && isLowTrustCompetition(compObj))) continue;\n      // isWomenMatch() manquait sur ce pipeline pre-match (H2H) — seul le direct\n      // (shouldAutoObserveMatch) l'appliquait. Une Liga MX Femenil a ete analysee\n      // et diffusee via ce chemin, constate le 02/08/2026 (Cruz Azul W - Atlas W).\n      if (isWomenMatch(compObj)) continue;'''
new_pre='''      // Même périmètre que le live, AVANT tout appel H2H/cote coûteux.\n      if (!isPublicFootballScopeMatch(compObj)) continue;'''
if old_pre in s:
    s=s.replace(old_pre,new_pre,1)
elif 'if (!isPublicFootballScopeMatch(compObj)) continue;' not in s:
    raise SystemExit('Pipeline upcoming inattendu')

if s == orig:
    print('Déjà installé — aucun changement')
else:
    p.write_text(s,encoding='utf-8')
    print('OK — périmètre football qualité installé avant affichage et analyses')
PY

echo "[3/7] Vérification syntaxique"
node --check scripts/api_server.js
grep -q 'TLM-PUBLIC-FOOTBALL-SCOPE-20260830' scripts/api_server.js
grep -q 'isPublicFootballScopeMatch' scripts/api_server.js
grep -q 'cachedInScope' scripts/api_server.js

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
curl -fsS http://127.0.0.1:3001/live-matches > /tmp/tlm-scope-live.json
python3 - <<'PY'
import json,re
D=json.load(open('/tmp/tlm-scope-live.json'))
rows=D.get('matches') or D.get('live') or (D if isinstance(D,list) else [])
blocked=re.compile(r'\b(?:nfl|american football|usa|united states|canada|costa[ -]?rica|nicaragua|ecuador|chile|paraguay|afghanistan|iraq|algeria|tunisia|morocco|maroc|kazakhstan|azerbaijan|uzbekistan)\b',re.I)
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
echo "TERMINE — PERIMETRE FOOTBALL NETTOYE A LA SOURCE"
echo "SHA_API_APRES=$(sha256sum scripts/api_server.js | awk '{print $1}')"
echo "SAUVEGARDE=$BACKUP"
echo "Règle: football reconnu uniquement; ligues faibles/non classées, féminin, USA/Canada et pays exclus rejetés avant analyses coûteuses."
echo "Frontend / Telegram / Hermes / Stripe / Brevo / DB inchangés."
