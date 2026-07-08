# MISSION 006.5 — Moteur de Publication Intelligent

## Architecture

### Probleme resolu

Site, Telegram, Brevo et Dashboard affichaient des pronostics differents pour le meme match.
Cause : chaque canal recalculait independamment avec des donnees differentes (minute, score).

### Solution : Official Prediction Snapshot

```
API Match
    |
    v
Concile IA (runConcileAnalysis)
    |
    v
Publication Engine (evaluatePublication)
    |
    +--[WAIT]-----> attendre prochain cycle
    |
    +--[BLOCKED]--> trop tard ou snapshot existant
    |                   |
    |                   v
    |               post_publication_analyses (apprentissage)
    |
    +--[PUBLISH]--> Official Snapshot (IMMUTABLE)
                        |
                        v
                    Event Bus
                    (OFFICIAL_PREDICTION_PUBLISHED)
                        |
            +-----------+-----------+-----------+
            |           |           |           |
            v           v           v           v
        Telegram     Brevo      Site      Dashboard
```

### Modules crees

| Fichier | Role | Lignes |
|---------|------|--------|
| `scripts/event_bus.js` | Event Bus centralisé (EventEmitter + historique) | 40 |
| `scripts/publication_engine.js` | Moteur de decision PUBLISH/WAIT/BLOCKED | 90 |
| `scripts/snapshot_store.js` | Store SQLite pour snapshots immutables + post-analyses | 160 |
| `scripts/__tests__/publication_engine.test.js` | Suite de tests complete | 310 |

## Decisions techniques

### 1. Source de verite unique

La table `official_prediction_snapshots` est la SEULE source lue par tous les consommateurs.
Contrainte `UNIQUE` sur `match_key` : impossible de creer deux snapshots pour le meme match.

### 2. Immutabilite

Un snapshot publie ne peut JAMAIS etre modifie. Toute tentative de re-creation leve une exception.
Le champ `locked = 1` est toujours set a la creation.

### 3. Post-publication analyses

L'IA continue d'analyser apres publication. Les recalculs vont dans `post_publication_analyses` (table separee).
Ils servent uniquement a l'apprentissage et aux statistiques, jamais a modifier le snapshot.

### 4. Event Bus

Pattern pub/sub via EventEmitter. Trois evenements :
- `OFFICIAL_PREDICTION_PUBLISHED` : un snapshot est cree
- `POST_PUBLICATION_ANALYSIS` : une analyse post-publication est enregistree
- `PREDICTION_REJECTED` : une analyse a ete refusee (trop tard)

Chaque consommateur (Telegram, Brevo, site, dashboard) ecoute le meme evenement et recoit les memes donnees.

### 5. Regles de publication configurables

| Variable | Default | Description |
|----------|---------|-------------|
| `MIN_PUBLICATION_MINUTE` | 30 | Pas de publication avant la 30' |
| `MAX_PUBLICATION_MINUTE` | 75 | Pas de publication apres la 75' |
| `MIN_CONFIDENCE` | 65 | Confiance minimum pour publier |
| `MIN_CONSENSUS` | 3 | Minimum 3/5 agents d'accord |
| `PUBLICATION_INTERVAL_MINUTES` | 5 | Intervalle entre analyses |

## Schema de la base de donnees

### official_prediction_snapshots

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| match_key | TEXT UNIQUE | Cle unique du match |
| match_id | TEXT | ID source (API-Sports) |
| competition | TEXT | Ligue / competition |
| sport | TEXT | Football, Basketball, etc. |
| home / away | TEXT | Equipes |
| minute_at_publication | INTEGER | Minute du match au moment de la publication |
| score_home / score_away | INTEGER | Score au moment de la publication |
| market | TEXT | Categorie (goals, btts, result, half_time) |
| selection | TEXT | Le pronostic (ex: "Under 2.5 buts") |
| confidence | INTEGER | Confiance 0-100 |
| consensus_votes | INTEGER | Nombre d'agents en accord |
| total_agents | INTEGER | Nombre total d'agents |
| raison | TEXT | Explication du pronostic |
| agents_json | TEXT | Detail par agent (JSON) |
| odds | REAL | Cote calculee (max 1.95) |
| version | INTEGER | Version du snapshot (toujours 1) |
| status | TEXT | published |
| published_by | TEXT | publication_engine |
| created_at | TEXT | Datetime de creation |
| locked | INTEGER | 1 = immutable |

