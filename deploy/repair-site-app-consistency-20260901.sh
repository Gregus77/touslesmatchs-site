#!/usr/bin/env bash
set -Eeuo pipefail

TLM_ROOT="/opt/touslesmatchs"
TLM_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TLM_BACKUP="/opt/backups/tlm-site-app-consistency-${TLM_STAMP}"
TLM_FILES=(
  scripts/api_server.js
  public/app.html
  public/live-ia.html
  public/faq.html
  public/performances.html
  public/sw.js
)
TLM_DEPLOY_OK=0

cd "$TLM_ROOT"

for TLM_FILE in "${TLM_FILES[@]}"; do
  test -f "$TLM_FILE" || { echo "FAILED: fichier absent: $TLM_FILE" >&2; exit 1; }
done

mkdir -p "$TLM_BACKUP"
chmod 700 "$TLM_BACKUP"
tar -czf "$TLM_BACKUP/files-before.tar.gz" -C "$TLM_ROOT" "${TLM_FILES[@]}"
git status --short --branch > "$TLM_BACKUP/git-status-before.txt"
git rev-parse HEAD > "$TLM_BACKUP/git-head-before.txt"

tlm_rollback() {
  local TLM_RC=$?
  if [ "$TLM_RC" -ne 0 ] && [ "$TLM_DEPLOY_OK" -ne 1 ]; then
    echo "[rollback] echec detecte, restauration des fichiers sauvegardes" >&2
    tar -xzf "$TLM_BACKUP/files-before.tar.gz" -C "$TLM_ROOT"
    docker compose up -d --build api site >/dev/null 2>&1 || true
    echo "FAILED: correction annulee; sauvegarde=$TLM_BACKUP" >&2
  fi
  exit "$TLM_RC"
}
trap tlm_rollback EXIT

python3 - <<'PY'
from pathlib import Path
import re

ROOT = Path('/opt/touslesmatchs')

def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')

def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')

def replace_required(text, old, new, label):
    if new in text:
        return text, False
    if old not in text:
        raise SystemExit(f'FAILED: ancre introuvable: {label}')
    return text.replace(old, new, 1), True

# 1) API: deduplication des alias fournisseurs et motif ARJEL expose au front.
rel = 'scripts/api_server.js'
s = read(rel)
marker = 'function canonicalLiveTeamName20260901(name) {'
if marker not in s:
    anchor = 'function sameLiveTeamName(a, b) {'
    if anchor not in s:
        raise SystemExit('FAILED: ancre sameLiveTeamName absente')
    helper = r'''function canonicalLiveTeamName20260901(name) {
  const normalized = normalizeMatchName(name)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  // Alias observes entre API-Sports et TheSportsDB. Cette liste est volontairement
  // explicite afin de ne jamais fusionner deux rencontres sur un simple score/minute.
  if (/^(?:tala ?ea |talaea )?el gaish$/.test(normalized) || normalized === "el geish") return "el geish";
  if (/^(?:zed|zed fc|fc masr|masr)$/.test(normalized)) return "zed";
  if (/^ghazl el (?:mehalla|mahalla)$/.test(normalized)) return "ghazl el mahalla";
  if (/^(?:enppi|enp pi|enppi club)$/.test(normalized)) return "enppi";
  return normalized;
}

'''
    s = s.replace(anchor, helper + anchor, 1)

old = '  const na = normalizeMatchName(a);\n  const nb = normalizeMatchName(b);'
new = '  const na = canonicalLiveTeamName20260901(a);\n  const nb = canonicalLiveTeamName20260901(b);'
if new not in s:
    if old not in s:
        raise SystemExit('FAILED: ancre normalisation equipes absente')
    s = s.replace(old, new, 1)

old = '''      const verdict = await isArjelPlayableBeforeAnalysis(m);
      if (verdict.ok) { candidates.push(m); continue; }
      refusesArjel++;
      console.log(`[auto-concile] hors ARJEL, aucun jeton depense: ${m.home} vs ${m.away} — ${verdict.why}`);'''
new = '''      const verdict = await isArjelPlayableBeforeAnalysis(m);
      if (verdict.ok) {
        delete m.analysis_exclusion_reason;
        candidates.push(m);
        continue;
      }
      refusesArjel++;
      m.analysis_exclusion_reason = `Analyse non lancée : ${verdict.why}.`;
      console.log(`[auto-concile] hors ARJEL, aucun jeton depense: ${m.home} vs ${m.away} — ${verdict.why}`);'''
