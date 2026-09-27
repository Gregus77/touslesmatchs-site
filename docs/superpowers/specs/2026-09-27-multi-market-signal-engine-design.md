# Conception du moteur de signaux multi-marchés

Date : 27 septembre 2026  
Statut : spécification proposée pour revue, sans autorisation d’implémentation  
Périmètre : moteur de sélection, registre officiel, diffusion site/app/Telegram, Shadow et observabilité

## 1. Objectif et contraintes

L’objectif produit est d’atteindre en moyenne 3 à 4 signaux qualifiés par jour, sans fabriquer un quota et sans abaisser artificiellement la qualité. Une journée à zéro signal reste correcte lorsque les données, les cotes, la value ou le consensus ne satisfont pas les règles. Le système doit conserver l’historique complet des analyses acceptées, rejetées, en attente et réglées.

Cette conception ne modifie aucun seuil en production. Elle préserve Jev, Kimi, le roster des cinq IA, les whitelists de compétitions, les règles de confiance existantes, les protections de première mi-temps et les preuves de diffusion. Les valeurs proposées pour les futurs marchés restent versionnées et doivent sortir de Shadow avant activation.

## 2. Arbitrage A/B/C

### A — Baisser les seuils existants : rejeté comme stratégie principale

Avantage : hausse rapide du volume O/U 2,5.  
Risques : dégradation directe de la calibration, augmentation des faux positifs et dilution de la promesse Premium. Cette option confond capacité de production et qualité du signal. Elle n’est acceptable que comme expérience Shadow isolée, jamais comme mécanisme de volume en production.

### B — Étendre uniquement O/U 2,5 à davantage de ligues : insuffisant

Avantage : réutilisation presque complète du moteur actuel.  
Limites : dépendance persistante à un seul marché, disponibilité irrégulière des cotes, corrélation forte entre les candidats et extension vers des compétitions moins fiables. La whitelist et les preuves de données doivent rester intactes ; l’élargissement seul ne garantit donc pas 3 à 4 signaux qualifiés par jour.

### C — Portefeuille multi-marchés contrôlé : retenu

Chaque marché devient un module indépendant produisant un candidat selon un contrat commun. Un orchestrateur compare ensuite les candidats sur leur qualité, leur value, leur fraîcheur, leur corrélation et leur capacité réelle de diffusion. Cette approche augmente les occasions sans diminuer les garde-fous et permet une activation ou un rollback par sport et par marché.

## 3. Architecture cible

1. **Collecteurs de données** : fixtures, état live, statistiques, classement, historique, cotes réelles et horodatage fournisseur.
2. **Adaptateurs de marché** : un module par marché transforme les données en caractéristiques, probabilité et justification structurée. Il ne diffuse rien.
3. **Conseil IA** : le roster existant vote sur un candidat normalisé. Jev/Kimi et les règles de quorum restent des dépendances conservées, non réécrites.
4. **Moteur d’éligibilité** : applique intégrité, fenêtre temporelle, quorum, confiance, cote réelle, value, whitelist et règles propres au marché.
5. **Portfolio Selector** : déduplique, limite la corrélation et classe les candidats admissibles. Il ne remplit jamais un quota ; il publie de zéro à N signaux.
6. **Registre officiel unique** : seule source de vérité pour site, application et Telegram.
7. **Outbox de diffusion** : livraisons idempotentes, preuves de tentative, succès, identifiant distant et erreur terminale.
8. **Settlement et mesure** : résultat officiel, rendement théorique, closing line, CLV, calibration et historique.
9. **Compteur de funnel** : mesures par sport et marché, sans donnée personnelle ni secret.

Chaque composant a une interface explicite. Les adaptateurs n’accèdent pas aux canaux, les canaux ne recalculent pas les décisions et les consommateurs ne lisent jamais une table Shadow comme un signal officiel.

## 4. Schéma officiel générique unique

Le registre officiel doit persister un objet immuable conforme au contrat suivant. Les extensions propres à un sport vont dans `features` et ne changent pas les champs communs.

