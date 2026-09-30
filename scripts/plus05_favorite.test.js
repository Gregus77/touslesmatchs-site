'use strict';
const test = require('node:test');
const assert = require('node:assert');
const P = require('./plus05_favorite');

const F = (arr) => arr.map(([gf, ga]) => ({ gf, ga })); // plus recent d'abord
const fav5of5 = F([[2, 1], [1, 0], [3, 1], [1, 2], [2, 0]]); // 9 buts, 5/5
const opp5of5 = F([[0, 2], [1, 3], [0, 1], [2, 2], [1, 1]]);

test('eligible : top5 vs 5 derniers, formes valides', () => {
  const r = P.evaluatePreselection({ home: { rank: 2, form: fav5of5 }, away: { rank: 18, form: opp5of5 }, totalTeams: 20 });
  assert.equal(r.eligible, true);
  assert.equal(r.side, 'home');
  assert.equal(r.risk.color, 'vert');
});
test('favori exterieur detecte', () => {
  const r = P.evaluatePreselection({ home: { rank: 19, form: opp5of5 }, away: { rank: 1, form: fav5of5 }, totalTeams: 20 });
  assert.equal(r.side, 'away');
});
test('rejet : milieu de tableau', () => {
  const r = P.evaluatePreselection({ home: { rank: 6, form: fav5of5 }, away: { rank: 18, form: opp5of5 }, totalTeams: 20 });
  assert.equal(r.reason, 'pas_top5_contre_5_derniers');
});
test('bornes : 5e et 16e sur 20 acceptes, adversaire 15e refuse', () => {
  const ok = P.evaluatePreselection({ home: { rank: 5, form: fav5of5 }, away: { rank: 16, form: opp5of5 }, totalTeams: 20 });
  assert.equal(ok.eligible, true);
  const ko = P.evaluatePreselection({ home: { rank: 5, form: fav5of5 }, away: { rank: 15, form: opp5of5 }, totalTeams: 20 });
  assert.equal(ko.eligible, false);
});
test('rejet : favori a marque 3/5 seulement', () => {
  const f = F([[1, 0], [0, 0], [2, 1], [0, 1], [1, 1]]);
  const r = P.evaluatePreselection({ home: { rank: 1, form: f }, away: { rank: 20, form: opp5of5 }, totalTeams: 20 });
  assert.equal(r.reason, 'favori_a_marque_moins_de_4_sur_5');
});
test('rejet : favori 4/5 mais a blanchi au dernier match', () => {
  const f = F([[0, 1], [1, 0], [2, 1], [1, 1], [3, 0]]);
  const r = P.evaluatePreselection({ home: { rank: 1, form: f }, away: { rank: 20, form: opp5of5 }, totalTeams: 20 });
  assert.equal(r.reason, 'favori_na_pas_marque_dernier_match');
});
test('rejet : adversaire sans but encaisse au dernier match', () => {
  const o = F([[0, 0], [1, 3], [0, 1], [2, 2], [1, 1]]);
  const r = P.evaluatePreselection({ home: { rank: 1, form: fav5of5 }, away: { rank: 20, form: o }, totalTeams: 20 });
  assert.equal(r.reason, 'adversaire_na_pas_encaisse_dernier_match');
});
test('rejet : adversaire a encaisse 3/5', () => {
  const o = F([[0, 2], [1, 0], [0, 1], [2, 0], [1, 1]]);
  const r = P.evaluatePreselection({ home: { rank: 1, form: fav5of5 }, away: { rank: 20, form: o }, totalTeams: 20 });
  assert.equal(r.reason, 'adversaire_a_encaisse_moins_de_4_sur_5');
});
test('adversaire 4/5 avec dernier encaisse : accepte', () => {
  const o = F([[0, 2], [1, 0], [0, 1], [2, 2], [1, 1]]);
  const r = P.evaluatePreselection({ home: { rank: 1, form: fav5of5 }, away: { rank: 20, form: o }, totalTeams: 20 });
  assert.equal(r.eligible, true);
});
test('rejet : moins de 5 matchs disponibles (absent != zero)', () => {
  const r = P.evaluatePreselection({ home: { rank: 1, form: fav5of5.slice(0, 3) }, away: { rank: 20, form: opp5of5 }, totalTeams: 20 });
  assert.equal(r.reason, 'forme_favori_incomplete');
});
test('pastilles', () => {
  const s = (scoredIn, total) => ({ played: 5, scoredIn, totalGoals: total, scoredLast: true });
  assert.equal(P.riskLevel(s(5, 8)).color, 'vert');
  assert.equal(P.riskLevel(s(5, 7)).color, 'orange');
  assert.equal(P.riskLevel(s(4, 6)).color, 'orange');
  assert.equal(P.riskLevel(s(4, 5)).color, 'rouge');
  assert.equal(P.riskLevel(s(3, 9)), null);
});

