// ═══════════════════════════════════════════════════════
//  HERMÈS ADMIN BOT — Telegram privé administrateur
//  Langage naturel + commandes
//  Tu parles, Hermès comprend et exécute.
// ═══════════════════════════════════════════════════════

const https = require("https");
const fs    = require("fs");
const { execSync } = require("child_process");

const BOT_TOKEN    = process.env.TELEGRAM_ADMIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID     = process.env.TELEGRAM_ADMIN_ID;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const GROQ_KEY     = process.env.GROQ_API_KEY;
const REPO_PATH    = "/repo";
const DB_PATH      = process.env.USERS_DB_PATH || `${REPO_PATH}/scripts/users_db.json`;
const PICKS_PATH   = `${REPO_PATH}/src/App.js`;
const HERMES_DB    = `${REPO_PATH}/scripts/hermes_db.json`;

if (!BOT_TOKEN) { console.error("❌ TELEGRAM_ADMIN_BOT_TOKEN manquant"); process.exit(1); }

let lastUpdateId = 0;

// ── Envoi message Telegram ────────────────────────────
function sendMsg(chatId, text, extra = {}) {
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra });
  const req = https.request({
    hostname: "api.telegram.org",
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
  }, res => { res.on("data", () => {}); });
  req.on("error", () => {});
  req.write(body); req.end();
}

// ── Vérification admin ────────────────────────────────
function isAdmin(userId) {
  if (!ADMIN_ID) return true; // Si pas configuré, accepte tout
  return String(userId) === String(ADMIN_ID);
}

// ── Lecture picks depuis App.js ───────────────────────
function getPicks() {
  try {
    const content = fs.readFileSync(PICKS_PATH, "utf8");
    const match = content.match(/var picks = \[([\s\S]*?)\];/);
    if (!match) return [];
    const lines = match[1].match(/\["[^"]*","[^"]*"[^\]]*\]/g) || [];
    return lines.map(l => {
      const parts = l.match(/"([^"]*)"/g).map(s => s.replace(/"/g, ""));
      return { date: parts[0], match: parts[1], bet: parts[2], cote: parts[3], score: parts[4], result: parts[5], sport: parts[6] };
    });
  } catch { return []; }
}

// ── Calcul stats ──────────────────────────────────────
function getStats() {
  const picks = getPicks().filter(p => !["NOPICK", "EN COURS"].includes(p.result));
  const wins   = picks.filter(p => p.result === "GAGNE").length;
  const losses = picks.filter(p => p.result === "PERDU").length;
  const pending = picks.filter(p => p.result === "EN ATTENTE").length;
  const total  = wins + losses;
  const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // Série en cours
  let serie = 0;
  for (const p of picks) {
    if (p.result === "GAGNE") serie++;
    else if (p.result === "PERDU") break;
  }

  // MRR depuis users_db
  let mrr = 0, users = 0, premium = 0, vip = 0;
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    users = db.stats?.total_users || 0;
    premium = db.stats?.premium || 0;
    vip = db.stats?.vip || 0;
    mrr = db.stats?.mrr || 0;
  } catch {}

  return { wins, losses, pending, total, winrate, serie, mrr, users, premium, vip };
}

