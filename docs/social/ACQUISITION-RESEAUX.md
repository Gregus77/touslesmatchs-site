# Compteur d'acquisition Facebook / Instagram / YouTube

Mise en place : 9 octobre 2026. Source : table SQLite existante `page_views` de TousLesMatchs (`/api/t`). Aucune donnée de fréquentation inventée.

## Mesure
- Le tableau de bord privé `/admin-dashboard.html`, rubrique Acquisition, montre pour Facebook, Instagram, YouTube, TikTok et Telegram : visites approximatives par origine, pages vues et clics sur Premium aujourd'hui / 7 jours / 30 jours.
- `visiteurs estimés` = identifiants IP hachés distincts, **pas** personnes distinctes certaines. Plusieurs appareils, NAT, cookies désactivés, bloqueurs, bots, ouverture dans des applications peuvent fausser les chiffres. La table existante contient des champs IP hash et user-agent ; contrôler conformité et durée de conservation avec le DPO.
- `pages vues` = chargements effectivement mesurés via l'ancien endpoint. `clics Premium` = clics sur `/api/premium-checkout`, **pas** ventes ou abonnements Stripe.
- Un paramètre UTM explicite connu prime sur le référent ; si la source UTM est inconnue, ne pas attribuer abusivement à une autre plateforme.
- La source peut continuer dans le même onglet pendant 30 minutes via sessionStorage, sans cookie tiers. Pas de publicités ni de pixel tiers supplémentaires.
- Les anciennes publications sans liens marqués ne deviennent pas mesurables rétroactivement. Les statistiques commencent à être plus fiables avec les futurs liens UTM.

## Liens à employer sur les futurs contenus informatifs (sans obligation de publier)
- Facebook : `https://www.touslesmatchs.com/?utm_source=facebook&utm_medium=social&utm_campaign=infos_football`
- Instagram : `https://www.touslesmatchs.com/?utm_source=instagram&utm_medium=social&utm_campaign=infos_football`
- YouTube : `https://www.touslesmatchs.com/?utm_source=youtube&utm_medium=social&utm_campaign=infos_football`
- TikTok (quand connecté) : `https://www.touslesmatchs.com/?utm_source=tiktok&utm_medium=social&utm_campaign=infos_football`

**IMPORTANT :** la mise en place de liens balisés ne doit pas être confondue avec l'autorisation réglementaire de publier un message promotionnel de pronostics sportifs. Tout envoi automatique commercial reste soumis à validation juridique.

## Contrôles à faire
1. Charger une page via chaque lien UTM depuis une fenêtre de test, puis vérifier le prochain rafraîchissement du dashboard.
2. Vérifier que la page d'accueil et Live IA n'ont pas conservé deux appels /api/t par chargement.
3. Tester les versions mobile, application et navigation interne pour conserver l'origine.
4. Vérifier les logs déploiement VPS (API+site) et la politique de consentement à la mesure d'audience.
5. Ne pas remplacer ces chiffres par des statistiques de vues Instagram/YouTube : une vue de vidéo n'est pas une visite du site.
