import os
import requests
import time
from datetime import datetime

API_KEY = os.environ.get("API_FOOTBALL_KEY") or os.environ.get("SPORTS_API_KEY", "")

# ── Football ─────────────────────────────────────────────────────────────────
FOOTBALL_HOST = "v3.football.api-sports.io"

ALLOWED_LEAGUES = {
    61, 62,       # Ligue 1, Ligue 2
    39, 40,       # Premier League, Championship
    140,          # La Liga
    78,           # Bundesliga
    135,          # Serie A
    88,           # Eredivisie
    144,          # Pro League (Belgique)
    94,           # Liga Portugal
    203,          # Super Lig (Turquie)
    2, 3, 848,    # Champions League, Europa League, Conference League
    4,            # Euro (Coupe du Monde exclue)
    253, 262,     # MLS, Liga MX
    13,           # Copa Libertadores
    169,          # Chinese Super League
    98,           # J1 League (Japon)
    292,          # K League 1 (Corée du Sud)
    636,          # Canadian Premier League
}

# ── Basketball ───────────────────────────────────────────────────────────────
BASKETBALL_HOST = "v1.basketball.api-sports.io"
ALLOWED_BASKETBALL_LEAGUES = {
    12,   # NBA
    120,  # Euroligue
}

# ── Hockey ───────────────────────────────────────────────────────────────────
HOCKEY_HOST = "v1.hockey.api-sports.io"
ALLOWED_HOCKEY_LEAGUES = {
    57,   # NHL
    50,   # KHL
}

# ── Baseball ─────────────────────────────────────────────────────────────────
BASEBALL_HOST = "v1.baseball.api-sports.io"
ALLOWED_BASEBALL_LEAGUES = {
    1,    # MLB
}

# ── Tennis ───────────────────────────────────────────────────────────────────
TENNIS_HOST = "v1.tennis.api-sports.io"

_last_call = 0


def _api_get(host, endpoint, params=None):
    global _last_call
    elapsed = time.time() - _last_call
    if elapsed < 0.25:
        time.sleep(0.25 - elapsed)
    _last_call = time.time()

    url = f"https://{host}/{endpoint}"
    headers = {"x-apisports-key": API_KEY}
    try:
        resp = requests.get(url, headers=headers, params=params or {}, timeout=15)
        resp.raise_for_status()
        return resp.json().get("response", [])
    except Exception as e:
        print(f"[API-Sports] Error on {host}/{endpoint}: {e}")
        return []


def _football_api_get(endpoint, params=None):
    return _api_get(FOOTBALL_HOST, endpoint, params)


# ── Football matches ─────────────────────────────────────────────────────────
def _get_football_matches(today):
    fixtures = _football_api_get("fixtures", {"date": today, "status": "NS", "timezone": "Europe/Paris"})
    if not fixtures:
        print(f"[Football] Aucun match NS pour {today}")
        return []

    total = len(fixtures)
    fixtures = [f for f in fixtures if f.get("league", {}).get("id") in ALLOWED_LEAGUES]
    print(f"[Football] {len(fixtures)} matchs dans les ligues autorisees (sur {total} total)")

    matches = []
    for f in fixtures:
        fixture = f.get("fixture", {})
        teams = f.get("teams", {})
        league = f.get("league", {})

        home_name = teams.get("home", {}).get("name", "?")
        away_name = teams.get("away", {}).get("name", "?")
        home_id = teams.get("home", {}).get("id")
        away_id = teams.get("away", {}).get("id")
        fixture_id = fixture.get("id")
        league_id = league.get("id")

        odds = _get_match_odds(fixture_id)
        h2h = _get_h2h(home_id, away_id)
        home_form = _get_team_form(home_id, league_id)
        away_form = _get_team_form(away_id, league_id)
        home_stats = _get_team_stats(home_id, league_id)
        away_stats = _get_team_stats(away_id, league_id)

        matches.append({
            "id": fixture_id,
            "date": fixture.get("date"),
            "home": home_name,
            "away": away_name,
            "home_id": home_id,
            "away_id": away_id,
            "league": league.get("name"),
            "league_id": league_id,
            "country": league.get("country"),
            "sport": "Foot",
            "odds": odds,
            "h2h": h2h,
            "home_form": home_form,
            "away_form": away_form,
            "home_stats": home_stats,
            "away_stats": away_stats,
            "status": fixture.get("status", {}).get("short"),
        })

    print(f"[Football] {len(matches)} matchs enrichis")
    return matches


