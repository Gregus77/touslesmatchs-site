"use strict";

const assert = require("node:assert/strict");
const { BETA_PLUS05_CAPACITY, decideBetaApplication, normalizeBetaEmail } = require("./beta_waitlist");

assert.equal(BETA_PLUS05_CAPACITY, 20);
assert.equal(normalizeBetaEmail("  Test@Example.COM "), "test@example.com");
assert.equal(decideBetaApplication({ existingStatus: "accepted", acceptedCount: 20 }).status, "accepted");
assert.equal(decideBetaApplication({ acceptedCount: 19 }).status, "accepted");
assert.equal(decideBetaApplication({ acceptedCount: 20 }).status, "waitlist");
assert.equal(decideBetaApplication({ acceptedCount: 0, adultConfirmed: false, legalAccepted: true }).status, "rejected");

console.log("beta_waitlist: OK");
