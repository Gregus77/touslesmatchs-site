"""
Script de debug autonome : releve les messages envoyes au bot admin Telegram
et les accumule dans un fichier, pour inspecter a la main ce qui arrive.
N'est lance par aucun service (ni docker-compose, ni l'API) — outil manuel.

Securite (audit du 05/08/2026) : ce fichier contenait en dur l'identifiant
numerique du bot et l'ID Telegram personnel de l'administrateur, dans un
fichier suivi par Git. Ce n'etait pas le secret complet du bot, mais un ID
personnel n'a rien a faire dans un depot public. Tout passe desormais par
des variables d'environnement, sans aucune valeur par defaut.

Usage :
    HERMES_ADMIN_TLM_BOT="<token>" TELEGRAM_ADMIN_USER_ID="<id>" python3 tg_poll.py
ou, si le .env du VPS est lisible :
    ENV_FILE=/opt/touslesmatchs/.env TELEGRAM_ADMIN_USER_ID="<id>" python3 tg_poll.py
"""
import json
import os
import time
import urllib.request


def load_token():
    token = os.environ.get("HERMES_ADMIN_TLM_BOT")
    if token:
        return token
    env_file = os.environ.get("ENV_FILE")
    if not env_file:
        return None
    try:
        with open(env_file) as fh:
            for line in fh:
                if line.startswith("HERMES_ADMIN_TLM_BOT="):
                    return line.strip().split("=", 1)[1]
    except OSError:
        return None
    return None


TOKEN = load_token()
ADMIN_ID = os.environ.get("TELEGRAM_ADMIN_USER_ID", "")
OFFSET_FILE = os.environ.get("TG_OFFSET_FILE", "/tmp/tg_offset.txt")
INBOX_FILE = os.environ.get("TG_INBOX_FILE", "/tmp/tg_inbox.txt")

if not TOKEN:
    raise SystemExit(
        "HERMES_ADMIN_TLM_BOT absent. Definis la variable d'environnement, "
        "ou ENV_FILE vers un .env qui la contient."
    )
if not ADMIN_ID:
    raise SystemExit(
        "TELEGRAM_ADMIN_USER_ID absent — on refuse de relever quoi que ce soit "
        "sans filtre d'expediteur."
    )

print("Polling started...")
while True:
    try:
        offset = ""
        if os.path.exists(OFFSET_FILE):
            with open(OFFSET_FILE) as fh:
                offset = "&offset=" + fh.read().strip()

        url = f"https://api.telegram.org/bot{TOKEN}/getUpdates?limit=5&timeout=30{offset}"
        with urllib.request.urlopen(url, timeout=35) as resp:
            data = json.loads(resp.read())

        for upd in data.get("result", []):
            msg = upd.get("message", {})
            frm = msg.get("from", {})
            text = msg.get("text", "")

            if str(frm.get("id")) == ADMIN_ID and text:
                with open(INBOX_FILE, "a") as fh:
                    fh.write(f"[{frm.get('first_name', '?')}] {text}\n")

            with open(OFFSET_FILE, "w") as fh:
                fh.write(str(upd.get("update_id", 0) + 1))
    except Exception:
        time.sleep(5)
