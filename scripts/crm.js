const { bus, EVENT_NAMES: PUB_EVENT_NAMES } = require("./event_bus");

const CRM_EVENTS = {
  CONTACT_CREATED: "CONTACT_CREATED",
  CONTACT_UPDATED: "CONTACT_UPDATED",
  PLAN_CHANGED: "PLAN_CHANGED",
  SUBSCRIPTION_ACTIVATED: "SUBSCRIPTION_ACTIVATED",
  SUBSCRIPTION_CANCELLED: "SUBSCRIPTION_CANCELLED",
  CREDIT_USED: "CREDIT_USED",
  LEAD_REGISTERED: "LEAD_REGISTERED",
  REFERRAL_CREDITED: "REFERRAL_CREDITED",
};

const PLAN_HIERARCHY = {
  free: 0,
  lead: 1,
  carte: 2,
  premium: 3,
  elite: 4,
  vip: 5,
};

class CRM {
  constructor(db) {
    this._db = db;
    this._ensureTables();
  }

  _ensureTables() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS crm_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        code TEXT,
        credits_max INTEGER DEFAULT 0,
        credits_used INTEGER DEFAULT 0,
        credits_date TEXT DEFAULT '',
        expires_at TEXT,
        lang TEXT DEFAULT 'fr',
        country TEXT DEFAULT '',
        source TEXT DEFAULT 'direct',
        referrer TEXT DEFAULT '',
        utm_source TEXT DEFAULT '',
        utm_medium TEXT DEFAULT '',
        utm_campaign TEXT DEFAULT '',
        referral_code TEXT,
        referred_by TEXT,
        months_earned INTEGER DEFAULT 0,
        telegram_joined INTEGER DEFAULT 0,
        total_analyses INTEGER DEFAULT 0,
        last_analysis_at TEXT,
        total_signals_received INTEGER DEFAULT 0,
        brevo_synced INTEGER DEFAULT 0,
        brevo_synced_at TEXT,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS crm_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (contact_id) REFERENCES crm_contacts(id)
      );

      CREATE TABLE IF NOT EXISTS crm_plan_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        old_plan TEXT,
        new_plan TEXT NOT NULL,
        reason TEXT DEFAULT '',
        stripe_event_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (contact_id) REFERENCES crm_contacts(id)
      );
    `);
  }

  // ── Core CRUD ──

  getContact(email) {
    if (!email) return null;
    return this._db.prepare("SELECT * FROM crm_contacts WHERE email = ?").get(email.toLowerCase().trim()) || null;
  }

  getContactById(id) {
    return this._db.prepare("SELECT * FROM crm_contacts WHERE id = ?").get(id) || null;
  }

  findOrCreateContact(email, defaults = {}) {
    const clean = email.toLowerCase().trim();
    let contact = this.getContact(clean);
    if (contact) return { contact, created: false };

    this._db.prepare(`
      INSERT INTO crm_contacts (email, plan, source, lang, country, utm_source, utm_medium, utm_campaign, referrer, referred_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clean,
      defaults.plan || "free",
      defaults.source || "direct",
      defaults.lang || "fr",
      defaults.country || "",
      defaults.utm_source || "",
      defaults.utm_medium || "",
      defaults.utm_campaign || "",
      defaults.referrer || "",
      defaults.referred_by || "",
    );

    contact = this.getContact(clean);
    this._logEvent(contact.id, CRM_EVENTS.CONTACT_CREATED, { source: defaults.source || "direct" });
    bus.publish(CRM_EVENTS.CONTACT_CREATED, { contact_id: contact.id, email: clean });
    return { contact, created: true };
  }

  updateContact(email, fields) {
    const clean = email.toLowerCase().trim();
    const contact = this.getContact(clean);
    if (!contact) return null;

    const allowed = [
      "plan", "status", "stripe_customer_id", "stripe_subscription_id",
      "code", "credits_max", "credits_used", "credits_date", "expires_at",
      "lang", "country", "source", "referrer", "utm_source", "utm_medium", "utm_campaign",
      "referral_code", "referred_by", "months_earned", "telegram_joined",
      "total_analyses", "last_analysis_at", "total_signals_received",
      "brevo_synced", "brevo_synced_at", "notes",
    ];

    const updates = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (updates.length === 0) return contact;

    updates.push("updated_at = datetime('now')");
    values.push(contact.id);

    this._db.prepare(`UPDATE crm_contacts SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const updated = this.getContactById(contact.id);
    bus.publish(CRM_EVENTS.CONTACT_UPDATED, { contact_id: contact.id, email: clean, fields: Object.keys(fields) });
    return updated;
  }

  // ── Plan management ──

  changePlan(email, newPlan, reason = "", stripeEventId = "") {
    const clean = email.toLowerCase().trim();
    const contact = this.getContact(clean);
    if (!contact) return null;

    const oldPlan = contact.plan;
    if (oldPlan === newPlan) return contact;

    this._db.prepare(`
      UPDATE crm_contacts SET plan = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newPlan, contact.id);

    this._db.prepare(`
      INSERT INTO crm_plan_history (contact_id, old_plan, new_plan, reason, stripe_event_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(contact.id, oldPlan, newPlan, reason, stripeEventId);

    this._logEvent(contact.id, CRM_EVENTS.PLAN_CHANGED, { old: oldPlan, new: newPlan, reason });

    const isUpgrade = (PLAN_HIERARCHY[newPlan] || 0) > (PLAN_HIERARCHY[oldPlan] || 0);
    bus.publish(CRM_EVENTS.PLAN_CHANGED, {
      contact_id: contact.id, email: clean, old_plan: oldPlan, new_plan: newPlan,
      direction: isUpgrade ? "upgrade" : "downgrade",
    });

    return this.getContactById(contact.id);
  }

  // ── Subscription lifecycle ──

  activateSubscription(email, { plan, stripeCustomerId, stripeSubscriptionId, code, creditsMax, expiresAt, stripeEventId } = {}) {
    const { contact, created } = this.findOrCreateContact(email, { plan: plan || "premium" });
    const clean = email.toLowerCase().trim();

    const updates = { plan: plan || "premium", status: "active" };
    if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;
    if (stripeSubscriptionId) updates.stripe_subscription_id = stripeSubscriptionId;
    if (code) updates.code = code;
    if (creditsMax !== undefined) updates.credits_max = creditsMax;
    if (expiresAt) updates.expires_at = expiresAt;
    updates.credits_used = 0;
    updates.credits_date = new Date().toISOString().slice(0, 10);

    this.updateContact(clean, updates);

    if (contact.plan !== plan) {
      this.changePlan(clean, plan, "stripe_checkout", stripeEventId || "");
    }

    this._logEvent(contact.id, CRM_EVENTS.SUBSCRIPTION_ACTIVATED, { plan, code, stripeEventId });
    bus.publish(CRM_EVENTS.SUBSCRIPTION_ACTIVATED, { contact_id: contact.id, email: clean, plan });

    return this.getContact(clean);
  }

  cancelSubscription(email, reason = "stripe_cancelled") {
    const contact = this.getContact(email);
    if (!contact) return null;

    const oldPlan = contact.plan;
    this.updateContact(email, { plan: "free", status: "cancelled", stripe_subscription_id: "" });

    this._db.prepare(`
      INSERT INTO crm_plan_history (contact_id, old_plan, new_plan, reason)
      VALUES (?, ?, 'free', ?)
    `).run(contact.id, oldPlan, reason);

    this._logEvent(contact.id, CRM_EVENTS.SUBSCRIPTION_CANCELLED, { old_plan: oldPlan, reason });
    bus.publish(CRM_EVENTS.SUBSCRIPTION_CANCELLED, { contact_id: contact.id, email: contact.email, old_plan: oldPlan });

    return this.getContact(email);
  }

  // ── Credits ──

  useCredit(email) {
    const contact = this.getContact(email);
    if (!contact) return { ok: false, error: "contact_not_found" };

    const today = new Date().toISOString().slice(0, 10);
    if (contact.credits_date !== today) {
      this._db.prepare("UPDATE crm_contacts SET credits_used = 1, credits_date = ?, updated_at = datetime('now') WHERE id = ?")
        .run(today, contact.id);
    } else {
      if (contact.credits_used >= contact.credits_max && contact.credits_max > 0) {
        return { ok: false, error: "credits_exhausted", credits_left: 0 };
      }
      this._db.prepare("UPDATE crm_contacts SET credits_used = credits_used + 1, updated_at = datetime('now') WHERE id = ?")
        .run(contact.id);
    }

    const updated = this.getContactById(contact.id);
    const left = updated.credits_max > 0 ? Math.max(0, updated.credits_max - updated.credits_used) : 999999;

    this._db.prepare("UPDATE crm_contacts SET total_analyses = total_analyses + 1, last_analysis_at = datetime('now') WHERE id = ?")
      .run(contact.id);

    this._logEvent(contact.id, CRM_EVENTS.CREDIT_USED, { credits_left: left });
    return { ok: true, credits_left: left };
  }

  getCreditsLeft(email) {
    const contact = this.getContact(email);
    if (!contact) return 0;
    const today = new Date().toISOString().slice(0, 10);
    if (contact.credits_date !== today) return contact.credits_max;
    return contact.credits_max > 0 ? Math.max(0, contact.credits_max - contact.credits_used) : 999999;
  }

  // ── Lead registration ──

  registerLead(email, metadata = {}) {
    const { contact, created } = this.findOrCreateContact(email, {
      plan: "lead",
      source: metadata.source || "direct",
      lang: metadata.lang || "fr",
      country: metadata.country || "",
      utm_source: metadata.utm?.source || "",
      utm_medium: metadata.utm?.medium || "",
      utm_campaign: metadata.utm?.campaign || "",
      referrer: metadata.referrer || "",
    });

    if (!created && contact.plan === "free") {
      this.updateContact(email, { plan: "lead" });
    }

    this._logEvent(contact.id, CRM_EVENTS.LEAD_REGISTERED, { source: metadata.source || "direct" });
    bus.publish(CRM_EVENTS.LEAD_REGISTERED, { contact_id: contact.id, email: contact.email, source: metadata.source });

    return this.getContact(email);
  }

  // ── Referrals ──

  creditReferral(email, months = 1) {
    const contact = this.getContact(email);
    if (!contact) return null;

    this._db.prepare("UPDATE crm_contacts SET months_earned = months_earned + ?, updated_at = datetime('now') WHERE id = ?")
      .run(months, contact.id);

    this._logEvent(contact.id, CRM_EVENTS.REFERRAL_CREDITED, { months });
    bus.publish(CRM_EVENTS.REFERRAL_CREDITED, { contact_id: contact.id, email: contact.email, months });

    return this.getContactById(contact.id);
  }

  // ── Queries ──

  listContacts({ plan, status, limit = 50, offset = 0 } = {}) {
    let query = "SELECT * FROM crm_contacts";
    const params = [];
    const conditions = [];

    if (plan) { conditions.push("plan = ?"); params.push(plan); }
    if (status) { conditions.push("status = ?"); params.push(status); }

    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return this._db.prepare(query).all(...params);
  }

  countContacts(plan) {
    if (plan) {
      return this._db.prepare("SELECT COUNT(*) as count FROM crm_contacts WHERE plan = ?").get(plan).count;
    }
    return this._db.prepare("SELECT COUNT(*) as count FROM crm_contacts").get().count;
  }

  getContactStats() {
    const total = this.countContacts();
    const byPlan = {};
    for (const plan of Object.keys(PLAN_HIERARCHY)) {
      byPlan[plan] = this.countContacts(plan);
    }
    const active = this._db.prepare("SELECT COUNT(*) as count FROM crm_contacts WHERE status = 'active'").get().count;
    const cancelled = this._db.prepare("SELECT COUNT(*) as count FROM crm_contacts WHERE status = 'cancelled'").get().count;
    const withAnalyses = this._db.prepare("SELECT COUNT(*) as count FROM crm_contacts WHERE total_analyses > 0").get().count;

    return { total, active, cancelled, withAnalyses, byPlan };
  }

  getPlanHistory(email) {
    const contact = this.getContact(email);
    if (!contact) return [];
    return this._db.prepare(
      "SELECT * FROM crm_plan_history WHERE contact_id = ? ORDER BY created_at DESC"
    ).all(contact.id);
  }

  getContactEvents(email, limit = 50) {
    const contact = this.getContact(email);
    if (!contact) return [];
    return this._db.prepare(
      "SELECT * FROM crm_events WHERE contact_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(contact.id, limit);
  }

  searchContacts(query, limit = 20) {
    return this._db.prepare(
      "SELECT * FROM crm_contacts WHERE email LIKE ? ORDER BY created_at DESC LIMIT ?"
    ).all(`%${query}%`, limit);
  }

  // ── Brevo sync flag ──

  markBrevoSynced(email) {
    return this.updateContact(email, { brevo_synced: 1, brevo_synced_at: new Date().toISOString() });
  }

  getUnsyncedContacts(limit = 100) {
    return this._db.prepare(
      "SELECT * FROM crm_contacts WHERE brevo_synced = 0 LIMIT ?"
    ).all(limit);
  }

  // ── Migration helper ──

  importFromLegacy({ email, plan, code, creditsMax, expiresAt, stripeCustomerId, source, lang, country }) {
    const { contact, created } = this.findOrCreateContact(email, { plan, source, lang, country });
    if (!created) {
      const shouldUpgrade = (PLAN_HIERARCHY[plan] || 0) > (PLAN_HIERARCHY[contact.plan] || 0);
      if (shouldUpgrade) {
        this.changePlan(email, plan, "legacy_import");
      }
    }
    const updates = {};
    if (code) updates.code = code;
    if (creditsMax !== undefined) updates.credits_max = creditsMax;
    if (expiresAt) updates.expires_at = expiresAt;
    if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;
    if (Object.keys(updates).length) this.updateContact(email, updates);
    return this.getContact(email);
  }

  // ── Internal ──

  _logEvent(contactId, eventType, payload = {}) {
    this._db.prepare(
      "INSERT INTO crm_events (contact_id, event_type, payload) VALUES (?, ?, ?)"
    ).run(contactId, eventType, JSON.stringify(payload));
  }
}

module.exports = { CRM, CRM_EVENTS, PLAN_HIERARCHY };