# ── Basketball matches ───────────────────────────────────────────────────────
def _get_basketball_matches(today):
    data = _api_get(BASKETBALL_HOST, "games", {"date": today})
    if not data:
        return []

    games = [g for g in data
             if g.get("league", {}).get("id") in ALLOWED_BASKETBALL_LEAGUES
             and g.get("status", {}).get("short") == "NS"]
    print(f"[Basketball] {len(games)} matchs NBA/Euroligue")

    matches = []
    for g in games:
        teams = g.get("teams", {})
        league = g.get("league", {})
        matches.append({
            "id": f"bk-{g.get('id')}",
            "date": g.get("date"),
            "home": teams.get("home", {}).get("name", "?"),
            "away": teams.get("away", {}).get("name", "?"),
            "league": league.get("name", "Basketball"),
            "country": league.get("country", {}).get("name", "") if isinstance(league.get("country"), dict) else str(league.get("country", "")),
            "sport": "Basketball",
            "odds": {},
            "h2h": "",
            "home_form": "",
            "away_form": "",
            "home_stats": "",
            "away_stats": "",
        })
    return matches


# ── Hockey matches ───────────────────────────────────────────────────────────
def _get_hockey_matches(today):
    data = _api_get(HOCKEY_HOST, "games", {"date": today})
    if not data:
        return []

    games = [g for g in data
             if g.get("league", {}).get("id") in ALLOWED_HOCKEY_LEAGUES
             and g.get("status", {}).get("short") == "NS"]
    print(f"[Hockey] {len(games)} matchs NHL/KHL")

    matches = []
    for g in games:
        teams = g.get("teams", {})
        league = g.get("league", {})
        matches.append({
            "id": f"hk-{g.get('id')}",
            "date": g.get("date"),
            "home": teams.get("home", {}).get("name", "?"),
            "away": teams.get("away", {}).get("name", "?"),
            "league": league.get("name", "Hockey"),
            "country": league.get("country") or "",
            "sport": "Hockey",
            "odds": {},
            "h2h": "",
            "home_form": "",
            "away_form": "",
            "home_stats": "",
            "away_stats": "",
        })
    return matches


# ── Baseball matches ─────────────────────────────────────────────────────────
def _get_baseball_matches(today):
    data = _api_get(BASEBALL_HOST, "games", {"date": today})
    if not data:
        return []

    games = [g for g in data
             if g.get("league", {}).get("id") in ALLOWED_BASEBALL_LEAGUES
             and g.get("status", {}).get("short") == "NS"]
    print(f"[Baseball] {len(games)} matchs MLB")

    matches = []
    for g in games:
        teams = g.get("teams", {})
        league = g.get("league", {})
        matches.append({
            "id": f"bb-{g.get('id')}",
            "date": g.get("date"),
            "home": teams.get("home", {}).get("name", "?"),
            "away": teams.get("away", {}).get("name", "?"),
            "league": league.get("name", "MLB"),
            "country": "USA",
            "sport": "Baseball",
            "odds": {},
            "h2h": "",
            "home_form": "",
            "away_form": "",
            "home_stats": "",
            "away_stats": "",
        })
    return matches


