# 🛡️ INFRASTRUCTURE & SÉCURITÉ — TousLesMatchs

## Stack

- **Hébergement** : VPS Hostinger KVM 2, Ubuntu 24.04, IP 89.117.63.94
- **Chemin projet** : `/opt/touslesmatchs`
- **Reverse proxy** : Caddy 2 (HTTPS auto)
- **Backend API** : Node.js 20 (Docker), port 3001 (bind 127.0.0.1)
- **Backend IA** : Python 3.12 (Concile Hermès + hermes-admin)
- **Base de données** : SQLite (`tlm.db`, `codes.db`) via `better-sqlite3`
- **Paiements** : Stripe (checkout + webhook)
- **Emails** : Brevo API
- **Bots** : Telegram (3 canaux : gratuit, premium, admin)

## Docker Compose — 4 services

| Service | Image | Rôle |
|---|---|---|
| `site` | caddy:2-alpine | Sert `/public` en HTTPS |
| `api` | node:20-alpine | Endpoints REST |
| `council` | python:3.12-slim | Concile Hermès (scheduler 11h59 Paris) |
| `hermes-admin` | python:3.12-slim | Bot admin Telegram |

**Web root inviolable** : `/opt/touslesmatchs/public` → `/srv`.
Ne JAMAIS remettre `site/` (bug fragmentation juillet 2026, cf. `VERSION_LOCK.md`).

## GitHub

- Repo : `Gregus77/touslesmatchs-site`
- Branche de dev active : `claude/touslesmatchs-smoke-test-7hlgum`
- Branche `main` : verrouillée, seuls les merges validés y arrivent

## Bases de données

### `tlm.db`
Tables : `picks`, `premium_picks`, `agent_predictions`,
`agent_market_predictions`, `concile_analyses`, `shadow_evals`, `page_views`.

### `codes.db`
Tables : `users`, `codes`, `user_tokens`, `revealed_analyses`,
`user_bankroll`, `user_bets`, `chat_messages`.

**Chemin sur VPS** : `/opt/touslesmatchs/data/` (bind-mount Docker).
**Ne jamais utiliser un volume nommé Docker** (bug juillet 2026 → 445 analyses perdues).

## Backups

- Cron : 3x par jour (`/opt/touslesmatchs/backups/`)
- Boot snapshot dans `api_server.js` : `bootSnapshot()` copie avant migration
- Backups manuels via `scripts/deploy.sh`
- Restauration : `cp /opt/touslesmatchs/backups/<date>/*.db /opt/touslesmatchs/data/`

## Sécurité

### Rotation régulière (tous les 90 jours)
- [ ] Stripe `sk_live`
- [ ] Mistral API key
- [ ] Telegram bot tokens (3 : main + premium + admin)
- [ ] API-Football key
- [ ] Groq / DeepSeek / Google / OpenAI

### Rotation immédiate si compromis
- Codes admin (`ELITE-ADMIN*`) — via bloc SQL `docker exec touslesmatchs-api node -e '...'`

### Headers Caddy (à durcir)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' *.googleapis.com *.gstatic.com
Referrer-Policy: strict-origin-when-cross-origin
```

### Rate limiting (à implémenter)
- `/analyse`, `/live-ia/analyse`, `/concile-analysis` : 20 req/min/IP
- `/create-checkout-session` : 5 req/min/IP
- Endpoints admin : 100 req/min/IP (déjà auth)

### Anonymat fondateur
Aucun endpoint, aucune page, aucun log ne doit exposer :
- Nom / prénom
- Photo / voix
- Adresse postale / téléphone

## Déploiement

**Commande unique** (VPS) :
```bash
bash /opt/touslesmatchs/scripts/deploy.sh
```

Ce script :
1. Pull la branche assignée
2. Rebuild Docker images
3. Redémarre `site`
4. Vérifie API + poids des pages statiques

## Monitoring

- Logs API : `docker logs touslesmatchs-api --tail 100`
- Logs Concile : `docker logs touslesmatchs-council --tail 100`
- Endpoint santé : `curl http://localhost:3001/current-pick`
- Data integrity watchdog dans `api_server.js` → alerte admin Telegram si perte >20%

## Protection contre retour à une ancienne version

1. `VERSION_LOCK.md` à la racine — contrat lisible par toute IA
2. Reference dans `CLAUDE.md` (lu à chaque session)
3. `PROJECT_STATE.md` — commit stable actuel toujours à jour
4. Snapshots avant toute migration lourde

**Toute IA qui tente `git reset --hard` vers un commit antérieur au verrou
doit s'auto-refuser et remonter au fondateur.**

## Restauration d'urgence

```bash
# 1. Restaurer le code stable
cd /opt/touslesmatchs
git fetch origin
git reset --hard <commit-stable>   # cf. PROJECT_STATE.md pour la liste

# 2. Restaurer les bases si besoin
cp /opt/touslesmatchs/backups/<date>/tlm.db /opt/touslesmatchs/data/
cp /opt/touslesmatchs/backups/<date>/codes.db /opt/touslesmatchs/data/

# 3. Redéployer
bash scripts/deploy.sh
```

---

*Ce document est le manuel opérationnel. Toute modification d'infra doit
y être répercutée immédiatement.*
