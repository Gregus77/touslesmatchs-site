# TECHNICAL_DEBT.md — TousLesMatchs

## Origine : Mission 002 — Subscription Engine (code review V2)

Les 9 points ci-dessous sont issus de la revue de code finale de la Mission 002.
Ils ont ete identifies comme **non-bloquants** et volontairement reportes pour
conserver la dynamique du projet. A traiter dans un lot de finition dedie avant
mise en production.

---

### 1. P2 — Requete COUNT redondante

**Fichier :** `scripts/api_server.js` (endpoint `GET /api/user/:email/access`)
**Severite :** Faible (performance)
**Description :** Une requete `COUNT` est executee alors que les donnees sont
deja disponibles via `getSubscriptionStatus()`. Supprimer la requete redondante
ou reutiliser les donnees existantes.

---

### 2. P4 — Pagination sans plafond

**Fichier :** `scripts/subscription-engine.js` (`getAnalysisPurchases`, `getSubscriptionHistory`)
**Severite :** Faible (performance / securite)
**Description :** Les parametres `limit` et `offset` ne sont pas plafonnes.
Un client pourrait demander `limit=999999` et provoquer une charge inutile.
Ajouter un plafond raisonnable (ex: `Math.min(limit, 100)`).

---

### 3. A2 — Fuite de `e.message` sur les erreurs 500

**Fichier :** `scripts/api_server.js` (tous les endpoints Mission 002)
**Severite :** Moyenne (securite)
**Description :** Les blocs `catch` renvoient `e.message` brut dans la reponse
JSON. En production, cela peut exposer des chemins de fichiers, des noms de
tables ou des details d'implementation. Remplacer par un message generique
(`"Internal server error"`) et loguer le detail cote serveur uniquement.

---

### 4. S3 — Email non valide ni normalise

**Fichier :** `scripts/api_server.js` (endpoints `/api/subscription/:email`, `/api/user/:email/access`, admin endpoints)
**Severite :** Moyenne (securite / coherence)
**Description :** L'email est utilise tel quel depuis `req.params.email` ou
`req.body.target_email` sans validation de format ni normalisation
(`.toLowerCase().trim()`). Cela pourrait causer des incoherences de lookup ou
permettre des injections dans d'autres couches.
**Note :** `authorizeSubscriptionAccess()` normalise deja pour la comparaison
d'auth, mais pas pour le lookup en base.

---

### 5. D1 — PRAGMA foreign_keys non explicite

**Fichier :** `scripts/subscription-engine.js`, `scripts/api_server.js`
**Severite :** Faible (robustesse)
**Description :** `PRAGMA foreign_keys = ON` n'est pas pose explicitement a
l'ouverture de la connexion. better-sqlite3 v12+ l'active par defaut, mais
une future version ou un changement de driver pourrait desactiver les FK
silencieusement. Ajouter `db.pragma('foreign_keys = ON')` apres chaque
ouverture de connexion.

---

### 6. D4 — Pas de migration/rollback versionne

**Fichier :** aucun (a creer)
**Severite :** Moyenne (operations)
**Description :** Les tables Mission 002 sont creees via `CREATE TABLE IF NOT
EXISTS` dans `api_server.js`. Il n'existe aucun script de migration versionne
ni de mecanisme de rollback. Implementer un systeme de migration simple
(ex: `PRAGMA user_version` + scripts SQL numerotes) avant la mise en
production.

---

### 7. Doc — Procedures install/migration/rollback absentes

**Fichier :** aucun (a creer)
**Severite :** Faible (operations / onboarding)
**Description :** Pas de documentation pour :
- Installation du module Subscription Engine
- Procedure de migration de base de donnees
- Procedure de rollback en cas de probleme
A documenter dans un README dedie ou dans CLAUDE.md.

---

### 8. Admin-panel casse par la securisation des endpoints

**Fichier :** `public/subscription-admin-panel.html`
**Severite :** Moyenne (fonctionnalite)
**Description :** Le panneau admin HTML appelait `GET /api/subscription/:email`
et `GET /api/user/:email/access` sans JWT. Depuis la Correction #3 (Mission
002), ces endpoints renvoient 401/403. Le panneau est donc non-fonctionnel
pour ces deux appels.
**Action :** Ajouter un champ de saisie JWT ou un mecanisme de login dans le
panneau, ou le retirer s'il n'est plus necessaire.

---

### 9. users.status deprecie (double source de verite)

**Fichier :** `scripts/api_server.js` (table `users`)
**Severite :** Faible (dette technique)
**Description :** Le champ `users.status` (valeurs `free`, `premium`, etc.)
coexiste avec la table `subscriptions` qui porte desormais l'etat reel de
l'abonnement (`plan` + `subscription_status`). Les deux ne sont pas
synchronises, ce qui cree une double source de verite.
**Action :** Migrer progressivement tout le code qui lit `users.status` vers
`subscriptions`, puis supprimer le champ ou le rendre purement informatif.

---

## Priorite recommandee

| Priorite | Points |
|----------|--------|
| **Avant production** | #3 (fuite e.message), #6 (migrations), #8 (admin-panel) |
| **Court terme** | #4 (email), #5 (FK pragma), #9 (users.status) |
| **Quand possible** | #1 (COUNT), #2 (pagination), #7 (doc) |
