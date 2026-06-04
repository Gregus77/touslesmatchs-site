# CLAUDE.md — Mémoire partagée du projet TousLesMatchs

> **🔄 SYNCHRONISATION MULTI-APPAREILS (téléphone ⇄ ordinateur)**
>
> Ce fichier est la **source de vérité** pour toutes les sessions Claude Code.
> Sur mobile ou desktop, ce fichier garde l'état du projet partagé via Git.
>
> ## ⚡ AU DÉBUT DE CHAQUE SESSION CLAUDE CODE (Mobile OU Desktop)
>
> **Étape obligatoire** : `git pull origin main`
> Cela synchronise le code + ce CLAUDE.md avec la dernière version.
>
> Ensuite **lis ce fichier en entier** pour connaître :
> - Où en est le projet
> - Ce qui marche
> - Ce qui est en cours
> - La prochaine action à faire (section "🔥 PROCHAINE ACTION")
>
> ## 📱 INSTRUCTIONS SPÉCIFIQUES MOBILE
>
> Si tu es sur Claude Code mobile :
> 1. Vérifie d'abord `git status` pour voir les modifs en cours
> 2. Si modifications non commitées : commit + push immédiatement
> 3. Travaille sur des **petits changements** (mobile = moins de tokens)
> 4. **Toujours `git push`** à la fin pour synchroniser avec le desktop
>
> ## 💾 ÉTAT PARTAGÉ
>
> À la fin de chaque session importante, **mettre à jour** :
> - Section "🔥 PROCHAINE ACTION" ci-dessous
> - Section "📅 DERNIÈRE SESSION"
> - `git add CLAUDE.md && git commit -m "etat: synthese session" && git push`

---

## 🔥 PROCHAINE ACTION (à faire au prochain démarrage)

**04/06/2026 23h — Status**: 
- ✅ Phase 0: Audit complet terminé
- ✅ Phase 1: Bug 405 Analyse Live CORRIGÉ → déployé VPS
- ✅ Phase 2: Architecture multi-IA implémentée
  - Fallback routing: DeepSeek → OpenRouter → Gemini → Mistral → Fallback
  - Nouveau script: `scripts/verify_apis.js`
  - multi_agent.js refactorisé avec `callWithFallback()`
- 🚧 Phase 2 suite: Exécuter vérification des APIs (voir ci-dessous)
- 🚧 Phase 3: Analyse Live V2 (simplification UI)
- 🚧 Phase 5: Stripe (clés manquantes)

---

## 🎯 STRATÉGIE COMPLÈTE TOUSLESMATCHS (à implémenter étape par étape)

### 1️⃣ Flux financier
- Clients s'inscrivent via affiliés **PMU, Winamax, ParisPortif**
- Gains reversés vers **Pinnacle**
- Réinvestissement en **ETFs Trade Republic** via revenus Stripe

### 2️⃣ Abonnement Stripe
- Paiement récurrent **5-10€/jour** pour accès picks IA
- Webhook Stripe pour activation compte client après paiement
- Plans : Free / Standard 9.90€ / Premium 19.90€

### 3️⃣ Calculateur projection interactive (page publique)
- Client rentre montant initial → voit 3 scénarios sur 6 mois
- Basé sur stats réelles : 21/23, cote moyenne 1.52, Kelly modéré 1.5x
- Formule : `Bank finale = Bank initiale × (1 + ROI)^nb_jours`

### 4️⃣ Gestion mise progressive (Python script)
- À chaque pari gagné → calcule mise suivante via **Kelly 1.5x**
- À chaque perte → réduit mise de **-10%**
- Stop-loss : 3 pertes d'affilée → réduction **-50% pendant 2 jours**

### 5️⃣ Google Analytics 4
- Implémenter GA4 sur toutes les pages
- Track : inscriptions, clics Stripe, temps sur calculateur, taux conversion

