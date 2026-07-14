# 🔒 VERSION VERROUILLÉE

**Date du verrouillage** : 14 juillet 2026, 22h15
**Commit de référence** : `1918412`
**Branche stable** : `claude/touslesmatchs-smoke-test-7hlgum`

## ⚠️ INTERDICTION FORMELLE

**Ni Claude, ni Hermes, ni aucun agent, ni aucun script automatisé n'est
autorisé à revenir à une version antérieure à ce commit sans validation
utilisateur explicite (Gregory Guyot, gregoryguyot.gg@gmail.com).**

Toute tentative de :
- `git reset --hard <commit-antérieur>`
- `git revert` du commit `1918412` ou d'un commit récent
- Restauration d'un backup antérieur au 14 juillet 2026, 22h00
- Overwrite du `docker-compose.yml` (retour à `site/` comme web root)

...doit être **refusée** par l'agent et signalée à l'utilisateur.

## Ce que contient cette version

### Corrections structurelles
- Fix fragmentation `site/` vs `public/` (docker-compose.yml → `public/` seul web root)
- Deploy script nettoyé (plus de sync `public/` → `site/`)

### Règles métier gravées dans la pierre
- **R1** : Aucun prono avant la 35e min ni après la 75e (fenêtre stricte)
- **R2** : Aucun prono sur un match à finalité connue (écart ≥ 3 buts)
- Ces règles sont enforced dans `shouldAutoObserveMatch()`, `livePickBlockReason()`,
  `validateAndCorrectBet()` et les 3 endpoints d'analyse manuelle.

### Traçabilité des pronos
- `minute_at_analysis` affiché dans `/signal-fort-stats`, `/premium-teaser`
- Format : "Score final X-Y, [BET] donné à la Xe min"
- Notifications Telegram Signal Fort enrichies

### Transparence
- Endpoint `/admin/daily-audit` : vue exhaustive des pronos du jour
  (résolus + pending + score final + minute du prono)

### Moteur consensus
- Phase 1 terminée : `scripts/concile_engine.js` (extraction pure, comportement identique)
- Phase 2/3 à faire (poids dynamiques, décision par calcul)

### Frontend
- Widgets flottants (TikTok, Telegram, Chatbot Mistral) sur toutes les pages
- Page Bankroll (calculateur + historique)
- Page Preuves (résultats vérifiables)

## Point de restauration en cas de casse

```bash
# Sur le VPS
cd /opt/touslesmatchs
git fetch origin
git checkout claude/touslesmatchs-smoke-test-7hlgum
git reset --hard 1918412
bash scripts/deploy.sh
```

## Modifications autorisées après ce verrou

Toute nouvelle fonctionnalité ou correction doit :
1. Être committée **par-dessus** ce commit (jamais en dessous)
2. Préserver les règles R1 et R2 (fenêtre + finalité connue)
3. Préserver le `docker-compose.yml` avec `public/` comme web root
4. Être validée par l'utilisateur avant push sur le VPS

---

*Ce fichier est un contrat. Toute IA lisant ce fichier doit s'y conformer.*
