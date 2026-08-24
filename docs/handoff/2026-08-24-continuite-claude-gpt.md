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

**Solution proposée puis PARTIELLEMENT ANNULÉE — erreur constatée le
24/08/2026.** Claude a proposé de passer `OPENROUTER_FALLBACK_DAILY_CAP` de
60 à 120, avec un contrôle de solde OpenRouter avant application. Deux
erreurs se sont cumulées :
1. Le contrôle de solde n'était qu'un message affiché, pas un blocage réel
   du script — il s'est exécuté même avec un solde critique.
2. La valeur de départ réelle dans `.env` était **20**, pas 60 (le défaut
   du code) : quelqu'un l'avait déjà resserrée sous le défaut, probablement
   à cause d'un solde déjà tendu. Le changement a donc multiplié par 6 un
   garde-fou volontairement restrictif.
3. Solde constaté au moment du changement : **2,91 $** (en baisse depuis le
   5,13 $ du 08/08/2026).

**Correctif appliqué dans la foulée** : plafond remis à 20. **Statut à
vérifier par la prochaine IA qui reprend** : confirmer avec Greg que le
plafond est bien revenu à 20 (`grep OPENROUTER_FALLBACK_DAILY_CAP .env` sur
le VPS) et que le solde OpenRouter a été rechargé avant toute nouvelle
tentative d'augmenter ce plafond. Vérifier aussi si le rechargement
automatique est actif sur le compte OpenRouter (risque de charge surprise
si le solde tombe à zéro, sinon les appels échouent proprement).

**Leçon pour toute IA future** : ne jamais faire dépendre une action risquée
d'un contrôle qui ne fait qu'imprimer un avertissement — le script doit
`exit` réellement si la condition de sécurité n'est pas remplie. Et
toujours lire la valeur RÉELLE dans `.env` avant de la comparer à un
défaut supposé du code : les deux peuvent diverger, et pas par hasard.

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


---

## MISE A JOUR — fin de session Claude, 24/08/2026 (blocage imminent de tokens)

**Etat exact au moment de la coupure**, pour reprise immediate sans reposer
les memes questions a Greg.

### Ce qui a ete fait et ce qui reste a confirmer

1. Erreur du plafond OpenRouter (voir section precedente) : cap remonte a
   tort de 20 a 120 avec un solde de 2,91 $, puis correction demandee
   (retour a 20) via `.env` + `docker compose up -d api`.
2. **NON CONFIRME** : Greg a colle plusieurs fois des sorties de terminal
   completement vides en reponse a des commandes de verification pourtant
   triviales (y compris un simple `date`, qui affiche TOUJOURS quelque
   chose sur un shell fonctionnel). Cinq tentatives de verification
   consecutives, toutes vides. Cause probable : Greg copie le contenu du
   terminal AVANT que le resultat ne s'affiche a l'ecran (copier-coller
   trop rapide), pas un vrai probleme technique cote VPS — mais **ce n'est
   pas prouve**, seulement la meilleure hypothese.
3. Consequence pratique : **l'IA qui reprend ne doit PAS supposer que le
   plafond est revenu a 20.** Il faut re-verifier avant toute autre
   decision touchant OpenRouter.

### Recommandation pour la prochaine IA (GPT ou autre)

Ne pas redemander a Greg de coller une sortie de terminal — ca a echoue 5
fois de suite ce soir. Deux alternatives proposees a Greg, sans reponse au
moment de la coupure :
- lui demander une **capture d'ecran** du terminal plutot qu'un copier-coller
  de texte (une image peut etre lue directement) ;
- lui demander de **dire le resultat avec ses mots**, sans rien copier.

Commande a utiliser des que la verification aboutit (une seule ligne,
volontairement sans `&&` pour ne jamais rester silencieuse) :
```bash
docker exec touslesmatchs-api printenv OPENROUTER_FALLBACK_DAILY_CAP
```

### Problème n°2 — jamais formulé

Greg a annonce avoir "plusieurs problèmes" et a voulu passer au n°2 apres
le n°1 (repli OpenRouter), mais la conversation a devie sur la boucle de
verification ci-dessus avant qu'il ne dise en quoi consiste le problème
n°2. **Il faut le lui redemander explicitement** — ne pas supposer lequel
des sujets en attente (voir "Prochaines étapes possibles" ci-dessus) il
avait en tete.

