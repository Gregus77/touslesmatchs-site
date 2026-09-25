# Correction ciblée des faux positifs du filtre — 25 septembre 2026

Les réserves II/III sont reconnues comme suffixes d'équipe ; `III Liga` n'est
plus confondue avec une réserve. Les expressions de catégorie utilisent des
limites de mots Unicode. `Primera D` reste interdite, sans intercepter
`Primera Division` argentine, déjà autorisée.

Les restrictions géographiques ne lisent plus les noms d'équipes. Les catégories
jeunes/réserves continuent de lire ces noms. Nations League et les alias Euro
des sélections sont explicitement exclus du produit client afin que cette
correction n'autorise pas leur analyse ou leur diffusion. Les coupes,
qualifications, barrages, amicaux et catégories féminines restent exclus.

Aucune entrée ajoutée aux whitelists, paliers ou extensions propriétaires.
Aucun seuil, modèle, quota ou code Jev modifié. Le siège logique Mistral-Large
reste résolu vers Kimi K2 par la substitution propriétaire du 19 septembre.

## Validation et production

- 99 contrôles spécifiques hors réseau sur les fonctions extraites de l'API,
  sans démarrer le serveur : ligues autorisées/exclues, collisions, sélections,
  catégories, fenêtre réelle de première mi-temps et empreintes des whitelists/roster.
- Sept suites réussies dans des conteneurs sans réseau, sans secrets et sans
  base de production : filtre, périmètre Recovery, cohérence live, première
  mi-temps, 30 scénarios Jev simulés, pipeline Jev simulé, observabilité/roster.
- Image construite depuis l'image active sauvegardée, sans installer de
  dépendances. Seul `/app/server.js` est remplacé. Deux mises à jour de l'API
  uniquement ; la seconde complète le refus structurel avec les alias Euro.
- Health et source déployée vérifiés ; identités des trois autres conteneurs
  inchangées. Environnement complet identique, `JEV_ENABLED=1` et
  `JEV_PRODUCTION_MODE=1`. Roster lu : Perplexity, DeepSeek, Kimi, Luna, Qwen.
- Aucun appel fournisseur ou Telegram réel déclenché par les tests.
  Aucune preuve naturelle Jev revendiquée par ces validations simulées.

La première tentative de déploiement a été stoppée avant redémarrage par une
comparaison sensible à l'ordre des volumes Docker. Une vérification exhaustive
a démontré l'identité de toutes les valeurs ; le reçu utilise désormais un
ordre canonique. Un test Recovery a également été relancé avec son montage de
fichiers attendu. Aucun de ces incidents n'a nécessité un changement produit.

## Sauvegarde et retour arrière

Preuves et fichiers avant modification :
`data/audits/2026-09-25-filter-false-positives/` (ignoré par Git).
Le reçu `deployment.json` contient l'image, l'heure et l'empreinte effectivement
déployées. `tests-passed.json` et les journaux gardent les résultats de validation.
Les changements de travail préexistants de l'API et des pages sont préservés et
ne font pas partie du commit de cette correction.

Image originale : `touslesmatchs-api:before-filter-20260925`.
Le déploiement restaure automatiquement cette image si ses vérifications échouent.
Retour arrière manuel, sans désactiver Jev ni modifier `.env` :

```bash
python3 data/audits/2026-09-25-filter-false-positives/deploy.py rollback
```