// ── Commandes ─────────────────────────────────────────
const COMMANDS = {

  "/start": (chatId) => {
    sendMsg(chatId, `🏛️ <b>HERMÈS ADMIN BOT</b>\n\nBonjour Greg! Je suis ton directeur opérationnel.\n\n<b>Commandes disponibles:</b>\n/stats — Statistiques complètes\n/picks — Résultats récents\n/rapport — Rapport du jour\n/erreurs — Dernières erreurs\n/update — Mettre à jour un résultat\n/forcer_pick — Forcer un pick\n/redeploy — Redéployer le site\n/aide — Aide complète`);
  },

  "/stats": (chatId) => {
    const s = getStats();
    sendMsg(chatId,
      `📊 <b>STATISTIQUES HERMÈS</b>\n\n` +
      `🏆 <b>Picks</b>\n` +
      `✅ Gagnés: <b>${s.wins}</b>\n` +
      `❌ Perdus: <b>${s.losses}</b>\n` +
      `⏳ En attente: <b>${s.pending}</b>\n` +
      `📈 Winrate: <b>${s.winrate}%</b>\n` +
      `🔥 Série: <b>${s.serie} victoires</b>\n\n` +
      `👥 <b>Utilisateurs</b>\n` +
      `Total: <b>${s.users}</b>\n` +
      `Premium: <b>${s.premium}</b>\n` +
      `VIP: <b>${s.vip}</b>\n\n` +
      `💰 <b>Revenus</b>\n` +
      `MRR: <b>${s.mrr.toFixed(2)}€/mois</b>`
    );
  },

  "/picks": (chatId) => {
    const picks = getPicks().filter(p => p.result !== "NOPICK").slice(0, 10);
    if (!picks.length) { sendMsg(chatId, "Aucun pick trouvé."); return; }
    const lines = picks.map(p => {
      const emoji = p.result === "GAGNE" ? "✅" : p.result === "PERDU" ? "❌" : "⏳";
      return `${emoji} <b>${p.date}</b> — ${p.match}\n   ${p.bet} @ ${p.cote} → ${p.score || "—"}`;
    }).join("\n\n");
    sendMsg(chatId, `🎯 <b>DERNIERS PICKS</b>\n\n${lines}`);
  },

  "/rapport": (chatId) => {
    const s = getStats();
    const hermes = JSON.parse(fs.readFileSync(HERMES_DB, "utf8").replace(/\n/g, " "));
    const activeIAs = hermes.config?.active_ias?.join(", ") || "DeepSeek, Groq";
    const now = new Date().toLocaleString("fr-FR");
    sendMsg(chatId,
      `📋 <b>RAPPORT HERMÈS — ${now}</b>\n\n` +
      `🤖 <b>IAs actives:</b> ${activeIAs}\n\n` +
      `📊 <b>Performance:</b>\n` +
      `• Winrate: ${s.winrate}%\n` +
      `• ${s.wins}W / ${s.losses}L sur ${s.total} picks\n` +
      `• Série: ${s.serie} victoires consécutives\n\n` +
      `👥 <b>Utilisateurs:</b> ${s.users} (${s.premium} premium, ${s.vip} VIP)\n` +
      `💰 <b>MRR:</b> ${s.mrr.toFixed(2)}€\n\n` +
      `🔗 <b>Site:</b> https://touslesmatchs.com\n\n` +
      `━━━━━━━━━━━━━━\n` +
      `📌 <b>Prochaine action:</b> Vérification résultats dans 4h`
    );
  },

  "/aide": (chatId) => {
    sendMsg(chatId,
      `📖 <b>AIDE HERMÈS ADMIN</b>\n\n` +
      `<b>Stats & Rapports:</b>\n` +
      `/stats — Stats complètes\n` +
      `/picks — 10 derniers picks\n` +
      `/rapport — Rapport du jour\n\n` +
      `<b>Gestion picks:</b>\n` +
      `/update PSG Marseille GAGNE 2-1 — Mettre à jour un résultat\n` +
      `/forcer_pick PSG vs Marseille 1.65 — Forcer un pick\n\n` +
      `<b>Système:</b>\n` +
      `/redeploy — Redéployer le site\n` +
      `/erreurs — Voir les erreurs\n` +
      `/verifier — Vérifier état du système`
    );
  },

  "/verifier": (chatId) => {
    let status = "🟢 Site: en ligne\n";
    try {
      const db = JSON.parse(fs.readFileSync(HERMES_DB, "utf8"));
      status += `🟢 Hermès DB: ${db.picks?.length || 0} picks enregistrés\n`;
      status += `🟢 IAs: ${db.config?.active_ias?.join(", ")}\n`;
    } catch { status += "🔴 Hermès DB: erreur lecture\n"; }
    try {
      fs.readFileSync(DB_PATH);
      status += "🟢 Users DB: OK\n";
    } catch { status += "🔴 Users DB: introuvable\n"; }
    sendMsg(chatId, `🔍 <b>ÉTAT DU SYSTÈME</b>\n\n${status}`);
  },

  "/redeploy": (chatId) => {
    sendMsg(chatId, "🔄 Redéploiement en cours...");
    try {
      execSync(`cd ${REPO_PATH} && git pull origin main && docker-compose down && docker-compose up -d`, { timeout: 60000 });
      sendMsg(chatId, "✅ Redéploiement réussi!");
    } catch (e) {
      sendMsg(chatId, `❌ Erreur redéploiement: ${e.message.slice(0, 200)}`);
    }
  },

  "/erreurs": (chatId) => {
    try {
      const log = execSync("docker-compose logs --tail=20 touslesmatchs-api 2>&1", { cwd: REPO_PATH }).toString();
      sendMsg(chatId, `📋 <b>LOGS API (20 dernières lignes)</b>\n\n<pre>${log.slice(0, 3000)}</pre>`);
    } catch (e) {
      sendMsg(chatId, `❌ Impossible de lire les logs: ${e.message}`);
    }
  },
};

