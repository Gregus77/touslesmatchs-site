"""
Telegram Bot — TousLesMatchs
Gère 2 canaux :
  - Canal gratuit  : pick du jour (≥ 8/10)
  - Canal premium  : picks 7-7.9/10 + stats abonnés
"""
import os
import html
import re
import requests
import logging
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import urlparse

log = logging.getLogger("telegram")

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
FREE_CHANNEL_ID = os.environ.get("TELEGRAM_FREE_CHANNEL_ID", "") or os.environ.get("TELEGRAM_CHANNEL_ID", "")
PREMIUM_CHANNEL_ID = os.environ.get("TELEGRAM_PREMIUM_CHANNEL_ID", "")
ADMIN_CHAT_ID = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")

WINAMAX_LINK = os.environ.get("WINAMAX_LINK", "https://www.winamax.fr")
UNIBET_LINK = os.environ.get("UNIBET_LINK", "https://www.unibet.fr")

API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

# ── Unification des moteurs de signaux ────────────────────────────────────────
# Le moteur JS (api_server.js) est le SEUL émetteur Telegram public : c'est lui qui
# porte tous les garde-fous (exclusion féminin, ligues low-trust, conformité ANJ,
# tri par valeur). Le council Python ne poste donc PLUS en direct sur Free/Premium.
# Il continue de générer picks.json (page "Analyse du jour") et son rapport admin.
# Réactivable au besoin via COUNCIL_PUBLIC_TELEGRAM=on.
COUNCIL_PUBLIC_TELEGRAM = os.environ.get("COUNCIL_PUBLIC_TELEGRAM", "off").lower() == "on"
TELEGRAM_MAX_LENGTH = 4096
ALLOWED_HTML_TAGS = {"b", "i", "a"}
LAST_DELIVERY_PROOF = None


def _esc(value, limit=500):
    return html.escape(str(value if value is not None else "-")[:limit], quote=True)


def _safe_url(value):
    raw = str(value or "").strip()
    parsed = urlparse(raw)
    return html.escape(raw if parsed.scheme == "https" and parsed.netloc else "https://www.touslesmatchs.com", quote=True)


class _TelegramHtmlValidator(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag not in ALLOWED_HTML_TAGS:
            raise ValueError("unsupported_html_tag")
        if tag == "a":
            if len(attrs) != 1 or attrs[0][0] != "href":
                raise ValueError("unsupported_html_attribute")
            parsed = urlparse(attrs[0][1] or "")
            if parsed.scheme != "https" or not parsed.netloc:
                raise ValueError("unsafe_html_url")
        elif attrs:
            raise ValueError("unsupported_html_attribute")
        self.stack.append(tag)

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1] != tag:
            raise ValueError("unbalanced_html_tag")
        self.stack.pop()

    def close(self):
        super().close()
        if self.stack:
            raise ValueError("unbalanced_html_tag")


def _validate_html(text):
    # Telegram interprète un chevron brut comme le début d'une balise, même si
    # HTMLParser le classerait parfois comme texte (cas historique "< 80%").
    remainder = re.sub(r"</?[A-Za-z][^>]*>", "", text)
    if "<" in remainder or ">" in remainder:
        raise ValueError("raw_angle_bracket")
    parser = _TelegramHtmlValidator()
    parser.feed(text)
    parser.close()


