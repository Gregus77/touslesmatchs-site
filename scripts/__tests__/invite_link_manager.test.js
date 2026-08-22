const test = require("node:test");
const assert = require("node:assert/strict");
const InviteLinkManager = require("../invite_link_manager");

function makeMockManager(responses = []) {
  const manager = new InviteLinkManager({ botToken: "TEST_TOKEN", defaultExpireSeconds: 3600 });
  const calls = [];
  let callIndex = 0;
  manager._callTelegram = async (method, params) => {
    calls.push({ method, params });
    const response = responses[callIndex] || {
      ok: true,
      result: {
        invite_link: `https://t.me/+link_${callIndex}`,
        expire_date: Math.floor(Date.now() / 1000) + 3600,
      },
    };
    callIndex += 1;
    return response;
  };
  return { manager, calls };
}

test("memberLimit=1 always creates a fresh link", async () => {
  const { manager, calls } = makeMockManager([
    { ok: true, result: { invite_link: "https://t.me/+linkA", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
    { ok: true, result: { invite_link: "https://t.me/+linkB", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
  ]);
  const first = await manager.createInviteLink("-100123", { memberLimit: 1 });
  const second = await manager.createInviteLink("-100123", { memberLimit: 1 });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.inviteLink, "https://t.me/+linkA");
  assert.equal(second.inviteLink, "https://t.me/+linkB");
  assert.notEqual(first.inviteLink, second.inviteLink);
  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, false);
  assert.equal(calls.length, 2);
});

test("two users with memberLimit=1 receive different links", async () => {
  const { manager } = makeMockManager([
    { ok: true, result: { invite_link: "https://t.me/+userA", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
    { ok: true, result: { invite_link: "https://t.me/+userB", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
  ]);
  const first = await manager.createInviteLink("-100123", { memberLimit: 1, name: "UserA" });
  const second = await manager.createInviteLink("-100123", { memberLimit: 1, name: "UserB" });
  assert.equal(first.inviteLink, "https://t.me/+userA");
  assert.equal(second.inviteLink, "https://t.me/+userB");
  assert.notEqual(first.inviteLink, second.inviteLink);
});

test("100 single-use invitations are all distinct", async () => {
  const { manager, calls } = makeMockManager(Array.from({ length: 100 }, (_, index) => ({
    ok: true,
    result: { invite_link: `https://t.me/+unique_${index}`, expire_date: Math.floor(Date.now() / 1000) + 3600 },
  })));
  const results = await Promise.all(Array.from({ length: 100 }, (_, index) =>
    manager.createInviteLink("-100123", { memberLimit: 1, name: `User${index}` })
  ));
  assert.equal(results.every((result) => result.ok && result.fromCache === false), true);
  assert.equal(new Set(results.map((result) => result.inviteLink)).size, 100);
  assert.equal(calls.length, 100);
});

test("memberLimit>1 caches a reusable link", async () => {
  const { manager, calls } = makeMockManager([
    { ok: true, result: { invite_link: "https://t.me/+shared50", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
  ]);
  const first = await manager.createInviteLink("-100123", { memberLimit: 50 });
  const second = await manager.createInviteLink("-100123", { memberLimit: 50 });
  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.equal(first.inviteLink, second.inviteLink);
  assert.equal(calls.length, 1);
});

test("concurrent reusable invitations coalesce to one API call", async () => {
  const { manager, calls } = makeMockManager([
    { ok: true, result: { invite_link: "https://t.me/+bulk", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
  ]);
  const results = await Promise.all(Array.from({ length: 100 }, () =>
    manager.createInviteLink("-100123", { memberLimit: 50 })
  ));
  assert.equal(results.every((result) => result.ok), true);
  assert.equal(new Set(results.map((result) => result.inviteLink)).size, 1);
  assert.equal(calls.length, 1);
});

test("an expiring reusable link is not reused", async () => {
  const { manager, calls } = makeMockManager([
    { ok: true, result: { invite_link: "https://t.me/+expiring", expire_date: Math.floor(Date.now() / 1000) + 100 } },
    { ok: true, result: { invite_link: "https://t.me/+fresh", expire_date: Math.floor(Date.now() / 1000) + 7200 } },
  ]);
  const first = await manager.createInviteLink("-100123", { memberLimit: 50 });
  const second = await manager.createInviteLink("-100123", { memberLimit: 50 });
  assert.equal(first.inviteLink, "https://t.me/+expiring");
  assert.equal(second.inviteLink, "https://t.me/+fresh");
  assert.equal(second.fromCache, false);
  assert.equal(calls.length, 2);
});

test("different chat IDs use separate caches", async () => {
  const { manager, calls } = makeMockManager([
    { ok: true, result: { invite_link: "https://t.me/+groupA", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
    { ok: true, result: { invite_link: "https://t.me/+groupB", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
  ]);
  const first = await manager.createInviteLink("-100AAA", { memberLimit: 50 });
  const second = await manager.createInviteLink("-100BBB", { memberLimit: 50 });
  assert.notEqual(first.inviteLink, second.inviteLink);
  assert.equal(calls.length, 2);
});

test("invalid parameters and API errors are returned without caching failures", async () => {
  const missingToken = new InviteLinkManager({ botToken: "" });
  const missingChat = new InviteLinkManager({ botToken: "TOKEN" });
  assert.match((await missingToken.createInviteLink("-100123", { memberLimit: 1 })).error, /missing/);
  assert.equal((await missingChat.createInviteLink("", { memberLimit: 1 })).ok, false);

  const { manager, calls } = makeMockManager([
    { ok: false, description: "Bad Request: not enough rights" },
    { ok: true, result: { invite_link: "https://t.me/+retry", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
  ]);
  const failed = await manager.createInviteLink("-100123", { memberLimit: 50 });
  const retried = await manager.createInviteLink("-100123", { memberLimit: 50 });
  assert.match(failed.error, /not enough rights/);
  assert.equal(retried.ok, true);
  assert.equal(calls.length, 2);
});

test("clearCache clears one chat or all chats", async () => {
  const { manager, calls } = makeMockManager([
    { ok: true, result: { invite_link: "https://t.me/+a", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
    { ok: true, result: { invite_link: "https://t.me/+b", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
    { ok: true, result: { invite_link: "https://t.me/+c", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
    { ok: true, result: { invite_link: "https://t.me/+d", expire_date: Math.floor(Date.now() / 1000) + 3600 } },
  ]);
  await manager.createInviteLink("-100A", { memberLimit: 50 });
  manager.clearCache("-100A");
  await manager.createInviteLink("-100A", { memberLimit: 50 });
  await manager.createInviteLink("-100B", { memberLimit: 50 });
  manager.clearCache();
  await manager.createInviteLink("-100B", { memberLimit: 50 });
  assert.equal(calls.length, 4);
});

test("revokeInviteLink calls the Telegram endpoint", async () => {
  const { manager, calls } = makeMockManager([{ ok: true, result: {} }]);
  const result = await manager.revokeInviteLink("-100123", "https://t.me/+old");
  assert.equal(result.ok, true);
  assert.equal(calls[0].method, "revokeChatInviteLink");
  assert.equal(calls[0].params.invite_link, "https://t.me/+old");
});
