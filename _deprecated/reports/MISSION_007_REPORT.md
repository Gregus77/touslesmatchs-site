# MISSION 007 — CRM CENTRAL

## Objectif

Creer le CRM central de TousLesMatchs. Toutes les informations d'un utilisateur regroupees dans un seul endroit. Le CRM devient la reference pour tous les modules.

Architecture : Stripe → Subscription Engine → CRM → Event Bus → Brevo

## Fichiers crees

| Fichier | Role |
|---------|------|
| `scripts/crm.js` | Module CRM central — classe CRM avec CRUD, gestion plans, abonnements, credits, leads, referrals, sync Brevo, migration legacy |
| `scripts/__tests__/crm.test.js` | 58 tests unitaires couvrant toutes les operations CRM |

## Schema de donnees

### Table `crm_contacts` (source unique de verite)

| Colonne | Type | Role |
|---------|------|------|
| email | TEXT UNIQUE NOCASE | Identifiant principal |
| plan | TEXT | free, lead, carte, premium, elite, vip |
| status | TEXT | active, cancelled |
| stripe_customer_id | TEXT | Lien Stripe |
| stripe_subscription_id | TEXT | Abonnement Stripe actif |
| code | TEXT | Code d'acces |
| credits_max / credits_used / credits_date | INT/INT/TEXT | Systeme de credits quotidiens |
| expires_at | TEXT | Expiration abonnement |
| lang / country | TEXT | Localisation |
| source / referrer | TEXT | Acquisition |
| utm_source / utm_medium / utm_campaign | TEXT | Tracking UTM |
| referral_code / referred_by / months_earned | TEXT/TEXT/INT | Systeme de parrainage |
| telegram_joined | INT | Flag Telegram |
| total_analyses / last_analysis_at | INT/TEXT | Activite |
| total_signals_received | INT | Signaux recus |
| brevo_synced / brevo_synced_at | INT/TEXT | Etat sync Brevo |
| notes | TEXT | Notes libres |

### Table `crm_events` (journal d'activite)

| Colonne | Type | Role |
|---------|------|------|
| contact_id | FK | Lien vers crm_contacts |
| event_type | TEXT | Type d'evenement CRM |
| payload | TEXT (JSON) | Donnees de l'evenement |

### Table `crm_plan_history` (historique des changements de plan)

| Colonne | Type | Role |
|---------|------|------|
| contact_id | FK | Lien vers crm_contacts |
| old_plan / new_plan | TEXT | Transition |
| reason | TEXT | stripe_checkout, stripe_cancelled, legacy_import, etc. |
| stripe_event_id | TEXT | ID evenement Stripe associe |

## Hierarchie des plans

```
free(0) → lead(1) → carte(2) → premium(3) → elite(4) → vip(5)
```

## Evenements CRM (Event Bus)

| Evenement | Declencheur |
|-----------|-------------|
| CONTACT_CREATED | findOrCreateContact() — nouveau contact |
| CONTACT_UPDATED | updateContact() — modification de champs |
| PLAN_CHANGED | changePlan() — upgrade ou downgrade |
| SUBSCRIPTION_ACTIVATED | activateSubscription() — achat Stripe |
| SUBSCRIPTION_CANCELLED | cancelSubscription() — annulation |
| CREDIT_USED | useCredit() — consommation d'un credit |
| LEAD_REGISTERED | registerLead() — inscription email |
| REFERRAL_CREDITED | creditReferral() — mois offert parrainage |

## Methodes principales

### Core CRUD
- `getContact(email)` — lecture par email (NOCASE)
- `getContactById(id)` — lecture par ID
- `findOrCreateContact(email, defaults)` — upsert atomique
- `updateContact(email, fields)` — mise a jour securisee (whitelist de champs)

### Gestion des plans
- `changePlan(email, newPlan, reason, stripeEventId)` — avec historique et Event Bus

### Cycle de vie abonnement
- `activateSubscription(email, { plan, stripeCustomerId, code, creditsMax, ... })` — activation complete
- `cancelSubscription(email, reason)` — downgrade vers free

### Credits
- `useCredit(email)` — consomme 1 credit, reset quotidien automatique
- `getCreditsLeft(email)` — credits restants

### Leads et referrals
- `registerLead(email, metadata)` — inscription avec UTM
- `creditReferral(email, months)` — ajout de mois offerts

