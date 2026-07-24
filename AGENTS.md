# AGENTS.md — Fichier partage entre TOUTES les IA (Claude, Codex, Hermes, GPT, etc.)
# Derniere mise a jour : 2026-07-23 par Claude

## ⚡ HANDOFF RAPIDE — POUR TOUTE IA QUI REPREND (lis d'abord ceci)

- **Repo GitHub** : `Gregus77/touslesmatchs-site`
- **Branche de dev active** : `claude/tiktok-arjel-automation-hgp1tv` (le code le PLUS a jour est ici, PAS sur main)
- **Serveur (VPS Hostinger)** : `/opt/touslesmatchs` (Ubuntu 24.04)
- **Ce fichier + `CHANGELOG.md`** = la source de verite. Lis les 2 avant de coder.

**A PRESERVER ABSOLUMENT (ne jamais casser) :**
- **Liens bookmakers / affiliation** → `scripts/bookmakers.config.js` (+ variables `.env` : WINAMAX_LINK, UNIBET_LINK, PMU_LINK). **Betclic a ete retire volontairement.** Bookmakers actifs : Winamax, Unibet, PMU.
- **Endpoints API** → voir la table ci-dessous (routes exactes, ne pas renommer).
- **Cles API / tokens** → uniquement dans `.env` sur le serveur, JAMAIS dans le code ni les commits.
- **Stripe, Telegram, Brevo, Concile** → voir "Ce qui ne doit JAMAIS casser".

**Procedure de deploiement (IMPORTANT — pieges connus)** : voir section "Deploiement" en bas.

## REGLE ABSOLUE : NE RIEN CASSER

Avant de modifier quoi que ce soit, lis ce fichier EN ENTIER.
Chaque IA qui travaille sur ce projet DOIT :
1. Lire ce fichier avant toute modification
2. Ne JAMAIS ecraser le travail d'une autre IA sans accord explicite du fondateur
3. Commiter sur sa branche assignee, JAMAIS sur main
4. Verifier que les 4 services Docker restent coherents apres chaque changement

## Architecture du projet

### Stack : Docker Compose (4 services)
| Service | Techno | Role | Port |
|---------|--------|------|------|
| `site` | Caddy | Sert les fichiers statiques `/public` | 80, 443 |
| `api` | Node.js | API principale (TOUT est dans `scripts/api_server.js`) | 3001 (local) |
| `council` | Python | Concile Hermes — 4 agents IA + Claude Chief, scheduler 11h59 Paris | interne |
| `hermes-admin` | Python | Bot admin Telegram | interne |

### Hebergement
- VPS Hostinger KVM 2, Ubuntu 24.04
- Repertoire : `/opt/touslesmatchs`
- Deploiement : `cd /opt/touslesmatchs && git pull origin <branche> && docker compose up -d --build`

## Fichiers critiques — ne pas modifier sans comprendre

| Fichier | Role | Risque si casse |
|---------|------|-----------------|
| `scripts/api_server.js` | API Node.js — Concile JS, Stripe, Telegram, Brevo, Signal Fort, Live IA, analytics, auto-concile | TOUT le site tombe |
| `public/index.html` | Page d'accueil unique (SPA-like) | Site inaccessible |
| `public/live-ia.html` | Page Live IA avec onglets En direct / Statistiques | Fonctionnalite premium cassee |
| `council/hermes.py` | Orchestrateur du Concile Python | Plus de pick quotidien |
| `council/agents/` | 4 agents IA + claude_chief | Concile casse |
| `council/tools/history_db.py` | SQLite : picks, analyses, votes | Perte de donnees |
| `docker-compose.yml` | Orchestration des 4 services | Tout tombe |
| `Caddyfile` | Reverse proxy, routes API, HTTPS | Site inaccessible |

## Endpoints API (ne pas changer les routes)

| Route | Methode | Role |
|-------|---------|------|
| `/current-pick` | GET | Pick du jour |
| `/live-matches` | GET | Matchs en direct |
| `/signal-fort-stats` | GET | Stats Signal Fort |
| `/api/analysis-history` | GET | Historique analyses (pagine) |
| `/api/concile-analysis` | POST | Lancer une analyse Live IA |
| `/api/verify-code` | POST | Verifier un code d'acces |
| `/create-checkout-session` | POST | Checkout Stripe |
| `/webhook` | POST | Webhook Stripe |
| `/t` | GET | Pixel tracking visiteurs |
| `/admin/analytics-report` | GET | Rapport analytics |
| `/auth/register` `/auth/login` `/auth/me` | POST/GET | Comptes gratuits (dashboard.html) |
| `/user/history` | GET | Historique perso d'un compte |
| `/api/council-vote` | GET | Votes anonymises (panneau Hero "Le Conseil delibere") |
| `/api/live-activity` | GET | Compteurs live reels (bandeau Hero) |
| `/api/tier-stats` | GET | Stats par palier Standard/Premium/Elite/VIP |
| `/api/tier-signals` | GET | Volumes du jour par palier (public, sans devoiler les analyses payantes) |
| `/internal/tier-signals/preview` | POST | Preview interne Hermes des candidats Standard/Premium/Elite/VIP |
| `/internal/tier-signals/send` | POST | Envoi interne Hermes des signaux par palier (dryRun par defaut) |
| `/signaux-sportifs-ia` | GET | Page SEO organique Standard/Premium/Elite-VIP |
| `/pronostics` | GET | Page SEO index (HTML) |
| `/pronostic/:slug` | GET | Page SEO detail par match (HTML) |
| `/sitemap-pronostics.xml` | GET | Sitemap dynamique des pronostics |