# ── Tennis matches (ATP only) ────────────────────────────────────────────────
def _get_tennis_matches(today):
    data = _api_get(TENNIS_HOST, "games", {"date": today})
    if not data:
        return []

    games = [g for g in data
             if "atp" in str(g.get("league", {}).get("name", "")).lower()
             and "wta" not in str(g.get("league", {}).get("name", "")).lower()
             and g.get("status", {}).get("short") == "NS"]
    print(f"[Tennis] {len(games)} matchs ATP")

    matches = []
    for g in games:
        players = g.get("players", g.get("teams", {}))
        league = g.get("league", {})
        matches.append({
            "id": f"tn-{g.get('id')}",
            "date": g.get("date"),
            "home": players.get("home", {}).get("name", "?"),
            "away": players.get("away", {}).get("name", "?"),
            "league": league.get("name", "ATP"),
            "country": league.get("country") or "",
            "sport": "Tennis",
            "odds": {},
            "h2h": "",
            "home_form": "",
            "away_form": "",
            "home_stats": "",
            "away_stats": "",
        })
    return matches


# ── Main entry point ─────────────────────────────────────────────────────────
def get_todays_matches():
    if not API_KEY:
        print("[API-Sports] API_FOOTBALL_KEY manquant!")
        return []

    today = datetime.now().strftime("%Y-%m-%d")
    all_matches = []

    all_matches.extend(_get_football_matches(today))

    for fetcher, sport in [
        (_get_basketball_matches, "Basketball"),
        (_get_hockey_matches, "Hockey"),
        (_get_baseball_matches, "Baseball"),
        (_get_tennis_matches, "Tennis"),
    ]:
        try:
            all_matches.extend(fetcher(today))
        except Exception as e:
            print(f"[{sport}] Erreur: {e}")

    print(f"[API-Sports] Total: {len(all_matches)} matchs multi-sport")
    return all_matches


# ── Football enrichment helpers (unchanged) ──────────────────────────────────
def _get_match_odds(fixture_id):
    if not fixture_id:
        return {}
    data = _football_api_get("odds", {"fixture": fixture_id})
    if not data:
        return {}
    try:
        bookmakers = data[0].get("bookmakers", [])
        if not bookmakers:
            return {}
        for bk in bookmakers:
            for bet in bk.get("bets", []):
                if bet.get("name") == "Match Winner":
                    values = {v["value"]: v["odd"] for v in bet.get("values", [])}
                    return {
                        "home_win": values.get("Home"),
                        "draw": values.get("Draw"),
                        "away_win": values.get("Away"),
                        "bookmaker": bk.get("name"),
                    }
    except (IndexError, KeyError):
        pass
    return {}


def _get_h2h(home_id, away_id):
    if not home_id or not away_id:
        return ""
    data = _football_api_get("fixtures/headtohead", {"h2h": f"{home_id}-{away_id}", "last": 5})
    if not data:
        return "Aucun H2H disponible."
    lines = []
    home_wins = 0
    away_wins = 0
    draws = 0
    for f in data:
        teams = f.get("teams", {})
        goals = f.get("goals", {})
        h = goals.get("home", 0)
        a = goals.get("away", 0)
        home_t = teams.get("home", {}).get("name", "?")
        away_t = teams.get("away", {}).get("name", "?")
        date = f.get("fixture", {}).get("date", "")[:10]
        lines.append(f"  {date}: {home_t} {h}-{a} {away_t}")
        if h > a:
            if teams.get("home", {}).get("id") == home_id:
                home_wins += 1
            else:
                away_wins += 1
        elif a > h:
            if teams.get("away", {}).get("id") == away_id:
                away_wins += 1
            else:
                home_wins += 1
        else:
            draws += 1
    summary = f"H2H (5 derniers): {home_wins}V dom / {draws}N / {away_wins}V ext"
    return summary + "\n" + "\n".join(lines)


