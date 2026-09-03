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
  // ── Consolidation OpenRouter du 04/08/2026 (decision du fondateur) ──────
  // Perplexity (cle expiree, HTTP 401), Cohere (quota d'essai epuise, HTTP
  // 429), DeepSeek (solde a zero, HTTP 402) et Mistral (rate-limit, HTTP 429)
  // ont chacun leur propre compte a recharger separement — invisible et
  // incontrolable depuis un seul endroit. Les 4 passent desormais par
  // OpenRouter, sous le MEME garde-fou budgetaire (2€/jour, tous agents
  // confondus) que Perplexity/Qwen avant eux — un seul compte a surveiller
  // et recharger au lieu de cinq. Les comptes directs restent en repli dans
  // le code (voir runConcileAnalysis) si jamais re-alimentes un jour.
  deepseek: {
    id: "deepseek/deepseek-chat",
    provider: "openrouter",
    role: "official_fallback",
    mode: "official",
    enabled: true,
    dailyLimit: Number(process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY || 30),
    maxTokensOut: Number(process.env.AI_MODEL_DEEPSEEK_MAX_TOKENS || 400),
    costPer1kTokensEur: 0.0003,
  },
  mistral: {
    id: process.env.OR_MISTRAL_MODEL || "mistralai/mistral-small-2603",
    provider: "openrouter",
    role: "official_fallback",
    mode: "official",
    enabled: true,
    dailyLimit: Number(process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY || 30),
    maxTokensOut: Number(process.env.AI_MODEL_MISTRAL_MAX_TOKENS || 400),
    costPer1kTokensEur: 0.004,
  },
  cohere: {
    id: "cohere/command-r-plus",
    provider: "openrouter",
    role: "official_fallback",
    mode: "official",
    enabled: false,
    dailyLimit: Number(process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY || 30),
    maxTokensOut: Number(process.env.AI_MODEL_COHERE_MAX_TOKENS || 400),
    costPer1kTokensEur: 0.003,
  },
  perplexity: {
    id: "perplexity/sonar-pro",
    provider: "openrouter",
    role: "official_fallback",
    mode: "official",
    enabled: true,
    dailyLimit: Number(process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY || 30),
    maxTokensOut: Number(process.env.AI_MODEL_PERPLEXITY_MAX_TOKENS || 400),
    costPer1kTokensEur: 0.003,
  },

  // ── Qwen titulaire ; Kimi au banc depuis le 01/09/2026 ──────────────────
  qwen: {
    id: process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max",
    provider: "openrouter",
    role: "official",
    mode: "official",
    enabled: true,
    dailyLimit: Number(process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY || 30),
    maxTokensOut: Number(process.env.AI_MODEL_QWEN_MAX_TOKENS || 400),
    costPer1kTokensEur: 0.002,
  },
  kimi: {
    id: process.env.OR_KIMI_MODEL || "moonshotai/kimi-k3",
    provider: "openrouter",
    role: "shadow_test",
    mode: "test",
    enabled: bool(process.env.OPENROUTER_KIMI_TEST_ENABLED, true),
    dailyLimit: Number(process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY || 30),
    maxTokensOut: Number(process.env.AI_MODEL_KIMI_MAX_TOKENS || 400),
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
  // ── Chatbot d'assistance client (/chat, /chatbot/ask) : ne fait AUCUNE
  // analyse de match, mais reste soumis au meme devoir de tracabilite et de
  // plafond budgetaire que tout appel IA du projet (regle finale du prompt
  // maitre du 28/07/2026 : "aucune depense OpenRouter sans limite, verrou
  // anti-doublon et tracabilite" — anti-doublon inapplicable a une conversation
  // libre, budget/journalisation applicables).
  mistral_chat: {
    id: "mistral-small-latest",
    provider: "mistral",
    role: "official",
    mode: "official",
    enabled: true,
    dailyLimit: Number(process.env.AI_MODEL_CHATBOT_DAILY_LIMIT || 300),
    maxTokensOut: Number(process.env.AI_MODEL_CHATBOT_MAX_TOKENS || 500),
    costPer1kTokensEur: 0.0006,
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

function normalizeModelKey(key) {
  const k = String(key || "").trim().toLowerCase();

  const aliases = {
    "mistralai": "mistral",
    "mistral-large": "mistral",
    "mistral-small": "mistral",
    "moonshotai": "kimi",
    "openrouter-kimi": "kimi",
    "kimi-k2": "kimi",
    "kimi-k3": "kimi",
    "perplexity-web": "perplexity",
    "deepseek-v3": "deepseek",
    "cohere-command": "cohere",
    "openrouter-qwen": "qwen"
  };

  return aliases[k] || k;
}

function getModel(key) {
  const normalized = normalizeModelKey(key);
  const m = MODELS[normalized];
  if (!m) throw new Error(`[ai_models.config] modèle inconnu: ${key}`);
  return m;
}

function isModelAuthorized(key) {
  const normalized = normalizeModelKey(key);
  const m = MODELS[normalized];
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

module.exports = { MODELS, getModel, isModelAuthorized, estimateCostEur, listEnabledModels, normalizeModelKey };
