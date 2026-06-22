# Task 2 Report: Enforce Provenance on Live Matches

Status: done

What changed:
- Tagged football-data live matches with explicit provenance: `source`, `sourceId`, and `fixtureId: null`.
- Switched API-Sports football live matches to `normalizeApiSportsFootballFixture(...)` so football fixtures carry verified provenance.
- Added provenance fields to API-Sports basketball and hockey live match entries.
- Tightened `getVerifiedFixtureId(match)` so only real numeric API-Sports football fixture IDs are accepted.
- Made the smoke harness exit cleanly after a passing run.

Verification:
- `node --check scripts/api_server.js`
- `node scripts/smoke_live_contract.js`

Result:
- Both checks passed.

Concerns:
- None.
