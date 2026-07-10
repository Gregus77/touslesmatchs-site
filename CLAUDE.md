# CLAUDE.md — TousLesMatchs

## PROTOCOLE DE SECURITE OBLIGATOIRE

### Preflight : a executer AU DEBUT de chaque session Claude

Avant toute modification de code, Claude DOIT :

1. **Lire ce CLAUDE.md** (deja fait si tu lis ca)
2. **Appeler le preflight endpoint** : `curl http://localhost:3001/admin/preflight`
   - Verifie : BDD, historique, competitions, agents, filtres, Telegram, API keys, matchs live, learning engine
   - Si `status: "DEGRADED"` → corriger les `critical_failures` AVANT toute autre modification
3. **OU executer le script** : `bash scripts/preflight.sh` (sur le VPS)
4. **Verifier les logs recents** : `docker logs touslesmatchs-api --tail 30 | grep -E "FAIL|ERROR|ATTENTION|eligible=0"`

### Regles de securite ABSOLUES (ne jamais contourner)

- **Backup avant modification critique** : `cp scripts/api_server.js scripts/api_server.js.backup-$(date +%Y%m%d-%H%M)` sur le VPS
- **Ne JAMAIS reduire TRUSTED_COMPETITIONS** sans validation explicite du fondateur — chaque ligue retiree = matchs bloques silencieusement
- **Ne JAMAIS ajouter de pays entier dans LOW_TRUST_COMPETITION_KEYWORDS** — utiliser des patterns specifiques (ex: `"segunda · chile"` au lieu de `"chile"`)
- **Verifier eligible > 0** dans les logs apres chaque modification de filtre
- **Tester Telegram** : `curl http://localhost:3001/admin/telegram-diagnostic` apres chaque modification Telegram
- **Le learning engine ne doit JAMAIS bloquer par manque d'historique** — `assessLearningProfile(null)` doit retourner `clientSafe: true`
- **Pas de systemctl** dans le code (incompatible Docker)
- **Pas de modification du .env** dans les commits
- **Ne JAMAIS servir le site depuis un dossier autre que `public/`** — le volume Docker monte `public/` directement en lecture seule
- **Verifier la version apres deploiement** : `curl http://localhost:3001/admin/version` — le hash git doit correspondre au commit deploye

### Anti-rollback : pourquoi le site revenait a l'ancienne version

Le docker-compose.yml montait `/opt/touslesmatchs/site:/srv` — un dossier separe jamais mis a jour par git.
Corrige le 2026-07-10 : maintenant monte `/opt/touslesmatchs/public:/srv:ro` (lecture seule, directement depuis git).
NE JAMAIS remettre un mount vers `/opt/touslesmatchs/site` — c'est la cause du bug de version.

### Validation pre-match (OBLIGATOIRE avant toute analyse)

Avant de lancer le concile IA sur un match, `preMatchValidation()` verifie :
1. Competition autorisee (pas low-trust pour Football)
2. Statut du match valide (pas FINISHED, CANCELLED, NOT_STARTED, etc.)
3. Fenetre de minutes : >= 35' et < 75' (Football uniquement)
4. Sport autorise (Football, Basketball, Hockey, Baseball, Tennis)
5. Donnees minimales presentes (home/away)

Si un critere echoue → NOPICK automatique, pas d'appel API, pas de tokens gaspilles.
Log : `[pre-match] BLOQUE ...` avec les raisons.

### Validation pre-envoi Telegram (14 criteres dans signal_validation.js)

Apres analyse, avant envoi Telegram, `validateSignal()` verifie en plus :
1. Competition autorisee
2. Statut match valide
3. Fenetre 35'-75' (Football)
4. Donnees reelles (pas mock)
5. Consensus >= 3/5 agents d'accord
6. Confiance >= seuil adaptatif (80% par defaut)
7. Marche autorise (Victoire, Over/Under, BTTS, Double chance, Handicap)
8. Cotes dans fourchette [1.25 - 1.95]
9. Coherence modeles (ecart max 30% entre agents)
10. Limite journaliere : max 3 signaux/jour
11. Espacement : min 60 minutes entre signaux
12. Anti-doublon : 1 signal par match par jour
13. Pause defaites : 3 defaites consecutives = 24h pause sur le segment
14. Sport autorise

