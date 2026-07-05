// TousLesMatchs — Brevo Event Subscriber
// Listens to Event Bus events and sends appropriate emails via Brevo API.
// Never called directly — only through bus.subscribe().

const { EVENT_TYPES } = require("./event-bus");

// ── Email Templates ──────────────────────────────────────────────────────────

const TEMPLATES = {
  welcome: {
    subject: "Bienvenue sur TousLesMatchs",
    build: (data) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2>Bienvenue sur TousLesMatchs !</h2>
        <p>Votre compte a bien ete cree.</p>
        <p>Vous pouvez maintenant acceder aux analyses IA de nos experts.</p>
        <p style="color:#888;font-size:12px;">Analyses sportives reservees aux +18 ans. Jeu responsable. joueurs-info-service.fr</p>
      </div>`,
  },
  subscription_created: {
    subject: (data) => `Votre abonnement ${data.plan} est actif`,
    build: (data) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2>Abonnement active !</h2>
        <p>Votre abonnement <strong>${data.plan}</strong> est maintenant actif.</p>
        <p>Vous avez acces a toutes les analyses correspondant a votre plan.</p>
        <p style="color:#888;font-size:12px;">Analyses sportives reservees aux +18 ans. Jeu responsable. joueurs-info-service.fr</p>
      </div>`,
  },
  subscription_updated: {
    subject: (data) => `Votre abonnement a ete modifie`,
    build: (data) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2>Abonnement modifie</h2>
        <p>Votre abonnement est passe de <strong>${data.oldPlan || "N/A"}</strong> a <strong>${data.plan}</strong>.</p>
        <p style="color:#888;font-size:12px;">Analyses sportives reservees aux +18 ans. Jeu responsable. joueurs-info-service.fr</p>
      </div>`,
  },
  subscription_cancelled: {
    subject: "Votre abonnement a ete resilie",
    build: (data) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2>Abonnement resilie</h2>
        <p>Votre abonnement <strong>${data.plan || ""}</strong> a bien ete resilie.</p>
        <p>Vous conservez l'acces jusqu'a la fin de votre periode en cours.</p>
        <p>Vous pouvez vous reabonner a tout moment.</p>
        <p style="color:#888;font-size:12px;">Analyses sportives reservees aux +18 ans. Jeu responsable. joueurs-info-service.fr</p>
      </div>`,
  },
  subscription_expired: {
    subject: "Votre abonnement a expire",
    build: (data) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2>Abonnement expire</h2>
        <p>Votre abonnement <strong>${data.plan || ""}</strong> a expire.</p>
        <p>Renouvelez maintenant pour ne pas manquer les prochaines analyses.</p>
        <p style="color:#888;font-size:12px;">Analyses sportives reservees aux +18 ans. Jeu responsable. joueurs-info-service.fr</p>
      </div>`,
  },
  payment_failed: {
    subject: "Echec de paiement — action requise",
    build: (data) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2>Echec de paiement</h2>
        <p>Votre dernier paiement a echoue${data.reason ? " (" + data.reason + ")" : ""}.</p>
        <p>Veuillez mettre a jour votre moyen de paiement pour conserver votre acces.</p>
        <p style="color:#888;font-size:12px;">Analyses sportives reservees aux +18 ans. Jeu responsable. joueurs-info-service.fr</p>
      </div>`,
  },
  payment_refunded: {
    subject: "Votre remboursement a ete effectue",
    build: (data) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2>Remboursement confirme</h2>
        <p>Votre paiement${data.amount ? " de " + (data.amount / 100).toFixed(2) + " EUR" : ""} a ete rembourse.</p>
        <p style="color:#888;font-size:12px;">Analyses sportives reservees aux +18 ans. Jeu responsable. joueurs-info-service.fr</p>
      </div>`,
  },
  // Scheduled follow-ups
  followup_j1: {
    subject: "Le Concile vient de publier — voici ce que tu as manque",
    build: (data) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2>Tu as manque le pick du jour ?</h2>
        <p>Le Concile IA a publie son analyse. Ne rate pas les prochaines.</p>
        <p style="color:#888;font-size:12px;">Analyses sportives reservees aux +18 ans. Jeu responsable. joueurs-info-service.fr</p>
      </div>`,
  },
  followup_j3: {
    subject: "Tu vois le signal, pas l'analyse complete",
    build: (data) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2>Passe au niveau superieur</h2>
        <p>Avec un abonnement, accede aux analyses completes du Concile IA.</p>
        <p style="color:#888;font-size:12px;">Analyses sportives reservees aux +18 ans. Jeu responsable. joueurs-info-service.fr</p>
      </div>`,
  },
  followup_j7: {
    subject: "Ta premiere semaine est passee — voici le bilan",
    build: (data) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2>Bilan de ta premiere semaine</h2>
        <p>Les analyses IA continuent chaque jour. Rejoins les abonnes.</p>
        <p style="color:#888;font-size:12px;">Analyses sportives reservees aux +18 ans. Jeu responsable. joueurs-info-service.fr</p>
      </div>`,
  },
};

