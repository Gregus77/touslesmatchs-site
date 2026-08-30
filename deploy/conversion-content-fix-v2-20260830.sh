#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-conversion-content-v2-$STAMP"
FILES=(public/index.html public/js/i18n.js public/faq.html public/performances.html public/cgv.html public/pronostic-ia.html public/resultats-quotidiens.html public/dashboard.html scripts/api_server.js)
mkdir -p "$BACKUP"
for f in "${FILES[@]}"; do mkdir -p "$BACKUP/$(dirname "$f")"; cp -a "$f" "$BACKUP/$f"; done
rollback(){
  echo "ERREUR — rollback conversion V2"
  for f in "${FILES[@]}"; do cp -a "$BACKUP/$f" "$f"; done
  docker compose up -d --no-deps --build site api >/dev/null 2>&1 || true
}
trap rollback ERR

python3 - <<'PY'
from pathlib import Path
import re, json

def rw(p, fn):
    path=Path(p); s=path.read_text(encoding='utf-8'); s2=fn(s)
    path.write_text(s2,encoding='utf-8')

def home(s):
    s=s.replace('Les volumes affichés (3, 10 ou 30 par jour)','Les volumes affichés (3 ou 10 par jour)')
    s=s.replace('Score de confiance minimum 82/100, sélection la plus stricte du jour',"Minimum 4 IA sur 5 d'accord sur Over/Under 2,5")
    s=s.replace('Score de confiance minimum 82/100, sélection élargie',"Minimum 4 IA sur 5 d'accord · inclut Standard")
    # Compatibilité historique : on garde la clé interne elite mais plus aucun label Elite visible.
    s=s.replace("nom:'Telegram Elite-VIP'","nom:'Telegram Premium'")
    s=s.replace("court:'Elite',    c:'var(--elite)'","court:'Premium',  c:'var(--premium)'")
    if 'TLM-CONVERSION-PROOF-FIRST-20260830' not in s:
        a=s.find('  <!-- RANGEE 1bis : MATCHS A VENIR')
        b=s.find('  <!-- RANGEE 2 : PREUVES -->')
        c=s.find('  <!-- RANGEE 2.5',b)
        if min(a,b,c)<0 or not(a<b<c): raise SystemExit('blocs home introuvables')
        up=s[a:b]
        proof='  <!-- TLM-CONVERSION-PROOF-FIRST-20260830 -->\n'+s[b:c]
        s=s[:a]+proof+up+s[c:]
    return s
rw('public/index.html',home)

def i18n(s):
    std={
      'fr':"Minimum 4 IA sur 5 d'accord sur Over/Under 2,5",
      'en':'At least 4 of 5 AIs agree on Over/Under 2.5',
      'es':'Mínimo 4 de 5 IA de acuerdo en Más/Menos de 2,5',
      'pt':'Mínimo de 4 de 5 IAs de acordo em Mais/Menos de 2,5',
      'ru':'Минимум 4 из 5 ИИ согласны по тоталу больше/меньше 2,5',
      'zh':'至少 5 个 AI 中有 4 个对大/小 2.5 球达成一致',
    }
    prem={
      'fr':"Minimum 4 IA sur 5 d'accord · inclut Standard",
      'en':'At least 4 of 5 AIs agree · includes Standard',
      'es':'Mínimo 4 de 5 IA de acuerdo · incluye Standard',
      'pt':'Mínimo de 4 de 5 IAs de acordo · inclui Standard',
      'ru':'Минимум 4 из 5 ИИ согласны · включает Standard',
      'zh':'至少 5 个 AI 中有 4 个达成一致 · 包含 Standard',
    }
    out=[]; lang=None
    for line in s.splitlines(True):
        m=re.match(r'\s*(fr|en|es|pt|ru|zh):\s*\{',line)
        if m: lang=m.group(1)
        if re.search(r'\bplan_elite(?:_1|_2)?\s*:',line) or re.search(r'\bplan_btn_elite\s*:',line):
            continue
        indent=re.match(r'^(\s*)',line).group(1)
        if lang and re.search(r'\bplan_std_2\s*:',line):
            line=f"{indent}plan_std_2: {json.dumps(std[lang],ensure_ascii=False)},\n"
        elif lang and re.search(r'\bplan_prem_2\s*:',line):
            line=f"{indent}plan_prem_2: {json.dumps(prem[lang],ensure_ascii=False)},\n"
        out.append(line)
    return ''.join(out)
