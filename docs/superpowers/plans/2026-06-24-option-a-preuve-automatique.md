# Option A Preuve Automatique Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le Live IA et Hermès en machine de preuve fiable: analyses enregistrées, résultats résolus, historique public propre, tableau admin mis à jour.

**Architecture:** L'API reste la source d'enregistrement et de résolution des prédictions. Hermès sert d'interface admin Telegram. Le frontend affiche uniquement des données issues des fichiers/DB vérifiés, sans inventer de score, match ou résultat.

**Tech Stack:** Node.js Express, SQLite via `better-sqlite3`, HTML/CSS/JS statique, Telegram Bot API, Brevo pour emails.

## Global Constraints

- Branche unique: `claude/happy-bell-h9zj83`.
- Aucun match inventé, aucun score inventé, aucune statistique live sans source.
- Ne pas exposer les captures ou bookmakers hors ARJEL en public.
- Ne pas modifier Stripe sans validation séparée.
- Vérifier `node --check scripts/api_server.js` et `node --check scripts/hermes_admin_bot.js` si modifiés.
- Garder le tableau performance IA visible admin uniquement.

---

### Task 1: Journaliser clairement les records manuels

**Files:**
- Modify: `scripts/api_server.js`

**Interfaces:**
- Consumes: `POST /internal/record-concile-result`
- Produces: log serveur `[record-concile-result] home vs away bet score => outcome`

- [ ] **Step 1: Ajouter un log succès**

Dans `scripts/api_server.js`, juste avant la réponse `res.json({ ok: true, ... })` de `/internal/record-concile-result`, ajouter:

```js
console.log(`[record-concile-result] ${record.home} vs ${record.away} ${record.bet} ${scoreHome}-${scoreAway} => ${outcome}`);
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `node --check scripts/api_server.js`

Expected: no syntax error.

- [ ] **Step 3: Commit**

```bash
git add scripts/api_server.js
git commit -m "fix: log manual concile records"
```

### Task 2: Exposer un historique public issu des vrais résultats

**Files:**
- Modify: `scripts/api_server.js`
- Modify: `public/historique.html`

**Interfaces:**
- Produces: `GET /api/public-history`
- Returns:

```json
{
  "ok": true,
  "items": [
    {
      "home": "Portugal",
      "away": "Ghana",
      "competition": "Coupe du Monde",
      "bet": "Match nul",
      "score": "0-0",
      "outcome": "win",
      "resolvedAt": "2026-06-24T00:56:00.000Z",
      "source": "manual_verified"
    }
  ]
}
```

- [ ] **Step 1: Ajouter la route API**

Lire `agent_predictions` et/ou `concile_analyses`, ne retourner que les lignes avec `outcome in ('win','loss')`, score final présent, et source vérifiée.

- [ ] **Step 2: Remplacer les données hardcodées de `public/historique.html`**

Charger `/api/public-history`, afficher:
- match;
- compétition;
- pari;
- score final;
- gagné/perdu;
- source.

Si aucune donnée: afficher "Historique en cours de constitution".

- [ ] **Step 3: Vérifier**

Run:

```bash
node --check scripts/api_server.js
```

### Task 3: Résoudre automatiquement les prédictions du Concile

**Files:**
- Modify: `scripts/api_server.js`

**Interfaces:**
- Consumes: matchs terminés récupérés par API-Sports et football-data.org.
- Produces: `outcome` mis à jour dans `agent_predictions`.

- [ ] **Step 1: Étendre l'auto-resolve**

Pour chaque match terminé, matcher les prédictions par `home`, `away`, date et source. Appliquer `getBetOutcomeForScore`.

- [ ] **Step 2: Journaliser**

Écrire:

```js
console.log(`[agent-perf] Auto-résolu ${count} prédictions: ${home} vs ${away} (${score})`);
```

- [ ] **Step 3: Protéger contre les faux positifs**

Ne jamais résoudre si:
- score absent;
- home/away ambigu;
- compétition low-trust;
- conflit de score détecté.

### Task 4: Préparer l'annonce Telegram résultat

**Files:**
- Modify: `scripts/hermes_admin_bot.js`

**Interfaces:**
- Consumes: résultat validé via `/record` ou résolution fiable.
- Produces: message admin prêt à publier, puis publication seulement avec confirmation.

- [ ] **Step 1: Ajouter commande `/result`**

La commande lit le dernier pick/résultat fiable et affiche un message prêt:

```text
✅ Pick validé
Portugal vs Ghana
🎯 Match nul
Score final : 0-0
Le Conseil des IA avait vu juste.
```

- [ ] **Step 2: Ajouter garde-fou**

Si le résultat n'est pas fiable, répondre:

```text
Résultat non publié: score ou source manquant. Valide avec /record.
```

### Task 5: Vérification finale et déploiement

**Files:**
- Modify: touched files only.

- [ ] **Step 1: Checks locaux**

```bash
node --check scripts/api_server.js
node --check scripts/hermes_admin_bot.js
git diff --check
```

- [ ] **Step 2: Commit et push**

```bash
git add scripts/api_server.js scripts/hermes_admin_bot.js public/historique.html docs/superpowers/plans/2026-06-24-option-a-preuve-automatique.md
git commit -m "feat: publish verified concile proof history"
git push -u origin claude/happy-bell-h9zj83
```

- [ ] **Step 3: Déploiement VPS**

```bash
cd /opt/touslesmatchs
git fetch origin claude/happy-bell-h9zj83
git reset --hard origin/claude/happy-bell-h9zj83
docker compose up -d --build site api hermes-admin
```

## Self-Review

- Spec coverage: couvre preuve automatique, historique public, stats IA admin, Hermès Telegram.
- Placeholders: aucun placeholder volontaire.
- Type consistency: `outcome` reste `win/loss/pending`, les scores publics sont des chaînes `home-away`.
