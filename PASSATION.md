# PASSATION — TousLesMatchs (14 juillet 2026)

## Branche de travail

**`claude/touslesmatchs-smoke-test-7hlgum`**

Toujours travailler sur cette branche. Ne jamais pusher sur `main` directement.

## Point de sauvegarde

- Tag git : `save/pre-mission-2026-07-13` (commit `63de253`)
- Backup VPS : `/opt/touslesmatchs/backups/mission-2026-07-14-15h45/`
- Base de donnees : `445 analyses` verifiees, bind-mount `/opt/touslesmatchs/data:/data`

## Ce qui a ete fait (TERMINE)

### Etape 0 : Sauvegarde et stabilisation
- [x] Bind-mount Docker (`/opt/touslesmatchs/data:/data`) au lieu de volumes nommes
- [x] Boot snapshot (`bootSnapshot()` dans api_server.js) — copie les DB avant toute migration
- [x] Data integrity watchdog — alerte admin Telegram si perte >20% de lignes
- [x] Backup cron 3x/jour sur VPS
- [x] Deploy script (`scripts/deploy.sh`)

### Whitelist stricte
- [x] `/live-matches` filtre avec `isLowTrustCompetition()` (strict whitelist)
- [x] LOW_TRUST_COMPETITION_KEYWORDS elargi (kakkonen, ykkonen, regionalliga, oberliga, etc.)
- [x] CACHE_TTL reduit de 10 min a 30 sec (scores en temps reel)
- [x] Deploye et verifie sur VPS

### Matchs femmes bloques
- [x] `isWomenMatch()` — defense en 3 niveaux (auto-observe, signal emission, /signal-notify)

