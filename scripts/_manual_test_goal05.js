const { runScan } = require('./goal05_scan_and_notify');

const fakeCandidate = {
  id: 'test-manual-' + Date.now(),
  country: 'France',
  league: 'Ligue 1',
  competitionType: 'league',
  home: '[TEST] Paris FC',
  away: '[TEST] Toulouse',
  team: '[TEST] Paris FC',
  opponent: '[TEST] Toulouse',
  teamSide: 'home',
  fiveYearStrength: { levelTableLoaded: true, seasonsAvailable: 4, teamPercentile: 88, opponentPercentile: 19 },
  recent: {
    recentMatchesOrder: 'oldest_to_newest',
    scoredInLastFive: 5,
    opponentConcededInLastFive: 5,
    weightedConstructedGoals: 4,
    scoringState: 'yes',
    opponentConcedesState: 'yes',
    goal05SpecificEvidence: 'yes',
    candidateCanReproduceConcessionPattern: true,
    candidateLevelMatchesPriorScorers: true,
  },
  stake: { teamHasMeaningfulObjective: true, sameZoneAfterResult: false, stakeTeamIsStrongerSide: true },
  odds: {
    arjelBookmakers: [{
      name: 'Bookmaker TEST',
      bets: [{ name: 'Team to score over 0.5', values: [{ value: 'Home over 0.5', odd: 1.35 }] }],
    }],
  },
};

runScan({ candidates: [fakeCandidate], sendTelegram: true, writeSentLog: false })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(e => { console.error('ERREUR:', e.message, e.stack); process.exit(1); });
