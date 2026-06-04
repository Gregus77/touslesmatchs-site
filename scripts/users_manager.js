// ═══════════════════════════════════════════════════════
// USERS MANAGER — Gestion utilisateurs + base JSON
// ═══════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = process.env.USERS_DB_PATH || "./scripts/users_db.json";

class UsersManager {
  constructor() {
    this.db = this.loadDB();
  }

  loadDB() {
    try {
      if (!fs.existsSync(DB_PATH)) {
        return {
          version: "1.0",
          created: new Date().toISOString(),
          users: [],
          subscriptions: [],
          telegram_invites: [],
          stats: { total_users: 0, free: 0, premium: 0, vip: 0, elite: 0, mrr: 0 },
        };
      }
      return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    } catch (e) {
      console.error("DB load error:", e.message);
      return { users: [], subscriptions: [], telegram_invites: [] };
    }
  }

  saveDB() {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.db, null, 2));
  }

  hashPassword(pwd) {
    return crypto.createHash("sha256").update(pwd + "salt").digest("hex");
  }

  createUser(email, password, initialStatus = "free") {
    if (this.db.users.find(u => u.email === email)) {
      return { ok: false, error: "Email déjà utilisé" };
    }

    const user = {
      id: crypto.randomUUID(),
      email,
      password_hash: this.hashPassword(password),
      status: initialStatus, // free/premium/vip/elite
      stripe_customer_id: null,
      stripe_subscription_id: null,
      telegram_id: null,
      created_at: new Date().toISOString(),
      analyses_used_today: 0,
      analyses_limit: this.getLimit(initialStatus),
      last_analysis_at: null,
      last_login: new Date().toISOString(),
    };

    this.db.users.push(user);
    this.updateStats();
    this.saveDB();

    return { ok: true, user: { id: user.id, email: user.email, status: user.status } };
  }

  authenticateUser(email, password) {
    const user = this.db.users.find(u => u.email === email);
    if (!user || user.password_hash !== this.hashPassword(password)) {
      return { ok: false, error: "Email ou mot de passe incorrect" };
    }

    user.last_login = new Date().toISOString();
    this.saveDB();

    return { ok: true, user: { id: user.id, email: user.email, status: user.status } };
  }

  getUserById(userId) {
    return this.db.users.find(u => u.id === userId) || null;
  }

  updateUserStatus(userId, newStatus, stripeCustomerId = null, stripeSubscriptionId = null) {
    const user = this.db.users.find(u => u.id === userId);
    if (!user) return { ok: false, error: "User not found" };

    user.status = newStatus;
    user.analyses_limit = this.getLimit(newStatus);
    if (stripeCustomerId) user.stripe_customer_id = stripeCustomerId;
    if (stripeSubscriptionId) user.stripe_subscription_id = stripeSubscriptionId;

    this.updateStats();
    this.saveDB();

    return { ok: true, user };
  }

  getLimit(status) {
    const limits = {
      free: 3,
      premium: 10,
      vip: 30,
      elite: 100,
    };
    return limits[status] || 3;
  }

  recordAnalysis(userId) {
    const user = this.getUserById(userId);
    if (!user) return { ok: false, error: "User not found" };

    const today = new Date().toDateString();
    const lastAnalysisDate = user.last_analysis_at ? new Date(user.last_analysis_at).toDateString() : null;

    if (lastAnalysisDate !== today) {
      user.analyses_used_today = 1;
    } else {
      user.analyses_used_today += 1;
    }

    user.last_analysis_at = new Date().toISOString();

    if (user.analyses_used_today >= user.analyses_limit) {
      return { ok: false, error: "Quota dépassé", analyses_remaining: 0 };
    }

    this.saveDB();
    return { ok: true, analyses_remaining: user.analyses_limit - user.analyses_used_today };
  }

  createTelegramInvite(userId, expiresIn = 86400000) {
    // 24h default
    const user = this.getUserById(userId);
    if (!user) return { ok: false, error: "User not found" };

    const token = crypto.randomBytes(32).toString("hex");
    const invite = {
      token,
      user_id: userId,
      email: user.email,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + expiresIn).toISOString(),
      used: false,
    };

    this.db.telegram_invites.push(invite);
    this.saveDB();

    return {
      ok: true,
      invite_url: `https://touslesmatchs.com/join-vip?token=${token}`,
      expires_at: invite.expires_at,
    };
  }

  validateTelegramInvite(token) {
    const invite = this.db.telegram_invites.find(i => i.token === token && !i.used);
    if (!invite) return { ok: false, error: "Invitation invalide ou expirée" };

    if (new Date(invite.expires_at) < new Date()) {
      return { ok: false, error: "Invitation expirée" };
    }

    invite.used = true;
    this.saveDB();

    return { ok: true, email: invite.email, user_id: invite.user_id };
  }

  updateStats() {
    this.db.stats = {
      total_users: this.db.users.length,
      free: this.db.users.filter(u => u.status === "free").length,
      premium: this.db.users.filter(u => u.status === "premium").length,
      vip: this.db.users.filter(u => u.status === "vip").length,
      elite: this.db.users.filter(u => u.status === "elite").length,
      mrr: this.calculateMRR(),
    };
  }

  calculateMRR() {
    const prices = { premium: 9.9, vip: 19.9, elite: 29.9 };
    return this.db.users.reduce((mrr, u) => mrr + (prices[u.status] || 0), 0);
  }
}

module.exports = UsersManager;
