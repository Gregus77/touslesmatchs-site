# Corrections des deux failles élevées — 7 octobre 2026

Périmètre : branche `codex/salle-decision-ia2`, base `6f8e214`. Aucun déploiement, aucune modification de données, secrets, prix ou paiement réel.

## Accès administrateur

`isAdminAccess` exige désormais `isAdmin`. Le préfixe ELITE-ADMIN seul ne suffit plus : le couple email/code doit être valide en base, actif et non expiré. Les entrées non textuelles sont refusées. Tous les appels existants du helper utilisent cette frontière commune.

## Ancienne route d’analyse

`POST /analyse` délègue au même gestionnaire que `/concile-analysis` : connexion, abonnement payant et crédits disponibles avant tout appel au moteur. Match vérifié, conflit de score, exclusions de compétitions, cache partagé et débit des crédits sont conservés. La limite historique de trois requêtes par minute reste appliquée. Entrée plate home/away/match_id et forme de réponse legacy conservées.

## Preuves locales

Les tests ont d’abord reproduit les vulnérabilités (4 échecs sur 7), puis les 7 tests passent après correction. Ils exécutent les vrais helpers et gestionnaires extraits du serveur, dans un environnement isolé avec base et moteur simulés. Ils couvrent préfixe forgé, mauvais email, inactivité, expiration, compte légitime, accès anonyme/gratuit/épuisé, analyse payante, cache, crédits, exclusions et erreurs. La relecture indépendante du correctif n’a plus de blocage après rétablissement des champs legacy et vérification de l’entrée plate.

Commandes : `node --test scripts/test_security_access.js` et `node --check scripts/api_server.js`.

Limites : ni base réelle ni fournisseur IA ni API déployée testés. Les autres constats de l’audit restent hors de ces deux corrections. La réponse legacy conserve des pourcentages statiques historiques pour compatibilité : ils ne constituent pas une nouvelle preuve sportive et devront faire l’objet d’un chantier distinct. Le client React legacy transmet désormais les identifiants déjà enregistrés par l’espace membre, et invite à se connecter s’ils sont absents; son build complet n’a pas été testé, faute de dépendances CRA dans cet environnement.

## Publication et retour arrière

Avant déploiement : confirmer le chemin réellement servi et le processus API, sauvegarder code et base, conserver l’ancien commit, vérifier les comptes légitimes et une tentative refusée sur l’API cible. Retour : rétablir l’ancien déploiement après analyse du risque ; ne pas réouvrir durablement les deux accès vulnérables. L’ancienne interface React qui appelait /analyse sans identifiants doit désormais fournir un compte payant valide : l’accès gratuit anonyme n’est pas maintenu.