def _get_team_form(team_id, league_id):
    if not team_id:
        return ""
    params = {"team": team_id, "last": 5}
    if league_id:
        params["league"] = league_id
    data = _football_api_get("fixtures", params)
    if not data:
        return "Forme inconnue"
    results = []
    goals_for = 0
    goals_against = 0
    for f in data:
        teams = f.get("teams", {})
        goals = f.get("goals", {})
        is_home = teams.get("home", {}).get("id") == team_id
        gf = goals.get("home", 0) if is_home else goals.get("away", 0)
        ga = goals.get("away", 0) if is_home else goals.get("home", 0)
        goals_for += gf or 0
        goals_against += ga or 0
        if gf is not None and ga is not None:
            if gf > ga:
                results.append("V")
            elif gf < ga:
                results.append("D")
            else:
                results.append("N")
    form_str = "".join(results)
    return f"Forme: {form_str} | Buts: {goals_for} marques, {goals_against} encaisses (5 matchs)"


def _get_team_stats(team_id, league_id):
    if not team_id or not league_id:
        return ""
    season = datetime.now().year
    data = _football_api_get("teams/statistics", {"team": team_id, "league": league_id, "season": season})
    if not data:
        data = _football_api_get("teams/statistics", {"team": team_id, "league": league_id, "season": season - 1})
    if not data:
        return ""
    try:
        if isinstance(data, list):
            data = data[0] if data else {}
        fixtures = data.get("fixtures", {})
        goals = data.get("goals", {})
        played = fixtures.get("played", {})
        wins_data = fixtures.get("wins", {})
        draws_data = fixtures.get("draws", {})
        losses_data = fixtures.get("losses", {})

        total_played = (played.get("home", 0) or 0) + (played.get("away", 0) or 0)
        total_wins = (wins_data.get("home", 0) or 0) + (wins_data.get("away", 0) or 0)
        total_draws = (draws_data.get("home", 0) or 0) + (draws_data.get("away", 0) or 0)
        total_losses = (losses_data.get("home", 0) or 0) + (losses_data.get("away", 0) or 0)

        gf_home = goals.get("for", {}).get("total", {}).get("home", 0) or 0
        gf_away = goals.get("for", {}).get("total", {}).get("away", 0) or 0
        ga_home = goals.get("against", {}).get("total", {}).get("home", 0) or 0
        ga_away = goals.get("against", {}).get("total", {}).get("away", 0) or 0

        home_wins = wins_data.get("home", 0) or 0
        home_played = played.get("home", 0) or 0
        away_wins = wins_data.get("away", 0) or 0
        away_played = played.get("away", 0) or 0

        lines = [
            f"Saison: {total_played}J {total_wins}V {total_draws}N {total_losses}D",
            f"Buts: {gf_home + gf_away} marques, {ga_home + ga_away} encaisses",
            f"Domicile: {home_wins}V/{home_played}J | Exterieur: {away_wins}V/{away_played}J",
        ]
        return " | ".join(lines)
    except Exception:
        return ""


def format_matches_for_prompt(matches):
    if not matches:
        return "Aucun match disponible aujourd'hui."
    lines = []
    for i, m in enumerate(matches, 1):
        parts = [f"{i}. [{m['sport']}] {m['home']} vs {m['away']} - {m.get('league','')} ({m.get('country','')})"]

        o = m.get("odds", {})
        if o:
            odds_parts = []
            if o.get("home_win"):
                odds_parts.append(f"1={o['home_win']}")
            if o.get("draw"):
                odds_parts.append(f"X={o['draw']}")
            if o.get("away_win"):
                odds_parts.append(f"2={o['away_win']}")
            if odds_parts:
                bk = o.get("bookmaker", "")
                parts.append(f"   Cotes ({bk}): {', '.join(odds_parts)}")

        if m.get("h2h"):
            parts.append(f"   {m['h2h']}")

        if m.get("home_form"):
            parts.append(f"   {m['home']} — {m['home_form']}")
        if m.get("away_form"):
            parts.append(f"   {m['away']} — {m['away_form']}")

        if m.get("home_stats"):
            parts.append(f"   Stats {m['home']}: {m['home_stats']}")
        if m.get("away_stats"):
            parts.append(f"   Stats {m['away']}: {m['away_stats']}")

        lines.append("\n".join(parts))

    return "\n\n".join(lines)
