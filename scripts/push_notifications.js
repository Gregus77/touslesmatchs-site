const webpush = require('web-push');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.GOAL05_DB_PATH || path.join(__dirname, '..', 'data', 'tlm.db');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:contact@touslesmatchs.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

function getDb() {
  return new Database(DB_PATH);
}

function saveSubscription(sub) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO push_subscriptions (endpoint, subscription_json) VALUES (?, ?)')
    .run(sub.endpoint, JSON.stringify(sub));
  db.close();
}

async function sendPushToAll(payload) {
  const db = getDb();
  const rows = db.prepare('SELECT endpoint, subscription_json FROM push_subscriptions').all();
  db.close();
  const text = JSON.stringify(payload);
  let sent = 0, dead = [];
  for (const row of rows) {
    try {
      const sub = JSON.parse(row.subscription_json);
      await webpush.sendNotification(sub, text);
      sent++;
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) dead.push(row.endpoint);
      else console.error('[push]', row.endpoint, e.message);
    }
  }
  if (dead.length) {
    const db2 = getDb();
    const del = db2.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
    dead.forEach(e => del.run(e));
    db2.close();
  }
  console.log(`[push] envoye a ${sent}/${rows.length} abonnes (${dead.length} expires supprimes)`);
  return sent;
}

module.exports = { saveSubscription, sendPushToAll };
