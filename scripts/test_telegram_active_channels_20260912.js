#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const api = fs.readFileSync(path.join(__dirname, "api_server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "telegram_client.js"), "utf8");

// Les destinations client sont centralisées dans telegram_client.js.
// Vérifier les quatre canaux commerciaux actifs, pas une ancienne forme
// textuelle de la fonction /api/health.
assert.match(client, /channel:'free'[\s\S]{0,180}TELEGRAM_CHANNEL_ID/);
assert.match(client, /channel:'premium'[\s\S]{0,180}TELEGRAM_PREMIUM_CHANNEL_ID/);
assert.match(client, /channel:'ru_free'[\s\S]{0,180}TELEGRAM_RU_FREE_CHANNEL_ID/);
assert.match(client, /channel:'ru_premium'[\s\S]{0,180}TELEGRAM_RU_PREMIUM_CHANNEL_ID/);

// Standard/Elite ne doivent jamais redevenir des destinations commerciales.
const destinationsBlock = client.match(/function destinations\(env\) \{[\s\S]*?return all;\n\}/);
assert(destinationsBlock, "destinations() introuvable");
assert.doesNotMatch(destinationsBlock[0], /TELEGRAM_STANDARD_CHANNEL_ID|TELEGRAM_ELITE_CHANNEL_ID|TELEGRAM_RU_STANDARD_CHANNEL_ID/);

// L'API doit utiliser le publisher centralisé et conserver OpenRouter prioritaire.
assert.match(api, /telegramClient\.createPublisher\(/);
assert.match(api, /providers\.sort\(\(a, b\) =>[\s\S]{0,240}openrouter\.ai[\s\S]{0,240}openrouter\.ai[\s\S]{0,80}\);/);

console.log("OK: 4 canaux clients Telegram centralisés; Standard/Elite exclus; OpenRouter prioritaire");
