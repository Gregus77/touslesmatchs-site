from pathlib import Path
import json
import re

ROOT = Path("/opt/touslesmatchs")
DATA = ROOT / "data" / "picks.json"
PUBLIC_DATA = ROOT / "public" / "data" / "picks.json"
DIST_DATA = ROOT / "dist" / "data" / "picks.json"
APP = ROOT / "src" / "App.js"

def js(value):
    return json.dumps(value, ensure_ascii=False)

data = json.loads(DATA.read_text(encoding="utf-8"))
pick = data.get("currentPick", {})

required = ["league", "time", "home", "away", "prono", "bet", "cote", "confidence", "confidenceTg"]

# Fallback visuel quand aucun pick n'est disponible
if pick.get("status") == "NOPICK" or pick.get("bet") == "NOPICK" or pick.get("home") == "Aucun pick public":
    pick["homeLogo"] = pick.get("homeLogo") or "https://www.touslesmatchs.com/logo192.png"
    pick["awayLogo"] = pick.get("awayLogo") or "https://www.touslesmatchs.com/logo512.png"
    pick["home"] = pick.get("home") or "Aucun pick public"
    pick["away"] = pick.get("away") or "Analyse en attente"

missing = [k for k in required if k not in pick]
if missing:
    raise SystemExit("Champs manquants dans data/picks.json: " + ", ".join(missing))

app = APP.read_text(encoding="utf-8")

new_pick = f'''var PICK = {{
  league:{js(pick.get("league", ""))}, time:{js(pick.get("time", ""))},
  home:{js(pick.get("home", ""))}, away:{js(pick.get("away", ""))},
  homeLogo:{js(pick.get("homeLogo", ""))}, awayLogo:{js(pick.get("awayLogo", ""))},
  prono:{js(pick.get("prono", ""))}, bet:{js(pick.get("bet", ""))},
  cote:{js(pick.get("cote", ""))}, confidence:{pick.get("confidence", 0)}, confidenceTg:{js(pick.get("confidenceTg", ""))},
}};'''

app = re.sub(r'var PICK = \{.*?\n\};', new_pick, app, count=1, flags=re.S)

history = data.get("history", [])
current_status = pick.get("status", "EN ATTENTE")
current_match = f'{pick.get("home", "")} vs {pick.get("away", "")}'

def _is_duplicate(match, date, history):
    """Vérifie si le match existe déjà pour cette date (évite les doublons)."""
    match_norm = match.lower().strip()
    date_norm = str(date).strip()
    for h in history:
        if isinstance(h, list) and len(h) >= 2:
            if str(h[0]).strip() == date_norm and str(h[1]).lower().strip() == match_norm:
                return True
        elif isinstance(h, dict):
            if str(h.get("date", "")).strip() == date_norm and \
               str(h.get("match", "")).lower().strip() == match_norm:
                return True
    return False

if current_status in ["GAGNE", "PERDU", "ANNULE"] and current_match.strip() != "vs":
    row = [
        pick.get("date", ""),
        current_match,
        pick.get("prono", ""),
        str(pick.get("cote", "")),
        pick.get("score", ""),
        current_status,
        pick.get("sport", "")
    ]
    if not _is_duplicate(current_match, pick.get("date", ""), history):
        history.insert(0, row)


def normalize_history_status(status):
    raw = str(status or "").upper().replace("É", "E").replace("È", "E")
    if "GAGN" in raw or "WON" in raw:
        return "GAGNE"
    if "PERD" in raw or "LOST" in raw:
        return "PERDU"
    if "ATTENTE" in raw or "PENDING" in raw:
        return "EN ATTENTE"
    if "ANNUL" in raw or "CANCEL" in raw:
        return "ANNULE"
    return status or "EN ATTENTE"

def normalize_history_sport(sport):
    raw = str(sport or "").lower()
    if "nba" in raw or "basket" in raw:
        return "Basket"
    if "foot" in raw or "soccer" in raw:
        return "Foot"
    if "hockey" in raw or "nhl" in raw:
        return "Hockey"
    if "baseball" in raw or "mlb" in raw:
        return "Baseball"
    return sport or "Autre"

def gain_to_number(value):
    raw = str(value or "").replace("€", "").replace("+", "").replace(",", ".").strip()
    try:
        return float(raw)
    except Exception:
        return 0

def history_to_app_row(item):
    if isinstance(item, list) and len(item) >= 7:
        row = item[:7]
        row[5] = normalize_history_status(row[5])
        row[6] = normalize_history_sport(row[6])
        return row

    if not isinstance(item, dict):
        return None

    return [
        item.get("date", ""),
        item.get("match", ""),
        item.get("marche") or item.get("bet") or item.get("prono") or "",
        str(item.get("cote", "")),
        item.get("score_final") or item.get("resultat") or item.get("score_match") or "",
        normalize_history_status(item.get("statut") or item.get("status")),
        normalize_history_sport(item.get("sport", "")),
    ]

history_rows = []
for item in data.get("history", []):
    row = history_to_app_row(item)
    if row and row[1]:
        history_rows.append(row)

stats_data = data.get("stats", {})
won = int(stats_data.get("gagnes", 0) or 0)
lost = int(stats_data.get("perdus", 0) or 0)
pending = int(stats_data.get("en_attente", 0) or 0)

if not stats_data and history_rows:
    won = sum(1 for r in history_rows if r[5] == "GAGNE")
    lost = sum(1 for r in history_rows if r[5] == "PERDU")
    pending = sum(1 for r in history_rows if r[5] == "EN ATTENTE")

total_resolved = won + lost
win_rate = int(round((won / total_resolved) * 100)) if total_resolved else 0

units = 0
for item in data.get("history", []):
    if isinstance(item, dict):
        units += gain_to_number(item.get("gain_perte"))

stats_for_app = {
    "won": won,
    "lost": lost,
    "pending": pending,
    "winRate": int(stats_data.get("taux", win_rate) or win_rate),
    "units": round(units, 2)
}

new_all_picks = "var ALL_PICKS = " + js(history_rows) + ";"
new_stats = "var STATS = " + js(stats_for_app) + ";"

app, n1 = re.subn(r'var ALL_PICKS = \[[\s\S]*?\];', new_all_picks, app, count=1)
app, n2 = re.subn(r'var STATS = \{[\s\S]*?\};', new_stats, app, count=1)

if n1 != 1:
    raise SystemExit("Bloc ALL_PICKS introuvable dans src/App.js")
if n2 != 1:
    raise SystemExit("Bloc STATS introuvable dans src/App.js")

PUBLIC_DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
DIST_DATA.parent.mkdir(parents=True, exist_ok=True)
DIST_DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
APP.write_text(app, encoding="utf-8")

print("OK - site synchronisé avec data/picks.json")
