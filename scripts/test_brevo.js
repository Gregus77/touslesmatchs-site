/**
 * Test de connexion Brevo
 * Utilise ONLY_EMAIL pour tester en mode sécurisé
 *
 * Commande: ONLY_EMAIL=test@example.com node test_brevo.js
 */

const brevo = require("./brevo");

async function runTests() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║              TEST BREVO — Mission 001                          ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log(`📌 Mode test: ${brevo.TEST_MODE ? "OUI" : "NON"}`);
  if (brevo.TEST_MODE) console.log(`   Email cible: ${brevo.ONLY_EMAIL}\n`);

  try {
    // Test 1: Stats
    console.log("1️⃣  Récupération des stats...");
    const stats = await brevo.getStats();
    console.log(`   ✓ API connectée: ${stats.apiConnected ? "✅" : "❌"}`);
    console.log(`   ✓ Contacts: ${stats.contactsCount}`);
    console.log(`   ✓ Listes: ${stats.listsCount}`);
    if (stats.lists.length) {
      console.log("   Listes existantes:");
      stats.lists.forEach(l => console.log(`     - ${l.name} (ID: ${l.id})`));
    }
    if (stats.errors.length) {
      console.log(`   ⚠️  Erreurs: ${stats.errors.join(", ")}`);
    }
    console.log("");

    // Test 2: Créer/récupérer les listes
    console.log("2️⃣  Vérification des listes...");
    const lists = await brevo.ensureLists();
    console.log("   Listes prêtes:");
    Object.entries(lists).forEach(([key, list]) => {
      console.log(`     - ${key}: ${list.name} (ID: ${list.id})`);
    });
    console.log("");

    // Test 3: Créer/récupérer un contact
    if (brevo.TEST_MODE) {
      console.log("3️⃣  Test contact (mode test)...");
      const testEmail = brevo.ONLY_EMAIL;
      const contact = await brevo.getContact(testEmail);
      if (contact) {
        console.log(`   ✓ Contact trouvé: ${testEmail}`);
        console.log(`     ID: ${contact.id}`);
      } else {
        console.log(`   ℹ️  Contact n'existe pas, création...");
        const created = await brevo.createContact(testEmail, "Test", "User", {
          PLAN: "FREE",
          IS_ACTIVE: "true"
        });
        console.log(`   ✓ Contact créé: ID ${created.id}`);
      }
      console.log("");

      // Test 4: Tags
      console.log("4️⃣  Test tags...");
      await brevo.tagContact(testEmail, ["FREE"]);
      console.log(`   ✓ Tag FREE appliqué`);
      console.log("");

      // Test 5: Email
      console.log("5️⃣  Test envoi email...");
      const result = await brevo.sendEmail(
        testEmail,
        "Test Mission 001",
        "<p>Email de test pour la Mission 001</p>",
        "Email de test pour la Mission 001"
      );
      console.log(`   ✓ Email envoyé: ${result.messageId || result.id}`);
      console.log("");
    } else {
      console.log("3️⃣  Tests contact/tags/email skippés (mode production)");
      console.log("   Passer ONLY_EMAIL=test@example.com pour tester\n");
    }

    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║  ✅ TOUS LES TESTS RÉUSSIS                                    ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

  } catch (err) {
    console.error("\n❌ ERREUR:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests().catch(console.error);
