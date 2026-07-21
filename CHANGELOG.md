# CHANGELOG — TousLesMatchs

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
