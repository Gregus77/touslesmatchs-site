// Mission 002: Subscription Engine
// Pure service for subscription status and access rights
// NO Stripe, Brevo, or Telegram logic here

const Database = require("better-sqlite3");

class SubscriptionEngine {
  constructor(dbPath = process.env.DB_PATH || "/data/tlm.db") {
    this.db = new Database(dbPath);
  }

  /**
   * Get or create subscription for a user
   */
  ensureSubscription(userId, email) {
    try {
      let sub = this.db.prepare(
        "SELECT * FROM subscriptions WHERE user_id = ?"
      ).get(userId);

      if (!sub) {
        this.db.prepare(`
          INSERT INTO subscriptions (user_id, plan, subscription_status, created_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `).run(userId, "VISITOR", "ACTIVE");

        sub = this.db.prepare(
          "SELECT * FROM subscriptions WHERE user_id = ?"
        ).get(userId);

        // Log creation
        this.logSubscriptionChange(
          userId,
          null,
          "VISITOR",
          null,
          "ACTIVE",
          "create",
          "Subscription auto-created",
          "system"
        );
      }

      return sub;
    } catch (e) {
      console.error("[SubscriptionEngine] ensureSubscription error:", e.message);
      throw e;
    }
  }

  /**
   * Get full subscription status for a user
   */
  getSubscriptionStatus(userId) {
    try {
      const sub = this.db.prepare(
        "SELECT * FROM subscriptions WHERE user_id = ?"
      ).get(userId);

      if (!sub) return null;

      // Get purchase count
      const purchases = this.db.prepare(
        "SELECT COUNT(*) as count FROM analysis_purchases WHERE user_id = ? AND status = ?"
      ).get(userId, "completed");

      // Get remaining analyses for the day (ESSENTIAL/ELITE)
      let analysesToday = 0;
      if (sub.plan === "ESSENTIAL" || sub.plan === "ELITE") {
        const daily = this.db.prepare(`
          SELECT COUNT(*) as count FROM revealed_analyses
          WHERE user_id = ? AND DATE(revealed_at) = DATE('now')
        `).get(userId);
        analysesToday = daily?.count || 0;
      }

      // Check expiration
      let isExpired = false;
      if (sub.subscription_end_date) {
        const now = new Date();
        const endDate = new Date(sub.subscription_end_date);
        isExpired = now > endDate;
        if (isExpired && sub.subscription_status === "ACTIVE") {
          // Auto-expire subscription
          this.updateSubscriptionStatus(userId, sub.plan, "EXPIRED", "expiry", "Auto-expired subscription");
        }
      }

      // Get daily limit
      let dailyLimit = 0;
      if (sub.plan === "ESSENTIAL") dailyLimit = 10;
      else if (sub.plan === "ELITE") dailyLimit = 30;

      return {
        id: sub.id,
        user_id: sub.user_id,
        plan: sub.plan,
        status: sub.subscription_status,
        startDate: sub.subscription_start_date,
        endDate: sub.subscription_end_date,
        autoRenew: sub.auto_renew,
        telegramGroupId: sub.telegram_group_id,
        telegramGroupName: sub.telegram_group_name,
        purchaseCount: purchases?.count || 0,
        analysesToday: analysesToday,
        dailyLimit: dailyLimit,
        isExpired: isExpired,
        isActive: sub.subscription_status === "ACTIVE" && !isExpired,
      };
    } catch (e) {
      console.error("[SubscriptionEngine] getSubscriptionStatus error:", e.message);
      throw e;
    }
  }

  /**
   * Update subscription plan and/or status
   */
  updateSubscription(userId, newPlan, newStatus, reason = "manual", details = {}) {
    try {
      const current = this.db.prepare(
        "SELECT * FROM subscriptions WHERE user_id = ?"
      ).get(userId);

      if (!current) {
        throw new Error(`User ${userId} has no subscription`);
      }

      const updateFields = [];
      if (newPlan && newPlan !== current.plan) {
        updateFields.push(`plan = '${newPlan}'`);
      }
      if (newStatus && newStatus !== current.subscription_status) {
        updateFields.push(`subscription_status = '${newStatus}'`);
      }
      updateFields.push(`updated_at = datetime('now')`);

      if (updateFields.length > 1) { // Only if something changed
        this.db.prepare(`
          UPDATE subscriptions SET ${updateFields.join(", ")} WHERE user_id = ?
        `).run(userId);

        // Log the change
        this.logSubscriptionChange(
          userId,
          current.plan,
          newPlan,
          current.subscription_status,
          newStatus,
          reason,
          JSON.stringify(details),
          "system"
        );
      }

      return this.getSubscriptionStatus(userId);
    } catch (e) {
      console.error("[SubscriptionEngine] updateSubscription error:", e.message);
      throw e;
    }
  }

