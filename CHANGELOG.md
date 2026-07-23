# CHANGELOG — TousLesMatchs

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
