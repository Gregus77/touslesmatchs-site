# CHANGELOG — TousLesMatchs

## 2026-08-28 — Fin publique de la bêta et tunnel gratuit maîtrisé

- L'application ne présente plus d'accès fondateur, de cycle bêta ni de places
  gratuites +0,5 ; les anciennes candidatures restent archivées côté admin.
- Toute nouvelle candidature bêta est refusée proprement par l'API avec HTTP 410.
- Le compte gratuit conserve le pick vitrine et les résultats publics ; les
  sélections exactes +0,5 et leurs alertes sont réservées aux membres dès 4,90€.
- Le cache PWA passe en v7 pour retirer les anciens libellés des appareils déjà installés.

## 2026-08-28 — Traçabilité prématch et compteur Live

- Les picks H2H prématch sont désormais marqués explicitement comme internes et non diffusables.
- Les anciennes lignes prématch sans motif de blocage sont régularisées au démarrage sans toucher aux signaux live.
- Le compteur `analyses_today` de `/live-activity` exclut le prématch interne.

## 2026-08-28 — Réparation du tunnel Concile → Telegram

- Le moteur automatique filtre désormais les matchs hors produit client avant les cinq appels IA : football, championnat fiable et minute 15 à 40.
- Le préfiltre des cotes ARJEL est limité au marché Over/Under 2,5.
- `/api/live-activity` ne présente plus une analyse à forte confiance comme un signal : une livraison Telegram réussie avec `message_id` est maintenant obligatoire.
- Le plafond de sécurité OpenRouter reste inchangé à 100 appels par jour.

## 2026-08-28 — Cohérence publique, fin de la bêta fondatrice et cache PWA

- L'accueil utilise désormais exactement le bloc `stats.abonnes` de
  `/analysis-history`, comme la page Résultats : il ne recompte plus les
  observations non diffusées parmi les résultats clients.
- Les libellés publics distinguent les marqueurs d'envoi archivés de l'ancien
  système et les preuves Telegram obligatoires depuis le 27 août.
- La campagne publique Goal +0,5 « Accès fondateur / Cycle 01 » et ses liens APK
  ont été retirés de l'accueil ; aucune fenêtre bêta ne s'ouvre automatiquement.
- Les fenêtres restantes sont bornées au viewport mobile, sans largeur minimale
  ni débordement horizontal.
- Le service worker passe en v5 et ne supprime que les anciens caches
  `tlm-app-*`, afin d'éliminer l'ancienne page sans toucher d'autres caches.

## 2026-08-27 — Fiabilisation client Over/Under 2,5

- Le chatbot journalise désormais les erreurs fournisseur et bascule automatiquement
  de Perplexity vers Mistral en cas de refus HTTP, timeout ou réponse vide.
- La page Résultats applique désormais le même historique vérifié au fondateur
  connecté qu'aux visiteurs ; les analyses brutes restent consultables uniquement
  dans l'audit quotidien d'administration.
- Le verdict client est désormais construit uniquement à partir des cinq bulletins
  réels `buts` du Concile, et non du pari principal libre de chaque IA.
- Aucun signal ne part si les cinq sièges O/U 2,5 ne sont pas renseignés, si la
  majorité est inférieure à 4/5, si la confiance est sous 80, ou sans cote bookmaker.
- La diffusion est limitée au football de championnat entre la 15e et la 40e minute ;
  les autres sports, marchés, coupes, barrages, amicaux et ligues non fiables restent
  disponibles uniquement pour l'audit interne.
- L'historique antérieur est conservé. Seule la journée défectueuse du 26 août est
  retraitée : analyses non envoyées, autres marchés et consensus sous 4/5 sont retirés.
- Pour ce retraitement, le quorum est recalculé depuis les cinq bulletins O/U 2,5
  stockés par instant de match ; l'ancien consensus principal n'est plus cru seul.
- Le filtre de diffusion est appliqué avant le dédoublonnage des snapshots d'un
  match : une observation tardive ne peut plus remplacer l'instant exact envoyé.
- Chaque futur envoi de signal conserve le `message_id` retourné par Telegram afin
  d'apporter une preuve durable de livraison et de distinguer analyse et diffusion.

## 2026-08-26 — Réparation des cinq votes live Over/Under 2,5

