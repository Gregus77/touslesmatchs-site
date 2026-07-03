---
name: checklist
description: Verification systematique avant de declarer un travail termine. Relit la demande utilisateur, compare avec le code modifie, et liste ce qui est fait vs ce qui manque.
trigger: auto
---

# Skill : Checklist de verification

## Quand utiliser
- AVANT chaque message de livraison ("c'est fait", "c'est pushe", "voici le resume")
- AVANT chaque commit
- A chaque fin de tache

## Procedure obligatoire

### Etape 1 — Relire la demande
Remonter dans la conversation et lister CHAQUE point demande par l'utilisateur.
Ne pas se fier a la memoire — relire les messages exactement.

### Etape 2 — Verifier dans le code
Pour CHAQUE point de la demande :
1. Grep/Read le fichier concerne
2. Confirmer que le changement est effectivement present
3. Si c'est du frontend visible : verifier que le HTML/JS est correct et fonctionnel

### Etape 3 — Checklist de livraison
Presenter au format :
```
✅ [point demande] — fait (fichier:ligne)
✅ [point demande] — fait (fichier:ligne)
❌ [point demande] — PAS ENCORE FAIT → je corrige maintenant
```

### Etape 4 — Corriger avant de livrer
Si un point est ❌, le corriger AVANT de declarer le travail termine.
Ne JAMAIS dire "c'est fait" si un point est manquant.

## Regles
- Ne pas compter un changement comme "fait" s'il n'est que dans le code mais pas deploye — le preciser clairement
- Si l'utilisateur a demande quelque chose a l'oral (transcription), interpreter le sens meme si la formulation est approximative
- En cas de doute sur une demande, demander confirmation plutot que d'ignorer
- Ne JAMAIS inventer des taches qui n'ont pas ete demandees
- Les changements de texte visibles par l'utilisateur doivent etre verifies dans le HTML/JS final, pas juste dans un endpoint API
