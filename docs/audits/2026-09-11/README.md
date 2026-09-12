# Audit interne IA et marchés shadow — 11 septembre 2026

**Décision : aucun remplacement des cinq sièges ; BTTS et les autres marchés restent à blanc. Échantillon insuffisant.** Aucun code de production, seuil sportif, budget, abonnement ou envoi Telegram modifié par cet audit.

## Source et portée

Calcul sur la sauvegarde SQLite cohérente du VPS prise le 11 septembre 2026 à 21:31:25 UTC. La base de production reste intacte. Le fichier source est local, non inclus dans Git ; son empreinte SHA-256 est `208f5b6c8b1639801e21bb75bcf7d1ec3848ca3471dbc694d34611a60ae2311a`. `PRAGMA quick_check` : `ok`. Les exports sont des agrégats internes, pas des statistiques publiques de signaux livrés.

Sources : 118 520 lignes `agent_market_predictions`, 11 195 `agent_calls`, 3 170 `shadow_evals`, 309 `shadow_tournament_predictions`, 927 `shadow_market_predictions` et 309 `shadow_tournament_calls`. La table historique `agent_predictions` ne constitue pas un échantillon supplémentaire indépendant et n’est pas additionnée. Période des prédictions examinées : 30 juin–11 septembre 2026.

## Marchés du tournoi shadow

| Marché | Résultats stockés G/P | Événements distincts résolus | Résultats déjà déterminés à la prédiction | Résultats prédictifs vérifiés | Cotes utilisables |
|---|---:|---:|---:|---:|---:|
| ou25 | 2/0 | 1 | 2 | 0 | 0 |
| ou05 | 0/0 | 0 | 0 | 0 | 0 |
| ou15 | 8/0 | 5 | 8 | 0 | 0 |
| ou35 | 0/0 | 0 | 0 | 0 | 0 |
| btts | 6/0 | 3 | 6 | 0 | 0 |

Les six lignes BTTS gagnantes correspondent à trois matchs où les deux équipes avaient déjà marqué. Les deux lignes O/U 2,5 gagnantes portent sur un seul match, score 2–1 à la 40e minute. Les huit résultats O/U 1,5 étaient également déjà déterminés par le score. Ces lignes restent dans l’historique brut, mais sont exclues des preuves de promotion. Aucune défaite enregistrée n’est retirée des résultats bruts.

BTTS : zéro résultat prédictif fiable contre 50 requis au total et 20 par segment. Aucun ROI aux cotes réelles calculable. Les tests de résolution réussis ne démontrent pas l’absence de fuite temporelle dans la collecte. Aucune intégration site/API/application ni diffusion Telegram.

O/U 0,5 : aucune ligne dans ce tournoi. Les mesures historiques officielles, exportées séparément, ne sont pas un nouveau tournoi shadow comparable. O/U 1,5 et O/U 3,5 restent également à blanc. La collecte existante est laissée inchangée ; aucun appel payant supplémentaire déclenché.

## Disponibilité des challengers

Identifiants ci-dessous tels qu’enregistrés ; les noms commerciaux ne prouvent pas le modèle réellement servi. Une réponse réussie ne prouve pas la validité de chaque marché du lot.

| Libellé enregistré | Modèle enregistré | Tentatives | Réponses réussies | Disponibilité | Latence p50/p95 (ms) |
|---|---|---:|---:|---:|---:|
| Kimi K3 | `moonshotai/kimi-k2` | 31 | 14 | 45.16 % | 8603/10215 |
| GPT-5.2 | `openai/gpt-5.2` | 31 | 7 | 22.58 % | 6371/8882 |
| Claude Sonnet 5 | `anthropic/claude-sonnet-5` | 31 | 24 | 77.42 % | 3524/7275 |
| Gemini 3.7 Flash | `google/gemini-3.7-flash` | 31 | 0 | 0.0 % | 3752/14242 |
| DeepSeek V4 Pro | `deepseek/deepseek-v4-pro-0813` | 31 | 6 | 19.35 % | 5999/7681 |
| Grok 4.6 | `x-ai/grok-4.6` | 31 | 31 | 100.0 % | 11666/30135 |
| GLM 5.3 Flash | `z-ai/glm-5.3-flash` | 31 | 0 | 0.0 % | 5667/11735 |
| Qwen 3.8 Max | `qwen/qwen3.8-max` | 31 | 0 | 0.0 % | 8699/10937 |
| Muse Spark 1.2 | `meta/muse-spark-1.2` | 31 | 0 | 0.0 % | 162/222 |
| Mercury 2.5 | `inception/mercury-2.5-preview` | 30 | 0 | 0.0 % | 1025.5/1205 |

Les 200 comparaisons challenger × marché × titulaire ne contiennent aucun résultat prédictif comparable admissible. Aucun challenger ne remplit le minimum de 20 résultats, les taux récents 70 %/60 %, l’avantage de 5 points et les autres conditions cumulatives. Les coûts facturés et leur acceptabilité ne sont pas démontrés. Aucun changement de siège et aucun test de non-régression d’un remplacement fictif.