const entry = (over) => ({
  status: { blocked: false, stopped: false },
  update: new Date().toISOString(),
  odds: [{ id: 58, values: [
    { value: 'Over', handicap: '0.5', odd: over, suspended: false },
    { value: 'Under', handicap: '0.5', odd: '2.0', suspended: false },
  ] }],
});
test('extraction cote +0,5 domicile (id 58) ; exterieur (id 39) absent', () => {
  assert.equal(P.extractTeamOver05(entry('1.65'), 'home').odd, 1.65);
  assert.equal(P.extractTeamOver05(entry('1.65'), 'away'), null);
});
test('extraction : ligne 0,5 absente -> null', () => {
  const e = entry('1.65');
  e.odds[0].values = [{ value: 'Over', handicap: '1.5', odd: '2.4', suspended: false }];
  assert.equal(P.extractTeamOver05(e, 'home'), null);
});
test('extraction : marche bloque = suspendu', () => {
  const e = entry('1.65');
  e.status.blocked = true;
  assert.equal(P.extractTeamOver05(e, 'home').suspended, true);
});

const q = (odd, o = {}) => ({ odd, suspended: false, updatedAt: Date.now() - 5000, ...o });
test('declencheur : tout OK', () => {
  assert.equal(P.evaluateLiveTrigger({ favGoals: 0, minute: 58, quote: q(1.62), votes: 4 }).go, true);
});
test('declencheur : 1,59 refuse, 1,60 accepte', () => {
  assert.equal(P.evaluateLiveTrigger({ favGoals: 0, minute: 58, quote: q(1.59), votes: 5 }).reason, 'cote_sous_1_60');
  assert.equal(P.evaluateLiveTrigger({ favGoals: 0, minute: 58, quote: q(1.6), votes: 5 }).go, true);
});
test('declencheur : favori a deja marque', () => {
  assert.equal(P.evaluateLiveTrigger({ favGoals: 1, minute: 58, quote: q(1.8), votes: 5 }).reason, 'favori_a_deja_marque');
});
test('declencheur : 3 votes sur 5 insuffisant', () => {
  assert.equal(P.evaluateLiveTrigger({ favGoals: 0, minute: 58, quote: q(1.8), votes: 3 }).reason, 'quorum_concile_insuffisant');
});
test('declencheur : cote suspendue, perimee ou absente', () => {
  assert.equal(P.evaluateLiveTrigger({ favGoals: 0, minute: 58, quote: q(1.8, { suspended: true }), votes: 5 }).reason, 'marche_suspendu');
  assert.equal(P.evaluateLiveTrigger({ favGoals: 0, minute: 58, quote: q(1.8, { updatedAt: Date.now() - 300000 }), votes: 5 }).reason, 'cote_perimee');
  assert.equal(P.evaluateLiveTrigger({ favGoals: 0, minute: 58, quote: null, votes: 5 }).reason, 'cote_absente');
});
test('declencheur : minute hors fenetre', () => {
  assert.equal(P.evaluateLiveTrigger({ favGoals: 0, minute: 10, quote: q(1.8), votes: 5 }).reason, 'minute_hors_fenetre');
  assert.equal(P.evaluateLiveTrigger({ favGoals: 0, minute: 88, quote: q(1.8), votes: 5 }).reason, 'minute_hors_fenetre');
});
test('resultat final', () => {
  assert.equal(P.settle({ favFinalGoals: 1 }), 'GAGNE');
  assert.equal(P.settle({ favFinalGoals: 0 }), 'PERDU');
  assert.equal(P.settle({ favFinalGoals: null }), 'EN_ATTENTE');
});