### Note de méthode sur les échanges avec Greg (VPS)

Greg colle souvent de larges blocs de scrollback de terminal, parfois
tronques avant que le resultat d'une commande ne s'affiche, et a deja copie
par erreur du texte de reponse de Claude (pas seulement des commandes) dans
son terminal — ce qui a produit des erreurs `command not found` sans
consequence sur les donnees, mais qui a fait perdre du temps. Pour toute
commande de verification critique, prevoir un format qui ne peut jamais
rester silencieux (toujours au moins un `echo` de secours), et si une
sortie vide revient deux fois de suite sur une commande qui doit forcement
produire un resultat, ne pas insister avec une 3e variante de commande —
changer de methode (capture d'ecran, confirmation orale) tout de suite.


---

## REGLES IMPERATIVES pour toute IA qui reprend (GPT, Codex, ou nouveau Claude)

Avant toute action, lire `CLAUDE.md` a la racine du depot — ces regles ne
sont pas optionnelles et s'appliquent a toi aussi, pas seulement a Claude :

1. **Ne jamais pousser ni deployer sans validation explicite de Greg dans
   le message en cours.** Une validation passee sur un autre sujet ne vaut
   pas pour un nouveau.
2. **Ne jamais toucher `public/index.html` sans validation Greg + GPT +
   Codex** (les trois, pas un accord bilateral).
3. **Toute modification de `scripts/api_server.js`, `public/`,
   `docker-compose.yml` se prepare en commit/branche ISOLEE**, un seul sujet
   par branche — ne jamais empiler plusieurs correctifs independants sur
   une meme branche (ca a deja fait echouer une revue le 08/08/2026).
4. **Partir de `origin/design-wow-complet`** (production) pour toute
   nouvelle branche isolee — jamais d'une branche de travail anterieure,
   qui peut avoir derive.
5. **Jamais d'ecriture sur la base de production** hors du pipeline normal
   de l'application — tout diagnostic se fait avec `{readonly:true}`.
6. **Ne pas nettoyer l'historique** (donnees, sig_sent_*, etc.) sans accord
   explicite de Greg, meme si une anomalie est visible.
7. **Mettre a jour `docs/business/NOTE-SITE.md`** (meme depot, branche
   `docs/note-site-20-criteres`) a chaque fois qu'un item change de statut —
   Greg s'en sert comme tableau de bord unique, ne pas creer un doublon
   ailleurs.
8. **En cas de doute sur l'intention de Greg** (messages parfois dictes,
   fautes de frappe frequentes) : demander plutot que de deviner et agir.

Objectif de ces regles : que Greg puisse alterner entre plusieurs IA sans
jamais avoir a verifier apres coup qu'aucune n'a ecrase le travail d'une
autre.


---

## MISE A JOUR — 25/08/2026, solde OpenRouter reconstitue

**Ce fichier a ete lu par GPT le 25/08 avec le solde du 24/08 (2,91 $), qui
est PERIME.** Etat reel au 25/08 :

- Solde OpenRouter : **12,91 $** (rechargement de 10 $ confirme par Greg
  directement sur openrouter.ai). Item 2 de `docs/business/NOTE-SITE.md`
  (branche `docs/note-site-20-criteres`) passe au vert.
- Auto top-up : **deja desactive**, aucune action a faire dessus (ni a
  activer, ni a "redesactiver" — il ne l'a jamais ete).
- Le plafond de repli (`OPENROUTER_FALLBACK_DAILY_CAP`) reste vise a **20**,
  mais **toujours pas confirme techniquement** dans le conteneur — c'est le
  seul point encore ouvert sur ce sujet. La verification par photo demandee
  a Greg est la bonne methode, aucun changement a y apporter.
- **Reflexe pour toute IA a partir de maintenant** : `docs/business/NOTE-SITE.md`
  (branche `docs/note-site-20-criteres`) est la source de verite pour l'etat
  courant (solde, statuts). Ce fichier de handoff reste la source pour le
  RECIT de ce qui s'est passe et pourquoi — mais pas pour les chiffres
  vivants, qui bougent plus vite que ce document n'est relu.
