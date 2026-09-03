#!/usr/bin/env python3

import json
import os
import ssl
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PROJECT = Path("/opt/touslesmatchs")
STATE_DIR = Path("/var/lib/tlm-hourly-director")
STATE_FILE = STATE_DIR / "repair-state.json"
BASE_URL = "https://www.touslesmatchs.com"

REQUIRED_CONTAINERS = (
    "touslesmatchs-site",
    "touslesmatchs-api",
    "touslesmatchs-council",
    "touslesmatchs-hermes-admin",
)

PUBLIC_ROUTES = (
    ("/", False),
    ("/api/health", True),
    ("/api/live-matches", True),
    ("/api/analysis-history", True),
    ("/api/public-analysis-stats", True),
)

COOLDOWN_SECONDS = 6 * 3600
SSL_CONTEXT = ssl.create_default_context()


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_dotenv(path):
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip().strip('"').strip("'")

        if name and name not in os.environ:
            os.environ[name] = value


def run(command, timeout=25):
    try:
        result = subprocess.run(
            command,
            cwd=str(PROJECT),
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except Exception as error:
        return 99, "", str(error)


def request(url, headers=None, method="GET", data=None, timeout=20):
    request_object = urllib.request.Request(
        url,
        headers=headers or {},
        method=method,
        data=data,
    )

    try:
        with urllib.request.urlopen(
            request_object,
            timeout=timeout,
            context=SSL_CONTEXT,
        ) as response:
            body = response.read(2_000_000).decode("utf-8", errors="replace")
            return response.status, body
    except urllib.error.HTTPError as error:
        body = error.read(100_000).decode("utf-8", errors="replace")
        return error.code, body
    except Exception as error:
        return 0, str(error)


def read_state():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def write_state(state):
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.chmod(temporary, 0o600)
    temporary.replace(STATE_FILE)


def repair_allowed(state, component):
    previous = float(state.get(component, 0))
    return time.time() - previous >= COOLDOWN_SECONDS


def telegram_admin(message):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = (
        os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()
        or os.environ.get("TELEGRAM_HERMES_CHAT_ID", "").strip()
    )

    if not token or not chat_id:
        return False, "TELEGRAM_BOT_TOKEN ou TELEGRAM_ADMIN_CHAT_ID absent"

    payload = urllib.parse.urlencode(
        {
            "chat_id": chat_id,
            "text": message[:3900],
            "disable_web_page_preview": "true",
        }
    ).encode("utf-8")

    status, body = request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
        data=payload,
    )

    try:
        telegram_ok = bool(json.loads(body).get("ok"))
    except Exception:
        telegram_ok = False

    return status == 200 and telegram_ok, f"HTTP {status}"


