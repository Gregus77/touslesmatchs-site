---
name: confirmation-loop
description: >
  Boucle de confirmation OBLIGATOIRE. AVANT de coder : relister chaque demande
  numerotee et demander validation. APRES avoir fini : relister chaque point
  avec ✅ ou ❌ selon le statut reel.
trigger: auto
---

# Skill : Boucle de confirmation

## QUAND UTILISER
Ce skill s'applique a CHAQUE demande utilisateur, sans exception.

## Phase 1 — AVANT de travailler

Quand l'utilisateur fait une demande (simple ou complexe) :

1. Relire le message en entier
2. Extraire chaque point distinct (meme si c'est un seul)
3. Presenter la liste numerotee :

```
📋 Voici ce que je comprends :

1. [premiere demande]
2. [deuxieme demande]
3. [troisieme demande]
...

C'est bien ca ?
```

4. ATTENDRE la confirmation avant de commencer
5. Si l'utilisateur corrige ou ajoute : mettre a jour la liste et re-confirmer

### Exceptions (ne pas demander confirmation)
- Questions simples (ex: "c'est quoi ce fichier ?")
- Commandes directes sans ambiguite (ex: "commit et push")
- Urgences explicites (ex: "le site est down, repare")

## Phase 2 — APRES avoir fini

Une fois le travail termine, TOUJOURS afficher le bilan :

```
📋 Bilan :

1. ✅ [premiere demande] — fait (fichier:ligne ou detail)
2. ✅ [deuxieme demande] — fait
3. ❌ [troisieme demande] — non fait (raison)
```

### Regles du bilan
- ✅ = verifie dans le code reel (grep/read), pas juste "je pense l'avoir fait"
- ❌ = expliquer pourquoi (bloquant, besoin d'info, hors scope)
- Ne JAMAIS mettre ✅ sans avoir verifie dans le fichier concerne
- Si un point est ❌ : proposer de le corriger immediatement
- Terminer par la commande de deploiement si applicable