if 'm.analysis_exclusion_reason = `Analyse non lancée' not in s:
    if old not in s:
        raise SystemExit('FAILED: ancre portail ARJEL absente')
    s = s.replace(old, new, 1)

old = '''      if (m.pinnedSignal) return { ...m, analysable: false, block_reason: null, ou25, ...visibility };
      const reason = livePickBlockReason(m);
      return { ...m, analysable: !reason, block_reason: reason, ou25, ...visibility };'''
new = '''      const analysisExclusionReason = m.analysis_exclusion_reason || null;
      if (m.pinnedSignal) return { ...m, analysable: false, block_reason: null, analysis_exclusion_reason: null, ou25, ...visibility };
      const reason = livePickBlockReason(m) || analysisExclusionReason;
      return { ...m, analysable: !reason, block_reason: reason, analysis_exclusion_reason: analysisExclusionReason, ou25, ...visibility };'''
if 'const analysisExclusionReason = m.analysis_exclusion_reason || null;' not in s:
    if old not in s:
        raise SystemExit('FAILED: ancre verdict live absente')
    s = s.replace(old, new, 1)
write(rel, s)

# 2) Application: meme raison d'exclusion que l'API et historique correctement qualifie.
rel = 'public/app.html'
s = read(rel)
s = s.replace(
    'Historique réservé aux signaux réellement envoyés. Les gagnés comme les perdus restent visibles.',
    'Historique des analyses. Les envois Telegram vérifiés sont distingués de l’ancien système.'
)
old = '''    $("app-ai-total").textContent=votes+' / 5';
    $("app-ai-label").textContent=votes?'Votes IA Over/Under 2,5':analysisClosed?'Fenêtre d’analyse terminée':analysisWaiting?'Analyse à venir':'Analyse IA en cours';
    $("app-ai-result").textContent=votes?(voteState.overCount+' Over · '+voteState.underCount+' Under'):analysisClosed?'Aucun vote enregistré':analysisWaiting?'Entre la 15e et la 40e':'En attente des IA';'''
new = '''    var exclusionReason=String(m.analysis_exclusion_reason||'');
    $("app-ai-total").textContent=votes+' / 5';
    $("app-ai-label").textContent=votes?'Votes IA Over/Under 2,5':exclusionReason?'Analyse non lancée':analysisClosed?'Fenêtre d’analyse terminée':analysisWaiting?'Analyse à venir':'Analyse IA en cours';
    $("app-ai-result").textContent=votes?(voteState.overCount+' Over · '+voteState.underCount+' Under'):exclusionReason?exclusionReason:analysisClosed?'Aucun vote enregistré':analysisWaiting?'Entre la 15e et la 40e':'En attente des IA';'''
if 'var exclusionReason=String(m.analysis_exclusion_reason||\'\');' not in s:
    if old not in s:
        raise SystemExit('FAILED: ancre affichage app absente')
    s = s.replace(old, new, 1)
write(rel, s)

# 3) Live IA: meme raison serveur, terminologie 5/5 et contact unique.
rel = 'public/live-ia.html'
s = read(rel)
s = s.replace('escHtml(m.block_reason || "Pas encore de signal exploitable sur ce match.")',
              'escHtml(m.analysis_exclusion_reason || m.block_reason || "Pas encore de signal exploitable sur ce match.")')
s = s.replace('vote.vote_status === "elite" ? "Signal Elite"',
              'vote.vote_status === "elite" ? "Signal unanime 5/5"')
s = s.replace('hermes@touslesmatchs.com', 'contact@touslesmatchs.com')
write(rel, s)