Tous doivent passer. Un seul echec = signal bloque + motif logge.

### Audit des agents IA (OBLIGATOIRE a chaque session)

Claude DOIT consulter `/admin/audit` au debut de chaque session pour savoir :

1. **Quel agent est bon sur quel marche** — chaque agent (Perplexity, DeepSeek, Mistral, Cohere, Chief/Groq) a un winrate par type de marche :
   - Over 2.5 buts / Under 2.5 buts
   - BTTS Oui / BTTS Non
   - Victoire domicile / Victoire exterieur / Match nul
   - Double chance 1X / X2
   - Handicap
2. **Quelles ligues performent** — winrate par competition, pour savoir si on doit retirer/ajouter des ligues
3. **Les analyses recentes** — avec minute d'analyse, score au moment de l'analyse, stats (tirs, possession), score final, et votes de chaque agent
4. **Les meilleurs et pires agents par marche** — pour identifier les faiblesses

**Tables BDD utilisees** :
- `agent_predictions` : 1 ligne par agent par match, bet + outcome (win/loss)
- `agent_market_predictions` : predictions multi-marches par agent
- `ai_market_specialization` : resume automatique agent+marche (refresh toutes les 30 min)
- `concile_analyses` : analyse complete avec stats au moment de l'analyse (minute, score, tirs, possession)
- `league_ratings` : performance par ligue (class A/B/C/D/E, coefficient)
- `agent_weights` : poids dynamique par agent (ajuste selon winrate)

**Commande d'audit** :
```bash
curl -s http://localhost:3001/admin/audit | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Total: {d[\"summary\"][\"total_predictions\"]} predictions, {d[\"summary\"][\"total_wins\"]}W/{d[\"summary\"][\"total_losses\"]}L')
print('\n== AGENTS ==')
for a in d['agents']: print(f'  {a[\"agent_name\"]}: {a[\"wins\"]}/{a[\"total\"]} ({a[\"winrate\"]}%)')
print('\n== MARCHES ==')
for m in d['markets']: print(f'  {m[\"market\"]}: {m[\"wins\"]}/{m[\"total\"]} ({m[\"winrate\"]}%)')
print('\n== MEILLEUR/PIRE PAR MARCHE ==')
for k,v in d.get('best_worst_per_market',{}).items():
  b = v.get('best',{}); w = v.get('worst',{})
  print(f'  {k}: best={b.get(\"agent\",\"?\")} ({b.get(\"winrate\",0)}%), worst={w.get(\"agent\",\"?\")} ({w.get(\"winrate\",0)}%)')
"
```

### Verification apres deploiement

Apres chaque `docker compose up -d --build`, verifier dans les 5 minutes :
```bash
# 1. Services up
docker ps --format "table {{.Names}}\t{{.Status}}" | grep touslesmatchs

# 2. API repond
curl -s http://localhost:3001/live-matches | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: {len(d.get(\"matches\",[]))} matchs')"

# 3. Filtres OK (eligible > 0 quand il y a des matchs)
docker logs touslesmatchs-api --tail 20 | grep -E "auto-concile|eligible"

# 4. Telegram OK
curl -s http://localhost:3001/admin/telegram-diagnostic | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Bot: {d[\"tests\"][\"getMe\"][\"ok\"]}, Send: {d[\"tests\"].get(\"sendMessage\",{}).get(\"ok\",\"?\")}' )"

# 5. Preflight complet
curl -s http://localhost:3001/admin/preflight | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Status: {d[\"status\"]}'); [print(f'  WARNING: {w}') for w in d.get('warnings',[])]"
```

### Etat actuel des filtres (reference — MISE A JOUR 2026-07-10)

**Ordre de filtrage dans isLowTrustCompetition()** :
1. TRUSTED verifie en premier → si match → `return false` (passe)
2. LOW_TRUST verifie ensuite → si match → `return true` (bloque)
3. Default → `return false` (accepte les competitions inconnues)

