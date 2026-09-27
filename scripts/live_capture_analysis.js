'use strict';
const crypto = require('crypto');

const CAPTURE_MIN = 4;
const CAPTURE_MAX = 10;
const IMAGE_MAX_BYTES = 1500000;
const BATCH_MAX_BYTES = 12000000;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function fail(error) {
  return { ok: false, error };
}

function validateCaptureBatch(captures) {
  if (!Array.isArray(captures)) return fail('Captures invalides');
  if (captures.length > CAPTURE_MAX) return fail('Maximum 10 captures');
  const oddsCount = captures.filter((item) => item && item.category === 'odds').length;
  const statsCount = captures.filter((item) => item && item.category === 'stats').length;
  if (oddsCount < 3) return fail('Ajoutez une capture des cotes');
  if (statsCount < 1) return fail('Ajoutez une capture des statistiques');
  if (captures.length < CAPTURE_MIN) return fail('Minimum 4 captures');

  let totalBytes = 0;
  for (const item of captures) {
    if (!ALLOWED_MIME.has(String(item && item.mimeType || '').toLowerCase())) {
      return fail('Format image non autorise');
    }
    const size = Number(item && item.sizeBytes);
    if (!Number.isFinite(size) || size <= 0 || size > IMAGE_MAX_BYTES) {
      return fail('Chaque image doit peser au maximum 1,5 Mo');
    }
    totalBytes += size;
  }
  if (totalBytes > BATCH_MAX_BYTES) return fail('Les captures depassent 12 Mo');
  return { ok: true, oddsCount, statsCount, totalBytes };
}

