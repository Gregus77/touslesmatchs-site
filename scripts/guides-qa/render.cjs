// CI-only browser regression gate. No credentials, production writes or API calls.
const { chromium } = require(process.env.TLM_QA_PLAYWRIGHT);
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve('public');
const base = 'http://127.0.0.1:8765';
const output = path.resolve('guides-proof');
const routes = ['/guides/', ...fs.readdirSync(path.join(root, 'guides'), {withFileTypes:true})
  .filter(e => e.isDirectory()).map(e => `/guides/${e.name}/`)];
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch();
  const summary = [];
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({viewport:{width, height:1000}, deviceScaleFactor:1});
      await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
      for (const url of routes) {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
        page.on('response', r => {if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`);});
        assert.equal((await page.goto(base + url)).status(), 200);
        await page.evaluate(() => document.fonts.ready);
        const measurements = await page.evaluate(() => ({
          viewport: innerWidth,
          scroll: document.documentElement.scrollWidth,
          h1: document.querySelector('h1')?.textContent,
          background: getComputedStyle(document.body).backgroundColor,
          clipped: [...document.querySelectorAll('h1,h2,p,th,td,nav a')].filter(e => {
            const r = e.getBoundingClientRect();
            return r.left < -1 || r.right > innerWidth + 1;
          }).map(e => e.textContent.slice(0,80)),
        }));
        const file = `${width}-${url.split('/').filter(Boolean).join('-')}.png`;
        await page.screenshot({path:path.join(output,file), fullPage:true});
        assert(measurements.scroll <= width + 1, `${url}: horizontal overflow`);
        assert.equal(measurements.background, 'rgb(6, 18, 38)', `${url}: shared CSS missing`);
        assert.deepEqual(measurements.clipped, [], `${url}: clipped content`);
        assert.deepEqual(errors, [], `${url}: browser errors`);
        summary.push({url,width,file,...measurements});
        await page.close();
      }
      await context.close();
    }
    fs.writeFileSync(path.join(output,'report.json'), JSON.stringify({commit:process.env.GITHUB_SHA,checks:summary,visualReviewRequired:true},null,2));
    console.log(`PASS: ${summary.length} page/viewport checks. Screenshots require visual review before publication.`);
  } finally {await browser.close();}
})().catch(e => {console.error(e); process.exitCode=1;});
