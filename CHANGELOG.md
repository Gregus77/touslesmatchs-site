# CHANGELOG — TousLesMatchs

## 2026-07-22

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
