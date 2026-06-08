# 🧬 PATTERNS ANDREJ KARPATHY — APPLICATION À TOUSLESMATCHS

**Source**: Karpathy Sequoia Ascent 2026 + AutoResearch patterns

---

## PATTERN #1: AGENTIC LOOP — Plan → Execute → Observe → Refine

### Théorie Karpathy
```
Vieux paradigme: Human writes code
Nouveau paradigme: Human designs spec → Agent executes → Human observes → Loop refines
```

### Application TousLesMatchs : PICK SELECTION WORKFLOW

```
PLAN (Human direction en HERMES_VISION.md):
├─ Objectif: Trouver 1 meilleur pick/jour (note 7-10)
├─ Contrainte: Winrate 75%+ (priorité 1)
├─ Filtre: Seulement ARJEL (FR legality)
└─ Exclusion: Aucun doublon match

EXECUTE (DeepSeek agent):
├─ Reçoit 50 matchs potentiels (RapidAPI)
├─ Analyse chacun via Groq cotes
├─ Classe par confiance (7.0 → 10.0)
└─ Sélectionne top 1 avec meilleure note

OBSERVE (Immutable evaluator):
├─ Pick enregistré en App.js
├─ Match résultat stocké après 24-72h
├─ Win/Loss calculé vs cote réelle
└─ Métrique: winrate%, ROI%, best league

REFINE (AutoResearch agent — mensuel):
├─ Analyse 100+ picks passés
├─ Identifie ligues +80% winrate (Hockey > Basketball)
├─ Teste seuils note (7.0 vs 7.5 vs 8.0)
├─ Recommande ajustements prompt DeepSeek
└─ LOOP: Nouveau cycle avec meilleur prompt
```

**Implémentation TousLesMatchs**:
```javascript
// PLAN: HERMES_VISION.md défini les règles
// EXECUTE: multi_agent.js exécute
// OBSERVE: App.js enregistre + picks_history.json immutable
// REFINE: hermes_learn.js analyse patterns mensuels
```

---

## PATTERN #2: THREE-FILE CONTRACT (Karpathy AutoResearch)

### Théorie Karpathy
```
3 fichiers = 3 rôles distincts, jamais mélangés:

1. PREPARE.PY (immutable evaluator) — jamais changé
   └─ Garantit que chaque expérience = même mesure
   
2. TRAIN.PY (agent-editable implementation) — seul fichier que l'agent modifie
   └─ Agent itère à volonté sans risque
   
3. PROGRAM.MD (human-written direction) — human supervise
   └─ Décrit research agenda, hypothèses à tester
```

### Application TousLesMatchs #1 : PICK SELECTION

```
PREPARE.JS (Immutable evaluator):
├─ Charge picks_history.json (historique immuable)
├─ Définit métrique : winrate% = wins / (wins + losses)
├─ Définit validation : note ∈ [7.0, 10.0]
├─ Définit whitelist ARJEL : 60+ ligues, 5 pays
└─ Retourne : {"metric": 0.78, "valid": true, "reason": "..."}

MULTI_AGENT.JS (Agent-editable implementation):
├─ Reçoit 50 matches potentiels
├─ Agent peut :
│  ├─ Changer prompt DeepSeek
│  ├─ Ajuster seuil note min (7.0 → 7.5)
│  ├─ Modifier critères sélection
│  └─ Ajouter nouvelles ligues à tester
└─ Ne JAMAIS toucher prepare.js ← garantie de mesure stricte

HERMES_VISION.MD (Human-written direction):
├─ "Priorité 1: Maximiser winrate (>75%)"
├─ "Priorité 2: Éviter doublons (1 pick/jour)"
├─ "Test: Hockey > Basketball (33% vs 87%)"
├─ "Hypothèse: Seuil 8.0 meilleur que 7.0"
└─ "Mesurez via prepare.js après 50 picks"
```

