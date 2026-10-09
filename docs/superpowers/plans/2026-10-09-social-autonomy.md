# Publication serveur — plan et contrat de mission

Périmètre autorisé : composants testables dans ce worktree, aucune installation ni diffusion.
Architecture : export factuel depuis le scanner existant et ses résultats fournisseur ; worker Python autonome avec SQLite distincte, transports injectables et rendu déterministe FR/EN sur fond OpenAI commun. Le registre Goal05 reste seul habilité à attester un signal ; aucune écriture dans ses KPI.

- [x] Tests hors réseau : typage strict, échéance pré-match, paires, observations positives/négatives, preuves et idempotence concurrente, timeouts, budget et coupe-circuit.
- [x] Export canonique atomique sans nouvel appel sportif ni ordonnanceur métier ; collecte existante conservée.
- [x] Worker : source → contenus → image → destinations indépendantes → site atomique. Images API plafonnées ; statut incertain sans renvoi automatique.
- [x] Migration des reçus du 9 octobre, configuration publique, service/timer Paris et rollback documentés.
- [x] Vérification locale HTTP et quatre suites produit obligatoires ; checkpoint explicite des accès et preuves manquants.

Risques à vérifier : fraîcheur après génération lente ; crash après POST ; résultat sans décision ; secret dans erreur HTTP ; destination modifiée ; ancienne promotion scanner encore active dans moteur préexistant. Pas de modification sportive ou de quotas.

Les coches attestent la préparation locale. Limites de couverture : docs/social/acceptance.md. Activation et preuves réelles non exécutées.
