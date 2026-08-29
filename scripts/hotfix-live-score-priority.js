#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const target = path.join(__dirname, "api_server.js");
let source = fs.readFileSync(target, "utf8");

if (source.includes("HOTFIX LIVE 2026-08-29: API-Sports source de verite")) {
  console.log("HOTFIX_ALREADY_APPLIED");
  process.exit(0);
}

function replaceOnce(label, oldText, newText) {
  const first = source.indexOf(oldText);
  if (first < 0) throw new Error(`ANCHOR_NOT_FOUND:${label}`);
  if (source.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`ANCHOR_NOT_UNIQUE:${label}`);
  source = source.slice(0, first) + newText + source.slice(first + oldText.length);
}

const oldLateHelper = [
  'function isFinishedOrTooLateForLiveIa(match) {',
  '  const status = String(match?.status || "").toUpperCase();',
  '  if (["CANCELLED", "POSTPONED"].includes(status)) return true;',
  '  if (["SCHEDULED", "TIMED"].includes(status)) return false;',
  '  if (["FINISHED", "FT", "AET", "PEN", "ENDED"].includes(status)) return true;',
  '',
  '  // Statut réel porté par "minute" quand la source a écrasé "status" à IN_PLAY.',
  '  const rawMinute = String(match?.minute ?? "").trim().toUpperCase();',
  '  if (rawMinute && NON_LIVE_RAW_STATUSES.has(rawMinute)) return true;',
  '',
  '  const minute = parseLiveMinuteValue(match?.minute);',
  '  return match?.sport === "Football" && minute !== null && minute >= 85;',
  '}',
].join("\n");

const newLateHelper = [
  'function isFinishedOrTooLateForLiveIa(match) {',
  '  const status = String(match?.status || "").toUpperCase();',
  '  if (["CANCELLED", "POSTPONED"].includes(status)) return true;',
  '  if (["SCHEDULED", "TIMED"].includes(status)) return false;',
  '  if (["FINISHED", "FT", "AET", "PEN", "ENDED"].includes(status)) return true;',
  '',
  '  // Statut réel porté par "minute" quand la source a écrasé "status" à IN_PLAY.',
  '  const rawMinute = String(match?.minute ?? "").trim().toUpperCase();',
  '  if (rawMinute && NON_LIVE_RAW_STATUSES.has(rawMinute)) return true;',
  '',
  '  const minute = parseLiveMinuteValue(match?.minute);',
  '  return match?.sport === "Football" && minute !== null && minute >= 85;',
  '}',
  '',
  '// HOTFIX LIVE 2026-08-29: API-Sports source de verite.',
  '// Le match doit rester visible a 90+; seule l analyse IA s arrete a sa limite.',
  'function isFinishedOrUnavailableForLiveDisplay(match) {',
  '  const status = String(match?.status || "").toUpperCase();',
  '  if (["CANCELLED", "POSTPONED"].includes(status)) return true;',
  '  if (["SCHEDULED", "TIMED"].includes(status)) return false;',
  '  if (["FINISHED", "FT", "AET", "PEN", "ENDED"].includes(status)) return true;',
  '  const rawMinute = String(match?.minute ?? "").trim().toUpperCase();',
  '  return !!(rawMinute && NON_LIVE_RAW_STATUSES.has(rawMinute));',
  '}',
].join("\n");
replaceOnce("display-vs-ia-late-helper", oldLateHelper, newLateHelper);

const oldMerge = [
  '  const fdSourceId = previous.source === "football-data" ? previous.sourceId : previous.fdSourceId;',
  '  if (!carriesOddsIdentity(previous) || carriesOddsIdentity(incoming)) {',
  '    return fdSourceId ? { ...incoming, fdSourceId } : incoming;',
  '  }',
  '  return {',
  '    ...previous,',
  '    score_home: incoming.score_home ?? previous.score_home,',
  '    score_away: incoming.score_away ?? previous.score_away,',
  '    minute:     incoming.minute     ?? previous.minute,',
  '    status:     incoming.status     ?? previous.status,',
  '  };',
].join("\n");

