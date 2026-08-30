#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-remove-unibet-maintenance-v2-$STAMP"
FILES=(public/index.html public/app.html)
mkdir -p "$BACKUP/public"
for f in "${FILES[@]}"; do cp -a "$f" "$BACKUP/$f"; done

rollback(){
  echo "ERREUR — restauration automatique du site et de l'application"
  for f in "${FILES[@]}"; do cp -a "$BACKUP/$f" "$f"; done
  docker compose up -d --no-deps --build site >/dev/null 2>&1 || true
}
trap rollback ERR

echo "[1/5] Sauvegarde OK: $BACKUP"

echo "[2/5] Suppression complète des encarts"
python3 - <<'PY'
from pathlib import Path
import re

FILES=[Path('public/index.html'), Path('public/app.html')]

# Paires début/fin permettant de supprimer le conteneur COMMUN complet,
# plutôt que seulement le petit sous-bloc du titre.
RANGES=[
    ('Comparer la cote chez notre partenaire', 'Jeu responsable'),
    ('Mise à jour importante du moteur IA', 'résultats de maintenance restent séparés'),
    ('Mise à jour importante TousLesMatchs', 'nouveau Conseil IA spécialisé Over/Under 2,5'),
]

ORPHANS=[
    'Comparer la cote chez notre partenaire',
    'Mise à jour importante du moteur IA',
    'Pendant cette période, TousLesMatchs a continué ses analyses',
    'Simulation interne — aucun de ces pronostics',
    "Aucun pronostic client diffusé pendant cette phase de maintenance",
    'Les résultats de maintenance restent séparés',
    'Mise à jour importante TousLesMatchs',
    "Ces derniers jours, une mise à jour importante du moteur IA et du système de diffusion Telegram",
    "Les analyses ont continué pendant cette maintenance",
    'Le service reprend progressivement avec le nouveau Conseil IA spécialisé Over/Under 2,5',
    'Mise à jour du Conseil IA et de la diffusion Telegram',
]

TAGS=('div','section','article','aside','main')
NODE_TAGS=('div','section','article','aside','p','li','span','strong','small')

def matching_end(src, start, tag):
    pat=re.compile(r'</?'+tag+r'\b[^>]*>', re.I)
    depth=0
    for m in pat.finditer(src,start):
        tok=m.group(0)
        if tok.startswith('</'):
            depth-=1
            if depth==0:
                return m.end()
        else:
            depth+=1
    return -1

def remove_common_container(src, first, last):
    p1=src.find(first)
    if p1 < 0:
        return src,0
    p2=src.find(last,p1)
    if p2 < 0:
        return src,0
    candidates=[]
    for tag in TAGS:
        for m in re.finditer(r'<'+tag+r'\b[^>]*>',src[:p1],re.I):
            candidates.append((m.start(),tag))
    candidates.sort(reverse=True)
    for start,tag in candidates:
        end=matching_end(src,start,tag)
        if end > p2:
            return src[:start]+src[end:],1
    return src,0

def remove_smallest_node(src, phrase):
    pos=src.find(phrase)
    if pos < 0:
        return src,0
    candidates=[]
    for tag in NODE_TAGS:
        for m in re.finditer(r'<'+tag+r'\b[^>]*>',src[:pos],re.I):
            candidates.append((m.start(),tag))
    candidates.sort(reverse=True)
    for start,tag in candidates:
        end=matching_end(src,start,tag)
        if end > pos:
            return src[:start]+src[end:],1
    return src,0

def clean(src):
    n=0
    # 1) Retirer les trois ensembles complets par conteneur commun.
    for first,last in RANGES:
        while first in src:
            new,k=remove_common_container(src,first,last)
            if not k: break
            src=new; n+=k

    # 2) Retirer d'éventuels éléments frères restants, phrase par phrase.
    for phrase in ORPHANS:
        while phrase in src:
            new,k=remove_smallest_node(src,phrase)
            if not k: break
            src=new; n+=k

    # 3) Cas compact/injecté dans une chaîne JS sur une seule ligne.
    compact=[
        r'[^\n]{0,900}Comparer la cote chez notre partenaire[^\n]{0,1800}Jeu responsable[^\n]{0,500}',
        r'[^\n]{0,1200}Mise à jour importante du moteur IA[^\n]{0,9000}résultats de maintenance restent séparés[^\n]{0,1200}',
        r'[^\n]{0,1200}Mise à jour importante TousLesMatchs[^\n]{0,7000}nouveau Conseil IA spécialisé Over/Under 2,5[^\n]{0,1200}',
        r'[^\n]{0,600}Simulation interne — aucun de ces pronostics[^\n]{0,1200}',
        r'[^\n]{0,600}Aucun pronostic client diffusé pendant cette phase de maintenance[^\n]{0,1200}',
    ]
    for pat in compact:
        src,k=re.subn(pat,'',src,flags=re.I)
        n+=k
    return src,n