function normalizeBookmaker(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function validateExtraction(data) {
  if (!data || typeof data !== 'object') return fail('Extraction invalide');
  const match = data.match || {};
  if (!String(match.home || '').trim() || !String(match.away || '').trim()) {
    return fail('Equipes manquantes');
  }
  const screenshots = Array.isArray(data.screenshots) ? data.screenshots : [];
  const rawBookmakers = screenshots
    .filter((item) => item && item.category === 'odds')
    .map((item) => String(item.bookmaker || '').trim())
    .filter(Boolean);
  const normalized = new Set(rawBookmakers.map(normalizeBookmaker));
  if (normalized.size > 1) return fail('Les captures de cotes doivent provenir du meme bookmaker');
  if (!rawBookmakers.length) return fail('Bookmaker non identifie');
  if (!Array.isArray(data.markets) || data.markets.length === 0) return fail('Aucune cote lisible');
  const invalidMarket = data.markets.some((row) => !row || !String(row.market || '').trim()
    || !String(row.selection || '').trim() || !Number.isFinite(Number(row.odd)) || Number(row.odd) <= 1);
  if (invalidMarket) return fail('Cotes extraites invalides');
  const bookmaker = rawBookmakers[0].replace(/\s+/g, ' ');
  return { ok: true, bookmaker, data: { ...data, bookmaker } };
}

function classifyCandidate(probability, bookmakerOdd) {
  const p = Number(probability);
  const odd = Number(bookmakerOdd);
  if (!Number.isFinite(p) || p <= 0 || p >= 1 || !Number.isFinite(odd) || odd <= 1) {
    return fail('Probabilite ou cote invalide');
  }
  const value = Number((p * odd).toFixed(4));
  const fairOdd = Number((1 / p).toFixed(2));
  const label = value >= 1.05 ? 'VALUE' : value >= 0.95 ? 'COHERENT' : 'RISQUE';
  return { ok: true, probability: p, bookmakerOdd: odd, fairOdd, value, label };
}

function fuseCouncilVotes(votes, odds) {
  const validVotes = (Array.isArray(votes) ? votes : []).filter((vote) => vote
    && String(vote.market || '').trim()
    && String(vote.selection || '').trim()
    && Number.isFinite(Number(vote.probability))
    && Number(vote.probability) > 0
    && Number(vote.probability) < 1);
  const totalValidSeats = new Set(validVotes.map((vote, index) => String(vote.seat || index))).size;
  const groups = new Map();
  for (const vote of validVotes) {
    const market = String(vote.market).trim();
    const selection = String(vote.selection).trim();
    const key = market.toLowerCase() + '|' + selection.toLowerCase();
    const group = groups.get(key) || { market, selection, probabilities: [] };
    group.probabilities.push(Number(vote.probability));
    groups.set(key, group);
  }
  const candidates = Array.from(groups.values()).map((group) => {
    const probability = Number((group.probabilities.reduce((sum, p) => sum + p, 0) / group.probabilities.length).toFixed(4));
    const oddRow = (Array.isArray(odds) ? odds : []).find((row) => row
      && String(row.market || '').trim().toLowerCase() === group.market.toLowerCase()
      && String(row.selection || '').trim().toLowerCase() === group.selection.toLowerCase());
    const classified = oddRow ? classifyCandidate(probability, oddRow.odd) : null;
    return {
      market: group.market,
      selection: group.selection,
      probability,
      agreement: group.probabilities.length,
      totalValidSeats,
      bookmakerOdd: classified && classified.ok ? classified.bookmakerOdd : null,
      fairOdd: classified && classified.ok ? classified.fairOdd : Number((1 / probability).toFixed(2)),
      value: classified && classified.ok ? classified.value : null,
      label: classified && classified.ok ? classified.label : 'RISQUE',
    };
  }).sort((a, b) => b.agreement - a.agreement || b.probability - a.probability);
  return { ok: candidates.length > 0, best: candidates[0] || null, alternatives: candidates.slice(1, 3) };
}

function initLiveCaptureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_capture_sessions (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','extracted','confirmed','analysed','resolved')),
      capture_count INTEGER NOT NULL,
      capture_manifest_json TEXT NOT NULL,
      extraction_json TEXT,
      confirmed_json TEXT,
      verdict_json TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      extracted_at TEXT,
      confirmed_at TEXT,
      analysed_at TEXT,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_live_capture_owner_day
      ON live_capture_sessions(owner_key, confirmed_at);
    CREATE TABLE IF NOT EXISTS live_capture_predictions (
      prediction_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES live_capture_sessions(id),
      seat_key TEXT NOT NULL,
      market TEXT NOT NULL,
      selection TEXT NOT NULL,
      probability REAL NOT NULL,
      reasoning_short TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS live_capture_predictions_immutable_update
      BEFORE UPDATE ON live_capture_predictions
      BEGIN SELECT RAISE(ABORT, 'live capture prediction immutable'); END;
    CREATE TRIGGER IF NOT EXISTS live_capture_predictions_immutable_delete
      BEFORE DELETE ON live_capture_predictions
      BEGIN SELECT RAISE(ABORT, 'live capture prediction immutable'); END;
  `);
}

function createLiveCaptureStore({ db, now = () => new Date().toISOString() }) {
  if (!db) throw new Error('Database requise');
  initLiveCaptureSchema(db);

  function rowFor(id) {
    const row = db.prepare('SELECT * FROM live_capture_sessions WHERE id=?').get(id);
    if (!row) throw new Error('Session introuvable');
    return row;
  }

  function publicSession(row) {
    return {
      id: row.id,
      status: row.status,
      captureCount: row.capture_count,
      createdAt: row.created_at,
      extractedAt: row.extracted_at || null,
      confirmedAt: row.confirmed_at || null,
      analysedAt: row.analysed_at || null,
      extraction: row.extraction_json ? JSON.parse(row.extraction_json) : null,
      confirmed: row.confirmed_json ? JSON.parse(row.confirmed_json) : null,
      verdict: row.verdict_json ? JSON.parse(row.verdict_json) : null,
      usage: { tokensIn: row.tokens_in || 0, tokensOut: row.tokens_out || 0, costUsd: row.cost_usd || 0 },
    };
  }

  function dailyCount(owner) {
    const day = String(now()).slice(0, 10);
    return Number(db.prepare(`SELECT COUNT(*) AS n FROM live_capture_sessions
      WHERE owner_key=? AND confirmed_at IS NOT NULL AND substr(confirmed_at,1,10)=?`).get(owner, day).n || 0);
  }

  function createSession({ owner, captures }) {
    if (!String(owner || '').trim()) throw new Error('Proprietaire requis');
    const valid = validateCaptureBatch(captures);
    if (!valid.ok) throw new Error(valid.error);
    const id = crypto.randomUUID();
    const manifest = captures.map((item, index) => ({
      index, category: item.category, mimeType: String(item.mimeType).toLowerCase(), sizeBytes: Number(item.sizeBytes),
    }));
    db.prepare(`INSERT INTO live_capture_sessions
      (id,owner_key,status,capture_count,capture_manifest_json,created_at)
      VALUES (?,?,?,?,?,?)`).run(id, String(owner), 'draft', captures.length, JSON.stringify(manifest), now());
    return publicSession(rowFor(id));
  }

  function saveExtraction(id, extraction, usage = {}) {
    const row = rowFor(id);
    if (row.status !== 'draft') throw new Error('Extraction deja enregistree');
    const valid = validateExtraction(extraction);
    if (!valid.ok) throw new Error(valid.error);
    db.prepare(`UPDATE live_capture_sessions SET status='extracted',extraction_json=?,
      tokens_in=?,tokens_out=?,cost_usd=?,extracted_at=? WHERE id=?`)
      .run(JSON.stringify(valid.data), Number(usage.tokensIn || 0), Number(usage.tokensOut || 0),
        Number(usage.costUsd || 0), now(), id);
    return publicSession(rowFor(id));
  }

  function confirmSnapshot(id, corrected) {
    const row = rowFor(id);
    if (row.status !== 'extracted') throw new Error('Session deja confirmee ou non extraite');
    if (dailyCount(row.owner_key) >= 10) throw new Error('Limite quotidienne atteinte');
    const valid = validateExtraction(corrected);
    if (!valid.ok) throw new Error(valid.error);
    db.prepare(`UPDATE live_capture_sessions SET status='confirmed',confirmed_json=?,confirmed_at=? WHERE id=?`)
      .run(JSON.stringify(valid.data), now(), id);
    return publicSession(rowFor(id));
  }

  const persistVotes = db.transaction((sessionId, votes, timestamp) => {
    for (const vote of votes) {
      db.prepare(`INSERT INTO live_capture_predictions
        (prediction_id,session_id,seat_key,market,selection,probability,reasoning_short,created_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(
        crypto.randomUUID(), sessionId, String(vote.seat), String(vote.market), String(vote.selection),
        Number(vote.probability), String(vote.reasoningShort || '').slice(0, 300), timestamp,
      );
    }
  });

  function saveVotes(id, votes, usage = {}) {
    const row = rowFor(id);
    if (row.status !== 'confirmed') throw new Error('Session non confirmee ou deja analysee');
    const validVotes = (Array.isArray(votes) ? votes : []).filter((vote) => vote && vote.seat
      && vote.market && vote.selection && Number(vote.probability) > 0 && Number(vote.probability) < 1);
    if (!validVotes.length) throw new Error('Aucun bulletin valide');
    const confirmed = JSON.parse(row.confirmed_json);
    const verdict = fuseCouncilVotes(validVotes, confirmed.markets || []);
    const timestamp = now();
    persistVotes(id, validVotes, timestamp);
    db.prepare(`UPDATE live_capture_sessions SET status='analysed',verdict_json=?,tokens_in=?,tokens_out=?,cost_usd=?,analysed_at=? WHERE id=?`)
      .run(JSON.stringify(verdict), Number(row.tokens_in || 0) + Number(usage.tokensIn || 0),
        Number(row.tokens_out || 0) + Number(usage.tokensOut || 0),
        Number(row.cost_usd || 0) + Number(usage.costUsd || 0), timestamp, id);
    return publicSession(rowFor(id));
  }

  return { createSession, saveExtraction, confirmSnapshot, saveVotes, getSession: (id) => publicSession(rowFor(id)), dailyCount };
}


