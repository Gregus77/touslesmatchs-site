# 🔬 HERMÈS SKILLS LAB — AUDIT & SÉLECTION FINALE
**Touslesmatchs.com — Sélection de 10-15 Skills Optimales**

---

## 📋 MÉTHODOLOGIE

Cet audit applique les **méthodologies Andrej Karpathy** (2024-2026) au projet TousLesMatchs :

### Principes Karpathy appliqués :
1. **Agentic Engineering** — agents orchestrés, pas vibe-coding
2. **Three-File Contract** — evaluator (immutable) / implementation (agent-editable) / direction (human)
3. **Plan → Execute → Observe → Refine** — boucles de feedback strictes
4. **Fallback Routing** — multi-agents avec alternatives en cascade
5. **Token Optimization** — pas d'idle tokens, macro-actions déléguées
6. **Agent-Native Surfaces** — Markdown docs, CLI, APIs, MCP servers

---

## 🎯 ÉTAT ACTUEL (04/06/2026)

### ✅ Ce qui fonctionne
- Multi-IA avec fallback (DeepSeek → OpenRouter → Gemini → Mistral)
- Orchestration RapidAPI → Groq → IA → Telegram
- Bot multilingue (FR/EN/ES/IT/RU)
- React responsive + Caddy HTTPS
- Filtre ARJEL (Winamax, Betclic, Unibet, PMU)
- Anti-doublon & notation 7-10

### 🔄 En cours (Phase 2-3)
- Analyse Live V2 (simplification UI)
- Config OpenRouter/Gemini/Mistral au .env VPS

### ⏳ À faire (Phase 4-6)
- Stripe paiement
- Comptes utilisateurs
- Quotas (Free/Premium/VIP)
- Analytics avancées
- Croissance SEO/TikTok

---

## 📊 ANALYSE DES BESOINS

| Phase | Besoin | Type | Critère Karpathy |
|-------|--------|------|------------------|
| **2-3** | Orchestration multi-IA robuste | Agentic | Fallback routing ✓ |
| **3** | Analyse Live auto-enrichie | Agent | Plan+Execute+Observe |
| **4** | Gestion comptes utilisateurs | Systemic | Three-file contract |
| **5** | Paiement + Webhook | Integration | Agent-native surfaces |
| **6** | Quotas dynamisés | Logic | Plan+Observe+Refine |
| **∞** | Monitoring Hermès | Autonomous | AutoResearch pattern |
| **∞** | Apprentissage (wins/losses) | Feedback | Reflection loop |
| **∞** | Analytics temps-réel | Metrics | Evaluation immutable |

---

## 🎓 10-15 SKILLS SÉLECTIONNÉS

### Tier 1 : CRITIQUE (5 skills)
Ces skills sont **fondamentaux** pour le bon fonctionnement. Aucune n'est substituable.

#### **Skill #1 : Agentic Orchestrator — Multi-IA Fallback**
- **Rôle** : Orchestrer DeepSeek, OpenRouter, Gemini, Mistral en cascade
- **Implémentation** : `scripts/multi_agent.js` (existant) + robustification
- **Pattern Karpathy** : Fallback routing + token optimization
- **Mesure de succès** : Aucune requête IA ne doit échouer (fallback = 100%)
- **Immutable Evaluator** : `scripts/verify_apis.js` — test chaque provider
- **Agent-Editable** : Logique routing dans `multi_agent.js`
- **Human Direction** : `.env` + `HERMES_VISION.md`

**Status**: 🟡 Partiellement déployé — nécessite clés OpenRouter/Gemini/Mistral configurées

---