for p in FILES:
    s=p.read_text(encoding='utf-8')
    before=s
    s,n=clean(s)
    p.write_text(s,encoding='utf-8')
    print(f'{p}: suppressions={n}, octets={len(before)}->{len(s)}')
PY

echo "[3/5] Vérifications locales"
python3 - <<'PY'
from pathlib import Path
bad=[
 'Comparer la cote chez notre partenaire',
 'Mise à jour importante du moteur IA',
 'Pendant cette période, TousLesMatchs a continué ses analyses',
 'Simulation interne — aucun de ces pronostics',
 'Aucun pronostic client diffusé pendant cette phase de maintenance',
 'résultats de maintenance restent séparés',
 'Mise à jour importante TousLesMatchs',
 'Ces derniers jours, une mise à jour importante du moteur IA et du système de diffusion Telegram',
 'Les analyses ont continué pendant cette maintenance',
 'Le service reprend progressivement avec le nouveau Conseil IA spécialisé Over/Under 2,5',
 'Mise à jour du Conseil IA et de la diffusion Telegram',
]
for f in ('public/index.html','public/app.html'):
 s=Path(f).read_text(encoding='utf-8')
 left=[x for x in bad if x.lower() in s.lower()]
 print(f,'RESTES=',left)
 if left: raise SystemExit(f'Texte demandé encore présent dans {f}')
print('TEXTES_SUPPRIMES=OK')
PY

for f in "${FILES[@]}"; do
  grep -qi '</body>' "$f"
  grep -qi '</html>' "$f"
done

echo "[4/5] Rebuild du SEUL service site"
docker compose up -d --no-deps --build site
for i in $(seq 1 30); do
  if curl -fsS https://www.touslesmatchs.com/ >/dev/null 2>&1 && curl -fsS https://www.touslesmatchs.com/app.html >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS https://www.touslesmatchs.com/ >/tmp/tlm-home-remove-v2.html
curl -fsS https://www.touslesmatchs.com/app.html >/tmp/tlm-app-remove-v2.html

echo "[5/5] Vérification publique"
python3 - <<'PY'
from pathlib import Path
bad=[
 'Comparer la cote chez notre partenaire',
 'Mise à jour importante du moteur IA',
 'Simulation interne — aucun de ces pronostics',
 'Aucun pronostic client diffusé pendant cette phase de maintenance',
 'résultats de maintenance restent séparés',
 'Mise à jour importante TousLesMatchs',
 'Le service reprend progressivement avec le nouveau Conseil IA spécialisé Over/Under 2,5',
]
for f in ('/tmp/tlm-home-remove-v2.html','/tmp/tlm-app-remove-v2.html'):
 s=Path(f).read_text(encoding='utf-8')
 left=[x for x in bad if x.lower() in s.lower()]
 print(Path(f).name,'RESTES=',left)
 if left: raise SystemExit('Texte encore servi publiquement')
print('PUBLIC=OK')
PY

trap - ERR
echo '=== FINAL NETTOYAGE SITE + APP V2 ==='
echo 'STATUS=OK'
echo 'UNIBET_COMPARE_BANNER=SUPPRIME'
echo 'MAINTENANCE_27_28_29_AOUT=SUPPRIMEE'
echo 'SIMULATIONS_MAINTENANCE=SUPPRIMEES'
echo 'SITE=OK APP=OK'
echo 'MOTEUR_IA_TELEGRAM_HERMES_STRIPE_BREVO_DB=INCHANGES'
echo "SAUVEGARDE=$BACKUP"
