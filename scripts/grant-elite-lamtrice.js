#!/usr/bin/env node
// One-shot script: grant Elite access to lamtrice2012@gmail.com
// Usage: node scripts/grant-elite-lamtrice.js
// Run on VPS after deploy

const Database = require("better-sqlite3");
const path = require("path");

const CODES_DB_PATH = process.env.CODES_DB_PATH || path.join(__dirname, "..", "data", "codes.db");
const TARGET_EMAIL = "lamtrice2012@gmail.com";
const PLAN = "elite";
const CREDITS_MAX = 30;
const DURATION_DAYS = 365; // 1 an d'accès

const db = new Database(CODES_DB_PATH);

const existing = db.prepare("SELECT code, plan FROM codes WHERE email = ? AND active = 1").get(TARGET_EMAIL);
if (existing) {
  console.log(`Code existant pour ${TARGET_EMAIL}: ${existing.code} (plan: ${existing.plan})`);
  db.close();
  process.exit(0);
}

const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
const today = new Date().toISOString().slice(0, 10);
const expiresAt = new Date(Date.now() + DURATION_DAYS * 86400000).toISOString().slice(0, 10);

db.prepare(
  "INSERT INTO codes (code, email, plan, active, expires_at, credits_max, credits_used, credits_date) VALUES (?,?,?,1,?,?,0,?)"
).run(code, TARGET_EMAIL, PLAN, expiresAt, CREDITS_MAX, today);

db.close();

console.log("===========================================");
console.log(`✅ Accès Elite créé pour ${TARGET_EMAIL}`);
console.log(`   Code : ${code}`);
console.log(`   Plan : Elite (30 analyses/jour)`);
console.log(`   Expire : ${expiresAt}`);
console.log("===========================================");
console.log("");
console.log("À transmettre à l'utilisateur :");
console.log(`   Email : ${TARGET_EMAIL}`);
console.log(`   Code : ${code}`);
console.log(`   Site : https://www.touslesmatchs.com`);
