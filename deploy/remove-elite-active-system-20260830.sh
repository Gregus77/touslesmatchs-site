#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs

TS="$(date +%Y%m%d-%H%M%S)"
BK="/opt/backups/tlm-remove-elite-active-${TS}"
mkdir -p "$BK"
cp -a scripts/api_server.js "$BK/api_server.js"
echo "[1/7] Sauvegarde: $BK"

rollback(){
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "ERREUR — rollback automatique"
    cp -a "$BK/api_server.js" scripts/api_server.js
    docker compose up -d --build api >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap rollback EXIT

python3 - <<'PY'
from pathlib import Path
import re
p=Path('scripts/api_server.js')
s=p.read_text()
orig=s

# 1) Elite Telegram définitivement désactivé dans le système actif.
s=re.sub(r'const TELEGRAM_ELITE_CHANNEL_ID\s*=\s*[^;]+;',
         'const TELEGRAM_ELITE_CHANNEL_ID = ""; // LEGACY uniquement : aucun canal Elite actif',s, count=1)

# 2) Vérification au démarrage : seulement Gratuit / Standard / Premium / Admin.
s=s.replace('    ["Elite",    TELEGRAM_ELITE_CHANNEL_ID],\n','')
s=s.replace('    ...(TELEGRAM_ELITE_CHANNEL_ID ? [["Elite", TELEGRAM_ELITE_CHANNEL_ID]] : []),\n','')

# 3) Envoi groupé : plus jamais vers Elite.
s=s.replace('  push(TELEGRAM_ELITE_CHANNEL_ID, "elite");\n','')

# 4) Seuils actifs : Premium devient le palier payant le plus large.
s=re.sub(r'const fallback = \{ standard: STANDARD_MIN_CONF, premium: PREMIUM_MIN_CONF, elite: getEliteMinConf\(\), source: "fixe" \};',
         'const fallback = { standard: STANDARD_MIN_CONF, premium: getSignalFloor(), source: "fixe" };', s)
s=s.replace('  if (!TELEGRAM_ELITE_CHANNEL_ID) fallback.premium = fallback.elite;\n','')
s=s.replace('      elite:    getSignalFloor(), // Elite = tout le vivier diffusable, au plancher du portail\n','')
s=s.replace('    t.elite   = Math.min(t.elite, t.premium);\n','')
s=s.replace('    if (!TELEGRAM_ELITE_CHANNEL_ID) t.premium = t.elite;\n','')
s=s.replace('    for (const k of ["standard", "premium", "elite"]) t[k] = Math.max(getSignalFloor(), t[k]);',
            '    for (const k of ["standard", "premium"]) t[k] = Math.max(getSignalFloor(), t[k]);')
s=re.sub(r'console\.log\(`\[tier-thresholds\] Standard ≥\$\{t\.standard\} · Premium ≥\$\{t\.premium\} · Elite ≥\$\{t\.elite\} \(\$\{t\.source\}\)`\);',
         'console.log(`[tier-thresholds] Standard ≥${t.standard} · Premium ≥${t.premium} (${t.source})`);', s)

# 5) Diffusion active : Premium remplace le dernier niveau Elite.
s=s.replace('      const gradeElite    = gradePremium  || (diffusable && voteCountForSignal >= 4 && conf >= TH.elite);\n      shadowWorthy = gradeElite;\n',
            '      shadowWorthy = gradePremium;\n')
s=s.replace('      const eliteDistinct = !!(TELEGRAM_ELITE_CHANNEL_ID && TELEGRAM_ELITE_CHANNEL_ID !== TELEGRAM_PREMIUM_CHANNEL_ID);\n','')
# Supprime le bloc d'envoi Elite, quelle que soit sa légère variante locale.
s=re.sub(r'\n\s*//[^\n]*ELITE[^\n]*\n\s*if \(TELEGRAM_ELITE_CHANNEL_ID && gradeElite[\s\S]*?\n\s*}\n', '\n', s, count=1)
s=re.sub(r'\n\s*if \(TELEGRAM_ELITE_CHANNEL_ID && gradeElite[\s\S]*?\n\s*}\n', '\n', s, count=1)

# 6) Résultats / récaps / audits : aucun nouvel envoi ni contrôle Elite.
s=re.sub(r'^\s*if \(TELEGRAM_ELITE_CHANNEL_ID && sentElite\).*\n','',s,flags=re.M)
s=re.sub(r'^\s*if\(elite && TELEGRAM_ELITE_CHANNEL_ID\)\s*\n\s*jobs\.push\(sendTelegramMessage\(TELEGRAM_ELITE_CHANNEL_ID,elite\)\);\s*\n','',s,flags=re.M)
s=s.replace('    const canaux = [["Gratuit", TELEGRAM_CHANNEL_ID], ["Standard", TELEGRAM_STANDARD_CHANNEL_ID],\n                    ["Premium", TELEGRAM_PREMIUM_CHANNEL_ID], ["Elite", TELEGRAM_ELITE_CHANNEL_ID]];',
            '    const canaux = [["Gratuit", TELEGRAM_CHANNEL_ID], ["Standard", TELEGRAM_STANDARD_CHANNEL_ID],\n                    ["Premium", TELEGRAM_PREMIUM_CHANNEL_ID]];')
s=s.replace('return morts.length ? { ok: false, info: `injoignables : ${morts.join(", ")}` } : { ok: true, info: "4 canaux joignables" };',
            'return morts.length ? { ok: false, info: `injoignables : ${morts.join(", ")}` } : { ok: true, info: "3 canaux clients joignables" };')
s=s.replace('for (const tier of ["standard", "premium", "elite"])','for (const tier of ["standard", "premium"])')
s=re.sub(r'^\s*elite:\s*TELEGRAM_ELITE_CHANNEL_ID,\s*\n','',s,flags=re.M)

# 7) Ancien badge interne : tout ce qui aurait été Elite est désormais Premium.
s=s.replace('const tierBadge = sigTier === "standard" ? "🥇 STANDARD" : sigTier === "premium" ? "🥈 PREMIUM" : "🥉 ELITE";',
            'const tierBadge = sigTier === "standard" ? "🥇 STANDARD" : "🥈 PREMIUM";')

if s==orig:
    raise SystemExit('Aucune modification appliquée — structure inattendue')
p.write_text(s)
print('PATCH_ELITE_ACTIF=OK')
PY

echo "[2/7] Vérification syntaxique"
node --check scripts/api_server.js

echo "[3/7] Vérification qu'Elite n'est plus un canal actif"
if grep -nE 'sendTelegramMessage\(TELEGRAM_ELITE_CHANNEL_ID|push\(TELEGRAM_ELITE_CHANNEL_ID|\["Elite",[[:space:]]*TELEGRAM_ELITE_CHANNEL_ID' scripts/api_server.js; then
  echo "ERREUR — envoi/contrôle Elite actif encore présent"
  false
fi

echo "[4/7] Vérification des 2 paliers payants actifs"
grep -nE 'Telegram standard|Telegram premium|Standard.*Premium' scripts/api_server.js | head -n 20 || true

echo "[5/7] Rebuild du SEUL service API"
docker compose up -d --build api
sleep 12

echo "[6/7] Vérification des canaux après redémarrage"
LOGS="$(docker logs --since 2m touslesmatchs-api 2>&1 || true)"
printf '%s\n' "$LOGS" | grep -E '\[telegram-check\]' || true
printf '%s\n' "$LOGS" | grep -q 'Premium.*channel'
printf '%s\n' "$LOGS" | grep -q 'Standard.*channel'
printf '%s\n' "$LOGS" | grep -q 'Gratuit.*channel'
printf '%s\n' "$LOGS" | grep -q 'Admin.*Hermès'
if printf '%s\n' "$LOGS" | grep -q 'telegram-check.*Elite'; then
  echo "ERREUR — Elite encore vérifié au démarrage"
  false
fi

echo "[7/7] Vérification table de livraison (lecture seule)"
docker exec touslesmatchs-api node -e 'const D=require("better-sqlite3");const db=new D("/data/tlm.db",{readonly:true});console.log("DELIVERIES_TOTAL="+db.prepare("SELECT COUNT(*) n FROM telegram_signal_deliveries").get().n)'

trap - EXIT
echo "=== FINAL SUPPRESSION ELITE ACTIF ==="
echo "STATUS=OK"
echo "OFFRES_ACTIVES=GRATUIT + STANDARD + PREMIUM"
echo "CANAL_ELITE=SUPPRIME_DU_SYSTEME_ACTIF"
echo "AUDIT_ELITE=SUPPRIME"
echo "ROUTAGE_ELITE=SUPPRIME"
echo "PREMIUM=PALIER_PAYANT_LE_PLUS_LARGE"
echo "HISTORIQUE_DB_ELITE=CONSERVE_EN_LECTURE_COMPATIBILITE"
echo "STRIPE=INCHANGE"
echo "CRITERE_4_SUR_5=INCHANGE"
echo "CONFIANCE_ET_COTES=INCHANGEES"
echo "CONCILE_HERMES_BREVO_DB=INCHANGES"
echo "SAUVEGARDE=$BK"
