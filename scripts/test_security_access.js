// Exercise real helpers/HTTP handlers in isolation: no scheduler, external API or production DB.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const source = fs.readFileSync(require('node:path').join(__dirname, 'api_server.js'), 'utf8');
function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
function environment(options = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = [{ email: 'admin@example.test', code: 'ELITE-ADMIN-REAL', active: 1, plan: 'elite', expires_at: '2099-01-01', credits_max: 0, credits_used: 0, credits_date: today },
    { email: 'paid@example.test', code: 'PAIDCODE', active: 1, plan: 'premium', expires_at: '2099-01-01', credits_max: 10, credits_used: 0, credits_date: today },
    { email: 'free@example.test', code: 'FREECODE', active: 1, plan: 'free', expires_at: '2099-01-01', credits_max: 3, credits_used: 0, credits_date: today },
    { email: 'inactive@example.test', code: 'ELITE-ADMIN-OFF', active: 0, plan: 'elite' },
    { email: 'expired@example.test', code: 'ELITE-ADMIN-OLD', active: 1, plan: 'elite', expires_at: '2000-01-01' }];
  if (options.exhausted) rows[1].credits_used = 10;
  const calls = { engine: 0, match: 0, mutations: 0 };
  class Database {
    prepare(sql) { return {
      get(code, email) { return rows.find(r => r.code === code && r.email === email && r.active === 1); },
      run(...args) {
        const [code, email] = args.slice(-2);
        const row = rows.find(r => r.code === code && r.email === email && r.active === 1);
        assert(row, 'update must be bound to the authenticated account');
        row.credits_used = sql.includes('credits_used + 1') ? row.credits_used + 1 : 1;
        row.credits_date = today;
      }
    }; }
    close() {}
  }
  const routes = new Map();
  const context = vm.createContext({ Database, CODES_DB_PATH: ':test:', console, Map, Date,
    setTimeout() {}, creditsLeftForPlan: (_plan, max, used) => max === 0 ? null : max - used,
    app: { post(path, handler) { routes.set(path, handler); } },
    requireVerifiedLiveMatch: async match => { calls.match++; return options.unknown ? null : { ...match, id: 7, score_home: 0, score_away: 0, minute: 40, status: 'IN_PLAY' }; },
    rejectScoreConflict: (_match, res) => { if (!options.conflict) return false; res.json({ ok: false, error: 'conflict' }); return true; },
    livePickBlockReason: () => options.blocked ? 'blocked' : null,
    isExcludedFromPicks: () => !!options.excluded,
    runConcileAnalysis: async () => { calls.engine++; if (options.failure) throw Error('offline'); return {
      agent_performance: { private: true }, agents: [
        { name: 'private model', model: 'private model', bet: 'Selection', confidence: 88, raison: 'private rationale' },
        { name: 'Chief', isChief: true, bet: 'Selection', confidence: 88, raison: 'Verified reasoning' }
      ] }; }
  });
  vm.runInContext([fn('verifyCode'), fn('isAdmin'), fn('isAdminAccess'), fn('sanitizeAnalysisForClient')].join('\n'), context);
  const canonicalStart = source.indexOf('const analysisCache = new Map();');
  const canonicalEnd = source.indexOf('// ── Pre-match analysis', canonicalStart);
  vm.runInContext(source.slice(canonicalStart, canonicalEnd), context);
  const legacyStart = source.indexOf('const analysisRateLimit = new Map();');
  const legacyEnd = source.indexOf('// ── Live IA — token-gated', legacyStart);
  vm.runInContext(source.slice(legacyStart, legacyEnd), context);
  const mutationStart = source.indexOf('app.post("/admin/resolve-match"');
  const mutationEnd = source.indexOf('\n});', mutationStart) + 4;
  context.autoResolvePredictions = () => { calls.mutations++; };
  vm.runInContext(source.slice(mutationStart, mutationEnd), context);
  async function request(path, body) {
    let payload, status = 200;
    const res = { status(n) { status = n; return this; }, json(value) { payload = value; return this; } };
    await routes.get(path)({ body, headers: {}, socket: { remoteAddress: '127.0.0.1' } }, res);
    return { payload, status };
  }
  return { context, request, rows, calls };
}
test('fabricated, expired, inactive and non-admin codes cannot authorize an admin operation', async () => {
  const e = environment();
  for (const [email, code] of [
    ['attacker@example.test', 'ELITE-ADMIN-X'], ['attacker@example.test', ' elite-admin-x '],
    ['wrong@example.test', 'ELITE-ADMIN-REAL'], ['inactive@example.test', 'ELITE-ADMIN-OFF'],
    ['expired@example.test', 'ELITE-ADMIN-OLD'], ['paid@example.test', 'PAIDCODE'], ['', ''],
    ['admin@example.test', {}], [null, null]
  ]) {
    assert.equal(e.context.isAdminAccess(email, code), false);
    const result = await e.request('/admin/resolve-match', { email, code, home: 'Home', away: 'Away', score_home: 2, score_away: 0 });
    assert.equal(result.status, 403);
  }
  assert.equal(e.calls.mutations, 0);
  assert.equal(e.context.isAdminAccess('admin@example.test', 'ELITE-ADMIN-REAL'), true);
  const result = await e.request('/admin/resolve-match', { email: 'admin@example.test', code: 'ELITE-ADMIN-REAL', home: 'Home', away: 'Away', score_home: 2, score_away: 0 });
  assert.equal(result.payload.ok, true);
  assert.equal(e.calls.mutations, 1);
});
for (const route of ['/analyse', '/concile-analysis']) {
  const body = route === '/analyse' ? { home: 'Home', away: 'Away', match_id: 7 } : { match: { home: 'Home', away: 'Away', id: 7 } };
  test(`${route}: anonymous, invalid, free and exhausted accounts never reach the engine`, async () => {
    for (const [credentials, exhausted] of [ [{}, false], [{email:'x',code:'ELITE-ADMIN-X'}, false],
      [{email:'free@example.test',code:'FREECODE'}, false], [{email:'paid@example.test',code:'PAIDCODE'}, true] ]) {
      const e = environment({exhausted});
      const r = await e.request(route, {...body, ...credentials});
      assert.equal(r.payload.ok, false);
      assert.equal(e.calls.engine, 0);
      assert.equal(e.calls.match, 0);
      assert.equal(e.rows[1].credits_used, exhausted ? 10 : 0);
    }
  });
  test(`${route}: paid analysis works, is sanitized and charges only successful computation`, async () => {
    const e = environment();
    const paid = {...body,email:'paid@example.test',code:'PAIDCODE'};
    const first = await e.request(route, paid);
    assert.equal(first.payload.ok, true);
    assert.equal(first.payload.agent_performance, undefined);
    if (route === '/analyse') {
      assert.equal(first.payload.value_bet.marche, 'Selection');
      assert.equal(first.payload.value_bet.cote_min_conseillée, '1.14');
      for (const key of ['resume', 'over25', 'btts', 'resultat', 'premier_but_mi_temps']) assert.ok(first.payload[key], key);
    }
    else assert.equal(first.payload.agents[0].model, '');
    assert.equal(e.rows[1].credits_used, 1);
    const cached = await e.request(route, paid);
    assert.equal(cached.payload.ok, true);
    assert.equal(e.calls.engine, 1);
    assert.equal(e.rows[1].credits_used, 1);
  });
  test(`${route}: unavailable, excluded, conflicting matches and engine errors do not charge`, async () => {
    for (const options of [{unknown:true},{excluded:true},{conflict:true},{blocked:true},{failure:true}]) {
      const e=environment(options);
      const r=await e.request(route,{...body,email:'paid@example.test',code:'PAIDCODE'});
      assert.equal(r.payload.ok,false);
      assert.equal(e.rows[1].credits_used,0);
      if (!options.failure) assert.equal(e.calls.engine,0);
    }
  });
}