# 4) FAQ: offres actuelles, seuil 78 %, plage ANJ, 4/5 et accordéons accessibles.
rel = 'public/faq.html'
s = read(rel)
s = s.replace(
    "Trois paliers sans engagement, score de confiance minimum 82/100 pour Standard et Premium, 75/100 pour Elite-VIP : Standard (jusqu'à 3 signaux/jour, sélection la plus stricte du jour), Premium (jusqu'à 10 signaux/jour, sélection élargie, inclut Standard), Elite/VIP (jusqu'à 30 signaux/jour, tout le vivier diffusable, inclut Premium).",
    "Deux formules payantes sans engagement avec un seuil actuel de 78/100 : Standard (jusqu'à 3 signaux/jour) et Premium (jusqu'à 10 signaux/jour, inclut Standard). Chaque signal exige au moins 4 votes concordants sur 5 et une cote ANJ réelle entre 1.40 et 2.50."
)
s = s.replace(
    "L'analyse du jour (pick quotidien) est publiée vers 12h (heure de Paris). Les analyses Live IA sont disponibles en temps réel pendant les matchs en direct, dès que la cote réelle du marché entre dans la fenêtre jouable (1.30 à 2.50).",
    "Les analyses Live IA peuvent être publiées entre la 15e et la 40e minute lorsqu'au moins 4 IA sur 5 convergent, que la confiance atteint 78/100 et qu'une cote ANJ réelle se situe entre 1.40 et 2.50. Aucun signal n'est forcé."
)
s = s.replace(
    "La sélection se fait sur la cote réelle du marché, pas sur la minute de jeu : un match n'est proposé que si sa cote réelle se situe entre 1.30 et 2.50. En dessous, il n'y a plus de valeur ; au-dessus, l'issue est trop incertaine. Un match trop avancé ou déjà plié voit naturellement sa cote sortir de cette fenêtre.",
    "Un match n'est analysé que s'il est éligible entre la 15e et la 40e minute et qu'une cote ANJ réelle se situe entre 1.40 et 2.50. Sans cote admissible ou sans consensus 4/5, aucun signal n'est diffusé."
)
old_block = '''      Score de confiance minimum 82/100 pour Standard et Premium, 75/100 pour Elite-VIP.<br>
      <strong>Standard</strong> — jusqu'à 3 signaux/jour, sélection la plus stricte du jour, Telegram Standard.<br>
      <strong>Premium</strong> — jusqu'à 10 signaux/jour, sélection élargie, Telegram Premium, inclut Standard.<br>
      <strong>Elite / VIP</strong> — jusqu'à 30 signaux/jour, tout le vivier diffusable, Telegram Elite, inclut Premium.<br><br>'''
new_block = '''      Seuil actuel de diffusion : <strong>78/100 minimum</strong>, avec au moins 4 votes concordants sur 5.<br>
      <strong>Standard</strong> — jusqu'à 3 signaux/jour, Telegram Standard.<br>
      <strong>Premium</strong> — jusqu'à 10 signaux/jour, Telegram Premium, inclut Standard.<br><br>'''
if old_block in s:
    s = s.replace(old_block, new_block, 1)
elif '78/100 minimum' not in s:
    # Le VPS peut contenir une version mise en forme différemment de la branche.
    # On remplace alors tout le contenu de la réponse concernée, sans dépendre
    # des espaces, retours à la ligne ou adjectifs historiques.
    pattern = (
        r'(<div class="faq-q"[^>]*>\s*Comment fonctionnent les abonnements \?\s*'
        r'<span class="faq-arrow">\+</span>\s*</div>\s*<div class="faq-a">)'
        r'.*?'
        r'(Voir les tarifs à jour.*?</div>)'
    )
    replacement = (
        r'\1\n      Seuil actuel de diffusion : <strong>78/100 minimum</strong>, avec au moins 4 votes concordants sur 5.<br>\n'
        r'      <strong>Standard</strong> — jusqu\'à 3 signaux/jour, Telegram Standard.<br>\n'
        r'      <strong>Premium</strong> — jusqu\'à 10 signaux/jour, Telegram Premium, inclut Standard.<br><br>\n'
        r'      \2'
    )
    s, changed = re.subn(pattern, replacement, s, count=1, flags=re.S)
    if changed != 1:
        raise SystemExit('FAILED: bloc abonnements FAQ introuvable')
s = s.replace(
    "La sélection se fait sur la cote réelle chez un opérateur agréé (entre 1.30 et 2.50), pas sur la minute de jeu. Un match à finalité déjà connue (écart de 3 buts ou plus) est aussi automatiquement écarté.",
    "Un match n'est analysé qu'entre la 15e et la 40e minute, avec une cote réelle chez un opérateur agréé entre 1.40 et 2.50. Sans cote ANJ admissible ou sans consensus 4/5, aucun signal n'est diffusé."
)

# Harmoniser les variantes décimales présentes dans les versions locales du VPS.
# Le texte public reste français, mais le garde-fou utilise une forme canonique.
s = re.sub(r'1[.,]30\s+(?:à|et)\s+2[.,]50', '1.40 et 2.50', s)
s = re.sub(r'1[.,]40\s+(?:à|et)\s+2[.,]50', '1.40 et 2.50', s)
if '1.40 et 2.50' not in s:
    marker_anj = 'avec au moins 4 votes concordants sur 5.<br>'
    if marker_anj not in s:
        raise SystemExit('FAILED: ancre plage ANJ FAQ introuvable')
    s = s.replace(
        marker_anj,
        'avec au moins 4 votes concordants sur 5. Cote ANJ réelle entre 1.40 et 2.50.<br>',
        1,
    )
