"""Read-only production checks. No login, payment, prediction or notification send."""
import hashlib
import json
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

BASE = 'https://www.touslesmatchs.com'
RELEASE = '63505d9fa9fc5eb4cb55bb28c99975e405dc93ac'
ROOT = Path(__file__).resolve().parents[1]
FILES = ['app.html', 'performances.html', 'index.html', 'dashboard.html', 'live-ia.html', 'js/app-site-parity.js', 'js/goal05-results.js', 'js/signal-alerts.js', 'css/signal-alerts.css']
SAFE_API = ['/api/goal05/stats', '/api/analysis-history', '/api/daily-pick-history', '/api/public-signal-rules', '/api/auth/access', '/api/auth/passkey/status']
OUT = ROOT / 'work'
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    request = p.request.new_context()
    for file in FILES:
        response = request.get(BASE + '/' + file + '?release=' + RELEASE, timeout=30000)
        assert response.status == 200, (file, response.status)
        expected = subprocess.check_output(['git', 'show', RELEASE + ':public/' + file], cwd=ROOT)
        assert hashlib.sha256(response.body()).digest() == hashlib.sha256(expected).digest(), 'Served file mismatch: ' + file
    stats = request.get(BASE + '/api/goal05/stats').json()
    assert stats['ok'] is True
    history = request.get(BASE + '/api/analysis-history?limit=1&offset=0').json()
    print('LIVE_COUNTS', json.dumps({'official': stats['official'], 'scanner': stats['scanner'], 'history': history.get('stats')}, ensure_ascii=True))
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(service_workers='block')
    def guard(route):
        req = route.request
        parts = urlsplit(req.url)
        if req.method != 'GET':
            route.abort()
        elif parts.netloc == 'www.touslesmatchs.com' and parts.path.startswith('/api/') and parts.path not in SAFE_API:
            route.abort()
        else:
            route.continue_()
    context.route('**/*', guard)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append({'page': page.url, 'message': str(error), 'stack': error.stack}))
    for width in [1440, 390]:
        page.set_viewport_size({'width': width, 'height': 900})
        page.goto(BASE + '/performances', wait_until='networkidle')
        page.locator('#goal05-scanner-kpi').filter(has_text='5 gagn').wait_for()
        assert '0 gagn' in page.locator('#goal05-official-kpi').inner_text()
        assert page.locator('#goal05-scanner-recent article').count() == len(stats['scannerRecent']) + len(stats['officialRecent'])
        assert 'Observation scanner' in page.locator('#goal05-scanner-recent').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUT / f'live-goal05-performances-{width}.png'), full_page=True)
        page.goto(BASE + '/app.html?source=android&app=goal05&native=107&tab=perf', wait_until='networkidle')
        assert page.url == BASE + '/performances?source=android&app=site&native=107'
    page.goto(BASE + '/app.html?source=android&app=goal05&native=107', wait_until='networkidle')
    assert page.url == BASE + '/?source=android&app=site&native=107'
    assert 'Votre signal' in page.locator('h1').first.text_content()
    assert page.locator('.tlm-global-header').count() == 1
    page.screenshot(path=str(OUT / 'live-goal05-app-mobile.png'), full_page=True)
    page.goto(BASE + '/dashboard', wait_until='networkidle')
    assert page.locator('#tlm-alert-toggle').count() == 1
    assert page.locator('#tlm-alert-test').count() == 1
    assert page.locator('#auth-section').is_visible()
    print('LIVE_BROWSER_ERRORS', json.dumps(errors, ensure_ascii=True))
    # Compare the untouched baseline homepage under the same read-only guard.
    baseline = subprocess.check_output(['git', 'show', '07bb876639ca5630327ec802b6b3de24f1395df1:public/index.html'], cwd=ROOT)
    baseline_context = browser.new_context(service_workers='block')
    def baseline_guard(route):
        if route.request.url == BASE + '/':
            route.fulfill(status=200, content_type='text/html; charset=utf-8', body=baseline)
        else:
            guard(route)
    baseline_context.route('**/*', baseline_guard)
    baseline_page = baseline_context.new_page()
    baseline_errors = []
    baseline_page.on('pageerror', lambda error: baseline_errors.append(str(error)))
    baseline_page.goto(BASE + '/', wait_until='networkidle')
    print('BASELINE_BROWSER_ERRORS', json.dumps(baseline_errors, ensure_ascii=True))
    assert all(error['message'] in baseline_errors for error in errors), 'New browser error introduced by release'
    browser.close()
    request.dispose()
print('PUBLIC_NINE_FILE_HASHES_DESKTOP_MOBILE_STATS_APP_ROUTES_AND_ACCOUNT_OK')
