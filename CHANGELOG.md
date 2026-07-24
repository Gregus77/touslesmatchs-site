# CHANGELOG — TousLesMatchs

## 🔄 EN COURS — À REPRENDRE (toujours maintenir à jour)

**Dernière IA active :** Codex · **Branche :** `codex/dashboard-premium-redesign`
**Date :** 2026-07-24

**✅ Fait et déployé :**
- Refonte conversion complète (Hero + vote multi-IA, preuves, Pourquoi nous, méthode 5 étapes,
  comparatif offres, bandeau activité live, tunnel + compte gratuit, pages SEO).
- Fixes : doublons vitrine, vraies cotes ARJEL, cohérence résultats Telegram, Betclic retiré, seuil 82.
- Système de paliers **étape 1** : endpoint `/tier-stats` + section site "#paliers" (3 onglets).
- Docs de passation : `AGENTS.md`, `POUR-LES-IA.md`, `CODEX.md`, `backup-db.sh`.

**Fait sur branche Codex, pas encore deploye :**
- Refonte visuelle de l'accueil `public/index.html` en cockpit dashboard premium inspire de la maquette fournie.
- Derniere passe UX : premiere vue allegee type capture, ticker masque, navigation desktop simplifiee, calendrier retire du hero.
- Nouveau tableau dashboard branche sur `/api/live-matches` avec fallback preview locale vers le site public.
- Passe "moins usine a gaz" : rail et KPIs caches sur le premier ecran, et faux dessin Live IA remplace par une photo sportive locale `public/assets/tlm-player-night.jpg`.
- Moteur signaux par palier ajoute dans `scripts/api_server.js` : Standard 3/jour >=88, Premium 10/jour >=90, Elite 30/jour >=90, cote reelle ARJEL >=1.50, sports cibles foot/basket/hockey/baseball.
- Nouvelles routes : `GET /api/tier-signals`, `POST /internal/tier-signals/preview`, `POST /internal/tier-signals/send` (`dryRun` par defaut).
- Auto-envoi prepare mais desactive par defaut : `TIER_SIGNALS_AUTO_SEND=1` requis pour declencher l'envoi periodique.
- Le groupe Telegram historique gratuit devient le groupe **Standard** : `TELEGRAM_STANDARD_CHANNEL_ID` prend le relais, avec fallback legacy sur `TELEGRAM_CHANNEL_ID`.
- Accueil + emails alignes sur la gamme **Standard 4,90€ / Premium 14,90€ / Elite-VIP 29,90€** : suppression de la mise en avant publique du test 1 euro, ajout de `STRIPE_PRICE_ID_STANDARD`, quotas backend Standard=3 / Premium=10 / Elite-VIP=30 et page SEO `/signaux-sportifs-ia`.
- Boutons Stripe accueil branches sur les Payment Links publics : Standard `00w14ncbGgo48c4fpA3VC05`, Premium `6oU3cvdfK4Fm0JC1yK3VC06`, Elite/VIP `4gM9AT5Nifk0gIA91c3VC07`, avec tentative backend checkout d'abord.
- UX accueil : les resultats de la veille sont repliees par defaut ; les matchs live cliquables renvoient vers le choix Standard/Premium/Elite-VIP.
- Correctif UX accueil : les matchs live du haut se rafraichissent toutes les 30 secondes, l'ancienne ancre `#plans` ne force plus l'ouverture sur les abonnements, et le tableau comparatif ne repete plus les prix sous les cartes.
- Correctif coherence tarifs : `public/js/i18n.js` ne reecrit plus les boutons Premium/Elite avec les anciens prix ; FAQ, Live IA et dashboard alignes sur Standard 4,90 / Premium 14,90 / Elite-VIP 29,90.
- Correctif routage Stripe/Telegram : chaque paiement Standard/Premium/Elite-VIP cree maintenant une invitation vers le bon canal Telegram du plan ; ajout d'un endpoint admin `/admin/subscription-routing` sans exposition des IDs sensibles.
- Rapport Hermes Admin 22h remplace par un rapport decisionnel : meilleurs candidats, volumes Standard/Premium/Elite, championnats/sports/IA qui performent, et etat de l'auto-diffusion clients.
- Docker Compose expose maintenant a l'API `STRIPE_PRICE_ID_STANDARD`, `STRIPE_WEBHOOK_SECRET`, les canaux Telegram Standard/Elite, `HERMES_ADMIN_TLM_BOT` et `TIER_SIGNALS_AUTO_SEND`.
- Hooks conserves : Stripe, Telegram, TikTok, bookmakers Winamax/Unibet/PMU, Brevo, historiques et endpoints front.

