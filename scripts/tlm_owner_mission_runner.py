#!/usr/bin/env python3
"""Hermès owner mission runner.

Executes only NEW Telegram missions explicitly marked automatic_execution=true.
Each mission runs through Codex in an isolated git worktree with workspace-write
sandbox and automatic review. Production checkout is never modified directly.

Sensitive missions remain awaiting_confirmation and are never executed here.
"""
import datetime
import fcntl
import json
import os
import pathlib
import re
import shutil
import subprocess
import time
import urllib.request

PROJECT = pathlib.Path(os.environ.get("TLM_ROOT", "/opt/touslesmatchs"))
DATA = PROJECT / "data"
INBOX = DATA / "owner_missions"
RESULTS = DATA / "owner_mission_results"
LOCK = DATA / "owner_mission_runner.lock"
POLL_SECONDS = 5
CODEX_TIMEOUT_SECONDS = 30 * 60
RUNNER_VERSION = 1


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def load_env():
    env = {}
    path = PROJECT / ".env"
    if not path.exists():
        return env
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def atomic_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def clean(value, limit=3500):
    text = str(value or "")
    text = re.sub(r"sk-[A-Za-z0-9_-]+", "[secret masqué]", text)
    text = re.sub(r"\d{8,}:[A-Za-z0-9_-]+", "[secret masqué]", text)
    return text[:limit]


def telegram_send(env, message):
    token = env.get("HERMES_ADMIN_TLM_BOT", "")
    chat = env.get("TELEGRAM_ADMIN_CHAT_ID", "")
    if not token or not chat:
        return None
    body = json.dumps({
        "chat_id": chat,
        "text": clean(message, 3900),
        "disable_web_page_preview": True,
    }).encode()
    req = urllib.request.Request(
        "https://api.telegram.org/bot" + token + "/sendMessage",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=35) as response:
        payload = json.load(response)
    if payload.get("ok"):
        return payload.get("result", {}).get("message_id")
    return None


def run(command, cwd=None, timeout=120, input_text=None):
    return subprocess.run(
        command,
        cwd=str(cwd or PROJECT),
        input=input_text,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
        env={**os.environ, "TLM_ROOT": str(PROJECT)},
    )


def safe_slug(value):
    return re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")[:40] or "mission"


def mission_prompt(payload):
    task = str(payload.get("task") or "").strip()
    return f"""MISSION PROPRIÉTAIRE AUTORISÉE — HERMÈS

Demande:
{task}

Règles obligatoires:
1. Travaille uniquement dans ce worktree. Ne modifie jamais directement /opt/touslesmatchs.
2. Lis CURRENT_RULES.md puis CLAUDE.md avant toute modification pertinente.
3. Ne lis, n'affiche et ne modifie aucun secret, .env, mot de passe, token, clé API ou donnée bancaire.
4. Aucune opération bancaire, paiement, suppression destructive, reset --hard, changement de mot de passe ou révocation de clé.
5. Ne change pas les règles sportives actives sauf si la mission le demande explicitement; les missions sensibles sont normalement bloquées avant d'arriver ici.
6. Fais les vérifications/tests adaptés. Ne contourne pas un test valide juste pour obtenir du vert.
7. Ne déploie pas directement la production et ne pousse pas Git toi-même; le runner s'en charge après vérification.
8. Si la demande exige un service externe inaccessible depuis ce VPS, explique clairement le blocage au lieu d'inventer.
9. Termine par un résumé court en français: FAIT / TESTS / RESTE.

Exécute la mission maintenant.
"""


def protected_change(paths):
    protected_prefixes = (
        ".env", "data/", "/etc/", "secrets/", "credentials/",
    )
    return any(path == ".env" or path.startswith(protected_prefixes) for path in paths)


