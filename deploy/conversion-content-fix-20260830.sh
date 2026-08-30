#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-conversion-content-$STAMP"
FILES=(public/index.html public/js/i18n.js public/faq.html public/performances.html public/cgv.html public/pronostic-ia.html public/resultats-quotidiens.html)
mkdir -p "$BACKUP"
for f in "${FILES[@]}"; do mkdir -p "$BACKUP/$(dirname "$f")"; cp -a "$f" "$BACKUP/$f"; done
rollback(){ for f in "${FILES[@]}"; do cp -a "$BACKUP/$f" "$f"; done; docker compose up -d --no-deps --build site >/dev/null 2>&1 || true; }
trap rollback ERR

python3 - <<'PY'
from pathlib import Path
import re

def rw(p,fn):
 s=Path(p).read_text(encoding='utf-8'); s2=fn(s); Path(p).write_text(s2,encoding='utf-8')

def home(s):
 s=s.replace('Les volumes affichés (3, 10 ou 30 par jour)','Les volumes affichés (3 ou 10 par jour)')
 s=s.replace('Score de confiance minimum 82/100, sélection la plus stricte du jour',"Minimum 4 IA sur 5 d'accord sur Over/Under 2,5")
 s=s.replace('Score de confiance minimum 82/100, sélection élargie',"Minimum 4 IA sur 5 d'accord · inclut Standard")
 if 'TLM-CONVERSION-PROOF-FIRST-20260830' not in s:
  a=s.find('  <!-- RANGEE 1bis : MATCHS A VENIR'); b=s.find('  <!-- RANGEE 2 : PREUVES -->'); c=s.find('  <!-- RANGEE 2.5',b)
  if min(a,b,c)<0 or not(a<b<c): raise SystemExit('blocs home introuvables')
  up=s[a:b]; proof='  <!-- TLM-CONVERSION-PROOF-FIRST-20260830 -->\n'+s[b:c]
  s=s[:a]+proof+up+s[c:]
 return s
rw('public/index.html',home)

def i18n(s):
 out=[]
 for line in s.splitlines(True):
  if re.search(r'\bplan_elite(?:_1|_2)?\s*:',line) or re.search(r'\bplan_btn_elite\s*:',line): continue
  line=line.replace('Score de confiance minimum 82/100, sélection la plus stricte du jour',"Minimum 4 IA sur 5 d'accord sur Over/Under 2,5")
  line=line.replace('Score de confiance minimum 82/100, sélection élargie',"Minimum 4 IA sur 5 d'accord · inclut Standard")
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
 return s.replace("Reçois ce que le Concile aurait fait gagner, sans rien payer","Reçois les résultats vérifiés du Concile, sans rien payer").replace("Laisse ton email : tu recevras régulièrement un récap de ce qu'auraient rapporté les sélections publiées la veille — pour te faire une idée avant de t'abonner.","Laisse ton email : tu recevras un récap des sélections réellement publiées, gagnées comme perdues, pour évaluer le service avant de t'abonner.")
rw('public/resultats-quotidiens.html',lead)
print('OK')
PY

node --check public/js/i18n.js
if grep -RniE 'Elite-VIP|Elite / VIP|29,90|29\.90|data-tier="elite"|🥉 Elite|Trois paliers|3, 10 ou 30' public/index.html public/js/i18n.js public/faq.html public/performances.html public/cgv.html public/pronostic-ia.html; then exit 1; fi
grep -q 'TLM-CONVERSION-PROOF-FIRST-20260830' public/index.html
grep -q '4 IA sur 5' public/faq.html
grep -q 'deux formules payantes' public/cgv.html

docker compose up -d --no-deps --build site
for i in $(seq 1 30); do curl -fsS https://www.touslesmatchs.com/ >/dev/null 2>&1 && break; sleep 1; done
for u in / /faq /performances /cgv /pronostic-ia /resultats-quotidiens; do curl -fsS "https://www.touslesmatchs.com$u" >/dev/null; done
trap - ERR
echo '=== FINAL CONVERSION CONTENT ==='
echo 'STATUS=OK'
echo 'OFFRES=GRATUIT + STANDARD_4.90 + PREMIUM_14.90'
echo 'ELITE_CLIENT=SUPPRIME'
echo 'PREUVE=REMONTÉE'
echo 'FAQ_CGV_PERFORMANCES=ALIGNEES'
echo 'MOTEUR_IA_TELEGRAM_HERMES_STRIPE_BREVO_DB=INCHANGES'
echo "SAUVEGARDE=$BACKUP"