rw('public/js/i18n.js',i18n)

def faq(s):
    s=s.replace("Trois paliers sans engagement, score de confiance minimum 82/100 pour Standard et Premium, 75/100 pour Elite-VIP : Standard (jusqu'à 3 signaux/jour, sélection la plus stricte du jour), Premium (jusqu'à 10 signaux/jour, sélection élargie, inclut Standard), Elite/VIP (jusqu'à 30 signaux/jour, tout le vivier diffusable, inclut Premium).","Deux abonnements sans engagement : Standard à 4,90 €/mois (jusqu'à 3 signaux/jour) et Premium à 14,90 €/mois (jusqu'à 10 signaux/jour, inclut Standard). Les signaux football concernent Over/Under 2,5 et nécessitent au moins 4 IA sur 5 d'accord.")
    s=s.replace("L'analyse du jour (pick quotidien) est publiée vers 12h (heure de Paris). Les analyses Live IA sont disponibles en temps réel pendant les matchs en direct, dès que la cote réelle du marché entre dans la fenêtre jouable (1.30 à 2.50).","Le pick gratuit est publié lorsqu'une sélection gratuite est disponible. Les analyses Live IA football sont prises entre la 15e et la 40e minute et un signal Over/Under 2,5 n'est validé qu'avec au moins 4 IA sur 5 d'accord.")
    s=s.replace("La sélection se fait sur la cote réelle du marché, pas sur la minute de jeu : un match n'est proposé que si sa cote réelle se situe entre 1.30 et 2.50. En dessous, il n'y a plus de valeur ; au-dessus, l'issue est trop incertaine. Un match trop avancé ou déjà plié voit naturellement sa cote sortir de cette fenêtre.","Un match n'est analysable que s'il appartient au périmètre football retenu, se trouve entre la 15e et la 40e minute et dispose de données exploitables. Le signal Over/Under 2,5 n'est publié qu'avec au moins 4 IA sur 5 d'accord.")
    s=s.replace('      Score de confiance minimum 82/100 pour Standard et Premium, 75/100 pour Elite-VIP.<br>\n','      Deux formules payantes, sans engagement.<br>\n')
    s=s.replace("      <strong>Standard</strong> — jusqu'à 3 signaux/jour, sélection la plus stricte du jour, Telegram Standard.<br>\n","      <strong>Standard — 4,90 €/mois</strong> — jusqu'à 3 signaux/jour, football Over/Under 2,5, accord minimum 4 IA sur 5.<br>\n")
    s=s.replace("      <strong>Premium</strong> — jusqu'à 10 signaux/jour, sélection élargie, Telegram Premium, inclut Standard.<br>\n","      <strong>Premium — 14,90 €/mois</strong> — jusqu'à 10 signaux/jour, football Over/Under 2,5, accord minimum 4 IA sur 5, inclut Standard.<br>\n")
    s=re.sub(r'^\s*<strong>Elite / VIP</strong>[^\n]*\n','',s,flags=re.M)
    s=s.replace("L'analyse du jour (pick quotidien) est publiée vers 12h (heure de Paris). Les analyses Live IA sont disponibles en temps réel pendant les matchs en direct, tant que la cote réelle chez un opérateur agréé reste dans une fourchette jouable — un match déjà plié voit sa cote sortir de cette fourchette et n'est plus proposé.","Le pick gratuit est publié lorsqu'une sélection gratuite est disponible. En Live IA, le produit football se concentre sur la 15e à la 40e minute, avec Over/Under 2,5 et un accord minimum de 4 IA sur 5.")
    s=s.replace("La sélection se fait sur la cote réelle chez un opérateur agréé (entre 1.30 et 2.50), pas sur la minute de jeu. Un match à finalité déjà connue (écart de 3 buts ou plus) est aussi automatiquement écarté.","Un match peut être écarté s'il est hors périmètre, hors de la fenêtre 15e-40e minute, si les données sont insuffisantes ou si le Concile n'obtient pas au moins 4 votes sur 5 sur Over/Under 2,5.")
    return s
