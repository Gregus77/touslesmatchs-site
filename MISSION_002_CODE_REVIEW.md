# 🔍 MISSION 002 — REVUE FINALE DE CODE

**Branche :** `feature/subscription-engine`
**Type :** Audit uniquement — aucune modification, aucun merge, aucun déploiement
**Verdict global :** ⚠️ **NE PAS VALIDER EN L'ÉTAT** — 2 bugs confirmés (dont 1 injection SQL) + plusieurs manques de robustesse

---

## 🎯 Synthèse

| Domaine | Verdict | Bloquant |
|---------|---------|----------|
| Performance | 🟡 Correct, 2 redondances mineures | Non |
| Sécurité | 🔴 Injection SQL confirmée + fuite de données | **Oui** |
| Base de données | 🟡 FK OK, mais pas de rollback ni contrainte anti-doublon | Partiel |
| API | 🟡 Codes HTTP OK, validation des paramètres absente | Partiel |
| Tests | 🔴 Cas limites non couverts (les plus importants manquent) | **Oui** |
| Qualité | 🟢 Pas de TODO/FIXME, code lisible | Non |
| Documentation | 🔴 Aucune doc install / migration / rollback | **Oui** |

**Score de préparation : 6/10.** Le cœur fonctionnel est bon, mais il reste 2 défauts de sécurité réels et une couverture de tests trompeuse (53 tests « verts » qui ne testent aucun cas d'échec).

---

## 🔴 DÉFAUTS BLOQUANTS (confirmés par exécution)

### BUG #1 — Injection SQL dans `updateSubscription()` (CONFIRMÉ)

**Fichier :** `scripts/subscription-engine.js:130-134`

```js
if (newPlan && newPlan !== current.plan) {
  updateFields.push(`plan = '${newPlan}'`);          // ⚠️ interpolation directe
}
if (newStatus && newStatus !== current.subscription_status) {
  updateFields.push(`subscription_status = '${newStatus}'`);  // ⚠️ interpolation directe
}
```

Contrairement à toutes les autres méthodes (qui utilisent des requêtes préparées `?`), celle-ci **concatène `newPlan` et `newStatus` directement dans le SQL**.

**Preuve d'exploitation (test exécuté) :**
```
Entrée : newPlan = "X' , subscription_status='HACKED"
Résultat DB : plan = "X"   ← le guillemet a cassé la chaîne = injection effective
```

La valeur n'est pas stockée littéralement : elle est **interprétée comme du SQL**. Un attaquant contrôlant `newPlan`/`newStatus` peut modifier d'autres colonnes.

**Vecteur réel :** endpoint `POST /admin/subscription/update` → `req.body.plan` / `req.body.status` passent tels quels. Certes protégé par `isAdmin()`, mais :
1. C'est une faille SQL réelle, pas théorique.
2. La revue demande explicitement de vérifier « injections SQL ».

**Correctif recommandé (à appliquer plus tard) :** paramétrer la requête (placeholders `?`) et/ou valider les valeurs contre une liste blanche d'énumérations.

---

### BUG #2 — Incohérence du champ `status` à l'auto-expiration (CONFIRMÉ)

**Fichier :** `scripts/subscription-engine.js:77-108`

Quand un abonnement expire, `getSubscriptionStatus()` met bien à jour la base (`EXPIRED`) mais **retourne l'ancienne valeur** lue au début de la fonction.

**Preuve (test exécuté) :**
```
Objet retourné : status = "ACTIVE" | isActive = false
Valeur en base : status = "EXPIRED"
=> Incohérence : true
```

Un consommateur qui lit `subscription.status` verra `ACTIVE` pour un abonnement expiré (seul `isActive` est correct). Les deux champs se contredisent → source de bugs en aval (Brevo/Telegram qui liront `status`).

**Cause :** la variable locale `sub` n'est pas rafraîchie après l'`UPDATE`.

---

## 🔒 SÉCURITÉ

### S1 — Fuite de données par énumération (endpoints publics non authentifiés)
`GET /api/subscription/:email` et `GET /api/user/:email/access` **n'ont aucune authentification**. N'importe qui peut interroger l'abonnement, le plan, l'historique de paiement et le groupe Telegram de **n'importe quelle adresse email**.
→ Fuite RGPD + énumération d'utilisateurs. À restreindre (JWT / token propriétaire ou usage interne seulement).

### S2 — Effet de bord d'écriture sur une requête GET
`getByEmail()` appelle `ensureSubscription()`, qui fait un `INSERT` dans `subscriptions` **et** dans `subscription_history` si l'abonnement n'existe pas encore. Un simple `GET` provoque donc des écritures. Couplé à S1, cela permet de faire grossir `subscription_history` via des requêtes non authentifiées (amplification d'écriture) et viole la sémantique HTTP (GET doit être sans effet).

### S3 — Absence de validation d'énumération (`plan`, `status`)
Aucune vérification que `plan ∈ {VISITOR, PAY_PER_VIEW, ESSENTIAL, ELITE}` ni que `subscription_status ∈ {ACTIVE, EXPIRED, CANCELLED, SUSPENDED, PENDING_PAYMENT, REFUNDED}`. Une valeur arbitraire (`"FOO"`) est acceptée et écrite. Combiné à BUG #1, aggrave le risque.

### S4 — Validation email absente
Le paramètre `:email` n'est jamais validé (format). Les requêtes SQL sont paramétrées (pas d'injection ici), mais aucune normalisation (`toLowerCase()/trim()`) → `A@B.com` et `a@b.com` sont traités comme deux utilisateurs différents alors que `users.email` est probablement stocké en minuscules ailleurs (`verifyCode` fait `.toLowerCase().trim()`). Risque de « utilisateur introuvable » sur une casse différente.

### S5 — `isAdmin()` — point positif ✅
La protection admin repose sur `verifyCode()` + préfixe `ELITE-ADMIN`. Testé : un `code` absent (`undefined`) ne fait pas planter (court-circuit `&&`). Les 3 endpoints admin sont bien gardés. **Conforme.**

---

## ⚡ PERFORMANCE

### P1 — Index SQL : ✅ conformes
Les 7 index sont créés et vérifiés (`idx_subscriptions_plan/status/expiry`, `idx_analysis_purchases_user/analysis`, `idx_subscription_history_user/date`). Toutes les requêtes filtrent sur `user_id` ou colonnes indexées. Pas de scan de table complet identifié.

### P2 — Requête redondante dans `/api/user/:email/access`
`getByEmail()` calcule déjà `purchaseCount` (via `getSubscriptionStatus`), puis l'endpoint **refait** un `SELECT COUNT(*) FROM analysis_purchases` (api_server.js:7044). Doublon → 1 requête inutile par appel.

### P3 — Pas de N+1 réel
Aucune boucle exécutant des requêtes. Les méthodes de liste (`getAnalysisPurchases`, `getSubscriptionHistory`) font 2 requêtes fixes (page + count), ce qui est acceptable.

### P4 — `LIMIT ? OFFSET ?` sans plafond
`limit` est passé tel quel depuis l'appelant. Aucun endpoint public ne l'expose aujourd'hui, mais si branché plus tard, `limit=1000000` est possible. À plafonner (ex. `Math.min(limit, 100)`).

---

## 🗄️ BASE DE DONNÉES

### D1 — Contraintes FK : ✅ OK (vérifié)
Test empirique sur `better-sqlite3` v12.11.1 : `PRAGMA foreign_keys = 1` et un `INSERT` orphelin est **refusé**. `ON DELETE CASCADE` fonctionne donc.
⚠️ **Réserve :** api_server.js ne pose jamais `PRAGMA foreign_keys = ON` explicitement — on dépend du défaut de la version installée. **Recommandation :** poser le PRAGMA explicitement à l'ouverture pour garantir la portabilité.

### D2 — Doublons possibles sur `analysis_purchases` 🔴
**Aucune contrainte d'unicité** sur `(user_id, analysis_id)`. Le même utilisateur peut « acheter » (ou se voir enregistrer) plusieurs fois la même analyse → doublons + `purchaseCount` faussé. La revue demandait explicitement de vérifier les « doublons ». **Manque une `UNIQUE(user_id, analysis_id)`** (avec gestion `INSERT OR IGNORE` ou upsert).

### D3 — Unicité `subscriptions.user_id` : ✅ OK
`UNIQUE(user_id)` présent → relation 1:1 garantie.

### D4 — Migration / Rollback : 🔴 absent
- Les tables sont créées « inline » via `db.exec(CREATE TABLE IF NOT EXISTS …)` au démarrage. Pas de fichier de migration versionné.
- **Aucun script de rollback** (pas de `DROP TABLE` / `down migration`).
- Pas de gestion de version de schéma (`PRAGMA user_version`).
La revue demandait « rollback migration » → **non couvert**.

### D5 — `auto_renew` renvoyé en entier
Stocké `0/1`, renvoyé brut dans `autoRenew` (int, pas booléen JS). Cohérence de typage à surveiller côté consommateurs.

---

## 🌐 API

### A1 — Codes HTTP : ✅ globalement corrects
`400` (email manquant), `403` (non autorisé), `404` (introuvable), `500` (erreur). Cohérent.

### A2 — Erreurs normalisées : 🟡 partiel
Format `{ ok:false, error }` homogène. **Mais** `error: e.message` renvoie le message d'exception brut au client sur les `500` → fuite potentielle de détails internes (chemins, SQL). À masquer (message générique + log serveur).

### A3 — Validation des paramètres : 🔴 insuffisante
- `plan` / `status` non validés (cf. S3).
- `email` non validé (cf. S4).
- `amount` codé en dur à `100` côté endpoint admin ; `analysis_id`/`match_key` non validés (fallback `test_*`).

---

## 🧪 TESTS — couverture réelle

**53 tests « verts » mais la couverture est trompeuse.** Les tests valident les chemins nominaux ; **aucun cas d'échec n'est testé.**

### Manques critiques (demandés par la revue) :
| Cas limite demandé | Testé ? |
|--------------------|---------|
| Email inexistant → 404 | ❌ Non |
| Utilisateur supprimé (CASCADE) | ❌ Non |
| Abonnement corrompu (valeurs hors énum) | ❌ Non |
| Injection SQL | ❌ Non (aurait détecté BUG #1) |
| Protection des endpoints admin (403) | ❌ Non |
| Codes HTTP des endpoints | ❌ Non (tests appellent le service, pas l'API HTTP) |
| Doublon d'achat | ❌ Non |
| Incohérence status/isActive | ❌ Non (aurait détecté BUG #2) |

### Observation importante
Les « tests d'intégration API » (`test_integration_api.js`) **n'appellent aucun endpoint HTTP** — ils appellent directement les méthodes du service sur une base temporaire. Ce sont en réalité des tests unitaires supplémentaires. **Aucun test ne démarre Express ni ne teste `req/res`, l'auth, ou les codes HTTP.** Le libellé « tests d'intégration » est donc inexact.

### Point positif ✅
Les 4 plans et les 6 statuts de paiement (expiré, remboursé, annulé, en attente) sont bien instanciés et vérifiés au niveau service.

---

## 🧹 QUALITÉ

| Critère | Résultat |
|---------|----------|
| TODO / FIXME / HACK | ✅ Aucun |
| Fonctions trop longues | 🟢 OK (`getSubscriptionStatus` ~55 lignes, limite acceptable) |
| Code dupliqué | 🟡 Les méthodes « spec » (`getUserSubscription`, `canAccessAnalysis`, `getPurchasedAnalyses`) sont de simples alias d'autres méthodes → duplication d'API volontaire mais redondante |
| Dette technique | 🟡 `users.status` déprécié mais conservé (documenté) ; deux sources de vérité tant que la migration n'est pas faite |
| Lisibilité | 🟢 Bonne, commentaires clairs, nommage cohérent |

---

## 📚 DOCUMENTATION

| Attendu | État |
|---------|------|
| Installation | 🔴 Absent (aucune instruction de setup dédiée) |
| Migration | 🔴 Absent (schéma créé implicitement, non documenté comme migration) |
| Rollback | 🔴 Absent |

Les rapports existants (`MISSION_002_REPORT.md`, `MISSION_002_FINAL_REPORT.md`) documentent bien l'**architecture** et les **endpoints**, mais **pas les procédures d'exploitation** (install/migration/rollback) demandées.

---

## ✅ PLAN DE CORRECTION RECOMMANDÉ (par priorité)

### 🔴 Avant validation (bloquant)
1. **BUG #1** — Paramétrer `updateSubscription()` (placeholders `?`) + liste blanche `plan`/`status`.
2. **BUG #2** — Relire l'abonnement après auto-expiration (retourner `status = "EXPIRED"` cohérent avec `isActive`).
3. **S1/S2** — Authentifier ou restreindre les 2 endpoints publics ; retirer l'effet de bord d'écriture du GET (ou le rendre explicite/idempotent).
4. **Tests** — Ajouter les cas d'échec : email inexistant (404), user supprimé, valeurs hors énum, injection, protection admin (403), doublon d'achat.

### 🟡 Avant production
5. **D2** — `UNIQUE(user_id, analysis_id)` sur `analysis_purchases`.
6. **D4** — Script de migration + rollback versionné (`PRAGMA user_version`).
7. **D1** — Poser `PRAGMA foreign_keys = ON` explicitement.
8. **A2** — Masquer `e.message` sur les `500`.
9. **S3/S4** — Validation `plan`/`status`/`email` (+ normalisation email).

### 🟢 Amélioration
10. **P2** — Supprimer le `COUNT` redondant dans `/access`.
11. **P4** — Plafonner `limit`.
12. Documenter install / migration / rollback.

---

## 📌 CONCLUSION

Le moteur est **bien structuré** (séparation des responsabilités respectée, aucun couplage Stripe/Brevo/Telegram, index présents, FK actives, code lisible). **Mais il n'est pas prêt à être validé** :

- **1 injection SQL confirmée** (`updateSubscription`),
- **1 incohérence de données confirmée** (statut à l'expiration),
- **endpoints publics non authentifiés** exposant des données personnelles,
- **couverture de tests trompeuse** (les cas limites — justement ceux qui auraient attrapé ces bugs — ne sont pas testés),
- **doc d'exploitation et rollback absents**.

**Recommandation : corriger les 4 points bloquants, puis re-tester, avant toute validation ou merge.**

---

*Rapport d'audit — aucune modification de code effectuée. Bugs #1 et #2 reproduits par exécution réelle.*