// ── Brevo Sender ─────────────────────────────────────────────────────────────

class BrevoSender {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || "";
    this.senderEmail = opts.senderEmail || "noreply@touslesmatchs.com";
    this.senderName = opts.senderName || "TousLesMatchs";
    this.httpPost = opts.httpPost || null; // injected for testing
    this.timeout = opts.timeout || 10000;
  }

  async send(to, subject, htmlContent) {
    if (!this.apiKey) {
      return { ok: false, error: "BREVO_API_KEY not configured", skipped: true };
    }
    if (!to || !subject) {
      return { ok: false, error: "Missing recipient or subject" };
    }

    try {
      if (this.httpPost) {
        await this.httpPost({
          to,
          subject,
          htmlContent,
          sender: { name: this.senderName, email: this.senderEmail },
        });
      } else {
        await this._brevoApiCall(to, subject, htmlContent);
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async _brevoApiCall(to, subject, htmlContent) {
    const https = require("https");
    const payload = JSON.stringify({
      sender: { name: this.senderName, email: this.senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: "api.brevo.com",
          path: "/v3/smtp/email",
          method: "POST",
          headers: {
            "api-key": this.apiKey,
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          },
          timeout: this.timeout,
        },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
            else reject(new Error(`Brevo API ${res.statusCode}: ${body}`));
          });
        }
      );
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Brevo API timeout")); });
      req.write(payload);
      req.end();
    });
  }
}

// ── Email Scheduler ──────────────────────────────────────────────────────────

