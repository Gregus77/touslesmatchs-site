# Brief GPT — rendre la page d'accueil vendeuse

Contexte : Greg a signalé que le site ne convertit pas assez ("les gens
restent sur le site, ils ne comprennent pas"). Répartition habituelle :
GPT = visuel/layout/CTA, Claude = logique métier/API. Ce document couvre
la partie visuelle à traiter par GPT.

## Déjà fait par Claude cette nuit (ne pas retoucher sans besoin)
- Titre hero remplacé (plus le mot "Concile", jugé confus/religieux) :
  `5 IA analysent chaque match. On ne vous montre que leurs points d'accord.`
- Badges "Diffusé" / "Observé, non envoyé" ajoutés sur `/performances`
  pour que l'écart entre le compteur du haut et la liste s'explique tout seul.
- Correctif crash JS (pop-up bêta) qui bloquait le chargement des blocs
  "Chargement…" sur l'accueil.
- Vérifié : la section formules (`#plans`) est déjà cohérente avec le
  vrai modèle 3 paliers (Gratuit 1/j, Standard 3/j à 4,90€, Elite 10/j
  à 14,90€, branding "Live Totaux IA"). Rien à changer sur les prix/paliers.

## À traiter par GPT

### 1. Section Goal 0.5 obsolète sur l'accueil
`public/index.html` contient encore un bloc `<h2 id="goal05-title">Equipe
+0,5 but</h2>` (repéré vers la ligne 876 lors d'une lecture précédente,
la ligne peut avoir bougé). Le signal Goal 0.5 est mis en pause côté
backend (plus aucune diffusion Telegram). Afficher ce bloc en façade
alors qu'il ne tourne plus est trompeur pour le visiteur — à retirer ou
masquer (`display:none` si Greg veut le garder en réserve, comme la
convention déjà en place sur d'autres sections masquées du fichier).

### 2. Clarté du parcours de conversion
Le parcours prévu par le code est : hero → preuve → pick gratuit →
formules (`#plans`) → contenu secondaire. Vérifier que chaque étape
pousse clairement vers la suivante :
- Le hero dit maintenant "on vous montre les points d'accord" — est-ce
  qu'un visiteur pressé comprend en 3 secondes qu'il peut EN BÉNÉFICIER
  (pas juste observer) ?
- Le bouton du pick gratuit et le CTA vers les formules sont-ils visibles
  sans scroller sur mobile ?
- Les 3 cartes de formules (`#plans`) sont-elles hiérarchisées visuellement
  (la carte "Offre de lancement" / Standard est déjà mise en avant avec
  `.plan hl` — vérifier que ça reste le cas après vos changements) ?

### 3. Contraintes à respecter (rappel gouvernance)
- Ne jamais remplacer `public/index.html` en entier — modifications
  ciblées uniquement.
- Conformité ANJ : jamais le mot "pari", jamais de promesse de gain.
- Garder les marqueurs `TIER_META`, `tier-recu`, `loadDailyAccordion`,
  `nav-lang` intacts (checklist habituelle avant de livrer).
- Toute modification passe par une branche isolée, validée par Greg avant
  déploiement — comme convenu.
