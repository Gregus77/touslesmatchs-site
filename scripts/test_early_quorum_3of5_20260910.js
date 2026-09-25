#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "api_server.js"), "utf8");
const agents = ["Perplexity-Web", "DeepSeek-V3", "Mistral-Large", "Qwen-3.7-Max", "OpenRouter-Qwen"];
const start = source.indexOf("const CLIENT_OU25_MIN_VOTES = 3;");
const end = source.indexOf("// Un timeout ou une erreur HTTP", start);
const evaluatorStart = source.indexOf("function evaluateClientSignalCriteria");
const evaluatorEnd = source.indexOf("\n}\n", evaluatorStart) + 3;
assert(start >= 0 && end > start, "bloc quorum introuvable");
assert(evaluatorStart >= 0 && evaluatorEnd > evaluatorStart, "évaluateur production introuvable");
const sandbox = { process: { env: {} }, console, setTimeout, Promise };
vm.createContext(sandbox);
vm.runInContext("const CONCILE_AGENT_NAMES=" + JSON.stringify(agents) + ";\n" + source.slice(start, end) + "\n" + source.slice(evaluatorStart, evaluatorEnd) + "\nthis.collect=collectAgentsUntilOu25Quorum; this.summary=buildOu25VoteSummary; this.evaluate=evaluateClientSignalCriteria;", sandbox);

const vote = (name, direction, delay) => new Promise(resolve => setTimeout(() => resolve({
  name, bet: direction === "o2.5" ? "Over 2.5 buts" : direction === "u2.5" ? "Under 2.5 buts" : "—",
  confidence: direction ? 80 : null, failed: !direction,
  _ou25Markets: direction ? { buts: { p: direction, c: 80 } } : null,
}), delay));

(async () => {
  let settled = 0;
  const startAt = Date.now();
  const two = await sandbox.collect([
    vote(agents[0], "u2.5", 5), vote(agents[1], "u2.5", 10), vote(agents[2], null, 15),
  ], () => settled++);
  assert.equal(two.early, false);
  assert.equal(sandbox.summary(two.results.filter(x => x._ou25Markets).map(x => ({name:x.name,marches:x._ou25Markets})), two.results).recommended, false);

  let authorizations = 0;
  const three = await sandbox.collect([
    vote(agents[0], "u2.5", 5), vote(agents[1], "u2.5", 10), vote(agents[2], "u2.5", 15),
    new Promise(() => {}), new Promise(() => {}),
  ], () => {});
  const threeSummary = sandbox.summary(three.results.filter(x => x._ou25Markets).map(x => ({name:x.name,marches:x._ou25Markets})), three.results);
  const fullCriteriaBlock = sandbox.evaluate({
    blockTier:null,telegramConfigured:true,recoveryEnabled:true,recoveryOk:true,recoveryReason:"ok",
    matchEligible:true,maxMinute:45,ou25Only:true,enoughSeats:true,activeVotes:3,
    confidence:80,signalThreshold:77,minConfidence:77,voteCount:threeSummary.vote_count,requiredVotes:3,
    hasRealData:true,qualityOk:true,qualityReason:"ok",playableOk:true,playableReason:"ok",isWomen:false,lowTrust:false,
  });
  if (threeSummary.recommended && fullCriteriaBlock === null) authorizations++;
  assert.equal(three.early, true);
  assert.equal(three.results.length, 3);
  assert(Date.now() - startAt < 300, "le quorum a attendu les deux réponses lentes");
  assert.equal(authorizations, 1, "une seule décision/diffusion doit être autorisée");

  const divergent = await sandbox.collect([
    vote(agents[0], "u2.5", 5), vote(agents[1], "u2.5", 10), vote(agents[2], "o2.5", 15),
    vote(agents[3], null, 20), vote(agents[4], null, 25),
  ]);
  const divergentSummary = sandbox.summary(divergent.results.filter(x => x._ou25Markets).map(x => ({name:x.name,marches:x._ou25Markets})), divergent.results);
  assert.equal(divergentSummary.recommended, false);
  assert.equal(authorizations, 1);
  assert.equal(sandbox.evaluate({...{
    blockTier:null,telegramConfigured:true,recoveryEnabled:true,recoveryOk:true,recoveryReason:"ok",
    matchEligible:true,maxMinute:45,ou25Only:true,enoughSeats:true,activeVotes:3,confidence:76,
    signalThreshold:77,minConfidence:77,voteCount:3,requiredVotes:3,hasRealData:true,
    qualityOk:true,qualityReason:"ok",playableOk:true,playableReason:"ok",isWomen:false,lowTrust:false,
  }}), "confiance 76 < seuil 77");
  console.log("PASS: 3 votes déclenchent l'évaluateur production tandis que 2 réponses restent en attente; aucun Telegram");
})().catch(error => { console.error(error); process.exit(1); });
