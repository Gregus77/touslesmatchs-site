import os
import requests
import json
from datetime import datetime

SPORTS_API_KEY = os.environ.get("SPORTS_API_KEY", "")
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
    """TheSportsDB free tier."""
    url = f"https://www.thesportsdb.com/api/v1/json/3/eventsday.php"
    params = {"d": date, "s": "Soccer"}
    try:
        resp = requests.get(url, params=params, timeout=15)
        data = resp.json()
        matches = []
        for event in (data.get("events") or []):
            matches.append({
                "id": event.get("idEvent"),
                "date": event.get("dateEvent"),
                "home": event.get("strHomeTeam"),
                "away": event.get("strAwayTeam"),
                "league": event.get("strLeague"),
                "country": event.get("strCountry"),
                "sport": event.get("strSport", "Foot"),
                "odds": {},
                "status": "NS",
            })
        return matches
    except Exception as e:
        print(f"[SportsAPI] TheSportsDB error: {e}")
        return _get_fallback_matches()


def _fetch_odds_api(date):
    url = "https://api.the-odds-api.com/v4/sports/upcoming/odds/"
    params = {
        "apiKey": SPORTS_API_KEY,
        "regions": "eu",
        "markets": "h2h",
        "dateFormat": "iso",
        "commenceTimeFrom": f"{date}T00:00:00Z",
        "commenceTimeTo": f"{date}T23:59:59Z",
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        data = resp.json()
        matches = []
        for game in data:
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
            matches.append({
                "id": game.get("id"),
                "date": game.get("commence_time"),
                "home": home,
                "away": away,
                "league": game.get("sport_title"),
                "country": "",
                "sport": "Foot",
                "odds": odds,
                "status": "NS",
            })
        return matches
    except Exception as e:
        print(f"[SportsAPI] Odds-API error: {e}")
        return _get_fallback_matches()


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