## Titulaires, calculs et limites

Les cinq sièges préservés sont Perplexity-Web, DeepSeek-V3, Mistral-Large, Cohere-Command et OpenRouter-Qwen. Les métriques par siège sont descriptives : plusieurs identifiants de modèles et populations de matchs coexistent, interdisant de classer les titulaires par leurs seuls taux bruts.

- `model_market_metrics.csv` : chaque modèle/marché/source, gagnés et perdus stockés, 20/10 derniers et effectifs, exclusions, résultats prédictifs, profit et ROI disponibles.
- `seat_market_metrics.csv` : mêmes métriques par siège, sans attribuer les anciennes lignes à son modèle actuel.
- `attempts_availability_latency.csv` : tentatives par lot, réponses réussies, erreurs, validité du vote quand enregistrée, disponibilité et latences. Les appels couvrent plusieurs marchés : aucune ventilation fictive des tentatives par marché. Une abstention et un champ invalide normalisé en `NO BET` ne sont pas toujours distinguables.
- `segments_competition.csv`, `segments_minute_band.csv`, `segments_confidence_band.csv` : mêmes métriques par championnat, minute et confiance. Les segments ne sont pas nécessairement additifs.
- `legacy_shadow_metrics.csv` : anciennes IA shadow conservées séparément ; état de match immuable, modèle exact et dénominateur des tentatives manquent. Elles ne justifient aucune promotion.
- `comparable_promotions.csv`, `shadow_market_readiness.csv`, `summary.json` : contrôles et décisions.
- `estimated_costs_not_invoices.csv` : estimations internes uniquement, ni factures ni coût réel démontré.

Règles de calcul : les colonnes `stored_*` et `last20_*`/`last10_*` conservent les observations brutes, avec leur effectif réel ; vingt observations ne signifient pas vingt matchs. Les colonnes `verified_*` excluent les issues connues au score de départ, temps non prouvés, résolutions incohérentes, confiance invalide et erreurs. Les colonnes `predictive_*` dédupliquent ensuite en gardant la première observation admissible par événement, acteur, modèle et marché. Dans une agrégation de plusieurs acteurs, un événement peut donc apparaître pour plusieurs modèles : aucun effectif agrégé n’est assimilé à des matchs indépendants pour une promotion.

Une comparaison exige le même événement et marché, le même score enregistré, au plus 120 secondes d’écart, une correspondance titulaire unique et un seul couple par événement. 259/309 états du tournoi diffèrent du consensus mutable actuel : l’audit utilise les états enregistrés du tournoi. Aucune jointure directe des clés appels/prédictions n’aboutit ; seuls 19 580/118 520 enregistrements sont attribuables à un modèle via une correspondance unique agent, match, score, tranche de minute, date et horodatage proche. Le reste est marqué `model_id_not_proven`.

Profit : mise constante de 1 unité ; gain = cote − 1, perte = −1 ; ROI = profit / nombre de résultats cotés × 100. Cote réelle enregistrée uniquement, sélection strictement identique, source non estimée, consensus horodaté avant la prédiction et âgé de 120 secondes au plus. Cet horodatage est un proxy : la date exacte de capture de la cote n’est pas disponible. Ces ROI descriptifs ne démontrent pas une cote exécutable et ne suffisent pas pour promouvoir. Aucune cote O/U empruntée pour BTTS ; valeur vide = inconnu, jamais zéro.

## Validation et reproduction

Sept tests Python vérifient initialement exclusions temporelles, scores manquants, identité, résolution, petits échantillons et absence de ROI synthétique. Le test JavaScript extrait la fonction de résolution actuelle du worker et couvre 200 cas de scores valides plus une abstention, sans réseau ni base. Un test supplémentaire vérifie la déduplication des snapshots pour le ROI et les séries récentes.

Depuis la racine du dépôt :

```sh
python3 scripts/audit/test_ai_shadow_evidence.py
node scripts/audit/test_shadow_settlement.js
python3 scripts/audit/ai_shadow_evidence.py --db /opt/touslesmatchs/backups/telegram-deploy-20260911-213125/tlm.db --out /tmp/tlm-ai-evidence-reproduced
```

Le script et les métadonnées concernent cette sauvegarde datée ; ils ne constituent pas un moniteur temps réel. Le notebook `audit.ipynb` permet de relire les agrégats sans dépendance tierce. Ses cellules ont été exécutées avec Python ; interface Jupyter non vérifiée.

Limite à corriger avant toute validation future : enregistrer des états immuables et des cotes propres à chaque marché, rejeter les issues déjà déterminées avant l’appel, tracer explicitement modèle/tentative/validité et comparer des matchs contemporains. Ces améliorations ne sont pas mises en production dans cette mission limitée à l’audit.