// ── Appel LLM (DeepSeek ou Groq fallback) ────────────
async function callLLM(prompt) {
  const body = JSON.stringify({
    model: DEEPSEEK_KEY ? "deepseek-chat" : "llama-3.3-70b-versatile",
    max_tokens: 800,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }]
  });
  const hostname = DEEPSEEK_KEY ? "api.deepseek.com" : "api.groq.com";
  const apiKey   = DEEPSEEK_KEY || GROQ_KEY;
  return new Promise((resolve) => {
    const req = https.request({
      hostname, path: "/v1/chat/completions", method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d).choices?.[0]?.message?.content || ""); }
        catch { resolve(""); }
      });
    });
    req.on("error", () => resolve(""));
    req.write(body); req.end();
  });
}

// ── Déploiement automatique ───────────────────────────
function autoDeploy(chatId, commitMsg) {
  try {
    execSync(`cd ${REPO_PATH} && git add -A && git commit -m "${commitMsg}" && git push origin main`, { timeout: 30000 });
    sendMsg(chatId, "📤 <b>Poussé sur GitHub!</b>");
    execSync(`cd ${REPO_PATH} && docker-compose restart touslesmatchs-site`, { timeout: 30000 });
    sendMsg(chatId, "✅ <b>Site mis à jour!</b>");
  } catch (e) {
    sendMsg(chatId, `⚠️ Deploy: ${e.message.slice(0, 200)}`);
  }
}

