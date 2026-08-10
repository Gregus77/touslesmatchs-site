# CBD Atlas

L'encyclopedie + l'annuaire geolocalise + la marketplace du CBD legal en France.
Trois metiers dans une seule application :

1. **Wikipedia du CBD** — toutes les formes de produits (fleur, resine, huile, e-liquide, pommade, infusion, comestible, cristaux, cosmetique), les molecules (CBD, CBG, CBN, CBC, CBDA, THC, HHC, terpenes) avec formule chimique, masse molaire, point de vaporisation, taux courants, prix constates et statut juridique.
2. **Annuaire geolocalise** — carte de France, recherche par ville ou par position GPS, rayon, horaires jour par jour, ouverture en temps reel, telephone, livraison / frais de port / delais, click & collect.
3. **Marketplace + abonnement distributeur** — les distributeurs paient un abonnement mensuel pour publier leurs boutiques et leur catalogue ; les acheteurs filtrent, ajoutent au panier et commandent.

Zero dependance npm : Node >= 18 suffit.

## Demarrer

```bash
cd cbd-app
node server.js          # http://localhost:3010
PORT=8080 node server.js
npm run reset           # regenere la base de demonstration
```

La base est un fichier JSON (`data/db.json`), cree automatiquement au premier lancement avec 6 distributeurs, 9 boutiques et 72 produits de demonstration. Il est ignore par git.

Docker : `docker build -t cbd-atlas . && docker run -p 3010:3010 cbd-atlas`

## Voir sans rien installer

Ouvrir `cbd-app/demo.html` directement dans un navigateur : meme contenu et memes ecrans (encyclopedie, carte, marketplace, formules), en un seul fichier, sans serveur ni installation. Regeneree par `node build-demo.js`.

## Pages

| URL | Role |
|-----|------|
| `/` | Accueil : chiffres cles, formes de CBD, selection produits |
| `/encyclopedie` | Fiches par forme + tableau des molecules + reperes de prix |
| `/boutiques` | Carte de France SVG, geolocalisation, fiche boutique + catalogue |
| `/marketplace` | Catalogue global, filtres (forme, prix, taux de CBD, livraison), fiche produit, panier |
| `/legalite` | Cadre juridique + verificateur de conformite en direct |
| `/pro` | Formules d'abonnement, creation de compte distributeur, tableau de bord |

## Modele economique

| Formule | Prix | Boutiques | Produits | Vente en ligne | Commission |
|---------|------|-----------|----------|----------------|------------|
| Vitrine | 29 EUR/mois | 1 | 20 | non (consultation) | — |
| Marketplace | 79 EUR/mois | 3 | 200 | oui | 5 % |
| Enseigne | 149 EUR/mois | 25 | 2000 | oui + mise en avant | 3 % |

Les limites sont appliquees cote serveur : un compte Vitrine ne peut pas vendre (`403` a la commande), un compte qui depasse son quota de boutiques ou de produits est bloque, un abonnement expire renvoie `402`.

## API

Publique :

| Route | Methode | Role |
|-------|---------|------|
| `/api/encyclopedie` | GET | Molecules, formes de produits, regles legales |
| `/api/plans` | GET | Formules d'abonnement |
| `/api/boutiques` | GET | `?q=&lat=&lng=&rayon=&livraison=1&ouvert=1` |
| `/api/boutiques/:id` | GET | Fiche + horaires + catalogue |
| `/api/produits` | GET | `?q=&type=&ville=&prix_max=&cbd_min=&achetable=1&tri=&page=` |
| `/api/produits/:id` | GET | Fiche produit |
| `/api/commandes` | POST | Panier -> commande (majorite obligatoire, un vendeur par commande) |
| `/api/conformite/verifier` | POST | Passe une fiche produit dans le filtre legal |
| `/api/stats` | GET | Compteurs plateforme |

Distributeur (`Authorization: Bearer <token>`) :

| Route | Methode | Role |
|-------|---------|------|
| `/api/pro/inscription` | POST | Cree le compte + l'abonnement, renvoie le token |
| `/api/pro/moi` | GET | Tableau de bord : plan, boutiques, produits, commandes |
| `/api/pro/boutiques` | POST | Publie une boutique geolocalisee |
| `/api/pro/produits` | POST | Publie un produit (passe par le filtre de conformite) |

## Conformite (`lib/compliance.js`)

Aucune fiche n'est publiee sans passer ce filtre :

- **THC > 0,3 %** dans le produit fini → refuse.
- **Molecules classees stupefiants** (HHC, HHC-O, HHCP, THCP, THC-O, delta-8/9/10, cannabinoides de synthese) → refuse.
- **Allegations therapeutiques** (soigne, guerit, douleur, anxiete, insomnie, medicament…) → refuse, une trentaine de termes.
- **COA et numero de lot** obligatoires pour la tracabilite.

Cote interface : controle d'age bloquant a l'entree, bandeau permanent (18 ans, THC ≤ 0,3 %, pas un medicament), confirmation de majorite a la commande, mentions legales sur chaque fiche produit, lien drogues-info-service.

## Structure

```
cbd-app/
  server.js              API + serveur statique + generateur de visuels SVG
  lib/store.js           persistance JSON (ecriture atomique + differee)
  lib/seed.js            jeu de donnees de demonstration
  lib/compliance.js      filtre legal
  content/encyclopedia.json  contenu encyclopedique (molecules, formes, legalite)
  build-demo.js          genere demo.html : version autonome en un seul fichier
  public/                pages, css, js/app.js (socle), js/carte.js (carte SVG)
```

Les visuels produits sont generes a la volee (`/img/produit/<type>.svg`) : aucun asset binaire, aucune requete externe, la carte de France est un trace SVG local (pas de tuiles tierces).

## Photos produits

Les visuels affiches suivent trois niveaux, dans cet ordre :

1. photo envoyee par le distributeur pour ce produit precis (champ `photos` de l'API) ;
2. photo de rubrique deposee dans `public/media/produits/<type>.jpg` ;
3. rendu studio genere par `lib/visuels.js` tant qu'aucune photo n'existe.

Trois facons d'installer de vraies photos, depuis une machine ayant acces au reseau :

```bash
node scripts/photos.js --pexels VOTRE_CLE      # telechargement automatique (cle gratuite)
npm run photos:liens                           # liens Pexels pre-reperes (content/photos-pexels.txt)
node scripts/photos.js --dossier ~/mes-photos  # copie depuis un dossier local
```

Le script installe une photo par rubrique, refuse les fichiers qui ne sont pas des
images, ecrit les credits dans CREDITS.txt et n'ecrase rien sans `--force`.

Deposer un fichier a la main dans `public/media/produits/` marche aussi, sans toucher au code :
redemarrer le serveur, puis relancer `node build-demo.js` pour que la version
un-fichier les embarque aussi. Voir `public/media/produits/LISEZ-MOI.txt` pour
les formats, les sources d'images libres de droits et ce qu'il ne faut pas faire.

## Pistes de suite

- Paiement reel : Stripe Checkout pour les commandes et Stripe Billing pour les abonnements (le code isole deja `commission_plateforme` et le montant mensuel).
- Geocodage automatique des adresses a la place de la saisie lat/lng.
- Comptes acheteurs, avis verifies, suivi de commande.
- Upload de photos produits et des PDF de COA.
- Fond de carte plus precis (departements) si un affichage regional devient necessaire.

## Avertissement

Contenu informatif. Le CBD n'est pas un medicament, ne soigne aucune pathologie et ne remplace aucun traitement. Vente interdite aux mineurs. Les donnees produits sont declarees par les distributeurs sous leur responsabilite.