### Application TousLesMatchs #2 : STRIPE PAYMENTS

```
STRIPE_SCHEMA.SQL (Immutable evaluator):
├─ Table: transactions (id, user_id, amount, status, created_at)
├─ Constraint: PRIMARY KEY id (never deleted)
├─ Trigger: audit_log (every update logged)
└─ Immutable: SELECT only, never UPDATE/DELETE

STRIPE_WEBHOOK.JS (Agent-editable implementation):
├─ Reçoit webhook Stripe
├─ Agent peut :
│  ├─ Ajouter email notification
│  ├─ Enrichir metadata transaction
│  ├─ Changer logique activation (instant vs delay)
│  └─ Retry sur failure
└─ Ne JAMAIS modifier schema.sql ← garantie d'audit trail

HERMES_VISION.MD (Human direction):
├─ "Après paiement → activation < 1s"
├─ "Webhook failure → retry exponential (1s, 5s, 30s)"
├─ "Réconciliation Stripe ↔ DB quotidienne (alert si diff > 0.01€)"
└─ "Zéro perte transaction (immuable)"
```

---

## PATTERN #3: FALLBACK ROUTING — Multi-agents en cascade

### Théorie Karpathy
```
Ne pas betting tout sur un seul agent (risque timeout/hallucination).
Cascade d'agents → first success wins.
```

### Application TousLesMatchs : MULTI-IA SELECTION

```
CURRENT (Phase 2 implementation):

RapidAPI (data)
    ↓
Groq/Llama3 (cotes)
    ↓
callWithFallback([
    DeepSeek      (1er choix — moins cher, rapide, bon quality)
    OpenRouter    (fallback 1 — meilleur modèle disponible)
    Gemini        (fallback 2 — stable, moins cher)
    Mistral       (fallback 3 — léger, rapide)
]) → first success = pick retourné
    ↓
Telegram + App.js

FLOW avec logs:
  ✅ DeepSeek responded (200ms) → pick utilisé
  ✅ OpenRouter timeout → skip
  ✅ Gemini error (rate limit) → skip
  ✅ Mistral success (1200ms) → fallback utilisé
  ❌ Tous échouent → manuel fallback (best cote)

CONFIGURATION (multi_agent.js):
const AI_PROVIDERS = [
  { name: "DeepSeek", available: () => !!DEEPSEEK_KEY, call: callDeepSeek },
  { name: "OpenRouter", available: () => !!OPENROUTER_KEY, call: callOpenRouter },
  { name: "Gemini", available: () => !!GEMINI_KEY, call: callGemini },
  { name: "Mistral", available: () => !!MISTRAL_KEY, call: callMistral }
];

async function callWithFallback(prompt) {
  for (const provider of AI_PROVIDERS) {
    if (!provider.available()) continue;
    try {
      const result = await provider.call(prompt);
      console.log(`✓ ${provider.name}: success`);
      return { provider: provider.name, result };
    } catch (e) {
      console.error(`❌ ${provider.name}: ${e.message}`);
    }
  }
  return { provider: "FALLBACK", result: null };
}

RÉSULTAT:
├─ 0 API timeout jamais = pas d'erreur user
├─ Coût réduit (DeepSeek < OpenRouter < Gemini)
├─ Qualité préservée (Gemini si DeepSeek fail)
└─ Observable: log chaque attempt (verify_apis.js)
```

---

## PATTERN #4: TOKEN OPTIMIZATION — Zéro idle tokens

### Théorie Karpathy
```
GPU era : utilisation = parallélisation
Token era : utilisation = délégation + parallelization

Vieux: "Dois-je demander à l'agent?" → oui, séquentiel
Nouveau: "Peux-je demander à 3 agents en parallèle?" → oui, toujours!
```

### Application TousLesMatchs : PARALLÉLISATION FUTURE