const newMerge = [
  '  const fdSourceId = previous.source === "football-data" ? previous.sourceId',
  '    : incoming.source === "football-data" ? incoming.sourceId',
  '      : previous.fdSourceId || incoming.fdSourceId;',
  '  const previousIsApiSports = carriesOddsIdentity(previous);',
  '  const incomingIsApiSports = carriesOddsIdentity(incoming);',
  '',
  '  // API-Sports payant est prioritaire pour score/minute/statut. Une source',
  '  // secondaire peut seulement completer un champ manquant, jamais le faire regresser.',
  '  if (previousIsApiSports && !incomingIsApiSports) {',
  '    return {',
  '      ...previous,',
  '      ...(fdSourceId ? { fdSourceId } : {}),',
  '      score_home: previous.score_home ?? incoming.score_home,',
  '      score_away: previous.score_away ?? incoming.score_away,',
  '      minute: previous.minute ?? incoming.minute,',
  '      status: previous.status ?? incoming.status,',
  '    };',
  '  }',
  '  if (incomingIsApiSports) {',
  '    return {',
  '      ...incoming,',
  '      ...(fdSourceId ? { fdSourceId } : {}),',
  '      score_home: incoming.score_home ?? previous.score_home,',
  '      score_away: incoming.score_away ?? previous.score_away,',
  '      minute: incoming.minute ?? previous.minute,',
  '      status: incoming.status ?? previous.status,',
  '    };',
  '  }',
  '  return fdSourceId ? { ...incoming, fdSourceId } : incoming;',
].join("\n");
replaceOnce("api-sports-authoritative-merge", oldMerge, newMerge);

const previousAnchor = '      const previous = merged[existingIndex];\n';
const authoritativeBlock = [
  '      const previous = merged[existingIndex];',
  '      // Si API-Sports connait le match, ses donnees live sont l autorite.',
  '      // Football-Data/TheSportsDB restent des secours et ne peuvent plus ecraser',
  '      // un score ou une minute API-Sports avec une valeur plus ancienne.',
  '      const apiSportsTruth = carriesOddsIdentity(previous)',
  '        ? previous',
  '        : (carriesOddsIdentity(apiMatch) ? apiMatch : null);',
  '      if (apiSportsTruth) {',
  '        const secondary = apiSportsTruth === previous ? apiMatch : previous;',
  '        merged[existingIndex] = {',
  '          ...mergeKeepingOddsIdentity(previous, apiMatch),',
  '          score_home: apiSportsTruth.score_home ?? secondary.score_home,',
  '          score_away: apiSportsTruth.score_away ?? secondary.score_away,',
  '          minute: apiSportsTruth.minute ?? secondary.minute,',
  '          status: apiSportsTruth.status ?? secondary.status,',
  '          scoreConflict: false,',
  '          scoreConflictSources: null,',
  '        };',
  '        continue;',
  '      }',
].join("\n") + "\n";
replaceOnce("api-sports-early-authority", previousAnchor, authoritativeBlock);

replaceOnce(
  "cache-enrichment-must-not-reset-primary-age",
  '    liveMatchesCache = { data: enrichedMatches, ts: Date.now() };',
  '    // Ne jamais repousser ici le prochain refresh API-Sports : le timestamp reste celui du fetch primaire.\n    liveMatchesCache = { ...liveMatchesCache, data: enrichedMatches };'
);

replaceOnce(
  "late-live-cache-display",
  '      .filter(m => !isFinishedOrTooLateForLiveIa(m));',
  '      .filter(m => !isFinishedOrUnavailableForLiveDisplay(m));'
);

replaceOnce(
  "late-live-full-fetch-display",
  '  const visibleMatches = matches.filter(m => !isFinishedOrTooLateForLiveIa(m));',
  '  const visibleMatches = matches.filter(m => !isFinishedOrUnavailableForLiveDisplay(m));'
);

const backup = `${target}.before-live-score-hotfix`;
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
fs.writeFileSync(target, source, "utf8");
execFileSync(process.execPath, ["--check", target], { stdio: "inherit" });

console.log("HOTFIX_APPLIED_OK");
console.log("BACKUP=" + backup);
console.log("CHANGES=api-sports-authority,cache-primary-ttl-preserved,90plus-visible");
