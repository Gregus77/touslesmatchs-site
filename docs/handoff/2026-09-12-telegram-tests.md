# Tests complets — 12 septembre 2026

Exécution isolée sans réseau sur main puis candidat (Node 20, image de production). Aucun test désactivé.

| Test | Avant | Après |
|---|---|---|
| `scripts/test_ai_budget_guard.js` | 1 | 1 |
| `scripts/test_api_sports_live_coverage_20260905.js` | 0 | 0 |
| `scripts/test_beta_retirement_and_free_funnel.js` | 1 | 1 |
| `scripts/test_free_premium_offer_20260911.js` | 1 | 1 |
| `scripts/test_free_proof_and_upcoming_state.js` | 1 | 1 |
| `scripts/test_homepage_analysis_gate.js` | 1 | 1 |
| `scripts/test_homepage_consensus_20260905.js` | 0 | 0 |
| `scripts/test_i18n_integral_20260906.js` | 0 | 0 |
| `scripts/test_live_vote_fallback_20260905.js` | 0 | 0 |
| `scripts/test_long_history.js` | 1 | 1 |
| `scripts/test_match_lifecycle_20260906.js` | 0 | 0 |
| `scripts/test_mobile_responsive_parity.js` | 1 | 1 |
| `scripts/test_no_tiktok_ui_20260906.js` | 0 | 0 |
| `scripts/test_ou25_consensus_3of5_20260905.js` | 0 | 0 |
| `scripts/test_ou25_post_analysis_odds_20260905.js` | 0 | 0 |
| `scripts/test_public_data_repair_20260905.js` | 1 | 1 |
| `scripts/test_public_quorum_copy_3of5_20260906.js` | 0 | 0 |
| `scripts/test_real_bookmaker_filter.js` | 0 | 0 |
| `scripts/test_real_odds_selection_20260905.js` | 0 | 0 |
| `scripts/test_recovery_premium_scope_20260911.js` | 0 | 0 |
| `scripts/test_signal_pipeline_order.js` | 0 | 0 |
| `scripts/test_signal_volume_shadow_markets_20260904.js` | 0 | 0 |
| `scripts/test_stale_result_resolution_date_guard.js` | 0 | 0 |
| `scripts/test_telegram_client.js` | 0 | 0 |
| `scripts/test_telegram_recap_snapshot.js` | nouveau | 0 |
| `scripts/test_telegram_ru_two_tiers_20260911.js` | 0 | 0 |
| `scripts/test_window_15_45_20260905.js` | 1 | 1 |
| `scripts/audit/test_shadow_settlement.js` | 0 | 0 |
| `audit-python` | 0 | 0 |

0 = succès, 1 = échec. Les échecs sont présents avant le correctif.

Compléments : budget IA en répertoire inscriptible : 20/20. Avec Node 22 : long_history passe, public_data_repair échoue avant comme après. React avec les dépendances VPS : échec avant/après sur IntersectionObserver absent. Les tests VPS additionnels ont aussi été exécutés sans réseau ; les tests de notification admin, quorum précoce, webhook, fournisseurs, reprise Recovery, cote absente et fenêtre active passent. Les anciennes assertions de textes RU/offres/front ne passent pas toutes et ne sont pas modifiées.

Les tests Telegram ont été adaptés pour injecter la lecture de la preuve par canal et vérifient que la même issue finale peut gagner en Under FR et perdre en Over RU. Le nouveau test couvre aussi le rollback intégral si un rendu russe échoue. Le démarrage isolé de l’API renvoie HTTP 200.
