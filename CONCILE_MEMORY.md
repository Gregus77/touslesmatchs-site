# 📜 MÉMOIRE DU CONCILE HERMÈS

> Ce fichier est lu par chaque IA du concile avant toute décision.
> Les leçons gravées ici ne doivent JAMAIS être oubliées ni répétées.

---

## ⚖️ RÈGLES ABSOLUES (non-négociables)

1. **JAMAIS de match amical** — peu importe les équipes, la cote, ou les stats.
   Mots-clés interdits : `friendly`, `amical`, `amistoso`, `testspiel`, `exhibition`,
   `international friendly`, `tour`, `all-star`, `showcase`.

2. **JAMAIS de match sans enjeu réel pour les deux équipes.**
   Si une équipe est déjà qualifiée/éliminée → rejet.

3. **JAMAIS de match U17-U23, Femmes, Futsal, Beach Soccer.**

4. **Test du sommeil obligatoire** : « Est-ce que je peux publier ce pick
   et aller dormir tranquille ? » Si non → NOPICK.

5. **Auto-contre-examen obligatoire** : Hermès doit toujours écrire le
   meilleur argument CONTRE son propre pick. Si pas d'argument solide →
   NOPICK (« trop facile = suspect »).

6. **On ne joue pas pour s'amuser, on joue pour gagner.**
   Mieux vaut zéro pick qu'un pick faible.

---

## 🩸 LEÇONS GRAVÉES (erreurs à ne JAMAIS répéter)

### Suisse 1-1 Australie — 06/06/2026 — Amical San Diego (PERDU)
- **Erreur** : pick "Switzerland Vainqueur" sur un match amical.
- **Cause** : équipes mixées, capitaine absent, zéro enjeu.
- **Leçon** : les amicaux internationaux sont des pièges. Stats non fiables.
- **Décision** : `BANNED_LEAGUE_KEYWORDS` inclut désormais tous les termes
  amicaux. Filtrage automatique avant analyse.

### Greece 0-1 Italy — 08/06/2026 — Amical pré-Coupe du Monde (ANNULÉ)
- **Erreur** : pick "Greece Vainqueur" sur un match amical international.
- **Cause** : match de préparation avant la Coupe du Monde 2026 (J-3).
- **Leçon** : les matchs de préparation pré-tournoi SONT des amicaux même
  sans ce mot explicite. Vérifier le contexte calendrier (2 semaines avant
  grand tournoi = amical probable).
- **Décision** : pick marqué ANNULÉ, score 0-1, non comptabilisé dans le ROI.

---

## ✅ RÉSULTATS CONFIRMÉS (mises à jour manuelles validées)

| Date     | Match                    | Pari               | Cote | Score | Verdict | Source        |
|----------|--------------------------|--------------------|------|-------|---------|---------------|
| 10/06/26 | Spurs vs Knicks (G4)     | Spurs ML           | 2.05 | —     | EN ATTENTE | Pick ce soir 21h30 ET |
| 08/06/26 | Greece vs Italy          | Greece Vainqueur   | 1.6  | 0-1   | ANNULÉ  | Amical pré-WC2026 |
| 06/06/26 | Belgium vs Tunisia       | Belgium Vainqueur  | 1.6  | 5-0   | GAGNE   | RapidAPI + utilisateur |
| 05/06/26 | Russia vs Burkina Faso   | Russia Vainqueur   | 1.60 | 3-0   | GAGNE   | check_results.js |

---

## 🏀⚾ CRITÈRES SPÉCIFIQUES SPORTS US (MLB / NBA / NHL)

Ces sports ont des critères DIFFÉRENTS du foot. Hermès NE DOIT PAS rejeter
en bloc faute de "xG ou H2H foot". Voici les règles validées par le concile :

### MLB (Baseball)
- ✅ **Pick valide si** : ELO diff ≥ 150 ET cote ≥ 1.50 ET real_odds=true ET value ≥ 4%
- ✅ Pas besoin de xG, blessures, ou H2H — la moyenne des cotes 30+ bookmakers
  EST la mesure de marché la plus fiable au monde
- ✅ La saison régulière MLB = enjeu constant (162 matchs, qualification playoffs)
- ⚠️ Éviter premier match d'une série (lanceur surprise) si possible
- Note plancher : 7.0/10 atteignable avec ELO diff ≥ 200 + value ≥ 6%

### NBA (Basketball)
- ✅ **Pick valide si** : ELO diff ≥ 100 ET cote ≥ 1.45 ET real_odds=true
- ✅ Playoffs/Finals = enjeu maximum, données extrêmement fiables
- ✅ Différentiel domicile/extérieur très marqué en NBA (avantage home)
- Note plancher : 7.0/10 atteignable avec moneyline favori clair en Finals

### NHL (Hockey)
- ✅ **Pick valide si** : ELO diff ≥ 80 ET cote ≥ 1.55 ET real_odds=true
- ✅ Stanley Cup = enjeu absolu, données fiables
- ⚠️ La variance est forte au hockey — préférer marchés Over/Under si dispo

### Règle commune
Si real_odds=true (vraies cotes 30+ bookmakers) ET ELO calibré (≠ 1500/1700 par défaut),
le test du sommeil PASSE par défaut. Le marché est trop large pour cacher quelque chose.

---

## 🔌 SOURCES DE DONNÉES BRANCHÉES

- **RapidAPI free-football** : fixtures foot internationales et ARJEL
- **ClubElo.com** : ELO réel des clubs européens (mis à jour quotidiennement)
- **Table NATIONAL_ELO** : ELO sélections nationales calibré FIFA juin 2026
- **The Odds API** : cotes réelles 30+ bookmakers (foot, NHL, MLB)
  - Si `ODDS_API_KEY` est définie, les vraies cotes remplacent les valeurs par défaut
  - Les matchs NHL et MLB sont ajoutés automatiquement au pool d'analyse
  - Le flag `real_odds: true` indique que les cotes sont fiables

