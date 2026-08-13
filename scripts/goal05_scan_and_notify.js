const fs = require('fs');
const path = require('path');
const https = require('https');

const {
  evaluateCandidate,
  PLUS05_MIN_ODD,
  MIN_HISTORICAL_SEASONS,
} = require('./plus05_engine');

const ROOT = path.resolve(__dirname, '..');
const ANALYSES_DIR = path.join(ROOT, 'docs', 'goal-05', 'analyses');
const DEFAULT_CANDIDATES_FILE = path.join(ANALYSES_DIR, 'goal05-watchlist-candidates.json');
const SENT_LOG_FILE = path.join(ANALYSES_DIR, 'goal05-sent-log.json');

function isoDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function readJsonIfExists(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\\uFEFF/, ''));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function loadCandidates(file = process.env.GOAL05_CANDIDATES_FILE || DEFAULT_CANDIDATES_FILE) {
  const candidates = readJsonIfExists(file, []);
  if (!Array.isArray(candidates)) {
    throw new Error(`Le fichier candidats Goal 0.5 doit contenir une liste: ${file}`);
  }
  return { file, candidates };
}

function missingForEngine(candidate) {
  if (candidate.readyForEngine === false) {
    return candidate.missingData && candidate.missingData.length
      ? candidate.missingData
      : ['donnees_live_incompletes'];
  }

  const missing = [];
  const requiredTopLevel = [
    'country',
    'league',
    'competitionType',
    'team',
    'opponent',
    'teamSide',
    'fiveYearStrength',
    'recent',
    'stake',
    'odds',
  ];

  for (const key of requiredTopLevel) {
    if (candidate[key] === undefined || candidate[key] === null || candidate[key] === '') {
      missing.push(key);
    }
  }

  const strength = candidate.fiveYearStrength || {};
  for (const key of ['teamPercentile', 'opponentPercentile', 'seasonsAvailable', 'levelTableLoaded']) {
    if (strength[key] === undefined || strength[key] === null || strength[key] === '') {
      missing.push(`fiveYearStrength.${key}`);
    }
  }

  const recent = candidate.recent || {};
  for (const key of [
    'recentMatchesOrder',
    'scoredInLastFive',
    'opponentConcededInLastFive',
    'weightedConstructedGoals',
    'scoringState',
    'opponentConcedesState',
    'goal05SpecificEvidence',
    'candidateCanReproduceConcessionPattern',
    'candidateLevelMatchesPriorScorers',
  ]) {
    if (recent[key] === undefined || recent[key] === null || recent[key] === '') {
      missing.push(`recent.${key}`);
    }
  }

  const stake = candidate.stake || {};
  for (const key of ['teamHasMeaningfulObjective', 'sameZoneAfterResult']) {
    if (stake[key] === undefined || stake[key] === null || stake[key] === '') {
      missing.push(`stake.${key}`);
    }
  }

  const odds = candidate.odds || {};
  if (!Array.isArray(odds.arjelBookmakers) || odds.arjelBookmakers.length === 0) {
    missing.push('odds.arjelBookmakers');
  }

  return [...new Set(missing)];
}

function signalKey(candidate, evaluation) {
  return [
    candidate.matchId || candidate.id || `${candidate.home || ''}-${candidate.away || ''}`,
    candidate.team,
    'team_over_0_5_goal',
    evaluation?.bestOdd?.bookmaker || '',
    evaluation?.bestOdd?.odd || '',
  ].join('|').toLowerCase();
}

function matchLabel(home, away) {
  return `${home || '?'} - ${away || '?'}`;
}

function formatTelegramMessage(candidate, evaluation) {
  const offer = evaluation.bestOffer || evaluation.evidence?.market?.offers?.[0] || {};
  const reasons = evaluation.reasons.slice(0, 6).map((reason) => `- ${reason}`).join('\n');
  const warnings = evaluation.warnings.length
    ? `\n\nVigilance:\n${evaluation.warnings.slice(0, 4).map((warning) => `- ${warning}`).join('\n')}`
    : '';

  return [
    'GOAL 0.5 IA - signal bêta',
    '',
    `${candidate.team} +0,5 but`,
    `Match: ${matchLabel(candidate.home || candidate.team, candidate.away || candidate.opponent)}`,
    `Championnat: ${candidate.league} (${candidate.country})`,
    `Cote ANJ: @${offer.odd || evaluation.evidence?.market?.bestOdd} ${offer.bookmaker ? `(${offer.bookmaker})` : ''}`,
    '',
    'Pourquoi le moteur valide:',
    reasons,
    warnings,
    '',
    'Jeu responsable: réservé aux +18 ans. Les performances passées ne garantissent pas les résultats futurs.',
  ].filter(Boolean).join('\n');
}
function postTelegram({ token, chatId, text }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });

    const request = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve({ ok: true, statusCode: response.statusCode, body });
        } else {
          reject(new Error(`Telegram HTTP ${response.statusCode}: ${body}`));
        }
      });
    });

    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