**TRUSTED_COMPETITIONS** : ~80 entrees incluant toutes les ligues majeures mondiales.
Ligues cles : Ligue 1/2, Premier League, La Liga, Bundesliga, Serie A, Eredivisie,
MLS, Liga MX, J-League, K-League, NBA, NHL, MLB, NFL, ATP, Copa America, Champions League, etc.

**LOW_TRUST_COMPETITION_KEYWORDS** : Friendly/amical, U17-U23, reserves, youth,
Coupe du Monde, ligues africaines, ligues asiatiques mineures, ligues oceaniennes.
Pays sud-americains bloques : Chile, Bolivia, Peru, Venezuela, Ecuador, Paraguay, Colombia.
Pays sud-americains autorises (TRUSTED) : Bresil, Argentine, Uruguay uniquement.
NE PAS modifier cette liste sans validation explicite du fondateur.

## Regles automatiques (s'appliquent a CHAQUE session)

### Economie de tokens
- NE PAS relire des fichiers deja connus -- utiliser la reference ci-dessous
- NE PAS explorer le projet pour "comprendre l'architecture" -- tout est documente ici
- Maximum 2 lectures exploratoires par session
- Ecrire en un seul passage, pas de micro-editions
- Paralleliser les taches independantes
- Toujours verifier le travail avant de le declarer termine (checklist verification ci-dessous)

### Verification avant livraison
Avant de declarer un travail termine, verifier :
- Docker : les 4 services sont-ils coherents dans docker-compose.yml ?
- API : les endpoints modifies sont-ils corrects ?
- HTML : le markup est-il valide, responsive, conforme ANJ ?
- Pas de regression : les fonctionnalites existantes sont-elles preservees ?
- Conformite ANJ : aucun mot "pari" dans le contenu public

## Architecture

### Stack : Docker Compose (4 services)
- `site` : Caddy, sert `/public` depuis `/srv`
- `api` : Node.js (port 3001), fichier principal `scripts/api_server.js`
- `council` : Python, Concile Hermes (4 agents IA + Claude Chief)
- `hermes-admin` : Python, bot admin Telegram

### VPS
- Hostinger KVM 2, Ubuntu 24.04, `/opt/touslesmatchs`

### Branche de dev
- Toujours pusher sur la branche assignee, jamais sur main directement

## Fichiers cles (ne pas chercher, lire directement)

| Fichier | Role |
|---------|------|
| `scripts/api_server.js` | API Node.js -- TOUT est la : Concile JS, Stripe, Telegram, Brevo, Signal Fort, Live IA, analytics, auto-concile |
| `public/index.html` | Page d'accueil unique (SPA-like) |
| `public/live-ia.html` | Page Live IA avec onglets En direct / Statistiques |
| `public/js/i18n.js` | Traductions FR de l'interface |
| `council/hermes.py` | Orchestrateur du Concile Python (scheduler 11h59 Paris) |
| `council/agents/` | 4 agents : gpt_agent, gemini_agent, mistral_agent, groq_agent + claude_chief |
| `council/prompts/agent_prompt.py` | Prompt systeme des agents Python |
| `council/tools/sports_api.py` | API-Football, ligues autorisees, multi-sport |
| `council/tools/html_generator.py` | Genere le HTML du pick quotidien |
| `council/tools/history_db.py` | SQLite : picks, premium_picks, agent_votes, concile_analyses |
| `council/tools/telegram_bot.py` | Envoi Telegram (gratuit + premium + admin) |
| `Caddyfile` | Config reverse proxy (routes API, fichiers statiques) |
| `docker-compose.yml` | Orchestration des 4 services |
| `scripts/signal_validation.js` | Validation centralisee des signaux forts (14 criteres, tous doivent passer avant envoi Telegram) |
| `scripts/preflight.sh` | Script de verification securite pre-deploiement |

## Fonctions cles dans api_server.js

