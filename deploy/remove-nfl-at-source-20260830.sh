#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-remove-nfl-source-$STAMP"
mkdir -p "$BACKUP"
cp -a scripts/api_server.js "$BACKUP/api_server.js"

rollback(){
  echo "ERREUR — restauration de scripts/api_server.js"
  cp -a "$BACKUP/api_server.js" scripts/api_server.js
  docker compose up -d --no-deps --build api >/dev/null 2>&1 || true
}
trap rollback ERR

echo "[1/6] Etat avant correction"
echo "BRANCHE=$(git branch --show-current)"
echo "COMMIT=$(git rev-parse HEAD)"
echo "SHA_API_AVANT=$(sha256sum scripts/api_server.js | awk '{print $1}')"

echo "[2/6] Correction de la mauvaise classification TheSportsDB"
python3 - <<'PY'
from pathlib import Path
p=Path('scripts/api_server.js')
s=p.read_text(encoding='utf-8')
orig=s

marker='TLM-NFL-SOURCE-GUARD-20260830'

# 1) Fonction centrale de détection NFL / football américain.
if marker not in s:
    anchor='function normalizeTheSportsDbLiveEvent(event, fallbackSport) {'
    pos=s.find(anchor)
    if pos < 0:
        raise SystemExit('normalizeTheSportsDbLiveEvent introuvable')
    helper=r'''// TLM-NFL-SOURCE-GUARD-20260830
function isAmericanFootballMatch(match) {
  const raw = [
    match?.sport,
    match?.competition,
    typeof match?.league === "string" ? match.league : match?.league?.name,
    match?.country,
    match?.home,
    match?.away,
    match?.strSport,
    match?.strLeague,
    match?.strLeagueAlternate,
  ].filter(Boolean).join(" ").toLowerCase();
  return /\bamerican football\b|\bgridiron\b|\bnfl\b|\bnational football league\b|\bcanadian football\b|\bcfl\b/.test(raw);
}

'''
    s=s[:pos]+helper+s[pos:]

# 2) TheSportsDB : American Football ne doit JAMAIS tomber dans le fallback Football.
old='''function normalizeTheSportsDbLiveEvent(event, fallbackSport) {\n  const rawSport = String(event?.strSport || fallbackSport || "").toLowerCase();\n  const sport = rawSport.includes("basket") ? "Basketball"\n    : rawSport.includes("hockey") ? "Hockey"\n    : rawSport.includes("baseball") ? "Baseball"\n    : "Football";'''
new='''function normalizeTheSportsDbLiveEvent(event, fallbackSport) {\n  const rawSport = String(event?.strSport || fallbackSport || "").toLowerCase();\n  if (isAmericanFootballMatch(event)) return null;\n  const sport = rawSport.includes("basket") ? "Basketball"\n    : rawSport.includes("hockey") ? "Hockey"\n    : rawSport.includes("baseball") ? "Baseball"\n    : (rawSport.includes("soccer") || rawSport.includes("football")) ? "Football"\n    : null;\n  if (!sport) return null;'''
if old in s:
    if s.count(old) != 1:
        raise SystemExit('Bloc normalisation TheSportsDB ambigu')
    s=s.replace(old,new,1)
elif 'if (isAmericanFootballMatch(event)) return null;' not in s:
    raise SystemExit('Bloc TheSportsDB inattendu')

# 3) Défense en profondeur dans le filtre Live IA serveur.
old_black='''function isBlacklistedForLiveDisplay(matchOrCompetition = "") {\n  // league/country lus aussi, meme raison que dans isLowTrustCompetition.'''
new_black='''function isBlacklistedForLiveDisplay(matchOrCompetition = "") {\n  if (typeof matchOrCompetition === "object" && isAmericanFootballMatch(matchOrCompetition)) return true;\n  // league/country lus aussi, meme raison que dans isLowTrustCompetition.'''
if old_black in s:
    s=s.replace(old_black,new_black,1)
elif 'isAmericanFootballMatch(matchOrCompetition)' not in s[s.find('function isBlacklistedForLiveDisplay'):s.find('function isWomenMatch')]:
    raise SystemExit('Filtre Live IA inattendu')

# 4) Produit O/U 2,5 : impossible qu'un American Football soit éligible.
needle='''function isClientOu25MatchEligible(match, requireMinute = true) {\n  const sport = String(match?.sport || "Football").toLowerCase();'''
replacement='''function isClientOu25MatchEligible(match, requireMinute = true) {\n  if (isAmericanFootballMatch(match)) return false;\n  const sport = String(match?.sport || "Football").toLowerCase();'''
if needle in s:
    s=s.replace(needle,replacement,1)
