// Programme du jour — Live Telegram Reporter
// Ajoute : require("./live_reporter.js")(app, db);
// Envoie le programme du jour le matin + résultats au fil de l'eau

module.exports = function(app, db) {

const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const TELEGRAM_PREMIUM_CHANNEL_ID = process.env.TELEGRAM_PREMIUM_CHANNEL_ID;
const TELEGRAM_ELITE_CHANNEL_ID = process.env.TELEGRAM_ELITE_CHANNEL_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Stocke le message "programme du jour" pour pouvoir l'éditer
let _programMessageId = null;
let _programChannelId = null;
let _programMatchProgress = new Map(); // key -> { status, result, score }

function sendTelegramMsg(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return Promise.resolve(false);
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: String(chatId).replace("-100","-100"), text, parse_mode: "HTML", disable_web_page_preview: true })
  }).then(r => r.json()).then(d => {
    if (d.ok && d.result) {
      return d.result.message_id;
    }
    return false;
  }).catch(() => false);
}

function editTelegramMsg(chatId, messageId, text) {
  if (!TELEGRAM_BOT_TOKEN || !chatId || !messageId) return Promise.resolve(false);
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: String(chatId).replace("-100","-100"), message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true })
  }).then(r => r.json()).then(d => d.ok).catch(() => false);
}

// ── Envoyer le programme du jour (appelé au démarrage du daily-pick) ──
async function sendProgrammeDuJour() {
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  
  // Collecte tous les matchs du jour dans concile_analyses
  const matches = db.prepare(`
    SELECT DISTINCT home, away, competition, sport, best_bet, confidence, 
           outcome, final_score_home, final_score_away, real_odd
    FROM concile_analyses 
    WHERE date(analysed_at) = ? AND confidence >= 60
    ORDER BY analysed_at DESC
  `).all(today);

  if (matches.length < 1) return false;

  // Déduplique
  const seen = new Set();
  const unique = [];
  for (const m of matches) {
    const k = m.home + "_" + m.away;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(m);
  }

  // Initialise le tracking
  _programMatchProgress.clear();
  for (const m of unique) {
    _programMatchProgress.set(m.home + "_" + m.away, {
      status: m.outcome || "pending",
      score: m.final_score_home != null ? m.final_score_home + "-" + m.final_score_away : null,
      bet: m.best_bet,
      confidence: m.confidence,
      home: m.home,
      away: m.away,
      comp: m.competition
    });
  }

  let msg = buildProgrammeMessage(unique);
  
  // Envoie dans Premium et Admin
  const targets = [];
  if (TELEGRAM_PREMIUM_CHANNEL_ID) targets.push(TELEGRAM_PREMIUM_CHANNEL_ID);
  if (TELEGRAM_ELITE_CHANNEL_ID) targets.push(TELEGRAM_ELITE_CHANNEL_ID);

  let sentId = null;
  let sentChannel = null;
  for (const ch of targets) {
    const mid = await sendTelegramMsg(ch, msg);
    if (mid) { sentId = mid; sentChannel = ch; }
  }

  _programMessageId = sentId;
  _programChannelId = sentChannel;
  console.log(`[programme-jour] ${unique.length} matchs — message ${sentId} dans ${sentChannel}`);
  return true;
}

function buildProgrammeMessage(matches) {
  const today = new Date().toISOString().slice(0, 10);
  const total = matches.length;
  const resolved = matches.filter(m => m.outcome === "win" || m.outcome === "loss").length;
  const wins = matches.filter(m => m.outcome === "win").length;
  const losses = matches.filter(m => m.outcome === "loss").length;
  const pending = total - resolved;

  let lines = [];
  for (const m of matches) {
    let icon, score, extra;
    if (m.outcome === "win") {
      icon = "✅";
      score = m.final_score_home != null ? m.final_score_home + "-" + m.final_score_away : "?";
      extra = `GAGNÉ ${score}`;
    } else if (m.outcome === "loss") {
      icon = "❌";
      score = m.final_score_home != null ? m.final_score_home + "-" + m.final_score_away : "?";
      extra = `PERDU ${score}`;
    } else {
      icon = "⏳";
      // Find the time of the match - we don't have kickoff time in concile_analyses
      extra = "En attente";
    }
    lines.push(`${icon} <b>${m.home} vs ${m.away}</b> — ${extra}`);
    if (m.best_bet) {
      lines.push(`   📊 ${m.best_bet} @ ${rowOdd(m).toFixed(2)} — ${m.confidence}%`);
    }
  }

  const header = `📋 <b>PROGRAMME DU JOUR — ${today}</b>\n\n`;
  const stats = `✅ ${wins} gagnés / ❌ ${losses} perdus / ⏳ ${pending} en attente\n\n`;
  const footer = `\n━━━━━━━━━━━━━━━━━━\n🤖 Concile IA — TousLesMatchs\n⚠️ 18+ — Jeu responsable`;

  return header + stats + lines.join("\n") + footer;
}

// ── Mettre à jour quand un match se termine ──
async function updateProgrammeResult(analysis, outcome, scoreH, scoreA) {
  if (!_programMessageId || !_programChannelId) return;

  const key = analysis.home + "_" + analysis.away;
  if (_programMatchProgress.has(key)) {
    _programMatchProgress.set(key, {
      ..._programMatchProgress.get(key),
      status: outcome,
      score: scoreH + "-" + scoreA
    });
  }

  // Reconstruire le message
  const matches = Array.from(_programMatchProgress.values());
  let msg = buildProgrammeMessage(matches.map(m => ({
    ...m,
    outcome: m.status,
    final_score_home: m.score ? parseInt(m.score.split("-")[0]) : null,
    final_score_away: m.score ? parseInt(m.score.split("-")[1]) : null
  })));

  await editTelegramMsg(_programChannelId, _programMessageId, msg);
  console.log(`[programme-jour] MAJ: ${analysis.home} vs ${analysis.away} → ${outcome}`);
}

// Helper rowOdd
function rowOdd(r) {
  if (r && r.real_odd) return parseFloat(r.real_odd);
  return 1.5;
}

// ── Exposer les fonctions pour l'appel depuis notifySignalFortResult ──
return {
  sendProgrammeDuJour,
  updateProgrammeResult
};

};