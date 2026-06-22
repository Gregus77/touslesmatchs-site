Task 7 report: Neutralize Hermes Deploy Command

Summary
- Updated `scripts/hermes_admin_bot.js` so `/deploy` no longer runs `git pull` or any deploy automation.
- Kept `execSync` in place because `/status` still uses it.
- Updated the `/deploy` help text to match the locked guidance.

Verification
- `node --check scripts/hermes_admin_bot.js` passed.
- `node --check scripts/api_server.js` passed.

Scan result
- No executable deploy `git pull` behavior remains in `scripts/hermes_admin_bot.js`.
- Remaining `/deploy` references are the locked guidance message, the help label, and the router entry.
- The only live `git pull` text left is informational inside the locked guidance response.

