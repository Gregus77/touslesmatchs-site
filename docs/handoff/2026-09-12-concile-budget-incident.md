# Concile — reprise OpenRouter du 12 septembre 2026

Autorisation propriétaire : plafond global OpenRouter de 4 EUR du lundi au vendredi, 6 EUR samedi/dimanche, journées civiles Europe/Paris. Aucun objectif de consommation. Aucun changement des cinq sièges, modèles ou règles sportives. PR 109 exclue de ce chantier.

## Diagnostic et politique

L'audit du conteneur a confirmé une limite de clé de 6 USD, réinitialisation quotidienne fournisseur, consommation 2,027273347 USD et solde compte 9,181147914 USD au contrôle. L'API de clé renvoie un libellé masqué, pas le nom « hermes4 » : ce nom n'est pas prouvé. API et council utilisent la même clé. Le runtime avait déjà un budget local de 4 EUR et un sous-plafond Concile de 3 EUR, plus une exclusion OpenRouter après le 403 quotidien. Les autres erreurs fournisseur restent distinctes et ne justifient aucune substitution de modèle.

Les chemins OpenRouter partagent désormais un registre SQLite avec réservation atomique avant l'appel et coût `usage.cost` USD après réponse. Une réponse sans coût ou un délai dépassé conserve sa réservation. Les anciennes estimations ne sont jamais effacées et constituent un plancher conservateur. Le plancher initial doit intégrer la consommation fournisseur connue et les estimations existantes avant toute reprise.

Le taux comptable de sécurité vaut 1 USD par EUR : il s'agit d'une provision conservatrice, pas d'un taux de change facturé. Le cours ECB consulté au 11 septembre était de 1,1592 USD par EUR. La limite fournisseur de 6 USD reste une protection indépendante, avec son calendrier UTC. Aucun réglage financier fournisseur n'est modifié.

Le fichier `/data/openrouter-background-paused` suspend les essais payants et les appels Python de fond pendant l'incident. Les appels Python et le worker shadow passent par la passerelle API authentifiée et budgétée. Ne supprimer ce fichier qu'après décision explicite de reprise du travail de fond. L'observation sans appel payant reste possible.

## Validation et déploiement

Tests sur SQLite réelle, réseau coupé : jours ouvrés/week-end, frontières Paris et journées DST 23/25 heures, réservations successives et transaction immédiate, conservation des dépenses, refus de dépassement, catalogue simulé, coût confirmé, HTTP 403, timeout et coût absent. Suite historique budget et régressions filtrage/quorum/cotes/votes exécutées dans l'image API existante. Syntaxes JS/Python et diff contrôlés. Démarrage HTTP isolé confirmé.

Sauvegarde SQLite en ligne et fichiers avant changement dans `backups/concile-budget-20260912T194128Z`. Le déploiement doit comparer les sources courantes avec leur sauvegarde, préserver les variables runtime et ne remplacer que les fichiers concernés. Le council existant peut recevoir les deux modules et être redémarré sans reconstruction des dépendances. Conserver les images/fichiers précédents pour restauration ciblée ; ne jamais restaurer une ancienne base sur des dépenses nouvellement enregistrées.

Après un vrai appel fournisseur exploitable et enregistré, expirer uniquement l'exclusion temporaire OpenRouter, conserver la trace de l'ancien état et vérifier des votes naturels persistés puis exposés par l'API. Aucun message client de test. La preuve HTTP technique seule ne vaut pas preuve de vote.
