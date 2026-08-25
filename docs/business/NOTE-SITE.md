# Note du site — TousLesMatchs

Tenue à jour par Claude (et modifiable par GPT/Codex). Objectif : que Greg
sache en un coup d'œil où ça bloque pour que le site gagne de l'argent, et
ce qu'il doit faire lui-même (payer, vérifier, décider).

**Dernière mise à jour : 25/08/2026 (soir). Panne reelle du jour trouvee
et corrigee : plafond de matchs/jour trop bas (12 -> 30), qui bloquait TOUT
le vote du Concile depuis l'apres-midi. Premiers signaux Telegram et
premiers resultats gagne/perdu confirmes par Greg apres correction.**

Légende : ✅ acquis · ⚠️ fragile / en cours · ❌ cassé · ❓ jamais mesuré

---

## I. Le moteur doit marcher (sans ça, rien d'autre ne compte)

| # | Critère | Statut | Détail |
|---|---|---|---|
| 1 | Le Concile IA vote correctement (≥3 agents/5) | ⚠️ | **Panne réelle trouvée et corrigée le 25/08 au soir : `OPENROUTER_MAX_MATCHES_PER_DAY` était à 12, alors que 16+ matchs distincts étaient déjà analysés dans la journée — plus aucun agent officiel ne pouvait voter (log `[ai-guard]`, raison `[LIMIT] plafond de matchs analysés/jour atteint`). Passé à 30. Confirmé en cours de test : Telegram recommence à envoyer les signaux ET à revenir avec gagné/perdu en fin de match.** Reste en ⚠️ (pas ✅) tant qu'un cycle complet n'a pas été observé sur plusieurs jours — ne pas déclarer l'item réglé après une seule bonne soirée. Point secondaire non urgent : le modèle de secours "chief" est désactivé dans `ai_models.config.js`, sans lien apparent avec cette panne (Chief a un chemin par défaut séparé). |
| 2 | Le budget OpenRouter tient sans interruption | ✅ | Solde à 12,91 $ le 25/08 (Greg vient de recharger 10 $). Historique sur 10 semaines : rechargements réguliers, ~108 $ au total (juin-août), rythme récent plus rapproché (tous les 5-7 jours en août contre 2-3 semaines en juin) — la consommation a augmenté, à surveiller mais pas alarmant. Auto top-up **désactivé** : pas de risque de charge surprise, mais aucun filet si Greg oublie de recharger. |
| 3 | Pas de fuite de ligue non fiable analysée à tort | ⚠️ | Coppa Italia Serie C trouvée (22 analyses, 41%), correctif prêt (`7c80c78`), **pas encore déployé** — en attente validation Codex. |
| 4 | Les chiffres publics (winrate, gains €) sont exacts | ✅ | Séparation "résultats abonnés" / "analyses non diffusées" déployée en production — plus d'euros affichés sur des signaux jamais envoyés. |
| 5 | L'infrastructure VPS/Docker est stable | ❓ | Jamais auditée dans ce fil. À faire : uptime des 4 services, taille disque, logs d'erreur récurrents. |

## II. Conformité ANJ (obligatoire, non négociable)

| # | Critère | Statut | Détail |
|---|---|---|---|
| 6 | Zéro mot "pari" côté public | ✅ | Vérifié systématiquement à chaque livraison (grep automatique). |
| 7 | Disclaimer joueurs-info-service affiché | ❓ | Jamais revérifié récemment sur le site en ligne. |
| 8 | Aucune garantie de gain formulée | ✅ | Règle respectée dans tout le code touché récemment. |
| 9 | Anonymat du fondateur préservé | ✅ | Aucune fonctionnalité créée n'expose nom/photo/voix. |

## III. Donner confiance (convertir un visiteur en compte)

| # | Critère | Statut | Détail |
|---|---|---|---|
| 10 | Page performances = preuve crédible | ✅ | Reconstruite, filtrable par palier, historique daté. |
| 11 | Rien de masqué dans l'historique | ✅ | Objectif direct du correctif de l'item 4. |
| 12 | Perception premium (design, hero) | ⚠️ | Travail GPT en cours par ailleurs ; badges de palier corrigés mais patch **non appliqué** (en attente validation Greg+GPT+Codex). |

## IV. Faire venir du monde (acquisition)

| # | Critère | Statut | Détail |
|---|---|---|---|
| 13 | TikTok actif, contenu régulier | ❓ | Dernière donnée connue (ancienne) : très peu de trafic généré par ce canal. À remesurer. |
| 14 | SEO (pages pronostics, sitemap) | ✅ | Livré. |
| 15 | Trafic organique en croissance | ❓ | Dernière mesure connue (ancienne) : 114 visiteurs uniques / 30 jours. **Périmée, à refaire.** |

## V. Transformer un visiteur en client payant

| # | Critère | Statut | Détail |
|---|---|---|---|
| 16 | Stripe fonctionnel (checkout + webhook) | ✅ | Aucune régression connue. |
| 17 | Nombre de comptes / clients payants | ❓ | Dernière donnée connue (ancienne) : 2 comptes créés, 1 client payant. **Périmée, à refaire.** |

## VI. Garder le client (rétention)

| # | Critère | Statut | Détail |
|---|---|---|---|
| 18 | Canaux Telegram actifs et alimentés | ⚠️ | Dépend directement de l'item 1 : moteur dégradé = moins de signaux envoyés. |
| 19 | Emails Brevo (nurturing) opérationnels | ❓ | Jamais revérifié dans ce fil. |

## VII. Que ça rapporte plus que ça ne coûte

| # | Critère | Statut | Détail |
|---|---|---|---|
| 20 | Revenu ≥ coût IA + abonnements | ❓ | Jamais calculé formellement. Coûts connus : OpenRouter (variable), GPT 100 $/mois, Claude 20 $/mois. Revenu : inconnu sans remesurer l'item 17. |

---

## Priorité absolue, là maintenant

**Panne majeure corrigee le 25/08 au soir.** Le site n'analysait plus AUCUN
match correctement depuis l'apres-midi (plafond de 12 matchs/jour atteint,
tous les agents refuses). Corrige (plafond a 30), premiers signaux et
premiers resultats confirmes par Greg.

**A faire dans les prochains jours, pas ce soir** : laisser tourner
plusieurs jours avant de repasser l'item 1 en vert. Une seule bonne soiree
ne prouve pas la stabilite — c'est exactement le genre d'erreur qu'on a
deja faite cette nuit (declarer un point regle trop vite). Remesurer le
taux de matchs a >=3 votes dans une semaine, comme prevu par la routine
hebdomadaire deja en place.

## Prochaine remesure complète recommandée

Items 5, 7, 13, 15, 17, 19, 20 sont soit jamais mesurés soit basés sur des
données périmées. Une fois le moteur stabilisé (item 1), consacrer une
session entière à les remesurer tous d'un coup plutôt qu'un par un.
