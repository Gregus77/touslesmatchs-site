// Mission 003: Stripe Handler
// Processes Stripe webhook events and routes them to the Subscription Engine.
// The webhook is the sole authority — browser returns never mutate subscriptions.

const Database = require("better-sqlite3");

const PRICE_TO_PLAN = {
  STRIPE_PRICE_ID_CARTE: "PAY_PER_VIEW",
  STRIPE_PRICE_ID_ESSENTIAL: "ESSENTIAL",
  STRIPE_PRICE_ID_ELITE: "ELITE",
};

class StripeHandler {
  constructor({ db, subscriptionEngine, priceConfig, codesDbPath }) {
    this.db = db;
    this.engine = subscriptionEngine;
    this.codesDbPath = codesDbPath;

    // priceConfig: { carte: "price_xxx", essential: "price_yyy", elite: "price_zzz" }
    this.priceConfig = priceConfig || {};

    // Reverse map: price_id → plan enum
    this.priceToPlan = {};
    if (priceConfig.carte) this.priceToPlan[priceConfig.carte] = "PAY_PER_VIEW";
    if (priceConfig.essential) this.priceToPlan[priceConfig.essential] = "ESSENTIAL";
    if (priceConfig.elite) this.priceToPlan[priceConfig.elite] = "ELITE";

    this._ensureStripeEventsTable();
  }

