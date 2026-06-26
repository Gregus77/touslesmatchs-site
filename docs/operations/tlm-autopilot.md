# TousLesMatchs Autopilot

Objectif: reduire les copier-coller VPS sans laisser un bot casser le site.

## Commandes

Audit sans modifier:

```bash
cd /opt/touslesmatchs
bash scripts/tlm-autopilot.sh --check
```

Appliquer les corrections deja poussees sur GitHub:

```bash
cd /opt/touslesmatchs
bash scripts/tlm-autopilot.sh --apply
```

## Ce que fait `--apply`

1. Sauvegarde `data/`, `public/data/` et `/var/touslesmatchs`.
2. Synchronise `origin/claude/happy-bell-h9zj83`.
3. Reconstruit `site`, `api`, `hermes-admin`.
4. Verifie/installe la boucle d'apprentissage Hermes sur le VPS.
5. Regenere `data/hermes_memory.json`.
6. Verifie le pick courant, l'API publique, les logs Brevo/Stripe/Telegram.
7. Ecrit un rapport dans `/var/log/touslesmatchs/autopilot-last-report.log`.
8. Cree ou met a jour `/opt/touslesmatchs/AUDIT_HERMES_TOUSLESMATCHS.md`.

## Garde-fous

- Sans `--apply`, aucun `git reset`, aucun rebuild.
- Les secrets sont masques dans la sortie.
- Les donnees sont sauvegardees avant chaque mise a jour.
- Les commandes Telegram restent: `/diagtelegram`, `/learn`, `/status`.

## Rapport genere

Le fichier principal est:

```bash
/opt/touslesmatchs/AUDIT_HERMES_TOUSLESMATCHS.md
```

Il contient:

- etat systeme VPS Hostinger
- etat Git
- etat Docker
- etat Hermes et apprentissage
- pick courant
- API publique
- logs recents utiles
- verdict provisoire et commandes de controle

## Usage recommande

Apres un commit Codex pousse sur origin:

```bash
cd /opt/touslesmatchs
bash scripts/tlm-autopilot.sh --apply
```

Puis verifier Telegram:

```text
/diagtelegram
/learn
/status
```
