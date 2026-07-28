# ÉTAT DES LIEUX — session du 24-25/07/2026

> **À lire en entier avant toute modification.** Ce document décrit ce qui a été fait,
> ce qui reste à faire, et surtout **les pièges qui font échouer les changements en
> silence** sur ce projet. Ne pas repartir de zéro : tout ce qui suit est déployé et
> vérifié en production.

Branche de travail : `claude/tiktok-arjel-automation-hgp1tv`
Dernier commit de la session : voir `git log --oneline` (13 commits, de `fe438e4` à HEAD)

---

## 1. LE CHANGEMENT MÉTIER PRINCIPAL

**L'offre à 1 € est supprimée.** Remplacée par **3 paliers payants**, chacun avec son
canal Telegram dédié :

| Palier | Prix | Canal Telegram | Plafond/jour | Crédits Live IA/jour |
|---|---|---|---|---|
| 🆓 Gratuit (vitrine) | 0 € | `TELEGRAM_CHANNEL_ID` | 1 teaser | — |
| 🟢 Standard | 4,90 € | `TELEGRAM_STANDARD_CHANNEL_ID` | 3 | 3 |
| 🟣 Premium | 9,90 € | `TELEGRAM_PREMIUM_CHANNEL_ID` | 10 | 10 |
| 🟠 Elite / VIP | 19,90 € | `TELEGRAM_ELITE_CHANNEL_ID` | 30 | 30 |
| 👑 Admin (Hermès) | — | `TELEGRAM_ADMIN_CHAT_ID` | tout | — |

**Le canal gratuit ne donne JAMAIS la sélection exacte** : c'est un teaser qui renvoie
vers `/performances` (résultat vérifiable le lendemain) et vers les offres. C'est un
choix assumé : porte d'entrée pour le trafic TikTok, sans cannibaliser le payant.

**Modèle imbriqué obligatoire : Elite ⊇ Premium ⊇ Standard.** Payer plus doit toujours
donner au moins autant. Toute modification des seuils doit préserver cette propriété.

### Ancien palier « VIP » (attention)

`STRIPE_PRICE_ID_VIP` → statut `vip`, **20 crédits**, canal Elite. Ce palier n'existe
pas sur le site mais reste configuré. **À vérifier** : si le lien de paiement 19,90 €
est rattaché au prix VIP et non ELITE, le client reçoit 20 crédits au lieu de 30.

---

## 2. SEUILS DE CONFIANCE — NE PAS LES REMONTER SANS MESURER

Constantes dans `scripts/api_server.js` (~ligne 755) :

```js
const STANDARD_MIN_CONF = 88, PREMIUM_MIN_CONF = 84, ELITE_MIN_CONF = 82;
const TIER_MIN_REAL_ODD = 1.50;   // cote RÉELLE bookmaker, jamais l'estimation
const STANDARD_SIGNAL_DAILY_CAP = 3, PREMIUM_SIGNAL_DAILY_CAP = 10, ELITE_SIGNAL_DAILY_CAP = 30;
```

Les seuils sont **décroissants** : c'est volontaire. Un palier supérieur est plus
*large*, donc reçoit plus. L'erreur inverse (Standard ≥ 88 / Premium ≥ 90) rend les
deux paliers **identiques**, car « ≥ 88 » contient déjà tout « ≥ 90 ».

### Distribution réelle mesurée le 25/07/2026

Analyses résolues, cote réelle ≥ 1.50, depuis le 03/07/2026 :

| Tranche de confiance | Analyses | Winrate | Profit (10 €/pick) |
|---|---|---|---|
| ≥ 88 | 11 | 100 % | +86 € |
| 84-85 | 62 | 83,9 % | +274 € |
| 82-83 | 141 | 70,9 % | +428 € |

**Aucune analyse au-dessus de 89.** Un seuil à 90 ou 92 produit donc **zéro signal** —
un palier payant qui ne livre rien. C'est exactement le piège dans lequel la session
est tombée avant correction.

Requête pour remesurer avant tout changement de seuil :

```bash
sqlite3 -header -column /opt/touslesmatchs/data/tlm.db "
SELECT CASE WHEN confidence>=92 THEN '>=92' WHEN confidence>=90 THEN '90-91'
            WHEN confidence>=88 THEN '88-89' WHEN confidence>=86 THEN '86-87'
            WHEN confidence>=84 THEN '84-85' ELSE '82-83' END AS tranche,
       COUNT(*) n, SUM(outcome='win') gagnes,
       ROUND(SUM(outcome='win')*100.0/COUNT(*),1) winrate,
       ROUND(SUM(CASE WHEN outcome='win' THEN real_odd*10-10 ELSE -10 END),0) profit_10e
FROM concile_analyses
WHERE outcome IN ('win','loss') AND real_odd >= 1.5 AND date(analysed_at) >= '2026-07-03'
GROUP BY tranche ORDER BY tranche DESC;"
```

