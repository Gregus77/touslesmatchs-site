# MISSION 005 — Brevo Events

**Branche :** `feature/brevo-events`
**Perimetre :** Connecter Brevo a l'Event Bus. Brevo n'est plus appele directement.

---

## Architecture

```
Event Bus
    |
    +-- wireBrevoSubscribers()
    |       |
    |       +-- USER_CREATED ---------> welcome + followup J1/J3/J7
    |       +-- SUBSCRIPTION_CREATED -> subscription_created
    |       +-- SUBSCRIPTION_UPDATED -> subscription_updated
    |       +-- SUBSCRIPTION_CANCELLED -> subscription_cancelled
    |       +-- SUBSCRIPTION_EXPIRED -> subscription_expired
    |       +-- PAYMENT_FAILED -------> payment_failed
    |       +-- PAYMENT_REFUNDED -----> payment_refunded
    |
    v
EmailScheduler (SQLite queue)
    |
    +-- enqueue() ---------------------> email_queue (dedup par event_id)
    +-- processPending() --------------> BrevoSender.send()
    +-- start() -----------------------> timer auto (configurable)
    |
    v
BrevoSender
    |
    +-- send() --> Brevo API (https://api.brevo.com/v3/smtp/email)
```

Brevo ecoute les evenements du bus.
Brevo ne connait ni Stripe, ni le Subscription Engine, ni la base de donnees utilisateur.
Il recoit un envelope, il enqueue un email.

---

## Composants

### BrevoSender

Encapsule l'appel HTTP a l'API Brevo. Injectable pour les tests.

```javascript
const sender = new BrevoSender({
  apiKey: process.env.BREVO_API_KEY,
  senderEmail: "noreply@touslesmatchs.com",
  senderName: "TousLesMatchs",
  timeout: 10000,          // timeout HTTP
  httpPost: mockFn,        // injection pour tests
});

const result = await sender.send("user@example.com", "Sujet", "<p>HTML</p>");
// { ok: true } ou { ok: false, error: "..." }
```

### EmailScheduler

File d'attente SQLite avec deduplication et envoi differe.

```javascript
const scheduler = new EmailScheduler({ db, sender });

// Envoi immediat
scheduler.enqueue("user@test.com", "welcome", { plan: "ELITE" }, { eventId: "evt_1" });

// Envoi differe J+1
scheduler.enqueue("user@test.com", "followup_j1", {}, {
  eventId: "evt_1_followup_j1",
  delayMs: 1 * 24 * 3600 * 1000,
});

// Traiter la queue
await scheduler.processPending(10);

// Demarrer le timer automatique
scheduler.start();  // verifie toutes les 60s par defaut
scheduler.stop();
```

### Templates

10 templates HTML avec disclaimer ANJ integre :

| Template | Declencheur | Sujet |
|----------|-------------|-------|
| `welcome` | USER_CREATED | Bienvenue sur TousLesMatchs |
| `subscription_created` | SUBSCRIPTION_CREATED | Votre abonnement {plan} est actif |
| `subscription_updated` | SUBSCRIPTION_UPDATED | Votre abonnement a ete modifie |
| `subscription_cancelled` | SUBSCRIPTION_CANCELLED | Votre abonnement a ete resilie |
| `subscription_expired` | SUBSCRIPTION_EXPIRED | Votre abonnement a expire |
| `payment_failed` | PAYMENT_FAILED | Echec de paiement — action requise |
| `payment_refunded` | PAYMENT_REFUNDED | Votre remboursement a ete effectue |
| `followup_j1` | USER_CREATED (J+1) | Le Concile vient de publier |
| `followup_j3` | USER_CREATED (J+3) | Tu vois le signal, pas l'analyse complete |
| `followup_j7` | USER_CREATED (J+7) | Ta premiere semaine est passee |

Ajouter un template = ajouter une entree dans `TEMPLATES` + une ligne dans `EVENT_TO_TEMPLATE` ou `FOLLOWUP_SCHEDULE`.

### wireBrevoSubscribers()

Connecte Brevo au bus en une seule ligne :

```javascript
const handlers = wireBrevoSubscribers(bus, scheduler, {
  resolveEmail: (evt) => evt.payload.email,
  timeout: 5000,
});
```

---

## Planification (Scheduler Email)

| Type | Mecanisme |
|------|-----------|
| Envoi immediat | `enqueue()` avec `delayMs: 0` (defaut) |
| Envoi differe | `enqueue()` avec `delayMs: N` |
| Relance J+1 | `FOLLOWUP_SCHEDULE` → `delayMs: 86400000` |
| Relance J+3 | `FOLLOWUP_SCHEDULE` → `delayMs: 259200000` |
| Relance J+7 | `FOLLOWUP_SCHEDULE` → `delayMs: 604800000` |

