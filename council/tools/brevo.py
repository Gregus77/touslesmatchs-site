"""
Brevo email integration — TousLesMatchs
Envoi du pick quotidien à tous les abonnés + gestion des contacts.
"""
import os
import requests
import logging

log = logging.getLogger("brevo")

BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
BREVO_SENDER = {"name": "TousLesMatchs", "email": "noreply@touslesmatchs.com"}
SITE_URL = os.environ.get("SITE_URL", "https://touslesmatchs.com")
WINAMAX_LINK = os.environ.get("WINAMAX_LINK", "https://www.winamax.fr/parrain?code=77953728")
BETCLIC_LINK = os.environ.get("BETCLIC_LINK", "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ")
UNIBET_LINK = os.environ.get("UNIBET_LINK", "https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254")
PMU_LINK = os.environ.get("PMU_LINK", "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728")


def _headers():
    return {"api-key": BREVO_API_KEY, "content-type": "application/json"}


def is_configured():
    return bool(BREVO_API_KEY)


def get_all_subscribers():
    """Récupère tous les contacts Brevo non désabonnés."""
    if not BREVO_API_KEY:
        return []
    try:
        emails = []
        offset = 0
        limit = 500
        while True:
            r = requests.get(
                "https://api.brevo.com/v3/contacts",
                headers=_headers(),
                params={"limit": limit, "offset": offset},
                timeout=15,
            )
            data = r.json()
            contacts = data.get("contacts", [])
            if not contacts:
                break
            for c in contacts:
                if not c.get("emailBlacklisted") and c.get("email"):
                    emails.append(c["email"])
            if len(contacts) < limit:
                break
            offset += limit
        log.info(f"[Brevo] {len(emails)} abonnés récupérés")
        return emails
    except Exception as e:
        log.error(f"[Brevo] get_subscribers error: {e}")
        return []


def add_subscriber(email):
    """Ajoute un abonné gratuit à Brevo."""
    if not BREVO_API_KEY:
        return False
    try:
        r = requests.post(
            "https://api.brevo.com/v3/contacts",
            json={"email": email, "attributes": {"PLAN": "FREE_SUBSCRIBER"}, "updateEnabled": True},
            headers=_headers(),
            timeout=10,
        )
        ok = r.status_code in (200, 201, 204)
        if ok:
            log.info(f"[Brevo] Abonné ajouté: {email}")
        else:
            log.warning(f"[Brevo] add_subscriber status {r.status_code}: {r.text[:200]}")
        return ok
    except Exception as e:
        log.error(f"[Brevo] add_subscriber error: {e}")
        return False


def _bm_buttons():
    return f"""
<table cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td align="center" style="padding:8px 0">
      <a href="{WINAMAX_LINK}" target="_blank"
         style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;
                padding:11px 22px;border-radius:8px;font-size:13px;font-weight:700;margin:4px">
        Winamax →
      </a>
      <a href="{BETCLIC_LINK}" target="_blank"
         style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                padding:11px 22px;border-radius:8px;font-size:13px;font-weight:700;margin:4px">
        Betclic →
      </a>
      <a href="{UNIBET_LINK}" target="_blank"
         style="display:inline-block;background:#059669;color:#fff;text-decoration:none;
                padding:11px 22px;border-radius:8px;font-size:13px;font-weight:700;margin:4px">
        Unibet →
      </a>
      <a href="{PMU_LINK}" target="_blank"
         style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;
                padding:11px 22px;border-radius:8px;font-size:13px;font-weight:700;margin:4px">
        PMU →
      </a>
    </td>
  </tr>
</table>"""


