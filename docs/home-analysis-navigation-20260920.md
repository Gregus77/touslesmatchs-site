# Homepage navigation repair

The production hero CTA targeted #tlm-panel-live, not Live IA. Replace only that anchor with /live-ia. No account, plan, administrator authorization, payment, or secret changes. Server authorization remains intact. Deployment backs up the actual served public/index.html and uses an exact unique anchor rather than replacing the dirty production file.

Behavioral patch tests cover correct destination, unchanged Tarifs link, idempotence and ambiguous/missing anchors. General React suite previously reported no tests; targeted tests are the validation for this change.
