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
- Concile IA (4 agents specialises + 1 Chief, stats live, contraintes math, terrain neutre)
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

### Claude Code — 2026-06-29 — Concile v3 + Growth Engine
- Concile v3 : 4 familles IA vraiment différentes (Perplexity/web, DeepSeek/contrarian, Mistral/MoE, Cohere/RAG) + Chief Groq
- Shadow eval : 5 IAs testées en parallèle pendant 15 jours (table `shadow_evals`)
- Pinned signals : match épinglé 90 min quand signal fort Telegram → plus de match invisible
- Lien Telegram avec ?match= param pour auto-scroll vers le match épinglé
- Tracking complet des pronos : sport, pays, championnat, type de pari, confiance, matrice agent×bet
- Hero redesigné : email capture visible sans scroll, titre clair "analysé par 4 IAs"
- Tunnel conversion : Telegram gratuit masque maintenant le pari (→ CTA Pro/Elite)
- Séquence email nurturing J+1 (preuve) + J+3 (urgence) automatique après inscription
- Skills créés : `/pilote` (orchestrateur autonome), `/growth-engine` (croissance Stripe)

### Claude Code — 2026-06-30 — Stripe, résolution permanente, multi-marchés, banc d'essai, acquisition
- **Stripe webhook FIX CRITIQUE** : `express.json()` global cassait la vérif de signature → le client payait mais ne recevait jamais son code/email. `/stripe/webhook` exclu du parser JSON global (corps brut conservé). ⚠️ Reste à faire côté Grégory : déclarer le webhook dans Stripe + `STRIPE_WEBHOOK_SECRET` dans .env + révoquer la clé sk_live exposée en chat.
- **Résolution permanente prédictions IA** : cron `resolveStalePredictions` (horaire + 30s au boot) rattrape les matchs sortis de la fenêtre live (football-data 7j). `autoResolvePredictions` utilise `getBetOutcomeForScore` (robuste). Route admin `/admin/resolve-stale`. Fini les "en attente" infinis.
- **Multi-marchés par IA** : chaque agent (hors Chief) donne son avis sur 6 marchés (O/U 2.5, BTTS, 1X2, but 1re MT) → table `agent_market_predictions` (séparée du Concile). Endpoint `/agent-market-matrix` (winrate IA × marché + meilleure IA par marché). max_tokens agents 200→300. Mode économe.
- **Banc d'essai** : +2 IA gratuites immédiates Groq-Llama70B/8B (clé Groq existante). Cerebras/OpenRouter/Mistral/Cohere s'activent dès qu'une clé est dans .env.
- **Page admin** (`admin.html`) : sections visuelles Banc d'essai + Matrice IA × marché (plus besoin de curl).
- **Splash premium** animé au chargement (anneau gradient + filet sécurité 3s).
- **Leaderboard live-ia** : "X en attente" → "Analyse en cours…", badge nettoyé, + chips marchés avec winrate sous chaque IA. Reste admin-only (code ELITE-ADMIN).
- **Drapeaux Telegram** (teamFlag/matchWithFlags) sur tous les messages picks.
- **Image OpenAI** : pause propre 6h quand quota atteint (1 seul message, fallback blason), fini le spam d'erreur.
- **SEO** : JSON-LD @graph (Organization+WebSite+FAQPage) sur index, pourquoi-nous indexable (canonical+OG+sitemap).
- **Acquisition** : lien Telegram mort corrigé sur la landing TikTok (t.me/touslesmatchs_fr → t.me/+qFnIuKg2ZhdlMmY8).
- **Cohérence** : "4+1 · Agents + Chief" partout (le titre dit 4, la stat disait 5).
- Audit front↔back : toutes les routes `/api/*` ont leur handler serveur, zéro orpheline.

