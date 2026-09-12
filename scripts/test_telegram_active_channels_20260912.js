#!/usr/bin/env node
"use strict";

const fs = require("fs");
const assert = require("assert");
const src = fs.readFileSync(require("path").join(__dirname, "api_server.js"), "utf8");

assert.match(src, /const requiredTelegramChannels = channels\.map\(\(\[requiredLabel\]\) => requiredLabel\.toLowerCase\(\)\);/);
assert.match(src, /\["FR Gratuit",\s*TELEGRAM_CHANNEL_ID\]/);
assert.match(src, /\["FR Premium 14,90 €",\s*TELEGRAM_PREMIUM_CHANNEL_ID\]/);
assert.match(src, /\["RU Gratuit",\s*TELEGRAM_RU_FREE_CHANNEL_ID\]/);
assert.match(src, /\["RU Premium 14,90 €",\s*TELEGRAM_RU_PREMIUM_CHANNEL_ID\]/);
assert.doesNotMatch(src, /\["Standard",\s*TELEGRAM_STANDARD_CHANNEL_ID\]/);
assert.doesNotMatch(src, /\["RU Standard",\s*TELEGRAM_RU_STANDARD_CHANNEL_ID\]/);
assert.match(src, /providers\.sort\(\(a, b\) => Number\(!isOpenRouterUrl\(a\.url\)\) - Number\(!isOpenRouterUrl\(b\.url\)\)\)/);

console.log("OK: 4 canaux clients Telegram + Admin; anciens Standard exclus; OpenRouter prioritaire");
