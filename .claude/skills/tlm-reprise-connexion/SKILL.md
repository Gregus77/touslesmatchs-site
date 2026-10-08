---
name: tlm-reprise-connexion
description: Reprendre sans doublons une mission TousLesMatchs après coupure réseau, perte de contexte ou changement de conversation, à partir du checkpoint GitHub.
---

# Reprise fiable après interruption (TousLesMatchs)

## Déclencheurs
À la demande « continue », « reprends », « connexion perdue », « tu en étais où » ou après une nouvelle session de travail sur ce dépôt.

## Procédure obligatoire (ne pas repartir de zéro)
1. Lire `CURRENT_RULES.md`, puis `docs/handoff/reprise-session-active.md`.
2. Vérifier dans GitHub le SHA de la branche de travail, la PR ouverte et les derniers commits. Considérer le checkpoint comme une piste, **pas comme une preuve de déploiement**.
3. Reconstituer les tâches **déjà commitées**, les tests à faire et l'étape atomique suivante. Ne jamais rejouer une mutation déjà réussie (idempotence).
4. Si le dépôt a changé depuis le checkpoint, regarder le diff et préserver les travaux concurrents. Ne pas écraser `main`, une branche `claude/*`, les secrets ou les historiques.
5. À chaque étape atomique réussie, actualiser le checkpoint (commits, tâche, état, tests, blocages, prochain geste).
6. Reprendre immédiatement la première action sûre et disponible ; s'il manque un accès indispensable, décrire l'étape bloquée sans prétendre l'avoir exécutée.
7. Après tests, ouvrir/mettre à jour la PR dédiée, contrôler ses checks, et seulement ensuite envisager fusion/déploiement selon les règles du projet.
8. Ne jamais inventer une validation CI, un envoi Telegram, une cote, un déploiement VPS ou une confirmation de paiement.

## Limite explicite
Ce skill fournit **la persistance de l'état** entre sessions et permet une reprise au prochain message/contexte exécutable. Il ne détecte pas les coupures de ChatGPT, ne s'exécute pas pendant que la conversation est déconnectée et ne peut pas démarrer une exécution autonome sans déclencheur externe.

## Format du checkpoint
Conserver systématiquement les rubriques : objectif / branche+PR / dernière étape terminée / preuves / prochaine action / tests / sécurité / horodatage. N'inscrire aucune clé ni donnée client.
