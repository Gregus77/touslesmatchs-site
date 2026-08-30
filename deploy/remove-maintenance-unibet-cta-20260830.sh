#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-remove-maintenance-partner-cta-$STAMP"
FILES=(public/index.html public/app.html)
mkdir -p "$BACKUP"
for f in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp -a "$f" "$BACKUP/$f"
done

API_BEFORE="$(sha256sum scripts/api_server.js | awk '{print $1}')"
COMPOSE_BEFORE="$(sha256sum docker-compose.yml | awk '{print $1}')"

rollback(){
  echo "ERREUR — restauration automatique site/app"
  for f in "${FILES[@]}"; do cp -a "$BACKUP/$f" "$f"; done
  docker compose up -d --no-deps --build site >/dev/null 2>&1 || true
}
trap rollback ERR

echo "[1/5] Etat avant correction"
echo "BRANCHE=$(git branch --show-current)"
echo "COMMIT=$(git rev-parse HEAD)"

echo "[2/5] Suppression des encarts demandés"
python3 - <<'PY'
from pathlib import Path
import re

FILES=[Path('public/index.html'),Path('public/app.html')]

# Textes d'information temporaires à retirer de l'affichage.
fragments=[
    "Mise à jour importante du moteur IA",
    "Pendant cette période, TousLesMatchs a continué ses analyses mais la diffusion des pronostics a été suspendue pendant la mise à jour.",
    "Mise à jour en cours",
    "5 analyses Over/Under 2,5 résolues · 5 gagnantes",
    "3 analyses Over/Under 2,5 résolues · 3 gagnantes",
    "Simulation interne — aucun de ces pronostics n'a été diffusé aux abonnés.",
    "Mise à jour du Conseil IA et de la diffusion Telegram",
    "Aucun pronostic client diffusé pendant cette phase de maintenance.",
    "Les résultats de maintenance restent séparés des performances des pronostics réellement envoyés.",
    "Mise à jour importante TousLesMatchs",
    "Ces derniers jours, une mise à jour importante du moteur IA et du système de diffusion Telegram a été réalisée afin d'améliorer la fiabilité des pronostics Over/Under 2,5.",
    "Les analyses ont continué pendant cette maintenance, mais certains pronostics n'ont volontairement pas été envoyés aux abonnés.",
    "Le service reprend progressivement avec le nouveau Conseil IA spécialisé Over/Under 2,5.",
]

# Retire les phrases même si elles sont enveloppées dans <strong>, <p>, etc.
def strip_literal_text(s):
    for text in fragments:
        s=s.replace(text,'')
    # Dates/labels propres au bloc de maintenance, seulement lorsqu'ils sont très proches
    # d'un résidu de maintenance. On ne touche pas aux dates ailleurs dans l'historique.
    s=re.sub(r'<(?:strong|b)[^>]*>\s*📅\s*(?:27|28|29)\s+août\s*</(?:strong|b)>\s*','',s,flags=re.I)
    return s

