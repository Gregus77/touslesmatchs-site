const assert = require('assert/strict');

const { formatTelegramMessage, missingForEngine, runScan } = require('./goal05_scan_and_notify');

const eligibleCandidate = {
  id: 'test-goal05-eligible',
  country: 'France',
  league: 'Ligue 1',
  competitionType: 'league',
  home: 'Equipe Forte',
  away: 'Equipe Faible',
  team: 'Equipe Forte',
  opponent: 'Equipe Faible',
  teamSide: 'home',
  homeLogo: 'https://media.api-sports.io/football/teams/1.png',
  awayLogo: 'https://media.api-sports.io/football/teams/2.png',
  leagueLogo: 'https://media.api-sports.io/football/leagues/61.png',
  fiveYearStrength: {
    levelTableLoaded: true,
    seasonsAvailable: 3,
    teamPercentile: 90,
    opponentPercentile: 20,
  },
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
  stake: {
    teamHasMeaningfulObjective: true,
    sameZoneAfterResult: false,
    stakeTeamIsStrongerSide: true,
  },
  odds: {
    arjelBookmakers: [
      {
        name: 'Bookmaker ANJ test',
        bets: [
          {
            name: 'Team to score over 0.5',
            values: [
              { value: 'Home over 0.5', odd: 1.35 },
            ],
          },
        ],
      },
    ],
  },
};

async function main() {
  assert.deepEqual(missingForEngine({ readyForEngine: false, missingData: ['odds.arjelBookmakers'] }), ['odds.arjelBookmakers']);
  assert.equal(missingForEngine(eligibleCandidate).length, 0);

  const dryReport = await runScan({
    candidates: [
      eligibleCandidate,
      { id: 'missing-data', home: 'A', away: 'B', readyForEngine: false, missingData: ['recent.scoredInLastFive'] },
    ],
    sendTelegram: false,
    now: new Date('2026-08-13T10:00:00.000Z'),
  });

  assert.equal(dryReport.summary.total, 2);
  assert.equal(dryReport.summary.eligible, 1);
  assert.equal(dryReport.summary.needsData, 1);
  assert.equal(dryReport.summary.sent, 0);
  assert.equal(dryReport.results[0].sendDecision, 'not_sent');

  let posterCalled = false;
  const sendReport = await runScan({
    candidates: [eligibleCandidate],
    sendTelegram: true,
    telegramToken: 'fake-token',
    telegramChatId: '-100123',
    telegramPoster: async ({ text }) => {
      posterCalled = true;
      assert.ok(text.includes('GO'));
      assert.ok(text.includes('France - Ligue 1'));
      assert.ok(text.includes('Crit'));
      assert.ok(text.includes('Championnat uniquement'));
      assert.ok(text.includes('Cote ANJ valide'));
      assert.ok(text.includes('Equipe Forte +0,5 but'));
      return { ok: true, statusCode: 200 };
    },
    now: new Date('2026-08-13T10:00:00.000Z'),
    sentLog: {},
    writeSentLog: false,
  });

  assert.equal(posterCalled, true);
  assert.equal(sendReport.summary.sent, 1);
  assert.ok(formatTelegramMessage(eligibleCandidate, sendReport.results[0]));
  console.log('goal05_scan_and_notify: OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


