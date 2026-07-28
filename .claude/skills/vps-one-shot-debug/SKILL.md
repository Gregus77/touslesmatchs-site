---
name: vps-one-shot-debug
description: Utiliser à CHAQUE fois qu'une tâche implique de faire agir Greg comme mains sur le VPS (copier-coller des commandes dans son terminal SSH) pour diagnostiquer ou corriger quelque chose — bug, conflit git, service qui plante, endpoint manquant, déploiement, etc. Déclenche dès qu'il faudrait normalement plus d'un aller-retour "colle-moi ça" / "colle-moi ceci ensuite". Ne pas utiliser pour du travail fait directement dans le dépôt local (Read/Edit/Bash classiques) — uniquement quand Greg doit lui-même exécuter les commandes sur le VPS.
---

# Débogage VPS en un seul coup

## Pourquoi ce skill existe

Le 28/07/2026, une session de fusion git a duré des dizaines d'aller-retours
parce que chaque étape (diagnostiquer → montrer le résultat → corriger →
revérifier) a été demandée séparément à Greg, qui devait copier-coller une
commande, attendre, recopier le résultat, etc. Greg a fini par dire "arrête de
me faire tourner en rond, mets tes questions en une seule commande" — et une
fois qu'on l'a fait, chaque problème s'est réglé en un seul message.

**Règle absolue : ne JAMAIS demander à Greg d'exécuter une commande "juste
pour voir", puis attendre son retour pour écrire la commande suivante — sauf
si le résultat de la première est réellement imprévisible ET que la suite
dépend qualitativement de ce résultat (ex: choisir entre deux fusions
possibles selon un contenu qu'on n'a jamais vu).** Dans tous les autres cas
(vérifier qu'un truc existe puis le corriger, vérifier la syntaxe puis
déployer, etc.), tout se regroupe dans UNE seule commande avec de la logique
conditionnelle dedans.

## La méthode

1. **Anticipe les deux issues avant de lancer quoi que ce soit.** Si le
   diagnostic peut donner "présent" ou "absent", "valide" ou "cassé" — écris
   le script qui gère les deux cas dans le même bloc (`if grep -q ... ; then
   ... else ... fi`), pas deux messages séparés.
2. **Une seule commande = diagnostic + correction + vérification + (si
   pertinent) déploiement.** Exemple de schéma qui marche bien :
   ```bash
   cd /opt/touslesmatchs
   if <condition de diagnostic>; then
     echo "cas A"
   else
     echo "cas B — je corrige"
     <correction>
   fi
   node -c scripts/api_server.js && echo "SYNTAXE OK"
   git add <fichier> && git commit -m "..." && git push origin <branche>
   docker compose up -d --build <service>
   sleep 8
   curl -s <endpoint de vérification>
   ```
3. **N'écris qu'UN seul bloc de code par message.** Si la tâche a plusieurs
   étapes logiques, elles vont TOUTES dans ce même bloc — jamais "colle ça,
   puis attends, puis colle ça".
4. **Ne redemande jamais un `grep -n`/`sed -n` de pure lecture si tu peux
   éviter le second aller-retour** en combinant lecture + action dans le
   script (ex: lire une fonction avec Python, la remplacer, réécrire le
   fichier, tout dans le même heredoc `python3 << 'PYEOF' ... PYEOF`).

## Pièges de terminal à éviter systématiquement

Ces pièges ont chacun cassé une commande cette nuit-là — ne pas les répéter :

- **Jamais de `!` non échappé dans une chaîne entre guillemets doubles** dans
  une commande bash interactive (`"...!staleRows..."` déclenche l'expansion
  d'historique → `event not found`). Utiliser des guillemets simples, ou
  éviter le caractère, ou passer par un script Python/fichier.
- **Pour tout contenu multi-ligne avec accents, guillemets, backticks ou
  caractères spéciaux (JS, JSON, HTML, texte de commit) : ne PAS faire de
  gros `sed`/heredoc manuel avec calcul de numéros de ligne à la main.**
  Un terminal peut tronquer ou mélanger un collage long, et les numéros de
  ligne dérivent silencieusement après chaque édition précédente. Préférer
  un script `python3 << 'PYEOF' ... PYEOF'` qui repère le texte par un
  **ancrage textuel unique** (une ligne de contexte qui existe forcément),
  pas par un numéro de ligne fixe.
- **Après toute édition manuelle de fichier via sed/python sur un fichier de
  code, valider avec l'outil du langage avant de committer**
  (`node -c fichier.js` pour JS, etc.) — jamais supposer que ça a marché.
- **Si un fichier a été coupé/tronqué par une édition ratée**, ne pas
  deviner le texte manquant : le récupérer avec `git show :2:<fichier>`
  (stage "ours"/HEAD pendant un merge) ou `git show <ref>:<fichier>` et
  l'insérer précisément à l'ancre correcte, comme fait pour
  `scripts/api_server.js` cette nuit-là.
- **`cd /opt/touslesmatchs` en début de bloc systématiquement** si la
  commande touche au dépôt — Greg se retrouve régulièrement dans `~` après
  un nouveau login SSH, ce qui fait échouer git/node silencieusement avec
  des messages trompeurs ("not a git repository").
- **Si le terminal affiche des `-bash: syntax error` en cascade sans rapport
  avec la commande envoyée**, c'est probablement un vieux collage qui traîne
  dans le buffer, pas une vraie erreur de la commande — ne pas paniquer, ne
  pas relancer en boucle, juste redemander un `git status`/état propre et
  répéter la commande une fois proprement.

## Ton envers Greg

Il est développeur/fondateur mais pas dev système au quotidien tard le soir.
Donne des blocs de commande **complets et directement copiables**, avec une
seule ligne d'explication avant (jamais un roman). S'il dit qu'il tourne en
rond, c'est un signal fort : regrouper immédiatement, pas se justifier.
