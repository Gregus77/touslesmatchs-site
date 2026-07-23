# CHANGELOG — TousLesMatchs

## 🔄 EN COURS — À REPRENDRE (toujours maintenir à jour)

**Dernière IA active :** Claude · **Branche :** `claude/tiktok-arjel-automation-hgp1tv`
**Date :** 2026-07-23

**✅ Fait et déployé :**
- Refonte conversion complète (Hero + vote multi-IA, preuves, Pourquoi nous, méthode 5 étapes,
  comparatif offres, bandeau activité live, tunnel + compte gratuit, pages SEO).
- Fixes : doublons vitrine, vraies cotes ARJEL, cohérence résultats Telegram, Betclic retiré, seuil 82.
- Système de paliers **étape 1** : endpoint `/tier-stats` + section site "#paliers" (3 onglets).
- Système de paliers **étape 2** : `public/dashboard.html` affiche les stats par palier
  SELON le plan (free→Standard · premium→+Premium · elite→tout), paliers verrouillés floutés + CTA.
- Docs de passation : `AGENTS.md`, `POUR-LES-IA.md`, `CODEX.md`, `backup-db.sh`.

- Sécurité **P1 + P2** FAITES : rate limiting maison (auth 20/15min, global 600/min) +
  garde des endpoints `/admin/*` en lecture (admin OU token Hermès). Voir RAPPORT-AUDIT-2026-07-23.md.
  ⚠️ **Coordination Hermès** : son monitoring qui lit `/admin/health`, `/admin/scheduler-state`, etc.
  doit maintenant passer `?secret=<HERMES_ADMIN_TLM_BOT>` (sinon 403).

**🚧 À FAIRE (prochaines étapes) :**
- **Sécurité P3** : restreindre le CORS (`app.use(cors())` = `*`) au domaine touslesmatchs.com (au moins /admin).
- **Sécurité P4** : vérifier que `STRIPE_WEBHOOK_SECRET` est bien défini en prod (config .env, pas code).
- **Paliers étape 3 (ZONE HERMÈS, à coordonner)** : diffusion Telegram par palier + récap quotidien.
  Touche `council/` + Telegram → NE PAS faire sans accord d'Hermès. Réutiliser `rowIsArjel`, seuils 82/85/88.

**📋 Plus tard :**
- SEO : pages par équipe / championnat (en plus des pages par match).
- Google Search Console : soumettre `sitemap-pronostics.xml`.

---

## 2026-07-23

### Cohérence cotes : nom du bookmaker sur Telegram + site
- **fetchRealOdds** privilégie désormais NOS bookmakers partenaires (Winamax, Unibet, PMU)
  puis tout ARJEL, puis le premier — pour que le bookmaker affiché soit cliquable.
- **Telegram** (résultat Signal Fort) : la cote affiche le bookmaker source, ex : `Cote : 1.87 (Unibet)`
  (masqué si cote estimée).
- **Site** (carte du pick) : ajout de "chez <Bookmaker>" sous la cote.
- **/current-pick** renvoie désormais `bookmaker` (source réelle, null si estimation).
- Note : les cotes proviennent de l'endpoint /odds (pré-match). Avec le garde-fou
  "victoire déjà jouée", elles restent cohérentes. Cotes 100% in-play = étape séparée (plan API).

### Fix crédibilité : garde-fou "victoire déjà jouée" (Signal Fort)
- **Bug** : un signal "Victoire Apollon Limassol" est parti à la 64' alors que le score
  était 0-3 (pari déjà joué), avec une cote pré-match Unibet (1.87) irréaliste pour du live.
- **Cause** : `betIsPlayable` ne bloquait "victoire déjà acquise (écart ≥ 2 buts)" que si le
  pari contenait les mots "domicile"/"extérieur" — pas quand il contenait le NOM de l'équipe.
- **Fix** : reconnaissance de "Victoire <nom d'équipe>" (comparé à match.home/away) →
  bloque dès qu'une équipe mène de 2 buts. Les vrais signaux (0-0, 0-1) restent autorisés.
- Testé : 0-3 → bloqué ; 0-1/0-0 → autorisé ; 3-0 côté domicile → bloqué.
- Impact : crédibilité, conformité ANJ (plus de gain surévalué sur pari déjà joué).

### Bilan du jour en direct (feed accueil)
- Encart en tête de "Derniers verdicts" : analyses du jour, gagnées / perdues / en attente,
  et total gain/perte du jour (10€/pick sur les résolues). Frontend uniquement (calculé
  depuis PICKS_FEED, données déjà chargées). Se met à jour à la résolution des matchs.

### Sécurité — durcissement P1 + P2 (suite audit)
- **Rate limiting maison** (aucune dépendance, en mémoire) : `/auth/login` et `/auth/register`
  limités à 20 tentatives / 15 min / IP (anti-brute-force) ; limite globale 600 req / min / IP
  (anti-scraping, ne gêne aucun visiteur normal). Réponse `429` si dépassé.