def _split_html_message(text, limit=TELEGRAM_MAX_LENGTH):
    _validate_html(text)
    lines = text.splitlines(keepends=True) or [text]
    balanced_parts = []
    token_pattern = re.compile(r"</?[A-Za-z][^>]*>|&(?:#[0-9]+|#x[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);|[^<&]+")
    for line in lines:
        _validate_html(line)
        active = []
        current = ""
        has_text = False

        def closers():
            return "".join(f"</{name}>" for name, _opening in reversed(active))

        def flush():
            nonlocal current, has_text
            if has_text:
                balanced_parts.append(current + closers())
            current = "".join(opening for _name, opening in active)
            has_text = False

        for token in token_pattern.findall(line):
            closing_match = re.fullmatch(r"</([A-Za-z][A-Za-z0-9-]*)>", token)
            opening_match = re.fullmatch(r"<([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?>", token)
            if closing_match:
                current += token
                active.pop()
                continue
            if opening_match:
                name = opening_match.group(1).lower()
                prospective = active + [(name, token)]
                prospective_closers = "".join(f"</{tag}>" for tag, _opening in reversed(prospective))
                if current and len(current) + len(token) + len(prospective_closers) > limit:
                    flush()
                current += token
                active.append((name, token))
                continue
            if token.startswith("&") and token.endswith(";"):
                if current and len(current) + len(token) + len(closers()) > limit:
                    flush()
                if len(current) + len(token) + len(closers()) > limit:
                    raise ValueError("html_entity_too_long")
                current += token
                has_text = True
                continue
            remaining = token
            while remaining:
                capacity = limit - len(current) - len(closers())
                if capacity <= 0:
                    flush()
                    capacity = limit - len(current) - len(closers())
                if len(remaining) <= capacity:
                    current += remaining
                    has_text = True
                    remaining = ""
                    continue
                cut = capacity
                preferred = max(remaining.rfind("\n", 0, capacity + 1), remaining.rfind(" ", 0, capacity + 1))
                if preferred > 0:
                    cut = preferred + 1
                current += remaining[:cut]
                has_text = True
                remaining = remaining[cut:]
                flush()
        flush()

    chunks = []
    current = ""
    for part in balanced_parts:
        if current and len(current) + len(part) > limit:
            chunks.append(current.rstrip("\n"))
            current = ""
        current += part
    if current or not chunks:
        chunks.append(current.rstrip("\n"))
    for chunk in chunks:
        if not chunk or len(chunk) > limit:
            raise ValueError("invalid_chunk_length")
        _validate_html(chunk)
    return chunks


def _sport_emoji(sport):
    emojis = {"Foot": "⚽", "Hockey": "🏒", "Basketball": "🏀",
              "Tennis": "🎾", "Baseball": "⚾", "Rugby": "🏉"}
    return emojis.get(sport, "🎯")


def _send_message(chat_id, text, parse_mode="HTML", disable_preview=True):
    global LAST_DELIVERY_PROOF
    LAST_DELIVERY_PROOF = None
    if not BOT_TOKEN or not chat_id:
        log.warning("[Telegram] configuration manquante — message non envoyé")
        return False
    # Verrou d'unification : plus aucun post public direct depuis le council.
    # Seul l'admin (rapport de monitoring) reste autorisé.
    if not COUNCIL_PUBLIC_TELEGRAM and chat_id in (FREE_CHANNEL_ID, PREMIUM_CHANNEL_ID):
        log.info("[Telegram] Post public council désactivé — non envoyé")
        return False
    try:
        chunks = _split_html_message(str(text)) if parse_mode == "HTML" else [str(text)]
        message_ids = []
        for chunk in chunks:
            resp = requests.post(
                f"{API_URL}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": chunk,
                    "parse_mode": parse_mode,
                    "disable_web_page_preview": disable_preview,
                },
                timeout=15,
            )
            data = resp.json()
            message_id = data.get("result", {}).get("message_id") if isinstance(data, dict) else None
            evidence_valid = not isinstance(message_id, bool) and isinstance(message_id, int) and message_id > 0
            if resp.status_code != 200 or not isinstance(data, dict) or data.get("ok") is not True or not evidence_valid:
                log.error(f"[Telegram] livraison refusée — HTTP {resp.status_code}, preuve_absente={not evidence_valid}")
                return False
            message_ids.append(message_id)
        LAST_DELIVERY_PROOF = {"message_ids": tuple(message_ids)}
        log.info(f"[Telegram] Message envoyé — chunks={len(chunks)}, message_ids={','.join(map(str, message_ids))}")
        return True
    except ValueError as exc:
        log.error(f"[Telegram] format refusé — {exc}")
        return False
    except Exception as exc:
        log.error(f"[Telegram] transport échoué — {type(exc).__name__}")
        return False


def send_free_pick(match, bet, odds, sport, confidence, reasoning=""):
    """Envoie le pick gratuit (≥ 8/10) sur le canal public."""
    if not FREE_CHANNEL_ID:
        return False

    emoji = _sport_emoji(sport)
    date_str = datetime.now().strftime("%d/%m/%Y")

    text = f"""🏆 <b>PICK DU JOUR — {_esc(date_str, 20)}</b>

{emoji} <b>{_esc(match, 240)}</b>
💡 Pick : <b>{_esc(bet, 120)}</b>
📊 Cote : <b>{_esc(odds, 30)}</b>
🔥 Confiance : <b>{_esc(confidence, 10)}/10</b>

<i>{_esc(reasoning, 200) if reasoning else ''}</i>

━━━━━━━━━━━━━━━━━━
🎯 Jouer sur <a href="{_safe_url(WINAMAX_LINK)}">Winamax</a> ou <a href="{_safe_url(UNIBET_LINK)}">Unibet</a>

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

    text = f"""💎 <b>PICK PREMIUM — {_esc(date_str, 20)}</b>

