import os
import requests
import json
from datetime import datetime, timedelta

# Support both variable names (docker-compose uses API_SPORTS_KEY)
SPORTS_API_KEY = os.environ.get("SPORTS_API_KEY") or os.environ.get("API_SPORTS_KEY", "")
SPORTS_API_HOST = os.environ.get("SPORTS_API_HOST", "v3.football.api-sports.io")
SPORTS_API_PROVIDER = os.environ.get("SPORTS_API_PROVIDER", "api-football")


def get_todays_matches():
    """Fetch today's matches from the configured sports API."""
    today = datetime.now().strftime("%Y-%m-%d")
    provider = SPORTS_API_PROVIDER.lower()

    if provider == "api-football":
        return _fetch_api_football(today)
    elif provider == "thesportsdb":
        return _fetch_thesportsdb(today)
    elif provider == "odds-api":
        return _fetch_odds_api(today)
    else:
        return _fetch_api_football(today)


def _fetch_api_football(date):
    url = f"https://{SPORTS_API_HOST}/fixtures"
    headers = {
        "x-rapidapi-key": SPORTS_API_KEY,
        "x-rapidapi-host": SPORTS_API_HOST,
    }
    params = {"date": date, "status": "NS", "timezone": "Europe/Paris"}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        matches = []
        for f in data.get("response", []):
            fixture = f.get("fixture", {})
            teams = f.get("teams", {})
            league = f.get("league", {})
            odds = _get_odds_api_football(fixture.get("id"))
            matches.append({
                "id": fixture.get("id"),
                "date": fixture.get("date"),
                "home": teams.get("home", {}).get("name"),
                "away": teams.get("away", {}).get("name"),
                "league": league.get("name"),
                "country": league.get("country"),
                "sport": "Foot",
                "odds": odds,
                "status": fixture.get("status", {}).get("short"),
            })
        return matches
    except Exception as e:
        print(f"[SportsAPI] Error fetching API-Football: {e}")
        return _get_fallback_matches()


def _get_odds_api_football(fixture_id):
    if not fixture_id:
        return {}
    url = f"https://{SPORTS_API_HOST}/odds"
    headers = {
        "x-rapidapi-key": SPORTS_API_KEY,
        "x-rapidapi-host": SPORTS_API_HOST,
    }
    params = {"fixture": fixture_id}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        data = resp.json()
        bookmakers = data.get("response", [{}])
        if bookmakers and bookmakers[0].get("bookmakers"):
            bets = bookmakers[0]["bookmakers"][0].get("bets", [])
            for bet in bets:
                if bet.get("name") == "Match Winner":
                    values = {v["value"]: v["odd"] for v in bet.get("values", [])}
                    return {
                        "home_win": values.get("Home"),
                        "draw": values.get("Draw"),
                        "away_win": values.get("Away"),
                    }
    except Exception:
        pass
    return {}


def _fetch_thesportsdb(date):
    """TheSportsDB free tier — multi-sport."""
    SPORT_MAP = {
        "Soccer": "Foot",
        "Basketball": "Basketball",
        "Ice Hockey": "Hockey",
        "Tennis": "Tennis",
        "Baseball": "Baseball",
        "Rugby": "Rugby",
        "American Football": "NFL",
    }
    all_matches = []
    for sport_en, sport_fr in SPORT_MAP.items():
        url = "https://www.thesportsdb.com/api/v1/json/3/eventsday.php"
        params = {"d": date, "s": sport_en}
        try:
            resp = requests.get(url, params=params, timeout=15)
            data = resp.json()
            for event in (data.get("events") or []):
                all_matches.append({
                    "id": event.get("idEvent"),
                    "date": event.get("dateEvent"),
                    "home": event.get("strHomeTeam"),
                    "away": event.get("strAwayTeam"),
                    "league": event.get("strLeague"),
                    "country": event.get("strCountry"),
                    "sport": sport_fr,
                    "odds": {},
                    "status": "NS",
                })
        except Exception as e:
            print(f"[SportsAPI] TheSportsDB/{sport_en} error: {e}")
    return all_matches if all_matches else _get_fallback_matches()


