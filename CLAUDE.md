# CLAUDE.md — Mémoire partagée du projet TousLesMatchs

> **🔄 SYNCHRONISATION MULTI-APPAREILS (téléphone ⇄ ordinateur)**
>
> Ce fichier est la **source de vérité** pour toutes les sessions Claude Code.
>
> ## ⚡ AU DÉBUT DE CHAQUE SESSION CLAUDE CODE
>
> **Étapes obligatoires** :
> 1. `git pull origin main` — synchronise code + CLAUDE.md
> 2. `git log --oneline -5` — vérifie les 5 derniers commits
> 3. Lis ce fichier en entier avant de toucher quoi que ce soit

---

## 🔥 PROCHAINE ACTION — SESSION PC (08/06/2026 soir)

### PRIORITÉ ABSOLUE — Stripe + Telegram sécurisés

**1. Stripe Dashboard** (dashboard.stripe.com)
- Créer produit "Premium" → 9,90€/mois récurrent → copier Price ID
- Créer produit "Premium Plus" → 19,90€/mois récurrent → copier Price ID
- Créer webhook → URL `https://touslesmatchs.com/api/stripe/webhook` → event `checkout.session.completed` → copier Signing secret

**2. GitHub Secrets** (repo → Settings → Secrets → Actions)
- `REACT_APP_STRIPE_PRICE_PREMIUM` = price_xxx
- `REACT_APP_STRIPE_PRICE_VIP` = price_xxx
- Relancer le workflow `deploy-site` après ajout

**3. VPS via SSH**
```bash
ssh user@72.61.167.175
nano .env
# Ajouter :
# STRIPE_SECRET_KEY=sk_live_xxx
# STRIPE_WEBHOOK_SECRET=whsec_xxx
# TELEGRAM_PREMIUM_CHAT_ID=-100xxxxxxxxx
docker-compose restart api
```

**4. Canal Telegram Premium**
- Créer canal privé "TousLesMatchs Premium"
- Ajouter le bot comme admin
- Récupérer Chat ID via `api.telegram.org/bot<TOKEN>/getUpdates`

**5. Pick HORS-ARJEL ce soir**
```bash
ssh user@72.61.167.175
node scripts/multi_agent.js
```

---

## ✅ CE QUI A ÉTÉ FAIT — SESSION 08/06/2026

- ✅ **FAILLE SÉCURITÉ CORRIGÉE** (commit bbbaf23) :
  - Boutons abonnement ne redirigent plus vers Telegram sans paiement
  - App.js : supprimé fallback Telegram dans `.catch()` — affiche erreur à la place
  - Subscription.js : `null` (gratuit) vs `undefined` (Stripe manquant) bien distincts
- ✅ **Section tarifaire en double supprimée** (commit 7dc7e2c) :
  - Section "NOS FORMULES" supprimée — dupliquait les encarts ACCÈS PREMIUM
  - Plus de card 19,90€ coupée sur mobile
- ✅ Stratégie business clarifiée : 2 plans seulement (9,90€ / 19,90€), 29,90€ reporté
- ✅ Règle 80/20 adoptée : automatiser/convertir avant d'ajouter des features

---

## 🚫 RÈGLES ABSOLUES — JAMAIS DE PICK SUR CES MATCHS

### ❌ AMICAUX — INTERDICTION TOTALE
**Leçon : Suisse 1-1 Australie (06/06/2026) — pari PERDU**
- Filtre dans `multi_agent.js` : `BANNED_LEAGUE_KEYWORDS` détecte "friendly", "amical", "exhibition"
- **Règle : JAMAIS de pick sur un amical**

### ❌ ÉQUIPES JEUNES / FÉMININES
- U17, U18, U19, U20, U21, U23 → REJET
- Women, Femmes, Femenino → REJET

### ✅ SEULS MATCHS AUTORISÉS
- Top 5 européens saison régulière
- Compétitions FIFA/UEFA officielles avec enjeu réel
- HORS-ARJEL : Copa Libertadores, Brasileirao, K-League, J-League, MLS (via Pinnacle uniquement)

---

## 💰 MODÈLE FREEMIUM VALIDÉ

### GRATUIT (0€) — permanent, jamais supprimer
- 1 pick ANJ / jour (Winamax, Betclic, PMU)
- Canal Telegram public
- Calculateur projection
- **Rôle : acquisition + preuve sociale**

### PREMIUM (9,90€/mois)
- Pick Premium ANJ + picks 3 jours à venir
- 10 analyses personnalisées/mois
- Canal Telegram Premium privé

### PREMIUM PLUS (19,90€/mois)
- Tout Premium + pick HORS-ARJEL (Pinnacle)
- 50 analyses personnalisées/mois
- Value Bets avancés + sports supplémentaires

> Le plan 29,90€ est reporté jusqu'à 50+ abonnés payants.

---

## 🎯 OBJECTIF IMMÉDIAT

**10 premiers abonnés récurrents** — tout le reste est secondaire.

Tunnel validé :
```
TikTok/SEO → Site → Email capture → Pick gratuit → Telegram gratuit
→ séquence email 7j → CTA Premium → Stripe → Telegram Premium
```

