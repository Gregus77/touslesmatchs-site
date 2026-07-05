---
name: smart-model
description: >
  Selectionne dynamiquement le modele IA optimal (haiku/sonnet/opus) en
  fonction de la complexite de la demande. Economise les tokens sur les
  taches simples, reserve la puissance pour le complexe.
---

# Skill : Selection dynamique du modele

Quand ce skill est invoque, tu dois :

## 1. Classifier la demande en 3 niveaux

### Niveau 1 — HAIKU (economique)
Taches mecaniques, repetitives ou a faible risque :
- Renommer une variable / fonction
- Corriger une typo ou du formatage
- Ajouter/modifier un commentaire ou du texte statique
- Lire un fichier et repondre a une question factuelle simple
- Modifier une valeur de config (couleur, taille, texte)
- Ajouter un element a une liste existante (ex: nouvelle ligue dans TRUSTED_COMPETITIONS)
- Generer du contenu repetitif (traductions, donnees statiques)
- Questions oui/non sur le code

### Niveau 2 — SONNET (equilibre)
Taches de dev standard :
- Corriger un bug dans un seul fichier
- Ajouter une fonctionnalite simple (nouvel endpoint, nouveau bouton)
- Modifier du CSS / responsive
- Ecrire ou modifier des tests
- Refactoring localise (une fonction, un module)
- Analyser un log d'erreur et proposer un fix
- Modifier la logique metier dans un scope limite
- Questions "comment ca marche" sur une partie du code

### Niveau 3 — OPUS (puissance maximale)
Taches complexes ou a haut risque :
- Refactoring multi-fichiers
- Architecture / design de nouvelles features majeures
- Debug complexe (race conditions, memory leaks, comportements intermittents)
- Revue de securite
- Modification de la logique Stripe / paiements
- Modification du systeme de Concile (agents IA, orchestration)
- Analyse et optimisation de performance
- Migration de donnees ou schema DB
- Tout ce qui touche a plus de 3 fichiers simultanement
- Questions d'architecture ou de strategie technique

## 2. Deleguer au sous-agent avec le bon modele

Une fois le niveau determine, lance un Agent avec le parametre `model` correspondant :
- Niveau 1 → `model: "haiku"`
- Niveau 2 → `model: "sonnet"`
- Niveau 3 → `model: "opus"`

Format de delegation :
```
Agent({
  description: "[description courte de la tache]",
  model: "[haiku|sonnet|opus]",
  prompt: "[briefing complet avec tout le contexte necessaire, fichiers concernes, et instructions precises]"
})
```

## 3. Annoncer le choix

Avant de lancer l'agent, dis au user :
- Le niveau choisi (1/2/3)
- Le modele utilise
- Pourquoi (une phrase)

Exemple : "Niveau 1 (Haiku) — c'est un renommage simple, pas besoin de sortir l'artillerie lourde."

## 4. Regles

- En cas de doute entre deux niveaux, prendre le niveau superieur
- Si la tache evolue en cours de route et devient plus complexe, relancer avec un modele superieur
- Ne jamais utiliser opus pour une tache de niveau 1 — c'est du gaspillage
- Le contexte du CLAUDE.md doit TOUJOURS etre inclus dans le prompt du sous-agent (fichiers cles, regles metier, etc.)
- Le sous-agent doit recevoir un briefing complet et autonome (il ne voit pas la conversation)
