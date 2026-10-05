#!/usr/bin/env python3
"""Authenticated Telegram -> Codex mission runner.

Only missions explicitly marked automatic_execution=true and risk=review_required
are processed. Sensitive/confirmation_required missions are never executed.

Codex works in an isolated Git worktree. The runner, not Codex, owns Git push.
A fast-forward push to main is allowed only when:
- the owner explicitly asked to deploy / put in production;
- the changed paths are outside protected deployment/secret/payment areas;
- origin/main did not move while Codex was working;
- basic syntax and diff checks passed.
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
import urllib.parse
import urllib.request

PROJECT = pathlib.Path(os.environ.get("TLM_ROOT", "/opt/touslesmatchs"))
DATA = PROJECT / "data"
INBOX = DATA / "owner_missions"
RUNS = DATA / "owner_runs"
WORKTREE_ROOT = pathlib.Path("/tmp/tlm-owner-missions")
LOCK_FILE = DATA / "owner_mission_runner.lock"
POLL_SECONDS = 5
CODEX_TIMEOUT_SECONDS = 20 * 60

PROTECTED_AUTO_DEPLOY = (
    ".github/workflows/",
    ".env",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
    "deploy/",
)
PROTECTED_KEYWORDS = (
    "stripe", "payment", "paiement", "bank", "banque", "secret", "password",
    "mot de passe", "token", "credential", "api_key", "api-key",
)


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def load_dotenv(path):
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip().strip('"').strip("'")
        if name and name not in os.environ:
            os.environ[name] = value


def run(command, cwd=None, timeout=120, check=False):
    result = subprocess.run(
        command,
        cwd=str(cwd or PROJECT),
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
        env=os.environ.copy(),
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            "command_failed: " + " ".join(command[:4]) + " :: "
            + clean(result.stderr or result.stdout)[:700]
        )
    return result


def write_json_atomic(path, payload):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def telegram_send(text):
    token = (os.environ.get("HERMES_ADMIN_TLM_BOT") or os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()
    if not token or not chat_id:
        return False
    payload = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": str(text)[:3900],
        "disable_web_page_preview": "true",
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://api.telegram.org/bot" + token + "/sendMessage",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.load(response)
        return bool(body.get("ok"))
    except Exception:
        return False


def eligible(payload):
    return bool(
        payload.get("status") == "pending_review"
        and payload.get("automatic_execution") is True
        and payload.get("risk") == "review_required"
        and clean(payload.get("task"))
    )


def safe_branch_piece(value):
    value = re.sub(r"[^a-zA-Z0-9._-]+", "-", str(value or "mission")).strip("-").lower()
    return value[:40] or "mission"


def changed_paths(worktree):
    result = run(["git", "status", "--porcelain"], cwd=worktree, check=True)
    paths = []
    for line in result.stdout.splitlines():
        raw = line[3:].strip() if len(line) >= 4 else ""
        if " -> " in raw:
            raw = raw.split(" -> ", 1)[1]
        if raw:
            paths.append(raw)
    return sorted(set(paths))


def protected_for_auto_deploy(paths):
    lowered = [p.lower() for p in paths]
    for path in lowered:
        if any(path == prefix.lower() or path.startswith(prefix.lower()) for prefix in PROTECTED_AUTO_DEPLOY):
            return True, path
        if any(keyword in path for keyword in PROTECTED_KEYWORDS):
            return True, path
    return False, None


def validate_worktree(worktree, paths):
    run(["git", "diff", "--check"], cwd=worktree, check=True)

    for path in paths:
        target = worktree / path
        if not target.exists() or target.is_dir():
            continue
        suffix = target.suffix.lower()
        if suffix == ".py":
            run(["python3", "-m", "py_compile", str(target)], cwd=worktree, check=True)
        elif suffix in (".js", ".mjs", ".cjs"):
            run(["node", "--check", str(target)], cwd=worktree, check=True)
        elif suffix == ".json":
            json.loads(target.read_text(encoding="utf-8"))

    # Run newly/explicitly changed small tests when they are directly executable.
    for path in paths:
        name = pathlib.Path(path).name
        target = worktree / path
        if not target.exists() or not target.is_file() or not name.startswith("test_"):
            continue
        if target.suffix == ".py":
            run(["python3", str(target)], cwd=worktree, timeout=180, check=True)
        elif target.suffix == ".js":
            run(["node", str(target)], cwd=worktree, timeout=180, check=True)


def codex_prompt(payload):
    task = clean(payload.get("task"))
    return f"""Mission propriétaire authentifiée reçue via Telegram Hermès.

Tâche :
{task}

