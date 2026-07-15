# 🚀 STARTUP PROMPTS — TousLesMatchs

Prompts prêts à copier-coller pour reprendre le projet ou communiquer
avec les différents interlocuteurs.

---

## 🤖 Prompt pour CLAUDE (nouvelle session Claude Code)

Colle ceci dans le **premier message** d'une nouvelle conversation Claude Code :

```
Salut Claude. Reprends le projet TousLesMatchs.

Avant TOUT : lis dans cet ordre
1. PROJECT_STATE.md
2. VERSION_LOCK.md
3. CLAUDE.md
4. docs/CONSTITUTION.md
5. docs/INFRASTRUCTURE.md
6. docs/HERMES_COUNCIL.md
7. docs/BUSINESS_GROWTH.md

Puis dis-moi :
- Le commit stable actuel
- Les chantiers ouverts
- Ce que tu comptes faire aujourd'hui

Branche de travail : claude/touslesmatchs-smoke-test-7hlgum
Ne JAMAIS revenir avant le commit verrouillé sans mon accord explicite.
```

**Résultat attendu** : Claude repart avec tout le contexte, respecte le verrou,
propose un plan avant d'agir.

---

## 🏛️ Comment "parler" à HERMES

Hermes n'a **pas de chat direct**. C'est un scheduler autonome (`council/hermes.py`)
qui tourne automatiquement tous les jours à **11h59 heure de Paris**.

### Pour modifier son comportement
Passe par Claude — je traduis tes instructions en code dans :
- `council/hermes.py` (orchestration)
- `council/prompts/agent_prompt.py` (prompt système des agents)
- `council/tools/sports_api.py` (ligues autorisées, filtres)

**Exemples de demandes valides :**
- *"Claude, dis à Hermes de ne plus jamais publier de pick sur la Ligue 2 turque."*
- *"Claude, ajoute Cohere comme 3ème agent Python d'Hermes."*
- *"Claude, force Hermes à toujours privilégier le marché 'But 1ère MT'."*

### Pour vérifier son état
Sur le VPS (terminal Hostinger noir) :

```bash
# Voir les logs des dernières décisions
docker logs touslesmatchs-council --tail 100

# Tester le filtre agents (sans rien publier)
docker exec touslesmatchs-council python /app/council/test_filter.py

# Voir l'audit complet des IA (arrive aussi sur Telegram admin)
curl "https://www.touslesmatchs.com/admin/full-agents-audit?email=gregoryguyot.gg@gmail.com&code=ELITE-ADMIN1"

# Voir l'audit du jour (matchs + résultats + minute des pronos)
curl "https://www.touslesmatchs.com/admin/daily-audit?email=gregoryguyot.gg@gmail.com&code=ELITE-ADMIN1"
```

### Pour agir en urgence
- Bot Telegram `@Hermes_admin_tlm_bot` (canal admin uniquement)
- Endpoint admin `/admin/resolve-stale` pour forcer la résolution des matchs finis
- Endpoint admin `/admin/resolve-match` pour clôturer un match manuellement

---

## 📅 Ce qui tourne TOUT SEUL (rappel)

| Fréquence | Action | Où |
|---|---|---|
| Toutes les 10 min | Résolution rapide Signal Fort | api |
| Toutes les 30 min | Résolution matchs finis | api |
| Toutes les heures | Recalcul poids agents | api |
| Toutes les heures | Ratings ligues | api |
| 11h59 quotidien | Concile Hermes → pick du jour | council |
| 20h dimanche | Bilan Signal Fort → Telegram | api |
| 20h dimanche | Audit hebdo IA → Telegram admin | api |
| 23h quotidien | Rapport visiteurs → Telegram admin | api |
| 8h lundi | Rapport marketing hebdo → Telegram admin | api |

**Tu n'as rien à faire au quotidien.** Le système s'auto-régule.
Tes seuls devoirs : lire les rapports auto qui arrivent sur Telegram admin,
et déployer les nouvelles versions quand Claude te le dit.

---

## 🚨 En cas de casse

1. Sur le VPS :
   ```bash
   cd /opt/touslesmatchs
   git fetch origin
   git reset --hard 1918412   # dernier commit stable connu (cf. VERSION_LOCK.md)
   bash scripts/deploy.sh
   ```

2. Restaurer les bases si perte de données :
   ```bash
   cp /opt/touslesmatchs/backups/<date_recent>/tlm.db /opt/touslesmatchs/data/
   cp /opt/touslesmatchs/backups/<date_recent>/codes.db /opt/touslesmatchs/data/
   docker restart touslesmatchs-api touslesmatchs-council
   ```

3. Ouvre une nouvelle session Claude Code avec le prompt du haut, et dis-lui :
   *"On a eu un incident : [décris]. Diagnostique et propose une correction."*

---

## 🔑 Rappel sécurité

- **Ne jamais** partager `ELITE-ADMIN1` en clair (à changer dès que possible)
- **Ne jamais** exposer les clés `.env` sur GitHub ou en chat
- **Ne jamais** pusher sur `main` directement — toujours sur la branche de travail
