"""
Telegram Bot — TousLesMatchs
Gère 2 canaux :
  - Canal gratuit  : pick du jour (≥ 8/10)
  - Canal premium  : picks 7-7.9/10 + stats abonnés
"""
import os
import requests
import logging
from datetime import datetime

log = logging.getLogger("telegram")

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
FREE_CHANNEL_ID = os.environ.get("TELEGRAM_FREE_CHANNEL_ID", "") or os.environ.get("TELEGRAM_CHANNEL_ID", "")
PREMIUM_CHANNEL_ID = os.environ.get("TELEGRAM_PREMIUM_CHANNEL_ID", "")
ADMIN_CHAT_ID = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")

WINAMAX_LINK = os.environ.get("WINAMAX_LINK", "https://www.winamax.fr")
BETCLIC_LINK = os.environ.get("BETCLIC_LINK", "https://www.betclic.fr")

API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

# ── Unification des moteurs de signaux ────────────────────────────────────────
# Le moteur JS (api_server.js) est le SEUL émetteur Telegram public : c'est lui qui
# porte tous les garde-fous (exclusion féminin, ligues low-trust, conformité ANJ,
# tri par valeur). Le council Python ne poste donc PLUS en direct sur Free/Premium.
# Il continue de générer picks.json (page "Analyse du jour") et son rapport admin.
# Réactivable au besoin via COUNCIL_PUBLIC_TELEGRAM=on.
COUNCIL_PUBLIC_TELEGRAM = os.environ.get("COUNCIL_PUBLIC_TELEGRAM", "off").lower() == "on"


def _sport_emoji(sport):
    emojis = {"Foot": "⚽", "Hockey": "🏒", "Basketball": "🏀",
              "Tennis": "🎾", "Baseball": "⚾", "Rugby": "🏉"}
    return emojis.get(sport, "🎯")


def _send_message(chat_id, text, parse_mode="HTML", disable_preview=True):
    if not BOT_TOKEN or not chat_id:
        log.warning(f"[Telegram] Token ou channel_id manquant — message non envoyé")
        return False
    # Verrou d'unification : plus aucun post public direct depuis le council.
    # Seul l'admin (rapport de monitoring) reste autorisé.
    if not COUNCIL_PUBLIC_TELEGRAM and chat_id in (FREE_CHANNEL_ID, PREMIUM_CHANNEL_ID):
        log.info(f"[Telegram] Post public council désactivé (unifié côté JS) — non envoyé à {chat_id}")
        return False
    try:
        resp = requests.post(
            f"{API_URL}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": parse_mode,
                "disable_web_page_preview": disable_preview,
            },
            timeout=15,
        )
        data = resp.json()
        if data.get("ok"):
            log.info(f"[Telegram] Message envoyé → {chat_id}")
            return True
        else:
            log.error(f"[Telegram] Erreur API: {data.get('description')}")
            return False
    except Exception as e:
        log.error(f"[Telegram] Exception: {e}")
        return False


def send_free_pick(match, bet, odds, sport, confidence, reasoning=""):
    """Envoie le pick gratuit (≥ 8/10) sur le canal public."""
    if not FREE_CHANNEL_ID:
        return False

    emoji = _sport_emoji(sport)
    date_str = datetime.now().strftime("%d/%m/%Y")

    text = f"""🏆 <b>PICK DU JOUR — {date_str}</b>

{emoji} <b>{match}</b>
💡 Pick : <b>{bet}</b>
📊 Cote : <b>{odds}</b>
🔥 Confiance : <b>{confidence}/10</b>

<i>{reasoning[:200] if reasoning else ''}</i>

━━━━━━━━━━━━━━━━━━
🎯 Jouer sur <a href="{WINAMAX_LINK}">Winamax</a> ou <a href="{BETCLIC_LINK}">Betclic</a>

⚠️ Jeu responsable — 18+ — Max 2-5% bankroll
🤖 Sélectionné par le Conseil Hermes (5 IAs)"""

    return _send_message(FREE_CHANNEL_ID, text)


def send_nopick():
    """Annonce un jour sans pick sur le canal gratuit."""
    if not FREE_CHANNEL_ID:
        return False

    date_str = datetime.now().strftime("%d/%m/%Y")
    text = f"""🔍 <b>ANALYSE DU {date_str}</b>

❌ <b>PAS DE PICK AUJOURD'HUI</b>

Le Conseil Hermes (5 IAs) n'a trouvé aucun match atteignant le seuil de confiance 8/10.

✅ On préfère ne pas publier plutôt que de forcer une sélection incertaine.
📈 Winrate maintenu grâce à cette discipline.

━━━━━━━━━━━━━━━━━━
🔔 Demain, le conseil reprend l'analyse à 11h59."""

    return _send_message(FREE_CHANNEL_ID, text)