function parseStrictJson(text) {
  if (text && typeof text === 'object') return text;
  const cleaned = String(text || '').trim()
    .replace(/^\x60\x60\x60(?:json)?\s*/i, '')
    .replace(/\s*\x60\x60\x60$/, '');
  if (!cleaned) throw new Error('Reponse IA vide');
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Reponse IA invalide');
  }
  return parsed;
}

function buildVisionPrompt(captures) {
  return [
    'Tu extrais uniquement les donnees visibles dans les captures sportives jointes.',
    'N invente aucune equipe, statistique, cote, minute, score ou bookmaker.',
    'Retourne un JSON pur avec match, screenshots, markets et stats.',
    'Chaque capture de cote doit indiquer son bookmaker; conserve les valeurs illisibles a null.',
    'Schema: {"match":{"home":"","away":"","minute":null,"scoreHome":null,"scoreAway":null},',
    '"screenshots":[{"category":"odds|stats","bookmaker":""}],',
    '"markets":[{"market":"","selection":"","odd":1.01}],"stats":{}}',
    'Categories attendues: ' + captures.map((item) => item.category).join(', '),
  ].join('\n');
}

function buildCouncilPrompt(confirmed) {
  return [
    'Tu es un siege independant du Concile TousLesMatchs.',
    'Analyse exclusivement le JSON confirme ci-dessous. Ne cherche pas ailleurs et n invente aucune valeur absente.',
    'Choisis seulement un marche et une selection presents dans confirmed.markets.',
    'Retourne un JSON pur: {"market":"","selection":"","probability":0.5,"reasoningShort":""}.',
    'probability doit etre strictement comprise entre 0 et 1.',
    'JSON_CONFIRME:',
    JSON.stringify(confirmed),
  ].join('\n');
}

