# 🚀 POUR LES IA — TousLesMatchs (à lire par GPT 5.6, Claude, Hermès, Codex…)

> Ce fichier est écrit pour Grégory (fondateur, **non codeur**). Il sert à ce que
> n'importe quelle IA reprenne le travail **sans casser** ce que les autres ont fait.
> Grégory : quand tu changes d'IA, colle-lui juste le **BLOC 1** ci-dessous. C'est tout.

---

## 🟦 BLOC 1 — À COLLER À N'IMPORTE QUELLE IA (GPT 5.6, etc.)

```
Tu reprends le développement de TousLesMatchs.com (analyses sportives par IA —
on ne dit JAMAIS le mot "pari", conformité ANJ obligatoire).

1. AVANT TOUT, lis ces 2 fichiers à la racine du repo GitHub
   "Gregus77/touslesmatchs-site", branche "claude/tiktok-arjel-automation-hgp1tv" :
   - AGENTS.md   (architecture, endpoints, liens bookmakers, règles, pièges déploiement)
   - CHANGELOG.md (tout ce qui a déjà été fait)

2. Travaille sur TA PROPRE branche (ex: "gpt/ma-tache"), JAMAIS sur "main"
   ni sur la branche de Claude.

3. NE CASSE JAMAIS : les endpoints API, les liens bookmakers
   (scripts/bookmakers.config.js = Winamax/Unibet/PMU, surtout PAS Betclic),
   Stripe, Telegram, Brevo, le Concile IA. Aucune clé/token dans le code.

4. ZONES : Telegram + Brevo + dossier council/ = zone Hermès (ne pas toucher
   sans accord). Site (public/) + API (scripts/) = zone dev.

5. Après chaque changement : commit clair préfixé [GPT], et ajoute une ligne
   dans CHANGELOG.md.

MON IDÉE / MA DEMANDE :
👉 (Grégory écrit ici ce qu'il veut, en français simple)

CONTEXTE ACTUEL 2026-07-24 :
- Dernier commit fonctionnel Codex : 9e65437.
- Accueil refait avec Standard 4,90 EUR/mois, Premium 14,90 EUR/mois, Elite/VIP 29,90 EUR/mois.
- Liens Stripe branches, historique veille replie par defaut, matchs live cliquables vers les offres.
- A faire ensuite : logos/fanions des equipes + vrais matchs temps reel plus visibles en haut du direct.
```

---

## 🟩 BLOC 2 — DÉPLOYER (à coller dans le terminal du serveur)

Remplace `LA-BRANCHE` par la branche de l'IA (ex: `claude/tiktok-arjel-automation-hgp1tv`) :

```bash
cd /opt/touslesmatchs && git fetch origin LA-BRANCHE && git checkout origin/LA-BRANCHE -- public/ scripts/ && docker compose up -d --build
```

⚠️ **Si le déploiement touche le `Caddyfile`** (l'IA te le dira), il faut d'abord le débloquer :
```bash
cd /opt/touslesmatchs && chattr -i Caddyfile && git show origin/LA-BRANCHE:Caddyfile > Caddyfile && docker compose up -d --build
```

**Vérifier que tout va bien après :**
```bash
docker compose ps && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/current-pick
```
(le code `200` = tout marche)

---

## 🟨 BLOC 3 — SAUVEGARDER (avant/après un changement qui touche la base)

```bash
cd /opt/touslesmatchs && ./backup-db.sh avant-modif
```
puis, après :
```bash
cd /opt/touslesmatchs && ./backup-db.sh apres-modif
```

---

## 🟥 BLOC 4 — QUI FAIT QUOI (pour que personne ne se marche dessus)

| IA | S'occupe de | Ne touche PAS |
|----|-------------|---------------|
| **Claude** | Site (`public/`), API (`scripts/`), SEO, UX, paliers | — |
| **GPT 5.6** | Site + API (sur sa branche) | `council/` sans accord |
| **Hermès** | Concile Python (`council/`), Telegram, Brevo | `public/`, `scripts/api_server.js` |

**Règle d'or :** chaque IA sur SA branche → on ne perd jamais rien (tout est dans GitHub).
En cas de doute, demander à Grégory.

---

## 🟪 BLOC 5 — CE QU'ON NE CHANGE JAMAIS SANS ACCORD DE GRÉGORY

- Le mot "pari" (interdit ANJ) · le disclaimer joueurs-info-service.fr
- Les liens bookmakers (Winamax/Unibet/PMU) · pas de Betclic
- Les prix des abonnements · le tunnel de vente
- Les clés API / tokens (jamais dans le code)
- L'anonymat du fondateur (jamais son nom/photo/voix sur le site)
