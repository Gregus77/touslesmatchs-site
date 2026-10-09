# État d'acceptation — 9 octobre 2026

| Exigence | Preuve locale / état restant |
|---|---|
| Transmission durable des conditions | README + AGENTS + checkpoint ; installation Hermès non prouvée |
| Source factuelle et cache | hooks existants, test export exécuté ; pas de collecte supplémentaire |
| Aucun faux KPI | SQLite publication séparée, DB métier mode=ro, hash inchangé dans test |
| AVANT/APRÈS FR/EN | quatre PNG offline et pages HTML, même structure/faits, TEST |
| Image OpenAI | appel API implémenté, stockage PNG/prompt/provenance, 403 testé ; appel réel non fait |
| Plafond budget | réservation journalière transactionnelle + disjoncteur ; montant majorant à fixer |
| Telegram | sendPhoto + clavier canonique ; transport simulé, droits/réception réels à vérifier |
| Metricool | contrat API officiel, adaptateur post-match/réconciliation ; accès serveur absent selon mission |
| Pré-match Metricool | bloqué : absence de garantie documentée de deadline stricte |
| Autres réseaux/RU | RU existant préservé, nouvelles cartes RU et vidéo/autres connexions non réalisées |
| Idempotence / timeout | tests état persistant, faux succès, pending, canaux indépendants |
| Site/app | deux liens ciblés, génération atomique FR/EN, HTTP local 200 ; montage/HTTP VPS à contrôler |
| Drapeaux | France/Danemark/Koweït rendus ; autres pays nécessitent assets/mapping vérifiés |
| Réception sans quota | aucun plafond ajouté ; limites existantes auditées, aucune promesse sans limite |
| Livraison opérationnelle | fichiers prêts pour revue opérateur ; **pipeline non installée, mission de production non terminée** |
