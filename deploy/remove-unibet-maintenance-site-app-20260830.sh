#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-remove-unibet-maintenance-$STAMP"
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

echo "[2/5] Suppression ciblée des encarts"
python3 - <<'PY'
from pathlib import Path
import re

FILES=[Path('public/index.html'),Path('public/app.html')]

PHRASES=[
    'Comparer la cote chez notre partenaire',
    'Mise à jour importante du moteur IA',
    'Mise à jour importante TousLesMatchs',
]

def remove_balanced_block(src, phrase):
    """Supprime le plus petit bloc div/section/article qui contient phrase."""
    pos=src.find(phrase)
    if pos < 0:
        return src,0
    starts=[]
    for tag in ('div','section','article','aside'):
        for m in re.finditer(r'<'+tag+r'\b[^>]*>',src[:pos],re.I):
            starts.append((m.start(),tag,m.end()))
    starts.sort(reverse=True)
    for start,tag,open_end in starts:
        # Analyse sommaire des balises du même type pour trouver la fermeture équilibrée.
        pat=re.compile(r'</?'+tag+r'\b[^>]*>',re.I)
        depth=0
        for m in pat.finditer(src,start):
            token=m.group(0)
            if token.startswith('</'):
                depth-=1
                if depth==0:
                    end=m.end()
                    if start <= pos < end:
                        return src[:start]+src[end:],1
                    break
            else:
                depth+=1
    return src,0

def clean(src):
    changed=0
    # Supprime les blocs rendus contenant les intitulés demandés.
    for phrase in PHRASES:
        while phrase in src:
            new,n=remove_balanced_block(src,phrase)
            if not n:
                break
            src=new; changed+=n

    # Cas où le CTA partenaire serait injecté par une chaîne JavaScript/HTML compacte.
    patterns=[
        r'[^\n]{0,600}Comparer la cote chez notre partenaire[^\n]{0,900}UNIBET[^\n]{0,600}',
        r'[^\n]{0,900}unibet\.fr/inscription/\?campaign=210726(?:&amp;|\\&|&)parrain=5EBF919DF1008254[^\n]{0,900}',
    ]
    for pat in patterns:
        src,n=re.subn(pat,'',src,flags=re.I)
        changed+=n

    # Filet de sécurité pour les encarts maintenance encodés dans une chaîne JS.
    maintenance_patterns=[
        r'[^\n]{0,1200}Mise à jour importante du moteur IA[^\n]{0,6000}résultats de maintenance restent séparés[^\n]{0,1200}',
        r'[^\n]{0,1200}Mise à jour importante TousLesMatchs[^\n]{0,5000}nouveau Conseil IA spécialisé Over/Under 2,5[^\n]{0,1200}',
    ]
    for pat in maintenance_patterns:
        src,n=re.subn(pat,'',src,flags=re.I)
        changed+=n
    return src,changed

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
 'Mise à jour importante TousLesMatchs',
 'Simulation interne — aucun de ces pronostics',
 'Le service reprend progressivement avec le nouveau Conseil IA spécialisé Over/Under 2,5',
]
for f in ('public/index.html','public/app.html'):
 s=Path(f).read_text(encoding='utf-8')
 left=[x for x in bad if x in s]
 print(f, 'RESTES=',left)
 if left: raise SystemExit(f'Texte demandé encore présent dans {f}')
print('TEXTES_SUPPRIMES=OK')
PY

# Vérification très simple de structure : les documents doivent toujours contenir html/body fermants.
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
curl -fsS https://www.touslesmatchs.com/ >/tmp/tlm-home-after-remove.html
curl -fsS https://www.touslesmatchs.com/app.html >/tmp/tlm-app-after-remove.html

echo "[5/5] Vérification publique"
python3 - <<'PY'
from pathlib import Path
bad=[
 'Comparer la cote chez notre partenaire',
 'Mise à jour importante du moteur IA',
 'Mise à jour importante TousLesMatchs',
 'Simulation interne — aucun de ces pronostics',
]
for f in ('/tmp/tlm-home-after-remove.html','/tmp/tlm-app-after-remove.html'):
 s=Path(f).read_text(encoding='utf-8')
 left=[x for x in bad if x in s]
 print(Path(f).name,'RESTES=',left)
 if left: raise SystemExit('Texte encore servi publiquement')
print('PUBLIC=OK')
PY

trap - ERR
echo '=== FINAL NETTOYAGE SITE + APP ==='
echo 'STATUS=OK'
echo 'UNIBET_COMPARE_BANNER=SUPPRIME'
echo 'MAINTENANCE_27_28_29_AOUT=SUPPRIMEE'
echo 'SITE=OK APP=OK'
echo 'MOTEUR_IA_TELEGRAM_HERMES_STRIPE_BREVO_DB=INCHANGES'
echo "SAUVEGARDE=$BACKUP"
