# Installation Hermes sur Hostinger VPS

Objectif : tout faire tourner a distance sur le VPS, sans dependance au PC de Gregory.

## Ce que le script installe/verifie

- Service Docker `hermes-admin`
- Variables obligatoires du fichier `/opt/touslesmatchs/.env`
- Dossiers de donnees `/opt/touslesmatchs/data`, `/opt/touslesmatchs/public/data`, `/var/touslesmatchs`
- Regeneration immediate de `data/hermes_memory.json`
- Cron VPS toutes les heures pour regenerer la memoire Hermes depuis les statistiques structurees
- Rapport lisible : memoire, nombre de picks appris, winrate, qualite des donnees

## Commande normale

Depuis le VPS :

```bash
cd /opt/touslesmatchs
bash scripts/hostinger-hermes-install.sh
```

## Commande avec mise a jour du code

Seulement apres validation Codex/Gregory :

```bash
cd /opt/touslesmatchs
bash scripts/hostinger-hermes-install.sh --update-code
```

Cette option fait une sauvegarde de `data/` et `public/data/`, puis force :

```bash
git fetch origin claude/happy-bell-h9zj83
git reset --hard origin/claude/happy-bell-h9zj83
```

## Verification Telegram

Dans le groupe admin Hermes :

```text
/diagtelegram
/learn
/status
```

## Comment Hermes apprend

Hermes apprend uniquement depuis les donnees structurees :

- picks resolus
- `/win`
- `/lose`
- `/record`
- historique du site
- `hermes_improvement_log.json`

Il n'apprend pas automatiquement les conversations Codex. Si une decision produit doit guider Hermes, elle doit etre transformee en code, regle ou entree structuree.

## Cron installe

Le script cree :

```text
/etc/cron.d/touslesmatchs-hermes-learning
```

Il lance toutes les heures :

```bash
cd /opt/touslesmatchs && docker compose exec -T hermes-admin node scripts/hermes_learn.js
```

Les logs vont dans :

```text
/var/log/touslesmatchs-hermes-learning.log
```