def send_premium_pick(match, bet, odds, sport, confidence, reasoning=""):
    """Envoie les picks 7-7.9/10 sur le canal premium."""
    if not PREMIUM_CHANNEL_ID:
        log.warning("[Telegram] TELEGRAM_PREMIUM_CHANNEL_ID non configuré")
        return False

    emoji = _sport_emoji(sport)
    date_str = datetime.now().strftime("%d/%m/%Y")

    text = f"""💎 <b>PICK PREMIUM — {date_str}</b>

{emoji} <b>{match}</b>
💡 Pick : <b>{bet}</b>
📊 Cote : <b>{odds}</b>
🔥 Confiance : <b>{confidence}/10</b>

📋 Analyse :
<i>{reasoning[:300] if reasoning else 'Analyse disponible sur le site.'}</i>

━━━━━━━━━━━━━━━━━━
🎯 <a href="{WINAMAX_LINK}">Winamax</a> | <a href="{BETCLIC_LINK}">Betclic</a>
⚠️ 18+ — Jeu responsable — Max 2-5% bankroll"""

    return _send_message(PREMIUM_CHANNEL_ID, text)


def send_premium_stats(stats: dict):
    """Envoie un récap hebdomadaire des stats sur le canal premium."""
    if not PREMIUM_CHANNEL_ID:
        return False

    date_str = datetime.now().strftime("%d/%m/%Y")
    by_sport = stats.get("by_sport", [])
    sport_lines = "\n".join(
        [f"  {_sport_emoji(s['sport'])} {s['sport']}: {s['wins']}/{s['total']} ({s['winrate']}%) @ {s['avg_odds']}"
         for s in by_sport]
    ) or "  Pas encore assez de données"

    text = f"""📊 <b>STATS PREMIUM — Semaine du {date_str}</b>

🏆 Performance globale :
• Picks joués : {stats.get('total', 0)}
• Gagnés : {stats.get('wins', 0)} | Perdus : {stats.get('losses', 0)}
• Winrate : <b>{stats.get('winrate', 0)}%</b>

📈 Par sport :
{sport_lines}

━━━━━━━━━━━━━━━━━━
🤖 Données Conseil Hermes — 5 IAs
💎 Abonnement Premium — Merci de votre confiance"""

    return _send_message(PREMIUM_CHANNEL_ID, text)


def send_result_update(match, bet, result, score, tier="free"):
    """Met à jour le résultat d'un pick (appelé manuellement ou via webhook)."""
    channel = FREE_CHANNEL_ID if tier == "free" else PREMIUM_CHANNEL_ID
    if not channel:
        return False

    icon = "✅ GAGNÉ" if result == "GAGNE" else "❌ PERDU"
    text = f"""{icon} <b>RÉSULTAT</b>

🏟️ {match}
📋 {bet} → <b>{score}</b>

{'🎉 Bravo à ceux qui ont joué !' if result == 'GAGNE' else '💪 On rebondit demain — la discipline paie sur le long terme.'}"""

    return _send_message(channel, text)


def send_daily_report(report_data: dict):
    """Envoie le rapport quotidien Hermes sur le chat admin Telegram."""
    if not ADMIN_CHAT_ID:
        log.warning("[Telegram] ADMIN_CHAT_ID non configuré — rapport non envoyé")
        return False

    d = report_data
    text = f"""📋 <b>RAPPORT HERMES — {d['date']}</b>

🏟️ <b>{d['total_matches']} matchs analysés</b>
{d['sports']}

{'✅' if d['decision'] == 'PICK' else '❌'} <b>Décision : {d['decision']}</b>
{f"🏆 {d['match']}" if d['decision'] == 'PICK' else ''}
{f"💡 {d['bet']} @ {d['odds']}" if d['decision'] == 'PICK' else ''}
{f"🔥 Confiance : {d['confidence']}/10" if d['decision'] == 'PICK' else ''}

🤖 <b>Votes des agents :</b>
{d['agents']}

🚫 <b>Agents exclus (< 80%) :</b>
{d['excluded']}

📈 <b>Stats globales :</b>
Winrate : {d['winrate']}% | ROI : {d['roi']}%
Total picks résolus : {d['total_picks']}

{f"📝 Notes : {d['improvement']}" if d.get('improvement') else ''}

━━━━━━━━━━━━━━━━━━
🤖 Hermes Council — Rapport automatique"""

    return _send_message(ADMIN_CHAT_ID, text)


def is_configured():
    """Vérifie si le bot Telegram est configuré."""
    return bool(BOT_TOKEN and FREE_CHANNEL_ID)