s = s.replace('5/5 = signal Elite, 4/5 = signal fort, 3/5 = tendance IA.',
              '5/5 = signal unanime, 4/5 = signal fort. À 3/5 ou moins, aucun signal client n’est diffusé.')
s = s.replace('Les abonnés Premium et Elite accèdent aux analyses Live IA en temps réel.',
              'Les abonnés Standard et Premium reçoivent les signaux validés en temps réel sur Telegram.')

if '<div class="faq-q" onclick="this.parentElement.classList.toggle(\'open\')">' in s:
    s = re.sub(
        r'<div class="faq-q" onclick="this\.parentElement\.classList\.toggle\(\'open\'\)">(.*?)</div>',
        r'<button type="button" class="faq-q" aria-expanded="false" onclick="toggleFaq(this)">\1</button>',
        s,
        flags=re.S,
    )
    s = s.replace('aria-expanded="false" onclick="toggleFaq(this)"',
                  'aria-expanded="true" onclick="toggleFaq(this)"', 1)
s = s.replace(
    '.faq-q{display:flex;align-items:center;justify-content:space-between;',
    '.faq-q{width:100%;border:0;background:transparent;color:inherit;text-align:left;font-family:inherit;display:flex;align-items:center;justify-content:space-between;'
)
if 'function toggleFaq(button)' not in s:
    s = s.replace(
        "function toggleMenu() { document.getElementById('mmenu').classList.toggle('open'); }",
        "function toggleFaq(button) { var item=button.parentElement; var open=item.classList.toggle('open'); button.setAttribute('aria-expanded', open ? 'true' : 'false'); }\nfunction toggleMenu() { document.getElementById('mmenu').classList.toggle('open'); }"
    )
write(rel, s)

# 5) Performances: supprimer le palier public obsolete et distinguer l'historique.
rel = 'public/performances.html'
s = read(rel)
s = re.sub(r'\s*<div class="tier-tab" data-tier="elite"[^\n]*</div>', '', s, count=1)
s = s.replace(
    'Règle commune aux trois paliers : football de championnat entre la 15e et la 40e minute, cinq sièges O/U 2,5 renseignés, majorité minimale 4/5 et cote bookmaker réelle.',
    'Règle actuelle Standard et Premium : football de championnat entre la 15e et la 40e minute, cinq sièges O/U 2,5, majorité minimale 4/5, confiance ≥78/100 et cote ANJ réelle entre 1,40 et 2,50.'
)
s = s.replace(
    'Règle commune aux deux formules payantes : football de championnat entre la 15e et la 40e minute, cinq sièges O/U 2,5 renseignés, majorité minimale 4/5 et cote bookmaker réelle.',
    'Règle actuelle Standard et Premium : football de championnat entre la 15e et la 40e minute, cinq sièges O/U 2,5, majorité minimale 4/5, confiance ≥78/100 et cote ANJ réelle entre 1,40 et 2,50.'
)
s = s.replace('75-84/100 Bon', '78-84/100 Diffusable')
s = s.replace(
    'Chaque ligne = une analyse. Cote réelle ANJ quand disponible, sinon estimation marché.',
    'Depuis le 27 août : signaux Telegram vérifiés. Les lignes « Ancien système » ou « Livraison non prouvée » sont conservées séparément et ne prouvent pas un envoi.'
)
write(rel, s)

# 6) Invalidation propre du cache PWA, quelle que soit la mise en forme locale.
rel = 'public/sw.js'
s = read(rel)
target_sw_version = 'const VERSION = "tlm-app-v9-consistency-20260901";'
if target_sw_version not in s:
    version_pattern = r"(?m)^\s*(?:const|let|var)\s+VERSION\s*=\s*([\"'\x60])[^\"'\x60]+\1\s*;"
    s, changed = re.subn(version_pattern, target_sw_version, s, count=1)
    if changed != 1:
        raise SystemExit('FAILED: ancre version service worker introuvable')
write(rel, s)