function decodeCapture(item, index) {
  const mimeType = String(item && item.mimeType || '').toLowerCase();
  const prefix = 'data:' + mimeType + ';base64,';
  const dataUrl = String(item && item.dataUrl || '');
  if (!dataUrl.startsWith(prefix)) throw new Error('Contenu image invalide');
  let bytes;
  try {
    bytes = Buffer.from(dataUrl.slice(prefix.length), 'base64');
  } catch (_) {
    throw new Error('Contenu image invalide');
  }
  if (!bytes.length || bytes.length !== Number(item.sizeBytes)) throw new Error('Taille image incoherente');
  if (bytes.length > IMAGE_MAX_BYTES) throw new Error('Chaque image doit peser au maximum 1,5 Mo');
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return { index, category: item.category, mimeType, sizeBytes: bytes.length, bytes, extension };
}

function routeErrorStatus(error) {
  const message = String(error && error.message || error || '');
  if (/introuvable/i.test(message)) return 404;
  if (/Limite quotidienne/i.test(message)) return 429;
  if (/deja|non confirmee|non extraite/i.test(message)) return 409;
  if (/Aucun bulletin valide|Reponse IA|fournisseur/i.test(message)) return 502;
  return 400;
}

function registerLiveCaptureRoutes({
  app,
  db,
  requireAdmin,
  callVision,
  callCouncil,
  storageDir,
  enabled = () => false,
}) {
  if (!app || !db || typeof requireAdmin !== 'function') throw new Error('Integration admin incomplete');
  if (typeof callVision !== 'function' || typeof callCouncil !== 'function') throw new Error('Integration IA incomplete');
  const root = String(storageDir || '/data/live-capture-uploads');
  const store = createLiveCaptureStore({ db });
  const seatKeys = ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5'];

  function gate(req, res) {
    if (!enabled()) {
      res.status(404).json({ ok: false, error: 'Fonctionnalite indisponible' });
      return null;
    }
    const owner = requireAdmin(req);
    if (!owner) {
      res.status(403).json({ ok: false, error: 'Acces admin requis' });
      return null;
    }
    return String(owner);
  }

  app.post('/admin/live-capture/sessions', async (req, res) => {
    const owner = gate(req, res);
    if (!owner) return;
    let sessionDir = null;
    try {
      const captures = Array.isArray(req.body && req.body.captures) ? req.body.captures : [];
      const valid = validateCaptureBatch(captures);
      if (!valid.ok) throw new Error(valid.error);
      const decoded = captures.map(decodeCapture);
      const session = store.createSession({ owner, captures });
      sessionDir = require('path').join(root, session.id);
      require('fs').mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
      const visionCaptures = decoded.map((item) => {
        const filePath = require('path').join(sessionDir, String(item.index) + '.' + item.extension);
        require('fs').writeFileSync(filePath, item.bytes, { mode: 0o600 });
        return { category: item.category, mimeType: item.mimeType, sizeBytes: item.sizeBytes, path: filePath };
      });
      const vision = await callVision({ captures: visionCaptures, prompt: buildVisionPrompt(visionCaptures) });
      const extraction = parseStrictJson(vision && (vision.text || vision.data || vision));
      const extracted = store.saveExtraction(session.id, extraction, vision && vision.usage || {});
      return res.status(201).json({ ok: true, session: extracted });
    } catch (error) {
      return res.status(routeErrorStatus(error)).json({ ok: false, error: String(error.message || error) });
    } finally {
      if (sessionDir) require('fs').rmSync(sessionDir, { recursive: true, force: true });
    }
  });

  app.get('/admin/live-capture/sessions/:id', (req, res) => {
    if (!gate(req, res)) return;
    try {
      return res.json({ ok: true, session: store.getSession(req.params.id) });
    } catch (error) {
      return res.status(routeErrorStatus(error)).json({ ok: false, error: String(error.message || error) });
    }
  });

  app.post('/admin/live-capture/sessions/:id/confirm', (req, res) => {
    if (!gate(req, res)) return;
    try {
      const session = store.confirmSnapshot(req.params.id, req.body && req.body.confirmed);
      return res.json({ ok: true, session });
    } catch (error) {
      return res.status(routeErrorStatus(error)).json({ ok: false, error: String(error.message || error) });
    }
  });

  app.post('/admin/live-capture/sessions/:id/analyse', async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const current = store.getSession(req.params.id);
      if (current.status !== 'confirmed') throw new Error('Session non confirmee ou deja analysee');
      const prompt = buildCouncilPrompt(current.confirmed);
      const results = await Promise.all(seatKeys.map(async (seat) => {
        try {
          const response = await callCouncil({ seat, confirmed: current.confirmed, prompt, sessionId: req.params.id });
          const parsed = parseStrictJson(response && (response.text || response.data || response));
          const probability = Number(parsed.probability);
          const market = String(parsed.market || '').trim();
          const selection = String(parsed.selection || '').trim();
          const offered = (Array.isArray(current.confirmed.markets) ? current.confirmed.markets : []).some((row) => row
            && String(row.market || '').trim().toLowerCase() === market.toLowerCase()
            && String(row.selection || '').trim().toLowerCase() === selection.toLowerCase());
          if (!market || !selection || !offered
              || !Number.isFinite(probability) || probability <= 0 || probability >= 1) return null;
          return {
            vote: {
              seat,
              market,
              selection,
              probability,
              reasoningShort: String(parsed.reasoningShort || '').slice(0, 300),
            },
            usage: response && response.usage || {},
          };
        } catch (_) {
          return null;
        }
      }));
      const valid = results.filter(Boolean);
      if (!valid.length) throw new Error('Aucun bulletin valide');
      const usage = valid.reduce((sum, item) => ({
        tokensIn: sum.tokensIn + Number(item.usage.tokensIn || 0),
        tokensOut: sum.tokensOut + Number(item.usage.tokensOut || 0),
        costUsd: sum.costUsd + Number(item.usage.costUsd || 0),
      }), { tokensIn: 0, tokensOut: 0, costUsd: 0 });
      const session = store.saveVotes(req.params.id, valid.map((item) => item.vote), usage);
      return res.json({ ok: true, session });
    } catch (error) {
      return res.status(routeErrorStatus(error)).json({ ok: false, error: String(error.message || error) });
    }
  });

  return { store };
}

module.exports = {
  validateCaptureBatch, validateExtraction, classifyCandidate, fuseCouncilVotes,
  createLiveCaptureStore, initLiveCaptureSchema, registerLiveCaptureRoutes,
  parseStrictJson, buildVisionPrompt, buildCouncilPrompt,
};
