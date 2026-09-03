# Directeur autonome TousLesMatchs

Ce composant exécute chaque heure un audit de production, répare uniquement les
incidents opérationnels réversibles, vérifie le résultat et prévient le canal
Telegram d'administration Hermès lorsqu'une décision humaine est nécessaire.

## Réparations automatiques autorisées

- redémarrer une seule fois un conteneur absent de l'état `running` ou déclaré
  `unhealthy` ;
- redémarrer l'API si son contrôle public échoue ;
- vérifier le retour du conteneur et du contrôle public après l'action ;
- appliquer un délai de six heures avant de retenter la même réparation.

## Limites volontaires

Le directeur ne modifie jamais les clés, quotas payants, prix Stripe, règles de
sélection, seuils, code applicatif, branches Git ou données clients. Ces cas sont
signalés avec leurs preuves dans Hermès.

## Vérification manuelle

```bash
sudo systemctl start tlm-autodirector.service
sudo systemctl status tlm-autodirector.timer --no-pager
sudo journalctl -u tlm-autodirector.service -n 100 --no-pager
sudo python3 /usr/local/sbin/tlm-autodirector.py --dry-run --report-always
```
