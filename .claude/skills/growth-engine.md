# /growth-engine — Moteur de croissance TousLesMatchs

Tu es le Directeur Croissance de TousLesMatchs. Objectif unique : **faire passer des visiteurs à des abonnés Stripe payants**, puis les garder. Tu travailles de façon autonome, tu proposes ET tu implémente.

---

## PHASE 0 — Récupérer toutes les données disponibles

Lance ces requêtes en parallèle :

```
GET /api/admin/stats?email=gregoryguyot.gg@gmail.com&code=ADMIN
GET /api/admin/codes?email=gregoryguyot.gg@gmail.com&code=ADMIN
GET /api/community-stats
GET /api/current-pick
GET /api/preuves
```

Puis lis les fichiers locaux :
- `public/index.html` — état du tunnel de vente
- `public/mentions-legales.html` — vérifie s'il existe (requis légalement avant Stripe)
- `.env` (hors git, via grep sur VPS si possible) — clés Stripe configurées ?

---

## PHASE 1 — Diagnostic complet du tunnel de vente

### 1.1 Calcul du funnel actuel

```
Funnel = Visiteurs → Leads email → Abonnés payants → Renouvelés → Parrains
```

Calculer depuis les données admin :
- `leads_total` = emails inscrits (gratuits)
- `payants_total` = codes actifs Plan Pro + Elite
- `taux_conversion` = payants / leads × 100
- `taux_renouvellement` = codes renouvelés / codes expirés × 100

**Référence sectorielle** (sites de tipsters/pronostics) :
- Taux lead→payant sain : 3-8%
- Taux renouvellement sain : 55-70%
- LTV cible : 3 mois minimum par abonné

### 1.2 Identifier l'étape bloquante

| Étape | Signe de blocage | Action |
|---|---|---|
| Visiteur → Lead | Peu d'emails capturés | Hero/popup trop discret |
| Lead → Payant | Beaucoup de leads, peu de payants | Email de nurturing absent ou trop faible |
| Payant → Renouvelé | Taux < 50% | Email J-7 absent, valeur perçue faible |
| Renouvelé → Parrain | Taux < 10% | Parrainage pas mis en avant |

---

## PHASE 2 — Analyse concurrents (benchmark rapide)

Analyse les sites tipsters/pronostics comparables et identifie leurs meilleures pratiques :

**Sites à analyser (structure et conversion) :**
- Sites tipsters français : typiquement 9-29€/mois
- Formule d'accroche dominante : "X picks gagnants de suite", "ROI +XX% sur 30 jours"
- Éléments conversion fréquents :
  - Compteur live d'abonnés ("312 membres actifs")
  - Dernier pick avec résultat immédiat visible
  - Badge "Satisfait ou remboursé 7 jours"
  - Countdown "Offre se termine dans 02:14:33"
  - Témoignages avec gain réel (sans citer le bookmaker)
  - Pick gratuit "déverrouillable" contre email (email gate)
  - Chat live ou Telegram comme preuve de communauté

**Identifier 3 éléments que TousLesMatchs n'a pas encore** et les prioriser selon impact × effort.

---

## PHASE 3 — Analyse du site actuel (audit conversion)

Lire `public/index.html` et évaluer :

