const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync(process.argv[2] || 'scripts/api_server.js', 'utf8');
const start = source.indexOf('function isOu25Bet(');
const end = source.indexOf('\nfunction buildOu25VoteSummary(', start);
assert(start >= 0 && end > start, 'helpers O/U 2,5 introuvables');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(sandbox.extractStructuredOu25Vote({bet:'Over 2.5 buts', confidence:81}))),
  {bet:'Over 2.5 buts', confidence:81}
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(sandbox.extractStructuredOu25Vote({marches:{buts:{p:'u2.5',c:79}}}))),
  {bet:'Under 2.5 buts', confidence:79}
);
assert.strictEqual(sandbox.extractStructuredOu25Vote({bet:'Victoire domicile', confidence:90}), null);
assert.strictEqual(sandbox.extractStructuredOu25Vote({marches:{buts:{p:'o2.5'}}}), null);

assert(source.includes('if (providerAttempts >= 2) break;'), 'plafond initiale + une relance absent');
assert(source.includes('const structuredVote = extractStructuredOu25Vote(parsedProbe);'), 'validation avant arret fournisseur absente');
assert(source.includes('tracerVote(!!structuredOu25);'), 'telemetrie du vote structure absente');

console.log('OK: vote O/U structure conserve; une seule relance ciblee maximum; aucun autre marche accepte');
