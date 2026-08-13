"use strict";

const fs = require("fs");
const path = require("path");
const { runScan } = require("./goal05_scan_and_notify");

const ROOT = path.resolve(__dirname, "..");
const CACHE_ROOT = path.join(ROOT, "docs", "goal-05", "strategie-memory", "championnats", "cache");
const ANALYSES_DIR = path.join(ROOT, "docs", "goal-05", "analyses");
const API_BASE = "https://v3.football.api-sports.io";
let lastApiCallAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ALLOWED_COUNTRIES = new Set([
  "Argentina", "Austria", "Belgium", "Brazil", "Croatia", "Denmark", "England",
  "France", "Germany", "Greece", "Italy", "Japan", "Netherlands", "Norway", "Poland",
  "Portugal", "Scotland", "South Korea", "Spain", "Sweden", "Switzerland", "Turkey"
]);

const COUNTRY_ALIASES = new Map([
  ["Bresil", "Brazil"],
  ["Allemagne", "Germany"],
  ["Angleterre", "England"],
  ["Espagne", "Spain"],
  ["France", "France"],
  ["Italie", "Italy"],
  ["Norvege", "Norway"],
  ["Suede", "Sweden"],
  ["Argentine", "Argentina"],
  ["Japon", "Japan"],
  ["Coree du Sud", "South Korea"],
  ["Belgique", "Belgium"],
  ["Pays-Bas", "Netherlands"],
  ["Portugal", "Portugal"],
  ["Ecosse", "Scotland"],
]);

