#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_GUIDE = path.join(ROOT, "docs", "telegram", "guide-marches-sportifs.md");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function uniqueChannels() {
  const channels = [
    ["Gratuit", process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_FREE_CHANNEL_ID || ""],
    ["Standard", process.env.TELEGRAM_STANDARD_CHANNEL_ID || ""],
    ["Premium", process.env.TELEGRAM_PREMIUM_CHANNEL_ID || ""],
    ["Elite", process.env.TELEGRAM_ELITE_CHANNEL_ID || ""],
  ];
  if (process.argv.includes("--include-admin")) {
    channels.push(["Admin", process.env.TELEGRAM_ADMIN_CHAT_ID || ""]);
  }
  const seen = new Set();
  return channels
    .filter(([, id]) => id && !seen.has(id) && seen.add(id))
    .map(([label, id]) => ({ label, id }));
}

function sendTelegram(token, chatId, text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ ok: parsed.ok === true, description: parsed.description || "" });
        } catch {
          resolve({ ok: false, description: data.slice(0, 200) });
        }
      });
    });
    req.on("error", (err) => resolve({ ok: false, description: err.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, description: "timeout" });
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  loadEnvFile(path.join(ROOT, ".env"));
  loadEnvFile("/opt/touslesmatchs/.env");

  const guidePath = path.resolve(argValue("file", DEFAULT_GUIDE));
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.HERMES_ADMIN_TLM_BOT || "";
  const text = fs.readFileSync(guidePath, "utf8").trim();
  const channels = uniqueChannels();
  const shouldSend = process.argv.includes("--yes");

  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant dans .env");
  if (!channels.length) throw new Error("Aucun canal Telegram configure");
  if (text.length > 4096) throw new Error(`Message trop long pour Telegram: ${text.length}/4096 caracteres`);

  console.log(`[telegram-guide] Fichier: ${guidePath}`);
  console.log(`[telegram-guide] Taille: ${text.length}/4096 caracteres`);
  console.log(`[telegram-guide] Canaux: ${channels.map((c) => c.label).join(", ")}`);

  if (!shouldSend) {
    console.log("[telegram-guide] Apercu seulement. Ajoute --yes pour envoyer.");
    console.log("\n--- MESSAGE ---\n");
    console.log(text);
    return;
  }

  let okCount = 0;
  for (const channel of channels) {
    const result = await sendTelegram(token, channel.id, text);
    if (result.ok) okCount++;
    console.log(`[telegram-guide] ${channel.label}: ${result.ok ? "OK" : "FAIL"}${result.description ? " - " + result.description : ""}`);
  }
  if (okCount !== channels.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`[telegram-guide] ERREUR: ${err.message}`);
  process.exit(1);
});
