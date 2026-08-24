# Audit de mise en vente — TousLesMatchs

Objectif : préparer le site, l'application, les comptes Telegram (et tout
ce qui va avec) à être vendus. Écrit en 6 étapes séquentielles. **Chaque
étape doit être terminée, et son exécutant doit expliquer à Greg CE QU'IL
A FAIT et COMMENT, avant de passer à la suivante.** Ne pas sauter d'étape,
ne pas en faire deux en même temps.

Ce document est complémentaire de `docs/business/NOTE-SITE.md` (santé du
site pour continuer à l'exploiter) — celui-ci est spécifique à la
préparation d'une vente.

**Ce que je peux auditer moi-même (technique, chiffré, code, données) vs
ce qui doit être vérifié par un professionnel (légal, fiscal, valorisation,
contrat de cession) est marqué explicitement à chaque étape.**

---

## Étape 1 — Inventaire complet des actifs

**But** : savoir précisément ce qui sera vendu, où ça vit, et qui en a les
accès aujourd'hui.

**À produire** : un tableau avec une ligne par actif —

| Actif | Où il vit | Qui a l'accès aujourd'hui | Transférable directement ? |
|---|---|---|---|
| Nom de domaine | (registrar) | Greg | Oui |
| VPS / hébergement | Hostinger | Greg | Oui (ou migration) |
| Dépôt de code | GitHub | Greg | Oui |
| Bot Telegram + canaux (gratuit/standard/premium/elite/admin) | Telegram | Greg (BotFather) | Oui, mais transfert de propriété d'un bot Telegram a ses propres règles — à vérifier sur Telegram directement |
| Compte Stripe (produits, abonnés actifs, historique) | Stripe | Greg | Non directement — Stripe ne se "vend" pas, il faut soit transférer les abonnés vers le compte de l'acheteur, soit lui donner l'accès au compte existant |
| Compte Brevo | Brevo | Greg | Oui |
| Clés API (API-Sports, OpenRouter, IA diverses) | fournisseurs tiers | Greg | Non — ce sont des comptes personnels facturés à Greg, l'acheteur devra en recréer les siens |
| Compte TikTok | TikTok | Greg | Oui, en général |

**Livrable attendu** : ce tableau rempli avec les vrais accès actuels
(qui a le mot de passe, l'email de récupération, l'authentification à deux
facteurs), pas juste "ça existe".

**Rendre compte à Greg** : la liste complète, et signaler tout actif dont
le transfert n'est PAS simple (Stripe et les clés API sont les deux cas
déjà identifiés ci-dessus).

---

## Étape 2 — Santé technique réelle

**But** : un acheteur va faire tourner le site avant de payer. Il doit
fonctionner sans l'auteur pour l'expliquer en permanence.

**À vérifier** :
- Le moteur Concile décide de manière fiable (lié à l'item 1 de
  `NOTE-SITE.md`, actuellement rouge — **ne pas avancer sur la vente tant
  que ce point n'est pas vert**, un acheteur qui teste le produit et voit
  un moteur qui rate un vote sur trois abandonnera).
- Aucun secret (clé API, mot de passe, token) présent dans l'historique
  git — un dépôt qui part chez un acheteur expose tout son historique de
  commits, pas seulement l'état actuel des fichiers.
- `CLAUDE.md` (la documentation technique) est suffisant pour qu'un
  repreneur comprenne le code sans que Greg soit derrière lui en
  permanence.
- Liste honnête de la dette technique connue (bugs non corrigés, patches
  en attente dans `docs/proposals/`, décisions non tranchées).

**Livrable attendu** : un rapport d'état technique sans enjolivement —
"voilà ce qui marche, voilà ce qui ne marche pas encore".

