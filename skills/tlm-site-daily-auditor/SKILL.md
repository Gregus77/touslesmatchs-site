---
name: tlm-site-daily-auditor
description: Audit quotidien de TousLesMatchs.com pour securite, performance mobile, SEO, conversion, contenus, liens, paiements Stripe, Telegram/Brevo et coherence des donnees. Use when Codex must inspect touslesmatchs.com, produce a daily site health report, or prepare security and trust checks without changing production.
---

# TLM Site Daily Auditor

## Mission

Verifier chaque jour que TousLesMatchs inspire confiance, charge vite et ne publie pas de donnees incoherentes.

## Regles

- Ne jamais exposer de secret, token, cle Stripe, cle Telegram ou cle API.
- Ne jamais modifier la production sans validation explicite de Gregory.
- Ne jamais inventer un resultat, une statistique, une faille ou un cout.
- Signaler clairement si un test n'a pas pu etre execute.
- Classer chaque point: critique, important, opportunite.

## Controle Quotidien

1. Disponibilite: homepage, `/live-ia`, `/api/health` si disponible, endpoint pick du jour.
2. Performance: temps de premiere reponse, chargement mobile, image de preview Telegram, ressources lourdes.
3. Securite: HTTPS, headers, pages admin non publiques, endpoints internes proteges, aucune cle visible dans HTML/JS.
4. Donnees: pick du jour, historique, score final, gagnant/perdant, source resultat, date de resolution.
5. Monnaie: boutons Stripe, plans, quotas, webhook, messages d'erreur.
6. Acquisition: Telegram, TikTok, capture email, Brevo, liens bookmakers/affiliation.
7. SEO: titre, description, OpenGraph, favicon, sitemap/robots si presents.

## Format Rapport

```text
Audit TousLesMatchs - [date]
Etat: [OK / risque / bloque]
Critique: [1 point max]
Important: [2 points max]
Opportunite: [2 points max]
Action conseillee aujourd'hui: [une action concrete]
```

