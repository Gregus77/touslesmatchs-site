"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const { renderCard } = require("./social_card_renderer");

const STATE_PATH = process.env.SOCIAL_DISPATCH_STATE || "/data/social-dispatch-state.json";
const OUTBOX_DIR = process.env.SOCIAL_OUTBOX_DIR || "/data/social-outbox";
const PUBLIC_BASE_URL = (process.env.SOCIAL_PUBLIC_BASE_URL || process.env.SITE_BASE_URL || "https://www.touslesmatchs.com").replace(/\/$/, "");

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")); }
  catch (_) { return { sent: {}, instagram: {}, tiktok: {} }; }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_PATH);
}

function eventKey(event, stage) {
  const base = event.eventKey || event.matchKey || [event.home, event.away, event.kickoff || event.analysedAt || new Date().toISOString().slice(0,10)].join("|");
  return crypto.createHash("sha256").update(`${stage}|${base}`).digest("hex").slice(0, 24);
}

function httpJson({ hostname, path: reqPath, method = "GET", headers = {}, body = null, timeout = 20000 }) {
  return new Promise((resolve) => {
    const payload = body == null ? null : JSON.stringify(body);
    const req = https.request({
      hostname,
      path: reqPath,
      method,
      headers: {
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        ...headers,
      },
      timeout,
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: JSON.parse(data || "{}"), raw: data }); }
        catch (_) { resolve({ ok: false, status: res.statusCode, json: null, raw: data }); }
      });
    });
    req.on("error", e => resolve({ ok: false, status: 0, error: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, status: 0, error: "timeout" }); });
    if (payload) req.write(payload);
    req.end();
  });
}

function tgEsc(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function captionFor(event, stage, platform) {
  const score = event.finalScore || ((event.finalScoreHome != null && event.finalScoreAway != null) ? `${event.finalScoreHome}-${event.finalScoreAway}` : "");
  const competition = event.competition || event.league || "Football";
  const country = event.country || "";
  const vote = Number(event.consensusVotes || event.consensus_votes || 0);
  const conf = Number(event.confidence || 0);

  if (stage === "result") {
    const label = event.outcome === "win" ? "GAGNÉ ✅" : event.outcome === "loss" ? "PERDU ❌" : "TERMINÉ";
    const common = `${label}\n${event.home} — ${event.away}${score ? ` · ${score}` : ""}\n${competition}${country ? ` · ${country}` : ""}${event.bet ? `\nSélection : ${event.bet}` : ""}\n\nRésultat vérifié. Les gagnés comme les perdus restent publics.`;
    return platform === "telegram" ? `${common}\n\n${PUBLIC_BASE_URL}/performances\n⚠️ 18+ · Jeu responsable` : `${common}\n\n#football #analysefootball #TousLesMatchs`;
  }

  const common = `Le Concile a validé un signal.\n${event.home} — ${event.away}\n${competition}${country ? ` · ${country}` : ""}${vote ? `\nAccord IA : ${vote}/5` : ""}${conf ? ` · confiance ${conf}/100` : ""}`;
  if (platform === "telegram") {
    return `${common}\n\n🔒 La sélection exacte est disponible sur TousLesMatchs.\n${PUBLIC_BASE_URL}/#plans\n⚠️ 18+ · Jeu responsable`;
  }
  return `${common}\n\nAnalyse sportive informative. Aucun résultat garanti.\n#football #analysefootball #TousLesMatchs`;
}

async function sendTelegramPhoto({ botToken, chatId, imageUrl, caption }) {
  if (!botToken || !chatId || !imageUrl) return { ok: false, skipped: true, reason: "config" };
  const qs = new URLSearchParams({ chat_id: chatId, photo: imageUrl, caption, parse_mode: "HTML" });
  const r = await httpJson({ hostname: "api.telegram.org", path: `/bot${botToken}/sendPhoto?${qs.toString()}` });
  return { ok: !!(r.ok && r.json && r.json.ok), response: r.json || r.raw };
}

function publicMediaUrl(filename) {
  const base = process.env.SOCIAL_PUBLIC_MEDIA_URL || `${PUBLIC_BASE_URL}/social-media`;
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(filename)}`;
}

function instagramEnabled() {
  return String(process.env.SOCIAL_INSTAGRAM_ENABLED || "false").toLowerCase() === "true"
    && String(process.env.META_GAMBLING_WRITTEN_PERMISSION || "false").toLowerCase() === "true";
}

async function publishInstagram({ imageUrl, caption }) {
  if (!instagramEnabled()) return { ok: false, skipped: true, reason: "Meta written permission not confirmed" };
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "";
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || "";
  if (!accountId || !token) return { ok: false, skipped: true, reason: "Instagram config missing" };

  const create = await httpJson({
    hostname: "graph.facebook.com",
    path: `/v22.0/${encodeURIComponent(accountId)}/media`,
    method: "POST",
    body: { image_url: imageUrl, caption, access_token: token },
  });
  const creationId = create.json && create.json.id;
  if (!create.ok || !creationId) return { ok: false, reason: "container_create_failed", response: create.json || create.raw };

  const publish = await httpJson({
    hostname: "graph.facebook.com",
    path: `/v22.0/${encodeURIComponent(accountId)}/media_publish`,
    method: "POST",
    body: { creation_id: creationId, access_token: token },
  });
  return { ok: !!(publish.ok && publish.json && publish.json.id), response: publish.json || publish.raw };
}

function queueTikTok({ event, stage, image, caption }) {
  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  const key = eventKey(event, stage);
  const item = {
    key,
    createdAt: new Date().toISOString(),
    platform: "tiktok",
    status: "ready_for_manual_or_approved_publisher",
    reason: "TikTok Content Posting API should not be used as an internal unattended uploader without an approved publishing flow.",
    imageUrl: publicMediaUrl(image.filename),
    caption,
    event,
  };
  const filePath = path.join(OUTBOX_DIR, `tiktok-${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(item, null, 2));
  return { ok: true, queued: true, filePath };
}