| Fonction | Role |
|----------|------|
| `isLowTrustCompetition()` | Filtre les ligues douteuses. Ordre : TRUSTED d'abord (return false = passe), puis LOW_TRUST (return true = bloque), default return false (accepte). Utilise stripAccents() pour normaliser |
| `shouldAutoObserveMatch()` | Decide si un match merite une analyse auto-concile. Verifie : pas fini, sport != Football passe directement, puis filtre low-trust |
| `TRUSTED_COMPETITIONS` | Whitelist des ligues fiables (Ligue 1, Premier League, NBA, NFL, etc.) |
| `LOW_TRUST_COMPETITION_KEYWORDS` | Blacklist par patterns specifiques (segunda · pays, friendly, u17-u23, etc.) — NE PAS mettre des noms de pays entiers |
| `fetchLiveMatches()` | Recupere les matchs en direct depuis API-Sports (multi-sport) |
| `runAutoConcile()` | Lance le concile automatique sur un match observe |
| `buildDailyVisitorReport()` | Rapport visiteurs quotidien (23h Paris) |
| `buildWeeklyMarketingReport()` | Rapport marketing hebdo (lundi 8h) |
| `checkAnalyticsSchedule()` | Scheduler interne (interval 60s) pour rapports |
| `validateSignal()` | (signal_validation.js) Gate centralise : 14 criteres doivent passer avant envoi Telegram |
| `markSignalSent()` | (signal_validation.js) Enregistre un signal envoye (anti-doublon, compteur quotidien) |
| `recordLoss()`/`recordWin()` | (signal_validation.js) Suivi des defaites consecutives pour pause automatique |

## Endpoints API importants

| Route | Methode | Role |
|-------|---------|------|
| `/current-pick` | GET | Pick du jour pour le site |
| `/live-matches` | GET | Matchs en direct (filtres low-trust) |
| `/signal-fort-stats` | GET | Stats Signal Fort |
| `/api/analysis-history` | GET | Historique des analyses concile (paginable) |
| `/admin/analytics-report` | GET | Declenchement rapport analytics |
| `/t` | GET | Pixel de tracking visiteurs |
| `/create-checkout-session` | POST | Stripe checkout |
| `/webhook` | POST | Webhook Stripe |
| `/admin/preflight` | GET | Bilan complet du systeme (BDD, filtres, agents, Telegram, live, learning engine) |
| `/admin/version` | GET | Version du build (hash git, date, regles actives) |
| `/admin/audit` | GET | Audit complet : performance par agent, par marche, par ligue, analyses recentes avec stats |
| `/admin/telegram-diagnostic` | GET | Test complet Telegram (getMe, webhook, envoi test) |
| `/admin/send-report` | POST | Envoie rapport Hermes sur Telegram admin |

## Regles metier

### Tunnel de vente (ne jamais complexifier)
TikTok -> TousLesMatchs.com -> Telegram Gratuit -> Analyse a 1 euro -> Pro (9.90/mois) -> Elite (19.90/mois)

### ANJ (Autorite Nationale des Jeux)
- JAMAIS utiliser le mot "pari" dans les contenus publics (site, emails, Telegram)
- Utiliser : "analyse IA", "pick", "selection", "recommandation"
- Toujours afficher le disclaimer joueurs-info-service.fr
- Ne jamais garantir de gains
- Ne jamais falsifier de statistiques

### Analyses sportives
- **Default** : Moins de 2.5 buts (Under 2.5) comme type d'analyse par defaut
- **Coupe du Monde exclue** de toutes les analyses
- **Ligues fiables uniquement** : whitelist TRUSTED_COMPETITIONS + blacklist LOW_TRUST_COMPETITION_KEYWORDS
- **Ordre de filtrage** : TRUSTED verifie en premier (passe), puis LOW_TRUST (bloque), puis default = accepte (return false)
- **Cotes** : formule `Math.min(1.95, ((1 / (confidence / 100)) * 1.45))`, jamais au-dessus de 1.95
- **Signal Fort** : alerte quand confiance >= 80%
- **Multi-sport** : Football, Basketball, Hockey, Baseball, Tennis. Les sports non-Football passent directement le filtre low-trust dans shouldAutoObserveMatch

