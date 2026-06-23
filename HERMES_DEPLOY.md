# INSTRUCTIONS DE DÉPLOIEMENT — TousLesMatchs.com
# Branche : claude/happy-bell-h9zj83
# Date : 2026-06-23

---

## CE QUI A ÉTÉ DÉVELOPPÉ

Deux fonctionnalités majeures ont été ajoutées au site TousLesMatchs.com :

### 1. PAGE LIVE IA (nouvelle page `/live-ia`)
Une page premium avec système de jetons qui permet aux abonnés d'obtenir l'analyse
du Concile (5 IA) sur chaque match en direct.

**Fonctionnement :**
- L'utilisateur voit la liste de tous les matchs en cours (score, minute, compétition)
- Le résultat de l'analyse est masqué par défaut
- Cliquer "Révéler le Concile" coûte 1 jeton et affiche :
  - Le meilleur pari selon le Concile (ex: "Over 2.5", "BTTS Oui", "Victoire domicile"...)
  - Le pourcentage de confiance (ex: 78%)
  - 2 lignes d'explication
  - Le vote détaillé de chacun des 5 agents IA avec leur raisonnement

**Quotas de jetons (remis à zéro chaque jour à minuit) :**
- Abonnement Premium (9,90€/mois) → 10 jetons/jour
- Abonnement VIP (19,90€/mois) → 30 jetons/jour
- Abonnement Elite (29,90€/mois) → illimité
- Compte gratuit → 0 jeton (page de présentation avec incitation à s'abonner)

**Fichiers ajoutés/modifiés :**
- `src/LiveIA.js` — composant React de la page (nouveau fichier)
- `src/App.js` — ajout de la route + lien "🔮 Live IA" dans la navigation
- `src/Login.js` — sauvegarde du token JWT dans localStorage après connexion
- `scripts/api_server.js` — serveur Express complet (nouveau fichier)
- `Dockerfile.api` — container Docker pour l'API (nouveau fichier)
- `docker-compose.yml` — volume persistant `/data/tlm.db` + variables JWT/Stripe webhook

### 2. PAGE BOOKMAKERS — refaite
- Retrait de ZEbet, ParionsSport, NetBet (pas de codes d'affiliation)
- 4 bookmakers avec vrais liens affiliés : Winamax, Betclic, Unibet, PMU
- Affichage des promos du moment avec badge "🎁 OFFRE DU MOMENT"
- Boutons CTA colorés bien visibles avec `rel="sponsored"`
- Section homepage également mise à jour

---

## CE QUE TU DOIS FAIRE, HERMÈS

### ÉTAPE 1 — Récupérer le code

```bash
cd /opt/touslesmatchs
git fetch origin
git checkout claude/happy-bell-h9zj83
git reset --hard origin/claude/happy-bell-h9zj83
```

### ÉTAPE 2 — Vérifier le fichier .env

Le fichier `/opt/touslesmatchs/.env` doit contenir ces variables (en plus des existantes).
Ajoute celles qui manquent :

```env
# Déjà présentes normalement :
GROQ_API_KEY=...
FOOTBALL_DATA_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_PRICE_ID_PREMIUM=...
STRIPE_PRICE_ID_VIP=...
STRIPE_PRICE_ID_ELITE=...

# NOUVELLES — à ajouter obligatoirement :
JWT_SECRET=tlm_jwt_secret_prod_2026_change_moi
STRIPE_WEBHOOK_SECRET=whsec_...
```

Pour `JWT_SECRET` : génère une chaîne aléatoire longue, ex:
```bash
openssl rand -hex 32
```

Pour `STRIPE_WEBHOOK_SECRET` : récupère-le dans le dashboard Stripe →
Developers → Webhooks → ton endpoint → "Signing secret".
Si tu n'as pas encore configuré le webhook Stripe, l'API fonctionne quand même
(l'activation des abonnements se fera manuellement en attendant).

### ÉTAPE 3 — Rebuilder et redémarrer les containers

```bash
cd /opt/touslesmatchs
docker-compose down
docker-compose up -d --build
```

Si tu veux rebuilder uniquement les containers modifiés (plus rapide) :
```bash
docker-compose up -d --build site api
```

### ÉTAPE 4 — Vérifier que tout fonctionne

```bash
# Vérifier que les containers sont bien UP
docker-compose ps

# Vérifier les logs de l'API
docker-compose logs api --tail=30

# Test rapide de l'API
curl https://www.touslesmatchs.com/api/health
# Doit répondre : {"ok":true}

# Test des matchs live
curl https://www.touslesmatchs.com/api/live-matches
# Doit répondre : {"ok":true,"matches":[...]}
```

### ÉTAPE 5 — Configurer le webhook Stripe (optionnel mais recommandé)

Dans le dashboard Stripe → Developers → Webhooks → "Add endpoint" :
- URL : `https://www.touslesmatchs.com/api/stripe/webhook`
- Events à écouter : `checkout.session.completed`, `customer.subscription.deleted`
- Copier le "Signing secret" dans le `.env` comme `STRIPE_WEBHOOK_SECRET`
- `docker-compose restart api`

---

## ARCHITECTURE TECHNIQUE

```
Utilisateur
    ↓
Caddy (HTTPS, reverse proxy)
    ├─ /           → Site React (container site:80)
    └─ /api/*      → API Express (container api:3001)
                         ↓
                   SQLite /data/tlm.db (volume api_data)
                         ↓
                   Groq API (analyse Concile)
                         ↓
                   Football-data.org (matchs live)
```

**Base de données SQLite (créée automatiquement au démarrage) :**
- `users` : email, password_hash, status (free/premium/vip/elite), stripe_ids
- `user_tokens` : tokens_today, reset_date (par user)
- `revealed_analyses` : cache des analyses déjà révélées (pas de double déduction)

**Endpoints API principaux :**
- `POST /api/auth/register` → inscription
- `POST /api/auth/login` → connexion (retourne JWT)
- `GET  /api/user/tokens` → tokens restants (authentifié)
- `GET  /api/live-matches` → matchs en direct
- `POST /api/live-ia/analyse` → analyse Concile (coûte 1 jeton, authentifié)
- `POST /api/stripe/create-checkout` → session paiement Stripe
- `POST /api/stripe/webhook` → activation abonnement après paiement

---

## EN CAS DE PROBLÈME

**L'API ne démarre pas :**
```bash
docker-compose logs api
# Vérifier que JWT_SECRET est bien dans le .env
```

**"Erreur serveur" à la connexion :**
```bash
# Vérifier que le volume api_data est bien monté
docker volume inspect touslesmatchs_api_data
```

**Matchs live ne s'affichent pas (des matchs démo apparaissent) :**
- Normal si FOOTBALL_DATA_KEY est absent ou si aucun match n'est en cours
- Les 4 matchs démo (PSG/OM, Real/Barça, etc.) apparaissent automatiquement en fallback

**Les analyses Concile ne fonctionnent pas :**
- Vérifier que GROQ_API_KEY est présente dans le .env
- En cas d'absence, des analyses simulées sont générées automatiquement

---

## RÉSUMÉ EN UNE LIGNE

```bash
cd /opt/touslesmatchs && git fetch origin claude/happy-bell-h9zj83 && git reset --hard origin/claude/happy-bell-h9zj83 && docker compose up -d --build site api hermes-admin
```
