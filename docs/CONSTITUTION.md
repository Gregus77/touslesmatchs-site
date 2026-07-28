# 📘 CONSTITUTION — TousLesMatchs

## Vision

TousLesMatchs est une plateforme d'analyses sportives assistées par IA, avec
pour ambition de devenir la référence francophone (puis internationale) du pick
sportif prédictif. La marque parle, jamais le fondateur.

## Mission

- Fournir des analyses fiables, transparentes et vérifiables.
- Respecter la conformité ANJ (Autorité Nationale des Jeux) sans compromis.
- Automatiser au maximum pour scaler sans dette technique.
- Convertir via le tunnel : TikTok → site → Telegram → 1€ → Pro → Elite.

## Objectifs financiers (2026-2027)

| Horizon | Abonnés Pro | Abonnés Elite | CA mensuel cible |
|---|---|---|---|
| Fin 2026 | 500 | 100 | 6 940 € |
| Mi-2027 | 2 000 | 500 | 29 750 € |
| Fin 2027 | 5 000 | 1 500 | 79 350 € |

## Organisation Hermès ↔ Claude

| Rôle | Assignation | Prérogatives |
|---|---|---|
| **Architecte / Code** | Claude | Écrit, sécurise, documente, versionne dans git |
| **Décideur pronostic** | Hermès (Concile) | Analyse consensus pondéré, publie sur Telegram |
| **Superviseur humain** | Fondateur | Valide chaque étape lourde, arbitre les conflits |

**Règle inviolable** : *Un seul agent écrit dans le code à la fois, l'autre relit.*

## Départements

### 🏛️ CTO — Direction Technique (Claude)
Architecture, dette technique, choix d'infra, code review, refactoring.

### 🛡️ CISO — Sécurité (Claude + fondateur)
Rotation clés, audit failles, RGPD, headers HTTP, rate limiting, anonymat.

### 🎯 SEO — Référencement
Balises, sitemap, schema.org, contenus optimisés, backlinks, i18n.

### 📣 Marketing — Growth
TikTok content, campagnes Brevo, tunnel conversion, upsell, cross-sell.

### 💼 Business — Commercial
Partenariats bookmakers ARJEL, affiliation, offres saisonnières.

### 🧠 Data IA — Concile Hermès
Pondération agents, boucle apprentissage, nouvelles IA à intégrer.

### 💰 CFO — Finance
Suivi CA, marges, coûts API (Stripe, Groq, DeepSeek, Gemini, Mistral).

### 🎨 CPO / UX-UI — Produit
Design mobile-first, sobriété premium, parcours utilisateur, A/B tests.

### ⚖️ Juridique — Conformité ANJ
CGU, mentions légales, politique confidentialité, disclaimer joueurs-info-service.

### ✅ QA — Qualité
Tests régression, smoke tests, contrôle pré-déploiement, incidents.

### 🌍 International
i18n (FR/EN/ES à terme), fuseaux horaires, devises, contenus localisés.

### 🎧 Support / Commercial
Chatbot Mistral, escalade admin, FAQ, retention.

## Règles de fonctionnement

### Développement
- Toujours pusher sur la branche assignée, jamais sur `main` directement.
- Une étape à la fois, rapport pour validation utilisateur avant la suivante.
- Sauvegarde systématique avant migration/refactor lourd.
- Verrou de version (`VERSION_LOCK.md`) respecté.

### Communication
- Utilisateur → Claude : demande en français, feedback court et direct.
- Claude → Utilisateur : réponse concise, jamais de recap inutile.
- Concile → Public : pas de mot "pari" (utiliser "analyse", "pick", "sélection").

### Sécurité
- Clés API jamais dans le code, jamais dans les logs, jamais dans les chats.
- Anonymat fondateur : jamais de nom/photo/voix/adresse.
- Rotation périodique des tokens sensibles.

### Priorisation
Chaque dev doit augmenter **au moins un** de ces indicateurs :
1. CA
2. Taux de conversion
3. Confiance utilisateur
4. Automatisation
5. Vitesse
6. UX

Si aucun : ne pas développer.

## Ne jamais casser
Stripe · Telegram (3 canaux) · Hermès · Live IA · Brevo · Analytics ·
Responsive · SEO · Règles R1/R2

---

*Cette constitution évolue par amendement uniquement, validé par l'utilisateur.*
