# MISSION 006 — FIX N1 : InviteLinkManager cache incompatible avec memberLimit=1

## Bug

Le cache de `InviteLinkManager` stockait les liens d'invitation Telegram sans distinction de `memberLimit`. Avec `memberLimit=1`, le premier utilisateur consommait le lien unique, et tous les suivants recevaient un lien deja invalide depuis le cache.

## Solution retenue

Regle implementee dans `scripts/invite_link_manager.js` :

- **`memberLimit == 1`** : jamais de cache. Chaque appel a `createInviteLink()` genere un nouveau lien via l'API Telegram `createChatInviteLink`. Chaque utilisateur recoit un lien unique et valide.

- **`memberLimit > 1`** : cache actif. Le lien est reutilise tant qu'il n'est pas proche de l'expiration (< 5 minutes restantes). Un mecanisme de deduplication des requetes concurrentes (`_pending` Map) empeche les appels simultanes de generer plusieurs liens.

## Impact

- **Securite** : chaque utilisateur payant recoit un lien Telegram personnel, a usage unique, avec expiration
- **Business** : impossible de partager un lien premium — il est consomme apres 1 utilisation
- **Existing code** : aucune regression, le module est un nouveau fichier independant

## Performances

| Scenario | Appels API Telegram | Cache |
|----------|-------------------|-------|
| 100 users, memberLimit=1 | 100 | Non utilise |
| 100 users, memberLimit=50 | 1 | 99 hits |
| Requetes concurrentes, memberLimit=50 | 1 | Deduplication via pending promise |

Le mecanisme `_pending` garantit que meme sous charge concurrente (100 requetes simultanees), un seul appel API est effectue pour `memberLimit > 1`.

## Nouveaux tests

Fichier : `scripts/__tests__/invite_link_manager.test.js`

| # | Test | Statut |
|---|------|--------|
| 1 | memberLimit=1 cree un lien frais a chaque appel | OK |
| 2 | User A consomme, User B recoit un lien different | OK |
| 3 | 100 users memberLimit=1 = 100 liens differents | OK |
| 4 | memberLimit=50 utilise le cache au 2e appel | OK |
| 5 | memberLimit=50 avec 100 requetes = 1 seul appel API | OK |
| 6 | Cache expire quand le lien est proche de l'expiration | OK |
| 7 | chatIds differents ont des caches separes | OK |
| 8 | botToken manquant retourne erreur | OK |
| 9 | chatId manquant retourne erreur | OK |
| 10 | Erreur API Telegram retournee proprement | OK |
| 11 | Les reponses en erreur ne sont pas cachees | OK |
| 12 | clearCache supprime le cache d'un chatId specifique | OK |
| 13 | clearCache() sans args vide tout le cache | OK |
| 14 | revokeInviteLink appelle l'API Telegram correctement | OK |

## Resultats

```
Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
Regressions: 0
```

## Verdict

**VALIDABLE**

Le fix corrige la reserve bloquante N1 (cache incompatible avec memberLimit=1). Les 14 tests couvrent les scenarios demandes : utilisateur individuel, 100 utilisateurs concurrents, cache actif pour memberLimit > 1, gestion des erreurs. Aucune regression.
