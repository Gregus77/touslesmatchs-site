---
name: tlm-ai-lab
description: Banc d'essai prive pour comparer des IA supplementaires gratuites ou peu couteuses avec API sur les pronostics TousLesMatchs, sans les afficher au public. Use when Codex evaluates new AI agents, model candidates, hidden challengers, winrate, latency, cost, or promotion rules for the Concile.
---

# TLM AI Lab

## Mission

Tester plus d'IA en arriere-plan pour garder seulement celles qui ameliorent les decisions du Concile.

## Regles

- Ne jamais afficher les agents experimentaux aux clients.
- Ne jamais promouvoir une IA sans echantillon resolu suffisant.
- Mesurer winrate, profit simule, marche, competition, minute, latence, cout, erreurs API.
- Exclure ou degrader les matchs amicaux, U20, U21, reserves et competitions peu fiables.
- Toujours marquer la disponibilite PS3838 comme `confirmee`, `non trouvee` ou `a verifier`.
- Une IA gratuite avec mauvais resultat coute quand meme de la confiance: la couper.

## Candidats

Tester seulement si une cle/API fiable est configuree:
- Gemini Flash;
- Groq petits modeles;
- DeepSeek;
- Mistral;
- Perplexity, seulement si la source web/API est verifiable et le cout maitrise;
- Qwen ou autre modele via fournisseur compatible;
- Ollama/modeles locaux si le VPS peut suivre sans ralentir le site.

## Promotion

- Moins de 20 predictions resolues: laboratoire seulement.
- 20 a 49 resolues: poids faible dans le Chief, jamais visible client.
- 50+ resolues et avantage clair: proposer a Gregory de promouvoir.
- Sous 45% sur 20 resolues: desactiver ou limiter aux cas ou elle performe.

## Rapport

```text
AI Lab - [date]
Meilleur challenger: [nom ou aucun]
A couper: [nom ou aucun]
Signal utile: [marche/competition/minute]
Decision proposee: [garder/tester/couper]
```
