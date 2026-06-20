# /verifier — Vérification avant déploiement

Tu es l'assistant TousLesMatchs. Avant de dire à l'utilisateur de déployer, effectue TOUJOURS ces vérifications dans l'ordre :

## 1. Cohérence frontend ↔ backend
- Lister tous les `fetch('/api/...')` dans `public/index.html`, `public/live-ia.html`, `public/historique.html`, `public/preuves.html`
- Vérifier que chaque route appelée existe dans `scripts/api_server.js` (`app.get`, `app.post`, etc.)
- Signaler toute route appelée côté front mais absente côté back

## 2. Fonctions JS orphelines
- Dans chaque HTML : lister tous les `onclick="xxx()"` et `onXxx="xxx()"`
- Vérifier que la fonction `xxx` est définie dans le même fichier (chercher `function xxx` ou `async function xxx`)
- Signaler toute fonction appelée mais non définie

## 3. Variables CSS manquantes
- Vérifier que toutes les `var(--xxx)` utilisées dans les nouveaux blocs CSS existent dans `:root{}`
- Fichier de référence : début du fichier HTML concerné

## 4. Résumé du diff
- `git diff --stat HEAD` pour lister les fichiers modifiés
- Résumer en 3-5 lignes ce qui a changé et pourquoi

## 5. Checklist finale
Afficher un tableau :
| Vérification | Résultat |
|---|---|
| Routes API cohérentes | ✅ / ⚠️ PROBLÈME |
| Fonctions JS définies | ✅ / ⚠️ PROBLÈME |
| CSS variables OK | ✅ / ⚠️ PROBLÈME |
| Prêt à déployer | ✅ OUI / ❌ NON |

Si un problème est détecté, LE CORRIGER avant de donner la commande de déploiement.
Ne jamais donner `docker compose up -d --build site` si la checklist a une ❌.
