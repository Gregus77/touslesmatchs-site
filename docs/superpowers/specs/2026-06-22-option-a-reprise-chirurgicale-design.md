# Option A - Reprise chirurgicale TousLesMatchs

Date: 2026-06-22
Branche autorisee: `claude/happy-bell-h9zj83`
Statut: design valide par Gregory, avant implementation

## Objectif

Remettre TousLesMatchs sous controle sans reconstruire tout le produit. La priorite absolue est la verite des donnees sportives: aucun match invente, aucun score simule, aucune analyse live presentee comme reelle sans source API verifiee.

Cette phase ne cherche pas encore a optimiser Stripe, Brevo, SEO ou le style du site. Elle stoppe les erreurs qui peuvent detruire la confiance: faux matchs, mauvaises stats live, sources de picks concurrentes et deploiements dangereux.

## Principes non negociables

- Une donnee inconnue reste inconnue. Le site affiche "indisponible" au lieu d'inventer.
- Le Concile ne recoit que des matchs verifies ou des picks explicitement marques comme manuels.
- Les statistiques temps reel exigent un `fixtureId` API-Sports valide.
- Hermes peut gerer les donnees metier, mais ne doit pas piloter librement le code ou la branche.
- Les changements restent sur `claude/happy-bell-h9zj83`.
- Chaque modification fonctionnelle est petite, testee et committee avec des fichiers explicitement ajoutes.

## Scope inclus

### 1. Stopper les donnees fictives

Supprimer ou neutraliser les chemins qui presentent des matchs demo, fallback, scores par defaut ou contextes "live" comme s'ils etaient reels.

Comportement attendu:
- si les APIs sportives ne repondent pas: liste vide + message clair;
- si un match n'a pas d'identifiant API fiable: pas de stats live;
- si un score est inconnu: afficher `?`, pas `0-0` sauf si l'API donne vraiment 0-0.

### 2. Stabiliser `/live-matches`

Faire de `/live-matches` une route de lecture verifiable:
- renvoyer uniquement des matchs issus de football-data.org ou API-Sports;
- conserver l'origine de chaque match (`source`);
- conserver l'identifiant source (`fixtureId`, `sourceId`);
- ne pas melanger matchs termines et matchs live dans l'affichage principal;
- journaliser les erreurs d'API sans retourner de fausse donnee.

### 3. Stabiliser les stats live

Isoler la recuperation de statistiques dans une fonction stricte:
- accepter uniquement les fixtures football API-Sports;
- retourner un objet `{ available, source, reason, stats }`;
- ne pas injecter de bloc stats dans le prompt si `available` est faux;
- exposer assez de logs pour savoir si la panne vient de la cle, du quota, du fixture id ou de l'API.

### 4. Stabiliser le Concile Live

Le Concile doit recevoir un contexte contractualise:
- match verifie;
- score et minute marques comme reels ou inconnus;
- stats live presentes seulement si verifiees;
- liste de paris autorises calculee a partir du score connu;
- aucune recommandation basee sur une supposition cachee.

### 5. Source de verite des picks

Choisir un flux unique pour le pick du jour:

`Hermes -> public/data/picks.json -> volume /picks/picks.json -> API /current-pick -> frontend`

`/var/touslesmatchs/current_pick.json` reste un fallback admin manuel, pas la source normale.

Le format `currentPick` doit rester compatible avec l'existant, mais on ajoute progressivement:
- `source`;
- `sourceMatchId` ou `fixtureId` quand connu;
- `updatedAt`;
- `status` normalise.

### 6. Encadrer Hermes

Hermes reste l'assistant operationnel, mais il est borne:
- autorise a lire/ecrire `public/data/picks.json`, `data/picks.json`, fichiers de memoire et fichiers de notification;
- interdit de modifier le code applicatif dans cette phase;
- la commande `/deploy` doit etre neutralisee ou transformee en check read-only;
- toute action git destructive ou ambigue est exclue.

### 7. Verification minimale

Avant chaque commit de code:
- `node --check scripts/api_server.js`;
- verification syntaxe de `scripts/hermes_admin_bot.js` si modifie;
- test manuel local ou script de smoke test sur les routes touchees;
- `git add` uniquement sur les fichiers concernes.

## Hors scope temporaire

- Refonte UI generale.
- Stripe complet et relances Brevo avancees.
- SEO editorial.
- Ponderation long terme des agents.
- Migration complete vers une nouvelle base de donnees.

Ces sujets viennent apres la stabilisation de la verite sportive.

## Risques identifies

- Le depot contient plusieurs surfaces concurrentes: `public/*.html`, `src/React`, `dist`, scripts Node et Concile Python.
- Les chemins de picks sont multiples et peuvent donner l'impression que "Hermes efface" alors que le front et l'API ne lisent pas la meme source.
- Les fallbacks historiques rendent le produit plus joli mais moins fiable.
- Le Concile Python contient au moins une anomalie visible: `council/tools/sports_api.py` utilise `os.environ` sans `import os`.
- Le container Hermes a acces a `/repo` et peut lancer du git; c'est trop puissant pour un assistant metier.

## Ordre d'implementation propose

1. Ajouter des tests/smoke checks sur les normalisateurs de matchs et les routes live.
2. Corriger les erreurs evidentes bloquantes sans changer le comportement public au-dela de la suppression des mensonges.
3. Remplacer les fallbacks fictifs par des etats vides explicites.
4. Ajouter `source`, `fixtureId` et `statsStatus` dans le flux live.
5. Adapter le front Live IA pour respecter ces etats.
6. Encadrer Hermes et neutraliser `/deploy`.
7. Committer par tranche fonctionnelle.

## Definition de fini

La phase Option A est terminee quand:
- aucun match fictif ne peut apparaitre comme match live;
- une absence d'API produit un etat vide clair;
- une analyse live sans stats explique pourquoi les stats sont absentes;
- les picks ont une source de verite claire;
- Hermes ne peut plus ramener ou ecraser une version du site par erreur;
- les checks syntaxiques passent.
