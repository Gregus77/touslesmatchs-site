const fs = require("fs");
const path = require("path");
const https = require("https");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "noreply@touslesmatchs.com";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "TousLesMatchs";
const ONLY_EMAIL = (process.env.ONLY_EMAIL || "").toLowerCase();

const LEADS_FILE = path.join(__dirname, "..", "data", "leads.json");
const SUBSCRIBERS_FILE = path.join(__dirname, "..", "data", "subscribers.json");

const PREMIUM_URL = "https://www.touslesmatchs.com/api/stripe/checkout-premium";
const SITE_URL = "https://www.touslesmatchs.com";
const FREE_TELEGRAM_URL = "https://t.me/TousLesMatchs_Free";

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch(e) { return fallback; }
}

function daysSince(dateString) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function activeSubscriberEmails() {
  const data = readJson(SUBSCRIBERS_FILE, { subscribers: [] });
  return new Set((data.subscribers || [])
    .filter(s => s.status === "active")
    .map(s => String(s.email || "").toLowerCase()));
}

const sequence = [
  {
    key: "j1",
    minDays: 1,
    sentField: "email_j1_sent_at",
    subject: "Pourquoi TousLesMatchs ne force pas un pari chaque jour",
    title: "La discipline protège la bankroll",
    body: `
      <p>Un bon système de pronostics ne cherche pas à jouer tous les jours.</p>
      <p>Quand Hermès ne trouve pas de valeur claire, il vaut mieux ne rien publier que pousser un pari faible.</p>
      <p>C’est exactement l’esprit TousLesMatchs : moins de bruit, plus de sélection.</p>
    `
  },
  {
    key: "j3",
    minDays: 3,
    sentField: "email_j3_sent_at",
    subject: "Comment lire les indices Hermès",
    title: "Les picks Premium en un coup d’œil",
    body: `
      <p>Dans Premium, les picks sont classés par priorité.</p>
      <p>🥇 Priorité 1 : le plus solide. 🥈 Priorité 2 : alternative. 🥉 Priorité 3 : complément.</p>
      <p>L’indice visuel en coupes permet de comprendre rapidement le niveau de confiance.</p>
    `
  },
  {
    key: "j5",
    minDays: 5,
    sentField: "email_j5_sent_at",
    subject: "Premium lancement : 4,90€/mois",
    title: "Pourquoi passer Premium maintenant",
    body: `
      <p>Le Free reçoit uniquement le pick gratuit quand les critères sont remplis.</p>
      <p>Premium surveille plus de matchs, plus de sports et peut envoyer jusqu’à 3 opportunités prioritaires quand elles existent.</p>
      <p>L’offre de lancement est actuellement à 4,90€/mois.</p>
    `
  },
  {
    key: "j7",
    minDays: 7,
    sentField: "email_j7_sent_at",
    subject: "Dernier rappel : l’offre Premium lancement",
    title: "Vous pouvez rejoindre Premium quand vous êtes prêt",
    body: `
      <p>Si vous voulez recevoir plus d’opportunités que le canal Free, Premium est là pour ça.</p>
      <p>Aucun gain n’est garanti, mais vous recevez les analyses les plus suivies par Hermès.</p>
      <p>Vous pouvez commencer avec l’offre de lancement à 4,90€/mois.</p>
    `
  }
];

function pickNextEmail(lead) {
  const age = daysSince(lead.created_at);
  return sequence.find(step => age >= step.minDays && !lead[step.sentField]);
}

function emailPayload(email, step) {
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111;line-height:1.6">
      <h1>${step.title}</h1>
      ${step.body}

      <p>
        <a href="${PREMIUM_URL}" style="display:inline-block;background:#d4af37;color:#111;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:bold">
          Découvrir Premium à 4,90€
        </a>
      </p>

      <p>
        Canal Free : <a href="${FREE_TELEGRAM_URL}">${FREE_TELEGRAM_URL}</a><br>
        Site : <a href="${SITE_URL}">${SITE_URL}</a>
      </p>

      <p style="font-size:12px;color:#666;margin-top:28px">
        18+ uniquement. Les pronostics sont informatifs et ne garantissent aucun gain.
        Jouez uniquement ce que vous pouvez vous permettre de perdre.
      </p>
    </div>
  `;

  return {
    sender: { email: SENDER_EMAIL, name: SENDER_NAME },
    to: [{ email }],
    subject: step.subject,
    htmlContent,
    textContent: `${step.title}\n\n${step.subject}\n\nPremium : ${PREMIUM_URL}\nFree : ${FREE_TELEGRAM_URL}\n\n18+ uniquement. Aucun gain garanti.`
  };
}

function brevoPost(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);

    const req = https.request({
      hostname: "api.brevo.com",
      path: "/v3/smtp/email",
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body)
      }
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        let parsed = {};
        try { parsed = JSON.parse(data); } catch(e) { parsed = { raw: data }; }

        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
        else reject(new Error(`Brevo ${res.statusCode}: ${JSON.stringify(parsed)}`));
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY manquante");

  const data = readJson(LEADS_FILE, { leads: [] });
  const paid = activeSubscriberEmails();

  let sent = 0;
  let skipped = 0;

  for (const lead of data.leads || []) {
    const email = String(lead.email || "").toLowerCase();
    if (!email) continue;

    if (ONLY_EMAIL && email !== ONLY_EMAIL) {
      skipped++;
      continue;
    }

    if (paid.has(email)) {
      lead.status = "converted";
      skipped++;
      continue;
    }

    const step = pickNextEmail(lead);
    if (!step) {
      skipped++;
      continue;
    }

    const result = await brevoPost(emailPayload(email, step));

    lead[step.sentField] = new Date().toISOString();
    lead[`email_${step.key}_status`] = "sent";
    lead[`email_${step.key}_brevo_message_id`] = result.messageId || null;
    lead.last_sequence_email = step.key;

    sent++;
  }

  fs.writeFileSync(LEADS_FILE, JSON.stringify(data, null, 2));
  console.log(`OK - sequence emails envoyés: ${sent}, ignorés: ${skipped}`);
}

main().catch(err => {
  console.error("ERREUR - " + err.message);
  process.exit(1);
});
