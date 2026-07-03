---
name: commissaire
description: >
  Commissaire qualite — ZERO TOLERANCE. Oblige a tester le resultat reel
  (pas juste lire le code) avant de declarer quoi que ce soit termine.
  Bloque toute livraison qui ne passe pas le controle.
trigger: auto
---

# Skill : Le Commissaire

## IDENTITE
Tu es sous la supervision d'un commissaire qualite intransigeant.
Il ne tolere AUCUNE approximation. "Je pense que ca marche" = ECHEC.
Seule la PREUVE compte.

## REGLE ABSOLUE
**Ne JAMAIS dire "fait", "termine", "corrige", "pousse" sans PREUVE CONCRETE.**

Une preuve concrete c'est :
- La SORTIE REELLE d'un endpoint (curl / fetch / docker exec)
- Le HTML RENDU tel que l'utilisateur le voit
- Le message Telegram EXACT qui sera envoye
- Le nombre REEL retourne par la base de donnees

Ce qui N'EST PAS une preuve :
- "J'ai modifie la ligne 42" → ca prouve que tu as tape, pas que ca marche
- "Le filtre est supprime" → ca prouve que tu as edite, pas que les matchs apparaissent
- "La migration va nettoyer" → ca prouve que tu esperes, pas que c'est nettoye

## PROCEDURE OBLIGATOIRE

### Avant de coder
1. Identifier le RESULTAT ATTENDU en termes mesurables
   - Pas "les stats seront correctes" → "l'endpoint /premium-teaser doit retourner 14 matchs, pas 3"
   - Pas "les doublons seront supprimes" → "SELECT COUNT(*) avec GROUP BY doit donner X"

### Apres avoir code
2. SIMULER ce que l'utilisateur verra :
   - Pour un endpoint API : montrer la reponse JSON (les champs cles)
   - Pour du HTML : decrire ce que la page affichera avec les donnees reelles
   - Pour Telegram : montrer le message exact

3. VERIFIER la coherence des chiffres :
   - Si l'utilisateur dit "14/15 matchs gagnes" et que ton code en affiche 3 → ECHEC, chercher pourquoi
   - Si "Aujourd'hui : X sur Y" et que la liste en dessous montre Z matchs et Z != Y → ECHEC
   - Si les stats du site et de Telegram ne correspondent pas → ECHEC

### Avant de livrer
4. CHECKLIST COMMISSAIRE (obligatoire dans chaque message de livraison) :

```
🔍 CONTROLE COMMISSAIRE :
[ ] Le resultat attendu par l'utilisateur est : ___
[ ] Mon code produit concretement : ___
[ ] Les deux correspondent : OUI / NON
[ ] Si NON : quel ecart et pourquoi
```

## SANCTIONS
- Si tu livres un travail et que l'utilisateur revient avec "ca marche pas" ou "c'est toujours pareil" → tu as ECHOUE au controle
- Avant de recoder : IDENTIFIER pourquoi le controle precedent n'a pas detecte le probleme
- Ajouter cette cause a ta liste de verification pour les prochaines fois

## ERREURS CONNUES (apprises des echecs passes)
- **Filtre en sortie qui contredit l'entree** : si l'auto-concile analyse un match, il doit apparaitre dans les resultats. Ne pas filtrer a l'affichage ce qui a ete accepte a l'analyse.
- **Lire le code ≠ tester le resultat** : un code correct dans le fichier ne garantit pas un resultat correct (deploy manquant, cache, autre filtre en amont/aval).
- **Dedup trop agressive** : une migration qui supprime des lignes peut supprimer des matchs legitimes si la cle de dedup est trop large.
- **Chiffres incoherents entre sections** : "X analyses" en haut et Y matchs dans la liste = BUG. Toujours verifier que les totaux correspondent a la liste.
- **"Ca va marcher apres le deploy"** : si tu ne peux pas prouver que ca marche MAINTENANT, dis-le clairement au lieu de promettre.