- L'API `/live-matches` joint désormais les cinq avis individuels réels du marché Over/Under 2,5 enregistrés dans `agent_market_predictions`.
- L'application affiche chaque direction (`O` ou `U`) et le décompte Over/Under entre la 15e et la 40e minute, sans déduire ces votes d'un consensus global.
- Le Chief reste un arbitre interne et n'est plus sauvegardé ni exposé comme une sixième IA.
- Un agent officiel ne bascule plus silencieusement vers le modèle Groq générique sous un faux libellé.
- Aucun signal Telegram client n'est désormais diffusé sous quatre votes concordants sur cinq ; un accord 3/5 reste une tendance interne.

### Brevo et Telegram

- Les erreurs Brevo ne sont plus transformées en fausses réussites : upsert contact
  strict, attributs complets, liste facultative et contrôle de la clé au démarrage.
- Les anciens noms de variable du canal Telegram gratuit restent acceptés et chaque
  canal est contrôlé au démarrage. `/health` expose uniquement l'état, jamais les clés.

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
- Système de paliers **étape 3** : `computeSignalTier()` classe chaque signal (Standard/Premium/Elite),
  colonne `signal_tier` en base, diffusion Telegram filtrée par palier (gratuit = Standard+Premium,
  premium = tout, admin = tout). Fenêtre d'analyse élargie 30-75' (était 35-75').
- Docs de passation : `AGENTS.md`, `POUR-LES-IA.md`, `CODEX.md`, `backup-db.sh`.

- Sécurité **P1 + P2** FAITES : rate limiting maison (auth 20/15min, global 600/min) +
  garde des endpoints `/admin/*` en lecture (admin OU token Hermès). Voir RAPPORT-AUDIT-2026-07-23.md.
  ⚠️ **Coordination Hermès** : son monitoring qui lit `/admin/health`, `/admin/scheduler-state`, etc.
  doit maintenant passer `?secret=<HERMES_ADMIN_TLM_BOT>` (sinon 403).

**🚧 À FAIRE (prochaines étapes) :**
- **Sécurité P3** : restreindre le CORS (`app.use(cors())` = `*`) au domaine touslesmatchs.com (au moins /admin).
- **Sécurité P4** : vérifier que `STRIPE_WEBHOOK_SECRET` est bien défini en prod (config .env, pas code).

**📋 Plus tard :**
- SEO : pages par équipe / championnat (en plus des pages par match).
- Google Search Console : soumettre `sitemap-pronostics.xml`.

---

## 2026-07-23

### Signaux Telegram : PLUS JAMAIS de cote calculée — seulement la vraie cote bookmaker
- Signal fort ET message de résultat : la cote (et le gain) ne s'affichent QUE si c'est
  une **vraie cote bookmaker** (real_odd_source = Winamax/Unibet/PMU/…). Si seule une
  estimation existe → aucune cote affichée (fini les chiffres calculés dans les groupes).
- Note : la vraie cote provient de l'endpoint /odds (pré-match). Pour la cote EXACTE au
  moment de l'envoi pendant le match (in-play), il faut l'endpoint /odds/live = plan Pro API.

### Cote envoyée AVEC le signal (Telegram premium/élite) — zéro requête API en plus
- Le message de signal fort premium affiche désormais la cote + bookmaker directement :
  `💰 Cote : 1.87 (Unibet)`. La cote est **déjà calculée** au moment de l'analyse
  (`computeBestOdd`) → aucun appel API supplémentaire, aucun gaspillage de quota.
- Canal gratuit inchangé (pick + cote réservés aux abonnés = tunnel de vente).

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

---

## 2026-07-25 - Handoff Codex a preserver

- Sauvegarde de passation ajoutee : `docs/handoff/2026-07-25-codex-live-vote-ia.md`.
- Etat a ne pas ecraser : Live IA multisport Football/Basketball/Hockey/Baseball via API-Sports + TheSportsDB, tennis retire, page Live IA enrichie, page accueil avec matchs en cours enrichis cote VPS.
- Concile public aligne sur "vote de 5 IA independantes" : pas de Chief visible client, pas de messages techniques d'agents indisponibles/quota.
- Regle de relais : Claude/Codex peuvent modifier site/API ; Hermes audite/recommande et ne pousse pas de MAJ site/API sans validation Greg.
- Attention VPS : ne pas copier `public/index.html` sur `site/index.html` sans verification, car `site/` est le rendu public servi par Caddy.
- Correctif live : si le cache `/live-matches` contient seulement du football, l'API tente maintenant d'enrichir avec TheSportsDB avant de repondre. La route envoie aussi `Cache-Control: no-store` pour eviter une reponse navigateur ancienne.
- Correctif presentation : suppression des restes publics "4 agents + 1 Chief" dans `public/js/i18n.js` et `public/faq.html`, remplacement par "5 IA independantes votent". FAQ nettoyee aussi du tennis.
