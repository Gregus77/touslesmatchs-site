const assert = require('assert');
const fs = require('fs');
const {JSDOM} = require('jsdom');

const root = __dirname + '/../public/';
const headerCode = fs.readFileSync(root + 'js/global-header.js', 'utf8');
const autoCode = fs.readFileSync(root + 'js/i18n-auto.js', 'utf8');
const files = ['index.html', 'live-ia.html', 'performances.html', 'bankroll.html', 'dashboard.html'];
const response = (data, status = 200) => ({ok:status >= 200 && status < 300, json:async () => data});
const tick = () => new Promise(resolve => setTimeout(resolve, 15));

async function page(file, session, plan) {
  const html = fs.readFileSync(root + file, 'utf8');
  const dom = new JSDOM(html, {url:'https://touslesmatchs.com/' + file, runScripts:'outside-only'});
  const {window} = dom;
  if (session) window.localStorage.setItem('tlm_session_token', 'test-session');
  window.fetch = async url => {
    if (url.startsWith('/api/auth/session')) return session ? response({ok:true,plan}) : response({ok:false},401);
    if (url.startsWith('/api/auth/access')) return response({ok:true,locked:true,plan:'free'});
    if (url.startsWith('/api/auth/dashboard-data')) return session ? response({ok:true,email:'test@example.invalid',plan,status:plan==='free'?'free':'active',recent:[]}) : response({ok:false},401);
    if (url.startsWith('/api/auth/referral-link')) return response({ok:false});
    if (url.startsWith('/api/tier-stats')) return response({ok:false});
    if (url.startsWith('/api/auth/logout')) return response({ok:true});
    throw new Error('Unexpected request: ' + url.split('?')[0]);
  };
  window.eval(headerCode);
  window.tlmMountGlobalHeader();
  window.eval(autoCode);
  if (file === 'dashboard.html') {
    const main = [...window.document.querySelectorAll('script:not([src])')]
      .find(script => script.textContent.includes("var token = localStorage.getItem('tlm_session_token')"));
    assert(main, 'dashboard auth script absent');
    window.eval(main.textContent);
  }
  await tick();
  return dom;
}

(async () => {
  for (const file of files) {
    const dom = await page(file, false, null);
    const {document} = dom.window;
    assert.strictEqual(document.querySelectorAll('header.tlm-global-header').length, 1, file);
    assert.strictEqual(document.querySelectorAll('#tlm-global-language').length, 1, file);
    assert.strictEqual(document.querySelectorAll('#tlm-language-universal').length, 0, file);
    assert.strictEqual(document.querySelectorAll('.tlm-gh-nav a[href="/dashboard"]').length, 0, file);
    assert.strictEqual(document.querySelectorAll('.tlm-gh-account').length, 1, file);
    assert.strictEqual(document.querySelector('.tlm-gh-account').textContent, 'Se connecter', file);
    assert(document.getElementById('tlm-global-status').hidden, file);
    assert.deepStrictEqual([...document.querySelectorAll('.tlm-gh-nav a')].map(el => el.textContent), ['Accueil','Live IA','Résultats','Bankroll'], file);
    assert.strictEqual(document.querySelectorAll('#tlm-global-language option').length, 6, file);
    assert(document.querySelector('.tlm-gh-drawer-account'), file);
    dom.window.localStorage.setItem('tlm_lang', 'es');
    dom.window.document.dispatchEvent(new dom.window.CustomEvent('tlm-language-change', {detail:{lang:'es'}}));
    await tick();
    assert.strictEqual(document.getElementById('tlm-global-language').value, 'es', file);
    assert.strictEqual(document.querySelector('.tlm-gh-nav a[href="/performances"]').textContent, 'Resultados', file);
    dom.window.close();
  }

  const free = await page('dashboard.html', true, 'free');
  assert.strictEqual(free.window.document.getElementById('dash-section').style.display, 'block');
  assert.strictEqual(free.window.document.getElementById('dash-plan').textContent, 'Gratuit');
  assert.strictEqual(free.window.document.querySelector('.tlm-gh-account').textContent, 'Mon compte');
  assert.strictEqual(free.window.document.querySelector('.auth-title').textContent, '');
  assert(free.window.document.title.startsWith('Mon compte'));
  assert(free.window.document.getElementById('nav-logout'));
  free.window.logout();
  await tick();
  assert.strictEqual(free.window.document.querySelector('.auth-title').textContent, 'Connexion');
  assert.strictEqual(free.window.document.querySelector('.tlm-gh-account').textContent, 'Se connecter');
  assert(free.window.document.getElementById('tlm-global-status').hidden);
  free.window.close();

  const paid = await page('dashboard.html', true, 'premium');
  assert.strictEqual(paid.window.document.getElementById('dash-plan').textContent, 'Premium');
  assert.strictEqual(paid.window.document.getElementById('tlm-global-status').textContent, 'Premium');
  paid.window.close();
  process.stdout.write('dashboard/header DOM tests: 5 pages, session absent/free/premium, langue ES, logout OK\n');
})().catch(error => {process.stderr.write(error.stack + '\n');process.exitCode=1;});
