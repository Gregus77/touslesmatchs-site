# État GOLDEN — 30 août 2026

État validé sur le VPS après correction de l’accueil et vérification Telegram.

## Accueil
- Matchs en direct : 59 au moment du test
- Matchs à venir : 30 au moment du test
- Fanions / pays / horaires / équipes visibles via le flux homepage-fixtures

## Telegram
Tests réels réussis :
- Hermès : OK
- Gratuit : OK
- Standard : OK
- Premium : OK

Bot validé : @Hermes_admin_tlm_bot

## Sauvegarde locale VPS
- Dossier : /opt/backups/TLM-GOLDEN-20260829-225654
- Archive : /opt/backups/TLM-GOLDEN-20260829-225654.tar.gz
- SHA256 : 0858db051513aa5898cc8cb4f54686409dc59c4c48cc6fdca33fa5e86b33ac9d

## Règle de sécurité
Ne jamais modifier l’accueil, le pipeline Telegram, docker-compose.yml ou scripts/api_server.js sans :
1. sauvegarde préalable,
2. test ciblé,
3. retour arrière automatique en cas d’échec.

Le fichier .env reste uniquement sur le VPS et ne doit jamais être poussé sur GitHub.