```yaml
signal_id: string                 # UUID stable et idempotent
schema_version: integer
rule_version: string
decision_version: string
created_at: ISO-8601 UTC
observed_at: ISO-8601 UTC
expires_at: ISO-8601 UTC
source_mode: shadow|official

event:
  fixture_id: string
  sport: football|basketball|hockey|baseball
  competition_id: string
  competition_name: string
  season: string
  start_time: ISO-8601 UTC
  home: {id: string, name: string}
  away: {id: string, name: string}
  phase: prematch|first_half|halftime|second_half|in_play
  minute_or_clock: string|null
  score: {home: number|null, away: number|null}
  provider_snapshot_id: string
  provider_fetched_at: ISO-8601 UTC

market:
  market_type: string
  selection: string
  line: number|null
  period: full_game|first_half|second_half
  overtime_included: boolean|null
  market_key: string              # sport:type:period:selection:line

prediction:
  model_probability: number       # 0..1
  calibrated_probability: number # 0..1
  confidence: number              # 0..100
  direction: string
  explanation_codes: [string]
  feature_snapshot_hash: string
  features: object

consensus:
  roster_version: string
  eligible_seats: integer
  votes_received: integer
  votes_for_selection: integer
  quorum_required: integer
  votes:
    - agent_id: string
      status: vote|abstain|error
      selection: string|null
      probability: number|null
      confidence: number|null
      reason_code: string|null

odds:
  bookmaker_id: string
  bookmaker_name: string
  jurisdiction: string
  decimal: number
  captured_at: ISO-8601 UTC
  closing_decimal: number|null
  implied_probability_raw: number
  implied_probability_no_vig: number
  value_ratio: number             # calibrated_probability / implied_probability_no_vig
  value_edge: number              # calibrated_probability - implied_probability_no_vig
  executable: boolean
  evidence_hash: string

eligibility:
  eligible: boolean
  rejection_code: string|null
  checks:
    data_integrity: pass|fail
    whitelist: pass|fail
    time_window: pass|fail
    quorum: pass|fail
    confidence: pass|fail
    real_odds: pass|fail
    value: pass|fail
    correlation: pass|fail

publication:
  official_registered_at: ISO-8601 UTC|null
  idempotency_key: string
  channels:
    site: {state: pending|exposed|failed, proof_id: string|null, at: ISO-8601 UTC|null}
    app: {state: pending|exposed|failed, proof_id: string|null, at: ISO-8601 UTC|null}
    telegram:
      state: pending|attempted|succeeded|uncertain|failed
      delivery_key: string
      message_id: string|null
      attempted_at: ISO-8601 UTC|null
      succeeded_at: ISO-8601 UTC|null

settlement:
  state: pending|won|lost|void|cancelled
  settled_at: ISO-8601 UTC|null
  result_source: string|null
  final_score: {home: number|null, away: number|null}
  theoretical_return_units: number|null
  clv_percent: number|null
  brier_component: number|null
```

Contraintes obligatoires :

- aucun candidat officiel sans cote bookmaker réelle, fraîche, exécutable et traçable ;
- aucun candidat officiel sans probabilité calibrée et value positive au seuil versionné du marché ;
- seuil initial à évaluer en Shadow : `value_ratio >= 1,06`, jamais appliqué implicitement à un marché non validé ;
- une seule `idempotency_key` par fixture, marché, sélection, période et version de règle ;
- toute correction crée une nouvelle version liée, elle ne réécrit pas l’historique.

## 5. Portefeuille Football

Le marché O/U 2,5 existant reste le premier adaptateur officiel et conserve toutes ses règles actuelles.

Marchés à développer uniquement en Shadow avant promotion :

| Marché | Fenêtre autorisée | Données minimales | Règle de règlement |
|---|---|---|---|
| Over 0,5 but en seconde mi-temps | mi-temps ou début de seconde période | phase confirmée, score, statistiques live, cote 2H réelle | au moins un but après la mi-temps |
| Équipe marque encore | live, hors fin de match | équipe ciblée, score, pression/tirs, temps restant, cote réelle | l’équipe ciblée marque après le snapshot |
| Double chance | prématch ou début live | forces, absences si fiables, classement, cote réelle | sélection 1X, X2 ou 12 selon résultat final |
| Vainqueur final | prématch ou début live | forces, classement, état du match, cote réelle | vainqueur officiel du temps réglementaire selon définition bookmaker |
| Équipe +0,5 but en première mi-temps | prématch ou tout début live seulement | marché 1H explicite, minute admissible, cote réelle | équipe ciblée marque avant la mi-temps |

Le marché « équipe +0,5 but 1H » est interdit après la fenêtre début live configurée. Un marché ne réutilise jamais une cote d’un autre libellé ou d’une autre période. Le vainqueur final précise toujours la gestion des prolongations ; aucune valeur implicite n’est permise.

Le Portfolio Selector applique une limite de corrélation : une même fixture ne peut fournir plusieurs signaux officiels simultanés que si chaque marché est admissible et si une règle de compatibilité versionnée autorise explicitement la paire. Par défaut, un seul signal par fixture est publié.

## 6. Shadow Basketball, Hockey et Baseball

