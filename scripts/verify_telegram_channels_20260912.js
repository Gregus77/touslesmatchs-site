#!/usr/bin/env node
"use strict";
const https = require("https");
function call(method, payload = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      host: "api.telegram.org",
      path: "/bot" + process.env.TELEGRAM_BOT_TOKEN + "/" + method,
      method: "POST",
      timeout: 12000,
      headers: {"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}
    }, res => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); } catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end(body);
  });
}
(async () => {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("token absent");
  const me = await call("getMe");
  if (!me.ok || !me.result?.id) throw new Error("bot auth");
  const targets = [
    ["FR Gratuit", "TELEGRAM_CHANNEL_ID", "TELEGRAM_FREE_CHANNEL_ID"],
    ["FR Premium 14,90 €", "TELEGRAM_PREMIUM_CHANNEL_ID"],
    ["RU Gratuit", "TELEGRAM_RU_FREE_CHANNEL_ID"],
    ["RU Premium 14,90 €", "TELEGRAM_RU_PREMIUM_CHANNEL_ID"],
    ["Admin", "TELEGRAM_ADMIN_CHAT_ID"]
  ];
  for (const [label, ...keys] of targets) {
    const id = keys.map(key => process.env[key]).find(Boolean);
    if (!id) throw new Error(label + " absent");
    const result = await call("getChatMember", {chat_id:id,user_id:me.result.id});
    const status = result.result?.status;
    if (!result.ok || !["administrator","creator","member"].includes(status) || result.result?.can_post_messages === false) {
      throw new Error(label + " inaccessible");
    }
  }
  console.log("TELEGRAM_ACCESS_OK_4_CLIENT_CHANNELS");
})().catch(error => {
  console.error("TELEGRAM_ACCESS_FAILED", error.message);
  process.exit(1);
});
