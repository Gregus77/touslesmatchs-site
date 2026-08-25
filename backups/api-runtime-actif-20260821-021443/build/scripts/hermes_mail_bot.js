/**
 * Bot email Hermes — relève hermes@touslesmatchs.com, identifie l'expéditeur
 * (abonné Stripe ? contact Brevo ?), rédige un brouillon de réponse dans la
 * langue du message, et le soumet à validation admin avant tout envoi réel.
 *
 * Volontairement PAS d'envoi automatique dans cette première version (décision
 * fondateur du 04/08/2026) : un brouillon part sur Telegram admin avec un lien
 * "Valider" à un clic — rien ne part au client sans confirmation humaine.
 *
 * Coût IA : passe par analysisEngine.allowChatbotCall (même garde-fou que le
 * chatbot du site), donc compté dans le même plafond, jamais un budget à part.
 */

const https = require("https");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const nodemailer = require("nodemailer");

function ensureMailDraftsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mail_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_email TEXT,
      subject TEXT,
      body_in TEXT,
      lang TEXT,
      stripe_status TEXT,
      brevo_status TEXT,
      draft_reply TEXT,
      status TEXT DEFAULT 'pending',
      message_id TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT
    )
  `);
}

async function lookupStripeStatus(stripe, email) {
  if (!stripe || !email) return "inconnu";
  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) return "aucun abonnement";
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: "active", limit: 1 });
    if (!subs.data.length) return "client (abonnement inactif)";
    const item = subs.data[0].items.data[0];
    const nickname = item?.price?.nickname || item?.price?.id || "actif";
    return `abonné actif (${nickname})`;
  } catch (e) {
    console.error("[hermes-mail] lookup Stripe:", e.message);
    return "inconnu (erreur Stripe)";
  }
}

async function lookupBrevoStatus(brevoApiKey, email) {
  if (!brevoApiKey || !email) return "inconnu";
  return new Promise((resolve) => {
    const req = https.request(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      { method: "GET", headers: { "api-key": brevoApiKey } },
      (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          if (res.statusCode !== 200) return resolve("non trouvé");
          try {
            const json = JSON.parse(data);
            const lists = (json.listIds || []).join(",");
            resolve(lists ? `contact Brevo (listes ${lists})` : "contact Brevo (aucune liste)");
          } catch {
            resolve("inconnu (parse Brevo)");
          }
        });
      }
    );
    req.on("error", () => resolve("inconnu (erreur Brevo)"));
    req.end();
  });
}

async function draftReply({ analysisEngine, db, mistralApiKey, fromEmail, subject, body, stripeStatus, brevoStatus }) {
  const gate = analysisEngine.allowChatbotCall(db, { sessionId: `mail_${fromEmail}_${Date.now()}` });
  if (!gate.allowed) return { ok: false, reason: gate.reason };

  const sys = `Tu es Hermes, l'assistant email de TousLesMatchs (analyses sportives par IA, France, encadré ANJ).
