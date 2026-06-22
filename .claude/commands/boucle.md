# /boucle — Boucle d'amélioration continue TousLesMatchs

Tu es l'IA d'amélioration continue du projet TousLesMatchs. Ton rôle : auditer, corriger, améliorer le site et Hermès, commit après commit, en suivant les priorités ci-dessous.

## RÈGLES ABSOLUES (jamais déroger)
- Branche : `claude/happy-bell-h9zj83` — jamais une autre sans permission explicite
- Commit après CHAQUE amélioration fonctionnelle
- Push à la fin de chaque cycle
- Ne jamais modifier ce qui n'est pas cassé
- Ne jamais `git add -A` (risque de committer .env)
- Toujours `node --check` avant de committer du JS
- Ne jamais `docker compose up -d --build` sans préciser le service : `site`, `api`, ou `hermes-admin`

## COMPORTEMENT EN CAS D'INCERTITUDE

**Avant de modifier quoi que ce soit de risqué, poser la question à l'utilisateur :**
- Si une modification touche la logique de paiement → demander confirmation
- Si une tâche peut casser l'existant → décrire le risque et demander si on y va
- Si plusieurs approches sont possibles → proposer les options et recommander
- Si une tâche semble hors scope → signaler et demander validation

Format question : "⚠️ J'ai besoin de ton avis avant de continuer : [question précise]. Options : [A] / [B] / [C]"

---

## PHASE 0 — AUDIT INITIAL (lancer à chaque début de session)

Avant de choisir une tâche, effectuer cet audit rapide :

```bash
git log --oneline -5
git diff --stat HEAD
```

### Audit 1 — Cohérence frontend ↔ backend
Pour chaque fichier HTML (`index.html`, `live-ia.html`, `historique.html`, `preuves.html`) :
- Lister tous les `fetch('/api/...')` et `fetch('/...')`
- Vérifier que chaque route existe dans `api_server.js` (`app.get`, `app.post`)
- Signaler toute route appelée côté front mais absente côté back ⚠️

### Audit 2 — Fonctions JS orphelines
- Lister tous les `onclick="xxx()"` dans les HTML
- Vérifier que `function xxx` est définie dans le même fichier
- Signaler toute fonction appelée mais non définie ⚠️

### Audit 3 — Variables CSS manquantes
- Vérifier que toutes les `var(--xxx)` dans les nouveaux blocs CSS existent dans `:root{}`
- Fichier de référence : début de chaque fichier HTML ⚠️

### Audit 4 — Checklist IA (Concile)
Vérifier dans `api_server.js` :
- [ ] Personas agents spécialisés (stats, tactique, value, goals, synthèse)
- [ ] `computeLiveConstraints()` couvre : cartons rouges, fatigue fin de match, score context
- [ ] Cache Concile partagé par match+état (pas par user)
- [ ] `teamsMatch()` couvre les variantes de noms courantes

### Audit 5 — Abonnements et légal
Vérifier que ces éléments existent et fonctionnent :
- [ ] Page `/mentions-legales.html` ou équivalent (CGV + politique confidentialité)
- [ ] Endpoint de vérification d'abonnement (`/api/verify-code`) fonctionnel
- [ ] Hermès envoie un rappel email avant expiration du code
- [ ] Les codes expirés sont bien rejetés

### Audit 6 — Hermès notifications
Vérifier dans `hermes_admin_bot.js` :
- [ ] Rappel automatique avant expiration abonnement (7j et 1j avant)
- [ ] Résumé hebdomadaire winrate envoyé chaque lundi
- [ ] Commande `/preview` pour prévisualiser avant publication
- [ ] Détection automatique score final

### Dashboard d'état (afficher en fin d'audit)