---

## 📊 ÉTAT AVANT PUBLICITÉ — CHECKLIST

| Élément | Statut |
|---|---|
| Stripe sécurisé | 🔴 À faire ce soir |
| Telegram sécurisé (webhook) | 🔴 À faire ce soir |
| Historique réel | ✅ 27 picks, 78% winrate |
| ROI réel | ✅ Affiché sur le site |
| Analytics GA4 | ✅ Installé (funnel à configurer) |
| Capture email | 🟡 Formulaire OK, séquence manquante |
| Dashboard Admin | 🔴 Non |
| Mobile optimisé | ✅ |
| Processus abonnement fiable | 🔴 Stripe manquant |

> NE PAS lancer de publicité payante avant que Stripe + Telegram soient verts.

---

## 🗺️ ROADMAP 30 JOURS

### Semaine 1 — Sécuriser le tunnel
- Stripe configuré + webhook → accès Telegram automatique
- Canal Telegram Premium privé créé
- Email contact@touslesmatchs.com (Hostinger)
- Brevo configuré (300 emails/jour gratuit)

### Semaine 2 — Activer l'acquisition organique
- TikTok : 7 premières vidéos (1/jour)
- Séquence Brevo : 7 emails automatiques après inscription
- Page SEO `/pronostic-foot-aujourd-hui`
- Funnel GA4 configuré

### Semaine 3 — Optimiser la conversion
- Test complet tunnel A→Z (carte test Stripe 4242...)
- Premier email envoyé à la liste capturée
- Objectif : 3 abonnés payants

### Semaine 4 — Mesurer et itérer
- Lire données GA4 (d'où viennent les visiteurs ?)
- Analyser picks perdus → ajuster filtres Hermès
- Objectif : **10 abonnés récurrents**

---

## 🏗️ Architecture

- **Frontend** : React (src/App.js) — buildé et servi par Caddy
- **Serveur web** : Caddy (Caddyfile) — HTTPS auto
- **Orchestrateur IA** : `scripts/multi_agent.js` (Node.js, 11h59)
- **Bot Telegram** : `scripts/bot.js`
- **Docker** : 3 conteneurs — `site`, `api`, `bot`
- **VPS** : Hostinger — `72.61.167.175`
- **CI/CD** : GitHub Actions → push main → redéploiement auto

---

## 📁 Fichiers clés

```
src/App.js              ← picks[] + UI — modifié par Hermès à 11h59
src/Subscription.js     ← page abonnements Stripe
scripts/multi_agent.js  ← orchestrateur IA (RapidAPI + Groq + DeepSeek)
scripts/bot.js          ← bot Telegram multilingue
scripts/analyse_live.js ← serveur API Node (port 3001) + endpoint /subscribe
scripts/picks_history.json ← historique JSON
.github/workflows/      ← deploy-site.yml + deploy-api.yml
```

---

## 🔑 Variables .env VPS (jamais dans le repo)

```env
GROQ_API_KEY=
DEEPSEEK_API_KEY=
RAPIDAPI_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_PREMIUM_CHAT_ID=   ← À créer
STRIPE_SECRET_KEY=           ← À ajouter
STRIPE_WEBHOOK_SECRET=       ← À ajouter
WINAMAX_LINK=https://www.winamax.fr/parrain?code=77953728
```

---

## ✅ Ce qui fonctionne

- [x] Génération picks automatique à 11h59 (GitHub Actions)
- [x] Anti-doublon (meilleure note conservée)
- [x] Bot Telegram multilingue FR/EN/ES/IT/RU
- [x] HTTPS automatique (Caddy)
- [x] Filtre ARJEL/ANJ (60+ nations whitelistées)
- [x] Filtre anti-amicaux (BANNED_LEAGUE_KEYWORDS)
- [x] Animations dynamiques (countdown, compteurs, ticker, pulse)
- [x] Calculateur de projection
- [x] GA4 intégré
- [x] SEO (sitemap, robots.txt, JSON-LD, hreflang 5 langues)
- [x] Faille sécurité abonnements corrigée

## ❌ À faire (priorité décroissante)

1. Stripe : Price IDs + webhook → accès Telegram automatique
2. Canal Telegram Premium privé
3. Email professionnel + séquence Brevo 7 jours
4. TikTok : 1 vidéo/jour (pick du jour)
5. Page SEO `/pronostic-foot-aujourd-hui`
6. Funnel GA4 (events email_capture → click_premium → purchase)
7. Dashboard Admin simple
8. Script vidéo TikTok automatique (ffmpeg + template)

---

## 📊 Stats (08/06/2026)

- Picks : 27 | Gagnés : 21 | Perdus : 6
- Winrate : **78%** | Sports : Foot, Hockey, Baseball

## 🚨 Sécurité

- Clés API uniquement dans `.env` sur VPS — jamais dans le repo
- Stripe PriceIDs dans GitHub Secrets (REACT_APP_*)
- Telegram Premium = accès uniquement après webhook Stripe confirmé