def _fetch_odds_api(date):
    """The Odds API — multi-sport."""
    SPORT_KEYS = {
        "soccer_france_ligue1": "Foot", "soccer_spain_la_liga": "Foot",
        "soccer_england_league1": "Foot", "soccer_germany_bundesliga": "Foot",
        "soccer_italy_serie_a": "Foot", "soccer_uefa_champs_league": "Foot",
        "basketball_nba": "Basketball", "basketball_euroleague": "Basketball",
        "icehockey_nhl": "Hockey", "icehockey_sweden_hockey_league": "Hockey",
        "tennis_atp_french_open": "Tennis", "tennis_wta_french_open": "Tennis",
        "baseball_mlb": "Baseball", "rugbyleague_nrl": "Rugby",
    }
    all_matches = []
    for sport_key, sport_fr in SPORT_KEYS.items():
        url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds/"
        params = {
            "apiKey": SPORTS_API_KEY,
            "regions": "eu",
            "markets": "h2h",
            "dateFormat": "iso",
            "commenceTimeFrom": f"{date}T00:00:00Z",
            "commenceTimeTo": f"{date}T23:59:59Z",
        }
        try:
            resp = requests.get(url, params=params, timeout=10)
            if resp.status_code != 200:
                continue
            for game in resp.json():
                home = game.get("home_team")
                away = game.get("away_team")
                odds = {}
                for bk in game.get("bookmakers", [])[:1]:
                    for mkt in bk.get("markets", []):
                        if mkt["key"] == "h2h":
                            for o in mkt.get("outcomes", []):
                                if o["name"] == home:
                                    odds["home_win"] = o["price"]
                                elif o["name"] == away:
                                    odds["away_win"] = o["price"]
                                else:
                                    odds["draw"] = o["price"]
                all_matches.append({
                    "id": game.get("id"),
                    "date": game.get("commence_time"),
                    "home": home,
                    "away": away,
                    "league": game.get("sport_title"),
                    "country": "",
                    "sport": sport_fr,
                    "odds": odds,
                    "status": "NS",
                })
        except Exception as e:
            print(f"[SportsAPI] Odds-API/{sport_key} error: {e}")
    return all_matches if all_matches else _get_fallback_matches()


def fetch_match_result(home, away, date_str):
    """
    Cherche le score final d'un match terminé.
    Retourne dict {score, home_goals, away_goals} ou None si non trouvé.
    date_str format: "DD/MM/YYYY"
    """
    provider = SPORTS_API_PROVIDER.lower()
    try:
        # Convertir date DD/MM/YYYY → YYYY-MM-DD
        d = datetime.strptime(date_str, "%d/%m/%Y")
        api_date = d.strftime("%Y-%m-%d")
    except Exception:
        api_date = date_str

    if provider == "api-football" and SPORTS_API_KEY:
        return _fetch_result_api_football(home, away, api_date)
    elif provider == "thesportsdb":
        return _fetch_result_thesportsdb(home, away, api_date)
    else:
        return _fetch_result_api_football(home, away, api_date)


