#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-seo-i18n-caddy-$STAMP"
mkdir -p "$BACKUP"
cp -a Caddyfile "$BACKUP/Caddyfile"

CRIT=(public/index.html public/app.html public/live-ia.html scripts/api_server.js public/sitemap.xml public/robots.txt)
: > "$BACKUP/critical.before"
for f in "${CRIT[@]}"; do [ -f "$f" ] && sha256sum "$f" >> "$BACKUP/critical.before"; done

rollback(){
  echo 'ERREUR — restauration automatique du routage Caddy'
  cp -a "$BACKUP/Caddyfile" Caddyfile
  docker compose up -d --no-deps --build site >/dev/null 2>&1 || true
}
trap rollback ERR

echo "[1/6] Sauvegarde: $BACKUP"

echo '[2/6] Correction du fallback statique Caddy'
python3 - <<'PY'
from pathlib import Path
p=Path('Caddyfile')
s=p.read_text(encoding='utf-8')
marker='# TLM-SEO-I18N-DIR-INDEX-20260830'
if marker not in s:
    old='        try_files {path} {path}.html /index.html'
    new='''        # TLM-SEO-I18N-DIR-INDEX-20260830\n        # Les pages SEO multilingues sont des dossiers contenant index.html.\n        # On teste donc index.html AVANT le dossier lui-même, sinon Caddy\n        # retombe sur /index.html et sert à tort l’accueil français.\n        try_files {path}index.html {path}/index.html {path} {path}.html /index.html'''
    if old not in s:
        raise SystemExit('Ligne try_files attendue introuvable — aucune modification appliquée')
    s=s.replace(old,new,1)
    p.write_text(s,encoding='utf-8')
print('CADDY_PATCH=OK')
PY

echo '[3/6] Validation de la configuration avant déploiement'
docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile >/dev/null

echo '[4/6] Vérification qu’aucun fichier métier n’a changé'
: > "$BACKUP/critical.after"
for f in "${CRIT[@]}"; do [ -f "$f" ] && sha256sum "$f" >> "$BACKUP/critical.after"; done
cmp "$BACKUP/critical.before" "$BACKUP/critical.after"

echo '[5/6] Rebuild du SEUL service site'
docker compose up -d --no-deps --build site
for i in $(seq 1 30); do
  if curl -fsS https://www.touslesmatchs.com/ >/dev/null 2>&1; then break; fi
  sleep 1
done

echo '[6/6] Vérification publique des 6 langues'
python3 - <<'PY'
import subprocess,re,sys
checks=[
 ('/fr/pronostics-foot-aujourdhui/','fr','Pronostics'),
 ('/en/football-predictions-today/','en','Football'),
 ('/es/pronosticos-futbol-hoy/','es','Pronósticos'),
 ('/pt-br/palpites-futebol-hoje/','pt-BR','Palpites'),
 ('/ru/prognozy-futbol-segodnya/','ru','Прогноз'),
 ('/zh-cn/jinri-zuqiu-yuce/','zh-CN','足球'),
]
for path,lang,word in checks:
    url='https://www.touslesmatchs.com'+path
    html=subprocess.check_output(['curl','-fsS',url],text=True)
    lm=re.search(r'<html\s+lang="([^"]+)"',html,re.I)
    tm=re.search(r'<title>(.*?)</title>',html,re.I|re.S)
    got=lm.group(1) if lm else ''
    title=re.sub(r'\s+',' ',tm.group(1)).strip() if tm else ''
    ok=(got.lower()==lang.lower() and word.lower() in title.lower())
    print(f'{path} LANG={got} TITLE={title} OK={ok}')
    if not ok: sys.exit('Une page localisée est encore mal routée')
# Contrôle de non-régression des routes historiques
for path in ['/','/faq','/performances','/live-ia','/app.html']:
    subprocess.check_call(['curl','-fsS','-o','/dev/null','https://www.touslesmatchs.com'+path])
print('PUBLIC_I18N=OK')
PY

trap - ERR
echo '=== FINAL SEO I18N ROUTING ==='
echo 'STATUS=OK'
echo 'FR=OK EN=OK ES=OK PT_BR=OK RU=OK ZH_CN=OK'
echo 'ACCUEIL_FAQ_PERFORMANCES_LIVE_APP=OK'
echo 'SEO_PAGES=INCHANGEES'
echo 'SITEMAP_ROBOTS=INCHANGES'
echo 'MOTEUR_IA_API_TELEGRAM_HERMES_STRIPE_BREVO_DB=INCHANGES'
echo "SAUVEGARDE=$BACKUP"