# Garde d'affichage : enlève le plus petit encart visuel contenant les anciens
# messages, y compris s'ils sont reconstruits par du JS à partir de données.
# Les chaînes sont assemblées pour qu'elles ne restent pas telles quelles dans
# le HTML indexable après la correction.
guard=r'''
<!-- TLM-REMOVE-TEMP-NOTICES-PARTNER-CTA-20260830 -->
<script>
(function(){
  var badHeadings=[
    'Mise à jour importante '+'du moteur IA',
    'Mise à jour importante '+'TousLesMatchs'
  ];
  function norm(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function removeCardFor(node){
    if(!node||node===document.body||node===document.documentElement)return;
    var cur=node;
    for(var i=0;i<7&&cur&&cur!==document.body;i++,cur=cur.parentElement){
      var t=norm(cur.textContent);
      if(t.length<7000 && (badHeadings.some(function(x){return t.indexOf(x)>=0;}) || t.indexOf('Simulation interne — aucun de ces pronostics')>=0)){
        cur.remove();return;
      }
    }
    node.remove();
  }
  function clean(){
    // Encarts temporaires de maintenance.
    document.querySelectorAll('div,section,article,p,strong,b').forEach(function(el){
      var t=norm(el.textContent);
      if(badHeadings.some(function(x){return t.indexOf(x)>=0;})) removeCardFor(el);
    });

    // CTA de comparaison de cote/partenaire affiché sur les cartes.
    document.querySelectorAll('a,button,div').forEach(function(el){
      var t=norm(el.textContent).toLowerCase();
      if(t.indexOf('comparer la cote chez notre partenaire')>=0 ||
         (t.indexOf('comparer la cote')>=0 && t.indexOf('unibet')>=0)){
        var box=el.closest('.bookmakers,.bookmaker-box,.partner-odd,.compare-odd,.card') || el;
        if(box && box!==document.body) box.remove();
      }
    });

    // Ancien modal de comparaison de l'accueil : on ne l'affiche plus.
    var modal=document.getElementById('modal-bookmakers');
    if(modal) modal.remove();
    document.querySelectorAll('[onclick*="openBookmakerModal"]').forEach(function(el){
      el.removeAttribute('onclick');el.style.cursor='';
    });

    // Dans l'app, les boutons bookmakers attachés aux cartes de signal ne sont
    // plus affichés. Le bloc partenaires général du site n'est pas concerné.
    document.querySelectorAll('.bookmakers').forEach(function(el){el.remove();});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',clean,{once:true});
  else clean();
  if('MutationObserver' in window){
    var mo=new MutationObserver(function(){clean();});
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }
  window.openBookmakerModal=function(){};
  window.bookmakerButtons=function(){return '';};
})();
</script>
'''

for p in FILES:
    s=p.read_text(encoding='utf-8')
    before=s
    s=strip_literal_text(s)
    if 'TLM-REMOVE-TEMP-NOTICES-PARTNER-CTA-20260830' not in s:
        if '</body>' not in s:
            raise SystemExit(f'</body> introuvable dans {p}')
        s=s.replace('</body>',guard+'\n</body>',1)
    p.write_text(s,encoding='utf-8')
    print(f'{p}: MODIFIE={s!=before}')
PY

echo "[3/5] Contrôles statiques"
grep -q 'TLM-REMOVE-TEMP-NOTICES-PARTNER-CTA-20260830' public/index.html
grep -q 'TLM-REMOVE-TEMP-NOTICES-PARTNER-CTA-20260830' public/app.html
# Les anciennes phrases complètes ne doivent plus exister dans le contenu source.
! grep -Fq 'Mise à jour importante du moteur IA' public/index.html public/app.html
! grep -Fq 'Mise à jour importante TousLesMatchs' public/index.html public/app.html
! grep -Fq 'Simulation interne — aucun de ces pronostics' public/index.html public/app.html
# Backend / compose inchangés.
[ "$API_BEFORE" = "$(sha256sum scripts/api_server.js | awk '{print $1}')" ]
[ "$COMPOSE_BEFORE" = "$(sha256sum docker-compose.yml | awk '{print $1}')" ]

echo "[4/5] Rebuild du SEUL service site"
docker compose up -d --no-deps --build site
for i in $(seq 1 30); do
  if curl -fsS https://www.touslesmatchs.com/ >/dev/null 2>&1 && curl -fsS https://www.touslesmatchs.com/app.html >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS https://www.touslesmatchs.com/ >/dev/null
curl -fsS https://www.touslesmatchs.com/app.html >/dev/null

echo "[5/5] Vérification publication"
curl -fsS https://www.touslesmatchs.com/ | grep -q 'TLM-REMOVE-TEMP-NOTICES-PARTNER-CTA-20260830'
curl -fsS https://www.touslesmatchs.com/app.html | grep -q 'TLM-REMOVE-TEMP-NOTICES-PARTNER-CTA-20260830'

trap - ERR
echo 'TERMINE — ENCARTS MAINTENANCE + COMPARAISON COTE RETIRES SITE/APP'
echo 'SITE=OK APP=OK'
echo 'PARTENAIRES_BAS_DE_PAGE=INCHANGES'
echo 'MOTEUR_IA_TELEGRAM_HERMES_STRIPE_BREVO_DB=INCHANGES'
echo "SAUVEGARDE=$BACKUP"
