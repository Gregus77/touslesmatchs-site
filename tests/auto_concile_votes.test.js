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
const guardReal = require("../scripts/ai_budget_guard.js");
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

test("T4 — un redemarrage ne remet pas le budget a zero (persistance reelle via ai_budget_guard + SQLite)", () => {
  const db = freshDb();
  guardReal.ensureSchema(db);
  const params = { modelKey: "concile_auto_observer", matchKey: "m42_2026-08-26", competition: "Ligue 1", market: "auto-live-observe", promptVersion: "v1" };

  // Simule un premier "process" qui a deja traite ce match avec succes.
  const first = guardReal.canProceed(db, params);
  assert.equal(first.allowed, true, "premier passage : autorise");
  guardReal.recordCall(db, { requestKey: first.requestKey, ...params, tokensIn: 15000, tokensOut: 2000, status: "ok" });

  // "Redemarrage" simule : re-require du module guard (vide tout etat JS en
  // memoire qu'il pourrait avoir), MAIS la meme base SQLite persiste.
  delete require.cache[require.resolve("../scripts/ai_budget_guard.js")];
  const guardAfterRestart = require("../scripts/ai_budget_guard.js");

  const second = guardAfterRestart.canProceed(db, params);
  assert.equal(second.allowed, false, "apres 'redemarrage', le meme match ne doit pas repartir a zero (anti-doublon persistant)");
  assert.match(second.reason, /anti-doublon/i);
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

test("T6 — le vrai runConcileAnalysis (sans cle IA -> mock) et le vrai saveConcileAnalysis ne font AUCUN appel reseau (donc aucun Telegram)", async () => {
  // On instrumente les modules reseau natifs de Node : si le code reel
  // testé ici tentait un appel HTTP/HTTPS (Telegram ou autre), ce test le
  // detecterait et echouerait.
  let networkCalls = 0;
  const origHttpRequest = http.request;
  const origHttpsRequest = https.request;
  http.request = (...args) => { networkCalls++; return origHttpRequest(...args); };
  https.request = (...args) => { networkCalls++; return origHttpsRequest(...args); };

  try {
    // On passe par le VRAI attachAutoConcileVotes, avec les VRAIES
    // runConcileAnalysis/saveConcileAnalysis (deps par defaut, non injectees) —
    // c'est bien le chemin de production qui est teste ici, pas une simulation.
    const db = freshDb();
    const out = await mod.__liveContractTest.attachAutoConcileVotes(
      [baseMatch({ minute: 32 })],
      { dbRef: db, guard: permissiveGuard(), shouldObserve: () => true, isBanned: () => false, enabled: true }
    );
    // Laisse la promesse de fond (analyze().then(save)) se terminer.
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(out.length === 1);
  } finally {
    http.request = origHttpRequest;
    https.request = origHttpsRequest;
  }

  assert.equal(networkCalls, 0, "aucun appel HTTP/HTTPS ne doit partir depuis runConcileAnalysis/saveConcileAnalysis sans cle IA (donc jamais de Telegram depuis ce chemin)");
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