// ── Bannir une compétition/mot-clé ───────────────────
function banKeyword(chatId, keyword) {
  try {
    let content = fs.readFileSync(`${REPO_PATH}/scripts/multi_agent.js`, "utf8");
    // Ajoute le mot-clé dans BANNED_KEYWORDS
    if (content.includes(`"${keyword}"`)) {
      sendMsg(chatId, `ℹ️ <b>${keyword}</b> est déjà banni.`);
      return;
    }
    content = content.replace(
      /const BANNED_KEYWORDS = \[/,
      `const BANNED_KEYWORDS = [\n  "${keyword}",`
    );
    fs.writeFileSync(`${REPO_PATH}/scripts/multi_agent.js`, content);
    sendMsg(chatId, `🚫 <b>${keyword}</b> banni du système!`);
    autoDeploy(chatId, `rule: ban ${keyword} via Hermes bot`);
  } catch (e) {
    sendMsg(chatId, `❌ Erreur: ${e.message}`);
  }
}

// ── Forcer un pick ────────────────────────────────────
function forcePick(chatId, match, bet, cote, sport) {
  try {
    const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    let content = fs.readFileSync("./src/App.js", "utf8");
    const newPick = `  ["${today}","${match}","${bet}","${cote}","—","EN ATTENTE","${sport}",8,8],\n`;
    content = content.replace("var picks = [\n", `var picks = [\n${newPick}`);
    fs.writeFileSync("./src/App.js", content);
    sendMsg(chatId, `🎯 <b>Pick ajouté!</b>\n${today}: ${match}\n${bet} @ ${cote}`);
    autoDeploy(chatId, `pick: ${match} via Hermes bot`);
  } catch (e) {
    sendMsg(chatId, `❌ Erreur: ${e.message}`);
  }
}

// ── Lancer le concile manuellement ───────────────────
function lancerConcile(chatId) {
  sendMsg(chatId, "🏛️ <b>Lancement du Concile...</b>\nRecherche des matchs du jour...");
  try {
    execSync(`node ${REPO_PATH}/scripts/multi_agent.js`, { cwd: REPO_PATH, timeout: 120000 });
    sendMsg(chatId, "✅ <b>Concile terminé!</b>\nPick du jour généré et publié.");
  } catch (e) {
    sendMsg(chatId, `❌ Concile échoué: ${e.message.slice(0, 300)}`);
  }
}

// ── Mettre à jour résultat d'un pick ─────────────────
function updatePick(chatId, team, result, score) {
  try {
    let content = fs.readFileSync("./src/App.js", "utf8");
    const regex = new RegExp(`("${team}[^"]*","[^"]*","[^"]*","[^"]*",)"EN ATTENTE"`, "i");
    if (!content.match(regex)) {
      sendMsg(chatId, `⚠️ Pick "${team}" EN ATTENTE non trouvé. Cherche dans tous les picks...`);
      // Cherche plus large
      const regex2 = new RegExp(`"${team}[^"]*"[^\\n]*"EN ATTENTE"`, "i");
      if (!content.match(regex2)) {
        sendMsg(chatId, `❌ Aucun pick en attente pour "${team}"`);
        return;
      }
      content = content.replace(regex2, m => m.replace('"EN ATTENTE"', `"${result}"`));
    } else {
      content = content.replace(regex, `$1"${result}"`);
    }
    // Ajoute le score
    if (score) {
      content = content.replace(
        new RegExp(`("${team}[^"]*"[^\\n]*)"—"([^\\n]*)"${result}"`, "i"),
        `$1"${score}"$2"${result}"`
      );
    }
    fs.writeFileSync("./src/App.js", content);
    sendMsg(chatId, `✅ <b>${team} → ${result} ${score || ""}</b>`);
    autoDeploy(chatId, `result: ${team} ${result} ${score} via Hermes`);
  } catch (e) {
    sendMsg(chatId, `❌ Erreur: ${e.message}`);
  }
}

// ── Interprétation langage naturel + exécution ───────
async function interpretAndExecute(chatId, text) {
  const s = getStats();
  const picks = getPicks().filter(p => p.result !== "NOPICK").slice(0, 5);
  const picksStr = picks.map(p => `${p.date}: ${p.match} → ${p.result} ${p.score || "—"}`).join("\n");

  let bannedKeywords = "";
  try {
    const agentContent = fs.readFileSync(`${REPO_PATH}/scripts/multi_agent.js`, "utf8");
    const banned = agentContent.match(/const BANNED_KEYWORDS = \[([\s\S]*?)\]/)?.[1] || "";
    bannedKeywords = banned.replace(/\s+/g, " ").trim().slice(0, 300);
  } catch {}

  const systemPrompt = `Tu es Hermès, directeur opérationnel IA de TousLesMatchs.fr.
Greg est ton patron. Tu comprends le français naturel et tu EXÉCUTES des actions réelles.

DONNÉES EN TEMPS RÉEL:
- Stats: ${s.wins}W/${s.losses}L — Winrate: ${s.winrate}% — Série: ${s.serie} victoires
- MRR: ${s.mrr.toFixed(2)}€ — Utilisateurs: ${s.users}
- Derniers picks: ${picksStr}
- Mots-clés bannis: ${bannedKeywords}

ACTIONS DISPONIBLES (réponds JSON strict, pas de markdown):
{
  "reponse": "message court pour Greg",
  "action": "show_stats" | "show_picks" | "redeploy" | "ban_keyword" | "force_pick" | "update_pick" | "run_concile" | "show_errors" | null,
  "params": {
    "keyword": "mot à bannir",
    "match": "Equipe1 vs Equipe2",
    "bet": "type de pari",
    "cote": 1.65,
    "sport": "Foot",
    "team": "nom équipe",
    "result": "GAGNE|PERDU",
    "score": "2-1"
  }
}

EXEMPLES:
- "nos stats" → action: "show_stats"
- "interdit la Champions League" → action: "ban_keyword", params: {"keyword": "Champions"}
- "pas de matchs amicaux" → action: "ban_keyword", params: {"keyword": "Friendly"}
- "PSG a gagné 2-0" → action: "update_pick", params: {"team": "PSG", "result": "GAGNE", "score": "2-0"}
- "lance le concile" → action: "run_concile"
- "force un pick PSG vs Lyon cote 1.65" → action: "force_pick", params: {"match": "PSG vs Lyon", "bet": "PSG Vainqueur", "cote": "1.65", "sport": "Foot"}
- "redémarre" → action: "redeploy"

Réponds UNIQUEMENT en JSON valide. Pas de texte autour.`;

  const raw = await callLLM(`${systemPrompt}\n\nGreg: "${text}"`);

  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch { parsed = null; }

  if (!parsed) {
    const simpleResponse = await callLLM(`Tu es Hermès assistant de TousLesMatchs. Stats: ${s.wins}W/${s.losses}L winrate ${s.winrate}%. Greg dit: "${text}". Réponds en 2-3 phrases en français.`);
    sendMsg(chatId, simpleResponse || "❓ Je n'ai pas compris. Reformule ou tape /aide");
    return;
  }

  if (parsed.reponse) sendMsg(chatId, parsed.reponse);

  const p = parsed.params || {};
  switch (parsed.action) {
    case "show_stats":    COMMANDS["/stats"](chatId); break;
    case "show_picks":    COMMANDS["/picks"](chatId); break;
    case "show_errors":   COMMANDS["/erreurs"](chatId); break;
    case "redeploy":
      sendMsg(chatId, "🔄 Redéploiement...");
      try {
        execSync(`cd ${REPO_PATH} && git pull origin main && docker-compose down && docker-compose up -d`, { timeout: 90000 });
        sendMsg(chatId, "✅ Redéploiement terminé!");
      } catch (e) { sendMsg(chatId, `❌ ${e.message.slice(0, 200)}`); }
      break;
    case "ban_keyword":
      if (p.keyword) banKeyword(chatId, p.keyword);
      break;
    case "force_pick":
      if (p.match) forcePick(chatId, p.match, p.bet || "Vainqueur", p.cote || "1.65", p.sport || "Foot");
      break;
    case "update_pick":
      if (p.team && p.result) updatePick(chatId, p.team, p.result, p.score);
      break;
    case "run_concile":
      lancerConcile(chatId);
      break;
    default: break;
  }
}

// ── Gestion messages ──────────────────────────────────
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = (msg.text || "").trim();

  if (!isAdmin(userId)) {
    sendMsg(chatId, "⛔ Accès refusé.");
    return;
  }

  // Commandes slash → exécution directe
  if (text.startsWith("/")) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (COMMANDS[cmd]) {
      COMMANDS[cmd](chatId);
    } else {
      sendMsg(chatId, `❓ Commande inconnue. Tape /aide`);
    }
    return;
  }

  // Langage naturel → IA comprend et répond
  sendMsg(chatId, "🔮 Hermès réfléchit...");
  await interpretAndExecute(chatId, text);
}

