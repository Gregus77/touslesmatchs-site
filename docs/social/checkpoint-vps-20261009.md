# Checkpoint VPS — 9 octobre 2026

Installation contrôlée : /opt/touslesmatchs ; sauvegarde /opt/touslesmatchs/backups/social-autonomy-20261009T025344Z.
Timer tlm-social-publication.timer actif, cycle toutes les cinq minutes, indépendant du poste Windows. Dernier rapport relu : 2026-10-09T03:05:08 UTC.
Export canonique /data/social-source.json actualisé ; /social/current/fr.html, /en.html et /content.json HTTP 200 vérifiés. Les pages reflètent les archives FR/EN. Ceci ne prouve aucune nouvelle publication sociale automatique.

## Preuves de diffusion déjà obtenues
Les trois campagnes Instagram/Facebook du 9 octobre ont leurs URLs PUBLISHED enregistrées dans l’archive sociale séparée.
Telegram avant-match : Gratuit FR 623 puis EN 624 ; Premium FR 210 puis EN 211.
Telegram russe confirmé par ok=true et message_id : Gratuit RU 78 ; Premium RU 97.
Message de rapport Hermès 4006 confirmé. Aucune adresse de canal privée ni secret dans ce document.
YouTube est connecté à Metricool ; aucun upload YouTube prouvé. TikTok non connecté.

## Blocages et remédiation
- OPENAI_API_KEY installée mais test API refusé : HTTP 401 invalid_api_key. Créer une nouvelle clé dans le projet OpenAI de l’utilisateur, activer sa facturation API si nécessaire ; remplacer uniquement l’environnement du service par un fichier root privé /etc/tlm-social-runtime.env (0600). Ne jamais envoyer de clé dans une conversation, un log ou Git.
- Metricool : aucune credential serveur. Accès API direct réservé aux offres Advanced/Custom selon la documentation officielle. Récupérer le token dans Paramètres du compte > API ; installer METRICOOL_API_TOKEN avec les identifiants de marque vérifiés puis contrôler les permissions et les réponses réelles.
- Ces identifiants ne suffisent pas à eux seuls : config initiale modèle/budget zéro, circuit API à réarmer après test privé valide, activation réseaux après vérification.
- Pré-match Metricool reste bloqué volontairement faute de garantie de publication avant le coup d’envoi. Mécanisme d’expiration à compléter et tester.
- Adaptateurs vidéo YouTube/TikTok/Snapchat absents. Cartes récurrentes RU non implémentées ; les messages RU 78/97 sont des envois effectivement réalisés séparément.
- Groupes anglais séparés non créés : le Bot API ne crée pas de groupe. Nécessite le compte Telegram du propriétaire puis routage/contrôle Premium EN.

Aucune annonce de gains, cote inventée ou signal 4/5 non vérifié. @parrainagebanque exclu. Aucun accès illimité, essai gratuit ou hausse de prix promis.
