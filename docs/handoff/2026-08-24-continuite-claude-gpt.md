# Handoff continuité — 24/08/2026

Écrit par Claude, pour que GPT (ou Codex, ou un nouveau Claude) puisse
reprendre sans relire toute la conversation. Greg alterne entre plusieurs IA
selon leurs limites d'usage respectives ; ce fichier est le point de reprise.

## Gouvernance en place (rappel, voir CLAUDE.md)

- `public/index.html` : jamais modifié sans validation Greg + GPT + Codex.
- Codex pilote les décisions opérationnelles de déploiement.
- Toute modification de `scripts/api_server.js`, `public/`, `docker-compose.yml`
  se prépare en commit/branche isolée, jamais mêlée à un autre sujet, et
  n'est **jamais poussée/déployée sans validation explicite de Greg**.
- Base de données : toujours en lecture seule (`{readonly:true}`) pour le
  diagnostic. Aucun nettoyage d'historique sans accord explicite.
- ANJ : jamais le mot "pari" côté public, jamais de garantie de gain.

## État des branches au 24/08/2026

- `origin/design-wow-complet` = production actuelle (base de référence pour
  toute nouvelle branche isolée).
- `origin/claude/fix-euros-abonnes-analysis-history` : le correctif "euros
  uniquement sur signaux envoyés" (`sig_sent_*`) est **déjà fusionné dans la
  production** — rien à refaire dessus.
- `origin/claude/fix-serie-c-avant-analyse` (commit `7c80c78`) : ajoute
  "coppa italia serie c" / "serie c" à `LOW_TRUST_COMPETITION_KEYWORDS`.
  **Préparé, poussé, PAS déployé.** Un seul fichier (`scripts/api_server.js`),
  12 lignes, 8 cas de test conformes. En attente de validation Greg + Codex
  avant `git merge --ff-only` sur le VPS.
- `origin/claude/tiktok-arjel-automation-hgp1tv` : contient des travaux
  antérieurs (R4/R5 football uniquement, badges de palier, séparation
  abonnés/observées) — voir les patches dans `docs/proposals/` sur cette
  branche, aucun n'est appliqué à `public/`.

## Problème n°1 — diagnostiqué et résolu (config, pas de code)

**Constat** : ~37% des analyses résolues se décidaient avec moins de 3 agents
IA sur 5-6, à 45% de winrate (sous la rentabilité). Déjà bloqué à la
diffusion (`consensus_votes < 3`), donc aucun abonné n'a reçu de mauvais
signal — mais ~16 000 appels IA payés pour rien depuis fin juillet.

**Cause confirmée** (pas une hypothèse) : le plafond journalier de repli
OpenRouter (`OPENROUTER_FALLBACK_DAILY_CAP`, défaut 60) est atteint ou
frôlé la plupart des jours (60/60 le 14/08, 60/60 le 20/08, 59, 46, 49 les
autres jours mesurés). Une fois le plafond atteint, tout agent dont le
fournisseur primaire est en panne échoue **en silence, sans aucune trace**
dans `agent_calls` (le traçage est à l'intérieur de la boucle d'appel,
jamais exécutée si aucun fournisseur n'est tenté).

**Solution donnée à Greg** (commande VPS, pas de commit) : vérifier le solde
OpenRouter, puis passer `OPENROUTER_FALLBACK_DAILY_CAP` de 60 à 120 dans
`.env`, puis `docker compose up -d api`. Variable déjà câblée dans
`docker-compose.yml`. **Statut au moment de l'écriture : commande donnée à
Greg, pas encore confirmé qu'il l'a exécutée.**

**Non résolu** : la cause racine de pourquoi les fournisseurs primaires
tombent aussi souvent (comptes, clés, quotas) n'a pas été creusée. Doubler
le plafond de repli est un palliatif, pas une réparation.

## Prochaines étapes possibles (Greg décide de l'ordre)

1. Confirmer que le nouveau plafond OpenRouter est actif et mesurer l'effet
   sur le taux de matchs sous le seuil de vote la semaine suivante.
2. Investiguer pourquoi les fournisseurs primaires (Perplexity, DeepSeek,
   Mistral, Cohere direct) tombent aussi souvent.
3. Déployer `7c80c78` (Coppa Italia Serie C) une fois validé par Codex.
4. Statuer sur les patches en attente dans `docs/proposals/` (badges de
   palier, séparation abonnés/observées côté front `public/index.html` et
   `public/performances.html`).
5. `OR-KimiK3` (banc d'essai, 72% sur 65 résolues) : à re-mesurer une fois
   l'échantillon >= 100, pas encore éligible.

## Comment reprendre (pour l'IA qui lit ceci)

- Toujours partir de `origin/design-wow-complet` pour une branche isolée,
  jamais d'une branche de travail précédente (elle peut avoir dérivé).
- Ne jamais pousser/déployer sans que Greg l'ait explicitement demandé dans
  le message en cours — une validation passée ne vaut pas pour un nouveau
  sujet.
- Toute mesure sur la base de production se fait en lecture seule
  (`docker exec -i touslesmatchs-api node -` avec `{readonly:true}`), jamais
  en écriture directe.
