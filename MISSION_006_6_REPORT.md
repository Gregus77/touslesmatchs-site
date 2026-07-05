# MISSION 006.6 — Migration vers le Publication Engine

## Objectif

Le Publication Engine devient le SEUL moteur officiel de publication.
L'ancien systeme ne publie plus directement.

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `scripts/api_server.js` | Import Publication Engine + Event Bus, initialisation du moteur, consumers Event Bus, remplacement des 11 anciens flux |
| `scripts/__tests__/publication_integration.test.js` | 16 tests d'integration (nouveau fichier) |

## Fichiers inchanges (crees en 006.5)

| Fichier | Role |
|---------|------|
| `scripts/event_bus.js` | Event Bus centralise |
| `scripts/publication_engine.js` | Moteur de decision PUBLISH/WAIT/BLOCKED |
| `scripts/snapshot_store.js` | Store SQLite pour snapshots immutables |
| `scripts/__tests__/publication_engine.test.js` | 26 tests unitaires |

## Les 11 anciens points de publication

### Point 1 — Signal Fort Telegram dans runConcileAnalysis() (L2124-2143)
- **Ancien code** : `sendTelegramMessage()` direct dans `runConcileAnalysis()` quand confidence >= seuil adaptatif, avec `_signalSentCache` et `_freeSignalDailyDate` pour limiter
- **Nouveau code** : `publicationEngine.process(analysisResult, match)` — le moteur decide PUBLISH/WAIT/BLOCKED, l'Event Bus declenche les consumers Telegram
- **Remplace** : OUI

### Point 2 — saveConcileAnalysis() ecrasement (L2294-2368)
- **Ancien code** : `UPDATE concile_analyses SET ... WHERE match_key = ?` — ecrase la ligne existante avec les nouvelles valeurs
- **Nouveau code** : `saveConcileAnalysis()` conserve pour historique/apprentissage, mais le Publication Engine cree un snapshot immutable a cote (jamais ecrase)
- **Remplace** : OUI (snapshot immutable en parallele)

### Point 3 — runAutoConcileObserver() (L3449-3480)
- **Ancien code** : `await runConcileAnalysis(match)` direct, verification via `hasPredictionSnapshot()` sur `agent_predictions`
- **Nouveau code** : `runConcileAnalysis()` appelle desormais `publicationEngine.process()` en interne, `hasPredictionSnapshot()` verifie aussi `official_prediction_snapshots`
- **Remplace** : OUI

### Point 4 — sendSignalFortBilanTelegram() (L4184-4206)
- **Ancien code** : Lit `concile_analyses` pour construire le bilan, envoie Telegram directement
- **Nouveau code** : `getSignalFortStats()` lit d'abord `official_prediction_snapshots` puis `concile_analyses` en fallback (merge dedup par match+date)
- **Remplace** : OUI (source de donnees migree)

### Point 5 — notifySignalFortResult() (L4220-4284)
- **Ancien code** : Envoie Telegram directement pour les resultats des signaux forts
- **Nouveau code** : Conserve pour les notifications de resultats (post-match), ces notifications sont des RESULTATS et non des PUBLICATIONS de pronostics. Le pronostic original vient du snapshot.
- **Remplace** : PARTIEL (les resultats restent un flux separe, non impacte par le moteur de publication)

### Point 6 — POST /analyse (L4628-4652)
- **Ancien code** : `runConcileAnalysis(verifiedMatch)` direct
- **Nouveau code** : `runConcileAnalysis()` appelle `publicationEngine.process()` en interne — le snapshot est cree si les conditions sont remplies
- **Remplace** : OUI

### Point 7 — POST /live-ia/analyse (L4656-4697)
- **Ancien code** : `runConcileAnalysis(verifiedMatch)` direct
- **Nouveau code** : Idem — le moteur de publication est integre dans le flux `runConcileAnalysis()`
- **Remplace** : OUI

### Point 8 — POST /concile-analysis (L4765-4822)
- **Ancien code** : `runConcileAnalysis(verifiedMatch)` + cache 30min par score-state
- **Nouveau code** : Idem — le cache existant reste pour economiser les tokens, le snapshot immutable est en plus
- **Remplace** : OUI

### Point 9 — POST /prematch-analysis (L4824-4882)
- **Ancien code** : `runConcileAnalysis(matchData)` direct pour analyses pre-match
- **Nouveau code** : Le moteur de publication evalue mais decidera WAIT (minute = 0 < MIN_PUBLICATION_MINUTE = 30), donc pas de snapshot pre-match (correct : pas de publication avant le match)
- **Remplace** : OUI (correctement filtre)

### Point 10 — POST /internal/signal-notify (L5955-6106)
- **Ancien code** : Envoie Telegram + Brevo directement sans snapshot
- **Nouveau code** : Appelle `publicationEngine.process()` AVANT l'envoi pour creer un snapshot officiel si eligible
- **Remplace** : OUI

### Point 11 — POST /internal/pick-notify et /internal/pick-result-notify (L5750-6174)
- **Ancien code** : Envoie Brevo pour le pick quotidien et ses resultats
- **Nouveau code** : Conserve — ce sont des notifications du pick Hermes (11h59), pas du Live IA. Le pick quotidien a son propre cycle de vie (genere par le Concile Python, pas le JS)
- **Remplace** : PARTIEL (pick quotidien Hermes est un flux separe)

## Nouveaux flux