### Requetes
- `listContacts({ plan, status, limit, offset })` — liste paginee
- `countContacts(plan)` — comptage
- `getContactStats()` — stats globales (total, par plan, actifs, annules)
- `searchContacts(query)` — recherche par email
- `getPlanHistory(email)` — historique des plans
- `getContactEvents(email)` — journal d'activite

### Sync Brevo
- `markBrevoSynced(email)` — marque comme synchronise
- `getUnsyncedContacts(limit)` — contacts a synchroniser

### Migration
- `importFromLegacy({ email, plan, code, ... })` — import depuis l'ancien systeme

## Sources legacy a migrer (reference)

| Source actuelle | Localisation | Donnees |
|----------------|-------------|---------|
| Table `users` | tlm.db | email, plan, stripe_customer_id |
| Table `codes` | codes.db | code, plan, credits, expiration |
| `leads.json` | /var/touslesmatchs/ | email, source, UTM |
| `referrals.json` | /var/touslesmatchs/ | email, months_earned |
| `scheduled_emails` | tlm.db | email, nurturing sequences |
| `revealed_analyses` | tlm.db | email, analyses consultees |
| Brevo | API externe | contacts, listes, attributs |
| Stripe | API externe | customers, subscriptions |

## Tests

### 58 tests — 58 passes — 0 regression

| # | Categorie | Tests | Statut |
|---|-----------|-------|--------|
| 1-12 | Core CRUD | 12 tests | OK |
| 13-17 | Plan Management | 5 tests | OK |
| 18-24 | Subscription Lifecycle | 7 tests | OK |
| 25-32 | Credits | 8 tests | OK |
| 33-37 | Lead Registration | 5 tests | OK |
| 38-41 | Referrals | 4 tests | OK |
| 42-51 | Queries | 10 tests | OK |
| 52-53 | Brevo Sync | 2 tests | OK |
| 54-56 | Legacy Import | 3 tests | OK |
| 57-58 | Event Logging | 2 tests | OK |

### Suite complete (114 tests backend)

| Suite | Tests | Statut |
|-------|-------|--------|
| crm.test.js | 58 | OK |
| publication_engine.test.js | 26 | OK |
| publication_integration.test.js | 16 | OK |
| invite_link_manager.test.js | 14 | OK |

## Architecture cible

```
Stripe Webhook ──→ CRM.activateSubscription()
                       │
                       ├──→ crm_contacts (source unique)
                       ├──→ crm_events (journal)
                       ├──→ crm_plan_history (historique plans)
                       │
                       └──→ Event Bus
                               │
                       ┌───────┼───────┐
                       │       │       │
                    Brevo   Telegram  Dashboard


POST /subscribe-email ──→ CRM.registerLead()
                              │
                              ├──→ crm_contacts
                              └──→ Event Bus → Brevo


POST /verify-code ──→ CRM.getContact() + CRM.useCredit()


Stripe cancel ──→ CRM.cancelSubscription()
                      │
                      ├──→ crm_contacts (plan → free)
                      ├──→ crm_plan_history
                      └──→ Event Bus → Brevo
```

## Prochaines etapes (hors scope Mission 007)

1. Integration dans api_server.js (import CRM, initialiser avec db, brancher sur Stripe webhook, leads, verify-code)
2. Migration des donnees legacy vers crm_contacts
3. Endpoints API admin (`/admin/crm/contacts`, `/admin/crm/stats`)
4. Consumer Event Bus → Brevo sync automatique
5. Dashboard CRM dans l'interface admin

## Verification finale

- [x] Module CRM cree (`scripts/crm.js`)
- [x] 3 tables SQLite (crm_contacts, crm_events, crm_plan_history)
- [x] CRUD complet avec email NOCASE
- [x] Gestion des plans avec historique
- [x] Cycle de vie abonnement (activation + annulation)
- [x] Systeme de credits quotidiens
- [x] Registration des leads avec UTM
- [x] Systeme de parrainage
- [x] Integration Event Bus (8 evenements)
- [x] Tracking sync Brevo
- [x] Migration helper depuis legacy
- [x] 58 tests unitaires passes
- [x] 0 regression sur les 114 tests backend
- [x] Aucun merge
- [x] Aucun deploiement