```
CURRENT (séquentiel):
RapidAPI fetch (2s)
  ↓ (wait)
Groq enrichment (3s)
  ↓ (wait)
DeepSeek selection (2s)
  ↓ (wait)
Telegram broadcast (1s)
━━━━━━━━━━━━━━━━━━
TOTAL: 8s

FUTURE WITH PARALLELIZATION (Skill #15 — MCP):
RapidAPI fetch (2s) ─┐
Groq enrichment (3s)  │ (parallel)
DeepSeek selection(2s)│
Telegram broadcast(1s)┘
━━━━━━━━━━━━━━━━━━
TOTAL: 3s (max latency)
Speedup: 2.6x

IMPLÉMENTATION:
├─ Worker pool (max 4 workers = VPS Hostinger CPU limit)
├─ Task queue : [task1, task2, task3, task4]
├─ Promise.all([...]) execute en parallèle
├─ Timeout: 30s max (vs 60s séquentiel)
└─ Observable: timing logs

EXEMPLE CODE:
const tasks = [
  fetchRapidAPI(dates),      // worker 1
  enrichGroq(matches),       // worker 2
  selectDeepSeek(data),      // worker 3
  notifyTelegram(pick)       // worker 4
];
const results = await Promise.all(tasks);
// 3s instead of 8s ✨
```

---

## PATTERN #5: OBSERVABLE METRICS — Immutable audit trail

### Théorie Karpathy
```
Mesurer = décider + optimiser
Immutable metrics = garantie que les mesures ne changent pas
```

### Application TousLesMatchs : GA4 + REDIS COUNTERS

```
OBSERVABLE METRIC #1 : PICK QUALITY (App.js)
├─ Immutable: picks_history.json (never edit, append-only)
├─ Entry: {date, match, pick, cote, result, note, sport}
├─ Metric: winrate = count(result=="GAGNE") / total
├─ Current: 21 wins / 27 total = 78%
└─ Observable: GA4 event "pick_outcome" (win vs loss)

OBSERVABLE METRIC #2 : USER ENGAGEMENT (GA4)
├─ Event: "pick_viewed" → count = X per day
├─ Event: "subscribe_clicked" → count = Y per day
├─ Event: "analyse_live_used" → count = Z per day
├─ Conversion: subscribe_clicked / pick_viewed = %
└─ Immutable: GA4 audit log (never rollback)

OBSERVABLE METRIC #3 : QUOTA USAGE (Redis)
├─ Immutable: Redis INCR (only increment, never decrement)
├─ Key: "user:123:quota:day:2026-06-08" = 3 (Free limit)
├─ Key: "user:456:quota:day:2026-06-08" = 10 (Premium limit)
├─ Reset: cronjob daily (00:00 UTC)
└─ Observable: Redis audit logs

OBSERVABLE METRIC #4 : PAYMENT INTEGRITY (PostgreSQL)
├─ Immutable: transactions table (PK id never delete)
├─ Trigger: audit_log (every transaction INSERT recorded)
├─ Daily reconciliation: Stripe API ↔ DB (alert if diff)
├─ Observable: SELECT * FROM audit_log
└─ Zero data loss guarantee
```

---

## PATTERN #6: AGENT-NATIVE SURFACES — Interfaces pour agents

### Théorie Karpathy
```
Les agents ne lisent pas les docs long PDF.
Agents aiment: CLI, APIs, structured outputs, Markdown.
```

### Application TousLesMatchs : SURFACES POUR AGENTS

