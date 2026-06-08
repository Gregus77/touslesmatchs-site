"use strict";
const fs   = require("fs");
const path = require("path");

const APP_JS       = path.join(__dirname, "../src/App.js");
const STATS_FILE   = path.join(__dirname, "roi_stats.json");
const MEMORY_FILE  = path.join(__dirname, "../CONCILE_MEMORY.md");

function parsePicks(content) {
  // ["DD/MM","match","bet","odds","score","STATUS","sport",note,noteMin]
  const regex = /\["([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","(GAGNE|PERDU|NOPICK|EN ATTENTE)","([^"]*)",(\d+\.?\d*),(\d+\.?\d*)\]/g;
  const picks = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    picks.push({
      date:   m[1],
      match:  m[2],
      bet:    m[3],
      odds:   parseFloat(m[4]) || 0,
      score:  m[5],
      status: m[6],
      sport:  m[7] || "Foot",
      note:   parseFloat(m[8]) || 0,
    });
  }
  return picks;
}

function computeStats() {
  const content  = fs.readFileSync(APP_JS, "utf8");
  const picks    = parsePicks(content);

  const resolved = picks.filter(p => p.status === "GAGNE" || p.status === "PERDU");
  const wins     = resolved.filter(p => p.status === "GAGNE");
  const losses   = resolved.filter(p => p.status === "PERDU");
  const nopicks  = picks.filter(p => p.status === "NOPICK");
  const pending  = picks.filter(p => p.status === "EN ATTENTE");

  // ROI en unités (1 unité par pari)
  const profit  = wins.reduce((s, p) => s + (p.odds - 1), 0) - losses.length;
  const roi     = resolved.length > 0 ? +(profit / resolved.length * 100).toFixed(1) : null;
  const winRate = resolved.length > 0 ? +(wins.length / resolved.length * 100).toFixed(1) : null;

  // Série en cours (ordre chronologique inverse = premier du tableau = plus récent)
  let streak = 0, streakType = "";
  for (const p of resolved) {
    if (!streakType) { streakType = p.status; streak = 1; }
    else if (p.status === streakType) streak++;
    else break;
  }

  // Par sport
  const bySport = {};
  for (const p of resolved) {
    const s = p.sport || "Foot";
    if (!bySport[s]) bySport[s] = { wins: 0, losses: 0, profit: 0 };
    if (p.status === "GAGNE") { bySport[s].wins++;  bySport[s].profit += p.odds - 1; }
    else                      { bySport[s].losses++; bySport[s].profit -= 1; }
  }
  for (const s of Object.keys(bySport)) {
    const b = bySport[s];
    const r = b.wins + b.losses;
    b.winRate = r > 0 ? +(b.wins / r * 100).toFixed(1) : 0;
    b.roi     = r > 0 ? +(b.profit / r * 100).toFixed(1) : 0;
    b.profit  = +b.profit.toFixed(2);
  }

  const stats = {
    updatedAt:     new Date().toISOString(),
    total:         resolved.length,
    wins:          wins.length,
    losses:        losses.length,
    nopicks:       nopicks.length,
    pending:       pending.length,
    winRate:       winRate !== null ? winRate + "%" : "N/A",
    roi:           roi     !== null ? roi     + "%" : "N/A",
    profit:        profit.toFixed(2) + " u",
    currentStreak: streak > 0
      ? `${streak} ${streakType === "GAGNE" ? "victoire(s)" : "défaite(s)"} consécutive(s)`
      : "N/A",
    bySport,
    recentPicks: resolved.slice(0, 10).map(p => ({
      date: p.date, match: p.match, bet: p.bet, odds: p.odds,
      status: p.status, sport: p.sport, note: p.note
    }))
  };

  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  updateMemory(stats);
  return stats;
}

function updateMemory(stats) {
  try {
    let mem = fs.readFileSync(MEMORY_FILE, "utf8");
    const section = `## 📊 ROI EN TEMPS RÉEL (mis à jour automatiquement)

| Métrique       | Valeur          |
|----------------|-----------------|
| Total picks    | ${stats.total}  |
| Victoires      | ${stats.wins}   |
| Défaites       | ${stats.losses} |
| Win rate       | ${stats.winRate}|
| ROI            | ${stats.roi}    |
| Profit         | ${stats.profit} |
| Série en cours | ${stats.currentStreak} |

`;
    const marker = "## 📊 ROI EN TEMPS RÉEL";
    if (mem.includes(marker)) {
      mem = mem.replace(/## 📊 ROI EN TEMPS RÉEL[\s\S]*?(?=\n## |\n---\s*$|$)/, section.trimEnd());
    } else {
      mem += "\n---\n\n" + section;
    }
    fs.writeFileSync(MEMORY_FILE, mem);
  } catch (e) { /* silencieux */ }
}

module.exports = { computeStats };

if (require.main === module) {
  const s = computeStats();
  console.log("📊 STATISTIQUES HERMÈS");
  console.log(`   Picks résolus : ${s.total} (${s.wins} ✅ / ${s.losses} ❌)`);
  console.log(`   Win rate      : ${s.winRate}`);
  console.log(`   ROI           : ${s.roi}`);
  console.log(`   Profit        : ${s.profit}`);
  console.log(`   Série         : ${s.currentStreak}`);
  if (Object.keys(s.bySport).length) {
    console.log("   Par sport :");
    for (const [sport, b] of Object.entries(s.bySport)) {
      console.log(`     ${sport.padEnd(8)} : ${b.wins}/${b.wins+b.losses} — ROI ${b.roi}%`);
    }
  }
}