def main():
    load_dotenv(PROJECT / ".env")
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE_DIR, 0o700)

    problems = []
    warnings = []
    repairs = []
    state = read_state()

    # Vérification et autoréparation limitée des conteneurs essentiels.
    for container in REQUIRED_CONTAINERS:
        code, output, error = run(
            ["docker", "inspect", "-f", "{{.State.Running}}", container]
        )

        running = code == 0 and output.lower() == "true"

        if running:
            continue

        problems.append(f"{container} arrêté ou absent")

        if code == 0 and repair_allowed(state, container):
            start_code, _, start_error = run(["docker", "start", container])

            if start_code == 0:
                state[container] = time.time()
                repairs.append(f"{container} redémarré")
                problems.pop()
            else:
                warnings.append(
                    f"réparation {container} impossible: {start_error[:120]}"
                )

    # Vérification HTTPS et cohérence JSON minimale.
    route_results = {}

    for route, expects_json in PUBLIC_ROUTES:
        separator = "&" if "?" in route else "?"
        status, body = request(
            f"{BASE_URL}{route}{separator}director={int(time.time())}"
        )
        route_results[route] = status

        if status != 200:
            problems.append(f"{route}: HTTP {status}")
            continue

        if expects_json:
            try:
                payload = json.loads(body)

                if not isinstance(payload, dict):
                    problems.append(f"{route}: réponse JSON incohérente")
                elif payload.get("ok") is False:
                    problems.append(f"{route}: ok=false")
                elif route == "/api/live-matches":
                    matches = payload.get("matches")

                    if not isinstance(matches, list):
                        problems.append(
                            "/api/live-matches: liste matches absente"
                        )
                elif route == "/api/analysis-history":
                    analyses = payload.get("analyses")

                    if not isinstance(analyses, list):
                        problems.append(
                            "/api/analysis-history: historique absent"
                        )
            except Exception:
                problems.append(f"{route}: JSON invalide")

    # Contrôle de fraîcheur du health-check.
    status, body = request(f"{BASE_URL}/api/health?freshness={int(time.time())}")

    if status == 200:
        try:
            health = json.loads(body)
            integrations = health.get("integrations", {})

            for name, information in integrations.items():
                if not isinstance(information, dict):
                    continue

                checked_at = information.get("checked_at")

                if not checked_at:
                    continue

                checked = datetime.fromisoformat(
                    checked_at.replace("Z", "+00:00")
                )
                age = (
                    datetime.now(timezone.utc) - checked.astimezone(timezone.utc)
                ).total_seconds()

                if age > 7200:
                    warnings.append(
                        f"health {name} ancien de {round(age / 3600, 1)} h"
                    )
        except Exception:
            warnings.append("fraîcheur /api/health non vérifiable")

    # Stripe : appel de lecture seul, sans paiement.
    stripe_key = os.environ.get("STRIPE_SECRET_KEY", "").strip()

    if not stripe_key:
        problems.append("Stripe: clé absente")
    else:
        import base64

        authorization = base64.b64encode(
            f"{stripe_key}:".encode("utf-8")
        ).decode("ascii")

        stripe_status, stripe_body = request(
            "https://api.stripe.com/v1/balance",
            headers={"Authorization": f"Basic {authorization}"},
        )

        if stripe_status != 200:
            reason = "API inaccessible"

            try:
                reason = (
                    json.loads(stripe_body)
                    .get("error", {})
                    .get("message", reason)
                )
            except Exception:
                pass

            problems.append(f"Stripe HTTP {stripe_status}: {reason[:120]}")

    # Recherche d’erreurs récentes sans afficher de secret.
    for container in (
        "touslesmatchs-api",
        "touslesmatchs-council",
        "touslesmatchs-hermes-admin",
    ):
        code, output, _ = run(
            ["docker", "logs", "--since", "70m", "--tail", "500", container],
            timeout=30,
        )

        if code != 0:
            warnings.append(f"logs {container} indisponibles")
            continue

        lowered = output.lower()

        markers = {
            "invalid_api_key": "clé IA invalide",
            "unauthorized": "erreur API 401",
            "expired api key": "clé API expirée",
            "can't parse entities": "format Telegram invalide",
            "quota bloque": "quota API-Sports bloqué",
            "traceback": "exception Python",
        }

        detected = []

        for marker, label in markers.items():
            if marker in lowered and label not in detected:
                detected.append(label)

        if detected:
            warnings.append(f"{container}: {', '.join(detected)}")

    # Permissions du fichier de secrets.
    env_file = PROJECT / ".env"

    if env_file.exists():
        mode = env_file.stat().st_mode & 0o777

        if mode & 0o077:
            problems.append(f".env trop permissif ({oct(mode)})")
    else:
        problems.append(".env absent")

    write_state(state)

    if problems:
        title = "🚨 HERMÈS — PANNE CONFIRMÉE"
    elif warnings:
        title = "⚠️ HERMÈS — SURVEILLANCE"
    else:
        title = "✅ HERMÈS — TousLesMatchs sain"

    lines = [
        title,
        f"🕒 {now_iso()}",
        (
            "🌐 Routes : "
            + " · ".join(
                f"{route}={status}"
                for route, status in route_results.items()
            )
        ),
    ]

    if problems:
        lines.append("🔴 Problèmes :")
        lines.extend(f"• {problem}" for problem in problems[:12])

    if warnings:
        lines.append("🟠 Alertes :")
        lines.extend(f"• {warning}" for warning in warnings[:12])

    if repairs:
        lines.append("🔧 Autoréparations :")
        lines.extend(f"• {repair}" for repair in repairs)

    if problems:
        lines.append("➡️ Priorité : traiter le premier problème confirmé.")
    elif warnings:
        lines.append("➡️ Service disponible, alertes à contrôler.")
    else:
        lines.append("Tout fonctionne normalement.")

    report = "\n".join(lines)
    print(report, flush=True)

    sent, delivery = telegram_admin(report)
    print(
        f"RAPPORT_HERMES={'OK' if sent else 'ECHEC'} {delivery}",
        flush=True,
    )


if __name__ == "__main__":
    main()
