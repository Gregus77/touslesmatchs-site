# Handoff Codex - Live multisport + Vote IA

Date : 2026-07-25
Branche active GitHub : `claude/tiktok-arjel-automation-hgp1tv`
Derniere IA site/API : Codex

## Etat a preserver

Le site est dans un etat valide pour Greg. Ne pas refaire ni ecraser ces changements.

- Live IA affiche maintenant Football, Basketball, Hockey et Baseball.
- Tennis est volontairement retire du produit client et l'ancien endpoint tennis est neutralise.
- TheSportsDB sert de source multisport secondaire pour eviter de dependre uniquement du quota API-Sports.
- La page Live IA affiche icone sport, pays/drapeau, competition, temps de jeu et logos equipes quand disponibles.
- La page d'accueil a un bloc "Matchs en cours" enrichi cote VPS dans `site/index.html`.
- Le Concile public n'est plus presente comme "Chief" : c'est un vote de 5 IA independantes.
- Les agents indisponibles/quota manquant ne doivent jamais apparaitre aux clients.
- Le lien Unibet actif est `https://www.unibet.fr/inscription/?campaign=210726&parrain=5EBF919DF1008254`.
- Le guide Telegram des types de selections existe, sans tennis.

## Commits Codex a proteger

- `d0769df` - Branche TheSportsDB live secondaire
- `9b9ee31` - Transmet la cle TheSportsDB a l API
- `a8ec97d` - Ameliore affichage live multisport
- `56a8dce` - Met a jour lien parrainage Unibet
- `c777a7a` - Masque agents indisponibles du Concile
- `9301fbd` - Evite blocage analyse Live IA
- `992e758` - Accelere verdict Concile live
- `5386c7d` - Refonde Concile en vote IA
- `16f8f8e` - Ajoute guide Telegram des marches
- `e21fd80` - Retire tennis des supports clients

## Regle d'autorite

Claude et Codex peuvent modifier le site/API quand Greg le demande.

Hermes ne doit pas pousser de modification site/API/front. Son role est audit, controle, recommandations, rapports et verification. Hermes ne doit pas modifier :

- `public/`
- `site/`
- `scripts/api_server.js`
- `scripts/bookmakers.config.js`
- `docker-compose.yml`
- `Caddyfile`

Hermes peut travailler sur ses rapports et sur `council/` seulement si Greg le valide, sans casser le site.

## Piege critique VPS

Sur le VPS, le dossier servi par Caddy est `site/`. Le repo source contient aussi `public/`.

Ne jamais copier tout `public/index.html` vers `site/index.html` sans verifier le rendu public. Cela a deja remis une ancienne version de l'accueil.

Pour Live IA, copier `public/live-ia.html` vers `site/live-ia.html` est acceptable si le fichier source vient de la branche active.

Avant toute grosse modification sur le VPS :

```bash
cd /opt/touslesmatchs
mkdir -p /opt/backups/site-handoff-$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=$(ls -td /opt/backups/site-handoff-* | head -1)
cp -a site/index.html "$BACKUP_DIR/index.html.bak" 2>/dev/null || true
cp -a site/live-ia.html "$BACKUP_DIR/live-ia.html.bak" 2>/dev/null || true
cp -a scripts/api_server.js "$BACKUP_DIR/api_server.js.bak" 2>/dev/null || true
echo "Backup: $BACKUP_DIR"
```

## Regles produit actuelles

Sports visibles : Football, Basketball, Hockey, Baseball.
Sport retire : Tennis.

Vote IA :

- 5/5 = Signal Elite, niveau le plus fort.
- 4/5 = Signal Fort.
- 3/5 = Tendance IA.
- 0/5 a 2/5 = aucun signal conseille.

Diffusion par paliers :

- Standard : unanimite 5/5 et filtres qualite existants.
- Premium : au moins 4/5 et filtres qualite existants.
- Elite : au moins 3/5 et filtres qualite existants.

Les messages publics doivent parler d'analyse IA, signal, selection, recommandation. Eviter le mot "pari" dans le contenu public.

## Commandes Telegram guide

Preview sans envoi :

```bash
cd /opt/touslesmatchs
node scripts/publish_telegram_market_guide.js
```

Envoi reel aux groupes :

```bash
cd /opt/touslesmatchs
node scripts/publish_telegram_market_guide.js --yes
```

## Commande de controle VPS

```bash
cd /opt/touslesmatchs
docker compose ps
docker logs touslesmatchs-api --tail 80
curl -s "http://127.0.0.1:3001/live-matches" | head -c 1000
```

## Prochaine IA

Avant de coder :

1. Lire `AGENTS.md`.
2. Lire ce fichier.
3. Verifier `git status --short`.
4. Ne pas toucher aux fichiers sales qui ne concernent pas la demande.
5. Sauvegarder avant toute modification VPS.
6. Commit + push sur `claude/tiktok-arjel-automation-hgp1tv` pour que l'autre IA reprenne sans conflit.
