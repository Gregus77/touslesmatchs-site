# AGENTS.md — Règles communes à TOUTES les IA de développement

> Ce fichier est lu par **tous les agents de code** qui travaillent sur ce dépôt :
> **Claude Code** (lit aussi `CLAUDE.md`), **GPT-5 / Codex / Cursor / Windsurf**
> (lisent `AGENTS.md`), et toute autre IA future. Il garantit qu'on travaille
> **ensemble sur un seul dossier** (ce dépôt git) **sans jamais effacer le
> travail de l'autre**.

## 📖 À lire au démarrage de CHAQUE session (dans l'ordre)

1. `PROJECT_STATE.md` — mémoire vivante : état courant + chantiers ouverts + incidents
2. `VERSION_LOCK.md` — commit de référence, interdit de rollback
3. `CLAUDE.md` — règles détaillées + économie de tokens + fichiers clés
4. `docs/CONSTITUTION.md`, `docs/INFRASTRUCTURE.md`, `docs/HERMES_COUNCIL.md`, `docs/BUSINESS_GROWTH.md`

**Ne ré-explore pas le projet pour « comprendre l'architecture » : tout est
documenté ci-dessus.** C'est ce qui économise les tokens.

## 🔐 RÈGLE ABSOLUE — pas d'écrasement sans accord du fondateur

**Aucune IA ne peut supprimer, écraser ou revenir en arrière sur la dernière
version d'un fichier produite par une autre IA (ou par le fondateur) sans
l'accord EXPLICITE du fondateur (Grégory).**

Concrètement :
- Si tu arrives après une autre IA et que tu veux modifier son travail récent :
  tu le signales au fondateur et tu **attends son feu vert** avant de toucher.
- Tu peux **ajouter** par-dessus (nouveau code, nouvelle fonctionnalité) librement.
- Mais **remplacer / supprimer / réécrire** ce qu'une autre IA vient de livrer =
  interdit sans validation. En cas de doute : demander, ne pas décider seul.
- Git n'efface jamais rien (tout est dans l'historique) — cette règle garantit
  qu'on ne se marche pas dessus **avant même** d'en arriver au conflit technique.
- La protection technique de cette règle = branche `main` protégée + fusion par
  Pull Request que **seul le fondateur approuve** (voir SETUP_COLLABORATION.md).

## 🤝 Les 4 règles d'or (ne jamais s'écraser)

1. **Une branche par IA/chantier, fusion par Pull Request.**
   - Claude développe sur `claude/<sujet>`.
   - GPT/Codex développe sur `gpt/<sujet>` (ou `codex/<sujet>`).
   - On ne pousse JAMAIS directement sur `main`. On fusionne via PR.
2. **`git pull` AVANT de pousser.** Toujours récupérer le travail de l'autre d'abord.
3. **`PROJECT_STATE.md` est la mémoire commune.** Le lire en premier, le mettre à
   jour à la fin de tout chantier significatif (état, commit, incident, décision).
4. **JAMAIS éditer un fichier directement sur le VPS.** Tout passe par le dépôt.
   (Incident du 16/07/2026 : une édition manuelle de `docker-compose.yml` sur le
   VPS a servi une vieille version pendant des semaines. Voir `PROJECT_STATE.md`.)

## 🚦 Se répartir le travail sans collision

- **Avant de commencer**, écrire dans `PROJECT_STATE.md` (section « Chantiers
  ouverts ») quel fichier/zone tu prends. L'autre IA le voit et évite la zone.
- **Commits petits et fréquents** > un gros commit fourre-tout. Moins de conflits.
- Si deux IA touchent le même fichier : git **signale un conflit** (il n'écrase
  jamais en silence). On résout le conflit, on ne force jamais par-dessus.
- **Ne jamais** `git push --force` sur une branche partagée ni sur `main`.

## 🚀 Déploiement (une seule voie autorisée)

```bash
cd /opt/touslesmatchs && bash scripts/deploy.sh
```

`deploy.sh` a 3 garde-fous : refuse si modifs non commitées (G1), si le web root
n'est pas `public/` (G2), ou si la page en ligne est cassée (G3, + alerte Telegram).
**Ne jamais contourner ces garde-fous.**

## 🔒 Règles métier gravées (voir `CLAUDE.md` pour le détail)

- **ANJ** : jamais le mot « pari » dans le contenu public. Utiliser « analyse IA »,
  « pick », « sélection ». Toujours le disclaimer joueurs-info-service.fr.
- **Anonymat du fondateur** : ne jamais exposer nom/photo/voix/adresse/téléphone.
- **R1** : aucun prono avant la 35ᵉ min ni après la 75ᵉ.
- **R2** : aucun prono sur un match à finalité connue (écart ≥ 3 buts).
- **Sécurité** : ne jamais afficher/loguer/committer les clés `.env`.
- **Priorité dev** : tout dev doit servir au moins un objectif (CA, conversion,
  confiance, automatisation, vitesse, UX). Sinon on ne développe pas.

## 🧠 Le Concile Hermès (IA runtime, ≠ IA de dev)

Hermès n'est pas une IA de chat comme Claude/GPT-dev. C'est le **moteur runtime**
qui tourne sur le VPS (services Docker `council` + `hermes-admin`) et analyse les
matchs chaque jour. Ses agents sont dans `council/agents/` (un fichier par agent,
même patron : `NAME`, `_get_client()`, `analyze()`). Pour ajouter un agent IA au
Concile, suivre ce patron — voir `docs/HERMES_COUNCIL.md`.