### Claude Code — 2026-06-29 (soir) — UX/SEO/Hermès + auto-résolution réelle
- **Splash premium** : overlay animé (anneau gradient + wordmark + barre) remplace le logo TLM brut au chargement. Filet de sécurité 3s → ne reste jamais bloqué (fix bug Android "logo puis erreur").
- **Fix crash Android** : ordre de chargement i18n.js corrigé (était chargé après le script qui l'utilise → ReferenceError bloquant) + try/catch de secours.
- **Gemini retiré partout** : démo Live IA, leaderboard, SHADOW_AGENTS, getMockAnalysis. ⚠️ Le site PROD affiche encore Gemini tant que le VPS n'est pas redéployé.
- **Leaderboard IA robuste** : se construit depuis les agents réellement en base (clés agentPerfData) au lieu d'une liste figée → un renommage d'agent ne fait plus disparaître l'historique (ex: Mistral-7B).
- **Drapeaux équipes Telegram** : teamFlag()/matchWithFlags() — "🇩🇪 Germany vs 🇵🇾 Paraguay". ~70 pays FR+EN, ⚽ pour les clubs.
- **Auto-résolution résultats** : maybeAutoCheckResult → cmdCheckResult(chatId, autoApply=true) applique cmdResult() automatiquement quand le résultat est déductible. Plus besoin de /win /lose manuel chaque jour.
- **Fix classification paris** : "Moins de 2.5 buts" était mal classé (contient "2" → match marché victoire extérieur). Ordre regex corrigé : over/under/btts/double-chance avant 1X2.
- **SEO index.html** : JSON-LD @graph (Organization + WebSite + FAQPage rich results) + meta robots/theme-color/og:site_name/og:locale.
- Brésil/Japon 29/06 (Moins 2.5, 2-1) ajouté PERDU dans picks.json + index + historique. Stats 12W/2L 86%.

### 🔴 BLOQUANT N°1 POUR LES PREMIÈRES VENTES (Grégory doit agir sur le VPS)
Le tunnel (capture email, nurturing, masquage pari, CTA, SEO) est prêt, MAIS aucun
paiement n'est possible sans les clés Stripe dans `/opt/touslesmatchs/.env` :
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID_PREMIUM=price_...
STRIPE_PRICE_ID_VIP=price_...
STRIPE_PRICE_ID_ELITE=price_...
```
Sans ça : trafic + inscriptions possibles, mais 0€ encaissé. C'est LE point à débloquer pour la première vente.

### Claude Code — 2026-06-29 (nuit) — Hermès amélioré + SEO + Auto-résolution
- `/preview` : prévisualiser pick gratuit + premium avant publication (texte exact)
- `/checkresult` : vérifier score final via football-data.org + api-sports.io, déduit WIN/LOSE
- `/expiring` : liste abonnés expirant dans 7j (via /internal/expiring-codes sécurisé)
- Auto-check résultat : Hermès vérifie le score toutes les 60 min après fin probable du match
- SEO : preuves.html og tags + canonical www · mentions-legales canonical + noindex
- docker-compose : passe STRIPE_PRICE_PRO/VIP/ELITE dans l'env api (correction fallback Stripe)
- Route /internal/expiring-codes dans api_server.js (auth interne par token Hermès)

### BLOQUANTS STRIPE (Grégory doit agir sur le VPS)
```bash
# Sur le VPS — clés à ajouter dans /opt/touslesmatchs/.env
STRIPE_SECRET_KEY=sk_live_...         # ← CRITIQUE — sans ça 0 vente
STRIPE_PRICE_ID_PREMIUM=price_...
STRIPE_PRICE_ID_VIP=price_...
STRIPE_PRICE_ID_ELITE=price_...
PERPLEXITY_API_KEY=pplx-...           # Pour Concile v3 (agent web search)
```

### À faire pour Codex
- [ ] Déboguer et fiabiliser la chaîne Hermès → picks.json → frontend
- [ ] Câbler Stripe complet (paiement → code → email)
- [ ] Connecter historique.html aux vrais picks
- [ ] Rappels expiration abonnement dans Hermès

---

### Codex - 2026-06-23 audit confiance publique
- Ne pas remettre de chiffre Telegram invente (`1 200+`, etc.). Si l'API ne donne pas de valeur fiable, afficher "Communaute en lancement".
- Ne pas remettre "Tu encaisses" ou "Preuves de gains" dans les textes publics. Preferer analyse, donnees verifiees, preuves de resultats.
- Ne pas afficher `React App` : title, manifest, meta SEO et sitemap doivent rester marques TousLesMatchs.
- Les stats publiques doivent provenir des picks termines uniquement et rester coherentes entre ticker, hero, ROI et communaute.
- Pick France vs Irak Over 2.75 gagne 3-0 ajoute a l'historique public comme resultat sportif verifie. La preuve vient d'un operateur hors ARJEL/ANJ : ne pas afficher le bookmaker, le solde, le lien ou une capture de gain en public. Garder la preuve en interne/admin uniquement.
- Ne pas afficher automatiquement les membres Telegram tant que `SHOW_TELEGRAM_MEMBER_COUNT=true` n'est pas volontairement active en production.
- Formulation publique du Concile : dire "4 agents IA specialises + 1 Chief" plutot que laisser croire que 5 IA produisent toutes un rapport complet. Le public voit consensus, signaux cles, objections et verdict; les prompts, rapports complets et arbitrages internes restent proprietaires.
- Le Chief doit arbitrer les desaccords, expliquer pourquoi une objection minoritaire est acceptee ou rejetee, et adapter la grille au sport (football, basket, hockey, baseball) si les donnees live sont fiables.
- Claude Chief reste arbitre final, mais il doit etre assiste par le role interne "GPT-Codex Challenger" avant chaque verdict: tester plusieurs marches alternatifs (BTTS, double chance, over/under, vainqueur/nul), contredire l'intuition dominante, verifier le contexte risque (domicile/exterieur, enjeu, amical/officiel, blessures seulement si source fiable) et ne jamais inventer une donnee manquante.

---

## GITHUB

- **Repo** : `Gregus77/touslesmatchs-site`
- **Branche** : `claude/happy-bell-h9zj83`
- Ne jamais pousser sur `main` sans permission de Grégory