> Note routage Caddy : le front appelle `/api/xxx` ; Caddy strippe `/api` → le serveur definit la route `/xxx`. Les pages SEO (`/pronostics`, `/pronostic/*`, `/sitemap-pronostics.xml`) ont des `handle` dedies dans le `Caddyfile`.

## Regles metier OBLIGATOIRES

### ANJ (Autorite Nationale des Jeux) — LEGAL
- JAMAIS le mot "pari" dans le contenu public (site, emails, Telegram)
- Utiliser : "analyse IA", "pick", "selection", "recommandation"
- Toujours afficher le disclaimer joueurs-info-service.fr
- Ne jamais garantir de gains
- Ne jamais falsifier de statistiques

### Anonymat du fondateur — OBLIGATOIRE
Ne JAMAIS creer de fonctionnalite qui expose le nom, prenom, photo, voix, adresse ou telephone du fondateur. La marque communique, pas le fondateur.

### Securite — OBLIGATOIRE
- Ne JAMAIS afficher, loguer ou commiter des cles API / tokens / .env
- Ne JAMAIS inclure de credentials dans le code source

### Tunnel de vente (ne JAMAIS complexifier)
```
TikTok -> TousLesMatchs.com -> Standard -> Premium -> Elite/VIP
```

### Analyses sportives
- Default : Under 2.5 (moins de 2.5 buts)
- Coupe du Monde exclue de toutes les analyses
- Filtrage : LOW_TRUST d'abord (bloque), puis TRUSTED (passe), default = bloque
- Cotes : `Math.min(1.95, ((1 / (confidence / 100)) * 1.45))`, jamais > 1.95
- Signal Fort : confiance >= 80%
- Multi-sport : Football, Basketball, Hockey, Baseball, Tennis
- Seuil vitrine : PUBLISHED_MIN_CONFIDENCE = 82 (regle par le fondateur)

### Comptes speciaux actifs
- LaMatrice (lamatrice2012@gmail.com) : Elite, 30 analyses/jour, expire ~19 sept 2026

## Ce qui ne doit JAMAIS casser

- Stripe (paiements, webhooks)
- Telegram (bots, groupes Standard/Premium/Elite/VIP)
- Hermes / Concile IA
- Live IA (analyse en direct + onglet Statistiques)
- Brevo (emails, nurturing)
- Analytics (tracking, rapports)
- Responsive mobile
- SEO
- Compteur de jetons sur Live IA

## Fonctions cles dans api_server.js

| Fonction | Role | Attention |
|----------|------|-----------|
| `isLowTrustCompetition()` | Filtre ligues douteuses | Ordre : LOW_TRUST, TRUSTED, default=bloque |
| `isExcludedFromPicks()` | Filtre strict pour le pick quotidien | Exclut qualifs UEFA + low-trust |
| `isNoiseForDisplay()` | Filtre leger pour la vitrine | Jeunes/feminines + perdants prouves uniquement |
| `isUefaQualifier()` | Detecte les qualifs UEFA (juillet/aout) | Ne pas toucher |
| `shouldAutoObserveMatch()` | Match merite auto-concile ? | Analyses tout pour le volume |
| `runAutoConcile()` | Lance un concile JS en temps reel | Coeur du Live IA |
| `resolveStalePredictions()` | Resout les analyses en attente | Gestion quota API-Sports |
| `NORM()` | Normalise accents (NFD) | Critique pour la resolution |
| `matchToken()` | Extrait le mot distinctif d'un nom d'equipe | Evite les faux positifs FC/AC |
| `refreshDailyPickFromDB()` | Charge le pick du jour depuis SQLite | Utilise isExcludedFromPicks |
| `PUBLISHED_MIN_CONFIDENCE` | Seuil 82/100 pour la vitrine | Regle par le fondateur |
| `rowOdd()` | Vraie cote ARJEL stockee sinon estimation marche | Utiliser partout, PAS l'ancienne formule fake |
| `computeBestOdd()` / `fetchRealOdds()` | Vraies cotes API-Sports /odds | Cotes reelles bookmakers |
| `markSignalSent()` | Trace sig_sent_standard / sig_sent_premium / sig_sent_elite (sig_sent_free legacy) | Resultat Telegram poste QUE sur groupes ayant recu le pick |
| `seoPages` (IIFE inline) | Rendu des pages SEO pronostics | Inline dans api_server.js (pas de module externe) |
| `rowIsArjel()` / `tierStatsFor()` | Stats par palier | Standard>=88 ARJEL, Premium>=85 ARJEL, Elite>=82 tout |

