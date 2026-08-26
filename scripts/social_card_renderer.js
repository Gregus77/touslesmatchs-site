"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function compact(v, max = 58) {
  const s = String(v || "").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function splitCompetition(raw = "", fallbackCountry = "") {
  const parts = String(raw || "").split(/\s*[·•|]\s*/).filter(Boolean);
  return {
    league: parts[0] || "Football",
    country: fallbackCountry || (parts.length > 1 ? parts[parts.length - 1] : ""),
  };
}

function fmtDateTime(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      timeZone: process.env.SOCIAL_TIMEZONE || "Europe/Paris",
    }).format(d).replace(",", " ·");
  } catch (_) { return ""; }
}

function lines(text, limit = 30) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const out = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > limit && line) {
      out.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}

function svgTextLines(values, x, y, size, lineHeight, attrs = "") {
  return values.map((v, i) => `<text x="${x}" y="${y + i * lineHeight}" font-size="${size}" ${attrs}>${esc(v)}</text>`).join("\n");
}

function baseSvg({ width, height, event, stage }) {
  const comp = splitCompetition(event.competition, event.country);
  const signal = stage === "result" ? compact(event.bet || "Analyse du Concile", 42) : "SIGNAL VALIDÉ";
  const home = compact(event.home || "Domicile", 34);
  const away = compact(event.away || "Extérieur", 34);
  const teams = lines(`${home} — ${away}`, width >= 1080 ? 29 : 24);
  const isWin = event.outcome === "win";
  const isLoss = event.outcome === "loss";
  const resultLabel = isWin ? "GAGNÉ" : isLoss ? "PERDU" : "TERMINÉ";
  const accent = isWin ? "#31d7a0" : isLoss ? "#ff6685" : "#ff6b00";
  const dateTime = fmtDateTime(event.kickoff || event.analysedAt || event.createdAt);
  const score = event.finalScore || ((event.finalScoreHome != null && event.finalScoreAway != null) ? `${event.finalScoreHome} - ${event.finalScoreAway}` : "");
  const votes = Number(event.consensusVotes || event.consensus_votes || 0);
  const confidence = Number(event.confidence || 0);

  const topLabel = stage === "result" ? `RÉSULTAT · ${resultLabel}` : "LE CONCILE A VALIDÉ UN SIGNAL";
  const footer = stage === "result"
    ? "Résultat vérifié · gagnés et perdus restent publics"
    : "Sélection exacte réservée aux membres · 18+ · Jeu responsable";

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#071426"/><stop offset="0.55" stop-color="#0B1D33"/><stop offset="1" stop-color="#11183c"/>
      </linearGradient>
      <radialGradient id="glow" cx="85%" cy="14%" r="70%"><stop offset="0" stop-color="#6d4cff" stop-opacity=".38"/><stop offset="1" stop-color="#6d4cff" stop-opacity="0"/></radialGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000" flood-opacity=".38"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect width="100%" height="100%" fill="url(#glow)"/>
    <circle cx="${width - 120}" cy="150" r="220" fill="none" stroke="#38d7ff" stroke-opacity=".16" stroke-width="2"/>
    <circle cx="${width - 120}" cy="150" r="150" fill="none" stroke="#8a5cff" stroke-opacity=".20" stroke-width="2"/>

    <g font-family="Arial,Helvetica,sans-serif" fill="#f7f9ff">
      <text x="72" y="98" font-size="29" font-weight="900" letter-spacing="2">TOUSLESMATCHS</text>
      <text x="72" y="142" font-size="18" fill="#9aa8c9" font-weight="700">5 IA · FOOTBALL · CONCILE</text>

      <rect x="72" y="205" width="${Math.min(width - 144, 620)}" height="60" rx="30" fill="${accent}" fill-opacity=".15" stroke="${accent}" stroke-opacity=".65"/>
      <text x="102" y="244" font-size="23" font-weight="900" fill="${accent}">${esc(topLabel)}</text>

      ${svgTextLines(teams, 72, 365, 52, 63, 'font-weight="900" letter-spacing="-1"')}
      <text x="72" y="${teams.length > 1 ? 520 : 455}" font-size="22" fill="#aebbd6" font-weight="700">${esc(comp.league)}${comp.country ? ` · ${esc(comp.country)}` : ""}${dateTime ? ` · ${esc(dateTime)}` : ""}</text>

      ${stage === "result" ? `
        <text x="72" y="650" font-size="22" fill="#9aa8c9" font-weight="800">SCORE FINAL</text>
        <text x="72" y="740" font-size="76" font-weight="900" fill="${accent}">${esc(score || "Résultat vérifié")}</text>
        <text x="72" y="830" font-size="22" fill="#9aa8c9" font-weight="800">SÉLECTION</text>
        <text x="72" y="884" font-size="35" font-weight="900">${esc(signal)}</text>
      ` : `
        <text x="72" y="650" font-size="22" fill="#9aa8c9" font-weight="800">ACCORD DU CONCILE</text>
        <text x="72" y="735" font-size="72" font-weight="900" fill="#31d7a0">${votes ? `${votes}/5` : "VALIDÉ"}</text>
        <text x="72" y="810" font-size="24" fill="#cbd5ec">${confidence ? `Confiance ${confidence}/100 · ` : ""}La sélection exacte reste réservée aux membres.</text>
      `}

      <g filter="url(#shadow)">
        <rect x="72" y="${height - 360}" width="${width - 144}" height="170" rx="28" fill="#0f2440" stroke="#ffffff" stroke-opacity=".13"/>
        <text x="110" y="${height - 295}" font-size="20" fill="#9aa8c9" font-weight="800">${stage === "result" ? "PREUVE PUBLIQUE" : "VOIR LE SIGNAL"}</text>
        <text x="110" y="${height - 235}" font-size="34" font-weight="900">touslesmatchs.com</text>
      </g>
      <text x="72" y="${height - 90}" font-size="18" fill="#8493b4">${esc(footer)}</text>
    </g>
  </svg>`;
}

async function renderCard(event, options = {}) {
  const stage = options.stage === "result" ? "result" : "signal";
  const ratio = options.ratio === "feed" ? "feed" : "story";
  const width = 1080;
  const height = ratio === "feed" ? 1350 : 1920;
  const dir = options.outputDir || process.env.SOCIAL_MEDIA_DIR || "/data/social-media";
  fs.mkdirSync(dir, { recursive: true });

  const key = String(event.eventKey || event.matchKey || `${event.home}_${event.away}_${Date.now()}`)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  const filename = `${key}-${stage}-${ratio}.png`;
  const filePath = path.join(dir, filename);
  const svg = baseSvg({ width, height, event, stage });

  await sharp(Buffer.from(svg)).png({ quality: 92, compressionLevel: 8 }).toFile(filePath);
  return { filePath, filename, width, height, stage, ratio };
}

module.exports = { renderCard, splitCompetition, fmtDateTime };
