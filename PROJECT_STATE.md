# 📖 PROJECT_STATE.md — Mémoire vivante de TousLesMatchs

**Toute IA reprenant le projet DOIT lire ce fichier en premier**, avant même
`CLAUDE.md`. C'est la seule source de vérité sur l'état actuel du projet.

---

## 🔖 État courant (à mettre à jour à chaque session)

| Champ | Valeur |
|---|---|
| **Dernière mise à jour** | 16 juillet 2026, 15h10 |
| **Commit stable** | `e71071f` (branche `claude/consensus-engine-architecture-sy3gqg`) |
| **Verrou** | `VERSION_LOCK.md` — commit `1918412` interdit tout retour antérieur |
| **VPS déployé sur** | `e71071f` — vérifié en ligne (197 Ko, widgets OK, garde-fous verts) |
| **Branche de dev active** | `claude/consensus-engine-architecture-sy3gqg` (la SEULE — `smoke-test` abandonnée) |
| **Étape courante** | Incident web-root résolu + déploiement durci |
| **Prochaine action** | Collaboration multi-IA (Claude + GPT) sur dossier partagé + Hermès agent |

## 🔥 Incident 16 juillet 2026 — vieille version servie + pull bloqués (RÉSOLU)

**Symptômes** : site figé sur vieille page 42 Ko sans widgets depuis des semaines,
aucun signal Telegram, déploiements sans effet.

**Cause racine (double)** :
1. `docker-compose.yml` modifié **à la main sur le VPS** (non commité) pour servir
   `site/` au lieu de `public/` → vieille page servie (interdit par VERSION_LOCK).
2. `site/index.html` (généré en écriture par Hermès `html_generator.py`) était
   **suivi par git** → toujours « modifié » → **bloquait tous les `git pull`**
   silencieusement pendant des jours → aucun déploiement ne passait.

**Correctifs appliqués (commits ee0d028 → e71071f)** :
- Montage web root remis sur `public/` (`docker-compose.yml` restauré).
- `site/index.html` **dé-suivi** (`git rm --cached` + `.gitignore`). `template.html`
  reste suivi (source lue par Hermès).
- `deploy.sh` durci avec 3 garde-fous :
  - **G1** : refuse si modifs code/config non commitées (ignore `site/` généré).
  - **G2** : refuse si `docker-compose.yml` sert `site/` au lieu de `public/`.
  - **G3** : refuse si page en ligne < 100 Ko ou sans `widgets.js` + alerte Telegram.
- `deploy.sh` pointe désormais sur `claude/consensus-engine-architecture-sy3gqg`.

**Leçon** : ne JAMAIS éditer un fichier suivi directement sur le VPS. Ne jamais
suivre dans git un fichier généré en runtime. Toujours passer par la branche.

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
- [x] **Audit réalisé le 14 juil 2026** — résultats consolidés ci-dessous
- [x] **Actions correctives appliquées** (commit 368fd64+) :
  - Filtre Python Concile réparé (mapping noms incorrect → aucun agent n'était filtré)
  - Seuil `MIN_AGENT_ACCURACY` : 80% → 55% (réaliste)
  - Groq-Llama8B (43% sur 255) retiré du banc d'essai
- [ ] Rapport structuré par criticité (rouge/orange/jaune/vert)

**Résultats audit 14 juil 2026 :**

| Rang | IA | Winrate | Statut | Action |
|---|---|---|---|---|
| 🥇 | Cohere-Command | 70% (935) | Champion tous marchés | Garder + doubler poids en Phase 2 |
| 🥇 | Mistral-Large | 70% (870) | Excellent | Garder |
| 🥈 | Perplexity-Web | 69% (934) | Excellent (web temps réel) | Garder |
| 🥈 | Claude Chief | 68% (1057) | Arbitre stable | Garder |
| 🥉 | DeepSeek-V3 | 67% (928) | Champion Over/Under 2.5 (71%) | Garder + spécialiser Phase 2 |
| ⚪ | Mistral-Small (shadow) | 63% (90) | Prometteur | **Candidat à promouvoir** ≥ 50 résolus supplémentaires |
| ⚪ | Groq-Llama70B (shadow) | 57% (247) | Stable, échantillon large | **Candidat à promouvoir** en Phase 2 |
| ⚠️ | Mistral-7B | 54% (96) | Bordure | Surveillé (filtre auto Python appliqué) |
| ❌ | GeminiFlash | 49% (96) | Sous-performant | Filtré du Python Concile |
| ❌ | GROQ-Llama | 47% (113) | Sous-performant | Filtré du Python Concile |
| ❌ | GPT Analysis | 46% (111) | Sous-performant | Filtré du Python Concile |
| 🗑️ | Groq-Llama8B (shadow) | 43% (255) | Supprimé | Retiré du code |

**Champions par marché :**
- BTTS → Cohere-Command **70%**
- Over/Under 2.5 → DeepSeek-V3 **71%**
- But 1ère MT → Cohere-Command **82%** 🔥
- Résultat 1X2 → Cohere-Command **60%**

**Optimisation appliquée :** seuil Signal Fort abaissé à 75% sur le marché
"But 1ère MT" (`MARKET_SIGNAL_FLOORS` dans `api_server.js`).

### Étape 2 — Cloisonnement abonnements
- [ ] Vérifier chaque plan (1€, Pro 9,90, Elite 19,90)
- [ ] Telegram premium réservé Pro/Elite

### Étape 3 — Sécurité
- [ ] **URGENT** : Rotation clés API (Stripe, Mistral, Telegram) — cf. procédure ci-dessous
- [ ] **URGENT** : Rotation code admin `ELITE-ADMIN1` (compromis dans chat) — bloc SQL fourni
- [x] **Rate limiting API** (fait ce 14 juil) :
  - `/login` 10/min · `/register` 5/min
  - `/create-checkout-session` 10/min
  - `/analyse` `/live-ia/analyse` `/concile-analysis` 30/min
  - `/chat` 20/min
  - 429 + Retry-After header si dépassement
- [x] **Headers sécurité Caddy** (fait ce 14 juil) :
  - HSTS 1 an + preload
  - X-Content-Type-Options nosniff
  - X-Frame-Options SAMEORIGIN
  - Referrer-Policy strict-origin-when-cross-origin
  - Permissions-Policy restrictive
  - CSP whitelist (Stripe, TikTok, Telegram, GA autorisés)
  - Server header masqué

**Procédure rotation clés API (à faire trimestriellement) :**
1. Stripe : dashboard.stripe.com → API keys → Roll → mettre à jour `.env` sur VPS
2. Telegram bot : parler à @BotFather → `/revoke` → nouveau token
3. Mistral : console.mistral.ai → API keys → régénérer
4. Toujours : `docker restart touslesmatchs-api touslesmatchs-council` après update `.env`

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