class EmailScheduler {
  constructor(opts = {}) {
    this.db = opts.db;
    this.sender = opts.sender;
    this.checkIntervalMs = opts.checkIntervalMs || 60000;
    this._timer = null;
    this._migrate();
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient TEXT NOT NULL,
        template_key TEXT NOT NULL,
        template_data TEXT,
        event_id TEXT,
        scheduled_at TEXT NOT NULL,
        sent_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
      CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_email_queue_dedup ON email_queue(recipient, template_key, event_id);
    `);
    this._enqueueStmt = this.db.prepare(`
      INSERT INTO email_queue (recipient, template_key, template_data, event_id, scheduled_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    this._dedupStmt = this.db.prepare(`
      SELECT id FROM email_queue
      WHERE recipient = ? AND template_key = ? AND event_id = ? AND status != 'failed'
      LIMIT 1
    `);
    this._pendingStmt = this.db.prepare(`
      SELECT * FROM email_queue
      WHERE status = 'pending' AND scheduled_at <= datetime('now')
      ORDER BY scheduled_at ASC
      LIMIT ?
    `);
    this._updateStmt = this.db.prepare(`
      UPDATE email_queue SET status = ?, sent_at = ?, error = ? WHERE id = ?
    `);
    this._historyStmt = this.db.prepare(`
      SELECT * FROM email_queue ORDER BY created_at DESC LIMIT ? OFFSET ?
    `);
    this._countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM email_queue`);
  }

  enqueue(recipient, templateKey, data = {}, opts = {}) {
    const eventId = opts.eventId || null;
    const delayMs = opts.delayMs || 0;
    const d = new Date(Date.now() + delayMs);
    const scheduledAt = d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");

    if (eventId && this._dedupStmt.get(recipient, templateKey, eventId)) {
      return { ok: true, skipped: true, reason: "duplicate" };
    }

    const result = this._enqueueStmt.run(
      recipient, templateKey, JSON.stringify(data), eventId, scheduledAt
    );
    return { ok: true, id: result.lastInsertRowid };
  }

  async processPending(batchSize = 10) {
    const pending = this._pendingStmt.all(batchSize);
    const results = [];

    for (const job of pending) {
      const template = TEMPLATES[job.template_key];
      if (!template) {
        this._updateStmt.run("failed", null, `Unknown template: ${job.template_key}`, job.id);
        results.push({ id: job.id, ok: false, error: `Unknown template: ${job.template_key}` });
        continue;
      }

      const data = JSON.parse(job.template_data || "{}");
      const subject = typeof template.subject === "function" ? template.subject(data) : template.subject;
      const html = template.build(data);

      const sendResult = await this.sender.send(job.recipient, subject, html);
      if (sendResult.ok) {
        this._updateStmt.run("sent", new Date().toISOString(), null, job.id);
        results.push({ id: job.id, ok: true });
      } else if (sendResult.skipped) {
        this._updateStmt.run("skipped", null, sendResult.error, job.id);
        results.push({ id: job.id, ok: true, skipped: true });
      } else {
        this._updateStmt.run("failed", null, sendResult.error, job.id);
        results.push({ id: job.id, ok: false, error: sendResult.error });
      }
    }

    return results;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this.processPending(), this.checkIntervalMs);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  getHistory(limit = 50, offset = 0) {
    const emails = this._historyStmt.all(Math.max(1, limit), Math.max(0, offset));
    const total = this._countStmt.get().total;
    return { emails, total };
  }
}

// ── Bus Wiring ───────────────────────────────────────────────────────────────

const EVENT_TO_TEMPLATE = {
  USER_CREATED: "welcome",
  SUBSCRIPTION_CREATED: "subscription_created",
  SUBSCRIPTION_UPDATED: "subscription_updated",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  SUBSCRIPTION_EXPIRED: "subscription_expired",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_REFUNDED: "payment_refunded",
};

const FOLLOWUP_SCHEDULE = {
  USER_CREATED: [
    { template: "followup_j1", delayMs: 1 * 24 * 3600 * 1000 },
    { template: "followup_j3", delayMs: 3 * 24 * 3600 * 1000 },
    { template: "followup_j7", delayMs: 7 * 24 * 3600 * 1000 },
  ],
};

function wireBrevoSubscribers(bus, scheduler, opts = {}) {
  const resolveEmail = opts.resolveEmail || ((evt) => evt.payload.email || null);
  const subscriberTimeout = opts.timeout || 5000;
  const handlers = [];

  for (const [eventType, templateKey] of Object.entries(EVENT_TO_TEMPLATE)) {
    const handler = async (envelope) => {
      const email = resolveEmail(envelope);
      if (!email) return;

      scheduler.enqueue(email, templateKey, envelope.payload, {
        eventId: envelope.id,
      });

      const followups = FOLLOWUP_SCHEDULE[eventType];
      if (followups) {
        for (const fu of followups) {
          scheduler.enqueue(email, fu.template, envelope.payload, {
            eventId: envelope.id + "_" + fu.template,
            delayMs: fu.delayMs,
          });
        }
      }
    };

    Object.defineProperty(handler, "name", { value: `brevo_${templateKey}` });
    bus.subscribe(eventType, handler, { timeout: subscriberTimeout });
    handlers.push({ eventType, handler });
  }

  return handlers;
}

module.exports = {
  BrevoSender,
  EmailScheduler,
  TEMPLATES,
  EVENT_TO_TEMPLATE,
  FOLLOWUP_SCHEDULE,
  wireBrevoSubscribers,
};
