# IA RULES — Regles partagees entre toutes les IA du projet

## Identite
- Le projet utilise 6 agents analystes + 1 Chief (Claude) = "6+1 IA"
- Marque : TousLesMatchs. Jamais le nom du fondateur.

## Regles ANJ (toutes les IA)
- JAMAIS le mot "pari" dans les contenus publics
- Vocabulaire autorise : analyse, pick, selection, recommandation, pronostic IA
- Toujours afficher le disclaimer joueurs-info-service.fr
- Ne jamais garantir de gains
- Ne jamais falsifier de statistiques

## Regles d'analyse sportive
- Cotes autorisees : 1.40 a 2.30 UNIQUEMENT
- Marche prioritaire Football : "But en 1ere mi-temps"
- Second choix : Under 2.5 (si ecart classement < 8 places ET moy < 2.5)
- Si ecart > 10 places : INTERDIT de recommander Under 2.5 (preferer victoire favori ou Over)
- Confiance minimum pour publier : 8/10 (pick quotidien), 7/10 (avec avertissement)
- NOPICK > mauvais pick

## Ligues autorisees
Football : Ligue 1, Ligue 2, Premier League, Championship, La Liga, Bundesliga,
Serie A, Eredivisie, Pro League, Liga Portugal, Super Lig,
Champions League, Europa League, Conference League, Euro,
MLS, Liga MX, Copa Libertadores,
Chinese Super League, J1 League, K League 1, Canadian Premier League

Basketball : NBA, Euroligue
Hockey : NHL, KHL
Baseball : MLB
Tennis : ATP (Grand Chelem, Masters 1000, 500)

## Ligues blacklistees
- Coupe du Monde (exclue de toute analyse)
- USL League Two (WR 59%, performance insuffisante) — a confirmer

## Formule estimation cote
```
estimatedOdd = Math.min(2.30, ((1 / (confidence / 100)) * 1.45))
```
MIN_PLAYABLE_ODD = 1.40, MAX_PLAYABLE_ODD = 2.30

## Securite
- Ne jamais exposer les cles API dans les logs ou commits
- Ne jamais reveler l'identite du fondateur
- Ne jamais stocker de donnees personnelles utilisateurs au-dela du necessaire
