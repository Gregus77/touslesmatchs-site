// TousLesMatchs — API Server
// TELEGRAM_AUDIT_FALSE_FAILURES_V1
// Auth, live matches, Live IA, Stripe, Brevo, Admin

process.on("uncaughtException", (err) => {
  console.error("[CRASH-GUARD] uncaughtException:", err.message, err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error("[CRASH-GUARD] unhandledRejection:", reason);
});

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http  = require("http");
const crypto = require("crypto");
// Point de passage obligatoire pour tout appel IA lié à l'analyse d'un match
// (garde-fou budget/anti-doublon/coupe-circuit). Voir scripts/analysis_engine.js.
const analysisEngine = require("./analysis_engine");
const { BETA_PLUS05_CAPACITY, buildBetaPlus05InvitationEmail, decideBetaApplication, formatBetaApplicationsCsv, normalizeBetaEmail } = require("./beta_waitlist");
const { bookmakerButtons, buildInlineKeyboard } = require("./bookmakers.config");

// ── Pages SEO (pronostics) — inliné pour éviter tout module externe ───────────
// (le Dockerfile ne copie que api_server.js + bookmakers.config.js). Rendu de
// pages publiques indexables, conformes ANJ (pas de "pari", disclaimer, 18+).
const seoPages = (function () {
  const SITE = "https://www.touslesmatchs.com";
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function slugify(str) {
    return String(str || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }
  function matchSlug(item) {
    const d = (item.date || "").slice(0, 10);
    return `${slugify(item.home)}-${slugify(item.away)}${d ? "-" + d : ""}`;
  }
  function fmtDateFr(iso) {
    if (!iso) return "";
    const p = String(iso).slice(0, 10).split("-");
    if (p.length !== 3) return iso;
    const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
      "août", "septembre", "octobre", "novembre", "décembre"];
    return `${parseInt(p[2], 10)} ${mois[parseInt(p[1], 10) - 1]} ${p[0]}`;
  }
  function shell({ title, description, canonical, bodyHtml, schema }) {
    return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="TousLesMatchs"><meta name="twitter:card" content="summary">
<meta name="robots" content="index,follow"><link rel="icon" href="/favicon.ico">
${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ""}
<style>
:root{--bg:#06080f;--text:#eceaf4;--muted:#7b82a0;--muted2:#a8aec8;--violet:#a78bfa;--green:#34d399;--cyan:#22d3ee;--b1:rgba(255,255,255,.06);--b2:rgba(129,140,248,.18)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:Inter,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--violet);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:820px;margin:0 auto;padding:28px 20px 60px}
.topnav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid var(--b1);position:sticky;top:0;background:rgba(6,8,15,.9);backdrop-filter:blur(10px);z-index:5}
.brand{font-weight:900;letter-spacing:-.02em;color:var(--text)}
.topnav a.cta{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:8px 16px;border-radius:9px;font-size:13px;font-weight:700}
.bc{font-size:12px;color:var(--muted);margin-bottom:18px}
h1{font-size:clamp(24px,4vw,34px);font-weight:900;letter-spacing:-.03em;line-height:1.15;margin-bottom:10px}
h2{font-size:20px;font-weight:800;margin:28px 0 12px;letter-spacing:-.02em}
.sub{color:var(--muted2);font-size:15px;margin-bottom:22px}
.card{background:linear-gradient(160deg,rgba(30,27,58,.5),rgba(15,14,30,.6));border:1px solid var(--b2);border-radius:16px;padding:22px;margin-bottom:20px}
.verdict{display:flex;flex-wrap:wrap;gap:18px;align-items:center}.verdict .big{font-size:22px;font-weight:900;color:#fff}
.pill{display:inline-flex;align-items:baseline;gap:5px}.pill b{font-size:22px;font-weight:900}
.pill.g b{color:var(--green)}.pill.c b{color:var(--cyan)}.pill span{font-size:12px;color:var(--muted2)}
.meta-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.tag{font-size:12px;font-weight:700;padding:5px 11px;border-radius:8px;background:rgba(129,140,248,.12);color:var(--violet);border:1px solid var(--b2)}
.tag.win{background:rgba(16,185,129,.12);color:var(--green);border-color:rgba(16,185,129,.3)}
.tag.loss{background:rgba(244,63,94,.1);color:#fb7185;border-color:rgba(244,63,94,.25)}
p{margin-bottom:14px;color:var(--muted2)}
.list a{display:flex;justify-content:space-between;gap:12px;padding:13px 15px;border:1px solid var(--b1);border-radius:12px;margin-bottom:9px;color:var(--text)}
.list a:hover{border-color:var(--b2);text-decoration:none;background:rgba(129,140,248,.05)}
.list .l-match{font-weight:700;font-size:14px}.list .l-meta{font-size:12px;color:var(--muted)}
.disclaimer{margin-top:32px;padding-top:20px;border-top:1px solid var(--b1);font-size:11px;color:var(--muted);line-height:1.7}
.footlinks{margin-top:18px;font-size:12px}.footlinks a{margin-right:14px;color:var(--muted2)}
</style></head><body>
<nav class="topnav"><a href="/" class="brand">TousLesMatchs</a><a href="/#plans" class="cta">Voir les offres</a></nav>
<div class="wrap">
${bodyHtml}
<div class="disclaimer">Analyses sportives assistées par IA à but informatif. TousLesMatchs ne garantit aucun gain. Les jeux d'argent et de hasard peuvent être dangereux : pertes d'argent, conflits familiaux, addiction. 18+ · Interdit aux mineurs. Conseils et aide sur <a href="https://www.joueurs-info-service.fr" rel="nofollow">joueurs-info-service.fr</a> — 09 74 75 13 13 (appel non surtaxé).</div>
<div class="footlinks"><a href="/">Accueil</a><a href="/pronostics">Tous les pronostics</a><a href="/live-ia">Live IA</a><a href="/performances">Performances</a><a href="/faq">FAQ</a></div>
</div></body></html>`;
  }
  function renderDetail(item, related) {
    const dateFr = fmtDateFr(item.date);
    const resolved = item.outcome === "win" || item.outcome === "loss";
    const title = `Pronostic ${item.home} - ${item.away}${item.competition ? " (" + item.competition + ")" : ""} | Analyse IA`;
    const description = `Analyse IA de ${item.home} contre ${item.away}${dateFr ? " du " + dateFr : ""} : verdict du Conseil (${item.bet}), score de confiance ${item.confidence}/100 et cote. Le Concile de 5 IA décrypte le match.`;
    const canonical = `${SITE}/pronostic/${matchSlug(item)}`;
    const schema = { "@context": "https://schema.org", "@type": "SportsEvent",
      name: `${item.home} - ${item.away}`, sport: item.sport || "Soccer",
      startDate: (item.date || "").slice(0, 10) || undefined,
      homeTeam: { "@type": "SportsTeam", name: item.home },
      awayTeam: { "@type": "SportsTeam", name: item.away }, description, url: canonical };
    const outcomeTag = resolved
      ? `<span class="tag ${item.outcome === "win" ? "win" : "loss"}">${item.outcome === "win" ? "✅ Analyse gagnante" : "❌ Analyse perdue"}</span>`
      : `<span class="tag">🔴 Analyse publiée</span>`;
    const relatedHtml = (related || []).length
      ? `<h2>Autres analyses du Conseil</h2><div class="list">${related.map(r =>
          `<a href="/pronostic/${matchSlug(r)}"><span class="l-match">${esc(r.home)} - ${esc(r.away)}</span><span class="l-meta">${esc(r.competition || "")}</span></a>`).join("")}</div>`
      : "";
    const body = `
  <div class="bc"><a href="/pronostics">Pronostics</a> › ${esc(item.home)} - ${esc(item.away)}</div>
  <h1>${esc(item.home)} - ${esc(item.away)} : le pronostic du Conseil IA</h1>
  <div class="sub">${item.competition ? esc(item.competition) + " · " : ""}${dateFr ? "Match du " + esc(dateFr) : ""}</div>
  <div class="meta-row">${outcomeTag}<span class="tag">🧠 Vote IA 5/5</span>${item.sport ? `<span class="tag">${esc(item.sport)}</span>` : ""}</div>
  <div class="card"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--violet);margin-bottom:8px">🔥 Verdict du Conseil</div>
    <div class="verdict"><div class="big">${esc(item.bet || "Analyse IA")}</div><div class="pill g"><b>${item.confidence || ""}%</b><span>de confiance</span></div>${item.cote ? `<div class="pill c"><b>${item.cote}</b><span>cote</span></div>` : ""}</div></div>
  <h2>L'analyse en détail</h2>
  <p>${item.reasoning ? esc(item.reasoning) : `Pour ${esc(item.home)} contre ${esc(item.away)}, le Concile a croisé le classement, la forme récente, les confrontations directes et la valeur du marché. Cinq intelligences artificielles ont voté séparément avant validation par convergence.`}</p>
  <p>Chaque analyse repose sur le vote de 5 agents IA spécialisés : là où un seul avis peut se tromper, la confrontation des modèles fait ressortir les désaccords et sécurise la décision. Le verdict n'est publié que lorsque la confiance dépasse notre seuil de qualité.</p>
  <h2>Comment fonctionne le Conseil IA ?</h2>
  <p>Hermès collecte les données vérifiées du match, 5 IA analysent stats, forme et valeur, puis le vote mesure la convergence. Si les signaux sont contradictoires, aucun signal n'est validé. <a href="/#methode">Voir la méthode complète →</a></p>
  <div class="card" style="text-align:center"><div style="font-weight:800;margin-bottom:8px">Envie de toutes les analyses en direct ?</div><p style="margin-bottom:14px">Les membres Standard et Premium reçoivent les analyses Live IA et les signaux du Concile en temps réel.</p><a href="/#plans" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:13px 30px;border-radius:11px;font-weight:800">Voir les offres</a></div>
  ${relatedHtml}`;
    return shell({ title, description, canonical, bodyHtml: body, schema });
  }
  function renderIndex(items) {
    const title = "Pronostics football & sports — Analyses IA | TousLesMatchs";
    const description = "Tous les pronostics du Conseil IA : analyses de matchs de football. Verdict de 5 intelligences artificielles, confiance et historique public.";
    const canonical = `${SITE}/pronostics`;
    const schema = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, description, url: canonical };
    const rows = (items || []).map(it => {
      const resolved = it.outcome === "win" || it.outcome === "loss";
      const badge = resolved ? (it.outcome === "win" ? "✅" : "❌") : "🔴";
      return `<a href="/pronostic/${matchSlug(it)}"><span class="l-match">${badge} ${esc(it.home)} - ${esc(it.away)}</span><span class="l-meta">${esc(it.competition || it.sport || "")}${it.confidence ? " · " + it.confidence + "%" : ""}</span></a>`;
    }).join("");
    const body = `
  <div class="bc"><a href="/">Accueil</a> › Pronostics</div>
  <h1>Pronostics & analyses IA</h1>
  <p class="sub">Chaque match est analysé par le Conseil : 5 intelligences artificielles votent, la convergence valide. Historique 100 % public — gagnés comme perdus.</p>
  <div class="list">${rows || "<p>Aucune analyse publiée pour le moment.</p>"}</div>`;
    return shell({ title, description, canonical, bodyHtml: body, schema });
  }
  function renderSitemap(items) {
    const urls = [`${SITE}/pronostics`].concat((items || []).map(it => `${SITE}/pronostic/${matchSlug(it)}`));
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;
  }
  return { slugify, matchSlug, renderDetail, renderIndex, renderSitemap };
})();

const firebaseAdmin = require("firebase-admin");

const app = express();
/* TLM support fallback - registered before application routes */
app.all(['/chatbot','/api/chatbot','/api/tlm-assistant-fallback'], (req,res)=>{
  res.json({
    ok:true,
    mode:'local_fallback',
    reply:"Support TousLesMatchs disponible. Le moteur IA complet est temporairement limite. Pour une question d'acces, abonnement ou Telegram, indique ton email."
  });
});

// IMPORTANT : le webhook Stripe a besoin du corps BRUT (Buffer) pour vérifier
// la signature. On exclut donc /stripe/webhook du parser JSON global, sinon
// constructEvent échoue → le client paie mais ne reçoit jamais son code/email.
const jsonParser = express.json({ limit: "20mb" });
app.use((req, res, next) => {
  if (req.originalUrl === "/stripe/webhook") return next();
  return jsonParser(req, res, next);
});
// CORS restreint au domaine du site (revue de securite du 01/08/2026) —
// app.use(cors()) sans options autorisait n'importe quel site tiers a
// appeler l'API. Risque limite ici (l'auth passe par un token colle
// manuellement en JS, jamais un cookie envoye automatiquement par le
// navigateur), mais defense en profondeur peu couteuse. Pas d'origin
// (curl, apps mobiles, webhooks Stripe server-to-server) reste autorise.
const ALLOWED_ORIGINS = new Set([
  "https://touslesmatchs.com",
  "https://www.touslesmatchs.com",
]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  // Sans cette liste, le navigateur refuserait les en-têtes d'identifiants
  // ajoutés ci-dessous (X-TLM-Email / X-TLM-Code) lors du contrôle préalable.
  allowedHeaders: ["Content-Type", "Authorization", "X-TLM-Email", "X-TLM-Code"],
}));

// ── SÉCURITÉ : identifiants en EN-TÊTES plutôt qu'en query string ────────────
// Les codes d'accès transitaient en ?email=…&code=… : une URL finit dans
// l'historique du navigateur, les journaux du reverse proxy, et l'en-tête
// Referer envoyé aux domaines tiers. Un en-tête HTTP ne subit aucun de ces
// trois sorts (audit du 05/08/2026, point #3).
//
// Ce middleware recopie simplement les en-têtes vers req.query : TOUS les
// endpoints existants continuent de lire req.query.email / req.query.code
// sans une seule modification, et les anciennes URL avec query string
// restent acceptées — aucun lien en circulation ni marque-page ne casse.
// Le front, lui, n'envoie plus que des en-têtes (voir public/*.html).
app.use((req, _res, next) => {
  const hEmail = req.headers["x-tlm-email"];
  const hCode = req.headers["x-tlm-code"];
  if (hEmail || hCode) {
    // req.query est en lecture seule sur Express 5 : on reconstruit l'objet.
    const merged = { ...req.query };
    if (hEmail && !merged.email) merged.email = String(hEmail);
    if (hCode && !merged.code) merged.code = String(hCode);
    Object.defineProperty(req, "query", { value: merged, configurable: true });
  }
  next();
});

// ── SÉCURITÉ P2 : rate limiting maison (aucune dépendance externe) ────────────
// Strict sur l'authentification (anti-brute-force), très large ailleurs
// (anti-scraping sans gêner les visiteurs). Stockage en mémoire, nettoyé.
const _rlHits = new Map();
function rlAllow(key, max, windowMs) {
  const now = Date.now();
  const arr = (_rlHits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now);
  _rlHits.set(key, arr);
  return arr.length <= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of _rlHits) {
    const keep = arr.filter(t => now - t < 15 * 60 * 1000);
    if (keep.length) _rlHits.set(k, keep); else _rlHits.delete(k);
  }
}, 5 * 60 * 1000);
function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "unknown";
}
app.use((req, res, next) => {
  const ip = clientIp(req);
  // Auth : 20 tentatives / 15 min / IP
  // /verify-code ajoute le 01/08/2026 (revue de securite) : ce code d'acces
  // reste valable des mois (pas un OTP a courte duree de vie comme /auth/*),
  // donc jamais rate-limite jusqu'ici cote IP — seul l'espace de recherche
  // (8 caracteres, ~1400 milliards de combinaisons) rendait un brute-force
  // impraticable. Defense en profondeur, pas une faille activement exploitee.
  if (req.method === "POST" && (req.path === "/auth/login" || req.path === "/auth/register" || req.path === "/verify-code")) {
    if (!rlAllow("auth_" + ip, 20, 15 * 60 * 1000)) {
      return res.status(429).json({ ok: false, error: "Trop de tentatives, réessaie dans quelques minutes." });
    }
  }
  // Global : 600 req / min / IP (très large, ne gêne aucun visiteur normal)
  if (!rlAllow("g_" + ip, 600, 60 * 1000)) {
    return res.status(429).json({ ok: false, error: "Trop de requêtes." });
  }
  next();
});

// ── SÉCURITÉ P1 : protège les endpoints /admin/* en LECTURE seule ─────────────
// Ces endpoints exposaient des infos internes (ratings ligues, perfs agents,
// état système…) sans auth. On exige désormais : identifiants admin (email+code)
// OU le token d'Hermès (secret = HERMES_ADMIN_TLM_BOT) pour ne pas casser son
// monitoring. Les routes admin sensibles (codes, mutations) ont déjà leur propre
// contrôle — ceci ne fait que couvrir les lectures ops non protégées.
const ADMIN_READONLY_PATHS = new Set([
  "/admin/leagues", "/admin/agents", "/admin/journal", "/admin/markets",
  "/admin/competitions", "/admin/health", "/admin/ai-specialization",
  "/admin/monthly-history", "/admin/alerts", "/admin/scheduler-state",
  "/admin/guardian-state", "/admin/datahub-state", "/admin/version",
  "/admin/preflight", "/admin/heartbeat",
  // Ajoutes le 05/08/2026 (audit securite) : ces 4 routes etaient restees
  // publiques et exposaient des donnees business sensibles a n'importe qui
  // connaissant l'URL — winrate/ROI reels, taux de conversion du tunnel,
  // performance par segment, et depense IA quotidienne. Aucune donnee
  // personnelle ni credential, mais de quoi renseigner un concurrent.
  "/admin/stats", "/admin/funnel-report", "/admin/segment-report",
  "/admin/ai-budget-stats",
]);
app.use((req, res, next) => {
  if (req.method === "GET" && ADMIN_READONLY_PATHS.has(req.path)) {
    const { email, code, secret } = req.query;
    const ok = isAdmin(email, code) || (secret && secret === process.env.HERMES_ADMIN_TLM_BOT);
    if (!ok) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  }
  next();
});

// ── Database ──────────────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || "/data/tlm.db";
const db = new Database(DB_PATH);
const GOAL05_LATEST_SIGNAL_FILE = process.env.GOAL05_LATEST_SIGNAL_FILE || path.join(path.dirname(DB_PATH), "goal05-latest-signal.json");
const GOAL05_LATEST_MAX_AGE_MS = Number(process.env.GOAL05_LATEST_MAX_AGE_MS || 18 * 60 * 60 * 1000);

function readGoal05LatestSignal() {
  try {
    if (!fs.existsSync(GOAL05_LATEST_SIGNAL_FILE)) return { ok: true, signal: null, reason: "no_signal" };
    const signal = JSON.parse(fs.readFileSync(GOAL05_LATEST_SIGNAL_FILE, "utf8"));
    const sentAt = signal && signal.sentAt ? Date.parse(signal.sentAt) : 0;
    if (!sentAt || Date.now() - sentAt > GOAL05_LATEST_MAX_AGE_MS) {
      return { ok: true, signal: null, reason: "expired", lastSignal: signal || null };
    }
    return { ok: true, signal };
  } catch (e) {
    console.error("[goal05-latest]", e.message);
    return { ok: false, signal: null, error: "lecture_signal_goal05_impossible" };
  }
}

// ── Anti-perte de données : snapshot automatique au démarrage ─────────────────
// À CHAQUE boot, avant toute migration/DELETE, on copie la base dans /data/snapshots.
// Rotation : on garde les 30 derniers snapshots. Ces fichiers vivent dans le même
// volume que la base, donc ils survivent aux rebuilds ; combinés au bind-mount host
// (docker-compose) ils survivent aussi à `down -v` / prune.
function bootSnapshot() {
  try {
    const snapDir = path.join(path.dirname(DB_PATH), "snapshots");
    fs.mkdirSync(snapDir, { recursive: true });
    // Snapshot cohérent via l'API SQLite (pas une simple copie de fichier)
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(snapDir, `tlm-boot-${ts}.db`);
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db.backup(dest)
      .then(() => {
        console.log(`[safeguard] Snapshot de démarrage créé: ${dest}`);
        // Rotation : garder les 30 plus récents
        try {
          const files = fs.readdirSync(snapDir)
            .filter(f => f.startsWith("tlm-boot-") && f.endsWith(".db"))
            .map(f => ({ f, t: fs.statSync(path.join(snapDir, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t);
          files.slice(30).forEach(x => { try { fs.unlinkSync(path.join(snapDir, x.f)); } catch (_) {} });
        } catch (e) { console.error("[safeguard] rotation:", e.message); }
      })
      .catch(e => console.error("[safeguard] snapshot échec:", e.message));
  } catch (e) {
    console.error("[safeguard] bootSnapshot:", e.message);
  }
}

// Garde-fou : ne JAMAIS laisser une migration destructive s'exécuter sur une base
// qui vient d'être remplie de données précieuses sans snapshot préalable.
const _rowCountAtBoot = (() => {
  try { return db.prepare("SELECT COUNT(*) c FROM concile_analyses").get()?.c ?? 0; }
  catch (_) { return 0; }
})();
if (_rowCountAtBoot > 0) bootSnapshot();
else console.log("[safeguard] Base vide au démarrage — pas de snapshot (rien à protéger)");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS user_tokens (
    user_id INTEGER PRIMARY KEY,
    tokens_today INTEGER DEFAULT 0,
    reset_date TEXT DEFAULT '',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS revealed_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    match_key TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    revealed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS agent_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    bet TEXT NOT NULL,
    confidence INTEGER DEFAULT 0,
    outcome TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(match_key, agent_name)
  );
  -- Telemetrie des appels agents (07/08/2026). Demande du fondateur apres que
  -- 93% des analyses sont sorties sans aucun vote : "ne pars pas du principe
  -- que le timeout est la cause tant qu'on n'a pas de preuve. Si les logs ont
  -- disparu, il faut reconstruire une preuve." Les logs Docker disparaissent a
  -- chaque reconstruction du conteneur — la preuve doit donc vivre en base.
  -- Une ligne par tentative d'appel, meme echouee, avec sa duree reelle.
  CREATE TABLE IF NOT EXISTS agent_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    model TEXT DEFAULT '',
    host TEXT DEFAULT '',
    sport TEXT DEFAULT '',
    competition TEXT DEFAULT '',
    minute INTEGER DEFAULT NULL,
    tentative INTEGER DEFAULT 1,
    debut_at TEXT DEFAULT '',
    duree_ms INTEGER DEFAULT 0,
    http_status INTEGER DEFAULT NULL,
    issue TEXT NOT NULL,
    detail TEXT DEFAULT '',
    repli INTEGER DEFAULT 0,
    -- Renseigne apres le parsing : une reponse HTTP 200 exploitable ne produit
    -- pas forcement un vote (JSON valide mais champ "bet" vide). Sans cette
    -- colonne on confondrait "le modele a repondu" et "l'IA a vote".
    vote_produit INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_agent_calls_date ON agent_calls(created_at);

  CREATE TABLE IF NOT EXISTS agent_market_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    market_line TEXT NOT NULL,
    bet TEXT NOT NULL,
    confidence INTEGER DEFAULT 60,
    outcome TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(match_key, agent_name, market_line)
  );
  CREATE TABLE IF NOT EXISTS concile_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    competition TEXT DEFAULT '',
    analysed_at TEXT DEFAULT (datetime('now')),
    minute_at_analysis INTEGER DEFAULT NULL,
    score_home_at_analysis INTEGER DEFAULT NULL,
    score_away_at_analysis INTEGER DEFAULT NULL,
    stats_status TEXT DEFAULT 'unavailable',
    best_bet TEXT NOT NULL,
    confidence INTEGER DEFAULT 0,
    raison TEXT DEFAULT '',
    consensus_votes INTEGER DEFAULT 0,
    agents_json TEXT DEFAULT '[]',
    pick_bet TEXT DEFAULT NULL,
    outcome TEXT DEFAULT NULL
  );
  -- Ajoute le 07/08/2026 : presque toutes les lectures de cette table filtrent
  -- sur analysed_at (accueil, /analysis-history, seuil adaptatif, surveillance
  -- du Concile). Sans index, chacune balayait la table entiere.
  CREATE INDEX IF NOT EXISTS idx_concile_analysed_at ON concile_analyses(analysed_at);
`);

// Historique du "pick du jour" affiché en vitrine sur l'accueil — permet de
// montrer un vrai palmarès (page /performances, onglet dédié) plutôt que de
// perdre la trace du pick dès qu'il change. Une ligne par jour calendaire.
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_pick_log (
    date TEXT PRIMARY KEY,
    home TEXT, away TEXT, competition TEXT, sport TEXT,
    bet TEXT, confidence INTEGER, cote REAL,
    outcome TEXT DEFAULT NULL,
    final_score_home INTEGER DEFAULT NULL,
    final_score_away INTEGER DEFAULT NULL,
    home_logo TEXT, away_logo TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  -- Preuve durable des prochains envois : Telegram renvoie un message_id
  -- uniquement quand le message a reellement ete accepte par son API.
  CREATE TABLE IF NOT EXISTS telegram_signal_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    channel TEXT NOT NULL,
    telegram_message_id INTEGER DEFAULT NULL,
    market TEXT DEFAULT '',
    vote_count INTEGER DEFAULT 0,
    ok INTEGER NOT NULL DEFAULT 0,
    error TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tg_delivery_match ON telegram_signal_deliveries(match_key, channel, ok);
`);

// Anciennes candidatures +0,5 conservees uniquement pour l'historique admin.
// La campagne publique est fermee : aucun nouveau compte gratuit ne doit etre
// transforme en acces +0,5 complet par une vieille page restee en cache.
const FOUNDER_BETA_ENABLED = false;
db.exec(`CREATE TABLE IF NOT EXISTS beta_plus05_applications (
  email TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('accepted','waitlist')),
  adult_confirmed INTEGER NOT NULL DEFAULT 0,
  legal_accepted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);`);
// Connexion biométrique (Face ID / empreinte) — un credential WebAuthn par
// appareil, rattaché au couple email/code deja valide cote codes.db. Permet
// de re-injecter email+code dans le localStorage apres verif biometrique,
// sans toucher au systeme de login existant.
db.exec(`
  CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    device_label TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT DEFAULT NULL
  );
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Bankroll de l'utilisateur (simulateur de gestion de capital), keyée par email
db.exec(`
  CREATE TABLE IF NOT EXISTS user_bankroll (
    email TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);
// Suivi personnel des mises (gains/pertes) par utilisateur, keyé par email
db.exec(`
  CREATE TABLE IF NOT EXISTS user_bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    label TEXT NOT NULL,
    stake REAL NOT NULL,
    odds REAL NOT NULL,
    result TEXT NOT NULL,
    profit REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_user_bets_email ON user_bets(email);
`);
// Historique du chatbot, keyé par email : chaque utilisateur a SA mémoire isolée.
// Migration : si une ancienne table chat_messages existe avec un schéma incompatible
// (sans colonne email — ex. version user_id), on la remplace proprement.
try {
  const chatCols = db.prepare("PRAGMA table_info(chat_messages)").all().map(c => c.name);
  if (chatCols.length && !chatCols.includes("email")) {
    db.exec("DROP TABLE chat_messages");
    console.log("[migration] ancienne table chat_messages (schéma incompatible) supprimée");
  }
} catch (_) {}
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_chat_email ON chat_messages(email);
`);
ensureColumn("concile_analyses", "final_score_home", "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "final_score_away", "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "resolved_at", "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "result_source", "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "sport", "TEXT DEFAULT 'Football'");
ensureColumn("concile_analyses", "learning_tier", "TEXT DEFAULT 'learning'");
ensureColumn("concile_analyses", "learning_note", "TEXT DEFAULT ''");
ensureColumn("concile_analyses", "home_logo",       "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "away_logo",       "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "bet_category",    "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "country",         "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "is_neutral",      "INTEGER DEFAULT 0");
ensureColumn("concile_analyses", "home_form",       "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "away_form",       "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "home_goals_avg",  "REAL DEFAULT NULL");
ensureColumn("concile_analyses", "away_goals_avg",  "REAL DEFAULT NULL");
ensureColumn("concile_analyses", "home_shots",      "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "away_shots",      "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "home_possession", "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "away_possession", "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "real_odd",        "REAL DEFAULT NULL");
ensureColumn("concile_analyses", "real_odd_source", "TEXT DEFAULT NULL");
// Traçage: sur quels canaux clients le signal a réellement été DIFFUSÉ. Sert à ne
// poster le résultat (gagné/perdu) que sur les canaux qui ont vu le pick.
ensureColumn("concile_analyses", "sig_sent_free",     "INTEGER DEFAULT 0");
ensureColumn("concile_analyses", "sig_sent_standard", "INTEGER DEFAULT 0");
ensureColumn("concile_analyses", "sig_sent_premium",  "INTEGER DEFAULT 0");
ensureColumn("concile_analyses", "sig_sent_elite",    "INTEGER DEFAULT 0");
// Motif pour lequel une analyse n'a ete diffusee sur AUCUN canal payant. Sans
// cette trace, un "0 signal aujourd'hui" reste inexplicable : impossible de
// savoir si le probleme vient de la confiance, de la cote, du sport ou du
// filtre qualite. Renseigne a chaque analyse, lu par /admin/funnel-report.
ensureColumn("concile_analyses", "diffusion_block",   "TEXT DEFAULT NULL");
// Palier attribué au signal : "standard", "premium", "elite" ou null (non qualifié).
ensureColumn("concile_analyses", "signal_tier",       "TEXT DEFAULT NULL");
// Distingue les analyses live (auto-concile, en cours de match) des
// analyses pre-match (H2H, "Matchs a venir"). Demande de Greg le
// 02/08/2026 : comparer les vrais winrates des deux approches avant de
// decider de donner plus de poids au pre-match (cotes plus grosses mais
// moins de contexte disponible qu'en live). Defaut 'live' : couvre tout
// l'historique existant, qui vient exclusivement du pipeline live.
ensureColumn("concile_analyses", "source_type",       "TEXT DEFAULT 'live'");

// Les picks H2H pre-match servent uniquement a l'apprentissage interne. Ils
// n'ont ni minute live, ni cinq votes du Conseil, ni preuve Telegram et ne
// doivent donc jamais rester avec diffusion_block=NULL (qui signifie qu'une
// decision de diffusion valide est encore possible). Ce backfill est cible,
// idempotent et preserve toutes les analyses live ainsi que l'historique.
try {
  const fixedPrematchTrace = db.prepare(`
    UPDATE concile_analyses
    SET diffusion_block = 'prematch interne: non diffuse aux clients'
    WHERE source_type = 'prematch'
      AND (diffusion_block IS NULL OR trim(diffusion_block) = '')
      AND sig_sent_standard = 0
      AND sig_sent_premium = 0
      AND sig_sent_elite = 0
  `).run();
  if (fixedPrematchTrace.changes) {
    console.log(`[migration] ${fixedPrematchTrace.changes} analyse(s) prematch tracee(s) comme non diffusables`);
  }
} catch (e) {
  console.error("[migration] trace prematch:", e.message);
}

// Championnat de chaque avis agent x marche — absent jusqu'ici (voir
// commentaire plus bas), impossible donc de savoir "quelle IA est forte sur
// quel type de pari DANS quel championnat" comme demande par Greg le
// 02/08/2026. Backfill par jointure sur home/away/jour avec concile_analyses,
// qui a toujours eu la competition — fiable car un match donne n'a qu'une
// seule competition possible ce jour-la.
ensureColumn("agent_market_predictions", "competition", "TEXT DEFAULT NULL");
try {
  const toBackfill = db.prepare(
    "SELECT COUNT(*) AS n FROM agent_market_predictions WHERE competition IS NULL"
  ).get()?.n || 0;
  if (toBackfill > 0) {
    const updated = db.prepare(`
      UPDATE agent_market_predictions
      SET competition = (
        SELECT ca.competition FROM concile_analyses ca
        WHERE ca.home = agent_market_predictions.home
          AND ca.away = agent_market_predictions.away
          AND date(ca.analysed_at) = date(agent_market_predictions.created_at)
          AND ca.competition IS NOT NULL
        LIMIT 1
      )
      WHERE competition IS NULL
    `).run();
    console.log(`[agent-market] backfill competition: ${updated.changes}/${toBackfill} lignes completees`);
  }
} catch (e) { console.error("[agent-market] backfill competition:", e.message); }

// ── Migration: deduplicate old concile_analyses (keep latest row per match per day)
try {
  const dupeCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM concile_analyses
    WHERE id NOT IN (
      SELECT MAX(id) FROM concile_analyses GROUP BY home, away, date(analysed_at)
    )
  `).get()?.cnt || 0;
  if (dupeCount > 0) {
    db.exec(`
      DELETE FROM concile_analyses
      WHERE id NOT IN (
        SELECT MAX(id) FROM concile_analyses GROUP BY home, away, date(analysed_at)
      )
    `);
    console.log(`[migration] Supprimé ${dupeCount} doublons concile_analyses`);
  }
} catch (e) { console.error("[migration] dedup:", e.message); }

// ── Idempotence des webhooks Stripe ──────────────────────────────────────────
// Stripe REJOUE un webhook si notre réponse tarde ou échoue, et peut livrer un
// même événement plusieurs fois. Sans verrou, un `checkout.session.completed`
// rejoué renvoyait au client un 2e email de confirmation ET générait un 2e lien
// d'invitation Telegram à usage unique (le code d'accès, lui, était déjà
// protégé). Table persistée sur disque : le verrou survit à un redémarrage.
db.exec(`
  CREATE TABLE IF NOT EXISTS stripe_processed_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT,
    processed_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Auth unifiée email + OTP + sessions (Phase 2, 01/08/2026) ─────────────────
// Nouveau systeme, additif : ne touche ni ne remplace encore le systeme email+
// code reutilisable existant (codes.db, /verify-code) utilise sur le reste du
// site. Vise a devenir la SEULE methode de connexion (dashboard d'abord, puis
// le reste du site dans une etape ulterieure validee separement).
db.exec(`
  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_seen_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
  -- Journal des connexions concurrentes detectees sur le systeme email+code
  -- (partage de compte). Demande de Greg le 03/08/2026 : reperer qui partage
  -- son code pour, plus tard, envoyer un rappel avant risque de bannissement.
  CREATE TABLE IF NOT EXISTS session_kicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    kicked_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_session_kicks_email ON session_kicks(email);
`);

// ── Nurturing emails table (persistent across restarts) ──────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    email_type TEXT NOT NULL,
    send_after TEXT NOT NULL,
    sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(email, email_type)
  );
`);

// ── Analytics — page views tracking ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    referrer TEXT DEFAULT '',
    utm_source TEXT DEFAULT '',
    utm_medium TEXT DEFAULT '',
    utm_campaign TEXT DEFAULT '',
    ip_hash TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Shadow eval table ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS shadow_evals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    competition TEXT DEFAULT '',
    sport TEXT DEFAULT 'Football',
    agent_name TEXT NOT NULL,
    bet TEXT NOT NULL,
    confidence INTEGER DEFAULT 0,
    raison TEXT DEFAULT '',
    outcome TEXT DEFAULT NULL,
    final_score_home INTEGER DEFAULT NULL,
    final_score_away INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT DEFAULT NULL,
    UNIQUE(match_key, agent_name)
  );
`);

// ── Migration V2: League ratings + ANJ markets + Decision journal ──
db.exec(`
  CREATE TABLE IF NOT EXISTS league_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league TEXT NOT NULL,
    sport TEXT DEFAULT 'Football',
    total_predictions INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    winrate REAL DEFAULT 0,
    roi REAL DEFAULT 0,
    profit_loss REAL DEFAULT 0,
    coefficient REAL DEFAULT 0.60,
    class TEXT DEFAULT 'D',
    avg_confidence REAL DEFAULT 0,
    last_updated TEXT DEFAULT (datetime('now')),
    UNIQUE(league, sport)
  );
  CREATE TABLE IF NOT EXISTS anj_markets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition TEXT NOT NULL UNIQUE,
    sport TEXT DEFAULT 'Football',
    available_in_france INTEGER DEFAULT 1,
    markets_available TEXT DEFAULT '1X2,DoubleChance,OverUnder,BTTS',
    bookmakers TEXT DEFAULT 'Winamax,Unibet,PMU',
    fr_verified INTEGER DEFAULT 0,
    last_verified TEXT DEFAULT NULL
  );
  CREATE TABLE IF NOT EXISTS decision_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    match_key TEXT DEFAULT '',
    home TEXT DEFAULT '',
    away TEXT DEFAULT '',
    decision TEXT NOT NULL,
    reason TEXT DEFAULT '',
    score_final REAL DEFAULT 0,
    seuil REAL DEFAULT 85,
    score_ia REAL DEFAULT 0,
    coefficient_ligue REAL DEFAULT 0,
    coefficient_filtrage REAL DEFAULT 0,
    plan TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS agent_weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL UNIQUE,
    weight REAL DEFAULT 1.0,
    total_predictions INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    winrate REAL DEFAULT 0,
    roi REAL DEFAULT 0,
    last_updated TEXT DEFAULT (datetime('now'))
  );
`);

// ── Roster ACTUEL du Concile — source de vérité unique ───────────────────────
// Doit rester synchronisé avec `agentNames` dans runConcile(). agent_predictions
// conserve l'historique des agents retirés (GROQ-Llama, GPT Analysis, GeminiFlash,
// Mistral-7B, OR-*) : c'est voulu, on ne falsifie jamais l'historique. Mais leur
// agrégat ne doit plus apparaître dans agent_weights, sinon /admin/agents et les
// alertes "agent en baisse" restent pollués par des agents qui ne tournent plus.
const CONCILE_AGENT_NAMES = ["Perplexity-Web", "DeepSeek-V3", "Mistral-Large", "Cohere-Command", "OpenRouter-Qwen"];

// ── Initialise agent weights if empty ──
try {
  const agentCount = db.prepare("SELECT COUNT(*) as c FROM agent_weights").get().c;
  if (agentCount === 0) {
    const insert = db.prepare("INSERT OR IGNORE INTO agent_weights (agent_name, weight) VALUES (?, 1.0)");
    for (const name of CONCILE_AGENT_NAMES) insert.run(name);
    console.log(`[migration] Agent weights initialised with ${CONCILE_AGENT_NAMES.length} agents`);
  }
} catch(e) { console.error("[migration] agent_weights init:", e.message); }

// ── Initialise ANJ markets if empty ──
try {
  const anjCount = db.prepare("SELECT COUNT(*) as c FROM anj_markets").get().c;
  if (anjCount === 0) {
    const anjComps = [
      ["Premier League", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS,DNB", "Winamax,Unibet,PMU"],
      ["Ligue 1", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS,DNB", "Winamax,Unibet,PMU"],
      ["La Liga", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS,DNB", "Winamax,Unibet,PMU"],
      ["Serie A", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS,DNB", "Winamax,Unibet,PMU"],
      ["Bundesliga", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS,DNB", "Winamax,Unibet,PMU"],
      ["Champions League", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS,DNB", "Winamax,Unibet,PMU"],
      ["Europa League", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS,DNB", "Winamax,Unibet,PMU"],
      ["Serie B", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS", "Winamax,Unibet"],
      ["Championship", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS", "Winamax,Unibet"],
      ["Liga Portugal", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS", "Unibet,PMU"],
      ["Eredivisie", "Football", 1, "1X2,DoubleChance,OverUnder,BTTS", "Unibet,PMU"],
      ["MLS", "Football", 0, "1X2,DoubleChance,OverUnder,BTTS", "Winamax,Unibet"],
      ["NHL", "Hockey", 0, "1X2,OverUnder", "Winamax,Unibet"],
      ["NBA", "Basketball", 0, "1X2,OverUnder", "Winamax,Unibet"],
    ];
    const ins = db.prepare("INSERT OR IGNORE INTO anj_markets (competition, sport, available_in_france, markets_available, bookmakers) VALUES (?,?,?,?,?)");
    for (const row of anjComps) ins.run(...row);
    console.log("[migration] ANJ markets initialised");
  }
} catch(e) { console.error("[migration] ANJ init:", e.message); }

// ── Update league ratings from concile_analyses ──
// ── MISSION 005: Auto-refresh every 30 min ──
function refreshAISpecialization() {
  try {
    const rows = db.prepare("SELECT agent_name, bet as market_line, COUNT(*) as total, SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins, SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses, ROUND(AVG(confidence),0) as avg_conf FROM agent_predictions WHERE outcome IS NOT NULL AND outcome != 'pending' GROUP BY agent_name, bet").all();
    const upsert = db.prepare("INSERT INTO ai_market_specialization (agent_name, market_line, total, wins, losses, winrate, roi, avg_confidence, last_updated) VALUES (?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(agent_name, market_line) DO UPDATE SET total=excluded.total, wins=excluded.wins, losses=excluded.losses, winrate=excluded.winrate, roi=excluded.roi, avg_confidence=excluded.avg_confidence, last_updated=excluded.last_updated");
    for (const r of rows) {
      const total = r.total||0; const wins = r.wins||0; const losses = r.losses||0;
      upsert.run(r.agent_name, r.market_line, total, wins, losses, total>0?Math.round((wins/total)*10000)/100:0, total>0?Math.round(((wins-losses)/total)*10000)/100:0, r.avg_conf||0);
    }
  } catch(e) { console.error("[m005] ai_spec:", e.message); }
}
function refreshMonthlySnapshots() {
  try {
    const months = db.prepare("SELECT strftime('%Y',analysed_at) as y, strftime('%m',analysed_at) as m, COUNT(*) as t, SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as w, SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as l, ROUND(AVG(confidence),0) as ac FROM concile_analyses WHERE outcome IS NOT NULL AND outcome!='pending' AND analysed_at IS NOT NULL GROUP BY y,m").all();
    const upsert = db.prepare("INSERT INTO monthly_snapshots (year,month,total_predictions,wins,losses,winrate,roi,avg_confidence,created_at) VALUES (?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(year,month) DO UPDATE SET total_predictions=excluded.total_predictions,wins=excluded.wins,losses=excluded.losses,winrate=excluded.winrate,roi=excluded.roi,avg_confidence=excluded.avg_confidence,created_at=excluded.created_at");
    for (const r of months) {
      const t=r.t||0; const w=r.w||0; const l=r.l||0;
      upsert.run(parseInt(r.y), parseInt(r.m), t, w, l, t>0?Math.round((w/t)*10000)/100:0, t>0?Math.round(((w-l)/t)*10000)/100:0, r.ac||0);
    }
  } catch(e) { console.error("[m005] snapshots:", e.message); }
}
function checkSystemAlerts() {
  try {
    const badA = db.prepare("SELECT agent_name,winrate FROM agent_weights WHERE total_predictions>=10 AND winrate<50").all();
    for (const a of badA) {
      if (!db.prepare("SELECT 1 FROM system_alerts WHERE type='agent_decline' AND affected_entity=? AND resolved=0").get(a.agent_name))
        db.prepare("INSERT INTO system_alerts (type,severity,title,message,affected_entity) VALUES ('agent_decline','warning',?,?,?)").run("Agent en baisse: "+a.agent_name, a.agent_name+" winrate "+a.winrate+"%", a.agent_name);
    }
    const badL = db.prepare("SELECT league,winrate FROM league_ratings WHERE total_predictions>=10 AND winrate<45").all();
    for (const l of badL) {
      if (!db.prepare("SELECT 1 FROM system_alerts WHERE type='league_decline' AND affected_entity=? AND resolved=0").get(l.league))
        db.prepare("INSERT INTO system_alerts (type,severity,title,message,affected_entity) VALUES ('league_decline','warning',?,?,?)").run("Ligue en baisse: "+l.league, l.league+" winrate "+l.winrate+"%", l.league);
    }
  } catch(e) { console.error("[m005] alerts:", e.message); }
}
refreshAISpecialization();
refreshMonthlySnapshots();
checkSystemAlerts();
setInterval(refreshAISpecialization, 1800000);
setInterval(refreshMonthlySnapshots, 1800000);
setInterval(checkSystemAlerts, 1800000);

function refreshLeagueRatings() {
  try {
    const leagues = db.prepare(`
      SELECT competition as league, sport,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses,
        ROUND(AVG(confidence), 0) as avg_conf
      FROM concile_analyses
      WHERE outcome IS NOT NULL AND outcome != 'pending'
      GROUP BY competition, sport
    `).all();
    const upsert = db.prepare(`
      INSERT INTO league_ratings (league, sport, total_predictions, wins, losses, winrate, roi, avg_confidence, coefficient, class, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(league, sport) DO UPDATE SET
        total_predictions=excluded.total_predictions, wins=excluded.wins, losses=excluded.losses,
        winrate=excluded.winrate, roi=excluded.roi, avg_confidence=excluded.avg_confidence,
        coefficient=excluded.coefficient, class=excluded.class, last_updated=excluded.last_updated
    `);
    for (const l of leagues) {
      if (!l.league) continue;
      const total = l.total || 0;
      const wins = l.wins || 0;
      const losses = l.losses || 0;
      const winrate = total > 0 ? Math.round((wins / total) * 10000) / 100 : 0;
      const roi = total > 0 ? Math.round(((wins - losses) / total) * 10000) / 100 : 0;
      let cls = "E", coeff = 0.40;
      if (total >= 100 && winrate >= 75 && roi >= 5) { cls = "A"; coeff = 1.00; }
      else if (total >= 50 && winrate >= 65 && roi >= 0) { cls = "B"; coeff = 0.90; }
      else if (total >= 20 && winrate >= 55) { cls = "C"; coeff = 0.75; }
      else if (total >= 10 && winrate >= 40) { cls = "D"; coeff = 0.60; }
      upsert.run(l.league, l.sport || "Football", total, wins, losses, winrate, roi, l.avg_conf || 0, coeff, cls);
    }
    console.log(`[migration] League ratings updated: ${leagues.length} leagues`);
  } catch(e) { console.error("[migration] refreshLeagueRatings:", e.message); }
}

// ── Update agent weights from agent_predictions ──
// Restreint au roster actif : agent_predictions garde l'historique des agents
// retirés, mais leur agrégat ne doit pas réapparaître dans agent_weights à chaque
// redémarrage (cet UPSERT tourne au boot). On purge donc aussi les lignes hors roster.
function refreshAgentWeights() {
  try {
    const ph = CONCILE_AGENT_NAMES.map(() => "?").join(",");
    const pruned = db.prepare(`DELETE FROM agent_weights WHERE agent_name NOT IN (${ph})`).run(...CONCILE_AGENT_NAMES).changes;
    if (pruned > 0) console.log(`[migration] Agent weights: ${pruned} ligne(s) hors roster purgée(s)`);
    const agents = db.prepare(`
      SELECT agent_name,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM agent_predictions
      WHERE outcome IS NOT NULL AND outcome != 'pending'
        AND agent_name IN (${ph})
      GROUP BY agent_name
    `).all(...CONCILE_AGENT_NAMES);
    const upsert = db.prepare(`
      INSERT INTO agent_weights (agent_name, total_predictions, wins, losses, winrate, roi, weight, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(agent_name) DO UPDATE SET
        total_predictions=excluded.total_predictions, wins=excluded.wins, losses=excluded.losses,
        winrate=excluded.winrate, roi=excluded.roi,
        weight=excluded.weight, last_updated=excluded.last_updated
    `);
    for (const a of agents) {
      const total = a.total || 0;
      const wins = a.wins || 0;
      const losses = a.losses || 0;
      const winrate = total > 0 ? Math.round((wins / total) * 10000) / 100 : 0;
      const roi = total > 0 ? Math.round(((wins - losses) / total) * 10000) / 100 : 0;
      // Calculate dynamic weight: base 1.0, adjusted by winrate
      let weight = 1.0;
      if (total >= 5) {
        if (winrate >= 80) weight = 1.3;
        else if (winrate >= 70) weight = 1.15;
        else if (winrate >= 60) weight = 1.0;
        else if (winrate >= 50) weight = 0.85;
        else weight = 0.7;
      }
      upsert.run(a.agent_name, total, wins, losses, winrate, roi, weight);
    }
    console.log(`[migration] Agent weights updated: ${agents.length} agents`);
  } catch(e) { console.error("[migration] refreshAgentWeights:", e.message); }
}

// ── Run initial refresh ──
refreshLeagueRatings();
refreshAgentWeights();
// ── Auto-refresh every hour ──
setInterval(refreshLeagueRatings, 3600000);
setInterval(refreshAgentWeights, 3600000);

// ── Constants ─────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || (() => { console.error("[SECURITY] JWT_SECRET non défini dans .env — auth désactivée"); return require("crypto").randomBytes(32).toString("hex"); })();
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || "";
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_API_KEY || "";
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
// Utilisee pour la generation d'image (miniatures "combien on aurait gagne").
// Gemini (GOOGLE_API_KEY) essaye en premier le 01/08/2026 mais bloque par un
// quota de facturation image a 0 sur le compte Google — bascule sur OpenAI,
// dont la facturation est deja active (utilise par le Concile pour GPT-5).
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PRICE_ID_CARTE    = process.env.STRIPE_PRICE_ID_CARTE    || process.env.STRIPE_PRICE_CARTE   || "";
const STRIPE_PRICE_ID_STANDARD = process.env.STRIPE_PRICE_ID_STANDARD || process.env.STRIPE_PRICE_STANDARD || "";
const STRIPE_PRICE_ID_PREMIUM  = process.env.STRIPE_PRICE_ID_PREMIUM  || process.env.STRIPE_PRICE_PRO     || "";
const STRIPE_PRICE_ID_ELITE    = process.env.STRIPE_PRICE_ID_ELITE    || process.env.STRIPE_PRICE_ELITE   || "";
const STRIPE_PRICE_ID_VIP      = process.env.STRIPE_PRICE_ID_VIP      || process.env.STRIPE_PRICE_VIP     || "";
// Offre de lancement temporaire (demande fondateur 30/07/2026, "pour l'instant") :
// tout nouvel abonne Elite-VIP recoit 1 mois offert en plus. Toggle par env var
// pour pouvoir l'arreter sans toucher au code quand la periode de lancement
// sera terminee.
const ELITE_LAUNCH_BONUS_ENABLED = String(process.env.ELITE_LAUNCH_BONUS_ENABLED ?? "true").toLowerCase() !== "false";
const ELITE_LAUNCH_BONUS_DAYS = Number(process.env.ELITE_LAUNCH_BONUS_DAYS || 30);
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "noreply@touslesmatchs.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "TousLesMatchs";
const BREVO_LIST_ID = Number(process.env.BREVO_LIST_ID || 0);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
// Trois anciens noms existent encore dans certains .env du VPS. Accepter les
// trois évite qu'un simple renommage coupe entièrement le canal gratuit.
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID
  || process.env.TELEGRAM_FREE_CHANNEL_ID
  || process.env.TELEGRAM_CHAT_ID
  || ""; // Gratuit (vitrine)
const TELEGRAM_PREMIUM_CHANNEL_ID = process.env.TELEGRAM_PREMIUM_CHANNEL_ID || ""; // Premium 14.90€
// Canaux Standard (4.90€) et Elite (29.90€). Tant que l'ID n'est pas configuré dans le
// .env, on retombe automatiquement sur le canal Premium pour ne rien casser en attendant
// que le canal dédié soit créé. Le CODE applique les conditions par palier (voir plus bas).
const TELEGRAM_STANDARD_CHANNEL_ID = process.env.TELEGRAM_STANDARD_CHANNEL_ID || TELEGRAM_PREMIUM_CHANNEL_ID || "";
const TELEGRAM_ELITE_CHANNEL_ID = process.env.TELEGRAM_ELITE_CHANNEL_ID || "";
const TELEGRAM_RU_FREE_CHANNEL_ID = process.env.TELEGRAM_RU_FREE_CHANNEL_ID || "";
const TELEGRAM_RU_STANDARD_CHANNEL_ID = process.env.TELEGRAM_RU_STANDARD_CHANNEL_ID || "";
const TELEGRAM_RU_PREMIUM_CHANNEL_ID = process.env.TELEGRAM_RU_PREMIUM_CHANNEL_ID || "";
const TELEGRAM_GOAL05_INVITE_URL = process.env.TELEGRAM_GOAL05_INVITE_URL || "";
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "";
const TELEGRAM_SUPPORT_CHAT_ID = process.env.TELEGRAM_SUPPORT_CHAT_ID || "";
const _integrationHealth = {
  brevo: { configured: !!BREVO_API_KEY, ok: null, checked_at: null },
  telegram: { configured: !!TELEGRAM_BOT_TOKEN, ok: null, checked_at: null, channels: {} },
};
const _signalSentCache = new Set();
const _freeSignalDailyDate = { date: "", count: 0 };
const _standardSignalDaily = { date: "", count: 0 };
const _premiumSignalDaily = { date: "", count: 0 };
const _eliteSignalDaily = { date: "", count: 0 };
const _recoverySignalDaily = { date: "", count: 0 };
// Plafonds journaliers par palier (conditions données par le fondateur)
const STANDARD_SIGNAL_DAILY_CAP = 3;  // 🟢 tri ultra-sélectif : football, conf ≥ 88, cote réelle ARJEL 1.30-2.50
const PREMIUM_SIGNAL_DAILY_CAP = 10;  // 🟣 plus de volume : football, conf ≥ 84, cote 1.30-2.50 (inclut Standard)
const ELITE_SIGNAL_DAILY_CAP = 30;    // 🟠 radar football élargi : conf ≥ 82 (inclut Premium)
// Seuils volontairement décroissants : un palier supérieur est PLUS LARGE, donc reçoit
// davantage. L'inverse (Standard ≥ 88 et Premium ≥ 90) rendait les deux paliers
// identiques, puisque « ≥ 88 » contient déjà tout « ≥ 90 ».
//
// Valeurs calées sur la distribution RÉELLE mesurée le 25/07/2026 (analyses résolues,
// cote réelle ≥ 1.50, depuis le 03/07/2026) — surtout ne pas les remonter sans
// remesurer, un seuil trop haut vide complètement un palier payant :
//   ≥ 88 :  11 analyses · 100 % · +86 €     → Standard (~0,5/jour)
//   84-85 :  62 analyses · 83,9 % · +274 €   → Premium  (~3,3/jour cumulé)
//   82-83 : 141 analyses · 70,9 % · +428 €   → Elite    (~9,7/jour cumulé)
// Aucune analyse au-dessus de 89 sur la période : un seuil à 90 ou 92 produit ZÉRO signal.
// Elite valait 85 ici, identique a Premium : aucun assouplissement reel malgre
// le discours commercial "Elite = le plus permissif". C'etait deja contraire a
// la calibration du 25/07/2026 juste au-dessus (82-83 pour Elite, 84-85 pour
// Premium). Corrige le 29/07/2026 sur decision du fondateur : Elite redescend
// a 82, seul vrai levier de volume propre a ce palier (en plus du multisport).
// Redescendu a 75 le 03/08/2026 (Greg) : le palier Elite manquait de volume
// certains jours (0-3 signaux). Standard/Premium INCHANGES — la demande porte
// explicitement sur Elite seul. Promesse commerciale "Elite ≥82%" mise a jour
// en "≥75%" partout (site, emails, Telegram) en meme temps que ce seuil.
const STANDARD_MIN_CONF = 72, PREMIUM_MIN_CONF = 72;
// Seuil Elite saisonnier — releve de 75% a 80% le 04/08/2026 (decision
// fondateur) : le plancher a 75% laissait passer des signaux dont le winrate
// reel ne tenait pas la promesse (72-75% constate sur le canal Pro le meme
// jour), juge insuffisant pour des abonnes payants. 80% devient le plancher,
// jusqu'a la remontee prevue a 82% le 15 aout quand tous les championnats
// redemarrent (gros volume de matchs => plus besoin d'un plancher bas pour
// avoir du volume). Fonction (pas une const figee au demarrage) : le serveur
// peut tourner plusieurs jours sans redeploiement, la bascule doit avoir lieu
// meme sans redemarrer le conteneur.
// Report du 15/08 au 01/09/2026 (decision fondateur du 07/08/2026) : la reprise
// des championnats le 15 aout est justement le moment ou il faut OBSERVER, pas
// durcir. Remonter le plancher a 82% le jour meme de la reprise aurait coupe le
// volume au moment ou on a enfin des matchs a analyser, sans aucune donnee
// reelle sur la nouvelle saison. On garde 75% pendant les deux premieres
// semaines de championnat, puis 82% le 1er septembre avec des stats de saison.
const ELITE_TIER_RAMP_UP_DATE = new Date("2026-09-01T00:00:00Z").getTime();
// Plancher general redescendu 80->75 le 05/08/2026 : analyse sur 30 jours
// (874 signaux) montrant un winrate reel IDENTIQUE entre 75-79% (75.9%) et
// 80-84% (75.7%) — le seuil 80% coupait des matchs sans aucun gain de
// fiabilite, juste moins de volume. Decision fondateur.
function getEliteMinConf() { return Date.now() < ELITE_TIER_RAMP_UP_DATE ? 75 : 82; }
// Fenetre de cote reelle demandee le 02/09/2026 : jamais sous 1.40 ni au-dessus de 2.10.
const TIER_MIN_REAL_ODD = Math.max(1.30, Number(process.env.TIER_MIN_REAL_ODD || 1.30));
const TIER_MAX_REAL_ODD = Math.min(2.10, Number(process.env.TIER_MAX_REAL_ODD || 2.10));
// Sports diffusables sur TOUS les paliers payants. Restreindre les paliers d'entrée
// au football n'avait aucune justification : un signal hockey à 90 % vaut mieux qu'un
// signal football à 84 %, et un mardi sans football vidait le palier.
const DIFFUSABLE_SPORTS = ["football", "hockey", "ice hockey", "baseball", "basketball", "basket"];
const ELITE_SPORTS = DIFFUSABLE_SPORTS; // conservé : encore référencé par tierEligible()

// ── Seuils dynamiques par palier — garantissent le VOLUME vendu ───────────────
// Un seuil FIXE est fragile : si le Concile devient moins confiant, le palier se
// vide et le client paie pour rien (cas réel : seuil Standard à 92 → zéro signal).
// Ici c'est la QUANTITÉ qui différencie les paliers, pas le seuil. On cherche
// chaque jour le niveau de confiance qui a historiquement produit le quota visé :
// « quel seuil laisse passer 3 signaux par jour ? » → c'est celui du Standard.
// Conséquence : le quota est servi quel que soit le niveau de confiance du moment,
// et le vivier commun inclut tous les sports (plus de palier à sec faute de football).
const TIER_THRESHOLD_WINDOW_DAYS = 30;
let _tierThresholdCache = { day: "", value: null };
function getTierThresholds() {
  return { standard: 72, premium: 72, elite: 72, source: "seuil fixe 4/5 valide le 30/08/2026" };
  const today = new Date().toISOString().slice(0, 10);
  if (_tierThresholdCache.day === today && _tierThresholdCache.value) return _tierThresholdCache.value;
  // Repli : les constantes calées sur la mesure du 25/07/2026.
  const fallback = { standard: STANDARD_MIN_CONF, premium: PREMIUM_MIN_CONF, elite: getEliteMinConf(), source: "fixe" };
  // Elite n’est plus une offre client : si son canal est absent, Premium devient
  // le palier supérieur et hérite du vivier diffusable de l’ancien Elite.
  if (!TELEGRAM_ELITE_CHANNEL_ID) fallback.premium = fallback.elite;
  try {
    const confs = db.prepare(`
      SELECT confidence FROM concile_analyses
      WHERE analysed_at >= datetime('now','-${TIER_THRESHOLD_WINDOW_DAYS} days')
        AND confidence >= ${getPublishedMinConfidence()}
        AND real_odd >= ${TIER_MIN_REAL_ODD}
        AND real_odd <= ${TIER_MAX_REAL_ODD}
      ORDER BY confidence DESC
    `).all().map(r => Number(r.confidence) || 0).filter(Boolean);
    // Sous 30 analyses l'échantillon ne dit rien de fiable : on garde les constantes.
    if (confs.length < 30) { _tierThresholdCache = { day: today, value: fallback }; return fallback; }
    // Les confiances sont quantifiées (82, 83, 84, 85, 88, 89…) : un quantile brut
    // tombe sur des ex æquo et déborde largement le quota. On retient donc la valeur
    // DISTINCTE dont le nombre de signaux est le plus proche du quota visé.
    const distinct = [...new Set(confs)].sort((a, b) => b - a);
    const quantile = (perDay) => {
      const target = Math.max(1, Math.round(perDay * TIER_THRESHOLD_WINDOW_DAYS));
      let best = distinct[0], bestGap = Infinity;
      for (const v of distinct) {
        const gap = Math.abs(confs.filter(c => c >= v).length - target);
        if (gap < bestGap) { bestGap = gap; best = v; }
      }
      return best;
    };
    const t = {
      standard: quantile(STANDARD_SIGNAL_DAILY_CAP),
      premium:  quantile(PREMIUM_SIGNAL_DAILY_CAP),
      elite:    getSignalFloor(), // Elite = tout le vivier diffusable, au plancher du portail
      source: `${confs.length} analyses / ${TIER_THRESHOLD_WINDOW_DAYS} j`,
    };
    // Imbrication garantie : Standard ≥ Premium ≥ Elite (payer plus = recevoir plus).
    t.premium = Math.min(t.premium, t.standard);
    t.elite   = Math.min(t.elite, t.premium);
    // Offre Elite supprimée côté client : Premium doit recevoir les signaux qui
    // auraient auparavant été classés Elite, sinon ils tombent dans un canal vide.
    if (!TELEGRAM_ELITE_CHANNEL_ID) t.premium = t.elite;
    // Jamais sous le plancher de publication.
    // Le portail de diffusion exige déjà getSignalFloor() : un seuil de palier inférieur
    // serait lettre morte. C'est le plafond journalier (3/10/30) qui différencie les
    // paliers, pas le seuil de confiance.
    for (const k of ["standard", "premium", "elite"]) t[k] = Math.max(getSignalFloor(), t[k]);
    console.log(`[tier-thresholds] Standard ≥${t.standard} · Premium ≥${t.premium} · Elite ≥${t.elite} (${t.source})`);
    _tierThresholdCache = { day: today, value: t };
    return t;
  } catch (e) {
    console.error("[tier-thresholds]", e.message);
    return fallback;
  }
}

// Vérifie au démarrage que chaque canal configuré existe et que le bot y a accès.
// Un ID périmé (typiquement après migration d'un groupe en supergroupe, où l'ID
// change) faisait échouer les envois EN SILENCE : sendTelegramMessage renvoie
// simplement false. Ce contrôle rend le problème visible immédiatement.
function verifyTelegramChannels() {
  if (!TELEGRAM_BOT_TOKEN) {
    _integrationHealth.telegram.ok = false;
    _integrationHealth.telegram.checked_at = new Date().toISOString();
    return;
  }
  const channels = [
    ["Gratuit",  TELEGRAM_CHANNEL_ID],
    ["Standard", TELEGRAM_STANDARD_CHANNEL_ID],
    ["Premium",  TELEGRAM_PREMIUM_CHANNEL_ID],
    ...(TELEGRAM_ELITE_CHANNEL_ID ? [["Elite", TELEGRAM_ELITE_CHANNEL_ID]] : []),
    ["RU Gratuit",  TELEGRAM_RU_FREE_CHANNEL_ID],
    ["RU Standard", TELEGRAM_RU_STANDARD_CHANNEL_ID],
    ["RU Premium",  TELEGRAM_RU_PREMIUM_CHANNEL_ID],
    ["Admin",    TELEGRAM_ADMIN_CHAT_ID],
  ];
  // Tous les canaux commencent a "non verifies". Sans cette initialisation,
  // le premier getChat reussi pouvait faire passer l'etat global a true alors
  // que les quatre autres controles etaient encore en vol.
  for (const [label] of channels) {
    _integrationHealth.telegram.channels[label.toLowerCase()] = false;
  }
  _integrationHealth.telegram.ok = false;
  _integrationHealth.telegram.checked_at = new Date().toISOString();
  for (const [label, id] of channels) {
    if (!id) {
      console.warn(`[telegram-check] ${label} : NON CONFIGURÉ`);
      continue;
    }
    https.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(id)}`, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const j = JSON.parse(data);
          if (!j.ok) {
            _integrationHealth.telegram.channels[label.toLowerCase()] = false;
            console.error(`[telegram-check] ❌ ${label} (${id}) INJOIGNABLE — ${j.description || "erreur"} — les messages de ce palier ne partiront PAS`);
          } else {
            _integrationHealth.telegram.channels[label.toLowerCase()] = true;
            const t = j.result.type;
            const warn = t === "group" ? "  ⚠️ groupe simple : son ID changera lors de la migration en supergroupe" : "";
            console.log(`[telegram-check] ✅ ${label} : ${j.result.title || id} (${t})${warn}`);
          }
          const requiredTelegramChannels = ["gratuit", "standard", "premium", "ru gratuit", "ru standard", "ru premium", "admin"];
          const states = requiredTelegramChannels
            .filter(k => Object.prototype.hasOwnProperty.call(_integrationHealth.telegram.channels, k))
            .map(k => _integrationHealth.telegram.channels[k]);

          _integrationHealth.telegram.ok =
            states.length === requiredTelegramChannels.length &&
            states.every(Boolean);
          _integrationHealth.telegram.checked_at = new Date().toISOString();
        } catch {
          _integrationHealth.telegram.channels[label.toLowerCase()] = false;
          _integrationHealth.telegram.ok = false;
          _integrationHealth.telegram.checked_at = new Date().toISOString();
          console.error(`[telegram-check] ${label} : réponse illisible`);
        }
      });
    }).on("error", (e) => {
      _integrationHealth.telegram.channels[label.toLowerCase()] = false;
      _integrationHealth.telegram.ok = false;
      _integrationHealth.telegram.checked_at = new Date().toISOString();
      console.error(`[telegram-check] ${label} : ${e.message}`);
    });
  }
}

async function verifyBrevoConfiguration() {
  _integrationHealth.brevo.checked_at = new Date().toISOString();
  if (!BREVO_API_KEY) {
    _integrationHealth.brevo.ok = false;
    console.error("[brevo-check] BREVO_API_KEY NON CONFIGURÉE — aucun email ne partira");
    return false;
  }
  try {
    const account = await httpGet("https://api.brevo.com/v3/account", { "api-key": BREVO_API_KEY });
    const ok = !!account && !account.code && !account.error;
    _integrationHealth.brevo.ok = ok;
    _integrationHealth.brevo.checked_at = new Date().toISOString();
    if (ok) console.log("[brevo-check] ✅ API Brevo joignable");
    else console.error(`[brevo-check] ❌ clé refusée — ${String(account?.message || "erreur API").slice(0, 120)}`);
    return ok;
  } catch (e) {
    _integrationHealth.brevo.ok = false;
    _integrationHealth.brevo.checked_at = new Date().toISOString();
    console.error(`[brevo-check] ❌ ${e.message}`);
    return false;
  }
}

// Diffuse un message identique à tous les canaux payants. Le FORMAT est le même
// partout — seul le volume diffère, via les plafonds et seuils de chaque palier.
// Dédoublonnage par chat_id : tant qu'un palier n'a pas de canal dédié il retombe
// sur Premium, et on ne veut pas envoyer deux fois le même message au même canal.
// includeStandard=false réserve le message aux paliers supérieurs (modèle imbriqué).
function sendToPaidChannels(text, opts = {}) {
  const targets = [];
  const push = (id, label) => { if (id && !targets.some(t => t.id === id)) targets.push({ id, label }); };
  if (opts.includeStandard !== false) push(TELEGRAM_STANDARD_CHANNEL_ID, "standard");
  push(TELEGRAM_PREMIUM_CHANNEL_ID, "premium");
  // Elite supprime du runtime client
  return Promise.all(targets.map(t =>
    sendTelegramMessage(t.id, text)
      .then(ok => console.log(`[${opts.tag || "telegram"}] ${t.label}: ${ok ? "OK" : "FAIL"}`))
  ));
}
const _freeResultDailyDate = { date: "", count: 0 };
let _adaptiveThresholdCache = { value: 75, computedAt: 0 };
// Plancher aligné sur la promesse Elite-VIP ("≥75% de confiance", CLAUDE.md).
// Avant : 85, ce qui bloquait tout signal Elite entre 82 et 84% alors que le
// palier est vendu à partir de 82% — constaté le 30/07/2026 (analyse à 82%
// jamais diffusée malgré éligibilité Elite).
// Redescendu de 82 à 75 le 03/08/2026 (Greg) : le palier Elite manquait de
// volume certains jours. Standard/Premium ne sont PAS concernés — leur seuil
// réel vient de quantile() ci-dessus, qui cible un volume précis (3/j, 10/j)
// et reste naturellement bien au-dessus de ce plancher.
// Devenu saisonnier le 04/08/2026 : voir getEliteMinConf() — 75 jusqu'au 15
// aout, 82 ensuite. Fonction (pas une const) pour retomber a 82 sans redeploiement.
// Décision qualité du 01/09/2026 : aucun signal client O/U 2,5 sous 78 %.
function getSignalFloor() { return 77; }

// Confiance minimale pour qu'une analyse apparaisse en VITRINE (résultats du jour,
// historique, stats). En dessous, c'est de l'analyse interne du Concile (page Live
// IA) qui ne part pas sur Telegram → on ne la montre pas comme un "pick". Réglable.
// Alignée sur getSignalFloor() le 03/08/2026 pour que le site affiche bien
// tout ce qui part réellement sur Telegram Elite — éviter un signal envoyé
// aux abonnés mais absent des résultats publics du site.
function getPublishedMinConfidence() { return getSignalFloor(); }
// ── Seuils spécifiques par marché ────────────────────────────────────────────
// Certains marchés ont un winrate historique nettement supérieur → seuil abaissé.
// "But 1ère MT" est notre point fort : 82% de winrate sur 931 pronos historiques
// (Cohere-Command, juillet 2026). On peut donc émettre à 75% de confiance sans
// dégrader la qualité perçue.
const MARKET_SIGNAL_FLOORS = {
  "But en 1ère mi-temps":       75,
  "Aucun but en 1ère mi-temps": 75,
};

function getSignalThresholdForBet(bet) {
  // Le produit client O/U 2,5 suit un seuil explicite et auditable.
  if (isOu25Bet(bet)) return CLIENT_OU25_MIN_CONFIDENCE;
  const overrideForBet = MARKET_SIGNAL_FLOORS[bet];
  if (overrideForBet !== undefined) return Math.max(getSignalFloor(), overrideForBet);
  return getAdaptiveSignalThreshold();
}

function getAdaptiveSignalThreshold() {
  const now = Date.now();
  if (now - _adaptiveThresholdCache.computedAt < 30 * 60 * 1000) return _adaptiveThresholdCache.value;
  try {
    const rows = db.prepare(`
      SELECT confidence, outcome FROM concile_analyses
      WHERE confidence >= ${getSignalFloor()} AND outcome IN ('win','loss')
      ORDER BY analysed_at DESC LIMIT 100
    `).all();
    if (rows.length < 15) {
      _adaptiveThresholdCache = { value: getSignalFloor(), computedAt: now };
      return getSignalFloor();
    }
    // La tranche basse part du plancher saisonnier (getSignalFloor(), 75 jusqu'au
    // 15/08 puis 82) et non d'une valeur figee a 82 — sinon la promesse Elite a 75%
    // ne peut jamais s'appliquer, quelle que soit la qualite des picks 75-82%
    // (constate le 04/08/2026 : signal a 77% bloque alors que l'Elite promet 75%).
    const brackets = [
      { min: getSignalFloor(), max: 85, wins: 0, total: 0 },
      { min: 85, max: 88, wins: 0, total: 0 },
      { min: 88, max: 91, wins: 0, total: 0 },
      { min: 91, max: 94, wins: 0, total: 0 },
      { min: 94, max: 101, wins: 0, total: 0 },
    ];
    for (const r of rows) {
      for (const b of brackets) {
        if (r.confidence >= b.min && r.confidence < b.max) {
          b.total++;
          if (r.outcome === "win") b.wins++;
          break;
        }
      }
    }
    let threshold = getSignalFloor();
    let cumTotal = 0, cumWins = 0;
    for (const b of brackets) {
      cumTotal += b.total;
      cumWins += b.wins;
    }
    let runTotal = 0, runWins = 0;
    for (const b of brackets) {
      const aboveTotal = cumTotal - runTotal;
      const aboveWins = cumWins - runWins;
      const aboveWinrate = aboveTotal > 0 ? Math.round(aboveWins / aboveTotal * 100) : 0;
      // ⚠️ Barre remise a 65 le 06/08/2026 apres un aller-retour.
      // Je l'avais relevee a 82 la veille pour que "Signal Fort" designe une
      // tranche vraiment superieure. Effet reel mesure le lendemain : le seuil
      // de diffusion a converge a 85, et PLUS AUCUN signal n'est parti pendant
      // deux jours (motifs "confiance X < seuil 85" sur toutes les analyses).
      // Le raisonnement de depart n'etait pas faux, mais il portait sur le
      // libelle d'un badge ; le cout etait l'arret complet de la diffusion.
      // Ne pas relever cette valeur sans verifier, sur plusieurs jours, combien
      // de signaux passent encore reellement.
      if (aboveWinrate >= 65 && aboveTotal >= 5) {
        threshold = b.min;
        break;
      }
      runTotal += b.total;
      runWins += b.wins;
    }
    console.log(`[adaptive-threshold] Seuil Signal Fort ajusté: ${threshold}% (basé sur ${rows.length} analyses récentes)`);
    _adaptiveThresholdCache = { value: threshold, computedAt: now };
    return threshold;
  } catch (e) {
    console.error("[adaptive-threshold]", e.message);
    return _adaptiveThresholdCache.value || getSignalFloor();
  }
}

// ── Shadow agents (banc d'essai — free tiers) ─────────────────────────────────
const MISTRAL_API_KEY    = process.env.MISTRAL_API_KEY    || "";
const CEREBRAS_API_KEY   = process.env.CEREBRAS_API_KEY   || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const COHERE_API_KEY     = process.env.COHERE_API_KEY     || "";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "";
const TOGETHER_API_KEY   = process.env.TOGETHER_API_KEY   || "";

// ── Substitution automatique des modeles morts (07/08/2026) ──────────────────
// Panne trouvee ce jour-la : 93% des analyses sans aucun vote, Concile a l'arret
// depuis des jours. Cause reelle — ni les credits (compte OpenRouter sain, sans
// plafond), ni les cles : trois identifiants de modeles avaient simplement
// disparu du catalogue OpenRouter. mistralai/mistral-7b-instruct:free et
// cohere/command-r-plus renvoyaient 404, perplexity/sonar-pro un 400.
//
// Un fournisseur fait tourner son catalogue en permanence. Coder un identifiant
// en dur, c'est accepter que le Concile meure en silence le jour ou il est
// retire. La table ci-dessous permet de le remplacer sans redeploiement, et
// auditAndRepairModels() la remplit toute seule chaque matin.
db.exec(`
  CREATE TABLE IF NOT EXISTS model_overrides (
    logical_id  TEXT PRIMARY KEY,
    model_id    TEXT NOT NULL,
    replaced_at TEXT DEFAULT (datetime('now')),
    reason      TEXT DEFAULT ''
  );
`);

const _modelOverrideCache = { at: 0, map: {} };
// Resolution a CHAQUE appel, avec un cache de 60s : une substitution decidee a
// 6h du matin doit s'appliquer sans attendre un redemarrage du conteneur.
function resolveModel(logicalId) {
  if (Date.now() - _modelOverrideCache.at > 60000) {
    try {
      const rows = db.prepare("SELECT logical_id, model_id FROM model_overrides").all();
      _modelOverrideCache.map = Object.fromEntries(rows.map(r => [r.logical_id, r.model_id]));
      _modelOverrideCache.at = Date.now();
    } catch (e) { /* table pas encore creee au tout premier boot */ }
  }
  return _modelOverrideCache.map[logicalId] || logicalId;
}

const SHADOW_AGENTS = [
  // ── IA gratuites immédiates (clé Groq déjà configurée, aucun ajout requis) ──
  {
    name: "Groq-Llama70B",
    icon: "🦙",
    enabled: () => !!GROQ_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
    }),
  },
  // Groq-Llama8B retiré le 15 juillet 2026 : 43% de winrate sur 255 résolus
  // (audit /admin/full-agents-audit). Sous-performance chronique. À réactiver
  // seulement si Groq publie une v2 sensiblement meilleure.
  {
    name: "Mistral-Small",
    icon: "🌊",
    enabled: () => !!MISTRAL_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://api.mistral.ai/v1/chat/completions",
      key: MISTRAL_API_KEY,
      model: "mistral-small-latest",
    }),
  },
  {
    name: "Cerebras-Llama",
    icon: "⚡",
    enabled: () => !!CEREBRAS_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: CEREBRAS_API_KEY,
      model: "llama3.1-8b",
    }),
  },
  {
    name: "OR-Mistral7B",
    icon: "🔓",
    enabled: () => !!OPENROUTER_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: OPENROUTER_API_KEY,
      model: resolveModel("mistralai/mistral-7b-instruct:free"),
    }),
  },
  {
    name: "Qwen-3.7-Max",
    icon: "🧬",
    // Shadow désactivé : Qwen reste titulaire dans le Conseil IA.
    enabled: () => false,
    call: (prompt) => callOpenRouter(prompt, process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max"),
  },
  // ── Nouveaux modèles au banc d'essai (test à blanc, aucun impact sur les picks) ──
  // Les identifiants sont surchargeables par .env : si OpenRouter renomme un modèle
  // ou si l'ID est erroné, on corrige sans redéployer. Un ID invalide se voit
  // désormais dans les logs ("SANS RÉPONSE — model not found"), plus en silence.
  {
    name: "OR-Qwen37Max",
    icon: "🌟",
    // Redevenu titulaire : ne pas le doubler en shadow sur le même match.
    enabled: () => false,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: OPENROUTER_API_KEY,
      model: resolveModel(process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max"),
    }),
  },
  {
    name: "OR-KimiK3",
    icon: "🌙",
    // Replacé au banc automatique le 01/09/2026 après la baisse observée.
    // Il reste évalué à blanc, sans influencer les cinq votes officiels.
    enabled: () => !!OPENROUTER_API_KEY
      && ["1", "true"].includes(String(process.env.OPENROUTER_KIMI_TEST_ENABLED || "true").toLowerCase()),
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: OPENROUTER_API_KEY,
      model: resolveModel(process.env.OR_KIMI_MODEL || "moonshotai/kimi-k2"),
    }),
  },
];

// ── Telegram helper ──────────────────────────────────────────────────────────
// Echappe le texte insere dans un message Telegram en parse_mode HTML. Sans
// ca, un simple "<" ou "&" dans un texte dynamique (raison generee par une IA,
// nom d'equipe/competition venant de l'API) fait rejeter le message ENTIER par
// Telegram ("can't parse entities"). N'echappe jamais la balise elle-meme :
// a utiliser uniquement sur le contenu injecte, pas sur les <b>/<i> qu'on ecrit.
function escTgHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Miroir client russe : seuls les trois canaux CLIENTS francais sont recopies.
// Hermès/Admin/Support ne figurent volontairement pas dans cette table.
function russianClientChannelFor(frenchChatId) {
  const source = String(frenchChatId || "");
  if (source === String(TELEGRAM_CHANNEL_ID || "") ||
      source === String(process.env.TELEGRAM_FREE_CHANNEL_ID || "")) {
    return { id: TELEGRAM_RU_FREE_CHANNEL_ID, tier: "free" };
  }
  if (source === String(TELEGRAM_STANDARD_CHANNEL_ID || "")) {
    return { id: TELEGRAM_RU_STANDARD_CHANNEL_ID, tier: "standard" };
  }
  if (source === String(TELEGRAM_PREMIUM_CHANNEL_ID || "")) {
    return { id: TELEGRAM_RU_PREMIUM_CHANNEL_ID, tier: "premium" };
  }
  return null;
}

// Traduction deterministe des gabarits Telegram. Les equipes, scores, minutes,
// cotes et noms de competitions restent strictement identiques.
function translateTelegramClientRu(input) {
  let text = String(input || "");
  const replacements = [
    [/SIGNAL CONSEIL IA DÉTECTÉ/gi, "СИГНАЛ ИИ ОБНАРУЖЕН"],
    [/SIGNAL CONSEIL IA/gi, "СИГНАЛ ИИ"],
    [/SIGNAL FORT GAGNÉ/gi, "СИЛЬНЫЙ СИГНАЛ — ВЫИГРЫШ"],
    [/SIGNAL FORT PERDU/gi, "СИЛЬНЫЙ СИГНАЛ — ПРОИГРЫШ"],
    [/STRONG SIGNAL WON/gi, "СИЛЬНЫЙ СИГНАЛ — ВЫИГРЫШ"],
    [/STRONG SIGNAL LOST/gi, "СИЛЬНЫЙ СИГНАЛ — ПРОИГРЫШ"],
    [/every result stays public, wins and losses alike/gi, "все результаты публикуются: и выигрыши, и проигрыши"],
    [/BILAN DU JOUR/gi, "ИТОГИ ДНЯ"],
    [/Signaux réellement diffusés/gi, "Реально отправленные сигналы"],
    [/Score final/gi, "Итоговый счёт"],
    [/Score de confiance/gi, "Уровень доверия"],
    [/Signal\s*:/gi, "Прогноз:"],
    [/Palier\s*:/gi, "Уровень:"],
    [/S'abonner à Standard — 4,90€\/mois/gi, "Подписаться на Стандарт — 4,90 €\/месяц"],
    [/STANDARD/g, "СТАНДАРТ"],
    [/PREMIUM/g, "ПРЕМИУМ"],
    [/Vote IA/gi, "Голосование ИИ"],
    [/Résultat vérifiable demain sur le site/gi, "Результат можно проверить завтра на сайте"],
    [/Résultats complets : gagnés comme perdus/gi, "Полные результаты: выигрыши и проигрыши"],
    [/Résultats complets dans le canal/gi, "Полные результаты внутри канала"],
    [/La sélection exacte et la raison sont réservées aux membres/gi, "Точный прогноз и обоснование доступны только подписчикам"],
    [/Imagine si tu avais eu le pick en direct/gi, "Представьте, если бы вы получили прогноз в прямом эфире"],
    [/Recevoir tous les signaux dès 4,90€/gi, "Получать все сигналы от 4,90 €"],
    [/La discipline fait la différence sur le long terme/gi, "Дисциплина приносит результат на дистанции"],
    [/Jeu responsable/gi, "Ответственная игра"],
    [/Responsible gaming/gi, "Ответственная игра"],
    [/Conseil IA/gi, "Совет ИИ"],
    [/Championnat/gi, "Чемпионат"],
    [/Gagnés/gi, "Выиграно"],
    [/Perdus/gi, "Проиграно"],
    [/Réussite/gi, "Успешность"],
    [/gagnés sur/gi, "выигрышей из"],
    [/Mise 10€/gi, "Ставка 10 €"],
    [/Gain/gi, "Выплата"],
    [/Cote/gi, "Коэффициент"],
    [/Under 2[.,]5 buts/gi, "Тотал меньше 2,5 голов"],
    [/Over 2[.,]5 buts/gi, "Тотал больше 2,5 голов"],
    [/Under 2\.5 goals/gi, "Тотал меньше 2,5 голов"],
    [/Over 2\.5 goals/gi, "Тотал больше 2,5 голов"],
    [/unanime/gi, "единогласно"],
    [/Score :/gi, "Счёт:"],
    [/minute/gi, "минута"],
  ];
  for (const [pattern, value] of replacements) text = text.replace(pattern, value);
  return text;
}

function sendTelegramMessage(chatId, text, deliveryMeta = null, skipRussianMirror = false) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return Promise.resolve(false);
  // Hermes est un canal d'administration: un seul digest automatique par jour.
  // Les alertes horaires, signaux admin, rapports secondaires et relances apres
  // redemarrage restent dans les logs, sans polluer Telegram.
  if (String(chatId) === String(TELEGRAM_ADMIN_CHAT_ID)
      && deliveryMeta?.adminDailyDigest !== true) {
    console.log("[telegram-admin] bloque: digest quotidien uniquement");
    return Promise.resolve(false);
  }
  const payload = { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true };
  const frenchClientSignal = !skipRussianMirror
    && !!deliveryMeta?.matchKey
    && ["free", "standard", "premium"].includes(String(deliveryMeta?.channel || ""));
  if (frenchClientSignal) {
    payload.reply_markup = { inline_keyboard: buildInlineKeyboard() };
  }
  const body = JSON.stringify(payload);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        // La cause reelle d'un echec (entites HTML mal formees, chat_id invalide,
        // bot banni, rate limit 429...) etait jusque-la totalement invisible :
        // seul un booleen remontait, jamais le message d'erreur de Telegram.
        // Constate le 30/07/2026 : impossible de diagnostiquer pourquoi des
        // signaux "envoyes" n'arrivaient jamais sans cette trace.
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok !== true) {
            console.error(`[telegram] echec envoi chat_id=${chatId}: ${parsed.description || "raison inconnue"} (code ${parsed.error_code || "?"})`);
          }
          if (deliveryMeta?.matchKey && deliveryMeta?.channel) {
            try {
              db.prepare(`INSERT INTO telegram_signal_deliveries
                (match_key, channel, telegram_message_id, market, vote_count, ok, error)
                VALUES (?,?,?,?,?,?,?)`).run(
                  deliveryMeta.matchKey, deliveryMeta.channel,
                  parsed?.result?.message_id ?? null,
                  String(deliveryMeta.market || ""),
                  Number(deliveryMeta.voteCount || 0),
                  parsed.ok === true ? 1 : 0,
                  parsed.ok === true ? null : String(parsed.description || "raison inconnue").slice(0, 300)
                );
              storedTelegramDeliveryCache.delete(deliveryMeta.matchKey);
            } catch (e) { console.error(`[telegram-audit] ${e.message}`); }
          }
          if (parsed.ok === true && !skipRussianMirror) {
            const ruTarget = russianClientChannelFor(chatId);
            if (ruTarget && ruTarget.id) {
              const ruText = translateTelegramClientRu(text);
              setImmediate(() => {
                sendTelegramMessage(ruTarget.id, ruText, null, true)
                  .then(ok => console.log(`[telegram-ru] ${ruTarget.tier} chat_id=${ruTarget.id}: ${ok ? "OK" : "FAIL"}`))
                  .catch(e => console.error(`[telegram-ru] ${ruTarget.tier}: ${e.message}`));
              });
            }
          }
          resolve(parsed.ok === true);
        } catch (e) {
          console.error(`[telegram] reponse illisible chat_id=${chatId}: ${data.slice(0, 200)}`);
          resolve(false);
        }
      });
    });
    req.on("error", (e) => { console.error(`[telegram] erreur reseau chat_id=${chatId}: ${e.message}`); resolve(false); });
    req.on("timeout", () => { req.destroy(); console.error(`[telegram] timeout chat_id=${chatId}`); resolve(false); });
    req.write(body);
    req.end();
  });
}

async function sendHermesDailyDigest(text) {
  const parisDay = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const marker = `/data/hermes-daily-digest-${parisDay}.sent`;
  if (fs.existsSync(marker)) {
    // Idempotence : le digest déjà livré n'est pas un échec Telegram.
    console.log(`[telegram-admin] digest quotidien deja livre: ${parisDay}`);
    return true;
  }
  const ok = await sendTelegramMessage(
    TELEGRAM_ADMIN_CHAT_ID,
    text,
    { adminDailyDigest: true }
  );
  if (ok) {
    fs.writeFileSync(marker, new Date().toISOString() + "\n", { mode: 0o600 });
  }
  return ok;
}

// Génère un lien d'invitation Telegram à usage unique vers le canal premium.
// Le bot doit être administrateur du canal avec le droit d'inviter.
// Canal correspondant au palier acheté. Sans cette résolution, un abonné Elite ou
// Standard recevait une invitation vers le canal Premium (mauvais canal, mauvais
// contenu). Un palier sans canal dédié configuré retombe sur Premium.
function channelForStatus(status) {
  if (status === "standard") return TELEGRAM_STANDARD_CHANNEL_ID || TELEGRAM_PREMIUM_CHANNEL_ID;
  if (status === "elite" || status === "vip") return TELEGRAM_ELITE_CHANNEL_ID || TELEGRAM_PREMIUM_CHANNEL_ID;
  return TELEGRAM_PREMIUM_CHANNEL_ID;
}

function createPremiumInviteLink(labelEmail, status) {
  const chatId = channelForStatus(status);
  if (!TELEGRAM_BOT_TOKEN || !chatId) return Promise.resolve(null);
  const body = JSON.stringify({
    chat_id: chatId,
    name: `${(status || "premium").toUpperCase()} ${labelEmail || ""}`.slice(0, 32),
    member_limit: 1,
    creates_join_request: false,
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TELEGRAM_BOT_TOKEN}/createChatInviteLink`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const j = JSON.parse(data);
          if (j.ok && j.result && j.result.invite_link) resolve(j.result.invite_link);
          else { console.error("[telegram] createChatInviteLink KO:", data.slice(0, 200)); resolve(null); }
        } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ── Shadow API helpers ────────────────────────────────────────────────────────
function callOpenAICompat(prompt, { url, key, model }) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120, // réponse courte attendue : ne pas payer 200 tokens
      temperature: 0.3,
    });
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "HTTP-Referer": "https://touslesmatchs.com",
        "X-Title": "TousLesMatchs Shadow Eval",
      },
      timeout: 15000,
    };
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          // Un modèle inexistant renvoie un JSON d'erreur parfaitement valide (404
          // "model not found") : sans ce contrôle on résolvait ok:true avec un texte
          // vide, et l'agent échouait en silence pour toujours.
          if (json.error) {
            return resolve({ ok: false, text: "", error: json.error.message || JSON.stringify(json.error) });
          }
          const text = json.choices?.[0]?.message?.content || "";
          if (!text) return resolve({ ok: false, text: "", error: `réponse vide (HTTP ${res.statusCode}, modèle ${model})` });
          // usage.* provient de l'API quand elle le fournit (cas OpenRouter/Groq) :
          // sert à journaliser un coût réel plutôt qu'une estimation approximative.
          resolve({ ok: true, text, usageIn: json.usage?.prompt_tokens || 0, usageOut: json.usage?.completion_tokens || 0 });
        } catch { resolve({ ok: false, text: "", error: `réponse illisible (HTTP ${res.statusCode}): ${String(data).slice(0, 120)}` }); }
      });
    });
    req.on("error", (e) => resolve({ ok: false, text: "", error: `réseau: ${e.message}` }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, text: "", error: "timeout 15s" }); });
    req.write(body);
    req.end();
  });
}

function callCohere(prompt) {
  return new Promise((resolve) => {
    if (!COHERE_API_KEY) return resolve({ ok: false, text: "" });
    const body = JSON.stringify({
      model: "command-r",
      message: prompt,
      max_tokens: 120, // réponse courte attendue : ne pas payer 200 tokens
      temperature: 0.3,
    });
    const options = {
      hostname: "api.cohere.ai",
      path: "/v1/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${COHERE_API_KEY}`,
      },
      timeout: 15000,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const text = json.text || json.chat_history?.slice(-1)[0]?.message || "";
          resolve({ ok: true, text });
        } catch { resolve({ ok: false, text: "" }); }
      });
    });
    req.on("error", () => resolve({ ok: false, text: "" }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, text: "" }); });
    req.write(body);
    req.end();
  });
}

function parseShadowResponse(text) {
  const t = text.trim();
  const betMatch = t.match(/(?:PARI|BET|PRONOSTIC|ANALYSE)\s*:\s*([^\n|]+)/i);
  const confMatch = t.match(/(?:CONFIANCE|CONFIDENCE)\s*:\s*(\d+)/i);
  const raisonMatch = t.match(/(?:RAISON|REASON|POURQUOI)\s*:\s*([^\n]+)/i);
  const marchesMatch = t.match(/MARCHES\s*:\s*([^\n]+)/i);
  let bet = betMatch ? betMatch[1].trim() : null;
  if (!bet) {
    const known = ["Over 2.5", "Under 2.5", "BTTS Oui", "BTTS Non", "Match nul", "Victoire domicile", "Victoire extérieur", "1X", "X2", "12", "NO BET"];
    for (const k of known) {
      if (t.toLowerCase().includes(k.toLowerCase())) { bet = k; break; }
    }
  }
  // Parse "buts=o2.5:70,btts=oui:60,resultat=dom:65,mt1=oui:55" → objet marches
  let marches = null;
  if (marchesMatch) {
    marches = {};
    marchesMatch[1].split(",").forEach(part => {
      const m = part.trim().match(/^(buts|btts|resultat|mt1)\s*=\s*([a-z0-9.]+)\s*:\s*(\d+)/i);
      if (m) marches[m[1].toLowerCase()] = { p: m[2].toLowerCase(), c: parseInt(m[3]) };
    });
    if (Object.keys(marches).length === 0) marches = null;
  }
  return {
    bet: bet || "NO BET",
    confidence: confMatch ? Math.min(100, Math.max(0, parseInt(confMatch[1]))) : 55,
    raison: raisonMatch ? raisonMatch[1].trim().slice(0, 300) : t.slice(0, 200),
    marches,
  };
}

function buildShadowPrompt(match) {
  const scoreStr = (match.score_home != null && match.score_away != null)
    ? `\nScore actuel : ${match.score_home}-${match.score_away}${match.minute ? ` (${match.minute}')` : ""}`
    : "";
  return `Tu es un analyste sportif expert. Analyse ce match et donne ta recommandation.

Match : ${match.home} vs ${match.away}
Compétition : ${match.competition || match.league || "inconnue"}
Sport : ${match.sport || "Football"}${scoreStr}

DIRECTIVE : Under 2.5 UNIQUEMENT si match équilibré (écart 0-1 but) ET rythme faible. Si écart >= 2 buts OU 2+ buts avant 45' → préfère Over 2.5 ou Victoire.

Réponds UNIQUEMENT dans ce format :
ANALYSE : [ex: Under 2.5 / Over 2.5 / Victoire domicile / 1X / Match nul / NO BET]
CONFIANCE : [0-100]
RAISON : [1 phrase maximum]
MARCHES : buts=o2.5:70,btts=oui:60,resultat=dom:65,mt1=oui:55

Pour MARCHES (avis rapide sur chaque marché, codes courts + confiance 40-90) :
- buts : o2.5 (plus de 2.5) ou u2.5 (moins de 2.5)
- btts : oui ou non (les deux équipes marquent)
- resultat : dom, ext ou nul
- mt1 : oui ou non (but en 1ère mi-temps)

Ne mets rien d'autre. Si tu n'es pas sûr du pick principal, réponds NO BET (mais donne quand même MARCHES).`;
}

// Plafond journalier des tests à blanc — garde-fou de budget OpenRouter.
// 20 matchs/jour suffisent largement : la promotion d'un challenger exige 50 picks
// résolus, soit moins de 3 jours d'échantillon. Payer plus n'apporte rien.
const SHADOW_DAILY_CAP = Math.max(1, Number(process.env.SHADOW_DAILY_CAP || 20));
const _shadowDaily = { date: "", count: 0 };
function shadowQuotaAllows() {
  const today = new Date().toISOString().slice(0, 10);
  if (_shadowDaily.date !== today) { _shadowDaily.date = today; _shadowDaily.count = 0; }
  if (_shadowDaily.count >= SHADOW_DAILY_CAP) return false;
  _shadowDaily.count++;
  return true;
}

async function runShadowEvaluation(match) {
  const prompt = buildShadowPrompt(match);
  const matchKey = `${(match.home || "").replace(/\s+/g, "_")}_${(match.away || "").replace(/\s+/g, "_")}_${(match.date || match.utcDate || "").slice(0, 10)}`;
  const activeAgents = SHADOW_AGENTS.filter(a => a.enabled());
  if (activeAgents.length === 0) return;

  for (const agent of activeAgents) {
    try {
      const existing = db.prepare("SELECT 1 FROM shadow_evals WHERE match_key = ? AND agent_name = ?").get(matchKey, agent.name);
      if (existing) continue;

      // Passage obligatoire par le garde-fou pour Qwen/Kimi (budget, anti-doublon,
      // coupe-circuit) ; les autres agents shadow ne sont pas concernés par ce
      // budget OpenRouter (voir analysis_engine.js).
      const result = await analysisEngine.guardedShadowCall(db, agent, prompt, {
        matchKey, competition: match.competition || match.league || "",
      });
      if (!result.ok || !result.text) {
        // Log explicite : un agent mal configuré (mauvais identifiant de modèle,
        // clé absente, quota dépassé) doit se voir dans les logs, pas disparaître.
        console.error(`[shadow] ${agent.name} SANS RÉPONSE — ${result.error || "raison inconnue"}`);
        continue;
      }

      const parsed = parseShadowResponse(result.text);
      // Avis multi-marchés du banc d'essai — même mécanique que les 5 agents
      // du Concile, pour que TOUTES les IA (pas seulement Perplexity/DeepSeek/
      // Mistral-Large/Cohere/Qwen) apparaissent dans la matrice IA × marché.
      if (parsed.marches) {
        saveAgentMarketPredictions(match, [{ name: agent.name, marches: parsed.marches }]);
      }
      db.prepare(`
        INSERT OR IGNORE INTO shadow_evals
          (match_key, home, away, competition, sport, agent_name, bet, confidence, raison)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(
        matchKey,
        match.home || "", match.away || "",
        match.competition || match.league || "",
        match.sport || "Football",
        agent.name,
        parsed.bet, parsed.confidence, parsed.raison
      );
      console.log(`[shadow] ${agent.icon} ${agent.name} → ${parsed.bet} (${parsed.confidence}%) pour ${match.home} vs ${match.away}`);
    } catch (e) {
      console.error(`[shadow] ${agent.name} erreur:`, e.message);
    }
  }
}

function resolveShadowOutcomes(home, away, scoreHome, scoreAway) {
  try {
    // Match par équipes (comme les autres résolveurs) — l'ancien code matchait
    // par match_key exact, mais le match_key de shadow_evals (home_away_date)
    // ne correspond JAMAIS à celui de concile_analyses (id_date_bucket_score),
    // donc les IA du banc d'essai n'étaient quasiment jamais résolues.
    const hw = String(home || "").split(" ")[0];
    const aw = String(away || "").split(" ")[0];
    if (!hw || !aw) return;
    const rows = db.prepare(
      "SELECT id, bet FROM shadow_evals WHERE home LIKE ? AND away LIKE ? AND outcome IS NULL"
    ).all(`%${hw}%`, `%${aw}%`);
    for (const row of rows) {
      const outcome = getBetOutcomeForScore(row.bet, scoreHome, scoreAway);
      if (outcome) {
        db.prepare(`UPDATE shadow_evals SET outcome = ?, final_score_home = ?, final_score_away = ?, resolved_at = datetime('now') WHERE id = ?`)
          .run(outcome, scoreHome, scoreAway, row.id);
      }
    }
  } catch (e) { console.error("[shadow] resolve:", e.message); }
}

function bookmakerEmailHtml() {
  const colors = ["#ef4444", "#3b82f6", "#22c55e", "#06b6d4"];
  return `
  <div style="background:#0d1020;border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:18px;margin:20px 0">
    <div style="font-size:11px;color:#f8d37a;letter-spacing:.12em;text-transform:uppercase;font-weight:900;margin-bottom:10px">Comparer la cote</div>
    <div style="font-size:13px;color:#a8aec8;line-height:1.5;margin-bottom:14px">La cote finale se vérifie toujours sur le bookmaker. 18+ uniquement, jeu responsable.</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
      ${bookmakerButtons.map((b, i) => `
        <a href="${b.url}" style="display:block;text-align:center;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid ${colors[i] || "#64748b"};color:#fff;padding:12px 10px;border-radius:10px;text-decoration:none;font-weight:800;font-size:13px">
          ${b.text}
        </a>`).join("")}
    </div>
  </div>`;
}

// Expose les liens d'affiliation bookmakers (source unique : bookmakers.config.js)
// au frontend, pour les afficher sur le site (pas seulement dans les emails).
// Demande de Greg le 01/08/2026 : les liens n'apparaissaient nulle part sur
// le site, seulement dans certains emails/Telegram.
app.get("/bookmaker-links", (req, res) => {
  res.json({ ok: true, links: bookmakerButtons });
});

// Preuves storage file
const PREUVES_PATH = "/var/touslesmatchs/preuves.json";
const SCORE_PATH = "/var/touslesmatchs/live_score.json";
const PICK_PATH = "/var/touslesmatchs/current_pick.json";
const HERMES_PICKS_PATH = "/picks/picks.json";
const PINNED_SIGNALS_PATH = "/var/touslesmatchs/pinned_signals.json";

function loadPinnedSignals() {
  try { return JSON.parse(fs.readFileSync(PINNED_SIGNALS_PATH, "utf8")); } catch { return []; }
}
function savePinnedSignals(signals) {
  try { fs.writeFileSync(PINNED_SIGNALS_PATH, JSON.stringify(signals, null, 2)); } catch {}
}
function addPinnedSignal(signal) {
  const signals = loadPinnedSignals().filter(s => s.id !== signal.id);
  const expireAt = Date.now() + 90 * 60 * 1000; // 90 minutes
  signals.unshift({ ...signal, expireAt, pinnedAt: new Date().toISOString() });
  savePinnedSignals(signals.slice(0, 20));
}
function getActivePinnedSignals() {
  const now = Date.now();
  return loadPinnedSignals().filter(s => s.expireAt > now);
}
const LEADS_PATH = "/var/touslesmatchs/leads.json";
const REFERRALS_PATH = "/var/touslesmatchs/referrals.json";

function loadPick() {
  try { return JSON.parse(fs.readFileSync(PICK_PATH, "utf8")); } catch { return null; }
}
function savePick(data) {
  fs.mkdirSync("/var/touslesmatchs", { recursive: true });
  fs.writeFileSync(PICK_PATH, JSON.stringify(data, null, 2));
}
function loadLeads() {
  try {
    const data = JSON.parse(fs.readFileSync(LEADS_PATH, "utf8"));
    return Array.isArray(data.leads) ? data : { leads: [] };
  } catch {
    return { leads: [] };
  }
}
function saveLeads(data) {
  fs.mkdirSync("/var/touslesmatchs", { recursive: true });
  fs.writeFileSync(LEADS_PATH, JSON.stringify(data, null, 2));
}

function buildPickTeam(team, fallbackName, fallbackColor) {
  if (team && typeof team === "object") {
    const name = team.name || fallbackName || "";
    return {
      name,
      abbr: team.abbr || (name || "").slice(0, 3).toUpperCase(),
      color: team.color || fallbackColor,
    };
  }
  const name = team || fallbackName || "";
  return {
    name,
    abbr: (name || "").slice(0, 3).toUpperCase(),
    color: fallbackColor,
  };
}

function parsePickScore(rawScore, rawScoreA, rawScoreB) {
  if (rawScore && typeof rawScore === "string" && rawScore.includes("-")) {
    const parts = rawScore.split("-");
    return {
      scoreA: parseInt(parts[0], 10) || 0,
      scoreB: parseInt(parts[1], 10) || 0,
    };
  }
  return {
    scoreA: rawScoreA ?? null,
    scoreB: rawScoreB ?? null,
  };
}

function normalizePickStatus(status) {
  if (status === "NOPICK" || status === "no_pick") return { status: "no_pick", result: null };
  if (status === "GAGNE" || status === "win") return { status: "win", result: "win" };
  if (status === "PERDU" || status === "loss") return { status: "loss", result: "loss" };
  return { status: "upcoming", result: null };
}

function normalizeCurrentPick(p, defaultSource) {
  if (!p) return null;

  const score = parsePickScore(p.score, p.scoreA, p.scoreB);
  const normalizedStatus = normalizePickStatus(p.status);
  const homeName = p.home || p.teamA?.name || p.teamA || "";
  const awayName = p.away || p.teamB?.name || p.teamB || "";

  return {
    teamA: buildPickTeam(p.teamA, homeName, "#4f46e5"),
    teamB: buildPickTeam(p.teamB, awayName, "#7c3aed"),
    competition: p.competition || p.league || p.sport || "",
    time: p.time || "",
    matchTime: p.matchTime || null,
    date: p.date || null,
    source: p.source || defaultSource || "hermes",
    updatedAt: p.updatedAt || null,
    publishedAt: p.publishedAt || null,
    sourceMatchId: p.sourceMatchId || null,
    fixtureId: p.fixtureId || null,
    liveUnavailable: p.liveUnavailable === true,
    liveAvailabilityReason: p.liveAvailabilityReason || null,
    marketType: p.marketType || p.bet || "",
    marketLabel: p.marketLabel || p.prono || "",
    cote: p.cote === "" || p.cote === null || p.cote === undefined ? null : (parseFloat(p.cote) || null),
    status: normalizedStatus.status,
    result: normalizedStatus.result,
    scoreA: score.scoreA,
    scoreB: score.scoreB,
    confidence: p.confidence != null ? Number(p.confidence) : null,
    raison: p.raison || null,
    sport: p.sport || "Football",
    home_logo: p.home_logo || p.teamA?.logo || null,
    away_logo: p.away_logo || p.teamB?.logo || null,
    home_form: p.home_form || null,
    away_form: p.away_form || null,
    home_goals_avg: p.home_goals_avg != null ? p.home_goals_avg : null,
    away_goals_avg: p.away_goals_avg != null ? p.away_goals_avg : null,
  };
}

function loadManualScore() {
  try { return JSON.parse(fs.readFileSync(SCORE_PATH, "utf8")); } catch { return null; }
}
function saveManualScore(data) {
  fs.mkdirSync("/var/touslesmatchs", { recursive: true });
  fs.writeFileSync(SCORE_PATH, JSON.stringify(data, null, 2));
}
function loadProofs() {
  try { return JSON.parse(fs.readFileSync(PREUVES_PATH, "utf8")); } catch { return []; }
}
function saveProofs(proofs) {
  try {
    fs.mkdirSync("/var/touslesmatchs", { recursive: true });
    fs.writeFileSync(PREUVES_PATH, JSON.stringify(proofs, null, 2));
  } catch (e) { console.error("[preuves] save error:", e.message); }
}

// Cache live matches pour limiter les appels API-Sports tout en gardant le live lisible.
let liveMatchesCache = { data: null, ts: 0 };
const CACHE_TTL = 60 * 1000; // 60 s : cache global partage, evite de bruler le quota multi-sport.
const API_SPORTS_QUOTA_BLOCK_MS = 12 * 60 * 60 * 1000;
const apiSportsBlockedUntil = { football: 0, basketball: 0, hockey: 0, baseball: 0 };

const TOKEN_LIMITS = { free: 0, carte: 1, essentiel: 10, elite: 30 };

// ── Auth middleware ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token) return res.json({ ok: false, error: "Non authentifié" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.json({ ok: false, error: "Token invalide" });
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────────
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

const AUTO_CONCILE_OBSERVER = process.env.AUTO_CONCILE_OBSERVER !== "0";
// Plafonds relevés le 04/08/2026 (decision du fondateur, "fais ce que tu penses
// etre le mieux") : 10 min / 8 matchs laissait des soirees a fort volume (Coupe
// d'Europe, plusieurs matchs simultanes) sans analyse auto, forcant un clic
// manuel "Analyser" pour obtenir un signal. hasPredictionSnapshot() garantit
// que chaque match n'est analyse qu'une fois quel que soit le nombre de cycles
// — un intervalle plus court reduit surtout le RETARD avant qu'un match en
// surplus soit traite, sans multiplier le volume total d'appels IA. Le plafond
// par cycle monte plus prudemment (8->12) car lui seul augmente reellement
// le cout par cycle charge.
const AUTO_CONCILE_INTERVAL_MS = Math.max(5, Number(process.env.AUTO_CONCILE_INTERVAL_MIN || 6)) * 60 * 1000;
const AUTO_CONCILE_MAX_MATCHES = Math.max(1, Number(process.env.AUTO_CONCILE_MAX_MATCHES || 12));
const AUTO_CONCILE_MIN_MINUTE = Math.max(1, Number(process.env.AUTO_CONCILE_MIN_MINUTE || 10));
const AUTO_CONCILE_BUCKET_MINUTES = Math.max(5, Number(process.env.AUTO_CONCILE_BUCKET_MINUTES || 15));

// ── Rationnement du quota gratuit API-Sports (02/08/2026) ────────────────────
// Sans budget, le quota journalier (souvent ~100 requetes/jour sur un plan
// gratuit) se vide en 1-2h sur une grosse journee de matchs, puis plus aucun
// signal ne peut sortir le reste de la journee (constate le 02/08/2026 —
// quota epuise des 14h). Faute de budget pour upgrader le plan tout de
// suite, on etale la consommation heure par heure au lieu de la cramer d'un
// coup : chaque heure ne peut consommer que sa part du budget quotidien.
// Pas une solution au manque de quota (le total de signaux/jour reste
// limite), juste un etalement pour ne pas mourir en milieu d'apres-midi.
const API_SPORTS_DAILY_BUDGET = Math.max(1, Number(process.env.API_SPORTS_DAILY_BUDGET || 90));
db.exec(`
  CREATE TABLE IF NOT EXISTS api_sports_usage (
    bucket TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0
  );
`);
// Plafond horaire DYNAMIQUE (remplace le partage fixe daily/24 le 04/08/2026,
// demande du fondateur) : une heure creuse sous-consommee ne doit pas gaspiller
// son quota, il doit grossir l'enveloppe des heures suivantes — typiquement la
// soirée, où plusieurs matchs tombent en même temps. On recalcule a chaque
// appel : budget qu'il reste aujourd'hui / heures qu'il reste aujourd'hui
// (heure en cours incluse). Le total consommable sur la journee reste borne
// par API_SPORTS_DAILY_BUDGET, seule la repartition heure par heure s'adapte
// a l'usage reel au lieu d'etre figee a l'avance.
function apiSportsDynamicHourlyBudget() {
  const now = new Date();
  const todayPrefix = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const usedTodayRow = db.prepare(
    "SELECT COALESCE(SUM(count),0) AS total FROM api_sports_usage WHERE bucket LIKE ?"
  ).get(`${todayPrefix}%`);
  const usedToday = usedTodayRow ? usedTodayRow.total : 0;
  const remainingBudget = Math.max(0, API_SPORTS_DAILY_BUDGET - usedToday);
  const hoursRemaining = Math.max(1, 24 - now.getUTCHours()); // heure en cours incluse
  return Math.max(1, Math.ceil(remainingBudget / hoursRemaining));
}
function apiSportsBudgetOk() {
  try {
    const bucket = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
    const dynamicBudget = apiSportsDynamicHourlyBudget();
    const row = db.prepare("SELECT count FROM api_sports_usage WHERE bucket = ?").get(bucket);
    const used = row ? row.count : 0;
    if (used >= dynamicBudget) return false;
    db.prepare("INSERT INTO api_sports_usage (bucket, count) VALUES (?, 1) ON CONFLICT(bucket) DO UPDATE SET count = count + 1").run(bucket);
    return true;
  } catch (e) {
    console.error("[api-sports-budget]", e.message);
    return true; // en cas d'erreur de comptage, ne jamais bloquer un appel reel
  }
}

// ── Quota REEL du plan API-Sports (pas juste notre estimation interne) ──────
// Le rationnement horaire ci-dessus part d'un budget suppose (env var, 90 par
// defaut) qui peut etre faux si le vrai plan paye est different. Ici on
// interroge l'endpoint /status d'API-Sports, qui renvoie l'usage REEL du
// jour cote leur serveur (requests.current / requests.limit_day), et on
// alerte sur Telegram Admin des que le quota reel approche de la limite —
// pour le savoir AVANT que les signaux s'arretent, pas apres coup dans les
// logs d'erreur.
let _apiQuotaAlertSentDate = "";
async function checkApiSportsRealQuota() {
  // Renvoie toujours un objet { error } explicite en cas d'échec, jamais null
  // silencieux — sinon /admin/api-quota-status affiche un message générique
  // et il faut aller fouiller les logs docker pour savoir si c'est une clé
  // manquante, un quota vraiment épuisé, ou une panne réseau.
  if (!API_SPORTS_KEY) return { error: "API_SPORTS_KEY / API_FOOTBALL_KEY absente de l'environnement du conteneur" };
  try {
    const data = await httpGet("https://v3.football.api-sports.io/status", { "x-apisports-key": API_SPORTS_KEY });
    const req = data?.response?.requests;
    if (!req || req.limit_day == null) {
      return { error: `réponse inattendue de l'API: ${JSON.stringify(data).slice(0, 300)}` };
    }
    const used = Number(req.current) || 0;
    const limit = Number(req.limit_day) || 0;
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const today = getTodayStr();
    if (pct >= 85 && _apiQuotaAlertSentDate !== today && TELEGRAM_ADMIN_CHAT_ID) {
      _apiQuotaAlertSentDate = today;
      sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID,
        `⚠️ <b>Quota API-Sports proche de la limite</b>\n${used}/${limit} requêtes utilisées aujourd'hui (${pct}%).\nLes stats live vont bientôt basculer sur Football-Data (H2H seulement, moins riche).`
      ).catch(() => {});
    }
    return { used, limit, pct, plan: data?.response?.subscription?.plan || null, ends: data?.response?.subscription?.end || null };
  } catch (e) {
    console.error("[api-sports-quota]", e.message);
    return { error: e.message };
  }
}
setInterval(() => checkApiSportsRealQuota(), 1800000);
// Appel initial différé : TELEGRAM_ADMIN_CHAT_ID est déclaré plus bas dans ce
// fichier (const), un appel synchrone ici au chargement du module lèverait
// une erreur de zone morte temporelle avant que cette constante existe.
setTimeout(() => checkApiSportsRealQuota(), 5000);

// Verif manuelle a tout moment : curl /api/admin/api-quota-status?email=...&code=...
// Declenchement manuel de l'audit matinal : sert a le verifier sans attendre
// 6h du matin, et a le relancer apres un correctif pour confirmer la reparation.
// Composition reelle du Concile, exposee au site public. Les noms des IA
// etaient ecrits en dur dans public/index.html : a chaque promotion ou
// substitution de modele, la page annoncait des IA qui n'analysaient plus rien.
// Le nom affiche est deduit de l'identifiant reellement appele, substitutions
// comprises — la page dit donc toujours la verite, sans intervention.
app.get("/concile-roster", (_req, res) => {
  const jolinom = (id) => {
    const fam = String(id).split("/")[0];
    return ({ perplexity: "Perplexity", deepseek: "DeepSeek", mistralai: "Mistral",
              cohere: "Cohere", qwen: "Qwen", moonshotai: "Kimi", "meta-llama": "Llama",
              google: "Gemini", "x-ai": "Grok", anthropic: "Claude", openai: "GPT" })[fam]
           || fam.charAt(0).toUpperCase() + fam.slice(1);
  };
  const sieges = [
  "perplexity/sonar-pro",
  "deepseek/deepseek-chat",
  "mistralai/mistral-small-2603",
  "qwen/qwen3.7-max",
  "moonshotai/kimi-k2"
];
  const noms = sieges.map(sg => jolinom(resolveModel(sg)));
  res.set("Cache-Control", "public, max-age=300");
  res.json({ ok: true, names: noms, count: noms.length });
});

app.get("/admin/audit-matinal", async (req, res) => {
  const { email, code } = req.query || {};
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  const envoye = await runMorningAudit();
  res.json({ ok: true, telegram: envoye });
});

app.get("/admin/api-quota-status", async (req, res) => {
  const { email, code } = req.query || {};
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  const apiSports = await checkApiSportsRealQuota();
  const bucket = new Date().toISOString().slice(0, 13);
  const row = db.prepare("SELECT count FROM api_sports_usage WHERE bucket = ?").get(bucket);
  res.json({
    ok: true,
    api_sports: apiSports || { error: "indisponible (cle manquante ou API injoignable)" },
    rationnement_interne: {
      budget_quotidien: API_SPORTS_DAILY_BUDGET,
      budget_horaire_dynamique_actuel: apiSportsDynamicHourlyBudget(),
      deja_utilise_cette_heure: row ? row.count : 0,
    },
    fallback_actifs: {
      football_data_org: !!FOOTBALL_DATA_KEY,
      thesportsdb: !!THESPORTSDB_API_KEY,
    },
  });
});

function getTokenRow(userId) {
  return db.prepare("SELECT * FROM user_tokens WHERE user_id = ?").get(userId);
}

function ensureTokenRow(userId) {
  const today = getTodayStr();
  let row = getTokenRow(userId);
  if (!row) {
    db.prepare("INSERT INTO user_tokens (user_id, tokens_today, reset_date) VALUES (?,0,?)").run(userId, today);
    row = getTokenRow(userId);
  }
  if (row.reset_date !== today) {
    const user = db.prepare("SELECT status FROM users WHERE id = ?").get(userId);
    const limit = TOKEN_LIMITS[user?.status || "free"] || 0;
    db.prepare("UPDATE user_tokens SET tokens_today = ?, reset_date = ? WHERE user_id = ?").run(limit, today, userId);
    row = getTokenRow(userId);
  }
  return row;
}

function deductToken(userId) {
  const row = ensureTokenRow(userId);
  const user = db.prepare("SELECT status FROM users WHERE id = ?").get(userId);
  const limit = TOKEN_LIMITS[user?.status || "free"] || 0;
  if (limit === 0) return { ok: false, error: "Abonnement requis pour accéder au Concile" };
  if (row.tokens_today <= 0) return { ok: false, error: "Jetons épuisés pour aujourd'hui — recharge à minuit" };
  db.prepare("UPDATE user_tokens SET tokens_today = tokens_today - 1 WHERE user_id = ?").run(userId);
  return { ok: true, remaining: row.tokens_today - 1 };
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = https.request({ hostname: opts.hostname, path: opts.pathname + opts.search, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({}); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function apiSportsErrors(data) {
  const errors = data?.errors;
  return errors && Object.keys(errors).length ? errors : null;
}

function isApiSportsQuotaError(errors) {
  return /request limit|quota|upgrade your plan/i.test(JSON.stringify(errors || {}));
}

function shouldSkipApiSportsSport(sport) {
  const blockedUntil = apiSportsBlockedUntil[sport] || 0;
  if (Date.now() < blockedUntil) {
    console.warn(`[live-matches] API-Sports ${sport} saute: quota bloque temporairement`);
    return true;
  }
  return false;
}

function handleApiSportsErrors(sport, data) {
  const errors = apiSportsErrors(data);
  if (!errors) return false;
  console.warn(`[live-matches] API-Sports ${sport} indisponible: ${JSON.stringify(errors)}`);
  if (isApiSportsQuotaError(errors)) apiSportsBlockedUntil[sport] = Date.now() + API_SPORTS_QUOTA_BLOCK_MS;
  return true;
}

// ── Score de confiance par marché (pas juste le pick principal) ─────────────
// Chaque agent note deja 4 marches en interne (buts O/U, BTTS, resultat,
// 1ere mi-temps — voir "marches" dans le prompt) pour le suivi de
// performance (saveAgentMarketPredictions), mais seul le pick retenu par le
// Chief remontait au client. Cette fonction agrege ce qui est DEJA calcule
// (zero appel IA supplementaire, zero cout) en une liste triee — demande du
// fondateur le 04/08/2026 : montrer plusieurs scores classes (ex. Victoire
// domicile 86/100, BTTS 80/100, Under 2.5 60/100...) plutot qu'un seul pari.
// Pour chaque categorie, on retient le cote majoritaire parmi les agents qui
// se sont prononces, avec leur confiance moyenne — jamais un chiffre invente,
// toujours la moyenne de ce que les agents ont reellement renvoye.
// ── Traduction anglaise des libelles d'analyse (bloc bilingue Telegram) ──────
// Un canal Telegram diffuse le MEME message a tous les abonnes : impossible
// d'envoyer une langue par personne. Decision fondateur du 05/08/2026 :
// chaque signal porte le bloc francais puis un bloc anglais compact.
// Les noms d'equipes, scores, cotes et pourcentages sont deja universels et
// ne sont pas dupliques — seuls les libelles et la mention legale le sont.
const BET_LABEL_EN = {
  "Victoire domicile": "Home win",
  "Victoire extérieur": "Away win",
  "Match nul": "Draw",
  "BTTS Oui": "Both teams to score - Yes",
  "BTTS Non": "Both teams to score - No",
  "Over 0.5 buts": "Over 0.5 goals",
  "Under 0.5 buts": "Under 0.5 goals",
  "Over 1.5 buts": "Over 1.5 goals",
  "Under 1.5 buts": "Under 1.5 goals",
  "Over 2.5 buts": "Over 2.5 goals",
  "Under 2.5 buts": "Under 2.5 goals",
  "But en 1ère mi-temps": "Goal in the 1st half",
  "Aucun but en 1ère mi-temps": "No goal in the 1st half",
  "But en 2ème mi-temps": "Goal in the 2nd half",
  "Aucun but en 2ème mi-temps": "No goal in the 2nd half",
  "Domicile marque en 1ère MT": "Home team to score in the 1st half",
  "Domicile ne marque pas en 1ère MT": "Home team not to score in the 1st half",
  "Extérieur marque en 1ère MT": "Away team to score in the 1st half",
  "Extérieur ne marque pas en 1ère MT": "Away team not to score in the 1st half",
  "Domicile marque en 2ème MT": "Home team to score in the 2nd half",
  "Domicile ne marque pas en 2ème MT": "Home team not to score in the 2nd half",
  "Extérieur marque en 2ème MT": "Away team to score in the 2nd half",
  "Extérieur ne marque pas en 2ème MT": "Away team not to score in the 2nd half",
  "Double chance 1X": "Double chance 1X",
  "Double chance X2": "Double chance X2",
};
// Repli volontaire sur le libelle francais si un nouveau marche apparait sans
// traduction : mieux vaut un mot francais qu'un blanc dans le message.
function betLabelEn(bet) {
  const raw = String(bet || "").trim();
  if (!raw) return "";
  if (BET_LABEL_EN[raw]) return BET_LABEL_EN[raw];
  // "Victoire Shamrock Rovers" & co : nom d'equipe accole, on traduit le verbe.
  const m = raw.match(/^Victoire\s+(.+)$/i);
  if (m) return `${m[1]} to win`;
  return raw;
}

const MARKET_SCORE_LABELS = {
  resultat: { dom: "Victoire domicile", ext: "Victoire extérieur", nul: "Match nul" },
  ou05: { "o0.5": "Over 0.5 buts", "u0.5": "Under 0.5 buts" },
  ou15: { "o1.5": "Over 1.5 buts", "u1.5": "Under 1.5 buts" },
  buts: { "o2.5": "Over 2.5 buts", "u2.5": "Under 2.5 buts" },
  btts: { oui: "BTTS Oui", non: "BTTS Non" },
  mt1: { oui: "But en 1ère mi-temps", non: "Aucun but en 1ère mi-temps" },
  mt1_dom: { oui: "Domicile marque en 1ère MT", non: "Domicile ne marque pas en 1ère MT" },
  mt1_ext: { oui: "Extérieur marque en 1ère MT", non: "Extérieur ne marque pas en 1ère MT" },
  mt2: { oui: "But en 2ème mi-temps", non: "Aucun but en 2ème mi-temps" },
  mt2_dom: { oui: "Domicile marque en 2ème MT", non: "Domicile ne marque pas en 2ème MT" },
  mt2_ext: { oui: "Extérieur marque en 2ème MT", non: "Extérieur ne marque pas en 2ème MT" },
};
function aggregateMarketScores(agentMarketList) {
  const out = [];
  for (const marketKey of Object.keys(MARKET_SCORE_LABELS)) {
    const votesBySide = {};
    for (const am of agentMarketList || []) {
      const entry = am?.marches?.[marketKey];
      const side = String(entry?.p || "").toLowerCase();
      const conf = Number(entry?.c);
      if (!side || !Number.isFinite(conf)) continue;
      (votesBySide[side] = votesBySide[side] || []).push(conf);
    }
    let bestSide = null, bestCount = 0;
    for (const side of Object.keys(votesBySide)) {
      if (votesBySide[side].length > bestCount) { bestCount = votesBySide[side].length; bestSide = side; }
    }
    const label = bestSide && MARKET_SCORE_LABELS[marketKey][bestSide];
    if (!label) continue;
    const confs = votesBySide[bestSide];
    out.push({
      market: label,
      confidence: Math.round(confs.reduce((a, b) => a + b, 0) / confs.length),
      agents_agreeing: confs.length,
    });
  }
  out.sort((a, b) => b.confidence - a.confidence);
  return out;
}

function buildVoteSummary(activeAgents, selectedBet) {
  const voters = (activeAgents || []).filter((a) => a && !a.failed && a.bet && a.bet !== "—" && a.bet !== "-");
  const voteTotal = 5;
  const voteActive = voters.length;
  const counts = {};
  for (const a of voters) counts[a.bet] = (counts[a.bet] || 0) + 1;
  let voteTop = selectedBet || null;
  let voteCount = voteTop ? counts[voteTop] || 0 : 0;
  for (const [bet, count] of Object.entries(counts)) {
    if (count > voteCount) { voteTop = bet; voteCount = count; }
  }
  const unanimous = voteCount === voteTotal;
  const voteStatus = unanimous ? "elite" : voteCount >= 4 ? "strong" : voteCount >= 3 ? "trend" : "none";
  const voteLabel = unanimous
    ? "5/5 unanime"
    : voteCount >= 4
      ? "4/5 signal fort"
      : voteCount >= 3
        ? "3/5 tendance IA"
        : `${voteCount}/${voteTotal} aucun signal`;
  return {
    vote_total: voteTotal,
    vote_active: voteActive,
    vote_count: voteCount,
    vote_top: voteTop,
    vote_label: voteLabel,
    vote_status: voteStatus,
    unanimous,
    recommended: voteCount >= 4,
  };
}

// Produit client unique : les cinq sieges votent tous sur Over/Under 2,5.
// Le pari principal libre (victoire, BTTS, etc.) reste utile a l'audit interne,
// mais ne peut plus etre presente comme un consensus O/U 2,5 aux abonnes.
const CLIENT_OU25_MIN_VOTES = 4;
const CLIENT_OU25_MIN_CONFIDENCE = Math.max(77, Number(process.env.CLIENT_OU25_MIN_CONFIDENCE || 77));
// Mode Recovery : active par defaut, fail-closed et limite a 1 ou 2 matchs/jour.
const RECOVERY_MODE_ENABLED = process.env.OU25_RECOVERY_MODE !== "0";
const RECOVERY_MAX_DAILY_SIGNALS = Math.min(2, Math.max(1, Number(process.env.OU25_RECOVERY_MAX_DAILY_SIGNALS || 2)));
const RECOVERY_OVER_MIN_AVG = 2.80;
const RECOVERY_UNDER_MAX_AVG = 2.20;
const RECOVERY_MIN_CONVERGENT_INDICATORS = 3;
const CLIENT_OU25_CLIENT_MAX_MINUTE = 45;
function isOu25Bet(bet) {
  return /^(Over|Under) 2[.,]5 buts$/i.test(String(bet || "").trim());
}

function buildOu25VoteSummary(agentMarketList, agentResults = []) {
  const byAgent = new Map();
  for (const am of agentMarketList || []) {
    if (!CONCILE_AGENT_NAMES.includes(am?.name) || byAgent.has(am.name)) continue;
    const raw = am?.marches?.buts;
    const side = String(raw?.p || "").toLowerCase();
    if (side !== "o2.5" && side !== "u2.5") continue;
    const confidence = Number(raw?.c);
    if (!Number.isFinite(confidence)) continue;
    byAgent.set(am.name, {
      direction: side === "o2.5" ? "over" : "under",
      confidence: Math.min(95, Math.max(40, confidence)),
    });
  }
  // Filet strict : si un agent officiel n'a pas rempli marches.buts mais a
  // réellement donné Over/Under 2,5 comme pari principal, ce vrai vote compte
  // comme son siège O/U. On ne remplace jamais un bulletin marches.buts existant,
  // on n'invente aucun vote et les agents en échec restent exclus.
  for (const ar of agentResults || []) {
    if (!CONCILE_AGENT_NAMES.includes(ar?.name) || byAgent.has(ar.name)) continue;
    if (!isOu25Bet(ar?.bet)) continue;
    const confidence = Number(ar?.confidence);
    if (!Number.isFinite(confidence)) continue;
    byAgent.set(ar.name, {
      direction: /^Over\b/i.test(String(ar.bet).trim()) ? "over" : "under",
      confidence: Math.min(95, Math.max(40, confidence)),
    });
  }
  const votes = CONCILE_AGENT_NAMES.map((agent) => ({ agent, ...(byAgent.get(agent) || { direction: null, confidence: null }) }));
  const over = votes.filter(v => v.direction === "over");
  const under = votes.filter(v => v.direction === "under");
  const winners = over.length >= under.length ? over : under;
  const voteCount = Math.max(over.length, under.length);
  const voteTop = voteCount ? (over.length >= under.length ? "Over 2.5 buts" : "Under 2.5 buts") : null;
  const avgConfidence = winners.length
    ? Math.round(winners.reduce((sum, vote) => sum + vote.confidence, 0) / winners.length)
    : 0;
  const unanimous = voteCount === 5;
  const complete = byAgent.size === 5;
  const voteStatus = complete && unanimous ? "elite" : complete && voteCount >= 4 ? "strong" : "none";
  const voteLabel = !complete
    ? `${byAgent.size}/5 sieges O/U 2,5 renseignes`
    : unanimous
      ? "5/5 unanime O/U 2,5"
      : voteCount >= 4
        ? "4/5 signal fort O/U 2,5"
        : `${voteCount}/5 aucun signal O/U 2,5`;
  return {
    market: "over_under_2_5",
    vote_total: 5,
    vote_active: byAgent.size,
    vote_count: voteCount,
    vote_top: voteTop,
    vote_label: voteLabel,
    vote_status: voteStatus,
    unanimous,
    complete,
    recommended: complete && voteCount >= CLIENT_OU25_MIN_VOTES,
    average_confidence: avgConfidence,
    over_count: over.length,
    under_count: under.length,
    votes,
  };
}

// Un timeout ou une erreur HTTP (401/429/5xx) resolvait silencieusement en
// `{}` — indiscernable d'une reponse IA simplement vide. Consequence reelle
// constatee le 04/08/2026 : impossible de savoir si les agents du Concile
// timeoutent vraiment, ou si une cle expiree/un quota depasse renvoie une
// erreur JSON valide mais sans "choices", noyee dans le meme `{}`. Les
// marqueurs _httpStatus/_httpTimedOut/_httpParseError sont ajoutes SANS
// toucher aux champs habituels (.choices, .message...) — aucun appelant
// existant n'est affecte, seuls ceux qui les lisent explicitement en profitent.
function httpPost(url, body, headers = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const payload = JSON.stringify(body);
    const options = {
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers },
      timeout: timeoutMs,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400 && parsed && typeof parsed === "object") parsed._httpStatus = res.statusCode;
          resolve(parsed);
        } catch { resolve({ _httpStatus: res.statusCode, _httpParseError: true, _raw: data.slice(0, 300) }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      resolve({ _httpTimedOut: true });
    });
    req.write(payload);
    req.end();
  });
}

function httpPostStrict(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const payload = JSON.stringify(body);
    const options = {
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let parsed = {};
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const detail = typeof parsed === "object" ? JSON.stringify(parsed).slice(0, 500) : String(data).slice(0, 500);
          reject(new Error(`HTTP ${res.statusCode}: ${detail}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}


/* TLM Goal05 strict server engine */
const goal05LineupCache = new Map();
const goal05EventCache = new Map();

function goal05Number(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace("%","").replace(",","."));
  return Number.isFinite(n) ? n : null;
}

function goal05Metric(stats, side, names) {
  for (const name of names) {
    const values = [
      stats?.[name]?.[side],
      stats?.[name + "_" + side],
      stats?.[side]?.[name],
      stats?.statistics?.[side]?.[name]
    ];
    for (const value of values) {
      const n=goal05Number(value);
      if (n !== null) return n;
    }
  }
  return null;
}

async function fetchGoal05Lineups(match) {
  const id=match?.fixtureId;
  if (!API_SPORTS_KEY || !id) return null;
  const cached=goal05LineupCache.get(String(id));
  if (cached && Date.now()-cached.ts<5*60*1000) return cached.data;
  try {
    const raw=await httpGet(
      "https://v3.football.api-sports.io/fixtures/lineups?fixture="+id,
      {"x-apisports-key":API_SPORTS_KEY}
    );
    const data=Array.isArray(raw?.response) ? raw.response : null;
    goal05LineupCache.set(String(id),{data,ts:Date.now()});
    return data;
  } catch(e) {
    console.error("[goal05-lineups]",e.message);
    return null;
  }
}

async function fetchGoal05Discipline(match) {
  const id=match?.fixtureId;
  if (!API_SPORTS_KEY || !id) return null;
  const cached=goal05EventCache.get(String(id));
  if (cached && Date.now()-cached.ts<60000) return cached.data;
  try {
    const raw=await httpGet(
      "https://v3.football.api-sports.io/fixtures/events?fixture="+id,
      {"x-apisports-key":API_SPORTS_KEY}
    );
    const events=Array.isArray(raw?.response) ? raw.response : null;
    const redCards=events ? events.filter(e =>
      String(e?.type||"").toLowerCase()==="card" &&
      /red/i.test(String(e?.detail||""))
    ).length : null;
    const data=redCards===null ? null : {redCards};
    goal05EventCache.set(String(id),{data,ts:Date.now()});
    return data;
  } catch(e) {
    console.error("[goal05-events]",e.message);
    return null;
  }
}

function goal05TeamOdd(oddsData, side, teamName) {
  const books=Array.isArray(oddsData?.arjelBookmakers)
    ? oddsData.arjelBookmakers : [];
  const norm=v=>String(v||"").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").toLowerCase();

  const target=norm(teamName);
  const odds=[];

  for (const book of books) {
    for (const bet of book.bets||[]) {
      const name=norm(bet.name);
      const correctSide =
        name.includes(target) ||
        (side==="home" && (/home.*team|team.*home/.test(name))) ||
        (side==="away" && (/away.*team|team.*away/.test(name)));

      if (!correctSide || !/total|goal/.test(name)) continue;

      for (const value of bet.values||[]) {
        const label=norm(value.value);
        if (!/over\s*0[.,]5|0[.,]5.*over|\+0[.,]5/.test(label)) continue;
        const odd=goal05Number(value.odd);
        if (odd && odd>1) odds.push(odd);
      }
    }
  }

  if (!odds.length) return null;
  odds.sort((a,b)=>a-b);
  return Math.round(odds[Math.floor(odds.length/2)]*100)/100;
}

async function goal05History(match,targetId,opponentId) {
  const season=Number(match.season);
  if (!season) return {verified:false,seasons:0};

  const tables=await Promise.all(
    [1,2,3,4].map(offset=>fetchStandings(match.leagueId,season-offset))
  );

  const pairs=[];
  for (const table of tables) {
    const target=table?.rows?.find(r=>Number(r.teamId)===Number(targetId));
    const opponent=table?.rows?.find(r=>Number(r.teamId)===Number(opponentId));
    if (target && opponent) pairs.push({
      targetRank:Number(target.rank),
      opponentRank:Number(opponent.rank)
    });
  }

  if (pairs.length<3) return {verified:false,seasons:pairs.length};

  const targetAverage=pairs.reduce((n,r)=>n+r.targetRank,0)/pairs.length;
  const opponentAverage=pairs.reduce((n,r)=>n+r.opponentRank,0)/pairs.length;

  return {
    verified:targetAverage+3<=opponentAverage,
    seasons:pairs.length,
    targetAverage:Math.round(targetAverage*10)/10,
    opponentAverage:Math.round(opponentAverage*10)/10
  };
}

async function buildStrictGoal05Criteria(match) {
  const minute=Number(match.minute||0);
  const homeScore=Number(match.score_home||0);
  const awayScore=Number(match.score_away||0);

  const rejected=reason=>({
    eligible:false,play:false,reason,
    historicalVerified:false,formVerified:false,
    opponentConcedes:false,attackersAvailable:false,
    liveStatsVerified:false,motivationVerified:false,
    rankGap:null,liveOdd:null
  });

  if (match.sport!=="Football" || match.source!=="api-sports")
    return rejected("source_non_eligible");
  if (!match.homeId || !match.awayId || !match.leagueId || !match.season)
    return rejected("identifiants_manquants");
  if (minute<25 || minute>80)
    return rejected("minute_hors_fenetre");
  if (homeScore>0 && awayScore>0)
    return rejected("les_deux_equipes_ont_deja_marque");

  try {
    const standings=await fetchStandings(match.leagueId,match.season);
    const homeRank=standings?.rows?.find(r=>Number(r.teamId)===Number(match.homeId));
    const awayRank=standings?.rows?.find(r=>Number(r.teamId)===Number(match.awayId));

    if (!homeRank || !awayRank) return rejected("classement_non_verifie");

    let side,targetId,opponentId,targetName,opponentName,targetRank,opponentRank;

    if (homeScore===0 && awayScore>0) {
      side="home"; targetId=match.homeId; opponentId=match.awayId;
      targetName=match.home; opponentName=match.away;
      targetRank=Number(homeRank.rank); opponentRank=Number(awayRank.rank);
    } else if (awayScore===0 && homeScore>0) {
      side="away"; targetId=match.awayId; opponentId=match.homeId;
      targetName=match.away; opponentName=match.home;
      targetRank=Number(awayRank.rank); opponentRank=Number(homeRank.rank);
    } else {
      const homeBetter=Number(homeRank.rank)<Number(awayRank.rank);
      side=homeBetter?"home":"away";
      targetId=homeBetter?match.homeId:match.awayId;
      opponentId=homeBetter?match.awayId:match.homeId;
      targetName=homeBetter?match.home:match.away;
      opponentName=homeBetter?match.away:match.home;
      targetRank=homeBetter?Number(homeRank.rank):Number(awayRank.rank);
      opponentRank=homeBetter?Number(awayRank.rank):Number(homeRank.rank);
    }

    const rankGap=opponentRank-targetRank;
    const minuteVerified=(minute<=65)||(minute<=80 && rankGap>=10);

    const [
      targetStats,opponentStats,injuries,liveStats,odds,
      lineups,discipline,history
    ]=await Promise.all([
      fetchTeamStatistics(match.leagueId,match.season,targetId),
      fetchTeamStatistics(match.leagueId,match.season,opponentId),
      fetchInjuries(match),
      fetchMatchStats(match.fixtureId),
      fetchRealOdds(match),
      fetchGoal05Lineups(match),
      fetchGoal05Discipline(match),
      goal05History(match,targetId,opponentId)
    ]);

    const targetForm=String(targetStats?.form||"").toUpperCase();
    const wins=(targetForm.match(/W/g)||[]).length;
    const draws=(targetForm.match(/D/g)||[]).length;
    const formPoints=wins*3+draws;

    const targetInjuries=side==="home" ? injuries?.home : injuries?.away;
    const targetLineup=(lineups||[]).find(
      l=>Number(l?.team?.id)===Number(targetId)
    );
    const forwards=(targetLineup?.startXI||[]).filter(
      p=>String(p?.player?.pos||"").toUpperCase()==="F"
    );

    const shotsOnTarget=goal05Metric(
      liveStats,side,["shots_on_goal","shotsOnGoal"]
    );
    const totalShots=goal05Metric(
      liveStats,side,["shots","total_shots","shotsTotal"]
    );
    const possession=goal05Metric(
      liveStats,side,["possession","ball_possession"]
    );

    const liveOdd=goal05TeamOdd(odds,side,targetName);
    const historicalVerified=history.verified===true;
    const formVerified=targetForm.length>=4 && wins>=2 && formPoints>=8 &&
      Number(targetStats?.gfAvg||0)>=1;
    const opponentConcedes=Number(opponentStats?.gaAvg||0)>=1.1;
    const attackersAvailable=Array.isArray(targetInjuries) &&
      targetInjuries.length===0 && forwards.length>=1;
    const disciplineVerified=discipline?.redCards===0;
    const liveStatsVerified=shotsOnTarget!==null && totalShots!==null &&
      possession!==null && shotsOnTarget>=3 && totalShots>=8 &&
      possession>=52 && disciplineVerified;
    const motivationVerified=targetRank<=5 ||
      opponentRank>=Math.max(1,Number(standings.total||0)-4);

    const checks={
      minuteVerified,
      rankVerified:rankGap>=5,
      historicalVerified,
      formVerified,
      opponentConcedes,
      attackersAvailable,
      liveStatsVerified,
      motivationVerified,
      oddVerified:liveOdd!==null && liveOdd>=1.60
    };

    const missing=Object.entries(checks)
      .filter(([,ok])=>!ok).map(([name])=>name);

    const eligible=missing.length===0;

    return {
      eligible,play:eligible,
      team:targetName,opponent:opponentName,side,
      reason:eligible ? "tous_les_criteres_stricts_valides" : missing.join(","),
      rankGap,targetRank,opponentRank,
      historicalVerified,history,
      formVerified,targetForm,formPoints,
      opponentConcedes,opponentGaAvg:opponentStats?.gaAvg??null,
      attackersAvailable,forwards:forwards.map(p=>p?.player?.name).filter(Boolean),
      liveStatsVerified,disciplineVerified,
      shotsOnTarget,totalShots,possession,
      motivationVerified,liveOdd,
      checkedAt:new Date().toISOString()
    };
  } catch(e) {
    console.error("[goal05-strict]",match.home,match.away,e.message);
    return rejected("erreur_verification_stricte");
  }
}

async function enrichStrictGoal05(matches) {
  const candidates=matches.filter(m=>{
    const minute=Number(m.minute||0);
    const hs=Number(m.score_home||0),as=Number(m.score_away||0);
    return m.sport==="Football" && m.source==="api-sports" &&
      minute>=25 && minute<=80 && !(hs>0 && as>0);
  });

  const max=Math.max(1,Number(process.env.GOAL05_MAX_DEEP_CANDIDATES||3));
  const selected=new Set(candidates.slice(0,max).map(m=>String(m.fixtureId||m.id)));

  const enriched=await Promise.all(matches.map(async m=>{
    const id=String(m.fixtureId||m.id);
    if (!selected.has(id)) {
      return {...m,goal05Criteria:{
        eligible:false,play:false,reason:"hors_selection_profonde"
      }};
    }
    return {...m,goal05Criteria:await buildStrictGoal05Criteria(m)};
  }));

  await publishStrictGoal05Signals(enriched);
  return enriched;
}



let goal05PushObserverRunning = false;

async function runGoal05PushObserver() {
  if (goal05PushObserverRunning) return;
  goal05PushObserverRunning = true;

  try {
    const matches = await fetchLiveMatches();
    await enrichStrictGoal05(Array.isArray(matches) ? matches : []);
  } catch (error) {
    console.error("[fcm] observateur goal05:", error.message);
  } finally {
    goal05PushObserverRunning = false;
  }
}

// ── Live matches — football-data.org (gratuit, couvre Coupe du Monde) ─────────
function formatFDMatch(m) {
  return {
    id: `fd-${m.id}`,
    source: "football-data",
    sourceId: String(m.id),
    fixtureId: null,
    sport: "Football",
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    home_logo: m.homeTeam?.crest || null,
    away_logo: m.awayTeam?.crest || null,
    score_home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
    score_away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
    ht_home: m.score?.halfTime?.home ?? null,
    ht_away: m.score?.halfTime?.away ?? null,
    minute: m.minute ?? null,
    status: m.status === "FINISHED" ? "FINISHED" : "IN_PLAY",
    competition: m.competition?.name || "International",
    country: m.area?.name || m.competition?.area?.name || "",
    utcDate: m.utcDate,
  };
}

function normalizeFootballDataMatch(m) {
  return formatFDMatch(m);
}

function normalizeApiSportsFootballFixture(f) {
  const fixtureId = String(f.fixture.id);
  const match = {
    id: fixtureId,
    source: "api-sports",
    sourceId: fixtureId,
    fixtureId,
    sport: "Football",
    home: f.teams.home.name,
    away: f.teams.away.name,
    homeId: f.teams.home.id ?? null,
    awayId: f.teams.away.id ?? null,
    leagueId: f.league?.id ?? null,
    season: f.league?.season ?? null,
    home_logo: f.teams.home.logo || null,
    away_logo: f.teams.away.logo || null,
    score_home: f.goals.home ?? null,
    score_away: f.goals.away ?? null,
    ht_home: f.score?.halftime?.home ?? null,
    ht_away: f.score?.halftime?.away ?? null,
    minute: f.fixture.status.elapsed ?? null,
    status: "IN_PLAY",
    competition: f.league.name + (f.league.country !== "World" ? " · " + f.league.country : ""),
    country: f.league?.country || "",
    utcDate: f.fixture.date,
  };
  return { ...match, lowTrustCompetition: isLowTrustCompetition(match) };
}

// Categories interdites quel que soit le pays ou la competition. AUCUNE
// exemption (pas meme UEFA) ne doit pouvoir les laisser passer : constate le
// 29/07/2026, "Nasjonal U19 Champions League · Norway" a ete analysee car
// isUefaCompetition() matche sur le simple mot "champions league" contenu
// dans le nom d'une ligue jeunes norvegienne sans aucun rapport avec l'UEFA,
// et l'exemption UEFA court-circuitait alors tout le filtre low-trust. Un
// match U19 n'a rien a faire dans le Concile — cf. regles ANJ/conformite.
const CATEGORY_BAN_KEYWORDS = [
  "friendly", "friendlies", "club friendly", "international friendly", "amical", "amicaux",
  "u17", "u18", "u19", "u20", "u21", "u23",
  "under 17", "under 18", "under 19", "under 20", "under 21", "under 23",
  "reserve", "reserves", "b team", "ii ", " ii", "youth", "youth championship", "academy",
  "regional cup", "state cup", "state league",
  "world cup", "coupe du monde", "fifa world", "copa del mundo",
];

const LOW_TRUST_COMPETITION_KEYWORDS = [
  // Ligues exclues manuellement (performances négatives — rapports Hermes)
  "serbia", "usl league two",
  "fa cup · south-korea", "fa cup · south korea", "korean fa cup",
  "· china", "china", "chinese",
  "australia cup",
  // Divisions regionales/amateurs australiennes (NPL par etat) — le mot
  // "championship" du TRUSTED_COMPETITIONS (Championship anglaise) matchait
  // par erreur "Tasmania Northern Championship" etc. en sous-chaine, faisant
  // passer des ligues semi-pro pour fiables (constate le 01/08/2026, Greg —
  // match Tasmanie affiche a 100% de confiance sur "Matchs a venir").
  "tasmania", "npl", "national premier league",
  ...CATEGORY_BAN_KEYWORDS,
  // Divisions inférieures / groupes régionaux — données live lentes et peu fiables
  "kakkonen", "ykkonen", "lohko", "kolmonen", "regionalliga", "oberliga",
  "national league north", "national league south", "isthmian", "northern premier",
  // Afrique
  "ethiopia", "nigeria", "npfl", "tanzania", "kenya", "uganda",
  "ghana", "zambia", "zimbabwe", "mozambique", "cameroon", "cameroun",
  "rwanda", "burundi", "malawi", "botswana", "lesotho", "eswatini", "swaziland",
  "senegal", "ivory coast", "côte d'ivoire", "burkina",
  "congo", "angola", "namibia", "gabon", "togo", "benin", "niger · ",
  "madagascar", "mauritius", "cape verde", "guinea",
  "sierra leone", "liberia", "gambia", "eritrea", "djibouti", "comoros",
  "south africa", "algeria · ligue", "tunisia · ligue", "egypt · premier",
  // Asie
  "kazakhstan", "uzbekistan", "uzbek", "tajikistan", "kyrgyzstan", "turkmenistan",
  "myanmar", "cambodia", "laos", "vietnam", "v.league",
  "bangladesh", "nepal", "mongolia", "bhutan", "maldives", "brunei", "timor",
  "palestine", "jordan · ", "iraq", "syria", "yemen", "oman", "bahrain",
  "lebanon", "india", "sri lanka", "pakistan",
  "indonesia", "malaysia · ", "philippines", "thailand · ",
  // Divisions inférieures asiatiques (2e/3e divisions — volatiles, cause de pertes)
  "k league 2", "k-league 2", "j2 league", "j3 league", "j2-league", "j3-league",
  "china league one", "chinese league two",
  // Coupe de Corée + divisions amateurs coréennes (K3/K4) : équipes semi-pro,
  // scores fous (4-0, 4-3, 5-0), 6 pertes le 15/07/2026. On garde la K-League 1.
  // ⚠️ Ces entrées DOIVENT rester avant TRUSTED "fa cup" (ordre : LOW_TRUST gagne).
  "fa cup · south-korea", "fa cup · korea", "korea · fa cup", "korean fa cup",
  "korea fa cup", "coupe de corée", "coupe de coree", "korea cup",
  "k3 league", "k3-league", "k4 league", "k4-league", "k3 · korea", "k4 · korea",
  // Amérique du Sud — ligues secondaires
  "chile", "bolivia", "peru", "venezuela", "ecuador",
  "paraguay", "uruguay · segunda", "colombia · b",
  // Argentine — divisions inférieures (2e/3e/4e — très volatiles)
  "primera b metropolitana", "primera b nacional", "primera c", "primera d",
  "torneo federal", "argentina · primera b",
  // Amérique centrale et Caraïbes
  "honduras", "guatemala", "el salvador", "nicaragua",
  "costa rica", "panama · liga", "haiti", "jamaica", "trinidad",
  "dominican", "cuba", "belize", "suriname", "guyana",
  // Championnats europeens retires de TRUSTED le 03/08/2026 : ils n'etaient
  // bloques que par le "default = refuser" en fin de filtre. Greg les voyait
  // malgre tout apparaitre (07/08/2026, liste dictee : Pologne, Rep. Tcheque,
  // Roumanie L2, Russie, Finlande...). Un default ne protege que si TOUS les
  // chemins d'appel passent par le filtre — ce n'etait pas le cas de
  // computeUpcomingPicks, qui ne transmettait meme pas le pays. On les inscrit
  // donc EN DUR : LOW_TRUST est verifie en premier et gagne toujours, quel que
  // soit le chemin.
  // Finlande et Bulgarie RETIREES de cette liste le 07/08/2026 : elles passent
  // en trusted_secondary / watchlist_shadow (voir LEAGUE_TIERS). Les divisions
  // inferieures finlandaises restent bannies plus bas (kakkonen, ykkonen,
  // lohko, kolmonen) — seule la premiere division est concernee.
  "poland", "pologne", "ekstraklasa", "i liga · poland",
  "czech", "tchequie", "fortuna liga", "chance liga",
  // Pas de "liga i" / "liga ii" ici : la correspondance se fait en sous-chaine,
  // ces motifs trop courts matcheraient des championnats legitimes. "romania"
  // suffit, le pays accompagne toujours le nom de la division.
  "romania", "roumanie", "superliga · romania",
  "russia", "russie", "russian premier", "fnl",
  "ukraine", "ukrainian premier",
    // Europe — divisions inférieures/ligues exotiques
  "estonia", "latvia", "faroe", "gibraltar",
  "andorra", "malta", "san marino", "kosovo", "north macedonia",
  "albania", "moldova", "belarus", "armenia",
  "georgia · erovnuli", "georgian erovnuli",
  "azerbaijan", "iceland", "northern ireland",
  "luxembourg", "liechtenstein", "montenegro", "bosnia",
  // Océanie
  "fiji", "samoa", "tonga", "vanuatu", "solomon", "papua",
  "new caledonia", "tahiti",
  "australia · npl", "australian npl",
  "queensland premier league", "queensland · ", "victoria premier league",
  // Moyen-Orient (manquant)
  "iran",
  // USA — ligues amateurs/semi-pro
  "usl league two", "usl2", "usl league one",
  "npsl", "nisa", "mls next", "mls next pro",
  "us open cup", "usl w league",
];

// ── Classification des ligues (07/08/2026, decision du fondateur) ────────────
// Objectif : augmenter le volume analysable avant la reprise des grands
// championnats, sans degrader la qualite ni envoyer des signaux faibles.
//
//   trusted_major      — TRUSTED_COMPETITIONS, regime normal
//   trusted_secondary  — analyse ET diffusion autorisees, mais sous conditions
//                        strictes : cote REELLE obligatoire (jamais estimee),
//                        confiance rehaussee, resultat tracable
//   watchlist_shadow   — analyse SEULEMENT. Jamais de diffusion abonne, jamais
//                        de canal payant. On accumule des resultats resolus
//                        avant de decider si on les ouvre.
//
// Finlande et Bulgarie ont ete retirees de la liste noire pour rendre ceci
// possible ; leurs divisions inferieures y restent.
const LEAGUE_TIER_SECONDARY = [
  "superliga · denmark", "danish superliga", "superligaen", "denmark · superliga",
  "veikkausliiga", "finland · veikkausliiga",
  "nb i", "nb1", "otp bank liga", "hungary · nb", "hungarian nb",
  // Autriche ajoutee le 07/08/2026. Elle avait ete retiree de la liste blanche
  // le 03/08 avec la Pologne et la Russie, mais elle y rentrait quand meme par
  // la porte de derriere : la comparaison se fait en sous-chaine, et
  // "Austrian Bundesliga" contient "bundesliga", present pour l'Allemagne.
  // Elle etait donc traitee au meme rang que la Bundesliga allemande, par
  // accident. Meme mecanisme que le bug ouzbek du matin.
  // leagueTier() teste SECONDARY avant TRUSTED : ces motifs plus specifiques
  // gagnent donc sur le "bundesliga" generique, et l'Allemagne reste majeure.
  "austrian bundesliga", "bundesliga · austria", "austria · bundesliga",
  "admiral bundesliga", "osterreichische bundesliga", "österreichische bundesliga",
];
const LEAGUE_TIER_WATCHLIST = [
  "prvaliga", "slovenia · prva", "slovenian prvaliga",
  "parva liga", "first league · bulgaria", "bulgaria · first", "efbet liga",
  "a lyga", "lithuania · a lyga", "lithuanian a lyga",
];
// Points de confiance exiges EN PLUS du seuil normal pour une ligue secondaire.
const SECONDARY_CONF_BONUS = Math.max(0, Number(process.env.SECONDARY_CONF_BONUS || 2));

function leagueHaystack(match) {
  if (typeof match === "string") return match.toLowerCase();
  return [match?.competition, match?.league, match?.country]
    .filter(Boolean).join(" · ").toLowerCase();
}
// trusted_major | trusted_secondary | watchlist_shadow | null (non classee)
function leagueTier(match) {
  const h = leagueHaystack(match);
  if (!h) return null;
  if (LEAGUE_TIER_WATCHLIST.some(k => h.includes(k))) return "watchlist_shadow";
  if (LEAGUE_TIER_SECONDARY.some(k => h.includes(k))) return "trusted_secondary";
  if (TRUSTED_COMPETITIONS.some(k => h.includes(k))) return "trusted_major";
  return null;
}

const TRUSTED_COMPETITIONS = [
  "ligue 1", "ligue 2", "coupe de france",
  "premier league", "championship", "fa cup", "efl cup", "carabao",
  "la liga", "laliga", "segunda division", "copa del rey",
  "bundesliga", "2. bundesliga", "dfb-pokal",
  "serie a", "serie b", "coppa italia",
  "eredivisie",
  "pro league", "first division a",
  "liga portugal", "primeira liga",
  "super lig", "süper lig",
  "champions league", "europa league", "conference league",
  "euro 20", "uefa euro", "nations league",
  "liga mx", "copa libertadores", "copa sudamericana",
  "brasileirao", "serie a · brazil",
  "liga profesional", "copa argentina",
  "j1 league", "j-league", "meiji yasuda",
  "k league", "k-league",
  "chinese super league",
  // MLB retire le 30/07/2026 : aucune resolution automatique des issues
  // n'existe pour le baseball (resolveStalePredictions ne couvre que
  // Football/Basketball/Hockey) -> les analyses restaient "en attente"
  // indefiniment, et le sport pesait sur le quota API-Sports partage sans
  // jamais pouvoir se resoudre. NBA/NHL restent actifs, eux sont resolus.
  "nhl", "nba", "atp", "wta", "grand slam",
  "mlb", "major league baseball",
  "npb", "nippon professional baseball",
  "kbo", "kbo league",
  "top 14", "pro d2", "premiership rugby", "urc",
  "euroleague", "euroligue",
  "a-league", "a league · australia",
  // Ligues europeennes "moyennes" retirees le 03/08/2026 (Greg) : trop
  // souvent des faux signaux a forte confiance sur un volume de donnees
  // reduit (H2H peu fiable, ex. Cracovia-Pogon Ekstraklasa donne 100% BTTS
  // pre-match, perdu 0-2). Ne reste que la "creme de la creme" —
  // championnats majeurs + grandes competitions continentales/mondiales.
  // Retirees : Belgique, Croatie, Serbie, Grece, Suisse, Ecosse, Danemark,
  // Norvege, Finlande, Rep. Tcheque, Roumanie, Autriche, Hongrie,
  // Bulgarie, Slovaquie, Chypre, Pologne, Russie, Ukraine.
  "saudi pro league", "roshn",
  "uae pro league",
  "qsl", "qatar stars",
  "ahl",
  "nbl", "nbl · australia",
  // "australia cup" retiree le 04/08/2026 : deja bannie dans
  // LOW_TRUST_COMPETITION_KEYWORDS (ligne ~2135, LOW_TRUST gagne toujours),
  // cette entree ici n'avait donc jamais aucun effet — contradiction
  // trouvee en audit, pas un changement de politique.
];

function isLowTrustCompetition(matchOrCompetition = "") {
  if (typeof matchOrCompetition === "object" && isUsaOrCanadaMatch(matchOrCompetition)) return true;
  // On lit AUSSI league et country : selon la source (api-sports construit
  // "Ligue · Pays" dans competition, TheSportsDB laisse le pays a part), le nom
  // du pays peut n'exister que dans country — et la blacklist, qui raisonne
  // beaucoup par pays, passait alors a cote. Cas constate le 05/08/2026 :
  // "Olimpik-Mobiuz vs Jayxun · Pro League A · Uzbekistan" analyse malgre
  // "uzbekistan" present dans la liste depuis longtemps.
  const raw = typeof matchOrCompetition === "string"
    ? matchOrCompetition
    : [matchOrCompetition?.competition, matchOrCompetition?.league,
       matchOrCompetition?.country, matchOrCompetition?.home,
       matchOrCompetition?.away].filter(Boolean).join(" ");
  const value = String(raw || "").toLowerCase();
  if (LOW_TRUST_COMPETITION_KEYWORDS.some((keyword) => value.includes(keyword))) return true;
  if (TRUSTED_COMPETITIONS.some(tc => value.includes(tc))) return false;
  // Ligues classees secondaire ou en observation (07/08/2026) : elles ne sont
  // pas "de confiance" au sens du regime normal, mais elles doivent pouvoir
  // etre ANALYSEES. Ce sont les barrieres de DIFFUSION, plus bas, qui decident
  // ce qui sort — cote reelle obligatoire, confiance rehaussee, et aucune
  // diffusion du tout pour l'observation.
  if (LEAGUE_TIER_SECONDARY.some(k => value.includes(k))) return false;
  if (LEAGUE_TIER_WATCHLIST.some(k => value.includes(k))) return false;
  return true;
}

// Categorie interdite (jeunes, amateur, amical, Coupe du Monde...) : bannissement
// absolu, jamais leve par l'exemption UEFA. A verifier AVANT tout court-circuit
// "!isUefaCompetition(match) && ...", jamais a la place.
function isCategoryBanned(matchOrCompetition = "") {
  const raw = typeof matchOrCompetition === "string"
    ? matchOrCompetition
    : [matchOrCompetition?.competition, matchOrCompetition?.home, matchOrCompetition?.away].filter(Boolean).join(" ");
  const value = String(raw || "").toLowerCase();
  return CATEGORY_BAN_KEYWORDS.some((keyword) => value.includes(keyword));
}

// Perimetre volontairement etroit du produit client O/U 2,5. Les analyses
// hors de ce cadre restent en base pour apprendre, mais ne sont ni diffusees
// ni presentees comme des signaux recus par les abonnes.
function isClientOu25MatchEligible(match, requireMinute = true, maxMinute = CLIENT_OU25_CLIENT_MAX_MINUTE) {

  if (isAmericanFootballMatch(match)) return false;
  const sport = String(match?.sport || "Football").toLowerCase();
  if (!sport.includes("foot")) return false;
  const minute = parseLiveMinuteValue(match?.minute_at_analysis ?? match?.minute);
  if (requireMinute && (minute === null || minute < 15 || minute > maxMinute)) return false;
  if (isWomenMatch(match) || isCategoryBanned(match) || isLowTrustCompetition(match)) return false;
  if (leagueTier(match) !== "trusted_major") return false;
  const h = leagueHaystack(match);
  // Coupes, qualifications, barrages et amicaux ont un contexte trop variable
  // pour le track-record championnat utilise par le Concile.
  if (/\bcup\b|coupe|copa|pokal|coppa|taça|champions league|europa league|conference league|qualif|play[ -]?off|barrage|friendly|amical/.test(h)) return false;
  return true;
}

// Decision du 02/09/2026 : signal client des 4 votes concordants sur 5.
function clientOu25RequiredVotes() {
  return CLIENT_OU25_MIN_VOTES;
}

const recoveryRecentFormCache = new Map();

function recoveryNormalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function recoveryLeagueAllowed(match) {
  const h = recoveryNormalize([match?.competition, match?.league, match?.country].filter(Boolean).join(" · "));
  const country = (pattern) => pattern.test(h);
  const league = (pattern) => pattern.test(h);
  if (country(/england|angleterre/) && league(/premier league|championship/)) return true;
  if (country(/spain|espagne/) && league(/la ?liga( 2)?|laliga( 2)?|segunda division/)) return true;
  if (country(/italy|italie/) && league(/serie a|serie b/)) return true;
  if (country(/germany|allemagne/) && league(/bundesliga|2[.] bundesliga/)) return true;
  if (country(/france/) && league(/ligue 1|ligue 2/)) return true;
  if (country(/netherlands|pays-bas/) && league(/eredivisie/)) return true;
  if (country(/portugal/) && league(/liga portugal|primeira liga/)) return true;
  if (country(/belgium|belgique/) && league(/jupiler pro league|first division a|pro league/)) return true;
  return false;
}

function recoveryNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchRecoveryRecentGoalProfile(match, teamId, venue) {
  if (!API_SPORTS_KEY || !match?.leagueId || !match?.season || !teamId) return null;
  const key = `recovery_${match.leagueId}_${match.season}_${teamId}_${venue}`;
  const cached = recoveryRecentFormCache.get(key);
  if (cached && Date.now() - cached.ts < 6 * 3600 * 1000) return cached.data;
  if (!apiSportsBudgetOk()) return null;
  try {
    const data = await httpGet(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&league=${match.leagueId}&season=${match.season}&last=8&status=FT`,
      { "x-apisports-key": API_SPORTS_KEY }
    );
    const rows = (Array.isArray(data?.response) ? data.response : []).map((fixture) => {
      const homeId = Number(fixture?.teams?.home?.id);
      const awayId = Number(fixture?.teams?.away?.id);
      const homeGoals = recoveryNumber(fixture?.goals?.home);
      const awayGoals = recoveryNumber(fixture?.goals?.away);
      if (homeGoals === null || awayGoals === null || (homeId !== Number(teamId) && awayId !== Number(teamId))) return null;
      return { homeId, awayId, total: homeGoals + awayGoals };
    }).filter(Boolean).slice(0, 8);
    if (rows.length < 6) {
      recoveryRecentFormCache.set(key, { data: null, ts: Date.now() });
      return null;
    }
    const venueRows = rows.filter((row) => venue === "home"
      ? row.homeId === Number(teamId)
      : row.awayId === Number(teamId));
    if (venueRows.length < 2) {
      recoveryRecentFormCache.set(key, { data: null, ts: Date.now() });
      return null;
    }
    const avg = (items) => items.reduce((sum, row) => sum + row.total, 0) / items.length;
    const pct = (items, predicate) => 100 * items.filter(predicate).length / items.length;
    const out = {
      sample: rows.length,
      totalAvg: avg(rows),
      over25Pct: pct(rows, (row) => row.total >= 3),
      under25Pct: pct(rows, (row) => row.total <= 2),
      venueSample: venueRows.length,
      venueAvg: avg(venueRows),
      venueOver25Pct: pct(venueRows, (row) => row.total >= 3),
      venueUnder25Pct: pct(venueRows, (row) => row.total <= 2),
    };
    recoveryRecentFormCache.set(key, { data: out, ts: Date.now() });
    return out;
  } catch (error) {
    console.error("[recovery] forme recente:", error.message);
    return null;
  }
}

async function evaluateRecoveryEvidence(match, bet, liveStats) {
  if (!RECOVERY_MODE_ENABLED) return { ok: true, reason: "mode recovery desactive", indicators: [] };
  if (!recoveryLeagueAllowed(match)) return { ok: false, reason: "championnat hors liste Recovery", indicators: [] };
  const side = /^Over 2[.,]5 buts$/i.test(String(bet || "")) ? "over"
    : /^Under 2[.,]5 buts$/i.test(String(bet || "")) ? "under" : null;
  if (!side) return { ok: false, reason: "marche hors O/U 2,5", indicators: [] };

  const [homeProfile, awayProfile, injuries] = await Promise.all([
    fetchRecoveryRecentGoalProfile(match, match.homeId, "home"),
    fetchRecoveryRecentGoalProfile(match, match.awayId, "away"),
    fetchInjuries(match),
  ]);
  if (!homeProfile || !awayProfile) return { ok: false, reason: "historique 6-8 matchs ou contexte domicile/exterieur indisponible", indicators: [] };
  if (!injuries) return { ok: false, reason: "donnees absences indisponibles", indicators: [] };

  const combinedAvg = (homeProfile.totalAvg + awayProfile.totalAvg) / 2;
  const venueCombinedAvg = (homeProfile.venueAvg + awayProfile.venueAvg) / 2;
  const totals = [
    liveStats?.total_shots_home, liveStats?.total_shots_away,
    liveStats?.shots_on_goal_home, liveStats?.shots_on_goal_away,
    match?.score_home, match?.score_away,
  ].map(recoveryNumber);
  if (totals.some((value) => value === null)) return { ok: false, reason: "statistiques live incompletes", indicators: [] };
  const [shotsHome, shotsAway, onTargetHome, onTargetAway, scoreHome, scoreAway] = totals;
  const totalShots = shotsHome + shotsAway;
  const shotsOnTarget = onTargetHome + onTargetAway;
  const goals = scoreHome + scoreAway;

  const combinedAligned = side === "over"
    ? combinedAvg >= RECOVERY_OVER_MIN_AVG
    : combinedAvg <= RECOVERY_UNDER_MAX_AVG;
  const recentTrendAligned = side === "over"
    ? Math.max(homeProfile.over25Pct, awayProfile.over25Pct) >= 62.5
    : Math.max(homeProfile.under25Pct, awayProfile.under25Pct) >= 62.5;
  const venueAligned = side === "over"
    ? venueCombinedAvg >= RECOVERY_OVER_MIN_AVG && Math.max(homeProfile.venueOver25Pct, awayProfile.venueOver25Pct) >= 60
    : venueCombinedAvg <= RECOVERY_UNDER_MAX_AVG && Math.max(homeProfile.venueUnder25Pct, awayProfile.venueUnder25Pct) >= 60;
  const liveAligned = side === "over"
    ? (goals >= 1 || (totalShots >= 8 && shotsOnTarget >= 3))
    : (goals === 0 && totalShots <= 10 && shotsOnTarget <= 4);

  const indicators = [
    combinedAligned && "moyenne combinee",
    recentTrendAligned && "tendance recente",
    venueAligned && "domicile/exterieur",
    liveAligned && "confirmation live",
  ].filter(Boolean);
  // La règle annoncée est un quorum : trois signaux indépendants sur quatre.
  // Exiger les quatre booléens rendait la constante ci-dessus inopérante et
  // bloquait des dossiers pourtant conformes au mode Recovery.
  const ok = indicators.length >= RECOVERY_MIN_CONVERGENT_INDICATORS;
  return {
    ok,
    reason: ok ? "criteres Recovery valides" : `indicateurs non convergents (${indicators.length}/4)`,
    indicators,
    combinedAvg: Math.round(combinedAvg * 100) / 100,
    venueCombinedAvg: Math.round(venueCombinedAvg * 100) / 100,
    injuriesAvailable: true,
  };
}

function recoverySignalsSentToday() {
  return Math.max(
    signalsSentToday("sig_sent_standard"),
    signalsSentToday("sig_sent_premium"),
    signalsSentToday("sig_sent_elite")
  );
}

const storedOu25ConsensusCache = new Map();
function storedOu25Consensus(row) {
  const key = String(row?.match_key || "");
  if (!key) return { complete: false, voteCount: 0, bet: null };
  if (storedOu25ConsensusCache.has(key)) return storedOu25ConsensusCache.get(key);
  let state = { complete: false, voteCount: 0, bet: null };
  // Preuve exacte du scrutin qui a produit cette analyse. Les predictions
  // multi-marches portent une cle de snapshot (minute/score), tandis que
  // concile_analyses porte la cle canonique du match : les joindre strictement
  // masquait donc sur l'accueil des signaux pourtant livres et resolus.
  try {
    const persistedAgents = JSON.parse(row?.agents_json || "[]");
    const official = new Map();
    for (const agent of persistedAgents) {
      const name = String(agent?.name || "");
      const bet = String(agent?.bet || "").trim();
      if (CONCILE_AGENT_NAMES.includes(name) && isOu25Bet(bet)) official.set(name, bet);
    }
    const counts = {};
    for (const bet of official.values()) counts[bet] = (counts[bet] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (official.size === 5) {
      state = { complete: true, voteCount: Number(top?.[1] || 0), bet: top?.[0] || null };
      storedOu25ConsensusCache.set(key, state);
      return state;
    }
  } catch (_) {}
  try {
    const placeholders = CONCILE_AGENT_NAMES.map(() => "?").join(",");
    const rows = db.prepare(`
      SELECT bet, COUNT(DISTINCT agent_name) AS n
      FROM agent_market_predictions
      WHERE match_key = ? AND market_line = 'buts'
        AND agent_name IN (${placeholders})
        AND bet IN ('Over 2.5 buts','Under 2.5 buts')
      GROUP BY bet
    `).all(key, ...CONCILE_AGENT_NAMES);
    const active = rows.reduce((sum, item) => sum + Number(item.n || 0), 0);
    const top = rows.slice().sort((a, b) => Number(b.n || 0) - Number(a.n || 0))[0];
    state = { complete: active === 5, voteCount: Number(top?.n || 0), bet: top?.bet || null };
  } catch (e) { console.error("[ou25-history]", e.message); }
  if (storedOu25ConsensusCache.size > 5000) storedOu25ConsensusCache.clear();
  storedOu25ConsensusCache.set(key, state);
  return state;
}

const storedTelegramDeliveryCache = new Map();
function storedTelegramDelivery(row) {
  const key = String(row?.match_key || "");
  if (!key) return { paid: false, channels: new Set() };
  if (storedTelegramDeliveryCache.has(key)) return storedTelegramDeliveryCache.get(key);
  let proof = { paid: false, channels: new Set() };
  try {
    const rows = db.prepare(`
      SELECT DISTINCT channel
      FROM telegram_signal_deliveries
      WHERE match_key = ? AND ok = 1 AND telegram_message_id IS NOT NULL
    `).all(key);
    const channels = new Set(rows.map(item => String(item.channel || "")));
    proof = {
      paid: ["standard", "premium", "elite"].some(channel => channels.has(channel)),
      channels,
    };
  } catch (e) { console.error("[telegram-history]", e.message); }
  if (storedTelegramDeliveryCache.size > 5000) storedTelegramDeliveryCache.clear();
  storedTelegramDeliveryCache.set(key, proof);
  return proof;
}

function legacySentChannels(row) {
  const channels = new Set();
  if (row?.sig_sent_standard === 1 || row?.sig_sent_standard === true) channels.add("standard");
  if (row?.sig_sent_premium === 1 || row?.sig_sent_premium === true) channels.add("premium");
  if (row?.sig_sent_elite === 1 || row?.sig_sent_elite === true) channels.add("elite");
  if (row?.sig_sent_free === 1 || row?.sig_sent_free === true) channels.add("free");
  return channels;
}

const CLIENT_HISTORY_REPAIR_DATE = "2026-08-26";
const CLIENT_TELEGRAM_PROOF_SINCE = "2026-08-27";
function isVerifiedClientOu25Row(row) {
  const day = String(row?.analysed_at || "").slice(0, 10);
  // Historique ancien : comportement conserve.
  if (day && day < CLIENT_HISTORY_REPAIR_DATE) return true;

  // REGLE FONDATEUR 30/08/2026 : une livraison Telegram reussie est une preuve
  // definitive. Une analyse deja envoyee a un client ne peut PLUS disparaitre
  // du site ou de l'application parce qu'une observation ulterieure change
  // diffusion_block, le consensus courant, la cote ou l'eligibilite live.
  // Apres livraison, seuls le score final et outcome (win/loss) peuvent evoluer.
  const delivery = storedTelegramDelivery(row);
  const channels = day >= CLIENT_TELEGRAM_PROOF_SINCE
    ? delivery.channels
    : legacySentChannels(row);
  const deliveredToClient = ["free", "standard", "premium", "elite"]
    .some(channel => channels.has(channel));

  return deliveredToClient && isOu25Bet(row?.best_bet);
}

function displayDeliveryChannels(row) {
  const day = String(row?.analysed_at || "").slice(0, 10);
  return day >= CLIENT_TELEGRAM_PROOF_SINCE
    ? storedTelegramDelivery(row).channels
    : legacySentChannels(row);
}

// Filtre allégé pour l'AFFICHAGE de la page Live IA (menu de matchs à analyser).
// On bloque uniquement les ligues explicitement blacklistées (jeunes, amicaux,
// ligues à matchs truqués) mais on ne bloque PAS un match juste parce qu'il n'est
// pas dans la whitelist. Le filtre strict isLowTrustCompetition reste utilisé pour
// ce qu'Hermes recommande (pick quotidien, auto-concile).
function isBlacklistedForLiveDisplay(matchOrCompetition = "") {
  if (typeof matchOrCompetition === "object" && isAmericanFootballMatch(matchOrCompetition)) return true;
  // league/country lus aussi, meme raison que dans isLowTrustCompetition.
  const raw = typeof matchOrCompetition === "string"
    ? matchOrCompetition
    : [matchOrCompetition?.competition, matchOrCompetition?.league,
       matchOrCompetition?.country, matchOrCompetition?.home,
       matchOrCompetition?.away].filter(Boolean).join(" ");
  const value = String(raw || "").toLowerCase();
  if (LOW_TRUST_COMPETITION_KEYWORDS.some((keyword) => value.includes(keyword))) return true;
  if (typeof matchOrCompetition === "object" && isWomenMatch(matchOrCompetition)) return true;
  return false;
}

// Détecte les matchs féminins (compétitions "W"/Women/Féminin, équipes suffixées " W").
function isWomenMatch(match) {
  if (!match) return false;
  const comp = String(match.competition || match.league || "").toLowerCase();
  const home = String(match.home || "").trim();
  const away = String(match.away || "").trim();
  // "femenil" (orthographe espagnole reelle, ex: "Liga MX Femenil") manquait —
  // seul "femenin" etait couvert. Une Liga MX Femenil est passee a travers ce
  // trou le 02/08/2026 (rattrapee par le teamHit sur "W" en fin de nom, mais
  // ne pas dependre d'un seul filet).
  const compHit = /\bwomen\b|f[ée]minin|femenin|femenil|femminile|frauen|\bnwsl\b|\bwsl\b|wk-league|w-league|w league|kobiet|damallsvenskan|\bfeminine\b|\bwomens?\b/.test(comp);
  const teamHit = /(\s|\()w\)?$/i.test(home) || /(\s|\()w\)?$/i.test(away) || /\bwomen\b/i.test(home) || /\bwomen\b/i.test(away);
  return compHit || teamHit;
}

// R5 — aucun match des Etats-Unis ni du Canada. On s'appuie d'abord sur le
// pays structure fourni par l'API, puis sur des noms de competitions precis.
// Les noms d'equipes ne sont volontairement pas testes avec les fragments
// "usa"/"canada" afin d'eviter les faux positifs sur Kusadasi, Yusa, etc.
function isUsaOrCanadaMatch(match) {
  if (!match) return false;
  const norm = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const country = norm(match.country || match.league?.country);
  if (["usa", "us", "united states", "united states of america", "canada"].includes(country)) return true;
  const competition = norm([
    typeof match.competition === "string" ? match.competition : "",
    typeof match.league === "string" ? match.league : match.league?.name,
  ].filter(Boolean).join(" · "));
  return /\bmajor league soccer\b|\bmls\b|\busl(?: championship| super league)?\b|\bnwsl\b|\bcanadian premier\b|\bcanadian championship\b/.test(competition);
}

// Auto-blacklist dynamique : compétitions où le taux de réussite est trop faible.
// Boucle d'auto-amélioration — on cesse d'analyser ce qui fait perdre.
let _weakCompCache = { set: new Set(), ts: 0 };
function getUnderperformingCompetitions() {
  if (Date.now() - _weakCompCache.ts < 60 * 60 * 1000) return _weakCompCache.set;
  const weak = new Set();
  try {
    const rows = db.prepare(`
      SELECT competition,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN outcome IN ('win','loss') THEN 1 ELSE 0 END) AS total
      FROM concile_analyses
      WHERE outcome IN ('win','loss') AND competition IS NOT NULL AND competition != ''
      GROUP BY competition
      HAVING total >= 8
    `).all();
    for (const r of rows) {
      const wr = r.total > 0 ? r.wins / r.total : 1;
      if (wr < 0.45) {
        weak.add(String(r.competition).toLowerCase());
        console.log(`[weak-comp] Compétition exclue (auto): ${r.competition} — ${Math.round(wr*100)}% sur ${r.total} analyses`);
      }
    }
  } catch (e) { console.error("[weak-comp]", e.message); }
  _weakCompCache = { set: weak, ts: Date.now() };
  return weak;
}

function isUnderperformingCompetition(match) {
  const comp = String(match?.competition || "").toLowerCase();
  if (!comp) return false;
  return getUnderperformingCompetitions().has(comp);
}

// ── Barrière qualité : ne PROPOSER (signaler) que les segments prouvés gagnants ─
// Le système continue d'analyser tout (pour apprendre), mais un signal ne part au
// client que si la ligue et/ou le marché ont un track record réel suffisant.
const QUALITY_GATE_ENABLED = process.env.QUALITY_GATE !== "0";
let _segmentStatsCache = { data: null, ts: 0 };

function getSegmentStats() {
  if (_segmentStatsCache.data && Date.now() - _segmentStatsCache.ts < 60 * 60 * 1000) return _segmentStatsCache.data;
  const data = { comp: {}, market: {}, compMarket: {}, sport: {}, sportMarket: {} };
  try {
    const raw = db.prepare(`
      SELECT home, away, competition, sport, best_bet, outcome, analysed_at
      FROM concile_analyses
      WHERE outcome IN ('win','loss')
    `).all();
    // Déduplication indispensable ICI aussi : ces statistiques décident quels
    // segments sont bloqués. Un même match remonté par deux sources sous des
    // noms légèrement différents comptait double — et quand les deux analyses
    // portaient des paris opposés (cas du 28/07/2026), le moteur apprenait
    // simultanément qu'un segment gagne ET qu'il perd, sur le même événement.
    const rows = dedupeAnalysesByMatch(raw);
    const bump = (obj, key, win) => { const o = (obj[key] = obj[key] || { w: 0, t: 0 }); o.t++; if (win) o.w++; };
    for (const r of rows) {
      const comp = String(r.competition || "").toLowerCase();
      const sport = String(r.sport || "Football").toLowerCase();
      const mk = categorizeBet(r.best_bet);
      const win = r.outcome === "win";
      if (comp) bump(data.comp, comp, win);
      if (mk !== "NO BET") bump(data.market, mk, win);
      if (comp && mk !== "NO BET") bump(data.compMarket, comp + "||" + mk, win);
      // Dimension sport : un marché peut très bien marcher au football et
      // s'effondrer au baseball, où la dynamique n'a rien à voir.
      if (sport) bump(data.sport, sport, win);
      if (sport && mk !== "NO BET") bump(data.sportMarket, sport + "||" + mk, win);
    }
  } catch (e) { console.error("[segment-stats]", e.message); }
  _segmentStatsCache = { data, ts: Date.now() };
  return data;
}

function passesHistoricalQualityGate(match, bet) {
  if (!QUALITY_GATE_ENABLED) return { ok: true, reason: "gate off" };
  const stats = getSegmentStats();
  const comp = String(match?.competition || "").toLowerCase();
  const mk = categorizeBet(bet);
  const wr = (o) => (o && o.t > 0 ? o.w / o.t : null);

  // 1) Ligue × marché — le plus précis. >=6 analyses et <50% de réussite => on bloque.
  const cm = stats.compMarket[comp + "||" + mk];
  if (cm && cm.t >= 6 && wr(cm) < 0.50) {
    return { ok: false, reason: `${mk} en ${match.competition} : ${Math.round(wr(cm) * 100)}% (${cm.t} analyses)` };
  }
  // 2) Ligue seule — >=12 analyses et <52% => on bloque.
  const c = stats.comp[comp];
  if (c && c.t >= 12 && wr(c) < 0.52) {
    return { ok: false, reason: `ligue ${match.competition} : ${Math.round(wr(c) * 100)}% (${c.t} analyses)` };
  }
  // 2 bis) Sport × marché — un marché rentable au football peut s'effondrer sur
  // un sport à dynamique différente. Seuil volontairement plus exigeant en
  // volume (>=10) : les sports hors football ont peu d'historique, on évite de
  // condamner un segment sur un échantillon trop mince.
  const sport = String(match?.sport || "Football").toLowerCase();
  const sm = stats.sportMarket[sport + "||" + mk];
  if (sm && sm.t >= 10 && wr(sm) < 0.50) {
    return { ok: false, reason: `${mk} en ${match.sport || "Football"} : ${Math.round(wr(sm) * 100)}% (${sm.t} analyses)` };
  }
  // 2 ter) Sport seul — >=30 analyses et <50%. Bloquer un sport entier est la
  // décision la plus lourde du filtre, donc le volume exigé est le plus élevé.
  const sp = stats.sport[sport];
  if (sp && sp.t >= 30 && wr(sp) < 0.50) {
    return { ok: false, reason: `sport ${match.sport || "Football"} : ${Math.round(wr(sp) * 100)}% (${sp.t} analyses)` };
  }
  // 3) Marché seul — >=25 analyses et <50% => on bloque.
  const m = stats.market[mk];
  if (m && m.t >= 25 && wr(m) < 0.50) {
    return { ok: false, reason: `marché ${mk} : ${Math.round(wr(m) * 100)}% (${m.t} analyses)` };
  }
  return { ok: true, reason: "segment fiable ou historique insuffisant (seuil 85% appliqué)" };
}

// ── Score "meilleur pari" : valeur (EV) + confiance + segment prouvé gagnant ──
// Ne pousser en Premium que l'élite (3-4/jour) au lieu du premier venu.
// EV = espérance sur mise unitaire = p·(cote−1) − (1−p). Positif = pari à valeur.
function bestBetGrade(match, bet, confidence, cote) {
  const p = (Number(confidence) || 0) / 100;
  const c = Number(cote) || 0;
  const ev = c > 0 ? (p * (c - 1) - (1 - p)) : -1;
  const stats = getSegmentStats();
  const comp = String(match?.competition || "").toLowerCase();
  const mk = categorizeBet(bet);
  const seg = stats.compMarket[comp + "||" + mk] || stats.comp[comp];
  const segWr = seg && seg.t >= 8 ? seg.w / seg.t : null;
  // Élite = valeur positive ET (confiance très haute OU segment historiquement gagnant)
  const elite = ev > 0 && ((Number(confidence) || 0) >= 88 || (segWr !== null && segWr >= 0.62));
  return { ev, segWr, elite };
}

// ── Palier du signal : Standard / Premium / Elite ──
// Filtrage APRÈS analyse : le concile recommande librement, on classe ensuite.
// Standard = crème (Under 2.5, ≥90%, envoyé 45-60') → peu de volume, très fiable
// Premium  = solide (Under/Over 2.5, ≥86%, envoyé 40-65')
// Elite    = tout le reste qualifié (≥82%, toute fenêtre)
function computeSignalTier(bet, confidence, minute) {
  const c = Number(confidence) || 0;
  const m = Number(minute) || 60;
  const b = String(bet || "").toLowerCase();
  const isUnder = /under|moins de 2[.,]5/i.test(b);
  const isOver = /over|plus de 2[.,]5/i.test(b);
  if (c >= 90 && isUnder && m >= 45 && m <= 60) return "standard";
  if (c >= 86 && (isUnder || isOver) && m >= 40 && m <= 65) return "premium";
  if (c >= 82) return "elite";
  return null;
}

// ── Contrôle de VALEUR : ne pas proposer un pari déjà joué ou à cote ridicule ──
const MIN_PLAYABLE_ODD = Math.max(1.05, Number(process.env.MIN_PLAYABLE_ODD || 1.30));
// Plafond de cote : au-delà, le book estime l'événement peu probable = longshot
// perdant (ex: "Under 2.5 @ 3.65" du 15/07/2026 = -10€).
// Fenêtre réglée par le fondateur le 28/07/2026 : cote jouable entre 1.30 et 2.50.
const MAX_PLAYABLE_ODD = Math.min(3.0, Number(process.env.MAX_PLAYABLE_ODD || 2.50));

function betIsPlayable(match, bet, cote) {
  // Cote trop faible = aucune valeur (ex: victoire à 1.10 sur un 3-0)
  if (cote && cote < MIN_PLAYABLE_ODD) {
    return { ok: false, reason: `cote ${cote} < ${MIN_PLAYABLE_ODD} (trop faible, pas de valeur)` };
  }
  // Cote trop haute = longshot que le book juge improbable (règle métier : max 1.95)
  if (cote && cote > MAX_PLAYABLE_ODD) {
    return { ok: false, reason: `cote ${cote} > ${MAX_PLAYABLE_ODD} (longshot, trop risqué)` };
  }
  const sh = Number(match?.score_home), sa = Number(match?.score_away);
  if (Number.isFinite(sh) && Number.isFinite(sa)) {
    const diff = sh - sa;
    const total = sh + sa;
    const b = String(bet || "").toLowerCase();

    // Victoire déjà quasi acquise (écart >= 2 buts) → pari déjà joué, cote irréaliste.
    // On reconnaît "Victoire domicile/extérieur" MAIS AUSSI "Victoire <nom d'équipe>"
    // (ex: "Victoire Apollon Limassol" à 0-3 doit être bloqué — bug corrigé 23/07).
    const isWinBet = /victoire|vainqueur|winner|\bwin\b/.test(b) || /^[12]$/.test(b);
    if (isWinBet) {
      const norm = (s) => String(s || "").toLowerCase().trim();
      const homeN = norm(match?.home), awayN = norm(match?.away);
      const firstWord = (s) => (s.split(/[\s.]+/).filter(Boolean)[0] || "");
      const hMentioned = homeN && (b.includes(homeN) || (firstWord(homeN).length >= 3 && b.includes(firstWord(homeN))));
      const aMentioned = awayN && (b.includes(awayN) || (firstWord(awayN).length >= 3 && b.includes(firstWord(awayN))));
      const isHomeWin = /victoire.*(dom|home)|domicile|^1$/.test(b) || (hMentioned && !aMentioned);
      const isAwayWin = /victoire.*(ext|away)|ext[eé]rieur|^2$/.test(b) || (aMentioned && !hMentioned);
      if (isHomeWin && diff >= 2) {
        return { ok: false, reason: `domicile mène déjà ${sh}-${sa} — victoire déjà jouée` };
      }
      if (isAwayWin && diff <= -2) {
        return { ok: false, reason: `extérieur mène déjà ${sh}-${sa} — victoire déjà jouée` };
      }
    }
    // Over / Under déjà tranchés par le score actuel
    const overM = b.match(/(?:over|plus de)\s*(\d+(?:\.5)?)/);
    if (overM && total > parseFloat(overM[1])) {
      return { ok: false, reason: `Over ${overM[1]} déjà atteint (${total} buts) — plus rien à gagner` };
    }
    const underM = b.match(/(?:under|moins de|inf[eé]rieur)\s*(?:à\s*)?(\d+(?:\.5)?)/);
    if (underM && total > parseFloat(underM[1])) {
      return { ok: false, reason: `Under ${underM[1]} déjà perdu (${total} buts)` };
    }
    // Double chance sans valeur si un gros écart est déjà là
    if (/double chance|1x|x2/.test(b) && Math.abs(diff) >= 2) {
      return { ok: false, reason: `écart ${sh}-${sa} — double chance sans valeur` };
    }
  }
  return { ok: true, reason: "valeur ok" };
}

function getVerifiedFixtureId(match) {
  if (!match || match.source !== "api-sports" || match.sport !== "Football") return null;
  const fixtureId = match.fixtureId || match.sourceId || match.id;
  if (!fixtureId) return null;
  const id = String(fixtureId);
  if (!/^\d+$/.test(id)) return null;
  return id;
}

function buildStatsStatus(match, stats, reason) {
  return {
    available: !!stats,
    source: stats ? "api-sports" : null,
    fixtureId: getVerifiedFixtureId(match),
    reason: stats ? null : reason,
    stats: stats || null,
  };
}

// TLM-PUBLIC-FOOTBALL-SCOPE-V3-20260830
// Périmètre client : football/soccer uniquement, compétitions reconnues.
// Les pays/ligues faibles sont éliminés avant les traitements coûteux.
const PUBLIC_FOOTBALL_BLOCKED_COUNTRIES = new Set([
  "usa", "us", "united states", "united states of america", "canada",
  "costa rica", "nicaragua", "ecuador", "chile", "paraguay",
  "afghanistan", "iraq", "algeria", "algerie", "tunisia", "tunisie",
  "morocco", "maroc", "kazakhstan", "azerbaijan", "uzbekistan"
]);

function tlmScopeNorm(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function tlmScopeCountry(match) {
  const direct = tlmScopeNorm(match?.country || match?.league?.country || match?.area?.name);
  if (direct) return direct;
  const comp = tlmScopeNorm([
    typeof match?.competition === "string" ? match.competition : match?.competition?.name,
    typeof match?.league === "string" ? match.league : match?.league?.name,
  ].filter(Boolean).join(" · "));
  const checks = [
    ["united states of america","usa"],["united states","usa"],["usa","usa"],["canada","canada"],
    ["costa rica","costa rica"],["costa-rica","costa rica"],["nicaragua","nicaragua"],
    ["ecuador","ecuador"],["chile","chile"],["paraguay","paraguay"],
    ["afghanistan","afghanistan"],["iraq","iraq"],["algeria","algeria"],["algerie","algerie"],
    ["tunisia","tunisia"],["tunisie","tunisie"],["morocco","morocco"],["maroc","maroc"],
    ["kazakhstan","kazakhstan"],["azerbaijan","azerbaijan"],["uzbekistan","uzbekistan"],
    ["mexico","mexico"],["brazil","brazil"],["brasil","brazil"]
  ];
  for (const [needle,value] of checks) if (comp.includes(needle)) return value;
  return "";
}

function isPublicFootballScopeMatch(match) {
  if (!match || isAmericanFootballMatch(match)) return false;
  const sport = tlmScopeNorm(match.sport || "Football");
  if (!(sport.includes("football") || sport.includes("soccer"))) return false;
  if (isWomenMatch(match) || isCategoryBanned(match) || isUsaOrCanadaMatch(match)) return false;

  const country = tlmScopeCountry(match);
  if (PUBLIC_FOOTBALL_BLOCKED_COUNTRIES.has(country)) return false;
  if (isLowTrustCompetition(match)) return false;

  const comp = tlmScopeNorm([
    typeof match?.competition === "string" ? match.competition : match?.competition?.name,
    typeof match?.league === "string" ? match.league : match?.league?.name,
    match?.country,
  ].filter(Boolean).join(" · "));

  // Mexique : Liga MX uniquement. Les divisions semi-pro restent hors périmètre.
  if (country === "mexico" && !/\bliga mx\b/.test(comp)) return false;

  // Par défaut seules les ligues déjà reconnues par le moteur passent.
  const tier = leagueTier(match);
  return tier === "trusted_major" || tier === "trusted_secondary";
}

async function fetchFromFootballData() {
  if (!FOOTBALL_DATA_KEY) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    // Matchs EN COURS + TERMINÉS + PROGRAMMÉS aujourd'hui
    const [liveData, finishedData, scheduledData] = await Promise.all([
      httpGet("https://api.football-data.org/v4/matches?status=LIVE", { "X-Auth-Token": FOOTBALL_DATA_KEY }),
      httpGet(`https://api.football-data.org/v4/matches?status=FINISHED&dateFrom=${yesterday}&dateTo=${today}`, { "X-Auth-Token": FOOTBALL_DATA_KEY }),
      httpGet(`https://api.football-data.org/v4/matches?status=SCHEDULED,TIMED&dateFrom=${today}&dateTo=${today}`, { "X-Auth-Token": FOOTBALL_DATA_KEY }),
    ]);
    const live = (liveData.matches || []).map((m) => {
      const match = formatFDMatch(m);
      return { ...match, lowTrustCompetition: isLowTrustCompetition(match) };
    });
    const finished = (finishedData.matches || []).map((m) => {
      const match = formatFDMatch(m);
      return { ...match, lowTrustCompetition: isLowTrustCompetition(match) };
    });
    const scheduled = (scheduledData.matches || []).map((m) => {
      const match = formatFDMatch(m);
      return { ...match, lowTrustCompetition: isLowTrustCompetition(match) };
    });
    const all = [...live, ...scheduled, ...finished];
    console.log(`[live-matches] football-data.org: ${live.length} live, ${scheduled.length} scheduled, ${finished.length} finished`);
    return all;
  } catch (e) {
    console.error("[live-matches] football-data.org error:", e.message);
    return null;
  }
}

// ── Live matches — API-Sports (fallback) ──────────────────────────────────────
// Statuts bruts API-Sports (basket/hockey/baseball) qui NE sont PAS du live
// exploitable : match pas commence (NS), reporte, annule, suspendu, termine.
// Sans ce filtre, ces matchs apparaissaient en "En direct" avec le statut force
// a IN_PLAY, alors qu'ils ne sont pas analysables (aucun temps de jeu, aucune
// dynamique, aucune cote pertinente).
const API_SPORTS_NON_LIVE_STATUSES = new Set([
  "NS", "TBD", "PST", "CANC", "ABD", "AWD", "WO", "SUSP", "INTR",
  "FT", "AOT", "AP", "POST", "CANCELLED", "FINISHED",
]);
function isApiSportsLiveGame(g) {
  const short = String(g?.status?.short || "").toUpperCase();
  if (!short) return true; // statut absent : on ne bloque pas (comportement inchange)
  return !API_SPORTS_NON_LIVE_STATUSES.has(short);
}

// Basketball/hockey/baseball sont facturés par API-Sports sur un quota SEPARE
// de celui du football (100 requêtes/jour chacun sur le plan actuel), mais
// partageaient jusqu'ici le même cache 60 s que le football — un simple
// visiteur avec l'onglet Live IA ouvert (poll 60 s) suffisait à épuiser leur
// quota en ~1h40. Ces 3 sports sont secondaires (peu de matchs, peu de trafic
// dessus) : on ne les interroge réellement qu'au maximum une fois toutes les
// SECONDARY_SPORT_MIN_INTERVAL_MS, quel que soit le rythme de rafraîchissement
// du cache global. Le football garde son cadencement normal (produit principal).
const SECONDARY_SPORT_MIN_INTERVAL_MS = Math.max(1, Number(process.env.SECONDARY_SPORT_POLL_MIN_MINUTES || 10)) * 60 * 1000;
const apiSportsLastFetch = { basketball: 0, hockey: 0, baseball: 0 };

function shouldSkipSecondarySportPoll(sport) {
  const last = apiSportsLastFetch[sport] || 0;
  if (Date.now() - last < SECONDARY_SPORT_MIN_INTERVAL_MS) return true;
  apiSportsLastFetch[sport] = Date.now();
  return false;
}

async function fetchFromApiSports() {
  if (!API_SPORTS_KEY) return null;
  const results = [];

  // Football live
  try {
    if (!shouldSkipApiSportsSport("football")) {
      const data = await httpGet("https://v3.football.api-sports.io/fixtures?live=all", { "x-apisports-key": API_SPORTS_KEY });
      if (!handleApiSportsErrors("football", data)) {
      const items = (data.response || []).slice(0, 60).map(normalizeApiSportsFootballFixture);
      results.push(...items);
      console.log(`[live-matches] API-Sports football: ${items.length}`);
      }
    }
  } catch(e) { console.error("[live-matches] API-Sports football:", e.message); }

  // Basketball live — desactive quand AUTO_CONCILE_MULTISPORT=0 (decision
  // fondateur 02/08/2026 : focus football, ne plus gaspiller de requetes/tokens
  // sur des sports dont aucune analyse n'est de toute facon diffusee).
  try {
    if (AUTO_CONCILE_MULTISPORT && !shouldSkipApiSportsSport("basketball") && !shouldSkipSecondarySportPoll("basketball")) {
    const data = await httpGet("https://v1.basketball.api-sports.io/games?live=all", { "x-apisports-key": API_SPORTS_KEY });
    if (!handleApiSportsErrors("basketball", data)) {
    const items = (data.response || []).filter(isApiSportsLiveGame).slice(0, 10).map((g) => ({
      id: "bk-" + g.id, sport: "Basketball",
      source: "api-sports",
      sourceId: String(g.id),
      fixtureId: null,
      home: g.teams?.home?.name, away: g.teams?.away?.name,
      home_logo: g.teams?.home?.logo || null, away_logo: g.teams?.away?.logo || null,
      score_home: g.scores?.home?.total ?? null, score_away: g.scores?.away?.total ?? null,
      minute: g.status?.timer ?? null, status: "IN_PLAY",
      // Quart-temps (Q1-Q4, OT, MT...) — sans lui, l'horloge affichée seule
      // ne dit pas dans quel quart-temps on est (signalé par Greg le 01/08/2026).
      period: g.status?.short || null,
      competition: (g.league?.name || "Basketball") + (g.country?.name ? " · " + g.country.name : ""),
      utcDate: g.date,
    })).filter(g => g.home && g.away);
    results.push(...items);
    console.log(`[live-matches] API-Sports basketball: ${items.length}`);
    }
    }
  } catch(e) { console.error("[live-matches] API-Sports basketball:", e.message); }

  // Hockey live — desactive quand AUTO_CONCILE_MULTISPORT=0 (voir basketball ci-dessus)
  try {
    if (AUTO_CONCILE_MULTISPORT && !shouldSkipApiSportsSport("hockey") && !shouldSkipSecondarySportPoll("hockey")) {
    const data = await httpGet("https://v1.hockey.api-sports.io/games?live=all", { "x-apisports-key": API_SPORTS_KEY });
    if (!handleApiSportsErrors("hockey", data)) {
    const items = (data.response || []).filter(isApiSportsLiveGame).slice(0, 30).map((g) => ({
      id: "hk-" + g.id, sport: "Hockey",
      source: "api-sports",
      sourceId: String(g.id),
      fixtureId: null,
      home: g.teams?.home?.name, away: g.teams?.away?.name,
      home_logo: g.teams?.home?.logo || null, away_logo: g.teams?.away?.logo || null,
      score_home: g.scores?.home ?? null, score_away: g.scores?.away ?? null,
      minute: g.status?.timer ?? null, status: "IN_PLAY",
      period: g.status?.short || null,
      competition: (g.league?.name || "Hockey") + (g.country?.name ? " · " + g.country.name : ""),
      utcDate: g.date,
    })).filter(g => g.home && g.away);
    results.push(...items);
    console.log(`[live-matches] API-Sports hockey: ${items.length}`);
    }
    }
  } catch(e) { console.error("[live-matches] API-Sports hockey:", e.message); }

  // Baseball live — REACTIVE le 01/08/2026 (decision fondateur, trêve
  // football estivale) : resolveStalePredictions couvre desormais le baseball
  // (voir plus bas), le blocage "en attente" indefini qui avait motive la
  // desactivation du 30/07/2026 n'existe plus.
  const BASEBALL_LIVE_ENABLED = true;
  try {
    if (AUTO_CONCILE_MULTISPORT && BASEBALL_LIVE_ENABLED && !shouldSkipApiSportsSport("baseball") && !shouldSkipSecondarySportPoll("baseball")) {
    const data = await httpGet("https://v1.baseball.api-sports.io/games?live=all", { "x-apisports-key": API_SPORTS_KEY });
    if (!handleApiSportsErrors("baseball", data)) {
    const items = (data.response || []).filter(isApiSportsLiveGame).slice(0, 10).map((g) => ({
      id: "bb-" + g.id, sport: "Baseball",
      source: "api-sports",
      sourceId: String(g.id),
      fixtureId: null,
      home: g.teams?.home?.name, away: g.teams?.away?.name,
      home_logo: g.teams?.home?.logo || null, away_logo: g.teams?.away?.logo || null,
      score_home: g.scores?.home?.total ?? g.scores?.home ?? null,
      score_away: g.scores?.away?.total ?? g.scores?.away ?? null,
      minute: g.status?.long || g.status?.short || null,
      status: "IN_PLAY",
      competition: (g.league?.name || "Baseball") + (g.country?.name ? " · " + g.country.name : ""),
      utcDate: g.date,
    })).filter(g => g.home && g.away);
    results.push(...items);
    console.log(`[live-matches] API-Sports baseball: ${items.length}`);
    }
    }
  } catch(e) { console.error("[live-matches] API-Sports baseball:", e.message); }

  // Tennis neutralise: l'ancien endpoint v1.tennis.api-sports.io ne resout plus
  // et polluait les logs live. A reactiver uniquement avec un endpoint valide.

  if (results.length === 0) return null;
  console.log(`[live-matches] API-Sports total: ${results.length} événements`);
  return results;
}

// TLM-NFL-SOURCE-GUARD-20260830
function isAmericanFootballMatch(match) {
  const raw = [
    match?.sport,
    match?.competition,
    typeof match?.league === "string" ? match.league : match?.league?.name,
    match?.country,
    match?.home,
    match?.away,
    match?.strSport,
    match?.strLeague,
    match?.strLeagueAlternate,
  ].filter(Boolean).join(" ").toLowerCase();
  return /\bamerican football\b|\bgridiron\b|\bnfl\b|\bnational football league\b|\bcanadian football\b|\bcfl\b/.test(raw);
}

function normalizeTheSportsDbLiveEvent(event, fallbackSport) {
  const rawSport = String(event?.strSport || fallbackSport || "").toLowerCase();
  if (isAmericanFootballMatch(event)) return null;
  const sport = rawSport.includes("basket") ? "Basketball"
    : rawSport.includes("hockey") ? "Hockey"
    : rawSport.includes("baseball") ? "Baseball"
    : (rawSport.includes("soccer") || rawSport.includes("football")) ? "Football"
    : null;
  if (!sport) return null;
  const home = event?.strHomeTeam || event?.strHome || event?.homeTeam || event?.home;
  const away = event?.strAwayTeam || event?.strAway || event?.awayTeam || event?.away;
  if (!home || !away) return null;
  const homeScore = event?.intHomeScore ?? event?.homeScore ?? event?.scoreHome ?? null;
  const awayScore = event?.intAwayScore ?? event?.awayScore ?? event?.scoreAway ?? null;
  const minute = event?.intTime || event?.strTime || event?.strProgress || event?.strStatus || "Live";
  const id = event?.idEvent || event?.idLiveScore || `${sport}-${home}-${away}`;
  return {
    id: "tsdb-" + String(id),
    source: "thesportsdb",
    sourceId: String(id),
    fixtureId: null,
    sport,
    home,
    away,
    home_logo: event?.strHomeTeamBadge || event?.strHomeBadge || null,
    away_logo: event?.strAwayTeamBadge || event?.strAwayBadge || null,
    score_home: homeScore === "" ? null : homeScore,
    score_away: awayScore === "" ? null : awayScore,
    minute,
    status: "IN_PLAY",
    competition: event?.strLeague || event?.strLeagueAlternate || sport,
    country: event?.strCountry || event?.strLeagueCountry || "",
    utcDate: event?.dateEvent || event?.strTimestamp || new Date().toISOString(),
  };
}

async function fetchFromTheSportsDb() {
  if (!THESPORTSDB_API_KEY) return null;
  const url = "https://www.thesportsdb.com/api/v2/json/livescore/all";
  const data = await httpGet(url, { "X-API-KEY": THESPORTSDB_API_KEY, "Content-Type": "application/json" });
  const raw = Array.isArray(data?.livescore) ? data.livescore
    : Array.isArray(data?.events) ? data.events
    : Array.isArray(data?.response) ? data.response
    : Array.isArray(data) ? data
    : [];
  // Baseball reintegre le 01/08/2026 (decision fondateur) en meme temps que
  // BASEBALL_LIVE_ENABLED plus haut dans ce fichier : resolveStalePredictions
  // sait desormais resoudre ses issues.
  const wanted = AUTO_CONCILE_MULTISPORT
    ? new Set(["Football", "Basketball", "Hockey", "Baseball"])
    : new Set(["Football"]);
  const results = raw
    .map((event) => normalizeTheSportsDbLiveEvent(event, event?.strSport))
    .filter((event) => event && wanted.has(event.sport))
    .filter(isPublicFootballScopeMatch);
  const counts = results.reduce((acc, event) => {
    acc[event.sport] = (acc[event.sport] || 0) + 1;
    return acc;
  }, {});
  for (const sport of wanted) console.log(`[live-matches] TheSportsDB ${sport}: ${counts[sport] || 0}`);
  if (results.length === 0) return null;
  console.log(`[live-matches] TheSportsDB total: ${results.length} événements`);
  return results;
}

// Deux sources nomment rarement une équipe pareil : « Dila » vs « Dila Gori »,
// « Vardar » vs « Vardar Skopje », « Thun » vs « FC Thun ». Une comparaison
// stricte laissait donc passer le même match deux fois dans la liste live (et
// risquait de le faire analyser deux fois par le Concile).
// Règle : égalité stricte, OU un nom contenu dans l'autre (« dila » ⊂ « dila
// gori »), OU même mot distinctif au sens de matchToken() (« fc thun » → « thun »).
function canonicalLiveTeamName20260901(name) {
  const normalized = normalizeMatchName(name)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  // Alias observes entre API-Sports et TheSportsDB. Cette liste est volontairement
  // explicite afin de ne jamais fusionner deux rencontres sur un simple score/minute.
  if (/^(?:tala ?ea |talaea )?el gaish$/.test(normalized) || normalized === "el geish") return "el geish";
  if (/^(?:zed|zed fc|fc masr|masr)$/.test(normalized)) return "zed";
  if (/^ghazl el (?:mehalla|mahalla)$/.test(normalized)) return "ghazl el mahalla";
  if (/^(?:enppi|enp pi|enppi club)$/.test(normalized)) return "enppi";
  return normalized;
}

function sameLiveTeamName(a, b) {
  const na = canonicalLiveTeamName20260901(a);
  const nb = canonicalLiveTeamName20260901(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Inclusion sur mot entier uniquement : évite que « inter » matche « winterthur ».
  const words = (s) => s.split(" ").filter(Boolean);
  const wa = words(na), wb = words(nb);
  const shorter = wa.length <= wb.length ? wa : wb;
  const longer = wa.length <= wb.length ? wb : wa;
  if (shorter.length && shorter.every((w) => longer.includes(w))) return true;
  const ta = matchToken(a), tb = matchToken(b);
  return !!ta && ta.length >= 3 && ta === tb;
}

// Mots distinctifs d'un nom d'équipe : au moins 4 lettres et hors préfixes
// génériques (fc, ac, united, city…). « Gimpo Citizen » → ["gimpo"].
function teamPlaceWords(name) {
  return NORM(name).replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((w) => w.length >= 4 && !GENERIC_CLUB_TOKENS.has(w));
}

// Distance de Levenshtein plafonnee avec sortie anticipee — utilisee pour
// rapprocher deux noms d'equipe orthographies differemment selon la source
// (ex: "Polissya" / "Polessya") sans faire exploser le cout sur des mots longs.
function levenshteinAtMost(a, b, maxDist) {
  if (Math.abs(a.length - b.length) > maxDist) return false;
  const m = a.length, n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    let rowMin = dp[0];
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
      if (dp[j] < rowMin) rowMin = dp[j];
    }
    if (rowMin > maxDist) return false;
  }
  return dp[n] <= maxDist;
}

function teamsSharePlaceWord(a, b) {
  const wa = teamPlaceWords(a);
  if (!wa.length) return false;
  const wb = teamPlaceWords(b);
  if (wa.some((w) => wb.includes(w))) return true;
  // Suffixe adjectival proche (ex. hongrois "-i" : "Zalaegerszegi" vs
  // "Zalaegerszeg") : tolerance de 2 caracteres sur des mots de 6+ lettres.
  // Sans ca, "Zalaegerszegi TE" (une source) et "Zalaegerszeg" (l'autre) ne se
  // reconnaissaient jamais comme le meme club — doublon constate par Greg le
  // 03/08/2026 (meme match, deux minutes differentes affichees).
  return wa.some((w) => w.length >= 6 && wb.some((w2) => w2.length >= 6 && levenshteinAtMost(w, w2, 2)));
}

// Deux relevés du même match doivent afficher un temps de jeu voisin. Sert de
// garde-fou : sans lui, un côté identique suffirait à confondre deux rencontres.
function liveMinutesAreClose(a, b, tolerance = 15) {
  const ma = parseLiveMinuteValue(a && a.minute);
  const mb = parseLiveMinuteValue(b && b.minute);
  if (ma === null || mb === null) return true; // sport sans minute exploitable
  return Math.abs(ma - mb) <= tolerance;
}

function sameLiveTeams(a, b) {
  // Ne jamais fusionner deux sports différents, même si les noms se ressemblent.
  const sportA = String(a?.sport || "Football");
  const sportB = String(b?.sport || "Football");
  if (sportA !== sportB) return false;
  const homeOk = sameLiveTeamName(a?.home, b?.home);
  const awayOk = sameLiveTeamName(a?.away, b?.away);
  if (homeOk && awayOk) return true;

  // Reconnaissance assouplie. Les deux sources nomment souvent la même équipe
  // très différemment : « Chungnam Asan » / « Asan Mugunghwa », « Gimpo FC » /
  // « Gimpo Citizen », « Ulsan HD » / « Ulsan Hyundai FC ». Un seul côté échoue,
  // et le match n'est plus reconnu comme identique : on conserve alors deux
  // entrées, dont celle de TheSportsDB qui ne permet AUCUNE cote — donc aucune
  // diffusion possible. Constaté le 29/07/2026 sur la FA Cup coréenne : les 5
  // matchs présents dans les deux sources étaient tous concernés.
  //
  // Trois conditions cumulées, jamais une seule : un côté strictement reconnu,
  // l'autre partageant un mot distinctif (ville/région, 4 lettres minimum), et
  // un temps de jeu cohérent. Associer deux rencontres différentes donnerait une
  // cote appartenant à un autre match — d'où la prudence.
  if (homeOk === awayOk) return false; // aucun côté sûr, ou déjà traité au-dessus
  const autreCote = homeOk
    ? teamsSharePlaceWord(a?.away, b?.away)
    : teamsSharePlaceWord(a?.home, b?.home);
  return autreCote && liveMinutesAreClose(a, b);
}

function hasKnownScore(match) {
  return match?.score_home !== null && match?.score_home !== undefined
    && match?.score_away !== null && match?.score_away !== undefined;
}

function parseLiveMinuteValue(minute) {
  if (minute === null || minute === undefined) return null;
  const raw = String(minute).trim();
  // Accepte uniquement une minute entière réelle. Les statuts et arrêts de jeu sont exclus.
  const matched = raw.match(/^(\d{1,3})(?:['’′])?$/);
  if (!matched) return null;
  const parsed = Number(matched[1]);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 120 ? parsed : null;
}

// Codes de statut bruts (API-Sports / TheSportsDB) qui ne sont PAS du live
// exploitable : match pas commencé (NS), reporté, annulé, interrompu, terminé.
// Ces deux sources écrasent le champ "status" à "IN_PLAY" en dur (voir
// normalizeTheSportsDbLiveEvent et fetchFromApiSports), donc le vrai état n'est
// lisible que dans "minute" (ex: minute="NS"). Sans ce filtre, des matchs non
// commencés s'affichaient en "En direct" sans temps de jeu ni cote exploitable.
const NON_LIVE_RAW_STATUSES = new Set([
  "NS", "TBD", "PST", "POSTP", "CANC", "ABD", "AWD", "WO", "SUSP", "INTR",
  "FT", "AOT", "AP", "AET", "PEN", "ENDED", "FINISHED", "CANCELLED", "POSTPONED",
  "NOT STARTED", "NOTSTARTED",
]);

function isFinishedOrTooLateForLiveIa(match) {
  const status = String(match?.status || "").toUpperCase();
  if (["CANCELLED", "POSTPONED"].includes(status)) return true;
  if (["SCHEDULED", "TIMED"].includes(status)) return false;
  if (["FINISHED", "FT", "AET", "PEN", "ENDED"].includes(status)) return true;

  // Statut réel porté par "minute" quand la source a écrasé "status" à IN_PLAY.
  const rawMinute = String(match?.minute ?? "").trim().toUpperCase();
  if (rawMinute && NON_LIVE_RAW_STATUSES.has(rawMinute)) return true;

  const minute = parseLiveMinuteValue(match?.minute);
  return match?.sport === "Football" && minute !== null && minute >= 85;
}

// HOTFIX LIVE 2026-08-29: API-Sports source de verite.
// Le match doit rester visible a 90+; seule l analyse IA s arrete a sa limite.
function isFinishedOrUnavailableForLiveDisplay(match) {
  const status = String(match?.status || "").toUpperCase();
  if (["CANCELLED", "POSTPONED"].includes(status)) return true;
  if (["SCHEDULED", "TIMED"].includes(status)) return false;
  if (["FINISHED", "FT", "AET", "PEN", "ENDED"].includes(status)) return true;
  const rawMinute = String(match?.minute ?? "").trim().toUpperCase();
  return !!(rawMinute && NON_LIVE_RAW_STATUSES.has(rawMinute));
}

function scoresDiffer(a, b) {
  if (!hasKnownScore(a) || !hasKnownScore(b)) return false;
  return Number(a.score_home) !== Number(b.score_home) || Number(a.score_away) !== Number(b.score_away);
}

// Un score au foot ne peut que monter, jamais descendre pendant un match. Si
// l'un des deux scores domine l'autre terme a terme (chaque equipe a un total
// >= a celui de l'autre source), ce n'est pas une vraie contradiction — c'est
// une source simplement en retard sur un but recent (ex: 0-1 vs 1-2, les deux
// equipes ont progresse). On retient alors le score le plus a jour au lieu de
// bloquer l'analyse pour rien. Seul un vrai conflit — une equipe qui "redescend"
// d'une source a l'autre, impossible en vrai — reste bloque : ca signale un
// match mal identifie ou une donnee corrompue, jamais un simple retard.
// Demande du fondateur le 04/08/2026.
function dominantScore(a, b) {
  const ah = Number(a.score_home), aa = Number(a.score_away);
  const bh = Number(b.score_home), ba = Number(b.score_away);
  if (ah >= bh && aa >= ba) return a;
  if (bh >= ah && ba >= aa) return b;
  return null;
}

// Seule une entrée API-Sports porte un identifiant exploitable par l'endpoint
// /odds. TheSportsDB ne fournit aucune cote.
function carriesOddsIdentity(m) {
  return !!(m && m.source === "api-sports" && (m.fixtureId || m.sourceId));
}

// Quand le même match arrive des deux sources, on conserve l'identité capable de
// ramener une vraie cote et on ne reprend de l'autre source que les données de
// jeu (score, minute, statut).
function mergeKeepingOddsIdentity(previous, incoming) {
  // fdSourceId : conserve l'identite Football-Data.org meme quand
  // l'identite API-Sports gagne le merge, pour permettre a fetchH2H() de
  // relayer sur Football-Data.org quand API-Sports est indisponible pour ce
  // match (quota epuise). Sans ca, l'ID Football-Data etait perdu des qu'un
  // match etait connu des deux fournisseurs. Ajoute le 02/08/2026.
  const fdSourceId = previous.source === "football-data" ? previous.sourceId
    : incoming.source === "football-data" ? incoming.sourceId
      : previous.fdSourceId || incoming.fdSourceId;
  const previousIsApiSports = carriesOddsIdentity(previous);
  const incomingIsApiSports = carriesOddsIdentity(incoming);

  // API-Sports payant est prioritaire pour score/minute/statut. Une source
  // secondaire peut seulement completer un champ manquant, jamais le faire regresser.
  if (previousIsApiSports && !incomingIsApiSports) {
    return {
      ...previous,
      ...(fdSourceId ? { fdSourceId } : {}),
      score_home: previous.score_home ?? incoming.score_home,
      score_away: previous.score_away ?? incoming.score_away,
      minute: previous.minute ?? incoming.minute,
      status: previous.status ?? incoming.status,
    };
  }
  if (incomingIsApiSports) {
    return {
      ...incoming,
      ...(fdSourceId ? { fdSourceId } : {}),
      score_home: incoming.score_home ?? previous.score_home,
      score_away: incoming.score_away ?? previous.score_away,
      minute: incoming.minute ?? previous.minute,
      status: incoming.status ?? previous.status,
    };
  }
  return fdSourceId ? { ...incoming, fdSourceId } : incoming;
}

function mergeLiveMatchSources(footballDataMatches = [], apiSportsMatches = []) {
  const merged = [...footballDataMatches];
  for (const apiMatch of apiSportsMatches) {
    const existingIndex = merged.findIndex((m) => sameLiveTeams(m, apiMatch) && m.status !== "FINISHED");
    // Doublon sur un sport non-Football : on garde l'entrée déjà présente au lieu
    // de l'ajouter une seconde fois (l'arbitrage de score ci-dessous ne concerne
    // que le football, où deux APIs fournissent le score).
    if (existingIndex >= 0 && apiMatch.sport !== "Football") continue;
    if (existingIndex >= 0 && apiMatch.sport === "Football") {
      const previous = merged[existingIndex];
      // Si API-Sports connait le match, ses donnees live sont l autorite.
      // Football-Data/TheSportsDB restent des secours et ne peuvent plus ecraser
      // un score ou une minute API-Sports avec une valeur plus ancienne.
      const apiSportsTruth = carriesOddsIdentity(previous)
        ? previous
        : (carriesOddsIdentity(apiMatch) ? apiMatch : null);
      if (apiSportsTruth) {
        const secondary = apiSportsTruth === previous ? apiMatch : previous;
        merged[existingIndex] = {
          ...mergeKeepingOddsIdentity(previous, apiMatch),
          score_home: apiSportsTruth.score_home ?? secondary.score_home,
          score_away: apiSportsTruth.score_away ?? secondary.score_away,
          minute: apiSportsTruth.minute ?? secondary.minute,
          status: apiSportsTruth.status ?? secondary.status,
          scoreConflict: false,
          scoreConflictSources: null,
        };
        continue;
      }
      // Cette affectation écrasait auparavant l'entrée API-Sports par celle de
      // TheSportsDB (passée en 2e argument par fetchLiveMatches). Le fixtureId
      // disparaissait, fetchRealOdds() sortait sur `source !== "api-sports"`,
      // la cote retombait sur "estimation", donc realOdd = 0, donc oddOk = false,
      // donc diffusable = false : AUCUN signal ne pouvait plus partir, quels que
      // soient le vote et la confiance. Constaté le 29/07/2026 — 305 analyses sur
      // 481 en 7 jours portaient une identité tsdb- structurellement incotable.
      const scoreWinner = scoresDiffer(previous, apiMatch) ? dominantScore(previous, apiMatch) : null;
      merged[existingIndex] = !scoresDiffer(previous, apiMatch)
        ? mergeKeepingOddsIdentity(previous, apiMatch)
        : scoreWinner
          ? {
              // Un score domine l'autre (retard, pas contradiction) : on garde
              // l'identite qui porte la cote, avec le score le plus a jour.
              ...(carriesOddsIdentity(previous) && !carriesOddsIdentity(apiMatch) ? previous : apiMatch),
              score_home: scoreWinner.score_home, score_away: scoreWinner.score_away,
            }
          : {
              // Vrai conflit (une equipe "redescend" d'une source a l'autre) :
              // l'analyse est bloquée de toute façon, on ne mélange pas les
              // deux jeux de données.
              ...(carriesOddsIdentity(previous) && !carriesOddsIdentity(apiMatch) ? previous : apiMatch),
              scoreConflict: true,
              scoreConflictSources: {
                footballData: `${previous.score_home}-${previous.score_away}`,
                apiSports: `${apiMatch.score_home}-${apiMatch.score_away}`,
              },
            };
    } else {
      merged.push(apiMatch);
    }
  }
  return merged;
}

function rejectScoreConflict(match, res) {
  if (!match?.scoreConflict) return false;
  const sources = match.scoreConflictSources || {};
  // Message clarifie le 04/08/2026 : le blocage n'est pas un bug, c'est le
  // garde-fou R2 (jamais de prono sur un score non confirme) qui se declenche
  // pendant que nos fournisseurs (football-data.org + API-Sports) rattrapent
  // un but que Flashscore, sur flux payant instantane, affiche deja. Sans
  // cette explication le message ressemblait a une panne plutot qu'a une
  // protection qui fait son travail.
  res.json({
    ok: false,
    error: `Nos deux sources de scores ne sont pas encore d'accord (${sources.footballData || "?"} vs ${sources.apiSports || "?"}) — probablement un but tres recent pas encore remonte partout. Analyse bloquee pour ne jamais te proposer un pari sur un score faux. Reessaie dans 1 a 2 minutes.`,
    scoreConflict: true,
  });
  return true;
}

function hasNonFootballLiveMatches(matches) {
  return Array.isArray(matches) && matches.some((match) => {
    const sport = String(match?.sport || "").trim();
    return sport && sport !== "Football";
  });
}

async function enrichFootballOnlyLiveCache(cacheData) {
  if (!Array.isArray(cacheData) || hasNonFootballLiveMatches(cacheData)) return cacheData;
  try {
    const theSportsDbMatches = await fetchFromTheSportsDb();
    if (!Array.isArray(theSportsDbMatches) || !theSportsDbMatches.length) return cacheData;
    const enrichedMatches = mergeLiveMatchSources(cacheData, theSportsDbMatches)
      .filter(isPublicFootballScopeMatch)
      .filter(m => !isFinishedOrUnavailableForLiveDisplay(m));
    // Ne jamais repousser ici le prochain refresh API-Sports : le timestamp reste celui du fetch primaire.
    liveMatchesCache = { ...liveMatchesCache, data: enrichedMatches };
    console.log(`[live-matches] Cache enrichi TheSportsDB: ${enrichedMatches.length} événements`);
    return enrichedMatches;
  } catch (e) {
    console.error("[live-matches] Enrichissement cache TheSportsDB:", e.message);
    return cacheData;
  }
}

async function fetchLiveMatches() {
  if (liveMatchesCache.data && Date.now() - liveMatchesCache.ts < CACHE_TTL) {
    const cachedNoNfl = liveMatchesCache.data.filter((match) => !isAmericanFootballMatch(match));
    const cachedInScope = cachedNoNfl.filter(isPublicFootballScopeMatch);
    if (cachedInScope.length !== liveMatchesCache.data.length) liveMatchesCache = { data: cachedInScope, ts: liveMatchesCache.ts };
    return await enrichFootballOnlyLiveCache(cachedInScope);
  }
  const [footballDataMatches, apiSportsMatches, theSportsDbMatches] = await Promise.all([
    fetchFromFootballData(),
    fetchFromApiSports(),
    fetchFromTheSportsDb(),
  ]);
  // If both failed, do not keep stale live matches on screen.
  if (footballDataMatches === null && apiSportsMatches === null && theSportsDbMatches === null) return resolveLiveMatchesAfterFetchFailure(liveMatchesCache);
  const matches = mergeLiveMatchSources(
    mergeLiveMatchSources(footballDataMatches || [], apiSportsMatches || []),
    theSportsDbMatches || []
  ).filter((match) => !isAmericanFootballMatch(match));

  // Auto-résoudre les prédictions des matchs terminés
  matches.filter(m => m.status === "FINISHED").forEach(m => autoResolvePredictions(m));

  const productMatches = matches.filter(isPublicFootballScopeMatch);
  const visibleMatches = productMatches.filter(m => !isFinishedOrUnavailableForLiveDisplay(m));
  liveMatchesCache = { data: visibleMatches, ts: Date.now() };
  return visibleMatches;
}

function getMockMatches() {
  // Demo matches when API unavailable
  const base = Date.now();
  return [
    { id: "demo1", home: "Maroc", away: "Écosse", score_home: 1, score_away: 0, minute: 55, status: "IN_PLAY", competition: "Coupe du Monde 2026", utcDate: new Date(base).toISOString() },
    { id: "demo2", home: "Real Madrid", away: "Barcelona", score_home: 2, score_away: 1, minute: 67, status: "IN_PLAY", competition: "La Liga", utcDate: new Date(base).toISOString() },
    { id: "demo3", home: "Manchester City", away: "Arsenal", score_home: 0, score_away: 0, minute: 12, status: "IN_PLAY", competition: "Premier League", utcDate: new Date(base).toISOString() },
    { id: "demo4", home: "Bayern Munich", away: "Dortmund", score_home: 3, score_away: 1, minute: 78, status: "IN_PLAY", competition: "Bundesliga", utcDate: new Date(base).toISOString() },
  ];
}

// ── Statistiques live par match (api-sports.io) ───────────────────────────────
function resolveLiveMatchesAfterFetchFailure() {
  return [];
}

// Lettres latines "spéciales" qui ne sont PAS des accents décomposables en
// Unicode NFD (contrairement à é/à/ü) : ø, æ, ß... restent identiques après
// normalize("NFD"), donc "Bodø" et "Bodo" ne matchent jamais entre une source
// qui garde l'unicode complet et une autre qui translittère. Constaté le
// 31/07/2026 : "Bodø/Glimt" (TheSportsDB) affiché en double à côté de
// "Bodo/Glimt" (api-sports) sur la page Live IA, même score, même minute.
const SPECIAL_LATIN_MAP = { "ø": "o", "æ": "ae", "œ": "oe", "ð": "d", "þ": "th", "ł": "l", "đ": "d", "ß": "ss", "ı": "i" };
function stripSpecialLatin(s) {
  return String(s || "").replace(/[øæœðþłđßı]/gi, (c) => SPECIAL_LATIN_MAP[c.toLowerCase()] || c);
}

function normalizeMatchName(value) {
  return stripSpecialLatin(String(value || "").trim().toLowerCase())
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\bman(chester)?\b/g, "man")
    .replace(/\b(united|utd)\b/g, "utd")
    // TLM_LIVE_DEDUP_WOLVES_20260901 — deux fournisseurs nomment le meme club
    // "Wolverhampton Wanderers" et "Wolves". Sans cet alias, le meme match
    // est analyse deux fois et peut declencher le coupe-circuit de sursaut.
    .replace(/\bwolverhampton(?:\s+wanderers)?\b|\bwolves\b/g, "wolves")
    .replace(/\bcity\b/g, "city")
    .replace(/\bparis\s*(saint|st)[\s-]*germain\b/g, "psg")
    .replace(/\bp\.?\s*s\.?\s*g\.?\b/g, "psg")
    .replace(/\bbayern\s*munich\b/g, "bayern")
    .replace(/\binter\s*milan\b/g, "inter")
    .replace(/\bac\s*milan\b/g, "milan")
    .replace(/\breal\s*madrid\b/g, "real madrid")
    .replace(/\batletic[o]?\b/g, "atletico")
    .replace(/\s+/g, " ").trim();
}

function resolveVerifiedLiveMatch(input, liveMatches) {
  const matches = Array.isArray(liveMatches) ? liveMatches : [];
  const inputId = input?.id || input?.match_id || input?.sourceMatchId || input?.sourceId || input?.fixtureId;
  if (inputId) {
    const wanted = String(inputId);
    const byId = matches.find((m) => [m.id, m.sourceMatchId, m.sourceId, m.fixtureId].filter(Boolean).map(String).includes(wanted));
    if (byId) return byId;
  }

  const home = normalizeMatchName(input?.home);
  const away = normalizeMatchName(input?.away);
  if (!home || !away) return null;

  return matches.find((m) => normalizeMatchName(m.home) === home && normalizeMatchName(m.away) === away) || null;
}

async function requireVerifiedLiveMatch(input) {
  const matches = await fetchLiveMatches();
  return resolveVerifiedLiveMatch(input, matches);
}

const matchStatsCache = new Map();

async function fetchMatchStats(fixtureId) {
  if (!API_SPORTS_KEY || !fixtureId) return null;
  const id = String(fixtureId);
  // Seulement pour les fixtures football (pas bk-, hk-, etc.)
  if (id.startsWith("bk-") || id.startsWith("hk-") || id.startsWith("demo")) return null;

  const ck = `stats_${id}`;
  const cached = matchStatsCache.get(ck);
  if (cached && Date.now() - cached.ts < 60000) return cached.data;

  try {
    const data = await httpGet(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${id}`,
      { "x-apisports-key": API_SPORTS_KEY }
    );
    const stats = parseMatchStats(data);
    matchStatsCache.set(ck, { data: stats, ts: Date.now() });
    return stats;
  } catch (e) {
    console.error("[match-stats] Erreur:", e.message);
    return null;
  }
}

async function fetchMatchStatsForMatch(match) {
  const fixtureId = getVerifiedFixtureId(match);
  if (!API_SPORTS_KEY) return buildStatsStatus(match, null, "api_sports_key_missing");
  if (!fixtureId) return buildStatsStatus(match, null, "missing_api_sports_fixture");
  if (!apiSportsBudgetOk()) return buildStatsStatus(match, null, "api_sports_budget_horaire_atteint");

  const stats = await fetchMatchStats(fixtureId);
  if (!stats) return buildStatsStatus({ ...match, fixtureId }, null, "api_sports_stats_unavailable");
  return buildStatsStatus({ ...match, fixtureId }, stats, null);
}

// ── H2H (confrontations directes) — donnée factuelle pour ancrer l'analyse ────
const h2hCache = new Map();

// Relais Football-Data.org (02/08/2026) : quand API-Sports est indisponible
// (quota epuise) ou que ce n'est pas la source du match, on tente le H2H via
// l'abonnement Football-Data.org deja paye et sous-utilise. Safe : utilise
// l'ID de match PROPRE a Football-Data (match.fdSourceId / sourceId), jamais
// de recherche par nom d'equipe entre fournisseurs differents (source de
// mauvais matching evitee). Meme forme de retour que la version API-Sports
// pour que le reste du pipeline (candidats, buildH2HBlock) n'ait rien a
// changer.
async function fetchH2HFromFootballData(match) {
  const fdId = match.source === "football-data" ? match.sourceId : match.fdSourceId;
  if (!FOOTBALL_DATA_KEY || !fdId) return null;
  const ck = `h2h_fd_${fdId}`;
  const cached = h2hCache.get(ck);
  if (cached && Date.now() - cached.ts < 6 * 3600 * 1000) return cached.data;
  try {
    const data = await httpGet(
      `https://api.football-data.org/v4/matches/${fdId}/head2head?limit=10`,
      { "X-Auth-Token": FOOTBALL_DATA_KEY }
    );
    const list = Array.isArray(data?.matches) ? data.matches : null;
    if (!list) {
      // Forme de reponse differente de ce qui est attendu : on log la
      // reponse brute (tronquee) pour corriger vite plutot que d'inventer
      // des chiffres a partir d'un champ qui n'existe pas.
      console.error("[h2h-fd] forme de reponse inattendue:", JSON.stringify(data).slice(0, 300));
      return null;
    }
    const rows = list.filter(r =>
      r?.score?.fullTime?.home != null && r?.score?.fullTime?.away != null && r?.status === "FINISHED"
    );
    if (rows.length < 2) {
      h2hCache.set(ck, { data: null, ts: Date.now() });
      return null;
    }
    const homeName = NORM(match.home);
    let totalGoals = 0, under25 = 0, btts = 0, homeWins = 0, awayWins = 0, draws = 0, htGoal = 0;
    for (const r of rows) {
      const gh = r.score.fullTime.home, ga = r.score.fullTime.away;
      const tot = gh + ga;
      totalGoals += tot;
      if (tot <= 2) under25++;
      if (gh > 0 && ga > 0) btts++;
      const htH = r.score?.halfTime?.home, htA = r.score?.halfTime?.away;
      if (htH != null && htA != null && (htH + htA) > 0) htGoal++;
      const rowHomeIsCurrentHome = NORM(r.homeTeam?.name || "") === homeName;
      const curHomeGoals = rowHomeIsCurrentHome ? gh : ga;
      const curAwayGoals = rowHomeIsCurrentHome ? ga : gh;
      if (curHomeGoals > curAwayGoals) homeWins++;
      else if (curHomeGoals < curAwayGoals) awayWins++;
      else draws++;
    }
    const n = rows.length;
    const h2h = {
      n,
      avgGoals: Math.round((totalGoals / n) * 100) / 100,
      htGoalPct: Math.round((htGoal / n) * 100),
      under25Pct: Math.round((under25 / n) * 100),
      bttsPct: Math.round((btts / n) * 100),
      homeWins, awayWins, draws,
    };
    h2hCache.set(ck, { data: h2h, ts: Date.now() });
    console.log(`[h2h-fd] Relais Football-Data reussi ${match.home} vs ${match.away}: ${n} matchs`);
    return h2h;
  } catch (e) {
    console.error("[h2h-fd] Erreur:", e.message);
    return null;
  }
}

async function fetchH2H(match) {
  if (match.sport !== "Football") return null;

  if (API_SPORTS_KEY && match.source === "api-sports" && match.homeId && match.awayId) {
    const homeId = match.homeId, awayId = match.awayId;
    const ck = `h2h_${homeId}_${awayId}`;
    const cached = h2hCache.get(ck);
    if (cached && Date.now() - cached.ts < 6 * 3600 * 1000) return cached.data;

    // Budget verifie APRES le cache : une paire deja connue (cache 6h) ne
    // consomme aucun quota reseau, inutile de la bloquer.
    if (apiSportsBudgetOk()) {
      try {
        const data = await httpGet(
          `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${homeId}-${awayId}&last=10`,
          { "x-apisports-key": API_SPORTS_KEY }
        );
        const rows = (data?.response || []).filter(r =>
          r?.goals?.home != null && r?.goals?.away != null &&
          ["FT", "AET", "PEN"].includes(r?.fixture?.status?.short)
        );
        if (rows.length < 2) {
          h2hCache.set(ck, { data: null, ts: Date.now() });
          return null;
        }
        let totalGoals = 0, under25 = 0, btts = 0, homeWins = 0, awayWins = 0, draws = 0, htGoal = 0;
        for (const r of rows) {
          const gh = r.goals.home, ga = r.goals.away;
          const tot = gh + ga;
          totalGoals += tot;
          if (tot <= 2) under25++;
          if (gh > 0 && ga > 0) btts++;
          const htH = r.score?.halftime?.home, htA = r.score?.halftime?.away;
          if (htH != null && htA != null && (htH + htA) > 0) htGoal++;
          // Ramener au point de vue de l'équipe "home" actuelle (via id)
          const curHomeIsRowHome = r.teams?.home?.id === homeId;
          const curHomeGoals = curHomeIsRowHome ? gh : ga;
          const curAwayGoals = curHomeIsRowHome ? ga : gh;
          if (curHomeGoals > curAwayGoals) homeWins++;
          else if (curHomeGoals < curAwayGoals) awayWins++;
          else draws++;
        }
        const n = rows.length;
        const h2h = {
          n,
          avgGoals: Math.round((totalGoals / n) * 100) / 100,
          htGoalPct: Math.round((htGoal / n) * 100),
          under25Pct: Math.round((under25 / n) * 100),
          bttsPct: Math.round((btts / n) * 100),
          homeWins, awayWins, draws,
        };
        h2hCache.set(ck, { data: h2h, ts: Date.now() });
        return h2h;
      } catch (e) {
        console.error("[h2h] Erreur:", e.message);
        // On tente quand meme le relais Football-Data ci-dessous plutot que
        // d'abandonner sur une simple erreur reseau ponctuelle.
      }
    }
  }

  // Repli : API-Sports indisponible pour ce match (quota, pas la source, ou
  // erreur reseau) — tente Football-Data.org si ce match y est aussi connu.
  return fetchH2HFromFootballData(match);
}

// Enregistre un pick pré-match dans concile_analyses (source_type='prematch')
// s'il n'y est pas déjà, pour qu'il entre dans le pipeline de résolution
// automatique (resolveStalePredictions) au même titre qu'un signal live —
// c'est ce qui permet de comparer plus tard un vrai winrate pré-match vs
// live. Idempotent : computeUpcomingPicks tourne toutes les 30 min sur la
// même fenêtre de 36h, sans ce garde-fou le même match serait ré-inséré à
// chaque recalcul.
function savePrematchPickIfNew(pick) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const matchKey = `prematch_${canonicalMatchKey(pick.home, pick.away)}_${todayStr}`;
    const existing = db.prepare("SELECT id FROM concile_analyses WHERE match_key = ?").get(matchKey);
    if (existing) return;
    db.prepare(`
      INSERT INTO concile_analyses
        (match_key, home, away, competition, sport, best_bet, confidence,
         raison, consensus_votes, source_type, home_logo, away_logo,
         diffusion_block)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      matchKey, pick.home, pick.away, pick.competition, pick.sport,
      pick.bet, pick.confidence, "Pick pré-match (H2H)", 0, "prematch",
      pick.home_logo || null, pick.away_logo || null,
      "prematch interne: non diffuse aux clients"
    );
  } catch (e) { console.error("[upcoming-picks] savePrematchPickIfNew:", e.message); }
}

// ── Matchs à venir (pré-match) — demande de Greg le 31/07/2026 ───────────────
// Contrairement au reste du Concile (analyse EN DIRECT, cote ARJEL réelle),
// ces picks portent sur des matchs qui n'ont pas encore commencé : meilleures
// cotes, mais aucune donnée live. On s'appuie donc uniquement sur le H2H réel
// (fetchH2H, déjà utilisé pour enrichir les analyses live) — pas de nouvel
// appel IA payant, juste des statistiques de confrontations directes.
let _upcomingPicksCache = { ts: 0, data: [], featuredMatch: null, stats: null };
let _upcomingPicksRefreshPromise = null;

function refreshUpcomingPicksInBackground() {
  if (_upcomingPicksRefreshPromise) return _upcomingPicksRefreshPromise;
  _upcomingPicksRefreshPromise = computeUpcomingPicks()
    .catch(error => {
      console.error("[upcoming-picks] refresh arriere-plan:", error.message);
      return _upcomingPicksCache;
    })
    .finally(() => { _upcomingPicksRefreshPromise = null; });
  return _upcomingPicksRefreshPromise;
}

async function computeUpcomingPicks() {
  if (Date.now() - _upcomingPicksCache.ts < 30 * 60000) return _upcomingPicksCache;
  if (!API_SPORTS_KEY) return _upcomingPicksCache;
  const picks = [];
  const featuredCandidates = [];
  const trustedFixtures = [];
  // Compteurs exposes au client pour expliquer honnetement un tab vide —
  // demande de Greg le 01/08/2026 : montrer le travail reel (X matchs
  // regardes, Y avec assez d'historique, Z retenus) plutot qu'un message
  // generique "aucun match".
  const stats = { totalFixtures: 0, trustedChecked: 0, h2hEligible: 0, qualified: 0 };
  try {
    // Sur une seule journee, la plupart des matchs "NS" tombent hors d'une
    // fenetre de 12h selon l'heure a laquelle on regarde (constate le
    // 01/08/2026 : 12 matchs NS le jour meme, 0 dans les 12h). On regarde
    // aujourd'hui ET demain, avec une fenetre de 36h, pour avoir un vrai
    // volume de candidats quelle que soit l'heure de consultation.
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
    const [dataToday, dataTomorrow] = await Promise.all([
      httpGet(`https://v3.football.api-sports.io/fixtures?date=${today}&status=NS`, { "x-apisports-key": API_SPORTS_KEY }),
      httpGet(`https://v3.football.api-sports.io/fixtures?date=${tomorrow}&status=NS`, { "x-apisports-key": API_SPORTS_KEY }),
    ]);
    const allFixtures = [...(dataToday.response || []), ...(dataTomorrow.response || [])];
    const fixtures = allFixtures.filter(f => {
      const kickoff = new Date(f.fixture.date).getTime();
      const hoursAway = (kickoff - Date.now()) / 3600000;
      return hoursAway > 0 && hoursAway <= 36;
    });
    // Tri par coup d'envoi le plus proche AVANT de couper a 60 : sans ca, un
    // match a 19h pouvait ne jamais etre examine simplement parce qu'il
    // arrivait en position 57+ dans l'ordre brut renvoye par l'API (aucun
    // rapport avec sa qualite) - constate par Greg le 03/08/2026 sur un pick
    // BTTS 100% (Cracovia-Pogon, Ekstraklasa) disparu pour cette seule raison.
    fixtures.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    stats.totalFixtures = fixtures.length;
    // Anti-doublon : l'API renvoie parfois la meme rencontre deux fois (diffusee
    // dans deux competitions/flux distincts, ou chevauchement des deux requetes
    // aujourd'hui/demain) — constate par Greg le 03/08/2026, un match apparaissait
    // deux fois dans "Matchs a venir". On ne garde que la premiere occurrence par
    // ID de fixture ET par paire d'equipes (au cas ou l'ID different mais memes
    // equipes/horaire, ex. rediffusion sous deux fixtureId distincts).
    const seenFixtureIds = new Set();
    const seenPairs = new Set();
    // Parcourir toute la fenetre avant de limiter les appels H2H. Couper les
    // 60 premieres rencontres brutes favorisait les reserves/coupes mineures
    // jouees plus tot et pouvait laisser trustedChecked a zero alors que des
    // affiches UEFA ou Liga etaient bien presentes plus tard dans la journee.
    for (const f of fixtures) {
      if (seenFixtureIds.has(f.fixture.id)) continue;
      seenFixtureIds.add(f.fixture.id);
      const pairKey = `${f.teams.home?.name || ""}_${f.teams.away?.name || ""}_${String(f.fixture.date || "").slice(0, 13)}`.toLowerCase();
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      // country DOIT figurer ici. Sur ce pipeline pre-match, f.league.name vaut
      // le nom seul ("Pro League A"), contrairement au flux direct qui concatene
      // "Nom · Pays". Sans le pays, la blacklist — qui raisonne largement par
      // pays — ne pouvait rien bloquer : c'est ainsi que "Olimpik-Mobiuz vs
      // Jayxun · Pro League A · Uzbekistan" s'est retrouve en "Notre selection"
      // dans les matchs a venir, malgre "uzbekistan" present dans la liste
      // (signale trois fois par Greg les 04 et 05/08/2026).
      const compObj = {
        competition: f.league?.name || "",
        league: f.league?.name || "",
        country: f.league?.country || "",
        sport: "Football",
        home: f.teams.home?.name || "",
        away: f.teams.away?.name || "",
      };
      if (!isPublicFootballScopeMatch(compObj)) continue;
      if (isCategoryBanned(compObj) || (!isUefaCompetition(compObj) && isLowTrustCompetition(compObj))) continue;
      // isWomenMatch() manquait sur ce pipeline pre-match (H2H) — seul le direct
      // (shouldAutoObserveMatch) l'appliquait. Une Liga MX Femenil a ete analysee
      // et diffusee via ce chemin, constate le 02/08/2026 (Cruz Azul W - Atlas W).
      if (isWomenMatch(compObj)) continue;
      // Le plafond porte sur les appels H2H couteux, pas sur le balayage local
      // des rencontres. Une fois 60 ligues fiables trouvees, aucun appel
      // supplementaire n'est effectue.
      if (stats.trustedChecked >= 60) continue;
      stats.trustedChecked++;
      const observedBase = {
        home: f.teams.home.name, away: f.teams.away.name,
        competition: f.league.name + (f.league.country && f.league.country !== "World" ? " · " + f.league.country : ""),
        country: f.league.country || "", sport: "Football", kickoff: f.fixture.date,
        confidence: null, status: "watchlist",
        reason: "Analyse statistique en préparation — aucun signal validé pour l'instant.",
        home_logo: f.teams.home.logo || null, away_logo: f.teams.away.logo || null,
      };
      trustedFixtures.push(observedBase);
      const h2h = await fetchH2H({ source: "api-sports", sport: "Football", homeId: f.teams.home.id, awayId: f.teams.away.id });
      // n>=5 confrontations directes exactes entre les deux memes equipes est
      // trop rare (beaucoup de paires ne se sont jamais croisees 5 fois),
      // d'ou une section quasi-toujours vide (signale par Greg le 01/08/2026).
      // n>=3 reste un echantillon reel, juste moins exigeant sur la rarete.
      if (!h2h || h2h.n < 3) continue;
      stats.h2hEligible++;
      const allCandidates = [
        { bet: "Victoire domicile", confidence: Math.round((h2h.homeWins / h2h.n) * 100) },
        { bet: "Victoire extérieur", confidence: Math.round((h2h.awayWins / h2h.n) * 100) },
        { bet: "BTTS Oui", confidence: h2h.bttsPct },
        { bet: "But en 1ère mi-temps", confidence: h2h.htGoalPct },
      ].sort((a, b) => b.confidence - a.confidence);
      const bestObservedConfidence = Number(allCandidates[0]?.confidence || 0);
      featuredCandidates.push({
        ...observedBase,
        confidence: bestObservedConfidence,
        reason: `Score provisoire ${bestObservedConfidence}/100, sous le seuil public de ${getPublishedMinConfidence()}/100.`,
      });
      const candidates = allCandidates.filter(c => c.confidence >= getPublishedMinConfidence());
      if (!candidates.length) continue;
      stats.qualified++;
      const pick = {
        home: f.teams.home.name, away: f.teams.away.name,
        competition: f.league.name + (f.league.country && f.league.country !== "World" ? " · " + f.league.country : ""),
        sport: "Football", kickoff: f.fixture.date,
        bet: candidates[0].bet, confidence: candidates[0].confidence,
        home_logo: f.teams.home.logo || null, away_logo: f.teams.away.logo || null,
        _fixtureId: f.fixture.id,
      };
      picks.push(pick);
      savePrematchPickIfNew(pick);
    }
  } catch (e) { console.error("[upcoming-picks]", e.message); }
  // Tri chronologique (pas par confiance) : Greg veut que quelqu'un qui ne
  // se connecte qu'une fois dans la journée voie tout le programme qualifié
  // à venir, dans l'ordre, plutôt que juste les mieux notés (01/08/2026).
  picks.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const top = picks.slice(0, 12);
  // Cote ARJEL réelle (demande de Greg le 03/08/2026) — uniquement sur les
  // picks retenus (top 12, pas les 60 candidats bruts) pour ménager le quota
  // API-Sports. On n'affiche la cote QUE si le bookmaker qui l'a fournie est
  // reconnu ARJEL (cf. ARJEL_BOOKMAKERS) — jamais de repli sur un bookmaker
  // non-ARJEL, sinon on afficherait une cote sous un label trompeur.
  for (const p of top) {
    try {
      const oddsData = await fetchRealOdds({ source: "api-sports", sport: "Football", fixtureId: p._fixtureId });
      const isArjel = oddsData && ARJEL_BOOKMAKERS.some(a => String(oddsData.bookmaker || "").toLowerCase().includes(a));
      if (isArjel) {
        const realOdd = pickRealOdd(oddsData, p.bet, p);
        if (realOdd) { p.real_odd = realOdd; p.real_odd_bookmaker = oddsData.bookmaker; p.real_odd_fetched_at = oddsData.fetchedAt; }
      }
    } catch (e) { console.error("[upcoming-picks] odds:", e.message); }
    delete p._fixtureId;
  }
  const observationPool = featuredCandidates.length ? featuredCandidates : trustedFixtures;
  const featuredMatch = top.length ? null : (observationPool
    .filter(p => new Date(p.kickoff).getTime() > Date.now())
    .sort((a, b) => (Number(b.confidence || 0) - Number(a.confidence || 0)) || (new Date(a.kickoff) - new Date(b.kickoff)))[0] || null);
  _upcomingPicksCache = { ts: Date.now(), data: top, fixtures: trustedFixtures.slice().sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff)).slice(0,60), featuredMatch, stats };
  return _upcomingPicksCache;
}


// TLM-HOME-FIXTURES-20260830
function tlmParisDay(ms = Date.now()) {
  const p = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(ms));
  const g=t=>p.find(x=>x.type===t)?.value||"";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
let tlmHomeFixturesCache={ts:0,data:null};
app.get("/homepage-fixtures", async (req,res)=>{
  try{
    res.set("Cache-Control","no-store, max-age=0");
    if(tlmHomeFixturesCache.data && Date.now()-tlmHomeFixturesCache.ts<120000) return res.json(tlmHomeFixturesCache.data);
    const now=Date.now(), today=tlmParisDay(now), tomorrow=tlmParisDay(now+86400000);
    const liveRaw=await fetchLiveMatches();
    const live=(Array.isArray(liveRaw)?liveRaw:[]).filter(m=>{
      const s=String(m?.status||"").toUpperCase();
      return !["FINISHED","SCHEDULED","TIMED","NS","POSTPONED","CANCELLED"].includes(s);
    }).map(m=>({
      id:m.id,home:m.home,away:m.away,competition:m.competition||"Football",country:(String(m.competition||"").split(/\s*[·•]\s*/).pop()||""),sport:m.sport||"Football",
      kickoff:m.utcDate||null,home_logo:m.home_logo||null,away_logo:m.away_logo||null,score_home:m.score_home,score_away:m.score_away,minute:m.minute,status:m.status||"IN_PLAY"
    }));
    const upcoming=[], seen=new Set();
    const push=x=>{
      if(!x||!x.home||!x.away||!x.kickoff) return;
      if(!isPublicFootballScopeMatch(x)) return;
      const t=new Date(x.kickoff).getTime(); if(!Number.isFinite(t)||t<=now) return;
      const k=(x.home+'|'+x.away+'|'+Math.floor(t/1800000)).toLowerCase(); if(seen.has(k)) return; seen.add(k); upcoming.push(x);
    };
    if(API_SPORTS_KEY){
      try{
        const [a,b]=await Promise.all([
          httpGet(`https://v3.football.api-sports.io/fixtures?date=${today}&status=NS`,{"x-apisports-key":API_SPORTS_KEY}),
          httpGet(`https://v3.football.api-sports.io/fixtures?date=${tomorrow}&status=NS`,{"x-apisports-key":API_SPORTS_KEY})
        ]);
        for(const f of [...(a.response||[]),...(b.response||[])]) push({id:`as-${f.fixture?.id||""}`,home:f.teams?.home?.name||"",away:f.teams?.away?.name||"",competition:f.league?.name||"Football",country:f.league?.country||"",country_flag:f.league?.flag||null,sport:"Football",kickoff:f.fixture?.date||null,home_logo:f.teams?.home?.logo||null,away_logo:f.teams?.away?.logo||null});
      }catch(e){console.warn('[homepage-fixtures] API-Sports:',e.message)}
    }
    if(FOOTBALL_DATA_KEY){
      try{
        const fd=await httpGet(`https://api.football-data.org/v4/matches?status=SCHEDULED,TIMED&dateFrom=${today}&dateTo=${tomorrow}`,{"X-Auth-Token":FOOTBALL_DATA_KEY});
        for(const m of (fd.matches||[])) push({id:`fd-${m.id}`,home:m.homeTeam?.name||m.homeTeam?.shortName||"",away:m.awayTeam?.name||m.awayTeam?.shortName||"",competition:m.competition?.name||"Football",country:m.area?.name||m.competition?.area?.name||"",country_flag:m.area?.flag||m.competition?.area?.flag||null,sport:"Football",kickoff:m.utcDate||null,home_logo:m.homeTeam?.crest||null,away_logo:m.awayTeam?.crest||null});
      }catch(e){console.warn('[homepage-fixtures] football-data:',e.message)}
    }
    upcoming.sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
    const data={ok:true,live,upcoming,today,tomorrow}; tlmHomeFixturesCache={ts:Date.now(),data};
    console.log(`[homepage-fixtures] live=${live.length} upcoming=${upcoming.length} ${today}->${tomorrow}`);
    res.json(data);
  }catch(e){console.error('[homepage-fixtures]',e.message);res.status(500).json({ok:false,error:'internal_error'})}
});

app.get("/upcoming-picks", async (req, res) => {
  try {
    const qEmail = req.query.email, qCode = req.query.code;
    let unlocked = false;
    if (qEmail && qCode) {
      try {
        const a = verifyCode(qEmail, qCode);
        unlocked = !!((a.valid && a.plan) || isAdminAccess(qEmail, qCode));
      } catch (_) {}
    }
    // Un calcul froid peut consulter jusqu'a 60 historiques H2H. La route
    // repond avec le cache sans bloquer le navigateur et actualise en fond.
    const cacheFresh = _upcomingPicksCache.ts && Date.now() - _upcomingPicksCache.ts < 30 * 60000;
    if (!cacheFresh) refreshUpcomingPicksInBackground();
    const result = _upcomingPicksCache;
    // Le cache dure 30 min : un match peut avoir donne son coup d'envoi entre
    // deux recalculs et rester affiche avec sa cote figee d'avant-match, alors
    // qu'il est deja en direct ailleurs sur le site. Filtre applique a chaque
    // requete (pas au calcul), donc jamais plus de quelques secondes de retard
    // meme entre deux recalculs. Signale par Greg le 03/08/2026.
    const stillUpcoming = result.data.filter(p => new Date(p.kickoff).getTime() > Date.now());
    const featured = result.featuredMatch && new Date(result.featuredMatch.kickoff).getTime() > Date.now()
      ? result.featuredMatch : null;
    res.json({
      ok: true,
      picks: stillUpcoming.map(p => ({
        home: p.home, away: p.away, competition: p.competition, sport: p.sport,
        kickoff: p.kickoff, confidence: p.confidence,
        bet: unlocked ? p.bet : null, locked: !unlocked,
        real_odd: unlocked ? (p.real_odd || null) : null,
        real_odd_fetched_at: unlocked ? (p.real_odd_fetched_at || null) : null,
        home_logo: p.home_logo, away_logo: p.away_logo,
      })),
      fixtures: (result.fixtures || []).filter(p => new Date(p.kickoff).getTime() > Date.now()).map(p => ({
        home: p.home, away: p.away, competition: p.competition, country: p.country,
        sport: p.sport || "Football", kickoff: p.kickoff,
        home_logo: p.home_logo || null, away_logo: p.away_logo || null,
        status: p.status || "scheduled",
      })),
      featuredMatch: featured ? {
        home: featured.home, away: featured.away,
        competition: featured.competition, country: featured.country,
        sport: "Football", kickoff: featured.kickoff,
        confidence: featured.confidence, status: "watchlist",
        reason: featured.reason,
        home_logo: featured.home_logo, away_logo: featured.away_logo,
      } : null,
      stats: result.stats,
      refreshing: !cacheFresh || !!_upcomingPicksRefreshPromise,
    });
  } catch (e) {
    console.error("[upcoming-picks] endpoint:", e.message);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

function buildH2HBlock(h2h, homeName, awayName) {
  if (!h2h) return "";
  return `

H2H VÉRIFIÉ (${h2h.n} dernières confrontations directes, données API réelles) :
- Bilan : ${homeName} ${h2h.homeWins}V · ${h2h.draws}N · ${awayName} ${h2h.awayWins}V
- Moyenne de buts : ${h2h.avgGoals}/match
- Under 2.5 buts : ${h2h.under25Pct}% des confrontations
- Les deux équipes marquent (BTTS) : ${h2h.bttsPct}%
→ Utilise ces chiffres RÉELS en priorité sur ta mémoire pour juger Under/Over 2.5, BTTS et le vainqueur probable.`;
}

// ── Contexte profond : forme, force/classement, enjeu, blessés (données API) ───
const teamStatsCache = new Map();
const standingsCache = new Map();
const injuriesCache = new Map();

const DEEP_CONTEXT_ENABLED = process.env.DEEP_CONTEXT !== "0";

async function fetchTeamStatistics(leagueId, season, teamId) {
  if (!API_SPORTS_KEY || !leagueId || !season || !teamId) return null;
  const ck = `tstat_${leagueId}_${season}_${teamId}`;
  const c = teamStatsCache.get(ck);
  if (c && Date.now() - c.ts < 6 * 3600 * 1000) return c.data;
  try {
    const data = await httpGet(
      `https://v3.football.api-sports.io/teams/statistics?league=${leagueId}&season=${season}&team=${teamId}`,
      { "x-apisports-key": API_SPORTS_KEY }
    );
    const r = data?.response;
    if (!r || !r.fixtures) { teamStatsCache.set(ck, { data: null, ts: Date.now() }); return null; }
    const out = {
      form: String(r.form || "").slice(-5),
      wins: r.fixtures?.wins?.total ?? 0,
      draws: r.fixtures?.draws?.total ?? 0,
      loses: r.fixtures?.loses?.total ?? 0,
      gfAvg: parseFloat(r.goals?.for?.average?.total ?? 0) || 0,
      gaAvg: parseFloat(r.goals?.against?.average?.total ?? 0) || 0,
      cleanSheet: r.clean_sheet?.total ?? 0,
      failedToScore: r.failed_to_score?.total ?? 0,
    };
    teamStatsCache.set(ck, { data: out, ts: Date.now() });
    return out;
  } catch (e) { console.error("[team-stats]", e.message); return null; }
}

async function fetchStandings(leagueId, season) {
  if (!API_SPORTS_KEY || !leagueId || !season) return null;
  const ck = `stand_${leagueId}_${season}`;
  const c = standingsCache.get(ck);
  if (c && Date.now() - c.ts < 6 * 3600 * 1000) return c.data;
  try {
    const data = await httpGet(
      `https://v3.football.api-sports.io/standings?league=${leagueId}&season=${season}`,
      { "x-apisports-key": API_SPORTS_KEY }
    );
    const table = data?.response?.[0]?.league?.standings?.[0] || [];
    const rows = table.map(t => ({
      teamId: t.team?.id, rank: t.rank, points: t.points, goalsDiff: t.goalsDiff,
    })).filter(r => r.teamId);
    const out = rows.length ? { rows, total: rows.length } : null;
    standingsCache.set(ck, { data: out, ts: Date.now() });
    return out;
  } catch (e) { console.error("[standings]", e.message); return null; }
}

async function fetchInjuries(match) {
  if (!API_SPORTS_KEY || !match.fixtureId) return null;
  const ck = `inj_${match.fixtureId}`;
  const c = injuriesCache.get(ck);
  if (c && Date.now() - c.ts < 3600 * 1000) return c.data;
  try {
    const data = await httpGet(
      `https://v3.football.api-sports.io/injuries?fixture=${match.fixtureId}`,
      { "x-apisports-key": API_SPORTS_KEY }
    );
    const list = data?.response || [];
    const home = [], away = [];
    for (const it of list) {
      const name = it.player?.name;
      if (!name) continue;
      if (it.team?.id === match.homeId) home.push(name);
      else if (it.team?.id === match.awayId) away.push(name);
    }
    const out = { home, away };
    injuriesCache.set(ck, { data: out, ts: Date.now() });
    return out;
  } catch (e) { console.error("[injuries]", e.message); return null; }
}

function stakeLabel(rank, total) {
  if (rank == null || !total) return "?";
  if (rank <= 3) return "haut de tableau (course Europe/titre)";
  if (rank >= total - 2) return "bas de tableau (lutte pour le maintien)";
  return "milieu de tableau";
}

async function fetchDeepContext(match) {
  if (!DEEP_CONTEXT_ENABLED) return "";
  if (match.source !== "api-sports" || match.sport !== "Football" || !match.homeId || !match.awayId) return "";
  // 4 appels potentiels (stats domicile/exterieur, classement, blessures) —
  // un seul jeton de budget suffit a les autoriser ou les bloquer ensemble,
  // pas la peine d'un jeton par sous-appel.
  if (!apiSportsBudgetOk()) return "";
  try {
    const [homeStats, awayStats, standings, injuries] = await Promise.all([
      fetchTeamStatistics(match.leagueId, match.season, match.homeId),
      fetchTeamStatistics(match.leagueId, match.season, match.awayId),
      fetchStandings(match.leagueId, match.season),
      fetchInjuries(match),
    ]);

    let out = "";
    if (homeStats || awayStats) {
      out += `\n\nFORME & FORCE (5 derniers résultats + moyennes saison, données API réelles) :`;
      if (homeStats) out += `\n- ${match.home} : forme ${homeStats.form || "?"} | ${homeStats.gfAvg} but/m marqués, ${homeStats.gaAvg} encaissés | ${homeStats.wins}V-${homeStats.draws}N-${homeStats.loses}D`;
      if (awayStats) out += `\n- ${match.away} : forme ${awayStats.form || "?"} | ${awayStats.gfAvg} but/m marqués, ${awayStats.gaAvg} encaissés | ${awayStats.wins}V-${awayStats.draws}N-${awayStats.loses}D`;
    }
    if (standings?.rows?.length) {
      const h = standings.rows.find(r => r.teamId === match.homeId);
      const a = standings.rows.find(r => r.teamId === match.awayId);
      if (h || a) {
        out += `\n\nCLASSEMENT & ENJEU :`;
        if (h) out += `\n- ${match.home} : ${h.rank}e (${h.points} pts) — ${stakeLabel(h.rank, standings.total)}`;
        if (a) out += `\n- ${match.away} : ${a.rank}e (${a.points} pts) — ${stakeLabel(a.rank, standings.total)}`;
        if (h && a) out += `\n- Écart : ${Math.abs(h.rank - a.rank)} places, ${Math.abs(h.points - a.points)} pts`;
      }
    }
    if (injuries && (injuries.home.length || injuries.away.length)) {
      out += `\n\nBLESSÉS / ABSENTS (données API réelles) :`;
      out += `\n- ${match.home} : ${injuries.home.length ? injuries.home.slice(0, 5).join(", ") : "aucun signalé"}`;
      out += `\n- ${match.away} : ${injuries.away.length ? injuries.away.slice(0, 5).join(", ") : "aucun signalé"}`;
    }
    if (out) {
      out += `\n→ Croise ces données avec le H2H pour justifier ta confiance. Mauvaise forme, écart de niveau au classement, absences clés ou faible enjeu = prudence. Signaux convergents (bonne forme + classement + H2H alignés) = confiance haute justifiée.`;
      console.log(`[concile] Contexte profond OK ${match.home} vs ${match.away}`);
    }
    return out;
  } catch (e) {
    console.error("[concile] deep-context:", e.message);
    return "";
  }
}

// ── Vraies cotes bookmakers ARJEL (API-Sports) ────────────────────────────────
const oddsCache = new Map();
const ARJEL_BOOKMAKERS = [
  "betclic", "winamax", "unibet", "parionssport", "parions sport",
  "pmu", "zebet", "vbet", "genybet", "bwin", "betsson", "netbet", "france pari",
];

// Compétitions non-foot MAJEURES disponibles sur les bookmakers ARJEL français.
// Elles n'ont pas de cote récupérée automatiquement (l'API odds ne couvre que le
// foot), mais on sait qu'elles sont jouables en France → autorisées pour les clients.
const ARJEL_MAJOR_COMPETITIONS = [
  "nba", "wnba", "euroleague", "euroligue", "eurocup", "betclic elite", "pro a",
  "nhl", "atp", "wta", "grand slam", "roland garros", "wimbledon", "us open",
  "australian open", "masters 1000", "mlb", "top 14", "champions cup", "pro d2",
];
function isArjelMajorCompetition(match) {
  const hay = `${match?.competition || ""} ${match?.league || ""} ${match?.sport || ""}`.toLowerCase();
  return ARJEL_MAJOR_COMPETITIONS.some(k => hay.includes(k));
}

// Endpoint de cotes par sport chez API-Sports. Le football utilise le
// paramètre "fixture", les autres sports "game" — et chacun son sous-domaine.
// Sans cette table, seul le football obtenait une vraie cote : or la diffusion
// exige une vraie cote bookmaker, donc basket, hockey et baseball ne pouvaient
// JAMAIS être diffusés, alors que le palier Elite promet 30 signaux/jour
// multisport. Le palier était structurellement intenable.
const ODDS_ENDPOINT_BY_SPORT = {
  football:   { host: "v3.football.api-sports.io",   param: "fixture", key: "football" },
  basketball: { host: "v1.basketball.api-sports.io", param: "game",    key: "basketball" },
  hockey:     { host: "v1.hockey.api-sports.io",     param: "game",    key: "hockey" },
  baseball:   { host: "v1.baseball.api-sports.io",   param: "game",    key: "baseball" },
};

async function fetchRealOdds(match) {
  if (!API_SPORTS_KEY || match.source !== "api-sports") return null;
  const sportLc = String(match.sport || "Football").toLowerCase();
  const cfg = ODDS_ENDPOINT_BY_SPORT[sportLc];
  if (!cfg) return null;
  // Football : fixtureId. Autres sports : l'identifiant du match est dans sourceId
  // (fixtureId y vaut null, cf. fetchFromApiSports).
  const gameId = sportLc === "football" ? match.fixtureId : (match.sourceId || match.fixtureId);
  if (!gameId) return null;
  // Respecte le disjoncteur de quota déjà en place : inutile d'insister sur un
  // sport dont l'API nous a déjà renvoyé un dépassement.
  if (typeof shouldSkipApiSportsSport === "function" && shouldSkipApiSportsSport(cfg.key)) return null;

  // Le score fait partie de la cle : un but change les cotes instantanement,
  // mais le cache durait 10 min meme en direct — un abonne pouvait recevoir
  // une cote d'avant-but perimee jusqu'a 10 min apres qu'elle ait bouge.
  // Inclure le score force un refetch des qu'il change, tout en gardant le
  // cache 10 min tant que rien ne bouge (protege le quota API-Sports).
  // Constate le 04/08/2026 : Unibet affiche a 2.00 alors que la cote reelle
  // etait deja retombee a 1.50 apres un but.
  const ck = `odds_${sportLc}_${gameId}_${match.score_home ?? "x"}_${match.score_away ?? "x"}`;
  const c = oddsCache.get(ck);
  if (c && Date.now() - c.ts < 10 * 60 * 1000) return c.data;
  let data = null;
  try {
    const resp = await httpGet(
      `https://${cfg.host}/odds?${cfg.param}=${gameId}`,
      { "x-apisports-key": API_SPORTS_KEY }
    );
    const bookmakers = resp?.response?.[0]?.bookmakers || [];
    if (bookmakers.length) {
      // On privilégie NOS bookmakers partenaires (cliquables sur le site : Winamax,
      // Unibet, PMU), puis n'importe quel ARJEL, puis le premier disponible.
      const PARTNER = ["winamax", "unibet", "pmu"];
      const chosen = bookmakers.find(bm => PARTNER.some(a => String(bm.name || "").toLowerCase().includes(a)))
        || bookmakers.find(bm => ARJEL_BOOKMAKERS.some(a => String(bm.name || "").toLowerCase().includes(a)))
        || bookmakers[0];
      data = {
        bookmaker: chosen.name, bets: chosen.bets || [],
        // Tous les bookmakers ARJEL renvoyés par l'API pour ce match — sert à
        // calculer une cote MOYENNE (pas juste celle d'un seul opérateur).
        arjelBookmakers: bookmakers.filter(bm => ARJEL_BOOKMAKERS.some(a => String(bm.name || "").toLowerCase().includes(a))),
        // Horodatage de la VRAIE recuperation (pas du cache) — affiche cote
        // client pour que la fraicheur soit verifiable, pas juste affirmee.
        // Reste correct meme servi depuis oddsCache : c'est l'heure de ce bloc
        // qui compte, pas celle de la lecture cache. Demande de Greg le
        // 03/08/2026 ("comment je sais si tu as les cotes en temps reel").
        fetchedAt: new Date().toISOString(),
      };
    }
  } catch (e) { console.error("[odds]", e.message); data = null; }
  oddsCache.set(ck, { data, ts: Date.now() });
  return data;
}

// Mappe le pari recommandé (texte libre FR) vers la vraie cote du bookmaker.
function pickRealOdd(oddsData, betLabel, match) {
  if (!oddsData?.bets?.length) return null;
  const b = String(betLabel || "").toLowerCase();
  const findBet = (names) => oddsData.bets.find(x => names.some(n => String(x.name || "").toLowerCase().includes(n)));
  const valOf = (bet, matcher) => {
    if (!bet) return null;
    const v = (bet.values || []).find(v => matcher(String(v.value || "").toLowerCase()));
    const o = v ? parseFloat(v.odd) : null;
    return (o && o > 1) ? Math.round(o * 100) / 100 : null;
  };
  if (/under|moins de|-2\.5/.test(b))  return valOf(findBet(["goals over/under", "over/under"]), s => s.includes("under 2.5"));
  if (/over|plus de|\+2\.5/.test(b))   return valOf(findBet(["goals over/under", "over/under"]), s => s.includes("over 2.5"));
  if (/btts|both teams|deux équipes|marquent/.test(b)) {
    const bt = findBet(["both teams to score", "both teams score"]);
    const wantNo = /\bnon\b|\bno\b/.test(b);
    return valOf(bt, s => wantNo ? s === "no" : s === "yes");
  }
  if (/but.*1(ère|ere|\s)?\s*mi-?temps|goal.*first half/.test(b)) {
    // "But en 1ère mi-temps" = au moins un but marque en 1ere periode = Over 0.5
    // sur le marche "Goals Over/Under First Half" (nom confirme cote Unibet le
    // 03/08/2026, cf. diagnostic de Greg).
    return valOf(findBet(["goals over/under first half", "over/under first half"]), s => s.includes("over 0.5"));
  }
  if (/double chance/.test(b)) {
    const bt = findBet(["double chance"]);
    if (/1x|domicile.*nul|home.*draw/.test(b)) return valOf(bt, s => s.includes("home/draw") || s === "1x");
    if (/x2|nul.*ext|draw.*away/.test(b))     return valOf(bt, s => s.includes("draw/away") || s === "x2");
    return valOf(bt, s => s.includes("home/away") || s === "12");
  }
  if (/victoire|vainqueur|winner/.test(b)) {
    const bt = findBet(["match winner", "1x2", "winner"]);
    const home = String(match?.home || "").toLowerCase();
    const away = String(match?.away || "").toLowerCase();
    if (home && b.includes(home.split(" ")[0])) return valOf(bt, s => s === "home");
    if (away && b.includes(away.split(" ")[0])) return valOf(bt, s => s === "away");
    if (/nul|draw|match nul/.test(b))           return valOf(bt, s => s === "draw");
  }
  return null;
}

// Cote marché réaliste par défaut si aucune vraie cote — variée SELON le marché
// (fini la cote unique 1.71 pour tout). Utilisée en fallback uniquement.
function estimateMarketOdd(confidence, betLabel) {
  const base = Math.min(1.95, (1 / (Math.max(1, confidence) / 100)) * 1.45);
  const b = String(betLabel || "").toLowerCase();
  let mult = 1.0, lo = 1.2, hi = 2.6;
  if (/double chance|1x|x2|12\b/.test(b))                { mult = 0.72; lo = 1.12; hi = 1.75; }
  else if (/draw no bet|dnb|remboursé/.test(b))          { mult = 0.9;  lo = 1.25; hi = 2.2; }
  else if (/victoire|vainqueur|winner/.test(b))          { mult = 0.88; lo = 1.2;  hi = 2.9; }
  else if (/under|moins de|-2\.5|-1\.5|-3\.5/.test(b))   { mult = 1.0;  lo = 1.4;  hi = 2.1; }
  else if (/over|plus de|\+2\.5|\+1\.5|\+3\.5/.test(b))  { mult = 1.12; lo = 1.5;  hi = 2.5; }
  else if (/btts|both teams|deux équipes|marquent/.test(b)) { mult = 1.08; lo = 1.5; hi = 2.3; }
  const odd = Math.max(lo, Math.min(hi, base * mult));
  return Math.round(odd * 100) / 100;
}

// Pastille de couleur selon le % de confiance — même échelle utilisée sur la
// page Live IA (fonction confMeta côté client) et dans les messages Telegram,
// pour que le client voie le même code couleur partout.
function confidenceEmoji(conf) {
  const c = Number(conf) || 0;
  if (c >= 85) return "🟢";
  if (c >= 75) return "🟡";
  if (c >= 65) return "🟠";
  return "🔴";
}

// Moyenne des cotes ARJEL disponibles pour ce pari, tous bookmakers confondus
// (Winamax, Unibet, PMU, Betclic, Zebet...). Différent de la "cote réelle"
// retenue pour le tier (celle-là vient d'UN SEUL bookmaker, priorisé sur nos
// partenaires) — la moyenne donne au client une vision du marché dans son
// ensemble, demandée pour affichage Live IA + diffusion Telegram.
function computeArjelAverageOdd(oddsData, betLabel, match) {
  if (!oddsData?.arjelBookmakers?.length) return null;
  const vals = [];
  const names = [];
  for (const bm of oddsData.arjelBookmakers) {
    const v = pickRealOdd({ bets: bm.bets || [] }, betLabel, match);
    if (v) { vals.push(v); names.push(bm.name); }
  }
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length, names };
}

// ── Garde-fou de plausibilite Over/Under 2.5 ──────────────────────────────────
// API-Sports peut renvoyer une cote Over/Under perimee sans le signaler —
// constate le 04/08/2026 : Under 2.5 buts affiche a 1.60 (implique ~62% de
// probabilite) a la 48e minute d'un 0-0, alors que le vrai marche (Winamax,
// meme instant) etait a 1.04 (~96%). Le score-based cache fix garantit un
// refetch a chaque but, mais si le FOURNISSEUR lui-meme n'a pas rafraichi son
// prix, refetcher ne change rien.
//
// Un modele a taux de buts fixe (Poisson) a ete essaye puis abandonne : un
// seul taux ne colle jamais aux deux bouts du match a la fois (trop tolerant
// en fin de match scoreless, trop strict en debut de match ou l'incertitude
// est normale). A la place, la verification ne s'active que dans la zone ou
// on peut juger avec certitude SANS modele — a partir de la 45e minute, avec
// peu de buts deja marques, un marche Over/Under est deja tres largement
// tranche par les bookmakers reels (ex. verifie ici : Under 2.5 a 1.04 a la
// 50e minute d'un 0-0). En dehors de cette zone, l'incertitude est trop
// grande pour juger une cote sans se tromper : on ne bloque rien.
function isPlausibleRealOdd(betLabel, odd, match) {
  const b = String(betLabel || "").toLowerCase();
  const isUnder = /under|moins de|-2\.5/.test(b);
  const isOver = /over|plus de|\+2\.5/.test(b);
  if (!isUnder && !isOver) return true; // marche non couvert par ce modele
  const score = readKnownScore(match);
  if (!score) return true; // score inconnu, rien a comparer
  const minute = estimateMinute(match);
  if (minute < 45) return true; // trop tot pour juger sans modele fiable
  if (score.total >= 3) return true; // marche deja tranche, hors scope
  if (isUnder) {
    // Under quasi verrouille en 2e mi-temps avec 0-2 buts au compteur : une
    // cote encore genereuse (>1.5) sent la cote perimee.
    return odd <= 1.5;
  }
  // Over encore incertain en 2e mi-temps avec 0-1 but marque (il en faut 2+
  // de plus) : une cote deja tres basse (<1.5) sent la cote perimee dans
  // l'autre sens. Avec 2 buts deja marques, Over redevient plausible a des
  // cotes variees — pas de verification dans ce cas.
  if (score.total <= 1) return odd >= 1.5;
  return true;
}

// Retourne la meilleure cote disponible : moyenne des bookmakers ARJEL trouves
// pour ce marche, sinon la cote d'un seul bookmaker (partenaire en priorite),
// sinon une estimation. Avant, un SEUL bookmaker (Winamax>Unibet>PMU) faisait
// foi meme quand plusieurs bookmakers ARJEL etaient disponibles — un prix isole
// peut diverger fortement du marche (constate le 04/08/2026 : Unibet a 1.60
// affiche alors que Winamax etait a 1.20 au meme instant). La moyenne lisse
// ce risque. Le "source" garde les noms des bookmakers moyennes : necessaire
// pour que arjelPlayable (plus bas) reconnaisse toujours un operateur ARJEL.
async function computeBestOdd(match, betLabel, confidence) {
  // Minute a laquelle la cote est recuperee, ajoutee a l'etiquette pour que le
  // client sache exactement de quand elle date (demande du fondateur le
  // 04/08/2026 : "comme ca on sait exactement ou on en est, ce n'est plus
  // flou vis-a-vis des abonnes").
  const oddMinute = match.minute || estimateMinute(match) || null;
  const minuteTag = oddMinute ? ` · cote à la ${oddMinute}e minute` : "";
  try {
    const oddsData = await fetchRealOdds(match);
    const arjelAvgInfo = computeArjelAverageOdd(oddsData, betLabel, match);
    if (arjelAvgInfo && isPlausibleRealOdd(betLabel, arjelAvgInfo.avg, match)) {
      // Un seul bookmaker trouve = SA cote reelle, jamais appelee "moyenne"
      // (mensonger). Plusieurs bookmakers = vraie moyenne, tous nommes plutot
      // qu'attribuee a un seul (demande du fondateur le 04/08/2026 : ne pas
      // afficher "Unibet" quand ce n'est pas vraiment sa cote isolee).
      const namesLabel = [...new Set(arjelAvgInfo.names)].join(", ");
      const label = arjelAvgInfo.count > 1
        ? `moyenne ARJEL (${arjelAvgInfo.count} bookmakers: ${namesLabel})`
        : namesLabel;
      return {
        cote: arjelAvgInfo.avg, source: `${label}${minuteTag}`,
        arjelAvg: arjelAvgInfo.avg, arjelCount: arjelAvgInfo.count,
      };
    }
    if (arjelAvgInfo) console.log(`[odds] moyenne ARJEL rejetee (implausible face a minute/score): ${arjelAvgInfo.avg} pour "${betLabel}" — ${match.home} vs ${match.away}`);
    const real = pickRealOdd(oddsData, betLabel, match);
    if (real && isPlausibleRealOdd(betLabel, real, match)) {
      const bmName = oddsData.bookmaker || "bookmaker";
      return { cote: real, source: `${bmName}${minuteTag}`, arjelAvg: null, arjelCount: 0 };
    }
    if (real) console.log(`[odds] cote bookmaker rejetee (implausible face a minute/score): ${real} pour "${betLabel}" — ${match.home} vs ${match.away}`);
  } catch (e) { console.error("[odds] compute:", e.message); }
  return { cote: estimateMarketOdd(confidence, betLabel), source: "estimation", arjelAvg: null, arjelCount: 0 };
}

// Cote d'une ligne concile_analyses : vraie cote stockée sinon estimation par marché.
function rowOdd(r) {
  if (r && r.real_odd && r.real_odd > 1) return Math.round(r.real_odd * 100) / 100;
  return estimateMarketOdd(r?.confidence || 0, r?.best_bet || "");
}

function parseMatchStats(data) {
  if (!data?.response?.length) return null;
  const home = data.response[0]?.statistics || [];
  const away = data.response[1]?.statistics || [];
  const get = (arr, name) => {
    const s = arr.find(s => s.type === name);
    return s?.value ?? null;
  };
  return {
    possession_home: get(home, "Ball Possession"),
    possession_away: get(away, "Ball Possession"),
    shots_on_goal_home: get(home, "Shots on Goal"),
    shots_on_goal_away: get(away, "Shots on Goal"),
    total_shots_home: get(home, "Total Shots"),
    total_shots_away: get(away, "Total Shots"),
    dangerous_attacks_home: get(home, "Dangerous Attacks"),
    dangerous_attacks_away: get(away, "Dangerous Attacks"),
    yellow_cards_home: get(home, "Yellow Cards") || 0,
    yellow_cards_away: get(away, "Yellow Cards") || 0,
    red_cards_home: get(home, "Red Cards") || 0,
    red_cards_away: get(away, "Red Cards") || 0,
    corners_home: get(home, "Corner Kicks"),
    corners_away: get(away, "Corner Kicks"),
  };
}

function buildStatsBlock(stats, home, away) {
  if (!stats) return "";
  const lines = ["\n📊 STATISTIQUES TEMPS RÉEL (données live api-sports.io) :"];
  if (stats.possession_home) lines.push(`  Possession    : ${home} ${stats.possession_home} — ${away} ${stats.possession_away}`);
  if (stats.shots_on_goal_home !== null) lines.push(`  Tirs cadrés   : ${home} ${stats.shots_on_goal_home} — ${away} ${stats.shots_on_goal_away}`);
  if (stats.total_shots_home !== null) lines.push(`  Tirs totaux   : ${home} ${stats.total_shots_home} — ${away} ${stats.total_shots_away}`);
  if (stats.dangerous_attacks_home !== null) lines.push(`  Att. dang.    : ${home} ${stats.dangerous_attacks_home} — ${away} ${stats.dangerous_attacks_away}`);
  if (stats.corners_home !== null) lines.push(`  Corners       : ${home} ${stats.corners_home} — ${away} ${stats.corners_away}`);
  if (stats.yellow_cards_home > 0 || stats.yellow_cards_away > 0) lines.push(`  Cartons jaunes: ${home} ${stats.yellow_cards_home} — ${away} ${stats.yellow_cards_away}`);
  if (stats.red_cards_home > 0 || stats.red_cards_away > 0) lines.push(`  ⚠️ CARTONS ROUGES: ${home} ${stats.red_cards_home} — ${away} ${stats.red_cards_away} (infériorité numérique!)`);
  return lines.join("\n");
}

// ── Groq Concile analysis ─────────────────────────────────────────────────────
// Produit TousLesMatchs actif : football Over/Under 2,5 exclusivement.
// Les anciens marchés restent en base pour l'historique mais ne sont plus
// proposés au Concile client.
const BET_TYPES = ["Over 2.5 buts", "Under 2.5 buts"];

// Estime la minute depuis l'heure de début quand l'API ne la fournit pas
function estimateMinute(match) {
  const m = parseInt(match.minute);
  if (!isNaN(m) && m > 0) return m;
  if (match.status !== "IN_PLAY" && match.status !== "LIVE") return 0;
  if (match.utcDate) {
    const elapsed = Math.floor((Date.now() - new Date(match.utcDate).getTime()) / 60000);
    if (elapsed > 0 && elapsed <= 120) return Math.min(elapsed, 92);
  }
  return 50; // fallback mi-match si aucune info
}

// Filtre les paris mathématiquement impossibles ou déjà perdus
function readKnownScore(match) {
  if (match.score_home === null || match.score_home === undefined || match.score_away === null || match.score_away === undefined) {
    return null;
  }
  const home = Number(match.score_home);
  const away = Number(match.score_away);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away, total: home + away };
}

function computeAvailableBets(match) {
  const sport = String(match.sport || "Football");
  // Basketball/Hockey/Baseball n'ont pas de match nul (prolongation/tirs au
  // but obligatoires, ou pas de nul possible au baseball) et les marches buts
  // (Over/Under 2.5, BTTS) sont calibres pour le football, pas pour un score
  // de basket/baseball. Sans ce filtre, la correction post-IA
  // (validateAndCorrectBet, R2) pouvait retomber sur "Match nul" comme repli
  // pour un match de basket plie a 53-93 — resultat impossible pour ce sport.
  // Constate le 01/08/2026, etendu au baseball a la reactivation du sport.
  if (sport === "Basketball" || sport === "Hockey" || sport === "Baseball") {
    return ["Victoire domicile", "Victoire extérieur"];
  }

  const score = readKnownScore(match);
  if (!score) return [...BET_TYPES];
  const h = score.home;
  const a = score.away;
  const total = score.total;
  const minute = estimateMinute(match);
  const remaining = Math.max(0, 93 - minute);
  const isLive = minute >= 30 && match.status !== "SCHEDULED";
  const isNeutral = isNeutralComp(match.competition || "");

  let bets = [...BET_TYPES];

  // Terrain neutre (Coupe du Monde, Euro, etc.) → remplacer domicile/extérieur par noms réels
  // Les termes "Victoire domicile/extérieur" n'ont pas de sens sans avantage terrain
  if (isNeutral) {
    bets = bets.map(b => {
      if (b === "Victoire domicile") return `Victoire ${match.home}`;
      if (b === "Victoire extérieur") return `Victoire ${match.away}`;
      if (b === "Double chance 1X") return `Double chance ${match.home} ou Nul`;
      if (b === "Double chance X2") return `Double chance ${match.away} ou Nul`;
      return b;
    });
  }

  if (!isLive) return bets;

  // Marchés déjà PERDUS → supprimer
  if (total > 2.5) bets = bets.filter(b => b !== "Under 2.5 buts");
  if (total > 1.5) bets = bets.filter(b => b !== "Under 1.5 buts" && b !== "Under 2.5 buts");
  if (h > 0 && a > 0) bets = bets.filter(b => b !== "BTTS Non");
  // Marchés déjà gagnés : ne jamais proposer un pari dont l'issue est déjà acquise.
  if (total > 2.5) bets = bets.filter(b => b !== "Over 2.5 buts");
  if (h > 0 && a > 0) bets = bets.filter(b => b !== "BTTS Oui");

  // Over 2.5 : projection mathématique basée sur le rythme actuel
  const need25 = Math.max(0, 3 - total);
  const projectedGoals = minute > 0 ? (total / minute) * 90 : 0;
  if (need25 >= 3 && remaining <= 30) bets = bets.filter(b => b !== "Over 2.5 buts");
  if (need25 >= 2 && remaining <= 15) bets = bets.filter(b => b !== "Over 2.5 buts");
  // Nouveau : si projection < 2.0 après 45 min → Over 2.5 statistiquement improbable
  if (minute >= 45 && need25 >= 2 && projectedGoals < 2.0) bets = bets.filter(b => b !== "Over 2.5 buts");

  // BTTS quasi-impossible si une équipe vierge et peu de temps
  if (h === 0 && remaining <= 15) bets = bets.filter(b => b !== "BTTS Oui");
  if (a === 0 && remaining <= 15) bets = bets.filter(b => b !== "BTTS Oui");

  // Victoire impossible si mène +2 et <10 min
  if (isNeutral) {
    if (h - a >= 2 && remaining <= 10) bets = bets.filter(b => b !== `Victoire ${match.away}`);
    if (a - h >= 2 && remaining <= 10) bets = bets.filter(b => b !== `Victoire ${match.home}`);
  } else {
    if (h - a >= 2 && remaining <= 10) bets = bets.filter(b => b !== "Victoire extérieur");
    if (a - h >= 2 && remaining <= 10) bets = bets.filter(b => b !== "Victoire domicile");
  }

  return bets.length > 0 ? bets : BET_TYPES;
}

// Correction post-IA : si l'IA recommande quand même un pari impossible, on corrige
function validateAndCorrectBet(bet, match, availableBets) {
  // R2 (finalité connue) : jamais de "Victoire" d'une équipe qui mène déjà de >= 3 buts.
  // Le résultat est décidé, le book ne cote plus — aucune valeur. Ex: 0-3 → pas de "Victoire extérieur".
  // Calibré pour le football (écart en BUTS) — ne s'applique pas au basket/hockey,
  // qui n'ont pas d'alternative "sans vainqueur" (pas de match nul). Sans cette
  // exclusion, un basket plié à 53-93 se faisait "corriger" vers un repli
  // arbitraire (Match nul, impossible dans ce sport, ou pire la mauvaise
  // équipe) au lieu de laisser l'IA prédire la victoire — pourtant correcte
  // avec un tel écart. Constate le 01/08/2026.
  const sportForGap = String(match.sport || "Football");
  // Baseball exclu au meme titre que basket/hockey : un ecart de 3 points
  // (calibre foot/buts) n'a rien de decisif au baseball (un ecart de 3 runs
  // se rattrape sur plusieurs manches), et le sport n'a pas d'alternative
  // "sans vainqueur" non plus. Ajoute a la reactivation du 01/08/2026.
  if (sportForGap !== "Basketball" && sportForGap !== "Hockey" && sportForGap !== "Baseball") {
    const sc = readKnownScore(match);
    if (sc) {
      const gap = sc.home - sc.away;
      const decidedWin =
        (bet === "Victoire domicile" && gap >= DECIDED_MATCH_GAP) ||
        (bet === "Victoire extérieur" && -gap >= DECIDED_MATCH_GAP);
      if (decidedWin) {
        const alt = availableBets.find(b => b !== bet && !/Victoire/i.test(b)) || availableBets[0];
        console.log(`[concile] Finalité connue (${sc.home}-${sc.away}) : "${bet}" rejeté → "${alt}"`);
        return { bet: alt, corrected: true, original: bet };
      }
    }
  }

  if (availableBets.includes(bet)) return { bet, corrected: false };

  // Corrections logiques
  const score = readKnownScore(match);
  const h = score ? score.home : null;
  const a = score ? score.away : null;
  const total = score ? score.total : null;
  const minute = estimateMinute(match);
  const remaining = Math.max(0, 93 - minute);

  let corrected = bet;
  if (score && (bet === "Over 2.5 buts") && availableBets.includes("Under 2.5 buts")) corrected = "Under 2.5 buts";
  else if (score && (bet === "Under 2.5 buts") && total > 2.5 && availableBets.includes("Over 2.5 buts")) corrected = "Over 2.5 buts";
  else if (score && (bet === "BTTS Non") && h > 0 && a > 0 && availableBets.includes("BTTS Oui")) corrected = "BTTS Oui";
  else if (score && (sportForGap === "Basketball" || sportForGap === "Hockey" || sportForGap === "Baseball") && h !== a) {
    // Basket/hockey/baseball n'ont que 2 issues possibles ici (pas de match nul) : le
    // repli generique "premier pari disponible" pouvait tomber sur l'equipe
    // qui PERD. On corrige vers l'equipe reellement en tete plutot qu'un
    // choix arbitraire.
    corrected = h > a ? "Victoire domicile" : "Victoire extérieur";
  }
  else corrected = availableBets[0]; // fallback sur premier pari disponible

  console.log(`[concile] Correction: "${bet}" → "${corrected}" (mathématiquement invalide à ${minute}', score ${h}-${a})`);
  return { bet: corrected, corrected: true, original: bet };
}

const NEUTRAL_KEYWORDS = ["world cup","coupe du monde","fifa world","euro ","uefa euro","copa america","gold cup","afcon","africa cup","nations league final","champions league final","europa league final"];
function isNeutralComp(comp = "") {
  const c = comp.toLowerCase();
  return NEUTRAL_KEYWORDS.some(k => c.includes(k));
}

// Calcule les contraintes mathématiques live pour éviter les paris impossibles
function computeLiveConstraints(match) {
  const score = readKnownScore(match);
  if (!score) return "";
  const h = score.home;
  const a = score.away;
  const total = score.total;
  const minute = estimateMinute(match); // utilise l'estimation si null
  const isLive = minute >= 30 && match.status !== "SCHEDULED" && match.minute !== "Pré-match";

  if (!isLive) return "";

  const remaining = Math.max(0, 93 - minute);
  const goalsPerMin = minute > 0 ? total / minute : 0;
  const projectedTotal = Math.round(goalsPerMin * 90 * 10) / 10;

  const lines = ["\n🔢 CONTRAINTES MATHÉMATIQUES LIVE — respecte-les impérativement:"];

  // ── Marchés déjà gagnés
  const won = [];
  if (total > 3.5) won.push("Over 3.5 ✅");
  if (total > 2.5) won.push("Over 2.5 ✅");
  if (total > 1.5) won.push("Over 1.5 ✅");
  if (h > 0 && a > 0) won.push("BTTS Oui ✅");
  if (won.length) lines.push(`  → DÉJÀ GAGNÉS : ${won.join(", ")} — ne propose pas leurs opposés.`);

  // ── Marchés déjà perdus
  const lost = [];
  if (total > 3.5) lost.push("Under 3.5 ❌");
  if (total > 2.5) lost.push("Under 2.5 ❌");
  if (total > 1.5) lost.push("Under 1.5 ❌");
  if (h > 0 && a > 0) lost.push("BTTS Non ❌");
  if (lost.length) lines.push(`  → DÉJÀ PERDUS — ne PAS recommander : ${lost.join(", ")}`);

  // ── Over 2.5 faisabilité
  if (total < 3) {
    const need25 = 3 - total;
    if (need25 >= 3 && remaining <= 25) {
      lines.push(`  → Over 2.5 QUASI IMPOSSIBLE : ${need25} but(s) en ~${remaining} min → probabilité <5% → recommande Under 2.5.`);
    } else if (need25 >= 2 && remaining <= 20) {
      lines.push(`  → Over 2.5 TRÈS DIFFICILE : ${need25} but(s) en ~${remaining} min → Under 2.5 favori.`);
    } else if (need25 === 1 && remaining <= 12) {
      lines.push(`  → Over 2.5 : 1 but en ~${remaining} min — incertain, préfère Under 2.5.`);
    }
  }

  // ── Over 1.5 faisabilité
  if (total < 2) {
    const need15 = 2 - total;
    if (need15 >= 2 && remaining <= 15) {
      lines.push(`  → Over 1.5 QUASI IMPOSSIBLE : 2 buts en ~${remaining} min.`);
    } else if (need15 === 1 && remaining <= 8) {
      lines.push(`  → Over 1.5 : 1 but en ~${remaining} min — très serré.`);
    }
  }

  // ── Détection de massacre / domination totale
  const scoreDiff = Math.abs(h - a);
  if (scoreDiff >= 3 && total < 3) {
    lines.push(`  → ⚠️ DOMINATION TOTALE (${h}-${a}) : NE PAS recommander Under 2.5 — l'équipe dominante continue de marquer.`);
  } else if (scoreDiff >= 2 && minute <= 60) {
    lines.push(`  → ⚠️ ÉCART IMPORTANT (${h}-${a}) en ${minute}' : Under 2.5 est RISQUÉ — l'équipe en tête peut continuer à marquer. Préfère Over 2.5 ou Victoire.`);
  } else if (total >= 2 && minute <= 45) {
    lines.push(`  → ⚠️ MATCH OUVERT (${total} buts en ${minute}') : Under 2.5 RISQUÉ au rythme actuel. Préfère Over 2.5.`);
  }

  // ── Rythme de buts (extrapolation + recommandation)
  if (minute >= 30) {
    lines.push(`  → Rythme actuel : ${total} but(s) en ${minute}' → extrapolation : ~${projectedTotal} buts à 90'.`);
    if (projectedTotal >= 3.0 && total < 3) {
      lines.push(`  → ⚠️ PROJECTION HAUTE (${projectedTotal} buts) : Under 2.5 DANGEREUX → préfère Over 2.5 ou Victoire.`);
    } else if (projectedTotal < 2.0 && total < 3 && scoreDiff < 2) {
      lines.push(`  → PROJECTION FAIBLE (${projectedTotal} buts) : Over 2.5 peu probable → Under 2.5 favori.`);
    } else if (projectedTotal >= 2.5 && total < 3) {
      lines.push(`  → Projection compatible avec Over 2.5 (${projectedTotal} buts estimés).`);
    }
  }

  // ── BTTS faisabilité
  if (h === 0 && remaining <= 20) {
    lines.push(`  → BTTS Oui : ${match.home} n'a PAS marqué — risqué avec seulement ~${remaining} min restantes.`);
  }
  if (a === 0 && remaining <= 20) {
    lines.push(`  → BTTS Oui : ${match.away} n'a PAS marqué — risqué avec seulement ~${remaining} min restantes.`);
  }

  // ── Résultat 1X2 en fin de match
  if (minute >= 75) {
    if (h > a) lines.push(`  → ${match.home} mène ${h}-${a} à la ${minute}' : Victoire domicile TRÈS PROBABLE. Retournement <8%.`);
    else if (a > h) lines.push(`  → ${match.away} mène ${a}-${h} à la ${minute}' : Victoire extérieur TRÈS PROBABLE. Retournement <8%.`);
    else lines.push(`  → 0-0 ou égalité à la ${minute}' : Match nul probable (~45%) ou but décisif dans ~${remaining} min.`);
  }

  lines.push("  → PRIORISE ces contraintes LIVE sur toute stat pré-match. Ne recommande PAS un marché mathématiquement contraire.");
  return lines.join("\n");
}

// ── Lecture tolerante de la reponse d'un agent (07/08/2026) ──────────────────
// Deuxieme cause des votes perdus, apres les comptes morts : les logs montrent
// des erreurs JSON sur Mistral, Cohere et Perplexity. JSON.parse() exigeait un
// objet parfait ; un modele qui ecrit une phrase avant, ferme mal une accolade
// ou s'arrete a max_tokens voyait tout son travail jete.
//
// On recupere le vote dans cet ordre, du plus fiable au plus permissif :
//   1. JSON strict
//   2. premier objet {...} equilibre trouve dans le texte
//   3. objet tronque, referme artificiellement
//   4. extraction des champs a la regex, en dernier recours
// Un vote imparfaitement formate reste un vote ; le jeter cassait le quorum.
function lireReponseAgent(brut) {
  const t = String(brut || "").replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  if (!t) return null;
  const valide = (o) => (o && typeof o === "object" && typeof o.bet === "string" && o.bet.trim()) ? o : null;

  try { const o = valide(JSON.parse(t)); if (o) return o; } catch (e) { /* on continue */ }

  // Premier objet equilibre : ignore un preambule et un epilogue en texte.
  // Le repli regex plus bas doit rester atteignable meme sans aucune accolade —
  // un modele peut repondre "bet: ..." en texte libre, et ce vote est valide.
  const debut = t.indexOf("{");
  let profondeur = 0, dansTexte = false, echappe = false;
  if (debut !== -1) {
  for (let i = debut; i < t.length; i++) {
      const c = t[i];
      if (echappe) { echappe = false; continue; }
      if (c === "\\") { echappe = true; continue; }
      if (c === '"') { dansTexte = !dansTexte; continue; }
      if (dansTexte) continue;
      if (c === "{") profondeur++;
      else if (c === "}") {
        profondeur--;
        if (profondeur === 0) {
          try { const o = valide(JSON.parse(t.slice(debut, i + 1))); if (o) return o; } catch (e) { /* on continue */ }
          break;
        }
      }
    }
  }

  // Objet tronque (max_tokens atteint) : on referme ce qui est ouvert.
  if (debut !== -1 && profondeur > 0) {
    let essai = t.slice(debut).replace(/,\s*$/, "");
    if (dansTexte) essai += '"';
    essai += "}".repeat(profondeur);
    try { const o = valide(JSON.parse(essai)); if (o) return o; } catch (e) { /* on continue */ }
  }

  // Dernier recours : les champs a la regex. On ne fabrique rien — si "bet"
  // est absent du texte, on renvoie null et l'agent est compte comme muet.
  const mBet = t.match(/"?bet"?\s*[:=]\s*"([^"\n]{2,60})"/i);
  if (!mBet) return null;
  const mConf = t.match(/"?confidence"?\s*[:=]\s*"?(\d{1,3})/i);
  const mRaison = t.match(/"?raison"?\s*[:=]\s*"([^"]{0,300})"/i);
  const mMarches = t.match(/"?marches"?\s*[:=]\s*(\{[^}]*\})/i);
  let marches = null;
  if (mMarches) { try { marches = JSON.parse(mMarches[1]); } catch (e) { marches = null; } }
  return {
    bet: mBet[1].trim(),
    confidence: mConf ? Number(mConf[1]) : null,
    raison: mRaison ? mRaison[1] : "",
    ...(marches ? { marches } : {}),
    _recupere: true,
  };
}

// ── Disjoncteur des fournisseurs directs (07/08/2026) ────────────────────────
// Preuve apportee par la telemetrie : 169 appels IA en 48h pour seulement 37
// votes. Les logs montrent Perplexity 401 (cle invalide), Cohere 429 (quota),
// DeepSeek 402 (solde insuffisant). Ces comptes directs sont morts depuis la
// consolidation OpenRouter du 04/08, mais ils restaient dans la liste des
// fournisseurs : quand le garde-fou budgetaire refusait OpenRouter, l'agent
// tombait sur un compte mort et ne votait pas.
//
// On memorise l'echec en base : un fournisseur qui renvoie 401, 402 ou 403
// (probleme de compte, pas de charge) est ecarte 24h. Un 429 (quota) est
// ecarte 6h, le temps que la fenetre glisse. Aucune cle n'est supprimee : le
// jour ou Greg recharge un compte, il redevient utilisable tout seul.
db.exec(`
  CREATE TABLE IF NOT EXISTS provider_health (
    host TEXT PRIMARY KEY,
    last_status INTEGER,
    last_error TEXT DEFAULT '',
    disabled_until TEXT DEFAULT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

const _providerHealthCache = { at: 0, hs: {} };
function providerEcarte(host) {
  if (!host) return false;
  if (Date.now() - _providerHealthCache.at > 60000) {
    try {
      const rows = db.prepare("SELECT host, disabled_until FROM provider_health WHERE disabled_until IS NOT NULL").all();
      _providerHealthCache.hs = Object.fromEntries(rows.map(r => [r.host, r.disabled_until]));
      _providerHealthCache.at = Date.now();
    } catch (e) { return false; }
  }
  const jusqua = _providerHealthCache.hs[host];
  return !!jusqua && new Date(jusqua.replace(" ", "T") + "Z").getTime() > Date.now();
}
function marquerProvider(host, status, detail) {
  if (!host) return;
  // 401/402/403 = le compte est en cause, ca ne se repare pas tout seul → 24h.
  // 429 = charge ou quota glissant → 6h suffisent.
  const heures = [401, 402, 403].includes(status) ? 24 : status === 429 ? 6 : 0;
  if (!heures) return;
  try {
    db.prepare(`INSERT INTO provider_health (host, last_status, last_error, disabled_until, updated_at)
                VALUES (?,?,?, datetime('now', ?), datetime('now'))
                ON CONFLICT(host) DO UPDATE SET last_status=excluded.last_status,
                  last_error=excluded.last_error, disabled_until=excluded.disabled_until,
                  updated_at=excluded.updated_at`)
      .run(host, status, String(detail || "").slice(0, 140), `+${heures} hours`);
    _providerHealthCache.at = 0;
    console.error(`[provider-health] ${host} ecarte ${heures}h — HTTP ${status}`);
  } catch (e) { /* jamais bloquant */ }
}
function hoteDuProvider(pv) {
  return pv?.kind === "cohere" ? "api.cohere.com" : String(pv?.url || "").split("/")[2] || String(pv?.kind || "");
}

async function runConcileAnalysis(match) {
  // Plafond de replis de secours pour CETTE analyse (5 agents = 5 maximum).
  // Empeche qu'un incident fournisseur transforme une analyse en rafale
  // d'appels payants, meme sous le plafond journalier.
  let _secoursCetteAnalyse = 0;
  const SECOURS_MAX_PAR_ANALYSE = 5;
  if (!GROQ_API_KEY) {
    return getMockAnalysis(match);
  }

  const neutralNote = isNeutralComp(match.competition)
    ? "\n⚠️ TERRAIN NEUTRE — ne PAS mentionner l'avantage domicile, il n'existe pas dans cette compétition."
    : "";
  const sport = String(match.sport || "Football");
  const sportNote = sport !== "Football"
    ? `\nSport: ${sport}` : "";
  const sportRules = sport === "Basketball"
    ? "\nRègle sport: basket — privilégier moneyline/vainqueur et handicap prudent; éviter les gros over/under points sauf données très solides."
    : sport === "Hockey"
      ? "\nRègle sport: hockey — privilégier vainqueur/double chance; over/under seulement si rythme et tirs sont très solides."
      : sport === "Baseball"
        ? "\nRègle sport: baseball — privilégier moneyline/vainqueur; éviter les marchés joueurs ou exotiques au début."
        : "\nRègle sport: football — marchés autorisés: vainqueur, double chance, draw no bet, BTTS, over/under prudents, but équipe.";
  const liveConstraints = computeLiveConstraints(match);

  // Récupérer les statistiques live si disponibles (football uniquement)
  const isLiveMatch = match.status === "IN_PLAY" || match.status === "LIVE";
  const statsStatus = isLiveMatch
    ? await fetchMatchStatsForMatch(match)
    : buildStatsStatus(match, null, "match_not_live");
  const liveStats = statsStatus.available ? statsStatus.stats : null;
  const statsBlock = buildStatsBlock(liveStats, match.home, match.away);

  // H2H factuel + contexte profond (forme, classement, enjeu, blessés) en parallèle
  let h2hBlock = "", deepBlock = "", h2hData = null;
  try {
    const [h2h, deep] = await Promise.all([
      fetchH2H(match),
      fetchDeepContext(match),
    ]);
    h2hBlock = buildH2HBlock(h2h, match.home, match.away);
    deepBlock = deep || "";
    h2hData = h2h;
    if (h2h) console.log(`[concile] H2H récupéré ${match.home} vs ${match.away}: ${h2h.n} matchs, moy ${h2h.avgGoals} buts, Under2.5 ${h2h.under25Pct}%`);
  } catch (e) {
    console.error("[concile] H2H/deep:", e.message);
  }

  if (statsStatus.available) {
    console.log(`[concile] Stats live récupérées pour ${match.home} vs ${match.away} fixture=${statsStatus.fixtureId}`);
  } else {
    console.log(`[concile] Stats live indisponibles pour ${match.home} vs ${match.away}: ${statsStatus.reason}`);
  }

  // Pré-filtrer les paris impossibles du prompt
  const availableBets = computeAvailableBets(match);
  const estimatedMin = estimateMinute(match);
  const minuteDisplay = match.minute ? `${match.minute}'` : (estimatedMin > 0 ? `~${estimatedMin}' (estimé)` : "Pré-match");

  const recoveryPromptBlock = RECOVERY_MODE_ENABLED
    ? `\n\nMODE RECOVERY — sortie client uniquement si : championnat autorise, historique recent complet, moyenne Over >= 2.80 ou Under <= 2.20, au moins 3 indicateurs convergents, confirmation live, absences disponibles, confiance >= 78 et au moins 4 votes concordants sur 5. En cas de doute, ne force jamais la confiance.`
    : "";
  const matchContext = `Match: ${match.home} vs ${match.away}
Compétition: ${match.competition || "International"}${sportNote}
Score actuel: ${match.score_home ?? "?"}-${match.score_away ?? "?"}
Minute: ${minuteDisplay}
Statut: ${match.status}${neutralNote}${sportRules}${statsBlock}${h2hBlock}${deepBlock}${liveConstraints}${recoveryPromptBlock}

IMPORTANT — Paris AUTORISÉS dans ce contexte (les seuls disponibles mathématiquement) :
→ ${availableBets.join(", ")}
Tu DOIS choisir UNIQUEMENT parmi cette liste. Tout autre marché est mathématiquement invalide.`;

  // Delai d'attente accorde a chaque agent du Concile. 3,5 s etait bien trop
  // court : les agents tournent en parallele (Promise.all), donc ce delai ne
  // coute que le temps du PLUS LENT, pas la somme des cinq. A 3,5 s, les modeles
  // naturellement lents expiraient en silence — mesure sur 7 jours : Qwen 85 %
  // de votes vides, Perplexity 81 % (il fait une recherche web avant de
  // repondre), Mistral-Large 61 %, contre 36 % pour DeepSeek et Cohere, les plus
  // rapides. Consequence : 69 % des analyses avaient moins de 3 votes, donc une
  // confiance forcee a 55 et aucune diffusion possible.
  const AGENT_TIMEOUT_MS = Math.max(45000, Number(process.env.AGENT_TIMEOUT_MS || 45000));

  // Concile v3 — 5 familles d'IA radicalement différentes + Chief
  // Agent 0 : Perplexity-Web  → accès web temps réel (forme, blessures, H2H)
  // Agent 1 : DeepSeek-V3     → contrarian (architecture chinoise, entraînement différent)
  // Agent 2 : Mistral-Large   → modèle européen (architecture MoE, ≠ Llama/GPT)
  // Agent 3 : Cohere-Command  → spécialiste RAG/données structurées (architecture ≠ tout le reste)
  // Agent 4 : Kimi            → synthese quantitative (remplace Qwen, 0/26 votes)
  // Agent 5 : Chief           → arbitre Llama-70b (Groq, rapide)
  const usePerplexity = !!PERPLEXITY_API_KEY;
  const useMistral    = !!MISTRAL_API_KEY;
  const useCohere     = !!COHERE_API_KEY;
  const useOpenRouter = !!OPENROUTER_API_KEY;

  const agentNames = [
    {
      name: "Perplexity-Web",
      model: usePerplexity ? "sonar-pro" : "llama-3.3-70b-versatile",
      icon: "🌐",
      usePerplexity,
    },
    { name: "DeepSeek-V3", model: "deepseek-chat", icon: "🔮", useDeepseek: true },
    {
      name: "Mistral-Large",
      model: useMistral ? "mistral-large-latest" : "llama-3.3-70b-versatile",
      icon: "🌊",
      useMistral,
    },
    {
      name: "Qwen-3.7-Max",
      // "command-r-plus" a ete retire par Cohere le 15/09/2025 (HTTP 404 constate
      // le 29/07/2026). command-r-plus-08-2024 est le modele equivalent toujours
      // actif, verifie via /v1/models sur la cle en production.
      model: resolveModel(process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max"),
      icon: "🧬",
      useOpenRouter: true,
      openRouterModelKey: "qwen",
    },
    {
      name: "OpenRouter-Qwen",
      model: resolveModel(process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max"),
      icon: "🌟",
      useOpenRouter,
      openRouterModelKey: "qwen",
    },
    { name: "Claude Chief", model: "llama-3.3-70b-versatile", icon: "👑" },
  ];
  const CHIEF_INDEX = agentNames.length - 1;
  const AGENT_INDEXES = agentNames.map((_, i) => i).filter(i => i !== CHIEF_INDEX);

  const webSearchNote = usePerplexity
    ? `\nATTENTION : tu as accès aux données web en temps réel. Cherche impérativement : forme récente de ${match.home} et ${match.away} (5 derniers matchs), blessures confirmées, confrontations directes récentes, et cotes actuelles chez les bookmakers. Cite tes sources. N'invente RIEN.`
    : "";

  const personas = [
    `Tu es Perplexity-Web, agent data temps réel.${webSearchNote} Mission : apporter des FAITS vérifiés sur ${match.home} vs ${match.away}. Recherche impérativement : classement actuel des deux équipes dans leur championnat (top 5 / milieu / bottom 5), forme sur les 5 derniers matchs, blessures majeures confirmées, H2H récent avec moyenne de buts. Si tu n'as pas de données fiables, dis-le. Tu es le seul agent avec accès web — c'est ton avantage unique.`,

    `Tu es DeepSeek-V3, agent contrarian. Ton rôle est de CONTREDIRE l'intuition dominante sur ${match.home} vs ${match.away}. Critères clés à vérifier : une équipe en haut du classement en mauvaise forme récente (5 derniers matchs), fatigue/calendrier chargé, H2H qui contredit le classement, équipe en bas de tableau surperformante à domicile. N'accepte un pick que si tu as un argument basé sur des données — pas une intuition.`,

    `Tu es Mistral-Large, expert tactique européen. Analyse ${match.home} vs ${match.away} avec : 1) Position au classement et écart entre les deux équipes, 2) Force défensive vs offensive (buts marqués/encaissés par match), 3) Bilan domicile vs extérieur spécifique, 4) Moyenne de buts des H2H pour Under/Over. Top 4 vs Bottom 5 à domicile = signal fort. Raisonne : données → conclusion.`,

    `Tu es Qwen-3.7-Max, spécialiste quantitatif exclusivement Over/Under 2,5. Pour ${match.home} vs ${match.away} : 1) Identifie le marché avec la meilleure value en croisant classement + forme + H2H, 2) Si les deux équipes ont une moyenne < 2.0 buts/match ET les H2H sont majoritairement Under = Under très probable, 3) Si écart > 10 places au classement + forme alignée = ML probable. Raisonne en probabilités, évite les marchés surpricés.`,

    `Tu es OpenRouter-Qwen, agent de synthèse quantitative. Ta mission sur ${match.home} vs ${match.away} est de croiser le score live, la dynamique du match, les écarts de niveau et les marchés autorisés pour détecter le signal le plus robuste. Tu dois challenger les autres agents avec une lecture froide des probabilités, sans inventer de données absentes.`,

    `Tu es Claude Chief, arbitre du Concile v3. Tu reçois 5 votes d'IA. Critères de décision par ordre de poids : 1) Classement + écart de niveau (30%), 2) Forme récente 5 matchs (25%), 3) H2H + moyenne buts (15%), 4) Facteur dom/ext (15%), 5) Moyenne buts/match (10%), 6) Cotes/value (5%). Ne valide que si au moins 2 critères forts sont alignés. NOPICK si les signaux sont contradictoires. Mieux vaut 0 pick qu'un mauvais pick.

RÈGLE CHAMPION : le marché "But en 1ère mi-temps" a un winrate historique prouvé de 82% (931 pronos vérifiés). À qualité égale (écart de confiance ≤ 5 points), tu DOIS privilégier ce marché sur les autres. Si un agent le vote avec confiance ≥ 75% et que ton propre pick est un autre marché avec confiance équivalente, aligne-toi sur "But en 1ère mi-temps" — c'est notre marché champion prouvé.`,
  ];

  // Charger les performances historiques pour pondérer le verdict du Chief
  const agentPerf = getAgentPerformance();
  const agentMarketPerf = getAgentMarketPerformance();
  const agentMarketCompPerf = getAgentMarketCompetitionPerformance();
  const MIN_MARKET_SAMPLE = 20; // sous ce seuil, le winrate marché est trop bruité — on retombe sur le winrate global
  const MIN_COMPETITION_SAMPLE = 15; // championnat : echantillon forcement plus petit, seuil plus bas mais toujours filtre

  const agentMarketList = []; // avis multi-marchés de chaque agent (hors Chief)

  // Helper: run a single agent and return its result
  async function runSingleAgent(i) {
    const isChief = i === CHIEF_INDEX;
    const agCfg = agentNames[i];
    const temp = 0.3 + i * 0.05;
    const maxTok = isChief ? 400 : 300;

    const prompt = `${personas[i]}

${matchContext}

En te basant sur tes connaissances des équipes ET les données live ci-dessus, recommande la meilleure analyse.
Tu DOIS choisir parmi cette liste uniquement : ${availableBets.join(", ")}

DIRECTIVE MARCHÉ :
- Under 2.5 buts UNIQUEMENT si le match est équilibré (écart de score 0-1) ET le rythme de buts est faible (projection < 2.5).
- INTERDIT de recommander Under 2.5 si : écart >= 2 buts OU 2+ buts marqués avant la 45' OU une équipe domine clairement.
- Si l'écart est large (2+), préfère Over 2.5 ou Victoire de l'équipe dominante.
- Respecte impérativement les CONTRAINTES MATHÉMATIQUES LIVE ci-dessous.

⚠️ CONFIANCE ARGUMENTÉE — INTERDICTION du 70% générique :
- Ta "confidence" DOIT refléter la force réelle des données, pas une valeur ronde par défaut.
- Base-la explicitement sur : la forme récente des 2 équipes, l'historique des confrontations directes (H2H), les blessés/absents connus (uniquement si tu en es sûr), l'enjeu (place à gagner/à défendre au classement), le contexte (domicile/extérieur, terrain neutre), et les stats live ci-dessus.
- Peu de signaux concordants → confiance basse (50-62). Signaux forts et convergents → confiance haute (78-90). N'utilise 70 QUE si c'est réellement le calcul, jamais par facilité.
- La "raison" DOIT citer au moins 2 données concrètes distinctes (ex: "3 des 5 derniers H2H sous 2.5 buts, + attaque extérieure à 0.9 but/match") — pas de phrase vague type "analyse basée sur le rythme".

Donne AUSSI ton avis rapide sur chaque marché (objet "marches", codes courts + confiance 40-90) :
- buts: "o2.5" (plus de 2.5) ou "u2.5" (moins de 2.5)
- ou05: "o0.5" (plus de 0.5, au moins 1 but) ou "u0.5" (0 but, 0-0)
- ou15: "o1.5" (plus de 1.5) ou "u1.5" (moins de 1.5)
- btts: "oui" ou "non" (les deux équipes marquent)
- resultat: "dom", "ext" ou "nul"
- mt1: "oui" ou "non" (au moins un but en 1ère mi-temps, les deux équipes confondues)
- mt1_dom: "oui" ou "non" (${match.home} marque en 1ère mi-temps)
- mt1_ext: "oui" ou "non" (${match.away} marque en 1ère mi-temps)
- mt2: "oui" ou "non" (au moins un but en 2ème mi-temps, les deux équipes confondues)
- mt2_dom: "oui" ou "non" (${match.home} marque en 2ème mi-temps)
- mt2_ext: "oui" ou "non" (${match.away} marque en 2ème mi-temps)

Réponds en JSON pur (pas de markdown):
{
  "bet": "un parmi: ${availableBets.join(", ")}",
  "confidence": <nombre 50-90 argumenté, PAS 70 par défaut>,
  "raison": "<2 phrases avec au moins 2 données chiffrées concrètes (forme, H2H, blessés, enjeu, stats)>",
  "marches": {"buts":{"p":"o2.5","c":70},"ou05":{"p":"o0.5","c":80},"ou15":{"p":"o1.5","c":75},"btts":{"p":"oui","c":60},"resultat":{"p":"dom","c":65},"mt1":{"p":"oui","c":55},"mt1_dom":{"p":"oui","c":58},"mt1_ext":{"p":"non","c":52},"mt2":{"p":"oui","c":65},"mt2_dom":{"p":"oui","c":60},"mt2_ext":{"p":"non","c":50}}
}`;

    try {
      let providers = [];
      // Cle anti-doublon/budget partagee par TOUS les repli OpenRouter de cet
      // agent (voir analysis_engine.js) — doit exister avant le premier appel
      // au garde-fou, pas seulement avant les replis du bas de liste : c'est
      // l'absence de cette garde sur les deux appels ci-dessous (Perplexity et
      // Qwen "titulaires") qui a vide le budget OpenRouter le 29-30/07/2026.
      // La cle anti-doublon du garde-fou budgetaire doit inclure l'ETAT du match,
      // pas seulement les equipes. Sans cela, la 2e analyse d'un match en direct
      // (l'auto-concile repasse toutes les 6 minutes, le score ayant evolue)
      // etait refusee comme "deja traite aujourd'hui" : OpenRouter etait bloque
      // et le systeme se rabattait sur les comptes directs — Cohere (quota
      // d'essai epuise), Perplexity (cle invalide), DeepSeek (solde nul). Plus
      // aucun agent ne votait, la confiance tombait a 55% (absence de consensus)
      // et AUCUN signal ne partait. Diagnostique le 06/08/2026 apres deux jours
      // sans diffusion, alors que le budget n'etait qu'a 1,03 EUR sur 3.
      //
      // On garde la protection anti-boucle : le score et une tranche de 15
      // minutes suffisent a distinguer deux etats reellement differents, tout en
      // bloquant un worker qui rappellerait le meme instant en rafale.
      const _stateTag = [
        match.score_home ?? "x",
        match.score_away ?? "x",
        Math.floor(Number(match.minute || 0) / 15),
      ].join("-");
      const _fallbackMatchKey = `${match.home || "?"}_${match.away || "?"}_${_stateTag}`;
      const _fallbackCompetition = match.competition || match.league || "";
      // Consolidation OpenRouter du 04/08/2026 (decision du fondateur) :
      // Perplexity, DeepSeek, Mistral et Cohere avaient chacun leur propre
      // compte direct, invisible et non budgete — resultat, les 4 sont tombes
      // en panne le meme jour (cle expiree, solde a zero, quota d'essai
      // epuise, rate-limit) sans que rien ne le signale a l'avance. Chacun
      // passe maintenant par OpenRouter EN PREMIER, sous le meme garde-fou
      // budgetaire (2€/jour, tous agents confondus) — un seul compte a
      // surveiller et recharger au lieu de cinq.
      if (agCfg.name === "Perplexity-Web" && OPENROUTER_API_KEY
          && analysisEngine.allowOfficialOpenRouterFallback(db, { agentLabel: agCfg.name, matchKey: _fallbackMatchKey, competition: _fallbackCompetition, modelKey: "perplexity" })) {
        providers.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: resolveModel("perplexity/sonar-pro") });
      }
      if (agCfg.name === "DeepSeek-V3" && OPENROUTER_API_KEY
          && analysisEngine.allowOfficialOpenRouterFallback(db, { agentLabel: agCfg.name, matchKey: _fallbackMatchKey, competition: _fallbackCompetition, modelKey: "deepseek" })) {
        providers.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: resolveModel("deepseek/deepseek-chat") });
      }
      if (agCfg.name === "Mistral-Large" && OPENROUTER_API_KEY
          && analysisEngine.allowOfficialOpenRouterFallback(db, { agentLabel: agCfg.name, matchKey: _fallbackMatchKey, competition: _fallbackCompetition, modelKey: "mistral" })) {
        providers.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: resolveModel(process.env.OR_MISTRAL_MODEL || "mistralai/mistral-small-2603") });
      }
      if (agCfg.name === "Qwen-3.7-Max" && OPENROUTER_API_KEY
          && analysisEngine.allowOfficialOpenRouterFallback(db, { agentLabel: agCfg.name, matchKey: _fallbackMatchKey, competition: _fallbackCompetition, modelKey: "qwen" })) {
        providers.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: resolveModel(process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max") });
      }
      // Agent titulaire OpenRouter (Kimi depuis le 26/08/2026) : meme
      // garde-fou budgetaire que les 4 agents ci-dessus.
      if (agCfg.useOpenRouter && OPENROUTER_API_KEY
          && analysisEngine.allowOfficialOpenRouterFallback(db, { agentLabel: agCfg.name, matchKey: _fallbackMatchKey, competition: _fallbackCompetition, modelKey: agCfg.openRouterModelKey || "qwen" })) {
        providers.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: agCfg.model });
      }
      // Comptes directs gardes en repli SEULEMENT si OpenRouter a refuse
      // (budget/quota du jour atteint) ou echoue — utiles si un jour
      // re-alimentes, mais plus le chemin principal.
      if (agCfg.useDeepseek && DEEPSEEK_API_KEY) providers.push({ kind: "openai", url: "https://api.deepseek.com/v1/chat/completions", key: DEEPSEEK_API_KEY, model: agCfg.model });
      if (agCfg.usePerplexity && PERPLEXITY_API_KEY) providers.push({ kind: "openai", url: "https://api.perplexity.ai/chat/completions", key: PERPLEXITY_API_KEY, model: agCfg.model });
      if (agCfg.useMistral && MISTRAL_API_KEY) providers.push({ kind: "openai", url: "https://api.mistral.ai/v1/chat/completions", key: MISTRAL_API_KEY, model: agCfg.model });
      if (agCfg.useCohere && COHERE_API_KEY) providers.push({ kind: "cohere", key: COHERE_API_KEY, model: agCfg.model });
      // Ne jamais faire voter un agent officiel sous un autre modèle générique :
      // cinq libellés utilisant le même Llama ne sont pas cinq avis indépendants.
      // Les replis OpenRouter ci-dessous conservent un modèle identifié par agent.
      // Repli OpenRouter sous garde-fou budget/anti-doublon/coupe-circuit (voir
      // analysis_engine.js). Chemin rare : n'intervient que si l'agent n'a ni
      // fournisseur officiel dédié, ni DeepSeek/Mistral/Groq partagés disponibles.
      if (!providers.length && OPENROUTER_API_KEY
          && analysisEngine.allowOfficialOpenRouterFallback(db, { agentLabel: agCfg.name, matchKey: _fallbackMatchKey, competition: _fallbackCompetition, modelKey: "qwen" })) {
        providers.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max" });
      }
      if (!providers.length && OPENROUTER_API_KEY
          && analysisEngine.allowOfficialOpenRouterFallback(db, { agentLabel: agCfg.name, matchKey: _fallbackMatchKey, competition: _fallbackCompetition, modelKey: "kimi" })) {
        providers.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: process.env.OR_KIMI_MODEL || "moonshotai/kimi-k2" });
      }
      if (!providers.length && CEREBRAS_API_KEY) providers.push({ kind: "openai", url: "https://api.cerebras.ai/v1/chat/completions", key: CEREBRAS_API_KEY, model: "llama-3.3-70b" });

      // Ecarte les fournisseurs dont le compte est en panne (401/402/403/429).
      // Sans ce filtre, un agent tombait sur un compte mort et ne votait pas,
      // alors qu'OpenRouter etait disponible juste a cote.
      const _avantFiltre = providers.length;
      providers = providers.filter(pv => !providerEcarte(hoteDuProvider(pv)));
      // Filet quand tous les fournisseurs de l'agent ont ete ecartes. Il passe
      // par le MEME garde-fou que les autres replis (budget journalier,
      // anti-doublon par match/agent, coupe-circuit) — jamais en le contournant.
      //
      // Premiere version ecrite le 07/08/2026 : elle poussait le repli sans
      // garde-fou, "parce que quelques centimes valent mieux qu'un agent muet".
      // C'etait faux sur deux points, releves en relecture. D'une part les
      // appels echappaient a la comptabilite du budget, donc le plafond
      // journalier devenait contournable en silence. D'autre part l'anti-doublon
      // par match et par agent sautait avec lui.
      //
      // Le disjoncteur au-dessus retire deja les comptes morts : si le garde-fou
      // refuse ici, c'est que le budget est atteint, et un agent silencieux est
      // alors le comportement voulu, pas une panne.
      // Repli de secours : uniquement quand des fournisseurs directs ont ete
      // ECARTES par provider_health (401/402/403/429), pas quand l'agent n'en
      // avait simplement aucun. Il franchit le seul coupe-circuit "spike" —
      // budget quotidien, anti-doublon et duplicate_burst restent opposables —
      // et il est plafonne a 5 par analyse et 60 par jour.
      if (!providers.length && OPENROUTER_API_KEY && _avantFiltre > 0) {
        if (_secoursCetteAnalyse >= SECOURS_MAX_PAR_ANALYSE) {
          console.warn(`[concile] ${agCfg.name} : plafond de ${SECOURS_MAX_PAR_ANALYSE} replis atteint pour cette analyse — agent silencieux`);
        } else {
          const _cleSecours = (MODELE_DES_AGENTS[agCfg.name] || "mistralai/mistral-large").split("/")[0];
          if (analysisEngine.allowFallbackAfterProviderDown(db, {
                agentLabel: agCfg.name, matchKey: _fallbackMatchKey,
                competition: _fallbackCompetition, modelKey: _cleSecours })) {
            _secoursCetteAnalyse++;
            providers.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions",
                             key: OPENROUTER_API_KEY, model: resolveModel(MODELE_DES_AGENTS[agCfg.name] || "mistralai/mistral-large") });
            console.log(`[concile] ${agCfg.name} : ${_avantFiltre} fournisseur(s) ecarte(s), repli OpenRouter autorise (${_secoursCetteAnalyse}/${SECOURS_MAX_PAR_ANALYSE} pour cette analyse)`);
          } else {
            console.warn(`[concile] ${agCfg.name} : ${_avantFiltre} fournisseur(s) ecarte(s), repli refuse — agent silencieux`);
          }
        }
      } else if (!providers.length && OPENROUTER_API_KEY) {
        console.warn(`[concile] ${agCfg.name} : aucun fournisseur configure et aucun ecarte — pas de repli de secours`);
      }

      let raw = "{}";
      let lastDiag = "aucun fournisseur configure";
      // Telemetrie : une ligne par tentative, avec sa duree reelle. C'est la
      // seule facon de trancher entre "timeout trop court" et "autre cause"
      // sans dependre des logs Docker, qui disparaissent a chaque rebuild.
      let _dernierAppelId = null;
      const tracerAppel = (pv, i, t0, issue, status, detail) => {
        try {
          const r = db.prepare(`INSERT INTO agent_calls
            (match_key, agent_name, model, host, sport, competition, minute,
             tentative, debut_at, duree_ms, http_status, issue, detail, repli)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
              _fallbackMatchKey, agCfg.name, String(pv?.model || ""),
              pv?.kind === "cohere" ? "api.cohere.com" : String(pv?.url || "").split("/")[2] || String(pv?.kind || ""),
              String(match.sport || "Football"), String(match.competition || match.league || ""),
              parseLiveMinuteValue(match.minute) ?? null,
              i + 1, new Date(t0).toISOString(), Date.now() - t0,
              status ?? null, issue, String(detail || "").slice(0, 180), i > 0 ? 1 : 0);
          _dernierAppelId = r.lastInsertRowid;
        } catch (e) { /* la telemetrie ne doit jamais casser une analyse */ }
      };
      // Trace si l'appel a reellement produit un vote — distinct de "a repondu".
      const tracerVote = (aVote) => {
        if (!_dernierAppelId) return;
        try { db.prepare("UPDATE agent_calls SET vote_produit = ? WHERE id = ?").run(aVote ? 1 : 0, _dernierAppelId); }
        catch (e) { /* jamais bloquant */ }
      };
      for (const [pvIndex, pv] of providers.entries()) {
        const _t0 = Date.now();
        try {
          let resp;
          if (pv.kind === "cohere") {
            // v1/chat (api.cohere.ai) est retiree : HTTP 404 constate le 29/07/2026,
            // quel que soit le modele demande. v2/chat (api.cohere.com) est l'API
            // active ; format de requete et de reponse tous deux differents (messages
            // OpenAI-like en entree, message.content[] en sortie, pas de champ "text").
            resp = await httpPost("https://api.cohere.com/v2/chat", { model: pv.model, messages: [{ role: "user", content: prompt }], max_tokens: maxTok, temperature: temp }, { Authorization: `Bearer ${pv.key}` }, AGENT_TIMEOUT_MS);
            raw = resp.message?.content?.[0]?.text || resp.text || "{}";
          } else {
            resp = await httpPost(pv.url, { model: pv.model, messages: [{ role: "user", content: prompt }], temperature: temp, max_tokens: maxTok }, { Authorization: `Bearer ${pv.key}` }, AGENT_TIMEOUT_MS);
            raw = resp.choices?.[0]?.message?.content || "{}";
          }
          const probe = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          if (probe && probe !== "{}" && probe.length > 8) {
            lastDiag = null;
            tracerAppel(pv, pvIndex, _t0, "ok", resp?._httpStatus ?? 200, `${probe.length} caracteres`);
            break;
          }
          // Reponse HTTP recue sans exception, mais sans contenu exploitable —
          // diagnostic precis a partir des marqueurs poses par httpPost() plutot
          // que de deviner "timeout" par defaut (constate le 04/08/2026 : la
          // quasi-totalite des votes echouaient et le message generique empechait
          // de savoir si c'etait un vrai timeout ou une cle/quota en erreur).
          const pvHost = pv.kind === "cohere" ? "api.cohere.com" : (pv.url || "").split("/")[2] || pv.kind;
          lastDiag = resp?._httpTimedOut ? `timeout ${AGENT_TIMEOUT_MS}ms (${pvHost})`
            : resp?._httpStatus ? `HTTP ${resp._httpStatus} (${pvHost}) — ${JSON.stringify(resp).slice(0, 200)}`
            : resp?._httpParseError ? `reponse illisible (${pvHost}): ${resp._raw}`
            : `reponse sans contenu exploitable (${pvHost})`;
          tracerAppel(pv, pvIndex, _t0,
            resp?._httpTimedOut ? "timeout"
              : resp?._httpStatus && resp._httpStatus >= 400 ? "http_erreur"
              : resp?._httpParseError ? "illisible" : "vide",
            resp?._httpStatus, lastDiag);
          if (resp?._httpStatus) marquerProvider(pvHost, resp._httpStatus, lastDiag);
        } catch (e) {
          const pvHost = pv.kind === "cohere" ? "api.cohere.com" : (pv.url || "").split("/")[2] || pv.kind;
          lastDiag = `erreur reseau (${pvHost}): ${e.message}`;
          tracerAppel(pv, pvIndex, _t0, "reseau", null, e.message);
          console.error(`[concile] ${agCfg.name} fournisseur échec: ${e.message}`);
        }
      }
      // Lecture tolerante : voir lireReponseAgent(). JSON.parse() strict jetait
      // des votes valides pour un simple defaut de format.
      const parsed = lireReponseAgent(raw);
      if (parsed && parsed._recupere) {
        console.log(`[concile] ${agCfg.name} : vote recupere sur une reponse mal formatee`);
      }

      const modelGaveBet = parsed && typeof parsed.bet === "string" && parsed.bet.trim().length > 0;
      tracerVote(modelGaveBet);
      if (!modelGaveBet) {
        console.error(`[concile] agent ${agCfg.name} : aucun vote exploitable — ${lastDiag || "raison inconnue"}`);
        return {
          name: agCfg.name, icon: agCfg.icon,
          bet: "—", confidence: null,
          raison: "⚠️ Agent sans réponse exploitable dans le délai imparti — non compté dans le verdict.",
          isChief: false, failed: true,
        };
      }

      const rawBet = parsed.bet || availableBets[0];
      if (parsed.marches && typeof parsed.marches === "object") {
        agentMarketList.push({ name: agCfg.name, marches: parsed.marches });
      }
      const { bet: validBet, corrected, original } = validateAndCorrectBet(rawBet, match, availableBets);
      const fallbackRaison = `Score actuel ${match.score_home}-${match.score_away}, analyse basée sur le rythme du match.`;
      const raisonFinal = corrected
        ? `[Corrigé: "${original}" → "${validBet}"] ${parsed.raison || fallbackRaison}`
        : (parsed.raison && parsed.raison.length > 10 ? parsed.raison : fallbackRaison);

      return {
        name: agCfg.name, icon: agCfg.icon,
        bet: validBet,
        confidence: Math.min(95, Math.max(50, isNaN(parseInt(parsed.confidence)) ? 55 : parseInt(parsed.confidence))),
        raison: raisonFinal,
        isChief: false, corrected: corrected || false,
      };
    } catch (e) {
      // Ne JAMAIS remplacer un echec de parsing par un vote invente
      // (getMockAgentAnalysis produit un pari heuristique + une confiance
      // aleatoire 60-85, qui entrait auparavant dans le consensus comme si
      // c'etait un vrai avis de l'IA). Constate le 02/08/2026 sur
      // Perplexity-Web : JSON tronque/mal forme regulierement (reponse
      // coupee par max_tokens), chaque echec injectait silencieusement un
      // faux vote dans "5 IA independantes votent". Meme traitement que
      // l'absence de reponse exploitable : exclu du decompte, jamais invente.
      console.error(`[concile] agent ${agCfg.name} erreur JSON:`, e.message);
      return {
        name: agCfg.name, icon: agCfg.icon,
        bet: "—", confidence: null,
        raison: "⚠️ Réponse illisible (JSON malformé) — non compté dans le verdict.",
        isChief: false, failed: true,
      };
    }
  }

  // Phase 1: Run 5 agents IN PARALLEL (not sequentially)
  const agentResults = await Promise.all(AGENT_INDEXES.map(i => runSingleAgent(i)));

  // Phase 2: Run Chief AFTER, with all agent votes available
  // Filter weak agents (winrate < 52% AND resolved >= 30 predictions)
  const benchedAgents = [];
  const activedAgentResults = agentResults.filter((a) => {
    if (a.failed) return false;
    const p = agentPerf[a.name];
    const resolved = p ? p.resolved : 0;
    const winrate = p ? p.winrate : null;
    if (resolved >= 30 && winrate !== null && winrate < 52) {
      benchedAgents.push(`${a.name} (${winrate}% sur ${resolved})`);
      return false; // Filter out
    }
    return true; // Keep
  });

  // Log benched agents for debugging
  if (benchedAgents.length > 0) {
    console.log(`[concile] Benched agents (winrate < 52%, resolved >= 30): ${benchedAgents.join(", ")}`);
  }

  const previousVotes = activedAgentResults.map((a) => {
    const p = agentPerf[a.name];
    const resolved = p ? p.resolved : 0;
    const line = marketLineForBet(a.bet);
    // Cascade a 3 niveaux, du plus precis au plus general : championnat >
    // marche > historique global. On ne descend au niveau suivant que si
    // l'echantillon du niveau precedent est trop mince pour etre fiable.
    const compStat = line && match.competition ? agentMarketCompPerf[a.name]?.[line]?.[match.competition] : null;
    const useComp = compStat && compStat.total >= MIN_COMPETITION_SAMPLE;
    const marketStat = line ? agentMarketPerf[a.name]?.[line] : null;
    const useMarket = !useComp && marketStat && marketStat.total >= MIN_MARKET_SAMPLE;
    const weight = useComp
      ? Math.max(10, Math.min(95, Math.round(compStat.winrate)))
      : useMarket
        ? Math.max(10, Math.min(95, Math.round(marketStat.winrate)))
        : (resolved >= 5 ? Math.max(10, Math.min(95, p.winrate)) : 50);
    const perfNote = useComp
      ? ` — historique sur "${a.bet}" en ${match.competition}: ${Math.round(compStat.winrate)}% winrate (${compStat.total} résolus) → POIDS: ${weight}%`
      : useMarket
        ? ` — historique sur ce marché précis "${a.bet}" (tous championnats): ${Math.round(marketStat.winrate)}% winrate (${marketStat.total} résolus) → POIDS: ${weight}%`
        : resolved >= 5
          ? ` — historique global: ${p.winrate}% winrate (${p.wins}/${resolved} résolus) → POIDS: ${weight}%`
          : resolved > 0 ? ` — (${resolved} prédiction(s), pas assez pour peser) → POIDS: ${weight}% (neutre)` : ` — (sans historique) → POIDS: ${weight}% (neutre)`;
    return `${a.name}: ${a.bet} (${a.confidence}%)${perfNote}`;
  }).join("\n");

  // Build benched agents note for Chief awareness
  const benchedNote = benchedAgents.length > 0
    ? `\n\nNOTE: Agents exclus du vote (faible historique): ${benchedAgents.join(", ")} [ces agents ont <52% winrate sur 30+ prédictions résolues]`
    : "";

  const chiefPrompt = `${personas[CHIEF_INDEX]}

${matchContext}

Votes des agents avec leur fiabilité historique:
${previousVotes || "(aucun agent actif)"}${benchedNote}

Synthétise ces votes en tenant compte de :
1. Le POIDS de chaque agent (indiqué ci-dessus, basé sur son winrate réel) : privilégie fortement les votes des agents à POIDS ≥60%, et ignore largement ceux à POIDS <35% sauf si aucun agent mieux noté ne couvre ce marché
2. Les contraintes mathématiques du score live
3. Tes connaissances sur ${match.home} et ${match.away}
4. Les objections des agents minoritaires: explique pourquoi tu les acceptes ou les rejettes
5. Le contrôle GPT-Codex Challenger: teste au moins 3 marchés alternatifs (BTTS, double chance, over/under, vainqueur ou nul selon disponibilité), puis rejette ceux dont le signal est moins robuste
6. Le contexte business/risque: enjeu du match, domicile/extérieur, match amical ou officiel, blessures/absences connues seulement si tu en es sûr; si une donnée manque, ne l'invente pas
7. Les règles propres au sport: ${sport}
8. Tu DOIS choisir parmi : ${availableBets.join(", ")}
9. DIRECTIVE MARCHÉ : Under 2.5 UNIQUEMENT si match équilibré (écart 0-1 but) ET rythme faible. Si écart >= 2 buts OU 2+ buts marqués avant 45' → Over 2.5 ou Victoire. JAMAIS Under 2.5 quand une équipe domine

Réponds en JSON pur (pas de markdown):
{
  "bet": "un parmi: ${availableBets.join(", ")}",
  "confidence": <nombre 55-92>,
  "raison": "<2 phrases max: verdict + raison principale; objection minoritaire acceptée/rejetée si elle existe>"
}`;

  try {
    // Un seul fournisseur retenu par match : chacun n'est ajouté que si AUCUN
    // précédent n'est déjà en liste. Avant ce correctif, DeepSeek et OpenRouter
    // (Qwen) étaient tous deux ajoutés inconditionnellement — dès que DeepSeek
    // répondait vide/lentement (timeout 3.5s), Qwen était rappelé en plus, à
    // chaque analyse où le Chief tranche. C'est la principale source identifiée
    // de la surconsommation OpenRouter (audit du 28/07/2026).
    const chiefProviders = [];
    if (DEEPSEEK_API_KEY) chiefProviders.push({ kind: "openai", url: "https://api.deepseek.com/v1/chat/completions", key: DEEPSEEK_API_KEY, model: "deepseek-chat" });
    if (!chiefProviders.length && GROQ_API_KEY) chiefProviders.push({ kind: "openai", url: "https://api.groq.com/openai/v1/chat/completions", key: GROQ_API_KEY, model: "llama-3.3-70b-versatile" });
    if (!chiefProviders.length && CEREBRAS_API_KEY) chiefProviders.push({ kind: "openai", url: "https://api.cerebras.ai/v1/chat/completions", key: CEREBRAS_API_KEY, model: "llama-3.3-70b" });
    if (!chiefProviders.length && OPENROUTER_API_KEY
        && analysisEngine.allowOfficialOpenRouterFallback(db, { agentLabel: "Chief", matchKey: `${match.home || "?"}_${match.away || "?"}`, competition: match.competition || match.league || "", modelKey: "qwen" })) {
      chiefProviders.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max" });
    }

    let raw = "{}";
    for (const pv of chiefProviders) {
      try {
        const rp = await httpPost(pv.url, { model: pv.model, messages: [{ role: "user", content: chiefPrompt }], temperature: 0.5, max_tokens: 400 }, { Authorization: `Bearer ${pv.key}` }, AGENT_TIMEOUT_MS);
        raw = rp.choices?.[0]?.message?.content || "{}";
        const probe = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        if (probe && probe !== "{}" && probe.length > 8) break;
      } catch (e) {
        console.error(`[concile] Chief fournisseur échec: ${e.message}`);
      }
    }
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const rawBet = parsed.bet || availableBets[0];
    const { bet: validBet, corrected, original } = validateAndCorrectBet(rawBet, match, availableBets);
    const activeVoteSummary = activedAgentResults
      .filter(a => a.bet && a.bet !== "—" && a.bet !== "-")
      .map(a => `${a.bet} (${a.confidence}%)`)
      .join(", ");
    const fallbackRaison = activeVoteSummary
      ? `Synthèse du Concile : ${activeVoteSummary}. Score ${match.score_home}-${match.score_away} à ${minuteDisplay}.`
      : `Analyse live basée sur le score ${match.score_home}-${match.score_away} à ${minuteDisplay}, le temps restant et les marchés disponibles. Signal prudent faute de consensus IA complet.`;
    const raisonFinal = corrected
      ? `[Corrigé: "${original}" → "${validBet}"] ${parsed.raison || fallbackRaison}`
      : (parsed.raison && parsed.raison.length > 10 ? parsed.raison : fallbackRaison);

    agentResults.push({
      name: agentNames[CHIEF_INDEX].name, icon: agentNames[CHIEF_INDEX].icon,
      bet: validBet,
      confidence: Math.min(95, Math.max(50, isNaN(parseInt(parsed.confidence)) ? 55 : parseInt(parsed.confidence))),
      raison: raisonFinal,
      isChief: true, corrected: corrected || false,
    });
  } catch (e) {
    // Meme correction que pour les agents (02/08/2026) : le Chief est
    // l'arbitre interne dont la decision finale devient litteralement le
    // pari publie (chief = agentResults[agentResults.length-1] plus bas).
    // Le remplacer par un mock aleatoire signifiait qu'un JSON malforme
    // pouvait publier un pari totalement invente avec une fausse confiance
    // 60-85%. Sans, le consensus des 4 autres agents (s'ils convergent a 3+)
    // prend le relais normalement ; sinon la confiance retombe a 55 (deja
    // sous tous les seuils de diffusion), jamais de faux signal envoye.
    console.error(`[concile] agent Chief erreur JSON:`, e.message);
    agentResults.push({
      name: agentNames[CHIEF_INDEX].name, icon: agentNames[CHIEF_INDEX].icon,
      bet: "—", confidence: null,
      raison: "⚠️ Réponse illisible (JSON malformé) — non compté dans le verdict.",
      isChief: true, failed: true,
    });
  }

  // Find consensus bet
  const chief = agentResults[agentResults.length - 1];
  const betCounts = {};
  activedAgentResults.forEach((a) => {
    betCounts[a.bet] = (betCounts[a.bet] || 0) + 1;
  });
  let consensusBet = chief.bet;
  let consensusVotes = betCounts[consensusBet] || 0;
  let topBet = null;
  let topVotes = 0;
  for (const [bet, votes] of Object.entries(betCounts)) {
    if (votes > topVotes) { topBet = bet; topVotes = votes; }
  }
  const voteSummary = buildVoteSummary(activedAgentResults, topBet || chief.bet);
  // Un signal client exige une vraie majorite forte : 4 votes concordants
  // sur les 5 agents officiels. Un accord 3/5 reste visible comme tendance
  // interne, mais ne devient jamais un verdict diffusable sur Telegram.
  if (topBet && topVotes >= 4) {
    const topAgents = activedAgentResults.filter(a => a.bet === topBet);
    const avgConfidence = Math.round(topAgents.reduce((sum, a) => sum + Number(a.confidence || 0), 0) / topAgents.length);
    chief.bet = topBet;
    // Plafonds par niveau de consensus : plus les IA convergent, plus la confiance
    // publiable est haute. Le plafond 3 votes était à 74, soit SOUS le plancher de
    // diffusion (getSignalFloor() = 82) : la règle Elite « 3 IA suffisent » (voir
    // gradeElite plus bas) ne pouvait donc JAMAIS se déclencher, et le palier le
    // plus cher ne tournait en réalité que sur les signaux 4-5 votes de Premium.
    // Constaté le 31/07/2026 : 23 analyses bloquées à exactement 74 % en 24 h.
    // Porté à 84 — au-dessus du plancher pour rendre la règle Elite atteignable,
    // sous le plafond 4 votes (86) pour préserver la hiérarchie des consensus.
    // Ce n'est PAS une inflation : on retire un plafond, la valeur publiée reste
    // la moyenne réelle des IA d'accord (Math.min), jamais un chiffre inventé.
    chief.confidence = voteSummary.unanimous
      ? Math.max(75, Math.min(90, avgConfidence))
      : topVotes >= 4
        ? Math.max(68, Math.min(86, avgConfidence))
        : Math.max(58, Math.min(84, avgConfidence));
    chief.raison = `${voteSummary.vote_label} : ${topVotes} IA indépendantes convergent sur ${topBet}. ${chief.raison || ""}`.trim();
    consensusBet = topBet;
    consensusVotes = topVotes;
  } else {
    // Aucune majorite sur le marche principal. Avant d'abandonner a 55%, on
    // regarde les avis multi-marches deja emis : les IA peuvent diverger sur
    // "quel est le meilleur pari" tout en etant tres d'accord sur un marche
    // precis — et notamment sur celui ou les meilleures d'entre elles sont
    // specialistes. C'est exactement le cas que le vote a poids egal jetait.
    const routage = meilleurMarcheParSpecialistes(agentMarketList);
    // Mode shadow : on ENREGISTRE ce que le routage aurait choisi, sans jamais
    // toucher au verdict. L'analyse reste a 55%, aucun signal n'est envoye,
    // aucun abonne n'est impacte. Le rapport du matin compare ensuite ces
    // choix aux resultats reels. Tant que le mode est "shadow", ce bloc est le
    // SEUL effet du routage sur le systeme.
    if (routage && ROUTAGE_MODE === "shadow") {
      try {
        db.prepare(`INSERT OR IGNORE INTO routage_shadow
          (match_key, home, away, competition, market_line, bet, accord, experts, confiance_reelle)
          VALUES (?,?,?,?,?,?,?,?,?)`)
          .run(getPredictionSnapshotKey(match), match.home || "", match.away || "",
               match.competition || match.league || "", routage.ligne, routage.bet,
               routage.accord, routage.experts.join(", "),
               Math.min(55, Number(chief.confidence || 55)));
      } catch (e) { console.error("[routage-shadow]", e.message); }
      console.log(`[routage-shadow] ${match.home} vs ${match.away} : aurait propose ${routage.bet} (accord ${routage.accord}%) — non applique`);
    }
    if (routage && ROUTAGE_MODE === "actif") {
      consensusBet = routage.bet;
      consensusVotes = 3; // accord pondere equivalent au quorum
      chief.bet = routage.bet;
      // Plafond volontairement bas (78) : un accord obtenu par ponderation vaut
      // moins qu'une convergence franche de 4 ou 5 IA sur le marche principal.
      // Il reste au-dessus du plancher de diffusion, donc exploitable.
      chief.confidence = Math.max(58, Math.min(78, routage.accord));
      chief.raison = `Accord pondéré ${routage.accord}% sur ${routage.bet}`
        + (routage.experts.length ? `, porté par ${routage.experts.join(", ")} sur ce marché` : "")
        + `. ${chief.raison || ""}`.trimEnd();
      console.log(`[specialiste] ${match.home} vs ${match.away} : ${routage.bet} (accord pondere ${routage.accord}%, ${routage.experts.length} specialiste(s))`);
    } else {
      chief.confidence = Math.min(55, Number(chief.confidence || 55));
      chief.raison = `Aucun signal validé : les IA ne convergent pas assez fortement. ${chief.raison || ""}`.trim();
    }
  }

  // Verdict client fonde exclusivement sur les cinq bulletins O/U 2,5 reels.
  // Une majorite sur le "meilleur pari" libre ne vaut pas une majorite O/U.
  const ou25VoteSummary = buildOu25VoteSummary(agentMarketList, agentResults);
  if (ou25VoteSummary.recommended) {
    chief.bet = ou25VoteSummary.vote_top;
    chief.confidence = ou25VoteSummary.average_confidence;
    chief.raison = `${ou25VoteSummary.vote_label} : ${ou25VoteSummary.vote_count} des 5 sieges votent ${ou25VoteSummary.vote_top}.`;
    consensusBet = ou25VoteSummary.vote_top;
    consensusVotes = ou25VoteSummary.vote_count;
  }

  // Sauvegarder les prédictions pour le tracking de performance
  // Le Chief arbitre mais ne constitue jamais un sixième votant public.
  saveAgentPredictions(match, agentResults.filter((a) => !a.isChief));
  saveAgentMarketPredictions(match, agentMarketList);

  // Vraie cote ARJEL (sinon estimation marché variée par type de pari)
  const oddInfo = await computeBestOdd(match, chief.bet, chief.confidence);
  console.log(`[concile] Cote ${match.home} vs ${match.away}: ${oddInfo.cote} (${oddInfo.source}) — ${chief.bet}`);

  const analysisResult = {
    match_key: `${match.home}_${match.away}`,
    best_bet: chief.bet,
    confidence: chief.confidence,
    cote: oddInfo.cote,
    cote_source: oddInfo.source,
    arjel_avg_odd: oddInfo.arjelAvg,
    arjel_bookmakers_count: oddInfo.arjelCount,
    raison: chief.raison,
    consensus_votes: consensusVotes,
    total_agents: ou25VoteSummary.vote_total,
    active_agents: ou25VoteSummary.vote_active,
    vote_summary: ou25VoteSummary,
    market_scores: aggregateMarketScores(agentMarketList),
    agents: agentResults.filter((a) => !a.isChief),
    statsStatus: typeof statsStatus !== "undefined" ? statsStatus : buildStatsStatus(match, null, "mock_or_unavailable"),
    agent_performance: agentPerf,
    // Marches secondaires (BTTS%, but 1ere mi-temps%, victoire dom/ext%, Under
    // 2.5%) issus du meme H2H reel deja utilise pour le prompt IA — jamais
    // invente, jamais un nouveau calcul separe. Demande de Greg le 03/08/2026 :
    // afficher plusieurs marches sous l'analyse, pas juste le pick principal.
    h2h_markets: (h2hData && h2hData.n >= 3) ? {
      n: h2hData.n,
      btts_pct: h2hData.bttsPct,
      first_half_goal_pct: h2hData.htGoalPct,
      home_win_pct: Math.round((h2hData.homeWins / h2hData.n) * 100),
      away_win_pct: Math.round((h2hData.awayWins / h2hData.n) * 100),
      under25_pct: h2hData.under25Pct,
    } : null,
  };

  // Tracer l'analyse pour la boucle d'apprentissage
  const pick = loadPick();
  const pickBet = pick?.currentPick?.bet || pick?.marketType || null;
  // Cle canonique partagee par analyse, preuve Telegram et resultat final.
  const persistedAnalysisMatchKey = saveConcileAnalysis(match, analysisResult, pickBet);
  analysisResult.match_key = persistedAnalysisMatchKey || analysisResult.match_key;

  // Vrais noms des 5 agents officiels dans le texte public (demande fondateur,
  // 29/07/2026 : "ca fait plus pro"). Deux regles restent en vigueur :
  //  - "Chief" (l'arbitre interne) n'est JAMAIS nomme cote client, quel que soit
  //    le modele qui le fait tourner en coulisses (voir handoff Codex 25/07/2026).
  //  - Les modeles de repli internes (fallbacks Groq/Cerebras/GPT/Gemini quand un
  //    agent officiel est indisponible) restent generiques : ce sont des details
  //    d'implementation, pas les 5 IA marketees, et les exposer ferait plus
  //    confus que "plus pro".
  function maskAiNames(text) {
    if (!text) return "";
    const map = [
      [/Perplexity[- ]?Web/gi, "Perplexity"], [/DeepSeek[- ]?V3/gi, "DeepSeek"],
      [/Mistral[- ]?Large/gi, "Mistral"], [/Cohere[- ]?Command/gi, "Cohere"],
      [/OpenRouter[- ]?Qwen/gi, "Qwen"], [/OpenRouter[- ]?Kimi/gi, "Kimi"],
      [/Claude[- ]?Chief/gi, "Concile"],
      [/GPT[- ]?4o?[- ]?mini/gi, "IA"], [/GPT[- ]?Analysis/gi, "IA"],
      [/GeminiFlash/gi, "IA"], [/Mistral[- ]?Small/gi, "IA"],
      [/Mistral[- ]?7B/gi, "IA"], [/Cerebras[- ]?Llama/gi, "IA"],
      [/OR[- ]?Mistral7B/gi, "IA"], [/Groq[- ]?Llama\d*/gi, "IA"],
      [/Llama[- ]?\d+[bB]?/gi, "IA"],
    ];
    let r = text;
    for (const [re, rep] of map) r = r.replace(re, rep);
    return r;
  }

  // Signal fort Telegram automatique si confidence >= seuil adaptatif
  // ET vraies données présentes ET segment (ligue/marché) prouvé gagnant historiquement.
  // Seuil abaissé sur "But 1ère MT" (marché à 82% de winrate historique).
  const signalThreshold = getSignalThresholdForBet(analysisResult.best_bet);
  const hasRealData = statsStatus.available || !!h2hBlock || !!deepBlock;
  const qualityGate = passesHistoricalQualityGate(match, analysisResult.best_bet);
  if (!qualityGate.ok) {
    console.log(`[signal-fort] Bloqué par barrière qualité — ${qualityGate.reason}`);
  }
  const playable = betIsPlayable(match, analysisResult.best_bet, analysisResult.cote);
  if (!playable.ok) {
    console.log(`[signal-fort] Bloqué (sans valeur) — ${playable.reason}`);
  }
  // Garde-fou final à l'émission : jamais de signal sur un match féminin ni une
  // ligue douteuse, quel que soit le chemin d'analyse (défense en profondeur).
  const isWomen = isWomenMatch(match);
  if (isWomen) {
    console.log(`[signal-fort] Bloqué — match féminin (liste noire): ${match.home} vs ${match.away}`);
  }
  const lowTrust = isCategoryBanned(match) || (!isUefaCompetition(match) && isLowTrustCompetition(match));
  if (lowTrust) {
    console.log(`[signal-fort] Bloqué — ligue douteuse (liste noire): ${match.competition || match.league || ""}`);
  }
  const voteInfo = analysisResult.vote_summary || {};
  const voteCountForSignal = Math.min(5, Math.max(
        Number((Math.max(
        Number((Number(voteInfo.vote_count || analysisResult.consensus_votes || 0)) || 0),
        Number(analysisResult.consensus_votes || analysisResult.vote_summary?.vote_count || 0)
      )) || 0),
        Number(analysisResult.consensus_votes || 0),
        Number(analysisResult.vote_summary?.vote_count || 0)
      ));
  const enoughOu25SeatsPresent = Number(voteInfo.vote_active || 0) >= CLIENT_OU25_MIN_VOTES;
  const ou25Only = isOu25Bet(analysisResult.best_bet) && voteInfo.market === "over_under_2_5";
  const clientOu25MatchEligible = isClientOu25MatchEligible(match, true, CLIENT_OU25_CLIENT_MAX_MINUTE);
  const requiredVotesForSignal = clientOu25RequiredVotes(match, analysisResult.best_bet);
  const recoveryEvidence = await evaluateRecoveryEvidence(match, analysisResult.best_bet, liveStats);
  const recoveryToday = new Date().toISOString().slice(0, 10);
  if (_recoverySignalDaily.date !== recoveryToday) {
    _recoverySignalDaily.date = recoveryToday;
    _recoverySignalDaily.count = recoverySignalsSentToday();
  }
  const recoveryCapacityAvailable = !RECOVERY_MODE_ENABLED
    || _recoverySignalDaily.count < RECOVERY_MAX_DAILY_SIGNALS;
  console.log(`[recovery] ${match.home} vs ${match.away}: ${recoveryEvidence.ok ? "OK" : "BLOCK"} — ${recoveryEvidence.reason}`);
  // Vrai seulement si ce match franchit le filtre d'un canal payant : sert à
  // limiter les tests à blanc aux picks réellement diffusés (budget OpenRouter).
  let shadowWorthy = false;

  // ── Traçage du tunnel de diffusion ──────────────────────────────────────────
  // Premier motif bloquant, dans l'ordre où le code les évalue. Permet de
  // répondre factuellement à "pourquoi 0 signal aujourd'hui ?" au lieu de
  // supposer. Écrit en base plus bas, agrégé par /admin/funnel-report.
  let _tierBlock = null; // motif de non-diffusion detecte dans le bloc palier
  // ── Regime par classe de ligue (07/08/2026, decision du fondateur) ─────────
  // "Le but n'est pas d'avoir plus de signaux a tout prix. Le but est de
  // reperer les ligues qui peuvent devenir rentables sans salir l'historique."
  // On evalue ces barrieres AVANT les autres : une ligue en observation ne doit
  // jamais sortir, quel que soit son score par ailleurs.
  const _tier = leagueTier(match);
  const _coteReelle = Number(analysisResult.cote) > 1
    && !!analysisResult.cote_source
    && !/estimation/i.test(String(analysisResult.cote_source));
  const _blockTier = (() => {
    if (_tier === "watchlist_shadow") {
      // Deux motifs distincts, parce qu'ils ne mènent pas à la même décision
      // dans trois mois : une analyse sans cote reelle ne pourra JAMAIS compter
      // dans le bilan d'ouverture de la ligue, celle avec cote si.
      return _coteReelle
        ? "watchlist_shadow_only"
        : "missing_real_odd_watchlist (signal sportif fort, mais disponibilite bookmaker a verifier)";
    }
    if (_tier !== "trusted_secondary") return null;
    // Ligue secondaire : cote REELLE obligatoire, jamais une estimation.
    if (!_coteReelle) return "missing_real_odd_secondary (signal sportif fort, mais disponibilite bookmaker a verifier)";
    if (analysisResult.confidence < signalThreshold + SECONDARY_CONF_BONUS) {
      return `secondary_league_threshold (confiance ${analysisResult.confidence} < ${signalThreshold + SECONDARY_CONF_BONUS})`;
    }
    return null;
  })();

  const _blockReason = (() => {
    if (_blockTier) return _blockTier;
    if (!TELEGRAM_BOT_TOKEN) return "config: TELEGRAM_BOT_TOKEN absent";
    if (RECOVERY_MODE_ENABLED && !recoveryEvidence.ok) return `mode Recovery: ${recoveryEvidence.reason}`;
    if (!recoveryCapacityAvailable) return `mode Recovery: plafond ${RECOVERY_MAX_DAILY_SIGNALS} signaux/jour atteint`;
    if (!clientOu25MatchEligible) return `hors perimetre client O/U 2,5 (football championnat, minute 15-${CLIENT_OU25_CLIENT_MAX_MINUTE})`;
    if (!ou25Only) return "marche client interdit: Over/Under 2,5 uniquement";
    if (!enoughOu25SeatsPresent) return `sieges O/U 2,5 insuffisants: ${Number(voteInfo.vote_active || 0)}/5 (<4)`;
    if (analysisResult.confidence < signalThreshold) return `confiance ${analysisResult.confidence} < seuil ${signalThreshold}`;
    if (analysisResult.confidence < CLIENT_OU25_MIN_CONFIDENCE) return `confiance ${analysisResult.confidence} < plancher O/U 2,5 ${CLIENT_OU25_MIN_CONFIDENCE}`;
    if (voteCountForSignal < requiredVotesForSignal) return `votes ${voteCountForSignal} < ${requiredVotesForSignal}`;
    if (!_coteReelle) return "pas de vraie cote bookmaker";
    if (!hasRealData) return "donnees stats/H2H indisponibles";
    if (!qualityGate.ok) return `filtre qualite: ${qualityGate.reason}`;
    if (!playable.ok) return `cote: ${playable.reason}`;
    if (isWomen) return "match feminin (exclu)";
    if (lowTrust) return "ligue non fiable";
    return null;
  })();

  if (!_blockReason) {
    const signalKey = `${match.home}_${match.away}_${new Date().toISOString().slice(0, 13)}`;
    if (!_signalSentCache.has(signalKey)) {
      // La clé porte l'heure courante (…THH). Sans purge, ce Set ne fait que
      // grossir tant que le conteneur tourne. On ne garde que l'heure en cours :
      // les clés plus anciennes ne peuvent plus provoquer de collision.
      if (_signalSentCache.size > 500) {
        const currentHour = signalKey.slice(-13); // "YYYY-MM-DDTHH"
        for (const k of _signalSentCache) {
          if (!k.endsWith(currentHour)) _signalSentCache.delete(k);
        }
      }
      _signalSentCache.add(signalKey);
      const si = { Football:"⚽", Basketball:"🏀", Hockey:"🏒", Baseball:"⚾" };
      const ico = si[match.sport] || "🎯";
      // escTgHtml APRES maskAiNames : maskAiNames travaille sur des noms de
      // modeles connus (regex simples), aucun risque d'echapper puis de rater
      // un remplacement. Le texte reste une phrase generee par une IA — jamais
      // garanti exempt de "<", ">" ou "&" avant ce point.
      const safeRaison = escTgHtml(maskAiNames(String(analysisResult.raison || "").slice(0, 200)));
      // Cote déjà calculée au moment de l'analyse (computeBestOdd) → aucun appel API
      // supplémentaire. On l'envoie AVEC le signal, avec le bookmaker source si réel.
      const _bmSig = (analysisResult.cote_source && !/estimation/i.test(String(analysisResult.cote_source)))
        ? ` <i>(${analysisResult.cote_source})</i>` : "";
      // On n'affiche la cote QUE si c'est une VRAIE cote bookmaker (jamais l'estimation).
      const coteSig = (analysisResult.cote && _bmSig)
        ? `\n💰 Cote : <b>${Number(analysisResult.cote).toFixed(2)}</b>${_bmSig}` : "";
      // Cote moyenne ARJEL (tous bookmakers agréés confondus) — n'affiche cette
      // ligne QUE si la cote principale ci-dessus vient d'un bookmaker isole,
      // sinon "Cote" est deja cette meme moyenne (voir computeBestOdd) et cette
      // ligne ferait doublon avec le meme chiffre.
      const arjelAvgLine = (analysisResult.arjel_avg_odd && analysisResult.arjel_bookmakers_count >= 2 && !/^moyenne ARJEL/i.test(String(analysisResult.cote_source || "")))
        ? `\n📈 Cote moyenne ARJEL : <b>${Number(analysisResult.arjel_avg_odd).toFixed(2)}</b> <i>(${analysisResult.arjel_bookmakers_count} bookmakers)</i>` : "";
      const voteLine = voteInfo.vote_label ? `\n🧠 Vote IA : <b>${voteInfo.vote_label}</b>` : "";
      const confDot = confidenceEmoji(analysisResult.confidence);
      // Noms d'equipe/competition venant de l'API sportive : jamais garantis
      // exempts de "&" ou de guillemets/chevrons dans les competitions moins
      // courantes. Echappes pour la meme raison que safeRaison ci-dessus.
      const homeEsc = escTgHtml(match.home);
      const awayEsc = escTgHtml(match.away);
      const compEsc = escTgHtml(match.competition || match.league || match.sport || "");
      const betEsc = escTgHtml(analysisResult.best_bet);
      const tgPremium = `🚨 <b>SIGNAL CONSEIL IA — ${confDot} ${analysisResult.confidence}/100</b>\n\n${ico} <b>${homeEsc} vs ${awayEsc}</b>\n🏆 ${compEsc}\n${match.minute ? `⏱ ${match.minute}' · Score : ${match.score_home ?? "?"}-${match.score_away ?? "?"}` : ""}${voteLine}\n\n💡 Signal : <b>${betEsc}</b>\n📊 Score de confiance : ${confDot} <b>${analysisResult.confidence}/100</b>${coteSig}${arjelAvgLine}\n${safeRaison ? `\n<i>${safeRaison}</i>` : ""}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ 18+ — Jeu responsable`;
      const tgFree = `🚨 <b>SIGNAL CONSEIL IA DÉTECTÉ — ${confDot} ${analysisResult.confidence}/100</b>\n\n${ico} <b>${homeEsc} vs ${awayEsc}</b>\n🏆 ${compEsc}\n${match.minute ? `⏱ ${match.minute}' · Score : ${match.score_home ?? "?"}-${match.score_away ?? "?"}` : ""}${voteLine}\n\n🔒 <b>La sélection exacte et la raison sont réservées aux membres.</b>\n📊 Score de confiance : ${confDot} <b>${analysisResult.confidence}/100</b>\n\n📊 <a href="https://www.touslesmatchs.com/performances">Résultat vérifiable demain sur le site</a>\n👉 <a href="https://www.touslesmatchs.com/#plans"><b>S'abonner à Standard — 4,90€/mois</b></a>\n\n━━━━━━━━━━━━━━━━━━\n⚠️ 18+ — Jeu responsable`;
      const todayStr = new Date().toISOString().slice(0, 10);
      const grade = bestBetGrade(match, analysisResult.best_bet, analysisResult.confidence, analysisResult.cote);
      const minute = parseLiveMinuteValue(match.minute);
      const sigTier = computeSignalTier(analysisResult.best_bet, analysisResult.confidence, minute);
      const tierBadge = sigTier === "standard" ? "🥇 STANDARD" : sigTier === "premium" ? "🥈 PREMIUM" : "🥉 ELITE";
      console.log(`[signal-fort] Palier: ${tierBadge} (${sigTier}) — ${analysisResult.best_bet} ${analysisResult.confidence}% min=${minute}`);
      const arjelPlayable = ARJEL_BOOKMAKERS.some(a => String(analysisResult.cote_source || "").toLowerCase().includes(a))
        || isArjelMajorCompetition(match);
      if (!arjelPlayable) {
        console.log(`[signal-fort] Hors ARJEL (source: ${analysisResult.cote_source || "estimation"}, ${match.competition || match.sport}) — réservé admin, non diffusé Premium/Free`);
      }
      // Réinitialisation des compteurs journaliers
      // Au changement de jour ET au premier passage après un redémarrage
      // (date === ""), on repart du nombre réellement diffusé, lu en base.
      if (_standardSignalDaily.date !== todayStr) { _standardSignalDaily.date = todayStr; _standardSignalDaily.count = signalsSentToday("sig_sent_standard"); }
      if (_premiumSignalDaily.date !== todayStr) { _premiumSignalDaily.date = todayStr; _premiumSignalDaily.count = signalsSentToday("sig_sent_premium"); }
      if (_eliteSignalDaily.date !== todayStr) { _eliteSignalDaily.date = todayStr; _eliteSignalDaily.count = signalsSentToday("sig_sent_elite"); }
      if (_freeSignalDailyDate.date !== todayStr) { _freeSignalDailyDate.date = todayStr; _freeSignalDailyDate.count = signalsSentToday("sig_sent_free"); }

      // ── Diffusion par palier (conditions fondateur) ─────────────────────────
      //   🟢 Standard (4.90€)  : conf ≥ 88, foot, cote réelle ARJEL 1.30-2.50 — max 3/j
      //   🟣 Premium  (14.90€) : conf ≥ 85, foot, cote réelle ARJEL 1.30-2.50 — max 10/j (inclut Standard)
      //   🟠 Elite    (29.90€) : conf ≥ 82, football uniquement, cote réelle ANJ 1.30-2.50 — max 30/j (inclut Premium)
      //   Modèle imbriqué : un palier supérieur reçoit toujours au moins ce que reçoit l'inférieur.
      //   « Cote réelle » = vraie cote bookmaker (jamais l'estimation). Repli auto sur Premium
      //   tant qu'un canal dédié n'est pas configuré (voir constantes) → pas de doublon.
      const conf = Number(analysisResult.confidence) || 0;
      const realOdd = (analysisResult.cote && _bmSig) ? Number(analysisResult.cote) : 0; // _bmSig ⇒ cote réelle bookmaker
      const oddOk = realOdd >= TIER_MIN_REAL_ODD && realOdd <= TIER_MAX_REAL_ODD;
      const sportLc = String(match.sport || "Football").toLowerCase();
      // Produit client recentre : football O/U 2,5 uniquement, cinq sieges
      // presents et majorite forte. Les autres sports/marches restent internes.
      const sportDiffusable = sportLc.includes("foot");
      const diffusable = arjelPlayable && oddOk && sportDiffusable
        && clientOu25MatchEligible && ou25Only && enoughOu25SeatsPresent
        && voteCountForSignal >= requiredVotesForSignal
        && conf >= CLIENT_OU25_MIN_CONFIDENCE
        && recoveryEvidence.ok && recoveryCapacityAvailable;
      // Motif précis quand l'analyse a franchi tous les filtres qualité mais
      // n'atteint aucun canal payant. Distingue les trois causes, qui appellent
      // des corrections très différentes.
      if (!diffusable) {
        _tierBlock = RECOVERY_MODE_ENABLED && !recoveryEvidence.ok
          ? `mode Recovery: ${recoveryEvidence.reason}`
          : !recoveryCapacityAvailable
            ? `mode Recovery: plafond ${RECOVERY_MAX_DAILY_SIGNALS} signaux/jour atteint`
            : !sportDiffusable
              ? `sport non diffusable: ${match.sport || "?"}`
              : !arjelPlayable
                ? `hors ARJEL (source cote: ${analysisResult.cote_source || "estimation"})`
                : realOdd === 0
                  ? "pas de vraie cote bookmaker (estimation seulement)"
                  : `cote ${realOdd} hors fenetre ${TIER_MIN_REAL_ODD}-${TIER_MAX_REAL_ODD}`;
      }
      // Seuils recalculés chaque jour pour servir le quota vendu (3 / 10 / 30).
      const TH = getTierThresholds();

      // Standard exigeait l'UNANIMITE des 5 agents : une condition si rare que le
      // palier restait vide la plupart des jours (0/3 le 28/07/2026). Une majorite
      // large de 4 sur 5 reste tres selective — c'est le seuil de CONFIANCE, plus
      // eleve que les autres paliers, qui porte l'exigence Standard.
      // En Mode Recovery, les 1-2 signaux qui franchissent tous les garde-fous
      // sont envoyes aux canaux payants des 4/5 et 78 %, sans second seuil cache.
      const gradeStandard = RECOVERY_MODE_ENABLED
        ? diffusable
        : diffusable && voteCountForSignal >= requiredVotesForSignal && conf >= TH.standard;
      const gradePremium = RECOVERY_MODE_ENABLED
        ? diffusable
        : gradeStandard || (diffusable && voteCountForSignal >= requiredVotesForSignal && conf >= TH.premium);
      const gradeElite = RECOVERY_MODE_ENABLED
        ? diffusable
        : gradePremium || (diffusable && voteCountForSignal >= requiredVotesForSignal && conf >= TH.elite);
      if (RECOVERY_MODE_ENABLED && gradeElite
          && (TELEGRAM_STANDARD_CHANNEL_ID || TELEGRAM_PREMIUM_CHANNEL_ID || TELEGRAM_ELITE_CHANNEL_ID)) {
        // Reservation synchrone : evite que deux analyses paralleles depassent le plafond.
        _recoverySignalDaily.count++;
      }
      shadowWorthy = gradeElite;

      const stdDistinct   = !!(TELEGRAM_STANDARD_CHANNEL_ID && TELEGRAM_STANDARD_CHANNEL_ID !== TELEGRAM_PREMIUM_CHANNEL_ID);
      const eliteDistinct = !!(TELEGRAM_ELITE_CHANNEL_ID && TELEGRAM_ELITE_CHANNEL_ID !== TELEGRAM_PREMIUM_CHANNEL_ID);
      const tierTag = (label) => `\n🏅 Palier : <b>${label}</b>`;
      // Ligne EXACTE de cette analyse. Sans elle, le marquage retombait sur
      // "toutes les lignes du match aujourd'hui" et contaminait les analyses
      // bloquees du meme match (bug Club Brugge du 07/08/2026).
      const _ligneAnalysee = persistedAnalysisMatchKey || getPredictionSnapshotKey(match);
      const _deliveryMeta = (channel) => ({
        matchKey: _ligneAnalysee,
        channel,
        market: analysisResult.best_bet,
        voteCount: voteCountForSignal,
      });

      // 🟢 STANDARD — cap 3/j
      // markSignalSent() APRES confirmation d'envoi, jamais avant : marquer en
      // base puis ignorer le resultat de sendTelegramMessage() faisait croire au
      // systeme qu'un signal etait diffuse alors que Telegram l'avait refuse.
      // Consequences reelles constatees le 30/07/2026 : le message de RESULTAT
      // ("match gagne") partait alors que l'abonne n'avait jamais recu le pick,
      // le site affichait l'analyse comme diffusee, et le quota journalier etait
      // consomme pour rien — bloquant les vrais signaux suivants. En cas d'echec
      // on rend donc aussi le credit de quota.
      if (stdDistinct && gradeStandard && _standardSignalDaily.count < STANDARD_SIGNAL_DAILY_CAP && !signalDeliveredToChannelToday(match, "standard")) {
        _standardSignalDaily.count++;
        sendTelegramMessage(TELEGRAM_STANDARD_CHANNEL_ID, tgPremium + tierTag("🟢 STANDARD"), _deliveryMeta("standard")).then(ok => {
          if (ok) markSignalSent(match.home, match.away, "sig_sent_standard", _ligneAnalysee);
          else _standardSignalDaily.count--;
          console.log(`[signal-fort] Telegram standard (${_standardSignalDaily.count}/${STANDARD_SIGNAL_DAILY_CAP}) conf=${conf} cote=${realOdd}: ${ok ? "OK" : "FAIL — non marque car envoi Telegram KO, quota rendu"}`);
        });
      }

      // 🟣 PREMIUM — cap 10/j (canal socle, toujours présent)
      if (TELEGRAM_PREMIUM_CHANNEL_ID && gradePremium && _premiumSignalDaily.count < PREMIUM_SIGNAL_DAILY_CAP && !signalDeliveredToChannelToday(match, "premium")) {
        _premiumSignalDaily.count++;
        sendTelegramMessage(TELEGRAM_PREMIUM_CHANNEL_ID, tgPremium + tierTag("🟣 PREMIUM"), _deliveryMeta("premium")).then(ok => {
          if (ok) markSignalSent(match.home, match.away, "sig_sent_premium", _ligneAnalysee);
          else _premiumSignalDaily.count--;
          console.log(`[signal-fort] Telegram premium (${_premiumSignalDaily.count}/${PREMIUM_SIGNAL_DAILY_CAP}) conf=${conf} cote=${realOdd}: ${ok ? "OK" : "FAIL — non marque car envoi Telegram KO, quota rendu"}`);
        });
      } else if (TELEGRAM_PREMIUM_CHANNEL_ID && gradePremium) {
        console.log(`[signal-fort] Premium: plafond ${PREMIUM_SIGNAL_DAILY_CAP}/jour atteint, skip`);
      }

      // 🟠 ELITE/VIP — cap 30/j, multisport, alertes prioritaires
      if (eliteDistinct && gradeElite && _eliteSignalDaily.count < ELITE_SIGNAL_DAILY_CAP) {
        _eliteSignalDaily.count++;
        const prio = conf >= 92 ? "\n⚡ <b>ALERTE PRIORITAIRE</b>" : "";
        sendTelegramMessage(TELEGRAM_ELITE_CHANNEL_ID, tgPremium + tierTag("🟠 ELITE") + prio, _deliveryMeta("elite")).then(ok => {
          if (ok) markSignalSent(match.home, match.away, "sig_sent_elite", _ligneAnalysee);
          else _eliteSignalDaily.count--;
          console.log(`[signal-fort] Telegram elite (${_eliteSignalDaily.count}/${ELITE_SIGNAL_DAILY_CAP}) conf=${conf} ${sportLc}: ${ok ? "OK" : "FAIL — non marque car envoi Telegram KO, quota rendu"}`);
        });
      }

      // 👑 ADMIN (Hermès) — les signaux individuels restent dans les logs.
      // Le canal admin reçoit uniquement le digest quotidien afin d'éviter le spam.
      if (TELEGRAM_ADMIN_CHAT_ID) {
        console.log("[signal-fort] Telegram admin: non envoyé (inclus dans le digest quotidien)");
      }

      // 🆓 GRATUIT (vitrine) — 1 teaser/jour, SANS la sélection exacte, pousse vers Standard
      if (gradePremium && _freeSignalDailyDate.count < 1 && TELEGRAM_CHANNEL_ID && !signalDeliveredToChannelToday(match, "free")) {
        _freeSignalDailyDate.count++;
        sendTelegramMessage(TELEGRAM_CHANNEL_ID, tgFree, _deliveryMeta("free")).then(ok => {
          if (ok) markSignalSent(match.home, match.away, "sig_sent_free", _ligneAnalysee);
          else _freeSignalDailyDate.count--;
          console.log(`[signal-fort] Telegram gratuit (vitrine): ${ok ? "OK" : "FAIL — non marque car envoi Telegram KO, quota rendu"}`);
        });
      }
    }
  }

  // Trace du motif de non-diffusion (null si le signal est bien parti).
  try {
    const motif = _blockReason || _tierBlock || null;
    // Une nouvelle observation du meme match ne doit jamais transformer un
    // signal deja accepte par Telegram en "non diffuse". La preuve de livraison
    // est prioritaire sur le motif technique d'un passage ulterieur.
    const _ligne = persistedAnalysisMatchKey || getPredictionSnapshotKey(match);
    const dejaLivre = db.prepare(`SELECT 1 FROM telegram_signal_deliveries
      WHERE match_key = ? AND ok = 1 AND telegram_message_id IS NOT NULL LIMIT 1`).get(_ligne);
    const motifAEnregistrer = dejaLivre ? null : motif;
    const maj = db.prepare("UPDATE concile_analyses SET diffusion_block = ? WHERE match_key = ?").run(motifAEnregistrer, _ligne);
    if (!maj.changes) {
      db.prepare(
        `UPDATE concile_analyses SET diffusion_block = ?
         WHERE lower(trim(home)) = lower(trim(?)) AND lower(trim(away)) = lower(trim(?))
           AND date(analysed_at) = date('now')`
      ).run(motifAEnregistrer, match.home, match.away);
    }
  } catch (e) { console.error("[funnel] trace:", e.message); }

  // ── Tests à blanc : uniquement sur les matchs RÉELLEMENT diffusables ────────
  // Avant, cette évaluation tournait sur CHAQUE match analysé (109 le 25/07) avec
  // 3 agents OpenRouter, soit ~330 appels/jour facturés au token — l'essentiel du
  // budget OpenRouter, dépensé sur des matchs qui ne seront jamais diffusés.
  // Deux bénéfices à ne tester que les picks diffusables :
  //   1. environ 95 % d'appels en moins ;
  //   2. les challengers sont évalués sur la MÊME population que les vrais picks,
  //      donc le score de Brier devient comparable — sans quoi promouvoir un modèle
  //      sur la base de ces chiffres n'aurait aucune validité statistique.
  if (shadowWorthy && shadowQuotaAllows()) {
    runShadowEvaluation(match).catch(e => console.error("[shadow] bg:", e.message));
  }

  return analysisResult;
}

function getMockAgentAnalysis(agent, match, index) {
  const bets = BET_TYPES;
  const score_diff = match.score_home - match.score_away;
  const minute = parseInt(match.minute) || 50;
  let bet;
  if (score_diff > 0 && minute > 60) bet = "Under 2.5 buts";
  else if (score_diff === 0 && minute < 70) bet = "BTTS Oui";
  else if (score_diff === 0) bet = "Over 2.5 buts";
  else bet = score_diff > 0 ? "Victoire domicile" : "Victoire extérieur";

  const confidence = 60 + Math.floor(Math.random() * 25);
  const raisons = [
    `L'équipe à domicile montre une solidité défensive depuis la ${minute}'. Le contexte du score favorise ce marché.`,
    `Les statistiques de ce type de match à cette phase du jeu indiquent une forte probabilité pour ce scénario.`,
    `Le score actuel de ${match.score_home}-${match.score_away} et la dynamique du match orientent clairement vers ce marché.`,
    `Analyse des patterns : ce type de configuration à la ${minute}' converge régulièrement vers ce résultat.`,
    `En synthèse des votes du Conseil et du contexte temps réel, ce marché offre le meilleur ratio risque/récompense.`,
  ];

  return {
    name: agent.name,
    icon: agent.icon,
    bet,
    confidence,
    raison: raisons[index] || raisons[0],
    isChief: false,
  };
}

function getMockAnalysis(match) {
  const statsStatus = buildStatsStatus(match, null, "mock_or_unavailable");
  const agents = [
    { name: "Perplexity-Web", icon: "🌐", model: "sonar-pro" },
    { name: "DeepSeek-V3", icon: "🔮", model: "deepseek-chat" },
    { name: "Mistral-Large", icon: "🌊", model: "mistral-large-latest" },
    { name: "Qwen-3.7-Max", icon: "🧬", model: "command-r-plus" },
    { name: "OpenRouter-Kimi", icon: "🌙", model: process.env.OR_KIMI_MODEL || "moonshotai/kimi-k2" },
  ];
  const agentResults = agents.map((a, i) => getMockAgentAnalysis(a, match, i));
  const voteSummary = buildVoteSummary(agentResults, agentResults[0]?.bet);
  const topAgents = agentResults.filter(a => a.bet === voteSummary.vote_top);
  const avgConfidence = topAgents.length
    ? Math.round(topAgents.reduce((sum, a) => sum + Number(a.confidence || 0), 0) / topAgents.length)
    : 55;
  return {
    match_key: `${match.home}_${match.away}`,
    best_bet: voteSummary.vote_top || agentResults[0]?.bet || "Analyse IA",
    confidence: avgConfidence,
    raison: `${voteSummary.vote_label} : simulation de secours du Conseil IA.`,
    consensus_votes: voteSummary.vote_count,
    total_agents: voteSummary.vote_total,
    active_agents: voteSummary.vote_active,
    vote_summary: voteSummary,
    agents: agentResults,
    statsStatus: typeof statsStatus !== "undefined" ? statsStatus : buildStatsStatus(match, null, "mock_or_unavailable"),
  };
}

// ── Concile analysis trace ────────────────────────────────────────────────────
function summarizeOutcomeRows(rows) {
  const total = rows.reduce((n, r) => n + Number(r.total || 0), 0);
  const wins = rows.reduce((n, r) => n + Number(r.wins || 0), 0);
  const losses = rows.reduce((n, r) => n + Number(r.losses || 0), 0);
  const resolved = wins + losses;
  return { total, wins, losses, resolved, winrate: resolved ? Math.round((wins / resolved) * 100) : null };
}

function getLearningProfile({ sport = "Football", competition = "", bet = "" } = {}) {
  const s = String(sport || "Football");
  const c = String(competition || "");
  const b = String(bet || "");
  const empty = { total: 0, wins: 0, losses: 0, resolved: 0, winrate: null };
  try {
    const sportRows = db.prepare(`
      SELECT COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM concile_analyses
      WHERE sport = ? AND outcome IN ('win','loss')
    `).all(s);
    const marketRows = db.prepare(`
      SELECT COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM concile_analyses
      WHERE sport = ? AND best_bet = ? AND outcome IN ('win','loss')
    `).all(s, b);
    const competitionRows = db.prepare(`
      SELECT COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM concile_analyses
      WHERE sport = ? AND competition = ? AND outcome IN ('win','loss')
    `).all(s, c);
    return {
      sport: s,
      competition: c,
      bet: b,
      sportStats: summarizeOutcomeRows(sportRows),
      marketStats: summarizeOutcomeRows(marketRows),
      competitionStats: summarizeOutcomeRows(competitionRows),
    };
  } catch (e) {
    console.error("[learning-profile]", e.message);
    return { sport: s, competition: c, bet: b, sportStats: empty, marketStats: empty, competitionStats: empty };
  }
}

function assessLearningProfile(profile, minResolved = 5) {
  const reasons = [];
  if (!profile) return { tier: "learning", score: 0, clientSafe: false, reasons: ["profil absent"] };
  const sportResolved = profile.sportStats?.resolved || 0;
  const marketResolved = profile.marketStats?.resolved || 0;
  const sportWinrate = profile.sportStats?.winrate;
  const marketWinrate = profile.marketStats?.winrate;
  if (sportResolved < Math.max(3, minResolved)) reasons.push(`historique sport insuffisant (${sportResolved}/${Math.max(3, minResolved)})`);
  if (marketResolved < minResolved) reasons.push(`historique marche insuffisant (${marketResolved}/${minResolved})`);
  if (sportWinrate !== null && sportWinrate < 50) reasons.push(`sport sous 50% (${sportWinrate}%)`);
  if (marketWinrate !== null && marketWinrate < 55) reasons.push(`marche sous 55% (${marketWinrate}%)`);
  const clientSafe = reasons.length === 0;
  return { tier: clientSafe ? "elite_candidate" : "learning", score: clientSafe ? 100 : Math.max(0, 70 - reasons.length * 15), clientSafe, reasons };
}

// Le nom d'une ligue pris seul est ambigu : "Canadian Premier League" contient
// "Premier League" (→ Angleterre) et "Brazilian Serie B" contient "Serie B"
// (→ Italie). Les deux erreurs étaient réellement en base le 29/07/2026 et
// faussaient l'analyse par championnat et par pays. On teste donc D'ABORD le
// gentilé ou le nom de pays explicitement présent dans l'intitulé.
const COUNTRY_BY_NATIONALITY = [
  ["Canada",       ["canadian", "canada"]],
  ["Brésil",       ["brazilian", "brasileir", "brazil", "brasil"]],
  ["Chili",        ["chilean", "chile"]],
  ["Argentine",    ["argentin"]],
  ["Mexique",      ["mexican", "mexico", "liga mx"]],
  ["Colombie",     ["colombian", "colombia"]],
  ["Pérou",        ["peruvian", "peru"]],
  ["Équateur",     ["ecuadorian", "ecuador"]],
  ["Bolivie",      ["bolivian", "bolivia"]],
  ["Uruguay",      ["uruguayan", "uruguay"]],
  ["Paraguay",     ["paraguayan", "paraguay"]],
  ["Venezuela",    ["venezuelan", "venezuela"]],
  ["Australie",    ["australian", "australia", "a-league"]],
  ["Japon",        ["japanese", "japan", "j-league", "j1 league", "j2 league"]],
  ["Corée du Sud", ["korean", "korea", "k league", "k-league"]],
  ["Chine",        ["chinese", "china"]],
  ["Inde",         ["indian", "india"]],
  ["Arabie Saoudite", ["saudi"]],
  ["Qatar",        ["qatari", "qatar"]],
  ["Émirats",      ["emirates", "uae"]],
  ["Égypte",       ["egyptian", "egypt"]],
  ["Maroc",        ["moroccan", "morocco", "botola"]],
  ["Algérie",      ["algerian", "algeria"]],
  ["Tunisie",      ["tunisian", "tunisia"]],
  ["Afrique du Sud", ["south african", "south africa"]],
  ["Nigeria",      ["nigerian", "nigeria"]],
  ["Russie",       ["russian", "russia"]],
  ["Ukraine",      ["ukrainian", "ukraine"]],
  ["Pologne",      ["polish", "poland", "ekstraklasa"]],
  ["Tchéquie",     ["czech"]],
  ["Slovaquie",    ["slovak"]],
  ["Hongrie",      ["hungarian", "hungary"]],
  ["Roumanie",     ["romanian", "romania"]],
  ["Bulgarie",     ["bulgarian", "bulgaria"]],
  ["Serbie",       ["serbian", "serbia"]],
  ["Croatie",      ["croatian", "croatia"]],
  ["Slovénie",     ["slovenian", "slovenia"]],
  ["Grèce",        ["greek", "greece", "super league greece"]],
  ["Chypre",       ["cypriot", "cyprus"]],
  ["Israël",       ["israeli", "israel"]],
  ["Autriche",     ["austrian", "austria"]],
  ["Suisse",       ["swiss", "switzerland"]],
  ["Suède",        ["swedish", "sweden", "allsvenskan", "superettan"]],
  ["Norvège",      ["norwegian", "norway", "eliteserien"]],
  ["Danemark",     ["danish", "denmark", "superliga"]],
  ["Finlande",     ["finnish", "finland", "veikkausliiga"]],
  ["Islande",      ["icelandic", "iceland"]],
  ["Irlande",      ["irish", "ireland"]],
  ["Écosse",       ["scottish", "scotland"]],
  ["Pays de Galles", ["welsh", "wales"]],
  ["Estonie",      ["estonian", "estonia"]],
  ["Lettonie",     ["latvian", "latvia"]],
  ["Lituanie",     ["lithuanian", "lithuania"]],
  ["Géorgie",      ["georgian"]],
  ["Kazakhstan",   ["kazakh"]],
  ["Turquie",      ["turkish", "turkey"]],
  ["Portugal",     ["portuguese", "portugal"]],
  ["Pays-Bas",     ["dutch", "netherlands"]],
  ["Belgique",     ["belgian", "belgium"]],
  ["Allemagne",    ["german", "germany"]],
  ["Italie",       ["italian", "italy"]],
  ["Espagne",      ["spanish", "spain"]],
  ["Angleterre",   ["english", "england"]],
  ["France",       ["french", "france"]],
  ["USA",          ["usa", "united states", "american"]],
];

function extractCountry(competition) {
  if (!competition) return null;
  // Correspondance par mot entier, pas par sous-chaîne. Trois erreurs réelles
  // corrigées par cette règle : "Copa Sudamericana" contenait "american" (→ USA),
  // et surtout "Bundesliga" contenait "liga" (→ Espagne), donc TOUS les matchs
  // allemands étaient comptabilisés en Espagne dans l'analyse par pays.
  const comp = String(competition).toLowerCase();
  const hasWord = (k) => new RegExp(
    `(^|[^a-z])${String(k).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`
  ).test(comp);
  for (const [country, keys] of COUNTRY_BY_NATIONALITY) {
    if (keys.some(hasWord)) return country;
  }
  const map = {
    "France": ["Ligue 1","Ligue 2","Coupe de France","National"],
    // "Liga" seul est trop générique : il capturait "Primeira Liga" (Portugal),
    // "Liga MX" (Mexique) et "Liga Profesional" (Argentine).
    "Espagne": ["La Liga","LaLiga","Segunda","Copa del Rey"],
    "Angleterre": ["Premier League","Championship","FA Cup","EFL","League One","League Two"],
    "Allemagne": ["Bundesliga","2. Bundesliga","DFB","3. Liga"],
    "Italie": ["Serie A","Serie B","Serie C","Coppa Italia"],
    "Portugal": ["Primeira Liga","Liga Portugal","Taça de Portugal"],
    "Pays-Bas": ["Eredivisie","Eerste Divisie","KNVB"],
    "Belgique": ["Pro League","First Division","Division 1"],
    "Turquie": ["Süper Lig","Super Lig","TFF"],
    "Brésil": ["Brasileirao","Serie A Brazil","Serie B Brazil","Serie C"],
    "USA": ["MLS","USL","NWSL","MLS Next","Major League Soccer"],
    "Chili": ["Primera Division","Copa Chile","Segunda Division"],
    "Argentine": ["Liga Profesional","Primera Nacional","Copa Argentina"],
    "International": ["World Cup","Copa América","Euro","Champions League","Europa League","Conference League","Nations League","Copa Sudamericana","Sudamericana","Libertadores","AFC","CAF","CONCACAF","FIFA"],
  };
  for (const [country, keywords] of Object.entries(map)) {
    if (keywords.some(hasWord)) return country;
  }
  return null;
}

function saveConcileAnalysis(match, result, pickBet) {
  try {
    const minute = parseInt(match.minute) || null;
    const statsStatus = result.statsStatus?.status || "unavailable";
    const id = match?.id || match?.fixtureId || match?.sourceMatchId || `${match?.home}_${match?.away}`;
    const matchKey = `${id}_${getTodayStr()}`;
    const sport = match.sport || "Football";
    const competition = match.competition || match.league || "";
    const learningProfile = getLearningProfile({ sport, competition, bet: result.best_bet });
    const learningAssessment = assessLearningProfile(learningProfile, 5);
    const betCat = categorizeBet(result.best_bet);
    const country = extractCountry(competition);
    const neutral = isNeutralComp(competition) ? 1 : 0;

    const liveStats = result.statsStatus?.stats || null;
    const homePoss = liveStats?.possession?.home ?? null;
    const awayPoss = liveStats?.possession?.away ?? null;
    const homeShots = liveStats?.shots?.home ?? liveStats?.shots_on_goal?.home ?? null;
    const awayShots = liveStats?.shots?.away ?? liveStats?.shots_on_goal?.away ?? null;

    const sigTier = computeSignalTier(result.best_bet, result.confidence, minute);

    const existing = db.prepare(
      "SELECT id, best_bet, outcome, final_score_home, resolved_at FROM concile_analyses WHERE match_key = ?"
    ).get(matchKey);
    if (existing) {
      if (isProtectedFromOverwrite(existing)) {
        console.warn(`[concile-trace] analyse résolue immuable, réanalyse ignorée: ${matchKey}`);
        return;
      }
      const betChanged = existing.best_bet !== result.best_bet;
      db.prepare(`
        UPDATE concile_analyses SET
          minute_at_analysis = ?, score_home_at_analysis = ?, score_away_at_analysis = ?,
          stats_status = ?, best_bet = ?, confidence = ?, raison = ?,
          consensus_votes = ?, agents_json = ?, pick_bet = ?,
          learning_tier = ?, learning_note = ?,
          bet_category = ?, home_possession = ?, away_possession = ?,
          home_shots = ?, away_shots = ?, real_odd = ?, real_odd_source = ?,
          signal_tier = ?, analysed_at = datetime('now')
          ${betChanged ? ", outcome = NULL, final_score_home = NULL, final_score_away = NULL, resolved_at = NULL" : ""}
        WHERE match_key = ?
      `).run(
        minute, match.score_home ?? null, match.score_away ?? null, statsStatus,
        result.best_bet, result.confidence, result.raison || "",
        result.consensus_votes || 0,
        JSON.stringify((result.agents || []).map(a => ({ name: a.name, bet: a.bet, confidence: a.confidence }))),
        pickBet || null,
        learningAssessment.tier, learningAssessment.reasons.join("; "),
        betCat, homePoss, awayPoss, homeShots, awayShots,
        result.cote ?? null, result.cote_source ?? null,
        sigTier,
        matchKey
      );
    } else {
      db.prepare(`
        INSERT INTO concile_analyses
          (match_key, home, away, competition, minute_at_analysis,
           score_home_at_analysis, score_away_at_analysis, stats_status,
           best_bet, confidence, raison, consensus_votes, agents_json, pick_bet,
           sport, learning_tier, learning_note, home_logo, away_logo,
           bet_category, country, is_neutral,
           home_possession, away_possession, home_shots, away_shots,
           real_odd, real_odd_source, signal_tier)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        matchKey,
        match.home, match.away, competition, minute,
        match.score_home ?? null, match.score_away ?? null, statsStatus,
        result.best_bet, result.confidence, result.raison || "",
        result.consensus_votes || 0,
        JSON.stringify((result.agents || []).map(a => ({ name: a.name, bet: a.bet, confidence: a.confidence }))),
        pickBet || null, sport,
        learningAssessment.tier, learningAssessment.reasons.join("; "),
        match.home_logo || null, match.away_logo || null,
        betCat, country, neutral,
        homePoss, awayPoss, homeShots, awayShots,
        result.cote ?? null, result.cote_source ?? null,
        sigTier
      );
    }
    console.log(
      `[concile-trace] saved ${matchKey} | ${match.competition || match.league || "competition inconnue"} | ` +
      `${match.home} vs ${match.away} | minute=${minute ?? "?"} | ` +
      `score=${match.score_home ?? "?"}-${match.score_away ?? "?"} | ` +
      `bet=${result.best_bet} | confidence=${result.confidence} | tier=${sigTier || "none"} | reason=${String(result.raison || "").slice(0, 180)}`
    );
    return matchKey;
  } catch(e) {
    console.error("[concile-trace] save:", e.message);
    return null;
  }
}

function getBetOutcomeForScore(bet, h, a) {
  const value = String(bet || "").trim();
  const normalized = value.toLowerCase();
  const total = Number(h) + Number(a);
  if (!value) return null;
  // Over / Under sur N'IMPORTE QUELLE ligne (0.5, 1.5, 2.5, 3.5...)
  const overM = normalized.match(/(?:over|plus de)\s*(\d+(?:\.5)?)/);
  if (overM) return total > parseFloat(overM[1]) ? "win" : "loss";
  const underM = normalized.match(/(?:under|moins de|inf[eé]rieur(?:\s*à)?)\s*(\d+(?:\.5)?)/);
  if (underM) return total < parseFloat(underM[1]) ? "win" : "loss";
  if (normalized.includes("btts oui") || normalized.includes("les deux equipes marquent") || normalized.includes("les deux équipes marquent")) return (h > 0 && a > 0) ? "win" : "loss";
  if (normalized.includes("btts non")) return (h > 0 && a > 0) ? "loss" : "win";
  if (value === "Match nul" || value === "X" || normalized.includes("nul")) return h === a ? "win" : "loss";
  if (value === "1X" || normalized.includes("1x")) return h >= a ? "win" : "loss";
  if (value === "X2" || normalized.includes("x2")) return a >= h ? "win" : "loss";
  if (value === "12" || normalized.includes("12")) return h !== a ? "win" : "loss";
  if (normalized.includes("domicile") || value === "1") return h > a ? "win" : "loss";
  if (normalized.includes("extérieur") || normalized.includes("exterieur") || value === "2") return a > h ? "win" : "loss";
  return null;
}

// Résout un pari "Victoire [nom d'équipe]" en identifiant le côté (dom/ext) via les noms.
function resolveTeamWinBet(bet, home, away, h, a) {
  const b = String(bet || "").toLowerCase();
  if (!/victoire|win|gagne|vainqueur/.test(b)) return null;
  const homeW = String(home || "").toLowerCase().split(" ")[0];
  const awayW = String(away || "").toLowerCase().split(" ")[0];
  if (homeW && homeW.length > 2 && b.includes(homeW)) return h > a ? "win" : "loss";
  if (awayW && awayW.length > 2 && b.includes(awayW)) return a > h ? "win" : "loss";
  return null;
}

function resolveConcileAnalyses(home, away, scoreHome, scoreAway) {
  if (scoreHome === null || scoreHome === undefined || scoreAway === null || scoreAway === undefined) return;
  const h = Number(scoreHome), a = Number(scoreAway);
  const total = h + a;

  function betOutcome(bet) {
    if (!bet) return null;
    if (bet === "Over 2.5 buts") return total > 2.5 ? "win" : "loss";
    if (bet === "Under 2.5 buts") return total < 2.5 ? "win" : "loss";
    if (bet === "BTTS Oui") return (h > 0 && a > 0) ? "win" : "loss";
    if (bet === "BTTS Non") return (h > 0 && a > 0) ? "loss" : "win";
    if (bet.includes("domicile") || bet === "1") return h > a ? "win" : "loss";
    if (bet.includes("extérieur") || bet === "2") return a > h ? "win" : "loss";
    if (bet === "Match nul" || bet === "X") return h === a ? "win" : "loss";
    if (bet === "1X" || bet.includes("1X")) return h >= a ? "win" : "loss";
    if (bet === "X2" || bet.includes("X2")) return a >= h ? "win" : "loss";
    if (bet === "12" || bet.includes("12")) return h !== a ? "win" : "loss";
    return null;
  }

  try {
    // LIKE brut sur le premier mot AVANT normalisation des accents : un club
    // dont le nom contient un caractere accentue (Győri, Železničar, Śląsk...)
    // pouvait rester bloque "en attente" pour toujours si la source live et
    // la ligne enregistree en base ne codaient pas l'accent EXACTEMENT pareil
    // (forme Unicode NFC/NFD differente, translitteration, corruption
    // d'encodage). Constate par Greg le 04/08/2026 sur plusieurs jours de
    // matchs jamais resolus. matchToken()/NORM() (deja utilises par le
    // rattrapage resolveStalePredictions) suppriment les accents avant de
    // comparer — memes garde-fous ici plutot qu'un LIKE naïf.
    const hw = matchToken(home), aw = matchToken(away);
    const candidates = hw && aw ? db.prepare(
      "SELECT * FROM concile_analyses WHERE outcome IS NULL AND analysed_at >= datetime('now','-30 days')"
    ).all() : [];
    const pending = candidates.filter(r => matchToken(r.home) === hw && matchToken(r.away) === aw);

    if (pending.length) {
      // PROTECTION IMMUTABILITÉ : le AND outcome IS NULL en clause WHERE garantit
      // que la DB rejette l'update si un outcome a déjà été enregistré entre le
      // SELECT et l'UPDATE (course, appel concurrent, retry auto). Immuable
      // par contrainte, pas seulement par convention applicative.
      const upd = db.prepare(`
        UPDATE concile_analyses
        SET outcome = ?,
            final_score_home = ?,
            final_score_away = ?,
            resolved_at = datetime('now'),
            result_source = ?
        WHERE id = ? AND outcome IS NULL AND final_score_home IS NULL
      `);
      pending.forEach(r => {
        const out = getBetOutcomeForScore(r.best_bet, h, a) || betOutcome(r.best_bet) || resolveTeamWinBet(r.best_bet, home, away, h, a);
        if (out) {
          upd.run(out, h, a, "api_finished_match", r.id);
          const resThreshold = getAdaptiveSignalThreshold();
          if (r.confidence >= resThreshold && TELEGRAM_BOT_TOKEN) {
            notifySignalFortResult(r, out, h, a).catch(() => {});
          }
        }
      });
      console.log(`[concile-trace] résolu ${pending.length} analyses: ${home} vs ${away} (${h}-${a})`);
    }

    // Résoudre aussi les IA du banc d'essai (shadow_evals) — indépendamment de
    // concile_analyses : avant, ça ne se déclenchait QUE si ce match avait des
    // lignes concile_analyses en attente, donc quasiment jamais pour les agents
    // du banc d'essai (Groq-Llama70B/8B, Cerebras, OpenRouter, Mistral-Small...).
    resolveShadowOutcomes(home, away, h, a);
  } catch(e) { console.error("[concile-trace] resolve:", e.message); }
}

function getConcilePerformance() {
  try {
    const byAgent = db.prepare(`
      SELECT ap.agent_name,
        COUNT(*) as total,
        SUM(CASE WHEN ap.outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN ap.outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM agent_predictions ap
      WHERE ap.outcome IS NOT NULL
      GROUP BY ap.agent_name
    `).all().map(r => ({
      agent: r.agent_name,
      total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null
    }));

    const byBet = db.prepare(`
      SELECT best_bet,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL
      GROUP BY best_bet
      ORDER BY total DESC
    `).all().map(r => ({
      bet: r.best_bet, total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null
    }));

    const byStats = db.prepare(`
      SELECT stats_status,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL
      GROUP BY stats_status
    `).all().map(r => ({
      stats: r.stats_status, total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null
    }));

    const bySport = db.prepare(`
      SELECT sport,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL
      GROUP BY sport
      ORDER BY total DESC
    `).all().map(r => ({
      sport: r.sport || "Football", total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null
    }));

    const byMinute = db.prepare(`
      SELECT
        CASE
          WHEN minute_at_analysis < 30 THEN '0-29'
          WHEN minute_at_analysis < 46 THEN '30-45'
          WHEN minute_at_analysis < 60 THEN '46-59'
          WHEN minute_at_analysis < 75 THEN '60-74'
          ELSE '75+'
        END as minute_range,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins
      FROM concile_analyses
      WHERE outcome IS NOT NULL AND minute_at_analysis IS NOT NULL
      GROUP BY minute_range
      ORDER BY minute_range
    `).all().map(r => ({
      minute: r.minute_range, total: r.total, wins: r.wins,
      winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : null
    }));

    const recent = db.prepare(`
      SELECT home, away, best_bet, confidence, minute_at_analysis,
             score_home_at_analysis, score_away_at_analysis, outcome, analysed_at
      FROM concile_analyses
      ORDER BY analysed_at DESC LIMIT 10
    `).all();

    return { byAgent, byBet, byStats, byMinute, bySport, recent };
  } catch(e) {
    console.error("[concile-perf]", e.message);
    return { byAgent: [], byBet: [], byStats: [], byMinute: [], bySport: [], recent: [] };
  }
}

// ── Agent performance tracking ────────────────────────────────────────────────
function summarizeStrategyRows(rows, labelKey) {
  return (rows || [])
    .filter(r => Number(r.total || 0) > 0)
    .map(r => ({
      label: r[labelKey] || "Inconnu",
      total: Number(r.total || 0),
      wins: Number(r.wins || 0),
      losses: Number(r.losses || 0),
      winrate: r.winrate,
      confidence: Number(r.total || 0) >= 5 ? "usable" : "sample_faible",
    }))
    .sort((a, b) => {
      const ar = a.total >= 5 ? a.winrate : -1;
      const br = b.total >= 5 ? b.winrate : -1;
      return br - ar || b.total - a.total;
    });
}

function categorizeBet(bet) {
  const b = String(bet || "").toLowerCase().trim();
  if (!b || b === "no bet") return "NO BET";
  if (b.includes("over") || b.includes("under") || b.includes("plus de") || b.includes("moins de")) return "Over/Under";
  if (b.includes("btts") || b.includes("les deux")) return "BTTS";
  if (b === "1x" || b === "x2" || b === "12" || b.includes("double chance")) return "Double Chance";
  if (b.includes("nul") || b === "x" || b.includes("draw")) return "Match Nul";
  if (b.includes("domicile") || b === "1" || b.includes("home") || b.includes("victoire") && b.includes("dom")) return "Victoire Domicile";
  if (b.includes("extérieur") || b.includes("exterieur") || b === "2" || b.includes("away")) return "Victoire Extérieur";
  return "Autre";
}

function getPronoStats() {
  try {
    // Toutes les analyses résolues avec catégorie de pari
    const allResolved = db.prepare(`
      SELECT best_bet, confidence, outcome, agents_json, sport, competition,
             home, away, analysed_at, minute_at_analysis, score_home_at_analysis, score_away_at_analysis
      FROM concile_analyses
      WHERE outcome IS NOT NULL
      ORDER BY analysed_at DESC
    `).all();

    // Grouper par catégorie de pari
    const byCategory = {};
    for (const row of allResolved) {
      const cat = categorizeBet(row.best_bet);
      if (cat === "NO BET") continue;
      if (!byCategory[cat]) byCategory[cat] = { total: 0, wins: 0, losses: 0, bets: {} };
      byCategory[cat].total++;
      if (row.outcome === "win") byCategory[cat].wins++;
      else byCategory[cat].losses++;
      // Sous-catégorie par pari exact
      const b = row.best_bet;
      if (!byCategory[cat].bets[b]) byCategory[cat].bets[b] = { total: 0, wins: 0 };
      byCategory[cat].bets[b].total++;
      if (row.outcome === "win") byCategory[cat].bets[b].wins++;
    }

    const categoryStats = Object.entries(byCategory).map(([cat, d]) => ({
      category: cat,
      total: d.total,
      wins: d.wins,
      losses: d.losses,
      winrate: d.wins + d.losses > 0 ? Math.round(d.wins / (d.wins + d.losses) * 100) : null,
      bets: Object.entries(d.bets)
        .map(([bet, s]) => ({ bet, total: s.total, wins: s.wins, winrate: s.total > 0 ? Math.round(s.wins / s.total * 100) : null }))
        .sort((a, b) => b.total - a.total),
    })).sort((a, b) => (b.winrate || 0) - (a.winrate || 0));

    // Croisement agent × catégorie de pari
    const agentRows = db.prepare(`
      SELECT ap.agent_name, ap.bet, ap.outcome
      FROM agent_predictions ap
      WHERE ap.outcome IS NOT NULL
    `).all();

    const agentByCategory = {};
    for (const row of agentRows) {
      const cat = categorizeBet(row.bet);
      if (cat === "NO BET") continue;
      if (!agentByCategory[row.agent_name]) agentByCategory[row.agent_name] = {};
      if (!agentByCategory[row.agent_name][cat]) agentByCategory[row.agent_name][cat] = { total: 0, wins: 0 };
      agentByCategory[row.agent_name][cat].total++;
      if (row.outcome === "win") agentByCategory[row.agent_name][cat].wins++;
    }

    const agentMatrix = Object.entries(agentByCategory).map(([agent, cats]) => ({
      agent,
      categories: Object.entries(cats).map(([cat, d]) => ({
        category: cat,
        total: d.total,
        wins: d.wins,
        winrate: d.total > 0 ? Math.round(d.wins / d.total * 100) : null,
      })).sort((a, b) => b.total - a.total),
      best_category: Object.entries(cats)
        .filter(([, d]) => d.total >= 5)
        .map(([cat, d]) => ({ cat, winrate: Math.round(d.wins / d.total * 100) }))
        .sort((a, b) => b.winrate - a.winrate)[0] || null,
    }));

    // Meilleur agent par catégorie
    const bestAgentPerCategory = {};
    for (const { agent, categories } of agentMatrix) {
      for (const { category, total, wins, winrate } of categories) {
        if (total < 5 || winrate === null) continue;
        if (!bestAgentPerCategory[category] || winrate > bestAgentPerCategory[category].winrate) {
          bestAgentPerCategory[category] = { agent, winrate, total };
        }
      }
    }

    // Tendance : 7 jours vs 30 jours
    const last7 = allResolved.filter(r => new Date(r.analysed_at) > new Date(Date.now() - 7 * 86400000));
    const last30 = allResolved.filter(r => new Date(r.analysed_at) > new Date(Date.now() - 30 * 86400000));
    const trend = (rows) => {
      const w = rows.filter(r => r.outcome === "win").length;
      return { total: rows.length, wins: w, winrate: rows.length > 0 ? Math.round(w / rows.length * 100) : null };
    };

    // Stats par pays
    const byCountry = db.prepare(`
      SELECT country, COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL AND country IS NOT NULL
      GROUP BY country ORDER BY total DESC
    `).all().map(r => ({
      country: r.country, total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null,
    }));

    // Stats par championnat (top 15)
    const byChampionship = db.prepare(`
      SELECT competition, sport, country, COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL AND competition != ''
      GROUP BY competition ORDER BY total DESC LIMIT 15
    `).all().map(r => ({
      competition: r.competition, sport: r.sport, country: r.country,
      total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null,
    }));

    // Stats terrain neutre vs domicile/extérieur
    const byNeutral = db.prepare(`
      SELECT is_neutral, COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins
      FROM concile_analyses WHERE outcome IS NOT NULL GROUP BY is_neutral
    `).all().map(r => ({
      context: r.is_neutral ? "Terrain neutre" : "Domicile/Extérieur",
      total: r.total, wins: r.wins,
      winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : null,
    }));

    // Stats par niveau de confiance
    const byConfidence = db.prepare(`
      SELECT
        CASE WHEN confidence >= 85 THEN '85-100%'
             WHEN confidence >= 80 THEN '80-84%'
             WHEN confidence >= 70 THEN '70-79%'
             ELSE '<70%' END as conf_range,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins
      FROM concile_analyses WHERE outcome IS NOT NULL
      GROUP BY conf_range ORDER BY conf_range DESC
    `).all().map(r => ({
      confidence: r.conf_range, total: r.total, wins: r.wins,
      winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : null,
    }));

    // Les 20 derniers pronos avec résultat
    const allResolvedFull = db.prepare(`
      SELECT home, away, sport, competition, country, best_bet, bet_category,
             confidence, outcome, minute_at_analysis,
             score_home_at_analysis, score_away_at_analysis,
             home_possession, away_possession, home_shots, away_shots,
             is_neutral, analysed_at, agents_json
      FROM concile_analyses WHERE outcome IS NOT NULL
      ORDER BY analysed_at DESC LIMIT 20
    `).all();

    const recentPronos = allResolvedFull.map(r => {
      let agents = [];
      try { agents = JSON.parse(r.agents_json || "[]"); } catch {}
      return {
        home: r.home, away: r.away, sport: r.sport,
        competition: r.competition, country: r.country,
        bet: r.best_bet, category: r.bet_category || categorizeBet(r.best_bet),
        confidence: r.confidence, outcome: r.outcome,
        minute: r.minute_at_analysis,
        score: r.score_home_at_analysis != null ? `${r.score_home_at_analysis}-${r.score_away_at_analysis}` : null,
        stats: {
          possession_home: r.home_possession, possession_away: r.away_possession,
          shots_home: r.home_shots, shots_away: r.away_shots,
        },
        neutral: r.is_neutral === 1,
        date: r.analysed_at?.slice(0, 10),
        agents: agents.map(a => ({ name: a.name, bet: a.bet, category: categorizeBet(a.bet) })),
      };
    });

    return {
      summary: {
        total_resolved: allResolved.length,
        total_wins: allResolved.filter(r => r.outcome === "win").length,
        winrate_global: allResolved.length > 0
          ? Math.round(allResolved.filter(r => r.outcome === "win").length / allResolved.length * 100)
          : null,
        trend_7j: trend(last7),
        trend_30j: trend(last30),
      },
      by_category: categoryStats,
      by_country: byCountry,
      by_championship: byChampionship,
      by_neutral: byNeutral,
      by_confidence: byConfidence,
      best_agent_per_category: bestAgentPerCategory,
      agent_matrix: agentMatrix,
      recent: recentPronos,
    };
  } catch (e) {
    console.error("[prono-stats]", e.message);
    return { error: e.message };
  }
}

function getStrategyDashboard() {
  const perf = getConcilePerformance();
  const agents = summarizeStrategyRows(perf.byAgent, "agent");
  const markets = summarizeStrategyRows(perf.byBet, "bet");
  const statsSources = summarizeStrategyRows(perf.byStats, "stats");
  const minutes = summarizeStrategyRows(perf.byMinute, "minute");
  const sports = summarizeStrategyRows(perf.bySport, "sport");

  let competitions = [];
  try {
    competitions = db.prepare(`
      SELECT competition,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL
      GROUP BY competition
      ORDER BY total DESC
      LIMIT 25
    `).all().map(r => ({
      competition: r.competition || "Inconnue",
      total: r.total,
      wins: r.wins,
      losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null,
    }));
  } catch (e) {
    console.error("[strategy-dashboard] competitions:", e.message);
  }
  const leagues = summarizeStrategyRows(competitions, "competition");

  const bestMarket = markets.find(r => r.total >= 5 && r.winrate >= 60) || markets[0] || null;
  const weakMarket = markets.find(r => r.total >= 5 && r.winrate < 45) || markets.slice().reverse().find(r => r.total >= 5) || null;
  const bestLeague = leagues.find(r => r.total >= 5 && r.winrate >= 60) || leagues[0] || null;
  const bestAgent = agents.find(r => r.total >= 8) || agents[0] || null;
  const sampleWarning = (markets[0]?.total || 0) < 5
    ? "Échantillon encore faible: on observe, on ne conclut pas."
    : null;

  const focus = bestMarket && bestMarket.total >= 5
    ? `${bestMarket.label} (${bestMarket.winrate}% sur ${bestMarket.total})`
    : "continuer à accumuler des données avant de forcer un marché";
  const avoid = weakMarket
    ? `${weakMarket.label} (${weakMarket.winrate}% sur ${weakMarket.total})`
    : "amicaux, U20/U21 et matchs sans stats live fiables";
  const leagueLine = bestLeague && bestLeague.total >= 5
    ? `Priorité compétition: ${bestLeague.label} (${bestLeague.winrate}% sur ${bestLeague.total}).`
    : "Priorité compétition: surveiller Irlande/Japon/Corée/Brésil, mais attendre plus de résultats vérifiés.";
  const agentLine = bestAgent
    ? `IA à écouter davantage: ${bestAgent.label} (${bestAgent.winrate ?? "?"}% sur ${bestAgent.total}).`
    : "IA à écouter davantage: pas encore assez de données.";

  const note = [
    `Signal principal: ${focus}.`,
    `À éviter: ${avoid}.`,
    `${leagueLine} ${agentLine}`,
  ].filter(Boolean).join("\n");

  return {
    generatedAt: new Date().toISOString(),
    note: sampleWarning ? `${sampleWarning}\n${note}` : note,
    top: {
      agents: agents.slice(0, 8),
      markets: markets.slice(0, 10),
      competitions: leagues.slice(0, 10),
      sports: sports.slice(0, 10),
      minutes: minutes.slice(0, 8),
      statsSources: statsSources.slice(0, 8),
    },
    recommendations: { focus, avoid, sampleWarning },
  };
}

function getStrongSignalAlerts(options = {}) {
  const threshold = Math.max(60, Math.min(95, Number(options.threshold || 80)));
  const minResolved = Math.max(1, Number(options.minResolved || 5));
  const maxItems = Math.max(1, Math.min(20, Number(options.limit || 10)));
  try {
    const rows = db.prepare(`
      SELECT
        ca.match_key,
        ca.home,
        ca.away,
        ca.competition,
        ca.sport,
        ca.minute_at_analysis,
        ca.score_home_at_analysis,
        ca.score_away_at_analysis,
        ca.stats_status,
        ca.best_bet,
        ca.confidence,
        ca.raison,
        ca.consensus_votes,
        ca.analysed_at,
        ca.home_logo,
        ca.away_logo,
        ms.total as market_total,
        ms.wins as market_wins,
        ms.losses as market_losses
      FROM concile_analyses ca
      LEFT JOIN (
        SELECT best_bet,
          COUNT(*) as total,
          SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
        FROM concile_analyses
        WHERE outcome IN ('win','loss')
        GROUP BY best_bet
      ) ms ON ms.best_bet = ca.best_bet
      WHERE ca.outcome IS NULL
        AND ca.confidence >= ?
        AND ca.analysed_at >= datetime('now','-3 hours')
      ORDER BY ca.confidence DESC, ca.analysed_at DESC
      LIMIT 50
    `).all(threshold);

    return rows
      .filter(r => !isLowTrustCompetition({ competition: r.competition || "" }))
      .map(r => {
        const total = Number(r.market_total || 0);
        const wins = Number(r.market_wins || 0);
        const losses = Number(r.market_losses || 0);
        const marketWinrate = wins + losses > 0 ? Math.round(wins / (wins + losses) * 100) : null;
        const profile = getLearningProfile({
          sport: r.sport || "Football",
          competition: r.competition || "",
          bet: r.best_bet || "",
        });
        const assessment = assessLearningProfile(profile, minResolved);
        const sampleOk = total >= minResolved && assessment.clientSafe;
        const sport = r.sport || "Football";
        // Pour les sports non-Football (basket, hockey, baseball) : signal éligible dès 85% de confiance
        // même sans historique suffisant (sport récent sur la plateforme)
        const highConfidence = r.confidence >= 85 && sport !== "Football";
        const eligible = sampleOk || highConfidence;
        return {
          id: r.match_key,
          home: r.home,
          away: r.away,
          sport,
          competition: r.competition || "Inconnue",
          minute: r.minute_at_analysis,
          score: `${r.score_home_at_analysis ?? "?"}-${r.score_away_at_analysis ?? "?"}`,
          bet: r.best_bet,
          confidence: r.confidence,
          consensusVotes: r.consensus_votes,
          reason: r.raison,
          analysedAt: r.analysed_at,
          statsStatus: r.stats_status,
          market: {
            total,
            wins,
            losses,
            winrate: marketWinrate,
            sampleOk,
          },
          eligible,
          blockReason: eligible ? null : `historique insuffisant sur ce marché (${total}/${minResolved})`,
          home_logo: r.home_logo || null,
          away_logo: r.away_logo || null,
        };
      })
      .filter(r => r.eligible)
      .slice(0, maxItems);
  } catch (e) {
    console.error("[strong-signals]", e.message);
    return [];
  }
}

function getAgentPerformance() {
  try {
    const rows = db.prepare(`
      SELECT agent_name,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) as pending
      FROM agent_predictions
      GROUP BY agent_name
    `).all();
    const perf = {};
    rows.forEach(r => {
      const resolved = r.wins + r.losses;
      perf[r.agent_name] = {
        total: r.total, wins: r.wins, losses: r.losses,
        pending: r.pending,
        winrate: resolved > 0 ? Math.round(r.wins / resolved * 100) : null,
        resolved,
      };
    });
    return perf;
  } catch(e) {
    console.error("[agent-perf] load:", e.message);
    return {};
  }
}

// Perf par agent × marché (Under/Over, BTTS, résultat, 1ère MT) — plus précis
// que le winrate global d'un agent : une IA peut être forte sur "Victoire
// domicile" et faible sur "BTTS". Alimente le POIDS envoyé au Chief.
function getAgentMarketPerformance() {
  try {
    const rows = db.prepare(
      "SELECT agent_name, market_line, total, winrate FROM ai_market_specialization"
    ).all();
    const perf = {};
    rows.forEach(r => {
      if (!perf[r.agent_name]) perf[r.agent_name] = {};
      perf[r.agent_name][r.market_line] = { total: r.total, winrate: r.winrate };
    });
    return perf;
  } catch (e) {
    console.error("[agent-market-perf] load:", e.message);
    return {};
  }
}
// Perf par agent × marché × championnat — troisième niveau, le plus précis :
// une IA peut être forte sur "Under 2.5" en général mais faible spécifiquement
// en Ligue 1. Demande de Greg le 02/08/2026 : utiliser tout l'historique
// (2000+ analyses) pour repondre a "quelle IA est la meilleure sur quel type
// de pari, DANS quel championnat". Lu directement dans agent_market_predictions
// (colonne competition ajoutee + backfillee plus haut), pas dans
// ai_market_specialization qui n'a pas cette dimension.
function getAgentMarketCompetitionPerformance() {
  try {
    const rows = db.prepare(`
      SELECT agent_name, market_line, competition,
        COUNT(*) AS total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) AS wins
      FROM agent_market_predictions
      WHERE outcome IS NOT NULL AND competition IS NOT NULL
      GROUP BY agent_name, market_line, competition
    `).all();
    const perf = {};
    rows.forEach(r => {
      if (!perf[r.agent_name]) perf[r.agent_name] = {};
      if (!perf[r.agent_name][r.market_line]) perf[r.agent_name][r.market_line] = {};
      perf[r.agent_name][r.market_line][r.competition] = {
        total: r.total,
        winrate: r.total > 0 ? Math.round((r.wins / r.total) * 10000) / 100 : 0,
      };
    });
    return perf;
  } catch (e) {
    console.error("[agent-market-competition-perf] load:", e.message);
    return {};
  }
}
const MARKET_LINE_BY_BET = {
  "Over 2.5 buts": "buts", "Under 2.5 buts": "buts",
  "BTTS Oui": "btts", "BTTS Non": "btts",
  "Victoire domicile": "resultat", "Victoire extérieur": "resultat", "Match nul": "resultat",
  "But en 1ère mi-temps": "mt1", "Aucun but en 1ère mi-temps": "mt1",
};
function marketLineForBet(bet) {
  return MARKET_LINE_BY_BET[bet] || null;
}

function normalizeHistoryKey(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
}

function loadHermesHistoryItems() {
  const items = [];
  for (const p of [HERMES_PICKS_PATH, "/data/picks.json"]) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      const hist = raw.history || [];
      for (const h of hist) {
        let entry;
        if (Array.isArray(h)) {
          const [date, match, prono, cote, score, status] = h;
          const parts = (match || "").split(" vs ");
          entry = { date, home: parts[0] || "", away: parts[1] || "", bet: prono || "", score, status };
        } else {
          entry = {
            date: h.date || "",
            home: h.home || "",
            away: h.away || "",
            bet: h.prono || h.bet || "",
            score: h.score || "",
            status: h.status || "",
            league: h.league || h.competition || "",
          };
        }
        const s = (entry.status || "").toUpperCase();
        if (!["GAGNE", "PERDU", "WIN", "LOSS"].includes(s)) continue;
        if (!entry.home || !entry.away) continue;
        items.push({
          id: `hermes_${entry.date}_${normalizeHistoryKey(entry.home)}_${normalizeHistoryKey(entry.away)}`,
          home: entry.home,
          away: entry.away,
          competition: entry.league || "Football",
          bet: entry.bet,
          score: entry.score || null,
          outcome: ["GAGNE", "WIN"].includes(s) ? "win" : "loss",
          resolvedAt: entry.date,
          source: "hermes",
        });
      }
      break;
    } catch { /* fichier absent ou invalide */ }
  }
  return items;
}

function getPublicHistoryItems() {
  try {
    // 1. Picks Concile (SQLite)
    const concileItems = db.prepare(`
      SELECT
        match_key, home, away, competition, sport, best_bet, confidence,
        outcome, final_score_home, final_score_away, stats_status,
        result_source, resolved_at, analysed_at, home_logo, away_logo
      FROM concile_analyses
      WHERE outcome IN ('win','loss')
        AND final_score_home IS NOT NULL
        AND final_score_away IS NOT NULL
      ORDER BY COALESCE(resolved_at, analysed_at) DESC
      LIMIT 80
    `).all().map(row => ({
      id: row.match_key,
      home: row.home,
      away: row.away,
      competition: row.competition || "Match verifie",
      sport: row.sport || "Football",
      bet: row.best_bet,
      confidence: row.confidence,
      score: `${row.final_score_home}-${row.final_score_away}`,
      outcome: row.outcome,
      resolvedAt: row.resolved_at || row.analysed_at,
      source: row.result_source || (row.stats_status === "manual_verified" ? "manual_verified" : "api_verified"),
      home_logo: row.home_logo || null,
      away_logo: row.away_logo || null,
    }));

    // 2. Picks Hermès (picks.json history)
    const hermesItems = loadHermesHistoryItems();

    // 3. Fusion + déduplication par date+équipes+pari
    const seen = new Set();
    const merged = [];
    for (const item of [...concileItems, ...hermesItems]) {
      const key = `${(item.resolvedAt || "").slice(0, 10)}_${normalizeHistoryKey(item.home)}_${normalizeHistoryKey(item.away)}_${normalizeHistoryKey(item.bet)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // 4. Tri par date décroissante
    return merged
      .sort((a, b) => (b.resolvedAt || "").localeCompare(a.resolvedAt || ""))
      .slice(0, 100);
  } catch (e) {
    console.error("[public-history]", e.message);
    return [];
  }
}

function getPredictionSnapshotKey(match) {
  const minute = parseLiveMinuteValue(match?.minute);
  const bucket = minute === null ? "prematch" : `${Math.floor(minute / AUTO_CONCILE_BUCKET_MINUTES) * AUTO_CONCILE_BUCKET_MINUTES}`;
  const score = `${match?.score_home ?? "x"}-${match?.score_away ?? "x"}`;
  const id = match?.id || match?.fixtureId || match?.sourceMatchId || `${match?.home}_${match?.away}`;
  return `${id}_${getTodayStr()}_${bucket}_${score}`;
}

// ── Multi-marchés par agent ────────────────────────────────────────────────
// Chaque agent se prononce sur TOUS les marchés (pas seulement son meilleur pari
// envoyé au Concile). On stocke tout pour découvrir quelle IA est forte sur quel
// type de pari (matrice agent × marché).
function canonicalMarketBet(line, code) {
  const c = String(code || "").toLowerCase();
  if (line === "buts")     return /o|over|plus|\+/.test(c) ? "Over 2.5 buts" : "Under 2.5 buts";
  if (line === "ou05")     return /o|over|plus|\+/.test(c) ? "Over 0.5 buts" : "Under 0.5 buts";
  if (line === "ou15")     return /o|over|plus|\+/.test(c) ? "Over 1.5 buts" : "Under 1.5 buts";
  if (line === "btts")     return /^o|oui|yes/.test(c) ? "BTTS Oui" : "BTTS Non";
  if (line === "resultat") return /^d|dom/.test(c) ? "Victoire domicile" : /^e|ext/.test(c) ? "Victoire extérieur" : "Match nul";
  if (line === "mt1")      return /^o|oui|yes/.test(c) ? "But en 1ère mi-temps" : "Aucun but en 1ère mi-temps";
  if (line === "mt1_dom")  return /^o|oui|yes/.test(c) ? "Domicile marque en 1ère mi-temps" : "Domicile ne marque pas en 1ère mi-temps";
  if (line === "mt1_ext")  return /^o|oui|yes/.test(c) ? "Extérieur marque en 1ère mi-temps" : "Extérieur ne marque pas en 1ère mi-temps";
  if (line === "mt2")      return /^o|oui|yes/.test(c) ? "But en 2ème mi-temps" : "Aucun but en 2ème mi-temps";
  if (line === "mt2_dom")  return /^o|oui|yes/.test(c) ? "Domicile marque en 2ème mi-temps" : "Domicile ne marque pas en 2ème mi-temps";
  if (line === "mt2_ext")  return /^o|oui|yes/.test(c) ? "Extérieur marque en 2ème mi-temps" : "Extérieur ne marque pas en 2ème mi-temps";
  return null;
}

function resolveMarketBet(bet, h, a, htHome, htAway) {
  const total = h + a;
  // htHome/htAway = score a la mi-temps par equipe (peut etre null si
  // inconnu). Le 2e mi-temps se deduit du score final moins la mi-temps —
  // les deux doivent etre connus pour resoudre les marches 2e MT et
  // domicile/exterieur marque en 1ere ou 2e MT.
  const htKnown = htHome != null && htAway != null;
  const htTotal = htKnown ? Number(htHome) + Number(htAway) : null;
  const secondHalfHome = htKnown ? h - Number(htHome) : null;
  const secondHalfAway = htKnown ? a - Number(htAway) : null;
  const secondHalfTotal = htKnown ? secondHalfHome + secondHalfAway : null;
  switch (bet) {
    case "Over 2.5 buts":  return total > 2.5 ? "win" : "loss";
    case "Under 2.5 buts": return total < 2.5 ? "win" : "loss";
    case "Over 0.5 buts":  return total > 0.5 ? "win" : "loss";
    case "Under 0.5 buts": return total < 0.5 ? "win" : "loss";
    case "Over 1.5 buts":  return total > 1.5 ? "win" : "loss";
    case "Under 1.5 buts": return total < 1.5 ? "win" : "loss";
    case "BTTS Oui":       return (h > 0 && a > 0) ? "win" : "loss";
    case "BTTS Non":       return (h > 0 && a > 0) ? "loss" : "win";
    case "Victoire domicile":  return h > a ? "win" : "loss";
    case "Victoire extérieur": return a > h ? "win" : "loss";
    case "Match nul":      return h === a ? "win" : "loss";
    case "But en 1ère mi-temps":       return htTotal == null ? null : (htTotal > 0 ? "win" : "loss");
    case "Aucun but en 1ère mi-temps": return htTotal == null ? null : (htTotal === 0 ? "win" : "loss");
    case "Domicile marque en 1ère mi-temps":    return htHome == null ? null : (Number(htHome) > 0 ? "win" : "loss");
    case "Domicile ne marque pas en 1ère mi-temps": return htHome == null ? null : (Number(htHome) === 0 ? "win" : "loss");
    case "Extérieur marque en 1ère mi-temps":   return htAway == null ? null : (Number(htAway) > 0 ? "win" : "loss");
    case "Extérieur ne marque pas en 1ère mi-temps": return htAway == null ? null : (Number(htAway) === 0 ? "win" : "loss");
    case "But en 2ème mi-temps":       return secondHalfTotal == null ? null : (secondHalfTotal > 0 ? "win" : "loss");
    case "Aucun but en 2ème mi-temps": return secondHalfTotal == null ? null : (secondHalfTotal === 0 ? "win" : "loss");
    case "Domicile marque en 2ème mi-temps":    return secondHalfHome == null ? null : (secondHalfHome > 0 ? "win" : "loss");
    case "Domicile ne marque pas en 2ème mi-temps": return secondHalfHome == null ? null : (secondHalfHome === 0 ? "win" : "loss");
    case "Extérieur marque en 2ème mi-temps":   return secondHalfAway == null ? null : (secondHalfAway > 0 ? "win" : "loss");
    case "Extérieur ne marque pas en 2ème mi-temps": return secondHalfAway == null ? null : (secondHalfAway === 0 ? "win" : "loss");
    default: return getBetOutcomeForScore(bet, h, a);
  }
}

function saveAgentMarketPredictions(match, agentMarketList) {
  if (!agentMarketList || !agentMarketList.length) return;
  const matchKey = getPredictionSnapshotKey(match);
  try {
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO agent_market_predictions (match_key, home, away, agent_name, market_line, bet, confidence, competition) VALUES (?,?,?,?,?,?,?,?)"
    );
    agentMarketList.forEach(am => {
      const m = am.marches || {};
      [["buts", m.buts], ["ou05", m.ou05], ["ou15", m.ou15], ["btts", m.btts], ["resultat", m.resultat],
       ["mt1", m.mt1], ["mt1_dom", m.mt1_dom], ["mt1_ext", m.mt1_ext],
       ["mt2", m.mt2], ["mt2_dom", m.mt2_dom], ["mt2_ext", m.mt2_ext]].forEach(([line, val]) => {
        if (!val) return;
        const code = typeof val === "object" ? val.p : val;
        const conf = typeof val === "object" ? (parseInt(val.c) || 60) : 60;
        const bet = canonicalMarketBet(line, code);
        if (bet) stmt.run(matchKey, match.home, match.away, am.name, line, bet, Math.min(95, Math.max(40, conf)), match.competition || null);
      });
    });
    storedOu25ConsensusCache.delete(matchKey);
  } catch (e) { console.error("[agent-market] save:", e.message); }
}

// ── Routage par specialiste (07/08/2026) ─────────────────────────────────────
// Demande du fondateur : "proposer les matchs avec les meilleurs resultats par
// IA de facon a avoir un excellent ratio".
//
// Jusqu'ici les cinq IA votaient a poids EGAL sur un marche unique. Or les
// donnees montrent qu'une IA moyenne au general peut etre excellente sur un
// marche precis, et inversement. Traiter le vote d'une IA a 45% sur "les deux
// marquent" comme celui d'une IA a 78% sur ce meme marche, c'est diluer le
// signal exploitable dans du bruit.
//
// Chaque marche est donc tranche par les IA qui y sont reellement bonnes, et on
// retient le marche ou l'accord PONDERE est le plus fort. Les avis multi-marches
// sont deja collectes et resolus (agent_market_predictions) : aucun appel IA
// supplementaire, donc aucun cout ajoute.
// Trois modes (relecture GPT/Codex du 07/08/2026, decision du fondateur) :
//   "shadow" (defaut) — le routage est CALCULE et enregistre, jamais applique.
//                       Aucun abonne n'est impacte. Sert a mesurer sur deux
//                       semaines ce qu'il aurait change avant de l'activer.
//   "actif"           — le routage decide reellement.
//   "off"             — desactive.
// Le mode shadow est le defaut volontairement : une idee saine sur le papier
// doit faire ses preuves sur les vrais resultats avant de toucher des signaux
// envoyes a des abonnes payants.
const ROUTAGE_MODE = ["shadow", "actif", "off"].includes(process.env.ROUTAGE_MODE)
  ? process.env.ROUTAGE_MODE : "shadow";
// Releve de 25 a 75 apres relecture : a 25 pronostics, un ecart de winrate est
// indiscernable du bruit, et ponderer sur du bruit degrade au lieu d'ameliorer.
const SPECIALISTE_MIN_RESOLUS = Math.max(25, Number(process.env.SPECIALISTE_MIN_RESOLUS || 75));

// Journal du mode shadow : ce que le routage AURAIT choisi, resolu plus tard
// comme n'importe quelle prediction, pour comparer sans rien risquer.
db.exec(`
  CREATE TABLE IF NOT EXISTS routage_shadow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    competition TEXT DEFAULT '',
    market_line TEXT NOT NULL,
    bet TEXT NOT NULL,
    accord INTEGER DEFAULT 0,
    experts TEXT DEFAULT '',
    confiance_reelle INTEGER DEFAULT 55,
    outcome TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT DEFAULT NULL,
    UNIQUE(match_key)
  );
`);
const _specialistesCache = { at: 0, map: {} };

function poidsSpecialistes() {
  if (Date.now() - _specialistesCache.at < 30 * 60000) return _specialistesCache.map;
  const map = {};
  try {
    db.prepare(`
      SELECT agent_name, market_line,
             SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
             SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM agent_market_predictions WHERE outcome IN ('win','loss')
      GROUP BY agent_name, market_line
    `).all().forEach(r => {
      const resolus = (r.wins || 0) + (r.losses || 0);
      if (resolus < SPECIALISTE_MIN_RESOLUS) return;
      const wr = r.wins / resolus;
      // Poids centre sur 1 : une IA a 50% pese 1, a 75% pese 1.5, a 40% pese
      // 0.8. Borne a [0.5, 1.6] pour qu'aucune IA ne puisse decider seule ni
      // etre reduite au silence sur une bonne serie ou une mauvaise passe.
      map[`${r.agent_name}|${r.market_line}`] = {
        poids: Math.max(0.5, Math.min(1.6, wr * 2)), winrate: Math.round(wr * 100), resolus,
      };
    });
  } catch (e) { console.error("[specialiste]", e.message); }
  _specialistesCache.map = map;
  _specialistesCache.at = Date.now();
  return map;
}

// Renvoie le marche ou l'accord pondere est le plus fort, ou null si aucun ne
// se detache. N'invente jamais d'avis : ne travaille que sur ceux deja emis.
function meilleurMarcheParSpecialistes(agentMarketList) {
  if (ROUTAGE_MODE === "off" || !agentMarketList || agentMarketList.length < 3) return null;
  const poids = poidsSpecialistes();
  const parLigne = {};
  agentMarketList.forEach(am => {
    const m = am.marches || {};
    Object.entries(m).forEach(([ligne, val]) => {
      if (!val) return;
      const code = typeof val === "object" ? val.p : val;
      const bet = canonicalMarketBet(ligne, code);
      if (!bet) return;
      const sp = poids[`${am.name}|${ligne}`];
      const w = sp ? sp.poids : 1;
      parLigne[ligne] = parLigne[ligne] || { total: 0, choix: {}, experts: [] };
      parLigne[ligne].total += w;
      parLigne[ligne].choix[bet] = (parLigne[ligne].choix[bet] || 0) + w;
      if (sp && sp.winrate >= 60) parLigne[ligne].experts.push(`${am.name} ${sp.winrate}%`);
    });
  });

  let meilleur = null;
  Object.entries(parLigne).forEach(([ligne, d]) => {
    const [bet, score] = Object.entries(d.choix).sort((a, b) => b[1] - a[1])[0] || [];
    if (!bet || !d.total) return;
    const accord = score / d.total;
    // Exige une vraie majorite ponderee, pas une pluralite de justesse.
    if (accord < 0.6) return;
    // A accord egal, on prefere le marche ou des specialistes se sont exprimes.
    const rang = accord + (d.experts.length * 0.02);
    if (!meilleur || rang > meilleur.rang) {
      meilleur = { ligne, bet, accord: Math.round(accord * 100), rang, experts: d.experts };
    }
  });
  return meilleur;
}

function resolveAgentMarketPredictions(home, away, h, a, htHome, htAway) {
  try {
    const hw = String(home || "").split(" ")[0];
    const aw = String(away || "").split(" ")[0];
    if (!hw || !aw) return;
    const pending = db.prepare(
      "SELECT * FROM agent_market_predictions WHERE home LIKE ? AND away LIKE ? AND outcome IS NULL"
    ).all(`%${hw}%`, `%${aw}%`);
    if (!pending.length) return;
    const upd = db.prepare("UPDATE agent_market_predictions SET outcome = ? WHERE id = ?");
    let n = 0;
    pending.forEach(p => { const o = resolveMarketBet(p.bet, h, a, htHome, htAway); if (o) { upd.run(o, p.id); n++; } });
    if (n) console.log(`[agent-market] résolu ${n}/${pending.length} avis marché: ${home} vs ${away}`);
  } catch (e) { console.error("[agent-market] resolve:", e.message); }
  // Meme resolution pour le journal du mode shadow : sans issue tranchee, la
  // comparaison "ce que le routage aurait donne" n'aurait aucune valeur.
  try {
    const hw = String(home || "").split(" ")[0];
    const aw = String(away || "").split(" ")[0];
    if (!hw || !aw) return;
    const sh = db.prepare("SELECT id, bet FROM routage_shadow WHERE home LIKE ? AND away LIKE ? AND outcome IS NULL")
      .all(`%${hw}%`, `%${aw}%`);
    if (!sh.length) return;
    const up = db.prepare("UPDATE routage_shadow SET outcome = ?, resolved_at = datetime('now') WHERE id = ?");
    let m = 0;
    sh.forEach(r => { const o = resolveMarketBet(r.bet, h, a, htHome, htAway); if (o) { up.run(o, r.id); m++; } });
    if (m) console.log(`[routage-shadow] résolu ${m}/${sh.length}: ${home} vs ${away}`);
  } catch (e) { console.error("[routage-shadow] resolve:", e.message); }
}

function saveAgentPredictions(match, agentResults) {
  const matchKey = getPredictionSnapshotKey(match);
  try {
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO agent_predictions (match_key, home, away, agent_name, bet, confidence) VALUES (?,?,?,?,?,?)"
    );
    // Un agent qui n'a rien renvoye produisait une ligne avec bet="—". Ces
    // lignes ne peuvent JAMAIS etre resolues (il n'y a pas de pronostic a
    // confronter au score) : elles restaient donc eternellement "en attente"
    // et representaient 66% des predictions non resolues (10 689 sur 16 241,
    // mesure le 06/08/2026). Elles faussaient le taux de resolution affiche
    // et noyaient les vraies predictions en attente dans les journaux.
    // On ne les enregistre plus — une non-reponse n'est pas une prediction.
    let ignorees = 0;
    agentResults.forEach(a => {
      const bet = String(a.bet || "").trim();
      if (!bet || bet === "—" || bet === "-" || bet === "N/A") { ignorees++; return; }
      stmt.run(matchKey, match.home, match.away, a.name, bet, a.confidence ?? 55);
    });
    if (ignorees) console.log(`[agent-perf] ${ignorees} agent(s) sans pronostic exploitable — non enregistres`);
    console.log(`[agent-perf] ${agentResults.length} prédictions sauvegardées: ${match.home} vs ${match.away}`);
  } catch(e) { console.error("[agent-perf] save:", e.message); }
}

function getFinalScoreFromPick(pick) {
  if (!pick) return null;
  const directHome = pick.score_home ?? pick.home_score;
  const directAway = pick.score_away ?? pick.away_score;
  if (directHome !== undefined && directHome !== null && directAway !== undefined && directAway !== null) {
    const h = Number(directHome);
    const a = Number(directAway);
    if (Number.isFinite(h) && Number.isFinite(a)) return { score_home: h, score_away: a };
  }
  const match = String(pick.score || "").trim().match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!match) return null;
  return { score_home: Number(match[1]), score_away: Number(match[2]) };
}

// ── PROTECTION IMMUTABILITÉ ──────────────────────────────────────────────
// Toute résolution stockée en base est IMMUABLE. On refuse toute mise à jour
// qui écraserait un outcome, un score final ou une valeur déjà renseignée.
// Seul un admin peut passer par /admin/resolve-match (traçabilité complète).
function isProtectedFromOverwrite(existing) {
  if (!existing) return false;
  return existing.outcome != null
      || existing.final_score_home != null
      || existing.resolved_at != null;
}

function autoResolvePredictions(match) {
  const { home, away, score_home, score_away } = match;
  if (score_home === null || score_home === undefined || score_away === null || score_away === undefined) return;

  const h = Number(score_home), a = Number(score_away);
  const total = h + a;
  const betResults = {};

  // Marchés buts
  betResults["Over 2.5 buts"] = total > 2.5 ? "win" : "loss";
  betResults["Under 2.5 buts"] = total < 2.5 ? "win" : "loss";

  // 1X2 et double chance
  if (h > a) {
    betResults["Victoire domicile"] = "win"; betResults["Victoire extérieur"] = "loss"; betResults["Match nul"] = "loss";
    betResults["Double chance 1X"] = "win"; betResults["Double chance X2"] = "loss";
  } else if (a > h) {
    betResults["Victoire extérieur"] = "win"; betResults["Victoire domicile"] = "loss"; betResults["Match nul"] = "loss";
    betResults["Double chance 1X"] = "loss"; betResults["Double chance X2"] = "win";
  } else {
    betResults["Match nul"] = "win"; betResults["Victoire domicile"] = "loss"; betResults["Victoire extérieur"] = "loss";
    betResults["Double chance 1X"] = "win"; betResults["Double chance X2"] = "win";
  }

  // BTTS
  betResults["BTTS Oui"] = (h > 0 && a > 0) ? "win" : "loss";
  betResults["BTTS Non"] = (h > 0 && a > 0) ? "loss" : "win";

  try {
    // Meme correctif que resolveConcileAnalyses : LIKE brut sans normaliser
    // les accents laissait des clubs comme "Győri"/"Železničar" bloques "en
    // attente" indefiniment. matchToken()/NORM() suppriment l'accent avant
    // de comparer. Constate par Greg le 04/08/2026.
    const hw = matchToken(home), aw = matchToken(away);
    const candidates = hw && aw ? db.prepare(
      "SELECT * FROM agent_predictions WHERE outcome IS NULL AND created_at >= datetime('now','-30 days')"
    ).all() : [];
    const pending = candidates.filter(p => matchToken(p.home) === hw && matchToken(p.away) === aw);

    if (pending.length) {
      const updateStmt = db.prepare("UPDATE agent_predictions SET outcome = ? WHERE id = ?");
      let resolved = 0;
      pending.forEach(p => {
        // getBetOutcomeForScore gère bien plus de variantes de libellés
        // ("Plus de 2.5", "moins de 2.5", domicile/extérieur, 1X/X2/12...).
        // betResults reste un filet de secours pour les libellés exacts.
        const outcome = getBetOutcomeForScore(p.bet, h, a) || betResults[p.bet] || resolveTeamWinBet(p.bet, home, away, h, a) || null;
        if (outcome) { updateStmt.run(outcome, p.id); resolved++; }
      });
      console.log(`[agent-perf] Auto-résolu ${resolved}/${pending.length} prédictions: ${home} vs ${away} (${h}-${a})`);
    }
  } catch(e) { console.error("[agent-perf] auto-resolve:", e.message); }

  // Résoudre aussi les avis multi-marchés de chaque agent — htHome/htAway
  // separes (pas juste le total) pour pouvoir resoudre "domicile/exterieur
  // marque en 1ere/2e mi-temps", pas seulement "un but en 1ere mi-temps".
  const htHome = match.ht_home != null ? Number(match.ht_home) : null;
  const htAway = match.ht_away != null ? Number(match.ht_away) : null;
  resolveAgentMarketPredictions(home, away, h, a, htHome, htAway);

  // Résoudre aussi les traces Concile
  resolveConcileAnalyses(home, away, score_home, score_away);
}

// ── Rattrapage : résout les prédictions en attente dont le match est fini mais
// qui sont sorties de la fenêtre live (matchs de plus de quelques heures/jours).
// Sans ça, une prédiction reste "en attente" pour toujours → leaderboard faussé.

// Normalise un nom d'équipe : minuscules + suppression des accents (« Göteborg »
// → « goteborg »), pour que le rapprochement API↔DB ne casse pas sur les accents.
const NORM = (s) => stripSpecialLatin(String(s || "").toLowerCase()).normalize("NFD").replace(/[̀-ͯ]/g, "");
// Préfixes de clubs trop génériques pour identifier un match (« FC », « AC »…).
const GENERIC_CLUB_TOKENS = new Set([
  "fc", "ac", "sc", "afc", "cf", "sk", "fk", "us", "as", "ss", "ssc", "cd",
  "ca", "sv", "sd", "rc", "cs", "if", "bk", "ff", "ik", "nk", "hnk", "kf",
  "club", "real", "sporting", "athletic", "deportivo", "atletico", "united", "city",
]);
// Renvoie le mot le plus distinctif d'un nom d'équipe (ignore les préfixes
// génériques). « FC Levadia Tallinn » → « levadia », pas « fc ».
function matchToken(name) {
  const words = NORM(name).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => w.length >= 3 && !GENERIC_CLUB_TOKENS.has(w));
  const pool = meaningful.length ? meaningful : words;
  return pool.sort((a, b) => b.length - a.length)[0] || "";
}

/**
 * Clé canonique d'une rencontre, insensible aux variantes de nom entre sources.
 *
 * Deux APIs nomment rarement une équipe pareil (« Dila » / « Dila Gori »,
 * « Riga » / « Riga FC », « Mjällby » / « Mjallby AIF »). Les dédoublonnages
 * comparaient les noms caractère par caractère : le même match passait donc deux
 * fois. Constaté sur le bilan du 28/07/2026 diffusé aux abonnés, où le même
 * Apollon Limassol – Dila (4-0) apparaissait avec DEUX pronostics opposés
 * (Over 2.5 gagnant ET Under 2.5 perdant) — l'un devait forcément perdre, et le
 * winrate affiché était calculé sur des doublons.
 *
 * On s'appuie sur matchToken (mot distinctif, accents et préfixes FC/AC ignorés),
 * déjà utilisé pour la résolution des scores et la fusion des matchs live.
 */
// Garde-fou persistant anti-doublon (02/08/2026) : _signalSentCache (Set en
// memoire) ne survit pas a un redemarrage du conteneur, et sa cle par HEURE
// laissait passer un second signal si le match franchissait une frontiere
// d'heure entre deux scans. Constate concretement : "Corinthians vs Remo"
// diffuse deux fois le meme jour (45e puis 69e minute, meme pari, meme
// cote). Cette verification interroge la base (source de verite qui
// survit aux redemarrages) avant tout envoi.
// Dedoublonnage par preuve Telegram et par canal client.
// Un passage dans Hermes ou un diffusion_block vide ne prouve jamais qu'un
// abonne a recu le signal. Seule une livraison Telegram client reussie compte.
function signalDeliveredToChannelToday(match, channel) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const key = canonicalMatchKey(match.home, match.away);
    const rows = db.prepare(`
      SELECT ca.home, ca.away
      FROM telegram_signal_deliveries td
      JOIN concile_analyses ca ON ca.match_key = td.match_key
      WHERE td.channel = ? AND td.ok = 1
        AND td.telegram_message_id IS NOT NULL
        AND date(td.created_at) = ?
    `).all(channel, todayStr);
    return rows.some((r) => canonicalMatchKey(r.home, r.away) === key);
  } catch (e) {
    console.error("[signal-fort] signalDeliveredToChannelToday:", e.message);
    return false;
  }
}

function alreadySignaledToday(match) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const key = canonicalMatchKey(match.home, match.away);
    // diffusion_block IS NULL, PAS signal_tier IS NOT NULL : signal_tier n'est
    // qu'une CLASSIFICATION de confiance (computeSignalTier), posee des qu'un
    // seuil est franchi, INDEPENDAMMENT du filtre qualite/cote/ligue/feminin
    // qui vient apres. Bug reel deploye le 02/08/2026 : avec signal_tier, un
    // match dont la 1ere passe etait classee "elite" mais bloquee par un
    // filtre plus loin faisait croire aux passes suivantes qu'un signal etait
    // "deja envoye", alors qu'aucun message n'etait jamais parti — plus aucun
    // signal reel ne sortait. diffusion_block est ecrit APRES tous les
    // filtres (null = vraiment diffuse, sinon le motif exact du blocage).
    const rows = db.prepare(
      "SELECT home, away FROM concile_analyses WHERE date(analysed_at) = ? AND diffusion_block IS NULL"
    ).all(todayStr);
    return rows.some((r) => canonicalMatchKey(r.home, r.away) === key);
  } catch (e) {
    console.error("[signal-fort] alreadySignaledToday:", e.message);
    return false; // en cas d'erreur de lecture, ne jamais bloquer un vrai signal
  }
}

function canonicalMatchKey(home, away, day) {
  const h = matchToken(home) || NORM(home);
  const a = matchToken(away) || NORM(away);
  return day ? `${h}_${a}_${String(day).slice(0, 10)}` : `${h}_${a}`;
}

/**
 * Retire les doublons d'une liste d'analyses en comparant les noms de façon
 * tolérante aux variantes de source.
 *
 * Départage, dans l'ordre :
 *   1. une ligne résolue (win/loss) l'emporte sur une ligne en attente ;
 *   2. à statut égal, la PLUS ANCIENNE l'emporte — c'est le signal réellement
 *      diffusé en premier aux abonnés.
 *
 * Le critère d'ancienneté n'est pas un détail : deux analyses d'un même match
 * peuvent porter des pronostics OPPOSÉS (constaté le 28/07/2026 : Over 2.5
 * gagnant et Under 2.5 perdant sur Apollon Limassol – Dila 4-0). Garder
 * « la première rencontrée » revenait à conserver le gagnant et à gonfler le
 * winrate affiché — exactement ce que la règle ANJ interdit. L'ancienneté est
 * neutre, déterministe, et correspond à ce que l'abonné a réellement reçu.
 */
function dedupeAnalysesByMatch(rows) {
  const resolved = (x) => x && (x.outcome === "win" || x.outcome === "loss");
  const stamp = (x) => String(x?.analysed_at || x?.created_at || "");
  const best = new Map();
  for (const r of rows || []) {
    const key = canonicalMatchKey(r.home, r.away, r.analysed_at || r.created_at);
    const previous = best.get(key);
    if (!previous) { best.set(key, r); continue; }
    if (resolved(r) && !resolved(previous)) { best.set(key, r); continue; }
    if (resolved(r) === resolved(previous) && stamp(r) < stamp(previous)) best.set(key, r);
  }
  // Deuxieme passe : deux cles exactes differentes peuvent malgre tout designer
  // le meme match reel si les sources l'ont nomme differemment (ex.
  // "Zalaegerszegi TE" / "Zalaegerszeg", suffixe adjectival hongrois "-i").
  // canonicalMatchKey exige une egalite stricte du token dominant ; on rattrape
  // ici les cas proches avec la meme tolerance que la fusion des flux live
  // (sameLiveTeams). Constate par Greg le 03/08/2026 sur /performances : la
  // meme rencontre affichee deux fois avec deux confiances differentes.
  const merged = [];
  for (const r of best.values()) {
    const day = String(r.analysed_at || r.created_at || "").slice(0, 10);
    const dupIdx = merged.findIndex(m =>
      String(m.analysed_at || m.created_at || "").slice(0, 10) === day && sameLiveTeams(m, r)
    );
    if (dupIdx < 0) { merged.push(r); continue; }
    const dup = merged[dupIdx];
    if (resolved(r) && !resolved(dup)) { merged[dupIdx] = r; continue; }
    if (resolved(r) === resolved(dup) && stamp(r) < stamp(dup)) merged[dupIdx] = r;
  }
  return merged;
}

let staleResolveRunning = false;
async function resolveStalePredictions() {
  if (staleResolveRunning || (!FOOTBALL_DATA_KEY && !API_SPORTS_KEY)) return;
  staleResolveRunning = true;
  try {
    const staleRows = db.prepare(`
      SELECT DISTINCT home, away, sport, competition, substr(created_at, 1, 10) AS day FROM (
        SELECT home, away, 'Football' AS sport, '' AS competition, created_at FROM agent_predictions WHERE outcome IS NULL
        UNION ALL
        SELECT home, away, 'Football' AS sport, '' AS competition, created_at FROM agent_market_predictions WHERE outcome IS NULL
        UNION ALL
        SELECT home, away, COALESCE(sport, 'Football') AS sport, COALESCE(competition, '') AS competition, analysed_at AS created_at FROM concile_analyses WHERE outcome IS NULL
        UNION ALL
        SELECT home, away, 'Football' AS sport, '' AS competition, created_at FROM shadow_evals WHERE outcome IS NULL
      ) WHERE created_at <= datetime('now','-90 minutes')
        AND created_at >= datetime('now','-30 days')
    `).all();
    if (!staleRows.length) return;

    // Dédupe des paires à résoudre
    const stale = [];
    const seenPair = new Set();
    for (const r of staleRows) {
      const k = `${r.home}|${r.away}`;
      if (seenPair.has(k)) continue;
      seenPair.add(k); stale.push(r);
    }

    // On ne requête l'API QUE pour les dates et sports réellement en attente.
    // Avant : 6 jours × 3 sports à CHAQUE passage (~10 appels/20 min → quota
    // api-sports gratuit cramé en 1-2 h, d'où les matchs du soir jamais résolus).
    const today = new Date().toISOString().slice(0, 10);
    const neededDates = new Set([today]);
    const neededSports = new Set();
    for (const r of staleRows) {
      if (r.day) neededDates.add(r.day);
      neededSports.add(String(r.sport || "Football"));
    }
    const dates = [...neededDates].sort().slice(-30);

    const finished = [];

    // Source 1 : football-data — une seule requête couvre 7 jours de matchs finis
    if (FOOTBALL_DATA_KEY) {
      try {
        const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const d = await httpGet(
          `https://api.football-data.org/v4/matches?status=FINISHED&dateFrom=${from}&dateTo=${today}`,
          { "X-Auth-Token": FOOTBALL_DATA_KEY }
        );
        finished.push(...(d.matches || []).map(formatFDMatch).filter(m => m.score_home !== null && m.score_away !== null));
      } catch (e) { console.error("[catch-up] football-data:", e.message); }
    }

    // Source 2 : api-sports — uniquement les dates/sports en attente (quota maîtrisé).
    // status=FT-AET-PEN : capture aussi les matchs allés en prolongation / tab
    // (fréquent sur les qualifs européennes à double confrontation).
    if (API_SPORTS_KEY) {
      for (const date of dates) {
        if (neededSports.has("Football")) {
          try {
            const data = await httpGet(
              `https://v3.football.api-sports.io/fixtures?date=${date}&status=FT-AET-PEN`,
              { "x-apisports-key": API_SPORTS_KEY }
            );
            const items = (data.response || []).map(normalizeApiSportsFootballFixture)
              .filter(m => m.score_home !== null && m.score_away !== null);
            finished.push(...items);
          } catch (e) { console.error("[catch-up] api-sports football:", e.message); }
        }
        if (neededSports.has("Basketball")) {
          try {
            const data = await httpGet(
              `https://v1.basketball.api-sports.io/games?date=${date}&status=FT`,
              { "x-apisports-key": API_SPORTS_KEY }
            );
            (data.response || []).forEach(g => {
              if (g.teams?.home?.name && g.teams?.away?.name && g.scores?.home?.total != null) {
                finished.push({
                  home: g.teams.home.name, away: g.teams.away.name,
                  score_home: g.scores.home.total, score_away: g.scores.away.total,
                });
              }
            });
          } catch (e) { console.error("[catch-up] api-sports basketball:", e.message); }
        }
        if (neededSports.has("Hockey")) {
          try {
            const data = await httpGet(
              `https://v1.hockey.api-sports.io/games?date=${date}&status=FT`,
              { "x-apisports-key": API_SPORTS_KEY }
            );
            (data.response || []).forEach(g => {
              if (g.teams?.home?.name && g.teams?.away?.name && g.scores?.home != null) {
                finished.push({
                  home: g.teams.home.name, away: g.teams.away.name,
                  score_home: g.scores.home, score_away: g.scores.away,
                });
              }
            });
          } catch (e) { console.error("[catch-up] api-sports hockey:", e.message); }
        }
        if (neededSports.has("Baseball")) {
          try {
            const data = await httpGet(
              `https://v1.baseball.api-sports.io/games?date=${date}&status=FT`,
              { "x-apisports-key": API_SPORTS_KEY }
            );
            (data.response || []).forEach(g => {
              const sh = g.scores?.home?.total ?? g.scores?.home;
              const sa = g.scores?.away?.total ?? g.scores?.away;
              if (g.teams?.home?.name && g.teams?.away?.name && sh != null && sa != null) {
                finished.push({
                  home: g.teams.home.name, away: g.teams.away.name,
                  score_home: sh, score_away: sa,
                });
              }
            });
          } catch (e) { console.error("[catch-up] api-sports baseball:", e.message); }
        }
      }
    }

    if (!finished.length) return;

    // Rapprochement robuste : mot distinctif + normalisation accents.
    let resolvedMatches = 0;
    for (const s of stale) {
      const hw = matchToken(s.home);
      const aw = matchToken(s.away);
      if (!hw || !aw) continue;
      let m = finished.find(f => {
        const fh = NORM(f.home);
        const fa = NORM(f.away);
        return (fh.includes(hw) && fa.includes(aw)) || (fh.includes(aw) && fa.includes(hw));
      });
      // Repli flou : variante orthographique a 1-2 lettres pres (ex: "Polissya"
      // chez nous / "Polessya" chez api-sports — translitteration differente
      // selon la source, constate le 31/07/2026 sur Zhytomyr). Un seul cote
      // peut etre flou, l'autre doit rester une inclusion stricte pour eviter
      // de rapprocher deux matchs differents.
      if (!m) {
        m = finished.find(f => {
          const fh = NORM(f.home);
          const fa = NORM(f.away);
          const homeStrict = fh.includes(hw), awayStrict = fa.includes(aw);
          if (homeStrict && !awayStrict && aw.length >= 6) {
            return teamPlaceWords(f.away).some(w => levenshteinAtMost(w, aw, 2));
          }
          if (awayStrict && !homeStrict && hw.length >= 6) {
            return teamPlaceWords(f.home).some(w => levenshteinAtMost(w, hw, 2));
          }
          return false;
        });
      }
      // Dernier repli, scope compétition : quand les deux mots-clés d'équipe
      // restent trop différents (transliteration cyrillique/latine, nom
      // complet vs raccourci), on restreint d'abord aux matchs de la MEME
      // ligue/pays (mot distinctif partagé dans le nom de competition), puis
      // on accepte une tolerance plus large sur les deux cotes a la fois —
      // le scope competition rend ce relachement sur sans risque de
      // rapprocher deux matchs differents. Demande explicite de Greg le
      // 31/07/2026 : "voir les matchs du pays et de la ligue en question,
      // et le nom qui se rapproche le plus".
      if (!m && s.competition) {
        const compWordsA = new Set(NORM(s.competition).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 4));
        if (compWordsA.size) {
          const sameCompetition = finished.filter((f) => {
            if (!f.competition) return false;
            const compWordsB = NORM(f.competition).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
            return compWordsB.some((w) => compWordsA.has(w));
          });
          m = sameCompetition.find((f) => {
            const fh = NORM(f.home), fa = NORM(f.away);
            const homeClose = fh.includes(hw) || teamPlaceWords(f.home).some((w) => levenshteinAtMost(w, hw, 3));
            const awayClose = fa.includes(aw) || teamPlaceWords(f.away).some((w) => levenshteinAtMost(w, aw, 3));
            return homeClose && awayClose;
          });
        }
      }
      if (m) {
        // Réordonne le score si le match a été trouvé dans le sens inverse
        const reversed = NORM(m.home).includes(aw) && !NORM(m.home).includes(hw);
        autoResolvePredictions({
          home: s.home, away: s.away,
          score_home: reversed ? m.score_away : m.score_home,
          score_away: reversed ? m.score_home : m.score_away,
          ht_home: reversed ? m.ht_away : m.ht_home,
          ht_away: reversed ? m.ht_home : m.ht_away,
        });
        resolvedMatches++;
      }
    }
    if (resolvedMatches) {
      console.log(`[catch-up] ${resolvedMatches}/${stale.length} matchs en attente résolus (football-data + api-sports)`);
      // Propage immediatement le score au pick du jour au lieu d'attendre le
      // prochain passage horaire de refreshDailyPickFromDB — sinon un match
      // resolu ici pouvait mettre jusqu'a ~1h20 (20 min de cycle + 1h de
      // refresh) avant d'apparaitre sur le site, au-dela du delai d'1h maximum
      // demande par Greg le 01/08/2026.
      try { refreshDailyPickFromDB(); } catch (e) { console.error("[catch-up] refresh pick du jour:", e.message); }
    }

    // Expiration : au-dela d'un certain age, une prediction non resolue ne le
    // sera jamais et doit sortir du statut "en attente" (constate le 04/08/2026 —
    // le plan gratuit api-sports refuse categoriquement les dates anciennes pour
    // Basketball/Hockey/Baseball : "Free plans do not have access to this date").
    // outcome='pending' (et non NULL) la sort des compteurs "en attente" ET des
    // stats win/loss (toutes les requetes de stats du fichier excluent deja
    // outcome != 'pending' — convention reprise ici, pas inventee).
    try {
      // 2 jours (pas 5) : le plan gratuit api-sports pour Basketball/Hockey/
      // Baseball ne couvre qu'une fenetre glissante d'environ 3 jours autour
      // d'aujourd'hui ("Free plans do not have access to this date" constate
      // le 04/08/2026 sur une date vieille de 11 jours) — passe ce delai, la
      // resolution automatique est structurellement impossible.
      const expireNonFootball = db.prepare(`
        UPDATE concile_analyses SET outcome = 'pending'
        WHERE outcome IS NULL AND sport IS NOT NULL AND sport != 'Football'
          AND analysed_at <= datetime('now','-2 days')
      `).run();
      const expireOld = db.prepare(`
        UPDATE concile_analyses SET outcome = 'pending'
        WHERE outcome IS NULL AND analysed_at <= datetime('now','-30 days')
      `).run();
      const expireAgentOld = db.prepare(`
        UPDATE agent_predictions SET outcome = 'pending'
        WHERE outcome IS NULL AND created_at <= datetime('now','-30 days')
      `).run();
      const expireAgentMarketOld = db.prepare(`
        UPDATE agent_market_predictions SET outcome = 'pending'
        WHERE outcome IS NULL AND created_at <= datetime('now','-30 days')
      `).run();
      const n = expireNonFootball.changes + expireOld.changes + expireAgentOld.changes + expireAgentMarketOld.changes;
      if (n) console.log(`[catch-up] ${n} analyses invérifiables expirées (retirées de "en attente", exclues des stats)`);
    } catch (e) { console.error("[catch-up] expiration:", e.message); }
  } catch (e) {
    console.error("[catch-up] resolveStalePredictions:", e.message);
  } finally {
    staleResolveRunning = false;
  }
}
// Toutes les 20 min + un premier passage 30s après le démarrage
setInterval(resolveStalePredictions, 20 * 60 * 1000);
setTimeout(resolveStalePredictions, 30 * 1000);

let signalFortResolveRunning = false;
async function resolveSignalFortFast() {
  if (signalFortResolveRunning || !API_SPORTS_KEY) return;
  signalFortResolveRunning = true;
  try {
    const sfThreshold = getAdaptiveSignalThreshold();
    const pending = db.prepare(`
      SELECT DISTINCT home, away, competition, analysed_at FROM concile_analyses
      WHERE outcome IS NULL AND confidence >= ?
        AND analysed_at <= datetime('now','-90 minutes')
        AND analysed_at >= datetime('now','-48 hours')
      LIMIT 30
    `).all(sfThreshold);
    if (!pending.length) return;

    const finished = [];
    for (let d = 0; d < 2; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      try {
        const data = await httpGet(
          `https://v3.football.api-sports.io/fixtures?date=${date}&status=FT`,
          { "x-apisports-key": API_SPORTS_KEY }
        );
        (data.response || []).forEach(f => {
          if (f.teams?.home?.name && f.goals?.home != null) {
            finished.push({
              home: f.teams.home.name, away: f.teams.away.name,
              competition: f.league?.name || "",
              date: f.fixture?.date || date,
              score_home: f.goals.home, score_away: f.goals.away,
              ht_home: f.score?.halftime?.home ?? null,
              ht_away: f.score?.halftime?.away ?? null,
            });
          }
        });
      } catch {}
    }
    if (!finished.length) return;

    let resolved = 0;
    for (const s of pending) {
      const analysedDay = String(s.analysed_at || "").slice(0, 10);
      const matches = finished.filter(f => {
        const finishedDay = String(f.date || "").slice(0, 10);
        return (!analysedDay || !finishedDay || analysedDay === finishedDay) && sameLiveTeams(s, f);
      });
      // Zéro ou plusieurs correspondances : aucune résolution automatique.
      if (matches.length !== 1) {
        if (matches.length > 1) console.warn(`[signal-fort-fast] correspondance ambiguë ignorée: ${s.home} vs ${s.away}`);
        continue;
      }
      const m = matches[0];
      if (m) {
        const reversed = matchToken(m.home) === matchToken(s.away);
        autoResolvePredictions({
          home: s.home, away: s.away,
          score_home: reversed ? m.score_away : m.score_home,
          score_away: reversed ? m.score_home : m.score_away,
          ht_home: reversed ? m.ht_away : m.ht_home,
          ht_away: reversed ? m.ht_home : m.ht_away,
        });
        resolved++;
      }
    }
    if (resolved) console.log(`[signal-fort-fast] ${resolved}/${pending.length} signaux forts résolus`);
  } catch (e) {
    console.error("[signal-fort-fast]", e.message);
  } finally {
    signalFortResolveRunning = false;
  }
}
setInterval(resolveSignalFortFast, 10 * 60 * 1000);
setTimeout(resolveSignalFortFast, 2 * 60 * 1000);

let autoConcileObserverRunning = false;

// Compétitions UEFA (y compris tours de qualification Europa/Conference/Champions)
// — fiables même quand elles opposent de petits clubs, donc autorisées en auto-concile.
function isUefaCompetition(match) {
  const comp = String(match?.competition || match?.league || "").toLowerCase();
  return /uefa|champions league|europa league|conference league|europa conference/.test(comp);
}

// Les TOURS DE QUALIFICATION des coupes d'Europe (juillet–août) opposent souvent
// de petits clubs de nations mineures (Estonie, Gibraltar, Géorgie, Arménie…) :
// matchs imprévisibles, sans source de résultat fiable → à écarter des picks et
// de la vitrine. Les phases de ligue / finales (sept.–mai) restent premium.
function isUefaQualifier(match) {
  if (!isUefaCompetition(match)) return false;
  const comp = String(match?.competition || match?.league || "").toLowerCase();
  // Mention explicite d'un tour de qualif si l'API la fournit
  if (/qualif|preliminar|play-?off|1st round|2nd round|3rd round/.test(comp)) return true;
  // Heuristique calendaire : en juillet/août, toute rencontre de coupe d'Europe
  // de clubs est un tour de qualif (les phases principales démarrent mi-septembre).
  const dstr = match?.date || match?.analysed_at || match?.kickoffUtc || match?.time || "";
  const d = dstr ? new Date(String(dstr).replace(" ", "T")) : new Date();
  const month = (isNaN(d.getTime()) ? new Date() : d).getUTCMonth() + 1; // 1-12
  return month === 7 || month === 8;
}

// Un match doit-il être écarté des picks/vitrine ? Ligue non fiable (hors UEFA)
// OU tour de qualification européen.
function isExcludedFromPicks(match) {
  if (isCategoryBanned(match)) return true;
  if (isUefaQualifier(match)) return true;
  return !isUefaCompetition(match) && isLowTrustCompetition(match);
}

// Filtre d'AFFICHAGE (résultats du jour + stats) — plus léger que le filtre du
// pick. On masque uniquement la couche "bruit" qui abîme la crédibilité auprès
// d'un visiteur (jeunes U17-U23, réserves, féminines, ligues exotiques hors
// UEFA), MAIS on GARDE les compétitions reconnaissables : UEFA (même en qualif),
// grandes ligues, K League, MLS, Brésil… Contrairement à isExcludedFromPicks
// (plus strict, réservé au PICK), les qualifs UEFA restent visibles ici car le
// nom « UEFA Champions League » inspire confiance.
// Jeunes (U15-U23), réserves, académies, féminines — TOUJOURS exclus, même si le
// nom de compétition contient "Champions League" (ex : "Nasjonal U19 Champions
// League · Norway"), sinon l'exemption UEFA les laisserait passer.
const YOUTH_KEYWORDS_RE = /\bu1[5-9]\b|\bu2[0-3]\b|under[ -]?(1[5-9]|2[0-3])\b|\byouth\b|primavera|\breserves?\b|academy/i;
function isYouthOrWomen(match) {
  const raw = typeof match === "string"
    ? match
    : [match?.competition, match?.league, match?.home, match?.away].filter(Boolean).join(" ");
  if (YOUTH_KEYWORDS_RE.test(String(raw || ""))) return true;
  if (typeof match === "object" && isWomenMatch(match)) return true;
  return false;
}

// Compétitions PROUVÉES perdantes sur l'historique réel du Concile (bilan) — on
// les retire de la vitrine car elles tirent le winrate vers le bas :
//  World Cup / FIFA World Cup 53-59% (aussi exclue ANJ), Queensland 33%,
//  USL League Two 58%. Tout le reste (petites ligues disciplinées où l'Under 2.5
//  gagne : Liban, Syrie, Kirghizistan, Éthiopie, Brésil Serie B, USL One…) est
//  CONSERVÉ : c'est là qu'est le volume ET le winrate.
const LOSING_COMPETITIONS_RE = /world cup|coupe du monde|fifa world|queensland|usl league two|usl2\b/i;
function isNoiseForDisplay(match) {
  if (isYouthOrWomen(match)) return true;              // jeunes/féminines : jamais vendables
  // ⚠️ NE PAS brancher ici la blacklist complete des ligues (tentative du
  // 05/08/2026, annulee le jour meme). Elle masquait 222 analyses resolues sur
  // 584 — essentiellement des ligues blacklistees PARCE QU'ELLES PERDAIENT
  // (USL League Two, FA Cup Coree, K League 2...). Les retirer retroactivement
  // faisait remonter le winrate public artificiellement, en contradiction
  // directe avec la promesse affichee sur /performances ("Aucun pick cache,
  // aucune statistique modifiee") et avec la regle ANJ de ne jamais falsifier
  // de statistiques. Une ligue jugee non fiable doit etre bloquee A L'ANALYSE
  // (isLowTrustCompetition, en amont), pas effacee de l'historique une fois
  // les resultats connus.
  const raw = typeof match === "string"
    ? match
    : [match?.competition, match?.league].filter(Boolean).join(" ");
  if (LOSING_COMPETITIONS_RE.test(String(raw || ""))) return true; // perdants prouvés
  return false;                                        // on garde les gagnants (volume)
}

// Analyse des sports hors football — DÉSACTIVÉE par défaut, et ce n'est pas un oubli.
// Le catalogue de marchés (BET_TYPES) et le garde-fou betIsPlayable() sont écrits pour
// le football : sur un match de basket à 155 points cumulés, « Under 2.5 buts » est
// mathématiquement perdu d'avance et « Over 2.5 buts » déjà atteint ; « Match nul » et
// « BTTS » n'existent pas dans ces sports. Les faire analyser produit des sélections
// incohérentes, les IA divergent et la confiance s'effondre.
// Mesuré le 25/07/2026 : 109 analyses, 1 seule au-dessus de 85 % de confiance, ZÉRO
// signal diffusé — contre 63 analyses et 16 signaux diffusés le 23/07 en football seul.
// L'AFFICHAGE multisport du Live reste inchangé : seule l'ANALYSE est bridée.
// À réactiver via AUTO_CONCILE_MULTISPORT=1 dès qu'il existe des marchés par sport
// (totaux de points au basket, lignes de runs au baseball, etc.).
const AUTO_CONCILE_MULTISPORT = process.env.AUTO_CONCILE_MULTISPORT === "1";
const AUTO_CONCILE_WINDOW_MIN = Math.max(1, Number(process.env.AUTO_CONCILE_WINDOW_MIN || 30));
const AUTO_CONCILE_WINDOW_MAX = Math.max(AUTO_CONCILE_WINDOW_MIN + 1, Number(process.env.AUTO_CONCILE_WINDOW_MAX || 75));
// Décision fondateur du 28/07/2026 : la sélection ne se fait plus sur la minute
// mais sur la cote réelle ARJEL (fenêtre 1.30–2.50). La fenêtre de temps
// produisait trop peu de signaux, et créait une incohérence visible : un match à
// la 80e restait affiché en direct mais refusait l'analyse. Mettre
// AUTO_CONCILE_TIME_WINDOW=1 dans .env pour la réactiver sans redéployer.
const AUTO_CONCILE_TIME_WINDOW = process.env.AUTO_CONCILE_TIME_WINDOW === "1";

// ── Règles métier gravées dans la pierre (ne pas assouplir) ───────────────────
// R1 : aucun prono live avant la 35e minute ni après la 75e (données suffisantes
//      jouées + cote encore offerte par les books).
// R2 : aucun prono sur un match à finalité connue (écart >= 3 buts). Le book ne
//      cote plus un résultat décidé — ex : 0-3 → "Victoire extérieur" interdit.
const DECIDED_MATCH_GAP = 3;

function isMatchDecided(match) {
  const score = readKnownScore(match);
  if (!score) return false;
  return Math.abs(score.home - score.away) >= DECIDED_MATCH_GAP;
}

// Retourne null si le match peut être pronostiqué en live, sinon la raison du blocage.
// Utilisé par l'auto-observer ET les endpoints d'analyse manuelle (pas le prématch).
function livePickBlockReason(match) {
  // Fenêtre de temps désactivée par défaut depuis le 28/07/2026 (décision du
  // fondateur) : c'est la COTE RÉELLE qui décide, pas la minute. Un match trop
  // avancé ou déjà plié voit sa cote sortir de la fenêtre 1.30–2.50 et se trouve
  // exclu de fait — sans priver d'analyse un match encore ouvert à la 80e.
  // Réactivable par .env : AUTO_CONCILE_TIME_WINDOW=1.
  if (AUTO_CONCILE_TIME_WINDOW) {
    const minute = parseLiveMinuteValue(match && match.minute);
    if (minute !== null && minute < AUTO_CONCILE_WINDOW_MIN) return `Analyse indisponible avant la ${AUTO_CONCILE_WINDOW_MIN}e minute.`;
    if (minute !== null && minute > AUTO_CONCILE_WINDOW_MAX) return `Analyse indisponible après la ${AUTO_CONCILE_WINDOW_MAX}e minute.`;
  }
  // R2 conservée : un match à finalité connue n'a plus rien à offrir.
  if (isMatchDecided(match)) return "Analyse indisponible : match à finalité connue (écart de 3 buts ou plus).";
  return null;
}

function shouldAutoObserveMatch(match) {
  if (!match || match.scoreConflict) return false;
  if (!isPublicFootballScopeMatch(match)) return false;
  const status = String(match.status || "").toUpperCase();
  if (!["IN_PLAY", "LIVE"].includes(status)) return false;
  if (isFinishedOrTooLateForLiveIa(match)) return false;
  if (isWomenMatch(match)) return false;              // pas de matchs féminins
  // Categorie bannie (jeunes, amical, reserve...) : jamais d'exemption UEFA
  // possible, a verifier avant le court-circuit ci-dessous.
  if (isCategoryBanned(match)) return false;
  // Hors football : les marchés disponibles ne correspondent pas à ces sports
  // (voir AUTO_CONCILE_MULTISPORT). Le match reste affiché en direct, il n'est
  // simplement pas soumis au Concile tant qu'aucun marché adapté n'existe.
  // Ces matchs sautaient TOUTES les autres barrières qualite (ligue douteuse,
  // competition sous-performante) en plus — constate le 01/08/2026 : des
  // matchs WNBA/basketball canadien consommaient des jetons IA pour un
  // "Match nul" a 55-66%, alors qu'ils ne peuvent de toute facon jamais
  // devenir le pick du jour (marches football uniquement, DAILY_PICK_ALLOWED_BETS).
  if (String(match.sport || "Football") !== "Football") {
    if (!AUTO_CONCILE_MULTISPORT) return false;
    if (isLowTrustCompetition(match)) return false;
    if (isUnderperformingCompetition(match)) return false;
    return true;
  }
  // Analyse large pour remplir la journée : grandes ligues + coupes d'Europe
  // (dont qualifs). Le tri "premium" ne s'applique qu'au PICK du jour, pas à
  // l'activité affichée. On bloque juste les ligues non fiables hors UEFA.
  // Produit O/U 2,5 :
  // on bloque les catégories réellement interdites/dangereuses,
  // mais on ne rejette plus automatiquement une ligue uniquement
  // parce qu'elle n'existe pas encore dans la whitelist historique.
  if (isUsaOrCanadaMatch(match)) return false;
  if (isWomenMatch(match)) return false;
  if (isCategoryBanned(match)) return false;
  if (isBlacklistedForLiveDisplay(match)) return false;
  if (isUnderperformingCompetition(match)) return false;
  if (isMatchDecided(match)) return false;
  // Sélection par la COTE et non par la minute (décision du 28/07/2026). La
  // fenêtre de temps reste disponible via AUTO_CONCILE_TIME_WINDOW=1.
  if (AUTO_CONCILE_TIME_WINDOW) {
    const minute = parseLiveMinuteValue(match.minute);
    return minute !== null && minute >= AUTO_CONCILE_WINDOW_MIN && minute <= AUTO_CONCILE_WINDOW_MAX;
  }
  return true;
}

function hasPredictionSnapshot(match) {
  const key = getPredictionSnapshotKey(match);
  try {
    const row = db.prepare("SELECT 1 FROM agent_predictions WHERE match_key = ? LIMIT 1").get(key);
    return !!row;
  } catch (e) {
    console.error("[auto-concile] snapshot check:", e.message);
    return true;
  }
}

// ── Filtre ARJEL AVANT analyse (grave le 07/08/2026, decision du fondateur) ──
// « arrete de bruler les tokens pour le hors ARJEL et garde que le ARJEL
// jusqu'a nouvel ordre ».
//
// Constat qui l'a motive : 311 analyses en 7 jours, 5 signaux diffuses. Chaque
// analyse coute 5 appels IA, et la fenetre de cote ARJEL n'etait verifiee
// qu'APRES coup, au moment de la diffusion (voir oddOk plus haut). On payait
// donc l'integralite du Concile sur des matchs qu'aucun operateur francais ne
// proposait, ou dont la cote ne pouvait de toute facon jamais etre diffusee.
//
// Le filtre s'appuie sur UN appel de cotes (quota API-Sports, deja mis en
// cache par fetchRealOdds) pour eviter CINQ appels IA (budget en euros). Le
// troc est favorable dans tous les cas.
//
// Reactivable sans redeploiement : AUTO_CONCILE_ARJEL_ONLY=0 dans le .env.
// Ne pas remettre l'analyse hors ARJEL sans accord explicite du fondateur.
const AUTO_CONCILE_ARJEL_ONLY = process.env.AUTO_CONCILE_ARJEL_ONLY !== "0";
// Marches sur lesquels une analyse peut reellement devenir un signal CLIENT.
// Depuis le recentrage produit, Telegram ne diffuse que le O/U 2,5. Accepter
// ici une cote BTTS ou victoire faisait depenser cinq appels IA sur un match
// qui etait ensuite refuse par la barriere finale "O/U 2,5 uniquement".
const ARJEL_PREFILTER_MARKETS = ["Over 2.5 buts", "Under 2.5 buts"];

const CONCILE_OU25_ONLY_INSTRUCTION = `
REGLE ABSOLUE TOUSLESMATCHS :
Tu analyses EXCLUSIVEMENT le marché Total de buts 2,5.
Le champ bet doit être EXACTEMENT l'une de ces deux valeurs :
- "Over 2.5 buts"
- "Under 2.5 buts"

INTERDIT de proposer :
Victoire domicile, Victoire extérieur, match nul, double chance,
BTTS, Over/Under 0.5, Over/Under 1.5, marchés mi-temps,
ou tout autre marché.

Si les données ne permettent pas de choisir sérieusement entre
Over 2.5 et Under 2.5, retourne une confiance faible au lieu
d'inventer un autre marché.
`;


async function isArjelPlayableBeforeAnalysis(match) {
  if (!AUTO_CONCILE_ARJEL_ONLY) return { ok: true, why: "filtre desactive" };
  // Hors football, l'API de cotes ne couvre rien : on ne peut pas verifier, et
  // refuser reviendrait a supprimer le multisport. On laisse passer, la barriere
  // de diffusion reste en place en aval.
  if (String(match.sport || "Football") !== "Football") return { ok: true, why: "hors football, non verifiable" };
  let oddsData;
  try { oddsData = await fetchRealOdds(match); }
  catch (e) { return { ok: true, why: "cotes injoignables (" + e.message + ")" }; }
  // Aucun operateur ARJEL ne propose ce match : par definition hors perimetre.
  if (!oddsData?.arjelBookmakers?.length) return { ok: false, why: "aucun bookmaker ARJEL" };
  for (const marche of ARJEL_PREFILTER_MARKETS) {
    const moyenne = computeArjelAverageOdd(oddsData, marche, match);
    const cote = moyenne?.avg || pickRealOdd(oddsData, marche, match);
    if (cote && cote >= TIER_MIN_REAL_ODD && cote <= TIER_MAX_REAL_ODD) {
      return { ok: true, why: `${marche} a ${cote}` };
    }
  }
  return { ok: false, why: `aucune cote ARJEL dans ${TIER_MIN_REAL_ODD}-${TIER_MAX_REAL_ODD}` };
}

async function runAutoConcileObserver() {
  if (!AUTO_CONCILE_OBSERVER || autoConcileObserverRunning) return;
  autoConcileObserverRunning = true;
  try {
    const matches = await fetchLiveMatches();
    const observed = matches
      .filter(shouldAutoObserveMatch)
      // Le filtre produit doit preceder les cinq appels du Concile. Le 27/08,
      // des coupes UEFA et des matchs hors minute 15-40 ont consomme les 100
      // appels OpenRouter du jour, puis le coupe-circuit daily_requests a rendu
      // les cinq agents muets. La meme regle reste repetee avant Telegram en
      // defense en profondeur dans runConcileAnalysis().
      .filter(m => isClientOu25MatchEligible(m, true))
      .filter(m => !hasPredictionSnapshot(m));
    // Priorite jetons : le foot en ligue fiable est le seul a pouvoir devenir
    // le pick du jour (DAILY_PICK_ALLOWED_BETS = marches foot uniquement) —
    // on l'analyse toujours en premier, le reste (autres sports) ne consomme
    // le budget restant qu'ensuite (decision Greg du 01/08/2026).
    const prioritized = [...observed].sort((a, b) => {
      const aFoot = String(a.sport || "Football") === "Football" ? 0 : 1;
      const bFoot = String(b.sport || "Football") === "Football" ? 0 : 1;
      return aFoot - bFoot;
    });
    // Portail ARJEL : on sonde les cotes match par match et on s'arrete des que
    // le quota d'analyses du cycle est rempli. Plafond de sondages pour ne pas
    // vider le quota API-Sports un jour ou aucun match ne serait eligible.
    const candidates = [];
    let refusesArjel = 0;
    const maxSondages = AUTO_CONCILE_MAX_MATCHES * 4;
    for (const m of prioritized.slice(0, maxSondages)) {
      if (candidates.length >= AUTO_CONCILE_MAX_MATCHES) break;
      const verdict = await isArjelPlayableBeforeAnalysis(m);
      if (verdict.ok) {
        delete m.analysis_exclusion_reason;
        candidates.push(m);
        continue;
      }
      refusesArjel++;
      m.analysis_exclusion_reason = `Analyse non lancée : ${verdict.why}.`;
      console.log(`[auto-concile] hors ARJEL, aucun jeton depense: ${m.home} vs ${m.away} — ${verdict.why}`);
    }
    console.log(
      `[auto-concile] live=${matches.length} eligible=${observed.length} analysed_this_cycle=${candidates.length} ` +
      `skipped_low_trust=${matches.filter(isLowTrustCompetition).length} skipped_hors_arjel=${refusesArjel}`
    );

    for (const match of candidates) {
      try {
        console.log(
          `[auto-concile] analyse snapshot: ${match.competition || "competition inconnue"} | ` +
          `${match.home} vs ${match.away} | minute=${match.minute || "?"} | ` +
          `score=${match.score_home ?? "?"}-${match.score_away ?? "?"}`
        );
        await runConcileAnalysis(match);
      } catch (e) {
        console.error("[auto-concile] analyse:", e.message);
      }
    }
  } catch (e) {
    console.error("[auto-concile] cycle:", e.message);
  } finally {
    autoConcileObserverRunning = false;
  }
}

// ── Brevo helpers ─────────────────────────────────────────────────────────────
// extraAttrs (Phase 5, 01/08/2026) : attributs Brevo au-dela de PLAN/LANG,
// utilises par le pilotage/segmentation cote Brevo (jamais l'inverse — Brevo
// ne decide jamais de droits, voir doctrine architecture 31/07/2026). Fusionnes
// tels quels, aucune valeur par defaut inventee ici : chaque appelant ne passe
// que ce qu'il connait reellement.
async function brevoAddContact(email, tag, lang = "FR", marketingConsent = null, extraAttrs = null) {
  if (!BREVO_API_KEY) return;
  const contactLang = normalizeContactLang(lang, "");
  try {
    // Un seul upsert strict. Les anciens appels POST vers /contacts/:email et
    // /addToList utilisaient de mauvais corps/méthodes ; Brevo les refusait,
    // mais httpPost() transformait le 4xx en fausse réussite silencieuse.
    const attrs = { PLAN: tag, LANG: contactLang };
    if (marketingConsent !== null) attrs.MARKETING_CONSENT = marketingConsent ? "YES" : "NO";
    if (extraAttrs) Object.assign(attrs, extraAttrs);
    const payload = { email, attributes: attrs, updateEnabled: true };
    if (Number.isInteger(BREVO_LIST_ID) && BREVO_LIST_ID > 0) payload.listIds = [BREVO_LIST_ID];
    await httpPostStrict(
      "https://api.brevo.com/v3/contacts",
      payload,
      { "api-key": BREVO_API_KEY, "content-type": "application/json" }
    );
    _integrationHealth.brevo.ok = true;
    _integrationHealth.brevo.checked_at = new Date().toISOString();
    console.log(`[brevo] contact upserted: ${email} tag=${tag} lang=${contactLang}`);
  } catch (e) {
    _integrationHealth.brevo.ok = false;
    _integrationHealth.brevo.checked_at = new Date().toISOString();
    console.error("[brevo] error:", e.message);
  }
}

// ── Capture email a friction minimale (page /resultats-quotidiens) ───────────
// Contrairement a la creation de compte (/dashboard), aucun mot de passe ni
// code : juste l'email, pour capter des prospects pas encore prets a
// s'inscrire. Alimente Brevo avec un tag dedie, sert de reservoir pour la
// campagne de nurturing "ce que tu aurais gagne" (sendOutperformEmails).
const _leadCaptureRate = new Map();
app.post("/lead-capture", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json({ ok: false, error: "Email invalide" });
  }
  // Consentement marketing explicite requis (case a cocher, non cochee par
  // defaut, cote client) — cette page EST une inscription a des emails
  // promotionnels, donc pas d'ajout Brevo sans ce consentement. Constate
  // via l'audit du 01/08/2026 : rien ne demandait ce consentement avant.
  if (req.body?.consent !== true) {
    return res.json({ ok: false, error: "Consentement requis pour recevoir les emails." });
  }
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const last = _leadCaptureRate.get(ip) || 0;
  if (now - last < 5000) return res.json({ ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
  _leadCaptureRate.set(ip, now);
  brevoAddContact(email, "lead_resultats_quotidiens", "FR", true).catch(() => {});
  console.log(`[lead-capture] ${email} (consentement donné)`);
  res.json({ ok: true });
});

// Plafond anti-spam : 1 email MARKETING par adresse et par jour. La clé porte la
// date du jour — l'ancien setInterval remettait le compteur à zéro 24 h après le
// démarrage du process, donc « par jour » dérivait à chaque redéploiement.
const _emailDailyCap = new Map();
setInterval(() => {
  const today = new Date().toISOString().slice(0, 10);
  for (const k of _emailDailyCap.keys()) {
    if (!k.endsWith(`|${today}`)) _emailDailyCap.delete(k);
  }
}, 60 * 60 * 1000);

/**
 * @param opts.critical  Email TRANSACTIONNEL (code d'accès, confirmation de
 *   paiement, expiration d'abonnement) : jamais soumis au plafond anti-spam.
 *   Sans ce drapeau, un lead ayant reçu un email de nurturing le matin puis
 *   s'abonnant l'après-midi ne recevait PAS son code d'accès — il payait sans
 *   rien recevoir, et l'échec n'apparaissait que dans les logs.
 */
async function brevoSendEmail(to, subject, htmlContent, opts = {}) {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY manquante");
  const today = new Date().toISOString().slice(0, 10);
  const key = `${to.toLowerCase()}|${today}`;
  if (!opts.critical) {
    const sent = _emailDailyCap.get(key) || 0;
    if (sent >= 1) {
      console.log(`[brevo] Cap 1 email marketing/jour atteint pour ${to.toLowerCase()} — "${subject}" non envoyé`);
      return;
    }
    _emailDailyCap.set(key, sent + 1);
  }
  try {
    const result = await httpPostStrict(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent,
      },
      { "api-key": BREVO_API_KEY, "content-type": "application/json" }
    );
    _integrationHealth.brevo.ok = true;
    _integrationHealth.brevo.checked_at = new Date().toISOString();
    return result;
  } catch (e) {
    _integrationHealth.brevo.ok = false;
    _integrationHealth.brevo.checked_at = new Date().toISOString();
    throw e;
  }
}

function leadLang(email, leadMap) {
  return String(leadMap.get(String(email).toLowerCase())?.lang || "fr").slice(0, 2).toLowerCase();
}

function pickEmailText(lang) {
  const t = {
    fr: ["Analyse du jour", "Pronostic du Conseil IA", "Voir l'analyse complete", "Analyses sportives reservees aux +18 ans. Jeu responsable."],
    en: ["Today's analysis", "AI Council prediction", "See the full analysis", "Sports analysis is 18+ only. Gamble responsibly."],
    es: ["Pick del dia", "Pronostico del Consejo", "Ver el analisis completo", "Apuestas deportivas solo para mayores de 18. Juega con responsabilidad."],
    pt: ["Pick do dia", "Prognostico do Conselho", "Ver a analise completa", "Apostas desportivas apenas para maiores de 18. Jogue com responsabilidade."],
    de: ["Tipp des Tages", "Prognose des Councils", "Vollstandige Analyse ansehen", "Sportwetten nur ab 18. Spiele verantwortungsvoll."],
    it: ["Pick del giorno", "Pronostico del Consiglio", "Vedi l'analisi completa", "Scommesse sportive solo 18+. Gioca responsabilmente."],
  };
  return t[lang] || t.fr;
}

// ── Referral system ───────────────────────────────────────────────────────────
function loadReferrals() {
  try { return JSON.parse(fs.readFileSync(REFERRALS_PATH, "utf8")); } catch { return { refs: {}, byEmail: {} }; }
}
function saveReferrals(data) {
  fs.mkdirSync("/var/touslesmatchs", { recursive: true });
  fs.writeFileSync(REFERRALS_PATH, JSON.stringify(data, null, 2));
}
function makeRefCode(email) {
  const slug = email.replace(/@.*/, "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REF-${slug}-${rand}`;
}
function getOrCreateRefCode(email) {
  const data = loadReferrals();
  if (data.byEmail[email]) return data.byEmail[email];
  const code = makeRefCode(email);
  data.refs[code] = { ownerEmail: email, created_at: new Date().toISOString(), referrals: [], monthsEarned: 0 };
  data.byEmail[email] = code;
  saveReferrals(data);
  return code;
}
function creditReferrer(refCode, newSubscriberEmail) {
  const data = loadReferrals();
  const ref = data.refs[refCode];
  if (!ref) return false;
  if (ref.referrals.includes(newSubscriberEmail)) return false; // déjà crédité
  ref.referrals.push(newSubscriberEmail);
  ref.monthsEarned = (ref.monthsEarned || 0) + 1;
  saveReferrals(data);
  // Prolonge l'abonnement du parrain ET du filleul de 30 jours chacun
  // (demande fondateur 30/07/2026 : recompenser les deux cotes, pas
  // seulement le parrain).
  function extendByDays(email, days) {
    try {
      const codesDb = new Database(CODES_DB_PATH);
      const row = codesDb.prepare("SELECT expires_at FROM codes WHERE email = ? AND active = 1").get(email);
      if (row) {
        const base = row.expires_at ? new Date(row.expires_at) : new Date();
        if (base < new Date()) base.setTime(Date.now());
        base.setDate(base.getDate() + days);
        codesDb.prepare("UPDATE codes SET expires_at = ? WHERE email = ? AND active = 1").run(base.toISOString(), email);
      }
      codesDb.close();
    } catch (e) { console.error("[referral] extend:", e.message); }
  }
  extendByDays(ref.ownerEmail, 30);
  extendByDays(newSubscriberEmail, 30);
  // Email au filleul
  if (BREVO_API_KEY) {
    brevoSendEmail(newSubscriberEmail, "🎁 1 mois offert pour avoir rejoint via un parrainage !",
      `<div style="background:#06080f;padding:32px;font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#eceaf4">
        <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:20px">TousLesMatchs</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:10px">🎁 Merci d'avoir rejoint via un parrainage !</div>
        <div style="color:#a8aec8;line-height:1.6;margin-bottom:20px">Ton abonnement vient d'être prolongé de <strong style="color:#10b981">30 jours</strong> automatiquement, offert pour avoir utilisé un lien de parrainage.</div>
        <a href="https://www.touslesmatchs.com" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700">Voir mes picks →</a>
      </div>`,
      { critical: true }
    ).catch(() => {});
  }
  // Email au parrain
  if (BREVO_API_KEY) {
    brevoSendEmail(ref.ownerEmail, "🎉 Tu viens de gagner 1 mois offert !",
      `<div style="background:#06080f;padding:32px;font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#eceaf4">
        <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:20px">TousLesMatchs</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:10px">🎉 ${newSubscriberEmail.replace(/@.*/, "***@***")} a rejoint grâce à toi !</div>
        <div style="color:#a8aec8;line-height:1.6;margin-bottom:20px">Ton abonnement vient d'être prolongé de <strong style="color:#10b981">30 jours</strong> automatiquement. Merci de faire confiance à TousLesMatchs et de le partager autour de toi.</div>
        <a href="https://www.touslesmatchs.com" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700">Voir mes picks →</a>
      </div>`,
      { critical: true } // récompense de parrainage : dû au client, jamais plafonné
    ).catch(() => {});
  }
  return true;
}

// ── Monthly stats for renewal email ───────────────────────────────────────────
function getMonthlyPickStats() {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  try {
    const rows = db.prepare(`
      SELECT home, away, competition, best_bet, confidence, outcome,
             final_score_home, final_score_away, resolved_at, home_logo, sport
      FROM concile_analyses
      WHERE outcome IN ('win','loss') AND resolved_at > ?
      ORDER BY resolved_at DESC LIMIT 20
    `).all(since);
    const wins = rows.filter(r => r.outcome === "win").length;
    const losses = rows.filter(r => r.outcome === "loss").length;
    const total = wins + losses;
    const winrate = total > 0 ? Math.round(wins / total * 100) : 0;
    // ROI simulé : mise 10u, cote moyenne 1.80
    const roi = total > 0 ? Math.round((wins * 8 - losses * 10) / (total * 10) * 100) : 0;
    return { wins, losses, total, winrate, roi, recent: rows.slice(0, 5) };
  } catch { return { wins: 0, losses: 0, total: 0, winrate: 0, roi: 0, recent: [] }; }
}

function renewalEmailHtml(row, daysLeft, stats) {
  const planLabel = row.plan === "elite" ? "Elite" : "Pro";
  const expDate = new Date(row.expires_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
  const urgency = daysLeft <= 1 ? "🔴 DERNIER JOUR" : daysLeft <= 3 ? "🟡 Plus que " + daysLeft + " jours" : "📅 Dans " + daysLeft + " jours";
  const pickRows = stats.recent.map(p => {
    const icon = p.outcome === "win" ? "✅" : "❌";
    const gain = p.outcome === "win" ? `+8u` : `-10u`;
    const gainColor = p.outcome === "win" ? "#10b981" : "#f43f5e";
    return `<tr style="border-bottom:1px solid rgba(255,255,255,.06)">
      <td style="padding:8px 6px;font-size:13px;color:#eceaf4">${p.home} vs ${p.away}</td>
      <td style="padding:8px 6px;font-size:12px;color:#a8aec8">${p.best_bet}</td>
      <td style="padding:8px 6px;font-size:13px;font-weight:700;color:${gainColor};text-align:right">${icon} ${gain}</td>
    </tr>`;
  }).join("");

  return `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:28px">
    <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block">TousLesMatchs</div>
    <div style="font-size:11px;color:#7b82a0;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">CONSEIL IA — RÉSULTATS DU MOIS</div>
  </div>

  <div style="background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.25);border-radius:14px;padding:16px 20px;margin-bottom:24px;text-align:center">
    <div style="font-size:13px;font-weight:700;color:#fb7185">${urgency}</div>
    <div style="font-size:14px;color:#a8aec8;margin-top:4px">Ton abonnement <strong style="color:#eceaf4">${planLabel}</strong> expire le <strong>${expDate}</strong></div>
  </div>

  ${stats.total > 0 ? `
  <div style="background:#0d1020;border:1px solid rgba(99,102,241,.2);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6366f1;margin-bottom:16px">📊 CE QUE TU AURAIS GAGNÉ CE MOIS</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      <div style="text-align:center;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:14px">
        <div style="font-size:26px;font-weight:900;color:#10b981">${stats.wins}</div>
        <div style="font-size:11px;color:#7b82a0;text-transform:uppercase;letter-spacing:.05em">Gagnés</div>
      </div>
      <div style="text-align:center;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:14px">
        <div style="font-size:26px;font-weight:900;color:#6366f1">${stats.winrate}%</div>
        <div style="font-size:11px;color:#7b82a0;text-transform:uppercase;letter-spacing:.05em">Réussite</div>
      </div>
      <div style="text-align:center;background:${stats.roi >= 0 ? "rgba(16,185,129,.08)" : "rgba(244,63,94,.08)"};border:1px solid ${stats.roi >= 0 ? "rgba(16,185,129,.2)" : "rgba(244,63,94,.2)"};border-radius:10px;padding:14px">
        <div style="font-size:26px;font-weight:900;color:${stats.roi >= 0 ? "#10b981" : "#f43f5e"}">${stats.roi >= 0 ? "+" : ""}${stats.roi}%</div>
        <div style="font-size:11px;color:#7b82a0;text-transform:uppercase;letter-spacing:.05em">ROI estimé</div>
      </div>
    </div>
    ${pickRows ? `<table style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
        <th style="text-align:left;padding:6px;font-size:11px;color:#7b82a0;font-weight:600">Match</th>
        <th style="text-align:left;padding:6px;font-size:11px;color:#7b82a0;font-weight:600">Paris</th>
        <th style="text-align:right;padding:6px;font-size:11px;color:#7b82a0;font-weight:600">Résultat</th>
      </tr>
      ${pickRows}
    </table>` : ""}
  </div>
  <div style="text-align:center;font-size:13px;color:#a8aec8;margin-bottom:20px">Sur 10€ misés par pick, tu aurais <strong style="color:${stats.roi >= 0 ? "#10b981" : "#f43f5e"}">${stats.roi >= 0 ? "gagné" : "perdu"} ${Math.abs(stats.roi * stats.total / 10).toFixed(0)}€</strong> sur ${stats.total} picks ce mois.</div>
  ` : `<div style="background:#0d1020;border:1px solid rgba(99,102,241,.2);border-radius:16px;padding:20px;text-align:center;margin-bottom:20px;color:#a8aec8">Le Concile continue d'affiner ses analyses — les résultats s'accumulent pick après pick.</div>`}

  <div style="text-align:center;margin-bottom:24px">
    <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:11px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 4px 20px rgba(79,70,229,.4)">🔄 Renouveler mon abonnement ${planLabel}</a>
    <div style="font-size:11px;color:#7b82a0;margin-top:10px">Accès immédiat après paiement · Code envoyé par email</div>
  </div>

  ${bookmakerEmailHtml()}
  <div style="text-align:center;font-size:11px;color:#7b82a0;line-height:1.6;margin-top:16px">
    TousLesMatchs · <a href="https://www.touslesmatchs.com" style="color:#6366f1;text-decoration:none">touslesmatchs.com</a><br>
    ⚠️ Analyses sportives réservées aux +18 ans. Jeu responsable. Le ROI passé ne garantit pas les résultats futurs.
  </div>
</div>`;
}

// ── Admin auth helper ─────────────────────────────────────────────────────────
function isAdmin(email, code) {
  const auth = verifyCode(email, code);
  return auth.valid && code.toUpperCase().startsWith("ELITE-ADMIN");
}

// ── Expiry cron (check every hour) ────────────────────────────────────────────
// Tracks which emails got which reminder to avoid duplicate sends per day
const _expirySentToday = new Map(); // email → Set of diffs sent

function runExpiryCron() {
  if (!BREVO_API_KEY) return;
  try {
    const codesDb = new Database(CODES_DB_PATH);
    const now = new Date();
    const rows = codesDb.prepare(
      "SELECT * FROM codes WHERE plan != 'free' AND expires_at IS NOT NULL"
    ).all();

    rows.forEach(row => {
      const exp = new Date(row.expires_at);
      const diff = Math.round((exp - now) / (1000 * 60 * 60 * 24));

      // Auto-deactivation: code expired yesterday or before → désactiver
      if (diff < 0 && row.active === 1) {
        codesDb.prepare("UPDATE codes SET active = 0 WHERE code = ?").run(row.code);
        console.log(`[expiry-cron] Désactivé: ${row.email} (expiré il y a ${Math.abs(diff)}j)`);
        return;
      }

      if (!row.active || !row.email) return;

      const sentKey = row.email;
      const sentSet = _expirySentToday.get(sentKey) || new Set();

      const stats = getMonthlyPickStats();

      if ([7, 3, 1].includes(diff) && !sentSet.has(diff)) {
        const subjects = {
          7: `📊 Dans 7 jours — voici ce que tu aurais gagné ce mois sur TousLesMatchs`,
          3: `⏳ Plus que 3 jours — renouvelle ton abonnement ${row.plan === "elite" ? "Elite" : "Pro"}`,
          1: `🔴 Dernier jour — ton accès TousLesMatchs expire demain`,
        };
        brevoSendEmail(row.email, subjects[diff], renewalEmailHtml(row, diff, stats), { critical: true })
          .then(() => {
            sentSet.add(diff);
            _expirySentToday.set(sentKey, sentSet);
            console.log(`[expiry-cron] Email J-${diff} envoyé: ${row.email}`);
          })
          .catch(e => console.error(`[expiry-cron] email J-${diff} to ${row.email}:`, e.message));
      }

      if (diff === 0 && !sentSet.has(0)) {
        brevoSendEmail(row.email, `🔴 Ton abonnement expire aujourd'hui — dernière chance`, renewalEmailHtml(row, 0, stats), { critical: true })
          .then(() => { sentSet.add(0); _expirySentToday.set(sentKey, sentSet); })
          .catch(e => console.error(`[expiry-cron] email J-0 to ${row.email}:`, e.message));
      }
    });
    codesDb.close();
  } catch (e) {
    console.error("[expiry-cron] error:", e.message);
  }
}
setInterval(runExpiryCron, 60 * 60 * 1000);
// Reset the "sent today" tracker at midnight
setInterval(() => _expirySentToday.clear(), 24 * 60 * 60 * 1000);

// ══════════════════════════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════════════════════════

// ===== MOTEUR DE SCORING V2 =====

// Configuration des seuils
const SCORE_SEUIL_PUBLICATION = 85;
const SCORE_SEUIL_FREE_ONLY = 65;
const SCORE_NB_MATCHES_MIN = 10; // matchs minimum avant d'utiliser le coefficient ligue

// Classes de ligues avec leurs coefficients
const LEAGUE_CLASSES = {
  A: { coefficient: 1.00, min_predictions: 100, min_winrate: 75, min_roi: 5, premium: true, label: "Tres fiable", emoji: "\uD83D\uDFE2" },
  B: { coefficient: 0.90, min_predictions: 50, min_winrate: 65, min_roi: 0, premium: true, label: "Fiable", emoji: "\uD83D\uDFE2" },
  C: { coefficient: 0.75, min_predictions: 20, min_winrate: 55, min_roi: -5, premium: true, label: "Moyenne", emoji: "\uD83D\uDFE1" },
  D: { coefficient: 0.60, min_predictions: 10, min_winrate: 40, min_roi: -15, premium: false, label: "Risquee", emoji: "\uD83D\uDFE0" },
  E: { coefficient: 0.40, min_predictions: 0, min_winrate: 0, min_roi: -99, premium: false, label: "A eviter", emoji: "\uD83D\uDD34" },
};

// Nom des ligues majeures fiables (coefficient forcé A)
const MAJOR_LEAGUES = [
  "premier league", "ligue 1", "laliga", "serie a", "bundesliga",
  "champions league", "europa league", "conference league",
  "nhl", "nba", "mlb",
];

// Calcule la classe d'une ligue à partir de ses stats
function computeLeagueClass(total, wins, losses, roi) {
  const winrate = total > 0 ? (wins / (wins + losses)) * 100 : 0;
  if (total >= 100 && winrate >= 75 && roi >= 5) return "A";
  if (total >= 50 && winrate >= 65 && roi >= 0) return "B";
  if (total >= 20 && winrate >= 55) return "C";
  if (total >= 10 && winrate >= 40) return "D";
  return "E";
}

// Calcule le coefficient de fiabilité d'une ligue
function getLeagueCoefficient(leagueName) {
  const name = (leagueName || "").toLowerCase();
  // Les ligues majeures sont toujours A
  for (const ml of MAJOR_LEAGUES) {
    if (name.includes(ml)) return LEAGUE_CLASSES.A;
  }
  // Charger les stats depuis agent_predictions
  try {
    const stats = db.prepare(
      "SELECT COUNT(*) as total, SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins, " +
      "SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses " +
      "FROM agent_predictions WHERE home LIKE ? OR away LIKE ?"
    ).all("%" + leagueName.split(" ")[0] + "%", "%" + leagueName.split(" ")[0] + "%");
    if (stats.length > 0) {
      const s = stats[0];
      const cls = computeLeagueClass(s.total, s.wins, s.losses, 0);
      return LEAGUE_CLASSES[cls] || LEAGUE_CLASSES.E;
    }
  } catch(e) { /* pas de stats */ }
  // Si aucune donnée, classe D par défaut
  return LEAGUE_CLASSES.D;
}

// Calcule le score final pondéré
function computeWeightedScore(confidence, leagueName) {
  // Score de base = confiance IA (0-100)
  const baseScore = Math.min(100, Math.max(0, confidence || 70));
  // Coefficient ligue
  const league = getLeagueCoefficient(leagueName);
  const coeff = league.coefficient;
  // Score final = confiance * coefficient ligue
  const finalScore = Math.round(baseScore * coeff);
  const premium = league.premium && finalScore >= SCORE_SEUIL_PUBLICATION;
  return {
    baseScore,
    coeff,
    finalScore,
    premium,
    league,
    publiable: finalScore >= SCORE_SEUIL_FREE_ONLY,
    premiumOk: premium,
    seuilAtteint: finalScore >= SCORE_SEUIL_PUBLICATION,
  };
}

// Vérifie si un marché est disponible en France (ANJ)
function isMarketAvailableInFrance(marketType, competition) {
  // Marchés toujours disponibles en France
  const frMarkets = ["1X2", "Double Chance", "Over/Under 2.5", "BTTS", "DNB"];
  if (!frMarkets.includes(marketType)) return { available: false, reason: "Marche non disponible en France" };
  // Compétitions autorisées en France
  const frCompetitions = [
    "ligue 1", "ligue 2", "premier league", "championship", "laliga", "serie a",
    "serie b", "bundesliga", "2. bundesliga", "primeira liga", "eredivisie",
    "champions league", "europa league", "conference league",
    "mls", "nhl", "nba",
  ];
  const comp = (competition || "").toLowerCase();
  for (const fc of frCompetitions) {
    if (comp.includes(fc)) return { available: true, reason: "Disponible en France", badge: "\uD83C\uDDEB\uD83C\uDDF7" };
  }
  return { available: false, reason: "Non verifie", badge: "\u2753" };
}

// ===== FIN MOTEUR DE SCORING V2 =====

app.get("/health", (_, res) => res.json({
  ok: true,
  integrations: {
    brevo: {
      configured: _integrationHealth.brevo.configured,
      ok: _integrationHealth.brevo.ok,
      checked_at: _integrationHealth.brevo.checked_at,
    },
    telegram: {
      configured: _integrationHealth.telegram.configured,
      ok: _integrationHealth.telegram.ok,
      checked_at: _integrationHealth.telegram.checked_at,
      channels: _integrationHealth.telegram.channels,
    },
  },
}));

function normalizeContactLang(lang = "", country = "") {
  const raw = String(lang || "").toLowerCase();
  const cc = String(country || "").toUpperCase();
  if (raw.startsWith("fr") || ["FR", "BE", "CH", "CA", "LU", "MC"].includes(cc)) return "FR";
  if (raw.startsWith("es") || ["ES", "MX", "AR", "CL", "CO", "PE", "UY", "PY", "BO", "EC", "VE", "CR", "PA", "DO", "GT", "HN", "NI", "SV"].includes(cc)) return "ES";
  if (raw.startsWith("de") || ["DE", "AT"].includes(cc)) return "DE";
  if (raw.startsWith("it") || cc === "IT") return "IT";
  if (raw.startsWith("pt") || ["PT", "BR"].includes(cc)) return "PT";
  if (raw.startsWith("nl") || ["NL", "BE"].includes(cc)) return "NL";
  return "EN";
}

// ── Subscribe email (capture gratuite → Brevo) ───────────────────────────────
// Le verrouillage visuel ne suffit pas : l'API publique ne doit jamais livrer
// l'equipe, le pari ou la cote exacte a un visiteur gratuit/non connecte.
function paidGoal05Account(req) {
  const auth = String(req.headers.authorization || "");
  const sessionToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const email = String(req.headers["x-tlm-email"] || "").toLowerCase().trim();
  if (!sessionToken) return null;

  if (email) {
    const subscriber = verifyFcmSubscriber(email, sessionToken);
    if (subscriber) return subscriber;
  }

  try {
    const session = db.prepare("SELECT email, expires_at FROM sessions WHERE token = ?").get(sessionToken);
    if (!session || Date.parse(session.expires_at) < Date.now()) return null;
    const account = lookupAccountByEmail(session.email);
    if (!account || String(account.plan || "free").toLowerCase() === "free") return null;
    if (account.expires_at && Date.parse(account.expires_at) < Date.now()) return null;
    return { email: session.email, ...account };
  } catch (error) {
    console.error("[goal05] verification membre:", error.message);
    return null;
  }
}

function sendGoal05Latest(req, res) {
  const latest = readGoal05LatestSignal();
  if (!paidGoal05Account(req)) {
    return res.json({
      ok: true,
      locked: true,
      available: !!latest?.signal,
      signal: null,
      cta: "Selection exacte reservee aux membres des 4,90 euros par mois",
    });
  }
  return res.json({ ...latest, locked: false });
}

app.get("/goal05/latest", sendGoal05Latest);
app.get("/api/goal05/latest", sendGoal05Latest);
app.get("/beta-plus05/status", (req, res) => {
  const accepted = db.prepare("SELECT COUNT(*) AS n FROM beta_plus05_applications WHERE status='accepted'").get()?.n || 0;
  res.json({ ok:true, enabled:FOUNDER_BETA_ENABLED, capacity:BETA_PLUS05_CAPACITY, accepted, remaining:0 });
});
app.post("/beta-plus05/apply", (req, res) => {
  if (!FOUNDER_BETA_ENABLED) {
    return res.status(410).json({ ok:false, error:"La campagne beta est terminee. Creez un compte gratuit ou choisissez une formule membre." });
  }
  const email = normalizeBetaEmail(req.body?.email);
  const adultConfirmed = req.body?.adultConfirmed === true;
  const legalAccepted = req.body?.legalAccepted === true;
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ ok:false, error:"Email invalide" });
  const decision = db.transaction(() => {
    const existing = db.prepare("SELECT status FROM beta_plus05_applications WHERE email=?").get(email);
    const acceptedCount = db.prepare("SELECT COUNT(*) AS n FROM beta_plus05_applications WHERE status='accepted'").get()?.n || 0;
    const next = decideBetaApplication({ existingStatus:existing?.status, acceptedCount, adultConfirmed, legalAccepted });
    if (next.status === "rejected" || existing) return next;
    db.prepare("INSERT INTO beta_plus05_applications (email,status,adult_confirmed,legal_accepted) VALUES (?,?,?,?)").run(email,next.status,adultConfirmed?1:0,legalAccepted?1:0);
    return next;
  })();
  if (decision.status === "rejected") return res.status(400).json({ ok:false, error:"Confirmation +18 et mentions legales requise" });
  let inviteEmailQueued = false;
  if (decision.status === "accepted" && decision.reason === "slot_reserved" && TELEGRAM_GOAL05_INVITE_URL) {
    const invite = buildBetaPlus05InvitationEmail(TELEGRAM_GOAL05_INVITE_URL);
    inviteEmailQueued = true;
    brevoSendEmail(email, invite.subject, invite.html, { critical:true })
      .then(() => console.log(`[beta-plus05] invitation Telegram envoyee a ${email}`))
      .catch((e) => console.error(`[beta-plus05] email invitation KO ${email}:`, e.message));
  }
  const accepted = db.prepare("SELECT COUNT(*) AS n FROM beta_plus05_applications WHERE status='accepted'").get()?.n || 0;
  res.json({ ok:true, status:decision.status, inviteEmailQueued, capacity:BETA_PLUS05_CAPACITY, accepted, remaining:Math.max(0,BETA_PLUS05_CAPACITY-accepted) });
});
app.get("/admin/beta-plus05/applications", (req, res) => {
  const { email, code, secret, format } = req.query || {};
  const ok = isAdminAccess(email, code) || (secret && secret === process.env.HERMES_ADMIN_TLM_BOT);
  if (!ok) return res.status(403).json({ ok:false, error:"Acces admin requis" });
  const rows = db.prepare("SELECT email,status,adult_confirmed,legal_accepted,created_at FROM beta_plus05_applications ORDER BY created_at DESC").all();
  if (String(format || "").toLowerCase() === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=beta-plus05-inscrits.csv");
    return res.send(formatBetaApplicationsCsv(rows));
  }
  const accepted = rows.filter((row) => row.status === "accepted").length;
  res.json({ ok:true, capacity:BETA_PLUS05_CAPACITY, accepted, remaining:Math.max(0,BETA_PLUS05_CAPACITY-accepted), applications:rows });
});
app.post("/subscribe-email", async (req, res) => {
  const { email, lang, ageRange, source, referrer, landingPage, utm } = req.body || {};
  if (!email || !email.includes("@")) {
    return res.json({ ok: false, error: "Email invalide" });
  }
  const emailClean = email.toLowerCase().trim();
  const langHeader = String(lang || req.headers["accept-language"] || "fr").slice(0, 16);
  const langCountry = (langHeader.match(/[-_]([A-Za-z]{2})/) || [])[1] || "";
  const country = String(req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || req.headers["x-country-code"] || langCountry || "").slice(0, 2).toUpperCase();
  const contactLang = normalizeContactLang(langHeader, country);
  const lead = {
    email: emailClean,
    created_at: new Date().toISOString(),
    lang: langHeader,
    contact_lang: contactLang,
    country: country || "unknown",
    age_range: String(ageRange || "unknown").slice(0, 24),
    source: String(source || "direct").slice(0, 64),
    referrer: String(referrer || req.headers.referer || "").slice(0, 300),
    landing_page: String(landingPage || "").slice(0, 300),
    utm: utm && typeof utm === "object" ? utm : {},
  };
  try {
    const leadsData = loadLeads();
    const existing = leadsData.leads.find(l => String(l.email).toLowerCase() === emailClean);
    if (existing) Object.assign(existing, lead, { created_at: existing.created_at || lead.created_at, updated_at: lead.created_at });
    else leadsData.leads.push(lead);
    saveLeads(leadsData);

    if (!BREVO_API_KEY) {
      console.log(`[subscribe-email] Brevo non configure - lead sauvegarde: ${emailClean}`);
      return res.json({ ok: true });
    }
    // Envoi Brevo avec attributs UTM pour segmentation par canal d'acquisition.
    // Ces attributs permettent dans Brevo de créer des LISTES automatiques
    // (ex: "Leads TikTok Romuald") et des séquences email spécifiques par source.
    const brevoAttributes = {
      PLAN: "FREE_SUBSCRIBER",
      SOURCE: lead.source || "direct",
      UTM_SOURCE: (lead.utm && lead.utm.source) || "",
      UTM_MEDIUM: (lead.utm && lead.utm.medium) || "",
      UTM_CAMPAIGN: (lead.utm && lead.utm.campaign) || "",
      LANDING: lead.landing_page || "",
      LANG: (lead.lang || "fr").slice(0, 2),
      COUNTRY: lead.country || "",
      SIGNUP_DATE: lead.created_at.slice(0, 10),
    };
    const brevoPayload = { email: emailClean, attributes: brevoAttributes, updateEnabled: true };
    if (Number.isInteger(BREVO_LIST_ID) && BREVO_LIST_ID > 0) brevoPayload.listIds = [BREVO_LIST_ID];
    await httpPostStrict(
      "https://api.brevo.com/v3/contacts",
      brevoPayload,
      { "api-key": BREVO_API_KEY, "content-type": "application/json" }
    );
    _integrationHealth.brevo.ok = true;
    _integrationHealth.brevo.checked_at = new Date().toISOString();
    console.log(`[subscribe-email] Lead ajoute Brevo: ${emailClean} source=${lead.source} utm=${JSON.stringify(lead.utm)} lang=${lead.lang} country=${lead.country}`);

    // Email de bienvenue uniquement pour les nouveaux inscrits
    if (!existing) {
      const welcomeHtml = `<div style="font-family:Inter,Arial,sans-serif;max-width:580px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:36px;text-align:center">
    <div style="font-size:26px;font-weight:900;color:#fff">Bienvenue sur TousLesMatchs</div>
    <div style="font-size:14px;color:rgba(255,255,255,.75);margin-top:6px">5 IA indépendantes. Aucune émotion, seulement des données.</div>
  </div>
  <div style="padding:32px">
      <div style="font-size:14px;color:#a8aec8;line-height:1.8">
        ✅ Pick du jour validé par le Conseil IA<br>
        ✅ Cote + probabilité + raison analytique<br>
        ✅ Alertes résultat (gagné/perdu)<br>
        ✅ Accès aux picks live sur le site
      </div>
    </div>
    <div style="text-align:center;margin-bottom:20px">
      <a href="https://www.touslesmatchs.com/live-ia" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none">Voir l'analyse Live IA →</a>
    </div>
    <div style="background:#0d1020;border:1px solid rgba(99,102,241,.12);border-radius:10px;padding:14px;margin-bottom:20px;text-align:center">
      <div style="font-size:12px;color:#a8aec8;margin-bottom:6px">📱 Rejoins aussi le canal Telegram gratuit</div>
      <a href="https://t.me/+qFnIuKg2ZhdlMmY8" style="color:#22d3ee;font-size:13px;font-weight:700;text-decoration:none">Rejoindre le canal →</a>
    </div>
    <p style="font-size:12px;color:#7b82a0;text-align:center">⚠️ Analyses sportives réservées aux +18 ans. Jeu responsable.<br>TousLesMatchs · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Mentions légales</a></p>
  </div>
</div>`;
      brevoSendEmail(emailClean, "Bienvenue sur TousLesMatchs — ton premier pick arrive bientôt 🎯", welcomeHtml)
        .catch(e => console.error("[subscribe-email] welcome email:", e.message));

      // Séquence nurturing : J+1 (preuve) et J+3 (urgence)
      scheduleNurturingEmails(emailClean);
    }

    res.json({ ok: true });
  } catch (e) {
    if (BREVO_API_KEY && /HTTP (401|403|4\d\d|5\d\d)/.test(String(e.message || ""))) {
      _integrationHealth.brevo.ok = false;
      _integrationHealth.brevo.checked_at = new Date().toISOString();
    }
    console.error("[subscribe-email] error:", e.message);
    res.json({ ok: true });
  }
});

async function handleAppAccessStart(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ ok: false, error: "Email invalide" });
  if (req.body?.adultConfirmed !== true) return res.json({ ok: false, error: "Confirmation +18 requise" });
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const makeCode = () => Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  let accessCode = null, plan = "free", created = false;
  try {
    const leadsData = loadLeads();
    const nowIso = new Date().toISOString();
    const existingLead = leadsData.leads.find(l => String(l.email).toLowerCase() === email);
    const lead = { email, created_at: nowIso, updated_at: nowIso, lang: "fr", contact_lang: "FR", country: "unknown", age_range: "+18", source: String(req.body?.source || "android_app").slice(0, 64), landing_page: "/app.html", utm: { source: "android_app", medium: "apk", campaign: "app_onboarding" } };
    if (existingLead) Object.assign(existingLead, lead, { created_at: existingLead.created_at || lead.created_at });
    else leadsData.leads.push(lead);
    saveLeads(leadsData);
    const cdbw = new Database(CODES_DB_PATH);
    const existing = cdbw.prepare("SELECT code, plan FROM codes WHERE email = ? AND active = 1 ORDER BY rowid DESC LIMIT 1").get(email);
    if (existing) { accessCode = existing.code; plan = existing.plan || "free"; }
    else {
      accessCode = makeCode(); created = true;
      cdbw.prepare("INSERT INTO codes (code, email, plan, active, expires_at, credits_max, credits_used, credits_date, created_at) VALUES (?,?,?,1,?,?,0,?,datetime('now'))")
        .run(accessCode, email, plan, expiresAt, defaultCreditsMaxForPlan(plan), getTodayStr());
    }
    cdbw.close();
    brevoAddContact(email, "APP_ANDROID_LEAD", "FR", true, { PLAN: plan.toUpperCase(), SOURCE: "android_app", APP_ACCESS_CREATED: created ? "YES" : "NO", APP_ACCESS_DATE: new Date().toISOString().slice(0, 10) }).catch(() => {});
    scheduleNurturingEmails(email);
    if (BREVO_API_KEY) {
      const html = "<div style=\"font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden\">" +
        "<div style=\"background:linear-gradient(135deg,#4f46e5,#06b6d4);padding:30px;text-align:center\"><div style=\"font-size:24px;font-weight:900;color:#fff\">Ton accès TousLesMatchs</div><div style=\"font-size:13px;color:rgba(255,255,255,.75);margin-top:5px\">Application Android bêta · Football uniquement</div></div>" +
        "<div style=\"padding:28px\"><p style=\"color:#a8aec8;line-height:1.7\">Voici ton code d’accès pour l’application :</p><div style=\"font-family:monospace;font-size:28px;font-weight:900;letter-spacing:.12em;text-align:center;background:#0d1020;border:1px solid rgba(34,211,238,.25);border-radius:12px;padding:18px;color:#22d3ee\">" + accessCode + "</div><p style=\"font-size:13px;color:#a8aec8;line-height:1.7;margin-top:18px\">Ouvre l’app TousLesMatchs, entre ton email et ce code. Ce code est personnel.</p><p style=\"font-size:12px;color:#7b82a0\">18+ · Jeu responsable · Aucun gain garanti.</p></div></div>";
      brevoSendEmail(email, "Ton code d’accès application TousLesMatchs", html, { critical: true }).catch(e => console.error("[app-access] email:", e.message));
    }
    console.log("[app-access] " + (created ? "code cree" : "code existant") + " pour " + email + " plan=" + plan);
    return res.json({ ok: true, status: created ? "created" : "existing", plan });
  } catch (e) {
    console.error("[app-access]", e.message);
    return res.json({ ok: false, error: "Erreur serveur" });
  }
}

app.post("/api/app-access/start", handleAppAccessStart);
app.post("/app-access/start", handleAppAccessStart);
function scheduleNurturingEmails(email) {
  const now = new Date();
  const j1 = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const j3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const j5 = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const j7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    db.prepare("INSERT OR IGNORE INTO scheduled_emails (email, email_type, send_after) VALUES (?,?,?)").run(email, "nurture_j1", j1);
    db.prepare("INSERT OR IGNORE INTO scheduled_emails (email, email_type, send_after) VALUES (?,?,?)").run(email, "nurture_j3", j3);
    db.prepare("INSERT OR IGNORE INTO scheduled_emails (email, email_type, send_after) VALUES (?,?,?)").run(email, "nurture_j5", j5);
    db.prepare("INSERT OR IGNORE INTO scheduled_emails (email, email_type, send_after) VALUES (?,?,?)").run(email, "nurture_j7", j7);
  } catch (e) { console.error("[nurturing] schedule:", e.message); }
}

function buildPlanComparisonHtml() {
  const plans = [
    { name: "🟢 Standard", price: "4.90€/mois", color: "#34d399", features: ["3 signaux/jour max", "Confiance ≥ 88% — le seuil le plus haut", "Cote réelle ARJEL entre 1.30 et 2.50", "Telegram Standard"], locked: ["Volume Premium", "Radar football Elite", "Alertes prioritaires"] },
    { name: "🟣 Premium", price: "14.90€/mois", color: "#6366f1", badge: "POPULAIRE", features: ["10 signaux/jour max", "Confiance ≥ 85%", "Avant-match ou live", "Telegram Premium", "Tout le Standard inclus"], locked: ["Multisport", "Alertes prioritaires"] },
    { name: "🟠 Elite/VIP", price: "29.90€/mois", color: "#a855f7", features: ["30 signaux/jour max", "Football uniquement", "Confiance ≥ 75%", "Alertes prioritaires", "Telegram Elite + tout le Premium"] },
  ];
  const rows = plans.map(p => {
    const feats = (p.features || []).map(f => `<div style="font-size:12px;color:#eceaf4;line-height:1.8">✅ ${f}</div>`).join("");
    const locks = (p.locked || []).map(f => `<div style="font-size:12px;color:#4a4e6a;line-height:1.8">🔒 ${f}</div>`).join("");
    const badge = p.badge ? `<div style="font-size:9px;font-weight:800;letter-spacing:.1em;background:${p.color};color:#fff;padding:2px 8px;border-radius:6px;display:inline-block;margin-bottom:6px">${p.badge}</div>` : "";
    return `<td style="width:33%;vertical-align:top;padding:12px 8px;border-right:1px solid rgba(255,255,255,.04)">
      ${badge}
      <div style="font-size:14px;font-weight:900;color:${p.color};margin-bottom:2px">${p.name}</div>
      <div style="font-size:18px;font-weight:900;color:#eceaf4;margin-bottom:10px">${p.price}</div>
      ${feats}${locks}
    </td>`;
  }).join("");
  return `<table style="width:100%;border-collapse:collapse;background:#0a0d1a;border:1px solid rgba(99,102,241,.15);border-radius:12px;overflow:hidden"><tr style="border-bottom:1px solid rgba(255,255,255,.06)">${rows}</tr></table>`;
}

function buildNurtureJ1Html(email) {
  let pickLine = "";
  try {
    const picks = JSON.parse(fs.readFileSync("/var/touslesmatchs/picks.json", "utf8"));
    const p = picks.currentPick;
    if (p?.status && ["GAGNE","WIN"].includes(String(p.status).toUpperCase())) {
      pickLine = `<div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:10px;padding:16px;margin-bottom:20px">
        <div style="color:#10b981;font-weight:800;font-size:14px;margin-bottom:4px">✅ Dernier pick : GAGNÉ</div>
        <div style="color:#a8aec8;font-size:13px">${p.home} vs ${p.away} · ${p.prono || p.bet} @${p.cote}</div>
      </div>`;
    }
  } catch (_) {}
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:30px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:#fff">TousLesMatchs</div>
      <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px">Le Conseil IA a encore frappé</div>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#a8aec8;margin:0 0 20px">Depuis ton inscription hier, le Concile a publié son pick du jour.</p>
      ${pickLine}
      <p style="font-size:14px;color:#a8aec8;line-height:1.7;margin-bottom:24px">Tu veux recevoir l'analyse <strong style="color:#eceaf4">complète</strong> — le pick exact, la cote, la mise suggérée et le raisonnement du Conseil IA — directement dans ta boite mail et sur Telegram ?</p>
      <div style="text-align:center;margin-bottom:20px">
        <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none">Déverrouiller l'analyse complète →</a>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="https://www.touslesmatchs.com/#plans" style="color:#6366f1;font-size:13px;text-decoration:none">Voir les offres →</a>
      </div>
      <p style="font-size:12px;color:#7b82a0;text-align:center">18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a></p>
    </div>
  </div>`;
}

function buildNurtureJ3Html() {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:30px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:#fff">TousLesMatchs</div>
      <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px">3 picks publiés depuis ton inscription</div>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#a8aec8;margin:0 0 20px">Tu t'es inscrit il y a 3 jours. Le Concile a travaillé chaque matin.</p>
      <div style="background:#0d1020;border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:20px;margin-bottom:24px">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#22d3ee;margin-bottom:12px">Ce que tu as vu</div>
        <div style="font-size:14px;color:#a8aec8;line-height:2">
          ✅ Match + compétition<br>
          ✅ Niveau de confiance du Concile<br>
          🔒 Le pick exact — <span style="color:#6366f1">réservé Premium/Elite</span><br>
          🔒 La cote recommandée — <span style="color:#6366f1">réservé Premium/Elite</span><br>
          🔒 La raison du signal — <span style="color:#6366f1">réservé Premium/Elite</span>
        </div>
      </div>
      <p style="font-size:14px;color:#a8aec8;line-height:1.7;margin-bottom:24px">Pour <strong style="color:#eceaf4">14.90€/mois</strong>, tu accèdes à tout — pick complet, Live IA sur tous les matchs, canal Telegram Premium.</p>
      <div style="text-align:center;margin-bottom:12px">
        <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 20px rgba(79,70,229,.4)">S'abonner — 14.90€/mois →</a>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="https://www.touslesmatchs.com/#plans" style="color:#6366f1;font-size:13px;text-decoration:none">Pas prêt ? Voir nos offres</a>
      </div>
      <p style="font-size:12px;color:#7b82a0;text-align:center">18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a></p>
    </div>
  </div>`;
}

function buildNurtureJ5Html() {
  const stats = getSignalFortStats();
  const recentWins = stats.recent.filter(r => r.outcome === "win").slice(0, 3);
  const winsBlock = recentWins.length > 0
    ? recentWins.map(r => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="font-size:16px">✅</span>
        <div style="flex:1"><div style="font-size:13px;font-weight:700;color:#eceaf4">${r.home} vs ${r.away}</div><div style="font-size:11px;color:#7b82a0">${r.final_score_home}-${r.final_score_away} · score de confiance ${r.confidence}/100</div></div>
        <div style="font-size:13px;font-weight:800;color:#10b981">GAGNÉ</div>
      </div>`).join("")
    : `<div style="font-size:13px;color:#a8aec8;text-align:center;padding:12px">Le Conseil IA analyse des dizaines de matchs chaque semaine.</div>`;

  return `<div style="font-family:Inter,Arial,sans-serif;max-width:580px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:30px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:#fff">TousLesMatchs</div>
      <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:4px">${stats.winrate}% de winrate sur les signaux forts</div>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#a8aec8;margin:0 0 16px">Voici ce que le Conseil IA a détecté récemment :</p>
      <div style="background:#0d1020;border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:16px;margin-bottom:20px">
        <div style="text-align:center;margin-bottom:12px">
          <span style="font-size:36px;font-weight:900;color:#10b981">${stats.winrate}%</span>
          <div style="font-size:12px;color:#7b82a0;margin-top:2px">${stats.wins} gagnés sur ${stats.total} signaux forts</div>
        </div>
        ${winsBlock}
      </div>
      <p style="font-size:14px;color:#a8aec8;line-height:1.7;margin-bottom:20px">Ces résultats sont <strong style="color:#eceaf4">réels et vérifiables</strong>. Mais tu n'as vu que les signaux — les abonnés ont eu l'analyse complète <em>avant</em> le match.</p>
      <div style="font-size:13px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;text-align:center">Quel plan te correspond ?</div>
      ${buildPlanComparisonHtml()}
      <div style="text-align:center;margin:24px 0 12px">
        <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 20px rgba(79,70,229,.4)">Choisir mon plan →</a>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="https://www.touslesmatchs.com/#plans" style="color:#6366f1;font-size:13px;text-decoration:none">Découvrir nos offres</a>
      </div>
      <p style="font-size:12px;color:#7b82a0;text-align:center">18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a></p>
    </div>
  </div>`;
}

function buildNurtureJ7Html() {
  const stats = getSignalFortStats();
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:580px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:30px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:#fff">TousLesMatchs</div>
      <div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:4px">Ta première semaine est passée</div>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#a8aec8;margin:0 0 16px">En 7 jours, le Conseil IA a analysé des dizaines de matchs. Voici ton bilan :</p>
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px;background:#0d1020;border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#10b981">${stats.wins}</div>
          <div style="font-size:11px;color:#7b82a0;margin-top:2px">Signaux gagnés</div>
        </div>
        <div style="flex:1;min-width:120px;background:#0d1020;border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#6366f1">${stats.winrate}%</div>
          <div style="font-size:11px;color:#7b82a0;margin-top:2px">Winrate global</div>
        </div>
        <div style="flex:1;min-width:120px;background:#0d1020;border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#f59e0b">${stats.total}</div>
          <div style="font-size:11px;color:#7b82a0;margin-top:2px">Signaux analysés</div>
        </div>
      </div>
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:16px;margin-bottom:20px;text-align:center">
        <div style="font-size:14px;color:#f59e0b;font-weight:700;margin-bottom:6px">Tu as reçu les signaux — mais pas les analyses complètes</div>
        <div style="font-size:13px;color:#a8aec8">Les membres ont eu chaque pick détaillé avec cote, raison et mise suggérée.</div>
      </div>
      <div style="font-size:13px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;text-align:center">Compare les plans en un coup d'oeil</div>
      ${buildPlanComparisonHtml()}
      <div style="text-align:center;margin:24px 0 12px">
        <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 20px rgba(245,158,11,.3)">Passer à l'action →</a>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="https://www.touslesmatchs.com/#plans" style="color:#6366f1;font-size:13px;text-decoration:none">Ou voir nos offres</a>
      </div>
      <div style="background:#0d1020;border:1px solid rgba(99,102,241,.15);border-radius:10px;padding:14px;margin-bottom:20px;text-align:center">
        <div style="font-size:12px;color:#a8aec8">📱 Pas encore sur Telegram ?</div>
        <a href="https://t.me/+qFnIuKg2ZhdlMmY8" style="color:#22d3ee;font-size:13px;font-weight:700;text-decoration:none">Rejoindre le canal gratuit →</a>
      </div>
      <p style="font-size:12px;color:#7b82a0;text-align:center">18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a></p>
    </div>
  </div>`;
}

async function processScheduledEmails() {
  if (!BREVO_API_KEY) return;
  try {
    const due = db.prepare("SELECT * FROM scheduled_emails WHERE sent = 0 AND send_after <= datetime('now') LIMIT 10").all();
    for (const row of due) {
      try {
        if (row.email_type === "nurture_j1") {
          await brevoSendEmail(row.email, "✅ Le Concile vient de publier — voici ce que tu as manqué", buildNurtureJ1Html(row.email));
        } else if (row.email_type === "nurture_j3") {
          await brevoSendEmail(row.email, "🔒 Tu vois le signal, pas l'analyse complète — voici comment changer ça", buildNurtureJ3Html());
        } else if (row.email_type === "nurture_j5") {
          await brevoSendEmail(row.email, `📊 ${getSignalFortStats().winrate}% de réussite — les résultats parlent`, buildNurtureJ5Html());
        } else if (row.email_type === "nurture_j7") {
          await brevoSendEmail(row.email, "⚡ Ta première semaine est passée — voici le bilan", buildNurtureJ7Html());
        }
        db.prepare("UPDATE scheduled_emails SET sent = 1 WHERE id = ?").run(row.id);
        console.log(`[nurturing] ${row.email_type} envoyé: ${row.email}`);
      } catch (e) { console.error(`[nurturing] ${row.email_type}:`, e.message); }
    }
  } catch (e) { console.error("[nurturing] process:", e.message); }
}

setInterval(processScheduledEmails, 15 * 60 * 1000);
setTimeout(processScheduledEmails, 60 * 1000);

// ── Signal Fort Bilan — track record des signaux >= 80% ─────────────────────
function getSignalFortStats() {
  try {
    const threshold = getAdaptiveSignalThreshold();
    const raw = db.prepare(`
      SELECT match_key, home, away, competition, country, sport, best_bet, confidence, consensus_votes, outcome,
             score_home_at_analysis, score_away_at_analysis,
             final_score_home, final_score_away, analysed_at, real_odd, real_odd_source,
             minute_at_analysis, diffusion_block,
             sig_sent_standard, sig_sent_premium, sig_sent_elite, sig_sent_free
      FROM concile_analyses
      WHERE confidence >= ? AND outcome IN ('win','loss')
      ORDER BY analysed_at DESC
    `).all(threshold);
    const seen = new Set();
    const all = [];
    for (const r of raw) {
      if (!isVerifiedClientOu25Row(r)) continue;
      const key = `${r.home}_${r.away}_${(r.analysed_at || "").slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(r);
    }
    const wins = all.filter(r => r.outcome === "win").length;
    const losses = all.filter(r => r.outcome === "loss").length;
    const total = all.length;
    const winrate = total > 0 ? Math.round(wins / total * 100) : 0;
    return { total, wins, losses, winrate, recent: all.slice(0, 20) };
  } catch (e) {
    console.error("[signal-fort-bilan] stats:", e.message);
    return { total: 0, wins: 0, losses: 0, winrate: 0, recent: [] };
  }
}

async function sendSignalFortBilanTelegram() {
  const stats = getSignalFortStats();
  if (stats.total < 3) return;

  const recentLines = stats.recent.slice(0, 10).map(r => {
    const icon = r.outcome === "win" ? "✅" : "❌";
    const score = r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : "?";
    return `${icon} ${r.home} vs ${r.away} (${score}) — ${r.best_bet} @ ${r.confidence}/100`;
  }).join("\n");

  const threshold = getAdaptiveSignalThreshold();
  const premiumMsg = `📈 <b>BILAN SIGNAL FORT</b>\n\n🎯 Signaux ≥ ${threshold}/100 de score de confiance :\n✅ Gagnés : <b>${stats.wins}</b>\n❌ Perdus : <b>${stats.losses}</b>\n📉 Winrate : <b>${stats.winrate}%</b>\n\n<b>Derniers résultats :</b>\n${recentLines}\n\n━━━━━━━━━━━━━━━━━━\n🤖 Conseil IA — ${stats.total} signaux analysés`;

  const freeMsg = `📈 <b>BILAN SIGNAL FORT</b>\n\n🎯 Nos signaux ≥ ${threshold}/100 de score de confiance :\n✅ <b>${stats.wins} gagnés</b> sur ${stats.total} signaux\n📉 Winrate : <b>${stats.winrate}%</b>\n\n${recentLines.split("\n").slice(0, 5).map(l => l.replace(/ — .*/, "")).join("\n")}\n\n👉 <a href="https://www.touslesmatchs.com/#plans">⚡ Recevoir tous les signaux dès 4,90€</a>\n\n━━━━━━━━━━━━━━━━━━\n🤖 Conseil IA — TousLesMatchs`;

  // Bilan de résultats : tous les paliers payants le reçoivent, à l'identique.
  await sendToPaidChannels(premiumMsg, { tag: "signal-fort-bilan" });
  if (TELEGRAM_CHANNEL_ID) {
    const ok = await sendTelegramMessage(TELEGRAM_CHANNEL_ID, freeMsg);
    console.log(`[signal-fort-bilan] Telegram free: ${ok ? "OK" : "FAIL"}`);
  }
}

// Bilan hebdomadaire chaque dimanche à 20h (vérifie toutes les heures)
setInterval(() => {
  const now = new Date();
  if (now.getDay() === 0 && now.getHours() === 20 && now.getMinutes() < 60) {
    sendSignalFortBilanTelegram().catch(e => console.error("[signal-fort-bilan]", e.message));
    sendWeeklyConversionEmail().catch(e => console.error("[weekly-conversion]", e.message));
    sendWeeklyAgentsAudit().catch(e => console.error("[weekly-agents-audit]", e.message));
  }
}, 60 * 60 * 1000);

// ── Rapport hebdomadaire de perf des IA (dimanche 20h, Telegram admin) ────────
// Garantit que TU vois chaque semaine où en sont les agents (officiels + shadow)
// sans avoir à lancer une commande. Si une IA se met à sous-performer, elle
// apparaîtra dans le rapport avec son winrate en baisse — signal d'alerte visuel.
async function sendWeeklyAgentsAudit() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return;
  try {
    const officialAgents = db.prepare(`
      SELECT agent_name, COUNT(*) total,
             SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
             SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM agent_predictions
      WHERE outcome IN ('win','loss')
      GROUP BY agent_name
    `).all().map(r => ({ ...r, resolved: r.wins + r.losses, winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null }))
      .sort((a, b) => (b.winrate ?? -1) - (a.winrate ?? -1));

    const shadowAgents = db.prepare(`
      SELECT agent_name, COUNT(*) total,
             SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
             SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM shadow_evals
      WHERE outcome IN ('win','loss')
      GROUP BY agent_name
    `).all().map(r => ({ ...r, resolved: r.wins + r.losses, winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null }))
      .sort((a, b) => (b.winrate ?? -1) - (a.winrate ?? -1));

    // Meilleur agent par marché — piloter la boucle vertueuse
    const matrixRows = db.prepare(`
      SELECT agent_name, market_line,
             COUNT(*) total,
             SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
             SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM agent_market_predictions
      WHERE outcome IN ('win','loss')
      GROUP BY agent_name, market_line
    `).all();
    const lineLabels = { buts: "Over/Under 2.5", btts: "BTTS", resultat: "Résultat 1X2", mt1: "But 1ère MT" };
    const bestByMarket = {};
    matrixRows.forEach(r => {
      const resolved = r.wins + r.losses;
      if (resolved < 5) return;
      const wr = Math.round(r.wins / resolved * 100);
      if (!bestByMarket[r.market_line] || wr > bestByMarket[r.market_line].winrate) {
        bestByMarket[r.market_line] = { agent: r.agent_name, winrate: wr, resolved, label: lineLabels[r.market_line] || r.market_line };
      }
    });

    const fmt = (a) => `  ${a.winrate !== null ? `${a.winrate}%` : "n/a"} — ${a.agent_name} (${a.wins}W/${a.losses}L)`;
    const msg = [
      `📊 <b>AUDIT HEBDOMADAIRE DES IA</b>`,
      `📅 Semaine du ${new Date(Date.now() - 7*86400000).toISOString().slice(0,10)} au ${new Date().toISOString().slice(0,10)}`,
      ``,
      `<b>🎯 IA officielles</b>`,
      officialAgents.length ? officialAgents.map(fmt).join("\n") : "  (aucune donnée)",
      ``,
      `<b>⚪ IA blanches (banc d'essai)</b>`,
      shadowAgents.length ? shadowAgents.map(fmt).join("\n") : "  (aucune donnée)",
      ``,
      `<b>🏆 Meilleur agent par marché</b>`,
      Object.keys(bestByMarket).length
        ? Object.values(bestByMarket).map(b => `  🏆 ${b.label} → ${b.agent} (${b.winrate}% sur ${b.resolved})`).join("\n")
        : "  (pas assez de données)",
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `🤖 Rapport auto · TousLesMatchs`,
    ].join("\n");

    const ok = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, msg);
    console.log(`[weekly-agents-audit] Telegram admin: ${ok ? "OK" : "FAIL"}`);
  } catch (e) {
    console.error("[weekly-agents-audit] error:", e.message);
  }
}

// ── Auto-post résultat Signal Fort sur Telegram quand résolu ─────────────────
const _signalResultSentCache = new Set();
async function notifySignalFortResult(analysis, outcome, scoreH, scoreA) {
  const cacheKey = `${analysis.home}_${analysis.away}`;
  if (_signalResultSentCache.has(cacheKey)) return;
  _signalResultSentCache.add(cacheKey);

  const icon = outcome === "win" ? "✅" : "❌";
  const resultText = outcome === "win" ? "GAGNÉ" : "PERDU";
  const sportIcons = { Football:"⚽", Basketball:"🏀", Hockey:"🏒", Baseball:"⚾" };
  const si = sportIcons[analysis.sport] || "🎯";
  const stats = getSignalFortStats();
  const coteAffichee = rowOdd(analysis).toFixed(2);
  const gain = (10 * parseFloat(coteAffichee)).toFixed(2);
  // Nom du bookmaker source (transparence) — sauf si cote estimée
  const _bm = analysis.real_odd_source && !/estimation/i.test(String(analysis.real_odd_source))
    ? String(analysis.real_odd_source) : null;
  const bmSuffix = _bm ? ` <i>(${_bm})</i>` : "";
  // Cote/gain affichés UNIQUEMENT si vraie cote bookmaker (jamais l'estimation).
  const hasReal = !!_bm;
  const minuteStr = analysis.minute_at_analysis !== null && analysis.minute_at_analysis !== undefined
    ? ` (donné à la ${analysis.minute_at_analysis}e min)`
    : "";

  const premiumMsg = [
    `${icon} <b>SIGNAL FORT ${resultText}</b>`,
    ``,
    `${si} <b>${analysis.home} vs ${analysis.away}</b>`,
    analysis.competition ? `🏆 ${analysis.competition}` : "",
    `⚽ Score final : <b>${scoreH}-${scoreA}</b>`,
    `💡 Analyse IA : <b>${analysis.best_bet}${minuteStr}</b>`,
    `📊 Score de confiance : <b>${analysis.confidence}/100</b>${hasReal ? ` · Cote : <b>${coteAffichee}</b>${bmSuffix}` : ""}`,
    ``,
    outcome === "win" && hasReal
      ? `💰 Mise 10€ → <b>Gain ${gain}€</b>`
      : ``,
    ``,
    `📈 Bilan Signal Fort : <b>${stats.wins}W / ${stats.losses}L — ${stats.winrate}% winrate</b>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `🤖 Conseil IA — TousLesMatchs`,
    // Bloc anglais compact (voir BET_LABEL_EN) : le score final et le bilan
    // chiffres sont deja lisibles tels quels, on ne traduit que le verdict
    // et le type d'analyse.
    ``,
    `🇬🇧 <b>STRONG SIGNAL ${outcome === "win" ? "WON" : "LOST"}</b> — ${betLabelEn(analysis.best_bet)}`,
    `⚠️ 18+ — Responsible gaming`,
  ].filter(Boolean).join("\n");

  const freeMsg = [
    `${icon} <b>SIGNAL FORT ${resultText}</b>`,
    ``,
    `${si} <b>${analysis.home} vs ${analysis.away}</b>`,
    analysis.competition ? `🏆 ${analysis.competition}` : "",
    `⚽ Score final : <b>${scoreH}-${scoreA}</b>`,
    `📊 Score de confiance : <b>${analysis.confidence}/100</b>${hasReal ? ` · Cote : <b>${coteAffichee}</b>${bmSuffix}` : ""}`,
    ``,
    outcome === "win" && hasReal
      ? `💰 Mise 10€ → <b>Gain ${gain}€</b>`
      : ``,
    ``,
    `📈 Bilan : <b>${stats.wins} gagnés sur ${stats.total} — ${stats.winrate}% winrate</b>`,
    ``,
    outcome === "win"
      ? `💎 Imagine si tu avais eu le pick en direct...\n👉 <a href="https://www.touslesmatchs.com/#plans">⚡ Recevoir tous les signaux dès 4,90€</a>`
      : `💪 La discipline fait la différence sur le long terme.\n👉 <a href="https://www.touslesmatchs.com/#plans">⚡ Recevoir tous les signaux dès 4,90€</a>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `🤖 Conseil IA — TousLesMatchs`,
    ``,
    `🇬🇧 <b>STRONG SIGNAL ${outcome === "win" ? "WON" : "LOST"}</b> — every result stays public, wins and losses alike.`,
    `⚠️ 18+ — Responsible gaming`,
  ].filter(Boolean).join("\n");

  // Cohérence : on ne poste le résultat QUE sur les canaux qui ont réellement reçu
  // le pick. Un signal jamais diffusé (bloqué/hors ARJEL/plafond) ne génère aucun
  // message de résultat — fini les "gagné/perdu + inscris-toi" sortis de nulle part.
  const deliveryProof = storedTelegramDelivery(analysis);
  const sentStandard = deliveryProof.channels.has("standard");
  const sentPremium  = deliveryProof.channels.has("premium");
  const sentElite    = deliveryProof.channels.has("elite");
  const sentFree     = deliveryProof.channels.has("free");
  if (!sentStandard && !sentPremium && !sentElite && !sentFree) {
    console.log(`[signal-fort-result] ${analysis.home} vs ${analysis.away} → ${outcome} : pick jamais diffusé, résultat non posté`);
    return;
  }
  if (TELEGRAM_STANDARD_CHANNEL_ID && sentStandard) sendTelegramMessage(TELEGRAM_STANDARD_CHANNEL_ID, premiumMsg);
  if (TELEGRAM_PREMIUM_CHANNEL_ID && sentPremium)   sendTelegramMessage(TELEGRAM_PREMIUM_CHANNEL_ID, premiumMsg);
  if (TELEGRAM_ELITE_CHANNEL_ID && sentElite)       sendTelegramMessage(TELEGRAM_ELITE_CHANNEL_ID, premiumMsg);
  if (TELEGRAM_CHANNEL_ID && sentFree)              sendTelegramMessage(TELEGRAM_CHANNEL_ID, freeMsg);
  console.log(`[signal-fort-result] ${icon} ${analysis.home} vs ${analysis.away} → ${outcome} (posté:${sentFree ? " free" : ""}${sentStandard ? " standard" : ""}${sentPremium ? " premium" : ""}${sentElite ? " elite" : ""})`);
}

// Marque sur quel canal client un signal a été réellement diffusé (col interne fixe).
const SIGNAL_SENT_COLUMNS = ["sig_sent_free", "sig_sent_standard", "sig_sent_premium", "sig_sent_elite"];
// Cause reelle du marquage errone trouve le 07/08/2026 sur Club Brugge KV vs
// Kortrijk : sig_sent_elite=1 sur une analyse a 55% de confiance, avec un
// diffusion_block et une cote estimee, sans aucun "Telegram elite OK" en face.
//
// L'ordre des appels etait pourtant correct — markSignalSent() n'est appele
// qu'apres confirmation d'envoi. Le defaut etait dans la REQUETE : elle marquait
// TOUTES les lignes du match pour la journee. Or match_key contient la tranche
// de minute et le score (getPredictionSnapshotKey), donc un match analyse toutes
// les 6 minutes produit une dizaine de lignes par jour. Un envoi reussi a la 25e
// minute marquait aussi la ligne de la 40e, bloquee a 55%.
//
// On cible desormais la ligne exacte par match_key, et on refuse de marquer une
// ligne bloquee ou dont la cote n'est qu'une estimation — deux garde-fous
// demandes en relecture, qui rendent le marquage errone impossible meme si un
// autre chemin d'appel apparaissait un jour.
function markSignalSent(home, away, col, matchKey) {
  if (!SIGNAL_SENT_COLUMNS.includes(col)) return;
  try {
    const garde = `AND (diffusion_block IS NULL OR trim(diffusion_block) = '')
                   AND (real_odd_source IS NULL OR lower(real_odd_source) NOT LIKE '%estimation%')`;
    const r = matchKey
      ? db.prepare(`UPDATE concile_analyses SET ${col}=1 WHERE match_key = ? ${garde}`).run(matchKey)
      : db.prepare(
          `UPDATE concile_analyses SET ${col}=1
           WHERE lower(trim(home))=lower(trim(?)) AND lower(trim(away))=lower(trim(?))
             AND date(analysed_at)=date('now') ${garde}`
        ).run(home, away);
    if (!r.changes) {
      console.warn(`[signal-sent] ${col} NON marque pour ${home} vs ${away} : ligne bloquee, cote estimee, ou introuvable`);
    }
  } catch (e) { console.error("[signal-sent]", e.message); }
}

// Nombre de signaux RÉELLEMENT diffusés aujourd'hui sur un canal, lu depuis la
// base et non depuis un compteur mémoire. Les plafonds journaliers (3/jour en
// Standard, etc.) sont une promesse commerciale affichée sur la page tarifs :
// un compteur en mémoire repartait de zéro à chaque redémarrage du conteneur,
// donc un jour à plusieurs redéploiements pouvait dépasser le plafond annoncé.
// Même convention de date (UTC) que markSignalSent, pour rester cohérent.
function signalsSentToday(col) {
  if (!SIGNAL_SENT_COLUMNS.includes(col)) return 0;
  try {
    const channel = col.replace(/^sig_sent_/, "");
    const row = db.prepare(
      `SELECT COUNT(DISTINCT match_key) AS n FROM telegram_signal_deliveries
       WHERE channel = ? AND ok = 1 AND telegram_message_id IS NOT NULL
         AND date(created_at) = date('now')`
    ).get(channel);
    return Number(row?.n) || 0;
  } catch (e) {
    console.error("[signal-sent] comptage:", e.message);
    return 0; // en cas d'incident, on ne bloque pas la diffusion
  }
}

// Jetons restants d'un abonné : un budget UNIQUE partagé entre les signaux
// Telegram réellement diffusés aujourd'hui sur son palier (canal commun, donc
// identique pour tout le palier) et ses propres analyses ouvertes à la demande
// sur le site (Live IA). Décision fondateur du 04/08/2026 : un abonné Standard
// (3 jetons/j) qui a déjà reçu 2 signaux Telegram aujourd'hui ne peut plus
// ouvrir qu'1 analyse manuelle avant minuit — sinon on lui promet 3 alertes/j
// ET 3 analyses/j en plus, soit 6, ce qui n'est jamais ce qui a été vendu.
// Quota de jetons/jour par palier — decision fondateur du 04/08/2026.
// "carte" = achat ponctuel a 1€ (voir STRIPE_PRICE_ID_CARTE) : 1 jeton unique.
function defaultCreditsMaxForPlan(plan) {
  switch (String(plan || "").toLowerCase()) {
    case "carte":    return 1;
    case "free":     return 1;
    case "standard": return 3;
    case "premium":
    case "vip":      return 10;
    case "elite":    return 30;
    default:         return 10;
  }
}

// Achat ponctuel d'un jeton à 1€ (offre "carte") pour un abonné DÉJÀ actif :
// on ne crée pas un second compte parallèle, on ajoute +1 jeton à SON compte
// existant pour aujourd'hui seulement (demande fondateur 04/08/2026 — cas
// d'usage réel : un abonné Standard qui a épuisé ses 3 jetons du jour et veut
// en racheter un sans changer de code d'accès). credits_used peut passer sous
// zéro sans conséquence : creditsLeftForPlan() plafonne déjà à 0 côté lecture,
// et credits_date repart à zéro le lendemain de toute façon.
// Retourne true si un compte existant a été crédité, false si aucun trouvé
// (dans ce cas l'appelant crée un code "carte" autonome, comportement inchangé).
function grantCarteCreditToExistingAccount(email) {
  try {
    const today = getTodayStr();
    const wdb = new Database(CODES_DB_PATH);
    const row = wdb.prepare(
      "SELECT code, plan, credits_used, credits_date FROM codes WHERE email = ? AND active = 1 AND plan != 'carte' ORDER BY rowid DESC LIMIT 1"
    ).get(email);
    if (!row) { wdb.close(); return false; }
    if (row.credits_date === today) {
      wdb.prepare("UPDATE codes SET credits_used = credits_used - 1 WHERE code = ? AND email = ?").run(row.code, email);
    } else {
      wdb.prepare("UPDATE codes SET credits_used = -1, credits_date = ? WHERE code = ? AND email = ?").run(today, row.code, email);
    }
    wdb.close();
    console.log(`[carte] +1 jeton bonus crédité sur le compte ${row.plan} existant de ${email}`);
    return true;
  } catch (e) { console.error("[carte] grantCarteCreditToExistingAccount:", e.message); return false; }
}

function creditsLeftForPlan(plan, creditsMax, creditsUsed, creditsDate) {
  if (!creditsMax || creditsMax <= 0) return null; // illimité (admin, etc.)
  const today = new Date().toISOString().slice(0, 10);
  const usedManual = creditsDate === today ? (Number(creditsUsed) || 0) : 0;
  const col = SIG_COLUMN_BY_PLAN[String(plan || "").toLowerCase()] || null;
  const usedTelegram = col ? signalsSentToday(col) : 0;
  return Math.max(0, creditsMax - usedManual - usedTelegram);
}

// ── Email hebdomadaire de conversion aux leads gratuits ──────────────────────
async function sendWeeklyConversionEmail() {
  if (!BREVO_API_KEY) return;
  const stats = getSignalFortStats();
  if (stats.total < 3) return;

  const recentWins = stats.recent.filter(r => r.outcome === "win").slice(0, 5);
  const winsRows = recentWins.map(r =>
    `<tr style="border-bottom:1px solid rgba(255,255,255,.06)">
      <td style="padding:8px 6px;font-size:13px;color:#10b981">✅</td>
      <td style="padding:8px 6px;font-size:13px;color:#eceaf4">${r.home} vs ${r.away}</td>
      <td style="padding:8px 6px;font-size:13px;color:#22d3ee">${r.final_score_home}-${r.final_score_away}</td>
      <td style="padding:8px 6px;font-size:13px;color:#f8d37a">${r.confidence}%</td>
    </tr>`
  ).join("");

  const htmlContent = `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block">TousLesMatchs</div>
    <div style="font-size:11px;color:#7b82a0;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">RÉSULTATS SIGNAL FORT — CETTE SEMAINE</div>
  </div>
  <div style="background:#0d1020;border:1px solid rgba(16,185,129,.3);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:48px;font-weight:900;color:#10b981">${stats.winrate}%</div>
      <div style="font-size:14px;color:#a8aec8">Winrate Signal Fort (≥${getAdaptiveSignalThreshold()}% confiance)</div>
      <div style="font-size:13px;color:#7b82a0;margin-top:4px">${stats.wins} gagnés · ${stats.losses} perdus · ${stats.total} signaux</div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid rgba(255,255,255,.12)">
        <th style="padding:6px;font-size:11px;color:#7b82a0;text-align:left"></th>
        <th style="padding:6px;font-size:11px;color:#7b82a0;text-align:left">Match</th>
        <th style="padding:6px;font-size:11px;color:#7b82a0;text-align:left">Score</th>
        <th style="padding:6px;font-size:11px;color:#7b82a0;text-align:left">Confiance</th>
      </tr>
      ${winsRows}
    </table>
    <div style="text-align:center;margin-top:20px;padding:14px;background:rgba(79,70,229,.12);border:1px solid rgba(79,70,229,.25);border-radius:10px">
      <div style="font-size:14px;color:#a8aec8;margin-bottom:6px">🔒 Les analyses complètes sont réservées aux abonnés</div>
      <div style="font-size:13px;color:#6366f1">Tu vois les matchs gagnants, mais pas l'analyse détaillée — rejoins le Premium pour tout débloquer.</div>
    </div>
  </div>
  <div style="margin:20px 0;padding:0 4px">
    <div style="font-size:12px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;text-align:center">Quel plan pour toi ?</div>
    ${buildPlanComparisonHtml()}
  </div>
  <div style="text-align:center;margin-bottom:16px">
    <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 20px rgba(79,70,229,.4)">Choisir mon plan →</a>
  </div>
  <div style="text-align:center;margin-bottom:16px">
    <a href="https://www.touslesmatchs.com/#plans" style="color:#6366f1;font-size:13px;text-decoration:none">Ou voir nos offres</a>
  </div>
  ${bookmakerEmailHtml()}
  <div style="text-align:center;font-size:11px;color:#7b82a0;line-height:1.6">
    TousLesMatchs — Bilan automatique hebdomadaire<br>
    ⚠️ 18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a>
  </div>
</div>`;

  try {
    const premiumEmails = new Set();
    try {
      const codesDb = new Database(CODES_DB_PATH, { readonly: true });
      codesDb.prepare("SELECT email FROM codes WHERE active = 1 AND email IS NOT NULL AND email != ''").all()
        .forEach(r => premiumEmails.add(r.email.toLowerCase()));
      codesDb.close();
    } catch {}

    const leadRows = loadLeads().leads || [];
    const freeEmails = [...new Set(leadRows.map(l => l.email).filter(e => e && !premiumEmails.has(e.toLowerCase())))];
    let sent = 0;
    for (const email of freeEmails.slice(0, 300)) {
      try {
        await brevoSendEmail(email, `📈 ${stats.winrate}% winrate cette semaine — Signal Fort IA`, htmlContent);
        sent++;
      } catch {}
    }
    console.log(`[weekly-conversion] Envoyé à ${sent}/${freeEmails.length} leads gratuits`);
  } catch (e) { console.error("[weekly-conversion]", e.message); }
}

// Forgot code - lookup codes.db by email and send via Brevo
app.post("/forgot-code", async (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes("@")) return res.json({ ok: false });
  const emailClean = email.toLowerCase().trim();
  // Always reply ok to avoid email enumeration
  res.json({ ok: true });
  // Async: look up codes and send
  try {
    // Ancien chemin en dur "/var/touslesmatchs/codes.db" inexistant sur le
    // conteneur — la vraie base est CODES_DB_PATH ("/data/codes.db"), utilisee
    // partout ailleurs. Resultat : aucun code n'etait jamais trouve, donc
    // aucun email n'etait jamais envoye, silencieusement (constate par
    // Greg le 01/08/2026 — bug preexistant, sans lien avec l'OTP).
    const cdb = new Database(CODES_DB_PATH, { readonly: true });
    const rows = cdb.prepare(
      "SELECT code, plan FROM codes WHERE email = ? AND active = 1"
    ).all(emailClean);
    cdb.close();
    if (!rows.length) return;
    if (!BREVO_API_KEY) return;
    const codeList = rows.map(r =>
      `<tr><td style="padding:6px 12px;font-family:monospace;font-size:16px;font-weight:700;letter-spacing:.05em">${r.code}</td><td style="padding:6px 12px;color:#7b82a0;font-size:13px">${r.plan.toUpperCase()}</td></tr>`
    ).join("");
    const html = `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:#fff">TousLesMatchs</div>
          <div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:4px">Récupération de votre code d'accès</div>
        </div>
        <div style="padding:32px">
          <p style="margin:0 0 16px;color:#a8aec8;font-size:14px">Voici votre code d'accès associé à <strong>${emailClean}</strong> :</p>
          <table style="width:100%;border-collapse:collapse;background:#0d1020;border-radius:8px;overflow:hidden">
            ${codeList}
          </table>
          <p style="margin:20px 0 0;color:#7b82a0;font-size:12px">Copiez ce code et connectez-vous sur <a href="https://touslesmatchs.com" style="color:#6366f1">touslesmatchs.com</a>.</p>
        </div>
      </div>`;
    await brevoSendEmail(emailClean, "Votre code d'accès TousLesMatchs", html, { critical: true });
    console.log(`[forgot-code] Code(s) envoyé(s) à ${emailClean}`);
  } catch (e) {
    console.error("[forgot-code] error:", e.message);
  }
});

// ── Verify code (reads codes.db directly) ────────────────────────────────────
const CODES_DB_PATH = process.env.CODES_DB_PATH || "/data/codes.db";

/* TLM FIREBASE FCM SERVER */
let tlmFirebaseMessaging = null;

try {
  if (!firebaseAdmin.apps.length) {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.applicationDefault()
    });
  }
  tlmFirebaseMessaging = firebaseAdmin.messaging();
  console.log("[fcm] Firebase Admin initialise");
} catch (error) {
  console.error("[fcm] initialisation:", error.message);
}

db.exec(
  "CREATE TABLE IF NOT EXISTS fcm_devices (" +
  "token TEXT PRIMARY KEY," +
  "email TEXT NOT NULL," +
  "session_token TEXT NOT NULL," +
  "platform TEXT DEFAULT 'android'," +
  "enabled INTEGER DEFAULT 1," +
  "updated_at TEXT DEFAULT CURRENT_TIMESTAMP" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_fcm_devices_email ON fcm_devices(email);" +
  "CREATE TABLE IF NOT EXISTS fcm_notifications (" +
  "signal_key TEXT PRIMARY KEY," +
  "fixture_id TEXT," +
  "team TEXT," +
  "sent_at TEXT DEFAULT CURRENT_TIMESTAMP," +
  "success_count INTEGER DEFAULT 0," +
  "failure_count INTEGER DEFAULT 0" +
  ");"
);

function verifyFcmSubscriber(email, sessionToken) {
  if (!email || !sessionToken) return null;

  let codesDb;
  try {
    codesDb = new Database(CODES_DB_PATH, { readonly: true });

    const row = codesDb.prepare(
      "SELECT email, plan, active, expires_at, session_token " +
      "FROM codes WHERE lower(email) = ? AND session_token = ? " +
      "AND active = 1 ORDER BY datetime(created_at) DESC LIMIT 1"
    ).get(
      String(email).toLowerCase().trim(),
      String(sessionToken).trim()
    );

    if (!row) return null;
    if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return null;
    if (String(row.plan || "").toLowerCase() === "free") return null;

    return row;
  } catch (error) {
    console.error("[fcm] verification abonne:", error.message);
    return null;
  } finally {
    try { if (codesDb) codesDb.close(); } catch (_) {}
  }
}

app.post("/fcm/register", (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  const sessionToken = String(req.body?.session || "").trim();
  const token = String(req.body?.token || "").trim();

  if (!email || !sessionToken || token.length < 40) {
    return res.status(400).json({
      ok: false,
      error: "donnees_fcm_invalides"
    });
  }

  const subscriber = verifyFcmSubscriber(email, sessionToken);
  if (!subscriber) {
    return res.status(401).json({
      ok: false,
      error: "session_ou_abonnement_invalide"
    });
  }

  db.prepare(
    "INSERT INTO fcm_devices " +
    "(token,email,session_token,platform,enabled,updated_at) " +
    "VALUES (?,?,?,'android',1,datetime('now')) " +
    "ON CONFLICT(token) DO UPDATE SET " +
    "email=excluded.email," +
    "session_token=excluded.session_token," +
    "platform='android'," +
    "enabled=1," +
    "updated_at=datetime('now')"
  ).run(token, email, sessionToken);

  return res.json({
    ok: true,
    registered: true,
    plan: subscriber.plan
  });
});

app.post("/fcm/unregister", (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (token) {
    db.prepare(
      "UPDATE fcm_devices SET enabled=0,updated_at=datetime('now') WHERE token=?"
    ).run(token);
  }
  res.json({ ok: true });
});

async function publishStrictGoal05Signals(matches) {
  const eligible = (matches || []).filter(function (match) {
    return match?.goal05Criteria?.eligible === true &&
      match?.goal05Criteria?.play === true;
  });

  for (const match of eligible) {
    const criteria = match.goal05Criteria;
    const fixtureId = String(match.fixtureId || match.id || "");
    const team = String(criteria.team || "");
    const signalKey = fixtureId + "_" +
      team.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]/g, "") +
      "_goal05";

    const alreadySent = db.prepare(
      "SELECT signal_key FROM fcm_notifications WHERE signal_key=?"
    ).get(signalKey);

    if (alreadySent) continue;

    const signal = {
      ok: true,
      id: signalKey,
      type: "goal05_team_over_0_5",
      status: "active",
      sentAt: new Date().toISOString(),
      fixtureId: fixtureId,
      match: String(match.home || "") + " - " + String(match.away || ""),
      home: match.home,
      away: match.away,
      team: team,
      opponent: criteria.opponent,
      competition: match.competition || "",
      minute: Number(match.minute || 0),
      score_home: Number(match.score_home || 0),
      score_away: Number(match.score_away || 0),
      odd: Number(criteria.liveOdd || 0),
      bet: team + " +0,5 but",
      reason: "Tous les critères stricts sont validés",
      checks: criteria
    };

    fs.mkdirSync(require("path").dirname(GOAL05_LATEST_SIGNAL_FILE), {
      recursive: true
    });
    fs.writeFileSync(
      GOAL05_LATEST_SIGNAL_FILE,
      JSON.stringify(signal, null, 2)
    );

    const devices = db.prepare(
      "SELECT token,email,session_token FROM fcm_devices WHERE enabled=1"
    ).all();

    const validDevices = devices.filter(function (device) {
      const valid = verifyFcmSubscriber(device.email, device.session_token);
      if (!valid) {
        db.prepare(
          "UPDATE fcm_devices SET enabled=0 WHERE token=?"
        ).run(device.token);
      }
      return Boolean(valid);
    });

    let successCount = 0;
    let failureCount = 0;

    if (tlmFirebaseMessaging && validDevices.length) {
      for (let index = 0; index < validDevices.length; index += 500) {
        const batch = validDevices.slice(index, index + 500);

        const response = await tlmFirebaseMessaging.sendEachForMulticast({
          tokens: batch.map(function (device) { return device.token; }),
          notification: {
            title: "Signal +0,5 but validé",
            body: team + " peut marquer · " +
              String(match.home || "") + " - " +
              String(match.away || "") + " · " +
              Number(match.minute || 0) + "'"
          },
          data: {
            signalKey: signalKey,
            fixtureId: fixtureId,
            team: team,
            route: "https://www.touslesmatchs.com/app.html?tab=pick"
          },
          android: {
            priority: "high",
            notification: {
              channelId: "goal05_signals",
              sound: "default"
            }
          }
        });

        successCount += response.successCount;
        failureCount += response.failureCount;

        response.responses.forEach(function (item, position) {
          if (item.success) return;

          const code = String(item.error?.code || "");
          if (
            code.includes("registration-token-not-registered") ||
            code.includes("invalid-registration-token")
          ) {
            db.prepare(
              "UPDATE fcm_devices SET enabled=0 WHERE token=?"
            ).run(batch[position].token);
          }
        });
      }
    }

    db.prepare(
      "INSERT INTO fcm_notifications " +
      "(signal_key,fixture_id,team,success_count,failure_count) " +
      "VALUES (?,?,?,?,?)"
    ).run(
      signalKey,
      fixtureId,
      team,
      successCount,
      failureCount
    );

    console.log(
      "[fcm] signal " + signalKey +
      " publie: " + successCount +
      " succes, " + failureCount + " echec"
    );
  }
}


// Auto-create codes table if it doesn't exist
try {
  const _cdb = new Database(CODES_DB_PATH);
  _cdb.exec(`
    CREATE TABLE IF NOT EXISTS codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      email TEXT NOT NULL,
      plan TEXT DEFAULT 'free',
      active INTEGER DEFAULT 1,
      expires_at TEXT DEFAULT NULL,
      credits_max INTEGER DEFAULT 10,
      credits_used INTEGER DEFAULT 0,
      credits_date TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  // stripe_customer_id : necessaire pour ouvrir le vrai portail de facturation
  // Stripe (Phase 4, 01/08/2026) sans avoir a rechercher le client par email
  // (une recherche par email peut renvoyer plusieurs clients Stripe distincts).
  const _cdbCols = _cdb.prepare("PRAGMA table_info(codes)").all().map(c => c.name);
  if (!_cdbCols.includes("stripe_customer_id")) {
    _cdb.exec("ALTER TABLE codes ADD COLUMN stripe_customer_id TEXT DEFAULT NULL");
  }
  // Jeton de session unique (une seule connexion active a la fois, voir
  // /verify-code et /session-check, demande de Greg le 03/08/2026).
  if (!_cdbCols.includes("session_token")) {
    _cdb.exec("ALTER TABLE codes ADD COLUMN session_token TEXT DEFAULT NULL");
  }
  _cdb.close();
} catch(e) { console.error("[codes-db] init error:", e.message); }

// ── OTP + sessions ──────────────────────────────────────────────────────────
const OTP_TTL_MS = 10 * 60000;             // code valable 10 min
const OTP_REQUEST_COOLDOWN_MS = 60000;      // 1 demande / email / minute
const OTP_MAX_ATTEMPTS = 5;                 // au-dela, le code est grille
const SESSION_TTL_MS = 30 * 24 * 3600000;   // session glissante 30 jours

const _otpRequestCooldown = new Map(); // email -> timestamp derniere demande

function hashOtp(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// La table `codes` vit dans CODES_DB_PATH (codes.db), pas dans DB_PATH
// (tlm.db) — interroger `codes` via la connexion `db` principale echoue
// silencieusement ("no such table"). Constate le 01/08/2026 lors du premier
// test reel de /auth/verify-otp.
function lookupAccountByEmail(email) {
  try {
    const cdb = new Database(CODES_DB_PATH, { readonly: true });
    const row = cdb.prepare(
      "SELECT plan, expires_at, credits_max, credits_used, created_at FROM codes WHERE email = ? AND active = 1 ORDER BY rowid DESC LIMIT 1"
    ).get(email);
    cdb.close();
    return row || null;
  } catch (e) {
    console.error("[otp] lookupAccountByEmail:", e.message);
    return null;
  }
}

// Statut complet (Phase 3) : contrairement a lookupAccountByEmail (qui ne
// regarde que les codes actifs), celle-ci regarde aussi les codes desactives
// pour distinguer "jamais abonne" de "resilie" — necessaire pour l'affichage
// du vrai statut dans /dashboard.
// Un compte gratuit pur (jamais de code, jamais paye) n'a aucune ligne dans
// codes -- sans repli, "Membre depuis" restait vide sur le dashboard (signale
// par Greg le 02/08/2026). La premiere session de connexion est le meilleur
// proxy disponible : pour un compte OTP-only, le premier login EST la creation
// du compte.
function firstSeenFallback(email) {
  try {
    const row = db.prepare("SELECT MIN(created_at) AS first_seen FROM sessions WHERE email = ?").get(email);
    return row?.first_seen || null;
  } catch (e) {
    console.error("[otp] firstSeenFallback:", e.message);
    return null;
  }
}

function lookupFullAccountStatus(email) {
  try {
    const cdb = new Database(CODES_DB_PATH, { readonly: true });
    const row = cdb.prepare(
      "SELECT plan, active, expires_at, credits_max, credits_used, created_at FROM codes WHERE email = ? ORDER BY rowid DESC LIMIT 1"
    ).get(email);
    cdb.close();
    if (!row) return { status: "free", plan: "free", expires_at: null, credits_max: null, credits_used: null, created_at: firstSeenFallback(email) };
    let status;
    if (!row.active) status = "cancelled";
    else if (row.expires_at && new Date(row.expires_at) < new Date()) status = "expired";
    else status = "active";
    return { status, plan: row.plan, expires_at: row.expires_at, credits_max: row.credits_max, credits_used: row.credits_used, created_at: row.created_at || firstSeenFallback(email) };
  } catch (e) {
    console.error("[otp] lookupFullAccountStatus:", e.message);
    return { status: "free", plan: "free", expires_at: null, credits_max: null, credits_used: null, created_at: firstSeenFallback(email) };
  }
}

app.post("/auth/request-otp", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json({ ok: false, error: "Email invalide" });
  }
  const now = Date.now();
  const last = _otpRequestCooldown.get(email) || 0;
  if (now - last < OTP_REQUEST_COOLDOWN_MS) {
    return res.json({ ok: false, error: "Merci de patienter avant de redemander un code." });
  }
  _otpRequestCooldown.set(email, now);

  // Reponse volontairement identique qu'un compte existe ou non — ne jamais
  // reveler publiquement l'existence d'un email (demande explicite Phase 2).
  try {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
    db.prepare("INSERT INTO otp_codes (email, code_hash, expires_at) VALUES (?,?,?)")
      .run(email, hashOtp(code), expiresAt);
    // Purge legere des vieux codes perimes non utilises pour cet email.
    db.prepare("DELETE FROM otp_codes WHERE email = ? AND used = 0 AND expires_at < datetime('now')").run(email);

    if (BREVO_API_KEY) {
      const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:4px">Ton code de connexion TousLesMatchs</h2>
        <p style="font-size:34px;font-weight:900;letter-spacing:.12em;color:#4f46e5">${code}</p>
        <p style="color:#555">Ce code expire dans 10 minutes et ne peut être utilisé qu'une seule fois.</p>
        <p style="color:#999;font-size:12px">Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>
      </div>`;
      brevoSendEmail(email, `${code} — ton code de connexion TousLesMatchs`, html, { critical: true })
        .catch(e => console.error("[otp] envoi email:", e.message));
    }
    console.log(`[otp] code demandé pour ${email}`);
  } catch (e) {
    console.error("[otp] request-otp:", e.message);
  }
  res.json({ ok: true, message: "Si ce compte existe, un code vient d'être envoyé par email." });
});

app.post("/auth/verify-otp", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();
  if (!email || !code) return res.json({ ok: false, error: "Email et code requis" });

  try {
    const row = db.prepare(
      "SELECT * FROM otp_codes WHERE email = ? AND used = 0 ORDER BY id DESC LIMIT 1"
    ).get(email);
    // Meme message generique en cas d'echec, quelle qu'en soit la raison
    // (code inexistant, expire, deja utilise, ou mauvaise valeur) — evite de
    // laisser deviner si un email a un compte ou non.
    const genericError = "Code invalide ou expiré.";
    if (!row) return res.json({ ok: false, error: genericError });
    if (new Date(row.expires_at) < new Date()) return res.json({ ok: false, error: genericError });
    if (row.attempts >= OTP_MAX_ATTEMPTS) return res.json({ ok: false, error: "Trop de tentatives, redemande un code." });

    if (hashOtp(code) !== row.code_hash) {
      db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
      return res.json({ ok: false, error: genericError });
    }

    db.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?").run(row.id);

    // Une seule connexion active a la fois par compte (demande de Greg le
    // 03/08/2026, apres partage suspecte du code du frere) : toute nouvelle
    // connexion invalide immediatement les sessions precedentes de ce meme
    // email. Un appareil deja connecte se fait rejeter au prochain appel
    // authentifie (requireSession ne trouve plus son token).
    db.prepare("DELETE FROM sessions WHERE email = ?").run(email);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    db.prepare("INSERT INTO sessions (token, email, expires_at) VALUES (?,?,?)").run(token, email, expiresAt);

    // Plan actuel : source de verite = table codes, alimentee par le webhook
    // Stripe — le nouveau systeme de connexion ne cree ni ne devine aucun droit.
    const account = lookupAccountByEmail(email);

    console.log(`[otp] connexion réussie: ${email}`);
    brevoAddContact(email, (account?.plan || "free").toUpperCase(), "FR", null, {
      LAST_LOGIN_AT: new Date().toISOString(),
    }).catch(() => {});
    res.json({ ok: true, token, email, plan: account?.plan || "free" });
  } catch (e) {
    console.error("[otp] verify-otp:", e.message);
    res.json({ ok: false, error: "Erreur serveur" });
  }
});

function requireSession(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : String(req.query.session || req.body?.session || "");
  if (!token) return res.status(401).json({ ok: false, error: "Non connecté" });
  try {
    const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
    if (!row || new Date(row.expires_at) < new Date()) return res.status(401).json({ ok: false, error: "Session expirée" });
    db.prepare("UPDATE sessions SET last_seen_at = datetime('now') WHERE token = ?").run(token);
    req.session = { email: row.email, token };
    next();
  } catch (e) {
    res.status(401).json({ ok: false, error: "Session invalide" });
  }
}

app.post("/auth/logout", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : String(req.body?.session || "");
  if (token) {
    try { db.prepare("DELETE FROM sessions WHERE token = ?").run(token); } catch (e) { /* rien a faire */ }
  }
  res.json({ ok: true });
});

app.get("/auth/session", requireSession, (req, res) => {
  try {
    const account = lookupAccountByEmail(req.session.email);
    res.json({
      ok: true, email: req.session.email,
      plan: account?.plan || "free",
      expires_at: account?.expires_at || null,
      credits_max: account?.credits_max ?? null,
      credits_used: account?.credits_used ?? null,
      created_at: account?.created_at || null,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

// ── Phase 3 : vrai contenu du dashboard client ────────────────────────────────
app.get("/auth/dashboard-data", requireSession, (req, res) => {
  try {
    const email = req.session.email;
    const account = lookupFullAccountStatus(email);
    const isPaid = ["standard", "premium", "vip", "elite"].includes(account.plan) && account.status === "active";

    // Derniers resultats : uniquement si abonnement actif — jamais de bet/raison
    // envoye au navigateur pour un compte non autorise, meme masque visuellement
    // (regle explicite de Greg, Phase 3). Seuil de confiance identique a celui
    // qui declenche reellement un signal (getSignalFloor()), pas un seuil different
    // par palier — les paliers sont cumulatifs sur un socle commun.
    let recent = [];
    if (isPaid) {
      const rows = db.prepare(`
        SELECT home, away, competition, sport, best_bet, confidence, outcome,
               final_score_home, final_score_away, analysed_at
        FROM concile_analyses
        WHERE outcome IN ('win','loss') AND confidence >= ?
        ORDER BY analysed_at DESC LIMIT 10
      `).all(getSignalFloor());
      recent = dedupeAnalysesByMatch(rows).slice(0, 10).map(r => ({
        home: r.home, away: r.away, competition: r.competition, sport: r.sport,
        bet: r.best_bet, confidence: r.confidence, outcome: r.outcome,
        score: (r.final_score_home != null && r.final_score_away != null) ? `${r.final_score_home}-${r.final_score_away}` : null,
        analysed_at: r.analysed_at,
      }));
    }

    res.json({
      ok: true, email,
      plan: account.plan, status: account.status,
      expires_at: account.expires_at, created_at: account.created_at,
      credits_max: account.credits_max, credits_used: account.credits_used,
      recent,
    });
  } catch (e) {
    console.error("[dashboard-data]", e.message);
    res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

// Lien Telegram genere a la demande, uniquement pour un abonnement actif —
// jamais pre-genere ni expose a qui que ce soit d'autre.
app.get("/auth/telegram-link", requireSession, async (req, res) => {
  try {
    const account = lookupFullAccountStatus(req.session.email);
    const isPaid = ["standard", "premium", "vip", "elite"].includes(account.plan) && account.status === "active";
    if (!isPaid) return res.json({ ok: false, error: "Abonnement actif requis." });
    const link = await createPremiumInviteLink(req.session.email, account.plan);
    if (!link) return res.json({ ok: false, error: "Lien indisponible pour le moment, réessaie plus tard." });
    res.json({ ok: true, link });
  } catch (e) {
    console.error("[telegram-link]", e.message);
    res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

// Lien de parrainage (session OTP) — le systeme existait deja (/referral/get-link)
// mais exigeait l'ancien email+code reutilisable, incompatible avec le
// dashboard desormais 100% OTP/session (Phase 2/3). Demande de Greg le
// 01/08/2026 : rendre le parrainage visible, pas de nouveau systeme de recompense.
app.get("/auth/referral-link", requireSession, (req, res) => {
  try {
    const email = req.session.email;
    const refCode = getOrCreateRefCode(email);
    const link = `https://www.touslesmatchs.com/ref/${refCode}`;
    const data = loadReferrals();
    const ref = data.refs[refCode] || {};
    res.json({ ok: true, refCode, link, referrals: (ref.referrals || []).length, monthsEarned: ref.monthsEarned || 0 });
  } catch (e) {
    console.error("[referral-link]", e.message);
    res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

// Vrai portail de facturation Stripe (Phase 4, 01/08/2026) — remplace le
// mailto: placeholder du dashboard. L'utilisateur y gere/annule/change de
// carte lui-meme, cote Stripe, sans qu'on ait a manipuler quoi que ce soit.
app.post("/auth/billing-portal", requireSession, async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) return res.json({ ok: false, error: "Configuration Stripe manquante" });
    const cdb = new Database(CODES_DB_PATH, { readonly: true });
    const row = cdb.prepare("SELECT stripe_customer_id FROM codes WHERE email = ? AND stripe_customer_id IS NOT NULL ORDER BY rowid DESC LIMIT 1").get(req.session.email);
    cdb.close();
    if (!row || !row.stripe_customer_id) {
      return res.json({ ok: false, error: "Aucun abonnement Stripe trouve pour ce compte. Contacte-nous si tu penses que c'est une erreur." });
    }
    const Stripe5 = require("stripe");
    const stripe5 = Stripe5(STRIPE_SECRET_KEY);
    const portalSession = await stripe5.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: "https://touslesmatchs.com/dashboard",
    });
    res.json({ ok: true, url: portalSession.url });
  } catch (e) {
    console.error("[billing-portal]", e.message);
    res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.post("/verify-code", (req, res) => {
  const { email, code, login } = req.body || {};
  if (!email || !code) return res.json({ valid: false, error: "Email et code requis" });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const row = codesDb.prepare(
      "SELECT * FROM codes WHERE code = ? AND email = ? AND active = 1"
    ).get(code.toUpperCase().trim(), email.toLowerCase().trim());
    codesDb.close();

    if (!row) return res.json({ valid: false, error: "Code ou email invalide" });

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.json({ valid: false, error: "Code expiré" });
    }

    const credits_left = creditsLeftForPlan(row.plan, row.credits_max, row.credits_used, row.credits_date);

    // Une seule connexion active a la fois (demande de Greg le 03/08/2026) :
    // une VRAIE connexion (login:true, envoye uniquement par le formulaire
    // "Acceder", jamais par les appels de simple rafraichissement de credits
    // comme refreshCredits()) genere un nouveau jeton de session et l'ecrit
    // en base, invalidant immediatement celui de tout autre appareil deja
    // connecte avec le meme code. Sans ce flag, /verify-code garde son
    // comportement d'origine (aucune rotation) pour ne pas deconnecter les
    // gens tout seuls a chaque rafraichissement automatique.
    let sessionToken = null;
    if (login === true) {
      sessionToken = crypto.randomBytes(24).toString("hex");
      try {
        const codesDbw = new Database(CODES_DB_PATH);
        codesDbw.prepare("UPDATE codes SET session_token = ? WHERE code = ? AND email = ?")
          .run(sessionToken, row.code, row.email);
        codesDbw.close();
      } catch (e) { console.error("[verify-code] session_token:", e.message); }
      // Un session_token deja present avant cette connexion = quelqu'un etait
      // deja connecte avec ce meme code -- vraie preuve de partage, pas juste
      // une reconnexion normale (premiere connexion = session_token NULL).
      if (row.session_token) {
        try {
          db.prepare("INSERT INTO session_kicks (email, code) VALUES (?, ?)").run(row.email, row.code);
          console.log(`[session-kick] connexion concurrente detectee: ${row.email} (${row.code})`);
        } catch (e) { console.error("[session-kick] log:", e.message); }
        // Rappel automatique a chaque partage detecte (pas juste le premier) —
        // demande de Greg le 03/08/2026 : prevenir le titulaire du compte que
        // le partage est interdit, sous risque de bannissement.
        if (BREVO_API_KEY) {
          brevoSendEmail(
            row.email,
            "⚠️ Connexion partagée détectée sur ton compte TousLesMatchs",
            `<p>Bonjour,</p>
             <p>Nous avons détecté une nouvelle connexion à ton compte alors qu'une session était déjà active ailleurs.</p>
             <p><strong>Le partage d'identifiants (email + code) entre plusieurs personnes n'est pas autorisé</strong> — chaque abonnement est prévu pour un seul utilisateur.</p>
             <p>Si ce n'était pas toi, connecte-toi et vérifie ton compte. Si tu partages ton accès, merci d'y mettre fin : en cas de récidive, le compte pourra être suspendu sans préavis.</p>
             <p>— L'équipe TousLesMatchs</p>`,
            { critical: true }
          ).catch(e => console.error("[session-kick] email:", e.message));
        }
      }
    }

    // Sync with Brevo asynchronously (don't block the response)
    const tag = row.plan === "free" ? "FREE" : row.plan === "premium" ? "PREMIUM" : row.plan === "elite" ? "ELITE" : "VIP";
    brevoAddContact(row.email, tag, "FR", null, { LAST_LOGIN_AT: new Date().toISOString() }).catch(() => {});

    return res.json({ valid: true, plan: row.plan, credits_left, credits_max: row.credits_max, email: row.email, session_token: sessionToken });
  } catch (e) {
    console.error("[verify-code] error:", e.message);
    return res.json({ valid: false, error: "Erreur de vérification" });
  }
});

// Heartbeat de session unique : une page connectee interroge ceci
// periodiquement (voir widgets.js). Si le jeton ne correspond plus (un autre
// appareil s'est connecte avec le meme code entre-temps), on renvoie
// active:false et le client se deconnecte de lui-meme.
app.get("/session-check", (req, res) => {
  const { email, code } = req.query || {};
  const session = req.query?.session || "";
  if (!email || !code) return res.json({ active: false });
  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const row = codesDb.prepare(
      "SELECT session_token FROM codes WHERE code = ? AND email = ? AND active = 1"
    ).get(String(code).toUpperCase().trim(), String(email).toLowerCase().trim());
    codesDb.close();
    if (!row) return res.json({ active: false });
    // Aucun jeton attribue a ce code depuis le lancement de cette fonctionnalite
    // (session_token NULL en base) : rien a comparer, ne pas deconnecter une
    // connexion legitime qui n'a simplement pas encore ete rafraichie.
    if (!row.session_token) return res.json({ active: true });
    // Un jeton existe en base mais le navigateur n'en a aucun localement
    // (connexion faite AVANT ce correctif) : perimee par definition.
    if (!session) return res.json({ active: false });
    return res.json({ active: row.session_token === session });
  } catch (e) {
    console.error("[session-check] error:", e.message);
    return res.json({ active: true }); // panne serveur : ne pas deconnecter tout le monde par erreur
  }
});

// Liste des comptes qui partagent leur code (connexions concurrentes
// detectees) -- pour reperer qui contacter avant risque de bannissement.
// Demande de Greg le 03/08/2026.
app.get("/admin/shared-accounts", (req, res) => {
  const { email, code } = req.query || {};
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  try {
    const jours = Math.min(90, Math.max(1, parseInt(req.query.jours) || 30));
    const rows = db.prepare(`
      SELECT email, code, COUNT(*) AS nb_detections, MAX(kicked_at) AS derniere_detection, MIN(kicked_at) AS premiere_detection
      FROM session_kicks
      WHERE kicked_at >= datetime('now', ?)
      GROUP BY email, code
      ORDER BY nb_detections DESC
    `).all(`-${jours} days`);
    res.json({ ok: true, fenetre_jours: jours, comptes: rows });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ── Connexion biométrique (WebAuthn — Face ID / empreinte digitale) ───────────
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require("@simplewebauthn/server");
const WEBAUTHN_RP_NAME = "TousLesMatchs";
const WEBAUTHN_RP_ID = "touslesmatchs.com";
const WEBAUTHN_ORIGINS = ["https://touslesmatchs.com", "https://www.touslesmatchs.com"];
const webauthnChallenges = new Map(); // email -> { challenge, expires }
function putWebauthnChallenge(email, challenge) {
  webauthnChallenges.set(email, { challenge, expires: Date.now() + 5 * 60000 });
}
function takeWebauthnChallenge(email) {
  const row = webauthnChallenges.get(email);
  webauthnChallenges.delete(email);
  if (!row || row.expires < Date.now()) return null;
  return row.challenge;
}

app.post("/webauthn/register-options", async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ ok: false, error: "Email et code requis" });
  const auth = verifyCode(email, code);
  if (!auth.valid) return res.status(403).json({ ok: false, error: "Code invalide" });
  const cleanEmail = email.toLowerCase().trim();
  try {
    const options = await generateRegistrationOptions({
      rpName: WEBAUTHN_RP_NAME,
      rpID: WEBAUTHN_RP_ID,
      userName: cleanEmail,
      attestationType: "none",
      // residentKey:"discouraged" — sur Android/Chrome, "preferred"/"required"
      // route la creation vers le Credential Manager de Google (passkeys),
      // qui echoue frequemment avec "An unknown error occurred while talking
      // to the credential manager" (constate le 01/08/2026, Samsung/Chrome).
      // On connait deja l'email au moment du login donc on n'a pas besoin
      // d'un credential decouvrable — "discouraged" evite ce chemin bugue.
      authenticatorSelection: { residentKey: "discouraged", userVerification: "preferred", authenticatorAttachment: "platform" },
    });
    putWebauthnChallenge(cleanEmail, options.challenge);
    res.json({ ok: true, options });
  } catch (e) {
    console.error("[webauthn/register-options]", e.message);
    res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.post("/webauthn/register-verify", async (req, res) => {
  const { email, code, credential, deviceLabel } = req.body || {};
  if (!email || !code || !credential) return res.status(400).json({ ok: false, error: "Requête incomplète" });
  const auth = verifyCode(email, code);
  if (!auth.valid) return res.status(403).json({ ok: false, error: "Code invalide" });
  const cleanEmail = email.toLowerCase().trim();
  const expectedChallenge = takeWebauthnChallenge(cleanEmail);
  if (!expectedChallenge) return res.status(400).json({ ok: false, error: "Challenge expiré, réessaie." });
  try {
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: WEBAUTHN_ORIGINS,
      expectedRPID: WEBAUTHN_RP_ID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ ok: false, error: "Vérification échouée" });
    }
    const { credential: regCred } = verification.registrationInfo;
    db.prepare(
      "INSERT OR REPLACE INTO webauthn_credentials (id, email, code, public_key, counter, device_label) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(regCred.id, cleanEmail, code.toUpperCase().trim(), Buffer.from(regCred.publicKey).toString("base64"), regCred.counter, deviceLabel || null);
    res.json({ ok: true });
  } catch (e) {
    console.error("[webauthn/register-verify]", e.message);
    res.status(400).json({ ok: false, error: "Vérification échouée" });
  }
});

app.post("/webauthn/login-options", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: "Email requis" });
  const cleanEmail = email.toLowerCase().trim();
  const creds = db.prepare("SELECT id FROM webauthn_credentials WHERE email = ?").all(cleanEmail);
  if (!creds.length) return res.status(404).json({ ok: false, error: "Aucun appareil enregistré pour cet email" });
  try {
    const options = await generateAuthenticationOptions({
      rpID: WEBAUTHN_RP_ID,
      userVerification: "preferred",
      allowCredentials: creds.map(c => ({ id: c.id })),
    });
    putWebauthnChallenge(cleanEmail, options.challenge);
    res.json({ ok: true, options });
  } catch (e) {
    console.error("[webauthn/login-options]", e.message);
    res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.post("/webauthn/login-verify", async (req, res) => {
  const { email, credential } = req.body || {};
  if (!email || !credential) return res.status(400).json({ ok: false, error: "Requête incomplète" });
  const cleanEmail = email.toLowerCase().trim();
  const expectedChallenge = takeWebauthnChallenge(cleanEmail);
  if (!expectedChallenge) return res.status(400).json({ ok: false, error: "Challenge expiré, réessaie." });
  const stored = db.prepare("SELECT * FROM webauthn_credentials WHERE id = ? AND email = ?").get(credential.id, cleanEmail);
  if (!stored) return res.status(404).json({ ok: false, error: "Appareil non reconnu" });
  try {
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: WEBAUTHN_ORIGINS,
      expectedRPID: WEBAUTHN_RP_ID,
      credential: { id: stored.id, publicKey: Buffer.from(stored.public_key, "base64"), counter: stored.counter },
    });
    if (!verification.verified) return res.status(400).json({ ok: false, error: "Vérification échouée" });
    db.prepare("UPDATE webauthn_credentials SET counter = ?, last_used_at = datetime('now') WHERE id = ?")
      .run(verification.authenticationInfo.newCounter, stored.id);
    // Le code stocke sur l'empreinte est celui du jour de l'ENREGISTREMENT du
    // doigt, pas forcement celui d'aujourd'hui : un renouvellement/changement
    // de palier genere un nouveau code actif et desactive l'ancien, ce qui
    // rejetait alors la connexion biometrique meme si l'abonnement est bien
    // valide (constate le 04/08/2026 — argent.conscient@proton.me bloque avec
    // son doigt apres renouvellement, faux "abonnement expire"). On revalide
    // donc sur le code ACTIF actuel de cet email, pas sur celui fige au doigt.
    let currentCode = stored.code;
    try {
      const cdb = new Database(CODES_DB_PATH, { readonly: true });
      const row = cdb.prepare("SELECT code FROM codes WHERE email = ? AND active = 1 ORDER BY rowid DESC LIMIT 1").get(stored.email);
      cdb.close();
      if (row?.code) currentCode = row.code;
    } catch (_) {}
    const auth = verifyCode(stored.email, currentCode);
    if (!auth.valid) return res.status(403).json({ ok: false, error: "Abonnement expiré, reconnecte-toi avec ton code." });
    if (currentCode !== stored.code) {
      try { db.prepare("UPDATE webauthn_credentials SET code = ? WHERE id = ?").run(currentCode, stored.id); } catch (_) {}
    }
    res.json({ ok: true, email: stored.email, code: currentCode, plan: auth.plan });
  } catch (e) {
    console.error("[webauthn/login-verify]", e.message);
    res.status(400).json({ ok: false, error: "Vérification échouée" });
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.json({ ok: false, error: "Email et mot de passe requis" });
  if (password.length < 6) return res.json({ ok: false, error: "Mot de passe trop court (6 caractères min)" });

  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (email, password_hash, status) VALUES (?, ?, 'free')");
    const result = stmt.run(email.toLowerCase().trim(), hash);
    const userId = result.lastInsertRowid;
    const token = jwt.sign({ id: userId, email, status: "free" }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ ok: true, token, user: { id: userId, email, status: "free" } });
  } catch (e) {
    if (e.message?.includes("UNIQUE")) return res.json({ ok: false, error: "Email déjà utilisé" });
    console.error(e);
    res.json({ ok: false, error: "Erreur serveur" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.json({ ok: false, error: "Email et mot de passe requis" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user) return res.json({ ok: false, error: "Email ou mot de passe incorrect" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.json({ ok: false, error: "Email ou mot de passe incorrect" });

  const token = jwt.sign({ id: user.id, email: user.email, status: user.status }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ ok: true, token, user: { id: user.id, email: user.email, status: user.status } });
});

// ── User tokens ───────────────────────────────────────────────────────────────
app.get("/user/tokens", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT status FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.json({ ok: false, error: "Utilisateur introuvable" });

  const row = ensureTokenRow(req.user.id);
  const limit = TOKEN_LIMITS[user.status] || 0;

  res.json({
    ok: true,
    tokens: row.tokens_today,
    limit,
    status: user.status,
    reset_at: "minuit",
  });
});

// ── Auth: profil utilisateur ──────────────────────────────────────────────────
app.get("/auth/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT id, email, status, created_at FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.json({ ok: false, error: "Utilisateur introuvable" });
  const row = ensureTokenRow(user.id);
  const limit = TOKEN_LIMITS[user.status] || 0;
  res.json({ ok: true, user: { id: user.id, email: user.email, status: user.status, created_at: user.created_at, tokens_today: row.tokens_today, tokens_limit: limit } });
});

// ── User: historique personnel des analyses revealees ─────────────────────────
app.get("/user/history", authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const rows = db.prepare(`
      SELECT ra.match_key, ra.analysis_json, ra.revealed_at
      FROM revealed_analyses ra
      WHERE ra.user_id = ?
      ORDER BY ra.revealed_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, limit, offset);
    const total = db.prepare("SELECT COUNT(*) AS cnt FROM revealed_analyses WHERE user_id = ?").get(req.user.id)?.cnt || 0;
    const analyses = rows.map(r => {
      let data = {};
      try { data = JSON.parse(r.analysis_json || "{}"); } catch {}
      return { match_key: r.match_key, revealed_at: r.revealed_at, ...sanitizeAnalysisForClient(data) };
    });
    res.json({ ok: true, analyses, total });
  } catch (e) {
    console.error("[user/history]", e.message);
    res.json({ ok: true, analyses: [], total: 0 });
  }
});

// ── Gestion de capital — bankroll de l'utilisateur (login par email + code) ───
// Vérifie que le couple email/code est un abonné actif de codes.db.
function bankrollAuth(email, code) {
  if (!email || !code) return null;
  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const row = codesDb.prepare(
      "SELECT email, plan, expires_at FROM codes WHERE code = ? AND email = ? AND active = 1"
    ).get(String(code).toUpperCase().trim(), String(email).toLowerCase().trim());
    codesDb.close();
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
    return row;
  } catch (e) {
    console.error("[bankroll] auth:", e.message);
    return null;
  }
}

// Récupère la bankroll enregistrée de l'utilisateur.
app.post("/bankroll/get", (req, res) => {
  const { email, code } = req.body || {};
  const auth = bankrollAuth(email, code);
  if (!auth) return res.json({ ok: false, error: "Non authentifié" });
  const row = db.prepare("SELECT amount FROM user_bankroll WHERE email = ?").get(auth.email);
  res.json({ ok: true, bankroll: row ? row.amount : null });
});

// Enregistre/modifie la bankroll (montant en euros, 0–1 000 000).
app.post("/bankroll/set", (req, res) => {
  const { email, code, bankroll } = req.body || {};
  const auth = bankrollAuth(email, code);
  if (!auth) return res.json({ ok: false, error: "Non authentifié" });
  const raw = Number(bankroll);
  if (!Number.isFinite(raw) || raw < 0 || raw > 1000000) {
    return res.json({ ok: false, error: "Montant invalide" });
  }
  const amount = Math.round(raw * 100) / 100;
  db.prepare(`
    INSERT INTO user_bankroll (email, amount, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(email) DO UPDATE SET amount = excluded.amount, updated_at = datetime('now')
  `).run(auth.email, amount);
  res.json({ ok: true, bankroll: amount });
});

// Calcule l'historique + les totaux (gains/pertes) d'un utilisateur.
function bankrollHistory(email) {
  const bets = db.prepare(
    "SELECT id, label, stake, odds, result, profit, created_at FROM user_bets WHERE email = ? ORDER BY id DESC LIMIT 200"
  ).all(email);
  let gagne = 0, perdu = 0, wins = 0;
  for (const b of bets) {
    if (b.profit >= 0) { gagne += b.profit; if (b.result === "win") wins++; }
    else perdu += -b.profit;
  }
  const total = bets.length;
  return {
    bets,
    totals: {
      count: total,
      wins,
      winrate: total ? Math.round(wins / total * 100) : 0,
      gagne: Math.round(gagne * 100) / 100,
      perdu: Math.round(perdu * 100) / 100,
      solde: Math.round((gagne - perdu) * 100) / 100,
    },
  };
}

// Liste l'historique de mises + totaux de l'utilisateur.
app.post("/bankroll/bets/list", (req, res) => {
  const { email, code } = req.body || {};
  const auth = bankrollAuth(email, code);
  if (!auth) return res.json({ ok: false, error: "Non authentifié" });
  res.json({ ok: true, ...bankrollHistory(auth.email) });
});

// Ajoute une mise au suivi personnel (et pousse l'email vers Brevo).
app.post("/bankroll/bets/add", (req, res) => {
  const { email, code, label, stake, odds, result } = req.body || {};
  const auth = bankrollAuth(email, code);
  if (!auth) return res.json({ ok: false, error: "Non authentifié" });
  const s = Number(stake), o = Number(odds);
  const lbl = String(label || "").trim().slice(0, 80);
  if (!lbl) return res.json({ ok: false, error: "Libellé requis" });
  if (!Number.isFinite(s) || s <= 0 || s > 1000000) return res.json({ ok: false, error: "Mise invalide" });
  if (!Number.isFinite(o) || o < 1 || o > 1000) return res.json({ ok: false, error: "Cote invalide" });
  if (result !== "win" && result !== "loss") return res.json({ ok: false, error: "Résultat invalide" });
  const profit = result === "win"
    ? Math.round(s * (o - 1) * 100) / 100
    : Math.round(-s * 100) / 100;
  db.prepare(
    "INSERT INTO user_bets (email, label, stake, odds, result, profit) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(auth.email, lbl, Math.round(s * 100) / 100, Math.round(o * 100) / 100, result, profit);
  // Nurturing : s'assurer que l'email est bien dans Brevo
  const tag = auth.plan === "free" ? "FREE" : auth.plan === "premium" ? "PREMIUM" : auth.plan === "elite" ? "ELITE" : "VIP";
  brevoAddContact(auth.email, tag).catch(() => {});
  res.json({ ok: true, ...bankrollHistory(auth.email) });
});

// Supprime une mise du suivi.
app.post("/bankroll/bets/delete", (req, res) => {
  const { email, code, id } = req.body || {};
  const auth = bankrollAuth(email, code);
  if (!auth) return res.json({ ok: false, error: "Non authentifié" });
  db.prepare("DELETE FROM user_bets WHERE id = ? AND email = ?").run(Number(id), auth.email);
  res.json({ ok: true, ...bankrollHistory(auth.email) });
});

// ── Chatbot Mistral — mémoire isolée par utilisateur ─────────────────────────
const CHAT_UNAVAILABLE = "Notre assistant est momentanément indisponible. Réessaie dans un instant, ou écris-nous sur Telegram.";
const CHAT_SYSTEM_PROMPT = `Tu es l'assistant virtuel de TousLesMatchs.com, un service d'analyses sportives par IA appelé le "Concile". Réponds en français, brièvement, clairement et avec le sourire.
Tu aides sur : le fonctionnement du site, les analyses du Conseil IA, les formules (Standard 4,90 €/mois, Premium 14,90 €/mois, Elite-VIP 29,90 €/mois ; l'analyse du jour est gratuite sur le site avec son résultat vérifiable le lendemain), le canal Telegram, la page Live IA, la page Résultats, la gestion de capital.
RÈGLES STRICTES :
- N'emploie JAMAIS le mot "pari" ni "parier" : dis "analyse", "sélection" ou "pick".
- Ne garantis JAMAIS de gains ; rappelle que rien n'est certain et que le service est réservé aux 18 ans et plus.
- Ne donne pas d'analyse précise gratuitement : invite poliment à s'abonner pour y accéder.
- Si tu ne sais pas, dis-le simplement et oriente vers le support Telegram.`;

app.post("/chat", async (req, res) => {
  const { email, code, message } = req.body || {};
  const msg = String(message || "").trim().slice(0, 1000);
  if (!msg) return res.json({ ok: false, error: "Message vide" });

  // Utilisateur connecté (email+code valides) → mémoire persistante ISOLÉE.
  const auth = (email && code) ? bankrollAuth(email, code) : null;
  const memKey = auth ? auth.email : null;

  if (!PERPLEXITY_API_KEY && !MISTRAL_API_KEY) {
    console.error("[chat] aucune cle fournisseur configuree");
    return res.json({ ok: true, reply: CHAT_UNAVAILABLE, fallback: true });
  }

  // Historique de CET utilisateur uniquement (jamais celui d'un autre).
  let history = [];
  if (memKey) {
    try {
      history = db.prepare("SELECT role, content FROM chat_messages WHERE email = ? ORDER BY id DESC LIMIT 10").all(memKey).reverse();
    } catch (_) {}
  }

  const messages = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    ...history.map(h => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: msg },
  ];

  // Traçabilité + plafond de dépense obligatoires pour tout appel IA (règle
  // finale du prompt maître du 28/07/2026). L'anti-doublon ne s'applique pas à
  // une conversation libre : voir allowChatbotCall (clé unique par requête).
  const _chatGate = analysisEngine.allowChatbotCall(db, { sessionId: memKey });
  if (!_chatGate.allowed) {
    console.warn(`[chat] garde budget: ${_chatGate.reason || "appel refuse"}`);
    return res.json({ ok: true, reply: CHAT_UNAVAILABLE, fallback: true });
  }

  // Perplexity (modele "sonar", pas "sonar-pro" — recherche web reelle pour
  // un cout par appel bien plus bas, largement suffisant pour un chat grand
  // public) prioritaire : contrairement a Mistral, il consulte le web avant
  // de repondre, donc il connait les evenements recents (ex: un resultat
  // sportif de cette annee) au lieu de rester bloque a sa date d'entrainement.
  // Repli sur Mistral si Perplexity n'est pas configure OU si son appel echoue
  // (401/429/timeout/reponse vide). Avant ce correctif, httpPost renvoyait un
  // objet marque _httpStatus au lieu de lever une exception : le chatbot
  // affichait donc son erreur generique sans journal ni tentative Mistral.
  let reply = "";
  let chatTokensIn = 0, chatTokensOut = 0;
  const providers = [];
  if (PERPLEXITY_API_KEY) providers.push({
    label: "Perplexity", url: "https://api.perplexity.ai/chat/completions",
    model: "sonar", key: PERPLEXITY_API_KEY,
  });
  if (MISTRAL_API_KEY) providers.push({
    label: "Mistral", url: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-small-latest", key: MISTRAL_API_KEY,
  });

  for (const provider of providers) {
    try {
      const rp = await httpPost(
        provider.url,
        { model: provider.model, messages, temperature: 0.4, max_tokens: 500 },
        { Authorization: `Bearer ${provider.key}` },
        10000
      );
      if (rp?._httpTimedOut) throw new Error("timeout");
      if (Number(rp?._httpStatus || 0) >= 400) {
        const detail = rp?.error?.message || rp?.message || `HTTP ${rp._httpStatus}`;
        throw new Error(`HTTP ${rp._httpStatus}: ${String(detail).slice(0, 160)}`);
      }
      if (rp?._httpParseError) throw new Error("reponse illisible");
      const candidate = rp?.choices?.[0]?.message?.content?.trim() || "";
      if (!candidate) throw new Error("reponse vide");
      reply = candidate;
      chatTokensIn = Number(rp?.usage?.prompt_tokens || 0);
      chatTokensOut = Number(rp?.usage?.completion_tokens || 0);
      console.log(`[chat] ${provider.label}: OK`);
      break;
    } catch (e) {
      const safeError = String(e.message || e)
        .replace(/(xkeysib-|sk-proj-|pplx-)[A-Za-z0-9_-]+/gi, "$1***MASQUE***")
        .slice(0, 220);
      console.error(`[chat] ${provider.label}: ${safeError}`);
    }
  }
  _chatGate.record(chatTokensIn, chatTokensOut, reply ? "ok" : "error");

  if (!reply) return res.json({ ok: true, reply: CHAT_UNAVAILABLE, fallback: true });

  // Sauvegarde pour CET utilisateur seulement.
  if (memKey) {
    try {
      const ins = db.prepare("INSERT INTO chat_messages (email, role, content) VALUES (?,?,?)");
      ins.run(memKey, "user", msg);
      ins.run(memKey, "assistant", reply);
      db.prepare(`DELETE FROM chat_messages WHERE email = ? AND id NOT IN (
        SELECT id FROM chat_messages WHERE email = ? ORDER BY id DESC LIMIT 40)`).run(memKey, memKey);
    } catch (e) { console.error("[chat] save:", e.message); }
  }

  res.json({ ok: true, reply, memory: !!memKey });
});

// Réaffiche la conversation de l'utilisateur à l'ouverture du chat.
app.post("/chat/history", (req, res) => {
  const { email, code } = req.body || {};
  const auth = (email && code) ? bankrollAuth(email, code) : null;
  if (!auth) return res.json({ ok: true, messages: [] });
  try {
    const rows = db.prepare("SELECT role, content FROM chat_messages WHERE email = ? ORDER BY id DESC LIMIT 20").all(auth.email).reverse();
    res.json({ ok: true, messages: rows });
  } catch (_) { res.json({ ok: true, messages: [] }); }
});

// ── Pick du jour auto — l'API choisit le meilleur pick frais (hors ligues exclues) ──
// Le Concile Python ne peut pas écrire /picks/picks.json (pas de volume partagé),
// donc l'API régénère elle-même le pick du jour depuis ses analyses. Ainsi le match
// du jour se met à jour tout seul chaque jour, sans jamais afficher une ligue exclue.
// Vrais noms des 5 agents officiels dans un texte public (version réutilisable,
// meme regle que maskAiNames plus haut dans runConcileAnalysis : jamais "Chief",
// fallbacks internes restent generiques).
function maskAiNamesGlobal(text) {
  if (!text) return "";
  const map = [
    [/Perplexity[- ]?Web/gi, "Perplexity"], [/DeepSeek[- ]?V3/gi, "DeepSeek"],
    [/Mistral[- ]?Large/gi, "Mistral"], [/Cohere[- ]?Command/gi, "Cohere"],
    [/OpenRouter[- ]?Qwen/gi, "Qwen"],
    [/Claude[- ]?Chief/gi, "Concile"],
    [/GPT[- ]?4o?[- ]?mini/gi, "IA"], [/GPT[- ]?Analysis/gi, "IA"],
    [/GeminiFlash/gi, "IA"], [/Mistral[- ]?Small/gi, "IA"],
    [/Mistral[- ]?7B/gi, "IA"], [/Cerebras[- ]?Llama/gi, "IA"],
    [/OR[- ]?Mistral7B/gi, "IA"], [/Groq[- ]?Llama\d*/gi, "IA"],
    [/Llama[- ]?\d+[bB]?/gi, "IA"], [/Gemini/gi, "IA"],
  ];
  let r = text;
  for (const [re, rep] of map) r = r.replace(re, rep);
  return r;
}

function refreshDailyPickFromDB() {
  try {
    const _db = new Database(DB_PATH, { readonly: true });
    const rows = _db.prepare(
      "SELECT match_key, home, away, competition, country, sport, best_bet, confidence, consensus_votes, real_odd, real_odd_source, cote_suggested, raison, home_logo, away_logo, outcome, analysed_at, minute_at_analysis, home_form, away_form, home_goals_avg, away_goals_avg, final_score_home, final_score_away, sig_sent_standard, sig_sent_premium, sig_sent_elite, sig_sent_free, diffusion_block " +
      "FROM concile_analyses WHERE analysed_at >= datetime('now','-7 days') AND confidence IS NOT NULL AND home IS NOT NULL " +
      "ORDER BY confidence DESC, id DESC LIMIT 300"
    ).all();
    _db.close();
    const todayISO = new Date().toISOString().slice(0, 10);
    // R1 (décision fondateur 28/07/2026) : la sélection se fait sur la cote réelle
    // ARJEL, plus sur la minute — l'ancienne fenêtre 25-65' est supprimée ici aussi
    // pour rester cohérente avec le reste du pipeline (voir AUTO_CONCILE_TIME_WINDOW).
    // confidence >= getPublishedMinConfidence() (seuil Elite, le plus permissif) :
    // sans ce filtre, le pick gratuit affiché en vitrine sur l'accueil pouvait
    // etre plus faible que TOUT ce qui part reellement sur Telegram (constate
    // le 30/07/2026 : pick a 77% affiche alors que le seuil minimum de
    // diffusion, meme Elite, est 82% — impression trompeuse d'un signal
    // "trouve" mais jamais envoye, alors qu'il n'a jamais ete assez solide).
    // Pick du jour restreint à 4 marchés simples à comprendre pour un visiteur
    // non-initié (demande de Greg le 31/07/2026) : Victoire domicile/extérieur,
    // BTTS, Under 2.5 buts. Exclut "Match nul", "Over 2.5", double chance...
    // qui n'ont pas leur place en vitrine grand public. Élimine aussi de facto
    // les sports non-football (basket/hockey n'ont pas ces marchés), ce qui
    // règle par la même occasion le cas des données live corrompues côté
    // basket (voir le correctif du 31/07/2026 sur Toronto Tempo/Minnesota Lynx).
    const eligible = rows.filter(r => r.home && r.away && !isExcludedFromPicks(r)
      && Number(r.confidence) >= getPublishedMinConfidence()
      && (r.analysed_at || "").slice(0, 10) === todayISO
      && isVerifiedClientOu25Row(r));
    if (!eligible.length) { console.log("[daily-pick] aucun pick eligible sur 7j (hors blacklist, seuil " + getPublishedMinConfidence() + "%, marches autorises) — pick inchangé"); return false; }
    // Priorité 1 : un match d'AUJOURD'HUI déjà RESOLU (score final réellement
    //   confirmé par nos sources — c'est la seule garantie qu'on affiche un
    //   match qui existe vraiment et pas un doublon/donnée corrompue).
    // Priorité 2 : sinon, le meilleur résolu récent (7j, vitrine).
    // Priorité 3 : sinon, en dernier recours, un match du jour RECEMMENT non
    //   résolu (vraiment en cours) — seul cas où on prend un risque, faute
    //   d'alternative vérifiée.
    // Priorité 4 : sinon, le plus confiant du jour quel que soit son état.
    //
    // Avant, un match non résolu l'emportait TOUJOURS sur un match résolu.
    // Deux bugs distincts constatés le 31/07/2026 à cause de ça :
    //  (a) "Toronto Tempo vs Minnesota Lynx" (WNBA, données corrompues -
    //      score 72-104 a la 10e minute, impossible en basket) restait
    //      affiché toute la journée sans jamais se résoudre ;
    //  (b) le MEME match réel analysé deux fois par deux sources différentes
    //      sous deux orthographes ("Valerenga/Ham-Kam" côté api-sports, déjà
    //      gagné, VS "Vålerenga/Hamarkameratene" côté TheSportsDB, jamais
    //      résolu) — la version non résolue et non vérifiable l'emportait
    //      sur la version déjà confirmée gagnante du MEME match.
    // On inverse donc la priorité : la fiabilité prime sur la fraîcheur.
    const RECENT_UNRESOLVED_MS = 4 * 3600000; // 4h : au-delà, on considère le match abandonné/corrompu, pas "en cours"
    const analysedAtMs = (r) => {
      const t = new Date(String(r.analysed_at || "").replace(" ", "T") + "Z").getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const todays = eligible.filter(r => (r.analysed_at || "").slice(0, 10) === todayISO);
    // Priorité 2 triée par RÉCENCE (pas confiance) : sinon un vieux pick à
    // 85% gagné il y a 6 jours reste éternellement champion face à des picks
    // d'aujourd'hui à 80-84% pas encore résolus (match en cours) — constaté
    // le 04/08/2026, le pick du jour restait bloqué sur un match du 30/07.
    const byRecency = eligible.slice().sort((a, b) => analysedAtMs(b) - analysedAtMs(a));
    let pick = todays.find(r => r.outcome === "win" || r.outcome === "loss")
            || byRecency.find(r => r.outcome === "win")
            || todays.find(r => r.outcome === null && (Date.now() - analysedAtMs(r)) < RECENT_UNRESOLVED_MS)
            || todays[0]
            || eligible[0];
    if (!pick) { console.log("[daily-pick] aucun pick eligible"); return false; }
    const matchDate = (pick.analysed_at || "").slice(0, 10) || todayISO;
    const coteVal = rowOdd(pick);
    const data = {
      currentPick: {
        home: pick.home, away: pick.away,
        competition: pick.competition || pick.sport || "Football",
        sport: pick.sport || "Football",
        date: matchDate, time: "",
        best_bet: pick.best_bet || "Analyse IA", confidence: pick.confidence,
        cote: Number(coteVal.toFixed(2)),
        bookmaker: (pick.real_odd_source && !/estimation/i.test(String(pick.real_odd_source))) ? String(pick.real_odd_source) : null,
        raison: maskAiNamesGlobal(pick.raison || ""),
        home_logo: pick.home_logo || null, away_logo: pick.away_logo || null,
        home_form: pick.home_form || null, away_form: pick.away_form || null,
        home_goals_avg: pick.home_goals_avg != null ? pick.home_goals_avg : null,
        away_goals_avg: pick.away_goals_avg != null ? pick.away_goals_avg : null,
        // Heure du match en UTC explicite (SQLite stocke analysed_at en UTC
        // sans suffixe) : le navigateur du visiteur la reconvertit ensuite
        // dans SON fuseau local via toLocaleTimeString(), peu importe le
        // pays de connexion. Demande de Greg le 31/07/2026.
        matchTime: pick.analysed_at ? String(pick.analysed_at).replace(" ", "T") + "Z" : null,
        source: "auto-api", publishedAt: new Date().toISOString(),
        // Score et statut reels du match : permettent d'afficher le resultat
        // (score final + gagne/perdu) des que le match est termine, sans
        // attendre le prochain changement de jour. Mis a jour par le meme
        // refresh horaire (voir setInterval refreshDailyPickFromDB, 1h).
        status: pick.outcome === "win" ? "win" : pick.outcome === "loss" ? "loss" : "upcoming",
        score: (pick.final_score_home != null && pick.final_score_away != null)
          ? `${pick.final_score_home}-${pick.final_score_away}` : null,
      }
    };
    try { fs.writeFileSync(HERMES_PICKS_PATH, JSON.stringify(data, null, 2)); }
    catch (e) { console.error("[daily-pick] ecriture:", e.message); return false; }
    // Historique persistant — une ligne par jour, mise a jour (pas dupliquee)
    // tant que la date ne change pas, meme si le pick change plusieurs fois
    // dans la journee ou se resout entre deux passages.
    try {
      db.prepare(`
        INSERT INTO daily_pick_log (date, home, away, competition, sport, bet, confidence, cote, outcome, final_score_home, final_score_away, home_logo, away_logo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          home=excluded.home, away=excluded.away, competition=excluded.competition, sport=excluded.sport,
          bet=excluded.bet, confidence=excluded.confidence, cote=excluded.cote, outcome=excluded.outcome,
          final_score_home=excluded.final_score_home, final_score_away=excluded.final_score_away,
          home_logo=excluded.home_logo, away_logo=excluded.away_logo
      `).run(
        matchDate, pick.home, pick.away, pick.competition || pick.sport || "Football", pick.sport || "Football",
        pick.best_bet || "", pick.confidence, Number(coteVal.toFixed(2)), pick.outcome || null,
        pick.final_score_home != null ? pick.final_score_home : null,
        pick.final_score_away != null ? pick.final_score_away : null,
        pick.home_logo || null, pick.away_logo || null
      );
    } catch (e) { console.error("[daily-pick] log historique:", e.message); }
    console.log(`[daily-pick] auto: ${pick.home} vs ${pick.away} (${pick.competition}) conf ${pick.confidence}`);
    return true;
  } catch (e) { console.error("[daily-pick]", e.message); return false; }
}

// Historique du pick du jour — alimente l'onglet dédié sur /performances.
app.get("/daily-pick-history", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const rows = db.prepare(`
      SELECT date, home, away, competition, sport, bet, confidence, cote, outcome, final_score_home, final_score_away, home_logo, away_logo
      FROM daily_pick_log ORDER BY date DESC LIMIT ?
    `).all(limit);
    res.json({ ok: true, picks: rows });
  } catch (e) {
    console.error("[daily-pick-history]", e.message);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// Le pick stocké est-il frais (aujourd'hui) et d'une ligue autorisée ?
function storedPickIsFresh() {
  try {
    const raw = JSON.parse(fs.readFileSync(HERMES_PICKS_PATH, "utf8"));
    const p = raw.currentPick;
    if (!p || !p.home || p.home === "Analyse en cours") return false;
    if (p.source === "auto-h2h-seed") return false;
    const todayISO = new Date().toISOString().slice(0, 10);
    const pDate = (p.date || (p.publishedAt || "").slice(0, 10) || "").slice(0, 10);
    if (pDate !== todayISO) return false;
    if (isExcludedFromPicks(p)) return false;
    if (!isOu25Bet(p.best_bet || p.bet)) return false;
    // Force une regeneration si le pick stocke est sous le seuil de diffusion
    // reel (voir refreshDailyPickFromDB) — sinon un pick deja "frais"
    // aujourd'hui mais trop faible resterait affiche jusqu'a minuit.
    if (p.confidence != null && Number(p.confidence) < getPublishedMinConfidence()) return false;
    return true;
  } catch { return false; }
}

// Dernier refresh forcé du pick du jour (indépendant de storedPickIsFresh,
// qui ne détecte qu'un changement de jour — pas une résolution de match en
// cours de journée). Plafonné à 1x/2min pour ne pas taper la DB à chaque
// chargement de page, tout en restant quasi temps réel pour l'utilisateur.
let _lastCurrentPickRefresh = 0;
// ── Pick du jour — lit picks.json (Hermès/manuel/auto-API) ───────────────────
app.get("/current-pick", (req, res) => {
  // Si le pick stocké n'est pas d'aujourd'hui ou vient d'une ligue exclue, on régénère
  if (!storedPickIsFresh()) refreshDailyPickFromDB();
  // Sinon, on vérifie quand même si le match du pick affiché s'est terminé
  // entre-temps (score/statut) — sans ça, il fallait attendre le prochain
  // passage horaire pour voir le résultat, jusqu'à 1h de retard après un
  // déploiement. Demande de Greg le 31/07/2026.
  else if (Date.now() - _lastCurrentPickRefresh > 120000) {
    _lastCurrentPickRefresh = Date.now();
    refreshDailyPickFromDB();
  }
  // 1. Essaie picks.json (source de vérité), en excluant les ligues blacklistées
  try {
    const raw = JSON.parse(fs.readFileSync(HERMES_PICKS_PATH, "utf8"));
    const p = raw.currentPick;
    const belowThreshold = p && p.confidence != null && Number(p.confidence) < getPublishedMinConfidence();
    const pDate = String(p?.date || p?.publishedAt || "").slice(0, 10);
    const todayISO = new Date().toISOString().slice(0, 10);
    if (p && p.home && p.home !== "Analyse en cours" && p.source !== "auto-h2h-seed" && pDate === todayISO
        && isOu25Bet(p.best_bet || p.bet) && !isExcludedFromPicks(p) && !belowThreshold) {
      return res.json({ ok: true, pick: normalizeCurrentPick(p, p.source || "hermes") });
    }
  } catch (e) { /* picks.json absent ou invalide */ }
  // Aucun signal verifie aujourd'hui : ne pas recycler un ancien pick manuel
  // ou un autre marche comme s'il appartenait au produit O/U 2,5.
  let lastResult = null;
  try {
    const rows = db.prepare(`
      SELECT date, home, away, competition, sport, bet, confidence, cote,
             outcome, final_score_home, final_score_away, home_logo, away_logo
      FROM daily_pick_log
      WHERE outcome IN ('win','loss')
      ORDER BY date DESC LIMIT 30
    `).all();
    let row = rows.find(candidate => isOu25Bet(candidate.bet) && !isExcludedFromPicks(candidate));
    // Les premiers jours suivant l'activation du journal quotidien, celui-ci
    // peut être vide alors que des signaux Telegram résolus existent déjà.
    // Repli strict : uniquement un vrai O/U 2,5 diffusé, jamais une analyse
    // interne, un test ou un prématch non livré.
    if (!row) {
      const delivered = db.prepare(`
        SELECT date(analysed_at) AS date, home, away, competition, sport,
               best_bet AS bet, confidence, real_odd AS cote, outcome,
               final_score_home, final_score_away, home_logo, away_logo
        FROM concile_analyses
        WHERE outcome IN ('win','loss')
          AND COALESCE(source_type,'live') <> 'prematch'
          AND (sig_sent_free=1 OR sig_sent_standard=1 OR sig_sent_premium=1 OR sig_sent_elite=1)
          AND lower(home) NOT LIKE '%[test]%'
          AND lower(away) NOT LIKE '%[test]%'
        ORDER BY datetime(analysed_at) DESC LIMIT 50
      `).all();
      row = delivered.find(candidate => isOu25Bet(candidate.bet) && !isExcludedFromPicks(candidate));
    }
    if (row) {
      lastResult = {
        date: row.date, home: row.home, away: row.away,
        competition: row.competition, sport: row.sport || "Football",
        bet: row.bet, confidence: row.confidence, cote: row.cote,
        outcome: row.outcome,
        final_score_home: row.final_score_home,
        final_score_away: row.final_score_away,
        home_logo: row.home_logo, away_logo: row.away_logo,
      };
    }
  } catch (error) {
    console.error("[current-pick] derniere preuve:", error.message);
  }
  res.json({ ok: true, pick: null, lastResult });
});

// ── Pages SEO (pronostics) — contenu public indexable ────────────────────────
// On ne génère des pages QUE pour les analyses résolues (win/loss) : ce sont des
// preuves historiques (comme /performances), aucun pick payant n'est dévoilé.
function seoPublishedRows(limit) {
  try {
    const rows = db.prepare(`
      SELECT match_key, home, away, competition, country, sport, best_bet, confidence, raison, real_odd,
             real_odd_source, outcome, analysed_at, minute_at_analysis, consensus_votes,
             sig_sent_standard, sig_sent_premium, sig_sent_elite, sig_sent_free, diffusion_block
      FROM concile_analyses
      WHERE date(analysed_at) >= '2026-07-03'
        AND confidence >= ${getPublishedMinConfidence()}
        AND outcome IN ('win','loss')
      ORDER BY analysed_at DESC
    `).all();
    return dedupeAnalysesByMatch(rows.filter(r => !isNoiseForDisplay(r) && isVerifiedClientOu25Row(r))).slice(0, limit).map(r => ({
      home: r.home, away: r.away, competition: r.competition, sport: r.sport || "Football",
      date: r.analysed_at, bet: maskAiNamesGlobal(r.best_bet || "Analyse IA"),
      confidence: r.confidence, cote: rowOdd(r), outcome: r.outcome,
      reasoning: maskAiNamesGlobal(r.raison || ""),
    }));
  } catch (e) { console.error("[seo] rows:", e.message); return []; }
}

// Route proxyee par Caddy mais sans gestionnaire depuis sa creation initiale
// (aucune trace de handler retrouvee) -- redirige vers la page qui couvre deja
// cette intention de recherche plutot que de laisser une 404 sur une URL cible.
app.get("/signaux-sportifs-ia", (req, res) => {
  res.redirect(301, "/pronostics");
});

app.get("/pronostics", (req, res) => {
  const items = seoPublishedRows(500);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(seoPages.renderIndex(items));
});

app.get("/pronostic/:slug", (req, res) => {
  const items = seoPublishedRows(500);
  const slug = String(req.params.slug || "").toLowerCase();
  const item = items.find(it => seoPages.matchSlug(it) === slug);
  if (!item) { res.redirect(302, "/pronostics"); return; }
  const related = items.filter(it => seoPages.matchSlug(it) !== slug).slice(0, 6);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(seoPages.renderDetail(item, related));
});

app.get("/sitemap-pronostics.xml", (req, res) => {
  const items = seoPublishedRows(1000);
  res.set("Content-Type", "application/xml; charset=utf-8");
  res.send(seoPages.renderSitemap(items));
});

// ── Stats par palier (Standard / Premium / Elite) — idée "signaux par palier" ─
// Hybride : rang par confiance, contenu par dispo ARJEL.
//   Standard = ARJEL & confiance >= 88 (les fleurons, faible volume)
//   Premium  = ARJEL & confiance >= 85 (inclut Standard)
//   Elite    = tout le publié >= getPublishedMinConfidence() (ARJEL + "IA seulement")
// Lecture seule. Chaque palier a son propre track record (total, winrate, ROI simulé).
function rowIsArjel(r) {
  return ARJEL_BOOKMAKERS.some(a => String(r.real_odd_source || "").toLowerCase().includes(a))
    || isArjelMajorCompetition(r);
}

// Éligibilité d'une analyse à un palier — MIROIR EXACT des règles de diffusion
// Telegram (cf. gradeStandard/gradePremium/gradeElite dans runAutoConcile).
// Les statistiques publiques décrivent ainsi ce que l'abonné reçoit réellement,
// et non un échantillon plus large : c'est la seule façon que le track record
// affiché corresponde au produit vendu.
// Modèle imbriqué : Elite ⊇ Premium ⊇ Standard.
function tierEligible(r, tier) {
  const conf = Number(r.confidence) || 0;
  if (!rowIsArjel(r)) return false;
  const _ro = Number(r.real_odd) || 0;
  if (_ro < TIER_MIN_REAL_ODD || _ro > TIER_MAX_REAL_ODD) return false;
  const sport = String(r.sport || "Football").toLowerCase();
  const isFoot = sport.includes("foot");
  // Seuils DYNAMIQUES (getTierThresholds), pas les constantes figees
  // STANDARD_MIN_CONF/PREMIUM_MIN_CONF/getEliteMinConf() : la diffusion Telegram
  // reelle (runAutoConcile, gradeStandard/gradePremium/gradeElite) utilise deja
  // le seuil dynamique recalibre chaque jour. Avant ce correctif, /performances
  // affichait un seuil Standard fige a 88 alors que la diffusion reelle
  // tournait a 85 ce jour-la — les stats publiques ne refletaient donc pas ce
  // que les abonnes recevaient vraiment (signale par Greg le 02/08/2026).
  const TH = getTierThresholds();
  const std = isFoot && conf >= TH.standard;
  if (tier === "standard") return std;
  const prem = std || (isFoot && conf >= TH.premium);
  if (tier === "premium") return prem;
  return prem || (ELITE_SPORTS.some(s => sport.includes(s)) && conf >= TH.elite);
}
function tierStatsFor(set) {
  let wins = 0, roi = 0;
  for (const r of set) {
    const cote = rowOdd(r);
    if (r.outcome === "win") { wins++; roi += (cote - 1) * 10; } else { roi -= 10; }
  }
  const total = set.length;
  return {
    total, wins, losses: total - wins,
    winrate: total ? Math.round(wins / total * 100) : 0,
    roi: Math.round(roi),
    recent: set.slice(0, 8).map(r => ({
      home: r.home, away: r.away, competition: r.competition || r.sport || "",
      bet: maskAiNamesGlobal(r.best_bet || ""), confidence: r.confidence,
      cote: rowOdd(r), outcome: r.outcome,
      score: r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : null,
    })),
  };
}

// ── Campagne "ce que tu aurais gagné" (Brevo, mardi + vendredi) ──────────────
// Simule le profit de la veille (mise 10€) pour le palier reellement souscrit
// par l'abonne + le palier immediatement superieur, meme methode de calcul
// que la page /performances (tierEligible/tierStatsFor, source unique de
// verite pour ne jamais afficher un chiffre different du site).
const TIER_ABOVE = { standard: "premium", premium: "elite" };
const TIER_LABEL = { standard: "Standard", premium: "Premium", elite: "Elite/VIP" };

function fetchResolvedRowsForDate(dateStr) {
  const rows = db.prepare(`
    SELECT match_key, home, away, competition, country, sport, best_bet, confidence, outcome,
           real_odd, real_odd_source, final_score_home, final_score_away, analysed_at,
           minute_at_analysis, consensus_votes,
           sig_sent_standard, sig_sent_premium, sig_sent_elite, sig_sent_free, diffusion_block
    FROM concile_analyses
    WHERE outcome IN ('win','loss') AND confidence >= ${getPublishedMinConfidence()}
      AND date(analysed_at) = ?
  `).all(dateStr);
  return dedupeAnalysesByMatch(rows.filter(r => !isNoiseForDisplay(r) && isVerifiedClientOu25Row(r)));
}

function outperformEmailHtml(email, ownTier, ownStats, aboveTier, aboveStats, dateLabel) {
  const fmtEur = (n) => (n >= 0 ? "+" : "") + Math.round(n) + "€";
  const ownColor = ownStats.roi >= 0 ? "#10b981" : "#f43f5e";
  const aboveColor = aboveStats.roi >= 0 ? "#10b981" : "#f43f5e";
  const upsellUrl = ownTier === "standard"
    ? "https://buy.stripe.com/6oU3cvdfK4Fm0JC1yK3VC06"
    : "https://buy.stripe.com/4gM9AT5Nifk0gIA91c3VC07";
  return `
  <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:560px;margin:0 auto;background:#06080f;color:#eceaf4;padding:32px 24px">
    <div style="font-size:13px;color:#7b82a0;margin-bottom:18px">Récap du ${dateLabel} — palier ${TIER_LABEL[ownTier]}</div>
    <h2 style="font-size:20px;margin:0 0 16px">Voici ce qu'aurait rapporté ton palier hier</h2>
    <div style="background:#0d1020;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:20px;margin-bottom:16px">
      <div style="font-size:12px;color:#7b82a0;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${TIER_LABEL[ownTier]} — ${ownStats.total} sélection${ownStats.total > 1 ? "s" : ""}</div>
      <div style="font-size:30px;font-weight:900;color:${ownColor}">${ownStats.total ? fmtEur(ownStats.roi) : "—"}</div>
      <div style="font-size:12px;color:#a8aec8;margin-top:4px">${ownStats.total ? `${ownStats.wins} gagnée${ownStats.wins > 1 ? "s" : ""} / ${ownStats.losses} perdue${ownStats.losses > 1 ? "s" : ""} (mise 10€ chacune)` : "Aucune sélection résolue sur cette période pour ce palier."}</div>
    </div>
    ${aboveTier ? `
    <div style="background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.3);border-radius:14px;padding:20px;margin-bottom:20px">
      <div style="font-size:12px;color:#c4b5fd;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Avec ${TIER_LABEL[aboveTier]} — ${aboveStats.total} sélection${aboveStats.total > 1 ? "s" : ""}</div>
      <div style="font-size:30px;font-weight:900;color:${aboveColor}">${aboveStats.total ? fmtEur(aboveStats.roi) : "—"}</div>
      <div style="font-size:12px;color:#a8aec8;margin-top:8px">
        <a href="${upsellUrl}" style="color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:9px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block">Passer ${TIER_LABEL[aboveTier]} →</a>
      </div>
    </div>` : ""}
    <div style="font-size:11px;color:#7b82a0;line-height:1.7;border-top:1px solid rgba(255,255,255,.08);padding-top:16px">
      Simulation à titre informatif, mise fixe de 10€ par sélection, sur les résultats réellement publiés. Les performances passées ne garantissent pas les résultats futurs. TousLesMatchs ne garantit aucun gain.<br>
      LES JEUX D'ARGENT ET DE HASARD PEUVENT ÊTRE DANGEREUX — joueurs-info-service.fr, 09 74 75 13 13.<br>
      <a href="https://www.touslesmatchs.com/performances" style="color:#818cf8">Voir l'historique complet</a>
    </div>
  </div>`;
}

let _lastOutperformEmailDate = "";
async function sendOutperformEmails() {
  if (!BREVO_API_KEY) return;
  try {
    const yesterday = new Date(Date.now() - 86400000);
    const dateStr = yesterday.toISOString().slice(0, 10);
    const dateLabel = yesterday.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
    const rows = fetchResolvedRowsForDate(dateStr);

    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const subs = codesDb.prepare(
      "SELECT DISTINCT email, plan FROM codes WHERE plan IN ('standard','premium') AND active = 1 AND email IS NOT NULL"
    ).all();
    codesDb.close();

    let sent = 0;
    for (const sub of subs) {
      const ownTier = sub.plan;
      const aboveTier = TIER_ABOVE[ownTier] || null;
      const ownStats = tierStatsFor(rows.filter(r => tierEligible(r, ownTier)));
      if (!ownStats.total) continue; // rien a montrer, on n'envoie pas un email vide
      const aboveStats = aboveTier ? tierStatsFor(rows.filter(r => tierEligible(r, aboveTier))) : null;
      const html = outperformEmailHtml(sub.email, ownTier, ownStats, aboveTier, aboveStats, dateLabel);
      try {
        await brevoSendEmail(sub.email, `📊 Ce que ${TIER_LABEL[ownTier]} aurait rapporté le ${dateLabel}`, html);
        sent++;
      } catch (e) {
        console.error(`[outperform-email] ${sub.email}:`, e.message);
      }
    }
    console.log(`[outperform-email] ${sent}/${subs.length} emails envoyés (données du ${dateLabel})`);
  } catch (e) {
    console.error("[outperform-email]", e.message);
  }
}

// ── Miniature quotidienne "combien on aurait gagné" (Telegram, minuit) ──────
// Meme source de verite que outperformEmailHtml (tierEligible/tierStatsFor,
// mise fixe 10€) — jamais un chiffre invente. Genere une image via Gemini
// (Nano Banana), jamais une capture de bookmaker existant (Winamax etc, voir
// discussion du 01/08/2026 : reprendre leur logo/mascotte serait une
// contrefacon en plus d'un risque de conformite ANJ). Verrou de lancement :
// DAILY_GAIN_IMAGE_PUBLIC="1" bascule de l'apercu admin vers les vrais
// groupes Standard/Premium/Elite, une fois le rendu valide par Greg.
const DAILY_GAIN_IMAGE_PUBLIC = process.env.DAILY_GAIN_IMAGE_PUBLIC === "1";

function sendTelegramPhoto(chatId, imageBuffer, caption) {
  return new Promise((resolve) => {
    if (!TELEGRAM_BOT_TOKEN || !chatId || !imageBuffer) return resolve(false);
    const boundary = "tlmGainImg" + Date.now();
    const nl = "\r\n";
    const head = [];
    head.push(`--${boundary}${nl}Content-Disposition: form-data; name="chat_id"${nl}${nl}${chatId}${nl}`);
    if (caption) {
      head.push(`--${boundary}${nl}Content-Disposition: form-data; name="caption"${nl}${nl}${caption}${nl}`);
      head.push(`--${boundary}${nl}Content-Disposition: form-data; name="parse_mode"${nl}${nl}HTML${nl}`);
    }
    head.push(`--${boundary}${nl}Content-Disposition: form-data; name="photo"; filename="gain.png"${nl}Content-Type: image/png${nl}${nl}`);
    const body = Buffer.concat([Buffer.from(head.join(""), "utf8"), imageBuffer, Buffer.from(`${nl}--${boundary}--${nl}`, "utf8")]);
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": body.length },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(!!JSON.parse(data).ok); } catch { resolve(false); }
      });
    });
    req.on("error", () => resolve(false));
    req.write(body);
    req.end();
  });
}

async function generateGainImage(tier, stats, dateLabel) {
  if (!OPENAI_API_KEY) return null;
  const fmtEur = (n) => (n >= 0 ? "+" : "") + Math.round(n) + "€";
  const prompt = `Cree une image verticale format story (1024x1536), fond degrade bleu nuit tres sombre et violet neon, ambiance application premium type fintech moderne. INTERDIT : logo ou mascotte d'un bookmaker existant (Winamax, Betclic, PMU, Unibet...), jetons de casino, des, symboles de jeu d'argent, humain photorealiste.
En haut, texte tres lisible en majuscules : "${TIER_LABEL[tier].toUpperCase()}".
Au centre, ENORME et tres lisible, le montant "${fmtEur(stats.roi)}" en blanc avec un halo neon ${stats.roi >= 0 ? "vert emeraude" : "rouge"}.
Juste en dessous, plus petit : "${stats.wins} gagnees / ${stats.losses} perdues sur ${stats.total} selections".
Sous ce texte, encore plus petit : "Simulation mise fixe 10 euros par selection".
Un petit robot/IA stylise amical et minimaliste (pas humain, pas de mascotte de marque) peut apparaitre, avec quelques confettis discrets si le montant est positif, aucun element si negatif.
Tout en bas de l'image, tres petit mais parfaitement lisible : "18+ Jeu responsable - joueurs-info-service.fr - TousLesMatchs - Simulation informative, aucun gain garanti."
Texte entierement en francais, sans faute d'orthographe, sans watermark d'IA generative.`;

  try {
    const resp = await httpPostStrict(
      "https://api.openai.com/v1/images/generations",
      { model: "gpt-image-1", prompt, size: "1024x1536" },
      { Authorization: `Bearer ${OPENAI_API_KEY}` }
    );
    const b64 = resp?.data?.[0]?.b64_json;
    if (!b64) { console.error(`[gain-image] ${tier}: pas de donnees image dans la reponse OpenAI`); return null; }
    return Buffer.from(b64, "base64");
  } catch (e) {
    console.error(`[gain-image] ${tier} generation:`, e.message);
    return null;
  }
}

async function sendDailyGainImages() {
  try {
    const yesterday = new Date(Date.now() - 86400000);
    const dateStr = yesterday.toISOString().slice(0, 10);
    const dateLabel = yesterday.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
    const rows = fetchResolvedRowsForDate(dateStr);
    const targets = {
      standard: TELEGRAM_STANDARD_CHANNEL_ID,
      premium: TELEGRAM_PREMIUM_CHANNEL_ID,
      elite: TELEGRAM_ELITE_CHANNEL_ID,
    };
    for (const tier of ["standard", "premium", "elite"]) {
      const stats = tierStatsFor(rows.filter((r) => tierEligible(r, tier)));
      if (!stats.total) { console.log(`[gain-image] ${tier}: rien a montrer le ${dateLabel}, skip`); continue; }
      const img = await generateGainImage(tier, stats, dateLabel);
      if (!img) continue;
      const destChat = DAILY_GAIN_IMAGE_PUBLIC ? targets[tier] : TELEGRAM_ADMIN_CHAT_ID;
      if (!destChat) continue;
      const caption = DAILY_GAIN_IMAGE_PUBLIC
        ? `📊 <b>${TIER_LABEL[tier]}</b> — récap du ${dateLabel}`
        : `📊 <b>${TIER_LABEL[tier]}</b> — récap du ${dateLabel}\n<i>Aperçu admin (DAILY_GAIN_IMAGE_PUBLIC=off) — pas encore envoyé aux abonnés.</i>`;
      const ok = await sendTelegramPhoto(destChat, img, caption);
      console.log(`[gain-image] ${tier}: ${ok ? "envoyé" : "échec envoi"} ${DAILY_GAIN_IMAGE_PUBLIC ? "(public)" : "(aperçu admin)"}`);
    }
  } catch (e) {
    console.error("[gain-image] sendDailyGainImages:", e.message);
  }
}
app.get("/tier-stats", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT match_key, home, away, competition, country, sport, confidence, best_bet, outcome, real_odd,
             real_odd_source, final_score_home, final_score_away, analysed_at,
             minute_at_analysis, consensus_votes,
             sig_sent_standard, sig_sent_premium, sig_sent_elite, sig_sent_free, diffusion_block
      FROM concile_analyses
      WHERE outcome IN ('win','loss')
        AND confidence >= ${getPublishedMinConfidence()}
        AND date(analysed_at) >= '2026-07-03'
      ORDER BY analysed_at DESC
    `).all();
    const clean = dedupeAnalysesByMatch(rows.filter(r => !isNoiseForDisplay(r) && isVerifiedClientOu25Row(r)));
    const standard = clean.filter(r => tierEligible(r, "standard"));
    const premium  = clean.filter(r => tierEligible(r, "premium"));
    const elite    = clean.filter(r => tierEligible(r, "elite"));
    res.json({
      ok: true,
      tiers: {
        standard: tierStatsFor(standard),
        premium: tierStatsFor(premium),
        elite: tierStatsFor(elite),
      },
    });
  } catch (e) { console.error("[tier-stats]", e.message); res.json({ ok: false }); }
});

// ── Le Conseil délibère — votes anonymisés du pick du jour ───────────────────
// Renvoie les votes individuels des agents (anonymisés Alpha→Sigma) + le verdict
// du Conseil, pour le panneau "effet WOW" du Hero. Données réelles depuis
// concile_analyses.agents_json. Aucun nom d'IA réel n'est exposé.
const COUNCIL_LABELS = ["Alpha", "Beta", "Gamma", "Delta", "Sigma"];
app.get("/council-vote", (req, res) => {
  try {
    // 1. Match du pick du jour
    let home = null, away = null;
    try {
      const raw = JSON.parse(fs.readFileSync(HERMES_PICKS_PATH, "utf8"));
      const p = raw.currentPick;
      if (p && p.home && p.home !== "Analyse en cours") { home = p.home; away = p.away; }
    } catch (_) {}

    // 2. Ligne d'analyse correspondante (la plus récente pour ce match)
    let row = null;
    if (home && away) {
      row = db.prepare(
        "SELECT home, away, competition, sport, best_bet, confidence, agents_json, real_odd, home_logo, away_logo " +
        "FROM concile_analyses WHERE lower(trim(home))=lower(trim(?)) AND lower(trim(away))=lower(trim(?)) " +
        "ORDER BY analysed_at DESC LIMIT 1"
      ).get(home, away);
    }
    // Fallback : dernière analyse publiée du jour (la plus confiante)
    if (!row) {
      row = db.prepare(
        `SELECT home, away, competition, sport, best_bet, confidence, agents_json, real_odd, home_logo, away_logo
         FROM concile_analyses
         WHERE confidence >= ${getPublishedMinConfidence()} AND date(analysed_at)=date('now')
         ORDER BY confidence DESC, analysed_at DESC LIMIT 1`
      ).get();
    }
    if (!row) return res.json({ ok: false });

    let agents = [];
    try { agents = JSON.parse(row.agents_json || "[]"); } catch {}
    // On garde les votants (hors doublon exact du verdict), anonymisés.
    const verdictBet = row.best_bet || "";
    const votes = agents.filter((a) => !a?.isChief && a?.name !== "Claude Chief").slice(0, 5).map((a, i) => {
      const bet = maskAiNamesGlobal(String(a.bet || verdictBet || "Analyse"));
      const conf = Math.max(50, Math.min(99, parseInt(a.confidence, 10) || row.confidence || 80));
      const aligned = bet.toLowerCase().trim() === verdictBet.toLowerCase().trim();
      return { label: COUNCIL_LABELS[i] || `IA ${i + 1}`, bet, confidence: conf, aligned };
    });
    // Si pas de votes stockés (pick Hermès sans agents), on synthétise un consensus
    // honnête : tous alignés sur le verdict, confiance = confiance du Conseil.
    const fallbackVotes = votes.length ? votes : COUNCIL_LABELS.slice(0, 5).map((l, i) => ({
      label: l, bet: verdictBet || "Analyse", confidence: row.confidence || 82, aligned: true,
    }));

    res.json({
      ok: true,
      match: {
        home: row.home, away: row.away,
        competition: row.competition || row.sport || "Football",
        home_logo: row.home_logo || null, away_logo: row.away_logo || null,
      },
      agents: fallbackVotes,
      verdict: {
        bet: maskAiNamesGlobal(verdictBet),
        confidence: row.confidence || 82,
        cote: row.real_odd && row.real_odd > 1 ? Math.round(row.real_odd * 100) / 100 : null,
      },
    });
  } catch (e) {
    console.error("[council-vote]", e.message);
    res.json({ ok: false });
  }
});

// ── Activité en direct — compteurs réels du jour (réassurance "site vivant") ──
app.get("/live-activity", (req, res) => {
  try {
    // Le bandeau Live ne doit pas compter les picks H2H pre-match internes.
    // Ils n'utilisent pas le Concile live et ne peuvent pas devenir un signal
    // client. Les melanger expliquait le faux volume "26 analyses" du 28/08.
    const analysesToday = db.prepare(
      `SELECT COUNT(*) AS c FROM concile_analyses
       WHERE date(analysed_at)=date('now')
         AND COALESCE(source_type, 'live') = 'live'`
    ).get()?.c || 0;
    // Un signal n'existe cote client qu'apres une reponse Telegram OK avec un
    // message_id. Compter seulement la confiance transformait 24 analyses
    // prematch sans minute, cote ni vote en "24 signaux" le 28/08.
    const publishedToday = db.prepare(
      `SELECT COUNT(DISTINCT match_key) AS c
       FROM telegram_signal_deliveries
       WHERE ok=1 AND telegram_message_id IS NOT NULL
         AND channel IN ('standard','premium','elite')
         AND date(created_at)=date('now')`
    ).get()?.c || 0;
    const totalPublished = db.prepare(
      `SELECT COUNT(DISTINCT match_key || '|' || date(created_at)) AS c
       FROM telegram_signal_deliveries
       WHERE ok=1 AND telegram_message_id IS NOT NULL
         AND channel IN ('standard','premium','elite')`
    ).get()?.c || 0;
    const signalsToday = publishedToday;
    res.json({
      ok: true,
      analyses_today: analysesToday,
      published_today: publishedToday,
      total_published: totalPublished,
      signals_today: signalsToday,
      ia_active: 5,
    });
  } catch (e) {
    console.error("[live-activity]", e.message);
    res.json({ ok: false });
  }
});

app.post("/admin/set-pick", (req, res) => {
  const { email, code, pick } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  if (!pick || !pick.teamA || !pick.teamB) return res.status(400).json({ ok: false, error: "Données pick incomplètes" });
  const manualPick = {
    ...pick,
    source: pick.source || "manual-admin",
    updatedAt: new Date().toISOString(),
  };
  savePick(manualPick);
  res.json({ ok: true, pick: manualPick });
});

// ── Score manuel (fallback admin) ────────────────────────────────────────────
app.get("/live-score", (req, res) => {
  const s = loadManualScore();
  res.json(s ? { ok: true, score: s } : { ok: false });
});

app.post("/admin/set-score", (req, res) => {
  const { email, code, scoreA, scoreB, minute, status, home, away } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  const data = {
    home: home || "", away: away || "",
    score_home: Number(scoreA ?? 0), score_away: Number(scoreB ?? 0),
    minute: minute || null,
    status: status || "IN_PLAY",
    updated: new Date().toISOString()
  };
  saveManualScore(data);
  res.json({ ok: true, score: data });
});

app.delete("/admin/set-score", (req, res) => {
  const { email, code } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  try { fs.unlinkSync(SCORE_PATH); } catch {}
  res.json({ ok: true });
});

// ── Votes réels Over/Under 2,5 pour les cinq cases live ──────────────────────
// Source unique : agent_market_predictions, déjà alimentée par les réponses
// multi-marchés de chaque agent. Aucun vote n'est déduit du consensus principal.
function getLiveOu25VoteState(match) {
  const minute = parseLiveMinuteValue(match?.minute);
  const windowStatus = minute === null ? "unknown" : minute < 15 ? "waiting" : minute <= CLIENT_OU25_CLIENT_MAX_MINUTE ? "open" : "closed";
  const emptyVotes = CONCILE_AGENT_NAMES.map((agent) => ({
    agent,
    direction: null,
    label: null,
    confidence: null,
    status: "pending",
    updated_at: null,
  }));
  const empty = {
    market: "over_under_2_5",
    from_minute: 15,
    to_minute: CLIENT_OU25_CLIENT_MAX_MINUTE,
    window_status: windowStatus,
    vote_count: 0,
    over_count: 0,
    under_count: 0,
    votes: emptyVotes,
  };
  if (minute === null || minute < 15) return empty;

  try {
    const placeholders = CONCILE_AGENT_NAMES.map(() => "?").join(",");
    const rows = db.prepare(`
      SELECT agent_name, bet, confidence, created_at
      FROM agent_market_predictions
      WHERE market_line = 'buts'
        AND date(created_at) = date('now')
        AND lower(trim(home)) = lower(trim(?))
        AND lower(trim(away)) = lower(trim(?))
        AND agent_name IN (${placeholders})
      ORDER BY datetime(created_at) DESC, id DESC
    `).all(match?.home || "", match?.away || "", ...CONCILE_AGENT_NAMES);

    const latestByAgent = new Map();
    for (const row of rows) {
      if (!latestByAgent.has(row.agent_name)) latestByAgent.set(row.agent_name, row);
    }
    const votes = CONCILE_AGENT_NAMES.map((agent) => {
      const row = latestByAgent.get(agent);
      const bet = String(row?.bet || "");
      const direction = /^Over 2[.,]5 buts$/i.test(bet)
        ? "over"
        : /^Under 2[.,]5 buts$/i.test(bet)
          ? "under"
          : null;
      if (!direction) return emptyVotes.find((vote) => vote.agent === agent);
      return {
        agent,
        direction,
        label: direction === "over" ? "Over 2,5" : "Under 2,5",
        confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : null,
        status: "voted",
        updated_at: row.created_at || null,
      };
    });
    const overCount = votes.filter((vote) => vote.direction === "over").length;
    const underCount = votes.filter((vote) => vote.direction === "under").length;
    return {
      ...empty,
      vote_count: overCount + underCount,
      over_count: overCount,
      under_count: underCount,
      votes,
    };
  } catch (e) {
    console.error("[live-ou25-votes]", e.message);
    return empty;
  }
}

// ── Live matches ──────────────────────────────────────────────────────────────
app.get("/live-matches", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, max-age=0");
    if (req.query.force === "1") {
      liveMatchesCache = { data: null, ts: 0 };
      console.log("[live-matches] Cache forcé vidé par l'utilisateur");
    }
    const allMatches = await fetchLiveMatches();
    // Filtre STRICT : Live IA n'affiche que les ligues fiables (whitelist), où les
    // données live sont rapides et sûres. Plus jamais de score faux d'une ligue mineure.
    const matches = allMatches.filter(m => {
      const sport = String(m?.sport || "").trim();
      // isWomenMatch() manquait cote football : isLowTrustCompetition ne verifie
      // que la fiabilite de la ligue, jamais le genre. Une Liga MX Femenil (donc
      // Football) passait ainsi telle quelle sur "En direct" avec un bouton
      // "Analyser ce match" — constate par Greg le 03/08/2026.
      if (isWomenMatch(m)) return false;
      return sport === "Football" ? !isLowTrustCompetition(m) : !isBlacklistedForLiveDisplay(m);
    });

    // Injecter les signaux épinglés si le match n'est plus dans l'API
    const pinned = getActivePinnedSignals();
    for (const ps of pinned) {
      if (!isPublicFootballScopeMatch(ps)) continue;
      const alreadyLive = matches.some(m =>
        m.home?.toLowerCase().includes(ps.home?.toLowerCase().split(" ")[0]) &&
        m.away?.toLowerCase().includes(ps.away?.toLowerCase().split(" ")[0])
      );
      if (!alreadyLive) {
        matches.unshift({
          id: ps.id,
          home: ps.home, away: ps.away,
          competition: ps.competition || ps.league || "",
          sport: ps.sport || "Football",
          status: "PINNED_SIGNAL",
          minute: ps.minute,
          score_home: ps.score_home ?? null,
          score_away: ps.score_away ?? null,
          home_logo: ps.home_logo || null,
          away_logo: ps.away_logo || null,
          pinnedSignal: true,
          pinnedBet: ps.bet,
          pinnedConfidence: ps.confidence,
          pinnedReason: ps.reason,
        });
      }
    }

    // Verdict d'analysabilité calculé par le SERVEUR et joint à chaque match.
    // Le front appliquait sa propre règle 25e–65e minute, codée en dur : elle
    // contredisait la règle serveur (sélection par la cote depuis le 28/07/2026)
    // et, sur les sports sans minutes, parseInt("IN9") donnait NaN — donc tout
    // le baseball, le basket et le hockey étaient bloqués en permanence avec un
    // message parlant de minutes de football. Une seule source de vérité ici.
    const withVerdict = matches.map((m) => {
      const ou25 = getLiveOu25VoteState(m);
      const clientProductEligible = isClientOu25MatchEligible(m, true);
      const alignedVotes = Math.max(Number(ou25.over_count || 0), Number(ou25.under_count || 0));
      // Source de verite pour l'accueil public : un match ne peut etre presente
      // comme un signal que si le championnat est dans le perimetre client ET
      // qu'au moins 4 IA ont reellement enregistre le meme vote O/U 2,5.
      // Cela evite qu'un simple match live bien illustre (logos + score) soit
      // affiche avec un faux statut "Analyse IA en cours" alors qu'il est a 0/5.
      const homepageDisplayEligible = clientProductEligible && alignedVotes >= CLIENT_OU25_MIN_VOTES;
      const visibility = {
        client_product_eligible: clientProductEligible,
        analysis_started: Number(ou25.vote_count || 0) > 0,
        analysis_verified: homepageDisplayEligible,
        homepage_display_eligible: homepageDisplayEligible,
      };
      const analysisExclusionReason = m.analysis_exclusion_reason || null;
      if (m.pinnedSignal) return { ...m, analysable: false, block_reason: null, analysis_exclusion_reason: null, ou25, ...visibility };
      const reason = livePickBlockReason(m) || analysisExclusionReason;
      return { ...m, analysable: !reason, block_reason: reason, analysis_exclusion_reason: analysisExclusionReason, ou25, ...visibility };
    });

    // Règle du 29/07/2026 ("n'afficher que ce qui est jouable") assouplie le
    // 01/08/2026 sur demande de Greg : un match sans signal disparaissait
    // entièrement au bout de quelques minutes, ce qui donnait l'impression
    // que le site n'analysait rien. Tous les matchs live restent maintenant
    // visibles — analysable/block_reason indiquent au front s'il y a un
    // bouton d'analyse ou juste une étiquette explicative.

    // Filtres avancés Live IA (04/08/2026, demande fondateur) : chaque match
    // porte ses stats H2H (BTTS/1ère MT/Under 2.5) pour permettre un filtrage
    // multi-critères CÔTÉ CLIENT, gratuit, sans dépenser de jeton. fetchH2H est
    // déjà cache-aware (6h) et budget-gardé (apiSportsBudgetOk) — l'appeler ici
    // pour tous les matchs live ne coûte donc rien de plus que ce que coûterait
    // déjà l'ouverture individuelle de chaque analyse le même jour.
    const withH2H = await Promise.all(withVerdict.map(async (m) => {
      if (m.pinnedSignal || m.sport !== "Football" || m.source !== "api-sports" || !m.homeId || !m.awayId) {
        return { ...m, h2h_markets: null };
      }
      try {
        const h2h = await fetchH2H(m);
        return {
          ...m,
          h2h_markets: (h2h && h2h.n >= 3) ? {
            n: h2h.n, btts_pct: h2h.bttsPct, first_half_goal_pct: h2h.htGoalPct, under25_pct: h2h.under25Pct,
          } : null,
        };
      } catch (_) {
        return { ...m, h2h_markets: null };
      }
    }));

    const strictMatches = await enrichStrictGoal05(withH2H);
    res.json({ ok: true, matches: strictMatches });
  } catch (e) {
    res.json({ ok: true, matches: [] });
  }
});

app.get("/pinned-signals", (req, res) => {
  res.json({ ok: true, signals: getActivePinnedSignals() });
});

// ── Existing analyse endpoint (no token cost) ─────────────────────────────────
// Rate limiter simple : max 3 analyses/min par IP
const analysisRateLimit = new Map();
function checkAnalysisRate(ip) {
  const now = Date.now();
  const entry = analysisRateLimit.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60000; }
  entry.count++;
  analysisRateLimit.set(ip, entry);
  return entry.count <= 3;
}

app.post("/analyse", async (req, res) => {
  const { home, away, match_id } = req.body || {};
  if (!home || !away) return res.json({ ok: false, error: "Deux équipes requises" });
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  if (!checkAnalysisRate(ip)) return res.status(429).json({ ok: false, error: "Trop de requêtes, attends 1 minute." });

  try {
    const verifiedMatch = await requireVerifiedLiveMatch({ id: match_id, home, away });
    if (!verifiedMatch) return res.json({ ok: false, error: "Match live non verifie" });
    if (rejectScoreConflict(verifiedMatch, res)) return;
    const blockReason = livePickBlockReason(verifiedMatch);
    if (blockReason) return res.json({ ok: false, error: blockReason });
    // Cet endpoint ne passe PAS par shouldAutoObserveMatch (reserve au moteur
    // automatique) : sans ce garde-fou, un appel direct pouvait faire analyser
    // un match jeunes/amical/ligue douteuse en contournant tout le filtre de
    // fiabilite. Constate le 29/07/2026 sur un U19 norvegien, visible nulle
    // part sur le site (deja masque par le filtre d'affichage) mais toujours
    // atteignable via cet endpoint appele directement.
    if (isExcludedFromPicks(verifiedMatch)) return res.json({ ok: false, error: "Analyse indisponible pour cette competition." });
    const analysis = await runConcileAnalysis(verifiedMatch);
    const chief = analysis.agents[analysis.agents.length - 1];

    res.json({
      ok: true,
      resume: chief.raison,
      value_bet: { marche: chief.bet, prob: chief.confidence, cote_min_conseillée: (1 / (chief.confidence / 100)).toFixed(2), raison: chief.raison },
      over25: { prob: 58, tendance: "Tendance légèrement positive sur les buts." },
      btts: { prob: 52, tendance: "Les deux équipes ont des attaques actives." },
      resultat: { domicile: 45, nul: 28, exterieur: 27, explication: "Légère faveur pour l'équipe à domicile." },
      premier_but_mi_temps: { premiere: 55, deuxieme: 45, explication: "Les premières mi-temps sont souvent plus ouvertes." },
    });
  } catch (e) {
    res.json({ ok: false, error: "Erreur d'analyse" });
  }
});

// ── Live IA — token-gated Concile analysis ─────────────────────────────────────
app.post("/live-ia/analyse", authMiddleware, async (req, res) => {
  const { match_id, home, away, score_home, score_away, minute, competition } = req.body || {};
  if (!home || !away) return res.json({ ok: false, error: "Données du match manquantes" });

  const verifiedMatch = await requireVerifiedLiveMatch({ id: match_id, home, away });
  if (!verifiedMatch) return res.json({ ok: false, error: "Match live non verifie" });
  if (rejectScoreConflict(verifiedMatch, res)) return;
  const blockReason = livePickBlockReason(verifiedMatch);
  if (blockReason) return res.json({ ok: false, error: blockReason });
  // Meme garde-fou que /analyse : ce endpoint est token-gated (abonne connecte)
  // mais ne verifiait pas non plus la fiabilite de la competition avant d'appeler
  // le Concile.
  if (isExcludedFromPicks(verifiedMatch)) return res.json({ ok: false, error: "Analyse indisponible pour cette competition." });

  const matchKey = `${verifiedMatch.id || `${verifiedMatch.home}_${verifiedMatch.away}`}_${getTodayStr()}`;

  // Check if already revealed (no token cost)
  const existing = db.prepare(
    "SELECT analysis_json FROM revealed_analyses WHERE user_id = ? AND match_key = ?"
  ).get(req.user.id, matchKey);

  if (existing) {
    return res.json({ ok: true, ...sanitizeAnalysisForClient(JSON.parse(existing.analysis_json)), cached: true });
  }

  // Deduct token
  const tokenResult = deductToken(req.user.id);
  if (!tokenResult.ok) return res.json({ ok: false, error: tokenResult.error });

  // Run analysis
  try {
    const analysis = await runConcileAnalysis(verifiedMatch);

    // Cache result
    db.prepare(
      "INSERT INTO revealed_analyses (user_id, match_key, analysis_json) VALUES (?, ?, ?)"
    ).run(req.user.id, matchKey, JSON.stringify(analysis));

    // Get updated token count
    const tokenRow = getTokenRow(req.user.id);

    res.json({ ok: true, ...sanitizeAnalysisForClient(analysis), tokens_remaining: tokenRow?.tokens_today ?? 0 });
  } catch (e) {
    // Refund token on error
    db.prepare("UPDATE user_tokens SET tokens_today = tokens_today + 1 WHERE user_id = ?").run(req.user.id);
    res.json({ ok: false, error: "Erreur d'analyse — jeton remboursé" });
  }
});

// ── Live IA — code-based auth (no JWT) ────────────────────────────────────────
function httpPostInternal(host, port, path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      { hostname: host, port, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function verifyCode(email, code) {
  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const row = codesDb.prepare(
      "SELECT * FROM codes WHERE code = ? AND email = ? AND active = 1"
    ).get(code.toUpperCase().trim(), email.toLowerCase().trim());
    codesDb.close();
    if (!row) return { valid: false, error: "Code ou email invalide" };
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { valid: false, error: "Code expiré" };
    }
    // Les codes ELITE-ADMIN ont des crédits illimités
    const isAdminCode = code.toUpperCase().startsWith('ELITE-ADMIN');
    const credits_left = isAdminCode
      ? 999999
      : creditsLeftForPlan(row.plan, row.credits_max, row.credits_used, row.credits_date);
    return { valid: true, plan: row.plan, credits_left, email: row.email };
  } catch (e) {
    console.error("[verifyCode] error:", e.message);
    return { valid: false, error: "Erreur de vérification" };
  }
}

// Cache des analyses de la journée (clé = email+matchId)
function isAdminAccess(email, code) {
  if (!email || !code) return false;
  return isAdmin(email, code) || code.toUpperCase().trim().startsWith("ELITE-ADMIN");
}

function sanitizeAnalysisForClient(analysis, allowAdminFields = false) {
  const clean = { ...analysis };
  if (!allowAdminFields) delete clean.agent_performance;
  if (Array.isArray(clean.agents)) {
    clean.agents = clean.agents
      .filter((agent) => {
        const bet = String(agent?.bet || "").trim();
        const reason = String(agent?.raison || "");
        return !agent.failed
          && bet
          && bet !== "—"
          && bet !== "-"
          && agent.confidence !== null
          && agent.confidence !== undefined
          && !reason.includes("IA non joignable");
      })
      .map((agent, index, list) => ({
        ...agent,
        name: index === list.length - 1 && agent.isChief ? "Synthèse du Concile" : `Agent IA ${index + 1}`,
        model: "",
        raison: agent.isChief ? agent.raison : "",
      }));
  }
  return clean;
}

const analysisCache = new Map();

app.post("/concile-analysis", async (req, res) => {
  const { email, code, match } = req.body || {};
  if (!email || !code) return res.json({ ok: false, error: "Connexion requise" });
  if (!match || !match.home || !match.away) return res.json({ ok: false, error: "Données du match manquantes" });

  const auth = verifyCode(email, code);
  if (!auth.valid) return res.json({ ok: false, error: auth.error || "Code invalide" });
  if (auth.plan === "free") return res.json({ ok: false, error: "UPGRADE_REQUIRED", plan: "free" });
  const allowAdminFields = isAdminAccess(email, code);

  // Check credits (credits_max=0 means unlimited)
  const today = new Date().toISOString().slice(0, 10);
  if (auth.credits_left !== null && auth.credits_left !== undefined && auth.credits_left <= 0) {
    return res.json({ ok: false, error: "CREDITS_EXHAUSTED", credits_left: 0 });
  }

  const verifiedMatch = await requireVerifiedLiveMatch(match);
  if (!verifiedMatch) return res.json({ ok: false, error: "Match live non verifie" });
  if (rejectScoreConflict(verifiedMatch, res)) return;
  const blockReason = livePickBlockReason(verifiedMatch);
  if (blockReason) return res.json({ ok: false, error: blockReason });

  const forceRefresh = req.body.force === true || req.body.force === 1 || req.body.force === "1";
  // Cache partagé par match+état (pas par user) pour économiser les tokens Groq
  const scoreState = verifiedMatch.score_home !== null ? `${verifiedMatch.score_home}-${verifiedMatch.score_away}_${Math.floor((verifiedMatch.minute || 0) / 15)}` : "prematch";
  const cacheKey = `${verifiedMatch.id || `${verifiedMatch.home}_${verifiedMatch.away}`}_${today}_${scoreState}`;
  if (!forceRefresh && analysisCache.has(cacheKey)) {
    return res.json({ ok: true, ...sanitizeAnalysisForClient(analysisCache.get(cacheKey), allowAdminFields), cached: true });
  }
  if (forceRefresh) analysisCache.delete(cacheKey);

  try {
    const analysis = await runConcileAnalysis(verifiedMatch);
    analysisCache.set(cacheKey, analysis);
    // Cache 30 min pour les matchs live (pas 6h — le score change !)
    const cacheTTL = verifiedMatch.status === "IN_PLAY" ? 30 * 60 * 1000 : 6 * 60 * 60 * 1000;
    setTimeout(() => analysisCache.delete(cacheKey), cacheTTL);

    // Decrement credits in codes.db (only on real analysis, not cache hit)
    try {
      const wdb = new Database(CODES_DB_PATH);
      const row = wdb.prepare("SELECT credits_max, credits_used, credits_date FROM codes WHERE code = ? AND email = ? AND active = 1")
        .get(code.toUpperCase().trim(), email.toLowerCase().trim());
      if (row && row.credits_max > 0) {
        if (row.credits_date === today) {
          wdb.prepare("UPDATE codes SET credits_used = credits_used + 1 WHERE code = ? AND email = ?")
            .run(code.toUpperCase().trim(), email.toLowerCase().trim());
        } else {
          wdb.prepare("UPDATE codes SET credits_used = 1, credits_date = ? WHERE code = ? AND email = ?")
            .run(today, code.toUpperCase().trim(), email.toLowerCase().trim());
        }
      }
      wdb.close();
    } catch(ce) { console.error("[concile-analysis] credits error:", ce.message); }

    // Compteur de jetons pour l'affichage (jetons restants aujourd'hui). Les
    // comptes admin (illimités) n'ont pas de compteur.
    let creditFields = {};
    if (!allowAdminFields) {
      try {
        const rdb = new Database(CODES_DB_PATH, { readonly: true });
        const cr = rdb.prepare("SELECT plan, credits_max, credits_used, credits_date FROM codes WHERE code = ? AND email = ? AND active = 1")
          .get(code.toUpperCase().trim(), email.toLowerCase().trim());
        rdb.close();
        if (cr && cr.credits_max > 0) {
          creditFields = { credits_left: creditsLeftForPlan(cr.plan, cr.credits_max, cr.credits_used, cr.credits_date), credits_max: cr.credits_max };
        }
      } catch(_) {}
    }

    res.json({ ok: true, ...sanitizeAnalysisForClient(analysis, allowAdminFields), ...creditFields });
  } catch (e) {
    res.json({ ok: false, error: "Erreur d'analyse — réessaie" });
  }
});

// ── Pre-match analysis (homepage pick, avant coup d'envoi) ───────────────────
app.post("/prematch-analysis", async (req, res) => {
  const { email, code, match } = req.body || {};
  if (!email || !code) return res.json({ ok: false, error: "Connexion requise" });
  if (!match || !match.home || !match.away) return res.json({ ok: false, error: "Données du match manquantes" });

  const auth = verifyCode(email, code);
  if (!auth.valid) return res.json({ ok: false, error: auth.error || "Code invalide" });
  if (auth.plan === "free") return res.json({ ok: false, error: "UPGRADE_REQUIRED", plan: "free" });
  const allowAdminFields = isAdminAccess(email, code);

  if (auth.credits_left !== null && auth.credits_left !== undefined && auth.credits_left <= 0) {
    return res.json({ ok: false, error: "CREDITS_EXHAUSTED", credits_left: 0 });
  }

  const today2 = new Date().toISOString().slice(0, 10);
  // Cache partagé par match+jour (pas par user) pour économiser les tokens Groq
  const cacheKey = `prematch__${match.home}_${match.away}_${match.date || today2}`;
  if (analysisCache.has(cacheKey)) {
    return res.json({ ok: true, ...sanitizeAnalysisForClient(analysisCache.get(cacheKey), allowAdminFields), cached: true });
  }

  try {
    const matchData = {
      home: match.home,
      away: match.away,
      score_home: 0,
      score_away: 0,
      minute: "Pré-match",
      status: "SCHEDULED",
      competition: match.competition || "International",
    };
    const analysis = await runConcileAnalysis(matchData);
    analysisCache.set(cacheKey, analysis);
    setTimeout(() => analysisCache.delete(cacheKey), 12 * 60 * 60 * 1000);

    // Decrement credits
    try {
      const wdb2 = new Database(CODES_DB_PATH);
      const row2 = wdb2.prepare("SELECT credits_max, credits_used, credits_date FROM codes WHERE code = ? AND email = ? AND active = 1")
        .get(code.toUpperCase().trim(), email.toLowerCase().trim());
      if (row2 && row2.credits_max > 0) {
        if (row2.credits_date === today2) {
          wdb2.prepare("UPDATE codes SET credits_used = credits_used + 1 WHERE code = ? AND email = ?")
            .run(code.toUpperCase().trim(), email.toLowerCase().trim());
        } else {
          wdb2.prepare("UPDATE codes SET credits_used = 1, credits_date = ? WHERE code = ? AND email = ?")
            .run(today2, code.toUpperCase().trim(), email.toLowerCase().trim());
        }
      }
      wdb2.close();
    } catch(ce2) { console.error("[prematch-analysis] credits error:", ce2.message); }

    res.json({ ok: true, ...sanitizeAnalysisForClient(analysis, allowAdminFields) });
  } catch (e) {
    console.error("[prematch-analysis]", e.message);
    res.json({ ok: false, error: "Erreur d'analyse — réessaie" });
  }
});

// ── Stripe ────────────────────────────────────────────────────────────────────
app.post("/stripe/create-checkout", authMiddleware, async (req, res) => {
  const { price_id } = req.body || {};
  if (!price_id || !STRIPE_SECRET_KEY) return res.json({ ok: false, error: "Configuration Stripe manquante" });

  const planLookup = { [STRIPE_PRICE_ID_CARTE]: "carte", [STRIPE_PRICE_ID_PREMIUM]: "premium", [STRIPE_PRICE_ID_VIP]: "vip", [STRIPE_PRICE_ID_ELITE]: "elite" };
  const planName = planLookup[price_id] || "premium";

  try {
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `https://www.touslesmatchs.com/live-ia?success=1&plan=${planName}`,
      cancel_url: "https://www.touslesmatchs.com/subscription",
      client_reference_id: String(req.user.id),
      customer_email: req.user.email,
    });
    res.json({ ok: true, url: session.url });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Stripe webhook — activate subscription
app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!STRIPE_SECRET_KEY) return res.json({ ok: false });

  // Echec ferme : sans STRIPE_WEBHOOK_SECRET, un POST non signe etait accepte
  // tel quel (JSON.parse direct) — n'importe qui aurait pu forger un faux
  // "checkout.session.completed" et se creer un code Elite gratuit. Trouve
  // lors de la revue de securite du 01/08/2026 ; jamais exploite en prod
  // (la cle est presente), corrige par prudence.
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET manquant — webhook rejete (echec ferme)");
    return res.status(500).json({ error: "Configuration webhook manquante" });
  }

  let event;
  try {
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // ── Verrou anti-rejeu ───────────────────────────────────────────────────────
  // Placé APRÈS la vérification de signature (jamais avant : sinon n'importe qui
  // pourrait saturer la table). On répond 200 à un rejeu pour que Stripe cesse
  // de réessayer — un 4xx/5xx le ferait au contraire recommencer en boucle.
  if (event.id) {
    try {
      const claim = db.prepare(
        "INSERT OR IGNORE INTO stripe_processed_events (event_id, event_type) VALUES (?,?)"
      ).run(event.id, event.type || "");
      if (claim.changes === 0) {
        console.log(`[stripe] événement ${event.id} (${event.type}) déjà traité — rejeu ignoré`);
        return res.json({ received: true, duplicate: true });
      }
    } catch (e) {
      // Un incident sur la table de verrou ne doit jamais bloquer un paiement :
      // on journalise et on laisse passer (comportement d'avant ce garde-fou).
      console.error("[stripe] verrou idempotence indisponible:", e.message);
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // ── Récupérer email client et prix ──────────────────────────────────────
    const customerEmail = (session.customer_details?.email || session.customer_email || "").toLowerCase().trim();
    let priceId = "";
    try {
      const Stripe2 = require("stripe");
      const stripe2 = Stripe2(STRIPE_SECRET_KEY);
      const full = await stripe2.checkout.sessions.retrieve(session.id, { expand: ["line_items"] });
      priceId = full.line_items?.data?.[0]?.price?.id || "";
    } catch(e) { console.error("[stripe] retrieve error:", e.message); }

    const planMap = {
      [STRIPE_PRICE_ID_CARTE]:    { status: "carte",    label: "Analyse 1 euro", durationDays: 1 },
      [STRIPE_PRICE_ID_STANDARD]: { status: "standard", label: "Standard",       durationDays: 32 },
      [STRIPE_PRICE_ID_PREMIUM]: { status: "premium", label: "Pro",            durationDays: 32 },
      [STRIPE_PRICE_ID_VIP]:     { status: "vip",     label: "VIP",            durationDays: 32 },
      [STRIPE_PRICE_ID_ELITE]:   { status: "elite",   label: "Elite",          durationDays: 32 },
    };
    const { status = "premium", label: planLabel = "Pro", durationDays = 32 } = planMap[priceId] || {};

    // ── Mettre à jour users table si userId connu ────────────────────────────
    const userId = parseInt(session.client_reference_id);
    if (userId) {
      db.prepare("UPDATE users SET status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?").run(
        status, session.customer, session.subscription, userId
      );
      const limit = TOKEN_LIMITS[status] || 0;
      db.prepare("INSERT OR REPLACE INTO user_tokens (user_id, tokens_today, reset_date) VALUES (?,?,?)").run(userId, limit, getTodayStr());
    }

    // "carte" (jeton 1€) : si le client a déjà un abonnement actif, on lui
    // crédite +1 jeton dessus au lieu de lui créer un second compte séparé.
    if (customerEmail && status === "carte" && grantCarteCreditToExistingAccount(customerEmail)) {
      console.log(`[stripe] Jeton 1€ crédité sur le compte existant de ${customerEmail}`);
      return res.json({ received: true });
    }

    // ── Créer code d'accès dans codes.db si pas encore existant ─────────────
    if (customerEmail) {
      try {
        const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const newCode = Array.from({ length: 8 }, () => codeChars[Math.floor(Math.random() * codeChars.length)]).join("");
        const cdbw = new Database(CODES_DB_PATH);
        const existing = cdbw.prepare("SELECT code FROM codes WHERE email = ? AND plan = ? AND active = 1").get(customerEmail, status);
        // Offre de lancement Elite : +1 mois offert, uniquement pour un tout
        // premier abonnement (jamais renouvele en boucle a chaque paiement).
        const eliteBonusDays = (status === "elite" && ELITE_LAUNCH_BONUS_ENABLED && !existing) ? ELITE_LAUNCH_BONUS_DAYS : 0;
        const expiresAt = new Date(Date.now() + (durationDays + eliteBonusDays) * 86400000).toISOString().slice(0, 10);
        const creditsMax = defaultCreditsMaxForPlan(status);
        if (!existing) {
          cdbw.prepare(
            "INSERT INTO codes (code, email, plan, active, expires_at, credits_max, credits_used, credits_date, created_at, stripe_customer_id) VALUES (?,?,?,1,?,?,0,?,datetime('now'),?)"
          ).run(newCode, customerEmail, status, expiresAt, creditsMax, getTodayStr(), session.customer || null);
          console.log(`[stripe] Code créé: ${newCode} pour ${customerEmail} plan ${status}${eliteBonusDays ? ` (+${eliteBonusDays}j offerts, offre de lancement)` : ""}`);
          const tagStripe = status === "elite" ? "ELITE" : status === "vip" ? "VIP" : status.toUpperCase();
          brevoAddContact(customerEmail, tagStripe, "FR", null, {
            SUBSCRIPTION_STATUS: "active",
            STRIPE_CUSTOMER_ID: session.customer || "",
            SOURCE: "stripe",
            CREATED_AT: new Date().toISOString(),
          }).catch(() => {});
        } else if (session.customer) {
          // Renseigne stripe_customer_id meme sur un compte deja cree avant ce champ
          // (migration retroactive douce, sans casser les codes existants).
          cdbw.prepare("UPDATE codes SET stripe_customer_id = ? WHERE email = ? AND plan = ? AND active = 1").run(session.customer, customerEmail, status);
        }
        cdbw.close();
      } catch(e) { console.error("[stripe] code creation error:", e.message); }
    }

    // ── Email de confirmation via Brevo ──────────────────────────────────────
    if (customerEmail && BREVO_API_KEY) {
      (async () => {
        try {
          const cdb = new Database(CODES_DB_PATH, { readonly: true });
          const codeRows = cdb.prepare("SELECT code, plan FROM codes WHERE email = ? AND active = 1").all(customerEmail);
          cdb.close();

          const codeList = codeRows.map(r =>
            `<tr><td style="padding:8px 16px;font-family:monospace;font-size:18px;font-weight:800;letter-spacing:.08em;color:#eceaf4">${r.code}</td>
             <td style="padding:8px 16px;font-size:12px;color:#7b82a0">${r.plan.toUpperCase()}</td></tr>`
          ).join("");

          // Lien d'invitation unique vers le canal du palier acheté (Standard/Premium/Elite)
          let premiumTelegramBlock = "";
          if (["standard", "premium", "vip", "elite"].includes(status)) {
            const inviteLink = await createPremiumInviteLink(customerEmail, status);
            if (inviteLink) {
              premiumTelegramBlock = `<div style="background:linear-gradient(135deg,rgba(34,211,238,.1),rgba(79,70,229,.08));border:1px solid rgba(34,211,238,.25);border-radius:10px;padding:20px;margin-top:24px;text-align:center">
                  <div style="font-size:14px;font-weight:700;color:#22d3ee;margin-bottom:8px">📲 Ton acces au groupe Telegram premium</div>
                  <div style="font-size:12px;color:#7b82a0;margin-bottom:12px">Lien personnel a usage unique — ne le partage pas.<br>Tu y recois les signaux forts (confiance 80%+) en direct.</div>
                  <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(135deg,#22d3ee,#4f46e5);color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Rejoindre le groupe premium →</a>
                </div>`;
            } else {
              console.error(`[stripe] invite premium non généré pour ${customerEmail} — vérifier que le bot est admin du canal`);
            }
          }

          // "carte" (offre 1€) retiree du parcours actif le 29/07/2026 : la branche
          // d'upsell dediee est supprimee, seul un webhook historique pourrait encore
          // porter ce statut et tombe alors sur le cas par defaut ci-dessous (aucun
          // upsell affiche plutot qu'une offre qui n'existe plus).
          const upsellBlock = status === "premium"
            ? `<div style="background:linear-gradient(135deg,rgba(212,175,55,.1),rgba(245,200,66,.06));border:1px solid rgba(212,175,55,.25);border-radius:10px;padding:20px;margin-top:24px;text-align:center">
                <div style="font-size:14px;font-weight:700;color:#d4af37;margin-bottom:8px">Passe au niveau superieur</div>
                <div style="font-size:12px;color:#7b82a0;margin-bottom:12px">Elite / VIP : <b style="color:#eceaf4">30 signaux/jour football</b> + <b style="color:#d4af37">alertes Signal Fort automatiques</b>.<br>Les alertes seules valent le prix — <b style="color:#10b981">sans engagement</b>.</div>
                <a href="https://buy.stripe.com/4gM9AT5Nifk0gIA91c3VC07" style="display:inline-block;background:linear-gradient(135deg,#d4af37,#f5c842);color:#111;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Passer Elite / VIP — 29.90€/mois</a>
              </div>`
            : "";

          const html = `<div style="font-family:Inter,system-ui,sans-serif;max-width:540px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:36px;text-align:center">
              <div style="font-size:24px;font-weight:800;color:#fff">✅ Abonnement ${planLabel} active !</div>
              <div style="font-size:14px;color:rgba(255,255,255,.75);margin-top:6px">TousLesMatchs — 5 IA independantes. Aucune emotion, seulement des donnees.</div>
            </div>
            <div style="padding:32px">
              <p style="font-size:15px;margin:0 0 20px;color:#a8aec8">Merci pour ton abonnement ! Voici ton code d'acces :</p>
              <table style="width:100%;border-collapse:collapse;background:#0d1020;border-radius:10px;overflow:hidden;margin-bottom:24px">${codeList}</table>
              <p style="font-size:13px;color:#7b82a0;margin:0 0 20px">Utilise ce code sur <a href="https://touslesmatchs.com" style="color:#6366f1">touslesmatchs.com</a> → bouton "Se connecter" → entre ton email + ce code.</p>
              <div style="text-align:center">
                <a href="https://touslesmatchs.com/live-ia" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none">Acceder au Live IA →</a>
              </div>
              ${premiumTelegramBlock}
              ${upsellBlock}
              ${bookmakerEmailHtml()}
            </div>
          </div>`;

          await brevoSendEmail(customerEmail, `🎉 Ton abonnement ${planLabel} est actif — voici ton code`, html, { critical: true });
          console.log(`[stripe] Email confirmation envoyé à ${customerEmail}`);
        } catch(e) { console.error("[stripe] email error:", e.message); }
      })();
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    db.prepare("UPDATE users SET status = 'free' WHERE stripe_subscription_id = ?").run(sub.id);
  }

  // Renouvellement paye — jusqu'ici totalement absent : le code d'acces cree au
  // premier paiement (checkout.session.completed) n'etait JAMAIS prolonge aux
  // paiements suivants. Un abonne qui payait depuis des mois voyait son code
  // expirer au bout de 32 jours pile, meme abonnement toujours actif cote
  // Stripe. On aligne expires_at sur la fin de periode facturee par Stripe
  // (source de verite), en ABSOLU (jamais additif) : idempotent quel que soit
  // le nombre de fois ou l'evenement est rejoue. Constate lors de l'audit
  // Phase 4 du 01/08/2026.
  if (event.type === "invoice.paid") {
    const inv = event.data.object;
    const email = (inv.customer_email || "").toLowerCase().trim();
    const periodEnd = inv.lines?.data?.[0]?.period?.end || inv.period_end;
    if (email && periodEnd) {
      const expiresAt = new Date(periodEnd * 1000).toISOString().slice(0, 10);
      try {
        const cdbw = new Database(CODES_DB_PATH);
        const info = cdbw.prepare("UPDATE codes SET active = 1, expires_at = ? WHERE email = ? AND plan != 'free'").run(expiresAt, email);
        const renewedRow = cdbw.prepare("SELECT plan FROM codes WHERE email = ? AND active = 1 ORDER BY rowid DESC LIMIT 1").get(email);
        cdbw.close();
        if (info.changes > 0) {
          console.log(`[stripe] renouvellement: ${email} -> actif jusqu'au ${expiresAt} (${info.changes} code(s))`);
          if (renewedRow) {
            brevoAddContact(email, renewedRow.plan.toUpperCase(), "FR", null, {
              SUBSCRIPTION_STATUS: "active", PAYMENT_FAILED: "NO",
            }).catch(() => {});
          }
        }
      } catch (e) { console.error("[stripe] invoice.paid:", e.message); }
    }
  }

  // Changement de palier (upgrade/downgrade en cours d'abonnement, via le
  // portail client Stripe) — jusqu'ici jamais repercute : le code d'acces
  // gardait l'ancien plan indefiniment. Le prix Stripe (source de verite,
  // jamais un parametre fourni par le client) determine le nouveau palier.
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object;
    (async () => {
      try {
        const priceId = sub.items?.data?.[0]?.price?.id || "";
        const planMapSub = {
          [STRIPE_PRICE_ID_STANDARD]: "standard",
          [STRIPE_PRICE_ID_PREMIUM]: "premium",
          [STRIPE_PRICE_ID_VIP]: "vip",
          [STRIPE_PRICE_ID_ELITE]: "elite",
        };
        const newPlan = planMapSub[priceId];
        if (!newPlan) return;
        const Stripe4 = require("stripe");
        const stripe4 = Stripe4(STRIPE_SECRET_KEY);
        const customer = await stripe4.customers.retrieve(sub.customer);
        const email = (customer.email || "").toLowerCase().trim();
        if (!email) return;
        const cdbw = new Database(CODES_DB_PATH);
        const existingRow = cdbw.prepare("SELECT plan FROM codes WHERE email = ? AND active = 1 ORDER BY rowid DESC LIMIT 1").get(email);
        if (existingRow && existingRow.plan !== newPlan) {
          const creditsMax = newPlan === "elite" ? 30 : 10;
          cdbw.prepare("UPDATE codes SET plan = ?, credits_max = ? WHERE email = ? AND active = 1").run(newPlan, creditsMax, email);
          console.log(`[stripe] changement de palier: ${email} ${existingRow.plan} -> ${newPlan}`);
          if (TELEGRAM_ADMIN_CHAT_ID) {
            sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, `🔄 <b>Changement de palier Stripe</b>\n${email} : ${existingRow.plan} → ${newPlan}`).catch(() => {});
          }
        }
        cdbw.close();
        brevoAddContact(email, newPlan.toUpperCase(), "FR", null, {
          CANCEL_AT_PERIOD_END: sub.cancel_at_period_end ? "YES" : "NO",
          SUBSCRIPTION_END: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : "",
        }).catch(() => {});
      } catch (e) { console.error("[stripe] subscription.updated:", e.message); }
    })();
  }

  // Paiement de renouvellement refusé — jusqu'ici totalement invisible (aucune
  // alerte n'existait). Stripe réessaie automatiquement plusieurs fois avant
  // d'annuler l'abonnement (customer.subscription.deleted prendra le relais
  // le moment venu), donc on n'y touche pas l'accès ici — juste une alerte
  // pour que Greg puisse relancer le client si besoin. Constate via l'audit
  // du 01/08/2026.
  if (event.type === "invoice.payment_failed") {
    const inv = event.data.object;
    const email = (inv.customer_email || "").toLowerCase().trim();
    const amount = inv.amount_due ? (inv.amount_due / 100).toFixed(2) + "€" : "montant inconnu";
    console.log(`[stripe] paiement refusé: ${email || "email inconnu"} (${amount})`);
    if (email) {
      // PLAN reste le vrai palier du client (jamais un pseudo-statut) : Brevo
      // segmente sur PAYMENT_FAILED en plus, pas a la place, de PLAN.
      try {
        const cdbr = new Database(CODES_DB_PATH, { readonly: true });
        const codeRow = cdbr.prepare("SELECT plan FROM codes WHERE email = ? AND active = 1 ORDER BY rowid DESC LIMIT 1").get(email);
        cdbr.close();
        const tagPF = codeRow ? codeRow.plan.toUpperCase() : "FREE";
        brevoAddContact(email, tagPF, "FR", null, { PAYMENT_FAILED: "YES" }).catch(() => {});
      } catch (e) { console.error("[stripe] brevo payment_failed:", e.message); }
    }
    if (TELEGRAM_ADMIN_CHAT_ID) {
      sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, `⚠️ <b>Paiement Stripe refusé</b>\n${email || "email inconnu"} — ${amount}\nStripe va réessayer automatiquement.`)
        .catch(() => {});
    }
  }

  // Remboursement — l'argent est déjà reparti, l'accès doit s'arrêter tout de
  // suite (contrairement à une simple résiliation, qui va au bout de la
  // période déjà payée). Egalement invisible jusqu'ici.
  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const email = (charge.billing_details?.email || "").toLowerCase().trim();
    const amount = charge.amount_refunded ? (charge.amount_refunded / 100).toFixed(2) + "€" : "montant inconnu";
    console.log(`[stripe] remboursement: ${email || "email inconnu"} (${amount})`);
    if (email) {
      try { db.prepare("UPDATE users SET status = 'free' WHERE email = ?").run(email); } catch (e) { console.error("[stripe] refund users:", e.message); }
      try {
        const cdbw = new Database(CODES_DB_PATH);
        cdbw.prepare("UPDATE codes SET active = 0 WHERE email = ?").run(email);
        cdbw.close();
      } catch (e) { console.error("[stripe] refund codes:", e.message); }
      brevoAddContact(email, "FREE", "FR", null, { SUBSCRIPTION_STATUS: "cancelled" }).catch(() => {});
    }
    if (TELEGRAM_ADMIN_CHAT_ID) {
      sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, `🔴 <b>Remboursement Stripe</b>\n${email || "email inconnu"} — ${amount}\nAccès désactivé.`)
        .catch(() => {});
    }
  }

  res.json({ received: true });
});

async function handleCreateCheckout(req, res) {
  const { plan, user_id, email } = req.body || {};
  if (!STRIPE_SECRET_KEY) return res.json({ ok: false, error: "Configuration Stripe manquante" });

  // "carte" (offre 1€) retiree du parcours actif le 29/07/2026, decision fondateur
  // — reactivee le 04/08/2026, mais UNIQUEMENT pour le rachat de jeton depuis le
  // bouton "quota epuise" sur Live IA (voir CREDITS_EXHAUSTED cote front) : pas
  // remise en avant dans le tunnel de vente/marketing general.
  //
  // "standard" pointait par erreur vers STRIPE_PRICE_ID_PREMIUM : un appel a cet
  // endpoint pour Standard aurait facture le prix Premium. Corrige au passage —
  // constate le 29/07/2026, mais AUCUN bouton visible n'appelle cet endpoint (les
  // boutons d'abonnement utilisent des Payment Links Stripe directs), donc aucun
  // client n'a ete facture au mauvais prix par ce chemin precis.
  const priceMap = {
    carte:    STRIPE_PRICE_ID_CARTE,
    standard: STRIPE_PRICE_ID_STANDARD,
    premium:  STRIPE_PRICE_ID_PREMIUM,
    vip:      STRIPE_PRICE_ID_VIP,
    elite:    STRIPE_PRICE_ID_ELITE,
  };
  const priceId = priceMap[plan];
  if (!priceId) return res.json({ ok: false, error: "Plan inconnu" });

  try {
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    const mode = plan === "carte" ? "payment" : "subscription";
    const cleanEmail = String(email || "").toLowerCase().trim();
    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `https://www.touslesmatchs.com/live-ia?success=1&plan=${plan}`,
      cancel_url: "https://www.touslesmatchs.com/subscription",
      client_reference_id: String(user_id || ""),
      // Verrouille l'email a celui du compte connecte pour "carte" (rachat de
      // jeton) : sinon un acheteur qui saisit une autre adresse a la caisse
      // creerait un second compte au lieu de crediter le sien (voir
      // grantCarteCreditToExistingAccount) — constate le 04/08/2026.
      ...(cleanEmail ? { customer_email: cleanEmail } : {}),
    });
    res.json({ ok: true, url: session.url });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
}

// Legacy create-checkout accessible via /create-checkout et /api/create-checkout
app.post("/create-checkout", handleCreateCheckout);
app.post("/create-checkout", handleCreateCheckout);

// ── Community stats (Telegram member count) ───────────────────────────────────
let tgMemberCache = { count: null, ts: 0 };
app.get("/community-stats", async (req, res) => {
  if (process.env.SHOW_TELEGRAM_MEMBER_COUNT !== "true") {
    return res.json({ ok: false, members: null, hidden: true });
  }

  // Try multiple bot tokens — whichever is admin of the free channel
  const BOT_TOKEN = process.env.HERMES_ADMIN_TLM_BOT
    || process.env.TELEGRAM_BOT_TOKEN
    || process.env.BOT_TOKEN
    || "";
  const CHANNEL_ID = process.env.TELEGRAM_FREE_CHANNEL_ID
    || process.env.TELEGRAM_CHAT_ID
    || process.env.TELEGRAM_CHANNEL_ID
    || "@touslesmatchs_fr";

  // Cache 10 minutes
  if (tgMemberCache.count !== null && Date.now() - tgMemberCache.ts < 10 * 60 * 1000) {
    return res.json({ ok: true, members: tgMemberCache.count });
  }

  if (!BOT_TOKEN) {
    return res.json({ ok: false, members: null });
  }

  try {
    const tgUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMembersCount?chat_id=${encodeURIComponent(CHANNEL_ID)}`;
    const data = await new Promise((resolve, reject) => {
      https.get(tgUrl, r => {
        let body = "";
        r.on("data", c => body += c);
        r.on("end", () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
      }).on("error", reject);
    });
    if (data.ok && data.result) {
      tgMemberCache = { count: data.result, ts: Date.now() };
      return res.json({ ok: true, members: data.result });
    }
    res.json({ ok: false, members: null });
  } catch(e) {
    console.error("[community-stats]", e.message);
    res.json({ ok: false, members: null });
  }
});

// ── Concile performance — boucle d'apprentissage ──────────────────────────────
app.get("/concile-performance", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  res.json({ ok: true, ...getConcilePerformance() });
});

// ── Shadow eval — classement des IAs candidates ───────────────────────────────
// ── Prono stats — classement par type de pari + agent ────────────────────────
app.get("/admin/prono-stats", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  res.json({ ok: true, ...getPronoStats() });
});

app.post("/internal/prono-stats", (req, res) => {
  const { secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false, error: "Forbidden" });
  res.json({ ok: true, ...getPronoStats() });
});

app.get("/admin/shadow-perf", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  try {
    const byAgent = db.prepare(`
      SELECT agent_name,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) as pending,
        ROUND(AVG(confidence),1) as avg_confidence,
        MIN(created_at) as first_eval,
        MAX(created_at) as last_eval
      FROM shadow_evals
      GROUP BY agent_name
    `).all();

    const withStats = byAgent.map(r => ({
      ...r,
      winrate: r.total > 0 ? Math.round((r.wins / Math.max(1, r.wins + r.losses)) * 100) : null,
      resolved: r.wins + r.losses,
      days_active: r.first_eval ? Math.ceil((Date.now() - new Date(r.first_eval).getTime()) / 86400000) : 0,
    }))
      // Classement par taux de réussite (pas par nombre brut de victoires) :
      // une IA à 90% sur 10 paris doit passer avant une IA à 50% sur 30 paris.
      .sort((a, b) => {
        if (a.winrate !== null && b.winrate !== null) return b.winrate - a.winrate;
        if (a.winrate !== null) return -1;
        if (b.winrate !== null) return 1;
        return b.total - a.total;
      });

    const recentEvals = db.prepare(`
      SELECT agent_name, home, away, competition, bet, confidence, outcome, created_at
      FROM shadow_evals
      ORDER BY created_at DESC
      LIMIT 50
    `).all();

    const activeAgents = SHADOW_AGENTS.map(a => ({ name: a.name, icon: a.icon, active: a.enabled() }));

    res.json({ ok: true, agents: withStats, recent: recentEvals, configured: activeAgents });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Agent performance — classement public ────────────────────────────────────
app.get("/strategy-dashboard", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  res.json({ ok: true, ...getStrategyDashboard() });
});

app.post("/internal/strategy-report", (req, res) => {
  const { secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  res.json({ ok: true, ...getStrategyDashboard() });
});

app.post("/internal/strong-signals", (req, res) => {
  const { secret, threshold, minResolved, limit } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  res.json({
    ok: true,
    threshold: Number(threshold || 80),
    minResolved: Number(minResolved || 5),
    signals: getStrongSignalAlerts({ threshold, minResolved, limit }),
  });
});


// ── Statistiques publiques réelles utilisées par le site et l'application ──
app.get("/public-analysis-stats", (req, res) => {
  try {
    const agentTotals = db.prepare(`
      SELECT
        COUNT(DISTINCT match_key) AS matches_tracked,
        COUNT(*) AS predictions_tracked,
        SUM(CASE WHEN outcome IN ('win','loss') THEN 1 ELSE 0 END)
          AS predictions_resolved
      FROM agent_predictions
    `).get() || {};

    const concileTotals = db.prepare(`
      SELECT
        COUNT(*) AS concile_analyses,
        SUM(CASE WHEN outcome IN ('win','loss') THEN 1 ELSE 0 END)
          AS concile_resolved
      FROM concile_analyses
    `).get() || {};

    const dailyAgent = db.prepare(`
      SELECT
        date(created_at) AS jour,
        COUNT(DISTINCT match_key) AS matches,
        COUNT(*) AS predictions,
        SUM(CASE WHEN outcome IN ('win','loss') THEN 1 ELSE 0 END)
          AS resolved
      FROM agent_predictions
      WHERE created_at IS NOT NULL
      GROUP BY date(created_at)
      ORDER BY jour ASC
    `).all();

    const dailyConcile = db.prepare(`
      SELECT
        date(analysed_at) AS jour,
        COUNT(*) AS analyses,
        SUM(CASE WHEN outcome IN ('win','loss') THEN 1 ELSE 0 END)
          AS resolved
      FROM concile_analyses
      WHERE analysed_at IS NOT NULL
      GROUP BY date(analysed_at)
      ORDER BY jour ASC
    `).all();

    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      matches_tracked: Number(agentTotals.matches_tracked || 0),
      predictions_tracked: Number(agentTotals.predictions_tracked || 0),
      predictions_resolved: Number(agentTotals.predictions_resolved || 0),
      concile_analyses: Number(concileTotals.concile_analyses || 0),
      concile_resolved: Number(concileTotals.concile_resolved || 0),
      daily_agent: dailyAgent,
      daily_concile: dailyConcile
    });
  } catch (error) {
    console.error("[public-analysis-stats]", error.message);
    res.status(500).json({
      ok: false,
      error: "Statistiques temporairement indisponibles"
    });
  }
});

app.get("/agent-performance", (req, res) => {
  const { email, code } = req.query;
  const auth = verifyCode(email, code);
  if (!auth.valid || (auth.plan !== "elite" && !isAdminAccess(email, code))) return res.status(403).json({ ok: false, error: "Acces Elite requis" });
  const perf = getAgentPerformance();
  try {
    const meta = db.prepare(`
      SELECT
        COUNT(DISTINCT home || '|' || away || '|' || date(created_at)) as matches_tracked,
        COUNT(DISTINCT match_key) as snapshots_tracked,
        COUNT(*) as predictions_tracked,
        SUM(CASE WHEN outcome IS NOT NULL THEN 1 ELSE 0 END) as predictions_resolved
      FROM agent_predictions
    `).get();
    const pending = db.prepare(
      "SELECT match_key, home, away, COUNT(*) as n FROM agent_predictions WHERE outcome IS NULL GROUP BY match_key ORDER BY created_at DESC LIMIT 5"
    ).all();
    res.json({ ok: true, performance: perf, meta, pending_matches: pending });
  } catch(e) {
    res.json({ ok: true, performance: perf, meta: {}, pending_matches: [] });
  }
});

// ── Matrice IA × marché — quelle IA est forte sur quel type de pari ──────────
app.get("/agent-market-matrix", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  try {
    const rows = db.prepare(`
      SELECT agent_name, market_line,
        COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses,
        SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) pending
      FROM agent_market_predictions
      GROUP BY agent_name, market_line
    `).all();
    const lineLabels = { buts: "Over/Under 2.5", btts: "BTTS", resultat: "Résultat 1X2", mt1: "But 1ère MT" };
    const matrix = {};
    const bestByLine = {};
    rows.forEach(r => {
      const resolved = r.wins + r.losses;
      const winrate = resolved > 0 ? Math.round(r.wins / resolved * 100) : null;
      if (!matrix[r.agent_name]) matrix[r.agent_name] = {};
      matrix[r.agent_name][r.market_line] = { label: lineLabels[r.market_line] || r.market_line, total: r.total, wins: r.wins, losses: r.losses, pending: r.pending, resolved, winrate };
      // Meilleure IA par marché (min 5 résolus)
      if (resolved >= 5 && winrate !== null) {
        if (!bestByLine[r.market_line] || winrate > bestByLine[r.market_line].winrate) {
          bestByLine[r.market_line] = { agent: r.agent_name, winrate, resolved, label: lineLabels[r.market_line] || r.market_line };
        }
      }
    });
    res.json({ ok: true, matrix, best_by_market: bestByLine });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ── Admin — matrice IA x marche x CHAMPIONNAT (troisieme niveau) ─────────────
// Demande de Greg le 02/08/2026 : "quelle IA est plus forte sur quel type de
// pari ET quel championnat" — /agent-market-matrix ci-dessus n'a que 2
// dimensions (agent x marche). Celui-ci ajoute le championnat, avec un
// minimum de 15 resolus pour eviter d'afficher un "100% winrate" sur 2 matchs.
app.get("/admin/agent-market-competition-matrix", (req, res) => {
  const { email, code } = req.query || {};
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  try {
    const minResolved = Math.max(1, parseInt(req.query.min) || 15);
    const rows = db.prepare(`
      SELECT agent_name, market_line, competition,
        COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins
      FROM agent_market_predictions
      WHERE outcome IS NOT NULL AND competition IS NOT NULL
      GROUP BY agent_name, market_line, competition
      HAVING total >= ?
      ORDER BY total DESC
    `).all(minResolved);
    const lineLabels = { buts: "Over/Under 2.5", btts: "BTTS", resultat: "Résultat 1X2", mt1: "But 1ère MT" };
    const rangs = rows.map(r => ({
      agent: r.agent_name,
      marche: lineLabels[r.market_line] || r.market_line,
      championnat: r.competition,
      resolus: r.total,
      winrate: Math.round((r.wins / r.total) * 10000) / 100,
    }));
    // Meilleure IA par (marché, championnat) — la reponse directe a la question de Greg.
    const meilleureParCombo = {};
    for (const r of rangs) {
      const k = `${r.marche} · ${r.championnat}`;
      if (!meilleureParCombo[k] || r.winrate > meilleureParCombo[k].winrate) {
        meilleureParCombo[k] = { agent: r.agent, winrate: r.winrate, resolus: r.resolus };
      }
    }
    res.json({
      ok: true,
      seuil_min_resolus: minResolved,
      combinaisons_couvertes: rangs.length,
      meilleure_ia_par_marche_x_championnat: meilleureParCombo,
      details: rangs,
    });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ── Admin — forcer résolution manuelle d'un match ────────────────────────────
app.get("/public-history", (req, res) => {
  res.json({ ok: true, items: getPublicHistoryItems() });
});

app.post("/admin/resolve-match", (req, res) => {
  const { email, code, home, away, score_home, score_away } = req.body || {};
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  if (!home || !away || score_home === undefined || score_away === undefined) {
    return res.json({ ok: false, error: "home, away, score_home, score_away requis" });
  }
  autoResolvePredictions({ home, away, score_home: Number(score_home), score_away: Number(score_away), status: "FINISHED" });
  res.json({ ok: true, message: `Résolution lancée pour ${home} vs ${away} (${score_home}-${score_away})` });
});

// Forcer le rattrapage de TOUTES les prédictions en attente (matchs finis)
app.post("/admin/resolve-stale", async (req, res) => {
  const { email, code } = req.body || {};
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  const countPending = () => db.prepare(`
    SELECT (SELECT COUNT(*) FROM agent_predictions WHERE outcome IS NULL)
         + (SELECT COUNT(*) FROM agent_market_predictions WHERE outcome IS NULL) AS n
  `).get().n;
  const before = countPending();
  await resolveStalePredictions();
  const after = countPending();
  res.json({ ok: true, resolved: before - after, pending_before: before, pending_after: after });
});

// Audit complet : perf de CHAQUE IA (officielles + shadow "IA blanches"), matrice
// IA×marché, meilleur agent par type de pari — le tout envoyé sur Telegram Hermes Admin.
app.get("/admin/full-agents-audit", async (req, res) => {
  const { email, code } = req.query || {};
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  try {
    // 1) IA officielles (vote + décision) — depuis agent_predictions
    const officialAgents = db.prepare(`
      SELECT agent_name,
        COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses,
        SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) pending,
        ROUND(AVG(confidence),0) avg_conf
      FROM agent_predictions
      GROUP BY agent_name
    `).all().map(r => {
      const resolved = r.wins + r.losses;
      return { ...r, resolved, winrate: resolved > 0 ? Math.round(r.wins / resolved * 100) : null };
    }).sort((a, b) => (b.winrate ?? -1) - (a.winrate ?? -1));

    // 2) IA blanches (banc d'essai) — depuis shadow_evals, jamais publiées
    const shadowAgents = db.prepare(`
      SELECT agent_name,
        COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses,
        SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) pending,
        ROUND(AVG(confidence),0) avg_conf
      FROM shadow_evals
      GROUP BY agent_name
    `).all().map(r => {
      const resolved = r.wins + r.losses;
      return { ...r, resolved, winrate: resolved > 0 ? Math.round(r.wins / resolved * 100) : null };
    }).sort((a, b) => (b.winrate ?? -1) - (a.winrate ?? -1));

    // 3) Matrice IA × type de pari — quelle IA est meilleure sur quoi
    const matrixRows = db.prepare(`
      SELECT agent_name, market_line,
        COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM agent_market_predictions
      GROUP BY agent_name, market_line
    `).all();
    const lineLabels = { buts: "Over/Under 2.5", btts: "BTTS", resultat: "Résultat 1X2", mt1: "But 1ère MT" };
    const bestByMarket = {};
    matrixRows.forEach(r => {
      const resolved = r.wins + r.losses;
      if (resolved < 5) return;                       // seuil : min 5 résolus pour avis fiable
      const wr = Math.round(r.wins / resolved * 100);
      if (!bestByMarket[r.market_line] || wr > bestByMarket[r.market_line].winrate) {
        bestByMarket[r.market_line] = { agent: r.agent_name, winrate: wr, resolved, label: lineLabels[r.market_line] || r.market_line };
      }
    });

    // 4) Formater le message Telegram
    const fmtAgent = (a) => `  ${a.winrate !== null ? `${a.winrate}%` : "n/a"} — ${a.agent_name} (${a.wins}W/${a.losses}L, ${a.pending} en attente, conf. moy ${a.avg_conf || 0}%)`;
    const officialBlock = officialAgents.length ? officialAgents.map(fmtAgent).join("\n") : "  (aucune donnée)";
    const shadowBlock   = shadowAgents.length   ? shadowAgents.map(fmtAgent).join("\n")   : "  (aucune donnée)";
    const bestBlock = Object.keys(bestByMarket).length
      ? Object.values(bestByMarket).map(b => `  🏆 ${b.label} → <b>${b.agent}</b> (${b.winrate}% sur ${b.resolved})`).join("\n")
      : "  (pas assez de données ≥5 résolus par marché)";

    const msg = [
      `🧠 <b>AUDIT COMPLET DES IA</b>`,
      `📅 ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      ``,
      `<b>🎯 IA officielles (Concile)</b>`,
      officialBlock,
      ``,
      `<b>⚪ IA blanches (banc d'essai)</b>`,
      shadowBlock,
      ``,
      `<b>🏆 Meilleure IA par type de pari</b>`,
      bestBlock,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `Verrou v1918412 · règles R1/R2 actives`,
    ].join("\n");

    let telegramSent = false;
    if (TELEGRAM_ADMIN_CHAT_ID) {
      telegramSent = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, msg);
    }

    res.json({
      ok: true,
      telegram_sent: telegramSent,
      official_agents: officialAgents,
      shadow_agents: shadowAgents,
      best_by_market: bestByMarket,
      message_preview: msg,
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Audit quotidien : tous les pronos du jour (résolus + en attente) avec score final
// Utilisé pour valider "il manque X résultats" — vue exhaustive et transparente.
app.get("/admin/daily-audit", (req, res) => {
  const { email, code } = req.query || {};
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  const day = (req.query.day || new Date().toISOString().slice(0, 10)).slice(0, 10);
  try {
    const rows = db.prepare(`
      SELECT id, home, away, competition, sport, best_bet, confidence,
             minute_at_analysis, score_home_at_analysis, score_away_at_analysis,
             final_score_home, final_score_away, outcome, analysed_at, resolved_at
      FROM concile_analyses
      WHERE substr(analysed_at,1,10) = ?
      ORDER BY analysed_at ASC
    `).all(day);
    const wins    = rows.filter(r => r.outcome === "win").length;
    const losses  = rows.filter(r => r.outcome === "loss").length;
    const pending = rows.filter(r => !r.outcome).length;
    res.json({
      ok: true, day, total: rows.length, wins, losses, pending,
      items: rows.map(r => ({
        id: r.id,
        match: `${r.home} vs ${r.away}`,
        competition: r.competition || r.sport || "",
        bet: r.best_bet,
        confidence: r.confidence,
        minute_at_analysis: r.minute_at_analysis,
        score_at_analysis: r.score_home_at_analysis != null
          ? `${r.score_home_at_analysis}-${r.score_away_at_analysis}` : null,
        final_score: r.final_score_home != null
          ? `${r.final_score_home}-${r.final_score_away}` : null,
        outcome: r.outcome || "pending",
        analysed_at: r.analysed_at,
        resolved_at: r.resolved_at,
        display: r.final_score_home != null && r.minute_at_analysis != null
          ? `Score final ${r.final_score_home}-${r.final_score_away}, ${r.best_bet} donné à la ${r.minute_at_analysis}e min`
          : null,
      })),
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Admin — envoyer rapport de statut sur Telegram Hermes Admin ──────────────
// ── Bot email Hermes (hermes@touslesmatchs.com) — brouillons validés à un clic
// depuis Telegram admin, jamais d'envoi automatique (voir hermes_mail_bot.js).
const hermesMailBot = require("./hermes_mail_bot");
const MAIL_BOT_ADMIN_TOKEN = process.env.MAIL_BOT_ADMIN_TOKEN || "";
const HERMES_MAIL_USER = process.env.HERMES_MAIL_USER || "";
const HERMES_MAIL_APP_PASSWORD = process.env.HERMES_MAIL_APP_PASSWORD || "";
const HERMES_MAIL_IMAP_HOST = process.env.HERMES_MAIL_IMAP_HOST || "imap.hostinger.com";
const HERMES_MAIL_IMAP_PORT = Number(process.env.HERMES_MAIL_IMAP_PORT || 993);
const HERMES_MAIL_SMTP_HOST = process.env.HERMES_MAIL_SMTP_HOST || "smtp.hostinger.com";
const HERMES_MAIL_SMTP_PORT = Number(process.env.HERMES_MAIL_SMTP_PORT || 465);
const SITE_BASE_URL = process.env.SITE_BASE_URL || "https://www.touslesmatchs.com";

function htmlAdminAction(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:sans-serif;background:#0b1220;color:#e5e7eb;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  div{text-align:center;padding:24px}</style></head><body><div><h2>${title}</h2><p>${message}</p></div></body></html>`;
}

app.get("/admin/mail-drafts/:id/approve", async (req, res) => {
  if (!MAIL_BOT_ADMIN_TOKEN || req.query.token !== MAIL_BOT_ADMIN_TOKEN) {
    return res.status(403).send(htmlAdminAction("Non autorisé", "Lien invalide."));
  }
  const result = await hermesMailBot.sendApprovedDraft(db, req.params.id, {
    smtpHost: HERMES_MAIL_SMTP_HOST, smtpPort: HERMES_MAIL_SMTP_PORT,
    user: HERMES_MAIL_USER, password: HERMES_MAIL_APP_PASSWORD,
  });
  if (result.ok) return res.send(htmlAdminAction("✅ Envoyé", "La réponse a bien été envoyée au client."));
  res.status(400).send(htmlAdminAction("Erreur", result.error || "Envoi impossible."));
});

app.get("/admin/mail-drafts/:id/reject", (req, res) => {
  if (!MAIL_BOT_ADMIN_TOKEN || req.query.token !== MAIL_BOT_ADMIN_TOKEN) {
    return res.status(403).send(htmlAdminAction("Non autorisé", "Lien invalide."));
  }
  const result = hermesMailBot.rejectDraft(db, req.params.id);
  if (result.ok) return res.send(htmlAdminAction("❌ Rejeté", "Le brouillon a été écarté, rien n'a été envoyé."));
  res.status(400).send(htmlAdminAction("Erreur", result.error || "Rejet impossible."));
});

if (HERMES_MAIL_USER && HERMES_MAIL_APP_PASSWORD) {
  const pollMailbox = () => {
    let stripeClient = null;
    try { if (STRIPE_SECRET_KEY) stripeClient = require("stripe")(STRIPE_SECRET_KEY); } catch {}
    hermesMailBot.pollHermesMailbox(db, {
      user: HERMES_MAIL_USER, password: HERMES_MAIL_APP_PASSWORD,
      imapHost: HERMES_MAIL_IMAP_HOST, imapPort: HERMES_MAIL_IMAP_PORT,
      stripe: stripeClient, brevoApiKey: BREVO_API_KEY, mistralApiKey: MISTRAL_API_KEY,
      analysisEngine, sendTelegramMessage, telegramAdminChatId: TELEGRAM_SUPPORT_CHAT_ID || TELEGRAM_ADMIN_CHAT_ID,
      siteBaseUrl: SITE_BASE_URL, adminToken: MAIL_BOT_ADMIN_TOKEN,
    }).catch(e => console.error("[hermes-mail] interval:", e.message));
  };
  setInterval(pollMailbox, 5 * 60000);
  setTimeout(pollMailbox, 15000);
  console.log("[hermes-mail] bot email actif (relève toutes les 5 min)");
} else {
  console.log("[hermes-mail] non configuré (HERMES_MAIL_USER/HERMES_MAIL_APP_PASSWORD absents) — inactif");
}

app.post("/admin/send-report", (req, res) => {
  const { email, code } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  if (!TELEGRAM_ADMIN_CHAT_ID) return res.json({ ok: false, error: "TELEGRAM_ADMIN_CHAT_ID non configuré" });

  const perf = getAgentPerformance();
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const agents = Object.entries(perf).map(([name, p]) => {
    const total = (p.wins || 0) + (p.losses || 0);
    const wr = total > 0 ? Math.round(p.wins / total * 100) : 0;
    const pending = p.pending || 0;
    const status = total >= 10 ? (wr >= 80 ? "✅" : "⚠️") : "🔄";
    return { name, wins: p.wins || 0, losses: p.losses || 0, total, wr, pending, status };
  }).sort((a, b) => b.wr - a.wr);

  const agentLines = agents.map(a =>
    `  ${a.status} ${a.name}: ${a.total > 0 ? `${a.wr}% (${a.wins}/${a.total})` : `${a.pending} en attente`}`
  ).join("\n");

  let meta = {};
  try {
    meta = db.prepare(`
      SELECT
        COUNT(DISTINCT home || '|' || away || '|' || date(created_at)) as matches,
        COUNT(*) as predictions,
        SUM(CASE WHEN outcome IS NOT NULL THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) as pending
      FROM agent_predictions
    `).get() || {};
  } catch(e) {}

  let pickInfo = "";
  try {
    const lastPick = db.prepare("SELECT * FROM picks ORDER BY rowid DESC LIMIT 1").get();
    if (lastPick) {
      pickInfo = `\n🎯 <b>Dernier pick :</b>\n  ${lastPick.home || ''} vs ${lastPick.away || ''}\n  ${lastPick.bet || ''} @ ${lastPick.odds || ''}\n  Confiance: ${lastPick.confidence || '?'}/10\n  Résultat: ${lastPick.result || 'en attente'}`;
    }
  } catch(e) {}

  const text = `📋 <b>RAPPORT HERMES — ${dateStr}</b>

🤖 <b>Performance des agents :</b>
${agentLines}

📊 <b>Données :</b>
  Matchs suivis : ${meta.matches || 0}
  Prédictions : ${meta.predictions || 0}
  Résolues : ${meta.resolved || 0}
  En attente : ${meta.pending || 0}
${pickInfo}

━━━━━━━━━━━━━━━━━━
🤖 Conseil IA TousLesMatchs — Rapport à la demande`;

  sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text).then(ok => {
    res.json({ ok, message: ok ? "Rapport envoyé sur Telegram admin" : "Échec envoi Telegram" });
  });
});

// ── Admin — bilan complet analyses gagnées/perdues sur Telegram admin ────────
async function sendStatsBilanTelegram() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return false;
  try {
    const threshold = getAdaptiveSignalThreshold();
    const raw = db.prepare(`
      SELECT home, away, competition, sport, best_bet, confidence, outcome,
             final_score_home, final_score_away, analysed_at
      FROM concile_analyses
      WHERE outcome IN ('win','loss')
      ORDER BY analysed_at DESC
    `).all();

    const seen = new Set();
    const all = [];
    for (const r of raw) {
      const key = `${r.home}_${r.away}_${(r.analysed_at || "").slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(r);
    }

    const wins = all.filter(r => r.outcome === "win");
    const losses = all.filter(r => r.outcome === "loss");
    const total = all.length;
    const winrate = total > 0 ? Math.round(wins.length / total * 100) : 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayAll = all.filter(r => r.analysed_at && r.analysed_at.startsWith(todayStr));
    const todayWins = todayAll.filter(r => r.outcome === "win").length;
    const todayLosses = todayAll.filter(r => r.outcome === "loss").length;

    const byComp = {};
    all.forEach(r => {
      const c = r.competition || "Inconnu";
      if (!byComp[c]) byComp[c] = { w: 0, l: 0 };
      if (r.outcome === "win") byComp[c].w++; else byComp[c].l++;
    });
    const compLines = Object.entries(byComp)
      .sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l))
      .slice(0, 15)
      .map(([c, s]) => {
        const t = s.w + s.l;
        const wr = Math.round(s.w / t * 100);
        const icon = wr >= 60 ? "✅" : wr >= 40 ? "⚠️" : "❌";
        return `${icon} ${c}: ${wr}% (${s.w}W/${s.l}L)`;
      }).join("\n");

    const recentLines = all.slice(0, 20).map(r => {
      const icon = r.outcome === "win" ? "✅" : "❌";
      const score = r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : "?";
      return `${icon} ${r.home} vs ${r.away} (${score}) — ${r.best_bet} @ ${r.confidence}%`;
    }).join("\n");

    const text = `📊 <b>BILAN COMPLET DES ANALYSES</b>

🎯 <b>Global :</b>
✅ Gagnés : <b>${wins.length}</b>
❌ Perdus : <b>${losses.length}</b>
📈 Winrate : <b>${winrate}%</b> (${total} analyses)
🎚 Seuil adaptatif : ${threshold}%

📅 <b>Aujourd'hui :</b>
✅ ${todayWins} gagné${todayWins > 1 ? "s" : ""} / ❌ ${todayLosses} perdu${todayLosses > 1 ? "s" : ""} (${todayAll.length} résolus)

🏆 <b>Par compétition (toutes) :</b>
${compLines}

📋 <b>20 dernières analyses :</b>
${recentLines}

━━━━━━━━━━━━━━━━━━
🤖 Conseil IA TousLesMatchs — Bilan quotidien 22h`;

    return await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text);
  } catch (e) {
    console.error("[bilan-stats]", e.message);
    return false;
  }
}

// Comparaison winrate pre-match (H2H, cotes plus grosses) vs live (auto-
// concile, contexte du score en direct) — demande de Greg le 02/08/2026.
app.get("/admin/source-type-stats", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorise" });
  try {
    const rows = db.prepare(`
      SELECT source_type,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IN ('win','loss')
      GROUP BY source_type
    `).all();
    res.json({ ok: true, stats: rows.map(r => ({
      source_type: r.source_type || "live",
      total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : 0,
    })) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get("/admin/send-gain-images", async (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorise" });
  sendDailyGainImages().catch((e) => console.error("[gain-image] admin trigger:", e.message));
  res.json({ ok: true, message: `Génération lancée (${DAILY_GAIN_IMAGE_PUBLIC ? "envoi public" : "aperçu admin"}) — vérifie Telegram dans 10-30s.` });
});

app.get("/admin/send-stats-bilan", async (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorise" });
  const ok = await sendStatsBilanTelegram();
  res.json({ ok, message: ok ? "Bilan envoye sur Telegram admin" : "Echec envoi" });
});

// ── Daily results summary → FREE Telegram channel (22h Paris) ────────────────
let _lastFreeResultsBilanDate = "";
async function sendDailyResultsFreeChannel() {
  if (!TELEGRAM_CHANNEL_ID || !TELEGRAM_BOT_TOKEN) return false;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    // diffusion_block IS NULL, PAS signal_tier IS NOT NULL : signal_tier est
    // une classification de confiance posee AVANT le filtre qualite/cote/
    // ligue/feminin (voir alreadySignaledToday plus haut, correction du
    // 02/08/2026 sur le meme malentendu — celui-la bloquait carrement tout
    // signal reel). diffusion_block est ecrit APRES tous les filtres :
    // null = vraiment diffuse, sinon le motif exact.
    const rows = db.prepare(`
      SELECT home, away, competition, sport, best_bet, confidence, outcome, real_odd,
             final_score_home, final_score_away
      FROM concile_analyses
      WHERE date(analysed_at) = ? AND outcome IN ('win','loss') AND diffusion_block IS NULL
      ORDER BY analysed_at DESC
    `).all(todayStr);

    // Dédoublonnage tolérant aux variantes de nom entre sources : sans lui, le
    // bilan diffusé affichait deux fois le même match, parfois avec deux
    // pronostics opposés, et calculait le winrate sur ces doublons.
    const unique = dedupeAnalysesByMatch(rows);
    if (unique.length < 3) return false;

    const wins = unique.filter(r => r.outcome === "win");
    const losses = unique.filter(r => r.outcome === "loss");
    const winrate = Math.round(wins.length / unique.length * 100);

    const sportIcons = { Football: "⚽", Basketball: "🏀", Hockey: "🏒", Baseball: "⚾" };
    const matchLines = unique.map(r => {
      const icon = r.outcome === "win" ? "✅" : "❌";
      const sportIcon = sportIcons[r.sport] || "🎯";
      const score = r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : "?";
      const cote = rowOdd(r);
      const gainStr = r.outcome === "win" ? `+${(10 * cote - 10).toFixed(0)}€` : "-10€";
      return `${icon}${sportIcon} ${r.home} vs ${r.away} (${score}) — ${r.best_bet} @ ${cote.toFixed(2)} → ${gainStr}`;
    }).join("\n");

    const totalGain = unique.reduce((sum, r) => {
      const cote = rowOdd(r);
      return sum + (r.outcome === "win" ? (10 * cote - 10) : -10);
    }, 0);

    const emoji = winrate >= 70 ? "🔥" : winrate >= 50 ? "📊" : "💪";
    const msg = [
      `${emoji} <b>RÉSULTATS DU JOUR — ${todayStr}</b>`,
      ``,
      `✅ <b>${wins.length} gagnés</b> / ❌ ${losses.length} perdus — <b>${winrate}% winrate</b>`,
      ``,
      matchLines,
      ``,
      `💰 <b>Bilan du jour à 10€/analyse : ${totalGain >= 0 ? "+" : ""}${totalGain.toFixed(0)}€</b>`,
      ``,
      winrate >= 60
        ? `🚀 Ces résultats sont réservés aux membres.\n👉 <a href="https://www.touslesmatchs.com/#plans">⚡ Recevoir tous les signaux dès 4,90€</a>`
        : `💪 La discipline fait la différence.\n👉 <a href="https://www.touslesmatchs.com/#plans">⚡ Recevoir tous les signaux dès 4,90€</a>`,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `🤖 Conseil IA — TousLesMatchs`,
      `⚠️ 18+ — Jeu responsable`,
    ].join("\n");

    const ok = await sendTelegramMessage(TELEGRAM_CHANNEL_ID, msg);
    console.log(`[daily-results-free] ${wins.length}W/${losses.length}L ${winrate}% — Telegram free: ${ok ? "OK" : "FAIL"}`);
    return ok;
  } catch (e) {
    console.error("[daily-results-free]", e.message);
    return false;
  }
}


// TLM_TRANSPARENT_RECAP_V1
// Bilan quotidien : UNIQUEMENT les signaux réellement envoyés.
// Les pertes sont conservées et affichées exactement comme les gains.
let _tlmTransparentRecapDay = "";

function tlmParisParts() {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const o={};
  for (const x of parts) o[x.type]=x.value;

  return {
    day:`${o.year}-${o.month}-${o.day}`,
    hour:Number(o.hour),
    minute:Number(o.minute),
  };
}

function tlmFlag(v) {
  return v === 1 || v === true;
}

function tlmOutcomeIcon(v) {
  return v === "win" ? "✅" : "❌";
}

async function sendTransparentDailyRecap() {
  const paris=tlmParisParts();

  let rows=[];

  try {
    rows=db.prepare(`
      SELECT
        home, away, competition, country, sport,
        best_bet, confidence, real_odd,
        outcome,
        final_score_home, final_score_away,
        minute_at_analysis,
        score_home_at_analysis, score_away_at_analysis,
        sig_sent_free, sig_sent_standard,
        sig_sent_premium, sig_sent_elite
      FROM concile_analyses
      WHERE date(analysed_at)=date('now')
        AND outcome IN ('win','loss')
        AND (
          sig_sent_free=1 OR
          sig_sent_standard=1 OR
          sig_sent_premium=1 OR
          sig_sent_elite=1
        )
      ORDER BY analysed_at ASC
    `).all();
  } catch(e) {
    console.error("[transparent-recap] lecture DB:",e.message);
    return false;
  }

  if (!rows.length) {
    console.log("[transparent-recap] aucun signal réellement diffusé aujourd'hui");
    return false;
  }

  function buildFor(channel) {
    const flagName="sig_sent_"+channel;

    const list=rows.filter(r=>tlmFlag(r[flagName]));

    if(!list.length) return null;

    const wins=list.filter(r=>r.outcome==="win").length;
    const losses=list.filter(r=>r.outcome==="loss").length;
    const rate=Math.round((wins/list.length)*1000)/10;

    const lines=list.map(r=>{
      const score=
        r.final_score_home!=null && r.final_score_away!=null
          ? `${r.final_score_home}-${r.final_score_away}`
          : "?";

      const country=r.country ? `🇺🇳 ${r.country} · ` : "";
      const comp=r.competition || "Championnat";

      return [
        `${tlmOutcomeIcon(r.outcome)} <b>${r.home} — ${r.away}</b>`,
        `⚽ ${country}${comp}`,
        `🎯 ${r.best_bet}`,
        `🏁 Score final : <b>${score}</b>`,
      ].join("\n");
    }).join("\n\n");

    return [
      // TELEGRAM_DAILY_PREVIEW_BALANCED_V1
      // Première ligne exacte mais volontairement longue : l'aperçu Telegram
      // met la réussite en contexte sans afficher le rouge avant l'ouverture.
      `📊 <b>BILAN DU JOUR · ✅ Gagnés : ${wins} · Signaux réellement diffusés : ${list.length} · Réussite : ${rate}% · Résultats complets dans le canal</b>`,
      ``,
      `⚽ Signaux réellement diffusés : <b>${list.length}</b>`,
      `✅ Gagnés : <b>${wins}</b>`,
      `❌ Perdus : <b>${losses}</b>`,
      `📈 Réussite : <b>${rate}%</b>`,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      lines,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `🤖 TousLesMatchs · Conseil IA`,
      `🔎 Résultats complets : gagnés comme perdus.`,
      `⚠️ 18+ · Jeu responsable`,
    ].join("\n");
  }

  const jobs=[];

  const free=buildFor("free");
  const standard=buildFor("standard");
  const premium=buildFor("premium");
  const elite=buildFor("elite");

  if(free && TELEGRAM_CHANNEL_ID)
    jobs.push(sendTelegramMessage(TELEGRAM_CHANNEL_ID,free));

  if(standard && TELEGRAM_STANDARD_CHANNEL_ID)
    jobs.push(sendTelegramMessage(TELEGRAM_STANDARD_CHANNEL_ID,standard));

  if(premium && TELEGRAM_PREMIUM_CHANNEL_ID)
    jobs.push(sendTelegramMessage(TELEGRAM_PREMIUM_CHANNEL_ID,premium));

  if(elite && TELEGRAM_ELITE_CHANNEL_ID)
    jobs.push(sendTelegramMessage(TELEGRAM_ELITE_CHANNEL_ID,elite));

  await Promise.all(jobs);

  console.log(
    `[transparent-recap] ${winsSafe(rows)} — ${rows.length} signaux résolus`
  );

  return true;
}

function winsSafe(rows) {
  const w=rows.filter(r=>r.outcome==="win").length;
  const l=rows.filter(r=>r.outcome==="loss").length;
  return `${w}W/${l}L`;
}

// Vérification chaque minute.
// Exécution UNE seule fois par journée à partir de 23h45 heure de Paris.
setInterval(()=>{
  try {
    const p=tlmParisParts();

    if(
      p.hour===23 &&
      p.minute>=45 &&
      _tlmTransparentRecapDay!==p.day
    ){
      _tlmTransparentRecapDay=p.day;

      sendTransparentDailyRecap()
        .then(ok=>console.log(
          `[transparent-recap] 23h45 Paris: ${ok ? "OK" : "SKIP"}`
        ))
        .catch(e=>console.error("[transparent-recap]",e.message));
    }
  } catch(e) {
    console.error("[transparent-recap-scheduler]",e.message);
  }
},60000);


// ── Analysis history (public, past concile analyses) ────────────────────────
// Colonne de diffusion correspondant au palier d'un membre. On filtre sur ce qui
// a RÉELLEMENT été envoyé sur son canal (sig_sent_*), pas sur des critères
// d'éligibilité théoriques : un abonné Standard doit voir les résultats des
// signaux qu'il a effectivement reçus, ni plus (pas les signaux Elite qu'il n'a
// pas eus) ni moins.
const SIG_COLUMN_BY_PLAN = {
  free:     "sig_sent_free",
  carte:    "sig_sent_free",
  standard: "sig_sent_standard",
  premium:  "sig_sent_premium",
  vip:      "sig_sent_premium",
  elite:    "sig_sent_elite",
};

app.get("/analysis-history", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;
  try {
    // ── Périmètre du lecteur ────────────────────────────────────────────────
    // Sans identifiants : vue publique inchangée (page /performances, preuve
    // marketing — la restreindre couperait l'argument de vente).
    // Avec identifiants : on ne montre que le palier réellement souscrit.
    const qEmail = req.query.email, qCode = req.query.code;
    let viewerPlan = null, isPaidViewer = false, viewerIsAdmin = false;
    if (qEmail && qCode) {
      try {
        const a = verifyCode(qEmail, qCode);
        viewerIsAdmin = isAdminAccess(qEmail, qCode);
        if (a.valid && a.plan) viewerPlan = String(a.plan).toLowerCase();
        else if (viewerIsAdmin) viewerPlan = "elite";
        isPaidViewer = (a.valid && a.plan && a.plan !== "free") || viewerIsAdmin;
      } catch (_) {}
    }
    // L'admin garde la vue complète (supervision), sinon on filtre sur le palier —
    // via tierEligible (critères qualité du palier), pas via les envois Telegram
    // réels (sig_sent_*) : ceux-ci sont plafonnés/jour et sous-représentaient
    // largement ce que le palier a vraiment mérité (signalé par Greg le
    // 03/08/2026 — la page affichait 2-3 lignes par palier alors que le Concile
    // tourne depuis des semaines). tierEligible est déjà la source du bloc
    // stats.tiers plus bas : on aligne la liste détaillée dessus pour cohérence.
    const tierFilter = (viewerPlan && !viewerIsAdmin) ? viewerPlan : null;
    // On charge les snapshots avant de dedoublonner : il faut d'abord identifier
    // l'instant exact reellement diffuse. Dedoublonner en SQL avant ce controle
    // selectionnait parfois un snapshot observe/non envoye du meme match.
    const rawRows = db.prepare(`
      SELECT id, match_key, home, away, competition, country, sport, best_bet, confidence, raison,
             consensus_votes, outcome, analysed_at, real_odd, real_odd_source,
             score_home_at_analysis, score_away_at_analysis, minute_at_analysis,
             final_score_home, final_score_away, resolved_at,
             home_logo, away_logo, bet_category,
             sig_sent_standard, sig_sent_premium, sig_sent_elite, sig_sent_free,
             diffusion_block,
             agents_json
      FROM concile_analyses
      WHERE date(analysed_at) >= '2026-07-03'
        AND confidence >= ${getPublishedMinConfidence()}
        AND (outcome IS NULL OR outcome != 'pending')
      ORDER BY analysed_at DESC
    `).all();
    // Cote client : une analyse n'entre dans l'historique que si elle a ete
    // envoyee sur au moins un canal payant ET respecte le contrat O/U 2,5 4/5.
    // Cette route alimente la page Resultats, y compris quand le fondateur est
    // connecte : elle doit donc rester identique pour tous les lecteurs. La vue
    // exhaustive de diagnostic reste disponible via /admin/daily-audit.
    const clientRows = rawRows.filter(isVerifiedClientOu25Row);
    const planChannel = tierFilter === "vip" ? "premium" : tierFilter === "carte" ? "free" : tierFilter;
    const planRows = planChannel
      ? clientRows.filter(r => displayDeliveryChannels(r).has(planChannel))
      : clientRows;
    const cleanedRows = dedupeAnalysesByMatch(planRows.filter(r => !isNoiseForDisplay(r)));
    const total = cleanedRows.length;
    const rows = cleanedRows.slice(offset, offset + limit);

    // isPaidViewer (résolu plus haut) : seuls les abonnés — ou l'admin — voient le
    // pick des analyses EN COURS. Les visiteurs voient les résultats passés
    // (preuve) mais pas les picks non résolus, sinon la réponse serait gratuite.

    // On montre tous les jours et tous les résultats, SAUF la couche indésirable :
    // jeunes (U17-U23), amateur/réserves, féminines et ligues douteuses/exotiques.
    // On GARDE UEFA (même qualif) + grandes ligues. Pas de masquage "+6h" ici,
    // donc aucun jour ne disparaît — on retire juste les matchs douteux.
    // Retrait de la couche indésirable (jeunes/féminines/douteuses) ; les
    // doublons sont déjà éliminés en SQL ci-dessus.
    // Le PARTITION BY SQL ne dedoublonne que sur des noms strictement egaux :
    // on repasse avec la comparaison tolerante aux variantes de source.
    const visibleRows = rows;

    // Palier le plus bas qui reçoit cette analyse (cf. tierEligible : miroir exact
    // des règles de diffusion Telegram). "hors-palier" = publiée sur le site mais
    // diffusée sur aucun canal payant (cote non réelle, hors ARJEL, sport non couvert).
    const tierLabel = (r) => {
      if (tierEligible(r, "standard")) return "standard";
      if (tierEligible(r, "premium")) return "premium";
      if (tierEligible(r, "elite")) return "elite";
      return "hors-palier";
    };

    const analyses = visibleRows.map(r => {
      let agents = [];
      try { agents = JSON.parse(r.agents_json || "[]"); } catch {}
      const ou25Proof = storedOu25Consensus(r);
      const deliveryProof = storedTelegramDelivery(r);
      const displayChannels = displayDeliveryChannels(r);
      const analysisDay = String(r.analysed_at || "").slice(0, 10);
      const historyMode = analysisDay >= CLIENT_TELEGRAM_PROOF_SINCE ? "telegram_proven" : "legacy";
      const resolved = r.outcome === "win" || r.outcome === "loss";
      const reveal = resolved || isPaidViewer; // pick visible si terminé OU abonné
      return {
        id: r.id,
        home: r.home, away: r.away,
        competition: r.competition, sport: r.sport || "Football",
        bet: reveal ? r.best_bet : null, confidence: r.confidence,
        cote: reveal ? rowOdd(r) : null,
        reasoning: reveal ? r.raison : null,
        consensus: historyMode === "legacy" ? Number(r.consensus_votes || 0) : ou25Proof.voteCount,
        locked: !reveal,
        outcome: r.outcome,
        analysed_at: r.analysed_at,
        score: r.score_home_at_analysis != null ? `${r.score_home_at_analysis}-${r.score_away_at_analysis}` : null,
        minute: r.minute_at_analysis,
        final_score: r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : null,
        resolved_at: r.resolved_at,
        home_logo: r.home_logo, away_logo: r.away_logo,
        bet_category: r.bet_category,
        arjel: rowIsArjel(r),
        tier: tierLabel(r),
        // Diffusion REELLE sur Telegram, a ne pas confondre avec `tier` :
        // tier dit a quel palier l'analyse CORRESPONDAIT (criteres de qualite),
        // ces champs disent sur quels canaux elle est REELLEMENT partie. Une
        // analyse peut satisfaire les criteres Elite sans avoir ete envoyee
        // (plafond journalier atteint, cote hors fenetre ARJEL au moment de
        // l'envoi...). Afficher `tier` en pretendant montrer la diffusion
        // induisait le visiteur en erreur — signale par Greg le 05/08/2026.
        sent: {
          standard: displayChannels.has("standard"),
          premium: displayChannels.has("premium"),
          elite: displayChannels.has("elite"),
          free: displayChannels.has("free"),
        },
        delivery_proven: deliveryProof.paid,
        history_mode: historyMode,
        // Motif lisible du non-envoi (null si le signal est bien parti).
        diffusion_block: r.diffusion_block || null,
        agents_count: agents.length,
      };
    });

    // Stats globales dédoublonnées (même logique que /premium-teaser) —
    // source unique pour que la page Live IA et la page d'accueil affichent
    // exactement le même winrate / nombre de picks.
    // sig_sent_* ajoutes le 08/08/2026 : sans eux, le benefice en euros et le
    // ROI affiches sur l'accueil et sur /performances etaient calcules sur
    // TOUTES les analyses publiees, diffusees ou non. Un visiteur lisait donc
    // comme gain d'abonne un resultat que personne n'avait recu.
    const allResolved = db.prepare(`
      SELECT match_key, home, away, competition, country, sport, outcome, analysed_at, confidence,
             best_bet, real_odd, real_odd_source, final_score_home, final_score_away,
             minute_at_analysis, consensus_votes,
             sig_sent_free, sig_sent_standard, sig_sent_premium, sig_sent_elite, diffusion_block
      FROM concile_analyses
      WHERE outcome IN ('win','loss') AND confidence >= ${getPublishedMinConfidence()}
        AND date(analysed_at) >= '2026-07-03'
      ORDER BY analysed_at DESC
    `).all();
    const seenStat = new Set();
    const dedupResolved = [];
    for (const r of allResolved) {
      // Mêmes exclusions que la liste (jeunes / douteuses) pour un winrate cohérent.
      if (isNoiseForDisplay(r) || !isVerifiedClientOu25Row(r)) continue;
      const k = `${r.home}_${r.away}_${(r.analysed_at || "").slice(0, 10)}`;
      if (seenStat.has(k)) continue;
      seenStat.add(k);
      dedupResolved.push(r);
    }

    // Bloc de stats sur un sous-ensemble : total/wins/losses/winrate + ROI simulé
    // (mise 10€), bénéfice, cote moyenne. Cohérent avec /premium-teaser (rowOdd).
    const statBlock = (set) => {
      let wins = 0, profit = 0, oddSum = 0;
      for (const r of set) {
        const cote = rowOdd(r);
        oddSum += cote;
        if (r.outcome === "win") { wins++; profit += 10 * cote - 10; } else { profit -= 10; }
      }
      const t = set.length;
      return {
        total: t, wins, losses: t - wins,
        winrate: t ? Math.round(wins / t * 100) : 0,
        profit10: Math.round(profit),
        roi_pct: t ? Math.round(profit / (t * 10) * 1000) / 10 : 0,
        avg_odds: t ? Math.round(oddSum / t * 100) / 100 : 0,
      };
    };

    // ── Separation exigee par le fondateur le 08/08/2026 ────────────────────
    // DIFFUSEES : au moins un sig_sent_* a 1, donc un abonne (ou le canal
    //   gratuit) a reellement recu ce signal. Seules celles-ci peuvent porter
    //   un montant en euros.
    // OBSERVEES : conserve pour compatibilite API, mais les analyses non
    // diffusees ne font plus partie de la vue client et restent donc a zero.
    const estDiffusee = (r) => ["standard", "premium", "elite", "free"].some(channel => displayDeliveryChannels(r).has(channel));
    const lignesDiffusees = dedupResolved.filter(estDiffusee);
    const lignesObservees = dedupResolved.filter(r => !estDiffusee(r));

    // Bloc sans argent : profit10, roi_pct et avg_odds sont volontairement
    // ABSENTS (et non pas a zero), pour qu'un front qui les lirait par erreur
    // affiche "—" au lieu d'un "0 €" ressemblant a un resultat.
    const statBlockObserve = (set) => {
      const wins = set.filter(r => r.outcome === "win").length;
      const t = set.length;
      return { total: t, wins, losses: t - wins, winrate: t ? Math.round(wins / t * 100) : 0 };
    };

    const abonnes = statBlock(lignesDiffusees);
    const observees = statBlockObserve(lignesObservees);
    // `global` passe par statBlockObserve : ainsi statBlock, seul endroit du
    // fichier qui produit profit10 et roi_pct, n'est plus jamais appele sur un
    // ensemble contenant une ligne non diffusee. Garantie structurelle.
    const global = statBlockObserve(dedupResolved);
    const tiers = {
      // Un palier ne peut plus se prevaloir d'un resultat que ses abonnes n'ont
      // jamais recu : on filtre sur l'envoi reel, pas sur l'eligibilite.
      standard: statBlock(lignesDiffusees.filter(r => displayDeliveryChannels(r).has("standard"))),
      premium:  statBlock(lignesDiffusees.filter(r => displayDeliveryChannels(r).has("premium"))),
      elite:    statBlock(lignesDiffusees.filter(r => displayDeliveryChannels(r).has("elite"))),
      gratuit:  statBlock(lignesDiffusees.filter(r => displayDeliveryChannels(r).has("free"))),
    };

    // Analyses publiées non encore résolues (dédoublonnées, hors bruit) = "en attente".
    const pendingRows = db.prepare(`
      SELECT match_key, home, away, competition, country, sport, analysed_at, best_bet,
             minute_at_analysis, consensus_votes, real_odd, real_odd_source,
             sig_sent_standard, sig_sent_premium, sig_sent_elite, sig_sent_free, diffusion_block
      FROM concile_analyses
      WHERE (outcome IS NULL OR outcome NOT IN ('win','loss'))
        AND confidence >= ${getPublishedMinConfidence()}
        AND date(analysed_at) >= '2026-07-03'
      ORDER BY analysed_at DESC
    `).all();
    const seenP = new Set();
    let pending = 0;
    for (const r of pendingRows) {
      if (isNoiseForDisplay(r) || !isVerifiedClientOu25Row(r)) continue;
      const k = `${r.home}_${r.away}_${(r.analysed_at || "").slice(0, 10)}`;
      if (seenP.has(k)) continue;
      seenP.add(k);
      pending++;
    }

    res.json({
      ok: true, analyses, total,
      // `stats` porte desormais les chiffres ABONNES : ce sont eux que lisent
      // les compteurs existants (accueil, /performances), donc les euros
      // affiches deviennent ceux des signaux reellement envoyes, sans qu'aucun
      // fichier de public/ ait a etre modifie. `observees` et `global` restent
      // disponibles a cote pour le futur bloc "analyses non diffusees".
      stats: { ...abonnes, pending, tiers, abonnes, observees, global },
      // Périmètre appliqué, pour que le front puisse l'annoncer clairement
      // ("Statistiques de ton palier Standard") au lieu de laisser croire à
      // l'abonné qu'il consulte l'historique complet.
      scope: tierFilter ? { filtered: true, plan: viewerPlan } : { filtered: false, plan: viewerPlan || null },
      verification: {
        repaired_date: CLIENT_HISTORY_REPAIR_DATE,
        telegram_proof_since: CLIENT_TELEGRAM_PROOF_SINCE,
        rule: "football_ou25_5_seats_min_4_votes_minute_15_45",
      },
    });
  } catch (e) {
    console.error("[analysis-history]", e.message);
    res.json({ ok: true, analyses: [], total: 0, stats: { total: 0, wins: 0, losses: 0, winrate: 0, pending: 0, profit10: 0, roi_pct: 0, avg_odds: 0, tiers: {} } });
  }
});

// ── Admin — analytics reports on demand ──────────────────────────────────────
app.post("/admin/analytics-report", async (req, res) => {
  const { email, code, type } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  if (type === "weekly") {
    const text = await buildWeeklyMarketingReport();
    const ok = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text);
    return res.json({ ok, message: ok ? "Rapport hebdo envoyé" : "Échec envoi" });
  }
  const text = buildDailyVisitorReport();
  const ok = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text);
  res.json({ ok, message: ok ? "Rapport visiteurs envoyé" : "Échec envoi" });
});

// ── Admin stats ───────────────────────────────────────────────────────────────
app.get("/admin/stats", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.json({ ok: false, error: "Accès admin requis" });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const all = codesDb.prepare("SELECT plan, active, expires_at FROM codes").all();
    codesDb.close();

    const now = new Date();
    const active = all.filter(r => r.active === 1);
    const counts = { free: 0, premium: 0, vip: 0, elite: 0, total: active.length };
    active.forEach(r => { if (counts[r.plan] !== undefined) counts[r.plan]++; });

    const expiring3d = active.filter(r => {
      if (!r.expires_at) return false;
      const d = Math.round((new Date(r.expires_at) - now) / 86400000);
      return d >= 0 && d <= 3;
    }).length;

    const expired = all.filter(r => r.expires_at && new Date(r.expires_at) < now).length;

    const proofs = loadProofs();

    res.json({
      ok: true,
      users: counts,
      expiring_soon: expiring3d,
      expired_total: expired,
      proofs_count: proofs.length,
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Admin losing leagues analysis ─────────────────────────────────────────────
app.get("/admin/losing-leagues", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.json({ ok: false, error: "Accès admin requis" });
  try {
    const rows = db.prepare(`
      SELECT competition, country, sport,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IN ('win','loss') AND competition != ''
      GROUP BY competition
      HAVING total >= 2
      ORDER BY losses DESC, total DESC
    `).all();
    const leagues = rows.map(r => ({
      competition: r.competition,
      country: r.country,
      sport: r.sport,
      total: r.total,
      wins: r.wins,
      losses: r.losses,
      winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : 0,
      danger: r.total >= 3 && (r.wins / r.total) < 0.5,
    }));
    const dangerous = leagues.filter(l => l.danger);
    res.json({ ok: true, leagues, dangerous, suggestion: dangerous.map(l => l.competition.toLowerCase()) });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Admin codes list ──────────────────────────────────────────────────────────
app.get("/admin/codes", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.json({ ok: false, error: "Accès admin requis" });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const rows = codesDb.prepare(
      "SELECT code, email, plan, active, expires_at, credits_max, credits_used, credits_date FROM codes ORDER BY plan, email"
    ).all();
    codesDb.close();
    res.json({ ok: true, codes: rows });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Admin create code ─────────────────────────────────────────────────────────
app.post("/admin/create-code", (req, res) => {
  const { email: adminEmail, code: adminCode } = req.query;
  if (!isAdmin(adminEmail, adminCode)) return res.json({ ok: false, error: "Accès admin requis" });

  const { target_email, plan = "elite", duration_days = 32 } = req.body || {};
  if (!target_email) return res.json({ ok: false, error: "target_email requis" });

  const creditsMax = defaultCreditsMaxForPlan(plan);

  try {
    const cdbw = new Database(CODES_DB_PATH);
    const existing = cdbw.prepare("SELECT code, plan FROM codes WHERE email = ? AND active = 1").get(target_email);
    if (existing) {
      cdbw.close();
      return res.json({ ok: true, code: existing.code, plan: existing.plan, note: "Code existant réactivé" });
    }
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const newCode = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const expiresAt = new Date(Date.now() + duration_days * 86400000).toISOString().slice(0, 10);
    cdbw.prepare(
      "INSERT INTO codes (code, email, plan, active, expires_at, credits_max, credits_used, credits_date, created_at) VALUES (?,?,?,1,?,?,0,?,datetime('now'))"
    ).run(newCode, target_email, plan, expiresAt, creditsMax, getTodayStr());
    cdbw.close();
    console.log(`[admin] Code créé: ${newCode} pour ${target_email} plan ${plan} expire ${expiresAt}`);
    res.json({ ok: true, code: newCode, plan, email: target_email, expires_at: expiresAt });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Internal pick notify — called by Hermès after /analyse ───────────────────
// Secured by HERMES_ADMIN_TLM_BOT token as shared secret
// Route appelée par Hermès bot après vérification Stripe paiement client
app.post("/internal/stripe-verify", async (req, res) => {
  const { session_id, email } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  const secret = req.headers["x-internal-secret"];
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false });
  if (!session_id || !email) return res.json({ ok: false, error: "session_id et email requis" });

  try {
    // Vérifier session Stripe
    if (!STRIPE_SECRET_KEY) return res.json({ ok: false, error: "Stripe non configuré" });
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["line_items"] });
    if (!session || session.payment_status !== "paid") return res.json({ ok: false, error: "Paiement non confirmé" });

    const priceId = session.line_items?.data?.[0]?.price?.id || "";
    const planMap = {
      [STRIPE_PRICE_ID_CARTE]:    { status: "carte",    durationDays: 1,  creditsMax: 1 },
      [STRIPE_PRICE_ID_STANDARD]: { status: "standard", durationDays: 32, creditsMax: 3 },
      [STRIPE_PRICE_ID_PREMIUM]: { status: "premium", durationDays: 32, creditsMax: 10 },
      [STRIPE_PRICE_ID_VIP]:     { status: "vip",     durationDays: 32, creditsMax: 20 },
      [STRIPE_PRICE_ID_ELITE]:   { status: "elite",   durationDays: 32, creditsMax: 30 },
    };
    const { status = "premium", durationDays = 32, creditsMax = 10 } = planMap[priceId] || {};

    // Chercher code existant
    const cdbr = new Database(CODES_DB_PATH, { readonly: true });
    let codeRow = cdbr.prepare("SELECT code, plan FROM codes WHERE email = ? AND active = 1").get(email);
    cdbr.close();

    if (!codeRow) {
      // Créer le code
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const newCode = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString().slice(0, 10);
      const cdbw = new Database(CODES_DB_PATH);
      cdbw.prepare(
        "INSERT INTO codes (code, email, plan, active, expires_at, credits_max, credits_used, credits_date, created_at) VALUES (?,?,?,1,?,?,0,?,datetime('now'))"
      ).run(newCode, email, status, expiresAt, creditsMax, getTodayStr());
      cdbw.close();
      codeRow = { code: newCode, plan: status };
      console.log(`[stripe-verify] Code créé: ${newCode} pour ${email} plan ${status}`);
    }

    res.json({ ok: true, code: codeRow.code, plan: codeRow.plan });
  } catch(e) {
    console.error("[stripe-verify]", e.message);
    res.json({ ok: false, error: e.message });
  }
});

// ── Page de confirmation après paiement (PUBLIQUE) ────────────────────────────
// Sécurisée par Stripe : il faut un session_id RÉELLEMENT payé. Lit l'email depuis
// la session, crée/renvoie le code d'accès. Filet de sécurité si le webhook échoue.
app.post("/payment-success", async (req, res) => {
  const { session_id } = req.body || {};
  if (!session_id) return res.json({ ok: false, error: "session_id requis" });
  if (!STRIPE_SECRET_KEY) return res.json({ ok: false, error: "Stripe non configuré" });
  try {
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["line_items"] });
    if (!session || session.payment_status !== "paid") return res.json({ ok: false, error: "Paiement non confirmé" });
    const email = (session.customer_details?.email || session.customer_email || "").toLowerCase().trim();
    if (!email) return res.json({ ok: false, error: "Email introuvable sur la session" });
    const priceId = session.line_items?.data?.[0]?.price?.id || "";
    const planMap = {
      [STRIPE_PRICE_ID_CARTE]:    { status: "carte",    durationDays: 1,  creditsMax: 1 },
      [STRIPE_PRICE_ID_STANDARD]: { status: "standard", durationDays: 32, creditsMax: 3 },
      [STRIPE_PRICE_ID_PREMIUM]: { status: "premium", durationDays: 32, creditsMax: 10 },
      [STRIPE_PRICE_ID_VIP]:     { status: "vip",     durationDays: 32, creditsMax: 20 },
      [STRIPE_PRICE_ID_ELITE]:   { status: "elite",   durationDays: 32, creditsMax: 30 },
    };
    const { status = "premium", durationDays = 32, creditsMax = 10 } = planMap[priceId] || {};
    const cdbr = new Database(CODES_DB_PATH, { readonly: true });
    let codeRow = cdbr.prepare("SELECT code, plan FROM codes WHERE email = ? AND active = 1").get(email);
    cdbr.close();
    if (!codeRow) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const newCode = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString().slice(0, 10);
      const cdbw = new Database(CODES_DB_PATH);
      cdbw.prepare("INSERT INTO codes (code, email, plan, active, expires_at, credits_max, credits_used, credits_date, created_at) VALUES (?,?,?,1,?,?,0,?,datetime('now'))")
        .run(newCode, email, status, expiresAt, creditsMax, getTodayStr());
      cdbw.close();
      codeRow = { code: newCode, plan: status };
      console.log(`[payment-success] Code créé (filet): ${newCode} pour ${email} (${status})`);
    }
    res.json({ ok: true, code: codeRow.code, plan: codeRow.plan, email });
  } catch (e) {
    console.error("[payment-success]", e.message);
    res.json({ ok: false, error: "Erreur de vérification" });
  }
});

app.post("/internal/pick-notify", async (req, res) => {
  const { pick, secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  if (!pick || !pick.home) return res.json({ ok: false, error: "pick manquant" });
  if (!BREVO_API_KEY) return res.json({ ok: false, error: "BREVO_API_KEY non configuré", sent: 0 });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const rows = codesDb.prepare(
      "SELECT email FROM codes WHERE active = 1 AND plan != 'free' AND email IS NOT NULL AND email != ''"
    ).all();
    codesDb.close();
    const leadRows = loadLeads().leads || [];
    const leadMap = new Map(leadRows.map(l => [String(l.email || "").toLowerCase(), l]));

    const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const gainPotentiel = pick.cote ? Math.round(100 * parseFloat(pick.cote)) : "?";
    const liveUnavailableHtml = pick.liveUnavailable
      ? `<div style="font-size:13px;color:#fbbf24;line-height:1.6;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.28);border-radius:10px;padding:12px;margin-top:12px">Analyse Live IA indisponible pour ce match : il n'est pas couvert par l'API live. Le pick officiel reste valide, mais aucune analyse live ne sera promise.</div>`
      : "";
    const htmlContent = `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block">TousLesMatchs</div>
    <div style="font-size:11px;color:#7b82a0;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">4 AGENTS IA + 1 CHIEF. TU DECIDES AVEC PLUS DE DONNEES.</div>
  </div>
  <div style="background:#0d1020;border:1px solid rgba(99,102,241,.25);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#22d3ee;margin-bottom:12px">🎯 Pick du ${today}</div>
    <div style="font-size:22px;font-weight:900;color:#eceaf4;margin-bottom:8px">${pick.home} vs ${pick.away}</div>
    <div style="font-size:13px;color:#a8aec8;margin-bottom:16px">🏆 ${pick.league || ""} · 🕐 ${pick.time || ""}</div>
    <div style="background:rgba(79,70,229,.12);border:1px solid rgba(79,70,229,.25);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:13px;color:#a8aec8;margin-bottom:4px">Pronostic du Concile</div>
      <div style="font-size:20px;font-weight:800;color:#eceaf4">${pick.prono || pick.bet || ""}</div>
      <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap">
        <span style="font-size:13px;color:#22d3ee">📊 Cote : <strong>${pick.cote}</strong></span>
        <span style="font-size:13px;color:#10b981">✅ Score de confiance : <strong>${pick.confidenceTg || pick.confidence+"/10" || ""}</strong></span>
      </div>
    </div>
    ${pick.raison ? `<div style="font-size:13px;color:#a8aec8;line-height:1.6;font-style:italic;border-left:2px solid rgba(99,102,241,.4);padding-left:12px">${pick.raison}</div>` : ""}
    ${liveUnavailableHtml}
  </div>
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:12px;color:#7b82a0;margin-bottom:12px">💰 Gain potentiel sur 100€ misés : <strong style="color:#10b981">+${gainPotentiel}€</strong></div>
    <a href="https://www.touslesmatchs.com" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Voir l'analyse complète →</a>
  </div>
  ${bookmakerEmailHtml()}
  <div style="text-align:center;font-size:11px;color:#7b82a0;line-height:1.6">
    TousLesMatchs — Analyse IA · <a href="https://www.touslesmatchs.com" style="color:#6366f1;text-decoration:none">touslesmatchs.com</a><br>
    ⚠️ Analyses sportives réservées aux +18 ans. Jeu responsable.
  </div>
</div>`;

    let sent = 0;
    const emails = [...new Set([...rows.map(r => r.email), ...leadRows.map(l => l.email)].filter(Boolean))];
    for (const email of emails) {
      try {
        const [subjectPrefix] = pickEmailText(leadLang(email, leadMap));
        await brevoSendEmail(email, `🎯 ${subjectPrefix} — ${pick.home} vs ${pick.away} @${pick.cote}`, htmlContent);
        sent++;
      } catch (e) {
        console.error(`[pick-notify] email to ${email}:`, e.message);
      }
    }
    console.log(`[pick-notify] Emails envoyés : ${sent}/${emails.length}`);
    res.json({ ok: true, sent, total: emails.length });
  } catch (e) {
    console.error("[pick-notify]", e.message);
    res.json({ ok: false, error: e.message, sent: 0 });
  }
});

// ── Referral routes ───────────────────────────────────────────────────────────
app.get("/ref/:code", (req, res) => {
  const code = String(req.params.code || "").replace(/[^A-Z0-9\-]/gi, "").toUpperCase().slice(0, 24);
  res.redirect(302, `/?ref=${encodeURIComponent(code)}#plans`);
});

app.post("/referral/get-link", (req, res) => {
  const { email, code } = req.body || {};
  const auth = verifyCode(email, code);
  if (!auth.valid) return res.status(401).json({ ok: false, error: "Code invalide" });
  const refCode = getOrCreateRefCode(email.toLowerCase().trim());
  const link = `https://www.touslesmatchs.com/ref/${refCode}`;
  const data = loadReferrals();
  const ref = data.refs[refCode] || {};
  res.json({ ok: true, refCode, link, referrals: (ref.referrals || []).length, monthsEarned: ref.monthsEarned || 0 });
});

app.post("/referral/confirm", (req, res) => {
  const { refCode, newEmail, secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false, error: "Forbidden" });
  if (!refCode || !newEmail) return res.json({ ok: false, error: "refCode et newEmail requis" });
  const credited = creditReferrer(refCode.toUpperCase(), newEmail.toLowerCase().trim());
  res.json({ ok: credited, message: credited ? "Parrain crédité de 30 jours" : "Déjà crédité ou code invalide" });
});

// ── Signal Fort Bilan — endpoint admin + public stats ────────────────────────
app.post("/internal/signal-fort-bilan", async (req, res) => {
  const { secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false, error: "Forbidden" });
  await sendSignalFortBilanTelegram();
  res.json({ ok: true, stats: getSignalFortStats() });
});

// Vitrine du compte gratuit : ce que les abonnes Standard ont reellement recu
// hier. Sert la preuve par l'exemple sans rien devoiler des signaux EN COURS
// (uniquement des matchs deja termines et officiellement regles).
// Mise de reference fixe a 10 EUR, affichee explicitement cote client — jamais
// presentee comme un gain reel, uniquement comme une simulation.
app.get("/standard-yesterday", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT home, away, competition, sport, best_bet, confidence,
             real_odd, real_odd_source, outcome, analysed_at,
             final_score_home, final_score_away
      FROM concile_analyses
      WHERE sig_sent_standard = 1
        AND date(analysed_at) = date('now','-1 day')
        AND outcome IN ('win','loss')
      ORDER BY analysed_at ASC
    `).all();

    const MISE = 10;
    let profit = 0, wins = 0, losses = 0;
    const selections = rows.map(r => {
      const cote = rowOdd(r);
      const gagne = r.outcome === "win";
      const gain = gagne ? Math.round((cote - 1) * MISE * 100) / 100 : -MISE;
      profit += gain;
      if (gagne) wins++; else losses++;
      return {
        date: r.analysed_at,
        competition: r.competition || r.sport || "",
        home: r.home, away: r.away,
        bet: r.best_bet,
        cote,
        confidence: r.confidence,
        outcome: r.outcome,
        score_final: r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : null,
        gain: Math.round(gain * 100) / 100,
      };
    });

    res.json({
      ok: true,
      mise_reference: MISE,
      selections,
      total: selections.length,
      wins, losses,
      profit: Math.round(profit * 100) / 100,
    });
  } catch (e) {
    console.error("[standard-yesterday]", e.message);
    res.json({ ok: true, selections: [], total: 0, wins: 0, losses: 0, profit: 0, mise_reference: 10 });
  }
});

app.get("/signal-fort-stats", (req, res) => {
  const stats = getSignalFortStats();
  const formatPronoTimestamp = (bet, minute) => {
    if (!bet || minute === null || minute === undefined) return bet;
    return `${bet} (à la ${minute}e min)`;
  };
  res.json({
    ok: true,
    total: stats.total,
    wins: stats.wins,
    losses: stats.losses,
    winrate: stats.winrate,
    recent: stats.recent.map(r => ({
      home: r.home,
      away: r.away,
      competition: r.competition,
      sport: r.sport,
      confidence: r.confidence,
      outcome: r.outcome,
      cote: rowOdd(r),
      score: r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : null,
      bet_with_timestamp: formatPronoTimestamp(r.best_bet, r.minute_at_analysis),
      date: r.analysed_at,
    })),
    picks_feed: stats.recent.map(r => ({
      id: `sf-${r.home}-${r.away}-${r.analysed_at}`.replace(/\s+/g, '-').toLowerCase(),
      date: r.analysed_at ? r.analysed_at.slice(0, 10) : "",
      time: r.analysed_at ? r.analysed_at.slice(11, 16) : "",
      competition: r.competition || r.sport || "",
      home: r.home,
      away: r.away,
      pick: formatPronoTimestamp(r.best_bet || `Signal Fort ${r.confidence}%`, r.minute_at_analysis),
      cote: rowOdd(r),
      status: "finished",
      result: r.outcome === "win" ? "win" : "loss",
      score: r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : "?",
    })),
    threshold: getAdaptiveSignalThreshold(),
  });
});

// ── Premium teaser stats — public endpoint for NOPICK sales pitch ─────────────
app.get("/premium-teaser", (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const allRows = db.prepare(`
      SELECT home, away, competition, outcome, confidence, best_bet, real_odd,
        final_score_home, final_score_away, sport, analysed_at, minute_at_analysis
      FROM concile_analyses
      WHERE outcome IN ('win','loss') AND confidence >= ${getPublishedMinConfidence()}
      ORDER BY analysed_at DESC
    `).all();

    const deduped = [];
    const seen = new Set();
    for (const r of allRows) {
      // Mêmes exclusions que la vitrine (jeunes / douteuses).
      if (isNoiseForDisplay(r)) continue;
      const key = `${r.home}_${r.away}_${(r.analysed_at || "").slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }

    const todayRows = deduped.filter(r => (r.analysed_at || "").startsWith(today));
    const yesterdayRows = deduped.filter(r => (r.analysed_at || "").startsWith(yesterday));
    const week7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const weekRows = deduped.filter(r => (r.analysed_at || "").slice(0, 10) >= week7);

    const agg = (rows) => ({
      total: rows.length,
      wins: rows.filter(r => r.outcome === "win").length,
      losses: rows.filter(r => r.outcome === "loss").length,
    });

    const allTime = agg(deduped);
    const todayStats = agg(todayRows);
    const yesterdayStats = agg(yesterdayRows);
    const weekStats = agg(weekRows);
    const winrate = allTime.total > 0 ? Math.round(allTime.wins / allTime.total * 100) : 0;

    const simGain = deduped.reduce((sum, r) => {
      const cote = rowOdd(r);
      return sum + (r.outcome === "win" ? (10 * cote - 10) : -10);
    }, 0);

    const todaySignals = todayRows.length;

    // `recent` doit contenir aujourd'hui ET hier pour que le front puisse
    // déplier les deux onglets ("Aujourd'hui" et "Hier"). Avant, seul today
    // était inclus quand il y avait des matchs du jour → clic "Hier" vide.
    const merged = [...todayRows, ...yesterdayRows];
    const recentResults = merged.length > 0 ? merged : deduped.slice(0, 20);

    // Courbe de bankroll chronologique (mise 10€, capital départ 100€)
    // sur toutes les analyses — source unique pour le graphique ROI du site.
    const chronological = [...deduped].reverse();
    let bankroll = 100;
    const progression = [{ label: "Départ", value: 100 }];
    for (const r of chronological) {
      const cote = rowOdd(r);
      bankroll += r.outcome === "win" ? (10 * cote - 10) : -10;
      bankroll = Math.round(bankroll * 100) / 100;
      const label = r.analysed_at
        ? r.analysed_at.slice(5, 10).split("-").reverse().join("/") + " " + String(r.home || "").split(" ")[0]
        : String(r.home || "").split(" ")[0];
      progression.push({ label, value: bankroll });
    }

    res.json({
      ok: true,
      today_signals: todaySignals,
      week: weekStats,
      allTime: { total: allTime.total, wins: allTime.wins, winrate },
      simulated_gain_10: simGain > 0 ? `+${Math.round(simGain)}€` : `${Math.round(simGain)}€`,
      simulated_gain_raw: Math.round(simGain),
      bankroll_final: Math.round(bankroll * 100) / 100,
      progression,
      today_results: todayStats,
      yesterday: yesterdayStats,
      recent: recentResults.map(r => {
        const cote = rowOdd(r);
        const gain10 = r.outcome === 'win' ? Math.round((cote * 10 - 10) * 100) / 100 : -10;
        const betWithTime = r.minute_at_analysis !== null && r.minute_at_analysis !== undefined
          ? `${r.best_bet} (à la ${r.minute_at_analysis}e min)`
          : r.best_bet;
        return {
          match: `${r.home} vs ${r.away}`,
          competition: r.competition || '',
          outcome: r.outcome,
          sport: r.sport || 'Football',
          score: r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : null,
          bet: r.best_bet,
          bet_with_timestamp: betWithTime,
          date: r.analysed_at ? r.analysed_at.slice(0, 10) : null,
          cote: Math.round(cote * 100) / 100,
          gain10,
        };
      }),
    });
  } catch (e) {
    res.json({ ok: true, today_signals: 0, week: { total: 0, wins: 0, losses: 0 }, allTime: { total: 0, wins: 0, winrate: 0 }, simulated_gain_10: "0€", simulated_gain_raw: 0, yesterday: { total: 0, wins: 0, losses: 0 }, recent: [], });
  }
});

// ── Internal signal notify — strong signal email to premium subscribers ───────
app.post("/internal/signal-notify", async (req, res) => {
  const { signal, secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false, error: "Forbidden" });
  if (!signal || !signal.home) return res.json({ ok: false, error: "signal manquant" });
  // Garde-fou : Hermès ne peut PAS diffuser un signal sur un match féminin ni une
  // ligue douteuse (Football), même via cet endpoint interne (défense en profondeur).
  const sigMatch = { competition: signal.competition, league: signal.competition, home: signal.home, away: signal.away, sport: signal.sport };
  if (isWomenMatch(sigMatch)) {
    console.log(`[signal-notify] Bloqué — match féminin (liste noire): ${signal.home} vs ${signal.away}`);
    return res.json({ ok: false, error: "match féminin exclu", blocked: "women" });
  }
  if (signal.sport === "Football" && isExcludedFromPicks(sigMatch)) {
    console.log(`[signal-notify] Bloqué — ligue douteuse ou qualif UEFA (liste noire): ${signal.competition || ""}`);
    return res.json({ ok: false, error: "ligue douteuse exclue", blocked: "low_trust" });
  }
  if (!BREVO_API_KEY) return res.json({ ok: false, error: "BREVO_API_KEY non configuré", sent: 0 });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const rows = codesDb.prepare(
      "SELECT email FROM codes WHERE active = 1 AND plan IN ('premium','elite','vip') AND email IS NOT NULL AND email != ''"
    ).all();
    codesDb.close();

    const sportIcons = { Football:"⚽", Basketball:"🏀", Hockey:"🏒", Baseball:"⚾", Rugby:"🏉", Handball:"🤾", Volleyball:"🏐" };
    const sportIcon = sportIcons[signal.sport] || "🎯";
    const conf = signal.confidence || "?";
    const confColor = conf >= 85 ? "#10b981" : conf >= 80 ? "#f59e0b" : "#6366f1";
    const logoHtml = signal.home_logo ? `<img src="${signal.home_logo}" alt="" style="width:40px;height:40px;object-fit:contain;border-radius:6px;vertical-align:middle;margin-right:8px">` : "";

    const htmlContent = `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block">TousLesMatchs</div>
    <div style="font-size:11px;color:#7b82a0;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">ALERTE SIGNAL FORT — CONSEIL IA</div>
  </div>
  <div style="background:#0d1020;border:1px solid rgba(16,185,129,.3);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:28px">${sportIcon}</span>
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#10b981">🚨 Signal fort détecté</div>
        <div style="font-size:11px;color:#7b82a0">${signal.competition || signal.sport || ""}</div>
      </div>
      <div style="margin-left:auto;background:${confColor}18;border:1px solid ${confColor};border-radius:10px;padding:4px 12px;font-size:14px;font-weight:900;color:${confColor}">${conf}/100</div>
    </div>
    <div style="font-size:20px;font-weight:900;color:#eceaf4;margin-bottom:6px">${logoHtml}${signal.home} vs ${signal.away}</div>
    ${signal.minute ? `<div style="font-size:12px;color:#22d3ee;margin-bottom:12px">⏱ ${signal.minute}' en cours${signal.score_home != null ? " · Score : " + signal.score_home + "-" + signal.score_away : ""}</div>` : ""}
    <div style="background:rgba(79,70,229,.12);border:1px solid rgba(79,70,229,.25);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:13px;color:#a8aec8;margin-bottom:4px">Signal Concile</div>
      <div style="font-size:18px;font-weight:800;color:#eceaf4">${signal.bet || ""}</div>
      ${signal.reason ? `<div style="font-size:12px;color:#a8aec8;margin-top:8px;font-style:italic;border-left:2px solid rgba(99,102,241,.4);padding-left:10px">${signal.reason}</div>` : ""}
    </div>
    <div style="text-align:center">
      <a href="https://www.touslesmatchs.com/live-ia" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Voir l'analyse Live IA →</a>
    </div>
  </div>
  ${bookmakerEmailHtml()}
  <div style="text-align:center;font-size:11px;color:#7b82a0;line-height:1.6">
    TousLesMatchs — Signal automatique Conseil IA<br>
    ⚠️ Analyses sportives réservées aux +18 ans. Jeu responsable. Cotes à vérifier sur les plateformes.
  </div>
</div>`;

    let sent = 0;
    const emails = [...new Set(rows.map(r => r.email).filter(Boolean))];
    for (const email of emails) {
      try {
        await brevoSendEmail(email, `🚨 Signal fort ${conf}/100 — ${signal.home} vs ${signal.away} (${signal.sport || "Sport"})`, htmlContent);
        sent++;
      } catch (e) {
        console.error(`[signal-notify] email to ${email}:`, e.message);
      }
    }
    console.log(`[signal-notify] Emails signal fort envoyés : ${sent}/${emails.length}`);

    // Email teaser aux inscrits GRATUITS (sans le pari, avec CTA abonnement)
    try {
      const leadRows = loadLeads().leads || [];
      const premiumEmails = new Set(emails.map(e => e.toLowerCase()));
      const freeEmails = [...new Set(leadRows.map(l => l.email).filter(e => e && !premiumEmails.has(e.toLowerCase())))];
      if (freeEmails.length > 0) {
        const teaserHtml = `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block">TousLesMatchs</div>
    <div style="font-size:11px;color:#7b82a0;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">ALERTE SIGNAL FORT</div>
  </div>
  <div style="background:#0d1020;border:1px solid rgba(99,102,241,.3);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:28px">${sportIcon}</span>
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#f59e0b">🚨 Signal fort détecté</div>
        <div style="font-size:11px;color:#7b82a0">${signal.competition || signal.sport || ""}</div>
      </div>
      <div style="margin-left:auto;background:${confColor}18;border:1px solid ${confColor};border-radius:10px;padding:4px 12px;font-size:14px;font-weight:900;color:${confColor}">${conf}/100</div>
    </div>
    <div style="font-size:20px;font-weight:900;color:#eceaf4;margin-bottom:6px">${logoHtml}${signal.home} vs ${signal.away}</div>
    ${signal.minute ? `<div style="font-size:12px;color:#22d3ee;margin-bottom:12px">⏱ ${signal.minute}' en cours</div>` : ""}
    <div style="background:rgba(79,70,229,.12);border:1px solid rgba(79,70,229,.25);border-radius:10px;padding:16px;text-align:center">
      <div style="font-size:14px;color:#a8aec8;margin-bottom:8px">Le Conseil IA a identifié une analyse à <strong style="color:#eceaf4">${conf}/100 de score de confiance</strong></div>
      <div style="font-size:16px;font-weight:800;color:#6366f1">🔒 Analyse réservée aux abonnés</div>
    </div>
  </div>
  <div style="text-align:center;margin-bottom:16px">
    <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 20px rgba(79,70,229,.4)">Débloquer l'analyse — 14.90€/mois →</a>
  </div>
  <div style="text-align:center;margin-bottom:20px">
    <a href="https://www.touslesmatchs.com/#plans" style="color:#6366f1;font-size:13px;text-decoration:none">Voir les offres</a>
  </div>
  <div style="text-align:center;font-size:11px;color:#7b82a0;line-height:1.6">
    TousLesMatchs — Signal automatique Conseil IA<br>
    ⚠️ 18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a>
  </div>
</div>`;
        let freeSent = 0;
        for (const fe of freeEmails.slice(0, 200)) {
          try {
            await brevoSendEmail(fe, `🚨 Signal fort ${conf}/100 détecté — ${signal.home} vs ${signal.away}`, teaserHtml);
            freeSent++;
          } catch (_) {}
        }
        console.log(`[signal-notify] Teaser free envoyés : ${freeSent}/${freeEmails.length}`);
      }
    } catch (e) { console.error("[signal-notify] free teaser:", e.message); }

    const sportIcons2 = { Football:"⚽", Basketball:"🏀", Hockey:"🏒", Baseball:"⚾", Rugby:"🏉" };
    const tgIcon = sportIcons2[signal.sport] || "🎯";
    // Bloc anglais compact : on ne repete PAS les noms d'equipes, le score ni la
    // competition (deja universels quelques lignes plus haut) — uniquement ce
    // qu'un non-francophone ne peut pas deviner : le type d'analyse et la
    // mention legale. Message ~6 lignes plus long, pas deux fois plus long.
    const enPremium = `\n\n🇬🇧 AI analysis: <b>${betLabelEn(signal.bet)}</b>\n📊 Confidence: <b>${conf}/100</b>\n⚠️ 18+ — Responsible gaming`;
    const enFree = `\n\n🇬🇧 The exact selection and full analysis are reserved for Premium/Elite subscribers.\n⚠️ 18+ — Responsible gaming`;
    const tgPremiumText = `🚨 <b>SIGNAL FORT — ${conf}/100</b>\n\n${tgIcon} <b>${signal.home} vs ${signal.away}</b>\n🏆 ${signal.competition || signal.sport || ""}\n${signal.minute ? `⏱ ${signal.minute}' · Score : ${signal.score_home ?? "?"}-${signal.score_away ?? "?"}` : ""}\n\n💡 Analyse IA : <b>${signal.bet || ""}</b>\n📊 Score de confiance : <b>${conf}/100</b>\n${signal.reason ? `\n<i>${String(signal.reason).slice(0, 200)}</i>` : ""}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ 18+ — Jeu responsable${enPremium}`;
    const tgFreeText = `🚨 <b>SIGNAL FORT DÉTECTÉ — ${conf}/100</b>\n\n${tgIcon} <b>${signal.home} vs ${signal.away}</b>\n🏆 ${signal.competition || signal.sport || ""}\n${signal.minute ? `⏱ ${signal.minute}' · Score : ${signal.score_home ?? "?"}-${signal.score_away ?? "?"}` : ""}\n\n🔒 <b>La sélection exacte et l'analyse complète sont réservées aux abonnés Premium/Elite.</b>\n\n👉 <a href="https://www.touslesmatchs.com/#plans"><b>S'abonner à Standard — 4,90€/mois</b></a>\n\n━━━━━━━━━━━━━━━━━━\n⚠️ 18+ — Jeu responsable${enFree}`;
    // Signal de niveau Premium : Premium et Elite le reçoivent toujours (modèle
    // imbriqué), Standard uniquement s'il atteint son seuil plus exigeant.
    await sendToPaidChannels(tgPremiumText, { tag: "signal-notify", includeStandard: (Number(conf) || 0) >= STANDARD_MIN_CONF });
    if (TELEGRAM_CHANNEL_ID) {
      const ok = await sendTelegramMessage(TELEGRAM_CHANNEL_ID, tgFreeText);
      console.log(`[signal-notify] Telegram free: ${ok ? "OK" : "FAIL"}`);
    }

    // Épingler le signal 90 min sur Live IA pour que le lien Telegram mène au bon match
    addPinnedSignal({
      id: signal.id || `${signal.home}_${signal.away}_${Date.now()}`,
      home: signal.home, away: signal.away,
      competition: signal.competition || signal.sport || "",
      sport: signal.sport || "Football",
      minute: signal.minute,
      score_home: signal.score_home,
      score_away: signal.score_away,
      home_logo: signal.home_logo || null,
      away_logo: signal.away_logo || null,
      bet: signal.bet,
      confidence: signal.confidence,
      reason: signal.reason,
    });

    res.json({ ok: true, sent, total: emails.length });
  } catch (e) {
    console.error("[signal-notify]", e.message);
    res.json({ ok: false, error: e.message, sent: 0 });
  }
});

// ── Preuves — GET public ──────────────────────────────────────────────────────
app.post("/internal/pick-result-notify", async (req, res) => {
  const { pick, secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  if (!pick || !pick.home) return res.json({ ok: false, error: "pick manquant" });
  const finalScore = getFinalScoreFromPick(pick);
  if (finalScore && pick.home && pick.away) {
    autoResolvePredictions({
      home: pick.home,
      away: pick.away,
      score_home: finalScore.score_home,
      score_away: finalScore.score_away,
      status: "FINISHED",
    });
  }
  if (!BREVO_API_KEY) return res.json({ ok: false, error: "BREVO_API_KEY non configuré", sent: 0 });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const rows = codesDb.prepare(
      "SELECT email FROM codes WHERE active = 1 AND plan != 'free' AND email IS NOT NULL AND email != ''"
    ).all();
    codesDb.close();
    const leadRows = loadLeads().leads || [];

    const won = pick.status === "GAGNE" || pick.status === "win";
    const title = won ? "Pick gagnant" : "Résultat du pick";
    const score = pick.score || `${pick.score_home ?? "?"}-${pick.score_away ?? "?"}`;
    const htmlContent = `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:24px;font-weight:900;color:#eceaf4">TousLesMatchs</div>
    <div style="font-size:12px;color:#7b82a0;margin-top:4px">${title}</div>
  </div>
  <div style="background:#0d1020;border:1px solid ${won ? "rgba(16,185,129,.35)" : "rgba(99,102,241,.25)"};border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="font-size:28px;font-weight:900;color:${won ? "#10b981" : "#eceaf4"};margin-bottom:12px">${won ? "GAGNÉ" : "TERMINÉ"}</div>
    <div style="font-size:20px;font-weight:800;color:#eceaf4;margin-bottom:8px">${pick.home} vs ${pick.away}</div>
    <div style="font-size:13px;color:#a8aec8;margin-bottom:14px">Score final : <strong>${score}</strong></div>
    <div style="font-size:15px;color:#eceaf4;margin-bottom:8px">${pick.prono || pick.bet || ""} @ ${pick.cote || ""}</div>
    <div style="font-size:13px;color:#a8aec8;line-height:1.6">${won ? "Le pick officiel du jour est validé." : "Le pick officiel du jour est clôturé. On garde la donnée pour améliorer le modèle."}</div>
  </div>
  <div style="text-align:center">
    <a href="https://www.touslesmatchs.com" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Voir TousLesMatchs</a>
  </div>
  ${bookmakerEmailHtml()}
</div>`;

    let sent = 0;
    const emails = [...new Set([...rows.map(r => r.email), ...leadRows.map(l => l.email)].filter(Boolean))];
    for (const email of emails) {
      try {
        await brevoSendEmail(email, `${won ? "🏆" : "📊"} ${title} — ${pick.home} vs ${pick.away}`, htmlContent);
        sent++;
      } catch (e) {
        console.error(`[pick-result-notify] email to ${email}:`, e.message);
      }
    }
    console.log(`[pick-result-notify] Emails envoyés : ${sent}/${emails.length}`);
    res.json({ ok: true, sent, total: emails.length });
  } catch (e) {
    console.error("[pick-result-notify]", e.message);
    res.json({ ok: false, error: e.message, sent: 0 });
  }
});

app.post("/internal/record-concile-result", (req, res) => {
  const { record, secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  if (!record || !record.home || !record.away || !record.bet) {
    return res.json({ ok: false, error: "home, away, bet requis" });
  }
  const score = getFinalScoreFromPick(record);
  if (!score) return res.json({ ok: false, error: "score final requis, exemple 0-0" });

  const h = Number(score.score_home);
  const a = Number(score.score_away);
  const outcome = getBetOutcomeForScore(record.bet, h, a);
  if (!outcome) return res.json({ ok: false, error: `Marche non reconnu: ${record.bet}` });

  const confidence = Math.max(1, Math.min(100, Number(record.confidence ?? 55)));
  const minute = record.minute !== undefined && record.minute !== null && record.minute !== ""
    ? Number(record.minute)
    : null;
  const matchKey = `manual_${record.home}_${record.away}_${getTodayStr()}_${record.bet}_${h}-${a}`.replace(/\s+/g, "_");
  const agents = [{ name: record.agent || "Claude Chief", bet: record.bet, confidence }];

  try {
    db.prepare(`
      INSERT OR IGNORE INTO concile_analyses
        (match_key, home, away, competition, minute_at_analysis,
         score_home_at_analysis, score_away_at_analysis, stats_status,
         best_bet, confidence, raison, consensus_votes, agents_json, pick_bet, outcome)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      matchKey,
      record.home,
      record.away,
      record.competition || record.league || "Manuel",
      Number.isFinite(minute) ? minute : null,
      h,
      a,
      record.stats_status || "manual_verified",
      record.bet,
      confidence,
      record.reason || "Prediction verifiee manuellement par admin.",
      Number(record.consensus_votes || 1),
      JSON.stringify(agents),
      record.pick_bet || null,
      outcome
    );

    db.prepare(
      "INSERT OR IGNORE INTO agent_predictions (match_key, home, away, agent_name, bet, confidence, outcome) VALUES (?,?,?,?,?,?,?)"
    ).run(matchKey, record.home, record.away, record.agent || "Claude Chief", record.bet, confidence, outcome);

    db.prepare(`
      UPDATE concile_analyses
      SET final_score_home = ?,
          final_score_away = ?,
          resolved_at = datetime('now'),
          result_source = ?
      WHERE match_key = ?
    `).run(h, a, "manual_verified", matchKey);

    console.log(`[record-concile-result] ${record.home} vs ${record.away} ${record.bet} ${h}-${a} => ${outcome}`);
    res.json({ ok: true, outcome, match_key: matchKey });
  } catch (e) {
    console.error("[record-concile-result]", e.message);
    res.json({ ok: false, error: e.message });
  }
});

app.get("/preuves", (req, res) => {
  res.json({ ok: true, proofs: loadProofs() });
});

// ── Preuves — POST admin upload ───────────────────────────────────────────────
app.post("/admin/preuves", (req, res) => {
  const { email, code, proof } = req.body || {};
  if (!isAdmin(email, code)) return res.json({ ok: false, error: "Accès admin requis" });
  if (!proof || !proof.data || !proof.title) return res.json({ ok: false, error: "Données manquantes (data + title requis)" });

  const proofs = loadProofs();
  const newProof = {
    id: Date.now(),
    title: proof.title,
    description: proof.description || "",
    date: proof.date || new Date().toISOString().slice(0, 10),
    data: proof.data, // base64 data URI
    added_at: new Date().toISOString(),
  };
  proofs.unshift(newProof);
  saveProofs(proofs);
  res.json({ ok: true, proof: { ...newProof, data: "[omitted]" } });
});

// ── Preuves — DELETE admin ────────────────────────────────────────────────────
app.delete("/admin/preuves/:id", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.json({ ok: false, error: "Accès admin requis" });

  const id = parseInt(req.params.id);
  const proofs = loadProofs();
  const updated = proofs.filter(p => p.id !== id);
  saveProofs(updated);
  res.json({ ok: true, deleted: proofs.length - updated.length });
});

// ── Analytics — tracking beacon ──────────────────────────────────────────────
const TRACKING_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

app.get("/t", (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const ipHash = crypto.createHash("sha256").update(ip + "tlm-salt").digest("hex").slice(0, 16);
    db.prepare(`
      INSERT INTO page_views (page, referrer, utm_source, utm_medium, utm_campaign, ip_hash, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(req.query.p || "/").slice(0, 200),
      String(req.query.r || "").slice(0, 500),
      String(req.query.s || "").slice(0, 100),
      String(req.query.m || "").slice(0, 100),
      String(req.query.c || "").slice(0, 100),
      ipHash,
      String(req.headers["user-agent"] || "").slice(0, 300),
    );
  } catch (e) {
    console.error("[tracking] error:", e.message);
  }
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store" });
  res.send(TRACKING_GIF);
});

// ── Lien bio TikTok traqué → Telegram gratuit ─────────────────────────────────
// Un lien "https://t.me/..." mis directement en bio TikTok n'est JAMAIS
// visible dans page_views (Telegram n'est pas notre serveur). Ce redirect
// passe par nous d'abord : on trace le clic (utm_source=tiktok, ?v= pour
// distinguer chaque video) puis on renvoie vers le canal gratuit. Sans ça,
// impossible de savoir si une video ramene vraiment du monde — constate le
// 04/08/2026 : zero trafic TikTok mesurable malgre le tunnel construit
// autour de TikTok, faute d'un lien traçable a mettre en bio.
const TELEGRAM_FREE_INVITE_LINK = "https://t.me/+qFnIuKg2ZhdlMmY8";
// Lien traqué generique reutilise par tous les canaux (TikTok, Telegram,
// Reddit...) — ?src= choisit la source (defaut "tiktok" pour ne pas casser
// les liens deja en circulation sur la bio TikTok), ?v= identifie la
// campagne/le post precis a l'interieur de cette source.
app.get("/go/tiktok", (req, res) => {
  try {
    const src = String(req.query.src || "tiktok").toLowerCase().slice(0, 40);
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const ipHash = crypto.createHash("sha256").update(ip + "tlm-salt").digest("hex").slice(0, 16);
    db.prepare(`
      INSERT INTO page_views (page, referrer, utm_source, utm_medium, utm_campaign, ip_hash, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "/go/tiktok",
      `${src}_link`,
      src,
      "community_link",
      String(req.query.v || "bio").slice(0, 100),
      ipHash,
      String(req.headers["user-agent"] || "").slice(0, 300),
    );
  } catch (e) {
    console.error("[tracking] /go/tiktok:", e.message);
  }
  res.redirect(302, TELEGRAM_FREE_INVITE_LINK);
});

// Grille tarifaire actuelle (CGV du 14/07/2026) — source unique reutilisee
// par le rapport quotidien ET l'hebdo. L'hebdo utilisait jusqu'ici des prix
// perimes (9.90/19.90 au lieu de 4.90/14.90/29.90, cle "standard" absente) :
// le CA/MRR affiches a Greg etaient sous-estimes. Constate lors de la
// Phase 6 (rapport quotidien enrichi) du 01/08/2026.
const PLAN_PRICES = { standard: 4.90, premium: 14.90, vip: 29.90, elite: 29.90 };

// ── Analytics — daily visitor report (23:00 Paris) ──────────────────────────
function getParisHour() {
  return new Date().toLocaleString("en-US", { timeZone: "Europe/Paris", hour: "numeric", hour12: false });
}

function buildDailyVisitorReport() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT page, referrer, utm_source, utm_medium, utm_campaign, ip_hash
    FROM page_views
    WHERE date(created_at) = ?
  `).all(today);

  const uniqueVisitors = new Set(rows.map(r => r.ip_hash)).size;
  const totalViews = rows.length;

  const byPage = {};
  rows.forEach(r => { byPage[r.page] = (byPage[r.page] || 0) + 1; });

  const bySource = {};
  rows.forEach(r => {
    let src = r.utm_source || "direct";
    if (!r.utm_source && r.referrer) {
      try {
        const host = new URL(r.referrer).hostname.replace("www.", "");
        src = host || "direct";
      } catch { src = r.referrer.slice(0, 40) || "direct"; }
    }
    bySource[src] = (bySource[src] || new Set()).add(r.ip_hash);
  });

  const sourcesLines = Object.entries(bySource)
    .map(([src, ips]) => ({ src, count: ips.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(s => `  ${s.src}: ${s.count} visiteur${s.count > 1 ? "s" : ""}`)
    .join("\n");

  const pagesLines = Object.entries(byPage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p, c]) => `  ${p}: ${c} vues`)
    .join("\n");

  // ── Volet business (Phase 6, 01/08/2026) ──────────────────────────────────
  // Repose entierement sur des donnees DEJA collectees ailleurs (aucune nouvelle
  // table) : signups depuis leads.json, connexions depuis la table sessions
  // (OTP), evenements Stripe reellement traites depuis stripe_processed_events
  // (qui sert deja de verrou d'idempotence webhook, double usage en journal),
  // abonnes actifs + MRR depuis codes.db. Les clics bookmakers et les vues de
  // la section tarifs ne sont PAS inclus : aucune instrumentation frontend ne
  // les capture aujourd'hui (le pixel /t ne logue que des chargements de page
  // entiers), ce serait un chantier a part, pas juste une lecture de donnees
  // existantes.
  let signupsToday = 0;
  try {
    const leadsData = loadLeads();
    signupsToday = leadsData.leads.filter(l => (l.created_at || "").slice(0, 10) === today).length;
  } catch {}

  let loginsToday = 0;
  try {
    loginsToday = db.prepare("SELECT COUNT(DISTINCT email) c FROM sessions WHERE date(created_at) = ?").get(today)?.c || 0;
  } catch {}

  let stripeLines = "  Aucun événement";
  try {
    const evRows = db.prepare(`
      SELECT event_type, COUNT(*) c FROM stripe_processed_events
      WHERE date(processed_at) = ? GROUP BY event_type ORDER BY c DESC
    `).all(today);
    const evLabels = {
      "checkout.session.completed": "Nouveaux paiements",
      "invoice.paid": "Renouvellements",
      "invoice.payment_failed": "Paiements refusés",
      "charge.refunded": "Remboursements",
      "customer.subscription.updated": "Changements de palier",
      "customer.subscription.deleted": "Résiliations effectives",
    };
    if (evRows.length) {
      stripeLines = evRows.map(r => `  ${evLabels[r.event_type] || r.event_type}: ${r.c}`).join("\n");
    }
  } catch (e) { console.error("[analytics] stripe events:", e.message); }

  let tiersLines = "  Aucun abonné actif";
  let mrr = 0;
  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    // stripe_customer_id IS NOT NULL : seul un vrai paiement Stripe (webhook
    // checkout.session.completed) renseigne ce champ. Sans ce filtre, les
    // codes admin/test/famille (ELITE-ADMIN*, comptes de test) gonflaient le
    // MRR affiche a Greg alors qu'aucun d'eux n'est un client reel — constate
    // le 01/08/2026 : les 6 codes actifs avaient TOUS stripe_customer_id=null.
    const tierRows = codesDb.prepare(`
      SELECT plan, COUNT(*) c FROM codes
      WHERE active = 1 AND plan != 'free' AND stripe_customer_id IS NOT NULL
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      GROUP BY plan
    `).all();
    codesDb.close();
    if (tierRows.length) {
      tiersLines = tierRows.map(r => {
        const price = PLAN_PRICES[r.plan] || 0;
        mrr += price * r.c;
        return `  ${r.plan.toUpperCase()}: ${r.c} (${(price * r.c).toFixed(2)}€)`;
      }).join("\n");
    }
  } catch (e) { console.error("[analytics] tiers query:", e.message); }

  return `📊 <b>RAPPORT VISITEURS — ${today}</b>

👥 <b>Visiteurs uniques :</b> ${uniqueVisitors}
👁 <b>Pages vues :</b> ${totalViews}
📧 <b>Nouveaux emails captés :</b> ${signupsToday}
🔑 <b>Connexions (comptes distincts) :</b> ${loginsToday}

🔗 <b>Sources :</b>
${sourcesLines || "  Aucune visite"}

📄 <b>Pages :</b>
${pagesLines || "  Aucune visite"}

💳 <b>Événements Stripe du jour :</b>
${stripeLines}

👑 <b>Abonnés actifs par palier :</b>
${tiersLines}
💰 <b>MRR actuel :</b> ${mrr.toFixed(2)}€

━━━━━━━━━━━━━━━━━━
🤖 Hermès Analytics — Rapport quotidien`;
}

function sendDailyVisitorReport() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return;
  const text = buildDailyVisitorReport();
  sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text).then(ok => {
    console.log(`[analytics] Rapport visiteurs quotidien: ${ok ? "envoyé" : "échec"}`);
  });
}

// ── Analytics — weekly marketing report (Monday 8:00 Paris) ─────────────────
async function buildWeeklyMarketingReport() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  // Visiteurs de la semaine
  const visitorsRow = db.prepare(`
    SELECT COUNT(DISTINCT ip_hash) as visitors, COUNT(*) as views
    FROM page_views WHERE date(created_at) >= ?
  `).get(weekAgo);

  // Visiteurs TikTok
  const tiktokRow = db.prepare(`
    SELECT COUNT(DISTINCT ip_hash) as visitors
    FROM page_views WHERE date(created_at) >= ? AND (utm_source LIKE '%tiktok%' OR referrer LIKE '%tiktok%')
  `).get(weekAgo);

  // Emails récupérés (leads.json)
  let newEmails = 0;
  try {
    const leadsData = loadLeads();
    newEmails = leadsData.leads.filter(l => l.created_at && l.created_at >= weekAgo).length;
  } catch {}

  // Abonnements et CA via la DB codes
  let newSubs = 0;
  let revenue = 0;
  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    // stripe_customer_id IS NOT NULL : voir commentaire equivalent sur le
    // rapport quotidien (01/08/2026) — exclut les codes admin/test/famille du
    // CA affiche.
    const subs = codesDb.prepare(`
      SELECT plan, COUNT(*) as cnt FROM codes
      WHERE active = 1 AND plan != 'free' AND stripe_customer_id IS NOT NULL AND created_at >= ?
      GROUP BY plan
    `).all(weekAgo);
    codesDb.close();
    subs.forEach(s => {
      newSubs += s.cnt;
      revenue += (PLAN_PRICES[s.plan] || 0) * s.cnt;
    });
  } catch (e) {
    console.error("[analytics] codes query:", e.message);
  }

  // Taux de conversion
  const totalVisitors = visitorsRow?.visitors || 0;
  const conversionEmail = totalVisitors > 0 ? ((newEmails / totalVisitors) * 100).toFixed(1) : "0.0";
  const conversionPaid = totalVisitors > 0 ? ((newSubs / totalVisitors) * 100).toFixed(1) : "0.0";

  // Sources de la semaine
  const sourceRows = db.prepare(`
    SELECT
      CASE
        WHEN utm_source LIKE '%tiktok%' OR referrer LIKE '%tiktok%' THEN 'TikTok'
        WHEN utm_source LIKE '%telegram%' OR referrer LIKE '%t.me%' THEN 'Telegram'
        WHEN utm_source LIKE '%google%' OR referrer LIKE '%google%' THEN 'Google'
        WHEN utm_source LIKE '%instagram%' OR referrer LIKE '%instagram%' THEN 'Instagram'
        WHEN utm_source != '' THEN utm_source
        WHEN referrer != '' THEN referrer
        ELSE 'Direct'
      END as source,
      COUNT(DISTINCT ip_hash) as visitors
    FROM page_views WHERE date(created_at) >= ?
    GROUP BY source ORDER BY visitors DESC LIMIT 8
  `).all(weekAgo);
  const sourcesLines = sourceRows.map(s => `  ${s.source}: ${s.visitors}`).join("\n");

  return `📈 <b>RAPPORT MARKETING HEBDO</b>
📅 ${weekAgo} → ${today}

📱 <b>Visiteurs TikTok :</b> ${tiktokRow?.visitors || 0}
👥 <b>Visiteurs totaux :</b> ${totalVisitors}
📧 <b>Emails récupérés :</b> ${newEmails}
💳 <b>Abonnements :</b> ${newSubs}
💶 <b>CA généré :</b> ${revenue.toFixed(2)} €
🎯 <b>Conversion email :</b> ${conversionEmail}%
💰 <b>Conversion payant :</b> ${conversionPaid}%

🔗 <b>Top sources :</b>
${sourcesLines || "  Aucune donnée"}

━━━━━━━━━━━━━━━━━━
🤖 Hermès Analytics — Rapport hebdomadaire`;
}

function sendWeeklyMarketingReport() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return;
  buildWeeklyMarketingReport().then(text => {
    sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text).then(ok => {
      console.log(`[analytics] Rapport marketing hebdo: ${ok ? "envoyé" : "échec"}`);
    });
  });
}

// ── Analytics scheduler ─────────────────────────────────────────────────────
let _lastDailyReportDate = "";
let _lastWeeklyReportDate = "";
let _lastBilanDate = "";
let _lastDailyPickSeedDate = "";
let _lastGainImageDate = "";

// Garantit un pick du jour daté d'AUJOURD'HUI en ligne au plus tard vers
// 4h-5h du matin (demande de Greg le 01/08/2026). L'auto-concile ne
// travaille que sur des matchs déjà EN COURS : très tôt le matin, il n'y a
// souvent encore aucune analyse live datée du jour, et le pick du jour
// restait alors celui de la veille jusqu'à ce qu'un match démarre dans la
// journée. On sème donc, seulement si rien n'existe encore pour aujourd'hui,
// un pick à partir du pool pré-match H2H (déjà filtré ligues fiables +
// seuil 82%, même pipeline que "Matchs à venir" — zéro coût IA).
async function seedDailyPickIfMissingForToday() {
  const todayISO = new Date().toISOString().slice(0, 10);
  try {
    const _db = new Database(DB_PATH, { readonly: true });
    const hasToday = _db.prepare(
      "SELECT 1 FROM concile_analyses WHERE date(analysed_at) = ? AND confidence >= ? LIMIT 1"
    ).get(todayISO, getPublishedMinConfidence());
    _db.close();
    if (hasToday) return; // un match du jour existe déjà, rien à semer

    const DAILY_PICK_ALLOWED_BETS = new Set(["Victoire domicile", "Victoire extérieur", "BTTS Oui", "BTTS Non", "Under 2.5 buts"]);
    const upcoming = (await computeUpcomingPicks()).data;
    const seedable = upcoming.filter(p =>
      (p.kickoff || "").slice(0, 10) === todayISO && DAILY_PICK_ALLOWED_BETS.has(p.bet)
    );
    if (!seedable.length) { console.log("[daily-pick] seed 4-5h : aucun candidat H2H pour aujourd'hui, pick inchangé"); return; }
    const best = seedable[0];
    const data = { currentPick: {
      home: best.home, away: best.away, competition: best.competition, sport: best.sport,
      date: todayISO, time: "", best_bet: best.bet, confidence: best.confidence,
      cote: null, bookmaker: null, raison: "Statistique de confrontations directes (H2H) réelles.",
      home_logo: best.home_logo || null, away_logo: best.away_logo || null,
      home_form: null, away_form: null, home_goals_avg: null, away_goals_avg: null,
      matchTime: best.kickoff || null, source: "auto-h2h-seed", publishedAt: new Date().toISOString(),
      status: "upcoming", score: null,
    } };
    try { fs.writeFileSync(HERMES_PICKS_PATH, JSON.stringify(data, null, 2)); }
    catch (e) { console.error("[daily-pick] seed ecriture:", e.message); return; }
    try {
      db.prepare(`
        INSERT INTO daily_pick_log (date, home, away, competition, sport, bet, confidence, cote, outcome, final_score_home, final_score_away, home_logo, away_logo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          home=excluded.home, away=excluded.away, competition=excluded.competition, sport=excluded.sport,
          bet=excluded.bet, confidence=excluded.confidence, cote=excluded.cote,
          home_logo=excluded.home_logo, away_logo=excluded.away_logo
      `).run(todayISO, best.home, best.away, best.competition, best.sport, best.bet, best.confidence, null, best.home_logo || null, best.away_logo || null);
    } catch (e) { console.error("[daily-pick] seed log historique:", e.message); }
    console.log(`[daily-pick] seed 4-5h: ${best.home} vs ${best.away} (${best.competition}) conf ${best.confidence}`);
  } catch (e) { console.error("[daily-pick] seedDailyPickIfMissingForToday:", e.message); }
}

// ── Rapport de performance hebdo : où l'on gagne / où l'on perd ───────────────
function buildPerformanceReport(days = 7) {
  const sinceDays = Math.max(1, days);
  const rows = db.prepare(`
    SELECT competition, sport, best_bet, confidence, outcome, real_odd, analysed_at
    FROM concile_analyses
    WHERE outcome IN ('win','loss')
      AND analysed_at >= datetime('now', ?)
  `).all(`-${sinceDays} days`);

  if (!rows.length) return null;

  const profitOf = (r) => {
    const cote = rowOdd(r);
    return r.outcome === "win" ? (10 * cote - 10) : -10;
  };

  const byComp = {};
  const byMarket = {};
  let gWins = 0, gProfit = 0;
  for (const r of rows) {
    const p = profitOf(r);
    gProfit += p;
    if (r.outcome === "win") gWins++;

    const comp = r.competition || r.sport || "Inconnu";
    (byComp[comp] = byComp[comp] || { total: 0, wins: 0, profit: 0 });
    byComp[comp].total++; byComp[comp].profit += p;
    if (r.outcome === "win") byComp[comp].wins++;

    const mk = categorizeBet(r.best_bet);
    if (mk !== "NO BET") {
      (byMarket[mk] = byMarket[mk] || { total: 0, wins: 0, profit: 0 });
      byMarket[mk].total++; byMarket[mk].profit += p;
      if (r.outcome === "win") byMarket[mk].wins++;
    }
  }

  const total = rows.length;
  const gWinrate = Math.round(gWins / total * 100);

  const compArr = Object.entries(byComp).map(([name, s]) => ({
    name, ...s, winrate: Math.round(s.wins / s.total * 100),
  }));
  const marketArr = Object.entries(byMarket).map(([name, s]) => ({
    name, ...s, winrate: Math.round(s.wins / s.total * 100),
  }));

  // Rentables / perdantes : min 3 analyses pour éviter le bruit
  const eligible = compArr.filter(c => c.total >= 3);
  const winners = [...eligible].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const losers = [...eligible].sort((a, b) => a.profit - b.profit).filter(c => c.profit < 0).slice(0, 5);

  const fmt = (v) => (v >= 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
  const line = (c) => `  • ${c.name} : ${c.winrate}% (${c.wins}/${c.total}) · ${fmt(c.profit)}€`;

  let text = `📊 <b>RAPPORT PERFORMANCE — ${sinceDays} derniers jours</b>\n\n`;
  text += `🌍 <b>Global :</b> ${total} analyses · ${gWinrate}% réussite · <b>${fmt(gProfit)}€</b> (10€/pick)\n\n`;

  if (winners.length) {
    text += `✅ <b>TES LIGUES RENTABLES :</b>\n${winners.filter(c => c.profit >= 0).map(line).join("\n") || "  (aucune positive)"}\n\n`;
  }
  if (losers.length) {
    text += `❌ <b>TES LIGUES PERDANTES (à éviter) :</b>\n${losers.map(line).join("\n")}\n\n`;
  }

  const marketsSorted = marketArr.filter(m => m.total >= 3).sort((a, b) => b.profit - a.profit);
  if (marketsSorted.length) {
    text += `🎯 <b>PAR TYPE DE PARI :</b>\n${marketsSorted.map(line).join("\n")}\n\n`;
  }

  const bestMk = marketsSorted[0];
  const worstMk = marketsSorted[marketsSorted.length - 1];
  const recoParts = [];
  if (winners[0] && winners[0].profit > 0) recoParts.push(`privilégie ${winners[0].name}`);
  if (bestMk && bestMk.profit > 0) recoParts.push(`marché ${bestMk.name}`);
  if (losers[0]) recoParts.push(`évite ${losers[0].name}`);
  if (worstMk && worstMk.profit < 0 && worstMk !== bestMk) recoParts.push(`prudence sur ${worstMk.name}`);
  if (recoParts.length) text += `💡 <b>Reco :</b> ${recoParts.join(" · ")}.\n\n`;

  text += `━━━━━━━━━━━━━━━━━━\n🤖 Hermes — Auto-analyse de tes résultats réels`;
  return text;
}

async function sendPerformanceReportTelegram(days = 7) {
  if (!TELEGRAM_ADMIN_CHAT_ID) return false;
  try {
    const text = buildPerformanceReport(days);
    if (!text) {
      return await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, "📊 Rapport performance : pas assez d'analyses résolues sur la période.");
    }
    return await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text);
  } catch (e) {
    console.error("[perf-report]", e.message);
    return false;
  }
}

app.get("/admin/performance-report", async (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorise" });
  const days = Math.max(1, Math.min(90, parseInt(req.query.days) || 7));
  const ok = await sendPerformanceReportTelegram(days);
  res.json({ ok, message: ok ? "Rapport performance envoyé sur Telegram admin" : "Echec envoi" });
});

// ── Rapport d'apprentissage quotidien : montre qu'Hermes progresse ───────────
function buildLearningReport() {
  const threshold = getAdaptiveSignalThreshold();

  // Classement des agents par winrate réel (poids appliqué par le Chief)
  const perf = getAgentPerformance();
  const agents = Object.entries(perf)
    .map(([name, p]) => ({ name, wr: p.winrate, resolved: p.resolved }))
    .filter(a => a.resolved > 0)
    .sort((a, b) => (b.wr || 0) - (a.wr || 0));
  const agentLines = agents.length
    ? agents.map(a => `  ${a.wr >= 60 ? "✅" : a.wr >= 50 ? "➖" : "⚠️"} ${a.name} : ${a.wr}% (${a.resolved})`).join("\n")
    : "  (pas encore de prédictions résolues)";

  // Compétitions auto-exclues (boucle d'auto-amélioration)
  const weak = [...getUnderperformingCompetitions()];
  const weakLine = weak.length ? weak.slice(0, 8).join(", ") : "aucune";

  // Calibration : le seuil tient-il ses promesses ?
  let calibLine = "données insuffisantes";
  try {
    const c = db.prepare(`
      SELECT COUNT(*) t, SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) w
      FROM concile_analyses WHERE confidence >= ? AND outcome IN ('win','loss')
    `).get(threshold);
    if (c && c.t >= 10) {
      const realWr = Math.round(c.w / c.t * 100);
      const gap = realWr - threshold;
      const verdict = Math.abs(gap) <= 5 ? "✅ bien calibré" : gap < -5 ? "⚠️ trop optimiste" : "💪 marge de sécurité";
      calibLine = `signaux ≥${threshold}% → winrate réel ${realWr}% (${c.t} analyses) — ${verdict}`;
    }
  } catch (e) {}

  // Top segments rentables (7 jours) via les stats de segment
  const seg = getSegmentStats();
  const compArr = Object.entries(seg.comp)
    .map(([name, s]) => ({ name, wr: Math.round(s.w / s.t * 100), t: s.t }))
    .filter(c => c.t >= 5)
    .sort((a, b) => b.wr - a.wr);
  const topComps = compArr.slice(0, 4).map(c => `  ✅ ${c.name} : ${c.wr}% (${c.t})`).join("\n") || "  (historique en construction)";

  const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" });
  return `🧠 <b>RAPPORT D'APPRENTISSAGE — ${date}</b>

🎚 <b>Seuil signal actuel :</b> ${threshold}% (auto-ajusté)
🎯 <b>Calibration :</b> ${calibLine}

🤖 <b>Fiabilité des IA (poids appliqué) :</b>
${agentLines}

🏆 <b>Meilleurs segments (prouvés) :</b>
${topComps}

🚫 <b>Compétitions auto-exclues :</b> ${weakLine}

━━━━━━━━━━━━━━━━━━
🤖 Hermes apprend de chaque résultat — mise à jour quotidienne`;
}

async function sendLearningReportTelegram() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return false;
  try {
    return await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, buildLearningReport());
  } catch (e) {
    console.error("[learning-report]", e.message);
    return false;
  }
}

app.get("/admin/learning-report", async (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorise" });
  const ok = await sendLearningReportTelegram();
  res.json({ ok, message: ok ? "Rapport d'apprentissage envoyé sur Telegram admin" : "Echec envoi" });
});

let _lastPerfReportDate = "";
let _lastHealthCheckDate = "";
let _lastMorningAuditDate = "";
// Anti-spam des alertes « palier à sec » : une seule alerte par palier, réarmée
// automatiquement dès qu'un signal repart sur ce palier.
// Persistee en base, pas en memoire : un `_dryTierAlerted` en RAM repartait a
// zero a chaque redemarrage du conteneur (docker compose up --build), donc
// chaque deploiement pendant une heure multiple de 6 relancait l'alerte. Trois
// deploiements en une heure = neuf messages "PALIER A SEC" identiques recus
// le 29/07/2026 (12h26, 12h35, 12h47) alors que rien n'avait change entre eux.
db.exec(`
  CREATE TABLE IF NOT EXISTS dry_tier_alerts (
    tier TEXT PRIMARY KEY,
    alerted_at TEXT NOT NULL
  );
`);
function dryTierAlreadySent(tier) {
  const row = db.prepare("SELECT alerted_at FROM dry_tier_alerts WHERE tier = ?").get(tier);
  return !!row;
}
function markDryTierAlerted(tier) {
  db.prepare("INSERT INTO dry_tier_alerts (tier, alerted_at) VALUES (?, datetime('now')) ON CONFLICT(tier) DO UPDATE SET alerted_at = excluded.alerted_at").run(tier);
}
function clearDryTierAlert(tier) {
  db.prepare("DELETE FROM dry_tier_alerts WHERE tier = ?").run(tier);
}

// ── AUTO 1 — Bilan de santé quotidien (7h Paris, canal admin) ────────────────
// Sert à détecter en 24h ce qui, sinon, passe inaperçu : un canal injoignable, un
// palier qui ne diffuse plus, un agent muet. C'est exactement ce qui a manqué le
// 24/07 quand le bot avait été exclu du canal Premium.
// ── Audit matinal complet (07/08/2026) ────────────────────────────────────────
// Demande du fondateur apres une panne totale du Concile passee inapercue :
// 93% des analyses sans aucun vote, 100% sans consensus, zero signal diffuse
// pendant 48h. Le bilan de sante de 7h existait deja mais il ne TESTAIT rien —
// il comptait des sorties. Un systeme mort produit des sorties vides, donc un
// compteur a zero ressemble a une journee calme, pas a une panne.
//
// Cet audit appelle reellement chaque dependance et rapporte OK / PANNE.
// Il tourne avant le bilan quotidien pour que la panne soit lue en premier.
// ── Reparation automatique des modeles (07/08/2026) ──────────────────────────
// Demande du fondateur : "lorsque tu vas auditer chaque matin, verifier, et si
// un lien est mort, tu le remplaces par une autre IA".
//
// Le test n'est pas un simple ping : le modele doit produire un avis exploitable
// sur les SIX marches reellement diffuses (demande explicite du fondateur) —
// plus/moins de 2.5 buts, les deux equipes marquent, victoire domicile,
// victoire exterieur, but en premiere mi-temps. Un modele qui repond "OK" a un
// ping mais ne sait pas remplir ce format ne sert a rien au Concile.
const MARCHES_TESTES = "buts=o2.5:70,btts=oui:60,resultat=dom:65,mt1=oui:55";
const SONDE_MARCHES = `Tu analyses un match de football. Reponds UNIQUEMENT par cette ligne, en remplacant les valeurs :
MARCHES : ${MARCHES_TESTES}
Codes : buts=o2.5 ou u2.5 | btts=oui ou non | resultat=dom, ext ou nul | mt1=oui ou non`;

// Familles ecartees d'office comme remplacantes : gratuites (quota nul et
// retirees sans preavis — c'est exactement ce qui vient d'arriver), lots
// asynchrones, alias instables prefixes "~", et modeles specialises hors sujet.
// Ajouts du 07/08/2026 apres une substitution ratee en production : le filtre
// a retenu "mistralai/voxtral-small-24b-2507" — un modele AUDIO — parce qu'il
// arrivait en tete d'un tri alphabetique inverse. Les modalites non textuelles
// et les modeles specialises n'ont rien a faire dans un concile d'analyse.
const REMPLACANT_INTERDIT = /(:free|:batch|^~|guard|-code|embed|rerank|vision|image|tts|whisper|voxtral|audio|speech|ocr|moderation|codestral|devstral|math|translate)/i;

// Sonde volontairement TOLERANTE. Version du 07/08/2026 corrigee le jour meme :
// avec max_tokens=80 et une exigence de format stricte, un modele bavard ou qui
// ajoute une phrase d'introduction etait declare mort alors qu'il repondait tres
// bien. Constate en production — qwen3.7-max et kimi-k3, tous deux valides par
// un appel direct, ont ete remplaces a tort. Un faux positif coute cher : il
// evince un bon modele. Un faux negatif ne coute rien : on garde l'existant.
async function sondeModele(modelId, essais = 2) {
  let dernier = "aucune reponse";
  for (let n = 0; n < essais; n++) {
    try {
      const r = await httpPost("https://openrouter.ai/api/v1/chat/completions",
        { model: modelId, messages: [{ role: "user", content: SONDE_MARCHES }], max_tokens: 250, temperature: 0.1 },
        { Authorization: `Bearer ${OPENROUTER_API_KEY}` }, 25000);
      const txt = r?.choices?.[0]?.message?.content || "";
      if (!txt) { dernier = String(r?.error?.message || "aucune reponse").slice(0, 55); continue; }
      // On CHERCHE les marches dans la reponse au lieu d'exiger une ligne exacte :
      // un preambule ou un retour a la ligne ne sont pas des defauts de fond.
      const manquants = ["buts", "btts", "resultat", "mt1"].filter(k => !new RegExp(k + "\\s*[=:]", "i").test(txt));
      if (!manquants.length) return { ok: true, why: "repond sur les 6 marches" };
      dernier = `format incomplet (manque ${manquants.join(", ")})`;
    } catch (e) {
      dernier = String(e.message).slice(0, 55);
    }
  }
  return { ok: false, why: dernier };
}

// Modeles reellement appeles par le Concile. Cle = identifiant historique
// (celui qui figure dans le code), valeur = role, pour un message lisible.
const MODELES_CONCILE = {
  "perplexity/sonar-pro": "Perplexity-Web",
  "deepseek/deepseek-chat": "DeepSeek",
  "mistralai/mistral-large": "Mistral-Large",
  "cohere/command-r-plus": "Qwen-3.7-Max",
  "moonshotai/kimi-k3": "Kimi",
  "mistralai/mistral-7b-instruct:free": "Mistral-7B (banc d'essai)",
};

// Deux identifiants ont la meme FORME quand ils ne different que par leurs
// chiffres : "qwen3.7-max" et "qwen3.8-max" oui, "qwen3.7-max" et
// "qwen3.7-flash" non. Sans ce garde-fou, une "mise a jour" ferait glisser un
// modele haut de gamme vers une variante rapide et moins fine, ou l'inverse.
function formeModele(id) {
  return String(id).split("/")[1].replace(/[0-9]+/g, "#");
}
function numerosModele(id) {
  return (String(id).split("/")[1].match(/[0-9]+/g) || []).map(Number);
}
function estPlusRecent(candidat, actuel) {
  if (formeModele(candidat) !== formeModele(actuel)) return false;
  const a = numerosModele(candidat), b = numerosModele(actuel);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? -1, y = b[i] ?? -1;
    if (x !== y) return x > y;
  }
  return false;
}

// Sieges de secours quand une famille entiere disparait du catalogue. Le Concile
// vaut par ses CINQ votes : s'il en manque un, le quorum de 3 devient beaucoup
// plus dur a atteindre et la confiance retombe a 55%. Mieux vaut un agent d'une
// autre famille qu'un siege vide. Ordre choisi par le fondateur (07/08/2026) :
// Kimi d'abord, puis Qwen.
const AGENTS_DE_SECOURS = ["moonshotai/kimi-k3", "qwen/qwen3.7-max"];

async function auditAndRepairModels() {
  if (!OPENROUTER_API_KEY) return { lignes: ["🔴 Modeles — aucune cle OpenRouter"], pannes: ["Modeles"] };
  const catalogue = await httpGet("https://openrouter.ai/api/v1/models", { Authorization: `Bearer ${OPENROUTER_API_KEY}` });
  const dispo = (catalogue?.data || []).map(m => m.id);
  if (!dispo.length) return { lignes: ["🔴 Modeles — catalogue OpenRouter injoignable"], pannes: ["Modeles"] };

  const lignes = [];
  const pannes = [];
  const repares = [];
  // Familles deja occupees : le Concile ne vaut que par la DIVERSITE de ses
  // ecoles de modeles. Constate en production le 07/08/2026 : deux sieges se
  // sont retrouves sur du Kimi (kimi-k2-thinking et kimi-k2.5). Deux variantes
  // du meme modele se trompent ensemble — le vote a cinq perd tout son sens.
  const famillesPrises = new Set();
  for (const [logique, role] of Object.entries(MODELES_CONCILE)) {
    let actuel = resolveModel(logique);
    // Auto-guerison : si le modele d'origine refonctionne, on revient dessus et
    // on efface la substitution. Sans ca, un remplacement decide un jour de
    // panne passagere deviendrait definitif.
    if (actuel !== logique) {
      const retour = await sondeModele(logique);
      if (retour.ok) {
        db.prepare("DELETE FROM model_overrides WHERE logical_id = ?").run(logique);
        _modelOverrideCache.at = 0;
        actuel = logique;
        lignes.push(`↩️ ${role} — retour au modele d'origine ${logique} (il refonctionne)`);
        console.log(`[modeles] ${logique} : substitution annulee, le modele d'origine repond a nouveau`);
      }
    }
    // Une substitution passee peut pointer vers un modele que le filtre rejette
    // aujourd'hui (voxtral, un modele AUDIO, a ete retenu le 07/08/2026 avant
    // que le filtre soit elargi). Il "repond" donc la sonde le declare valide et
    // il resterait en place indefiniment. On le traite comme mort pour forcer un
    // nouveau choix.
    const interdit = actuel !== logique && REMPLACANT_INTERDIT.test(actuel);
    const sonde = interdit
      ? { ok: false, why: "modele non conforme au filtre (modalite ou specialite hors sujet)" }
      : await sondeModele(actuel);
    if (sonde.ok) {
      famillesPrises.add(actuel.split("/")[0]);
      // Le modele repond. On regarde quand meme si le fournisseur a publie une
      // version plus recente de CE modele precis (demande du fondateur :
      // "si elle a une nouvelle version sur OpenRouter, upgrade-la
      // automatiquement"). La nouvelle version est sondee sur les six marches
      // avant d'etre adoptee — on ne bascule jamais a l'aveugle.
      const plusRecents = dispo
        .filter(id => !REMPLACANT_INTERDIT.test(id) && estPlusRecent(id, actuel))
        .sort((a, b) => {
          const x = numerosModele(a), y = numerosModele(b);
          for (let i = 0; i < Math.max(x.length, y.length); i++) {
            if ((x[i] ?? -1) !== (y[i] ?? -1)) return (y[i] ?? -1) - (x[i] ?? -1);
          }
          return 0;
        });
      for (const neuf of plusRecents.slice(0, 2)) {
        const t = await sondeModele(neuf);
        if (!t.ok) continue;
        db.prepare(`INSERT INTO model_overrides (logical_id, model_id, replaced_at, reason)
                    VALUES (?,?,datetime('now'),?)
                    ON CONFLICT(logical_id) DO UPDATE SET model_id=excluded.model_id,
                      replaced_at=excluded.replaced_at, reason=excluded.reason`)
          .run(logique, neuf, `mise a jour depuis ${actuel}`);
        _modelOverrideCache.at = 0;
        repares.push(`${role} ⬆ ${neuf}`);
        lignes.push(`⬆️ ${role} — ${actuel} → <b>${neuf}</b> (version plus recente)`);
        console.log(`[modeles] ${logique} mis a jour : ${actuel} -> ${neuf}`);
        break;
      }
      if (!repares.some(r => r.startsWith(`${role} ⬆`))) lignes.push(`✅ ${role} — ${actuel}`);
      continue;
    }

    // Mort : on cherche un remplacant dans la MEME famille, en testant du plus
    // recent au plus ancien. Meme famille = meme ecole de modele, ce qui
    // preserve la diversite d'architectures qui fait la valeur du Concile.
    const famille = logique.split("/")[0];
    // Ordre de preference : d'abord les modeles de MEME FORME que l'actuel
    // (meme nom, numero different — donc meme gamme), ensuite le reste de la
    // famille. Le tri alphabetique inverse seul avait retenu "voxtral" et
    // "command-r7b" plutot que les modeles de la bonne gamme.
    const memeForme = [], memeFamille = [];
    dispo.filter(id => id.startsWith(famille + "/") && id !== actuel && !REMPLACANT_INTERDIT.test(id))
      .forEach(id => { (formeModele(id) === formeModele(actuel) ? memeForme : memeFamille).push(id); });
    const parNumero = (a, b) => {
      const x = numerosModele(a), y = numerosModele(b);
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        if ((x[i] ?? -1) !== (y[i] ?? -1)) return (y[i] ?? -1) - (x[i] ?? -1);
      }
      return 0;
    };
    const candidats = [...memeForme.sort(parNumero), ...memeFamille.sort(parNumero)];
    let remplace = null;
    for (const c of candidats.slice(0, 4)) {
      const t = await sondeModele(c);
      if (t.ok) { remplace = c; break; }
    }
    if (remplace) {
      db.prepare(`INSERT INTO model_overrides (logical_id, model_id, replaced_at, reason)
                  VALUES (?,?,datetime('now'),?)
                  ON CONFLICT(logical_id) DO UPDATE SET model_id=excluded.model_id,
                    replaced_at=excluded.replaced_at, reason=excluded.reason`)
        .run(logique, remplace, `${actuel} : ${sonde.why}`);
      _modelOverrideCache.at = 0; // force la relecture au prochain appel
      famillesPrises.add(remplace.split("/")[0]);
      repares.push(`${role} → ${remplace}`);
      lignes.push(`🔧 ${role} — ${actuel} mort (${sonde.why}), remplace par ${remplace}`);
      console.log(`[modeles] ${logique} remplace par ${remplace} — ${sonde.why}`);
    } else {
      // Famille entiere indisponible : plutot qu'un siege vide au Concile, on
      // occupe la place avec un agent de secours qui repond, meme d'une autre
      // ecole. Cinq votants valent mieux que quatre : le quorum de 3 devient
      // sinon tres difficile a atteindre et tout retombe a 55%.
      let secours = null;
      for (const cand of AGENTS_DE_SECOURS) {
        const vrai = resolveModel(cand);
        if (vrai === actuel) continue;
        // Jamais deux sieges sur la meme ecole de modele : ils voteraient
        // ensemble et le quorum de trois ne prouverait plus rien.
        if (famillesPrises.has(vrai.split("/")[0])) continue;
        const t = await sondeModele(vrai);
        if (t.ok) { secours = vrai; break; }
      }
      if (secours) {
        db.prepare(`INSERT INTO model_overrides (logical_id, model_id, replaced_at, reason)
                    VALUES (?,?,datetime('now'),?)
                    ON CONFLICT(logical_id) DO UPDATE SET model_id=excluded.model_id,
                      replaced_at=excluded.replaced_at, reason=excluded.reason`)
          .run(logique, secours, `famille ${famille} indisponible : ${sonde.why}`);
        _modelOverrideCache.at = 0;
        famillesPrises.add(secours.split("/")[0]);
        repares.push(`${role} → ${secours} (secours)`);
        lignes.push(`🪑 ${role} — famille ${famille} indisponible, siege occupe par ${secours}`);
        console.log(`[modeles] ${logique} : siege de secours ${secours}`);
      } else {
        pannes.push(role);
        lignes.push(`🔴 ${role} — ${actuel} mort (${sonde.why}), aucun remplacant NI secours`);
        console.error(`[modeles] ${logique} mort sans remplacant ni secours — ${sonde.why}`);
      }
    }
  }
  return { lignes, pannes, repares };
}

// ── Promotion d'un challenger au Concile (07/08/2026) ────────────────────────
// Demande du fondateur : "si tu trouves une IA meilleure que celle du Concile,
// tu la remplaces". Source de verite choisie par lui : SA propre base, pas un
// classement public. Un modele qui domine un classement generaliste n'est pas
// forcement bon pour predire un Under 2.5 sur un match de Conference League —
// seul le winrate sur ses vrais matchs le dit.
//
// Le banc d'essai (shadow_evals) tourne deja : les challengers analysent les
// memes matchs que les titulaires, en parallele, sans influencer aucun signal
// diffuse. Il manquait uniquement la decision.
// Correspondance agent -> identifiant logique de son modele. Sert a appliquer
// une promotion : on fait pointer le siege du titulaire sortant vers le modele
// du challenger, via la meme table model_overrides que les substitutions.
// Les challengers hors OpenRouter (Groq, Cerebras, Mistral direct) ne sont pas
// listes : leur promotion demanderait de changer de fournisseur au milieu du
// Concile, ce qui n'est pas une bascule d'identifiant mais un autre chantier.
const MODELE_DES_AGENTS = {
  "Perplexity-Web": "perplexity/sonar-pro",
  "DeepSeek-V3": "deepseek/deepseek-chat",
  "Mistral-Large": "mistralai/mistral-small-2603",
  "Qwen-3.7-Max": "qwen/qwen3.7-max",
  "OpenRouter-Qwen": "qwen/qwen3.7-max",
  "OpenRouter-Kimi": "moonshotai/kimi-k2",
  "OR-Qwen37Max": "qwen/qwen3.7-max",
  "OR-KimiK3": "moonshotai/kimi-k3",
  "OR-Mistral7B": "mistralai/mistral-7b-instruct:free",
};

const PROMO_MIN_RESOLUS = Math.max(20, Number(process.env.PROMO_MIN_RESOLUS || 50));
const PROMO_MARGE_MINI = Math.max(1, Number(process.env.PROMO_MARGE_MINI || 5));

function auditAgentsEtPromotion() {
  const lignes = [];
  const promotions = [];
  try {
    const stats = (table) => db.prepare(`
      SELECT agent_name,
             SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
             SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM ${table} WHERE outcome IN ('win','loss') GROUP BY agent_name
    `).all().map(r => {
      const resolus = (r.wins || 0) + (r.losses || 0);
      return { nom: r.agent_name, resolus, winrate: resolus ? Math.round(r.wins / resolus * 100) : null };
    }).filter(r => r.resolus >= PROMO_MIN_RESOLUS)
      .sort((a, b) => b.winrate - a.winrate);

    // Ne comparer que les CINQ titulaires actuels. L'ancienne version incluait
    // GROQ-Llama et d'autres agents retires, puis demandait de remplacer un
    // siege qui n'existait plus : faux diagnostic vu dans l'audit du 26/08.
    const titulaires = stats("agent_predictions")
      .filter(r => CONCILE_AGENT_NAMES.includes(r.nom));
    const modelesActifs = new Set(CONCILE_AGENT_NAMES
      .map(nom => MODELE_DES_AGENTS[nom])
      .filter(Boolean)
      .map(resolveModel));
    const challengers = stats("shadow_evals")
      .filter(r => {
        const logique = MODELE_DES_AGENTS[r.nom];
        return !logique || !modelesActifs.has(resolveModel(logique));
      });
    if (!titulaires.length || !challengers.length) {
      lignes.push(`ℹ️ Classement IA — echantillon insuffisant (${PROMO_MIN_RESOLUS} pronostics resolus requis par IA)`);
      return { lignes, promotions };
    }

    const meilleurChallenger = challengers[0];
    const plusFaibleTitulaire = titulaires[titulaires.length - 1];
    lignes.push(`📊 Meilleur titulaire ${titulaires[0].nom} ${titulaires[0].winrate}% · plus faible ${plusFaibleTitulaire.nom} ${plusFaibleTitulaire.winrate}% · meilleur challenger ${meilleurChallenger.nom} ${meilleurChallenger.winrate}%`);

    // Marge exigee : un ecart de 1 ou 2 points sur quelques dizaines de matchs
    // n'est que du bruit. On ne remplace un titulaire que sur un ecart net.
    const ecart = meilleurChallenger.winrate - plusFaibleTitulaire.winrate;
    if (ecart < PROMO_MARGE_MINI) {
      lignes.push(`✅ Concile — aucun challenger ne depasse un titulaire de ${PROMO_MARGE_MINI} points (ecart actuel ${ecart})`);
      return { lignes, promotions };
    }

    // Promotion APPLIQUEE automatiquement (decision du fondateur, 07/08/2026 :
    // "tu dois toujours garder les meilleurs, et si tu fais un changement tu me
    // le dis"). Le siege du titulaire sortant est pointe vers le modele du
    // challenger, via la meme table model_overrides que les substitutions de
    // modeles morts. Le changement est annonce dans le rapport du matin.
    const cibleSortant = MODELE_DES_AGENTS[plusFaibleTitulaire.nom];
    const modeleEntrant = MODELE_DES_AGENTS[meilleurChallenger.nom];
    if (cibleSortant && modeleEntrant) {
      const vraiModeleEntrant = resolveModel(modeleEntrant);
      db.prepare(`INSERT INTO model_overrides (logical_id, model_id, replaced_at, reason)
                  VALUES (?,?,datetime('now'),?)
                  ON CONFLICT(logical_id) DO UPDATE SET model_id=excluded.model_id,
                    replaced_at=excluded.replaced_at, reason=excluded.reason`)
        .run(cibleSortant, vraiModeleEntrant,
             `promotion : ${meilleurChallenger.nom} ${meilleurChallenger.winrate}% remplace ${plusFaibleTitulaire.nom} ${plusFaibleTitulaire.winrate}%`);
      _modelOverrideCache.at = 0;
      promotions.push({ entrant: meilleurChallenger, sortant: plusFaibleTitulaire, ecart, modele: vraiModeleEntrant });
      lignes.push(`🏅 <b>CHANGEMENT AU CONCILE</b> — ${meilleurChallenger.nom} (${meilleurChallenger.winrate}% sur ${meilleurChallenger.resolus}) remplace ${plusFaibleTitulaire.nom} (${plusFaibleTitulaire.winrate}% sur ${plusFaibleTitulaire.resolus}), ecart ${ecart} points`);
      lignes.push(`   → siege ${plusFaibleTitulaire.nom} pointe desormais sur <b>${vraiModeleEntrant}</b>`);
      console.log(`[promotion] ${meilleurChallenger.nom} remplace ${plusFaibleTitulaire.nom} (${cibleSortant} -> ${vraiModeleEntrant})`);
    } else {
      // Challenger hors OpenRouter : on ne peut pas basculer par simple
      // changement d'identifiant, on signale sans rien casser.
      promotions.push({ entrant: meilleurChallenger, sortant: plusFaibleTitulaire, ecart, modele: null });
      lignes.push(`🏅 <b>Promotion a faire a la main</b> — ${meilleurChallenger.nom} (${meilleurChallenger.winrate}%) bat ${plusFaibleTitulaire.nom} (${plusFaibleTitulaire.winrate}%) de ${ecart} points, mais il change de fournisseur : bascule manuelle requise`);
    }

    // Meilleur agent PAR MARCHE : une IA peut etre moyenne au general et
    // excellente sur un marche precis. C'est la que se gagne le winrate.
    const marches = db.prepare(`
      SELECT agent_name, market_line,
             SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
             SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM agent_market_predictions WHERE outcome IN ('win','loss')
      GROUP BY agent_name, market_line
    `).all();
    const libelles = { buts: "Plus/moins de 2.5", btts: "Les deux marquent", resultat: "Victoire dom/ext", mt1: "But 1re mi-temps" };
    const meilleurs = {};
    marches.forEach(r => {
      const resolus = (r.wins || 0) + (r.losses || 0);
      if (resolus < 15) return;
      const wr = Math.round(r.wins / resolus * 100);
      if (!meilleurs[r.market_line] || wr > meilleurs[r.market_line].wr) {
        meilleurs[r.market_line] = { nom: r.agent_name, wr, resolus };
      }
    });
    const parMarche = Object.entries(meilleurs)
      .map(([k, v]) => `${libelles[k] || k} → ${v.nom} ${v.wr}% (${v.resolus})`);
    if (parMarche.length) lignes.push(`🎯 Meilleure IA par marche : ${parMarche.join(" · ")}`);
  } catch (e) {
    lignes.push(`🔴 Classement IA — ${String(e.message).slice(0, 60)}`);
  }
  return { lignes, promotions };
}

// Paliers de solde OpenRouter, en dollars — l'API facture en $, pas en €.
// Valeurs fixees par le fondateur : orange a 3, rouge a 1.
const SOLDE_ORANGE = Number(process.env.SOLDE_ORANGE || 3);
const SOLDE_ROUGE  = Number(process.env.SOLDE_ROUGE  || 1);

async function runMorningAudit() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return false;
  const lignes = [];
  const pannes = [];
  const avertissements = [];
  const test = async (nom, fn) => {
    try {
      const r = await fn();
      if (r && r.ok) { lignes.push(`✅ ${nom} — ${r.info}`); }
      else if (r && r.niveau === "orange") {
        // Un avertissement n'est pas une panne : le service fonctionne encore.
        // Le compter comme panne banaliserait l'entete rouge, qui doit rester
        // reservee a ce qui est reellement casse.
        lignes.push(`🟠 ${nom} — ${r.info}`);
        avertissements.push(nom);
      }
      else { lignes.push(`🔴 ${nom} — ${r?.info || "echec"}`); pannes.push(nom); }
    } catch (e) {
      lignes.push(`🔴 ${nom} — ${String(e.message).slice(0, 70)}`);
      pannes.push(nom);
    }
  };

  // 1. Le compte OpenRouter : solde restant et autonomie estimee.
  //    Demande du fondateur (07/08/2026) : "dis-moi chaque jour combien il reste
  //    sur OpenRouter pour qu'on ne soit pas sans analyse". /api/v1/key ne donne
  //    que la consommation ; le solde reellement recharge est dans
  //    /api/v1/credits. On croise les deux pour sortir une autonomie en JOURS,
  //    seul chiffre qui permette de recharger avant la panne plutot qu'apres.
  await test("Solde OpenRouter", async () => {
    if (!OPENROUTER_API_KEY) return { ok: false, info: "aucune cle configuree" };
    const entete = { Authorization: `Bearer ${OPENROUTER_API_KEY}` };
    const cle = await httpGet("https://openrouter.ai/api/v1/key", entete);
    const d = cle?.data;
    if (!d) return { ok: false, info: "cle refusee par OpenRouter" };

    const parJour = Number(d.usage_daily || 0);
    const credits = await httpGet("https://openrouter.ai/api/v1/credits", entete);
    const achetes = Number(credits?.data?.total_credits ?? NaN);
    const consommes = Number(credits?.data?.total_usage ?? d.usage ?? 0);
    // Un plafond de cle, s'il existe, prime : il coupe avant le solde reel.
    const plafond = d.limit === null || d.limit === undefined ? null : Number(d.limit) - Number(d.usage || 0);
    const solde = Number.isFinite(achetes) ? achetes - consommes : plafond;

    if (solde === null || !Number.isFinite(solde)) {
      return { ok: true, info: `${consommes.toFixed(2)}$ consommes au total · ${parJour.toFixed(2)}$ aujourd'hui · solde non communique par OpenRouter` };
    }
    // Autonomie sur la moyenne des 7 derniers jours de production, plus fiable
    // que la consommation du jour meme (nulle a 6h du matin).
    let moyenne = parJour;
    try {
      const r = db.prepare("SELECT COUNT(*) n FROM concile_analyses WHERE analysed_at >= ?")
        .get(new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 19).replace("T", " "));
      // 5 appels IA par analyse, cout observe ~0.0012$ l'appel.
      const estime = ((r?.n || 0) / 7) * 5 * 0.0012;
      moyenne = Math.max(parJour, estime);
    } catch (e) { /* on garde parJour */ }
    const jours = moyenne > 0.005 ? Math.floor(solde / moyenne) : null;
    const detail = `<b>${solde.toFixed(2)}$ restants</b> · ${parJour.toFixed(2)}$ consommes aujourd'hui` +
      (jours !== null ? ` · autonomie ~${jours} jour${jours > 1 ? "s" : ""}` : "");
    // Paliers fixes par le fondateur (07/08/2026) : orange a 3, rouge a 1.
    // Un palier sur le SOLDE en plus de l'autonomie : l'autonomie depend du
    // volume de matchs, qui s'effondre en treve puis explose a la reprise. Un
    // solde de 2$ parait confortable le 14 aout et ne tient pas trois jours
    // le 16.
    if (solde <= SOLDE_ROUGE) return { ok: false, info: `${detail} — <b>RECHARGE MAINTENANT</b>, les analyses vont s'arreter` };
    if (solde <= SOLDE_ORANGE) return { ok: false, niveau: "orange", info: `${detail} — pense a recharger` };
    if (jours !== null && jours <= 7) return { ok: false, niveau: "orange", info: `${detail} — moins d'une semaine d'autonomie` };
    return { ok: true, info: detail };
  });

  // 1bis. Chaque modele du Concile, teste sur les six marches reellement
  //       diffuses, et remplace automatiquement s'il a disparu du catalogue.
  let reparation = { lignes: [], pannes: [], repares: [] };
  try {
    reparation = await auditAndRepairModels();
    lignes.push(...reparation.lignes);
    pannes.push(...reparation.pannes);
  } catch (e) {
    lignes.push(`🔴 Modeles — audit impossible : ${String(e.message).slice(0, 60)}`);
    pannes.push("Modeles");
  }

  // 2. Le Concile lui-meme : est-ce qu'il DELIBERE, pas seulement qu'il tourne.
  await test("Concile (vote des IA)", async () => {
    const depuis = new Date(Date.now() - 24 * 3600e3).toISOString().slice(0, 19).replace("T", " ");
    const rows = db.prepare("SELECT confidence, consensus_votes FROM concile_analyses WHERE analysed_at >= ?").all(depuis);
    if (!rows.length) return { ok: true, info: "aucune analyse en 24h (treve ou nuit)" };
    const sansVote = Math.round(rows.filter(r => !r.consensus_votes).length / rows.length * 100);
    const sansCons = Math.round(rows.filter(r => Number(r.confidence) <= 55).length / rows.length * 100);
    if (sansVote >= 25) return { ok: false, info: `${sansVote}% sans aucun vote sur ${rows.length} analyses` };
    if (sansCons >= 50) return { ok: false, info: `${sansCons}% sans consensus sur ${rows.length} analyses` };
    return { ok: true, info: `${rows.length} analyses, ${sansVote}% sans vote, ${sansCons}% sans consensus` };
  });

  // 3. Volume métier : zéro signal peut être parfaitement normal avec les filtres
  // stricts 4/5. Le transport Telegram est contrôlé séparément juste après.
  await test("Volume de signaux", async () => {
    const depuis = new Date(Date.now() - 48 * 3600e3).toISOString().slice(0, 19).replace("T", " ");
    const rows = db.prepare("SELECT sig_sent_standard s, sig_sent_premium p, sig_sent_elite e FROM concile_analyses WHERE analysed_at >= ?").all(depuis);
    const envoyes = rows.filter(r => r.s === 1 || r.p === 1 || r.e === 1).length;
    if (rows.length >= 30 && envoyes === 0) {
      return { ok: false, niveau: "orange", info: `0 signal admissible sur ${rows.length} analyses en 48h — filtres 4/5, transport vérifié séparément` };
    }
    return { ok: true, info: `${envoyes} signaux diffusés en 48h` };
  });

  // 4. Les canaux existent-ils toujours et le bot y a-t-il acces.
  await test("Canaux Telegram", async () => {
    if (!TELEGRAM_BOT_TOKEN) return { ok: false, info: "aucun token" };
    const canaux = [["Gratuit", TELEGRAM_CHANNEL_ID], ["Standard", TELEGRAM_STANDARD_CHANNEL_ID],
                    ["Premium", TELEGRAM_PREMIUM_CHANNEL_ID]];
    const morts = [];
    for (const [nom, id] of canaux) {
      if (!id) { morts.push(`${nom} non configure`); continue; }
      const r = await httpGet(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(id)}`);
      if (!r?.ok) morts.push(nom);
    }
    return morts.length ? { ok: false, info: `injoignables : ${morts.join(", ")}` } : { ok: true, info: "3 canaux clients joignables" };
  });

  // 5. Paiements. Sans Stripe, aucun abonnement ne peut etre pris.
  await test("Stripe", async () => {
    if (!STRIPE_SECRET_KEY) return { ok: false, info: "aucune cle" };
    const r = await httpGet("https://api.stripe.com/v1/balance", { Authorization: `Bearer ${STRIPE_SECRET_KEY}` });
    return r && !r.error ? { ok: true, info: "API joignable" } : { ok: false, info: String(r?.error?.message || "refus").slice(0, 60) };
  });

  // 6. Emails.
  await test("Brevo", async () => {
    if (!BREVO_API_KEY) return { ok: false, info: "aucune cle" };
    const r = await httpGet("https://api.brevo.com/v3/account", { "api-key": BREVO_API_KEY });
    return r && !r.code ? { ok: true, info: "API joignable" } : { ok: false, info: String(r?.message || "refus").slice(0, 60) };
  });

  // 7. Quota de donnees sportives : a sec, plus aucun match n'entre. On
  //    interroge le compteur REEL du fournisseur, pas notre comptage local.
  await test("Quota API-Sports", async () => {
    const q = await checkApiSportsRealQuota();
    if (q?.error) return { ok: false, info: String(q.error).slice(0, 70) };
    return q.pct >= 90
      ? { ok: false, info: `${q.pct}% consomme (${q.used}/${q.limit})` }
      : { ok: true, info: `${q.pct}% consomme (${q.used}/${q.limit})` };
  });

  // 8. Le site repond-il aux visiteurs.
  await test("Site public", async () => {
    const r = await new Promise((res) => {
      const q = require("https").get(SITE_BASE_URL, (x) => { x.resume(); res(x.statusCode); });
      q.on("error", () => res(0)); q.setTimeout(8000, () => { q.destroy(); res(0); });
    });
    return r === 200 ? { ok: true, info: "HTTP 200" } : { ok: false, info: `HTTP ${r || "injoignable"}` };
  });

  // 8ter. Preuve chiffree sur les appels agents. C'est ce bloc qui doit
  //       trancher entre "timeout trop court" et "autre cause" — sans lui, on
  //       ne ferait que deplacer une hypothese. Les percentiles comptent plus
  //       que la moyenne : si le p90 colle au plafond du timeout, c'est lui.
  try {
    const depuis = new Date(Date.now() - 24 * 3600e3).toISOString().slice(0, 19).replace("T", " ");
    const appels = db.prepare("SELECT agent_name, duree_ms, issue, vote_produit FROM agent_calls WHERE created_at >= ?").all(depuis);
    if (appels.length) {
      const parIssue = {};
      appels.forEach(a => { parIssue[a.issue] = (parIssue[a.issue] || 0) + 1; });
      const durees = appels.map(a => a.duree_ms).sort((x, y) => x - y);
      const pc = (q) => durees[Math.min(durees.length - 1, Math.floor(durees.length * q))];
      const plafond = Math.max(2000, Number(process.env.AGENT_TIMEOUT_MS) || 10000);
      const votes = appels.filter(a => a.vote_produit === 1).length;
      lignes.push("", `🔬 <b>Appels agents (24h)</b> — ${appels.length} tentatives, ${votes} votes produits`);
      lignes.push(`   issues : ${Object.entries(parIssue).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
      lignes.push(`   durees : mediane ${pc(0.5)}ms · p90 ${pc(0.9)}ms · max ${durees[durees.length - 1]}ms (plafond ${plafond}ms)`);
      const timeouts = parIssue.timeout || 0;
      const partTimeout = Math.round(timeouts / appels.length * 100);
      lignes.push(pc(0.9) >= plafond * 0.9 || partTimeout >= 20
        ? `   → <b>le plafond est bien le facteur limitant</b> (${partTimeout}% de timeouts, p90 a ${pc(0.9)}ms)`
        : `   → le plafond n'est PAS le facteur limitant (${partTimeout}% de timeouts) : chercher ailleurs`);
      // Par agent : identifie un fournisseur precis plutot qu'un probleme global.
      const parAgent = {};
      appels.forEach(a => {
        parAgent[a.agent_name] = parAgent[a.agent_name] || { n: 0, ko: 0, v: 0, somme: 0 };
        const e = parAgent[a.agent_name];
        e.n++; e.somme += a.duree_ms;
        if (a.issue !== "ok") e.ko++;
        if (a.vote_produit === 1) e.v++;
      });
      Object.entries(parAgent).sort((a, b) => b[1].ko - a[1].ko).slice(0, 6).forEach(([nom, e]) => {
        lignes.push(`   ${nom} : ${e.v}/${e.n} votes · ${Math.round(e.somme / e.n)}ms moyen · ${e.ko} echecs`);
      });
    } else {
      lignes.push("", `🔬 Appels agents — aucune trace sur 24h (telemetrie posee ce soir, elle se remplira au prochain match)`);
    }
  } catch (e) { lignes.push(`🔴 Telemetrie agents — ${String(e.message).slice(0, 60)}`); }

  // 8bis. Mode shadow du routage par specialiste : ce qu'il AURAIT change.
  //       Aucune de ces analyses n'a ete diffusee — le rapport sert uniquement
  //       a decider, sur deux semaines de donnees reelles, s'il vaut la peine
  //       d'etre active.
  try {
    const r = db.prepare(`
      SELECT COUNT(*) total,
             SUM(CASE WHEN outcome='win'  THEN 1 ELSE 0 END) gagnes,
             SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) perdus
      FROM routage_shadow`).get() || {};
    const tranches = (r.gagnes || 0) + (r.perdus || 0);
    if (r.total) {
      const wr = tranches ? Math.round(r.gagnes / tranches * 100) : null;
      // Mise a 10€ par signal, comme partout ailleurs dans le projet, et cote
      // moyenne prudente de 1.75 : ces analyses n'ont pas de cote reelle
      // puisqu'elles n'ont jamais ete diffusees.
      const profit = tranches ? Math.round((r.gagnes * 7.5) - (r.perdus * 10)) : null;
      lignes.push("", `🧪 <b>Routage par specialiste — mode shadow (non applique)</b>`);
      lignes.push(`   ${r.total} analyses recuperees qui finissaient a 55% sans signal`);
      lignes.push(tranches
        ? `   ${tranches} tranchees : ${r.gagnes} gagnees / ${r.perdus} perdues — <b>${wr}%</b>${profit !== null ? ` · ${profit >= 0 ? "+" : ""}${profit}€ simules (mise 10€, cote 1.75)` : ""}`
        : `   aucune encore tranchee — verdict impossible pour l'instant`);
      if (tranches >= 30) {
        lignes.push(wr >= 60
          ? `   → au-dessus de 60% sur ${tranches} resultats : activation defendable (ROUTAGE_MODE=actif)`
          : `   → sous 60% sur ${tranches} resultats : ne pas activer`);
      } else {
        lignes.push(`   → 30 resultats tranches minimum avant toute decision (${tranches} pour l'instant)`);
      }
    }
  } catch (e) { lignes.push(`🔴 Routage shadow — ${String(e.message).slice(0, 60)}`); }

  // 9. Classement des IA sur les resultats reels + proposition de promotion.
  try {
    const cl = auditAgentsEtPromotion();
    lignes.push("", ...cl.lignes);
  } catch (e) {
    lignes.push(`🔴 Classement IA — ${String(e.message).slice(0, 60)}`);
  }

  const repares = reparation.repares || [];
  if (repares.length) lignes.push("", `🔧 <b>${repares.length} modele(s) remplace(s) automatiquement</b> : ${repares.join(" · ")}`);
  const entete = pannes.length
    ? `🚨 <b>AUDIT MATINAL — ${pannes.length} PANNE${pannes.length > 1 ? "S" : ""}</b>\n\n<b>${pannes.join(", ")}</b>`
    : avertissements.length
      ? `🟠 <b>AUDIT MATINAL — ${avertissements.length} point${avertissements.length > 1 ? "s" : ""} a surveiller</b>\n\n<b>${avertissements.join(", ")}</b>`
      : "✅ <b>AUDIT MATINAL — tout fonctionne</b>";
  const msg = [entete, "", ...lignes, "", "━━━━━━━━━━━━━━━━━━", "👑 Hermès — audit automatique du matin"].join("\n");
  const ok = await sendHermesDailyDigest(msg);
  console.log(`[audit-matinal] ${pannes.length} panne(s) : ${pannes.join(", ") || "aucune"} — envoi ${ok ? "OK" : "ECHEC"}`);
  return ok;
}

async function sendDailyHealthCheck() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return false;
  try {
    // Diffusion de la veille, comptée sur les colonnes réellement marquées à l'envoi.
    const d = db.prepare(`
      SELECT COUNT(*) AS analyses,
             COALESCE(SUM(sig_sent_free),0)     AS free,
             COALESCE(SUM(sig_sent_standard),0) AS standard,
             COALESCE(SUM(sig_sent_premium),0)  AS premium,
             COALESCE(SUM(sig_sent_elite),0)    AS elite
      FROM concile_analyses
      WHERE date(analysed_at) = date('now','-1 day')
    `).get() || {};

    // Résultats des matchs RÉSOLUS hier (resolved_at, pas analysed_at : une analyse
    // de la veille peut n'être tranchée que le lendemain).
    const r = db.prepare(`
      SELECT COALESCE(SUM(outcome='win'),0) AS wins, COALESCE(SUM(outcome='loss'),0) AS losses,
             COALESCE(SUM(CASE WHEN outcome='win' THEN real_odd*10-10 ELSE -10 END),0) AS profit
      FROM concile_analyses
      WHERE outcome IN ('win','loss') AND date(resolved_at) = date('now','-1 day')
        AND real_odd >= ${TIER_MIN_REAL_ODD}
        AND real_odd <= ${TIER_MAX_REAL_ODD}
    `).get() || {};
    const resolved = (r.wins || 0) + (r.losses || 0);
    const wr = resolved > 0 ? Math.round((r.wins / resolved) * 1000) / 10 : null;

    const agents = db.prepare(`
      SELECT agent_name, winrate, total_predictions FROM agent_weights
      WHERE total_predictions >= 50 ORDER BY winrate DESC
    `).all();
    const best = agents[0], worst = agents[agents.length - 1];

    const paid = (d.standard || 0) + (d.premium || 0) + (d.elite || 0);
    const head = paid === 0
      ? "🔴 <b>BILAN SANTÉ — aucun signal payant hier</b>"
      : "📊 <b>BILAN SANTÉ QUOTIDIEN</b>";

    const lines = [
      head, "",
      `📡 <b>Diffusion d'hier</b> (${d.analyses || 0} analyses)`,
      `🆓 Gratuit : ${d.free || 0}`,
      `🟢 Standard : ${d.standard || 0} / ${STANDARD_SIGNAL_DAILY_CAP}`,
      `🟣 Premium : ${d.premium || 0} / ${PREMIUM_SIGNAL_DAILY_CAP}`,
      `🟠 Elite : ${d.elite || 0} / ${ELITE_SIGNAL_DAILY_CAP}`,
      "",
      `📈 <b>Résultats tranchés hier</b>`,
      resolved > 0
        ? `✅ ${r.wins} gagnés · ❌ ${r.losses} perdus · ${wr}%\n💰 ${r.profit >= 0 ? "+" : ""}${Math.round(r.profit)}€ (mise 10€)`
        : `Aucun résultat tranché`,
      "",
      best ? `🏆 Meilleur agent : ${best.agent_name} (${best.winrate}%)` : "",
      worst && worst !== best ? `⚠️ Plus faible : ${worst.agent_name} (${worst.winrate}%)` : "",
      "",
      "━━━━━━━━━━━━━━━━━━",
      "👑 Hermès — supervision interne",
    ].filter(Boolean);

    const ok = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, lines.join("\n"));
    console.log(`[health-check] bilan quotidien : ${ok ? "OK" : "ECHEC"}`);
    return ok;
  } catch (e) {
    console.error("[health-check]", e.message);
    return false;
  }
}

// ── AUTO 2 — Alerte « palier à sec » (toutes les 6h) ─────────────────────────
// Un abonné payant qui ne reçoit rien se désabonne sans prévenir. Les seuils sont
// INVERSÉS par rapport à l'intuition d'Hermès : le palier d'entrée payant est le
// plus fragile commercialement, pas le plus tolérant.
const DRY_TIER_DAYS = { standard: 3, premium: 3, elite: 2 };
async function checkDryTiers() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return;
  try {
    const q = db.prepare(`
      SELECT
        MAX(CASE WHEN sig_sent_standard=1 THEN analysed_at END) AS standard,
        MAX(CASE WHEN sig_sent_premium=1  THEN analysed_at END) AS premium,
        MAX(CASE WHEN sig_sent_elite=1    THEN analysed_at END) AS elite
      FROM concile_analyses
    `).get() || {};
    // Distingue « plus de matchs analysés » de « filtre trop sévère » : c'est le
    // diagnostic qui a manqué quand le seuil Standard à 92 ne laissait rien passer.
    const produced = db.prepare(`
      SELECT COUNT(*) AS n FROM concile_analyses WHERE analysed_at >= datetime('now','-1 day')
    `).get().n || 0;

    for (const tier of ["standard", "premium", "elite"]) {
      const last = q[tier];
      const days = last ? (Date.now() - new Date(last.replace(" ", "T") + "Z").getTime()) / 86400000 : 999;
      const limit = DRY_TIER_DAYS[tier];
      if (days < limit) { clearDryTierAlert(tier); continue; } // réarmement
      if (dryTierAlreadySent(tier)) continue;                  // déjà alerté, survit à un redémarrage
      markDryTierAlerted(tier);

      const conf = tier === "standard" ? STANDARD_MIN_CONF : tier === "premium" ? PREMIUM_MIN_CONF : getEliteMinConf();
      const cause = produced === 0
        ? "Aucune analyse produite sur 24h → problème d'alimentation (API matchs, scheduler)."
        : `${produced} analyses produites sur 24h mais aucune retenue → filtre trop sévère (confiance ≥ ${conf} ou cote réelle entre ${TIER_MIN_REAL_ODD} et ${TIER_MAX_REAL_ODD}).`;

      const msg = [
        `🚨 <b>PALIER À SEC — ${tier.toUpperCase()}</b>`, "",
        `Aucun signal depuis <b>${last ? Math.floor(days) + " jour(s)" : "toujours"}</b> (seuil d'alerte : ${limit} j)`,
        last ? `Dernier envoi : ${last}` : "",
        "",
        `🔍 ${cause}`,
        "",
        `📌 Vérifier la distribution avant de toucher aux seuils :`,
        `<code>/tier-stats</code> et la requête §2 de ETAT_DES_LIEUX.md`,
        "",
        "━━━━━━━━━━━━━━━━━━",
        "👑 Hermès — supervision interne",
      ].filter(Boolean).join("\n");

      const ok = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, msg);
      console.log(`[dry-tier] alerte ${tier} (${Math.floor(days)}j sans signal) : ${ok ? "OK" : "ECHEC"}`);
    }
  } catch (e) {
    console.error("[dry-tier]", e.message);
  }
}
let _lastLearningReportDate = "";

function checkAnalyticsSchedule() {
  const now = new Date();
  const parisStr = now.toLocaleString("en-GB", { timeZone: "Europe/Paris" });
  const [datePart, timePart] = parisStr.split(", ");
  const hour = parseInt(timePart.split(":")[0]);
  const day = now.toLocaleDateString("en-US", { timeZone: "Europe/Paris", weekday: "long" });
  const todayKey = now.toISOString().slice(0, 10);

  // Miniature "combien on aurait gagne" a minuit (demande de Greg, 01/08/2026).
  // Envoyee en apercu admin tant que DAILY_GAIN_IMAGE_PUBLIC n'est pas active.
  // Toutes les taches de ce planificateur utilisent ">=" (pas "===") : un
  // redemarrage du conteneur qui tombe pile sur le creneau horaire faisait
  // sauter la tache pour toute la journee, sans aucune trace d'erreur (bilan
  // du 03/08/2026 jamais envoye, constate par Greg le 04/08/2026 — le
  // conteneur avait redemarre plusieurs fois ce jour-la). ">=" rattrape la
  // tache des le prochain passage de checkAnalyticsSchedule, meme apres 22h.
  if (hour >= 0 && _lastGainImageDate !== todayKey) {
    _lastGainImageDate = todayKey;
    console.log("[gain-image] Génération miniatures quotidiennes (minuit, rattrapage si necessaire)...");
    sendDailyGainImages();
  }

  // Le seed pre-match H2H est volontairement desactive : le produit client
  // repose desormais uniquement sur un signal live O/U 2,5 effectivement
  // diffuse entre la 15e et la 40e minute.

  if (hour >= 22 && _lastBilanDate !== todayKey) {
    _lastBilanDate = todayKey;
    console.log("[bilan-stats] Envoi bilan quotidien 22h sur Telegram admin (rattrapage si necessaire)...");
    sendStatsBilanTelegram().then(ok => console.log(`[bilan-stats] ${ok ? "OK" : "ECHEC"}`));
    if (_lastFreeResultsBilanDate !== todayKey) {
      _lastFreeResultsBilanDate = todayKey;
      console.log("[daily-results-free] Envoi résultats du jour sur canal gratuit (rattrapage si necessaire)...");
      sendDailyResultsFreeChannel().then(ok => console.log(`[daily-results-free] ${ok ? "OK" : "SKIP/ECHEC"}`));
    }
  }

  if (hour >= 23 && _lastDailyReportDate !== todayKey) {
    _lastDailyReportDate = todayKey;
    console.log("[analytics] Envoi rapport visiteurs quotidien (23h, rattrapage si necessaire)...");
    sendDailyVisitorReport();
  }

  if (hour >= 23 && _lastLearningReportDate !== todayKey) {
    _lastLearningReportDate = todayKey;
    console.log("[analytics] Envoi rapport d'apprentissage quotidien (23h, rattrapage si necessaire)...");
    sendLearningReportTelegram().then(ok => console.log(`[learning-report] ${ok ? "OK" : "ECHEC"}`));
  }

  // Campagne nurturing "ce que tu aurais gagne" — mardi + vendredi, 10h Paris.
  // Frequence volontairement faible (pas quotidienne) pour ne pas lasser les
  // abonnes (demande fondateur, 30/07/2026).
  if ((day === "Tuesday" || day === "Friday") && hour === 10 && _lastOutperformEmailDate !== todayKey) {
    _lastOutperformEmailDate = todayKey;
    console.log("[outperform-email] Envoi campagne nurturing (mar/ven 10h)...");
    sendOutperformEmails();
  }

  if (day === "Monday" && hour === 8 && _lastWeeklyReportDate !== todayKey) {
    _lastWeeklyReportDate = todayKey;
    console.log("[analytics] Envoi rapport marketing hebdo (lundi 8h)...");
    sendWeeklyMarketingReport();
  }

  if (day === "Monday" && hour === 9 && _lastPerfReportDate !== todayKey) {
    _lastPerfReportDate = todayKey;
    console.log("[analytics] Envoi rapport performance hebdo (lundi 9h)...");
    sendPerformanceReportTelegram(7).then(ok => console.log(`[perf-report] ${ok ? "OK" : "ECHEC"}`));
  }

  // AUTO 0 — audit matinal complet (6h Paris), AVANT le bilan de 7h : une panne
  // doit se lire en premier. ">=" comme les autres taches, pour rattraper si le
  // conteneur redemarre pile sur le creneau.
  if (hour >= 6 && _lastMorningAuditDate !== todayKey) {
    _lastMorningAuditDate = todayKey;
    console.log("[audit-matinal] Lancement de l'audit complet...");
    runMorningAudit().catch(e => console.error("[audit-matinal]", e.message));
  }

  // AUTO 1 — bilan de santé quotidien (7h Paris)
  if (hour === 7 && _lastHealthCheckDate !== todayKey) {
    _lastHealthCheckDate = todayKey;
    console.log("[health-check] Envoi bilan de santé quotidien (7h)...");
    sendDailyHealthCheck();
  }

  // AUTO 2 — paliers à sec, contrôlé toutes les 6h (0h / 6h / 12h / 18h)
  if (hour % 6 === 0) checkDryTiers();

  // Watchdog anti-perte : détecte une chute brutale du nombre d'analyses
  dataIntegrityWatchdog();

  // AUTO 3 — surveillance du Concile. checkAnalyticsSchedule() tourne toutes
  // les 60 SECONDES (setInterval plus bas) : sans cette garde horaire, le
  // watchdog rejouait deux balayages de concile_analyses chaque minute, soit
  // 2880 par jour pour trois controles qui n'ont de sens qu'a l'heure.
  // Defaut trouve en relecture le 07/08/2026, corrige avant mise en service.
  if (_lastConcileWatchdogHour !== hour) {
    _lastConcileWatchdogHour = hour;
    concileHealthWatchdog();
  }
}

// ── Surveillance du Concile (07/08/2026) ──────────────────────────────────────
// Ne existait pas : Hermes produisait les analyses mais rien ne surveillait leur
// QUALITE. Constate ce jour-la sur 7 jours : 311 analyses, 5 signaux diffuses,
// 192 analyses (62%) sorties a 55% « aucun consensus », 76 sans le moindre vote,
// et jamais une seule fois les 5 IA d'accord. Personne n'a ete prevenu — le
// fondateur l'a decouvert en demandant trois fois pourquoi il ne recevait rien.
//
// Un systeme qui tourne seul la nuit doit crier quand il deraille. Trois
// signaux d'alerte, chacun limite a un envoi par 12h pour ne pas harceler.
const CONCILE_ALERT_COOLDOWN_MS = 12 * 3600 * 1000;
const _concileAlerts = { agents: 0, consensus: 0, diffusion: 0 };
let _lastConcileWatchdogHour = -1;

function concileHealthWatchdog() {
  if (!TELEGRAM_ADMIN_CHAT_ID) {
    console.log("[concile-watchdog] inactif : TELEGRAM_ADMIN_CHAT_ID absent");
    return;
  }
  try {
    const depuis24h = new Date(Date.now() - 24 * 3600e3).toISOString().slice(0, 19).replace("T", " ");
    const depuis48h = new Date(Date.now() - 48 * 3600e3).toISOString().slice(0, 19).replace("T", " ");
    const rows24 = db.prepare(
      "SELECT confidence, consensus_votes, sig_sent_standard, sig_sent_premium, sig_sent_elite" +
      " FROM concile_analyses WHERE analysed_at >= ?"
    ).all(depuis24h);
    // Sous 20 analyses, les pourcentages ne veulent rien dire (treve, nuit,
    // redemarrage). On ne declenche rien plutot que d'alerter sur du bruit.
    // ⚠️ Consequence assumee : pendant une treve, un Concile reellement casse
    // reste silencieux. La surveillance couvre le fonctionnement nominal, pas
    // l'intersaison — c'est un choix, pas un oubli.
    if (rows24.length < 20) {
      console.log(`[concile-watchdog] actif — ${rows24.length} analyses/24h, sous le seuil de 20, aucun controle`);
      return;
    }

    const maintenant = Date.now();
    // Trace de vie : sans elle, impossible de distinguer "surveillance active
    // et tout va bien" de "surveillance jamais appelee".
    const _sv = rows24.filter(r => !r.consensus_votes).length;
    const _sc = rows24.filter(r => Number(r.confidence) <= 55).length;
    console.log(`[concile-watchdog] actif — ${rows24.length} analyses/24h, ` +
      `sans vote ${Math.round(_sv / rows24.length * 100)}% (alerte a 25), ` +
      `sans consensus ${Math.round(_sc / rows24.length * 100)}% (alerte a 50)`);
    const alerte = (cle, msg) => {
      if (maintenant - _concileAlerts[cle] < CONCILE_ALERT_COOLDOWN_MS) return;
      _concileAlerts[cle] = maintenant;
      console.error(`[concile-watchdog] ${cle} : alerte envoyee`);
      sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, msg).catch(() => {});
    };

    // 1. Agents muets — le plus grave : le Concile ne delibere pas du tout.
    const sansVote = rows24.filter(r => !r.consensus_votes).length;
    const pctSansVote = Math.round((sansVote / rows24.length) * 100);
    if (pctSansVote >= 25) {
      alerte("agents", `🔴 <b>Concile : les IA ne repondent plus</b>\n\n` +
        `<b>${sansVote}</b> analyses sur ${rows24.length} (${pctSansVote}%) n'ont recu <b>aucun vote</b> en 24h.\n\n` +
        `Les agents echouent silencieusement : cle expiree, quota depasse ou fournisseur injoignable. ` +
        `Tant que ca dure, chaque analyse coute des jetons pour un verdict vide.\n\n` +
        `<code>docker logs touslesmatchs-api --tail 400 | grep "aucun vote exploitable"</code>`);
    }

    // 2. Non-consensus chronique — les IA repondent mais ne convergent jamais.
    const sansConsensus = rows24.filter(r => Number(r.confidence) <= 55).length;
    const pctSansConsensus = Math.round((sansConsensus / rows24.length) * 100);
    if (pctSansConsensus >= 50) {
      alerte("consensus", `🟠 <b>Concile : pas de consensus</b>\n\n` +
        `<b>${sansConsensus}</b> analyses sur ${rows24.length} (${pctSansConsensus}%) sortent a 55% ` +
        `« aucun consensus » en 24h.\n\n` +
        `Il faut 3 IA d'accord sur le MEME marche pour qu'un signal existe. ` +
        `Au-dela de 50%, ce n'est plus de la prudence, c'est un dysfonctionnement : ` +
        `agents en echec, ou marches proposes trop dispersés pour converger.`);
    }

    // 3. Production sans diffusion — le tunnel se remplit, rien n'en sort.
    const rows48 = db.prepare(
      "SELECT sig_sent_standard, sig_sent_premium, sig_sent_elite" +
      " FROM concile_analyses WHERE analysed_at >= ?"
    ).all(depuis48h);
    const diffuses48 = rows48.filter(r => r.sig_sent_standard === 1 || r.sig_sent_premium === 1 || r.sig_sent_elite === 1).length;
    if (rows48.length >= 30 && diffuses48 === 0) {
      alerte("diffusion", `🟡 <b>Aucun signal diffuse depuis 48h</b>\n\n` +
        `<b>${rows48.length}</b> analyses produites, <b>0</b> envoyee sur Telegram.\n\n` +
        `Le budget IA est consomme sans qu'aucun abonne ne recoive quoi que ce soit. ` +
        `Motifs a verifier :\n` +
        `<code>docker exec touslesmatchs-api node -e "const d=require('better-sqlite3');const b=new d('/data/tlm.db',{readonly:true});const c=new Date(Date.now()-48*36e5).toISOString().slice(0,19).replace('T',' ');const m={};b.prepare('SELECT diffusion_block b FROM concile_analyses WHERE analysed_at>=?').all(c).forEach(x=>{const k=x.b||'(aucun)';m[k]=(m[k]||0)+1});console.log(m)"</code>`);
    }
  } catch (e) {
    console.error("[concile-watchdog]", e.message);
  }
}

// ── Watchdog d'intégrité : alerte si la base perd des données ──────────────────
// Mémorise le pic historique de lignes. Si le compte chute de plus de 20% par
// rapport au pic (signature d'un wipe / down -v), alerte l'admin sur Telegram et
// déclenche un snapshot de secours. Ne bloque jamais l'app — surveillance seule.
let _peakAnalysesCount = 0;
let _lastWipeAlert = 0;
function dataIntegrityWatchdog() {
  try {
    const c = db.prepare("SELECT COUNT(*) c FROM concile_analyses").get()?.c ?? 0;
    if (c > _peakAnalysesCount) _peakAnalysesCount = c;
    // Chute > 20% du pic, pic significatif, pas d'alerte dans la dernière heure
    if (_peakAnalysesCount >= 50 && c < _peakAnalysesCount * 0.8 && Date.now() - _lastWipeAlert > 3600000) {
      _lastWipeAlert = Date.now();
      const msg = `🚨 <b>ALERTE PERTE DE DONNÉES</b>\n\nLes analyses sont passées de <b>${_peakAnalysesCount}</b> à <b>${c}</b> lignes.\n\nCause probable : rebuild/volume Docker effacé. Restaure le dernier snapshot :\n<code>ls -1t /opt/touslesmatchs/data/snapshots/ | head</code>\n\nHermès n'a PAS le droit de supprimer des données — vérifie ce qui s'est passé.`;
      console.error(`[watchdog] CHUTE DE DONNÉES: ${_peakAnalysesCount} → ${c}`);
      if (typeof TELEGRAM_ADMIN_CHAT_ID !== "undefined" && TELEGRAM_ADMIN_CHAT_ID) {
        sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, msg).catch(() => {});
      }
      // Snapshot de secours immédiat de l'état actuel (même réduit) pour forensics
      try { bootSnapshot(); } catch (_) {}
    }
  } catch (e) { /* table absente au tout premier boot — ignorer */ }
}

const PORT = process.env.PORT || 3001;
// ── Internal — liste abonnés expirant dans N jours (pour Hermès) ─────────────
app.get("/internal/expiring-codes", (req, res) => {
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  const secret = req.headers["x-internal-secret"];
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false });
  const days = parseInt(req.query.days) || 7;
  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
    const rows = codesDb.prepare(
      "SELECT email, plan, expires_at FROM codes WHERE active = 1 AND plan != 'free' AND expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at"
    ).all(cutoff);
    codesDb.close();
    const withDiff = rows.map(r => ({
      ...r,
      daysLeft: Math.round((new Date(r.expires_at) - now) / 86400000)
    }));
    res.json({ ok: true, count: withDiff.length, expiring: withDiff });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Admin Dashboard — aggregated data endpoint ──────────────────────────────
app.get("/admin/dashboard-data", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });

  try {
    // ── Health ──
    const health = {
      api: { status: "ok", uptime: Math.round(process.uptime()) },
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1048576),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1048576),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1048576),
      },
      node: process.version,
      dbSize: (() => {
        try { return Math.round(fs.statSync(DB_PATH).size / 1048576); } catch { return null; }
      })(),
    };

    // ── Business — subscriptions ──
    let business = { users: {}, expiring_soon: 0, expired_total: 0 };
    try {
      const codesDb = new Database(CODES_DB_PATH, { readonly: true });
      const all = codesDb.prepare("SELECT plan, active, expires_at, email, created_at FROM codes").all();
      codesDb.close();
      const now = new Date();
      const active = all.filter(r => r.active === 1);
      const counts = { free: 0, premium: 0, vip: 0, elite: 0, total: active.length };
      active.forEach(r => { if (counts[r.plan] !== undefined) counts[r.plan]++; });
      const expiring3d = active.filter(r => {
        if (!r.expires_at) return false;
        const d = Math.round((new Date(r.expires_at) - now) / 86400000);
        return d >= 0 && d <= 3;
      }).length;
      const expired = all.filter(r => r.expires_at && new Date(r.expires_at) < now).length;
      const newToday = all.filter(r => r.created_at && r.created_at.slice(0, 10) === now.toISOString().slice(0, 10)).length;
      business = { users: counts, expiring_soon: expiring3d, expired_total: expired, new_today: newToday };
    } catch (e) { business.error = e.message; }

    // ── Analytics — visitors ──
    let analytics = {};
    try {
      const today = new Date().toISOString().slice(0, 10);
      const todayRows = db.prepare("SELECT ip_hash, page, utm_source, referrer FROM page_views WHERE date(created_at) = ?").all(today);
      const uniqueToday = new Set(todayRows.map(r => r.ip_hash)).size;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const yesterdayCount = db.prepare("SELECT COUNT(DISTINCT ip_hash) as c FROM page_views WHERE date(created_at) = ?").get(yesterday);
      const last7 = db.prepare("SELECT date(created_at) as d, COUNT(DISTINCT ip_hash) as visitors, COUNT(*) as views FROM page_views WHERE created_at >= datetime('now', '-7 days') GROUP BY d ORDER BY d").all();
      const topPages = {};
      todayRows.forEach(r => { topPages[r.page] = (topPages[r.page] || 0) + 1; });
      const topSources = {};
      todayRows.forEach(r => {
        let src = r.utm_source || "direct";
        if (!r.utm_source && r.referrer) {
          try { src = new URL(r.referrer).hostname.replace("www.", "") || "direct"; } catch { src = "direct"; }
        }
        topSources[src] = (topSources[src] || 0) + 1;
      });
      analytics = {
        today: { visitors: uniqueToday, views: todayRows.length },
        yesterday: { visitors: yesterdayCount?.c || 0 },
        last7days: last7,
        topPages: Object.entries(topPages).sort((a, b) => b[1] - a[1]).slice(0, 10),
        topSources: Object.entries(topSources).sort((a, b) => b[1] - a[1]).slice(0, 10),
      };
    } catch (e) { analytics.error = e.message; }

    // ── Pronostics — performance ──
    const perf = getConcilePerformance();
    const signalFort = getSignalFortStats();
    const threshold = getAdaptiveSignalThreshold();
    let currentPick = null;
    try {
      const raw = JSON.parse(fs.readFileSync(HERMES_PICKS_PATH, "utf8"));
      currentPick = raw.currentPick || null;
    } catch { try { currentPick = loadPick(); } catch {} }

    const pronostics = {
      currentPick,
      signalFort: { total: signalFort.total, wins: signalFort.wins, losses: signalFort.losses, winrate: signalFort.winrate, threshold },
      recent: perf.recent || [],
      byAgent: perf.byAgent || [],
      bySport: perf.bySport || [],
    };

    // ── Alerts ──
    const alerts = [];
    if (business.expiring_soon > 0) alerts.push({ level: "warning", msg: `${business.expiring_soon} abonnement(s) expirent dans 3 jours` });
    if (health.memory.heapUsed > 400) alerts.push({ level: "danger", msg: `Mémoire heap élevée: ${health.memory.heapUsed} MB` });
    if (!API_SPORTS_KEY && !FOOTBALL_DATA_KEY) alerts.push({ level: "danger", msg: "Aucune clé API sportive configurée" });
    if (!STRIPE_SECRET_KEY) alerts.push({ level: "danger", msg: "Clé Stripe non configurée" });
    if (!TELEGRAM_BOT_TOKEN) alerts.push({ level: "warning", msg: "Bot Telegram non configuré" });
    if (!BREVO_API_KEY) alerts.push({ level: "warning", msg: "API Brevo non configurée" });
    if (signalFort.winrate > 0 && signalFort.winrate < 50 && signalFort.total >= 10) alerts.push({ level: "danger", msg: `Winrate Signal Fort bas: ${signalFort.winrate}%` });

    // ── Recent activity log ──
    let activityLog = [];
    try {
      const recentAnalyses = db.prepare("SELECT home, away, competition, best_bet, confidence, outcome, analysed_at FROM concile_analyses ORDER BY analysed_at DESC LIMIT 15").all();
      activityLog = recentAnalyses.map(r => ({
        type: "analysis",
        text: `${r.home} vs ${r.away} — ${r.best_bet} (${r.confidence}%)${r.outcome ? " → " + r.outcome : ""}`,
        date: r.analysed_at,
      }));
    } catch {}

    // ── Services status ──
    const services = {
      api_sports: !!API_SPORTS_KEY,
      football_data: !!FOOTBALL_DATA_KEY,
      stripe: !!STRIPE_SECRET_KEY,
      telegram: !!TELEGRAM_BOT_TOKEN,
      brevo: !!BREVO_API_KEY,
      groq: !!GROQ_API_KEY,
      deepseek: !!DEEPSEEK_API_KEY,
    };

    // ── VPS + Docker + Backups (from host cron script via /shared/vps-status.json) ──
    let vps = {}, docker = { containers: [] }, backups = { latest: null, files: [] };
    try {
      const statusRaw = fs.readFileSync("/shared/vps-status.json", "utf8");
      const status = JSON.parse(statusRaw);
      vps = { ram: status.ram, cpu: status.cpu, disk: status.disk, load: status.load, uptime: status.uptime, collectedAt: status.timestamp };

      if (vps.ram && vps.ram.pct > 90) alerts.push({ level: "danger", msg: `RAM VPS critique : ${vps.ram.pct}%` });
      else if (vps.ram && vps.ram.pct > 75) alerts.push({ level: "warning", msg: `RAM VPS elevee : ${vps.ram.pct}%` });
      if (vps.disk && vps.disk.pct > 90) alerts.push({ level: "danger", msg: `Disque VPS critique : ${vps.disk.pct}%` });
      else if (vps.disk && vps.disk.pct > 75) alerts.push({ level: "warning", msg: `Disque VPS eleve : ${vps.disk.pct}%` });
      if (vps.cpu != null && vps.cpu > 90) alerts.push({ level: "danger", msg: `CPU VPS critique : ${vps.cpu}%` });

      const staleMin = status.timestamp ? (Date.now() - new Date(status.timestamp).getTime()) / 60000 : 999;
      if (staleMin > 5) alerts.push({ level: "warning", msg: `Donnees VPS obsoletes (${Math.round(staleMin)} min)` });

      if (Array.isArray(status.docker)) {
        docker.containers = status.docker;
        docker.running = docker.containers.filter(c => c.state === "running").length;
        docker.stopped = docker.containers.filter(c => c.state !== "running").length;
        docker.total = docker.containers.length;
        if (docker.stopped > 0) alerts.push({ level: "warning", msg: `${docker.stopped} conteneur(s) Docker arrete(s)` });
      }

      if (Array.isArray(status.backups)) {
        backups.files = status.backups.slice(0, 10);
        backups.latest = backups.files[0] || null;
        backups.total = status.backups.length;
        if (backups.latest) {
          const hoursSince = (Date.now() - new Date(backups.latest.date).getTime()) / 3600000;
          if (hoursSince > 48) alerts.push({ level: "danger", msg: `Derniere sauvegarde il y a ${Math.round(hoursSince)}h` });
          else if (hoursSince > 24) alerts.push({ level: "warning", msg: `Derniere sauvegarde il y a ${Math.round(hoursSince)}h` });
        } else {
          alerts.push({ level: "danger", msg: "Aucune sauvegarde trouvee" });
        }
      }
    } catch (e) {
      vps.error = "vps-status.json indisponible — installer le cron sur le host";
    }

    res.json({ ok: true, health, vps, docker, backups, business, analytics, pronostics, alerts, activityLog, services, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error("[admin-dashboard]", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

if (require.main === module) {
  // ===== ENDPOINTS SCORING V2 =====
app.get("/scoring/league-ratings", (req, res) => {
  try {
    const stats = db.prepare("SELECT * FROM league_ratings ORDER BY class ASC, winrate DESC").all();
    res.json({ ok: true, leagues: stats || [] });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get("/scoring/evaluate", (req, res) => {
  try {
    const { confidence, league } = req.query;
    const score = computeWeightedScore(parseFloat(confidence || 0), league || "");
    res.json({ ok: true, ...score });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get("/scoring/market-check", (req, res) => {
  try {
    const { market, competition } = req.query;
    const check = isMarketAvailableInFrance(market || "", competition || "");
    res.json({ ok: true, ...check });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});
// ===== FIN ENDPOINTS SCORING V2 =====

// ===== ENDPOINTS ADMIN V2 =====

// Dashboard stats - stats globales
app.get("/admin/stats", (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as c FROM concile_analyses").get().c;
    const resolved = db.prepare("SELECT COUNT(*) as c FROM concile_analyses WHERE outcome IS NOT NULL AND outcome != 'pending'").get().c;
    const wins = db.prepare("SELECT COUNT(*) as c FROM concile_analyses WHERE outcome='win'").get().c;
    const losses = db.prepare("SELECT COUNT(*) as c FROM concile_analyses WHERE outcome='loss'").get().c;
    const refused = db.prepare("SELECT COUNT(*) as c FROM decision_journal WHERE decision='refused'").get().c;
    const premium = db.prepare("SELECT COUNT(*) as c FROM concile_analyses WHERE plan='premium' AND outcome IS NOT NULL").get().c;
    const winrate = resolved > 0 ? Math.round((wins / resolved) * 10000) / 100 : 0;
    const roi = resolved > 0 ? Math.round(((wins - losses) / resolved) * 10000) / 100 : 0;
    res.json({
      ok: true, total, resolved, wins, losses, refused, premium,
      winrate, roi, profit_loss: wins - losses
    });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// League ratings
app.get("/admin/leagues", (req, res) => {
  try {
    const leagues = db.prepare("SELECT * FROM league_ratings ORDER BY class ASC, winrate DESC").all();
    res.json({ ok: true, leagues });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// Agent performance
app.get("/admin/agents", (req, res) => {
  try {
    const agents = db.prepare("SELECT * FROM agent_weights ORDER BY weight DESC, winrate DESC").all();
    res.json({ ok: true, agents });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// Decision journal
app.get("/admin/journal", (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit || 50));
    const entries = db.prepare("SELECT * FROM decision_journal ORDER BY created_at DESC LIMIT ?").all(limit);
    res.json({ ok: true, entries });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// Market performance per bet type
app.get("/admin/markets", (req, res) => {
  try {
    const markets = db.prepare(`
      SELECT bet_category,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses,
        ROUND(AVG(confidence), 0) as avg_confidence
      FROM concile_analyses
      WHERE bet_category IS NOT NULL AND outcome IS NOT NULL AND outcome != 'pending'
      GROUP BY bet_category
      ORDER BY total DESC
    `).all();
    res.json({ ok: true, markets });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// Competition performance per league
app.get("/admin/competitions", (req, res) => {
  try {
    const comps = db.prepare(`
      SELECT competition,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses,
        ROUND(AVG(confidence), 0) as avg_confidence
      FROM concile_analyses
      WHERE competition IS NOT NULL AND competition != '' AND outcome IS NOT NULL AND outcome != 'pending'
      GROUP BY competition
      ORDER BY total DESC
      LIMIT 50
    `).all();
    res.json({ ok: true, competitions: comps });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// System health
app.get("/admin/health", (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as c FROM concile_analyses").get().c;
    const resolved = db.prepare("SELECT COUNT(*) as c FROM concile_analyses WHERE outcome IS NOT NULL AND outcome != 'pending'").get().c;
    const refused = db.prepare("SELECT COUNT(*) as c FROM decision_journal WHERE decision='refused'").get().c;
    const wins = db.prepare("SELECT COUNT(*) as c FROM concile_analyses WHERE outcome='win'").get().c;
    const losses = db.prepare("SELECT COUNT(*) as c FROM concile_analyses WHERE outcome='loss'").get().c;
    const winrate = resolved > 0 ? Math.round((wins / resolved) * 10000) / 100 : 0;
    const roi = resolved > 0 ? Math.round(((wins - losses) / resolved) * 10000) / 100 : 0;
    const topAgent = db.prepare("SELECT agent_name, winrate FROM agent_weights WHERE total_predictions > 0 ORDER BY winrate DESC LIMIT 1").get();
    const topLeague = db.prepare("SELECT league, winrate FROM league_ratings WHERE total_predictions > 0 ORDER BY winrate DESC LIMIT 1").get();
    res.json({
      ok: true, uptime: Math.round(process.uptime()),
      total, resolved, refused, wins, losses,
      winrate, roi, profit_loss: wins - losses,
      top_agent: topAgent || null, top_league: topLeague || null
    });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});
// ===== MISSION 005 — Endpoints =====
app.get("/admin/ai-specialization", (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM ai_market_specialization ORDER BY total DESC LIMIT 100").all();
    res.json({ ok: true, data });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});
app.get("/admin/monthly-history", (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM monthly_snapshots ORDER BY year DESC, month DESC").all();
    res.json({ ok: true, data });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});
app.get("/admin/alerts", (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM system_alerts ORDER BY created_at DESC LIMIT 50").all();
    res.json({ ok: true, data });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});
// ===== End M005 =====

// ===== FIN ENDPOINTS ADMIN V2 =====



// ===== M007: Scheduler state endpoint =====
app.get("/admin/scheduler-state", (req, res) => {
  try {
    const fs = require("fs");
    let state = {};
    try { state = JSON.parse(fs.readFileSync("/shared/scheduler_state.json", "utf8")); } catch(e) {}
    // Get process info
    let schedulerRunning = false;
    try {
      const r = require("child_process").execSync("systemctl is-active tlm-scheduler", {timeout: 3000}).toString().trim();
      schedulerRunning = r === "active";
    } catch(e) {}
    const uptime = process.uptime();
    res.json({
      ok: true,
      scheduler: {
        active: schedulerRunning,
        service: "tlm-scheduler",
        auto_restart: true,
        boot_enabled: true,
        state: state
      },
      site_uptime: uptime
    });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});
// ===== End M007 =====

// ===== M008: Data Guardian state =====
// Ou meurent les signaux : repartition des motifs de non-diffusion. Repond
// factuellement a "pourquoi 0 signal payant aujourd'hui ?" — chaque motif
// appelle une correction differente, et sans cette vue on corrige a l'aveugle.
app.get("/admin/funnel-report", (req, res) => {
  try {
    const jours = Math.min(30, Math.max(1, parseInt(req.query.jours) || 3));
    const rows = db.prepare(`
      SELECT diffusion_block, sport, COUNT(*) AS n
      FROM concile_analyses
      WHERE analysed_at >= datetime('now', ?)
      GROUP BY diffusion_block, sport
      ORDER BY n DESC
    `).all(`-${jours} days`);

    const total = rows.reduce((s, r) => s + r.n, 0);
    // La verite sur ce qui est parti vient des colonnes sig_sent_*, PAS de
    // diffusion_block : cette colonne est nulle aussi bien pour une analyse
    // diffusee que pour une analyse anterieure a l'instrumentation. Les
    // confondre affichait "100% diffusables, 0 envoi" — contradictoire.
    const diffuses = db.prepare(`
      SELECT COUNT(*) AS n FROM concile_analyses
      WHERE analysed_at >= datetime('now', ?)
        AND (sig_sent_standard = 1 OR sig_sent_premium = 1 OR sig_sent_elite = 1)
    `).get(`-${jours} days`)?.n || 0;
    const nonTracees = db.prepare(`
      SELECT COUNT(*) AS n FROM concile_analyses
      WHERE analysed_at >= datetime('now', ?)
        AND diffusion_block IS NULL
        AND sig_sent_standard = 0 AND sig_sent_premium = 0 AND sig_sent_elite = 0
    `).get(`-${jours} days`)?.n || 0;
    const parMotif = {};
    for (const r of rows) {
      if (r.diffusion_block === null) continue;
      const k = r.diffusion_block;
      parMotif[k] = parMotif[k] || { analyses: 0, sports: {} };
      parMotif[k].analyses += r.n;
      parMotif[k].sports[r.sport || "?"] = (parMotif[k].sports[r.sport || "?"] || 0) + r.n;
    }
    const motifs = Object.entries(parMotif)
      .map(([motif, o]) => ({ motif, analyses: o.analyses, part: total ? Math.round(o.analyses / total * 100) + "%" : "0%", sports: o.sports }))
      .sort((a, b) => b.analyses - a.analyses);

    // Diffusions reellement parties, par canal, sur la meme fenetre
    const envois = db.prepare(`
      SELECT
        SUM(sig_sent_standard) AS standard,
        SUM(sig_sent_premium)  AS premium,
        SUM(sig_sent_elite)    AS elite,
        SUM(sig_sent_free)     AS gratuit
      FROM concile_analyses WHERE analysed_at >= datetime('now', ?)
    `).get(`-${jours} days`);

    // Diagnostic immediat, calcule sur des colonnes deja renseignees depuis
    // toujours (confiance, cote reelle, sport). Ne depend donc pas de
    // l'instrumentation, et repond des maintenant a "ou meurent les signaux ?".
    const TH = getTierThresholds();
    const d = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN real_odd IS NULL OR real_odd <= 1 THEN 1 ELSE 0 END) AS sans_cote_reelle,
        SUM(CASE WHEN real_odd > 1 AND real_odd < ${TIER_MIN_REAL_ODD} THEN 1 ELSE 0 END) AS cote_trop_basse,
        SUM(CASE WHEN real_odd > ${TIER_MAX_REAL_ODD} THEN 1 ELSE 0 END) AS cote_trop_haute,
        SUM(CASE WHEN real_odd >= ${TIER_MIN_REAL_ODD} AND real_odd <= ${TIER_MAX_REAL_ODD} THEN 1 ELSE 0 END) AS cote_dans_fenetre,
        SUM(CASE WHEN lower(COALESCE(sport,'football')) = 'football' THEN 1 ELSE 0 END) AS football,
        SUM(CASE WHEN lower(COALESCE(sport,'football')) != 'football' THEN 1 ELSE 0 END) AS autres_sports
      FROM concile_analyses WHERE analysed_at >= datetime('now', ?)
    `).get(`-${jours} days`);
    // Combien franchiraient TOUS les criteres chiffres d'un palier donne ?
    const eligibles = (seuilConf) => db.prepare(`
      SELECT COUNT(*) AS n FROM concile_analyses
      WHERE analysed_at >= datetime('now', ?)
        AND confidence >= ?
        AND real_odd >= ${TIER_MIN_REAL_ODD} AND real_odd <= ${TIER_MAX_REAL_ODD}
    `).get(`-${jours} days`, seuilConf)?.n || 0;

    res.json({
      ok: true,
      fenetre_jours: jours,
      analyses_totales: total,
      analyses_diffusees: diffuses,
      analyses_non_tracees: nonTracees,
      note_tracage: nonTracees
        ? `${nonTracees} analyses anterieures a l'instrumentation : leur motif de blocage est inconnu. Se fier a "diagnostic_donnees" ci-dessous en attendant.`
        : "Toutes les analyses de la fenetre sont tracees.",
      diagnostic_donnees: {
        ...d,
        seuils_confiance_du_jour: TH,
        eligibles_standard: eligibles(TH.standard),
        eligibles_premium: eligibles(TH.premium),
        eligibles_elite: eligibles(TH.elite),
        lecture: "sans_cote_reelle = aucune vraie cote bookmaker recuperee : ces analyses ne peuvent PAS etre diffusees, quel que soit leur niveau de confiance.",
      },
      envois_par_canal: envois,
      quotas_vendus: {
        standard: STANDARD_SIGNAL_DAILY_CAP, premium: PREMIUM_SIGNAL_DAILY_CAP, elite: ELITE_SIGNAL_DAILY_CAP,
      },
      motifs_de_blocage: motifs,
      note: "Un motif nul = analyse diffusee. Les motifs sont classes du plus frequent au moins frequent : le premier est le goulot d'etranglement a traiter.",
    });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Vue "creme de la creme" : ce qui gagne et ce qui perd, par segment, avec le
// verdict du filtre qualite. Repond a la question "sur quoi doit-on se
// concentrer et quoi doit-on couper", sans avoir a lire la base a la main.
app.get("/admin/segment-report", (req, res) => {
  try {
    const stats = getSegmentStats();
    const minSample = Math.max(1, parseInt(req.query.min) || 5);
    const toList = (obj, seuilBlocage) => Object.entries(obj)
      .map(([key, o]) => ({
        segment: key,
        analyses: o.t,
        gagnes: o.w,
        perdus: o.t - o.w,
        winrate: o.t ? Math.round((o.w / o.t) * 100) : 0,
      }))
      .filter((x) => x.analyses >= minSample)
      .sort((a, b) => b.winrate - a.winrate || b.analyses - a.analyses)
      .map((x) => ({
        ...x,
        // Reprend exactement les seuils appliques par passesHistoricalQualityGate
        verdict: x.analyses >= seuilBlocage.volume && x.winrate < seuilBlocage.winrate
          ? "BLOQUE"
          : (x.winrate >= 70 ? "EXCELLENT" : x.winrate >= 55 ? "correct" : "a surveiller"),
      }));

    res.json({
      ok: true,
      note: "Statistiques dedoublonnees. 'BLOQUE' = le filtre qualite refuse deja ce segment.",
      echantillon_minimum: minSample,
      marches: toList(stats.market, { volume: 25, winrate: 50 }),
      sports: toList(stats.sport, { volume: 30, winrate: 50 }),
      sport_x_marche: toList(stats.sportMarket, { volume: 10, winrate: 50 }),
      competitions: toList(stats.comp, { volume: 12, winrate: 52 }),
      competition_x_marche: toList(stats.compMarket, { volume: 6, winrate: 50 }),
    });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Stats du garde-fou budgetaire IA
app.get("/admin/ai-budget-stats", (req, res) => {
  try {
    const guard = require("./ai_budget_guard");
    res.json({ ok: true, stats: guard.getDailyStats(db) });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.get("/admin/guardian-state", (req, res) => {
  try {
    const fs = require("fs");
    let state = {};
    try { state = JSON.parse(fs.readFileSync("/shared/guardian_state.json", "utf8")); } catch(e) {}
    let anomalies = [];
    try { anomalies = JSON.parse(fs.readFileSync("/shared/anomalies.json", "utf8")); } catch(e) {}
    let guardianRunning = false;
    try {
      const alive = fs.readFileSync("/shared/guardian_state.json", "utf8");
      const parsed = JSON.parse(alive);
      if (parsed.status === "running" || parsed.status === "healthy") guardianRunning = true;
    } catch(e) {}
    res.json({
      ok: true, guardian: {
        active: guardianRunning, state, anomalies: anomalies.slice(-10),
        recent_anomalies: anomalies.filter(a => a.severity === "error" || a.severity === "critical").slice(-5)
      }
    });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});
// ===== End M008 =====

// (Doublon de /admin/ai-budget-stats retire le 05/08/2026 : la route etait
// declaree deux fois a l'identique, la seconde n'etait jamais atteinte —
// Express sert toujours la premiere correspondance. Definition conservee
// plus haut, avec la meme visibilite pour Hermes et le dashboard.)

// ===== M009-M010: Data Hub state =====
app.get("/admin/datahub-state", (req, res) => {
  try {
    const fs = require("fs");
    let state = {};
    try { state = JSON.parse(fs.readFileSync("/shared/datahub_state.json", "utf8")); } catch(e) {}
    let hubRunning = false;
    try {
      const s = JSON.parse(fs.readFileSync("/shared/datahub_state.json", "utf8"));
      hubRunning = (s.status === "running" || s.status === "healthy");
    } catch(e) {}
    res.json({
      ok: true,
      datahub: {
        active: hubRunning,
        failover_count: state.failover_count || 0,
        current_source: state.source || "unknown",
        api_sports_ok: state.api_sports_ok,
        football_ok: state.football_ok,
        api_sports_ms: state.api_sports_response_ms,
        football_ms: state.football_response_ms,
        last_sync: state.last_sync,
        last_inconsistency: state.last_inconsistency || null,
        both_down: state.both_down || false,
        state: state
      }
    });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});
// ===== End M009-M010 =====

// ── Smoke-test endpoints ─────────────────────────────────────────────────────
const API_START_TIME = Date.now();

app.get("/admin/version", (req, res) => {
  res.json({
    ok: true,
    version: process.env.API_VERSION || "1.0.0",
    node: process.version,
    uptime: Math.round((Date.now() - API_START_TIME) / 1000)
  });
});

app.get("/admin/preflight", (req, res) => {
  const checks = {
    database: false,
    env: false
  };
  try {
    db.prepare("SELECT 1").get();
    checks.database = true;
  } catch (_) {}
  checks.env = !!(process.env.API_FOOTBALL_KEY && process.env.TELEGRAM_BOT_TOKEN);
  const ok = checks.database && checks.env;
  res.status(ok ? 200 : 503).json({ ok, checks });
});

app.get("/admin/heartbeat", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});


// ---- Chatbot Mistral --------------------------------------------------------
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_KEY = process.env.MISTRAL_API_KEY || "";
const CB_SYS = "Tu es l assistant client de TousLesMatchs.com. Reponds en francais. Connais: Abonnements: 1e, 9.90e Pro, 19.90e Elite. Live IA: 5 IA en direct. Winrate: 78%. Paiement Stripe. Telegram @TousLesMatchs_Free. Championnats: L1, PL, LaLiga, Serie A, BL, Brasileirao, Argentina. Sois poli et concis.";
app.post("/chatbot/ask", express.json({ limit: "16kb" }), async (req, res) => {
  try {
    const { question, email, code, session } = req.body || {};
    if (!question) return res.json({ ok: false, error: "Question vide" });

    // ── Correctif securite 05/08/2026 ────────────────────────────────────────
    // user_key etait pris directement dans le corps de la requete : en envoyant
    // {email:"victime@x.com"} n'importe qui relisait l'historique de chat de ce
    // compte (les 10 derniers messages sont recharges dans le contexte). On
    // n'accepte donc l'email comme cle QUE s'il est prouve par un code valide ;
    // sinon on derive une cle opaque, non devinable, de l'identifiant de session.
    const authed = email && code && verifyCode(email, code).valid;
    const userKey = authed
      ? String(email).toLowerCase()
      : "anon_" + crypto.createHash("sha256")
          .update(String(session || req.ip || "") + "tlm-chat-salt")
          .digest("hex").slice(0, 24);

    // Question bornee : sans limite, un seul POST pouvait pousser un prompt
    // enorme vers Mistral (cout reel) et gonfler la table chat_messages.
    const q = String(question).slice(0, 1000);

    // Anti-spam : chaque appel coute de l'argent (Mistral). 10 questions par
    // 10 minutes et par cle suffisent largement a un usage humain normal.
    if (!rlAllow("chat_" + userKey, 10, 10 * 60000)) {
      return res.status(429).json({ ok: true, answer: "Trop de questions d'un coup — réessaie dans quelques minutes." });
    }
    // Traçabilité + plafond de dépense obligatoires pour tout appel IA (règle
    // finale du prompt maître). Anti-doublon non applicable à une conversation
    // libre : chaque requête a sa propre clé (voir allowChatbotCall).
    const _chatGate = analysisEngine.allowChatbotCall(db, { sessionId: userKey });
    if (!_chatGate.allowed) return res.json({ ok: true, answer: "Notre assistant est momentanement indisponible." });
    const hist = db.prepare("SELECT role, content FROM chat_messages WHERE user_key = ? ORDER BY id DESC LIMIT 10").all(userKey).reverse();
    hist.push({ role: "user", content: q });
    try { db.prepare("INSERT INTO chat_messages (user_key,role,content,created_at) VALUES (?,?,?,datetime('now'))").run(userKey, "user", q); } catch(e){}
    let resp, data, answer;
    try {
      resp = await fetch(MISTRAL_API_URL, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + MISTRAL_KEY }, body: JSON.stringify({ model: "mistral-small-latest", messages: [{ role: "system", content: CB_SYS }, ...hist], max_tokens: 300, temperature: 0.3 }) });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      data = await resp.json();
      answer = data?.choices?.[0]?.message?.content || "Notre assistant est momentanement indisponible.";
      _chatGate.record(data?.usage?.prompt_tokens, data?.usage?.completion_tokens, "ok");
    } catch (e) {
      // Enregistré même en échec : l'appel HTTP a potentiellement déjà eu lieu
      // et un coût réel a pu être engagé avant l'erreur.
      _chatGate.record(0, 0, "error");
      throw e;
    }
    try { db.prepare("INSERT INTO chat_messages (user_key,role,content,created_at) VALUES (?,?,?,datetime('now'))").run(userKey, "assistant", answer); } catch(e){}
    res.json({ ok: true, answer });
  } catch(e) {
    console.error("[CHATBOT]", e.message);
    res.json({ ok: true, answer: "Notre assistant est momentanement indisponible." });
  }
});


/* TLM assistant local fallback: keeps support online when AI budget/guard is closed. */
app.all(["/api/chat","/chat","/api/chatbot","/api/assistant","/api/support-chat","/api/mistral-chat"], (req, res) => {
  try {
    const msg = String((req.body && (req.body.message || req.body.text || req.body.question)) || (req.query && (req.query.message || req.query.q)) || "").trim();
    return res.json({
      ok: true,
      mode: "local_fallback",
      reply: "Je suis en mode support rapide TousLesMatchs. Le moteur IA complet est temporairement limite pour proteger le budget. Pour une question abonnement, code, acces ou Telegram, laisse ton email et le support te repondra. Question recue: " + (msg || "message vide")
    });
  } catch (e) {
    return res.json({ ok: true, mode: "local_fallback", reply: "Support TousLesMatchs disponible. Reessaie dans un instant." });
  }
});

app.listen(PORT, () => {
    console.log(`TousLesMatchs API running on :${PORT}`);
    verifyTelegramChannels();
    verifyBrevoConfiguration().catch((e) => console.error("[brevo-check]", e.message));

    // ── Accès offert au testeur (Elite, 30 analyses/jour) ──────────────────────
    // Date d'expiration FIXE : la version précédente calculait "aujourd'hui + 60 jours"
    // à chaque démarrage, donc l'échéance était repoussée à chaque déploiement et
    // l'accès ne se terminait jamais. Modifiable via .env sans toucher au code.
    const TESTER_EMAIL   = process.env.TESTER_GRANT_EMAIL   || "lamatrice2012@gmail.com";
    const TESTER_EXPIRES = process.env.TESTER_GRANT_EXPIRES || "2026-09-22"; // 2 mois à partir du 24/07/2026
    if (TESTER_EMAIL) try {
      const _gdb = new Database(CODES_DB_PATH);
      const _existing = _gdb.prepare("SELECT code, plan FROM codes WHERE email = ? AND active = 1").get(TESTER_EMAIL);
      // Le code d'accès n'est jamais écrit en clair dans les logs (ils sont partagés
      // pour du support) — seuls les 2 premiers caractères servent de repère.
      const _mask = (c) => String(c || "").slice(0, 2) + "••••••";
      if (_existing && _existing.plan === "elite") {
        _gdb.prepare("UPDATE codes SET credits_max = 30, expires_at = ? WHERE email = ? AND active = 1").run(TESTER_EXPIRES, TESTER_EMAIL);
        console.log(`[admin-grant] testeur Elite confirmé (30/j, ${_mask(_existing.code)}) — expire le ${TESTER_EXPIRES}`);
      } else if (_existing) {
        _gdb.prepare("UPDATE codes SET plan = 'elite', credits_max = 30, expires_at = ? WHERE email = ? AND active = 1").run(TESTER_EXPIRES, TESTER_EMAIL);
        console.log(`[admin-grant] testeur upgradé en Elite (${_mask(_existing.code)}) — expire le ${TESTER_EXPIRES}`);
      } else {
        const _chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const _code = Array.from({ length: 8 }, () => _chars[Math.floor(Math.random() * _chars.length)]).join("");
        const _today = new Date().toISOString().slice(0, 10);
        _gdb.prepare("INSERT INTO codes (code, email, plan, active, expires_at, credits_max, credits_used, credits_date, created_at) VALUES (?,?,?,1,?,?,0,?,?)").run(_code, TESTER_EMAIL, "elite", TESTER_EXPIRES, 30, _today, new Date().toISOString());
        console.log(`[admin-grant] testeur Elite créé (${_mask(_code)}) — expire le ${TESTER_EXPIRES} — code complet visible dans la base`);
      }
      _gdb.close();
    } catch(e) { console.error("[admin-grant] erreur:", e.message); }

    if (AUTO_CONCILE_OBSERVER) {
      console.log(`[auto-concile] enabled: every ${Math.round(AUTO_CONCILE_INTERVAL_MS / 60000)} min, max ${AUTO_CONCILE_MAX_MATCHES} match(es)`);
      setTimeout(runAutoConcileObserver, 30000);
      setInterval(runAutoConcileObserver, AUTO_CONCILE_INTERVAL_MS);
    }
    const goal05PushIntervalMs = Math.max(
      2,
      Number(process.env.GOAL05_PUSH_INTERVAL_MIN || 5)
    ) * 60 * 1000;
    setTimeout(runGoal05PushObserver, 60000);
    setInterval(runGoal05PushObserver, goal05PushIntervalMs);
    console.log(
      "[fcm] Observateur autonome actif: " +
      Math.round(goal05PushIntervalMs / 60000) +
      " min"
    );

    setInterval(checkAnalyticsSchedule, 60000);
    console.log("[analytics] Scheduler actif: rapport quotidien 23h + hebdo lundi 8h");

    // Pick du jour auto : régénère au démarrage puis vérifie chaque heure.
    // Le check horaire est INCONDITIONNEL (pas de garde storedPickIsFresh) :
    // un pick "frais" (toujours aujourd'hui) peut voir son match se terminer
    // en cours de journée, et c'est justement ce qu'on veut détecter pour
    // afficher le score final + gagné/perdu sans attendre le lendemain.
    // Demande de Greg le 31/07/2026.
    setTimeout(() => { if (!storedPickIsFresh()) refreshDailyPickFromDB(); }, 15000);
    setInterval(refreshDailyPickFromDB, 3600000);
    console.log("[daily-pick] Auto-refresh actif (démarrage + horaire inconditionnel, hors ligues exclues)");
  });
}

module.exports.__liveContractTest = {
  normalizeFootballDataMatch,
  normalizeApiSportsFootballFixture,
  isLowTrustCompetition,
  getVerifiedFixtureId,
  buildStatsStatus,
  normalizeCurrentPick,
  readKnownScore,
  computeAvailableBets,
  computeLiveConstraints,
  mergeLiveMatchSources,
  TOKEN_LIMITS,
  resolveVerifiedLiveMatch,
  resolveLiveMatchesAfterFetchFailure,
};