def _fetch_result_api_football(home, away, date):
    """Cherche le résultat sur api-football (status=FT = Full Time)."""
    url = f"https://{SPORTS_API_HOST}/fixtures"
    headers = {"x-rapidapi-key": SPORTS_API_KEY, "x-rapidapi-host": SPORTS_API_HOST}
    # Chercher aussi la veille et lendemain pour couvrir les fuseaux horaires
    for offset in [0, -1, 1]:
        d = (datetime.strptime(date, "%Y-%m-%d") + timedelta(days=offset)).strftime("%Y-%m-%d")
        params = {"date": d, "status": "FT", "timezone": "Europe/Paris"}
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=15)
            data = resp.json()
            home_l = home.lower()
            away_l = away.lower()
            for f in data.get("response", []):
                th = f.get("teams", {}).get("home", {}).get("name", "").lower()
                ta = f.get("teams", {}).get("away", {}).get("name", "").lower()
                # Match partiel sur le nom (ex: "Turquie" = "Turkey")
                if (home_l[:4] in th or th[:4] in home_l) and (away_l[:4] in ta or ta[:4] in away_l):
                    goals = f.get("goals", {})
                    gh = goals.get("home")
                    ga = goals.get("away")
                    if gh is not None and ga is not None:
                        return {"score": f"{gh}-{ga}", "home_goals": gh, "away_goals": ga}
        except Exception as e:
            print(f"[SportsAPI] fetch_result error: {e}")
    return None


def _fetch_result_thesportsdb(home, away, date):
    """Cherche le résultat sur TheSportsDB."""
    for sport in ["Soccer", "Basketball", "Ice Hockey", "Tennis"]:
        url = "https://www.thesportsdb.com/api/v1/json/3/eventsday.php"
        try:
            resp = requests.get(url, params={"d": date, "s": sport}, timeout=10)
            for ev in (resp.json().get("events") or []):
                h = (ev.get("strHomeTeam") or "").lower()
                a = (ev.get("strAwayTeam") or "").lower()
                if home.lower()[:4] in h and away.lower()[:4] in a:
                    gh = ev.get("intHomeScore")
                    ga = ev.get("intAwayScore")
                    if gh is not None and ga is not None:
                        return {"score": f"{gh}-{ga}", "home_goals": int(gh), "away_goals": int(ga)}
        except Exception:
            pass
    return None


def evaluate_bet_result(bet_type, home_goals, away_goals, cote=None):
    """
    Détermine si un pari est gagné ou perdu selon le score final.
    bet_type: "1", "2", "X", "1X", "X2", "Over 2.5", "Under 2.5", "BTTS", etc.
    Retourne "win" ou "loss".
    """
    h, a = int(home_goals), int(away_goals)
    total = h + a
    bt = bet_type.strip().upper()

    if bt == "1":      return "win" if h > a else "loss"
    if bt == "2":      return "win" if a > h else "loss"
    if bt == "X":      return "win" if h == a else "loss"
    if bt == "1X":     return "win" if h >= a else "loss"
    if bt == "X2":     return "win" if a >= h else "loss"
    if bt == "12":     return "win" if h != a else "loss"
    if "OVER 2.5" in bt:  return "win" if total > 2 else "loss"
    if "UNDER 2.5" in bt: return "win" if total < 3 else "loss"
    if "OVER 1.5" in bt:  return "win" if total > 1 else "loss"
    if "UNDER 1.5" in bt: return "win" if total < 2 else "loss"
    if "OVER 3.5" in bt:  return "win" if total > 3 else "loss"
    if "BTTS" in bt:   return "win" if h > 0 and a > 0 else "loss"
    return "loss"  # type inconnu = conservateur


def _get_fallback_matches():
    """Returns empty list - council will output NOPICK."""
    print("[SportsAPI] Using fallback - no matches available")
    return []


def format_matches_for_prompt(matches):
    """Format match list as readable text for AI prompts."""
    if not matches:
        return "Aucun match disponible aujourd'hui."
    lines = []
    for i, m in enumerate(matches, 1):
        odds_str = ""
        if m.get("odds"):
            o = m["odds"]
            parts = []
            if o.get("home_win"):
                parts.append(f"1={o['home_win']}")
            if o.get("draw"):
                parts.append(f"X={o['draw']}")
            if o.get("away_win"):
                parts.append(f"2={o['away_win']}")
            if parts:
                odds_str = f" | Cotes: {', '.join(parts)}"
        lines.append(
            f"{i}. [{m['sport']}] {m['home']} vs {m['away']} "
            f"- {m.get('league','')} ({m.get('country','')})"
            f"{odds_str}"
        )
    return "\n".join(lines)