**Volume actuel attendu** : Standard ~0,5 signal/jour, Premium ~3,3/jour, Elite ~10/jour.
Les plafonds (3/10/30) sont des **maximums**, pas des engagements — le site dit
« jusqu'à ». Ne jamais promettre un volume que la distribution ne permet pas.

---

## 3. SOURCE DE VÉRITÉ UNIQUE : `tierEligible()`

Fonction dans `api_server.js` (juste après `rowIsArjel`). Elle décide si une analyse
appartient à un palier, et sert à la fois :

- à la **diffusion Telegram** (`gradeStandard` / `gradePremium` / `gradeElite` dans `runAutoConcile`)
- aux **statistiques publiques** (`/tier-stats`, section `#paliers` de l'accueil)
- à la **page Performances** (`/analysis-history` → champ `tier` de chaque ligne)

⚠️ **Ne jamais dupliquer ces seuils ailleurs.** Avant cette session, les stats publiques
utilisaient d'autres définitions (Premium ≥ 85, Elite = tout) : le track record affiché
ne décrivait pas le produit vendu, et la page annonçait même inclure les matchs
« IA seulement » alors que la diffusion les exclut. `public/performances.html` filtre
désormais sur le champ `tier` renvoyé par l'API, pas sur des seuils recopiés.

Valeur `"hors-palier"` = analyse publiée sur le site mais diffusée sur aucun canal payant
(pas de cote réelle, hors ARJEL, ou sport non couvert).

---

## 4. PIÈGES DU PROJET — CAUSES D'ÉCHECS SILENCIEUX

Ces points ont tous provoqué un bug réel pendant la session.

### 4.1 `docker-compose.yml` transmet les variables UNE PAR UNE
Il n'y a **pas** de `env_file`. Une variable présente dans `.env` mais absente du bloc
`environment:` du service `api` **n'atteint jamais le conteneur** et vaut `""`.

35 variables étaient dans ce cas. Conséquences constatées :
- `PERPLEXITY_API_KEY` et `COHERE_API_KEY` absentes → les agents « Perplexity-Web » et
  « Cohere-Command » retombaient **en silence** sur `llama-3.3-70b` (Groq), soit le même
  modèle que Claude Chief. Leurs stats quasi identiques (1690 analyses, 70,65 % vs
  70,59 %) le prouvaient : **le même modèle votait trois fois**.
- `BREVO_API_KEY` absente → aucun email n'était envoyé.
- `JWT_SECRET` absente → secret régénéré à chaque redémarrage, tous les membres déconnectés.
- `OPENROUTER_API_KEY` absente → aucun agent shadow ne pouvait tourner.

**Règle : toute nouvelle variable doit être ajoutée à `docker-compose.yml` ET `.env.example`.**

`COHERE_API_KEY` est **toujours absente du `.env`** : Cohere-Command et Claude Chief
tournent encore sur le même modèle. C'est le dernier doublon du Concile.

### 4.2 `Dockerfile.api` ne copie que deux fichiers
```
COPY scripts/api_server.js ./server.js
COPY scripts/bookmakers.config.js ./bookmakers.config.js
```
Tout `require()` d'un autre fichier local **fait planter l'API au démarrage**. Ne pas
découper `api_server.js` en modules sans modifier le Dockerfile.

Corollaire : un script utilitaire posé dans `/data` ne résout pas `better-sqlite3`
(Node résout depuis le dossier du script, pas le cwd). Voir la boucle de résolution
multi-chemins dans `scripts/cleanup_agent_weights.js`.

### 4.3 Les erreurs d'API IA étaient avalées
`callOpenAICompat` résolvait `ok:true` avec un texte vide quand l'API renvoyait une
erreur JSON valide (ex. 404 « model not found »), et `runShadowEvaluation` faisait un
`continue` **sans aucun log**. Un agent mal configuré disparaissait sans trace.
Corrigé : les erreurs remontent et sont loguées (`SANS RÉPONSE — <raison>`).

### 4.4 Un ID de canal Telegram périmé ne produit aucune erreur
`sendTelegramMessage` renvoie simplement `false`. Le palier cesse de recevoir ses
signaux en silence. `verifyTelegramChannels()` tourne maintenant au démarrage et loggue
l'état des 5 canaux — **c'est ce contrôle qui a révélé que le bot avait été exclu du
canal Premium**, donc que les abonnés à 9,90 € ne recevaient plus rien.

Vérification :
```bash
docker logs touslesmatchs-api --tail 40 | grep telegram-check
```
Objectif : 5 lignes ✅, aucun ❌, aucun `⚠️ groupe simple`.

⚠️ Un canal de **type `group`** (ID sans préfixe `-100`) migre tout seul en supergroupe
et **son ID change** → panne silencieuse. Toujours utiliser des canaux (`type=channel`).

### 4.5 `agent_weights` se reconstruit au démarrage
`refreshAgentWeights()` est un UPSERT depuis `agent_predictions`, exécuté au boot. Les
agents retirés du Concile réapparaissaient donc après chaque `docker compose up`.
Corrigé par `CONCILE_AGENT_NAMES` (source de vérité unique) : la fonction filtre sur ce
roster **et purge** les lignes hors roster à chaque passage.

**`agent_predictions` ne doit JAMAIS être vidée** : c'est l'historique brut, le supprimer
falsifierait les statistiques (interdit par `CLAUDE.md`).

7 agents fantômes ont été supprimés de `agent_weights` : `OR-KimiV3`,
`OR-DeepSeekFlash`, `OR-GPT4oMini`, `GPT Analysis`, `GROQ-Llama`, `GeminiFlash`,
`Mistral-7B`. Script réutilisable (dry-run par défaut, sauvegarde automatique) :
```bash
docker exec touslesmatchs-api node /data/cleanup_agent_weights.js          # inspection
docker exec touslesmatchs-api node /data/cleanup_agent_weights.js --apply   # suppression
```

### 4.6 L'API Tennis n'existe pas
`v1.tennis.api-sports.io` ne résout pas (`ENOTFOUND`) — API-Sports ne publie pas ce
service. Le bloc `api_server.js` (~ligne 1975) échoue à chaque cycle depuis toujours et
pollue les logs. **Non corrigé** (2 min de travail, aucun risque). `CLAUDE.md` liste le
tennis comme sport supporté : c'est faux.

---

## 5. AUTRES CHANGEMENTS DE LA SESSION

- **Page `/performances` reconstruite** : 8 indicateurs (analyses, winrate, gagnées,
  perdues, en attente, cote moyenne, ROI, bénéfice à 10 €/mise), onglets par palier,
  historique daté. Les liens `/preuves` (page inexistante → 404) ont été repointés.
  `/analysis-history` renvoie désormais ROI, profit, cote moyenne et stats par palier.
- **Accueil** : `ls-analyses` utilise `published_today` (corrige l'écart « 8 analyses
  annoncées / 6 envoyées »). CTA « Voir les N résultats vérifiés » sous la courbe ROI.
  Mots « pari » remplacés par « pick » (conformité ANJ).
- **Diffusion identique sur tous les paliers payants** : le bilan « SIGNAL FORT » et une
  notification de signal ne partaient **que** sur Premium — un abonné Elite à 19,90 €
  recevait moins qu'un Premium à 9,90 €. Helper `sendToPaidChannels()` (dédoublonnage
  par `chat_id` quand deux paliers partagent un canal).