async function runScan(options = {}) {
  const now = options.now || new Date();
  const sendTelegram = options.sendTelegram ?? process.env.GOAL05_SEND_TELEGRAM === '1';
  const token = options.telegramToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.telegramChatId
    ?? process.env.TELEGRAM_GOAL05_CHANNEL_ID
    ?? process.env.TELEGRAM_GOAL05_CHAT_ID;
  const loaded = options.candidates
    ? { file: options.sourceFile || 'options.candidates', candidates: options.candidates }
    : loadCandidates(options.candidatesFile);

  const writeSentLog = options.writeSentLog !== false;
  const sentLog = options.sentLog || readJsonIfExists(SENT_LOG_FILE, {});
  const results = [];
  let sentCount = 0;

  for (const candidate of loaded.candidates) {
    const missing = missingForEngine(candidate);
    if (missing.length) {
      results.push({
        id: candidate.id || candidate.matchId,
        match: matchLabel(candidate.home, candidate.away),
        team: candidate.team,
        status: 'NEEDS_DATA',
        sendDecision: 'blocked',
        missing,
      });
      continue;
    }

    const evaluation = evaluateCandidate(candidate);
    const bestOffer = evaluation.evidence?.market?.offers?.[0] || null;
    const key = signalKey(candidate, { bestOdd: bestOffer || { odd: evaluation.evidence?.market?.bestOdd } });
    const alreadySent = Boolean(sentLog[key]);
    const shouldSend = sendTelegram
      && evaluation.status === 'ELIGIBLE_SHADOW'
      && !alreadySent
      && Boolean(token)
      && Boolean(chatId);

    const result = {
      id: candidate.id || candidate.matchId,
      match: matchLabel(candidate.home || candidate.team, candidate.away || candidate.opponent),
      team: candidate.team,
      status: evaluation.status,
      sendDecision: shouldSend ? 'send' : 'not_sent',
      reasons: evaluation.reasons,
      rejections: evaluation.rejections,
      warnings: evaluation.warnings,
      evidence: evaluation.evidence,
      bestOdd: bestOffer || (evaluation.evidence?.market?.bestOdd ? { odd: evaluation.evidence.market.bestOdd } : null),
      bestOffer,
      alreadySent,
    };

    if (shouldSend) {
      const telegramText = formatTelegramMessage(candidate, evaluation);
      const sent = options.telegramPoster
        ? await options.telegramPoster({ token, chatId, text: telegramText })
        : await postTelegram({ token, chatId, text: telegramText });
      sentLog[key] = {
        sentAt: now.toISOString(),
        candidateId: result.id,
        team: candidate.team,
        match: result.match,
        telegramStatusCode: sent.statusCode || null,
      };
      result.telegram = { ok: true, statusCode: sent.statusCode || null };
      sentCount += 1;
    } else if (evaluation.status === 'ELIGIBLE_SHADOW' && sendTelegram && (!token || !chatId)) {
      result.sendDecision = 'blocked_missing_telegram_config';
    }

    results.push(result);
  }

  if (sentCount > 0 && writeSentLog) writeJson(SENT_LOG_FILE, sentLog);

  const summary = {
    generatedAt: now.toISOString(),
    sourceFile: loaded.file,
    minOdd: PLUS05_MIN_ODD,
    minHistoricalSeasons: MIN_HISTORICAL_SEASONS,
    sendTelegram,
    telegramConfigured: Boolean(token && chatId),
    total: results.length,
    eligible: results.filter((r) => r.status === 'ELIGIBLE_SHADOW').length,
    needsData: results.filter((r) => r.status === 'NEEDS_DATA').length,
    noBet: results.filter((r) => r.status === 'NO_BET').length,
    watchlist: results.filter((r) => r.status === 'WATCHLIST_SHADOW').length,
    sent: sentCount,
  };

  return { summary, results };
}

function renderMarkdown(report) {
  const lines = [
    '# Scan Goal 0.5 IA',
    '',
    `- Généré le : ${report.summary.generatedAt}`,
    `- Fichier source : ${report.summary.sourceFile}`,
    `- Seuil cote bêta : ${report.summary.minOdd}`,
    `- Saisons historiques minimales : ${report.summary.minHistoricalSeasons}`,
    `- Envoi Telegram demandé : ${report.summary.sendTelegram ? 'oui' : 'non'}`,
    `- Telegram configuré : ${report.summary.telegramConfigured ? 'oui' : 'non'}`,
    '',
    `Résumé : ${report.summary.eligible} éligible(s), ${report.summary.watchlist} watchlist, ${report.summary.needsData} incomplet(s), ${report.summary.noBet} refusé(s), ${report.summary.sent} envoyé(s).`,
    '',
    '## Détail',
    '',
  ];

  for (const item of report.results) {
    lines.push(`### ${item.match}`);
    lines.push('');
    lines.push(`- Équipe visée : ${item.team || 'à compléter'}`);
    lines.push(`- Statut : ${item.status}`);
    lines.push(`- Envoi : ${item.sendDecision}`);
    if (item.bestOdd) lines.push(`- Meilleure cote : @${item.bestOdd.odd} ${item.bestOdd.bookmaker || ''}`);
    if (item.missing?.length) lines.push(`- Données manquantes : ${item.missing.join(', ')}`);
    if (item.rejections?.length) lines.push(`- Refus : ${item.rejections.join(' | ')}`);
    if (item.warnings?.length) lines.push(`- Vigilance : ${item.warnings.join(' | ')}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
async function main() {
  const report = await runScan();
  fs.mkdirSync(ANALYSES_DIR, { recursive: true });
  const day = isoDay();
  const jsonFile = path.join(ANALYSES_DIR, `${day}-goal05-scan-report.json`);
  const mdFile = path.join(ANALYSES_DIR, `${day}-goal05-scan-report.md`);
  writeJson(jsonFile, report);
  fs.writeFileSync(mdFile, renderMarkdown(report));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Rapport: ${mdFile}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  formatTelegramMessage,
  loadCandidates,
  missingForEngine,
  runScan,
};




