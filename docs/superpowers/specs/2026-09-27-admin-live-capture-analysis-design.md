# Analyse Live par captures - conception administrateur

## But

Ajouter une analyse declenchee par Gregory a partir de captures, sans modifier le moteur automatique, le tarif Premium de 14,90 EUR, Stripe, Telegram, Jev, Kimi ni le roster public.

## Portee initiale

- Acces administrateur uniquement, derriere `LIVE_CAPTURE_ADMIN_ENABLED`.
- Quatre a dix images PNG, JPEG ou WebP.
- Au moins trois captures de cotes et une capture de statistiques.
- Une IA vision extrait les donnees; Gregory confirme ou corrige.
- Les cinq sieges existants analysent uniquement le JSON confirme.
- Aucune diffusion Telegram, Brevo ou publique.
- Dix analyses maximum par jour et par administrateur.
- Images privees supprimees sous vingt-quatre heures.

## Etats

`draft` -> `extracted` -> `confirmed` -> `analysed` -> `resolved`.

La confirmation cree un instantane immuable. Une correction ulterieure cree une nouvelle version.

## Sortie

Le serveur regroupe les bulletins par marche et selection, calcule probabilite moyenne, cote juste, value et accord. Les noms des fournisseurs restent internes.

- `VALUE` si probabilite x cote >= 1,05.
- `COHERENT` entre 0,95 et 1,05.
- `RISQUE` sous 0,95 et clairement presente comme a eviter.

## Donnees, securite et cout

SQLite conserve sessions, instantanes, bulletins immuables et resolutions. Les images ne sont jamais en base. Types MIME verifies, 1,5 Mo par image et 12 Mo au total. Une extraction vision par session; les cinq sieges recoivent le JSON, jamais les images. Tokens et couts sont journalises.

Apres resolution: Brier, log loss et ROI simule. Une ponderation `1 / Brier` peut seulement etre proposee apres cinquante predictions resolues par siege; elle n'est jamais appliquee automatiquement.

La premiere livraison reste admin uniquement. L'ouverture Premium sera une decision ulterieure et ne changera pas automatiquement le tarif de 14,90 EUR.
