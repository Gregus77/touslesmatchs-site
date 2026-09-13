# Votes historiques — correction ciblée

Base de travail : main 51fb203, PR 112/113 préservées. PR 117 et chantier quota laissés intacts dans leur worktree.

Défaut reproduit sur l’API publique avec session Premium persistée valide : Chapecoense–Internacional, 12 septembre 2026, snapshot `1492373_2026-09-12_30_0-1`, votes O/O/O/sans réponse/O, 33 minutes, score de calcul 0-1, final 1-2. Les réponses gratuites et Premium contenaient le résultat mais aucun `ou25`.

La route historique transmet désormais un seul snapshot exact et valide la session avec le contrôle serveur existant. Aucun vote n’est dérivé du consensus. L’absence de snapshot exact reste cinq sièges sans preuve disponible. Les ronds existants sont réutilisés dans les historiques du site et de l’application. Le cache PWA ne stocke pas cette route, évitant de partager une réponse Premium avec une session gratuite.

Liens : `/?day=2026-09-12#history` et `/app.html?tab=perf`.

Sauvegarde SQLite par API backup, contrôle integrity_check OK : `/opt/touslesmatchs/backups/history-vote-circles-20260913/`. Copies des quatre fichiers déployables dans le même dossier.

Tests : test_history_vote_circles, test_app_live_vote_visibility_20260912, test_homepage_consensus_20260905, test_homepage_analysis_gate, test_mobile_responsive_parity, test_beta_retirement_and_free_funnel, syntaxe de tous les scripts inline. Les assertions de version du cache suivent v22.

Limite préexistante démontrée : test_official_signal_snapshots_20260912 échoue ligne 14 sur main et sur ce correctif au 13 septembre. Son scénario daté du 12 dépend de la date courante ; il passe avec une horloge isolée fixée au 12 septembre. Aucun changement du test ou du moteur pour masquer ce défaut.

Aucun appel fournisseur, aucune nouvelle analyse IA, aucun envoi Telegram pendant la vérification. La validation visuelle depuis le navigateur du propriétaire reste requise ; ne pas relancer Chromium Snap bloqué.

## Complément demandé : connexion email et parité accueil / Live IA

Le compte actif à 999 analyses possède déjà un droit payant et une session OTP valide. Aucun droit n'est créé ou modifié en base. Le bandeau et l'application privilégiaient un ancien `tlm_token` sur `tlm_session_token`; Live IA ne transmettait pas le jeton OTP. Tous ces lecteurs prennent maintenant le jeton OTP récent. Le bandeau lit `/auth/access`, contrôle serveur sans chargement sportif. Compte publie le changement de connexion et efface les anciens jetons à la déconnexion.

L'accueil filtrait sur l'admissibilité d'analyse, ce qui masquait un match du bon championnat avant tout scrutin ou avec minute inconnue. Le champ séparé `client_display_eligible` autorise son affichage, sans modifier l'admissibilité sportive des analyses. Les scores football-data sont explicitement signalés comme potentiellement retardés, et les caches anciens comme dernières données connues. `cache_only=1` permet la comparaison des deux API depuis le cache existant sans aucun appel fournisseur ou IA.

Test supplémentaire : propriétaire actif déverrouillé, comptes gratuits/expirés et jetons falsifiés verrouillés, priorité du nouveau jeton OTP, syntaxe Compte/Live IA et séparation affichage/critères sportifs.