**🚧 À FAIRE (prochaine étape immédiate — demandé par Grégory) :**
- Ajouter les logos/fanions des equipes sur les cartes de matchs live et la carte du match du jour.
- Remonter les vrais matchs en temps reel tout en haut de l'accueil/direct, avec donnees `/api/live-matches` et fallback propre si aucun match qualifie.
- Au clic sur un match live, garder le tunnel clair : proposer Standard / Premium / Elite-VIP, sans afficher d'analyse payante directement.

**🚧 À FAIRE (suite) — Paliers étape 2 :**
- Dans `public/dashboard.html` (espace perso), afficher les stats **selon le plan de l'utilisateur** :
  - Standard → voit uniquement les stats du palier Standard
  - Premium (pro) → voit Standard + Premium
  - Elite → voit tout (Standard + Premium + Elite, dont matchs "IA seulement")
- Données déjà dispo : `GET /api/tier-stats` (renvoie les 3 paliers) + `GET /api/auth/me` (renvoie `user.status`).
- Mapping plans : `free`/`standard` → standard · `pro` → premium · `elite` → elite.
- Ne PAS toucher au Telegram (étape 3, zone Hermès).

**📋 Plus tard :**
- Paliers étape 3 (diffusion Telegram par palier + récap quotidien) — coordonner avec Hermès.
- SEO : pages par équipe / championnat (en plus des pages par match).
- Google Search Console : soumettre `sitemap-pronostics.xml`.

---

## 2026-07-23

### Codex - Refonte accueil dashboard premium (branche `codex/dashboard-premium-redesign`)
- `public/index.html` : hero transforme en cockpit dashboard sombre, avec intro, cartes KPI, panneau Concile central, calendrier/activite laterale et bloc Live IA.
- Les liens/API existants sont conserves : Stripe, Telegram, TikTok, bookmakers Winamax/Unibet/PMU, Brevo, historique, paliers et endpoints front.
- Fallback ajoute pour garder le panneau central visible si `/api/council-vote` ne repond pas encore.
- Verification locale Chrome : pas de debordement horizontal desktop/mobile, 7 liens Stripe, 10 liens Telegram, 28 references `/api/` detectees.
- Passe design supplementaire : logos bookmakers visibles dans le hero + carte joueur stylisee dans la colonne droite, pour se rapprocher de la maquette dashboard premium.
- Passe conversion : hero simplifie en parcours "matchs en cours -> Standard/Premium/Elite -> bookmakers", avec fallback local vers l'API publique pour la preview.
- Passe sobriete apres retour fondateur : ticker masque, nav visible reduite, calendrier retire du premier ecran, tableau "Matchs en cours" branche a `/api/live-matches` et rendu mobile compacte.
- Passe effet pro : photo sportive locale dans la carte Live IA, badges bookmakers inspires des couleurs de marque sans fichiers de logos officiels, et etat vide "Radar en cours" au lieu d'un grand tableau creux.
- Moteur Telegram/site par palier : colonnes `sig_sent_standard` / `sig_sent_elite`, endpoint public de volumes du jour, routes internes Hermes preview/send, et section "#paliers" alignee sur les nouvelles regles.

### Signaux par palier — étape 1 (site + API, lecture seule)
- **Endpoint `/tier-stats`** : 3 track records séparés (Standard / Premium / Elite).
  Définition hybride : rang par confiance, contenu par dispo ARJEL.
  - Standard = ARJEL & confiance ≥ 88% (les fleurons, faible volume)
  - Premium = ARJEL & confiance ≥ 85% (inclut Standard)
  - Elite = tout le publié ≥ 82% (ARJEL + "IA seulement", gros volume)
  - Chaque palier : total, winrate, ROI simulé, 8 derniers résultats.
- **Section site "Chaque palier, sa performance"** (#paliers) : 3 onglets
  Standard/Premium/Elite/VIP, KPIs + track record par palier. Valorise les 3 abonnements.
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
