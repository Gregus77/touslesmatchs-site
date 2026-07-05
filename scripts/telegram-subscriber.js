// TousLesMatchs — Telegram Event Subscriber
// Listens to Event Bus events and manages Telegram group membership.
// Never called directly — only through bus.subscribe().

const { EVENT_TYPES } = require("./event-bus");

// ── Plan → Group mapping ────────────────────────────────────────────────────

const PLAN_GROUPS = {
  PAY_PER_VIEW: "TELEGRAM_GROUP_PAY_PER_VIEW",
  ESSENTIAL: "TELEGRAM_GROUP_ESSENTIAL",
  ELITE: "TELEGRAM_GROUP_ELITE",
};

const PLAN_HIERARCHY = ["PAY_PER_VIEW", "ESSENTIAL", "ELITE"];

function getGroupChatId(plan, env) {
  const envKey = PLAN_GROUPS[plan];
  if (!envKey) return null;
  return (env && env[envKey]) || null;
}

function getAllGroupChatIds(env) {
  const ids = [];
  for (const plan of PLAN_HIERARCHY) {
    const id = getGroupChatId(plan, env);
    if (id) ids.push({ plan, chatId: id });
  }
  return ids;
}

// ── Telegram Bot Client ─────────────────────────────────────────────────────

class TelegramBotClient {
  constructor(opts = {}) {
    this.token = opts.token || "";
    this.timeout = opts.timeout || 10000;
    this.httpCall = opts.httpCall || null;
  }

  async call(method, params = {}) {
    if (!this.token) {
      return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured", skipped: true };
    }

    try {
      if (this.httpCall) {
        return await this.httpCall(method, params);
      }
      return await this._apiCall(method, params);
    } catch (e) {
      if (e.message && e.message.includes("ETELEGRAM_")) {
        const code = e.message.split(":")[0];
        return { ok: false, error: e.message, telegramError: code };
      }
      return { ok: false, error: e.message };
    }
  }

  async _apiCall(method, params) {
    const https = require("https");
    const payload = JSON.stringify(params);

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: "api.telegram.org",
          path: `/bot${this.token}/${method}`,
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          },
          timeout: this.timeout,
        },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            try {
              const data = JSON.parse(body);
              if (data.ok) resolve(data);
              else {
                const err = new Error(`ETELEGRAM_${data.error_code}: ${data.description}`);
                reject(err);
              }
            } catch (e) {
              reject(new Error(`Telegram API parse error: ${body.slice(0, 200)}`));
            }
          });
        }
      );
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Telegram API timeout")); });
      req.write(payload);
      req.end();
    });
  }

  async createInviteLink(chatId, opts = {}) {
    const params = { chat_id: chatId };
    if (opts.expireSeconds) params.expire_date = Math.floor(Date.now() / 1000) + opts.expireSeconds;
    if (opts.memberLimit) params.member_limit = opts.memberLimit;
    params.creates_join_request = false;
    return this.call("createChatInviteLink", params);
  }

  async kickMember(chatId, userId) {
    return this.call("banChatMember", { chat_id: chatId, user_id: userId });
  }

  async unbanMember(chatId, userId) {
    return this.call("unbanChatMember", { chat_id: chatId, user_id: userId, only_if_banned: true });
  }

  async getChatMember(chatId, userId) {
    return this.call("getChatMember", { chat_id: chatId, user_id: userId });
  }
}

// ── Telegram Event Store ────────────────────────────────────────────────────

