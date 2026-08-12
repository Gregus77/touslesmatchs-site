# GOAL 0.5 IA — audit d'intégration du cahier validé

> Source complète conservée sans retrait : [cahier source](2026-08-12-cahier-goal-05-ia-source.md).
>
> Progression globale : `█████░░░░░░░░░░░░░░` **25/100**. Cette valeur mesure la réalisation vérifiée, pas les maquettes ou les promesses.

## Légende

- ✅ Déjà présent ou documenté dans le dépôt local.
- 🟡 Présent partiellement, générique ou non vérifié en production.
- ⏳ À construire ou à vérifier sur données réelles.
- ⚠️ Contradiction ou choix explicite de Gregory requis avant d'appliquer.

## Principes désormais gelés pour Goal 0.5 IA

- ✅ Marché unique : **l'équipe sélectionnée marque plus de 0,5 but pendant le match**. Aucun 1X2, BTTS, total match, Over/Under global ni placement automatique.
- ✅ Seuil de cote minimal : **1,60**, jamais déclencheur unique ; la cote doit être fraîche, horodatée, confirmée et liée au marché exact.
- ✅ « Aucun signal » est un résultat normal : équipe marquant avant 1,60, cote non atteinte, marché indisponible, données manquantes ou conditions sportives dégradées sont journalisés séparément.
- ✅ Aucune promesse de gain, aucun enrichissement, aucune martingale, aucune pression à rejouer. Décision et saisie personnelle restent du ressort de l'utilisateur.
- ✅ Toute modification des règles importantes exige validation de Gregory, conservation de la version et trace d'audit.

## Audit section par section

### 1–2. Produit et cote

- ✅ Moteur séparé local `scripts/plus05_engine.js` : marché exact domicile/extérieur +0,5, cote minimale 1,60 et refus si le marché est absent.
- 🟡 Il ne surveille pas encore le match en direct ni la stabilité de la cote sur plusieurs secondes/deux sources.

### 3–4. Liste blanche et interdictions

- 🟡 La liste technique actuelle est trop large et utilise surtout des pays, pas la liste précise de divisions masculines adultes fournie.
- ⏳ À remplacer par une allowlist de compétitions et de saisons : France, Angleterre, Espagne, Allemagne, Italie, Pays-Bas, Belgique, Portugal, Écosse, Autriche, Suisse, Danemark, Norvège, Suède, Pologne, Tchéquie, Irlande, Argentine, Brésil, Japon, Corée, MLS et A-League, avec les deux divisions indiquées dans le cahier.
- ✅ Les amicaux, coupes, compétitions internationales, élimination directe, équipes nationales, féminines, jeunes et réserves devront être rejetés sans exception.
- ⚠️ Le cahier autorise MLS, Japon, Corée et Australie ; tes décisions initiales excluaient USA/Canada. Il exclut Grèce et Turquie, présentes dans une ancienne allowlist locale. Rien ne sera activé sur ces compétitions sans ton arbitrage explicite.
- ⏳ Brésil Série B et Argentine Primera Nacional : indicateur « surveillance renforcée » à ajouter, avec seuils plus stricts.

### 5. ANJ, marché et absence de pari automatique

- 🟡 L'API existante sait privilégier des bookmakers ANJ et enregistrer une cote réelle, mais ne mappe pas encore de manière prouvée le marché exact « équipe +0,5 » pour les signaux réels.
- ⏳ Vérification régulière de l'éligibilité de la compétition, du marché et des opérateurs utilisables par un client français ; synchronisation de la liste ANJ ; aucun signal commercial hors ANJ.
- ✅ Aucun bouton de pari automatique ne sera créé.

### 6–8. Historique, début de saison et écart de niveau

- 🟡 `api_server.js` contient déjà classement, statistiques d'équipe, blessures et contexte ; le moteur +0,5 ne consomme pas encore les cinq saisons complètes.
- ⏳ Stocker les cinq dernières saisons terminées : position normalisée en percentile, points, matchs, V/N/D, buts pour/contre, domicile/extérieur, fréquence de but, opposition, promotions/relégations et identité du club.
- ⏳ Pondération décroissante des cinq saisons, gestion des clubs promus/relégués, changements de division/nom/fusion et pénalité pour historique incomplet ; forme actuelle prioritaire après mercato/changement d'entraîneur.
- ⏳ Journées 1–5 : aucune alerte réelle ; 6–7 : simulation renforcée ; à partir de J8 : régime normal ; trois matchs de prudence après mercato hivernal ou bouleversement d'effectif.
- ⏳ Écart cible : premier quart contre dernier quart, avec règles adaptées au nombre de clubs (environ huit places pour 18–20 équipes, six pour 14–16, cinq pour 12), vérifié aussi par note historique.

### 9. Score explicable sur 100

