'use strict';
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const agents=read('AGENTS.md');
const rules=read('CURRENT_RULES.md');
const api=read('scripts/api_server.js');
const snapshots=read('scripts/official_signal_snapshots.js');
const app=read('public/app.html');
const perf=read('public/performances.html');

assert.match(agents,/O\/U 2,5 est un ancien système/);
assert.match(agents,/analyses, résultats, votes et preuves historiques doivent être conservés intégralement/);
assert.match(rules,/\+0,5 but équipe favorite/);
assert.match(rules,/O\/U 2,5 n'est plus la stratégie principale/);

// Le moteur historique O/U reste présent pour lire/résoudre les anciennes données.
// Il ne doit pas être supprimé pendant le passage au +0,5.
assert.match(api,/const BET_TYPES = \["Over 2\.5 buts", "Under 2\.5 buts"\]/);
assert.match(api,/const CLIENT_OU25_MIN_VOTES = 3;/);
assert.match(snapshots,/const MIN_CONSENSUS_VOTES = 3;/);

// Les surfaces ne doivent pas masquer l'historique O/U.
assert.doesNotMatch(app,/var rows=\(\(all\[0\]\.analyses\)\|\|\[\]\)\.filter\(is05\)/);
assert.match(app,/Historique total/);
assert.match(app,/Ancien O\/U 2,5/);
assert.match(perf,/Historique · O\/U 2,5/);
assert.match(perf,/Actuel · \+0,5 but/);

console.log('LEGACY_OU25_HISTORY_PRESERVED_CURRENT_GOAL05_OK');
