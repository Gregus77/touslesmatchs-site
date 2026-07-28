/**
 * Registre unique des modèles IA utilisables pour l'analyse sportive.
 *
 * Un seul fichier, une seule source de vérité — conformément au prompt maître
 * du 28/07/2026 : "Tous les modèles doivent être configurables dans un seul
 * fichier, avec identifiant OpenRouter, rôle, activation, mode officiel ou
 * test, limite quotidienne, limite de tokens, coût estimé."
 *
 * Ce fichier ne fait AUCUN appel réseau. Il ne fait que décrire les modèles.
 * Les valeurs de coût (costPer1kTokensEur) sont des ESTIMATIONS que tu dois
 * ajuster toi-même — elles ne viennent d'aucune facture réelle, je ne peux
 * pas inventer un prix exact. Sers-toi en comme d'un ordre de grandeur pour
 * le coupe-circuit budgétaire, pas comme d'une facturation précise.
 *
 * enabled : lu depuis .env, jamais codé en dur ici (règle anti-gaspillage #NaN
 * du prompt maître : "Ne mets pas les valeurs en dur dans le code").
 */

const bool = (v, def) => {
  if (v === undefined || v === "") return def;
  return String(v).trim().toLowerCase() === "true" || v === "1";
};

const MODELS = {
  // ── Officiel : utilisé pour de vraies décisions du Concile ──────────────
  deepseek: {
    id: "deepseek-chat",
    provider: "deepseek",
    role: "official",
    mode: "official",
    enabled: true,
    dailyLimit: Number(process.env.AI_MODEL_DEEPSEEK_DAILY_LIMIT || 200),
    maxTokensOut: Number(process.env.AI_MODEL_DEEPSEEK_MAX_TOKENS || 400),
    costPer1kTokensEur: 0.0002, // ordre de grandeur — DeepSeek est le moins cher du registre
  },

  // ── Test à blanc uniquement : ne décident jamais, ne publient jamais ───
  qwen: {
    id: process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max",
    provider: "openrouter",
    role: "shadow_test",
    mode: "test",
    enabled: bool(process.env.OPENROUTER_QWEN_TEST_ENABLED, true),
    dailyLimit: Number(process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY || 30),
    maxTokensOut: Number(process.env.AI_MODEL_QWEN_MAX_TOKENS || 120),
    costPer1kTokensEur: 0.002,
  },
  kimi: {
    id: process.env.OR_KIMI_MODEL || "moonshotai/kimi-k3",
    provider: "openrouter",
    role: "shadow_test",
    mode: "test",
    enabled: bool(process.env.OPENROUTER_KIMI_TEST_ENABLED, true),
    dailyLimit: Number(process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY || 30),
    maxTokensOut: Number(process.env.AI_MODEL_KIMI_MAX_TOKENS || 120),
    costPer1kTokensEur: 0.003,
  },

  // ── Désactivés par défaut : coûteux, à activer explicitement seulement ─
  gpt: {
    id: process.env.OR_GPT_MODEL || "openai/gpt-4o-mini",
    provider: "openrouter",
    role: "shadow_test",
    mode: "test",
    enabled: bool(process.env.AI_MODEL_GPT_ENABLED, false),
    dailyLimit: Number(process.env.AI_MODEL_GPT_DAILY_LIMIT || 10),
    maxTokensOut: Number(process.env.AI_MODEL_GPT_MAX_TOKENS || 120),
    costPer1kTokensEur: 0.01,
  },
  claude: {
    id: process.env.OR_CLAUDE_MODEL || "anthropic/claude-3.5-haiku",
    provider: "openrouter",
    role: "shadow_test",
    mode: "test",
    enabled: bool(process.env.AI_MODEL_CLAUDE_ENABLED, false),
    dailyLimit: Number(process.env.AI_MODEL_CLAUDE_DAILY_LIMIT || 10),
    maxTokensOut: Number(process.env.AI_MODEL_CLAUDE_MAX_TOKENS || 120),
    costPer1kTokensEur: 0.015,
  },
};

function getModel(key) {
  const m = MODELS[key];
  if (!m) throw new Error(`[ai_models.config] modèle inconnu: ${key}`);
  return m;
}

function isModelAuthorized(key) {
  const m = MODELS[key];
  return !!m && m.enabled;
}

// Estimation grossière du coût — voir avertissement en tête de fichier.
function estimateCostEur(key, tokensIn, tokensOut) {
  const m = getModel(key);
  const totalK = (Number(tokensIn || 0) + Number(tokensOut || 0)) / 1000;
  return Math.round(totalK * m.costPer1kTokensEur * 1e6) / 1e6;
}

function listEnabledModels() {
  return Object.keys(MODELS).filter((k) => MODELS[k].enabled);
}

module.exports = { MODELS, getModel, isModelAuthorized, estimateCostEur, listEnabledModels };
