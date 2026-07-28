# SETUP_COLLABORATION.md — Faire travailler Claude + GPT ensemble, pas à pas

Guide destiné à **Grégory (le fondateur)**. Objectif : Claude et GPT/Codex
travaillent sur **le même dépôt** sans jamais s'écraser, et **rien ne part en
production sans ton accord**.

---

## Vue d'ensemble en 1 phrase

Le « dossier partagé » est le dépôt GitHub `gregus77/touslesmatchs-site`. Chaque
IA travaille sur **sa propre branche**, et **toi seul** décides ce qui rejoint
la version officielle (`main`) via un bouton « Merge ».

---

## Étape 1 — Connecter GPT / Codex au dépôt

1. Ouvre ton outil GPT de code (au choix) :
   - **ChatGPT** avec le connecteur GitHub, ou
   - **OpenAI Codex**, ou
   - **Cursor** / **Windsurf** (éditeurs IA).
2. Dans ses réglages, autorise l'accès au dépôt `gregus77/touslesmatchs-site`.
3. Premier message à lui donner, toujours :
   > « Lis d'abord `AGENTS.md` puis `PROJECT_STATE.md`, et respecte-les. »
4. C'est tout. Il voit désormais le même code que Claude.

---

## Étape 2 — La règle des branches (qui travaille où)

- **Claude** développe sur des branches `claude/<sujet>`.
- **GPT/Codex** développe sur des branches `gpt/<sujet>`.
- **Personne** ne pousse directement sur `main`.

Ainsi, deux IA ne touchent jamais la même version en même temps. Chacune sa voie.

---

## Étape 3 — Protéger `main` (LE verrou anti-écrasement)

C'est ce qui rend impossible qu'une IA écrase le travail d'une autre sans ton
accord. À faire **une seule fois** sur GitHub :

1. Va sur `https://github.com/gregus77/touslesmatchs-site`
2. Onglet **Settings** → menu de gauche **Branches**
3. Bouton **Add branch ruleset** (ou « Add rule »)
4. Dans « Branch name pattern », mets : `main`
5. Coche :
   - ☑ **Require a pull request before merging**
   - ☑ **Require approval** (1 approbation minimum = toi)
   - ☑ **Do not allow bypassing the above settings**
6. **Save changes**

Résultat : plus aucun code n'entre dans `main` sans passer par une Pull Request
que **tu approuves manuellement**. Une IA peut proposer, elle ne peut pas imposer.

---

## Étape 4 — Le cycle de travail quotidien

Quand une IA (Claude ou GPT) finit un chantier :

1. Elle pousse sa branche (`claude/...` ou `gpt/...`).
2. Elle ouvre une **Pull Request** vers `main`.
3. **Toi**, tu reçois la PR sur GitHub. Tu regardes ce qui change (onglet « Files
   changed »).
4. Si OK → bouton **Merge**. Si pas OK → tu commentes, l'IA corrige.
5. Une fois mergé sur `main` : déploiement sur le VPS avec
   `cd /opt/touslesmatchs && bash scripts/deploy.sh`.

**Tu es le seul point de décision.** Rien ne passe sans ton clic.

---

## Étape 5 — La règle d'or (rappel de AGENTS.md)

> Aucune IA ne supprime / écrase / réécrit la dernière version d'un fichier
> produite par une autre IA **sans ton accord explicite**. Ajouter par-dessus =
> OK. Remplacer ce que l'autre vient de livrer = demander d'abord.

Cette règle est écrite dans `AGENTS.md`, que les deux IA lisent au démarrage.
La protection de `main` (étape 3) la fait respecter techniquement.

---

## Mémo — les 3 fichiers qui pilotent la collaboration

| Fichier | Rôle |
|---|---|
| `AGENTS.md` | Règles communes lues par toutes les IA au démarrage |
| `PROJECT_STATE.md` | Mémoire vivante : qui a fait quoi, chantiers ouverts, incidents |
| `SETUP_COLLABORATION.md` | Ce guide |
