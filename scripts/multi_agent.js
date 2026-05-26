const fs = require('fs');
const path = require('path');

// Mise à jour manuelle du pick pour aujourd'hui
const newPick = ["27/05","Lyon vs PSG","Plus de 2.5 buts","1.85","---","EN ATTENTE","Foot"];

// Lire App.js
const appJsPath = path.join(__dirname, '../src/App.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// Remplacer la première ligne du tableau picks
const lines = content.split('\n');
let inPicks = false;
let newLines = [];
for (let line of lines) {
  if (line.trim().startsWith('var picks = [')) {
    inPicks = true;
    newLines.push('var picks = [');
    newLines.push(`  ${JSON.stringify(newPick)},`);
    continue;
  }
  if (inPicks && line.trim() === '];') {
    inPicks = false;
    newLines.push('];');
    continue;
  }
  if (!inPicks) {
    newLines.push(line);
  }
}
fs.writeFileSync(appJsPath, newLines.join('\n'), 'utf8');
console.log('✅ Pick mis à jour :', newPick[1], newPick[2], 'cote', newPick[3]);
