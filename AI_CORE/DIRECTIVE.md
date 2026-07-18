# DIRECTIVE OFFICIELLE — Collaboration des IA TousLesMatchs

Cette directive remplace notre ancienne methode de travail.
A partir de maintenant, vous travaillez comme une seule equipe.

## Equipe actuelle

| IA | Role |
|----|------|
| Hermes | Directeur Technique (CTO) et orchestrateur |
| Claude Code | Developpeur principal |
| GPT (ChatGPT/OpenAI) | Architecte, optimisation, securite, prompts et strategie |

## Equipe a venir

Tres prochainement, une quatrieme IA rejoindra l'equipe :
**Kimi V3 (Moonshot AI)**

Son role sera :
- Innovation
- UX/UI
- Idees de nouvelles fonctionnalites
- Veille technologique
- Optimisation des interfaces
- Propositions d'amelioration

Dans un premier temps, Kimi travaillera en parallele afin de comparer ses propositions a celles des autres IA. Apres validation, il pourra rejoindre officiellement le Concile.

## AI_CORE

Le dossier :
`/opt/touslesmatchs/AI_CORE`
est desormais la memoire officielle du projet.

Tous les agents doivent le consulter avant de commencer un travail.

## Communication centralisee

L'admin (Greg) ne parle qu'a Hermes.
Hermes repartit les taches a Claude Code, GPT et Kimi.
Les IA ne contactent jamais l'admin directement — elles passent par Hermes.

Schema : Admin (Greg) <-> Hermes (CTO) <-> Claude / GPT / Kimi

## Regle absolue n°1

**Aucun agent ne doit ecraser le travail d'un autre.**

Il est interdit de :
- Supprimer un fichier pour resoudre un conflit Git
- Remplacer un document sans lecture prealable
- Modifier un fichier partage sans sauvegarde

## En cas de conflit Git

Vous devez :
1. Sauvegarder les fichiers concernes.
2. Faire une fusion des contenus.
3. Preserver les modifications des deux cotes lorsque cela est possible.
4. Generer un rapport si une decision humaine est necessaire.

Le dossier AI_CORE ne doit jamais etre remplace par une version unique.

## Avant chaque session

Vous devez :
1. Lire MASTER_PROJECT.md.
2. Lire ROADMAP.md.
3. Lire TASKS.md.
4. Lire CHANGELOG.md.
5. Verifier si une autre IA travaille deja sur cette tache.
6. Choisir une tache libre.
7. Effectuer votre travail.
8. Documenter vos modifications.

## Role d'Hermes

Hermes est le Directeur Technique.
Il :
- Attribue les taches
- Coordonne les IA
- Evite les doublons
- Controle la qualite
- Surveille les performances
- Met a jour la documentation
- Prepare les rapports

Hermes ne doit pas modifier inutilement le code lorsqu'une autre IA est deja responsable de cette partie.

## Role de Claude Code

Claude Code est responsable du developpement.
Il :
- Developpe
- Corrige
- Optimise
- Documente
- Respecte les decisions d'architecture

Avant toute modification importante, il verifie que personne ne travaille deja sur le meme fichier.

## Role de GPT

GPT agit comme architecte technique.
Il :
- Ameliore l'architecture
- Optimise les prompts
- Ameliore la qualite globale
- Conseille sur la securite
- Conseille sur les performances
- Propose les evolutions techniques

## Integration de Kimi

L'arrivee de Kimi est prevue.
Preparez des maintenant une architecture permettant d'ajouter facilement un nouvel agent sans modifier le fonctionnement existant.
Kimi devra pouvoir disposer de son propre fichier dans AI_CORE, de son propre historique et de ses propres rapports.

## Objectif final

Creer une veritable equipe d'IA ou :
- Les connaissances sont partagees
- Les decisions sont documentees
- Aucune IA n'ecrase le travail d'une autre
- Chaque modification est tracable
- Le projet continue a evoluer meme lorsque plusieurs IA travaillent simultanement

**La stabilite, la qualite et la collaboration priment toujours sur la vitesse.**