Chaque combinaison `sport + market_type` possède son propre registre Shadow, ses résultats et ses métriques. Les agrégats tous marchés confondus ne peuvent jamais autoriser une sortie Shadow.

Marchés candidats :

- Basketball : spreads, totaux de points et totaux équipe. La moneyline reste exclue du portefeuille personnel.
- Hockey : totaux, handicaps et moneyline uniquement si le marché indique explicitement « prolongation incluse ».
- Baseball : run line, totaux de runs et totaux équipe. La moneyline reste exclue du portefeuille personnel.

Mesures obligatoires par sport et marché :

- nombre de candidats, admissibles, rejetés et réglés ;
- rendement théorique à mise fixe, sans pari réel ;
- cote d’ouverture, cote capturée, closing line et CLV lorsque disponible ;
- Brier score, log loss, diagramme de calibration et ECE ;
- erreurs fournisseur, absence de cote, identité d’équipe ambiguë, résultat non confirmé ;
- distribution par compétition, bookmaker et tranche de cote.

Un marché peut sortir de Shadow uniquement si toutes les conditions suivantes sont vraies :

1. au moins 200 prédictions réglées sur au moins 60 jours calendaires ;
2. au moins cinq compétitions représentées et aucune compétition au-dessus de 35 % de l’échantillon ;
3. cote réelle prouvée pour au moins 95 % des prédictions évaluées ;
4. closing line disponible pour au moins 70 % de l’échantillon ;
5. CLV moyen au moins +1,5 % et borne basse bootstrap à 95 % supérieure à 0 ;
6. rendement théorique au moins +3 % et borne basse bootstrap à 95 % supérieure à -2 % ;
7. Brier score au plus 0,22 et ECE au plus 0,05 ;
8. zéro incident critique d’identité, de période, de règlement ou de double diffusion sur les 30 derniers jours ;
9. validation humaine explicite du rapport de sortie Shadow.

Si une condition régresse après activation, le marché repasse automatiquement en Shadow via son feature flag ; l’historique reste visible.

## 7. Sélection du portefeuille et objectif de volume

L’objectif 3 à 4 signaux quotidiens est une moyenne d’observation sur 30 jours, pas une contrainte d’émission. Le sélecteur :

1. élimine tous les candidats non admissibles ;
2. déduplique les identités et les marchés ;
3. classe par qualité calibrée, value, fraîcheur des données et robustesse ;
4. applique les règles de corrélation ;
5. transmet tous les candidats restants, éventuellement aucun.

Aucun fallback ne baisse la confiance, le quorum, la value, la qualité des données ou l’exigence de cote réelle pour atteindre le volume.

## 8. Source unique, idempotence et preuve de réception

Le registre officiel est la seule source des cartes site, des vues application et des messages Telegram. Chaque canal consomme le même `signal_id`, le même snapshot, la même sélection, la même cote et la même version de règle.

L’outbox possède une clé unique `signal_id + channel + destination`. Les états `attempted`, `succeeded`, `uncertain` et `failed` sont persistants. Un succès exige une preuve distante : identifiant Telegram, accusé applicatif ou preuve d’exposition site. Une tentative sans preuve ne devient jamais un succès et n’est pas rejouée aveuglément lorsque l’acceptation distante est incertaine.

## 9. Compteur diagnostique par marché

Le compteur de funnel existant est étendu, sans rupture, avec les dimensions `sport`, `market_type`, `source_mode` et `rule_version`. Les étapes restent :

`fixtures_seen → live_stats_available → minute_window_valid → first_half_confirmed → votes_received → consensus_4_of_5 → confidence_ge_80 → real_odd_present → real_odd_in_range → official_registry → site_exposed → telegram_attempted → telegram_succeeded`.

Pour les marchés non soumis à une première mi-temps ou au quorum 4/5, l’étape garde le nom historique mais enregistre `not_applicable` dans un champ de résultat au lieu de fabriquer un passage. Les tableaux de bord séparent toujours les marchés et montrent un motif exclusif de rejet par candidat. Rétention opérationnelle minimale : sept jours ; les agrégats Shadow et de performance restent conservés dans l’historique analytique.

## 10. Migration du site O/U vers des cartes génériques

La carte générique est rendue depuis le schéma officiel et affiche : sport, rencontre, marché, sélection, période, cote réelle, bookmaker, confiance, consensus, value, état de diffusion et résultat. Elle ne contient aucune logique sportive.

Migration progressive :

