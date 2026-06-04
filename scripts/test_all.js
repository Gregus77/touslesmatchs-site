// ============================================================
// TEST COMPLET — SITE + TELEGRAM + APIS
// ============================================================

const https = require("https");
const fs = require("fs");

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || "";

const results = { ok: [], ko: [], warn: [] };

function log(type, msg) {
  results[type].push(msg);
  const icon = type === "ok" ? "✅" : type === "ko" ? "❌" : "⚠️ ";
  console.log(`${icon} ${msg}`);
}

function fetchHTTPS(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    }).on("error", () => resolve({ status: 0, body: "" }));
  });
}

async function main() {
  console.log("\n🧪 TEST COMPLET — TousLesMatchs\n");

  // ── 1. SITE TOUSLESMATCHS.COM
  console.log("\n📱 [1/5] Site web (touslesmatchs.com)");
  const site = await fetchHTTPS("https://www.touslesmatchs.com");
  if (site.status === 200) {
    log("ok", `Site répond HTTP 200 (${site.body.length} octets)`);
    if (site.body.includes("viewport")) log("ok", "Meta viewport présent (responsive mobile)");
    // Trouver bundle JS et vérifier picks dedans
    const jsMatch = site.body.match(/main\.([a-f0-9]+)\.js/);
    if (jsMatch) {
      log("ok", `Bundle JS: main.${jsMatch[1]}.js`);
      const bundle = await fetchHTTPS(`https://www.touslesmatchs.com/static/js/${jsMatch[0]}`);
      if (bundle.status === 200) {
        log("ok", `Bundle chargé (${Math.round(bundle.body.length/1024)} Ko)`);
        if (bundle.body.includes("Angola")) log("ok", "Pick 06/06 (Angola) DANS le bundle ✓");
        else log("ko", "Pick 06/06 (Angola) MANQUANT — VPS pas redéployé");
        if (bundle.body.includes("Spain")) log("ok", "Pick 05/06 (Spain) DANS le bundle ✓");
        else log("ko", "Pick 05/06 (Spain) MANQUANT");
        if (bundle.body.includes("Cambodia")) log("ok", "Pick 04/06 (Cambodia) DANS le bundle ✓");
        else log("ko", "Pick 04/06 (Cambodia) MANQUANT");
      } else log("ko", `Bundle inaccessible (HTTP ${bundle.status})`);
    } else log("warn", "Pas de bundle JS détecté dans HTML");
  } else {
    log("ko", `Site DOWN (HTTP ${site.status})`);
  }

  // ── 2. RESPONSIVE MOBILE
  console.log("\n📱 [2/5] Design responsive");
  const css = fs.readFileSync("./src/App.css", "utf8");
  const mediaQueries = (css.match(/@media/g) || []).length;
  log(mediaQueries >= 2 ? "ok" : "warn", `${mediaQueries} media queries CSS`);
  if (css.includes("max-width:640px")) log("ok", "Breakpoint mobile (640px)");
  if (css.includes("max-width:900px")) log("ok", "Breakpoint tablet (900px)");

  // ── 3. BOT TELEGRAM
  console.log("\n📲 [3/5] Bot Telegram");
  if (TG_TOKEN) {
    const me = await fetchHTTPS(`https://api.telegram.org/bot${TG_TOKEN}/getMe`);
    try {
      const j = JSON.parse(me.body);
      if (j.ok) log("ok", `Bot actif: @${j.result.username}`);
      else log("ko", `Bot inactif: ${j.description}`);
    } catch { log("ko", "Réponse Telegram invalide"); }
  } else {
    log("warn", "TELEGRAM_BOT_TOKEN non défini (local) - testé en CI");
  }

  // ── 4. STATS PICKS
  console.log("\n📊 [4/5] Stats picks");
  const appJs = fs.readFileSync("./src/App.js", "utf8");
  const gagnes = (appJs.match(/"GAGNE"/g) || []).length;
  const perdus = (appJs.match(/"PERDU"/g) || []).length;
  const attente = (appJs.match(/"EN ATTENTE"/g) || []).length;
  log("ok", `${gagnes} gagnés / ${perdus} perdus / ${attente} en attente`);
  log("ok", `Taux: ${Math.round(gagnes/(gagnes+perdus)*100)}%`);

  // ── 5. BUILD
  console.log("\n📦 [5/5] Build");
  if (fs.existsSync("./build/index.html")) {
    const age = Math.round((Date.now() - fs.statSync("./build/index.html").mtimeMs)/60000);
    log("ok", `Build présent (${age} min)`);
  } else {
    log("warn", "Build absent");
  }

  // ── RAPPORT
  console.log("\n═══════════════ RAPPORT FINAL ═══════════════");
  console.log(`✅ Succès: ${results.ok.length}`);
  console.log(`⚠️  Warnings: ${results.warn.length}`);
  console.log(`❌ Erreurs: ${results.ko.length}\n`);
  if (results.ko.length) {
    console.log("🚨 PROBLÈMES À CORRIGER:");
    results.ko.forEach(e => console.log("  • " + e));
  } else {
    console.log("✨ TOUT FONCTIONNE\n");
  }
}

main();