  /**
   * Update subscription status only
   */
  updateSubscriptionStatus(userId, currentPlan, newStatus, reason = "manual", details = "") {
    try {
      this.db.prepare(`
        UPDATE subscriptions
        SET subscription_status = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(newStatus, userId);

      this.logSubscriptionChange(
        userId,
        null,
        null,
        currentPlan,
        newStatus,
        reason,
        details,
        "system"
      );

      return this.getSubscriptionStatus(userId);
    } catch (e) {
      console.error("[SubscriptionEngine] updateSubscriptionStatus error:", e.message);
      throw e;
    }
  }

  /**
   * Record an analysis purchase
   */
  recordAnalysisPurchase(userId, analysisId, matchKey, stripePaymentId, amount = 100) {
    try {
      const result = this.db.prepare(`
        INSERT INTO analysis_purchases
        (user_id, analysis_id, match_key, purchase_date, stripe_payment_id, amount, currency, status)
        VALUES (?, ?, ?, datetime('now'), ?, ?, 'EUR', 'completed')
      `).run(userId, analysisId, matchKey, stripePaymentId, amount);

      return {
        id: result.lastInsertRowid,
        userId,
        analysisId,
        matchKey,
        stripePaymentId,
        amount,
        status: "completed",
      };
    } catch (e) {
      console.error("[SubscriptionEngine] recordAnalysisPurchase error:", e.message);
      throw e;
    }
  }

  /**
   * Check if user has access to specific analysis (PAY_PER_VIEW or subscription)
   */
  hasAccessToAnalysis(userId, analysisId, plan) {
    try {
      if (plan === "ELITE" || plan === "ESSENTIAL") {
        return true; // Full subscription access
      }

      if (plan === "PAY_PER_VIEW") {
        const purchase = this.db.prepare(`
          SELECT COUNT(*) as count FROM analysis_purchases
          WHERE user_id = ? AND analysis_id = ? AND status = 'completed'
        `).get(userId, analysisId);
        return purchase?.count > 0;
      }

      return false; // VISITOR has no access
    } catch (e) {
      console.error("[SubscriptionEngine] hasAccessToAnalysis error:", e.message);
      throw e;
    }
  }

  /**
   * Get analysis purchase history
   */
  getAnalysisPurchases(userId, limit = 50, offset = 0) {
    try {
      const purchases = this.db.prepare(`
        SELECT * FROM analysis_purchases
        WHERE user_id = ?
        ORDER BY purchase_date DESC
        LIMIT ? OFFSET ?
      `).all(userId, limit, offset);

      const total = this.db.prepare(
        "SELECT COUNT(*) as count FROM analysis_purchases WHERE user_id = ?"
      ).get(userId);

      return {
        purchases,
        total: total?.count || 0,
        limit,
        offset,
      };
    } catch (e) {
      console.error("[SubscriptionEngine] getAnalysisPurchases error:", e.message);
      throw e;
    }
  }

  /**
   * Get subscription history
   */
  getSubscriptionHistory(userId, limit = 50, offset = 0) {
    try {
      const history = this.db.prepare(`
        SELECT * FROM subscription_history
        WHERE user_id = ?
        ORDER BY triggered_at DESC
        LIMIT ? OFFSET ?
      `).all(userId, limit, offset);

      const total = this.db.prepare(
        "SELECT COUNT(*) as count FROM subscription_history WHERE user_id = ?"
      ).get(userId);

      return {
        history,
        total: total?.count || 0,
        limit,
        offset,
      };
    } catch (e) {
      console.error("[SubscriptionEngine] getSubscriptionHistory error:", e.message);
      throw e;
    }
  }

  /**
   * Internal: Log subscription change
   */
  logSubscriptionChange(userId, oldPlan, newPlan, oldStatus, newStatus, reason, details, triggeredBy) {
    try {
      this.db.prepare(`
        INSERT INTO subscription_history
        (user_id, old_plan, new_plan, old_status, new_status, reason, details, triggered_by, triggered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(userId, oldPlan, newPlan, oldStatus, newStatus, reason, details, triggeredBy);
    } catch (e) {
      console.error("[SubscriptionEngine] logSubscriptionChange error:", e.message);
    }
  }

  /**
   * Get user email for subscription lookup
   */
  getUserIdByEmail(email) {
    try {
      const user = this.db.prepare(
        "SELECT id FROM users WHERE email = ?"
      ).get(email);
      return user?.id || null;
    } catch (e) {
      console.error("[SubscriptionEngine] getUserIdByEmail error:", e.message);
      throw e;
    }
  }

  /**
   * Get full subscription info by email
   */
  getByEmail(email) {
    try {
      const userId = this.getUserIdByEmail(email);
      if (!userId) return null;

      this.ensureSubscription(userId, email);
      return this.getSubscriptionStatus(userId);
    } catch (e) {
      console.error("[SubscriptionEngine] getByEmail error:", e.message);
      throw e;
    }
  }

  /**
   * Close database connection
   */
  close() {
    try {
      this.db.close();
    } catch (e) {
      console.error("[SubscriptionEngine] close error:", e.message);
    }
  }
}

module.exports = SubscriptionEngine;