Règles absolues : jamais le mot "pari" (dire "analyse" ou "pronostic"), jamais de garantie de gain, jamais de promesse
de remboursement ou de geste commercial sans validation humaine (dis que "l'équipe va vérifier"), toujours répondre
dans la MÊME langue que le message reçu. Statut connu de cet expéditeur : Stripe = ${stripeStatus} ; Brevo = ${brevoStatus}.
Rédige une réponse email courte, professionnelle, chaleureuse. Signe "L'équipe TousLesMatchs".`;

  try {
    const resp = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mistralApiKey}` },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Objet: ${subject}\n\n${body}`.slice(0, 4000) },
        ],
        max_tokens: 500,
        temperature: 0.4,
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "";
    gate.record(data?.usage?.prompt_tokens, data?.usage?.completion_tokens, reply ? "ok" : "error");
    return reply ? { ok: true, reply } : { ok: false, reason: "réponse vide" };
  } catch (e) {
    gate.record(0, 0, "error");
    return { ok: false, reason: e.message };
  }
}

async function pollHermesMailbox(db, ctx) {
  const {
    user, password, imapHost, imapPort,
    stripe, brevoApiKey, mistralApiKey, analysisEngine,
    sendTelegramMessage, telegramAdminChatId, siteBaseUrl, adminToken,
  } = ctx;
  if (!user || !password) return; // pas configuré, no-op silencieux

  ensureMailDraftsTable(db);

  const client = new ImapFlow({
    host: imapHost, port: imapPort, secure: true,
    auth: { user, pass: password }, logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const unseen = await client.search({ seen: false });
      for (const uid of unseen || []) {
        const msg = await client.fetchOne(uid, { source: true, envelope: true });
        const parsed = await simpleParser(msg.source);
        const fromEmail = (parsed.from?.value?.[0]?.address || "").toLowerCase();
        const subject = parsed.subject || "(sans objet)";
        const body = (parsed.text || "").trim();
        const messageId = parsed.messageId || `${uid}_${Date.now()}`;

        await client.messageFlagsAdd(uid, ["\\Seen"]);
        if (!fromEmail || !body) continue;

        const already = db.prepare("SELECT id FROM mail_drafts WHERE message_id = ?").get(messageId);
        if (already) continue;

        const [stripeStatus, brevoStatus] = await Promise.all([
          lookupStripeStatus(stripe, fromEmail),
          lookupBrevoStatus(brevoApiKey, fromEmail),
        ]);

        const drafted = await draftReply({ analysisEngine, db, mistralApiKey, fromEmail, subject, body, stripeStatus, brevoStatus });
        const draftText = drafted.ok ? drafted.reply : `[Échec génération : ${drafted.reason}] Réponse à rédiger manuellement.`;

        const info = db.prepare(`
          INSERT INTO mail_drafts (from_email, subject, body_in, stripe_status, brevo_status, draft_reply, message_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(fromEmail, subject, body, stripeStatus, brevoStatus, draftText, messageId);

        if (sendTelegramMessage && telegramAdminChatId) {
          const approveUrl = `${siteBaseUrl}/admin/mail-drafts/${info.lastInsertRowid}/approve?token=${adminToken}`;
          const rejectUrl = `${siteBaseUrl}/admin/mail-drafts/${info.lastInsertRowid}/reject?token=${adminToken}`;
          const text = `📧 <b>Email client — brouillon Hermes</b>\n\n` +
            `De : ${fromEmail}\nStripe : ${stripeStatus}\nBrevo : ${brevoStatus}\nObjet : ${subject}\n\n` +
            `<b>Message :</b>\n${body.slice(0, 500)}\n\n` +
            `<b>Brouillon de réponse :</b>\n${draftText}\n\n` +
            `✅ Valider et envoyer : ${approveUrl}\n❌ Rejeter : ${rejectUrl}`;
          sendTelegramMessage(telegramAdminChatId, text).catch(() => {});
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e) {
    console.error("[hermes-mail] poll:", e.message);
    try { await client.logout(); } catch {}
  }
}

async function sendApprovedDraft(db, id, { smtpHost, smtpPort, user, password }) {
  const row = db.prepare("SELECT * FROM mail_drafts WHERE id = ?").get(id);
  if (!row) return { ok: false, error: "brouillon introuvable" };
  if (row.status !== "pending") return { ok: false, error: `déjà ${row.status}` };

  const transporter = nodemailer.createTransport({
    host: smtpHost, port: smtpPort, secure: true,
    auth: { user, pass: password },
  });

  try {
    await transporter.sendMail({
      from: `Hermes — TousLesMatchs <${user}>`,
      to: row.from_email,
      subject: `Re: ${row.subject}`,
      text: row.draft_reply,
    });
    db.prepare("UPDATE mail_drafts SET status='sent', sent_at=datetime('now') WHERE id=?").run(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function rejectDraft(db, id) {
  const row = db.prepare("SELECT id, status FROM mail_drafts WHERE id = ?").get(id);
  if (!row) return { ok: false, error: "brouillon introuvable" };
  if (row.status !== "pending") return { ok: false, error: `déjà ${row.status}` };
  db.prepare("UPDATE mail_drafts SET status='rejected' WHERE id=?").run(id);
  return { ok: true };
}

module.exports = { pollHermesMailbox, sendApprovedDraft, rejectDraft, ensureMailDraftsTable };
