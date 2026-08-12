"use strict";

/*
 * Shadow-only audit for Goal 0.5 IA API coverage.
 *
 * This script does not send Telegram messages, does not call paid AI models,
 * and does not modify production state. It only checks API-Football live odds
 * coverage when API_SPORTS_KEY or API_FOOTBALL_KEY is present in the process
 * environment.
 */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || "";
const BASE = "https://v3.football.api-sports.io";

const TARGET_LEAGUES = [
  { id: 61, country: "France", league: "Ligue 1" },
  { id: 62, country: "France", league: "Ligue 2" },
  { id: 39, country: "England", league: "Premier League" },
  { id: 40, country: "England", league: "Championship" },
  { id: 140, country: "Spain", league: "La Liga" },
  { id: 141, country: "Spain", league: "Segunda Division" },
  { id: 78, country: "Germany", league: "Bundesliga" },
  { id: 79, country: "Germany", league: "2. Bundesliga" },
  { id: 135, country: "Italy", league: "Serie A" },
  { id: 136, country: "Italy", league: "Serie B" },
  { id: 88, country: "Netherlands", league: "Eredivisie" },
  { id: 89, country: "Netherlands", league: "Eerste Divisie" },
  { id: 144, country: "Belgium", league: "Jupiler Pro League" },
  { id: 94, country: "Portugal", league: "Primeira Liga" },
  { id: 128, country: "Argentina", league: "Liga Profesional Argentina" },
  { id: 71, country: "Brazil", league: "Serie A" },
  { id: 72, country: "Brazil", league: "Serie B" },
];

const ANJ_BOOKMAKER_HINTS = [
  "betclic", "winamax", "unibet", "parionssport", "parions sport",
  "pmu", "zebet", "vbet", "genybet", "bwin", "betsson", "netbet", "france pari",
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksLikeTeamOver05Bet(betName, valueName) {
  const bet = normalizeText(betName);
  const value = normalizeText(valueName);
  const teamMarket = (
    bet.includes("team total") ||
    bet.includes("team goals") ||
    bet.includes("team to score") ||
    bet.includes("team score")
  );
  const over05 = value.includes("over 0 5") || value.includes("plus 0 5") || value.includes("0 5");
  return teamMarket && over05;
}

function isAnjBookmaker(name) {
  const n = normalizeText(name);
  return ANJ_BOOKMAKER_HINTS.some((hint) => n.includes(normalizeText(hint)));
}

async function apiGet(endpoint, params = {}) {
  const url = new URL(BASE + endpoint);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  const json = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    endpoint,
    params,
    rateLimit: {
      limit: response.headers.get("x-ratelimit-limit"),
      remaining: response.headers.get("x-ratelimit-remaining"),
    },
    json,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const report = {
    product: "GOAL 0.5 IA",
    mode: "shadow_api_coverage_audit",
    startedAt,
    keyPresent: Boolean(API_KEY),
    targetLeagues: TARGET_LEAGUES,
    liveBets: [],
    leagueChecks: [],
    findings: [],
    errors: [],
  };

  if (!API_KEY) {
    report.errors.push("API_SPORTS_KEY/API_FOOTBALL_KEY absent from process environment.");
    writeReport(report);
    console.log("[goal05-api-audit] No API key present. Report written without live calls.");
    return;
  }

  const liveBets = await apiGet("/odds/live/bets");
  report.liveBets = liveBets.json?.response || [];
  report.liveBetsCandidateNames = report.liveBets
    .filter((bet) => /team|score|goal/i.test(String(bet.name || "")))
    .map((bet) => ({ id: bet.id, name: bet.name }));

  for (const league of TARGET_LEAGUES) {
    const liveOdds = await apiGet("/odds/live", { league: league.id });
    const rows = liveOdds.json?.response || [];
    const check = {
      league,
      httpStatus: liveOdds.status,
      apiResults: liveOdds.json?.results ?? null,
      rateLimit: liveOdds.rateLimit,
      fixtures: rows.length,
      goal05Offers: [],
      blocked: 0,
      stopped: 0,
      finished: 0,
    };

    for (const row of rows) {
      if (row.status?.blocked) check.blocked += 1;
      if (row.status?.stopped) check.stopped += 1;
      if (row.status?.finished) check.finished += 1;
      for (const bookmaker of row.bookmakers || []) {
        for (const bet of bookmaker.bets || []) {
          for (const value of bet.values || []) {
            if (!looksLikeTeamOver05Bet(bet.name, value.value)) continue;
            check.goal05Offers.push({
              fixture: row.fixture?.id || null,
              elapsed: row.fixture?.status?.elapsed || null,
              update: row.update || null,
              bookmaker: bookmaker.name || null,
              bookmakerLooksAnj: isAnjBookmaker(bookmaker.name),
              betId: bet.id || null,
              betName: bet.name || null,
              selection: value.value || null,
              odd: value.odd || null,
              main: value.main ?? null,
              status: row.status || null,
            });
          }
        }
      }
    }
    report.leagueChecks.push(check);
  }

  report.findings.push({
    type: "goal05_offer_count",
    count: report.leagueChecks.reduce((sum, item) => sum + item.goal05Offers.length, 0),
  });
  writeReport(report);
  console.log("[goal05-api-audit] Report written.");
}

function writeReport(report) {
  report.finishedAt = new Date().toISOString();
  const outDir = path.join(__dirname, "..", "docs", "goal-05", "api-audit-runs");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `${stamp}-goal05-api-coverage.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(outPath);
}

main().catch((error) => {
  console.error("[goal05-api-audit]", error.message);
  process.exitCode = 1;
});