---

## 🤖 PROCESSUS AUTOMATIQUE EN PLACE

- **check_results.js** tourne via cron toutes les 2h (cf. crontab VPS).
- Détecte les matchs `EN ATTENTE` → interroge RapidAPI → met à jour App.js
  → reconstruit l'image Docker `site` → site mis à jour automatiquement.
- Le bot Telegram est rebuilt à chaque modification de App.js (commande
  `docker compose up -d --build bot`).

---

## 🏗️ ARCHITECTURE VPS (état au 08/06/2026)

### Serveur : 72.61.167.175 — /opt/touslesmatchs/

### Containers Docker actifs :
| Service | Image | Rôle |
|---|---|---|
| `site` | `touslesmatchs-site` | React + Caddy HTTPS (Let's Encrypt) |
| `api` | `touslesmatchs-api` | Backend Node (analyse_live.js — crashe, MODULE_NOT_FOUND: api_auth) |
| `bot` | `touslesmatchs-bot` | Bot Telegram Free interactif |
| `hermes-admin` | `touslesmatchs-hermes-admin` | Bot admin Hermès |
| `stripe-webhook` | `touslesmatchs-stripe-webhook` | Webhook Stripe paiements |

### Branche de développement : `claude/docker-multi-ai-setup-aLpF3`
⚠️ NE JAMAIS merger dans `main` sans accord de Greg.

### Caddyfile (proxy Caddy) :
- `/stripe/webhook` → `stripe-webhook:4242`
- `/api/*` → `api:3001`
- Tout le reste → React SPA

### Volumes montés :
- `./scripts:/app/scripts` dans bot ET stripe-webhook (fichiers partagés)
- `./src/App.js:/app/scripts/App.js:ro` dans bot
- `./Caddyfile:/etc/caddy/Caddyfile:ro` dans site

---

## 💳 STRIPE — CONFIGURATION (08/06/2026)

### Payment Links actifs :
- **Standard 9,90€/mois** — URL de succès : `https://t.me/touslesmatchs_bot?start=verify_{CHECKOUT_SESSION_ID}`
- **Premium 19,90€/mois** (créé le 8 juin à 11:52) — même URL de succès

### Webhook :
- **Destination** : `touslesmatchs-webhook`
- **URL** : `https://www.touslesmatchs.com/stripe/webhook`
- **ID** : `we_1Tg056FtcI38Oqdt09HAEID6`
- **Événements** : `checkout.session.completed` + `customer.subscription.deleted`
- **Signing secret** : enregistré dans `.env` → `STRIPE_WEBHOOK_SECRET`

### Flow paiement → accès automatique :
1. Client paie → Stripe redirige vers `t.me/touslesmatchs_bot?start=verify_{SESSION_ID}`
2. Webhook reçoit `checkout.session.completed` → sauvegarde session dans `scripts/verify_sessions.json`
3. Bot reçoit `/start verify_cs_xxx` → vérifie session → génère lien Telegram **à usage unique** (`member_limit: 1`)
4. Client reçoit le lien en DM → rejoint le canal Premium
5. Si annulation → `customer.subscription.deleted` → bot expulse automatiquement

---

## 📱 TELEGRAM — ARCHITECTURE (3 entités)

| Entité | Rôle | Géré par |
|---|---|---|
| `@touslesmatchs_bot` | Bot Free interactif (menus, pick, stats, bookmakers, upgrade) | `scripts/bot.js` |
| Canal **TousLesMatchs Premium** (ex-`@touslesmatchs_fr`) | Broadcast picks premium | `multi_agent.js` via `TELEGRAM_PREMIUM_CHAT_ID` |
| Bot **Hermès Admin** | Usage interne Greg | `hermes-admin` container |

### Bot Free — fonctionnalités :
- Menu principal avec inline keyboard
- `/start verify_SESSION` → activation Premium automatique
- Page Pick, Stats, Premium, Bookmakers
- Bouton "⬅️ Retour au menu" sur toutes les pages
- Liens affiliés : Winamax, Betclic, Unibet, PMU, ZEbet, ParionsSport
- Stripe upgrade buttons sur chaque page

### Fichiers partagés bot ↔ webhook :
- `scripts/verify_sessions.json` — sessions Stripe en attente de vérification
- `scripts/users_db.json` — mapping `telegram_id → customer_id` pour expulsions

---

## 🔐 SÉCURITÉ

- **JAMAIS** partager de clés API dans le chat
- **JAMAIS** merger la branche de dev dans `main`
- Clés exposées à révoquer : `ODDS_API_KEY` (75cab9...) + `TELEGRAM_ADMIN_BOT_TOKEN` (8986544902:...)
- `.env` uniquement sur le VPS, jamais dans le repo

---

## 🐛 BUG CONNU À RÉGLER

### `api` container crashe au démarrage
- **Erreur** : `Cannot find module './api_auth'` dans `analyse_live.js`
- **Cause** : `api_auth.js` n'existe pas dans le repo
- **Impact** : les appels `/api/*` depuis le frontend échouent
- **Fix à faire** : créer `scripts/api_auth.js` (vérification token utilisateur)

---

## 📌 NOTES DE TRAVAIL POUR LE CONCILE

- L'utilisateur (Greg) n'aime pas devoir vérifier derrière nous.
- Quand Greg dit "comme si tu jouais ta vie" : c'est une instruction
  ABSOLUE, pas une figure de style.
- Si doute → NOPICK toujours. Aucun pick n'est mieux qu'un mauvais pick.
- Hermès est chief, Claude vérifie. Tous deux gardiens de cette mémoire.