elif 'if (isAmericanFootballMatch(match)) return false;' not in s[s.find('function isClientOu25MatchEligible'):s.find('const storedOu25ConsensusCache')]:
    raise SystemExit('Filtre O/U 2,5 inattendu')

# 5) Dernier garde-fou à la sortie fusionnée : purge aussi un NFL déjà présent dans le cache/source.
old_merge='''  const matches = mergeLiveMatchSources(\n    mergeLiveMatchSources(footballDataMatches || [], apiSportsMatches || []),\n    theSportsDbMatches || []\n  );'''
new_merge='''  const matches = mergeLiveMatchSources(\n    mergeLiveMatchSources(footballDataMatches || [], apiSportsMatches || []),\n    theSportsDbMatches || []\n  ).filter((match) => !isAmericanFootballMatch(match));'''
if old_merge in s:
    s=s.replace(old_merge,new_merge,1)
elif ').filter((match) => !isAmericanFootballMatch(match));' not in s:
    raise SystemExit('Fusion live inattendue')

# 6) Cache déjà chaud : purger avant de le renvoyer.
old_cache='''  if (liveMatchesCache.data && Date.now() - liveMatchesCache.ts < CACHE_TTL) {\n    return await enrichFootballOnlyLiveCache(liveMatchesCache.data);\n  }'''
new_cache='''  if (liveMatchesCache.data && Date.now() - liveMatchesCache.ts < CACHE_TTL) {\n    const cachedNoNfl = liveMatchesCache.data.filter((match) => !isAmericanFootballMatch(match));\n    if (cachedNoNfl.length !== liveMatchesCache.data.length) liveMatchesCache = { data: cachedNoNfl, ts: liveMatchesCache.ts };\n    return await enrichFootballOnlyLiveCache(cachedNoNfl);\n  }'''
if old_cache in s:
    s=s.replace(old_cache,new_cache,1)
elif 'const cachedNoNfl = liveMatchesCache.data.filter' not in s:
    raise SystemExit('Cache live inattendu')

if s == orig:
    print('Déjà corrigé — aucun changement')
else:
    p.write_text(s,encoding='utf-8')
    print('OK — NFL rejeté à la source TheSportsDB + sortie live')
PY

echo "[3/6] Vérification syntaxique"
node --check scripts/api_server.js
grep -q 'TLM-NFL-SOURCE-GUARD-20260830' scripts/api_server.js
grep -q 'isAmericanFootballMatch(event)' scripts/api_server.js
grep -q 'cachedNoNfl' scripts/api_server.js

echo "[4/6] Rebuild du SEUL service API"
docker compose up -d --no-deps --build api

# Attendre le redémarrage API.
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3001/health >/dev/null

echo "[5/6] Vérification réelle /live-matches"
curl -fsS http://127.0.0.1:3001/live-matches > /tmp/tlm-live-no-nfl.json
python3 - <<'PY'
import json,re
p='/tmp/tlm-live-no-nfl.json'
d=json.load(open(p))
rows=d.get('matches') or d.get('live') or (d if isinstance(d,list) else [])
pat=re.compile(r'\b(?:nfl|american football|gridiron|national football league|canadian football|cfl)\b',re.I)
bad=[]
for m in rows:
    text=' '.join(str(m.get(k) or '') for k in ('sport','competition','league','country','home','away'))
    if pat.search(text): bad.append((m.get('home'),m.get('away'),m.get('competition'),m.get('sport')))
print('MATCHS_RETOURNES=',len(rows))
print('NFL_RETOURNES=',len(bad))
for x in bad[:10]: print('NFL ENCORE PRESENT:',x)
if bad: raise SystemExit('NFL encore présent dans /live-matches')
PY

echo "[6/6] Vérification site et app toujours accessibles"
curl -fsS https://www.touslesmatchs.com/ >/dev/null
curl -fsS https://www.touslesmatchs.com/app.html >/dev/null
curl -fsS https://www.touslesmatchs.com/live-ia >/dev/null

trap - ERR
echo "TERMINE — NFL SUPPRIME A LA SOURCE"
echo "SHA_API_APRES=$(sha256sum scripts/api_server.js | awk '{print $1}')"
echo "SAUVEGARDE=$BACKUP"
echo "Seul scripts/api_server.js + service api ont été touchés."