- ⏳ Mettre en œuvre et versionner le score déterministe : historique 15, classement actuel 15, capacité récente à marquer 15, faiblesse adverse 15, titulaires offensifs 15, xG/tirs/occasions 10, domicile/extérieur 5, H2H pertinent 5, fatigue/moral/entraîneur/calendrier 5.
- ✅ Seuil gelé : **80/100** minimum. Les poids seront datés, expliqués et recalibrés seulement après tests, jamais silencieusement.

### 10–14. Preuves sportives, onze, enjeu et renseignements externes

- 🟡 Les règles de cours déjà synthétisées couvrent les cinq derniers matchs, les buts construits, les adversaires réellement vulnérables, l'équipe malade, le caractère et l'enjeu.
- ⏳ Ajouter les métriques complètes : xG, tirs, tirs cadrés, grosses occasions, surface, buts tardifs/seconde période, qualité des adversaires, capacité à revenir au score et spécificité domicile/extérieur.
- ⏳ Pour l'adversaire : clean sheets, xG/tirs/occasions concédés, fragilité tardive, gardien/défense absents, série, fatigue, pression, calendrier et changement de coach.
- ⏳ Avant match et live : composition officielle, buteur/meneur/tireur de CPA, blessures/suspensions, banc et changements. Rouge contre l'équipe suivie = blocage ; rouge adverse = nouvelle analyse ; plusieurs attaquants clés absents = rejet probable.
- ⏳ Module enjeu : titre, Europe, promotion, maintien, relégation, points, journées restantes, nul suffisant, rotations, calendrier et déclarations fiables.
- ⏳ Couche externe bornée à -10/+10 : sources officielles ou médias indépendants fiables seulement, URL/date/fiabilité/effet conservés ; rumeur et supporter = 0 ; elle ne peut jamais sauver un mauvais dossier statistique.

### 15–16. Validation en direct et minute

- ⏳ Surveillance live : score, minute, équipe encore sans but, onze/cartons, présence des attaquants, xG, tirs, tirs cadrés, grosses occasions, corners, attaques, possession utile, dernier tiers, rythme, pression, tactique, fatigue adverse et temps restant.
- ✅ Conditions de rejet gelées : marché suspendu/périmé, équipe inactive, sortie d'un joueur clé sans confirmation, rouge de l'équipe suivie.
- ⏳ Paliers live : avant 65' normal ; 65–75' activité offensive obligatoire ; 76–80' domination claire ; 81–85' situation exceptionnelle et pression très forte ; après 85' aucun nouveau signal, même avec temps additionnel.

### 17–20. Consensus, livraison et historique honnête

- 🟡 Le site possède des analyses et traces `sig_sent_*`, mais l'ancienne chaîne peut bloquer une livraison ; les historiques internes et les signaux réellement diffusés sont déjà partiellement distingués.
- ⏳ Goal 0.5 utilisera des règles déterministes prioritaires et un consensus pondéré non bloquant : historique, forme, attaque, défense, contexte, composition, live et cohérence de cote.
- ⏳ Architecture événementielle isolée : signal enregistré d'abord, événement de distribution persistant, identifiant unique, idempotence, retry, file d'erreurs, statut par canal, renvoi manuel et alerte admin si aucun canal n'accepte sous ~30 secondes. Hermès reste complémentaire, jamais point unique de panne.
- ⏳ Canaux : Push, Telegram, notification interne et e-mail de résumé ; consentement explicite, préférence utilisateur, désactivation à l'expiration et lien profond vers la fiche match.
- ✅ Bilan commercial : seulement les signaux effectivement délivrés. À séparer : simulations, présélections sans cote, équipes ayant marqué avant 1,60, validés non délivrés, rejets et erreurs de données.
- ⏳ Journal complet par signal et tableaux de résultats : identifiant, contexte, scores avant/live, cote/source, motifs, livraison, issue, version modèle/poids, rendement théorique, taille d'échantillon, ventilation ligue/équipe/minute/cote/domicile-score.

### 21–23. Simulation, valeur et API

- 🟡 Le mode shadow est amorcé pour le moteur +0,5 ; les tests unitaires existent, mais il n'y a pas de backtest minute par minute ni de couverture de marché démontrée.
- ⏳ Backtest sans fuite d'information, séparation entraînement/validation/test, comparaison des seuils, minutes, équipes, ligues, disponibilité offensive, rouges, domicile/extérieur et périodes de saison.
- ✅ À 1,60, la probabilité implicite brute de référence est 62,5 % ; une alerte exigera une probabilité calibrée supérieure avec marge d'incertitude, jamais une certitude.
- ⏳ Audit réel API-Sports/API-Football : marché team total over 0.5 live, fréquence, latence, bookmakers ANJ, ligues, historiques et quota. Aucun nouvel abonnement avant le tableau de couverture/coût/limites/conformité ; source principale et secours à décider après preuve.

### 24–25. Bankroll et progressions

