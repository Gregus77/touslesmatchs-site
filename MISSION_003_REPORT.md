# MISSION 003 — Integration Stripe

**Branche :** `feature/stripe-integration`
**Perimetre :** Stripe <-> Subscription Engine (aucune modif site public, design, Brevo, Telegram)

---

## Architecture

```
Client
  |
  v
/stripe/create-checkout (authMiddleware)
  |
  v
Stripe Checkout (heberge par Stripe)
  |
  v
/stripe/webhook (signature Stripe verifiee)
  |
  v
StripeHandler.handleEvent()
  |
  +--> stripe_events (historique + idempotence)
  +--> SubscriptionEngine (source de verite abonnements)
  +--> subscriptions (plan, status, dates)
  +--> subscription_history (audit trail)
  |
  v
Fin
```

Le webhook Stripe est la seule source de verite.
Le retour navigateur ne modifie jamais un abonnement.

---

## Schema des flux

### 1. Achat a la carte (1 euro)

```
checkout.session.completed (mode: payment)
  -> SubscriptionEngine.updateSubscription(userId, PAY_PER_VIEW, ACTIVE)
  -> stripe_events: evenement historise
```

### 2. Abonnement Essentiel (9.90/mois)

```
checkout.session.completed (mode: subscription)
  -> SubscriptionEngine.updateSubscription(userId, ESSENTIAL, ACTIVE)
  -> subscriptions.subscription_end_date = +32 jours
  -> stripe_events: evenement historise
```

### 3. Abonnement Elite (19.90/mois)

```
checkout.session.completed (mode: subscription)
  -> SubscriptionEngine.updateSubscription(userId, ELITE, ACTIVE)
  -> subscriptions.subscription_end_date = +32 jours
  -> stripe_events: evenement historise
```

### 4. Renouvellement

```
invoice.paid
  -> Si status != ACTIVE -> reactivation
  -> Extension subscription_end_date (period_end Stripe)
```

### 5. Echec de paiement

```
invoice.payment_failed
  -> SubscriptionEngine.updateSubscription(userId, plan, PENDING_PAYMENT)
```

### 6. Resiliation

```
customer.subscription.deleted
  -> SubscriptionEngine.updateSubscription(userId, plan, CANCELLED)
```

### 7. Remboursement

```
charge.refunded
  -> SubscriptionEngine.updateSubscription(userId, plan, REFUNDED)
```

---

## Endpoints

| Route | Methode | Auth | Role |
|-------|---------|------|------|
| `/stripe/create-checkout` | POST | JWT (authMiddleware) | Cree une session Stripe Checkout |
| `/stripe/webhook` | POST | Signature Stripe | Recoit les evenements Stripe |
| `/admin/stripe/events` | GET | Code admin | Historique des evenements Stripe |
| `/create-checkout` | POST | - | Legacy, conserve pour compatibilite |

### POST /stripe/create-checkout

**Body :** `{ price_id: "price_xxx" }` ou `{ plan: "essential" }`
**Reponse :** `{ ok: true, url: "https://checkout.stripe.com/..." }`

Le mode (payment vs subscription) est determine automatiquement selon le plan :
- `carte` -> mode `payment` (paiement unique)
- `essential`, `elite` -> mode `subscription`

### POST /stripe/webhook

Traite 7 types d'evenements Stripe. Signature obligatoire si `STRIPE_WEBHOOK_SECRET` est defini.

### GET /admin/stripe/events

**Query :** `?email=admin@test.com&code=ELITE-ADMIN-XXX&limit=50&offset=0`
**Reponse :** `{ ok: true, events: [...], total: N }`

---

## Evenements Stripe geres

| Evenement | Action | Status resultant |
|-----------|--------|------------------|
| `checkout.session.completed` | Active l'abonnement | ACTIVE |
| `customer.subscription.created` | Cree/met a jour l'abonnement | ACTIVE |
| `customer.subscription.updated` | Modifie plan/status | Depend du statut Stripe |
| `customer.subscription.deleted` | Annule l'abonnement | CANCELLED |
| `invoice.paid` | Reactivation + extension | ACTIVE |
| `invoice.payment_failed` | Marque paiement en attente | PENDING_PAYMENT |
| `charge.refunded` | Marque comme rembourse | REFUNDED |

### Mapping des statuts Stripe -> Subscription Engine

| Stripe status | Subscription Engine status |
|---------------|---------------------------|
| active | ACTIVE |
| trialing | ACTIVE |
| past_due | PENDING_PAYMENT |
| incomplete | PENDING_PAYMENT |
| canceled | CANCELLED |
| unpaid | SUSPENDED |
| incomplete_expired | EXPIRED |
| paused | SUSPENDED |

---

## Variables d'environnement necessaires

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `STRIPE_SECRET_KEY` | Oui | Cle secrete Stripe (sk_live_xxx ou sk_test_xxx) |
| `STRIPE_WEBHOOK_SECRET` | Recommande | Secret du webhook (whsec_xxx) pour verification de signature |
| `STRIPE_PRICE_ID_CARTE` | Oui | Price ID Stripe pour l'achat a la carte (1 euro) |
| `STRIPE_PRICE_ID_ESSENTIAL` | Oui | Price ID Stripe pour l'abonnement Essentiel (9.90/mois) |
| `STRIPE_PRICE_ID_ELITE` | Oui | Price ID Stripe pour l'abonnement Elite (19.90/mois) |

**Alias supportes (retrocompatibilite) :**
- `STRIPE_PRICE_ID_PREMIUM` / `STRIPE_PRICE_PRO` -> utilise comme fallback pour ESSENTIAL
- `STRIPE_PRICE_CARTE` -> fallback pour CARTE
- `STRIPE_PRICE_ELITE` -> fallback pour ELITE