### post_publication_analyses

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| match_key | TEXT FK | Reference vers le snapshot |
| minute_at_analysis | INTEGER | Minute du recalcul |
| score_home / score_away | INTEGER | Score au moment du recalcul |
| market | TEXT | Categorie |
| selection | TEXT | Nouveau pronostic (peut differer) |
| confidence | INTEGER | Nouvelle confiance |
| consensus_votes | INTEGER | Nouveau consensus |
| agents_json | TEXT | Detail agents |
| raison | TEXT | Explication |
| created_at | TEXT | Datetime |

## Performances

| Operation | Temps |
|-----------|-------|
| createSnapshot | < 1ms (SQLite in-memory) |
| hasSnapshot | < 1ms (index UNIQUE) |
| evaluatePublication | < 1ms (logique pure) |
| 100 snapshots simultanes | ~45ms |
| Suite de tests complete | ~450ms |

## Tests

### 26 tests — 26 passes — 0 regression

| # | Categorie | Test | Statut |
|---|-----------|------|--------|
| 1 | Rules | Publication avant 30' refusee | OK |
| 2 | Rules | Publication a 29' refusee | OK |
| 3 | Rules | Publication a 30' exactement acceptee | OK |
| 4 | Rules | Publication apres 75' refusee | OK |
| 5 | Rules | Publication a 75' exactement acceptee | OK |
| 6 | Rules | Confiance insuffisante refusee | OK |
| 7 | Rules | Consensus faible refuse | OK |
| 8 | Rules | Publication valide (tous criteres OK) | OK |
| 9 | Rules | Snapshot existant = bloque (immutable) | OK |
| 10 | Engine | Cree snapshot sur publication valide | OK |
| 11 | Engine | Snapshot immutable — 2e publication bloquee | OK |
| 12 | Engine | Post-publication analysis sauvegardee | OK |
| 13 | Engine | Event OFFICIAL_PREDICTION_PUBLISHED emis | OK |
| 14 | Engine | Event POST_PUBLICATION_ANALYSIS emis | OK |
| 15 | Engine | Event PREDICTION_REJECTED emis (trop tard) | OK |
| 16 | Engine | Reprise apres restart — snapshot persiste | OK |
| 17 | Engine | Config custom via env variables | OK |
| 18 | Engine | Callback onPublish appele | OK |
| 19 | Store | createSnapshot stocke les bonnes donnees | OK |
| 20 | Store | Duplicate snapshot leve exception (immutabilite) | OK |
| 21 | Store | getSnapshot retourne null si inconnu | OK |
| 22 | Store | hasSnapshot retourne true/false | OK |
| 23 | Store | getAllSnapshots avec pagination | OK |
| 24 | Store | Post-publication analyses s'accumulent | OK |
| 25 | Store | 100 matchs simultanes — 100 snapshots uniques | OK |
| 26 | EventBus | Telegram, Brevo, Site, Dashboard lisent le meme snapshot | OK |

## Impact sur le code existant

### Ce qui change (a l'integration)

1. `runAutoConcileObserver()` appellera `PublicationEngine.process()` au lieu d'envoyer directement sur Telegram
2. Les endpoints Live IA liront `official_prediction_snapshots` au lieu de recalculer
3. Le Signal Fort passera par l'Event Bus
4. `saveConcileAnalysis()` ne sera plus ecrasee — les recalculs iront dans `post_publication_analyses`

### Ce qui ne change PAS

- `runConcileAnalysis()` reste identique (calcul IA)
- Les agents IA ne changent pas
- Les endpoints API restent les memes
- Le frontend ne change pas
- Stripe, Brevo, analytics ne changent pas

## Migration

1. La table `official_prediction_snapshots` est creee automatiquement au premier `new SnapshotStore(db)`
2. La table `post_publication_analyses` est creee en meme temps
3. Les donnees existantes dans `concile_analyses` ne sont pas touchees
4. Les deux systemes peuvent coexister pendant la transition

## Risques

- **Aucun risque de regression** : les modules sont autonomes, non connectes a l'existant
- **Migration progressive** : l'integration dans api_server.js se fera en branchant le PublicationEngine sur le flux existant
- **Rollback simple** : supprimer les imports et les tables suffit