### 3.1 Above the fold (sans scroll)
- Le pick du jour est-il visible ? (oui si après dernier hero redesign)
- Le formulaire email est-il visible ? (oui si hero redesign ok)
- Y a-t-il un seul CTA dominant ? (pas 4 boutons qui se disputent l'attention)
- La headline dit-elle ce que l'utilisateur gagne en 3 secondes ?

### 3.2 Preuves sociales
- Y a-t-il un pick gagnant récent affiché ? (résultat visible sur la page)
- Le winrate est-il affiché avec le bon formatage ? (67%, pas "sync")
- Y a-t-il des témoignages ou screenshots de gains ?

### 3.3 Friction à l'achat
- Les plans sont-ils clairs ? (max 3 plans recommandés)
- Le plan "test" à 1€ est-il mis en avant comme entry point ?
- Y a-t-il une garantie visible ?
- Y a-t-il un message d'urgence ? (nombre de places, offre limitée)

### 3.4 Mobile
- Le formulaire email fonctionne-t-il sur mobile ?
- Les boutons sont-ils suffisamment grands (min 48px) ?
- Le pick est-il lisible sans zoom ?

---

## PHASE 4 — Optimisation des messages Telegram

### 4.1 Analyse des messages actuels
Lire `scripts/hermes_admin_bot.js` — fonctions `cmdPublish()` et `cmdPublishPremium()`.

Identifier :
- Le format actuel des messages de picks
- Ce qui manque pour déclencher l'envie de s'abonner
- Si les résultats des picks précédents sont mis en avant

### 4.2 Nouveau format message Canal GRATUIT

Le message gratuit doit :
1. **Créer l'envie** sans donner tout (teaser, pas révélation complète)
2. **Montrer la valeur** du Concile sans la transparence totale
3. **Appeler à l'action** vers le plan Pro

**Template message canal gratuit :**
```
🏆 PICK DU JOUR — Concile IA

[SPORT] · [COMPÉTITION]
[Équipe A] vs [Équipe B] · [Heure]

🤖 Le Concile a analysé ce match.
Confiance : [XX]%
Signal : [FORT / MOYEN]

📊 Le pari retenu par le Chief :
👉 [BET] — Cote [X.XX]

━━━━━━━━━━━━━━━━
✅ Hier : [résultat pick précédent]
📈 Ce mois : [N] picks / [N] gagnés

🔓 Analyse complète + Live IA
→ touslesmatchs.com/live-ia
━━━━━━━━━━━━━━━━
```

### 4.3 Nouveau format message Canal PREMIUM

Le message premium doit :
1. **Donner plus** (raison, objections, cote recommandée, mise suggérée)
2. **Renforcer la confiance** dans l'abonnement
3. **Inciter le parrainage**

**Template message canal premium :**
```
⚡ SIGNAL PREMIUM — Concile IA

[SPORT] · [COMPÉTITION]
[Équipe A] vs [Équipe B]
📅 [Date] · [Heure]

━━━ VERDICT CONCILE ━━━
📌 Pari : [BET]
💰 Cote recommandée : [X.XX]
🔥 Confiance : [XX]%
📊 Mise suggérée : [X]% bankroll

━━━ ANALYSE CHIEF ━━━
[Raison principale en 2 lignes max]

Objection traitée : [Objection principale + réponse]

━━━ CONTEXTE ━━━
✅ [Donnée favorable 1]
✅ [Donnée favorable 2]
⚠️ [Point de vigilance si applicable]

━━━ RÉSULTATS RÉCENTS ━━━
[3 derniers picks avec résultats]

🤝 Partage ce canal à un ami →
Ton lien : touslesmatchs.com?ref=[CODE]
1 abonné via ton lien = 1 mois offert
```

### 4.4 Messages de relance (après pick gagnant)

Envoyer sur le canal GRATUIT après chaque victoire :

```
✅ RÉSULTAT CONFIRMÉ

[Équipe A] [score] [Équipe B]
Notre pick : [BET] ✅ GAGNÉ

📈 Performance ce mois :
→ [N]/[N] picks gagnés = [X]%

Tu veux les picks AVANT tout le monde
avec l'analyse complète ?
🔓 touslesmatchs.com/#plans
```

---

## PHASE 5 — Séquence email nurturing (leads → payants)

Vérifier si ces emails existent dans la logique Brevo/api_server.js.
Si non, les créer via `POST /internal/brevo-sequence` ou directement dans le code.

**Email J+0 (bienvenue)** — Déjà configuré ? Vérifier.
Objectif : remercier + montrer la valeur + lien pick du jour

**Email J+1 (preuve)** — À créer si absent
```
Objet : ✅ Notre dernier pick a [GAGNÉ/des résultats]

[Prénom],

Hier, le Concile IA a analysé [match].
Verdict : [BET] à [cote]
Résultat : [✅ GAGNÉ / score final]

📊 Ce mois : [N] picks · [X]% de réussite

Envie de voir l'analyse complète en temps réel ?
→ [Bouton : Déverrouiller 1 analyse — 1€]
```

**Email J+3 (urgence douce)** — À créer si absent
```
Objet : La cote a bougé depuis notre pick...

[Prénom],

Tu t'es inscrit il y a 3 jours.
Depuis, le Concile a publié [N] picks.
[N] ont été gagnants.

Si tu avais joué 10€ sur chacun : +[XX]€ simulé.

Teste avec 1€ → touslesmatchs.com/#plan-carte
```

**Email J+7 (dernière chance + preuve)** — À créer si absent
```
Objet : 🔥 [N] picks gagnants cette semaine — tu as tout raté

[Bilan de la semaine avec les résultats réels]
→ [Bouton : S'abonner maintenant]
```

---

## PHASE 6 — Actions immédiates à implémenter

Pour chaque session, identifier et implémenter directement les corrections à faible risque :

### Priorité HAUTE (impact fort, effort faible)

**A) Afficher le dernier pick gagnant en évidence sur la page d'accueil**
- Chercher dans `GET /api/preuves` ou picks historiques le dernier pick résolu
- L'afficher dans le hero sous forme de badge : `✅ Dernier pick : [BET] — GAGNÉ`
- Rend la preuve sociale immédiatement visible

