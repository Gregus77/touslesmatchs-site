import os
import json
from datetime import datetime

SITE_HTML_PATH = os.environ.get("SITE_HTML_PATH", "/app/site/index.html")
SITE_TEMPLATE_PATH = os.environ.get("SITE_TEMPLATE_PATH", "/app/site/template.html")

WINAMAX_LINK = os.environ.get("WINAMAX_LINK", "https://www.winamax.fr/parrain?code=WMX8M5")
BETCLIC_LINK = os.environ.get("BETCLIC_LINK", "https://www.betclic.fr/")
UNIBET_LINK = os.environ.get("UNIBET_LINK", "https://www.unibet.fr/")
PMU_LINK = os.environ.get("PMU_LINK", "https://www.pmu.fr/")
ZEBET_LINK = os.environ.get("ZEBET_LINK", "https://www.zebet.fr/")
PARIONSSPORT_LINK = os.environ.get("PARIONSSPORT_LINK", "https://www.parionssport.fdj.fr/")
NETBET_LINK = os.environ.get("NETBET_LINK", "https://www.netbet.fr/")
TIKTOK_LINK = os.environ.get("TIKTOK_LINK", "https://www.tiktok.com/@touslesmatchs.com")


def inject_pick_into_html(pick_data: dict, picks_history: list, stats: dict) -> bool:
    """
    Write the new index.html with today's pick injected.
    pick_data: {date, match, bet, odds, sport, confidence, nopick, result}
    picks_history: list of recent picks from DB
    stats: {total, wins, losses, winrate, roi}
    """
    try:
        with open(SITE_TEMPLATE_PATH, "r", encoding="utf-8") as f:
            template = f.read()
    except FileNotFoundError:
        print(f"[HTML] Template not found at {SITE_TEMPLATE_PATH}")
        return False

    today_str = datetime.now().strftime("%d/%m")
    date_full = datetime.now().strftime("%d/%m/%Y")

    # Build today pick block
    if pick_data.get("nopick"):
        pick_badge = "NOPICK"
        pick_label = "PAS DE PARI"
        pick_desc = f"PAS DE PARI - Aucun match n'atteint notre seuil 8/10"
        pick_match = "---"
        pick_bet = "---"
        pick_odds = "---"
        pick_sport = ""
        pick_confidence = pick_data.get("confidence", 0)
    else:
        pick_badge = "PICK"
        pick_label = "PICK DU JOUR"
        pick_match = pick_data.get("match", "")
        pick_bet = pick_data.get("bet", "")
        pick_odds = str(pick_data.get("odds", ""))
        pick_sport = pick_data.get("sport", "")
        pick_confidence = pick_data.get("confidence", 0)
        pick_desc = f"{pick_match} → {pick_bet} @ {pick_odds}"

    # Build picks history rows (JS array format)
    js_picks = []
    for p in picks_history:
        date, match, bet, odds, score, result, sport, confidence = p
        js_picks.append(
            f'["{date}","{match}","{bet}","{odds}","{score or ""}","{result or ""}","{sport or ""}"]'
        )
    js_picks_str = ",\n  ".join(js_picks)

    html = template
    html = html.replace("{{TODAY_DATE}}", date_full)
    html = html.replace("{{TODAY_PICK_BADGE}}", pick_badge)
    html = html.replace("{{TODAY_PICK_LABEL}}", pick_label)
    html = html.replace("{{TODAY_PICK_MATCH}}", pick_match)
    html = html.replace("{{TODAY_PICK_BET}}", pick_bet)
    html = html.replace("{{TODAY_PICK_ODDS}}", pick_odds)
    html = html.replace("{{TODAY_PICK_SPORT}}", pick_sport)
    html = html.replace("{{TODAY_PICK_CONFIDENCE}}", str(pick_confidence))
    html = html.replace("{{PICKS_HISTORY_JS}}", js_picks_str)
    html = html.replace("{{STAT_WINS}}", str(stats.get("wins", 0)))
    html = html.replace("{{STAT_LOSSES}}", str(stats.get("losses", 0)))
    html = html.replace("{{STAT_WINRATE}}", str(stats.get("winrate", 0)))
    html = html.replace("{{STAT_ROI}}", str(stats.get("roi", 0)))
    html = html.replace("{{WINAMAX_LINK}}", WINAMAX_LINK)
    html = html.replace("{{BETCLIC_LINK}}", BETCLIC_LINK)
    html = html.replace("{{UNIBET_LINK}}", UNIBET_LINK)
    html = html.replace("{{PMU_LINK}}", PMU_LINK)
    html = html.replace("{{ZEBET_LINK}}", ZEBET_LINK)
    html = html.replace("{{PARIONSSPORT_LINK}}", PARIONSSPORT_LINK)
    html = html.replace("{{NETBET_LINK}}", NETBET_LINK)
    html = html.replace("{{TIKTOK_LINK}}", TIKTOK_LINK)

    os.makedirs(os.path.dirname(SITE_HTML_PATH), exist_ok=True)
    with open(SITE_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"[HTML] Site updated: {SITE_HTML_PATH}")
    return True
