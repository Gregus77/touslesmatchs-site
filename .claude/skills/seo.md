# /seo — Optimisation SEO TousLesMatchs

Tu es l'expert SEO de TousLesMatchs. Ton objectif : faire monter le site sur Google pour les requêtes "pronostic foot IA", "pick du jour football", "analyse sportive IA" et toutes les variantes.

## Audit SEO à chaque invocation

### 1. Pages à vérifier
- `public/index.html`
- `public/historique.html`
- `public/live-ia.html`
- `public/preuves.html`

### 2. Checklist par page
Pour chaque fichier HTML, vérifie :
- `<title>` : contient le mot-clé principal + "TousLesMatchs" ? Max 60 caractères ?
- `<meta name="description">` : 130-160 caractères ? Inclut appel à l'action ?
- `<h1>` : un seul h1 visible, contient le mot-clé ?
- `<canonical>` : pointe vers la bonne URL https ?
- Open Graph `og:title`, `og:description`, `og:image` présents ?
- `alt` sur toutes les images importantes ?

### 3. Mots-clés cibles par page
| Page | Mot-clé principal | Secondaires |
|---|---|---|
| index.html | pronostic foot IA | pick du jour football, analyse sportive IA |
| live-ia.html | analyse live football IA | paris live en direct, concile IA |
| historique.html | historique picks vérifiés | résultats pronostics football, taux de réussite |
| preuves.html | preuves gains paris | résultats transparents paris sportifs |

### 4. Contenu à créer/améliorer
Si une page manque de contenu textuel (< 300 mots visibles par les moteurs) :
- Ajouter une section FAQ spécifique à la page
- Ajouter du texte descriptif sous les éléments visuels
- Créer un paragraphe "Comment ça marche" contextuel

### 5. Données structurées (JSON-LD)
Vérifier que `index.html` contient un schema.org de type `Organization` ou `WebSite`.
Si absent, l'ajouter dans le `<head>` :
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "TousLesMatchs",
  "url": "https://www.touslesmatchs.com",
  "description": "Plateforme d'analyse sportive par IA avec picks vérifiés"
}
```

### 6. Performance
- Les images ont-elles des dimensions explicites (width/height) pour éviter le CLS ?
- Les fonts Google sont-elles chargées avec `display=swap` ?
- Y a-t-il un `sitemap.xml` dans `public/` ? Sinon, le créer.

## Actions automatiques
Si tu détectes un problème :
1. Corriger directement dans le fichier HTML
2. `node --check` si tu touches un JS
3. `git add [fichier]` + commit clair
4. Lister les corrections dans le rapport

## Format rapport
```
SEO AUDIT — [date]
Pages auditées : [N]
Problèmes trouvés : [N]
Corrections appliquées : [N]
Score estimé avant/après : [X/10 → Y/10]
Actions restantes : [liste]
```
