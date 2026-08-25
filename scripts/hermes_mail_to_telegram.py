#!/usr/bin/env python3
"""Bridge Hostinger email support -> Telegram.

V1 volontairement prudente :
- lit les emails non lus de la boite Hermès via IMAP SSL ;
- envoie une fiche synthétique dans le groupe Telegram support ;
- propose une réponse simple, sans répondre automatiquement au client ;
- marque l'email comme lu uniquement après envoi Telegram réussi.
"""

from __future__ import annotations

import email
import html
import imaplib
import json
import os
import re
import ssl
import sys
import urllib.parse
import urllib.request
from email.header import decode_header, make_header
from email.message import Message


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


IMAP_HOST = env("HERMES_SUPPORT_IMAP_HOST", "imap.hostinger.com")
IMAP_PORT = int(env("HERMES_SUPPORT_IMAP_PORT", "993"))
IMAP_USER = env("HERMES_SUPPORT_IMAP_USER", "hermes@touslesmatchs.com")
IMAP_PASSWORD = env("HERMES_SUPPORT_IMAP_PASSWORD")
TELEGRAM_TOKEN = env("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = env("TELEGRAM_SUPPORT_CHAT_ID")
MAX_EMAILS = int(env("HERMES_SUPPORT_MAX_EMAILS", "5"))


def decode_value(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def clean_text(value: str, max_len: int = 1800) -> str:
    value = re.sub(r"\r\n?", "\n", value or "")
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"[ \t]+", " ", value)
    value = value.strip()
    if len(value) > max_len:
        return value[: max_len - 1].rstrip() + "…"
    return value


def extract_body(msg: Message) -> str:
    if msg.is_multipart():
        html_part = ""
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition") or "").lower()
            if "attachment" in disposition:
                continue
            try:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                text = payload.decode(charset, errors="replace") if payload else ""
            except Exception:
                text = ""
            if content_type == "text/plain" and text.strip():
                return clean_text(text)
            if content_type == "text/html" and text.strip() and not html_part:
                html_part = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
                html_part = re.sub(r"</p\s*>", "\n", html_part, flags=re.I)
                html_part = re.sub(r"<[^>]+>", " ", html_part)
                html_part = html.unescape(html_part)
        return clean_text(html_part)

    payload = msg.get_payload(decode=True)
    charset = msg.get_content_charset() or "utf-8"
    if payload:
        return clean_text(payload.decode(charset, errors="replace"))
    return clean_text(str(msg.get_payload() or ""))


def suggested_reply(subject: str, body: str) -> str:
    text = f"{subject}\n{body}".lower()
    if any(word in text for word in ["telegram", "lien", "groupe", "canal", "invitation"]):
        return (
            "Bonjour, merci pour votre message. Vérifiez vos spams et promotions. "
            "Si vous avez utilisé une autre adresse email, répondez avec l'adresse exacte d'inscription "
            "et nous vérifierons votre accès Telegram."
        )
    if any(word in text for word in ["paiement", "stripe", "abonnement", "facture", "payé", "paye"]):
        return (
            "Bonjour, merci pour votre message. Pour vérifier votre accès, envoyez-nous l'email utilisé "
            "lors du paiement et l'offre concernée. Nous contrôlerons la situation rapidement."
        )
    if any(word in text for word in ["désabonnement", "desabonnement", "remboursement", "résilier", "resilier"]):
        return (
            "Bonjour, nous avons bien reçu votre demande. Elle sera traitée manuellement afin d'éviter "
            "toute erreur sur votre compte."
        )
    return (
        "Bonjour, merci pour votre message. Nous l'avons bien reçu et revenons vers vous rapidement. "
        "Si votre demande concerne un accès, indiquez l'email utilisé lors de l'inscription."
    )


def telegram_send(text: str) -> None:
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "disable_web_page_preview": "true",
    }).encode("utf-8")
    with urllib.request.urlopen(url, data=data, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not payload.get("ok"):
        raise RuntimeError(f"Telegram refused message: {payload}")


def format_telegram(uid: bytes, msg: Message) -> str:
    sender = decode_value(msg.get("From"))
    subject = decode_value(msg.get("Subject")) or "(sans objet)"
    date = decode_value(msg.get("Date"))
    body = extract_body(msg)
    reply = suggested_reply(subject, body)
    return "\n".join([
        f"📩 Nouveau mail Hermès #{uid.decode(errors='ignore')}",
        "",
        f"De: {sender}",
        f"Objet: {subject}",
        f"Date: {date}",
        "",
        "Message:",
        clean_text(body, 1200) or "(message vide)",
        "",
        "🤖 Réponse proposée:",
        reply,
        "",
        "Action: répondre depuis la boite mail si la proposition est correcte.",
    ])


def main() -> int:
    missing = [name for name, value in {
        "HERMES_SUPPORT_IMAP_PASSWORD": IMAP_PASSWORD,
        "TELEGRAM_BOT_TOKEN": TELEGRAM_TOKEN,
        "TELEGRAM_SUPPORT_CHAT_ID": TELEGRAM_CHAT_ID,
    }.items() if not value]
    if missing:
        print("Variables manquantes: " + ", ".join(missing), file=sys.stderr)
        return 2

    context = ssl.create_default_context()
    with imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, ssl_context=context) as imap:
        imap.login(IMAP_USER, IMAP_PASSWORD)
        imap.select("INBOX")
        status, data = imap.search(None, "UNSEEN")
        if status != "OK":
            raise RuntimeError(f"IMAP search failed: {status}")
        uids = data[0].split()[:MAX_EMAILS]
        sent = 0
        for uid in uids:
            status, fetched = imap.fetch(uid, "(RFC822)")
            if status != "OK" or not fetched or not fetched[0]:
                continue
            raw = fetched[0][1]
            msg = email.message_from_bytes(raw)
            telegram_send(format_telegram(uid, msg))
            imap.store(uid, "+FLAGS", "\\Seen")
            sent += 1
        print(json.dumps({"ok": True, "checked": len(uids), "sent": sent}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
