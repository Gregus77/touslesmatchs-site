// TousLesMatchs ‚Äî API Server
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
// Point de passage obligatoire pour tout appel IA li√© √† l'analyse d'un match
// (garde-fou budget/anti-doublon/coupe-circuit). Voir scripts/analysis_engine.js.
const analysisEngine = require("./analysis_engine");
const { BETA_PLUS05_CAPACITY, buildBetaPlus05InvitationEmail, decideBetaApplication, formatBetaApplicationsCsv, normalizeBetaEmail } = require("./beta_waitlist");
const { bookmakerButtons, buildInlineKeyboard } = require("./bookmakers.config");

// ‚îÄ‚îÄ Pages SEO (pronostics) ‚Äî inlin√© pour √©viter tout module externe ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// (le Dockerfile ne copie que api_server.js + bookmakers.config.js). Rendu de
// pages publiques indexables, conformes ANJ (pas de "pari", disclaimer, 18+).
const seoPages = (function () {
  const SITE = "https://www.touslesmatchs.com";
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function slugify(str) {
    return String(str || "").normalize("NFD").replace(/[ÃÄ-ÕØ]/g, "")
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
    const mois = ["janvier", "f√©vrier", "mars", "avril", "mai", "juin", "juillet",
      "ao√ªt", "septembre", "octobre", "novembre", "d√©cembre"];
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
<div class="disclaimer">Analyses sportives assist√©es par IA √† but informatif. TousLesMatchs ne garantit aucun gain. Les jeux d'argent et de hasard peuvent √™tre dangereux : pertes d'argent, conflits familiaux, addiction. 18+ ¬∑ Interdit aux mineurs. Conseils et aide sur <a href="https://www.joueurs-info-service.fr" rel="nofollow">joueurs-info-service.fr</a> ‚Äî 09 74 75 13 13 (appel non surtax√©).</div>
<div class="footlinks"><a href="/">Accueil</a><a href="/pronostics">Tous les pronostics</a><a href="/live-ia">Live IA</a><a href="/performances">Performances</a><a href="/faq">FAQ</a></div>
</div></body></html>`;
  }
  function renderDetail(item, related) {
    const dateFr = fmtDateFr(item.date);
    const resolved = item.outcome === "win" || item.outcome === "loss";
    const title = `Pronostic ${item.home} - ${item.away}${item.competition ? " (" + item.competition + ")" : ""} | Analyse IA`;
    const description = `Analyse IA de ${item.home} contre ${item.away}${dateFr ? " du " + dateFr : ""} : verdict du Conseil (${item.bet}), score de confiance ${item.confidence}/100 et cote. Le Concile de 5 IA d√©crypte le match.`;
    const canonical = `${SITE}/pronostic/${matchSlug(item)}`;
    const schema = { "@context": "https://schema.org", "@type": "SportsEvent",
      name: `${item.home} - ${item.away}`, sport: item.sport || "Soccer",
      startDate: (item.date || "").slice(0, 10) || undefined,
      homeTeam: { "@type": "SportsTeam", name: item.home },
      awayTeam: { "@type": "SportsTeam", name: item.away }, description, url: canonical };
    const outcomeTag = resolved
      ? `<span class="tag ${item.outcome === "win" ? "win" : "loss"}">${item.outcome === "win" ? "‚úÖ Analyse gagnante" : "‚ùå Analyse perdue"}</span>`
      : `<span class="tag">üî¥ Analyse publi√©e</span>`;
    const relatedHtml = (related || []).length
      ? `<h2>Autres analyses du Conseil</h2><div class="list">${related.map(r =>
          `<a href="/pronostic/${matchSlug(r)}"><span class="l-match">${esc(r.home)} - ${esc(r.away)}</span><span class="l-meta">${esc(r.competition || "")}</span></a>`).join("")}</div>`
      : "";
    const body = `
  <div class="bc"><a href="/pronostics">Pronostics</a> ‚Ä∫ ${esc(item.home)} - ${esc(item.away)}</div>
  <h1>${esc(item.home)} - ${esc(item.away)} : le pronostic du Conseil IA</h1>
  <div class="sub">${item.competition ? esc(item.competition) + " ¬∑ " : ""}${dateFr ? "Match du " + esc(dateFr) : ""}</div>
  <div class="meta-row">${outcomeTag}<span class="tag">üß† Vote IA 5/5</span>${item.sport ? `<span class="tag">${esc(item.sport)}</span>` : ""}</div>
  <div class="card"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--violet);margin-bottom:8px">üî• Verdict du Conseil</div>
    <div class="verdict"><div class="big">${esc(item.bet || "Analyse IA")}</div><div class="pill g"><b>${item.confidence || ""}%</b><span>de confiance</span></div>${item.cote ? `<div class="pill c"><b>${item.cote}</b><span>cote</span></div>` : ""}</div></div>
  <h2>L'analyse en d√©tail</h2>
  <p>${item.reasoning ? esc(item.reasoning) : `Pour ${esc(item.home)} contre ${esc(item.away)}, le Concile a crois√© le classement, la forme r√©cente, les confrontations directes et la valeur du march√©. Cinq intelligences artificielles ont vot√© s√©par√©ment avant validation par convergence.`}</p>
  <p>Chaque analyse repose sur le vote de 5 agents IA sp√©cialis√©s : l√† o√π un seul avis peut se tromper, la confrontation des mod√®les fait ressortir les d√©saccords et s√©curise la d√©cision. Le verdict n'est publi√© que lorsque la confiance d√©passe notre seuil de qualit√©.</p>
  <h2>Comment fonctionne le Conseil IA ?</h2>
  <p>Herm√®s collecte les donn√©es v√©rifi√©es du match, 5 IA analysent stats, forme et valeur, puis le vote mesure la convergence. Si les signaux sont contradictoires, aucun signal n'est valid√©. <a href="/#methode">Voir la m√©thode compl√®te ‚Üí</a></p>
  <div class="card" style="text-align:center"><div style="font-weight:800;margin-bottom:8px">Envie de toutes les analyses en direct ?</div><p style="margin-bottom:14px">Les membres Standard et Premium re√ßoivent les analyses Live IA et les signaux du Concile en temps r√©el.</p><a href="/#plans" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:13px 30px;border-radius:11px;font-weight:800">Voir les offres</a></div>
  ${relatedHtml}`;
    return shell({ title, description, canonical, bodyHtml: body, schema });
  }
  function renderIndex(items) {
    const title = "Pronostics football & sports ‚Äî Analyses IA | TousLesMatchs";
    const description = "Tous les pronostics du Conseil IA : analyses de matchs de football. Verdict de 5 intelligences artificielles, confiance et historique public.";
    const canonical = `${SITE}/pronostics`;
    const schema = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, description, url: canonical };
    const rows = (items || []).map(it => {
      const resolved = it.outcome === "win" || it.outcome === "loss";
      const badge = resolved ? (it.outcome === "win" ? "‚úÖ" : "‚ùå") : "üî¥";
      return `<a href="/pronostic/${matchSlug(it)}"><span class="l-match">${badge} ${esc(it.home)} - ${esc(it.away)}</span><span class="l-meta">${esc(it.competition || it.sport || "")}${it.confidence ? " ¬∑ " + it.confidence + "%" : ""}</span></a>`;
    }).join("");
    const body = `
  <div class="bc"><a href="/">Accueil</a> ‚Ä∫ Pronostics</div>
  <h1>Pronostics & analyses IA</h1>
  <p class="sub">Chaque match est analys√© par le Conseil : 5 intelligences artificielles votent, la convergence valide. Historique 100 % public ‚Äî gagn√©s comme perdus.</p>
  <div class="list">${rows || "<p>Aucune analyse publi√©e pour le moment.</p>"}</div>`;
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

// IMPORTANT : le webhook Stripe a besoin du corps BRUT (Buffer) pour v√©rifier
// la signature. On exclut donc /stripe/webhook du parser JSON global, sinon
// constructEvent √©choue ‚Üí le client paie mais ne re√ßoit jamais son code/email.
const jsonParser = express.json({ limit: "20mb" });
app.use((req, res, next) => {
  if (req.originalUrl === "/stripe/webhook") return next();
  return jsonParser(req, res, next);
});
// CORS restreint au domaine du site (revue de securite du 01/08/2026) ‚Äî
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
  // Sans cette liste, le navigateur refuserait les en-t√™tes d'identifiants
  // ajout√©s ci-dessous (X-TLM-Email / X-TLM-Code) lors du contr√¥le pr√©alable.
  allowedHeaders: ["Content-Type", "Authorization", "X-TLM-Email", "X-TLM-Code"],
}));

// ‚îÄ‚îÄ S√âCURIT√â : identifiants en EN-T√äTES plut√¥t qu'en query string ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Les codes d'acc√®s transitaient en ?email=‚Ä¶&code=‚Ä¶ : une URL finit dans
// l'historique du navigateur, les journaux du reverse proxy, et l'en-t√™te
// Referer envoy√© aux domaines tiers. Un en-t√™te HTTP ne subit aucun de ces
// trois sorts (audit du 05/08/2026, point #3).
//
// Ce middleware recopie simplement les en-t√™tes vers req.query : TOUS les
// endpoints existants continuent de lire req.query.email / req.query.code
// sans une seule modification, et les anciennes URL avec query string
// restent accept√©es ‚Äî aucun lien en circulation ni marque-page ne casse.
// Le front, lui, n'envoie plus que des en-t√™tes (voir public/*.html).
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

// ‚îÄ‚îÄ S√âCURIT√â P2 : rate limiting maison (aucune d√©pendance externe) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Strict sur l'authentification (anti-brute-force), tr√®s large ailleurs
// (anti-scraping sans g√™ner les visiteurs). Stockage en m√©moire, nettoy√©.
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
  // donc jamais rate-limite jusqu'ici cote IP ‚Äî seul l'espace de recherche
  // (8 caracteres, ~1400 milliards de combinaisons) rendait un brute-force
  // impraticable. Defense en profondeur, pas une faille activement exploitee.
  if (req.method === "POST" && (req.path === "/auth/login" || req.path === "/auth/register" || req.path === "/verify-code")) {
    if (!rlAllow("auth_" + ip, 20, 15 * 60 * 1000)) {
      return res.status(429).json({ ok: false, error: "Trop de tentatives, r√©essaie dans quelques minutes." });
    }
  }
  // Global : 600 req / min / IP (tr√®s large, ne g√™ne aucun visiteur normal)
  if (!rlAllow("g_" + ip, 600, 60 * 1000)) {
    return res.status(429).json({ ok: false, error: "Trop de requ√™tes." });
  }
  next();
});

// ‚îÄ‚îÄ S√âCURIT√â P1 : prot√®ge les endpoints /admin/* en LECTURE seule ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Ces endpoints exposaient des infos internes (ratings ligues, perfs agents,
// √©tat syst√®me‚Ä¶) sans auth. On exige d√©sormais : identifiants admin (email+code)
// OU le token d'Herm√®s (secret = HERMES_ADMIN_TLM_BOT) pour ne pas casser son
// monitoring. Les routes admin sensibles (codes, mutations) ont d√©j√† leur propre
// contr√¥le ‚Äî ceci ne fait que couvrir les lectures ops non prot√©g√©es.
const ADMIN_READONLY_PATHS = new Set([
  "/admin/leagues", "/admin/agents", "/admin/journal", "/admin/markets",
  "/admin/competitions", "/admin/health", "/admin/ai-specialization",
  "/admin/monthly-history", "/admin/alerts", "/admin/scheduler-state",
  "/admin/guardian-state", "/admin/datahub-state", "/admin/version",
  "/admin/preflight", "/admin/heartbeat",
  // Ajoutes le 05/08/2026 (audit securite) : ces 4 routes etaient restees
  // publiques et exposaient des donnees business sensibles a n'importe qui
  // connaissant l'URL ‚Äî winrate/ROI reels, taux de conversion du tunnel,
  // performance par segment, et depense IA quotidienne. Aucune donnee
  // personnelle ni credential, mais de quoi renseigner un concurrent.
  "/admin/stats", "/admin/funnel-report", "/admin/segment-report",
  "/admin/ai-budget-stats",
]);
app.use((req, res, next) => {
  if (req.method === "GET" && ADMIN_READONLY_PATHS.has(req.path)) {
    const { email, code, secret } = req.query;
    const ok = isAdmin(email, code) || (secret && secret === process.env.HERMES_ADMIN_TLM_BOT);
    if (!ok) return res.status(403).json({ ok: false, error: "Acc√®s admin requis" });
  }
  next();
});

// ‚îÄ‚îÄ Database ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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

// ‚îÄ‚îÄ Anti-perte de donn√©es : snapshot automatique au d√©marrage ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// √Ä CHAQUE boot, avant toute migration/DELETE, on copie la base dans /data/snapshots.
// Rotation : on garde les 30 derniers snapshots. Ces fichiers vivent dans le m√™me
// volume que la base, donc ils survivent aux rebuilds ; combin√©s au bind-mount host
// (docker-compose) ils survivent aussi √† `down -v` / prune.
function bootSnapshot() {
  try {
    const snapDir = path.join(path.dirname(DB_PATH), "snapshots");
    fs.mkdirSync(snapDir, { recursive: true });
    // Snapshot coh√©rent via l'API SQLite (pas une simple copie de fichier)
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(snapDir, `tlm-boot-${ts}.db`);
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db.backup(dest)
      .then(() => {
        console.log(`[safeguard] Snapshot de d√©marrage cr√©√©: ${dest}`);
        // Rotation : garder les 30 plus r√©cents
        try {
          const files = fs.readdirSync(snapDir)
            .filter(f => f.startsWith("tlm-boot-") && f.endsWith(".db"))
            .map(f => ({ f, t: fs.statSync(path.join(snapDir, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t);
          files.slice(30).forEach(x => { try { fs.unlinkSync(path.join(snapDir, x.f)); } catch (_) {} });
        } catch (e) { console.error("[safeguard] rotation:", e.message); }
      })
      .catch(e => console.error("[safeguard] snapshot √©chec:", e.message));
  } catch (e) {
    console.error("[safeguard] bootSnapshot:", e.message);
  }
}

// Garde-fou : ne JAMAIS laisser une migration destructive s'ex√©cuter sur une base
// qui vient d'√™tre remplie de donn√©es pr√©cieuses sans snapshot pr√©alable.
const _rowCountAtBoot = (() => {
  try { return db.prepare("SELECT COUNT(*) c FROM concile_analyses").get()?.c ?? 0; }
  catch (_) { return 0; }
})();
if (_rowCountAtBoot > 0) bootSnapshot();
else console.log("[safeguard] Base vide au d√©marrage ‚Äî pas de snapshot (rien √† prot√©ger)");

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
  -- chaque reconstruction du conteneur ‚Äî la preuve doit donc vivre en base.
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

// Historique du "pick du jour" affich√© en vitrine sur l'accueil ‚Äî permet de
// montrer un vrai palmar√®s (page /performances, onglet d√©di√©) plut√¥t que de
// perdre la trace du pick d√®s qu'il change. Une ligne par jour calendaire.
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
// Connexion biom√©trique (Face ID / empreinte) ‚Äî un credential WebAuthn par
// appareil, rattach√© au couple email/code deja valide cote codes.db. Permet
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

// Bankroll de l'utilisateur (simulateur de gestion de capital), key√©e par email
db.exec(`
  CREATE TABLE IF NOT EXISTS user_bankroll (
    email TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);
// Suivi personnel des mises (gains/pertes) par utilisateur, key√© par email
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
// Historique du chatbot, key√© par email : chaque utilisateur a SA m√©moire isol√©e.
// Migration : si une ancienne table chat_messages existe avec un sch√©ma incompatible
// (sans colonne email ‚Äî ex. version user_id), on la remplace proprement.
try {
  const chatCols = db.prepare("PRAGMA table_info(chat_messages)").all().map(c => c.name);
  if (chatCols.length && !chatCols.includes("email")) {
    db.exec("DROP TABLE chat_messages");
    console.log("[migration] ancienne table chat_messages (sch√©ma incompatible) supprim√©e");
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
// Tra√ßage: sur quels canaux clients le signal a r√©ellement √©t√© DIFFUS√â. Sert √† ne
// poster le r√©sultat (gagn√©/perdu) que sur les canaux qui ont vu le pick.
ensureColumn("concile_analyses", "sig_sent_free",     "INTEGER DEFAULT 0");
ensureColumn("concile_analyses", "sig_sent_standard", "INTEGER DEFAULT 0");
ensureColumn("concile_analyses", "sig_sent_premium",  "INTEGER DEFAULT 0");
ensureColumn("concile_analyses", "sig_sent_elite",    "INTEGER DEFAULT 0");
// Motif pour lequel une analyse n'a ete diffusee sur AUCUN canal payant. Sans
// cette trace, un "0 signal aujourd'hui" reste inexplicable : impossible de
// savoir si le probleme vient de la confiance, de la cote, du sport ou du
// filtre qualite. Renseigne a chaque analyse, lu par /admin/funnel-report.
ensureColumn("concile_analyses", "diffusion_block",   "TEXT DEFAULT NULL");
// Palier attribu√© au signal : "standard", "premium", "elite" ou null (non qualifi√©).
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

// Championnat de chaque avis agent x marche ‚Äî absent jusqu'ici (voir
// commentaire plus bas), impossible donc de savoir "quelle IA est forte sur
// quel type de pari DANS quel championnat" comme demande par Greg le
// 02/08/2026. Backfill par jointure sur home/away/jour avec concile_analyses,
// qui a toujours eu la competition ‚Äî fiable car un match donne n'a qu'une
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

// ‚îÄ‚îÄ Migration: deduplicate old concile_analyses (keep latest row per match per day)
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
    console.log(`[migration] Supprim√© ${dupeCount} doublons concile_analyses`);
  }
} catch (e) { console.error("[migration] dedup:", e.message); }

// ‚îÄ‚îÄ Idempotence des webhooks Stripe ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Stripe REJOUE un webhook si notre r√©ponse tarde ou √©choue, et peut livrer un
// m√™me √©v√©nement plusieurs fois. Sans verrou, un `checkout.session.completed`
// rejou√© renvoyait au client un 2e email de confirmation ET g√©n√©rait un 2e lien
// d'invitation Telegram √† usage unique (le code d'acc√®s, lui, √©tait d√©j√†
// prot√©g√©). Table persist√©e sur disque : le verrou survit √† un red√©marrage.
db.exec(`
  CREATE TABLE IF NOT EXISTS stripe_processed_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT,
    processed_at TEXT DEFAULT (datetime('now'))
  );
`);

// ‚îÄ‚îÄ Auth unifi√©e email + OTP + sessions (Phase 2, 01/08/2026) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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

// ‚îÄ‚îÄ Nurturing emails table (persistent across restarts) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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

// ‚îÄ‚îÄ Analytics ‚Äî page views tracking ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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

// ‚îÄ‚îÄ Shadow eval table ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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

// ‚îÄ‚îÄ Migration V2: League ratings + ANJ markets + Decision journal ‚îÄ‚îÄ
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

// ‚îÄ‚îÄ Roster ACTUEL du Concile ‚Äî source de v√©rit√© unique ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Doit rester synchronis√© avec `agentNames` dans runConcile(). agent_predictions
// conserve l'historique des agents retir√©s (GROQ-Llama, GPT Analysis, GeminiFlash,
// Mistral-7B, OR-*) : c'est voulu, on ne falsifie jamais l'historique. Mais leur
// agr√©gat ne doit plus appara√Ætre dans agent_weights, sinon /admin/agents et les
// alertes "agent en baisse" restent pollu√©s par des agents qui ne tournent plus.
const CONCILE_AGENT_NAMES = ["Perplexity-Web", "DeepSeek-V3", "Mistral-Large", "Cohere-Command", "OpenRouter-Qwen"];

// ‚îÄ‚îÄ Initialise agent weights if empty ‚îÄ‚îÄ
try {
  const agentCount = db.prepare("SELECT COUNT(*) as c FROM agent_weights").get().c;
  if (agentCount === 0) {
    const insert = db.prepare("INSERT OR IGNORE INTO agent_weights (agent_name, weight) VALUES (?, 1.0)");
    for (const name of CONCILE_AGENT_NAMES) insert.run(name);
    console.log(`[migration] Agent weights initialised with ${CONCILE_AGENT_NAMES.length} agents`);
  }
} catch(e) { console.error("[migration] agent_weights init:", e.message); }

// ‚îÄ‚îÄ Initialise ANJ markets if empty ‚îÄ‚îÄ
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

// ‚îÄ‚îÄ Update league ratings from concile_analyses ‚îÄ‚îÄ
// ‚îÄ‚îÄ MISSION 005: Auto-refresh every 30 min ‚îÄ‚îÄ
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

// ‚îÄ‚îÄ Update agent weights from agent_predictions ‚îÄ‚îÄ
// Restreint au roster actif : agent_predictions garde l'historique des agents
// retir√©s, mais leur agr√©gat ne doit pas r√©appara√Ætre dans agent_weights √† chaque
// red√©marrage (cet UPSERT tourne au boot). On purge donc aussi les lignes hors roster.
function refreshAgentWeights() {
  try {
    const ph = CONCILE_AGENT_NAMES.map(() => "?").join(",");
    const pruned = db.prepare(`DELETE FROM agent_weights WHERE agent_name NOT IN (${ph})`).run(...CONCILE_AGENT_NAMES).changes;
    if (pruned > 0) console.log(`[migration] Agent weights: ${pruned} ligne(s) hors roster purg√©e(s)`);
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

// ‚îÄ‚îÄ Run initial refresh ‚îÄ‚îÄ
refreshLeagueRatings();
refreshAgentWeights();
// ‚îÄ‚îÄ Auto-refresh every hour ‚îÄ‚îÄ
setInterval(refreshLeagueRatings, 3600000);
setInterval(refreshAgentWeights, 3600000);

// ‚îÄ‚îÄ Constants ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
const JWT_SECRET = process.env.JWT_SECRET || (() => { console.error("[SECURITY] JWT_SECRET non d√©fini dans .env ‚Äî auth d√©sactiv√©e"); return require("crypto").randomBytes(32).toString("hex"); })();
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || "";
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_API_KEY || "";
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
// Utilisee pour la generation d'image (miniatures "combien on aurait gagne").
// Gemini (GOOGLE_API_KEY) essaye en premier le 01/08/2026 mais bloque par un
// quota de facturation image a 0 sur le compte Google ‚Äî bascule sur OpenAI,
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
// trois √©vite qu'un simple renommage coupe enti√®rement le canal gratuit.
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID
  || process.env.TELEGRAM_FREE_CHANNEL_ID
  || process.env.TELEGRAM_CHAT_ID
  || ""; // Gratuit (vitrine)
const TELEGRAM_PREMIUM_CHANNEL_ID = process.env.TELEGRAM_PREMIUM_CHANNEL_ID || ""; // Premium 14.90‚Ç¨
// Canaux Standard (4.90‚Ç¨) et Elite (29.90‚Ç¨). Tant que l'ID n'est pas configur√© dans le
// .env, on retombe automatiquement sur le canal Premium pour ne rien casser en attendant
// que le canal d√©di√© soit cr√©√©. Le CODE applique les conditions par palier (voir plus bas).
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
// Plafonds journaliers par palier (conditions donn√©es par le fondateur)
const STANDARD_SIGNAL_DAILY_CAP = 3;  // üü¢ tri ultra-s√©lectif : football, conf ‚â• 88, cote r√©elle ARJEL 1.30-2.50
const PREMIUM_SIGNAL_DAILY_CAP = 10;  // üü£ plus de volume : football, conf ‚â• 84, cote 1.30-2.50 (inclut Standard)
const ELITE_SIGNAL_DAILY_CAP = 30;    // üü† radar football √©largi : conf ‚â• 82 (inclut Premium)
// Seuils volontairement d√©croissants : un palier sup√©rieur est PLUS LARGE, donc re√ßoit
// davantage. L'inverse (Standard ‚â• 88 et Premium ‚â• 90) rendait les deux paliers
// identiques, puisque ¬´ ‚â• 88 ¬ª contient d√©j√† tout ¬´ ‚â• 90 ¬ª.
//
// Valeurs cal√©es sur la distribution R√âELLE mesur√©e le 25/07/2026 (analyses r√©solues,
// cote r√©elle ‚â• 1.50, depuis le 03/07/2026) ‚Äî surtout ne pas les remonter sans
// remesurer, un seuil trop haut vide compl√®tement un palier payant :
//   ‚â• 88 :  11 analyses ¬∑ 100 % ¬∑ +86 ‚Ç¨     ‚Üí Standard (~0,5/jour)
//   84-85 :  62 analyses ¬∑ 83,9 % ¬∑ +274 ‚Ç¨   ‚Üí Premium  (~3,3/jour cumul√©)
//   82-83 : 141 analyses ¬∑ 70,9 % ¬∑ +428 ‚Ç¨   ‚Üí Elite    (~9,7/jour cumul√©)
// Aucune analyse au-dessus de 89 sur la p√©riode : un seuil √† 90 ou 92 produit Z√âRO signal.
// Elite valait 85 ici, identique a Premium : aucun assouplissement reel malgre
// le discours commercial "Elite = le plus permissif". C'etait deja contraire a
// la calibration du 25/07/2026 juste au-dessus (82-83 pour Elite, 84-85 pour
// Premium). Corrige le 29/07/2026 sur decision du fondateur : Elite redescend
// a 82, seul vrai levier de volume propre a ce palier (en plus du multisport).
// Redescendu a 75 le 03/08/2026 (Greg) : le palier Elite manquait de volume
// certains jours (0-3 signaux). Standard/Premium INCHANGES ‚Äî la demande porte
// explicitement sur Elite seul. Promesse commerciale "Elite ‚â•82%" mise a jour
// en "‚â•75%" partout (site, emails, Telegram) en meme temps que ce seuil.
const STANDARD_MIN_CONF = 72, PREMIUM_MIN_CONF = 72;
// Seuil Elite saisonnier ‚Äî releve de 75% a 80% le 04/08/2026 (decision
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
// 80-84% (75.7%) ‚Äî le seuil 80% coupait des matchs sans aucun gain de
// fiabilite, juste moins de volume. Decision fondateur.
function getEliteMinConf() { return Date.now() < ELITE_TIER_RAMP_UP_DATE ? 75 : 82; }
// Fenetre de cote reelle demandee le 02/09/2026 : jamais sous 1.40 ni au-dessus de 2.10.
const TIER_MIN_REAL_ODD = Math.max(1.30, Number(process.env.TIER_MIN_REAL_ODD || 1.30));
const TIER_MAX_REAL_ODD = Math.min(2.10, Number(process.env.TIER_MAX_REAL_ODD || 2.10));
// Sports diffusables sur TOUS les paliers payants. Restreindre les paliers d'entr√©e
// au football n'avait aucune justification : un signal hockey √† 90 % vaut mieux qu'un
// signal football √† 84 %, et un mardi sans football vidait le palier.
const DIFFUSABLE_SPORTS = ["football", "hockey", "ice hockey", "baseball", "basketball", "basket"];
const ELITE_SPORTS = DIFFUSABLE_SPORTS; // conserv√© : encore r√©f√©renc√© par tierEligible()

// ‚îÄ‚îÄ Seuils dynamiques par palier ‚Äî garantissent le VOLUME vendu ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Un seuil FIXE est fragile : si le Concile devient moins confiant, le palier se
// vide et le client paie pour rien (cas r√©el : seuil Standard √† 92 ‚Üí z√©ro signal).
// Ici c'est la QUANTIT√â qui diff√©rencie les paliers, pas le seuil. On cherche
// chaque jour le niveau de confiance qui a historiquement produit le quota vis√© :
// ¬´ quel seuil laisse passer 3 signaux par jour ? ¬ª ‚Üí c'est celui du Standard.
// Cons√©quence : le quota est servi quel que soit le niveau de confiance du moment,
// et le vivier commun inclut tous les sports (plus de palier √† sec faute de football).
const TIER_THRESHOLD_WINDOW_DAYS = 30;
let _tierThresholdCache = { day: "", value: null };
function getTierThresholds() {
  return { standard: 72, premium: 72, elite: 72, source: "seuil fixe 4/5 valide le 30/08/2026" };
  const today = new Date().toISOString().slice(0, 10);
  if (_tierThresholdCache.day === today && _tierThresholdCache.value) return _tierThresholdCache.value;
  // Repli : les constantes cal√©es sur la mesure du 25/07/2026.
  const fallback = { standard: STANDARD_MIN_CONF, premium: PREMIUM_MIN_CONF, elite: getEliteMinConf(), source: "fixe" };
  // Elite n‚Äôest plus une offre client : si son canal est absent, Premium devient
  // le palier sup√©rieur et h√©rite du vivier diffusable de l‚Äôancien Elite.
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
    // Sous 30 analyses l'√©chantillon ne dit rien de fiable : on garde les constantes.
    if (confs.length < 30) { _tierThresholdCache = { day: today, value: fallback }; return fallback; }
    // Les confiances sont quantifi√©es (82, 83, 84, 85, 88, 89‚Ä¶) : un quantile brut
    // tombe sur des ex √¶quo et d√©borde largement le quota. On retient donc la valeur
    // DISTINCTE dont le nombre de signaux est le plus proche du quota vis√©.
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
    // Imbrication garantie : Standard ‚â• Premium ‚â• Elite (payer plus = recevoir plus).
    t.premium = Math.min(t.premium, t.standard);
    t.elite   = Math.min(t.elite, t.premium);
    // Offre Elite supprim√©e c√¥t√© client : Premium doit recevoir les signaux qui
    // auraient auparavant √©t√© class√©s Elite, sinon ils tombent dans un canal vide.
    if (!TELEGRAM_ELITE_CHANNEL_ID) t.premium = t.elite;
    // Jamais sous le plancher de publication.
    // Le portail de diffusion exige d√©j√† getSignalFloor() : un seuil de palier inf√©rieur
    // serait lettre morte. C'est le plafond journalier (3/10/30) qui diff√©rencie les
    // paliers, pas le seuil de confiance.
    for (const k of ["standard", "premium", "elite"]) t[k] = Math.max(getSignalFloor(), t[k]);
    console.log(`[tier-thresholds] Standard ‚â•${t.standard} ¬∑ Premium ‚â•${t.premium} ¬∑ Elite ‚â•${t.elite} (${t.source})`);
    _tierThresholdCache = { day: today, value: t };
    return t;
  } catch (e) {
    console.error("[tier-thresholds]", e.message);
    return fallback;
  }
}

// V√©rifie au d√©marrage que chaque canal configur√© existe et que le bot y a acc√®s.
// Un ID p√©rim√© (typiquement apr√®s migration d'un groupe en supergroupe, o√π l'ID
// change) faisait √©chouer les envois EN SILENCE : sendTelegramMessage renvoie
// simplement false. Ce contr√¥le rend le probl√®me visible imm√©diatement.
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
      console.warn(`[telegram-check] ${label} : NON CONFIGUR√â`);
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
            console.error(`[telegram-check] ‚ùå ${label} (${id}) INJOIGNABLE ‚Äî ${j.description || "erreur"} ‚Äî les messages de ce palier ne partiront PAS`);
          } else {
            _integrationHealth.telegram.channels[label.toLowerCase()] = true;
            const t = j.result.type;
            const warn = t === "group" ? "  ‚ö†Ô∏è groupe simple : son ID changera lors de la migration en supergroupe" : "";
            console.log(`[telegram-check] ‚úÖ ${label} : ${j.result.title || id} (${t})${warn}`);
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
          console.error(`[telegram-check] ${label} : r√©ponse illisible`);
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
    console.error("[brevo-check] BREVO_API_KEY NON CONFIGUR√âE ‚Äî aucun email ne partira");
    return false;
  }
  try {
    const account = await httpGet("https://api.brevo.com/v3/account", { "api-key": BREVO_API_KEY });
    const ok = !!account && !account.code && !account.error;
    _integrationHealth.brevo.ok = ok;
    _integrationHealth.brevo.checked_at = new Date().toISOString();
    if (ok) console.log("[brevo-check] ‚úÖ API Brevo joignable");
    else console.error(`[brevo-check] ‚ùå cl√© refus√©e ‚Äî ${String(account?.message || "erreur API").slice(0, 120)}`);
    return ok;
  } catch (e) {
    _integrationHealth.brevo.ok = false;
    _integrationHealth.brevo.checked_at = new Date().toISOString();
    console.error(`[brevo-check] ‚ùå ${e.message}`);
    return false;
  }
}

// Diffuse un message identique √† tous les canaux payants. Le FORMAT est le m√™me
// partout ‚Äî seul le volume diff√®re, via les plafonds et seuils de chaque palier.
// D√©doublonnage par chat_id : tant qu'un palier n'a pas de canal d√©di√© il retombe
// sur Premium, et on ne veut pas envoyer deux fois le m√™me message au m√™me canal.
// includeStandard=false r√©serve le message aux paliers sup√©rieurs (mod√®le imbriqu√©).
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
// Plancher align√© sur la promesse Elite-VIP ("‚â•75% de confiance", CLAUDE.md).
// Avant : 85, ce qui bloquait tout signal Elite entre 82 et 84% alors que le
// palier est vendu √† partir de 82% ‚Äî constat√© le 30/07/2026 (analyse √† 82%
// jamais diffus√©e malgr√© √©ligibilit√© Elite).
// Redescendu de 82 √† 75 le 03/08/2026 (Greg) : le palier Elite manquait de
// volume certains jours. Standard/Premium ne sont PAS concern√©s ‚Äî leur seuil
// r√©el vient de quantile() ci-dessus, qui cible un volume pr√©cis (3/j, 10/j)
// et reste naturellement bien au-dessus de ce plancher.
// Devenu saisonnier le 04/08/2026 : voir getEliteMinConf() ‚Äî 75 jusqu'au 15
// aout, 82 ensuite. Fonction (pas une const) pour retomber a 82 sans redeploiement.
// D√©cision qualit√© du 01/09/2026 : aucun signal client O/U 2,5 sous 78 %.
function getSignalFloor() { return 77; }

// Confiance minimale pour qu'une analyse apparaisse en VITRINE (r√©sultats du jour,
// historique, stats). En dessous, c'est de l'analyse interne du Concile (page Live
// IA) qui ne part pas sur Telegram ‚Üí on ne la montre pas comme un "pick". R√©glable.
// Align√©e sur getSignalFloor() le 03/08/2026 pour que le site affiche bien
// tout ce qui part r√©ellement sur Telegram Elite ‚Äî √©viter un signal envoy√©
// aux abonn√©s mais absent des r√©sultats publics du site.
function getPublishedMinConfidence() { return getSignalFloor(); }
// ‚îÄ‚îÄ Seuils sp√©cifiques par march√© ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Certains march√©s ont un winrate historique nettement sup√©rieur ‚Üí seuil abaiss√©.
// "But 1√®re MT" est notre point fort : 82% de winrate sur 931 pronos historiques
// (Cohere-Command, juillet 2026). On peut donc √©mettre √† 75% de confiance sans
// d√©grader la qualit√© per√ßue.
const MARKET_SIGNAL_FLOORS = {
  "But en 1√®re mi-temps":       75,
  "Aucun but en 1√®re mi-temps": 75,
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
    // 15/08 puis 82) et non d'une valeur figee a 82 ‚Äî sinon la promesse Elite a 75%
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
      // ‚ö†Ô∏è Barre remise a 65 le 06/08/2026 apres un aller-retour.
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
    console.log(`[adaptive-threshold] Seuil Signal Fort ajust√©: ${threshold}% (bas√© sur ${rows.length} analyses r√©centes)`);
    _adaptiveThresholdCache = { value: threshold, computedAt: now };
    return threshold;
  } catch (e) {
    console.error("[adaptive-threshold]", e.message);
    return _adaptiveThresholdCache.value || getSignalFloor();
  }
}

// ‚îÄ‚îÄ Shadow agents (banc d'essai ‚Äî free tiers) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
const MISTRAL_API_KEY    = process.env.MISTRAL_API_KEY    || "";
const CEREBRAS_API_KEY   = process.env.CEREBRAS_API_KEY   || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const COHERE_API_KEY     = process.env.COHERE_API_KEY     || "";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "";
const TOGETHER_API_KEY   = process.env.TOGETHER_API_KEY   || "";

// ‚îÄ‚îÄ Substitution automatique des modeles morts (07/08/2026) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Panne trouvee ce jour-la : 93% des analyses sans aucun vote, Concile a l'arret
// depuis des jours. Cause reelle ‚Äî ni les credits (compte OpenRouter sain, sans
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
  // ‚îÄ‚îÄ IA gratuites imm√©diates (cl√© Groq d√©j√† configur√©e, aucun ajout requis) ‚îÄ‚îÄ
  {
    name: "Groq-Llama70B",
    icon: "ü¶ô",
    enabled: () => !!GROQ_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
    }),
  },
  // Groq-Llama8B retir√© le 15 juillet 2026 : 43% de winrate sur 255 r√©solus
  // (audit /admin/full-agents-audit). Sous-performance chronique. √Ä r√©activer
  // seulement si Groq publie une v2 sensiblement meilleure.
  {
    name: "Mistral-Small",
    icon: "üåä",
    enabled: () => !!MISTRAL_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://api.mistral.ai/v1/chat/completions",
      key: MISTRAL_API_KEY,
      model: "mistral-small-latest",
    }),
  },
  {
    name: "Cerebras-Llama",
    icon: "‚ö°",
    enabled: () => !!CEREBRAS_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: CEREBRAS_API_KEY,
      model: "llama3.1-8b",
    }),
  },
  {
    name: "OR-Mistral7B",
    icon: "üîì",
    enabled: () => !!OPENROUTER_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: OPENROUTER_API_KEY,
      model: resolveModel("mistralai/mistral-7b-instruct:free"),
    }),
  },
  {
    name: "Qwen-3.7-Max",
    icon: "üß¨",
    // Shadow d√©sactiv√© : Qwen reste titulaire dans le Conseil IA.
    enabled: () => false,
    call: (prompt) => callOpenRouter(prompt, process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max"),
  },
  // ‚îÄ‚îÄ Nouveaux mod√®les au banc d'essai (test √† blanc, aucun impact sur les picks) ‚îÄ‚îÄ
  // Les identifiants sont surchargeables par .env : si OpenRouter renomme un mod√®le
  // ou si l'ID est erron√©, on corrige sans red√©ployer. Un ID invalide se voit
  // d√©sormais dans les logs ("SANS R√âPONSE ‚Äî model not found"), plus en silence.
  {
    name: "OR-Qwen37Max",
    icon: "üåü",
    // Redevenu titulaire : ne pas le doubler en shadow sur le m√™me match.
    enabled: () => false,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: OPENROUTER_API_KEY,
      model: resolveModel(process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max"),
    }),
  },
  {
    name: "OR-KimiK3",
    icon: "üåô",
    // Replac√© au banc automatique le 01/09/2026 apr√®s la baisse observ√©e.
    // Il reste √©valu√© √† blanc, sans influencer les cinq votes officiels.
    enabled: () => !!OPENROUTER_API_KEY
      && ["1", "true"].includes(String(process.env.OPENROUTER_KIMI_TEST_ENABLED || "true").toLowerCase()),
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: OPENROUTER_API_KEY,
      model: resolveModel(process.env.OR_KIMI_MODEL || "moonshotai/kimi-k2"),
    }),
  },
];

// ‚îÄ‚îÄ Telegram helper ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Echappe le texte insere dans un message Telegram en parse_mode HTML. Sans
// ca, un simple "<" ou "&" dans un texte dynamique (raison generee par une IA,
// nom d'equipe/competition venant de l'API) fait rejeter le message ENTIER par
// Telegram ("can't parse entities"). N'echappe jamais la balise elle-meme :
// a utiliser uniquement sur le contenu injecte, pas sur les <b>/<i> qu'on ecrit.
function escTgHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Miroir client russe : seuls les trois canaux CLIENTS francais sont recopies.
// Herm√®s/Admin/Support ne figurent volontairement pas dans cette table.
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
    [/SIGNAL CONSEIL IA D√âTECT√â/gi, "–°–ò–ì–ù–ê–õ –ò–ò –û–ë–ù–ê–†–£–ñ–ï–ù"],
    [/SIGNAL CONSEIL IA/gi, "–°–ò–ì–ù–ê–õ –ò–ò"],
    [/SIGNAL FORT GAGN√â/gi, "–°–ò–õ–¨–ù–´–ô –°–ò–ì–ù–ê–õ ‚Äî –í–´–ò–ì–†–´–®"],
    [/SIGNAL FORT PERDU/gi, "–°–ò–õ–¨–ù–´–ô –°–ò–ì–ù–ê–õ ‚Äî –ü–†–û–ò–ì–†–´–®"],
    [/STRONG SIGNAL WON/gi, "–°–ò–õ–¨–ù–´–ô –°–ò–ì–ù–ê–õ ‚Äî –í–´–ò–ì–†–´–®"],
    [/STRONG SIGNAL LOST/gi, "–°–ò–õ–¨–ù–´–ô –°–ò–ì–ù–ê–õ ‚Äî –ü–†–û–ò–ì–†–´–®"],
    [/every result stays public, wins and losses alike/gi, "–≤—Å–µ —Ä–µ–∑—É–ª—å—Ç–∞—Ç—ã –ø—É–±–ª–∏–∫—É—é—Ç—Å—è: –∏ –≤—ã–∏–≥—Ä—ã—à–∏, –∏ –ø—Ä–æ–∏–≥—Ä—ã—à–∏"],
    [/BILAN DU JOUR/gi, "–ò–¢–û–ì–ò –î–ù–Ø"],
    [/Signaux r√©ellement diffus√©s/gi, "–†–µ–∞–ª—å–Ω–æ –æ—Ç–ø—Ä–∞–≤–ª–µ–Ω–Ω—ã–µ —Å–∏–≥–Ω–∞–ª—ã"],
    [/Score final/gi, "–ò—Ç–æ–≥–æ–≤—ã–π —Å—á—ë—Ç"],
    [/Score de confiance/gi, "–£—Ä–æ–≤–µ–Ω—å –¥–æ–≤–µ—Ä–∏—è"],
    [/Signal\s*:/gi, "–ü—Ä–æ–≥–Ω–æ–∑:"],
    [/Palier\s*:/gi, "–£—Ä–æ–≤–µ–Ω—å:"],
    [/S'abonner √† Standard ‚Äî 4,90‚Ç¨\/mois/gi, "–ü–æ–¥–ø–∏—Å–∞—Ç—å—Å—è –Ω–∞ –°—Ç–∞–Ω–¥–∞—Ä—Ç ‚Äî 4,90 ‚Ç¨\/–º–µ—Å—è—Ü"],
    [/STANDARD/g, "–°–¢–ê–ù–î–ê–†–¢"],
    [/PREMIUM/g, "–ü–†–ï–ú–ò–£–ú"],
    [/Vote IA/gi, "–ì–æ–ª–æ—Å–æ–≤–∞–Ω–∏–µ –ò–ò"],
    [/R√©sultat v√©rifiable demain sur le site/gi, "–†–µ–∑—É–ª—å—Ç–∞—Ç –º–æ–∂–Ω–æ –ø—Ä–æ–≤–µ—Ä–∏—Ç—å –∑–∞–≤—Ç—Ä–∞ –Ω–∞ —Å–∞–π—Ç–µ"],
    [/R√©sultats complets : gagn√©s comme perdus/gi, "–ü–æ–ª–Ω—ã–µ —Ä–µ–∑—É–ª—å—Ç–∞—Ç—ã: –≤—ã–∏–≥—Ä—ã—à–∏ –∏ –ø—Ä–æ–∏–≥—Ä—ã—à–∏"],
    [/R√©sultats complets dans le canal/gi, "–ü–æ–ª–Ω—ã–µ —Ä–µ–∑—É–ª—å—Ç–∞—Ç—ã –≤–Ω—É—Ç—Ä–∏ –∫–∞–Ω–∞–ª–∞"],
    [/La s√©lection exacte et la raison sont r√©serv√©es aux membres/gi, "–¢–æ—á–Ω—ã–π –ø—Ä–æ–≥–Ω–æ–∑ –∏ –æ–±–æ—Å–Ω–æ–≤–∞–Ω–∏–µ –¥–æ—Å—Ç—É–ø–Ω—ã —Ç–æ–ª—å–∫–æ –ø–æ–¥–ø–∏—Å—á–∏–∫–∞–º"],
    [/Imagine si tu avais eu le pick en direct/gi, "–ü—Ä–µ–¥—Å—Ç–∞–≤—å—Ç–µ, –µ—Å–ª–∏ –±—ã –≤—ã –ø–æ–ª—É—á–∏–ª–∏ –ø—Ä–æ–≥–Ω–æ–∑ –≤ –ø—Ä—è–º–æ–º —ç—Ñ–∏—Ä–µ"],
    [/Recevoir tous les signaux d√®s 4,90‚Ç¨/gi, "–ü–æ–ª—É—á–∞—Ç—å –≤—Å–µ —Å–∏–≥–Ω–∞–ª—ã –æ—Ç 4,90 ‚Ç¨"],
    [/La discipline fait la diff√©rence sur le long terme/gi, "–î–∏—Å—Ü–∏–ø–ª–∏–Ω–∞ –ø—Ä–∏–Ω–æ—Å–∏—Ç —Ä–µ–∑—É–ª—å—Ç–∞—Ç –Ω–∞ –¥–∏—Å—Ç–∞–Ω—Ü–∏–∏"],
    [/Jeu responsable/gi, "–û—Ç–≤–µ—Ç—Å—Ç–≤–µ–Ω–Ω–∞—è –∏–≥—Ä–∞"],
    [/Responsible gaming/gi, "–û—Ç–≤–µ—Ç—Å—Ç–≤–µ–Ω–Ω–∞—è –∏–≥—Ä–∞"],
    [/Conseil IA/gi, "–°–æ–≤–µ—Ç –ò–ò"],
    [/Championnat/gi, "–ß–µ–º–ø–∏–æ–Ω–∞—Ç"],
    [/Gagn√©s/gi, "–í—ã–∏–≥—Ä–∞–Ω–æ"],
    [/Perdus/gi, "–ü—Ä–æ–∏–≥—Ä–∞–Ω–æ"],
    [/R√©ussite/gi, "–£—Å–ø–µ—à–Ω–æ—Å—Ç—å"],
    [/gagn√©s sur/gi, "–≤—ã–∏–≥—Ä—ã—à–µ–π –∏–∑"],
    [/Mise 10‚Ç¨/gi, "–°—Ç–∞–≤–∫–∞ 10 ‚Ç¨"],
    [/Gain/gi, "–í—ã–ø–ª–∞—Ç–∞"],
    [/Cote/gi, "–ö–æ—ç—Ñ—Ñ–∏—Ü–∏–µ–Ω—Ç"],
    [/Under 2[.,]5 buts/gi, "–¢–æ—Ç–∞–ª –º–µ–Ω—å—à–µ 2,5 –≥–æ–ª–æ–≤"],
    [/Over 2[.,]5 buts/gi, "–¢–æ—Ç–∞–ª –±–æ–ª—å—à–µ 2,5 –≥–æ–ª–æ–≤"],
    [/Under 2\.5 goals/gi, "–¢–æ—Ç–∞–ª –º–µ–Ω—å—à–µ 2,5 –≥–æ–ª–æ–≤"],
    [/Over 2\.5 goals/gi, "–¢–æ—Ç–∞–ª –±–æ–ª—å—à–µ 2,5 –≥–æ–ª–æ–≤"],
    [/unanime/gi, "–µ–¥–∏–Ω–æ–≥–ª–∞—Å–Ω–æ"],
    [/Score :/gi, "–°—á—ë—Ç:"],
    [/minute/gi, "–º–∏–Ω—É—Ç–∞"],
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
    // Idempotence : le digest d√©j√† livr√© n'est pas un √©chec Telegram.
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

// G√©n√®re un lien d'invitation Telegram √† usage unique vers le canal premium.
// Le bot doit √™tre administrateur du canal avec le droit d'inviter.
// Canal correspondant au palier achet√©. Sans cette r√©solution, un abonn√© Elite ou
// Standard recevait une invitation vers le canal Premium (mauvais canal, mauvais
// contenu). Un palier sans canal d√©di√© configur√© retombe sur Premium.
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

// ‚îÄ‚îÄ Shadow API helpers ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
function callOpenAICompat(prompt, { url, key, model }) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120, // r√©ponse courte attendue : ne pas payer 200 tokens
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
          // Un mod√®le inexistant renvoie un JSON d'erreur parfaitement valide (404
          // "model not found") : sans ce contr√¥le on r√©solvait ok:true avec un texte
          // vide, et l'agent √©chouait en silence pour toujours.
          if (json.error) {
            return resolve({ ok: false, text: "", error: json.error.message || JSON.stringify(json.error) });
          }
          const text = json.choices?.[0]?.message?.content || "";
          if (!text) return resolve({ ok: false, text: "", error: `r√©ponse vide (HTTP ${res.statusCode}, mod√®le ${model})` });
          // usage.* provient de l'API quand elle le fournit (cas OpenRouter/Groq) :
          // sert √† journaliser un co√ªt r√©el plut√¥t qu'une estimation approximative.
          resolve({ ok: true, text, usageIn: json.usage?.prompt_tokens || 0, usageOut: json.usage?.completion_tokens || 0 });
        } catch { resolve({ ok: false, text: "", error: `r√©ponse illisible (HTTP ${res.statusCode}): ${String(data).slice(0, 120)}` }); }
      });
    });
    req.on("error", (e) => resolve({ ok: false, text: "", error: `r√©seau: ${e.message}` }));
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
      max_tokens: 120, // r√©ponse courte attendue : ne pas payer 200 tokens
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
    const known = ["Over 2.5", "Under 2.5", "BTTS Oui", "BTTS Non", "Match nul", "Victoire domicile", "Victoire ext√©rieur", "1X", "X2", "12", "NO BET"];
    for (const k of known) {
      if (t.toLowerCase().includes(k.toLowerCase())) { bet = k; break; }
    }
  }
  // Parse "buts=o2.5:70,btts=oui:60,resultat=dom:65,mt1=oui:55" ‚Üí objet marches
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
Comp√©tition : ${match.competition || match.league || "inconnue"}
Sport : ${match.sport || "Football"}${scoreStr}

DIRECTIVE : Under 2.5 UNIQUEMENT si match √©quilibr√© (√©cart 0-1 but) ET rythme faible. Si √©cart >= 2 buts OU 2+ buts avant 45' ‚Üí pr√©f√®re Over 2.5 ou Victoire.

R√©ponds UNIQUEMENT dans ce format :
ANALYSE : [ex: Under 2.5 / Over 2.5 / Victoire domicile / 1X / Match nul / NO BET]
CONFIANCE : [0-100]
RAISON : [1 phrase maximum]
MARCHES : buts=o2.5:70,btts=oui:60,resultat=dom:65,mt1=oui:55

Pour MARCHES (avis rapide sur chaque march√©, codes courts + confiance 40-90) :
- buts : o2.5 (plus de 2.5) ou u2.5 (moins de 2.5)
- btts : oui ou non (les deux √©quipes marquent)
- resultat : dom, ext ou nul
- mt1 : oui ou non (but en 1√®re mi-temps)

Ne mets rien d'autre. Si tu n'es pas s√ªr du pick principal, r√©ponds NO BET (mais donne quand m√™me MARCHES).`;
}

// Plafond journalier des tests √† blanc ‚Äî garde-fou de budget OpenRouter.
// 20 matchs/jour suffisent largement : la promotion d'un challenger exige 50 picks
// r√©solus, soit moins de 3 jours d'√©chantillon. Payer plus n'apporte rien.
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
      // coupe-circuit) ; les autres agents shadow ne sont pas concern√©s par ce
      // budget OpenRouter (voir analysis_engine.js).
      const result = await analysisEngine.guardedShadowCall(db, agent, prompt, {
        matchKey, competition: match.competition || match.league || "",
      });
      if (!result.ok || !result.text) {
        // Log explicite : un agent mal configur√© (mauvais identifiant de mod√®le,
        // cl√© absente, quota d√©pass√©) doit se voir dans les logs, pas dispara√Ætre.
        console.error(`[shadow] ${agent.name} SANS R√âPONSE ‚Äî ${result.error || "raison inconnue"}`);
        continue;
      }

      const parsed = parseShadowResponse(result.text);
      // Avis multi-march√©s du banc d'essai ‚Äî m√™me m√©canique que les 5 agents
      // du Concile, pour que TOUTES les IA (pas seulement Perplexity/DeepSeek/
      // Mistral-Large/Cohere/Qwen) apparaissent dans la matrice IA √ó march√©.
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
      console.log(`[shadow] ${agent.icon} ${agent.name} ‚Üí ${parsed.bet} (${parsed.confidence}%) pour ${match.home} vs ${match.away}`);
    } catch (e) {
      console.error(`[shadow] ${agent.name} erreur:`, e.message);
    }
  }
}

function resolveShadowOutcomes(home, away, scoreHome, scoreAway) {
  try {
    // Match par √©quipes (comme les autres r√©solveurs) ‚Äî l'ancien code matchait
    // par match_key exact, mais le match_key de shadow_evals (home_away_date)
    // ne correspond JAMAIS √† celui de concile_analyses (id_date_bucket_score),
    // donc les IA du banc d'essai n'√©taient quasiment jamais r√©solues.
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
    <div style="font-size:13px;color:#a8aec8;line-height:1.5;margin-bottom:14px">La cote finale se v√©rifie toujours sur le bookmaker. 18+ uniquement, jeu responsable.</div>
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

// ‚îÄ‚îÄ Auth middleware ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token) return res.json({ ok: false, error: "Non authentifi√©" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.json({ ok: false, error: "Token invalide" });
  }
}

// ‚îÄ‚îÄ Token helpers ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

const AUTO_CONCILE_OBSERVER = process.env.AUTO_CONCILE_OBSERVER !== "0";
// Plafonds relev√©s le 04/08/2026 (decision du fondateur, "fais ce que tu penses
// etre le mieux") : 10 min / 8 matchs laissait des soirees a fort volume (Coupe
// d'Europe, plusieurs matchs simultanes) sans analyse auto, forcant un clic
// manuel "Analyser" pour obtenir un signal. hasPredictionSnapshot() garantit
// que chaque match n'est analyse qu'une fois quel que soit le nombre de cycles
// ‚Äî un intervalle plus court reduit surtout le RETARD avant qu'un match en
// surplus soit traite, sans multiplier le volume total d'appels IA. Le plafond
// par cycle monte plus prudemment (8->12) car lui seul augmente reellement
// le cout par cycle charge.
const AUTO_CONCILE_INTERVAL_MS = Math.max(5, Number(process.env.AUTO_CONCILE_INTERVAL_MIN || 6)) * 60 * 1000;
const AUTO_CONCILE_MAX_MATCHES = Math.max(1, Number(process.env.AUTO_CONCILE_MAX_MATCHES || 12));
const AUTO_CONCILE_MIN_MINUTE = Math.max(1, Number(process.env.AUTO_CONCILE_MIN_MINUTE || 10));
const AUTO_CONCILE_BUCKET_MINUTES = Math.max(5, Number(process.env.AUTO_CONCILE_BUCKET_MINUTES || 15));

// ‚îÄ‚îÄ Rationnement du quota gratuit API-Sports (02/08/2026) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Sans budget, le quota journalier (souvent ~100 requetes/jour sur un plan
// gratuit) se vide en 1-2h sur une grosse journee de matchs, puis plus aucun
// signal ne peut sortir le reste de la journee (constate le 02/08/2026 ‚Äî
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
// son quota, il doit grossir l'enveloppe des heures suivantes ‚Äî typiquement la
// soir√©e, o√π plusieurs matchs tombent en m√™me temps. On recalcule a chaque
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

// ‚îÄ‚îÄ Quota REEL du plan API-Sports (pas juste notre estimation interne) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Le rationnement horaire ci-dessus part d'un budget suppose (env var, 90 par
// defaut) qui peut etre faux si le vrai plan paye est different. Ici on
// interroge l'endpoint /status d'API-Sports, qui renvoie l'usage REEL du
// jour cote leur serveur (requests.current / requests.limit_day), et on
// alerte sur Telegram Admin des que le quota reel approche de la limite ‚Äî
// pour le savoir AVANT que les signaux s'arretent, pas apres coup dans les
// logs d'erreur.
let _apiQuotaAlertSentDate = "";
async function checkApiSportsRealQuota() {
  // Renvoie toujours un objet { error } explicite en cas d'√©chec, jamais null
  // silencieux ‚Äî sinon /admin/api-quota-status affiche un message g√©n√©rique
  // et il faut aller fouiller les logs docker pour savoir si c'est une cl√©
  // manquante, un quota vraiment √©puis√©, ou une panne r√©seau.
  if (!API_SPORTS_KEY) return { error: "API_SPORTS_KEY / API_FOOTBALL_KEY absente de l'environnement du conteneur" };
  try {
    const data = await httpGet("https://v3.football.api-sports.io/status", { "x-apisports-key": API_SPORTS_KEY });
    const req = data?.response?.requests;
    if (!req || req.limit_day == null) {
      return { error: `r√©ponse inattendue de l'API: ${JSON.stringify(data).slice(0, 300)}` };
    }
    const used = Number(req.current) || 0;
    const limit = Number(req.limit_day) || 0;
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const today = getTodayStr();
    if (pct >= 85 && _apiQuotaAlertSentDate !== today && TELEGRAM_ADMIN_CHAT_ID) {
      _apiQuotaAlertSentDate = today;
      sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID,
        `‚ö†Ô∏è <b>Quota API-Sports proche de la limite</b>\n${used}/${limit} requ√™tes utilis√©es aujourd'hui (${pct}%).\nLes stats live vont bient√¥t basculer sur Football-Data (H2H seulement, moins riche).`
      ).catch(() => {});
    }
    return { used, limit, pct, plan: data?.response?.subscription?.plan || null, ends: data?.response?.subscription?.end || null };
  } catch (e) {
    console.error("[api-sports-quota]", e.message);
    return { error: e.message };
  }
}
setInterval(() => checkApiSportsRealQuota(), 1800000);
// Appel initial diff√©r√© : TELEGRAM_ADMIN_CHAT_ID est d√©clar√© plus bas dans ce
// fichier (const), un appel synchrone ici au chargement du module l√®verait
// une erreur de zone morte temporelle avant que cette constante existe.
setTimeout(() => checkApiSportsRealQuota(), 5000);

// Verif manuelle a tout moment : curl /api/admin/api-quota-status?email=...&code=...
// Declenchement manuel de l'audit matinal : sert a le verifier sans attendre
// 6h du matin, et a le relancer apres un correctif pour confirmer la reparation.
// Composition reelle du Concile, exposee au site public. Les noms des IA
// etaient ecrits en dur dans public/index.html : a chaque promotion ou
// substitution de modele, la page annoncait des IA qui n'analysaient plus rien.
// Le nom affiche est deduit de l'identifiant reellement appele, substitutions
// comprises ‚Äî la page dit donc toujours la verite, sans intervention.
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
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Non autoris√©" });
  const envoye = await runMorningAudit();
  res.json({ ok: true, telegram: envoye });
});

app.get("/admin/api-quota-status", async (req, res) => {
  const { email, code } = req.query || {};
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Non autoris√©" });
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
  if (limit === 0) return { ok: false, error: "Abonnement requis pour acc√©der au Concile" };
  if (row.tokens_today <= 0) return { ok: false, error: "Jetons √©puis√©s pour aujourd'hui ‚Äî recharge √† minuit" };
  db.prepare("UPDATE user_tokens SET tokens_today = tokens_today - 1 WHERE user_id = ?").run(userId);
  return { ok: true, remaining: row.tokens_today - 1 };
}

// ‚îÄ‚îÄ HTTP helper ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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

// ‚îÄ‚îÄ Score de confiance par march√© (pas juste le pick principal) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Chaque agent note deja 4 marches en interne (buts O/U, BTTS, resultat,
// 1ere mi-temps ‚Äî voir "marches" dans le prompt) pour le suivi de
// performance (saveAgentMarketPredictions), mais seul le pick retenu par le
// Chief remontait au client. Cette fonction agrege ce qui est DEJA calcule
// (zero appel IA supplementaire, zero cout) en une liste triee ‚Äî demande du
// fondateur le 04/08/2026 : montrer plusieurs scores classes (ex. Victoire
// domicile 86/100, BTTS 80/100, Under 2.5 60/100...) plutot qu'un seul pari.
// Pour chaque categorie, on retient le cote majoritaire parmi les agents qui
// se sont prononces, avec leur confiance moyenne ‚Äî jamais un chiffre invente,
// toujours la moyenne de ce que les agents ont reellement renvoye.
// ‚îÄ‚îÄ Traduction anglaise des libelles d'analyse (bloc bilingue Telegram) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Un canal Telegram diffuse le MEME message a tous les abonnes : impossible
// d'envoyer une langue par personne. Decision fondateur du 05/08/2026 :
// chaque signal porte le bloc francais puis un bloc anglais compact.
// Les noms d'equipes, scores, cotes et pourcentages sont deja universels et
// ne sont pas dupliques ‚Äî seuls les libelles et la mention legale le sont.
const BET_LABEL_EN = {
  "Victoire domicile": "Home win",
  "Victoire ext√©rieur": "Away win",
  "Match nul": "Draw",
  "BTTS Oui": "Both teams to score - Yes",
  "BTTS Non": "Both teams to score - No",
  "Over 0.5 buts": "Over 0.5 goals",
  "Under 0.5 buts": "Under 0.5 goals",
  "Over 1.5 buts": "Over 1.5 goals",
  "Under 1.5 buts": "Under 1.5 goals",
  "Over 2.5 buts": "Over 2.5 goals",
  "Under 2.5 buts": "Under 2.5 goals",
  "But en 1√®re mi-temps": "Goal in the 1st half",
  "Aucun but en 1√®re mi-temps": "No goal in the 1st half",
  "But en 2√®me mi-temps": "Goal in the 2nd half",
  "Aucun but en 2√®me mi-temps": "No goal in the 2nd half",
  "Domicile marque en 1√®re MT": "Home team to score in the 1st half",
  "Domicile ne marque pas en 1√®re MT": "Home team not to score in the 1st half",
  "Ext√©rieur marque en 1√®re MT": "Away team to score in the 1st half",
  "Ext√©rieur ne marque pas en 1√®re MT": "Away team not to score in the 1st half",
  "Domicile marque en 2√®me MT": "Home team to score in the 2nd half",
  "Domicile ne marque pas en 2√®me MT": "Home team not to score in the 2nd half",
  "Ext√©rieur marque en 2√®me MT": "Away team to score in the 2nd half",
  "Ext√©rieur ne marque pas en 2√®me MT": "Away team not to score in the 2nd half",
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
  resultat: { dom: "Victoire domicile", ext: "Victoire ext√©rieur", nul: "Match nul" },
  ou05: { "o0.5": "Over 0.5 buts", "u0.5": "Under 0.5 buts" },
  ou15: { "o1.5": "Over 1.5 buts", "u1.5": "Under 1.5 buts" },
  buts: { "o2.5": "Over 2.5 buts", "u2.5": "Under 2.5 buts" },
  btts: { oui: "BTTS Oui", non: "BTTS Non" },
  mt1: { oui: "But en 1√®re mi-temps", non: "Aucun but en 1√®re mi-temps" },
  mt1_dom: { oui: "Domicile marque en 1√®re MT", non: "Domicile ne marque pas en 1√®re MT" },
  mt1_ext: { oui: "Ext√©rieur marque en 1√®re MT", non: "Ext√©rieur ne marque pas en 1√®re MT" },
  mt2: { oui: "But en 2√®me mi-temps", non: "Aucun but en 2√®me mi-temps" },
  mt2_dom: { oui: "Domicile marque en 2√®me MT", non: "Domicile ne marque pas en 2√®me MT" },
  mt2_ext: { oui: "Ext√©rieur marque en 2√®me MT", non: "Ext√©rieur ne marque pas en 2√®me MT" },
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
  const voters = (activeAgents || []).filter((a) => a && !a.failed && a.bet && a.bet !== "‚Äî" && a.bet !== "-");
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
  // r√©ellement donn√© Over/Under 2,5 comme pari principal, ce vrai vote compte
  // comme son si√®ge O/U. On ne remplace jamais un bulletin marches.buts existant,
  // on n'invente aucun vote et les agents en √©chec restent exclus.
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
// `{}` ‚Äî indiscernable d'une reponse IA simplement vide. Consequence reelle
// constatee le 04/08/2026 : impossible de savoir si les agents du Concile
// timeoutent vraiment, ou si une cle expiree/un quota depasse renvoie une
// erreur JSON valide mais sans "choices", noyee dans le meme `{}`. Les
// marqueurs _httpStatus/_httpTimedOut/_httpParseError sont ajoutes SANS
// toucher aux champs habituels (.choices, .message...) ‚Äî aucun appelant
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

// ‚îÄ‚îÄ Live matches ‚Äî football-data.org (gratuit, couvre Coupe du Monde) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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
    competition: f.league.name + (f.league.country !== "World" ? " ¬∑ " + f.league.country : ""),
    country: f.league?.country || "",
    utcDate: f.fixture.date,
  };
  return { ...match, lowTrustCompetition: isLowTrustCompetition(match) };
}

// Categories interdites quel que soit le pays ou la competition. AUCUNE
// exemption (pas meme UEFA) ne doit pouvoir les laisser passer : constate le
// 29/07/2026, "Nasjonal U19 Champions League ¬∑ Norway" a ete analysee car
// isUefaCompetition() matche sur le simple mot "champions league" contenu
// dans le nom d'une ligue jeunes norvegienne sans aucun rapport avec l'UEFA,
// et l'exemption UEFA court-circuitait alors tout le filtre low-trust. Un
// match U19 n'a rien a faire dans le Concile ‚Äî cf. regles ANJ/conformite.
const CATEGORY_BAN_KEYWORDS = [
  "friendly", "friendlies", "club friendly", "international friendly", "amical", "amicaux",
  "u17", "u18", "u19", "u20", "u21", "u23",
  "under 17", "under 18", "under 19", "under 20", "under 21", "under 23",
  "reserve", "reserves", "b team", "ii ", " ii", "youth", "youth championship", "academy",
  "regional cup", "state cup", "state league",
  "world cup", "coupe du monde", "fifa world", "copa del mundo",
];

const LOW_TRUST_COMPETITION_KEYWORDS = [
  // Ligues exclues manuellement (performances n√©gatives ‚Äî rapports Hermes)
  "serbia", "usl league two",
  "fa cup ¬∑ south-korea", "fa cup ¬∑ south korea", "korean fa cup",
  "¬∑ china", "china", "chinese",
  "australia cup",
  // Divisions regionales/amateurs australiennes (NPL par etat) ‚Äî le mot
  // "championship" du TRUSTED_COMPETITIONS (Championship anglaise) matchait
  // par erreur "Tasmania Northern Championship" etc. en sous-chaine, faisant
  // passer des ligues semi-pro pour fiables (constate le 01/08/2026, Greg ‚Äî
  // match Tasmanie affiche a 100% de confiance sur "Matchs a venir").
  "tasmania", "npl", "national premier league",
  ...CATEGORY_BAN_KEYWORDS,
  // Divisions inf√©rieures / groupes r√©gionaux ‚Äî donn√©es live lentes et peu fiables
  "kakkonen", "ykkonen", "lohko", "kolmonen", "regionalliga", "oberliga",
  "national league north", "national league south", "isthmian", "northern premier",
  // Afrique
  "ethiopia", "nigeria", "npfl", "tanzania", "kenya", "uganda",
  "ghana", "zambia", "zimbabwe", "mozambique", "cameroon", "cameroun",
  "rwanda", "burundi", "malawi", "botswana", "lesotho", "eswatini", "swaziland",
  "senegal", "ivory coast", "c√¥te d'ivoire", "burkina",
  "congo", "angola", "namibia", "gabon", "togo", "benin", "niger ¬∑ ",
  "madagascar", "mauritius", "cape verde", "guinea",
  "sierra leone", "liberia", "gambia", "eritrea", "djibouti", "comoros",
  "south africa", "algeria ¬∑ ligue", "tunisia ¬∑ ligue", "egypt ¬∑ premier",
  // Asie
  "kazakhstan", "uzbekistan", "uzbek", "tajikistan", "kyrgyzstan", "turkmenistan",
  "myanmar", "cambodia", "laos", "vietnam", "v.league",
  "bangladesh", "nepal", "mongolia", "bhutan", "maldives", "brunei", "timor",
  "palestine", "jordan ¬∑ ", "iraq", "syria", "yemen", "oman", "bahrain",
  "lebanon", "india", "sri lanka", "pakistan",
  "indonesia", "malaysia ¬∑ ", "philippines", "thailand ¬∑ ",
  // Divisions inf√©rieures asiatiques (2e/3e divisions ‚Äî volatiles, cause de pertes)
  "k league 2", "k-league 2", "j2 league", "j3 league", "j2-league", "j3-league",
  "china league one", "chinese league two",
  // Coupe de Cor√©e + divisions amateurs cor√©ennes (K3/K4) : √©quipes semi-pro,
  // scores fous (4-0, 4-3, 5-0), 6 pertes le 15/07/2026. On garde la K-League 1.
  // ‚ö†Ô∏è Ces entr√©es DOIVENT rester avant TRUSTED "fa cup" (ordre : LOW_TRUST gagne).
  "fa cup ¬∑ south-korea", "fa cup ¬∑ korea", "korea ¬∑ fa cup", "korean fa cup",
  "korea fa cup", "coupe de cor√©e", "coupe de coree", "korea cup",
  "k3 league", "k3-league", "k4 league", "k4-league", "k3 ¬∑ korea", "k4 ¬∑ korea",
  // Am√©rique du Sud ‚Äî ligues secondaires
  "chile", "bolivia", "peru", "venezuela", "ecuador",
  "paraguay", "uruguay ¬∑ segunda", "colombia ¬∑ b",
  // Argentine ‚Äî divisions inf√©rieures (2e/3e/4e ‚Äî tr√®s volatiles)
  "primera b metropolitana", "primera b nacional", "primera c", "primera d",
  "torneo federal", "argentina ¬∑ primera b",
  // Am√©rique centrale et Cara√Øbes
  "honduras", "guatemala", "el salvador", "nicaragua",
  "costa rica", "panama ¬∑ liga", "haiti", "jamaica", "trinidad",
  "dominican", "cuba", "belize", "suriname", "guyana",
  // Championnats europeens retires de TRUSTED le 03/08/2026 : ils n'etaient
  // bloques que par le "default = refuser" en fin de filtre. Greg les voyait
  // malgre tout apparaitre (07/08/2026, liste dictee : Pologne, Rep. Tcheque,
  // Roumanie L2, Russie, Finlande...). Un default ne protege que si TOUS les
  // chemins d'appel passent par le filtre ‚Äî ce n'etait pas le cas de
  // computeUpcomingPicks, qui ne transmettait meme pas le pays. On les inscrit
  // donc EN DUR : LOW_TRUST est verifie en premier et gagne toujours, quel que
  // soit le chemin.
  // Finlande et Bulgarie RETIREES de cette liste le 07/08/2026 : elles passent
  // en trusted_secondary / watchlist_shadow (voir LEAGUE_TIERS). Les divisions
  // inferieures finlandaises restent bannies plus bas (kakkonen, ykkonen,
  // lohko, kolmonen) ‚Äî seule la premiere division est concernee.
  "poland", "pologne", "ekstraklasa", "i liga ¬∑ poland",
  "czech", "tchequie", "fortuna liga", "chance liga",
  // Pas de "liga i" / "liga ii" ici : la correspondance se fait en sous-chaine,
  // ces motifs trop courts matcheraient des championnats legitimes. "romania"
  // suffit, le pays accompagne toujours le nom de la division.
  "romania", "roumanie", "superliga ¬∑ romania",
  "russia", "russie", "russian premier", "fnl",
  "ukraine", "ukrainian premier",
    // Europe ‚Äî divisions inf√©rieures/ligues exotiques
  "estonia", "latvia", "faroe", "gibraltar",
  "andorra", "malta", "san marino", "kosovo", "north macedonia",
  "albania", "moldova", "belarus", "armenia",
  "georgia ¬∑ erovnuli", "georgian erovnuli",
  "azerbaijan", "iceland", "northern ireland",
  "luxembourg", "liechtenstein", "montenegro", "bosnia",
  // Oc√©anie
  "fiji", "samoa", "tonga", "vanuatu", "solomon", "papua",
  "new caledonia", "tahiti",
  "australia ¬∑ npl", "australian npl",
  "queensland premier league", "queensland ¬∑ ", "victoria premier league",
  // Moyen-Orient (manquant)
  "iran",
  // USA ‚Äî ligues amateurs/semi-pro
  "usl league two", "usl2", "usl league one",
  "npsl", "nisa", "mls next", "mls next pro",
  "us open cup", "usl w league",
];

// ‚îÄ‚îÄ Classification des ligues (07/08/2026, decision du fondateur) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Objectif : augmenter le volume analysable avant la reprise des grands
// championnats, sans degrader la qualite ni envoyer des signaux faibles.
//
//   trusted_major      ‚Äî TRUSTED_COMPETITIONS, regime normal
//   trusted_secondary  ‚Äî analyse ET diffusion autorisees, mais sous conditions
//                        strictes : cote REELLE obligatoire (jamais estimee),
//                        confiance rehaussee, resultat tracable
//   watchlist_shadow   ‚Äî analyse SEULEMENT. Jamais de diffusion abonne, jamais
//                        de canal payant. On accumule des resultats resolus
//                        avant de decider si on les ouvre.
//
// Finlande et Bulgarie ont ete retirees de la liste noire pour rendre ceci
// possible ; leurs divisions inferieures y restent.
const LEAGUE_TIER_SECONDARY = [
  "superliga ¬∑ denmark", "danish superliga", "superligaen", "denmark ¬∑ superliga",
  "veikkausliiga", "finland ¬∑ veikkausliiga",
  "nb i", "nb1", "otp bank liga", "hungary ¬∑ nb", "hungarian nb",
  // Autriche ajoutee le 07/08/2026. Elle avait ete retiree de la liste blanche
  // le 03/08 avec la Pologne et la Russie, mais elle y rentrait quand meme par
  // la porte de derriere : la comparaison se fait en sous-chaine, et
  // "Austrian Bundesliga" contient "bundesliga", present pour l'Allemagne.
  // Elle etait donc traitee au meme rang que la Bundesliga allemande, par
  // accident. Meme mecanisme que le bug ouzbek du matin.
  // leagueTier() teste SECONDARY avant TRUSTED : ces motifs plus specifiques
  // gagnent donc sur le "bundesliga" generique, et l'Allemagne reste majeure.
  "austrian bundesliga", "bundesliga ¬∑ austria", "austria ¬∑ bundesliga",
  "admiral bundesliga", "osterreichische bundesliga", "√∂sterreichische bundesliga",
];
const LEAGUE_TIER_WATCHLIST = [
  "prvaliga", "slovenia ¬∑ prva", "slovenian prvaliga",
  "parva liga", "first league ¬∑ bulgaria", "bulgaria ¬∑ first", "efbet liga",
  "a lyga", "lithuania ¬∑ a lyga", "lithuanian a lyga",
];
// Points de confiance exiges EN PLUS du seuil normal pour une ligue secondaire.
const SECONDARY_CONF_BONUS = Math.max(0, Number(process.env.SECONDARY_CONF_BONUS || 2));

function leagueHaystack(match) {
  if (typeof match === "string") return match.toLowerCase();
  return [match?.competition, match?.league, match?.country]
    .filter(Boolean).join(" ¬∑ ").toLowerCase();
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
  "super lig", "s√ºper lig",
  "champions league", "europa league", "conference league",
  "euro 20", "uefa euro", "nations league",
  "liga mx", "copa libertadores", "copa sudamericana",
  "brasileirao", "serie a ¬∑ brazil",
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
  "a-league", "a league ¬∑ australia",
  // Ligues europeennes "moyennes" retirees le 03/08/2026 (Greg) : trop
  // souvent des faux signaux a forte confiance sur un volume de donnees
  // reduit (H2H peu fiable, ex. Cracovia-Pogon Ekstraklasa donne 100% BTTS
  // pre-match, perdu 0-2). Ne reste que la "creme de la creme" ‚Äî
  // championnats majeurs + grandes competitions continentales/mondiales.
  // Retirees : Belgique, Croatie, Serbie, Grece, Suisse, Ecosse, Danemark,
  // Norvege, Finlande, Rep. Tcheque, Roumanie, Autriche, Hongrie,
  // Bulgarie, Slovaquie, Chypre, Pologne, Russie, Ukraine.
  "saudi pro league", "roshn",
  "uae pro league",
  "qsl", "qatar stars",
  "ahl",
  "nbl", "nbl ¬∑ australia",
  // "australia cup" retiree le 04/08/2026 : deja bannie dans
  // LOW_TRUST_COMPETITION_KEYWORDS (ligne ~2135, LOW_TRUST gagne toujours),
  // cette entree ici n'avait donc jamais aucun effet ‚Äî contradiction
  // trouvee en audit, pas un changement de politique.
];

function isLowTrustCompetition(matchOrCompetition = "") {
  if (typeof matchOrCompetition === "object" && isUsaOrCanadaMatch(matchOrCompetition)) return true;
  // On lit AUSSI league et country : selon la source (api-sports construit
  // "Ligue ¬∑ Pays" dans competition, TheSportsDB laisse le pays a part), le nom
  // du pays peut n'exister que dans country ‚Äî et la blacklist, qui raisonne
  // beaucoup par pays, passait alors a cote. Cas constate le 05/08/2026 :
  // "Olimpik-Mobiuz vs Jayxun ¬∑ Pro League A ¬∑ Uzbekistan" analyse malgre
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
  // ce qui sort ‚Äî cote reelle obligatoire, confiance rehaussee, et aucune
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
  if (/\bcup\b|coupe|copa|pokal|coppa|ta√ßa|champions league|europa league|conference league|qualif|play[ -]?off|barrage|friendly|amical/.test(h)) return false;
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
  const h = recoveryNormalize([match?.competition, match?.league, match?.country].filter(Boolean).join(" ¬∑ "));
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
  // La r√®gle annonc√©e est un quorum : trois signaux ind√©pendants sur quatre.
  // Exiger les quatre bool√©ens rendait la constante ci-dessus inop√©rante et
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

// Filtre all√©g√© pour l'AFFICHAGE de la page Live IA (menu de matchs √† analyser).
// On bloque uniquement les ligues explicitement blacklist√©es (jeunes, amicaux,
// ligues √† matchs truqu√©s) mais on ne bloque PAS un match juste parce qu'il n'est
// pas dans la whitelist. Le filtre strict isLowTrustCompetition reste utilis√© pour
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

// D√©tecte les matchs f√©minins (comp√©titions "W"/Women/F√©minin, √©quipes suffix√©es " W").
function isWomenMatch(match) {
  if (!match) return false;
  const comp = String(match.competition || match.league || "").toLowerCase();
  const home = String(match.home || "").trim();
  const away = String(match.away || "").trim();
  // "femenil" (orthographe espagnole reelle, ex: "Liga MX Femenil") manquait ‚Äî
  // seul "femenin" etait couvert. Une Liga MX Femenil est passee a travers ce
  // trou le 02/08/2026 (rattrapee par le teamHit sur "W" en fin de nom, mais
  // ne pas dependre d'un seul filet).
  const compHit = /\bwomen\b|f[√©e]minin|femenin|femenil|femminile|frauen|\bnwsl\b|\bwsl\b|wk-league|w-league|w league|kobiet|damallsvenskan|\bfeminine\b|\bwomens?\b/.test(comp);
  const teamHit = /(\s|\()w\)?$/i.test(home) || /(\s|\()w\)?$/i.test(away) || /\bwomen\b/i.test(home) || /\bwomen\b/i.test(away);
  return compHit || teamHit;
}

// R5 ‚Äî aucun match des Etats-Unis ni du Canada. On s'appuie d'abord sur le
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
  ].filter(Boolean).join(" ¬∑ "));
  return /\bmajor league soccer\b|\bmls\b|\busl(?: championship| super league)?\b|\bnwsl\b|\bcanadian premier\b|\bcanadian championship\b/.test(competition);
}

// Auto-blacklist dynamique : comp√©titions o√π le taux de r√©ussite est trop faible.
// Boucle d'auto-am√©lioration ‚Äî on cesse d'analyser ce qui fait perdre.
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
        console.log(`[weak-comp] Comp√©tition exclue (auto): ${r.competition} ‚Äî ${Math.round(wr*100)}% sur ${r.total} analyses`);
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

// ‚îÄ‚îÄ Barri√®re qualit√© : ne PROPOSER (signaler) que les segments prouv√©s gagnants ‚îÄ
// Le syst√®me continue d'analyser tout (pour apprendre), mais un signal ne part au
// client que si la ligue et/ou le march√© ont un track record r√©el suffisant.
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
    // D√©duplication indispensable ICI aussi : ces statistiques d√©cident quels
    // segments sont bloqu√©s. Un m√™me match remont√© par deux sources sous des
    // noms l√©g√®rement diff√©rents comptait double ‚Äî et quand les deux analyses
    // portaient des paris oppos√©s (cas du 28/07/2026), le moteur apprenait
    // simultan√©ment qu'un segment gagne ET qu'il perd, sur le m√™me √©v√©nement.
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
      // Dimension sport : un march√© peut tr√®s bien marcher au football et
      // s'effondrer au baseball, o√π la dynamique n'a rien √† voir.
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

  // 1) Ligue √ó march√© ‚Äî le plus pr√©cis. >=6 analyses et <50% de r√©ussite => on bloque.
  const cm = stats.compMarket[comp + "||" + mk];
  if (cm && cm.t >= 6 && wr(cm) < 0.50) {
    return { ok: false, reason: `${mk} en ${match.competition} : ${Math.round(wr(cm) * 100)}% (${cm.t} analyses)` };
  }
  // 2) Ligue seule ‚Äî >=12 analyses et <52% => on bloque.
  const c = stats.comp[comp];
  if (c && c.t >= 12 && wr(c) < 0.52) {
    return { ok: false, reason: `ligue ${match.competition} : ${Math.round(wr(c) * 100)}% (${c.t} analyses)` };
  }
  // 2 bis) Sport √ó march√© ‚Äî un march√© rentable au football peut s'effondrer sur
  // un sport √† dynamique diff√©rente. Seuil volontairement plus exigeant en
  // volume (>=10) : les sports hors football ont peu d'historique, on √©vite de
  // condamner un segment sur un √©chantillon trop mince.
  const sport = String(match?.sport || "Football").toLowerCase();
  const sm = stats.sportMarket[sport + "||" + mk];
  if (sm && sm.t >= 10 && wr(sm) < 0.50) {
    return { ok: false, reason: `${mk} en ${match.sport || "Football"} : ${Math.round(wr(sm) * 100)}% (${sm.t} analyses)` };
  }
  // 2 ter) Sport seul ‚Äî >=30 analyses et <50%. Bloquer un sport entier est la
  // d√©cision la plus lourde du filtre, donc le volume exig√© est le plus √©lev√©.
  const sp = stats.sport[sport];
  if (sp && sp.t >= 30 && wr(sp) < 0.50) {
    return { ok: false, reason: `sport ${match.sport || "Football"} : ${Math.round(wr(sp) * 100)}% (${sp.t} analyses)` };
  }
  // 3) March√© seul ‚Äî >=25 analyses et <50% => on bloque.
  const m = stats.market[mk];
  if (m && m.t >= 25 && wr(m) < 0.50) {
    return { ok: false, reason: `march√© ${mk} : ${Math.round(wr(m) * 100)}% (${m.t} analyses)` };
  }
  return { ok: true, reason: "segment fiable ou historique insuffisant (seuil 85% appliqu√©)" };
}

// ‚îÄ‚îÄ Score "meilleur pari" : valeur (EV) + confiance + segment prouv√© gagnant ‚îÄ‚îÄ
// Ne pousser en Premium que l'√©lite (3-4/jour) au lieu du premier venu.
// EV = esp√©rance sur mise unitaire = p¬∑(cote‚àí1) ‚àí (1‚àíp). Positif = pari √† valeur.
function bestBetGrade(match, bet, confidence, cote) {
  const p = (Number(confidence) || 0) / 100;
  const c = Number(cote) || 0;
  const ev = c > 0 ? (p * (c - 1) - (1 - p)) : -1;
  const stats = getSegmentStats();
  const comp = String(match?.competition || "").toLowerCase();
  const mk = categorizeBet(bet);
  const seg = stats.compMarket[comp + "||" + mk] || stats.comp[comp];
  const segWr = seg && seg.t >= 8 ? seg.w / seg.t : null;
  // √âlite = valeur positive ET (confiance tr√®s haute OU segment historiquement gagnant)
  const elite = ev > 0 && ((Number(confidence) || 0) >= 88 || (segWr !== null && segWr >= 0.62));
  return { ev, segWr, elite };
}

// ‚îÄ‚îÄ Palier du signal : Standard / Premium / Elite ‚îÄ‚îÄ
// Filtrage APR√àS analyse : le concile recommande librement, on classe ensuite.
// Standard = cr√®me (Under 2.5, ‚â•90%, envoy√© 45-60') ‚Üí peu de volume, tr√®s fiable
// Premium  = solide (Under/Over 2.5, ‚â•86%, envoy√© 40-65')
// Elite    = tout le reste qualifi√© (‚â•82%, toute fen√™tre)
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

// ‚îÄ‚îÄ Contr√¥le de VALEUR : ne pas proposer un pari d√©j√† jou√© ou √† cote ridicule ‚îÄ‚îÄ
const MIN_PLAYABLE_ODD = Math.max(1.05, Number(process.env.MIN_PLAYABLE_ODD || 1.30));
// Plafond de cote : au-del√†, le book estime l'√©v√©nement peu probable = longshot
// perdant (ex: "Under 2.5 @ 3.65" du 15/07/2026 = -10‚Ç¨).
// Fen√™tre r√©gl√©e par le fondateur le 28/07/2026 : cote jouable entre 1.30 et 2.50.
const MAX_PLAYABLE_ODD = Math.min(3.0, Number(process.env.MAX_PLAYABLE_ODD || 2.50));

function betIsPlayable(match, bet, cote) {
  // Cote trop faible = aucune valeur (ex: victoire √† 1.10 sur un 3-0)
  if (cote && cote < MIN_PLAYABLE_ODD) {
    return { ok: false, reason: `cote ${cote} < ${MIN_PLAYABLE_ODD} (trop faible, pas de valeur)` };
  }
  // Cote trop haute = longshot que le book juge improbable (r√®gle m√©tier : max 1.95)
  if (cote && cote > MAX_PLAYABLE_ODD) {
    return { ok: false, reason: `cote ${cote} > ${MAX_PLAYABLE_ODD} (longshot, trop risqu√©)` };
  }
  const sh = Number(match?.score_home), sa = Number(match?.score_away);
  if (Number.isFinite(sh) && Number.isFinite(sa)) {
    const diff = sh - sa;
    const total = sh + sa;
    const b = String(bet || "").toLowerCase();

    // Victoire d√©j√† quasi acquise (√©cart >= 2 buts) ‚Üí pari d√©j√† jou√©, cote irr√©aliste.
    // On reconna√Æt "Victoire domicile/ext√©rieur" MAIS AUSSI "Victoire <nom d'√©quipe>"
    // (ex: "Victoire Apollon Limassol" √† 0-3 doit √™tre bloqu√© ‚Äî bug corrig√© 23/07).
    const isWinBet = /victoire|vainqueur|winner|\bwin\b/.test(b) || /^[12]$/.test(b);
    if (isWinBet) {
      const norm = (s) => String(s || "").toLowerCase().trim();
      const homeN = norm(match?.home), awayN = norm(match?.away);
      const firstWord = (s) => (s.split(/[\s.]+/).filter(Boolean)[0] || "");
      const hMentioned = homeN && (b.includes(homeN) || (firstWord(homeN).length >= 3 && b.includes(firstWord(homeN))));
      const aMentioned = awayN && (b.includes(awayN) || (firstWord(awayN).length >= 3 && b.includes(firstWord(awayN))));
      const isHomeWin = /victoire.*(dom|home)|domicile|^1$/.test(b) || (hMentioned && !aMentioned);
      const isAwayWin = /victoire.*(ext|away)|ext[e√©]rieur|^2$/.test(b) || (aMentioned && !hMentioned);
      if (isHomeWin && diff >= 2) {
        return { ok: false, reason: `domicile m√®ne d√©j√† ${sh}-${sa} ‚Äî victoire d√©j√† jou√©e` };
      }
      if (isAwayWin && diff <= -2) {
        return { ok: false, reason: `ext√©rieur m√®ne d√©j√† ${sh}-${sa} ‚Äî victoire d√©j√† jou√©e` };
      }
    }
    // Over / Under d√©j√† tranch√©s par le score actuel
    const overM = b.match(/(?:over|plus de)\s*(\d+(?:\.5)?)/);
    if (overM && total > parseFloat(overM[1])) {
      return { ok: false, reason: `Over ${overM[1]} d√©j√† atteint (${total} buts) ‚Äî plus rien √† gagner` };
    }
    const underM = b.match(/(?:under|moins de|inf[e√©]rieur)\s*(?:√†\s*)?(\d+(?:\.5)?)/);
    if (underM && total > parseFloat(underM[1])) {
      return { ok: false, reason: `Under ${underM[1]} d√©j√† perdu (${total} buts)` };
    }
    // Double chance sans valeur si un gros √©cart est d√©j√† l√†
    if (/double chance|1x|x2/.test(b) && Math.abs(diff) >= 2) {
      return { ok: false, reason: `√©cart ${sh}-${sa} ‚Äî double chance sans valeur` };
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
// P√©rim√®tre client : football/soccer uniquement, comp√©titions reconnues.
// Les pays/ligues faibles sont √©limin√©s avant les traitements co√ªteux.
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
  ].filter(Boolean).join(" ¬∑ "));
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
  ].filter(Boolean).join(" ¬∑ "));

  // Mexique : Liga MX uniquement. Les divisions semi-pro restent hors p√©rim√®tre.
  if (country === "mexico" && !/\bliga mx\b/.test(comp)) return false;

  // Par d√©faut seules les ligues d√©j√† reconnues par le moteur passent.
  const tier = leagueTier(match);
  return tier === "trusted_major" || tier === "trusted_secondary";
}

async function fetchFromFootballData() {
  if (!FOOTBALL_DATA_KEY) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    // Matchs EN COURS + TERMIN√âS + PROGRAMM√âS aujourd'hui
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

// ‚îÄ‚îÄ Live matches ‚Äî API-Sports (fallback) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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

// Basketball/hockey/baseball sont factur√©s par API-Sports sur un quota SEPARE
// de celui du football (100 requ√™tes/jour chacun sur le plan actuel), mais
// partageaient jusqu'ici le m√™me cache 60 s que le football ‚Äî un simple
// visiteur avec l'onglet Live IA ouvert (poll 60 s) suffisait √† √©puiser leur
// quota en ~1h40. Ces 3 sports sont secondaires (peu de matchs, peu de trafic
// dessus) : on ne les interroge r√©ellement qu'au maximum une fois toutes les
// SECONDARY_SPORT_MIN_INTERVAL_MS, quel que soit le rythme de rafra√Æchissement
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

  // Basketball live ‚Äî desactive quand AUTO_CONCILE_MULTISPORT=0 (decision
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
      // Quart-temps (Q1-Q4, OT, MT...) ‚Äî sans lui, l'horloge affich√©e seule
      // ne dit pas dans quel quart-temps on est (signal√© par Greg le 01/08/2026).
      period: g.status?.short || null,
      competition: (g.league?.name || "Basketball") + (g.country?.name ? " ¬∑ " + g.country.name : ""),
      utcDate: g.date,
    })).filter(g => g.home && g.away);
    results.push(...items);
    console.log(`[live-matches] API-Sports basketball: ${items.length}`);
    }
    }
  } catch(e) { console.error("[live-matches] API-Sports basketball:", e.message); }

  // Hockey live ‚Äî desactive quand AUTO_CONCILE_MULTISPORT=0 (voir basketball ci-dessus)
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
      competition: (g.league?.name || "Hockey") + (g.country?.name ? " ¬∑ " + g.country.name : ""),
      utcDate: g.date,
    })).filter(g => g.home && g.away);
    results.push(...items);
    console.log(`[live-matches] API-Sports hockey: ${items.length}`);
    }
    }
  } catch(e) { console.error("[live-matches] API-Sports hockey:", e.message); }

  // Baseball live ‚Äî REACTIVE le 01/08/2026 (decision fondateur, tr√™ve
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
      competition: (g.league?.name || "Baseball") + (g.country?.name ? " ¬∑ " + g.country.name : ""),
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
  console.log(`[live-matches] API-Sports total: ${results.length} √©v√©nements`);
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
  console.log(`[live-matches] TheSportsDB total: ${results.length} √©v√©nements`);
  return results;
}

// Deux sources nomment rarement une √©quipe pareil : ¬´ Dila ¬ª vs ¬´ Dila Gori ¬ª,
// ¬´ Vardar ¬ª vs ¬´ Vardar Skopje ¬ª, ¬´ Thun ¬ª vs ¬´ FC Thun ¬ª. Une comparaison
// stricte laissait donc passer le m√™me match deux fois dans la liste live (et
// risquait de le faire analyser deux fois par le Concile).
// R√®gle : √©galit√© stricte, OU un nom contenu dans l'autre (¬´ dila ¬ª ‚äÇ ¬´ dila
// gori ¬ª), OU m√™me mot distinctif au sens de matchToken() (¬´ fc thun ¬ª ‚Üí ¬´ thun ¬ª).
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
  // Inclusion sur mot entier uniquement : √©vite que ¬´ inter ¬ª matche ¬´ winterthur ¬ª.
  const words = (s) => s.split(" ").filter(Boolean);
  const wa = words(na), wb = words(nb);
  const shorter = wa.length <= wb.length ? wa : wb;
  const longer = wa.length <= wb.length ? wb : wa;
  if (shorter.length && shorter.every((w) => longer.includes(w))) return true;
  const ta = matchToken(a), tb = matchToken(b);
  return !!ta && ta.length >= 3 && ta === tb;
}

// Mots distinctifs d'un nom d'√©quipe : au moins 4 lettres et hors pr√©fixes
// g√©n√©riques (fc, ac, united, city‚Ä¶). ¬´ Gimpo Citizen ¬ª ‚Üí ["gimpo"].
function teamPlaceWords(name) {
  return NORM(name).replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((w) => w.length >= 4 && !GENERIC_CLUB_TOKENS.has(w));
}

// Distance de Levenshtein plafonnee avec sortie anticipee ‚Äî utilisee pour
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
  // reconnaissaient jamais comme le meme club ‚Äî doublon constate par Greg le
  // 03/08/2026 (meme match, deux minutes differentes affichees).
  return wa.some((w) => w.length >= 6 && wb.some((w2) => w2.length >= 6 && levenshteinAtMost(w, w2, 2)));
}

// Deux relev√©s du m√™me match doivent afficher un temps de jeu voisin. Sert de
// garde-fou : sans lui, un c√¥t√© identique suffirait √† confondre deux rencontres.
function liveMinutesAreClose(a, b, tolerance = 15) {
  const ma = parseLiveMinuteValue(a && a.minute);
  const mb = parseLiveMinuteValue(b && b.minute);
  if (ma === null || mb === null) return true; // sport sans minute exploitable
  return Math.abs(ma - mb) <= tolerance;
}

function sameLiveTeams(a, b) {
  // Ne jamais fusionner deux sports diff√©rents, m√™me si les noms se ressemblent.
  const sportA = String(a?.sport || "Football");
  const sportB = String(b?.sport || "Football");
  if (sportA !== sportB) return false;
  const homeOk = sameLiveTeamName(a?.home, b?.home);
  const awayOk = sameLiveTeamName(a?.away, b?.away);
  if (homeOk && awayOk) return true;

  // Reconnaissance assouplie. Les deux sources nomment souvent la m√™me √©quipe
  // tr√®s diff√©remment : ¬´ Chungnam Asan ¬ª / ¬´ Asan Mugunghwa ¬ª, ¬´ Gimpo FC ¬ª /
  // ¬´ Gimpo Citizen ¬ª, ¬´ Ulsan HD ¬ª / ¬´ Ulsan Hyundai FC ¬ª. Un seul c√¥t√© √©choue,
  // et le match n'est plus reconnu comme identique : on conserve alors deux
  // entr√©es, dont celle de TheSportsDB qui ne permet AUCUNE cote ‚Äî donc aucune
  // diffusion possible. Constat√© le 29/07/2026 sur la FA Cup cor√©enne : les 5
  // matchs pr√©sents dans les deux sources √©taient tous concern√©s.
  //
  // Trois conditions cumul√©es, jamais une seule : un c√¥t√© strictement reconnu,
  // l'autre partageant un mot distinctif (ville/r√©gion, 4 lettres minimum), et
  // un temps de jeu coh√©rent. Associer deux rencontres diff√©rentes donnerait une
  // cote appartenant √† un autre match ‚Äî d'o√π la prudence.
  if (homeOk === awayOk) return false; // aucun c√¥t√© s√ªr, ou d√©j√† trait√© au-dessus
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
  // Accepte uniquement une minute enti√®re r√©elle. Les statuts et arr√™ts de jeu sont exclus.
  const matched = raw.match(/^(\d{1,3})(?:['‚Äô‚Ä≤])?$/);
  if (!matched) return null;
  const parsed = Number(matched[1]);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 120 ? parsed : null;
}

// Codes de statut bruts (API-Sports / TheSportsDB) qui ne sont PAS du live
// exploitable : match pas commenc√© (NS), report√©, annul√©, interrompu, termin√©.
// Ces deux sources √©crasent le champ "status" √† "IN_PLAY" en dur (voir
// normalizeTheSportsDbLiveEvent et fetchFromApiSports), donc le vrai √©tat n'est
// lisible que dans "minute" (ex: minute="NS"). Sans ce filtre, des matchs non
// commenc√©s s'affichaient en "En direct" sans temps de jeu ni cote exploitable.
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

  // Statut r√©el port√© par "minute" quand la source a √©cras√© "status" √† IN_PLAY.
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
// >= a celui de l'autre source), ce n'est pas une vraie contradiction ‚Äî c'est
// une source simplement en retard sur un but recent (ex: 0-1 vs 1-2, les deux
// equipes ont progresse). On retient alors le score le plus a jour au lieu de
// bloquer l'analyse pour rien. Seul un vrai conflit ‚Äî une equipe qui "redescend"
// d'une source a l'autre, impossible en vrai ‚Äî reste bloque : ca signale un
// match mal identifie ou une donnee corrompue, jamais un simple retard.
// Demande du fondateur le 04/08/2026.
function dominantScore(a, b) {
  const ah = Number(a.score_home), aa = Number(a.score_away);
  const bh = Number(b.score_home), ba = Number(b.score_away);
  if (ah >= bh && aa >= ba) return a;
  if (bh >= ah && ba >= aa) return b;
  return null;
}

// Seule une entr√©e API-Sports porte un identifiant exploitable par l'endpoint
// /odds. TheSportsDB ne fournit aucune cote.
function carriesOddsIdentity(m) {
  return !!(m && m.source === "api-sports" && (m.fixtureId || m.sourceId));
}

// Quand le m√™me match arrive des deux sources, on conserve l'identit√© capable de
// ramener une vraie cote et on ne reprend de l'autre source que les donn√©es de
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
    // Doublon sur un sport non-Football : on garde l'entr√©e d√©j√† pr√©sente au lieu
    // de l'ajouter une seconde fois (l'arbitrage de score ci-dessous ne concerne
    // que le football, o√π deux APIs fournissent le score).
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
      // Cette affectation √©crasait auparavant l'entr√©e API-Sports par celle de
      // TheSportsDB (pass√©e en 2e argument par fetchLiveMatches). Le fixtureId
      // disparaissait, fetchRealOdds() sortait sur `source !== "api-sports"`,
      // la cote retombait sur "estimation", donc realOdd = 0, donc oddOk = false,
      // donc diffusable = false : AUCUN signal ne pouvait plus partir, quels que
      // soient le vote et la confiance. Constat√© le 29/07/2026 ‚Äî 305 analyses sur
      // 481 en 7 jours portaient une identit√© tsdb- structurellement incotable.
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
              // l'analyse est bloqu√©e de toute fa√ßon, on ne m√©lange pas les
              // deux jeux de donn√©es.
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
    error: `Nos deux sources de scores ne sont pas encore d'accord (${sources.footballData || "?"} vs ${sources.apiSports || "?"}) ‚Äî probablement un but tres recent pas encore remonte partout. Analyse bloquee pour ne jamais te proposer un pari sur un score faux. Reessaie dans 1 a 2 minutes.`,
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
    console.log(`[live-matches] Cache enrichi TheSportsDB: ${enrichedMatches.length} √©v√©nements`);
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

  // Auto-r√©soudre les pr√©dictions des matchs termin√©s
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
    { id: "demo1", home: "Maroc", away: "√âcosse", score_home: 1, score_away: 0, minute: 55, status: "IN_PLAY", competition: "Coupe du Monde 2026", utcDate: new Date(base).toISOString() },
    { id: "demo2", home: "Real Madrid", away: "Barcelona", score_home: 2, score_away: 1, minute: 67, status: "IN_PLAY", competition: "La Liga", utcDate: new Date(base).toISOString() },
    { id: "demo3", home: "Manchester City", away: "Arsenal", score_home: 0, score_away: 0, minute: 12, status: "IN_PLAY", competition: "Premier League", utcDate: new Date(base).toISOString() },
    { id: "demo4", home: "Bayern Munich", away: "Dortmund", score_home: 3, score_away: 1, minute: 78, status: "IN_PLAY", competition: "Bundesliga", utcDate: new Date(base).toISOString() },
  ];
}

// ‚îÄ‚îÄ Statistiques live par match (api-sports.io) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
function resolveLiveMatchesAfterFetchFailure() {
  return [];
}

// Lettres latines "sp√©ciales" qui ne sont PAS des accents d√©composables en
// Unicode NFD (contrairement √† √©/√†/√º) : √∏, √¶, √ü... restent identiques apr√®s
// normalize("NFD"), donc "Bod√∏" et "Bodo" ne matchent jamais entre une source
// qui garde l'unicode complet et une autre qui translitt√®re. Constat√© le
// 31/07/2026 : "Bod√∏/Glimt" (TheSportsDB) affich√© en double √† c√¥t√© de
// "Bodo/Glimt" (api-sports) sur la page Live IA, m√™me score, m√™me minute.
const SPECIAL_LATIN_MAP = { "√∏": "o", "√¶": "ae", "≈ì": "oe", "√∞": "d", "√æ": "th", "≈Ç": "l", "ƒë": "d", "√ü": "ss", "ƒ±": "i" };
function stripSpecialLatin(s) {
  return String(s || "").replace(/[√∏√¶≈ì√∞√æ≈Çƒë√üƒ±]/gi, (c) => SPECIAL_LATIN_MAP[c.toLowerCase()] || c);
}

function normalizeMatchName(value) {
  return stripSpecialLatin(String(value || "").trim().toLowerCase())
    .normalize("NFD").replace(/[ÃÄ-ÕØ]/g, "")
    .replace(/\bman(chester)?\b/g, "man")
    .replace(/\b(united|utd)\b/g, "utd")
    // TLM_LIVE_DEDUP_WOLVES_20260901 ‚Äî deux fournisseurs nomment le meme club
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

// ‚îÄ‚îÄ H2H (confrontations directes) ‚Äî donn√©e factuelle pour ancrer l'analyse ‚îÄ‚îÄ‚îÄ‚îÄ
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
          // Ramener au point de vue de l'√©quipe "home" actuelle (via id)
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
  // erreur reseau) ‚Äî tente Football-Data.org si ce match y est aussi connu.
  return fetchH2HFromFootballData(match);
}

// Enregistre un pick pr√©-match dans concile_analyses (source_type='prematch')
// s'il n'y est pas d√©j√†, pour qu'il entre dans le pipeline de r√©solution
// automatique (resolveStalePredictions) au m√™me titre qu'un signal live ‚Äî
// c'est ce qui permet de comparer plus tard un vrai winrate pr√©-match vs
// live. Idempotent : computeUpcomingPicks tourne toutes les 30 min sur la
// m√™me fen√™tre de 36h, sans ce garde-fou le m√™me match serait r√©-ins√©r√© √†
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
      pick.bet, pick.confidence, "Pick pr√©-match (H2H)", 0, "prematch",
      pick.home_logo || null, pick.away_logo || null,
      "prematch interne: non diffuse aux clients"
    );
  } catch (e) { console.error("[upcoming-picks] savePrematchPickIfNew:", e.message); }
}

// ‚îÄ‚îÄ Matchs √† venir (pr√©-match) ‚Äî demande de Greg le 31/07/2026 ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Contrairement au reste du Concile (analyse EN DIRECT, cote ARJEL r√©elle),
// ces picks portent sur des matchs qui n'ont pas encore commenc√© : meilleures
// cotes, mais aucune donn√©e live. On s'appuie donc uniquement sur le H2H r√©el
// (fetchH2H, d√©j√† utilis√© pour enrichir les analyses live) ‚Äî pas de nouvel
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
  // Compteurs exposes au client pour expliquer honnetement un tab vide ‚Äî
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
    // aujourd'hui/demain) ‚Äî constate par Greg le 03/08/2026, un match apparaissait
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
      // "Nom ¬∑ Pays". Sans le pays, la blacklist ‚Äî qui raisonne largement par
      // pays ‚Äî ne pouvait rien bloquer : c'est ainsi que "Olimpik-Mobiuz vs
      // Jayxun ¬∑ Pro League A ¬∑ Uzbekistan" s'est retrouve en "Notre selection"
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
      // isWomenMatch() manquait sur ce pipeline pre-match (H2H) ‚Äî seul le direct
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
        competition: f.league.name + (f.league.country && f.league.country !== "World" ? " ¬∑ " + f.league.country : ""),
        country: f.league.country || "", sport: "Football", kickoff: f.fixture.date,
        confidence: null, status: "watchlist",
        reason: "Analyse statistique en pr√©paration ‚Äî aucun signal valid√© pour l'instant.",
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
        { bet: "Victoire ext√©rieur", confidence: Math.round((h2h.awayWins / h2h.n) * 100) },
        { bet: "BTTS Oui", confidence: h2h.bttsPct },
        { bet: "But en 1√®re mi-temps", confidence: h2h.htGoalPct },
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
        competition: f.league.name + (f.league.country && f.league.country !== "World" ? " ¬∑ " + f.league.country : ""),
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
  // se connecte qu'une fois dans la journ√©e voie tout le programme qualifi√©
  // √† venir, dans l'ordre, plut√¥t que juste les mieux not√©s (01/08/2026).
  picks.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const top = picks.slice(0, 12);
  // Cote ARJEL r√©elle (demande de Greg le 03/08/2026) ‚Äî uniquement sur les
  // picks retenus (top 12, pas les 60 candidats bruts) pour m√©nager le quota
  // API-Sports. On n'affiche la cote QUE si le bookmaker qui l'a fournie est
  // reconnu ARJEL (cf. ARJEL_BOOKMAKERS) ‚Äî jamais de repli sur un bookmaker
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
      id:m.id,home:m.home,away:m.away,competition:m.competition||"Football",country:(String(m.competition||"").split(/\s*[¬∑‚Ä¢]\s*/).pop()||""),sport:m.sport||"Football",
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

H2H V√âRIFI√â (${h2h.n} derni√®res confrontations directes, donn√©es API r√©elles) :
- Bilan : ${homeName} ${h2h.homeWins}V ¬∑ ${h2h.draws}N ¬∑ ${awayName} ${h2h.awayWins}V
- Moyenne de buts : ${h2h.avgGoals}/match
- Under 2.5 buts : ${h2h.under25Pct}% des confrontations
- Les deux √©quipes marquent (BTTS) : ${h2h.bttsPct}%
‚Üí Utilise ces chiffres R√âELS en priorit√© sur ta m√©moire pour juger Under/Over 2.5, BTTS et le vainqueur probable.`;
}

// ‚îÄ‚îÄ Contexte profond : forme, force/classement, enjeu, bless√©s (donn√©es API) ‚îÄ‚îÄ‚îÄ
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
  // 4 appels potentiels (stats domicile/exterieur, classement, blessures) ‚Äî
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
      out += `\n\nFORME & FORCE (5 derniers r√©sultats + moyennes saison, donn√©es API r√©elles) :`;
      if (homeStats) out += `\n- ${match.home} : forme ${homeStats.form || "?"} | ${homeStats.gfAvg} but/m marqu√©s, ${homeStats.gaAvg} encaiss√©s | ${homeStats.wins}V-${homeStats.draws}N-${homeStats.loses}D`;
      if (awayStats) out += `\n- ${match.away} : forme ${awayStats.form || "?"} | ${awayStats.gfAvg} but/m marqu√©s, ${awayStats.gaAvg} encaiss√©s | ${awayStats.wins}V-${awayStats.draws}N-${awayStats.loses}D`;
    }
    if (standings?.rows?.length) {
      const h = standings.rows.find(r => r.teamId === match.homeId);
      const a = standings.rows.find(r => r.teamId === match.awayId);
      if (h || a) {
        out += `\n\nCLASSEMENT & ENJEU :`;
        if (h) out += `\n- ${match.home} : ${h.rank}e (${h.points} pts) ‚Äî ${stakeLabel(h.rank, standings.total)}`;
        if (a) out += `\n- ${match.away} : ${a.rank}e (${a.points} pts) ‚Äî ${stakeLabel(a.rank, standings.total)}`;
        if (h && a) out += `\n- √âcart : ${Math.abs(h.rank - a.rank)} places, ${Math.abs(h.points - a.points)} pts`;
      }
    }
    if (injuries && (injuries.home.length || injuries.away.length)) {
      out += `\n\nBLESS√âS / ABSENTS (donn√©es API r√©elles) :`;
      out += `\n- ${match.home} : ${injuries.home.length ? injuries.home.slice(0, 5).join(", ") : "aucun signal√©"}`;
      out += `\n- ${match.away} : ${injuries.away.length ? injuries.away.slice(0, 5).join(", ") : "aucun signal√©"}`;
    }
    if (out) {
      out += `\n‚Üí Croise ces donn√©es avec le H2H pour justifier ta confiance. Mauvaise forme, √©cart de niveau au classement, absences cl√©s ou faible enjeu = prudence. Signaux convergents (bonne forme + classement + H2H align√©s) = confiance haute justifi√©e.`;
      console.log(`[concile] Contexte profond OK ${match.home} vs ${match.away}`);
    }
    return out;
  } catch (e) {
    console.error("[concile] deep-context:", e.message);
    return "";
  }
}

// ‚îÄ‚îÄ Vraies cotes bookmakers ARJEL (API-Sports) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
const oddsCache = new Map();
const ARJEL_BOOKMAKERS = [
  "betclic", "winamax", "unibet", "parionssport", "parions sport",
  "pmu", "zebet", "vbet", "genybet", "bwin", "betsson", "netbet", "france pari",
];

// Comp√©titions non-foot MAJEURES disponibles sur les bookmakers ARJEL fran√ßais.
// Elles n'ont pas de cote r√©cup√©r√©e automatiquement (l'API odds ne couvre que le
// foot), mais on sait qu'elles sont jouables en France ‚Üí autoris√©es pour les clients.
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
// param√®tre "fixture", les autres sports "game" ‚Äî et chacun son sous-domaine.
// Sans cette table, seul le football obtenait une vraie cote : or la diffusion
// exige une vraie cote bookmaker, donc basket, hockey et baseball ne pouvaient
// JAMAIS √™tre diffus√©s, alors que le palier Elite promet 30 signaux/jour
// multisport. Le palier √©tait structurellement intenable.
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
  // Respecte le disjoncteur de quota d√©j√† en place : inutile d'insister sur un
  // sport dont l'API nous a d√©j√† renvoy√© un d√©passement.
  if (typeof shouldSkipApiSportsSport === "function" && shouldSkipApiSportsSport(cfg.key)) return null;

  // Le score fait partie de la cle : un but change les cotes instantanement,
  // mais le cache durait 10 min meme en direct ‚Äî un abonne pouvait recevoir
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
      // On privil√©gie NOS bookmakers partenaires (cliquables sur le site : Winamax,
      // Unibet, PMU), puis n'importe quel ARJEL, puis le premier disponible.
      const PARTNER = ["winamax", "unibet", "pmu"];
      const chosen = bookmakers.find(bm => PARTNER.some(a => String(bm.name || "").toLowerCase().includes(a)))
        || bookmakers.find(bm => ARJEL_BOOKMAKERS.some(a => String(bm.name || "").toLowerCase().includes(a)))
        || bookmakers[0];
      data = {
        bookmaker: chosen.name, bets: chosen.bets || [],
        // Tous les bookmakers ARJEL renvoy√©s par l'API pour ce match ‚Äî sert √†
        // calculer une cote MOYENNE (pas juste celle d'un seul op√©rateur).
        arjelBookmakers: bookmakers.filter(bm => ARJEL_BOOKMAKERS.some(a => String(bm.name || "").toLowerCase().includes(a))),
        // Horodatage de la VRAIE recuperation (pas du cache) ‚Äî affiche cote
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

// Mappe le pari recommand√© (texte libre FR) vers la vraie cote du bookmaker.
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
  if (/btts|both teams|deux √©quipes|marquent/.test(b)) {
    const bt = findBet(["both teams to score", "both teams score"]);
    const wantNo = /\bnon\b|\bno\b/.test(b);
    return valOf(bt, s => wantNo ? s === "no" : s === "yes");
  }
  if (/but.*1(√®re|ere|\s)?\s*mi-?temps|goal.*first half/.test(b)) {
    // "But en 1√®re mi-temps" = au moins un but marque en 1ere periode = Over 0.5
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

// Cote march√© r√©aliste par d√©faut si aucune vraie cote ‚Äî vari√©e SELON le march√©
// (fini la cote unique 1.71 pour tout). Utilis√©e en fallback uniquement.
function estimateMarketOdd(confidence, betLabel) {
  const base = Math.min(1.95, (1 / (Math.max(1, confidence) / 100)) * 1.45);
  const b = String(betLabel || "").toLowerCase();
  let mult = 1.0, lo = 1.2, hi = 2.6;
  if (/double chance|1x|x2|12\b/.test(b))                { mult = 0.72; lo = 1.12; hi = 1.75; }
  else if (/draw no bet|dnb|rembours√©/.test(b))          { mult = 0.9;  lo = 1.25; hi = 2.2; }
  else if (/victoire|vainqueur|winner/.test(b))          { mult = 0.88; lo = 1.2;  hi = 2.9; }
  else if (/under|moins de|-2\.5|-1\.5|-3\.5/.test(b))   { mult = 1.0;  lo = 1.4;  hi = 2.1; }
  else if (/over|plus de|\+2\.5|\+1\.5|\+3\.5/.test(b))  { mult = 1.12; lo = 1.5;  hi = 2.5; }
  else if (/btts|both teams|deux √©quipes|marquent/.test(b)) { mult = 1.08; lo = 1.5; hi = 2.3; }
  const odd = Math.max(lo, Math.min(hi, base * mult));
  return Math.round(odd * 100) / 100;
}

// Pastille de couleur selon le % de confiance ‚Äî m√™me √©chelle utilis√©e sur la
// page Live IA (fonction confMeta c√¥t√© client) et dans les messages Telegram,
// pour que le client voie le m√™me code couleur partout.
function confidenceEmoji(conf) {
  const c = Number(conf) || 0;
  if (c >= 85) return "üü¢";
  if (c >= 75) return "üü°";
  if (c >= 65) return "üü†";
  return "üî¥";
}

// Moyenne des cotes ARJEL disponibles pour ce pari, tous bookmakers confondus
// (Winamax, Unibet, PMU, Betclic, Zebet...). Diff√©rent de la "cote r√©elle"
// retenue pour le tier (celle-l√† vient d'UN SEUL bookmaker, prioris√© sur nos
// partenaires) ‚Äî la moyenne donne au client une vision du march√© dans son
// ensemble, demand√©e pour affichage Live IA + diffusion Telegram.
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

// ‚îÄ‚îÄ Garde-fou de plausibilite Over/Under 2.5 ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// API-Sports peut renvoyer une cote Over/Under perimee sans le signaler ‚Äî
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
// on peut juger avec certitude SANS modele ‚Äî a partir de la 45e minute, avec
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
  // cotes variees ‚Äî pas de verification dans ce cas.
  if (score.total <= 1) return odd >= 1.5;
  return true;
}

// Retourne la meilleure cote disponible : moyenne des bookmakers ARJEL trouves
// pour ce marche, sinon la cote d'un seul bookmaker (partenaire en priorite),
// sinon une estimation. Avant, un SEUL bookmaker (Winamax>Unibet>PMU) faisait
// foi meme quand plusieurs bookmakers ARJEL etaient disponibles ‚Äî un prix isole
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
  const minuteTag = oddMinute ? ` ¬∑ cote √† la ${oddMinute}e minute` : "";
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
    if (arjelAvgInfo) console.log(`[odds] moyenne ARJEL rejetee (implausible face a minute/score): ${arjelAvgInfo.avg} pour "${betLabel}" ‚Äî ${match.home} vs ${match.away}`);
    const real = pickRealOdd(oddsData, betLabel, match);
    if (real && isPlausibleRealOdd(betLabel, real, match)) {
      const bmName = oddsData.bookmaker || "bookmaker";
      return { cote: real, source: `${bmName}${minuteTag}`, arjelAvg: null, arjelCount: 0 };
    }
    if (real) console.log(`[odds] cote bookmaker rejetee (implausible face a minute/score): ${real} pour "${betLabel}" ‚Äî ${match.home} vs ${match.away}`);
  } catch (e) { console.error("[odds] compute:", e.message); }
  return { cote: estimateMarketOdd(confidence, betLabel), source: "estimation", arjelAvg: null, arjelCount: 0 };
}

// Cote d'une ligne concile_analyses : vraie cote stock√©e sinon estimation par march√©.
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
  const lines = ["\nüìä STATISTIQUES TEMPS R√âEL (donn√©es live api-sports.io) :"];
  if (stats.possession_home) lines.push(`  Possession    : ${home} ${stats.possession_home} ‚Äî ${away} ${stats.possession_away}`);
  if (stats.shots_on_goal_home !== null) lines.push(`  Tirs cadr√©s   : ${home} ${stats.shots_on_goal_home} ‚Äî ${away} ${stats.shots_on_goal_away}`);
  if (stats.total_shots_home !== null) lines.push(`  Tirs totaux   : ${home} ${stats.total_shots_home} ‚Äî ${away} ${stats.total_shots_away}`);
  if (stats.dangerous_attacks_home !== null) lines.push(`  Att. dang.    : ${home} ${stats.dangerous_attacks_home} ‚Äî ${away} ${stats.dangerous_attacks_away}`);
  if (stats.corners_home !== null) lines.push(`  Corners       : ${home} ${stats.corners_home} ‚Äî ${away} ${stats.corners_away}`);
  if (stats.yellow_cards_home > 0 || stats.yellow_cards_away > 0) lines.push(`  Cartons jaunes: ${home} ${stats.yellow_cards_home} ‚Äî ${away} ${stats.yellow_cards_away}`);
  if (stats.red_cards_home > 0 || stats.red_cards_away > 0) lines.push(`  ‚ö†Ô∏è CARTONS ROUGES: ${home} ${stats.red_cards_home} ‚Äî ${away} ${stats.red_cards_away} (inf√©riorit√© num√©rique!)`);
  return lines.join("\n");
}

// ‚îÄ‚îÄ Groq Concile analysis ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
// Produit TousLesMatchs actif : football Over/Under 2,5 exclusivement.
// Les anciens march√©s restent en base pour l'historique mais ne sont plus
// propos√©s au Concile client.
const BET_TYPES = ["Over 2.5 buts", "Under 2.5 buts"];

// Estime la minute depuis l'heure de d√©but quand l'API ne la fournit pas
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

// Filtre les paris math√©matiquement impossibles ou d√©j√† perdus
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
  // pour un match de basket plie a 53-93 ‚Äî resultat impossible pour ce sport.
  // Constate le 01/08/2026, etendu au baseball a la reactivation du sport.
  if (sport === "Basketball" || sport === "Hockey" || sport === "Baseball") {
    return ["Victoire domicile", "Victoire ext√©rieur"];
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

  // Terrain neutre (Coupe du Monde, Euro, etc.) ‚Üí remplacer domicile/ext√©rieur par noms r√©els
  // Les termes "Victoire domicile/ext√©rieur" n'ont pas de sens sans avantage terrain
  if (isNeutral) {
    bets = bets.map(b => {
      if (b === "Victoire domicile") return `Victoire ${match.home}`;
      if (b === "Victoire ext√©rieur") return `Victoire ${match.away}`;
      if (b === "Double chance 1X") return `Double chance ${match.home} ou Nul`;
      if (b === "Double chance X2") return `Double chance ${match.away} ou Nul`;
      return b;
    });
  }

  if (!isLive) return bets;

  // March√©s d√©j√† PERDUS ‚Üí supprimer
  if (total > 2.5) bets = bets.filter(b => b !== "Under 2.5 buts");
  if (total > 1.5) bets = bets.filter(b => b !== "Under 1.5 buts" && b !== "Under 2.5 buts");
  if (h > 0 && a > 0) bets = bets.filter(b => b !== "BTTS Non");
  // March√©s d√©j√† gagn√©s : ne jamais proposer un pari dont l'issue est d√©j√† acquise.
  if (total > 2.5) bets = bets.filter(b => b !== "Over 2.5 buts");
  if (h > 0 && a > 0) bets = bets.filter(b => b !== "BTTS Oui");

  // Over 2.5 : projection math√©matique bas√©e sur le rythme actuel
  const need25 = Math.max(0, 3 - total);
  const projectedGoals = minute > 0 ? (total / minute) * 90 : 0;
  if (need25 >= 3 && remaining <= 30) bets = bets.filter(b => b !== "Over 2.5 buts");
  if (need25 >= 2 && remaining <= 15) bets = bets.filter(b => b !== "Over 2.5 buts");
  // Nouveau : si projection < 2.0 apr√®s 45 min ‚Üí Over 2.5 statistiquement improbable
  if (minute >= 45 && need25 >= 2 && projectedGoals < 2.0) bets = bets.filter(b => b !== "Over 2.5 buts");

  // BTTS quasi-impossible si une √©quipe vierge et peu de temps
  if (h === 0 && remaining <= 15) bets = bets.filter(b => b !== "BTTS Oui");
  if (a === 0 && remaining <= 15) bets = bets.filter(b => b !== "BTTS Oui");

  // Victoire impossible si m√®ne +2 et <10 min
  if (isNeutral) {
    if (h - a >= 2 && remaining <= 10) bets = bets.filter(b => b !== `Victoire ${match.away}`);
    if (a - h >= 2 && remaining <= 10) bets = bets.filter(b => b !== `Victoire ${match.home}`);
  } else {
    if (h - a >= 2 && remaining <= 10) bets = bets.filter(b => b !== "Victoire ext√©rieur");
    if (a - h >= 2 && remaining <= 10) bets = bets.filter(b => b !== "Victoire domicile");
  }

  return bets.length > 0 ? bets : BET_TYPES;
}

// Correction post-IA : si l'IA recommande quand m√™me un pari impossible, on corrige
function validateAndCorrectBet(bet, match, availableBets) {
  // R2 (finalit√© connue) : jamais de "Victoire" d'une √©quipe qui m√®ne d√©j√† de >= 3 buts.
  // Le r√©sultat est d√©cid√©, le book ne cote plus ‚Äî aucune valeur. Ex: 0-3 ‚Üí pas de "Victoire ext√©rieur".
  // Calibr√© pour le football (√©cart en BUTS) ‚Äî ne s'applique pas au basket/hockey,
  // qui n'ont pas d'alternative "sans vainqueur" (pas de match nul). Sans cette
  // exclusion, un basket pli√© √† 53-93 se faisait "corriger" vers un repli
  // arbitraire (Match nul, impossible dans ce sport, ou pire la mauvaise
  // √©quipe) au lieu de laisser l'IA pr√©dire la victoire ‚Äî pourtant correcte
  // avec un tel √©cart. Constate le 01/08/2026.
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
        (bet === "Victoire ext√©rieur" && -gap >= DECIDED_MATCH_GAP);
      if (decidedWin) {
        const alt = availableBets.find(b => b !== bet && !/Victoire/i.test(b)) || availableBets[0];
        console.log(`[concile] Finalit√© connue (${sc.home}-${sc.away}) : "${bet}" rejet√© ‚Üí "${alt}"`);
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
    corrected = h > a ? "Victoire domicile" : "Victoire ext√©rieur";
  }
  else corrected = availableBets[0]; // fallback sur premier pari disponible

  console.log(`[concile] Correction: "${bet}" ‚Üí "${corrected}" (math√©matiquement invalide √† ${minute}', score ${h}-${a})`);
  return { bet: corrected, corrected: true, original: bet };
}

const NEUTRAL_KEYWORDS = ["world cup","coupe du monde","fifa world","euro ","uefa euro","copa america","gold cup","afcon","africa cup","nations league final","champions league final","europa league final"];
function isNeutralComp(comp = "") {
  const c = comp.toLowerCase();
  return NEUTRAL_KEYWORDS.some(k => c.includes(k));
}

// Calcule les contraintes math√©matiques live pour √©viter les paris impossibles
function computeLiveConstraints(match) {
  const score = readKnownScore(match);
  if (!score) return "";
  const h = score.home;
  const a = score.away;
  const total = score.total;
  const minute = estimateMinute(match); // utilise l'estimation si null
  const isLive = minute >= 30 && match.status !== "SCHEDULED" && match.minute !== "Pr√©-match";

  if (!isLive) return "";

  const remaining = Math.max(0, 93 - minute);
  const goalsPerMin = minute > 0 ? total / minute : 0;
  const projectedTotal = Math.round(goalsPerMin * 90 * 10) / 10;

  const lines = ["\nüî¢ CONTRAINTES MATH√âMATIQUES LIVE ‚Äî respecte-les imp√©rativement:"];

  // ‚îÄ‚îÄ March√©s d√©j√† gagn√©s
  const won = [];
  if (total > 3.5) won.push("Over 3.5 ‚úÖ");
  if (total > 2.5) won.push("Over 2.5 ‚úÖ");
  if (total > 1.5) won.push("Over 1.5 ‚úÖ");
  if (h > 0 && a > 0) won.push("BTTS Oui ‚úÖ");
  if (won.length) lines.push(`  ‚Üí D√âJ√Ä GAGN√âS : ${won.join(", ")} ‚Äî ne propose pas leurs oppos√©s.`);

  // ‚îÄ‚îÄ March√©s d√©j√† perdus
  const lost = [];
  if (total > 3.5) lost.push("Under 3.5 ‚ùå");
  if (total > 2.5) lost.push("Under 2.5 ‚ùå");
  if (total > 1.5) lost.push("Under 1.5 ‚ùå");
  if (h > 0 && a > 0) lost.push("BTTS Non ‚ùå");
  if (lost.length) lines.push(`  ‚Üí D√âJ√Ä PERDUS ‚Äî ne PAS recommander : ${lost.join(", ")}`);

  // ‚îÄ‚îÄ Over 2.5 faisabilit√©
  if (total < 3) {
    const need25 = 3 - total;
    if (need25 >= 3 && remaining <= 25) {
      lines.push(`  ‚Üí Over 2.5 QUASI IMPOSSIBLE : ${need25} but(s) en ~${remaining} min ‚Üí probabilit√© <5% ‚Üí recommande Under 2.5.`);
    } else if (need25 >= 2 && remaining <= 20) {
      lines.push(`  ‚Üí Over 2.5 TR√àS DIFFICILE : ${need25} but(s) en ~${remaining} min ‚Üí Under 2.5 favori.`);
    } else if (need25 === 1 && remaining <= 12) {
      lines.push(`  ‚Üí Over 2.5 : 1 but en ~${remaining} min ‚Äî incertain, pr√©f√®re Under 2.5.`);
    }
  }

  // ‚îÄ‚îÄ Over 1.5 faisabilit√©
  if (total < 2) {
    const need15 = 2 - total;
    if (need15 >= 2 && remaining <= 15) {
      lines.push(`  ‚Üí Over 1.5 QUASI IMPOSSIBLE : 2 buts en ~${remaining} min.`);
    } else if (need15 === 1 && remaining <= 8) {
      lines.push(`  ‚Üí Over 1.5 : 1 but en ~${remaining} min ‚Äî tr√®s serr√©.`);
    }
  }

  // ‚îÄ‚îÄ D√©tection de massacre / domination totale
  const scoreDiff = Math.abs(h - a);
  if (scoreDiff >= 3 && total < 3) {
    lines.push(`  ‚Üí ‚ö†Ô∏è DOMINATION TOTALE (${h}-${a}) : NE PAS recommander Under 2.5 ‚Äî l'√©quipe dominante continue de marquer.`);
  } else if (scoreDiff >= 2 && minute <= 60) {
    lines.push(`  ‚Üí ‚ö†Ô∏è √âCART IMPORTANT (${h}-${a}) en ${minute}' : Under 2.5 est RISQU√â ‚Äî l'√©quipe en t√™te peut continuer √† marquer. Pr√©f√®re Over 2.5 ou Victoire.`);
  } else if (total >= 2 && minute <= 45) {
    lines.push(`  ‚Üí ‚ö†Ô∏è MATCH OUVERT (${total} buts en ${minute}') : Under 2.5 RISQU√â au rythme actuel. Pr√©f√®re Over 2.5.`);
  }

  // ‚îÄ‚îÄ Rythme de buts (extrapolation + recommandation)
  if (minute >= 30) {
    lines.push(`  ‚Üí Rythme actuel : ${total} but(s) en ${minute}' ‚Üí extrapolation : ~${projectedTotal} buts √† 90'.`);
    if (projectedTotal >= 3.0 && total < 3) {
      lines.push(`  ‚Üí ‚ö†Ô∏è PROJECTION HAUTE (${projectedTotal} buts) : Under 2.5 DANGEREUX ‚Üí pr√©f√®re Over 2.5 ou Victoire.`);
    } else if (projectedTotal < 2.0 && total < 3 && scoreDiff < 2) {
      lines.push(`  ‚Üí PROJECTION FAIBLE (${projectedTotal} buts) : Over 2.5 peu probable ‚Üí Under 2.5 favori.`);
    } else if (projectedTotal >= 2.5 && total < 3) {
      lines.push(`  ‚Üí Projection compatible avec Over 2.5 (${projectedTotal} buts estim√©s).`);
    }
  }

  // ‚îÄ‚îÄ BTTS faisabilit√©
  if (h === 0 && remaining <= 20) {
    lines.push(`  ‚Üí BTTS Oui : ${match.home} n'a PAS marqu√© ‚Äî risqu√© avec seulement ~${remaining} min restantes.`);
  }
  if (a === 0 && remaining <= 20) {
    lines.push(`  ‚Üí BTTS Oui : ${match.away} n'a PAS marqu√© ‚Äî risqu√© avec seulement ~${remaining} min restantes.`);
  }

  // ‚îÄ‚îÄ R√©sultat 1X2 en fin de match
  if (minute >= 75) {
    if (h > a) lines.push(`  ‚Üí ${match.home} m√®ne ${h}-${a} √† la ${minute}' : Victoire domicile TR√àS PROBABLE. Retournement <8%.`);
    else if (a > h) lines.push(`  ‚Üí ${match.away} m√®ne ${a}-${h} √† la ${minute}' : Victoire ext√©rieur TR√àS PROBABLE. Retournement <8%.`);
    else lines.push(`  ‚Üí 0-0 ou √©galit√© √† la ${minute}' : Match nul probable (~45%) ou but d√©cisif dans ~${remaining} min.`);
  }

  lines.push("  ‚Üí PRIORISE ces contraintes LIVE sur toute stat pr√©-match. Ne recommande PAS un march√© math√©matiquement contraire.");
  return lines.join("\n");
}

// ‚îÄ‚îÄ Lecture tolerante de la reponse d'un agent (07/08/2026) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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
  // Le repli regex plus bas doit rester atteignable meme sans aucune accolade ‚Äî
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

  // Dernier recours : les champs a la regex. On ne fabrique rien ‚Äî si "bet"
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

// ‚îÄ‚îÄ Disjoncteur des fournisseurs directs (07/08/2026) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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
  // 401/402/403 = le compte est en cause, ca ne se repare pas tout seul ‚Üí 24h.
  // 429 = charge ou quota glissant ‚Üí 6h suffisent.
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
    console.error(`[provider-health] ${host} ecarte ${heures}h ‚Äî HTTP ${status}`);
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
    ? "\n‚ö†Ô∏è TERRAIN NEUTRE ‚Äî ne PAS mentionner l'avantage domicile, il n'existe pas dans cette comp√©tition."
    : "";
  const sport = String(match.sport || "Football");
  const sportNote = sport !== "Football"
    ? `\nSport: ${sport}` : "";
  const sportRules = sport === "Basketball"
    ? "\nR√®gle sport: basket ‚Äî privil√©gier moneyline/vainqueur et handicap prudent; √©viter les gros over/under points sauf donn√©es tr√®s solides."
    : sport === "Hockey"
      ? "\nR√®gle sport: hockey ‚Äî privil√©gier vainqueur/double chance; over/under seulement si rythme et tirs sont tr√®s solides."
      : sport === "Baseball"
        ? "\nR√®gle sport: baseball ‚Äî privil√©gier moneyline/vainqueur; √©viter les march√©s joueurs ou exotiques au d√©but."
        : "\nR√®gle sport: football ‚Äî march√©s autoris√©s: vainqueur, double chance, draw no bet, BTTS, over/under prudents, but √©quipe.";
  const liveConstraints = computeLiveConstraints(match);

  // R√©cup√©rer les statistiques live si disponibles (football uniquement)
  const isLiveMatch = match.status === "IN_PLAY" || match.status === "LIVE";
  const statsStatus = isLiveMatch
    ? await fetchMatchStatsForMatch(match)
    : buildStatsStatus(match, null, "match_not_live");
  const liveStats = statsStatus.available ? statsStatus.stats : null;
  const statsBlock = buildStatsBlock(liveStats, match.home, match.away);

  // H2H factuel + contexte profond (forme, classement, enjeu, bless√©s) en parall√®le
  let h2hBlock = "", deepBlock = "", h2hData = null;
  try {
    const [h2h, deep] = await Promise.all([
      fetchH2H(match),
      fetchDeepContext(match),
    ]);
    h2hBlock = buildH2HBlock(h2h, match.home, match.away);
    deepBlock = deep || "";
    h2hData = h2h;
    if (h2h) console.log(`[concile] H2H r√©cup√©r√© ${match.home} vs ${match.away}: ${h2h.n} matchs, moy ${h2h.avgGoals} buts, Under2.5 ${h2h.under25Pct}%`);
  } catch (e) {
    console.error("[concile] H2H/deep:", e.message);
  }

  if (statsStatus.available) {
    console.log(`[concile] Stats live r√©cup√©r√©es pour ${match.home} vs ${match.away} fixture=${statsStatus.fixtureId}`);
  } else {
    console.log(`[concile] Stats live indisponibles pour ${match.home} vs ${match.away}: ${statsStatus.reason}`);
  }

  // Pr√©-filtrer les paris impossibles du prompt
  const availableBets = computeAvailableBets(match);
  const estimatedMin = estimateMinute(match);
  const minuteDisplay = match.minute ? `${match.minute}'` : (estimatedMin > 0 ? `~${estimatedMin}' (estim√©)` : "Pr√©-match");

  const recoveryPromptBlock = RECOVERY_MODE_ENABLED
    ? `\n\nMODE RECOVERY ‚Äî sortie client uniquement si : championnat autorise, historique recent complet, moyenne Over >= 2.80 ou Under <= 2.20, au moins 3 indicateurs convergents, confirmation live, absences disponibles, confiance >= 78 et au moins 4 votes concordants sur 5. En cas de doute, ne force jamais la confiance.`
    : "";
  const matchContext = `Match: ${match.home} vs ${match.away}
Comp√©tition: ${match.competition || "International"}${sportNote}
Score actuel: ${match.score_home ?? "?"}-${match.score_away ?? "?"}
Minute: ${minuteDisplay}
Statut: ${match.status}${neutralNote}${sportRules}${statsBlock}${h2hBlock}${deepBlock}${liveConstraints}${recoveryPromptBlock}

IMPORTANT ‚Äî Paris AUTORIS√âS dans ce contexte (les seuls disponibles math√©matiquement) :
‚Üí ${availableBets.join(", ")}
Tu DOIS choisir UNIQUEMENT parmi cette liste. Tout autre march√© est math√©matiquement invalide.`;

  // Delai d'attente accorde a chaque agent du Concile. 3,5 s etait bien trop
  // court : les agents tournent en parallele (Promise.all), donc ce delai ne
  // coute que le temps du PLUS LENT, pas la somme des cinq. A 3,5 s, les modeles
  // naturellement lents expiraient en silence ‚Äî mesure sur 7 jours : Qwen 85 %
  // de votes vides, Perplexity 81 % (il fait une recherche web avant de
  // repondre), Mistral-Large 61 %, contre 36 % pour DeepSeek et Cohere, les plus
  // rapides. Consequence : 69 % des analyses avaient moins de 3 votes, donc une
  // confiance forcee a 55 et aucune diffusion possible.
  const AGENT_TIMEOUT_MS = Math.max(45000, Number(process.env.AGENT_TIMEOUT_MS || 45000));

  // Concile v3 ‚Äî 5 familles d'IA radicalement diff√©rentes + Chief
  // Agent 0 : Perplexity-Web  ‚Üí acc√®s web temps r√©el (forme, blessures, H2H)
  // Agent 1 : DeepSeek-V3     ‚Üí contrarian (architecture chinoise, entra√Ænement diff√©rent)
  // Agent 2 : Mistral-Large   ‚Üí mod√®le europ√©en (architecture MoE, ‚â† Llama/GPT)
  // Agent 3 : Cohere-Command  ‚Üí sp√©cialiste RAG/donn√©es structur√©es (architecture ‚â† tout le reste)
  // Agent 4 : Kimi            ‚Üí synthese quantitative (remplace Qwen, 0/26 votes)
  // Agent 5 : Chief           ‚Üí arbitre Llama-70b (Groq, rapide)
  const usePerplexity = !!PERPLEXITY_API_KEY;
  const useMistral    = !!MISTRAL_API_KEY;
  const useCohere     = !!COHERE_API_KEY;
  const useOpenRouter = !!OPENROUTER_API_KEY;

  const agentNames = [
    {
      name: "Perplexity-Web",
      model: usePerplexity ? "sonar-pro" : "llama-3.3-70b-versatile",
      icon: "üåê",
      usePerplexity,
    },
    { name: "DeepSeek-V3", model: "deepseek-chat", icon: "üîÆ", useDeepseek: true },
    {
      name: "Mistral-Large",
      model: useMistral ? "mistral-large-latest" : "llama-3.3-70b-versatile",
      icon: "üåä",
      useMistral,
    },
    {
      name: "Qwen-3.7-Max",
      // "command-r-plus" a ete retire par Cohere le 15/09/2025 (HTTP 404 constate
      // le 29/07/2026). command-r-plus-08-2024 est le modele equivalent toujours
      // actif, verifie via /v1/models sur la cle en production.
      model: resolveModel(process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max"),
      icon: "üß¨",
      useOpenRouter: true,
      openRouterModelKey: "qwen",
    },
    {
      name: "OpenRouter-Qwen",
      model: resolveModel(process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max"),
      icon: "üåü",
      useOpenRouter,
      openRouterModelKey: "qwen",
    },
    { name: "Claude Chief", model: "llama-3.3-70b-versatile", icon: "üëë" },
  ];
  const CHIEF_INDEX = agentNames.length - 1;
  const AGENT_INDEXES = agentNames.map((_, i) => i).filter(i => i !== CHIEF_INDEX);

  const webSearchNote = usePerplexity
    ? `\nATTENTION : tu as acc√®s aux donn√©es web en temps r√©el. Cherche imp√©rativement : forme r√©cente de ${match.home} et ${match.away} (5 derniers matchs), blessures confirm√©es, confrontations directes r√©centes, et cotes actuelles chez les bookmakers. Cite tes sources. N'invente RIEN.`
    : "";

  const personas = [
    `Tu es Perplexity-Web, agent data temps r√©el.${webSearchNote} Mission : apporter des FAITS v√©rifi√©s sur ${match.home} vs ${match.away}. Recherche imp√©rativement : classement actuel des deux √©quipes dans leur championnat (top 5 / milieu / bottom 5), forme sur les 5 derniers matchs, blessures majeures confirm√©es, H2H r√©cent avec moyenne de buts. Si tu n'as pas de donn√©es fiables, dis-le. Tu es le seul agent avec acc√®s web ‚Äî c'est ton avantage unique.`,

    `Tu es DeepSeek-V3, agent contrarian. Ton r√¥le est de CONTREDIRE l'intuition dominante sur ${match.home} vs ${match.away}. Crit√®res cl√©s √† v√©rifier : une √©quipe en haut du classement en mauvaise forme r√©cente (5 derniers matchs), fatigue/calendrier charg√©, H2H qui contredit le classement, √©quipe en bas de tableau surperformante √† domicile. N'accepte un pick que si tu as un argument bas√© sur des donn√©es ‚Äî pas une intuition.`,

    `Tu es Mistral-Large, expert tactique europ√©en. Analyse ${match.home} vs ${match.away} avec : 1) Position au classement et √©cart entre les deux √©quipes, 2) Force d√©fensive vs offensive (buts marqu√©s/encaiss√©s par match), 3) Bilan domicile vs ext√©rieur sp√©cifique, 4) Moyenne de buts des H2H pour Under/Over. Top 4 vs Bottom 5 √† domicile = signal fort. Raisonne : donn√©es ‚Üí conclusion.`,

    `Tu es Qwen-3.7-Max, sp√©cialiste quantitatif exclusivement Over/Under 2,5. Pour ${match.home} vs ${match.away} : 1) Identifie le march√© avec la meilleure value en croisant classement + forme + H2H, 2) Si les deux √©quipes ont une moyenne < 2.0 buts/match ET les H2H sont majoritairement Under = Under tr√®s probable, 3) Si √©cart > 10 places au classement + forme align√©e = ML probable. Raisonne en probabilit√©s, √©vite les march√©s surpric√©s.`,

    `Tu es OpenRouter-Qwen, agent de synth√®se quantitative. Ta mission sur ${match.home} vs ${match.away} est de croiser le score live, la dynamique du match, les √©carts de niveau et les march√©s autoris√©s pour d√©tecter le signal le plus robuste. Tu dois challenger les autres agents avec une lecture froide des probabilit√©s, sans inventer de donn√©es absentes.`,

    `Tu es Claude Chief, arbitre du Concile v3. Tu re√ßois 5 votes d'IA. Crit√®res de d√©cision par ordre de poids : 1) Classement + √©cart de niveau (30%), 2) Forme r√©cente 5 matchs (25%), 3) H2H + moyenne buts (15%), 4) Facteur dom/ext (15%), 5) Moyenne buts/match (10%), 6) Cotes/value (5%). Ne valide que si au moins 2 crit√®res forts sont align√©s. NOPICK si les signaux sont contradictoires. Mieux vaut 0 pick qu'un mauvais pick.

R√àGLE CHAMPION : le march√© "But en 1√®re mi-temps" a un winrate historique prouv√© de 82% (931 pronos v√©rifi√©s). √Ä qualit√© √©gale (√©cart de confiance ‚â§ 5 points), tu DOIS privil√©gier ce march√© sur les autres. Si un agent le vote avec confiance ‚â• 75% et que ton propre pick est un autre march√© avec confiance √©quivalente, aligne-toi sur "But en 1√®re mi-temps" ‚Äî c'est notre march√© champion prouv√©.`,
  ];

  // Charger les performances historiques pour pond√©rer le verdict du Chief
  const agentPerf = getAgentPerformance();
  const agentMarketPerf = getAgentMarketPerformance();
  const agentMarketCompPerf = getAgentMarketCompetitionPerformance();
  const MIN_MARKET_SAMPLE = 20; // sous ce seuil, le winrate march√© est trop bruit√© ‚Äî on retombe sur le winrate global
  const MIN_COMPETITION_SAMPLE = 15; // championnat : echantillon forcement plus petit, seuil plus bas mais toujours filtre

  const agentMarketList = []; // avis multi-march√©s de chaque agent (hors Chief)

  // Helper: run a single agent and return its result
  async function runSingleAgent(i) {
    const isChief = i === CHIEF_INDEX;
    const agCfg = agentNames[i];
    const temp = 0.3 + i * 0.05;
    const maxTok = isChief ? 400 : 300;

    const prompt = `${personas[i]}

${matchContext}

En te basant sur tes connaissances des √©quipes ET les donn√©es live ci-dessus, recommande la meilleure analyse.
Tu DOIS choisir parmi cette liste uniquement : ${availableBets.join(", ")}

DIRECTIVE MARCH√â :
- Under 2.5 buts UNIQUEMENT si le match est √©quilibr√© (√©cart de score 0-1) ET le rythme de buts est faible (projection < 2.5).
- INTERDIT de recommander Under 2.5 si : √©cart >= 2 buts OU 2+ buts marqu√©s avant la 45' OU une √©quipe domine clairement.
- Si l'√©cart est large (2+), pr√©f√®re Over 2.5 ou Victoire de l'√©quipe dominante.
- Respecte imp√©rativement les CONTRAINTES MATH√âMATIQUES LIVE ci-dessous.

‚ö†Ô∏è CONFIANCE ARGUMENT√âE ‚Äî INTERDICTION du 70% g√©n√©rique :
- Ta "confidence" DOIT refl√©ter la force r√©elle des donn√©es, pas une valeur ronde par d√©faut.
- Base-la explicitement sur : la forme r√©cente des 2 √©quipes, l'historique des confrontations directes (H2H), les bless√©s/absents connus (uniquement si tu en es s√ªr), l'enjeu (place √† gagner/√† d√©fendre au classement), le contexte (domicile/ext√©rieur, terrain neutre), et les stats live ci-dessus.
- Peu de signaux concordants ‚Üí confiance basse (50-62). Signaux forts et convergents ‚Üí confiance haute (78-90). N'utilise 70 QUE si c'est r√©ellement le calcul, jamais par facilit√©.
- La "raison" DOIT citer au moins 2 donn√©es concr√®tes distinctes (ex: "3 des 5 derniers H2H sous 2.5 buts, + attaque ext√©rieure √† 0.9 but/match") ‚Äî pas de phrase vague type "analyse bas√©e sur le rythme".

Donne AUSSI ton avis rapide sur chaque march√© (objet "marches", codes courts + confiance 40-90) :
- buts: "o2.5" (plus de 2.5) ou "u2.5" (moins de 2.5)
- ou05: "o0.5" (plus de 0.5, au moins 1 but) ou "u0.5" (0 but, 0-0)
- ou15: "o1.5" (plus de 1.5) ou "u1.5" (moins de 1.5)
- btts: "oui" ou "non" (les deux √©quipes marquent)
- resultat: "dom", "ext" ou "nul"
- mt1: "oui" ou "non" (au moins un but en 1√®re mi-temps, les deux √©quipes confondues)
- mt1_dom: "oui" ou "non" (${match.home} marque en 1√®re mi-temps)
- mt1_ext: "oui" ou "non" (${match.away} marque en 1√®re mi-temps)
- mt2: "oui" ou "non" (au moins un but en 2√®me mi-temps, les deux √©quipes confondues)
- mt2_dom: "oui" ou "non" (${match.home} marque en 2√®me mi-temps)
- mt2_ext: "oui" ou "non" (${match.away} marque en 2√®me mi-temps)

R√©ponds en JSON pur (pas de markdown):
{
  "bet": "un parmi: ${availableBets.join(", ")}",
  "confidence": <nombre 50-90 argument√©, PAS 70 par d√©faut>,
  "raison": "<2 phrases avec au moins 2 donn√©es chiffr√©es concr√®tes (forme, H2H, bless√©s, enjeu, stats)>",
  "marches": {"buts":{"p":"o2.5","c":70},"ou05":{"p":"o0.5","c":80},"ou15":{"p":"o1.5","c":75},"btts":{"p":"oui","c":60},"resultat":{"p":"dom","c":65},"mt1":{"p":"oui","c":55},"mt1_dom":{"p":"oui","c":58},"mt1_ext":{"p":"non","c":52},"mt2":{"p":"oui","c":65},"mt2_dom":{"p":"oui","c":60},"mt2_ext":{"p":"non","c":50}}
}`;

    try {
      let providers = [];
      // Cle anti-doublon/budget partagee par TOUS les repli OpenRouter de cet
      // agent (voir analysis_engine.js) ‚Äî doit exister avant le premier appel
      // au garde-fou, pas seulement avant les replis du bas de liste : c'est
      // l'absence de cette garde sur les deux appels ci-dessous (Perplexity et
      // Qwen "titulaires") qui a vide le budget OpenRouter le 29-30/07/2026.
      // La cle anti-doublon du garde-fou budgetaire doit inclure l'ETAT du match,
      // pas seulement les equipes. Sans cela, la 2e analyse d'un match en direct
      // (l'auto-concile repasse toutes les 6 minutes, le score ayant evolue)
      // etait refusee comme "deja traite aujourd'hui" : OpenRouter etait bloque
      // et le systeme se rabattait sur les comptes directs ‚Äî Cohere (quota
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
      // compte direct, invisible et non budgete ‚Äî resultat, les 4 sont tombes
      // en panne le meme jour (cle expiree, solde a zero, quota d'essai
      // epuise, rate-limit) sans que rien ne le signale a l'avance. Chacun
      // passe maintenant par OpenRouter EN PREMIER, sous le meme garde-fou
      // budgetaire (2‚Ç¨/jour, tous agents confondus) ‚Äî un seul compte a
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
      // (budget/quota du jour atteint) ou echoue ‚Äî utiles si un jour
      // re-alimentes, mais plus le chemin principal.
      if (agCfg.useDeepseek && DEEPSEEK_API_KEY) providers.push({ kind: "openai", url: "https://api.deepseek.com/v1/chat/completions", key: DEEPSEEK_API_KEY, model: agCfg.model });
      if (agCfg.usePerplexity && PERPLEXITY_API_KEY) providers.push({ kind: "openai", url: "https://api.perplexity.ai/chat/completions", key: PERPLEXITY_API_KEY, model: agCfg.model });
      if (agCfg.useMistral && MISTRAL_API_KEY) providers.push({ kind: "openai", url: "https://api.mistral.ai/v1/chat/completions", key: MISTRAL_API_KEY, model: agCfg.model });
      if (agCfg.useCohere && COHERE_API_KEY) providers.push({ kind: "cohere", key: COHERE_API_KEY, model: agCfg.model });
      // Ne jamais faire voter un agent officiel sous un autre mod√®le g√©n√©rique :
      // cinq libell√©s utilisant le m√™me Llama ne sont pas cinq avis ind√©pendants.
      // Les replis OpenRouter ci-dessous conservent un mod√®le identifi√© par agent.
      // Repli OpenRouter sous garde-fou budget/anti-doublon/coupe-circuit (voir
      // analysis_engine.js). Chemin rare : n'intervient que si l'agent n'a ni
      // fournisseur officiel d√©di√©, ni DeepSeek/Mistral/Groq partag√©s disponibles.
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
      // anti-doublon par match/agent, coupe-circuit) ‚Äî jamais en le contournant.
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
      // avait simplement aucun. Il franchit le seul coupe-circuit "spike" ‚Äî
      // budget quotidien, anti-doublon et duplicate_burst restent opposables ‚Äî
      // et il est plafonne a 5 par analyse et 60 par jour.
      if (!providers.length && OPENROUTER_API_KEY && _avantFiltre > 0) {
        if (_secoursCetteAnalyse >= SECOURS_MAX_PAR_ANALYSE) {
          console.warn(`[concile] ${agCfg.name} : plafond de ${SECOURS_MAX_PAR_ANALYSE} replis atteint pour cette analyse ‚Äî agent silencieux`);
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
            console.warn(`[concile] ${agCfg.name} : ${_avantFiltre} fournisseur(s) ecarte(s), repli refuse ‚Äî agent silencieux`);
          }
        }
      } else if (!providers.length && OPENROUTER_API_KEY) {
        console.warn(`[concile] ${agCfg.name} : aucun fournisseur configure et aucun ecarte ‚Äî pas de repli de secours`);
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
      // Trace si l'appel a reellement produit un vote ‚Äî distinct de "a repondu".
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
          // Reponse HTTP recue sans exception, mais sans contenu exploitable ‚Äî
          // diagnostic precis a partir des marqueurs poses par httpPost() plutot
          // que de deviner "timeout" par defaut (constate le 04/08/2026 : la
          // quasi-totalite des votes echouaient et le message generique empechait
          // de savoir si c'etait un vrai timeout ou une cle/quota en erreur).
          const pvHost = pv.kind === "cohere" ? "api.cohere.com" : (pv.url || "").split("/")[2] || pv.kind;
          lastDiag = resp?._httpTimedOut ? `timeout ${AGENT_TIMEOUT_MS}ms (${pvHost})`
            : resp?._httpStatus ? `HTTP ${resp._httpStatus} (${pvHost}) ‚Äî ${JSON.stringify(resp).slice(0, 200)}`
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
          console.error(`[concile] ${agCfg.name} fournisseur √©chec: ${e.message}`);
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
        console.error(`[concile] agent ${agCfg.name} : aucun vote exploitable ‚Äî ${lastDiag || "raison inconnue"}`);
        return {
          name: agCfg.name, icon: agCfg.icon,
          bet: "‚Äî", confidence: null,
          raison: "‚ö†Ô∏è Agent sans r√©ponse exploitable dans le d√©lai imparti ‚Äî non compt√© dans le verdict.",
          isChief: false, failed: true,
        };
      }

      const rawBet = parsed.bet || availableBets[0];
      if (parsed.marches && typeof parsed.marches === "object") {
        agentMarketList.push({ name: agCfg.name, marches: parsed.marches });
      }
      const { bet: validBet, corrected, original } = validateAndCorrectBet(rawBet, match, availableBets);
      const fallbackRaison = `Score actuel ${match.score_home}-${match.score_away}, analyse bas√©e sur le rythme du match.`;
      const raisonFinal = corrected
        ? `[Corrig√©: "${original}" ‚Üí "${validBet}"] ${parsed.raison || fallbackRaison}`
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
        bet: "‚Äî", confidence: null,
        raison: "‚ö†Ô∏è R√©ponse illisible (JSON malform√©) ‚Äî non compt√© dans le verdict.",
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
      ? ` ‚Äî historique sur "${a.bet}" en ${match.competition}: ${Math.round(compStat.winrate)}% winrate (${compStat.total} r√©solus) ‚Üí POIDS: ${weight}%`
      : useMarket
        ? ` ‚Äî historique sur ce march√© pr√©cis "${a.bet}" (tous championnats): ${Math.round(marketStat.winrate)}% winrate (${marketStat.total} r√©solus) ‚Üí POIDS: ${weight}%`
        : resolved >= 5
          ? ` ‚Äî historique global: ${p.winrate}% winrate (${p.wins}/${resolved} r√©solus) ‚Üí POIDS: ${weight}%`
          : resolved > 0 ? ` ‚Äî (${resolved} pr√©diction(s), pas assez pour peser) ‚Üí POIDS: ${weight}% (neutre)` : ` ‚Äî (sans historique) ‚Üí POIDS: ${weight}% (neutre)`;
    return `${a.name}: ${a.bet} (${a.confidence}%)${perfNote}`;
  }).join("\n");

  // Build benched agents note for Chief awareness
  const benchedNote = benchedAgents.length > 0
    ? `\n\nNOTE: Agents exclus du vote (faible historique): ${benchedAgents.join(", ")} [ces agents ont <52% winrate sur 30+ pr√©dictions r√©solues]`
    : "";

  const chiefPrompt = `${personas[CHIEF_INDEX]}

${matchContext}

Votes des agents avec leur fiabilit√© historique:
${previousVotes || "(aucun agent actif)"}${benchedNote}

Synth√©tise ces votes en tenant compte de :
1. Le POIDS de chaque agent (indiqu√© ci-dessus, bas√© sur son winrate r√©el) : privil√©gie fortement les votes des agents √† POIDS ‚â•60%, et ignore largement ceux √† POIDS <35% sauf si aucun agent mieux not√© ne couvre ce march√©
2. Les contraintes math√©matiques du score live
3. Tes connaissances sur ${match.home} et ${match.away}
4. Les objections des agents minoritaires: explique pourquoi tu les acceptes ou les rejettes
5. Le contr√¥le GPT-Codex Challenger: teste au moins 3 march√©s alternatifs (BTTS, double chance, over/under, vainqueur ou nul selon disponibilit√©), puis rejette ceux dont le signal est moins robuste
6. Le contexte business/risque: enjeu du match, domicile/ext√©rieur, match amical ou officiel, blessures/absences connues seulement si tu en es s√ªr; si une donn√©e manque, ne l'invente pas
7. Les r√®gles propres au sport: ${sport}
8. Tu DOIS choisir parmi : ${availableBets.join(", ")}
9. DIRECTIVE MARCH√â : Under 2.5 UNIQUEMENT si match √©quilibr√© (√©cart 0-1 but) ET rythme faible. Si √©cart >= 2 buts OU 2+ buts marqu√©s avant 45' ‚Üí Over 2.5 ou Victoire. JAMAIS Under 2.5 quand une √©quipe domine

R√©ponds en JSON pur (pas de markdown):
{
  "bet": "un parmi: ${availableBets.join(", ")}",
  "confidence": <nombre 55-92>,
  "raison": "<2 phrases max: verdict + raison principale; objection minoritaire accept√©e/rejet√©e si elle existe>"
}`;

  try {
    // Un seul fournisseur retenu par match : chacun n'est ajout√© que si AUCUN
    // pr√©c√©dent n'est d√©j√† en liste. Avant ce correctif, DeepSeek et OpenRouter
    // (Qwen) √©taient tous deux ajout√©s inconditionnellement ‚Äî d√®s que DeepSeek
    // r√©pondait vide/lentement (timeout 3.5s), Qwen √©tait rappel√© en plus, √†
    // chaque analyse o√π le Chief tranche. C'est la principale source identifi√©e
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
        console.error(`[concile] Chief fournisseur √©chec: ${e.message}`);
      }
    }
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const rawBet = parsed.bet || availableBets[0];
    const { bet: validBet, corrected, original } = validateAndCorrectBet(rawBet, match, availableBets);
    const activeVoteSummary = activedAgentResults
      .filter(a => a.bet && a.bet !== "‚Äî" && a.bet !== "-")
      .map(a => `${a.bet} (${a.confidence}%)`)
      .join(", ");
    const fallbackRaison = activeVoteSummary
      ? `Synth√®se du Concile : ${activeVoteSummary}. Score ${match.score_home}-${match.score_away} √† ${minuteDisplay}.`
      : `Analyse live bas√©e sur le score ${match.score_home}-${match.score_away} √† ${minuteDisplay}, le temps restant et les march√©s disponibles. Signal prudent faute de consensus IA complet.`;
    const raisonFinal = corrected
      ? `[Corrig√©: "${original}" ‚Üí "${validBet}"] ${parsed.raison || fallbackRaison}`
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
      bet: "‚Äî", confidence: null,
      raison: "‚ö†Ô∏è R√©ponse illisible (JSON malform√©) ‚Äî non compt√© dans le verdict.",
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
    // publiable est haute. Le plafond 3 votes √©tait √† 74, soit SOUS le plancher de
    // diffusion (getSignalFloor() = 82) : la r√®gle Elite ¬´ 3 IA suffisent ¬ª (voir
    // gradeElite plus bas) ne pouvait donc JAMAIS se d√©clencher, et le palier le
    // plus cher ne tournait en r√©alit√© que sur les signaux 4-5 votes de Premium.
    // Constat√© le 31/07/2026 : 23 analyses bloqu√©es √† exactement 74 % en 24 h.
    // Port√© √† 84 ‚Äî au-dessus du plancher pour rendre la r√®gle Elite atteignable,
    // sous le plafond 4 votes (86) pour pr√©server la hi√©rarchie des consensus.
    // Ce n'est PAS une inflation : on retire un plafond, la valeur publi√©e reste
    // la moyenne r√©elle des IA d'accord (Math.min), jamais un chiffre invent√©.
    chief.confidence = voteSummary.unanimous
      ? Math.max(75, Math.min(90, avgConfidence))
      : topVotes >= 4
        ? Math.max(68, Math.min(86, avgConfidence))
        : Math.max(58, Math.min(84, avgConfidence));
    chief.raison = `${voteSummary.vote_label} : ${topVotes} IA ind√©pendantes convergent sur ${topBet}. ${chief.raison || ""}`.trim();
    consensusBet = topBet;
    consensusVotes = topVotes;
  } else {
    // Aucune majorite sur le marche principal. Avant d'abandonner a 55%, on
    // regarde les avis multi-marches deja emis : les IA peuvent diverger sur
    // "quel est le meilleur pari" tout en etant tres d'accord sur un marche
    // precis ‚Äî et notamment sur celui ou les meilleures d'entre elles sont
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
      console.log(`[routage-shadow] ${match.home} vs ${match.away} : aurait propose ${routage.bet} (accord ${routage.accord}%) ‚Äî non applique`);
    }
    if (routage && ROUTAGE_MODE === "actif") {
      consensusBet = routage.bet;
      consensusVotes = 3; // accord pondere equivalent au quorum
      chief.bet = routage.bet;
      // Plafond volontairement bas (78) : un accord obtenu par ponderation vaut
      // moins qu'une convergence franche de 4 ou 5 IA sur le marche principal.
      // Il reste au-dessus du plancher de diffusion, donc exploitable.
      chief.confidence = Math.max(58, Math.min(78, routage.accord));
      chief.raison = `Accord pond√©r√© ${routage.accord}% sur ${routage.bet}`
        + (routage.experts.length ? `, port√© par ${routage.experts.join(", ")} sur ce march√©` : "")
        + `. ${chief.raison || ""}`.trimEnd();
      console.log(`[specialiste] ${match.home} vs ${match.away} : ${routage.bet} (accord pondere ${routage.accord}%, ${routage.experts.length} specialiste(s))`);
    } else {
      chief.confidence = Math.min(55, Number(chief.confidence || 55));
      chief.raison = `Aucun signal valid√© : les IA ne convergent pas assez fortement. ${chief.raison || ""}`.trim();
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

  // Sauvegarder les pr√©dictions pour le tracking de performance
  // Le Chief arbitre mais ne constitue jamais un sixi√®me votant public.
  saveAgentPredictions(match, agentResults.filter((a) => !a.isChief));
  saveAgentMarketPredictions(match, agentMarketList);

  // Vraie cote ARJEL (sinon estimation march√© vari√©e par type de pari)
  const oddInfo = await computeBestOdd(match, chief.bet, chief.confidence);
  console.log(`[concile] Cote ${match.home} vs ${match.away}: ${oddInfo.cote} (${oddInfo.source}) ‚Äî ${chief.bet}`);

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
    // 2.5%) issus du meme H2H reel deja utilise pour le prompt IA ‚Äî jamais
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
  // ET vraies donn√©es pr√©sentes ET segment (ligue/march√©) prouv√© gagnant historiquement.
  // Seuil abaiss√© sur "But 1√®re MT" (march√© √† 82% de winrate historique).
  const signalThreshold = getSignalThresholdForBet(analysisResult.best_bet);
  const hasRealData = statsStatus.available || !!h2hBlock || !!deepBlock;
  const qualityGate = passesHistoricalQualityGate(match, analysisResult.best_bet);
  if (!qualityGate.ok) {
    console.log(`[signal-fort] Bloqu√© par barri√®re qualit√© ‚Äî ${qualityGate.reason}`);
  }
  const playable = betIsPlayable(match, analysisResult.best_bet, analysisResult.cote);
  if (!playable.ok) {
    console.log(`[signal-fort] Bloqu√© (sans valeur) ‚Äî ${playable.reason}`);
  }
  // Garde-fou final √† l'√©mission : jamais de signal sur un match f√©minin ni une
  // ligue douteuse, quel que soit le chemin d'analyse (d√©fense en profondeur).
  const isWomen = isWomenMatch(match);
  if (isWomen) {
    console.log(`[signal-fort] Bloqu√© ‚Äî match f√©minin (liste noire): ${match.home} vs ${match.away}`);
  }
  const lowTrust = isCategoryBanned(match) || (!isUefaCompetition(match) && isLowTrustCompetition(match));
  if (lowTrust) {
    console.log(`[signal-fort] Bloqu√© ‚Äî ligue douteuse (liste noire): ${match.competition || match.league || ""}`);
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
  console.log(`[recovery] ${match.home} vs ${match.away}: ${recoveryEvidence.ok ? "OK" : "BLOCK"} ‚Äî ${recoveryEvidence.reason}`);
  // Vrai seulement si ce match franchit le filtre d'un canal payant : sert √†
  // limiter les tests √† blanc aux picks r√©ellement diffus√©s (budget OpenRouter).
  let shadowWorthy = false;

  // ‚îÄ‚îÄ Tra√ßage du tunnel de diffusion ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
  // Premier motif bloquant, dans l'ordre o√π le code les √©value. Permet de
  // r√©pondre factuellement √† "pourquoi 0 signal aujourd'hui ?" au lieu de
  // supposer. √âcrit en base plus bas, agr√©g√© par /admin/funnel-report.
  let _tierBlock = null; // motif de non-diffusion detecte dans le bloc palier
  // ‚îÄ‚îÄ Regime par classe de ligue (07/08/2026, decision du fondateur) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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
      // Deux motifs distincts, parce qu'ils ne m√®nent pas √† la m√™me d√©cision
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
      // La cl√© porte l'heure courante (‚Ä¶THH). Sans purge, ce Set ne fait que
      // grossir tant que le conteneur tourne. On ne garde que l'heure en cours :
      // les cl√©s plus anciennes ne peuvent plus provoquer de collision.
      if (_signalSentCache.size > 500) {
        const currentHour = signalKey.slice(-13); // "YYYY-MM-DDTHH"
        for (const k of _signalSentCache) {
          if (!k.endsWith(currentHour)) _signalSentCache.delete(k);
        }
      }
      _signalSentCache.add(signalKey);
      const si = { Football:"‚öΩ", Basketball:"üèÄ", Hockey:"üèí", Baseball:"‚öæ" };
      const ico = si[match.sport] || "üéØ";
      // escTgHtml APRES maskAiNames : maskAiNames travaille sur des noms de
      // modeles connus (regex simples), aucun risque d'echapper puis de rater
      // un remplacement. Le texte reste une phrase generee par une IA ‚Äî jamais
      // garanti exempt de "<", ">" ou "&" avant ce point.
      const safeRaison = escTgHtml(maskAiNames(String(analysisResult.raison || "").slice(0, 200)));
      // Cote d√©j√† calcul√©e au moment de l'analyse (computeBestOdd) ‚Üí aucun appel API
      // suppl√©mentaire. On l'envoie AVEC le signal, avec le bookmaker source si r√©el.
      const _bmSig = (analysisResult.cote_source && !/estimation/i.test(String(analysisResult.cote_source)))
        ? ` <i>(${analysisResult.cote_source})</i>` : "";
      // On n'affiche la cote QUE si c'est une VRAIE cote bookmaker (jamais l'estimation).
      const coteSig = (analysisResult.cote && _bmSig)
        ? `\nüí∞ Cote : <b>${Number(analysisResult.cote).toFixed(2)}</b>${_bmSig}` : "";
      // Cote moyenne ARJEL (tous bookmakers agr√©√©s confondus) ‚Äî n'affiche cette
      // ligne QUE si la cote principale ci-dessus vient d'un bookmaker isole,
      // sinon "Cote" est deja cette meme moyenne (voir computeBestOdd) et cette
      // ligne ferait doublon avec le meme chiffre.
      const arjelAvgLine = (analysisResult.arjel_avg_odd && analysisResult.arjel_bookmakers_count >= 2 && !/^moyenne ARJEL/i.test(String(analysisResult.cote_source || "")))
        ? `\nüìà Cote moyenne ARJEL : <b>${Number(analysisResult.arjel_avg_odd).toFixed(2)}</b> <i>(${analysisResult.arjel_bookmakers_count} bookmakers)</i>` : "";
      const voteLine = voteInfo.vote_label ? `\nüß† Vote IA : <b>${voteInfo.vote_label}</b>` : "";
      const confDot = confidenceEmoji(analysisResult.confidence);
      // Noms d'equipe/competition venant de l'API sportive : jamais garantis
      // exempts de "&" ou de guillemets/chevrons dans les competitions moins
      // courantes. Echappes pour la meme raison que safeRaison ci-dessus.
      const homeEsc = escTgHtml(match.home);
      const awayEsc = escTgHtml(match.away);
      const compEsc = escTgHtml(match.competition || match.league || match.sport || "");
      const betEsc = escTgHtml(analysisResult.best_bet);
      const tgPremium = `üö® <b>SIGNAL CONSEIL IA ‚Äî ${confDot} ${analysisResult.confidence}/100</b>\n\n${ico} <b>${homeEsc} vs ${awayEsc}</b>\nüèÜ ${compEsc}\n${match.minute ? `‚è± ${match.minute}' ¬∑ Score : ${match.score_home ?? "?"}-${match.score_away ?? "?"}` : ""}${voteLine}\n\nüí° Signal : <b>${betEsc}</b>\nüìä Score de confiance : ${confDot} <b>${analysisResult.confidence}/100</b>${coteSig}${arjelAvgLine}\n${safeRaison ? `\n<i>${safeRaison}</i>` : ""}\n\n‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ\n‚ö†Ô∏è 18+ ‚Äî Jeu responsable`;
      const tgFree = `üö® <b>SIGNAL CONSEIL IA D√âTECT√â ‚Äî ${confDot} ${analysisResult.confidence}/100</b>\n\n${ico} <b>${homeEsc} vs ${awayEsc}</b>\nüèÜ ${compEsc}\n${match.minute ? `‚è± ${match.minute}' ¬∑ Score : ${match.score_home ?? "?"}-${match.score_away ?? "?"}` : ""}${voteLine}\n\nüîí <b>La s√©lection exacte et la raison sont r√©serv√©es aux membres.</b>\nüìä Score de confiance : ${confDot} <b>${analysisResult.confidence}/100</b>\n\nüìä <a href="https://www.touslesmatchs.com/performances">R√©sultat v√©rifiable demain sur le site</a>\nüëâ <a href="https://www.touslesmatchs.com/#plans"><b>S'abonner √† Standard ‚Äî 4,90‚Ç¨/mois</b></a>\n\n‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ\n‚ö†Ô∏è 18+ ‚Äî Jeu responsable`;
      const todayStr = new Date().toISOString().slice(0, 10);
      const grade = bestBetGrade(match, analysisResult.best_bet, analysisResult.confidence, analysisResult.cote);
      const minute = parseLiveMinuteValue(match.minute);
      const sigTier = computeSignalTier(analysisResult.best_bet, analysisResult.confidence, minute);
      const tierBadge = sigTier === "standard" ? "ü•á STANDARD" : sigTier === "premium" ? "ü•à PREMIUM" : "ü•â ELITE";
      console.log(`[signal-fort] Palier: ${tierBadge} (${sigTier}) ‚Äî ${analysisResult.best_bet} ${analysisResult.confidence}% min=${minute}`);
      const arjelPlayable = ARJEL_BOOKMAKERS.some(a => String(analysisResult.cote_source || "").toLowerCase().includes(a))
        || isArjelMajorCompetition(match);
      if (!arjelPlayable) {
        console.log(`[signal-fort] Hors ARJEL (source: ${analysisResult.cote_source || "estimation"}, ${match.competition || match.sport}) ‚Äî r√©serv√© admin, non diffus√© Premium/Free`);
      }
      // R√©initialisation des compteurs journaliers
      // Au changement de jour ET au premier passage apr√®s un red√©marrage
      // (date === ""), on repart du nombre r√©ellement diffus√©, lu en base.
      if (_standardSignalDaily.date !== todayStr) { _standardSignalDaily.date = todayStr; _standardSignalDaily.count = signalsSentToday("sig_sent_standard"); }
      if (_premiumSignalDaily.date !== todayStr) { _premiumSignalDaily.date = todayStr; _premiumSignalDaily.count = signalsSentToday("sig_sent_premium"); }
      if (_eliteSignalDaily.date !== todayStr) { _eliteSignalDaily.date = todayStr; _eliteSignalDaily.count = signalsSentToday("sig_sent_elite"); }
      if (_freeSignalDailyDate.date !== todayStr) { _freeSignalDailyDate.date = todayStr; _freeSignalDailyDate.count = signalsSentToday("sig_sent_free"); }

      // ‚îÄ‚îÄ Diffusion par palier (conditions fondateur) ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
      //   üü¢ Standard (4.90‚Ç¨)  : conf ‚â• 88, foot, cote r√©elle ARJEL 1.30-2.50 ‚Äî max 3/j
      //   üü£ Premium  (14.90‚Ç¨) : conf ‚â• 85, foot, cote r√©elle ARJEL 1.30-2.50 ‚Äî max 10/j (inclut Standard)
      //   üü† Elite    (29.90‚Ç¨) : conf ‚â• 82, football uniquement, cote r√©elle ANJ 1.30-2.50 ‚Äî max 30/j (inclut Premium)
      //   Mod√®le imbriqu√© : un palier sup√©rieur re√ßoit toujours au moins ce que re√ßoit l'inf√©rieur.
      //   ¬´ Cote r√©elle ¬ª = vraie cote bookmaker (jamais l'estimation). Repli auto sur Premium
      //   tant qu'un canal d√©di√© n'est pas configur√© (voir constantes) ‚Üí pas de doublon.
      const conf = Number(analysisResult.confidence) || 0;
      const realOdd = (analysisResult.cote && _bmSig) ? Number(analysisResult.cote) : 0; // _bmSig ‚áí cote r√©elle bookmaker
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
      // Motif pr√©cis quand l'analyse a franchi tous les filtres qualit√© mais
      // n'atteint aucun canal payant. Distingue les trois causes, qui appellent
      // des corrections tr√®s diff√©rentes.
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
      // Seuils recalcul√©s chaque jour pour servir le quota vendu (3 / 10 / 30).
      const TH = getTierThresholds();

      // Standard exigeait l'UNANIMITE des 5 agents : une condition si rare que le
      // palier restait vide la plupart des jours (0/3 le 28/07/2026). Une majorite
      // large de 4 sur 5 reste tres selective ‚Äî c'est le seuil de CONFIANCE, plus
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
      const tierTag = (label) => `\nüèÖ Palier : <b>${label}</b>`;
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

      // üü¢ STANDARD ‚Äî cap 3/j
      // markSignalSent() APRES confirmation d'envoi, jamais avant : marquer en
      // base puis ignorer le resultat de sendTelegramMessage() faisait croire au
      // systeme qu'un signal etait diffuse alors que Telegram l'avait refuse.
      // Consequences reelles constatees le 30/07/2026 : le message de RESULTAT
      // ("match gagne") partait alors que l'abonne n'avait jamais recu le pick,
      // le site affichait l'analyse comme diffusee, et le quota journalier etait
      // consomme pour rien ‚Äî bloquant les vrais signaux suivants. En cas d'echec
      // on rend donc aussi le credit de quota.
      if (stdDistinct && gradeStandard && _standardSignalDaily.count < STANDARD_SIGNAL_DAILY_CAP && !signalDeliveredToChannelToday(match, "standard")) {
        _standardSignalDaily.count++;
        sendTelegramMessage(TELEGRAM_STANDARD_CHANNEL_ID, tgPremium + tierTag("üü¢ STANDARD"), _deliveryMeta("standard")).then(ok => {
          if (ok) markSignalSent(match.home, match.away, "sig_sent_standard", _ligneAnalysee);
          else _standardSignalDaily.count--;
          console.log(`[signal-fort] Telegram standard (${_standardSignalDaily.count}/${STANDARD_SIGNAL_DAILY_CAP}) conf=${conf} cote=${realOdd}: ${ok ? "OK" : "FAIL ‚Äî non marque car envoi Telegram KO, quota rendu"}`);
        });
      }

      // üü£ PREMIUM ‚Äî cap 10/j (canal socle, toujours pr√©sent)
      if (TELEGRAM_PREMIUM_CHANNEL_ID && gradePremium && _premiumSignalDaily.count < PREMIUM_SIGNAL_DAILY_CAP && !signalDeliveredToChannelToday(match, "premium")) {
        _premiumSignalDaily.count++;
        sendTelegramMessage(TELEGRAM_PREMIUM_CHANNEL_ID, tgPremium + tierTag("üü£ PREMIUM"), _deliveryMeta("premium")).then(ok => {
          if (ok) markSignalSent(match.home, match.away, "sig_sent_premium", _ligneAnalysee);
          else _premiumSignalDaily.count--;
          console.log(`[signal-fort] Telegram premium (${_premiumSignalDaily.count}/${PREMIUM_SIGNAL_DAILY_CAP}) conf=${conf} cote=${realOdd}: ${ok ? "OK" : "FAIL ‚Äî non marque car envoi Telegram KO, quota rendu"}`);
        });
      } else if (TELEGRAM_PREMIUM_CHANNEL_ID && gradePremium) {
        console.log(`[signal-fort] Premium: plafond ${PREMIUM_SIGNAL_DAILY_CAP}/jour atteint, skip`);
      }

      // üü† ELITE/VIP ‚Äî cap 30/j, multisport, alertes prioritaires
      if (eliteDistinct && gradeElite && _eliteSignalDaily.count < ELITE_SIGNAL_DAILY_CAP) {
        _eliteSignalDaily.count++;
        const prio = conf >= 92 ? "\n‚ö° <b>ALERTE PRIORITAIRE</b>" : "";
        sendTelegramMessage(TELEGRAM_ELITE_CHANNEL_ID, tgPremium + tierTag("üü† ELITE") + prio, _deliveryMeta("elite")).then(ok => {
          if (ok) markSignalSent(match.home, match.away, "sig_sent_elite", _ligneAnalysee);
          else _eliteSignalDaily.count--;
          console.log(`[signal-fort] Telegram elite (${_eliteSignalDaily.count}/${ELITE_SIGNAL_DAILY_CAP}) conf=${conf} ${sportLc}: ${ok ? "OK" : "FAIL ‚Äî non marque car envoi Telegram KO, quota rendu"}`);
        });
      }

      // üëë ADMIN (Herm√®s) ‚Äî les signaux individuels restent dans les logs.
      // Le canal admin re√ßoit uniquement le digest quotidien afin d'√©viter le spam.
      if (TELEGRAM_ADMIN_CHAT_ID) {
        console.log("[signal-fort] Telegram admin: non envoy√© (inclus dans le digest quotidien)");
      }

      // üÜì GRATUIT (vitrine) ‚Äî 1 teaser/jour, SANS la s√©lection exacte, pousse vers Standard
      if (gradePremium && _freeSignalDailyDate.count < 1 && TELEGRAM_CHANNEL_ID && !signalDeliveredToChannelToday(match, "free")) {
        _freeSignalDailyDate.count++;
        sendTelegramMessage(TELEGRAM_CHANNEL_ID, tgFree, _deliveryMeta("free")).then(ok => {
          if (ok) markSignalSent(match.home, match.away, "sig_sent_free", _ligneAnalysee);
          else _freeSignalDailyDate.count--;
          console.log(`[signal-fort] Telegram gratuit (vitrine): ${ok ? "OK" : "FAIL ‚Äî non marque car envoi Telegram KO, quota rendu"}`);
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

  // ‚îÄ‚îÄ Tests √† blanc : uniquement sur les matchs R√âELLEMENT diffusables ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
  // Avant, cette √©valuation tournait sur CHAQUE match analys√© (109 le 25/07) avec
  // 3 agents OpenRouter, soit ~330 appels/jour factur√©s au token ‚Äî l'essentiel du
  // budget OpenRouter, d√©pens√© sur des matchs qui ne seront jamais diffus√©s.
  // Deux b√©n√©fices √† ne tester que les picks diffusables :
  //   1. environ 95 % d'appels en moins ;
  //   2. les challengers sont √©valu√©s sur la M√äME population que les vrais picks,
  //      donc le score de Brier devient comparable ‚Äî sans quoi promouvoir un mod√®le
  //      sur la base de ces chiffres n'aurait aucune validit√© statistique.
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
  else bet = score_diff > 0 ? "Victoire domicile" : "Victoire ext√©rieur";

  const confidence = 60 + Math.floor(Math.random() * 25);
  const raisons = [
    `L'√©quipe √† domicile montre une solidit√© d√©fensive depuis la ${minute}'. Le contexte du score favorise ce march√©.`,
    `Les statistiques de ce type de match √† cette phase du jeu indiquent une forte probabilit√© pour ce sc√©nario.`,
    `Le score actuel de ${match.score_home}-${match.score_away} et la dynamique du match orientent clairement vers ce march√©.`,
    `Analyse des patterns : ce type de configuration √† la ${minute}' converge r√©guli√®rement vers ce r√©sultat.`,
    `En synth√®se des votes du Conseil et du contexte temps r√©el, ce march√© offre le meilleur ratio risque/r√©compense.`,
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
    { name: "Perplexity-Web", icon: "üåê", model: "sonar-pro" },
    { name: "DeepSeek-V3", icon: "üîÆ", model: "deepseek-chat" },
    { name: "Mistral-Large", icon: "üåä", model: "mistral-large-latest" },
    { name: "Qwen-3.7-Max", icon: "üß¨", model: "command-r-plus" },
    { name: "OpenRouter-Kimi", icon: "üåô", model: process.env.OR_KIMI_MODEL || "moonshotai/kimi-k2" },
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

// ‚îÄ‚îÄ Concile analysis trace ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
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
// "Premier League" (‚Üí Angleterre) et "Brazilian Serie B" contient "Serie B"
// (‚Üí Italie). Les deux erreurs √©taient r√©ellement en base le 29/07/2026 et
// faussaient l'analyse par championnat et par pays. On teste donc D'ABORD le
// gentil√© ou le nom de pays explicitement pr√©sent dans l'intitul√©.
const COUNTRY_BY_NATIONALITY = [
  ["Canada",       ["canadian", "canada"]],
  ["Br√©sil",       ["brazilian", "brasileir", "brazil", "brasil"]],
  ["Chili",        ["chilean", "chile"]],
  ["Argentine",    ["argentin"]],
  ["Mexique",      ["mexican", "mexico", "liga mx"]],
  ["Colombie",     ["colombian", "colombia"]],
  ["P√©rou",        ["peruvian", "peru"]],
  ["√âquateur",     ["ecuadorian", "ecuador"]],
  ["Bolivie",      ["bolivian", "bolivia"]],
  ["Uruguay",      ["uruguayan", "uruguay"]],
  ["Paraguay",     ["paraguayan", "paraguay"]],
  ["Venezuela",    ["venezuelan", "venezuela"]],
  ["Australie",    ["australian", "australia", "a-league"]],
  ["Japon",        ["japanese", "japan", "j-league", "j1 league", "j2 league"]],
  ["Cor√©e du Sud", ["korean", "korea", "k league", "k-league"]],
  ["Chine",        ["chinese", "china"]],
  ["Inde",         ["indian", "india"]],
  ["Arabie Saoudite", ["saudi"]],
  ["Qatar",        ["qatari", "qatar"]],
  ["√âmirats",      ["emirates", "uae"]],
  ["√âgypte",       ["egyptian", "egypt"]],
  ["Maroc",        ["moroccan", "morocco", "botola"]],
  ["Alg√©rie",      ["algerian", "algeria"]],
  ["Tunisie",      ["tunisian", "tunisia"]],
  ["Afrique du Sud", ["south african", "south africa"]],
  ["Nigeria",      ["nigerian", "nigeria"]],
  ["Russie",       ["russian", "russia"]],
  ["Ukraine",      ["ukrainian", "ukraine"]],
  ["Pologne",      ["polish", "poland", "ekstraklasa"]],
  ["Tch√©quie",     ["czech"]],
  ["Slovaquie",    ["slovak"]],
  ["Hongrie",      ["hungarian", "hungary"]],
  ["Roumanie",     ["romanian", "romania"]],
  ["Bulgarie",     ["bulgarian", "bulgaria"]],
  ["Serbie",       ["serbian", "serbia"]],
  ["Croatie",      ["croatian", "croatia"]],
  ["Slov√©nie",     ["slovenian", "slovenia"]],
  ["Gr√®ce",        ["greek", "greece", "super league greece"]],
  ["Chypre",       ["cypriot", "cyprus"]],
  ["Isra√´l",       ["israeli", "israel"]],
  ["Autriche",     ["austrian", "austria"]],
  ["Suisse",       ["swiss", "switzerland"]],
  ["Su√®de",        ["swedish", "sweden", "allsvenskan", "superettan"]],
  ["Norv√®ge",      ["norwegian", "norway", "eliteserien"]],
  ["Danemark",     ["danish", "denmark", "superliga"]],
  ["Finlande",     ["finnish", "finland", "veikkausliiga"]],
  ["Islande",      ["icelandic", "iceland"]],
  ["Irlande",      ["irish", "ireland"]],
  ["√âcosse",       ["scottish", "scotland"]],
  ["Pays de Galles", ["welsh", "wales"]],
  ["Estonie",      ["estonian", "estonia"]],
  ["Lettonie",     ["latvian", "latvia"]],
  ["Lituanie",     ["lithuanian", "lithuania"]],
  ["G√©orgie",      ["georgian"]],
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
  // Correspondance par mot entier, pas par sous-cha√Æne. Trois erreurs r√©elles
  // corrig√©es par cette r√®gle : "Copa Sudamericana" contenait "american" (‚Üí USA),
  // et surtout "Bundesliga" contenait "liga" (‚Üí Espagne), donc TOUS les matchs
  // allemands √©taient comptabilis√©s en Espagne dans l'analyse par pays.
  const comp = String(competition).toLowerCase();
  const hasWord = (k) => new RegExp(
    `(^|[^a-z])${String(k).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`
  ).test(comp);
  for (const [country, keys] of COUNTRY_BY_NATIONALITY) {
    if (keys.some(hasWord)) return country;
  }
  const map = {
    "France": ["Ligue 1","Ligue 2","Coupe de France","National"],
    // "Liga" seul est trop g√©n√©rique : il capturait "Primeira Liga" (Portugal),
    // "Liga MX" (Mexique) et "Liga Profesional" (Argentine).
    "Espagne": ["La Liga","LaLiga","Segunda","Copa del Rey"],
    "Angleterre": ["Premier League","Championship","FA Cup","EFL","League One","League Two"],
    "Allemagne": ["Bundesliga","2. Bundesliga","DFB","3. Liga"],
    "Italie": ["Serie A","Serie B","Serie C","Coppa Italia"],
    "Portugal": ["Primeira Liga","Liga Portugal","Ta√ßa de Portugal"],
    "Pays-Bas": ["Eredivisie","Eerste Divisie","KNVB"],
    "Belgique": ["Pro League","First Division","Division 1"],
    "Turquie": ["S√ºper Lig","Super Lig","TFF"],
    "Br√©sil": ["Brasileirao","Serie A Brazil","Serie B Brazil","Serie C"],
    "USA": ["MLS","USL","NWSL","MLS Next","Major League Soccer"],
    "Chili": ["Primera Division","Copa Chile","Segunda Division"],
    "Argentine": ["Liga Profesional","Primera Nacional","Copa Argentina"],
    "International": ["World Cup","Copa Am√©rica","Euro","Champions League","Europa League","Conference League","Nations League","Copa Sudamericana","Sudamericana","Libertadores","AFC","CAF","CONCACAF","FIFA"],
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
        console.warn(`[concile-trace] analyse r√©solue immuable, r√©analyse ignor√©e: ${matchKey}`);
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
  const underM = normalized.match(/(?:under|moins de|inf[e√©]rieur(?:\s*√†)?)\s*(\d+(?:\.5)?)/);
  if (underM) return total < parseFloat(underM[1]) ? "win" : "loss";
  if (normalized.includes("btts oui") || normalized.includes("les deux equipes marquent") || normalized.includes("les deux √©quipes marquent")) return (h > 0 && a > 0) ? "win" : "loss";
  if (normalized.includes("btts non")) return (h > 0 && a > 0) ? "loss" : "win";
  if (value === "Match nul" || value === "X" || normalized.includes("nul")) return h === a ? "win" : "loss";
  if (value === "1X" || normalized.includes("1x")) return h >= a ? "win" : "loss";
  if (value === "X2" || normalized.includes("x2")) return a >= h ? "win" : "loss";
  if (value === "12" || normalized.includes("12")) return h !== a ? "win" : "loss";
  if (normalized.includes("domicile") || value === "1") return h > a ? "win" : "loss";
  if (normalized.includes("ext√©rieur") || normalized.includes("exterieur") || value === "2") return a > h ? "win" : "loss";
  return null;
}

// R√©sout un pari "Victoire [nom d'√©quipe]" en identifiant le c√¥t√© (dom/ext) via les noms.
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
    if (bet.includes("ext√©rieur") || bet === "2") return a > h ? "win" : "loss";
    if (bet === "Match nul" || bet === "X") return h === a ? "win" : "loss";
    if (bet === "1X" || bet.includes("1X")) return h >= a ? "win" : "loss";
    if (bet === "X2" || bet.includes("X2")) return a >= h ? "win" : "loss";
    if (bet === "12" || bet.includes("12")) return h !== a ? "win" : "loss";
    return null;
  }

  try {
    // LIKE brut sur le premier mot AVANT normalisation des accents : un club
    // dont le nom contient un caractere accentue (Gy≈ëri, ≈Ωelezniƒçar, ≈ölƒÖsk...)
    // pouvait rester bloque "en attente" pour toujours si la source live et
    // la ligne enregistree en base ne codaient pas l'accent EXACTEMENT pareil
    // (forme Unicode NFC/NFD differente, translitteration, corruption
    // d'encodage). Constate par Greg le 04/08/2026 sur plusieurs jours de
    // matchs jamais resolus. matchToken()/NORM() (deja utilises par le
    // rattrapage resolveStalePredictions) suppriment les accents avant de
    // comparer ‚Äî memes garde-fous ici plutot qu'un LIKE na√Øf.
    const hw = matchToken(home), aw = matchToken(away);
    const candidates = hw && aw ? db.prepare(
      "SELECT * FROM concile_analyses WHERE outcome IS NULL AND analysed_at >= datetime('now','-30 days')"
    ).all() : [];
    const pending = candidates.filter(r => matchToken(r.home) === hw && matchToken(r.away) === aw);

    if (pending.length) {
      // PROTECTION IMMUTABILIT√â : le AND outcome IS NULL en clause WHERE garantit
      // que la DB rejette l'update si un outcome a d√©j√† √©t√© enregistr√© entre le
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
      console.log(`[concile-trace] r√©solu ${pending.length} analyses: ${home} vs ${away} (${h}-${a})`);
    }

    // R√©soudre aussi les IA du banc d'essai (shadow_evals) ‚Äî ind√©pendamment de
    // concile_analyses : avant, √ßa ne se d√©clenchait QUE si ce match avait ◊Œ6◊fÚµÎ(ö+my“7Gñ∆S“&fˆÁB◊6ó¶S£7É∂fˆÁB◊vVñváC£s∂6ˆ∆˜#¢3#&C6VS∑FWáB◊G&Á6f˜&”ßWW&66S∂∆WGFW"◊76ñÊs¢„ÜV”∂÷&vñ‚÷&˜GFˆ”£'É∑FWáB÷∆ñv„¶6VÁFW"#ÂVV¬∆‚FR6˜'&W7ˆÊBÛ¬ˆFóc‡¢G∂'Vñ∆E∆‰6ˆ◊&ó6ˆ‰áF÷¬Çó–¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ„£#GÇ'Ç#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2"7Gñ∆S“&Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≥∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3FcCfSR¬3v36VBì∂6ˆ∆˜#¢6ffc∑FFñÊs£GÇ3gÉ∂&˜&FW"◊&FóW3£É∂fˆÁB◊6ó¶S£WÉ∂fˆÁB◊vVñváC£s∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊS∂&˜Ç◊6ÜF˜s£GÇ#Ç&v&Ésí√s√##í¬„Bí#‰6Üˆó6ó"÷ˆ‚∆‚(i#¬ˆ‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£#Ç#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2"7Gñ∆S“&6ˆ∆˜#¢3c3cfc∂fˆÁB◊6ó¶S£7É∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#‰L:ñ6˜Wg&ó"Ê˜2ˆfg&W3¬ˆ‡¢¬ˆFóc‡¢«7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢3v#É&∑FWáB÷∆ñv„¶6VÁFW"#„Ç≤+r¶WR&W7ˆÁ6&∆R+r∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“ˆ÷VÁFñˆÁ2÷∆Vv∆W2ÊáF÷¬"7Gñ∆S“&6ˆ∆˜#¢3c3cfc∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#Â6RL:ó6&ˆÊÊW#¬ˆ„¬˜‡¢¬ˆFóc‡¢¬ˆFócÊ∞ß–†¶gVÊ7Fñˆ‚'Vñ∆DÁW'GW&T£táF÷¬Çí∞¢6ˆÁ7B7FG2“vWE6ñvÊƒf˜'E7FG2Çì∞¢&WGW&‚∆Fób7Gñ∆S“&fˆÁB÷f÷ñ«ì§ñÁFW"ƒ&ñ¬«6Á2◊6W&ñc∂÷Ç◊vñGFÉ£SÉÉ∂÷&vñ„£WFÛ∂&6∂w&˜VÊC¢3cÉc∂6ˆ∆˜#¢6V6VcC∂&˜&FW"◊&FóW3£GÉ∂˜fW&f∆˜s¶ÜñFFV‚#‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬6cSñS"¬6Cìssbì∑FFñÊs£3É∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#'É∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢6ffb#ÂF˜W4∆W4÷F6á3¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#ß&v&É#SR√#SR√#SR¬„ÉRì∂÷&vñ‚◊F˜£GÇ#ÂF&V÷ú:á&R6V÷ñÊRW7B7<:ñS¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FFñÊs£3'Ç#‡¢«7Gñ∆S“&fˆÁB◊6ó¶S£WÉ∂6ˆ∆˜#¢6ÜV3É∂÷&vñ„£gÇ#‰V‚r¶˜W'2¬∆R6ˆÁ6Vñ¬îÊ«ó<:íFW2Fó¶ñÊW2FR÷F6á2‚fˆñ6íFˆ‚&ñ∆‚£¬˜‡¢∆Fób7Gñ∆S“&Fó7∆ì¶f∆WÉ∂v£'É∂÷&vñ‚÷&˜GFˆ”£#É∂f∆WÇ◊w&ßw&#‡¢∆Fób7Gñ∆S“&f∆WÉ£∂÷ñ‚◊vñGFÉ£#É∂&6∂w&˜VÊC¢3C#∂&˜&FW#£Ç6ˆ∆ñB&v&Éb√ÉR√#í¬„"ì∂&˜&FW"◊&FóW3£'É∑FFñÊs£gÉ∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#áÉ∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢3#ìÉ#‚G∑7FG2ÁvñÁ7”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂÷&vñ‚◊F˜£'Ç#Â6ñvÊWÇvvÏ:ó3¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&f∆WÉ£∂÷ñ‚◊vñGFÉ£#É∂&6∂w&˜VÊC¢3C#∂&˜&FW#£Ç6ˆ∆ñB&v&Éìí√"√#C¬„"ì∂&˜&FW"◊&FóW3£'É∑FFñÊs£gÉ∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#áÉ∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢3c3cfc#‚G∑7FG2ÁvñÁ&FW“S¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂÷&vñ‚◊F˜£'Ç#ÂvñÁ&FRv∆ˆ&√¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&f∆WÉ£∂÷ñ‚◊vñGFÉ£#É∂&6∂w&˜VÊC¢3C#∂&˜&FW#£Ç6ˆ∆ñB&v&É#CR√SÇ√¬„"ì∂&˜&FW"◊&FóW3£'É∑FFñÊs£gÉ∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#áÉ∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢6cSñS"#‚G∑7FG2ÁF˜F«”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂÷&vñ‚◊F˜£'Ç#Â6ñvÊWÇÊ«ó<:ó3¬ˆFóc‡¢¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊCß&v&É#CR√SÇ√¬„Çì∂&˜&FW#£Ç6ˆ∆ñB&v&É#CR√SÇ√¬„"ì∂&˜&FW"◊&FóW3£'É∑FFñÊs£gÉ∂÷&vñ‚÷&˜GFˆ”£#É∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£GÉ∂6ˆ∆˜#¢6cSñS#∂fˆÁB◊vVñváC£s∂÷&vñ‚÷&˜GFˆ”£gÇ#ÂGR2&\:wR∆W26ñvÊWÇ(	B÷ó22∆W2Ê«ó6W26ˆ◊Ã:áFW3¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢6ÜV3Ç#‰∆W2÷V÷'&W2ˆÁBWR6ÜVRñ6≤L:óFñ∆Ã:ífV26˜FR¬&ó6ˆ‚WB÷ó6R7Vv|:ó,:ñR„¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂fˆÁB◊vVñváC£s∂6ˆ∆˜#¢3#&C6VS∑FWáB◊G&Á6f˜&”ßWW&66S∂∆WGFW"◊76ñÊs¢„ÜV”∂÷&vñ‚÷&˜GFˆ”£'É∑FWáB÷∆ñv„¶6VÁFW"#‰6ˆ◊&R∆W2∆Á2V‚V‚6˜WBvˆVñ√¬ˆFóc‡¢G∂'Vñ∆E∆‰6ˆ◊&ó6ˆ‰áF÷¬Çó–¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ„£#GÇ'Ç#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2"7Gñ∆S“&Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≥∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬6cSñS"¬6Cìssbì∂6ˆ∆˜#¢6ffc∑FFñÊs£GÇ3gÉ∂&˜&FW"◊&FóW3£É∂fˆÁB◊6ó¶S£WÉ∂fˆÁB◊vVñváC£s∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊS∂&˜Ç◊6ÜF˜s£GÇ#Ç&v&É#CR√SÇ√¬„2í#Â76W":¬v7Fñˆ‚(i#¬ˆ‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£#Ç#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2"7Gñ∆S“&6ˆ∆˜#¢3c3cfc∂fˆÁB◊6ó¶S£7É∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#‰˜Rfˆó"Ê˜2ˆfg&W3¬ˆ‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3C#∂&˜&FW#£Ç6ˆ∆ñB&v&Éìí√"√#C¬„Rì∂&˜&FW"◊&FóW3£É∑FFñÊs£GÉ∂÷&vñ‚÷&˜GFˆ”£#É∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢6ÜV3Ç#Ô	˘;2VÊ6˜&R7W"FV∆Vw&“Û¬ˆFóc‡¢∆á&Vc“&áGG3¢Ú˜BÊ÷RÚ∑f‰óT∂s%¶ÜFƒ÷’ìÇ"7Gñ∆S“&6ˆ∆˜#¢3#&C6VS∂fˆÁB◊6ó¶S£7É∂fˆÁB◊vVñváC£s∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#Â&V¶ˆñÊG&R∆R6Ê¬w&GVóB(i#¬ˆ‡¢¬ˆFóc‡¢«7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢3v#É&∑FWáB÷∆ñv„¶6VÁFW"#„Ç≤+r¶WR&W7ˆÁ6&∆R+r∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“ˆ÷VÁFñˆÁ2÷∆Vv∆W2ÊáF÷¬"7Gñ∆S“&6ˆ∆˜#¢3c3cfc∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#Â6RL:ó6&ˆÊÊW#¬ˆ„¬˜‡¢¬ˆFóc‡¢¬ˆFócÊ∞ß–†¶7ñÊ2gVÊ7Fñˆ‚&ˆ6W7566ÜVGV∆VDV÷ñ«2Çí∞¢ñbÇ%$UdıÙïÙ¥Uíí&WGW&„∞¢G'í∞¢6ˆÁ7BGVR“F"Á&W&RÇ%4TƒT5B¢e$Ù“66ÜVGV∆VEˆV÷ñ«2tÑU$R6VÁB“‰B6VÊEˆgFW"√“FFWFñ÷RÇvÊ˜rríƒî‘ïB"íÊ∆¬Çì∞¢f˜"Ü6ˆÁ7B&˜rˆbGVRí∞¢G'í∞¢ñbá&˜rÊV÷ñ≈˜GóR””“&ÁW'GW&Uˆ£"í∞¢vóB'&Wfı6VÊDV÷ñ¬á&˜rÊV÷ñ¬¬.)»R∆R6ˆÊ6ñ∆RfñVÁBFRV&∆ñW"(	Bfˆñ6í6RVRGR2÷Á\:í"¬'Vñ∆DÁW'GW&T£áF÷¬á&˜rÊV÷ñ¬íì∞¢“V«6Rñbá&˜rÊV÷ñ≈˜GóR””“&ÁW'GW&Uˆ£2"í∞¢vóB'&Wfı6VÊDV÷ñ¬á&˜rÊV÷ñ¬¬/	˘I"GRfˆó2∆R6ñvÊ¬¬2¬vÊ«ó6R6ˆ◊Ã:áFR(	Bfˆñ6í6ˆ÷÷VÁB6ÜÊvW":v"¬'Vñ∆DÁW'GW&T£4áF÷¬Çíì∞¢“V«6Rñbá&˜rÊV÷ñ≈˜GóR””“&ÁW'GW&Uˆ£R"í∞¢vóB'&Wfı6VÊDV÷ñ¬á&˜rÊV÷ñ¬¬	˘8¢G∂vWE6ñvÊƒf˜'E7FG2ÇíÁvñÁ&FW“RFR,:óW76óFR(	B∆W2,:ó7V«FG2&∆VÁF¬'Vñ∆DÁW'GW&T£TáF÷¬Çíì∞¢“V«6Rñbá&˜rÊV÷ñ≈˜GóR””“&ÁW'GW&Uˆ£r"í∞¢vóB'&Wfı6VÊDV÷ñ¬á&˜rÊV÷ñ¬¬.)™F&V÷ú:á&R6V÷ñÊRW7B7<:ñR(	Bfˆñ6í∆R&ñ∆‚"¬'Vñ∆DÁW'GW&T£táF÷¬Çíì∞¢–¢F"Á&W&RÇ%UDDR66ÜVGV∆VEˆV÷ñ«24UB6VÁB“tÑU$RñB“Ú"íÁ'V‚á&˜rÊñBì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂ÁW'GW&ñÊu“G∑&˜rÊV÷ñ≈˜GóW“VÁf˜ú:ì¢G∑&˜rÊV÷ñ«÷ì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ü∂ÁW'GW&ñÊu“G∑&˜rÊV÷ñ≈˜GóW”¶¬RÊ÷W76vRì≤–¢–¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂ÁW'GW&ñÊu“&ˆ6W73¢"¬RÊ÷W76vRì≤–ß–†ß6WDñÁFW'f¬á&ˆ6W7566ÜVGV∆VDV÷ñ«2¬R¢c¢ì∞ß6WEFñ÷V˜WBá&ˆ6W7566ÜVGV∆VDV÷ñ«2¬c¢ì∞†¢ÚÚ)H)H6ñvÊ¬f˜'B&ñ∆‚(	BG&6≤&V6˜&BFW26ñvÊWÇ„“ÉR)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶gVÊ7Fñˆ‚vWE6ñvÊƒf˜'E7FG2Çí∞¢G'í∞¢6ˆÁ7BFá&W6Üˆ∆B“vWDFFófU6ñvÊ≈Fá&W6Üˆ∆BÇì∞¢6ˆÁ7B&r“F"Á&W&RÜ ¢4TƒT5B÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬6˜VÁG'í¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬6ˆÁ6VÁ7W5˜f˜FW2¬˜WF6ˆ÷R¿¢66˜&UˆÜˆ÷UˆEˆÊ«ó6ó2¬66˜&UˆvïˆEˆÊ«ó6ó2¿¢fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬Ê«ó6VEˆB¬&V≈ˆˆFB¬&V≈ˆˆFE˜6˜W&6R¿¢÷ñÁWFUˆEˆÊ«ó6ó2¬FñfgW6ñˆÂˆ&∆ˆ6≤¿¢6ñu˜6VÁE˜7FÊF&B¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFR¬6ñu˜6VÁEˆg&VP¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R6ˆÊfñFVÊ6R„“Ú‰B˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢ı$DU"%íÊ«ó6VEˆBDU40¢íÊ∆¬áFá&W6Üˆ∆Bì∞¢6ˆÁ7B6VV‚“ÊWr6WBÇì∞¢6ˆÁ7B∆¬“µ”∞¢f˜"Ü6ˆÁ7B"ˆb&rí∞¢ñbÇó5fW&ñfñVD6∆ñVÁD˜S#U&˜rá"íí6ˆÁFñÁVS∞¢6ˆÁ7B∂Wí“G∑"ÊÜˆ÷W’ÚG∑"Êvó’ÚG≤á"ÊÊ«ó6VEˆB«¬""íÁ6∆ñ6RÉ¬ó÷∞¢ñbá6VV‚ÊÜ2Ü∂Wííí6ˆÁFñÁVS∞¢6VV‚ÊFBÜ∂Wíì∞¢∆¬ÁW6Çá"ì∞¢–¢6ˆÁ7BvñÁ2“∆¬Êfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“'vñ‚"íÊ∆VÊwFÉ∞¢6ˆÁ7B∆˜76W2“∆¬Êfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“&∆˜72"íÊ∆VÊwFÉ∞¢6ˆÁ7BF˜F¬“∆¬Ê∆VÊwFÉ∞¢6ˆÁ7BvñÁ&FR“F˜F¬‚Ú÷FÇÁ&˜VÊBávñÁ2ÚF˜F¬¢í¢∞¢&WGW&‚≤F˜F¬¬vñÁ2¬∆˜76W2¬vñÁ&FR¬&V6VÁC¢∆¬Á6∆ñ6RÉ¬#í”∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑6ñvÊ¬÷f˜'B÷&ñ∆Â“7FG3¢"¬RÊ÷W76vRì∞¢&WGW&‚≤F˜F√¢¬vñÁ3¢¬∆˜76W3¢¬vñÁ&FS¢¬&V6VÁC¢µ“”∞¢–ß–†¶7ñÊ2gVÊ7Fñˆ‚6VÊE6ñvÊƒf˜'D&ñ∆ÂFV∆Vw&“Çí∞¢6ˆÁ7B7FG2“vWE6ñvÊƒf˜'E7FG2Çì∞¢ñbá7FG2ÁF˜F¬¬2í&WGW&„∞†¢6ˆÁ7B&V6VÁD∆ñÊW2“7FG2Á&V6VÁBÁ6∆ñ6RÉ¬íÊ÷á"”‚∞¢6ˆÁ7Bñ6ˆ‚“"Ê˜WF6ˆ÷R””“'vñ‚"Ú.)»R"¢.)ÿ¬#∞¢6ˆÁ7B66˜&R“"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢#Ú#∞¢&WGW&‚G∂ñ6ˆÁ“G∑"ÊÜˆ÷W“g2G∑"Êvó“ÇG∑66˜&W“í(	BG∑"Ê&W7Eˆ&WG“G∑"Ê6ˆÊfñFVÊ6W“Û∞¢“íÊ¶ˆñ‚Ç%∆‚"ì∞†¢6ˆÁ7BFá&W6Üˆ∆B“vWDFFófU6ñvÊ≈Fá&W6Üˆ∆BÇì∞¢6ˆÁ7B&V÷óV‘◊6r“	˘8Ç∆#‰$îƒ‚4ît‰¬dı%C¬ˆ#Â∆Â∆Ô	¯ÍÚ6ñvÊWÇ(öRG∑Fá&W6Üˆ∆G“ÛFR66˜&RFR6ˆÊfñÊ6R•∆Ó)»RvvÏ:ó2¢∆#‚G∑7FG2ÁvñÁ7”¬ˆ#Â∆Ó)ÿ¬W&GW2¢∆#‚G∑7FG2Ê∆˜76W7”¬ˆ#Â∆Ô	˘8ívñÁ&FR¢∆#‚G∑7FG2ÁvñÁ&FW“S¬ˆ#Â∆Â∆„∆#‰FW&ÊñW'2,:ó7V«FG2£¬ˆ#Â∆‚G∑&V6VÁD∆ñÊW7’∆Â∆Ó)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H∆Ô	˙Ib6ˆÁ6Vñ¬î(	BG∑7FG2ÁF˜F«“6ñvÊWÇÊ«ó<:ó6∞†¢6ˆÁ7Bg&VT◊6r“	˘8Ç∆#‰$îƒ‚4ît‰¬dı%C¬ˆ#Â∆Â∆Ô	¯ÍÚÊ˜26ñvÊWÇ(öRG∑Fá&W6Üˆ∆G“ÛFR66˜&RFR6ˆÊfñÊ6R•∆Ó)»R∆#‚G∑7FG2ÁvñÁ7“vvÏ:ó3¬ˆ#‚7W"G∑7FG2ÁF˜F«“6ñvÊWÖ∆Ô	˘8ívñÁ&FR¢∆#‚G∑7FG2ÁvñÁ&FW“S¬ˆ#Â∆Â∆‚G∑&V6VÁD∆ñÊW2Á7∆óBÇ%∆‚"íÁ6∆ñ6RÉ¬RíÊ÷Ü¬”‚¬Á&W∆6RÇÚ(	B‚¢Ú¬""ííÊ¶ˆñ‚Ç%∆‚"ó’∆Â∆Ô	˘í∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2#Ó)™&V6Wfˆó"F˜W2∆W26ñvÊWÇL:á2B√ì(*√¬ˆÂ∆Â∆Ó)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H∆Ô	˙Ib6ˆÁ6Vñ¬î(	BF˜W4∆W4÷F6á6∞†¢ÚÚ&ñ∆‚FR,:ó7V«FG2¢F˜W2∆W2∆ñW'2ñÁG2∆R&\:vˆófVÁB¬:¬vñFVÁFóVR‡¢vóB6VÊEFıñD6ÜÊÊV«2á&V÷óV‘◊6r¬≤Fs¢'6ñvÊ¬÷f˜'B÷&ñ∆‚"“ì∞¢ñbÖDTƒTu$’Ù4Ñ‰‰T≈ÙîBí∞¢6ˆÁ7Bˆ≤“vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’Ù4Ñ‰‰T≈ÙîB¬g&VT◊6rì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑6ñvÊ¬÷f˜'B÷&ñ∆Â“FV∆Vw&“g&VS¢G∂ˆ≤Ú$Ù≤"¢$dî¬'÷ì∞¢–ß–†¢ÚÚ&ñ∆‚ÜV&Fˆ÷Fó&R6ÜVRFñ÷Ê6ÜR:#Çál:ó&ñfñRF˜WFW2∆W2ÜWW&W2êß6WDñÁFW'f¬ÇÇí”‚∞¢6ˆÁ7BÊ˜r“ÊWrFFRÇì∞¢ñbÜÊ˜rÊvWDFíÇí””“bbÊ˜rÊvWDÜ˜W'2Çí””“#bbÊ˜rÊvWD÷ñÁWFW2Çí¬cí∞¢6VÊE6ñvÊƒf˜'D&ñ∆ÂFV∆Vw&“ÇíÊ6F6ÇÜR”‚6ˆÁ6ˆ∆RÊW'&˜"Ç%∑6ñvÊ¬÷f˜'B÷&ñ∆Â“"¬RÊ÷W76vRíì∞¢6VÊEvVV∂«î6ˆÁfW'6ñˆ‰V÷ñ¬ÇíÊ6F6ÇÜR”‚6ˆÁ6ˆ∆RÊW'&˜"Ç%∑vVV∂«í÷6ˆÁfW'6ñˆÂ“"¬RÊ÷W76vRíì∞¢6VÊEvVV∂«îvVÁG4VFóBÇíÊ6F6ÇÜR”‚6ˆÁ6ˆ∆RÊW'&˜"Ç%∑vVV∂«í÷vVÁG2÷VFóE“"¬RÊ÷W76vRíì∞¢–ß“¬c¢c¢ì∞†¢ÚÚ)H)H&˜'BÜV&Fˆ÷Fó&RFRW&bFW2îÜFñ÷Ê6ÜR#Ç¬FV∆Vw&“F÷ñ‚í)H)H)H)H)H)H)H)H ¢ÚÚv&ÁFóBVRERfˆó26ÜVR6V÷ñÊR¸;íV‚6ˆÁB∆W2vVÁG2Üˆffñ6ñV«2≤6ÜF˜rê¢ÚÚ6Á2fˆó":∆Ê6W"VÊR6ˆ÷÷ÊFR‚6íVÊRî6R÷WB:6˜W2◊W&f˜&÷W"¬V∆∆P¢ÚÚ&:ÁG&FÁ2∆R&˜'BfV26ˆ‚vñÁ&FRV‚&ó76R(	B6ñvÊ¬Bv∆W'FRfó7VV¬‡¶7ñÊ2gVÊ7Fñˆ‚6VÊEvVV∂«îvVÁG4VFóBÇí∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí&WGW&„∞¢G'í∞¢6ˆÁ7Bˆffñ6ñƒvVÁG2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¬4ıTÂBÇ¢íF˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí∆˜76W0¢e$Ù“vVÁE˜&VFñ7FñˆÁ0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢u$ıU%ívVÁEˆÊ÷P¢íÊ∆¬ÇíÊ÷á"”‚á≤‚‚Á"¬&W6ˆ«fVC¢"ÁvñÁ2≤"Ê∆˜76W2¬vñÁ&FS¢"ÁvñÁ2≤"Ê∆˜76W2‚Ú÷FÇÁ&˜VÊBá"ÁvñÁ2Úá"ÁvñÁ2≤"Ê∆˜76W2í¢í¢ÁV∆¬“íê¢Á6˜'BÇÜ¬"í”‚Ü"ÁvñÁ&FRÛÚ”í“ÜÁvñÁ&FRÛÚ”íì∞†¢6ˆÁ7B6ÜF˜tvVÁG2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¬4ıTÂBÇ¢íF˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí∆˜76W0¢e$Ù“6ÜF˜uˆWf«0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢u$ıU%ívVÁEˆÊ÷P¢íÊ∆¬ÇíÊ÷á"”‚á≤‚‚Á"¬&W6ˆ«fVC¢"ÁvñÁ2≤"Ê∆˜76W2¬vñÁ&FS¢"ÁvñÁ2≤"Ê∆˜76W2‚Ú÷FÇÁ&˜VÊBá"ÁvñÁ2Úá"ÁvñÁ2≤"Ê∆˜76W2í¢í¢ÁV∆¬“íê¢Á6˜'BÇÜ¬"í”‚Ü"ÁvñÁ&FRÛÚ”í“ÜÁvñÁ&FRÛÚ”íì∞†¢ÚÚ÷Vñ∆∆WW"vVÁB"÷&6å:í(	Bñ∆˜FW"∆&˜V6∆RfW'GVWW6P¢6ˆÁ7B÷G&óÖ&˜w2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¬÷&∂WEˆ∆ñÊR¿¢4ıTÂBÇ¢íF˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí∆˜76W0¢e$Ù“vVÁEˆ÷&∂WE˜&VFñ7FñˆÁ0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢u$ıU%ívVÁEˆÊ÷R¬÷&∂WEˆ∆ñÊP¢íÊ∆¬Çì∞¢6ˆÁ7B∆ñÊT∆&V«2“≤'WG3¢$˜fW"ıVÊFW""„R"¬'GG3¢$%EE2"¬&W7V«FC¢%,:ó7V«FBÉ""¬◊C¢$'WB:á&R’B"”∞¢6ˆÁ7B&W7D'î÷&∂WB“∑”∞¢÷G&óÖ&˜w2Êf˜$V6Çá"”‚∞¢6ˆÁ7B&W6ˆ«fVB“"ÁvñÁ2≤"Ê∆˜76W3∞¢ñbá&W6ˆ«fVB¬Rí&WGW&„∞¢6ˆÁ7Bw"“÷FÇÁ&˜VÊBá"ÁvñÁ2Ú&W6ˆ«fVB¢ì∞¢ñbÇ&W7D'î÷&∂WE∑"Ê÷&∂WEˆ∆ñÊU“«¬w"‚&W7D'î÷&∂WE∑"Ê÷&∂WEˆ∆ñÊU“ÁvñÁ&FRí∞¢&W7D'î÷&∂WE∑"Ê÷&∂WEˆ∆ñÊU““≤vVÁC¢"ÊvVÁEˆÊ÷R¬vñÁ&FS¢w"¬&W6ˆ«fVB¬∆&V√¢∆ñÊT∆&V«5∑"Ê÷&∂WEˆ∆ñÊU“«¬"Ê÷&∂WEˆ∆ñÊR”∞¢–¢“ì∞†¢6ˆÁ7Bf◊B“Üí”‚G∂ÁvñÁ&FR”“ÁV∆¬ÚG∂ÁvñÁ&FW“V¢&‚ˆ'“(	BG∂ÊvVÁEˆÊ÷W“ÇG∂ÁvñÁ7’rÚG∂Ê∆˜76W7‘¬ñ∞¢6ˆÁ7B◊6r“∞¢	˘8¢∆#‰TDïBÑT$DÙ‘Dï$RDU2î¬ˆ#Ê¿¢	˘8R6V÷ñÊRGRG∂ÊWrFFRÑFFRÊÊ˜rÇí“r£ÉcCíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ√ó“RG∂ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ√ó÷¿¢¿¢∆#Ô	¯ÍÚîˆffñ6ñV∆∆W3¬ˆ#Ê¿¢ˆffñ6ñƒvVÁG2Ê∆VÊwFÇÚˆffñ6ñƒvVÁG2Ê÷Üf◊BíÊ¶ˆñ‚Ç%∆‚"í¢"ÜV7VÊRFˆÊÏ:ñRí"¿¢¿¢∆#Ó)™¢î&∆Ê6ÜW2Ü&Ê2BvW76íì¬ˆ#Ê¿¢6ÜF˜tvVÁG2Ê∆VÊwFÇÚ6ÜF˜tvVÁG2Ê÷Üf◊BíÊ¶ˆñ‚Ç%∆‚"í¢"ÜV7VÊRFˆÊÏ:ñRí"¿¢¿¢∆#Ô	¯¯b÷Vñ∆∆WW"vVÁB"÷&6å:ì¬ˆ#Ê¿¢ˆ&¶V7BÊ∂Wó2Ü&W7D'î÷&∂WBíÊ∆VÊwFÄ¢Úˆ&¶V7BÁf«VW2Ü&W7D'î÷&∂WBíÊ÷Ü"”‚	¯¯bG∂"Ê∆&V«“(i"G∂"ÊvVÁG“ÇG∂"ÁvñÁ&FW“R7W"G∂"Á&W6ˆ«fVG“ñíÊ¶ˆñ‚Ç%∆‚"ê¢¢"á276W¢FRFˆÊÏ:ñW2í"¿¢¿¢)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H¿¢	˙Ib&˜'BWFÚ+rF˜W4∆W4÷F6á6¿¢“Ê¶ˆñ‚Ç%∆‚"ì∞†¢6ˆÁ7Bˆ≤“vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬◊6rì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑vVV∂«í÷vVÁG2÷VFóE“FV∆Vw&“F÷ñ„¢G∂ˆ≤Ú$Ù≤"¢$dî¬'÷ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑vVV∂«í÷vVÁG2÷VFóE“W'&˜#¢"¬RÊ÷W76vRì∞¢–ß–†¢ÚÚ)H)HWFÚ◊˜7B,:ó7V«FB6ñvÊ¬f˜'B7W"FV∆Vw&“VÊB,:ó6ˆ«R)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶6ˆÁ7B˜6ñvÊ≈&W7V«E6VÁD66ÜR“ÊWr6WBÇì∞¶7ñÊ2gVÊ7Fñˆ‚Ê˜Fñgï6ñvÊƒf˜'E&W7V«BÜÊ«ó6ó2¬˜WF6ˆ÷R¬66˜&TÇ¬66˜&Tí∞¢6ˆÁ7B66ÜT∂Wí“G∂Ê«ó6ó2ÊÜˆ÷W’ÚG∂Ê«ó6ó2Êvó÷∞¢ñbÖ˜6ñvÊ≈&W7V«E6VÁD66ÜRÊÜ2Ü66ÜT∂Wííí&WGW&„∞¢˜6ñvÊ≈&W7V«E6VÁD66ÜRÊFBÜ66ÜT∂Wíì∞†¢6ˆÁ7Bñ6ˆ‚“˜WF6ˆ÷R””“'vñ‚"Ú.)»R"¢.)ÿ¬#∞¢6ˆÁ7B&W7V«EFWáB“˜WF6ˆ÷R””“'vñ‚"Ú$ttÏ8í"¢%U$ER#∞¢6ˆÁ7B7˜'Dñ6ˆÁ2“≤fˆ˜F&∆√¢.)´“"¬&6∂WF&∆√¢/	¯¯"¬Üˆ6∂Wì¢/	¯˘""¬&6V&∆√¢.)´‚"”∞¢6ˆÁ7B6í“7˜'Dñ6ˆÁ5∂Ê«ó6ó2Á7˜'E“«¬/	¯ÍÚ#∞¢6ˆÁ7B7FG2“vWE6ñvÊƒf˜'E7FG2Çì∞¢6ˆÁ7B6˜FTffñ6ÜVR“&˜tˆFBÜÊ«ó6ó2íÁFÙfóÜVBÉ"ì∞¢6ˆÁ7Bvñ‚“É¢'6Tf∆ˆBÜ6˜FTffñ6ÜVRííÁFÙfóÜVBÉ"ì∞¢ÚÚÊˆ“GR&ˆˆ∂÷∂W"6˜W&6RáG&Á7&VÊ6Rí(	B6Vb6í6˜FRW7Fñ‹:ñP¢6ˆÁ7Bˆ&““Ê«ó6ó2Á&V≈ˆˆFE˜6˜W&6RbbˆW7Fñ÷Fñˆ‚ˆíÁFW7BÖ7G&ñÊrÜÊ«ó6ó2Á&V≈ˆˆFE˜6˜W&6Ríê¢Ú7G&ñÊrÜÊ«ó6ó2Á&V≈ˆˆFE˜6˜W&6Rí¢ÁV∆√∞¢6ˆÁ7B&’7VffóÇ“ˆ&“Ú∆ì‚ÇGµˆ&◊“ì¬ˆìÊ¢"#∞¢ÚÚ6˜FRˆvñ‚ffñ6å:ó2T‰ïTT‘TÂB6íg&ñR6˜FR&ˆˆ∂÷∂W"Ü¶÷ó2¬vW7Fñ÷Fñˆ‚í‡¢6ˆÁ7BÜ5&V¬“ˆ&”∞¢6ˆÁ7B÷ñÁWFU7G"“Ê«ó6ó2Ê÷ñÁWFUˆEˆÊ«ó6ó2”“ÁV∆¬bbÊ«ó6ó2Ê÷ñÁWFUˆEˆÊ«ó6ó2”“VÊFVfñÊV@¢ÚÜFˆÊÏ:í:∆G∂Ê«ó6ó2Ê÷ñÁWFUˆEˆÊ«ó6ó7÷R÷ñ‚ñ ¢¢"#∞†¢6ˆÁ7B&V÷óV‘◊6r“∞¢G∂ñ6ˆÁ“∆#Â4ît‰¬dı%BG∑&W7V«EFWáG”¬ˆ#Ê¿¢¿¢G∑6ó“∆#‚G∂Ê«ó6ó2ÊÜˆ÷W“g2G∂Ê«ó6ó2Êvó”¬ˆ#Ê¿¢Ê«ó6ó2Ê6ˆ◊WFóFñˆ‚Ú	¯¯bG∂Ê«ó6ó2Ê6ˆ◊WFóFñˆÁ÷¢""¿¢)´“66˜&RfñÊ¬¢∆#‚G∑66˜&Tá““G∑66˜&T”¬ˆ#Ê¿¢	˘*Ê«ó6Rî¢∆#‚G∂Ê«ó6ó2Ê&W7Eˆ&WG“G∂÷ñÁWFU7G'”¬ˆ#Ê¿¢	˘8¢66˜&RFR6ˆÊfñÊ6R¢∆#‚G∂Ê«ó6ó2Ê6ˆÊfñFVÊ6W“Û¬ˆ#‚G∂Ü5&V¬Ú+r6˜FR¢∆#‚G∂6˜FTffñ6ÜVW”¬ˆ#‚G∂&’7Vffóá÷¢"'÷¿¢¿¢˜WF6ˆ÷R””“'vñ‚"bbÜ5&V¿¢Ú	˘+÷ó6R(*¬(i"∆#‰vñ‚G∂vñÁﬁ(*√¬ˆ#Ê ¢¢¿¢¿¢	˘8Ç&ñ∆‚6ñvÊ¬f˜'B¢∆#‚G∑7FG2ÁvñÁ7’rÚG∑7FG2Ê∆˜76W7‘¬(	BG∑7FG2ÁvñÁ&FW“RvñÁ&FS¬ˆ#Ê¿¢¿¢)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H¿¢	˙Ib6ˆÁ6Vñ¬î(	BF˜W4∆W4÷F6á6¿¢ÚÚ&∆ˆ2Êv∆ó26ˆ◊7Báfˆó"$UEÙƒ$T≈ÙT‚í¢∆R66˜&RfñÊ¬WB∆R&ñ∆‡¢ÚÚ6Üñfg&W26ˆÁBFV¶∆ó6ñ&∆W2FV«2VV«2¬ˆ‚ÊRG&GVóBVR∆RfW&Fñ7@¢ÚÚWB∆RGóRBvÊ«ó6R‡¢¿¢	¯zœ	¯zr∆#Â5E$Ù‰r4ît‰¬G∂˜WF6ˆ÷R””“'vñ‚"Ú%tÙ‚"¢$ƒı5B'”¬ˆ#‚(	BG∂&WD∆&VƒV‚ÜÊ«ó6ó2Ê&W7Eˆ&WBó÷¿¢)™˚àÚÇ≤(	B&W7ˆÁ6ñ&∆Rv÷ñÊv¿¢“Êfñ«FW"Ñ&ˆˆ∆V‚íÊ¶ˆñ‚Ç%∆‚"ì∞†¢6ˆÁ7Bg&VT◊6r“∞¢G∂ñ6ˆÁ“∆#Â4ît‰¬dı%BG∑&W7V«EFWáG”¬ˆ#Ê¿¢¿¢G∑6ó“∆#‚G∂Ê«ó6ó2ÊÜˆ÷W“g2G∂Ê«ó6ó2Êvó”¬ˆ#Ê¿¢Ê«ó6ó2Ê6ˆ◊WFóFñˆ‚Ú	¯¯bG∂Ê«ó6ó2Ê6ˆ◊WFóFñˆÁ÷¢""¿¢)´“66˜&RfñÊ¬¢∆#‚G∑66˜&Tá““G∑66˜&T”¬ˆ#Ê¿¢	˘8¢66˜&RFR6ˆÊfñÊ6R¢∆#‚G∂Ê«ó6ó2Ê6ˆÊfñFVÊ6W“Û¬ˆ#‚G∂Ü5&V¬Ú+r6˜FR¢∆#‚G∂6˜FTffñ6ÜVW”¬ˆ#‚G∂&’7Vffóá÷¢"'÷¿¢¿¢˜WF6ˆ÷R””“'vñ‚"bbÜ5&V¿¢Ú	˘+÷ó6R(*¬(i"∆#‰vñ‚G∂vñÁﬁ(*√¬ˆ#Ê ¢¢¿¢¿¢	˘8Ç&ñ∆‚¢∆#‚G∑7FG2ÁvñÁ7“vvÏ:ó27W"G∑7FG2ÁF˜F«“(	BG∑7FG2ÁvñÁ&FW“RvñÁ&FS¬ˆ#Ê¿¢¿¢˜WF6ˆ÷R””“'vñ‚ ¢Ú	˘(‚ñ÷vñÊR6íGRfó2WR∆Rñ6≤V‚Fó&V7B‚‚Â∆Ô	˘í∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2#Ó)™&V6Wfˆó"F˜W2∆W26ñvÊWÇL:á2B√ì(*√¬ˆÊ ¢¢	˘*¢∆Fó66ó∆ñÊRfóB∆Fñfl:ó&VÊ6R7W"∆R∆ˆÊrFW&÷RÂ∆Ô	˘í∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2#Ó)™&V6Wfˆó"F˜W2∆W26ñvÊWÇL:á2B√ì(*√¬ˆÊ¿¢¿¢)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H¿¢	˙Ib6ˆÁ6Vñ¬î(	BF˜W4∆W4÷F6á6¿¢¿¢	¯zœ	¯zr∆#Â5E$Ù‰r4ît‰¬G∂˜WF6ˆ÷R””“'vñ‚"Ú%tÙ‚"¢$ƒı5B'”¬ˆ#‚(	BWfW'í&W7V«B7Fó2V&∆ñ2¬vñÁ2ÊB∆˜76W2∆ñ∂RÊ¿¢)™˚àÚÇ≤(	B&W7ˆÁ6ñ&∆Rv÷ñÊv¿¢“Êfñ«FW"Ñ&ˆˆ∆V‚íÊ¶ˆñ‚Ç%∆‚"ì∞†¢ÚÚ6ˆå:ó&VÊ6R¢ˆ‚ÊR˜7FR∆R,:ó7V«FBTR7W"∆W26ÊWÇVíˆÁB,:ñV∆∆V÷VÁB&\:wP¢ÚÚ∆Rñ6≤‚V‚6ñvÊ¬¶÷ó2FñfgW<:íÜ&∆˜\:íˆÜ˜'2$§T¬˜∆fˆÊBíÊR|:ñÏ:á&RV7V‡¢ÚÚ÷W76vRFR,:ó7V«FB(	BfñÊí∆W2&vvÏ:í˜W&GR≤ñÁ67&ó2◊Fˆí"6˜'Fó2FRÁV∆∆R'B‡¢6ˆÁ7BFV∆ófW'ï&ˆˆb“7F˜&VEFV∆Vw&‘FV∆ófW'íÜÊ«ó6ó2ì∞¢6ˆÁ7B6VÁE7FÊF&B“FV∆ófW'ï&ˆˆbÊ6ÜÊÊV«2ÊÜ2Ç'7FÊF&B"ì∞¢6ˆÁ7B6VÁE&V÷óV““FV∆ófW'ï&ˆˆbÊ6ÜÊÊV«2ÊÜ2Ç'&V÷óV“"ì∞¢6ˆÁ7B6VÁDV∆óFR“FV∆ófW'ï&ˆˆbÊ6ÜÊÊV«2ÊÜ2Ç&V∆óFR"ì∞¢6ˆÁ7B6VÁDg&VR“FV∆ófW'ï&ˆˆbÊ6ÜÊÊV«2ÊÜ2Ç&g&VR"ì∞¢ñbÇ6VÁE7FÊF&Bbb6VÁE&V÷óV“bb6VÁDV∆óFRbb6VÁDg&VRí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑6ñvÊ¬÷f˜'B◊&W7V«E“G∂Ê«ó6ó2ÊÜˆ÷W“g2G∂Ê«ó6ó2Êvó“(i"G∂˜WF6ˆ÷W“¢ñ6≤¶÷ó2FñfgW<:í¬,:ó7V«FBÊˆ‚˜7L:ñì∞¢&WGW&„∞¢–¢ñbÖDTƒTu$’ı5D‰D$EÙ4Ñ‰‰T≈ÙîBbb6VÁE7FÊF&Bí6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ı5D‰D$EÙ4Ñ‰‰T≈ÙîB¬&V÷óV‘◊6rì∞¢ñbÖDTƒTu$’ı$T‘ïT’Ù4Ñ‰‰T≈ÙîBbb6VÁE&V÷óV“í6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ı$T‘ïT’Ù4Ñ‰‰T≈ÙîB¬&V÷óV‘◊6rì∞¢ñbÖDTƒTu$’ÙTƒïDUÙ4Ñ‰‰T≈ÙîBbb6VÁDV∆óFRí6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙTƒïDUÙ4Ñ‰‰T≈ÙîB¬&V÷óV‘◊6rì∞¢ñbÖDTƒTu$’Ù4Ñ‰‰T≈ÙîBbb6VÁDg&VRí6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’Ù4Ñ‰‰T≈ÙîB¬g&VT◊6rì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑6ñvÊ¬÷f˜'B◊&W7V«E“G∂ñ6ˆÁ“G∂Ê«ó6ó2ÊÜˆ÷W“g2G∂Ê«ó6ó2Êvó“(i"G∂˜WF6ˆ÷W“á˜7L:ì¢G∑6VÁDg&VRÚ"g&VR"¢"'“G∑6VÁE7FÊF&BÚ"7FÊF&B"¢"'“G∑6VÁE&V÷óV“Ú"&V÷óV“"¢"'“G∑6VÁDV∆óFRÚ"V∆óFR"¢"'“ñì∞ß–†¢ÚÚ÷'VR7W"VV¬6Ê¬6∆ñVÁBV‚6ñvÊ¬:óL:í,:ñV∆∆V÷VÁBFñfgW<:íÜ6ˆ¬ñÁFW&ÊRfóÜRí‡¶6ˆÁ7B4ît‰≈ı4TÂEÙ4Ù≈T‘Â2“≤'6ñu˜6VÁEˆg&VR"¬'6ñu˜6VÁE˜7FÊF&B"¬'6ñu˜6VÁE˜&V÷óV“"¬'6ñu˜6VÁEˆV∆óFR%”∞¢ÚÚ6W6R&VV∆∆RGR÷'VvRW'&ˆÊRG&˜WfR∆RrÛÇÛ##b7W"6«V"''VvvRµbg0¢ÚÚ∂˜'G&ñ¶≤¢6ñu˜6VÁEˆV∆óFS”7W"VÊRÊ«ó6RSRRFR6ˆÊfñÊ6R¬fV2V‡¢ÚÚFñfgW6ñˆÂˆ&∆ˆ6≤WBVÊR6˜FRW7Fñ÷VR¬6Á2V7V‚%FV∆Vw&“V∆óFRÙ≤"V‚f6R‡¢Ú¢ÚÚ¬v˜&G&RFW2V«2WFóB˜W'FÁB6˜'&V7B(	B÷&µ6ñvÊ≈6VÁBÇí‚vW7BV∆P¢ÚÚRv&W26ˆÊfó&÷Fñˆ‚BvVÁfˆí‚∆RFVfWBWFóBFÁ2∆$UTUDR¢V∆∆R÷'Vó@¢ÚÚDıUDU2∆W2∆ñvÊW2GR÷F6Ç˜W"∆¶˜W&ÊVR‚˜"÷F6Öˆ∂Wí6ˆÁFñVÁB∆G&Ê6ÜP¢ÚÚFR÷ñÁWFRWB∆R66˜&RÜvWE&VFñ7FñˆÂ6Ê6Ü˜D∂Wíí¬FˆÊ2V‚÷F6ÇÊ«ó6RF˜WFW0¢ÚÚ∆W2b÷ñÁWFW2&ˆGVóBVÊRFó¶ñÊRFR∆ñvÊW2"¶˜W"‚V‚VÁfˆí&WW76í∆#VP¢ÚÚ÷ñÁWFR÷'VóBW76í∆∆ñvÊRFR∆CR¬&∆˜VVRSRR‡¢Ú¢ÚÚˆ‚6ñ&∆RFW6˜&÷ó2∆∆ñvÊRWÜ7FR"÷F6Öˆ∂Wí¬WBˆ‚&VgW6RFR÷'VW"VÊP¢ÚÚ∆ñvÊR&∆˜VVR˜RFˆÁB∆6˜FR‚vW7BRwVÊRW7Fñ÷Fñˆ‚(	BFWWÇv&FR÷f˜W0¢ÚÚFV÷ÊFW2V‚&V∆V7GW&R¬Ví&VÊFVÁB∆R÷'VvRW'&ˆÊRñ◊˜76ñ&∆R÷V÷R6íV‡¢ÚÚWG&R6ÜV÷ñ‚BvV¬&ó76óBV‚¶˜W"‡¶gVÊ7Fñˆ‚÷&µ6ñvÊ≈6VÁBÜÜˆ÷R¬ví¬6ˆ¬¬÷F6Ñ∂Wíí∞¢ñbÇ4ît‰≈ı4TÂEÙ4Ù≈T‘Â2ÊñÊ6«VFW2Ü6ˆ¬íí&WGW&„∞¢G'í∞¢6ˆÁ7Bv&FR“‰BÜFñfgW6ñˆÂˆ&∆ˆ6≤ï2ÂTƒ¬ı"G&ñ“ÜFñfgW6ñˆÂˆ&∆ˆ6≤í“rrê¢‰Bá&V≈ˆˆFE˜6˜W&6Rï2ÂTƒ¬ı"∆˜vW"á&V≈ˆˆFE˜6˜W&6Rí‰ıBƒî¥RrVW7Fñ÷Fñˆ‚Rrñ∞¢6ˆÁ7B"“÷F6Ñ∂Wê¢ÚF"Á&W&RÜUDDR6ˆÊ6ñ∆UˆÊ«ó6W24UBG∂6ˆ«””tÑU$R÷F6Öˆ∂Wí“ÚG∂v&FW÷íÁ'V‚Ü÷F6Ñ∂Wíê¢¢F"Á&W&RÄ¢UDDR6ˆÊ6ñ∆UˆÊ«ó6W24UBG∂6ˆ«””¢tÑU$R∆˜vW"áG&ñ“ÜÜˆ÷Ríì÷∆˜vW"áG&ñ“ÉÚíí‰B∆˜vW"áG&ñ“Üvííì÷∆˜vW"áG&ñ“ÉÚíê¢‰BFFRÜÊ«ó6VEˆBì÷FFRÇvÊ˜rríG∂v&FW÷ ¢íÁ'V‚ÜÜˆ÷R¬víì∞¢ñbÇ"Ê6ÜÊvW2í∞¢6ˆÁ6ˆ∆RÁv&‚Ü∑6ñvÊ¬◊6VÁE“G∂6ˆ«“‰Ù‚÷'VR˜W"G∂Üˆ÷W“g2G∂vó“¢∆ñvÊR&∆˜VVR¬6˜FRW7Fñ÷VR¬˜RñÁG&˜Wf&∆Vì∞¢–¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑6ñvÊ¬◊6VÁE“"¬RÊ÷W76vRì≤–ß–†¢ÚÚÊˆ÷'&RFR6ñvÊWÇ,8îTƒƒT‘TÂBFñfgW<:ó2V¶˜W&BváVí7W"V‚6Ê¬¬«RFWVó2∆¢ÚÚ&6RWBÊˆ‚FWVó2V‚6ˆ◊FWW"‹:ñ÷ˆó&R‚∆W2∆fˆÊG2¶˜W&Ê∆ñW'2É2ˆ¶˜W"V‡¢ÚÚ7FÊF&B¬WF2‚í6ˆÁBVÊR&ˆ÷W76R6ˆ÷÷W&6ñ∆Rffñ6å:ñR7W"∆vRF&ñg2†¢ÚÚV‚6ˆ◊FWW"V‚‹:ñ÷ˆó&R&W'FóBFR¨:ó&Ú:6ÜVR&VL:ñ÷'&vRGR6ˆÁFVÊWW"¿¢ÚÚFˆÊ2V‚¶˜W":«W6ñWW'2&VL:ó∆ˆñV÷VÁG2˜WfóBL:ó76W"∆R∆fˆÊBÊÊˆÊ<:í‡¢ÚÚ‹:¶÷R6ˆÁfVÁFñˆ‚FRFFRÖUD2íVR÷&µ6ñvÊ≈6VÁB¬˜W"&W7FW"6ˆå:ó&VÁB‡¶gVÊ7Fñˆ‚6ñvÊ«56VÁEFˆFíÜ6ˆ¬í∞¢ñbÇ4ît‰≈ı4TÂEÙ4Ù≈T‘Â2ÊñÊ6«VFW2Ü6ˆ¬íí&WGW&‚∞¢G'í∞¢6ˆÁ7B6ÜÊÊV¬“6ˆ¬Á&W∆6RÇıÁ6ñu˜6VÁEÚÚ¬""ì∞¢6ˆÁ7B&˜r“F"Á&W&RÄ¢4TƒT5B4ıTÂBÑDï5Dî‰5B÷F6Öˆ∂Wíí2‚e$Ù“FV∆Vw&’˜6ñvÊ≈ˆFV∆ófW&ñW0¢tÑU$R6ÜÊÊV¬“Ú‰Bˆ≤“‰BFV∆Vw&’ˆ÷W76vUˆñBï2‰ıBÂTƒ¿¢‰BFFRÜ7&VFVEˆBí“FFRÇvÊ˜rrñ ¢íÊvWBÜ6ÜÊÊV¬ì∞¢&WGW&‚ÁV÷&W"á&˜sÚÊ‚í«¬∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑6ñvÊ¬◊6VÁE“6ˆ◊FvS¢"¬RÊ÷W76vRì∞¢&WGW&‚≤ÚÚV‚62BvñÊ6ñFVÁB¬ˆ‚ÊR&∆˜VR2∆FñfgW6ñˆ‡¢–ß–†¢ÚÚ¶WFˆÁ2&W7FÁG2BwV‚&ˆÊÏ:í¢V‚'VFvWBT‰ïTR'F|:íVÁG&R∆W26ñvÊWÄ¢ÚÚFV∆Vw&“,:ñV∆∆V÷VÁBFñfgW<:ó2V¶˜W&BváVí7W"6ˆ‚∆ñW"Ü6Ê¬6ˆ÷◊V‚¬FˆÊ0¢ÚÚñFVÁFóVR˜W"F˜WB∆R∆ñW"íWB6W2&˜&W2Ê«ó6W2˜WfW'FW2:∆FV÷ÊFP¢ÚÚ7W"∆R6óFRÑ∆ófRîí‚L:ñ6ó6ñˆ‚fˆÊFFWW"GRBÛÇÛ##b¢V‚&ˆÊÏ:í7FÊF&@¢ÚÚÉ2¶WFˆÁ2ˆ¢íVíL:ñ¨:&\:wR"6ñvÊWÇFV∆Vw&“V¶˜W&BváVíÊRWWB«W0¢ÚÚ˜Wg&ó"RsÊ«ó6R÷ÁVV∆∆RfÁB÷ñÁVóB(	B6ñÊˆ‚ˆ‚«Ví&ˆ÷WB2∆W'FW2ˆ†¢ÚÚUB2Ê«ó6W2ˆ¢V‚«W2¬6ˆóBb¬6RVí‚vW7B¶÷ó26RVí:óL:ífVÊGR‡¢ÚÚV˜FFR¶WFˆÁ2ˆ¶˜W""∆ñW"(	BFV6ó6ñˆ‚fˆÊFFWW"GRBÛÇÛ##b‡¢ÚÚ&6'FR"“6ÜBˆÊ7GVV¬(*¬áfˆó"5E$ïUı$î4UÙîEÙ4%DRí¢¶WFˆ‚VÊóVR‡¶gVÊ7Fñˆ‚FVfV«D7&VFóG4÷Ñf˜%∆‚á∆‚í∞¢7vóF6ÇÖ7G&ñÊrá∆‚«¬""íÁFÙ∆˜vW$66RÇíí∞¢66R&6'FR#¢&WGW&‚∞¢66R&g&VR#¢&WGW&‚∞¢66R'7FÊF&B#¢&WGW&‚3∞¢66R'&V÷óV“#†¢66R'fó#¢&WGW&‚∞¢66R&V∆óFR#¢&WGW&‚3∞¢FVfV«C¢&WGW&‚∞¢–ß–†¢ÚÚ6ÜBˆÊ7GVV¬BwV‚¶WFˆ‚:(*¬Üˆfg&R&6'FR"í˜W"V‚&ˆÊÏ:íL8î¨87Fñb†¢ÚÚˆ‚ÊR7,:ñR2V‚6V6ˆÊB6ˆ◊FR&∆Ã:Ü∆R¬ˆ‚¶˜WFR≥¶WFˆ‚:4Ù‚6ˆ◊FP¢ÚÚWÜó7FÁB˜W"V¶˜W&BváVí6WV∆V÷VÁBÜFV÷ÊFRfˆÊFFWW"BÛÇÛ##b(	B60¢ÚÚBwW6vR,:ñV¬¢V‚&ˆÊÏ:í7FÊF&BVí:óVó<:í6W22¶WFˆÁ2GR¶˜W"WBfWW@¢ÚÚV‚&6ÜWFW"V‚6Á26ÜÊvW"FR6ˆFRBv6<:á2í‚7&VFóG5˜W6VBWWB76W"6˜W0¢ÚÚ¨:ó&Ú6Á26ˆÁ<:óVVÊ6R¢7&VFóG4∆VgDf˜%∆‚Çí∆fˆÊÊRL:ñ¨::<;GL:í∆V7GW&R¿¢ÚÚWB7&VFóG5ˆFFR&W'B:¨:ó&Ú∆R∆VÊFV÷ñ‚FRF˜WFRf:vˆ‚‡¢ÚÚ&WF˜W&ÊRG'VR6íV‚6ˆ◊FRWÜó7FÁB:óL:í7,:ñFóL:í¬f«6R6íV7V‚G&˜Wl:ê¢ÚÚÜFÁ26R62¬vV∆ÁB7,:ñRV‚6ˆFR&6'FR"WFˆÊˆ÷R¬6ˆ◊˜'FV÷VÁBñÊ6ÜÊ|:íí‡¶gVÊ7Fñˆ‚w&ÁD6'FT7&VFóEFÙWÜó7FñÊt66˜VÁBÜV÷ñ¬í∞¢G'í∞¢6ˆÁ7BFˆFí“vWEFˆFï7G"Çì∞¢6ˆÁ7BvF"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6ˆÁ7B&˜r“vF"Á&W&RÄ¢%4TƒT5B6ˆFR¬∆‚¬7&VFóG5˜W6VB¬7&VFóG5ˆFFRe$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“‰B∆‚“v6'FRrı$DU"%í&˜vñBDU42ƒî‘ïB ¢íÊvWBÜV÷ñ¬ì∞¢ñbÇ&˜rí≤vF"Ê6∆˜6RÇì≤&WGW&‚f«6S≤–¢ñbá&˜rÊ7&VFóG5ˆFFR””“FˆFíí∞¢vF"Á&W&RÇ%UDDR6ˆFW24UB7&VFóG5˜W6VB“7&VFóG5˜W6VB“tÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú"íÁ'V‚á&˜rÊ6ˆFR¬V÷ñ¬ì∞¢“V«6R∞¢vF"Á&W&RÇ%UDDR6ˆFW24UB7&VFóG5˜W6VB“”¬7&VFóG5ˆFFR“ÚtÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú"íÁ'V‚áFˆFí¬&˜rÊ6ˆFR¬V÷ñ¬ì∞¢–¢vF"Ê6∆˜6RÇì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂6'FU“≥¶WFˆ‚&ˆÁW27,:ñFóL:í7W"∆R6ˆ◊FRG∑&˜rÁ∆Á“WÜó7FÁBFRG∂V÷ñ«÷ì∞¢&WGW&‚G'VS∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂6'FU“w&ÁD6'FT7&VFóEFÙWÜó7FñÊt66˜VÁC¢"¬RÊ÷W76vRì≤&WGW&‚f«6S≤–ß–†¶gVÊ7Fñˆ‚7&VFóG4∆VgDf˜%∆‚á∆‚¬7&VFóG4÷Ç¬7&VFóG5W6VB¬7&VFóG4FFRí∞¢ñbÇ7&VFóG4÷Ç«¬7&VFóG4÷Ç√“í&WGW&‚ÁV∆√≤ÚÚñ∆∆ñ÷óL:íÜF÷ñ‚¬WF2‚ê¢6ˆÁ7BFˆFí“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BW6VD÷ÁV¬“7&VFóG4FFR””“FˆFíÚÑÁV÷&W"Ü7&VFóG5W6VBí«¬í¢∞¢6ˆÁ7B6ˆ¬“4îuÙ4Ù≈T‘ÂÙ%ïıƒÂµ7G&ñÊrá∆‚«¬""íÁFÙ∆˜vW$66RÇï“«¬ÁV∆√∞¢6ˆÁ7BW6VEFV∆Vw&““6ˆ¬Ú6ñvÊ«56VÁEFˆFíÜ6ˆ¬í¢∞¢&WGW&‚÷FÇÊ÷ÇÉ¬7&VFóG4÷Ç“W6VD÷ÁV¬“W6VEFV∆Vw&“ì∞ß–†¢ÚÚ)H)HV÷ñ¬ÜV&Fˆ÷Fó&RFR6ˆÁfW'6ñˆ‚WÇ∆VG2w&GVóG2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶7ñÊ2gVÊ7Fñˆ‚6VÊEvVV∂«î6ˆÁfW'6ñˆ‰V÷ñ¬Çí∞¢ñbÇ%$UdıÙïÙ¥Uíí&WGW&„∞¢6ˆÁ7B7FG2“vWE6ñvÊƒf˜'E7FG2Çì∞¢ñbá7FG2ÁF˜F¬¬2í&WGW&„∞†¢6ˆÁ7B&V6VÁEvñÁ2“7FG2Á&V6VÁBÊfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“'vñ‚"íÁ6∆ñ6RÉ¬Rì∞¢6ˆÁ7BvñÁ5&˜w2“&V6VÁEvñÁ2Ê÷á"”‡¢«G"7Gñ∆S“&&˜&FW"÷&˜GFˆ”£Ç6ˆ∆ñB&v&É#SR√#SR√#SR¬„bí#‡¢«FB7Gñ∆S“'FFñÊs£áÇgÉ∂fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢3#ìÉ#Ó)»S¬˜FC‡¢«FB7Gñ∆S“'FFñÊs£áÇgÉ∂fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢6V6VcB#‚G∑"ÊÜˆ÷W“g2G∑"Êvó”¬˜FC‡¢«FB7Gñ∆S“'FFñÊs£áÇgÉ∂fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢3#&C6VR#‚G∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó”¬˜FC‡¢«FB7Gñ∆S“'FFñÊs£áÇgÉ∂fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢6cÜC3v#‚G∑"Ê6ˆÊfñFVÊ6W“S¬˜FC‡¢¬˜G#Ê ¢íÊ¶ˆñ‚Ç""ì∞†¢6ˆÁ7BáF÷ƒ6ˆÁFVÁB“ £∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3cÉc∑FFñÊs£3'Ç#GÉ∂fˆÁB÷f÷ñ«ì§ñÁFW"ƒ&ñ¬«6Á2◊6W&ñc∂÷Ç◊vñGFÉ£cÉ∂÷&vñ„£WFÚ#‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£#GÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#GÉ∂fˆÁB◊vVñváC£ì∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3c3cfc¬3v36VBì≤◊vV&∂óB÷&6∂w&˜VÊB÷6∆óßFWáC≤◊vV&∂óB◊FWáB÷fñ∆¬÷6ˆ∆˜#ßG&Á7&VÁC∂Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≤#ÂF˜W4∆W4÷F6á3¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂∆WGFW"◊76ñÊs¢„V”∑FWáB◊G&Á6f˜&”ßWW&66S∂÷&vñ‚◊F˜£GÇ#Â,8ï5T≈DE24ît‰¬dı%B(	B4UEDR4T‘î‰S¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3C#∂&˜&FW#£Ç6ˆ∆ñB&v&Éb√ÉR√#í¬„2ì∂&˜&FW"◊&FóW3£gÉ∑FFñÊs£#GÉ∂÷&vñ‚÷&˜GFˆ”£#Ç#‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£gÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£CáÉ∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢3#ìÉ#‚G∑7FG2ÁvñÁ&FW“S¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£GÉ∂6ˆ∆˜#¢6ÜV3Ç#ÂvñÁ&FR6ñvÊ¬f˜'Bé(öRG∂vWDFFófU6ñvÊ≈Fá&W6Üˆ∆BÇó“R6ˆÊfñÊ6Rì¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢3v#É&∂÷&vñ‚◊F˜£GÇ#‚G∑7FG2ÁvñÁ7“vvÏ:ó2+rG∑7FG2Ê∆˜76W7“W&GW2+rG∑7FG2ÁF˜F«“6ñvÊWÉ¬ˆFóc‡¢¬ˆFóc‡¢«F&∆R7Gñ∆S“'vñGFÉ£S∂&˜&FW"÷6ˆ∆∆6S¶6ˆ∆∆6R#‡¢«G"7Gñ∆S“&&˜&FW"÷&˜GFˆ”£Ç6ˆ∆ñB&v&É#SR√#SR√#SR¬„"í#‡¢«FÇ7Gñ∆S“'FFñÊs£gÉ∂fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∑FWáB÷∆ñv„¶∆VgB#„¬˜FÉ‡¢«FÇ7Gñ∆S“'FFñÊs£gÉ∂fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∑FWáB÷∆ñv„¶∆VgB#‰÷F6É¬˜FÉ‡¢«FÇ7Gñ∆S“'FFñÊs£gÉ∂fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∑FWáB÷∆ñv„¶∆VgB#Â66˜&S¬˜FÉ‡¢«FÇ7Gñ∆S“'FFñÊs£gÉ∂fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∑FWáB÷∆ñv„¶∆VgB#‰6ˆÊfñÊ6S¬˜FÉ‡¢¬˜G#‡¢G∑vñÁ5&˜w7–¢¬˜F&∆S‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚◊F˜£#É∑FFñÊs£GÉ∂&6∂w&˜VÊCß&v&Ésí√s√##í¬„"ì∂&˜&FW#£Ç6ˆ∆ñB&v&Ésí√s√##í¬„#Rì∂&˜&FW"◊&FóW3£Ç#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£GÉ∂6ˆ∆˜#¢6ÜV3É∂÷&vñ‚÷&˜GFˆ”£gÇ#Ô	˘I"∆W2Ê«ó6W26ˆ◊Ã:áFW26ˆÁB,:ó6W'l:ñW2WÇ&ˆÊÏ:ó3¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢3c3cfc#ÂGRfˆó2∆W2÷F6á2vvÊÁG2¬÷ó22¬vÊ«ó6RL:óFñ∆Ã:ñR(	B&V¶ˆñÁ2∆R&V÷óV“˜W"F˜WBL:ñ&∆˜VW"„¬ˆFóc‡¢¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&÷&vñ„£#Ç∑FFñÊs£GÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂fˆÁB◊vVñváC£s∂6ˆ∆˜#¢3#&C6VS∑FWáB◊G&Á6f˜&”ßWW&66S∂∆WGFW"◊76ñÊs¢„ÜV”∂÷&vñ‚÷&˜GFˆ”£É∑FWáB÷∆ñv„¶6VÁFW"#ÂVV¬∆‚˜W"FˆíÛ¬ˆFóc‡¢G∂'Vñ∆E∆‰6ˆ◊&ó6ˆ‰áF÷¬Çó–¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£gÇ#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2"7Gñ∆S“&Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≥∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3FcCfSR¬3v36VBì∂6ˆ∆˜#¢6ffc∑FFñÊs£GÇ3'É∂&˜&FW"◊&FóW3£É∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊS∂fˆÁB◊vVñváC£s∂fˆÁB◊6ó¶S£WÉ∂&˜Ç◊6ÜF˜s£GÇ#Ç&v&Ésí√s√##í¬„Bí#‰6Üˆó6ó"÷ˆ‚∆‚(i#¬ˆ‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£gÇ#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2"7Gñ∆S“&6ˆ∆˜#¢3c3cfc∂fˆÁB◊6ó¶S£7É∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#‰˜Rfˆó"Ê˜2ˆfg&W3¬ˆ‡¢¬ˆFóc‡¢G∂&ˆˆ∂÷∂W$V÷ñƒáF÷¬Çó–¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂∆ñÊR÷ÜVñváC£„b#‡¢F˜W4∆W4÷F6á2(	B&ñ∆‚WFˆ÷FóVRÜV&Fˆ÷Fó&S∆'#‡¢)™˚àÚÇ≤+r¶WR&W7ˆÁ6&∆R+r∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“ˆ÷VÁFñˆÁ2÷∆Vv∆W2ÊáF÷¬"7Gñ∆S“&6ˆ∆˜#¢3c3cfc∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#Â6RL:ó6&ˆÊÊW#¬ˆ‡¢¬ˆFóc‡£¬ˆFócÊ∞†¢G'í∞¢6ˆÁ7B&V÷óV‘V÷ñ«2“ÊWr6WBÇì∞¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆFW4F"Á&W&RÇ%4TƒT5BV÷ñ¬e$Ù“6ˆFW2tÑU$R7FófR“‰BV÷ñ¬ï2‰ıBÂTƒ¬‰BV÷ñ¬“rr"íÊ∆¬Çê¢Êf˜$V6Çá"”‚&V÷óV‘V÷ñ«2ÊFBá"ÊV÷ñ¬ÁFÙ∆˜vW$66RÇííì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢“6F6Ç∑–†¢6ˆÁ7B∆VE&˜w2“∆ˆD∆VG2ÇíÊ∆VG2«¬µ”∞¢6ˆÁ7Bg&VTV÷ñ«2“≤‚‚ÊÊWr6WBÜ∆VE&˜w2Ê÷Ü¬”‚¬ÊV÷ñ¬íÊfñ«FW"ÜR”‚Rbb&V÷óV‘V÷ñ«2ÊÜ2ÜRÁFÙ∆˜vW$66RÇíííï”∞¢∆WB6VÁB“∞¢f˜"Ü6ˆÁ7BV÷ñ¬ˆbg&VTV÷ñ«2Á6∆ñ6RÉ¬3íí∞¢G'í∞¢vóB'&Wfı6VÊDV÷ñ¬ÜV÷ñ¬¬	˘8ÇG∑7FG2ÁvñÁ&FW“RvñÁ&FR6WGFR6V÷ñÊR(	B6ñvÊ¬f˜'Bî¬áF÷ƒ6ˆÁFVÁBì∞¢6VÁB≤≥∞¢“6F6Ç∑–¢–¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑vVV∂«í÷6ˆÁfW'6ñˆÂ“VÁf˜ú:í:G∑6VÁG“ÚG∂g&VTV÷ñ«2Ê∆VÊwFá“∆VG2w&GVóG6ì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑vVV∂«í÷6ˆÁfW'6ñˆÂ“"¬RÊ÷W76vRì≤–ß–†¢ÚÚf˜&v˜B6ˆFR“∆ˆˆ∑W6ˆFW2ÊF"'íV÷ñ¬ÊB6VÊBfñ'&Wf¶Á˜7BÇ"ˆf˜&v˜B÷6ˆFR"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬““&WÊ&ˆGí«¬∑”∞¢ñbÇV÷ñ¬«¬V÷ñ¬ÊñÊ6«VFW2Ç$"íí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R“ì∞¢6ˆÁ7BV÷ñƒ6∆V‚“V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢ÚÚ«vó2&W«íˆ≤FÚfˆñBV÷ñ¬VÁV÷W&Fñˆ‡¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR“ì∞¢ÚÚ7ñÊ3¢∆ˆˆ≤W6ˆFW2ÊB6VÊ@¢G'í∞¢ÚÚÊ6ñV‚6ÜV÷ñ‚V‚GW""˜f"˜F˜W6∆W6÷F6á2ˆ6ˆFW2ÊF""ñÊWÜó7FÁB7W"∆P¢ÚÚ6ˆÁFVÊWW"(	B∆g&ñR&6RW7B4ÙDU5ÙD%ıDÇÇ"ˆFFˆ6ˆFW2ÊF""í¬WFñ∆ó6VP¢ÚÚ'F˜WBñ∆∆WW'2‚&W7V«FB¢V7V‚6ˆFR‚vWFóB¶÷ó2G&˜WfR¬FˆÊ0¢ÚÚV7V‚V÷ñ¬‚vWFóB¶÷ó2VÁf˜ñR¬6ñ∆VÊ6ñWW6V÷VÁBÜ6ˆÁ7FFR ¢ÚÚw&Vr∆RÛÇÛ##b(	B'Vr&VWÜó7FÁB¬6Á2∆ñV‚fV2¬tıEí‡¢6ˆÁ7B6F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜w2“6F"Á&W&RÄ¢%4TƒT5B6ˆFR¬∆‚e$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“ ¢íÊ∆¬ÜV÷ñƒ6∆V‚ì∞¢6F"Ê6∆˜6RÇì∞¢ñbÇ&˜w2Ê∆VÊwFÇí&WGW&„∞¢ñbÇ%$UdıÙïÙ¥Uíí&WGW&„∞¢6ˆÁ7B6ˆFT∆ó7B“&˜w2Ê÷á"”‡¢«G#„«FB7Gñ∆S“'FFñÊs£gÇ'É∂fˆÁB÷f÷ñ«ì¶÷ˆÊ˜76S∂fˆÁB◊6ó¶S£gÉ∂fˆÁB◊vVñváC£s∂∆WGFW"◊76ñÊs¢„VV“#‚G∑"Ê6ˆFW”¬˜FC„«FB7Gñ∆S“'FFñÊs£gÇ'É∂6ˆ∆˜#¢3v#É&∂fˆÁB◊6ó¶S£7Ç#‚G∑"Á∆‚ÁFıWW$66RÇó”¬˜FC„¬˜G#Ê ¢íÊ¶ˆñ‚Ç""ì∞¢6ˆÁ7BáF÷¬“ ¢∆Fób7Gñ∆S“&fˆÁB÷f÷ñ«ì§ñÁFW"«7ó7FV“◊Ví«6Á2◊6W&ñc∂÷Ç◊vñGFÉ£S#É∂÷&vñ„£WFÛ∂&6∂w&˜VÊC¢3cÉc∂6ˆ∆˜#¢6V6VcC∂&˜&FW"◊&FóW3£'É∂˜fW&f∆˜s¶ÜñFFV‚#‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3FcCfSR¬3v36VBì∑FFñÊs£3'É∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#'É∂fˆÁB◊vVñváC£É∂6ˆ∆˜#¢6ffb#ÂF˜W4∆W4÷F6á3¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#ß&v&É#SR√#SR√#SR¬„rì∂÷&vñ‚◊F˜£GÇ#Â,:ñ7W:ó&Fñˆ‚FRf˜G&R6ˆFRBv6<:á3¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FFñÊs£3'Ç#‡¢«7Gñ∆S“&÷&vñ„£gÉ∂6ˆ∆˜#¢6ÜV3É∂fˆÁB◊6ó¶S£GÇ#Âfˆñ6íf˜G&R6ˆFRBv6<:á276ˆ6ú:í:«7G&ˆÊs‚G∂V÷ñƒ6∆VÁ”¬˜7G&ˆÊs‚£¬˜‡¢«F&∆R7Gñ∆S“'vñGFÉ£S∂&˜&FW"÷6ˆ∆∆6S¶6ˆ∆∆6S∂&6∂w&˜VÊC¢3C#∂&˜&FW"◊&FóW3£áÉ∂˜fW&f∆˜s¶ÜñFFV‚#‡¢G∂6ˆFT∆ó7G–¢¬˜F&∆S‡¢«7Gñ∆S“&÷&vñ„£#Ç∂6ˆ∆˜#¢3v#É&∂fˆÁB◊6ó¶S£'Ç#‰6˜ñW¢6R6ˆFRWB6ˆÊÊV7FW¢◊f˜W27W"∆á&Vc“&áGG3¢Ú˜F˜W6∆W6÷F6á2Ê6ˆ“"7Gñ∆S“&6ˆ∆˜#¢3c3cfc#ÁF˜W6∆W6÷F6á2Ê6ˆ”¬ˆ‚„¬˜‡¢¬ˆFóc‡¢¬ˆFócÊ∞¢vóB'&Wfı6VÊDV÷ñ¬ÜV÷ñƒ6∆V‚¬%f˜G&R6ˆFRBv6<:á2F˜W4∆W4÷F6á2"¬áF÷¬¬≤7&óFñ6√¢G'VR“ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂f˜&v˜B÷6ˆFU“6ˆFRá2íVÁf˜ú:íá2í:G∂V÷ñƒ6∆VÁ÷ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂f˜&v˜B÷6ˆFU“W'&˜#¢"¬RÊ÷W76vRì∞¢–ß“ì∞†¢ÚÚ)H)HfW&ñgí6ˆFRá&VG26ˆFW2ÊF"Fó&V7F«íí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶6ˆÁ7B4ÙDU5ÙD%ıDÇ“&ˆ6W72ÊVÁb‰4ÙDU5ÙD%ıDÇ«¬"ˆFFˆ6ˆFW2ÊF"#∞†¢Ú¢Dƒ“dï$T$4Rd4“4U%dU"¢¶∆WBF∆‘fó&V&6T÷W76vñÊr“ÁV∆√∞†ßG'í∞¢ñbÇfó&V&6TF÷ñ‚Ê2Ê∆VÊwFÇí∞¢fó&V&6TF÷ñ‚ÊñÊóFñ∆ó¶Tá∞¢7&VFVÁFñ√¢fó&V&6TF÷ñ‚Ê7&VFVÁFñ¬Ê∆ñ6Fñˆ‰FVfV«BÇê¢“ì∞¢–¢F∆‘fó&V&6T÷W76vñÊr“fó&V&6TF÷ñ‚Ê÷W76vñÊrÇì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂f6’“fó&V&6RF÷ñ‚ñÊóFñ∆ó6R"ì∞ß“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂f6’“ñÊóFñ∆ó6Fñˆ„¢"¬W'&˜"Ê÷W76vRì∞ß–†¶F"ÊWÜV2Ä¢$5$TDRD$ƒRîb‰ıBUÑï5E2f6’ˆFWfñ6W2Ç"∞¢'Fˆ∂V‚DUÖB$î‘%í¥Uí¬"∞¢&V÷ñ¬DUÖB‰ıBÂTƒ¬¬"∞¢'6W76ñˆÂ˜Fˆ∂V‚DUÖB‰ıBÂTƒ¬¬"∞¢'∆Ff˜&“DUÖBDTdT≈BvÊG&ˆñBr¬"∞¢&VÊ&∆VBîÂDTtU"DTdT≈B¬"∞¢'WFFVEˆBDUÖBDTdT≈B5U%$TÂEıDî‘U5D’"∞¢"ì≤"∞¢$5$TDRî‰DUÇîb‰ıBUÑï5E2ñGÖˆf6’ˆFWfñ6W5ˆV÷ñ¬Ù‚f6’ˆFWfñ6W2ÜV÷ñ¬ì≤"∞¢$5$TDRD$ƒRîb‰ıBUÑï5E2f6’ˆÊ˜Fñfñ6FñˆÁ2Ç"∞¢'6ñvÊ≈ˆ∂WíDUÖB$î‘%í¥Uí¬"∞¢&fóáGW&UˆñBDUÖB¬"∞¢'FV“DUÖB¬"∞¢'6VÁEˆBDUÖBDTdT≈B5U%$TÂEıDî‘U5D’¬"∞¢'7V66W75ˆ6˜VÁBîÂDTtU"DTdT≈B¬"∞¢&fñ«W&Uˆ6˜VÁBîÂDTtU"DTdT≈B"∞¢"ì≤ ¢ì∞†¶gVÊ7Fñˆ‚fW&ñgîf6’7V'67&ñ&W"ÜV÷ñ¬¬6W76ñˆÂFˆ∂V‚í∞¢ñbÇV÷ñ¬«¬6W76ñˆÂFˆ∂V‚í&WGW&‚ÁV∆√∞†¢∆WB6ˆFW4F#∞¢G'í∞¢6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞†¢6ˆÁ7B&˜r“6ˆFW4F"Á&W&RÄ¢%4TƒT5BV÷ñ¬¬∆‚¬7FófR¬Wáó&W5ˆB¬6W76ñˆÂ˜Fˆ∂V‚"∞¢$e$Ù“6ˆFW2tÑU$R∆˜vW"ÜV÷ñ¬í“Ú‰B6W76ñˆÂ˜Fˆ∂V‚“Ú"∞¢$‰B7FófR“ı$DU"%íFFWFñ÷RÜ7&VFVEˆBíDU42ƒî‘ïB ¢íÊvWBÄ¢7G&ñÊrÜV÷ñ¬íÁFÙ∆˜vW$66RÇíÁG&ñ“Çí¿¢7G&ñÊrá6W76ñˆÂFˆ∂V‚íÁG&ñ“Çê¢ì∞†¢ñbÇ&˜rí&WGW&‚ÁV∆√∞¢ñbá&˜rÊWáó&W5ˆBbbFFRÁ'6Rá&˜rÊWáó&W5ˆBí¬FFRÊÊ˜rÇíí&WGW&‚ÁV∆√∞¢ñbÖ7G&ñÊrá&˜rÁ∆‚«¬""íÁFÙ∆˜vW$66RÇí””“&g&VR"í&WGW&‚ÁV∆√∞†¢&WGW&‚&˜s∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂f6’“fW&ñfñ6Fñˆ‚&ˆÊÊS¢"¬W'&˜"Ê÷W76vRì∞¢&WGW&‚ÁV∆√∞¢“fñÊ∆«í∞¢G'í≤ñbÜ6ˆFW4F"í6ˆFW4F"Ê6∆˜6RÇì≤“6F6ÇÖÚí∑–¢–ß–†¶Á˜7BÇ"ˆf6“˜&Vvó7FW""¬á&W¬&W2í”‚∞¢6ˆÁ7BV÷ñ¬“7G&ñÊrá&WÊ&ˆGìÚÊV÷ñ¬«¬""íÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢6ˆÁ7B6W76ñˆÂFˆ∂V‚“7G&ñÊrá&WÊ&ˆGìÚÁ6W76ñˆ‚«¬""íÁG&ñ“Çì∞¢6ˆÁ7BFˆ∂V‚“7G&ñÊrá&WÊ&ˆGìÚÁFˆ∂V‚«¬""íÁG&ñ“Çì∞†¢ñbÇV÷ñ¬«¬6W76ñˆÂFˆ∂V‚«¬Fˆ∂V‚Ê∆VÊwFÇ¬Cí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á∞¢ˆ≥¢f«6R¿¢W'&˜#¢&FˆÊÊVW5ˆf6’ˆñÁf∆ñFW2 ¢“ì∞¢–†¢6ˆÁ7B7V'67&ñ&W"“fW&ñgîf6’7V'67&ñ&W"ÜV÷ñ¬¬6W76ñˆÂFˆ∂V‚ì∞¢ñbÇ7V'67&ñ&W"í∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á∞¢ˆ≥¢f«6R¿¢W'&˜#¢'6W76ñˆÂˆ˜Uˆ&ˆÊÊV÷VÁEˆñÁf∆ñFR ¢“ì∞¢–†¢F"Á&W&RÄ¢$îÂ4U%BîÂDÚf6’ˆFWfñ6W2"∞¢"áFˆ∂V‚∆V÷ñ¬«6W76ñˆÂ˜Fˆ∂V‚«∆Ff˜&“∆VÊ&∆VB«WFFVEˆBí"∞¢%d≈TU2ÉÚ√Ú√Ú¬vÊG&ˆñBr√∆FFWFñ÷RÇvÊ˜rríí"∞¢$Ù‚4Ù‰dƒî5BáFˆ∂V‚íDÚUDDR4UB"∞¢&V÷ñ√÷WÜ6«VFVBÊV÷ñ¬¬"∞¢'6W76ñˆÂ˜Fˆ∂V„÷WÜ6«VFVBÁ6W76ñˆÂ˜Fˆ∂V‚¬"∞¢'∆Ff˜&”“vÊG&ˆñBr¬"∞¢&VÊ&∆VC”¬"∞¢'WFFVEˆC÷FFWFñ÷RÇvÊ˜rrí ¢íÁ'V‚áFˆ∂V‚¬V÷ñ¬¬6W76ñˆÂFˆ∂V‚ì∞†¢&WGW&‚&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢&Vvó7FW&VC¢G'VR¿¢∆„¢7V'67&ñ&W"Á∆‡¢“ì∞ß“ì∞†¶Á˜7BÇ"ˆf6“˜VÁ&Vvó7FW""¬á&W¬&W2í”‚∞¢6ˆÁ7BFˆ∂V‚“7G&ñÊrá&WÊ&ˆGìÚÁFˆ∂V‚«¬""íÁG&ñ“Çì∞¢ñbáFˆ∂V‚í∞¢F"Á&W&RÄ¢%UDDRf6’ˆFWfñ6W24UBVÊ&∆VC”«WFFVEˆC÷FFWFñ÷RÇvÊ˜rrítÑU$RFˆ∂V„”Ú ¢íÁ'V‚áFˆ∂V‚ì∞¢–¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR“ì∞ß“ì∞†¶7ñÊ2gVÊ7Fñˆ‚V&∆ó6Ö7G&ñ7Dvˆ√U6ñvÊ«2Ü÷F6ÜW2í∞¢6ˆÁ7BV∆ñvñ&∆R“Ü÷F6ÜW2«¬µ“íÊfñ«FW"ÜgVÊ7Fñˆ‚Ü÷F6Çí∞¢&WGW&‚÷F6ÉÚÊvˆ√T7&óFW&ñÚÊV∆ñvñ&∆R””“G'VRb`¢÷F6ÉÚÊvˆ√T7&óFW&ñÚÁ∆í””“G'VS∞¢“ì∞†¢f˜"Ü6ˆÁ7B÷F6ÇˆbV∆ñvñ&∆Rí∞¢6ˆÁ7B7&óFW&ñ“÷F6ÇÊvˆ√T7&óFW&ñ∞¢6ˆÁ7BfóáGW&TñB“7G&ñÊrÜ÷F6ÇÊfóáGW&TñB«¬÷F6ÇÊñB«¬""ì∞¢6ˆÁ7BFV““7G&ñÊrÜ7&óFW&ñÁFV“«¬""ì∞¢6ˆÁ7B6ñvÊƒ∂Wí“fóáGW&TñB≤%Ú"∞¢FV“ÊÊ˜&÷∆ó¶RÇ$‰dB"íÁ&W∆6RÇıµ«S3’«S3fe“ˆr¬""ê¢ÁFÙ∆˜vW$66RÇíÁ&W∆6RÇıµÊ◊£”ï“ˆr¬""í∞¢%ˆvˆ√R#∞†¢6ˆÁ7B«&VGï6VÁB“F"Á&W&RÄ¢%4TƒT5B6ñvÊ≈ˆ∂Wíe$Ù“f6’ˆÊ˜Fñfñ6FñˆÁ2tÑU$R6ñvÊ≈ˆ∂Wì”Ú ¢íÊvWBá6ñvÊƒ∂Wíì∞†¢ñbÜ«&VGï6VÁBí6ˆÁFñÁVS∞†¢6ˆÁ7B6ñvÊ¬“∞¢ˆ≥¢G'VR¿¢ñC¢6ñvÊƒ∂Wí¿¢GóS¢&vˆ√U˜FV’ˆ˜fW%ÛÛR"¿¢7FGW3¢&7FófR"¿¢6VÁDC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢fóáGW&TñC¢fóáGW&TñB¿¢÷F6É¢7G&ñÊrÜ÷F6ÇÊÜˆ÷R«¬""í≤"“"≤7G&ñÊrÜ÷F6ÇÊví«¬""í¿¢Üˆ÷S¢÷F6ÇÊÜˆ÷R¿¢vì¢÷F6ÇÊví¿¢FV”¢FV“¿¢˜ˆÊVÁC¢7&óFW&ñÊ˜ˆÊVÁB¿¢6ˆ◊WFóFñˆ„¢÷F6ÇÊ6ˆ◊WFóFñˆ‚«¬""¿¢÷ñÁWFS¢ÁV÷&W"Ü÷F6ÇÊ÷ñÁWFR«¬í¿¢66˜&UˆÜˆ÷S¢ÁV÷&W"Ü÷F6ÇÁ66˜&UˆÜˆ÷R«¬í¿¢66˜&Uˆvì¢ÁV÷&W"Ü÷F6ÇÁ66˜&Uˆví«¬í¿¢ˆFC¢ÁV÷&W"Ü7&óFW&ñÊ∆ófTˆFB«¬í¿¢&WC¢FV“≤"≥√R'WB"¿¢&V6ˆ„¢%F˜W2∆W27&óL:á&W27G&ñ7G26ˆÁBf∆ñL:ó2"¿¢6ÜV6∑3¢7&óFW&ñ¢”∞†¢g2Ê÷∂Fó%7ñÊ2á&WVó&RÇ'FÇ"íÊFó&Ê÷RÑtÙ√UÙƒDU5Eı4ît‰≈ÙdîƒRí¬∞¢&V7W'6ófS¢G'VP¢“ì∞¢g2Áw&óFTfñ∆U7ñÊ2Ä¢tÙ√UÙƒDU5Eı4ît‰≈ÙdîƒR¿¢•4Ù‚Á7G&ñÊvñgíá6ñvÊ¬¬ÁV∆¬¬"ê¢ì∞†¢6ˆÁ7BFWfñ6W2“F"Á&W&RÄ¢%4TƒT5BFˆ∂V‚∆V÷ñ¬«6W76ñˆÂ˜Fˆ∂V‚e$Ù“f6’ˆFWfñ6W2tÑU$RVÊ&∆VC” ¢íÊ∆¬Çì∞†¢6ˆÁ7Bf∆ñDFWfñ6W2“FWfñ6W2Êfñ«FW"ÜgVÊ7Fñˆ‚ÜFWfñ6Rí∞¢6ˆÁ7Bf∆ñB“fW&ñgîf6’7V'67&ñ&W"ÜFWfñ6RÊV÷ñ¬¬FWfñ6RÁ6W76ñˆÂ˜Fˆ∂V‚ì∞¢ñbÇf∆ñBí∞¢F"Á&W&RÄ¢%UDDRf6’ˆFWfñ6W24UBVÊ&∆VC”tÑU$RFˆ∂V„”Ú ¢íÁ'V‚ÜFWfñ6RÁFˆ∂V‚ì∞¢–¢&WGW&‚&ˆˆ∆V‚áf∆ñBì∞¢“ì∞†¢∆WB7V66W746˜VÁB“∞¢∆WBfñ«W&T6˜VÁB“∞†¢ñbáF∆‘fó&V&6T÷W76vñÊrbbf∆ñDFWfñ6W2Ê∆VÊwFÇí∞¢f˜"Ü∆WBñÊFWÇ“≤ñÊFWÇ¬f∆ñDFWfñ6W2Ê∆VÊwFÉ≤ñÊFWÇ≥“Sí∞¢6ˆÁ7B&F6Ç“f∆ñDFWfñ6W2Á6∆ñ6RÜñÊFWÇ¬ñÊFWÇ≤Sì∞†¢6ˆÁ7B&W7ˆÁ6R“vóBF∆‘fó&V&6T÷W76vñÊrÁ6VÊDV6Ñf˜$◊V«Fñ67Bá∞¢Fˆ∂VÁ3¢&F6ÇÊ÷ÜgVÊ7Fñˆ‚ÜFWfñ6Rí≤&WGW&‚FWfñ6RÁFˆ∂V„≤“í¿¢Ê˜Fñfñ6Fñˆ„¢∞¢FóF∆S¢%6ñvÊ¬≥√R'WBf∆ñL:í"¿¢&ˆGì¢FV“≤"WWB÷'VW"+r"∞¢7G&ñÊrÜ÷F6ÇÊÜˆ÷R«¬""í≤"“"∞¢7G&ñÊrÜ÷F6ÇÊví«¬""í≤"+r"∞¢ÁV÷&W"Ü÷F6ÇÊ÷ñÁWFR«¬í≤"r ¢“¿¢FF¢∞¢6ñvÊƒ∂Wì¢6ñvÊƒ∂Wí¿¢fóáGW&TñC¢fóáGW&TñB¿¢FV”¢FV“¿¢&˜WFS¢&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“ˆÊáF÷√˜F#◊ñ6≤ ¢“¿¢ÊG&ˆñC¢∞¢&ñ˜&óGì¢&ÜñvÇ"¿¢Ê˜Fñfñ6Fñˆ„¢∞¢6ÜÊÊVƒñC¢&vˆ√U˜6ñvÊ«2"¿¢6˜VÊC¢&FVfV«B ¢–¢–¢“ì∞†¢7V66W746˜VÁB≥“&W7ˆÁ6RÁ7V66W746˜VÁC∞¢fñ«W&T6˜VÁB≥“&W7ˆÁ6RÊfñ«W&T6˜VÁC∞†¢&W7ˆÁ6RÁ&W7ˆÁ6W2Êf˜$V6ÇÜgVÊ7Fñˆ‚ÜóFV“¬˜6óFñˆ‚í∞¢ñbÜóFV“Á7V66W72í&WGW&„∞†¢6ˆÁ7B6ˆFR“7G&ñÊrÜóFV“ÊW'&˜#ÚÊ6ˆFR«¬""ì∞¢ñbÄ¢6ˆFRÊñÊ6«VFW2Ç'&Vvó7G&Fñˆ‚◊Fˆ∂V‚÷Ê˜B◊&Vvó7FW&VB"í«¿¢6ˆFRÊñÊ6«VFW2Ç&ñÁf∆ñB◊&Vvó7G&Fñˆ‚◊Fˆ∂V‚"ê¢í∞¢F"Á&W&RÄ¢%UDDRf6’ˆFWfñ6W24UBVÊ&∆VC”tÑU$RFˆ∂V„”Ú ¢íÁ'V‚Ü&F6Ö∑˜6óFñˆÂ“ÁFˆ∂V‚ì∞¢–¢“ì∞¢–¢–†¢F"Á&W&RÄ¢$îÂ4U%BîÂDÚf6’ˆÊ˜Fñfñ6FñˆÁ2"∞¢"á6ñvÊ≈ˆ∂Wí∆fóáGW&UˆñB«FV“«7V66W75ˆ6˜VÁB∆fñ«W&Uˆ6˜VÁBí"∞¢%d≈TU2ÉÚ√Ú√Ú√Ú√Úí ¢íÁ'V‚Ä¢6ñvÊƒ∂Wí¿¢fóáGW&TñB¿¢FV“¿¢7V66W746˜VÁB¿¢fñ«W&T6˜VÁ@¢ì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÄ¢%∂f6’“6ñvÊ¬"≤6ñvÊƒ∂Wí∞¢"V&∆ñS¢"≤7V66W746˜VÁB∞¢"7V66W2¬"≤fñ«W&T6˜VÁB≤"V6ÜV2 ¢ì∞¢–ß–††¢ÚÚWFÚ÷7&VFR6ˆFW2F&∆RñbóBFˆW6‚wBWÜó7@ßG'í∞¢6ˆÁ7Bˆ6F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢ˆ6F"ÊWÜV2Ü ¢5$TDRD$ƒRîb‰ıBUÑï5E26ˆFW2Ä¢ñBîÂDTtU"$î‘%í¥UíUDÙî‰5$T‘TÂB¿¢6ˆFRDUÖB‰ıBÂTƒ¬¿¢V÷ñ¬DUÖB‰ıBÂTƒ¬¿¢∆‚DUÖBDTdT≈Bvg&VRr¿¢7FófRîÂDTtU"DTdT≈B¿¢Wáó&W5ˆBDUÖBDTdT≈BÂTƒ¬¿¢7&VFóG5ˆ÷ÇîÂDTtU"DTdT≈B¿¢7&VFóG5˜W6VBîÂDTtU"DTdT≈B¿¢7&VFóG5ˆFFRDUÖBDTdT≈Brr¿¢7&VFVEˆBDUÖBDTdT≈BÜFFWFñ÷RÇvÊ˜rríê¢ì∞¢ì∞¢ÚÚ7G&óUˆ7W7Fˆ÷W%ˆñB¢ÊV6W76ó&R˜W"˜Wg&ó"∆Rg&í˜'Fñ¬FRf7GW&Fñˆ‡¢ÚÚ7G&óRÖÜ6RB¬ÛÇÛ##bí6Á2fˆó"&V6ÜW&6ÜW"∆R6∆ñVÁB"V÷ñ¿¢ÚÚáVÊR&V6ÜW&6ÜR"V÷ñ¬WWB&VÁf˜ñW"«W6ñWW'26∆ñVÁG27G&óRFó7FñÊ7G2í‡¢6ˆÁ7Bˆ6F$6ˆ«2“ˆ6F"Á&W&RÇ%$t‘F&∆UˆñÊfÚÜ6ˆFW2í"íÊ∆¬ÇíÊ÷Ü2”‚2ÊÊ÷Rì∞¢ñbÇˆ6F$6ˆ«2ÊñÊ6«VFW2Ç'7G&óUˆ7W7Fˆ÷W%ˆñB"íí∞¢ˆ6F"ÊWÜV2Ç$≈DU"D$ƒR6ˆFW2DB4Ù≈T‘‚7G&óUˆ7W7Fˆ÷W%ˆñBDUÖBDTdT≈BÂTƒ¬"ì∞¢–¢ÚÚ¶WFˆ‚FR6W76ñˆ‚VÊóVRáVÊR6WV∆R6ˆÊÊWÜñˆ‚7FófR∆fˆó2¬fˆó ¢ÚÚ˜fW&ñgí÷6ˆFRWB˜6W76ñˆ‚÷6ÜV6≤¬FV÷ÊFRFRw&Vr∆R2ÛÇÛ##bí‡¢ñbÇˆ6F$6ˆ«2ÊñÊ6«VFW2Ç'6W76ñˆÂ˜Fˆ∂V‚"íí∞¢ˆ6F"ÊWÜV2Ç$≈DU"D$ƒR6ˆFW2DB4Ù≈T‘‚6W76ñˆÂ˜Fˆ∂V‚DUÖBDTdT≈BÂTƒ¬"ì∞¢–¢ˆ6F"Ê6∆˜6RÇì∞ß“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂6ˆFW2÷F%“ñÊóBW'&˜#¢"¬RÊ÷W76vRì≤–†¢ÚÚ)H)HıE≤6W76ñˆÁ2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶6ˆÁ7BıEıED≈Ù’2“¢c≤ÚÚ6ˆFRf∆&∆R÷ñ‡¶6ˆÁ7BıEı$UTU5EÙ4ÙÙƒDıtÂÙ’2“c≤ÚÚFV÷ÊFRÚV÷ñ¬Ú÷ñÁWFP¶6ˆÁ7BıEÙ‘ÖÙEDT’E2“S≤ÚÚR÷FV∆¬∆R6ˆFRW7Bw&ñ∆∆P¶6ˆÁ7B4U54îÙÂıED≈Ù’2“3¢#B¢3c≤ÚÚ6W76ñˆ‚v∆ó76ÁFR3¶˜W'0†¶6ˆÁ7Bˆ˜G&WVW7D6ˆˆ∆F˜v‚“ÊWr÷Çì≤ÚÚV÷ñ¬”‚Fñ÷W7F◊FW&ÊñW&RFV÷ÊFP†¶gVÊ7Fñˆ‚Ü6Ñ˜GÜ6ˆFRí∞¢&WGW&‚7'óFÚÊ7&VFTÜ6ÇÇ'6Ü#Sb"íÁWFFRÜ6ˆFRíÊFñvW7BÇ&ÜWÇ"ì∞ß–†¢ÚÚ∆F&∆R6ˆFW6fóBFÁ24ÙDU5ÙD%ıDÇÜ6ˆFW2ÊF"í¬2FÁ2D%ıDÄ¢ÚÚáF∆“ÊF"í(	BñÁFW'&ˆvW"6ˆFW6fñ∆6ˆÊÊWÜñˆ‚F&&ñÊ6ó∆RV6Ü˜VP¢ÚÚ6ñ∆VÊ6ñWW6V÷VÁBÇ&ÊÚ7V6ÇF&∆R"í‚6ˆÁ7FFR∆RÛÇÛ##b∆˜'2GR&V÷ñW ¢ÚÚFW7B&VV¬FRˆWFÇ˜fW&ñgí÷˜G‡¶gVÊ7Fñˆ‚∆ˆˆ∑W66˜VÁD'îV÷ñ¬ÜV÷ñ¬í∞¢G'í∞¢6ˆÁ7B6F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜r“6F"Á&W&RÄ¢%4TƒT5B∆‚¬Wáó&W5ˆB¬7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFVEˆBe$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“ı$DU"%í&˜vñBDU42ƒî‘ïB ¢íÊvWBÜV÷ñ¬ì∞¢6F"Ê6∆˜6RÇì∞¢&WGW&‚&˜r«¬ÁV∆√∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂˜G“∆ˆˆ∑W66˜VÁD'îV÷ñ√¢"¬RÊ÷W76vRì∞¢&WGW&‚ÁV∆√∞¢–ß–†¢ÚÚ7FGWB6ˆ◊∆WBÖÜ6R2í¢6ˆÁG&ó&V÷VÁB∆ˆˆ∑W66˜VÁD'îV÷ñ¬áVíÊP¢ÚÚ&Vv&FRVR∆W26ˆFW27Fñg2í¬6V∆∆R÷6í&Vv&FRW76í∆W26ˆFW2FW67FófW0¢ÚÚ˜W"Fó7FñÊwVW"&¶÷ó2&ˆÊÊR"FR'&W6ñ∆ñR"(	BÊV6W76ó&R˜W"¬vffñ6ÜvP¢ÚÚGRg&í7FGWBFÁ2ˆF6Ü&ˆ&B‡¢ÚÚV‚6ˆ◊FRw&GVóBW"Ü¶÷ó2FR6ˆFR¬¶÷ó2ñRí‚vV7VÊR∆ñvÊRFÁ0¢ÚÚ6ˆFW2““6Á2&W∆í¬$÷V÷'&RFWVó2"&W7FóBfñFR7W"∆RF6Ü&ˆ&Bá6ñvÊ∆P¢ÚÚ"w&Vr∆R"ÛÇÛ##bí‚∆&V÷ñW&R6W76ñˆ‚FR6ˆÊÊWÜñˆ‚W7B∆R÷Vñ∆∆WW ¢ÚÚ&˜áíFó7ˆÊñ&∆R¢˜W"V‚6ˆ◊FRıE÷ˆÊ«í¬∆R&V÷ñW"∆ˆvñ‚U5B∆7&VFñˆ‡¢ÚÚGR6ˆ◊FR‡¶gVÊ7Fñˆ‚fó'7E6VV‰f∆∆&6≤ÜV÷ñ¬í∞¢G'í∞¢6ˆÁ7B&˜r“F"Á&W&RÇ%4TƒT5B‘î‚Ü7&VFVEˆBí2fó'7E˜6VV‚e$Ù“6W76ñˆÁ2tÑU$RV÷ñ¬“Ú"íÊvWBÜV÷ñ¬ì∞¢&WGW&‚&˜sÚÊfó'7E˜6VV‚«¬ÁV∆√∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂˜G“fó'7E6VV‰f∆∆&6≥¢"¬RÊ÷W76vRì∞¢&WGW&‚ÁV∆√∞¢–ß–†¶gVÊ7Fñˆ‚∆ˆˆ∑WgV∆ƒ66˜VÁE7FGW2ÜV÷ñ¬í∞¢G'í∞¢6ˆÁ7B6F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜r“6F"Á&W&RÄ¢%4TƒT5B∆‚¬7FófR¬Wáó&W5ˆB¬7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFVEˆBe$Ù“6ˆFW2tÑU$RV÷ñ¬“Úı$DU"%í&˜vñBDU42ƒî‘ïB ¢íÊvWBÜV÷ñ¬ì∞¢6F"Ê6∆˜6RÇì∞¢ñbÇ&˜rí&WGW&‚≤7FGW3¢&g&VR"¬∆„¢&g&VR"¬Wáó&W5ˆC¢ÁV∆¬¬7&VFóG5ˆ÷É¢ÁV∆¬¬7&VFóG5˜W6VC¢ÁV∆¬¬7&VFVEˆC¢fó'7E6VV‰f∆∆&6≤ÜV÷ñ¬í”∞¢∆WB7FGW3∞¢ñbÇ&˜rÊ7FófRí7FGW2“&6Ê6V∆∆VB#∞¢V«6Rñbá&˜rÊWáó&W5ˆBbbÊWrFFRá&˜rÊWáó&W5ˆBí¬ÊWrFFRÇíí7FGW2“&Wáó&VB#∞¢V«6R7FGW2“&7FófR#∞¢&WGW&‚≤7FGW2¬∆„¢&˜rÁ∆‚¬Wáó&W5ˆC¢&˜rÊWáó&W5ˆB¬7&VFóG5ˆ÷É¢&˜rÊ7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VC¢&˜rÊ7&VFóG5˜W6VB¬7&VFVEˆC¢&˜rÊ7&VFVEˆB«¬fó'7E6VV‰f∆∆&6≤ÜV÷ñ¬í”∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂˜G“∆ˆˆ∑WgV∆ƒ66˜VÁE7FGW3¢"¬RÊ÷W76vRì∞¢&WGW&‚≤7FGW3¢&g&VR"¬∆„¢&g&VR"¬Wáó&W5ˆC¢ÁV∆¬¬7&VFóG5ˆ÷É¢ÁV∆¬¬7&VFóG5˜W6VC¢ÁV∆¬¬7&VFVEˆC¢fó'7E6VV‰f∆∆&6≤ÜV÷ñ¬í”∞¢–ß–†¶Á˜7BÇ"ˆWFÇ˜&WVW7B÷˜G"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7BV÷ñ¬“7G&ñÊrá&WÊ&ˆGìÚÊV÷ñ¬«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢ñbÇV÷ñ¬«¬ıÂµÂ«4“¥µÂ«4“µ¬ÂµÂ«4“≤BÚÁFW7BÜV÷ñ¬íí∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V÷ñ¬ñÁf∆ñFR"“ì∞¢–¢6ˆÁ7BÊ˜r“FFRÊÊ˜rÇì∞¢6ˆÁ7B∆7B“ˆ˜G&WVW7D6ˆˆ∆F˜v‚ÊvWBÜV÷ñ¬í«¬∞¢ñbÜÊ˜r“∆7B¬ıEı$UTU5EÙ4ÙÙƒDıtÂÙ’2í∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$÷W&6íFRFñVÁFW"fÁBFR&VFV÷ÊFW"V‚6ˆFR‚"“ì∞¢–¢ˆ˜G&WVW7D6ˆˆ∆F˜v‚Á6WBÜV÷ñ¬¬Ê˜rì∞†¢ÚÚ&WˆÁ6Rfˆ∆ˆÁFó&V÷VÁBñFVÁFóVRRwV‚6ˆ◊FRWÜó7FR˜RÊˆ‚(	BÊR¶÷ó0¢ÚÚ&WfV∆W"V&∆óVV÷VÁB¬vWÜó7FVÊ6RBwV‚V÷ñ¬ÜFV÷ÊFRWá∆ñ6óFRÜ6R"í‡¢G'í∞¢6ˆÁ7B6ˆFR“7G&ñÊrÜ7'óFÚÁ&ÊFˆ‘ñÁBÉ¬ííÁE7F'BÉb¬#"ì∞¢6ˆÁ7BWáó&W4B“ÊWrFFRÜÊ˜r≤ıEıED≈Ù’2íÁFÙï4ı7G&ñÊrÇì∞¢F"Á&W&RÇ$îÂ4U%BîÂDÚ˜Gˆ6ˆFW2ÜV÷ñ¬¬6ˆFUˆÜ6Ç¬Wáó&W5ˆBíd≈TU2ÉÚ√Ú√Úí"ê¢Á'V‚ÜV÷ñ¬¬Ü6Ñ˜GÜ6ˆFRí¬Wáó&W4Bì∞¢ÚÚW&vR∆VvW&RFW2fñWWÇ6ˆFW2W&ñ÷W2Êˆ‚WFñ∆ó6W2˜W"6WBV÷ñ¬‡¢F"Á&W&RÇ$DTƒUDRe$Ù“˜Gˆ6ˆFW2tÑU$RV÷ñ¬“Ú‰BW6VB“‰BWáó&W5ˆB¬FFWFñ÷RÇvÊ˜rrí"íÁ'V‚ÜV÷ñ¬ì∞†¢ñbÑ%$UdıÙïÙ¥Uíí∞¢6ˆÁ7BáF÷¬“∆Fób7Gñ∆S“&fˆÁB÷f÷ñ«ìß6Á2◊6W&ñc∂÷Ç◊vñGFÉ£CÉÉ∂÷&vñ„£WFÛ∑FFñÊs£#GÇ#‡¢∆É"7Gñ∆S“&÷&vñ‚÷&˜GFˆ”£GÇ#ÂFˆ‚6ˆFRFR6ˆÊÊWÜñˆ‚F˜W4∆W4÷F6á3¬ˆÉ#‡¢«7Gñ∆S“&fˆÁB◊6ó¶S£3GÉ∂fˆÁB◊vVñváC£ì∂∆WGFW"◊76ñÊs¢„&V”∂6ˆ∆˜#¢3FcCfSR#‚G∂6ˆFW”¬˜‡¢«7Gñ∆S“&6ˆ∆˜#¢3SSR#‰6R6ˆFRWáó&RFÁ2÷ñÁWFW2WBÊRWWB:ßG&RWFñ∆ó<:íRwVÊR6WV∆Rfˆó2„¬˜‡¢«7Gñ∆S“&6ˆ∆˜#¢3ììì∂fˆÁB◊6ó¶S£'Ç#Â6íGR‚vW22:¬v˜&ñvñÊRFR6WGFRFV÷ÊFR¬ñvÊ˜&R6ñ◊∆V÷VÁB6WBV÷ñ¬„¬˜‡¢¬ˆFócÊ∞¢'&Wfı6VÊDV÷ñ¬ÜV÷ñ¬¬G∂6ˆFW“(	BFˆ‚6ˆFRFR6ˆÊÊWÜñˆ‚F˜W4∆W4÷F6á6¬áF÷¬¬≤7&óFñ6√¢G'VR“ê¢Ê6F6ÇÜR”‚6ˆÁ6ˆ∆RÊW'&˜"Ç%∂˜G“VÁfˆíV÷ñ√¢"¬RÊ÷W76vRíì∞¢–¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂˜G“6ˆFRFV÷ÊL:í˜W"G∂V÷ñ«÷ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂˜G“&WVW7B÷˜G¢"¬RÊ÷W76vRì∞¢–¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷W76vS¢%6í6R6ˆ◊FRWÜó7FR¬V‚6ˆFRfñVÁBB|:ßG&RVÁf˜ú:í"V÷ñ¬‚"“ì∞ß“ì∞†¶Á˜7BÇ"ˆWFÇ˜fW&ñgí÷˜G"¬á&W¬&W2í”‚∞¢6ˆÁ7BV÷ñ¬“7G&ñÊrá&WÊ&ˆGìÚÊV÷ñ¬«¬""íÁG&ñ“ÇíÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7B6ˆFR“7G&ñÊrá&WÊ&ˆGìÚÊ6ˆFR«¬""íÁG&ñ“Çì∞¢ñbÇV÷ñ¬«¬6ˆFRí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V÷ñ¬WB6ˆFR&WVó2"“ì∞†¢G'í∞¢6ˆÁ7B&˜r“F"Á&W&RÄ¢%4TƒT5B¢e$Ù“˜Gˆ6ˆFW2tÑU$RV÷ñ¬“Ú‰BW6VB“ı$DU"%íñBDU42ƒî‘ïB ¢íÊvWBÜV÷ñ¬ì∞¢ÚÚ÷V÷R÷W76vRvVÊW&óVRV‚62BvV6ÜV2¬VV∆∆RRvV‚6ˆóB∆&ó6ˆ‡¢ÚÚÜ6ˆFRñÊWÜó7FÁB¬Wáó&R¬FV¶WFñ∆ó6R¬˜R÷Wfó6Rf∆WW"í(	BWfóFRFP¢ÚÚ∆ó76W"FWfñÊW"6íV‚V÷ñ¬V‚6ˆ◊FR˜RÊˆ‚‡¢6ˆÁ7BvVÊW&ñ4W'&˜"“$6ˆFRñÁf∆ñFR˜RWáó,:í‚#∞¢ñbÇ&˜rí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢vVÊW&ñ4W'&˜"“ì∞¢ñbÜÊWrFFRá&˜rÊWáó&W5ˆBí¬ÊWrFFRÇíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢vVÊW&ñ4W'&˜"“ì∞¢ñbá&˜rÊGFV◊G2„“ıEÙ‘ÖÙEDT’E2í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%G&˜FRFVÁFFófW2¬&VFV÷ÊFRV‚6ˆFR‚"“ì∞†¢ñbÜÜ6Ñ˜GÜ6ˆFRí”“&˜rÊ6ˆFUˆÜ6Çí∞¢F"Á&W&RÇ%UDDR˜Gˆ6ˆFW24UBGFV◊G2“GFV◊G2≤tÑU$RñB“Ú"íÁ'V‚á&˜rÊñBì∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢vVÊW&ñ4W'&˜"“ì∞¢–†¢F"Á&W&RÇ%UDDR˜Gˆ6ˆFW24UBW6VB“tÑU$RñB“Ú"íÁ'V‚á&˜rÊñBì∞†¢ÚÚVÊR6WV∆R6ˆÊÊWÜñˆ‚7FófR∆fˆó2"6ˆ◊FRÜFV÷ÊFRFRw&Vr∆P¢ÚÚ2ÛÇÛ##b¬&W2'FvR7W7V7FRGR6ˆFRGRg&W&Rí¢F˜WFRÊ˜WfV∆∆P¢ÚÚ6ˆÊÊWÜñˆ‚ñÁf∆ñFRñ÷÷VFñFV÷VÁB∆W26W76ñˆÁ2&V6VFVÁFW2FR6R÷V÷P¢ÚÚV÷ñ¬‚V‚&Vñ¬FV¶6ˆÊÊV7FR6RfóB&V¶WFW"R&ˆ6Üñ‚V¿¢ÚÚWFÜVÁFñfñRá&WVó&U6W76ñˆ‚ÊRG&˜WfR«W26ˆ‚Fˆ∂V‚í‡¢F"Á&W&RÇ$DTƒUDRe$Ù“6W76ñˆÁ2tÑU$RV÷ñ¬“Ú"íÁ'V‚ÜV÷ñ¬ì∞†¢6ˆÁ7BFˆ∂V‚“7'óFÚÁ&ÊFˆ‘'óFW2É3"íÁFı7G&ñÊrÇ&ÜWÇ"ì∞¢6ˆÁ7BWáó&W4B“ÊWrFFRÑFFRÊÊ˜rÇí≤4U54îÙÂıED≈Ù’2íÁFÙï4ı7G&ñÊrÇì∞¢F"Á&W&RÇ$îÂ4U%BîÂDÚ6W76ñˆÁ2áFˆ∂V‚¬V÷ñ¬¬Wáó&W5ˆBíd≈TU2ÉÚ√Ú√Úí"íÁ'V‚áFˆ∂V‚¬V÷ñ¬¬Wáó&W4Bì∞†¢ÚÚ∆‚7GVV¬¢6˜W&6RFRfW&óFR“F&∆R6ˆFW2¬∆ñ÷VÁFVR"∆RvV&Üˆˆ∞¢ÚÚ7G&óR(	B∆RÊ˜WfVR7ó7FV÷RFR6ˆÊÊWÜñˆ‚ÊR7&VRÊíÊRFWfñÊRV7V‚G&ˆóB‡¢6ˆÁ7B66˜VÁB“∆ˆˆ∑W66˜VÁD'îV÷ñ¬ÜV÷ñ¬ì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂˜G“6ˆÊÊWÜñˆ‚,:óW76ñS¢G∂V÷ñ«÷ì∞¢'&WfÙFD6ˆÁF7BÜV÷ñ¬¬Ü66˜VÁCÚÁ∆‚«¬&g&VR"íÁFıWW$66RÇí¬$e""¬ÁV∆¬¬∞¢ƒ5EÙƒÙtîÂÙC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“íÊ6F6ÇÇÇí”‚∑“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬Fˆ∂V‚¬V÷ñ¬¬∆„¢66˜VÁCÚÁ∆‚«¬&g&VR"“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂˜G“fW&ñgí÷˜G¢"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"6W'fWW""“ì∞¢–ß“ì∞†¶gVÊ7Fñˆ‚&WVó&U6W76ñˆ‚á&W¬&W2¬ÊWáBí∞¢6ˆÁ7BWFÇ“&WÊÜVFW'2ÊWFÜ˜&ó¶Fñˆ‚«¬"#∞¢6ˆÁ7BFˆ∂V‚“WFÇÁ7F'G5vóFÇÇ$&V&W""íÚWFÇÁ6∆ñ6RÉrí¢7G&ñÊrá&WÁVW'íÁ6W76ñˆ‚«¬&WÊ&ˆGìÚÁ6W76ñˆ‚«¬""ì∞¢ñbÇFˆ∂V‚í&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚6ˆÊÊV7L:í"“ì∞¢G'í∞¢6ˆÁ7B&˜r“F"Á&W&RÇ%4TƒT5B¢e$Ù“6W76ñˆÁ2tÑU$RFˆ∂V‚“Ú"íÊvWBáFˆ∂V‚ì∞¢ñbÇ&˜r«¬ÊWrFFRá&˜rÊWáó&W5ˆBí¬ÊWrFFRÇíí&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%6W76ñˆ‚Wáó,:ñR"“ì∞¢F"Á&W&RÇ%UDDR6W76ñˆÁ24UB∆7E˜6VVÂˆB“FFWFñ÷RÇvÊ˜rrítÑU$RFˆ∂V‚“Ú"íÁ'V‚áFˆ∂V‚ì∞¢&WÁ6W76ñˆ‚“≤V÷ñ√¢&˜rÊV÷ñ¬¬Fˆ∂V‚”∞¢ÊWáBÇì∞¢“6F6ÇÜRí∞¢&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%6W76ñˆ‚ñÁf∆ñFR"“ì∞¢–ß–†¶Á˜7BÇ"ˆWFÇˆ∆ˆv˜WB"¬á&W¬&W2í”‚∞¢6ˆÁ7BWFÇ“&WÊÜVFW'2ÊWFÜ˜&ó¶Fñˆ‚«¬"#∞¢6ˆÁ7BFˆ∂V‚“WFÇÁ7F'G5vóFÇÇ$&V&W""íÚWFÇÁ6∆ñ6RÉrí¢7G&ñÊrá&WÊ&ˆGìÚÁ6W76ñˆ‚«¬""ì∞¢ñbáFˆ∂V‚í∞¢G'í≤F"Á&W&RÇ$DTƒUDRe$Ù“6W76ñˆÁ2tÑU$RFˆ∂V‚“Ú"íÁ'V‚áFˆ∂V‚ì≤“6F6ÇÜRí≤Ú¢&ñV‚fó&R¢Ú–¢–¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR“ì∞ß“ì∞†¶ÊvWBÇ"ˆWFÇ˜6W76ñˆ‚"¬&WVó&U6W76ñˆ‚¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B66˜VÁB“∆ˆˆ∑W66˜VÁD'îV÷ñ¬á&WÁ6W76ñˆ‚ÊV÷ñ¬ì∞¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¬V÷ñ√¢&WÁ6W76ñˆ‚ÊV÷ñ¬¿¢∆„¢66˜VÁCÚÁ∆‚«¬&g&VR"¿¢Wáó&W5ˆC¢66˜VÁCÚÊWáó&W5ˆB«¬ÁV∆¬¿¢7&VFóG5ˆ÷É¢66˜VÁCÚÊ7&VFóG5ˆ÷ÇÛÚÁV∆¬¿¢7&VFóG5˜W6VC¢66˜VÁCÚÊ7&VFóG5˜W6VBÛÚÁV∆¬¿¢7&VFVEˆC¢66˜VÁCÚÊ7&VFVEˆB«¬ÁV∆¬¿¢“ì∞¢“6F6ÇÜRí∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"6W'fWW""“ì∞¢–ß“ì∞†¢ÚÚ)H)HÜ6R2¢g&í6ˆÁFVÁRGRF6Ü&ˆ&B6∆ñVÁB)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆWFÇˆF6Ü&ˆ&B÷FF"¬&WVó&U6W76ñˆ‚¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BV÷ñ¬“&WÁ6W76ñˆ‚ÊV÷ñ√∞¢6ˆÁ7B66˜VÁB“∆ˆˆ∑WgV∆ƒ66˜VÁE7FGW2ÜV÷ñ¬ì∞¢6ˆÁ7Bó5ñB“≤'7FÊF&B"¬'&V÷óV“"¬'fó"¬&V∆óFR%“ÊñÊ6«VFW2Ü66˜VÁBÁ∆‚íbb66˜VÁBÁ7FGW2””“&7FófR#∞†¢ÚÚFW&ÊñW'2&W7V«FG2¢VÊóVV÷VÁB6í&ˆÊÊV÷VÁB7Fñb(	B¶÷ó2FR&WB˜&ó6ˆ‡¢ÚÚVÁf˜ñRRÊfñvFWW"˜W"V‚6ˆ◊FRÊˆ‚WF˜&ó6R¬÷V÷R÷7VRfó7VV∆∆V÷VÁ@¢ÚÚá&Vv∆RWá∆ñ6óFRFRw&Vr¬Ü6R2í‚6WVñ¬FR6ˆÊfñÊ6RñFVÁFóVR6V«Vê¢ÚÚVíFV6∆VÊ6ÜR&VV∆∆V÷VÁBV‚6ñvÊ¬ÜvWE6ñvÊƒf∆ˆ˜"Çíí¬2V‚6WVñ¬FñffW&VÁ@¢ÚÚ"∆ñW"(	B∆W2∆ñW'26ˆÁB7V◊V∆Fñg27W"V‚6ˆ6∆R6ˆ÷◊V‚‡¢∆WB&V6VÁB“µ”∞¢ñbÜó5ñBí∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BÜˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬˜WF6ˆ÷R¿¢fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬Ê«ó6VEˆ@¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rí‰B6ˆÊfñFVÊ6R„“¢ı$DU"%íÊ«ó6VEˆBDU42ƒî‘ïB ¢íÊ∆¬ÜvWE6ñvÊƒf∆ˆ˜"Çíì∞¢&V6VÁB“FVGWTÊ«ó6W4'î÷F6Çá&˜w2íÁ6∆ñ6RÉ¬íÊ÷á"”‚á∞¢Üˆ÷S¢"ÊÜˆ÷R¬vì¢"Êví¬6ˆ◊WFóFñˆ„¢"Ê6ˆ◊WFóFñˆ‚¬7˜'C¢"Á7˜'B¿¢&WC¢"Ê&W7Eˆ&WB¬6ˆÊfñFVÊ6S¢"Ê6ˆÊfñFVÊ6R¬˜WF6ˆ÷S¢"Ê˜WF6ˆ÷R¿¢66˜&S¢á"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬bb"ÊfñÊ≈˜66˜&Uˆví“ÁV∆¬íÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢ÁV∆¬¿¢Ê«ó6VEˆC¢"ÊÊ«ó6VEˆB¿¢“íì∞¢–†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¬V÷ñ¬¿¢∆„¢66˜VÁBÁ∆‚¬7FGW3¢66˜VÁBÁ7FGW2¿¢Wáó&W5ˆC¢66˜VÁBÊWáó&W5ˆB¬7&VFVEˆC¢66˜VÁBÊ7&VFVEˆB¿¢7&VFóG5ˆ÷É¢66˜VÁBÊ7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VC¢66˜VÁBÊ7&VFóG5˜W6VB¿¢&V6VÁB¿¢“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂F6Ü&ˆ&B÷FF“"¬RÊ÷W76vRì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"6W'fWW""“ì∞¢–ß“ì∞†¢ÚÚ∆ñV‚FV∆Vw&“vVÊW&R∆FV÷ÊFR¬VÊóVV÷VÁB˜W"V‚&ˆÊÊV÷VÁB7Fñb(	@¢ÚÚ¶÷ó2&R÷vVÊW&RÊíWá˜6RVíVR6R6ˆóBBvWG&R‡¶ÊvWBÇ"ˆWFÇ˜FV∆Vw&“÷∆ñÊ≤"¬&WVó&U6W76ñˆ‚¬7ñÊ2á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B66˜VÁB“∆ˆˆ∑WgV∆ƒ66˜VÁE7FGW2á&WÁ6W76ñˆ‚ÊV÷ñ¬ì∞¢6ˆÁ7Bó5ñB“≤'7FÊF&B"¬'&V÷óV“"¬'fó"¬&V∆óFR%“ÊñÊ6«VFW2Ü66˜VÁBÁ∆‚íbb66˜VÁBÁ7FGW2””“&7FófR#∞¢ñbÇó5ñBí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$&ˆÊÊV÷VÁB7Fñb&WVó2‚"“ì∞¢6ˆÁ7B∆ñÊ≤“vóB7&VFU&V÷óV‘ñÁfóFT∆ñÊ≤á&WÁ6W76ñˆ‚ÊV÷ñ¬¬66˜VÁBÁ∆‚ì∞¢ñbÇ∆ñÊ≤í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$∆ñV‚ñÊFó7ˆÊñ&∆R˜W"∆R÷ˆ÷VÁB¬,:ñW76ñR«W2F&B‚"“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬∆ñÊ≤“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑FV∆Vw&“÷∆ñÊµ“"¬RÊ÷W76vRì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"6W'fWW""“ì∞¢–ß“ì∞†¢ÚÚ∆ñV‚FR'&ñÊvRá6W76ñˆ‚ıEí(	B∆R7ó7FV÷RWÜó7FóBFV¶Ç˜&VfW'&¬ˆvWB÷∆ñÊ≤ê¢ÚÚ÷ó2WÜñvVóB¬vÊ6ñV‚V÷ñ¬∂6ˆFR&WWFñ∆ó6&∆R¬ñÊ6ˆ◊Fñ&∆RfV2∆P¢ÚÚF6Ü&ˆ&BFW6˜&÷ó2RıE˜6W76ñˆ‚ÖÜ6R"Û2í‚FV÷ÊFRFRw&Vr∆P¢ÚÚÛÇÛ##b¢&VÊG&R∆R'&ñÊvRfó6ñ&∆R¬2FRÊ˜WfVR7ó7FV÷RFR&V6ˆ◊VÁ6R‡¶ÊvWBÇ"ˆWFÇ˜&VfW'&¬÷∆ñÊ≤"¬&WVó&U6W76ñˆ‚¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BV÷ñ¬“&WÁ6W76ñˆ‚ÊV÷ñ√∞¢6ˆÁ7B&Vd6ˆFR“vWD˜$7&VFU&Vd6ˆFRÜV÷ñ¬ì∞¢6ˆÁ7B∆ñÊ≤“áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“˜&VbÚG∑&Vd6ˆFW÷∞¢6ˆÁ7BFF“∆ˆE&VfW'&«2Çì∞¢6ˆÁ7B&Vb“FFÁ&Vg5∑&Vd6ˆFU“«¬∑”∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&Vd6ˆFR¬∆ñÊ≤¬&VfW'&«3¢á&VbÁ&VfW'&«2«¬µ“íÊ∆VÊwFÇ¬÷ˆÁFá4V&ÊVC¢&VbÊ÷ˆÁFá4V&ÊVB«¬“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑&VfW'&¬÷∆ñÊµ“"¬RÊ÷W76vRì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"6W'fWW""“ì∞¢–ß“ì∞†¢ÚÚg&í˜'Fñ¬FRf7GW&Fñˆ‚7G&óRÖÜ6RB¬ÛÇÛ##bí(	B&V◊∆6R∆P¢ÚÚ÷ñ«FÛ¢∆6VÜˆ∆FW"GRF6Ü&ˆ&B‚¬wWFñ∆ó6FWW"ívW&RˆÊÁV∆Rˆ6ÜÊvRFP¢ÚÚ6'FR«Ví÷÷V÷R¬6˜FR7G&óR¬6Á2Rvˆ‚óB÷ÊóV∆W"VˆíVR6R6ˆóB‡¶Á˜7BÇ"ˆWFÇˆ&ñ∆∆ñÊr◊˜'F¬"¬&WVó&U6W76ñˆ‚¬7ñÊ2á&W¬&W2í”‚∞¢G'í∞¢ñbÇ5E$ïUı4T5$UEÙ¥Uíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6ˆÊfñwW&Fñˆ‚7G&óR÷ÁVÁFR"“ì∞¢6ˆÁ7B6F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜r“6F"Á&W&RÇ%4TƒT5B7G&óUˆ7W7Fˆ÷W%ˆñBe$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7G&óUˆ7W7Fˆ÷W%ˆñBï2‰ıBÂTƒ¬ı$DU"%í&˜vñBDU42ƒî‘ïB"íÊvWBá&WÁ6W76ñˆ‚ÊV÷ñ¬ì∞¢6F"Ê6∆˜6RÇì∞¢ñbÇ&˜r«¬&˜rÁ7G&óUˆ7W7Fˆ÷W%ˆñBí∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V7V‚&ˆÊÊV÷VÁB7G&óRG&˜WfR˜W"6R6ˆ◊FR‚6ˆÁF7FR÷Ê˜W26íGRVÁ6W2VR2vW7BVÊRW'&WW"‚"“ì∞¢–¢6ˆÁ7B7G&óSR“&WVó&RÇ'7G&óR"ì∞¢6ˆÁ7B7G&óSR“7G&óSRÖ5E$ïUı4T5$UEÙ¥Uíì∞¢6ˆÁ7B˜'F≈6W76ñˆ‚“vóB7G&óSRÊ&ñ∆∆ñÊu˜'F¬Á6W76ñˆÁ2Ê7&VFRá∞¢7W7Fˆ÷W#¢&˜rÁ7G&óUˆ7W7Fˆ÷W%ˆñB¿¢&WGW&Â˜W&√¢&áGG3¢Ú˜F˜W6∆W6÷F6á2Ê6ˆ“ˆF6Ü&ˆ&B"¿¢“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬W&√¢˜'F≈6W76ñˆ‚ÁW&¬“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂&ñ∆∆ñÊr◊˜'F≈“"¬RÊ÷W76vRì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"6W'fWW""“ì∞¢–ß“ì∞†¶Á˜7BÇ"˜fW&ñgí÷6ˆFR"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬∆ˆvñ‚““&WÊ&ˆGí«¬∑”∞¢ñbÇV÷ñ¬«¬6ˆFRí&WGW&‚&W2Êß6ˆ‚á≤f∆ñC¢f«6R¬W'&˜#¢$V÷ñ¬WB6ˆFR&WVó2"“ì∞†¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜r“6ˆFW4F"Á&W&RÄ¢%4TƒT5B¢e$Ù“6ˆFW2tÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú‰B7FófR“ ¢íÊvWBÜ6ˆFRÁFıWW$66RÇíÁG&ñ“Çí¬V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢6ˆFW4F"Ê6∆˜6RÇì∞†¢ñbÇ&˜rí&WGW&‚&W2Êß6ˆ‚á≤f∆ñC¢f«6R¬W'&˜#¢$6ˆFR˜RV÷ñ¬ñÁf∆ñFR"“ì∞†¢ñbá&˜rÊWáó&W5ˆBbbÊWrFFRá&˜rÊWáó&W5ˆBí¬ÊWrFFRÇíí∞¢&WGW&‚&W2Êß6ˆ‚á≤f∆ñC¢f«6R¬W'&˜#¢$6ˆFRWáó,:í"“ì∞¢–†¢6ˆÁ7B7&VFóG5ˆ∆VgB“7&VFóG4∆VgDf˜%∆‚á&˜rÁ∆‚¬&˜rÊ7&VFóG5ˆ÷Ç¬&˜rÊ7&VFóG5˜W6VB¬&˜rÊ7&VFóG5ˆFFRì∞†¢ÚÚVÊR6WV∆R6ˆÊÊWÜñˆ‚7FófR∆fˆó2ÜFV÷ÊFRFRw&Vr∆R2ÛÇÛ##bí†¢ÚÚVÊRe$îR6ˆÊÊWÜñˆ‚Ü∆ˆvñ„ßG'VR¬VÁf˜ñRVÊóVV÷VÁB"∆Rf˜&◊V∆ó&P¢ÚÚ$66VFW""¬¶÷ó2"∆W2V«2FR6ñ◊∆R&g&ñ6Üó76V÷VÁBFR7&VFóG0¢ÚÚ6ˆ÷÷R&Vg&W6Ñ7&VFóG2ÇíívVÊW&RV‚Ê˜WfVR¶WFˆ‚FR6W76ñˆ‚WB¬vV7&ó@¢ÚÚV‚&6R¬ñÁf∆ñFÁBñ÷÷VFñFV÷VÁB6V«VíFRF˜WBWG&R&Vñ¬FV¶¢ÚÚ6ˆÊÊV7FRfV2∆R÷V÷R6ˆFR‚6Á26Rf∆r¬˜fW&ñgí÷6ˆFRv&FR6ˆ‡¢ÚÚ6ˆ◊˜'FV÷VÁBBv˜&ñvñÊRÜV7VÊR&˜FFñˆ‚í˜W"ÊR2FV6ˆÊÊV7FW"∆W0¢ÚÚvVÁ2F˜WB6WV«26ÜVR&g&ñ6Üó76V÷VÁBWFˆ÷FóVR‡¢∆WB6W76ñˆÂFˆ∂V‚“ÁV∆√∞¢ñbÜ∆ˆvñ‚””“G'VRí∞¢6W76ñˆÂFˆ∂V‚“7'óFÚÁ&ÊFˆ‘'óFW2É#BíÁFı7G&ñÊrÇ&ÜWÇ"ì∞¢G'í∞¢6ˆÁ7B6ˆFW4F'r“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6ˆFW4F'rÁ&W&RÇ%UDDR6ˆFW24UB6W76ñˆÂ˜Fˆ∂V‚“ÚtÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú"ê¢Á'V‚á6W76ñˆÂFˆ∂V‚¬&˜rÊ6ˆFR¬&˜rÊV÷ñ¬ì∞¢6ˆFW4F'rÊ6∆˜6RÇì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑fW&ñgí÷6ˆFU“6W76ñˆÂ˜Fˆ∂V„¢"¬RÊ÷W76vRì≤–¢ÚÚV‚6W76ñˆÂ˜Fˆ∂V‚FV¶&W6VÁBfÁB6WGFR6ˆÊÊWÜñˆ‚“VV«RwV‚WFó@¢ÚÚFV¶6ˆÊÊV7FRfV26R÷V÷R6ˆFR““g&ñR&WWfRFR'FvR¬2ßW7FP¢ÚÚVÊR&V6ˆÊÊWÜñˆ‚Ê˜&÷∆Rá&V÷ñW&R6ˆÊÊWÜñˆ‚“6W76ñˆÂ˜Fˆ∂V‚ÂTƒ¬í‡¢ñbá&˜rÁ6W76ñˆÂ˜Fˆ∂V‚í∞¢G'í∞¢F"Á&W&RÇ$îÂ4U%BîÂDÚ6W76ñˆÂˆ∂ñ6∑2ÜV÷ñ¬¬6ˆFRíd≈TU2ÉÚ¬Úí"íÁ'V‚á&˜rÊV÷ñ¬¬&˜rÊ6ˆFRì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑6W76ñˆ‚÷∂ñ6µ“6ˆÊÊWÜñˆ‚6ˆÊ7W'&VÁFRFWFV7FVS¢G∑&˜rÊV÷ñ«“ÇG∑&˜rÊ6ˆFW“ñì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑6W76ñˆ‚÷∂ñ6µ“∆ˆs¢"¬RÊ÷W76vRì≤–¢ÚÚ&V¬WFˆ÷FóVR6ÜVR'FvRFWFV7FRá2ßW7FR∆R&V÷ñW"í(	@¢ÚÚFV÷ÊFRFRw&Vr∆R2ÛÇÛ##b¢&WfVÊó"∆RFóGV∆ó&RGR6ˆ◊FRVP¢ÚÚ∆R'FvRW7BñÁFW&FóB¬6˜W2&ó7VRFR&ÊÊó76V÷VÁB‡¢ñbÑ%$UdıÙïÙ¥Uíí∞¢'&Wfı6VÊDV÷ñ¬Ä¢&˜rÊV÷ñ¬¿¢.)™˚àÚ6ˆÊÊWÜñˆ‚'F|:ñRL:óFV7L:ñR7W"Fˆ‚6ˆ◊FRF˜W4∆W4÷F6á2"¿¢«‰&ˆÊ¶˜W"√¬˜‡¢«‰Ê˜W2fˆÁ2L:óFV7L:íVÊRÊ˜WfV∆∆R6ˆÊÊWÜñˆ‚:Fˆ‚6ˆ◊FR∆˜'2RwVÊR6W76ñˆ‚:óFóBL:ñ¨:7FófRñ∆∆WW'2„¬˜‡¢«„«7G&ˆÊs‰∆R'FvRBvñFVÁFñfñÁG2ÜV÷ñ¬≤6ˆFRíVÁG&R«W6ñWW'2W'6ˆÊÊW2‚vW7B2WF˜&ó<:ì¬˜7G&ˆÊs‚(	B6ÜVR&ˆÊÊV÷VÁBW7B,:ógR˜W"V‚6WV¬WFñ∆ó6FWW"„¬˜‡¢«Â6í6R‚|:óFóB2Fˆí¬6ˆÊÊV7FR◊FˆíWBl:ó&ñfñRFˆ‚6ˆ◊FR‚6íGR'FvW2Fˆ‚6<:á2¬÷W&6íBwí÷WGG&Rfñ‚¢V‚62FR,:ñ6ñFófR¬∆R6ˆ◊FR˜W'&:ßG&R7W7VÊGR6Á2,:ñfó2„¬˜‡¢«Ó(	B¬|:óVóRF˜W4∆W4÷F6á3¬˜Ê¿¢≤7&óFñ6√¢G'VR–¢íÊ6F6ÇÜR”‚6ˆÁ6ˆ∆RÊW'&˜"Ç%∑6W76ñˆ‚÷∂ñ6µ“V÷ñ√¢"¬RÊ÷W76vRíì∞¢–¢–¢–†¢ÚÚ7ñÊ2vóFÇ'&WfÚ7ñÊ6á&ˆÊ˜W6«íÜFˆ‚wB&∆ˆ6≤FÜR&W7ˆÁ6Rê¢6ˆÁ7BFr“&˜rÁ∆‚””“&g&VR"Ú$e$TR"¢&˜rÁ∆‚””“'&V÷óV“"Ú%$T‘ïT“"¢&˜rÁ∆‚””“&V∆óFR"Ú$TƒïDR"¢%dï#∞¢'&WfÙFD6ˆÁF7Bá&˜rÊV÷ñ¬¬Fr¬$e""¬ÁV∆¬¬≤ƒ5EÙƒÙtîÂÙC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí“íÊ6F6ÇÇÇí”‚∑“ì∞†¢&WGW&‚&W2Êß6ˆ‚á≤f∆ñC¢G'VR¬∆„¢&˜rÁ∆‚¬7&VFóG5ˆ∆VgB¬7&VFóG5ˆ÷É¢&˜rÊ7&VFóG5ˆ÷Ç¬V÷ñ√¢&˜rÊV÷ñ¬¬6W76ñˆÂ˜Fˆ∂V„¢6W76ñˆÂFˆ∂V‚“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑fW&ñgí÷6ˆFU“W'&˜#¢"¬RÊ÷W76vRì∞¢&WGW&‚&W2Êß6ˆ‚á≤f∆ñC¢f«6R¬W'&˜#¢$W'&WW"FRl:ó&ñfñ6Fñˆ‚"“ì∞¢–ß“ì∞†¢ÚÚÜV'F&VBFR6W76ñˆ‚VÊóVR¢VÊRvR6ˆÊÊV7FVRñÁFW'&ˆvR6V6ê¢ÚÚW&ñˆFóVV÷VÁBáfˆó"vñFvWG2Êß2í‚6í∆R¶WFˆ‚ÊR6˜'&W7ˆÊB«W2áV‚WG&P¢ÚÚ&Vñ¬2vW7B6ˆÊÊV7FRfV2∆R÷V÷R6ˆFRVÁG&R◊FV◊2í¬ˆ‚&VÁfˆñP¢ÚÚ7FófS¶f«6RWB∆R6∆ñVÁB6RFV6ˆÊÊV7FRFR«Ví÷÷V÷R‡¶ÊvWBÇ"˜6W76ñˆ‚÷6ÜV6≤"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'í«¬∑”∞¢6ˆÁ7B6W76ñˆ‚“&WÁVW'ìÚÁ6W76ñˆ‚«¬"#∞¢ñbÇV÷ñ¬«¬6ˆFRí&WGW&‚&W2Êß6ˆ‚á≤7FófS¢f«6R“ì∞¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜r“6ˆFW4F"Á&W&RÄ¢%4TƒT5B6W76ñˆÂ˜Fˆ∂V‚e$Ù“6ˆFW2tÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú‰B7FófR“ ¢íÊvWBÖ7G&ñÊrÜ6ˆFRíÁFıWW$66RÇíÁG&ñ“Çí¬7G&ñÊrÜV÷ñ¬íÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢ñbÇ&˜rí&WGW&‚&W2Êß6ˆ‚á≤7FófS¢f«6R“ì∞¢ÚÚV7V‚¶WFˆ‚GG&ñ'VR6R6ˆFRFWVó2∆R∆Ê6V÷VÁBFR6WGFRfˆÊ7FñˆÊÊ∆óFP¢ÚÚá6W76ñˆÂ˜Fˆ∂V‚ÂTƒ¬V‚&6Rí¢&ñV‚6ˆ◊&W"¬ÊR2FV6ˆÊÊV7FW"VÊP¢ÚÚ6ˆÊÊWÜñˆ‚∆VvóFñ÷RVí‚v6ñ◊∆V÷VÁB2VÊ6˜&RWFR&g&ñ6ÜñR‡¢ñbÇ&˜rÁ6W76ñˆÂ˜Fˆ∂V‚í&WGW&‚&W2Êß6ˆ‚á≤7FófS¢G'VR“ì∞¢ÚÚV‚¶WFˆ‚WÜó7FRV‚&6R÷ó2∆RÊfñvFWW"‚vV‚V7V‚∆ˆ6∆V÷VÁ@¢ÚÚÜ6ˆÊÊWÜñˆ‚fóFRdÂB6R6˜'&V7Fñbí¢W&ñ÷VR"FVfñÊóFñˆ‚‡¢ñbÇ6W76ñˆ‚í&WGW&‚&W2Êß6ˆ‚á≤7FófS¢f«6R“ì∞¢&WGW&‚&W2Êß6ˆ‚á≤7FófS¢&˜rÁ6W76ñˆÂ˜Fˆ∂V‚””“6W76ñˆ‚“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑6W76ñˆ‚÷6ÜV6µ“W'&˜#¢"¬RÊ÷W76vRì∞¢&WGW&‚&W2Êß6ˆ‚á≤7FófS¢G'VR“ì≤ÚÚÊÊR6W'fWW"¢ÊR2FV6ˆÊÊV7FW"F˜WB∆R÷ˆÊFR"W'&WW ¢–ß“ì∞†¢ÚÚ∆ó7FRFW26ˆ◊FW2Ví'FvVÁB∆WW"6ˆFRÜ6ˆÊÊWÜñˆÁ26ˆÊ7W'&VÁFW0¢ÚÚFWFV7FVW2í““˜W"&WW&W"Ví6ˆÁF7FW"fÁB&ó7VRFR&ÊÊó76V÷VÁB‡¢ÚÚFV÷ÊFRFRw&Vr∆R2ÛÇÛ##b‡¶ÊvWBÇ"ˆF÷ñ‚˜6Ü&VB÷66˜VÁG2"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'í«¬∑”∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢G'í∞¢6ˆÁ7B¶˜W'2“÷FÇÊ÷ñ‚Éì¬÷FÇÊ÷ÇÉ¬'6TñÁBá&WÁVW'íÊ¶˜W'2í«¬3íì∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BV÷ñ¬¬6ˆFR¬4ıTÂBÇ¢í2Ê%ˆFWFV7FñˆÁ2¬‘ÇÜ∂ñ6∂VEˆBí2FW&ÊñW&UˆFWFV7Fñˆ‚¬‘î‚Ü∂ñ6∂VEˆBí2&V÷ñW&UˆFWFV7Fñˆ‡¢e$Ù“6W76ñˆÂˆ∂ñ6∑0¢tÑU$R∂ñ6∂VEˆB„“FFWFñ÷RÇvÊ˜rr¬Úê¢u$ıU%íV÷ñ¬¬6ˆFP¢ı$DU"%íÊ%ˆFWFV7FñˆÁ2DU40¢íÊ∆¬Ü“G∂¶˜W'7“Fó6ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬fVÊWG&Uˆ¶˜W'3¢¶˜W'2¬6ˆ◊FW3¢&˜w2“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞†¢ÚÚ)H)H6ˆÊÊWÜñˆ‚&ñˆ‹:óG&óVRÖvV$WFÜ‚(	Bf6RîBÚV◊&VñÁFRFñvóF∆Rí)H)H)H)H)H)H)H)H)H)H)H ¶6ˆÁ7B≤vVÊW&FU&Vvó7G&Fñˆ‰˜FñˆÁ2¬fW&ñgï&Vvó7G&FñˆÂ&W7ˆÁ6R¬vVÊW&FTWFÜVÁFñ6Fñˆ‰˜FñˆÁ2¬fW&ñgîWFÜVÁFñ6FñˆÂ&W7ˆÁ6R““&WVó&RÇ$6ñ◊∆WvV&WFÜ‚˜6W'fW""ì∞¶6ˆÁ7BtT$UDÑÂı%Ù‰‘R“%F˜W4∆W4÷F6á2#∞¶6ˆÁ7BtT$UDÑÂı%ÙîB“'F˜W6∆W6÷F6á2Ê6ˆ“#∞¶6ˆÁ7BtT$UDÑÂÙı$îtîÂ2“≤&áGG3¢Ú˜F˜W6∆W6÷F6á2Ê6ˆ“"¬&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“%”∞¶6ˆÁ7BvV&WFÜ‰6Ü∆∆VÊvW2“ÊWr÷Çì≤ÚÚV÷ñ¬”‚≤6Ü∆∆VÊvR¬Wáó&W2–¶gVÊ7Fñˆ‚WEvV&WFÜ‰6Ü∆∆VÊvRÜV÷ñ¬¬6Ü∆∆VÊvRí∞¢vV&WFÜ‰6Ü∆∆VÊvW2Á6WBÜV÷ñ¬¬≤6Ü∆∆VÊvR¬Wáó&W3¢FFRÊÊ˜rÇí≤R¢c“ì∞ß–¶gVÊ7Fñˆ‚F∂UvV&WFÜ‰6Ü∆∆VÊvRÜV÷ñ¬í∞¢6ˆÁ7B&˜r“vV&WFÜ‰6Ü∆∆VÊvW2ÊvWBÜV÷ñ¬ì∞¢vV&WFÜ‰6Ü∆∆VÊvW2ÊFV∆WFRÜV÷ñ¬ì∞¢ñbÇ&˜r«¬&˜rÊWáó&W2¬FFRÊÊ˜rÇíí&WGW&‚ÁV∆√∞¢&WGW&‚&˜rÊ6Ü∆∆VÊvS∞ß–†¶Á˜7BÇ"˜vV&WFÜ‚˜&Vvó7FW"÷˜FñˆÁ2"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÊ&ˆGí«¬∑”∞¢ñbÇV÷ñ¬«¬6ˆFRí&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V÷ñ¬WB6ˆFR&WVó2"“ì∞¢6ˆÁ7BWFÇ“fW&ñgî6ˆFRÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇÁf∆ñBí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6ˆFRñÁf∆ñFR"“ì∞¢6ˆÁ7B6∆V‰V÷ñ¬“V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢G'í∞¢6ˆÁ7B˜FñˆÁ2“vóBvVÊW&FU&Vvó7G&Fñˆ‰˜FñˆÁ2á∞¢'Ê÷S¢tT$UDÑÂı%Ù‰‘R¿¢'îC¢tT$UDÑÂı%ÙîB¿¢W6W$Ê÷S¢6∆V‰V÷ñ¬¿¢GFW7FFñˆÂGóS¢&ÊˆÊR"¿¢ÚÚ&W6ñFVÁD∂Wì¢&Fó66˜W&vVB"(	B7W"ÊG&ˆñBÙ6á&ˆ÷R¬'&VfW'&VB"Ú'&WVó&VB ¢ÚÚ&˜WFR∆7&VFñˆ‚fW'2∆R7&VFVÁFñ¬÷ÊvW"FRvˆˆv∆Rá76∂Wó2í¿¢ÚÚVíV6Ü˜VRg&WVV÷÷VÁBfV2$‚VÊ∂Ê˜v‚W'&˜"ˆ67W'&VBvÜñ∆RF∆∂ñÊp¢ÚÚFÚFÜR7&VFVÁFñ¬÷ÊvW""Ü6ˆÁ7FFR∆RÛÇÛ##b¬6◊7VÊrÙ6á&ˆ÷Rí‡¢ÚÚˆ‚6ˆÊÊóBFV¶¬vV÷ñ¬R÷ˆ÷VÁBGR∆ˆvñ‚FˆÊ2ˆ‚‚v2&W6ˆñ‡¢ÚÚBwV‚7&VFVÁFñ¬FV6˜Wg&&∆R(	B&Fó66˜W&vVB"WfóFR6R6ÜV÷ñ‚'VwVR‡¢WFÜVÁFñ6F˜%6V∆V7Fñˆ„¢≤&W6ñFVÁD∂Wì¢&Fó66˜W&vVB"¬W6W%fW&ñfñ6Fñˆ„¢'&VfW'&VB"¬WFÜVÁFñ6F˜$GF6Ü÷VÁC¢'∆Ff˜&“"“¿¢“ì∞¢WEvV&WFÜ‰6Ü∆∆VÊvRÜ6∆V‰V÷ñ¬¬˜FñˆÁ2Ê6Ü∆∆VÊvRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬˜FñˆÁ2“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑vV&WFÜ‚˜&Vvó7FW"÷˜FñˆÁ5“"¬RÊ÷W76vRì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"6W'fWW""“ì∞¢–ß“ì∞†¶Á˜7BÇ"˜vV&WFÜ‚˜&Vvó7FW"◊fW&ñgí"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬7&VFVÁFñ¬¬FWfñ6T∆&V¬““&WÊ&ˆGí«¬∑”∞¢ñbÇV÷ñ¬«¬6ˆFR«¬7&VFVÁFñ¬í&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%&W\:ßFRñÊ6ˆ◊Ã:áFR"“ì∞¢6ˆÁ7BWFÇ“fW&ñgî6ˆFRÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇÁf∆ñBí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6ˆFRñÁf∆ñFR"“ì∞¢6ˆÁ7B6∆V‰V÷ñ¬“V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢6ˆÁ7BWáV7FVD6Ü∆∆VÊvR“F∂UvV&WFÜ‰6Ü∆∆VÊvRÜ6∆V‰V÷ñ¬ì∞¢ñbÇWáV7FVD6Ü∆∆VÊvRí&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6Ü∆∆VÊvRWáó,:í¬,:ñW76ñR‚"“ì∞¢G'í∞¢6ˆÁ7BfW&ñfñ6Fñˆ‚“vóBfW&ñgï&Vvó7G&FñˆÂ&W7ˆÁ6Rá∞¢&W7ˆÁ6S¢7&VFVÁFñ¬¿¢WáV7FVD6Ü∆∆VÊvR¿¢WáV7FVD˜&ñvñ„¢tT$UDÑÂÙı$îtîÂ2¿¢WáV7FVE%îC¢tT$UDÑÂı%ÙîB¿¢“ì∞¢ñbÇfW&ñfñ6Fñˆ‚ÁfW&ñfñVB«¬fW&ñfñ6Fñˆ‚Á&Vvó7G&Fñˆ‰ñÊfÚí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%l:ó&ñfñ6Fñˆ‚:ñ6Ü˜\:ñR"“ì∞¢–¢6ˆÁ7B≤7&VFVÁFñ√¢&Vt7&VB““fW&ñfñ6Fñˆ‚Á&Vvó7G&Fñˆ‰ñÊfÛ∞¢F"Á&W&RÄ¢$îÂ4U%Bı"$Uƒ4RîÂDÚvV&WFÜÂˆ7&VFVÁFñ«2ÜñB¬V÷ñ¬¬6ˆFR¬V&∆ñ5ˆ∂Wí¬6˜VÁFW"¬FWfñ6Uˆ∆&V¬íd≈TU2ÉÚ¬Ú¬Ú¬Ú¬Ú¬Úí ¢íÁ'V‚á&Vt7&VBÊñB¬6∆V‰V÷ñ¬¬6ˆFRÁFıWW$66RÇíÁG&ñ“Çí¬'VffW"Êg&ˆ“á&Vt7&VBÁV&∆ñ4∂WííÁFı7G&ñÊrÇ&&6ScB"í¬&Vt7&VBÊ6˜VÁFW"¬FWfñ6T∆&V¬«¬ÁV∆¬ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑vV&WFÜ‚˜&Vvó7FW"◊fW&ñgï“"¬RÊ÷W76vRì∞¢&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%l:ó&ñfñ6Fñˆ‚:ñ6Ü˜\:ñR"“ì∞¢–ß“ì∞†¶Á˜7BÇ"˜vV&WFÜ‚ˆ∆ˆvñ‚÷˜FñˆÁ2"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬““&WÊ&ˆGí«¬∑”∞¢ñbÇV÷ñ¬í&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V÷ñ¬&WVó2"“ì∞¢6ˆÁ7B6∆V‰V÷ñ¬“V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢6ˆÁ7B7&VG2“F"Á&W&RÇ%4TƒT5BñBe$Ù“vV&WFÜÂˆ7&VFVÁFñ«2tÑU$RV÷ñ¬“Ú"íÊ∆¬Ü6∆V‰V÷ñ¬ì∞¢ñbÇ7&VG2Ê∆VÊwFÇí&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V7V‚&Vñ¬VÁ&Vvó7G,:í˜W"6WBV÷ñ¬"“ì∞¢G'í∞¢6ˆÁ7B˜FñˆÁ2“vóBvVÊW&FTWFÜVÁFñ6Fñˆ‰˜FñˆÁ2á∞¢'îC¢tT$UDÑÂı%ÙîB¿¢W6W%fW&ñfñ6Fñˆ„¢'&VfW'&VB"¿¢∆∆˜t7&VFVÁFñ«3¢7&VG2Ê÷Ü2”‚á≤ñC¢2ÊñB“íí¿¢“ì∞¢WEvV&WFÜ‰6Ü∆∆VÊvRÜ6∆V‰V÷ñ¬¬˜FñˆÁ2Ê6Ü∆∆VÊvRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬˜FñˆÁ2“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑vV&WFÜ‚ˆ∆ˆvñ‚÷˜FñˆÁ5“"¬RÊ÷W76vRì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"6W'fWW""“ì∞¢–ß“ì∞†¶Á˜7BÇ"˜vV&WFÜ‚ˆ∆ˆvñ‚◊fW&ñgí"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬7&VFVÁFñ¬““&WÊ&ˆGí«¬∑”∞¢ñbÇV÷ñ¬«¬7&VFVÁFñ¬í&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%&W\:ßFRñÊ6ˆ◊Ã:áFR"“ì∞¢6ˆÁ7B6∆V‰V÷ñ¬“V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢6ˆÁ7BWáV7FVD6Ü∆∆VÊvR“F∂UvV&WFÜ‰6Ü∆∆VÊvRÜ6∆V‰V÷ñ¬ì∞¢ñbÇWáV7FVD6Ü∆∆VÊvRí&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6Ü∆∆VÊvRWáó,:í¬,:ñW76ñR‚"“ì∞¢6ˆÁ7B7F˜&VB“F"Á&W&RÇ%4TƒT5B¢e$Ù“vV&WFÜÂˆ7&VFVÁFñ«2tÑU$RñB“Ú‰BV÷ñ¬“Ú"íÊvWBÜ7&VFVÁFñ¬ÊñB¬6∆V‰V÷ñ¬ì∞¢ñbÇ7F˜&VBí&WGW&‚&W2Á7FGW2ÉCBíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$&Vñ¬Êˆ‚&V6ˆÊÁR"“ì∞¢G'í∞¢6ˆÁ7BfW&ñfñ6Fñˆ‚“vóBfW&ñgîWFÜVÁFñ6FñˆÂ&W7ˆÁ6Rá∞¢&W7ˆÁ6S¢7&VFVÁFñ¬¿¢WáV7FVD6Ü∆∆VÊvR¿¢WáV7FVD˜&ñvñ„¢tT$UDÑÂÙı$îtîÂ2¿¢WáV7FVE%îC¢tT$UDÑÂı%ÙîB¿¢7&VFVÁFñ√¢≤ñC¢7F˜&VBÊñB¬V&∆ñ4∂Wì¢'VffW"Êg&ˆ“á7F˜&VBÁV&∆ñ5ˆ∂Wí¬&&6ScB"í¬6˜VÁFW#¢7F˜&VBÊ6˜VÁFW"“¿¢“ì∞¢ñbÇfW&ñfñ6Fñˆ‚ÁfW&ñfñVBí&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%l:ó&ñfñ6Fñˆ‚:ñ6Ü˜\:ñR"“ì∞¢F"Á&W&RÇ%UDDRvV&WFÜÂˆ7&VFVÁFñ«24UB6˜VÁFW"“Ú¬∆7E˜W6VEˆB“FFWFñ÷RÇvÊ˜rrítÑU$RñB“Ú"ê¢Á'V‚áfW&ñfñ6Fñˆ‚ÊWFÜVÁFñ6Fñˆ‰ñÊfÚÊÊWt6˜VÁFW"¬7F˜&VBÊñBì∞¢ÚÚ∆R6ˆFR7Fˆ6∂R7W"¬vV◊&VñÁFRW7B6V«VíGR¶˜W"FR¬tTÂ$Ttï5E$T‘TÂBGP¢ÚÚFˆñwB¬2f˜&6V÷VÁB6V«VíBvV¶˜W&BváVí¢V‚&VÊ˜WfV∆∆V÷VÁBˆ6ÜÊvV÷VÁ@¢ÚÚFR∆ñW"vVÊW&RV‚Ê˜WfVR6ˆFR7FñbWBFW67FófR¬vÊ6ñV‚¬6RVê¢ÚÚ&V¶WFóB∆˜'2∆6ˆÊÊWÜñˆ‚&ñˆ÷WG&óVR÷V÷R6í¬v&ˆÊÊV÷VÁBW7B&ñV‡¢ÚÚf∆ñFRÜ6ˆÁ7FFR∆RBÛÇÛ##b(	B&vVÁBÊ6ˆÁ66ñVÁD&˜Fˆ‚Ê÷R&∆˜VRfV0¢ÚÚ6ˆ‚FˆñwB&W2&VÊ˜WfV∆∆V÷VÁB¬fWÇ&&ˆÊÊV÷VÁBWáó&R"í‚ˆ‚&Wf∆ñFP¢ÚÚFˆÊ27W"∆R6ˆFR5Dîb7GVV¬FR6WBV÷ñ¬¬27W"6V«VífñvRRFˆñwB‡¢∆WB7W'&VÁD6ˆFR“7F˜&VBÊ6ˆFS∞¢G'í∞¢6ˆÁ7B6F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜r“6F"Á&W&RÇ%4TƒT5B6ˆFRe$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“ı$DU"%í&˜vñBDU42ƒî‘ïB"íÊvWBá7F˜&VBÊV÷ñ¬ì∞¢6F"Ê6∆˜6RÇì∞¢ñbá&˜sÚÊ6ˆFRí7W'&VÁD6ˆFR“&˜rÊ6ˆFS∞¢“6F6ÇÖÚí∑–¢6ˆÁ7BWFÇ“fW&ñgî6ˆFRá7F˜&VBÊV÷ñ¬¬7W'&VÁD6ˆFRì∞¢ñbÇWFÇÁf∆ñBí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$&ˆÊÊV÷VÁBWáó,:í¬&V6ˆÊÊV7FR◊FˆífV2Fˆ‚6ˆFR‚"“ì∞¢ñbÜ7W'&VÁD6ˆFR”“7F˜&VBÊ6ˆFRí∞¢G'í≤F"Á&W&RÇ%UDDRvV&WFÜÂˆ7&VFVÁFñ«24UB6ˆFR“ÚtÑU$RñB“Ú"íÁ'V‚Ü7W'&VÁD6ˆFR¬7F˜&VBÊñBì≤“6F6ÇÖÚí∑–¢–¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬V÷ñ√¢7F˜&VBÊV÷ñ¬¬6ˆFS¢7W'&VÁD6ˆFR¬∆„¢WFÇÁ∆‚“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑vV&WFÜ‚ˆ∆ˆvñ‚◊fW&ñgï“"¬RÊ÷W76vRì∞¢&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%l:ó&ñfñ6Fñˆ‚:ñ6Ü˜\:ñR"“ì∞¢–ß“ì∞†¢ÚÚ)H)HWFÇ)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶Á˜7BÇ"ˆWFÇ˜&Vvó7FW""¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬77v˜&B““&WÊ&ˆGí«¬∑”∞¢ñbÇV÷ñ¬«¬77v˜&Bí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V÷ñ¬WB÷˜BFR76R&WVó2"“ì∞¢ñbá77v˜&BÊ∆VÊwFÇ¬bí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$÷˜BFR76RG&˜6˜W'BÉb6&7L:á&W2÷ñ‚í"“ì∞†¢G'í∞¢6ˆÁ7BÜ6Ç“vóB&7'óBÊÜ6Çá77v˜&B¬ì∞¢6ˆÁ7B7F◊B“F"Á&W&RÇ$îÂ4U%BîÂDÚW6W'2ÜV÷ñ¬¬77v˜&EˆÜ6Ç¬7FGW2íd≈TU2ÉÚ¬Ú¬vg&VRrí"ì∞¢6ˆÁ7B&W7V«B“7F◊BÁ'V‚ÜV÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çí¬Ü6Çì∞¢6ˆÁ7BW6W$ñB“&W7V«BÊ∆7DñÁ6W'E&˜vñC∞¢6ˆÁ7BFˆ∂V‚“ßwBÁ6ñv‚á≤ñC¢W6W$ñB¬V÷ñ¬¬7FGW3¢&g&VR"“¬•uEı4T5$UB¬≤Wáó&W4ñ„¢#3B"“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬Fˆ∂V‚¬W6W#¢≤ñC¢W6W$ñB¬V÷ñ¬¬7FGW3¢&g&VR"““ì∞¢“6F6ÇÜRí∞¢ñbÜRÊ÷W76vSÚÊñÊ6«VFW2Ç%T‰ïTR"íí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V÷ñ¬L:ñ¨:WFñ∆ó<:í"“ì∞¢6ˆÁ6ˆ∆RÊW'&˜"ÜRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"6W'fWW""“ì∞¢–ß“ì∞†¶Á˜7BÇ"ˆWFÇˆ∆ˆvñ‚"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬77v˜&B““&WÊ&ˆGí«¬∑”∞¢ñbÇV÷ñ¬«¬77v˜&Bí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V÷ñ¬WB÷˜BFR76R&WVó2"“ì∞†¢6ˆÁ7BW6W"“F"Á&W&RÇ%4TƒT5B¢e$Ù“W6W'2tÑU$RV÷ñ¬“Ú"íÊvWBÜV÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢ñbÇW6W"í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V÷ñ¬˜R÷˜BFR76RñÊ6˜'&V7B"“ì∞†¢6ˆÁ7Bf∆ñB“vóB&7'óBÊ6ˆ◊&Rá77v˜&B¬W6W"Á77v˜&EˆÜ6Çì∞¢ñbÇf∆ñBí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V÷ñ¬˜R÷˜BFR76RñÊ6˜'&V7B"“ì∞†¢6ˆÁ7BFˆ∂V‚“ßwBÁ6ñv‚á≤ñC¢W6W"ÊñB¬V÷ñ√¢W6W"ÊV÷ñ¬¬7FGW3¢W6W"Á7FGW2“¬•uEı4T5$UB¬≤Wáó&W4ñ„¢#3B"“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬Fˆ∂V‚¬W6W#¢≤ñC¢W6W"ÊñB¬V÷ñ√¢W6W"ÊV÷ñ¬¬7FGW3¢W6W"Á7FGW2““ì∞ß“ì∞†¢ÚÚ)H)HW6W"Fˆ∂VÁ2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"˜W6W"˜Fˆ∂VÁ2"¬WFÑ÷ñFF∆Wv&R¬á&W¬&W2í”‚∞¢6ˆÁ7BW6W"“F"Á&W&RÇ%4TƒT5B7FGW2e$Ù“W6W'2tÑU$RñB“Ú"íÊvWBá&WÁW6W"ÊñBì∞¢ñbÇW6W"í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%WFñ∆ó6FWW"ñÁG&˜Wf&∆R"“ì∞†¢6ˆÁ7B&˜r“VÁ7W&UFˆ∂VÂ&˜rá&WÁW6W"ÊñBì∞¢6ˆÁ7B∆ñ÷óB“DÙ¥TÂÙƒî‘ïE5∑W6W"Á7FGW5“«¬∞†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢Fˆ∂VÁ3¢&˜rÁFˆ∂VÁ5˜FˆFí¿¢∆ñ÷óB¿¢7FGW3¢W6W"Á7FGW2¿¢&W6WEˆC¢&÷ñÁVóB"¿¢“ì∞ß“ì∞†¢ÚÚ)H)HWFÉ¢&ˆfñ¬WFñ∆ó6FWW")H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆWFÇˆ÷R"¬WFÑ÷ñFF∆Wv&R¬á&W¬&W2í”‚∞¢6ˆÁ7BW6W"“F"Á&W&RÇ%4TƒT5BñB¬V÷ñ¬¬7FGW2¬7&VFVEˆBe$Ù“W6W'2tÑU$RñB“Ú"íÊvWBá&WÁW6W"ÊñBì∞¢ñbÇW6W"í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%WFñ∆ó6FWW"ñÁG&˜Wf&∆R"“ì∞¢6ˆÁ7B&˜r“VÁ7W&UFˆ∂VÂ&˜ráW6W"ÊñBì∞¢6ˆÁ7B∆ñ÷óB“DÙ¥TÂÙƒî‘ïE5∑W6W"Á7FGW5“«¬∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬W6W#¢≤ñC¢W6W"ÊñB¬V÷ñ√¢W6W"ÊV÷ñ¬¬7FGW3¢W6W"Á7FGW2¬7&VFVEˆC¢W6W"Ê7&VFVEˆB¬Fˆ∂VÁ5˜FˆFì¢&˜rÁFˆ∂VÁ5˜FˆFí¬Fˆ∂VÁ5ˆ∆ñ÷óC¢∆ñ÷óB““ì∞ß“ì∞†¢ÚÚ)H)HW6W#¢Üó7F˜&óVRW'6ˆÊÊV¬FW2Ê«ó6W2&WfV∆VW2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"˜W6W"ˆÜó7F˜'í"¬WFÑ÷ñFF∆Wv&R¬á&W¬&W2í”‚∞¢6ˆÁ7B∆ñ÷óB“÷FÇÊ÷ñ‚á'6TñÁBá&WÁVW'íÊ∆ñ÷óBí«¬3¬ì∞¢6ˆÁ7Bˆfg6WB“'6TñÁBá&WÁVW'íÊˆfg6WBí«¬∞¢G'í∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5B&Ê÷F6Öˆ∂Wí¬&ÊÊ«ó6ó5ˆß6ˆ‚¬&Á&WfV∆VEˆ@¢e$Ù“&WfV∆VEˆÊ«ó6W2&¢tÑU$R&ÁW6W%ˆñB“¢ı$DU"%í&Á&WfV∆VEˆBDU40¢ƒî‘ïBÚÙde4UB¢íÊ∆¬á&WÁW6W"ÊñB¬∆ñ÷óB¬ˆfg6WBì∞¢6ˆÁ7BF˜F¬“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í26ÁBe$Ù“&WfV∆VEˆÊ«ó6W2tÑU$RW6W%ˆñB“Ú"íÊvWBá&WÁW6W"ÊñBìÚÊ6ÁB«¬∞¢6ˆÁ7BÊ«ó6W2“&˜w2Ê÷á"”‚∞¢∆WBFF“∑”∞¢G'í≤FF“•4Ù‚Á'6Rá"ÊÊ«ó6ó5ˆß6ˆ‚«¬'∑“"ì≤“6F6Ç∑–¢&WGW&‚≤÷F6Öˆ∂Wì¢"Ê÷F6Öˆ∂Wí¬&WfV∆VEˆC¢"Á&WfV∆VEˆB¬‚‚Á6ÊóFó¶TÊ«ó6ó4f˜$6∆ñVÁBÜFFí”∞¢“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬Ê«ó6W2¬F˜F¬“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑W6W"ˆÜó7F˜'ï“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬Ê«ó6W3¢µ“¬F˜F√¢“ì∞¢–ß“ì∞†¢ÚÚ)H)HvW7Fñˆ‚FR6óF¬(	B&Ê∑&ˆ∆¬FR¬wWFñ∆ó6FWW"Ü∆ˆvñ‚"V÷ñ¬≤6ˆFRí)H)H)H ¢ÚÚl:ó&ñfñRVR∆R6˜W∆RV÷ñ¬ˆ6ˆFRW7BV‚&ˆÊÏ:í7FñbFR6ˆFW2ÊF"‡¶gVÊ7Fñˆ‚&Ê∑&ˆ∆ƒWFÇÜV÷ñ¬¬6ˆFRí∞¢ñbÇV÷ñ¬«¬6ˆFRí&WGW&‚ÁV∆√∞¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜r“6ˆFW4F"Á&W&RÄ¢%4TƒT5BV÷ñ¬¬∆‚¬Wáó&W5ˆBe$Ù“6ˆFW2tÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú‰B7FófR“ ¢íÊvWBÖ7G&ñÊrÜ6ˆFRíÁFıWW$66RÇíÁG&ñ“Çí¬7G&ñÊrÜV÷ñ¬íÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢ñbÇ&˜rí&WGW&‚ÁV∆√∞¢ñbá&˜rÊWáó&W5ˆBbbÊWrFFRá&˜rÊWáó&W5ˆBí¬ÊWrFFRÇíí&WGW&‚ÁV∆√∞¢&WGW&‚&˜s∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂&Ê∑&ˆ∆≈“WFÉ¢"¬RÊ÷W76vRì∞¢&WGW&‚ÁV∆√∞¢–ß–†¢ÚÚ,:ñ7W:á&R∆&Ê∑&ˆ∆¬VÁ&Vvó7G,:ñRFR¬wWFñ∆ó6FWW"‡¶Á˜7BÇ"ˆ&Ê∑&ˆ∆¬ˆvWB"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BWFÇ“&Ê∑&ˆ∆ƒWFÇÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WFÜVÁFñfú:í"“ì∞¢6ˆÁ7B&˜r“F"Á&W&RÇ%4TƒT5B÷˜VÁBe$Ù“W6W%ˆ&Ê∑&ˆ∆¬tÑU$RV÷ñ¬“Ú"íÊvWBÜWFÇÊV÷ñ¬ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&Ê∑&ˆ∆√¢&˜rÚ&˜rÊ÷˜VÁB¢ÁV∆¬“ì∞ß“ì∞†¢ÚÚVÁ&Vvó7G&Rˆ÷ˆFñfñR∆&Ê∑&ˆ∆¬Ü÷ˆÁFÁBV‚WW&˜2¬(	3í‡¶Á˜7BÇ"ˆ&Ê∑&ˆ∆¬˜6WB"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬&Ê∑&ˆ∆¬““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BWFÇ“&Ê∑&ˆ∆ƒWFÇÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WFÜVÁFñfú:í"“ì∞¢6ˆÁ7B&r“ÁV÷&W"Ü&Ê∑&ˆ∆¬ì∞¢ñbÇÁV÷&W"Êó4fñÊóFRá&rí«¬&r¬«¬&r‚í∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$÷ˆÁFÁBñÁf∆ñFR"“ì∞¢–¢6ˆÁ7B÷˜VÁB“÷FÇÁ&˜VÊBá&r¢íÚ∞¢F"Á&W&RÜ ¢îÂ4U%BîÂDÚW6W%ˆ&Ê∑&ˆ∆¬ÜV÷ñ¬¬÷˜VÁB¬WFFVEˆBíd≈TU2ÉÚ¬Ú¬FFWFñ÷RÇvÊ˜rríê¢Ù‚4Ù‰dƒî5BÜV÷ñ¬íDÚUDDR4UB÷˜VÁB“WÜ6«VFVBÊ÷˜VÁB¬WFFVEˆB“FFWFñ÷RÇvÊ˜rrê¢íÁ'V‚ÜWFÇÊV÷ñ¬¬÷˜VÁBì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&Ê∑&ˆ∆√¢÷˜VÁB“ì∞ß“ì∞†¢ÚÚ6∆7V∆R¬vÜó7F˜&óVR≤∆W2F˜FWÇÜvñÁ2˜W'FW2íBwV‚WFñ∆ó6FWW"‡¶gVÊ7Fñˆ‚&Ê∑&ˆ∆ƒÜó7F˜'íÜV÷ñ¬í∞¢6ˆÁ7B&WG2“F"Á&W&RÄ¢%4TƒT5BñB¬∆&V¬¬7F∂R¬ˆFG2¬&W7V«B¬&ˆfóB¬7&VFVEˆBe$Ù“W6W%ˆ&WG2tÑU$RV÷ñ¬“Úı$DU"%íñBDU42ƒî‘ïB# ¢íÊ∆¬ÜV÷ñ¬ì∞¢∆WBvvÊR“¬W&GR“¬vñÁ2“∞¢f˜"Ü6ˆÁ7B"ˆb&WG2í∞¢ñbÜ"Á&ˆfóB„“í≤vvÊR≥“"Á&ˆfóC≤ñbÜ"Á&W7V«B””“'vñ‚"ívñÁ2≤≥≤–¢V«6RW&GR≥“÷"Á&ˆfóC∞¢–¢6ˆÁ7BF˜F¬“&WG2Ê∆VÊwFÉ∞¢&WGW&‚∞¢&WG2¿¢F˜F«3¢∞¢6˜VÁC¢F˜F¬¿¢vñÁ2¿¢vñÁ&FS¢F˜F¬Ú÷FÇÁ&˜VÊBávñÁ2ÚF˜F¬¢í¢¿¢vvÊS¢÷FÇÁ&˜VÊBÜvvÊR¢íÚ¿¢W&GS¢÷FÇÁ&˜VÊBáW&GR¢íÚ¿¢6ˆ∆FS¢÷FÇÁ&˜VÊBÇÜvvÊR“W&GRí¢íÚ¿¢“¿¢”∞ß–†¢ÚÚ∆ó7FR¬vÜó7F˜&óVRFR÷ó6W2≤F˜FWÇFR¬wWFñ∆ó6FWW"‡¶Á˜7BÇ"ˆ&Ê∑&ˆ∆¬ˆ&WG2ˆ∆ó7B"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BWFÇ“&Ê∑&ˆ∆ƒWFÇÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WFÜVÁFñfú:í"“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Ê&Ê∑&ˆ∆ƒÜó7F˜'íÜWFÇÊV÷ñ¬í“ì∞ß“ì∞†¢ÚÚ¶˜WFRVÊR÷ó6RR7VófíW'6ˆÊÊV¬ÜWB˜W76R¬vV÷ñ¬fW'2'&WfÚí‡¶Á˜7BÇ"ˆ&Ê∑&ˆ∆¬ˆ&WG2ˆFB"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬∆&V¬¬7F∂R¬ˆFG2¬&W7V«B““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BWFÇ“&Ê∑&ˆ∆ƒWFÇÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WFÜVÁFñfú:í"“ì∞¢6ˆÁ7B2“ÁV÷&W"á7F∂Rí¬Ú“ÁV÷&W"ÜˆFG2ì∞¢6ˆÁ7B∆&¬“7G&ñÊrÜ∆&V¬«¬""íÁG&ñ“ÇíÁ6∆ñ6RÉ¬Éì∞¢ñbÇ∆&¬í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$∆ñ&V∆Ã:í&WVó2"“ì∞¢ñbÇÁV÷&W"Êó4fñÊóFRá2í«¬2√“«¬2‚í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$÷ó6RñÁf∆ñFR"“ì∞¢ñbÇÁV÷&W"Êó4fñÊóFRÜÚí«¬Ú¬«¬Ú‚í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6˜FRñÁf∆ñFR"“ì∞¢ñbá&W7V«B”“'vñ‚"bb&W7V«B”“&∆˜72"í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%,:ó7V«FBñÁf∆ñFR"“ì∞¢6ˆÁ7B&ˆfóB“&W7V«B””“'vñ‚ ¢Ú÷FÇÁ&˜VÊBá2¢ÜÚ“í¢íÚ ¢¢÷FÇÁ&˜VÊBÇ◊2¢íÚ∞¢F"Á&W&RÄ¢$îÂ4U%BîÂDÚW6W%ˆ&WG2ÜV÷ñ¬¬∆&V¬¬7F∂R¬ˆFG2¬&W7V«B¬&ˆfóBíd≈TU2ÉÚ¬Ú¬Ú¬Ú¬Ú¬Úí ¢íÁ'V‚ÜWFÇÊV÷ñ¬¬∆&¬¬÷FÇÁ&˜VÊBá2¢íÚ¬÷FÇÁ&˜VÊBÜÚ¢íÚ¬&W7V«B¬&ˆfóBì∞¢ÚÚÁW'GW&ñÊr¢2v77W&W"VR¬vV÷ñ¬W7B&ñV‚FÁ2'&Wf¢6ˆÁ7BFr“WFÇÁ∆‚””“&g&VR"Ú$e$TR"¢WFÇÁ∆‚””“'&V÷óV“"Ú%$T‘ïT“"¢WFÇÁ∆‚””“&V∆óFR"Ú$TƒïDR"¢%dï#∞¢'&WfÙFD6ˆÁF7BÜWFÇÊV÷ñ¬¬FríÊ6F6ÇÇÇí”‚∑“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Ê&Ê∑&ˆ∆ƒÜó7F˜'íÜWFÇÊV÷ñ¬í“ì∞ß“ì∞†¢ÚÚ7W&ñ÷RVÊR÷ó6RGR7Vófí‡¶Á˜7BÇ"ˆ&Ê∑&ˆ∆¬ˆ&WG2ˆFV∆WFR"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬ñB““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BWFÇ“&Ê∑&ˆ∆ƒWFÇÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WFÜVÁFñfú:í"“ì∞¢F"Á&W&RÇ$DTƒUDRe$Ù“W6W%ˆ&WG2tÑU$RñB“Ú‰BV÷ñ¬“Ú"íÁ'V‚ÑÁV÷&W"ÜñBí¬WFÇÊV÷ñ¬ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Ê&Ê∑&ˆ∆ƒÜó7F˜'íÜWFÇÊV÷ñ¬í“ì∞ß“ì∞†¢ÚÚ)H)H6ÜF&˜B÷ó7G&¬(	B‹:ñ÷ˆó&Ró6ˆÃ:ñR"WFñ∆ó6FWW")H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶6ˆÁ7B4ÑEıT‰dîƒ$ƒR“$Ê˜G&R76ó7FÁBW7B÷ˆ÷VÁFÏ:ñ÷VÁBñÊFó7ˆÊñ&∆R‚,:ñW76ñRFÁ2V‚ñÁ7FÁB¬˜R:ñ7&ó2÷Ê˜W27W"FV∆Vw&“‚#∞¶6ˆÁ7B4ÑEı5ï5DT’ı$Ù’B“GRW2¬v76ó7FÁBfó'GVV¬FRF˜W4∆W4÷F6á2Ê6ˆ“¬V‚6W'fñ6RBvÊ«ó6W27˜'FófW2"îVÃ:í∆R$6ˆÊ6ñ∆R"‚,:óˆÊG2V‚g&Ï:vó2¬'&ú:áfV÷VÁB¬6∆ó&V÷VÁBWBfV2∆R6˜W&ó&R‡•GRñFW27W"¢∆RfˆÊ7FñˆÊÊV÷VÁBGR6óFR¬∆W2Ê«ó6W2GR6ˆÁ6Vñ¬î¬∆W2f˜&◊V∆W2Ö7FÊF&BB√ì(*¬ˆ÷ˆó2¬&V÷óV“B√ì(*¬ˆ÷ˆó2¬V∆óFR’dï#í√ì(*¬ˆ÷ˆó2≤¬vÊ«ó6RGR¶˜W"W7Bw&GVóFR7W"∆R6óFRfV26ˆ‚,:ó7V«FBl:ó&ñfñ&∆R∆R∆VÊFV÷ñ‚í¬∆R6Ê¬FV∆Vw&“¬∆vR∆ófRî¬∆vR,:ó7V«FG2¬∆vW7Fñˆ‚FR6óF¬‡•,8ÑtƒU25E$î5DU2†¢“‚vV◊∆ˆñR§‘ï2∆R÷˜B'&í"Êí'&ñW""¢Fó2&Ê«ó6R"¬'<:ñ∆V7Fñˆ‚"˜R'ñ6≤"‡¢“ÊRv&ÁFó2§‘ï2FRvñÁ2≤&V∆∆RVR&ñV‚‚vW7B6W'Fñ‚WBVR∆R6W'fñ6RW7B,:ó6W'l:íWÇÇÁ2WB«W2‡¢“ÊRFˆÊÊR2BvÊ«ó6R,:ñ6ó6Rw&GVóFV÷VÁB¢ñÁfóFRˆ∆ñ÷VÁB:2v&ˆÊÊW"˜W"í6<:ñFW"‡¢“6íGRÊR6ó22¬Fó2÷∆R6ñ◊∆V÷VÁBWB˜&ñVÁFRfW'2∆R7W˜'BFV∆Vw&“Ê∞†¶Á˜7BÇ"ˆ6ÜB"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬÷W76vR““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7B◊6r“7G&ñÊrÜ÷W76vR«¬""íÁG&ñ“ÇíÁ6∆ñ6RÉ¬ì∞¢ñbÇ◊6rí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$÷W76vRfñFR"“ì∞†¢ÚÚWFñ∆ó6FWW"6ˆÊÊV7L:íÜV÷ñ¬∂6ˆFRf∆ñFW2í(i"‹:ñ÷ˆó&RW'6ó7FÁFRï4ÙÃ8îR‡¢6ˆÁ7BWFÇ“ÜV÷ñ¬bb6ˆFRíÚ&Ê∑&ˆ∆ƒWFÇÜV÷ñ¬¬6ˆFRí¢ÁV∆√∞¢6ˆÁ7B÷V‘∂Wí“WFÇÚWFÇÊV÷ñ¬¢ÁV∆√∞†¢ñbÇU%ƒUÑïEïÙïÙ¥Uíbb‘ï5E$≈ÙïÙ¥Uíí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂6ÜE“V7VÊR6∆Rf˜W&Êó76WW"6ˆÊfñwW&VR"ì∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&W«ì¢4ÑEıT‰dîƒ$ƒR¬f∆∆&6≥¢G'VR“ì∞¢–†¢ÚÚÜó7F˜&óVRFR4UBWFñ∆ó6FWW"VÊóVV÷VÁBÜ¶÷ó26V«VíBwV‚WG&Rí‡¢∆WBÜó7F˜'í“µ”∞¢ñbÜ÷V‘∂Wíí∞¢G'í∞¢Üó7F˜'í“F"Á&W&RÇ%4TƒT5B&ˆ∆R¬6ˆÁFVÁBe$Ù“6ÜEˆ÷W76vW2tÑU$RV÷ñ¬“Úı$DU"%íñBDU42ƒî‘ïB"íÊ∆¬Ü÷V‘∂WííÁ&WfW'6RÇì∞¢“6F6ÇÖÚí∑–¢–†¢6ˆÁ7B÷W76vW2“∞¢≤&ˆ∆S¢'7ó7FV“"¬6ˆÁFVÁC¢4ÑEı5ï5DT’ı$Ù’B“¿¢‚‚ÊÜó7F˜'íÊ÷ÜÇ”‚á≤&ˆ∆S¢ÇÁ&ˆ∆R””“&76ó7FÁB"Ú&76ó7FÁB"¢'W6W""¬6ˆÁFVÁC¢ÇÊ6ˆÁFVÁB“íí¿¢≤&ˆ∆S¢'W6W""¬6ˆÁFVÁC¢◊6r“¿¢”∞†¢ÚÚG&:v&ñ∆óL:í≤∆fˆÊBFRL:óVÁ6Rˆ&∆ñvFˆó&W2˜W"F˜WBV¬îá,:Üv∆P¢ÚÚfñÊ∆RGR&ˆ◊B÷:ÁG&RGR#ÇÛrÛ##bí‚¬vÁFí÷F˜V&∆ˆ‚ÊR2v∆óVR2: ¢ÚÚVÊR6ˆÁfW'6Fñˆ‚∆ñ'&R¢fˆó"∆∆˜t6ÜF&˜D6∆¬Ü6Ã:íVÊóVR"&W\:ßFRí‡¢6ˆÁ7Bˆ6ÜDvFR“Ê«ó6ó4VÊvñÊRÊ∆∆˜t6ÜF&˜D6∆¬ÜF"¬≤6W76ñˆ‰ñC¢÷V‘∂Wí“ì∞¢ñbÇˆ6ÜDvFRÊ∆∆˜vVBí∞¢6ˆÁ6ˆ∆RÁv&‚Ü∂6ÜE“v&FR'VFvWC¢Gµˆ6ÜDvFRÁ&V6ˆ‚«¬&V¬&VgW6R'÷ì∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&W«ì¢4ÑEıT‰dîƒ$ƒR¬f∆∆&6≥¢G'VR“ì∞¢–†¢ÚÚW'∆WÜóGíÜ÷ˆFV∆R'6ˆÊ""¬2'6ˆÊ"◊&Ú"(	B&V6ÜW&6ÜRvV"&VV∆∆R˜W ¢ÚÚV‚6˜WB"V¬&ñV‚«W2&2¬∆&vV÷VÁB7Vffó6ÁB˜W"V‚6ÜBw&Ê@¢ÚÚV&∆ñ2í&ñ˜&óFó&R¢6ˆÁG&ó&V÷VÁB÷ó7G&¬¬ñ¬6ˆÁ7V«FR∆RvV"fÁ@¢ÚÚFR&WˆÊG&R¬FˆÊ2ñ¬6ˆÊÊóB∆W2WfVÊV÷VÁG2&V6VÁG2ÜWÉ¢V‚&W7V«F@¢ÚÚ7˜'FñbFR6WGFRÊÊVRíR∆ñWRFR&W7FW"&∆˜VR6FFRBvVÁG&ñÊV÷VÁB‡¢ÚÚ&W∆í7W"÷ó7G&¬6íW'∆WÜóGí‚vW7B26ˆÊfñwW&RıR6í6ˆ‚V¬V6Ü˜VP¢ÚÚÉCÛC#í˜Fñ÷V˜WB˜&WˆÁ6RfñFRí‚fÁB6R6˜'&V7Fñb¬áGG˜7B&VÁf˜ñóBV‡¢ÚÚˆ&¶WB÷'VRˆáGG7FGW2R∆ñWRFR∆WfW"VÊRWÜ6WFñˆ‚¢∆R6ÜF&˜@¢ÚÚffñ6ÜóBFˆÊ26ˆ‚W'&WW"vVÊW&óVR6Á2¶˜W&Ê¬ÊíFVÁFFófR÷ó7G&¬‡¢∆WB&W«í“"#∞¢∆WB6ÜEFˆ∂VÁ4ñ‚“¬6ÜEFˆ∂VÁ4˜WB“∞¢6ˆÁ7B&˜fñFW'2“µ”∞¢ñbÖU%ƒUÑïEïÙïÙ¥Uíí&˜fñFW'2ÁW6Çá∞¢∆&V√¢%W'∆WÜóGí"¬W&√¢&áGG3¢ÚˆíÁW'∆WÜóGíÊíˆ6ÜBˆ6ˆ◊∆WFñˆÁ2"¿¢÷ˆFV√¢'6ˆÊ""¬∂Wì¢U%ƒUÑïEïÙïÙ¥Uí¿¢“ì∞¢ñbÑ‘ï5E$≈ÙïÙ¥Uíí&˜fñFW'2ÁW6Çá∞¢∆&V√¢$÷ó7G&¬"¬W&√¢&áGG3¢ÚˆíÊ÷ó7G&¬Êí˜cˆ6ÜBˆ6ˆ◊∆WFñˆÁ2"¿¢÷ˆFV√¢&÷ó7G&¬◊6÷∆¬÷∆FW7B"¬∂Wì¢‘ï5E$≈ÙïÙ¥Uí¿¢“ì∞†¢f˜"Ü6ˆÁ7B&˜fñFW"ˆb&˜fñFW'2í∞¢G'í∞¢6ˆÁ7B'“vóBáGG˜7BÄ¢&˜fñFW"ÁW&¬¿¢≤÷ˆFV√¢&˜fñFW"Ê÷ˆFV¬¬÷W76vW2¬FV◊W&GW&S¢„B¬÷Ö˜Fˆ∂VÁ3¢S“¿¢≤WFÜ˜&ó¶Fñˆ„¢&V&W"G∑&˜fñFW"Ê∂Wó÷“¿¢ ¢ì∞¢ñbá'ÚÂˆáGGFñ÷VD˜WBíFá&˜rÊWrW'&˜"Ç'Fñ÷V˜WB"ì∞¢ñbÑÁV÷&W"á'ÚÂˆáGG7FGW2«¬í„“Cí∞¢6ˆÁ7BFWFñ¬“'ÚÊW'&˜#ÚÊ÷W76vR«¬'ÚÊ÷W76vR«¬ÖEEG∑'ÂˆáGG7FGW7÷∞¢Fá&˜rÊWrW'&˜"ÜÖEEG∑'ÂˆáGG7FGW7”¢Gµ7G&ñÊrÜFWFñ¬íÁ6∆ñ6RÉ¬có÷ì∞¢–¢ñbá'ÚÂˆáGG'6TW'&˜"íFá&˜rÊWrW'&˜"Ç'&WˆÁ6Rñ∆∆ó6ñ&∆R"ì∞¢6ˆÁ7B6ÊFñFFR“'ÚÊ6Üˆñ6W3ÚÂ≥”ÚÊ÷W76vSÚÊ6ˆÁFVÁCÚÁG&ñ“Çí«¬"#∞¢ñbÇ6ÊFñFFRíFá&˜rÊWrW'&˜"Ç'&WˆÁ6RfñFR"ì∞¢&W«í“6ÊFñFFS∞¢6ÜEFˆ∂VÁ4ñ‚“ÁV÷&W"á'ÚÁW6vSÚÁ&ˆ◊E˜Fˆ∂VÁ2«¬ì∞¢6ÜEFˆ∂VÁ4˜WB“ÁV÷&W"á'ÚÁW6vSÚÊ6ˆ◊∆WFñˆÂ˜Fˆ∂VÁ2«¬ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂6ÜE“G∑&˜fñFW"Ê∆&V«”¢Ù∂ì∞¢'&V≥∞¢“6F6ÇÜRí∞¢6ˆÁ7B6fTW'&˜"“7G&ñÊrÜRÊ÷W76vR«¬Rê¢Á&W∆6RÇÚáÜ∂Wó6ñ"◊«6≤◊&ˆ¢◊««Ç“ï¥’¶◊£”ïÚ’“≤ˆví¬"C¢¢§‘5TR¢¢¢"ê¢Á6∆ñ6RÉ¬##ì∞¢6ˆÁ6ˆ∆RÊW'&˜"Ü∂6ÜE“G∑&˜fñFW"Ê∆&V«”¢G∑6fTW'&˜'÷ì∞¢–¢–¢ˆ6ÜDvFRÁ&V6˜&BÜ6ÜEFˆ∂VÁ4ñ‚¬6ÜEFˆ∂VÁ4˜WB¬&W«íÚ&ˆ≤"¢&W'&˜""ì∞†¢ñbÇ&W«íí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&W«ì¢4ÑEıT‰dîƒ$ƒR¬f∆∆&6≥¢G'VR“ì∞†¢ÚÚ6WfVv&FR˜W"4UBWFñ∆ó6FWW"6WV∆V÷VÁB‡¢ñbÜ÷V‘∂Wíí∞¢G'í∞¢6ˆÁ7BñÁ2“F"Á&W&RÇ$îÂ4U%BîÂDÚ6ÜEˆ÷W76vW2ÜV÷ñ¬¬&ˆ∆R¬6ˆÁFVÁBíd≈TU2ÉÚ√Ú√Úí"ì∞¢ñÁ2Á'V‚Ü÷V‘∂Wí¬'W6W""¬◊6rì∞¢ñÁ2Á'V‚Ü÷V‘∂Wí¬&76ó7FÁB"¬&W«íì∞¢F"Á&W&RÜDTƒUDRe$Ù“6ÜEˆ÷W76vW2tÑU$RV÷ñ¬“Ú‰BñB‰ıBî‚Ä¢4TƒT5BñBe$Ù“6ÜEˆ÷W76vW2tÑU$RV÷ñ¬“Úı$DU"%íñBDU42ƒî‘ïBCñíÁ'V‚Ü÷V‘∂Wí¬÷V‘∂Wíì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂6ÜE“6fS¢"¬RÊ÷W76vRì≤–¢–†¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&W«í¬÷V÷˜'ì¢÷V‘∂Wí“ì∞ß“ì∞†¢ÚÚ,:ñffñ6ÜR∆6ˆÁfW'6Fñˆ‚FR¬wWFñ∆ó6FWW":¬v˜WfW'GW&RGR6ÜB‡¶Á˜7BÇ"ˆ6ÜBˆÜó7F˜'í"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BWFÇ“ÜV÷ñ¬bb6ˆFRíÚ&Ê∑&ˆ∆ƒWFÇÜV÷ñ¬¬6ˆFRí¢ÁV∆√∞¢ñbÇWFÇí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷W76vW3¢µ““ì∞¢G'í∞¢6ˆÁ7B&˜w2“F"Á&W&RÇ%4TƒT5B&ˆ∆R¬6ˆÁFVÁBe$Ù“6ÜEˆ÷W76vW2tÑU$RV÷ñ¬“Úı$DU"%íñBDU42ƒî‘ïB#"íÊ∆¬ÜWFÇÊV÷ñ¬íÁ&WfW'6RÇì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷W76vW3¢&˜w2“ì∞¢“6F6ÇÖÚí≤&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷W76vW3¢µ““ì≤–ß“ì∞†¢ÚÚ)H)Hñ6≤GR¶˜W"WFÚ(	B¬tí6Üˆó6óB∆R÷Vñ∆∆WW"ñ6≤g&ó2ÜÜ˜'2∆ñwVW2WÜ6«VW2í)H)H ¢ÚÚ∆R6ˆÊ6ñ∆RóFÜˆ‚ÊRWWB2:ñ7&ó&R˜ñ6∑2˜ñ6∑2Êß6ˆ‚á2FRfˆ«V÷R'F|:íí¿¢ÚÚFˆÊ2¬tí,:ñ|:ñÏ:á&RV∆∆R÷‹:¶÷R∆Rñ6≤GR¶˜W"FWVó26W2Ê«ó6W2‚ñÁ6í∆R÷F6Ä¢ÚÚGR¶˜W"6R÷WB:¶˜W"F˜WB6WV¬6ÜVR¶˜W"¬6Á2¶÷ó2ffñ6ÜW"VÊR∆ñwVRWÜ6«VR‡¢ÚÚg&ó2Êˆ◊2FW2RvVÁG2ˆffñ6ñV«2FÁ2V‚FWáFRV&∆ñ2áfW'6ñˆ‚,:óWFñ∆ó6&∆R¿¢ÚÚ÷V÷R&Vv∆RVR÷6¥îÊ÷W2«W2ÜWBFÁ2'V‰6ˆÊ6ñ∆TÊ«ó6ó2¢¶÷ó2$6ÜñVb"¿¢ÚÚf∆∆&6∑2ñÁFW&ÊW2&W7FVÁBvVÊW&óVW2í‡¶gVÊ7Fñˆ‚÷6¥îÊ÷W4v∆ˆ&¬áFWáBí∞¢ñbÇFWáBí&WGW&‚"#∞¢6ˆÁ7B÷“∞¢≤ıW'∆WÜóGï≤“”ıvV"ˆví¬%W'∆WÜóGí%“¬≤ÙFVW6VVµ≤“”ıc2ˆví¬$FVW6VV≤%“¿¢≤Ù÷ó7G&≈≤“”Ù∆&vRˆví¬$÷ó7G&¬%“¬≤Ù6ˆÜW&U≤“”Ù6ˆ÷÷ÊBˆví¬$6ˆÜW&R%“¿¢≤Ù˜VÂ&˜WFW%≤“”ıvV‚ˆví¬%vV‚%“¿¢≤Ù6∆VFU≤“”Ù6ÜñVbˆví¬$6ˆÊ6ñ∆R%“¿¢≤ÙuE≤“”ÛFÛı≤“”ˆ÷ñÊíˆví¬$î%“¬≤ÙuE≤“”ÙÊ«ó6ó2ˆví¬$î%“¿¢≤ÙvV÷ñÊîf∆6Çˆví¬$î%“¬≤Ù÷ó7G&≈≤“”ı6÷∆¬ˆví¬$î%“¿¢≤Ù÷ó7G&≈≤“”Ût"ˆví¬$î%“¬≤Ù6W&V'&5≤“”Ù∆∆÷ˆví¬$î%“¿¢≤Ùı%≤“”Ù÷ó7G&√t"ˆví¬$î%“¬≤Ùw&˜≤“”Ù∆∆÷∆B¢ˆví¬$î%“¿¢≤Ù∆∆÷≤“”ı∆Bµ∂$%”Úˆví¬$î%“¬≤ÙvV÷ñÊíˆví¬$î%“¿¢”∞¢∆WB"“FWáC∞¢f˜"Ü6ˆÁ7B∑&R¬&W“ˆb÷í"“"Á&W∆6Rá&R¬&Wì∞¢&WGW&‚#∞ß–†¶gVÊ7Fñˆ‚&Vg&W6ÑFñ«ïñ6¥g&ˆ‘D"Çí∞¢G'í∞¢6ˆÁ7BˆF"“ÊWrFF&6RÑD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜w2“ˆF"Á&W&RÄ¢%4TƒT5B÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬6˜VÁG'í¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬6ˆÁ6VÁ7W5˜f˜FW2¬&V≈ˆˆFB¬&V≈ˆˆFE˜6˜W&6R¬6˜FU˜7VvvW7FVB¬&ó6ˆ‚¬Üˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆvÚ¬˜WF6ˆ÷R¬Ê«ó6VEˆB¬÷ñÁWFUˆEˆÊ«ó6ó2¬Üˆ÷Uˆf˜&“¬vïˆf˜&“¬Üˆ÷Uˆvˆ«5ˆfr¬vïˆvˆ«5ˆfr¬fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬6ñu˜6VÁE˜7FÊF&B¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFR¬6ñu˜6VÁEˆg&VR¬FñfgW6ñˆÂˆ&∆ˆ6≤"∞¢$e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RÊ«ó6VEˆB„“FFWFñ÷RÇvÊ˜rr¬r”rFó2rí‰B6ˆÊfñFVÊ6Rï2‰ıBÂTƒ¬‰BÜˆ÷Rï2‰ıBÂTƒ¬"∞¢$ı$DU"%í6ˆÊfñFVÊ6RDU42¬ñBDU42ƒî‘ïB3 ¢íÊ∆¬Çì∞¢ˆF"Ê6∆˜6RÇì∞¢6ˆÁ7BFˆFîï4Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢ÚÚ#ÜL:ñ6ó6ñˆ‚fˆÊFFWW"#ÇÛrÛ##bí¢∆<:ñ∆V7Fñˆ‚6RfóB7W"∆6˜FR,:ñV∆∆P¢ÚÚ$§T¬¬«W27W"∆÷ñÁWFR(	B¬vÊ6ñVÊÊRfVÏ:ßG&R#R”cRrW7B7W&ñ‹:ñRñ6íW76ê¢ÚÚ˜W"&W7FW"6ˆå:ó&VÁFRfV2∆R&W7FRGRóV∆ñÊRáfˆó"UDıÙ4Ù‰4îƒUıDî‘Uıtî‰Dırí‡¢ÚÚ6ˆÊfñFVÊ6R„“vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇíá6WVñ¬V∆óFR¬∆R«W2W&÷ó76ñbí†¢ÚÚ6Á26Rfñ«G&R¬∆Rñ6≤w&GVóBffñ6å:íV‚fóG&ñÊR7W"¬v67VVñ¬˜Wfó@¢ÚÚWG&R«W2fñ&∆RVRDıUB6RVí'B&VV∆∆V÷VÁB7W"FV∆Vw&“Ü6ˆÁ7FFP¢ÚÚ∆R3ÛrÛ##b¢ñ6≤srRffñ6ÜR∆˜'2VR∆R6WVñ¬÷ñÊñ◊V“FP¢ÚÚFñfgW6ñˆ‚¬÷V÷RV∆óFR¬W7BÉ"R(	Bñ◊&W76ñˆ‚G&ˆ◊WW6RBwV‚6ñvÊ¿¢ÚÚ'G&˜WfR"÷ó2¶÷ó2VÁf˜ñR¬∆˜'2Rvñ¬‚v¶÷ó2WFR76W¢6ˆ∆ñFRí‡¢ÚÚñ6≤GR¶˜W"&W7G&VñÁB:B÷&6å:ó26ñ◊∆W2:6ˆ◊&VÊG&R˜W"V‚fó6óFWW ¢ÚÚÊˆ‚÷ñÊóFú:íÜFV÷ÊFRFRw&Vr∆R3ÛrÛ##bí¢fñ7Fˆó&RFˆ÷ñ6ñ∆RˆWáL:ó&ñWW"¿¢ÚÚ%EE2¬VÊFW""„R'WG2‚WÜ6«WB$÷F6ÇÁV¬"¬$˜fW""„R"¬F˜V&∆R6ÜÊ6R‚‚‡¢ÚÚVí‚vˆÁB2∆WW"∆6RV‚fóG&ñÊRw&ÊBV&∆ñ2‚8ñ∆ñ÷ñÊRW76íFRf7F¢ÚÚ∆W27˜'G2Êˆ‚÷fˆ˜F&∆¬Ü&6∂WBˆÜˆ6∂Wí‚vˆÁB26W2÷&6å:ó2í¬6RVê¢ÚÚ,:Üv∆R"∆‹:¶÷Rˆ666ñˆ‚∆R62FW2FˆÊÏ:ñW2∆ófR6˜'&ˆ◊VW2<;GL:ê¢ÚÚ&6∂WBáfˆó"∆R6˜'&V7FñbGR3ÛrÛ##b7W"F˜&ˆÁFÚFV◊ÚÙ÷ñÊÊW6˜F«ñÁÇí‡¢6ˆÁ7BV∆ñvñ&∆R“&˜w2Êfñ«FW"á"”‚"ÊÜˆ÷Rbb"Êvíbbó4WÜ6«VFVDg&ˆ’ñ6∑2á"ê¢bbÁV÷&W"á"Ê6ˆÊfñFVÊ6Rí„“vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇê¢bbá"ÊÊ«ó6VEˆB«¬""íÁ6∆ñ6RÉ¬í””“FˆFîï4¢bbó5fW&ñfñVD6∆ñVÁD˜S#U&˜rá"íì∞¢ñbÇV∆ñvñ&∆RÊ∆VÊwFÇí≤6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂Fñ«í◊ñ6µ“V7V‚ñ6≤V∆ñvñ&∆R7W"v¢ÜÜ˜'2&∆6∂∆ó7B¬6WVñ¬"≤vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇí≤"R¬÷&6ÜW2WF˜&ó6W2í(	Bñ6≤ñÊ6ÜÊ|:í"ì≤&WGW&‚f«6S≤–¢ÚÚ&ñ˜&óL:í¢V‚÷F6ÇBtT§ıU$BtÖTíL:ñ¨:$U4Ù≈Rá66˜&RfñÊ¬,:ñV∆∆V÷VÁ@¢ÚÚ6ˆÊfó&‹:í"Ê˜26˜W&6W2(	B2vW7B∆6WV∆Rv&ÁFñRRvˆ‚ffñ6ÜRV‡¢ÚÚ÷F6ÇVíWÜó7FRg&ñ÷VÁBWB2V‚F˜V&∆ˆ‚ˆFˆÊÏ:ñR6˜'&ˆ◊VRí‡¢ÚÚ&ñ˜&óL:í"¢6ñÊˆ‚¬∆R÷Vñ∆∆WW",:ó6ˆ«R,:ñ6VÁBÉv¢¬fóG&ñÊRí‡¢ÚÚ&ñ˜&óL:í2¢6ñÊˆ‚¬V‚FW&ÊñW"&V6˜W'2¬V‚÷F6ÇGR¶˜W"$T4T‘‘TÂBÊˆ‡¢ÚÚ,:ó6ˆ«Rág&ñ÷VÁBV‚6˜W'2í(	B6WV¬62¸;íˆ‚&VÊBV‚&ó7VR¬fWFP¢ÚÚBv«FW&ÊFófRl:ó&ñfú:ñR‡¢ÚÚ&ñ˜&óL:íB¢6ñÊˆ‚¬∆R«W26ˆÊfñÁBGR¶˜W"VV¬VR6ˆóB6ˆ‚:óFB‡¢Ú¢ÚÚfÁB¬V‚÷F6ÇÊˆ‚,:ó6ˆ«R¬vV◊˜'FóBDıT§ıU%27W"V‚÷F6Ç,:ó6ˆ«R‡¢ÚÚFWWÇ'Vw2Fó7FñÊ7G26ˆÁ7FL:ó2∆R3ÛrÛ##b:6W6RFR:v†¢ÚÚÜí%F˜&ˆÁFÚFV◊Úg2÷ñÊÊW6˜F«ñÁÇ"Öt‰$¬FˆÊÏ:ñW26˜'&ˆ◊VW2–¢ÚÚ66˜&Rs"”B∆R÷ñÁWFR¬ñ◊˜76ñ&∆RV‚&6∂WBí&W7Fó@¢ÚÚffñ6å:íF˜WFR∆¶˜W&Ï:ñR6Á2¶÷ó26R,:ó6˜VG&R∞¢ÚÚÜ"í∆R‘T‘R÷F6Ç,:ñV¬Ê«ó<:íFWWÇfˆó2"FWWÇ6˜W&6W2Fñfl:ó&VÁFW0¢ÚÚ6˜W2FWWÇ˜'FÜˆw&ÜW2Ç%f∆W&VÊvÙÜ“‘∂“"<;GL:íí◊7˜'G2¬L:ñ¨: ¢ÚÚvvÏ:í¬e2%l:V∆W&VÊvÙÜ÷&∂÷W&FVÊR"<;GL:íFÜU7˜'G4D"¬¶÷ó0¢ÚÚ,:ó6ˆ«Rí(	B∆fW'6ñˆ‚Êˆ‚,:ó6ˆ«VRWBÊˆ‚l:ó&ñfñ&∆R¬vV◊˜'Fó@¢ÚÚ7W"∆fW'6ñˆ‚L:ñ¨:6ˆÊfó&‹:ñRvvÊÁFRGR‘T‘R÷F6Ç‡¢ÚÚˆ‚ñÁfW'6RFˆÊ2∆&ñ˜&óL:í¢∆fñ&ñ∆óL:í&ñ÷R7W"∆g&:Ê6ÜWW"‡¢6ˆÁ7B$T4TÂEıTÂ$U4Ù≈dTEÙ’2“B¢3c≤ÚÚFÇ¢R÷FVÃ:¬ˆ‚6ˆÁ6ñL:á&R∆R÷F6Ç&ÊFˆÊÏ:íˆ6˜'&ˆ◊R¬2&V‚6˜W'2 ¢6ˆÁ7BÊ«ó6VDD◊2“á"í”‚∞¢6ˆÁ7BB“ÊWrFFRÖ7G&ñÊrá"ÊÊ«ó6VEˆB«¬""íÁ&W∆6RÇ""¬%B"í≤%¢"íÊvWEFñ÷RÇì∞¢&WGW&‚ÁV÷&W"Êó4fñÊóFRáBíÚB¢∞¢”∞¢6ˆÁ7BFˆFó2“V∆ñvñ&∆RÊfñ«FW"á"”‚á"ÊÊ«ó6VEˆB«¬""íÁ6∆ñ6RÉ¬í””“FˆFîï4Úì∞¢ÚÚ&ñ˜&óL:í"G&ú:ñR",8î4T‰4Rá26ˆÊfñÊ6Rí¢6ñÊˆ‚V‚fñWWÇñ6≤: ¢ÚÚÉRRvvÏ:íñ¬íb¶˜W'2&W7FR:óFW&ÊV∆∆V÷VÁB6Ü◊ñˆ‚f6R:FW2ñ6∑0¢ÚÚBvV¶˜W&BváVí:É”ÉBR2VÊ6˜&R,:ó6ˆ«W2Ü÷F6ÇV‚6˜W'2í(	B6ˆÁ7FL:ê¢ÚÚ∆RBÛÇÛ##b¬∆Rñ6≤GR¶˜W"&W7FóB&∆˜\:í7W"V‚÷F6ÇGR3Ûr‡¢6ˆÁ7B'ï&V6VÊ7í“V∆ñvñ&∆RÁ6∆ñ6RÇíÁ6˜'BÇÜ¬"í”‚Ê«ó6VDD◊2Ü"í“Ê«ó6VDD◊2Üíì∞¢∆WBñ6≤“FˆFó2ÊfñÊBá"”‚"Ê˜WF6ˆ÷R””“'vñ‚"«¬"Ê˜WF6ˆ÷R””“&∆˜72"ê¢«¬'ï&V6VÊ7íÊfñÊBá"”‚"Ê˜WF6ˆ÷R””“'vñ‚"ê¢«¬FˆFó2ÊfñÊBá"”‚"Ê˜WF6ˆ÷R””“ÁV∆¬bbÑFFRÊÊ˜rÇí“Ê«ó6VDD◊2á"íí¬$T4TÂEıTÂ$U4Ù≈dTEÙ’2ê¢«¬FˆFó5≥–¢«¬V∆ñvñ&∆U≥”∞¢ñbÇñ6≤í≤6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂Fñ«í◊ñ6µ“V7V‚ñ6≤V∆ñvñ&∆R"ì≤&WGW&‚f«6S≤–¢6ˆÁ7B÷F6ÑFFR“áñ6≤ÊÊ«ó6VEˆB«¬""íÁ6∆ñ6RÉ¬í«¬FˆFîï4Û∞¢6ˆÁ7B6˜FUf¬“&˜tˆFBáñ6≤ì∞¢6ˆÁ7BFF“∞¢7W'&VÁEñ6≥¢∞¢Üˆ÷S¢ñ6≤ÊÜˆ÷R¬vì¢ñ6≤Êví¿¢6ˆ◊WFóFñˆ„¢ñ6≤Ê6ˆ◊WFóFñˆ‚«¬ñ6≤Á7˜'B«¬$fˆ˜F&∆¬"¿¢7˜'C¢ñ6≤Á7˜'B«¬$fˆ˜F&∆¬"¿¢FFS¢÷F6ÑFFR¬Fñ÷S¢""¿¢&W7Eˆ&WC¢ñ6≤Ê&W7Eˆ&WB«¬$Ê«ó6Rî"¬6ˆÊfñFVÊ6S¢ñ6≤Ê6ˆÊfñFVÊ6R¿¢6˜FS¢ÁV÷&W"Ü6˜FUf¬ÁFÙfóÜVBÉ"íí¿¢&ˆˆ∂÷∂W#¢áñ6≤Á&V≈ˆˆFE˜6˜W&6RbbˆW7Fñ÷Fñˆ‚ˆíÁFW7BÖ7G&ñÊráñ6≤Á&V≈ˆˆFE˜6˜W&6RíííÚ7G&ñÊráñ6≤Á&V≈ˆˆFE˜6˜W&6Rí¢ÁV∆¬¿¢&ó6ˆ„¢÷6¥îÊ÷W4v∆ˆ&¬áñ6≤Á&ó6ˆ‚«¬""í¿¢Üˆ÷Uˆ∆ˆvÛ¢ñ6≤ÊÜˆ÷Uˆ∆ˆvÚ«¬ÁV∆¬¬vïˆ∆ˆvÛ¢ñ6≤Êvïˆ∆ˆvÚ«¬ÁV∆¬¿¢Üˆ÷Uˆf˜&”¢ñ6≤ÊÜˆ÷Uˆf˜&“«¬ÁV∆¬¬vïˆf˜&”¢ñ6≤Êvïˆf˜&“«¬ÁV∆¬¿¢Üˆ÷Uˆvˆ«5ˆfs¢ñ6≤ÊÜˆ÷Uˆvˆ«5ˆfr“ÁV∆¬Úñ6≤ÊÜˆ÷Uˆvˆ«5ˆfr¢ÁV∆¬¿¢vïˆvˆ«5ˆfs¢ñ6≤Êvïˆvˆ«5ˆfr“ÁV∆¬Úñ6≤Êvïˆvˆ«5ˆfr¢ÁV∆¬¿¢ÚÚÜWW&RGR÷F6ÇV‚UD2Wá∆ñ6óFRÖ5∆óFR7Fˆ6∂RÊ«ó6VEˆBV‚UD0¢ÚÚ6Á27VffóÜRí¢∆RÊfñvFWW"GRfó6óFWW"∆&V6ˆÁfW'FóBVÁ7VóFP¢ÚÚFÁ24Ù‚gW6VR∆ˆ6¬fñFÙ∆ˆ6∆UFñ÷U7G&ñÊrÇí¬WRñ◊˜'FR∆P¢ÚÚó2FR6ˆÊÊWÜñˆ‚‚FV÷ÊFRFRw&Vr∆R3ÛrÛ##b‡¢÷F6ÖFñ÷S¢ñ6≤ÊÊ«ó6VEˆBÚ7G&ñÊráñ6≤ÊÊ«ó6VEˆBíÁ&W∆6RÇ""¬%B"í≤%¢"¢ÁV∆¬¿¢6˜W&6S¢&WFÚ÷í"¬V&∆ó6ÜVDC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢ÚÚ66˜&RWB7FGWB&VV«2GR÷F6Ç¢W&÷WGFVÁBBvffñ6ÜW"∆R&W7V«F@¢ÚÚá66˜&RfñÊ¬≤vvÊR˜W&GRíFW2VR∆R÷F6ÇW7BFW&÷ñÊR¬6Á0¢ÚÚGFVÊG&R∆R&ˆ6Üñ‚6ÜÊvV÷VÁBFR¶˜W"‚÷ó2¶˜W""∆R÷V÷P¢ÚÚ&Vg&W6ÇÜ˜&ó&Ráfˆó"6WDñÁFW'f¬&Vg&W6ÑFñ«ïñ6¥g&ˆ‘D"¬Çí‡¢7FGW3¢ñ6≤Ê˜WF6ˆ÷R””“'vñ‚"Ú'vñ‚"¢ñ6≤Ê˜WF6ˆ÷R””“&∆˜72"Ú&∆˜72"¢'W6ˆ÷ñÊr"¿¢66˜&S¢áñ6≤ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬bbñ6≤ÊfñÊ≈˜66˜&Uˆví“ÁV∆¬ê¢ÚG∑ñ6≤ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑ñ6≤ÊfñÊ≈˜66˜&Uˆvó÷¢ÁV∆¬¿¢–¢”∞¢G'í≤g2Áw&óFTfñ∆U7ñÊ2ÑÑU$‘U5ıî4µ5ıDÇ¬•4Ù‚Á7G&ñÊvñgíÜFF¬ÁV∆¬¬"íì≤–¢6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Fñ«í◊ñ6µ“V7&óGW&S¢"¬RÊ÷W76vRì≤&WGW&‚f«6S≤–¢ÚÚÜó7F˜&óVRW'6ó7FÁB(	BVÊR∆ñvÊR"¶˜W"¬÷ó6R¶˜W"á2GW∆óVVRê¢ÚÚFÁBVR∆FFRÊR6ÜÊvR2¬÷V÷R6í∆Rñ6≤6ÜÊvR«W6ñWW'2fˆó0¢ÚÚFÁ2∆¶˜W&ÊVR˜R6R&W6˜WBVÁG&RFWWÇ76vW2‡¢G'í∞¢F"Á&W&RÜ ¢îÂ4U%BîÂDÚFñ«ï˜ñ6µˆ∆ˆrÜFFR¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&WB¬6ˆÊfñFVÊ6R¬6˜FR¬˜WF6ˆ÷R¬fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬Üˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆvÚê¢d≈TU2ÉÚ¬Ú¬Ú¬Ú¬Ú¬Ú¬Ú¬Ú¬Ú¬Ú¬Ú¬Ú¬Úê¢Ù‚4Ù‰dƒî5BÜFFRíDÚUDDR4U@¢Üˆ÷S÷WÜ6«VFVBÊÜˆ÷R¬vì÷WÜ6«VFVBÊví¬6ˆ◊WFóFñˆ„÷WÜ6«VFVBÊ6ˆ◊WFóFñˆ‚¬7˜'C÷WÜ6«VFVBÁ7˜'B¿¢&WC÷WÜ6«VFVBÊ&WB¬6ˆÊfñFVÊ6S÷WÜ6«VFVBÊ6ˆÊfñFVÊ6R¬6˜FS÷WÜ6«VFVBÊ6˜FR¬˜WF6ˆ÷S÷WÜ6«VFVBÊ˜WF6ˆ÷R¿¢fñÊ≈˜66˜&UˆÜˆ÷S÷WÜ6«VFVBÊfñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆvì÷WÜ6«VFVBÊfñÊ≈˜66˜&Uˆví¿¢Üˆ÷Uˆ∆ˆvÛ÷WÜ6«VFVBÊÜˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆvÛ÷WÜ6«VFVBÊvïˆ∆ˆv¢íÁ'V‚Ä¢÷F6ÑFFR¬ñ6≤ÊÜˆ÷R¬ñ6≤Êví¬ñ6≤Ê6ˆ◊WFóFñˆ‚«¬ñ6≤Á7˜'B«¬$fˆ˜F&∆¬"¬ñ6≤Á7˜'B«¬$fˆ˜F&∆¬"¿¢ñ6≤Ê&W7Eˆ&WB«¬""¬ñ6≤Ê6ˆÊfñFVÊ6R¬ÁV÷&W"Ü6˜FUf¬ÁFÙfóÜVBÉ"íí¬ñ6≤Ê˜WF6ˆ÷R«¬ÁV∆¬¿¢ñ6≤ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬Úñ6≤ÊfñÊ≈˜66˜&UˆÜˆ÷R¢ÁV∆¬¿¢ñ6≤ÊfñÊ≈˜66˜&Uˆví“ÁV∆¬Úñ6≤ÊfñÊ≈˜66˜&Uˆví¢ÁV∆¬¿¢ñ6≤ÊÜˆ÷Uˆ∆ˆvÚ«¬ÁV∆¬¬ñ6≤Êvïˆ∆ˆvÚ«¬ÁV∆¿¢ì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Fñ«í◊ñ6µ“∆ˆrÜó7F˜&óVS¢"¬RÊ÷W76vRì≤–¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂Fñ«í◊ñ6µ“WFÛ¢G∑ñ6≤ÊÜˆ÷W“g2G∑ñ6≤Êvó“ÇG∑ñ6≤Ê6ˆ◊WFóFñˆÁ“í6ˆÊbG∑ñ6≤Ê6ˆÊfñFVÊ6W÷ì∞¢&WGW&‚G'VS∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Fñ«í◊ñ6µ“"¬RÊ÷W76vRì≤&WGW&‚f«6S≤–ß–†¢ÚÚÜó7F˜&óVRGRñ6≤GR¶˜W"(	B∆ñ÷VÁFR¬vˆÊv∆WBL:ñFú:í7W"˜W&f˜&÷Ê6W2‡¶ÊvWBÇ"ˆFñ«í◊ñ6≤÷Üó7F˜'í"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B∆ñ÷óB“÷FÇÊ÷ñ‚á'6TñÁBá&WÁVW'íÊ∆ñ÷óBí«¬3¬ì∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BFFR¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&WB¬6ˆÊfñFVÊ6R¬6˜FR¬˜WF6ˆ÷R¬fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬Üˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆv¢e$Ù“Fñ«ï˜ñ6µˆ∆ˆrı$DU"%íFFRDU42ƒî‘ïB¢íÊ∆¬Ü∆ñ÷óBì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬ñ6∑3¢&˜w2“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Fñ«í◊ñ6≤÷Üó7F˜'ï“"¬RÊ÷W76vRì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢&ñÁFW&Ê≈ˆW'&˜""“ì∞¢–ß“ì∞†¢ÚÚ∆Rñ6≤7Fˆ6º:íW7B÷ñ¬g&ó2ÜV¶˜W&BváVííWBBwVÊR∆ñwVRWF˜&ó<:ñR¶gVÊ7Fñˆ‚7F˜&VEñ6¥ó4g&W6ÇÇí∞¢G'í∞¢6ˆÁ7B&r“•4Ù‚Á'6RÜg2Á&VDfñ∆U7ñÊ2ÑÑU$‘U5ıî4µ5ıDÇ¬'WFcÇ"íì∞¢6ˆÁ7B“&rÊ7W'&VÁEñ6≥∞¢ñbÇ«¬ÊÜˆ÷R«¬ÊÜˆ÷R””“$Ê«ó6RV‚6˜W'2"í&WGW&‚f«6S∞¢ñbáÁ6˜W&6R””“&WFÚ÷É&Ç◊6VVB"í&WGW&‚f«6S∞¢6ˆÁ7BFˆFîï4Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BFFR“áÊFFR«¬áÁV&∆ó6ÜVDB«¬""íÁ6∆ñ6RÉ¬í«¬""íÁ6∆ñ6RÉ¬ì∞¢ñbáFFR”“FˆFîï4Úí&WGW&‚f«6S∞¢ñbÜó4WÜ6«VFVDg&ˆ’ñ6∑2áíí&WGW&‚f«6S∞¢ñbÇó4˜S#T&WBáÊ&W7Eˆ&WB«¬Ê&WBíí&WGW&‚f«6S∞¢ÚÚf˜&6RVÊR&VvVÊW&Fñˆ‚6í∆Rñ6≤7Fˆ6∂RW7B6˜W2∆R6WVñ¬FRFñfgW6ñˆ‡¢ÚÚ&VV¬áfˆó"&Vg&W6ÑFñ«ïñ6¥g&ˆ‘D"í(	B6ñÊˆ‚V‚ñ6≤FV¶&g&ó2 ¢ÚÚV¶˜W&BváVí÷ó2G&˜fñ&∆R&W7FW&óBffñ6ÜRßW7Rv÷ñÁVóB‡¢ñbáÊ6ˆÊfñFVÊ6R“ÁV∆¬bbÁV÷&W"áÊ6ˆÊfñFVÊ6Rí¬vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇíí&WGW&‚f«6S∞¢&WGW&‚G'VS∞¢“6F6Ç≤&WGW&‚f«6S≤–ß–†¢ÚÚFW&ÊñW"&Vg&W6Çf˜&<:íGRñ6≤GR¶˜W"ÜñÊL:óVÊFÁBFR7F˜&VEñ6¥ó4g&W6Ç¿¢ÚÚVíÊRL:óFV7FRRwV‚6ÜÊvV÷VÁBFR¶˜W"(	B2VÊR,:ó6ˆ«WFñˆ‚FR÷F6ÇV‡¢ÚÚ6˜W'2FR¶˜W&Ï:ñRí‚∆fˆÊÏ:í:ÇÛ&÷ñ‚˜W"ÊR2FW"∆D":6ÜVP¢ÚÚ6Ü&vV÷VÁBFRvR¬F˜WBV‚&W7FÁBV6íFV◊2,:ñV¬˜W"¬wWFñ∆ó6FWW"‡¶∆WBˆ∆7D7W'&VÁEñ6µ&Vg&W6Ç“∞¢ÚÚ)H)Hñ6≤GR¶˜W"(	B∆óBñ6∑2Êß6ˆ‚ÑÜW&‹:á2ˆ÷ÁVV¬ˆWFÚ‘íí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆ7W'&VÁB◊ñ6≤"¬á&W¬&W2í”‚∞¢ÚÚ6í∆Rñ6≤7Fˆ6º:í‚vW7B2BvV¶˜W&BváVí˜RfñVÁBBwVÊR∆ñwVRWÜ6«VR¬ˆ‚,:ñ|:ñÏ:á&P¢ñbÇ7F˜&VEñ6¥ó4g&W6ÇÇíí&Vg&W6ÑFñ«ïñ6¥g&ˆ‘D"Çì∞¢ÚÚ6ñÊˆ‚¬ˆ‚l:ó&ñfñRVÊB‹:¶÷R6í∆R÷F6ÇGRñ6≤ffñ6å:í2vW7BFW&÷ñÏ:ê¢ÚÚVÁG&R◊FV◊2á66˜&R˜7FGWBí(	B6Á2:v¬ñ¬f∆∆óBGFVÊG&R∆R&ˆ6Üñ‡¢ÚÚ76vRÜ˜&ó&R˜W"fˆó"∆R,:ó7V«FB¬ßW7R|:ÇFR&WF&B,:á2V‡¢ÚÚL:ó∆ˆñV÷VÁB‚FV÷ÊFRFRw&Vr∆R3ÛrÛ##b‡¢V«6RñbÑFFRÊÊ˜rÇí“ˆ∆7D7W'&VÁEñ6µ&Vg&W6Ç‚#í∞¢ˆ∆7D7W'&VÁEñ6µ&Vg&W6Ç“FFRÊÊ˜rÇì∞¢&Vg&W6ÑFñ«ïñ6¥g&ˆ‘D"Çì∞¢–¢ÚÚ‚W76ñRñ6∑2Êß6ˆ‚á6˜W&6RFRl:ó&óL:íí¬V‚WÜ6«VÁB∆W2∆ñwVW2&∆6∂∆ó7L:ñW0¢G'í∞¢6ˆÁ7B&r“•4Ù‚Á'6RÜg2Á&VDfñ∆U7ñÊ2ÑÑU$‘U5ıî4µ5ıDÇ¬'WFcÇ"íì∞¢6ˆÁ7B“&rÊ7W'&VÁEñ6≥∞¢6ˆÁ7B&V∆˜uFá&W6Üˆ∆B“bbÊ6ˆÊfñFVÊ6R“ÁV∆¬bbÁV÷&W"áÊ6ˆÊfñFVÊ6Rí¬vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇì∞¢6ˆÁ7BFFR“7G&ñÊráÚÊFFR«¬ÚÁV&∆ó6ÜVDB«¬""íÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BFˆFîï4Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢ñbábbÊÜˆ÷RbbÊÜˆ÷R”“$Ê«ó6RV‚6˜W'2"bbÁ6˜W&6R”“&WFÚ÷É&Ç◊6VVB"bbFFR””“FˆFîï4¢bbó4˜S#T&WBáÊ&W7Eˆ&WB«¬Ê&WBíbbó4WÜ6«VFVDg&ˆ’ñ6∑2áíbb&V∆˜uFá&W6Üˆ∆Bí∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬ñ6≥¢Ê˜&÷∆ó¶T7W'&VÁEñ6≤á¬Á6˜W&6R«¬&ÜW&÷W2"í“ì∞¢–¢“6F6ÇÜRí≤Ú¢ñ6∑2Êß6ˆ‚'6VÁB˜RñÁf∆ñFR¢Ú–¢ÚÚV7V‚6ñvÊ¬fW&ñfñRV¶˜W&BváVí¢ÊR2&V7ñ6∆W"V‚Ê6ñV‚ñ6≤÷ÁVV¿¢ÚÚ˜RV‚WG&R÷&6ÜR6ˆ÷÷R2vñ¬'FVÊóBR&ˆGVóBÚıR"√R‡¢∆WB∆7E&W7V«B“ÁV∆√∞¢G'í∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BFFR¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&WB¬6ˆÊfñFVÊ6R¬6˜FR¿¢˜WF6ˆ÷R¬fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬Üˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆv¢e$Ù“Fñ«ï˜ñ6µˆ∆ˆp¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢ı$DU"%íFFRDU42ƒî‘ïB3 ¢íÊ∆¬Çì∞¢∆WB&˜r“&˜w2ÊfñÊBÜ6ÊFñFFR”‚ó4˜S#T&WBÜ6ÊFñFFRÊ&WBíbbó4WÜ6«VFVDg&ˆ’ñ6∑2Ü6ÊFñFFRíì∞¢ÚÚ∆W2&V÷ñW'2¶˜W'27VófÁB¬v7FófFñˆ‚GR¶˜W&Ê¬V˜FñFñV‚¬6V«Ví÷6ê¢ÚÚWWB:ßG&RfñFR∆˜'2VRFW26ñvÊWÇFV∆Vw&“,:ó6ˆ«W2WÜó7FVÁBL:ñ¨:‡¢ÚÚ&W∆í7G&ñ7B¢VÊóVV÷VÁBV‚g&íÚıR"√RFñfgW<:í¬¶÷ó2VÊRÊ«ó6P¢ÚÚñÁFW&ÊR¬V‚FW7B˜RV‚,:ñ÷F6ÇÊˆ‚∆óg,:í‡¢ñbÇ&˜rí∞¢6ˆÁ7BFV∆ófW&VB“F"Á&W&RÜ ¢4TƒT5BFFRÜÊ«ó6VEˆBí2FFR¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¿¢&W7Eˆ&WB2&WB¬6ˆÊfñFVÊ6R¬&V≈ˆˆFB26˜FR¬˜WF6ˆ÷R¿¢fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬Üˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆv¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢‰B4ÙƒU44Rá6˜W&6U˜GóR¬v∆ófRrí√‚w&V÷F6Çp¢‰Bá6ñu˜6VÁEˆg&VS”ı"6ñu˜6VÁE˜7FÊF&C”ı"6ñu˜6VÁE˜&V÷óV””ı"6ñu˜6VÁEˆV∆óFS”ê¢‰B∆˜vW"ÜÜˆ÷Rí‰ıBƒî¥RrU∑FW7E“Rp¢‰B∆˜vW"Üvíí‰ıBƒî¥RrU∑FW7E“Rp¢ı$DU"%íFFWFñ÷RÜÊ«ó6VEˆBíDU42ƒî‘ïBS ¢íÊ∆¬Çì∞¢&˜r“FV∆ófW&VBÊfñÊBÜ6ÊFñFFR”‚ó4˜S#T&WBÜ6ÊFñFFRÊ&WBíbbó4WÜ6«VFVDg&ˆ’ñ6∑2Ü6ÊFñFFRíì∞¢–¢ñbá&˜rí∞¢∆7E&W7V«B“∞¢FFS¢&˜rÊFFR¬Üˆ÷S¢&˜rÊÜˆ÷R¬vì¢&˜rÊví¿¢6ˆ◊WFóFñˆ„¢&˜rÊ6ˆ◊WFóFñˆ‚¬7˜'C¢&˜rÁ7˜'B«¬$fˆ˜F&∆¬"¿¢&WC¢&˜rÊ&WB¬6ˆÊfñFVÊ6S¢&˜rÊ6ˆÊfñFVÊ6R¬6˜FS¢&˜rÊ6˜FR¿¢˜WF6ˆ÷S¢&˜rÊ˜WF6ˆ÷R¿¢fñÊ≈˜66˜&UˆÜˆ÷S¢&˜rÊfñÊ≈˜66˜&UˆÜˆ÷R¿¢fñÊ≈˜66˜&Uˆvì¢&˜rÊfñÊ≈˜66˜&Uˆví¿¢Üˆ÷Uˆ∆ˆvÛ¢&˜rÊÜˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆvÛ¢&˜rÊvïˆ∆ˆvÚ¿¢”∞¢–¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂7W'&VÁB◊ñ6µ“FW&ÊñW&R&WWfS¢"¬W'&˜"Ê÷W76vRì∞¢–¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬ñ6≥¢ÁV∆¬¬∆7E&W7V«B“ì∞ß“ì∞†¢ÚÚ)H)HvW24TÚá&ˆÊ˜7Fñ72í(	B6ˆÁFVÁRV&∆ñ2ñÊFWÜ&∆R)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚˆ‚ÊR|:ñÏ:á&RFW2vW2TR˜W"∆W2Ê«ó6W2,:ó6ˆ«VW2ávñ‚ˆ∆˜72í¢6R6ˆÁBFW0¢ÚÚ&WWfW2Üó7F˜&óVW2Ü6ˆ÷÷R˜W&f˜&÷Ê6W2í¬V7V‚ñ6≤ñÁB‚vW7BL:ófˆñÃ:í‡¶gVÊ7Fñˆ‚6VıV&∆ó6ÜVE&˜w2Ü∆ñ÷óBí∞¢G'í∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5B÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬6˜VÁG'í¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬&ó6ˆ‚¬&V≈ˆˆFB¿¢&V≈ˆˆFE˜6˜W&6R¬˜WF6ˆ÷R¬Ê«ó6VEˆB¬÷ñÁWFUˆEˆÊ«ó6ó2¬6ˆÁ6VÁ7W5˜f˜FW2¿¢6ñu˜6VÁE˜7FÊF&B¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFR¬6ñu˜6VÁEˆg&VR¬FñfgW6ñˆÂˆ&∆ˆ6∞¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RFFRÜÊ«ó6VEˆBí„“s##b”r”2p¢‰B6ˆÊfñFVÊ6R„“G∂vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇó–¢‰B˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢ı$DU"%íÊ«ó6VEˆBDU40¢íÊ∆¬Çì∞¢&WGW&‚FVGWTÊ«ó6W4'î÷F6Çá&˜w2Êfñ«FW"á"”‚ó4Êˆó6Tf˜$Fó7∆íá"íbbó5fW&ñfñVD6∆ñVÁD˜S#U&˜rá"íííÁ6∆ñ6RÉ¬∆ñ÷óBíÊ÷á"”‚á∞¢Üˆ÷S¢"ÊÜˆ÷R¬vì¢"Êví¬6ˆ◊WFóFñˆ„¢"Ê6ˆ◊WFóFñˆ‚¬7˜'C¢"Á7˜'B«¬$fˆ˜F&∆¬"¿¢FFS¢"ÊÊ«ó6VEˆB¬&WC¢÷6¥îÊ÷W4v∆ˆ&¬á"Ê&W7Eˆ&WB«¬$Ê«ó6Rî"í¿¢6ˆÊfñFVÊ6S¢"Ê6ˆÊfñFVÊ6R¬6˜FS¢&˜tˆFBá"í¬˜WF6ˆ÷S¢"Ê˜WF6ˆ÷R¿¢&V6ˆÊñÊs¢÷6¥îÊ÷W4v∆ˆ&¬á"Á&ó6ˆ‚«¬""í¿¢“íì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑6Vı“&˜w3¢"¬RÊ÷W76vRì≤&WGW&‚µ”≤–ß–†¢ÚÚ&˜WFR&˜áñVR"6FGí÷ó26Á2vW7FñˆÊÊó&RFWVó267&VFñˆ‚ñÊóFñ∆P¢ÚÚÜV7VÊRG&6RFRÜÊF∆W"&WG&˜WfVRí““&VFó&ñvRfW'2∆vRVí6˜Wg&RFV¶¢ÚÚ6WGFRñÁFVÁFñˆ‚FR&V6ÜW&6ÜR«WF˜BVRFR∆ó76W"VÊRCB7W"VÊRU$¬6ñ&∆R‡¶ÊvWBÇ"˜6ñvÊWÇ◊7˜'Fñg2÷ñ"¬á&W¬&W2í”‚∞¢&W2Á&VFó&V7BÉ3¬"˜&ˆÊ˜7Fñ72"ì∞ß“ì∞†¶ÊvWBÇ"˜&ˆÊ˜7Fñ72"¬á&W¬&W2í”‚∞¢6ˆÁ7BóFV◊2“6VıV&∆ó6ÜVE&˜w2ÉSì∞¢&W2Á6WBÇ$6ˆÁFVÁB’GóR"¬'FWáBˆáF÷√≤6Ü'6WC◊WFb”Ç"ì∞¢&W2Á6VÊBá6VıvW2Á&VÊFW$ñÊFWÇÜóFV◊2íì∞ß“ì∞†¶ÊvWBÇ"˜&ˆÊ˜7Fñ2Ûß6«Vr"¬á&W¬&W2í”‚∞¢6ˆÁ7BóFV◊2“6VıV&∆ó6ÜVE&˜w2ÉSì∞¢6ˆÁ7B6«Vr“7G&ñÊrá&WÁ&◊2Á6«Vr«¬""íÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7BóFV““óFV◊2ÊfñÊBÜóB”‚6VıvW2Ê÷F6Ö6«VrÜóBí””“6«Vrì∞¢ñbÇóFV“í≤&W2Á&VFó&V7BÉ3"¬"˜&ˆÊ˜7Fñ72"ì≤&WGW&„≤–¢6ˆÁ7B&V∆FVB“óFV◊2Êfñ«FW"ÜóB”‚6VıvW2Ê÷F6Ö6«VrÜóBí”“6«VríÁ6∆ñ6RÉ¬bì∞¢&W2Á6WBÇ$6ˆÁFVÁB’GóR"¬'FWáBˆáF÷√≤6Ü'6WC◊WFb”Ç"ì∞¢&W2Á6VÊBá6VıvW2Á&VÊFW$FWFñ¬ÜóFV“¬&V∆FVBíì∞ß“ì∞†¶ÊvWBÇ"˜6óFV÷◊&ˆÊ˜7Fñ72ÁÜ÷¬"¬á&W¬&W2í”‚∞¢6ˆÁ7BóFV◊2“6VıV&∆ó6ÜVE&˜w2Éì∞¢&W2Á6WBÇ$6ˆÁFVÁB’GóR"¬&∆ñ6Fñˆ‚˜Ü÷√≤6Ü'6WC◊WFb”Ç"ì∞¢&W2Á6VÊBá6VıvW2Á&VÊFW%6óFV÷ÜóFV◊2íì∞ß“ì∞†¢ÚÚ)H)H7FG2"∆ñW"Ö7FÊF&BÚ&V÷óV“ÚV∆óFRí(	BñL:ñR'6ñvÊWÇ"∆ñW"")H ¢ÚÚáñ'&ñFR¢&Êr"6ˆÊfñÊ6R¬6ˆÁFVÁR"Fó7Ú$§T¬‡¢ÚÚ7FÊF&B“$§T¬b6ˆÊfñÊ6R„“ÉÇÜ∆W2f∆WW&ˆÁ2¬fñ&∆Rfˆ«V÷Rê¢ÚÚ&V÷óV““$§T¬b6ˆÊfñÊ6R„“ÉRÜñÊ6«WB7FÊF&Bê¢ÚÚV∆óFR“F˜WB∆RV&∆ú:í„“vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇíÑ$§T¬≤$î6WV∆V÷VÁB"ê¢ÚÚ∆V7GW&R6WV∆R‚6ÜVR∆ñW"6ˆ‚&˜&RG&6≤&V6˜&BáF˜F¬¬vñÁ&FR¬$Ùí6ñ◊VÃ:íí‡¶gVÊ7Fñˆ‚&˜tó4&¶V¬á"í∞¢&WGW&‚$§T≈Ù$ÙÙ¥‘¥U%2Á6ˆ÷RÜ”‚7G&ñÊrá"Á&V≈ˆˆFE˜6˜W&6R«¬""íÁFÙ∆˜vW$66RÇíÊñÊ6«VFW2Üíê¢«¬ó4&¶Vƒ÷¶˜$6ˆ◊WFóFñˆ‚á"ì∞ß–†¢ÚÚ8ñ∆ñvñ&ñ∆óL:íBwVÊRÊ«ó6R:V‚∆ñW"(	B‘ï$Ùï"UÑ5BFW2,:Üv∆W2FRFñfgW6ñˆ‡¢ÚÚFV∆Vw&“Ü6b‚w&FU7FÊF&Bˆw&FU&V÷óV“ˆw&FTV∆óFRFÁ2'V‰WFÙ6ˆÊ6ñ∆Rí‡¢ÚÚ∆W27FFó7FóVW2V&∆óVW2L:ñ7&ófVÁBñÁ6í6RVR¬v&ˆÊÏ:í&\:vˆóB,:ñV∆∆V÷VÁB¿¢ÚÚWBÊˆ‚V‚:ñ6ÜÁFñ∆∆ˆ‚«W2∆&vR¢2vW7B∆6WV∆Rf:vˆ‚VR∆RG&6≤&V6˜&@¢ÚÚffñ6å:í6˜'&W7ˆÊFRR&ˆGVóBfVÊGR‡¢ÚÚ÷ˆL:Ü∆Rñ÷'&ó\:í¢V∆óFR(®r&V÷óV“(®r7FÊF&B‡¶gVÊ7Fñˆ‚FñW$V∆ñvñ&∆Rá"¬FñW"í∞¢6ˆÁ7B6ˆÊb“ÁV÷&W"á"Ê6ˆÊfñFVÊ6Rí«¬∞¢ñbÇ&˜tó4&¶V¬á"íí&WGW&‚f«6S∞¢6ˆÁ7B˜&Ú“ÁV÷&W"á"Á&V≈ˆˆFBí«¬∞¢ñbÖ˜&Ú¬DîU%Ù‘îÂı$T≈ÙÙDB«¬˜&Ú‚DîU%Ù‘Öı$T≈ÙÙDBí&WGW&‚f«6S∞¢6ˆÁ7B7˜'B“7G&ñÊrá"Á7˜'B«¬$fˆ˜F&∆¬"íÁFÙ∆˜vW$66RÇì∞¢6ˆÁ7Bó4fˆ˜B“7˜'BÊñÊ6«VFW2Ç&fˆ˜B"ì∞¢ÚÚ6WVñ«2Eî‰‘ïTU2ÜvWEFñW%Fá&W6Üˆ∆G2í¬2∆W26ˆÁ7FÁFW2fñvVW0¢ÚÚ5D‰D$EÙ‘îÂÙ4Ù‰bı$T‘ïT’Ù‘îÂÙ4Ù‰bˆvWDV∆óFT÷ñ‰6ˆÊbÇí¢∆FñfgW6ñˆ‚FV∆Vw&–¢ÚÚ&VV∆∆Rá'V‰WFÙ6ˆÊ6ñ∆R¬w&FU7FÊF&Bˆw&FU&V÷óV“ˆw&FTV∆óFRíWFñ∆ó6RFV¶¢ÚÚ∆R6WVñ¬GñÊ÷óVR&V6∆ñ'&R6ÜVR¶˜W"‚fÁB6R6˜'&V7Fñb¬˜W&f˜&÷Ê6W0¢ÚÚffñ6ÜóBV‚6WVñ¬7FÊF&BfñvRÉÇ∆˜'2VR∆FñfgW6ñˆ‚&VV∆∆P¢ÚÚF˜W&ÊóBÉR6R¶˜W"÷∆(	B∆W27FG2V&∆óVW2ÊR&Vf∆WFñVÁBFˆÊ226P¢ÚÚVR∆W2&ˆÊÊW2&V6WfñVÁBg&ñ÷VÁBá6ñvÊ∆R"w&Vr∆R"ÛÇÛ##bí‡¢6ˆÁ7BDÇ“vWEFñW%Fá&W6Üˆ∆G2Çì∞¢6ˆÁ7B7FB“ó4fˆ˜Bbb6ˆÊb„“DÇÁ7FÊF&C∞¢ñbáFñW"””“'7FÊF&B"í&WGW&‚7FC∞¢6ˆÁ7B&V““7FB«¬Üó4fˆ˜Bbb6ˆÊb„“DÇÁ&V÷óV“ì∞¢ñbáFñW"””“'&V÷óV“"í&WGW&‚&V”∞¢&WGW&‚&V“«¬ÑTƒïDUı5ı%E2Á6ˆ÷Rá2”‚7˜'BÊñÊ6«VFW2á2ííbb6ˆÊb„“DÇÊV∆óFRì∞ß–¶gVÊ7Fñˆ‚FñW%7FG4f˜"á6WBí∞¢∆WBvñÁ2“¬&ˆí“∞¢f˜"Ü6ˆÁ7B"ˆb6WBí∞¢6ˆÁ7B6˜FR“&˜tˆFBá"ì∞¢ñbá"Ê˜WF6ˆ÷R””“'vñ‚"í≤vñÁ2≤≥≤&ˆí≥“Ü6˜FR“í¢≤“V«6R≤&ˆí”“≤–¢–¢6ˆÁ7BF˜F¬“6WBÊ∆VÊwFÉ∞¢&WGW&‚∞¢F˜F¬¬vñÁ2¬∆˜76W3¢F˜F¬“vñÁ2¿¢vñÁ&FS¢F˜F¬Ú÷FÇÁ&˜VÊBávñÁ2ÚF˜F¬¢í¢¿¢&ˆì¢÷FÇÁ&˜VÊBá&ˆíí¿¢&V6VÁC¢6WBÁ6∆ñ6RÉ¬ÇíÊ÷á"”‚á∞¢Üˆ÷S¢"ÊÜˆ÷R¬vì¢"Êví¬6ˆ◊WFóFñˆ„¢"Ê6ˆ◊WFóFñˆ‚«¬"Á7˜'B«¬""¿¢&WC¢÷6¥îÊ÷W4v∆ˆ&¬á"Ê&W7Eˆ&WB«¬""í¬6ˆÊfñFVÊ6S¢"Ê6ˆÊfñFVÊ6R¿¢6˜FS¢&˜tˆFBá"í¬˜WF6ˆ÷S¢"Ê˜WF6ˆ÷R¿¢66˜&S¢"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢ÁV∆¬¿¢“íí¿¢”∞ß–†¢ÚÚ)H)H6◊vÊR&6RVRGRW&ó2vvÏ:í"Ñ'&WfÚ¬÷&Fí≤fVÊG&VFíí)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ6ñ◊V∆R∆R&ˆfóBFR∆fVñ∆∆RÜ÷ó6R(*¬í˜W"∆R∆ñW"&VV∆∆V÷VÁB6˜W67&ó@¢ÚÚ"¬v&ˆÊÊR≤∆R∆ñW"ñ÷÷VFñFV÷VÁB7WW&ñWW"¬÷V÷R÷WFÜˆFRFR6∆7V¿¢ÚÚVR∆vR˜W&f˜&÷Ê6W2áFñW$V∆ñvñ&∆R˜FñW%7FG4f˜"¬6˜W&6RVÊóVRFP¢ÚÚfW&óFR˜W"ÊR¶÷ó2ffñ6ÜW"V‚6Üñfg&RFñffW&VÁBGR6óFRí‡¶6ˆÁ7BDîU%Ù$ıdR“≤7FÊF&C¢'&V÷óV“"¬&V÷óV”¢&V∆óFR"”∞¶6ˆÁ7BDîU%Ùƒ$T¬“≤7FÊF&C¢%7FÊF&B"¬&V÷óV”¢%&V÷óV“"¬V∆óFS¢$V∆óFRıdï"”∞†¶gVÊ7Fñˆ‚fWF6Ö&W6ˆ«fVE&˜w4f˜$FFRÜFFU7G"í∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5B÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬6˜VÁG'í¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬˜WF6ˆ÷R¿¢&V≈ˆˆFB¬&V≈ˆˆFE˜6˜W&6R¬fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬Ê«ó6VEˆB¿¢÷ñÁWFUˆEˆÊ«ó6ó2¬6ˆÁ6VÁ7W5˜f˜FW2¿¢6ñu˜6VÁE˜7FÊF&B¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFR¬6ñu˜6VÁEˆg&VR¬FñfgW6ñˆÂˆ&∆ˆ6∞¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rí‰B6ˆÊfñFVÊ6R„“G∂vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇó–¢‰BFFRÜÊ«ó6VEˆBí“¢íÊ∆¬ÜFFU7G"ì∞¢&WGW&‚FVGWTÊ«ó6W4'î÷F6Çá&˜w2Êfñ«FW"á"”‚ó4Êˆó6Tf˜$Fó7∆íá"íbbó5fW&ñfñVD6∆ñVÁD˜S#U&˜rá"ííì∞ß–†¶gVÊ7Fñˆ‚˜WGW&f˜&‘V÷ñƒáF÷¬ÜV÷ñ¬¬˜vÂFñW"¬˜vÂ7FG2¬&˜fUFñW"¬&˜fU7FG2¬FFT∆&V¬í∞¢6ˆÁ7Bf◊DWW"“Ü‚í”‚Ü‚„“Ú"≤"¢""í≤÷FÇÁ&˜VÊBÜ‚í≤.(*¬#∞¢6ˆÁ7B˜v‰6ˆ∆˜"“˜vÂ7FG2Á&ˆí„“Ú"3#ìÉ"¢"6cC6cVR#∞¢6ˆÁ7B&˜fT6ˆ∆˜"“&˜fU7FG2Á&ˆí„“Ú"3#ìÉ"¢"6cC6cVR#∞¢6ˆÁ7BW6V∆≈W&¬“˜vÂFñW"””“'7FÊF&B ¢Ú&áGG3¢Úˆ'WíÁ7G&óRÊ6ˆ“ÛfıS67fFd≥Df”§3î≥5d3b ¢¢&áGG3¢Úˆ'WíÁ7G&óRÊ6ˆ“ÛFt”îCTÊñf≥tîì35d3r#∞¢&WGW&‚ ¢∆Fób7Gñ∆S“&fˆÁB÷f÷ñ«ì§ñÁFW"¬÷∆R◊7ó7FV“ƒ&ñ¬«6Á2◊6W&ñc∂÷Ç◊vñGFÉ£ScÉ∂÷&vñ„£WFÛ∂&6∂w&˜VÊC¢3cÉc∂6ˆ∆˜#¢6V6VcC∑FFñÊs£3'Ç#GÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢3v#É&∂÷&vñ‚÷&˜GFˆ”£áÇ#Â,:ñ6GRG∂FFT∆&V«“(	B∆ñW"GµDîU%Ùƒ$T≈∂˜vÂFñW%◊”¬ˆFóc‡¢∆É"7Gñ∆S“&fˆÁB◊6ó¶S£#É∂÷&vñ„£gÇ#Âfˆñ6í6RRvW&óB&˜'L:íFˆ‚∆ñW"ÜñW#¬ˆÉ#‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3C#∂&˜&FW#£Ç6ˆ∆ñB&v&É#SR√#SR√#SR¬„ì∂&˜&FW"◊&FóW3£GÉ∑FFñÊs£#É∂÷&vñ‚÷&˜GFˆ”£gÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢3v#É&∑FWáB◊G&Á6f˜&”ßWW&66S∂∆WGFW"◊76ñÊs¢„VV”∂÷&vñ‚÷&˜GFˆ”£gÇ#‚GµDîU%Ùƒ$T≈∂˜vÂFñW%◊“(	BG∂˜vÂ7FG2ÁF˜F«“<:ñ∆V7Fñˆ‚G∂˜vÂ7FG2ÁF˜F¬‚Ú'2"¢"'”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£3É∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢G∂˜v‰6ˆ∆˜'“#‚G∂˜vÂ7FG2ÁF˜F¬Úf◊DWW"Ü˜vÂ7FG2Á&ˆíí¢.(	B'”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢6ÜV3É∂÷&vñ‚◊F˜£GÇ#‚G∂˜vÂ7FG2ÁF˜F¬ÚG∂˜vÂ7FG2ÁvñÁ7“vvÏ:ñRG∂˜vÂ7FG2ÁvñÁ2‚Ú'2"¢"'“ÚG∂˜vÂ7FG2Ê∆˜76W7“W&GVRG∂˜vÂ7FG2Ê∆˜76W2‚Ú'2"¢"'“Ü÷ó6R(*¬6Ü7VÊRñ¢$V7VÊR<:ñ∆V7Fñˆ‚,:ó6ˆ«VR7W"6WGFR:ó&ñˆFR˜W"6R∆ñW"‚'”¬ˆFóc‡¢¬ˆFóc‡¢G∂&˜fUFñW"Ú ¢∆Fób7Gñ∆S“&&6∂w&˜VÊCß&v&É#B√SÇ√#3r¬„Çì∂&˜&FW#£Ç6ˆ∆ñB&v&É#B√SÇ√#3r¬„2ì∂&˜&FW"◊&FóW3£GÉ∑FFñÊs£#É∂÷&vñ‚÷&˜GFˆ”£#Ç#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢63F#VfC∑FWáB◊G&Á6f˜&”ßWW&66S∂∆WGFW"◊76ñÊs¢„VV”∂÷&vñ‚÷&˜GFˆ”£gÇ#‰fV2GµDîU%Ùƒ$T≈∂&˜fUFñW%◊“(	BG∂&˜fU7FG2ÁF˜F«“<:ñ∆V7Fñˆ‚G∂&˜fU7FG2ÁF˜F¬‚Ú'2"¢"'”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£3É∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢G∂&˜fT6ˆ∆˜'“#‚G∂&˜fU7FG2ÁF˜F¬Úf◊DWW"Ü&˜fU7FG2Á&ˆíí¢.(	B'”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢6ÜV3É∂÷&vñ‚◊F˜£áÇ#‡¢∆á&Vc“"G∑W6V∆≈W&«“"7Gñ∆S“&6ˆ∆˜#¢6ffc∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3FcCfSR¬3v36VBì∑FFñÊs£óÇáÉ∂&˜&FW"◊&FóW3£áÉ∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊS∂fˆÁB◊vVñváC£s∂fˆÁB◊6ó¶S£7É∂Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≤#Â76W"GµDîU%Ùƒ$T≈∂&˜fUFñW%◊“(i#¬ˆ‡¢¬ˆFóc‡¢¬ˆFócÊ¢"'–¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂∆ñÊR÷ÜVñváC£„s∂&˜&FW"◊F˜£Ç6ˆ∆ñB&v&É#SR√#SR√#SR¬„Çì∑FFñÊr◊F˜£gÇ#‡¢6ñ◊V∆Fñˆ‚:FóG&RñÊf˜&÷Fñb¬÷ó6RfóÜRFR(*¬"<:ñ∆V7Fñˆ‚¬7W"∆W2,:ó7V«FG2,:ñV∆∆V÷VÁBV&∆ú:ó2‚∆W2W&f˜&÷Ê6W27<:ñW2ÊRv&ÁFó76VÁB2∆W2,:ó7V«FG2gWGW'2‚F˜W4∆W4÷F6á2ÊRv&ÁFóBV7V‚vñ‚„∆'#‡¢ƒU2§UUÇBt$tTÂBUBDRÑ4$BUUdTÂB8•E$RD‰tU$UUÇ(	B¶˜VWW'2÷ñÊfÚ◊6W'fñ6RÊg"¬ísBsR22„∆'#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“˜W&f˜&÷Ê6W2"7Gñ∆S“&6ˆ∆˜#¢3ÉÜ6cÇ#Âfˆó"¬vÜó7F˜&óVR6ˆ◊∆WC¬ˆ‡¢¬ˆFóc‡¢¬ˆFócÊ∞ß–†¶∆WBˆ∆7D˜WGW&f˜&‘V÷ñƒFFR“"#∞¶7ñÊ2gVÊ7Fñˆ‚6VÊD˜WGW&f˜&‘V÷ñ«2Çí∞¢ñbÇ%$UdıÙïÙ¥Uíí&WGW&„∞¢G'í∞¢6ˆÁ7BñW7FW&Fí“ÊWrFFRÑFFRÊÊ˜rÇí“ÉcCì∞¢6ˆÁ7BFFU7G"“ñW7FW&FíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BFFT∆&V¬“ñW7FW&FíÁFÙ∆ˆ6∆TFFU7G&ñÊrÇ&g"‘e""¬≤Fì¢#"÷FñvóB"¬÷ˆÁFÉ¢&∆ˆÊr"“ì∞¢6ˆÁ7B&˜w2“fWF6Ö&W6ˆ«fVE&˜w4f˜$FFRÜFFU7G"ì∞†¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B7V'2“6ˆFW4F"Á&W&RÄ¢%4TƒT5BDï5Dî‰5BV÷ñ¬¬∆‚e$Ù“6ˆFW2tÑU$R∆‚î‚Çw7FÊF&Br¬w&V÷óV“rí‰B7FófR“‰BV÷ñ¬ï2‰ıBÂTƒ¬ ¢íÊ∆¬Çì∞¢6ˆFW4F"Ê6∆˜6RÇì∞†¢∆WB6VÁB“∞¢f˜"Ü6ˆÁ7B7V"ˆb7V'2í∞¢6ˆÁ7B˜vÂFñW"“7V"Á∆„∞¢6ˆÁ7B&˜fUFñW"“DîU%Ù$ıdU∂˜vÂFñW%“«¬ÁV∆√∞¢6ˆÁ7B˜vÂ7FG2“FñW%7FG4f˜"á&˜w2Êfñ«FW"á"”‚FñW$V∆ñvñ&∆Rá"¬˜vÂFñW"ííì∞¢ñbÇ˜vÂ7FG2ÁF˜F¬í6ˆÁFñÁVS≤ÚÚ&ñV‚÷ˆÁG&W"¬ˆ‚‚vVÁfˆñR2V‚V÷ñ¬fñFP¢6ˆÁ7B&˜fU7FG2“&˜fUFñW"ÚFñW%7FG4f˜"á&˜w2Êfñ«FW"á"”‚FñW$V∆ñvñ&∆Rá"¬&˜fUFñW"ííí¢ÁV∆√∞¢6ˆÁ7BáF÷¬“˜WGW&f˜&‘V÷ñƒáF÷¬á7V"ÊV÷ñ¬¬˜vÂFñW"¬˜vÂ7FG2¬&˜fUFñW"¬&˜fU7FG2¬FFT∆&V¬ì∞¢G'í∞¢vóB'&Wfı6VÊDV÷ñ¬á7V"ÊV÷ñ¬¬	˘8¢6RVRGµDîU%Ùƒ$T≈∂˜vÂFñW%◊“W&óB&˜'L:í∆RG∂FFT∆&V«÷¬áF÷¬ì∞¢6VÁB≤≥∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ü∂˜WGW&f˜&“÷V÷ñ≈“G∑7V"ÊV÷ñ«”¶¬RÊ÷W76vRì∞¢–¢–¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂˜WGW&f˜&“÷V÷ñ≈“G∑6VÁG“ÚG∑7V'2Ê∆VÊwFá“V÷ñ«2VÁf˜ú:ó2ÜFˆÊÏ:ñW2GRG∂FFT∆&V«“ñì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂˜WGW&f˜&“÷V÷ñ≈“"¬RÊ÷W76vRì∞¢–ß–†¢ÚÚ)H)H÷ñÊñGW&RV˜FñFñVÊÊR&6ˆ÷&ñV‚ˆ‚W&óBvvÏ:í"ÖFV∆Vw&“¬÷ñÁVóBí)H)H)H)H)H)H ¢ÚÚ÷V÷R6˜W&6RFRfW&óFRVR˜WGW&f˜&‘V÷ñƒáF÷¬áFñW$V∆ñvñ&∆R˜FñW%7FG4f˜"¿¢ÚÚ÷ó6RfóÜR(*¬í(	B¶÷ó2V‚6Üñfg&RñÁfVÁFR‚vVÊW&RVÊRñ÷vRfñvV÷ñÊê¢ÚÚÑÊÊÚ&ÊÊí¬¶÷ó2VÊR6GW&RFR&ˆˆ∂÷∂W"WÜó7FÁBÖvñÊ÷ÇWF2¬fˆó ¢ÚÚFó67W76ñˆ‚GRÛÇÛ##b¢&W&VÊG&R∆WW"∆ˆvÚˆ÷66˜GFR6W&óBVÊP¢ÚÚ6ˆÁG&Vf6ˆ‚V‚«W2BwV‚&ó7VRFR6ˆÊf˜&÷óFR‰¢í‚fW'&˜RFR∆Ê6V÷VÁB†¢ÚÚDî≈ïÙtîÂÙî‘tUıT$ƒî3“#"&67V∆RFR¬vW&7RF÷ñ‚fW'2∆W2g&ó0¢ÚÚw&˜WW27FÊF&Bı&V÷óV“ÙV∆óFR¬VÊRfˆó2∆R&VÊGRf∆ñFR"w&Vr‡¶6ˆÁ7BDî≈ïÙtîÂÙî‘tUıT$ƒî2“&ˆ6W72ÊVÁb‰Dî≈ïÙtîÂÙî‘tUıT$ƒî2””“##∞†¶gVÊ7Fñˆ‚6VÊEFV∆Vw&’Ü˜FÚÜ6ÜDñB¬ñ÷vT'VffW"¬6Fñˆ‚í∞¢&WGW&‚ÊWr&ˆ÷ó6RÇá&W6ˆ«fRí”‚∞¢ñbÇDTƒTu$’Ù$ıEıDÙ¥T‚«¬6ÜDñB«¬ñ÷vT'VffW"í&WGW&‚&W6ˆ«fRÜf«6Rì∞¢6ˆÁ7B&˜VÊF'í“'F∆‘vñ‰ñ÷r"≤FFRÊÊ˜rÇì∞¢6ˆÁ7BÊ¬“%«%∆‚#∞¢6ˆÁ7BÜVB“µ”∞¢ÜVBÁW6ÇÜ““G∂&˜VÊF'ó“G∂Ê«‘6ˆÁFVÁB‘Fó7˜6óFñˆ„¢f˜&“÷FF≤Ê÷S“&6ÜEˆñB"G∂Ê«“G∂Ê«“G∂6ÜDñG“G∂Ê«÷ì∞¢ñbÜ6Fñˆ‚í∞¢ÜVBÁW6ÇÜ““G∂&˜VÊF'ó“G∂Ê«‘6ˆÁFVÁB‘Fó7˜6óFñˆ„¢f˜&“÷FF≤Ê÷S“&6Fñˆ‚"G∂Ê«“G∂Ê«“G∂6FñˆÁ“G∂Ê«÷ì∞¢ÜVBÁW6ÇÜ““G∂&˜VÊF'ó“G∂Ê«‘6ˆÁFVÁB‘Fó7˜6óFñˆ„¢f˜&“÷FF≤Ê÷S“''6Uˆ÷ˆFR"G∂Ê«“G∂Ê«‘ÖD‘¬G∂Ê«÷ì∞¢–¢ÜVBÁW6ÇÜ““G∂&˜VÊF'ó“G∂Ê«‘6ˆÁFVÁB‘Fó7˜6óFñˆ„¢f˜&“÷FF≤Ê÷S“'Ü˜FÚ#≤fñ∆VÊ÷S“&vñ‚ÁÊr"G∂Ê«‘6ˆÁFVÁB’GóS¢ñ÷vR˜ÊrG∂Ê«“G∂Ê«÷ì∞¢6ˆÁ7B&ˆGí“'VffW"Ê6ˆÊ6BÖ¥'VffW"Êg&ˆ“ÜÜVBÊ¶ˆñ‚Ç""í¬'WFcÇ"í¬ñ÷vT'VffW"¬'VffW"Êg&ˆ“ÜG∂Ê«“““G∂&˜VÊF'ó“““G∂Ê«÷¬'WFcÇ"ï“ì∞¢6ˆÁ7B&W“áGG2Á&WVW7Bá∞¢Ü˜7FÊ÷S¢&íÁFV∆Vw&“Ê˜&r"¿¢FÉ¢ˆ&˜BGµDTƒTu$’Ù$ıEıDÙ¥TÁ“˜6VÊEÜ˜Fˆ¿¢÷WFÜˆC¢%ı5B"¿¢ÜVFW'3¢≤$6ˆÁFVÁB’GóR#¢◊V«Fó'Bˆf˜&“÷FF≤&˜VÊF'ì“G∂&˜VÊF'ó÷¬$6ˆÁFVÁB‘∆VÊwFÇ#¢&ˆGíÊ∆VÊwFÇ“¿¢“¬á&W2í”‚∞¢∆WBFF“"#∞¢&W2Êˆ‚Ç&FF"¬Ü2í”‚ÜFF≥“2íì∞¢&W2Êˆ‚Ç&VÊB"¬Çí”‚∞¢G'í≤&W6ˆ«fRÇ•4Ù‚Á'6RÜFFíÊˆ≤ì≤“6F6Ç≤&W6ˆ«fRÜf«6Rì≤–¢“ì∞¢“ì∞¢&WÊˆ‚Ç&W'&˜""¬Çí”‚&W6ˆ«fRÜf«6Ríì∞¢&WÁw&óFRÜ&ˆGíì∞¢&WÊVÊBÇì∞¢“ì∞ß–†¶7ñÊ2gVÊ7Fñˆ‚vVÊW&FTvñ‰ñ÷vRáFñW"¬7FG2¬FFT∆&V¬í∞¢ñbÇıT‰ïÙïÙ¥Uíí&WGW&‚ÁV∆√∞¢6ˆÁ7Bf◊DWW"“Ü‚í”‚Ü‚„“Ú"≤"¢""í≤÷FÇÁ&˜VÊBÜ‚í≤.(*¬#∞¢6ˆÁ7B&ˆ◊B“7&VRVÊRñ÷vRfW'Fñ6∆Rf˜&÷B7F˜'íÉ#GÉS3bí¬fˆÊBFVw&FR&∆WRÁVóBG&W26ˆ÷'&RWBfñˆ∆WBÊVˆ‚¬÷&ñÊ6R∆ñ6Fñˆ‚&V÷óV“GóRfñÁFV6Ç÷ˆFW&ÊR‚îÂDU$DïB¢∆ˆvÚ˜R÷66˜GFRBwV‚&ˆˆ∂÷∂W"WÜó7FÁBÖvñÊ÷Ç¬&WF6∆ñ2¬’R¬VÊñ&WB‚‚‚í¬¶WFˆÁ2FR66ñÊÚ¬FW2¬7ñ÷&ˆ∆W2FR¶WRBv&vVÁB¬áV÷ñ‚Ü˜F˜&V∆ó7FR‡§V‚ÜWB¬FWáFRG&W2∆ó6ñ&∆RV‚÷ßW67V∆W2¢"GµDîU%Ùƒ$T≈∑FñW%“ÁFıWW$66RÇó“"‡§R6VÁG&R¬T‰ı$‘RWBG&W2∆ó6ñ&∆R¬∆R÷ˆÁFÁB"G∂f◊DWW"á7FG2Á&ˆíó“"V‚&∆Ê2fV2V‚Ü∆ÚÊVˆ‚G∑7FG2Á&ˆí„“Ú'fW'BV÷W&VFR"¢'&˜VvR'“‡§ßW7FRV‚FW76˜W2¬«W2WFóB¢"G∑7FG2ÁvñÁ7“vvÊVW2ÚG∑7FG2Ê∆˜76W7“W&GVW27W"G∑7FG2ÁF˜F«“6V∆V7FñˆÁ2"‡•6˜W26RFWáFR¬VÊ6˜&R«W2WFóB¢%6ñ◊V∆Fñˆ‚÷ó6RfóÜRWW&˜2"6V∆V7Fñˆ‚"‡•V‚WFóB&ˆ&˜BÙî7Gñ∆ó6R÷ñ6¬WB÷ñÊñ÷∆ó7FRá2áV÷ñ‚¬2FR÷66˜GFRFR÷'VRíWWB&óG&R¬fV2VV«VW26ˆÊfWGFó2Fó67&WG26í∆R÷ˆÁFÁBW7B˜6óFñb¬V7V‚V∆V÷VÁB6íÊVvFñb‡•F˜WBV‚&2FR¬vñ÷vR¬G&W2WFóB÷ó2&fóFV÷VÁB∆ó6ñ&∆R¢#Ç≤¶WR&W7ˆÁ6&∆R“¶˜VWW'2÷ñÊfÚ◊6W'fñ6RÊg"“F˜W4∆W4÷F6á2“6ñ◊V∆Fñˆ‚ñÊf˜&÷FófR¬V7V‚vñ‚v&ÁFí‚ •FWáFRVÁFñW&V÷VÁBV‚g&Ê6ó2¬6Á2fWFRBv˜'FÜˆw&ÜR¬6Á2vFW&÷&≤BtîvVÊW&FófRÊ∞†¢G'í∞¢6ˆÁ7B&W7“vóBáGG˜7E7G&ñ7BÄ¢&áGG3¢ÚˆíÊ˜VÊíÊ6ˆ“˜cˆñ÷vW2ˆvVÊW&FñˆÁ2"¿¢≤÷ˆFV√¢&wB÷ñ÷vR”"¬&ˆ◊B¬6ó¶S¢##GÉS3b"“¿¢≤WFÜ˜&ó¶Fñˆ„¢&V&W"G¥ıT‰ïÙïÙ¥Uó÷–¢ì∞¢6ˆÁ7B#cB“&W7ÚÊFFÚÂ≥”ÚÊ#cEˆß6ˆ„∞¢ñbÇ#cBí≤6ˆÁ6ˆ∆RÊW'&˜"Ü∂vñ‚÷ñ÷vU“G∑FñW'”¢2FRFˆÊÊVW2ñ÷vRFÁ2∆&WˆÁ6R˜V‰ñì≤&WGW&‚ÁV∆√≤–¢&WGW&‚'VffW"Êg&ˆ“Ü#cB¬&&6ScB"ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ü∂vñ‚÷ñ÷vU“G∑FñW'“vVÊW&Fñˆ„¶¬RÊ÷W76vRì∞¢&WGW&‚ÁV∆√∞¢–ß–†¶7ñÊ2gVÊ7Fñˆ‚6VÊDFñ«îvñ‰ñ÷vW2Çí∞¢G'í∞¢6ˆÁ7BñW7FW&Fí“ÊWrFFRÑFFRÊÊ˜rÇí“ÉcCì∞¢6ˆÁ7BFFU7G"“ñW7FW&FíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BFFT∆&V¬“ñW7FW&FíÁFÙ∆ˆ6∆TFFU7G&ñÊrÇ&g"‘e""¬≤Fì¢#"÷FñvóB"¬÷ˆÁFÉ¢&∆ˆÊr"“ì∞¢6ˆÁ7B&˜w2“fWF6Ö&W6ˆ«fVE&˜w4f˜$FFRÜFFU7G"ì∞¢6ˆÁ7BF&vWG2“∞¢7FÊF&C¢DTƒTu$’ı5D‰D$EÙ4Ñ‰‰T≈ÙîB¿¢&V÷óV”¢DTƒTu$’ı$T‘ïT’Ù4Ñ‰‰T≈ÙîB¿¢V∆óFS¢DTƒTu$’ÙTƒïDUÙ4Ñ‰‰T≈ÙîB¿¢”∞¢f˜"Ü6ˆÁ7BFñW"ˆb≤'7FÊF&B"¬'&V÷óV“"¬&V∆óFR%“í∞¢6ˆÁ7B7FG2“FñW%7FG4f˜"á&˜w2Êfñ«FW"Çá"í”‚FñW$V∆ñvñ&∆Rá"¬FñW"ííì∞¢ñbÇ7FG2ÁF˜F¬í≤6ˆÁ6ˆ∆RÊ∆ˆrÜ∂vñ‚÷ñ÷vU“G∑FñW'”¢&ñV‚÷ˆÁG&W"∆RG∂FFT∆&V«“¬6∂óì≤6ˆÁFñÁVS≤–¢6ˆÁ7Bñ÷r“vóBvVÊW&FTvñ‰ñ÷vRáFñW"¬7FG2¬FFT∆&V¬ì∞¢ñbÇñ÷rí6ˆÁFñÁVS∞¢6ˆÁ7BFW7D6ÜB“Dî≈ïÙtîÂÙî‘tUıT$ƒî2ÚF&vWG5∑FñW%“¢DTƒTu$’ÙD‘îÂÙ4ÑEÙîC∞¢ñbÇFW7D6ÜBí6ˆÁFñÁVS∞¢6ˆÁ7B6Fñˆ‚“Dî≈ïÙtîÂÙî‘tUıT$ƒî0¢Ú	˘8¢∆#‚GµDîU%Ùƒ$T≈∑FñW%◊”¬ˆ#‚(	B,:ñ6GRG∂FFT∆&V«÷ ¢¢	˘8¢∆#‚GµDîU%Ùƒ$T≈∑FñW%◊”¬ˆ#‚(	B,:ñ6GRG∂FFT∆&V«’∆„∆ì‰W,:wRF÷ñ‚ÑDî≈ïÙtîÂÙî‘tUıT$ƒî3÷ˆfbí(	B2VÊ6˜&RVÁf˜ú:íWÇ&ˆÊÏ:ó2„¬ˆìÊ∞¢6ˆÁ7Bˆ≤“vóB6VÊEFV∆Vw&’Ü˜FÚÜFW7D6ÜB¬ñ÷r¬6Fñˆ‚ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂vñ‚÷ñ÷vU“G∑FñW'”¢G∂ˆ≤Ú&VÁf˜ú:í"¢,:ñ6ÜV2VÁfˆí'“G¥Dî≈ïÙtîÂÙî‘tUıT$ƒî2Ú"áV&∆ñ2í"¢"ÜW,:wRF÷ñ‚í'÷ì∞¢–¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂vñ‚÷ñ÷vU“6VÊDFñ«îvñ‰ñ÷vW3¢"¬RÊ÷W76vRì∞¢–ß–¶ÊvWBÇ"˜FñW"◊7FG2"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5B÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬6˜VÁG'í¬7˜'B¬6ˆÊfñFVÊ6R¬&W7Eˆ&WB¬˜WF6ˆ÷R¬&V≈ˆˆFB¿¢&V≈ˆˆFE˜6˜W&6R¬fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬Ê«ó6VEˆB¿¢÷ñÁWFUˆEˆÊ«ó6ó2¬6ˆÁ6VÁ7W5˜f˜FW2¿¢6ñu˜6VÁE˜7FÊF&B¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFR¬6ñu˜6VÁEˆg&VR¬FñfgW6ñˆÂˆ&∆ˆ6∞¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢‰B6ˆÊfñFVÊ6R„“G∂vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇó–¢‰BFFRÜÊ«ó6VEˆBí„“s##b”r”2p¢ı$DU"%íÊ«ó6VEˆBDU40¢íÊ∆¬Çì∞¢6ˆÁ7B6∆V‚“FVGWTÊ«ó6W4'î÷F6Çá&˜w2Êfñ«FW"á"”‚ó4Êˆó6Tf˜$Fó7∆íá"íbbó5fW&ñfñVD6∆ñVÁD˜S#U&˜rá"ííì∞¢6ˆÁ7B7FÊF&B“6∆V‚Êfñ«FW"á"”‚FñW$V∆ñvñ&∆Rá"¬'7FÊF&B"íì∞¢6ˆÁ7B&V÷óV““6∆V‚Êfñ«FW"á"”‚FñW$V∆ñvñ&∆Rá"¬'&V÷óV“"íì∞¢6ˆÁ7BV∆óFR“6∆V‚Êfñ«FW"á"”‚FñW$V∆ñvñ&∆Rá"¬&V∆óFR"íì∞¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢FñW'3¢∞¢7FÊF&C¢FñW%7FG4f˜"á7FÊF&Bí¿¢&V÷óV”¢FñW%7FG4f˜"á&V÷óV“í¿¢V∆óFS¢FñW%7FG4f˜"ÜV∆óFRí¿¢“¿¢“ì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑FñW"◊7FG5“"¬RÊ÷W76vRì≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R“ì≤–ß“ì∞†¢ÚÚ)H)H∆R6ˆÁ6Vñ¬L:ñ∆ñ,:á&R(	Bf˜FW2ÊˆÁñ÷ó<:ó2GRñ6≤GR¶˜W")H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ&VÁfˆñR∆W2f˜FW2ñÊFófñGVV«2FW2vVÁG2ÜÊˆÁñ÷ó<:ó2«Ü(i%6ñv÷í≤∆RfW&Fñ7@¢ÚÚGR6ˆÁ6Vñ¬¬˜W"∆RÊÊVR&VffWBtır"GRÜW&Ú‚FˆÊÏ:ñW2,:ñV∆∆W2FWVó0¢ÚÚ6ˆÊ6ñ∆UˆÊ«ó6W2ÊvVÁG5ˆß6ˆ‚‚V7V‚Êˆ“Btî,:ñV¬‚vW7BWá˜<:í‡¶6ˆÁ7B4ıT‰4î≈Ùƒ$T≈2“≤$«Ü"¬$&WF"¬$v÷÷"¬$FV«F"¬%6ñv÷%”∞¶ÊvWBÇ"ˆ6˜VÊ6ñ¬◊f˜FR"¬á&W¬&W2í”‚∞¢G'í∞¢ÚÚ‚÷F6ÇGRñ6≤GR¶˜W ¢∆WBÜˆ÷R“ÁV∆¬¬ví“ÁV∆√∞¢G'í∞¢6ˆÁ7B&r“•4Ù‚Á'6RÜg2Á&VDfñ∆U7ñÊ2ÑÑU$‘U5ıî4µ5ıDÇ¬'WFcÇ"íì∞¢6ˆÁ7B“&rÊ7W'&VÁEñ6≥∞¢ñbábbÊÜˆ÷RbbÊÜˆ÷R”“$Ê«ó6RV‚6˜W'2"í≤Üˆ÷R“ÊÜˆ÷S≤ví“Êvì≤–¢“6F6ÇÖÚí∑–†¢ÚÚ"‚∆ñvÊRBvÊ«ó6R6˜'&W7ˆÊFÁFRÜ∆«W2,:ñ6VÁFR˜W"6R÷F6Çê¢∆WB&˜r“ÁV∆√∞¢ñbÜÜˆ÷Rbbvíí∞¢&˜r“F"Á&W&RÄ¢%4TƒT5BÜˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬vVÁG5ˆß6ˆ‚¬&V≈ˆˆFB¬Üˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆvÚ"∞¢$e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$R∆˜vW"áG&ñ“ÜÜˆ÷Ríì÷∆˜vW"áG&ñ“ÉÚíí‰B∆˜vW"áG&ñ“Üvííì÷∆˜vW"áG&ñ“ÉÚíí"∞¢$ı$DU"%íÊ«ó6VEˆBDU42ƒî‘ïB ¢íÊvWBÜÜˆ÷R¬víì∞¢–¢ÚÚf∆∆&6≤¢FW&Êú:á&RÊ«ó6RV&∆ú:ñRGR¶˜W"Ü∆«W26ˆÊfñÁFRê¢ñbÇ&˜rí∞¢&˜r“F"Á&W&RÄ¢4TƒT5BÜˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬vVÁG5ˆß6ˆ‚¬&V≈ˆˆFB¬Üˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆv¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R6ˆÊfñFVÊ6R„“G∂vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇó“‰BFFRÜÊ«ó6VEˆBì÷FFRÇvÊ˜rrê¢ı$DU"%í6ˆÊfñFVÊ6RDU42¬Ê«ó6VEˆBDU42ƒî‘ïB ¢íÊvWBÇì∞¢–¢ñbÇ&˜rí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R“ì∞†¢∆WBvVÁG2“µ”∞¢G'í≤vVÁG2“•4Ù‚Á'6Rá&˜rÊvVÁG5ˆß6ˆ‚«¬%µ“"ì≤“6F6Ç∑–¢ÚÚˆ‚v&FR∆W2f˜FÁG2ÜÜ˜'2F˜V&∆ˆ‚WÜ7BGRfW&Fñ7Bí¬ÊˆÁñ÷ó<:ó2‡¢6ˆÁ7BfW&Fñ7D&WB“&˜rÊ&W7Eˆ&WB«¬"#∞¢6ˆÁ7Bf˜FW2“vVÁG2Êfñ«FW"ÇÜí”‚ÚÊó46ÜñVbbbÚÊÊ÷R”“$6∆VFR6ÜñVb"íÁ6∆ñ6RÉ¬RíÊ÷ÇÜ¬íí”‚∞¢6ˆÁ7B&WB“÷6¥îÊ÷W4v∆ˆ&¬Ö7G&ñÊrÜÊ&WB«¬fW&Fñ7D&WB«¬$Ê«ó6R"íì∞¢6ˆÁ7B6ˆÊb“÷FÇÊ÷ÇÉS¬÷FÇÊ÷ñ‚Éìí¬'6TñÁBÜÊ6ˆÊfñFVÊ6R¬í«¬&˜rÊ6ˆÊfñFVÊ6R«¬Éíì∞¢6ˆÁ7B∆ñvÊVB“&WBÁFÙ∆˜vW$66RÇíÁG&ñ“Çí””“fW&Fñ7D&WBÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢&WGW&‚≤∆&V√¢4ıT‰4î≈Ùƒ$T≈5∂ï“«¬îG∂í≤÷¬&WB¬6ˆÊfñFVÊ6S¢6ˆÊb¬∆ñvÊVB”∞¢“ì∞¢ÚÚ6í2FRf˜FW27Fˆ6º:ó2áñ6≤ÜW&‹:á26Á2vVÁG2í¬ˆ‚7ñÁFå:óFó6RV‚6ˆÁ6VÁ7W0¢ÚÚÜˆÊÏ:ßFR¢F˜W2∆ñvÏ:ó27W"∆RfW&Fñ7B¬6ˆÊfñÊ6R“6ˆÊfñÊ6RGR6ˆÁ6Vñ¬‡¢6ˆÁ7Bf∆∆&6µf˜FW2“f˜FW2Ê∆VÊwFÇÚf˜FW2¢4ıT‰4î≈Ùƒ$T≈2Á6∆ñ6RÉ¬RíÊ÷ÇÜ¬¬íí”‚á∞¢∆&V√¢¬¬&WC¢fW&Fñ7D&WB«¬$Ê«ó6R"¬6ˆÊfñFVÊ6S¢&˜rÊ6ˆÊfñFVÊ6R«¬É"¬∆ñvÊVC¢G'VR¿¢“íì∞†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢÷F6É¢∞¢Üˆ÷S¢&˜rÊÜˆ÷R¬vì¢&˜rÊví¿¢6ˆ◊WFóFñˆ„¢&˜rÊ6ˆ◊WFóFñˆ‚«¬&˜rÁ7˜'B«¬$fˆ˜F&∆¬"¿¢Üˆ÷Uˆ∆ˆvÛ¢&˜rÊÜˆ÷Uˆ∆ˆvÚ«¬ÁV∆¬¬vïˆ∆ˆvÛ¢&˜rÊvïˆ∆ˆvÚ«¬ÁV∆¬¿¢“¿¢vVÁG3¢f∆∆&6µf˜FW2¿¢fW&Fñ7C¢∞¢&WC¢÷6¥îÊ÷W4v∆ˆ&¬áfW&Fñ7D&WBí¿¢6ˆÊfñFVÊ6S¢&˜rÊ6ˆÊfñFVÊ6R«¬É"¿¢6˜FS¢&˜rÁ&V≈ˆˆFBbb&˜rÁ&V≈ˆˆFB‚Ú÷FÇÁ&˜VÊBá&˜rÁ&V≈ˆˆFB¢íÚ¢ÁV∆¬¿¢“¿¢“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂6˜VÊ6ñ¬◊f˜FU“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R“ì∞¢–ß“ì∞†¢ÚÚ)H)H7FófóL:íV‚Fó&V7B(	B6ˆ◊FWW'2,:ñV«2GR¶˜W"á,:ñ77W&Ê6R'6óFRfófÁB"í)H)H ¶ÊvWBÇ"ˆ∆ófR÷7FófóGí"¬á&W¬&W2í”‚∞¢G'í∞¢ÚÚ∆R&ÊFVR∆ófRÊRFˆóB26ˆ◊FW"∆W2ñ6∑2É$Ç&R÷÷F6ÇñÁFW&ÊW2‡¢ÚÚñ«2‚wWFñ∆ó6VÁB2∆R6ˆÊ6ñ∆R∆ófRWBÊRWWfVÁB2FWfVÊó"V‚6ñvÊ¿¢ÚÚ6∆ñVÁB‚∆W2÷V∆ÊvW"Wá∆óVóB∆RfWÇfˆ«V÷R##bÊ«ó6W2"GR#ÇÛÇ‡¢6ˆÁ7BÊ«ó6W5FˆFí“F"Á&W&RÄ¢4TƒT5B4ıTÂBÇ¢í22e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RFFRÜÊ«ó6VEˆBì÷FFRÇvÊ˜rrê¢‰B4ÙƒU44Rá6˜W&6U˜GóR¬v∆ófRrí“v∆ófRv ¢íÊvWBÇìÚÊ2«¬∞¢ÚÚV‚6ñvÊ¬‚vWÜó7FR6˜FR6∆ñVÁBRv&W2VÊR&WˆÁ6RFV∆Vw&“Ù≤fV2V‡¢ÚÚ÷W76vUˆñB‚6ˆ◊FW"6WV∆V÷VÁB∆6ˆÊfñÊ6RG&Á6f˜&÷óB#BÊ«ó6W0¢ÚÚ&V÷F6Ç6Á2÷ñÁWFR¬6˜FRÊíf˜FRV‚##B6ñvÊWÇ"∆R#ÇÛÇ‡¢6ˆÁ7BV&∆ó6ÜVEFˆFí“F"Á&W&RÄ¢4TƒT5B4ıTÂBÑDï5Dî‰5B÷F6Öˆ∂Wíí20¢e$Ù“FV∆Vw&’˜6ñvÊ≈ˆFV∆ófW&ñW0¢tÑU$Rˆ≥”‰BFV∆Vw&’ˆ÷W76vUˆñBï2‰ıBÂTƒ¿¢‰B6ÜÊÊV¬î‚Çw7FÊF&Br¬w&V÷óV“r¬vV∆óFRrê¢‰BFFRÜ7&VFVEˆBì÷FFRÇvÊ˜rrñ ¢íÊvWBÇìÚÊ2«¬∞¢6ˆÁ7BF˜F≈V&∆ó6ÜVB“F"Á&W&RÄ¢4TƒT5B4ıTÂBÑDï5Dî‰5B÷F6Öˆ∂Wí«¬w¬r«¬FFRÜ7&VFVEˆBíí20¢e$Ù“FV∆Vw&’˜6ñvÊ≈ˆFV∆ófW&ñW0¢tÑU$Rˆ≥”‰BFV∆Vw&’ˆ÷W76vUˆñBï2‰ıBÂTƒ¿¢‰B6ÜÊÊV¬î‚Çw7FÊF&Br¬w&V÷óV“r¬vV∆óFRrñ ¢íÊvWBÇìÚÊ2«¬∞¢6ˆÁ7B6ñvÊ«5FˆFí“V&∆ó6ÜVEFˆFì∞¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢Ê«ó6W5˜FˆFì¢Ê«ó6W5FˆFí¿¢V&∆ó6ÜVE˜FˆFì¢V&∆ó6ÜVEFˆFí¿¢F˜F≈˜V&∆ó6ÜVC¢F˜F≈V&∆ó6ÜVB¿¢6ñvÊ«5˜FˆFì¢6ñvÊ«5FˆFí¿¢ñˆ7FófS¢R¿¢“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂∆ófR÷7FófóGï“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R“ì∞¢–ß“ì∞†¶Á˜7BÇ"ˆF÷ñ‚˜6WB◊ñ6≤"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬ñ6≤““&WÊ&ˆGí«¬∑”∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢ñbÇñ6≤«¬ñ6≤ÁFV‘«¬ñ6≤ÁFV‘"í&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$FˆÊÏ:ñW2ñ6≤ñÊ6ˆ◊Ã:áFW2"“ì∞¢6ˆÁ7B÷ÁV≈ñ6≤“∞¢‚‚Áñ6≤¿¢6˜W&6S¢ñ6≤Á6˜W&6R«¬&÷ÁV¬÷F÷ñ‚"¿¢WFFVDC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢”∞¢6fUñ6≤Ü÷ÁV≈ñ6≤ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬ñ6≥¢÷ÁV≈ñ6≤“ì∞ß“ì∞†¢ÚÚ)H)H66˜&R÷ÁVV¬Üf∆∆&6≤F÷ñ‚í)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆ∆ófR◊66˜&R"¬á&W¬&W2í”‚∞¢6ˆÁ7B2“∆ˆD÷ÁV≈66˜&RÇì∞¢&W2Êß6ˆ‚á2Ú≤ˆ≥¢G'VR¬66˜&S¢2“¢≤ˆ≥¢f«6R“ì∞ß“ì∞†¶Á˜7BÇ"ˆF÷ñ‚˜6WB◊66˜&R"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬66˜&T¬66˜&T"¬÷ñÁWFR¬7FGW2¬Üˆ÷R¬ví““&WÊ&ˆGí«¬∑”∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢6ˆÁ7BFF“∞¢Üˆ÷S¢Üˆ÷R«¬""¬vì¢ví«¬""¿¢66˜&UˆÜˆ÷S¢ÁV÷&W"á66˜&TÛÚí¬66˜&Uˆvì¢ÁV÷&W"á66˜&T"ÛÚí¿¢÷ñÁWFS¢÷ñÁWFR«¬ÁV∆¬¿¢7FGW3¢7FGW2«¬$îÂıƒí"¿¢WFFVC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇê¢”∞¢6fT÷ÁV≈66˜&RÜFFì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬66˜&S¢FF“ì∞ß“ì∞†¶ÊFV∆WFRÇ"ˆF÷ñ‚˜6WB◊66˜&R"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÊ&ˆGí«¬∑”∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢G'í≤g2ÁVÊ∆ñÊµ7ñÊ2Ö44ı$UıDÇì≤“6F6Ç∑–¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR“ì∞ß“ì∞†¢ÚÚ)H)Hf˜FW2,:ñV«2˜fW"ıVÊFW""√R˜W"∆W26ñÁ66W2∆ófR)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ6˜W&6RVÊóVR¢vVÁEˆ÷&∂WE˜&VFñ7FñˆÁ2¬L:ñ¨:∆ñ÷VÁL:ñR"∆W2,:óˆÁ6W0¢ÚÚ◊V«Fí÷÷&6å:ó2FR6ÜVRvVÁB‚V7V‚f˜FR‚vW7BL:ñGVóBGR6ˆÁ6VÁ7W2&ñÊ6ó¬‡¶gVÊ7Fñˆ‚vWD∆ófT˜S#Uf˜FU7FFRÜ÷F6Çí∞¢6ˆÁ7B÷ñÁWFR“'6T∆ófT÷ñÁWFUf«VRÜ÷F6ÉÚÊ÷ñÁWFRì∞¢6ˆÁ7BvñÊF˜u7FGW2“÷ñÁWFR””“ÁV∆¬Ú'VÊ∂Ê˜v‚"¢÷ñÁWFR¬RÚ'vóFñÊr"¢÷ñÁWFR√“4ƒîTÂEÙıS#UÙ4ƒîTÂEÙ‘ÖÙ‘îÂUDRÚ&˜V‚"¢&6∆˜6VB#∞¢6ˆÁ7BV◊Gïf˜FW2“4Ù‰4îƒUÙtTÂEÙ‰‘U2Ê÷ÇÜvVÁBí”‚á∞¢vVÁB¿¢Fó&V7Fñˆ„¢ÁV∆¬¿¢∆&V√¢ÁV∆¬¿¢6ˆÊfñFVÊ6S¢ÁV∆¬¿¢7FGW3¢'VÊFñÊr"¿¢WFFVEˆC¢ÁV∆¬¿¢“íì∞¢6ˆÁ7BV◊Gí“∞¢÷&∂WC¢&˜fW%˜VÊFW%Û%ÛR"¿¢g&ˆ’ˆ÷ñÁWFS¢R¿¢Fıˆ÷ñÁWFS¢4ƒîTÂEÙıS#UÙ4ƒîTÂEÙ‘ÖÙ‘îÂUDR¿¢vñÊF˜u˜7FGW3¢vñÊF˜u7FGW2¿¢f˜FUˆ6˜VÁC¢¿¢˜fW%ˆ6˜VÁC¢¿¢VÊFW%ˆ6˜VÁC¢¿¢f˜FW3¢V◊Gïf˜FW2¿¢”∞¢ñbÜ÷ñÁWFR””“ÁV∆¬«¬÷ñÁWFR¬Rí&WGW&‚V◊Gì∞†¢G'í∞¢6ˆÁ7B∆6VÜˆ∆FW'2“4Ù‰4îƒUÙtTÂEÙ‰‘U2Ê÷ÇÇí”‚#Ú"íÊ¶ˆñ‚Ç"¬"ì∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¬&WB¬6ˆÊfñFVÊ6R¬7&VFVEˆ@¢e$Ù“vVÁEˆ÷&∂WE˜&VFñ7FñˆÁ0¢tÑU$R÷&∂WEˆ∆ñÊR“v'WG2p¢‰BFFRÜ7&VFVEˆBí“FFRÇvÊ˜rrê¢‰B∆˜vW"áG&ñ“ÜÜˆ÷Ríí“∆˜vW"áG&ñ“ÉÚíê¢‰B∆˜vW"áG&ñ“Üvííí“∆˜vW"áG&ñ“ÉÚíê¢‰BvVÁEˆÊ÷Rî‚ÇG∑∆6VÜˆ∆FW'7“ê¢ı$DU"%íFFWFñ÷RÜ7&VFVEˆBíDU42¬ñBDU40¢íÊ∆¬Ü÷F6ÉÚÊÜˆ÷R«¬""¬÷F6ÉÚÊví«¬""¬‚‚‰4Ù‰4îƒUÙtTÂEÙ‰‘U2ì∞†¢6ˆÁ7B∆FW7D'îvVÁB“ÊWr÷Çì∞¢f˜"Ü6ˆÁ7B&˜rˆb&˜w2í∞¢ñbÇ∆FW7D'îvVÁBÊÜ2á&˜rÊvVÁEˆÊ÷Ríí∆FW7D'îvVÁBÁ6WBá&˜rÊvVÁEˆÊ÷R¬&˜rì∞¢–¢6ˆÁ7Bf˜FW2“4Ù‰4îƒUÙtTÂEÙ‰‘U2Ê÷ÇÜvVÁBí”‚∞¢6ˆÁ7B&˜r“∆FW7D'îvVÁBÊvWBÜvVÁBì∞¢6ˆÁ7B&WB“7G&ñÊrá&˜sÚÊ&WB«¬""ì∞¢6ˆÁ7BFó&V7Fñˆ‚“ı‰˜fW"%≤‚≈”R'WG2BˆíÁFW7BÜ&WBê¢Ú&˜fW" ¢¢ıÂVÊFW"%≤‚≈”R'WG2BˆíÁFW7BÜ&WBê¢Ú'VÊFW" ¢¢ÁV∆√∞¢ñbÇFó&V7Fñˆ‚í&WGW&‚V◊Gïf˜FW2ÊfñÊBÇáf˜FRí”‚f˜FRÊvVÁB””“vVÁBì∞¢&WGW&‚∞¢vVÁB¿¢Fó&V7Fñˆ‚¿¢∆&V√¢Fó&V7Fñˆ‚””“&˜fW""Ú$˜fW""√R"¢%VÊFW""√R"¿¢6ˆÊfñFVÊ6S¢ÁV÷&W"Êó4fñÊóFRÑÁV÷&W"á&˜rÊ6ˆÊfñFVÊ6RííÚÁV÷&W"á&˜rÊ6ˆÊfñFVÊ6Rí¢ÁV∆¬¿¢7FGW3¢'f˜FVB"¿¢WFFVEˆC¢&˜rÊ7&VFVEˆB«¬ÁV∆¬¿¢”∞¢“ì∞¢6ˆÁ7B˜fW$6˜VÁB“f˜FW2Êfñ«FW"Çáf˜FRí”‚f˜FRÊFó&V7Fñˆ‚””“&˜fW""íÊ∆VÊwFÉ∞¢6ˆÁ7BVÊFW$6˜VÁB“f˜FW2Êfñ«FW"Çáf˜FRí”‚f˜FRÊFó&V7Fñˆ‚””“'VÊFW""íÊ∆VÊwFÉ∞¢&WGW&‚∞¢‚‚ÊV◊Gí¿¢f˜FUˆ6˜VÁC¢˜fW$6˜VÁB≤VÊFW$6˜VÁB¿¢˜fW%ˆ6˜VÁC¢˜fW$6˜VÁB¿¢VÊFW%ˆ6˜VÁC¢VÊFW$6˜VÁB¿¢f˜FW2¿¢”∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂∆ófR÷˜S#R◊f˜FW5“"¬RÊ÷W76vRì∞¢&WGW&‚V◊Gì∞¢–ß–†¢ÚÚ)H)H∆ófR÷F6ÜW2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆ∆ófR÷÷F6ÜW2"¬7ñÊ2á&W¬&W2í”‚∞¢G'í∞¢&W2Á6WBÇ$66ÜR‘6ˆÁG&ˆ¬"¬&ÊÚ◊7F˜&R¬÷Ç÷vS”"ì∞¢ñbá&WÁVW'íÊf˜&6R””“#"í∞¢∆ófT÷F6ÜW466ÜR“≤FF¢ÁV∆¬¬G3¢”∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂∆ófR÷÷F6ÜW5“66ÜRf˜&<:ífñL:í"¬wWFñ∆ó6FWW""ì∞¢–¢6ˆÁ7B∆ƒ÷F6ÜW2“vóBfWF6Ñ∆ófT÷F6ÜW2Çì∞¢ÚÚfñ«G&R5E$î5B¢∆ófRî‚vffñ6ÜRVR∆W2∆ñwVW2fñ&∆W2ávÜóFV∆ó7Bí¬¸;í∆W0¢ÚÚFˆÊÏ:ñW2∆ófR6ˆÁB&ñFW2WB<;∑&W2‚«W2¶÷ó2FR66˜&RfWÇBwVÊR∆ñwVR÷ñÊWW&R‡¢6ˆÁ7B÷F6ÜW2“∆ƒ÷F6ÜW2Êfñ«FW"Ü“”‚∞¢6ˆÁ7B7˜'B“7G&ñÊrÜ”ÚÁ7˜'B«¬""íÁG&ñ“Çì∞¢ÚÚó5vˆ÷V‰÷F6ÇÇí÷ÁVóB6˜FRfˆ˜F&∆¬¢ó4∆˜uG'W7D6ˆ◊WFóFñˆ‚ÊRfW&ñfñP¢ÚÚVR∆fñ&ñ∆óFRFR∆∆ñwVR¬¶÷ó2∆RvVÁ&R‚VÊR∆ñv’ÇfV÷VÊñ¬ÜFˆÊ0¢ÚÚfˆ˜F&∆¬í76óBñÁ6íFV∆∆RVV∆∆R7W"$V‚Fó&V7B"fV2V‚&˜WFˆ‡¢ÚÚ$Ê«ó6W"6R÷F6Ç"(	B6ˆÁ7FFR"w&Vr∆R2ÛÇÛ##b‡¢ñbÜó5vˆ÷V‰÷F6ÇÜ“íí&WGW&‚f«6S∞¢&WGW&‚7˜'B””“$fˆ˜F&∆¬"Úó4∆˜uG'W7D6ˆ◊WFóFñˆ‚Ü“í¢ó4&∆6∂∆ó7FVDf˜$∆ófTFó7∆íÜ“ì∞¢“ì∞†¢ÚÚñÊ¶V7FW"∆W26ñvÊWÇ:óñÊvÃ:ó26í∆R÷F6Ç‚vW7B«W2FÁ2¬tê¢6ˆÁ7BñÊÊVB“vWD7FófUñÊÊVE6ñvÊ«2Çì∞¢f˜"Ü6ˆÁ7B2ˆbñÊÊVBí∞¢ñbÇó5V&∆ñ4fˆ˜F&∆≈66˜T÷F6Çá2íí6ˆÁFñÁVS∞¢6ˆÁ7B«&VGî∆ófR“÷F6ÜW2Á6ˆ÷RÜ“”‡¢“ÊÜˆ÷SÚÁFÙ∆˜vW$66RÇíÊñÊ6«VFW2á2ÊÜˆ÷SÚÁFÙ∆˜vW$66RÇíÁ7∆óBÇ""ï≥“íb`¢“ÊvìÚÁFÙ∆˜vW$66RÇíÊñÊ6«VFW2á2ÊvìÚÁFÙ∆˜vW$66RÇíÁ7∆óBÇ""ï≥“ê¢ì∞¢ñbÇ«&VGî∆ófRí∞¢÷F6ÜW2ÁVÁ6ÜñgBá∞¢ñC¢2ÊñB¿¢Üˆ÷S¢2ÊÜˆ÷R¬vì¢2Êví¿¢6ˆ◊WFóFñˆ„¢2Ê6ˆ◊WFóFñˆ‚«¬2Ê∆VwVR«¬""¿¢7˜'C¢2Á7˜'B«¬$fˆ˜F&∆¬"¿¢7FGW3¢%î‰‰TEı4ît‰¬"¿¢÷ñÁWFS¢2Ê÷ñÁWFR¿¢66˜&UˆÜˆ÷S¢2Á66˜&UˆÜˆ÷RÛÚÁV∆¬¿¢66˜&Uˆvì¢2Á66˜&UˆvíÛÚÁV∆¬¿¢Üˆ÷Uˆ∆ˆvÛ¢2ÊÜˆ÷Uˆ∆ˆvÚ«¬ÁV∆¬¿¢vïˆ∆ˆvÛ¢2Êvïˆ∆ˆvÚ«¬ÁV∆¬¿¢ñÊÊVE6ñvÊ√¢G'VR¿¢ñÊÊVD&WC¢2Ê&WB¿¢ñÊÊVD6ˆÊfñFVÊ6S¢2Ê6ˆÊfñFVÊ6R¿¢ñÊÊVE&V6ˆ„¢2Á&V6ˆ‚¿¢“ì∞¢–¢–†¢ÚÚfW&Fñ7BBvÊ«ó6&ñ∆óL:í6∆7VÃ:í"∆R4U%dUU"WB¶ˆñÁB:6ÜVR÷F6Ç‡¢ÚÚ∆Rg&ˆÁB∆óVóB6&˜&R,:Üv∆R#V^(	3cVR÷ñÁWFR¬6ˆL:ñRV‚GW"¢V∆∆P¢ÚÚ6ˆÁG&VFó6óB∆,:Üv∆R6W'fWW"á<:ñ∆V7Fñˆ‚"∆6˜FRFWVó2∆R#ÇÛrÛ##bê¢ÚÚWB¬7W"∆W27˜'G26Á2÷ñÁWFW2¬'6TñÁBÇ$î„í"íFˆÊÊóBÊ‚(	BFˆÊ2F˜W@¢ÚÚ∆R&6V&∆¬¬∆R&6∂WBWB∆RÜˆ6∂Wí:óFñVÁB&∆˜\:ó2V‚W&÷ÊVÊ6RfV2V‡¢ÚÚ÷W76vR&∆ÁBFR÷ñÁWFW2FRfˆ˜F&∆¬‚VÊR6WV∆R6˜W&6RFRl:ó&óL:íñ6í‡¢6ˆÁ7BvóFÖfW&Fñ7B“÷F6ÜW2Ê÷ÇÜ“í”‚∞¢6ˆÁ7B˜S#R“vWD∆ófT˜S#Uf˜FU7FFRÜ“ì∞¢6ˆÁ7B6∆ñVÁE&ˆGV7DV∆ñvñ&∆R“ó46∆ñVÁD˜S#T÷F6ÑV∆ñvñ&∆RÜ“¬G'VRì∞¢6ˆÁ7B∆ñvÊVEf˜FW2“÷FÇÊ÷ÇÑÁV÷&W"Ü˜S#RÊ˜fW%ˆ6˜VÁB«¬í¬ÁV÷&W"Ü˜S#RÁVÊFW%ˆ6˜VÁB«¬íì∞¢ÚÚ6˜W&6RFRfW&óFR˜W"¬v67VVñ¬V&∆ñ2¢V‚÷F6ÇÊRWWBWG&R&W6VÁFP¢ÚÚ6ˆ÷÷RV‚6ñvÊ¬VR6í∆R6Ü◊ñˆÊÊBW7BFÁ2∆RW&ñ÷WG&R6∆ñVÁBU@¢ÚÚRvR÷ˆñÁ2BîˆÁB&VV∆∆V÷VÁBVÁ&Vvó7G&R∆R÷V÷Rf˜FRÚıR"√R‡¢ÚÚ6V∆WfóFRRwV‚6ñ◊∆R÷F6Ç∆ófR&ñV‚ñ∆«W7G&RÜ∆ˆv˜2≤66˜&Rí6ˆó@¢ÚÚffñ6ÜRfV2V‚fWÇ7FGWB$Ê«ó6RîV‚6˜W'2"∆˜'2Rvñ¬W7BÛR‡¢6ˆÁ7BÜˆ÷WvTFó7∆îV∆ñvñ&∆R“6∆ñVÁE&ˆGV7DV∆ñvñ&∆Rbb∆ñvÊVEf˜FW2„“4ƒîTÂEÙıS#UÙ‘îÂıdıDU3∞¢6ˆÁ7Bfó6ñ&ñ∆óGí“∞¢6∆ñVÁE˜&ˆGV7EˆV∆ñvñ&∆S¢6∆ñVÁE&ˆGV7DV∆ñvñ&∆R¿¢Ê«ó6ó5˜7F'FVC¢ÁV÷&W"Ü˜S#RÁf˜FUˆ6˜VÁB«¬í‚¿¢Ê«ó6ó5˜fW&ñfñVC¢Üˆ÷WvTFó7∆îV∆ñvñ&∆R¿¢Üˆ÷WvUˆFó7∆ïˆV∆ñvñ&∆S¢Üˆ÷WvTFó7∆îV∆ñvñ&∆R¿¢”∞¢6ˆÁ7BÊ«ó6ó4WÜ6«W6ñˆÂ&V6ˆ‚““ÊÊ«ó6ó5ˆWÜ6«W6ñˆÂ˜&V6ˆ‚«¬ÁV∆√∞¢ñbÜ“ÁñÊÊVE6ñvÊ¬í&WGW&‚≤‚‚Ê“¬Ê«ó6&∆S¢f«6R¬&∆ˆ6µ˜&V6ˆ„¢ÁV∆¬¬Ê«ó6ó5ˆWÜ6«W6ñˆÂ˜&V6ˆ„¢ÁV∆¬¬˜S#R¬‚‚Áfó6ñ&ñ∆óGí”∞¢6ˆÁ7B&V6ˆ‚“∆ófUñ6¥&∆ˆ6µ&V6ˆ‚Ü“í«¬Ê«ó6ó4WÜ6«W6ñˆÂ&V6ˆ„∞¢&WGW&‚≤‚‚Ê“¬Ê«ó6&∆S¢&V6ˆ‚¬&∆ˆ6µ˜&V6ˆ„¢&V6ˆ‚¬Ê«ó6ó5ˆWÜ6«W6ñˆÂ˜&V6ˆ„¢Ê«ó6ó4WÜ6«W6ñˆÂ&V6ˆ‚¬˜S#R¬‚‚Áfó6ñ&ñ∆óGí”∞¢“ì∞†¢ÚÚ,:Üv∆RGR#íÛrÛ##bÇ&‚vffñ6ÜW"VR6RVíW7B¶˜V&∆R"í76˜W∆ñR∆P¢ÚÚÛÇÛ##b7W"FV÷ÊFRFRw&Vr¢V‚÷F6Ç6Á26ñvÊ¬Fó7&ó76ó@¢ÚÚVÁFú:á&V÷VÁBR&˜WBFRVV«VW2÷ñÁWFW2¬6RVíFˆÊÊóB¬vñ◊&W76ñˆ‡¢ÚÚVR∆R6óFR‚vÊ«ó6óB&ñV‚‚F˜W2∆W2÷F6á2∆ófR&W7FVÁB÷ñÁFVÊÁ@¢ÚÚfó6ñ&∆W2(	BÊ«ó6&∆Rˆ&∆ˆ6µ˜&V6ˆ‚ñÊFóVVÁBRg&ˆÁB2vñ¬íV‡¢ÚÚ&˜WFˆ‚BvÊ«ó6R˜RßW7FRVÊR:óFóVWGFRWá∆ñ6FófR‡†¢ÚÚfñ«G&W2fÊ<:ó2∆ófRîÉBÛÇÛ##b¬FV÷ÊFRfˆÊFFWW"í¢6ÜVR÷F6Ä¢ÚÚ˜'FR6W27FG2É$ÇÑ%EE2Û:á&R’BıVÊFW""„Rí˜W"W&÷WGG&RV‚fñ«G&vP¢ÚÚ◊V«Fí÷7&óL:á&W2<9EL8í4ƒîTÂB¬w&GVóB¬6Á2L:óVÁ6W"FR¶WFˆ‚‚fWF6ÑÉ$ÇW7@¢ÚÚL:ñ¨:66ÜR÷v&RÉfÇíWB'VFvWB÷v&L:íÜï7˜'G4'VFvWDˆ≤í(	B¬vV∆W"ñ6ê¢ÚÚ˜W"F˜W2∆W2÷F6á2∆ófRÊR6¸;∑FRFˆÊ2&ñV‚FR«W2VR6RVR6¸;∑FW&ó@¢ÚÚL:ñ¨:¬v˜WfW'GW&RñÊFófñGVV∆∆RFR6ÜVRÊ«ó6R∆R‹:¶÷R¶˜W"‡¢6ˆÁ7BvóFÑÉ$Ç“vóB&ˆ÷ó6RÊ∆¬ávóFÖfW&Fñ7BÊ÷Ü7ñÊ2Ü“í”‚∞¢ñbÜ“ÁñÊÊVE6ñvÊ¬«¬“Á7˜'B”“$fˆ˜F&∆¬"«¬“Á6˜W&6R”“&í◊7˜'G2"«¬“ÊÜˆ÷TñB«¬“ÊvîñBí∞¢&WGW&‚≤‚‚Ê“¬É&Öˆ÷&∂WG3¢ÁV∆¬”∞¢–¢G'í∞¢6ˆÁ7BÉ&Ç“vóBfWF6ÑÉ$ÇÜ“ì∞¢&WGW&‚∞¢‚‚Ê“¿¢É&Öˆ÷&∂WG3¢ÜÉ&ÇbbÉ&ÇÊ‚„“2íÚ∞¢„¢É&ÇÊ‚¬'GG5˜7C¢É&ÇÊ'GG57B¬fó'7EˆÜ∆eˆvˆ≈˜7C¢É&ÇÊáDvˆ≈7B¬VÊFW##U˜7C¢É&ÇÁVÊFW##U7B¿¢“¢ÁV∆¬¿¢”∞¢“6F6ÇÖÚí∞¢&WGW&‚≤‚‚Ê“¬É&Öˆ÷&∂WG3¢ÁV∆¬”∞¢–¢“íì∞†¢6ˆÁ7B7G&ñ7D÷F6ÜW2“vóBVÁ&ñ6Ö7G&ñ7Dvˆ√RávóFÑÉ$Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷F6ÜW3¢7G&ñ7D÷F6ÜW2“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷F6ÜW3¢µ““ì∞¢–ß“ì∞†¶ÊvWBÇ"˜ñÊÊVB◊6ñvÊ«2"¬á&W¬&W2í”‚∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6ñvÊ«3¢vWD7FófUñÊÊVE6ñvÊ«2Çí“ì∞ß“ì∞†¢ÚÚ)H)HWÜó7FñÊrÊ«ó6RVÊGˆñÁBÜÊÚFˆ∂V‚6˜7Bí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ&FR∆ñ÷óFW"6ñ◊∆R¢÷Ç2Ê«ó6W2ˆ÷ñ‚"ï ¶6ˆÁ7BÊ«ó6ó5&FT∆ñ÷óB“ÊWr÷Çì∞¶gVÊ7Fñˆ‚6ÜV6¥Ê«ó6ó5&FRÜóí∞¢6ˆÁ7BÊ˜r“FFRÊÊ˜rÇì∞¢6ˆÁ7BVÁG'í“Ê«ó6ó5&FT∆ñ÷óBÊvWBÜóí«¬≤6˜VÁC¢¬&W6WDC¢Ê˜r≤c”∞¢ñbÜÊ˜r‚VÁG'íÁ&W6WDBí≤VÁG'íÊ6˜VÁB“≤VÁG'íÁ&W6WDB“Ê˜r≤c≤–¢VÁG'íÊ6˜VÁB≤≥∞¢Ê«ó6ó5&FT∆ñ÷óBÁ6WBÜó¬VÁG'íì∞¢&WGW&‚VÁG'íÊ6˜VÁB√“3∞ß–†¶Á˜7BÇ"ˆÊ«ó6R"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤Üˆ÷R¬ví¬÷F6ÖˆñB““&WÊ&ˆGí«¬∑”∞¢ñbÇÜˆ÷R«¬víí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$FWWÇ:óVóW2&WVó6W2"“ì∞¢6ˆÁ7Bó“&WÊÜVFW'5≤'Ç÷f˜'v&FVB÷f˜"%“«¬&WÁ6ˆ6∂WBÁ&V÷˜FTFG&W72«¬'VÊ∂Ê˜v‚#∞¢ñbÇ6ÜV6¥Ê«ó6ó5&FRÜóíí&WGW&‚&W2Á7FGW2ÉC#ííÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%G&˜FR&W\:ßFW2¬GFVÊG2÷ñÁWFR‚"“ì∞†¢G'í∞¢6ˆÁ7BfW&ñfñVD÷F6Ç“vóB&WVó&UfW&ñfñVD∆ófT÷F6Çá≤ñC¢÷F6ÖˆñB¬Üˆ÷R¬ví“ì∞¢ñbÇfW&ñfñVD÷F6Çí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$÷F6Ç∆ófRÊˆ‚fW&ñfñR"“ì∞¢ñbá&V¶V7E66˜&T6ˆÊf∆ñ7BáfW&ñfñVD÷F6Ç¬&W2íí&WGW&„∞¢6ˆÁ7B&∆ˆ6µ&V6ˆ‚“∆ófUñ6¥&∆ˆ6µ&V6ˆ‚áfW&ñfñVD÷F6Çì∞¢ñbÜ&∆ˆ6µ&V6ˆ‚í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢&∆ˆ6µ&V6ˆ‚“ì∞¢ÚÚ6WBVÊGˆñÁBÊR76R2"6Ü˜V∆DWFÙˆ'6W'fT÷F6Çá&W6W'fRR÷˜FWW ¢ÚÚWFˆ÷FóVRí¢6Á26Rv&FR÷f˜R¬V‚V¬Fó&V7B˜WfóBfó&RÊ«ó6W ¢ÚÚV‚÷F6Ç¶WVÊW2ˆ÷ñ6¬ˆ∆ñwVRF˜WFWW6RV‚6ˆÁF˜W&ÊÁBF˜WB∆Rfñ«G&RFP¢ÚÚfñ&ñ∆óFR‚6ˆÁ7FFR∆R#íÛrÛ##b7W"V‚SíÊ˜'fVvñV‚¬fó6ñ&∆RÁV∆∆P¢ÚÚ'B7W"∆R6óFRÜFV¶÷7VR"∆Rfñ«G&RBvffñ6ÜvRí÷ó2F˜V¶˜W'0¢ÚÚGFVñvÊ&∆Rfñ6WBVÊGˆñÁBV∆RFó&V7FV÷VÁB‡¢ñbÜó4WÜ6«VFVDg&ˆ’ñ6∑2áfW&ñfñVD÷F6Çíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Ê«ó6RñÊFó7ˆÊñ&∆R˜W"6WGFR6ˆ◊WFóFñˆ‚‚"“ì∞¢6ˆÁ7BÊ«ó6ó2“vóB'V‰6ˆÊ6ñ∆TÊ«ó6ó2áfW&ñfñVD÷F6Çì∞¢6ˆÁ7B6ÜñVb“Ê«ó6ó2ÊvVÁG5∂Ê«ó6ó2ÊvVÁG2Ê∆VÊwFÇ“”∞†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢&W7V÷S¢6ÜñVbÁ&ó6ˆ‚¿¢f«VUˆ&WC¢≤÷&6ÜS¢6ÜñVbÊ&WB¬&ˆ#¢6ÜñVbÊ6ˆÊfñFVÊ6R¬6˜FUˆ÷ñÂˆ6ˆÁ6Vñ∆Ã:ñS¢ÉÚÜ6ÜñVbÊ6ˆÊfñFVÊ6RÚííÁFÙfóÜVBÉ"í¬&ó6ˆ„¢6ÜñVbÁ&ó6ˆ‚“¿¢˜fW##S¢≤&ˆ#¢SÇ¬FVÊFÊ6S¢%FVÊFÊ6RÃ:ñ|:á&V÷VÁB˜6óFófR7W"∆W2'WG2‚"“¿¢'GG3¢≤&ˆ#¢S"¬FVÊFÊ6S¢$∆W2FWWÇ:óVóW2ˆÁBFW2GFVW27FófW2‚"“¿¢&W7V«FC¢≤Fˆ÷ñ6ñ∆S¢CR¬ÁV√¢#Ç¬WáFW&ñWW#¢#r¬Wá∆ñ6Fñˆ„¢$Ã:ñ|:á&RffWW"˜W"¬|:óVóR:Fˆ÷ñ6ñ∆R‚"“¿¢&V÷ñW%ˆ'WEˆ÷ï˜FV◊3¢≤&V÷ñW&S¢SR¬FWWÜñV÷S¢CR¬Wá∆ñ6Fñˆ„¢$∆W2&V÷ú:á&W2÷í◊FV◊26ˆÁB6˜WfVÁB«W2˜WfW'FW2‚"“¿¢“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"BvÊ«ó6R"“ì∞¢–ß“ì∞†¢ÚÚ)H)H∆ófRî(	BFˆ∂V‚÷vFVB6ˆÊ6ñ∆RÊ«ó6ó2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶Á˜7BÇ"ˆ∆ófR÷ñˆÊ«ó6R"¬WFÑ÷ñFF∆Wv&R¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤÷F6ÖˆñB¬Üˆ÷R¬ví¬66˜&UˆÜˆ÷R¬66˜&Uˆví¬÷ñÁWFR¬6ˆ◊WFóFñˆ‚““&WÊ&ˆGí«¬∑”∞¢ñbÇÜˆ÷R«¬víí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$FˆÊÏ:ñW2GR÷F6Ç÷ÁVÁFW2"“ì∞†¢6ˆÁ7BfW&ñfñVD÷F6Ç“vóB&WVó&UfW&ñfñVD∆ófT÷F6Çá≤ñC¢÷F6ÖˆñB¬Üˆ÷R¬ví“ì∞¢ñbÇfW&ñfñVD÷F6Çí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$÷F6Ç∆ófRÊˆ‚fW&ñfñR"“ì∞¢ñbá&V¶V7E66˜&T6ˆÊf∆ñ7BáfW&ñfñVD÷F6Ç¬&W2íí&WGW&„∞¢6ˆÁ7B&∆ˆ6µ&V6ˆ‚“∆ófUñ6¥&∆ˆ6µ&V6ˆ‚áfW&ñfñVD÷F6Çì∞¢ñbÜ&∆ˆ6µ&V6ˆ‚í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢&∆ˆ6µ&V6ˆ‚“ì∞¢ÚÚ÷V÷Rv&FR÷f˜RVRˆÊ«ó6R¢6RVÊGˆñÁBW7BFˆ∂V‚÷vFVBÜ&ˆÊÊR6ˆÊÊV7FRê¢ÚÚ÷ó2ÊRfW&ñfñóB2Êˆ‚«W2∆fñ&ñ∆óFRFR∆6ˆ◊WFóFñˆ‚fÁBBvV∆W ¢ÚÚ∆R6ˆÊ6ñ∆R‡¢ñbÜó4WÜ6«VFVDg&ˆ’ñ6∑2áfW&ñfñVD÷F6Çíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Ê«ó6RñÊFó7ˆÊñ&∆R˜W"6WGFR6ˆ◊WFóFñˆ‚‚"“ì∞†¢6ˆÁ7B÷F6Ñ∂Wí“G∑fW&ñfñVD÷F6ÇÊñB«¬G∑fW&ñfñVD÷F6ÇÊÜˆ÷W’ÚG∑fW&ñfñVD÷F6ÇÊvó÷’ÚG∂vWEFˆFï7G"Çó÷∞†¢ÚÚ6ÜV6≤ñb«&VGí&WfV∆VBÜÊÚFˆ∂V‚6˜7Bê¢6ˆÁ7BWÜó7FñÊr“F"Á&W&RÄ¢%4TƒT5BÊ«ó6ó5ˆß6ˆ‚e$Ù“&WfV∆VEˆÊ«ó6W2tÑU$RW6W%ˆñB“Ú‰B÷F6Öˆ∂Wí“Ú ¢íÊvWBá&WÁW6W"ÊñB¬÷F6Ñ∂Wíì∞†¢ñbÜWÜó7FñÊrí∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Á6ÊóFó¶TÊ«ó6ó4f˜$6∆ñVÁBÑ•4Ù‚Á'6RÜWÜó7FñÊrÊÊ«ó6ó5ˆß6ˆ‚íí¬66ÜVC¢G'VR“ì∞¢–†¢ÚÚFVGV7BFˆ∂V‡¢6ˆÁ7BFˆ∂VÂ&W7V«B“FVGV7EFˆ∂V‚á&WÁW6W"ÊñBì∞¢ñbÇFˆ∂VÂ&W7V«BÊˆ≤í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢Fˆ∂VÂ&W7V«BÊW'&˜"“ì∞†¢ÚÚ'V‚Ê«ó6ó0¢G'í∞¢6ˆÁ7BÊ«ó6ó2“vóB'V‰6ˆÊ6ñ∆TÊ«ó6ó2áfW&ñfñVD÷F6Çì∞†¢ÚÚ66ÜR&W7V«@¢F"Á&W&RÄ¢$îÂ4U%BîÂDÚ&WfV∆VEˆÊ«ó6W2áW6W%ˆñB¬÷F6Öˆ∂Wí¬Ê«ó6ó5ˆß6ˆ‚íd≈TU2ÉÚ¬Ú¬Úí ¢íÁ'V‚á&WÁW6W"ÊñB¬÷F6Ñ∂Wí¬•4Ù‚Á7G&ñÊvñgíÜÊ«ó6ó2íì∞†¢ÚÚvWBWFFVBFˆ∂V‚6˜VÁ@¢6ˆÁ7BFˆ∂VÂ&˜r“vWEFˆ∂VÂ&˜rá&WÁW6W"ÊñBì∞†¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Á6ÊóFó¶TÊ«ó6ó4f˜$6∆ñVÁBÜÊ«ó6ó2í¬Fˆ∂VÁ5˜&V÷ñÊñÊs¢Fˆ∂VÂ&˜sÚÁFˆ∂VÁ5˜FˆFíÛÚ“ì∞¢“6F6ÇÜRí∞¢ÚÚ&VgVÊBFˆ∂V‚ˆ‚W'&˜ ¢F"Á&W&RÇ%UDDRW6W%˜Fˆ∂VÁ24UBFˆ∂VÁ5˜FˆFí“Fˆ∂VÁ5˜FˆFí≤tÑU$RW6W%ˆñB“Ú"íÁ'V‚á&WÁW6W"ÊñBì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"BvÊ«ó6R(	B¶WFˆ‚&V÷&˜W'<:í"“ì∞¢–ß“ì∞†¢ÚÚ)H)H∆ófRî(	B6ˆFR÷&6VBWFÇÜÊÚ•uBí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶gVÊ7Fñˆ‚áGG˜7DñÁFW&Ê¬ÜÜ˜7B¬˜'B¬FÇ¬&ˆGíí∞¢&WGW&‚ÊWr&ˆ÷ó6RÇá&W6ˆ«fR¬&V¶V7Bí”‚∞¢6ˆÁ7Bñ∆ˆB“•4Ù‚Á7G&ñÊvñgíÜ&ˆGíì∞¢6ˆÁ7B&W“áGGÁ&WVW7BÄ¢≤Ü˜7FÊ÷S¢Ü˜7B¬˜'B¬FÇ¬÷WFÜˆC¢%ı5B"¬ÜVFW'3¢≤$6ˆÁFVÁB’GóR#¢&∆ñ6Fñˆ‚ˆß6ˆ‚"¬$6ˆÁFVÁB‘∆VÊwFÇ#¢'VffW"Ê'óFT∆VÊwFÇáñ∆ˆBí““¿¢á&W2í”‚∞¢∆WBFF“"#∞¢&W2Êˆ‚Ç&FF"¬Ü2í”‚ÜFF≥“2íì∞¢&W2Êˆ‚Ç&VÊB"¬Çí”‚≤G'í≤&W6ˆ«fRÑ•4Ù‚Á'6RÜFFíì≤“6F6Ç≤&W6ˆ«fRá∑“ì≤““ì∞¢–¢ì∞¢&WÊˆ‚Ç&W'&˜""¬&V¶V7Bì∞¢&WÁw&óFRáñ∆ˆBì∞¢&WÊVÊBÇì∞¢“ì∞ß–†¶gVÊ7Fñˆ‚fW&ñgî6ˆFRÜV÷ñ¬¬6ˆFRí∞¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜r“6ˆFW4F"Á&W&RÄ¢%4TƒT5B¢e$Ù“6ˆFW2tÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú‰B7FófR“ ¢íÊvWBÜ6ˆFRÁFıWW$66RÇíÁG&ñ“Çí¬V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢ñbÇ&˜rí&WGW&‚≤f∆ñC¢f«6R¬W'&˜#¢$6ˆFR˜RV÷ñ¬ñÁf∆ñFR"”∞¢ñbá&˜rÊWáó&W5ˆBbbÊWrFFRá&˜rÊWáó&W5ˆBí¬ÊWrFFRÇíí∞¢&WGW&‚≤f∆ñC¢f«6R¬W'&˜#¢$6ˆFRWáó,:í"”∞¢–¢ÚÚ∆W26ˆFW2TƒïDR‘D‘î‚ˆÁBFW27,:ñFóG2ñ∆∆ñ÷óL:ó0¢6ˆÁ7Bó4F÷ñ‰6ˆFR“6ˆFRÁFıWW$66RÇíÁ7F'G5vóFÇÇtTƒïDR‘D‘î‚rì∞¢6ˆÁ7B7&VFóG5ˆ∆VgB“ó4F÷ñ‰6ˆFP¢Úìììììê¢¢7&VFóG4∆VgDf˜%∆‚á&˜rÁ∆‚¬&˜rÊ7&VFóG5ˆ÷Ç¬&˜rÊ7&VFóG5˜W6VB¬&˜rÊ7&VFóG5ˆFFRì∞¢&WGW&‚≤f∆ñC¢G'VR¬∆„¢&˜rÁ∆‚¬7&VFóG5ˆ∆VgB¬V÷ñ√¢&˜rÊV÷ñ¬”∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑fW&ñgî6ˆFU“W'&˜#¢"¬RÊ÷W76vRì∞¢&WGW&‚≤f∆ñC¢f«6R¬W'&˜#¢$W'&WW"FRl:ó&ñfñ6Fñˆ‚"”∞¢–ß–†¢ÚÚ66ÜRFW2Ê«ó6W2FR∆¶˜W&Ï:ñRÜ6Ã:í“V÷ñ¬∂÷F6ÑñBê¶gVÊ7Fñˆ‚ó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRí∞¢ñbÇV÷ñ¬«¬6ˆFRí&WGW&‚f«6S∞¢&WGW&‚ó4F÷ñ‚ÜV÷ñ¬¬6ˆFRí«¬6ˆFRÁFıWW$66RÇíÁG&ñ“ÇíÁ7F'G5vóFÇÇ$TƒïDR‘D‘î‚"ì∞ß–†¶gVÊ7Fñˆ‚6ÊóFó¶TÊ«ó6ó4f˜$6∆ñVÁBÜÊ«ó6ó2¬∆∆˜tF÷ñ‰fñV∆G2“f«6Rí∞¢6ˆÁ7B6∆V‚“≤‚‚ÊÊ«ó6ó2”∞¢ñbÇ∆∆˜tF÷ñ‰fñV∆G2íFV∆WFR6∆V‚ÊvVÁE˜W&f˜&÷Ê6S∞¢ñbÑ'&íÊó4'&íÜ6∆V‚ÊvVÁG2íí∞¢6∆V‚ÊvVÁG2“6∆V‚ÊvVÁG0¢Êfñ«FW"ÇÜvVÁBí”‚∞¢6ˆÁ7B&WB“7G&ñÊrÜvVÁCÚÊ&WB«¬""íÁG&ñ“Çì∞¢6ˆÁ7B&V6ˆ‚“7G&ñÊrÜvVÁCÚÁ&ó6ˆ‚«¬""ì∞¢&WGW&‚vVÁBÊfñ∆V@¢bb&W@¢bb&WB”“.(	B ¢bb&WB”“"“ ¢bbvVÁBÊ6ˆÊfñFVÊ6R”“ÁV∆¿¢bbvVÁBÊ6ˆÊfñFVÊ6R”“VÊFVfñÊV@¢bb&V6ˆ‚ÊñÊ6«VFW2Ç$îÊˆ‚¶ˆñvÊ&∆R"ì∞¢“ê¢Ê÷ÇÜvVÁB¬ñÊFWÇ¬∆ó7Bí”‚á∞¢‚‚ÊvVÁB¿¢Ê÷S¢ñÊFWÇ””“∆ó7BÊ∆VÊwFÇ“bbvVÁBÊó46ÜñVbÚ%7ñÁFå:á6RGR6ˆÊ6ñ∆R"¢vVÁBîG∂ñÊFWÇ≤÷¿¢÷ˆFV√¢""¿¢&ó6ˆ„¢vVÁBÊó46ÜñVbÚvVÁBÁ&ó6ˆ‚¢""¿¢“íì∞¢–¢&WGW&‚6∆V„∞ß–†¶6ˆÁ7BÊ«ó6ó466ÜR“ÊWr÷Çì∞†¶Á˜7BÇ"ˆ6ˆÊ6ñ∆R÷Ê«ó6ó2"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬÷F6Ç““&WÊ&ˆGí«¬∑”∞¢ñbÇV÷ñ¬«¬6ˆFRí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6ˆÊÊWÜñˆ‚&WVó6R"“ì∞¢ñbÇ÷F6Ç«¬÷F6ÇÊÜˆ÷R«¬÷F6ÇÊvíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$FˆÊÏ:ñW2GR÷F6Ç÷ÁVÁFW2"“ì∞†¢6ˆÁ7BWFÇ“fW&ñgî6ˆFRÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇÁf∆ñBí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢WFÇÊW'&˜"«¬$6ˆFRñÁf∆ñFR"“ì∞¢ñbÜWFÇÁ∆‚””“&g&VR"í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%Uu$DUı$UTï$TB"¬∆„¢&g&VR"“ì∞¢6ˆÁ7B∆∆˜tF÷ñ‰fñV∆G2“ó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRì∞†¢ÚÚ6ÜV6≤7&VFóG2Ü7&VFóG5ˆ÷É”÷VÁ2VÊ∆ñ÷óFVBê¢6ˆÁ7BFˆFí“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢ñbÜWFÇÊ7&VFóG5ˆ∆VgB”“ÁV∆¬bbWFÇÊ7&VFóG5ˆ∆VgB”“VÊFVfñÊVBbbWFÇÊ7&VFóG5ˆ∆VgB√“í∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$5$TDïE5ÙUÑÑU5DTB"¬7&VFóG5ˆ∆VgC¢“ì∞¢–†¢6ˆÁ7BfW&ñfñVD÷F6Ç“vóB&WVó&UfW&ñfñVD∆ófT÷F6ÇÜ÷F6Çì∞¢ñbÇfW&ñfñVD÷F6Çí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$÷F6Ç∆ófRÊˆ‚fW&ñfñR"“ì∞¢ñbá&V¶V7E66˜&T6ˆÊf∆ñ7BáfW&ñfñVD÷F6Ç¬&W2íí&WGW&„∞¢6ˆÁ7B&∆ˆ6µ&V6ˆ‚“∆ófUñ6¥&∆ˆ6µ&V6ˆ‚áfW&ñfñVD÷F6Çì∞¢ñbÜ&∆ˆ6µ&V6ˆ‚í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢&∆ˆ6µ&V6ˆ‚“ì∞†¢6ˆÁ7Bf˜&6U&Vg&W6Ç“&WÊ&ˆGíÊf˜&6R””“G'VR«¬&WÊ&ˆGíÊf˜&6R””“«¬&WÊ&ˆGíÊf˜&6R””“##∞¢ÚÚ66ÜR'F|:í"÷F6Çº:óFBá2"W6W"í˜W":ñ6ˆÊˆ÷ó6W"∆W2Fˆ∂VÁ2w&˜¢6ˆÁ7B66˜&U7FFR“fW&ñfñVD÷F6ÇÁ66˜&UˆÜˆ÷R”“ÁV∆¬ÚG∑fW&ñfñVD÷F6ÇÁ66˜&UˆÜˆ÷W““G∑fW&ñfñVD÷F6ÇÁ66˜&Uˆvó’ÚG¥÷FÇÊf∆ˆ˜"ÇáfW&ñfñVD÷F6ÇÊ÷ñÁWFR«¬íÚRó÷¢'&V÷F6Ç#∞¢6ˆÁ7B66ÜT∂Wí“G∑fW&ñfñVD÷F6ÇÊñB«¬G∑fW&ñfñVD÷F6ÇÊÜˆ÷W’ÚG∑fW&ñfñVD÷F6ÇÊvó÷’ÚG∑FˆFó’ÚG∑66˜&U7FFW÷∞¢ñbÇf˜&6U&Vg&W6ÇbbÊ«ó6ó466ÜRÊÜ2Ü66ÜT∂Wííí∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Á6ÊóFó¶TÊ«ó6ó4f˜$6∆ñVÁBÜÊ«ó6ó466ÜRÊvWBÜ66ÜT∂Wíí¬∆∆˜tF÷ñ‰fñV∆G2í¬66ÜVC¢G'VR“ì∞¢–¢ñbÜf˜&6U&Vg&W6ÇíÊ«ó6ó466ÜRÊFV∆WFRÜ66ÜT∂Wíì∞†¢G'í∞¢6ˆÁ7BÊ«ó6ó2“vóB'V‰6ˆÊ6ñ∆TÊ«ó6ó2áfW&ñfñVD÷F6Çì∞¢Ê«ó6ó466ÜRÁ6WBÜ66ÜT∂Wí¬Ê«ó6ó2ì∞¢ÚÚ66ÜR3÷ñ‚˜W"∆W2÷F6á2∆ófRá2fÇ(	B∆R66˜&R6ÜÊvRê¢6ˆÁ7B66ÜUED¬“fW&ñfñVD÷F6ÇÁ7FGW2””“$îÂıƒí"Ú3¢c¢¢b¢c¢c¢∞¢6WEFñ÷V˜WBÇÇí”‚Ê«ó6ó466ÜRÊFV∆WFRÜ66ÜT∂Wíí¬66ÜUED¬ì∞†¢ÚÚFV7&V÷VÁB7&VFóG2ñ‚6ˆFW2ÊF"ÜˆÊ«íˆ‚&V¬Ê«ó6ó2¬Ê˜B66ÜRÜóBê¢G'í∞¢6ˆÁ7BvF"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6ˆÁ7B&˜r“vF"Á&W&RÇ%4TƒT5B7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFóG5ˆFFRe$Ù“6ˆFW2tÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú‰B7FófR“"ê¢ÊvWBÜ6ˆFRÁFıWW$66RÇíÁG&ñ“Çí¬V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢ñbá&˜rbb&˜rÊ7&VFóG5ˆ÷Ç‚í∞¢ñbá&˜rÊ7&VFóG5ˆFFR””“FˆFíí∞¢vF"Á&W&RÇ%UDDR6ˆFW24UB7&VFóG5˜W6VB“7&VFóG5˜W6VB≤tÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú"ê¢Á'V‚Ü6ˆFRÁFıWW$66RÇíÁG&ñ“Çí¬V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢“V«6R∞¢vF"Á&W&RÇ%UDDR6ˆFW24UB7&VFóG5˜W6VB“¬7&VFóG5ˆFFR“ÚtÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú"ê¢Á'V‚áFˆFí¬6ˆFRÁFıWW$66RÇíÁG&ñ“Çí¬V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢–¢–¢vF"Ê6∆˜6RÇì∞¢“6F6ÇÜ6Rí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂6ˆÊ6ñ∆R÷Ê«ó6ó5“7&VFóG2W'&˜#¢"¬6RÊ÷W76vRì≤–†¢ÚÚ6ˆ◊FWW"FR¶WFˆÁ2˜W"¬vffñ6ÜvRÜ¶WFˆÁ2&W7FÁG2V¶˜W&BváVíí‚∆W0¢ÚÚ6ˆ◊FW2F÷ñ‚Üñ∆∆ñ÷óL:ó2í‚vˆÁB2FR6ˆ◊FWW"‡¢∆WB7&VFóDfñV∆G2“∑”∞¢ñbÇ∆∆˜tF÷ñ‰fñV∆G2í∞¢G'í∞¢6ˆÁ7B&F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B7"“&F"Á&W&RÇ%4TƒT5B∆‚¬7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFóG5ˆFFRe$Ù“6ˆFW2tÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú‰B7FófR“"ê¢ÊvWBÜ6ˆFRÁFıWW$66RÇíÁG&ñ“Çí¬V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢&F"Ê6∆˜6RÇì∞¢ñbÜ7"bb7"Ê7&VFóG5ˆ÷Ç‚í∞¢7&VFóDfñV∆G2“≤7&VFóG5ˆ∆VgC¢7&VFóG4∆VgDf˜%∆‚Ü7"Á∆‚¬7"Ê7&VFóG5ˆ÷Ç¬7"Ê7&VFóG5˜W6VB¬7"Ê7&VFóG5ˆFFRí¬7&VFóG5ˆ÷É¢7"Ê7&VFóG5ˆ÷Ç”∞¢–¢“6F6ÇÖÚí∑–¢–†¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Á6ÊóFó¶TÊ«ó6ó4f˜$6∆ñVÁBÜÊ«ó6ó2¬∆∆˜tF÷ñ‰fñV∆G2í¬‚‚Ê7&VFóDfñV∆G2“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"BvÊ«ó6R(	B,:ñW76ñR"“ì∞¢–ß“ì∞†¢ÚÚ)H)H&R÷÷F6ÇÊ«ó6ó2ÜÜˆ÷WvRñ6≤¬fÁB6˜WBvVÁfˆíí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶Á˜7BÇ"˜&V÷F6Ç÷Ê«ó6ó2"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬÷F6Ç““&WÊ&ˆGí«¬∑”∞¢ñbÇV÷ñ¬«¬6ˆFRí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6ˆÊÊWÜñˆ‚&WVó6R"“ì∞¢ñbÇ÷F6Ç«¬÷F6ÇÊÜˆ÷R«¬÷F6ÇÊvíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$FˆÊÏ:ñW2GR÷F6Ç÷ÁVÁFW2"“ì∞†¢6ˆÁ7BWFÇ“fW&ñgî6ˆFRÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇÁf∆ñBí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢WFÇÊW'&˜"«¬$6ˆFRñÁf∆ñFR"“ì∞¢ñbÜWFÇÁ∆‚””“&g&VR"í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%Uu$DUı$UTï$TB"¬∆„¢&g&VR"“ì∞¢6ˆÁ7B∆∆˜tF÷ñ‰fñV∆G2“ó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRì∞†¢ñbÜWFÇÊ7&VFóG5ˆ∆VgB”“ÁV∆¬bbWFÇÊ7&VFóG5ˆ∆VgB”“VÊFVfñÊVBbbWFÇÊ7&VFóG5ˆ∆VgB√“í∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$5$TDïE5ÙUÑÑU5DTB"¬7&VFóG5ˆ∆VgC¢“ì∞¢–†¢6ˆÁ7BFˆFì"“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢ÚÚ66ÜR'F|:í"÷F6Ç∂¶˜W"á2"W6W"í˜W":ñ6ˆÊˆ÷ó6W"∆W2Fˆ∂VÁ2w&˜¢6ˆÁ7B66ÜT∂Wí“&V÷F6ÖıÚG∂÷F6ÇÊÜˆ÷W’ÚG∂÷F6ÇÊvó’ÚG∂÷F6ÇÊFFR«¬FˆFì'÷∞¢ñbÜÊ«ó6ó466ÜRÊÜ2Ü66ÜT∂Wííí∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Á6ÊóFó¶TÊ«ó6ó4f˜$6∆ñVÁBÜÊ«ó6ó466ÜRÊvWBÜ66ÜT∂Wíí¬∆∆˜tF÷ñ‰fñV∆G2í¬66ÜVC¢G'VR“ì∞¢–†¢G'í∞¢6ˆÁ7B÷F6ÑFF“∞¢Üˆ÷S¢÷F6ÇÊÜˆ÷R¿¢vì¢÷F6ÇÊví¿¢66˜&UˆÜˆ÷S¢¿¢66˜&Uˆvì¢¿¢÷ñÁWFS¢%,:í÷÷F6Ç"¿¢7FGW3¢%44ÑTETƒTB"¿¢6ˆ◊WFóFñˆ„¢÷F6ÇÊ6ˆ◊WFóFñˆ‚«¬$ñÁFW&ÊFñˆÊ¬"¿¢”∞¢6ˆÁ7BÊ«ó6ó2“vóB'V‰6ˆÊ6ñ∆TÊ«ó6ó2Ü÷F6ÑFFì∞¢Ê«ó6ó466ÜRÁ6WBÜ66ÜT∂Wí¬Ê«ó6ó2ì∞¢6WEFñ÷V˜WBÇÇí”‚Ê«ó6ó466ÜRÊFV∆WFRÜ66ÜT∂Wíí¬"¢c¢c¢ì∞†¢ÚÚFV7&V÷VÁB7&VFóG0¢G'í∞¢6ˆÁ7BvF#"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6ˆÁ7B&˜s"“vF#"Á&W&RÇ%4TƒT5B7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFóG5ˆFFRe$Ù“6ˆFW2tÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú‰B7FófR“"ê¢ÊvWBÜ6ˆFRÁFıWW$66RÇíÁG&ñ“Çí¬V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢ñbá&˜s"bb&˜s"Ê7&VFóG5ˆ÷Ç‚í∞¢ñbá&˜s"Ê7&VFóG5ˆFFR””“FˆFì"í∞¢vF#"Á&W&RÇ%UDDR6ˆFW24UB7&VFóG5˜W6VB“7&VFóG5˜W6VB≤tÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú"ê¢Á'V‚Ü6ˆFRÁFıWW$66RÇíÁG&ñ“Çí¬V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢“V«6R∞¢vF#"Á&W&RÇ%UDDR6ˆFW24UB7&VFóG5˜W6VB“¬7&VFóG5ˆFFR“ÚtÑU$R6ˆFR“Ú‰BV÷ñ¬“Ú"ê¢Á'V‚áFˆFì"¬6ˆFRÁFıWW$66RÇíÁG&ñ“Çí¬V÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢–¢–¢vF#"Ê6∆˜6RÇì∞¢“6F6ÇÜ6S"í≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑&V÷F6Ç÷Ê«ó6ó5“7&VFóG2W'&˜#¢"¬6S"Ê÷W76vRì≤–†¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Á6ÊóFó¶TÊ«ó6ó4f˜$6∆ñVÁBÜÊ«ó6ó2¬∆∆˜tF÷ñ‰fñV∆G2í“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑&V÷F6Ç÷Ê«ó6ó5“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"BvÊ«ó6R(	B,:ñW76ñR"“ì∞¢–ß“ì∞†¢ÚÚ)H)H7G&óR)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶Á˜7BÇ"˜7G&óRˆ7&VFR÷6ÜV6∂˜WB"¬WFÑ÷ñFF∆Wv&R¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤&ñ6UˆñB““&WÊ&ˆGí«¬∑”∞¢ñbÇ&ñ6UˆñB«¬5E$ïUı4T5$UEÙ¥Uíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6ˆÊfñwW&Fñˆ‚7G&óR÷ÁVÁFR"“ì∞†¢6ˆÁ7B∆‰∆ˆˆ∑W“≤µ5E$ïUı$î4UÙîEÙ4%DU”¢&6'FR"¬µ5E$ïUı$î4UÙîEı$T‘ïT’”¢'&V÷óV“"¬µ5E$ïUı$î4UÙîEıdï”¢'fó"¬µ5E$ïUı$î4UÙîEÙTƒïDU”¢&V∆óFR"”∞¢6ˆÁ7B∆‰Ê÷R“∆‰∆ˆˆ∑W∑&ñ6UˆñE“«¬'&V÷óV“#∞†¢G'í∞¢6ˆÁ7B7G&óR“&WVó&RÇ'7G&óR"ì∞¢6ˆÁ7B7G&óR“7G&óRÖ5E$ïUı4T5$UEÙ¥Uíì∞¢6ˆÁ7B6W76ñˆ‚“vóB7G&óRÊ6ÜV6∂˜WBÁ6W76ñˆÁ2Ê7&VFRá∞¢÷ˆFS¢'7V'67&óFñˆ‚"¿¢ñ÷VÁEˆ÷WFÜˆE˜GóW3¢≤&6&B%“¿¢∆ñÊUˆóFV◊3¢∑≤&ñ6S¢&ñ6UˆñB¬VÁFóGì¢’“¿¢7V66W75˜W&√¢áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“ˆ∆ófR÷ñ˜7V66W73”g∆„“G∑∆‰Ê÷W÷¿¢6Ê6V≈˜W&√¢&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“˜7V'67&óFñˆ‚"¿¢6∆ñVÁE˜&VfW&VÊ6UˆñC¢7G&ñÊrá&WÁW6W"ÊñBí¿¢7W7Fˆ÷W%ˆV÷ñ√¢&WÁW6W"ÊV÷ñ¬¿¢“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬W&√¢6W76ñˆ‚ÁW&¬“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ7G&óRvV&Üˆˆ≤(	B7FófFR7V'67&óFñˆ‡¶Á˜7BÇ"˜7G&óR˜vV&Üˆˆ≤"¬Wá&W72Á&rá≤GóS¢&∆ñ6Fñˆ‚ˆß6ˆ‚"“í¬7ñÊ2á&W¬&W2í”‚∞¢ñbÇ5E$ïUı4T5$UEÙ¥Uíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R“ì∞†¢ÚÚV6ÜV2fW&÷R¢6Á25E$ïUıtT$ÑÙÙµı4T5$UB¬V‚ı5BÊˆ‚6ñvÊRWFóB66WFP¢ÚÚFV¬VV¬Ñ•4Ù‚Á'6RFó&V7Bí(	B‚vñ◊˜'FRVíW&óBRf˜&vW"V‚fWÄ¢ÚÚ&6ÜV6∂˜WBÁ6W76ñˆ‚Ê6ˆ◊∆WFVB"WB6R7&VW"V‚6ˆFRV∆óFRw&GVóB‚G&˜WfP¢ÚÚ∆˜'2FR∆&WgVRFR6V7W&óFRGRÛÇÛ##b≤¶÷ó2Wá∆ˆóFRV‚&ˆ@¢ÚÚÜ∆6∆RW7B&W6VÁFRí¬6˜'&ñvR"'VFVÊ6R‡¢ñbÇ5E$ïUıtT$ÑÙÙµı4T5$UBí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óU“5E$ïUıtT$ÑÙÙµı4T5$UB÷ÁVÁB(	BvV&Üˆˆ≤&V¶WFRÜV6ÜV2fW&÷Rí"ì∞¢&WGW&‚&W2Á7FGW2ÉSíÊß6ˆ‚á≤W'&˜#¢$6ˆÊfñwW&Fñˆ‚vV&Üˆˆ≤÷ÁVÁFR"“ì∞¢–†¢∆WBWfVÁC∞¢G'í∞¢6ˆÁ7B7G&óR“&WVó&RÇ'7G&óR"ì∞¢6ˆÁ7B7G&óR“7G&óRÖ5E$ïUı4T5$UEÙ¥Uíì∞¢WfVÁB“7G&óRÁvV&Üˆˆ∑2Ê6ˆÁ7G'V7DWfVÁBá&WÊ&ˆGí¬&WÊÜVFW'5≤'7G&óR◊6ñvÊGW&R%“¬5E$ïUıtT$ÑÙÙµı4T5$UBì∞¢“6F6ÇÜRí∞¢&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤W'&˜#¢RÊ÷W76vR“ì∞¢–†¢ÚÚ)H)HfW'&˜RÁFí◊&V¶WR)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ∆<:í,8Ö2∆l:ó&ñfñ6Fñˆ‚FR6ñvÊGW&RÜ¶÷ó2fÁB¢6ñÊˆ‚‚vñ◊˜'FRVê¢ÚÚ˜W'&óB6GW&W"∆F&∆Rí‚ˆ‚,:óˆÊB#:V‚&V¶WR˜W"VR7G&óR6W76P¢ÚÚFR,:ñW76ñW"(	BV‚GáÇÛWáÇ∆RfW&óBR6ˆÁG&ó&R&V6ˆ÷÷VÊ6W"V‚&˜V6∆R‡¢ñbÜWfVÁBÊñBí∞¢G'í∞¢6ˆÁ7B6∆ñ““F"Á&W&RÄ¢$îÂ4U%Bı"ît‰ı$RîÂDÚ7G&óU˜&ˆ6W76VEˆWfVÁG2ÜWfVÁEˆñB¬WfVÁE˜GóRíd≈TU2ÉÚ√Úí ¢íÁ'V‚ÜWfVÁBÊñB¬WfVÁBÁGóR«¬""ì∞¢ñbÜ6∆ñ“Ê6ÜÊvW2””“í∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑7G&óU“:ól:ñÊV÷VÁBG∂WfVÁBÊñG“ÇG∂WfVÁBÁGóW“íL:ñ¨:G&óL:í(	B&V¶WRñvÊ˜,:ñì∞¢&WGW&‚&W2Êß6ˆ‚á≤&V6VófVC¢G'VR¬GW∆ñ6FS¢G'VR“ì∞¢–¢“6F6ÇÜRí∞¢ÚÚV‚ñÊ6ñFVÁB7W"∆F&∆RFRfW'&˜RÊRFˆóB¶÷ó2&∆˜VW"V‚ñV÷VÁB†¢ÚÚˆ‚¶˜W&Ê∆ó6RWBˆ‚∆ó76R76W"Ü6ˆ◊˜'FV÷VÁBBvfÁB6Rv&FR÷f˜Rí‡¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óU“fW'&˜RñFV◊˜FVÊ6RñÊFó7ˆÊñ&∆S¢"¬RÊ÷W76vRì∞¢–¢–†¢ñbÜWfVÁBÁGóR””“&6ÜV6∂˜WBÁ6W76ñˆ‚Ê6ˆ◊∆WFVB"í∞¢6ˆÁ7B6W76ñˆ‚“WfVÁBÊFFÊˆ&¶V7C∞†¢ÚÚ)H)H,:ñ7W:ó&W"V÷ñ¬6∆ñVÁBWB&óÇ)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢6ˆÁ7B7W7Fˆ÷W$V÷ñ¬“á6W76ñˆ‚Ê7W7Fˆ÷W%ˆFWFñ«3ÚÊV÷ñ¬«¬6W76ñˆ‚Ê7W7Fˆ÷W%ˆV÷ñ¬«¬""íÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢∆WB&ñ6TñB“"#∞¢G'í∞¢6ˆÁ7B7G&óS"“&WVó&RÇ'7G&óR"ì∞¢6ˆÁ7B7G&óS"“7G&óS"Ö5E$ïUı4T5$UEÙ¥Uíì∞¢6ˆÁ7BgV∆¬“vóB7G&óS"Ê6ÜV6∂˜WBÁ6W76ñˆÁ2Á&WG&ñWfRá6W76ñˆ‚ÊñB¬≤WáÊC¢≤&∆ñÊUˆóFV◊2%““ì∞¢&ñ6TñB“gV∆¬Ê∆ñÊUˆóFV◊3ÚÊFFÚÂ≥”ÚÁ&ñ6SÚÊñB«¬"#∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óU“&WG&ñWfRW'&˜#¢"¬RÊ÷W76vRì≤–†¢6ˆÁ7B∆‰÷“∞¢µ5E$ïUı$î4UÙîEÙ4%DU”¢≤7FGW3¢&6'FR"¬∆&V√¢$Ê«ó6RWW&Ú"¬GW&Fñˆ‰Fó3¢“¿¢µ5E$ïUı$î4UÙîEı5D‰D$E”¢≤7FGW3¢'7FÊF&B"¬∆&V√¢%7FÊF&B"¬GW&Fñˆ‰Fó3¢3"“¿¢µ5E$ïUı$î4UÙîEı$T‘ïT’”¢≤7FGW3¢'&V÷óV“"¬∆&V√¢%&Ú"¬GW&Fñˆ‰Fó3¢3"“¿¢µ5E$ïUı$î4UÙîEıdï”¢≤7FGW3¢'fó"¬∆&V√¢%dï"¬GW&Fñˆ‰Fó3¢3"“¿¢µ5E$ïUı$î4UÙîEÙTƒïDU”¢≤7FGW3¢&V∆óFR"¬∆&V√¢$V∆óFR"¬GW&Fñˆ‰Fó3¢3"“¿¢”∞¢6ˆÁ7B≤7FGW2“'&V÷óV“"¬∆&V√¢∆‰∆&V¬“%&Ú"¬GW&Fñˆ‰Fó2“3"““∆‰÷∑&ñ6TñE“«¬∑”∞†¢ÚÚ)H)H÷WGG&R:¶˜W"W6W'2F&∆R6íW6W$ñB6ˆÊÁR)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢6ˆÁ7BW6W$ñB“'6TñÁBá6W76ñˆ‚Ê6∆ñVÁE˜&VfW&VÊ6UˆñBì∞¢ñbáW6W$ñBí∞¢F"Á&W&RÇ%UDDRW6W'24UB7FGW2“Ú¬7G&óUˆ7W7Fˆ÷W%ˆñB“Ú¬7G&óU˜7V'67&óFñˆÂˆñB“ÚtÑU$RñB“Ú"íÁ'V‚Ä¢7FGW2¬6W76ñˆ‚Ê7W7Fˆ÷W"¬6W76ñˆ‚Á7V'67&óFñˆ‚¬W6W$ñ@¢ì∞¢6ˆÁ7B∆ñ÷óB“DÙ¥TÂÙƒî‘ïE5∑7FGW5“«¬∞¢F"Á&W&RÇ$îÂ4U%Bı"$Uƒ4RîÂDÚW6W%˜Fˆ∂VÁ2áW6W%ˆñB¬Fˆ∂VÁ5˜FˆFí¬&W6WEˆFFRíd≈TU2ÉÚ√Ú√Úí"íÁ'V‚áW6W$ñB¬∆ñ÷óB¬vWEFˆFï7G"Çíì∞¢–†¢ÚÚ&6'FR"Ü¶WFˆ‚(*¬í¢6í∆R6∆ñVÁBL:ñ¨:V‚&ˆÊÊV÷VÁB7Fñb¬ˆ‚«Vê¢ÚÚ7,:ñFóFR≥¶WFˆ‚FW77W2R∆ñWRFR«Ví7,:ñW"V‚6V6ˆÊB6ˆ◊FR<:ó,:í‡¢ñbÜ7W7Fˆ÷W$V÷ñ¬bb7FGW2””“&6'FR"bbw&ÁD6'FT7&VFóEFÙWÜó7FñÊt66˜VÁBÜ7W7Fˆ÷W$V÷ñ¬íí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑7G&óU“¶WFˆ‚(*¬7,:ñFóL:í7W"∆R6ˆ◊FRWÜó7FÁBFRG∂7W7Fˆ÷W$V÷ñ«÷ì∞¢&WGW&‚&W2Êß6ˆ‚á≤&V6VófVC¢G'VR“ì∞¢–†¢ÚÚ)H)H7,:ñW"6ˆFRBv6<:á2FÁ26ˆFW2ÊF"6í2VÊ6˜&RWÜó7FÁB)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ñbÜ7W7Fˆ÷W$V÷ñ¬í∞¢G'í∞¢6ˆÁ7B6ˆFT6Ü'2“$$4DTdtÑ§¥ƒ‘Â%5EUeuÖï£#3CScsÉí#∞¢6ˆÁ7BÊWt6ˆFR“'&íÊg&ˆ“á≤∆VÊwFÉ¢Ç“¬Çí”‚6ˆFT6Ü'5¥÷FÇÊf∆ˆ˜"Ñ÷FÇÁ&ÊFˆ“Çí¢6ˆFT6Ü'2Ê∆VÊwFÇï“íÊ¶ˆñ‚Ç""ì∞¢6ˆÁ7B6F'r“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6ˆÁ7BWÜó7FñÊr“6F'rÁ&W&RÇ%4TƒT5B6ˆFRe$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B∆‚“Ú‰B7FófR“"íÊvWBÜ7W7Fˆ÷W$V÷ñ¬¬7FGW2ì∞¢ÚÚˆfg&RFR∆Ê6V÷VÁBV∆óFR¢≥÷ˆó2ˆffW'B¬VÊóVV÷VÁB˜W"V‚F˜W@¢ÚÚ&V÷ñW"&ˆÊÊV÷VÁBÜ¶÷ó2&VÊ˜WfV∆RV‚&˜V6∆R6ÜVRñV÷VÁBí‡¢6ˆÁ7BV∆óFT&ˆÁW4Fó2“á7FGW2””“&V∆óFR"bbTƒïDUÙƒT‰4ÖÙ$ÙÂU5ÙT‰$ƒTBbbWÜó7FñÊríÚTƒïDUÙƒT‰4ÖÙ$ÙÂU5ÙDï2¢∞¢6ˆÁ7BWáó&W4B“ÊWrFFRÑFFRÊÊ˜rÇí≤ÜGW&Fñˆ‰Fó2≤V∆óFT&ˆÁW4Fó2í¢ÉcCíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7B7&VFóG4÷Ç“FVfV«D7&VFóG4÷Ñf˜%∆‚á7FGW2ì∞¢ñbÇWÜó7FñÊrí∞¢6F'rÁ&W&RÄ¢$îÂ4U%BîÂDÚ6ˆFW2Ü6ˆFR¬V÷ñ¬¬∆‚¬7FófR¬Wáó&W5ˆB¬7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFóG5ˆFFR¬7&VFVEˆB¬7G&óUˆ7W7Fˆ÷W%ˆñBíd≈TU2ÉÚ√Ú√Ú√√Ú√Ú√√Ú∆FFWFñ÷RÇvÊ˜rrí√Úí ¢íÁ'V‚ÜÊWt6ˆFR¬7W7Fˆ÷W$V÷ñ¬¬7FGW2¬Wáó&W4B¬7&VFóG4÷Ç¬vWEFˆFï7G"Çí¬6W76ñˆ‚Ê7W7Fˆ÷W"«¬ÁV∆¬ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑7G&óU“6ˆFR7,:ú:ì¢G∂ÊWt6ˆFW“˜W"G∂7W7Fˆ÷W$V÷ñ«“∆‚G∑7FGW7“G∂V∆óFT&ˆÁW4Fó2ÚÇ≤G∂V∆óFT&ˆÁW4Fó7÷¢ˆffW'G2¬ˆfg&RFR∆Ê6V÷VÁBñ¢"'÷ì∞¢6ˆÁ7BFu7G&óR“7FGW2””“&V∆óFR"Ú$TƒïDR"¢7FGW2””“'fó"Ú%dï"¢7FGW2ÁFıWW$66RÇì∞¢'&WfÙFD6ˆÁF7BÜ7W7Fˆ÷W$V÷ñ¬¬Fu7G&óR¬$e""¬ÁV∆¬¬∞¢5T%45$ïDîÙÂı5DEU3¢&7FófR"¿¢5E$ïUÙ5U5DÙ‘U%ÙîC¢6W76ñˆ‚Ê7W7Fˆ÷W"«¬""¿¢4ıU$4S¢'7G&óR"¿¢5$TDTEÙC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢“íÊ6F6ÇÇÇí”‚∑“ì∞¢“V«6Rñbá6W76ñˆ‚Ê7W7Fˆ÷W"í∞¢ÚÚ&VÁ6VñvÊR7G&óUˆ7W7Fˆ÷W%ˆñB÷V÷R7W"V‚6ˆ◊FRFV¶7&VRfÁB6R6Ü◊ ¢ÚÚÜ÷ñw&Fñˆ‚&WG&ˆ7FófRF˜V6R¬6Á2676W"∆W26ˆFW2WÜó7FÁG2í‡¢6F'rÁ&W&RÇ%UDDR6ˆFW24UB7G&óUˆ7W7Fˆ÷W%ˆñB“ÚtÑU$RV÷ñ¬“Ú‰B∆‚“Ú‰B7FófR“"íÁ'V‚á6W76ñˆ‚Ê7W7Fˆ÷W"¬7W7Fˆ÷W$V÷ñ¬¬7FGW2ì∞¢–¢6F'rÊ6∆˜6RÇì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óU“6ˆFR7&VFñˆ‚W'&˜#¢"¬RÊ÷W76vRì≤–¢–†¢ÚÚ)H)HV÷ñ¬FR6ˆÊfó&÷Fñˆ‚fñ'&WfÚ)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ñbÜ7W7Fˆ÷W$V÷ñ¬bb%$UdıÙïÙ¥Uíí∞¢Ü7ñÊ2Çí”‚∞¢G'í∞¢6ˆÁ7B6F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B6ˆFU&˜w2“6F"Á&W&RÇ%4TƒT5B6ˆFR¬∆‚e$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“"íÊ∆¬Ü7W7Fˆ÷W$V÷ñ¬ì∞¢6F"Ê6∆˜6RÇì∞†¢6ˆÁ7B6ˆFT∆ó7B“6ˆFU&˜w2Ê÷á"”‡¢«G#„«FB7Gñ∆S“'FFñÊs£áÇgÉ∂fˆÁB÷f÷ñ«ì¶÷ˆÊ˜76S∂fˆÁB◊6ó¶S£áÉ∂fˆÁB◊vVñváC£É∂∆WGFW"◊76ñÊs¢„ÜV”∂6ˆ∆˜#¢6V6VcB#‚G∑"Ê6ˆFW”¬˜FC‡¢«FB7Gñ∆S“'FFñÊs£áÇgÉ∂fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢3v#É&#‚G∑"Á∆‚ÁFıWW$66RÇó”¬˜FC„¬˜G#Ê ¢íÊ¶ˆñ‚Ç""ì∞†¢ÚÚ∆ñV‚BvñÁfóFFñˆ‚VÊóVRfW'2∆R6Ê¬GR∆ñW"6ÜWL:íÖ7FÊF&Bı&V÷óV“ÙV∆óFRê¢∆WB&V÷óV’FV∆Vw&‘&∆ˆ6≤“"#∞¢ñbÖ≤'7FÊF&B"¬'&V÷óV“"¬'fó"¬&V∆óFR%“ÊñÊ6«VFW2á7FGW2íí∞¢6ˆÁ7BñÁfóFT∆ñÊ≤“vóB7&VFU&V÷óV‘ñÁfóFT∆ñÊ≤Ü7W7Fˆ÷W$V÷ñ¬¬7FGW2ì∞¢ñbÜñÁfóFT∆ñÊ≤í∞¢&V÷óV’FV∆Vw&‘&∆ˆ6≤“∆Fób7Gñ∆S“&&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr«&v&É3B√#√#3Ç¬„í«&v&Ésí√s√##í¬„Çíì∂&˜&FW#£Ç6ˆ∆ñB&v&É3B√#√#3Ç¬„#Rì∂&˜&FW"◊&FóW3£É∑FFñÊs£#É∂÷&vñ‚◊F˜£#GÉ∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£GÉ∂fˆÁB◊vVñváC£s∂6ˆ∆˜#¢3#&C6VS∂÷&vñ‚÷&˜GFˆ”£áÇ#Ô	˘;"Fˆ‚66W2Rw&˜WRFV∆Vw&“&V÷óV”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢3v#É&∂÷&vñ‚÷&˜GFˆ”£'Ç#‰∆ñV‚W'6ˆÊÊV¬W6vRVÊóVR(	BÊR∆R'FvR2„∆'#ÂGRí&V6ˆó2∆W26ñvÊWÇf˜'G2Ü6ˆÊfñÊ6RÉR≤íV‚Fó&V7B„¬ˆFóc‡¢∆á&Vc“"G∂ñÁfóFT∆ñÊ∑“"7Gñ∆S“&Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≥∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3#&C6VR¬3FcCfSRì∂6ˆ∆˜#¢6ffc∑FFñÊs£'Ç#áÉ∂&˜&FW"◊&FóW3£áÉ∂fˆÁB◊6ó¶S£GÉ∂fˆÁB◊vVñváC£s∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#Â&V¶ˆñÊG&R∆Rw&˜WR&V÷óV“(i#¬ˆ‡¢¬ˆFócÊ∞¢“V«6R∞¢6ˆÁ6ˆ∆RÊW'&˜"Ü∑7G&óU“ñÁfóFR&V÷óV“Êˆ‚|:ñÏ:ó,:í˜W"G∂7W7Fˆ÷W$V÷ñ«“(	Bl:ó&ñfñW"VR∆R&˜BW7BF÷ñ‚GR6Ê∆ì∞¢–¢–†¢ÚÚ&6'FR"Üˆfg&R(*¬í&WFó&VRGR&6˜W'27Fñb∆R#íÛrÛ##b¢∆'&Ê6ÜP¢ÚÚBwW6V∆¬FVFñVRW7B7W&ñ÷VR¬6WV¬V‚vV&Üˆˆ≤Üó7F˜&óVR˜W'&óBVÊ6˜&P¢ÚÚ˜'FW"6R7FGWBWBFˆ÷&R∆˜'27W"∆R62"FVfWB6í÷FW76˜W2ÜV7V‡¢ÚÚW6V∆¬ffñ6ÜR«WF˜BRwVÊRˆfg&RVí‚vWÜó7FR«W2í‡¢6ˆÁ7BW6V∆ƒ&∆ˆ6≤“7FGW2””“'&V÷óV“ ¢Ú∆Fób7Gñ∆S“&&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr«&v&É#"√sR√SR¬„í«&v&É#CR√#√cb¬„bíì∂&˜&FW#£Ç6ˆ∆ñB&v&É#"√sR√SR¬„#Rì∂&˜&FW"◊&FóW3£É∑FFñÊs£#É∂÷&vñ‚◊F˜£#GÉ∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£GÉ∂fˆÁB◊vVñváC£s∂6ˆ∆˜#¢6CFc3s∂÷&vñ‚÷&˜GFˆ”£áÇ#Â76RRÊófVR7WW&ñWW#¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢3v#É&∂÷&vñ‚÷&˜GFˆ”£'Ç#‰V∆óFRÚdï¢∆"7Gñ∆S“&6ˆ∆˜#¢6V6VcB#„36ñvÊWÇˆ¶˜W"fˆ˜F&∆√¬ˆ#‚≤∆"7Gñ∆S“&6ˆ∆˜#¢6CFc3r#Ê∆W'FW26ñvÊ¬f˜'BWFˆ÷FóVW3¬ˆ#‚„∆'#‰∆W2∆W'FW26WV∆W2f∆VÁB∆R&óÇ(	B∆"7Gñ∆S“&6ˆ∆˜#¢3#ìÉ#Á6Á2VÊvvV÷VÁC¬ˆ#‚„¬ˆFóc‡¢∆á&Vc“&áGG3¢Úˆ'WíÁ7G&óRÊ6ˆ“ÛFt”îCTÊñf≥tîì35d3r"7Gñ∆S“&Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≥∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬6CFc3r¬6cV3ÉC"ì∂6ˆ∆˜#¢3∑FFñÊs£Ç#GÉ∂&˜&FW"◊&FóW3£áÉ∂fˆÁB◊6ó¶S£7É∂fˆÁB◊vVñváC£s∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#Â76W"V∆óFRÚdï(	B#í„ì(*¬ˆ÷ˆó3¬ˆ‡¢¬ˆFócÊ ¢¢"#∞†¢6ˆÁ7BáF÷¬“∆Fób7Gñ∆S“&fˆÁB÷f÷ñ«ì§ñÁFW"«7ó7FV“◊Ví«6Á2◊6W&ñc∂÷Ç◊vñGFÉ£SCÉ∂÷&vñ„£WFÛ∂&6∂w&˜VÊC¢3cÉc∂6ˆ∆˜#¢6V6VcC∂&˜&FW"◊&FóW3£GÉ∂˜fW&f∆˜s¶ÜñFFV‚#‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3FcCfSR¬3v36VBì∑FFñÊs£3gÉ∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#GÉ∂fˆÁB◊vVñváC£É∂6ˆ∆˜#¢6ffb#Ó)»R&ˆÊÊV÷VÁBG∑∆‰∆&V«“7FófR¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£GÉ∂6ˆ∆˜#ß&v&É#SR√#SR√#SR¬„sRì∂÷&vñ‚◊F˜£gÇ#ÂF˜W4∆W4÷F6á2(	BRîñÊFWVÊFÁFW2‚V7VÊRV÷˜Fñˆ‚¬6WV∆V÷VÁBFW2FˆÊÊVW2„¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FFñÊs£3'Ç#‡¢«7Gñ∆S“&fˆÁB◊6ó¶S£WÉ∂÷&vñ„£#É∂6ˆ∆˜#¢6ÜV3Ç#‰÷W&6í˜W"Fˆ‚&ˆÊÊV÷VÁBfˆñ6íFˆ‚6ˆFRBv66W2£¬˜‡¢«F&∆R7Gñ∆S“'vñGFÉ£S∂&˜&FW"÷6ˆ∆∆6S¶6ˆ∆∆6S∂&6∂w&˜VÊC¢3C#∂&˜&FW"◊&FóW3£É∂˜fW&f∆˜s¶ÜñFFV„∂÷&vñ‚÷&˜GFˆ”£#GÇ#‚G∂6ˆFT∆ó7G”¬˜F&∆S‡¢«7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢3v#É&∂÷&vñ„£#Ç#ÂWFñ∆ó6R6R6ˆFR7W"∆á&Vc“&áGG3¢Ú˜F˜W6∆W6÷F6á2Ê6ˆ“"7Gñ∆S“&6ˆ∆˜#¢3c3cfc#ÁF˜W6∆W6÷F6á2Ê6ˆ”¬ˆ‚(i"&˜WFˆ‚%6R6ˆÊÊV7FW""(i"VÁG&RFˆ‚V÷ñ¬≤6R6ˆFR„¬˜‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW"#‡¢∆á&Vc“&áGG3¢Ú˜F˜W6∆W6÷F6á2Ê6ˆ“ˆ∆ófR÷ñ"7Gñ∆S“&Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≥∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3FcCfSR¬3v36VBì∂6ˆ∆˜#¢6ffc∑FFñÊs£GÇ3'É∂&˜&FW"◊&FóW3£É∂fˆÁB◊6ó¶S£GÉ∂fˆÁB◊vVñváC£s∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#‰66VFW"R∆ófRî(i#¬ˆ‡¢¬ˆFóc‡¢G∑&V÷óV’FV∆Vw&‘&∆ˆ6∑–¢G∑W6V∆ƒ&∆ˆ6∑–¢G∂&ˆˆ∂÷∂W$V÷ñƒáF÷¬Çó–¢¬ˆFóc‡¢¬ˆFócÊ∞†¢vóB'&Wfı6VÊDV÷ñ¬Ü7W7Fˆ÷W$V÷ñ¬¬	¯ËíFˆ‚&ˆÊÊV÷VÁBG∑∆‰∆&V«“W7B7Fñb(	Bfˆñ6íFˆ‚6ˆFV¬áF÷¬¬≤7&óFñ6√¢G'VR“ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑7G&óU“V÷ñ¬6ˆÊfó&÷Fñˆ‚VÁf˜ú:í:G∂7W7Fˆ÷W$V÷ñ«÷ì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óU“V÷ñ¬W'&˜#¢"¬RÊ÷W76vRì≤–¢“íÇì∞¢–¢–†¢ñbÜWfVÁBÁGóR””“&7W7Fˆ÷W"Á7V'67&óFñˆ‚ÊFV∆WFVB"í∞¢6ˆÁ7B7V"“WfVÁBÊFFÊˆ&¶V7C∞¢F"Á&W&RÇ%UDDRW6W'24UB7FGW2“vg&VRrtÑU$R7G&óU˜7V'67&óFñˆÂˆñB“Ú"íÁ'V‚á7V"ÊñBì∞¢–†¢ÚÚ&VÊ˜WfV∆∆V÷VÁBñR(	BßW7Rvñ6íF˜F∆V÷VÁB'6VÁB¢∆R6ˆFRBv66W27&VRP¢ÚÚ&V÷ñW"ñV÷VÁBÜ6ÜV6∂˜WBÁ6W76ñˆ‚Ê6ˆ◊∆WFVBí‚vWFóB§‘ï2&ˆ∆ˆÊvRWÄ¢ÚÚñV÷VÁG27VófÁG2‚V‚&ˆÊÊRVíñóBFWVó2FW2÷ˆó2f˜ñóB6ˆ‚6ˆFP¢ÚÚWáó&W"R&˜WBFR3"¶˜W'2ñ∆R¬÷V÷R&ˆÊÊV÷VÁBF˜V¶˜W'27Fñb6˜FP¢ÚÚ7G&óR‚ˆ‚∆ñvÊRWáó&W5ˆB7W"∆fñ‚FRW&ñˆFRf7GW&VR"7G&óP¢ÚÚá6˜W&6RFRfW&óFRí¬V‚%4Ù≈RÜ¶÷ó2FFóFñbí¢ñFV◊˜FVÁBVV¬VR6ˆó@¢ÚÚ∆RÊˆ÷'&RFRfˆó2˜R¬vWfVÊV÷VÁBW7B&V¶˜VR‚6ˆÁ7FFR∆˜'2FR¬vVFó@¢ÚÚÜ6RBGRÛÇÛ##b‡¢ñbÜWfVÁBÁGóR””“&ñÁfˆñ6RÁñB"í∞¢6ˆÁ7BñÁb“WfVÁBÊFFÊˆ&¶V7C∞¢6ˆÁ7BV÷ñ¬“ÜñÁbÊ7W7Fˆ÷W%ˆV÷ñ¬«¬""íÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢6ˆÁ7BW&ñˆDVÊB“ñÁbÊ∆ñÊW3ÚÊFFÚÂ≥”ÚÁW&ñˆCÚÊVÊB«¬ñÁbÁW&ñˆEˆVÊC∞¢ñbÜV÷ñ¬bbW&ñˆDVÊBí∞¢6ˆÁ7BWáó&W4B“ÊWrFFRáW&ñˆDVÊB¢íÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢G'í∞¢6ˆÁ7B6F'r“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6ˆÁ7BñÊfÚ“6F'rÁ&W&RÇ%UDDR6ˆFW24UB7FófR“¬Wáó&W5ˆB“ÚtÑU$RV÷ñ¬“Ú‰B∆‚“vg&VRr"íÁ'V‚ÜWáó&W4B¬V÷ñ¬ì∞¢6ˆÁ7B&VÊWvVE&˜r“6F'rÁ&W&RÇ%4TƒT5B∆‚e$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“ı$DU"%í&˜vñBDU42ƒî‘ïB"íÊvWBÜV÷ñ¬ì∞¢6F'rÊ6∆˜6RÇì∞¢ñbÜñÊfÚÊ6ÜÊvW2‚í∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑7G&óU“&VÊ˜WfV∆∆V÷VÁC¢G∂V÷ñ«“”‚7FñbßW7RvRG∂Wáó&W4G“ÇG∂ñÊfÚÊ6ÜÊvW7“6ˆFRá2íñì∞¢ñbá&VÊWvVE&˜rí∞¢'&WfÙFD6ˆÁF7BÜV÷ñ¬¬&VÊWvVE&˜rÁ∆‚ÁFıWW$66RÇí¬$e""¬ÁV∆¬¬∞¢5T%45$ïDîÙÂı5DEU3¢&7FófR"¬î‘TÂEÙdîƒTC¢$‰Ú"¿¢“íÊ6F6ÇÇÇí”‚∑“ì∞¢–¢–¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óU“ñÁfˆñ6RÁñC¢"¬RÊ÷W76vRì≤–¢–¢–†¢ÚÚ6ÜÊvV÷VÁBFR∆ñW"áWw&FRˆF˜vÊw&FRV‚6˜W'2Bv&ˆÊÊV÷VÁB¬fñ∆P¢ÚÚ˜'Fñ¬6∆ñVÁB7G&óRí(	BßW7Rvñ6í¶÷ó2&WW&7WFR¢∆R6ˆFRBv66W0¢ÚÚv&FóB¬vÊ6ñV‚∆‚ñÊFVfñÊñ÷VÁB‚∆R&óÇ7G&óRá6˜W&6RFRfW&óFR¿¢ÚÚ¶÷ó2V‚&÷WG&Rf˜W&Êí"∆R6∆ñVÁBíFWFW&÷ñÊR∆RÊ˜WfVR∆ñW"‡¢ñbÜWfVÁBÁGóR””“&7W7Fˆ÷W"Á7V'67&óFñˆ‚ÁWFFVB"í∞¢6ˆÁ7B7V"“WfVÁBÊFFÊˆ&¶V7C∞¢Ü7ñÊ2Çí”‚∞¢G'í∞¢6ˆÁ7B&ñ6TñB“7V"ÊóFV◊3ÚÊFFÚÂ≥”ÚÁ&ñ6SÚÊñB«¬"#∞¢6ˆÁ7B∆‰÷7V"“∞¢µ5E$ïUı$î4UÙîEı5D‰D$E”¢'7FÊF&B"¿¢µ5E$ïUı$î4UÙîEı$T‘ïT’”¢'&V÷óV“"¿¢µ5E$ïUı$î4UÙîEıdï”¢'fó"¿¢µ5E$ïUı$î4UÙîEÙTƒïDU”¢&V∆óFR"¿¢”∞¢6ˆÁ7BÊWu∆‚“∆‰÷7V%∑&ñ6TñE”∞¢ñbÇÊWu∆‚í&WGW&„∞¢6ˆÁ7B7G&óSB“&WVó&RÇ'7G&óR"ì∞¢6ˆÁ7B7G&óSB“7G&óSBÖ5E$ïUı4T5$UEÙ¥Uíì∞¢6ˆÁ7B7W7Fˆ÷W"“vóB7G&óSBÊ7W7Fˆ÷W'2Á&WG&ñWfRá7V"Ê7W7Fˆ÷W"ì∞¢6ˆÁ7BV÷ñ¬“Ü7W7Fˆ÷W"ÊV÷ñ¬«¬""íÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢ñbÇV÷ñ¬í&WGW&„∞¢6ˆÁ7B6F'r“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6ˆÁ7BWÜó7FñÊu&˜r“6F'rÁ&W&RÇ%4TƒT5B∆‚e$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“ı$DU"%í&˜vñBDU42ƒî‘ïB"íÊvWBÜV÷ñ¬ì∞¢ñbÜWÜó7FñÊu&˜rbbWÜó7FñÊu&˜rÁ∆‚”“ÊWu∆‚í∞¢6ˆÁ7B7&VFóG4÷Ç“ÊWu∆‚””“&V∆óFR"Ú3¢∞¢6F'rÁ&W&RÇ%UDDR6ˆFW24UB∆‚“Ú¬7&VFóG5ˆ÷Ç“ÚtÑU$RV÷ñ¬“Ú‰B7FófR“"íÁ'V‚ÜÊWu∆‚¬7&VFóG4÷Ç¬V÷ñ¬ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑7G&óU“6ÜÊvV÷VÁBFR∆ñW#¢G∂V÷ñ«“G∂WÜó7FñÊu&˜rÁ∆Á“”‚G∂ÊWu∆Á÷ì∞¢ñbÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí∞¢6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬	˘HB∆#‰6ÜÊvV÷VÁBFR∆ñW"7G&óS¬ˆ#Â∆‚G∂V÷ñ«“¢G∂WÜó7FñÊu&˜rÁ∆Á“(i"G∂ÊWu∆Á÷íÊ6F6ÇÇÇí”‚∑“ì∞¢–¢–¢6F'rÊ6∆˜6RÇì∞¢'&WfÙFD6ˆÁF7BÜV÷ñ¬¬ÊWu∆‚ÁFıWW$66RÇí¬$e""¬ÁV∆¬¬∞¢4‰4T≈ÙEıU$îÙEÙT‰C¢7V"Ê6Ê6V≈ˆE˜W&ñˆEˆVÊBÚ%îU2"¢$‰Ú"¿¢5T%45$ïDîÙÂÙT‰C¢7V"Ê7W'&VÁE˜W&ñˆEˆVÊBÚÊWrFFRá7V"Ê7W'&VÁE˜W&ñˆEˆVÊB¢íÁFÙï4ı7G&ñÊrÇí¢""¿¢“íÊ6F6ÇÇÇí”‚∑“ì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óU“7V'67&óFñˆ‚ÁWFFVC¢"¬RÊ÷W76vRì≤–¢“íÇì∞¢–†¢ÚÚñV÷VÁBFR&VÊ˜WfV∆∆V÷VÁB&VgW<:í(	BßW7Rvñ6íF˜F∆V÷VÁBñÁfó6ñ&∆RÜV7VÊP¢ÚÚ∆W'FR‚vWÜó7FóBí‚7G&óR,:ñW76ñRWFˆ÷FóVV÷VÁB«W6ñWW'2fˆó2fÁ@¢ÚÚBvÊÁV∆W"¬v&ˆÊÊV÷VÁBÜ7W7Fˆ÷W"Á7V'67&óFñˆ‚ÊFV∆WFVB&VÊG&∆R&V∆ó0¢ÚÚ∆R÷ˆ÷VÁBfVÁRí¬FˆÊ2ˆ‚‚wíF˜V6ÜR2¬v6<:á2ñ6í(	BßW7FRVÊR∆W'FP¢ÚÚ˜W"VRw&VrVó76R&V∆Ê6W"∆R6∆ñVÁB6í&W6ˆñ‚‚6ˆÁ7FFRfñ¬vVFó@¢ÚÚGRÛÇÛ##b‡¢ñbÜWfVÁBÁGóR””“&ñÁfˆñ6RÁñ÷VÁEˆfñ∆VB"í∞¢6ˆÁ7BñÁb“WfVÁBÊFFÊˆ&¶V7C∞¢6ˆÁ7BV÷ñ¬“ÜñÁbÊ7W7Fˆ÷W%ˆV÷ñ¬«¬""íÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢6ˆÁ7B÷˜VÁB“ñÁbÊ÷˜VÁEˆGVRÚÜñÁbÊ÷˜VÁEˆGVRÚíÁFÙfóÜVBÉ"í≤.(*¬"¢&÷ˆÁFÁBñÊ6ˆÊÁR#∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑7G&óU“ñV÷VÁB&VgW<:ì¢G∂V÷ñ¬«¬&V÷ñ¬ñÊ6ˆÊÁR'“ÇG∂÷˜VÁG“ñì∞¢ñbÜV÷ñ¬í∞¢ÚÚƒ‚&W7FR∆Rg&í∆ñW"GR6∆ñVÁBÜ¶÷ó2V‚6WVFÚ◊7FGWBí¢'&Wf¢ÚÚ6Vv÷VÁFR7W"î‘TÂEÙdîƒTBV‚«W2¬2∆∆6R¬FRƒ‚‡¢G'í∞¢6ˆÁ7B6F'"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B6ˆFU&˜r“6F'"Á&W&RÇ%4TƒT5B∆‚e$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“ı$DU"%í&˜vñBDU42ƒî‘ïB"íÊvWBÜV÷ñ¬ì∞¢6F'"Ê6∆˜6RÇì∞¢6ˆÁ7BFub“6ˆFU&˜rÚ6ˆFU&˜rÁ∆‚ÁFıWW$66RÇí¢$e$TR#∞¢'&WfÙFD6ˆÁF7BÜV÷ñ¬¬Fub¬$e""¬ÁV∆¬¬≤î‘TÂEÙdîƒTC¢%îU2"“íÊ6F6ÇÇÇí”‚∑“ì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óU“'&WfÚñ÷VÁEˆfñ∆VC¢"¬RÊ÷W76vRì≤–¢–¢ñbÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí∞¢6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬)™˚àÚ∆#ÂñV÷VÁB7G&óR&VgW<:ì¬ˆ#Â∆‚G∂V÷ñ¬«¬&V÷ñ¬ñÊ6ˆÊÁR'“(	BG∂÷˜VÁG’∆Â7G&óRf,:ñW76ñW"WFˆ÷FóVV÷VÁBÊê¢Ê6F6ÇÇÇí”‚∑“ì∞¢–¢–†¢ÚÚ&V÷&˜W'6V÷VÁB(	B¬v&vVÁBW7BL:ñ¨:&W'Fí¬¬v6<:á2FˆóB2v',:ßFW"F˜WBFP¢ÚÚ7VóFRÜ6ˆÁG&ó&V÷VÁB:VÊR6ñ◊∆R,:ó6ñ∆ñFñˆ‚¬VífR&˜WBFR∆¢ÚÚ:ó&ñˆFRL:ñ¨:ú:ñRí‚Vv∆V÷VÁBñÁfó6ñ&∆RßW7Rvñ6í‡¢ñbÜWfVÁBÁGóR””“&6Ü&vRÁ&VgVÊFVB"í∞¢6ˆÁ7B6Ü&vR“WfVÁBÊFFÊˆ&¶V7C∞¢6ˆÁ7BV÷ñ¬“Ü6Ü&vRÊ&ñ∆∆ñÊuˆFWFñ«3ÚÊV÷ñ¬«¬""íÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢6ˆÁ7B÷˜VÁB“6Ü&vRÊ÷˜VÁE˜&VgVÊFVBÚÜ6Ü&vRÊ÷˜VÁE˜&VgVÊFVBÚíÁFÙfóÜVBÉ"í≤.(*¬"¢&÷ˆÁFÁBñÊ6ˆÊÁR#∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑7G&óU“&V÷&˜W'6V÷VÁC¢G∂V÷ñ¬«¬&V÷ñ¬ñÊ6ˆÊÁR'“ÇG∂÷˜VÁG“ñì∞¢ñbÜV÷ñ¬í∞¢G'í≤F"Á&W&RÇ%UDDRW6W'24UB7FGW2“vg&VRrtÑU$RV÷ñ¬“Ú"íÁ'V‚ÜV÷ñ¬ì≤“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óU“&VgVÊBW6W'3¢"¬RÊ÷W76vRì≤–¢G'í∞¢6ˆÁ7B6F'r“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6F'rÁ&W&RÇ%UDDR6ˆFW24UB7FófR“tÑU$RV÷ñ¬“Ú"íÁ'V‚ÜV÷ñ¬ì∞¢6F'rÊ6∆˜6RÇì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óU“&VgVÊB6ˆFW3¢"¬RÊ÷W76vRì≤–¢'&WfÙFD6ˆÁF7BÜV÷ñ¬¬$e$TR"¬$e""¬ÁV∆¬¬≤5T%45$ïDîÙÂı5DEU3¢&6Ê6V∆∆VB"“íÊ6F6ÇÇÇí”‚∑“ì∞¢–¢ñbÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí∞¢6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬	˘KB∆#Â&V÷&˜W'6V÷VÁB7G&óS¬ˆ#Â∆‚G∂V÷ñ¬«¬&V÷ñ¬ñÊ6ˆÊÁR'“(	BG∂÷˜VÁG’∆‰6<:á2L:ó67Fól:íÊê¢Ê6F6ÇÇÇí”‚∑“ì∞¢–¢–†¢&W2Êß6ˆ‚á≤&V6VófVC¢G'VR“ì∞ß“ì∞†¶7ñÊ2gVÊ7Fñˆ‚ÜÊF∆T7&VFT6ÜV6∂˜WBá&W¬&W2í∞¢6ˆÁ7B≤∆‚¬W6W%ˆñB¬V÷ñ¬““&WÊ&ˆGí«¬∑”∞¢ñbÇ5E$ïUı4T5$UEÙ¥Uíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6ˆÊfñwW&Fñˆ‚7G&óR÷ÁVÁFR"“ì∞†¢ÚÚ&6'FR"Üˆfg&R(*¬í&WFó&VRGR&6˜W'27Fñb∆R#íÛrÛ##b¬FV6ó6ñˆ‚fˆÊFFWW ¢ÚÚ(	B&V7FófVR∆RBÛÇÛ##b¬÷ó2T‰ïTT‘TÂB˜W"∆R&6ÜBFR¶WFˆ‚FWVó2∆P¢ÚÚ&˜WFˆ‚'V˜FWVó6R"7W"∆ófRîáfˆó"5$TDïE5ÙUÑÑU5DTB6˜FRg&ˆÁBí¢0¢ÚÚ&V÷ó6RV‚fÁBFÁ2∆RGVÊÊV¬FRfVÁFRˆ÷&∂WFñÊrvVÊW&¬‡¢Ú¢ÚÚ'7FÊF&B"ˆñÁFóB"W'&WW"fW'25E$ïUı$î4UÙîEı$T‘ïT“¢V‚V¬6W@¢ÚÚVÊGˆñÁB˜W"7FÊF&BW&óBf7GW&R∆R&óÇ&V÷óV“‚6˜'&ñvRR76vR(	@¢ÚÚ6ˆÁ7FFR∆R#íÛrÛ##b¬÷ó2T5T‚&˜WFˆ‚fó6ñ&∆R‚vV∆∆R6WBVÊGˆñÁBÜ∆W0¢ÚÚ&˜WFˆÁ2Bv&ˆÊÊV÷VÁBWFñ∆ó6VÁBFW2ñ÷VÁB∆ñÊ∑27G&óRFó&V7G2í¬FˆÊ2V7V‡¢ÚÚ6∆ñVÁB‚vWFRf7GW&RR÷Wfó2&óÇ"6R6ÜV÷ñ‚&V6ó2‡¢6ˆÁ7B&ñ6T÷“∞¢6'FS¢5E$ïUı$î4UÙîEÙ4%DR¿¢7FÊF&C¢5E$ïUı$î4UÙîEı5D‰D$B¿¢&V÷óV”¢5E$ïUı$î4UÙîEı$T‘ïT“¿¢fó¢5E$ïUı$î4UÙîEıdï¿¢V∆óFS¢5E$ïUı$î4UÙîEÙTƒïDR¿¢”∞¢6ˆÁ7B&ñ6TñB“&ñ6T÷∑∆Â”∞¢ñbÇ&ñ6TñBí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%∆‚ñÊ6ˆÊÁR"“ì∞†¢G'í∞¢6ˆÁ7B7G&óR“&WVó&RÇ'7G&óR"ì∞¢6ˆÁ7B7G&óR“7G&óRÖ5E$ïUı4T5$UEÙ¥Uíì∞¢6ˆÁ7B÷ˆFR“∆‚””“&6'FR"Ú'ñ÷VÁB"¢'7V'67&óFñˆ‚#∞¢6ˆÁ7B6∆V‰V÷ñ¬“7G&ñÊrÜV÷ñ¬«¬""íÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢6ˆÁ7B6W76ñˆ‚“vóB7G&óRÊ6ÜV6∂˜WBÁ6W76ñˆÁ2Ê7&VFRá∞¢÷ˆFR¿¢ñ÷VÁEˆ÷WFÜˆE˜GóW3¢≤&6&B%“¿¢∆ñÊUˆóFV◊3¢∑≤&ñ6S¢&ñ6TñB¬VÁFóGì¢’“¿¢7V66W75˜W&√¢áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“ˆ∆ófR÷ñ˜7V66W73”g∆„“G∑∆Á÷¿¢6Ê6V≈˜W&√¢&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“˜7V'67&óFñˆ‚"¿¢6∆ñVÁE˜&VfW&VÊ6UˆñC¢7G&ñÊráW6W%ˆñB«¬""í¿¢ÚÚfW'&˜Vñ∆∆R¬vV÷ñ¬6V«VíGR6ˆ◊FR6ˆÊÊV7FR˜W"&6'FR"á&6ÜBFP¢ÚÚ¶WFˆ‚í¢6ñÊˆ‚V‚6ÜWFWW"Ví6ó6óBVÊRWG&RG&W76R∆6ó76P¢ÚÚ7&VW&óBV‚6V6ˆÊB6ˆ◊FRR∆ñWRFR7&VFóFW"∆R6ñV‚áfˆó ¢ÚÚw&ÁD6'FT7&VFóEFÙWÜó7FñÊt66˜VÁBí(	B6ˆÁ7FFR∆RBÛÇÛ##b‡¢‚‚‚Ü6∆V‰V÷ñ¬Ú≤7W7Fˆ÷W%ˆV÷ñ√¢6∆V‰V÷ñ¬“¢∑“í¿¢“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬W&√¢6W76ñˆ‚ÁW&¬“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß–†¢ÚÚ∆Vv7í7&VFR÷6ÜV6∂˜WB66W76ñ&∆Rfñˆ7&VFR÷6ÜV6∂˜WBWBˆíˆ7&VFR÷6ÜV6∂˜W@¶Á˜7BÇ"ˆ7&VFR÷6ÜV6∂˜WB"¬ÜÊF∆T7&VFT6ÜV6∂˜WBì∞¶Á˜7BÇ"ˆ7&VFR÷6ÜV6∂˜WB"¬ÜÊF∆T7&VFT6ÜV6∂˜WBì∞†¢ÚÚ)H)H6ˆ÷◊VÊóGí7FG2ÖFV∆Vw&“÷V÷&W"6˜VÁBí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶∆WBFt÷V÷&W$66ÜR“≤6˜VÁC¢ÁV∆¬¬G3¢”∞¶ÊvWBÇ"ˆ6ˆ÷◊VÊóGí◊7FG2"¬7ñÊ2á&W¬&W2í”‚∞¢ñbá&ˆ6W72ÊVÁbÂ4ÑıuıDTƒTu$’Ù‘T‘$U%Ù4ıTÂB”“'G'VR"í∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬÷V÷&W'3¢ÁV∆¬¬ÜñFFV„¢G'VR“ì∞¢–†¢ÚÚG'í◊V«Fó∆R&˜BFˆ∂VÁ2(	BvÜñ6ÜWfW"ó2F÷ñ‚ˆbFÜRg&VR6ÜÊÊV¿¢6ˆÁ7B$ıEıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ı@¢«¬&ˆ6W72ÊVÁbÂDTƒTu$’Ù$ıEıDÙ¥T‡¢«¬&ˆ6W72ÊVÁb‰$ıEıDÙ¥T‡¢«¬"#∞¢6ˆÁ7B4Ñ‰‰T≈ÙîB“&ˆ6W72ÊVÁbÂDTƒTu$’Ùe$TUÙ4Ñ‰‰T≈Ùî@¢«¬&ˆ6W72ÊVÁbÂDTƒTu$’Ù4ÑEÙî@¢«¬&ˆ6W72ÊVÁbÂDTƒTu$’Ù4Ñ‰‰T≈Ùî@¢«¬$F˜W6∆W6÷F6á5ˆg"#∞†¢ÚÚ66ÜR÷ñÁWFW0¢ñbáFt÷V÷&W$66ÜRÊ6˜VÁB”“ÁV∆¬bbFFRÊÊ˜rÇí“Ft÷V÷&W$66ÜRÁG2¬¢c¢í∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷V÷&W'3¢Ft÷V÷&W$66ÜRÊ6˜VÁB“ì∞¢–†¢ñbÇ$ıEıDÙ¥T‚í∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬÷V÷&W'3¢ÁV∆¬“ì∞¢–†¢G'í∞¢6ˆÁ7BFuW&¬“áGG3¢ÚˆíÁFV∆Vw&“Ê˜&rˆ&˜BG¥$ıEıDÙ¥TÁ“ˆvWD6ÜD÷V÷&W'46˜VÁCˆ6ÜEˆñC“G∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÑ4Ñ‰‰T≈ÙîBó÷∞¢6ˆÁ7BFF“vóBÊWr&ˆ÷ó6RÇá&W6ˆ«fR¬&V¶V7Bí”‚∞¢áGG2ÊvWBáFuW&¬¬"”‚∞¢∆WB&ˆGí“"#∞¢"Êˆ‚Ç&FF"¬2”‚&ˆGí≥“2ì∞¢"Êˆ‚Ç&VÊB"¬Çí”‚≤G'í≤&W6ˆ«fRÑ•4Ù‚Á'6RÜ&ˆGííì≤“6F6ÇÜRí≤&V¶V7BÜRì≤““ì∞¢“íÊˆ‚Ç&W'&˜""¬&V¶V7Bì∞¢“ì∞¢ñbÜFFÊˆ≤bbFFÁ&W7V«Bí∞¢Ft÷V÷&W$66ÜR“≤6˜VÁC¢FFÁ&W7V«B¬G3¢FFRÊÊ˜rÇí”∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷V÷&W'3¢FFÁ&W7V«B“ì∞¢–¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬÷V÷&W'3¢ÁV∆¬“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂6ˆ÷◊VÊóGí◊7FG5“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬÷V÷&W'3¢ÁV∆¬“ì∞¢–ß“ì∞†¢ÚÚ)H)H6ˆÊ6ñ∆RW&f˜&÷Ê6R(	B&˜V6∆RBv&VÁFó76vR)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆ6ˆÊ6ñ∆R◊W&f˜&÷Ê6R"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$66W2F÷ñ‚&WVó2"“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚ÊvWD6ˆÊ6ñ∆UW&f˜&÷Ê6RÇí“ì∞ß“ì∞†¢ÚÚ)H)H6ÜF˜rWf¬(	B6∆76V÷VÁBFW2î26ÊFñFFW2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ)H)H&ˆÊÚ7FG2(	B6∆76V÷VÁB"GóRFR&í≤vVÁB)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆF÷ñ‚˜&ˆÊÚ◊7FG2"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$66W2F÷ñ‚&WVó2"“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚ÊvWE&ˆÊı7FG2Çí“ì∞ß“ì∞†¶Á˜7BÇ"ˆñÁFW&Ê¬˜&ˆÊÚ◊7FG2"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤6V7&WB““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$f˜&&ñFFV‚"“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚ÊvWE&ˆÊı7FG2Çí“ì∞ß“ì∞†¶ÊvWBÇ"ˆF÷ñ‚˜6ÜF˜r◊W&b"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$66W2F÷ñ‚&WVó2"“ì∞¢G'í∞¢6ˆÁ7B'îvVÁB“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¿¢4ıTÂBÇ¢í2F˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰Bí2vñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí2∆˜76W2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rï2ÂTƒ¬DÑT‚T≈4RT‰Bí2VÊFñÊr¿¢$ıT‰BÑdrÜ6ˆÊfñFVÊ6Rí√í2fuˆ6ˆÊfñFVÊ6R¿¢‘î‚Ü7&VFVEˆBí2fó'7EˆWf¬¿¢‘ÇÜ7&VFVEˆBí2∆7EˆWf¿¢e$Ù“6ÜF˜uˆWf«0¢u$ıU%ívVÁEˆÊ÷P¢íÊ∆¬Çì∞†¢6ˆÁ7BvóFÖ7FG2“'îvVÁBÊ÷á"”‚á∞¢‚‚Á"¿¢vñÁ&FS¢"ÁF˜F¬‚Ú÷FÇÁ&˜VÊBÇá"ÁvñÁ2Ú÷FÇÊ÷ÇÉ¬"ÁvñÁ2≤"Ê∆˜76W2íí¢í¢ÁV∆¬¿¢&W6ˆ«fVC¢"ÁvñÁ2≤"Ê∆˜76W2¿¢Fó5ˆ7FófS¢"Êfó'7EˆWf¬Ú÷FÇÊ6Vñ¬ÇÑFFRÊÊ˜rÇí“ÊWrFFRá"Êfó'7EˆWf¬íÊvWEFñ÷RÇííÚÉcCí¢¿¢“íê¢ÚÚ6∆76V÷VÁB"FWÇFR,:óW76óFRá2"Êˆ÷'&R''WBFRfñ7Fˆó&W2í†¢ÚÚVÊRî:ìR7W"&ó2FˆóB76W"fÁBVÊRî:SR7W"3&ó2‡¢Á6˜'BÇÜ¬"í”‚∞¢ñbÜÁvñÁ&FR”“ÁV∆¬bb"ÁvñÁ&FR”“ÁV∆¬í&WGW&‚"ÁvñÁ&FR“ÁvñÁ&FS∞¢ñbÜÁvñÁ&FR”“ÁV∆¬í&WGW&‚”∞¢ñbÜ"ÁvñÁ&FR”“ÁV∆¬í&WGW&‚∞¢&WGW&‚"ÁF˜F¬“ÁF˜F√∞¢“ì∞†¢6ˆÁ7B&V6VÁDWf«2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬&WB¬6ˆÊfñFVÊ6R¬˜WF6ˆ÷R¬7&VFVEˆ@¢e$Ù“6ÜF˜uˆWf«0¢ı$DU"%í7&VFVEˆBDU40¢ƒî‘ïBS ¢íÊ∆¬Çì∞†¢6ˆÁ7B7FófTvVÁG2“4ÑDıuÙtTÂE2Ê÷Ü”‚á≤Ê÷S¢ÊÊ÷R¬ñ6ˆ„¢Êñ6ˆ‚¬7FófS¢ÊVÊ&∆VBÇí“íì∞†¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬vVÁG3¢vóFÖ7FG2¬&V6VÁC¢&V6VÁDWf«2¬6ˆÊfñwW&VC¢7FófTvVÁG2“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ)H)HvVÁBW&f˜&÷Ê6R(	B6∆76V÷VÁBV&∆ñ2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"˜7G&FVwí÷F6Ü&ˆ&B"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$66W2F÷ñ‚&WVó2"“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚ÊvWE7G&FVwîF6Ü&ˆ&BÇí“ì∞ß“ì∞†¶Á˜7BÇ"ˆñÁFW&Ê¬˜7G&FVwí◊&W˜'B"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤6V7&WB““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$f˜&&ñFFV‚"“ì∞¢–¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚ÊvWE7G&FVwîF6Ü&ˆ&BÇí“ì∞ß“ì∞†¶Á˜7BÇ"ˆñÁFW&Ê¬˜7G&ˆÊr◊6ñvÊ«2"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤6V7&WB¬Fá&W6Üˆ∆B¬÷ñÂ&W6ˆ«fVB¬∆ñ÷óB““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$f˜&&ñFFV‚"“ì∞¢–¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢Fá&W6Üˆ∆C¢ÁV÷&W"áFá&W6Üˆ∆B«¬Éí¿¢÷ñÂ&W6ˆ«fVC¢ÁV÷&W"Ü÷ñÂ&W6ˆ«fVB«¬Rí¿¢6ñvÊ«3¢vWE7G&ˆÊu6ñvÊƒ∆W'G2á≤Fá&W6Üˆ∆B¬÷ñÂ&W6ˆ«fVB¬∆ñ÷óB“í¿¢“ì∞ß“ì∞††¢ÚÚ)H)H7FFó7FóVW2V&∆óVW2,:ñV∆∆W2WFñ∆ó<:ñW2"∆R6óFRWB¬v∆ñ6Fñˆ‚)H)H ¶ÊvWBÇ"˜V&∆ñ2÷Ê«ó6ó2◊7FG2"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BvVÁEF˜F«2“F"Á&W&RÜ ¢4TƒT5@¢4ıTÂBÑDï5Dî‰5B÷F6Öˆ∂Wíí2÷F6ÜW5˜G&6∂VB¿¢4ıTÂBÇ¢í2&VFñ7FñˆÁ5˜G&6∂VB¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72ríDÑT‚T≈4RT‰Bê¢2&VFñ7FñˆÁ5˜&W6ˆ«fV@¢e$Ù“vVÁE˜&VFñ7FñˆÁ0¢íÊvWBÇí«¬∑”∞†¢6ˆÁ7B6ˆÊ6ñ∆UF˜F«2“F"Á&W&RÜ ¢4TƒT5@¢4ıTÂBÇ¢í26ˆÊ6ñ∆UˆÊ«ó6W2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72ríDÑT‚T≈4RT‰Bê¢26ˆÊ6ñ∆U˜&W6ˆ«fV@¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢íÊvWBÇí«¬∑”∞†¢6ˆÁ7BFñ«îvVÁB“F"Á&W&RÜ ¢4TƒT5@¢FFRÜ7&VFVEˆBí2¶˜W"¿¢4ıTÂBÑDï5Dî‰5B÷F6Öˆ∂Wíí2÷F6ÜW2¿¢4ıTÂBÇ¢í2&VFñ7FñˆÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72ríDÑT‚T≈4RT‰Bê¢2&W6ˆ«fV@¢e$Ù“vVÁE˜&VFñ7FñˆÁ0¢tÑU$R7&VFVEˆBï2‰ıBÂTƒ¿¢u$ıU%íFFRÜ7&VFVEˆBê¢ı$DU"%í¶˜W"40¢íÊ∆¬Çì∞†¢6ˆÁ7BFñ«î6ˆÊ6ñ∆R“F"Á&W&RÜ ¢4TƒT5@¢FFRÜÊ«ó6VEˆBí2¶˜W"¿¢4ıTÂBÇ¢í2Ê«ó6W2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72ríDÑT‚T≈4RT‰Bê¢2&W6ˆ«fV@¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RÊ«ó6VEˆBï2‰ıBÂTƒ¿¢u$ıU%íFFRÜÊ«ó6VEˆBê¢ı$DU"%í¶˜W"40¢íÊ∆¬Çì∞†¢&W2Á6WBÇ$66ÜR‘6ˆÁG&ˆ¬"¬&ÊÚ◊7F˜&R"ì∞¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢÷F6ÜW5˜G&6∂VC¢ÁV÷&W"ÜvVÁEF˜F«2Ê÷F6ÜW5˜G&6∂VB«¬í¿¢&VFñ7FñˆÁ5˜G&6∂VC¢ÁV÷&W"ÜvVÁEF˜F«2Á&VFñ7FñˆÁ5˜G&6∂VB«¬í¿¢&VFñ7FñˆÁ5˜&W6ˆ«fVC¢ÁV÷&W"ÜvVÁEF˜F«2Á&VFñ7FñˆÁ5˜&W6ˆ«fVB«¬í¿¢6ˆÊ6ñ∆UˆÊ«ó6W3¢ÁV÷&W"Ü6ˆÊ6ñ∆UF˜F«2Ê6ˆÊ6ñ∆UˆÊ«ó6W2«¬í¿¢6ˆÊ6ñ∆U˜&W6ˆ«fVC¢ÁV÷&W"Ü6ˆÊ6ñ∆UF˜F«2Ê6ˆÊ6ñ∆U˜&W6ˆ«fVB«¬í¿¢Fñ«ïˆvVÁC¢Fñ«îvVÁB¿¢Fñ«ïˆ6ˆÊ6ñ∆S¢Fñ«î6ˆÊ6ñ∆P¢“ì∞¢“6F6ÇÜW'&˜"í∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑V&∆ñ2÷Ê«ó6ó2◊7FG5“"¬W'&˜"Ê÷W76vRì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á∞¢ˆ≥¢f«6R¿¢W'&˜#¢%7FFó7FóVW2FV◊˜&ó&V÷VÁBñÊFó7ˆÊñ&∆W2 ¢“ì∞¢–ß“ì∞†¶ÊvWBÇ"ˆvVÁB◊W&f˜&÷Ê6R"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢6ˆÁ7BWFÇ“fW&ñgî6ˆFRÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇÁf∆ñB«¬ÜWFÇÁ∆‚”“&V∆óFR"bbó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRííí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$66W2V∆óFR&WVó2"“ì∞¢6ˆÁ7BW&b“vWDvVÁEW&f˜&÷Ê6RÇì∞¢G'í∞¢6ˆÁ7B÷WF“F"Á&W&RÜ ¢4TƒT5@¢4ıTÂBÑDï5Dî‰5BÜˆ÷R«¬w¬r«¬ví«¬w¬r«¬FFRÜ7&VFVEˆBíí2÷F6ÜW5˜G&6∂VB¿¢4ıTÂBÑDï5Dî‰5B÷F6Öˆ∂Wíí26Ê6Ü˜G5˜G&6∂VB¿¢4ıTÂBÇ¢í2&VFñ7FñˆÁ5˜G&6∂VB¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rï2‰ıBÂTƒ¬DÑT‚T≈4RT‰Bí2&VFñ7FñˆÁ5˜&W6ˆ«fV@¢e$Ù“vVÁE˜&VFñ7FñˆÁ0¢íÊvWBÇì∞¢6ˆÁ7BVÊFñÊr“F"Á&W&RÄ¢%4TƒT5B÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬4ıTÂBÇ¢í2‚e$Ù“vVÁE˜&VFñ7FñˆÁ2tÑU$R˜WF6ˆ÷Rï2ÂTƒ¬u$ıU%í÷F6Öˆ∂Wíı$DU"%í7&VFVEˆBDU42ƒî‘ïBR ¢íÊ∆¬Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬W&f˜&÷Ê6S¢W&b¬÷WF¬VÊFñÊuˆ÷F6ÜW3¢VÊFñÊr“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬W&f˜&÷Ê6S¢W&b¬÷WF¢∑“¬VÊFñÊuˆ÷F6ÜW3¢µ““ì∞¢–ß“ì∞†¢ÚÚ)H)H÷G&ñ6Rî9r÷&6å:í(	BVV∆∆RîW7Bf˜'FR7W"VV¬GóRFR&í)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆvVÁB÷÷&∂WB÷÷G&óÇ"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$66W2F÷ñ‚&WVó2"“ì∞¢G'í∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¬÷&∂WEˆ∆ñÊR¿¢4ıTÂBÇ¢íF˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí∆˜76W2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rï2ÂTƒ¬DÑT‚T≈4RT‰BíVÊFñÊp¢e$Ù“vVÁEˆ÷&∂WE˜&VFñ7FñˆÁ0¢u$ıU%ívVÁEˆÊ÷R¬÷&∂WEˆ∆ñÊP¢íÊ∆¬Çì∞¢6ˆÁ7B∆ñÊT∆&V«2“≤'WG3¢$˜fW"ıVÊFW""„R"¬'GG3¢$%EE2"¬&W7V«FC¢%,:ó7V«FBÉ""¬◊C¢$'WB:á&R’B"”∞¢6ˆÁ7B÷G&óÇ“∑”∞¢6ˆÁ7B&W7D'î∆ñÊR“∑”∞¢&˜w2Êf˜$V6Çá"”‚∞¢6ˆÁ7B&W6ˆ«fVB“"ÁvñÁ2≤"Ê∆˜76W3∞¢6ˆÁ7BvñÁ&FR“&W6ˆ«fVB‚Ú÷FÇÁ&˜VÊBá"ÁvñÁ2Ú&W6ˆ«fVB¢í¢ÁV∆√∞¢ñbÇ÷G&óÖ∑"ÊvVÁEˆÊ÷U“í÷G&óÖ∑"ÊvVÁEˆÊ÷U““∑”∞¢÷G&óÖ∑"ÊvVÁEˆÊ÷U’∑"Ê÷&∂WEˆ∆ñÊU““≤∆&V√¢∆ñÊT∆&V«5∑"Ê÷&∂WEˆ∆ñÊU“«¬"Ê÷&∂WEˆ∆ñÊR¬F˜F√¢"ÁF˜F¬¬vñÁ3¢"ÁvñÁ2¬∆˜76W3¢"Ê∆˜76W2¬VÊFñÊs¢"ÁVÊFñÊr¬&W6ˆ«fVB¬vñÁ&FR”∞¢ÚÚ÷Vñ∆∆WW&Rî"÷&6å:íÜ÷ñ‚R,:ó6ˆ«W2ê¢ñbá&W6ˆ«fVB„“RbbvñÁ&FR”“ÁV∆¬í∞¢ñbÇ&W7D'î∆ñÊU∑"Ê÷&∂WEˆ∆ñÊU“«¬vñÁ&FR‚&W7D'î∆ñÊU∑"Ê÷&∂WEˆ∆ñÊU“ÁvñÁ&FRí∞¢&W7D'î∆ñÊU∑"Ê÷&∂WEˆ∆ñÊU““≤vVÁC¢"ÊvVÁEˆÊ÷R¬vñÁ&FR¬&W6ˆ«fVB¬∆&V√¢∆ñÊT∆&V«5∑"Ê÷&∂WEˆ∆ñÊU“«¬"Ê÷&∂WEˆ∆ñÊR”∞¢–¢–¢“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷G&óÇ¬&W7Eˆ'ïˆ÷&∂WC¢&W7D'î∆ñÊR“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞†¢ÚÚ)H)HF÷ñ‚(	B÷G&ñ6RîÇ÷&6ÜRÇ4Ñ’îÙ‰‰BáG&ˆó6ñV÷RÊófVRí)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚFV÷ÊFRFRw&Vr∆R"ÛÇÛ##b¢'VV∆∆RîW7B«W2f˜'FR7W"VV¬GóRFP¢ÚÚ&íUBVV¬6Ü◊ñˆÊÊB"(	BˆvVÁB÷÷&∂WB÷÷G&óÇ6í÷FW77W2‚vVR ¢ÚÚFñ÷VÁ6ñˆÁ2ÜvVÁBÇ÷&6ÜRí‚6V«Ví÷6í¶˜WFR∆R6Ü◊ñˆÊÊB¬fV2V‡¢ÚÚ÷ñÊñ◊V“FRR&W6ˆ«W2˜W"WfóFW"Bvffñ6ÜW"V‚#RvñÁ&FR"7W""÷F6á2‡¶ÊvWBÇ"ˆF÷ñ‚ˆvVÁB÷÷&∂WB÷6ˆ◊WFóFñˆ‚÷÷G&óÇ"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'í«¬∑”∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢G'í∞¢6ˆÁ7B÷ñÂ&W6ˆ«fVB“÷FÇÊ÷ÇÉ¬'6TñÁBá&WÁVW'íÊ÷ñ‚í«¬Rì∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¬÷&∂WEˆ∆ñÊR¬6ˆ◊WFóFñˆ‚¿¢4ıTÂBÇ¢íF˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívñÁ0¢e$Ù“vVÁEˆ÷&∂WE˜&VFñ7FñˆÁ0¢tÑU$R˜WF6ˆ÷Rï2‰ıBÂTƒ¬‰B6ˆ◊WFóFñˆ‚ï2‰ıBÂTƒ¿¢u$ıU%ívVÁEˆÊ÷R¬÷&∂WEˆ∆ñÊR¬6ˆ◊WFóFñˆ‡¢Ñdî‰rF˜F¬„“¢ı$DU"%íF˜F¬DU40¢íÊ∆¬Ü÷ñÂ&W6ˆ«fVBì∞¢6ˆÁ7B∆ñÊT∆&V«2“≤'WG3¢$˜fW"ıVÊFW""„R"¬'GG3¢$%EE2"¬&W7V«FC¢%,:ó7V«FBÉ""¬◊C¢$'WB:á&R’B"”∞¢6ˆÁ7B&Êw2“&˜w2Ê÷á"”‚á∞¢vVÁC¢"ÊvVÁEˆÊ÷R¿¢÷&6ÜS¢∆ñÊT∆&V«5∑"Ê÷&∂WEˆ∆ñÊU“«¬"Ê÷&∂WEˆ∆ñÊR¿¢6Ü◊ñˆÊÊC¢"Ê6ˆ◊WFóFñˆ‚¿¢&W6ˆ«W3¢"ÁF˜F¬¿¢vñÁ&FS¢÷FÇÁ&˜VÊBÇá"ÁvñÁ2Ú"ÁF˜F¬í¢íÚ¿¢“íì∞¢ÚÚ÷Vñ∆∆WW&Rî"Ü÷&6å:í¬6Ü◊ñˆÊÊBí(	B∆&WˆÁ6RFó&V7FR∆VW7Fñˆ‚FRw&Vr‡¢6ˆÁ7B÷Vñ∆∆WW&U$6ˆ÷&Ú“∑”∞¢f˜"Ü6ˆÁ7B"ˆb&Êw2í∞¢6ˆÁ7B≤“G∑"Ê÷&6ÜW“+rG∑"Ê6Ü◊ñˆÊÊG÷∞¢ñbÇ÷Vñ∆∆WW&U$6ˆ÷&ı∂µ“«¬"ÁvñÁ&FR‚÷Vñ∆∆WW&U$6ˆ÷&ı∂µ“ÁvñÁ&FRí∞¢÷Vñ∆∆WW&U$6ˆ÷&ı∂µ““≤vVÁC¢"ÊvVÁB¬vñÁ&FS¢"ÁvñÁ&FR¬&W6ˆ«W3¢"Á&W6ˆ«W2”∞¢–¢–¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢6WVñ≈ˆ÷ñÂ˜&W6ˆ«W3¢÷ñÂ&W6ˆ«fVB¿¢6ˆ÷&ñÊó6ˆÁ5ˆ6˜WfW'FW3¢&Êw2Ê∆VÊwFÇ¿¢÷Vñ∆∆WW&Uˆñ˜%ˆ÷&6ÜU˜Öˆ6Ü◊ñˆÊÊC¢÷Vñ∆∆WW&U$6ˆ÷&Ú¿¢FWFñ«3¢&Êw2¿¢“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞†¢ÚÚ)H)HF÷ñ‚(	Bf˜&6W",:ó6ˆ«WFñˆ‚÷ÁVV∆∆RBwV‚÷F6Ç)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"˜V&∆ñ2÷Üó7F˜'í"¬á&W¬&W2í”‚∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬óFV◊3¢vWEV&∆ñ4Üó7F˜'îóFV◊2Çí“ì∞ß“ì∞†¶Á˜7BÇ"ˆF÷ñ‚˜&W6ˆ«fR÷÷F6Ç"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬Üˆ÷R¬ví¬66˜&UˆÜˆ÷R¬66˜&Uˆví““&WÊ&ˆGí«¬∑”∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢ñbÇÜˆ÷R«¬ví«¬66˜&UˆÜˆ÷R””“VÊFVfñÊVB«¬66˜&Uˆví””“VÊFVfñÊVBí∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢&Üˆ÷R¬ví¬66˜&UˆÜˆ÷R¬66˜&Uˆví&WVó2"“ì∞¢–¢WFı&W6ˆ«fU&VFñ7FñˆÁ2á≤Üˆ÷R¬ví¬66˜&UˆÜˆ÷S¢ÁV÷&W"á66˜&UˆÜˆ÷Rí¬66˜&Uˆvì¢ÁV÷&W"á66˜&Uˆvíí¬7FGW3¢$dî‰ï4ÑTB"“ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷W76vS¢,:ó6ˆ«WFñˆ‚∆Ê<:ñR˜W"G∂Üˆ÷W“g2G∂vó“ÇG∑66˜&UˆÜˆ÷W““G∑66˜&Uˆvó“ñ“ì∞ß“ì∞†¢ÚÚf˜&6W"∆R&GG&vRFRDıUDU2∆W2,:ñFñ7FñˆÁ2V‚GFVÁFRÜ÷F6á2fñÊó2ê¶Á˜7BÇ"ˆF÷ñ‚˜&W6ˆ«fR◊7F∆R"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÊ&ˆGí«¬∑”∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢6ˆÁ7B6˜VÁEVÊFñÊr“Çí”‚F"Á&W&RÜ ¢4TƒT5BÖ4TƒT5B4ıTÂBÇ¢íe$Ù“vVÁE˜&VFñ7FñˆÁ2tÑU$R˜WF6ˆ÷Rï2ÂTƒ¬ê¢≤Ö4TƒT5B4ıTÂBÇ¢íe$Ù“vVÁEˆ÷&∂WE˜&VFñ7FñˆÁ2tÑU$R˜WF6ˆ÷Rï2ÂTƒ¬í2‡¢íÊvWBÇíÊ„∞¢6ˆÁ7B&Vf˜&R“6˜VÁEVÊFñÊrÇì∞¢vóB&W6ˆ«fU7F∆U&VFñ7FñˆÁ2Çì∞¢6ˆÁ7BgFW"“6˜VÁEVÊFñÊrÇì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&W6ˆ«fVC¢&Vf˜&R“gFW"¬VÊFñÊuˆ&Vf˜&S¢&Vf˜&R¬VÊFñÊuˆgFW#¢gFW"“ì∞ß“ì∞†¢ÚÚVFóB6ˆ◊∆WB¢W&bFR4ÑTRîÜˆffñ6ñV∆∆W2≤6ÜF˜r$î&∆Ê6ÜW2"í¬÷G&ñ6P¢ÚÚî9v÷&6å:í¬÷Vñ∆∆WW"vVÁB"GóRFR&í(	B∆RF˜WBVÁf˜ú:í7W"FV∆Vw&“ÜW&÷W2F÷ñ‚‡¶ÊvWBÇ"ˆF÷ñ‚ˆgV∆¬÷vVÁG2÷VFóB"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'í«¬∑”∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢G'í∞¢ÚÚíîˆffñ6ñV∆∆W2áf˜FR≤L:ñ6ó6ñˆ‚í(	BFWVó2vVÁE˜&VFñ7FñˆÁ0¢6ˆÁ7Bˆffñ6ñƒvVÁG2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¿¢4ıTÂBÇ¢íF˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí∆˜76W2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rï2ÂTƒ¬DÑT‚T≈4RT‰BíVÊFñÊr¿¢$ıT‰BÑdrÜ6ˆÊfñFVÊ6Rí√ífuˆ6ˆÊ`¢e$Ù“vVÁE˜&VFñ7FñˆÁ0¢u$ıU%ívVÁEˆÊ÷P¢íÊ∆¬ÇíÊ÷á"”‚∞¢6ˆÁ7B&W6ˆ«fVB“"ÁvñÁ2≤"Ê∆˜76W3∞¢&WGW&‚≤‚‚Á"¬&W6ˆ«fVB¬vñÁ&FS¢&W6ˆ«fVB‚Ú÷FÇÁ&˜VÊBá"ÁvñÁ2Ú&W6ˆ«fVB¢í¢ÁV∆¬”∞¢“íÁ6˜'BÇÜ¬"í”‚Ü"ÁvñÁ&FRÛÚ”í“ÜÁvñÁ&FRÛÚ”íì∞†¢ÚÚ"íî&∆Ê6ÜW2Ü&Ê2BvW76íí(	BFWVó26ÜF˜uˆWf«2¬¶÷ó2V&∆ú:ñW0¢6ˆÁ7B6ÜF˜tvVÁG2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¿¢4ıTÂBÇ¢íF˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí∆˜76W2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rï2ÂTƒ¬DÑT‚T≈4RT‰BíVÊFñÊr¿¢$ıT‰BÑdrÜ6ˆÊfñFVÊ6Rí√ífuˆ6ˆÊ`¢e$Ù“6ÜF˜uˆWf«0¢u$ıU%ívVÁEˆÊ÷P¢íÊ∆¬ÇíÊ÷á"”‚∞¢6ˆÁ7B&W6ˆ«fVB“"ÁvñÁ2≤"Ê∆˜76W3∞¢&WGW&‚≤‚‚Á"¬&W6ˆ«fVB¬vñÁ&FS¢&W6ˆ«fVB‚Ú÷FÇÁ&˜VÊBá"ÁvñÁ2Ú&W6ˆ«fVB¢í¢ÁV∆¬”∞¢“íÁ6˜'BÇÜ¬"í”‚Ü"ÁvñÁ&FRÛÚ”í“ÜÁvñÁ&FRÛÚ”íì∞†¢ÚÚ2í÷G&ñ6Rî9rGóRFR&í(	BVV∆∆RîW7B÷Vñ∆∆WW&R7W"Vˆê¢6ˆÁ7B÷G&óÖ&˜w2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¬÷&∂WEˆ∆ñÊR¿¢4ıTÂBÇ¢íF˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí∆˜76W0¢e$Ù“vVÁEˆ÷&∂WE˜&VFñ7FñˆÁ0¢u$ıU%ívVÁEˆÊ÷R¬÷&∂WEˆ∆ñÊP¢íÊ∆¬Çì∞¢6ˆÁ7B∆ñÊT∆&V«2“≤'WG3¢$˜fW"ıVÊFW""„R"¬'GG3¢$%EE2"¬&W7V«FC¢%,:ó7V«FBÉ""¬◊C¢$'WB:á&R’B"”∞¢6ˆÁ7B&W7D'î÷&∂WB“∑”∞¢÷G&óÖ&˜w2Êf˜$V6Çá"”‚∞¢6ˆÁ7B&W6ˆ«fVB“"ÁvñÁ2≤"Ê∆˜76W3∞¢ñbá&W6ˆ«fVB¬Rí&WGW&„≤ÚÚ6WVñ¬¢÷ñ‚R,:ó6ˆ«W2˜W"fó2fñ&∆P¢6ˆÁ7Bw"“÷FÇÁ&˜VÊBá"ÁvñÁ2Ú&W6ˆ«fVB¢ì∞¢ñbÇ&W7D'î÷&∂WE∑"Ê÷&∂WEˆ∆ñÊU“«¬w"‚&W7D'î÷&∂WE∑"Ê÷&∂WEˆ∆ñÊU“ÁvñÁ&FRí∞¢&W7D'î÷&∂WE∑"Ê÷&∂WEˆ∆ñÊU““≤vVÁC¢"ÊvVÁEˆÊ÷R¬vñÁ&FS¢w"¬&W6ˆ«fVB¬∆&V√¢∆ñÊT∆&V«5∑"Ê÷&∂WEˆ∆ñÊU“«¬"Ê÷&∂WEˆ∆ñÊR”∞¢–¢“ì∞†¢ÚÚBíf˜&÷FW"∆R÷W76vRFV∆Vw&–¢6ˆÁ7Bf◊DvVÁB“Üí”‚G∂ÁvñÁ&FR”“ÁV∆¬ÚG∂ÁvñÁ&FW“V¢&‚ˆ'“(	BG∂ÊvVÁEˆÊ÷W“ÇG∂ÁvñÁ7’rÚG∂Ê∆˜76W7‘¬¬G∂ÁVÊFñÊw“V‚GFVÁFR¬6ˆÊb‚÷˜íG∂Êfuˆ6ˆÊb«¬“Rñ∞¢6ˆÁ7Bˆffñ6ñƒ&∆ˆ6≤“ˆffñ6ñƒvVÁG2Ê∆VÊwFÇÚˆffñ6ñƒvVÁG2Ê÷Üf◊DvVÁBíÊ¶ˆñ‚Ç%∆‚"í¢"ÜV7VÊRFˆÊÏ:ñRí#∞¢6ˆÁ7B6ÜF˜t&∆ˆ6≤“6ÜF˜tvVÁG2Ê∆VÊwFÇÚ6ÜF˜tvVÁG2Ê÷Üf◊DvVÁBíÊ¶ˆñ‚Ç%∆‚"í¢"ÜV7VÊRFˆÊÏ:ñRí#∞¢6ˆÁ7B&W7D&∆ˆ6≤“ˆ&¶V7BÊ∂Wó2Ü&W7D'î÷&∂WBíÊ∆VÊwFÄ¢Úˆ&¶V7BÁf«VW2Ü&W7D'î÷&∂WBíÊ÷Ü"”‚	¯¯bG∂"Ê∆&V«“(i"∆#‚G∂"ÊvVÁG”¬ˆ#‚ÇG∂"ÁvñÁ&FW“R7W"G∂"Á&W6ˆ«fVG“ñíÊ¶ˆñ‚Ç%∆‚"ê¢¢"á276W¢FRFˆÊÏ:ñW2(öSR,:ó6ˆ«W2"÷&6å:íí#∞†¢6ˆÁ7B◊6r“∞¢	˙z∆#‰TDïB4Ù’ƒUBDU2î¬ˆ#Ê¿¢	˘8RG∂ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬bíÁ&W∆6RÇ%B"¬""ó÷¿¢¿¢∆#Ô	¯ÍÚîˆffñ6ñV∆∆W2Ñ6ˆÊ6ñ∆Rì¬ˆ#Ê¿¢ˆffñ6ñƒ&∆ˆ6≤¿¢¿¢∆#Ó)™¢î&∆Ê6ÜW2Ü&Ê2BvW76íì¬ˆ#Ê¿¢6ÜF˜t&∆ˆ6≤¿¢¿¢∆#Ô	¯¯b÷Vñ∆∆WW&Rî"GóRFR&ì¬ˆ#Ê¿¢&W7D&∆ˆ6≤¿¢¿¢)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H¿¢fW'&˜RcìÉC"+r,:Üv∆W2#ı#"7FófW6¿¢“Ê¶ˆñ‚Ç%∆‚"ì∞†¢∆WBFV∆Vw&’6VÁB“f«6S∞¢ñbÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí∞¢FV∆Vw&’6VÁB“vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬◊6rì∞¢–†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢FV∆Vw&’˜6VÁC¢FV∆Vw&’6VÁB¿¢ˆffñ6ñ≈ˆvVÁG3¢ˆffñ6ñƒvVÁG2¿¢6ÜF˜uˆvVÁG3¢6ÜF˜tvVÁG2¿¢&W7Eˆ'ïˆ÷&∂WC¢&W7D'î÷&∂WB¿¢÷W76vU˜&WfñWs¢◊6r¿¢“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚVFóBV˜FñFñV‚¢F˜W2∆W2&ˆÊ˜2GR¶˜W"á,:ó6ˆ«W2≤V‚GFVÁFRífV266˜&RfñÊ¿¢ÚÚWFñ∆ó<:í˜W"f∆ñFW"&ñ¬÷ÁVRÇ,:ó7V«FG2"(	BgVRWÜÜW7FófRWBG&Á7&VÁFR‡¶ÊvWBÇ"ˆF÷ñ‚ˆFñ«í÷VFóB"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'í«¬∑”∞¢ñbÇó4F÷ñ‰66W72ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢6ˆÁ7BFí“á&WÁVW'íÊFí«¬ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ííÁ6∆ñ6RÉ¬ì∞¢G'í∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BñB¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¿¢÷ñÁWFUˆEˆÊ«ó6ó2¬66˜&UˆÜˆ÷UˆEˆÊ«ó6ó2¬66˜&UˆvïˆEˆÊ«ó6ó2¿¢fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬˜WF6ˆ÷R¬Ê«ó6VEˆB¬&W6ˆ«fVEˆ@¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R7V'7G"ÜÊ«ó6VEˆB√√í“¢ı$DU"%íÊ«ó6VEˆB40¢íÊ∆¬ÜFíì∞¢6ˆÁ7BvñÁ2“&˜w2Êfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“'vñ‚"íÊ∆VÊwFÉ∞¢6ˆÁ7B∆˜76W2“&˜w2Êfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“&∆˜72"íÊ∆VÊwFÉ∞¢6ˆÁ7BVÊFñÊr“&˜w2Êfñ«FW"á"”‚"Ê˜WF6ˆ÷RíÊ∆VÊwFÉ∞¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¬Fí¬F˜F√¢&˜w2Ê∆VÊwFÇ¬vñÁ2¬∆˜76W2¬VÊFñÊr¿¢óFV◊3¢&˜w2Ê÷á"”‚á∞¢ñC¢"ÊñB¿¢÷F6É¢G∑"ÊÜˆ÷W“g2G∑"Êvó÷¿¢6ˆ◊WFóFñˆ„¢"Ê6ˆ◊WFóFñˆ‚«¬"Á7˜'B«¬""¿¢&WC¢"Ê&W7Eˆ&WB¿¢6ˆÊfñFVÊ6S¢"Ê6ˆÊfñFVÊ6R¿¢÷ñÁWFUˆEˆÊ«ó6ó3¢"Ê÷ñÁWFUˆEˆÊ«ó6ó2¿¢66˜&UˆEˆÊ«ó6ó3¢"Á66˜&UˆÜˆ÷UˆEˆÊ«ó6ó2“ÁV∆¿¢ÚG∑"Á66˜&UˆÜˆ÷UˆEˆÊ«ó6ó7““G∑"Á66˜&UˆvïˆEˆÊ«ó6ó7÷¢ÁV∆¬¿¢fñÊ≈˜66˜&S¢"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¿¢ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢ÁV∆¬¿¢˜WF6ˆ÷S¢"Ê˜WF6ˆ÷R«¬'VÊFñÊr"¿¢Ê«ó6VEˆC¢"ÊÊ«ó6VEˆB¿¢&W6ˆ«fVEˆC¢"Á&W6ˆ«fVEˆB¿¢Fó7∆ì¢"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬bb"Ê÷ñÁWFUˆEˆÊ«ó6ó2“ÁV∆¿¢Ú66˜&RfñÊ¬G∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó“¬G∑"Ê&W7Eˆ&WG“FˆÊÏ:í:∆G∑"Ê÷ñÁWFUˆEˆÊ«ó6ó7÷R÷ñÊ ¢¢ÁV∆¬¿¢“íí¿¢“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ)H)HF÷ñ‚(	BVÁf˜ñW"&˜'BFR7FGWB7W"FV∆Vw&“ÜW&÷W2F÷ñ‚)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ)H)H&˜BV÷ñ¬ÜW&÷W2ÜÜW&÷W4F˜W6∆W6÷F6á2Ê6ˆ“í(	B'&˜Vñ∆∆ˆÁ2f∆ñL:ó2:V‚6∆ñ0¢ÚÚFWVó2FV∆Vw&“F÷ñ‚¬¶÷ó2BvVÁfˆíWFˆ÷FóVRáfˆó"ÜW&÷W5ˆ÷ñ≈ˆ&˜BÊß2í‡¶6ˆÁ7BÜW&÷W4÷ñƒ&˜B“&WVó&RÇ"‚ˆÜW&÷W5ˆ÷ñ≈ˆ&˜B"ì∞¶6ˆÁ7B‘î≈Ù$ıEÙD‘îÂıDÙ¥T‚“&ˆ6W72ÊVÁb‰‘î≈Ù$ıEÙD‘îÂıDÙ¥T‚«¬"#∞¶6ˆÁ7BÑU$‘U5Ù‘î≈ıU4U"“&ˆ6W72ÊVÁb‰ÑU$‘U5Ù‘î≈ıU4U"«¬"#∞¶6ˆÁ7BÑU$‘U5Ù‘î≈Ùı55tı$B“&ˆ6W72ÊVÁb‰ÑU$‘U5Ù‘î≈Ùı55tı$B«¬"#∞¶6ˆÁ7BÑU$‘U5Ù‘î≈Ùî‘ÙÑı5B“&ˆ6W72ÊVÁb‰ÑU$‘U5Ù‘î≈Ùî‘ÙÑı5B«¬&ñ÷ÊÜ˜7FñÊvW"Ê6ˆ“#∞¶6ˆÁ7BÑU$‘U5Ù‘î≈Ùî‘ıı%B“ÁV÷&W"á&ˆ6W72ÊVÁb‰ÑU$‘U5Ù‘î≈Ùî‘ıı%B«¬ìì2ì∞¶6ˆÁ7BÑU$‘U5Ù‘î≈ı4’EÙÑı5B“&ˆ6W72ÊVÁb‰ÑU$‘U5Ù‘î≈ı4’EÙÑı5B«¬'6◊GÊÜ˜7FñÊvW"Ê6ˆ“#∞¶6ˆÁ7BÑU$‘U5Ù‘î≈ı4’Eıı%B“ÁV÷&W"á&ˆ6W72ÊVÁb‰ÑU$‘U5Ù‘î≈ı4’Eıı%B«¬CcRì∞¶6ˆÁ7B4ïDUÙ$4UıU$¬“&ˆ6W72ÊVÁbÂ4ïDUÙ$4UıU$¬«¬&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“#∞†¶gVÊ7Fñˆ‚áF÷ƒF÷ñ‰7Fñˆ‚áFóF∆R¬÷W76vRí∞¢&WGW&‚¬Fˆ7GóRáF÷√„∆áF÷√„∆ÜVC„∆÷WF6Ü'6WC“'WFb”Ç#„«FóF∆S‚G∑FóF∆W”¬˜FóF∆S‡¢«7Gñ∆SÊ&ˆGó∂fˆÁB÷f÷ñ«ìß6Á2◊6W&ñc∂&6∂w&˜VÊC¢3###∂6ˆ∆˜#¢6SVSvV#∂Fó7∆ì¶f∆WÉ∂∆ñv‚÷óFV◊3¶6VÁFW#∂ßW7Fñgí÷6ˆÁFVÁC¶6VÁFW#∂ÜVñváC£fÉ∂÷&vñ„£–¢Fóg∑FWáB÷∆ñv„¶6VÁFW#∑FFñÊs£#Gá”¬˜7Gñ∆S„¬ˆÜVC„∆&ˆGì„∆Fóc„∆É#‚G∑FóF∆W”¬ˆÉ#„«‚G∂÷W76vW”¬˜„¬ˆFóc„¬ˆ&ˆGì„¬ˆáF÷√Ê∞ß–†¶ÊvWBÇ"ˆF÷ñ‚ˆ÷ñ¬÷G&gG2Û¶ñBˆ&˜fR"¬7ñÊ2á&W¬&W2í”‚∞¢ñbÇ‘î≈Ù$ıEÙD‘îÂıDÙ¥T‚«¬&WÁVW'íÁFˆ∂V‚”“‘î≈Ù$ıEÙD‘îÂıDÙ¥T‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÁ6VÊBÜáF÷ƒF÷ñ‰7Fñˆ‚Ç$Êˆ‚WF˜&ó<:í"¬$∆ñV‚ñÁf∆ñFR‚"íì∞¢–¢6ˆÁ7B&W7V«B“vóBÜW&÷W4÷ñƒ&˜BÁ6VÊD&˜fVDG&gBÜF"¬&WÁ&◊2ÊñB¬∞¢6◊GÜ˜7C¢ÑU$‘U5Ù‘î≈ı4’EÙÑı5B¬6◊G˜'C¢ÑU$‘U5Ù‘î≈ı4’Eıı%B¿¢W6W#¢ÑU$‘U5Ù‘î≈ıU4U"¬77v˜&C¢ÑU$‘U5Ù‘î≈Ùı55tı$B¿¢“ì∞¢ñbá&W7V«BÊˆ≤í&WGW&‚&W2Á6VÊBÜáF÷ƒF÷ñ‰7Fñˆ‚Ç.)»RVÁf˜ú:í"¬$∆,:óˆÁ6R&ñV‚:óL:íVÁf˜ú:ñRR6∆ñVÁB‚"íì∞¢&W2Á7FGW2ÉCíÁ6VÊBÜáF÷ƒF÷ñ‰7Fñˆ‚Ç$W'&WW""¬&W7V«BÊW'&˜"«¬$VÁfˆíñ◊˜76ñ&∆R‚"íì∞ß“ì∞†¶ÊvWBÇ"ˆF÷ñ‚ˆ÷ñ¬÷G&gG2Û¶ñB˜&V¶V7B"¬á&W¬&W2í”‚∞¢ñbÇ‘î≈Ù$ıEÙD‘îÂıDÙ¥T‚«¬&WÁVW'íÁFˆ∂V‚”“‘î≈Ù$ıEÙD‘îÂıDÙ¥T‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÁ6VÊBÜáF÷ƒF÷ñ‰7Fñˆ‚Ç$Êˆ‚WF˜&ó<:í"¬$∆ñV‚ñÁf∆ñFR‚"íì∞¢–¢6ˆÁ7B&W7V«B“ÜW&÷W4÷ñƒ&˜BÁ&V¶V7DG&gBÜF"¬&WÁ&◊2ÊñBì∞¢ñbá&W7V«BÊˆ≤í&WGW&‚&W2Á6VÊBÜáF÷ƒF÷ñ‰7Fñˆ‚Ç.)ÿ¬&V¶WL:í"¬$∆R'&˜Vñ∆∆ˆ‚:óL:í:ñ6'L:í¬&ñV‚‚v:óL:íVÁf˜ú:í‚"íì∞¢&W2Á7FGW2ÉCíÁ6VÊBÜáF÷ƒF÷ñ‰7Fñˆ‚Ç$W'&WW""¬&W7V«BÊW'&˜"«¬%&V¶WBñ◊˜76ñ&∆R‚"íì∞ß“ì∞†¶ñbÑÑU$‘U5Ù‘î≈ıU4U"bbÑU$‘U5Ù‘î≈Ùı55tı$Bí∞¢6ˆÁ7Bˆ∆ƒ÷ñ∆&˜Ç“Çí”‚∞¢∆WB7G&óT6∆ñVÁB“ÁV∆√∞¢G'í≤ñbÖ5E$ïUı4T5$UEÙ¥Uíí7G&óT6∆ñVÁB“&WVó&RÇ'7G&óR"íÖ5E$ïUı4T5$UEÙ¥Uíì≤“6F6Ç∑–¢ÜW&÷W4÷ñƒ&˜BÁˆ∆ƒÜW&÷W4÷ñ∆&˜ÇÜF"¬∞¢W6W#¢ÑU$‘U5Ù‘î≈ıU4U"¬77v˜&C¢ÑU$‘U5Ù‘î≈Ùı55tı$B¿¢ñ÷Ü˜7C¢ÑU$‘U5Ù‘î≈Ùî‘ÙÑı5B¬ñ÷˜'C¢ÑU$‘U5Ù‘î≈Ùî‘ıı%B¿¢7G&óS¢7G&óT6∆ñVÁB¬'&WfÙî∂Wì¢%$UdıÙïÙ¥Uí¬÷ó7G&ƒî∂Wì¢‘ï5E$≈ÙïÙ¥Uí¿¢Ê«ó6ó4VÊvñÊR¬6VÊEFV∆Vw&‘÷W76vR¬FV∆Vw&‘F÷ñ‰6ÜDñC¢DTƒTu$’ı5Uı%EÙ4ÑEÙîB«¬DTƒTu$’ÙD‘îÂÙ4ÑEÙîB¿¢6óFT&6UW&√¢4ïDUÙ$4UıU$¬¬F÷ñÂFˆ∂V„¢‘î≈Ù$ıEÙD‘îÂıDÙ¥T‚¿¢“íÊ6F6ÇÜR”‚6ˆÁ6ˆ∆RÊW'&˜"Ç%∂ÜW&÷W2÷÷ñ≈“ñÁFW'f√¢"¬RÊ÷W76vRíì∞¢”∞¢6WDñÁFW'f¬áˆ∆ƒ÷ñ∆&˜Ç¬R¢cì∞¢6WEFñ÷V˜WBáˆ∆ƒ÷ñ∆&˜Ç¬Sì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂ÜW&÷W2÷÷ñ≈“&˜BV÷ñ¬7Fñbá&VÃ:áfRF˜WFW2∆W2R÷ñ‚í"ì∞ß“V«6R∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂ÜW&÷W2÷÷ñ≈“Êˆ‚6ˆÊfñwW,:íÑÑU$‘U5Ù‘î≈ıU4U"ÙÑU$‘U5Ù‘î≈Ùı55tı$B'6VÁG2í(	BñÊ7Fñb"ì∞ß–†¶Á˜7BÇ"ˆF÷ñ‚˜6VÊB◊&W˜'B"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÊ&ˆGí«¬∑”∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%DTƒTu$’ÙD‘îÂÙ4ÑEÙîBÊˆ‚6ˆÊfñwW,:í"“ì∞†¢6ˆÁ7BW&b“vWDvVÁEW&f˜&÷Ê6RÇì∞¢6ˆÁ7BFFU7G"“ÊWrFFRÇíÁFÙ∆ˆ6∆TFFU7G&ñÊrÇ&g"‘e""¬≤Fì¢#"÷FñvóB"¬÷ˆÁFÉ¢#"÷FñvóB"¬ñV#¢&ÁV÷W&ñ2"¬Ü˜W#¢#"÷FñvóB"¬÷ñÁWFS¢#"÷FñvóB"“ì∞†¢6ˆÁ7BvVÁG2“ˆ&¶V7BÊVÁG&ñW2áW&bíÊ÷ÇÖ∂Ê÷R¬“í”‚∞¢6ˆÁ7BF˜F¬“áÁvñÁ2«¬í≤áÊ∆˜76W2«¬ì∞¢6ˆÁ7Bw"“F˜F¬‚Ú÷FÇÁ&˜VÊBáÁvñÁ2ÚF˜F¬¢í¢∞¢6ˆÁ7BVÊFñÊr“ÁVÊFñÊr«¬∞¢6ˆÁ7B7FGW2“F˜F¬„“Úáw"„“ÉÚ.)»R"¢.)™˚àÚ"í¢/	˘HB#∞¢&WGW&‚≤Ê÷R¬vñÁ3¢ÁvñÁ2«¬¬∆˜76W3¢Ê∆˜76W2«¬¬F˜F¬¬w"¬VÊFñÊr¬7FGW2”∞¢“íÁ6˜'BÇÜ¬"í”‚"Áw"“Áw"ì∞†¢6ˆÁ7BvVÁD∆ñÊW2“vVÁG2Ê÷Ü”‡¢G∂Á7FGW7“G∂ÊÊ÷W”¢G∂ÁF˜F¬‚ÚG∂Áw'“RÇG∂ÁvñÁ7“ÚG∂ÁF˜F«“ñ¢G∂ÁVÊFñÊw“V‚GFVÁFV÷ ¢íÊ¶ˆñ‚Ç%∆‚"ì∞†¢∆WB÷WF“∑”∞¢G'í∞¢÷WF“F"Á&W&RÜ ¢4TƒT5@¢4ıTÂBÑDï5Dî‰5BÜˆ÷R«¬w¬r«¬ví«¬w¬r«¬FFRÜ7&VFVEˆBíí2÷F6ÜW2¿¢4ıTÂBÇ¢í2&VFñ7FñˆÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rï2‰ıBÂTƒ¬DÑT‚T≈4RT‰Bí2&W6ˆ«fVB¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷Rï2ÂTƒ¬DÑT‚T≈4RT‰Bí2VÊFñÊp¢e$Ù“vVÁE˜&VFñ7FñˆÁ0¢íÊvWBÇí«¬∑”∞¢“6F6ÇÜRí∑–†¢∆WBñ6¥ñÊfÚ“"#∞¢G'í∞¢6ˆÁ7B∆7Eñ6≤“F"Á&W&RÇ%4TƒT5B¢e$Ù“ñ6∑2ı$DU"%í&˜vñBDU42ƒî‘ïB"íÊvWBÇì∞¢ñbÜ∆7Eñ6≤í∞¢ñ6¥ñÊfÚ“∆Ô	¯ÍÚ∆#‰FW&ÊñW"ñ6≤£¬ˆ#Â∆‚G∂∆7Eñ6≤ÊÜˆ÷R«¬rw“g2G∂∆7Eñ6≤Êví«¬rw’∆‚G∂∆7Eñ6≤Ê&WB«¬rw“G∂∆7Eñ6≤ÊˆFG2«¬rw’∆‚6ˆÊfñÊ6S¢G∂∆7Eñ6≤Ê6ˆÊfñFVÊ6R«¬sÚw“Û∆‚,:ó7V«FC¢G∂∆7Eñ6≤Á&W7V«B«¬vV‚GFVÁFRw÷∞¢–¢“6F6ÇÜRí∑–†¢6ˆÁ7BFWáB“	˘8≤∆#Â$ı%BÑU$‘U2(	BG∂FFU7G'”¬ˆ#‡†Ø	˙Ib∆#ÂW&f˜&÷Ê6RFW2vVÁG2£¬ˆ#‡¢G∂vVÁD∆ñÊW7–†Ø	˘8¢∆#‰FˆÊÏ:ñW2£¬ˆ#‡¢÷F6á27Vófó2¢G∂÷WFÊ÷F6ÜW2«¬–¢,:ñFñ7FñˆÁ2¢G∂÷WFÁ&VFñ7FñˆÁ2«¬–¢,:ó6ˆ«VW2¢G∂÷WFÁ&W6ˆ«fVB«¬–¢V‚GFVÁFR¢G∂÷WFÁVÊFñÊr«¬–¢G∑ñ6¥ñÊf˜–†Æ)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)HØ	˙Ib6ˆÁ6Vñ¬îF˜W4∆W4÷F6á2(	B&˜'B:∆FV÷ÊFV∞†¢6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬FWáBíÁFÜV‚Üˆ≤”‚∞¢&W2Êß6ˆ‚á≤ˆ≤¬÷W76vS¢ˆ≤Ú%&˜'BVÁf˜ú:í7W"FV∆Vw&“F÷ñ‚"¢,8ñ6ÜV2VÁfˆíFV∆Vw&“"“ì∞¢“ì∞ß“ì∞†¢ÚÚ)H)HF÷ñ‚(	B&ñ∆‚6ˆ◊∆WBÊ«ó6W2vvÏ:ñW2˜W&GVW27W"FV∆Vw&“F÷ñ‚)H)H)H)H)H)H)H)H ¶7ñÊ2gVÊ7Fñˆ‚6VÊE7FG4&ñ∆ÂFV∆Vw&“Çí∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí&WGW&‚f«6S∞¢G'í∞¢6ˆÁ7BFá&W6Üˆ∆B“vWDFFófU6ñvÊ≈Fá&W6Üˆ∆BÇì∞¢6ˆÁ7B&r“F"Á&W&RÜ ¢4TƒT5BÜˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬˜WF6ˆ÷R¿¢fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬Ê«ó6VEˆ@¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢ı$DU"%íÊ«ó6VEˆBDU40¢íÊ∆¬Çì∞†¢6ˆÁ7B6VV‚“ÊWr6WBÇì∞¢6ˆÁ7B∆¬“µ”∞¢f˜"Ü6ˆÁ7B"ˆb&rí∞¢6ˆÁ7B∂Wí“G∑"ÊÜˆ÷W’ÚG∑"Êvó’ÚG≤á"ÊÊ«ó6VEˆB«¬""íÁ6∆ñ6RÉ¬ó÷∞¢ñbá6VV‚ÊÜ2Ü∂Wííí6ˆÁFñÁVS∞¢6VV‚ÊFBÜ∂Wíì∞¢∆¬ÁW6Çá"ì∞¢–†¢6ˆÁ7BvñÁ2“∆¬Êfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“'vñ‚"ì∞¢6ˆÁ7B∆˜76W2“∆¬Êfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“&∆˜72"ì∞¢6ˆÁ7BF˜F¬“∆¬Ê∆VÊwFÉ∞¢6ˆÁ7BvñÁ&FR“F˜F¬‚Ú÷FÇÁ&˜VÊBávñÁ2Ê∆VÊwFÇÚF˜F¬¢í¢∞†¢6ˆÁ7BFˆFï7G"“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BFˆFî∆¬“∆¬Êfñ«FW"á"”‚"ÊÊ«ó6VEˆBbb"ÊÊ«ó6VEˆBÁ7F'G5vóFÇáFˆFï7G"íì∞¢6ˆÁ7BFˆFïvñÁ2“FˆFî∆¬Êfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“'vñ‚"íÊ∆VÊwFÉ∞¢6ˆÁ7BFˆFî∆˜76W2“FˆFî∆¬Êfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“&∆˜72"íÊ∆VÊwFÉ∞†¢6ˆÁ7B'î6ˆ◊“∑”∞¢∆¬Êf˜$V6Çá"”‚∞¢6ˆÁ7B2“"Ê6ˆ◊WFóFñˆ‚«¬$ñÊ6ˆÊÁR#∞¢ñbÇ'î6ˆ◊∂5“í'î6ˆ◊∂5““≤s¢¬√¢”∞¢ñbá"Ê˜WF6ˆ÷R””“'vñ‚"í'î6ˆ◊∂5“Ár≤≥≤V«6R'î6ˆ◊∂5“Ê¬≤≥∞¢“ì∞¢6ˆÁ7B6ˆ◊∆ñÊW2“ˆ&¶V7BÊVÁG&ñW2Ü'î6ˆ◊ê¢Á6˜'BÇÜ¬"í”‚Ü%≥“Ár≤%≥“Ê¬í“Ü≥“Ár≤≥“Ê¬íê¢Á6∆ñ6RÉ¬Rê¢Ê÷ÇÖ∂2¬5“í”‚∞¢6ˆÁ7BB“2Ár≤2Ê√∞¢6ˆÁ7Bw"“÷FÇÁ&˜VÊBá2ÁrÚB¢ì∞¢6ˆÁ7Bñ6ˆ‚“w"„“cÚ.)»R"¢w"„“CÚ.)™˚àÚ"¢.)ÿ¬#∞¢&WGW&‚G∂ñ6ˆÁ“G∂7”¢G∑w'“RÇG∑2Áw’rÚG∑2Ê«‘¬ñ∞¢“íÊ¶ˆñ‚Ç%∆‚"ì∞†¢6ˆÁ7B&V6VÁD∆ñÊW2“∆¬Á6∆ñ6RÉ¬#íÊ÷á"”‚∞¢6ˆÁ7Bñ6ˆ‚“"Ê˜WF6ˆ÷R””“'vñ‚"Ú.)»R"¢.)ÿ¬#∞¢6ˆÁ7B66˜&R“"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢#Ú#∞¢&WGW&‚G∂ñ6ˆÁ“G∑"ÊÜˆ÷W“g2G∑"Êvó“ÇG∑66˜&W“í(	BG∑"Ê&W7Eˆ&WG“G∑"Ê6ˆÊfñFVÊ6W“V∞¢“íÊ¶ˆñ‚Ç%∆‚"ì∞†¢6ˆÁ7BFWáB“	˘8¢∆#‰$îƒ‚4Ù’ƒUBDU2‰≈ï4U3¬ˆ#‡†Ø	¯ÍÚ∆#‰v∆ˆ&¬£¬ˆ#‡Æ)»RvvÏ:ó2¢∆#‚G∑vñÁ2Ê∆VÊwFá”¬ˆ#‡Æ)ÿ¬W&GW2¢∆#‚G∂∆˜76W2Ê∆VÊwFá”¬ˆ#‡Ø	˘8ÇvñÁ&FR¢∆#‚G∑vñÁ&FW“S¬ˆ#‚ÇG∑F˜F«“Ê«ó6W2êØ	¯È¢6WVñ¬FFFñb¢G∑Fá&W6Üˆ∆G“P†Ø	˘8R∆#‰V¶˜W&BváVí£¬ˆ#‡Æ)»RG∑FˆFïvñÁ7“vvÏ:íG∑FˆFïvñÁ2‚Ú'2"¢"'“Ú)ÿ¬G∑FˆFî∆˜76W7“W&GRG∑FˆFî∆˜76W2‚Ú'2"¢"'“ÇG∑FˆFî∆¬Ê∆VÊwFá“,:ó6ˆ«W2ê†Ø	¯¯b∆#Â"6ˆ◊:óFóFñˆ‚áF˜WFW2í£¬ˆ#‡¢G∂6ˆ◊∆ñÊW7–†Ø	˘8≤∆#„#FW&Êú:á&W2Ê«ó6W2£¬ˆ#‡¢G∑&V6VÁD∆ñÊW7–†Æ)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)HØ	˙Ib6ˆÁ6Vñ¬îF˜W4∆W4÷F6á2(	B&ñ∆‚V˜FñFñV‚#&Ü∞†¢&WGW&‚vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬FWáBì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂&ñ∆‚◊7FG5“"¬RÊ÷W76vRì∞¢&WGW&‚f«6S∞¢–ß–†¢ÚÚ6ˆ◊&ó6ˆ‚vñÁ&FR&R÷÷F6ÇÑÉ$Ç¬6˜FW2«W2w&˜76W2íg2∆ófRÜWFÚ–¢ÚÚ6ˆÊ6ñ∆R¬6ˆÁFWáFRGR66˜&RV‚Fó&V7Bí(	BFV÷ÊFRFRw&Vr∆R"ÛÇÛ##b‡¶ÊvWBÇ"ˆF÷ñ‚˜6˜W&6R◊GóR◊7FG2"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó6R"“ì∞¢G'í∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5B6˜W&6U˜GóR¿¢4ıTÂBÇ¢í2F˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰Bí2vñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí2∆˜76W0¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢u$ıU%í6˜W&6U˜GóP¢íÊ∆¬Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬7FG3¢&˜w2Ê÷á"”‚á∞¢6˜W&6U˜GóS¢"Á6˜W&6U˜GóR«¬&∆ófR"¿¢F˜F√¢"ÁF˜F¬¬vñÁ3¢"ÁvñÁ2¬∆˜76W3¢"Ê∆˜76W2¿¢vñÁ&FS¢"ÁF˜F¬‚Ú÷FÇÁ&˜VÊBá"ÁvñÁ2Ú"ÁF˜F¬¢í¢¿¢“íí“ì∞¢“6F6ÇÜRí≤&W2Á7FGW2ÉSíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞†¶ÊvWBÇ"ˆF÷ñ‚˜6VÊB÷vñ‚÷ñ÷vW2"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó6R"“ì∞¢6VÊDFñ«îvñ‰ñ÷vW2ÇíÊ6F6ÇÇÜRí”‚6ˆÁ6ˆ∆RÊW'&˜"Ç%∂vñ‚÷ñ÷vU“F÷ñ‚G&ñvvW#¢"¬RÊ÷W76vRíì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷W76vS¢|:ñÏ:ó&Fñˆ‚∆Ê<:ñRÇG¥Dî≈ïÙtîÂÙî‘tUıT$ƒî2Ú&VÁfˆíV&∆ñ2"¢&W,:wRF÷ñ‚'“í(	Bl:ó&ñfñRFV∆Vw&“FÁ2”32Ê“ì∞ß“ì∞†¶ÊvWBÇ"ˆF÷ñ‚˜6VÊB◊7FG2÷&ñ∆‚"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó6R"“ì∞¢6ˆÁ7Bˆ≤“vóB6VÊE7FG4&ñ∆ÂFV∆Vw&“Çì∞¢&W2Êß6ˆ‚á≤ˆ≤¬÷W76vS¢ˆ≤Ú$&ñ∆‚VÁf˜ñR7W"FV∆Vw&“F÷ñ‚"¢$V6ÜV2VÁfˆí"“ì∞ß“ì∞†¢ÚÚ)H)HFñ«í&W7V«G27V÷÷'í(i"e$TRFV∆Vw&“6ÜÊÊV¬É#&Ç&ó2í)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶∆WBˆ∆7Dg&VU&W7V«G4&ñ∆‰FFR“"#∞¶7ñÊ2gVÊ7Fñˆ‚6VÊDFñ«ï&W7V«G4g&VT6ÜÊÊV¬Çí∞¢ñbÇDTƒTu$’Ù4Ñ‰‰T≈ÙîB«¬DTƒTu$’Ù$ıEıDÙ¥T‚í&WGW&‚f«6S∞¢G'í∞¢6ˆÁ7BFˆFï7G"“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢ÚÚFñfgW6ñˆÂˆ&∆ˆ6≤ï2ÂTƒ¬¬26ñvÊ≈˜FñW"ï2‰ıBÂTƒ¬¢6ñvÊ≈˜FñW"W7@¢ÚÚVÊR6∆76ñfñ6Fñˆ‚FR6ˆÊfñÊ6R˜6VRdÂB∆Rfñ«G&RV∆óFRˆ6˜FR¢ÚÚ∆ñwVRˆfV÷ñÊñ‚áfˆó"«&VGï6ñvÊ∆VEFˆFí«W2ÜWB¬6˜'&V7Fñˆ‚GP¢ÚÚ"ÛÇÛ##b7W"∆R÷V÷R÷∆VÁFVÊGR(	B6V«Ví÷∆&∆˜VóB6'&V÷VÁBF˜W@¢ÚÚ6ñvÊ¬&VV¬í‚FñfgW6ñˆÂˆ&∆ˆ6≤W7BV7&óB$U2F˜W2∆W2fñ«G&W2†¢ÚÚÁV∆¬“g&ñ÷VÁBFñfgW6R¬6ñÊˆ‚∆R÷˜FñbWÜ7B‡¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BÜˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬˜WF6ˆ÷R¬&V≈ˆˆFB¿¢fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆvê¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RFFRÜÊ«ó6VEˆBí“Ú‰B˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rí‰BFñfgW6ñˆÂˆ&∆ˆ6≤ï2ÂTƒ¿¢ı$DU"%íÊ«ó6VEˆBDU40¢íÊ∆¬áFˆFï7G"ì∞†¢ÚÚL:ñF˜V&∆ˆÊÊvRFˆÃ:ó&ÁBWÇf&ñÁFW2FRÊˆ“VÁG&R6˜W&6W2¢6Á2«Ví¬∆P¢ÚÚ&ñ∆‚FñfgW<:íffñ6ÜóBFWWÇfˆó2∆R‹:¶÷R÷F6Ç¬&fˆó2fV2FWWÄ¢ÚÚ&ˆÊ˜7Fñ72˜˜<:ó2¬WB6∆7V∆óB∆RvñÁ&FR7W"6W2F˜V&∆ˆÁ2‡¢6ˆÁ7BVÊóVR“FVGWTÊ«ó6W4'î÷F6Çá&˜w2ì∞¢ñbáVÊóVRÊ∆VÊwFÇ¬2í&WGW&‚f«6S∞†¢6ˆÁ7BvñÁ2“VÊóVRÊfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“'vñ‚"ì∞¢6ˆÁ7B∆˜76W2“VÊóVRÊfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“&∆˜72"ì∞¢6ˆÁ7BvñÁ&FR“÷FÇÁ&˜VÊBávñÁ2Ê∆VÊwFÇÚVÊóVRÊ∆VÊwFÇ¢ì∞†¢6ˆÁ7B7˜'Dñ6ˆÁ2“≤fˆ˜F&∆√¢.)´“"¬&6∂WF&∆√¢/	¯¯"¬Üˆ6∂Wì¢/	¯˘""¬&6V&∆√¢.)´‚"”∞¢6ˆÁ7B÷F6Ñ∆ñÊW2“VÊóVRÊ÷á"”‚∞¢6ˆÁ7Bñ6ˆ‚“"Ê˜WF6ˆ÷R””“'vñ‚"Ú.)»R"¢.)ÿ¬#∞¢6ˆÁ7B7˜'Dñ6ˆ‚“7˜'Dñ6ˆÁ5∑"Á7˜'E“«¬/	¯ÍÚ#∞¢6ˆÁ7B66˜&R“"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢#Ú#∞¢6ˆÁ7B6˜FR“&˜tˆFBá"ì∞¢6ˆÁ7BvñÂ7G"“"Ê˜WF6ˆ÷R””“'vñ‚"Ú≤G≤É¢6˜FR“íÁFÙfóÜVBÉóﬁ(*∆¢"”(*¬#∞¢&WGW&‚G∂ñ6ˆÁ“G∑7˜'Dñ6ˆÁ“G∑"ÊÜˆ÷W“g2G∑"Êvó“ÇG∑66˜&W“í(	BG∑"Ê&W7Eˆ&WG“G∂6˜FRÁFÙfóÜVBÉ"ó“(i"G∂vñÂ7G'÷∞¢“íÊ¶ˆñ‚Ç%∆‚"ì∞†¢6ˆÁ7BF˜Fƒvñ‚“VÊóVRÁ&VGV6RÇá7V“¬"í”‚∞¢6ˆÁ7B6˜FR“&˜tˆFBá"ì∞¢&WGW&‚7V“≤á"Ê˜WF6ˆ÷R””“'vñ‚"ÚÉ¢6˜FR“í¢”ì∞¢“¬ì∞†¢6ˆÁ7BV÷ˆ¶í“vñÁ&FR„“sÚ/	˘JR"¢vñÁ&FR„“SÚ/	˘8¢"¢/	˘*¢#∞¢6ˆÁ7B◊6r“∞¢G∂V÷ˆ¶ó“∆#Â,8ï5T≈DE2ER§ıU"(	BG∑FˆFï7G'”¬ˆ#Ê¿¢¿¢)»R∆#‚G∑vñÁ2Ê∆VÊwFá“vvÏ:ó3¬ˆ#‚Ú)ÿ¬G∂∆˜76W2Ê∆VÊwFá“W&GW2(	B∆#‚G∑vñÁ&FW“RvñÁ&FS¬ˆ#Ê¿¢¿¢÷F6Ñ∆ñÊW2¿¢¿¢	˘+∆#‰&ñ∆‚GR¶˜W":(*¬ˆÊ«ó6R¢G∑F˜Fƒvñ‚„“Ú"≤"¢"'“G∑F˜Fƒvñ‚ÁFÙfóÜVBÉóﬁ(*√¬ˆ#Ê¿¢¿¢vñÁ&FR„“c ¢Ú	˘®6W2,:ó7V«FG26ˆÁB,:ó6W'l:ó2WÇ÷V÷'&W2Â∆Ô	˘í∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2#Ó)™&V6Wfˆó"F˜W2∆W26ñvÊWÇL:á2B√ì(*√¬ˆÊ ¢¢	˘*¢∆Fó66ó∆ñÊRfóB∆Fñfl:ó&VÊ6RÂ∆Ô	˘í∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2#Ó)™&V6Wfˆó"F˜W2∆W26ñvÊWÇL:á2B√ì(*√¬ˆÊ¿¢¿¢)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H¿¢	˙Ib6ˆÁ6Vñ¬î(	BF˜W4∆W4÷F6á6¿¢)™˚àÚÇ≤(	B¶WR&W7ˆÁ6&∆V¿¢“Ê¶ˆñ‚Ç%∆‚"ì∞†¢6ˆÁ7Bˆ≤“vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’Ù4Ñ‰‰T≈ÙîB¬◊6rì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂Fñ«í◊&W7V«G2÷g&VU“G∑vñÁ2Ê∆VÊwFá’rÚG∂∆˜76W2Ê∆VÊwFá‘¬G∑vñÁ&FW“R(	BFV∆Vw&“g&VS¢G∂ˆ≤Ú$Ù≤"¢$dî¬'÷ì∞¢&WGW&‚ˆ≥∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Fñ«í◊&W7V«G2÷g&VU“"¬RÊ÷W76vRì∞¢&WGW&‚f«6S∞¢–ß–††¢ÚÚDƒ’ıE$Â5$TÂEı$T4ıc¢ÚÚ&ñ∆‚V˜FñFñV‚¢T‰ïTT‘TÂB∆W26ñvÊWÇ,:ñV∆∆V÷VÁBVÁf˜ú:ó2‡¢ÚÚ∆W2W'FW26ˆÁB6ˆÁ6W'l:ñW2WBffñ6å:ñW2WÜ7FV÷VÁB6ˆ÷÷R∆W2vñÁ2‡¶∆WB˜F∆’G&Á7&VÁE&V6Fí“"#∞†¶gVÊ7Fñˆ‚F∆’&ó5'G2Çí∞¢6ˆÁ7B'G2“ÊWrñÁF¬‰FFUFñ÷Tf˜&÷BÇ&g"‘e""¬∞¢Fñ÷U¶ˆÊS¢$WW&˜Rı&ó2"¿¢ñV#¢&ÁV÷W&ñ2"¿¢÷ˆÁFÉ¢#"÷FñvóB"¿¢Fì¢#"÷FñvóB"¿¢Ü˜W#¢#"÷FñvóB"¿¢÷ñÁWFS¢#"÷FñvóB"¿¢Ü˜W##¢f«6R¿¢“íÊf˜&÷EFı'G2ÜÊWrFFRÇíì∞†¢6ˆÁ7BÛ◊∑”∞¢f˜"Ü6ˆÁ7BÇˆb'G2íı∑ÇÁGóU”◊ÇÁf«VS∞†¢&WGW&‚∞¢Fì¶G∂ÚÁñV'““G∂ÚÊ÷ˆÁFá““G∂ÚÊFó÷¿¢Ü˜W#§ÁV÷&W"ÜÚÊÜ˜W"í¿¢÷ñÁWFS§ÁV÷&W"ÜÚÊ÷ñÁWFRí¿¢”∞ß–†¶gVÊ7Fñˆ‚F∆‘f∆rábí∞¢&WGW&‚b””“«¬b””“G'VS∞ß–†¶gVÊ7Fñˆ‚F∆‘˜WF6ˆ÷Tñ6ˆ‚ábí∞¢&WGW&‚b””“'vñ‚"Ú.)»R"¢.)ÿ¬#∞ß–†¶7ñÊ2gVÊ7Fñˆ‚6VÊEG&Á7&VÁDFñ«ï&V6Çí∞¢6ˆÁ7B&ó3◊F∆’&ó5'G2Çì∞†¢∆WB&˜w3’µ”∞†¢G'í∞¢&˜w3÷F"Á&W&RÜ ¢4TƒT5@¢Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬6˜VÁG'í¬7˜'B¿¢&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬&V≈ˆˆFB¿¢˜WF6ˆ÷R¿¢fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¿¢÷ñÁWFUˆEˆÊ«ó6ó2¿¢66˜&UˆÜˆ÷UˆEˆÊ«ó6ó2¬66˜&UˆvïˆEˆÊ«ó6ó2¿¢6ñu˜6VÁEˆg&VR¬6ñu˜6VÁE˜7FÊF&B¿¢6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFP¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RFFRÜÊ«ó6VEˆBì÷FFRÇvÊ˜rrê¢‰B˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢‰BÄ¢6ñu˜6VÁEˆg&VS”ı ¢6ñu˜6VÁE˜7FÊF&C”ı ¢6ñu˜6VÁE˜&V÷óV””ı ¢6ñu˜6VÁEˆV∆óFS”¢ê¢ı$DU"%íÊ«ó6VEˆB40¢íÊ∆¬Çì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑G&Á7&VÁB◊&V6“∆V7GW&RD#¢"∆RÊ÷W76vRì∞¢&WGW&‚f«6S∞¢–†¢ñbÇ&˜w2Ê∆VÊwFÇí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∑G&Á7&VÁB◊&V6“V7V‚6ñvÊ¬,:ñV∆∆V÷VÁBFñfgW<:íV¶˜W&BváVí"ì∞¢&WGW&‚f«6S∞¢–†¢gVÊ7Fñˆ‚'Vñ∆Df˜"Ü6ÜÊÊV¬í∞¢6ˆÁ7Bf∆tÊ÷S“'6ñu˜6VÁEÚ"∂6ÜÊÊV√∞†¢6ˆÁ7B∆ó7C◊&˜w2Êfñ«FW"á#”ÁF∆‘f∆rá%∂f∆tÊ÷U“íì∞†¢ñbÇ∆ó7BÊ∆VÊwFÇí&WGW&‚ÁV∆√∞†¢6ˆÁ7BvñÁ3÷∆ó7BÊfñ«FW"á#”Á"Ê˜WF6ˆ÷S””“'vñ‚"íÊ∆VÊwFÉ∞¢6ˆÁ7B∆˜76W3÷∆ó7BÊfñ«FW"á#”Á"Ê˜WF6ˆ÷S””“&∆˜72"íÊ∆VÊwFÉ∞¢6ˆÁ7B&FS‘÷FÇÁ&˜VÊBÇávñÁ2ˆ∆ó7BÊ∆VÊwFÇí£íÛ∞†¢6ˆÁ7B∆ñÊW3÷∆ó7BÊ÷á#”Á∞¢6ˆÁ7B66˜&S–¢"ÊfñÊ≈˜66˜&UˆÜˆ÷R÷ÁV∆¬bb"ÊfñÊ≈˜66˜&Uˆví÷ÁV∆¿¢ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷ ¢¢#Ú#∞†¢6ˆÁ7B6˜VÁG'ì◊"Ê6˜VÁG'íÚ	¯{Ø	¯{2G∑"Ê6˜VÁG'ó“+r¢"#∞¢6ˆÁ7B6ˆ◊◊"Ê6ˆ◊WFóFñˆ‚«¬$6Ü◊ñˆÊÊB#∞†¢&WGW&‚∞¢G∑F∆‘˜WF6ˆ÷Tñ6ˆ‚á"Ê˜WF6ˆ÷Ró“∆#‚G∑"ÊÜˆ÷W“(	BG∑"Êvó”¬ˆ#Ê¿¢)´“G∂6˜VÁG'ó“G∂6ˆ◊÷¿¢	¯ÍÚG∑"Ê&W7Eˆ&WG÷¿¢	¯¯66˜&RfñÊ¬¢∆#‚G∑66˜&W”¬ˆ#Ê¿¢“Ê¶ˆñ‚Ç%∆‚"ì∞¢“íÊ¶ˆñ‚Ç%∆Â∆‚"ì∞†¢&WGW&‚∞¢ÚÚDTƒTu$’ÙDî≈ïı$UdîUuÙ$ƒ‰4TEıc¢ÚÚ&V÷ú:á&R∆ñvÊRWÜ7FR÷ó2fˆ∆ˆÁFó&V÷VÁB∆ˆÊwVR¢¬vW,:wRFV∆Vw&–¢ÚÚ÷WB∆,:óW76óFRV‚6ˆÁFWáFR6Á2ffñ6ÜW"∆R&˜VvRfÁB¬v˜WfW'GW&R‡¢	˘8¢∆#‰$îƒ‚ER§ıU"+r)»RvvÏ:ó2¢G∑vñÁ7“+r6ñvÊWÇ,:ñV∆∆V÷VÁBFñfgW<:ó2¢G∂∆ó7BÊ∆VÊwFá“+r,:óW76óFR¢G∑&FW“R+r,:ó7V«FG26ˆ◊∆WG2FÁ2∆R6Ê√¬ˆ#Ê¿¢¿¢)´“6ñvÊWÇ,:ñV∆∆V÷VÁBFñfgW<:ó2¢∆#‚G∂∆ó7BÊ∆VÊwFá”¬ˆ#Ê¿¢)»RvvÏ:ó2¢∆#‚G∑vñÁ7”¬ˆ#Ê¿¢)ÿ¬W&GW2¢∆#‚G∂∆˜76W7”¬ˆ#Ê¿¢	˘8Ç,:óW76óFR¢∆#‚G∑&FW“S¬ˆ#Ê¿¢¿¢)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H¿¢¿¢∆ñÊW2¿¢¿¢)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H¿¢	˙IbF˜W4∆W4÷F6á2+r6ˆÁ6Vñ¬î¿¢	˘H‚,:ó7V«FG26ˆ◊∆WG2¢vvÏ:ó26ˆ÷÷RW&GW2Ê¿¢)™˚àÚÇ≤+r¶WR&W7ˆÁ6&∆V¿¢“Ê¶ˆñ‚Ç%∆‚"ì∞¢–†¢6ˆÁ7B¶ˆ'3’µ”∞†¢6ˆÁ7Bg&VS÷'Vñ∆Df˜"Ç&g&VR"ì∞¢6ˆÁ7B7FÊF&C÷'Vñ∆Df˜"Ç'7FÊF&B"ì∞¢6ˆÁ7B&V÷óV”÷'Vñ∆Df˜"Ç'&V÷óV“"ì∞¢6ˆÁ7BV∆óFS÷'Vñ∆Df˜"Ç&V∆óFR"ì∞†¢ñbÜg&VRbbDTƒTu$’Ù4Ñ‰‰T≈ÙîBê¢¶ˆ'2ÁW6Çá6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’Ù4Ñ‰‰T≈ÙîB∆g&VRíì∞†¢ñbá7FÊF&BbbDTƒTu$’ı5D‰D$EÙ4Ñ‰‰T≈ÙîBê¢¶ˆ'2ÁW6Çá6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ı5D‰D$EÙ4Ñ‰‰T≈ÙîB«7FÊF&Bíì∞†¢ñbá&V÷óV“bbDTƒTu$’ı$T‘ïT’Ù4Ñ‰‰T≈ÙîBê¢¶ˆ'2ÁW6Çá6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ı$T‘ïT’Ù4Ñ‰‰T≈ÙîB«&V÷óV“íì∞†¢ñbÜV∆óFRbbDTƒTu$’ÙTƒïDUÙ4Ñ‰‰T≈ÙîBê¢¶ˆ'2ÁW6Çá6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙTƒïDUÙ4Ñ‰‰T≈ÙîB∆V∆óFRíì∞†¢vóB&ˆ÷ó6RÊ∆¬Ü¶ˆ'2ì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÄ¢∑G&Á7&VÁB◊&V6“G∑vñÁ56fRá&˜w2ó“(	BG∑&˜w2Ê∆VÊwFá“6ñvÊWÇ,:ó6ˆ«W6 ¢ì∞†¢&WGW&‚G'VS∞ß–†¶gVÊ7Fñˆ‚vñÁ56fRá&˜w2í∞¢6ˆÁ7Bs◊&˜w2Êfñ«FW"á#”Á"Ê˜WF6ˆ÷S””“'vñ‚"íÊ∆VÊwFÉ∞¢6ˆÁ7B√◊&˜w2Êfñ«FW"á#”Á"Ê˜WF6ˆ÷S””“&∆˜72"íÊ∆VÊwFÉ∞¢&WGW&‚G∑w’rÚG∂«‘∆∞ß–†¢ÚÚl:ó&ñfñ6Fñˆ‚6ÜVR÷ñÁWFR‡¢ÚÚWå:ñ7WFñˆ‚T‰R6WV∆Rfˆó2"¶˜W&Ï:ñR:'Fó"FR#6ÉCRÜWW&RFR&ó2‡ß6WDñÁFW'f¬ÇÇì”Á∞¢G'í∞¢6ˆÁ7B◊F∆’&ó5'G2Çì∞†¢ñbÄ¢ÊÜ˜W#”””#2b`¢Ê÷ñÁWFS„”CRb`¢˜F∆’G&Á7&VÁE&V6Fí”◊ÊFê¢ó∞¢˜F∆’G&Á7&VÁE&V6Fì◊ÊFì∞†¢6VÊEG&Á7&VÁDFñ«ï&V6Çê¢ÁFÜV‚Üˆ≥”Ê6ˆÁ6ˆ∆RÊ∆ˆrÄ¢∑G&Á7&VÁB◊&V6“#6ÉCR&ó3¢G∂ˆ≤Ú$Ù≤"¢%4¥ï'÷ ¢íê¢Ê6F6ÇÜS”Ê6ˆÁ6ˆ∆RÊW'&˜"Ç%∑G&Á7&VÁB◊&V6“"∆RÊ÷W76vRíì∞¢–¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑G&Á7&VÁB◊&V6◊66ÜVGV∆W%“"∆RÊ÷W76vRì∞¢–ß“√cì∞††¢ÚÚ)H)HÊ«ó6ó2Üó7F˜'íáV&∆ñ2¬7B6ˆÊ6ñ∆RÊ«ó6W2í)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ6ˆ∆ˆÊÊRFRFñfgW6ñˆ‚6˜'&W7ˆÊFÁBR∆ñW"BwV‚÷V÷'&R‚ˆ‚fñ«G&R7W"6RVê¢ÚÚ,8îTƒƒT‘TÂB:óL:íVÁf˜ú:í7W"6ˆ‚6Ê¬á6ñu˜6VÁEÚ¢í¬27W"FW27&óL:á&W0¢ÚÚB|:ñ∆ñvñ&ñ∆óL:íFå:ñ˜&óVW2¢V‚&ˆÊÏ:í7FÊF&BFˆóBfˆó"∆W2,:ó7V«FG2FW0¢ÚÚ6ñvÊWÇRvñ¬VffV7FófV÷VÁB&\:wW2¬Êí«W2á2∆W26ñvÊWÇV∆óFRRvñ¬‚v¢ÚÚ2WW2íÊí÷ˆñÁ2‡¶6ˆÁ7B4îuÙ4Ù≈T‘ÂÙ%ïıƒ‚“∞¢g&VS¢'6ñu˜6VÁEˆg&VR"¿¢6'FS¢'6ñu˜6VÁEˆg&VR"¿¢7FÊF&C¢'6ñu˜6VÁE˜7FÊF&B"¿¢&V÷óV”¢'6ñu˜6VÁE˜&V÷óV“"¿¢fó¢'6ñu˜6VÁE˜&V÷óV“"¿¢V∆óFS¢'6ñu˜6VÁEˆV∆óFR"¿ß”∞†¶ÊvWBÇ"ˆÊ«ó6ó2÷Üó7F˜'í"¬á&W¬&W2í”‚∞¢6ˆÁ7B∆ñ÷óB“÷FÇÊ÷ñ‚á'6TñÁBá&WÁVW'íÊ∆ñ÷óBí«¬S¬ì∞¢6ˆÁ7Bˆfg6WB“'6TñÁBá&WÁVW'íÊˆfg6WBí«¬∞¢G'í∞¢ÚÚ)H)H:ó&ñ‹:áG&RGR∆V7FWW")H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ6Á2ñFVÁFñfñÁG2¢gVRV&∆óVRñÊ6ÜÊ|:ñRávR˜W&f˜&÷Ê6W2¬&WWfP¢ÚÚ÷&∂WFñÊr(	B∆&W7G&VñÊG&R6˜WW&óB¬v&wV÷VÁBFRfVÁFRí‡¢ÚÚfV2ñFVÁFñfñÁG2¢ˆ‚ÊR÷ˆÁG&RVR∆R∆ñW",:ñV∆∆V÷VÁB6˜W67&óB‡¢6ˆÁ7BV÷ñ¬“&WÁVW'íÊV÷ñ¬¬6ˆFR“&WÁVW'íÊ6ˆFS∞¢∆WBfñWvW%∆‚“ÁV∆¬¬ó5ñEfñWvW"“f«6R¬fñWvW$ó4F÷ñ‚“f«6S∞¢ñbáV÷ñ¬bb6ˆFRí∞¢G'í∞¢6ˆÁ7B“fW&ñgî6ˆFRáV÷ñ¬¬6ˆFRì∞¢fñWvW$ó4F÷ñ‚“ó4F÷ñ‰66W72áV÷ñ¬¬6ˆFRì∞¢ñbÜÁf∆ñBbbÁ∆‚ífñWvW%∆‚“7G&ñÊrÜÁ∆‚íÁFÙ∆˜vW$66RÇì∞¢V«6RñbáfñWvW$ó4F÷ñ‚ífñWvW%∆‚“&V∆óFR#∞¢ó5ñEfñWvW"“ÜÁf∆ñBbbÁ∆‚bbÁ∆‚”“&g&VR"í«¬fñWvW$ó4F÷ñ„∞¢“6F6ÇÖÚí∑–¢–¢ÚÚ¬vF÷ñ‚v&FR∆gVR6ˆ◊Ã:áFRá7WW'fó6ñˆ‚í¬6ñÊˆ‚ˆ‚fñ«G&R7W"∆R∆ñW"(	@¢ÚÚfñFñW$V∆ñvñ&∆RÜ7&óL:á&W2V∆óL:íGR∆ñW"í¬2fñ∆W2VÁfˆó2FV∆Vw&–¢ÚÚ,:ñV«2á6ñu˜6VÁEÚ¢í¢6WWÇ÷6í6ˆÁB∆fˆÊÏ:ó2ˆ¶˜W"WB6˜W2◊&W,:ó6VÁFñVÁ@¢ÚÚ∆&vV÷VÁB6RVR∆R∆ñW"g&ñ÷VÁB‹:ó&óL:íá6ñvÊÃ:í"w&Vr∆P¢ÚÚ2ÛÇÛ##b(	B∆vRffñ6ÜóB"”2∆ñvÊW2"∆ñW"∆˜'2VR∆R6ˆÊ6ñ∆P¢ÚÚF˜W&ÊRFWVó2FW26V÷ñÊW2í‚FñW$V∆ñvñ&∆RW7BL:ñ¨:∆6˜W&6RGR&∆ˆ0¢ÚÚ7FG2ÁFñW'2«W2&2¢ˆ‚∆ñvÊR∆∆ó7FRL:óFñ∆Ã:ñRFW77W2˜W"6ˆå:ó&VÊ6R‡¢6ˆÁ7BFñW$fñ«FW"“áfñWvW%∆‚bbfñWvW$ó4F÷ñ‚íÚfñWvW%∆‚¢ÁV∆√∞¢ÚÚˆ‚6Ü&vR∆W26Ê6Ü˜G2fÁBFRFVF˜V&∆ˆÊÊW"¢ñ¬fWBBv&˜&BñFVÁFñfñW ¢ÚÚ¬vñÁ7FÁBWÜ7B&VV∆∆V÷VÁBFñfgW6R‚FVF˜V&∆ˆÊÊW"V‚5¬fÁB6R6ˆÁG&ˆ∆P¢ÚÚ6V∆V7FñˆÊÊóB&fˆó2V‚6Ê6Ü˜Bˆ'6W'fRˆÊˆ‚VÁf˜ñRGR÷V÷R÷F6Ç‡¢6ˆÁ7B&u&˜w2“F"Á&W&RÜ ¢4TƒT5BñB¬÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬6˜VÁG'í¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬&ó6ˆ‚¿¢6ˆÁ6VÁ7W5˜f˜FW2¬˜WF6ˆ÷R¬Ê«ó6VEˆB¬&V≈ˆˆFB¬&V≈ˆˆFE˜6˜W&6R¿¢66˜&UˆÜˆ÷UˆEˆÊ«ó6ó2¬66˜&UˆvïˆEˆÊ«ó6ó2¬÷ñÁWFUˆEˆÊ«ó6ó2¿¢fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬&W6ˆ«fVEˆB¿¢Üˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆvÚ¬&WEˆ6FVv˜'í¿¢6ñu˜6VÁE˜7FÊF&B¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFR¬6ñu˜6VÁEˆg&VR¿¢FñfgW6ñˆÂˆ&∆ˆ6≤¿¢vVÁG5ˆß6ˆ‡¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RFFRÜÊ«ó6VEˆBí„“s##b”r”2p¢‰B6ˆÊfñFVÊ6R„“G∂vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇó–¢‰BÜ˜WF6ˆ÷Rï2ÂTƒ¬ı"˜WF6ˆ÷R“wVÊFñÊrrê¢ı$DU"%íÊ«ó6VEˆBDU40¢íÊ∆¬Çì∞¢ÚÚ6˜FR6∆ñVÁB¢VÊRÊ«ó6R‚vVÁG&RFÁ2¬vÜó7F˜&óVRVR6íV∆∆RWFP¢ÚÚVÁf˜ñVR7W"R÷ˆñÁ2V‚6Ê¬ñÁBUB&W7V7FR∆R6ˆÁG&BÚıR"√RBÛR‡¢ÚÚ6WGFR&˜WFR∆ñ÷VÁFR∆vR&W7V«FG2¬í6ˆ◊&ó2VÊB∆RfˆÊFFWW"W7@¢ÚÚ6ˆÊÊV7FR¢V∆∆RFˆóBFˆÊ2&W7FW"ñFVÁFóVR˜W"F˜W2∆W2∆V7FWW'2‚∆gVP¢ÚÚWÜÜW7FófRFRFñvÊ˜7Fñ2&W7FRFó7ˆÊñ&∆RfñˆF÷ñ‚ˆFñ«í÷VFóB‡¢6ˆÁ7B6∆ñVÁE&˜w2“&u&˜w2Êfñ«FW"Üó5fW&ñfñVD6∆ñVÁD˜S#U&˜rì∞¢6ˆÁ7B∆‰6ÜÊÊV¬“FñW$fñ«FW"””“'fó"Ú'&V÷óV“"¢FñW$fñ«FW"””“&6'FR"Ú&g&VR"¢FñW$fñ«FW#∞¢6ˆÁ7B∆Â&˜w2“∆‰6ÜÊÊV¿¢Ú6∆ñVÁE&˜w2Êfñ«FW"á"”‚Fó7∆îFV∆ófW'î6ÜÊÊV«2á"íÊÜ2á∆‰6ÜÊÊV¬íê¢¢6∆ñVÁE&˜w3∞¢6ˆÁ7B6∆VÊVE&˜w2“FVGWTÊ«ó6W4'î÷F6Çá∆Â&˜w2Êfñ«FW"á"”‚ó4Êˆó6Tf˜$Fó7∆íá"ííì∞¢6ˆÁ7BF˜F¬“6∆VÊVE&˜w2Ê∆VÊwFÉ∞¢6ˆÁ7B&˜w2“6∆VÊVE&˜w2Á6∆ñ6RÜˆfg6WB¬ˆfg6WB≤∆ñ÷óBì∞†¢ÚÚó5ñEfñWvW"á,:ó6ˆ«R«W2ÜWBí¢6WV«2∆W2&ˆÊÏ:ó2(	B˜R¬vF÷ñ‚(	BfˆñVÁB∆P¢ÚÚñ6≤FW2Ê«ó6W2T‚4ıU%2‚∆W2fó6óFWW'2fˆñVÁB∆W2,:ó7V«FG27<:ó0¢ÚÚá&WWfRí÷ó22∆W2ñ6∑2Êˆ‚,:ó6ˆ«W2¬6ñÊˆ‚∆,:óˆÁ6R6W&óBw&GVóFR‡†¢ÚÚˆ‚÷ˆÁG&RF˜W2∆W2¶˜W'2WBF˜W2∆W2,:ó7V«FG2¬4Tb∆6˜V6ÜRñÊL:ó6ó&&∆R†¢ÚÚ¶WVÊW2ÖSr’S#2í¬÷FWW"˜,:ó6W'fW2¬l:ñ÷ñÊñÊW2WB∆ñwVW2F˜WFWW6W2ˆWÜ˜FóVW2‡¢ÚÚˆ‚t$DRTTdÜ‹:¶÷RV∆ñbí≤w&ÊFW2∆ñwVW2‚2FR÷7VvR"≥fÇ"ñ6í¿¢ÚÚFˆÊ2V7V‚¶˜W"ÊRFó7&:ÁB(	Bˆ‚&WFó&RßW7FR∆W2÷F6á2F˜WFWWÇ‡¢ÚÚ&WG&óBFR∆6˜V6ÜRñÊL:ó6ó&&∆RÜ¶WVÊW2ˆl:ñ÷ñÊñÊW2ˆF˜WFWW6W2í≤∆W0¢ÚÚF˜V&∆ˆÁ26ˆÁBL:ñ¨::ñ∆ñ÷ñÏ:ó2V‚5¬6í÷FW77W2‡¢ÚÚ∆R%DïDîÙ‚%í5¬ÊRFVF˜V&∆ˆÊÊRVR7W"FW2Êˆ◊27G&ñ7FV÷VÁBVvWÇ†¢ÚÚˆ‚&W76RfV2∆6ˆ◊&ó6ˆ‚Fˆ∆W&ÁFRWÇf&ñÁFW2FR6˜W&6R‡¢6ˆÁ7Bfó6ñ&∆U&˜w2“&˜w3∞†¢ÚÚ∆ñW"∆R«W2&2Ví&\:vˆóB6WGFRÊ«ó6RÜ6b‚FñW$V∆ñvñ&∆R¢÷ó&ˆó"WÜ7@¢ÚÚFW2,:Üv∆W2FRFñfgW6ñˆ‚FV∆Vw&“í‚&Ü˜'2◊∆ñW""“V&∆ú:ñR7W"∆R6óFR÷ó0¢ÚÚFñfgW<:ñR7W"V7V‚6Ê¬ñÁBÜ6˜FRÊˆ‚,:ñV∆∆R¬Ü˜'2$§T¬¬7˜'BÊˆ‚6˜WfW'Bí‡¢6ˆÁ7BFñW$∆&V¬“á"í”‚∞¢ñbáFñW$V∆ñvñ&∆Rá"¬'7FÊF&B"íí&WGW&‚'7FÊF&B#∞¢ñbáFñW$V∆ñvñ&∆Rá"¬'&V÷óV“"íí&WGW&‚'&V÷óV“#∞¢ñbáFñW$V∆ñvñ&∆Rá"¬&V∆óFR"íí&WGW&‚&V∆óFR#∞¢&WGW&‚&Ü˜'2◊∆ñW"#∞¢”∞†¢6ˆÁ7BÊ«ó6W2“fó6ñ&∆U&˜w2Ê÷á"”‚∞¢∆WBvVÁG2“µ”∞¢G'í≤vVÁG2“•4Ù‚Á'6Rá"ÊvVÁG5ˆß6ˆ‚«¬%µ“"ì≤“6F6Ç∑–¢6ˆÁ7B˜S#U&ˆˆb“7F˜&VD˜S#T6ˆÁ6VÁ7W2á"ì∞¢6ˆÁ7BFV∆ófW'ï&ˆˆb“7F˜&VEFV∆Vw&‘FV∆ófW'íá"ì∞¢6ˆÁ7BFó7∆î6ÜÊÊV«2“Fó7∆îFV∆ófW'î6ÜÊÊV«2á"ì∞¢6ˆÁ7BÊ«ó6ó4Fí“7G&ñÊrá"ÊÊ«ó6VEˆB«¬""íÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BÜó7F˜'î÷ˆFR“Ê«ó6ó4Fí„“4ƒîTÂEıDTƒTu$’ı$ÙÙeı4î‰4RÚ'FV∆Vw&’˜&˜fV‚"¢&∆Vv7í#∞¢6ˆÁ7B&W6ˆ«fVB“"Ê˜WF6ˆ÷R””“'vñ‚"«¬"Ê˜WF6ˆ÷R””“&∆˜72#∞¢6ˆÁ7B&WfV¬“&W6ˆ«fVB«¬ó5ñEfñWvW#≤ÚÚñ6≤fó6ñ&∆R6íFW&÷ñÏ:íıR&ˆÊÏ:ê¢&WGW&‚∞¢ñC¢"ÊñB¿¢Üˆ÷S¢"ÊÜˆ÷R¬vì¢"Êví¿¢6ˆ◊WFóFñˆ„¢"Ê6ˆ◊WFóFñˆ‚¬7˜'C¢"Á7˜'B«¬$fˆ˜F&∆¬"¿¢&WC¢&WfV¬Ú"Ê&W7Eˆ&WB¢ÁV∆¬¬6ˆÊfñFVÊ6S¢"Ê6ˆÊfñFVÊ6R¿¢6˜FS¢&WfV¬Ú&˜tˆFBá"í¢ÁV∆¬¿¢&V6ˆÊñÊs¢&WfV¬Ú"Á&ó6ˆ‚¢ÁV∆¬¿¢6ˆÁ6VÁ7W3¢Üó7F˜'î÷ˆFR””“&∆Vv7í"ÚÁV÷&W"á"Ê6ˆÁ6VÁ7W5˜f˜FW2«¬í¢˜S#U&ˆˆbÁf˜FT6˜VÁB¿¢∆ˆ6∂VC¢&WfV¬¿¢˜WF6ˆ÷S¢"Ê˜WF6ˆ÷R¿¢Ê«ó6VEˆC¢"ÊÊ«ó6VEˆB¿¢66˜&S¢"Á66˜&UˆÜˆ÷UˆEˆÊ«ó6ó2“ÁV∆¬ÚG∑"Á66˜&UˆÜˆ÷UˆEˆÊ«ó6ó7““G∑"Á66˜&UˆvïˆEˆÊ«ó6ó7÷¢ÁV∆¬¿¢÷ñÁWFS¢"Ê÷ñÁWFUˆEˆÊ«ó6ó2¿¢fñÊ≈˜66˜&S¢"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢ÁV∆¬¿¢&W6ˆ«fVEˆC¢"Á&W6ˆ«fVEˆB¿¢Üˆ÷Uˆ∆ˆvÛ¢"ÊÜˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆvÛ¢"Êvïˆ∆ˆvÚ¿¢&WEˆ6FVv˜'ì¢"Ê&WEˆ6FVv˜'í¿¢&¶V√¢&˜tó4&¶V¬á"í¿¢FñW#¢FñW$∆&V¬á"í¿¢ÚÚFñfgW6ñˆ‚$TTƒƒR7W"FV∆Vw&“¬ÊR26ˆÊfˆÊG&RfV2FñW&†¢ÚÚFñW"FóBVV¬∆ñW"¬vÊ«ó6R4ı%$U5Ù‰DïBÜ7&óFW&W2FRV∆óFRí¿¢ÚÚ6W26Ü◊2Fó6VÁB7W"VV«26ÊWÇV∆∆RW7B$TTƒƒT‘TÂB'FñR‚VÊP¢ÚÚÊ«ó6RWWB6Fó6fó&R∆W27&óFW&W2V∆óFR6Á2fˆó"WFRVÁf˜ñVP¢ÚÚá∆fˆÊB¶˜W&Ê∆ñW"GFVñÁB¬6˜FRÜ˜'2fVÊWG&R$§T¬R÷ˆ÷VÁBFP¢ÚÚ¬vVÁfˆí‚‚‚í‚ffñ6ÜW"FñW&V‚&WFVÊFÁB÷ˆÁG&W"∆FñfgW6ñˆ‡¢ÚÚñÊGVó6óB∆Rfó6óFWW"V‚W'&WW"(	B6ñvÊ∆R"w&Vr∆RRÛÇÛ##b‡¢6VÁC¢∞¢7FÊF&C¢Fó7∆î6ÜÊÊV«2ÊÜ2Ç'7FÊF&B"í¿¢&V÷óV”¢Fó7∆î6ÜÊÊV«2ÊÜ2Ç'&V÷óV“"í¿¢V∆óFS¢Fó7∆î6ÜÊÊV«2ÊÜ2Ç&V∆óFR"í¿¢g&VS¢Fó7∆î6ÜÊÊV«2ÊÜ2Ç&g&VR"í¿¢“¿¢FV∆ófW'ï˜&˜fV„¢FV∆ófW'ï&ˆˆbÁñB¿¢Üó7F˜'ïˆ÷ˆFS¢Üó7F˜'î÷ˆFR¿¢ÚÚ÷˜Fñb∆ó6ñ&∆RGRÊˆ‚÷VÁfˆíÜÁV∆¬6í∆R6ñvÊ¬W7B&ñV‚'Fíí‡¢FñfgW6ñˆÂˆ&∆ˆ6≥¢"ÊFñfgW6ñˆÂˆ&∆ˆ6≤«¬ÁV∆¬¿¢vVÁG5ˆ6˜VÁC¢vVÁG2Ê∆VÊwFÇ¿¢”∞¢“ì∞†¢ÚÚ7FG2v∆ˆ&∆W2L:ñF˜V&∆ˆÊÏ:ñW2Ü‹:¶÷R∆ˆvóVRVR˜&V÷óV“◊FV6W"í(	@¢ÚÚ6˜W&6RVÊóVR˜W"VR∆vR∆ófRîWB∆vRBv67VVñ¬ffñ6ÜVÁ@¢ÚÚWÜ7FV÷VÁB∆R‹:¶÷RvñÁ&FRÚÊˆ÷'&RFRñ6∑2‡¢ÚÚ6ñu˜6VÁEÚ¢¶˜WFW2∆RÇÛÇÛ##b¢6Á2WWÇ¬∆R&VÊVfñ6RV‚WW&˜2WB∆P¢ÚÚ$Ùíffñ6ÜW27W"¬v67VVñ¬WB7W"˜W&f˜&÷Ê6W2WFñVÁB6∆7V∆W27W ¢ÚÚDıUDU2∆W2Ê«ó6W2V&∆ñVW2¬FñfgW6VW2˜RÊˆ‚‚V‚fó6óFWW"∆ó6óBFˆÊ0¢ÚÚ6ˆ÷÷Rvñ‚Bv&ˆÊÊRV‚&W7V«FBVRW'6ˆÊÊR‚vfóB&V7R‡¢6ˆÁ7B∆≈&W6ˆ«fVB“F"Á&W&RÜ ¢4TƒT5B÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬6˜VÁG'í¬7˜'B¬˜WF6ˆ÷R¬Ê«ó6VEˆB¬6ˆÊfñFVÊ6R¿¢&W7Eˆ&WB¬&V≈ˆˆFB¬&V≈ˆˆFE˜6˜W&6R¬fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¿¢÷ñÁWFUˆEˆÊ«ó6ó2¬6ˆÁ6VÁ7W5˜f˜FW2¿¢6ñu˜6VÁEˆg&VR¬6ñu˜6VÁE˜7FÊF&B¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFR¬FñfgW6ñˆÂˆ&∆ˆ6∞¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rí‰B6ˆÊfñFVÊ6R„“G∂vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇó–¢‰BFFRÜÊ«ó6VEˆBí„“s##b”r”2p¢ı$DU"%íÊ«ó6VEˆBDU40¢íÊ∆¬Çì∞¢6ˆÁ7B6VVÂ7FB“ÊWr6WBÇì∞¢6ˆÁ7BFVGW&W6ˆ«fVB“µ”∞¢f˜"Ü6ˆÁ7B"ˆb∆≈&W6ˆ«fVBí∞¢ÚÚ‹:¶÷W2WÜ6«W6ñˆÁ2VR∆∆ó7FRÜ¶WVÊW2ÚF˜WFWW6W2í˜W"V‚vñÁ&FR6ˆå:ó&VÁB‡¢ñbÜó4Êˆó6Tf˜$Fó7∆íá"í«¬ó5fW&ñfñVD6∆ñVÁD˜S#U&˜rá"íí6ˆÁFñÁVS∞¢6ˆÁ7B≤“G∑"ÊÜˆ÷W’ÚG∑"Êvó’ÚG≤á"ÊÊ«ó6VEˆB«¬""íÁ6∆ñ6RÉ¬ó÷∞¢ñbá6VVÂ7FBÊÜ2Ü≤íí6ˆÁFñÁVS∞¢6VVÂ7FBÊFBÜ≤ì∞¢FVGW&W6ˆ«fVBÁW6Çá"ì∞¢–†¢ÚÚ&∆ˆ2FR7FG27W"V‚6˜W2÷VÁ6V÷&∆R¢F˜F¬˜vñÁ2ˆ∆˜76W2˜vñÁ&FR≤$Ùí6ñ◊VÃ:ê¢ÚÚÜ÷ó6R(*¬í¬,:ñÏ:ñfñ6R¬6˜FR÷˜ñVÊÊR‚6ˆå:ó&VÁBfV2˜&V÷óV“◊FV6W"á&˜tˆFBí‡¢6ˆÁ7B7FD&∆ˆ6≤“á6WBí”‚∞¢∆WBvñÁ2“¬&ˆfóB“¬ˆFE7V““∞¢f˜"Ü6ˆÁ7B"ˆb6WBí∞¢6ˆÁ7B6˜FR“&˜tˆFBá"ì∞¢ˆFE7V“≥“6˜FS∞¢ñbá"Ê˜WF6ˆ÷R””“'vñ‚"í≤vñÁ2≤≥≤&ˆfóB≥“¢6˜FR“≤“V«6R≤&ˆfóB”“≤–¢–¢6ˆÁ7BB“6WBÊ∆VÊwFÉ∞¢&WGW&‚∞¢F˜F√¢B¬vñÁ2¬∆˜76W3¢B“vñÁ2¿¢vñÁ&FS¢BÚ÷FÇÁ&˜VÊBávñÁ2ÚB¢í¢¿¢&ˆfóC¢÷FÇÁ&˜VÊBá&ˆfóBí¿¢&ˆï˜7C¢BÚ÷FÇÁ&˜VÊBá&ˆfóBÚáB¢í¢íÚ¢¿¢fuˆˆFG3¢BÚ÷FÇÁ&˜VÊBÜˆFE7V“ÚB¢íÚ¢¿¢”∞¢”∞†¢ÚÚ)H)H6W&Fñˆ‚WÜñvVR"∆RfˆÊFFWW"∆RÇÛÇÛ##b)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚDîdeU4TU2¢R÷ˆñÁ2V‚6ñu˜6VÁEÚ¢¬FˆÊ2V‚&ˆÊÊRÜ˜R∆R6Ê¿¢ÚÚw&GVóBí&VV∆∆V÷VÁB&V7R6R6ñvÊ¬‚6WV∆W26V∆∆W2÷6íWWfVÁB˜'FW ¢ÚÚV‚÷ˆÁFÁBV‚WW&˜2‡¢ÚÚÙ%4U%dTU2¢6ˆÁ6W'fR˜W"6ˆ◊Fñ&ñ∆óFRí¬÷ó2∆W2Ê«ó6W2Êˆ‡¢ÚÚFñfgW6VW2ÊRfˆÁB«W2'FñRFR∆gVR6∆ñVÁBWB&W7FVÁBFˆÊ2¶W&Ú‡¢6ˆÁ7BW7DFñfgW6VR“á"í”‚≤'7FÊF&B"¬'&V÷óV“"¬&V∆óFR"¬&g&VR%“Á6ˆ÷RÜ6ÜÊÊV¬”‚Fó7∆îFV∆ófW'î6ÜÊÊV«2á"íÊÜ2Ü6ÜÊÊV¬íì∞¢6ˆÁ7B∆ñvÊW4FñfgW6VW2“FVGW&W6ˆ«fVBÊfñ«FW"ÜW7DFñfgW6VRì∞¢6ˆÁ7B∆ñvÊW4ˆ'6W'fVW2“FVGW&W6ˆ«fVBÊfñ«FW"á"”‚W7DFñfgW6VRá"íì∞†¢ÚÚ&∆ˆ26Á2&vVÁB¢&ˆfóC¬&ˆï˜7BWBfuˆˆFG26ˆÁBfˆ∆ˆÁFó&V÷VÁ@¢ÚÚ%4TÂE2ÜWBÊˆ‚2¶W&Úí¬˜W"RwV‚g&ˆÁBVí∆W2∆ó&óB"W'&WW ¢ÚÚffñ6ÜR.(	B"R∆ñWRBwV‚#(*¬"&W76V÷&∆ÁBV‚&W7V«FB‡¢6ˆÁ7B7FD&∆ˆ6¥ˆ'6W'fR“á6WBí”‚∞¢6ˆÁ7BvñÁ2“6WBÊfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“'vñ‚"íÊ∆VÊwFÉ∞¢6ˆÁ7BB“6WBÊ∆VÊwFÉ∞¢&WGW&‚≤F˜F√¢B¬vñÁ2¬∆˜76W3¢B“vñÁ2¬vñÁ&FS¢BÚ÷FÇÁ&˜VÊBávñÁ2ÚB¢í¢”∞¢”∞†¢6ˆÁ7B&ˆÊÊW2“7FD&∆ˆ6≤Ü∆ñvÊW4FñfgW6VW2ì∞¢6ˆÁ7Bˆ'6W'fVW2“7FD&∆ˆ6¥ˆ'6W'fRÜ∆ñvÊW4ˆ'6W'fVW2ì∞¢ÚÚv∆ˆ&∆76R"7FD&∆ˆ6¥ˆ'6W'fR¢ñÁ6í7FD&∆ˆ6≤¬6WV¬VÊG&ˆóBGP¢ÚÚfñ6ÜñW"Ví&ˆGVóB&ˆfóCWB&ˆï˜7B¬‚vW7B«W2¶÷ó2V∆R7W"V‡¢ÚÚVÁ6V÷&∆R6ˆÁFVÊÁBVÊR∆ñvÊRÊˆ‚FñfgW6VR‚v&ÁFñR7G'V7GW&V∆∆R‡¢6ˆÁ7Bv∆ˆ&¬“7FD&∆ˆ6¥ˆ'6W'fRÜFVGW&W6ˆ«fVBì∞¢6ˆÁ7BFñW'2“∞¢ÚÚV‚∆ñW"ÊRWWB«W26R&Wf∆ˆó"BwV‚&W7V«FBVR6W2&ˆÊÊW2‚vˆÁ@¢ÚÚ¶÷ó2&V7R¢ˆ‚fñ«G&R7W"¬vVÁfˆí&VV¬¬27W"¬vV∆ñvñ&ñ∆óFR‡¢7FÊF&C¢7FD&∆ˆ6≤Ü∆ñvÊW4FñfgW6VW2Êfñ«FW"á"”‚Fó7∆îFV∆ófW'î6ÜÊÊV«2á"íÊÜ2Ç'7FÊF&B"ííí¿¢&V÷óV”¢7FD&∆ˆ6≤Ü∆ñvÊW4FñfgW6VW2Êfñ«FW"á"”‚Fó7∆îFV∆ófW'î6ÜÊÊV«2á"íÊÜ2Ç'&V÷óV“"ííí¿¢V∆óFS¢7FD&∆ˆ6≤Ü∆ñvÊW4FñfgW6VW2Êfñ«FW"á"”‚Fó7∆îFV∆ófW'î6ÜÊÊV«2á"íÊÜ2Ç&V∆óFR"ííí¿¢w&GVóC¢7FD&∆ˆ6≤Ü∆ñvÊW4FñfgW6VW2Êfñ«FW"á"”‚Fó7∆îFV∆ófW'î6ÜÊÊV«2á"íÊÜ2Ç&g&VR"ííí¿¢”∞†¢ÚÚÊ«ó6W2V&∆ú:ñW2Êˆ‚VÊ6˜&R,:ó6ˆ«VW2ÜL:ñF˜V&∆ˆÊÏ:ñW2¬Ü˜'2''VóBí“&V‚GFVÁFR"‡¢6ˆÁ7BVÊFñÊu&˜w2“F"Á&W&RÜ ¢4TƒT5B÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬6˜VÁG'í¬7˜'B¬Ê«ó6VEˆB¬&W7Eˆ&WB¿¢÷ñÁWFUˆEˆÊ«ó6ó2¬6ˆÁ6VÁ7W5˜f˜FW2¬&V≈ˆˆFB¬&V≈ˆˆFE˜6˜W&6R¿¢6ñu˜6VÁE˜7FÊF&B¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFR¬6ñu˜6VÁEˆg&VR¬FñfgW6ñˆÂˆ&∆ˆ6∞¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RÜ˜WF6ˆ÷Rï2ÂTƒ¬ı"˜WF6ˆ÷R‰ıBî‚Çwvñ‚r¬v∆˜72ríê¢‰B6ˆÊfñFVÊ6R„“G∂vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇó–¢‰BFFRÜÊ«ó6VEˆBí„“s##b”r”2p¢ı$DU"%íÊ«ó6VEˆBDU40¢íÊ∆¬Çì∞¢6ˆÁ7B6VVÂ“ÊWr6WBÇì∞¢∆WBVÊFñÊr“∞¢f˜"Ü6ˆÁ7B"ˆbVÊFñÊu&˜w2í∞¢ñbÜó4Êˆó6Tf˜$Fó7∆íá"í«¬ó5fW&ñfñVD6∆ñVÁD˜S#U&˜rá"íí6ˆÁFñÁVS∞¢6ˆÁ7B≤“G∑"ÊÜˆ÷W’ÚG∑"Êvó’ÚG≤á"ÊÊ«ó6VEˆB«¬""íÁ6∆ñ6RÉ¬ó÷∞¢ñbá6VVÂÊÜ2Ü≤íí6ˆÁFñÁVS∞¢6VVÂÊFBÜ≤ì∞¢VÊFñÊr≤≥∞¢–†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¬Ê«ó6W2¬F˜F¬¿¢ÚÚ7FG6˜'FRFW6˜&÷ó2∆W26Üñfg&W2$Ù‰‰U2¢6R6ˆÁBWWÇVR∆ó6VÁ@¢ÚÚ∆W26ˆ◊FWW'2WÜó7FÁG2Ü67VVñ¬¬˜W&f˜&÷Ê6W2í¬FˆÊ2∆W2WW&˜0¢ÚÚffñ6ÜW2FWfñVÊÊVÁB6WWÇFW26ñvÊWÇ&VV∆∆V÷VÁBVÁf˜ñW2¬6Á2RvV7V‡¢ÚÚfñ6ÜñW"FRV&∆ñ2ÚóBWG&R÷ˆFñfñR‚ˆ'6W'fVW6WBv∆ˆ&∆&W7FVÁ@¢ÚÚFó7ˆÊñ&∆W26˜FR˜W"∆RgWGW"&∆ˆ2&Ê«ó6W2Êˆ‚FñfgW6VW2"‡¢7FG3¢≤‚‚Ê&ˆÊÊW2¬VÊFñÊr¬FñW'2¬&ˆÊÊW2¬ˆ'6W'fVW2¬v∆ˆ&¬“¿¢ÚÚ:ó&ñ‹:áG&R∆ó\:í¬˜W"VR∆Rg&ˆÁBVó76R¬vÊÊˆÊ6W"6∆ó&V÷VÁ@¢ÚÚÇ%7FFó7FóVW2FRFˆ‚∆ñW"7FÊF&B"íR∆ñWRFR∆ó76W"7&ˆó&R: ¢ÚÚ¬v&ˆÊÏ:íRvñ¬6ˆÁ7V«FR¬vÜó7F˜&óVR6ˆ◊∆WB‡¢66˜S¢FñW$fñ«FW"Ú≤fñ«FW&VC¢G'VR¬∆„¢fñWvW%∆‚“¢≤fñ«FW&VC¢f«6R¬∆„¢fñWvW%∆‚«¬ÁV∆¬“¿¢fW&ñfñ6Fñˆ„¢∞¢&Wó&VEˆFFS¢4ƒîTÂEÙÑï5Dı%ïı$Uï%ÙDDR¿¢FV∆Vw&’˜&ˆˆe˜6ñÊ6S¢4ƒîTÂEıDTƒTu$’ı$ÙÙeı4î‰4R¿¢'V∆S¢&fˆ˜F&∆≈ˆ˜S#UÛU˜6VG5ˆ÷ñÂÛE˜f˜FW5ˆ÷ñÁWFUÛUÛCR"¿¢“¿¢“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Ê«ó6ó2÷Üó7F˜'ï“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬Ê«ó6W3¢µ“¬F˜F√¢¬7FG3¢≤F˜F√¢¬vñÁ3¢¬∆˜76W3¢¬vñÁ&FS¢¬VÊFñÊs¢¬&ˆfóC¢¬&ˆï˜7C¢¬fuˆˆFG3¢¬FñW'3¢∑“““ì∞¢–ß“ì∞†¢ÚÚ)H)HF÷ñ‚(	BÊ«óFñ72&W˜'G2ˆ‚FV÷ÊB)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶Á˜7BÇ"ˆF÷ñ‚ˆÊ«óFñ72◊&W˜'B"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬GóR““&WÊ&ˆGí«¬∑”∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó<:í"“ì∞¢ñbáGóR””“'vVV∂«í"í∞¢6ˆÁ7BFWáB“vóB'Vñ∆EvVV∂«î÷&∂WFñÊu&W˜'BÇì∞¢6ˆÁ7Bˆ≤“vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬FWáBì∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≤¬÷W76vS¢ˆ≤Ú%&˜'BÜV&FÚVÁf˜ú:í"¢,8ñ6ÜV2VÁfˆí"“ì∞¢–¢6ˆÁ7BFWáB“'Vñ∆DFñ«ïfó6óF˜%&W˜'BÇì∞¢6ˆÁ7Bˆ≤“vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬FWáBì∞¢&W2Êß6ˆ‚á≤ˆ≤¬÷W76vS¢ˆ≤Ú%&˜'Bfó6óFWW'2VÁf˜ú:í"¢,8ñ6ÜV2VÁfˆí"“ì∞ß“ì∞†¢ÚÚ)H)HF÷ñ‚7FG2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆF÷ñ‚˜7FG2"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6<:á2F÷ñ‚&WVó2"“ì∞†¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B∆¬“6ˆFW4F"Á&W&RÇ%4TƒT5B∆‚¬7FófR¬Wáó&W5ˆBe$Ù“6ˆFW2"íÊ∆¬Çì∞¢6ˆFW4F"Ê6∆˜6RÇì∞†¢6ˆÁ7BÊ˜r“ÊWrFFRÇì∞¢6ˆÁ7B7FófR“∆¬Êfñ«FW"á"”‚"Ê7FófR””“ì∞¢6ˆÁ7B6˜VÁG2“≤g&VS¢¬&V÷óV”¢¬fó¢¬V∆óFS¢¬F˜F√¢7FófRÊ∆VÊwFÇ”∞¢7FófRÊf˜$V6Çá"”‚≤ñbÜ6˜VÁG5∑"Á∆Â“”“VÊFVfñÊVBí6˜VÁG5∑"Á∆Â“≤≥≤“ì∞†¢6ˆÁ7BWáó&ñÊs6B“7FófRÊfñ«FW"á"”‚∞¢ñbÇ"ÊWáó&W5ˆBí&WGW&‚f«6S∞¢6ˆÁ7BB“÷FÇÁ&˜VÊBÇÜÊWrFFRá"ÊWáó&W5ˆBí“Ê˜ríÚÉcCì∞¢&WGW&‚B„“bbB√“3∞¢“íÊ∆VÊwFÉ∞†¢6ˆÁ7BWáó&VB“∆¬Êfñ«FW"á"”‚"ÊWáó&W5ˆBbbÊWrFFRá"ÊWáó&W5ˆBí¬Ê˜ríÊ∆VÊwFÉ∞†¢6ˆÁ7B&ˆˆg2“∆ˆE&ˆˆg2Çì∞†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢W6W'3¢6˜VÁG2¿¢Wáó&ñÊu˜6ˆˆ„¢Wáó&ñÊs6B¿¢Wáó&VE˜F˜F√¢Wáó&VB¿¢&ˆˆg5ˆ6˜VÁC¢&ˆˆg2Ê∆VÊwFÇ¿¢“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ)H)HF÷ñ‚∆˜6ñÊr∆VwVW2Ê«ó6ó2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆF÷ñ‚ˆ∆˜6ñÊr÷∆VwVW2"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6<:á2F÷ñ‚&WVó2"“ì∞¢G'í∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5B6ˆ◊WFóFñˆ‚¬6˜VÁG'í¬7˜'B¿¢4ıTÂBÇ¢í2F˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰Bí2vñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí2∆˜76W0¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rí‰B6ˆ◊WFóFñˆ‚“rp¢u$ıU%í6ˆ◊WFóFñˆ‡¢Ñdî‰rF˜F¬„“ ¢ı$DU"%í∆˜76W2DU42¬F˜F¬DU40¢íÊ∆¬Çì∞¢6ˆÁ7B∆VwVW2“&˜w2Ê÷á"”‚á∞¢6ˆ◊WFóFñˆ„¢"Ê6ˆ◊WFóFñˆ‚¿¢6˜VÁG'ì¢"Ê6˜VÁG'í¿¢7˜'C¢"Á7˜'B¿¢F˜F√¢"ÁF˜F¬¿¢vñÁ3¢"ÁvñÁ2¿¢∆˜76W3¢"Ê∆˜76W2¿¢vñÁ&FS¢"ÁF˜F¬‚Ú÷FÇÁ&˜VÊBá"ÁvñÁ2Ú"ÁF˜F¬¢í¢¿¢FÊvW#¢"ÁF˜F¬„“2bbá"ÁvñÁ2Ú"ÁF˜F¬í¬„R¿¢“íì∞¢6ˆÁ7BFÊvW&˜W2“∆VwVW2Êfñ«FW"Ü¬”‚¬ÊFÊvW"ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬∆VwVW2¬FÊvW&˜W2¬7VvvW7Fñˆ„¢FÊvW&˜W2Ê÷Ü¬”‚¬Ê6ˆ◊WFóFñˆ‚ÁFÙ∆˜vW$66RÇíí“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ)H)HF÷ñ‚6ˆFW2∆ó7B)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆF÷ñ‚ˆ6ˆFW2"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6<:á2F÷ñ‚&WVó2"“ì∞†¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜w2“6ˆFW4F"Á&W&RÄ¢%4TƒT5B6ˆFR¬V÷ñ¬¬∆‚¬7FófR¬Wáó&W5ˆB¬7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFóG5ˆFFRe$Ù“6ˆFW2ı$DU"%í∆‚¬V÷ñ¬ ¢íÊ∆¬Çì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6ˆFW3¢&˜w2“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ)H)HF÷ñ‚7&VFR6ˆFR)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶Á˜7BÇ"ˆF÷ñ‚ˆ7&VFR÷6ˆFR"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ√¢F÷ñ‰V÷ñ¬¬6ˆFS¢F÷ñ‰6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜF÷ñ‰V÷ñ¬¬F÷ñ‰6ˆFRíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6<:á2F÷ñ‚&WVó2"“ì∞†¢6ˆÁ7B≤F&vWEˆV÷ñ¬¬∆‚“&V∆óFR"¬GW&FñˆÂˆFó2“3"““&WÊ&ˆGí«¬∑”∞¢ñbÇF&vWEˆV÷ñ¬í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢'F&vWEˆV÷ñ¬&WVó2"“ì∞†¢6ˆÁ7B7&VFóG4÷Ç“FVfV«D7&VFóG4÷Ñf˜%∆‚á∆‚ì∞†¢G'í∞¢6ˆÁ7B6F'r“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6ˆÁ7BWÜó7FñÊr“6F'rÁ&W&RÇ%4TƒT5B6ˆFR¬∆‚e$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“"íÊvWBáF&vWEˆV÷ñ¬ì∞¢ñbÜWÜó7FñÊrí∞¢6F'rÊ6∆˜6RÇì∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6ˆFS¢WÜó7FñÊrÊ6ˆFR¬∆„¢WÜó7FñÊrÁ∆‚¬Ê˜FS¢$6ˆFRWÜó7FÁB,:ñ7Fól:í"“ì∞¢–¢6ˆÁ7B6Ü'2“$$4DTdtÑ§¥ƒ‘Â%5EUeuÖï£#3CScsÉí#∞¢6ˆÁ7BÊWt6ˆFR“'&íÊg&ˆ“á≤∆VÊwFÉ¢Ç“¬Çí”‚6Ü'5¥÷FÇÊf∆ˆ˜"Ñ÷FÇÁ&ÊFˆ“Çí¢6Ü'2Ê∆VÊwFÇï“íÊ¶ˆñ‚Ç""ì∞¢6ˆÁ7BWáó&W4B“ÊWrFFRÑFFRÊÊ˜rÇí≤GW&FñˆÂˆFó2¢ÉcCíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6F'rÁ&W&RÄ¢$îÂ4U%BîÂDÚ6ˆFW2Ü6ˆFR¬V÷ñ¬¬∆‚¬7FófR¬Wáó&W5ˆB¬7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFóG5ˆFFR¬7&VFVEˆBíd≈TU2ÉÚ√Ú√Ú√√Ú√Ú√√Ú∆FFWFñ÷RÇvÊ˜rríí ¢íÁ'V‚ÜÊWt6ˆFR¬F&vWEˆV÷ñ¬¬∆‚¬Wáó&W4B¬7&VFóG4÷Ç¬vWEFˆFï7G"Çíì∞¢6F'rÊ6∆˜6RÇì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂F÷ñÂ“6ˆFR7,:ú:ì¢G∂ÊWt6ˆFW“˜W"G∑F&vWEˆV÷ñ«“∆‚G∑∆Á“Wáó&RG∂Wáó&W4G÷ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6ˆFS¢ÊWt6ˆFR¬∆‚¬V÷ñ√¢F&vWEˆV÷ñ¬¬Wáó&W5ˆC¢Wáó&W4B“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ)H)HñÁFW&Ê¬ñ6≤Ê˜Fñgí(	B6∆∆VB'íÜW&‹:á2gFW"ˆÊ«ó6R)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ6V7W&VB'íÑU$‘U5ÙD‘îÂıDƒ’Ù$ıBFˆ∂V‚26Ü&VB6V7&W@¢ÚÚ&˜WFRVÃ:ñR"ÜW&‹:á2&˜B,:á2l:ó&ñfñ6Fñˆ‚7G&óRñV÷VÁB6∆ñVÁ@¶Á˜7BÇ"ˆñÁFW&Ê¬˜7G&óR◊fW&ñgí"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤6W76ñˆÂˆñB¬V÷ñ¬““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢6ˆÁ7B6V7&WB“&WÊÜVFW'5≤'Ç÷ñÁFW&Ê¬◊6V7&WB%”∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R“ì∞¢ñbÇ6W76ñˆÂˆñB«¬V÷ñ¬í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢'6W76ñˆÂˆñBWBV÷ñ¬&WVó2"“ì∞†¢G'í∞¢ÚÚl:ó&ñfñW"6W76ñˆ‚7G&óP¢ñbÇ5E$ïUı4T5$UEÙ¥Uíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%7G&óRÊˆ‚6ˆÊfñwW,:í"“ì∞¢6ˆÁ7B7G&óR“&WVó&RÇ'7G&óR"ì∞¢6ˆÁ7B7G&óR“7G&óRÖ5E$ïUı4T5$UEÙ¥Uíì∞¢6ˆÁ7B6W76ñˆ‚“vóB7G&óRÊ6ÜV6∂˜WBÁ6W76ñˆÁ2Á&WG&ñWfRá6W76ñˆÂˆñB¬≤WáÊC¢≤&∆ñÊUˆóFV◊2%““ì∞¢ñbÇ6W76ñˆ‚«¬6W76ñˆ‚Áñ÷VÁE˜7FGW2”“'ñB"í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%ñV÷VÁBÊˆ‚6ˆÊfó&‹:í"“ì∞†¢6ˆÁ7B&ñ6TñB“6W76ñˆ‚Ê∆ñÊUˆóFV◊3ÚÊFFÚÂ≥”ÚÁ&ñ6SÚÊñB«¬"#∞¢6ˆÁ7B∆‰÷“∞¢µ5E$ïUı$î4UÙîEÙ4%DU”¢≤7FGW3¢&6'FR"¬GW&Fñˆ‰Fó3¢¬7&VFóG4÷É¢“¿¢µ5E$ïUı$î4UÙîEı5D‰D$E”¢≤7FGW3¢'7FÊF&B"¬GW&Fñˆ‰Fó3¢3"¬7&VFóG4÷É¢2“¿¢µ5E$ïUı$î4UÙîEı$T‘ïT’”¢≤7FGW3¢'&V÷óV“"¬GW&Fñˆ‰Fó3¢3"¬7&VFóG4÷É¢“¿¢µ5E$ïUı$î4UÙîEıdï”¢≤7FGW3¢'fó"¬GW&Fñˆ‰Fó3¢3"¬7&VFóG4÷É¢#“¿¢µ5E$ïUı$î4UÙîEÙTƒïDU”¢≤7FGW3¢&V∆óFR"¬GW&Fñˆ‰Fó3¢3"¬7&VFóG4÷É¢3“¿¢”∞¢6ˆÁ7B≤7FGW2“'&V÷óV“"¬GW&Fñˆ‰Fó2“3"¬7&VFóG4÷Ç“““∆‰÷∑&ñ6TñE“«¬∑”∞†¢ÚÚ6ÜW&6ÜW"6ˆFRWÜó7FÁ@¢6ˆÁ7B6F'"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢∆WB6ˆFU&˜r“6F'"Á&W&RÇ%4TƒT5B6ˆFR¬∆‚e$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“"íÊvWBÜV÷ñ¬ì∞¢6F'"Ê6∆˜6RÇì∞†¢ñbÇ6ˆFU&˜rí∞¢ÚÚ7,:ñW"∆R6ˆFP¢6ˆÁ7B6Ü'2“$$4DTdtÑ§¥ƒ‘Â%5EUeuÖï£#3CScsÉí#∞¢6ˆÁ7BÊWt6ˆFR“'&íÊg&ˆ“á≤∆VÊwFÉ¢Ç“¬Çí”‚6Ü'5¥÷FÇÊf∆ˆ˜"Ñ÷FÇÁ&ÊFˆ“Çí¢6Ü'2Ê∆VÊwFÇï“íÊ¶ˆñ‚Ç""ì∞¢6ˆÁ7BWáó&W4B“ÊWrFFRÑFFRÊÊ˜rÇí≤GW&Fñˆ‰Fó2¢ÉcCíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7B6F'r“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6F'rÁ&W&RÄ¢$îÂ4U%BîÂDÚ6ˆFW2Ü6ˆFR¬V÷ñ¬¬∆‚¬7FófR¬Wáó&W5ˆB¬7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFóG5ˆFFR¬7&VFVEˆBíd≈TU2ÉÚ√Ú√Ú√√Ú√Ú√√Ú∆FFWFñ÷RÇvÊ˜rríí ¢íÁ'V‚ÜÊWt6ˆFR¬V÷ñ¬¬7FGW2¬Wáó&W4B¬7&VFóG4÷Ç¬vWEFˆFï7G"Çíì∞¢6F'rÊ6∆˜6RÇì∞¢6ˆFU&˜r“≤6ˆFS¢ÊWt6ˆFR¬∆„¢7FGW2”∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑7G&óR◊fW&ñgï“6ˆFR7,:ú:ì¢G∂ÊWt6ˆFW“˜W"G∂V÷ñ«“∆‚G∑7FGW7÷ì∞¢–†¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6ˆFS¢6ˆFU&˜rÊ6ˆFR¬∆„¢6ˆFU&˜rÁ∆‚“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7G&óR◊fW&ñgï“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ)H)HvRFR6ˆÊfó&÷Fñˆ‚,:á2ñV÷VÁBÖT$ƒïTRí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ<:ñ7W&ó<:ñR"7G&óR¢ñ¬fWBV‚6W76ñˆÂˆñB,8îTƒƒT‘TÂBú:í‚∆óB¬vV÷ñ¬FWVó0¢ÚÚ∆6W76ñˆ‚¬7,:ñR˜&VÁfˆñR∆R6ˆFRBv6<:á2‚fñ∆WBFR<:ñ7W&óL:í6í∆RvV&Üˆˆ≤:ñ6Ü˜VR‡¶Á˜7BÇ"˜ñ÷VÁB◊7V66W72"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤6W76ñˆÂˆñB““&WÊ&ˆGí«¬∑”∞¢ñbÇ6W76ñˆÂˆñBí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢'6W76ñˆÂˆñB&WVó2"“ì∞¢ñbÇ5E$ïUı4T5$UEÙ¥Uíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%7G&óRÊˆ‚6ˆÊfñwW,:í"“ì∞¢G'í∞¢6ˆÁ7B7G&óR“&WVó&RÇ'7G&óR"ì∞¢6ˆÁ7B7G&óR“7G&óRÖ5E$ïUı4T5$UEÙ¥Uíì∞¢6ˆÁ7B6W76ñˆ‚“vóB7G&óRÊ6ÜV6∂˜WBÁ6W76ñˆÁ2Á&WG&ñWfRá6W76ñˆÂˆñB¬≤WáÊC¢≤&∆ñÊUˆóFV◊2%““ì∞¢ñbÇ6W76ñˆ‚«¬6W76ñˆ‚Áñ÷VÁE˜7FGW2”“'ñB"í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%ñV÷VÁBÊˆ‚6ˆÊfó&‹:í"“ì∞¢6ˆÁ7BV÷ñ¬“á6W76ñˆ‚Ê7W7Fˆ÷W%ˆFWFñ«3ÚÊV÷ñ¬«¬6W76ñˆ‚Ê7W7Fˆ÷W%ˆV÷ñ¬«¬""íÁFÙ∆˜vW$66RÇíÁG&ñ“Çì∞¢ñbÇV÷ñ¬í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$V÷ñ¬ñÁG&˜Wf&∆R7W"∆6W76ñˆ‚"“ì∞¢6ˆÁ7B&ñ6TñB“6W76ñˆ‚Ê∆ñÊUˆóFV◊3ÚÊFFÚÂ≥”ÚÁ&ñ6SÚÊñB«¬"#∞¢6ˆÁ7B∆‰÷“∞¢µ5E$ïUı$î4UÙîEÙ4%DU”¢≤7FGW3¢&6'FR"¬GW&Fñˆ‰Fó3¢¬7&VFóG4÷É¢“¿¢µ5E$ïUı$î4UÙîEı5D‰D$E”¢≤7FGW3¢'7FÊF&B"¬GW&Fñˆ‰Fó3¢3"¬7&VFóG4÷É¢2“¿¢µ5E$ïUı$î4UÙîEı$T‘ïT’”¢≤7FGW3¢'&V÷óV“"¬GW&Fñˆ‰Fó3¢3"¬7&VFóG4÷É¢“¿¢µ5E$ïUı$î4UÙîEıdï”¢≤7FGW3¢'fó"¬GW&Fñˆ‰Fó3¢3"¬7&VFóG4÷É¢#“¿¢µ5E$ïUı$î4UÙîEÙTƒïDU”¢≤7FGW3¢&V∆óFR"¬GW&Fñˆ‰Fó3¢3"¬7&VFóG4÷É¢3“¿¢”∞¢6ˆÁ7B≤7FGW2“'&V÷óV“"¬GW&Fñˆ‰Fó2“3"¬7&VFóG4÷Ç“““∆‰÷∑&ñ6TñE“«¬∑”∞¢6ˆÁ7B6F'"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢∆WB6ˆFU&˜r“6F'"Á&W&RÇ%4TƒT5B6ˆFR¬∆‚e$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“"íÊvWBÜV÷ñ¬ì∞¢6F'"Ê6∆˜6RÇì∞¢ñbÇ6ˆFU&˜rí∞¢6ˆÁ7B6Ü'2“$$4DTdtÑ§¥ƒ‘Â%5EUeuÖï£#3CScsÉí#∞¢6ˆÁ7BÊWt6ˆFR“'&íÊg&ˆ“á≤∆VÊwFÉ¢Ç“¬Çí”‚6Ü'5¥÷FÇÊf∆ˆ˜"Ñ÷FÇÁ&ÊFˆ“Çí¢6Ü'2Ê∆VÊwFÇï“íÊ¶ˆñ‚Ç""ì∞¢6ˆÁ7BWáó&W4B“ÊWrFFRÑFFRÊÊ˜rÇí≤GW&Fñˆ‰Fó2¢ÉcCíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7B6F'r“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6F'rÁ&W&RÇ$îÂ4U%BîÂDÚ6ˆFW2Ü6ˆFR¬V÷ñ¬¬∆‚¬7FófR¬Wáó&W5ˆB¬7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFóG5ˆFFR¬7&VFVEˆBíd≈TU2ÉÚ√Ú√Ú√√Ú√Ú√√Ú∆FFWFñ÷RÇvÊ˜rríí"ê¢Á'V‚ÜÊWt6ˆFR¬V÷ñ¬¬7FGW2¬Wáó&W4B¬7&VFóG4÷Ç¬vWEFˆFï7G"Çíì∞¢6F'rÊ6∆˜6RÇì∞¢6ˆFU&˜r“≤6ˆFS¢ÊWt6ˆFR¬∆„¢7FGW2”∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑ñ÷VÁB◊7V66W75“6ˆFR7,:ú:íÜfñ∆WBì¢G∂ÊWt6ˆFW“˜W"G∂V÷ñ«“ÇG∑7FGW7“ñì∞¢–¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6ˆFS¢6ˆFU&˜rÊ6ˆFR¬∆„¢6ˆFU&˜rÁ∆‚¬V÷ñ¬“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑ñ÷VÁB◊7V66W75“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$W'&WW"FRl:ó&ñfñ6Fñˆ‚"“ì∞¢–ß“ì∞†¶Á˜7BÇ"ˆñÁFW&Ê¬˜ñ6≤÷Ê˜Fñgí"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤ñ6≤¬6V7&WB““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$f˜&&ñFFV‚"“ì∞¢–¢ñbÇñ6≤«¬ñ6≤ÊÜˆ÷Rí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢'ñ6≤÷ÁVÁB"“ì∞¢ñbÇ%$UdıÙïÙ¥Uíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$%$UdıÙïÙ¥UíÊˆ‚6ˆÊfñwW,:í"¬6VÁC¢“ì∞†¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜w2“6ˆFW4F"Á&W&RÄ¢%4TƒT5BV÷ñ¬e$Ù“6ˆFW2tÑU$R7FófR“‰B∆‚“vg&VRr‰BV÷ñ¬ï2‰ıBÂTƒ¬‰BV÷ñ¬“rr ¢íÊ∆¬Çì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢6ˆÁ7B∆VE&˜w2“∆ˆD∆VG2ÇíÊ∆VG2«¬µ”∞¢6ˆÁ7B∆VD÷“ÊWr÷Ü∆VE&˜w2Ê÷Ü¬”‚µ7G&ñÊrÜ¬ÊV÷ñ¬«¬""íÁFÙ∆˜vW$66RÇí¬≈“íì∞†¢6ˆÁ7BFˆFí“ÊWrFFRÇíÁFÙ∆ˆ6∆TFFU7G&ñÊrÇ&g"‘e""¬≤Fì¢#"÷FñvóB"¬÷ˆÁFÉ¢#"÷FñvóB"¬ñV#¢&ÁV÷W&ñ2"“ì∞¢6ˆÁ7BvñÂ˜FVÁFñV¬“ñ6≤Ê6˜FRÚ÷FÇÁ&˜VÊBÉ¢'6Tf∆ˆBáñ6≤Ê6˜FRíí¢#Ú#∞¢6ˆÁ7B∆ófUVÊfñ∆&∆TáF÷¬“ñ6≤Ê∆ófUVÊfñ∆&∆P¢Ú∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢6f&&c#C∂∆ñÊR÷ÜVñváC£„c∂&6∂w&˜VÊCß&v&É#S√ì√3b¬„"ì∂&˜&FW#£Ç6ˆ∆ñB&v&É#S√ì√3b¬„#Çì∂&˜&FW"◊&FóW3£É∑FFñÊs£'É∂÷&vñ‚◊F˜£'Ç#‰Ê«ó6R∆ófRîñÊFó7ˆÊñ&∆R˜W"6R÷F6Ç¢ñ¬‚vW7B26˜WfW'B"¬tí∆ófR‚∆Rñ6≤ˆffñ6ñV¬&W7FRf∆ñFR¬÷ó2V7VÊRÊ«ó6R∆ófRÊR6W&&ˆ÷ó6R„¬ˆFócÊ ¢¢"#∞¢6ˆÁ7BáF÷ƒ6ˆÁFVÁB“ £∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3cÉc∑FFñÊs£3'Ç#GÉ∂fˆÁB÷f÷ñ«ì§ñÁFW"ƒ&ñ¬«6Á2◊6W&ñc∂÷Ç◊vñGFÉ£cÉ∂÷&vñ„£WFÚ#‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£#GÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#GÉ∂fˆÁB◊vVñváC£ì∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3c3cfc¬3v36VBì≤◊vV&∂óB÷&6∂w&˜VÊB÷6∆óßFWáC≤◊vV&∂óB◊FWáB÷fñ∆¬÷6ˆ∆˜#ßG&Á7&VÁC∂Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≤#ÂF˜W4∆W4÷F6á3¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂∆WGFW"◊76ñÊs¢„V”∑FWáB◊G&Á6f˜&”ßWW&66S∂÷&vñ‚◊F˜£GÇ#„BtTÂE2î≤4ÑîTb‚ERDT4îDU2dT2≈U2DRDÙ‰‰TU2„¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3C#∂&˜&FW#£Ç6ˆ∆ñB&v&Éìí√"√#C¬„#Rì∂&˜&FW"◊&FóW3£gÉ∑FFñÊs£#GÉ∂÷&vñ‚÷&˜GFˆ”£#Ç#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂fˆÁB◊vVñváC£s∂∆WGFW"◊76ñÊs¢„V”∑FWáB◊G&Á6f˜&”ßWW&66S∂6ˆ∆˜#¢3#&C6VS∂÷&vñ‚÷&˜GFˆ”£'Ç#Ô	¯ÍÚñ6≤GRG∑FˆFó”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#'É∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢6V6VcC∂÷&vñ‚÷&˜GFˆ”£áÇ#‚G∑ñ6≤ÊÜˆ÷W“g2G∑ñ6≤Êvó”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢6ÜV3É∂÷&vñ‚÷&˜GFˆ”£gÇ#Ô	¯¯bG∑ñ6≤Ê∆VwVR«¬"'“+r	˘YG∑ñ6≤ÁFñ÷R«¬"'”¬ˆFóc‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊCß&v&Ésí√s√##í¬„"ì∂&˜&FW#£Ç6ˆ∆ñB&v&Ésí√s√##í¬„#Rì∂&˜&FW"◊&FóW3£É∑FFñÊs£GÉ∂÷&vñ‚÷&˜GFˆ”£gÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢6ÜV3É∂÷&vñ‚÷&˜GFˆ”£GÇ#Â&ˆÊ˜7Fñ2GR6ˆÊ6ñ∆S¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#É∂fˆÁB◊vVñváC£É∂6ˆ∆˜#¢6V6VcB#‚G∑ñ6≤Á&ˆÊÚ«¬ñ6≤Ê&WB«¬"'”¬ˆFóc‡¢∆Fób7Gñ∆S“&÷&vñ‚◊F˜£áÉ∂Fó7∆ì¶f∆WÉ∂v£gÉ∂f∆WÇ◊w&ßw&#‡¢«7‚7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢3#&C6VR#Ô	˘8¢6˜FR¢«7G&ˆÊs‚G∑ñ6≤Ê6˜FW”¬˜7G&ˆÊs„¬˜7„‡¢«7‚7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢3#ìÉ#Ó)»R66˜&RFR6ˆÊfñÊ6R¢«7G&ˆÊs‚G∑ñ6≤Ê6ˆÊfñFVÊ6UFr«¬ñ6≤Ê6ˆÊfñFVÊ6R≤"Û"«¬"'”¬˜7G&ˆÊs„¬˜7„‡¢¬ˆFóc‡¢¬ˆFóc‡¢G∑ñ6≤Á&ó6ˆ‚Ú∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢6ÜV3É∂∆ñÊR÷ÜVñváC£„c∂fˆÁB◊7Gñ∆S¶óF∆ñ3∂&˜&FW"÷∆VgC£'Ç6ˆ∆ñB&v&Éìí√"√#C¬„Bì∑FFñÊr÷∆VgC£'Ç#‚G∑ñ6≤Á&ó6ˆÁ”¬ˆFócÊ¢"'–¢G∂∆ófUVÊfñ∆&∆TáF÷«–¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£#Ç#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢3v#É&∂÷&vñ‚÷&˜GFˆ”£'Ç#Ô	˘+vñ‚˜FVÁFñV¬7W"(*¬÷ó<:ó2¢«7G&ˆÊr7Gñ∆S“&6ˆ∆˜#¢3#ìÉ#‚≤G∂vñÂ˜FVÁFñV«ﬁ(*√¬˜7G&ˆÊs„¬ˆFóc‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“"7Gñ∆S“&Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≥∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3FcCfSR¬3v36VBì∂6ˆ∆˜#¢6ffc∑FFñÊs£7Ç#áÉ∂&˜&FW"◊&FóW3£É∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊS∂fˆÁB◊vVñváC£s∂fˆÁB◊6ó¶S£GÇ#Âfˆó"¬vÊ«ó6R6ˆ◊Ã:áFR(i#¬ˆ‡¢¬ˆFóc‡¢G∂&ˆˆ∂÷∂W$V÷ñƒáF÷¬Çó–¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂∆ñÊR÷ÜVñváC£„b#‡¢F˜W4∆W4÷F6á2(	BÊ«ó6Rî+r∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“"7Gñ∆S“&6ˆ∆˜#¢3c3cfc∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#ÁF˜W6∆W6÷F6á2Ê6ˆ”¬ˆ„∆'#‡¢)™˚àÚÊ«ó6W27˜'FófW2,:ó6W'l:ñW2WÇ≥ÇÁ2‚¶WR&W7ˆÁ6&∆R‡¢¬ˆFóc‡£¬ˆFócÊ∞†¢∆WB6VÁB“∞¢6ˆÁ7BV÷ñ«2“≤‚‚ÊÊWr6WBÖ≤‚‚Á&˜w2Ê÷á"”‚"ÊV÷ñ¬í¬‚‚Ê∆VE&˜w2Ê÷Ü¬”‚¬ÊV÷ñ¬ï“Êfñ«FW"Ñ&ˆˆ∆V‚íï”∞¢f˜"Ü6ˆÁ7BV÷ñ¬ˆbV÷ñ«2í∞¢G'í∞¢6ˆÁ7B∑7V&¶V7E&VfóÖ““ñ6¥V÷ñ≈FWáBÜ∆VD∆ÊrÜV÷ñ¬¬∆VD÷íì∞¢vóB'&Wfı6VÊDV÷ñ¬ÜV÷ñ¬¬	¯ÍÚG∑7V&¶V7E&Vfóá“(	BG∑ñ6≤ÊÜˆ÷W“g2G∑ñ6≤Êvó“G∑ñ6≤Ê6˜FW÷¬áF÷ƒ6ˆÁFVÁBì∞¢6VÁB≤≥∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ü∑ñ6≤÷Ê˜Fñgï“V÷ñ¬FÚG∂V÷ñ«”¶¬RÊ÷W76vRì∞¢–¢–¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑ñ6≤÷Ê˜Fñgï“V÷ñ«2VÁf˜ú:ó2¢G∑6VÁG“ÚG∂V÷ñ«2Ê∆VÊwFá÷ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6VÁB¬F˜F√¢V÷ñ«2Ê∆VÊwFÇ“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑ñ6≤÷Ê˜Fñgï“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR¬6VÁC¢“ì∞¢–ß“ì∞†¢ÚÚ)H)H&VfW'&¬&˜WFW2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"˜&VbÛ¶6ˆFR"¬á&W¬&W2í”‚∞¢6ˆÁ7B6ˆFR“7G&ñÊrá&WÁ&◊2Ê6ˆFR«¬""íÁ&W∆6RÇıµ‰’£”ï¬’“ˆví¬""íÁFıWW$66RÇíÁ6∆ñ6RÉ¬#Bì∞¢&W2Á&VFó&V7BÉ3"¬Û˜&Vc“G∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÜ6ˆFRó“7∆Á6ì∞ß“ì∞†¶Á˜7BÇ"˜&VfW'&¬ˆvWB÷∆ñÊ≤"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BWFÇ“fW&ñgî6ˆFRÜV÷ñ¬¬6ˆFRì∞¢ñbÇWFÇÁf∆ñBí&WGW&‚&W2Á7FGW2ÉCíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6ˆFRñÁf∆ñFR"“ì∞¢6ˆÁ7B&Vd6ˆFR“vWD˜$7&VFU&Vd6ˆFRÜV÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢6ˆÁ7B∆ñÊ≤“áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“˜&VbÚG∑&Vd6ˆFW÷∞¢6ˆÁ7BFF“∆ˆE&VfW'&«2Çì∞¢6ˆÁ7B&Vb“FFÁ&Vg5∑&Vd6ˆFU“«¬∑”∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&Vd6ˆFR¬∆ñÊ≤¬&VfW'&«3¢á&VbÁ&VfW'&«2«¬µ“íÊ∆VÊwFÇ¬÷ˆÁFá4V&ÊVC¢&VbÊ÷ˆÁFá4V&ÊVB«¬“ì∞ß“ì∞†¶Á˜7BÇ"˜&VfW'&¬ˆ6ˆÊfó&“"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤&Vd6ˆFR¬ÊWtV÷ñ¬¬6V7&WB““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$f˜&&ñFFV‚"“ì∞¢ñbÇ&Vd6ˆFR«¬ÊWtV÷ñ¬í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢'&Vd6ˆFRWBÊWtV÷ñ¬&WVó2"“ì∞¢6ˆÁ7B7&VFóFVB“7&VFóE&VfW'&W"á&Vd6ˆFRÁFıWW$66RÇí¬ÊWtV÷ñ¬ÁFÙ∆˜vW$66RÇíÁG&ñ“Çíì∞¢&W2Êß6ˆ‚á≤ˆ≥¢7&VFóFVB¬÷W76vS¢7&VFóFVBÚ%'&ñ‚7,:ñFóL:íFR3¶˜W'2"¢$L:ñ¨:7,:ñFóL:í˜R6ˆFRñÁf∆ñFR"“ì∞ß“ì∞†¢ÚÚ)H)H6ñvÊ¬f˜'B&ñ∆‚(	BVÊGˆñÁBF÷ñ‚≤V&∆ñ27FG2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶Á˜7BÇ"ˆñÁFW&Ê¬˜6ñvÊ¬÷f˜'B÷&ñ∆‚"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤6V7&WB““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$f˜&&ñFFV‚"“ì∞¢vóB6VÊE6ñvÊƒf˜'D&ñ∆ÂFV∆Vw&“Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬7FG3¢vWE6ñvÊƒf˜'E7FG2Çí“ì∞ß“ì∞†¢ÚÚfóG&ñÊRGR6ˆ◊FRw&GVóB¢6RVR∆W2&ˆÊÊW27FÊF&BˆÁB&VV∆∆V÷VÁB&V7P¢ÚÚÜñW"‚6W'B∆&WWfR"¬vWÜV◊∆R6Á2&ñV‚FWfˆñ∆W"FW26ñvÊWÇT‚4ıU%0¢ÚÚáVÊóVV÷VÁBFW2÷F6á2FV¶FW&÷ñÊW2WBˆffñ6ñV∆∆V÷VÁB&Vv∆W2í‡¢ÚÚ÷ó6RFR&VfW&VÊ6RfóÜRUU"¬ffñ6ÜVRWá∆ñ6óFV÷VÁB6˜FR6∆ñVÁB(	B¶÷ó0¢ÚÚ&W6VÁFVR6ˆ÷÷RV‚vñ‚&VV¬¬VÊóVV÷VÁB6ˆ÷÷RVÊR6ñ◊V∆Fñˆ‚‡¶ÊvWBÇ"˜7FÊF&B◊ñW7FW&Fí"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BÜˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¿¢&V≈ˆˆFB¬&V≈ˆˆFE˜6˜W&6R¬˜WF6ˆ÷R¬Ê«ó6VEˆB¿¢fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆvê¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R6ñu˜6VÁE˜7FÊF&B“¢‰BFFRÜÊ«ó6VEˆBí“FFRÇvÊ˜rr¬r”Fírê¢‰B˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢ı$DU"%íÊ«ó6VEˆB40¢íÊ∆¬Çì∞†¢6ˆÁ7B‘ï4R“∞¢∆WB&ˆfóB“¬vñÁ2“¬∆˜76W2“∞¢6ˆÁ7B6V∆V7FñˆÁ2“&˜w2Ê÷á"”‚∞¢6ˆÁ7B6˜FR“&˜tˆFBá"ì∞¢6ˆÁ7BvvÊR“"Ê˜WF6ˆ÷R””“'vñ‚#∞¢6ˆÁ7Bvñ‚“vvÊRÚ÷FÇÁ&˜VÊBÇÜ6˜FR“í¢‘ï4R¢íÚ¢‘‘ï4S∞¢&ˆfóB≥“vñ„∞¢ñbÜvvÊRívñÁ2≤≥≤V«6R∆˜76W2≤≥∞¢&WGW&‚∞¢FFS¢"ÊÊ«ó6VEˆB¿¢6ˆ◊WFóFñˆ„¢"Ê6ˆ◊WFóFñˆ‚«¬"Á7˜'B«¬""¿¢Üˆ÷S¢"ÊÜˆ÷R¬vì¢"Êví¿¢&WC¢"Ê&W7Eˆ&WB¿¢6˜FR¿¢6ˆÊfñFVÊ6S¢"Ê6ˆÊfñFVÊ6R¿¢˜WF6ˆ÷S¢"Ê˜WF6ˆ÷R¿¢66˜&UˆfñÊ√¢"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢ÁV∆¬¿¢vñ„¢÷FÇÁ&˜VÊBÜvñ‚¢íÚ¿¢”∞¢“ì∞†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢÷ó6U˜&VfW&VÊ6S¢‘ï4R¿¢6V∆V7FñˆÁ2¿¢F˜F√¢6V∆V7FñˆÁ2Ê∆VÊwFÇ¿¢vñÁ2¬∆˜76W2¿¢&ˆfóC¢÷FÇÁ&˜VÊBá&ˆfóB¢íÚ¿¢“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑7FÊF&B◊ñW7FW&Fï“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6V∆V7FñˆÁ3¢µ“¬F˜F√¢¬vñÁ3¢¬∆˜76W3¢¬&ˆfóC¢¬÷ó6U˜&VfW&VÊ6S¢“ì∞¢–ß“ì∞†¶ÊvWBÇ"˜6ñvÊ¬÷f˜'B◊7FG2"¬á&W¬&W2í”‚∞¢6ˆÁ7B7FG2“vWE6ñvÊƒf˜'E7FG2Çì∞¢6ˆÁ7Bf˜&÷E&ˆÊıFñ÷W7F◊“Ü&WB¬÷ñÁWFRí”‚∞¢ñbÇ&WB«¬÷ñÁWFR””“ÁV∆¬«¬÷ñÁWFR””“VÊFVfñÊVBí&WGW&‚&WC∞¢&WGW&‚G∂&WG“å:∆G∂÷ñÁWFW÷R÷ñ‚ñ∞¢”∞¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢F˜F√¢7FG2ÁF˜F¬¿¢vñÁ3¢7FG2ÁvñÁ2¿¢∆˜76W3¢7FG2Ê∆˜76W2¿¢vñÁ&FS¢7FG2ÁvñÁ&FR¿¢&V6VÁC¢7FG2Á&V6VÁBÊ÷á"”‚á∞¢Üˆ÷S¢"ÊÜˆ÷R¿¢vì¢"Êví¿¢6ˆ◊WFóFñˆ„¢"Ê6ˆ◊WFóFñˆ‚¿¢7˜'C¢"Á7˜'B¿¢6ˆÊfñFVÊ6S¢"Ê6ˆÊfñFVÊ6R¿¢˜WF6ˆ÷S¢"Ê˜WF6ˆ÷R¿¢6˜FS¢&˜tˆFBá"í¿¢66˜&S¢"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢ÁV∆¬¿¢&WE˜vóFÖ˜Fñ÷W7F◊¢f˜&÷E&ˆÊıFñ÷W7F◊á"Ê&W7Eˆ&WB¬"Ê÷ñÁWFUˆEˆÊ«ó6ó2í¿¢FFS¢"ÊÊ«ó6VEˆB¿¢“íí¿¢ñ6∑5ˆfVVC¢7FG2Á&V6VÁBÊ÷á"”‚á∞¢ñC¢6b“G∑"ÊÜˆ÷W““G∑"Êvó““G∑"ÊÊ«ó6VEˆG÷Á&W∆6RÇı«2≤ˆr¬r“ríÁFÙ∆˜vW$66RÇí¿¢FFS¢"ÊÊ«ó6VEˆBÚ"ÊÊ«ó6VEˆBÁ6∆ñ6RÉ¬í¢""¿¢Fñ÷S¢"ÊÊ«ó6VEˆBÚ"ÊÊ«ó6VEˆBÁ6∆ñ6RÉ¬bí¢""¿¢6ˆ◊WFóFñˆ„¢"Ê6ˆ◊WFóFñˆ‚«¬"Á7˜'B«¬""¿¢Üˆ÷S¢"ÊÜˆ÷R¿¢vì¢"Êví¿¢ñ6≥¢f˜&÷E&ˆÊıFñ÷W7F◊á"Ê&W7Eˆ&WB«¬6ñvÊ¬f˜'BG∑"Ê6ˆÊfñFVÊ6W“V¬"Ê÷ñÁWFUˆEˆÊ«ó6ó2í¿¢6˜FS¢&˜tˆFBá"í¿¢7FGW3¢&fñÊó6ÜVB"¿¢&W7V«C¢"Ê˜WF6ˆ÷R””“'vñ‚"Ú'vñ‚"¢&∆˜72"¿¢66˜&S¢"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢#Ú"¿¢“íí¿¢Fá&W6Üˆ∆C¢vWDFFófU6ñvÊ≈Fá&W6Üˆ∆BÇí¿¢“ì∞ß“ì∞†¢ÚÚ)H)H&V÷óV“FV6W"7FG2(	BV&∆ñ2VÊGˆñÁBf˜"‰ıî4≤6∆W2óF6Ç)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"˜&V÷óV“◊FV6W""¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BFˆFí“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BñW7FW&Fí“ÊWrFFRÑFFRÊÊ˜rÇí“ÉcCíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞†¢6ˆÁ7B∆≈&˜w2“F"Á&W&RÜ ¢4TƒT5BÜˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬˜WF6ˆ÷R¬6ˆÊfñFVÊ6R¬&W7Eˆ&WB¬&V≈ˆˆFB¿¢fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬7˜'B¬Ê«ó6VEˆB¬÷ñÁWFUˆEˆÊ«ó6ó0¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rí‰B6ˆÊfñFVÊ6R„“G∂vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇó–¢ı$DU"%íÊ«ó6VEˆBDU40¢íÊ∆¬Çì∞†¢6ˆÁ7BFVGWVB“µ”∞¢6ˆÁ7B6VV‚“ÊWr6WBÇì∞¢f˜"Ü6ˆÁ7B"ˆb∆≈&˜w2í∞¢ÚÚ‹:¶÷W2WÜ6«W6ñˆÁ2VR∆fóG&ñÊRÜ¶WVÊW2ÚF˜WFWW6W2í‡¢ñbÜó4Êˆó6Tf˜$Fó7∆íá"íí6ˆÁFñÁVS∞¢6ˆÁ7B∂Wí“G∑"ÊÜˆ÷W’ÚG∑"Êvó’ÚG≤á"ÊÊ«ó6VEˆB«¬""íÁ6∆ñ6RÉ¬ó÷∞¢ñbá6VV‚ÊÜ2Ü∂Wííí6ˆÁFñÁVS∞¢6VV‚ÊFBÜ∂Wíì∞¢FVGWVBÁW6Çá"ì∞¢–†¢6ˆÁ7BFˆFï&˜w2“FVGWVBÊfñ«FW"á"”‚á"ÊÊ«ó6VEˆB«¬""íÁ7F'G5vóFÇáFˆFííì∞¢6ˆÁ7BñW7FW&Fï&˜w2“FVGWVBÊfñ«FW"á"”‚á"ÊÊ«ó6VEˆB«¬""íÁ7F'G5vóFÇáñW7FW&Fííì∞¢6ˆÁ7BvVV≥r“ÊWrFFRÑFFRÊÊ˜rÇí“r¢ÉcCíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BvVVµ&˜w2“FVGWVBÊfñ«FW"á"”‚á"ÊÊ«ó6VEˆB«¬""íÁ6∆ñ6RÉ¬í„“vVV≥rì∞†¢6ˆÁ7Bvr“á&˜w2í”‚á∞¢F˜F√¢&˜w2Ê∆VÊwFÇ¿¢vñÁ3¢&˜w2Êfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“'vñ‚"íÊ∆VÊwFÇ¿¢∆˜76W3¢&˜w2Êfñ«FW"á"”‚"Ê˜WF6ˆ÷R””“&∆˜72"íÊ∆VÊwFÇ¿¢“ì∞†¢6ˆÁ7B∆≈Fñ÷R“vrÜFVGWVBì∞¢6ˆÁ7BFˆFï7FG2“vráFˆFï&˜w2ì∞¢6ˆÁ7BñW7FW&Fï7FG2“vráñW7FW&Fï&˜w2ì∞¢6ˆÁ7BvVVµ7FG2“vrávVVµ&˜w2ì∞¢6ˆÁ7BvñÁ&FR“∆≈Fñ÷RÁF˜F¬‚Ú÷FÇÁ&˜VÊBÜ∆≈Fñ÷RÁvñÁ2Ú∆≈Fñ÷RÁF˜F¬¢í¢∞†¢6ˆÁ7B6ñ‘vñ‚“FVGWVBÁ&VGV6RÇá7V“¬"í”‚∞¢6ˆÁ7B6˜FR“&˜tˆFBá"ì∞¢&WGW&‚7V“≤á"Ê˜WF6ˆ÷R””“'vñ‚"ÚÉ¢6˜FR“í¢”ì∞¢“¬ì∞†¢6ˆÁ7BFˆFï6ñvÊ«2“FˆFï&˜w2Ê∆VÊwFÉ∞†¢ÚÚ&V6VÁFFˆóB6ˆÁFVÊó"V¶˜W&BváVíUBÜñW"˜W"VR∆Rg&ˆÁBVó76P¢ÚÚL:ó∆ñW"∆W2FWWÇˆÊv∆WG2Ç$V¶˜W&BváVí"WB$ÜñW""í‚fÁB¬6WV¬FˆFê¢ÚÚ:óFóBñÊ6«W2VÊBñ¬ífóBFW2÷F6á2GR¶˜W"(i"6∆ñ2$ÜñW""fñFR‡¢6ˆÁ7B÷W&vVB“≤‚‚ÁFˆFï&˜w2¬‚‚ÁñW7FW&Fï&˜w5”∞¢6ˆÁ7B&V6VÁE&W7V«G2“÷W&vVBÊ∆VÊwFÇ‚Ú÷W&vVB¢FVGWVBÁ6∆ñ6RÉ¬#ì∞†¢ÚÚ6˜W&&RFR&Ê∑&ˆ∆¬6á&ˆÊˆ∆ˆvóVRÜ÷ó6R(*¬¬6óF¬L:ó'B(*¬ê¢ÚÚ7W"F˜WFW2∆W2Ê«ó6W2(	B6˜W&6RVÊóVR˜W"∆Rw&ÜóVR$ÙíGR6óFR‡¢6ˆÁ7B6á&ˆÊˆ∆ˆvñ6¬“≤‚‚ÊFVGWVE“Á&WfW'6RÇì∞¢∆WB&Ê∑&ˆ∆¬“∞¢6ˆÁ7B&ˆw&W76ñˆ‚“∑≤∆&V√¢$L:ó'B"¬f«VS¢’”∞¢f˜"Ü6ˆÁ7B"ˆb6á&ˆÊˆ∆ˆvñ6¬í∞¢6ˆÁ7B6˜FR“&˜tˆFBá"ì∞¢&Ê∑&ˆ∆¬≥“"Ê˜WF6ˆ÷R””“'vñ‚"ÚÉ¢6˜FR“í¢”∞¢&Ê∑&ˆ∆¬“÷FÇÁ&˜VÊBÜ&Ê∑&ˆ∆¬¢íÚ∞¢6ˆÁ7B∆&V¬“"ÊÊ«ó6VEˆ@¢Ú"ÊÊ«ó6VEˆBÁ6∆ñ6RÉR¬íÁ7∆óBÇ"“"íÁ&WfW'6RÇíÊ¶ˆñ‚Ç"Ú"í≤""≤7G&ñÊrá"ÊÜˆ÷R«¬""íÁ7∆óBÇ""ï≥–¢¢7G&ñÊrá"ÊÜˆ÷R«¬""íÁ7∆óBÇ""ï≥”∞¢&ˆw&W76ñˆ‚ÁW6Çá≤∆&V¬¬f«VS¢&Ê∑&ˆ∆¬“ì∞¢–†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢FˆFï˜6ñvÊ«3¢FˆFï6ñvÊ«2¿¢vVV≥¢vVVµ7FG2¿¢∆≈Fñ÷S¢≤F˜F√¢∆≈Fñ÷RÁF˜F¬¬vñÁ3¢∆≈Fñ÷RÁvñÁ2¬vñÁ&FR“¿¢6ñ◊V∆FVEˆvñÂÛ¢6ñ‘vñ‚‚Ú≤G¥÷FÇÁ&˜VÊBá6ñ‘vñ‚óﬁ(*∆¢G¥÷FÇÁ&˜VÊBá6ñ‘vñ‚óﬁ(*∆¿¢6ñ◊V∆FVEˆvñÂ˜&s¢÷FÇÁ&˜VÊBá6ñ‘vñ‚í¿¢&Ê∑&ˆ∆≈ˆfñÊ√¢÷FÇÁ&˜VÊBÜ&Ê∑&ˆ∆¬¢íÚ¿¢&ˆw&W76ñˆ‚¿¢FˆFï˜&W7V«G3¢FˆFï7FG2¿¢ñW7FW&Fì¢ñW7FW&Fï7FG2¿¢&V6VÁC¢&V6VÁE&W7V«G2Ê÷á"”‚∞¢6ˆÁ7B6˜FR“&˜tˆFBá"ì∞¢6ˆÁ7Bvñ„“"Ê˜WF6ˆ÷R””“wvñ‚rÚ÷FÇÁ&˜VÊBÇÜ6˜FR¢“í¢íÚ¢”∞¢6ˆÁ7B&WEvóFÖFñ÷R“"Ê÷ñÁWFUˆEˆÊ«ó6ó2”“ÁV∆¬bb"Ê÷ñÁWFUˆEˆÊ«ó6ó2”“VÊFVfñÊV@¢ÚG∑"Ê&W7Eˆ&WG“å:∆G∑"Ê÷ñÁWFUˆEˆÊ«ó6ó7÷R÷ñ‚ñ ¢¢"Ê&W7Eˆ&WC∞¢&WGW&‚∞¢÷F6É¢G∑"ÊÜˆ÷W“g2G∑"Êvó÷¿¢6ˆ◊WFóFñˆ„¢"Ê6ˆ◊WFóFñˆ‚«¬rr¿¢˜WF6ˆ÷S¢"Ê˜WF6ˆ÷R¿¢7˜'C¢"Á7˜'B«¬tfˆ˜F&∆¬r¿¢66˜&S¢"ÊfñÊ≈˜66˜&UˆÜˆ÷R“ÁV∆¬ÚG∑"ÊfñÊ≈˜66˜&UˆÜˆ÷W““G∑"ÊfñÊ≈˜66˜&Uˆvó÷¢ÁV∆¬¿¢&WC¢"Ê&W7Eˆ&WB¿¢&WE˜vóFÖ˜Fñ÷W7F◊¢&WEvóFÖFñ÷R¿¢FFS¢"ÊÊ«ó6VEˆBÚ"ÊÊ«ó6VEˆBÁ6∆ñ6RÉ¬í¢ÁV∆¬¿¢6˜FS¢÷FÇÁ&˜VÊBÜ6˜FR¢íÚ¿¢vñ„¿¢”∞¢“í¿¢“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬FˆFï˜6ñvÊ«3¢¬vVV≥¢≤F˜F√¢¬vñÁ3¢¬∆˜76W3¢“¬∆≈Fñ÷S¢≤F˜F√¢¬vñÁ3¢¬vñÁ&FS¢“¬6ñ◊V∆FVEˆvñÂÛ¢#(*¬"¬6ñ◊V∆FVEˆvñÂ˜&s¢¬ñW7FW&Fì¢≤F˜F√¢¬vñÁ3¢¬∆˜76W3¢“¬&V6VÁC¢µ“¬“ì∞¢–ß“ì∞†¢ÚÚ)H)HñÁFW&Ê¬6ñvÊ¬Ê˜Fñgí(	B7G&ˆÊr6ñvÊ¬V÷ñ¬FÚ&V÷óV“7V'67&ñ&W'2)H)H)H)H)H)H)H ¶Á˜7BÇ"ˆñÁFW&Ê¬˜6ñvÊ¬÷Ê˜Fñgí"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤6ñvÊ¬¬6V7&WB““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$f˜&&ñFFV‚"“ì∞¢ñbÇ6ñvÊ¬«¬6ñvÊ¬ÊÜˆ÷Rí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢'6ñvÊ¬÷ÁVÁB"“ì∞¢ÚÚv&FR÷f˜R¢ÜW&‹:á2ÊRWWB2FñfgW6W"V‚6ñvÊ¬7W"V‚÷F6Çl:ñ÷ñÊñ‚ÊíVÊP¢ÚÚ∆ñwVRF˜WFWW6RÑfˆ˜F&∆¬í¬‹:¶÷Rfñ6WBVÊGˆñÁBñÁFW&ÊRÜL:ñfVÁ6RV‚&ˆfˆÊFWW"í‡¢6ˆÁ7B6ñt÷F6Ç“≤6ˆ◊WFóFñˆ„¢6ñvÊ¬Ê6ˆ◊WFóFñˆ‚¬∆VwVS¢6ñvÊ¬Ê6ˆ◊WFóFñˆ‚¬Üˆ÷S¢6ñvÊ¬ÊÜˆ÷R¬vì¢6ñvÊ¬Êví¬7˜'C¢6ñvÊ¬Á7˜'B”∞¢ñbÜó5vˆ÷V‰÷F6Çá6ñt÷F6Çíí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑6ñvÊ¬÷Ê˜Fñgï“&∆˜\:í(	B÷F6Çl:ñ÷ñÊñ‚Ü∆ó7FRÊˆó&Rì¢G∑6ñvÊ¬ÊÜˆ÷W“g2G∑6ñvÊ¬Êvó÷ì∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢&÷F6Çl:ñ÷ñÊñ‚WÜ6«R"¬&∆ˆ6∂VC¢'vˆ÷V‚"“ì∞¢–¢ñbá6ñvÊ¬Á7˜'B””“$fˆ˜F&∆¬"bbó4WÜ6«VFVDg&ˆ’ñ6∑2á6ñt÷F6Çíí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑6ñvÊ¬÷Ê˜Fñgï“&∆˜\:í(	B∆ñwVRF˜WFWW6R˜RV∆ñbTTdÜ∆ó7FRÊˆó&Rì¢G∑6ñvÊ¬Ê6ˆ◊WFóFñˆ‚«¬"'÷ì∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢&∆ñwVRF˜WFWW6RWÜ6«VR"¬&∆ˆ6∂VC¢&∆˜u˜G'W7B"“ì∞¢–¢ñbÇ%$UdıÙïÙ¥Uíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$%$UdıÙïÙ¥UíÊˆ‚6ˆÊfñwW,:í"¬6VÁC¢“ì∞†¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜w2“6ˆFW4F"Á&W&RÄ¢%4TƒT5BV÷ñ¬e$Ù“6ˆFW2tÑU$R7FófR“‰B∆‚î‚Çw&V÷óV“r¬vV∆óFRr¬wfórí‰BV÷ñ¬ï2‰ıBÂTƒ¬‰BV÷ñ¬“rr ¢íÊ∆¬Çì∞¢6ˆFW4F"Ê6∆˜6RÇì∞†¢6ˆÁ7B7˜'Dñ6ˆÁ2“≤fˆ˜F&∆√¢.)´“"¬&6∂WF&∆√¢/	¯¯"¬Üˆ6∂Wì¢/	¯˘""¬&6V&∆√¢.)´‚"¬'Vv'ì¢/	¯¯í"¬ÜÊF&∆√¢/	˙K‚"¬fˆ∆∆Wñ&∆√¢/	¯˘"”∞¢6ˆÁ7B7˜'Dñ6ˆ‚“7˜'Dñ6ˆÁ5∑6ñvÊ¬Á7˜'E“«¬/	¯ÍÚ#∞¢6ˆÁ7B6ˆÊb“6ñvÊ¬Ê6ˆÊfñFVÊ6R«¬#Ú#∞¢6ˆÁ7B6ˆÊd6ˆ∆˜"“6ˆÊb„“ÉRÚ"3#ìÉ"¢6ˆÊb„“ÉÚ"6cSñS""¢"3c3cfc#∞¢6ˆÁ7B∆ˆvÙáF÷¬“6ñvÊ¬ÊÜˆ÷Uˆ∆ˆvÚÚ∆ñ÷r7&3“"G∑6ñvÊ¬ÊÜˆ÷Uˆ∆ˆv˜“"«C“""7Gñ∆S“'vñGFÉ£CÉ∂ÜVñváC£CÉ∂ˆ&¶V7B÷fóC¶6ˆÁFñ„∂&˜&FW"◊&FóW3£gÉ∑fW'Fñ6¬÷∆ñv„¶÷ñFF∆S∂÷&vñ‚◊&ñváC£áÇ#Ê¢"#∞†¢6ˆÁ7BáF÷ƒ6ˆÁFVÁB“ £∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3cÉc∑FFñÊs£3'Ç#GÉ∂fˆÁB÷f÷ñ«ì§ñÁFW"ƒ&ñ¬«6Á2◊6W&ñc∂÷Ç◊vñGFÉ£cÉ∂÷&vñ„£WFÚ#‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£#GÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#GÉ∂fˆÁB◊vVñváC£ì∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3c3cfc¬3v36VBì≤◊vV&∂óB÷&6∂w&˜VÊB÷6∆óßFWáC≤◊vV&∂óB◊FWáB÷fñ∆¬÷6ˆ∆˜#ßG&Á7&VÁC∂Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≤#ÂF˜W4∆W4÷F6á3¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂∆WGFW"◊76ñÊs¢„V”∑FWáB◊G&Á6f˜&”ßWW&66S∂÷&vñ‚◊F˜£GÇ#‰ƒU%DR4ît‰¬dı%B(	B4ÙÂ4Tî¬î¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3C#∂&˜&FW#£Ç6ˆ∆ñB&v&Éb√ÉR√#í¬„2ì∂&˜&FW"◊&FóW3£gÉ∑FFñÊs£#GÉ∂÷&vñ‚÷&˜GFˆ”£#Ç#‡¢∆Fób7Gñ∆S“&Fó7∆ì¶f∆WÉ∂∆ñv‚÷óFV◊3¶6VÁFW#∂v£áÉ∂÷&vñ‚÷&˜GFˆ”£GÇ#‡¢«7‚7Gñ∆S“&fˆÁB◊6ó¶S£#áÇ#‚G∑7˜'Dñ6ˆÁ”¬˜7„‡¢∆Fóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂fˆÁB◊vVñváC£s∂∆WGFW"◊76ñÊs¢„V”∑FWáB◊G&Á6f˜&”ßWW&66S∂6ˆ∆˜#¢3#ìÉ#Ô	˘™Ç6ñvÊ¬f˜'BL:óFV7L:ì¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&#‚G∑6ñvÊ¬Ê6ˆ◊WFóFñˆ‚«¬6ñvÊ¬Á7˜'B«¬"'”¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&÷&vñ‚÷∆VgC¶WFÛ∂&6∂w&˜VÊC¢G∂6ˆÊd6ˆ∆˜'”É∂&˜&FW#£Ç6ˆ∆ñBG∂6ˆÊd6ˆ∆˜'”∂&˜&FW"◊&FóW3£É∑FFñÊs£GÇ'É∂fˆÁB◊6ó¶S£GÉ∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢G∂6ˆÊd6ˆ∆˜'“#‚G∂6ˆÊg“Û¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#É∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢6V6VcC∂÷&vñ‚÷&˜GFˆ”£gÇ#‚G∂∆ˆvÙáF÷«“G∑6ñvÊ¬ÊÜˆ÷W“g2G∑6ñvÊ¬Êvó”¬ˆFóc‡¢G∑6ñvÊ¬Ê÷ñÁWFRÚ∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢3#&C6VS∂÷&vñ‚÷&˜GFˆ”£'Ç#Ó(˚G∑6ñvÊ¬Ê÷ñÁWFW“rV‚6˜W'2G∑6ñvÊ¬Á66˜&UˆÜˆ÷R“ÁV∆¬Ú"+r66˜&R¢"≤6ñvÊ¬Á66˜&UˆÜˆ÷R≤"“"≤6ñvÊ¬Á66˜&Uˆví¢"'”¬ˆFócÊ¢"'–¢∆Fób7Gñ∆S“&&6∂w&˜VÊCß&v&Ésí√s√##í¬„"ì∂&˜&FW#£Ç6ˆ∆ñB&v&Ésí√s√##í¬„#Rì∂&˜&FW"◊&FóW3£É∑FFñÊs£GÉ∂÷&vñ‚÷&˜GFˆ”£gÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢6ÜV3É∂÷&vñ‚÷&˜GFˆ”£GÇ#Â6ñvÊ¬6ˆÊ6ñ∆S¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£áÉ∂fˆÁB◊vVñváC£É∂6ˆ∆˜#¢6V6VcB#‚G∑6ñvÊ¬Ê&WB«¬"'”¬ˆFóc‡¢G∑6ñvÊ¬Á&V6ˆ‚Ú∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢6ÜV3É∂÷&vñ‚◊F˜£áÉ∂fˆÁB◊7Gñ∆S¶óF∆ñ3∂&˜&FW"÷∆VgC£'Ç6ˆ∆ñB&v&Éìí√"√#C¬„Bì∑FFñÊr÷∆VgC£Ç#‚G∑6ñvÊ¬Á&V6ˆÁ”¬ˆFócÊ¢"'–¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW"#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“ˆ∆ófR÷ñ"7Gñ∆S“&Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≥∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3#ìÉ¬3Sìccíì∂6ˆ∆˜#¢6ffc∑FFñÊs£'Ç#áÉ∂&˜&FW"◊&FóW3£É∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊS∂fˆÁB◊vVñváC£s∂fˆÁB◊6ó¶S£GÇ#Âfˆó"¬vÊ«ó6R∆ófRî(i#¬ˆ‡¢¬ˆFóc‡¢¬ˆFóc‡¢G∂&ˆˆ∂÷∂W$V÷ñƒáF÷¬Çó–¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂∆ñÊR÷ÜVñváC£„b#‡¢F˜W4∆W4÷F6á2(	B6ñvÊ¬WFˆ÷FóVR6ˆÁ6Vñ¬î∆'#‡¢)™˚àÚÊ«ó6W27˜'FófW2,:ó6W'l:ñW2WÇ≥ÇÁ2‚¶WR&W7ˆÁ6&∆R‚6˜FW2:l:ó&ñfñW"7W"∆W2∆FVf˜&÷W2‡¢¬ˆFóc‡£¬ˆFócÊ∞†¢∆WB6VÁB“∞¢6ˆÁ7BV÷ñ«2“≤‚‚ÊÊWr6WBá&˜w2Ê÷á"”‚"ÊV÷ñ¬íÊfñ«FW"Ñ&ˆˆ∆V‚íï”∞¢f˜"Ü6ˆÁ7BV÷ñ¬ˆbV÷ñ«2í∞¢G'í∞¢vóB'&Wfı6VÊDV÷ñ¬ÜV÷ñ¬¬	˘™Ç6ñvÊ¬f˜'BG∂6ˆÊg“Û(	BG∑6ñvÊ¬ÊÜˆ÷W“g2G∑6ñvÊ¬Êvó“ÇG∑6ñvÊ¬Á7˜'B«¬%7˜'B'“ñ¬áF÷ƒ6ˆÁFVÁBì∞¢6VÁB≤≥∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ü∑6ñvÊ¬÷Ê˜Fñgï“V÷ñ¬FÚG∂V÷ñ«”¶¬RÊ÷W76vRì∞¢–¢–¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑6ñvÊ¬÷Ê˜Fñgï“V÷ñ«26ñvÊ¬f˜'BVÁf˜ú:ó2¢G∑6VÁG“ÚG∂V÷ñ«2Ê∆VÊwFá÷ì∞†¢ÚÚV÷ñ¬FV6W"WÇñÁ67&óG2u$ETïE2á6Á2∆R&í¬fV25D&ˆÊÊV÷VÁBê¢G'í∞¢6ˆÁ7B∆VE&˜w2“∆ˆD∆VG2ÇíÊ∆VG2«¬µ”∞¢6ˆÁ7B&V÷óV‘V÷ñ«2“ÊWr6WBÜV÷ñ«2Ê÷ÜR”‚RÁFÙ∆˜vW$66RÇííì∞¢6ˆÁ7Bg&VTV÷ñ«2“≤‚‚ÊÊWr6WBÜ∆VE&˜w2Ê÷Ü¬”‚¬ÊV÷ñ¬íÊfñ«FW"ÜR”‚Rbb&V÷óV‘V÷ñ«2ÊÜ2ÜRÁFÙ∆˜vW$66RÇíííï”∞¢ñbÜg&VTV÷ñ«2Ê∆VÊwFÇ‚í∞¢6ˆÁ7BFV6W$áF÷¬“ £∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3cÉc∑FFñÊs£3'Ç#GÉ∂fˆÁB÷f÷ñ«ì§ñÁFW"ƒ&ñ¬«6Á2◊6W&ñc∂÷Ç◊vñGFÉ£cÉ∂÷&vñ„£WFÚ#‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£#GÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#GÉ∂fˆÁB◊vVñváC£ì∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3c3cfc¬3v36VBì≤◊vV&∂óB÷&6∂w&˜VÊB÷6∆óßFWáC≤◊vV&∂óB◊FWáB÷fñ∆¬÷6ˆ∆˜#ßG&Á7&VÁC∂Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≤#ÂF˜W4∆W4÷F6á3¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂∆WGFW"◊76ñÊs¢„V”∑FWáB◊G&Á6f˜&”ßWW&66S∂÷&vñ‚◊F˜£GÇ#‰ƒU%DR4ît‰¬dı%C¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3C#∂&˜&FW#£Ç6ˆ∆ñB&v&Éìí√"√#C¬„2ì∂&˜&FW"◊&FóW3£gÉ∑FFñÊs£#GÉ∂÷&vñ‚÷&˜GFˆ”£#Ç#‡¢∆Fób7Gñ∆S“&Fó7∆ì¶f∆WÉ∂∆ñv‚÷óFV◊3¶6VÁFW#∂v£áÉ∂÷&vñ‚÷&˜GFˆ”£GÇ#‡¢«7‚7Gñ∆S“&fˆÁB◊6ó¶S£#áÇ#‚G∑7˜'Dñ6ˆÁ”¬˜7„‡¢∆Fóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂fˆÁB◊vVñváC£s∂∆WGFW"◊76ñÊs¢„V”∑FWáB◊G&Á6f˜&”ßWW&66S∂6ˆ∆˜#¢6cSñS"#Ô	˘™Ç6ñvÊ¬f˜'BL:óFV7L:ì¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&#‚G∑6ñvÊ¬Ê6ˆ◊WFóFñˆ‚«¬6ñvÊ¬Á7˜'B«¬"'”¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&÷&vñ‚÷∆VgC¶WFÛ∂&6∂w&˜VÊC¢G∂6ˆÊd6ˆ∆˜'”É∂&˜&FW#£Ç6ˆ∆ñBG∂6ˆÊd6ˆ∆˜'”∂&˜&FW"◊&FóW3£É∑FFñÊs£GÇ'É∂fˆÁB◊6ó¶S£GÉ∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢G∂6ˆÊd6ˆ∆˜'“#‚G∂6ˆÊg“Û¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#É∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢6V6VcC∂÷&vñ‚÷&˜GFˆ”£gÇ#‚G∂∆ˆvÙáF÷«“G∑6ñvÊ¬ÊÜˆ÷W“g2G∑6ñvÊ¬Êvó”¬ˆFóc‡¢G∑6ñvÊ¬Ê÷ñÁWFRÚ∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢3#&C6VS∂÷&vñ‚÷&˜GFˆ”£'Ç#Ó(˚G∑6ñvÊ¬Ê÷ñÁWFW“rV‚6˜W'3¬ˆFócÊ¢"'–¢∆Fób7Gñ∆S“&&6∂w&˜VÊCß&v&Ésí√s√##í¬„"ì∂&˜&FW#£Ç6ˆ∆ñB&v&Ésí√s√##í¬„#Rì∂&˜&FW"◊&FóW3£É∑FFñÊs£gÉ∑FWáB÷∆ñv„¶6VÁFW"#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£GÉ∂6ˆ∆˜#¢6ÜV3É∂÷&vñ‚÷&˜GFˆ”£áÇ#‰∆R6ˆÁ6Vñ¬îñFVÁFñfú:íVÊRÊ«ó6R:«7G&ˆÊr7Gñ∆S“&6ˆ∆˜#¢6V6VcB#‚G∂6ˆÊg“ÛFR66˜&RFR6ˆÊfñÊ6S¬˜7G&ˆÊs„¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£gÉ∂fˆÁB◊vVñváC£É∂6ˆ∆˜#¢3c3cfc#Ô	˘I"Ê«ó6R,:ó6W'l:ñRWÇ&ˆÊÏ:ó3¬ˆFóc‡¢¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£gÇ#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2"7Gñ∆S“&Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≥∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3FcCfSR¬3v36VBì∂6ˆ∆˜#¢6ffc∑FFñÊs£GÇ3'É∂&˜&FW"◊&FóW3£É∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊS∂fˆÁB◊vVñváC£s∂fˆÁB◊6ó¶S£WÉ∂&˜Ç◊6ÜF˜s£GÇ#Ç&v&Ésí√s√##í¬„Bí#‰L:ñ&∆˜VW"¬vÊ«ó6R(	BB„ì(*¬ˆ÷ˆó2(i#¬ˆ‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£#Ç#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2"7Gñ∆S“&6ˆ∆˜#¢3c3cfc∂fˆÁB◊6ó¶S£7É∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#Âfˆó"∆W2ˆfg&W3¬ˆ‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂fˆÁB◊6ó¶S£É∂6ˆ∆˜#¢3v#É&∂∆ñÊR÷ÜVñváC£„b#‡¢F˜W4∆W4÷F6á2(	B6ñvÊ¬WFˆ÷FóVR6ˆÁ6Vñ¬î∆'#‡¢)™˚àÚÇ≤+r¶WR&W7ˆÁ6&∆R+r∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“ˆ÷VÁFñˆÁ2÷∆Vv∆W2ÊáF÷¬"7Gñ∆S“&6ˆ∆˜#¢3c3cfc∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊR#Â6RL:ó6&ˆÊÊW#¬ˆ‡¢¬ˆFóc‡£¬ˆFócÊ∞¢∆WBg&VU6VÁB“∞¢f˜"Ü6ˆÁ7BfRˆbg&VTV÷ñ«2Á6∆ñ6RÉ¬#íí∞¢G'í∞¢vóB'&Wfı6VÊDV÷ñ¬ÜfR¬	˘™Ç6ñvÊ¬f˜'BG∂6ˆÊg“ÛL:óFV7L:í(	BG∑6ñvÊ¬ÊÜˆ÷W“g2G∑6ñvÊ¬Êvó÷¬FV6W$áF÷¬ì∞¢g&VU6VÁB≤≥∞¢“6F6ÇÖÚí∑–¢–¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑6ñvÊ¬÷Ê˜Fñgï“FV6W"g&VRVÁf˜ú:ó2¢G∂g&VU6VÁG“ÚG∂g&VTV÷ñ«2Ê∆VÊwFá÷ì∞¢–¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∑6ñvÊ¬÷Ê˜Fñgï“g&VRFV6W#¢"¬RÊ÷W76vRì≤–†¢6ˆÁ7B7˜'Dñ6ˆÁ3"“≤fˆ˜F&∆√¢.)´“"¬&6∂WF&∆√¢/	¯¯"¬Üˆ6∂Wì¢/	¯˘""¬&6V&∆√¢.)´‚"¬'Vv'ì¢/	¯¯í"”∞¢6ˆÁ7BFtñ6ˆ‚“7˜'Dñ6ˆÁ3%∑6ñvÊ¬Á7˜'E“«¬/	¯ÍÚ#∞¢ÚÚ&∆ˆ2Êv∆ó26ˆ◊7B¢ˆ‚ÊR&WWFR2∆W2Êˆ◊2BvWVóW2¬∆R66˜&RÊí∆¢ÚÚ6ˆ◊WFóFñˆ‚ÜFV¶VÊófW'6V«2VV«VW2∆ñvÊW2«W2ÜWBí(	BVÊóVV÷VÁB6P¢ÚÚRwV‚Êˆ‚÷g&Ê6˜ÜˆÊRÊRWWB2FWfñÊW"¢∆RGóRBvÊ«ó6RWB∆¢ÚÚ÷VÁFñˆ‚∆Vv∆R‚÷W76vR„b∆ñvÊW2«W2∆ˆÊr¬2FWWÇfˆó2«W2∆ˆÊr‡¢6ˆÁ7BVÂ&V÷óV““∆Â∆Ô	¯zœ	¯zríÊ«ó6ó3¢∆#‚G∂&WD∆&VƒV‚á6ñvÊ¬Ê&WBó”¬ˆ#Â∆Ô	˘8¢6ˆÊfñFVÊ6S¢∆#‚G∂6ˆÊg“Û¬ˆ#Â∆Ó)™˚àÚÇ≤(	B&W7ˆÁ6ñ&∆Rv÷ñÊv∞¢6ˆÁ7BV‰g&VR“∆Â∆Ô	¯zœ	¯zrFÜRWÜ7B6V∆V7Fñˆ‚ÊBgV∆¬Ê«ó6ó2&R&W6W'fVBf˜"&V÷óV“ÙV∆óFR7V'67&ñ&W'2Â∆Ó)™˚àÚÇ≤(	B&W7ˆÁ6ñ&∆Rv÷ñÊv∞¢6ˆÁ7BFu&V÷óV’FWáB“	˘™Ç∆#Â4ît‰¬dı%B(	BG∂6ˆÊg“Û¬ˆ#Â∆Â∆‚G∑Ftñ6ˆÁ“∆#‚G∑6ñvÊ¬ÊÜˆ÷W“g2G∑6ñvÊ¬Êvó”¬ˆ#Â∆Ô	¯¯bG∑6ñvÊ¬Ê6ˆ◊WFóFñˆ‚«¬6ñvÊ¬Á7˜'B«¬"'’∆‚G∑6ñvÊ¬Ê÷ñÁWFRÚ(˚G∑6ñvÊ¬Ê÷ñÁWFW“r+r66˜&R¢G∑6ñvÊ¬Á66˜&UˆÜˆ÷RÛÚ#Ú'““G∑6ñvÊ¬Á66˜&UˆvíÛÚ#Ú'÷¢"'’∆Â∆Ô	˘*Ê«ó6Rî¢∆#‚G∑6ñvÊ¬Ê&WB«¬"'”¬ˆ#Â∆Ô	˘8¢66˜&RFR6ˆÊfñÊ6R¢∆#‚G∂6ˆÊg“Û¬ˆ#Â∆‚G∑6ñvÊ¬Á&V6ˆ‚Ú∆„∆ì‚Gµ7G&ñÊrá6ñvÊ¬Á&V6ˆ‚íÁ6∆ñ6RÉ¬#ó”¬ˆìÊ¢"'’∆Â∆Ó)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H∆Ó)™˚àÚÇ≤(	B¶WR&W7ˆÁ6&∆RG∂VÂ&V÷óV◊÷∞¢6ˆÁ7BFtg&VUFWáB“	˘™Ç∆#Â4ît‰¬dı%BL8ïDT5L8í(	BG∂6ˆÊg“Û¬ˆ#Â∆Â∆‚G∑Ftñ6ˆÁ“∆#‚G∑6ñvÊ¬ÊÜˆ÷W“g2G∑6ñvÊ¬Êvó”¬ˆ#Â∆Ô	¯¯bG∑6ñvÊ¬Ê6ˆ◊WFóFñˆ‚«¬6ñvÊ¬Á7˜'B«¬"'’∆‚G∑6ñvÊ¬Ê÷ñÁWFRÚ(˚G∑6ñvÊ¬Ê÷ñÁWFW“r+r66˜&R¢G∑6ñvÊ¬Á66˜&UˆÜˆ÷RÛÚ#Ú'““G∑6ñvÊ¬Á66˜&UˆvíÛÚ#Ú'÷¢"'’∆Â∆Ô	˘I"∆#‰∆<:ñ∆V7Fñˆ‚WÜ7FRWB¬vÊ«ó6R6ˆ◊Ã:áFR6ˆÁB,:ó6W'l:ñW2WÇ&ˆÊÏ:ó2&V÷óV“ÙV∆óFR„¬ˆ#Â∆Â∆Ô	˘í∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“Ú7∆Á2#„∆#Â2v&ˆÊÊW":7FÊF&B(	BB√ì(*¬ˆ÷ˆó3¬ˆ#„¬ˆÂ∆Â∆Ó)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H∆Ó)™˚àÚÇ≤(	B¶WR&W7ˆÁ6&∆RG∂V‰g&VW÷∞¢ÚÚ6ñvÊ¬FRÊófVR&V÷óV“¢&V÷óV“WBV∆óFR∆R&\:vˆófVÁBF˜V¶˜W'2Ü÷ˆL:Ü∆P¢ÚÚñ÷'&ó\:íí¬7FÊF&BVÊóVV÷VÁB2vñ¬GFVñÁB6ˆ‚6WVñ¬«W2WÜñvVÁB‡¢vóB6VÊEFıñD6ÜÊÊV«2áFu&V÷óV’FWáB¬≤Fs¢'6ñvÊ¬÷Ê˜Fñgí"¬ñÊ6«VFU7FÊF&C¢ÑÁV÷&W"Ü6ˆÊbí«¬í„“5D‰D$EÙ‘îÂÙ4Ù‰b“ì∞¢ñbÖDTƒTu$’Ù4Ñ‰‰T≈ÙîBí∞¢6ˆÁ7Bˆ≤“vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’Ù4Ñ‰‰T≈ÙîB¬Ftg&VUFWáBì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑6ñvÊ¬÷Ê˜Fñgï“FV∆Vw&“g&VS¢G∂ˆ≤Ú$Ù≤"¢$dî¬'÷ì∞¢–†¢ÚÚ8óñÊv∆W"∆R6ñvÊ¬ì÷ñ‚7W"∆ófRî˜W"VR∆R∆ñV‚FV∆Vw&“‹:ÜÊRR&ˆ‚÷F6Ä¢FEñÊÊVE6ñvÊ¬á∞¢ñC¢6ñvÊ¬ÊñB«¬G∑6ñvÊ¬ÊÜˆ÷W’ÚG∑6ñvÊ¬Êvó’ÚG¥FFRÊÊ˜rÇó÷¿¢Üˆ÷S¢6ñvÊ¬ÊÜˆ÷R¬vì¢6ñvÊ¬Êví¿¢6ˆ◊WFóFñˆ„¢6ñvÊ¬Ê6ˆ◊WFóFñˆ‚«¬6ñvÊ¬Á7˜'B«¬""¿¢7˜'C¢6ñvÊ¬Á7˜'B«¬$fˆ˜F&∆¬"¿¢÷ñÁWFS¢6ñvÊ¬Ê÷ñÁWFR¿¢66˜&UˆÜˆ÷S¢6ñvÊ¬Á66˜&UˆÜˆ÷R¿¢66˜&Uˆvì¢6ñvÊ¬Á66˜&Uˆví¿¢Üˆ÷Uˆ∆ˆvÛ¢6ñvÊ¬ÊÜˆ÷Uˆ∆ˆvÚ«¬ÁV∆¬¿¢vïˆ∆ˆvÛ¢6ñvÊ¬Êvïˆ∆ˆvÚ«¬ÁV∆¬¿¢&WC¢6ñvÊ¬Ê&WB¿¢6ˆÊfñFVÊ6S¢6ñvÊ¬Ê6ˆÊfñFVÊ6R¿¢&V6ˆ„¢6ñvÊ¬Á&V6ˆ‚¿¢“ì∞†¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6VÁB¬F˜F√¢V÷ñ«2Ê∆VÊwFÇ“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑6ñvÊ¬÷Ê˜Fñgï“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR¬6VÁC¢“ì∞¢–ß“ì∞†¢ÚÚ)H)H&WWfW2(	BtUBV&∆ñ2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶Á˜7BÇ"ˆñÁFW&Ê¬˜ñ6≤◊&W7V«B÷Ê˜Fñgí"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤ñ6≤¬6V7&WB““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$f˜&&ñFFV‚"“ì∞¢–¢ñbÇñ6≤«¬ñ6≤ÊÜˆ÷Rí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢'ñ6≤÷ÁVÁB"“ì∞¢6ˆÁ7BfñÊ≈66˜&R“vWDfñÊ≈66˜&Tg&ˆ’ñ6≤áñ6≤ì∞¢ñbÜfñÊ≈66˜&Rbbñ6≤ÊÜˆ÷Rbbñ6≤Êvíí∞¢WFı&W6ˆ«fU&VFñ7FñˆÁ2á∞¢Üˆ÷S¢ñ6≤ÊÜˆ÷R¿¢vì¢ñ6≤Êví¿¢66˜&UˆÜˆ÷S¢fñÊ≈66˜&RÁ66˜&UˆÜˆ÷R¿¢66˜&Uˆvì¢fñÊ≈66˜&RÁ66˜&Uˆví¿¢7FGW3¢$dî‰ï4ÑTB"¿¢“ì∞¢–¢ñbÇ%$UdıÙïÙ¥Uíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$%$UdıÙïÙ¥UíÊˆ‚6ˆÊfñwW,:í"¬6VÁC¢“ì∞†¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B&˜w2“6ˆFW4F"Á&W&RÄ¢%4TƒT5BV÷ñ¬e$Ù“6ˆFW2tÑU$R7FófR“‰B∆‚“vg&VRr‰BV÷ñ¬ï2‰ıBÂTƒ¬‰BV÷ñ¬“rr ¢íÊ∆¬Çì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢6ˆÁ7B∆VE&˜w2“∆ˆD∆VG2ÇíÊ∆VG2«¬µ”∞†¢6ˆÁ7Bvˆ‚“ñ6≤Á7FGW2””“$tt‰R"«¬ñ6≤Á7FGW2””“'vñ‚#∞¢6ˆÁ7BFóF∆R“vˆ‚Ú%ñ6≤vvÊÁB"¢%,:ó7V«FBGRñ6≤#∞¢6ˆÁ7B66˜&R“ñ6≤Á66˜&R«¬G∑ñ6≤Á66˜&UˆÜˆ÷RÛÚ#Ú'““G∑ñ6≤Á66˜&UˆvíÛÚ#Ú'÷∞¢6ˆÁ7BáF÷ƒ6ˆÁFVÁB“ £∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3cÉc∑FFñÊs£3'Ç#GÉ∂fˆÁB÷f÷ñ«ì§ñÁFW"ƒ&ñ¬«6Á2◊6W&ñc∂÷Ç◊vñGFÉ£cÉ∂÷&vñ„£WFÚ#‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW#∂÷&vñ‚÷&˜GFˆ”£#GÇ#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#GÉ∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢6V6VcB#ÂF˜W4∆W4÷F6á3¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£'É∂6ˆ∆˜#¢3v#É&∂÷&vñ‚◊F˜£GÇ#‚G∑FóF∆W”¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“&&6∂w&˜VÊC¢3C#∂&˜&FW#£Ç6ˆ∆ñBG∑vˆ‚Ú'&v&Éb√ÉR√#í¬„3Rí"¢'&v&Éìí√"√#C¬„#Rí'”∂&˜&FW"◊&FóW3£gÉ∑FFñÊs£#GÉ∂÷&vñ‚÷&˜GFˆ”£#Ç#‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#áÉ∂fˆÁB◊vVñváC£ì∂6ˆ∆˜#¢G∑vˆ‚Ú"3#ìÉ"¢"6V6VcB'”∂÷&vñ‚÷&˜GFˆ”£'Ç#‚G∑vˆ‚Ú$ttÏ8í"¢%DU$‘îÏ8í'”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£#É∂fˆÁB◊vVñváC£É∂6ˆ∆˜#¢6V6VcC∂÷&vñ‚÷&˜GFˆ”£áÇ#‚G∑ñ6≤ÊÜˆ÷W“g2G∑ñ6≤Êvó”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢6ÜV3É∂÷&vñ‚÷&˜GFˆ”£GÇ#Â66˜&RfñÊ¬¢«7G&ˆÊs‚G∑66˜&W”¬˜7G&ˆÊs„¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£WÉ∂6ˆ∆˜#¢6V6VcC∂÷&vñ‚÷&˜GFˆ”£áÇ#‚G∑ñ6≤Á&ˆÊÚ«¬ñ6≤Ê&WB«¬"'“G∑ñ6≤Ê6˜FR«¬"'”¬ˆFóc‡¢∆Fób7Gñ∆S“&fˆÁB◊6ó¶S£7É∂6ˆ∆˜#¢6ÜV3É∂∆ñÊR÷ÜVñváC£„b#‚G∑vˆ‚Ú$∆Rñ6≤ˆffñ6ñV¬GR¶˜W"W7Bf∆ñL:í‚"¢$∆Rñ6≤ˆffñ6ñV¬GR¶˜W"W7B6Ã;GGW,:í‚ˆ‚v&FR∆FˆÊÏ:ñR˜W"‹:ñ∆ñ˜&W"∆R÷ˆL:Ü∆R‚'”¬ˆFóc‡¢¬ˆFóc‡¢∆Fób7Gñ∆S“'FWáB÷∆ñv„¶6VÁFW"#‡¢∆á&Vc“&áGG3¢Ú˜wwrÁF˜W6∆W6÷F6á2Ê6ˆ“"7Gñ∆S“&Fó7∆ì¶ñÊ∆ñÊR÷&∆ˆ6≥∂&6∂w&˜VÊC¶∆ñÊV"÷w&FñVÁBÉ3VFVr¬3FcCfSR¬3v36VBì∂6ˆ∆˜#¢6ffc∑FFñÊs£7Ç#áÉ∂&˜&FW"◊&FóW3£É∑FWáB÷FV6˜&Fñˆ„¶ÊˆÊS∂fˆÁB◊vVñváC£s∂fˆÁB◊6ó¶S£GÇ#Âfˆó"F˜W4∆W4÷F6á3¬ˆ‡¢¬ˆFóc‡¢G∂&ˆˆ∂÷∂W$V÷ñƒáF÷¬Çó–£¬ˆFócÊ∞†¢∆WB6VÁB“∞¢6ˆÁ7BV÷ñ«2“≤‚‚ÊÊWr6WBÖ≤‚‚Á&˜w2Ê÷á"”‚"ÊV÷ñ¬í¬‚‚Ê∆VE&˜w2Ê÷Ü¬”‚¬ÊV÷ñ¬ï“Êfñ«FW"Ñ&ˆˆ∆V‚íï”∞¢f˜"Ü6ˆÁ7BV÷ñ¬ˆbV÷ñ«2í∞¢G'í∞¢vóB'&Wfı6VÊDV÷ñ¬ÜV÷ñ¬¬G∑vˆ‚Ú/	¯¯b"¢/	˘8¢'“G∑FóF∆W“(	BG∑ñ6≤ÊÜˆ÷W“g2G∑ñ6≤Êvó÷¬áF÷ƒ6ˆÁFVÁBì∞¢6VÁB≤≥∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ü∑ñ6≤◊&W7V«B÷Ê˜Fñgï“V÷ñ¬FÚG∂V÷ñ«”¶¬RÊ÷W76vRì∞¢–¢–¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑ñ6≤◊&W7V«B÷Ê˜Fñgï“V÷ñ«2VÁf˜ú:ó2¢G∑6VÁG“ÚG∂V÷ñ«2Ê∆VÊwFá÷ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6VÁB¬F˜F√¢V÷ñ«2Ê∆VÊwFÇ“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑ñ6≤◊&W7V«B÷Ê˜Fñgï“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR¬6VÁC¢“ì∞¢–ß“ì∞†¶Á˜7BÇ"ˆñÁFW&Ê¬˜&V6˜&B÷6ˆÊ6ñ∆R◊&W7V«B"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤&V6˜&B¬6V7&WB““&WÊ&ˆGí«¬∑”∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í∞¢&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$f˜&&ñFFV‚"“ì∞¢–¢ñbÇ&V6˜&B«¬&V6˜&BÊÜˆ÷R«¬&V6˜&BÊví«¬&V6˜&BÊ&WBí∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢&Üˆ÷R¬ví¬&WB&WVó2"“ì∞¢–¢6ˆÁ7B66˜&R“vWDfñÊ≈66˜&Tg&ˆ’ñ6≤á&V6˜&Bì∞¢ñbÇ66˜&Rí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢'66˜&RfñÊ¬&WVó2¬WÜV◊∆R”"“ì∞†¢6ˆÁ7BÇ“ÁV÷&W"á66˜&RÁ66˜&UˆÜˆ÷Rì∞¢6ˆÁ7B“ÁV÷&W"á66˜&RÁ66˜&Uˆvíì∞¢6ˆÁ7B˜WF6ˆ÷R“vWD&WD˜WF6ˆ÷Tf˜%66˜&Rá&V6˜&BÊ&WB¬Ç¬ì∞¢ñbÇ˜WF6ˆ÷Rí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢÷&6ÜRÊˆ‚&V6ˆÊÁS¢G∑&V6˜&BÊ&WG÷“ì∞†¢6ˆÁ7B6ˆÊfñFVÊ6R“÷FÇÊ÷ÇÉ¬÷FÇÊ÷ñ‚É¬ÁV÷&W"á&V6˜&BÊ6ˆÊfñFVÊ6RÛÚSRííì∞¢6ˆÁ7B÷ñÁWFR“&V6˜&BÊ÷ñÁWFR”“VÊFVfñÊVBbb&V6˜&BÊ÷ñÁWFR”“ÁV∆¬bb&V6˜&BÊ÷ñÁWFR”“" ¢ÚÁV÷&W"á&V6˜&BÊ÷ñÁWFRê¢¢ÁV∆√∞¢6ˆÁ7B÷F6Ñ∂Wí“÷ÁV≈ÚG∑&V6˜&BÊÜˆ÷W’ÚG∑&V6˜&BÊvó’ÚG∂vWEFˆFï7G"Çó’ÚG∑&V6˜&BÊ&WG’ÚG∂á““G∂÷Á&W∆6RÇı«2≤ˆr¬%Ú"ì∞¢6ˆÁ7BvVÁG2“∑≤Ê÷S¢&V6˜&BÊvVÁB«¬$6∆VFR6ÜñVb"¬&WC¢&V6˜&BÊ&WB¬6ˆÊfñFVÊ6R’”∞†¢G'í∞¢F"Á&W&RÜ ¢îÂ4U%Bı"ît‰ı$RîÂDÚ6ˆÊ6ñ∆UˆÊ«ó6W0¢Ü÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬÷ñÁWFUˆEˆÊ«ó6ó2¿¢66˜&UˆÜˆ÷UˆEˆÊ«ó6ó2¬66˜&UˆvïˆEˆÊ«ó6ó2¬7FG5˜7FGW2¿¢&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬&ó6ˆ‚¬6ˆÁ6VÁ7W5˜f˜FW2¬vVÁG5ˆß6ˆ‚¬ñ6µˆ&WB¬˜WF6ˆ÷Rê¢d≈TU2ÉÚ√Ú√Ú√Ú√Ú√Ú√Ú√Ú√Ú√Ú√Ú√Ú√Ú√Ú√Úê¢íÁ'V‚Ä¢÷F6Ñ∂Wí¿¢&V6˜&BÊÜˆ÷R¿¢&V6˜&BÊví¿¢&V6˜&BÊ6ˆ◊WFóFñˆ‚«¬&V6˜&BÊ∆VwVR«¬$÷ÁVV¬"¿¢ÁV÷&W"Êó4fñÊóFRÜ÷ñÁWFRíÚ÷ñÁWFR¢ÁV∆¬¿¢Ç¿¢¿¢&V6˜&BÁ7FG5˜7FGW2«¬&÷ÁV≈˜fW&ñfñVB"¿¢&V6˜&BÊ&WB¿¢6ˆÊfñFVÊ6R¿¢&V6˜&BÁ&V6ˆ‚«¬%&VFñ7Fñˆ‚fW&ñfñVR÷ÁVV∆∆V÷VÁB"F÷ñ‚‚"¿¢ÁV÷&W"á&V6˜&BÊ6ˆÁ6VÁ7W5˜f˜FW2«¬í¿¢•4Ù‚Á7G&ñÊvñgíÜvVÁG2í¿¢&V6˜&BÁñ6µˆ&WB«¬ÁV∆¬¿¢˜WF6ˆ÷P¢ì∞†¢F"Á&W&RÄ¢$îÂ4U%Bı"ît‰ı$RîÂDÚvVÁE˜&VFñ7FñˆÁ2Ü÷F6Öˆ∂Wí¬Üˆ÷R¬ví¬vVÁEˆÊ÷R¬&WB¬6ˆÊfñFVÊ6R¬˜WF6ˆ÷Ríd≈TU2ÉÚ√Ú√Ú√Ú√Ú√Ú√Úí ¢íÁ'V‚Ü÷F6Ñ∂Wí¬&V6˜&BÊÜˆ÷R¬&V6˜&BÊví¬&V6˜&BÊvVÁB«¬$6∆VFR6ÜñVb"¬&V6˜&BÊ&WB¬6ˆÊfñFVÊ6R¬˜WF6ˆ÷Rì∞†¢F"Á&W&RÜ ¢UDDR6ˆÊ6ñ∆UˆÊ«ó6W0¢4UBfñÊ≈˜66˜&UˆÜˆ÷R“Ú¿¢fñÊ≈˜66˜&Uˆví“Ú¿¢&W6ˆ«fVEˆB“FFWFñ÷RÇvÊ˜rrí¿¢&W7V«E˜6˜W&6R“¢tÑU$R÷F6Öˆ∂Wí“¢íÁ'V‚ÜÇ¬¬&÷ÁV≈˜fW&ñfñVB"¬÷F6Ñ∂Wíì∞†¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑&V6˜&B÷6ˆÊ6ñ∆R◊&W7V«E“G∑&V6˜&BÊÜˆ÷W“g2G∑&V6˜&BÊvó“G∑&V6˜&BÊ&WG“G∂á““G∂“”‚G∂˜WF6ˆ÷W÷ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬˜WF6ˆ÷R¬÷F6Öˆ∂Wì¢÷F6Ñ∂Wí“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑&V6˜&B÷6ˆÊ6ñ∆R◊&W7V«E“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¶ÊvWBÇ"˜&WWfW2"¬á&W¬&W2í”‚∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&ˆˆg3¢∆ˆE&ˆˆg2Çí“ì∞ß“ì∞†¢ÚÚ)H)H&WWfW2(	Bı5BF÷ñ‚W∆ˆB)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶Á˜7BÇ"ˆF÷ñ‚˜&WWfW2"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR¬&ˆˆb““&WÊ&ˆGí«¬∑”∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6<:á2F÷ñ‚&WVó2"“ì∞¢ñbÇ&ˆˆb«¬&ˆˆbÊFF«¬&ˆˆbÁFóF∆Rí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$FˆÊÏ:ñW2÷ÁVÁFW2ÜFF≤FóF∆R&WVó2í"“ì∞†¢6ˆÁ7B&ˆˆg2“∆ˆE&ˆˆg2Çì∞¢6ˆÁ7BÊWu&ˆˆb“∞¢ñC¢FFRÊÊ˜rÇí¿¢FóF∆S¢&ˆˆbÁFóF∆R¿¢FW67&óFñˆ„¢&ˆˆbÊFW67&óFñˆ‚«¬""¿¢FFS¢&ˆˆbÊFFR«¬ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬í¿¢FF¢&ˆˆbÊFF¬ÚÚ&6ScBFFU$ê¢FFVEˆC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢”∞¢&ˆˆg2ÁVÁ6ÜñgBÜÊWu&ˆˆbì∞¢6fU&ˆˆg2á&ˆˆg2ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬&ˆˆc¢≤‚‚ÊÊWu&ˆˆb¬FF¢%∂ˆ÷óGFVE“"““ì∞ß“ì∞†¢ÚÚ)H)H&WWfW2(	BDTƒUDRF÷ñ‚)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊFV∆WFRÇ"ˆF÷ñ‚˜&WWfW2Û¶ñB"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6<:á2F÷ñ‚&WVó2"“ì∞†¢6ˆÁ7BñB“'6TñÁBá&WÁ&◊2ÊñBì∞¢6ˆÁ7B&ˆˆg2“∆ˆE&ˆˆg2Çì∞¢6ˆÁ7BWFFVB“&ˆˆg2Êfñ«FW"á”‚ÊñB”“ñBì∞¢6fU&ˆˆg2áWFFVBì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬FV∆WFVC¢&ˆˆg2Ê∆VÊwFÇ“WFFVBÊ∆VÊwFÇ“ì∞ß“ì∞†¢ÚÚ)H)HÊ«óFñ72(	BG&6∂ñÊr&V6ˆ‚)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶6ˆÁ7BE$4¥î‰uÙtîb“'VffW"Êg&ˆ“Ç%#ƒtÙF∆Ñ$îÚÚ˜îÉT$Tƒ$Tî%$r"¬&&6ScB"ì∞†¶ÊvWBÇ"˜B"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7Bó“&WÊÜVFW'5≤'Ç÷f˜'v&FVB÷f˜"%“«¬&WÁ6ˆ6∂WBÁ&V÷˜FTFG&W72«¬"#∞¢6ˆÁ7BóÜ6Ç“7'óFÚÊ7&VFTÜ6ÇÇ'6Ü#Sb"íÁWFFRÜó≤'F∆“◊6«B"íÊFñvW7BÇ&ÜWÇ"íÁ6∆ñ6RÉ¬bì∞¢F"Á&W&RÜ ¢îÂ4U%BîÂDÚvU˜fñWw2ávR¬&VfW'&W"¬WF’˜6˜W&6R¬WF’ˆ÷VFóV“¬WF’ˆ6◊ñv‚¬óˆÜ6Ç¬W6W%ˆvVÁBê¢d≈TU2ÉÚ¬Ú¬Ú¬Ú¬Ú¬Ú¬Úê¢íÁ'V‚Ä¢7G&ñÊrá&WÁVW'íÁ«¬"Ú"íÁ6∆ñ6RÉ¬#í¿¢7G&ñÊrá&WÁVW'íÁ"«¬""íÁ6∆ñ6RÉ¬Sí¿¢7G&ñÊrá&WÁVW'íÁ2«¬""íÁ6∆ñ6RÉ¬í¿¢7G&ñÊrá&WÁVW'íÊ“«¬""íÁ6∆ñ6RÉ¬í¿¢7G&ñÊrá&WÁVW'íÊ2«¬""íÁ6∆ñ6RÉ¬í¿¢óÜ6Ç¿¢7G&ñÊrá&WÊÜVFW'5≤'W6W"÷vVÁB%“«¬""íÁ6∆ñ6RÉ¬3í¿¢ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑G&6∂ñÊu“W'&˜#¢"¬RÊ÷W76vRì∞¢–¢&W2Á6WBá≤$6ˆÁFVÁB’GóR#¢&ñ÷vRˆvñb"¬$66ÜR‘6ˆÁG&ˆ¬#¢&ÊÚ◊7F˜&R"“ì∞¢&W2Á6VÊBÖE$4¥î‰uÙtîbì∞ß“ì∞†¢ÚÚ)H)H∆ñV‚&ñÚFñµFˆ≤G&\:í(i"FV∆Vw&“w&GVóB)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚV‚∆ñV‚&áGG3¢Ú˜BÊ÷RÚ‚‚‚"÷ó2Fó&V7FV÷VÁBV‚&ñÚFñµFˆ≤‚vW7B§‘ï0¢ÚÚfó6ñ&∆RFÁ2vU˜fñWw2ÖFV∆Vw&“‚vW7B2Ê˜G&R6W'fWW"í‚6R&VFó&V7@¢ÚÚ76R"Ê˜W2Bv&˜&B¢ˆ‚G&6R∆R6∆ñ2áWF’˜6˜W&6S◊Fñ∑Fˆ≤¬˜c“˜W ¢ÚÚFó7FñÊwVW"6ÜVRfñFVÚíVó2ˆ‚&VÁfˆñRfW'2∆R6Ê¬w&GVóB‚6Á2:v¿¢ÚÚñ◊˜76ñ&∆RFR6fˆó"6íVÊRfñFVÚ&÷VÊRg&ñ÷VÁBGR÷ˆÊFR(	B6ˆÁ7FFR∆P¢ÚÚBÛÇÛ##b¢¶W&ÚG&fñ2FñµFˆ≤÷W7W&&∆R÷∆w&R∆RGVÊÊV¬6ˆÁ7G'Vó@¢ÚÚWF˜W"FRFñµFˆ≤¬fWFRBwV‚∆ñV‚G&:v&∆R÷WGG&RV‚&ñÚ‡¶6ˆÁ7BDTƒTu$’Ùe$TUÙîÂdïDUÙƒî‰≤“&áGG3¢Ú˜BÊ÷RÚ∑f‰óT∂s%¶ÜFƒ÷’ìÇ#∞¢ÚÚ∆ñV‚G&\:ívVÊW&óVR&WWFñ∆ó6R"F˜W2∆W26ÊWÇÖFñµFˆ≤¬FV∆Vw&“¿¢ÚÚ&VFFóB‚‚‚í(	B˜7&3“6Üˆó6óB∆6˜W&6RÜFVfWB'Fñ∑Fˆ≤"˜W"ÊR2676W ¢ÚÚ∆W2∆ñVÁ2FV¶V‚6ó&7V∆Fñˆ‚7W"∆&ñÚFñµFˆ≤í¬˜c“ñFVÁFñfñR∆¢ÚÚ6◊vÊRˆ∆R˜7B&V6ó2¬vñÁFW&ñWW"FR6WGFR6˜W&6R‡¶ÊvWBÇ"ˆvÚ˜Fñ∑Fˆ≤"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B7&2“7G&ñÊrá&WÁVW'íÁ7&2«¬'Fñ∑Fˆ≤"íÁFÙ∆˜vW$66RÇíÁ6∆ñ6RÉ¬Cì∞¢6ˆÁ7Bó“&WÊÜVFW'5≤'Ç÷f˜'v&FVB÷f˜"%“«¬&WÁ6ˆ6∂WBÁ&V÷˜FTFG&W72«¬"#∞¢6ˆÁ7BóÜ6Ç“7'óFÚÊ7&VFTÜ6ÇÇ'6Ü#Sb"íÁWFFRÜó≤'F∆“◊6«B"íÊFñvW7BÇ&ÜWÇ"íÁ6∆ñ6RÉ¬bì∞¢F"Á&W&RÜ ¢îÂ4U%BîÂDÚvU˜fñWw2ávR¬&VfW'&W"¬WF’˜6˜W&6R¬WF’ˆ÷VFóV“¬WF’ˆ6◊ñv‚¬óˆÜ6Ç¬W6W%ˆvVÁBê¢d≈TU2ÉÚ¬Ú¬Ú¬Ú¬Ú¬Ú¬Úê¢íÁ'V‚Ä¢"ˆvÚ˜Fñ∑Fˆ≤"¿¢G∑7&7’ˆ∆ñÊ∂¿¢7&2¿¢&6ˆ÷◊VÊóGïˆ∆ñÊ≤"¿¢7G&ñÊrá&WÁVW'íÁb«¬&&ñÚ"íÁ6∆ñ6RÉ¬í¿¢óÜ6Ç¿¢7G&ñÊrá&WÊÜVFW'5≤'W6W"÷vVÁB%“«¬""íÁ6∆ñ6RÉ¬3í¿¢ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑G&6∂ñÊu“ˆvÚ˜Fñ∑Fˆ≥¢"¬RÊ÷W76vRì∞¢–¢&W2Á&VFó&V7BÉ3"¬DTƒTu$’Ùe$TUÙîÂdïDUÙƒî‰≤ì∞ß“ì∞†¢ÚÚw&ñ∆∆RF&ñfó&R7GVV∆∆RÑ4ubGRBÛrÛ##bí(	B6˜W&6RVÊóVR&WWFñ∆ó6VP¢ÚÚ"∆R&˜'BV˜FñFñV‚UB¬vÜV&FÚ‚¬vÜV&FÚWFñ∆ó6óBßW7Rvñ6íFW2&óÄ¢ÚÚW&ñ÷W2Éí„ìÛí„ìR∆ñWRFRB„ìÛB„ìÛ#í„ì¬6∆R'7FÊF&B"'6VÁFRí†¢ÚÚ∆R4Ù’%"ffñ6ÜW2w&VrWFñVÁB6˜W2÷W7Fñ÷W2‚6ˆÁ7FFR∆˜'2FR∆¢ÚÚÜ6Rbá&˜'BV˜FñFñV‚VÁ&ñ6ÜííGRÛÇÛ##b‡¶6ˆÁ7BƒÂı$î4U2“≤7FÊF&C¢B„ì¬&V÷óV”¢B„ì¬fó¢#í„ì¬V∆óFS¢#í„ì”∞†¢ÚÚ)H)HÊ«óFñ72(	BFñ«ífó6óF˜"&W˜'BÉ#3£&ó2í)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶gVÊ7Fñˆ‚vWE&ó4Ü˜W"Çí∞¢&WGW&‚ÊWrFFRÇíÁFÙ∆ˆ6∆U7G&ñÊrÇ&V‚’U2"¬≤Fñ÷U¶ˆÊS¢$WW&˜Rı&ó2"¬Ü˜W#¢&ÁV÷W&ñ2"¬Ü˜W##¢f«6R“ì∞ß–†¶gVÊ7Fñˆ‚'Vñ∆DFñ«ïfó6óF˜%&W˜'BÇí∞¢6ˆÁ7BFˆFí“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BvR¬&VfW'&W"¬WF’˜6˜W&6R¬WF’ˆ÷VFóV“¬WF’ˆ6◊ñv‚¬óˆÜ6Ä¢e$Ù“vU˜fñWw0¢tÑU$RFFRÜ7&VFVEˆBí“¢íÊ∆¬áFˆFíì∞†¢6ˆÁ7BVÊóVUfó6óF˜'2“ÊWr6WBá&˜w2Ê÷á"”‚"ÊóˆÜ6ÇííÁ6ó¶S∞¢6ˆÁ7BF˜F≈fñWw2“&˜w2Ê∆VÊwFÉ∞†¢6ˆÁ7B'ïvR“∑”∞¢&˜w2Êf˜$V6Çá"”‚≤'ïvU∑"ÁvU““Ü'ïvU∑"ÁvU“«¬í≤≤“ì∞†¢6ˆÁ7B'ï6˜W&6R“∑”∞¢&˜w2Êf˜$V6Çá"”‚∞¢∆WB7&2“"ÁWF’˜6˜W&6R«¬&Fó&V7B#∞¢ñbÇ"ÁWF’˜6˜W&6Rbb"Á&VfW'&W"í∞¢G'í∞¢6ˆÁ7BÜ˜7B“ÊWrU$¬á"Á&VfW'&W"íÊÜ˜7FÊ÷RÁ&W∆6RÇ'wwr‚"¬""ì∞¢7&2“Ü˜7B«¬&Fó&V7B#∞¢“6F6Ç≤7&2“"Á&VfW'&W"Á6∆ñ6RÉ¬Cí«¬&Fó&V7B#≤–¢–¢'ï6˜W&6U∑7&5““Ü'ï6˜W&6U∑7&5“«¬ÊWr6WBÇííÊFBá"ÊóˆÜ6Çì∞¢“ì∞†¢6ˆÁ7B6˜W&6W4∆ñÊW2“ˆ&¶V7BÊVÁG&ñW2Ü'ï6˜W&6Rê¢Ê÷ÇÖ∑7&2¬ó5“í”‚á≤7&2¬6˜VÁC¢ó2Á6ó¶R“íê¢Á6˜'BÇÜ¬"í”‚"Ê6˜VÁB“Ê6˜VÁBê¢Á6∆ñ6RÉ¬ê¢Ê÷á2”‚G∑2Á7&7”¢G∑2Ê6˜VÁG“fó6óFWW"G∑2Ê6˜VÁB‚Ú'2"¢"'÷ê¢Ê¶ˆñ‚Ç%∆‚"ì∞†¢6ˆÁ7BvW4∆ñÊW2“ˆ&¶V7BÊVÁG&ñW2Ü'ïvRê¢Á6˜'BÇÜ¬"í”‚%≥““≥“ê¢Á6∆ñ6RÉ¬Rê¢Ê÷ÇÖ∑¬5“í”‚G∑”¢G∂7“gVW6ê¢Ê¶ˆñ‚Ç%∆‚"ì∞†¢ÚÚ)H)Hfˆ∆WB'W6ñÊW72ÖÜ6Rb¬ÛÇÛ##bí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ&W˜6RVÁFñW&V÷VÁB7W"FW2FˆÊÊVW2DT§6ˆ∆∆V7FVW2ñ∆∆WW'2ÜV7VÊRÊ˜WfV∆∆P¢ÚÚF&∆Rí¢6ñvÁW2FWVó2∆VG2Êß6ˆ‚¬6ˆÊÊWÜñˆÁ2FWVó2∆F&∆R6W76ñˆÁ0¢ÚÚÑıEí¬WfVÊV÷VÁG27G&óR&VV∆∆V÷VÁBG&óFW2FWVó27G&óU˜&ˆ6W76VEˆWfVÁG0¢ÚÚáVí6W'BFV¶FRfW'&˜RBvñFV◊˜FVÊ6RvV&Üˆˆ≤¬F˜V&∆RW6vRV‚¶˜W&Ê¬í¿¢ÚÚ&ˆÊÊW27Fñg2≤’%"FWVó26ˆFW2ÊF"‚∆W26∆ñ72&ˆˆ∂÷∂W'2WB∆W2gVW2FP¢ÚÚ∆6V7Fñˆ‚F&ñg2ÊR6ˆÁB2ñÊ6«W2¢V7VÊRñÁ7G'V÷VÁFFñˆ‚g&ˆÁFVÊBÊP¢ÚÚ∆W26GW&RV¶˜W&BváVíÜ∆RóÜV¬˜BÊR∆ˆwVRVRFW26Ü&vV÷VÁG2FRvP¢ÚÚVÁFñW'2í¬6R6W&óBV‚6ÜÁFñW"'B¬2ßW7FRVÊR∆V7GW&RFRFˆÊÊVW0¢ÚÚWÜó7FÁFW2‡¢∆WB6ñvÁW5FˆFí“∞¢G'í∞¢6ˆÁ7B∆VG4FF“∆ˆD∆VG2Çì∞¢6ñvÁW5FˆFí“∆VG4FFÊ∆VG2Êfñ«FW"Ü¬”‚Ü¬Ê7&VFVEˆB«¬""íÁ6∆ñ6RÉ¬í””“FˆFííÊ∆VÊwFÉ∞¢“6F6Ç∑–†¢∆WB∆ˆvñÁ5FˆFí“∞¢G'í∞¢∆ˆvñÁ5FˆFí“F"Á&W&RÇ%4TƒT5B4ıTÂBÑDï5Dî‰5BV÷ñ¬í2e$Ù“6W76ñˆÁ2tÑU$RFFRÜ7&VFVEˆBí“Ú"íÊvWBáFˆFíìÚÊ2«¬∞¢“6F6Ç∑–†¢∆WB7G&óT∆ñÊW2“"V7V‚:ól:ñÊV÷VÁB#∞¢G'í∞¢6ˆÁ7BWe&˜w2“F"Á&W&RÜ ¢4TƒT5BWfVÁE˜GóR¬4ıTÂBÇ¢í2e$Ù“7G&óU˜&ˆ6W76VEˆWfVÁG0¢tÑU$RFFRá&ˆ6W76VEˆBí“Úu$ıU%íWfVÁE˜GóRı$DU"%í2DU40¢íÊ∆¬áFˆFíì∞¢6ˆÁ7BWd∆&V«2“∞¢&6ÜV6∂˜WBÁ6W76ñˆ‚Ê6ˆ◊∆WFVB#¢$Ê˜WfVWÇñV÷VÁG2"¿¢&ñÁfˆñ6RÁñB#¢%&VÊ˜WfV∆∆V÷VÁG2"¿¢&ñÁfˆñ6RÁñ÷VÁEˆfñ∆VB#¢%ñV÷VÁG2&VgW<:ó2"¿¢&6Ü&vRÁ&VgVÊFVB#¢%&V÷&˜W'6V÷VÁG2"¿¢&7W7Fˆ÷W"Á7V'67&óFñˆ‚ÁWFFVB#¢$6ÜÊvV÷VÁG2FR∆ñW""¿¢&7W7Fˆ÷W"Á7V'67&óFñˆ‚ÊFV∆WFVB#¢%,:ó6ñ∆ñFñˆÁ2VffV7FófW2"¿¢”∞¢ñbÜWe&˜w2Ê∆VÊwFÇí∞¢7G&óT∆ñÊW2“We&˜w2Ê÷á"”‚G∂Wd∆&V«5∑"ÊWfVÁE˜GóU“«¬"ÊWfVÁE˜GóW”¢G∑"Ê7÷íÊ¶ˆñ‚Ç%∆‚"ì∞¢–¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Ê«óFñ75“7G&óRWfVÁG3¢"¬RÊ÷W76vRì≤–†¢∆WBFñW'4∆ñÊW2“"V7V‚&ˆÊÏ:í7Fñb#∞¢∆WB◊'"“∞¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢ÚÚ7G&óUˆ7W7Fˆ÷W%ˆñBï2‰ıBÂTƒ¬¢6WV¬V‚g&íñV÷VÁB7G&óRávV&Üˆˆ∞¢ÚÚ6ÜV6∂˜WBÁ6W76ñˆ‚Ê6ˆ◊∆WFVBí&VÁ6VñvÊR6R6Ü◊‚6Á26Rfñ«G&R¬∆W0¢ÚÚ6ˆFW2F÷ñ‚˜FW7Bˆf÷ñ∆∆RÑTƒïDR‘D‘î‚¢¬6ˆ◊FW2FRFW7BívˆÊf∆ñVÁB∆P¢ÚÚ’%"ffñ6ÜRw&Vr∆˜'2RvV7V‚BvWWÇ‚vW7BV‚6∆ñVÁB&VV¬(	B6ˆÁ7FFP¢ÚÚ∆RÛÇÛ##b¢∆W2b6ˆFW27Fñg2fñVÁBDıU27G&óUˆ7W7Fˆ÷W%ˆñC÷ÁV∆¬‡¢6ˆÁ7BFñW%&˜w2“6ˆFW4F"Á&W&RÜ ¢4TƒT5B∆‚¬4ıTÂBÇ¢í2e$Ù“6ˆFW0¢tÑU$R7FófR“‰B∆‚“vg&VRr‰B7G&óUˆ7W7Fˆ÷W%ˆñBï2‰ıBÂTƒ¿¢‰BÜWáó&W5ˆBï2ÂTƒ¬ı"Wáó&W5ˆB‚FFWFñ÷RÇvÊ˜rríê¢u$ıU%í∆‡¢íÊ∆¬Çì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢ñbáFñW%&˜w2Ê∆VÊwFÇí∞¢FñW'4∆ñÊW2“FñW%&˜w2Ê÷á"”‚∞¢6ˆÁ7B&ñ6R“ƒÂı$î4U5∑"Á∆Â“«¬∞¢◊'"≥“&ñ6R¢"Ê3∞¢&WGW&‚G∑"Á∆‚ÁFıWW$66RÇó”¢G∑"Ê7“ÇG≤á&ñ6R¢"Ê2íÁFÙfóÜVBÉ"óﬁ(*¬ñ∞¢“íÊ¶ˆñ‚Ç%∆‚"ì∞¢–¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Ê«óFñ75“FñW'2VW'ì¢"¬RÊ÷W76vRì≤–†¢&WGW&‚	˘8¢∆#Â$ı%Bdï4ïDUU%2(	BG∑FˆFó”¬ˆ#‡†Ø	˘R∆#Âfó6óFWW'2VÊóVW2£¬ˆ#‚G∑VÊóVUfó6óF˜'7–Ø	˘∆#ÂvW2gVW2£¬ˆ#‚G∑F˜F≈fñWw7–Ø	˘:r∆#‰Ê˜WfVWÇV÷ñ«26L:ó2£¬ˆ#‚G∑6ñvÁW5FˆFó–Ø	˘I∆#‰6ˆÊÊWÜñˆÁ2Ü6ˆ◊FW2Fó7FñÊ7G2í£¬ˆ#‚G∂∆ˆvñÁ5FˆFó–†Ø	˘Ir∆#Â6˜W&6W2£¬ˆ#‡¢G∑6˜W&6W4∆ñÊW2«¬"V7VÊRfó6óFR'–†Ø	˘8B∆#ÂvW2£¬ˆ#‡¢G∑vW4∆ñÊW2«¬"V7VÊRfó6óFR'–†Ø	˘+2∆#Ï8ól:ñÊV÷VÁG27G&óRGR¶˜W"£¬ˆ#‡¢G∑7G&óT∆ñÊW7–†Ø	˘∆#‰&ˆÊÏ:ó27Fñg2"∆ñW"£¬ˆ#‡¢G∑FñW'4∆ñÊW7–Ø	˘+∆#‰’%"7GVV¬£¬ˆ#‚G∂◊'"ÁFÙfóÜVBÉ"óﬁ(*¿†Æ)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)HØ	˙IbÜW&‹:á2Ê«óFñ72(	B&˜'BV˜FñFñVÊ∞ß–†¶gVÊ7Fñˆ‚6VÊDFñ«ïfó6óF˜%&W˜'BÇí∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí&WGW&„∞¢6ˆÁ7BFWáB“'Vñ∆DFñ«ïfó6óF˜%&W˜'BÇì∞¢6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬FWáBíÁFÜV‚Üˆ≤”‚∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂Ê«óFñ75“&˜'Bfó6óFWW'2V˜FñFñV„¢G∂ˆ≤Ú&VÁf˜ú:í"¢,:ñ6ÜV2'÷ì∞¢“ì∞ß–†¢ÚÚ)H)HÊ«óFñ72(	BvVV∂«í÷&∂WFñÊr&W˜'BÑ÷ˆÊFíÉ£&ó2í)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶7ñÊ2gVÊ7Fñˆ‚'Vñ∆EvVV∂«î÷&∂WFñÊu&W˜'BÇí∞¢6ˆÁ7BÊ˜r“ÊWrFFRÇì∞¢6ˆÁ7BvVV¥vÚ“ÊWrFFRÜÊ˜rÊvWEFñ÷RÇí“r¢ÉcCíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BFˆFí“Ê˜rÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞†¢ÚÚfó6óFWW'2FR∆6V÷ñÊP¢6ˆÁ7Bfó6óF˜'5&˜r“F"Á&W&RÜ ¢4TƒT5B4ıTÂBÑDï5Dî‰5BóˆÜ6Çí2fó6óF˜'2¬4ıTÂBÇ¢í2fñWw0¢e$Ù“vU˜fñWw2tÑU$RFFRÜ7&VFVEˆBí„“¢íÊvWBávVV¥vÚì∞†¢ÚÚfó6óFWW'2FñµFˆ∞¢6ˆÁ7BFñ∑Fˆµ&˜r“F"Á&W&RÜ ¢4TƒT5B4ıTÂBÑDï5Dî‰5BóˆÜ6Çí2fó6óF˜'0¢e$Ù“vU˜fñWw2tÑU$RFFRÜ7&VFVEˆBí„“Ú‰BáWF’˜6˜W&6Rƒî¥RrWFñ∑Fˆ≤Rrı"&VfW'&W"ƒî¥RrWFñ∑Fˆ≤Rrê¢íÊvWBávVV¥vÚì∞†¢ÚÚV÷ñ«2,:ñ7W:ó,:ó2Ü∆VG2Êß6ˆ‚ê¢∆WBÊWtV÷ñ«2“∞¢G'í∞¢6ˆÁ7B∆VG4FF“∆ˆD∆VG2Çì∞¢ÊWtV÷ñ«2“∆VG4FFÊ∆VG2Êfñ«FW"Ü¬”‚¬Ê7&VFVEˆBbb¬Ê7&VFVEˆB„“vVV¥vÚíÊ∆VÊwFÉ∞¢“6F6Ç∑–†¢ÚÚ&ˆÊÊV÷VÁG2WB4fñ∆D"6ˆFW0¢∆WBÊWu7V'2“∞¢∆WB&WfVÁVR“∞¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢ÚÚ7G&óUˆ7W7Fˆ÷W%ˆñBï2‰ıBÂTƒ¬¢fˆó"6ˆ÷÷VÁFó&RWVóf∆VÁB7W"∆P¢ÚÚ&˜'BV˜FñFñV‚ÉÛÇÛ##bí(	BWÜ6«WB∆W26ˆFW2F÷ñ‚˜FW7Bˆf÷ñ∆∆RGP¢ÚÚ4ffñ6ÜR‡¢6ˆÁ7B7V'2“6ˆFW4F"Á&W&RÜ ¢4TƒT5B∆‚¬4ıTÂBÇ¢í26ÁBe$Ù“6ˆFW0¢tÑU$R7FófR“‰B∆‚“vg&VRr‰B7G&óUˆ7W7Fˆ÷W%ˆñBï2‰ıBÂTƒ¬‰B7&VFVEˆB„“¢u$ıU%í∆‡¢íÊ∆¬ávVV¥vÚì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢7V'2Êf˜$V6Çá2”‚∞¢ÊWu7V'2≥“2Ê6ÁC∞¢&WfVÁVR≥“ÖƒÂı$î4U5∑2Á∆Â“«¬í¢2Ê6ÁC∞¢“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Ê«óFñ75“6ˆFW2VW'ì¢"¬RÊ÷W76vRì∞¢–†¢ÚÚFWÇFR6ˆÁfW'6ñˆ‡¢6ˆÁ7BF˜F≈fó6óF˜'2“fó6óF˜'5&˜sÚÁfó6óF˜'2«¬∞¢6ˆÁ7B6ˆÁfW'6ñˆ‰V÷ñ¬“F˜F≈fó6óF˜'2‚ÚÇÜÊWtV÷ñ«2ÚF˜F≈fó6óF˜'2í¢íÁFÙfóÜVBÉí¢#„#∞¢6ˆÁ7B6ˆÁfW'6ñˆÂñB“F˜F≈fó6óF˜'2‚ÚÇÜÊWu7V'2ÚF˜F≈fó6óF˜'2í¢íÁFÙfóÜVBÉí¢#„#∞†¢ÚÚ6˜W&6W2FR∆6V÷ñÊP¢6ˆÁ7B6˜W&6U&˜w2“F"Á&W&RÜ ¢4TƒT5@¢44P¢tÑT‚WF’˜6˜W&6Rƒî¥RrWFñ∑Fˆ≤Rrı"&VfW'&W"ƒî¥RrWFñ∑Fˆ≤RrDÑT‚uFñµFˆ≤p¢tÑT‚WF’˜6˜W&6Rƒî¥RrWFV∆Vw&“Rrı"&VfW'&W"ƒî¥RrWBÊ÷RRrDÑT‚uFV∆Vw&“p¢tÑT‚WF’˜6˜W&6Rƒî¥RrVvˆˆv∆RRrı"&VfW'&W"ƒî¥RrVvˆˆv∆RRrDÑT‚tvˆˆv∆Rp¢tÑT‚WF’˜6˜W&6Rƒî¥RrVñÁ7Fw&“Rrı"&VfW'&W"ƒî¥RrVñÁ7Fw&“RrDÑT‚tñÁ7Fw&“p¢tÑT‚WF’˜6˜W&6R“rrDÑT‚WF’˜6˜W&6P¢tÑT‚&VfW'&W"“rrDÑT‚&VfW'&W ¢T≈4RtFó&V7Bp¢T‰B26˜W&6R¿¢4ıTÂBÑDï5Dî‰5BóˆÜ6Çí2fó6óF˜'0¢e$Ù“vU˜fñWw2tÑU$RFFRÜ7&VFVEˆBí„“¢u$ıU%í6˜W&6Rı$DU"%ífó6óF˜'2DU42ƒî‘ïBÄ¢íÊ∆¬ávVV¥vÚì∞¢6ˆÁ7B6˜W&6W4∆ñÊW2“6˜W&6U&˜w2Ê÷á2”‚G∑2Á6˜W&6W”¢G∑2Áfó6óF˜'7÷íÊ¶ˆñ‚Ç%∆‚"ì∞†¢&WGW&‚	˘8Ç∆#Â$ı%B‘$¥UDî‰rÑT$DÛ¬ˆ#‡Ø	˘8RG∑vVV¥v˜“(i"G∑FˆFó–†Ø	˘;∆#Âfó6óFWW'2FñµFˆ≤£¬ˆ#‚G∑Fñ∑Fˆµ&˜sÚÁfó6óF˜'2«¬–Ø	˘R∆#Âfó6óFWW'2F˜FWÇ£¬ˆ#‚G∑F˜F≈fó6óF˜'7–Ø	˘:r∆#‰V÷ñ«2,:ñ7W:ó,:ó2£¬ˆ#‚G∂ÊWtV÷ñ«7–Ø	˘+2∆#‰&ˆÊÊV÷VÁG2£¬ˆ#‚G∂ÊWu7V'7–Ø	˘+b∆#‰4|:ñÏ:ó,:í£¬ˆ#‚G∑&WfVÁVRÁFÙfóÜVBÉ"ó“(*¿Ø	¯ÍÚ∆#‰6ˆÁfW'6ñˆ‚V÷ñ¬£¬ˆ#‚G∂6ˆÁfW'6ñˆ‰V÷ñ«“PØ	˘+∆#‰6ˆÁfW'6ñˆ‚ñÁB£¬ˆ#‚G∂6ˆÁfW'6ñˆÂñG“P†Ø	˘Ir∆#ÂF˜6˜W&6W2£¬ˆ#‡¢G∑6˜W&6W4∆ñÊW2«¬"V7VÊRFˆÊÏ:ñR'–†Æ)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)HØ	˙IbÜW&‹:á2Ê«óFñ72(	B&˜'BÜV&Fˆ÷Fó&V∞ß–†¶gVÊ7Fñˆ‚6VÊEvVV∂«î÷&∂WFñÊu&W˜'BÇí∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí&WGW&„∞¢'Vñ∆EvVV∂«î÷&∂WFñÊu&W˜'BÇíÁFÜV‚áFWáB”‚∞¢6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬FWáBíÁFÜV‚Üˆ≤”‚∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂Ê«óFñ75“&˜'B÷&∂WFñÊrÜV&FÛ¢G∂ˆ≤Ú&VÁf˜ú:í"¢,:ñ6ÜV2'÷ì∞¢“ì∞¢“ì∞ß–†¢ÚÚ)H)HÊ«óFñ7266ÜVGV∆W")H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶∆WBˆ∆7DFñ«ï&W˜'DFFR“"#∞¶∆WBˆ∆7EvVV∂«ï&W˜'DFFR“"#∞¶∆WBˆ∆7D&ñ∆‰FFR“"#∞¶∆WBˆ∆7DFñ«ïñ6µ6VVDFFR“"#∞¶∆WBˆ∆7Dvñ‰ñ÷vTFFR“"#∞†¢ÚÚv&ÁFóBV‚ñ6≤GR¶˜W"FL:íBtT§ıU$BtÖTíV‚∆ñvÊRR«W2F&BfW'0¢ÚÚFÇ”VÇGR÷Fñ‚ÜFV÷ÊFRFRw&Vr∆RÛÇÛ##bí‚¬vWFÚ÷6ˆÊ6ñ∆RÊP¢ÚÚG&fñ∆∆RVR7W"FW2÷F6á2L:ñ¨:T‚4ıU%2¢G,:á2L;GB∆R÷Fñ‚¬ñ¬‚wí¢ÚÚ6˜WfVÁBVÊ6˜&RV7VÊRÊ«ó6R∆ófRFL:ñRGR¶˜W"¬WB∆Rñ6≤GR¶˜W ¢ÚÚ&W7FóB∆˜'26V«VíFR∆fVñ∆∆RßW7R|:6RRwV‚÷F6ÇL:ñ÷'&RFÁ2∆¢ÚÚ¶˜W&Ï:ñR‚ˆ‚<:Ü÷RFˆÊ2¬6WV∆V÷VÁB6í&ñV‚‚vWÜó7FRVÊ6˜&R˜W"V¶˜W&BváVí¿¢ÚÚV‚ñ6≤:'Fó"GRˆˆ¬,:í÷÷F6ÇÉ$ÇÜL:ñ¨:fñ«G,:í∆ñwVW2fñ&∆W2∞¢ÚÚ6WVñ¬É"R¬‹:¶÷RóV∆ñÊRVR$÷F6á2:fVÊó""(	B¨:ó&Ú6¸;∑Bîí‡¶7ñÊ2gVÊ7Fñˆ‚6VVDFñ«ïñ6¥ñd÷ó76ñÊtf˜%FˆFíÇí∞¢6ˆÁ7BFˆFîï4Ú“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢G'í∞¢6ˆÁ7BˆF"“ÊWrFF&6RÑD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7BÜ5FˆFí“ˆF"Á&W&RÄ¢%4TƒT5Be$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RFFRÜÊ«ó6VEˆBí“Ú‰B6ˆÊfñFVÊ6R„“Úƒî‘ïB ¢íÊvWBáFˆFîï4Ú¬vWEV&∆ó6ÜVD÷ñ‰6ˆÊfñFVÊ6RÇíì∞¢ˆF"Ê6∆˜6RÇì∞¢ñbÜÜ5FˆFíí&WGW&„≤ÚÚV‚÷F6ÇGR¶˜W"WÜó7FRL:ñ¨:¬&ñV‚:6V÷W †¢6ˆÁ7BDî≈ïıî4µÙƒƒıtTEÙ$UE2“ÊWr6WBÖ≤%fñ7Fˆó&RFˆ÷ñ6ñ∆R"¬%fñ7Fˆó&RWáL:ó&ñWW""¬$%EE2˜Ví"¬$%EE2Êˆ‚"¬%VÊFW""„R'WG2%“ì∞¢6ˆÁ7BW6ˆ÷ñÊr“ÜvóB6ˆ◊WFUW6ˆ÷ñÊuñ6∑2ÇííÊFF∞¢6ˆÁ7B6VVF&∆R“W6ˆ÷ñÊrÊfñ«FW"á”‡¢áÊ∂ñ6∂ˆfb«¬""íÁ6∆ñ6RÉ¬í””“FˆFîï4ÚbbDî≈ïıî4µÙƒƒıtTEÙ$UE2ÊÜ2áÊ&WBê¢ì∞¢ñbÇ6VVF&∆RÊ∆VÊwFÇí≤6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂Fñ«í◊ñ6µ“6VVBB”VÇ¢V7V‚6ÊFñFBÉ$Ç˜W"V¶˜W&BváVí¬ñ6≤ñÊ6ÜÊ|:í"ì≤&WGW&„≤–¢6ˆÁ7B&W7B“6VVF&∆U≥”∞¢6ˆÁ7BFF“≤7W'&VÁEñ6≥¢∞¢Üˆ÷S¢&W7BÊÜˆ÷R¬vì¢&W7BÊví¬6ˆ◊WFóFñˆ„¢&W7BÊ6ˆ◊WFóFñˆ‚¬7˜'C¢&W7BÁ7˜'B¿¢FFS¢FˆFîï4Ú¬Fñ÷S¢""¬&W7Eˆ&WC¢&W7BÊ&WB¬6ˆÊfñFVÊ6S¢&W7BÊ6ˆÊfñFVÊ6R¿¢6˜FS¢ÁV∆¬¬&ˆˆ∂÷∂W#¢ÁV∆¬¬&ó6ˆ„¢%7FFó7FóVRFR6ˆÊg&ˆÁFFñˆÁ2Fó&V7FW2ÑÉ$Çí,:ñV∆∆W2‚"¿¢Üˆ÷Uˆ∆ˆvÛ¢&W7BÊÜˆ÷Uˆ∆ˆvÚ«¬ÁV∆¬¬vïˆ∆ˆvÛ¢&W7BÊvïˆ∆ˆvÚ«¬ÁV∆¬¿¢Üˆ÷Uˆf˜&”¢ÁV∆¬¬vïˆf˜&”¢ÁV∆¬¬Üˆ÷Uˆvˆ«5ˆfs¢ÁV∆¬¬vïˆvˆ«5ˆfs¢ÁV∆¬¿¢÷F6ÖFñ÷S¢&W7BÊ∂ñ6∂ˆfb«¬ÁV∆¬¬6˜W&6S¢&WFÚ÷É&Ç◊6VVB"¬V&∆ó6ÜVDC¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí¿¢7FGW3¢'W6ˆ÷ñÊr"¬66˜&S¢ÁV∆¬¿¢“”∞¢G'í≤g2Áw&óFTfñ∆U7ñÊ2ÑÑU$‘U5ıî4µ5ıDÇ¬•4Ù‚Á7G&ñÊvñgíÜFF¬ÁV∆¬¬"íì≤–¢6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Fñ«í◊ñ6µ“6VVBV7&óGW&S¢"¬RÊ÷W76vRì≤&WGW&„≤–¢G'í∞¢F"Á&W&RÜ ¢îÂ4U%BîÂDÚFñ«ï˜ñ6µˆ∆ˆrÜFFR¬Üˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬7˜'B¬&WB¬6ˆÊfñFVÊ6R¬6˜FR¬˜WF6ˆ÷R¬fñÊ≈˜66˜&UˆÜˆ÷R¬fñÊ≈˜66˜&Uˆví¬Üˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆvÚê¢d≈TU2ÉÚ¬Ú¬Ú¬Ú¬Ú¬Ú¬Ú¬Ú¬ÂTƒ¬¬ÂTƒ¬¬ÂTƒ¬¬Ú¬Úê¢Ù‚4Ù‰dƒî5BÜFFRíDÚUDDR4U@¢Üˆ÷S÷WÜ6«VFVBÊÜˆ÷R¬vì÷WÜ6«VFVBÊví¬6ˆ◊WFóFñˆ„÷WÜ6«VFVBÊ6ˆ◊WFóFñˆ‚¬7˜'C÷WÜ6«VFVBÁ7˜'B¿¢&WC÷WÜ6«VFVBÊ&WB¬6ˆÊfñFVÊ6S÷WÜ6«VFVBÊ6ˆÊfñFVÊ6R¬6˜FS÷WÜ6«VFVBÊ6˜FR¿¢Üˆ÷Uˆ∆ˆvÛ÷WÜ6«VFVBÊÜˆ÷Uˆ∆ˆvÚ¬vïˆ∆ˆvÛ÷WÜ6«VFVBÊvïˆ∆ˆv¢íÁ'V‚áFˆFîï4Ú¬&W7BÊÜˆ÷R¬&W7BÊví¬&W7BÊ6ˆ◊WFóFñˆ‚¬&W7BÁ7˜'B¬&W7BÊ&WB¬&W7BÊ6ˆÊfñFVÊ6R¬ÁV∆¬¬&W7BÊÜˆ÷Uˆ∆ˆvÚ«¬ÁV∆¬¬&W7BÊvïˆ∆ˆvÚ«¬ÁV∆¬ì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Fñ«í◊ñ6µ“6VVB∆ˆrÜó7F˜&óVS¢"¬RÊ÷W76vRì≤–¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂Fñ«í◊ñ6µ“6VVBB”VÉ¢G∂&W7BÊÜˆ÷W“g2G∂&W7BÊvó“ÇG∂&W7BÊ6ˆ◊WFóFñˆÁ“í6ˆÊbG∂&W7BÊ6ˆÊfñFVÊ6W÷ì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂Fñ«í◊ñ6µ“6VVDFñ«ïñ6¥ñd÷ó76ñÊtf˜%FˆFì¢"¬RÊ÷W76vRì≤–ß–†¢ÚÚ)H)H&˜'BFRW&f˜&÷Ê6RÜV&FÚ¢¸;í¬vˆ‚vvÊRÚ¸;í¬vˆ‚W&B)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶gVÊ7Fñˆ‚'Vñ∆EW&f˜&÷Ê6U&W˜'BÜFó2“rí∞¢6ˆÁ7B6ñÊ6TFó2“÷FÇÊ÷ÇÉ¬Fó2ì∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5B6ˆ◊WFóFñˆ‚¬7˜'B¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬˜WF6ˆ÷R¬&V≈ˆˆFB¬Ê«ó6VEˆ@¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢‰BÊ«ó6VEˆB„“FFWFñ÷RÇvÊ˜rr¬Úê¢íÊ∆¬Ü“G∑6ñÊ6TFó7“Fó6ì∞†¢ñbÇ&˜w2Ê∆VÊwFÇí&WGW&‚ÁV∆√∞†¢6ˆÁ7B&ˆfóDˆb“á"í”‚∞¢6ˆÁ7B6˜FR“&˜tˆFBá"ì∞¢&WGW&‚"Ê˜WF6ˆ÷R””“'vñ‚"ÚÉ¢6˜FR“í¢”∞¢”∞†¢6ˆÁ7B'î6ˆ◊“∑”∞¢6ˆÁ7B'î÷&∂WB“∑”∞¢∆WBuvñÁ2“¬u&ˆfóB“∞¢f˜"Ü6ˆÁ7B"ˆb&˜w2í∞¢6ˆÁ7B“&ˆfóDˆbá"ì∞¢u&ˆfóB≥“∞¢ñbá"Ê˜WF6ˆ÷R””“'vñ‚"íuvñÁ2≤≥∞†¢6ˆÁ7B6ˆ◊“"Ê6ˆ◊WFóFñˆ‚«¬"Á7˜'B«¬$ñÊ6ˆÊÁR#∞¢Ü'î6ˆ◊∂6ˆ◊““'î6ˆ◊∂6ˆ◊“«¬≤F˜F√¢¬vñÁ3¢¬&ˆfóC¢“ì∞¢'î6ˆ◊∂6ˆ◊“ÁF˜F¬≤≥≤'î6ˆ◊∂6ˆ◊“Á&ˆfóB≥“∞¢ñbá"Ê˜WF6ˆ÷R””“'vñ‚"í'î6ˆ◊∂6ˆ◊“ÁvñÁ2≤≥∞†¢6ˆÁ7B÷≤“6FVv˜&ó¶T&WBá"Ê&W7Eˆ&WBì∞¢ñbÜ÷≤”“$‰Ú$UB"í∞¢Ü'î÷&∂WE∂÷µ““'î÷&∂WE∂÷µ“«¬≤F˜F√¢¬vñÁ3¢¬&ˆfóC¢“ì∞¢'î÷&∂WE∂÷µ“ÁF˜F¬≤≥≤'î÷&∂WE∂÷µ“Á&ˆfóB≥“∞¢ñbá"Ê˜WF6ˆ÷R””“'vñ‚"í'î÷&∂WE∂÷µ“ÁvñÁ2≤≥∞¢–¢–†¢6ˆÁ7BF˜F¬“&˜w2Ê∆VÊwFÉ∞¢6ˆÁ7BuvñÁ&FR“÷FÇÁ&˜VÊBÜuvñÁ2ÚF˜F¬¢ì∞†¢6ˆÁ7B6ˆ◊'"“ˆ&¶V7BÊVÁG&ñW2Ü'î6ˆ◊íÊ÷ÇÖ∂Ê÷R¬5“í”‚á∞¢Ê÷R¬‚‚Á2¬vñÁ&FS¢÷FÇÁ&˜VÊBá2ÁvñÁ2Ú2ÁF˜F¬¢í¿¢“íì∞¢6ˆÁ7B÷&∂WD'"“ˆ&¶V7BÊVÁG&ñW2Ü'î÷&∂WBíÊ÷ÇÖ∂Ê÷R¬5“í”‚á∞¢Ê÷R¬‚‚Á2¬vñÁ&FS¢÷FÇÁ&˜VÊBá2ÁvñÁ2Ú2ÁF˜F¬¢í¿¢“íì∞†¢ÚÚ&VÁF&∆W2ÚW&FÁFW2¢÷ñ‚2Ê«ó6W2˜W":ófóFW"∆R''Vó@¢6ˆÁ7BV∆ñvñ&∆R“6ˆ◊'"Êfñ«FW"Ü2”‚2ÁF˜F¬„“2ì∞¢6ˆÁ7BvñÊÊW'2“≤‚‚ÊV∆ñvñ&∆U“Á6˜'BÇÜ¬"í”‚"Á&ˆfóB“Á&ˆfóBíÁ6∆ñ6RÉ¬Rì∞¢6ˆÁ7B∆˜6W'2“≤‚‚ÊV∆ñvñ&∆U“Á6˜'BÇÜ¬"í”‚Á&ˆfóB“"Á&ˆfóBíÊfñ«FW"Ü2”‚2Á&ˆfóB¬íÁ6∆ñ6RÉ¬Rì∞†¢6ˆÁ7Bf◊B“ábí”‚áb„“Ú≤G¥÷FÇÁ&˜VÊBábó÷¢G¥÷FÇÁ&˜VÊBábó÷ì∞¢6ˆÁ7B∆ñÊR“Ü2í”‚(
"G∂2ÊÊ÷W“¢G∂2ÁvñÁ&FW“RÇG∂2ÁvñÁ7“ÚG∂2ÁF˜F«“í+rG∂f◊BÜ2Á&ˆfóBóﬁ(*∆∞†¢∆WBFWáB“	˘8¢∆#Â$ı%BU$dı$‘‰4R(	BG∑6ñÊ6TFó7“FW&ÊñW'2¶˜W'3¬ˆ#Â∆Â∆Ê∞¢FWáB≥“	¯»“∆#‰v∆ˆ&¬£¬ˆ#‚G∑F˜F«“Ê«ó6W2+rG∂uvñÁ&FW“R,:óW76óFR+r∆#‚G∂f◊BÜu&ˆfóBóﬁ(*√¬ˆ#‚É(*¬˜ñ6≤ï∆Â∆Ê∞†¢ñbávñÊÊW'2Ê∆VÊwFÇí∞¢FWáB≥“)»R∆#ÂDU2ƒîuTU2$TÂD$ƒU2£¬ˆ#Â∆‚G∑vñÊÊW'2Êfñ«FW"Ü2”‚2Á&ˆfóB„“íÊ÷Ü∆ñÊRíÊ¶ˆñ‚Ç%∆‚"í«¬"ÜV7VÊR˜6óFófRí'’∆Â∆Ê∞¢–¢ñbÜ∆˜6W'2Ê∆VÊwFÇí∞¢FWáB≥“)ÿ¬∆#ÂDU2ƒîuTU2U$DÂDU2å::ófóFW"í£¬ˆ#Â∆‚G∂∆˜6W'2Ê÷Ü∆ñÊRíÊ¶ˆñ‚Ç%∆‚"ó’∆Â∆Ê∞¢–†¢6ˆÁ7B÷&∂WG56˜'FVB“÷&∂WD'"Êfñ«FW"Ü“”‚“ÁF˜F¬„“2íÁ6˜'BÇÜ¬"í”‚"Á&ˆfóB“Á&ˆfóBì∞¢ñbÜ÷&∂WG56˜'FVBÊ∆VÊwFÇí∞¢FWáB≥“	¯ÍÚ∆#Â"EïRDR$í£¬ˆ#Â∆‚G∂÷&∂WG56˜'FVBÊ÷Ü∆ñÊRíÊ¶ˆñ‚Ç%∆‚"ó’∆Â∆Ê∞¢–†¢6ˆÁ7B&W7D÷≤“÷&∂WG56˜'FVE≥”∞¢6ˆÁ7Bv˜'7D÷≤“÷&∂WG56˜'FVE∂÷&∂WG56˜'FVBÊ∆VÊwFÇ“”∞¢6ˆÁ7B&V6ı'G2“µ”∞¢ñbávñÊÊW'5≥“bbvñÊÊW'5≥“Á&ˆfóB‚í&V6ı'G2ÁW6ÇÜ&ófñÃ:ñvñRG∑vñÊÊW'5≥“ÊÊ÷W÷ì∞¢ñbÜ&W7D÷≤bb&W7D÷≤Á&ˆfóB‚í&V6ı'G2ÁW6ÇÜ÷&6å:íG∂&W7D÷≤ÊÊ÷W÷ì∞¢ñbÜ∆˜6W'5≥“í&V6ı'G2ÁW6ÇÜ:ófóFRG∂∆˜6W'5≥“ÊÊ÷W÷ì∞¢ñbáv˜'7D÷≤bbv˜'7D÷≤Á&ˆfóB¬bbv˜'7D÷≤”“&W7D÷≤í&V6ı'G2ÁW6ÇÜ'VFVÊ6R7W"G∑v˜'7D÷≤ÊÊ÷W÷ì∞¢ñbá&V6ı'G2Ê∆VÊwFÇíFWáB≥“	˘*∆#Â&V6Ú£¬ˆ#‚G∑&V6ı'G2Ê¶ˆñ‚Ç"+r"ó“Â∆Â∆Ê∞†¢FWáB≥“)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H∆Ô	˙IbÜW&÷W2(	BWFÚ÷Ê«ó6RFRFW2,:ó7V«FG2,:ñV«6∞¢&WGW&‚FWáC∞ß–†¶7ñÊ2gVÊ7Fñˆ‚6VÊEW&f˜&÷Ê6U&W˜'EFV∆Vw&“ÜFó2“rí∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí&WGW&‚f«6S∞¢G'í∞¢6ˆÁ7BFWáB“'Vñ∆EW&f˜&÷Ê6U&W˜'BÜFó2ì∞¢ñbÇFWáBí∞¢&WGW&‚vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬/	˘8¢&˜'BW&f˜&÷Ê6R¢276W¢BvÊ«ó6W2,:ó6ˆ«VW27W"∆:ó&ñˆFR‚"ì∞¢–¢&WGW&‚vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬FWáBì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∑W&b◊&W˜'E“"¬RÊ÷W76vRì∞¢&WGW&‚f«6S∞¢–ß–†¶ÊvWBÇ"ˆF÷ñ‚˜W&f˜&÷Ê6R◊&W˜'B"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó6R"“ì∞¢6ˆÁ7BFó2“÷FÇÊ÷ÇÉ¬÷FÇÊ÷ñ‚Éì¬'6TñÁBá&WÁVW'íÊFó2í«¬ríì∞¢6ˆÁ7Bˆ≤“vóB6VÊEW&f˜&÷Ê6U&W˜'EFV∆Vw&“ÜFó2ì∞¢&W2Êß6ˆ‚á≤ˆ≤¬÷W76vS¢ˆ≤Ú%&˜'BW&f˜&÷Ê6RVÁf˜ú:í7W"FV∆Vw&“F÷ñ‚"¢$V6ÜV2VÁfˆí"“ì∞ß“ì∞†¢ÚÚ)H)H&˜'BBv&VÁFó76vRV˜FñFñV‚¢÷ˆÁG&RRtÜW&÷W2&ˆw&W76R)H)H)H)H)H)H)H)H)H)H)H ¶gVÊ7Fñˆ‚'Vñ∆D∆V&ÊñÊu&W˜'BÇí∞¢6ˆÁ7BFá&W6Üˆ∆B“vWDFFófU6ñvÊ≈Fá&W6Üˆ∆BÇì∞†¢ÚÚ6∆76V÷VÁBFW2vVÁG2"vñÁ&FR,:ñV¬áˆñG2∆ó\:í"∆R6ÜñVbê¢6ˆÁ7BW&b“vWDvVÁEW&f˜&÷Ê6RÇì∞¢6ˆÁ7BvVÁG2“ˆ&¶V7BÊVÁG&ñW2áW&bê¢Ê÷ÇÖ∂Ê÷R¬“í”‚á≤Ê÷R¬w#¢ÁvñÁ&FR¬&W6ˆ«fVC¢Á&W6ˆ«fVB“íê¢Êfñ«FW"Ü”‚Á&W6ˆ«fVB‚ê¢Á6˜'BÇÜ¬"í”‚Ü"Áw"«¬í“ÜÁw"«¬íì∞¢6ˆÁ7BvVÁD∆ñÊW2“vVÁG2Ê∆VÊwFÄ¢ÚvVÁG2Ê÷Ü”‚G∂Áw"„“cÚ.)»R"¢Áw"„“SÚ.)Èb"¢.)™˚àÚ'“G∂ÊÊ÷W“¢G∂Áw'“RÇG∂Á&W6ˆ«fVG“ñíÊ¶ˆñ‚Ç%∆‚"ê¢¢"á2VÊ6˜&RFR,:ñFñ7FñˆÁ2,:ó6ˆ«VW2í#∞†¢ÚÚ6ˆ◊:óFóFñˆÁ2WFÚ÷WÜ6«VW2Ü&˜V6∆RBvWFÚ÷‹:ñ∆ñ˜&Fñˆ‚ê¢6ˆÁ7BvV≤“≤‚‚ÊvWEVÊFW'W&f˜&÷ñÊt6ˆ◊WFóFñˆÁ2Çï”∞¢6ˆÁ7BvV¥∆ñÊR“vV≤Ê∆VÊwFÇÚvV≤Á6∆ñ6RÉ¬ÇíÊ¶ˆñ‚Ç"¬"í¢&V7VÊR#∞†¢ÚÚ6∆ñ'&Fñˆ‚¢∆R6WVñ¬FñVÁB÷ñ¬6W2&ˆ÷W76W2¢∆WB6∆ñ$∆ñÊR“&FˆÊÏ:ñW2ñÁ7Vffó6ÁFW2#∞¢G'í∞¢6ˆÁ7B2“F"Á&W&RÜ ¢4TƒT5B4ıTÂBÇ¢íB¬5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰Bíp¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$R6ˆÊfñFVÊ6R„“Ú‰B˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢íÊvWBáFá&W6Üˆ∆Bì∞¢ñbÜ2bb2ÁB„“í∞¢6ˆÁ7B&V≈w"“÷FÇÁ&˜VÊBÜ2ÁrÚ2ÁB¢ì∞¢6ˆÁ7Bv“&V≈w"“Fá&W6Üˆ∆C∞¢6ˆÁ7BfW&Fñ7B“÷FÇÊ'2Üví√“RÚ.)»R&ñV‚6∆ñ',:í"¢v¬”RÚ.)™˚àÚG&˜˜Fñ÷ó7FR"¢/	˘*¢÷&vRFR<:ñ7W&óL:í#∞¢6∆ñ$∆ñÊR“6ñvÊWÇ(öRG∑Fá&W6Üˆ∆G“R(i"vñÁ&FR,:ñV¬G∑&V≈w'“RÇG∂2ÁG“Ê«ó6W2í(	BG∑fW&Fñ7G÷∞¢–¢“6F6ÇÜRí∑–†¢ÚÚF˜6Vv÷VÁG2&VÁF&∆W2Ér¶˜W'2ífñ∆W27FG2FR6Vv÷VÁ@¢6ˆÁ7B6Vr“vWE6Vv÷VÁE7FG2Çì∞¢6ˆÁ7B6ˆ◊'"“ˆ&¶V7BÊVÁG&ñW2á6VrÊ6ˆ◊ê¢Ê÷ÇÖ∂Ê÷R¬5“í”‚á≤Ê÷R¬w#¢÷FÇÁ&˜VÊBá2ÁrÚ2ÁB¢í¬C¢2ÁB“íê¢Êfñ«FW"Ü2”‚2ÁB„“Rê¢Á6˜'BÇÜ¬"í”‚"Áw"“Áw"ì∞¢6ˆÁ7BF˜6ˆ◊2“6ˆ◊'"Á6∆ñ6RÉ¬BíÊ÷Ü2”‚)»RG∂2ÊÊ÷W“¢G∂2Áw'“RÇG∂2ÁG“ñíÊ¶ˆñ‚Ç%∆‚"í«¬"ÜÜó7F˜&óVRV‚6ˆÁ7G'V7Fñˆ‚í#∞†¢6ˆÁ7BFFR“ÊWrFFRÇíÁFÙ∆ˆ6∆U7G&ñÊrÇ&g"‘e""¬≤Fñ÷U¶ˆÊS¢$WW&˜Rı&ó2"¬Fì¢#"÷FñvóB"¬÷ˆÁFÉ¢#"÷FñvóB"“ì∞¢&WGW&‚	˙z∆#Â$ı%BBt$TÂDï54tR(	BG∂FFW”¬ˆ#‡†Ø	¯È¢∆#Â6WVñ¬6ñvÊ¬7GVV¬£¬ˆ#‚G∑Fá&W6Üˆ∆G“RÜWFÚ÷ßW7L:íêØ	¯ÍÚ∆#‰6∆ñ'&Fñˆ‚£¬ˆ#‚G∂6∆ñ$∆ñÊW–†Ø	˙Ib∆#‰fñ&ñ∆óL:íFW2îáˆñG2∆ó\:íí£¬ˆ#‡¢G∂vVÁD∆ñÊW7–†Ø	¯¯b∆#‰÷Vñ∆∆WW'26Vv÷VÁG2á&˜Wl:ó2í£¬ˆ#‡¢G∑F˜6ˆ◊7–†Ø	˘™≤∆#‰6ˆ◊:óFóFñˆÁ2WFÚ÷WÜ6«VW2£¬ˆ#‚G∑vV¥∆ñÊW–†Æ)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)HØ	˙IbÜW&÷W2&VÊBFR6ÜVR,:ó7V«FB(	B÷ó6R:¶˜W"V˜FñFñVÊÊV∞ß–†¶7ñÊ2gVÊ7Fñˆ‚6VÊD∆V&ÊñÊu&W˜'EFV∆Vw&“Çí∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí&WGW&‚f«6S∞¢G'í∞¢&WGW&‚vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬'Vñ∆D∆V&ÊñÊu&W˜'BÇíì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂∆V&ÊñÊr◊&W˜'E“"¬RÊ÷W76vRì∞¢&WGW&‚f«6S∞¢–ß–†¶ÊvWBÇ"ˆF÷ñ‚ˆ∆V&ÊñÊr◊&W˜'B"¬7ñÊ2á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$Êˆ‚WF˜&ó6R"“ì∞¢6ˆÁ7Bˆ≤“vóB6VÊD∆V&ÊñÊu&W˜'EFV∆Vw&“Çì∞¢&W2Êß6ˆ‚á≤ˆ≤¬÷W76vS¢ˆ≤Ú%&˜'BBv&VÁFó76vRVÁf˜ú:í7W"FV∆Vw&“F÷ñ‚"¢$V6ÜV2VÁfˆí"“ì∞ß“ì∞†¶∆WBˆ∆7EW&e&W˜'DFFR“"#∞¶∆WBˆ∆7DÜV«FÑ6ÜV6¥FFR“"#∞¶∆WBˆ∆7D÷˜&ÊñÊtVFóDFFR“"#∞¢ÚÚÁFí◊7“FW2∆W'FW2*≤∆ñW":6V2+≤¢VÊR6WV∆R∆W'FR"∆ñW"¬,:ñ&‹:ñP¢ÚÚWFˆ÷FóVV÷VÁBL:á2RwV‚6ñvÊ¬&W'B7W"6R∆ñW"‡¢ÚÚW'6ó7FVRV‚&6R¬2V‚÷V÷ˆó&R¢V‚ˆG'ïFñW$∆W'FVFV‚$“&W'FóB¢ÚÚ¶W&Ú6ÜVR&VFV÷'&vRGR6ˆÁFVÊWW"ÜFˆ6∂W"6ˆ◊˜6RW“÷'Vñ∆Bí¬FˆÊ0¢ÚÚ6ÜVRFW∆ˆñV÷VÁBVÊFÁBVÊRÜWW&R◊V«Fó∆RFRb&V∆Ê6óB¬v∆W'FR‚G&ˆó0¢ÚÚFW∆ˆñV÷VÁG2V‚VÊRÜWW&R“ÊWVb÷W76vW2%ƒîU"4T2"ñFVÁFóVW2&V7W0¢ÚÚ∆R#íÛrÛ##bÉ&É#b¬&É3R¬&ÉCrí∆˜'2VR&ñV‚‚vfóB6ÜÊvRVÁG&RWWÇ‡¶F"ÊWÜV2Ü ¢5$TDRD$ƒRîb‰ıBUÑï5E2G'ï˜FñW%ˆ∆W'G2Ä¢FñW"DUÖB$î‘%í¥Uí¿¢∆W'FVEˆBDUÖB‰ıBÂTƒ¿¢ì∞¶ì∞¶gVÊ7Fñˆ‚G'ïFñW$«&VGï6VÁBáFñW"í∞¢6ˆÁ7B&˜r“F"Á&W&RÇ%4TƒT5B∆W'FVEˆBe$Ù“G'ï˜FñW%ˆ∆W'G2tÑU$RFñW"“Ú"íÊvWBáFñW"ì∞¢&WGW&‚&˜s∞ß–¶gVÊ7Fñˆ‚÷&¥G'ïFñW$∆W'FVBáFñW"í∞¢F"Á&W&RÇ$îÂ4U%BîÂDÚG'ï˜FñW%ˆ∆W'G2áFñW"¬∆W'FVEˆBíd≈TU2ÉÚ¬FFWFñ÷RÇvÊ˜rrííÙ‚4Ù‰dƒî5BáFñW"íDÚUDDR4UB∆W'FVEˆB“WÜ6«VFVBÊ∆W'FVEˆB"íÁ'V‚áFñW"ì∞ß–¶gVÊ7Fñˆ‚6∆V$G'ïFñW$∆W'BáFñW"í∞¢F"Á&W&RÇ$DTƒUDRe$Ù“G'ï˜FñW%ˆ∆W'G2tÑU$RFñW"“Ú"íÁ'V‚áFñW"ì∞ß–†¢ÚÚ)H)HUDÚ(	B&ñ∆‚FR6ÁL:íV˜FñFñV‚ÉvÇ&ó2¬6Ê¬F÷ñ‚í)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ6W'B:L:óFV7FW"V‚#FÇ6RVí¬6ñÊˆ‚¬76RñÊW,:wR¢V‚6Ê¬ñÊ¶ˆñvÊ&∆R¬V‡¢ÚÚ∆ñW"VíÊRFñfgW6R«W2¬V‚vVÁB◊VWB‚2vW7BWÜ7FV÷VÁB6RVí÷Á\:í∆P¢ÚÚ#BÛrVÊB∆R&˜BfóB:óL:íWÜ6«RGR6Ê¬&V÷óV“‡¢ÚÚ)H)HVFóB÷FñÊ¬6ˆ◊∆WBÉrÛÇÛ##bí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚFV÷ÊFRGRfˆÊFFWW"&W2VÊRÊÊRF˜F∆RGR6ˆÊ6ñ∆R76VRñÊW&7VR†¢ÚÚì2RFW2Ê«ó6W26Á2V7V‚f˜FR¬R6Á26ˆÁ6VÁ7W2¬¶W&Ú6ñvÊ¬FñfgW6P¢ÚÚVÊFÁBCÜÇ‚∆R&ñ∆‚FR6ÁFRFRvÇWÜó7FóBFV¶÷ó2ñ¬ÊRDU5DïB&ñV‚(	@¢ÚÚñ¬6ˆ◊FóBFW26˜'FñW2‚V‚7ó7FV÷R÷˜'B&ˆGVóBFW26˜'FñW2fñFW2¬FˆÊ2V‡¢ÚÚ6ˆ◊FWW"¶W&Ú&W76V÷&∆RVÊR¶˜W&ÊVR6∆÷R¬2VÊRÊÊR‡¢Ú¢ÚÚ6WBVFóBV∆∆R&VV∆∆V÷VÁB6ÜVRFWVÊFÊ6RWB&˜'FRÙ≤Ú‰‰R‡¢ÚÚñ¬F˜W&ÊRfÁB∆R&ñ∆‚V˜FñFñV‚˜W"VR∆ÊÊR6ˆóB«VRV‚&V÷ñW"‡¢ÚÚ)H)H&W&Fñˆ‚WFˆ÷FóVRFW2÷ˆFV∆W2ÉrÛÇÛ##bí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚFV÷ÊFRGRfˆÊFFWW"¢&∆˜'7VRGRf2VFóFW"6ÜVR÷Fñ‚¬fW&ñfñW"¬WB6ê¢ÚÚV‚∆ñV‚W7B÷˜'B¬GR∆R&V◊∆6W2"VÊRWG&Rî"‡¢Ú¢ÚÚ∆RFW7B‚vW7B2V‚6ñ◊∆RñÊr¢∆R÷ˆFV∆RFˆóB&ˆGVó&RV‚fó2Wá∆ˆóF&∆P¢ÚÚ7W"∆W24ïÇ÷&6ÜW2&VV∆∆V÷VÁBFñfgW6W2ÜFV÷ÊFRWá∆ñ6óFRGRfˆÊFFWW"í(	@¢ÚÚ«W2ˆ÷ˆñÁ2FR"„R'WG2¬∆W2FWWÇWVóW2÷'VVÁB¬fñ7Fˆó&RFˆ÷ñ6ñ∆R¿¢ÚÚfñ7Fˆó&RWáFW&ñWW"¬'WBV‚&V÷ñW&R÷í◊FV◊2‚V‚÷ˆFV∆RVí&WˆÊB$Ù≤"V‡¢ÚÚñÊr÷ó2ÊR6óB2&V◊∆ó"6Rf˜&÷BÊR6W'B&ñV‚R6ˆÊ6ñ∆R‡¶6ˆÁ7B‘$4ÑU5ıDU5DU2“&'WG3÷Û"„S£s∆'GG3÷˜Vì£c«&W7V«FC÷Fˆ”£cR∆◊C÷˜Vì£SR#∞¶6ˆÁ7B4Ù‰DUÙ‘$4ÑU2“GRÊ«ó6W2V‚÷F6ÇFRfˆ˜F&∆¬‚&WˆÊG2T‰ïTT‘TÂB"6WGFR∆ñvÊR¬V‚&V◊∆6ÁB∆W2f∆WW'2†§‘$4ÑU2¢G¥‘$4ÑU5ıDU5DU7–§6ˆFW2¢'WG3÷Û"„R˜RS"„R¬'GG3÷˜Ví˜RÊˆ‚¬&W7V«FC÷Fˆ“¬WáB˜RÁV¬¬◊C÷˜Ví˜RÊˆÊ∞†¢ÚÚf÷ñ∆∆W2V6'FVW2Bvˆffñ6R6ˆ÷÷R&V◊∆6ÁFW2¢w&GVóFW2áV˜FÁV¬W@¢ÚÚ&WFó&VW26Á2&Vfó2(	B2vW7BWÜ7FV÷VÁB6RVífñVÁBBv'&ófW"í¬∆˜G0¢ÚÚ7ñÊ6á&ˆÊW2¬∆ñ2ñÁ7F&∆W2&VfóÜW2'‚"¬WB÷ˆFV∆W27V6ñ∆ó6W2Ü˜'27V¶WB‡¢ÚÚ¶˜WG2GRrÛÇÛ##b&W2VÊR7V'7FóGWFñˆ‚&FVRV‚&ˆGV7Fñˆ‚¢∆Rfñ«G&P¢ÚÚ&WFVÁR&÷ó7G&∆í˜f˜áG&¬◊6÷∆¬”#F"”#Sr"(	BV‚÷ˆFV∆RTDîÚ(	B&6RRvñ¿¢ÚÚ'&ófóBV‚FWFRBwV‚G&í«Ü&WFóVRñÁfW'6R‚∆W2÷ˆF∆óFW2Êˆ‚FWáGVV∆∆W0¢ÚÚWB∆W2÷ˆFV∆W27V6ñ∆ó6W2‚vˆÁB&ñV‚fó&RFÁ2V‚6ˆÊ6ñ∆RBvÊ«ó6R‡¶6ˆÁ7B$T’ƒ4ÂEÙîÂDU$DïB“ÚÉ¶g&VW√¶&F6á≈ÁÁ∆wV&G¬÷6ˆFW∆V÷&VG«&W&Ê∑«fó6ñˆÁ∆ñ÷vW«GG7«vÜó7W'«f˜áG&«∆VFñ˜«7VV6á∆ˆ7'∆÷ˆFW&FñˆÁ∆6ˆFW7G&«∆FWg7G&«∆÷Fá«G&Á6∆FRíˆì∞†¢ÚÚ6ˆÊFRfˆ∆ˆÁFó&V÷VÁBDÙƒU$ÂDR‚fW'6ñˆ‚GRrÛÇÛ##b6˜'&ñvVR∆R¶˜W"÷V÷R†¢ÚÚfV2÷Ö˜Fˆ∂VÁ3”ÉWBVÊRWÜñvVÊ6RFRf˜&÷B7G&ñ7FR¬V‚÷ˆFV∆R&f&B˜RVê¢ÚÚ¶˜WFRVÊRá&6RBvñÁG&ˆGV7Fñˆ‚WFóBFV6∆&R÷˜'B∆˜'2Rvñ¬&WˆÊFóBG&W0¢ÚÚ&ñV‚‚6ˆÁ7FFRV‚&ˆGV7Fñˆ‚(	BvV„2„r÷÷ÇWB∂ñ÷í÷≥2¬F˜W2FWWÇf∆ñFW2 ¢ÚÚV‚V¬Fó&V7B¬ˆÁBWFR&V◊∆6W2F˜'B‚V‚fWÇ˜6óFñb6˜WFR6ÜW"¢ñ¿¢ÚÚWfñÊ6RV‚&ˆ‚÷ˆFV∆R‚V‚fWÇÊVvFñbÊR6˜WFR&ñV‚¢ˆ‚v&FR¬vWÜó7FÁB‡¶7ñÊ2gVÊ7Fñˆ‚6ˆÊFT÷ˆFV∆RÜ÷ˆFVƒñB¬W76ó2“"í∞¢∆WBFW&ÊñW"“&V7VÊR&WˆÁ6R#∞¢f˜"Ü∆WB‚“≤‚¬W76ó3≤‚≤≤í∞¢G'í∞¢6ˆÁ7B"“vóBáGG˜7BÇ&áGG3¢Úˆ˜VÁ&˜WFW"Êíˆí˜cˆ6ÜBˆ6ˆ◊∆WFñˆÁ2"¿¢≤÷ˆFV√¢÷ˆFVƒñB¬÷W76vW3¢∑≤&ˆ∆S¢'W6W""¬6ˆÁFVÁC¢4Ù‰DUÙ‘$4ÑU2’“¬÷Ö˜Fˆ∂VÁ3¢#S¬FV◊W&GW&S¢„“¿¢≤WFÜ˜&ó¶Fñˆ„¢&V&W"G¥ıTÂ$ıUDU%ÙïÙ¥Uó÷“¬#Sì∞¢6ˆÁ7BGáB“#ÚÊ6Üˆñ6W3ÚÂ≥”ÚÊ÷W76vSÚÊ6ˆÁFVÁB«¬"#∞¢ñbÇGáBí≤FW&ÊñW"“7G&ñÊrá#ÚÊW'&˜#ÚÊ÷W76vR«¬&V7VÊR&WˆÁ6R"íÁ6∆ñ6RÉ¬SRì≤6ˆÁFñÁVS≤–¢ÚÚˆ‚4ÑU$4ÑR∆W2÷&6ÜW2FÁ2∆&WˆÁ6RR∆ñWRBvWÜñvW"VÊR∆ñvÊRWÜ7FR†¢ÚÚV‚&V÷'V∆R˜RV‚&WF˜W"∆∆ñvÊRÊR6ˆÁB2FW2FVfWG2FRfˆÊB‡¢6ˆÁ7B÷ÁVÁG2“≤&'WG2"¬&'GG2"¬'&W7V«FB"¬&◊C%“Êfñ«FW"Ü≤”‚ÊWr&VtWáÜ≤≤%≈«2•≥”•“"¬&í"íÁFW7BáGáBíì∞¢ñbÇ÷ÁVÁG2Ê∆VÊwFÇí&WGW&‚≤ˆ≥¢G'VR¬váì¢'&WˆÊB7W"∆W2b÷&6ÜW2"”∞¢FW&ÊñW"“f˜&÷BñÊ6ˆ◊∆WBÜ÷ÁVRG∂÷ÁVÁG2Ê¶ˆñ‚Ç"¬"ó“ñ∞¢“6F6ÇÜRí∞¢FW&ÊñW"“7G&ñÊrÜRÊ÷W76vRíÁ6∆ñ6RÉ¬SRì∞¢–¢–¢&WGW&‚≤ˆ≥¢f«6R¬váì¢FW&ÊñW"”∞ß–†¢ÚÚ÷ˆFV∆W2&VV∆∆V÷VÁBV∆W2"∆R6ˆÊ6ñ∆R‚6∆R“ñFVÁFñfñÁBÜó7F˜&óVP¢ÚÚÜ6V«VíVífñwW&RFÁ2∆R6ˆFRí¬f∆WW"“&ˆ∆R¬˜W"V‚÷W76vR∆ó6ñ&∆R‡¶6ˆÁ7B‘ÙDTƒU5Ù4Ù‰4îƒR“∞¢'W'∆WÜóGí˜6ˆÊ"◊&Ú#¢%W'∆WÜóGí’vV""¿¢&FVW6VV≤ˆFVW6VV≤÷6ÜB#¢$FVW6VV≤"¿¢&÷ó7G&∆íˆ÷ó7G&¬÷∆&vR#¢$÷ó7G&¬‘∆&vR"¿¢&6ˆÜW&Rˆ6ˆ÷÷ÊB◊"◊«W2#¢%vV‚”2„r‘÷Ç"¿¢&÷ˆˆÁ6Ü˜Fíˆ∂ñ÷í÷≥2#¢$∂ñ÷í"¿¢&÷ó7G&∆íˆ÷ó7G&¬”v"÷ñÁ7G'V7C¶g&VR#¢$÷ó7G&¬”t"Ü&Ê2BvW76íí"¿ß”∞†¢ÚÚFWWÇñFVÁFñfñÁG2ˆÁB∆÷V÷Rdı$‘RVÊBñ«2ÊRFñffW&VÁBVR"∆WW'0¢ÚÚ6Üñfg&W2¢'vV„2„r÷÷Ç"WB'vV„2„Ç÷÷Ç"˜Ví¬'vV„2„r÷÷Ç"W@¢ÚÚ'vV„2„r÷f∆6Ç"Êˆ‚‚6Á26Rv&FR÷f˜R¬VÊR&÷ó6R¶˜W""fW&óBv∆ó76W"V‡¢ÚÚ÷ˆFV∆RÜWBFRv÷÷RfW'2VÊRf&ñÁFR&ñFRWB÷ˆñÁ2fñÊR¬˜R¬vñÁfW'6R‡¶gVÊ7Fñˆ‚f˜&÷T÷ˆFV∆RÜñBí∞¢&WGW&‚7G&ñÊrÜñBíÁ7∆óBÇ"Ú"ï≥“Á&W∆6RÇı≥”ï“≤ˆr¬"2"ì∞ß–¶gVÊ7Fñˆ‚ÁV÷W&˜4÷ˆFV∆RÜñBí∞¢&WGW&‚Ö7G&ñÊrÜñBíÁ7∆óBÇ"Ú"ï≥“Ê÷F6ÇÇı≥”ï“≤ˆrí«¬µ“íÊ÷ÑÁV÷&W"ì∞ß–¶gVÊ7Fñˆ‚W7E«W5&V6VÁBÜ6ÊFñFB¬7GVV¬í∞¢ñbÜf˜&÷T÷ˆFV∆RÜ6ÊFñFBí”“f˜&÷T÷ˆFV∆RÜ7GVV¬íí&WGW&‚f«6S∞¢6ˆÁ7B“ÁV÷W&˜4÷ˆFV∆RÜ6ÊFñFBí¬"“ÁV÷W&˜4÷ˆFV∆RÜ7GVV¬ì∞¢f˜"Ü∆WBí“≤í¬÷FÇÊ÷ÇÜÊ∆VÊwFÇ¬"Ê∆VÊwFÇì≤í≤≤í∞¢6ˆÁ7BÇ“∂ï“ÛÚ”¬í“%∂ï“ÛÚ”∞¢ñbáÇ”“íí&WGW&‚Ç‚ì∞¢–¢&WGW&‚f«6S∞ß–†¢ÚÚ6ñVvW2FR6V6˜W'2VÊBVÊRf÷ñ∆∆RVÁFñW&RFó7&óBGR6F∆ˆwVR‚∆R6ˆÊ6ñ∆P¢ÚÚfWB"6W24îÂf˜FW2¢2vñ¬V‚÷ÁVRV‚¬∆RV˜'V“FR2FWfñVÁB&VV6˜W ¢ÚÚ«W2GW"GFVñÊG&RWB∆6ˆÊfñÊ6R&WFˆ÷&RSRR‚÷ñWWÇfWBV‚vVÁBBwVÊP¢ÚÚWG&Rf÷ñ∆∆RRwV‚6ñVvRfñFR‚˜&G&R6Üˆó6í"∆RfˆÊFFWW"ÉrÛÇÛ##bí†¢ÚÚ∂ñ÷íBv&˜&B¬Vó2vV‚‡¶6ˆÁ7BtTÂE5ÙDUı4T4ıU%2“≤&÷ˆˆÁ6Ü˜Fíˆ∂ñ÷í÷≥2"¬'vV‚˜vV„2„r÷÷Ç%”∞†¶7ñÊ2gVÊ7Fñˆ‚VFóDÊE&Wó$÷ˆFV«2Çí∞¢ñbÇıTÂ$ıUDU%ÙïÙ¥Uíí&WGW&‚≤∆ñvÊW3¢≤/	˘KB÷ˆFV∆W2(	BV7VÊR6∆R˜VÂ&˜WFW"%“¬ÊÊW3¢≤$÷ˆFV∆W2%“”∞¢6ˆÁ7B6F∆ˆwVR“vóBáGGvWBÇ&áGG3¢Úˆ˜VÁ&˜WFW"Êíˆí˜cˆ÷ˆFV«2"¬≤WFÜ˜&ó¶Fñˆ„¢&V&W"G¥ıTÂ$ıUDU%ÙïÙ¥Uó÷“ì∞¢6ˆÁ7BFó7Ú“Ü6F∆ˆwVSÚÊFF«¬µ“íÊ÷Ü“”‚“ÊñBì∞¢ñbÇFó7ÚÊ∆VÊwFÇí&WGW&‚≤∆ñvÊW3¢≤/	˘KB÷ˆFV∆W2(	B6F∆ˆwVR˜VÂ&˜WFW"ñÊ¶ˆñvÊ&∆R%“¬ÊÊW3¢≤$÷ˆFV∆W2%“”∞†¢6ˆÁ7B∆ñvÊW2“µ”∞¢6ˆÁ7BÊÊW2“µ”∞¢6ˆÁ7B&W&W2“µ”∞¢ÚÚf÷ñ∆∆W2FV¶ˆ67WVW2¢∆R6ˆÊ6ñ∆RÊRfWBVR"∆DïdU%4ïDRFR6W0¢ÚÚV6ˆ∆W2FR÷ˆFV∆W2‚6ˆÁ7FFRV‚&ˆGV7Fñˆ‚∆RrÛÇÛ##b¢FWWÇ6ñVvW26P¢ÚÚ6ˆÁB&WG&˜WfW27W"GR∂ñ÷íÜ∂ñ÷í÷≥"◊FÜñÊ∂ñÊrWB∂ñ÷í÷≥"„Rí‚FWWÇf&ñÁFW0¢ÚÚGR÷V÷R÷ˆFV∆R6RG&ˆ◊VÁBVÁ6V÷&∆R(	B∆Rf˜FR6ñÁW&BF˜WB6ˆ‚6VÁ2‡¢6ˆÁ7Bf÷ñ∆∆W5&ó6W2“ÊWr6WBÇì∞¢f˜"Ü6ˆÁ7B∂∆ˆvóVR¬&ˆ∆U“ˆbˆ&¶V7BÊVÁG&ñW2Ñ‘ÙDTƒU5Ù4Ù‰4îƒRíí∞¢∆WB7GVV¬“&W6ˆ«fT÷ˆFV¬Ü∆ˆvóVRì∞¢ÚÚWFÚ÷wVW&ó6ˆ‚¢6í∆R÷ˆFV∆RBv˜&ñvñÊR&VfˆÊ7FñˆÊÊR¬ˆ‚&WfñVÁBFW77W2W@¢ÚÚˆ‚Vff6R∆7V'7FóGWFñˆ‚‚6Á26¬V‚&V◊∆6V÷VÁBFV6ñFRV‚¶˜W"FP¢ÚÚÊÊR76vW&RFWfñVÊG&óBFVfñÊóFñb‡¢ñbÜ7GVV¬”“∆ˆvóVRí∞¢6ˆÁ7B&WF˜W"“vóB6ˆÊFT÷ˆFV∆RÜ∆ˆvóVRì∞¢ñbá&WF˜W"Êˆ≤í∞¢F"Á&W&RÇ$DTƒUDRe$Ù“÷ˆFV≈ˆ˜fW'&ñFW2tÑU$R∆ˆvñ6≈ˆñB“Ú"íÁ'V‚Ü∆ˆvóVRì∞¢ˆ÷ˆFVƒ˜fW'&ñFT66ÜRÊB“∞¢7GVV¬“∆ˆvóVS∞¢∆ñvÊW2ÁW6ÇÜ(jû˚àÚG∑&ˆ∆W“(	B&WF˜W"R÷ˆFV∆RBv˜&ñvñÊRG∂∆ˆvóVW“Üñ¬&VfˆÊ7FñˆÊÊRñì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂÷ˆFV∆W5“G∂∆ˆvóVW“¢7V'7FóGWFñˆ‚ÊÁV∆VR¬∆R÷ˆFV∆RBv˜&ñvñÊR&WˆÊBÊ˜WfVVì∞¢–¢–¢ÚÚVÊR7V'7FóGWFñˆ‚76VRWWBˆñÁFW"fW'2V‚÷ˆFV∆RVR∆Rfñ«G&R&V¶WGFP¢ÚÚV¶˜W&BváVíáf˜áG&¬¬V‚÷ˆFV∆RTDîÚ¬WFR&WFVÁR∆RrÛÇÛ##bfÁ@¢ÚÚVR∆Rfñ«G&R6ˆóBV∆&víí‚ñ¬'&WˆÊB"FˆÊ2∆6ˆÊFR∆RFV6∆&Rf∆ñFRW@¢ÚÚñ¬&W7FW&óBV‚∆6RñÊFVfñÊñ÷VÁB‚ˆ‚∆RG&óFR6ˆ÷÷R÷˜'B˜W"f˜&6W"V‡¢ÚÚÊ˜WfVR6ÜˆóÇ‡¢6ˆÁ7BñÁFW&FóB“7GVV¬”“∆ˆvóVRbb$T’ƒ4ÂEÙîÂDU$DïBÁFW7BÜ7GVV¬ì∞¢6ˆÁ7B6ˆÊFR“ñÁFW&Fó@¢Ú≤ˆ≥¢f«6R¬váì¢&÷ˆFV∆RÊˆ‚6ˆÊf˜&÷RRfñ«G&RÜ÷ˆF∆óFR˜R7V6ñ∆óFRÜ˜'27V¶WBí"–¢¢vóB6ˆÊFT÷ˆFV∆RÜ7GVV¬ì∞¢ñbá6ˆÊFRÊˆ≤í∞¢f÷ñ∆∆W5&ó6W2ÊFBÜ7GVV¬Á7∆óBÇ"Ú"ï≥“ì∞¢ÚÚ∆R÷ˆFV∆R&WˆÊB‚ˆ‚&Vv&FRVÊB÷V÷R6í∆Rf˜W&Êó76WW"V&∆ñRVÊP¢ÚÚfW'6ñˆ‚«W2&V6VÁFRFR4R÷ˆFV∆R&V6ó2ÜFV÷ÊFRGRfˆÊFFWW"†¢ÚÚ'6íV∆∆RVÊRÊ˜WfV∆∆RfW'6ñˆ‚7W"˜VÂ&˜WFW"¬Ww&FR÷∆¢ÚÚWFˆ÷FóVV÷VÁB"í‚∆Ê˜WfV∆∆RfW'6ñˆ‚W7B6ˆÊFVR7W"∆W26óÇ÷&6ÜW0¢ÚÚfÁBBvWG&RF˜FVR(	Bˆ‚ÊR&67V∆R¶÷ó2¬vfWVv∆R‡¢6ˆÁ7B«W5&V6VÁG2“Fó7¢Êfñ«FW"ÜñB”‚$T’ƒ4ÂEÙîÂDU$DïBÁFW7BÜñBíbbW7E«W5&V6VÁBÜñB¬7GVV¬íê¢Á6˜'BÇÜ¬"í”‚∞¢6ˆÁ7BÇ“ÁV÷W&˜4÷ˆFV∆RÜí¬í“ÁV÷W&˜4÷ˆFV∆RÜ"ì∞¢f˜"Ü∆WBí“≤í¬÷FÇÊ÷ÇáÇÊ∆VÊwFÇ¬íÊ∆VÊwFÇì≤í≤≤í∞¢ñbÇáÖ∂ï“ÛÚ”í”“áï∂ï“ÛÚ”íí&WGW&‚áï∂ï“ÛÚ”í“áÖ∂ï“ÛÚ”ì∞¢–¢&WGW&‚∞¢“ì∞¢f˜"Ü6ˆÁ7BÊWVbˆb«W5&V6VÁG2Á6∆ñ6RÉ¬"íí∞¢6ˆÁ7BB“vóB6ˆÊFT÷ˆFV∆RÜÊWVbì∞¢ñbÇBÊˆ≤í6ˆÁFñÁVS∞¢F"Á&W&RÜîÂ4U%BîÂDÚ÷ˆFV≈ˆ˜fW'&ñFW2Ü∆ˆvñ6≈ˆñB¬÷ˆFV≈ˆñB¬&W∆6VEˆB¬&V6ˆ‚ê¢d≈TU2ÉÚ√Ú∆FFWFñ÷RÇvÊ˜rrí√Úê¢Ù‚4Ù‰dƒî5BÜ∆ˆvñ6≈ˆñBíDÚUDDR4UB÷ˆFV≈ˆñC÷WÜ6«VFVBÊ÷ˆFV≈ˆñB¿¢&W∆6VEˆC÷WÜ6«VFVBÁ&W∆6VEˆB¬&V6ˆ„÷WÜ6«VFVBÁ&V6ˆÊê¢Á'V‚Ü∆ˆvóVR¬ÊWVb¬÷ó6R¶˜W"FWVó2G∂7GVV«÷ì∞¢ˆ÷ˆFVƒ˜fW'&ñFT66ÜRÊB“∞¢&W&W2ÁW6ÇÜG∑&ˆ∆W“*»bG∂ÊWVg÷ì∞¢∆ñvÊW2ÁW6ÇÜ*»n˚àÚG∑&ˆ∆W“(	BG∂7GVV«“(i"∆#‚G∂ÊWVg”¬ˆ#‚áfW'6ñˆ‚«W2&V6VÁFRñì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂÷ˆFV∆W5“G∂∆ˆvóVW“÷ó2¶˜W"¢G∂7GVV«“”‚G∂ÊWVg÷ì∞¢'&V≥∞¢–¢ñbÇ&W&W2Á6ˆ÷Rá"”‚"Á7F'G5vóFÇÜG∑&ˆ∆W“*»fííí∆ñvÊW2ÁW6ÇÜ)»RG∑&ˆ∆W“(	BG∂7GVV«÷ì∞¢6ˆÁFñÁVS∞¢–†¢ÚÚ÷˜'B¢ˆ‚6ÜW&6ÜRV‚&V◊∆6ÁBFÁ2∆‘T‘Rf÷ñ∆∆R¬V‚FW7FÁBGR«W0¢ÚÚ&V6VÁBR«W2Ê6ñV‚‚÷V÷Rf÷ñ∆∆R“÷V÷RV6ˆ∆RFR÷ˆFV∆R¬6RVê¢ÚÚ&W6W'fR∆FófW'6óFRBv&6ÜóFV7GW&W2VífóB∆f∆WW"GR6ˆÊ6ñ∆R‡¢6ˆÁ7Bf÷ñ∆∆R“∆ˆvóVRÁ7∆óBÇ"Ú"ï≥”∞¢ÚÚ˜&G&RFR&VfW&VÊ6R¢Bv&˜&B∆W2÷ˆFV∆W2FR‘T‘Rdı$‘RVR¬v7GVV¿¢ÚÚÜ÷V÷RÊˆ“¬ÁV÷W&ÚFñffW&VÁB(	BFˆÊ2÷V÷Rv÷÷Rí¬VÁ7VóFR∆R&W7FRFR∆¢ÚÚf÷ñ∆∆R‚∆RG&í«Ü&WFóVRñÁfW'6R6WV¬fóB&WFVÁR'f˜áG&¬"W@¢ÚÚ&6ˆ÷÷ÊB◊#v""«WF˜BVR∆W2÷ˆFV∆W2FR∆&ˆÊÊRv÷÷R‡¢6ˆÁ7B÷V÷Tf˜&÷R“µ“¬÷V÷Tf÷ñ∆∆R“µ”∞¢Fó7ÚÊfñ«FW"ÜñB”‚ñBÁ7F'G5vóFÇÜf÷ñ∆∆R≤"Ú"íbbñB”“7GVV¬bb$T’ƒ4ÂEÙîÂDU$DïBÁFW7BÜñBíê¢Êf˜$V6ÇÜñB”‚≤Üf˜&÷T÷ˆFV∆RÜñBí””“f˜&÷T÷ˆFV∆RÜ7GVV¬íÚ÷V÷Tf˜&÷R¢÷V÷Tf÷ñ∆∆RíÁW6ÇÜñBì≤“ì∞¢6ˆÁ7B$ÁV÷W&Ú“Ü¬"í”‚∞¢6ˆÁ7BÇ“ÁV÷W&˜4÷ˆFV∆RÜí¬í“ÁV÷W&˜4÷ˆFV∆RÜ"ì∞¢f˜"Ü∆WBí“≤í¬÷FÇÊ÷ÇáÇÊ∆VÊwFÇ¬íÊ∆VÊwFÇì≤í≤≤í∞¢ñbÇáÖ∂ï“ÛÚ”í”“áï∂ï“ÛÚ”íí&WGW&‚áï∂ï“ÛÚ”í“áÖ∂ï“ÛÚ”ì∞¢–¢&WGW&‚∞¢”∞¢6ˆÁ7B6ÊFñFG2“≤‚‚Ê÷V÷Tf˜&÷RÁ6˜'Bá$ÁV÷W&Úí¬‚‚Ê÷V÷Tf÷ñ∆∆RÁ6˜'Bá$ÁV÷W&Úï”∞¢∆WB&V◊∆6R“ÁV∆√∞¢f˜"Ü6ˆÁ7B2ˆb6ÊFñFG2Á6∆ñ6RÉ¬Bíí∞¢6ˆÁ7BB“vóB6ˆÊFT÷ˆFV∆RÜ2ì∞¢ñbáBÊˆ≤í≤&V◊∆6R“3≤'&V≥≤–¢–¢ñbá&V◊∆6Rí∞¢F"Á&W&RÜîÂ4U%BîÂDÚ÷ˆFV≈ˆ˜fW'&ñFW2Ü∆ˆvñ6≈ˆñB¬÷ˆFV≈ˆñB¬&W∆6VEˆB¬&V6ˆ‚ê¢d≈TU2ÉÚ√Ú∆FFWFñ÷RÇvÊ˜rrí√Úê¢Ù‚4Ù‰dƒî5BÜ∆ˆvñ6≈ˆñBíDÚUDDR4UB÷ˆFV≈ˆñC÷WÜ6«VFVBÊ÷ˆFV≈ˆñB¿¢&W∆6VEˆC÷WÜ6«VFVBÁ&W∆6VEˆB¬&V6ˆ„÷WÜ6«VFVBÁ&V6ˆÊê¢Á'V‚Ü∆ˆvóVR¬&V◊∆6R¬G∂7GVV«“¢G∑6ˆÊFRÁváó÷ì∞¢ˆ÷ˆFVƒ˜fW'&ñFT66ÜRÊB“≤ÚÚf˜&6R∆&V∆V7GW&RR&ˆ6Üñ‚V¿¢f÷ñ∆∆W5&ó6W2ÊFBá&V◊∆6RÁ7∆óBÇ"Ú"ï≥“ì∞¢&W&W2ÁW6ÇÜG∑&ˆ∆W“(i"G∑&V◊∆6W÷ì∞¢∆ñvÊW2ÁW6ÇÜ	˘JrG∑&ˆ∆W“(	BG∂7GVV«“÷˜'BÇG∑6ˆÊFRÁváó“í¬&V◊∆6R"G∑&V◊∆6W÷ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂÷ˆFV∆W5“G∂∆ˆvóVW“&V◊∆6R"G∑&V◊∆6W“(	BG∑6ˆÊFRÁváó÷ì∞¢“V«6R∞¢ÚÚf÷ñ∆∆RVÁFñW&RñÊFó7ˆÊñ&∆R¢«WF˜BRwV‚6ñVvRfñFRR6ˆÊ6ñ∆R¬ˆ‡¢ÚÚˆ67WR∆∆6RfV2V‚vVÁBFR6V6˜W'2Ví&WˆÊB¬÷V÷RBwVÊRWG&P¢ÚÚV6ˆ∆R‚6ñÁf˜FÁG2f∆VÁB÷ñWWÇVRVG&R¢∆RV˜'V“FR2FWfñVÁ@¢ÚÚ6ñÊˆ‚G&W2Fñffñ6ñ∆RGFVñÊG&RWBF˜WB&WFˆ÷&RSRR‡¢∆WB6V6˜W'2“ÁV∆√∞¢f˜"Ü6ˆÁ7B6ÊBˆbtTÂE5ÙDUı4T4ıU%2í∞¢6ˆÁ7Bg&í“&W6ˆ«fT÷ˆFV¬Ü6ÊBì∞¢ñbág&í””“7GVV¬í6ˆÁFñÁVS∞¢ÚÚ¶÷ó2FWWÇ6ñVvW27W"∆÷V÷RV6ˆ∆RFR÷ˆFV∆R¢ñ«2f˜FW&ñVÁ@¢ÚÚVÁ6V÷&∆RWB∆RV˜'V“FRG&ˆó2ÊR&˜WfW&óB«W2&ñV‚‡¢ñbÜf÷ñ∆∆W5&ó6W2ÊÜ2ág&íÁ7∆óBÇ"Ú"ï≥“íí6ˆÁFñÁVS∞¢6ˆÁ7BB“vóB6ˆÊFT÷ˆFV∆Rág&íì∞¢ñbáBÊˆ≤í≤6V6˜W'2“g&ì≤'&V≥≤–¢–¢ñbá6V6˜W'2í∞¢F"Á&W&RÜîÂ4U%BîÂDÚ÷ˆFV≈ˆ˜fW'&ñFW2Ü∆ˆvñ6≈ˆñB¬÷ˆFV≈ˆñB¬&W∆6VEˆB¬&V6ˆ‚ê¢d≈TU2ÉÚ√Ú∆FFWFñ÷RÇvÊ˜rrí√Úê¢Ù‚4Ù‰dƒî5BÜ∆ˆvñ6≈ˆñBíDÚUDDR4UB÷ˆFV≈ˆñC÷WÜ6«VFVBÊ÷ˆFV≈ˆñB¿¢&W∆6VEˆC÷WÜ6«VFVBÁ&W∆6VEˆB¬&V6ˆ„÷WÜ6«VFVBÁ&V6ˆÊê¢Á'V‚Ü∆ˆvóVR¬6V6˜W'2¬f÷ñ∆∆RG∂f÷ñ∆∆W“ñÊFó7ˆÊñ&∆R¢G∑6ˆÊFRÁváó÷ì∞¢ˆ÷ˆFVƒ˜fW'&ñFT66ÜRÊB“∞¢f÷ñ∆∆W5&ó6W2ÊFBá6V6˜W'2Á7∆óBÇ"Ú"ï≥“ì∞¢&W&W2ÁW6ÇÜG∑&ˆ∆W“(i"G∑6V6˜W'7“á6V6˜W'2ñì∞¢∆ñvÊW2ÁW6ÇÜ	˙©G∑&ˆ∆W“(	Bf÷ñ∆∆RG∂f÷ñ∆∆W“ñÊFó7ˆÊñ&∆R¬6ñVvRˆ67WR"G∑6V6˜W'7÷ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂÷ˆFV∆W5“G∂∆ˆvóVW“¢6ñVvRFR6V6˜W'2G∑6V6˜W'7÷ì∞¢“V«6R∞¢ÊÊW2ÁW6Çá&ˆ∆Rì∞¢∆ñvÊW2ÁW6ÇÜ	˘KBG∑&ˆ∆W“(	BG∂7GVV«“÷˜'BÇG∑6ˆÊFRÁváó“í¬V7V‚&V◊∆6ÁB‰í6V6˜W'6ì∞¢6ˆÁ6ˆ∆RÊW'&˜"Ü∂÷ˆFV∆W5“G∂∆ˆvóVW“÷˜'B6Á2&V◊∆6ÁBÊí6V6˜W'2(	BG∑6ˆÊFRÁváó÷ì∞¢–¢–¢–¢&WGW&‚≤∆ñvÊW2¬ÊÊW2¬&W&W2”∞ß–†¢ÚÚ)H)H&ˆ÷˜Fñˆ‚BwV‚6Ü∆∆VÊvW"R6ˆÊ6ñ∆RÉrÛÇÛ##bí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚFV÷ÊFRGRfˆÊFFWW"¢'6íGRG&˜WfW2VÊRî÷Vñ∆∆WW&RVR6V∆∆RGR6ˆÊ6ñ∆R¿¢ÚÚGR∆&V◊∆6W2"‚6˜W&6RFRfW&óFR6Üˆó6ñR"«Ví¢4&˜&R&6R¬2V‡¢ÚÚ6∆76V÷VÁBV&∆ñ2‚V‚÷ˆFV∆RVíFˆ÷ñÊRV‚6∆76V÷VÁBvVÊW&∆ó7FR‚vW7B0¢ÚÚf˜&6V÷VÁB&ˆ‚˜W"&VFó&RV‚VÊFW""„R7W"V‚÷F6ÇFR6ˆÊfW&VÊ6R∆VwVR(	@¢ÚÚ6WV¬∆RvñÁ&FR7W"6W2g&ó2÷F6á2∆RFóB‡¢Ú¢ÚÚ∆R&Ê2BvW76íá6ÜF˜uˆWf«2íF˜W&ÊRFV¶¢∆W26Ü∆∆VÊvW'2Ê«ó6VÁB∆W0¢ÚÚ÷V÷W2÷F6á2VR∆W2FóGV∆ó&W2¬V‚&∆∆V∆R¬6Á2ñÊf«VVÊ6W"V7V‚6ñvÊ¿¢ÚÚFñfgW6R‚ñ¬÷ÁVóBVÊóVV÷VÁB∆FV6ó6ñˆ‚‡¢ÚÚ6˜'&W7ˆÊFÊ6RvVÁB”‚ñFVÁFñfñÁB∆ˆvóVRFR6ˆ‚÷ˆFV∆R‚6W'B∆óVW ¢ÚÚVÊR&ˆ÷˜Fñˆ‚¢ˆ‚fóBˆñÁFW"∆R6ñVvRGRFóGV∆ó&R6˜'FÁBfW'2∆R÷ˆFV∆P¢ÚÚGR6Ü∆∆VÊvW"¬fñ∆÷V÷RF&∆R÷ˆFV≈ˆ˜fW'&ñFW2VR∆W27V'7FóGWFñˆÁ2‡¢ÚÚ∆W26Ü∆∆VÊvW'2Ü˜'2˜VÂ&˜WFW"Ñw&˜¬6W&V'&2¬÷ó7G&¬Fó&V7BíÊR6ˆÁB0¢ÚÚ∆ó7FW2¢∆WW"&ˆ÷˜Fñˆ‚FV÷ÊFW&óBFR6ÜÊvW"FRf˜W&Êó76WW"R÷ñ∆ñWRGP¢ÚÚ6ˆÊ6ñ∆R¬6RVí‚vW7B2VÊR&67V∆RBvñFVÁFñfñÁB÷ó2V‚WG&R6ÜÁFñW"‡¶6ˆÁ7B‘ÙDTƒUÙDU5ÙtTÂE2“∞¢%W'∆WÜóGí’vV"#¢'W'∆WÜóGí˜6ˆÊ"◊&Ú"¿¢$FVW6VV≤’c2#¢&FVW6VV≤ˆFVW6VV≤÷6ÜB"¿¢$÷ó7G&¬‘∆&vR#¢&÷ó7G&∆íˆ÷ó7G&¬◊6÷∆¬”#c2"¿¢%vV‚”2„r‘÷Ç#¢'vV‚˜vV„2„r÷÷Ç"¿¢$˜VÂ&˜WFW"’vV‚#¢'vV‚˜vV„2„r÷÷Ç"¿¢$˜VÂ&˜WFW"‘∂ñ÷í#¢&÷ˆˆÁ6Ü˜Fíˆ∂ñ÷í÷≥""¿¢$ı"’vV„3t÷Ç#¢'vV‚˜vV„2„r÷÷Ç"¿¢$ı"‘∂ñ÷î≥2#¢&÷ˆˆÁ6Ü˜Fíˆ∂ñ÷í÷≥2"¿¢$ı"‘÷ó7G&√t"#¢&÷ó7G&∆íˆ÷ó7G&¬”v"÷ñÁ7G'V7C¶g&VR"¿ß”∞†¶6ˆÁ7B$Ù‘ıÙ‘îÂı$U4Ù≈U2“÷FÇÊ÷ÇÉ#¬ÁV÷&W"á&ˆ6W72ÊVÁbÂ$Ù‘ıÙ‘îÂı$U4Ù≈U2«¬Síì∞¶6ˆÁ7B$Ù‘ıÙ‘$tUÙ‘î‰í“÷FÇÊ÷ÇÉ¬ÁV÷&W"á&ˆ6W72ÊVÁbÂ$Ù‘ıÙ‘$tUÙ‘î‰í«¬Ríì∞†¶gVÊ7Fñˆ‚VFóDvVÁG4WE&ˆ÷˜Fñˆ‚Çí∞¢6ˆÁ7B∆ñvÊW2“µ”∞¢6ˆÁ7B&ˆ÷˜FñˆÁ2“µ”∞¢G'í∞¢6ˆÁ7B7FG2“áF&∆Rí”‚F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí∆˜76W0¢e$Ù“G∑F&∆W“tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72ríu$ıU%ívVÁEˆÊ÷P¢íÊ∆¬ÇíÊ÷á"”‚∞¢6ˆÁ7B&W6ˆ«W2“á"ÁvñÁ2«¬í≤á"Ê∆˜76W2«¬ì∞¢&WGW&‚≤Êˆ”¢"ÊvVÁEˆÊ÷R¬&W6ˆ«W2¬vñÁ&FS¢&W6ˆ«W2Ú÷FÇÁ&˜VÊBá"ÁvñÁ2Ú&W6ˆ«W2¢í¢ÁV∆¬”∞¢“íÊfñ«FW"á"”‚"Á&W6ˆ«W2„“$Ù‘ıÙ‘îÂı$U4Ù≈U2ê¢Á6˜'BÇÜ¬"í”‚"ÁvñÁ&FR“ÁvñÁ&FRì∞†¢ÚÚÊR6ˆ◊&W"VR∆W24îÂFóGV∆ó&W27GVV«2‚¬vÊ6ñVÊÊRfW'6ñˆ‚ñÊ6«Vó@¢ÚÚu$ı‘∆∆÷WBBvWG&W2vVÁG2&WFó&W2¬Vó2FV÷ÊFóBFR&V◊∆6W"V‡¢ÚÚ6ñVvRVí‚vWÜó7FóB«W2¢fWÇFñvÊ˜7Fñ2gRFÁ2¬vVFóBGR#bÛÇ‡¢6ˆÁ7BFóGV∆ó&W2“7FG2Ç&vVÁE˜&VFñ7FñˆÁ2"ê¢Êfñ«FW"á"”‚4Ù‰4îƒUÙtTÂEÙ‰‘U2ÊñÊ6«VFW2á"ÊÊˆ“íì∞¢6ˆÁ7B÷ˆFV∆W47Fñg2“ÊWr6WBÑ4Ù‰4îƒUÙtTÂEÙ‰‘U0¢Ê÷ÜÊˆ“”‚‘ÙDTƒUÙDU5ÙtTÂE5∂Êˆ’“ê¢Êfñ«FW"Ñ&ˆˆ∆V‚ê¢Ê÷á&W6ˆ«fT÷ˆFV¬íì∞¢6ˆÁ7B6Ü∆∆VÊvW'2“7FG2Ç'6ÜF˜uˆWf«2"ê¢Êfñ«FW"á"”‚∞¢6ˆÁ7B∆ˆvóVR“‘ÙDTƒUÙDU5ÙtTÂE5∑"ÊÊˆ’”∞¢&WGW&‚∆ˆvóVR«¬÷ˆFV∆W47Fñg2ÊÜ2á&W6ˆ«fT÷ˆFV¬Ü∆ˆvóVRíì∞¢“ì∞¢ñbÇFóGV∆ó&W2Ê∆VÊwFÇ«¬6Ü∆∆VÊvW'2Ê∆VÊwFÇí∞¢∆ñvÊW2ÁW6ÇÜ(Kû˚àÚ6∆76V÷VÁBî(	BV6ÜÁFñ∆∆ˆ‚ñÁ7Vffó6ÁBÇGµ$Ù‘ıÙ‘îÂı$U4Ù≈U7“&ˆÊ˜7Fñ72&W6ˆ«W2&WVó2"îñì∞¢&WGW&‚≤∆ñvÊW2¬&ˆ÷˜FñˆÁ2”∞¢–†¢6ˆÁ7B÷Vñ∆∆WW$6Ü∆∆VÊvW"“6Ü∆∆VÊvW'5≥”∞¢6ˆÁ7B«W4fñ&∆UFóGV∆ó&R“FóGV∆ó&W5∑FóGV∆ó&W2Ê∆VÊwFÇ“”∞¢∆ñvÊW2ÁW6ÇÜ	˘8¢÷Vñ∆∆WW"FóGV∆ó&RG∑FóGV∆ó&W5≥“ÊÊˆ◊“G∑FóGV∆ó&W5≥“ÁvñÁ&FW“R+r«W2fñ&∆RG∑«W4fñ&∆UFóGV∆ó&RÊÊˆ◊“G∑«W4fñ&∆UFóGV∆ó&RÁvñÁ&FW“R+r÷Vñ∆∆WW"6Ü∆∆VÊvW"G∂÷Vñ∆∆WW$6Ü∆∆VÊvW"ÊÊˆ◊“G∂÷Vñ∆∆WW$6Ü∆∆VÊvW"ÁvñÁ&FW“Vì∞†¢ÚÚ÷&vRWÜñvVR¢V‚V6'BFR˜R"ˆñÁG27W"VV«VW2Fó¶ñÊW2FR÷F6á0¢ÚÚ‚vW7BVRGR''VóB‚ˆ‚ÊR&V◊∆6RV‚FóGV∆ó&RVR7W"V‚V6'BÊWB‡¢6ˆÁ7BV6'B“÷Vñ∆∆WW$6Ü∆∆VÊvW"ÁvñÁ&FR“«W4fñ&∆UFóGV∆ó&RÁvñÁ&FS∞¢ñbÜV6'B¬$Ù‘ıÙ‘$tUÙ‘î‰íí∞¢∆ñvÊW2ÁW6ÇÜ)»R6ˆÊ6ñ∆R(	BV7V‚6Ü∆∆VÊvW"ÊRFW76RV‚FóGV∆ó&RFRGµ$Ù‘ıÙ‘$tUÙ‘î‰ó“ˆñÁG2ÜV6'B7GVV¬G∂V6'G“ñì∞¢&WGW&‚≤∆ñvÊW2¬&ˆ÷˜FñˆÁ2”∞¢–†¢ÚÚ&ˆ÷˜Fñˆ‚ƒïTTRWFˆ÷FóVV÷VÁBÜFV6ó6ñˆ‚GRfˆÊFFWW"¬rÛÇÛ##b†¢ÚÚ'GRFˆó2F˜V¶˜W'2v&FW"∆W2÷Vñ∆∆WW'2¬WB6íGRfó2V‚6ÜÊvV÷VÁBGR÷P¢ÚÚ∆RFó2"í‚∆R6ñVvRGRFóGV∆ó&R6˜'FÁBW7BˆñÁFRfW'2∆R÷ˆFV∆RGP¢ÚÚ6Ü∆∆VÊvW"¬fñ∆÷V÷RF&∆R÷ˆFV≈ˆ˜fW'&ñFW2VR∆W27V'7FóGWFñˆÁ2FP¢ÚÚ÷ˆFV∆W2÷˜'G2‚∆R6ÜÊvV÷VÁBW7BÊÊˆÊ6RFÁ2∆R&˜'BGR÷Fñ‚‡¢6ˆÁ7B6ñ&∆U6˜'FÁB“‘ÙDTƒUÙDU5ÙtTÂE5∑«W4fñ&∆UFóGV∆ó&RÊÊˆ’”∞¢6ˆÁ7B÷ˆFV∆TVÁG&ÁB“‘ÙDTƒUÙDU5ÙtTÂE5∂÷Vñ∆∆WW$6Ü∆∆VÊvW"ÊÊˆ’”∞¢ñbÜ6ñ&∆U6˜'FÁBbb÷ˆFV∆TVÁG&ÁBí∞¢6ˆÁ7Bg&î÷ˆFV∆TVÁG&ÁB“&W6ˆ«fT÷ˆFV¬Ü÷ˆFV∆TVÁG&ÁBì∞¢F"Á&W&RÜîÂ4U%BîÂDÚ÷ˆFV≈ˆ˜fW'&ñFW2Ü∆ˆvñ6≈ˆñB¬÷ˆFV≈ˆñB¬&W∆6VEˆB¬&V6ˆ‚ê¢d≈TU2ÉÚ√Ú∆FFWFñ÷RÇvÊ˜rrí√Úê¢Ù‚4Ù‰dƒî5BÜ∆ˆvñ6≈ˆñBíDÚUDDR4UB÷ˆFV≈ˆñC÷WÜ6«VFVBÊ÷ˆFV≈ˆñB¿¢&W∆6VEˆC÷WÜ6«VFVBÁ&W∆6VEˆB¬&V6ˆ„÷WÜ6«VFVBÁ&V6ˆÊê¢Á'V‚Ü6ñ&∆U6˜'FÁB¬g&î÷ˆFV∆TVÁG&ÁB¿¢&ˆ÷˜Fñˆ‚¢G∂÷Vñ∆∆WW$6Ü∆∆VÊvW"ÊÊˆ◊“G∂÷Vñ∆∆WW$6Ü∆∆VÊvW"ÁvñÁ&FW“R&V◊∆6RG∑«W4fñ&∆UFóGV∆ó&RÊÊˆ◊“G∑«W4fñ&∆UFóGV∆ó&RÁvñÁ&FW“Vì∞¢ˆ÷ˆFVƒ˜fW'&ñFT66ÜRÊB“∞¢&ˆ÷˜FñˆÁ2ÁW6Çá≤VÁG&ÁC¢÷Vñ∆∆WW$6Ü∆∆VÊvW"¬6˜'FÁC¢«W4fñ&∆UFóGV∆ó&R¬V6'B¬÷ˆFV∆S¢g&î÷ˆFV∆TVÁG&ÁB“ì∞¢∆ñvÊW2ÁW6ÇÜ	¯¯R∆#‰4Ñ‰tT‘TÂBR4Ù‰4îƒS¬ˆ#‚(	BG∂÷Vñ∆∆WW$6Ü∆∆VÊvW"ÊÊˆ◊“ÇG∂÷Vñ∆∆WW$6Ü∆∆VÊvW"ÁvñÁ&FW“R7W"G∂÷Vñ∆∆WW$6Ü∆∆VÊvW"Á&W6ˆ«W7“í&V◊∆6RG∑«W4fñ&∆UFóGV∆ó&RÊÊˆ◊“ÇG∑«W4fñ&∆UFóGV∆ó&RÁvñÁ&FW“R7W"G∑«W4fñ&∆UFóGV∆ó&RÁ&W6ˆ«W7“í¬V6'BG∂V6'G“ˆñÁG6ì∞¢∆ñvÊW2ÁW6ÇÜ(i"6ñVvRG∑«W4fñ&∆UFóGV∆ó&RÊÊˆ◊“ˆñÁFRFW6˜&÷ó27W"∆#‚G∑g&î÷ˆFV∆TVÁG&ÁG”¬ˆ#Êì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∑&ˆ÷˜FñˆÂ“G∂÷Vñ∆∆WW$6Ü∆∆VÊvW"ÊÊˆ◊“&V◊∆6RG∑«W4fñ&∆UFóGV∆ó&RÊÊˆ◊“ÇG∂6ñ&∆U6˜'FÁG“”‚G∑g&î÷ˆFV∆TVÁG&ÁG“ñì∞¢“V«6R∞¢ÚÚ6Ü∆∆VÊvW"Ü˜'2˜VÂ&˜WFW"¢ˆ‚ÊRWWB2&67V∆W""6ñ◊∆P¢ÚÚ6ÜÊvV÷VÁBBvñFVÁFñfñÁB¬ˆ‚6ñvÊ∆R6Á2&ñV‚676W"‡¢&ˆ÷˜FñˆÁ2ÁW6Çá≤VÁG&ÁC¢÷Vñ∆∆WW$6Ü∆∆VÊvW"¬6˜'FÁC¢«W4fñ&∆UFóGV∆ó&R¬V6'B¬÷ˆFV∆S¢ÁV∆¬“ì∞¢∆ñvÊW2ÁW6ÇÜ	¯¯R∆#Â&ˆ÷˜Fñˆ‚fó&R∆÷ñ„¬ˆ#‚(	BG∂÷Vñ∆∆WW$6Ü∆∆VÊvW"ÊÊˆ◊“ÇG∂÷Vñ∆∆WW$6Ü∆∆VÊvW"ÁvñÁ&FW“Rí&BG∑«W4fñ&∆UFóGV∆ó&RÊÊˆ◊“ÇG∑«W4fñ&∆UFóGV∆ó&RÁvñÁ&FW“RíFRG∂V6'G“ˆñÁG2¬÷ó2ñ¬6ÜÊvRFRf˜W&Êó76WW"¢&67V∆R÷ÁVV∆∆R&WVó6Vì∞¢–†¢ÚÚ÷Vñ∆∆WW"vVÁB"‘$4ÑR¢VÊRîWWBWG&R÷˜ñVÊÊRRvVÊW&¬W@¢ÚÚWÜ6V∆∆VÁFR7W"V‚÷&6ÜR&V6ó2‚2vW7B∆VR6RvvÊR∆RvñÁ&FR‡¢6ˆÁ7B÷&6ÜW2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¬÷&∂WEˆ∆ñÊR¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí∆˜76W0¢e$Ù“vVÁEˆ÷&∂WE˜&VFñ7FñˆÁ2tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rê¢u$ıU%ívVÁEˆÊ÷R¬÷&∂WEˆ∆ñÊP¢íÊ∆¬Çì∞¢6ˆÁ7B∆ñ&V∆∆W2“≤'WG3¢%«W2ˆ÷ˆñÁ2FR"„R"¬'GG3¢$∆W2FWWÇ÷'VVÁB"¬&W7V«FC¢%fñ7Fˆó&RFˆ“ˆWáB"¬◊C¢$'WB&R÷í◊FV◊2"”∞¢6ˆÁ7B÷Vñ∆∆WW'2“∑”∞¢÷&6ÜW2Êf˜$V6Çá"”‚∞¢6ˆÁ7B&W6ˆ«W2“á"ÁvñÁ2«¬í≤á"Ê∆˜76W2«¬ì∞¢ñbá&W6ˆ«W2¬Rí&WGW&„∞¢6ˆÁ7Bw"“÷FÇÁ&˜VÊBá"ÁvñÁ2Ú&W6ˆ«W2¢ì∞¢ñbÇ÷Vñ∆∆WW'5∑"Ê÷&∂WEˆ∆ñÊU“«¬w"‚÷Vñ∆∆WW'5∑"Ê÷&∂WEˆ∆ñÊU“Áw"í∞¢÷Vñ∆∆WW'5∑"Ê÷&∂WEˆ∆ñÊU““≤Êˆ”¢"ÊvVÁEˆÊ÷R¬w"¬&W6ˆ«W2”∞¢–¢“ì∞¢6ˆÁ7B$÷&6ÜR“ˆ&¶V7BÊVÁG&ñW2Ü÷Vñ∆∆WW'2ê¢Ê÷ÇÖ∂≤¬e“í”‚G∂∆ñ&V∆∆W5∂µ“«¬∑“(i"G∑bÊÊˆ◊“G∑bÁw'“RÇG∑bÁ&W6ˆ«W7“ñì∞¢ñbá$÷&6ÜRÊ∆VÊwFÇí∆ñvÊW2ÁW6ÇÜ	¯ÍÚ÷Vñ∆∆WW&Rî"÷&6ÜR¢G∑$÷&6ÜRÊ¶ˆñ‚Ç"+r"ó÷ì∞¢“6F6ÇÜRí∞¢∆ñvÊW2ÁW6ÇÜ	˘KB6∆76V÷VÁBî(	BGµ7G&ñÊrÜRÊ÷W76vRíÁ6∆ñ6RÉ¬có÷ì∞¢–¢&WGW&‚≤∆ñvÊW2¬&ˆ÷˜FñˆÁ2”∞ß–†¢ÚÚ∆ñW'2FR6ˆ∆FR˜VÂ&˜WFW"¬V‚Fˆ∆∆'2(	B¬tíf7GW&RV‚B¬2V‚(*¬‡¢ÚÚf∆WW'2fóÜVW2"∆RfˆÊFFWW"¢˜&ÊvR2¬&˜VvR‡¶6ˆÁ7B4ÙƒDUÙı$‰tR“ÁV÷&W"á&ˆ6W72ÊVÁbÂ4ÙƒDUÙı$‰tR«¬2ì∞¶6ˆÁ7B4ÙƒDUı$ıTtR“ÁV÷&W"á&ˆ6W72ÊVÁbÂ4ÙƒDUı$ıTtR«¬ì∞†¶7ñÊ2gVÊ7Fñˆ‚'V‰÷˜&ÊñÊtVFóBÇí∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí&WGW&‚f«6S∞¢6ˆÁ7B∆ñvÊW2“µ”∞¢6ˆÁ7BÊÊW2“µ”∞¢6ˆÁ7BfW'Fó76V÷VÁG2“µ”∞¢6ˆÁ7BFW7B“7ñÊ2ÜÊˆ“¬f‚í”‚∞¢G'í∞¢6ˆÁ7B"“vóBf‚Çì∞¢ñbá"bb"Êˆ≤í≤∆ñvÊW2ÁW6ÇÜ)»RG∂Êˆ◊“(	BG∑"ÊñÊf˜÷ì≤–¢V«6Rñbá"bb"ÊÊófVR””“&˜&ÊvR"í∞¢ÚÚV‚fW'Fó76V÷VÁB‚vW7B2VÊRÊÊR¢∆R6W'fñ6RfˆÊ7FñˆÊÊRVÊ6˜&R‡¢ÚÚ∆R6ˆ◊FW"6ˆ÷÷RÊÊR&Ê∆ó6W&óB¬vVÁFWFR&˜VvR¬VíFˆóB&W7FW ¢ÚÚ&W6W'fVR6RVíW7B&VV∆∆V÷VÁB676R‡¢∆ñvÊW2ÁW6ÇÜ	˘˙G∂Êˆ◊“(	BG∑"ÊñÊf˜÷ì∞¢fW'Fó76V÷VÁG2ÁW6ÇÜÊˆ“ì∞¢–¢V«6R≤∆ñvÊW2ÁW6ÇÜ	˘KBG∂Êˆ◊“(	BG∑#ÚÊñÊfÚ«¬&V6ÜV2'÷ì≤ÊÊW2ÁW6ÇÜÊˆ“ì≤–¢“6F6ÇÜRí∞¢∆ñvÊW2ÁW6ÇÜ	˘KBG∂Êˆ◊“(	BGµ7G&ñÊrÜRÊ÷W76vRíÁ6∆ñ6RÉ¬só÷ì∞¢ÊÊW2ÁW6ÇÜÊˆ“ì∞¢–¢”∞†¢ÚÚ‚∆R6ˆ◊FR˜VÂ&˜WFW"¢6ˆ∆FR&W7FÁBWBWFˆÊˆ÷ñRW7Fñ÷VR‡¢ÚÚFV÷ÊFRGRfˆÊFFWW"ÉrÛÇÛ##bí¢&Fó2÷÷ˆí6ÜVR¶˜W"6ˆ÷&ñV‚ñ¬&W7FP¢ÚÚ7W"˜VÂ&˜WFW"˜W"Rvˆ‚ÊR6ˆóB26Á2Ê«ó6R"‚ˆí˜cˆ∂WíÊRFˆÊÊP¢ÚÚVR∆6ˆÁ6ˆ÷÷Fñˆ‚≤∆R6ˆ∆FR&VV∆∆V÷VÁB&V6Ü&vRW7BFÁ0¢ÚÚˆí˜cˆ7&VFóG2‚ˆ‚7&ˆó6R∆W2FWWÇ˜W"6˜'Fó"VÊRWFˆÊˆ÷ñRV‚§ıU%2¿¢ÚÚ6WV¬6Üñfg&RVíW&÷WGFRFR&V6Ü&vW"fÁB∆ÊÊR«WF˜BRv&W2‡¢vóBFW7BÇ%6ˆ∆FR˜VÂ&˜WFW""¬7ñÊ2Çí”‚∞¢ñbÇıTÂ$ıUDU%ÙïÙ¥Uíí&WGW&‚≤ˆ≥¢f«6R¬ñÊfÛ¢&V7VÊR6∆R6ˆÊfñwW&VR"”∞¢6ˆÁ7BVÁFWFR“≤WFÜ˜&ó¶Fñˆ„¢&V&W"G¥ıTÂ$ıUDU%ÙïÙ¥Uó÷”∞¢6ˆÁ7B6∆R“vóBáGGvWBÇ&áGG3¢Úˆ˜VÁ&˜WFW"Êíˆí˜cˆ∂Wí"¬VÁFWFRì∞¢6ˆÁ7BB“6∆SÚÊFF∞¢ñbÇBí&WGW&‚≤ˆ≥¢f«6R¬ñÊfÛ¢&6∆R&VgW6VR"˜VÂ&˜WFW""”∞†¢6ˆÁ7B$¶˜W"“ÁV÷&W"ÜBÁW6vUˆFñ«í«¬ì∞¢6ˆÁ7B7&VFóG2“vóBáGGvWBÇ&áGG3¢Úˆ˜VÁ&˜WFW"Êíˆí˜cˆ7&VFóG2"¬VÁFWFRì∞¢6ˆÁ7B6ÜWFW2“ÁV÷&W"Ü7&VFóG3ÚÊFFÚÁF˜F≈ˆ7&VFóG2ÛÚÊ‚ì∞¢6ˆÁ7B6ˆÁ6ˆ÷÷W2“ÁV÷&W"Ü7&VFóG3ÚÊFFÚÁF˜F≈˜W6vRÛÚBÁW6vRÛÚì∞¢ÚÚV‚∆fˆÊBFR6∆R¬2vñ¬WÜó7FR¬&ñ÷R¢ñ¬6˜WRfÁB∆R6ˆ∆FR&VV¬‡¢6ˆÁ7B∆fˆÊB“BÊ∆ñ÷óB””“ÁV∆¬«¬BÊ∆ñ÷óB””“VÊFVfñÊVBÚÁV∆¬¢ÁV÷&W"ÜBÊ∆ñ÷óBí“ÁV÷&W"ÜBÁW6vR«¬ì∞¢6ˆÁ7B6ˆ∆FR“ÁV÷&W"Êó4fñÊóFRÜ6ÜWFW2íÚ6ÜWFW2“6ˆÁ6ˆ÷÷W2¢∆fˆÊC∞†¢ñbá6ˆ∆FR””“ÁV∆¬«¬ÁV÷&W"Êó4fñÊóFRá6ˆ∆FRíí∞¢&WGW&‚≤ˆ≥¢G'VR¬ñÊfÛ¢G∂6ˆÁ6ˆ÷÷W2ÁFÙfóÜVBÉ"ó“B6ˆÁ6ˆ÷÷W2RF˜F¬+rG∑$¶˜W"ÁFÙfóÜVBÉ"ó“BV¶˜W&BváVí+r6ˆ∆FRÊˆ‚6ˆ÷◊VÊóVR"˜VÂ&˜WFW&”∞¢–¢ÚÚWFˆÊˆ÷ñR7W"∆÷˜ñVÊÊRFW2rFW&ÊñW'2¶˜W'2FR&ˆGV7Fñˆ‚¬«W2fñ&∆P¢ÚÚVR∆6ˆÁ6ˆ÷÷Fñˆ‚GR¶˜W"÷V÷RÜÁV∆∆RfÇGR÷Fñ‚í‡¢∆WB÷˜ñVÊÊR“$¶˜W#∞¢G'í∞¢6ˆÁ7B"“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í‚e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RÊ«ó6VEˆB„“Ú"ê¢ÊvWBÜÊWrFFRÑFFRÊÊ˜rÇí“r¢ÉcFSRíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ííÁ&W∆6RÇ%B"¬""íì∞¢ÚÚRV«2î"Ê«ó6R¬6˜WBˆ'6W'fR„„"B¬vV¬‡¢6ˆÁ7BW7Fñ÷R“Çá#ÚÊ‚«¬íÚrí¢R¢„#∞¢÷˜ñVÊÊR“÷FÇÊ÷Çá$¶˜W"¬W7Fñ÷Rì∞¢“6F6ÇÜRí≤Ú¢ˆ‚v&FR$¶˜W"¢Ú–¢6ˆÁ7B¶˜W'2“÷˜ñVÊÊR‚„RÚ÷FÇÊf∆ˆ˜"á6ˆ∆FRÚ÷˜ñVÊÊRí¢ÁV∆√∞¢6ˆÁ7BFWFñ¬“∆#‚G∑6ˆ∆FRÁFÙfóÜVBÉ"ó“B&W7FÁG3¬ˆ#‚+rG∑$¶˜W"ÁFÙfóÜVBÉ"ó“B6ˆÁ6ˆ÷÷W2V¶˜W&BváVñ∞¢Ü¶˜W'2”“ÁV∆¬Ú+rWFˆÊˆ÷ñR‚G∂¶˜W'7“¶˜W"G∂¶˜W'2‚Ú'2"¢"'÷¢""ì∞¢ÚÚ∆ñW'2fóÜW2"∆RfˆÊFFWW"ÉrÛÇÛ##bí¢˜&ÊvR2¬&˜VvR‡¢ÚÚV‚∆ñW"7W"∆R4ÙƒDRV‚«W2FR¬vWFˆÊˆ÷ñR¢¬vWFˆÊˆ÷ñRFWVÊBGP¢ÚÚfˆ«V÷RFR÷F6á2¬Ví2vVffˆÊG&RV‚G&WfRVó2Wá∆˜6R∆&W&ó6R‚V‡¢ÚÚ6ˆ∆FRFR"B&óB6ˆÊf˜'F&∆R∆RB˜WBWBÊRFñVÁB2G&ˆó2¶˜W'0¢ÚÚ∆Rb‡¢ñbá6ˆ∆FR√“4ÙƒDUı$ıTtRí&WGW&‚≤ˆ≥¢f«6R¬ñÊfÛ¢G∂FWFñ«“(	B∆#Â$T4Ñ$tR‘îÂDT‰ÂC¬ˆ#‚¬∆W2Ê«ó6W2fˆÁB2v'&WFW&”∞¢ñbá6ˆ∆FR√“4ÙƒDUÙı$‰tRí&WGW&‚≤ˆ≥¢f«6R¬ÊófVS¢&˜&ÊvR"¬ñÊfÛ¢G∂FWFñ«“(	BVÁ6R&V6Ü&vW&”∞¢ñbÜ¶˜W'2”“ÁV∆¬bb¶˜W'2√“rí&WGW&‚≤ˆ≥¢f«6R¬ÊófVS¢&˜&ÊvR"¬ñÊfÛ¢G∂FWFñ«“(	B÷ˆñÁ2BwVÊR6V÷ñÊRBvWFˆÊˆ÷ñV”∞¢&WGW&‚≤ˆ≥¢G'VR¬ñÊfÛ¢FWFñ¬”∞¢“ì∞†¢ÚÚ&ó2‚6ÜVR÷ˆFV∆RGR6ˆÊ6ñ∆R¬FW7FR7W"∆W26óÇ÷&6ÜW2&VV∆∆V÷VÁ@¢ÚÚFñfgW6W2¬WB&V◊∆6RWFˆ÷FóVV÷VÁB2vñ¬Fó7'RGR6F∆ˆwVR‡¢∆WB&W&Fñˆ‚“≤∆ñvÊW3¢µ“¬ÊÊW3¢µ“¬&W&W3¢µ“”∞¢G'í∞¢&W&Fñˆ‚“vóBVFóDÊE&Wó$÷ˆFV«2Çì∞¢∆ñvÊW2ÁW6ÇÇ‚‚Á&W&Fñˆ‚Ê∆ñvÊW2ì∞¢ÊÊW2ÁW6ÇÇ‚‚Á&W&Fñˆ‚ÁÊÊW2ì∞¢“6F6ÇÜRí∞¢∆ñvÊW2ÁW6ÇÜ	˘KB÷ˆFV∆W2(	BVFóBñ◊˜76ñ&∆R¢Gµ7G&ñÊrÜRÊ÷W76vRíÁ6∆ñ6RÉ¬có÷ì∞¢ÊÊW2ÁW6ÇÇ$÷ˆFV∆W2"ì∞¢–†¢ÚÚ"‚∆R6ˆÊ6ñ∆R«Ví÷÷V÷R¢W7B÷6RRvñ¬DTƒî$U$R¬26WV∆V÷VÁBRvñ¬F˜W&ÊR‡¢vóBFW7BÇ$6ˆÊ6ñ∆Ráf˜FRFW2îí"¬7ñÊ2Çí”‚∞¢6ˆÁ7BFWVó2“ÊWrFFRÑFFRÊÊ˜rÇí“#B¢3cS2íÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ííÁ&W∆6RÇ%B"¬""ì∞¢6ˆÁ7B&˜w2“F"Á&W&RÇ%4TƒT5B6ˆÊfñFVÊ6R¬6ˆÁ6VÁ7W5˜f˜FW2e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RÊ«ó6VEˆB„“Ú"íÊ∆¬ÜFWVó2ì∞¢ñbÇ&˜w2Ê∆VÊwFÇí&WGW&‚≤ˆ≥¢G'VR¬ñÊfÛ¢&V7VÊRÊ«ó6RV‚#FÇáG&WfR˜RÁVóBí"”∞¢6ˆÁ7B6Á5f˜FR“÷FÇÁ&˜VÊBá&˜w2Êfñ«FW"á"”‚"Ê6ˆÁ6VÁ7W5˜f˜FW2íÊ∆VÊwFÇÚ&˜w2Ê∆VÊwFÇ¢ì∞¢6ˆÁ7B6Á46ˆÁ2“÷FÇÁ&˜VÊBá&˜w2Êfñ«FW"á"”‚ÁV÷&W"á"Ê6ˆÊfñFVÊ6Rí√“SRíÊ∆VÊwFÇÚ&˜w2Ê∆VÊwFÇ¢ì∞¢ñbá6Á5f˜FR„“#Rí&WGW&‚≤ˆ≥¢f«6R¬ñÊfÛ¢G∑6Á5f˜FW“R6Á2V7V‚f˜FR7W"G∑&˜w2Ê∆VÊwFá“Ê«ó6W6”∞¢ñbá6Á46ˆÁ2„“Sí&WGW&‚≤ˆ≥¢f«6R¬ñÊfÛ¢G∑6Á46ˆÁ7“R6Á26ˆÁ6VÁ7W27W"G∑&˜w2Ê∆VÊwFá“Ê«ó6W6”∞¢&WGW&‚≤ˆ≥¢G'VR¬ñÊfÛ¢G∑&˜w2Ê∆VÊwFá“Ê«ó6W2¬G∑6Á5f˜FW“R6Á2f˜FR¬G∑6Á46ˆÁ7“R6Á26ˆÁ6VÁ7W6”∞¢“ì∞†¢ÚÚ2‚fˆ«V÷R‹:óFñW"¢¨:ó&Ú6ñvÊ¬WWB:ßG&R&fóFV÷VÁBÊ˜&÷¬fV2∆W2fñ«G&W0¢ÚÚ7G&ñ7G2BÛR‚∆RG&Á7˜'BFV∆Vw&“W7B6ˆÁG,;FÃ:í<:ó,:ñ÷VÁBßW7FR,:á2‡¢vóBFW7BÇ%fˆ«V÷RFR6ñvÊWÇ"¬7ñÊ2Çí”‚∞¢6ˆÁ7BFWVó2“ÊWrFFRÑFFRÊÊ˜rÇí“CÇ¢3cS2íÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ííÁ&W∆6RÇ%B"¬""ì∞¢6ˆÁ7B&˜w2“F"Á&W&RÇ%4TƒT5B6ñu˜6VÁE˜7FÊF&B2¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFRRe$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RÊ«ó6VEˆB„“Ú"íÊ∆¬ÜFWVó2ì∞¢6ˆÁ7BVÁf˜ñW2“&˜w2Êfñ«FW"á"”‚"Á2””“«¬"Á””“«¬"ÊR””“íÊ∆VÊwFÉ∞¢ñbá&˜w2Ê∆VÊwFÇ„“3bbVÁf˜ñW2””“í∞¢&WGW&‚≤ˆ≥¢f«6R¬ÊófVS¢&˜&ÊvR"¬ñÊfÛ¢6ñvÊ¬F÷ó76ñ&∆R7W"G∑&˜w2Ê∆VÊwFá“Ê«ó6W2V‚CÜÇ(	Bfñ«G&W2BÛR¬G&Á7˜'Bl:ó&ñfú:í<:ó,:ñ÷VÁF”∞¢–¢&WGW&‚≤ˆ≥¢G'VR¬ñÊfÛ¢G∂VÁf˜ñW7“6ñvÊWÇFñfgW<:ó2V‚CÜÜ”∞¢“ì∞†¢ÚÚB‚∆W26ÊWÇWÜó7FVÁB÷ñ«2F˜V¶˜W'2WB∆R&˜Bí◊B÷ñ¬66W2‡¢vóBFW7BÇ$6ÊWÇFV∆Vw&“"¬7ñÊ2Çí”‚∞¢ñbÇDTƒTu$’Ù$ıEıDÙ¥T‚í&WGW&‚≤ˆ≥¢f«6R¬ñÊfÛ¢&V7V‚Fˆ∂V‚"”∞¢6ˆÁ7B6ÊWÇ“µ≤$w&GVóB"¬DTƒTu$’Ù4Ñ‰‰T≈ÙîE“¬≤%7FÊF&B"¬DTƒTu$’ı5D‰D$EÙ4Ñ‰‰T≈ÙîE“¿¢≤%&V÷óV“"¬DTƒTu$’ı$T‘ïT’Ù4Ñ‰‰T≈ÙîE’”∞¢6ˆÁ7B÷˜'G2“µ”∞¢f˜"Ü6ˆÁ7B∂Êˆ“¬ñE“ˆb6ÊWÇí∞¢ñbÇñBí≤÷˜'G2ÁW6ÇÜG∂Êˆ◊“Êˆ‚6ˆÊfñwW&Vì≤6ˆÁFñÁVS≤–¢6ˆÁ7B"“vóBáGGvWBÜáGG3¢ÚˆíÁFV∆Vw&“Ê˜&rˆ&˜BGµDTƒTu$’Ù$ıEıDÙ¥TÁ“ˆvWD6ÜCˆ6ÜEˆñC“G∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÜñBó÷ì∞¢ñbÇ#ÚÊˆ≤í÷˜'G2ÁW6ÇÜÊˆ“ì∞¢–¢&WGW&‚÷˜'G2Ê∆VÊwFÇÚ≤ˆ≥¢f«6R¬ñÊfÛ¢ñÊ¶ˆñvÊ&∆W2¢G∂÷˜'G2Ê¶ˆñ‚Ç"¬"ó÷“¢≤ˆ≥¢G'VR¬ñÊfÛ¢#26ÊWÇ6∆ñVÁG2¶ˆñvÊ&∆W2"”∞¢“ì∞†¢ÚÚR‚ñV÷VÁG2‚6Á27G&óR¬V7V‚&ˆÊÊV÷VÁBÊRWWBWG&R&ó2‡¢vóBFW7BÇ%7G&óR"¬7ñÊ2Çí”‚∞¢ñbÇ5E$ïUı4T5$UEÙ¥Uíí&WGW&‚≤ˆ≥¢f«6R¬ñÊfÛ¢&V7VÊR6∆R"”∞¢6ˆÁ7B"“vóBáGGvWBÇ&áGG3¢ÚˆíÁ7G&óRÊ6ˆ“˜cˆ&∆Ê6R"¬≤WFÜ˜&ó¶Fñˆ„¢&V&W"Gµ5E$ïUı4T5$UEÙ¥Uó÷“ì∞¢&WGW&‚"bb"ÊW'&˜"Ú≤ˆ≥¢G'VR¬ñÊfÛ¢$í¶ˆñvÊ&∆R"“¢≤ˆ≥¢f«6R¬ñÊfÛ¢7G&ñÊrá#ÚÊW'&˜#ÚÊ÷W76vR«¬'&VgW2"íÁ6∆ñ6RÉ¬cí”∞¢“ì∞†¢ÚÚb‚V÷ñ«2‡¢vóBFW7BÇ$'&WfÚ"¬7ñÊ2Çí”‚∞¢ñbÇ%$UdıÙïÙ¥Uíí&WGW&‚≤ˆ≥¢f«6R¬ñÊfÛ¢&V7VÊR6∆R"”∞¢6ˆÁ7B"“vóBáGGvWBÇ&áGG3¢ÚˆíÊ'&WfÚÊ6ˆ“˜c2ˆ66˜VÁB"¬≤&í÷∂Wí#¢%$UdıÙïÙ¥Uí“ì∞¢&WGW&‚"bb"Ê6ˆFRÚ≤ˆ≥¢G'VR¬ñÊfÛ¢$í¶ˆñvÊ&∆R"“¢≤ˆ≥¢f«6R¬ñÊfÛ¢7G&ñÊrá#ÚÊ÷W76vR«¬'&VgW2"íÁ6∆ñ6RÉ¬cí”∞¢“ì∞†¢ÚÚr‚V˜FFRFˆÊÊVW27˜'FófW2¢6V2¬«W2V7V‚÷F6Ç‚vVÁG&R‚ˆ‡¢ÚÚñÁFW'&ˆvR∆R6ˆ◊FWW"$TT¬GRf˜W&Êó76WW"¬2Ê˜G&R6ˆ◊FvR∆ˆ6¬‡¢vóBFW7BÇ%V˜Fí’7˜'G2"¬7ñÊ2Çí”‚∞¢6ˆÁ7B“vóB6ÜV6¥ï7˜'G5&V≈V˜FÇì∞¢ñbáÚÊW'&˜"í&WGW&‚≤ˆ≥¢f«6R¬ñÊfÛ¢7G&ñÊráÊW'&˜"íÁ6∆ñ6RÉ¬sí”∞¢&WGW&‚Á7B„“ì ¢Ú≤ˆ≥¢f«6R¬ñÊfÛ¢G∑Á7G“R6ˆÁ6ˆ÷÷RÇG∑ÁW6VG“ÚG∑Ê∆ñ÷óG“ñ–¢¢≤ˆ≥¢G'VR¬ñÊfÛ¢G∑Á7G“R6ˆÁ6ˆ÷÷RÇG∑ÁW6VG“ÚG∑Ê∆ñ÷óG“ñ”∞¢“ì∞†¢ÚÚÇ‚∆R6óFR&WˆÊB÷ñ¬WÇfó6óFWW'2‡¢vóBFW7BÇ%6óFRV&∆ñ2"¬7ñÊ2Çí”‚∞¢6ˆÁ7B"“vóBÊWr&ˆ÷ó6RÇá&W2í”‚∞¢6ˆÁ7B“&WVó&RÇ&áGG2"íÊvWBÖ4ïDUÙ$4UıU$¬¬áÇí”‚≤ÇÁ&W7V÷RÇì≤&W2áÇÁ7FGW46ˆFRì≤“ì∞¢Êˆ‚Ç&W'&˜""¬Çí”‚&W2Éíì≤Á6WEFñ÷V˜WBÉÉ¬Çí”‚≤ÊFW7G&˜íÇì≤&W2Éì≤“ì∞¢“ì∞¢&WGW&‚"””“#Ú≤ˆ≥¢G'VR¬ñÊfÛ¢$ÖEE#"“¢≤ˆ≥¢f«6R¬ñÊfÛ¢ÖEEG∑"«¬&ñÊ¶ˆñvÊ&∆R'÷”∞¢“ì∞†¢ÚÚáFW"‚&WWfR6Üñfg&VR7W"∆W2V«2vVÁG2‚2vW7B6R&∆ˆ2VíFˆó@¢ÚÚG&Ê6ÜW"VÁG&R'Fñ÷V˜WBG&˜6˜W'B"WB&WG&R6W6R"(	B6Á2«Ví¬ˆ‡¢ÚÚÊRfW&óBVRFW∆6W"VÊRáó˜FÜW6R‚∆W2W&6VÁFñ∆W26ˆ◊FVÁB«W0¢ÚÚVR∆÷˜ñVÊÊR¢6í∆Rì6ˆ∆∆RR∆fˆÊBGRFñ÷V˜WB¬2vW7B«Ví‡¢G'í∞¢6ˆÁ7BFWVó2“ÊWrFFRÑFFRÊÊ˜rÇí“#B¢3cS2íÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ííÁ&W∆6RÇ%B"¬""ì∞¢6ˆÁ7BV«2“F"Á&W&RÇ%4TƒT5BvVÁEˆÊ÷R¬GW&VUˆ◊2¬ó77VR¬f˜FU˜&ˆGVóBe$Ù“vVÁEˆ6∆«2tÑU$R7&VFVEˆB„“Ú"íÊ∆¬ÜFWVó2ì∞¢ñbÜV«2Ê∆VÊwFÇí∞¢6ˆÁ7B$ó77VR“∑”∞¢V«2Êf˜$V6ÇÜ”‚≤$ó77VU∂Êó77VU““á$ó77VU∂Êó77VU“«¬í≤≤“ì∞¢6ˆÁ7BGW&VW2“V«2Ê÷Ü”‚ÊGW&VUˆ◊2íÁ6˜'BÇáÇ¬íí”‚Ç“íì∞¢6ˆÁ7B2“áí”‚GW&VW5¥÷FÇÊ÷ñ‚ÜGW&VW2Ê∆VÊwFÇ“¬÷FÇÊf∆ˆ˜"ÜGW&VW2Ê∆VÊwFÇ¢íï”∞¢6ˆÁ7B∆fˆÊB“÷FÇÊ÷ÇÉ#¬ÁV÷&W"á&ˆ6W72ÊVÁb‰tTÂEıDî‘TıUEÙ’2í«¬ì∞¢6ˆÁ7Bf˜FW2“V«2Êfñ«FW"Ü”‚Áf˜FU˜&ˆGVóB””“íÊ∆VÊwFÉ∞¢∆ñvÊW2ÁW6ÇÇ""¬	˘J¬∆#‰V«2vVÁG2É#FÇì¬ˆ#‚(	BG∂V«2Ê∆VÊwFá“FVÁFFófW2¬G∑f˜FW7“f˜FW2&ˆGVóG6ì∞¢∆ñvÊW2ÁW6ÇÜó77VW2¢G¥ˆ&¶V7BÊVÁG&ñW2á$ó77VRíÁ6˜'BÇÜ¬"í”‚%≥““≥“íÊ÷ÇÖ∂≤¬Â“í”‚G∂∑“G∂Á÷íÊ¶ˆñ‚Ç"+r"ó÷ì∞¢∆ñvÊW2ÁW6ÇÜGW&VW2¢÷VFñÊRG∑2É„Ró÷◊2+rìG∑2É„íó÷◊2+r÷ÇG∂GW&VW5∂GW&VW2Ê∆VÊwFÇ“◊÷◊2á∆fˆÊBG∑∆fˆÊG÷◊2ñì∞¢6ˆÁ7BFñ÷V˜WG2“$ó77VRÁFñ÷V˜WB«¬∞¢6ˆÁ7B'EFñ÷V˜WB“÷FÇÁ&˜VÊBáFñ÷V˜WG2ÚV«2Ê∆VÊwFÇ¢ì∞¢∆ñvÊW2ÁW6Çá2É„íí„“∆fˆÊB¢„í«¬'EFñ÷V˜WB„“# ¢Ú(i"∆#Ê∆R∆fˆÊBW7B&ñV‚∆Rf7FWW"∆ñ÷óFÁC¬ˆ#‚ÇG∑'EFñ÷V˜WG“RFRFñ÷V˜WG2¬ìG∑2É„íó÷◊2ñ ¢¢(i"∆R∆fˆÊB‚vW7B2∆Rf7FWW"∆ñ÷óFÁBÇG∑'EFñ÷V˜WG“RFRFñ÷V˜WG2í¢6ÜW&6ÜW"ñ∆∆WW'6ì∞¢ÚÚ"vVÁB¢ñFVÁFñfñRV‚f˜W&Êó76WW"&V6ó2«WF˜BRwV‚&ˆ&∆V÷Rv∆ˆ&¬‡¢6ˆÁ7B$vVÁB“∑”∞¢V«2Êf˜$V6ÇÜ”‚∞¢$vVÁE∂ÊvVÁEˆÊ÷U““$vVÁE∂ÊvVÁEˆÊ÷U“«¬≤„¢¬∂Û¢¬c¢¬6ˆ÷÷S¢”∞¢6ˆÁ7BR“$vVÁE∂ÊvVÁEˆÊ÷U”∞¢RÊ‚≤≥≤RÁ6ˆ÷÷R≥“ÊGW&VUˆ◊3∞¢ñbÜÊó77VR”“&ˆ≤"íRÊ∂Ú≤≥∞¢ñbÜÁf˜FU˜&ˆGVóB””“íRÁb≤≥∞¢“ì∞¢ˆ&¶V7BÊVÁG&ñW2á$vVÁBíÁ6˜'BÇÜ¬"í”‚%≥“Ê∂Ú“≥“Ê∂ÚíÁ6∆ñ6RÉ¬bíÊf˜$V6ÇÇÖ∂Êˆ“¬U“í”‚∞¢∆ñvÊW2ÁW6ÇÜG∂Êˆ◊“¢G∂RÁg“ÚG∂RÊÁ“f˜FW2+rG¥÷FÇÁ&˜VÊBÜRÁ6ˆ÷÷RÚRÊ‚ó÷◊2÷˜ñV‚+rG∂RÊ∂˜“V6ÜV76ì∞¢“ì∞¢“V«6R∞¢∆ñvÊW2ÁW6ÇÇ""¬	˘J¬V«2vVÁG2(	BV7VÊRG&6R7W"#FÇáFV∆V÷WG&ñR˜6VR6R6ˆó"¬V∆∆R6R&V◊∆ó&R&ˆ6Üñ‚÷F6Çñì∞¢–¢“6F6ÇÜRí≤∆ñvÊW2ÁW6ÇÜ	˘KBFV∆V÷WG&ñRvVÁG2(	BGµ7G&ñÊrÜRÊ÷W76vRíÁ6∆ñ6RÉ¬có÷ì≤–†¢ÚÚÜ&ó2‚÷ˆFR6ÜF˜rGR&˜WFvR"7V6ñ∆ó7FR¢6RRvñ¬U$ïB6ÜÊvR‡¢ÚÚV7VÊRFR6W2Ê«ó6W2‚vWFRFñfgW6VR(	B∆R&˜'B6W'BVÊóVV÷VÁ@¢ÚÚFV6ñFW"¬7W"FWWÇ6V÷ñÊW2FRFˆÊÊVW2&VV∆∆W2¬2vñ¬fWB∆VñÊP¢ÚÚBvWG&R7FófR‡¢G'í∞¢6ˆÁ7B"“F"Á&W&RÜ ¢4TƒT5B4ıTÂBÇ¢íF˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰BívvÊW2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰BíW&GW0¢e$Ù“&˜WFvU˜6ÜF˜víÊvWBÇí«¬∑”∞¢6ˆÁ7BG&Ê6ÜW2“á"ÊvvÊW2«¬í≤á"ÁW&GW2«¬ì∞¢ñbá"ÁF˜F¬í∞¢6ˆÁ7Bw"“G&Ê6ÜW2Ú÷FÇÁ&˜VÊBá"ÊvvÊW2ÚG&Ê6ÜW2¢í¢ÁV∆√∞¢ÚÚ÷ó6R(*¬"6ñvÊ¬¬6ˆ÷÷R'F˜WBñ∆∆WW'2FÁ2∆R&ˆ¶WB¬WB6˜FP¢ÚÚ÷˜ñVÊÊR'VFVÁFRFR„sR¢6W2Ê«ó6W2‚vˆÁB2FR6˜FR&VV∆∆P¢ÚÚVó7RvV∆∆W2‚vˆÁB¶÷ó2WFRFñfgW6VW2‡¢6ˆÁ7B&ˆfóB“G&Ê6ÜW2Ú÷FÇÁ&˜VÊBÇá"ÊvvÊW2¢r„Rí“á"ÁW&GW2¢íí¢ÁV∆√∞¢∆ñvÊW2ÁW6ÇÇ""¬	˙z¢∆#Â&˜WFvR"7V6ñ∆ó7FR(	B÷ˆFR6ÜF˜rÜÊˆ‚∆óVRì¬ˆ#Êì∞¢∆ñvÊW2ÁW6ÇÜG∑"ÁF˜F«“Ê«ó6W2&V7WW&VW2VífñÊó76ñVÁBSRR6Á26ñvÊ∆ì∞¢∆ñvÊW2ÁW6ÇáG&Ê6ÜW0¢ÚG∑G&Ê6ÜW7“G&Ê6ÜVW2¢G∑"ÊvvÊW7“vvÊVW2ÚG∑"ÁW&GW7“W&GVW2(	B∆#‚G∑w'“S¬ˆ#‚G∑&ˆfóB”“ÁV∆¬Ú+rG∑&ˆfóB„“Ú"≤"¢"'“G∑&ˆfóGﬁ(*¬6ñ◊V∆W2Ü÷ó6R(*¬¬6˜FR„sRñ¢"'÷ ¢¢V7VÊRVÊ6˜&RG&Ê6ÜVR(	BfW&Fñ7Bñ◊˜76ñ&∆R˜W"¬vñÁ7FÁFì∞¢ñbáG&Ê6ÜW2„“3í∞¢∆ñvÊW2ÁW6Çáw"„“c ¢Ú(i"R÷FW77W2FRcR7W"G∑G&Ê6ÜW7“&W7V«FG2¢7FófFñˆ‚FVfVÊF&∆RÖ$ıUDtUÙ‘ÙDS÷7Fñbñ ¢¢(i"6˜W2cR7W"G∑G&Ê6ÜW7“&W7V«FG2¢ÊR27FófW&ì∞¢“V«6R∞¢∆ñvÊW2ÁW6ÇÜ(i"3&W7V«FG2G&Ê6ÜW2÷ñÊñ◊V“fÁBF˜WFRFV6ó6ñˆ‚ÇG∑G&Ê6ÜW7“˜W"¬vñÁ7FÁBñì∞¢–¢–¢“6F6ÇÜRí≤∆ñvÊW2ÁW6ÇÜ	˘KB&˜WFvR6ÜF˜r(	BGµ7G&ñÊrÜRÊ÷W76vRíÁ6∆ñ6RÉ¬có÷ì≤–†¢ÚÚí‚6∆76V÷VÁBFW2î7W"∆W2&W7V«FG2&VV«2≤&˜˜6óFñˆ‚FR&ˆ÷˜Fñˆ‚‡¢G'í∞¢6ˆÁ7B6¬“VFóDvVÁG4WE&ˆ÷˜Fñˆ‚Çì∞¢∆ñvÊW2ÁW6ÇÇ""¬‚‚Ê6¬Ê∆ñvÊW2ì∞¢“6F6ÇÜRí∞¢∆ñvÊW2ÁW6ÇÜ	˘KB6∆76V÷VÁBî(	BGµ7G&ñÊrÜRÊ÷W76vRíÁ6∆ñ6RÉ¬có÷ì∞¢–†¢6ˆÁ7B&W&W2“&W&Fñˆ‚Á&W&W2«¬µ”∞¢ñbá&W&W2Ê∆VÊwFÇí∆ñvÊW2ÁW6ÇÇ""¬	˘Jr∆#‚G∑&W&W2Ê∆VÊwFá“÷ˆFV∆Rá2í&V◊∆6Rá2íWFˆ÷FóVV÷VÁC¬ˆ#‚¢G∑&W&W2Ê¶ˆñ‚Ç"+r"ó÷ì∞¢6ˆÁ7BVÁFWFR“ÊÊW2Ê∆VÊwFÄ¢Ú	˘™Ç∆#‰TDïB‘Dî‰¬(	BG∑ÊÊW2Ê∆VÊwFá“‰‰RG∑ÊÊW2Ê∆VÊwFÇ‚Ú%2"¢"'”¬ˆ#Â∆Â∆„∆#‚G∑ÊÊW2Ê¶ˆñ‚Ç"¬"ó”¬ˆ#Ê ¢¢fW'Fó76V÷VÁG2Ê∆VÊwFÄ¢Ú	˘˙∆#‰TDïB‘Dî‰¬(	BG∂fW'Fó76V÷VÁG2Ê∆VÊwFá“ˆñÁBG∂fW'Fó76V÷VÁG2Ê∆VÊwFÇ‚Ú'2"¢"'“7W'fVñ∆∆W#¬ˆ#Â∆Â∆„∆#‚G∂fW'Fó76V÷VÁG2Ê¶ˆñ‚Ç"¬"ó”¬ˆ#Ê ¢¢.)»R∆#‰TDïB‘Dî‰¬(	BF˜WBfˆÊ7FñˆÊÊS¬ˆ#‚#∞¢6ˆÁ7B◊6r“∂VÁFWFR¬""¬‚‚Ê∆ñvÊW2¬""¬.)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H"¬/	˘ÜW&‹:á2(	BVFóBWFˆ÷FóVRGR÷Fñ‚%“Ê¶ˆñ‚Ç%∆‚"ì∞¢6ˆÁ7Bˆ≤“vóB6VÊDÜW&÷W4Fñ«îFñvW7BÜ◊6rì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂VFóB÷÷FñÊ≈“G∑ÊÊW2Ê∆VÊwFá“ÊÊRá2í¢G∑ÊÊW2Ê¶ˆñ‚Ç"¬"í«¬&V7VÊR'“(	BVÁfˆíG∂ˆ≤Ú$Ù≤"¢$T4ÑT2'÷ì∞¢&WGW&‚ˆ≥∞ß–†¶7ñÊ2gVÊ7Fñˆ‚6VÊDFñ«îÜV«FÑ6ÜV6≤Çí∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí&WGW&‚f«6S∞¢G'í∞¢ÚÚFñfgW6ñˆ‚FR∆fVñ∆∆R¬6ˆ◊L:ñR7W"∆W26ˆ∆ˆÊÊW2,:ñV∆∆V÷VÁB÷'\:ñW2:¬vVÁfˆí‡¢6ˆÁ7BB“F"Á&W&RÜ ¢4TƒT5B4ıTÂBÇ¢í2Ê«ó6W2¿¢4ÙƒU44RÖ5T“á6ñu˜6VÁEˆg&VRí√í2g&VR¿¢4ÙƒU44RÖ5T“á6ñu˜6VÁE˜7FÊF&Bí√í27FÊF&B¿¢4ÙƒU44RÖ5T“á6ñu˜6VÁE˜&V÷óV“í√í2&V÷óV“¿¢4ÙƒU44RÖ5T“á6ñu˜6VÁEˆV∆óFRí√í2V∆óFP¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RFFRÜÊ«ó6VEˆBí“FFRÇvÊ˜rr¬r”Fírê¢íÊvWBÇí«¬∑”∞†¢ÚÚ,:ó7V«FG2FW2÷F6á2,8ï4Ù≈U2ÜñW"á&W6ˆ«fVEˆB¬2Ê«ó6VEˆB¢VÊRÊ«ó6P¢ÚÚFR∆fVñ∆∆RWWB‚|:ßG&RG&Ê6å:ñRVR∆R∆VÊFV÷ñ‚í‡¢6ˆÁ7B"“F"Á&W&RÜ ¢4TƒT5B4ÙƒU44RÖ5T“Ü˜WF6ˆ÷S“wvñ‚rí√í2vñÁ2¬4ÙƒU44RÖ5T“Ü˜WF6ˆ÷S“v∆˜72rí√í2∆˜76W2¿¢4ÙƒU44RÖ5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚&V≈ˆˆFB£”T≈4R”T‰Bí√í2&ˆfó@¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R˜WF6ˆ÷Rî‚Çwvñ‚r¬v∆˜72rí‰BFFRá&W6ˆ«fVEˆBí“FFRÇvÊ˜rr¬r”Fírê¢‰B&V≈ˆˆFB„“GµDîU%Ù‘îÂı$T≈ÙÙDG–¢‰B&V≈ˆˆFB√“GµDîU%Ù‘Öı$T≈ÙÙDG–¢íÊvWBÇí«¬∑”∞¢6ˆÁ7B&W6ˆ«fVB“á"ÁvñÁ2«¬í≤á"Ê∆˜76W2«¬ì∞¢6ˆÁ7Bw"“&W6ˆ«fVB‚Ú÷FÇÁ&˜VÊBÇá"ÁvñÁ2Ú&W6ˆ«fVBí¢íÚ¢ÁV∆√∞†¢6ˆÁ7BvVÁG2“F"Á&W&RÜ ¢4TƒT5BvVÁEˆÊ÷R¬vñÁ&FR¬F˜F≈˜&VFñ7FñˆÁ2e$Ù“vVÁE˜vVñváG0¢tÑU$RF˜F≈˜&VFñ7FñˆÁ2„“Sı$DU"%ívñÁ&FRDU40¢íÊ∆¬Çì∞¢6ˆÁ7B&W7B“vVÁG5≥“¬v˜'7B“vVÁG5∂vVÁG2Ê∆VÊwFÇ“”∞†¢6ˆÁ7BñB“ÜBÁ7FÊF&B«¬í≤ÜBÁ&V÷óV“«¬í≤ÜBÊV∆óFR«¬ì∞¢6ˆÁ7BÜVB“ñB””“ ¢Ú/	˘KB∆#‰$îƒ‚4ÂL8í(	BV7V‚6ñvÊ¬ñÁBÜñW#¬ˆ#‚ ¢¢/	˘8¢∆#‰$îƒ‚4ÂL8íTıDîDîT„¬ˆ#‚#∞†¢6ˆÁ7B∆ñÊW2“∞¢ÜVB¬""¿¢	˘:∆#‰FñfgW6ñˆ‚BvÜñW#¬ˆ#‚ÇG∂BÊÊ«ó6W2«¬“Ê«ó6W2ñ¿¢	¯i2w&GVóB¢G∂BÊg&VR«¬÷¿¢	˘˙"7FÊF&B¢G∂BÁ7FÊF&B«¬“ÚGµ5D‰D$Eı4ît‰≈ÙDî≈ïÙ4÷¿¢	˘˙2&V÷óV“¢G∂BÁ&V÷óV“«¬“ÚGµ$T‘ïT’ı4ît‰≈ÙDî≈ïÙ4÷¿¢	˘˙V∆óFR¢G∂BÊV∆óFR«¬“ÚG¥TƒïDUı4ît‰≈ÙDî≈ïÙ4÷¿¢""¿¢	˘8Ç∆#Â,:ó7V«FG2G&Ê6å:ó2ÜñW#¬ˆ#Ê¿¢&W6ˆ«fVB‚ ¢Ú)»RG∑"ÁvñÁ7“vvÏ:ó2+r)ÿ¬G∑"Ê∆˜76W7“W&GW2+rG∑w'“U∆Ô	˘+G∑"Á&ˆfóB„“Ú"≤"¢"'“G¥÷FÇÁ&˜VÊBá"Á&ˆfóBóﬁ(*¬Ü÷ó6R(*¬ñ ¢¢V7V‚,:ó7V«FBG&Ê6å:ñ¿¢""¿¢&W7BÚ	¯¯b÷Vñ∆∆WW"vVÁB¢G∂&W7BÊvVÁEˆÊ÷W“ÇG∂&W7BÁvñÁ&FW“Rñ¢""¿¢v˜'7Bbbv˜'7B”“&W7BÚ)™˚àÚ«W2fñ&∆R¢G∑v˜'7BÊvVÁEˆÊ÷W“ÇG∑v˜'7BÁvñÁ&FW“Rñ¢""¿¢""¿¢.)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H"¿¢/	˘ÜW&‹:á2(	B7WW'fó6ñˆ‚ñÁFW&ÊR"¿¢“Êfñ«FW"Ñ&ˆˆ∆V‚ì∞†¢6ˆÁ7Bˆ≤“vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬∆ñÊW2Ê¶ˆñ‚Ç%∆‚"íì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂ÜV«FÇ÷6ÜV6µ“&ñ∆‚V˜FñFñV‚¢G∂ˆ≤Ú$Ù≤"¢$T4ÑT2'÷ì∞¢&WGW&‚ˆ≥∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂ÜV«FÇ÷6ÜV6µ“"¬RÊ÷W76vRì∞¢&WGW&‚f«6S∞¢–ß–†¢ÚÚ)H)HUDÚ"(	B∆W'FR*≤∆ñW":6V2+≤áF˜WFW2∆W2fÇí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚV‚&ˆÊÏ:íñÁBVíÊR&\:vˆóB&ñV‚6RL:ó6&ˆÊÊR6Á2,:ófVÊó"‚∆W26WVñ«26ˆÁ@¢ÚÚîÂdU%<8ï2"&˜'B:¬vñÁGVóFñˆ‚BtÜW&‹:á2¢∆R∆ñW"BvVÁG,:ñRñÁBW7B∆P¢ÚÚ«W2g&vñ∆R6ˆ÷÷W&6ñ∆V÷VÁB¬2∆R«W2FˆÃ:ó&ÁB‡¶6ˆÁ7BE%ïıDîU%ÙDï2“≤7FÊF&C¢2¬&V÷óV”¢2¬V∆óFS¢"”∞¶7ñÊ2gVÊ7Fñˆ‚6ÜV6¥G'ïFñW'2Çí∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí&WGW&„∞¢G'í∞¢6ˆÁ7B“F"Á&W&RÜ ¢4TƒT5@¢‘ÇÑ44RtÑT‚6ñu˜6VÁE˜7FÊF&C”DÑT‚Ê«ó6VEˆBT‰Bí27FÊF&B¿¢‘ÇÑ44RtÑT‚6ñu˜6VÁE˜&V÷óV””DÑT‚Ê«ó6VEˆBT‰Bí2&V÷óV“¿¢‘ÇÑ44RtÑT‚6ñu˜6VÁEˆV∆óFS”DÑT‚Ê«ó6VEˆBT‰Bí2V∆óFP¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢íÊvWBÇí«¬∑”∞¢ÚÚFó7FñÊwVR*≤«W2FR÷F6á2Ê«ó<:ó2+≤FR*≤fñ«G&RG&˜<:ól:á&R+≤¢2vW7B∆P¢ÚÚFñvÊ˜7Fñ2Ví÷Á\:íVÊB∆R6WVñ¬7FÊF&B:ì"ÊR∆ó76óB&ñV‚76W"‡¢6ˆÁ7B&ˆGV6VB“F"Á&W&RÜ ¢4TƒT5B4ıTÂBÇ¢í2‚e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RÊ«ó6VEˆB„“FFWFñ÷RÇvÊ˜rr¬r”Fírê¢íÊvWBÇíÊ‚«¬∞†¢f˜"Ü6ˆÁ7BFñW"ˆb≤'7FÊF&B"¬'&V÷óV“"¬&V∆óFR%“í∞¢6ˆÁ7B∆7B“∑FñW%”∞¢6ˆÁ7BFó2“∆7BÚÑFFRÊÊ˜rÇí“ÊWrFFRÜ∆7BÁ&W∆6RÇ""¬%B"í≤%¢"íÊvWEFñ÷RÇííÚÉcC¢ììì∞¢6ˆÁ7B∆ñ÷óB“E%ïıDîU%ÙDï5∑FñW%”∞¢ñbÜFó2¬∆ñ÷óBí≤6∆V$G'ïFñW$∆W'BáFñW"ì≤6ˆÁFñÁVS≤“ÚÚ,:ñ&÷V÷VÁ@¢ñbÜG'ïFñW$«&VGï6VÁBáFñW"íí6ˆÁFñÁVS≤ÚÚL:ñ¨:∆W'L:í¬7W'fóB:V‚&VL:ñ÷'&vP¢÷&¥G'ïFñW$∆W'FVBáFñW"ì∞†¢6ˆÁ7B6ˆÊb“FñW"””“'7FÊF&B"Ú5D‰D$EÙ‘îÂÙ4Ù‰b¢FñW"””“'&V÷óV“"Ú$T‘ïT’Ù‘îÂÙ4Ù‰b¢vWDV∆óFT÷ñ‰6ˆÊbÇì∞¢6ˆÁ7B6W6R“&ˆGV6VB””“ ¢Ú$V7VÊRÊ«ó6R&ˆGVóFR7W"#FÇ(i"&ˆ&Ã:Ü÷RBv∆ñ÷VÁFFñˆ‚Ñí÷F6á2¬66ÜVGV∆W"í‚ ¢¢G∑&ˆGV6VG“Ê«ó6W2&ˆGVóFW27W"#FÇ÷ó2V7VÊR&WFVÁVR(i"fñ«G&RG&˜<:ól:á&RÜ6ˆÊfñÊ6R(öRG∂6ˆÊg“˜R6˜FR,:ñV∆∆RVÁG&RGµDîU%Ù‘îÂı$T≈ÙÙDG“WBGµDîU%Ù‘Öı$T≈ÙÙDG“íÊ∞†¢6ˆÁ7B◊6r“∞¢	˘™Ç∆#ÂƒîU"84T2(	BG∑FñW"ÁFıWW$66RÇó”¬ˆ#Ê¬""¿¢V7V‚6ñvÊ¬FWVó2∆#‚G∂∆7BÚ÷FÇÊf∆ˆ˜"ÜFó2í≤"¶˜W"á2í"¢'F˜V¶˜W'2'”¬ˆ#‚á6WVñ¬Bv∆W'FR¢G∂∆ñ÷óG“¢ñ¿¢∆7BÚFW&ÊñW"VÁfˆí¢G∂∆7G÷¢""¿¢""¿¢	˘H“G∂6W6W÷¿¢""¿¢	˘8¬l:ó&ñfñW"∆Fó7G&ñ'WFñˆ‚fÁBFRF˜V6ÜW"WÇ6WVñ«2¶¿¢∆6ˆFS‚˜FñW"◊7FG3¬ˆ6ˆFS‚WB∆&W\:ßFR*s"FRUDEÙDU5ÙƒîUUÇÊ÷F¿¢""¿¢.)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H"¿¢/	˘ÜW&‹:á2(	B7WW'fó6ñˆ‚ñÁFW&ÊR"¿¢“Êfñ«FW"Ñ&ˆˆ∆V‚íÊ¶ˆñ‚Ç%∆‚"ì∞†¢6ˆÁ7Bˆ≤“vóB6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬◊6rì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂G'í◊FñW%“∆W'FRG∑FñW'“ÇG¥÷FÇÊf∆ˆ˜"ÜFó2ó÷¢6Á26ñvÊ¬í¢G∂ˆ≤Ú$Ù≤"¢$T4ÑT2'÷ì∞¢–¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂G'í◊FñW%“"¬RÊ÷W76vRì∞¢–ß–¶∆WBˆ∆7D∆V&ÊñÊu&W˜'DFFR“"#∞†¶gVÊ7Fñˆ‚6ÜV6¥Ê«óFñ7566ÜVGV∆RÇí∞¢6ˆÁ7BÊ˜r“ÊWrFFRÇì∞¢6ˆÁ7B&ó57G"“Ê˜rÁFÙ∆ˆ6∆U7G&ñÊrÇ&V‚‘t""¬≤Fñ÷U¶ˆÊS¢$WW&˜Rı&ó2"“ì∞¢6ˆÁ7B∂FFU'B¬Fñ÷U'E““&ó57G"Á7∆óBÇ"¬"ì∞¢6ˆÁ7BÜ˜W"“'6TñÁBáFñ÷U'BÁ7∆óBÇ#¢"ï≥“ì∞¢6ˆÁ7BFí“Ê˜rÁFÙ∆ˆ6∆TFFU7G&ñÊrÇ&V‚’U2"¬≤Fñ÷U¶ˆÊS¢$WW&˜Rı&ó2"¬vVV∂Fì¢&∆ˆÊr"“ì∞¢6ˆÁ7BFˆFî∂Wí“Ê˜rÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞†¢ÚÚ÷ñÊñGW&R&6ˆ÷&ñV‚ˆ‚W&óBvvÊR"÷ñÁVóBÜFV÷ÊFRFRw&Vr¬ÛÇÛ##bí‡¢ÚÚVÁf˜ñVRV‚W&7RF÷ñ‚FÁBVRDî≈ïÙtîÂÙî‘tUıT$ƒî2‚vW7B27FófR‡¢ÚÚF˜WFW2∆W2F6ÜW2FR6R∆Êñfñ6FWW"WFñ∆ó6VÁB#„“"á2#””“"í¢V‡¢ÚÚ&VFV÷'&vRGR6ˆÁFVÊWW"VíFˆ÷&Rñ∆R7W"∆R7&VÊVRÜ˜&ó&Rfó6ó@¢ÚÚ6WFW"∆F6ÜR˜W"F˜WFR∆¶˜W&ÊVR¬6Á2V7VÊRG&6RBvW'&WW"Ü&ñ∆‡¢ÚÚGR2ÛÇÛ##b¶÷ó2VÁf˜ñR¬6ˆÁ7FFR"w&Vr∆RBÛÇÛ##b(	B∆P¢ÚÚ6ˆÁFVÊWW"fóB&VFV÷'&R«W6ñWW'2fˆó26R¶˜W"÷∆í‚#„“"&GG&R∆¢ÚÚF6ÜRFW2∆R&ˆ6Üñ‚76vRFR6ÜV6¥Ê«óFñ7566ÜVGV∆R¬÷V÷R&W2#&Ç‡¢ñbÜÜ˜W"„“bbˆ∆7Dvñ‰ñ÷vTFFR”“FˆFî∂Wíí∞¢ˆ∆7Dvñ‰ñ÷vTFFR“FˆFî∂Wì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂vñ‚÷ñ÷vU“|:ñÏ:ó&Fñˆ‚÷ñÊñGW&W2V˜FñFñVÊÊW2Ü÷ñÁVóB¬&GG&vR6íÊV6W76ó&Rí‚‚‚"ì∞¢6VÊDFñ«îvñ‰ñ÷vW2Çì∞¢–†¢ÚÚ∆R6VVB&R÷÷F6ÇÉ$ÇW7Bfˆ∆ˆÁFó&V÷VÁBFW67FófR¢∆R&ˆGVóB6∆ñVÁ@¢ÚÚ&W˜6RFW6˜&÷ó2VÊóVV÷VÁB7W"V‚6ñvÊ¬∆ófRÚıR"√RVffV7FófV÷VÁ@¢ÚÚFñfgW6RVÁG&R∆VRWB∆CR÷ñÁWFR‡†¢ñbÜÜ˜W"„“#"bbˆ∆7D&ñ∆‰FFR”“FˆFî∂Wíí∞¢ˆ∆7D&ñ∆‰FFR“FˆFî∂Wì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂&ñ∆‚◊7FG5“VÁfˆí&ñ∆‚V˜FñFñV‚#&Ç7W"FV∆Vw&“F÷ñ‚á&GG&vR6íÊV6W76ó&Rí‚‚‚"ì∞¢6VÊE7FG4&ñ∆ÂFV∆Vw&“ÇíÁFÜV‚Üˆ≤”‚6ˆÁ6ˆ∆RÊ∆ˆrÜ∂&ñ∆‚◊7FG5“G∂ˆ≤Ú$Ù≤"¢$T4ÑT2'÷íì∞¢ñbÖˆ∆7Dg&VU&W7V«G4&ñ∆‰FFR”“FˆFî∂Wíí∞¢ˆ∆7Dg&VU&W7V«G4&ñ∆‰FFR“FˆFî∂Wì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂Fñ«í◊&W7V«G2÷g&VU“VÁfˆí,:ó7V«FG2GR¶˜W"7W"6Ê¬w&GVóBá&GG&vR6íÊV6W76ó&Rí‚‚‚"ì∞¢6VÊDFñ«ï&W7V«G4g&VT6ÜÊÊV¬ÇíÁFÜV‚Üˆ≤”‚6ˆÁ6ˆ∆RÊ∆ˆrÜ∂Fñ«í◊&W7V«G2÷g&VU“G∂ˆ≤Ú$Ù≤"¢%4¥ïÙT4ÑT2'÷íì∞¢–¢–†¢ñbÜÜ˜W"„“#2bbˆ∆7DFñ«ï&W˜'DFFR”“FˆFî∂Wíí∞¢ˆ∆7DFñ«ï&W˜'DFFR“FˆFî∂Wì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂Ê«óFñ75“VÁfˆí&˜'Bfó6óFWW'2V˜FñFñV‚É#6Ç¬&GG&vR6íÊV6W76ó&Rí‚‚‚"ì∞¢6VÊDFñ«ïfó6óF˜%&W˜'BÇì∞¢–†¢ñbÜÜ˜W"„“#2bbˆ∆7D∆V&ÊñÊu&W˜'DFFR”“FˆFî∂Wíí∞¢ˆ∆7D∆V&ÊñÊu&W˜'DFFR“FˆFî∂Wì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂Ê«óFñ75“VÁfˆí&˜'BBv&VÁFó76vRV˜FñFñV‚É#6Ç¬&GG&vR6íÊV6W76ó&Rí‚‚‚"ì∞¢6VÊD∆V&ÊñÊu&W˜'EFV∆Vw&“ÇíÁFÜV‚Üˆ≤”‚6ˆÁ6ˆ∆RÊ∆ˆrÜ∂∆V&ÊñÊr◊&W˜'E“G∂ˆ≤Ú$Ù≤"¢$T4ÑT2'÷íì∞¢–†¢ÚÚ6◊vÊRÁW'GW&ñÊr&6RVRGRW&ó2vvÊR"(	B÷&Fí≤fVÊG&VFí¬Ç&ó2‡¢ÚÚg&WVVÊ6Rfˆ∆ˆÁFó&V÷VÁBfñ&∆Rá2V˜FñFñVÊÊRí˜W"ÊR2∆76W"∆W0¢ÚÚ&ˆÊÊW2ÜFV÷ÊFRfˆÊFFWW"¬3ÛrÛ##bí‡¢ñbÇÜFí””“%GVW6Fí"«¬Fí””“$g&ñFí"íbbÜ˜W"””“bbˆ∆7D˜WGW&f˜&‘V÷ñƒFFR”“FˆFî∂Wíí∞¢ˆ∆7D˜WGW&f˜&‘V÷ñƒFFR“FˆFî∂Wì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂˜WGW&f˜&“÷V÷ñ≈“VÁfˆí6◊vÊRÁW'GW&ñÊrÜ÷"˜fV‚Çí‚‚‚"ì∞¢6VÊD˜WGW&f˜&‘V÷ñ«2Çì∞¢–†¢ñbÜFí””“$÷ˆÊFí"bbÜ˜W"””“Çbbˆ∆7EvVV∂«ï&W˜'DFFR”“FˆFî∂Wíí∞¢ˆ∆7EvVV∂«ï&W˜'DFFR“FˆFî∂Wì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂Ê«óFñ75“VÁfˆí&˜'B÷&∂WFñÊrÜV&FÚÜ«VÊFíÜÇí‚‚‚"ì∞¢6VÊEvVV∂«î÷&∂WFñÊu&W˜'BÇì∞¢–†¢ñbÜFí””“$÷ˆÊFí"bbÜ˜W"””“íbbˆ∆7EW&e&W˜'DFFR”“FˆFî∂Wíí∞¢ˆ∆7EW&e&W˜'DFFR“FˆFî∂Wì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂Ê«óFñ75“VÁfˆí&˜'BW&f˜&÷Ê6RÜV&FÚÜ«VÊFíñÇí‚‚‚"ì∞¢6VÊEW&f˜&÷Ê6U&W˜'EFV∆Vw&“ÉríÁFÜV‚Üˆ≤”‚6ˆÁ6ˆ∆RÊ∆ˆrÜ∑W&b◊&W˜'E“G∂ˆ≤Ú$Ù≤"¢$T4ÑT2'÷íì∞¢–†¢ÚÚUDÚ(	BVFóB÷FñÊ¬6ˆ◊∆WBÉfÇ&ó2í¬dÂB∆R&ñ∆‚FRvÇ¢VÊRÊÊP¢ÚÚFˆóB6R∆ó&RV‚&V÷ñW"‚#„“"6ˆ÷÷R∆W2WG&W2F6ÜW2¬˜W"&GG&W"6í∆P¢ÚÚ6ˆÁFVÊWW"&VFV÷'&Rñ∆R7W"∆R7&VÊVR‡¢ñbÜÜ˜W"„“bbbˆ∆7D÷˜&ÊñÊtVFóDFFR”“FˆFî∂Wíí∞¢ˆ∆7D÷˜&ÊñÊtVFóDFFR“FˆFî∂Wì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂VFóB÷÷FñÊ≈“∆Ê6V÷VÁBFR¬vVFóB6ˆ◊∆WB‚‚‚"ì∞¢'V‰÷˜&ÊñÊtVFóBÇíÊ6F6ÇÜR”‚6ˆÁ6ˆ∆RÊW'&˜"Ç%∂VFóB÷÷FñÊ≈“"¬RÊ÷W76vRíì∞¢–†¢ÚÚUDÚ(	B&ñ∆‚FR6ÁL:íV˜FñFñV‚ÉvÇ&ó2ê¢ñbÜÜ˜W"””“rbbˆ∆7DÜV«FÑ6ÜV6¥FFR”“FˆFî∂Wíí∞¢ˆ∆7DÜV«FÑ6ÜV6¥FFR“FˆFî∂Wì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂ÜV«FÇ÷6ÜV6µ“VÁfˆí&ñ∆‚FR6ÁL:íV˜FñFñV‚ÉvÇí‚‚‚"ì∞¢6VÊDFñ«îÜV«FÑ6ÜV6≤Çì∞¢–†¢ÚÚUDÚ"(	B∆ñW'2:6V2¬6ˆÁG,;FÃ:íF˜WFW2∆W2fÇÉÇÚfÇÚ&ÇÚÜÇê¢ñbÜÜ˜W"Rb””“í6ÜV6¥G'ïFñW'2Çì∞†¢ÚÚvF6ÜFˆrÁFí◊W'FR¢L:óFV7FRVÊR6áWFR''WF∆RGRÊˆ÷'&RBvÊ«ó6W0¢FFñÁFVw&óGïvF6ÜFˆrÇì∞†¢ÚÚUDÚ2(	B7W'fVñ∆∆Ê6RGR6ˆÊ6ñ∆R‚6ÜV6¥Ê«óFñ7566ÜVGV∆RÇíF˜W&ÊRF˜WFW0¢ÚÚ∆W2c4T4Ù‰DU2á6WDñÁFW'f¬«W2&2í¢6Á26WGFRv&FRÜ˜&ó&R¬∆P¢ÚÚvF6ÜFˆr&V¶˜VóBFWWÇ&∆ñvW2FR6ˆÊ6ñ∆UˆÊ«ó6W26ÜVR÷ñÁWFR¬6ˆó@¢ÚÚ#ÉÉ"¶˜W"˜W"G&ˆó26ˆÁG&ˆ∆W2Ví‚vˆÁBFR6VÁ2Rv¬vÜWW&R‡¢ÚÚFVfWBG&˜WfRV‚&V∆V7GW&R∆RrÛÇÛ##b¬6˜'&ñvRfÁB÷ó6RV‚6W'fñ6R‡¢ñbÖˆ∆7D6ˆÊ6ñ∆UvF6ÜFˆtÜ˜W"”“Ü˜W"í∞¢ˆ∆7D6ˆÊ6ñ∆UvF6ÜFˆtÜ˜W"“Ü˜W#∞¢6ˆÊ6ñ∆TÜV«FÖvF6ÜFˆrÇì∞¢–ß–†¢ÚÚ)H)H7W'fVñ∆∆Ê6RGR6ˆÊ6ñ∆RÉrÛÇÛ##bí)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚÊRWÜó7FóB2¢ÜW&÷W2&ˆGVó6óB∆W2Ê«ó6W2÷ó2&ñV‚ÊR7W'fVñ∆∆óB∆WW ¢ÚÚTƒïDR‚6ˆÁ7FFR6R¶˜W"÷∆7W"r¶˜W'2¢3Ê«ó6W2¬R6ñvÊWÇFñfgW6W2¿¢ÚÚì"Ê«ó6W2Éc"Rí6˜'FñW2SRR*≤V7V‚6ˆÁ6VÁ7W2+≤¬sb6Á2∆R÷ˆñÊG&Rf˜FR¿¢ÚÚWB¶÷ó2VÊR6WV∆Rfˆó2∆W2RîBv66˜&B‚W'6ˆÊÊR‚vWFR&WfVÁR(	B∆P¢ÚÚfˆÊFFWW"¬vFV6˜WfW'BV‚FV÷ÊFÁBG&ˆó2fˆó2˜W'Vˆíñ¬ÊR&V6WfóB&ñV‚‡¢Ú¢ÚÚV‚7ó7FV÷RVíF˜W&ÊR6WV¬∆ÁVóBFˆóB7&ñW"VÊBñ¬FW&ñ∆∆R‚G&ˆó0¢ÚÚ6ñvÊWÇBv∆W'FR¬6Ü7V‚∆ñ÷óFRV‚VÁfˆí"&Ç˜W"ÊR2Ü&6V∆W"‡¶6ˆÁ7B4Ù‰4îƒUÙƒU%EÙ4ÙÙƒDıtÂÙ’2“"¢3c¢∞¶6ˆÁ7Bˆ6ˆÊ6ñ∆T∆W'G2“≤vVÁG3¢¬6ˆÁ6VÁ7W3¢¬FñfgW6ñˆ„¢”∞¶∆WBˆ∆7D6ˆÊ6ñ∆UvF6ÜFˆtÜ˜W"“”∞†¶gVÊ7Fñˆ‚6ˆÊ6ñ∆TÜV«FÖvF6ÜFˆrÇí∞¢ñbÇDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂6ˆÊ6ñ∆R◊vF6ÜFˆu“ñÊ7Fñb¢DTƒTu$’ÙD‘îÂÙ4ÑEÙîB'6VÁB"ì∞¢&WGW&„∞¢–¢G'í∞¢6ˆÁ7BFWVó3#FÇ“ÊWrFFRÑFFRÊÊ˜rÇí“#B¢3cS2íÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ííÁ&W∆6RÇ%B"¬""ì∞¢6ˆÁ7BFWVó3CÜÇ“ÊWrFFRÑFFRÊÊ˜rÇí“CÇ¢3cS2íÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ííÁ&W∆6RÇ%B"¬""ì∞¢6ˆÁ7B&˜w3#B“F"Á&W&RÄ¢%4TƒT5B6ˆÊfñFVÊ6R¬6ˆÁ6VÁ7W5˜f˜FW2¬6ñu˜6VÁE˜7FÊF&B¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFR"∞¢"e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RÊ«ó6VEˆB„“Ú ¢íÊ∆¬ÜFWVó3#FÇì∞¢ÚÚ6˜W2#Ê«ó6W2¬∆W2˜W&6VÁFvW2ÊRfWV∆VÁB&ñV‚Fó&RáG&WfR¬ÁVóB¿¢ÚÚ&VFV÷'&vRí‚ˆ‚ÊRFV6∆VÊ6ÜR&ñV‚«WF˜BVRBv∆W'FW"7W"GR''VóB‡¢ÚÚ)™˚àÚ6ˆÁ6WVVÊ6R77V÷VR¢VÊFÁBVÊRG&WfR¬V‚6ˆÊ6ñ∆R&VV∆∆V÷VÁB676P¢ÚÚ&W7FR6ñ∆VÊ6ñWWÇ‚∆7W'fVñ∆∆Ê6R6˜Wg&R∆RfˆÊ7FñˆÊÊV÷VÁBÊˆ÷ñÊ¬¬0¢ÚÚ¬vñÁFW'6ó6ˆ‚(	B2vW7BV‚6ÜˆóÇ¬2V‚˜V&∆í‡¢ñbá&˜w3#BÊ∆VÊwFÇ¬#í∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂6ˆÊ6ñ∆R◊vF6ÜFˆu“7Fñb(	BG∑&˜w3#BÊ∆VÊwFá“Ê«ó6W2Û#FÇ¬6˜W2∆R6WVñ¬FR#¬V7V‚6ˆÁG&ˆ∆Vì∞¢&WGW&„∞¢–†¢6ˆÁ7B÷ñÁFVÊÁB“FFRÊÊ˜rÇì∞¢ÚÚG&6RFRfñR¢6Á2V∆∆R¬ñ◊˜76ñ&∆RFRFó7FñÊwVW"'7W'fVñ∆∆Ê6R7FófP¢ÚÚWBF˜WBf&ñV‚"FR'7W'fVñ∆∆Ê6R¶÷ó2V∆VR"‡¢6ˆÁ7B˜7b“&˜w3#BÊfñ«FW"á"”‚"Ê6ˆÁ6VÁ7W5˜f˜FW2íÊ∆VÊwFÉ∞¢6ˆÁ7B˜62“&˜w3#BÊfñ«FW"á"”‚ÁV÷&W"á"Ê6ˆÊfñFVÊ6Rí√“SRíÊ∆VÊwFÉ∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂6ˆÊ6ñ∆R◊vF6ÜFˆu“7Fñb(	BG∑&˜w3#BÊ∆VÊwFá“Ê«ó6W2Û#FÇ¬∞¢6Á2f˜FRG¥÷FÇÁ&˜VÊBÖ˜7bÚ&˜w3#BÊ∆VÊwFÇ¢ó“RÜ∆W'FR#Rí¬∞¢6Á26ˆÁ6VÁ7W2G¥÷FÇÁ&˜VÊBÖ˜62Ú&˜w3#BÊ∆VÊwFÇ¢ó“RÜ∆W'FRSñì∞¢6ˆÁ7B∆W'FR“Ü6∆R¬◊6rí”‚∞¢ñbÜ÷ñÁFVÊÁB“ˆ6ˆÊ6ñ∆T∆W'G5∂6∆U“¬4Ù‰4îƒUÙƒU%EÙ4ÙÙƒDıtÂÙ’2í&WGW&„∞¢ˆ6ˆÊ6ñ∆T∆W'G5∂6∆U““÷ñÁFVÊÁC∞¢6ˆÁ6ˆ∆RÊW'&˜"Ü∂6ˆÊ6ñ∆R◊vF6ÜFˆu“G∂6∆W“¢∆W'FRVÁf˜ñVVì∞¢6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬◊6ríÊ6F6ÇÇÇí”‚∑“ì∞¢”∞†¢ÚÚ‚vVÁG2◊VWG2(	B∆R«W2w&fR¢∆R6ˆÊ6ñ∆RÊRFV∆ñ&W&R2GRF˜WB‡¢6ˆÁ7B6Á5f˜FR“&˜w3#BÊfñ«FW"á"”‚"Ê6ˆÁ6VÁ7W5˜f˜FW2íÊ∆VÊwFÉ∞¢6ˆÁ7B7E6Á5f˜FR“÷FÇÁ&˜VÊBÇá6Á5f˜FRÚ&˜w3#BÊ∆VÊwFÇí¢ì∞¢ñbá7E6Á5f˜FR„“#Rí∞¢∆W'FRÇ&vVÁG2"¬	˘KB∆#‰6ˆÊ6ñ∆R¢∆W2îÊR&WˆÊFVÁB«W3¬ˆ#Â∆Â∆Ê∞¢∆#‚G∑6Á5f˜FW”¬ˆ#‚Ê«ó6W27W"G∑&˜w3#BÊ∆VÊwFá“ÇG∑7E6Á5f˜FW“Rí‚vˆÁB&V7R∆#ÊV7V‚f˜FS¬ˆ#‚V‚#FÇÂ∆Â∆Ê∞¢∆W2vVÁG2V6Ü˜VVÁB6ñ∆VÊ6ñWW6V÷VÁB¢6∆RWáó&VR¬V˜FFW76R˜Rf˜W&Êó76WW"ñÊ¶ˆñvÊ&∆R‚∞¢FÁBVR6GW&R¬6ÜVRÊ«ó6R6˜WFRFW2¶WFˆÁ2˜W"V‚fW&Fñ7BfñFRÂ∆Â∆Ê∞¢∆6ˆFSÊFˆ6∂W"∆ˆw2F˜W6∆W6÷F6á2÷í“◊Fñ¬C¬w&W&V7V‚f˜FRWá∆ˆóF&∆R#¬ˆ6ˆFSÊì∞¢–†¢ÚÚ"‚Êˆ‚÷6ˆÁ6VÁ7W26á&ˆÊóVR(	B∆W2î&WˆÊFVÁB÷ó2ÊR6ˆÁfW&vVÁB¶÷ó2‡¢6ˆÁ7B6Á46ˆÁ6VÁ7W2“&˜w3#BÊfñ«FW"á"”‚ÁV÷&W"á"Ê6ˆÊfñFVÊ6Rí√“SRíÊ∆VÊwFÉ∞¢6ˆÁ7B7E6Á46ˆÁ6VÁ7W2“÷FÇÁ&˜VÊBÇá6Á46ˆÁ6VÁ7W2Ú&˜w3#BÊ∆VÊwFÇí¢ì∞¢ñbá7E6Á46ˆÁ6VÁ7W2„“Sí∞¢∆W'FRÇ&6ˆÁ6VÁ7W2"¬	˘˙∆#‰6ˆÊ6ñ∆R¢2FR6ˆÁ6VÁ7W3¬ˆ#Â∆Â∆Ê∞¢∆#‚G∑6Á46ˆÁ6VÁ7W7”¬ˆ#‚Ê«ó6W27W"G∑&˜w3#BÊ∆VÊwFá“ÇG∑7E6Á46ˆÁ6VÁ7W7“Rí6˜'FVÁBSRR∞¢*≤V7V‚6ˆÁ6VÁ7W2+≤V‚#FÇÂ∆Â∆Ê∞¢ñ¬fWB2îBv66˜&B7W"∆R‘T‘R÷&6ÜR˜W"RwV‚6ñvÊ¬WÜó7FR‚∞¢R÷FV∆FRSR¬6R‚vW7B«W2FR∆'VFVÊ6R¬2vW7BV‚Gó6fˆÊ7FñˆÊÊV÷VÁB¢∞¢vVÁG2V‚V6ÜV2¬˜R÷&6ÜW2&˜˜6W2G&˜Fó7W'<:ó2˜W"6ˆÁfW&vW"Êì∞¢–†¢ÚÚ2‚&ˆGV7Fñˆ‚6Á2FñfgW6ñˆ‚(	B∆RGVÊÊV¬6R&V◊∆óB¬&ñV‚‚vV‚6˜'B‡¢6ˆÁ7B&˜w3CÇ“F"Á&W&RÄ¢%4TƒT5B6ñu˜6VÁE˜7FÊF&B¬6ñu˜6VÁE˜&V÷óV“¬6ñu˜6VÁEˆV∆óFR"∞¢"e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RÊ«ó6VEˆB„“Ú ¢íÊ∆¬ÜFWVó3CÜÇì∞¢6ˆÁ7BFñfgW6W3CÇ“&˜w3CÇÊfñ«FW"á"”‚"Á6ñu˜6VÁE˜7FÊF&B””“«¬"Á6ñu˜6VÁE˜&V÷óV“””“«¬"Á6ñu˜6VÁEˆV∆óFR””“íÊ∆VÊwFÉ∞¢ñbá&˜w3CÇÊ∆VÊwFÇ„“3bbFñfgW6W3CÇ””“í∞¢∆W'FRÇ&FñfgW6ñˆ‚"¬	˘˙∆#‰V7V‚6ñvÊ¬FñfgW6RFWVó2CÜÉ¬ˆ#Â∆Â∆Ê∞¢∆#‚G∑&˜w3CÇÊ∆VÊwFá”¬ˆ#‚Ê«ó6W2&ˆGVóFW2¬∆#„¬ˆ#‚VÁf˜ñVR7W"FV∆Vw&“Â∆Â∆Ê∞¢∆R'VFvWBîW7B6ˆÁ6ˆ÷÷R6Á2RvV7V‚&ˆÊÊRÊR&V6ˆófRVˆíVR6R6ˆóB‚∞¢÷˜Fñg2fW&ñfñW"•∆Ê∞¢∆6ˆFSÊFˆ6∂W"WÜV2F˜W6∆W6÷F6á2÷íÊˆFR÷R&6ˆÁ7BC◊&WVó&RÇv&WGFW"◊7∆óFS2rì∂6ˆÁ7B#÷ÊWrBÇrˆFF˜F∆“ÊF"r«∑&VFˆÊ«ìßG'VW“ì∂6ˆÁ7B3÷ÊWrFFRÑFFRÊÊ˜rÇí”CÇ£3fSRíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ√ííÁ&W∆6RÇuBr¬rrì∂6ˆÁ7B”◊∑”∂"Á&W&RÇu4TƒT5BFñfgW6ñˆÂˆ&∆ˆ6≤"e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RÊ«ó6VEˆC„”ÚríÊ∆¬Ü2íÊf˜$V6ÇáÉ”Á∂6ˆÁ7B≥◊ÇÊ'«¬rÜV7V‚ís∂’∂µ”“Ü’∂µ◊«√í≥“ì∂6ˆÁ6ˆ∆RÊ∆ˆrÜ“í#¬ˆ6ˆFSÊì∞¢–¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂6ˆÊ6ñ∆R◊vF6ÜFˆu“"¬RÊ÷W76vRì∞¢–ß–†¢ÚÚ)H)HvF6ÜFˆrBvñÁL:ñw&óL:í¢∆W'FR6í∆&6RW&BFW2FˆÊÏ:ñW2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚ‹:ñ÷˜&ó6R∆Rñ2Üó7F˜&óVRFR∆ñvÊW2‚6í∆R6ˆ◊FR6áWFRFR«W2FR#R ¢ÚÚ&˜'BRñ2á6ñvÊGW&RBwV‚vóRÚF˜v‚◊bí¬∆W'FR¬vF÷ñ‚7W"FV∆Vw&“W@¢ÚÚL:ñ6∆VÊ6ÜRV‚6Ê6Ü˜BFR6V6˜W'2‚ÊR&∆˜VR¶÷ó2¬v(	B7W'fVñ∆∆Ê6R6WV∆R‡¶∆WB˜V¥Ê«ó6W46˜VÁB“∞¶∆WBˆ∆7EvóT∆W'B“∞¶gVÊ7Fñˆ‚FFñÁFVw&óGïvF6ÜFˆrÇí∞¢G'í∞¢6ˆÁ7B2“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í2e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2"íÊvWBÇìÚÊ2ÛÚ∞¢ñbÜ2‚˜V¥Ê«ó6W46˜VÁBí˜V¥Ê«ó6W46˜VÁB“3∞¢ÚÚ6áWFR‚#RGRñ2¬ñ26ñvÊñfñ6Fñb¬2Bv∆W'FRFÁ2∆FW&Êú:á&RÜWW&P¢ñbÖ˜V¥Ê«ó6W46˜VÁB„“Sbb2¬˜V¥Ê«ó6W46˜VÁB¢„ÇbbFFRÊÊ˜rÇí“ˆ∆7EvóT∆W'B‚3cí∞¢ˆ∆7EvóT∆W'B“FFRÊÊ˜rÇì∞¢6ˆÁ7B◊6r“	˘™Ç∆#‰ƒU%DRU%DRDRDÙ‰Ï8îU3¬ˆ#Â∆Â∆‰∆W2Ê«ó6W26ˆÁB7<:ñW2FR∆#‚Gµ˜V¥Ê«ó6W46˜VÁG”¬ˆ#‚:∆#‚G∂7”¬ˆ#‚∆ñvÊW2Â∆Â∆‰6W6R&ˆ&&∆R¢&V'Vñ∆B˜fˆ«V÷RFˆ6∂W"Vff<:í‚&W7FW&R∆RFW&ÊñW"6Ê6Ü˜B•∆„∆6ˆFSÊ«2”Bˆ˜B˜F˜W6∆W6÷F6á2ˆFF˜6Ê6Ü˜G2Ú¬ÜVC¬ˆ6ˆFSÂ∆Â∆‰ÜW&‹:á2‚v2∆RG&ˆóBFR7W&ñ÷W"FW2FˆÊÏ:ñW2(	Bl:ó&ñfñR6RVí2vW7B7<:íÊ∞¢6ˆÁ6ˆ∆RÊW'&˜"Ü∑vF6ÜFˆu“4ÖUDRDRDÙ‰Ï8îU3¢Gµ˜V¥Ê«ó6W46˜VÁG“(i"G∂7÷ì∞¢ñbáGóVˆbDTƒTu$’ÙD‘îÂÙ4ÑEÙîB”“'VÊFVfñÊVB"bbDTƒTu$’ÙD‘îÂÙ4ÑEÙîBí∞¢6VÊEFV∆Vw&‘÷W76vRÖDTƒTu$’ÙD‘îÂÙ4ÑEÙîB¬◊6ríÊ6F6ÇÇÇí”‚∑“ì∞¢–¢ÚÚ6Ê6Ü˜BFR6V6˜W'2ñ÷‹:ñFñBFR¬|:óFB7GVV¬Ü‹:¶÷R,:ñGVóBí˜W"f˜&VÁ6ñ70¢G'í≤&ˆ˜E6Ê6Ü˜BÇì≤“6F6ÇÖÚí∑–¢–¢“6F6ÇÜRí≤Ú¢F&∆R'6VÁFRRF˜WB&V÷ñW"&ˆ˜B(	BñvÊ˜&W"¢Ú–ß–†¶6ˆÁ7Bı%B“&ˆ6W72ÊVÁbÂı%B«¬3∞¢ÚÚ)H)HñÁFW&Ê¬(	B∆ó7FR&ˆÊÏ:ó2Wáó&ÁBFÁ2‚¶˜W'2á˜W"ÜW&‹:á2í)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆñÁFW&Ê¬ˆWáó&ñÊr÷6ˆFW2"¬á&W¬&W2í”‚∞¢6ˆÁ7BÑU$‘U5ıDÙ¥T‚“&ˆ6W72ÊVÁb‰ÑU$‘U5ÙD‘îÂıDƒ’Ù$ıC∞¢6ˆÁ7B6V7&WB“&WÊÜVFW'5≤'Ç÷ñÁFW&Ê¬◊6V7&WB%”∞¢ñbÇÑU$‘U5ıDÙ¥T‚«¬6V7&WB”“ÑU$‘U5ıDÙ¥T‚í&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R“ì∞¢6ˆÁ7BFó2“'6TñÁBá&WÁVW'íÊFó2í«¬s∞¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7BÊ˜r“ÊWrFFRÇì∞¢6ˆÁ7B7WFˆfb“ÊWrFFRÜÊ˜rÊvWEFñ÷RÇí≤Fó2¢ÉcCíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7B&˜w2“6ˆFW4F"Á&W&RÄ¢%4TƒT5BV÷ñ¬¬∆‚¬Wáó&W5ˆBe$Ù“6ˆFW2tÑU$R7FófR“‰B∆‚“vg&VRr‰BWáó&W5ˆBï2‰ıBÂTƒ¬‰BWáó&W5ˆB√“Úı$DU"%íWáó&W5ˆB ¢íÊ∆¬Ü7WFˆfbì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢6ˆÁ7BvóFÑFñfb“&˜w2Ê÷á"”‚á∞¢‚‚Á"¿¢Fó4∆VgC¢÷FÇÁ&˜VÊBÇÜÊWrFFRá"ÊWáó&W5ˆBí“Ê˜ríÚÉcCê¢“íì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6˜VÁC¢vóFÑFñfbÊ∆VÊwFÇ¬Wáó&ñÊs¢vóFÑFñfb“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ)H)HF÷ñ‚F6Ü&ˆ&B(	Bvw&VvFVBFFVÊGˆñÁB)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶ÊvWBÇ"ˆF÷ñ‚ˆF6Ü&ˆ&B÷FF"¬á&W¬&W2í”‚∞¢6ˆÁ7B≤V÷ñ¬¬6ˆFR““&WÁVW'ì∞¢ñbÇó4F÷ñ‚ÜV÷ñ¬¬6ˆFRíí&WGW&‚&W2Á7FGW2ÉC2íÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢$6<:á2F÷ñ‚&WVó2"“ì∞†¢G'í∞¢ÚÚ)H)HÜV«FÇ)H)H ¢6ˆÁ7BÜV«FÇ“∞¢ì¢≤7FGW3¢&ˆ≤"¬WFñ÷S¢÷FÇÁ&˜VÊBá&ˆ6W72ÁWFñ÷RÇíí“¿¢÷V÷˜'ì¢∞¢'73¢÷FÇÁ&˜VÊBá&ˆ6W72Ê÷V÷˜'ïW6vRÇíÁ'72ÚCÉSsbí¿¢ÜVW6VC¢÷FÇÁ&˜VÊBá&ˆ6W72Ê÷V÷˜'ïW6vRÇíÊÜVW6VBÚCÉSsbí¿¢ÜVF˜F√¢÷FÇÁ&˜VÊBá&ˆ6W72Ê÷V÷˜'ïW6vRÇíÊÜVF˜F¬ÚCÉSsbí¿¢“¿¢ÊˆFS¢&ˆ6W72ÁfW'6ñˆ‚¿¢F%6ó¶S¢ÇÇí”‚∞¢G'í≤&WGW&‚÷FÇÁ&˜VÊBÜg2Á7FE7ñÊ2ÑD%ıDÇíÁ6ó¶RÚCÉSsbì≤“6F6Ç≤&WGW&‚ÁV∆√≤–¢“íÇí¿¢”∞†¢ÚÚ)H)H'W6ñÊW72(	B7V'67&óFñˆÁ2)H)H ¢∆WB'W6ñÊW72“≤W6W'3¢∑“¬Wáó&ñÊu˜6ˆˆ„¢¬Wáó&VE˜F˜F√¢”∞¢G'í∞¢6ˆÁ7B6ˆFW4F"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇ¬≤&VFˆÊ«ì¢G'VR“ì∞¢6ˆÁ7B∆¬“6ˆFW4F"Á&W&RÇ%4TƒT5B∆‚¬7FófR¬Wáó&W5ˆB¬V÷ñ¬¬7&VFVEˆBe$Ù“6ˆFW2"íÊ∆¬Çì∞¢6ˆFW4F"Ê6∆˜6RÇì∞¢6ˆÁ7BÊ˜r“ÊWrFFRÇì∞¢6ˆÁ7B7FófR“∆¬Êfñ«FW"á"”‚"Ê7FófR””“ì∞¢6ˆÁ7B6˜VÁG2“≤g&VS¢¬&V÷óV”¢¬fó¢¬V∆óFS¢¬F˜F√¢7FófRÊ∆VÊwFÇ”∞¢7FófRÊf˜$V6Çá"”‚≤ñbÜ6˜VÁG5∑"Á∆Â“”“VÊFVfñÊVBí6˜VÁG5∑"Á∆Â“≤≥≤“ì∞¢6ˆÁ7BWáó&ñÊs6B“7FófRÊfñ«FW"á"”‚∞¢ñbÇ"ÊWáó&W5ˆBí&WGW&‚f«6S∞¢6ˆÁ7BB“÷FÇÁ&˜VÊBÇÜÊWrFFRá"ÊWáó&W5ˆBí“Ê˜ríÚÉcCì∞¢&WGW&‚B„“bbB√“3∞¢“íÊ∆VÊwFÉ∞¢6ˆÁ7BWáó&VB“∆¬Êfñ«FW"á"”‚"ÊWáó&W5ˆBbbÊWrFFRá"ÊWáó&W5ˆBí¬Ê˜ríÊ∆VÊwFÉ∞¢6ˆÁ7BÊWuFˆFí“∆¬Êfñ«FW"á"”‚"Ê7&VFVEˆBbb"Ê7&VFVEˆBÁ6∆ñ6RÉ¬í””“Ê˜rÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ííÊ∆VÊwFÉ∞¢'W6ñÊW72“≤W6W'3¢6˜VÁG2¬Wáó&ñÊu˜6ˆˆ„¢Wáó&ñÊs6B¬Wáó&VE˜F˜F√¢Wáó&VB¬ÊWu˜FˆFì¢ÊWuFˆFí”∞¢“6F6ÇÜRí≤'W6ñÊW72ÊW'&˜"“RÊ÷W76vS≤–†¢ÚÚ)H)HÊ«óFñ72(	Bfó6óF˜'2)H)H ¢∆WBÊ«óFñ72“∑”∞¢G'í∞¢6ˆÁ7BFˆFí“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BFˆFï&˜w2“F"Á&W&RÇ%4TƒT5BóˆÜ6Ç¬vR¬WF’˜6˜W&6R¬&VfW'&W"e$Ù“vU˜fñWw2tÑU$RFFRÜ7&VFVEˆBí“Ú"íÊ∆¬áFˆFíì∞¢6ˆÁ7BVÊóVUFˆFí“ÊWr6WBáFˆFï&˜w2Ê÷á"”‚"ÊóˆÜ6ÇííÁ6ó¶S∞¢6ˆÁ7BñW7FW&Fí“ÊWrFFRÑFFRÊÊ˜rÇí“ÉcCíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢6ˆÁ7BñW7FW&Fî6˜VÁB“F"Á&W&RÇ%4TƒT5B4ıTÂBÑDï5Dî‰5BóˆÜ6Çí22e$Ù“vU˜fñWw2tÑU$RFFRÜ7&VFVEˆBí“Ú"íÊvWBáñW7FW&Fíì∞¢6ˆÁ7B∆7Cr“F"Á&W&RÇ%4TƒT5BFFRÜ7&VFVEˆBí2B¬4ıTÂBÑDï5Dî‰5BóˆÜ6Çí2fó6óF˜'2¬4ıTÂBÇ¢í2fñWw2e$Ù“vU˜fñWw2tÑU$R7&VFVEˆB„“FFWFñ÷RÇvÊ˜rr¬r”rFó2ríu$ıU%íBı$DU"%íB"íÊ∆¬Çì∞¢6ˆÁ7BF˜vW2“∑”∞¢FˆFï&˜w2Êf˜$V6Çá"”‚≤F˜vW5∑"ÁvU““áF˜vW5∑"ÁvU“«¬í≤≤“ì∞¢6ˆÁ7BF˜6˜W&6W2“∑”∞¢FˆFï&˜w2Êf˜$V6Çá"”‚∞¢∆WB7&2“"ÁWF’˜6˜W&6R«¬&Fó&V7B#∞¢ñbÇ"ÁWF’˜6˜W&6Rbb"Á&VfW'&W"í∞¢G'í≤7&2“ÊWrU$¬á"Á&VfW'&W"íÊÜ˜7FÊ÷RÁ&W∆6RÇ'wwr‚"¬""í«¬&Fó&V7B#≤“6F6Ç≤7&2“&Fó&V7B#≤–¢–¢F˜6˜W&6W5∑7&5““áF˜6˜W&6W5∑7&5“«¬í≤∞¢“ì∞¢Ê«óFñ72“∞¢FˆFì¢≤fó6óF˜'3¢VÊóVUFˆFí¬fñWw3¢FˆFï&˜w2Ê∆VÊwFÇ“¿¢ñW7FW&Fì¢≤fó6óF˜'3¢ñW7FW&Fî6˜VÁCÚÊ2«¬“¿¢∆7CvFó3¢∆7Cr¿¢F˜vW3¢ˆ&¶V7BÊVÁG&ñW2áF˜vW2íÁ6˜'BÇÜ¬"í”‚%≥““≥“íÁ6∆ñ6RÉ¬í¿¢F˜6˜W&6W3¢ˆ&¶V7BÊVÁG&ñW2áF˜6˜W&6W2íÁ6˜'BÇÜ¬"í”‚%≥““≥“íÁ6∆ñ6RÉ¬í¿¢”∞¢“6F6ÇÜRí≤Ê«óFñ72ÊW'&˜"“RÊ÷W76vS≤–†¢ÚÚ)H)H&ˆÊ˜7Fñ72(	BW&f˜&÷Ê6R)H)H ¢6ˆÁ7BW&b“vWD6ˆÊ6ñ∆UW&f˜&÷Ê6RÇì∞¢6ˆÁ7B6ñvÊƒf˜'B“vWE6ñvÊƒf˜'E7FG2Çì∞¢6ˆÁ7BFá&W6Üˆ∆B“vWDFFófU6ñvÊ≈Fá&W6Üˆ∆BÇì∞¢∆WB7W'&VÁEñ6≤“ÁV∆√∞¢G'í∞¢6ˆÁ7B&r“•4Ù‚Á'6RÜg2Á&VDfñ∆U7ñÊ2ÑÑU$‘U5ıî4µ5ıDÇ¬'WFcÇ"íì∞¢7W'&VÁEñ6≤“&rÊ7W'&VÁEñ6≤«¬ÁV∆√∞¢“6F6Ç≤G'í≤7W'&VÁEñ6≤“∆ˆEñ6≤Çì≤“6F6Ç∑“–†¢6ˆÁ7B&ˆÊ˜7Fñ72“∞¢7W'&VÁEñ6≤¿¢6ñvÊƒf˜'C¢≤F˜F√¢6ñvÊƒf˜'BÁF˜F¬¬vñÁ3¢6ñvÊƒf˜'BÁvñÁ2¬∆˜76W3¢6ñvÊƒf˜'BÊ∆˜76W2¬vñÁ&FS¢6ñvÊƒf˜'BÁvñÁ&FR¬Fá&W6Üˆ∆B“¿¢&V6VÁC¢W&bÁ&V6VÁB«¬µ“¿¢'îvVÁC¢W&bÊ'îvVÁB«¬µ“¿¢'ï7˜'C¢W&bÊ'ï7˜'B«¬µ“¿¢”∞†¢ÚÚ)H)H∆W'G2)H)H ¢6ˆÁ7B∆W'G2“µ”∞¢ñbÜ'W6ñÊW72ÊWáó&ñÊu˜6ˆˆ‚‚í∆W'G2ÁW6Çá≤∆WfV√¢'v&ÊñÊr"¬◊6s¢G∂'W6ñÊW72ÊWáó&ñÊu˜6ˆˆÁ“&ˆÊÊV÷VÁBá2íWáó&VÁBFÁ22¶˜W'6“ì∞¢ñbÜÜV«FÇÊ÷V÷˜'íÊÜVW6VB‚Cí∆W'G2ÁW6Çá≤∆WfV√¢&FÊvW""¬◊6s¢‹:ñ÷ˆó&RÜV:ñ∆Wl:ñS¢G∂ÜV«FÇÊ÷V÷˜'íÊÜVW6VG“‘&“ì∞¢ñbÇïı5ı%E5Ù¥UíbbdÙıD$ƒ≈ÙDDÙ¥Uíí∆W'G2ÁW6Çá≤∆WfV√¢&FÊvW""¬◊6s¢$V7VÊR6Ã:íí7˜'FófR6ˆÊfñwW,:ñR"“ì∞¢ñbÇ5E$ïUı4T5$UEÙ¥Uíí∆W'G2ÁW6Çá≤∆WfV√¢&FÊvW""¬◊6s¢$6Ã:í7G&óRÊˆ‚6ˆÊfñwW,:ñR"“ì∞¢ñbÇDTƒTu$’Ù$ıEıDÙ¥T‚í∆W'G2ÁW6Çá≤∆WfV√¢'v&ÊñÊr"¬◊6s¢$&˜BFV∆Vw&“Êˆ‚6ˆÊfñwW,:í"“ì∞¢ñbÇ%$UdıÙïÙ¥Uíí∆W'G2ÁW6Çá≤∆WfV√¢'v&ÊñÊr"¬◊6s¢$í'&WfÚÊˆ‚6ˆÊfñwW,:ñR"“ì∞¢ñbá6ñvÊƒf˜'BÁvñÁ&FR‚bb6ñvÊƒf˜'BÁvñÁ&FR¬Sbb6ñvÊƒf˜'BÁF˜F¬„“í∆W'G2ÁW6Çá≤∆WfV√¢&FÊvW""¬◊6s¢vñÁ&FR6ñvÊ¬f˜'B&3¢G∑6ñvÊƒf˜'BÁvñÁ&FW“V“ì∞†¢ÚÚ)H)H&V6VÁB7FófóGí∆ˆr)H)H ¢∆WB7FófóGî∆ˆr“µ”∞¢G'í∞¢6ˆÁ7B&V6VÁDÊ«ó6W2“F"Á&W&RÇ%4TƒT5BÜˆ÷R¬ví¬6ˆ◊WFóFñˆ‚¬&W7Eˆ&WB¬6ˆÊfñFVÊ6R¬˜WF6ˆ÷R¬Ê«ó6VEˆBe$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2ı$DU"%íÊ«ó6VEˆBDU42ƒî‘ïBR"íÊ∆¬Çì∞¢7FófóGî∆ˆr“&V6VÁDÊ«ó6W2Ê÷á"”‚á∞¢GóS¢&Ê«ó6ó2"¿¢FWáC¢G∑"ÊÜˆ÷W“g2G∑"Êvó“(	BG∑"Ê&W7Eˆ&WG“ÇG∑"Ê6ˆÊfñFVÊ6W“RíG∑"Ê˜WF6ˆ÷RÚ"(i""≤"Ê˜WF6ˆ÷R¢"'÷¿¢FFS¢"ÊÊ«ó6VEˆB¿¢“íì∞¢“6F6Ç∑–†¢ÚÚ)H)H6W'fñ6W27FGW2)H)H ¢6ˆÁ7B6W'fñ6W2“∞¢ï˜7˜'G3¢ïı5ı%E5Ù¥Uí¿¢fˆ˜F&∆≈ˆFF¢dÙıD$ƒ≈ÙDDÙ¥Uí¿¢7G&óS¢5E$ïUı4T5$UEÙ¥Uí¿¢FV∆Vw&”¢DTƒTu$’Ù$ıEıDÙ¥T‚¿¢'&WfÛ¢%$UdıÙïÙ¥Uí¿¢w&˜¢u$ıÙïÙ¥Uí¿¢FVW6VV≥¢DTU4TTµÙïÙ¥Uí¿¢”∞†¢ÚÚ)H)He2≤Fˆ6∂W"≤&6∑W2Üg&ˆ“Ü˜7B7&ˆ‚67&óBfñ˜6Ü&VB˜g2◊7FGW2Êß6ˆ‚í)H)H ¢∆WBg2“∑“¬Fˆ6∂W"“≤6ˆÁFñÊW'3¢µ““¬&6∑W2“≤∆FW7C¢ÁV∆¬¬fñ∆W3¢µ“”∞¢G'í∞¢6ˆÁ7B7FGW5&r“g2Á&VDfñ∆U7ñÊ2Ç"˜6Ü&VB˜g2◊7FGW2Êß6ˆ‚"¬'WFcÇ"ì∞¢6ˆÁ7B7FGW2“•4Ù‚Á'6Rá7FGW5&rì∞¢g2“≤&”¢7FGW2Á&“¬7S¢7FGW2Ê7R¬Fó6≥¢7FGW2ÊFó6≤¬∆ˆC¢7FGW2Ê∆ˆB¬WFñ÷S¢7FGW2ÁWFñ÷R¬6ˆ∆∆V7FVDC¢7FGW2ÁFñ÷W7F◊”∞†¢ñbág2Á&“bbg2Á&“Á7B‚ìí∆W'G2ÁW6Çá≤∆WfV√¢&FÊvW""¬◊6s¢$“e27&óFóVR¢G∑g2Á&“Á7G“V“ì∞¢V«6Rñbág2Á&“bbg2Á&“Á7B‚sRí∆W'G2ÁW6Çá≤∆WfV√¢'v&ÊñÊr"¬◊6s¢$“e2V∆WfVR¢G∑g2Á&“Á7G“V“ì∞¢ñbág2ÊFó6≤bbg2ÊFó6≤Á7B‚ìí∆W'G2ÁW6Çá≤∆WfV√¢&FÊvW""¬◊6s¢Fó7VRe27&óFóVR¢G∑g2ÊFó6≤Á7G“V“ì∞¢V«6Rñbág2ÊFó6≤bbg2ÊFó6≤Á7B‚sRí∆W'G2ÁW6Çá≤∆WfV√¢'v&ÊñÊr"¬◊6s¢Fó7VRe2V∆WfR¢G∑g2ÊFó6≤Á7G“V“ì∞¢ñbág2Ê7R“ÁV∆¬bbg2Ê7R‚ìí∆W'G2ÁW6Çá≤∆WfV√¢&FÊvW""¬◊6s¢5Re27&óFóVR¢G∑g2Ê7W“V“ì∞†¢6ˆÁ7B7F∆T÷ñ‚“7FGW2ÁFñ÷W7F◊ÚÑFFRÊÊ˜rÇí“ÊWrFFRá7FGW2ÁFñ÷W7F◊íÊvWEFñ÷RÇííÚc¢ììì∞¢ñbá7F∆T÷ñ‚‚Rí∆W'G2ÁW6Çá≤∆WfV√¢'v&ÊñÊr"¬◊6s¢FˆÊÊVW2e2ˆ'6ˆ∆WFW2ÇG¥÷FÇÁ&˜VÊBá7F∆T÷ñ‚ó“÷ñ‚ñ“ì∞†¢ñbÑ'&íÊó4'&íá7FGW2ÊFˆ6∂W"íí∞¢Fˆ6∂W"Ê6ˆÁFñÊW'2“7FGW2ÊFˆ6∂W#∞¢Fˆ6∂W"Á'VÊÊñÊr“Fˆ6∂W"Ê6ˆÁFñÊW'2Êfñ«FW"Ü2”‚2Á7FFR””“''VÊÊñÊr"íÊ∆VÊwFÉ∞¢Fˆ6∂W"Á7F˜VB“Fˆ6∂W"Ê6ˆÁFñÊW'2Êfñ«FW"Ü2”‚2Á7FFR”“''VÊÊñÊr"íÊ∆VÊwFÉ∞¢Fˆ6∂W"ÁF˜F¬“Fˆ6∂W"Ê6ˆÁFñÊW'2Ê∆VÊwFÉ∞¢ñbÜFˆ6∂W"Á7F˜VB‚í∆W'G2ÁW6Çá≤∆WfV√¢'v&ÊñÊr"¬◊6s¢G∂Fˆ6∂W"Á7F˜VG“6ˆÁFVÊWW"á2íFˆ6∂W"'&WFRá2ñ“ì∞¢–†¢ñbÑ'&íÊó4'&íá7FGW2Ê&6∑W2íí∞¢&6∑W2Êfñ∆W2“7FGW2Ê&6∑W2Á6∆ñ6RÉ¬ì∞¢&6∑W2Ê∆FW7B“&6∑W2Êfñ∆W5≥“«¬ÁV∆√∞¢&6∑W2ÁF˜F¬“7FGW2Ê&6∑W2Ê∆VÊwFÉ∞¢ñbÜ&6∑W2Ê∆FW7Bí∞¢6ˆÁ7BÜ˜W'56ñÊ6R“ÑFFRÊÊ˜rÇí“ÊWrFFRÜ&6∑W2Ê∆FW7BÊFFRíÊvWEFñ÷RÇííÚ3c∞¢ñbÜÜ˜W'56ñÊ6R‚CÇí∆W'G2ÁW6Çá≤∆WfV√¢&FÊvW""¬◊6s¢FW&ÊñW&R6WfVv&FRñ¬íG¥÷FÇÁ&˜VÊBÜÜ˜W'56ñÊ6Ró÷Ü“ì∞¢V«6RñbÜÜ˜W'56ñÊ6R‚#Bí∆W'G2ÁW6Çá≤∆WfV√¢'v&ÊñÊr"¬◊6s¢FW&ÊñW&R6WfVv&FRñ¬íG¥÷FÇÁ&˜VÊBÜÜ˜W'56ñÊ6Ró÷Ü“ì∞¢“V«6R∞¢∆W'G2ÁW6Çá≤∆WfV√¢&FÊvW""¬◊6s¢$V7VÊR6WfVv&FRG&˜WfVR"“ì∞¢–¢–¢“6F6ÇÜRí∞¢g2ÊW'&˜"“'g2◊7FGW2Êß6ˆ‚ñÊFó7ˆÊñ&∆R(	BñÁ7F∆∆W"∆R7&ˆ‚7W"∆RÜ˜7B#∞¢–†¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬ÜV«FÇ¬g2¬Fˆ6∂W"¬&6∑W2¬'W6ñÊW72¬Ê«óFñ72¬&ˆÊ˜7Fñ72¬∆W'G2¬7FófóGî∆ˆr¬6W'fñ6W2¬Fñ÷W7F◊¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%∂F÷ñ‚÷F6Ü&ˆ&E“"¬RÊ÷W76vRì∞¢&W2Á7FGW2ÉSíÊß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¶ñbá&WVó&RÊ÷ñ‚””“÷ˆGV∆Rí∞¢ÚÚ””””“T‰EÙîÂE244ı$î‰rc"””””–¶ÊvWBÇ"˜66˜&ñÊrˆ∆VwVR◊&FñÊw2"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B7FG2“F"Á&W&RÇ%4TƒT5B¢e$Ù“∆VwVU˜&FñÊw2ı$DU"%í6∆7242¬vñÁ&FRDU42"íÊ∆¬Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬∆VwVW3¢7FG2«¬µ““ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¶ÊvWBÇ"˜66˜&ñÊrˆWf«VFR"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B≤6ˆÊfñFVÊ6R¬∆VwVR““&WÁVW'ì∞¢6ˆÁ7B66˜&R“6ˆ◊WFUvVñváFVE66˜&Rá'6Tf∆ˆBÜ6ˆÊfñFVÊ6R«¬í¬∆VwVR«¬""ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Á66˜&R“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¶ÊvWBÇ"˜66˜&ñÊrˆ÷&∂WB÷6ÜV6≤"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B≤÷&∂WB¬6ˆ◊WFóFñˆ‚““&WÁVW'ì∞¢6ˆÁ7B6ÜV6≤“ó4÷&∂WDfñ∆&∆Tñ‰g&Ê6RÜ÷&∂WB«¬""¬6ˆ◊WFóFñˆ‚«¬""ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬‚‚Ê6ÜV6≤“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞¢ÚÚ””””“dî‚T‰EÙîÂE244ı$î‰rc"””””–†¢ÚÚ””””“T‰EÙîÂE2D‘î‚c"””””–†¢ÚÚF6Ü&ˆ&B7FG2“7FG2v∆ˆ&∆W0¶ÊvWBÇ"ˆF÷ñ‚˜7FG2"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BF˜F¬“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2"íÊvWBÇíÊ3∞¢6ˆÁ7B&W6ˆ«fVB“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$R˜WF6ˆ÷Rï2‰ıBÂTƒ¬‰B˜WF6ˆ÷R“wVÊFñÊrr"íÊvWBÇíÊ3∞¢6ˆÁ7BvñÁ2“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$R˜WF6ˆ÷S“wvñ‚r"íÊvWBÇíÊ3∞¢6ˆÁ7B∆˜76W2“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$R˜WF6ˆ÷S“v∆˜72r"íÊvWBÇíÊ3∞¢6ˆÁ7B&VgW6VB“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“FV6ó6ñˆÂˆ¶˜W&Ê¬tÑU$RFV6ó6ñˆ„“w&VgW6VBr"íÊvWBÇíÊ3∞¢6ˆÁ7B&V÷óV““F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$R∆„“w&V÷óV“r‰B˜WF6ˆ÷Rï2‰ıBÂTƒ¬"íÊvWBÇíÊ3∞¢6ˆÁ7BvñÁ&FR“&W6ˆ«fVB‚Ú÷FÇÁ&˜VÊBÇávñÁ2Ú&W6ˆ«fVBí¢íÚ¢∞¢6ˆÁ7B&ˆí“&W6ˆ«fVB‚Ú÷FÇÁ&˜VÊBÇÇávñÁ2“∆˜76W2íÚ&W6ˆ«fVBí¢íÚ¢∞¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¬F˜F¬¬&W6ˆ«fVB¬vñÁ2¬∆˜76W2¬&VgW6VB¬&V÷óV“¿¢vñÁ&FR¬&ˆí¬&ˆfóEˆ∆˜73¢vñÁ2“∆˜76W0¢“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ∆VwVR&FñÊw0¶ÊvWBÇ"ˆF÷ñ‚ˆ∆VwVW2"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B∆VwVW2“F"Á&W&RÇ%4TƒT5B¢e$Ù“∆VwVU˜&FñÊw2ı$DU"%í6∆7242¬vñÁ&FRDU42"íÊ∆¬Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬∆VwVW2“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚvVÁBW&f˜&÷Ê6P¶ÊvWBÇ"ˆF÷ñ‚ˆvVÁG2"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BvVÁG2“F"Á&W&RÇ%4TƒT5B¢e$Ù“vVÁE˜vVñváG2ı$DU"%ívVñváBDU42¬vñÁ&FRDU42"íÊ∆¬Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬vVÁG2“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚFV6ó6ñˆ‚¶˜W&Ê¿¶ÊvWBÇ"ˆF÷ñ‚ˆ¶˜W&Ê¬"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B∆ñ÷óB“÷FÇÊ÷ñ‚É¬'6TñÁBá&WÁVW'íÊ∆ñ÷óB«¬Síì∞¢6ˆÁ7BVÁG&ñW2“F"Á&W&RÇ%4TƒT5B¢e$Ù“FV6ó6ñˆÂˆ¶˜W&Ê¬ı$DU"%í7&VFVEˆBDU42ƒî‘ïBÚ"íÊ∆¬Ü∆ñ÷óBì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬VÁG&ñW2“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ÷&∂WBW&f˜&÷Ê6RW"&WBGóP¶ÊvWBÇ"ˆF÷ñ‚ˆ÷&∂WG2"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B÷&∂WG2“F"Á&W&RÜ ¢4TƒT5B&WEˆ6FVv˜'í¿¢4ıTÂBÇ¢í2F˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰Bí2vñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí2∆˜76W2¿¢$ıT‰BÑdrÜ6ˆÊfñFVÊ6Rí¬í2fuˆ6ˆÊfñFVÊ6P¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R&WEˆ6FVv˜'íï2‰ıBÂTƒ¬‰B˜WF6ˆ÷Rï2‰ıBÂTƒ¬‰B˜WF6ˆ÷R“wVÊFñÊrp¢u$ıU%í&WEˆ6FVv˜'ê¢ı$DU"%íF˜F¬DU40¢íÊ∆¬Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷&∂WG2“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ6ˆ◊WFóFñˆ‚W&f˜&÷Ê6RW"∆VwVP¶ÊvWBÇ"ˆF÷ñ‚ˆ6ˆ◊WFóFñˆÁ2"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B6ˆ◊2“F"Á&W&RÜ ¢4TƒT5B6ˆ◊WFóFñˆ‚¿¢4ıTÂBÇ¢í2F˜F¬¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“wvñ‚rDÑT‚T≈4RT‰Bí2vñÁ2¿¢5T“Ñ44RtÑT‚˜WF6ˆ÷S“v∆˜72rDÑT‚T≈4RT‰Bí2∆˜76W2¿¢$ıT‰BÑdrÜ6ˆÊfñFVÊ6Rí¬í2fuˆ6ˆÊfñFVÊ6P¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$R6ˆ◊WFóFñˆ‚ï2‰ıBÂTƒ¬‰B6ˆ◊WFóFñˆ‚“rr‰B˜WF6ˆ÷Rï2‰ıBÂTƒ¬‰B˜WF6ˆ÷R“wVÊFñÊrp¢u$ıU%í6ˆ◊WFóFñˆ‡¢ı$DU"%íF˜F¬DU40¢ƒî‘ïBS ¢íÊ∆¬Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬6ˆ◊WFóFñˆÁ3¢6ˆ◊2“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞†¢ÚÚ7ó7FV“ÜV«FÄ¶ÊvWBÇ"ˆF÷ñ‚ˆÜV«FÇ"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BF˜F¬“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2"íÊvWBÇíÊ3∞¢6ˆÁ7B&W6ˆ«fVB“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$R˜WF6ˆ÷Rï2‰ıBÂTƒ¬‰B˜WF6ˆ÷R“wVÊFñÊrr"íÊvWBÇíÊ3∞¢6ˆÁ7B&VgW6VB“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“FV6ó6ñˆÂˆ¶˜W&Ê¬tÑU$RFV6ó6ñˆ„“w&VgW6VBr"íÊvWBÇíÊ3∞¢6ˆÁ7BvñÁ2“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$R˜WF6ˆ÷S“wvñ‚r"íÊvWBÇíÊ3∞¢6ˆÁ7B∆˜76W2“F"Á&W&RÇ%4TƒT5B4ıTÂBÇ¢í22e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$R˜WF6ˆ÷S“v∆˜72r"íÊvWBÇíÊ3∞¢6ˆÁ7BvñÁ&FR“&W6ˆ«fVB‚Ú÷FÇÁ&˜VÊBÇávñÁ2Ú&W6ˆ«fVBí¢íÚ¢∞¢6ˆÁ7B&ˆí“&W6ˆ«fVB‚Ú÷FÇÁ&˜VÊBÇÇávñÁ2“∆˜76W2íÚ&W6ˆ«fVBí¢íÚ¢∞¢6ˆÁ7BF˜vVÁB“F"Á&W&RÇ%4TƒT5BvVÁEˆÊ÷R¬vñÁ&FRe$Ù“vVÁE˜vVñváG2tÑU$RF˜F≈˜&VFñ7FñˆÁ2‚ı$DU"%ívñÁ&FRDU42ƒî‘ïB"íÊvWBÇì∞¢6ˆÁ7BF˜∆VwVR“F"Á&W&RÇ%4TƒT5B∆VwVR¬vñÁ&FRe$Ù“∆VwVU˜&FñÊw2tÑU$RF˜F≈˜&VFñ7FñˆÁ2‚ı$DU"%ívñÁ&FRDU42ƒî‘ïB"íÊvWBÇì∞¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¬WFñ÷S¢÷FÇÁ&˜VÊBá&ˆ6W72ÁWFñ÷RÇíí¿¢F˜F¬¬&W6ˆ«fVB¬&VgW6VB¬vñÁ2¬∆˜76W2¿¢vñÁ&FR¬&ˆí¬&ˆfóEˆ∆˜73¢vñÁ2“∆˜76W2¿¢F˜ˆvVÁC¢F˜vVÁB«¬ÁV∆¬¬F˜ˆ∆VwVS¢F˜∆VwVR«¬ÁV∆¿¢“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞¢ÚÚ””””“‘ï54îÙ‚R(	BVÊGˆñÁG2””””–¶ÊvWBÇ"ˆF÷ñ‚ˆí◊7V6ñ∆ó¶Fñˆ‚"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BFF“F"Á&W&RÇ%4TƒT5B¢e$Ù“ïˆ÷&∂WE˜7V6ñ∆ó¶Fñˆ‚ı$DU"%íF˜F¬DU42ƒî‘ïB"íÊ∆¬Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬FF“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞¶ÊvWBÇ"ˆF÷ñ‚ˆ÷ˆÁFÜ«í÷Üó7F˜'í"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BFF“F"Á&W&RÇ%4TƒT5B¢e$Ù“÷ˆÁFÜ«ï˜6Ê6Ü˜G2ı$DU"%íñV"DU42¬÷ˆÁFÇDU42"íÊ∆¬Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬FF“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞¶ÊvWBÇ"ˆF÷ñ‚ˆ∆W'G2"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BFF“F"Á&W&RÇ%4TƒT5B¢e$Ù“7ó7FV’ˆ∆W'G2ı$DU"%í7&VFVEˆBDU42ƒî‘ïBS"íÊ∆¬Çì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬FF“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞¢ÚÚ””””“VÊB”R””””–†¢ÚÚ””””“dî‚T‰EÙîÂE2D‘î‚c"””””–†††¢ÚÚ””””“”s¢66ÜVGV∆W"7FFRVÊGˆñÁB””””–¶ÊvWBÇ"ˆF÷ñ‚˜66ÜVGV∆W"◊7FFR"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7Bg2“&WVó&RÇ&g2"ì∞¢∆WB7FFR“∑”∞¢G'í≤7FFR“•4Ù‚Á'6RÜg2Á&VDfñ∆U7ñÊ2Ç"˜6Ü&VB˜66ÜVGV∆W%˜7FFRÊß6ˆ‚"¬'WFcÇ"íì≤“6F6ÇÜRí∑–¢ÚÚvWB&ˆ6W72ñÊf¢∆WB66ÜVGV∆W%'VÊÊñÊr“f«6S∞¢G'í∞¢6ˆÁ7B"“&WVó&RÇ&6Üñ∆E˜&ˆ6W72"íÊWÜV57ñÊ2Ç'7ó7FV÷7F¬ó2÷7FófRF∆“◊66ÜVGV∆W""¬∑Fñ÷V˜WC¢3“íÁFı7G&ñÊrÇíÁG&ñ“Çì∞¢66ÜVGV∆W%'VÊÊñÊr“"””“&7FófR#∞¢“6F6ÇÜRí∑–¢6ˆÁ7BWFñ÷R“&ˆ6W72ÁWFñ÷RÇì∞¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢66ÜVGV∆W#¢∞¢7FófS¢66ÜVGV∆W%'VÊÊñÊr¿¢6W'fñ6S¢'F∆“◊66ÜVGV∆W""¿¢WFı˜&W7F'C¢G'VR¿¢&ˆ˜EˆVÊ&∆VC¢G'VR¿¢7FFS¢7FFP¢“¿¢6óFU˜WFñ÷S¢WFñ÷P¢“ì∞¢“6F6ÇÜRí∞¢&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì∞¢–ß“ì∞¢ÚÚ””””“VÊB”r””””–†¢ÚÚ””””“”É¢FFwV&Fñ‚7FFR””””–¢ÚÚ˜R÷WW&VÁB∆W26ñvÊWÇ¢&W'FóFñˆ‚FW2÷˜Fñg2FRÊˆ‚÷FñfgW6ñˆ‚‚&WˆÊ@¢ÚÚf7GVV∆∆V÷VÁB'˜W'Vˆí6ñvÊ¬ñÁBV¶˜W&BváVíÚ"(	B6ÜVR÷˜Fñ`¢ÚÚV∆∆RVÊR6˜'&V7Fñˆ‚FñffW&VÁFR¬WB6Á26WGFRgVRˆ‚6˜'&ñvR¬vfWVv∆R‡¶ÊvWBÇ"ˆF÷ñ‚ˆgVÊÊV¬◊&W˜'B"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B¶˜W'2“÷FÇÊ÷ñ‚É3¬÷FÇÊ÷ÇÉ¬'6TñÁBá&WÁVW'íÊ¶˜W'2í«¬2íì∞¢6ˆÁ7B&˜w2“F"Á&W&RÜ ¢4TƒT5BFñfgW6ñˆÂˆ&∆ˆ6≤¬7˜'B¬4ıTÂBÇ¢í2‡¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RÊ«ó6VEˆB„“FFWFñ÷RÇvÊ˜rr¬Úê¢u$ıU%íFñfgW6ñˆÂˆ&∆ˆ6≤¬7˜'@¢ı$DU"%í‚DU40¢íÊ∆¬Ü“G∂¶˜W'7“Fó6ì∞†¢6ˆÁ7BF˜F¬“&˜w2Á&VGV6RÇá2¬"í”‚2≤"Ê‚¬ì∞¢ÚÚ∆fW&óFR7W"6RVíW7B'FífñVÁBFW26ˆ∆ˆÊÊW26ñu˜6VÁEÚ¢¬2FP¢ÚÚFñfgW6ñˆÂˆ&∆ˆ6≤¢6WGFR6ˆ∆ˆÊÊRW7BÁV∆∆RW76í&ñV‚˜W"VÊRÊ«ó6P¢ÚÚFñfgW6VRVR˜W"VÊRÊ«ó6RÁFW&ñWW&R¬vñÁ7G'V÷VÁFFñˆ‚‚∆W0¢ÚÚ6ˆÊfˆÊG&Rffñ6ÜóB#RFñfgW6&∆W2¬VÁfˆí"(	B6ˆÁG&Fñ7Fˆó&R‡¢6ˆÁ7BFñfgW6W2“F"Á&W&RÜ ¢4TƒT5B4ıTÂBÇ¢í2‚e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RÊ«ó6VEˆB„“FFWFñ÷RÇvÊ˜rr¬Úê¢‰Bá6ñu˜6VÁE˜7FÊF&B“ı"6ñu˜6VÁE˜&V÷óV““ı"6ñu˜6VÁEˆV∆óFR“ê¢íÊvWBÜ“G∂¶˜W'7“Fó6ìÚÊ‚«¬∞¢6ˆÁ7BÊˆÂG&6VW2“F"Á&W&RÜ ¢4TƒT5B4ıTÂBÇ¢í2‚e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RÊ«ó6VEˆB„“FFWFñ÷RÇvÊ˜rr¬Úê¢‰BFñfgW6ñˆÂˆ&∆ˆ6≤ï2ÂTƒ¿¢‰B6ñu˜6VÁE˜7FÊF&B“‰B6ñu˜6VÁE˜&V÷óV““‰B6ñu˜6VÁEˆV∆óFR“ ¢íÊvWBÜ“G∂¶˜W'7“Fó6ìÚÊ‚«¬∞¢6ˆÁ7B$÷˜Fñb“∑”∞¢f˜"Ü6ˆÁ7B"ˆb&˜w2í∞¢ñbá"ÊFñfgW6ñˆÂˆ&∆ˆ6≤””“ÁV∆¬í6ˆÁFñÁVS∞¢6ˆÁ7B≤“"ÊFñfgW6ñˆÂˆ&∆ˆ6≥∞¢$÷˜Fñe∂µ““$÷˜Fñe∂µ“«¬≤Ê«ó6W3¢¬7˜'G3¢∑“”∞¢$÷˜Fñe∂µ“ÊÊ«ó6W2≥“"Ê„∞¢$÷˜Fñe∂µ“Á7˜'G5∑"Á7˜'B«¬#Ú%““á$÷˜Fñe∂µ“Á7˜'G5∑"Á7˜'B«¬#Ú%“«¬í≤"Ê„∞¢–¢6ˆÁ7B÷˜Fñg2“ˆ&¶V7BÊVÁG&ñW2á$÷˜Fñbê¢Ê÷ÇÖ∂÷˜Fñb¬ı“í”‚á≤÷˜Fñb¬Ê«ó6W3¢ÚÊÊ«ó6W2¬'C¢F˜F¬Ú÷FÇÁ&˜VÊBÜÚÊÊ«ó6W2ÚF˜F¬¢í≤"R"¢#R"¬7˜'G3¢ÚÁ7˜'G2“íê¢Á6˜'BÇÜ¬"í”‚"ÊÊ«ó6W2“ÊÊ«ó6W2ì∞†¢ÚÚFñfgW6ñˆÁ2&VV∆∆V÷VÁB'FñW2¬"6Ê¬¬7W"∆÷V÷RfVÊWG&P¢6ˆÁ7BVÁfˆó2“F"Á&W&RÜ ¢4TƒT5@¢5T“á6ñu˜6VÁE˜7FÊF&Bí27FÊF&B¿¢5T“á6ñu˜6VÁE˜&V÷óV“í2&V÷óV“¿¢5T“á6ñu˜6VÁEˆV∆óFRí2V∆óFR¿¢5T“á6ñu˜6VÁEˆg&VRí2w&GVó@¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RÊ«ó6VEˆB„“FFWFñ÷RÇvÊ˜rr¬Úê¢íÊvWBÜ“G∂¶˜W'7“Fó6ì∞†¢ÚÚFñvÊ˜7Fñ2ñ÷÷VFñB¬6∆7V∆R7W"FW26ˆ∆ˆÊÊW2FV¶&VÁ6VñvÊVW2FWVó0¢ÚÚF˜V¶˜W'2Ü6ˆÊfñÊ6R¬6˜FR&VV∆∆R¬7˜'Bí‚ÊRFWVÊBFˆÊ22FP¢ÚÚ¬vñÁ7G'V÷VÁFFñˆ‚¬WB&WˆÊBFW2÷ñÁFVÊÁB&˜R÷WW&VÁB∆W26ñvÊWÇÚ"‡¢6ˆÁ7BDÇ“vWEFñW%Fá&W6Üˆ∆G2Çì∞¢6ˆÁ7BB“F"Á&W&RÜ ¢4TƒT5@¢4ıTÂBÇ¢í2F˜F¬¿¢5T“Ñ44RtÑT‚&V≈ˆˆFBï2ÂTƒ¬ı"&V≈ˆˆFB√“DÑT‚T≈4RT‰Bí26Á5ˆ6˜FU˜&VV∆∆R¿¢5T“Ñ44RtÑT‚&V≈ˆˆFB‚‰B&V≈ˆˆFB¬GµDîU%Ù‘îÂı$T≈ÙÙDG“DÑT‚T≈4RT‰Bí26˜FU˜G&˜ˆ&76R¿¢5T“Ñ44RtÑT‚&V≈ˆˆFB‚GµDîU%Ù‘Öı$T≈ÙÙDG“DÑT‚T≈4RT‰Bí26˜FU˜G&˜ˆÜWFR¿¢5T“Ñ44RtÑT‚&V≈ˆˆFB„“GµDîU%Ù‘îÂı$T≈ÙÙDG“‰B&V≈ˆˆFB√“GµDîU%Ù‘Öı$T≈ÙÙDG“DÑT‚T≈4RT‰Bí26˜FUˆFÁ5ˆfVÊWG&R¿¢5T“Ñ44RtÑT‚∆˜vW"Ñ4ÙƒU44Rá7˜'B¬vfˆ˜F&∆¬ríí“vfˆ˜F&∆¬rDÑT‚T≈4RT‰Bí2fˆ˜F&∆¬¿¢5T“Ñ44RtÑT‚∆˜vW"Ñ4ÙƒU44Rá7˜'B¬vfˆ˜F&∆¬ríí“vfˆ˜F&∆¬rDÑT‚T≈4RT‰Bí2WG&W5˜7˜'G0¢e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W2tÑU$RÊ«ó6VEˆB„“FFWFñ÷RÇvÊ˜rr¬Úê¢íÊvWBÜ“G∂¶˜W'7“Fó6ì∞¢ÚÚ6ˆ÷&ñV‚g&Ê6Üó&ñVÁBDıU2∆W27&óFW&W26Üñfg&W2BwV‚∆ñW"FˆÊÊR¢6ˆÁ7BV∆ñvñ&∆W2“á6WVñƒ6ˆÊbí”‚F"Á&W&RÜ ¢4TƒT5B4ıTÂBÇ¢í2‚e$Ù“6ˆÊ6ñ∆UˆÊ«ó6W0¢tÑU$RÊ«ó6VEˆB„“FFWFñ÷RÇvÊ˜rr¬Úê¢‰B6ˆÊfñFVÊ6R„“¢‰B&V≈ˆˆFB„“GµDîU%Ù‘îÂı$T≈ÙÙDG“‰B&V≈ˆˆFB√“GµDîU%Ù‘Öı$T≈ÙÙDG–¢íÊvWBÜ“G∂¶˜W'7“Fó6¬6WVñƒ6ˆÊbìÚÊ‚«¬∞†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢fVÊWG&Uˆ¶˜W'3¢¶˜W'2¿¢Ê«ó6W5˜F˜F∆W3¢F˜F¬¿¢Ê«ó6W5ˆFñfgW6VW3¢FñfgW6W2¿¢Ê«ó6W5ˆÊˆÂ˜G&6VW3¢ÊˆÂG&6VW2¿¢Ê˜FU˜G&6vS¢ÊˆÂG&6VW0¢ÚG∂ÊˆÂG&6VW7“Ê«ó6W2ÁFW&ñWW&W2¬vñÁ7G'V÷VÁFFñˆ‚¢∆WW"÷˜FñbFR&∆ˆ6vRW7BñÊ6ˆÊÁR‚6RfñW"&FñvÊ˜7Fñ5ˆFˆÊÊVW2"6í÷FW76˜W2V‚GFVÊFÁBÊ ¢¢%F˜WFW2∆W2Ê«ó6W2FR∆fVÊWG&R6ˆÁBG&6VW2‚"¿¢FñvÊ˜7Fñ5ˆFˆÊÊVW3¢∞¢‚‚ÊB¿¢6WVñ«5ˆ6ˆÊfñÊ6UˆGUˆ¶˜W#¢DÇ¿¢V∆ñvñ&∆W5˜7FÊF&C¢V∆ñvñ&∆W2ÖDÇÁ7FÊF&Bí¿¢V∆ñvñ&∆W5˜&V÷óV”¢V∆ñvñ&∆W2ÖDÇÁ&V÷óV“í¿¢V∆ñvñ&∆W5ˆV∆óFS¢V∆ñvñ&∆W2ÖDÇÊV∆óFRí¿¢∆V7GW&S¢'6Á5ˆ6˜FU˜&VV∆∆R“V7VÊRg&ñR6˜FR&ˆˆ∂÷∂W"&V7WW&VR¢6W2Ê«ó6W2ÊRWWfVÁB2WG&RFñfgW6VW2¬VV¬VR6ˆóB∆WW"ÊófVRFR6ˆÊfñÊ6R‚"¿¢“¿¢VÁfˆó5˜%ˆ6Ê√¢VÁfˆó2¿¢V˜F5˜fVÊGW3¢∞¢7FÊF&C¢5D‰D$Eı4ît‰≈ÙDî≈ïÙ4¬&V÷óV”¢$T‘ïT’ı4ît‰≈ÙDî≈ïÙ4¬V∆óFS¢TƒïDUı4ît‰≈ÙDî≈ïÙ4¿¢“¿¢÷˜Fñg5ˆFUˆ&∆ˆ6vS¢÷˜Fñg2¿¢Ê˜FS¢%V‚÷˜FñbÁV¬“Ê«ó6RFñfgW6VR‚∆W2÷˜Fñg26ˆÁB6∆76W2GR«W2g&WVVÁBR÷ˆñÁ2g&WVVÁB¢∆R&V÷ñW"W7B∆Rv˜V∆˜BBvWG&Êv∆V÷VÁBG&óFW"‚"¿¢“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞†¢ÚÚgVR&7&V÷RFR∆7&V÷R"¢6RVívvÊRWB6RVíW&B¬"6Vv÷VÁB¬fV2∆P¢ÚÚfW&Fñ7BGRfñ«G&RV∆óFR‚&WˆÊB∆VW7Fñˆ‚'7W"VˆíFˆóB÷ˆ‚6P¢ÚÚ6ˆÊ6VÁG&W"WBVˆíFˆóB÷ˆ‚6˜WW""¬6Á2fˆó"∆ó&R∆&6R∆÷ñ‚‡¶ÊvWBÇ"ˆF÷ñ‚˜6Vv÷VÁB◊&W˜'B"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B7FG2“vWE6Vv÷VÁE7FG2Çì∞¢6ˆÁ7B÷ñÂ6◊∆R“÷FÇÊ÷ÇÉ¬'6TñÁBá&WÁVW'íÊ÷ñ‚í«¬Rì∞¢6ˆÁ7BFÙ∆ó7B“Üˆ&¢¬6WVñƒ&∆ˆ6vRí”‚ˆ&¶V7BÊVÁG&ñW2Üˆ&¢ê¢Ê÷ÇÖ∂∂Wí¬ı“í”‚á∞¢6Vv÷VÁC¢∂Wí¿¢Ê«ó6W3¢ÚÁB¿¢vvÊW3¢ÚÁr¿¢W&GW3¢ÚÁB“ÚÁr¿¢vñÁ&FS¢ÚÁBÚ÷FÇÁ&˜VÊBÇÜÚÁrÚÚÁBí¢í¢¿¢“íê¢Êfñ«FW"ÇáÇí”‚ÇÊÊ«ó6W2„“÷ñÂ6◊∆Rê¢Á6˜'BÇÜ¬"í”‚"ÁvñÁ&FR“ÁvñÁ&FR«¬"ÊÊ«ó6W2“ÊÊ«ó6W2ê¢Ê÷ÇáÇí”‚á∞¢‚‚ÁÇ¿¢ÚÚ&W&VÊBWÜ7FV÷VÁB∆W26WVñ«2∆óVW2"76W4Üó7F˜&ñ6≈V∆óGîvFP¢fW&Fñ7C¢ÇÊÊ«ó6W2„“6WVñƒ&∆ˆ6vRÁfˆ«V÷RbbÇÁvñÁ&FR¬6WVñƒ&∆ˆ6vRÁvñÁ&FP¢Ú$$ƒıTR ¢¢áÇÁvñÁ&FR„“sÚ$UÑ4TƒƒTÂB"¢ÇÁvñÁ&FR„“SRÚ&6˜'&V7B"¢&7W'fVñ∆∆W""í¿¢“íì∞†¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢Ê˜FS¢%7FFó7FóVW2FVF˜V&∆ˆÊÊVW2‚t$ƒıTRr“∆Rfñ«G&RV∆óFR&VgW6RFV¶6R6Vv÷VÁB‚"¿¢V6ÜÁFñ∆∆ˆÂˆ÷ñÊñ◊V”¢÷ñÂ6◊∆R¿¢÷&6ÜW3¢FÙ∆ó7Bá7FG2Ê÷&∂WB¬≤fˆ«V÷S¢#R¬vñÁ&FS¢S“í¿¢7˜'G3¢FÙ∆ó7Bá7FG2Á7˜'B¬≤fˆ«V÷S¢3¬vñÁ&FS¢S“í¿¢7˜'E˜Öˆ÷&6ÜS¢FÙ∆ó7Bá7FG2Á7˜'D÷&∂WB¬≤fˆ«V÷S¢¬vñÁ&FS¢S“í¿¢6ˆ◊WFóFñˆÁ3¢FÙ∆ó7Bá7FG2Ê6ˆ◊¬≤fˆ«V÷S¢"¬vñÁ&FS¢S"“í¿¢6ˆ◊WFóFñˆÂ˜Öˆ÷&6ÜS¢FÙ∆ó7Bá7FG2Ê6ˆ◊÷&∂WB¬≤fˆ«V÷S¢b¬vñÁ&FS¢S“í¿¢“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞†¢ÚÚ7FG2GRv&FR÷f˜R'VFvWFó&Rî¶ÊvWBÇ"ˆF÷ñ‚ˆí÷'VFvWB◊7FG2"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7BwV&B“&WVó&RÇ"‚ˆïˆ'VFvWEˆwV&B"ì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬7FG3¢wV&BÊvWDFñ«ï7FG2ÜF"í“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞†¶ÊvWBÇ"ˆF÷ñ‚ˆwV&Fñ‚◊7FFR"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7Bg2“&WVó&RÇ&g2"ì∞¢∆WB7FFR“∑”∞¢G'í≤7FFR“•4Ù‚Á'6RÜg2Á&VDfñ∆U7ñÊ2Ç"˜6Ü&VBˆwV&FñÂ˜7FFRÊß6ˆ‚"¬'WFcÇ"íì≤“6F6ÇÜRí∑–¢∆WBÊˆ÷∆ñW2“µ”∞¢G'í≤Êˆ÷∆ñW2“•4Ù‚Á'6RÜg2Á&VDfñ∆U7ñÊ2Ç"˜6Ü&VBˆÊˆ÷∆ñW2Êß6ˆ‚"¬'WFcÇ"íì≤“6F6ÇÜRí∑–¢∆WBwV&FñÂ'VÊÊñÊr“f«6S∞¢G'í∞¢6ˆÁ7B∆ófR“g2Á&VDfñ∆U7ñÊ2Ç"˜6Ü&VBˆwV&FñÂ˜7FFRÊß6ˆ‚"¬'WFcÇ"ì∞¢6ˆÁ7B'6VB“•4Ù‚Á'6RÜ∆ófRì∞¢ñbá'6VBÁ7FGW2””“''VÊÊñÊr"«¬'6VBÁ7FGW2””“&ÜV«Fáí"íwV&FñÂ'VÊÊñÊr“G'VS∞¢“6F6ÇÜRí∑–¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¬wV&Fñ„¢∞¢7FófS¢wV&FñÂ'VÊÊñÊr¬7FFR¬Êˆ÷∆ñW3¢Êˆ÷∆ñW2Á6∆ñ6RÇ”í¿¢&V6VÁEˆÊˆ÷∆ñW3¢Êˆ÷∆ñW2Êfñ«FW"Ü”‚Á6WfW&óGí””“&W'&˜""«¬Á6WfW&óGí””“&7&óFñ6¬"íÁ6∆ñ6RÇ”Rê¢–¢“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞¢ÚÚ””””“VÊB”Ç””””–†¢ÚÚÑF˜V&∆ˆ‚FRˆF÷ñ‚ˆí÷'VFvWB◊7FG2&WFó&R∆RRÛÇÛ##b¢∆&˜WFRWFó@¢ÚÚFV6∆&VRFWWÇfˆó2¬vñFVÁFóVR¬∆6V6ˆÊFR‚vWFóB¶÷ó2GFVñÁFR(	@¢ÚÚWá&W726W'BF˜V¶˜W'2∆&V÷ñW&R6˜'&W7ˆÊFÊ6R‚FVfñÊóFñˆ‚6ˆÁ6W'fVP¢ÚÚ«W2ÜWB¬fV2∆÷V÷Rfó6ñ&ñ∆óFR˜W"ÜW&÷W2WB∆RF6Ü&ˆ&B‚ê†¢ÚÚ””””“”í‘”¢FFáV"7FFR””””–¶ÊvWBÇ"ˆF÷ñ‚ˆFFáV"◊7FFR"¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7Bg2“&WVó&RÇ&g2"ì∞¢∆WB7FFR“∑”∞¢G'í≤7FFR“•4Ù‚Á'6RÜg2Á&VDfñ∆U7ñÊ2Ç"˜6Ü&VBˆFFáV%˜7FFRÊß6ˆ‚"¬'WFcÇ"íì≤“6F6ÇÜRí∑–¢∆WBáV%'VÊÊñÊr“f«6S∞¢G'í∞¢6ˆÁ7B2“•4Ù‚Á'6RÜg2Á&VDfñ∆U7ñÊ2Ç"˜6Ü&VBˆFFáV%˜7FFRÊß6ˆ‚"¬'WFcÇ"íì∞¢áV%'VÊÊñÊr“á2Á7FGW2””“''VÊÊñÊr"«¬2Á7FGW2””“&ÜV«Fáí"ì∞¢“6F6ÇÜRí∑–¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢FFáV#¢∞¢7FófS¢áV%'VÊÊñÊr¿¢fñ∆˜fW%ˆ6˜VÁC¢7FFRÊfñ∆˜fW%ˆ6˜VÁB«¬¿¢7W'&VÁE˜6˜W&6S¢7FFRÁ6˜W&6R«¬'VÊ∂Ê˜v‚"¿¢ï˜7˜'G5ˆˆ≥¢7FFRÊï˜7˜'G5ˆˆ≤¿¢fˆ˜F&∆≈ˆˆ≥¢7FFRÊfˆ˜F&∆≈ˆˆ≤¿¢ï˜7˜'G5ˆ◊3¢7FFRÊï˜7˜'G5˜&W7ˆÁ6Uˆ◊2¿¢fˆ˜F&∆≈ˆ◊3¢7FFRÊfˆ˜F&∆≈˜&W7ˆÁ6Uˆ◊2¿¢∆7E˜7ñÊ3¢7FFRÊ∆7E˜7ñÊ2¿¢∆7EˆñÊ6ˆÁ6ó7FVÊ7ì¢7FFRÊ∆7EˆñÊ6ˆÁ6ó7FVÊ7í«¬ÁV∆¬¿¢&˜FÖˆF˜v„¢7FFRÊ&˜FÖˆF˜v‚«¬f«6R¿¢7FFS¢7FFP¢–¢“ì∞¢“6F6ÇÜRí≤&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢RÊ÷W76vR“ì≤–ß“ì∞¢ÚÚ””””“VÊB”í‘”””””–†¢ÚÚ)H)H6÷ˆ∂R◊FW7BVÊGˆñÁG2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¶6ˆÁ7Bïı5D%EıDî‘R“FFRÊÊ˜rÇì∞†¶ÊvWBÇ"ˆF÷ñ‚˜fW'6ñˆ‚"¬á&W¬&W2í”‚∞¢&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢fW'6ñˆ„¢&ˆ6W72ÊVÁb‰ïıdU%4îÙ‚«¬#„„"¿¢ÊˆFS¢&ˆ6W72ÁfW'6ñˆ‚¿¢WFñ÷S¢÷FÇÁ&˜VÊBÇÑFFRÊÊ˜rÇí“ïı5D%EıDî‘RíÚê¢“ì∞ß“ì∞†¶ÊvWBÇ"ˆF÷ñ‚˜&Vf∆ñváB"¬á&W¬&W2í”‚∞¢6ˆÁ7B6ÜV6∑2“∞¢FF&6S¢f«6R¿¢VÁc¢f«6P¢”∞¢G'í∞¢F"Á&W&RÇ%4TƒT5B"íÊvWBÇì∞¢6ÜV6∑2ÊFF&6R“G'VS∞¢“6F6ÇÖÚí∑–¢6ÜV6∑2ÊVÁb“á&ˆ6W72ÊVÁb‰ïÙdÙıD$ƒ≈Ù¥Uíbb&ˆ6W72ÊVÁbÂDTƒTu$’Ù$ıEıDÙ¥T‚ì∞¢6ˆÁ7Bˆ≤“6ÜV6∑2ÊFF&6Rbb6ÜV6∑2ÊVÁc∞¢&W2Á7FGW2Üˆ≤Ú#¢S2íÊß6ˆ‚á≤ˆ≤¬6ÜV6∑2“ì∞ß“ì∞†¶ÊvWBÇ"ˆF÷ñ‚ˆÜV'F&VB"¬á&W¬&W2í”‚∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬G3¢ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇí“ì∞ß“ì∞††¢ÚÚ““““6ÜF&˜B÷ó7G&¬“““““““““““““““““““““““““““““““““““““““““““““““““““““““–¶6ˆÁ7B‘ï5E$≈ÙïıU$¬“&áGG3¢ÚˆíÊ÷ó7G&¬Êí˜cˆ6ÜBˆ6ˆ◊∆WFñˆÁ2#∞¶6ˆÁ7B‘ï5E$≈Ù¥Uí“&ˆ6W72ÊVÁb‰‘ï5E$≈ÙïÙ¥Uí«¬"#∞¶6ˆÁ7B4%ı5ï2“%GRW2¬76ó7FÁB6∆ñVÁBFRF˜W4∆W4÷F6á2Ê6ˆ“‚&WˆÊG2V‚g&Ê6ó2‚6ˆÊÊó3¢&ˆÊÊV÷VÁG3¢R¬í„ìR&Ú¬í„ìRV∆óFR‚∆ófRî¢RîV‚Fó&V7B‚vñÁ&FS¢sÇR‚ñV÷VÁB7G&óR‚FV∆Vw&“F˜W4∆W4÷F6á5Ùg&VR‚6Ü◊ñˆÊÊG3¢√¬¬¬∆∆ñv¬6W&ñR¬$¬¬'&6ñ∆Vó&Ú¬&vVÁFñÊ‚6ˆó2ˆ∆íWB6ˆÊ6ó2‚#∞¶Á˜7BÇ"ˆ6ÜF&˜Bˆ6≤"¬Wá&W72Êß6ˆ‚á≤∆ñ÷óC¢#f∂""“í¬7ñÊ2á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B≤VW7Fñˆ‚¬V÷ñ¬¬6ˆFR¬6W76ñˆ‚““&WÊ&ˆGí«¬∑”∞¢ñbÇVW7Fñˆ‚í&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢f«6R¬W'&˜#¢%VW7Fñˆ‚fñFR"“ì∞†¢ÚÚ)H)H6˜'&V7Fñb6V7W&óFRRÛÇÛ##b)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚW6W%ˆ∂WíWFóB&ó2Fó&V7FV÷VÁBFÁ2∆R6˜'2FR∆&WVWFR¢V‚VÁf˜ñÁ@¢ÚÚ∂V÷ñ√¢'fñ7Fñ÷TÇÊ6ˆ“'“‚vñ◊˜'FRVí&V∆ó6óB¬vÜó7F˜&óVRFR6ÜBFR6P¢ÚÚ6ˆ◊FRÜ∆W2FW&ÊñW'2÷W76vW26ˆÁB&V6Ü&vW2FÁ2∆R6ˆÁFWáFRí‚ˆ‡¢ÚÚ‚v66WFRFˆÊ2¬vV÷ñ¬6ˆ÷÷R6∆RTR2vñ¬W7B&˜WfR"V‚6ˆFRf∆ñFR∞¢ÚÚ6ñÊˆ‚ˆ‚FW&ófRVÊR6∆R˜VR¬Êˆ‚FWfñÊ&∆R¬FR¬vñFVÁFñfñÁBFR6W76ñˆ‚‡¢6ˆÁ7BWFÜVB“V÷ñ¬bb6ˆFRbbfW&ñgî6ˆFRÜV÷ñ¬¬6ˆFRíÁf∆ñC∞¢6ˆÁ7BW6W$∂Wí“WFÜV@¢Ú7G&ñÊrÜV÷ñ¬íÁFÙ∆˜vW$66RÇê¢¢&ÊˆÂÚ"≤7'óFÚÊ7&VFTÜ6ÇÇ'6Ü#Sb"ê¢ÁWFFRÖ7G&ñÊrá6W76ñˆ‚«¬&WÊó«¬""í≤'F∆“÷6ÜB◊6«B"ê¢ÊFñvW7BÇ&ÜWÇ"íÁ6∆ñ6RÉ¬#Bì∞†¢ÚÚVW7Fñˆ‚&˜&ÊVR¢6Á2∆ñ÷óFR¬V‚6WV¬ı5B˜WfóB˜W76W"V‚&ˆ◊@¢ÚÚVÊ˜&÷RfW'2÷ó7G&¬Ü6˜WB&VV¬íWBvˆÊf∆W"∆F&∆R6ÜEˆ÷W76vW2‡¢6ˆÁ7B“7G&ñÊráVW7Fñˆ‚íÁ6∆ñ6RÉ¬ì∞†¢ÚÚÁFí◊7“¢6ÜVRV¬6˜WFRFR¬v&vVÁBÑ÷ó7G&¬í‚VW7FñˆÁ2 ¢ÚÚ÷ñÁWFW2WB"6∆R7Vffó6VÁB∆&vV÷VÁBV‚W6vRáV÷ñ‚Ê˜&÷¬‡¢ñbÇ&ƒ∆∆˜rÇ&6ÜEÚ"≤W6W$∂Wí¬¬¢cíí∞¢&WGW&‚&W2Á7FGW2ÉC#ííÊß6ˆ‚á≤ˆ≥¢G'VR¬Á7vW#¢%G&˜FRVW7FñˆÁ2BwV‚6˜W(	B,:ñW76ñRFÁ2VV«VW2÷ñÁWFW2‚"“ì∞¢–¢ÚÚG&:v&ñ∆óL:í≤∆fˆÊBFRL:óVÁ6Rˆ&∆ñvFˆó&W2˜W"F˜WBV¬îá,:Üv∆P¢ÚÚfñÊ∆RGR&ˆ◊B÷:ÁG&Rí‚ÁFí÷F˜V&∆ˆ‚Êˆ‚∆ñ6&∆R:VÊR6ˆÁfW'6Fñˆ‡¢ÚÚ∆ñ'&R¢6ÜVR&W\:ßFR6&˜&R6Ã:íáfˆó"∆∆˜t6ÜF&˜D6∆¬í‡¢6ˆÁ7Bˆ6ÜDvFR“Ê«ó6ó4VÊvñÊRÊ∆∆˜t6ÜF&˜D6∆¬ÜF"¬≤6W76ñˆ‰ñC¢W6W$∂Wí“ì∞¢ñbÇˆ6ÜDvFRÊ∆∆˜vVBí&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬Á7vW#¢$Ê˜G&R76ó7FÁBW7B÷ˆ÷VÁFÊV÷VÁBñÊFó7ˆÊñ&∆R‚"“ì∞¢6ˆÁ7BÜó7B“F"Á&W&RÇ%4TƒT5B&ˆ∆R¬6ˆÁFVÁBe$Ù“6ÜEˆ÷W76vW2tÑU$RW6W%ˆ∂Wí“Úı$DU"%íñBDU42ƒî‘ïB"íÊ∆¬áW6W$∂WííÁ&WfW'6RÇì∞¢Üó7BÁW6Çá≤&ˆ∆S¢'W6W""¬6ˆÁFVÁC¢“ì∞¢G'í≤F"Á&W&RÇ$îÂ4U%BîÂDÚ6ÜEˆ÷W76vW2áW6W%ˆ∂Wí«&ˆ∆R∆6ˆÁFVÁB∆7&VFVEˆBíd≈TU2ÉÚ√Ú√Ú∆FFWFñ÷RÇvÊ˜rríí"íÁ'V‚áW6W$∂Wí¬'W6W""¬ì≤“6F6ÇÜRó∑–¢∆WB&W7¬FF¬Á7vW#∞¢G'í∞¢&W7“vóBfWF6ÇÑ‘ï5E$≈ÙïıU$¬¬≤÷WFÜˆC¢%ı5B"¬ÜVFW'3¢≤$6ˆÁFVÁB’GóR#¢&∆ñ6Fñˆ‚ˆß6ˆ‚"¬$WFÜ˜&ó¶Fñˆ‚#¢$&V&W""≤‘ï5E$≈Ù¥Uí“¬&ˆGì¢•4Ù‚Á7G&ñÊvñgíá≤÷ˆFV√¢&÷ó7G&¬◊6÷∆¬÷∆FW7B"¬÷W76vW3¢∑≤&ˆ∆S¢'7ó7FV“"¬6ˆÁFVÁC¢4%ı5ï2“¬‚‚ÊÜó7E“¬÷Ö˜Fˆ∂VÁ3¢3¬FV◊W&GW&S¢„2“í“ì∞¢ñbÇ&W7Êˆ≤íFá&˜rÊWrW'&˜"Ç$ÖEE"≤&W7Á7FGW2ì∞¢FF“vóB&W7Êß6ˆ‚Çì∞¢Á7vW"“FFÚÊ6Üˆñ6W3ÚÂ≥”ÚÊ÷W76vSÚÊ6ˆÁFVÁB«¬$Ê˜G&R76ó7FÁBW7B÷ˆ÷VÁFÊV÷VÁBñÊFó7ˆÊñ&∆R‚#∞¢ˆ6ÜDvFRÁ&V6˜&BÜFFÚÁW6vSÚÁ&ˆ◊E˜Fˆ∂VÁ2¬FFÚÁW6vSÚÊ6ˆ◊∆WFñˆÂ˜Fˆ∂VÁ2¬&ˆ≤"ì∞¢“6F6ÇÜRí∞¢ÚÚVÁ&Vvó7G,:í‹:¶÷RV‚:ñ6ÜV2¢¬vV¬ÖEE˜FVÁFñV∆∆V÷VÁBL:ñ¨:WR∆ñWP¢ÚÚWBV‚6¸;∑B,:ñV¬R:ßG&RVÊv|:ífÁB¬vW'&WW"‡¢ˆ6ÜDvFRÁ&V6˜&BÉ¬¬&W'&˜""ì∞¢Fá&˜rS∞¢–¢G'í≤F"Á&W&RÇ$îÂ4U%BîÂDÚ6ÜEˆ÷W76vW2áW6W%ˆ∂Wí«&ˆ∆R∆6ˆÁFVÁB∆7&VFVEˆBíd≈TU2ÉÚ√Ú√Ú∆FFWFñ÷RÇvÊ˜rríí"íÁ'V‚áW6W$∂Wí¬&76ó7FÁB"¬Á7vW"ì≤“6F6ÇÜRó∑–¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬Á7vW"“ì∞¢“6F6ÇÜRí∞¢6ˆÁ6ˆ∆RÊW'&˜"Ç%¥4ÑD$ıE“"¬RÊ÷W76vRì∞¢&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬Á7vW#¢$Ê˜G&R76ó7FÁBW7B÷ˆ÷VÁFÊV÷VÁBñÊFó7ˆÊñ&∆R‚"“ì∞¢–ß“ì∞††¢Ú¢Dƒ“76ó7FÁB∆ˆ6¬f∆∆&6≥¢∂VW27W˜'BˆÊ∆ñÊRvÜV‚í'VFvWBˆwV&Bó26∆˜6VB‚¢¶Ê∆¬Ö≤"ˆíˆ6ÜB"¬"ˆ6ÜB"¬"ˆíˆ6ÜF&˜B"¬"ˆíˆ76ó7FÁB"¬"ˆí˜7W˜'B÷6ÜB"¬"ˆíˆ÷ó7G&¬÷6ÜB%“¬á&W¬&W2í”‚∞¢G'í∞¢6ˆÁ7B◊6r“7G&ñÊrÇá&WÊ&ˆGíbbá&WÊ&ˆGíÊ÷W76vR«¬&WÊ&ˆGíÁFWáB«¬&WÊ&ˆGíÁVW7Fñˆ‚íí«¬á&WÁVW'íbbá&WÁVW'íÊ÷W76vR«¬&WÁVW'íÁíí«¬""íÁG&ñ“Çì∞¢&WGW&‚&W2Êß6ˆ‚á∞¢ˆ≥¢G'VR¿¢÷ˆFS¢&∆ˆ6≈ˆf∆∆&6≤"¿¢&W«ì¢$¶R7Vó2V‚÷ˆFR7W˜'B&ñFRF˜W4∆W4÷F6á2‚∆R÷˜FWW"î6ˆ◊∆WBW7BFV◊˜&ó&V÷VÁB∆ñ÷óFR˜W"&˜FVvW"∆R'VFvWB‚˜W"VÊRVW7Fñˆ‚&ˆÊÊV÷VÁB¬6ˆFR¬66W2˜RFV∆Vw&“¬∆ó76RFˆ‚V÷ñ¬WB∆R7W˜'BFR&WˆÊG&‚VW7Fñˆ‚&V7VS¢"≤Ü◊6r«¬&÷W76vRfñFR"ê¢“ì∞¢“6F6ÇÜRí∞¢&WGW&‚&W2Êß6ˆ‚á≤ˆ≥¢G'VR¬÷ˆFS¢&∆ˆ6≈ˆf∆∆&6≤"¬&W«ì¢%7W˜'BF˜W4∆W4÷F6á2Fó7ˆÊñ&∆R‚&VW76ñRFÁ2V‚ñÁ7FÁB‚"“ì∞¢–ß“ì∞†¶Ê∆ó7FV‚Öı%B¬Çí”‚∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜF˜W4∆W4÷F6á2í'VÊÊñÊrˆ‚¢Gµı%G÷ì∞¢fW&ñgïFV∆Vw&‘6ÜÊÊV«2Çì∞¢fW&ñgî'&WfÙ6ˆÊfñwW&Fñˆ‚ÇíÊ6F6ÇÇÜRí”‚6ˆÁ6ˆ∆RÊW'&˜"Ç%∂'&WfÚ÷6ÜV6µ“"¬RÊ÷W76vRíì∞†¢ÚÚ)H)H6<:á2ˆffW'BRFW7FWW"ÑV∆óFR¬3Ê«ó6W2ˆ¶˜W"í)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢ÚÚFFRBvWáó&Fñˆ‚dïÑR¢∆fW'6ñˆ‚,:ñ<:ñFVÁFR6∆7V∆óB&V¶˜W&BváVí≤c¶˜W'2 ¢ÚÚ:6ÜVRL:ñ÷'&vR¬FˆÊ2¬|:ñ6å:ñÊ6R:óFóB&W˜W7<:ñR:6ÜVRL:ó∆ˆñV÷VÁBW@¢ÚÚ¬v6<:á2ÊR6RFW&÷ñÊóB¶÷ó2‚÷ˆFñfñ&∆RfñÊVÁb6Á2F˜V6ÜW"R6ˆFR‡¢6ˆÁ7BDU5DU%ÙT‘î¬“&ˆ6W72ÊVÁbÂDU5DU%Ùu$ÂEÙT‘î¬«¬&∆÷G&ñ6S#$v÷ñ¬Ê6ˆ“#∞¢6ˆÁ7BDU5DU%ÙUÖï$U2“&ˆ6W72ÊVÁbÂDU5DU%Ùu$ÂEÙUÖï$U2«¬###b”í”#"#≤ÚÚ"÷ˆó2:'Fó"GR#BÛrÛ##`¢ñbÖDU5DU%ÙT‘î¬íG'í∞¢6ˆÁ7BˆvF"“ÊWrFF&6RÑ4ÙDU5ÙD%ıDÇì∞¢6ˆÁ7BˆWÜó7FñÊr“ˆvF"Á&W&RÇ%4TƒT5B6ˆFR¬∆‚e$Ù“6ˆFW2tÑU$RV÷ñ¬“Ú‰B7FófR“"íÊvWBÖDU5DU%ÙT‘î¬ì∞¢ÚÚ∆R6ˆFRBv6<:á2‚vW7B¶÷ó2:ñ7&óBV‚6∆ó"FÁ2∆W2∆ˆw2Üñ«26ˆÁB'F|:ó0¢ÚÚ˜W"GR7W˜'Bí(	B6WV«2∆W2"&V÷ñW'26&7L:á&W26W'fVÁBFR&W:á&R‡¢6ˆÁ7Bˆ÷6≤“Ü2í”‚7G&ñÊrÜ2«¬""íÁ6∆ñ6RÉ¬"í≤.(
.(
.(
.(
.(
.(
"#∞¢ñbÖˆWÜó7FñÊrbbˆWÜó7FñÊrÁ∆‚””“&V∆óFR"í∞¢ˆvF"Á&W&RÇ%UDDR6ˆFW24UB7&VFóG5ˆ÷Ç“3¬Wáó&W5ˆB“ÚtÑU$RV÷ñ¬“Ú‰B7FófR“"íÁ'V‚ÖDU5DU%ÙUÖï$U2¬DU5DU%ÙT‘î¬ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂F÷ñ‚÷w&ÁE“FW7FWW"V∆óFR6ˆÊfó&‹:íÉ3ˆ¢¬Gµˆ÷6≤ÖˆWÜó7FñÊrÊ6ˆFRó“í(	BWáó&R∆RGµDU5DU%ÙUÖï$U7÷ì∞¢“V«6RñbÖˆWÜó7FñÊrí∞¢ˆvF"Á&W&RÇ%UDDR6ˆFW24UB∆‚“vV∆óFRr¬7&VFóG5ˆ÷Ç“3¬Wáó&W5ˆB“ÚtÑU$RV÷ñ¬“Ú‰B7FófR“"íÁ'V‚ÖDU5DU%ÙUÖï$U2¬DU5DU%ÙT‘î¬ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂F÷ñ‚÷w&ÁE“FW7FWW"Ww&L:íV‚V∆óFRÇGµˆ÷6≤ÖˆWÜó7FñÊrÊ6ˆFRó“í(	BWáó&R∆RGµDU5DU%ÙUÖï$U7÷ì∞¢“V«6R∞¢6ˆÁ7Bˆ6Ü'2“$$4DTdtÑ§¥ƒ‘Â%5EUeuÖï£#3CScsÉí#∞¢6ˆÁ7Bˆ6ˆFR“'&íÊg&ˆ“á≤∆VÊwFÉ¢Ç“¬Çí”‚ˆ6Ü'5¥÷FÇÊf∆ˆ˜"Ñ÷FÇÁ&ÊFˆ“Çí¢ˆ6Ü'2Ê∆VÊwFÇï“íÊ¶ˆñ‚Ç""ì∞¢6ˆÁ7B˜FˆFí“ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíÁ6∆ñ6RÉ¬ì∞¢ˆvF"Á&W&RÇ$îÂ4U%BîÂDÚ6ˆFW2Ü6ˆFR¬V÷ñ¬¬∆‚¬7FófR¬Wáó&W5ˆB¬7&VFóG5ˆ÷Ç¬7&VFóG5˜W6VB¬7&VFóG5ˆFFR¬7&VFVEˆBíd≈TU2ÉÚ√Ú√Ú√√Ú√Ú√√Ú√Úí"íÁ'V‚Öˆ6ˆFR¬DU5DU%ÙT‘î¬¬&V∆óFR"¬DU5DU%ÙUÖï$U2¬3¬˜FˆFí¬ÊWrFFRÇíÁFÙï4ı7G&ñÊrÇíì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂F÷ñ‚÷w&ÁE“FW7FWW"V∆óFR7,:ú:íÇGµˆ÷6≤Öˆ6ˆFRó“í(	BWáó&R∆RGµDU5DU%ÙUÖï$U7“(	B6ˆFR6ˆ◊∆WBfó6ñ&∆RFÁ2∆&6Vì∞¢–¢ˆvF"Ê6∆˜6RÇì∞¢“6F6ÇÜRí≤6ˆÁ6ˆ∆RÊW'&˜"Ç%∂F÷ñ‚÷w&ÁE“W'&WW#¢"¬RÊ÷W76vRì≤–†¢ñbÑUDıÙ4Ù‰4îƒUÙÙ%4U%dU"í∞¢6ˆÁ6ˆ∆RÊ∆ˆrÜ∂WFÚ÷6ˆÊ6ñ∆U“VÊ&∆VC¢WfW'íG¥÷FÇÁ&˜VÊBÑUDıÙ4Ù‰4îƒUÙîÂDU%d≈Ù’2Úcó“÷ñ‚¬÷ÇG¥UDıÙ4Ù‰4îƒUÙ‘ÖÙ‘D4ÑU7“÷F6ÇÜW2ñì∞¢6WEFñ÷V˜WBá'V‰WFÙ6ˆÊ6ñ∆Tˆ'6W'fW"¬3ì∞¢6WDñÁFW'f¬á'V‰WFÙ6ˆÊ6ñ∆Tˆ'6W'fW"¬UDıÙ4Ù‰4îƒUÙîÂDU%d≈Ù’2ì∞¢–¢6ˆÁ7Bvˆ√UW6ÑñÁFW'fƒ◊2“÷FÇÊ÷ÇÄ¢"¿¢ÁV÷&W"á&ˆ6W72ÊVÁb‰tÙ√UıU4ÖÙîÂDU%d≈Ù‘î‚«¬Rê¢í¢c¢∞¢6WEFñ÷V˜WBá'V‰vˆ√UW6Ñˆ'6W'fW"¬cì∞¢6WDñÁFW'f¬á'V‰vˆ√UW6Ñˆ'6W'fW"¬vˆ√UW6ÑñÁFW'fƒ◊2ì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÄ¢%∂f6’“ˆ'6W'fFWW"WFˆÊˆ÷R7Fñc¢"∞¢÷FÇÁ&˜VÊBÜvˆ√UW6ÑñÁFW'fƒ◊2Úcí∞¢"÷ñ‚ ¢ì∞†¢6WDñÁFW'f¬Ü6ÜV6¥Ê«óFñ7566ÜVGV∆R¬cì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂Ê«óFñ75“66ÜVGV∆W"7Fñc¢&˜'BV˜FñFñV‚#6Ç≤ÜV&FÚ«VÊFíÜÇ"ì∞†¢ÚÚñ6≤GR¶˜W"WFÚ¢,:ñ|:ñÏ:á&RRL:ñ÷'&vRVó2l:ó&ñfñR6ÜVRÜWW&R‡¢ÚÚ∆R6ÜV6≤Ü˜&ó&RW7Bî‰4Ù‰DïDîÙ‰‰T¬á2FRv&FR7F˜&VEñ6¥ó4g&W6Çí†¢ÚÚV‚ñ6≤&g&ó2"áF˜V¶˜W'2V¶˜W&BváVííWWBfˆó"6ˆ‚÷F6Ç6RFW&÷ñÊW ¢ÚÚV‚6˜W'2FR¶˜W&Ï:ñR¬WB2vW7BßW7FV÷VÁB6RRvˆ‚fWWBL:óFV7FW"˜W ¢ÚÚffñ6ÜW"∆R66˜&RfñÊ¬≤vvÏ:í˜W&GR6Á2GFVÊG&R∆R∆VÊFV÷ñ‚‡¢ÚÚFV÷ÊFRFRw&Vr∆R3ÛrÛ##b‡¢6WEFñ÷V˜WBÇÇí”‚≤ñbÇ7F˜&VEñ6¥ó4g&W6ÇÇíí&Vg&W6ÑFñ«ïñ6¥g&ˆ‘D"Çì≤“¬Sì∞¢6WDñÁFW'f¬á&Vg&W6ÑFñ«ïñ6¥g&ˆ‘D"¬3cì∞¢6ˆÁ6ˆ∆RÊ∆ˆrÇ%∂Fñ«í◊ñ6µ“WFÚ◊&Vg&W6Ç7FñbÜL:ñ÷'&vR≤Ü˜&ó&RñÊ6ˆÊFóFñˆÊÊV¬¬Ü˜'2∆ñwVW2WÜ6«VW2í"ì∞¢“ì∞ß–†¶÷ˆGV∆RÊWá˜'G2Âıˆ∆ófT6ˆÁG&7EFW7B“∞¢Ê˜&÷∆ó¶Tfˆ˜F&∆ƒFF÷F6Ç¿¢Ê˜&÷∆ó¶Tï7˜'G4fˆ˜F&∆ƒfóáGW&R¿¢ó4∆˜uG'W7D6ˆ◊WFóFñˆ‚¿¢vWEfW&ñfñVDfóáGW&TñB¿¢'Vñ∆E7FG57FGW2¿¢Ê˜&÷∆ó¶T7W'&VÁEñ6≤¿¢&VD∂Ê˜vÂ66˜&R¿¢6ˆ◊WFTfñ∆&∆T&WG2¿¢6ˆ◊WFT∆ófT6ˆÁ7G&ñÁG2¿¢÷W&vT∆ófT÷F6Ö6˜W&6W2¿¢DÙ¥TÂÙƒî‘ïE2¿¢&W6ˆ«fUfW&ñfñVD∆ófT÷F6Ç¿¢&W6ˆ«fT∆ófT÷F6ÜW4gFW$fWF6Ñfñ«W&R¿ß”∞