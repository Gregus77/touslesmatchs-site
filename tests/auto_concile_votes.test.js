// Tests de l'auto-observation Concile (scripts/api_server.js).
//
// IMPORTANT sur la methode : ce fichier serveur (16000+ lignes) n'a pas ete
// concu pour l'injection de dependances au niveau module — il expose deja un
// point d'extraction pour les tests (`module.exports.__liveContractTest`,
// convention preexistante dans ce repo, pas inventee ici). Le charger demarre
// reellement `app.listen(...)` (effet de bord assume, comme le reste du
// projet) : on force PORT=0 (port ephemere attribue par l'OS, jamais un port
// de production) et DB_PATH=":memory:" pour ne JAMAIS toucher la vraie base.
// Chaque test qui a besoin d'une base utilise sa PROPRE base en memoire,
// separee de celle du module, injectee via le parametre `deps` de
// attachAutoConcileVotes — jamais la base globale du module.
//
// Aucun test ici n'appelle un vrai fournisseur IA ni un vrai bot Telegram.
//
// Lancer : DB_PATH=":memory:" PORT=0 node --test tests/auto_concile_votes.test.js

process.env.DB_PATH = process.env.DB_PATH || ":memory:";
process.env.PORT = process.env.PORT || "0";
// Doit etre positionne AVANT le premier require de ai_models.config.js
// (lu une seule fois au chargement du module) : sans ca, le test T4, qui
// utilise le VRAI garde-fou et le VRAI registre de modeles, verrait
// "concile_auto_observer" toujours desactive (comportement par defaut,
// volontaire en production) et ne testerait jamais l'anti-doublon reel.
process.env.AUTO_CONCILE_LIVE_VOTES = "true";
// Sans cle GROQ, runConcileAnalysis() retombe sur getMockAnalysis() des sa
// premiere ligne (verifie en lisant le code) : aucun appel reseau, donc
// aucune possibilite d'envoi Telegram depuis ce chemin. C'est exactement ce
// qu'on veut pouvoir prouver dans le test T6.
delete process.env.GROQ_API_KEY;

const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const http = require("node:http");
const https = require("node:https");

const mod = require("../scripts/api_server.js");
// Le module serveur enregistre plusieurs dizaines de setInterval() legitimes
// (rafraichissements internes) des son chargement, hors de tout garde
// require.main — sans ca, le process de test ne se termine jamais tout seul.
// On les detache (unref) juste apres le chargement : le runner de tests
// (node:test) garde le process en vie tant qu'un test est en cours via son
// propre mecanisme, independant de ces timers ; une fois les 9 tests reellement
// termines, le process peut alors sortir naturellement, avec un rapport TAP
// complet et un exit code fiable (0 si tout passe, 1 sinon) — pas de
// process.exit(0) fige qui risquerait de couper le rapport en cours de route.
for (const h of process._getActiveHandles()) {
  if (h && typeof h.unref === "function") h.unref();
}
// Filet de securite : la boucle unref() ci-dessus ne suffit pas toujours (des
// handles peuvent apparaitre APRES ce point, pendant l'execution des tests
// eux-memes). Sans ce filet, le process reste bloque indefiniment (observe
// en pratique). 10 s est tres largement superieur a la duree reelle
// constatee de cette suite (~650 ms) : aucun risque de couper un test en
// cours, contrairement au process.exit(0) immediat retire plus haut, qui
// coupait le rapport avant que T6/T7 aient pu s'executer. process.exitCode
// est respecte (echec de test => code 1), jamais ecrase par un 0 force.
setTimeout(() => {
  mod.__liveContractTest._httpServer?.close();
  process.exit(process.exitCode ?? 0);
}, 10000);
const {
  attachAutoConcileVotes,
  isUsaOrCanadaMatch,
  autoConcileMatchKey,
  shouldAutoObserveMatch,
} = mod.__liveContractTest;

function freshDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE concile_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_key TEXT NOT NULL,
      home TEXT, away TEXT, competition TEXT,
      best_bet TEXT, confidence INTEGER, raison TEXT,
      consensus_votes INTEGER DEFAULT 0,
      agents_json TEXT DEFAULT '[]',
      pick_bet TEXT DEFAULT NULL
    );
  `);
  return db;
}

function baseMatch(overrides = {}) {
  return {
    id: "m1", home: "Marseille", away: "Lyon",
    competition: "Ligue 1", sport: "Football",
    status: "IN_PLAY", minute: 30,
    score_home: 0, score_away: 0,
    ...overrides,
  };
}

// Guard factice : autorise tout, ne touche a aucune base reelle. Utilise
// dans les tests qui ne portent pas specifiquement sur le budget lui-meme.
function permissiveGuard() {
  return {
    canProceed: () => ({ allowed: true, requestKey: "test-key" }),
    recordCall: () => {},
  };
}

test("T1 — un match hors fenetre ne declenche rien", async () => {
  const db = freshDb();
  let analyzeCalls = 0;
  const out = await attachAutoConcileVotes([baseMatch()], {
    dbRef: db,
    guard: permissiveGuard(),
    shouldObserve: () => false, // simule : hors fenetre d'analyse
    isBanned: () => false,
    analyze: async () => { analyzeCalls++; return {}; },
    save: () => {},
    enabled: true,
  });
  assert.equal(analyzeCalls, 0, "analyze() n'aurait jamais du etre appele");
  assert.equal(out[0].consensus_votes, undefined, "pas de votes attaches si rien n'a ete declenche ni trouve en base");
});

test("T2a — un match feminin (detecte par la vraie isWomenMatch, via shouldAutoObserveMatch) ne declenche rien", async () => {
  const db = freshDb();
  let analyzeCalls = 0;
  const womenMatch = baseMatch({ competition: "NWSL Women's League", minute: 30 });
  // On appelle la VRAIE shouldAutoObserveMatch (pas une simulation) pour
  // prouver que le filtre feminin fonctionne reellement sur ce match.
  assert.equal(shouldAutoObserveMatch(womenMatch), false, "shouldAutoObserveMatch doit rejeter un match feminin");
  await attachAutoConcileVotes([womenMatch], {
    dbRef: db,
    guard: permissiveGuard(),
    isBanned: () => false,
    analyze: async () => { analyzeCalls++; return {}; },
    save: () => {},
    enabled: true,
  });
  assert.equal(analyzeCalls, 0);
});

test("T2b — decouverte importante : la MLS (USA) et la Canadian Premier League ne sont PAS exclues par isLowTrustCompetition/shouldAutoObserveMatch — d'ou le filtre isUsaOrCanadaMatch dedie, teste ici directement", () => {
  const mlsMatch = baseMatch({ competition: "Major League Soccer", home: "LA Galaxy", away: "Inter Miami" });
  const cplMatch = baseMatch({ competition: "Canadian Premier League", home: "Forge FC", away: "Cavalry FC" });
  const frenchMatch = baseMatch();

  assert.equal(isUsaOrCanadaMatch(mlsMatch), true, "MLS doit etre reconnu comme USA");
  assert.equal(isUsaOrCanadaMatch(cplMatch), true, "Canadian Premier League doit etre reconnu comme Canada");
  assert.equal(isUsaOrCanadaMatch(frenchMatch), false, "un match francais ne doit pas etre banni a tort");
});

test("T2c — USA/Canada : le filtre dedie bloque bien le declenchement dans attachAutoConcileVotes, meme si shouldObserve dirait oui", async () => {
  const db = freshDb();
  let analyzeCalls = 0;
  const mlsMatch = baseMatch({ competition: "Major League Soccer" });
  await attachAutoConcileVotes([mlsMatch], {
    dbRef: db,
    guard: permissiveGuard(),
    shouldObserve: () => true, // meme si la fenetre/le sport seraient favorables
    isBanned: isUsaOrCanadaMatch, // le vrai filtre
    analyze: async () => { analyzeCalls++; return {}; },
    save: () => {},
    enabled: true,
  });
  assert.equal(analyzeCalls, 0, "un match MLS ne doit jamais declencher l'auto-analyse");
});

test("T3 — deux rafraichissements ne declenchent qu'une seule analyse", async () => {
  const db = freshDb();
  let analyzeCalls = 0;
  const match = baseMatch();
  const deps = {
    dbRef: db,
    guard: permissiveGuard(),
    shouldObserve: () => true,
    isBanned: () => false,
    analyze: async () => {
      analyzeCalls++;
      return { best_bet: "Under 2.5", confidence: 80, raison: "test", consensus_votes: 4, agents: [] };
    },
    save: (m, result) => {
      // Reproduit le comportement reel de saveConcileAnalysis : une ligne
      // par match_key, lisible par le prochain appel.
      db.prepare(`INSERT INTO concile_analyses (match_key, home, away, competition, best_bet, confidence, raison, consensus_votes) VALUES (?,?,?,?,?,?,?,?)`)
        .run(autoConcileMatchKey(m), m.home, m.away, m.competition, result.best_bet, result.confidence, result.raison, result.consensus_votes);
    },
    enabled: true,
  };

  await attachAutoConcileVotes([match], deps); // 1er rafraichissement (front)
  // Le declenchement reel se fait en tache de fond (non attendu) : on laisse
  // le microtask/then s'executer avant le "2eme rafraichissement".
  await new Promise((r) => setImmediate(r));
  await attachAutoConcileVotes([match], deps); // 2eme rafraichissement, memes donnees

  assert.equal(analyzeCalls, 1, "analyze() ne doit etre declenche qu'une seule fois pour le meme match/jour");
});

test("T4 — un redemarrage ne remet pas le budget a zero (deux vrais process Node successifs, fichier SQLite temporaire reel)", () => {
  // Corrige suite a la revue GPT du 26/08/2026 : la version precedente
  // utilisait DB_PATH=":memory:" et un simple re-require dans le MEME
  // process, ce qui vide aussi la base en memoire au passage — ca prouvait
  // seulement que ai_budget_guard relit ce qu'on vient d'ecrire dans la
  // MEME connexion, pas qu'un vrai redemarrage (nouveau process, nouvelle
  // connexion, fichier sur disque) preserve le budget. Ici : deux process
  // "node -e" totalement separes, un vrai fichier .sqlite temporaire.
  const fs = require("node:fs");
  const path = require("node:path");
  const os = require("node:os");
  const { execFileSync } = require("node:child_process");

  const tmpDb = path.join(os.tmpdir(), `tlm-budget-test-${process.pid}-${Date.now()}.sqlite`);
  const guardPath = path.resolve(__dirname, "../scripts/ai_budget_guard.js");
  const params = JSON.stringify({ modelKey: "concile_auto_observer", matchKey: "m42_2026-08-26", competition: "Ligue 1", market: "auto-live-observe", promptVersion: "v1" });

  const runInFreshProcess = (code) =>
    execFileSync(process.execPath, ["-e", code], { encoding: "utf8" });

  try {
    // Process n°1 : ecrit un appel "reussi" dans le fichier SQLite reel.
    const out1 = runInFreshProcess(`
      const Database = require(${JSON.stringify(require.resolve("better-sqlite3"))});
      const guard = require(${JSON.stringify(guardPath)});
      const db = new Database(${JSON.stringify(tmpDb)});
      const params = ${params};
      const first = guard.canProceed(db, params);
      if (!first.allowed) { console.log(JSON.stringify({ error: "premier passage refuse: " + first.reason })); process.exit(0); }
      guard.recordCall(db, { requestKey: first.requestKey, ...params, tokensIn: 15000, tokensOut: 2000, status: "ok" });
      db.close();
      console.log(JSON.stringify({ allowed: first.allowed }));
    `);
    const result1 = JSON.parse(out1.trim().split("\n").pop());
    assert.equal(result1.allowed, true, "process n°1, premier passage : autorise");

    // Process n°2 : PROCESS NODE COMPLETEMENT DIFFERENT (nouveau PID, nouveau
    // require, aucun etat JS partage avec le n°1) — seul le fichier .sqlite
    // sur disque relie les deux. C'est ca, un vrai redemarrage.
    const out2 = runInFreshProcess(`
      const Database = require(${JSON.stringify(require.resolve("better-sqlite3"))});
      const guard = require(${JSON.stringify(guardPath)});
      const db = new Database(${JSON.stringify(tmpDb)});
      const params = ${params};
      const second = guard.canProceed(db, params);
      db.close();
      console.log(JSON.stringify({ allowed: second.allowed, reason: second.reason }));
    `);
    const result2 = JSON.parse(out2.trim().split("\n").pop());
    assert.equal(result2.allowed, false, "process n°2 (redemarrage reel) : le meme match ne doit pas repartir a zero");
    assert.match(result2.reason, /anti-doublon/i);
  } finally {
    try { fs.unlinkSync(tmpDb); } catch (_) {}
  }
});

test("T5 — un echec IA repete ne cree pas de boucle d'appels (plafond de tentatives respecte)", async () => {
  const db = freshDb();
  let analyzeCalls = 0;
  const match = baseMatch();
  const deps = {
    dbRef: db,
    guard: permissiveGuard(),
    shouldObserve: () => true,
    isBanned: () => false,
    analyze: async () => { analyzeCalls++; throw new Error("panne fournisseur IA simulee"); },
    save: () => {},
    enabled: true,
    maxRetries: 2,
  };

  // Simule 5 rafraichissements successifs du front, tous en echec cote IA.
  for (let i = 0; i < 5; i++) {
    await attachAutoConcileVotes([match], deps);
    await new Promise((r) => setImmediate(r)); // laisse le .catch() s'executer
  }

  assert.equal(analyzeCalls, 2, "ne doit jamais depasser maxRetries tentatives pour le meme match/jour");
});

test("T6 — le vrai runConcileAnalysis (sans cle IA -> mock) et le vrai saveConcileAnalysis ne font AUCUN appel reseau ni aucun appel Telegram (par n'importe quel transport)", async () => {
  // Suite a la revue GPT du 26/08/2026 : l'interception http.request/
  // https.request ne suffit pas — un futur chemin utilisant fetch()/undici
  // (natif depuis Node 18, deja utilisable dans ce repo) la contournerait
  // silencieusement.
  //
  // DECOUVERTE IMPORTANTE en ecrivant ce test : runConcileAnalysis ne fait pas
  // QUE analyser — elle diffuse aussi REELLEMENT vers les canaux Telegram
  // payants (Standard/Premium/Elite/gratuit) et vers l'admin des qu'un seuil
  // de confiance est atteint. Sans intervention, l'auto-observation live
  // (declenchee uniquement pour l'affichage public d'un compteur de votes)
  // aurait pu diffuser un vrai signal payant pour un match jamais destine a
  // la vente. Corrige par un parametre options.skipDistribution, cable dans
  // attachAutoConcileVotes (analyze(m, { skipDistribution: true })).
  //
  // Trois verifications complementaires :
  // (a) statique, saveConcileAnalysis : aucune reference a Telegram, sous
  //     aucune forme — cette fonction ne doit JAMAIS avoir de raison d'y
  //     toucher (uniquement des ecritures SQLite) ;
  // (b) statique, runConcileAnalysis : la porte de diffusion (`diffusable`)
  //     et le bloc admin verifient tous les deux explicitement
  //     `options.skipDistribution` — preuve que le garde-fou est present
  //     exactement aux deux endroits qui declenchent un envoi Telegram
  //     independamment l'un de l'autre (voir commentaire ci-dessus) ;
  // (c) dynamique : http.request/https.request/global.fetch instrumentes
  //     pendant un vrai appel via attachAutoConcileVotes (chemin de
  //     production, deps par defaut) — preuve que RIEN ne part reseau dans
  //     les conditions reelles de ce process de test (sans GROQ_API_KEY,
  //     donc chemin mock ; le chemin complet a 5 agents + diffusion reelle
  //     n'est pas exerce ici, ce qui rend (b) necessaire en complement).
  const fs = require("node:fs");
  const path = require("node:path");
  const serverSource = fs.readFileSync(path.resolve(__dirname, "../scripts/api_server.js"), "utf8");

  function extractFunctionSource(src, name) {
    const startMatch = src.match(new RegExp(`(async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`));
    if (!startMatch) throw new Error(`fonction ${name} introuvable dans le fichier source`);
    let i = startMatch.index + startMatch[0].length;
    let depth = 1;
    const start = i;
    while (depth > 0 && i < src.length) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    return src.slice(start, i - 1);
  }

  const saveBody = extractFunctionSource(serverSource, "saveConcileAnalysis");
  assert.equal(/telegram/i.test(saveBody), false, "saveConcileAnalysis ne doit jamais referencer Telegram, sous aucune forme (ecritures SQLite uniquement)");

  const analysisBody = extractFunctionSource(serverSource, "runConcileAnalysis");
  const diffusableLine = analysisBody.match(/const diffusable\s*=.*/)?.[0] || "";
  assert.match(diffusableLine, /options\.skipDistribution/, "la porte 'diffusable' (Standard/Premium/Elite/gratuit) doit verifier options.skipDistribution");
  const adminIfLine = analysisBody.match(/if\s*\(TELEGRAM_ADMIN_CHAT_ID[^)]*\)\s*\{/)?.[0] || "";
  assert.match(adminIfLine, /options\.skipDistribution/, "le bloc de notification admin (independant de 'diffusable') doit lui aussi verifier options.skipDistribution");

  // Verification dynamique complementaire : instrumente aussi global.fetch
  // (Node 18+, natif, base sur undici) en plus de http.request/https.request.
  let networkCalls = 0;
  const origHttpRequest = http.request;
  const origHttpsRequest = https.request;
  const origFetch = global.fetch;
  http.request = (...args) => { networkCalls++; return origHttpRequest(...args); };
  https.request = (...args) => { networkCalls++; return origHttpsRequest(...args); };
  if (typeof origFetch === "function") {
    global.fetch = (...args) => { networkCalls++; return origFetch(...args); };
  }

  try {
    // On passe par le VRAI attachAutoConcileVotes, avec les VRAIES
    // runConcileAnalysis/saveConcileAnalysis (deps par defaut, non injectees) —
    // c'est bien le chemin de production qui est teste ici, pas une simulation.
    const db = freshDb();
    const out = await mod.__liveContractTest.attachAutoConcileVotes(
      [baseMatch({ id: "t6-match", minute: 32 })],
      { dbRef: db, guard: permissiveGuard(), shouldObserve: () => true, isBanned: () => false, enabled: true }
    );
    // Laisse la promesse de fond (analyze().then(save)) se terminer.
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(out.length === 1);
  } finally {
    http.request = origHttpRequest;
    https.request = origHttpsRequest;
    if (typeof origFetch === "function") global.fetch = origFetch;
  }

  assert.equal(networkCalls, 0, "aucun appel HTTP/HTTPS/fetch ne doit partir depuis runConcileAnalysis/saveConcileAnalysis sans cle IA (donc jamais de Telegram depuis ce chemin, quel que soit le transport)");
});

test("T6b — attachAutoConcileVotes appelle bien analyze() avec { skipDistribution: true }", async () => {
  // Preuve directe du cablage (complementaire a T6b/statique) : capture les
  // arguments exacts recus par la fonction analyze injectee.
  const db = freshDb();
  let receivedArgs = null;
  await attachAutoConcileVotes([baseMatch({ id: "t6b-match" })], {
    dbRef: db,
    guard: permissiveGuard(),
    shouldObserve: () => true,
    isBanned: () => false,
    analyze: async (...args) => { receivedArgs = args; return { consensus_votes: 3, agents: [] }; },
    save: () => {},
    enabled: true,
  });
  await new Promise((r) => setImmediate(r));
  assert.ok(receivedArgs, "analyze() aurait du etre appelee");
  assert.equal(receivedArgs.length, 2, "analyze() doit recevoir le match ET les options");
  assert.deepEqual(receivedArgs[1], { skipDistribution: true }, "analyze() doit toujours etre appelee avec skipDistribution:true depuis l'auto-observation");
});

test("T7 — match_key strictement identique a celui utilise par saveConcileAnalysis (meme construction id/home_away + date)", () => {
  const m = { id: "abc123", home: "Marseille", away: "Lyon" };
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(autoConcileMatchKey(m), `abc123_${today}`);
  const m2 = { home: "Marseille", away: "Lyon" }; // pas d'id -> repli home_away, comme saveConcileAnalysis
  assert.equal(autoConcileMatchKey(m2), `Marseille_Lyon_${today}`);
});

// Ne remet plus le budget a zero : le hard-exit force n'est plus necessaire
// (voir unref() plus haut, juste apres le require du module serveur).
