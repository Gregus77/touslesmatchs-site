'use strict';

// Native TypeSafe API, schema checked against api.typesafe.ai/openapi.json.
// No retries of POST: the provider does not document billing idempotency.
const crypto = require('node:crypto');
const CHOICES = ['SEND', 'WAIT', 'REANALYZE', 'REJECT'];
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
function finite(value) {
  return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
}
function config(env = process.env) {
  const threshold = finite(env.JEV_MIN_DECISION_CONFIDENCE);
  return {
    enabled: env.JEV_ENABLED === '1', production_mode: env.JEV_PRODUCTION_MODE === '1',
    configured: Boolean(env.TYPESAFE_API_KEY), model: env.JEV_MODEL || '',
    min_confidence: threshold !== null && threshold >= 0 && threshold <= 1 ? threshold : 0.70,
    timeout_ms: Math.min(20000, Math.max(500, finite(env.JEV_TIMEOUT_MS) || 8000)),
    allowed_models: String(env.JEV_ALLOWED_RESPONSE_MODELS || env.JEV_MODEL || '').split(',').filter(Boolean),
  };
}
function init(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS jev_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, match_key TEXT NOT NULL, snapshot_id TEXT NOT NULL,
    fixture_id TEXT, created_at TEXT NOT NULL, model TEXT NOT NULL, returned_model TEXT,
    decision TEXT, confidence REAL, prob_send REAL, prob_wait REAL, prob_reanalyze REAL, prob_reject REAL,
    latency_ms INTEGER, input_tokens INTEGER, output_tokens INTEGER,
    traditional_eligible INTEGER NOT NULL, traditional_decision TEXT NOT NULL,
    traditional_block_reason TEXT, final_decision TEXT NOT NULL, decision_source TEXT NOT NULL,
    error_category TEXT, structural_block_reason TEXT, state_json TEXT NOT NULL, state_key TEXT NOT NULL,
    request_started INTEGER NOT NULL DEFAULT 0, completed_at TEXT, min_confidence REAL NOT NULL,
    UNIQUE(snapshot_id,model)
  );
  CREATE INDEX IF NOT EXISTS idx_jev_match_key ON jev_decisions(match_key);
  CREATE INDEX IF NOT EXISTS idx_jev_snapshot ON jev_decisions(snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_jev_created ON jev_decisions(created_at);
  CREATE INDEX IF NOT EXISTS idx_jev_decision ON jev_decisions(decision);
  CREATE TABLE IF NOT EXISTS jev_reobservations (
    fixture_scope TEXT PRIMARY KEY, started_at INTEGER NOT NULL, polls INTEGER NOT NULL DEFAULT 0,
    analyses INTEGER NOT NULL DEFAULT 0, last_snapshot_id TEXT NOT NULL
  );`);
}

// Explicit allowlist: never forward raw API objects, prompts, customer data or credentials.
function buildState({match, snapshot, stats = {}, standings = {}, recovery = {}, integrity, traditional}) {
  const directions = JSON.parse(snapshot.directions_json || '[]');
  const statuses = JSON.parse(snapshot.seat_statuses_json || '[]');
  const count = direction => directions.filter((d, i) => d === direction && statuses[i] === 'voted').length;
  const realOdd = finite(snapshot.real_odd);
  const isReal = realOdd > 1 && Boolean(snapshot.real_odd_source) && !/estimation|indisponible/i.test(snapshot.real_odd_source);
  const pair = (a, b) => ({home: finite(stats?.[a]), away: finite(stats?.[b])});
  const possession = value => typeof value === 'string' && /^\d+(\.\d+)?%$/.test(value) ? finite(value.slice(0,-1)) : finite(value);
  // Existing legacy stats substitute 0 for missing cards. Jev receives only
  // the original observed fields, so unknown cards remain unknown.
  const cards = (a,b) => ({home:finite(stats?.observed_cards?.[a]),away:finite(stats?.observed_cards?.[b])});
  return {
    match: {home: String(match.home || ''), away: String(match.away || ''),
      competition: String(match.competition || match.league || ''), sport: String(match.sport || ''),
      minute: snapshot.minute, first_half_state: integrity.first_half_open ? '1H' : 'unverified_or_closed',
      score_home: snapshot.score_home, score_away: snapshot.score_away,
      snapshot_created_at: snapshot.created_at},
    council: {seats_available: count('over') + count('under'), over_votes: count('over'), under_votes: count('under'),
      consensus: snapshot.consensus, consensus_votes: snapshot.consensus_votes, confidence: snapshot.confidence},
    market: {selection: snapshot.consensus === 'over' ? 'Over 2.5 FT' : snapshot.consensus === 'under' ? 'Under 2.5 FT' : null,
      real_odd: isReal ? realOdd : null, odd_available: isReal, odd_source: isReal ? snapshot.real_odd_source : null},
    standings: {home_rank: finite(standings.home_rank), away_rank: finite(standings.away_rank),
      ranking_gap: finite(standings.rank_gap), top5_bottom5: standings.top5_bottom5 === true},
    live_stats: {shots: pair('total_shots_home','total_shots_away'), shots_on_target: pair('shots_on_goal_home','shots_on_goal_away'),
      dangerous_attacks: pair('dangerous_attacks_home','dangerous_attacks_away'),
      possession: {home:possession(stats?.possession_home),away:possession(stats?.possession_away)},
      corners: pair('corners_home','corners_away'), yellow_cards: cards('yellow_cards_home','yellow_cards_away'),
      red_cards: cards('red_cards_home','red_cards_away'), xg_if_real: pair('xg_home','xg_away')},
    recovery: {enabled: recovery.enabled === true, indicators_ok: recovery.ok === true,
      indicators: (recovery.indicators || []).map(i => typeof i === 'string' ? i :
        {key: i.key || i.name || null, ok: i.ok === true, value: finite(i.value)})},
    integrity: {real_data: integrity.real_data === true, stats_status: String(integrity.stats_status || 'unavailable'),
      competition_allowed: integrity.competition_allowed === true, snapshot_id: snapshot.id},
    traditional: {eligible: traditional.eligible === true, block_reason: traditional.block_reason || null,
      rules: traditional.rules},
  };
}
function requestBody(model, state) {
  return {model, state, questions: {production_decision: {type: 'choice',
    instructions: 'Decide whether the real Football Over/Under 2.5 FT selection is sufficiently supported now. Missing data stays unknown. TLM quantitative criteria are reference evidence, not mandatory thresholds for your decision. Never invent votes, odds or statistics. Structural exclusions remain mandatory. Assess the selection already stated; do not change it.',
    criteria: {
      SEND: 'Sufficient converging real evidence to publish this selection now during the open first half.',
      WAIT: 'Promising but uncertain; wait for a new natural live observation during the first half.',
      REANALYZE: 'A material change or inconsistency requires a new controlled council analysis before publication.',
      REJECT: 'Insufficient reliability or inconsistent evidence for this selection.',
    }}}};
}
function validateResponse(body, allowedModels) {
  if (!body || typeof body !== 'object' || !allowedModels.includes(body.model)) throw category('model_unavailable');
  const a = body.answers?.production_decision;
  if (!a) throw category('missing_production_decision');
  if (a.type !== 'choice' || !CHOICES.includes(a.choice) || typeof a.confidence !== 'number'
      || !Number.isFinite(a.confidence) || a.confidence < 0 || a.confidence > 1) throw category('invalid_schema');
  const p = a.probabilities;
  if (!p || Object.keys(p).length !== 4 || CHOICES.some(k => typeof p[k] !== 'number' || !Number.isFinite(p[k]) || p[k] < 0 || p[k] > 1)
      || Math.abs(CHOICES.reduce((s,k) => s + p[k], 0) - 1) > 0.02
      || CHOICES.some(k => p[k] > p[a.choice] + 0.000001)) throw category('invalid_probabilities');
  if (!body.usage || !Number.isInteger(body.usage.input_tokens) || body.usage.input_tokens < 0
      || !Number.isInteger(body.usage.output_tokens) || body.usage.output_tokens < 0) throw category('invalid_usage');
  return {model: body.model, ...a, ...body.usage};
}
function category(code) { const e = new Error(code); e.category = code; return e; }
function structuralReason(input) {
  const s = input.state;
  if (!input.structural_allowed || s.match.sport.toLowerCase() !== 'football' || !s.integrity.competition_allowed) return 'structural_exclusion';
  if (!input.first_half_open || s.match.first_half_state !== '1H' || !Number.isInteger(s.match.minute) || s.match.minute < 35) return 'first_half_closed_or_unverified';
  if (!s.integrity.real_data || !Number.isInteger(s.match.score_home) || !Number.isInteger(s.match.score_away)
      || s.match.score_home < 0 || s.match.score_away < 0) return 'essential_data_incoherent';
  const c = s.council;
  if (!['over','under'].includes(c.consensus) || c.seats_available < 1 || c.seats_available > 5
      || c.over_votes + c.under_votes !== c.seats_available
      || c.consensus_votes !== c[`${c.consensus}_votes`] || c.consensus_votes < 1) return 'votes_incoherent';
  // A total already above 2.5 has a known FT outcome: never an actionable signal.
  if (s.match.score_home + s.match.score_away >= 3) return 'market_already_resolved';
  return null;
}
function chooseFinal({answer, error, traditional, structural, open, minimum}) {
  if (structural) return {final_decision: structural === 'essential_data_incoherent' && open ? 'WAIT' : 'REJECT', decision_source: 'tlm_structural_guard'};
  if (error) return {final_decision: traditional ? 'SEND' : 'REJECT', decision_source: 'tlm_fallback_jev_unavailable'};
  if (answer.confidence < minimum) return {final_decision: open ? 'WAIT' : 'REJECT', decision_source: 'jev_low_confidence'};
  return {final_decision: answer.choice, decision_source: 'jev_production'};
}

function createEngine({db, env = process.env, transport = fetch, now = Date.now, logger = () => {}}) {
  init(db);
  const cfg = config(env), inflight = new Map();
  // Circuit survives an API restart through the recent failure rows. No paid probe.
  const recent = db.prepare('SELECT error_category,created_at FROM jev_decisions WHERE request_started=1 ORDER BY id DESC LIMIT 3').all();
  let failures = recent.length === 3 && recent.every(r => r.error_category) ? 3 : 0;
  let circuitUntil = failures ? Date.parse(recent[0].created_at) + 60000 : 0;
  async function call(state) {
    if (!cfg.configured || !cfg.model) throw category('not_configured');
    if (now() < circuitUntil) throw category('circuit_open');
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await transport(ENDPOINT, {method: 'POST', redirect: 'error', signal: controller.signal,
            headers: {'Content-Type':'application/json', Authorization: `Bearer ${env.TYPESAFE_API_KEY}`},
            body: JSON.stringify(requestBody(cfg.model, state))});
          if (!response.ok) throw category([401,403,422,429].includes(response.status) ? `http_${response.status}` : response.status >= 500 ? 'http_5xx' : 'http_other');
          let body;
          try { body = await response.json(); } catch { throw category('invalid_json'); }
          return validateResponse(body, cfg.allowed_models);
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => {controller.abort(); reject(category('timeout'));}, cfg.timeout_ms); }),
      ]);
    } finally { clearTimeout(timer); }
  }
  async function run(input) {
    const age = now() - Date.parse(input.state.match.snapshot_created_at);
    const structural = structuralReason(input) || (!Number.isFinite(age) || age < 0 || age > 120000 ? 'stale_snapshot' : null);
    const created = new Date(now()).toISOString();
    const stateJSON = JSON.stringify(input.state);
    const stateKey = crypto.createHash('sha256').update(stateJSON).digest('hex');
    const existing = db.prepare('SELECT * FROM jev_decisions WHERE snapshot_id=? AND model=?').get(input.snapshot_id, cfg.model);
    if (existing) {
      // Cache hits cannot bypass a new structural refusal or bind an old
      // decision to different evidence under the same snapshot identifier.
      const reason = structural || (existing.state_key !== stateKey ? 'snapshot_state_mismatch' : null);
      if (reason) return {...existing,final_decision:'REJECT',decision_source:'tlm_structural_guard',structural_block_reason:reason};
      if (existing.decision_source === 'pending_jev' && now()-Date.parse(existing.created_at) > cfg.timeout_ms+1000) {
        // An interrupted POST may have been billed. Do not resend it. A fresh,
        // fully traditional candidate can still use the documented fallback.
        let fresh = false;
        try { fresh = Boolean(input.revalidate && await input.revalidate()); } catch {}
        db.prepare(`UPDATE jev_decisions SET final_decision=?,decision_source='tlm_fallback_jev_unavailable',
          error_category='interrupted_request',completed_at=? WHERE id=? AND decision_source='pending_jev'`)
          .run(fresh && existing.traditional_eligible && input.traditional_eligible ? 'SEND' : 'REJECT',created,existing.id);
        return db.prepare('SELECT * FROM jev_decisions WHERE id=?').get(existing.id);
      }
      if (existing.final_decision === 'SEND') {
        let fresh = false;
        try { fresh = Boolean(input.revalidate && await input.revalidate()); } catch {}
        if (!fresh) return {...existing,final_decision:'REJECT',decision_source:'tlm_structural_guard',structural_block_reason:'live_state_changed_or_unverified'};
      }
      return existing; // Includes interrupted claims: never repeat a possibly billed request.
    }
    const claimed = db.prepare(`INSERT OR IGNORE INTO jev_decisions
      (match_key,snapshot_id,fixture_id,created_at,model,traditional_eligible,traditional_decision,
       traditional_block_reason,final_decision,decision_source,structural_block_reason,state_json,state_key,min_confidence,error_category)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.match_key,input.snapshot_id,input.fixture_id || null,created,cfg.model,
        input.traditional_eligible ? 1 : 0,input.traditional_eligible ? 'SEND' : 'REJECT',input.traditional_block_reason || null,
        'REJECT','pending_jev',structural,stateJSON,stateKey,cfg.min_confidence,'interrupted_or_pending');
    if (!claimed.changes) return db.prepare('SELECT * FROM jev_decisions WHERE snapshot_id=? AND model=?').get(input.snapshot_id,cfg.model);
    let answer = null, error = null, finalStructural = structural, latency = null;
    const started = now();
    if (!structural && cfg.enabled && cfg.production_mode) {
      try {
        if (!cfg.configured || !cfg.model) throw category('not_configured');
        if (now() < circuitUntil) throw category('circuit_open');
        db.prepare('UPDATE jev_decisions SET request_started=1 WHERE id=?').run(claimed.lastInsertRowid);
        answer = await call(input.state); failures = 0; circuitUntil = 0;
      } catch (e) {
        error = e.category || 'network_error';
        if (!['not_configured','circuit_open'].includes(error) && ++failures >= 3) circuitUntil = now() + 60000;
      }
      latency = Math.max(0, now() - started);
    } else if (!structural) error = 'disabled';
    let final = chooseFinal({answer, error, traditional: input.traditional_eligible, structural: finalStructural,
      open: input.first_half_open, minimum: cfg.min_confidence});
    // Fresh sporting proof after network latency and immediately before official registration.
    if (final.final_decision === 'SEND') {
      try {
        if (!input.revalidate || !(await input.revalidate())) finalStructural = 'live_state_changed_or_unverified';
      } catch { finalStructural = 'live_state_changed_or_unverified'; }
      if (finalStructural) final = {final_decision:'REJECT',decision_source:'tlm_structural_guard'};
    }
    db.prepare(`UPDATE jev_decisions SET returned_model=?,decision=?,confidence=?,prob_send=?,prob_wait=?,prob_reanalyze=?,prob_reject=?,
      latency_ms=?,input_tokens=?,output_tokens=?,final_decision=?,decision_source=?,error_category=?,structural_block_reason=?,completed_at=? WHERE id=?`)
      .run(answer?.model || null,answer?.choice || null,answer?.confidence ?? null,
        ...CHOICES.map(k => answer?.probabilities[k] ?? null),latency,answer?.input_tokens ?? null,answer?.output_tokens ?? null,
        final.final_decision,final.decision_source,error,finalStructural,new Date(now()).toISOString(),claimed.lastInsertRowid);
    logger({event:'jev_decision',snapshot_id:input.snapshot_id,decision:answer?.choice || null,...final,
      error_category:error,latency_ms:latency,input_tokens:answer?.input_tokens ?? null,output_tokens:answer?.output_tokens ?? null});
    return db.prepare('SELECT * FROM jev_decisions WHERE id=?').get(claimed.lastInsertRowid);
  }
  function evaluate(input) {
    const key = `${input.snapshot_id}|${cfg.model}`;
    if (inflight.has(key)) return inflight.get(key);
    const p = run(input).finally(() => inflight.delete(key));
    inflight.set(key,p); return p;
  }
  function status() {
    const summarize = since => db.prepare(`SELECT COUNT(*) AS evaluated,COALESCE(SUM(request_started),0) AS calls,
      COALESCE(SUM(decision='SEND'),0) AS send,COALESCE(SUM(decision='WAIT'),0) AS wait,
      COALESCE(SUM(decision='REANALYZE'),0) AS reanalyze,COALESCE(SUM(decision='REJECT'),0) AS reject,
      COALESCE(SUM(error_category IS NOT NULL AND error_category!='disabled'),0) AS errors,
      AVG(CASE WHEN request_started=1 THEN latency_ms END) AS average_latency_ms,
      COALESCE(SUM(input_tokens),0) AS input_tokens,COALESCE(SUM(output_tokens),0) AS output_tokens
      FROM jev_decisions WHERE created_at>=?`).get(since);
    const today = summarize(new Date(now()).toISOString().slice(0,10));
    const last = db.prepare('SELECT decision,confidence,latency_ms,created_at,error_category FROM jev_decisions ORDER BY id DESC LIMIT 1').get() || null;
    const lastCall = db.prepare('SELECT created_at FROM jev_decisions WHERE request_started=1 ORDER BY id DESC LIMIT 1').get();
    const lastSuccess = db.prepare('SELECT completed_at FROM jev_decisions WHERE decision IS NOT NULL ORDER BY id DESC LIMIT 1').get();
    const lastError = db.prepare('SELECT error_category FROM jev_decisions WHERE error_category IS NOT NULL ORDER BY id DESC LIMIT 1').get();
    const windows = {};
    for (const [name,days] of [['24h',1],['7d',7],['30d',30]]) {
      const since = new Date(now()-days*86400000).toISOString();
      windows[name] = {...summarize(since),comparison:db.prepare(`SELECT j.traditional_decision,j.decision AS jev_decision,j.final_decision,
        j.decision_source,COUNT(*) AS decisions,COUNT(r.outcome) AS resolved_official,
        COALESCE(SUM(r.outcome='win'),0) AS wins,COALESCE(SUM(r.outcome='loss'),0) AS losses
        FROM jev_decisions j LEFT JOIN official_signal_results r ON r.official_signal_snapshot_id=j.snapshot_id
        WHERE j.created_at>=? GROUP BY j.traditional_decision,j.decision,j.final_decision,j.decision_source`).all(since)};
    }
    return {...cfg,allowed_models:undefined,circuit_open:now()<circuitUntil,calls_today:today.calls,send_today:today.send,
      wait_today:today.wait,reanalyze_today:today.reanalyze,reject_today:today.reject,errors_today:today.errors,
      average_latency_ms:today.average_latency_ms,input_tokens_today:today.input_tokens,output_tokens_today:today.output_tokens,
      last_call_at:lastCall?.created_at || null,last_success_at:lastSuccess?.completed_at || null,
      last_error_category:lastError?.error_category || null,last_decision:last,windows,
      performance_claim:null,day_timezone:'UTC'};
  }
  return {evaluate,status,config:cfg};
}

// Persisted bounds survive restarts. Only a NEW natural snapshot can trigger analysis.
function reserveReobservation(db, scope, snapshotId, now, nextSnapshotId) {
  db.prepare('INSERT OR IGNORE INTO jev_reobservations(fixture_scope,started_at,last_snapshot_id) VALUES (?,?,?)').run(scope,now,snapshotId);
  const row = db.prepare('SELECT * FROM jev_reobservations WHERE fixture_scope=?').get(scope);
  if (now-row.started_at > 12*60000 || row.polls >= 12 || row.analyses >= 2) return {poll:false,analyze:false};
  const analyze = Boolean(nextSnapshotId && nextSnapshotId !== row.last_snapshot_id);
  db.prepare('UPDATE jev_reobservations SET polls=polls+1,analyses=analyses+?,last_snapshot_id=? WHERE fixture_scope=?')
    .run(analyze ? 1 : 0,analyze ? nextSnapshotId : row.last_snapshot_id,scope);
  return {poll:true,analyze};
}
module.exports = {CHOICES,config,init,buildState,requestBody,validateResponse,structuralReason,chooseFinal,createEngine,reserveReobservation};
