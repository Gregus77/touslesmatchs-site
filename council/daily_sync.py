"""
council/daily_sync.py — Synchronisation quotidienne automatique.

Trois étapes :
1. Mise à jour des résultats EN ATTENTE via l'API sportive
2. Recalcul et sauvegarde des statistiques (picks.json + public_stats.json)
3. Lancement du Concile Hermes si le pick du jour est absent
"""

import os
import sys
import json
import re
import logging
from datetime import datetime
from pathlib import Path

# ── Détection des chemins ─────────────────────────────────────────────────────
COUNCIL_DIR = Path(__file__).resolve().parent
REPO_ROOT = COUNCIL_DIR.parent
APP_ROOT = Path("/app") if Path("/app/council").exists() else REPO_ROOT

PICKS_JSON = REPO_ROOT / "public" / "data" / "picks.json"
PUBLIC_STATS_JSON = REPO_ROOT / "public" / "data" / "public_stats.json"

# Overrides env pour les modules du council (history_db, html_generator)
os.environ.setdefault("DB_PATH", str(APP_ROOT / "data" / "history.db"))
os.environ.setdefault("SITE_HTML_PATH", str(REPO_ROOT / "site" / "index.html"))
os.environ.setdefault("SITE_TEMPLATE_PATH", str(REPO_ROOT / "site" / "template.html"))

# Chargement .env
for _env in (APP_ROOT / ".env", REPO_ROOT / ".env"):
    if _env.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(_env)
        except ImportError:
            pass
        break

