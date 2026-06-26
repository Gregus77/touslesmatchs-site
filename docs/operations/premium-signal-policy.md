# Politique Elite - Signaux forts

Decision validee:

- Nom commercial: Elite.
- Prix: 19,90 EUR / mois.
- Produit vendu: alertes fortes du Concile + 30 analyses Live IA par jour.
- Seuil: 80/100 minimum.
- Sport au lancement: football uniquement.
- Exclusions: tennis, amicaux, U20/U21, ligues trop volatiles, donnees insuffisantes.
- Publication client: automatique quand `HERMES_STRONG_ALERTS_CLIENT_AUTO=1`.
- Canal historique: la variable technique reste `TELEGRAM_PREMIUM_CHANNEL_ID`, mais le nom commercial client est Elite.

Regles de communication:

- Dire "signal fort du Concile", jamais "pari sur".
- Aucun gain garanti.
- 18+ uniquement, jeu responsable.
- Les statistiques internes par IA restent privees.

Workflow:

1. Hermes detecte un signal >= 80/100.
2. Hermes l'envoie au Telegram admin.
3. Hermes publie automatiquement cote client si le signal passe le seuil Elite.
4. Gregory peut aussi republier manuellement avec `/publishalert` si necessaire.
5. Resultat final enregistre pour apprentissage.