- **Endpoints `/admin/*` en lecture protégés** : `/admin/leagues`, `/admin/agents`, `/admin/journal`,
  `/admin/markets`, `/admin/competitions`, `/admin/health`, `/admin/ai-specialization`,
  `/admin/monthly-history`, `/admin/alerts`, `/admin/scheduler-state`, `/admin/guardian-state`,
  `/admin/datahub-state`, `/admin/version`, `/admin/preflight`, `/admin/heartbeat`.
  Accès désormais : admin (email+code) **OU** token Hermès (`?secret=<HERMES_ADMIN_TLM_BOT>`).
- Middleware placé après `app.use(cors())`. `isAdmin` réutilisé (hoisté). Aucune route existante modifiée.
- ⚠️ Le monitoring Hermès doit ajouter `?secret=<token>` sur ces lectures.

### Signaux par palier — étape 2 (espace perso, visibilité selon le plan)
- **`public/dashboard.html`** : nouvelle section "Performance par palier" qui affiche
  les 3 track records SELON le plan de l'utilisateur (via `/api/auth/me` → `status`) :
  - `free` → Standard débloqué, Premium + Elite verrouillés (floutés + CTA "Débloquer")
  - `premium` (Pro) → Standard + Premium débloqués, Elite verrouillé
  - `elite` → les 3 débloqués (matchs "IA seulement" inclus)
- Données : `GET /api/tier-stats` (existant) + `GET /api/auth/me` (existant). Aucune route modifiée.
- Frontend uniquement, aucune écriture en base. Zone Telegram non touchée.
- Impact : conversion (upsell contextuel), valeur perçue des 3 abonnements.

### Signaux par palier — étape 1 (site + API, lecture seule)
- **Endpoint `/tier-stats`** : 3 track records séparés (Standard / Premium / Elite).
  Définition hybride : rang par confiance, contenu par dispo ARJEL.
  - Standard = ARJEL & confiance ≥ 88% (les fleurons, faible volume)
  - Premium = ARJEL & confiance ≥ 85% (inclut Standard)
  - Elite = tout le publié ≥ 82% (ARJEL + "IA seulement", gros volume)
  - Chaque palier : total, winrate, ROI simulé, 8 derniers résultats.
- **Section site "Chaque palier, sa performance"** (#paliers) : 3 onglets
  Standard/Premium/Elite, KPIs + track record par palier. Valorise les 3 abonnements.
- **Zone Telegram NON touchée** (réservée à Hermès) — diffusion par palier = étape 2 à coordonner.
- Lecture seule : aucune écriture en base.
- **backup-db.sh** ajouté : sauvegarde rapide tlm.db avant/après correctif.

## 2026-07-22

### Correctif Telegram — cohérence des résultats
- **Problème** : le canal gratuit postait « ✅/❌ + inscris-toi » pour des picks
  jamais diffusés (signaux bloqués : cote basse, hors ARJEL, plafond atteint).
  L'envoi du résultat ne vérifiait que la confiance, pas la diffusion réelle.
- **Fix** : traçage `sig_sent_free` / `sig_sent_premium` sur `concile_analyses`.
  Le résultat n'est posté que sur les canaux ayant réellement reçu le pick.
  Garde-fous ARJEL + qualité + cote mini **inchangés** (aucun assouplissement).

### P2 — Croissance (lot 3) — pages SEO dynamiques
- **Nouveau module `scripts/seo_pages.js`** (isolé, ne touche pas la base).
- **Pages `/pronostic/:slug`** : une page riche par analyse résolue (verdict du
  Conseil, confiance, cote, raisonnement, Schema.org SportsEvent, liens internes).
  Cible le long-tail Google ("pronostic <équipe> <équipe>").
- **Page `/pronostics`** : index de toutes les analyses (Schema.org CollectionPage).
- **`sitemap-pronostics.xml`** dynamique + référencé dans robots.txt.
- **Sécurité** : uniquement les analyses RÉSOLUES (win/loss) → preuves historiques,
  aucun pick payant dévoilé. Filtre bruit/ligues douteuses. Conforme ANJ (pas de
  "pari", disclaimer, 18+, aucune garantie de gain).
- Routes Caddy ajoutées + liens footer/sitemap pour l'indexation.
- Impact : trafic organique Google, autorité SEO.

### P2 — Croissance (lot 2) — tunnel de conversion
- **Section tunnel "Commence gratuitement en 3 étapes"** avant les offres :
  1) voir l'analyse du jour (gratuit) → 2) créer un compte gratuit → 3) passer Pro/Elite.
- **Compte gratuit reconnecté au funnel** : liens `/dashboard` ajoutés dans la nav
  (desktop + menu mobile). Le dashboard existait mais n'était lié nulle part.
- Impact : conversion (parcours progressif visiteur → inscrit → abonné).

