# Note du site — TousLesMatchs

Tenue à jour par Claude (et modifiable par GPT/Codex). Objectif : que Greg
sache en un coup d'œil où ça bloque pour que le site gagne de l'argent, et
ce qu'il doit faire lui-même (payer, vérifier, décider).

**Dernière mise à jour : 25/08/2026. Solde OpenRouter confirmé sain
(12,91 $) et plafond de repli confirmé à 20 dans le conteneur. La
configuration OpenRouter est désormais vérifiée.**

Légende : ✅ acquis · ⚠️ fragile / en cours · ❌ cassé · ❓ jamais mesuré

---

## I. Le moteur doit marcher (sans ça, rien d'autre ne compte)

| # | Critère | Statut | Détail |
|---|---|---|---|
| 1 | Le Concile IA vote correctement (≥3 agents/5) | ❌ | Plafond de repli confirmé à **20** dans le conteneur le 25/08. Le problème historique reste ouvert : 37% des matchs récents décidés avec <3 votes, winrate 45% sur ces cas. Les pannes des fournisseurs primaires doivent être diagnostiquées, puis l'effet remesuré. |
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

**L'item 1 reste le blocage principal.** L'item 2 est désormais acquis :
solde sain et plafond vérifié. Un moteur qui décide à 45% de réussite sur
plus d'un tiers de ses analyses ne peut pas construire de confiance (III),
ne justifie pas d'acquisition (IV), et dégrade la rétention (VI). Tant que
l'item 1 n'est pas réglé, les autres chantiers attendent.

**Action Greg immédiate : TERMINÉE.** Solde OpenRouter confirmé à **12,91 $**
et plafond de repli confirmé à **20** dans le conteneur le 25/08. Prochaine
action technique : diagnostiquer les pannes des fournisseurs primaires,
puis remesurer le taux de matchs disposant d'au moins 3 votes.

## Prochaine remesure complète recommandée

Items 5, 7, 13, 15, 17, 19, 20 sont soit jamais mesurés soit basés sur des
données périmées. Une fois le moteur stabilisé (item 1), consacrer une
session entière à les remesurer tous d'un coup plutôt qu'un par un.
