# Politique Premium - Signaux forts

Decision validee:

- Nom commercial: Premium.
- Prix: 19,90 EUR / mois.
- Produit vendu: alertes fortes du Concile + 30 analyses Live IA par jour.
- Seuil: 80/100 minimum.
- Sport au lancement: football uniquement.
- Exclusions: tennis, amicaux, U20/U21, ligues trop volatiles, donnees insuffisantes.
- Publication client: manuelle au debut avec `/publishalert`.
- Publication automatique client: interdite sauf `HERMES_STRONG_ALERTS_CLIENT_AUTO=1`.

Regles de communication:

- Dire "signal fort du Concile", jamais "pari sur".
- Aucun gain garanti.
- 18+ uniquement, jeu responsable.
- Les statistiques internes par IA restent privees.

Workflow:

1. Hermes detecte un signal >= 80/100.
2. Hermes l'envoie au Telegram admin.
3. Gregory verifie la disponibilite bookmaker.
4. Gregory publie avec `/publishalert` si le signal est exploitable.
5. Resultat final enregistre pour apprentissage.
