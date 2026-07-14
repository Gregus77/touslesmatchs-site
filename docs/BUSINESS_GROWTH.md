# 💰 DÉVELOPPEMENT BUSINESS — TousLesMatchs

## Tunnel de vente (source unique de vérité)

```
TikTok content  →  TousLesMatchs.com  →  Telegram Gratuit
                                              ↓
                       Analyse à 1€  →  Pro 9,90€/mois  →  Elite 19,90€/mois
```

**Ne jamais complexifier ce tunnel.** Chaque étape doit convertir avant
d'ajouter la suivante.

## Objectifs KPI

| KPI | Baseline (juil 2026) | Objectif fin 2026 | Objectif fin 2027 |
|---|---|---|---|
| Visiteurs uniques / mois | 3 000 | 30 000 | 200 000 |
| Taux conversion visiteur → Telegram | 5% | 12% | 18% |
| Taux conversion Telegram → 1€ | 2% | 8% | 15% |
| Taux upsell 1€ → Pro | 10% | 25% | 35% |
| Taux Pro → Elite | 5% | 15% | 25% |
| MRR (revenu récurrent mensuel) | 200 € | 6 940 € | 79 350 € |
| Churn mensuel Pro/Elite | inconnu | < 8% | < 5% |

## Priorisation par ROI

Chaque chantier est évalué sur 3 axes :

| Axe | Poids | Description |
|---|---|---|
| Impact CA à 90j | 40% | € additionnels attendus |
| Effort dev | 30% | heures estimées |
| Risque casse | 30% | proba de régression |

**Score ROI = (Impact / Effort) × (1 - Risque)**

Les chantiers avec ROI > 3 sont priorisés.

## Chantiers ordonnés par ROI décroissant

### 🥇 SEO mondial (ROI estimé : 8)
- Balises structurées schema.org (SportsEvent, Review)
- Sitemap XML dynamique
- Backlinks partenaires ARJEL
- Contenus SEO longs (guides "comprendre les cotes", "value bets", etc.)
- Optimisation vitesse (LCP < 2,5s)

### 🥈 Multilingue (ROI estimé : 7)
- `public/js/i18n.js` existe → étendre à EN et ES
- URLs `/en/`, `/es/`
- Redirection Accept-Language
- Contenus traduits automatiquement puis review humaine

### 🥉 Landing pages ciblées (ROI estimé : 6)
- `/premier-league`, `/ligue1`, `/nba`, `/champions-league`
- Une page par ligue majeure = mot-clé longue traîne
- CTA unique : "voir les analyses de ce soir"

### Brevo nurturing (ROI estimé : 5)
- Séquence 7 jours post-inscription gratuite
- Emails déclenchés : nouveau Signal Fort, résultat gagnant, promotion Pro
- Segmentation : gratuit / 1€ / Pro / Elite

### Cross-sell & Upsell (ROI estimé : 5)
- Après un pari gagnant : *"Passe Pro et reçois 3 signaux/jour"*
- Après un pari perdu : *"Le Concile Elite aurait évité ce piège"*
- Rappel à J+7 avant fin d'abonnement

### Fidélisation (ROI estimé : 4)
- Programme parrainage : 1 mois offert pour 1 filleul payant
- Streak "N jours consécutifs consulté" avec badges
- Concours mensuel : meilleur bettor du mois → Elite offert

### Responsive audit (ROI estimé : 4)
- Mobile-first (déjà en place, à durcir)
- Tablette (souvent négligé)
- Amélioration Lighthouse mobile : cible score > 90

### Nouveaux abonnements (ROI estimé : 3)
- **Journée VIP** : 4,90€ pour 24h d'accès Elite → conversion impulsive
- **Annuel Elite** : 199€/an (économie ~17%) → réduit churn
- **Bundle bookmaker** : partenariat ARJEL → 3 mois offerts si dépôt

### Partenariats bookmakers ARJEL (ROI estimé : 3)
- Winamax, Unibet, PMU, Betclic → affiliation
- Bannière discrète dans les analyses Elite (conforme ANJ)
- Revenue share : ~50€ par nouveau joueur

## CGU et conformité

À finaliser (bloquant pour scale legal) :

- [ ] Mentions légales complètes
- [ ] Politique de confidentialité RGPD
- [ ] CGU d'utilisation (droit de rétractation 14j, hors abonnement souscrit)
- [ ] CGV Stripe (facturation, remboursement)
- [ ] Disclaimer ANJ sur toutes les pages (joueurs-info-service.fr)
- [ ] Bandeau cookies (Consent Mode v2 pour Analytics)

## Roadmap trimestrielle

### Q3 2026 (juil-sep)
- [x] Refactoring moteur consensus Phase 1
- [x] Verrouillage architecture (VERSION_LOCK)
- [ ] SEO mondial (schema.org + sitemap)
- [ ] Audit sécurité + rotation clés
- [ ] CGU complètes

### Q4 2026 (oct-déc)
- [ ] Multilingue EN
- [ ] Landing pages ligues majeures
- [ ] Séquence Brevo complète
- [ ] Journée VIP (4,90€ 24h)
- [ ] Moteur consensus Phase 2 (poids dynamiques)

### Q1 2027 (jan-mar)
- [ ] Multilingue ES
- [ ] Partenariat 1er bookmaker ARJEL
- [ ] Programme parrainage
- [ ] Moteur consensus Phase 3 (décision calculée)
- [ ] Bundle annuel Elite

### Q2 2027 (avr-juin)
- [ ] Application mobile (React Native ou PWA installable)
- [ ] Marketplace de picks (créateurs indépendants)
- [ ] IA vocale personnalisée (chatbot audio Elite)

## Marketing content

### TikTok (canal d'acquisition principal)
- 1 vidéo par jour minimum
- Formats : révélation du pick du jour, débrief résultats, "comment lire une cote"
- CTA systématique : lien bio → touslesmatchs.com
- Anonymat fondateur maintenu (voix IA ou faceless content)

### Telegram
- Canal gratuit : 1 analyse teaser par jour + résultats de la veille
- Canal premium (Pro/Elite) : 3-5 signaux/jour + Signal Fort + débrief live
- Bot support : réponses automatiques FAQ

### Emails Brevo
- Newsletter hebdo : bilan de la semaine + top pick à venir
- Emails transactionnels : bienvenue, confirmation paiement, fin d'essai

## Métriques à monitorer chaque semaine

1. MRR + churn
2. Coût d'acquisition client (CAC) TikTok vs Brevo
3. LTV moyen par plan (1€ / Pro / Elite)
4. Top 3 sources de trafic
5. Winrate Concile (indicateur de confiance)
6. NPS (Net Promoter Score) — sondage trimestriel

---

*Ce document est le plan de croissance. Toute décision business doit
respecter la priorisation ROI ci-dessus.*