#### **Skill #2 : RapidAPI Data Fetcher — Scraper de matches**
- **Rôle** : Récupérer données matchs (ligues, horaires, cotes, blessures)
- **Implémentation** : Endpoint RapidAPI (existant) + caching intelligent
- **Pattern Karpathy** : Observation stricte (pas d'hallucination data)
- **Mesure de succès** : 100% des matchs du jour détectés, 0% donnée manquante
- **Immutable Evaluator** : Validation schéma RapidAPI contre ARJEL whitelist
- **Agent-Editable** : Requête RapidAPI + filtrage dynamique
- **Human Direction** : Liste ARJEL_LIGUES + ARJEL_NATIONS dans `config.js`

**Status**: ✅ Stable

---

#### **Skill #3 : Groq Odds Enricher — Cotes intelligentes**
- **Rôle** : Enrichir cotes RapidAPI avec probabilités Groq/Llama3
- **Implémentation** : Call Groq API (existant) + cache résultats
- **Pattern Karpathy** : Détection anomalies (Groq vs RapidAPI)
- **Mesure de succès** : Cotes cohérentes (écart < 10% vs marchés réels)
- **Immutable Evaluator** : Comparaison cotes Groq vs benchmarks Pinnacle
- **Agent-Editable** : Prompt Groq (température, top_p, max_tokens)
- **Human Direction** : Seuil confiance min 0.7, écart tolé 0.05

**Status**: ✅ Stable

---

#### **Skill #4 : Pick Selection AI — Chef de projet (DeepSeek)**
- **Rôle** : Sélectionner 1 pick/jour avec note 7-10, éviter doublons
- **Implémentation** : DeepSeek API (existant) + deduplication logic
- **Pattern Karpathy** : Three-file contract + reflection
- **Mesure de succès** : Winrate 78%+, 1 seul pick/jour, zéro doublon
- **Immutable Evaluator** : 
  - `metrics/winrate.json` (historique wins/losses)
  - Validation note 7-10, pas de doublon (dedup logic)
- **Agent-Editable** : Prompt à DeepSeek pour sélection
- **Human Direction** : Priorité winrate > volume

**Status**: ✅ Stable (78% winrate actuellement)

---

#### **Skill #5 : Telegram Multi-Channel Broadcaster**
- **Rôle** : Notifier canal gratuit + premium privé (quand Stripe en place)
- **Implémentation** : `scripts/bot.js` (existant) + routing intelligent
- **Pattern Karpathy** : Observable output (chaque notification tracée)
- **Mesure de succès** : 100% picks postés, 0% erreur API TG
- **Immutable Evaluator** : Log chaque broadcast (date, canal, contenu)
- **Agent-Editable** : Format message (FR/EN/ES/IT/RU)
- **Human Direction** : Ton professionnel, disclaimers 18+ obligatoires

**Status**: ✅ Stable (FR/EN/ES/IT/RU actif)

---

### Tier 2 : HAUTE PRIORITÉ (4 skills)
Nécessaires pour les phases 3-4 (Analyse Live, comptes utilisateurs).

#### **Skill #6 : Analyse Live V2 — Agent autonome**
- **Rôle** : Enrichir auto matchs en live (probabilités Over/BTTS/1X2 temps réel)
- **Implémentation** : Nouveau endpoint `/api/analyse-live` + WebSocket updates
- **Pattern Karpathy** : Plan (match ID) → Execute (Groq) → Observe (résultats) → Refine
- **Mesure de succès** : 
  - Affichage < 2s après requête
  - Probabilités ± 5% de réalité marché
  - Zéro erreur 404 match_id
- **Immutable Evaluator** : 
  - Comparaison probs vs Paris réels (Betfair, Pinnacle)
  - Validation match_id contre RapidAPI
- **Agent-Editable** : Prompt Groq pour probs dynamiques
- **Human Direction** : UI simplifie (cacher compétition/score/minute auto)

**Status**: 🔄 Phase 3 en cours

---

#### **Skill #7 : User Accounts Manager — CRUD comptes**
- **Rôle** : Inscription, authentification, gestion statuts (Free/Premium/VIP)
- **Implémentation** : Backend Node.js + MongoDB/PostgreSQL
- **Pattern Karpathy** : Database immutable (audit trail complet)
- **Mesure de succès** :
  - Inscription < 5 secondes
  - Zéro doublon emails
  - Statuts cohérents (Free → Premium → VIP ou dégradation)
- **Immutable Evaluator** : 
  - `schema.sql` ou Mongoose schema (inviolable)
  - Audit log (all mutations)
- **Agent-Editable** : Logique métier activation/révocation droits
- **Human Direction** : RGPD compliance, pas de données sensibles en logs

**Status**: ⏳ Phase 4 (non implémenté)

---

#### **Skill #8 : Stripe Payment Engine**
- **Rôle** : Gérer abonnements (Free/Premium 19.90€, VIP futur), webhooks
- **Implémentation** : Stripe API + webhook `/webhooks/stripe`
- **Pattern Karpathy** : Transaction immutable (jamais rollback sans audit)
- **Mesure de succès** :
  - Paiement < 3s
  - Zéro transaction perdue
  - Webhook failover (retry exponential)
  - Activation compte post-paiement < 1s
- **Immutable Evaluator** : 
  - Transaction log (all payments)
  - Réconciliation daily Stripe ↔ DB
- **Agent-Editable** : Pricing, champs formulaire, email confirmations
- **Human Direction** : Clés séparées test/prod, PCI compliance

**Status**: ⏳ Phase 5 (clés manquantes)

---

#### **Skill #9 : Analytics & Metrics Engine**
- **Rôle** : Tracker GA4 + événements custom + dashboards temps-réel
- **Implémentation** : GA4 (existant) + événements custom + Plausible optionnel
- **Pattern Karpathy** : Métriques immutables (audit-trail complet)
- **Mesure de succès** :
  - GA4 events tracés : inscriptions, clics Stripe, analyses live
  - Latency dashboards < 5s refresh
  - Cohérence data (GA4 ≈ DB logs)
- **Immutable Evaluator** : 
  - GA4 event schema (obligatoire)
  - Daily data reconciliation
- **Agent-Editable** : Dashboards, alertes, rapports
- **Human Direction** : Privacy first (anonymized IPs, GDPR)

**Status**: 🟡 GA4 intégré mais metrics custom incomplets

---

#### **Skill #10 : Quota Manager — Limiter usage par tier**
- **Rôle** : Free (3/jour) vs Premium (10/jour) vs VIP (∞)
- **Implémentation** : Middleware Express + Redis cache
- **Pattern Karpathy** : Counter immutable (Redis keys never rollback)
- **Mesure de succès** :
  - Dépassement quota = 429 TooManyRequests
  - Reset daily à 00h UTC
  - Latency check < 50ms
- **Immutable Evaluator** : Redis audit log (all quota checks)
- **Agent-Editable** : Limites par tier, reset schedule
- **Human Direction** : Graceful degradation (suggérer upgrade)

**Status**: ⏳ Phase 6 (non implémenté)

---

### Tier 3 : FUTUR/OPTIMIZATION (3 skills)
Pour croissance et stabilité long-terme.

#### **Skill #11 : AutoResearch Hermes — Learning Loop**
- **Rôle** : Agent autonome analyse wins/losses → identifie patterns → propose améliorations
- **Implémentation** : `scripts/hermes_learn.js` + daily cronjob
- **Pattern Karpathy** : AutoResearch à la Karpathy (experiment → evaluate → iterate)
- **Mesure de succès** :
  - Winrate improve +1-2% par mois
  - Nouvelles ligues rentables détectées
  - Zero hallucinations (pas de fake patterns)
- **Immutable Evaluator** : 
  - `metrics/results.json` (historique picks) — immutable
  - Backtesting framework (`backtester.js`)
- **Agent-Editable** : Hypothèses à tester (nouvelles ligues, modèles, seuils)
- **Human Direction** : Seuil significativité 100+ picks minimum

**Status**: 🟡 Partiellement implémenté (`hermes_learn.js` existe)

---

#### **Skill #12 : SEO & Content Optimizer**
- **Rôle** : Générer articles blog, optimiser meta tags, sitemap, structured data
- **Implémentation** : `scripts/seo_generator.js` + webhook trigger
- **Pattern Karpathy** : Observation marché (concurrents + tendances)
- **Mesure de succès** :
  - Trafic organique +20% / trimestre
  - Top 3 Google "pronostics foot IA"
  - CTR from SERPs > 5%
- **Immutable Evaluator** : SEO audit (PageSpeed, mobile, Core Web Vitals)
- **Agent-Editable** : Topics à couvrir, keywords, interlinking
- **Human Direction** : Tone guide, fact-checking articles

**Status**: ❌ Non implémenté

---

#### **Skill #13 : TikTok & Social Auto-Poster**
- **Rôle** : Post vidéos buts/highlights 5-8s daily sur TikTok (free sources)
- **Implémentation** : `scripts/tiktok_poster.js` + free video API
- **Pattern Karpathy** : Observable metrics (views, shares, follows)
- **Mesure de succès** :
  - 1 post/jour
  - Avg 50K views/post (3 mois)
  - CTR to site > 2%
- **Immutable Evaluator** : Analytics TikTok (engagement rate)
- **Agent-Editable** : Video selection, captions (FR/EN), hashtags
- **Human Direction** : Brand voice (hype, confiant, pronostic-focused)

**Status**: ⏳ Phase 3 (vidéos + API non préparées)

---

#### **Skill #14 : Monitoring & Alerting — Hermès Supervisor**
- **Rôle** : Supervision 24/7 (health checks, anomalies, revenus)
- **Implémentation** : Monitoring agent (cronjob chaque heure)
- **Pattern Karpathy** : Observable alerting (humain directs agents)
- **Mesure de succès** :
  - Anomalie détectée < 10min
  - Faux positifs < 5%
  - Escalade auto (email/Telegram alertes)
- **Immutable Evaluator** : Health check results (immutable log)
- **Agent-Editable** : Thresholds alertes (winrate, latency, API errors)
- **Human Direction** : On-call runbooks pour chaque alerte

**Status**: 🟡 Monitoring basique existant, alerting à enrichir

---

#### **Skill #15 : Parallel Agent Executor — MCP Server**
- **Rôle** : Exécuter agents **en parallèle** (Karpathy parallelization)
- **Implémentation** : MCP server Node.js + worker pool
- **Pattern Karpathy** : Token optimization (0 idle tokens, parallel execution)
- **Mesure de succès** :
  - Throughput x3-5 vs séquentiel
  - Latency < 30s (vs 60s+ actuellement)
- **Immutable Evaluator** : Timing logs (every agent execution)
- **Agent-Editable** : Parallel task decomposition
- **Human Direction** : Max workers = 4 (VPS Hostinger limit)

**Status**: ❌ Non implémenté (future optimization)

---

---

## 🗂️ RÉSUMÉ FINAL : 15 SKILLS

| # | Skill | Tier | Status | Phase | Impacт |
|---|-------|------|--------|-------|--------|
| 1 | Agentic Orchestrator (Multi-IA) | CRITIQUE | 🟡 Partial | 2-3 | Robustesse core |
| 2 | RapidAPI Data Fetcher | CRITIQUE | ✅ Stable | 0 | Data source |
| 3 | Groq Odds Enricher | CRITIQUE | ✅ Stable | 0 | Quality predictions |
| 4 | Pick Selection AI (DeepSeek) | CRITIQUE | ✅ Stable | 1 | Main business |
| 5 | Telegram Broadcaster | CRITIQUE | ✅ Stable | 1 | User engagement |
| 6 | Analyse Live V2 | HAUTE PRIO | 🔄 In progress | 3 | Premium feature |
| 7 | User Accounts Manager | HAUTE PRIO | ⏳ Planned | 4 | Authentication |
| 8 | Stripe Payment Engine | HAUTE PRIO | ⏳ Planned | 5 | Monetization |
| 9 | Analytics & Metrics | HAUTE PRIO | 🟡 Partial | 2-6 | Measurement |
| 10 | Quota Manager | HAUTE PRIO | ⏳ Planned | 6 | Freemium model |
| 11 | AutoResearch Learning | FUTUR | 🟡 Partial | ∞ | Improvement loop |
| 12 | SEO & Content | FUTUR | ❌ Pending | 3 | Growth |
| 13 | TikTok Auto-Poster | FUTUR | ❌ Pending | 3 | Viral growth |
| 14 | Monitoring & Alerting | FUTUR | 🟡 Partial | ∞ | Reliability |
| 15 | Parallel Executor (MCP) | FUTUR | ❌ Pending | 3+ | Performance |

---

## 🚀 PLAN D'INTÉGRATION

### Phase 2.5 (Cette semaine — 10/06)
```
1. Agentic Orchestrator
   ↳ Configurer OpenRouter API + clés .env
   ↳ Tester `node scripts/verify_apis.js` chaque provider
   ↳ Merger branche test multi-IA en production
   
2. Analytics Integration
   ↳ GA4 events custom : "pick_viewed", "subscribe_clicked"
   ↳ Dashboard Looker Studio pour metrics temps-réel
```

### Phase 3 (Semaine prochaine — 17/06)
```
3. Analyse Live V2
   ↳ API endpoint `/api/analyse-live?match_id=XXX`
   ↳ UI simplifie (masquer éléments auto-complétés)
   ↳ WebSocket updates probabilités temps-réel
   
4. SEO & TikTok Prep
   ↳ Articles blog starters (top 10 meilleures ligues)
   ↳ Video API integration (highlight sources)
```

### Phase 4-5 (Avancer — 24/06+)
```
5. User Accounts
   ↳ Schema MongoDB + API CRUD
   ↳ JWT auth middleware
   
6. Stripe
   ↳ Checkout page + webhook receiver
   ↳ Activation Premium post-payment
   
7. Quota Manager
   ↳ Redis counter + middleware Express
```

### Phase 6+ (Stabilité)
```
8. AutoResearch + Monitoring
   ↳ Daily learning cronjob
   ↳ Health checks + alerting
   
9. Parallelization
   ↳ MCP server worker pool
   ↳ Benchmark vs séquentiel
```

---

## ⚙️ KARPATHY PATTERNS — CHECKLIST

✅ = Appliqué  |  🟡 = Partial  |  ❌ = Manquant

| Pattern | Skill | Status | Action |
|---------|-------|--------|--------|
| **Agentic Loop** | All | ✅ | Boucles Plan→Execute→Observe implantées |
| **Fallback Routing** | #1 | 🟡 | Finir config multi-IA (OpenRouter/Gemini/Mistral) |
| **Three-File Contract** | #4, #8 | 🟡 | Explicit evaluators pour picks & payments |
| **Token Optimization** | #15 | ❌ | Parallelization future (MCP) |
| **Observable Metrics** | #9 | 🟡 | GA4 events, ajouter custom events |
| **Agent-Native Surfaces** | All | 🟡 | CLI + MCP server à finaliser |
| **Human Oversight** | All | ✅ | HERMES_VISION + CLAUDE.md directeurs |

---

## 📈 SUCCESS METRICS

### Court terme (2 semaines)
- [ ] Multi-IA fully routed (0 API timeouts)
- [ ] GA4 dashboard live avec metrics custom
- [ ] Analyse Live V2 tested & working

### Moyen terme (1 mois)
- [ ] Stripe intégré (test payment OK)
- [ ] Comptes utilisateurs (inscription possible)
- [ ] SEO articles publiés (5+ top pages)

### Long terme (3 mois)
- [ ] Winrate 80%+ (via AutoResearch)
- [ ] Trafic organique +30% (SEO)
- [ ] 1K premium subscribers (Stripe conversions)
- [ ] TikTok 100K followers (viral growth)

---

## 🎓 PROCHAINES ACTIONS (Immédiates)

1. **Configurer multi-IA** (2h)
   - Ajouter `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY` au `.env` VPS
   - Tester `node scripts/verify_apis.js`

2. **GA4 events custom** (1h)
   - Ajouter event `pick_viewed` au clic pick
   - Ajouter event `subscribe_clicked` au CTA Premium

3. **Analyse Live V2 design** (2h)
   - Design Figma : masquer compétition/score/minute (auto)
   - Afficher : probabilités Over/BTTS/1X2 en couleurs (vert/jaune/rouge)

---

**Hermès Skills Lab | 08/06/2026**