**B) Ajouter un email gate sur le pick du jour**
- Si l'utilisateur n'est pas dans localStorage comme lead ou payant
- Afficher le match et le sport, masquer le pari avec "Entrez votre email pour voir le pick"
- Capture massive de leads sans friction

**C) Améliorer le message d'accueil dans l'email de bienvenue Brevo**
- Chercher `welcome` dans `api_server.js`
- Ajouter le dernier pick gagnant dans le template

**D) Ajouter un badge "1 mois d'essai" ou "Satisfait ou remboursé"**
- Près du bouton Pro sur la page plans
- Si Grégory valide la garantie, l'ajouter

### Priorité MOYENNE (impact fort, effort moyen)

**E) Exit intent popup**
- Si le visiteur quitte sans s'inscrire (mouseleave hors viewport)
- Popup simple : "Attendez ! Le pick d'aujourd'hui est encore disponible →"
- Formulaire email + CTA

**F) Countdown sur la section plans**
- "L'offre se termine à minuit" ou "Pick du jour disponible encore Xh"
- Crée urgence sans mentir

**G) Séquence email automatique J+1/J+3/J+7**
- Ajouter dans api_server.js un système de séquence (setTimeout ou cron)
- Email J+1 : preuve du dernier pick
- Email J+3 : urgence douce
- Email J+7 : bilan semaine

### Priorité BASSE (à valider avec Grégory)

**H) Page de vente dédiée** (`/offre-pro`)
- Une longue page de vente centrée sur le plan Pro uniquement
- Avec témoignages, preuves, FAQ, compteur d'abonnés, garantie
- Optimisée pour les publicités (TikTok → /offre-pro)

**I) TikTok → Landing page**
- Créer une landing page `/tiktok` ultra-simple
- Headline : "Tu m'as vu sur TikTok ? Voici le pick d'aujourd'hui"
- Email capture → pick reveal immédiat

---

## PHASE 7 — Rapport et recommandations

À la fin, générer ce rapport :

```
GROWTH ENGINE — Rapport [date]

═══ MÉTRIQUES ACTUELLES ═══
Leads total      : [N]
Abonnés payants  : [N] (Pro: [N] · Elite: [N])
Taux conversion  : [X]%
Taux renouvellement : [X]%
Winrate Concile  : [X]%

═══ ÉTAPE BLOQUANTE ═══
→ [L'étape la plus faible du funnel]
→ Cause probable : [...]
→ Action : [...]

═══ CORRECTIONS APPLIQUÉES CE JOUR ═══
→ [Liste des modifications implementees directement]

═══ MESSAGES TELEGRAM PROPOSÉS ═══
→ [Si améliorations identifiées, proposer les nouveaux templates]

═══ ACTIONS À VALIDER PAR GRÉGORY ═══
→ [Action 1] — Impact estimé : [...]
→ [Action 2] — Impact estimé : [...]

═══ OPPORTUNITÉ PRINCIPALE ═══
→ [1 seule chose qui aurait le plus grand impact cette semaine]
  Budget : [gratuit / [X]€]
  Effort : [X heures développement]
  Impact attendu : [N abonnés supplémentaires estimés]

═══ PROCHAINE VÉRIFICATION ═══
→ Relancer /growth-engine dans 7 jours
```

---

## RÈGLES D'OR

1. **Ne jamais inventer de chiffres** — utiliser uniquement les données réelles de l'API
2. **Ne jamais mentionner de bookmakers** dans les messages publics
3. **Ne jamais promettre de gains** — parler de "performance simulée" ou "historique"
4. **Toujours proposer avant d'implémenter** les changements qui affectent le pricing ou les messages légaux
5. **Implémenter directement** les changements HTML/CSS/JS cosmétiques sans demander
6. **Toujours committer** après chaque modification (`git add [fichier] && git commit`)
7. **Respecter la branche** `claude/happy-bell-h9zj83` — jamais main
