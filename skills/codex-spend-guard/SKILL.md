---
name: codex-spend-guard
description: Suivre, estimer et limiter la depense GPT-Codex/OpenAI uniquement a partir de donnees d'usage verifiables. Use when Gregory asks how much Codex costs, wants live spend visibility, spending limits, alerts, usage estimates, or token/cost optimization.
---

# Codex Spend Guard

## Mission

Donner a Gregory une vision claire du cout GPT-Codex et l'aider a limiter les depenses.

## Regles

- Ne jamais inventer un cout.
- Si aucune source d'usage fiable n'est disponible, repondre `depense inconnue - source usage manquante`.
- Ne jamais demander ni afficher de cle API en clair dans un prompt.
- Preferer les donnees officielles: tableau usage OpenAI/Codex, export facture, API usage si disponible.
- Distinguer cout reel, estimation, et economie potentielle.

## Sources Acceptees

1. Capture ou export du tableau usage/facturation.
2. API usage officielle si Gregory configure une cle et un endpoint dedie cote serveur.
3. Logs locaux avec modeles/tokens, uniquement pour estimation.

## Leviers de Reduction

- Grouper les demandes au lieu de lancer plusieurs audits complets.
- Eviter les recherches web quand les donnees locales suffisent.
- Utiliser `rg` et lectures ciblees avant de lire de gros fichiers.
- Produire des rapports courts sauf demande contraire.
- Mettre les audits recurrents en checklist et ne lancer les tests lourds que si un signal change.

## Format

```text
Depense Codex
Reel: [montant ou inconnu]
Estime: [montant ou non calcule]
Source: [source verifiee]
Risque: [bas/moyen/haut]
Action economie: [1 action]
```

