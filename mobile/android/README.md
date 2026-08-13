# TousLesMatchs Android — APK bêta

Objectif : créer une application Android bêta connectée au compte TousLesMatchs existant.

## Positionnement

- Application d'accès aux analyses et à l'espace abonné.
- Aucune prise de pari dans l'application.
- Aucun dépôt, retrait, portefeuille joueur ou redirection obligatoire vers un pari.
- Les liens externes comme Telegram s'ouvrent hors de l'application.
- Mention +18 et jeu responsable à conserver dans les pages servies par le site.

## Parcours bêta

1. L'utilisateur installe l'APK.
2. L'application ouvre l'espace abonné : `https://www.touslesmatchs.com/dashboard.html`.
3. L'utilisateur se connecte avec son email et son code.
4. L'accès visible dépend de l'abonnement déjà payé sur le site.
5. Les liens Telegram/support s'ouvrent dans Telegram ou le navigateur.

## Build APK

Depuis ce dossier :

```bash
gradle :app:assembleDebug
```

APK attendue :

```text
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Si Java ou Gradle ne sont pas installés localement, utiliser le workflow GitHub `build-android-apk.yml`.
