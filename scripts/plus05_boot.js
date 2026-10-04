'use strict';
/**
 * Branchement du moteur "+0,5 but equipe favorite" dans api_server.js.
 * Un seul appel depuis api_server.js : require('./plus05_boot')({ ... }).
 * Reglages par variables d'environnement (aucun n'est actif par defaut) :
 *   PLUS05_ENABLED=1        active la boucle
 *   PLUS05_DRY_RUN=0        envoie reellement (sinon essai a blanc : enregistre sans envoyer)
 *   PLUS05_REQUIRE_HISTORY=0  desactive le controle des 4 saisons
 *   PLUS05_LEAGUE_IDS=39,40 ... liste des championnats api-sports
 *   PLUS05_TICK_MS=120000   frequence de la boucle live
 */
const fs = require('fs');
const path = require('path');
const { createPlus05Engine } = require('./plus05_engine');
const { createPlus05ShadowLearning } = require('./plus05_shadow_learning');
const { createPlus05JevShadow } = require('./plus05_jev_shadow');

// Europe D1+D2, Norvege D1, Danemark D1+D2, Bresil, Argentine, Chili/Uruguay/Paraguay/Colombie D1, Japon, Coree K1.
// MLS (253) : classement a conferences, ecarte automatiquement (regle : ne jamais melanger les groupes).
const DEFAULT_LEAGUES = [
  39, 40, 140, 141, 135, 136, 78, 79, 61, 62, 88, 89, 94, 95, 144, 145, 207, 208, 218, 219, 179, 180, 203, 204,
  197, 106, 107, 345, 113, 114, 119, 120, 103, 71, 72, 128, 129, 265, 268, 250, 239, 98, 99, 292,
].join(',');
// Verifie le 30/09/2026 : 198 (Grece D2, saison 2020) et 346 (Tchequie D2, sans classement) retires.

