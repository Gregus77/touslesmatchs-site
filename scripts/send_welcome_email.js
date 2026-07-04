const fs = require("fs");
const path = require("path");
const brevo = require("./brevo");

const LEADS_FILE = path.join(__dirname, "..", "data", "leads.json");
const PREMIUM_URL = "https://www.touslesmatchs.com/api/stripe/checkout-premium";
const FREE_TELEGRAM_URL = "https://t.me/TousLesMatchs_Free";
const SITE_URL = "https://www.touslesmatchs.com";

function readLeads() {
  try {
    const data = JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
    if (Array.isArray(data)) return { leads: data };
    if (data && Array.isArray(data.leads)) return data;
  } catch(e) {}
  return { leads: [] };
}

function buildEmail(email) {
  const subject = "Bienvenue dans TousLesMatchs - votre accès Free";

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111;line-height:1.6">
      <h1 style="color:#111">Bienvenue dans TousLesMatchs</h1>

      <p>Merci pour votre inscription.</p>

      <p>
        Ici, Hermès ne force pas un pari tous les jours. Quand aucune opportunité solide n’est détectée,
        nous préférons dire la vérité plutôt que publier un pari faible.
      </p>

      <p><strong>Votre accès Free :</strong></p>
      <ul>
        <li>Pick gratuit quand Hermès valide une opportunité sérieuse</li>
        <li>Suivi des résultats gagnés/perdus</li>
        <li>Accès au canal Telegram Free</li>
      </ul>

      <p>
        <a href="${FREE_TELEGRAM_URL}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px">
          Rejoindre Telegram Free
        </a>
      </p>

      <hr style="border:none;border-top:1px solid #ddd;margin:28px 0" />

      <h2>Premium lancement à 4,90€/mois</h2>
      <p>
        En Premium, Hermès surveille plus de matchs, plus de sports et peut envoyer jusqu’à 3 picks prioritaires
        quand les critères sont réunis.
      </p>

      <p>
        <a href="${PREMIUM_URL}" style="display:inline-block;background:#d4af37;color:#111;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:bold">
          Passer Premium à 4,90€
        </a>
      </p>

      <p style="font-size:12px;color:#666;margin-top:28px">
        18+ uniquement. Les pronostics sont informatifs et ne garantissent aucun gain.
        Jouez uniquement ce que vous pouvez vous permettre de perdre.
      </p>

      <p style="font-size:12px;color:#666">
        Site : <a href="${SITE_URL}">${SITE_URL}</a>
      </p>
    </div>
  `;

  const textContent = `Bienvenue dans TousLesMatchs

Merci pour votre inscription.

Hermès ne force pas un pari tous les jours. Quand aucune opportunité solide n’est détectée, nous préférons dire la vérité.

Telegram Free :
${FREE_TELEGRAM_URL}

Premium lancement à 4,90€/mois :
${PREMIUM_URL}

18+ uniquement. Pronostics informatifs, aucun gain garanti.`;

  return {
    sender: { email: SENDER_EMAIL, name: SENDER_NAME },
    to: [{ email }],
    subject,
    htmlContent,
    textContent,
  };
}

async function main() {
  const data = readLeads();
  let sent = 0;
  let skipped = 0;

  for (const lead of data.leads) {
    const email = String(lead.email || "").trim().toLowerCase();
    if (!email) continue;

    if (brevo.TEST_MODE && email !== brevo.ONLY_EMAIL.toLowerCase()) {
      skipped++;
      continue;
    }

    if (lead.welcome_email_sent_at) {
      skipped++;
      continue;
    }

    const emailData = buildEmail(email);
    try {
      const result = await brevo.sendEmail(email, emailData.subject, emailData.htmlContent, emailData.textContent);

      lead.welcome_email_sent_at = new Date().toISOString();
      lead.email_status = "welcome_sent";
      lead.brevo_message_id = result.messageId || null;
      sent++;
    } catch (err) {
      console.error(`Erreur envoi email ${email}: ${err.message}`);
      skipped++;
    }
  }

  fs.writeFileSync(LEADS_FILE, JSON.stringify(data, null, 2));
  console.log(`OK - emails envoyés: ${sent}, ignorés: ${skipped}` + (brevo.TEST_MODE ? ` (mode test: ${brevo.ONLY_EMAIL})` : ""));
}

main().catch(err => {
  console.error("ERREUR - " + err.message);
  process.exit(1);
});
