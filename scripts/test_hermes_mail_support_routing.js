const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");

const apiServer = fs.readFileSync(path.join(__dirname, "api_server.js"), "utf8");

assert.ok(
  apiServer.includes('const TELEGRAM_SUPPORT_CHAT_ID = process.env.TELEGRAM_SUPPORT_CHAT_ID || "";'),
  "api_server.js doit declarer TELEGRAM_SUPPORT_CHAT_ID"
);

assert.ok(
  apiServer.includes("telegramAdminChatId: TELEGRAM_SUPPORT_CHAT_ID || TELEGRAM_ADMIN_CHAT_ID"),
  "les brouillons email Hermes doivent partir vers Support avant Admin"
);

console.log("hermes_mail_support_routing: OK");
