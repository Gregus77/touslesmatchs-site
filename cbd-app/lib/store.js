'use strict';
// Persistance JSON zero-dependance. Ecriture atomique (tmp + rename).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = { distributeurs: [], boutiques: [], produits: [], commandes: [], abonnements: [], seq: 1 };

let db = null;
let writeTimer = null;

function load() {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    for (const k of Object.keys(EMPTY)) if (db[k] === undefined) db[k] = EMPTY[k];
  } catch (e) {
    db = JSON.parse(JSON.stringify(EMPTY));
    require('./seed').seed(db);
    flush();
  }
  return db;
}

function flush() {
  if (!db) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// Ecriture differee : evite un fsync par requete sous charge.
function save() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => { writeTimer = null; flush(); }, 200);
}

function id(prefix) {
  const d = load();
  return prefix + '_' + (d.seq++).toString(36) + crypto.randomBytes(3).toString('hex');
}

function token() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { load, save, flush, id, token, DB_FILE };