rw('public/faq.html',faq)

def perf(s):
    s=s.replace('Filtrable par palier.','Filtrable par formule.')
    s=re.sub(r'^\s*<div class="tier-tab" data-tier="elite"[^\n]*\n','',s,flags=re.M)
    s=s.replace('Règle commune aux trois paliers :','Règle commune aux deux formules payantes :')
    s=s.replace("if (tier === 'premium') return a.tier === 'standard' || a.tier === 'premium';","if (tier === 'premium') return a.tier === 'standard' || a.tier === 'premium' || a.tier === 'elite';")
    s=re.sub(r"\n\s*if \(tier === 'elite'\) return a\.tier === 'standard' \|\| a\.tier === 'premium' \|\| a\.tier === 'elite';",'',s)
    s=s.replace("if (t === 'elite') return '🥉 Elite';","if (t === 'elite') return '🥈 Premium';")
    return s
rw('public/performances.html',perf)

def cgv(s):
    s=s.replace('Version du 14 juillet 2026','Version du 30 août 2026').replace('selon trois formules :','selon deux formules payantes :')
    s=s.replace("<tr><td>Standard</td><td>4,90 €/mois</td><td>Récurrent</td><td>Jusqu'à 3 sélections/jour, score de confiance minimum 82/100, sélection la plus stricte du jour</td></tr>","<tr><td>Standard</td><td>4,90 €/mois</td><td>Récurrent</td><td>Jusqu'à 3 signaux/jour, football Over/Under 2,5, accord minimum 4 IA sur 5</td></tr>")
    s=s.replace("<tr><td>Premium</td><td>14,90 €/mois</td><td>Récurrent</td><td>Jusqu'à 10 sélections/jour, score de confiance minimum 82/100, sélection élargie, inclut Standard</td></tr>","<tr><td>Premium</td><td>14,90 €/mois</td><td>Récurrent</td><td>Jusqu'à 10 signaux/jour, football Over/Under 2,5, accord minimum 4 IA sur 5, inclut Standard</td></tr>")
    s=re.sub(r'\s*<tr><td>Elite-VIP</td><td>29,90 €/mois</td>.*?</tr>\n','\n',s,count=1)
    return s
rw('public/cgv.html',cgv)

def prono(s):
    s=s.replace('Des paliers payants (Standard, Premium, Elite) donnent accès à davantage de signaux, en football.','Deux abonnements payants, Standard et Premium, donnent accès à davantage de signaux football Over/Under 2,5.')
    s=s.replace("Des paliers payants (Standard, Premium, Elite) élargissent l'accès à davantage de signaux, en football.","Deux abonnements payants, Standard et Premium, élargissent l'accès aux signaux football Over/Under 2,5.")
    return s
rw('public/pronostic-ia.html',prono)

def lead(s):
    return s.replace('Reçois ce que le Concile aurait fait gagner, sans rien payer','Reçois les résultats vérifiés du Concile, sans rien payer').replace("Laisse ton email : tu recevras régulièrement un récap de ce qu'auraient rapporté les sélections publiées la veille — pour te faire une idée avant de t'abonner.","Laisse ton email : tu recevras un récap des sélections réellement publiées, gagnées comme perdues, pour évaluer le service avant de t'abonner.")
rw('public/resultats-quotidiens.html',lead)