### Fenetre d'analyse et publication (REGLES STRICTES)
- **Pas d'analyse automatique avant la 35e minute** — `AUTO_CONCILE_MIN_MINUTE = 35`
- **Pas d'analyse automatique apres la 75e minute** — `isFinishedOrTooLateForLiveIa` coupe a `minute >= 75`
- **Pas d'envoi Telegram avant 35' ni apres 75'** — fenetre d'envoi signal fort : `matchMinute >= 35 && matchMinute < 75`
- Ces limites s'appliquent a l'auto-concile et aux signaux forts Telegram
- L'analyse manuelle (bouton site) reste disponible a tout moment pour l'utilisateur

### Pays et competitions — Regles definitives (POINT DE SAUVEGARDE 2026-07-10)

**PAYS BLOQUES (toutes divisions, toutes competitions)** :
- Afrique : Ethiopia, Nigeria, Tanzania, Kenya, Uganda, Ghana, Zambia, Zimbabwe, Mozambique, Cameroon, Rwanda, Burundi, Malawi, Botswana, Senegal, Ivory Coast, Congo, Angola, Namibia, Gabon, Togo, Benin, Niger, Madagascar, Guinea, Sierra Leone, Liberia, Gambia, South Africa, Algeria, Tunisia, Egypt
- Asie : Kazakhstan, Uzbekistan, Tajikistan, Kyrgyzstan, Turkmenistan, Myanmar, Cambodia, Laos, Vietnam, Bangladesh, Nepal, Mongolia, Palestine, Jordan, Iraq, Syria, Yemen, Oman, Bahrain, Lebanon, India, Sri Lanka, Pakistan, Indonesia, Malaysia, Philippines, Thailand, Iran
- Amerique du Sud : **Chile, Bolivia, Peru, Venezuela, Ecuador, Paraguay, Colombia**
- Amerique centrale : Honduras, Guatemala, El Salvador, Nicaragua, Costa Rica, Panama, Haiti, Jamaica, Trinidad, Dominican, Cuba, Belize, Suriname, Guyana
- Europe (divisions inferieures) : Estonia, Latvia, Lithuania, Faroe, Gibraltar, Andorra, Malta, San Marino, Kosovo, North Macedonia, Albania, Moldova, Belarus, Armenia, Georgia, Azerbaijan, Iceland, Northern Ireland, Luxembourg, Liechtenstein, Montenegro, Bosnia
- Oceanie : Fiji, Samoa, Tonga, Vanuatu, Solomon, Papua, New Caledonia, Tahiti, Australia NPL

**PAYS/LIGUES AUTORISES** :
- Europe top : France (Ligue 1/2), Angleterre (PL, Championship, FA Cup), Espagne (La Liga), Allemagne (Bundesliga), Italie (Serie A), Pays-Bas (Eredivisie), Belgique, Portugal, Turquie, Ecosse, Danemark, Norvege, Suede, Finlande, Suisse, Pologne, Republique Tcheque, Croatie, Serbie, Grece, Roumanie, Ukraine, Russie, Autriche, Hongrie, Bulgarie, Slovaquie, Chypre
- Coupes europeennes : Champions League, Europa League, Conference League, Nations League
- Amerique du Nord : MLS, Liga MX, USL Championship, NWSL, Canadian Premier, Leagues Cup, CONCACAF Champions
- Amerique du Sud (3 pays seulement) : **Bresil** (Brasileirao), **Argentine** (Liga Profesional), **Uruguay** (Primera Division)
- Coupes sud-americaines : Copa Libertadores, Copa Sudamericana, Copa America, Recopa, Supercopa
- Asie premium : J-League (Japon), K-League (Coree), Chinese Super League, Saudi Pro League, UAE Pro League, Qatar Stars
- Oceanie premium : A-League (Australie), Australia Cup
- Sports US : NBA, NHL, MLB, NFL, CFL, AHL, NBL
- Tennis : ATP, WTA, Grand Slam (Wimbledon, Roland Garros, US Open, Australian Open)
- Rugby : Top 14, Pro D2, Premiership Rugby, URC
- International : Euro, Olympic, Club World Cup (PAS la Coupe du Monde)

