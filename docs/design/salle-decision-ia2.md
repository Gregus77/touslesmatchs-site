# Salle de Décision IA 2.0

Direction validée par Greg le 7 octobre 2026. Corriger les deux failles élevées, puis refondre le site et l’application.

Une salle de décision sportive : cinq analyses indépendantes, un signal lisible et un historique vérifiable. Le cercle à cinq points explique la méthode sans simuler un vote réel. Site orienté conversion, app actuelle Goal +0,5 et quatre onglets conservés.

Tokens : graphite #080B12, panneau #101622, structure #263246, ivoire #F2F5F7, or #F4B860, turquoise #69D9D1, perte #F07C78. Segoe UI/Arial système; titres 36–68 px, texte 16–18 px, chiffres tabulaires. Textes alignés à gauche, lignes courtes. Un geste graphique fort : Cercle de Consensus.

Site : navigation → promesse/cercle → données réelles → historique → offres → méthode/FAQ. App : sélection Goal +0,5 → direct → résultats → compte.

Contraintes : préserver scripts, IDs, API, paiements, filtres et liens; modifications ciblées d’index; CSS partagé chargé en dernier; sections masquées maintenues; tarifs actuels inchangés; aucun faux résultat/cote/vote; mobile 360 px, clavier, reduced motion et safe areas.

Exécution : tests de sécurité avant fix, revue indépendante, nouveau hero HTML avec un H1, métadonnées/traductions cohérentes, style site/app, tests existants et navigateur, captures, docs et commits ciblés. Pas de déploiement VPS avant validation du résultat.

Décisions : checkout original conservé; branche codex/salle-decision-ia2 isolée dans Temp car Documents refuse l’écriture. App dédiée Goal +0,5 selon les tests actuels; site multisport existant. Direction et ordre déjà validés : exécution native continue.

## Réalisé et vérifié localement

Accueil en vrai HTML, un H1, cercle illustratif sans faux vote, deux actions principales et lien APK. Titre traduit dans les six langues existantes. Nouvelle couche graphique partagée sur accueil, application, Live IA, résultats, espace membre, bankroll et FAQ. Les offres, prix et endpoints de paiement n’ont pas été changés. Les améliorations non commitées déjà présentes dans l’accueil d’origine sont reprises, sans modifier cette copie.

Vérification Chrome en mode sans interface : 1440, 390 et 360 px, sept surfaces, navigation des quatre onglets app, visibilité des sections, débordements, titre, liens APK, langue française/anglaise, focus clavier et absence d’erreur JavaScript. API remplacées par des fixtures vides : validation du frontend, pas des données en production. Captures dans work/screenshots (non commitées).

Deux erreurs antérieures de navigateur corrigées : Live cherchait un indicateur de chargement déjà supprimé par le rendu; l’espace membre écoutait un ancien champ auth-pass absent, alors que auth-code/email avaient déjà leurs écouteurs.

Huit tests de parcours existants passent, ainsi que les sept tests de sécurité et la syntaxe des scripts des sept pages. `test_goal05_site_rules.js` échoue aussi dans la copie d’origine : minimum 1.60 absent du document sportif attendu. Cette incohérence de règles ne fait pas partie de la refonte et n’a pas été modifiée pour faire passer le test.

Pour voir la version locale : `python scripts/preview_decision_design.py`, puis http://127.0.0.1:8767. Cet aperçu désactive les API, les requêtes externes, formulaires et paiements; les états vides sont normaux. Pour les tests visuels, installer Playwright Python, disposer de Chrome, lancer un serveur public puis `python scripts/test_decision_design.py` (TLM_PREVIEW_URL et TLM_SCREENSHOT_DIR configurables).

La publication nécessite validation de ce rendu, préflight du chemin servi/VPS et vérification réelle des comptes/paiements. L’APK distribué n’est pas recompilé : il charge la page app distante; contrôler ses règles de cache avant de déclarer la nouvelle version effective sur Android.