function todayParis() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function postTelegram({ token, chatId, text }) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true });
    const req = require("https").request({
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ ok: true, statusCode: res.statusCode, body });
        else reject(new Error(`Telegram HTTP ${res.statusCode}: ${body}`));
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function compact(value, max = 900) {
  const text = String(value || "").replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function adminWatchlistItems(report, limit = 5) {
  return (report.results || [])
    .filter((item) => item.status !== "ELIGIBLE_SHADOW")
    .filter((item) => item.bestOdd && Number(item.bestOdd.odd) >= 1.30)
    .slice(0, limit);
}
function adminVerdict(item) {
  if (item.status === "ELIGIBLE_SHADOW") {
    return { icon: "🟢", label: "GO", detail: "tous les critères sont validés" };
  }

  const reasons = item.reasons || item.rejections || [];
  const warnings = item.warnings || [];
  const hardBlocks = reasons.filter((reason) => /non buteuse|non encaissant|preuves? .*insuffisantes?|force historique insuffisant|enjeu .*non d[eé]montr[eé]|faux enjeu/i.test(reason)).length;

  if (hardBlocks >= 3 || item.status === "NO_BET") {
    return { icon: "🔴", label: "NO BET", detail: "refus clair du moteur" };
  }
  if (hardBlocks >= 2 || warnings.length >= 2) {
    return { icon: "🟠", label: "RISQUÉ", detail: "trop de voyants faibles" };
  }
  return { icon: "🟡", label: "À SURVEILLER", detail: "proche, mais pas assez propre" };
}

function adminCountryEmoji(country) {
  const flags = {
    Argentina: "🇦🇷", Austria: "🇦🇹", Belgium: "🇧🇪", Brazil: "🇧🇷", Croatia: "🇭🇷",
    Denmark: "🇩🇰", England: "🏴", France: "🇫🇷", Germany: "🇩🇪", Greece: "🇬🇷",
    Italy: "🇮🇹", Japan: "🇯🇵", Netherlands: "🇳🇱", Norway: "🇳🇴", Poland: "🇵🇱",
    Portugal: "🇵🇹", Scotland: "🏴", "South Korea": "🇰🇷", Spain: "🇪🇸", Sweden: "🇸🇪",
    Switzerland: "🇨🇭", Turkey: "🇹🇷",
  };
  return flags[country] || "🌍";
}

function adminCheckLine(ok, label, detail = "") {
  return `${ok ? "✅" : "❌"} ${label}${detail ? ` - ${detail}` : ""}`;
}

function adminCriteriaLines(item) {
  const ev = item.evidence || {};
  const strength = ev.fiveYearStrength || {};
  const recent = ev.recent || {};
  const stake = ev.stake || {};
  const bestOdd = item.bestOdd?.odd || ev.market?.bestOdd || null;
  const teamPct = Number(strength.teamPercentile);
  const opponentPct = Number(strength.opponentPercentile);
  const gap = Number.isFinite(teamPct) && Number.isFinite(opponentPct) ? Math.round(teamPct - opponentPct) : null;

  return [
    adminCheckLine(ev.competitionType === "league", "Championnat uniquement", item.league || ev.league || ""),
    adminCheckLine(strength.levelTableLoaded === true && Number(strength.seasonsAvailable || 0) >= 3 && gap !== null && gap >= 40, "Force historique", gap !== null ? `écart ${gap} pts` : "non prouvée"),
    adminCheckLine(stake.teamHasMeaningfulObjective === true && stake.sameZoneAfterResult !== true, "Enjeu réel"),
    adminCheckLine(Number(recent.scoredInLastFive) >= 5, "Buteur 5/5", `${Number(recent.scoredInLastFive || 0)}/5`),
    adminCheckLine(Number(recent.opponentConcededInLastFive) >= 5, "Adversaire encaisse 5/5", `${Number(recent.opponentConcededInLastFive || 0)}/5`),
    adminCheckLine(Number(recent.weightedConstructedGoals) >= 3, "Buts assistés/construits", `${Number(recent.weightedConstructedGoals || 0)} preuve(s)`),
    adminCheckLine(Boolean(bestOdd && Number(bestOdd) >= 1.30), "Cote ANJ", bestOdd ? `@${bestOdd}` : "absente"),
  ];
}
function formatAdminWatchlistMessage({ date, report }) {
  const items = adminWatchlistItems(report, Number(process.env.GOAL05_ADMIN_WATCHLIST_LIMIT || 5));
  const lines = [
    `🧪 WATCHLIST ADMIN Goal +0,5 - ${date}`,
    "",
    `Analyse: ${report.summary.total} candidat(s), ${report.summary.eligible} éligible(s), ${report.summary.noBet} refusé(s), ${report.summary.sent} envoyé(s).`,
    "",
  ];

  if (!items.length) {
    lines.push("Aucun refus intéressant à surveiller sur ce scan.");
  } else {
    for (const item of items) {
      const verdict = adminVerdict(item);
      const ev = item.evidence || {};
      const country = item.country || ev.country || "Pays inconnu";
      const league = item.league || ev.league || "Championnat inconnu";
      lines.push(`${verdict.icon} ${verdict.label} - ${compact(item.match, 80)}`);
      lines.push(`${adminCountryEmoji(country)} ${country} - ${league}`);
      lines.push(`Équipe visée: ${compact(item.team, 40)} +0,5 | cote @${item.bestOdd.odd}`);
      if (item.homeLogo || item.awayLogo) lines.push(`Fanions: ${item.homeLogo || "n/d"} | ${item.awayLogo || "n/d"}`);
      if (item.leagueLogo) lines.push(`Logo ligue: ${item.leagueLogo}`);
      lines.push(`Lecture rapide: ${verdict.detail}`);
      lines.push("Critères:");
      for (const line of adminCriteriaLines(item)) lines.push(line);
      const reasons = (item.reasons || item.rejections || []).slice(0, 4);
      if (reasons.length) lines.push("Pourquoi refus / vigilance:");
      for (const reason of reasons) lines.push(`- ${compact(reason, 160)}`);
      for (const warning of (item.warnings || []).slice(0, 2)) lines.push(`⚠ ${compact(warning, 160)}`);
      lines.push("");
    }
  }

  lines.push("Note: message admin uniquement. Aucun envoi client tant que le moteur ne valide pas tous les critères.");
  return lines.join("\n");
}
async function sendAdminWatchlist({ date, report }) {
  if (process.env.GOAL05_SEND_ADMIN_WATCHLIST !== "1") return { sent: false, reason: "disabled" };
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_GOAL05_ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return { sent: false, reason: "missing_admin_telegram_config" };
  const text = formatAdminWatchlistMessage({ date, report });
  await postTelegram({ token, chatId, text });
  return { sent: true, chatId };
}

async function api(pathname) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY absent");

  const delayMs = Number(process.env.GOAL05_API_DELAY_MS || 1400);
  const retryWaitMs = Number(process.env.GOAL05_RATE_LIMIT_WAIT_MS || 65000);
  const maxRetries = Number(process.env.GOAL05_API_RETRIES || 2);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const elapsed = Date.now() - lastApiCallAt;
    if (elapsed < delayMs) await sleep(delayMs - elapsed);
    lastApiCallAt = Date.now();

    const response = await fetch(`${API_BASE}${pathname}`, { headers: { "x-apisports-key": key } });
    const json = await response.json();
    const errors = json.errors && Object.keys(json.errors).length ? json.errors : {};
    const rateLimited = Boolean(errors.rateLimit) || response.status === 429;

    if (rateLimited && attempt < maxRetries) {
      console.log(`[goal05-api] rate limit, pause ${Math.round(retryWaitMs / 1000)}s avant retry ${attempt + 1}/${maxRetries}: ${pathname}`);
      await sleep(retryWaitMs);
      continue;
    }

    if (!response.ok || Object.keys(errors).length) {
      throw new Error(`API-Football ${pathname}: ${response.status} ${JSON.stringify(errors)}`);
    }
    return json;
  }

  throw new Error(`API-Football ${pathname}: retries epuises`);
}