class TelegramEventStore {
  constructor(db) {
    this.db = db;
    this._migrate();
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bus_event_id TEXT,
        user_id INTEGER,
        email TEXT,
        telegram_user_id TEXT,
        group_plan TEXT,
        chat_id TEXT,
        action TEXT NOT NULL,
        result TEXT,
        error TEXT,
        invite_link TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_tg_events_user ON telegram_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_tg_events_action ON telegram_events(action);
      CREATE INDEX IF NOT EXISTS idx_tg_events_bus ON telegram_events(bus_event_id);
    `);
    this._insertStmt = this.db.prepare(`
      INSERT INTO telegram_events (bus_event_id, user_id, email, telegram_user_id, group_plan, chat_id, action, result, error, invite_link)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this._historyStmt = this.db.prepare(`
      SELECT * FROM telegram_events ORDER BY created_at DESC LIMIT ? OFFSET ?
    `);
    this._countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM telegram_events`);
    this._userHistoryStmt = this.db.prepare(`
      SELECT * FROM telegram_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `);
  }

  log(entry) {
    this._insertStmt.run(
      entry.busEventId || null,
      entry.userId || null,
      entry.email || null,
      entry.telegramUserId || null,
      entry.groupPlan || null,
      entry.chatId || null,
      entry.action,
      entry.result || null,
      entry.error || null,
      entry.inviteLink || null
    );
  }

  getHistory(limit = 50, offset = 0) {
    const events = this._historyStmt.all(Math.max(1, limit), Math.max(0, offset));
    const total = this._countStmt.get().total;
    return { events, total };
  }

  getUserHistory(userId, limit = 20) {
    return this._userHistoryStmt.all(userId, limit);
  }
}

// ── Invite Link Manager ─────────────────────────────────────────────────────

class InviteLinkManager {
  constructor(opts = {}) {
    this.client = opts.client;
    this.expireSeconds = opts.expireSeconds || 3600;
    this.memberLimit = opts.memberLimit || 1;
    this._cache = new Map();
    this._pending = new Map();
  }

  async getOrCreate(chatId) {
    const cached = this._cache.get(chatId);
    if (cached && cached.expireAt > Date.now()) {
      return { ok: true, link: cached.link, cached: true };
    }

    const pending = this._pending.get(chatId);
    if (pending) return pending;

    const promise = this._createLink(chatId);
    this._pending.set(chatId, promise);
    try {
      return await promise;
    } finally {
      this._pending.delete(chatId);
    }
  }

  async _createLink(chatId) {
    const result = await this.client.createInviteLink(chatId, {
      expireSeconds: this.expireSeconds,
      memberLimit: this.memberLimit,
    });

    if (!result.ok) return result;

    const link = result.result && result.result.invite_link;
    if (link) {
      this._cache.set(chatId, {
        link,
        expireAt: Date.now() + (this.expireSeconds - 60) * 1000,
      });
    }

    return { ok: true, link };
  }

  invalidate(chatId) {
    this._cache.delete(chatId);
  }

  invalidateAll() {
    this._cache.clear();
  }
}

// ── Telegram Subscriber ─────────────────────────────────────────────────────

class TelegramSubscriber {
  constructor(opts = {}) {
    this.client = opts.client;
    this.store = opts.store;
    this.inviteManager = opts.inviteManager;
    this.env = opts.env || process.env;
    this.resolveEmail = opts.resolveEmail || ((evt) => evt.payload.email || null);
    this.resolveTelegramUserId = opts.resolveTelegramUserId || null;
    this.subscriberTimeout = opts.timeout || 5000;
  }

  _logAndReturn(entry) {
    this.store.log(entry);
    return entry;
  }

  async _invite(envelope, plan) {
    const email = this.resolveEmail(envelope);
    const userId = envelope.payload.userId || envelope.meta.userId || null;
    const telegramUserId = this.resolveTelegramUserId
      ? await this.resolveTelegramUserId(envelope)
      : (envelope.payload.telegramUserId || null);
    const chatId = getGroupChatId(plan, this.env);

    if (!chatId) {
      return this._logAndReturn({
        busEventId: envelope.id,
        userId, email, telegramUserId,
        groupPlan: plan, chatId: null,
        action: "invite",
        result: "skipped",
        error: `No chat_id configured for plan ${plan}`,
      });
    }

    const linkResult = await this.inviteManager.getOrCreate(chatId);
    if (!linkResult.ok) {
      return this._logAndReturn({
        busEventId: envelope.id,
        userId, email, telegramUserId,
        groupPlan: plan, chatId,
        action: "invite",
        result: "failed",
        error: linkResult.error || "Failed to create invite link",
      });
    }

    return this._logAndReturn({
      busEventId: envelope.id,
      userId, email, telegramUserId,
      groupPlan: plan, chatId,
      action: "invite",
      result: "success",
      inviteLink: linkResult.link,
    });
  }

  async _remove(envelope, plan, reason) {
    const email = this.resolveEmail(envelope);
    const userId = envelope.payload.userId || envelope.meta.userId || null;
    const telegramUserId = this.resolveTelegramUserId
      ? await this.resolveTelegramUserId(envelope)
      : (envelope.payload.telegramUserId || null);
    const chatId = getGroupChatId(plan, this.env);

    if (!chatId) {
      return this._logAndReturn({
        busEventId: envelope.id,
        userId, email, telegramUserId,
        groupPlan: plan, chatId: null,
        action: "remove",
        result: "skipped",
        error: `No chat_id configured for plan ${plan}`,
      });
    }

    if (!telegramUserId) {
      return this._logAndReturn({
        busEventId: envelope.id,
        userId, email, telegramUserId: null,
        groupPlan: plan, chatId,
        action: "remove",
        result: "skipped",
        error: "No telegram_user_id available",
      });
    }

    const kickResult = await this.client.kickMember(chatId, telegramUserId);
    if (!kickResult.ok) {
      if (kickResult.error && kickResult.error.includes("user not found")) {
        return this._logAndReturn({
          busEventId: envelope.id,
          userId, email, telegramUserId,
          groupPlan: plan, chatId,
          action: "remove",
          result: "skipped",
          error: "User not in group",
        });
      }
      return this._logAndReturn({
        busEventId: envelope.id,
        userId, email, telegramUserId,
        groupPlan: plan, chatId,
        action: "remove",
        result: "failed",
        error: kickResult.error || "Kick failed",
      });
    }

    await this.client.unbanMember(chatId, telegramUserId);

    return this._logAndReturn({
      busEventId: envelope.id,
      userId, email, telegramUserId,
      groupPlan: plan, chatId,
      action: "remove",
      result: "success",
    });
  }

  async _move(envelope, oldPlan, newPlan) {
    const results = [];
    if (oldPlan && oldPlan !== newPlan) {
      results.push(await this._remove(envelope, oldPlan, "plan_change"));
    }
    results.push(await this._invite(envelope, newPlan));
    return results;
  }

  async handleSubscriptionCreated(envelope) {
    const plan = envelope.payload.plan;
    if (!plan) return;
    return this._invite(envelope, plan);
  }

  async handleSubscriptionUpdated(envelope) {
    const plan = envelope.payload.plan;
    const oldPlan = envelope.payload.oldPlan || null;
    if (!plan) return;
    if (oldPlan && oldPlan !== plan) {
      return this._move(envelope, oldPlan, plan);
    }
    return this._invite(envelope, plan);
  }

  async handleSubscriptionCancelled(envelope) {
    const plan = envelope.payload.plan;
    if (!plan) return;
    return this._remove(envelope, plan, "cancelled");
  }

  async handleSubscriptionExpired(envelope) {
    const plan = envelope.payload.plan;
    if (!plan) return;
    return this._remove(envelope, plan, "expired");
  }

  async handlePaymentRefunded(envelope) {
    const plan = envelope.payload.plan;
    if (!plan) return;
    return this._remove(envelope, plan, "refunded");
  }

  async handleUserCreated(envelope) {
    const email = this.resolveEmail(envelope);
    const userId = envelope.payload.userId || null;
    this.store.log({
      busEventId: envelope.id,
      userId,
      email,
      action: "user_registered",
      result: "logged",
    });
  }

  getHistory(limit = 50, offset = 0) {
    return this.store.getHistory(limit, offset);
  }

  getUserHistory(userId, limit = 20) {
    return this.store.getUserHistory(userId, limit);
  }
}

// ── Bus Wiring ──────────────────────────────────────────────────────────────

const EVENT_HANDLERS = {
  SUBSCRIPTION_CREATED: "handleSubscriptionCreated",
  SUBSCRIPTION_UPDATED: "handleSubscriptionUpdated",
  SUBSCRIPTION_CANCELLED: "handleSubscriptionCancelled",
  SUBSCRIPTION_EXPIRED: "handleSubscriptionExpired",
  PAYMENT_REFUNDED: "handlePaymentRefunded",
  USER_CREATED: "handleUserCreated",
};

function wireTelegramSubscribers(bus, subscriber, opts = {}) {
  const subscriberTimeout = opts.timeout || 5000;
  const handlers = [];

  for (const [eventType, methodName] of Object.entries(EVENT_HANDLERS)) {
    const handler = async (envelope) => {
      await subscriber[methodName](envelope);
    };

    Object.defineProperty(handler, "name", { value: `telegram_${methodName}` });
    bus.subscribe(eventType, handler, { timeout: subscriberTimeout });
    handlers.push({ eventType, handler });
  }

  return handlers;
}

module.exports = {
  TelegramBotClient,
  TelegramEventStore,
  InviteLinkManager,
  TelegramSubscriber,
  PLAN_GROUPS,
  PLAN_HIERARCHY,
  EVENT_HANDLERS,
  getGroupChatId,
  getAllGroupChatIds,
  wireTelegramSubscribers,
};
