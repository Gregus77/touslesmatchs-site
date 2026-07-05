const https = require("https");

class InviteLinkManager {
  constructor({ botToken, defaultExpireSeconds = 86400 }) {
    this._botToken = botToken;
    this._defaultExpireSeconds = defaultExpireSeconds;
    this._cache = new Map();
    this._pending = new Map();
  }

  async createInviteLink(chatId, { memberLimit = 1, expireSeconds, name } = {}) {
    if (!this._botToken || !chatId) {
      return { ok: false, error: "missing botToken or chatId" };
    }

    const expire = expireSeconds || this._defaultExpireSeconds;

    if (memberLimit > 1) {
      const cached = this._getFromCache(chatId, memberLimit);
      if (cached) return { ok: true, inviteLink: cached.invite_link, fromCache: true };

      const pendingKey = `${chatId}:${memberLimit}`;
      const existing = this._pending.get(pendingKey);
      if (existing) {
        const result = await existing;
        return { ok: result.ok, inviteLink: result.inviteLink, fromCache: true, error: result.error };
      }

      const promise = this._fetchAndCache(chatId, memberLimit, expire, name);
      this._pending.set(pendingKey, promise);
      try {
        return await promise;
      } finally {
        this._pending.delete(pendingKey);
      }
    }

    return this._fetchAndCache(chatId, memberLimit, expire, name);
  }

  async _fetchAndCache(chatId, memberLimit, expire, name) {
    const result = await this._callTelegram("createChatInviteLink", {
      chat_id: chatId,
      member_limit: memberLimit,
      expire_date: Math.floor(Date.now() / 1000) + expire,
      ...(name ? { name } : {}),
    });

    if (!result.ok) {
      return { ok: false, error: result.description || "Telegram API error" };
    }

    const linkData = result.result;

    if (memberLimit > 1) {
      this._setCache(chatId, memberLimit, linkData);
    }

    return { ok: true, inviteLink: linkData.invite_link, fromCache: false };
  }

  async revokeInviteLink(chatId, inviteLink) {
    if (!this._botToken || !chatId || !inviteLink) {
      return { ok: false, error: "missing params" };
    }

    const result = await this._callTelegram("revokeChatInviteLink", {
      chat_id: chatId,
      invite_link: inviteLink,
    });

    return { ok: result.ok, error: result.description };
  }

  clearCache(chatId) {
    if (chatId) {
      for (const key of this._cache.keys()) {
        if (key.startsWith(`${chatId}:`)) this._cache.delete(key);
      }
    } else {
      this._cache.clear();
    }
  }

  _getFromCache(chatId, memberLimit) {
    const key = `${chatId}:${memberLimit}`;
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (entry.expire_date && entry.expire_date < Math.floor(Date.now() / 1000) + 300) {
      this._cache.delete(key);
      return null;
    }
    return entry;
  }

  _setCache(chatId, memberLimit, linkData) {
    const key = `${chatId}:${memberLimit}`;
    this._cache.set(key, linkData);
  }

  _callTelegram(method, params) {
    return new Promise((resolve) => {
      const body = JSON.stringify(params);
      const req = https.request({
        hostname: "api.telegram.org",
        path: `/bot${this._botToken}/${method}`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        timeout: 15000,
      }, (res) => {
        let data = "";
        res.on("data", (d) => data += d);
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch { resolve({ ok: false, description: "parse error" }); }
        });
      });
      req.on("error", (e) => resolve({ ok: false, description: e.message }));
      req.on("timeout", () => { req.destroy(); resolve({ ok: false, description: "timeout" }); });
      req.write(body);
      req.end();
    });
  }
}

module.exports = InviteLinkManager;