- **Invitations Telegram** : `createPremiumInviteLink` était câblé en dur sur le canal
  Premium → un abonné Elite était invité dans le mauvais canal. `channelForStatus()`
  résout maintenant le canal selon le palier acheté.
- **Colonnes de traçage** : `sig_sent_standard` / `sig_sent_elite` sont créées par
  migration et renseignées ; auparavant tout était marqué `sig_sent_premium`.
- **Banc d'essai** : ajout de `OR-Qwen37Max` (`qwen/qwen3.7-max`) et `OR-KimiK3`
  (`moonshotai/kimi-k3`) — identifiants **vérifiés** sur le catalogue OpenRouter.
  Surchargeables via `OR_QWEN_MODEL` / `OR_KIMI_MODEL`. Aucun impact sur les picks :
  les agents shadow écrivent dans `shadow_evals`, jamais dans `agent_predictions`, et
  n'envoient aucun message Telegram (vérifié).
- **Accès testeur** : l'expiration était recalculée « aujourd'hui + 60 jours » à chaque
  démarrage, donc l'accès offert n'expirait jamais. Date fixe (`TESTER_GRANT_EXPIRES`),
  code d'accès masqué dans les logs.

### Performances du banc d'essai (25/07/2026)
| Agent | Analyses | Winrate |
|---|---|---|
| Mistral-Small | 208 | **63,0 %** |
| Groq-Llama70B | 457 | 58,6 % |
| Groq-Llama8B | 380 | 44,5 % |

