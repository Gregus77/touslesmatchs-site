const assert = require('assert');
const { createSingleFlight } = require('./singleflight');
(async () => {
  const run = createSingleFlight(); let calls = 0; let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const task = async () => { calls += 1; await gate; return 'fresh'; };
  const first = run(task); const second = run(task);
  assert.strictEqual(calls, 1); release();
  assert.deepStrictEqual(await Promise.all([first, second]), ['fresh', 'fresh']);
  await run(async () => { calls += 1; return 'next'; });
  assert.strictEqual(calls, 2);
  console.log('PASS live single-flight');
})().catch((error) => { console.error(error); process.exit(1); });

