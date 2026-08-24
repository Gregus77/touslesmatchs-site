# Plan Hermès — automatisation, pas troisième chef

Cadré par Greg le 25/08/2026, après discussion sur l'organisation des IA.

## Qui décide de quoi (clarifié par Greg)

- **Le Concile** (5 agents : Perplexity, DeepSeek, Mistral, Cohere, Qwen) :
  votent sur les matchs, comme aujourd'hui. **Inchangé par ce plan.**
- **Claude et GPT : "les chefs".** Ce sont eux qui développent, décident,
  arbitrent. **Quand l'un des deux ne sait pas ou n'est pas sûr, il pose la
  question à Greg au lieu de deviner** — règle permanente, pas seulement
  pour ce projet.
- **Hermès : PAS un troisième chef, PAS un décideur.** Une couche
  d'automatisation qui exécute des tâches bien définies et rend compte —
  l'équivalent d'un employé qui suit une procédure écrite, pas d'un
  manager qui a le dernier mot.

## Trois paliers, par risque croissant

### Palier 1 — Rapports automatiques (faible risque, réversible)

Hermès (le bot `hermes-admin`, aujourd'hui vide) envoie à Greg par
Telegram : le rapport hebdo du Concile, le solde OpenRouter/Stripe, l'état
du moteur (item 1 de `NOTE-SITE.md`), toute alerte (panne, solde bas).
Uniquement lecture + envoi de message à Greg. Peut être autonome sans
risque réel : ça informe, ça n'agit pas.

**Coût estimé** : quelques heures de développement. Le conteneur existe
déjà, il faut juste lui donner ce rôle.

### Palier 2 — Actions réversibles, sur demande explicite

Exécuter une liste blanche de commandes prédéfinies quand Greg les demande
via Telegram ("redémarre l'API", "montre-moi le dernier rapport",
"vérifie le solde OpenRouter"). Toujours déclenché par Greg, jamais
spontané.

**Coût estimé** : plus de travail — système de commandes, permissions,
journal de ce qui a été exécuté.

### Palier 3 — Actions irréversibles (argent, envoi de masse) — PAS D'AUTOMATISATION SEULE

Paiements, envoi Telegram à tous les abonnés, changement de prix : restent
**toujours** validés explicitement par Greg, même une fois Hermès
construit. **Ce n'est pas une limite technique temporaire — c'est une
règle permanente**, cohérente avec la règle déjà écrite dans `CLAUDE.md`
("Hermès ne doit pas pousser de modification... sans validation explicite
de Greg").

Raison concrète, pas théorique : l'incident du 24/08 (plafond OpenRouter
multiplié par 6 parce qu'un contrôle de sécurité n'était qu'un message
affiché, pas un vrai blocage) montre ce qui arrive quand une automatisation
agit seule sur quelque chose d'irréversible. Un humain dans la boucle sur
ces actions n'est pas de la lenteur, c'est le filet qui a évité que ça
tourne mal.

## Qui construit Hermès

Claude et/ou GPT, comme n'importe quel autre développement du projet —
Hermès ne peut pas se construire lui-même.

## Prochaine étape concrète

Commencer par le Palier 1 seul (rapports automatiques) : risque nul,
valeur immédiate (Greg n'a plus à demander l'état des choses, il le reçoit).
Ne pas commencer le Palier 2 avant que le Palier 1 tourne de manière fiable
depuis au moins une semaine.