- 🟡 Une base personnelle de bankroll existe dans le compte actuel ; elle n'est pas encore la page privée Goal 0.5 complète.
- ⏳ Limites de perte/semaine/exposition, historique personnel, drawdown, série et alertes ; isolation stricte des performances officielles.
- ✅ Pas de martingale, récupération de perte, mise automatique ni encouragement à rejouer. Une progression 3–4 étapes ne sera qu'un simulateur avec garde-fous et alerte d'exposition élevée (ex. 5 € sur 20 €).

### 26–30. Juridique, intégration, design, tunnel et marketing

- ✅ Positionnement prévu : analyse statistique/aide à la décision, +18, jeu responsable, notifications désactivables, résultats complets et aucune promesse de gain.
- ⚠️ La validation juridique reste obligatoire avant commercialisation ; les règles DGCCRF/ANJ/ARPP/RGPD, droit de la consommation et restrictions d'influence doivent être vérifiées avec un juriste. Le simple changement de vocabulaire ne suffit pas.
- 🟡 Bêta Cycle 01, site TousLesMatchs, comptes, Stripe/Telegram et design existent localement ; rien n'est validé en production.
- ⏳ Route cible `/goal-05`, moteur isolé, d'abord simulation puis preuve, commercialisation, PWA et seulement ensuite APK Android.
- ✅ Direction graphique : nuit/violet électrique/bleu/cyan, mobile prioritaire, premium, sans vert/jaune/doré dominant. La maquette existante doit être ajustée car elle utilise encore des accents verts/dorés.
- ⏳ Écrans : score/minute, jauge vers 1,60, consensus, score /100, radar, évolution de cote, timeline live, statuts, fiche de décision, historique et graphiques.
- ✅ Tunnel à expliquer sans promesse : détection, présélection, attente de 1,60, validation live, alerte éventuelle, décision utilisateur ; aucun volume garanti.
- ⏳ SEO informatif seulement, aucune publication automatique ni faux avis/résultats/partenaires/utilisateurs. Pages méthode, résultats vérifiés, limites, jeu responsable, FAQ, tarifs, légales et confidentialité.

### 31–35. Skills, données, admin et garde-fous

- ✅ Aucun nouveau skill ne sera créé sans « OUI » explicite de Gregory ; les rôles proposés (Guardian, historique, live, conformité, conversion, SEO) seront d'abord comparés à TLM Premium Guardian et TLM Skill Architect.
- ⏳ Qualité des données : données manquantes/doublons/mapping équipes-compétitions, cotes périmées, UTC puis fuseau utilisateur, versionnage, sauvegardes, monitoring, quotas, coûts, tests et absence absolue de valeur inventée.
- ⏳ Admin : matchs/rejets/motifs/présélections/cotes/livraisons/erreurs/quotas/coûts/services/retry/ligues surveillées/version, avec arrêt de ligue, pause globale, renvoi, shadow et preuve de décision sans réécrire les statistiques.
- ⏳ KPI : détection, analyse, présélection, atteinte 1,60, validation, livraison, échec technique, réussite, rendement, latence, API, coûts, calibres et résultats par segment ; les gagnants non livrés restent séparés du bilan commercial.
- ✅ Non négociables intégrés au registre : pas d'automatisation de pari, allowlist, ANJ, 1,60, 80/100, fin à 85', rouge bloquant, attaque absente rejetable, saison protégée, historique pondéré, transparence/livraison/versionnement/audit.

## Causes déjà identifiées des signaux non envoyés

- ✅ Le système existant pouvait produire une analyse mais la bloquer par seuil de confiance, cote réelle indisponible/hors fenêtre, périmètre ANJ, plafond de palier ou échec Telegram.
- ✅ L'ancienne chaîne d'intermédiaires rendait la livraison dépendante de composants multiples ; elle explique pourquoi un match interne favorable ne doit jamais être présenté comme un signal client.

## Architecture cible proposée

`collecte API -> préfiltre allowlist/ANJ -> score pré-match >=80 -> surveillance live -> garde-fous cote >=1,60 -> signal immuable en base -> file de distribution -> Push/Telegram/app -> accusé/retry/admin -> résultat et statistiques séparées`

Les IA peuvent enrichir l'analyse, mais aucun modèle conversationnel ni Hermès ne sera sur le chemin bloquant qui empêche l'enregistrement ou la distribution d'un signal validé.

## Décisions nécessaires avant toute modification fonctionnelle

1. ⚠️ Confirmer la liste blanche finale : MLS/Japon/Corée/Australie sont-ils maintenant autorisés malgré les exclusions initiales USA/Canada ?
2. ⚠️ Confirmer que Grèce et Turquie restent exclues définitivement.
3. ⚠️ Choisir si la Colombie reste hors production ou en surveillance expérimentale.
4. ⚠️ Autoriser l'audit lecture seule de la couverture exacte API-Sports pour les cotes live « équipe +0,5 » ; sans cette preuve, aucun fournisseur supplémentaire ne sera choisi.

## Prochaine étape sûre

✅ **Audit lecture seule de la couverture API et du chemin réel de livraison** : compétition par compétition et marché par marché, sans modifier le site, l'API, Stripe, Telegram, la base VPS ni les abonnements.
