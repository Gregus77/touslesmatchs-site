# Option A Smoke Report - 2026-06-22

Branch: `claude/happy-bell-h9zj83`

Checks run:
- `node scripts/smoke_live_contract.js` -> `smoke_live_contract: ok`
- `node --check scripts/api_server.js` -> exit 0
- `node --check scripts/hermes_admin_bot.js` -> exit 0
- `python -m py_compile council/tools/sports_api.py` -> exit 0
- `git status --short --branch` -> run during final verification before commit

Expected production behavior after deploy:
- No demo match appears as a live match.
- Unknown score stays unknown instead of becoming `0-0`.
- Live stats require API-Sports football `fixtureId`.
- Concile analysis reports stats availability explicitly.
- Picks expose `source` and `updatedAt`.
- Hermes `/deploy` no longer runs `git pull`.
