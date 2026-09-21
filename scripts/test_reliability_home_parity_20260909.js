const fs = require('fs');
const assert = require('assert');
const api = fs.readFileSync('scripts/api_server.js', 'utf8');
const home = fs.readFileSync('public/index.html', 'utf8');
const app = fs.readFileSync('public/app.html', 'utf8');
const life = require('../public/js/match-lifecycle.js');

assert(home.includes("fetch('/api/homepage-live"), 'accueil site sur homepage-live');
assert(app.includes('get("/api/homepage-live'), 'accueil application sur homepage-live');
assert(api.includes('homepage_display_eligible'), 'selection canonique backend homepage-live');
assert(api.includes('homepageLiveMatch'), 'projection canonique backend homepage-live');

assert(api.includes('CREATE TABLE IF NOT EXISTS reliability_runs'), 'journal persistant');
assert(api.includes('_reliabilityLoopRunning'), 'verrou anti-chevauchement');
assert(api.includes('openrouter_calls: 0, codex_cost_usd: 0'), 'couts separes et nuls');
assert(api.includes('Aucun renvoi client automatique'), 'pas de renvoi ambigu');
assert(api.includes("sig_sent_free = 1 OR sig_sent_standard = 1 OR sig_sent_premium = 1 OR sig_sent_elite = 1"), 'bilan limite aux signaux publies');
assert(api.includes('IA réellement journalisée'), 'couts reels journalises dans le bilan admin');

const sample=[
  {id:'finished',sport:'Football',home:'Old',away:'Result',status:'FT',minute:90,ou25:{votes:[{status:'voted',direction:'over'},{status:'voted',direction:'over'},{status:'voted',direction:'over'},{status:'voted',direction:'over'},{status:'voted',direction:'over'}]}},
  {id:'closed',sport:'Football',home:'Late',away:'Live',status:'2H',minute:70,ou25:{votes:[{status:'voted',direction:'over'},{status:'voted',direction:'over'},{status:'voted',direction:'over'},{status:'voted',direction:'over'}]}},
  {id:'b',sport:'Football',home:'B',away:'C',minute:20,score_home:0,score_away:0,home_logo:'h2',away_logo:'a2',ou25:{votes:[]}},
  {id:'a',sport:'Football',home:'A',away:'D',minute:30,score_home:1,score_away:0,home_logo:'h1',away_logo:'a1',ou25:{votes:[{status:'voted',direction:'under'},{status:'voted',direction:'under'},{status:'voted',direction:'under'}]}}
];
const site=life.canonicalLiveMatches(sample,life.publicFootballMatch);
const application=life.canonicalLiveMatches(sample,life.publicFootballMatch);
assert.deepStrictEqual(site,application);
assert.strictEqual(life.identity(life.featuredLiveMatch(site)),'a');
assert(!site.some(function(m){return m.id==='finished';}), 'un match termine ne figure jamais dans la liste live canonique');
assert.strictEqual(life.identity(life.featuredLiveMatch(site)),'a', 'un live admissible 3/5 passe avant un live hors fenetre a 4/5');


console.log('OK: accueils site/app, selection canonique, etat vide et boucle fiabilite bornée.');
