const InviteLinkManager = require("../invite_link_manager");

function makeMockManager(responses = []) {
  const manager = new InviteLinkManager({ botToken: "TEST_TOKEN", defaultExpireSeconds: 3600 });
  const calls = [];
  let callIndex = 0;

  manager._callTelegram = jest.fn(async (method, params) => {
    calls.push({ method, params });
    const resp = responses[callIndex] || { ok: true, result: { invite_link: `https://t.me/+link_${callIndex}`, expire_date: Math.floor(Date.now() / 1000) + 3600 } };
    callIndex++;
    return resp;
  });

  return { manager, calls };
}

describe("InviteLinkManager", () => {

  describe("memberLimit = 1 (no cache)", () => {

    test("creates a fresh link for each call", async () => {
      const { manager, calls } = makeMockManager([
        { ok: true, result: { invite_link: "https://t.me/+linkA", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
        { ok: true, result: { invite_link: "https://t.me/+linkB", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
      ]);

      const resultA = await manager.createInviteLink("-100123", { memberLimit: 1 });
      const resultB = await manager.createInviteLink("-100123", { memberLimit: 1 });

      expect(resultA.ok).toBe(true);
      expect(resultB.ok).toBe(true);
      expect(resultA.inviteLink).toBe("https://t.me/+linkA");
      expect(resultB.inviteLink).toBe("https://t.me/+linkB");
      expect(resultA.inviteLink).not.toBe(resultB.inviteLink);
      expect(resultA.fromCache).toBe(false);
      expect(resultB.fromCache).toBe(false);
      expect(calls).toHaveLength(2);
    });

    test("User A consumes link, User B gets a different valid link", async () => {
      const { manager } = makeMockManager([
        { ok: true, result: { invite_link: "https://t.me/+userA", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
        { ok: true, result: { invite_link: "https://t.me/+userB", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
      ]);

      const linkA = await manager.createInviteLink("-100123", { memberLimit: 1, name: "UserA" });
      expect(linkA.ok).toBe(true);
      expect(linkA.inviteLink).toBe("https://t.me/+userA");

      const linkB = await manager.createInviteLink("-100123", { memberLimit: 1, name: "UserB" });
      expect(linkB.ok).toBe(true);
      expect(linkB.inviteLink).toBe("https://t.me/+userB");
      expect(linkB.inviteLink).not.toBe(linkA.inviteLink);
    });

    test("100 users with memberLimit=1 produce 100 different links", async () => {
      const responses = Array.from({ length: 100 }, (_, i) => ({
        ok: true,
        result: { invite_link: `https://t.me/+unique_${i}`, expire_date: Math.floor(Date.now() / 1000) + 3600 },
      }));

      const { manager, calls } = makeMockManager(responses);

      const results = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          manager.createInviteLink("-100123", { memberLimit: 1, name: `User${i}` })
        )
      );

      const links = results.map((r) => r.inviteLink);
      const uniqueLinks = new Set(links);

      expect(results.every((r) => r.ok)).toBe(true);
      expect(results.every((r) => r.fromCache === false)).toBe(true);
      expect(uniqueLinks.size).toBe(100);
      expect(calls).toHaveLength(100);
    });
  });

  describe("memberLimit > 1 (cache active)", () => {

    test("memberLimit=50 uses cache on second call", async () => {
      const { manager, calls } = makeMockManager([
        { ok: true, result: { invite_link: "https://t.me/+shared50", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
      ]);

      const r1 = await manager.createInviteLink("-100123", { memberLimit: 50 });
      const r2 = await manager.createInviteLink("-100123", { memberLimit: 50 });

      expect(r1.ok).toBe(true);
      expect(r1.fromCache).toBe(false);
      expect(r2.ok).toBe(true);
      expect(r2.fromCache).toBe(true);
      expect(r1.inviteLink).toBe(r2.inviteLink);
      expect(calls).toHaveLength(1);
    });

    test("memberLimit=50 with 100 requests makes only 1 API call", async () => {
      const { manager, calls } = makeMockManager([
        { ok: true, result: { invite_link: "https://t.me/+bulk", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
      ]);

      const results = await Promise.all(
        Array.from({ length: 100 }, () =>
          manager.createInviteLink("-100123", { memberLimit: 50 })
        )
      );

      expect(results.every((r) => r.ok)).toBe(true);
      expect(results[0].fromCache).toBe(false);
      expect(results.slice(1).every((r) => r.fromCache === true)).toBe(true);
      expect(calls).toHaveLength(1);
    });

    test("cache expires when link is near expiration", async () => {
      const { manager, calls } = makeMockManager([
        { ok: true, result: { invite_link: "https://t.me/+expiring", expire_date: Math.floor(Date.now() / 1000) + 100 } },
        { ok: true, result: { invite_link: "https://t.me/+fresh", expire_date: Math.floor(Date.now() / 1000) + 7200 } },
      ]);

      const r1 = await manager.createInviteLink("-100123", { memberLimit: 50 });
      expect(r1.fromCache).toBe(false);
      expect(r1.inviteLink).toBe("https://t.me/+expiring");

      const r2 = await manager.createInviteLink("-100123", { memberLimit: 50 });
      expect(r2.fromCache).toBe(false);
      expect(r2.inviteLink).toBe("https://t.me/+fresh");
      expect(calls).toHaveLength(2);
    });

    test("different chatIds have separate caches", async () => {
      const { manager, calls } = makeMockManager([
        { ok: true, result: { invite_link: "https://t.me/+groupA", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
        { ok: true, result: { invite_link: "https://t.me/+groupB", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
      ]);

      const r1 = await manager.createInviteLink("-100AAA", { memberLimit: 50 });
      const r2 = await manager.createInviteLink("-100BBB", { memberLimit: 50 });

      expect(r1.inviteLink).not.toBe(r2.inviteLink);
      expect(calls).toHaveLength(2);
    });
  });

  describe("error handling", () => {

    test("returns error when botToken is missing", async () => {
      const manager = new InviteLinkManager({ botToken: "" });
      const result = await manager.createInviteLink("-100123", { memberLimit: 1 });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/missing/);
    });

    test("returns error when chatId is missing", async () => {
      const manager = new InviteLinkManager({ botToken: "TOKEN" });
      const result = await manager.createInviteLink("", { memberLimit: 1 });
      expect(result.ok).toBe(false);
    });

    test("returns error on Telegram API failure", async () => {
      const { manager } = makeMockManager([
        { ok: false, description: "Bad Request: not enough rights" },
      ]);

      const result = await manager.createInviteLink("-100123", { memberLimit: 1 });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/not enough rights/);
    });

    test("does not cache failed responses", async () => {
      const { manager, calls } = makeMockManager([
        { ok: false, description: "error" },
        { ok: true, result: { invite_link: "https://t.me/+retry", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
      ]);

      const r1 = await manager.createInviteLink("-100123", { memberLimit: 50 });
      expect(r1.ok).toBe(false);

      const r2 = await manager.createInviteLink("-100123", { memberLimit: 50 });
      expect(r2.ok).toBe(true);
      expect(calls).toHaveLength(2);
    });
  });

  describe("clearCache", () => {

    test("clearCache removes cached links for a specific chatId", async () => {
      const { manager, calls } = makeMockManager([
        { ok: true, result: { invite_link: "https://t.me/+v1", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
        { ok: true, result: { invite_link: "https://t.me/+v2", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
      ]);

      await manager.createInviteLink("-100123", { memberLimit: 50 });
      manager.clearCache("-100123");
      const r2 = await manager.createInviteLink("-100123", { memberLimit: 50 });

      expect(r2.fromCache).toBe(false);
      expect(calls).toHaveLength(2);
    });

    test("clearCache() without args clears everything", async () => {
      const { manager, calls } = makeMockManager([
        { ok: true, result: { invite_link: "https://t.me/+a", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
        { ok: true, result: { invite_link: "https://t.me/+b", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
        { ok: true, result: { invite_link: "https://t.me/+c", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
        { ok: true, result: { invite_link: "https://t.me/+d", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
      ]);

      await manager.createInviteLink("-100A", { memberLimit: 50 });
      await manager.createInviteLink("-100B", { memberLimit: 50 });
      manager.clearCache();
      await manager.createInviteLink("-100A", { memberLimit: 50 });
      await manager.createInviteLink("-100B", { memberLimit: 50 });

      expect(calls).toHaveLength(4);
    });
  });

  describe("revokeInviteLink", () => {

    test("calls Telegram revokeChatInviteLink", async () => {
      const { manager, calls } = makeMockManager([
        { ok: true, result: {} },
      ]);

      const result = await manager.revokeInviteLink("-100123", "https://t.me/+old");
      expect(result.ok).toBe(true);
      expect(calls[0].method).toBe("revokeChatInviteLink");
      expect(calls[0].params.invite_link).toBe("https://t.me/+old");
    });
  });
});
