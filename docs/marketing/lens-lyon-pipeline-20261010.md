# Pipeline des affiches Lens–Lyon — version préparatoire (10/10/2026)

**Statut : code en revue, non déployé.** Ce document ne constitue pas une preuve d'envoi Telegram, ni de publication Metricool.

## Charte graphique immuable
- Référence approuvée par le fondateur : image ChatGPT Library « Lens–Lyon : analyse du match.png » (9 octobre 2026).
- Stade bleu nuit, éclairage cinématographique, deux joueurs adultes de dos, un par équipe, couleurs et logos authentiques seulement lorsqu'ils sont fournis comme sources fiables.
- Les noms exacts des équipes, classements, score, minute, cote et statut doivent venir de données vérifiées. Ne jamais inventer une statistique.
- Les images générées sont des illustrations, pas des photos officielles des joueurs.
- La stratégie sportive est exclusivement +0,5 but d'une équipe (CURRENT_RULES.md). Plus de O/U 2,5 dans les nouveaux visuels.
- Un visuel marqué « surveillance » ou « pas de pari » n'est PAS un signal officiel.

## Phase 1 ajoutée dans cette branche
- `scripts/generate_lens_lyon_poster.js` : entrée JSON *vérifiée* (fixtureId numérique, vrais clubs, championnat whitelist, Top5/Bottom5, couleurs, timestamp). Le mode sans `--generate` imprime le prompt sans appel facturé.
- Avec `--generate` et une clé `OPENAI_API_KEY` explicitement configurée, crée une image PNG carrée dans `public/media/matches/<fixtureId>.png` et un manifeste JSON non secret. Le résultat porte `reviewStatus: "unreviewed"`. Le visuel est généré **une seule fois par fixture**, puis recyclé (contrôle d'identité).
- L'image utilise l'API Images OpenAI (par défaut `gpt-image-2.5-flare`). **Ce budget est distinct d'OpenRouter**. Ne pas activer sans plafond d'utilisation approuvé.
- `public/index.html` : affiche la photo si elle existe, conserve les noms/score/minute HTML réels au-dessus, laisse la fiche originale si la photo est absente.
- `scripts/telegram_client.js` : le transport accepte `sendPhoto` uniquement avec une image HTTPS du domaine TousLesMatchs, `posterReviewed: true` et une légende < 1024 caractères. Même table de preuve `message_id` ; pas de contournement de la validation sportive.
- Option `TLM_VISUAL_PUBLISH_ENABLED=1` : le scanner peut fractionner une liste en un message par match **si chaque ligne possède une affiche revue**. Cette option n'est pas activée dans le déploiement actuel.

## Exemple de préparation (schéma, aucune affirmation sportive)
```json
{
  "fixtureId": 123456789,
  "home": "Equipe A",
  "away": "Equipe B",
  "targetTeam": "Equipe A",
  "country": "Pays",
  "competition": "Championnat autorisé",
  "homeColor": "#bb2222",
  "awayColor": "#2266aa",
  "targetRank": 2,
  "opponentRank": 18,
  "teamCount": 20,
  "leagueAllowed": true,
  "snapshotAt": "2026-10-10T00:00:00Z"
}
```
**Ceci est un exemple de données techniques, pas un véritable match.** Le rang, la couleur et la whitelist doivent provenir de la source sportive validée et être contrôlés avant d'appeler le générateur.

```bash
node scripts/generate_lens_lyon_poster.js /chemin/fixture-verifie.json
# Pas de facturation. Inspecter d'abord le JSON source et le prompt.
node scripts/generate_lens_lyon_poster.js /chemin/fixture-verifie.json --generate
# APRES validation du budget image, configuration secrète OPENAI_API_KEY et contrôle source
```

## Travaux restants pour le passage production
1. Câbler le scanner *effectivement déployé sur le VPS* à ce générateur ; `scripts/social/pipeline.py` observé sur VPS n'existe pas actuellement sur la branche principale GitHub. **Ne pas présumer qu'il est versionné.**
2. Ajouter un passage de revue qualité automatisable / humaine pour approuver le PNG, vérifier texte, club et maillot. Renseigner `posterReviewed` uniquement après l'approbation. Aucune légende « signal officiel » si un critère manque.
3. Garantir le service public du dossier `/media/matches` en production (Docker Caddy monte `public` sur `/srv`), sauvegarde/rétention/quotas disque et suppression contrôlée.
4. Intégrer la génération et l'URL du média aux données du site / aux lignes du scanner ; sans cela la compatibilité média ajoutée dans la branche reste inactive.
5. Raccorder Metricool marque Tous Les Matchs (Facebook, Instagram, YouTube) : formats adaptés (1:1 / 4:5 / vidéo 9:16 pour YouTube), journaliser le résultat fournisseur, ne pas inventer une publication. Aucun autopost pendant cette phase.
6. Tests réels sur les trois canaux Telegram avec mention TEST / NE PAS JOUER et preuves `message_id` indépendantes. Interdire les faux positifs hors whitelist (issue #179).
7. Contrôler la production et sa disponibilité avant d'activer, puis fusionner uniquement après approbation du fondateur.

## Critères de sécurité
- **Aucune publication automatique activée par cette PR.**
- Pas de clé dans GitHub, pas de rechargement OpenRouter et pas de dépense OpenAI avant configuration.
- Si image absente, la page continue d'afficher le score en direct au format existant.
- Si le transport Telegram reçoit une image absente, URL extérieure, ou légende trop longue, il revient à `sendMessage`; l'activation images doit attendre que le pipeline renseigne les affiches approuvées.
