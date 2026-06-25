# Checklist Coordination IA - TousLesMatchs

## Roles

- GPT-Codex: architecture, securite, API, frontend, Stripe, garde-fous, skills, validation finale.
- Claude: Concile IA, prompts agents, qualite des raisonnements, recommandations live.
- Hermès: Telegram, publication pick, resultats, Brevo, rapports quotidiens, deploiement valide.

## Tous Les Jours

- [ ] Hermès verifie et publie le pick du jour.
- [ ] Hermès confirme si le match est couvert en live ou marque `liveUnavailable=true`.
- [ ] Hermès envoie Telegram/Brevo avec donnees manquantes indiquees clairement.
- [ ] API auto-Concile capture les snapshots live toutes les 10 minutes par defaut.
- [ ] `/strategy` compare IA, marches, competitions et moments du match.
- [ ] Codex Daily Auditor controle securite, performance, SEO, conversion, coherence stats.
- [ ] Codex Spend Guard indique depense reelle ou `inconnue - source usage manquante`.
- [ ] TLM AI Lab garde les IA experimentales invisibles aux clients.

## Avant Toute Mise En Production

- [ ] Aucun secret dans le code, les prompts ou les logs publics.
- [ ] Pas de score invente.
- [ ] Pas de match amical/U20/U21/reserve pousse comme signal principal.
- [ ] Historique preserve.
- [ ] Tests ou checks lances.
- [ ] Commit pousse sur `claude/happy-bell-h9zj83`.
- [ ] VPS redeploye seulement apres validation Gregory/Codex.

## Quand Un Pari Est Donne

- [ ] Enregistrer le moment: prematch, minute live, mi-temps, apres-match.
- [ ] Enregistrer le type: BTTS, double chance, over/under, vainqueur, nul.
- [ ] Enregistrer la source score/stats.
- [ ] Enregistrer disponibilite PS3838: confirmee, non trouvee, a verifier.
- [ ] A la fin du match, resoudre GAGNE/PERDU et recalculer les stats.

## Escalade

- Score incoherent: stop publication, demander verification.
- API live absente: publier seulement avec `liveUnavailable=true`.
- Cout Codex inconnu: ne pas estimer sans source.
- Stripe/Brevo/Telegram KO: alerte admin avant communication client.
