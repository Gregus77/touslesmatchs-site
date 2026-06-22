# Option A Smoke Report - 2026-06-22

Branch: `claude/happy-bell-h9zj83`

Checks run:
- `node scripts/smoke_live_contract.js` -> `smoke_live_contract: ok`
- `node --check scripts/api_server.js` -> exit 0
- `node --check scripts/hermes_admin_bot.js` -> exit 0
- `python -m py_compile council/tools/sports_api.py` -> exit 0
- `git status --short --branch` -> branch `claude/happy-bell-h9zj83` ahead of `origin/claude/happy-bell-h9zj83`; final uncommitted files at this verification step were the intended Option A fix files only.

Expected production behavior after deploy:
- No demo match appears as a live match.
- Unknown score stays unknown instead of becoming `0-0`.
- Concile live analysis only runs after the match is revalidated from the server live list.
- Live stats require API-Sports football `fixtureId`.
- Concile analysis reports stats availability explicitly.
- Picks expose `source` and `updatedAt`.
- `NOPICK` is exposed as `no_pick`, not as a future pick.
- Hermes `/deploy` no longer runs `git pull`.
