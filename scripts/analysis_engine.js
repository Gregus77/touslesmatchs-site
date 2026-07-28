/**
 * Moteur d'analyse — point de passage OBLIGATOIRE pour tout appel IA lié à
 * l'analyse d'un match. Rien d'autre dans le projet ne doit appeler un
 * fournisseur IA (OpenRouter, DeepSeek, Groq, Cerebras, Cohere) pour analyser
 * un match : ce module est la seule porte.
 *
 * Portée de ce soir (voir échanges du 28/07/2026, séparation moteur/Hermès) :
 * les tests à blanc Qwen/Kimi sont branchés ici, sous le garde-fou budgétaire.
 * Le Concile officiel (5 agents + Chief, ~api_server.js:3195-3345) décide des
 * VRAIS picks publiés et facture de l'argent réel si un blocage se déclenche
 * par erreur — je n'ai pas pu le tester contre de vraies données de match
 * depuis cet environnement. Le brancher aussi sous ce garde-fou est la suite
 * logique, mais je recommande de le faire avec toi en train de suivre les
 * logs en direct sur le VPS, pas à l'aveugle par échange de messages.
 */

const guard = require("./ai_budget_guard");
const models = require("./ai_models.config");

// Agents du banc d'essai (SHADOW_AGENTS dans api_server.js) dont le coût est
// suivi par ce garde-fou. Les autres (Groq, Mistral direct, Cerebras, Cohere,
// OR-Mistral7B ":free") utilisent des clés/comptes séparés, hors du budget
// OpenRouter : leur appliquer le même plafond n'aurait pas de sens.
const TRACKED_SHADOW_MODELS = {
  "OR-Qwen37Max": "qwen",
  "OR-KimiK3": "kimi",
};

const SHADOW_PROMPT_VERSION = "shadow_v1";

// ~4 caractères par token — approximation usuelle pour un texte français/anglais
// mêlé de JSON. Sert uniquement à ESTIMER le coût avant l'appel ; le coût
// réellement enregistré utilise les tokens exacts renvoyés par l'API si
// disponibles (voir usageIn/usageOut dans callOpenAICompat).
function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

/**
 * Enveloppe un appel d'agent shadow avec le garde-fou budgétaire. Ne change
 * PAS la forme du résultat ({ ok, text, error }) : le reste du code (parsing,
 * logs "SANS RÉPONSE") continue de fonctionner sans modification.
 *
 * @param db          instance better-sqlite3 déjà ouverte
 * @param agent       entrée de SHADOW_AGENTS (name, call)
 * @param prompt      prompt déjà construit
 * @param ctx         { matchKey, competition }
 */
async function guardedShadowCall(db, agent, prompt, ctx) {
  const modelKey = TRACKED_SHADOW_MODELS[agent.name];
  if (!modelKey) {
    // Agent non suivi par ce budget (autre fournisseur/compte) : comportement inchangé.
    return agent.call(prompt);
  }

  const model = models.getModel(modelKey);
  const check = guard.canProceed(db, {
    modelKey,
    matchKey: ctx.matchKey,
    competition: ctx.competition,
    market: "multi",
    promptVersion: SHADOW_PROMPT_VERSION,
    estimatedTokensIn: estimateTokens(prompt),
    estimatedTokensOut: model.maxTokensOut,
  });

  if (!check.allowed) {
    return { ok: false, text: "", error: check.reason };
  }

  const result = await agent.call(prompt);
  guard.recordCall(db, {
    requestKey: check.requestKey,
    modelKey,
    matchKey: ctx.matchKey,
    competition: ctx.competition,
    market: "multi",
    purpose: "shadow_test",
    tokensIn: result.usageIn || estimateTokens(prompt),
    tokensOut: result.usageOut || estimateTokens(result.text),
    status: result.ok ? "ok" : "error",
    blockReason: result.ok ? null : result.error,
  });

  return result;
}

module.exports = { guardedShadowCall, TRACKED_SHADOW_MODELS, SHADOW_PROMPT_VERSION };