1. adaptateur de compatibilité transformant le signal O/U 2,5 actuel vers le schéma générique ;
2. rendu générique derrière feature flag, invisible au public ;
3. comparaison visuelle et contractuelle avec les cartes O/U actuelles ;
4. canary interne, puis 10 %, 25 %, 50 % et 100 % du trafic ;
5. retrait de l’ancien rendu uniquement après parité fonctionnelle et preuves de réception.

L’application et Telegram utilisent les mêmes libellés normalisés ; aucune réinterprétation locale du marché n’est autorisée.

## 11. Feature flags et rollback

Flags indépendants :

- `signal_engine_v2_enabled` ;
- `market_<sport>_<market>_shadow_enabled` ;
- `market_<sport>_<market>_official_enabled` ;
- `generic_signal_cards_enabled` ;
- `generic_signal_cards_traffic_percent`.

Désactiver un marché officiel arrête les nouvelles inscriptions et diffusions, sans supprimer les signaux déjà enregistrés ni leurs résultats. Le rollback du moteur V2 réactive la lecture O/U historique ; les nouvelles tables restent en lecture seule pour audit. Aucun rollback ne restaure une base complète au détriment de données créées depuis le déploiement.

## 12. Phases de réalisation

### Phase 0 — Contrats et données

Créer les types, validateurs, tables versionnées, adaptateur O/U 2,5 et fixtures de test sanitised. Aucun nouveau marché officiel.

### Phase 1 — Source unique et consommateurs

Brancher registre, outbox et cartes génériques en mode miroir. Vérifier la parité site/app/Telegram et l’idempotence.

### Phase 2 — Football Shadow

Ajouter les cinq marchés football prévus, un par un, avec flags séparés, règlement automatique et mesures de calibration/CLV.

### Phase 3 — Shadow multisport

Ajouter Basketball, Hockey et Baseball par marché, sans diffusion officielle. Produire les rapports de sortie Shadow.

### Phase 4 — Promotions contrôlées

Promouvoir uniquement une combinaison sport-marché validée, après approbation humaine, canary et surveillance.

### Phase 5 — Migration publique

Déployer progressivement les cartes génériques, puis retirer l’ancien rendu O/U après parité complète.

## 13. Tests et migration

Tests requis :

- contrats de schéma et migrations ascendantes/descendantes ;
- compatibilité bit à bit du signal O/U 2,5 existant ;
- fixtures par sport, phase, marché et règle de règlement ;
- rejet des cotes estimées, périmées, hors marché ou non exécutables ;
- calcul no-vig, value, CLV, Brier et ECE ;
- quorum, abstention, erreur agent et conservation du roster ;
- déduplication par fixture/marché/période/version ;
- corrélation et sélection sans quota forcé ;
- outbox : succès, retry sûr, état incertain, preuve distante et reprise après crash ;
- parité site/app/Telegram depuis le même `signal_id` ;
- feature flags et rollback par marché/sport ;
- non-régression Jev/Kimi, whitelists, historique et O/U 2,5 ;
- tests de charge du registre et des agrégats du compteur.

La migration de données est additive. Les anciennes lignes O/U restent intactes et reçoivent un identifiant de compatibilité déterministe. Aucune donnée historique n’est supprimée ou réécrite.

## 14. Observabilité

Tableaux obligatoires :

- funnel quotidien et sur sept jours par sport/marché/version ;
- motifs exclusifs de rejet ;
- volume de candidats, officiels et réellement reçus ;
- délai snapshot → registre → site/app/Telegram ;
- taux d’état incertain et de doublon ;
- cotes manquantes, expirées ou non exécutables ;
- résultats, ROI théorique, CLV, Brier et ECE ;
- concentration par compétition et bookmaker ;
- état des feature flags et version de règles.

Alertes immédiates : double inscription officielle, divergence de contenu entre canaux, succès sans preuve, résultat contradictoire, marché sans cote réelle, identité ambiguë ou rollback automatique.

## 15. Critères d’acceptation

La conception est acceptée pour planification lorsque :

1. le signal O/U 2,5 actuel passe par le schéma générique sans changement de décision ;
2. site, app et Telegram lisent le même registre et prouvent leur réception ;
3. aucun signal officiel ne peut exister sans cote réelle, value, quorum et règles versionnées applicables ;
4. chaque marché est isolé par flags, métriques, tests et rollback ;
5. les critères Shadow sont calculés par sport-marché, jamais globalement ;
6. le moteur peut produire zéro signal sans dégrader ses seuils ;
7. Jev, Kimi, le roster, les whitelists et l’historique complet sont préservés ;
8. le compteur explique chaque perte du funnel par marché ;
9. toutes les migrations sont additives et réversibles sans perte de données ;
10. aucun changement de production n’est inclus dans l’approbation de ce document.