def _build_html(match, bet, cote, sport, confidence, reasoning, date_str, is_nopick):
    sport_emoji = {
        "Foot": "⚽", "Football": "⚽", "Hockey": "🏒",
        "Basketball": "🏀", "Tennis": "🎾", "Baseball": "⚾", "Rugby": "🏉",
    }.get(sport or "", "🎯")
    conf = int(float(confidence)) if confidence else 8

    base_style = (
        "margin:0;padding:0;background:#06080f;color:#eceaf4;"
        "font-family:Inter,Arial,Helvetica,sans-serif"
    )

    if is_nopick:
        return f"""<!DOCTYPE html>
<html><body style="{base_style}">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;margin:0 auto">
<tr><td style="padding:40px 28px">
  <div style="font-size:22px;font-weight:900;margin-bottom:4px">TousLesMatchs</div>
  <div style="height:2px;background:linear-gradient(90deg,#4f46e5,#22d3ee);margin-bottom:28px;border-radius:1px"></div>
  <div style="background:#0d1020;border:1px solid #1c2236;border-radius:16px;padding:28px;text-align:center;margin-bottom:28px">
    <div style="font-size:40px;margin-bottom:14px">🔍</div>
    <div style="font-size:20px;font-weight:900;color:#f43f5e;margin-bottom:12px">Pas de pick aujourd'hui</div>
    <div style="font-size:14px;color:#a8aec8;line-height:1.7">
      Le Concile Hermès (5 IA) n'a trouvé aucun match<br>atteignant le seuil de confiance requis.<br><br>
      <strong style="color:#eceaf4">On préfère ne pas publier plutôt que risquer ta bankroll.</strong>
    </div>
    <div style="margin-top:20px;font-size:12px;color:#7b82a0">Retour demain à 11h59 — le Concile continue d'analyser.</div>
  </div>
  <div style="text-align:center">
    <a href="{SITE_URL}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
       padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700">Voir le site →</a>
  </div>
  <div style="font-size:11px;color:#7b82a0;text-align:center;margin-top:28px;line-height:1.9">
    Analyse par le Concile Hermès — 5 IA · Discipline &gt; Volume<br>
    ⚠️ 18+ · Jeu responsable · Max 2-5% bankroll
  </div>
</td></tr>
</table>
</body></html>"""

    reasoning_block = ""
    if reasoning:
        r = reasoning[:300].replace("<", "&lt;").replace(">", "&gt;")
        reasoning_block = f"""
<div style="margin-top:18px;font-size:13px;color:#a8aec8;line-height:1.65;font-style:italic;
            border-left:2px solid #6366f1;padding-left:14px">{r}</div>"""

    return f"""<!DOCTYPE html>
<html><body style="{base_style}">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;margin:0 auto">
<tr><td style="padding:40px 28px">
  <div style="font-size:22px;font-weight:900;margin-bottom:4px">TousLesMatchs</div>
  <div style="height:2px;background:linear-gradient(90deg,#4f46e5,#22d3ee);margin-bottom:8px;border-radius:1px"></div>
  <div style="font-size:11px;color:#7b82a0;text-transform:uppercase;letter-spacing:.12em;margin-bottom:24px">Pick du jour — {date_str}</div>

  <div style="background:#0d1020;border:1px solid rgba(99,102,241,.3);border-radius:16px;padding:28px;margin-bottom:24px">
    <div style="font-size:11px;color:#6366f1;text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">{sport_emoji} {sport or 'Sport'}</div>
    <div style="font-size:26px;font-weight:900;letter-spacing:-.02em;margin-bottom:20px">{match or 'Match du jour'}</div>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:14px;background:rgba(255,255,255,.04);border-radius:10px;text-align:center;width:40%">
          <div style="font-size:10px;color:#7b82a0;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Pari</div>
          <div style="font-size:17px;font-weight:800;color:#22d3ee">{bet or '—'}</div>
        </td>
        <td width="10"></td>
        <td style="padding:14px;background:rgba(255,255,255,.04);border-radius:10px;text-align:center;width:25%">
          <div style="font-size:10px;color:#7b82a0;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Cote</div>
          <div style="font-size:30px;font-weight:900;color:#eceaf4">@{cote or '—'}</div>
        </td>
        <td width="10"></td>
        <td style="padding:14px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:10px;text-align:center;width:25%">
          <div style="font-size:10px;color:#7b82a0;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Confiance</div>
          <div style="font-size:24px;font-weight:900;color:#10b981">{conf}/10</div>
        </td>
      </tr>
    </table>
    {reasoning_block}
  </div>

  <div style="font-size:12px;font-weight:700;color:#7b82a0;text-transform:uppercase;
              letter-spacing:.1em;text-align:center;margin-bottom:10px">Parier maintenant</div>
  {_bm_buttons()}

  <div style="text-align:center;margin-top:24px">
    <a href="{SITE_URL}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);
       color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700">
      Voir l'analyse complète →
    </a>
  </div>

  <div style="font-size:11px;color:#7b82a0;text-align:center;margin-top:28px;line-height:1.9">
    Sélectionné par le Concile Hermès — Claude + 4 IA<br>
    ⚠️ 18+ · Jeu responsable · Investissez max 2-5% de votre bankroll<br>
    <a href="{SITE_URL}" style="color:#7b82a0">Se désabonner</a>
  </div>
</td></tr>
</table>
</body></html>"""


def send_daily_pick_email(match, bet, cote, sport, confidence, reasoning, date_str, is_nopick=False):
    """Envoie le pick quotidien à tous les abonnés Brevo."""
    if not BREVO_API_KEY:
        log.warning("[Brevo] BREVO_API_KEY non configurée — emails non envoyés")
        return False

    subscribers = get_all_subscribers()
    if not subscribers:
        log.warning("[Brevo] Aucun abonné trouvé")
        return False

    subject = f"{'❌ Pas de pick' if is_nopick else '🏆 Pick du jour'} — {date_str} · TousLesMatchs"
    html = _build_html(match, bet, cote, sport, confidence, reasoning, date_str, is_nopick)

    sent, failed = 0, 0
    for email in subscribers:
        try:
            r = requests.post(
                "https://api.brevo.com/v3/smtp/email",
                json={"sender": BREVO_SENDER, "to": [{"email": email}], "subject": subject, "htmlContent": html},
                headers=_headers(),
                timeout=15,
            )
            if r.status_code in (200, 201, 202):
                sent += 1
            else:
                failed += 1
                log.warning(f"[Brevo] Erreur {r.status_code} pour {email}: {r.text[:100]}")
        except Exception as e:
            failed += 1
            log.error(f"[Brevo] Exception pour {email}: {e}")

    log.info(f"[Brevo] Emails envoyés: {sent} succès, {failed} échecs / {len(subscribers)} abonnés")
    return sent > 0
