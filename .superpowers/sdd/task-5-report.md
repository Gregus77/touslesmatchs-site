# Task 5 Report

## Outcome
Updated `public/index.html` so homepage score rendering no longer hides unknown values behind `0`.

## Change Made
- Replaced nullish score defaults with explicit known-value checks in `applyScore(m)`.
- Unknown `score_home` / `score_away` now render as `?`.
- Real zero values still render as `0`.
- Stored pick scores are only updated when the API provides a known value.

## Verification
- Ran `node --check scripts/api_server.js`.
- Manually inspected the edited `applyScore(m)` block in `public/index.html`.
- Verified the two required cases by evaluating the same logic:
  - `{ score_home: null, score_away: null }` -> `? - ?`
  - `{ score_home: 0, score_away: 0 }` -> `0 - 0`

## Notes
- No other files were changed.
