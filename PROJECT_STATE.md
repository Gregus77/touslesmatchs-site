# 📖 PROJECT_STATE.md — Mémoire vivante de TousLesMatchs

**Toute IA reprenant le projet DOIT lire ce fichier en premier**, avant même
`CLAUDE.md`. C'est la seule source de vérité sur l'état actuel du projet.

---

## 🔖 État courant (à mettre à jour à chaque session)

| Champ | Valeur |
|---|---|
| **Dernière mise à jour** | 14 juillet 2026, 22h45 |
| **Commit stable** | `df8e294` (branche `claude/touslesmatchs-smoke-test-7hlgum`) |
| **Verrou** | `VERSION_LOCK.md` — commit `1918412` interdit tout retour antérieur |
| **VPS déployé sur** | `df8e294` (dernier `bash scripts/deploy.sh`) |
| **Étape courante** | Étape 1 — Audit complet (mission 10 étapes) |
| **Prochaine action** | Interpréter le résultat de `/admin/full-agents-audit` pour classer les IA |

## 📋 Checklist de démarrage de session

À chaque nouvelle session, l'IA doit :

1. ☐ Lire `PROJECT_STATE.md` (ce fichier)
2. ☐ Lire `VERSION_LOCK.md` (commit interdit de rollback)
3. ☐ Lire `CLAUDE.md` (règles automatiques + économie de tokens)
4. ☐ Lire `docs/CONSTITUTION.md` (vision + organisation)
5. ☐ Lire `docs/INFRASTRUCTURE.md` (VPS, Docker, backups, sécurité)
6. ☐ Lire `docs/HERMES_COUNCIL.md` (moteur IA + boucle apprentissage)
7. ☐ Lire `docs/BUSINESS_GROWTH.md` (roadmap commercial)
8. ☐ Vérifier `git log --oneline -5` (5 derniers commits)
9. ☐ Vérifier la branche courante (`git status`)
10. ☐ Consulter la section « Chantiers ouverts » ci-dessous

## 🏗️ Chantiers ouverts

### Étape 1 — Audit complet (EN COURS)
- [x] Endpoint `/admin/daily-audit` (pronos + résultats du jour)
- [x] Endpoint `/admin/full-agents-audit` (perf IA + IA blanches + Telegram push)
- [ ] Interpréter les résultats → décider quelles IA promouvoir/supprimer
- [ ] Rapport structuré par criticité (rouge/orange/jaune/vert)

### Étape 2 — Cloisonnement abonnements
- [ ] Vérifier chaque plan (1€, Pro 9,90, Elite 19,90)
- [ ] Telegram premium réservé Pro/Elite

### Étape 3 — Sécurité
- [ ] **URGENT** : Rotation clés API (Stripe, Mistral, Telegram)
- [ ] **URGENT** : Rotation code admin `ELITE-ADMIN1` (compromis dans chat)
- [ ] Rate limiting API
- [ ] Headers sécurité Caddy

### Étape 4 — Moteur consensus (Phase 2 & 3)
- [x] Phase 1 : `scripts/concile_engine.js` extrait
- [ ] Phase 2 : poids dynamiques (market × league × recency)
- [ ] Phase 3 : décision par calcul (Chief perd l'arbitrage)

### Étape 5 — Brevo
- [ ] Nurturing email sequences
- [ ] Newsletter capture

### Étape 6 — CGU / Légal
- [ ] Pages ANJ
- [ ] Mentions légales

### Étape 7 — Multilingue
- [ ] i18n complet (FR base, EN, ES)

### Étape 8 — Responsive
- [ ] Audit mobile-first

## 🚨 Problèmes ouverts

| Problème | Statut | Action |
|---|---|---|
| Code admin `ELITE-ADMIN1` compromis (posté en chat) | ⚠️ En attente rotation | Utiliser bloc SQL fourni ce jour |
| Alexis admin sur Telegram Premium | ⚠️ Manuel requis | App Telegram → Premium → Admins → retirer |
| Romuald ID Telegram inconnu | ⏳ | Il doit envoyer `/start` au bot en privé |

## 💾 Points de restauration disponibles

| Tag / Commit | Description |
|---|---|
| `1918412` (14 juil 2026, 22h15) | Base verrouillée — widgets + règles R1/R2 + audit endpoints |
| `df8e294` (14 juil 2026, 22h45) | + endpoint full-agents-audit |
| `/opt/touslesmatchs/backups/mission-2026-07-14-15h45/` | Backup VPS full |

**Restauration d'urgence** :
```bash
cd /opt/touslesmatchs
git fetch origin
git reset --hard <commit>
bash scripts/deploy.sh
```

---

*Cette page se met à jour à chaque fin de session significative. Toute IA
qui modifie l'état du projet doit mettre à jour ce fichier avant de conclure.*