function listCacheFiles(dir = CACHE_ROOT) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listCacheFiles(full);
    return entry.isFile() && entry.name.endsWith(".json") && entry.name !== "summary.json" ? [full] : [];
  });
}

function loadHistoricalCaches() {
  return listCacheFiles().map((file) => {
    const data = readJson(file);
    const country = COUNTRY_ALIASES.get(data.country) || data.country;
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return { file, country, league: data.league, rows };
  }).filter((cache) => cache.rows.length);
}

function findCache(caches, country, league) {
  const nc = normalize(country);
  const nl = normalize(league);
  return caches.find((cache) => normalize(cache.country) === nc && normalize(cache.league) === nl)
    || caches.find((cache) => normalize(cache.country) === nc && (normalize(cache.league).includes(nl) || nl.includes(normalize(cache.league))))
    || null;
}

function findTeamRow(cache, teamName) {
  if (!cache) return null;
  const nt = normalize(teamName);
  return cache.rows.find((row) => normalize(row.team) === nt)
    || cache.rows.find((row) => normalize(row.team).includes(nt) || nt.includes(normalize(row.team)))
    || null;
}

function percentile(row, cache) {
  if (!row) return null;
  if (Number.isFinite(Number(row.historical_percentile))) return Number(row.historical_percentile);
  if (Number.isFinite(Number(row.historical_rank)) && cache?.rows?.length > 1) {
    return Math.round((1 - (Number(row.historical_rank) - 1) / (cache.rows.length - 1)) * 10000) / 100;
  }
  return null;
}

function seasons(row) {
  return Number(row?.seasons_available || 0);
}

function findTeamGoalOver05Offers(bookmakers, side) {
  const offers = [];
  for (const bookmaker of bookmakers || []) {
    for (const bet of bookmaker.bets || []) {
      const betName = normalize(bet.name);
      const isTeamScoreMarket = betName.includes("team to score") || betName.includes("team total") || betName.includes("home away team total") || betName.includes("total goals team");
      if (!isTeamScoreMarket) continue;
      for (const value of bet.values || []) {
        const label = normalize(value.value);
        const hasOver05 = label.includes("over 0 5") || label.includes("plus 0 5") || label.includes("more than 0 5");
        if (!hasOver05) continue;
        const isHome = label.includes("home") || label.includes("domicile") || label.includes("1");
        const isAway = label.includes("away") || label.includes("exterieur") || label.includes("2");
        if (side === "home" && isAway) continue;
        if (side === "away" && isHome) continue;
        const odd = Number(String(value.odd || "").replace(",", "."));
        if (Number.isFinite(odd)) {
          offers.push({ bookmaker: bookmaker.name, betName: bet.name, value: value.value, odd });
        }
      }
    }
  }
  offers.sort((a, b) => b.odd - a.odd);
  return offers;
}

function toEngineOdds(offers) {
  return {
    fetchedAt: new Date().toISOString(),
    arjelBookmakers: offers.map((offer) => ({
      name: offer.bookmaker || "ANJ/API-Football",
      bets: [{ name: offer.betName || "Team to score over 0.5", values: [{ value: offer.value || "Over 0.5", odd: offer.odd }] }],
    })),
  };
}

function countGoals(fixtures, teamId, conceded = false) {
  let count = 0;
  for (const item of fixtures || []) {
    const home = item.teams?.home?.id;
    const away = item.teams?.away?.id;
    const homeGoals = Number(item.goals?.home ?? 0);
    const awayGoals = Number(item.goals?.away ?? 0);
    if (home === teamId) count += conceded ? (awayGoals > 0 ? 1 : 0) : (homeGoals > 0 ? 1 : 0);
    if (away === teamId) count += conceded ? (homeGoals > 0 ? 1 : 0) : (awayGoals > 0 ? 1 : 0);
  }
  return count;
}