```
📊 AUDIT TOUSLESMATCHS — [date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Routes API cohérentes     : OUI / ⚠️ PROBLÈMES: [liste]
✅ Fonctions JS définies     : OUI / ⚠️ PROBLÈMES: [liste]
✅ CSS variables OK          : OUI / ⚠️ PROBLÈMES: [liste]
✅ Concile IA — personas     : OK / À FAIRE
✅ Concile IA — cache        : OK / À FAIRE
✅ Abonnements — légal       : OK / MANQUANT
✅ Abonnements — rappels     : OK / À FAIRE
✅ Hermès — notifications    : OK / À FAIRE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Prochaine priorité : [tâche]
```

---

## BOUCLE PRINCIPALE

Après l'audit, répéter ces étapes en continu :

### Étape 1 — Choisir UNE tâche selon la priorité

**Priorité 0 — Légal (bloquant pour les paiements)** :
- [ ] Créer `public/mentions-legales.html` avec CGV + politique de confidentialité
- [ ] Lien dans le footer de toutes les pages
- [ ] Ajouter les infos légales requises (RGPD, rétractation, hébergeur)

**Priorité 1 — Bugs bloquants** :
- Routes API appelées côté front mais absentes dans `api_server.js`
- Fonctions JS appelées par onclick mais non définies
- Erreurs dans les logs console (patterns `[ERROR]`, `❌`)

**Priorité 2 — Qualité prédictions (Concile IA)** :
- Personas agents trop génériques → spécialiser (stats, tactique, value, goals, synthèse)
- `computeLiveConstraints()` : ajouter cartons rouges, fatigue, contexte score
- `getPerformanceContext()` : enrichir avec historique récent
- `teamsMatch()` : couvrir plus de variantes de noms
- Pondération dynamique agents selon winrate 14 derniers jours

**Priorité 3 — Abonnements et rappels** :
- Email de rappel J-7 et J-1 avant expiration du code
- Lister les abonnés qui expirent dans les 7 prochains jours
- Résumé hebdomadaire winrate (envoi automatique lundi)

**Priorité 4 — Automatisation Hermès** :
- `/preview` : prévisualiser message avant publication
- Détection auto score final via football-data.org
- Alerte quand un agent IA dépasse 70% winrate
- Meilleure gestion d'erreurs dans `/admin/*`

**Priorité 5 — UX site** :
- Indicateur confiance globale : "Ce soir le Concile est à X% de précision"
- Historique picks connecté au vrai picks.json
- Partage d'analyse sur réseaux sociaux

### Étape 2 — Implémenter
- Lire UNIQUEMENT les fichiers nécessaires
- Modifier chirurgicalement (1 tâche = 1 zone de code)
- Vérifier syntaxe : `node --check scripts/api_server.js`
- Tester mentalement : "est-ce que ça casse autre chose ?"

### Étape 3 — Valider et committer
```bash
node --check scripts/api_server.js  # si JS modifié
git add [fichiers spécifiques seulement]
git commit -m "feat/fix: description courte"
```

### Étape 4 — Continuer
Retourner à l'Étape 1 et choisir la prochaine tâche.

**Si les tokens sont faibles** : finir le commit en cours, push, noter ce qui reste.

---

## FICHIERS CLÉS

| Fichier | Rôle |
|---|---|
| `scripts/api_server.js` | Backend Node.js — matchs live, Concile IA, SQLite |
| `scripts/hermes_admin_bot.js` | Bot Telegram admin |
| `public/live-ia.html` | Page Live IA |
| `public/index.html` | Page principale |
| `public/historique.html` | Historique des picks |
| `public/preuves.html` | Preuves de gains |

---

## FORMAT RAPPORT FIN DE SESSION

```
🔄 BOUCLE — Cycle N terminé
✅ Fait : [liste des commits]
⏭️ Prochain : [tâche prioritaire restante]
📊 État : [nb fichiers modifiés, nb commits]
🚀 Pour déployer : cd /opt/touslesmatchs && git pull origin claude/happy-bell-h9zj83 && docker compose up -d --build site api
```
