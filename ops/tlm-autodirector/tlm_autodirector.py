#!/usr/bin/env python3
"""Directeur autonome et prudent de la production TousLesMatchs.

Le programme observe toujours avant d'agir. Il ne corrige automatiquement que
les incidents d'exploitation réversibles et vérifiables (conteneur arrêté,
API/site indisponible). Il ne modifie jamais les secrets, les prix, les règles
métier, Git ou les données clients.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


PROJECT_DIR = Path(os.environ.get("TLM_PROJECT_DIR", "/opt/touslesmatchs"))
STATE_DIR = Path(os.environ.get("TLM_DIRECTOR_STATE_DIR", "/var/lib/tlm-autodirector"))
STATE_FILE = STATE_DIR / "state.json"
PUBLIC_BASE = os.environ.get("TLM_PUBLIC_BASE", "https://www.touslesmatchs.com").rstrip("/")
DB_PATH = Path(os.environ.get("TLM_DB_PATH", str(PROJECT_DIR / "data/tlm.db")))
CONTAINERS = {
    "site": "touslesmatchs-site",
    "api": "touslesmatchs-api",
    "council": "touslesmatchs-council",
    "hermes": "touslesmatchs-hermes-admin",
}
REPAIR_COOLDOWN_SECONDS = 6 * 3600
INCIDENT_REPEAT_SECONDS = 6 * 3600
HEALTHY_REPEAT_SECONDS = 24 * 3600

SECRET_PATTERNS = (
    re.compile(r"xkeysib-[A-Za-z0-9_-]+"),
    re.compile(r"sk-(?:proj-)?[A-Za-z0-9_-]{12,}"),
    re.compile(r"pplx-[A-Za-z0-9_-]{12,}"),
    re.compile(r"\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\bwhsec_[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"(?i)Authorization:\s*Bearer\s+\S+"),
    re.compile(r"(?i)\b(?:API_KEY|TOKEN|SECRET|PASSWORD)=\S+"),
    re.compile(r"(?i)chat_id=-?\d+"),
)


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso_now() -> str:
    return now_utc().replace(microsecond=0).isoformat()


def redact(value: str) -> str:
    text = value
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("***MASQUE***", text)
    return text


def run(
    command: list[str], timeout: int = 30, cwd: Path | None = None, *, redact_output: bool = True
) -> tuple[int, str]:
    try:
        proc = subprocess.run(
            command,
            cwd=str(cwd or PROJECT_DIR),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            check=False,
            env={**os.environ, "LC_ALL": "C.UTF-8"},
        )
        output = proc.stdout.strip()
        return proc.returncode, redact(output) if redact_output else output
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 124, redact(str(exc))


def http_json(path: str, timeout: int = 20) -> tuple[bool, Any, str]:
    url = f"{PUBLIC_BASE}{path}"
    request = urllib.request.Request(url, headers={"User-Agent": "TLM-Autodirector/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read(2_000_000).decode("utf-8", "replace")
            if not 200 <= response.status < 300:
                return False, None, f"HTTP {response.status}"
            return True, json.loads(body), ""
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        return False, None, redact(str(exc))


def http_text(path: str, timeout: int = 20) -> tuple[bool, str]:
    url = f"{PUBLIC_BASE}{path}"
    request = urllib.request.Request(url, headers={"User-Agent": "TLM-Autodirector/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read(1_000_000).decode("utf-8", "replace")
            valid = 200 <= response.status < 300 and "TousLesMatchs" in body
            return valid, "" if valid else f"HTTP {response.status} ou marque absente"
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        return False, redact(str(exc))


def load_state() -> dict[str, Any]:
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(state: dict[str, Any]) -> None:
    STATE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix="state-", suffix=".json", dir=STATE_DIR)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, STATE_FILE)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def parse_time(value: Any) -> dt.datetime | None:
    if not value:
        return None
    candidate = str(value).strip().replace(" ", "T")
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"
    try:
        parsed = dt.datetime.fromisoformat(candidate)
        return parsed.replace(tzinfo=parsed.tzinfo or dt.timezone.utc).astimezone(dt.timezone.utc)
    except ValueError:
        return None


def hours_since(value: Any) -> float | None:
    parsed = parse_time(value)
    return None if parsed is None else max(0.0, (now_utc() - parsed).total_seconds() / 3600)


def add_issue(issues: list[dict[str, str]], severity: str, code: str, message: str) -> None:
    issues.append({"severity": severity, "code": code, "message": redact(message)[:600]})


def docker_inspect(container: str) -> dict[str, Any] | None:
    # La sortie contient les variables d'environnement. Elle reste strictement
    # en mémoire pour joindre Telegram et n'est jamais écrite dans les rapports.
    code, output = run(["docker", "inspect", container], timeout=20, redact_output=False)
    if code != 0:
        return None
    try:
        result = json.loads(output)
        return result[0] if result else None
    except json.JSONDecodeError:
        return None


def container_environment(container: str) -> dict[str, str]:
    info = docker_inspect(container) or {}
    env: dict[str, str] = {}
    for item in info.get("Config", {}).get("Env", []) or []:
        if "=" in item:
            key, value = item.split("=", 1)
            env[key] = value
    return env


def restart_container(
    label: str,
    container: str,
    state: dict[str, Any],
    repairs: list[str],
    issues: list[dict[str, str]],
    dry_run: bool,
    no_repair: bool,
) -> bool:
    action_key = f"restart:{container}"
    last = float(state.get("actions", {}).get(action_key, 0) or 0)
    if time.time() - last < REPAIR_COOLDOWN_SECONDS:
        add_issue(issues, "P1", "repair_cooldown", f"{label}: redémarrage déjà tenté dans les 6 h")
        return False
    if dry_run or no_repair:
        repairs.append(f"SIMULATION — redémarrer {label}")
        return False
    code, output = run(["docker", "restart", container], timeout=90)
    state.setdefault("actions", {})[action_key] = time.time()
    if code != 0:
        add_issue(issues, "P1", "restart_failed", f"{label}: échec du redémarrage ({output[-220:]})")
        return False
    time.sleep(12)
    info = docker_inspect(container)
    running = bool(info and info.get("State", {}).get("Running"))
    if running:
        repairs.append(f"{label}: conteneur redémarré et vérifié actif")
        return True
    add_issue(issues, "P0", "restart_unverified", f"{label}: redémarrage non confirmé")
    return False


def inspect_containers(
    state: dict[str, Any], repairs: list[str], issues: list[dict[str, str]], dry_run: bool, no_repair: bool
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for label, container in CONTAINERS.items():
        info = docker_inspect(container)
        if not info:
            result[label] = {"running": False, "health": "absent", "restarts": None}
            add_issue(issues, "P0", "container_absent", f"{label}: conteneur {container} absent")
            continue
        status = info.get("State", {})
        health = status.get("Health", {}).get("Status", "none")
        running = bool(status.get("Running"))
        result[label] = {
            "running": running,
            "health": health,
            "restarts": info.get("RestartCount", 0),
        }
        if not running or health == "unhealthy":
            add_issue(issues, "P0", "container_down", f"{label}: état={status.get('Status')} santé={health}")
            if restart_container(label, container, state, repairs, issues, dry_run, no_repair):
                refreshed = docker_inspect(container) or {}
                refreshed_state = refreshed.get("State", {})
                result[label]["running"] = bool(refreshed_state.get("Running"))
                result[label]["health"] = refreshed_state.get("Health", {}).get("Status", "none")
    return result


def inspect_git(issues: list[dict[str, str]]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    commands = {
        "branch": ["git", "branch", "--show-current"],
        "head": ["git", "rev-parse", "--short=12", "HEAD"],
        "upstream": ["git", "rev-parse", "--abbrev-ref", "@{upstream}"],
        "dirty": ["git", "status", "--porcelain", "--untracked-files=no"],
    }
    for key, command in commands.items():
        code, output = run(command, timeout=20)
        summary[key] = output if code == 0 else None
    if summary.get("dirty"):
        add_issue(issues, "P1", "git_dirty", "Le VPS contient des modifications Git suivies non validées")
    if summary.get("upstream"):
        code, output = run(["git", "rev-list", "--left-right", "--count", "HEAD...@{upstream}"], timeout=20)
        if code == 0:
            try:
                ahead, behind = [int(part) for part in output.split()]
                summary.update({"ahead": ahead, "behind": behind})
                if ahead or behind:
                    add_issue(issues, "P1", "git_diverged", f"Git: avance={ahead}, retard={behind}; aucun pull automatique")
            except ValueError:
                pass
    return summary


def inspect_resources(issues: list[dict[str, str]]) -> dict[str, Any]:
    usage = shutil.disk_usage(PROJECT_DIR)
    disk_pct = round(usage.used / usage.total * 100, 1)
    load1, load5, load15 = os.getloadavg()
    cpu_count = os.cpu_count() or 1
    if disk_pct >= 90:
        add_issue(issues, "P0", "disk_critical", f"Disque utilisé à {disk_pct}%")
    elif disk_pct >= 80:
        add_issue(issues, "P1", "disk_high", f"Disque utilisé à {disk_pct}%")
    if load5 > cpu_count * 2:
        add_issue(issues, "P1", "load_high", f"Charge 5 min élevée: {load5:.2f} pour {cpu_count} CPU")
    return {"disk_pct": disk_pct, "load": [round(load1, 2), round(load5, 2), round(load15, 2)]}


def list_count(payload: Any) -> int:
    if isinstance(payload, list):
        return len(payload)
    if isinstance(payload, dict):
        for key in ("matches", "data", "analyses", "items"):
            if isinstance(payload.get(key), list):
                return len(payload[key])
    return 0


def inspect_public(
    state: dict[str, Any], repairs: list[str], issues: list[dict[str, str]], dry_run: bool, no_repair: bool
) -> dict[str, Any]:
    checks: dict[str, Any] = {}
    site_ok, site_error = http_text("/")
    checks["site"] = {"ok": site_ok, "error": site_error}
    if not site_ok:
        add_issue(issues, "P0", "public_site_down", f"Site public indisponible: {site_error}")
        site_info = docker_inspect(CONTAINERS["site"]) or {}
        if site_info.get("State", {}).get("Running"):
            valid_code, valid_output = run(
                ["docker", "exec", CONTAINERS["site"], "caddy", "validate", "--config", "/etc/caddy/Caddyfile"],
                timeout=30,
            )
            if valid_code != 0:
                add_issue(issues, "P0", "caddy_invalid", f"Caddy invalide, redémarrage interdit: {valid_output[-220:]}")
            elif restart_container("site", CONTAINERS["site"], state, repairs, issues, dry_run, no_repair):
                verified, verify_error = http_text("/")
                checks["site"] = {"ok": verified, "error": verify_error}
                if verified:
                    repairs.append("Site public: page et marque vérifiées après redémarrage")
    endpoints = {
        "health": "/api/health",
        "live": "/api/live-matches",
        "activity": "/api/live-activity",
        "history": "/api/analysis-history?limit=20",
        "tiers": "/api/tier-stats",
    }
    for name, path in endpoints.items():
        ok, payload, error = http_json(path)
        checks[name] = {"ok": ok, "payload": payload if ok else None, "error": error}
    if not checks["health"]["ok"]:
        add_issue(issues, "P0", "public_api_down", f"API publique indisponible: {checks['health']['error']}")
        repaired = restart_container("api", CONTAINERS["api"], state, repairs, issues, dry_run, no_repair)
        if repaired:
            ok, payload, error = http_json(endpoints["health"])
            checks["health"] = {"ok": ok, "payload": payload if ok else None, "error": error}
            if ok:
                repairs.append("API publique: réponse JSON vérifiée après redémarrage")
    for name in ("live", "activity", "history", "tiers"):
        if not checks[name]["ok"]:
            add_issue(issues, "P1", f"endpoint_{name}", f"Endpoint {name} indisponible: {checks[name]['error']}")

    health = checks["health"].get("payload") or {}
    integrations = health.get("integrations", {}) if isinstance(health, dict) else {}
    for integration in ("telegram", "brevo"):
        status = integrations.get(integration, {}) if isinstance(integrations, dict) else {}
        if status.get("configured") is False:
            add_issue(issues, "P0", f"{integration}_missing", f"{integration.title()}: configuration absente")
        elif status.get("ok") is False:
            add_issue(issues, "P0", f"{integration}_failed", f"{integration.title()}: contrôle de santé en échec; secret non modifié")
    return checks


def query_one(db: sqlite3.Connection, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any]:
    row = db.execute(sql, params).fetchone()
    return dict(row) if row else {}


def inspect_database(issues: list[dict[str, str]]) -> dict[str, Any]:
    stats: dict[str, Any] = {"available": False}
    if not DB_PATH.is_file():
        add_issue(issues, "P0", "db_missing", f"Base SQLite absente: {DB_PATH}")
        return stats
    try:
        db = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=5)
        db.row_factory = sqlite3.Row
        stats["available"] = True
        integrity = db.execute("PRAGMA quick_check").fetchone()[0]
        stats["integrity"] = integrity
        if integrity != "ok":
            add_issue(issues, "P0", "db_integrity", f"SQLite quick_check: {integrity}")

        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "concile_analyses" in tables:
            stats.update(query_one(db, """
                SELECT COUNT(*) AS analyses_24h, MAX(analysed_at) AS last_analysis
                FROM concile_analyses WHERE analysed_at >= datetime('now','-24 hours')
            """))
            blockers = db.execute("""
                SELECT COALESCE(NULLIF(trim(diffusion_block),''),'non_renseigne') AS reason, COUNT(*) AS n
                FROM concile_analyses
                WHERE analysed_at >= datetime('now','-24 hours')
                GROUP BY reason ORDER BY n DESC LIMIT 5
            """).fetchall()
            stats["blockers"] = [dict(row) for row in blockers]
        if "telegram_signal_deliveries" in tables:
            stats.update(query_one(db, """
                SELECT COUNT(*) AS telegram_24h, MAX(created_at) AS last_telegram
                FROM telegram_signal_deliveries
                WHERE ok=1 AND telegram_message_id IS NOT NULL
                  AND created_at >= datetime('now','-24 hours')
            """))
            if not stats.get("last_telegram"):
                stats["last_telegram"] = query_one(db, """
                    SELECT MAX(created_at) AS value FROM telegram_signal_deliveries
                    WHERE ok=1 AND telegram_message_id IS NOT NULL
                """).get("value")
        if "agent_calls" in tables:
            stats.update(query_one(db, """
                SELECT COUNT(*) AS agent_calls_24h,
                       SUM(CASE WHEN vote_produit=1 THEN 1 ELSE 0 END) AS votes_24h,
                       SUM(CASE WHEN issue NOT IN ('ok','success') OR vote_produit=0 THEN 1 ELSE 0 END) AS failed_calls_24h
                FROM agent_calls WHERE created_at >= datetime('now','-24 hours')
            """))
            calls = int(stats.get("agent_calls_24h") or 0)
            failed = int(stats.get("failed_calls_24h") or 0)
            if calls >= 10 and failed / calls >= 0.40:
                add_issue(issues, "P0", "agents_failing", f"Concile: {failed}/{calls} appels sans vote exploitable sur 24 h")
        db.close()
    except sqlite3.Error as exc:
        add_issue(issues, "P0", "db_error", f"Lecture SQLite impossible: {exc}")
    return stats


def inspect_logs(issues: list[dict[str, str]]) -> list[str]:
    findings: list[str] = []
    patterns = re.compile(
        r"API Key is not enabled|invalid[_ ]api[_ ]key|Incorrect API key|HTTP 40[123]|HTTP 429|"
        r"quota|rate.?limit|can't parse entities|Unsupported start tag|NoneType.*NoneType|"
        r"aucun vote exploitable|timeout",
        re.IGNORECASE,
    )
    for label in ("api", "council"):
        code, output = run(["docker", "logs", "--since", "70m", CONTAINERS[label]], timeout=35)
        if code != 0:
            continue
        for line in output.splitlines():
            if patterns.search(line):
                cleaned = redact(line.strip())[-380:]
                entry = f"{label}: {cleaned}"
                if entry not in findings:
                    findings.append(entry)
                if len(findings) >= 8:
                    break
    for entry in findings:
        severity = "P0" if re.search(r"401|invalid|not enabled|aucun vote", entry, re.I) else "P1"
        add_issue(issues, severity, "runtime_log", entry)
    return findings


def inspect_source(issues: list[dict[str, str]]) -> None:
    source = PROJECT_DIR / "scripts/api_server.js"
    try:
        text = source.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return
    strict_recovery = "combinedAligned && recentTrendAligned && venueAligned && liveAligned"
    if strict_recovery in text and re.search(r"RECOVERY_MIN_[A-Z_]*INDICATORS\s*=\s*3", text):
        add_issue(
            issues,
            "P1",
            "recovery_rule_conflict",
            "Recovery annonce 3 indicateurs mais le code en exige 4; correction de code à valider, seuil non modifié automatiquement",
        )


def activity_from_checks(checks: dict[str, Any]) -> dict[str, Any]:
    activity_payload = checks.get("activity", {}).get("payload") or {}
    live_payload = checks.get("live", {}).get("payload")
    return {
        "live_matches": list_count(live_payload),
        "analyses_today": activity_payload.get("analyses_today") if isinstance(activity_payload, dict) else None,
        "published_today": activity_payload.get("published_today") if isinstance(activity_payload, dict) else None,
        "signals_today": activity_payload.get("signals_today") if isinstance(activity_payload, dict) else None,
        "ia_active": activity_payload.get("ia_active") if isinstance(activity_payload, dict) else None,
    }


def correlate_pipeline(db_stats: dict[str, Any], activity: dict[str, Any], issues: list[dict[str, str]]) -> None:
    analyses = int(db_stats.get("analyses_24h") or 0)
    deliveries = int(db_stats.get("telegram_24h") or 0)
    last_delivery_hours = hours_since(db_stats.get("last_telegram"))
    live_count = int(activity.get("live_matches") or 0)
    if analyses >= 5 and deliveries == 0:
        blocker_rows = db_stats.get("blockers", [])[:5]
        blockers = ", ".join(f"{row['reason']}={row['n']}" for row in blocker_rows)
        reasons = [str(row.get("reason", "")).lower() for row in blocker_rows]
        failure_words = ("non_renseigne", "erreur", "echec", "échec", "timeout", "quota", "aucun vote", "cle ", "clé ")
        expected_words = (
            "prematch interne",
            "historique 6-8 matchs",
            "championnat hors liste recovery",
            "donnees absences indisponibles",
            "données absences indisponibles",
            "statistiques live incompletes",
            "statistiques live incomplètes",
        )
        if not reasons or any(any(word in reason for word in failure_words) for reason in reasons):
            add_issue(issues, "P0", "pipeline_dry", f"{analyses} analyses/24 h mais 0 livraison Telegram; blocages: {blockers or 'inconnus'}")
        elif all(any(word in reason for word in expected_words) for reason in reasons):
            add_issue(
                issues,
                "P2",
                "no_eligible_signal",
                f"Aucun match admissible sur {analyses} analyses/24 h; Telegram fonctionne; filtres prévus: {blockers}",
            )
        else:
            add_issue(issues, "P1", "pipeline_filtered", f"0 livraison sur {analyses} analyses/24 h; filtres à examiner: {blockers}")
    elif last_delivery_hours is not None and last_delivery_hours >= 48 and analyses > 0:
        add_issue(issues, "P1", "delivery_stale", f"Dernière livraison Telegram prouvée il y a {last_delivery_hours:.1f} h")
    if live_count > 0 and analyses == 0:
        add_issue(issues, "P1", "analysis_stalled", f"{live_count} match(s) live mais aucune analyse sur 24 h")


def issue_fingerprint(issues: list[dict[str, str]]) -> str:
    normalized = sorted((item["severity"], item["code"], item["message"]) for item in issues)
    return hashlib.sha256(json.dumps(normalized, ensure_ascii=False).encode()).hexdigest()


def build_report(snapshot: dict[str, Any], issues: list[dict[str, str]], repairs: list[str]) -> str:
    rank = {"P0": 0, "P1": 1, "P2": 2}
    issues_sorted = sorted(issues, key=lambda item: rank.get(item["severity"], 9))
    verdict = "INCIDENT" if any(item["severity"] == "P0" for item in issues) else "SURVEILLANCE" if issues else "OK"
    containers = snapshot["containers"]
    container_line = " · ".join(f"{name}:{'OK' if value['running'] else 'DOWN'}" for name, value in containers.items())
    health = snapshot["public"].get("health", {}).get("payload") or {}
    integrations = health.get("integrations", {}) if isinstance(health, dict) else {}
    telegram_ok = (integrations.get("telegram") or {}).get("ok")
    brevo_ok = (integrations.get("brevo") or {}).get("ok")
    db = snapshot["database"]
    activity = snapshot["activity"]
    lines = [
        f"🤖 DIRECTEUR AUTONOME TLM — {verdict}",
        iso_now(),
        "",
        f"Services: {container_line}",
        f"Intégrations: Telegram={telegram_ok} · Brevo={brevo_ok}",
        f"Activité: live={activity.get('live_matches')} · analyses/24h={db.get('analyses_24h', '?')} · livraisons/24h={db.get('telegram_24h', '?')}",
        f"Ressources: disque={snapshot['resources']['disk_pct']}% · charge5={snapshot['resources']['load'][1]}",
    ]
    if repairs:
        lines.extend(["", "Réparations vérifiées:"] + [f"✅ {item}" for item in repairs[:6]])
    if issues_sorted:
        lines.extend(["", "Incidents:"] + [f"{item['severity']} · {item['message']}" for item in issues_sorted[:10]])
    else:
        lines.extend(["", "✅ Aucun incident détecté. Aucune action nécessaire."])
    lines.extend(["", "Protection: aucun secret, prix, seuil métier, dépôt Git ou donnée client n'est modifié automatiquement."])
    return "\n".join(lines)[:3900]


def send_admin_report(report: str) -> tuple[bool, str]:
    env = container_environment(CONTAINERS["api"])
    token = env.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = env.get("TELEGRAM_ADMIN_CHAT_ID", "")
    if not token or not chat_id:
        return False, "token ou chat admin absent"
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = json.dumps({"chat_id": chat_id, "text": report, "disable_web_page_preview": True}).encode()
    request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read(200_000).decode("utf-8", "replace"))
            return payload.get("ok") is True, "accepté" if payload.get("ok") is True else redact(str(payload.get("description", "refusé")))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        return False, redact(str(exc))


def should_report(state: dict[str, Any], fingerprint: str, has_issues: bool, always: bool) -> bool:
    if always:
        return True
    last_at = float(state.get("last_report_at", 0) or 0)
    if fingerprint != state.get("last_report_fingerprint"):
        return True
    interval = INCIDENT_REPEAT_SECONDS if has_issues else HEALTHY_REPEAT_SECONDS
    return time.time() - last_at >= interval


def main() -> int:
    parser = argparse.ArgumentParser(description="Directeur autonome TousLesMatchs")
    parser.add_argument("--dry-run", action="store_true", help="observe et simule les réparations")
    parser.add_argument("--no-repair", action="store_true", help="désactive les réparations")
    parser.add_argument("--report-always", action="store_true", help="envoie un rapport même inchangé")
    args = parser.parse_args()

    state = load_state()
    issues: list[dict[str, str]] = []
    repairs: list[str] = []

    snapshot: dict[str, Any] = {"started_at": iso_now()}
    snapshot["resources"] = inspect_resources(issues)
    snapshot["git"] = inspect_git(issues)
    snapshot["containers"] = inspect_containers(state, repairs, issues, args.dry_run, args.no_repair)
    snapshot["public"] = inspect_public(state, repairs, issues, args.dry_run, args.no_repair)
    snapshot["database"] = inspect_database(issues)
    snapshot["activity"] = activity_from_checks(snapshot["public"])
    correlate_pipeline(snapshot["database"], snapshot["activity"], issues)
    snapshot["log_findings"] = inspect_logs(issues)
    inspect_source(issues)

    fingerprint = issue_fingerprint(issues)
    report = build_report(snapshot, issues, repairs)
    print(report, flush=True)

    report_sent = False
    report_detail = "non requis (état inchangé)"
    actionable_issues = any(item["severity"] in ("P0", "P1") for item in issues)
    if should_report(state, fingerprint, actionable_issues, args.report_always):
        report_sent, report_detail = send_admin_report(report)
        if report_sent:
            state["last_report_at"] = time.time()
            state["last_report_fingerprint"] = fingerprint
    print(f"HERMES_REPORT={'SENT' if report_sent else 'NOT_SENT'} — {report_detail}", flush=True)

    state.update({
        "last_run_at": time.time(),
        "last_run_iso": iso_now(),
        "last_verdict": "incident" if any(item["severity"] == "P0" for item in issues) else "watch" if issues else "ok",
        "last_issue_fingerprint": fingerprint,
        "last_issues": issues,
        "last_repairs": repairs,
    })
    save_state(state)
    return 0


if __name__ == "__main__":
    sys.exit(main())
