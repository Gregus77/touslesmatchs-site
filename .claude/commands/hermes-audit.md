# /hermes-audit — Audit complet Hermès + Communication IA

Audite 4 dimensions : cohérence site, communication Hermès↔API, couverture des matchs, et canal email/Telegram.

## 1. Cohérence frontend ↔ backend (toutes routes appelées)

### Fichiers à vérifier : index.html, live-ia.html, historique.html, preuves.html, admin.html
- Lister tous les `fetch('/api/...')` dans chaque fichier HTML
- Vérifier que chaque route existe dans `scripts/api_server.js`
- Signaler routes appelées mais absentes

### Routes spéciales à confirmer :
| Route | Attendu | Description |
|---|---|---|
| `GET /community-stats` | ✅ | Membres Telegram |
| `POST /verify-code` | ✅ | Auth utilisateur |
| `GET /current-pick` | ✅ | Pick du jour |
| `POST /live-ia/analyse` | ✅ | Analyse live (auth) |
| `POST /internal/pick-notify` | ✅ | Email auto pick (Hermès→API) |
| `GET /admin/stats` | ✅ | Stats dashboard admin |
| `GET /admin/codes` | ✅ | Liste des codes |
| `GET /preuves` | ✅ | Preuves publiques |
| `POST /admin/preuves` | ✅ | Upload preuve |

## 2. Communication Hermès ↔ API (pick-notify)

Vérifier que la chaîne fonctionne :
1. Hermès génère un pick via `/analyse`
2. Hermès appelle `http://touslesmatchs-api:3001/internal/pick-notify` avec `{ pick, secret: TG_TOKEN }`
3. L'API vérifie le secret = `HERMES_ADMIN_TLM_BOT`
4. L'API charge les emails payants depuis codes.db (`/var/touslesmatchs/codes.db`)
5. L'API envoie un email Brevo à chaque abonné

**Checklist Hermès** :
- `HERMES_ADMIN_TLM_BOT` est défini dans l'env hermes
- `http` module importé dans hermes_admin_bot.js
- `notifyPickByEmail()` existe dans hermes_admin_bot.js
- Appel après `await reply(chatId, msg)` dans `runAnalyse()`

**Checklist API** :
- Route `POST /internal/pick-notify` existe dans api_server.js
- `BREVO_API_KEY` est défini dans l'env api
- `brevoSendEmail()` est appelée pour chaque email abonné
- `CODES_DB_PATH = /var/touslesmatchs/codes.db` est monté dans le container api

## 3. Hermès note-t-il bien tous les types de matchs ?

Vérifier dans `runAnalyse()` (hermes_admin_bot.js) :
- Quelles sources de données sont utilisées (football-data.org / api-sports / deepseek / groq)
- Quels sports sont couverts (football, basketball, hockey, tennis ?)
- Quelles compétitions sont filtrées ou priorisées
- Quel critère d'edge/probabilité déclenche un pick
- Y a-t-il un filtre sur les championnats (ligues majeures vs mineures) ?

Signaler si le bot ignore des types de marchés importants :
- 1X2 (résultat)
- Double chance (1X, 12, X2)
- Over/Under buts
- BTTS (les deux équipes marquent)
- Handicap asiatique
- Mi-temps / Résultat final

## 4. Canaux de diffusion

| Canal | Statut attendu | Commande |
|---|---|---|
| Canal Telegram gratuit | ✅ `/publish` | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_FREE_CHANNEL_ID` |
| Canal Telegram Premium | ✅ `/publishpremium` | `HERMES_ADMIN_TLM_BOT` + `TELEGRAM_PREMIUM_CHANNEL_ID` |
| Email Brevo auto | ✅ après `/analyse` | `BREVO_API_KEY` en env api |

## 5. Résumé final

Afficher un tableau :
| Vérification | Résultat |
|---|---|
| Routes API cohérentes | ✅ / ⚠️ PROBLÈME |
| Hermès→API pick-notify | ✅ / ⚠️ PROBLÈME |
| Couverture types de marchés | ✅ / ⚠️ MANQUANT |
| Canal Telegram gratuit | ✅ / ⚠️ CONFIG |
| Canal Telegram Premium | ✅ / ⚠️ CONFIG |
| Email Brevo auto | ✅ / ⚠️ CONFIG |
| Fonctions JS orphelines | ✅ / ⚠️ PROBLÈME |
| CSS variables OK | ✅ / ⚠️ PROBLÈME |

Si un problème est détecté, proposer la correction immédiatement avant de terminer.
