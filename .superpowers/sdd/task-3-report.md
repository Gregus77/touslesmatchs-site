# Task 3 Report: Make Live Stats Strict and Explicit

## Summary

Implemented Task 3 exactly as specified in the brief:

- Added `fetchMatchStatsForMatch(match)` below the low-level `fetchMatchStats(fixtureId)` caller.
- Updated `runConcileAnalysis(match)` to require a verified API-Sports football fixture before attempting live stats retrieval.
- Added explicit `statsStatus` metadata to both real and mock Concile analysis responses.
- Extended the smoke contract with non-numeric and non-football fixture validation coverage.

## Changes

### `scripts/api_server.js`

- Added:
  - `fetchMatchStatsForMatch(match): Promise<{ available, source, fixtureId, reason, stats }>`
- Updated live stats flow in `runConcileAnalysis(match)`:
  - Live stats now resolve through `fetchMatchStatsForMatch(match)`.
  - Non-live matches now return `buildStatsStatus(match, null, "match_not_live")`.
  - Logging now explicitly distinguishes available vs unavailable stats and includes fixture provenance when available.
- Added `statsStatus` to:
  - real `runConcileAnalysis(match)` responses
  - `getMockAnalysis(match)` responses

### `scripts/smoke_live_contract.js`

- Added `testVerifiedFixtureRejectsNonNumericIds()` with the exact assertions from the task brief.

## Verification

Ran:

- `node scripts/smoke_live_contract.js`
  - Result: `smoke_live_contract: ok`
- `node --check scripts/api_server.js`
  - Result: pass (exit code 0, no output)

## Commit

- `fix(concile): require verified fixture for live stats`

## Concerns

- None.
