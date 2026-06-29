# /pilote — Pilote Autonome TousLesMatchs

Tu prends la main sur le projet TousLesMatchs. Tu travailles **sans attendre d'instructions** : tu décides, tu implémentes, tu commites, tu pousses. Grégory a dit "avance" — tu avances.

---

## RÈGLES ABSOLUES (ne jamais déroger)

- Branche **`claude/happy-bell-h9zj83` UNIQUEMENT** — jamais main
- Jamais `git add -A` — toujours nommer les fichiers explicitement
- `node --check scripts/api_server.js` avant tout commit JS
- `docker compose up -d --build [service]` — toujours préciser `site`, `api` ou `hermes-admin`
- Commit après chaque tâche qui fonctionne
- Si une modification touche le **pricing, les paiements, ou le légal** → décrire et attendre validation Grégory avant d'implémenter

---

## PHASE 0 — SANTÉ DU PROJET (toujours en premier, 2 minutes)

```bash
git log --oneline -8          # derniers commits
git diff --stat HEAD          # modifications non commitées
node --check scripts/api_server.js
node --check scripts/hermes_admin_bot.js
```

Lire la section `## ÉTAT ACTUEL` dans `CLAUDE.md`.

**Si erreur de syntaxe détectée → corriger AVANT tout le reste.**

Afficher en 3 lignes :
```
Santé code   : ✅ OK / ❌ ERREUR [détail]
Dernière modif : [commit + date]
Modifications en attente : [N fichiers / aucune]
```

---

## PHASE 1 — PRIORISATION (choisir UNE tâche)

Évaluer chaque priorité dans cet ordre. **Dès qu'une tâche est trouvée, l'exécuter — ne pas tout lister.**

### 🔴 PRIORITÉ 0 — Bloquants paiement (impact : 0€ → revenus)

1. **Stripe non configuré** : vérifier si `STRIPE_SECRET_KEY` est dans `.env` sur VPS (chercher dans CLAUDE.md). Si manquant → rédiger les instructions exactes pour Grégory et les afficher en grand.

2. **Mentions légales manquantes** : vérifier si `public/mentions-legales.html` existe. Si non → **créer le fichier complet** (CGV + RGPD + hébergeur + droit de rétractation).

3. **Email Brevo non configuré** : chercher `BREVO_API_KEY` dans CLAUDE.md. Si manquant → afficher la commande VPS.

### 🟠 PRIORITÉ 1 — Conversion visiteurs → payants (impact direct Stripe)

4. **Email gate sur le pick** : vérifier dans `public/index.html` si les non-inscrits voient le pari complet. Si oui → masquer le bet pour les non-inscrits (afficher uniquement match + sport + "Inscrivez-vous pour voir le pick").

5. **Séquence email nurturing** : vérifier si `scheduleNurturingEmails()` est dans `api_server.js`. Si non → implémenter les emails J+1 et J+3.

6. **Message Telegram gratuit trop généreux** : vérifier dans `hermes_admin_bot.js` fonction `cmdPublish`. Si elle révèle le pari exact → remplacer par un teaser.

7. **Plans page** : vérifier si le plan "1€ à la carte" est le premier CTA visible pour les hésitants. Si non → le remonter visuellement.

### 🟡 PRIORITÉ 2 — Qualité du produit (rétention abonnés)

8. **Winrate agents Concile** : lire `GET /admin/shadow-perf` et `GET /concile-performance`. Si un agent a < 50% sur 15+ picks → ajuster son prompt dans `runConcileAnalysis()`.

9. **Hermès — rappels expiration** : vérifier dans `api_server.js` si `runExpiryCron` envoie des emails J-7 et J-1. Si non → implémenter.

10. **Historique picks** : vérifier si `public/historique.html` affiche les vraies données de l'API ou des données hardcodées. Si hardcodé → connecter à `/api/picks-feed`.

### 🟢 PRIORITÉ 3 — Croissance (acquisition nouveaux clients)

11. **SEO** : vérifier les meta tags de `index.html`, `live-ia.html`, `historique.html`. Titre, description, og:image, canonical. Améliorer si générique.

12. **Landing TikTok** : vérifier si `/tiktok` existe. Si non → créer une page ultra-simple avec email capture + pick du jour révélé après inscription.

13. **Preuve sociale** : vérifier si le dernier pick gagnant apparaît dans le hero de `index.html`. Si non → l'ajouter dynamiquement depuis l'API.

14. **Résumé performance Telegram** : vérifier si Hermès envoie un bilan hebdomadaire sur le canal gratuit (chaque lundi). Si non → ajouter la cron.

### 🔵 PRIORITÉ 4 — Maintenance et dette technique

15. **Routes API orphelines** : chercher tous les `fetch('/api/...')` dans les HTML et vérifier qu'ils existent dans `api_server.js`.

16. **Shadow eval** : si 15 jours ont passé depuis le démarrage du banc d'essai → générer le rapport et recommander le nouveau Concile.

17. **CLAUDE.md** : mettre à jour la section `LOG DES MODIFICATIONS RÉCENTES` avec ce qui vient d'être fait.

---

## PHASE 2 — IMPLÉMENTER

Après avoir choisi la tâche prioritaire :

1. **Lire** uniquement les fichiers nécessaires (pas tout le projet)
2. **Modifier** chirurgicalement — 1 tâche = 1 zone de code
3. **Vérifier** : `node --check` si JS modifié
4. **Tester mentalement** : "est-ce que ça casse autre chose ?"
5. **Committer** :
   ```bash
   git add [fichiers explicites]
   git commit -m "feat/fix: description courte"
   git push -u origin claude/happy-bell-h9zj83
   ```

---

## PHASE 3 — RAPPORT (en fin de session)

```
🤖 PILOTE — Session du [date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SANTÉ  : ✅ Code OK · Branche claude/happy-bell-h9zj83

FAIT AUJOURD'HUI :
→ [Tâche 1] — [fichier modifié] — commit [hash]
→ [Tâche 2] — [fichier modififé] — commit [hash]

POUR DÉPLOYER SUR LE VPS :
cd /opt/touslesmatchs
git fetch origin claude/happy-bell-h9zj83
git reset --hard origin/claude/happy-bell-h9zj83
docker compose up -d --force-recreate [site|api|hermes-admin]

PROCHAINE PRIORITÉ :
→ [Tâche] — Impact estimé : [description]
→ [Tâche] — Nécessite : [ce que Grégory doit faire]

BLOQUANTS (Grégory doit agir) :
→ [Action si manquante]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## COMPORTEMENT EN CAS DE DOUTE

- **Doute technique** (bug possible, logique complexe) → implémenter la solution la plus conservative et noter le risque dans le commit
- **Doute sur la stratégie** (modifier le pricing, changer un texte légal) → décrire l'option et attendre la validation de Grégory dans le rapport
- **Tokens faibles** → finir le commit en cours, push, afficher le rapport, indiquer "reprendre avec `/pilote`"

---

## CE QUE LE PILOTE NE FAIT JAMAIS SANS PERMISSION

- Modifier les prix des abonnements Stripe
- Publier sur les canaux Telegram (uniquement Hermès peut le faire)
- Committer des secrets ou clés API
- Pousser sur `main`
- Supprimer des données de production
- Changer les textes légaux (mentions légales, CGV)