# Council dans le path Python
for _p in (str(COUNCIL_DIR), str(APP_ROOT / "council")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("daily_sync")

SPORTS_API_KEY = os.environ.get("SPORTS_API_KEY", "")
SPORTS_API_HOST = os.environ.get("SPORTS_API_HOST", "v3.football.api-sports.io")


# ── Récupération des résultats via API ────────────────────────────────────────

def fetch_finished_matches(date_str: str) -> dict:
    """
    Retourne les matchs terminés pour une date (YYYY-MM-DD).
    Clé : "home vs away" (lowercase) — Valeur : (score_str, home_goals, away_goals)
    """
    if not SPORTS_API_KEY:
        log.warning("SPORTS_API_KEY absent — résultats non récupérables")
        return {}
    try:
        import requests
    except ImportError:
        log.warning("Module 'requests' absent")
        return {}

    url = f"https://{SPORTS_API_HOST}/fixtures"
    headers = {
        "x-rapidapi-key": SPORTS_API_KEY,
        "x-rapidapi-host": SPORTS_API_HOST,
    }
    try:
        resp = requests.get(
            url, headers=headers,
            params={"date": date_str, "timezone": "Europe/Paris"},
            timeout=15,
        )
        resp.raise_for_status()
        results = {}
        finished = {"FT", "AET", "PEN", "AWD", "WO"}
        for fx in resp.json().get("response", []):
            if fx.get("fixture", {}).get("status", {}).get("short") not in finished:
                continue
            home = fx.get("teams", {}).get("home", {}).get("name", "")
            away = fx.get("teams", {}).get("away", {}).get("name", "")
            goals = fx.get("goals", {})
            hg = int(goals.get("home") or 0)
            ag = int(goals.get("away") or 0)
            results[f"{home} vs {away}".lower()] = (f"{hg}-{ag}", hg, ag)
        log.info(f"  API: {len(results)} matchs terminés le {date_str}")
        return results
    except Exception as e:
        log.warning(f"  API Football ({date_str}): {e}")
        return {}


def fuzzy_match(match_name: str, api_results: dict):
    """Correspondance souple entre nom de pick et résultats API (premiers 7 chars)."""
    key = match_name.lower()
    if key in api_results:
        return api_results[key]
    parts = key.split(" vs ")
    if len(parts) != 2:
        return None
    hp, ap = parts[0].strip(), parts[1].strip()
    for api_key, val in api_results.items():
        ap2 = api_key.split(" vs ")
        if len(ap2) != 2:
            continue
        ha, aa = ap2[0].strip(), ap2[1].strip()
        if (hp[:7] in ha or ha[:7] in hp) and (ap[:7] in aa or aa[:7] in ap):
            return val
    return None


def determine_result(prono: str, home_goals: int, away_goals: int) -> str:
    """GAGNE/PERDU depuis le pronostic et le score."""
    p = prono.lower().strip()

    if "ou nul" in p:
        return "GAGNE" if home_goals >= away_goals else "PERDU"

    m = re.search(r'(?:over|plus de)\s*(\d+(?:[.,]\d+)?)', p)
    if m:
        try:
            return "GAGNE" if (home_goals + away_goals) > float(m.group(1).replace(",", ".")) else "PERDU"
        except ValueError:
            pass

    m = re.search(r'(?:under|moins de)\s*(\d+(?:[.,]\d+)?)', p)
    if m:
        try:
            return "GAGNE" if (home_goals + away_goals) < float(m.group(1).replace(",", ".")) else "PERDU"
        except ValueError:
            pass

    if p in ("nul", "match nul", "x"):
        return "GAGNE" if home_goals == away_goals else "PERDU"

    if "victoire" in p:
        if any(w in p for w in ("extérieur", "away", "visiteur")):
            return "GAGNE" if away_goals > home_goals else "PERDU"
        return "GAGNE" if home_goals > away_goals else "PERDU"

    return "EN ATTENTE"


# ── Helpers I/O ───────────────────────────────────────────────────────────────

def load_picks() -> dict:
    with open(PICKS_JSON, encoding="utf-8") as f:
        return json.load(f)


def save_picks(data: dict):
    with open(PICKS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── Étapes ────────────────────────────────────────────────────────────────────

def step_update_results(data: dict) -> tuple:
    """Mise à jour des résultats EN ATTENTE pour les jours passés."""
    history = data.get("history", [])
    today = datetime.now().strftime("%Y-%m-%d")

    pending_dates = {
        item[0] for item in history
        if isinstance(item, list) and len(item) >= 6
        and item[5] == "EN ATTENTE"
        and item[0] < today
    }

    if not pending_dates:
        log.info("  Aucun pick passé EN ATTENTE à résoudre")
        return data, 0

    log.info(f"  Dates à vérifier: {sorted(pending_dates)}")
    api_cache = {d: fetch_finished_matches(d) for d in pending_dates}

    updated = 0
    for i, item in enumerate(history):
        if not (isinstance(item, list) and len(item) >= 6 and item[5] == "EN ATTENTE"):
            continue
        api_res = api_cache.get(item[0], {})
        if not api_res:
            continue
        match_data = fuzzy_match(item[1], api_res)
        if not match_data:
            continue
        score, hg, ag = match_data
        prono = item[2] if len(item) > 2 else ""
        result = determine_result(prono, hg, ag)
        history[i][4] = score
        history[i][5] = result
        updated += 1
        log.info(f"  {item[1]}: {score} → {result}")

    data["history"] = history
    return data, updated


def step_recalculate_stats(data: dict) -> dict:
    history = data.get("history", [])
    gagnes = sum(1 for h in history if isinstance(h, list) and len(h) > 5 and h[5] == "GAGNE")
    perdus = sum(1 for h in history if isinstance(h, list) and len(h) > 5 and h[5] == "PERDU")
    en_attente = sum(1 for h in history if isinstance(h, list) and len(h) > 5 and h[5] == "EN ATTENTE")
    total = gagnes + perdus
    data["stats"] = {
        "gagnes": gagnes,
        "perdus": perdus,
        "en_attente": en_attente,
        "taux": round(gagnes / total * 100) if total > 0 else 0,
    }
    return data


def step_update_public_stats(data: dict):
    s = data.get("stats", {})
    gagnes, perdus = s.get("gagnes", 0), s.get("perdus", 0)
    total = gagnes + perdus

    units = 0.0
    for h in data.get("history", []):
        if isinstance(h, list) and len(h) > 5:
            if h[5] == "GAGNE":
                try:
                    cote = float(h[3]) if h[3] else 0
                    units += (cote - 1) if cote > 0 else 0.75
                except (ValueError, TypeError):
                    units += 0.75
            elif h[5] == "PERDU":
                units -= 1.0

    pub = {
        "winRate": round(gagnes / total * 100) if total > 0 else 0,
        "won": gagnes,
        "lost": perdus,
        "played": total,
        "units": (f"+{round(units, 1)}u" if units >= 0 else f"{round(units, 1)}u"),
        "label": f"Taux de réussite ({total} picks joués)",
        "verified": f"{gagnes}V / {perdus}D",
        "updatedAt": datetime.now().strftime("%Y-%m-%d"),
    }
    with open(PUBLIC_STATS_JSON, "w", encoding="utf-8") as f:
        json.dump(pub, f, ensure_ascii=False, indent=2)
    log.info(f"  public_stats.json: {pub['winRate']}% win — {pub['units']}")


def pick_needed_today(data: dict) -> bool:
    today = datetime.now().strftime("%Y-%m-%d")
    c = data.get("currentPick", {})
    if c.get("date") != today:
        return True
    if c.get("home") in ("Analyse en cours", "", None):
        return True
    return False


def step_run_hermes(data: dict) -> dict:
    """Lance le Concile et injecte le résultat dans picks.json."""
    try:
        import importlib
        import hermes
        importlib.reload(hermes)
        decision = hermes.run_council()
    except Exception as e:
        log.error(f"Erreur Concile Hermes: {e}", exc_info=True)
        return data

    today = datetime.now().strftime("%Y-%m-%d")
    match_str = decision.get("match") or ""
    vs_parts = match_str.split(" vs ") if " vs " in match_str else [match_str, ""]

    if decision.get("decision") == "PICK":
        data["currentPick"] = {
            "date": today,
            "sport": decision.get("sport", ""),
            "league": decision.get("league", ""),
            "time": decision.get("time", ""),
            "home": vs_parts[0].strip(),
            "away": vs_parts[1].strip() if len(vs_parts) > 1 else "",
            "homeLogo": "",
            "awayLogo": "",
            "prono": decision.get("bet", ""),
            "bet": "1",
            "cote": str(decision.get("odds") or ""),
            "confidence": decision.get("confidence", 0),
            "confidenceTg": "",
            "status": "EN ATTENTE",
            "score": "",
            "riskLevel": "",
            "stakeAdvice": "",
            "publicLabel": "",
            "publicWarning": "",
        }
        log.info(f"  PICK: {match_str} → {decision.get('bet')} @ {decision.get('odds')}")
    else:
        data["currentPick"] = {
            "date": today,
            "sport": "", "league": "", "time": "",
            "home": "NOPICK", "away": "",
            "homeLogo": "", "awayLogo": "",
            "prono": "Pas de pick public aujourd'hui",
            "bet": "NOPICK", "cote": "",
            "confidence": 0, "confidenceTg": "",
            "status": "NOPICK", "score": "",
            "riskLevel": "", "stakeAdvice": "",
            "publicLabel": "", "publicWarning": "",
        }
        log.info("  NOPICK — aucun match qualifié aujourd'hui")

    return data


# ── Point d'entrée ────────────────────────────────────────────────────────────

def main():
    sep = "=" * 60
    log.info(sep)
    log.info(f"DAILY SYNC — {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    log.info(f"Env: {'Docker' if APP_ROOT == Path('/app') else str(REPO_ROOT)}")
    log.info(sep)

    data = load_picks()
    log.info(f"picks.json chargé — {len(data.get('history', []))} entrées")

    log.info("► Étape 1 — Résultats EN ATTENTE")
    data, n = step_update_results(data)
    log.info(f"  {n} résultat(s) mis à jour")

    log.info("► Étape 2 — Statistiques")
    data = step_recalculate_stats(data)
    s = data["stats"]
    log.info(f"  {s['gagnes']}V / {s['perdus']}D / {s['en_attente']} en attente — {s['taux']}% winrate")

    save_picks(data)
    log.info("  picks.json sauvegardé")

    log.info("► Étape 3 — Stats publiques")
    step_update_public_stats(data)

    log.info("► Étape 4 — Pick du jour")
    if pick_needed_today(data):
        log.info("  Lancement du Concile Hermes...")
        data = step_run_hermes(data)
        save_picks(data)
        log.info("  picks.json mis à jour avec le pick du jour")
    else:
        log.info(f"  Pick déjà défini pour le {data['currentPick'].get('date')}")

    log.info(sep)
    log.info("DAILY SYNC TERMINÉ")
    log.info(sep)


if __name__ == "__main__":
    main()
