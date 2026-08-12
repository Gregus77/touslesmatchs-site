"use strict";

const BETA_PLUS05_CAPACITY = 20;

function normalizeBetaEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function csvCell(value) {
  return '"' + String(value ?? "").replaceAll('"', '""') + '"';
}

function formatBetaApplicationsCsv(rows) {
  const header = "email,status,adult_confirmed,legal_accepted,created_at";
  const lines = (rows || []).map((row) => [
    row.email, row.status, row.adult_confirmed, row.legal_accepted, row.created_at
  ].map(csvCell).join(","));
  return [header, ...lines].join("\n");
}

function decideBetaApplication({ existingStatus, acceptedCount, adultConfirmed = true, legalAccepted = true }) {
  if (!adultConfirmed || !legalAccepted) {
    return { status: "rejected", reason: "adult_and_legal_confirmation_required" };
  }
  if (existingStatus === "accepted" || existingStatus === "waitlist") {
    return { status: existingStatus, reason: "existing_application" };
  }
  return Number(acceptedCount) < BETA_PLUS05_CAPACITY
    ? { status: "accepted", reason: "slot_reserved" }
    : { status: "waitlist", reason: "capacity_reached" };
}

module.exports = { BETA_PLUS05_CAPACITY, decideBetaApplication, formatBetaApplicationsCsv, normalizeBetaEmail };
