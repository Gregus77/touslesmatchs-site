// TousLesMatchs — Event Bus
// Central event infrastructure. All inter-service communication goes through here.
// Designed with a provider-agnostic interface so the in-process implementation
// can be swapped for RabbitMQ, Redis Streams, or Kafka without changing callers.

const EVENT_TYPES = {
  USER_CREATED: "USER_CREATED",
  SUBSCRIPTION_CREATED: "SUBSCRIPTION_CREATED",
  SUBSCRIPTION_UPDATED: "SUBSCRIPTION_UPDATED",
  SUBSCRIPTION_CANCELLED: "SUBSCRIPTION_CANCELLED",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  PAYMENT_SUCCEEDED: "PAYMENT_SUCCEEDED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_REFUNDED: "PAYMENT_REFUNDED",
  ANALYSIS_PURCHASED: "ANALYSIS_PURCHASED",
};

// ── Provider interface ───────────────────────────────────────────────────────
// Every provider must implement: publish(channel, envelope), subscribe(channel, handler),
// unsubscribe(channel, handler), close().
// The default InProcessProvider runs handlers synchronously in the same process.
// Replace it with a RabbitMQ/Redis/Kafka provider by calling EventBus.setProvider().

class InProcessProvider {
  constructor() {
    this._channels = {};
  }

  subscribe(channel, handler) {
    if (!this._channels[channel]) this._channels[channel] = [];
    this._channels[channel].push(handler);
  }

  unsubscribe(channel, handler) {
    if (!this._channels[channel]) return false;
    const idx = this._channels[channel].indexOf(handler);
    if (idx === -1) return false;
    this._channels[channel].splice(idx, 1);
    return true;
  }

  async publish(channel, envelope) {
    const handlers = this._channels[channel] || [];
    const results = [];
    for (const handler of handlers) {
      try {
        await handler(envelope);
        results.push({ handler: handler.name || "(anonymous)", ok: true });
      } catch (e) {
        results.push({ handler: handler.name || "(anonymous)", ok: false, error: e.message });
      }
    }
    return results;
  }

  close() {
    this._channels = {};
  }
}

// ── Event Bus ────────────────────────────────────────────────────────────────

class EventBus {
  constructor(opts = {}) {
    this._provider = opts.provider || new InProcessProvider();
    this._store = opts.store || null; // EventStore for persistence
    this._strictTypes = opts.strictTypes !== false; // reject unknown event types by default
  }

  setProvider(provider) {
    this._provider = provider;
  }

  setStore(store) {
    this._store = store;
  }

  async publish(type, payload = {}, meta = {}) {
    if (this._strictTypes && !EVENT_TYPES[type]) {
      throw new Error(`Unknown event type: ${type}`);
    }

    const envelope = {
      id: meta.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: new Date().toISOString(),
      source: meta.source || "unknown",
      userId: meta.userId || payload.userId || null,
      payload,
    };

    const results = await this._provider.publish(type, envelope);

    if (this._store) {
      const overallOk = results.every((r) => r.ok);
      const errorMsg = results.filter((r) => !r.ok).map((r) => `${r.handler}: ${r.error}`).join("; ");
      this._store.record(envelope, overallOk ? "delivered" : "partial_failure", errorMsg || null, results.length);
    }

    return { id: envelope.id, type, delivered: results.length, results };
  }

  subscribe(type, handler) {
    if (this._strictTypes && !EVENT_TYPES[type]) {
      throw new Error(`Unknown event type: ${type}`);
    }
    this._provider.subscribe(type, handler);
  }

  unsubscribe(type, handler) {
    return this._provider.unsubscribe(type, handler);
  }

  close() {
    this._provider.close();
    if (this._store) this._store.close();
  }
}

// ── Event Store (SQLite persistence) ─────────────────────────────────────────

class EventStore {
  constructor(db) {
    this.db = db;
    this._migrate();
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bus_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        source TEXT,
        user_id INTEGER,
        payload TEXT,
        result TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        subscriber_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_bus_events_type ON bus_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_bus_events_user ON bus_events(user_id);
    `);
    this._insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO bus_events (event_id, event_type, source, user_id, payload, result, error, subscriber_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this._queryStmt = this.db.prepare(`
      SELECT * FROM bus_events ORDER BY created_at DESC LIMIT ? OFFSET ?
    `);
    this._queryByTypeStmt = this.db.prepare(`
      SELECT * FROM bus_events WHERE event_type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `);
    this._countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM bus_events`);
    this._countByTypeStmt = this.db.prepare(`SELECT COUNT(*) as total FROM bus_events WHERE event_type = ?`);
  }

  record(envelope, result, error, subscriberCount) {
    this._insertStmt.run(
      envelope.id,
      envelope.type,
      envelope.source,
      envelope.userId,
      JSON.stringify(envelope.payload),
      result,
      error,
      subscriberCount
    );
  }

  query(limit = 50, offset = 0) {
    const events = this._queryStmt.all(Math.max(1, limit), Math.max(0, offset));
    const total = this._countStmt.get().total;
    return { events, total };
  }

  queryByType(type, limit = 50, offset = 0) {
    const events = this._queryByTypeStmt.all(type, Math.max(1, limit), Math.max(0, offset));
    const total = this._countByTypeStmt.get(type).total;
    return { events, total };
  }

  close() {
    // db lifecycle managed by caller
  }
}

module.exports = { EventBus, EventStore, InProcessProvider, EVENT_TYPES };
