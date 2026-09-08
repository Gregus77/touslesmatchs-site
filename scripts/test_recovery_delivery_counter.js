/**
 * Régression 09/09/2026 : le plafond Recovery doit compter uniquement les
 * signaux confirmés par Telegram, tout en réservant les places en vol.
 */
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "api_server.js"), "utf8");
let failed = 0;
function assert(condition, label) {
  if (condition) console.log(`  ✅ ${label}`);
  else { failed++; console.error(`  ❌ ${label}`); }
}

assert(
  source.includes("const _recoverySignalReservations = new Set();"),
  "réservations Recovery séparées du compteur confirmé"
);
assert(
  /channel IN \('standard','premium','elite'\)[\s\S]{0,180}ok = 1 AND telegram_message_id IS NOT NULL/.test(source),
  "compteur persistant fondé sur une livraison Telegram payante prouvée"
);
assert(
  source.includes("_recoverySignalDaily.count + _recoverySignalReservations.size"),
  "les réservations en vol protègent le plafond journalier"
);
assert(
  !source.includes("_recoverySignalDaily.count++;"),
  "aucun signal Recovery compté avant confirmation Telegram"
);
assert(
  source.includes("Promise.allSettled(_paidDeliveryPromises)"),
  "toutes les tentatives payantes sont réglées avant de libérer la réservation"
);
assert(
  source.includes('item.status === "fulfilled" && item.value === true'),
  "au moins une réponse Telegram positive est exigée"
);
assert(
  source.includes("_recoverySignalReservations.delete(_recoveryReservationKey)"),
  "la réservation est rendue après succès ou échec"
);
assert(
  (source.match(/_paidDeliveryPromises\.push\(/g) || []).length === 3,
  "les trois canaux payants participent au règlement Recovery"
);

console.log(`\nRÉSULTAT : ${failed ? "ÉCHEC" : "OK"}`);
process.exit(failed ? 1 : 0);