def execute_mission(path, payload, env):
    mission_id = safe_slug(path.stem)
    branch = "codex/telegram-" + mission_id
    worktree = pathlib.Path("/tmp") / ("tlm-owner-" + mission_id)
    result_file = RESULTS / (mission_id + ".txt")

    payload["status"] = "running"
    payload["started_at"] = now_iso()
    payload["branch"] = branch
    atomic_json(path, payload)
    telegram_send(env, f"🤖 Mission {mission_id} prise en charge par Codex.")

    fetch = run(["git", "fetch", "origin", "main"], timeout=120)
    if fetch.returncode != 0:
        raise RuntimeError("git_fetch_failed")

    if worktree.exists():
        shutil.rmtree(worktree, ignore_errors=True)
    run(["git", "worktree", "prune"], timeout=30)

    add = run(
        ["git", "worktree", "add", "-B", branch, str(worktree), "origin/main"],
        timeout=120,
    )
    if add.returncode != 0:
        raise RuntimeError("git_worktree_add_failed")

    try:
        result_file.parent.mkdir(parents=True, exist_ok=True)
        prompt = mission_prompt(payload)
        codex = run(
            [
                "codex", "exec",
                "-C", str(worktree),
                "--sandbox", "workspace-write",
                "--approve-for-me",
                "--ephemeral",
                "--color", "never",
                "-o", str(result_file),
                "-"
            ],
            cwd=worktree,
            timeout=CODEX_TIMEOUT_SECONDS,
            input_text=prompt,
        )
        payload["codex_exit_code"] = codex.returncode
        payload["codex_finished_at"] = now_iso()

        if codex.returncode != 0:
            payload["status"] = "failed"
            payload["error"] = clean(codex.stderr or codex.stdout, 1200)
            atomic_json(path, payload)
            telegram_send(env, f"❌ Mission {mission_id} : Codex a échoué. Aucun déploiement effectué.")
            return

        status = run(["git", "status", "--porcelain"], cwd=worktree, timeout=30)
        changed = []
        for line in status.stdout.splitlines():
            if len(line) >= 4:
                changed.append(line[3:].strip().split(" -> ")[-1])

        if not changed:
            payload["status"] = "completed_no_changes"
            payload["completed_at"] = now_iso()
            payload["result"] = clean(result_file.read_text(encoding="utf-8", errors="ignore") if result_file.exists() else "", 2500)
            atomic_json(path, payload)
            telegram_send(env, "✅ Mission " + mission_id + " terminée par Codex. Aucun changement de code nécessaire.\n\n" + payload["result"])
            return

        if protected_change(changed):
            payload["status"] = "blocked_protected_change"
            payload["changed_files"] = changed
            payload["completed_at"] = now_iso()
            atomic_json(path, payload)
            telegram_send(env, f"🛑 Mission {mission_id} bloquée : Codex a tenté de toucher un chemin protégé. Rien n'a été poussé.")
            return

        check = run(["git", "diff", "--check"], cwd=worktree, timeout=60)
        if check.returncode != 0:
            payload["status"] = "failed_validation"
            payload["error"] = clean(check.stderr or check.stdout, 1200)
            atomic_json(path, payload)
            telegram_send(env, f"❌ Mission {mission_id} : validation Git échouée. Rien n'a été poussé.")
            return

        run(["git", "add", "-A"], cwd=worktree, timeout=30)
        commit = run(
            ["git", "commit", "-m", f"[Hermès] Mission Telegram {mission_id}"],
            cwd=worktree,
            timeout=120,
        )
        if commit.returncode != 0:
            payload["status"] = "failed_commit"
            payload["error"] = clean(commit.stderr or commit.stdout, 1200)
            atomic_json(path, payload)
            telegram_send(env, f"❌ Mission {mission_id} : commit impossible. Rien n'a été poussé.")
            return

        push = run(["git", "push", "-u", "origin", branch], cwd=worktree, timeout=180)
        if push.returncode != 0:
            payload["status"] = "failed_push"
            payload["error"] = clean(push.stderr or push.stdout, 1200)
            atomic_json(path, payload)
            telegram_send(env, f"❌ Mission {mission_id} : push GitHub impossible.")
            return

        sha = run(["git", "rev-parse", "HEAD"], cwd=worktree, timeout=30).stdout.strip()
        result = clean(result_file.read_text(encoding="utf-8", errors="ignore") if result_file.exists() else "", 2400)
        payload.update({
            "status": "completed_branch_pushed",
            "completed_at": now_iso(),
            "changed_files": changed,
            "commit_sha": sha,
            "result": result,
        })
        atomic_json(path, payload)
        telegram_send(
            env,
            f"✅ Mission {mission_id} terminée.\n"
            f"Branche GitHub : {branch}\n"
            f"Fichiers modifiés : {len(changed)}\n"
            f"Production inchangée tant que la branche n'est pas validée.\n\n"
            + result
        )
    finally:
        run(["git", "worktree", "remove", "--force", str(worktree)], timeout=120)
        run(["git", "worktree", "prune"], timeout=30)


def eligible(payload):
    return (
        payload.get("runner_version") == RUNNER_VERSION
        and payload.get("automatic_execution") is True
        and payload.get("status") == "pending_execution"
        and payload.get("risk") != "confirmation_required"
    )


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    INBOX.mkdir(parents=True, exist_ok=True)
    RESULTS.mkdir(parents=True, exist_ok=True)
    lock = open(LOCK, "a")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return

    while True:
        env = load_env()
        for path in sorted(INBOX.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if not eligible(payload):
                continue
            try:
                execute_mission(path, payload, env)
            except Exception as error:
                payload["status"] = "failed_runner"
                payload["error"] = clean(str(error), 1200)
                payload["completed_at"] = now_iso()
                atomic_json(path, payload)
                try:
                    telegram_send(env, f"❌ Mission {path.stem} : erreur du runner {type(error).__name__}.")
                except Exception:
                    pass
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