### Anti-doublon

Deduplication par `(recipient, template_key, event_id)`.
Un meme evenement ne peut pas enqueuer deux fois le meme template pour le meme destinataire.

---

## Schema BDD

```sql
CREATE TABLE email_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  template_key TEXT NOT NULL,
  template_data TEXT,             -- JSON du payload
  event_id TEXT,                  -- Event Bus event ID
  scheduled_at TEXT NOT NULL,     -- quand envoyer
  sent_at TEXT,                   -- quand envoye
  status TEXT DEFAULT 'pending',  -- pending/sent/failed/skipped
  error TEXT,                     -- detail erreur
  created_at TEXT DEFAULT (datetime('now'))
);
```

Chaque email conserve : template, destinataire, statut, erreur, date d'envoi, Event ID d'origine.

---

## Integration future

```javascript
// Dans api_server.js
const { EventBus, EventStore } = require("./event-bus");
const { BrevoSender, EmailScheduler, wireBrevoSubscribers } = require("./brevo-subscriber");

const busStore = new EventStore(db);
const bus = new EventBus({ store: busStore });

const brevoSender = new BrevoSender({
  apiKey: process.env.BREVO_API_KEY,
  senderEmail: process.env.BREVO_SENDER_EMAIL,
  senderName: process.env.BREVO_SENDER_NAME,
});
const emailScheduler = new EmailScheduler({ db, sender: brevoSender });
emailScheduler.start();

wireBrevoSubscribers(bus, emailScheduler, {
  resolveEmail: (evt) => evt.payload.email,
});
```

---

## Tests : 89/89

| Groupe | Tests | Resultat |
|--------|-------|----------|
| BrevoSender — envoi normal | 4 | OK |
| BrevoSender — pas de cle API | 2 | OK |
| BrevoSender — erreur Brevo | 2 | OK |
| BrevoSender — destinataire manquant | 2 | OK |
| Templates — existence (7 events) | 21 | OK |
| Templates — HTML + ANJ | 2 | OK |
| Templates — sujet dynamique | 1 | OK |
| Templates — followups | 3 | OK |
| Scheduler — enqueue | 2 | OK |
| Scheduler — doublon rejete | 3 | OK |
| Scheduler — event ID different | 2 | OK |
| Scheduler — template different | 2 | OK |
| Scheduler — process pending | 2 | OK |
| Scheduler — deja envoye | 1 | OK |
| Scheduler — echec enregistre | 3 | OK |
| Scheduler — template inconnu | 3 | OK |
| Scheduler — email differe | 1 | OK |
| Scheduler — historique | 5 | OK |
| Integration — USER_CREATED → welcome | 5 | OK |
| Integration — USER_CREATED → followups J1/J3/J7 | 6 | OK |
| Integration — SUBSCRIPTION_CREATED | 2 | OK |
| Integration — PAYMENT_FAILED | 3 | OK |
| Integration — sans email = pas d'envoi | 1 | OK |
| Integration — doublon event | 1 | OK |
| Integration — timeout ne bloque pas | 1 | OK |
| Integration — 7 types → 7 templates | 8 | OK |
| **Total** | **89** | **OK** |

### Tests Event Bus (regression) : 91/91

**Total general : 180/180 tests verts.**

---

## Fichiers modifies / crees

| Fichier | Nature |
|---------|--------|
| `scripts/brevo-subscriber.js` | **Nouveau** — BrevoSender + EmailScheduler + Templates + wireBrevoSubscribers |
| `scripts/test_brevo_subscriber.js` | **Nouveau** — 89 tests |
| `Dockerfile.api` | Ajout COPY brevo-subscriber.js |
| `MISSION_005_REPORT.md` | **Nouveau** — Ce rapport |

---

## Points non traites (hors perimetre)

1. **Branchement effectif dans api_server.js** — le module est pret, le branchement se fera lors du merge des branches
2. **Migration des appels brevoSendEmail existants** — les anciens appels directs dans api_server.js restent en place; a migrer dans une mission dediee
3. **Templates HTML riches** — les templates actuels sont fonctionnels mais minimalistes; a enrichir graphiquement dans une mission dediee
4. **Brevo contacts API** (ajout a une liste, tags) — non integre, le module gere uniquement l'envoi d'emails
5. **Cap d'email par jour** — le cap de 1 email/jour present dans api_server.js n'est pas replique; a discuter si necessaire

*Aucun merge. Aucun deploiement effectue.*