Règles impératives :
1. Travaille uniquement dans ce dépôt/worktree.
2. Lis CURRENT_RULES.md puis PROJECT_STATE.md si présents, et donne priorité aux décisions les plus récentes.
3. N'ouvre, n'affiche et ne modifie jamais .env, clés API, tokens, mots de passe, secrets, données bancaires ou données personnelles.
4. Ne fais aucun paiement, virement, suppression destructive, changement de secret ou changement de stratégie sportive.
5. Ne pousse rien vers GitHub, ne merge rien et ne déploie rien : le runner sécurisé s'occupe de Git après tes tests.
6. Fais réellement les modifications techniques demandées lorsqu'elles sont sûres et dans le périmètre du dépôt.
7. Lance les tests pertinents. Ne prétends jamais qu'un test a réussi sans l'avoir exécuté.
8. Si la demande n'est pas réalisable depuis ce dépôt, ne fabrique rien : explique précisément le blocage dans ton message final.
9. Le message final doit être court et exploitable en français : fait / tests / reste éventuel.
"""


def process_mission(path):
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not eligible(payload):
        return False

    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    payload["status"] = "running"
    payload["started_at"] = started
    write_json_atomic(path, payload)

    mission_id = safe_branch_piece(payload.get("message_id") or path.stem)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
    branch = f"codex/telegram-owner-{mission_id}-{stamp}"
    worktree = WORKTREE_ROOT / branch.replace("/", "-")
    result_file = RUNS / (path.stem + "-codex.txt")
    RUNS.mkdir(mode=0o700, parents=True, exist_ok=True)
    WORKTREE_ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)

    base_sha = None
    main_pushed = False
    pushed_branch = False
    changes = []
    codex_message = ""

    try:
        run(["git", "fetch", "origin", "main"], check=True)
        base_sha = run(["git", "rev-parse", "origin/main"], check=True).stdout.strip()
        if worktree.exists():
            shutil.rmtree(worktree, ignore_errors=True)

        run(["git", "worktree", "add", "-b", branch, str(worktree), "origin/main"], check=True)

        command = [
            "codex", "exec",
            "--ephemeral",
            "--sandbox", "workspace-write",
            "--approve-for-me",
            "-C", str(worktree),
            "-o", str(result_file),
            codex_prompt(payload),
        ]
        result = run(command, cwd=worktree, timeout=CODEX_TIMEOUT_SECONDS)
        if result.returncode != 0:
            raise RuntimeError("codex_failed: " + clean(result.stderr or result.stdout)[:900])

        if result_file.exists():
            codex_message = clean(result_file.read_text(encoding="utf-8", errors="ignore"))[:2600]
        else:
            codex_message = clean(result.stdout)[-2600:]

        changes = changed_paths(worktree)
        if changes:
            validate_worktree(worktree, changes)
            run(["git", "config", "user.name", "Hermes Owner Runner"], cwd=worktree, check=True)
            run(["git", "config", "user.email", "hermes-owner@localhost"], cwd=worktree, check=True)
            run(["git", "add", "-A"], cwd=worktree, check=True)
            run(["git", "commit", "-m", f"[Telegram] Owner mission {mission_id}"], cwd=worktree, check=True)
            commit_sha = run(["git", "rev-parse", "HEAD"], cwd=worktree, check=True).stdout.strip()
            run(["git", "push", "origin", "HEAD:refs/heads/" + branch], cwd=worktree, timeout=180, check=True)
            pushed_branch = True
            payload["branch"] = branch
            payload["commit_sha"] = commit_sha

            if payload.get("deploy_requested") is True:
                protected, protected_path = protected_for_auto_deploy(changes)
                if protected:
                    payload["deploy_blocked_reason"] = "protected_path:" + str(protected_path)
                else:
                    remote_main = run(
                        ["git", "ls-remote", "origin", "refs/heads/main"],
                        cwd=worktree, check=True
                    ).stdout.split()[0]
                    if remote_main == base_sha:
                        run(["git", "push", "origin", "HEAD:refs/heads/main"], cwd=worktree, timeout=180, check=True)
                        main_pushed = True
                    else:
                        payload["deploy_blocked_reason"] = "origin_main_moved"
        payload["changed_paths"] = changes
        payload["main_pushed"] = main_pushed
        payload["branch_pushed"] = pushed_branch
        payload["status"] = "completed"
        payload["finished_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        payload["codex_result"] = codex_message
        write_json_atomic(path, payload)

        if changes:
            if main_pushed:
                headline = "✅ Mission Codex terminée et envoyée sur main."
            else:
                headline = "✅ Mission Codex terminée sur une branche isolée."
            detail = f"Branche : {branch}\nFichiers modifiés : {len(changes)}."
            if payload.get("deploy_requested") and not main_pushed:
                detail += "\n⚠️ Mise en production non poussée automatiquement : " + payload.get("deploy_blocked_reason", "garde-fou")
        else:
            headline = "✅ Mission Codex terminée — aucune modification nécessaire."
            detail = ""

        telegram_send(
            headline
            + ("\n" + detail if detail else "")
            + ("\n\n" + codex_message if codex_message else "")
        )
        return True

    except Exception as error:
        payload["status"] = "failed"
        payload["finished_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        payload["error"] = clean(str(error))[:1000]
        write_json_atomic(path, payload)
        telegram_send("❌ Mission Codex en échec.\n" + payload["error"])
        return True
    finally:
        try:
            if worktree.exists():
                run(["git", "worktree", "remove", "--force", str(worktree)], timeout=60)
        except Exception:
            pass
        try:
            run(["git", "branch", "-D", branch], timeout=30)
        except Exception:
            pass


def next_mission():
    INBOX.mkdir(mode=0o700, parents=True, exist_ok=True)
    candidates = sorted(INBOX.glob("*.json"), key=lambda p: (p.stat().st_mtime, p.name))
    for path in candidates:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if eligible(payload):
            return path
    return None


def main():
    load_dotenv(PROJECT / ".env")
    DATA.mkdir(parents=True, exist_ok=True)
    lock = open(LOCK_FILE, "a")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return

    while True:
        path = next_mission()
        if not path:
            time.sleep(POLL_SECONDS)
            continue
        process_mission(path)


if __name__ == "__main__":
    main()
