# MISSION 004 — Event Bus

**Branche :** `feature/event-bus`
**Perimetre :** Infrastructure Event Bus centrale (aucune connexion Brevo, Telegram, Dashboard)

---

## Architecture

```
Stripe
    |
    v
Subscription Engine
    |
    v
Event Bus  <-- publish(type, payload, meta)
    |
    +-- subscribe("PAYMENT_SUCCEEDED", brevoHandler)     // futur
    +-- subscribe("SUBSCRIPTION_CREATED", telegramHandler) // futur
    +-- subscribe("USER_CREATED", crmHandler)             // futur
    +-- subscribe("ANALYSIS_PURCHASED", dashboardHandler) // futur
    +-- EventStore (SQLite) --> historique complet
```

Le bus est le point unique de communication entre services.
Aucun service ne communique directement avec un autre.
Chaque evenement est historise dans `bus_events`.

---

## Interface provider-agnostique

Le bus repose sur une interface `Provider` :

```
Provider {
  subscribe(channel, handler)
  unsubscribe(channel, handler)
  publish(channel, envelope) -> results[]
  close()
}
```

### Implementation actuelle : InProcessProvider
- Handlers executes dans le meme processus Node.js
- Execution sequentielle avec isolation des erreurs
- Zero dependance externe

### Remplacement futur
Pour migrer vers RabbitMQ, Redis Streams ou Kafka :

```javascript
const { EventBus } = require("./event-bus");
const RedisProvider = require("./redis-provider"); // a creer

const bus = new EventBus({
  provider: new RedisProvider({ url: "redis://localhost:6379" }),
  store: new EventStore(db),
});
```

Aucun appelant (Subscription Engine, Stripe Handler, etc.) ne change.
Seul le provider est remplace.

---

## Evenements disponibles

| Type | Declencheur prevu | Payload type |
|------|-------------------|--------------|
| `USER_CREATED` | Inscription | `{ email, userId }` |
| `SUBSCRIPTION_CREATED` | Nouveau abonnement | `{ userId, plan, status }` |
| `SUBSCRIPTION_UPDATED` | Changement plan/status | `{ userId, oldPlan, newPlan, status }` |
| `SUBSCRIPTION_CANCELLED` | Resiliation | `{ userId, plan }` |
| `SUBSCRIPTION_EXPIRED` | Expiration automatique | `{ userId, plan }` |
| `PAYMENT_SUCCEEDED` | Paiement reussi | `{ userId, amount, currency }` |
| `PAYMENT_FAILED` | Echec de paiement | `{ userId, reason }` |
| `PAYMENT_REFUNDED` | Remboursement | `{ userId, amount }` |
| `ANALYSIS_PURCHASED` | Achat analyse a la carte | `{ userId, matchKey, analysisId }` |

---

## API du module

### publish(type, payload, meta)

```javascript
const result = await bus.publish("PAYMENT_SUCCEEDED", {
  userId: 42,
  amount: 990,
  currency: "EUR",
}, {
  source: "stripe",
  userId: 42,
});
// result: { id, type, delivered: 2, results: [{ok: true}, {ok: true}] }
```

### subscribe(type, handler)

```javascript
bus.subscribe("SUBSCRIPTION_CREATED", async (envelope) => {
  // envelope.type, envelope.payload, envelope.source, envelope.userId
  await sendWelcomeEmail(envelope.payload.email);
});
```

### unsubscribe(type, handler)

```javascript
bus.unsubscribe("SUBSCRIPTION_CREATED", myHandler);
```

### setProvider(provider)

```javascript
bus.setProvider(new RedisProvider(config));
```

---

## Envelope (format des evenements)

Chaque evenement publie est enveloppe dans :

```json
{
  "id": "evt_1783232218375_a3x7",
  "type": "PAYMENT_SUCCEEDED",
  "timestamp": "2026-07-05T14:30:00.000Z",
  "source": "stripe",
  "userId": 42,
  "payload": { "amount": 990, "currency": "EUR" }
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique (auto-genere ou fourni via meta.id) |
| `type` | string | Un des 9 types definis |
| `timestamp` | string | Date ISO 8601 |
| `source` | string | Service emetteur (stripe, engine, auth, etc.) |
| `userId` | number/null | Utilisateur concerne |
| `payload` | object | Donnees metier libres |

---

## Historique (EventStore)

### Table bus_events

```sql
CREATE TABLE bus_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT,
  user_id INTEGER,
  payload TEXT,
  result TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  subscriber_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Chaque evenement conserve :
