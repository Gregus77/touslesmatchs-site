# Mesure d'acquisition sociale — 9 octobre 2026

Objectif : compter les visites arrivant sur TousLesMatchs depuis Facebook, Instagram, YouTube, TikTok et Telegram sans les confondre avec vues, abonnés ou impressions sur les plateformes.

- Source : table SQLite `page_views` et balises `/api/t` déjà présentes. Aucun cookie, ID publicitaire ou base tiers ajouté.
- Nouvelle surface : console administrateur protégée `/admin-dashboard.html`, données intégrées à `/admin/dashboard-data` déjà accessible seulement avec droits administrateur.
- Réseaux : UTM explicite en priorité ; à défaut, domaine fiable du referrer (sous-domaines exacts uniquement). Un referrer masqué signifie trafic non attribuable, non pas zéro audience réelle.
- Visites : sessions **estimées** sur la base des empreintes IP déjà collectées et une fenêtre de 30 minutes. Visiteurs estimés = nombre d'empreintes distinctes, ni personnes vérifiées ni sessions authentifiées. Compteurs aujourd'hui (Paris), 7 jours, 30 jours.
- Déduplication : une navigation sur plusieurs pages dans les 30 minutes depuis la même source ne devient pas plusieurs visites, dans la limite de l'empreinte existante.
- Collecte : accueil et Live IA avaient déjà une balise ; application et Performances utilisent une seule balise complémentaire. Aucun suivi des activités internes/admin.
- Aucun chiffre commercial exposé au public, aucune donnée brute ni `ip_hash` renvoyés au navigateur admin.
- Les liens à copier sont proposés dans la carte d'administration : `?utm_source=facebook|instagram|youtube|tiktok|telegram&utm_medium=organic_social&utm_campaign=tlm_social`.
- Si une publication utilise un lien non balisé et que la plateforme supprime son referrer, son trafic ne peut pas être reconstitué rétroactivement.
- La confidentialité et le paramétrage des balises déjà présentes sur le site doivent rester soumis à contrôle réglementaire ; la modification n'ajoute aucun mécanisme de consentement publicitaire.
- Tests : `node scripts/test_social_traffic_20261009.js`, `node --check scripts/api_server.js`. Aucun chiffre de visiteurs inventé dans cette livraison.

## Contrôle production
Après fusion : déploiement API + site, connexion réelle à la console admin, vérifier que les 5 lignes réseau existent, qu'un clic sur un lien UTM relève le compteur (sans confondre cet essai avec un utilisateur acquis). Vérifier les logs sans afficher d'empreintes ni d'identifiants.