def dashboard(s):
    s=s.replace('Performance par palier','Performance par formule')
    s=s.replace("var planLabel = isElite ? 'Elite/VIP' : plan === 'premium' ? 'Premium' : plan === 'standard' ? 'Standard' : 'Gratuit';","var planLabel = isElite ? 'Premium' : plan === 'premium' ? 'Premium' : plan === 'standard' ? 'Standard' : 'Gratuit';")
    s=s.replace("planEl.className = 'dash-plan ' + (isElite ? 'elite' : plan === 'premium' ? 'premium' : 'standard');","planEl.className = 'dash-plan ' + (isElite ? 'premium' : plan === 'premium' ? 'premium' : 'standard');")
    s=s.replace("document.getElementById('upgrade-text').textContent = 'Passe Premium pour 10 analyses/jour et une sélection élargie.';","document.getElementById('upgrade-text').textContent = 'Passe Premium pour jusqu’à 10 signaux/jour et une sélection élargie.';")
    old="""    } else if (plan === 'premium') {\n      document.getElementById('upgrade-box').style.display = 'block';\n      document.getElementById('upgrade-text').textContent = 'Passe à Elite pour 30 analyses/jour et les alertes Signal Fort.';\n    } else {"""
    new="""    } else if (plan === 'premium' || isElite) {\n      document.getElementById('upgrade-box').style.display = 'none';\n    } else {"""
    if old in s: s=s.replace(old,new,1)
    s=s.replace("var order = ['standard', 'premium', 'elite'];","var order = ['standard', 'premium'];")
    s=s.replace("    elite:    { label: '🟠 Elite' }\n",'')
    s=s.replace("var UPSELL = { premium: 'Réservé aux membres Pro et Elite', elite: 'Réservé aux membres Elite' };","var UPSELL = { premium: 'Réservé aux membres Premium' };")
    s=s.replace("if (status === 'elite' || status === 'vip') note.textContent = 'Accès complet aux 3 paliers, matchs « IA seulement » inclus.';","if (status === 'elite' || status === 'vip') note.textContent = 'Accès Premium complet.';")
    s=s.replace("else if (status === 'premium') note.textContent = 'Tu vois Standard + Premium. Elite débloque tout le volume, y compris les analyses « IA seulement ».';","else if (status === 'premium') note.textContent = 'Tu vois Standard + Premium.';")
    s=s.replace("else if (status === 'standard') note.textContent = 'Tu vois le palier Standard. Premium et Elite débloquent plus de volume d\\'analyses.';","else if (status === 'standard') note.textContent = 'Tu vois Standard. Premium débloque une sélection élargie.';")
    old2="""document.getElementById('auth-pass').addEventListener('keydown', function(e) {\n  if (e.key === 'Enter') submitAuth();\n});"""
    new2="""var legacyAuthPass = document.getElementById('auth-pass');\nif (legacyAuthPass && typeof submitAuth === 'function') {\n  legacyAuthPass.addEventListener('keydown', function(e) { if (e.key === 'Enter') submitAuth(); });\n}"""
    if old2 in s: s=s.replace(old2,new2,1)
    return s
rw('public/dashboard.html',dashboard)

def api(s):
    return s.replace('Les membres Standard, Premium &amp; Elite reçoivent les analyses Live IA et les signaux du Concile en temps réel.','Les membres Standard et Premium reçoivent les analyses Live IA et les signaux du Concile en temps réel.')
rw('scripts/api_server.js',api)
print('OK — contenu conversion V2 préparé')
PY

node --check public/js/i18n.js
node --check scripts/api_server.js

