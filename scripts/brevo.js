/**
 * MISSION 001 — Module Brevo centralisé
 *
 * Toute communication avec Brevo passe par ce module.
 * Gestion des contacts, listes, tags, synchronisation, logs.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "noreply@touslesmatchs.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "TousLesMatchs";
const ONLY_EMAIL = process.env.ONLY_EMAIL || ""; // Mode test

const LOGS_DIR = path.join(__dirname, "..", "logs", "brevo");
const TEST_MODE = !!ONLY_EMAIL;

// ─────────────────────────────────────────────────────────────────────────────
// LOGS
// ─────────────────────────────────────────────────────────────────────────────

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function writeLog(action, data) {
  ensureLogsDir();
  const timestamp = new Date().toISOString();
  const logFile = path.join(LOGS_DIR, `${timestamp.slice(0, 10)}.log`);
  const entry = JSON.stringify({ timestamp, action, data, testMode: TEST_MODE });
  fs.appendFileSync(logFile, entry + "\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP HELPER
// ─────────────────────────────────────────────────────────────────────────────

function brevoRequest(method, path, payload = null) {
  return new Promise((resolve, reject) => {
    if (!BREVO_API_KEY) {
      return reject(new Error("BREVO_API_KEY manquante"));
    }

    const body = payload ? JSON.stringify(payload) : null;
    const options = {
      hostname: "api.brevo.com",
      path: `/v3${path}`,
      method,
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      }
    };

    if (body) {
      options.headers["content-length"] = Buffer.byteLength(body);
    }

    const req = https.request(options, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Brevo ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Brevo ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────────────────────────────────────

async function createContact(email, firstName = "", lastName = "", attributes = {}) {
  if (TEST_MODE && email.toLowerCase() !== ONLY_EMAIL.toLowerCase()) {
    console.log(`[BREVO TEST] Skipping contact creation for ${email} (test mode)`);
    return { id: -1, email };
  }

  const payload = {
    email,
    firstName: firstName || "",
    lastName: lastName || "",
    attributes: {
      ...attributes,
      CREATED_AT: new Date().toISOString(),
    }
  };

  try {
    const result = await brevoRequest("POST", "/contacts", payload);
    writeLog("contact_created", { email, firstName, lastName, id: result.id });
    return result;
  } catch (err) {
    writeLog("contact_creation_error", { email, error: err.message });
    throw err;
  }
}

async function updateContact(email, updateData = {}) {
  if (TEST_MODE && email.toLowerCase() !== ONLY_EMAIL.toLowerCase()) {
    console.log(`[BREVO TEST] Skipping contact update for ${email} (test mode)`);
    return { id: -1, email };
  }

  const payload = {
    attributes: {
      ...updateData,
      UPDATED_AT: new Date().toISOString(),
    }
  };

  try {
    const result = await brevoRequest("PUT", `/contacts/${encodeURIComponent(email)}`, payload);
    writeLog("contact_updated", { email, updateData });
    return result;
  } catch (err) {
    writeLog("contact_update_error", { email, error: err.message });
    throw err;
  }
}

async function getContact(email) {
  try {
    const result = await brevoRequest("GET", `/contacts/${encodeURIComponent(email)}`);
    return result;
  } catch (err) {
    if (err.message.includes("404")) return null;
    throw err;
  }
}

async function deleteContact(email) {
  if (TEST_MODE && email.toLowerCase() !== ONLY_EMAIL.toLowerCase()) {
    console.log(`[BREVO TEST] Skipping contact deletion for ${email} (test mode)`);
    return true;
  }

  try {
    await brevoRequest("DELETE", `/contacts/${encodeURIComponent(email)}`);
    writeLog("contact_deleted", { email });
    return true;
  } catch (err) {
    writeLog("contact_deletion_error", { email, error: err.message });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTES
// ─────────────────────────────────────────────────────────────────────────────

const LIST_NAMES = {
  FREE: "Gratuit",
  ESSENTIEL: "Essentiel",
  ELITE: "Elite",
  PAY_PER_VIEW: "À la carte"
};

async function getLists() {
  try {
    const result = await brevoRequest("GET", "/contacts/lists");
    return result.lists || [];
  } catch (err) {
    writeLog("list_fetch_error", { error: err.message });
    throw err;
  }
}

async function getOrCreateList(listName) {
  const lists = await getLists();
  const existing = lists.find(l => l.name === listName);
  if (existing) return existing;

  const payload = { name: listName };
  try {
    const result = await brevoRequest("POST", "/contacts/lists", payload);
    writeLog("list_created", { name: listName, id: result.id });
    return result;
  } catch (err) {
    writeLog("list_creation_error", { name: listName, error: err.message });
    throw err;
  }
}

async function ensureLists() {
  const lists = {};
  for (const [key, name] of Object.entries(LIST_NAMES)) {
    lists[key] = await getOrCreateList(name);
  }
  return lists;
}

async function addContactToList(email, listId) {
  if (TEST_MODE && email.toLowerCase() !== ONLY_EMAIL.toLowerCase()) {
    console.log(`[BREVO TEST] Skipping adding ${email} to list ${listId}`);
    return true;
  }

  const payload = {
    emails: [email]
  };

  try {
    await brevoRequest("POST", `/contacts/lists/${listId}/contacts/add`, payload);
    writeLog("contact_added_to_list", { email, listId });
    return true;
  } catch (err) {
    writeLog("contact_list_add_error", { email, listId, error: err.message });
    throw err;
  }
}

async function removeContactFromList(email, listId) {
  if (TEST_MODE && email.toLowerCase() !== ONLY_EMAIL.toLowerCase()) {
    console.log(`[BREVO TEST] Skipping removing ${email} from list ${listId}`);
    return true;
  }

  const payload = {
    emails: [email]
  };

  try {
    await brevoRequest("POST", `/contacts/lists/${listId}/contacts/remove`, payload);
    writeLog("contact_removed_from_list", { email, listId });
    return true;
  } catch (err) {
    writeLog("contact_list_remove_error", { email, listId, error: err.message });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAGS
// ─────────────────────────────────────────────────────────────────────────────

const TAG_NAMES = ["FREE", "ESSENTIEL", "ELITE", "PAY_PER_VIEW"];

async function tagContact(email, tags = []) {
  if (TEST_MODE && email.toLowerCase() !== ONLY_EMAIL.toLowerCase()) {
    console.log(`[BREVO TEST] Skipping tagging ${email} (test mode)`);
    return true;
  }

  if (!Array.isArray(tags) || tags.length === 0) return true;

  const payload = {
    email,
    attributes: {}
  };

  for (const tag of tags) {
    payload.attributes[`TAG_${tag}`] = true;
  }

  try {
    await brevoRequest("POST", "/contacts", payload);
    writeLog("contact_tagged", { email, tags });
    return true;
  } catch (err) {
    writeLog("contact_tag_error", { email, tags, error: err.message });
    throw err;
  }
}

async function untagContact(email, tags = []) {
  if (TEST_MODE && email.toLowerCase() !== ONLY_EMAIL.toLowerCase()) {
    console.log(`[BREVO TEST] Skipping untagging ${email} (test mode)`);
    return true;
  }

  if (!Array.isArray(tags) || tags.length === 0) return true;

  const payload = {
    email,
    attributes: {}
  };

  for (const tag of tags) {
    payload.attributes[`TAG_${tag}`] = false;
  }

  try {
    await brevoRequest("POST", "/contacts", payload);
    writeLog("contact_untagged", { email, tags });
    return true;
  } catch (err) {
    writeLog("contact_untag_error", { email, tags, error: err.message });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNCHRONISATION
// ─────────────────────────────────────────────────────────────────────────────

async function syncUser(user) {
  const { email, firstName = "", lastName = "", plan = "FREE", createdAt, isActive = true, expiresAt = null } = user;

  if (TEST_MODE && email.toLowerCase() !== ONLY_EMAIL.toLowerCase()) {
    console.log(`[BREVO TEST] Skipping sync for ${email} (test mode)`);
    return true;
  }

  try {
    // Vérifier ou créer le contact
    let contact = await getContact(email);
    if (!contact) {
      contact = await createContact(email, firstName, lastName, {
        PLAN: plan,
        IS_ACTIVE: isActive ? "true" : "false",
        CREATED_AT: createdAt || new Date().toISOString(),
        EXPIRES_AT: expiresAt || "",
      });
    } else {
      // Mettre à jour si existe
      await updateContact(email, {
        PLAN: plan,
        IS_ACTIVE: isActive ? "true" : "false",
        EXPIRES_AT: expiresAt || "",
      });
    }

    // Appliquer le tag correspondant
    const allTags = TAG_NAMES.filter(t => t !== plan);
    await untagContact(email, allTags);
    await tagContact(email, [plan]);

    writeLog("user_synced", { email, plan, isActive });
    return true;
  } catch (err) {
    writeLog("user_sync_error", { email, error: err.message });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAILS
// ─────────────────────────────────────────────────────────────────────────────

async function sendEmail(to, subject, htmlContent, textContent = "") {
  if (TEST_MODE && to.toLowerCase() !== ONLY_EMAIL.toLowerCase()) {
    console.log(`[BREVO TEST] Skipping email to ${to} (test mode)`);
    return { id: -1, messageId: "test" };
  }

  const payload = {
    sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
    to: [{ email: to }],
    subject,
    htmlContent,
    textContent: textContent || subject,
  };

  try {
    const result = await brevoRequest("POST", "/smtp/email", payload);
    writeLog("email_sent", { to, subject });
    return result;
  } catch (err) {
    writeLog("email_send_error", { to, subject, error: err.message });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────

async function getStats() {
  try {
    const lists = await getLists();

    let totalContacts = 0;
    try {
      const result = await brevoRequest("GET", "/contacts?limit=1");
      totalContacts = result.count || 0;
    } catch {}

    return {
      apiConnected: true,
      contactsCount: totalContacts,
      listsCount: lists.length,
      lists: lists.map(l => ({ id: l.id, name: l.name })),
      lastSync: new Date().toISOString(),
      testMode: TEST_MODE,
      errors: []
    };
  } catch (err) {
    return {
      apiConnected: false,
      contactsCount: 0,
      listsCount: 0,
      lists: [],
      lastSync: null,
      testMode: TEST_MODE,
      errors: [err.message]
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Config
  TEST_MODE,
  ONLY_EMAIL,
  LIST_NAMES,
  TAG_NAMES,

  // Contacts
  createContact,
  updateContact,
  getContact,
  deleteContact,

  // Listes
  getLists,
  getOrCreateList,
  ensureLists,
  addContactToList,
  removeContactFromList,

  // Tags
  tagContact,
  untagContact,

  // Sync
  syncUser,

  // Emails
  sendEmail,

  // Stats
  getStats,

  // Logs
  writeLog,
};
