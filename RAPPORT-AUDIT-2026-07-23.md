# RAPPORT D'AUDIT — TousLesMatchs (23/07/2026)
### Vérifié par Claude directement dans le code (`scripts/api_server.js`), pas sur parole.

> ⚠️ Note importante : l'audit fourni par Hermès contient **plusieurs fausses alertes**.
> Il a testé de mauvaises URL et semble avoir visé en partie un mauvais serveur
> (il parle de l'IP `139.59.134.116` — DigitalOcean — alors que le site tourne sur
> Hostinger `72.61.167.175`). J'ai donc TOUT re-vérifié dans le vrai code.

---

## ✅ CE QUI FONCTIONNE DÉJÀ (ce que je gère)

| Domaine | État | Détail |
|---|---|---|
| **Site + API** | ✅ | Node.js (`api_server.js`), Caddy (HTTPS), 4 services Docker |
| **Stripe** | ✅ | Checkout + webhook **avec vérification de signature** (`stripe.webhooks.constructEvent`) |
| **Telegram** | ✅ | `sendTelegramMessage`, canaux gratuit/premium/admin, signaux + résultats |
| **Brevo (emails)** | ✅ | `brevoSendEmail`, nurturing, rapports |
| **Concile IA** | ✅ | Auto-concile JS temps réel + Concile Python |
| **Live IA** | ✅ | Analyse en direct, fenêtre 25-65', jetons |
| **Cotes** | ✅ | Vraies cotes ARJEL (API-Sports) + fallback estimation |
| **SEO** | ✅ | Pages `/pronostics`, `/pronostic/:slug`, sitemap dynamique, Schema.org |
| **Paliers** | ✅ | Stats Standard/Premium/Elite (site + dashboard selon plan) |
| **Auth admin sensible** | ✅ | `/admin/codes`, `/admin/create-code`, `/admin/dashboard-data`, mutations → **protégés** (`isAdmin` / `HERMES_TOKEN`) |
| **Analytics** | ✅ | Tracking visiteurs, rapports quotidiens/hebdo |

---

## ❌ FAUSSES ALERTES D'HERMÈS (vérifiées : PAS des bugs)

| Alerte Hermès | Réalité |
|---|---|
| « `/api/analysis-history` n'existe pas » | **FAUX** — la route existe et renvoie les données (testée aujourd'hui, 364 analyses). |
| « `/api/sitemap.xml` → 404 » | Mauvaise URL. Le sitemap est `/sitemap.xml` (statique) + `/sitemap-pronostics.xml` (API). |
| « `/api/concile-analyses` → 404 » | Mauvais nom de route. C'est `/analysis-history`. |
| « `/api/stats` renvoie 0 vs /health 603 » | `/api/stats` n'est pas une route définie. La vraie est `/admin/stats`. |
| « Webhook Stripe non sécurisé » | **FAUX** — la signature EST vérifiée (`constructEvent`). |
| « SSH bloqué sur 139.59.134.116 » | Mauvais serveur / infra de monitoring d'Hermès, pas le code du site. |
| « `/api/trigger-daily-summary` 404 » | Zone Hermès (Telegram/council), pas l'API du site. |

---

## ⚠️ VRAIS POINTS D'AMÉLIORATION (priorisés)

### 🔴 P1 — Sécurité : endpoints admin en LECTURE non protégés
Une série d'endpoints `/admin/*` en lecture seule n'ont **aucune authentification** :
`/admin/stats`, `/admin/leagues`, `/admin/agents`, `/admin/journal`, `/admin/markets`,
`/admin/health`, `/admin/version`, `/admin/scheduler-state`, `/admin/alerts`,
`/admin/guardian-state`, `/admin/datahub-state`, etc.
- **Risque** : divulgation d'infos internes (ratings de ligues, perfs des agents, taille DB,
  mémoire, uptime). **Pas de fuite de mot de passe, d'email client ni de clé** (ça reste protégé).
- **Gravité** : MOYENNE (exposition du « secret sauce » + internes système).
- **Fix proposé** : ajouter le même contrôle `isAdmin(email, code)` que les autres routes admin,
  OU les préfixer `/internal/` derrière un token. À faire avec précaution (vérifier que le
  dashboard admin envoie bien ses identifiants à ces routes).

### 🟠 P2 — Pas de rate limiting
Aucune limite de requêtes (`express-rate-limit` absent).
- **Risque** : scraping massif, tentatives répétées sur `/auth/login`.
- **Atténuation existante** : `/auth/login` utilise bcrypt (lent → freine le brute force).
- **Fix proposé** : `express-rate-limit` sur `/api/` (ex. 100 req/15 min/IP) + limite plus stricte sur `/auth/login`.

### 🟡 P3 — CORS trop permissif
`app.use(cors())` = `Access-Control-Allow-Origin: *`.
- **Risque** : faible pour les routes publiques, mais à restreindre pour l'admin.
- **Fix proposé** : limiter le CORS au domaine `touslesmatchs.com` (au moins pour `/admin/*`).

### 🟡 P4 — Webhook Stripe : fallback non vérifié si secret manquant
La vérification de signature ne s'applique que si `STRIPE_WEBHOOK_SECRET` est défini.
Sinon, le corps est parsé **sans vérification**.
- **Fix** : s'assurer que `STRIPE_WEBHOOK_SECRET` est bien présent dans le `.env` de prod
  (config serveur, pas code). Optionnel : refuser le webhook si le secret est absent.

---

## 🎯 CE QUE JE RECOMMANDE (dans l'ordre)

1. **Protéger les endpoints `/admin/*` en lecture** (P1) — rapide, gros gain sécurité.
2. **Ajouter le rate limiting** (P2).
3. **Restreindre le CORS pour l'admin** (P3).
4. **Vérifier que `STRIPE_WEBHOOK_SECRET` est bien en prod** (P4) — côté config.

> Ces corrections sont **côté API (`api_server.js`)**, ma zone. Elles ne touchent NI Telegram,
> NI Brevo, NI council, NI les liens bookmakers. Je peux les faire proprement, avec sauvegarde
> avant/après, dès que tu me donnes le feu vert.

---

**Conclusion honnête :** le site et ses intégrations (Stripe, Telegram, Brevo, Concile) sont
**fonctionnels et les données sensibles sont protégées**. Les vrais points sont du
**durcissement sécurité** (endpoints internes en lecture, rate limit, CORS) — important mais
pas critique/urgent. La majorité des alarmes d'Hermès étaient des faux positifs (mauvaises URL / mauvais serveur).
