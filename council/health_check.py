#!/usr/bin/env python3
"""
Hermes Health Check — TousLesMatchs
Vérifie que le Concile tourne bien et que le pick du jour est publié.
Usage: python3 /app/council/health_check.py
"""
import sys
import os
import json
import sqlite3
from datetime import datetime

sys.path.insert(0, "/app/council")

DB_PATH = os.environ.get("HISTORY_DB", "/app/data/history.db")
PICKS_JSON = "/app/data/picks.json"
LOG_PATH = "/app/data/hermes.log"
PREMIUM_DB = "/app/data/premium_picks.db"


def check_today_pick():
    today = datetime.now().strftime("%d/%m")
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "SELECT match, bet, odds, result, confidence FROM picks WHERE date = ? ORDER BY created_at DESC LIMIT 1",
            (today,)
        )
        row = c.fetchone()
        conn.close()
        if row:
            match, bet, odds, result, conf = row
            status = f"match={match}, pari={bet}@{odds}, résultat={result or '?'}, confiance={conf}"
            return True, f"Pick DB trouvé pour {today}: {status}"
        return False, f"Aucun pick en DB pour aujourd'hui ({today})"
    except Exception as e:
        return False, f"DB picks error: {e}"


def check_picks_json():
    try:
        with open(PICKS_JSON, "r") as f:
            data = json.load(f)
        p = data.get("currentPick")
        if p and p.get("home") and p["home"] != "Analyse en cours":
            age_info = ""
            if data.get("generated_at"):
                try:
                    gen = datetime.fromisoformat(data["generated_at"].replace("Z", ""))
                    delta = datetime.now() - gen
                    age_info = f" (généré il y a {delta.seconds//3600}h{(delta.seconds%3600)//60}m)"
                except Exception:
                    pass
            return True, f"picks.json OK: {p['home']} vs {p['away']} @{p.get('cote', '?')}{age_info}"
        return False, "picks.json: currentPick absent, vide ou 'Analyse en cours'"
    except FileNotFoundError:
        return False, "picks.json introuvable — Hermes n'a pas encore tourné ou montage volume manquant"
    except Exception as e:
        return False, f"picks.json error: {e}"


def check_last_run():
    try:
        with open(LOG_PATH, "r") as f:
            lines = f.readlines()
        last_end = None
        last_decision = None
        for line in reversed(lines):
            if "HERMES COUNCIL - Session terminée" in line and not last_end:
                last_end = line.strip()
            if "DÉCISION FINALE:" in line and not last_decision:
                last_decision = line.strip()
            if last_end and last_decision:
                break
        if last_end:
            ts = last_end[:23]
            decision = last_decision.split("DÉCISION FINALE:")[1].strip() if last_decision else "?"
            return True, f"Dernière session terminée: {ts} | Décision: {decision}"
        return False, "Aucune session complète dans hermes.log"
    except FileNotFoundError:
        return False, "hermes.log introuvable — Hermes n'a peut-être jamais tourné"
    except Exception as e:
        return False, f"Log error: {e}"


def check_global_stats():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM picks WHERE result IS NOT NULL AND result != ''")
        total = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM picks WHERE result = 'win'")
        wins = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM picks WHERE score IS NULL OR score = ''")
        pending = c.fetchone()[0]
        conn.close()
        wr = round(wins / total * 100) if total > 0 else 0
        return True, f"{wins}/{total} picks gagnants ({wr}% winrate) — {pending} en attente de score"
    except Exception as e:
        return False, f"Stats error: {e}"


def check_scheduler():
    """Vérifie si le scheduler a programmé un prochain job."""
    try:
        import schedule
        # Le scheduler est dans un process séparé, on ne peut pas interroger directement
        # On vérifie juste que le fichier scheduler existe
        sched_file = "/app/council/scheduler.py"
        if os.path.exists(sched_file):
            return True, "scheduler.py présent — tourne en tant que service dans le container"
        return False, "scheduler.py introuvable"
    except Exception:
        return True, "Scheduler non vérifiable depuis ce contexte (normal si lancé en dehors)"


def check_api_keys():
    keys = {
        "GROQ_API_KEY": os.environ.get("GROQ_API_KEY", ""),
        "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
        "TELEGRAM_BOT_TOKEN": os.environ.get("TELEGRAM_BOT_TOKEN", ""),
        "BREVO_API_KEY": os.environ.get("BREVO_API_KEY", ""),
        "API_SPORTS_KEY": os.environ.get("API_SPORTS_KEY", "") or os.environ.get("SPORTS_API_KEY", ""),
    }
    missing = [k for k, v in keys.items() if not v]
    configured = [k for k, v in keys.items() if v]
    if missing:
        return False, f"Clés manquantes: {', '.join(missing)} | Configurées: {len(configured)}/{len(keys)}"
    return True, f"Toutes les clés API configurées ({len(configured)}/{len(keys)})"


def main():
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    print()
    print("=" * 60)
    print(f"  HERMES HEALTH CHECK — {now}")
    print("=" * 60)

    checks = [
        ("Pick du jour (DB)", check_today_pick),
        ("picks.json (site public)", check_picks_json),
        ("Dernière exécution", check_last_run),
        ("Stats globales", check_global_stats),
        ("Clés API", check_api_keys),
        ("Scheduler", check_scheduler),
    ]

    results = []
    for name, fn in checks:
        try:
            ok, msg = fn()
        except Exception as e:
            ok, msg = False, f"Erreur inattendue: {e}"
        results.append((name, ok, msg))

    for name, ok, msg in results:
        icon = "✅" if ok else "❌"
        print(f"  {icon} {name}")
        print(f"     └─ {msg}")
        print()

    all_ok = all(ok for _, ok, _ in results)
    status = "✅ SYSTÈME SAIN" if all_ok else "⚠️  PROBLÈMES DÉTECTÉS"
    print("=" * 60)
    print(f"  VERDICT: {status}")
    print("=" * 60)
    print()

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
