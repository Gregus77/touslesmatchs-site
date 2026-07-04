/**
 * TousLesMatchs — Brevo Integration Module
 * Point d'accès unique pour toutes les fonctions Brevo.
 * Toutes les clés API dans .env. Aucune clé en dur dans le code.
 * Mode TEST disponible : BREVO_TEST_MODE=true → emails vers admin uniquement.
 */
const https = require("https");
const fs = require("fs");
const LOG_FILE = "/var/log/tlm/brevo.log";

function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch(e) {}
}

// ── Configuration ──
const API_KEY = process.env.BREVO_API_KEY || "";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "TousLesMatchs";
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "noreply@touslesmatchs.com";
const TEST_MODE = process.env.BREVO_TEST_MODE === "true";
const ADMIN_EMAIL = process.env.GREGORY_EMAIL || "";
const BASE = "api.brevo.com";
const STATS = { calls: 0, errors: 0, lastCall: null, lastError: null, avgMs: 0 };


function api(path, method = "GET", body = null) {
  return new Promise((resolve) => {
    if (!API_KEY) return resolve({ ok: false, error: "BREVO_API_KEY not configured" });
    const start = Date.now();
    STATS.calls++;
    const opts = {
      hostname: BASE, path: `/v3${path}`, method,
      headers: { "api-key": API_KEY, "accept": "application/json" }
    };
    if (body) {
      opts.headers["content-type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        const ms = Date.now() - start;
        STATS.avgMs = Math.round((STATS.avgMs * (STATS.calls - 1) + ms) / STATS.calls);
        STATS.lastCall = new Date().toISOString();
        try {
          const json = JSON.parse(data);
          resolve({ ok: res.statusCode < 400, status: res.statusCode, data: json, ms });
        } catch {
          resolve({ ok: res.statusCode < 400, status: res.statusCode, data, ms });
        }
      });
    });
    req.on("error", (e) => {
      STATS.errors++;
      STATS.lastError = e.message;
      log("ERROR", `Brevo API error: ${e.message}`);
      resolve({ ok: false, error: e.message });
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Public API ──
async function healthCheck() {
  const r = await api("/account");
  return { ok: r.ok, status: r.status, ms: r.ms, error: r.error };
}

async function sendEmail(to, subject, htmlContent) {
  log("INFO", `sendEmail to=${to} subject="${subject}" test=${TEST_MODE}`);
  if (TEST_MODE && ADMIN_EMAIL) {
    log("WARN", `TEST MODE: redirecting to ${ADMIN_EMAIL} instead of ${to}`);
    to = ADMIN_EMAIL;
  }
  if (!to) return { ok: false, error: "No recipient" };
  return api("/smtp/email", "POST", {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: to, name: to.split("@")[0] }],
    subject, htmlContent
  });
}

async function createContact(email, attrs = {}, listIds = []) {
  log("INFO", `createContact ${email} lists=${listIds.length}`);
  return api("/contacts", "POST", { email, attributes: attrs, listIds, updateEnabled: true });
}

async function updateContact(email, attrs = {}) {
  log("INFO", `updateContact ${email}`);
  return api(`/contacts/${encodeURIComponent(email)}`, "PUT", { attributes: attrs });
}

async function deleteContact(email) {
  log("INFO", `deleteContact ${email}`);
  return api(`/contacts/${encodeURIComponent(email)}`, "DELETE");
}

async function getCampaigns() {
  return api("/campaigns?status=archive&limit=5&offset=0&type=classic");
}

async function getLists() {
  return api("/contacts/lists?limit=10");
}

async function getContacts() {
  return api("/contacts?limit=5");
}

function getStats() {
  return { ...STATS, testMode: TEST_MODE };
}

module.exports = {
  healthCheck, sendEmail, createContact, updateContact,
  deleteContact, getCampaigns, getLists, getContacts, getStats
};
