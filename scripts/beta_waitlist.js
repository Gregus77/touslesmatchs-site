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

function buildBetaPlus05InvitationEmail(telegramInviteUrl) {
  const safeUrl = String(telegramInviteUrl || "").trim();
  return {
    subject: "Ton acces beta Goal 0.5 IA",
    html: `
      <div style="font-family:Inter,Arial,sans-serif;background:#12152a;color:#f6f7ff;padding:24px">
        <div style="max-width:560px;margin:0 auto;background:#171b34;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:24px">
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#4fd6f2;font-weight:800">Bêta gratuite · Goal 0.5 IA</div>
          <h1 style="margin:10px 0 12px;font-size:26px;line-height:1.15">Ton invitation est réservée.</h1>
          <p style="color:#c4c9e6;line-height:1.6">Tu fais partie des 20 premiers testeurs du protocole +0,5 but. Le canal Telegram servira à recevoir les informations de test, les signaux retenus, les refus assumés et les résultats suivis.</p>
          <p style="text-align:center;margin:24px 0"><a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#8a68ff,#4b7bff);color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px">Rejoindre le canal Telegram +0,5</a></p>
          <p style="font-size:12px;color:#949bc4;line-height:1.55">Réservé aux personnes de 18 ans et plus. Aucun gain n est garanti. TousLesMatchs fournit des analyses statistiques informatives : joue avec modération.</p>
        </div>
      </div>`
  };
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

module.exports = { BETA_PLUS05_CAPACITY, buildBetaPlus05InvitationEmail, decideBetaApplication, formatBetaApplicationsCsv, normalizeBetaEmail };
