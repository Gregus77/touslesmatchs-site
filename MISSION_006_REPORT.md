# Mission 006 — Rapport Telegram Subscriber

## Architecture

```
Stripe Webhook
      │
      ▼
SubscriptionEngine (source of verite)
      │
      ▼
EventBus (InProcessProvider)
      │
      ▼
TelegramSubscriber (6 events)
      │
      ▼
InviteLinkManager (cache + dedup concurrent)
      │
      ▼
TelegramBotClient (injectable httpCall)
      │
      ▼
Telegram Bot API
      │
      ▼
Groupes Telegram (PAY_PER_VIEW / ESSENTIAL / ELITE)
```

## Flux par evenement

| Evenement | Action | Detail |
|-----------|--------|--------|
| SUBSCRIPTION_CREATED | Invite | Lien d'invitation temporaire vers le groupe du plan |
| SUBSCRIPTION_UPDATED | Move | Retrait ancien groupe + invitation nouveau groupe |
| SUBSCRIPTION_CANCELLED | Remove | Retrait du groupe (ban + unban) |
| SUBSCRIPTION_EXPIRED | Remove | Retrait du groupe |
| PAYMENT_REFUNDED | Remove | Retrait du groupe |
| USER_CREATED | Log | Enregistrement dans l'historique, aucune action groupe |

## Modules crees

### `scripts/telegram-subscriber.js`

| Classe | Role |
|--------|------|
| TelegramBotClient | Client HTTP injectable pour Telegram Bot API |
| TelegramEventStore | Table SQLite `telegram_events` — historique complet |
| InviteLinkManager | Cache de liens d'invitation avec dedup concurrent (pending-promise) |
| TelegramSubscriber | Consommateur Event Bus — 6 handlers |

### Fonctions exportees

| Fonction | Role |
|----------|------|
| `wireTelegramSubscribers(bus, subscriber, opts)` | Branchement one-line sur l'Event Bus |
| `getGroupChatId(plan, env)` | Resolution plan → chat_id via env |
| `getAllGroupChatIds(env)` | Liste tous les groupes configures |

## Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Token du bot Telegram | `123456:ABC...` |
| `TELEGRAM_GROUP_PAY_PER_VIEW` | Chat ID du groupe Pay-per-view | `-1001234500001` |
| `TELEGRAM_GROUP_ESSENTIAL` | Chat ID du groupe Essential | `-1001234500002` |
| `TELEGRAM_GROUP_ELITE` | Chat ID du groupe Elite | `-1001234500003` |

## Table `telegram_events`

```sql
CREATE TABLE telegram_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bus_event_id TEXT,
  user_id INTEGER,
  email TEXT,
  telegram_user_id TEXT,
  group_plan TEXT,
  chat_id TEXT,
  action TEXT NOT NULL,      -- invite | remove | user_registered
  result TEXT,               -- success | failed | skipped | logged
  error TEXT,
  invite_link TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Liens d'invitation

- **Temporaires** : duree configurable (`expireSeconds`, defaut 3600s)
- **Limite d'utilisations** : configurable (`memberLimit`, defaut 1)
- **Cache** : liens reutilises tant que non expires (marge de 60s)
- **Dedup concurrent** : pattern pending-promise empeche les appels API en doublon sous charge
- **Regeneration automatique** : nouveau lien cree quand le cache expire
- **Invalidation manuelle** : `invalidate(chatId)` ou `invalidateAll()`

## Gestion des erreurs

| Cas | Comportement | Status |
|-----|-------------|--------|
| Utilisateur deja present | Nouveau lien d'invitation genere (idempotent) | success |
| Utilisateur absent (remove) | Skip avec message explicite | skipped |
| Groupe non configure | Skip avec erreur "No chat_id" | skipped |
| Telegram API erreur | Log erreur, pas de crash | failed |
| Telegram API timeout | Log erreur, pas de crash | failed |
| Quota Telegram (429) | Log erreur avec code 429 | failed |
| Lien expire | Regeneration automatique | success |
| Pas de telegram_user_id | Skip remove (invite fonctionne sans) | skipped |
| Pas de TELEGRAM_BOT_TOKEN | Skip avec `skipped: true` | skipped |

## Procedure d'installation

### 1. Variables d'environnement

Ajouter dans `.env` :

```
TELEGRAM_GROUP_PAY_PER_VIEW=-100xxxxxxxxxx
TELEGRAM_GROUP_ESSENTIAL=-100xxxxxxxxxx
TELEGRAM_GROUP_ELITE=-100xxxxxxxxxx
```

### 2. Integration dans api_server.js

```javascript
const { TelegramBotClient, TelegramEventStore, InviteLinkManager,
        TelegramSubscriber, wireTelegramSubscribers } = require("./telegram-subscriber");

