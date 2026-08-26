# TousLesMatchs — Centrale de diffusion sociale

Date : 26 août 2026
Statut : préparée dans `tlm-consolidation-2026-08-26`, non déployée.

## Objectif

À partir d'un signal réellement diffusé par TousLesMatchs :

1. produire automatiquement un visuel 1080×1350 (feed) et 1080×1920 (story/vertical),
2. compléter le message Telegram gratuit avec ce visuel,
3. publier sur Instagram uniquement quand l'autorisation Meta nécessaire est confirmée,
4. préparer automatiquement le contenu TikTok dans une file d'attente conforme,
5. quand le match est terminé, produire un second visuel avec `GAGNÉ` ou `PERDU`, score final, équipes, compétition, date/heure et sélection,
6. republier le résultat selon les mêmes règles,
7. ne jamais publier automatiquement une simple analyse Hermès Admin non diffusée aux clients.

## Source de vérité

Le worker lit `/data/tlm.db`, table `concile_analyses`.

Par défaut `SOCIAL_SIGNAL_SOURCE=free` : seules les analyses réellement marquées `sig_sent_free=1` peuvent devenir du contenu social. Cela évite de transformer une analyse interne ou un signal réservé à Hermès Admin en publication publique.

Valeurs possibles :

- `free` : uniquement le signal vitrine quotidien ; recommandé pour le lancement,
- `standard` : signaux réellement envoyés au palier Standard,
- `premium` : signaux réellement envoyés au palier Premium,
- `any` : tous les signaux réellement diffusés sur Free, Standard ou Premium. À éviter au lancement pour ne pas spammer les réseaux.

## Déduplication

Chaque événement est haché avec `stage + match_key`.

Deux étapes distinctes :

- `signal` : lorsque le signal est diffusé,
- `result` : lorsque `outcome=win/loss` ET le score final existe.

L'état est stocké dans `/data/social-dispatch-state.json`. Un redémarrage du conteneur ne republie donc pas les mêmes contenus.

## Telegram

Automatisation autorisée via le Bot API officiel.

Le worker peut envoyer automatiquement la carte image sur `TELEGRAM_CHANNEL_ID` après le message texte déjà produit par l'API TousLesMatchs.

Variable :

`SOCIAL_TELEGRAM_IMAGE_ENABLED=true`

Pour éviter le doublon texte + image pendant une phase de test : mettre `false`.

## Instagram

Le code contient le connecteur Graph API, mais il est volontairement verrouillé par deux interrupteurs :

- `SOCIAL_INSTAGRAM_ENABLED=true`
- `META_GAMBLING_WRITTEN_PERMISSION=true`

Le deuxième ne doit être mis à `true` qu'après obtention effective de l'autorisation écrite de Meta requise pour un compte promouvant des activités liées aux jeux d'argent.

Autres variables :

- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `INSTAGRAM_ACCESS_TOKEN`

Ne jamais committer ces valeurs dans Git.

Le contenu généré reste factuel : équipes, compétition, accord IA, résultat vérifié. Aucun “gain garanti”, aucune promesse de rendement.

## TikTok

Le worker génère automatiquement :

- l'image verticale,
- la légende,
- toutes les données du match,
- un fichier JSON dans `/data/social-outbox`.

Statut utilisé : `ready_for_manual_or_approved_publisher`.

Il n'y a volontairement aucun bot interne qui clique/publie en silence sur TikTok. Le flux doit ensuite passer soit par une validation humaine, soit par un outil/API de publication approuvé conforme aux règles TikTok.

Les légendes TikTok sont orientées analyse sportive et résultat vérifié, sans CTA direct vers un bookmaker ou une incitation explicite à miser.

## Snapchat

Non utilisé.

## Fichiers

- `scripts/social_card_renderer.js` : rendu des cartes image,
- `scripts/social_dispatcher.js` : adaptateurs Telegram / Instagram / TikTok,
- `scripts/social_worker.js` : surveillance DB et déclenchement,
- `Dockerfile.social` : conteneur isolé,
- `docker-compose.social.yml` : service additionnel, séparé du compose de production.

## Données affichées sur les visuels

Signal :

- TousLesMatchs / Concile IA,
- nom des deux équipes,
- championnat,
- pays si disponible,
- date/heure si disponible,
- nombre de votes IA,
- confiance,
- mention que la sélection exacte est réservée aux membres,
- 18+ / jeu responsable.

Résultat :

- GAGNÉ / PERDU,
- équipes,
- score final,
- championnat,
- pays si disponible,
- date/heure,
- sélection qui avait été diffusée,
- lien vers les performances publiques.

## Installation — NE PAS lancer tant que la branche n'est pas validée

Créer le répertoire public :

```bash
mkdir -p /opt/touslesmatchs/public/social-media
```

Construire uniquement le worker :

```bash
cd /opt/touslesmatchs
docker compose -f docker-compose.yml -f docker-compose.social.yml build social-worker
```

Test recommandé :

```bash
SOCIAL_INSTAGRAM_ENABLED=false \
SOCIAL_TELEGRAM_IMAGE_ENABLED=false \
docker compose -f docker-compose.yml -f docker-compose.social.yml run --rm social-worker node -e "require('./social_worker').scanOnce().then(console.log)"
```

Aucun réseau social ne doit être activé pendant ce test.

## Variables à ajouter plus tard au `.env`

```dotenv
SOCIAL_POLL_MS=60000
SOCIAL_LOOKBACK_HOURS=72
SOCIAL_SIGNAL_SOURCE=free
SOCIAL_TELEGRAM_IMAGE_ENABLED=true
SOCIAL_TIMEZONE=Europe/Paris

# Instagram : garder false jusqu'à autorisation Meta
SOCIAL_INSTAGRAM_ENABLED=false
META_GAMBLING_WRITTEN_PERMISSION=false
INSTAGRAM_BUSINESS_ACCOUNT_ID=
INSTAGRAM_ACCESS_TOKEN=
```

## Règle permanente

Hermès Admin reste un canal de direction. Il peut recevoir toutes les analyses, ventes, incidents et rapports. La centrale sociale ne doit jamais considérer `TELEGRAM_ADMIN_CHAT_ID` comme une autorisation de publication publique.

Le contenu social doit provenir d'un signal réellement diffusé aux clients, jamais d'une simple recommandation interne.
