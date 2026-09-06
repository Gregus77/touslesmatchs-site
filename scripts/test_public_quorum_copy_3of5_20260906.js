"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = [
  "public/index.html",
  "public/faq.html",
  "public/js/i18n.js",
  "public/app.html",
];

const publicCopy = files
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");
const apiSource = fs.readFileSync(path.join(root, "scripts/api_server.js"), "utf8");

const obsoleteMinimums = [
  /minimum (?:de )?4 (?:IA )?(?:sur|de) 5/i,
  /au moins 4 votes sur 5/i,
  /at least 4 of 5 AIs agree/i,
  /m[ií]nimo(?: de)? 4 de 5 IA/i,
  /минимум 4 из 5 ИИ/i,
  /5 个 AI 中有 4 个/,
];

for (const pattern of obsoleteMinimums) {
  assert.doesNotMatch(publicCopy, pattern, `ancien minimum public détecté: ${pattern}`);
}

assert.match(publicCopy, /Accord minimum de 3 sur 5/);
assert.match(publicCopy, /Minimum 3 IA sur 5 d'accord sur Over\/Under 2,5/);
assert.match(publicCopy, /au moins 3 votes sur 5 sur Over\/Under 2,5/);

console.log("OK: site et application ne présentent plus 4/5 comme minimum public");
