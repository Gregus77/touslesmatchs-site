"use strict";

const assert = require("node:assert/strict");
const { BETA_PLUS05_CAPACITY, buildBetaPlus05InvitationEmail, decideBetaApplication, formatBetaApplicationsCsv, normalizeBetaEmail } = require("./beta_waitlist");

assert.equal(BETA_PLUS05_CAPACITY, 20);
assert.equal(normalizeBetaEmail("  Test@Example.COM "), "test@example.com");
assert.equal(decideBetaApplication({ existingStatus: "accepted", acceptedCount: 20 }).status, "accepted");
assert.equal(decideBetaApplication({ acceptedCount: 19 }).status, "accepted");
assert.equal(decideBetaApplication({ acceptedCount: 20 }).status, "waitlist");
assert.equal(decideBetaApplication({ acceptedCount: 0, adultConfirmed: false, legalAccepted: true }).status, "rejected");
assert.equal(
  formatBetaApplicationsCsv([{ email: "a@example.com", status: "accepted", adult_confirmed: 1, legal_accepted: 1, created_at: "2026-08-12 19:40:03" }]),
  'email,status,adult_confirmed,legal_accepted,created_at\n"a@example.com","accepted","1","1","2026-08-12 19:40:03"'
);
const invite = buildBetaPlus05InvitationEmail("https://t.me/+goal05invite");
assert(invite.subject.includes("Goal 0.5"));
assert(invite.html.includes("https://t.me/+goal05invite"));
assert(invite.html.includes("Bêta gratuite"));
assert(invite.html.includes("18 ans"));
assert(invite.html.includes("Aucun gain n est garanti"));

console.log("beta_waitlist: OK");