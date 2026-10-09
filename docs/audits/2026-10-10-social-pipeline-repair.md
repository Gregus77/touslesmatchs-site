# Social pipeline audit - 10 October 2026
The publish command refuses enabled=false and raised a generic ValueError. The failure was reproduced before state creation or any transport call. Queue PNG/caption files are not consumed: input is config.sourceFile.
Correction deployed: allowlisted non-secret error reasons, Node dotenv-data launcher and cron logging. Other cron entries are preserved; publication remains disabled.
Validation: 30 regression tests pass; isolated offline/current-source dry runs produce zero deliveries. Actual diagnostic output is publication_disabled. Persisted production state remains 36 published deliveries.
Incomplete: canonical export, live-signal cards, player-poster style, FR/RU routing, server social connection, image budget and real generation validation. No new public post sent.
Rollback: restore pipeline.py and crontab.txt from /opt/backups/social-pipeline-20261009T224244Z. Preserve state.db and receipts.
GitHub push awaits explicit approval following automatic review rejection.
