const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Mistral } = require("@mistralai/mistralai");

const SYSTEM_PROMPT = `Tu es un expert en analyse sportive et paris. Tu fais partie d'un conseil de 5 IAs.
Ton rôle : analyser le match proposé et donner UN SEUL pick avec un score de confiance.

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "pick": "ex: Inter ML / Over 2.5 / Team A -1.5",
  "cote_recommandee": "ex: 1.65",
  "confiance": 7.5,
  "raisonnement": "Explication courte en 2-3 phrases maximum.",
  "recommande": true
}

Règles :
- confiance entre 1 et 10 (décimal possible)
- recommande = true UNIQUEMENT si confiance >= 8
- Si pas assez d'info, confiance < 8 et recommande = false
- Sois précis et factuel, pas de bla-bla`;

async function askClaude(matchInfo) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: matchInfo }],
    system: SYSTEM_PROMPT,
  });
  return JSON.parse(msg.content[0].text);
}

async function askGPT(matchInfo) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 512,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: matchInfo },
    ],
  });
  return JSON.parse(res.choices[0].message.content);
}

async function askGemini(matchInfo) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(matchInfo);
  return JSON.parse(result.response.text());
}

async function askGrok(matchInfo) {
  const client = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: "https://api.x.ai/v1",
  });
  const res = await client.chat.completions.create({
    model: "grok-2-latest",
    max_tokens: 512,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: matchInfo },
    ],
  });
  return JSON.parse(res.choices[0].message.content);
}

async function askMistral(matchInfo) {
  const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
  const res = await client.chat.complete({
    model: "mistral-large-latest",
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: matchInfo },
    ],
  });
  return JSON.parse(res.choices[0].message.content);
}

async function callAI(name, fn, matchInfo) {
  try {
    const result = await fn(matchInfo);
    return { ia: name, success: true, ...result };
  } catch (err) {
    console.error(`[${name}] Error:`, err.message);
    return { ia: name, success: false, error: err.message };
  }
}

function buildVerdict(votes) {
  const valid = votes.filter((v) => v.success && typeof v.confiance === "number");
  if (valid.length === 0) return { verdict: "ERREUR", message: "Aucune IA n'a pu répondre." };

  const avgConfiance = valid.reduce((s, v) => s + v.confiance, 0) / valid.length;
  const recommandes = valid.filter((v) => v.recommande === true);
  const majorite = recommandes.length > valid.length / 2;

  const pickCount = {};
  recommandes.forEach((v) => {
    const k = v.pick || "unknown";
    pickCount[k] = (pickCount[k] || 0) + 1;
  });
  const bestPick = Object.entries(pickCount).sort((a, b) => b[1] - a[1])[0];

  return {
    verdict: majorite ? "PICK" : "NOPICK",
    pick: bestPick ? bestPick[0] : null,
    consensus: bestPick ? bestPick[1] + "/" + recommandes.length + " IAs d'accord" : null,
    confiance_moyenne: Math.round(avgConfiance * 10) / 10,
    ias_favorables: recommandes.length,
    ias_total: valid.length,
  };
}

async function runCouncil(matchInfo) {
  const [claude, gpt, gemini, grok, mistral] = await Promise.all([
    callAI("Claude", askClaude, matchInfo),
    callAI("GPT-4o", askGPT, matchInfo),
    callAI("Gemini", askGemini, matchInfo),
    callAI("Grok", askGrok, matchInfo),
    callAI("Mistral", askMistral, matchInfo),
  ]);

  const votes = [claude, gpt, gemini, grok, mistral];
  const verdict = buildVerdict(votes);

  return { votes, verdict };
}

module.exports = { runCouncil };
