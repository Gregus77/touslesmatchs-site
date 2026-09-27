# Admin Live Capture Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une page administrateur pour confirmer les donnees extraites de captures puis consulter le verdict prive du Concile.

**Architecture:** Un module Node isole possede validation, stockage SQLite, appels IA et routes. Le serveur injecte l'authentification administrateur. Le front compresse les images et ne recoit jamais les noms des modeles.

**Tech Stack:** Node.js 20, Express, better-sqlite3, HTML/CSS/JavaScript statique, API compatible OpenAI.

**Spec:** `docs/superpowers/specs/2026-09-27-admin-live-capture-analysis-design.md`

## Global Constraints

- Premium reste a 14,90 EUR; aucune modification Stripe.
- Admin uniquement; aucun envoi Telegram, Brevo ou public.
- Conserver cinq sieges, Jev, Kimi et le roster.
- 4-10 captures, au moins trois cotes et une statistiques.
- Confirmation obligatoire; dix analyses par jour.
- Tests d'abord; desactive par defaut.

## Review Focus

- Non-admin refuse avant ecriture d'image.
- Type/taille/nombre invalides sans fichier residuel.
- Bookmakers differents: confirmation impossible.
- Double confirmation/analyse: aucune double facturation.
- Reponse IA invalide: siege exclu, aucun bulletin invente.

### Task 1: Validation et fusion

**Files:** Create `scripts/live_capture_analysis.js`; test `scripts/test_live_capture_analysis_20260927.js`.

**Interfaces:** `validateCaptureBatch`, `validateExtraction`, `classifyCandidate`, `fuseCouncilVotes`.

- [ ] Ecrire les tests puis constater l'echec module absent.
- [ ] Implementer le minimum et rendre les tests verts.
- [ ] Executer la suite et commit.

### Task 2: Persistance immuable et quota

**Files:** Modify module and test.

**Interfaces:** `createLiveCaptureStore({db, now})` produit `createSession`, `saveExtraction`, `confirmSnapshot`, `saveVotes`, `getSession`, `dailyCount`.

- [ ] Tester transitions, instantane immuable et limite dix.
- [ ] Implementer, verifier et commit.

### Task 3: Routes admin et fichiers ephemeres

**Files:** Modify module, `scripts/api_server.js`, `Dockerfile.api`, test.

**Interfaces:** `registerLiveCaptureRoutes({app, db, requireAdmin, callVision, callCouncil, storageDir})`.

- [ ] Tester auth avant ecriture, suppression et transitions.
- [ ] Enregistrer `/admin/live-capture/*`, verifier et commit.

### Task 4: Extraction et Concile

**Files:** Modify module and test.

- [ ] Tester JSON mal forme, bookmakers differents et siege manquant.
- [ ] Ajouter prompts stricts sans valeur inventee; verifier et commit.

### Task 5: Page administrateur

**Files:** Create `public/analyse-live.html`, `public/js/analyse-live.js`, `public/css/analyse-live.css`, page test.

- [ ] Tester messages, etats et anonymisation.
- [ ] Construire la page, verifier au navigateur et commit.

### Task 6: Deploiement controle

- [ ] Sauvegarder base et fichiers.
- [ ] Construire et tester sans redemarrage.
- [ ] Deployer d'abord desactive; verifier le site existant.
- [ ] Activer pour l'admin, tester un lot sanitise, verifier zero Telegram/Stripe et consigner le retour arriere.
