# Commandes de verification — TousLesMatchs

Ce fichier n'est charge que quand le skill `commissaire` en a besoin — pas a
chaque declenchement. Copie-colle directement, adapte le filtre WHERE selon
ce qui est en cause. Toutes les commandes supposent une connexion au VPS
(`ssh`) et se lancent depuis `/opt/touslesmatchs`.

## 1. Sante infra (4 services)

```bash
docker compose ps
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/current-pick
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/live-matches
```
Attendu : les 4 services (`site`, `api`, `council`, `hermes-admin`) "running", codes HTTP 200.

## 2. Un fichier public a-t-il vraiment le changement attendu ?

```bash
docker exec touslesmatchs-site grep -c "TEXTE_OU_FONCTION_ATTENDU" /srv/NOM_FICHIER.html
```
Un chiffre >0 confirme que le fichier REELLEMENT SERVI contient le changement — pas juste le depot git.

## 3. Une analyse/pick precis — pourquoi bloque ou diffuse ?

```bash
docker exec touslesmatchs-api node -e "
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH || '/data/tlm.db', { readonly: true });
const rows = db.prepare(\"SELECT home, away, confidence, best_bet, real_odd, real_odd_source, diffusion_block, consensus_votes, analysed_at FROM concile_analyses WHERE (home LIKE '%NOM_EQUIPE%' OR away LIKE '%NOM_EQUIPE%') ORDER BY analysed_at DESC LIMIT 5\").all();
console.log(JSON.stringify(rows, null, 2));
"
```
`diffusion_block` = null → le signal est reellement parti. Sinon le champ dit le motif exact (jamais deviner).

## 4. Sante du Concile IA (les 5 agents votent-ils vraiment ?)

Symptome typique : `confidence` bloque a 55 et `consensus_votes` a 0-2 sur presque
toutes les analyses recentes (requete #3 ci-dessus) → les agents ne repondent
pas, ce n'est pas un probleme de seuil. Verifier la vraie cause avant de
toucher a un seuil de confiance :

```bash
docker logs touslesmatchs-api --since 2h 2>&1 | grep "aucun vote exploitable"
```

Depuis le 04/08/2026 ce message inclut la vraie cause (timeout reel, HTTP
401/429/5xx avec le corps de la reponse, ou reponse illisible) — ne pas se
contenter de l'ancien message generique si un vieux build tourne encore.
Si le motif est HTTP 401/403 → cle API expiree/revoquee pour ce fournisseur.
Si HTTP 429 → quota/rate-limit atteint. Si timeout repete sur UN SEUL agent
(souvent Perplexity, qui fait une recherche web) → `AGENT_TIMEOUT_MS` peut-etre
encore trop court pour lui specifiquement.

## 5. Conformite ANJ (contenu public)

```bash
grep -in "pari\b\|parier\|parieur" public/*.html | grep -vi "comparateur\|appareil\|disparait\|paritaire"
grep -L "joueurs-info-service" public/index.html public/live-ia.html public/performances.html
```
Premiere commande : doit ne rien remonter en dehors des CGU/mentions legales.
Deuxieme : ne doit lister AUCUN fichier (sinon le disclaimer manque sur cette page).

## 6. Ligues respectees (pas de ligue douteuse affichee)

Verifier a la main que la ligue du match concerne apparait dans
`TRUSTED_COMPETITIONS` (`scripts/api_server.js`) et ne matche AUCUNE entree de
`LOW_TRUST_COMPETITION_KEYWORDS` juste au-dessus dans le meme fichier — rappel :
LOW_TRUST est verifie en premier et gagne toujours, meme si l'entree existe
aussi dans TRUSTED (deja arrive une fois avec "australia cup").

## 7. Coherence des chiffres entre sections

Comparer manuellement : le total affiche en haut d'une page (ex. "X analyses")
doit correspondre au nombre d'elements listes en dessous. Le chiffre envoye
sur Telegram pour un match donne doit correspondre a celui affiche sur le
site pour ce meme match (meme cote, meme confiance).