async function countConstructedGoalsWithAssists(fixtures, teamId, maxEventCalls) {
  let assisted = 0;
  let calls = 0;
  for (const fixture of fixtures.slice(0, maxEventCalls)) {
    if (calls >= maxEventCalls) break;
    const fixtureId = fixture.fixture?.id;
    if (!fixtureId) continue;
    calls += 1;
    const events = await api(`/fixtures/events?fixture=${fixtureId}&team=${teamId}&type=Goal`);
    for (const event of events.response || []) {
      if (event.team?.id !== teamId) continue;
      const detail = normalize(event.detail);
      if (detail.includes("penalty") || detail.includes("own goal")) continue;
      if (event.assist?.id || event.assist?.name) assisted += 1;
    }
  }
  return { assisted, calls };
}

async function buildApiCandidates() {
  const date = process.env.GOAL05_SCAN_DATE || todayParis();
  const timezone = process.env.GOAL05_TIMEZONE || "Europe/Paris";
  const maxOddsPages = Number(process.env.GOAL05_ODDS_PAGES || 1);
  const maxDeepCandidates = Number(process.env.GOAL05_MAX_DEEP_CANDIDATES || 3);
  const maxEventCalls = Number(process.env.GOAL05_MAX_EVENT_CALLS || 5);
  const caches = loadHistoricalCaches();

  const oddsResponses = [];
  for (let page = 1; page <= maxOddsPages; page += 1) {
    const odds = await api(`/odds?date=${date}&timezone=${encodeURIComponent(timezone)}&page=${page}`);
    oddsResponses.push(odds);
    if (!odds.paging || page >= Number(odds.paging.total || page)) break;
  }

  const oddsRows = oddsResponses.flatMap((r) => r.response || []);
  const fixtureIds = [...new Set(oddsRows.map((row) => row.fixture?.id).filter(Boolean))].slice(0, 20);
  const fixturesById = new Map();
  if (fixtureIds.length) {
    const details = await api(`/fixtures?ids=${fixtureIds.join("-")}&timezone=${encodeURIComponent(timezone)}`);
    for (const item of details.response || []) fixturesById.set(item.fixture?.id, item);
  }

  const candidates = [];
  const rejected = [];

  for (const oddsRow of oddsRows) {
    if (candidates.length >= maxDeepCandidates) break;
    const fixture = fixturesById.get(oddsRow.fixture?.id);
    const league = fixture?.league || oddsRow.league || {};
    const country = league.country;
    if (!ALLOWED_COUNTRIES.has(country)) {
      rejected.push({ fixture: oddsRow.fixture?.id, reason: "country_not_allowed", country, league: league.name });
      continue;
    }
    if (league.type && league.type !== "League") {
      rejected.push({ fixture: oddsRow.fixture?.id, reason: "not_league", country, league: league.name, type: league.type });
      continue;
    }

    const home = fixture?.teams?.home;
    const away = fixture?.teams?.away;
    if (!home?.id || !away?.id) {
      rejected.push({ fixture: oddsRow.fixture?.id, reason: "fixture_teams_missing", country, league: league.name });
      continue;
    }

    const cache = findCache(caches, country, league.name);
    const homeRow = findTeamRow(cache, home.name);
    const awayRow = findTeamRow(cache, away.name);
    const homePct = percentile(homeRow, cache);
    const awayPct = percentile(awayRow, cache);
    if (!cache || homePct === null || awayPct === null) {
      rejected.push({ fixture: oddsRow.fixture?.id, reason: "historical_cache_missing_or_team_unmatched", country, league: league.name, home: home.name, away: away.name });
      continue;
    }

    const teamSide = homePct >= awayPct ? "home" : "away";
    const team = teamSide === "home" ? home : away;
    const opponent = teamSide === "home" ? away : home;
    const teamPct = teamSide === "home" ? homePct : awayPct;
    const opponentPct = teamSide === "home" ? awayPct : homePct;
    const teamRow = teamSide === "home" ? homeRow : awayRow;
    const opponentRow = teamSide === "home" ? awayRow : homeRow;

    const offers = findTeamGoalOver05Offers(oddsRow.bookmakers, teamSide);
    if (!offers.length) {
      rejected.push({ fixture: oddsRow.fixture?.id, reason: "team_over_05_market_missing", country, league: league.name, home: home.name, away: away.name, stronger: team.name });
      continue;
    }

    const [teamLast, opponentLast, standings] = await Promise.all([
      api(`/fixtures?team=${team.id}&last=5&status=FT&timezone=${encodeURIComponent(timezone)}`),
      api(`/fixtures?team=${opponent.id}&last=5&status=FT&timezone=${encodeURIComponent(timezone)}`),
      api(`/standings?league=${league.id}&season=${league.season}`),
    ]);

    const teamLastFixtures = teamLast.response || [];
    const opponentLastFixtures = opponentLast.response || [];
    const assisted = await countConstructedGoalsWithAssists(teamLastFixtures, team.id, maxEventCalls);
    const table = standings.response?.[0]?.league?.standings?.[0] || [];
    const teamStanding = table.find((row) => row.team?.id === team.id);
    const opponentStanding = table.find((row) => row.team?.id === opponent.id);
    const rankGap = Number(opponentStanding?.rank || 999) - Number(teamStanding?.rank || 999);
    const teamTopFive = Number(teamStanding?.rank || 999) <= 5;
    const opponentBottomFive = Number(opponentStanding?.rank || 0) >= Math.max(1, table.length - 4);

    candidates.push({
      id: `api-football-${oddsRow.fixture?.id}-${teamSide}`,
      matchId: oddsRow.fixture?.id,
      date,
      country,
      league: league.name,
      leagueLogo: league.logo || null,
      competitionType: "league",
      home: home.name,
      away: away.name,
      homeLogo: home.logo || null,
      awayLogo: away.logo || null,
      team: team.name,
      opponent: opponent.name,
      teamLogo: team.logo || null,
      opponentLogo: opponent.logo || null,
      teamSide,
      source: "api-football",
      fiveYearStrength: {
        levelTableLoaded: true,
        seasonsAvailable: Math.min(seasons(teamRow), seasons(opponentRow)) || seasons(teamRow) || seasons(opponentRow),
        teamPercentile: teamPct,
        opponentPercentile: opponentPct,
        historicalCacheStatus: teamRow.data_status || opponentRow.data_status || "OK",
        cacheFile: cache.file,
      },
      recent: {
        recentMatchesOrder: "oldest_to_newest",
        scoredInLastFive: countGoals(teamLastFixtures, team.id, false),
        opponentConcededInLastFive: countGoals(opponentLastFixtures, opponent.id, true),
        weightedConstructedGoals: assisted.assisted,
        scoringState: countGoals(teamLastFixtures, team.id, false) >= 5 ? "yes" : "no",
        opponentConcedesState: countGoals(opponentLastFixtures, opponent.id, true) >= 5 ? "yes" : "no",
        goal05SpecificEvidence: assisted.assisted >= 3 ? "yes" : "no",
        candidateCanReproduceConcessionPattern: true,
        candidateLevelMatchesPriorScorers: true,
        assistedGoalsCheckedFixtures: assisted.calls,
      },
      stake: {
        teamHasMeaningfulObjective: teamTopFive || rankGap >= 5,
        sameZoneAfterResult: !(teamTopFive && opponentBottomFive) && rankGap < 5,
        stakeTeamIsStrongerSide: true,
        currentRank: teamStanding?.rank || null,
        opponentRank: opponentStanding?.rank || null,
        leagueSize: table.length || null,
      },
      odds: toEngineOdds(offers),
    });
  }

  return { date, timezone, oddsRows: oddsRows.length, fixtureIds: fixtureIds.length, candidates, rejected };
}