python3 - <<'PY'
from pathlib import Path
import re,sys
htmls=['public/index.html','public/faq.html','public/performances.html','public/cgv.html','public/pronostic-ia.html','public/resultats-quotidiens.html','public/dashboard.html']
for f in htmls:
    s=Path(f).read_text(encoding='utf-8')
    jsonld='\n'.join(re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',s,flags=re.I|re.S))
    visible=re.sub(r'<!--.*?-->',' ',s,flags=re.S)
    visible=re.sub(r'<style\b.*?</style>',' ',visible,flags=re.I|re.S)
    visible=re.sub(r'<script\b.*?</script>',' ',visible,flags=re.I|re.S)
    check=visible+'\n'+jsonld
    bad=re.search(r'Elite-VIP|Elite / VIP|29,90|29\.90|🥉\s*Elite|Trois paliers',check,re.I)
    if bad:
        print('TEXTE CLIENT INTERDIT',f,bad.group(0)); sys.exit(1)

i=Path('public/js/i18n.js').read_text(encoding='utf-8')
if re.search(r'plan_elite|plan_btn_elite|ELITE-VIP|30 selections/day|30 sélections/jour|Hasta 30|Até 30|30 ',i,re.I):
    print('Ancienne offre encore dans i18n'); sys.exit(1)

d=Path('public/dashboard.html').read_text(encoding='utf-8')
for x in ['Passe à Elite','🟠 Elite','Elite débloque','Premium et Elite','Réservé aux membres Elite']:
    if x in d: print('Dashboard ancien texte:',x); sys.exit(1)

p=Path('public/performances.html').read_text(encoding='utf-8')
if 'data-tier="elite"' in p or "return '🥉 Elite'" in p:
    print('Elite encore visible dans performances'); sys.exit(1)

api=Path('scripts/api_server.js').read_text(encoding='utf-8')
if 'Standard, Premium &amp; Elite reçoivent' in api:
    print('Ancienne offre encore dans SEO dynamique'); sys.exit(1)
print('VALIDATION_TEXTES_CLIENT=OK')
PY

grep -q 'TLM-CONVERSION-PROOF-FIRST-20260830' public/index.html
grep -q '4 IA sur 5' public/faq.html
grep -q 'deux formules payantes' public/cgv.html
grep -q 'Performance par formule' public/dashboard.html

echo '[build] site + api uniquement'
docker compose up -d --no-deps --build site api
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1 && curl -fsS https://www.touslesmatchs.com/ >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3001/health >/dev/null
for u in / /faq /performances /cgv /pronostic-ia /resultats-quotidiens /dashboard /live-ia; do curl -fsS "https://www.touslesmatchs.com$u" >/dev/null; done

# Vérifie que le filtre football V3 survit au rebuild API.
curl -fsS http://127.0.0.1:3001/live-matches > /tmp/tlm-conversion-v2-live.json
python3 - <<'PY'
import json,re
D=json.load(open('/tmp/tlm-conversion-v2-live.json'))
rows=D.get('matches') or D.get('live') or (D if isinstance(D,list) else [])
pat=re.compile(r'\b(?:nfl|american football|usa|united states|canada|costa[ -]?rica|nicaragua|ecuador|chile|paraguay|afghanistan|iraq|algeria|tunisia|morocco|maroc|kazakhstan|azerbaijan|uzbekistan)\b',re.I)
bad=[]
for m in rows:
    text=' '.join(str(m.get(k) or '') for k in ('sport','competition','country','home','away'))
    if pat.search(text): bad.append(text)
print('LIVE_MATCHS=',len(rows),'LIVE_HORS_PERIMETRE=',len(bad))
if bad: raise SystemExit('Le filtre football V3 a régressé')
PY

trap - ERR
echo '=== FINAL CONVERSION CONTENT V2 ==='
echo 'STATUS=OK'
echo 'OFFRES=GRATUIT + STANDARD_4.90 + PREMIUM_14.90'
echo 'ELITE_VISIBLE=0 (compatibilite historique conservee en interne)'
echo 'PREUVE=REMONTÉE'
echo 'FAQ_CGV_PERFORMANCES_DASHBOARD_PRONOSTIC_IA=ALIGNES'
echo 'I18N=FR_EN_ES_PT_RU_ZH_ALIGNES'
echo 'SEO_DYNAMIQUE=STANDARD_PREMIUM'
echo 'DASHBOARD_UPSELL_ELITE=SUPPRIME'
echo 'DASHBOARD_LEGACY_JS=SECURISE'
echo 'MOTEUR_IA_TELEGRAM_HERMES_STRIPE_BREVO_DB=INCHANGES'
echo "SAUVEGARDE=$BACKUP"