const tgClient = new TelegramBotClient({ token: TELEGRAM_BOT_TOKEN });
const tgStore = new TelegramEventStore(db);
const tgInviteManager = new InviteLinkManager({ client: tgClient });
const tgSubscriber = new TelegramSubscriber({
  client: tgClient, store: tgStore, inviteManager: tgInviteManager,
});

wireTelegramSubscribers(bus, tgSubscriber);
```

### 3. Dockerfile.api

Ajouter `COPY scripts/telegram-subscriber.js ./telegram-subscriber.js`

## Tests

### Resultats

| # | Scenario | Assertions | Temps | Resultat |
|---|----------|-----------|-------|----------|
| U1 | Plan → Group mapping | 8 | 0ms | OK |
| U2 | Client sans token | 2 | 0ms | OK |
| U3 | InviteLinkManager caching | 7 | 0ms | OK |
| U4 | TelegramEventStore CRUD | 5 | 1ms | OK |
| 1 | Invitation (SUBSCRIPTION_CREATED) | 6 | 1ms | OK |
| 2 | Deplacement (SUBSCRIPTION_UPDATED) | 8 | 0ms | OK |
| 3 | Suppression (SUBSCRIPTION_CANCELLED) | 3 | 0ms | OK |
| 4 | Remboursement (PAYMENT_REFUNDED) | 3 | 0ms | OK |
| 5 | Expiration (SUBSCRIPTION_EXPIRED) | 3 | 1ms | OK |
| 6 | Doublon (meme event) | 3 | 0ms | OK |
| 7 | Timeout Telegram | 3 | 0ms | OK |
| 8 | Erreur Telegram (429) | 2 | 0ms | OK |
| 9 | Utilisateur absent | 3 | 1ms | OK |
| 10 | Pas de telegram_user_id | 2 | 0ms | OK |
| 11 | Groupe non configure | 2 | 0ms | OK |
| 12 | Lien expire → regeneration | 4 | 1101ms | OK |
| 13 | Bus wiring (integration) | 4 | 52ms | OK |
| 14 | USER_CREATED (log only) | 3 | 1ms | OK |
| 15 | Redemarrage (persistance) | 1 | 0ms | OK |
| 16 | Charge (100 utilisateurs) | 3 | 6ms | OK |

**Total : 83 assertions, 0 echecs, 1164ms**

### Performance

| Metrique | Valeur |
|----------|--------|
| Temps total | 1164ms |
| Moyenne par scenario | 58ms |
| Throughput charge | ~20 000 inv/sec |
| Appels API sous charge (100 users, 3 groupes) | 3 (cache) |

## Bug trouve et corrige

### Race condition concurrent dans InviteLinkManager

- **Symptome** : 100 appels concurrents generaient 100 appels API au lieu de 3
- **Cause** : Sans dedup concurrent, chaque `getOrCreate()` concurrente voyait un cache vide et lancait un appel API independant
- **Correction** : Pattern pending-promise — les appels concurrents pour le meme `chatId` attendent le premier resultat au lieu de dupliquer l'appel
- **Impact** : Reduction drastique des appels API sous charge (100 → 3), protection contre le rate limit Telegram (429)
