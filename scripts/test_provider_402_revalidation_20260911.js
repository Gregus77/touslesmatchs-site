#!/usr/bin/env node
"use strict";

const fs = require("fs");
const assert = require("assert");
const src = fs.readFileSync("scripts/api_server.js", "utf8");

assert.match(src, /insufficientBalance = status === 402/);
assert.match(src, /solde: sonde unique dans 6 h/);
assert.match(src, /last_status=402 AND disabled_until<=datetime\('now'\)/);
assert.match(src, /DELETE FROM provider_health WHERE host=\? AND last_status=402/);
assert.match(src, /status === 401 \|\| \(status === 403/);
assert.match(src, /daily \? `\+\$\{secondsToNextUtcDay\} seconds`/);
assert.doesNotMatch(src, /status === 401 \|\| status === 402 \|\|/);
console.log("OK: 402=sonde unique/6h, 401=clé durable, quota journalier=lendemain UTC");
