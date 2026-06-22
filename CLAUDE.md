# TousLesMatchs — Mémoire partagée des IAs

> Ce fichier est lu automatiquement par Claude Code et GPT Codex à chaque session.
> Chaque IA met à jour sa section après chaque modification importante.
> Le propriétaire : Grégory. Les IAs travaillent en parallèle sans se marcher dessus.

---

## RÈGLES ABSOLUES (les deux IAs respectent)

- **Branche Git : `claude/happy-bell-h9zj83` UNIQUEMENT**
- Jamais `git add -A` (risque de committer `.env`)
- Toujours `node --check scripts/api_server.js` avant commit JS
- Jamais `docker compose up -d --build` sans préciser : `site`, `api`, ou `hermes-admin`
- Commit après chaque tâche qui fonctionne
- **NE PAS modifier un fichier qu'une autre IA est en train de travailler** (voir section Ownership)

---

## OWNERSHIP — QUI TOUCHE QUOI

| Fichier | Responsable | Statut |
|---|---|---|
| `scripts/api_server.js` | **Partagé** — coordonner avant modification | ⚠️ |
| `scripts/hermes_admin_bot.js` | **Codex prioritaire** — communication Hermès | 🔧 |
| `public/index.html` | **Claude Code** — design + Concile frontend | ✅ |
| `public/live-ia.html` | **Claude Code** | ✅ |
| `public/historique.html` | **Codex prioritaire** — connecter aux vrais picks | 🔧 |
| `public/preuves.html` | Claude Code | ✅ |
| `.claude/` | Claude Code uniquement | ✅ |

---

## INFRASTRUCTURE VPS

- **IP** : 72.61.167.175 — `/opt/touslesmatchs/`
- **Services Docker** : `site` (Caddy), `api` (Node.js), `hermes-admin` (Telegram bot)
- **Données** : `/var/touslesmatchs/` — picks.json, SQLite, scores

**Déployer :**
```bash
cd /opt/touslesmatchs
git fetch origin claude/happy-bell-h9zj83
git reset --hard origin/claude/happy-bell-h9zj83
docker compose up -d --build [site|api|hermes-admin]
```

---

## VARIABLES .env (VPS — ne jamais committer)

```
FOOTBALL_DATA_KEY=ca91921718f344158fcfcb10fd126ccf
API_SPORTS_KEY=e5ab4f74d968a143c2a47630dff3edd0
GROQ_API_KEY=[configuré]
BREVO_API_KEY=[configuré]
TELEGRAM_BOT_TOKEN=[configuré]
STRIPE_SECRET_KEY=⚠️ MANQUANT
STRIPE_PRICE_ID_PREMIUM=⚠️ MANQUANT
STRIPE_PRICE_ID_VIP=⚠️ MANQUANT
STRIPE_PRICE_ID_ELITE=⚠️ MANQUANT
```

---

## ÉTAT ACTUEL DU PROJET

### ✅ Ce qui fonctionne
- Site design + navigation
- Concile IA (5 agents, stats live, contraintes math, terrain neutre)
- Auth codes (vérification, remember me)
- API live matches (football-data.org + api-sports.io)
- Rate limiter Concile (3 req/min/IP)
- Stats live injectées dans les prompts Groq

### ❌ Ce qui est cassé / incomplet

**PRIORITÉ 1 — Hermès ↔ Backend (Codex)**
- La chaîne `Hermès → picks.json → /current-pick → frontend` n'est pas fiable
- Le pick n'apparaît pas toujours sur le site après publication Hermès
- Pas de test end-to-end validé

**PRIORITÉ 2 — Stripe / Paiements (Codex)**
- Clés Stripe absentes du `.env` VPS
- Flow complet à câbler : paiement → création code → email Brevo → accès premium
- Sans ça, zéro revenu possible

**PRIORITÉ 3 — Légal (obligatoire avant paiements)**
- `public/mentions-legales.html` inexistant (CGV + politique confidentialité RGPD)
- Lien dans le footer de toutes les pages

**PRIORITÉ 4 — Historique picks (Codex)**
- `public/historique.html` — données hardcodées, pas connecté aux vrais picks

**PRIORITÉ 5 — Expiration abonnements (Hermès)**
- Hermès doit envoyer email J-7 et J-1 avant expiration d'un code

---

## ARCHITECTURE — FLUX PICKS

```
Grégory tape /pick dans Telegram
    → Hermès demande les infos
    → Hermès écrit /var/touslesmatchs/picks.json
        → GET /current-pick lit picks.json
            → frontend index.html affiche le pick
```

**Format picks.json attendu :**
```json
{
  "currentPick": {
    "home": "France",
    "away": "Brésil",
    "date": "2026-06-22",
    "time": "21:00",
    "league": "Coupe du Monde 2026",
    "bet": "1X",
    "prono": "Double chance France ou Nul",
    "cote": "1.52",
    "status": "upcoming",
    "score": null
  }
}
```

**Statuts** : `"upcoming"` → `"GAGNE"` ou `"PERDU"` (après résolution)

---

## ARCHITECTURE — CONCILE IA

```
Match en cours (score + minute + stats live)
    → 4 agents llama-3.1-8b-instant (Groq)
    → 1 Claude Chief llama-3.3-70b-versatile
    → Verdict + confiance + raison
```

**Limites Groq (gratuit)** : 100k tokens/jour (~40 analyses). Reset minuit UTC.

---

## PLANS D'ABONNEMENT

| Plan | Accès |
|---|---|
| `free` | Picks publics uniquement |
| `premium` | Concile Live + historique |
| `elite` | Tout + analyses avancées |
| `admin` | Accès total |

---

## LOG DES MODIFICATIONS RÉCENTES

### Claude Code — 2026-06-22
- Fix Concile terrain neutre : "Victoire domicile" → "Victoire [équipe]" pour Coupe du Monde
- Fix Over 2.5 : retiré si projection < 2.0 buts après 45'
- Fix Chief : max_tokens 200→400, fallback raison si réponse vide
- Stats live api-sports.io injectées dans les prompts
- Rate limiter 3 req/min/IP sur /analyse
- Turquie/Paraguay corrigé : 0-1 loss (plus de données hardcodées)
- DEFAULT_PICK supprimé de api_server.js

### À faire pour Codex
- [ ] Déboguer et fiabiliser la chaîne Hermès → picks.json → frontend
- [ ] Câbler Stripe complet (paiement → code → email)
- [ ] Connecter historique.html aux vrais picks
- [ ] Rappels expiration abonnement dans Hermès

---

## GITHUB

- **Repo** : `Gregus77/touslesmatchs-site`
- **Branche** : `claude/happy-bell-h9zj83`
- Ne jamais pousser sur `main` sans permission de Grégory