**Rendre compte à Greg** : ce rapport, et confirmer explicitement si l'item
1 de `NOTE-SITE.md` est vert ou non (condition pour avancer à l'étape 3).

---

## Étape 3 — Chiffres réels (financier + usage)

**But** : un acheteur paiera en fonction de ce que le business rapporte
réellement, pas de ce qu'il pourrait rapporter en théorie. Les chiffres
doivent être vrais, datés, et vérifiables dans la base de données —
exactement comme le principe déjà appliqué sur `/analysis-history` (ne
jamais afficher un euro qui ne correspond pas à un signal réellement
envoyé).

**À produire** :
- Nombre d'abonnés actifs par palier (gratuit/standard/premium/elite) et
  revenu mensuel récurrent (MRR) actuel.
- Taux de résiliation si mesurable.
- Trafic du site (visiteurs, sources — TikTok, SEO, direct).
- Coûts récurrents réels : API IA (OpenRouter, autres), hébergement,
  abonnements outils (Brevo, etc.).
- Marge nette réelle = revenu − coûts.

**Point d'honnêteté** : la dernière mesure connue (ancienne, à
refaire) était de 2 comptes créés et 1 client payant sur 30 jours. Si
c'est toujours le cas, il faut le dire tel quel dans le rapport — un
chiffre faible mais vrai reste vendable (l'actif technique et l'audience
TikTok gardent une valeur), un chiffre gonflé découvert en diligence tue
la vente et la réputation de Greg.

**Livrable attendu** : une fiche chiffrée avec la date de mesure en toutes
lettres, aucune projection déguisée en fait.

**Rendre compte à Greg** : les chiffres, sans les habiller.

---

## Étape 4 — Conformité et risques légaux

**⚠️ Hors de mon domaine de compétence — à faire vérifier par un
professionnel (avocat spécialisé, éventuellement en droit du numérique et
des jeux/paris).** Je peux lister ce qui existe et ce qui manque
techniquement, pas certifier une conformité légale.

**À vérifier** (liste de contrôle, pas un avis juridique) :
- Conformité ANJ maintenue (déjà une exigence permanente du projet : pas
  de mot "pari", pas de garantie de gain, disclaimer joueurs-info-service).
- CGV, mentions légales, politique de confidentialité : présentes,
  à jour, et cohérentes avec ce que fait réellement le site.
- RGPD : que deviennent les données des utilisateurs (emails, historique)
  au moment de la vente ? Ça nécessite un avis juridique, pas une réponse
  technique.
- Aucun litige ou réclamation en cours (Stripe, utilisateurs, etc.).

**Livrable attendu** : la liste de ce qui existe / manque, remise à un
professionnel pour validation — pas une auto-certification.

**Rendre compte à Greg** : la liste, et la recommandation explicite de
consulter un professionnel avant toute signature.

---

## Étape 5 — Présentation pour un acheteur

**But** : un document de présentation clair, basé uniquement sur les
étapes 1 à 3 (pas d'étape 4, qui reste interne tant qu'un accord de
confidentialité n'est pas signé avec un acheteur potentiel).

**À produire** : un "one-pager" — ce qu'est le business, la stack
technique, les chiffres de l'étape 3, ce qui est inclus dans la vente
(étape 1), l'état technique honnête (étape 2). Format court, pas un
roman.

**Point d'anonymat** : ce document ne doit toujours pas exposer l'identité
du fondateur (règle permanente du projet) — un acheteur sérieux la
découvre en diligence encadrée, pas dans un document qui circule.

**Rendre compte à Greg** : le document produit, avant tout envoi à qui que
ce soit.

---

## Étape 6 — Valorisation et canal de vente

**⚠️ Également hors de mon domaine de compétence.** Je ne dois pas inventer
un prix ou une méthode de valorisation — c'est le rôle d'un expert-
comptable ou d'un broker spécialisé en cession de petits actifs
numériques.

**Ce que je peux dire, factuellement** : ce type d'actif (site + app +
communauté Telegram + code) se vend généralement soit en direct à un
acheteur déjà identifié, soit via des plateformes spécialisées dans les
petits actifs numériques (le nom générique de cette catégorie est
"micro-SaaS" / "side project acquisition"). Je ne recommande pas de
plateforme précise ici — ça se choisit avec un professionnel, en fonction
du chiffre d'affaires réel établi à l'étape 3.

**Rendre compte à Greg** : rien à produire seul ici — le point d'étape est
"Greg a consulté un professionnel", pas un document généré par l'IA.

---

## Ordre à respecter

1 → 2 → 3 → 4 → 5 → 6. Ne pas commencer l'étape 5 (présentation) avant que
3 (chiffres) soit fait honnêtement. Ne pas signer quoi que ce soit avant
que 4 (légal) soit passé par un professionnel humain.
