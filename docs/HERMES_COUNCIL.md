# 🤖 HERMÈS & LE CONCILE DES IA

## Principe fondateur

Hermès n'est plus une IA parmi d'autres — c'est le **Conseil d'administration
des IA**. Il coordonne un pool d'agents (les "conseillers"), calcule un
consensus pondéré, et publie une décision unique. **Claude n'est plus le
décideur** : il est architecte et code, il n'arbitre plus les pronostics.

## Composition actuelle du Concile

### 🎯 IA officielles (votantes, publiées)
| Agent | Modèle | Rôle | Fichier |
|---|---|---|---|
| DeepSeek | deepseek-chat | Analyste | `council/agents/gpt_agent.py` |
| Gemini Flash | gemini-2.0-flash | Analyste | `council/agents/gemini_agent.py` |
| Mistral | mistral-large | Analyste | `council/agents/mistral_agent.py` |
| Groq/Llama3 | llama-3.3-70b | Analyste | `council/agents/groq_agent.py` |
| Claude Chief | claude-opus | ~~Décideur~~ → Contrôleur qualité (Phase 3) | `council/agents/claude_chief.py` |

### ⚪ IA blanches (banc d'essai, non publiées)
Testées en secret dans `shadow_evals`. Elles font des prédictions comme les autres,
mais leurs décisions ne sortent jamais du système tant qu'elles ne sont pas
promues.

**Critère de promotion** : ≥ 50 paris résolus **et** winrate > 55% pendant 30j.
**Critère de suppression** : ≥ 30 paris résolus **et** winrate < 45%.

### 🆕 IA candidates à intégrer
- **Qwen 2.5 72B** (Alibaba) — modèle chinois, prometteur sur data quant
- **Fugu** — modèle spécialisé sports (à évaluer)
- **DeepSeek-R1** — nouveau raisonnement chain-of-thought
- **Grok 2** (xAI) — alternative si tarification devient viable

Chaque nouvelle IA entre **obligatoirement en banc d'essai** (`shadow_evals`)
avant d'être promue au Concile officiel.

## Moteur de consensus (roadmap)

### Phase 1 ✅ (livrée le 14 juil 2026)
- `scripts/concile_engine.js` extrait de `api_server.js`
- Fonctions : `computeWeights()`, `computeConsensus()`, `buildAnalysisResult()`
- Comportement identique à avant (extraction pure, sans changement de logique)

### Phase 2 (à faire) — Poids dynamiques
Chaque agent reçoit un poids calculé automatiquement selon 3 facteurs :

```
poids = winrate_global × facteur_marché × facteur_ligue × facteur_recency
```

- **facteur_marché** : winrate spécifique de l'agent sur le type de pari (BTTS, Over 2.5, etc.)
- **facteur_ligue** : winrate spécifique sur la compétition (Ligue 1 vs Premier League vs NBA...)
- **facteur_recency** : décote de 5% pour toute performance datant de >90j

### Phase 3 (à faire) — Décision par calcul
Le Chief (Claude) **ne vote plus** : le pick final est déterminé mathématiquement
par le consensus pondéré. Le Chief se limite à :
- Vérifier la cohérence (garde-fous R1, R2, whitelist)
- Rédiger la note explicative pour l'affichage
- Alerter si consensus faible (< 65%)

## Traçabilité complète

Chaque décision publiée est stockée avec :
- `agents_json` : tous les votes individuels + confiance
- `raison` : synthèse rédigée par le Chief
- `minute_at_analysis` : moment exact du prono
- `score_home_at_analysis` / `score_away_at_analysis` : contexte du match
- `final_score_*` / `outcome` : résultat post-match

Cela permet un audit rétroactif de toute décision : *"pourquoi ce jour-là,
tel agent a voté ça, avec quel poids ?"*

## Rapports quotidiens

### Automatique (via `api_server.js`)
- **11h59 Paris** : Concile analyse le meilleur match du jour → publication Telegram
- **20h dimanche** : Bilan Signal Fort → gratuit + premium
- **23h Paris** : Rapport visiteurs → admin
- **Lundi 8h** : Rapport marketing hebdo → admin

### À la demande (endpoints admin)
- `/admin/daily-audit` — tous les pronos du jour + scores
- `/admin/full-agents-audit` — perf par IA, matrice IA×marché, meilleur agent
  par type de pari, envoi Telegram automatique
- `/admin/shadow-perf` — perf des IA blanches uniquement
- `/agent-market-matrix` — matrice complète accessible en JSON
- `/concile-performance` — boucle apprentissage détaillée

## Boucle vertueuse

```
┌─────────────────────────────────────────────────────────────┐
│  1. Chaque IA fait sa prédiction (agent_predictions)         │
│  2. Consensus pondéré → décision publiée                     │
│  3. Match se termine → autoResolvePredictions()             │
│  4. Outcome (win/loss) enregistré                            │
│  5. Poids recalculés (updateAgentWeights)                    │
│  6. IA sous-performantes → seuil détecté                     │
│  7. Suppression/rétrogradation auto (< 52% sur 30 résolus)   │
│  8. IA blanche prête à monter → promue au Concile officiel   │
└─────────────────────────────────────────────────────────────┘
```

## Règles gravées dans la pierre

- **R1** : Aucun prono avant la 35e min ni après la 75e minute
- **R2** : Aucun prono sur match à finalité connue (écart ≥ 3 buts)
- **R3** : Cotes plafonnées à 1.95 (formule EV-safe)
- **R4** : Signal Fort ≥ 85% de confiance seulement, cap 4/jour premium
- **R5** : Matchs femmes exclus (défense en 3 niveaux)
- **R6** : Coupe du Monde exclue
- **R7** : Whitelist stricte des ligues (TRUSTED_COMPETITIONS)

## Statistiques par marché

Le système suit séparément :
- **Over/Under 2.5** (`buts`)
- **BTTS** — Les 2 équipes marquent (`btts`)
- **Résultat 1X2** (`resultat`)
- **But 1ère mi-temps** (`mt1`)

Chaque IA a un winrate distinct par marché → matrice `agent_market_matrix`.
La Phase 2 exploitera cette matrice pour pondérer différemment selon le marché.

---

*Ce document est le cerveau prédictif. Toute nouvelle IA ou modification de
la logique de consensus doit y être répercutée.*
