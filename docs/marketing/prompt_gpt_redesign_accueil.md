# Brief pour GPT-5.6 — Redesign visuel de la page d'accueil TousLesMatchs

Copie tout ce qui suit dans GPT-5.6.

---

## Contexte

Je travaille sur **TousLesMatchs**, un site français d'analyses sportives par
intelligence artificielle (5 IA indépendantes qui votent sur chaque match).
Le développeur principal (une autre IA, Claude) gère tout le code, l'infra et
l'intégration — je te sollicite spécifiquement pour une **direction visuelle
et un design de page d'accueil plus premium et plus vendeur**, pas pour
écrire le code final qui sera déployé (Claude s'occupera de l'intégration
réelle à partir de tes propositions).

## Ce que je veux de toi

Propose une **nouvelle direction visuelle pour la page d'accueil**, sous
forme de :
1. Un moodboard / palette de couleurs (avec codes hex précis)
2. Une hiérarchie visuelle repensée section par section (qu'est-ce qui doit
   sauter aux yeux en premier, deuxième, troisième...)
3. Du HTML/CSS autonome (une seule page, pas de framework externe) pour
   chaque section clé, que je pourrai transmettre à Claude pour intégration
4. Des suggestions de micro-animations/interactions qui donnent une
   impression "premium" sans surcharger

## Contraintes techniques (à respecter absolument)

- **Une seule page HTML**, CSS inline dans un `<style>` en tête de fichier
  (pas de framework CSS externe type Tailwind/Bootstrap — vanilla CSS avec
  variables `:root`)
- **Mobile-first obligatoire** : la majorité du trafic est mobile
- Palette actuelle (tu peux la faire évoluer, mais elle doit rester premium/
  sombre, pas un site sportif criard) :
  ```css
  --bg:#12152a; --panel:#171b34; --panel2:#1e2340;
  --tx:#f6f7ff; --tx2:#c4c9e6; --muted:#949bc4;
  --violet:#8a68ff; --violet2:#a688ff; --blue:#4b7bff; --cyan:#4fd6f2;
  --standard:#6a9bff; --premium:#a688ff; --elite:#eab24a;
  --green:#3ddb96; --red:#f16e80;
  ```
- Police actuelle : Inter (système), poids 800-900 sur les titres
- Pas de dépendance à des polices/icônes payantes ou à un CDN qui pourrait
  tomber (auto-hébergé ou système uniquement)

## Contraintes réglementaires FRANÇAISES (non négociables, ANJ)

Le site n'est PAS un site de paris — c'est un site d'ANALYSE. Ces règles
doivent transparaître dans le ton ET dans le contenu que tu génères :
- **Jamais le mot "pari"** dans un texte visible (utiliser "analyse",
  "pronostic", "pick", "recommandation IA")
- **Jamais de garantie de gain**, jamais de "gagnez à coup sûr", jamais de
  visuel suggérant l'argent facile
- Le disclaimer "18+, jouez avec modération, joueurs-info-service.fr" doit
  rester visible (footer actuellement)
- Aucune photo/nom/voix du fondateur — la marque communique, jamais une
  personne identifiable

## Structure actuelle de la page (ce qu'il faut réorganiser, pas réinventer)

1. **Nav** sticky (logo, liens, badge du palier d'abonnement, CTA connexion)
2. **Hero + matchs en direct** — angle actuel : "vote multi-IA en direct"
3. **Matchs à venir** (encart séparé)
4. **Barre de preuves chiffrées** (nombre d'analyses, taux de réussite réel)
5. **Derniers verdicts du Concile** (accordéon par jour)
6. **Pick gratuit du jour** (seul, doit être immédiatement visible — c'est
   l'appât pour convertir un visiteur en inscrit)
7. **Capture email** (déclenche une séquence de nurturing automatique)
8. **Formules d'abonnement** (Standard / Premium / Elite — 3 paliers, doit
   donner envie de prendre le palier du milieu ou le plus haut)
9. **Contenu secondaire** (méthode, preuves détaillées, FAQ)

## Ce qui ne va pas actuellement (mon avis, sers-t'en comme direction)

- Le site "ne fait pas rêver" — trop utilitaire, pas assez premium/désirable
- Le tunnel visiteur → pick gratuit → abonnement doit rester le même
  parcours, mais visuellement plus impactant à chaque étape
- Je veux que l'angle différenciant (5 IA indépendantes qui votent,
  transparence totale sur les résultats gagnés ET perdus) soit visuellement
  central, pas juste écrit en texte

## Ce que je ferai de ta réponse

Je transmettrai ton HTML/CSS et tes recommandations à Claude, qui vérifiera
la conformité ANJ, l'intégrera au vrai code du site (avec les vraies données
dynamiques : picks réels, stats réelles, formules Stripe réelles) et
déploiera. Tu n'as donc pas besoin de te soucier du back-end, des vraies
données, ni du JavaScript de fonctionnement — uniquement du HTML/CSS/design
statique avec des données d'exemple réalistes.
