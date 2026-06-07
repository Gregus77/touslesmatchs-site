# 📜 MÉMOIRE DU CONCILE HERMÈS

> Ce fichier est lu par chaque IA du concile avant toute décision.
> Les leçons gravées ici ne doivent JAMAIS être oubliées ni répétées.

---

## ⚖️ RÈGLES ABSOLUES (non-négociables)

1. **JAMAIS de match amical** — peu importe les équipes, la cote, ou les stats.
   Mots-clés interdits : `friendly`, `amical`, `amistoso`, `testspiel`, `exhibition`,
   `international friendly`, `tour`, `all-star`, `showcase`.

2. **JAMAIS de match sans enjeu réel pour les deux équipes.**
   Si une équipe est déjà qualifiée/éliminée → rejet.

3. **JAMAIS de match U17-U23, Femmes, Futsal, Beach Soccer.**

4. **Test du sommeil obligatoire** : « Est-ce que je peux publier ce pick
   et aller dormir tranquille ? » Si non → NOPICK.

5. **Auto-contre-examen obligatoire** : Hermès doit toujours écrire le
   meilleur argument CONTRE son propre pick. Si pas d'argument solide →
   NOPICK (« trop facile = suspect »).

6. **On ne joue pas pour s'amuser, on joue pour gagner.**
   Mieux vaut zéro pick qu'un pick faible.

---

## 🩸 LEÇONS GRAVÉES (erreurs à ne JAMAIS répéter)

### Suisse 1-1 Australie — 06/06/2026 — Amical San Diego (PERDU)
- **Erreur** : pick "Switzerland Vainqueur" sur un match amical.
- **Cause** : équipes mixées, capitaine absent, zéro enjeu.
- **Leçon** : les amicaux internationaux sont des pièges. Stats non fiables.
- **Décision** : `BANNED_LEAGUE_KEYWORDS` inclut désormais tous les termes
  amicaux. Filtrage automatique avant analyse.

---

## ✅ RÉSULTATS CONFIRMÉS (mises à jour manuelles validées)

| Date     | Match                    | Pari               | Cote | Score | Verdict | Source        |
|----------|--------------------------|--------------------|------|-------|---------|---------------|
| 06/06/26 | Belgium vs Tunisia       | Belgium Vainqueur  | 1.6  | 5-0   | GAGNE   | RapidAPI + utilisateur |
| 05/06/26 | Russia vs Burkina Faso   | Russia Vainqueur   | 1.60 | 3-0   | GAGNE   | check_results.js |

---

## 🔌 SOURCES DE DONNÉES BRANCHÉES

- **RapidAPI free-football** : fixtures foot internationales et ARJEL
- **ClubElo.com** : ELO réel des clubs européens (mis à jour quotidiennement)
- **Table NATIONAL_ELO** : ELO sélections nationales calibré FIFA juin 2026
- **The Odds API** : cotes réelles 30+ bookmakers (foot, NHL, MLB)
  - Si `ODDS_API_KEY` est définie, les vraies cotes remplacent les valeurs par défaut
  - Les matchs NHL et MLB sont ajoutés automatiquement au pool d'analyse
  - Le flag `real_odds: true` indique que les cotes sont fiables

---

## 🤖 PROCESSUS AUTOMATIQUE EN PLACE

- **check_results.js** tourne via cron toutes les 2h (cf. crontab VPS).
- Détecte les matchs `EN ATTENTE` → interroge RapidAPI → met à jour App.js
  → reconstruit l'image Docker `site` → site mis à jour automatiquement.
- Le bot Telegram est rebuilt à chaque modification de App.js (commande
  `docker compose up -d --build bot`).

---

## 📌 NOTES DE TRAVAIL POUR LE CONCILE

- L'utilisateur (Greg) n'aime pas devoir vérifier derrière nous.
- Quand Greg dit "comme si tu jouais ta vie" : c'est une instruction
  ABSOLUE, pas une figure de style.
- Si doute → NOPICK toujours. Aucun pick n'est mieux qu'un mauvais pick.
- Hermès est chief, Claude vérifie. Tous deux gardiens de cette mémoire.