**CATEGORIES TOUJOURS BLOQUEES** :
- Friendly / Amical (toutes)
- Jeunes : U17, U18, U19, U20, U21, U23
- Reserves, B team, Youth, Academy
- Coupe du Monde FIFA (world cup, coupe du monde, fifa world, copa del mundo)

### Anonymat du fondateur
Ne jamais creer de fonctionnalite qui expose le nom, prenom, photo, voix, adresse ou telephone du fondateur. La marque communique, jamais le fondateur.

### Securite
- Ne JAMAIS afficher, loguer ou partager les cles API / tokens du fichier .env
- Ne JAMAIS inclure de credentials dans les commits

## Priorites de developpement

Chaque dev doit repondre a AU MOINS un de ces objectifs :
1. Augmenter le chiffre d'affaires
2. Augmenter le taux de conversion
3. Ameliorer la confiance utilisateur
4. Ameliorer l'automatisation
5. Ameliorer la vitesse du site
6. Ameliorer l'experience utilisateur

Si aucun objectif n'est rempli : ne pas developper.

## Ne jamais casser

- Stripe (paiements, webhooks)
- Telegram (bots, canaux gratuit/premium)
- Hermes / Concile IA (analyse des matchs)
- Live IA (analyse en direct + onglet Statistiques)
- Brevo (emails, nurturing)
- Analytics (tracking visiteurs, rapports quotidiens/hebdo)
- Responsive mobile
- SEO

## Design

- Mobile first
- Design premium, sobre, epure
- Pas de sections redondantes sur la page d'accueil
- Les sections masquees (display:none) dans index.html sont volontairement cachees pour epurer la page

## Commandes utiles

```bash
# Deployer
cd /opt/touslesmatchs && git fetch origin <branch> && git reset --hard origin/<branch> && docker compose up -d --build

# Preflight (OBLIGATOIRE avant toute modification)
bash scripts/preflight.sh
# OU
curl -s http://localhost:3001/admin/preflight | python3 -m json.tool

# Logs
docker logs touslesmatchs-api --tail 100
docker logs touslesmatchs-council --tail 100

# Verification filtres (eligible doit etre > 0 quand il y a des matchs live)
docker logs touslesmatchs-api --tail 50 | grep -E "auto-concile|eligible|ATTENTION"

# Test API
curl http://localhost:3001/current-pick
curl http://localhost:3001/signal-fort-stats
curl http://localhost:3001/live-matches
curl http://localhost:3001/api/analysis-history

# Diagnostic Telegram
curl http://localhost:3001/admin/telegram-diagnostic

# Backup avant modification critique (SUR LE VPS)
cp scripts/api_server.js scripts/api_server.js.backup-$(date +%Y%m%d-%H%M)
```

## IAs du projet

| IA | Role | Ou |
|----|------|----|
| **Claude (toi)** | Developpeur principal, cree et modifie le code du site, de l'API, du conseil | Cette conversation |
| **Hermes (Concile Python)** | Orchestrateur du conseil quotidien a 11h59. Coordonne 4 agents, Claude Chief decide | `council/hermes.py`, `council/scheduler.py` |
| **DeepSeek** | Agent analyste du Concile (remplace GPT) | `council/agents/gpt_agent.py` |
| **Gemini Flash** | Agent analyste du Concile | `council/agents/gemini_agent.py` |
| **Mistral** | Agent analyste du Concile | `council/agents/mistral_agent.py` |
| **Groq/Llama3** | Agent analyste du Concile | `council/agents/groq_agent.py` |
| **Claude Chief** | Chef du Concile, prend la decision finale a partir des rapports des 4 agents | `council/agents/claude_chief.py` |
| **Auto-Concile JS** | Version JS simplifiee qui tourne dans api_server.js pour les analyses Live IA en temps reel | `scripts/api_server.js` (fonction `runAutoConcile`) |