## Bases de donnees SQLite

| Fichier | Tables principales | Chemin Docker |
|---------|--------------------|---------------|
| `tlm.db` | concile_analyses, agent_votes, signal_fort | `/data/tlm.db` |
| `codes.db` | access_codes (plan, credits_max, credits_used, credits_date) | `/data/codes.db` |

### Deduplication SQL (vitrine)
Les analyses sont dedupliquees par match/jour avec :
```sql
ROW_NUMBER() OVER (
  PARTITION BY lower(trim(home)), lower(trim(away)), date(analysed_at)
  ORDER BY (CASE WHEN outcome IN ('win','loss') THEN 1 ELSE 0 END) DESC, analysed_at DESC
) AS _rn
-- Garder WHERE _rn = 1
```

## Design
- Mobile first, premium, sobre, epure
- Pas de sections redondantes
- Les sections masquees (display:none) dans index.html sont volontairement cachees

## Priorites de developpement
Chaque dev doit repondre a AU MOINS un objectif :
1. Augmenter le chiffre d'affaires
2. Augmenter le taux de conversion
3. Ameliorer la confiance utilisateur
4. Ameliorer l'automatisation
5. Ameliorer la vitesse du site
6. Ameliorer l'experience utilisateur

Si aucun objectif n'est rempli : NE PAS developper.

## Collaboration entre IA

### Branches
- **Claude** : `claude/tiktok-arjel-automation-hgp1tv` (ou branche assignee par session)
- **Codex** : `codex/<nom-tache>` (creer une branche par tache)
- **Hermes** : `council-hermes` (ne touche que council/)
- **JAMAIS pusher sur main directement**

### Zones de responsabilite
| IA | Zone | Peut modifier |
|----|------|---------------|
| Claude | Site + API + infra | `scripts/`, `public/`, `docker-compose.yml`, `Caddyfile`, `council/` |
| Codex | Site + API (quand Claude indisponible) | `scripts/`, `public/` — NE PAS toucher `council/` sans accord |
| Hermes | Concile Python uniquement | `council/` uniquement |

### Protocole anti-conflit
1. Avant de modifier un fichier, verifier `git log --oneline -5 <fichier>` pour voir qui l'a touche recemment
2. Si une autre IA a modifie le fichier dans les 24h, lire le diff avant de modifier
3. En cas de doute, demander au fondateur
4. Toujours commiter avec un message clair indiquant QUELLE IA a fait le changement

### Format de commit recommande
```
[Claude] Description courte du changement
[Codex] Description courte du changement
[Hermes] Description courte du changement
```

## Liens bookmakers / affiliation (SENSIBLE — revenus)

