#!/usr/bin/env bash
# Run manually in the VPS terminal. Never paste the key into chat.
set +x
set -euo pipefail
cd /opt/touslesmatchs
read -rsp 'Clé TypeSafe (saisie masquée) : ' TYPESAFE_API_KEY
printf '\n'
export TYPESAFE_API_KEY
trap 'unset TYPESAFE_API_KEY' EXIT
python3 - <<'PY'
import os
import tempfile
from pathlib import Path

path = Path('/opt/touslesmatchs/.env')
key = os.environ['TYPESAFE_API_KEY']
if not key or any(c.isspace() for c in key) or "'" in key or '\\' in key:
    raise SystemExit('Clé vide ou caractères non acceptés : aucune modification.')
lines = path.read_text().splitlines()
lines = [line for line in lines if not line.startswith(('TYPESAFE_API_KEY=', 'export TYPESAFE_API_KEY='))]
# Compose single quotes preserve dollar signs literally; no shell interpolation.
content = '\n'.join(lines + ["TYPESAFE_API_KEY='" + key + "'"]) + '\n'
fd, temp_path = tempfile.mkstemp(prefix='.env-typesafe-', dir=path.parent)
try:
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp_path, path)
except BaseException:
    if os.path.exists(temp_path):
        os.unlink(temp_path)
    raise
print('Clé enregistrée dans .env sans affichage. Aucun service redémarré.')
PY
