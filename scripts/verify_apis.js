#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
// PHASE 2 — Vérification des APIs multi-IA
// ═══════════════════════════════════════════════════════

const https = require("https");

const APIS = {
  deepseek: {
    name: "DeepSeek",
    key: process.env.DEEPSEEK_API_KEY,
    test: async () => {
      const body = JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 100,
        temperature: 0.1,
        messages: [{ role: "user", content: "Réponds uniquement 'OK'" }]
      });
      const res = await post("api.deepseek.com", "/v1/chat/completions", {
        "Authorization": `Bearer ${APIS.deepseek.key}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }, body);
      return res.choices?.[0]?.message?.content?.includes("OK");
    }
  },
  openrouter: {
    name: "OpenRouter",
    key: process.env.OPENROUTER_API_KEY,
    test: async () => {
      const body = JSON.stringify({
        model: "deepseek/deepseek-chat",
        max_tokens: 100,
        messages: [{ role: "user", content: "Réponds uniquement 'OK'" }]
      });
      const res = await post("openrouter.ai", "/api/v1/chat/completions", {
        "Authorization": `Bearer ${APIS.openrouter.key}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }, body);
      return res.choices?.[0]?.message?.content?.includes("OK");
    }
  },
  gemini: {
    name: "Gemini",
    key: process.env.GEMINI_API_KEY,
    test: async () => {
      const body = JSON.stringify({
        contents: [{ parts: [{ text: "Réponds uniquement 'OK'" }] }],
        generationConfig: { maxOutputTokens: 100, temperature: 0.1 }
      });
      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname: "generativelanguage.googleapis.com",
          path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${APIS.gemini.key}`,
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
        }, res => {
          let d = "";
          res.on("data", c => d += c);
          res.on("end", () => {
            try {
              const r = JSON.parse(d);
              resolve(r.candidates?.[0]?.content?.parts?.[0]?.text?.includes("OK"));
            } catch { reject(new Error("Parse error")); }
          });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
      });
    }
  },
  mistral: {
    name: "Mistral",
    key: process.env.MISTRAL_API_KEY,
    test: async () => {
      const body = JSON.stringify({
        model: "mistral-large-latest",
        max_tokens: 100,
        messages: [{ role: "user", content: "Réponds uniquement 'OK'" }]
      });
      const res = await post("api.mistral.ai", "/v1/chat/completions", {
        "Authorization": `Bearer ${APIS.mistral.key}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }, body);
      return res.choices?.[0]?.message?.content?.includes("OK");
    }
  }
};

function post(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: "POST", headers }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch { reject(new Error("Parse error")); }
      });
    });
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("TIMEOUT")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function verify() {
  console.log("\n🔍 PHASE 2 — Vérification des APIs multi-IA\n");

  const results = {};

  for (const [key, api] of Object.entries(APIS)) {
    process.stdout.write(`  ${api.name}... `);

    if (!api.key) {
      console.log("❌ NON CONFIGURÉ");
      results[key] = { status: "unconfigured", time: 0 };
      continue;
    }

    const start = Date.now();
    try {
      const ok = await api.test();
      const time = Date.now() - start;
      if (ok) {
        console.log(`✅ OK (${time}ms)`);
        results[key] = { status: "success", time };
      } else {
        console.log(`⚠️  Réponse invalide`);
        results[key] = { status: "invalid_response", time };
      }
    } catch (e) {
      const time = Date.now() - start;
      console.log(`❌ ${e.message} (${time}ms)`);
      results[key] = { status: "error", error: e.message, time };
    }
  }

  console.log("\n📊 Résumé:\n");
  const active = Object.entries(results).filter(([k, v]) => v.status === "success").length;
  console.log(`  Actifs: ${active}/${Object.keys(results).length}`);
  console.log(`  Priorité: DeepSeek → OpenRouter → Gemini → Mistral → Fallback\n`);

  const summary = {
    timestamp: new Date().toISOString(),
    results
  };

  console.log(JSON.stringify(summary, null, 2));
}

verify().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