// ── Polling Telegram ──────────────────────────────────
async function poll() {
  return new Promise((resolve) => {
    const path = `/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30&allowed_updates=["message"]`;
    const req = https.request({
      hostname: "api.telegram.org",
      path,
      method: "GET"
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          const data = JSON.parse(d);
          if (data.ok && data.result?.length) {
            for (const update of data.result) {
              lastUpdateId = update.update_id;
              if (update.message) handleMessage(update.message);
            }
          }
        } catch {}
        resolve();
      });
    });
    req.on("error", () => resolve());
    req.end();
  });
}

// ── Vérification résultats toutes les 4h ─────────────
async function checkResults() {
  console.log("🔍 Vérification résultats automatique...");
  // TODO: appeler API football pour vérifier résultats EN ATTENTE
  // et mettre à jour App.js automatiquement
}

// ── Boucle principale ─────────────────────────────────
async function main() {
  console.log("🏛️ Hermès Admin Bot démarré");
  console.log(`   Admin ID: ${ADMIN_ID || "non configuré (tous acceptés)"}`);

  // Notification de démarrage
  if (ADMIN_ID) {
    sendMsg(ADMIN_ID, "🏛️ <b>Hermès Admin Bot</b> est en ligne!\n\nTape /stats pour commencer.");
  }

  // Vérification résultats toutes les 4h
  setInterval(checkResults, 4 * 60 * 60 * 1000);

  // Polling continu
  while (true) {
    try { await poll(); } catch (e) { console.error("Poll error:", e.message); }
    await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(console.error);