module.exports = function bootPlus05(ctx) {
  const { app, db, httpGet, httpPost, resolveModel, fetchLiveMatches, isAdminAccess, publisher, parisParts, env, log = console } = ctx;

  const flags = () => ({
    enabled: env.PLUS05_ENABLED === '1',
    dryRun: env.PLUS05_DRY_RUN !== '0',
    requireHistory: env.PLUS05_REQUIRE_HISTORY !== '0',
    sendResults: env.PLUS05_SEND_RESULTS !== '0',
  });
  const leagueIds = String(env.PLUS05_LEAGUE_IDS || DEFAULT_LEAGUES).split(',').map((x) => Number(x.trim())).filter(Boolean);

  const apiGet = (path) => httpGet(`https://v3.football.api-sports.io${path}`, { 'x-apisports-key': env.API_SPORTS_KEY });

  const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
  function seatConfig(seat) {
    const m = {
      'Perplexity-Web': { url: 'https://api.perplexity.ai/chat/completions', key: env.PERPLEXITY_API_KEY, model: 'sonar-pro' },
      'DeepSeek-V3': { url: 'https://api.deepseek.com/v1/chat/completions', key: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL || 'deepseek-chat' },
      'Mistral-Large': { url: 'https://api.mistral.ai/v1/chat/completions', key: env.MISTRAL_API_KEY, model: env.MISTRAL_MODEL || 'mistral-large-latest' },
      'OpenRouter-Luna': { url: OR_URL, key: env.OPENROUTER_API_KEY, model: resolveModel(env.OR_LUNA_MODEL || 'openai/gpt-5.6-luna') },
      'OpenRouter-Qwen': { url: OR_URL, key: env.OPENROUTER_API_KEY, model: resolveModel(env.OR_QWEN_MODEL || 'qwen/qwen3.7-max'), reasoning: { effort: 'none' } },
      'OpenRouter-Kimi': { url: OR_URL, key: env.OPENROUTER_API_KEY, model: resolveModel(env.OR_KIMI_MODEL || 'moonshotai/kimi-k2') },
    };
    return m[seat];
  }
  async function callSeat(seat, prompt) {
    const cfg = seatConfig(seat);
    if (!cfg || !cfg.key) return { ok: false, error: 'siege non configure' };
    const body = { model: cfg.model, messages: [{ role: 'user', content: prompt }], max_tokens: 300, temperature: 0.2 };
    if (cfg.reasoning) body.reasoning = cfg.reasoning;
    // httpPost applique deja le garde-fou budgetaire global pour OpenRouter.
    const r = await httpPost(cfg.url, body, { Authorization: `Bearer ${cfg.key}` }, 45000);
    const text = r?.choices?.[0]?.message?.content || '';
    if (!text) return { ok: false, error: r?.error?.message || 'reponse vide' };
    return { ok: true, text };
  }

  // Meme fichier que l'ancien module goal05 : /goal05/latest le sert a l'application (membres Premium uniquement).
  const latestFile = env.GOAL05_LATEST_SIGNAL_FILE || path.join(path.dirname(env.DB_PATH || '/data/tlm.db'), 'goal05-latest-signal.json');
  const onSignal = (signal) => {
    fs.mkdirSync(path.dirname(latestFile), { recursive: true });
    fs.writeFileSync(latestFile, JSON.stringify(signal, null, 2));
  };

  const shadowLearning = createPlus05ShadowLearning({ db, log });
  shadowLearning.ensureSchema();
  const jevShadow = createPlus05JevShadow({ env, log });

  function parseShadowVote(text) {
    const m = String(text || '').match(/"vote"\s*:\s*"?\s*(OUI|NON|YES|NO)/i);
    if (!m) return null;
    const conf = String(text).match(/"confiance"\s*:\s*(\d{1,3})/i);
    const raison = String(text).match(/"raison"\s*:\s*"([^"]{0,160})/i);
    return { decision:/^(OUI|YES)$/i.test(m[1])?'yes':'no',
      yes:/^(OUI|YES)$/i.test(m[1]), confidence:conf?Number(conf[1]):null, raison:raison?raison[1]:'' };
  }

  async function shadowVote(input) {
    const out = [];
    try {
      const kimiRaw = await callSeat('OpenRouter-Kimi', input.prompt);
      if (kimiRaw?.ok) {
        const v = parseShadowVote(kimiRaw.text);
        out.push(v ? { seat:'Kimi', failed:false, ...v } : { seat:'Kimi', failed:true, error:'illisible' });
      } else out.push({ seat:'Kimi', failed:true, error:kimiRaw?.error || 'echec' });
    } catch (e) { out.push({ seat:'Kimi', failed:true, error:e.message }); }
    try { out.push(await jevShadow.evaluate(input)); }
    catch (e) { out.push({ seat:'Jev', failed:true, error:e.message }); }
    return out;
  }

  const engine = createPlus05Engine({ db, apiGet, fetchLiveMatches, callSeat, publisher, onSignal,
    shadowLearning, shadowVote, leagueIds, flags, log });
  engine.ensureSchema();

  const guarded = (name, fn) => async () => {
    try { if (flags().enabled) await fn(); } catch (e) { log.error(`[plus05] ${name}:`, e.message); }
  };
  const buildToday = guarded('watchlist', async () => {
    const p = parisParts(Date.now());
    await engine.buildWatchlist(p.day);
    if (p.hour >= 18) await engine.buildWatchlist(parisParts(Date.now() + 86400000).day);
  });
  const tickMs = Math.max(60000, Number(env.PLUS05_TICK_MS || 120000));
  setInterval(guarded('tick', async () => {
    const r = await engine.tick();
    if (r && (r.candidates || r.sent)) log.log('[plus05] tick', JSON.stringify(r));
  }), tickMs).unref();
  setInterval(guarded('settle', () => engine.settlePending()), 10 * 60 * 1000).unref();
  setInterval(buildToday, 2 * 3600 * 1000).unref();
  setTimeout(buildToday, 60000).unref();

  // Journal interne reserve a l'administrateur.
  app.get('/admin/plus05-log', (req, res) => {
    const { email, code } = req.query;
    if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: 'Acces admin requis' });
    try {
      res.json({ ok: true, flags: flags(), leagues: leagueIds.length,
        jevShadow: { enabled: jevShadow.config.enabled, configured: jevShadow.config.configured, model: jevShadow.config.model },
        ...engine.adminReport({ limit: Math.min(500, Number(req.query.limit) || 100), includeDry: req.query.includeDry === '1' }) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Journal indisponible' }); }
  });

  // Statistiques publiques agregees (sans essais a blanc) pour le site.
  // Caddy retire le prefixe /api : la route doit exister sans prefixe (et avec, pour un appel direct).
  app.get(['/plus05/stats', '/api/plus05/stats'], (req, res) => {
    try {
      const r = engine.adminReport({ limit: 30 });
      res.json({ ok: true, total: r.total, wins: r.wins, losses: r.losses, pending: r.pending, winRatePct: r.winRatePct,
        recent: r.signals.map((s) => ({ date: s.sentAt, match: s.match, competition: s.competition, team: s.team,
          odd: s.odd, risk: s.risk, outcome: s.outcome, finalScore: s.finalScore })) });
    } catch (e) { res.status(500).json({ ok: false }); }
  });

  log.log(`[plus05] charge — championnats=${leagueIds.length} actif=${flags().enabled} essai_a_blanc=${flags().dryRun}`);
  return engine;
};
