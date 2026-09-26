"use strict";

const fs = require("fs");
const source = fs.readFileSync(require("path").join(__dirname, "api_server.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  source.includes('const AUTO_CONCILE_REAL_ODDS_ONLY = process.env.AUTO_CONCILE_REAL_ODDS_ONLY !== "0";'),
  "le filtre de vraies cotes doit rester actif par defaut"
);
assert(
  source.includes("async function isBookmakerPlayableBeforeAnalysis(match)"),
  "le portail bookmaker doit exister"
);
const prefilterStart = source.indexOf("async function isBookmakerPlayableBeforeAnalysis(match)");
const prefilterEnd = source.indexOf("\nasync function runAutoConcileObserver()", prefilterStart);
const prefilter = source.slice(prefilterStart, prefilterEnd);
assert(
  prefilterStart >= 0 && !prefilter.includes("if (!oddsData?.arjelBookmakers?.length)"),
  "l'absence de bookmaker ARJEL ne doit plus bloquer avant analyse"
);
assert(
  source.includes("const diffusable = bookmakerPlayable && oddOk && sportDiffusable"),
  "la diffusion doit exiger une vraie cote bookmaker"
);
assert(
  source.includes("if (!rowHasRealBookmakerOdd(r)) return false;"),
  "les statistiques de palier doivent refleter la nouvelle regle"
);
assert(
  source.includes("voteCountForSignal >= requiredVotesForSignal"),
  "le quorum client configure doit rester present"
);
assert(
  source.includes("const officialWindowEligible = liveStateCoherence.analysisWindow(match).open;"),
  "la fenetre officielle verifiee de premiere mi-temps doit rester presente"
);
assert(
  /function rowHasRealBookmakerOdd\(r\)[\s\S]*?!\/estimation\/i\.test\(source\)/.test(source),
  "une estimation ne doit jamais compter comme cote bookmaker reelle"
);

console.log("OK — filtre élargi aux vraies cotes bookmaker, garde-fous conservés");