  _ensureStripeEventsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stripe_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stripe_event_id TEXT UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        stripe_payment_intent_id TEXT,
        user_email TEXT,
        user_id INTEGER,
        result TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        raw_data TEXT,
        processed_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(stripe_event_id);
      CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_stripe_events_customer ON stripe_events(stripe_customer_id);
    `);
  }

  _isAlreadyProcessed(stripeEventId) {
    const row = this.db.prepare(
      "SELECT id, result FROM stripe_events WHERE stripe_event_id = ?"
    ).get(stripeEventId);
    return row && row.result === "success";
  }

  _recordEvent(eventId, type, details, result, error = null) {
    try {
      this.db.prepare(`
        INSERT INTO stripe_events
          (stripe_event_id, event_type, stripe_customer_id, stripe_subscription_id,
           stripe_payment_intent_id, user_email, user_id, result, error, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(stripe_event_id) DO UPDATE SET
          result = excluded.result,
          error = excluded.error,
          processed_at = datetime('now')
      `).run(
        eventId,
        type,
        details.customerId || null,
        details.subscriptionId || null,
        details.paymentIntentId || null,
        details.email || null,
        details.userId || null,
        result,
        error,
        details.rawData || null
      );
    } catch (e) {
      console.error("[stripe-handler] recordEvent error:", e.message);
    }
  }

  _resolveEmail(obj) {
    return (
      obj.customer_details?.email ||
      obj.customer_email ||
      obj.receipt_email ||
      ""
    ).toLowerCase().trim();
  }

  _resolvePlan(priceId) {
    return this.priceToPlan[priceId] || null;
  }

  _getUserByEmail(email) {
    if (!email) return null;
    return this.db.prepare("SELECT id, email, status FROM users WHERE LOWER(email) = ?").get(email.toLowerCase());
  }

  _getUserByStripeCustomer(customerId) {
    if (!customerId) return null;
    return this.db.prepare("SELECT id, email, status FROM users WHERE stripe_customer_id = ?").get(customerId);
  }

  _updateStripeIds(userId, customerId, subscriptionId) {
    const sets = [];
    const params = [];
    if (customerId) { sets.push("stripe_customer_id = ?"); params.push(customerId); }
    if (subscriptionId) { sets.push("stripe_subscription_id = ?"); params.push(subscriptionId); }
    if (sets.length === 0) return;
    params.push(userId);
    this.db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }

  // ── Main dispatch ───────────────────────────────────────────────────────────

  async handleEvent(event, stripe) {
    const eventId = event.id;
    const eventType = event.type;

    if (this._isAlreadyProcessed(eventId)) {
      console.log(`[stripe-handler] Skipping duplicate event: ${eventId} (${eventType})`);
      return { ok: true, skipped: true, reason: "already_processed" };
    }

    const handlers = {
      "checkout.session.completed": (e) => this._handleCheckoutCompleted(e, stripe),
      "customer.subscription.created": (e) => this._handleSubscriptionCreated(e),
      "customer.subscription.updated": (e) => this._handleSubscriptionUpdated(e),
      "customer.subscription.deleted": (e) => this._handleSubscriptionDeleted(e),
      "invoice.paid": (e) => this._handleInvoicePaid(e),
      "invoice.payment_failed": (e) => this._handleInvoicePaymentFailed(e),
      "charge.refunded": (e) => this._handleChargeRefunded(e),
    };

    const handler = handlers[eventType];
    if (!handler) {
      this._recordEvent(eventId, eventType, {}, "ignored", "Unhandled event type");
      return { ok: true, ignored: true };
    }

    try {
      const result = await handler(event);
      this._recordEvent(eventId, eventType, result._details || {}, "success");
      return { ok: true, ...result };
    } catch (e) {
      const details = { email: "", customerId: "" };
      try { details.email = this._resolveEmail(event.data.object); } catch {}
      try { details.customerId = event.data.object.customer; } catch {}
      this._recordEvent(eventId, eventType, details, "error", e.message);
      console.error(`[stripe-handler] Error processing ${eventType}:`, e.message);
      return { ok: false, error: e.message };
    }
  }

  // ── checkout.session.completed ──────────────────────────────────────────────

  async _handleCheckoutCompleted(event, stripe) {
    const session = event.data.object;
    const email = this._resolveEmail(session);
    const customerId = session.customer || null;
    const subscriptionId = session.subscription || null;
    const paymentIntentId = session.payment_intent || null;
    const mode = session.mode; // "payment" or "subscription"

    // Retrieve line items to get price ID
    let priceId = "";
    if (stripe) {
      try {
        const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ["line_items"] });
        priceId = full.line_items?.data?.[0]?.price?.id || "";
      } catch (e) {
        console.error("[stripe-handler] retrieve line_items error:", e.message);
      }
    }

    const plan = this._resolvePlan(priceId);
    if (!plan) {
      throw new Error(`Unknown price_id: ${priceId} — cannot resolve plan, aborting checkout`);
    }

    // Find or identify the user
    let user = this._getUserByEmail(email);
    const userId = user?.id || parseInt(session.client_reference_id) || null;

    if (userId) {
      // Store Stripe IDs on user record
      this._updateStripeIds(userId, customerId, subscriptionId);

      // Ensure subscription exists
      this.engine.ensureSubscription(userId, email);

      if (plan === "PAY_PER_VIEW") {
        // Single payment — keep plan as PAY_PER_VIEW, status ACTIVE
        this.engine.updateSubscription(userId, "PAY_PER_VIEW", "ACTIVE", "stripe_checkout", {
          stripe_event: event.id,
          payment_intent: paymentIntentId,
        });
      } else if (plan) {
        // Subscription (ESSENTIAL or ELITE)
        const endDate = new Date(Date.now() + 32 * 86400000).toISOString();
        this.engine.updateSubscription(userId, plan, "ACTIVE", "stripe_checkout", {
          stripe_event: event.id,
          subscription_id: subscriptionId,
        });
        // Set end date
        this.db.prepare(
          "UPDATE subscriptions SET subscription_end_date = ?, stripe_subscription_id = ?, stripe_price_id = ? WHERE user_id = ?"
        ).run(endDate, subscriptionId, priceId, userId);
      }
    }

    return {
      action: "checkout_completed",
      plan,
      mode,
      email,
      _details: {
        customerId,
        subscriptionId,
        paymentIntentId,
        email,
        userId,
        rawData: JSON.stringify({ mode, plan, priceId }),
      },
    };
  }

  // ── customer.subscription.created ───────────────────────────────────────────

  _handleSubscriptionCreated(event) {
    const sub = event.data.object;
    const customerId = sub.customer;
    const subscriptionId = sub.id;
    const priceId = sub.items?.data?.[0]?.price?.id || "";
    const plan = this._resolvePlan(priceId);
    const status = this._mapStripeStatus(sub.status);

    const user = this._getUserByStripeCustomer(customerId);
    if (user && plan) {
      this.engine.ensureSubscription(user.id, user.email);
      this.engine.updateSubscription(user.id, plan, status, "stripe_subscription_created", {
        stripe_event: event.id,
      });
      this.db.prepare(
        "UPDATE subscriptions SET stripe_subscription_id = ?, stripe_price_id = ? WHERE user_id = ?"
      ).run(subscriptionId, priceId, user.id);
    }

    return {
      action: "subscription_created",
      plan,
      status,
      _details: {
        customerId,
        subscriptionId,
        email: user?.email,
        userId: user?.id,
      },
    };
  }

  // ── customer.subscription.updated ───────────────────────────────────────────

  _handleSubscriptionUpdated(event) {
    const sub = event.data.object;
    const customerId = sub.customer;
    const subscriptionId = sub.id;
    const priceId = sub.items?.data?.[0]?.price?.id || "";
    const plan = this._resolvePlan(priceId);
    const status = this._mapStripeStatus(sub.status);

    const user = this._getUserByStripeCustomer(customerId);
    if (user && plan) {
      this.engine.ensureSubscription(user.id, user.email);
      this.engine.updateSubscription(user.id, plan, status, "stripe_subscription_updated", {
        stripe_event: event.id,
        stripe_status: sub.status,
      });

      // Update end date from current_period_end
      if (sub.current_period_end) {
        const endDate = new Date(sub.current_period_end * 1000).toISOString();
        this.db.prepare(
          "UPDATE subscriptions SET subscription_end_date = ? WHERE user_id = ?"
        ).run(endDate, user.id);
      }
    }

    return {
      action: "subscription_updated",
      plan,
      status,
      _details: {
        customerId,
        subscriptionId,
        email: user?.email,
        userId: user?.id,
      },
    };
  }

  // ── customer.subscription.deleted ───────────────────────────────────────────

  _handleSubscriptionDeleted(event) {
    const sub = event.data.object;
    const customerId = sub.customer;
    const subscriptionId = sub.id;

    const user = this._getUserByStripeCustomer(customerId);
    if (user) {
      this.engine.ensureSubscription(user.id, user.email);
      const current = this.engine.getSubscriptionStatus(user.id);
      this.engine.updateSubscription(
        user.id,
        current?.plan || "VISITOR",
        "CANCELLED",
        "stripe_subscription_deleted",
        { stripe_event: event.id }
      );
    }

    return {
      action: "subscription_deleted",
      _details: {
        customerId,
        subscriptionId,
        email: user?.email,
        userId: user?.id,
      },
    };
  }

  // ── invoice.paid ────────────────────────────────────────────────────────────

  _handleInvoicePaid(event) {
    const invoice = event.data.object;
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
    const paymentIntentId = invoice.payment_intent;

    const user = this._getUserByStripeCustomer(customerId);
    if (user && subscriptionId) {
      this.engine.ensureSubscription(user.id, user.email);
      const current = this.engine.getSubscriptionStatus(user.id);
      if (current) {
        // Reactivate if it was suspended/pending
        if (current.status !== "ACTIVE") {
          this.engine.updateSubscription(user.id, current.plan, "ACTIVE", "stripe_invoice_paid", {
            stripe_event: event.id,
          });
        }
        // Extend end date from period_end
        if (invoice.lines?.data?.[0]?.period?.end) {
          const endDate = new Date(invoice.lines.data[0].period.end * 1000).toISOString();
          this.db.prepare(
            "UPDATE subscriptions SET subscription_end_date = ? WHERE user_id = ?"
          ).run(endDate, user.id);
        }
      }
    }

    return {
      action: "invoice_paid",
      _details: {
        customerId,
        subscriptionId,
        paymentIntentId,
        email: user?.email,
        userId: user?.id,
      },
    };
  }

  // ── invoice.payment_failed ──────────────────────────────────────────────────

  _handleInvoicePaymentFailed(event) {
    const invoice = event.data.object;
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;

    const user = this._getUserByStripeCustomer(customerId);
    if (user && subscriptionId) {
      this.engine.ensureSubscription(user.id, user.email);
      const current = this.engine.getSubscriptionStatus(user.id);
      if (current) {
        this.engine.updateSubscription(
          user.id,
          current.plan,
          "PENDING_PAYMENT",
          "stripe_payment_failed",
          { stripe_event: event.id, attempt: invoice.attempt_count }
        );
      }
    }

    return {
      action: "payment_failed",
      _details: {
        customerId,
        subscriptionId,
        email: user?.email,
        userId: user?.id,
      },
    };
  }

  // ── charge.refunded ─────────────────────────────────────────────────────────

  _handleChargeRefunded(event) {
    const charge = event.data.object;
    const customerId = charge.customer;
    const paymentIntentId = charge.payment_intent;

    const user = this._getUserByStripeCustomer(customerId);
    if (user) {
      this.engine.ensureSubscription(user.id, user.email);
      const current = this.engine.getSubscriptionStatus(user.id);
      if (current) {
        this.engine.updateSubscription(
          user.id,
          current.plan,
          "REFUNDED",
          "stripe_charge_refunded",
          { stripe_event: event.id, payment_intent: paymentIntentId }
        );
      }
    }

    return {
      action: "charge_refunded",
      _details: {
        customerId,
        paymentIntentId,
        email: user?.email,
        userId: user?.id,
      },
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _mapStripeStatus(stripeStatus) {
    const map = {
      active: "ACTIVE",
      past_due: "PENDING_PAYMENT",
      canceled: "CANCELLED",
      unpaid: "SUSPENDED",
      incomplete: "PENDING_PAYMENT",
      incomplete_expired: "EXPIRED",
      trialing: "ACTIVE",
      paused: "SUSPENDED",
    };
    return map[stripeStatus] || "ACTIVE";
  }

  getEventHistory(limit = 50, offset = 0) {
    const events = this.db.prepare(`
      SELECT * FROM stripe_events ORDER BY processed_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
    const total = this.db.prepare("SELECT COUNT(*) as count FROM stripe_events").get();
    return { events, total: total?.count || 0, limit, offset };
  }

  getEventByStripeId(stripeEventId) {
    return this.db.prepare(
      "SELECT * FROM stripe_events WHERE stripe_event_id = ?"
    ).get(stripeEventId);
  }
}

module.exports = StripeHandler;
