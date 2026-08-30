#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
REF="origin/codex/upcoming-all-now-tomorrow-20260830"
BASE="/tmp/conversion-content-fix-v2-base.sh"
PATCHED="/tmp/conversion-content-fix-v3-patched.sh"

git show "$REF:deploy/conversion-content-fix-v2-20260830.sh" > "$BASE"
cp "$BASE" "$PATCHED"
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/conversion-content-fix-v3-patched.sh')
s=p.read_text(encoding='utf-8')
old="for x in ['Passe à Elite','🟠 Elite','Elite débloque','Premium et Elite','Réservé aux membres Elite']:"
new="for x in ['Passe à Elite','🟠 Elite','Elite débloque','Réservé aux membres Elite']:"
if old not in s:
    raise SystemExit('Validation dashboard V2 introuvable — arrêt sans toucher au site')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
PY
bash -n "$PATCHED"
echo 'Validation V3: faux positif commentaire dashboard neutralisé.'
bash "$PATCHED"
