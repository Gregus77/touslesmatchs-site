# TECHNICAL_DEBT.md — TousLesMatchs

Dette technique enregistree lors des revues de code.

---

## Mission 003 — Stripe Integration

### Reserves non bloquantes (validees)

| # | Fichier | Probleme | Impact |
|---|---------|----------|--------|
| N1 | `stripe-handler.js:158` | `e.message` expose dans la reponse webhook | Fuite d'infos internes vers Stripe |
| N2 | `stripe-handler.js:7` | Constante `PRICE_TO_PLAN` inutilisee (dead code) | Confusion maintenabilite |
| N3 | `stripe-handler.js` | `subscription_start_date` jamais peuplee | Donnee manquante pour reporting |
| N4 | `stripe-handler.js` | Pas de distinction remboursement partiel/total | Tous marques REFUNDED |
| N5 | Tests | Pas de test checkout avec plan=null | Cas edge non couvert |
| N6 | `api_server.js` | Pas de validation offset/limit sur admin events | Comportement indefini |

---

## Mission 005 — Brevo Events

### Reserves non bloquantes (validees)

| # | Fichier | Probleme | Impact |
|---|---------|----------|--------|
| R1 | `api_server.js` | Ancien chemin `brevoSendEmail` coexiste avec le nouveau bus | Doublons potentiels inter-systemes lors de la migration |
| R2 | `brevo-subscriber.js` | Crash entre send() et update("sent") → email renvoye | Risque tres faible |
| R3 | `brevo-subscriber.js` | Pas de retry automatique pour erreurs 429/5xx | Emails perdus en cas de rate limiting Brevo |
| R4 | `brevo-subscriber.js` | Pas de validation format email avant enqueue | Brevo rejette cote API |
| R5 | Tests | `_brevoApiCall` (HTTP reel) non teste | Acceptable infrastructure |
| R6 | `brevo-subscriber.js` | Dedup applicative sans contrainte UNIQUE en BDD | Acceptable single-process |

### Ameliorations a planifier

| # | Amelioration | Effort |
|---|-------------|--------|
| A1 | Retry avec backoff exponentiel pour erreurs 429/5xx | Moyen |
| A2 | Contrainte UNIQUE sur (recipient, template_key, event_id) | Faible |
| A3 | Validation format email avant enqueue | Faible |
| A4 | Statut `retry` distinct de `failed` avec compteur de tentatives | Moyen |
| A5 | Endpoint admin pour visualiser/rejouer la queue d'emails | Moyen |
| A6 | Cap d'emails par jour par destinataire | Faible |
