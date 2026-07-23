# CODEX.md — Instructions pour GPT Codex (OpenAI)

## 🔴 REPRISE APRÈS CLAUDE — LIS CECI EN PREMIER

Tu prends le relais de Claude (session à court de crédit). L'historique de la
conversation Claude t'est fourni juste au-dessus/à côté de ce message.

**Étapes de reprise (dans l'ordre) :**
1. Lis l'historique de conversation fourni → tu comprends le contexte immédiat.
2. Lis `CHANGELOG.md` (racine du repo) → **section « 🔄 EN COURS — À REPRENDRE »** en
   haut : c'est l'état EXACT (ce qui est fait, ce qui reste). Toujours à jour.
3. Lis `AGENTS.md` (racine) → architecture, endpoints, liens bookmakers, pièges déploiement.
4. Continue le travail **sans rien effacer** de ce que Claude a fait.

**Où sont les fichiers :**
- Repo GitHub : `Gregus77/touslesmatchs-site`
- Branche à jour : `claude/tiktok-arjel-automation-hgp1tv` (le code récent est ICI, pas sur main)
- Serveur (VPS) : `/opt/touslesmatchs`
- Fichiers clés : `scripts/api_server.js` (toute l'API + SEO inline + paliers),
  `public/index.html` (accueil), `public/dashboard.html` (compte gratuit),
  `scripts/bookmakers.config.js` (liens affiliés Winamax/Unibet/PMU),
  `AGENTS.md` / `CHANGELOG.md` / `POUR-LES-IA.md` (docs).

**Interdictions absolues (RIEN EFFACER) :**
- Ne SUPPRIME aucun fichier, aucune fonction, aucun endpoint existant sans accord explicite.
- Travaille sur TA branche (`codex/<tache>`), jamais sur `main` ni sur la branche de Claude.
- **Après CHAQUE changement : mets à jour `CHANGELOG.md`** (ajoute ta ligne + tiens à jour
  la section « 🔄 EN COURS — À REPRENDRE » pour la prochaine IA).
- Ne casse pas : endpoints API, liens bookmakers (PAS de Betclic), Stripe, Telegram, Brevo, Concile.
- Conformité ANJ : jamais le mot "pari". Jamais de clé/token dans le code. Jamais l'identité du fondateur.
- Zone Telegram + Brevo + `council/` = Hermès → ne pas toucher sans accord.

---

## Avant toute chose

1. Lis `AGENTS.md` a la racine du projet — il contient TOUTES les regles partagees
2. Ce fichier-ci contient les instructions SPECIFIQUES a Codex
3. `CLAUDE.md` est le fichier equivalent pour Claude — ne pas le modifier

## Ta branche

Cree une branche par tache :
```
git checkout -b codex/<nom-court-de-la-tache>
```
Ne JAMAIS pusher sur `main` ou sur une branche `claude/*`.

## Ce que tu peux faire

- Modifier `scripts/api_server.js` (API Node.js)
- Modifier `public/index.html`, `public/live-ia.html` (frontend)
- Modifier `public/js/i18n.js` (traductions)
- Creer de nouveaux fichiers dans `public/` si necessaire
- Corriger des bugs

## Ce que tu ne dois PAS faire

- Ne JAMAIS modifier `council/` (zone Hermes, Python)
- Ne JAMAIS modifier `CLAUDE.md` (instructions de Claude)
- Ne JAMAIS modifier `docker-compose.yml` sans accord explicite du fondateur
- Ne JAMAIS modifier `Caddyfile` sans accord explicite
- Ne JAMAIS changer les routes API existantes (tu peux en ajouter)
- Ne JAMAIS changer `PUBLISHED_MIN_CONFIDENCE` (= 82) sans accord du fondateur
- Ne JAMAIS utiliser le mot "pari" dans le contenu public
- Ne JAMAIS exposer des cles API, tokens, ou secrets
- Ne JAMAIS exposer l'identite du fondateur

## Avant de modifier un fichier

```bash
git log --oneline -5 <fichier>
```
Si Claude a modifie ce fichier recemment, lis le diff pour comprendre ses changements :
```bash
git diff HEAD~5 -- <fichier>
```

## Format de commit

```
[Codex] Description courte du changement
```

## Verification avant de declarer termine

- [ ] `docker-compose.yml` est toujours coherent (4 services)
- [ ] Les endpoints existants n'ont pas change de route
- [ ] Le mot "pari" n'apparait nulle part dans le contenu public
- [ ] Aucune cle API / token dans le code
- [ ] Le site reste responsive mobile
- [ ] Le HTML est valide
- [ ] Les fonctionnalites existantes ne sont pas cassees

## Contexte rapide

TousLesMatchs.com est un site d'analyses sportives par IA. Le coeur :
- 4 agents IA analysent les matchs (Concile Hermes, cote Python)
- Une version JS simplifiee (Auto-Concile) tourne dans l'API pour le Live IA
- Les utilisateurs achetent des abonnements via Stripe (1euro, 9.90, 19.90/mois)
- Le trafic vient de TikTok → site → Telegram → conversion
- Conformite ANJ obligatoire (pas de "pari", disclaimer, pas de garantie de gains)

## En cas de doute

Demande au fondateur. Ne fais pas de suppositions sur l'architecture.
Relis `AGENTS.md` pour les details complets.
