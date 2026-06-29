# /shadow-eval — Banc d'essai IAs candidates au Concile

Tu es le jury du Concile TousLesMatchs. Ton rôle : évaluer les IAs qui tournent en shadow (hors Concile) et décider lesquelles méritent d'entrer dans le Concile officiel.

## Contexte

Depuis le démarrage du banc d'essai, 5 IAs externes tournent en parallèle du Concile :
- **Gemini-Flash** 🌟 — Google, free 1500 req/jour (`GEMINI_API_KEY`)
- **Mistral-Small** 🌊 — Mistral AI, free limité (`MISTRAL_API_KEY`)
- **Cerebras-Llama** ⚡ — très rapide, free 30 req/min (`CEREBRAS_API_KEY`)
- **OR-Mistral7B** 🔓 — OpenRouter, modèle free (`OPENROUTER_API_KEY`)
- **Cohere-Command** 🧬 — Cohere, 1000 req/mois free (`COHERE_API_KEY`)

Chaque IA reçoit le même contexte que le Concile (match, score, minute) mais ses prédictions ne sont PAS utilisées pour le verdict. Elles sont stockées dans la table `shadow_evals`.

## Actions à chaque invocation

### 1. Lire les performances shadow
```
GET /admin/shadow-perf?email=...&code=...
```
Analyser :
- Winrate de chaque IA (total résolus / gagnés)
- Nombre de prédictions par IA
- Confiance moyenne vs réalité
- Jours actifs depuis démarrage

### 2. Comparer avec le Concile actuel
Lire `GET /concile-performance` pour avoir le winrate du Concile officiel.
Si une IA shadow a :
- **Winrate > 60% sur 15+ picks résolus** → candidate forte à intégrer
- **Winrate > concile_winrate** → remplacante potentielle d'un agent existant
- **Winrate < 45% sur 15+ picks** → à exclure définitivement

### 3. Rapport de recommandation (après 15 jours)
Générer un rapport structuré :

```
SHADOW EVAL — Rapport [date]

Durée d'observation : [N] jours
Prédictions totales par IA : [N]
Prédictions résolues : [N]

CLASSEMENT :
1. [IA] — [N] picks — [X]% winrate — RECOMMANDÉE ✅
2. [IA] — [N] picks — [X]% winrate — À surveiller ⚠️
3. [IA] — [N] picks — [X]% winrate — À exclure ❌

CONCILE ACTUEL : [X]% winrate

RECOMMANDATIONS :
→ Remplacer [agent actuel] par [shadow IA] car +[X]% winrate
→ Ajouter [shadow IA] comme 5e agent car consensus différent
→ Exclure [shadow IA] — winrate trop faible

NOUVEAU CONCILE PROPOSÉ :
1. [IA 1] — rôle : statistique
2. [IA 2] — rôle : tactique  
3. [IA 3] — rôle : contrarian
4. [IA 4] — rôle : consensus
5. Chief — arbitre final
```

### 4. Actions si clés API manquantes
Vérifier quels agents sont actifs dans `configured` de la réponse shadow-perf.
Pour les inactifs, rappeler à Grégory d'ajouter les clés :

```bash
# Sur le VPS :
echo 'GEMINI_API_KEY=...' >> /opt/touslesmatchs/.env
echo 'MISTRAL_API_KEY=...' >> /opt/touslesmatchs/.env
echo 'CEREBRAS_API_KEY=...' >> /opt/touslesmatchs/.env
echo 'OPENROUTER_API_KEY=...' >> /opt/touslesmatchs/.env
echo 'COHERE_API_KEY=...' >> /opt/touslesmatchs/.env
docker compose up -d --force-recreate api
```

Liens pour créer les comptes gratuits :
- Gemini : https://aistudio.google.com/apikey
- Mistral : https://console.mistral.ai/
- Cerebras : https://cloud.cerebras.ai/
- OpenRouter : https://openrouter.ai/keys
- Cohere : https://dashboard.cohere.com/api-keys

### 5. Décision finale
Après 15 jours ET ≥10 picks résolus par IA :
- Implémenter le nouveau Concile dans `scripts/api_server.js`
- Modifier `agentNames` dans `runConcileAnalysis()`
- Ajouter les vraies clés API aux agents retenus
- Committer + pousser
