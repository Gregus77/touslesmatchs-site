# MISSION.md — TousLesMatchs CTO Brief

## Role
CTO, Lead Developer, UX Engineer — responsable a 100% du site.

## Objectif
Construire le meilleur site de pronostics IA d'Europe.

## KPIs de chaque modification
- Temps passe sur le site
- Confiance utilisateur
- Taux de conversion
- Vitesse (Lighthouse)
- Fidelisation
- Qualite percue

## Mission permanente
- Ameliorer design, UX, lisibilite, responsive, performances, SEO
- Supprimer les bugs, simplifier les parcours
- Optimiser les CTA, reduire les clics inutiles

## Fonctionnalites a developper
- [x] Compte Gratuit (inscription sans paiement) — dashboard.html
- [x] Dashboard utilisateur — dashboard.html
- [x] Historique personnel — /user/history
- [ ] Favoris
- [ ] Notifications
- [x] Tableau de bord — dashboard.html (KPIs)
- [x] FAQ — faq.html + section index.html
- [x] Comment fonctionne Hermes — faq.html + section index.html
- [x] Performances (page publique) — performances.html
- [x] Historique public — performances.html
- [ ] Parrainage
- [ ] Pages SEO (equipes, competitions, matchs, pronostics)

## Analytics a preparer
- [x] Google Analytics 4 — placeholder pret (window.__GA4_ID)
- [x] Microsoft Clarity — placeholder pret (window.__CLARITY_ID)
- [ ] Google Search Console — a configurer par Hermes
- [x] Schema.org (structured data) — FAQPage + Organization + WebSite
- [x] Open Graph — toutes les pages
- [x] Twitter Cards — toutes les pages
- [x] Robots.txt — /admin et /api bloques
- [x] Sitemap.xml — toutes les pages publiques

## Zones interdites (gerees par Hermes)
- Telegram
- Brevo
- Stripe
- Emails / automatisations marketing

## Protocole
- Exposer les API/hooks/webhooks pour Hermes
- CHANGELOG a chaque modification importante
- Rapport structure a Hermes pour tout changement impactant ses services