- `event_id` : identifiant unique de l'enveloppe
- `event_type` : type d'evenement
- `source` : service emetteur
- `user_id` : utilisateur concerne
- `payload` : donnees JSON
- `result` : `delivered`, `partial_failure`, ou `pending`
- `error` : details d'erreur si un subscriber a echoue
- `subscriber_count` : nombre de handlers ayant recu l'evenement
- `created_at` : horodatage

### API de requete

```javascript
store.query(50, 0);                    // 50 derniers evenements
store.queryByType("PAYMENT_FAILED", 10, 0); // filtrer par type
```

---

## Isolation des erreurs

Si un subscriber echoue, les autres continuent :

```
Handler A -> OK
Handler B -> ERREUR (crash)  --> erreur capturee, continue
Handler C -> OK
```

Le resultat indique `partial_failure` avec le detail de l'erreur.
Aucun subscriber ne peut bloquer le bus.

---

## Mode strict vs non-strict

Par defaut, le bus est en mode strict : seuls les 9 types definis sont acceptes.

```javascript
// Mode strict (defaut) — rejette les types inconnus
const bus = new EventBus({ strictTypes: true });

// Mode non-strict — accepte tout type
const bus = new EventBus({ strictTypes: false });
```

Le mode strict empeche les fautes de frappe dans les noms d'evenements.
Le mode non-strict permet d'ajouter des types custom sans modifier event-bus.js.

---

## Tests : 71/71

| Groupe | Tests | Resultat |
|--------|-------|----------|
| Publication simple | 8 | OK |
| Publication multiple | 5 | OK |
| Aucun abonne | 3 | OK |
| Erreur d'un consommateur | 7 | OK |
| Ordre (subscription) | 3 | OK |
| Ordre (sequentiel) | 3 | OK |
| Unsubscribe | 3 | OK |
| Validation types (strict) | 3 | OK |
| Types custom (non-strict) | 2 | OK |
| Async subscribers | 1 | OK |
| Persistance store | 3 | OK |
| Partial failure en store | 3 | OK |
| Query by type | 2 | OK |
| Subscriber count 0 | 2 | OK |
| Champs de l'enveloppe | 5 | OK |
| Swap de provider | 1 | OK |
| 9 types definis | 10 | OK |
| Structure envelope | 6 | OK |
| **Total** | **71** | **OK** |

---

## Fichiers modifies / crees

| Fichier | Nature |
|---------|--------|
| `scripts/event-bus.js` | **Nouveau** — Module EventBus + EventStore + InProcessProvider |
| `scripts/test_event_bus.js` | **Nouveau** — 71 tests |
| `Dockerfile.api` | Ajout COPY event-bus.js |
| `MISSION_004_REPORT.md` | **Nouveau** — Ce rapport |

---

## Integration future (guide developpeur)

### Etape 1 : Connecter le Subscription Engine

```javascript
const { EventBus, EventStore, EVENT_TYPES } = require("./event-bus");
const store = new EventStore(db);
const bus = new EventBus({ store });

// Dans updateSubscription() :
bus.publish(EVENT_TYPES.SUBSCRIPTION_UPDATED, {
  userId, oldPlan, newPlan: plan, status
}, { source: "subscription-engine", userId });
```

### Etape 2 : Connecter Brevo

```javascript
bus.subscribe(EVENT_TYPES.SUBSCRIPTION_CREATED, async (evt) => {
  await brevoSendWelcomeEmail(evt.payload.email, evt.payload.plan);
});
```

### Etape 3 : Connecter Telegram

```javascript
bus.subscribe(EVENT_TYPES.PAYMENT_SUCCEEDED, async (evt) => {
  await addUserToTelegramGroup(evt.payload.userId, evt.payload.plan);
});
```

### Etape 4 : Remplacer le provider

```javascript
const bus = new EventBus({
  provider: new RabbitMQProvider({ url: process.env.RABBITMQ_URL }),
  store: new EventStore(db),
});
```

---

## Points non traites (hors perimetre)

1. **Connexion Brevo** — infrastructure prete, branchement dans une mission dediee
2. **Connexion Telegram** — idem
3. **Dashboard evenements** — endpoint admin a creer
4. **Provider RabbitMQ/Redis/Kafka** — interface definie, implementation dans une mission dediee
5. **Retry automatique** — les erreurs de subscribers sont capturees mais pas reessayees
6. **Dead letter queue** — pas implementee (pertinent uniquement avec un broker externe)

*Aucun merge. Aucun deploiement effectue.*
