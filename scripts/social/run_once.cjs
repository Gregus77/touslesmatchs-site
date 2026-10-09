// Server-only launcher: parse dotenv as data; never execute it as a shell script.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
try {
  const dotenv = require('dotenv');
  const inheritedDryRun = process.env.DRY_RUN;
  for (const filename of [path.join(root, '.env'), '/etc/tlm-social-runtime.env']) {
    if (fs.existsSync(filename)) Object.assign(process.env, dotenv.parse(fs.readFileSync(filename)));
  }
  if (inheritedDryRun !== undefined) process.env.DRY_RUN = inheritedDryRun;
  const args = process.argv.slice(2);
  const result = spawnSync('/usr/bin/python3',
    [path.join(root, 'scripts/social/pipeline.py'), ...(args.length ? args : ['once', '--publish'])],
    {cwd:root, env:process.env, stdio:'inherit'});
  if (result.error) throw result.error;
  process.exit(result.status === null ? 1 : result.status);
} catch (_) {
  console.log(JSON.stringify({ok:false,errorType:'LauncherError',reason:'runtime_launch_failed'}));
  process.exit(1);
}
