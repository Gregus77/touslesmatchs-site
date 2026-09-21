#!/usr/bin/env node
"use strict";
const fs = require("fs");
const assert = require("assert");
const api = fs.readFileSync(require("path").join(__dirname, "api_server.js"), "utf8");
assert(api.includes("CREATE TABLE IF NOT EXISTS admin_incident_notifications"), "registre partagé absent");
assert(api.includes("ADMIN_CRITICAL_REMINDER_MS = 6 * 3600 * 1000"), "rappel critique différent de 6 h");
assert(api.includes("if (hour >= 9 && _lastMorningAuditDate !== todayKey)"), "bilan unique non planifié à 9 h");
assert(!api.includes("if (hour === 7 && _lastHealthCheckDate"), "ancien bilan 7 h encore planifié");
assert(api.includes("Incident résolu"), "notification de résolution absente");
assert(api.includes("source='reliability' AND status='active'"), "résolution fiabilité non persistée");
assert(!api.includes("const CONCILE_ALERT_COOLDOWN_MS = 12"), "ancien rappel 12 h encore actif");
console.log("OK: digest 9 h, incident/résolution, rappel critique 6 h et état partagé");