### 6️⃣ Responsive design + Vidéos
- Mobile / Tablette / Desktop (en cours d'amélioration)
- Garder **dark black & or**
- Ajouter vidéos buts foot/hockey 5-8s en boucle (sources gratuites)

### 7️⃣ Historique paris (logging complet)
- Chaque pick enregistre : date, cote réelle, résultat, mise
- Stats mises à jour en direct (déjà partiellement fait)

---

## ⚡ ACTIONS IMMÉDIATES (cette session)

1. ✅ Doublons picks corrigés (déduplication runtime)
2. ✅ Stats dynamiques (+394% remplacé par ROI calculé)
3. ✅ Bandeau stats grid 2×2 (plus de débordement mobile)
4. ✅ Header mobile compact (TikTok + drapeaux IT/ES/RU cachés)
5. ✅ **Calculateur de projection** (page /calculateur) — 3 scénarios réalistes basés sur stats réelles
6. ✅ **Google Analytics 4** intégré (G-ME2T7G7PSK)
7. ✅ **FILTRE ARJEL** : ne sélectionne QUE matchs dispo Winamax/Betclic/Unibet
   - LIGUES_ARJEL : Top 5 européens + UCL + UEL + Nations League
   - NATIONS_ARJEL : 60+ nations whitelistées (Europe + Amériques + Afrique + Asie majeures)
   - REJET : Cambodia, Bhutan, Angola, Iraq, Mauritania, etc.
   - Si aucun match ARJEL → "PAS DE PARI - Aucun match dispo bookmakers FR"
7. ⏳ Stripe abonnement (priorité prochaine session)
8. ⏳ Capture email (lead magnet)
9. ⏳ CTA affiliés optimisés sur chaque pick
10. ⏳ Vidéos hero (Phase 3)

## 💰 MODÈLE FREEMIUM (stratégie validée)

### Tier GRATUIT (0€)
- ✅ 1 pick/jour ARJEL (Winamax, Betclic, Unibet, PMU)
- ✅ Site touslesmatchs.com accessible
- ✅ Canal Telegram public
- ✅ Calculateur projection

### Tier PREMIUM (19,90€/mois)
- ✅ 1 pick ARJEL + 1 pick **HORS-ARJEL** (Pinnacle, PS3838)
- ✅ Cotes supérieures sur matchs internationaux (Asie, Afrique, Amérique latine)
- ✅ Canal Telegram premium privé
- ✅ Sans engagement, Stripe sécurisé

### Système implémenté
- `multi_agent.js` génère maintenant : `pick` (ARJEL gratuit) + `premium_arjel` + `premium_hors_arjel`
- Encart Premium 19,90€/mois sur la page d'accueil
- CTA "💎 Devenir Premium" track via GA4 event `click_premium_cta`

## 🗺️ ROADMAP RENTABILITÉ

**Phase 1 (FAIT)**
- ✅ Calculateur de projection
- ✅ GA4 (mesurer trafic)
- ✅ Modèle Freemium ARJEL vs Premium
- ✅ Encart Premium 19,90€/mois

**Phase 2 (prochaine) — Stripe**
- 🔄 Page paiement Stripe Checkout
- 🔄 Webhook activation compte client
- 🔄 Gestion canal Telegram premium privé (ajout/retrait abonnés)

**Phase 3 — Croissance**
- TikTok auto-post
- Vidéos hero foot/hockey
- SEO optimisé (sitemap, meta tags)

---

## 📅 DERNIÈRE SESSION (04/06/2026)

- ✅ Concile simplifié : Claude/Gemini/Mistral/Qwen SUPPRIMÉS, Groq+DeepSeek actifs
- ✅ Basketball désactivé (33% réussite vs 87% Hockey)
- ✅ Anti-doublon : seul le pick avec meilleure note conservé
- ✅ Build React intégré au workflow GitHub Actions
- ✅ Skill Antithèse (audit auto) : `scripts/antithese_audit.js`
- ✅ Script test complet : `scripts/test_all.js`
- ✅ Responsive mobile amélioré (breakpoints 480px + 360px)
- ✅ CLAUDE.md enrichi pour sync mobile/desktop

---

## 🏗️ Architecture réelle (branche `main` = production)

### Stack technique
- **Frontend** : React (src/App.js) — buildé et servi par Caddy
- **Serveur web** : Caddy (Caddyfile) — port 80/443 avec HTTPS auto
- **Orchestrateur IA** : `scripts/multi_agent.js` (Node.js)
- **Bot Telegram** : `scripts/bot.js` (Node.js — polling)
- **Docker** : 3 conteneurs — `site` (Caddy+React), `api` (Node), `bot` (Node)
- **VPS** : Hostinger — IP `72.61.167.175`
- **CI/CD** : GitHub Actions → push sur `main` → redéploiement auto VPS

### Agents IA dans multi_agent.js (Phase 2: Multi-IA)
| Composant | Rôle | Status |
|-----------|------|--------|
| RapidAPI | Données matchs foot | ✅ Stable |
| Groq/Llama3 | Enrichissement cotes | ✅ Actif |
| **Fallback Router** | Chef — essai séquentiel | ✅ NOUVEAU (Phase 2) |
| → DeepSeek | 1er choix | ✅ Configuré |
| → OpenRouter | Fallback 1 | 🟡 À configurer |
| → Gemini | Fallback 2 | 🟡 À configurer |
| → Mistral | Fallback 3 | 🟡 À configurer |
| → Manual | Fallback final | ✅ Toujours disponible |

**Flux Phase 2:**
```
RapidAPI → matchs
  → Groq → cotes
    → callWithFallback([DeepSeek, OpenRouter, Gemini, Mistral])
      → premier succès = pick retourné
      → tous échoués = fallback manuel (best cote)
```

### Flux quotidien (GitHub Actions, 11h59)
```
RapidAPI → matchs du jour (3 jours)
  → Groq enrichit les cotes
  → DeepSeek choisit le meilleur pick (note 7-10)
  → updateAppJs() → src/App.js mis à jour
  → git commit + push
  → Telegram canal gratuit notifié
  → Site React rebuildé sur VPS
```

---

## 📁 Fichiers clés

```
/
├── src/App.js              ← Contient le tableau picks[] — MODIFIÉ par Hermès
├── scripts/
│   ├── multi_agent.js      ← Orchestrateur principal (RapidAPI+Groq+DeepSeek)
│   ├── bot.js              ← Bot Telegram (multilingue FR/EN/ES/IT/RU)
│   ├── hermes_learn.js     ← Apprentissage basé sur résultats passés
│   ├── antithese_audit.js  ← Vérificateur automatique (l'antithèse)
│   ├── check_results.js    ← Vérification résultats des picks
│   ├── analyse_live.js     ← Analyse live (en développement)
│   └── picks_history.json  ← Historique JSON des picks
├── Caddyfile               ← Config serveur web (HTTPS auto)
├── docker-compose.yml      ← 3 services: site + api + bot
├── .env.example            ← Variables requises
└── .github/workflows/      ← CI/CD automatique
```

---

## 🔑 Variables d'environnement requises (.env sur VPS)

```env
# IAs
GROQ_API_KEY=              # Groq/Llama3 (gratuit)
DEEPSEEK_API_KEY=          # DeepSeek chef (peu coûteux)

# Sport data
RAPIDAPI_KEY=              # free-api-live-football-data
FOOTBALL_DATA_KEY=         # API football secondaire

# Telegram
TELEGRAM_BOT_TOKEN=        # @BotFather → /newbot
TELEGRAM_CHAT_ID=          # Canal gratuit (ex: @touslesmatchs)
TELEGRAM_PREMIUM_CHAT_ID=  # ⬅️ À CRÉER — canal premium privé

# Bookmakers (liens affiliation)
WINAMAX_LINK=              # ⬅️ À REMPLACER par lien perso (pas WMX8M5)
```

---

## ✅ Ce qui fonctionne déjà

- [x] Génération automatique des picks à 11h59 (GitHub Actions)
- [x] Mise à jour automatique de src/App.js
- [x] Anti-doublon : garde le pick avec la meilleure note
- [x] Bot Telegram multilingue (FR/EN/ES/IT/RU)
- [x] Notification Telegram canal gratuit après génération
- [x] Système d'apprentissage Hermes (hermes_learn.js)
- [x] Vérificateur antithèse (antithese_audit.js)
- [x] HTTPS automatique via Caddy
- [x] Filtre : seules les grandes ligues (MAJOR leagues IDs)
- [x] Lien Winamax perso (code=77953728) — remplacé WMX8M5
- [x] Picks premium 7-7.9/10 → TELEGRAM_PREMIUM_CHAT_ID (multi_agent.js)
- [x] Fix responsive mobile — plus de scroll horizontal (commit b5b1377)

---

## ✅ Phases Complétées

- [x] **Phase 0** — Audit complet du projet
- [x] **Phase 1** — Correction bug 405 Analyse Live (routing Caddy)
- [x] **Phase 2** — Architecture multi-IA (fallback DeepSeek → OpenRouter → Gemini → Mistral)

## ❌ Ce qui reste à faire (par ordre de priorité)

### Phase 2 (suite) — Configuration multi-IA
- [ ] Ajouter clés OpenRouter/Gemini/Mistral au `.env` sur VPS
- [ ] Exécuter `node scripts/verify_apis.js` pour tester chaque API
- [ ] Vérifier logs de `multi_agent.js` lors de la prochaine génération (11h59)

### Phase 3 — Simplification Analyse Live
- [ ] Frontend: supprimer champs compétition/score/minute (auto-complétés)
- [ ] Backend: enrichir auto-fetch de `match_id` via API sport
- [ ] Affichage : probabilités Over/BTTS/1X2 avec couleurs (vert/jaune/rouge)
- [ ] Tester page /analyse-live en tant qu'utilisateur

### Phase 4 — Comptes Utilisateurs
- [ ] Inscription email/pwd
- [ ] Système de statuts (Free/Premium/VIP/Elite)
- [ ] Stockage base de données

### Phase 5 — Stripe
- [ ] Ajouter clés Stripe au `.env` VPS
- [ ] Tester paiement (checkout + webhook)
- [ ] Intégration "après paiement → accès Premium"

### Phase 6 — Quotas
- [ ] Free : 3 analyses
- [ ] Premium : 10 analyses/jour
- [ ] VIP : 30 analyses/jour

### Future
- [ ] Créer canal Telegram premium privé + TELEGRAM_PREMIUM_CHAT_ID
- [ ] Telegram Admin privé (pilotage depuis Telegram)
- [ ] Analytics (Plausible + Google Analytics + Search Console)
- [ ] Base email + email quotidien
- [ ] Dashboard Admin
- [ ] Surveillance automatique Hermès (toutes les heures)
- [ ] Parrainage + Gamification
- [ ] Croissance (SEO, TikTok, Ads)

---

## 🔄 Règles de synchronisation téléphone ↔ ordinateur

**Au début de chaque session Claude Code (téléphone OU ordinateur) :**
```bash
git pull origin main
```

**Toujours travailler sur `main`** — c'est la branche de production.

> ⚠️ La branche `claude/docker-multi-ai-setup-aLpF3` est une architecture
> Python parallèle créée en session. Ne pas merger dans `main` — elle
> écraserait l'architecture Node.js existante.

**Après chaque modification :**
```bash
git add -A && git commit -m "description" && git push origin main
```

---

## 📊 Stats actuelles (04/06/2026)

- Picks totaux : 27
- Gagnés : 21 | Perdus : 6
- Winrate : **78%**
- Sports couverts : Foot, Hockey

---

## 🚨 Important — sécurité

- Ne jamais partager de clés API dans le chat
- Les clés exposées (Anthropic + OpenAI) doivent être régénérées
- Toutes les clés vont dans `.env` sur le VPS uniquement (jamais dans le repo)
