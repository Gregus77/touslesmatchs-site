// ═══════════════════════════════════════════════════════
// SUBSCRIPTIONS STORE — Stockage JSON simple
// Fichier : data/subscriptions.json
// Format par stripe_subscription_id :
//   { customer_id, email, price_id, tier, status,
//     telegram_invite_link, telegram_user_id,
//     created_at, current_period_end }
// ═══════════════════════════════════════════════════════

const fs   = require("fs");
const path = require("path");

const DATA_DIR  = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "subscriptions.json");

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return {}; }
}

function save(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function upsert(subscriptionId, fields) {
  const data = load();
  data[subscriptionId] = { ...(data[subscriptionId] || {}), ...fields, updated_at: new Date().toISOString() };
  save(data);
  return data[subscriptionId];
}

function getBySubscriptionId(subscriptionId) {
  return load()[subscriptionId] || null;
}

function getByCustomerId(customerId) {
  const data = load();
  return Object.values(data).find(s => s.customer_id === customerId) || null;
}

function getByEmail(email) {
  const data = load();
  return Object.values(data).find(s => s.email === email) || null;
}

function setTelegramUserId(subscriptionId, telegramUserId) {
  upsert(subscriptionId, { telegram_user_id: telegramUserId });
}

function cancelSubscription(subscriptionId) {
  upsert(subscriptionId, { status: "cancelled", tier: "free" });
}

function suspendSubscription(subscriptionId) {
  upsert(subscriptionId, { status: "suspended" });
}

function renewSubscription(subscriptionId, periodEnd) {
  upsert(subscriptionId, { status: "active", current_period_end: new Date(periodEnd * 1000).toISOString() });
}

// Emails capture (separate file)
const EMAILS_FILE = path.join(DATA_DIR, "emails.json");

function addEmail(email) {
  let emails = [];
  if (fs.existsSync(EMAILS_FILE)) {
    try { emails = JSON.parse(fs.readFileSync(EMAILS_FILE, "utf8")); } catch { emails = []; }
  }
  if (!emails.includes(email)) {
    emails.push(email);
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
    return true;
  }
  return false;
}

module.exports = {
  upsert,
  getBySubscriptionId,
  getByCustomerId,
  getByEmail,
  setTelegramUserId,
  cancelSubscription,
  suspendSubscription,
  renewSubscription,
  addEmail,
};