{emoji} <b>{_esc(match, 240)}</b>
💡 Pick : <b>{_esc(bet, 120)}</b>
📊 Cote : <b>{_esc(odds, 30)}</b>
🔥 Confiance : <b>{_esc(confidence, 10)}/10</b>

📋 Analyse :
<i>{_esc(reasoning, 300) if reasoning else 'Analyse disponible sur le site.'}</i>

━━━━━━━━━━━━━━━━━━
🎯 <a href="{_safe_url(WINAMAX_LINK)}">Winamax</a> | <a href="{_safe_url(UNIBET_LINK)}">Unibet</a>
⚠️ 18+ — Jeu responsable — Max 2-5% bankroll"""

    return _send_message(PREMIUM_CHANNEL_ID, text)


def send_premium_stats(stats: dict):
    """Envoie un récap hebdomadaire des stats sur le canal premium."""
    if not PREMIUM_CHANNEL_ID:
        return False

    date_str = datetime.now().strftime("%d/%m/%Y")
    by_sport = stats.get("by_sport", [])
    sport_lines = "\n".join(
        [f"  {_sport_emoji(s['sport'])} {_esc(s['sport'], 40)}: {_esc(s['wins'], 12)}/{_esc(s['total'], 12)} ({_esc(s['winrate'], 12)}%) @ {_esc(s['avg_odds'], 12)}"
         for s in by_sport]
    ) or "  Pas encore assez de données"

    text = f"""📊 <b>STATS PREMIUM — Semaine du {date_str}</b>

🏆 Performance globale :
• Picks joués : {_esc(stats.get('total', 0), 12)}
• Gagnés : {_esc(stats.get('wins', 0), 12)} | Perdus : {_esc(stats.get('losses', 0), 12)}
• Winrate : <b>{_esc(stats.get('winrate', 0), 12)}%</b>

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

🏟️ {_esc(match, 240)}
📋 {_esc(bet, 120)} → <b>{_esc(score, 40)}</b>

{'🎉 Bravo à ceux qui ont joué !' if result == 'GAGNE' else '💪 On rebondit demain — la discipline paie sur le long terme.'}"""

    return _send_message(channel, text)


def send_daily_report(report_data: dict):
    """Envoie le rapport quotidien Hermes sur le chat admin Telegram."""
    if not ADMIN_CHAT_ID:
        log.warning("[Telegram] ADMIN_CHAT_ID non configuré — rapport non envoyé")
        return False

    d = report_data
    text = f"""📋 <b>RAPPORT HERMES — {_esc(d.get('date'), 40)}</b>

🏟️ <b>{_esc(d.get('total_matches', 0), 12)} matchs analysés</b>
{_esc(d.get('sports', ''), 1000)}

{'✅' if d.get('decision') == 'PICK' else '❌'} <b>Décision : {_esc(d.get('decision'), 20)}</b>
{f"🏆 {_esc(d.get('match'), 240)}" if d.get('decision') == 'PICK' else ''}
{f"💡 {_esc(d.get('bet'), 120)} @ {_esc(d.get('odds'), 30)}" if d.get('decision') == 'PICK' else ''}
{f"🔥 Confiance : {_esc(d.get('confidence'), 10)}/10" if d.get('decision') == 'PICK' else ''}

🤖 <b>Votes des agents :</b>
{_esc(d.get('agents', ''), 8000)}

🚫 <b>Agents exclus (&lt; 55%) :</b>
{_esc(d.get('excluded', ''), 4000)}

📈 <b>Stats globales :</b>
Winrate : {_esc(d.get('winrate', 0), 12)}% | ROI : {_esc(d.get('roi', 0), 12)}%
Total picks résolus : {_esc(d.get('total_picks', 0), 12)}

{f"📝 Notes : {_esc(d.get('improvement'), 200)}" if d.get('improvement') else ''}

━━━━━━━━━━━━━━━━━━
🤖 Hermes Council — Rapport automatique"""

    return _send_message(ADMIN_CHAT_ID, text)


def is_configured():
    """Vérifie si le bot Telegram est configuré."""
    return bool(BOT_TOKEN and FREE_CHANNEL_ID)
