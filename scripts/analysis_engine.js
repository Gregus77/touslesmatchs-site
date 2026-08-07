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

/**
 * Concile officiel (5 agents + Chief) — chaque agent a UN fournisseur officiel
 * dédié (sa propre clé : DeepSeek, Perplexity, Mistral, Cohere...). OpenRouter
 * n'intervient QUE si ce fournisseur dédié n'est pas configuré (clé absente du
 * .env) ET que les autres replis génériques (DeepSeek partagé, Mistral partagé,
 * Groq) ont eux aussi échoué — un chemin rare, pas le fonctionnement courant.
 *
 * Volontairement chirurgical : cette fonction décide UNIQUEMENT si OpenRouter
 * peut être ajouté à la liste des fournisseurs candidats. Elle ne touche jamais
 * aux fournisseurs officiels eux-mêmes. Le pire cas d'un bug ici : un agent
 * répond "pas de réponse" (déjà un cas existant et géré), jamais un blocage du
 * Concile — ce qui publie les vrais picks et fait tourner de l'argent réel.
 *
 * Le coût est enregistré au moment où l'option est ajoutée à la liste, pas
 * après confirmation de l'appel réel (qui se fait dans une boucle partagée de
 * api_server.js, hors de portée de ce module sans la restructurer). Choix
 * volontairement prudent : mieux vaut compter une tentative qui échoue
 * finalement que sous-compter une dépense réelle.
 */
/**
 * Repli OpenRouter apres qu'un fournisseur DIRECT a ete ecarte (401/402/403/429
 * enregistres dans provider_health). Ajoute le 07/08/2026 : le coupe-circuit
 * "spike" bloquait ces replis, donc les agents restaient muets, donc aucun
 * quorum de 3 et zero signal — alors que le spike ne visait pas ce cas.
 *
 * Le franchissement est etroit et plafonne :
 *   - seul le coupe-circuit "spike" est franchi, jamais le budget quotidien,
 *     jamais l'anti-doublon, jamais le duplicate_burst ;
 *   - un seul repli par agent et par match, garanti par la cle anti-doublon
 *     (matchKey + modelKey + promptVersion) qui reste opposable ;
 *   - plafond journalier configurable, defaut 60.
 */
const FALLBACK_DAILY_CAP = Math.max(1, Number(process.env.OPENROUTER_FALLBACK_DAILY_CAP || 60));

function allowFallbackAfterProviderDown(db, { agentLabel, matchKey, competition, modelKey }) {
  let dejaAujourdhui = 0;
  try {
    dejaAujourdhui = db.prepare(
      "SELECT COUNT(*) n FROM ai_call_budget_log WHERE date(created_at) = date('now') AND purpose = 'provider_down_fallback' AND status = 'ok'"
    ).get().n;
  } catch (e) { /* table creee par ensureSchema au premier appel */ }
  if (dejaAujourdhui >= FALLBACK_DAILY_CAP) {
    console.warn(`[ai-guard] repli de secours refuse pour "${agentLabel}" : plafond journalier atteint (${dejaAujourdhui}/${FALLBACK_DAILY_CAP})`);
    return false;
  }
  const check = guard.canProceed(db, {
    modelKey, matchKey, competition,
    market: "concile",
    promptVersion: `secours_${agentLabel}`,
    estimatedTokensIn: 1500,
    estimatedTokensOut: 400,
    allowDespiteSpike: true,
  });
  if (!check.allowed) {
    console.warn(`[ai-guard] repli de secours refuse pour "${agentLabel}" sur "${matchKey}": ${check.reason}`);
    return false;
  }
  guard.recordCall(db, {
    requestKey: check.requestKey, modelKey, matchKey, competition,
    market: "concile", purpose: "provider_down_fallback",
    tokensIn: 1500, tokensOut: 400, status: "ok",
  });
  console.log(`[ai-guard] repli OpenRouter autorise car provider direct ecarte — ${agentLabel} (${dejaAujourdhui + 1}/${FALLBACK_DAILY_CAP} aujourd'hui)`);
  return true;
}

function allowOfficialOpenRouterFallback(db, { agentLabel, matchKey, competition, modelKey }) {
  const check = guard.canProceed(db, {
    modelKey,
    matchKey,
    competition,
    market: "concile",
    promptVersion: `fallback_${agentLabel}`,
    estimatedTokensIn: 1500,
    estimatedTokensOut: 400,
  });
  if (!check.allowed) {
    console.warn(`[ai-guard] repli OpenRouter (${modelKey}) refusé pour "${agentLabel}" sur "${matchKey}": ${check.reason}`);
    return false;
  }
  guard.recordCall(db, {
    requestKey: check.requestKey, modelKey, matchKey, competition,
    market: "concile", purpose: "official_fallback",
    tokensIn: 1500, tokensOut: 400, status: "ok",
  });
  return true;
}

/**
 * Chatbot d'assistance client — traçabilité + plafond, PAS les règles de
 * publication de picks (confiance/cote/marché n'ont aucun sens pour une
 * question du type "combien coûte Premium ?"). L'anti-doublon est
 * volontairement neutralisé (clé unique par requête) : deux questions
 * différentes d'un même client ne doivent jamais être bloquées comme
 * "déjà traitées".
 */
function allowChatbotCall(db, { sessionId }) {
  const uniqueKey = `${sessionId || "anon"}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const check = guard.canProceed(db, {
    modelKey: "mistral_chat",
    matchKey: uniqueKey, // jamais réutilisée : l'anti-doublon ne s'applique pas ici par construction
    competition: null,
    market: "chatbot",
    promptVersion: "chat_v1",
    estimatedTokensIn: 800,
    estimatedTokensOut: 500,
  });
  if (!check.allowed) {
    console.warn(`[ai-guard] chatbot refusé: ${check.reason}`);
    return { allowed: false, reason: check.reason };
  }
  return {
    allowed: true,
    record: (tokensIn, tokensOut, status) => guard.recordCall(db, {
      requestKey: check.requestKey, modelKey: "mistral_chat", matchKey: uniqueKey,
      market: "chatbot", purpose: "customer_support",
      tokensIn: tokensIn || 800, tokensOut: tokensOut || 500, status: status || "ok",
    }),
  };
}

module.exports = {
  allowFallbackAfterProviderDown,
  guardedShadowCall, TRACKED_SHADOW_MODELS, SHADOW_PROMPT_VERSION,
  allowOfficialOpenRouterFallback, allowChatbotCall,
};