```
SURFACE #1: CLI Commands (scripts/)
├─ node scripts/multi_agent.js  ← main orchestrator
├─ node scripts/verify_apis.js  ← health check
├─ node scripts/hermes_learn.js ← learning loop
├─ node scripts/check_results.js ← result verification
└─ Tous: JSON output pour parsing machine

SURFACE #2: API Endpoints (Express)
├─ GET /api/picks (returne picks[] + metadata)
├─ GET /api/analyse-live?match_id=123 (live probs)
├─ POST /api/analyse-live (create new analysis)
├─ POST /webhooks/stripe (payment webhooks)
└─ Tous: structured JSON, error codes clairs

SURFACE #3: Markdown Documentation
├─ HERMES_VISION.md (human direction)
├─ CLAUDE.md (project state)
├─ README.md (setup instructions)
└─ Agents can READ + understand context

SURFACE #4: MCP Servers (Future — Skill #15)
├─ MCP resource: picks_history.json
├─ MCP resource: verify_apis.py
├─ MCP tool: callWithFallback()
├─ MCP tool: notifyTelegram()
└─ Agents invoke via standard MCP protocol

SURFACE #5: Structured Logs
├─ JSON logs (not free text)
├─ Example: {"timestamp": "...", "event": "pick_generated", "note": 8.5, "provider": "DeepSeek"}
├─ Parseable by agents
└─ Queryable via logs dashboard
```

---

## PATTERN #7: HUMAN OVERSIGHT — Humans direct, agents execute

### Théorie Karpathy
```
"Thinking can be delegated, but understanding cannot be outsourced."
Humans: know WHY we're building it, set direction
Agents: know HOW to execute
```

### Application TousLesMatchs : DIRECTION HUMAINE

```
HUMAN DIRECTION #1: HERMES_VISION.md (Strategic)
├─ "Priorité 1: Maximiser winrate > 75%"
├─ "Priorité 2: 1 pick/jour only (qualité > volume)"
├─ "Priorité 3: Croissance users (SEO + TikTok)"
├─ "Test: Hockey > Basketball (disabler Basketball)"
└─ Agent reads this → optimizes choices to align

HUMAN DIRECTION #2: CLAUDE.md (Project state + next action)
├─ "Status: Phase 2 multi-IA done, Phase 3 in progress"
├─ "Next: Configure OpenRouter/Gemini/Mistral keys"
├─ "Blocked: Stripe keys missing (Phase 5)"
└─ Agent reads this → knows constraints & bottlenecks

HUMAN DIRECTION #3: Environment variables (.env)
├─ GROQ_API_KEY=... ← human sets which AI to use
├─ RAPIDAPI_KEY=... ← human sets data source
├─ TELEGRAM_BOT_TOKEN=... ← human sets comms channel
└─ Agent uses these → no hardcoded decisions

HUMAN DIRECTION #4: Code reviews (before merge)
├─ Agent implements feature
├─ Human inspects: "Does this align with Priorité 1?"
├─ Human blocks if off-strategy
├─ Agent learns → next iteration better aligned
└─ Result: strategy preserved, execution delegated

HUMAN DIRECTION #5: Monitoring dashboards (ongoing)
├─ GA4 metrics: pick conversion, trafic sources
├─ Winrate chart: 78% current, target 80%
├─ Revenue: €X/day (Stripe), path to profitability?
└─ Human watches → detects anomalies → redirects agents
```

---

## 🚀 SUMMARY: KARPATHY PATTERNS CHECKLIST

| Pattern | TousLesMatchs Status | Action |
|---------|---------------------|--------|
| **Agentic Loop** | ✅ (Plan→Execute→Observe→Refine) | Extend to all 15 skills |
| **Three-File Contract** | 🟡 (Partial) | Explicit evaluators for #4, #8 |
| **Fallback Routing** | 🟡 (DeepSeek only) | Finish OpenRouter/Gemini/Mistral |
| **Token Optimization** | ❌ (Séquentiel) | Parallelize (MCP — Skill #15) |
| **Observable Metrics** | 🟡 (Partial GA4) | Complete with Redis + SQL audit |
| **Agent-Native Surfaces** | 🟡 (Partial API) | Add MCP server + CLI |
| **Human Oversight** | ✅ (HERMES_VISION governs all) | Maintain direction consistency |

---

**Hermès Skills Lab | 08/06/2026**