async function dispatchSocialEvent(event, options = {}) {
  const stage = options.stage === "result" ? "result" : "signal";
  const state = readState();
  const key = eventKey(event, stage);
  const dedupeKey = `${stage}:${key}`;
  if (state.sent[dedupeKey] && !options.force) return { ok: true, duplicate: true, key };

  const story = await renderCard({ ...event, eventKey: key }, { stage, ratio: "story" });
  const feed = await renderCard({ ...event, eventKey: key }, { stage, ratio: "feed" });
  const storyUrl = publicMediaUrl(story.filename);
  const feedUrl = publicMediaUrl(feed.filename);

  const result = { key, stage, media: { storyUrl, feedUrl }, telegram: null, instagram: null, tiktok: null };

  if (options.telegram !== false) {
    result.telegram = await sendTelegramPhoto({
      botToken: process.env.TELEGRAM_BOT_TOKEN || "",
      chatId: options.telegramChatId || process.env.TELEGRAM_CHANNEL_ID || "",
      imageUrl: feedUrl,
      caption: captionFor(event, stage, "telegram"),
    });
  }

  result.instagram = await publishInstagram({ imageUrl: feedUrl, caption: captionFor(event, stage, "instagram") });
  result.tiktok = queueTikTok({ event, stage, image: story, caption: captionFor(event, stage, "tiktok") });

  const platformSuccess = [result.telegram, result.instagram, result.tiktok]
    .filter(Boolean)
    .some(x => x.ok || x.queued);
  if (platformSuccess) {
    state.sent[dedupeKey] = { at: new Date().toISOString(), result };
    writeState(state);
  }

  return { ok: platformSuccess, ...result };
}

module.exports = {
  dispatchSocialEvent,
  captionFor,
  publicMediaUrl,
  instagramEnabled,
};