- **Fichier** : `scripts/bookmakers.config.js` — utilise par emails, Telegram, et importe cote front.
- **Front** : tableau `BM` dans `public/index.html` (boutons sous l'analyse).
- **Bookmakers actifs** : **Winamax, Unibet, PMU**. **Betclic RETIRE volontairement** (le fondateur n'etait pas sur que le lien etait le sien). NE PAS le remettre sans accord.
- **Surcharge possible via .env** : `WINAMAX_LINK`, `UNIBET_LINK`, `PMU_LINK`.
- `ARJEL_BOOKMAKERS` (dans api_server.js) sert au MATCHING des cotes reelles — garder "betclic" dedans est OK (c'est pour lire la cote, pas pour afficher un lien).

## Stripe — gamme publique 2026-07-24

- Offre publique : **Standard 4,90€ / mois / Premium 14,90€ / mois / Elite-VIP 29,90€ / mois**.
- `STRIPE_PRICE_ID_STANDARD` doit pointer vers le produit Stripe Standard 4,90€ / mois.
- `STRIPE_PRICE_ID_PREMIUM` doit pointer vers le produit Stripe Premium 14,90€ / mois.
- `STRIPE_PRICE_ID_ELITE` / `STRIPE_PRICE_ID_VIP` doivent pointer vers les niveaux hauts 29,90€ / mois.
- Liens Payment Links publics branches en fallback front :
  - Standard : `https://buy.stripe.com/00w14ncbGgo48c4fpA3VC05`
  - Premium : `https://buy.stripe.com/6oU3cvdfK4Fm0JC1yK3VC06`
  - Elite/VIP : `https://buy.stripe.com/4gM9AT5Nifk0gIA91c3VC07`
- L'ancien 1 euro et les anciens libelles gratuits ne doivent plus etre mis en avant sur l'accueil.

## Systeme de paliers (Standard / Premium / Elite)

Idee "signaux par palier" (comme le trading). Definition HYBRIDE (rang par confiance, contenu par ARJEL) :
- **Standard** = ARJEL & confiance >= 88 (fleurons, faible volume)
- **Premium** = ARJEL & confiance >= 90 (inclut Standard, jusqu'a 10/jour)
- **Elite** = ARJEL & confiance >= 90 (football/basketball/hockey/baseball, jusqu'a 30/jour)

Etape 1 FAITE : endpoint `/tier-stats` + section site "#paliers" (3 onglets).
Etape 2 EN COURS : moteur `/tier-signals` + routes internes Hermes pour Standard/Premium/Elite/VIP.
Etape 3 (a faire, ZONE HERMES) : scheduler Telegram par palier + recap quotidien — A COORDONNER.

Regles moteur signaux (2026-07-24) :
- Standard = 3 signaux max/jour, confiance >= 88, cote reelle ARJEL >= 1.50.
- Premium = 10 signaux max/jour, confiance >= 90, avant-match ou live, cote reelle ARJEL >= 1.50.
- Elite = 30 signaux max/jour, confiance >= 90, football/basketball/hockey/baseball, cote reelle ARJEL >= 1.50.
- Ne jamais forcer le volume : si la journee ne produit que 7 bons signaux Premium, envoyer 7.
- Envoi automatique des paliers desactive par defaut ; activer seulement avec `TIER_SIGNALS_AUTO_SEND=1` apres verification des canaux `TELEGRAM_STANDARD_CHANNEL_ID`, `TELEGRAM_PREMIUM_CHANNEL_ID`, `TELEGRAM_ELITE_CHANNEL_ID`.

## Deploiement (procedure + pieges connus)

```bash
cd /opt/touslesmatchs
git fetch origin claude/tiktok-arjel-automation-hgp1tv
git checkout origin/claude/tiktok-arjel-automation-hgp1tv -- public/ scripts/api_server.js scripts/bookmakers.config.js
docker compose up -d --build
```

**Pieges rencontres (IMPORTANT) :**
1. **`git pull` echoue** ("local changes would be overwritten") car Docker modifie des fichiers montes. → Utiliser `git checkout origin/<branche> -- <fichiers>` (ecrase cible sans merge), PAS `git pull`.
2. **Caddyfile immuable** (`chattr +i`, `lsattr` montre le flag `i`). Avant de le mettre a jour : `chattr -i Caddyfile` puis `git show origin/<branche>:Caddyfile > Caddyfile`.
3. **Dossier `site/`** = fichiers Docker parfois immuables → ne pas essayer de `rm`/reset dessus, ce n'est pas source.
4. **Dockerfile.api ne copie QUE `api_server.js` + `bookmakers.config.js`.** Tout nouveau module `require('./xxx')` fait CRASHER l'API (Cannot find module). → Inliner le code dans api_server.js (ex: `seoPages`).
5. Toujours verifier apres deploiement : `docker compose ps` (api = Up, pas Restarting) + `docker logs touslesmatchs-api --tail 30`.

## Sauvegardes (avant/apres tout correctif touchant la base)

- **Script** : `./backup-db.sh <label>` → copie `tlm.db` dans `/opt/backups` ET `/root/backups`.
- Faire `./backup-db.sh avant-x` AVANT, `./backup-db.sh apres-x` APRES.
- Archive complete nocturne : `backup.sh` (cron).

## Etat actuel du projet (2026-07-23)

### Refonte produit FAITE (audit conversion) — deployee
- Hero refait + panneau vote multi-IA + barre de preuves
- Sections "Pourquoi nous", methode 5 etapes, comparatif offres
- Bandeau activite live, tunnel de conversion, compte gratuit reconnecte
- Pages SEO dynamiques (`/pronostics`, `/pronostic/:slug`, sitemap)
- Stats par palier (etape 1)
- Fixes : doublons vitrine, vraies cotes ARJEL, coherence resultats Telegram, Betclic retire

### Decisions strategiques en attente (mi-aout)
- Ajuster les filtres de ligues avec les donnees de la vraie saison

## Performances connues (~360 analyses resolues, ~81% WR)
- Meilleurs : UEFA Europa/CL ~87-91%, Serie A/B Bresil bons
- Pires : Match nul ~50%, USL League Two ~58%, World Cup ~55% (exclus vitrine)
- Meilleurs types : Victoire domicile 82%, Under X.5 78%
