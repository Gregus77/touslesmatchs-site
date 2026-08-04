---
name: commissaire
description: >
  Controle qualite obligatoire pour le projet TousLesMatchs (site de pronostics
  sportifs IA). Utilise ce skill CHAQUE FOIS que tu es sur le point de dire a
  Gregory (le fondateur) qu'un correctif est "fait", "corrige", "pousse",
  "deploye", ou que des statistiques/picks/cotes affiches sur le site ou
  envoyes sur Telegram sont fiables et exacts. S'applique aussi des qu'on
  discute du nombre de matchs, du winrate, des ligues autorisees, ou du
  Concile IA (les 5 agents qui votent) — notamment quand la confiance/les
  votes restent bloques anormalement bas. Le but : ne jamais affirmer qu'un
  resultat est correct sans l'avoir verifie sur les vraies donnees (base
  sqlite, endpoint reel, fichier reellement deploye, logs reels) — une
  relecture du code ne suffit jamais a elle seule.
---

# Commissaire — controle qualite TousLesMatchs

## Pourquoi ce skill existe

Gregory ne peut pas verifier le code lui-meme. Il fait confiance a ce qui est
annonce comme "fait". Si une affirmation se revele fausse une fois testee sur
le vrai site, ce n'est pas juste un bug — c'est de la confiance perdue sur un
produit qui vend de la fiabilite. Ce skill comble l'ecart entre "le code
semble correct" et "le resultat reel est correct" : deux choses different
souvent, a cause d'un cache, d'un filtre en amont, d'un deploiement manquant,
d'une hypothese qui ne tenait pas, ou d'un agent IA qui echoue en silence.

## La regle de fond

**Une preuve concrete n'est jamais "j'ai modifie la ligne X".**
C'est la sortie reelle de quelque chose qui existe deja avant que tu ne
l'affirmes : le resultat d'une vraie requete sur la base sqlite, la reponse
reelle d'un endpoint, le message Telegram exact tel qu'il partirait, un
chiffre lu directement dans les logs. Relire le code et conclure "c'est bon"
ne suffit pas — un code qui semble juste peut produire un mauvais resultat
(cache non invalide, autre filtre en aval, deploiement pas encore fait,
fournisseur externe qui echoue silencieusement).

Distingue toujours **"poussé sur git"** de **"réellement en ligne"**. Gregory
travaille sur un VPS Hostinger separe de cette session — un `git push` ne
deploie rien tout seul. Ne dis jamais "c'est en ligne" sans qu'il ait confirme
avoir lance la commande de deploiement et que tu aies vu la preuve que ca a
marche.

## Avant de dire "c'est fait" ou "c'est corrige"

1. Identifie ce qui doit etre vrai, en termes mesurables (pas "les stats
   seront bonnes" mais "cette ligne doit avoir diffusion_block=null").
2. Verifie-le reellement — voir `references/checks.md` pour les commandes
   pretes a copier (infra, base de donnees, sante du Concile IA, conformite
   ANJ, ligues). Ne charge ce fichier que si une verification concrete est
   necessaire — pas systematiquement pour une reponse simple.
3. Verifie la coherence entre sources : le total affiche et la liste
   detaillee doivent correspondre ; le site et Telegram doivent raconter la
   meme histoire pour un meme match.
4. Si tu ne peux pas verifier (VPS inaccessible depuis cette session, action
   que seul Gregory peut executer) : dis-le explicitement et donne la
   commande exacte a lancer, plutot que de laisser croire que c'est confirme.

## Ne pas sur-verifier

Ce skill sert a eviter les fausses affirmations sur ce qui est reellement
corrige, deploye, ou fiable — pas a imposer une checklist geante sur chaque
message. Une question simple, une explication de code existant, ou une
reponse qui ne fait aucune promesse de resultat ("j'ai modifie X, il reste a
deployer et verifier Y") n'a pas besoin d'ouvrir `references/checks.md`.
Consulte-le quand tu es sur le point d'affirmer qu'un resultat REEL est
atteint, pas avant.

## Erreurs deja rencontrees sur ce projet (pour ne pas les refaire)

- **Filtre en sortie qui contredit l'entree** : un match accepte et analyse
  par l'auto-concile doit apparaitre dans les resultats affiches.
- **Cache qui masque un vrai changement** : verifier ce qui est REELLEMENT
  servi (fichier deploye, cache navigateur/serveur/panneau deja ouvert), pas
  seulement ce qui est dans le depot.
- **Deduplication trop agressive** : une cle de dedup trop large peut
  supprimer des lignes legitimes en plus des doublons.
- **Message d'erreur generique qui masque la vraie cause** : un `catch` qui
  resume tout ("timeout, reponse illisible, ou quota") empeche de savoir
  laquelle des causes est reelle — capturer et afficher la vraie cause plutot
  que de deviner (voir §4 de `references/checks.md` pour le cas du Concile IA).
- **Confiance/votes du Concile bloques bas** : ne pas conclure trop vite a un
  probleme de seuil ou de manque de donnees — verifier d'abord si les agents
  echouent techniquement (timeout, cle expiree, quota) via les logs reels.
- **Chiffres incoherents entre sections** ou entre le site et Telegram :
  toujours un signal qu'une des deux sources est fausse ou perimee.

## Format de reponse quand tu cloture un correctif

Termine par un controle court, pas un roman :

```
Verifie : [ce qui a ete controle et comment] → [resultat reel]
```