### P2 — Croissance (lot 1)
- **Bandeau d'activité en direct** sous le Hero : analyses du jour, IA au vote,
  matchs analysés (total), signaux forts du jour. Compteurs 100 % réels via
  nouvel endpoint `/live-activity` (aucun chiffre inventé).

### P1 — Perception premium & confiance (lot 1)
- **Section "Pourquoi nous ?"** : 6 cartes glassmorphism sur le différenciateur
  multi-IA (5 IA pas une opinion, analyses croisées, score de confiance, historique
  public, ROI transparent, critères explicites).
- **Méthode passée à 5 étapes** : ajout de l'étape "Seuls les verdicts solides sont
  publiés" (transparence sur le seuil de confiance).
- **Comparatif des offres** : tableau clair 1€ Test / Pro / Elite sous les cartes
  (analyses, consensus, Telegram, Signal Fort, avant-première, historique, engagement).
- Impact : confiance, valeur perçue, conversion upsell.

### P0 — Refonte Hero orientée conversion (audit produit)
- **Panneau "Le Conseil délibère"** (effet WOW) : vote multi-IA en direct dans le Hero.
  Chaque agent (Alpha→Sigma, anonymisé) affiche son pari + confiance + couleur
  (vert = aligné, jaune = diverge), puis le verdict du Conseil en grand.
  - Nouvel endpoint API `/council-vote` (appelé `/api/council-vote`) : votes réels
    depuis `concile_analyses.agents_json`, noms d'IA masqués via `maskAiNamesGlobal`.
- **Hero reformulé** : angle différenciateur "5 IA votent, le Conseil tranche"
  (au lieu de "Hermes analyse / Tu décides"). Sous-titre insiste sur le vote multi-IA
  vs une seule IA chez les concurrents. Mot "pari"/"parie" évité (conformité ANJ).
- **CTA** : principal "🔥 Voir l'analyse du jour" (friction basse) + lien secondaire
  "tester le Conseil complet — 1€".
- **Barre de preuves** : ajout "Matchs analysés" + note "Mise à jour toutes les heures ·
  Historique 100 % public". Chiffres réels depuis /api/premium-teaser.
- Impact : conversion, valeur perçue, confiance, effet WOW.

### Correctifs cotes & doublons
- Suppression lien affilié Betclic (config, boutons, FAQ, anj_markets).
- Vraies cotes ARJEL (API-Sports) partout : signal-fort-stats, Telegram, pick du jour.
- Dédoublonnage infaillible du feed "Derniers verdicts" au rendu (par match+date).
- Seuil de publication : 82.

## 2026-07-21

### Phase 2 — Compte Gratuit + Dashboard
- **dashboard.html** : page Mon Espace avec inscription/connexion gratuite
  - KPIs : analyses restantes, analyses utilisees, anciennete
  - Historique personnel des analyses
  - CTA upgrade contextuel (Free → 1€ test, Pro → Elite)
- **API /auth/me** : endpoint profil utilisateur (tokens, plan, date creation)
- **API /user/history** : historique personnel des analyses revelees
- Impact : fidelisation, temps passe sur site, conversion upsell

### Phase 1 — SEO, Analytics, FAQ, Performances
- **robots.txt** : bloque /admin et /api, reference sitemap
- **sitemap.xml** : toutes les pages publiques indexees
- **GA4 + Clarity** : placeholders prets (IDs injectables par Hermes via window.__GA4_ID / window.__CLARITY_ID)
- **FAQ visible** : section FAQ rendue visible sur la page d'accueil + page standalone /faq
- **Methode visible** : section "Comment fonctionne Hermes" rendue visible
- **performances.html** : page publique avec KPIs temps reel (winrate, total, serie) + historique complet depuis /api/analysis-history
- **faq.html** : page FAQ standalone avec Schema.org FAQPage + methode Hermes + CTA
- **Navigation** : liens Performances, Methode, FAQ ajoutes dans nav + footer
- Impact : SEO (rich results Google), confiance utilisateur, conversion

### Blocage analyses Live IA
- Analyses bloquees avant la 25e minute (pas assez de statistiques)
- Analyses bloquees apres la 65e minute (cotes trop basses)
- Frontend : bouton grise + message explicatif
- API : validation serveur (securite)
- Impact : qualite des analyses, confiance utilisateur

### Collaboration multi-IA
- **AGENTS.md** : reference partagee entre toutes les IA (Claude, Codex, Hermes)
- **CODEX.md** : instructions specifiques pour GPT Codex
- **MISSION.md** : brief CTO permanent du projet
- Impact : coherence du developpement, protection contre les conflits

### Backups
- Sauvegarde REFERENCE v1 : `REFERENCE-STABLE-20260721_2134.tar.gz` (commit d23daf6)
- Sauvegarde REFERENCE v2 : `REFERENCE-STABLE-v2-20260721_2249.tar.gz` (commit 301cb50)