---

## Securite

### Verification de signature
- Toute requete webhook est verifiee via `stripe.webhooks.constructEvent()` si `STRIPE_WEBHOOK_SECRET` est defini
- Signature invalide -> HTTP 400 (rejet immediat, avant tout traitement)

### Idempotence
- Chaque evenement Stripe est identifie par son `stripe_event_id` unique
- Table `stripe_events` avec contrainte `UNIQUE(stripe_event_id)`
- Un evenement deja traite avec succes est ignore lors d'une reception dupliquee
- Aucun doublon possible dans les modifications d'abonnement

### Protection des endpoints
- `/stripe/create-checkout` -> authentifie par JWT (authMiddleware)
- `/stripe/webhook` -> authentifie par signature Stripe
- `/admin/stripe/events` -> authentifie par code admin

---

## Table stripe_events (historique)

```sql
CREATE TABLE stripe_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  user_email TEXT,
  user_id INTEGER,
  result TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  raw_data TEXT,
  processed_at TEXT DEFAULT (datetime('now'))
);
```

Chaque evenement conserve : type, date, Stripe Event ID, Customer ID, Subscription ID, Payment Intent ID, resultat, erreur eventuelle.

---

## Tests

### Tests unitaires (test_stripe_handler.js) : 41/41

| Test | Resultat |
|------|----------|
| checkout.session.completed -> ESSENTIAL | OK |
| checkout.session.completed -> PAY_PER_VIEW (carte) | OK |
| customer.subscription.created -> ELITE | OK |
| customer.subscription.updated (changement plan) | OK |
| invoice.payment_failed -> PENDING_PAYMENT | OK |
| invoice.paid -> reactivation ACTIVE | OK |
| charge.refunded -> REFUNDED | OK |
| customer.subscription.deleted -> CANCELLED | OK |
| Idempotence (doublon rejete) | OK |
| Type d'evenement inconnu (ignore) | OK |
| Historique d'evenements | OK |
| Mapping de tous les statuts Stripe | OK |
| Client inconnu (pas de crash) | OK |
| IDs Stripe stockes sur user | OK |

### Tests HTTP integration (test_stripe_integration.js) : 14/14

| Test | Resultat |
|------|----------|
| Webhook signature invalide -> 400 | OK |
| Webhook signature valide -> 200 | OK |
| checkout.session.completed -> abonnement active | OK |
| customer.subscription.created -> plan defini | OK |
| customer.subscription.updated -> plan change | OK |
| invoice.payment_failed -> PENDING_PAYMENT | OK |
| invoice.paid -> reactivation | OK |
| charge.refunded -> REFUNDED | OK |
| customer.subscription.deleted -> CANCELLED | OK |
| Doublon webhook (idempotence) -> skipped | OK |
| Admin events sans code -> 403 | OK |
| Admin events avec code -> 200 | OK |
| Type d'evenement non gere -> ignore | OK |
| Client inconnu -> pas de crash | OK |

### Tests de regression Mission 002 : 43/43

| Suite | Resultat |
|-------|----------|
| test_subscription_engine.js (unitaires) | 26/26 OK |
| test_integration_api.js (HTTP) | 17/17 OK |

### Total : 98/98 tests verts

---

## Fichiers modifies / crees

| Fichier | Nature |
|---------|--------|
| `scripts/stripe-handler.js` | **Nouveau** — Module StripeHandler (dispatch + historique + idempotence) |
| `scripts/api_server.js` | Refactoring webhook, ajout STRIPE_PRICE_ID_ESSENTIAL, wiring StripeHandler |
| `scripts/test_stripe_handler.js` | **Nouveau** — 41 tests unitaires |
| `scripts/test_stripe_integration.js` | **Nouveau** — 14 tests HTTP reels |
| `Dockerfile.api` | Ajout COPY stripe-handler.js |
| `MISSION_003_REPORT.md` | **Nouveau** — Ce rapport |

---

## Ameliorations apportees au code existant

1. **Checkout** : Le mode (payment vs subscription) est determine automatiquement selon le prix, au lieu d'etre force en mode `subscription` pour tous les plans
2. **Plan mapping** : Alignement sur les noms du Subscription Engine (ESSENTIAL au lieu de premium, PAY_PER_VIEW au lieu de carte)
3. **Route dupliquee** : Suppression du doublon `app.post("/create-checkout")` qui etait enregistre deux fois
4. **Messages d'erreur** : Les erreurs internes ne sont plus exposees au client sur le checkout

---

## Points non traites (hors perimetre)

1. **Portail client Stripe** (Customer Portal) — specifie comme mission dediee
2. **Email de confirmation Brevo** — l'ancien code envoyait un email via Brevo apres checkout; le nouveau webhook ne le fait pas (perimetre = Stripe <-> Subscription Engine uniquement, pas de Brevo)
3. **Creation de code dans codes.db** — idem, l'ancien webhook creait un code d'acces; cette logique n'est pas dans le StripeHandler (elle utilise codes.db, hors perimetre du Subscription Engine). A reconnecter dans une mission dediee si necessaire
4. **Mise a jour users.status** — l'ancien webhook mettait a jour `users.status` (champ deprecie). Le nouveau ne le fait plus, conformement a la decision Mission 002 de faire de `subscriptions` la source de verite
5. **Mise a jour user_tokens** — l'ancien webhook mettait a jour `user_tokens`. Le nouveau ne le fait plus (les tokens sont geres par le Subscription Engine via `dailyLimit`)

*Aucun merge. Aucun deploiement effectue.*