async function main() {
  const generated = await buildApiCandidates();
  fs.mkdirSync(ANALYSES_DIR, { recursive: true });
  const candidateFile = path.join(ANALYSES_DIR, `${generated.date}-goal05-api-candidates.json`);
  const auditFile = path.join(ANALYSES_DIR, `${generated.date}-goal05-api-audit.json`);
  writeJson(candidateFile, generated.candidates);
  writeJson(auditFile, generated);

  const report = await runScan({ candidates: generated.candidates, sourceFile: candidateFile });
  const adminWatchlist = await sendAdminWatchlist({ date: generated.date, report });
  const reportFile = path.join(ANALYSES_DIR, `${generated.date}-goal05-api-scan-summary.json`);
  writeJson(reportFile, { ...report, adminWatchlist });

  console.log(JSON.stringify({
    date: generated.date,
    oddsRows: generated.oddsRows,
    fixtureIds: generated.fixtureIds,
    candidates: generated.candidates.length,
    rejected: generated.rejected.length,
    eligible: report.summary.eligible,
    needsData: report.summary.needsData,
    noBet: report.summary.noBet,
    watchlist: report.summary.watchlist,
    sent: report.summary.sent,
    adminWatchlist,
    sendTelegram: report.summary.sendTelegram,
    telegramConfigured: report.summary.telegramConfigured,
    candidateFile,
    auditFile,
    reportFile,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { adminVerdict, buildApiCandidates, findTeamGoalOver05Offers, formatAdminWatchlistMessage, loadHistoricalCaches };