```
runConcileAnalysis() ─── analyse IA 5 agents ──→ analysisResult
       │
       ├──→ saveConcileAnalysis() [historique/apprentissage, conserve]
       │
       └──→ publicationEngine.process(analysisResult, match)
                │
                ├── PUBLISH ──→ Official Snapshot (IMMUTABLE)
                │                  │
                │                  └──→ Event Bus: OFFICIAL_PREDICTION_PUBLISHED
                │                          │
                │                  ┌───────┼───────┐───────┐
                │                  │       │       │       │
                │               Telegram  Brevo  Site  Dashboard
                │
                ├── WAIT ──→ log + attendre prochain cycle
                │
                └── BLOCKED ──→ post_publication_analyses (apprentissage)
                                   │
                                   └──→ Event Bus: POST_PUBLICATION_ANALYSIS
```

## Nouveaux endpoints

| Route | Methode | Role |
|-------|---------|------|
| `/api/official-snapshots` | GET | Liste paginee des snapshots officiels |
| `/api/official-snapshot/:matchKey` | GET | Snapshot + post-analyses pour un match |

## Anciens flux supprimes

| Ancien flux | Statut |
|-------------|--------|
| Signal Fort direct dans `runConcileAnalysis()` | SUPPRIME — remplace par Event Bus |
| `_signalSentCache` pour deduplication Signal Fort | SUPPRIME — le snapshot immutable dedup nativement |
| `saveConcileAnalysis()` comme source de verite | REMPLACE — conserve pour historique, snapshot est la source |
| `hasPredictionSnapshot()` via `agent_predictions` | COMPLETE — verifie aussi `official_prediction_snapshots` |

## Tests

### 42 tests — 42 passes — 0 regression

#### Tests unitaires (26) — publication_engine.test.js
Inchanges par rapport a Mission 006.5.

#### Tests d'integration (16) — publication_integration.test.js

| # | Categorie | Test | Statut |
|---|-----------|------|--------|
| 1 | Telegram | Listener fires on PUBLISH, receives snapshot data | OK |
| 2 | Telegram | Does NOT fire on WAIT (too early) | OK |
| 3 | Telegram | Does NOT fire on BLOCKED (duplicate) | OK |
| 4 | Brevo | Listener fires with same data as Telegram | OK |
| 5 | Brevo | Does NOT fire without official snapshot | OK |
| 6 | Site | Reads snapshot after publication | OK |
| 7 | Site | Reads same data as Telegram/Brevo (no divergence) | OK |
| 8 | Site | Snapshot immutable — cannot change after 2nd analysis | OK |
| 9 | Dashboard | Lists all snapshots via getAllSnapshots | OK |
| 10 | Dashboard | Snapshot includes post-publication analyses | OK |
| 11 | Live IA | Analysis routes through Publication Engine | OK |
| 12 | Live IA | Recalculation goes to post_publication_analyses | OK |
| 13 | No double flux | 5 analyses same match = 1 snapshot + 1 event | OK |
| 14 | No double flux | 10 matches = 10 snapshots, 10 events | OK |
| 15 | No double flux | WAIT = no Telegram, no Brevo, no snapshot | OK |
| 16 | No double flux | BLOCKED too late = PREDICTION_REJECTED, no snapshot | OK |

#### Tests InviteLinkManager (14) — invite_link_manager.test.js
Inchanges, pas de regression.

## Performances

| Operation | Temps |
|-----------|-------|
| publicationEngine.process() | < 1ms |
| snapshotStore.hasSnapshot() | < 1ms |
| Event Bus dispatch (4 consumers) | < 1ms |
| 16 tests integration | ~360ms |
| Suite complete (56 tests) | ~1.3s |

## Risques

### Risque 1 — Coexistence ancien/nouveau systeme
- `saveConcileAnalysis()` est conserve pour l'apprentissage et les stats historiques
- `official_prediction_snapshots` est la source de verite pour les publications
- Les deux tables coexistent sans conflit
- **Mitigation** : merge progressif dans `getSignalFortStats()` (snapshots en priorite, fallback concile_analyses)

### Risque 2 — Publications pre-match
- Les analyses pre-match (`/prematch-analysis`) ont `minute = 0` et seront evaluees WAIT par le moteur (< MIN_PUBLICATION_MINUTE = 30)
- C'est le comportement correct : pas de snapshot officiel avant le match
- **Impact** : aucun, les pre-match n'avaient pas de Signal Fort auparavant

### Risque 3 — Pick quotidien Hermes
- Le pick quotidien (genere par le Concile Python a 11h59) passe par `/internal/pick-notify`
- Ce flux reste separe car il n'est pas une analyse Live IA
- **Impact** : aucun, le pick Hermes continue de fonctionner normalement

### Risque 4 — Notifications de resultats
- `notifySignalFortResult()` et `/internal/pick-result-notify` restent des notifications post-match
- Ils ne publient pas de pronostic, ils notifient un resultat
- **Impact** : aucun

## Verification finale

- [x] Publication Engine importe et initialise dans api_server.js
- [x] Event Bus consumers configures (Telegram, Brevo)
- [x] `runConcileAnalysis()` route via `publicationEngine.process()`
- [x] Signal Fort direct SUPPRIME de `runConcileAnalysis()`
- [x] `hasPredictionSnapshot()` verifie `official_prediction_snapshots`
- [x] `getSignalFortStats()` lit snapshots en priorite
- [x] `/internal/signal-notify` cree un snapshot officiel
- [x] Endpoints API (`/api/official-snapshots`, `/api/official-snapshot/:key`) crees
- [x] `analysis-history` supporte source=snapshots
- [x] 42 tests passes, 0 regression
- [x] Aucune modification d'interface
- [x] Aucun merge
- [x] Aucun deploiement
