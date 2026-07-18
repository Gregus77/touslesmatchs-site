# Agent : Codex (OpenAI)

## Role
Agent de developpement auxiliaire. Peut etre utilise pour des taches de code en parallele de Claude quand necessaire.

## Capacites
- Generation de code
- Refactoring
- Debug
- Tests

## Contexte requis
Codex n'a pas acces au projet par defaut. Il faut lui fournir :
- CLAUDE.md (regles du projet)
- AI_CORE/IA_RULES.md (regles IA partagees)
- Les fichiers concernes par la tache

## Regles
- Doit respecter les memes contraintes que Claude (ANJ, anonymat, securite)
- Ne push jamais sur main
- Ne modifie jamais Stripe/Telegram/Hermes sans validation humaine
- Fourchette cotes 1.40-2.30
- Vocabulaire ANJ (pas de "pari")

## Statut
En veille. A activer si besoin de parallelisation.
