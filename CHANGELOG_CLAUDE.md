# Journal des modifications — Claude Code
# Ce fichier documente TOUTES les modifications apportées par Claude Code
# Pour que GPT Codex (ou tout autre agent) sache exactement ce qui a changé.

---

## ÉTAT INITIAL (14 juin 2026 — Audit de reprise)

### Ce qui existait AVANT toute intervention de Claude Code :
- Site React SPA sur branche `origin/main`
- Bot Telegram opérationnel (bot.js + hermes_admin_bot.js)
- Script multi-agent IA (DeepSeek primaire + Groq fallback)
- GitHub Actions : check_results.yml (toutes les 4h), deploy-bot.yml, multi_agent.yml
- Email de bienvenue Brevo configuré (clé API "TousLesMatchs VPS" + "touslesmatchs")
- Stripe : code stub présent mais NON fonctionnel (pas de webhook)
- Base utilisateurs vide (scripts/users_db.json)
- 23 picks historiques : 78.3% réussite (Hockey 87%, Foot 80%)
- Dernier commit avant reprise : "Fix desktop hero rendering artifacts" (11 juin 2026)

---

## MODIFICATIONS EN COURS

### Session du 14 juin 2026

#### Fichiers créés :
- `CHANGELOG_CLAUDE.md` — ce fichier de suivi (nouveau)

#### Fichiers modifiés :
- (aucun pour l'instant)

#### Fichiers supprimés :
- (aucun)

---

## FONCTIONNALITÉS EN COURS DE DÉVELOPPEMENT

### 1. Envoi automatique quotidien des picks par email (Brevo)
- **Statut :** En attente de la clé API Brevo
- **Fichier cible :** `scripts/email_sender.js` (à créer)
- **Email Free :** 1 pick/matin avec match, cote, indice confiance, bookmaker (ARJEL/hors-ARJEL), lien Telegram, pub Premium
- **Email Premium :** 3 picks/matin avec tous les détails
- **Intégration :** Connexion au script Hermès existant via `picks_history.json`

### 2. Boucle d'apprentissage Hermès (toutes les 2-4h)
- **Statut :** À développer
- **Fichier cible :** `scripts/hermes_learning.js` (à créer)
- **Fonctionnement :** Vérification résultats → mise à jour scores → génération picks du lendemain

---

## VARIABLES D'ENVIRONNEMENT AJOUTÉES
(à documenter au fur et à mesure)

| Variable | Usage | Ajoutée le |
|----------|-------|------------|
| BREVO_API_KEY | Envoi emails automatiques | (en attente) |

---

## NOTES IMPORTANTES POUR GPT CODEX
- Ne PAS modifier `scripts/multi_agent.js` sans vérifier la chaîne de fallback IA
- Ne PAS modifier `scripts/bot.js` sans tester le bot Telegram
- Le fichier `scripts/picks_history.json` est la source de vérité pour les stats
- Les picks actuels dans `src/App.js` sont hardcodés — migration vers JSON prévue
- Brevo utilise des listes séparées Free/Premium (à configurer)
- IP VPS à autoriser dans Brevo : 72.61.167.175