Mistral-Small est le meilleur candidat pour rejoindre le Concile principal.

---

## 6. CE QUI RESTE À FAIRE

### Bloquant pour encaisser
1. **Vérifier que le tarif Stripe Standard est bien récurrent mensuel** (jamais confirmé) :
   ```bash
   source /opt/touslesmatchs/.env
   curl -s https://api.stripe.com/v1/prices/$STRIPE_PRICE_ID_STANDARD -u "${STRIPE_SECRET_KEY}:" \
     | grep -oE '"(unit_amount|interval|type)":\s*"?[a-z0-9]+"?'
   ```
   Attendu : `unit_amount 490`, `type recurring`, `interval month`. Si `one_time`, le
   client paie une seule fois alors que le site promet un abonnement.
2. **Test d'achat réel à 4,90 €** : vérifier que l'email contient un lien d'invitation
   vers le canal **Standard** (et non Premium). Seule preuve que la chaîne fonctionne.

### Telegram
3. Remettre le bot **administrateur du canal Premium** s'il n'y est plus, et confirmer
   via `telegram-check`.
4. Migrer les membres de l'ancien groupe Elite vers le nouveau canal, puis supprimer
   l'ancien groupe (type `group`, ID instable).
5. **Réduire le canal Hermès à l'administrateur seul** (4 membres constatés).

### Qualité des analyses
6. Ajouter `COHERE_API_KEY` au `.env` — dernier doublon du Concile (Cohere-Command et
   Claude Chief tournent sur le même modèle). Puis rebuild.
7. Relever les résultats de `OR-Qwen37Max` et `OR-KimiK3` après quelques jours de matchs :
   ```bash
   sqlite3 data/tlm.db "SELECT agent_name, COUNT(*), ROUND(SUM(outcome='win')*100.0/COUNT(*),1)
   FROM shadow_evals WHERE outcome IN ('win','loss') GROUP BY agent_name ORDER BY 3 DESC;"
   ```

### Hygiène
8. Neutraliser le bloc tennis mort (`api_server.js` ~1975).
9. Nettoyer les doublons du `.env` (`OPENAI_API_KEY` en double avec des valeurs
   différentes — variable **inutilisée** : le code n'appelle OpenAI que comme client
   d'OpenRouter ; `TELEGRAM_CHANNEL_ID` et `TELEGRAM_ADMIN_CHAT_ID` en triple mais avec
   des valeurs identiques, donc sans danger).
10. Masquer les codes d'accès dans les logs restants (`[admin-grant]` est déjà corrigé).

### Backlog sécurité (non traité)
- Restreindre CORS à `touslesmatchs.com`
- Vérifier `STRIPE_WEBHOOK_SECRET` en production
- Route morte `/create-checkout-session` dans le `Caddyfile`
- En-têtes de sécurité Caddy (HSTS, X-Frame-Options, CSP)
- SRI ou copie locale pour Chart.js

---

## 7. PROCÉDURE DE DÉPLOIEMENT

```bash
cd /opt/touslesmatchs
git fetch origin claude/tiktok-arjel-automation-hgp1tv
git checkout origin/claude/tiktok-arjel-automation-hgp1tv -- \
  scripts/api_server.js public/index.html public/js/i18n.js public/performances.html \
  docker-compose.yml .env.example
docker compose up -d --build api && docker compose restart site

# Contrôles
docker logs touslesmatchs-api --tail 40 | grep -E "telegram-check|Agent weights|running on"
curl -s http://localhost:3001/tier-stats | head -c 400
```

**Ne jamais réécrire `public/index.html` en entier** (240 Ko, sections masquées
volontairement) : uniquement des modifications ciblées, puis vérifier la syntaxe des
17 scripts inline. Idem pour le `Caddyfile`.

---

## 8. RÈGLES À NE PAS ENFREINDRE

- **ANJ** : jamais le mot « pari » dans un contenu public. Utiliser « analyse IA »,
  « pick », « sélection », « signal ». Jamais de garantie de gain. Jamais de statistique
  falsifiée — les chiffres viennent de la base, pas du marketing.
- **Ne jamais casser** : Stripe, Telegram, Hermès/Concile, Live IA, Brevo, analytics,
  responsive mobile, SEO.
- **Anonymat du fondateur** : aucune fonctionnalité exposant nom, photo, voix, adresse
  ou téléphone.
- **Secrets** : jamais de clé, token ou code d'accès dans un commit, un log partagé ou
  une conversation.