### Signal Fort renforce
- [x] Seuil adaptatif >= 85% (pas 82%)
- [x] EV-weighted elite grade (`bestBetGrade()`)
- [x] Cap 4 signaux premium/jour
- [x] Gate ARJEL obligatoire (bookmaker + competition)
- [x] Free channel : paywall (teaser + CTA, plus de fuite d'analyse)

### Agent benchmarking
- [x] Filtre agents avec winrate < 52% ET >= 30 resolus

### Paiement Stripe
- [x] `/payment-success` endpoint (belt + suspenders : webhook + session verification)
- [x] `merci.html` — affiche le code d'acces instantanement
- [x] Redirect Stripe configure vers `/merci.html?session_id={CHECKOUT_SESSION_ID}`
- [x] 1 euro, Pro (9.90/mois), Elite (19.90/mois) testees

### Live IA ameliore
- [x] Bouton "Analyser" accessible aux non-connectes → modal login + offres
- [x] Modal redirige vers `/#plan-carte` (section abonnements)

### Chatbot Mistral
- [x] `/chat` endpoint avec memoire par utilisateur (table `chat_messages`)
- [x] `/chat/history` pour recuperer l'historique
- [x] Fallback "momentanement indisponible" si API down

### FloatingWidgets global
- [x] `public/js/widgets.js` — Chatbot + TikTok + Telegram sur TOUTES les pages
- [x] Inclus via `<script src="/js/widgets.js" defer></script>`

### Page Bankroll
- [x] `public/bankroll.html` — calculateur de mise (Prudent 1% / Equilibre 3% / Offensif 7%)
- [x] Historique personnel de paris
- [x] Tables `user_bankroll` et `user_bets` dans codes.db

### Page Preuves
- [x] `public/preuves/index.html` — resultats auto-mis a jour depuis `/signal-fort-stats`

### Telegram
- [x] Kill-switch `COUNCIL_PUBLIC_TELEGRAM` dans telegram_bot.py
- [x] Bot `@Hermes_admin_tlm_bot` reconnecte aux 3 canaux

## Mission 10 etapes — CE QUI RESTE A FAIRE

### Etape 1 : Audit complet (PROCHAINE ETAPE)
- Audit read-only de tout le projet
- Classifier par criticite : rouge / orange / jaune / vert
- Couvrir : securite, performance, UX, SEO, conformite ANJ, code quality
- Produire un rapport structure pour validation utilisateur

### Etape 2 (ex-4) : Cloisonnement abonnements
- Verifier que chaque plan (1 euro, Pro, Elite) donne acces uniquement a ses features
- Telegram premium reserve aux Pro/Elite

### Etape 3 : Securite
- **URGENT : Rotation des cles exposees** (Stripe sk_live, Mistral, Telegram tokens)
- Rate limiting API
- Validation des entrees
- Headers securite Caddy

### Etape 4 (ex-9) : Moteur de consensus
- [x] **Phase 1 TERMINEE** : `scripts/concile_engine.js` cree (98 lignes)
  - [x] `computeWeights()`, `computeConsensus()`, `buildAnalysisResult()`
  - [x] `api_server.js` refactorisee (28 lignes inline → 3 appels)
  - [x] `Dockerfile.api` actualise pour copier le module
  - [x] Comportement identique (extraction pure), pret a deployer
  - Branche : `claude/consensus-engine-architecture-sy3gqg` (commit ba2b50d)
- [ ] **Phase 2 TODO** : Poids dynamiques (market, league, recency factors)
- [ ] **Phase 3 TODO** : Decision par calcul (Chief perd arbitrage)
- [x] Design document complet : `docs/DESIGN_concile_engine.md`

### Etape 5 : Brevo
- Nurturing email sequences
- Newsletter capture (emplacement a decider avec l'utilisateur)

### Etape 6 : CGU
- Pages legales conformes ANJ
- Mentions legales, politique de confidentialite

### Etape 7 : Multilingue
- i18n (FR base, EN a venir)
- `public/js/i18n.js` existe deja

### Etape 8 : Responsive
- Audit mobile-first de toutes les pages
- Fix des problemes identifies en audit

## Architecture — rappels critiques

### Roles des IA (ne pas confondre)
| IA | Role |
|----|------|
| **Claude** | Architecte — concoit, securise, documente, ecrit le code dans git |
| **Hermes** | Decideur — consensus pondere, analyse des matchs |
| **Jamais deux agents dans le code en meme temps** | Un seul ecrit, l'autre review |

### Methode de travail
1. Sauvegarde
2. Une etape a la fois
3. Rapport pour validation utilisateur
4. Etape suivante apres validation
5. Jamais deux etapes lourdes en parallele

### Regles inviolables
- Mot "pari" INTERDIT dans contenus publics → "analyse", "pick", "selection"
- Disclaimer joueurs-info-service.fr OBLIGATOIRE
- Anonymat du fondateur ABSOLU
- Cles API JAMAIS dans les logs, commits ou conversations
- Cotes max 1.95
- Signal Fort >= 85% seulement
- Matchs femmes BLOQUES
- Coupe du Monde EXCLUE

### Tunnel de vente
TikTok → TousLesMatchs.com → Telegram Gratuit → Analyse 1 euro → Pro 9.90/mois → Elite 19.90/mois

### VPS
- Hostinger KVM 2, Ubuntu 24.04
- `/opt/touslesmatchs`
- Deploy : `bash /opt/touslesmatchs/scripts/deploy.sh`

### Bases de donnees
- `tlm.db` : analyses, picks, agent_votes, concile_analyses
- `codes.db` : clients, codes d'acces, bankroll, bets, chat_messages
- Chemin : `/opt/touslesmatchs/data/` (bind-mount dans Docker)

## Problemes ouverts (14 juillet 19h00)

### Site web affiche version ANCIENNE
- **Symptome** : Manquent TikTok button, Telegram button, Chatbot en bas de page
- **Cause** : Fichiers modifies localement (`public/index.html`, `site/index.html`) nettoyes lors d'un `git clean`
- **Action requise** :
  1. Chercher quand TikTok/Telegram/Chatbot ont ete ajoutes (pas trouve dans main recent)
  2. Restaurer depuis backup `/opt/touslesmatchs/backups/mission-*/` si existe
  3. Ou regener les fichiers avec les features

### Telegram : Alexis + Romuald
- **Alexis** (fils) : Rétrogradé en lecture seule sur Hermes Admin ✅, RESTE admin sur Premium ⚠️
  - Fix manuelle requise : App Telegram → Premium → Admins → Alexis → Retirer
- **Romuald** (frère) : User ID inconnu, trouvable seulement si envoie `/start` au bot en privé
  - Fix : Get ID via getUpdates, puis promoteChatMember restriction

### Git : Conflits de branche
- VPS a eu reset force a `c3201fa` sur `main` pour stabiliser
- Branche du consensus engine (`claude/consensus-engine-architecture-sy3gqg`) prete a merger quand Phase 2/3 faites
- Attention : Ne pas mélanger consensus-engine work avec smoke-test branch

## Preferences utilisateur

- "quand tu me donnes deux choix, analyse les pour et contre et fais directement le recommande, je te fais confiance"
- "dis moi si je la pousse dans hermes ou sur le VPS hostinger" (toujours preciser ou executer les commandes)
- Mobile first, design premium sobre
- Pas de features inutiles — chaque dev doit augmenter le CA, la conversion, la confiance, l'automatisation, la vitesse ou l'UX
- **Architecture consensus** : UN seul moteur (pas fragmentation), Claude architecte + code, Hermes decideur
