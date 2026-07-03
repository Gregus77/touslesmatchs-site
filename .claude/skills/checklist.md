---
name: checklist
description: >
  Verification OBLIGATOIRE avant toute livraison. Relit CHAQUE message utilisateur
  de la session, extrait les demandes, verifie dans le code, corrige les manques.
  Ne JAMAIS dire "c'est fait" sans avoir execute ce skill.
trigger: auto
---

# Skill : Checklist anti-oubli

## OBLIGATION
Ce skill est OBLIGATOIRE avant :
- Chaque commit
- Chaque message qui dit "fait", "termine", "pushe", "voici le resume"
- Chaque fin de tache

## Procedure

### 1. Extraire TOUTES les demandes
Remonter dans TOUS les messages utilisateur de la session.
Lister chaque demande sous forme de bullet point.
Inclure les demandes orales (transcriptions vocales) — interpreter le sens.

### 2. Verifier dans le code REEL
Pour chaque demande :
- Grep ou Read le fichier concerne
- Verifier que le changement est REELLEMENT present dans le fichier
- Pour du frontend : verifier le HTML/JS final, pas juste l'API
- Pour du Telegram : verifier le message exact qui sera envoye

### 3. Lister le statut
```
✅ [demande] — verifie (fichier:ligne)
❌ [demande] — MANQUANT → corriger maintenant
```

### 4. Corriger AVANT de repondre
Si un seul point est ❌ : corriger le code, re-verifier, puis seulement repondre.
Ne JAMAIS livrer avec un point manquant.
Ne JAMAIS promettre que "ca sera fait au prochain commit".

## Regles strictes
- Ne pas confondre "code pushe" et "deploye sur le VPS" — le preciser
- Ne pas s'auto-congratuler — donner la commande de deploiement et c'est tout
- Ne pas faire de blabla — checklist + commande de deploiement
- Si l'utilisateur a dit quelque chose 5 messages plus tot, ca compte toujours
- En cas de doute : demander AVANT de livrer, pas apres
