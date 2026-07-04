# BREVO_SETUP.md — Mission 001: Fondation Brevo

## 📋 Table des matières

1. [Configuration](#configuration)
2. [Architecture](#architecture)
3. [API du module](#api-du-module)
4. [Exemples d'utilisation](#exemples-dutilisation)
5. [Tests](#tests)
6. [Mode test (ONLY_EMAIL)](#mode-test-only_email)
7. [Logs](#logs)
8. [Dashboard admin](#dashboard-admin)
9. [Troubleshooting](#troubleshooting)

---

## Configuration

### Variables d'environnement

```bash
BREVO_API_KEY=<clé API Brevo>
BREVO_SENDER_EMAIL=noreply@touslesmatchs.com
BREVO_SENDER_NAME=TousLesMatchs
ONLY_EMAIL=test@example.com  # (optionnel, pour mode test)
```

### Obtenir la clé API Brevo

1. Aller sur [brevo.com](https://www.brevo.com)
2. S'identifier
3. Aller dans **Paramètres > Clés API**
4. Créer/copier la clé API v3
5. La mettre dans `.env`

---

## Architecture

### Module centralisé: `scripts/brevo.js`

Toute communication avec Brevo passe par ce module unique. Le reste du projet l'importe et l'utilise.

**Avantages:**
- ✅ Pas d'appels directs à l'API Brevo ailleurs
- ✅ Logs centralisés
- ✅ Mode test centralisé
- ✅ Facile à maintenir et déboguer

### Structure des fichiers

```
scripts/
  ├── brevo.js                 # Module centralisé (NOUVELLE MISSION 001)
  ├── send_welcome_email.js    # Refactorisé pour utiliser brevo.js
  ├── send_sequence_email.js   # Refactorisé pour utiliser brevo.js
  └── test_brevo.js            # Tests de connexion

logs/
  └── brevo/
      └── 2026-07-04.log       # Logs du jour
```

---

## API du module

### Contacts

```javascript
const brevo = require("./brevo");

// Créer un contact
const contact = await brevo.createContact(
  "user@example.com",
  "Jean",
  "Dupont",
  { PLAN: "FREE", IS_ACTIVE: "true" }
);

// Récupérer un contact
const existing = await brevo.getContact("user@example.com");

// Mettre à jour un contact
await brevo.updateContact("user@example.com", { PLAN: "ESSENTIEL" });

// Supprimer un contact
await brevo.deleteContact("user@example.com");
```

### Listes

```javascript
// Récupérer toutes les listes
const lists = await brevo.getLists();

// Créer une liste ou la récupérer si existe
const list = await brevo.getOrCreateList("My List");

// Initialiser les 4 listes standards
const allLists = await brevo.ensureLists();
// Retourne: { FREE, ESSENTIEL, ELITE, PAY_PER_VIEW }

// Ajouter un contact à une liste
await brevo.addContactToList("user@example.com", 5);

// Retirer un contact d'une liste
await brevo.removeContactFromList("user@example.com", 5);
```

### Tags

```javascript
// Appliquer des tags
await brevo.tagContact("user@example.com", ["FREE"]);

// Retirer des tags
await brevo.untagContact("user@example.com", ["FREE"]);
```

Tags disponibles: `FREE`, `ESSENTIEL`, `ELITE`, `PAY_PER_VIEW`

### Synchronisation

```javascript
// Synchroniser un utilisateur TousLesMatchs avec Brevo
const user = {
  email: "user@example.com",
  firstName: "Jean",
  lastName: "Dupont",
  plan: "ESSENTIEL",
  createdAt: "2026-07-04T10:00:00Z",
  isActive: true,
  expiresAt: "2026-08-04T23:59:59Z"
};

await brevo.syncUser(user);
```

### Emails

```javascript
// Envoyer un email
await brevo.sendEmail(
  "user@example.com",
  "Sujet du mail",
  "<p>HTML content</p>",
  "Contenu texte"  // optionnel
);
```

### Stats

```javascript
// Récupérer les stats
const stats = await brevo.getStats();
// Retourne:
// {
//   apiConnected: true,
//   contactsCount: 123,
//   listsCount: 4,
//   lists: [{ id: 5, name: "Gratuit" }, ...],
//   lastSync: "2026-07-04T10:30:00Z",
//   testMode: false,
//   errors: []
// }
```

---

## Exemples d'utilisation

### Exemple 1: Intégrer dans api_server.js

```javascript
const brevo = require("./brevo");

app.post("/api/subscribe", async (req, res) => {
  const { email, firstName, lastName, plan } = req.body;
  
  try {
    // Créer/synchroniser le contact
    await brevo.syncUser({
      email,
      firstName,
      lastName,
      plan: plan || "FREE",
      createdAt: new Date().toISOString(),
      isActive: true
    });

    // Envoyer un email de bienvenue (sera fait en Mission 002)
    
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});
```

### Exemple 2: Mettre à jour un plan

```javascript
await brevo.syncUser({
  email: "user@example.com",
  firstName: "Jean",
  lastName: "Dupont",
  plan: "ESSENTIEL",  // Changé de FREE
  createdAt: "2026-07-01T10:00:00Z",
  isActive: true,
  expiresAt: "2026-08-01T23:59:59Z"
});

// Tags appliqués automatiquement:
// - Supprime tag FREE
// - Ajoute tag ESSENTIEL
```

### Exemple 3: Désactiver un utilisateur

```javascript
await brevo.syncUser({
  email: "user@example.com",
  firstName: "Jean",
  lastName: "Dupont",
  plan: "ESSENTIEL",
  createdAt: "2026-07-01T10:00:00Z",
  isActive: false,  // Désactivé
  expiresAt: "2026-07-04T23:59:59Z"
});
```

---

## Tests

### Tester la connexion (mode sécurisé)

```bash
# Avec votre email de test
ONLY_EMAIL=votre-email@example.com BREVO_API_KEY=<clé> node scripts/test_brevo.js
```

### Résultat attendu

```
1️⃣  Récupération des stats...
   ✓ API connectée: ✅
   ✓ Contacts: 42
   ✓ Listes: 4
   Listes existantes:
     - Gratuit (ID: 5)
     - Essentiel (ID: 6)
     - Elite (ID: 7)
     - À la carte (ID: 8)

2️⃣  Vérification des listes...
   Listes prêtes: ...

3️⃣  Test contact (mode test)...
   ✓ Contact créé: ID 12345

4️⃣  Test tags...
   ✓ Tag FREE appliqué

5️⃣  Test envoi email...
   ✓ Email envoyé: 123456789

✅ TOUS LES TESTS RÉUSSIS
```

---

## Mode test (ONLY_EMAIL)

### Purpose

Protéger les données réelles lors des tests locaux.

### Comportement

Quand `ONLY_EMAIL` est défini:
- ✅ Les contacts ne sont modifiés QUE pour cet email
- ✅ Les autres emails sont skippés
- ✅ Les logs indiquent `"testMode": true`
- ✅ Les erreurs n'affectent que cet email

### Exemple

```bash
# Tester UNIQUEMENT avec votre email
ONLY_EMAIL=claude@example.com node scripts/send_welcome_email.js

# Production (pas de ONLY_EMAIL)
node scripts/send_welcome_email.js
```

### Logs avec TEST_MODE

```json
{
  "timestamp": "2026-07-04T10:30:45Z",
  "action": "contact_created",
  "data": { "email": "claude@example.com", "firstName": "Claude", "id": 123 },
  "testMode": true
}
```

---

## Logs

### Emplacement

```
logs/brevo/
  ├── 2026-07-04.log
  ├── 2026-07-05.log
  └── ...
```

### Format

```json
{
  "timestamp": "2026-07-04T10:30:45.123Z",
  "action": "contact_created|contact_updated|contact_deleted|email_sent|user_synced|...",
  "data": { ...détails... },
  "testMode": false
}
```

### Actions loggées

- `contact_created` — Création de contact
- `contact_updated` — Modification de contact
- `contact_deleted` — Suppression de contact
- `contact_tagged` — Tags appliqués
- `contact_untagged` — Tags supprimés
- `email_sent` — Email envoyé
- `user_synced` — Utilisateur synchronisé
- `list_created` — Liste créée
- `contact_added_to_list` — Contact ajouté à liste
- `contact_removed_from_list` — Contact retiré de liste
- `*_error` — Erreurs de toutes les opérations

---

## Dashboard admin

### Endpoint: `GET /admin/brevo-stats`

```bash
curl "http://localhost:3001/admin/brevo-stats?email=admin@example.com&code=secret"
```

### Réponse

```json
{
  "ok": true,
  "brevo": {
    "apiConnected": true,
    "contactsCount": 142,
    "listsCount": 4,
    "lists": [
      { "id": 5, "name": "Gratuit" },
      { "id": 6, "name": "Essentiel" },
      { "id": 7, "name": "Elite" },
      { "id": 8, "name": "À la carte" }
    ],
    "lastSync": "2026-07-04T10:30:00Z",
    "testMode": false,
    "errors": []
  }
}
```

### Affichage dans admin-dashboard.html

Ajouté dans l'onglet "Brevo" du dashboard admin:
- API connectée ✅/❌
- Nombre de contacts
- Nombre de listes
- Dernière synchronisation
- Erreurs éventuelles

---

## Troubleshooting

### "BREVO_API_KEY manquante"

```bash
# Vérifier la clé
echo $BREVO_API_KEY

# Si vide, la rajouter au .env
echo "BREVO_API_KEY=xyzabc..." >> .env
```

### "Brevo 400: Invalid email"

```javascript
// ❌ Mauvais
await brevo.createContact("user name@example.com");

// ✅ Bon
await brevo.createContact("username@example.com");
```

### "Brevo 401: Authentication failed"

Clé API invalide ou expirée. Vérifier sur [brevo.com/api-keys](https://brevo.com/api-keys).

### "Contacts n'apparaissent pas en production"

Vérifier que `ONLY_EMAIL` n'est PAS défini:

```bash
# ❌ Bloque tous sauf votre email
ONLY_EMAIL=test@example.com npm start

# ✅ Bon (production)
npm start
```

### Vérifier les logs

```bash
# Voir les logs du jour
tail -f logs/brevo/2026-07-04.log

# Chercher une action spécifique
grep "contact_created" logs/brevo/2026-07-04.log

# Chercher les erreurs
grep "_error" logs/brevo/2026-07-04.log
```

---

## Prochaines étapes

✅ **Mission 001 — Terminée**
- Module centralisé créé
- Contacts, listes, tags, sync, emails
- Tests en place
- Dashboard préparé

🚀 **Mission 002 — À venir**
- Email automatique de bienvenue

📧 **Mission 003 — À venir**
- Email après paiement Stripe

---

*Mission 001 — Fondation Brevo*  
*Status: ✅ LIVRÉ*  
*Date: 2026-07-04*
