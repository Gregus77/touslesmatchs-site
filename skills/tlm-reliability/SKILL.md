---
name: tlm-reliability
description: Diagnostiquer et réparer la chaîne TousLesMatchs sans fabriquer de signal ni envoyer de message client de test.
---

# Boucle de fiabilité TousLesMatchs

1. Lire `AGENTS.md`, `CHANGELOG.md` et le handoff courant. Relever branche, commit, changements locaux et `docker compose ps`. Ne jamais écraser un changement local.
2. Consulter `/admin/reliability` avec l’authentification admin/Hermes existante. La table `reliability_runs` est la preuve persistante des passages. Un passage normal effectue zéro appel IA et inscrit `codex_cost_usd=0`.
3. Ne qualifier une absence de signal que si une analyse a déjà passé les règles immuables : football public, minute 15–45 hors additionnel, consensus concordant >=3/5, marché O/U 2,5, cote réelle 1,30–2,10 et `diffusion_block IS NULL`.
4. Pour chaque destination attendue, vérifier dans `telegram_signal_deliveries` : `channel`, `telegram_message_id`, `ok=1`, `error IS NULL`. Les destinations russes sont `ru_free`, `ru_standard`, `ru_premium`, `ru_elite`. Une réponse ambiguë ou une preuve absente déclenche une alerte admin, jamais un renvoi client aveugle.
5. Avant toute modification de base/API, exécuter `./backup-db.sh avant-<incident>`. Corriger uniquement la cause prouvée, lancer les tests ciblés, puis reconstruire uniquement le service concerné. Faire `./backup-db.sh apres-<incident>` après validation.
6. Une seule tentative de réparation Codex est autorisée par incident qualifié. Utiliser un verrou anti-chevauchement; en cas d’échec, arrêter et laisser l’incident ouvert. Ne jamais modifier automatiquement seuils sportifs, prix, accès, secrets, campagnes ou protections.
7. Vérifier ensuite données fraîches, ligne `reliability_runs`, logs du passage planifié, conteneurs, endpoint concerné et rendu navigateur. Distinguer navigateur/PWA de l’APK installé.

## Accueil et cache

- Le site charge `/index.html`; la PWA et le WebView Android chargent `/app.html` (`MainActivity.java`).
- Les deux accueils utilisent `/api/homepage-live` avec les mêmes en-têtes d’authentification et `TLMMatchLifecycle.canonicalLiveMatches()`.
- Le service worker est network-first pour documents et données. Une réponse marquée `offline`/`cached` ne doit pas être présentée comme fraîche.
- La présence du fichier APK dans `public/downloads/` ne prouve pas la version installée sur un téléphone. Vérifier séparément le `versionCode`, l’URL WebView et un appareil réel.

## Interdictions

- Aucun match, vote, résultat, coût ou livraison inventé.
- Aucun message de test dans un canal client.
- Aucun appel IA payant systématique dans la surveillance.
- Aucun déploiement global si un service ciblé suffit.