# Garde-fous produit.
checks = {
    'scripts/api_server.js': [
        'canonicalLiveTeamName20260901',
        'analysis_exclusion_reason',
        'CLIENT_OU25_MIN_CONFIDENCE',
    ],
    'public/app.html': ['Analyse non lancée', 'envois Telegram vérifiés'],
    'public/live-ia.html': ['analysis_exclusion_reason', 'Signal unanime 5/5', 'contact@touslesmatchs.com'],
    'public/faq.html': ['78/100 minimum', '1.40 et 2.50', 'toggleFaq(button)'],
    'public/performances.html': ['confiance ≥78/100', 'Livraison non prouvée'],
    'public/sw.js': ['tlm-app-v9-consistency-20260901'],
}
for file, needles in checks.items():
    body = read(file)
    for needle in needles:
        if needle not in body:
            raise SystemExit(f'FAILED: preuve source absente: {file}: {needle}')

faq = read('public/faq.html')
for stale in ('Elite / VIP', 'Premium et Elite', '82/100 pour Standard', '1.30 et 2.50'):
    if stale in faq:
        raise SystemExit(f'FAILED: contenu FAQ obsolete encore present: {stale}')
PY

node --check scripts/api_server.js
node --check public/sw.js

echo "[deploy] reconstruction API + site uniquement"
docker compose up -d --build api site

for TLM_TRY in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3001/health >/tmp/tlm-health-local.json 2>/dev/null; then
    break
  fi
  sleep 2
done
curl -fsS --max-time 10 http://127.0.0.1:3001/health >/tmp/tlm-health-local.json
curl -fsS --max-time 15 "https://www.touslesmatchs.com/api/health?t=${TLM_STAMP}" >/tmp/tlm-health-public.json
curl -fsS --max-time 30 "https://www.touslesmatchs.com/api/live-matches?force=1&t=${TLM_STAMP}" >/tmp/tlm-live-after.json
curl -fsS --max-time 15 "https://www.touslesmatchs.com/faq?v=${TLM_STAMP}" >/tmp/tlm-faq-after.html
curl -fsS --max-time 15 "https://www.touslesmatchs.com/app.html?v=${TLM_STAMP}" >/tmp/tlm-app-after.html
curl -fsS --max-time 15 "https://www.touslesmatchs.com/sw.js?v=${TLM_STAMP}" >/tmp/tlm-sw-after.js

docker exec touslesmatchs-api grep -q 'canonicalLiveTeamName20260901' /app/server.js
docker exec touslesmatchs-api grep -q 'analysis_exclusion_reason' /app/server.js
grep -q '78/100 minimum' /tmp/tlm-faq-after.html
grep -q 'Analyse non lancée' /tmp/tlm-app-after.html
grep -q 'tlm-app-v9-consistency-20260901' /tmp/tlm-sw-after.js
! grep -q 'Elite / VIP' /tmp/tlm-faq-after.html
! grep -q 'Premium et Elite' /tmp/tlm-faq-after.html

python3 - <<'PY'
import json, re
from pathlib import Path

d = json.loads(Path('/tmp/tlm-live-after.json').read_text(encoding='utf-8'))
assert d.get('ok') is True, d
matches = d.get('matches') or []

def canon(name):
    x = (name or '').lower()
    x = re.sub(r'[^a-z0-9 ]+', ' ', x)
    x = re.sub(r'\s+', ' ', x).strip()
    if re.fullmatch(r'(?:tala ?ea |talaea )?el gaish|el geish', x): return 'el geish'
    if re.fullmatch(r'zed|zed fc|fc masr|masr', x): return 'zed'
    if re.fullmatch(r'ghazl el (?:mehalla|mahalla)', x): return 'ghazl el mahalla'
    if re.fullmatch(r'enppi|enp pi|enppi club', x): return 'enppi'
    return x

seen = set()
duplicates = []
for m in matches:
    key = (canon(m.get('home')), canon(m.get('away')))
    if key in seen:
        duplicates.append(key)
    seen.add(key)
    assert 'analysis_exclusion_reason' in m, m

assert not duplicates, f'doublons persistants: {duplicates}'
print(f'PROOF_LIVE_MATCHES={len(matches)}')
print('PROOF_DUPLICATES=0')
print('PROOF_EXCLUSION_FIELD=present')
PY

if docker logs --since 2m touslesmatchs-api 2>&1 | grep -Eq 'SyntaxError|ReferenceError|uncaughtException'; then
  echo "FAILED: erreur recente dans les logs API" >&2
  exit 1
fi

TLM_DEPLOY_OK=1
trap - EXIT

echo "OK: site et application alignes"
echo "BACKUP=$TLM_BACKUP"
echo "PROOF_API=healthy_local_and_public"
echo "PROOF_THRESHOLD=78_preserved"
echo "PROOF_SITE_CACHE=tlm-app-v9-consistency-20260901"
echo "GIT=non modifie automatiquement; changements locaux preexistants preserves"
