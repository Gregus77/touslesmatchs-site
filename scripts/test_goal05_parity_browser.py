"""Actual browser checks with isolated fixtures, never production writes."""
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8770'
OUT = Path(__file__).resolve().parents[1] / 'work'
OUT.mkdir(exist_ok=True)
STATS = {
    'ok': True,
    'official': {'wins': 0, 'losses': 0, 'pending': 0, 'winrate': None, 'priced': 0},
    'scanner': {'wins': 5, 'losses': 1, 'pending': 2, 'winrate': 83.3, 'priced': 0},
    'scannerByColor': {'green': {'wins': 4, 'losses': 0, 'pending': 2, 'winrate': 100}},
    'officialRecent': [],
    'scannerRecent': [
        {'home': 'Fixture A', 'away': 'Fixture B', 'target_team': 'Fixture A', 'outcome': 'win', 'odd_at_pick': None},
        {'home': 'Fixture C', 'away': 'Fixture D', 'target_team': 'Fixture C', 'outcome': 'loss', 'odd_at_pick': None},
        {'home': 'Fixture E', 'away': 'Fixture F', 'target_team': 'Fixture E', 'outcome': 'pending', 'odd_at_pick': None},
    ],
}

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context()
    state = {'failure': False}
    def route(request):
        url = request.request.url
        if not url.startswith(BASE + '/'):
            request.abort()
            return
        path = urlsplit(url).path
        if path == '/api/goal05/stats':
            request.fulfill(status=503 if state['failure'] else 200, content_type='application/json', body=json.dumps(STATS))
        elif path == '/api/analysis-history':
            request.fulfill(content_type='application/json', body=json.dumps({'ok': True, 'analyses': [], 'total': 0, 'stats': {'total': 523, 'wins': 427, 'losses': 96, 'pending': 0, 'winrate': 82, 'roi_pct': 35}}))
        elif path == '/api/auth/verify-otp':
            request.fulfill(content_type='application/json', body=json.dumps({'ok': True, 'token': 'test-otp-token', 'email': 'test@example.invalid', 'plan': 'premium'}))
        elif path == '/api/auth/dashboard-data':
            request.fulfill(content_type='application/json', body=json.dumps({'ok': True, 'email': 'test@example.invalid', 'plan': 'premium', 'status': 'active', 'recent': [], 'credits_used': 0, 'credits_max': 50}))
        elif path == '/api/auth/session':
            request.fulfill(content_type='application/json', body=json.dumps({'ok': True, 'email': 'test@example.invalid', 'plan': 'premium'}))
        elif path.startswith('/api/'):
            request.fulfill(content_type='application/json', body=json.dumps({'ok': True, 'picks': [], 'analyses': [], 'matches': [], 'total': 0}))
        else:
            request.continue_()
    context.route('**/*', route)
    page = context.new_page()
    for width in [1440, 390]:
        page.set_viewport_size({'width': width, 'height': 900})
        page.goto(BASE + '/performances', wait_until='networkidle')
        page.locator('#goal05-scanner-kpi').filter(has_text='5 gagnés').wait_for()
        assert '0 gagnés' in page.locator('#goal05-official-kpi').inner_text()
        assert '83,3 %' in page.locator('#goal05-scanner-kpi').inner_text()
        detail = page.locator('#goal05-scanner-recent')
        assert detail.locator('article').count() == 3
        assert all(word in detail.inner_text() for word in ['Gagné', 'Perdu', 'En attente', 'Cote non enregistrée', 'Observation scanner'])
        assert 'Signal officiel' not in detail.inner_text()
        assert page.locator('#k-total').inner_text() == '523'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
        page.screenshot(path=str(OUT / f'goal05-performances-{width}.png'), full_page=True)
        page.goto(BASE + '/app.html?tab=perf&native=107', wait_until='networkidle')
        assert '/performances?source=android&app=site&native=107' in page.url
        assert detail.locator('article').count() == 3
    page.add_init_script("localStorage.setItem('tlm_email','test@example.invalid');localStorage.setItem('tlm_session_token','test-token');")
    page.goto(BASE + '/app.html?native=107', wait_until='networkidle')
    assert page.url == BASE + '/?source=android&app=site&native=107'
    page.screenshot(path=str(OUT / 'goal05-app-home.png'), full_page=True)
    assert 'Votre signal' in page.locator('h1').first.text_content()
    assert page.locator('.tlm-global-header').count() == 1
    assert page.evaluate("localStorage.getItem('tlm_session_token')") == 'test-token'
    # Fresh real UI login, but isolated OTP/API fixtures: no email or payment is sent.
    context = browser.new_context(viewport={'width': 390, 'height': 900})
    context.route('**/*', route)
    page = context.new_page()
    page.goto(BASE + '/app.html?tab=me', wait_until='networkidle')
    if page.locator('#tlm-privacy-ok').count():
        page.locator('#tlm-privacy-ok').click()
    page.locator('#auth-email').fill('test@example.invalid')
    page.locator('#auth-request-btn').click()
    page.locator('#auth-code').fill('123456')
    page.locator('#auth-verify-btn').click()
    page.locator('#dash-section').wait_for(state='visible')
    page.goto(BASE + '/', wait_until='networkidle')
    assert page.evaluate("localStorage.getItem('tlm_session_token')") == 'test-otp-token'
    assert page.evaluate("localStorage.getItem('tlm_plan')") == 'premium'
    page.evaluate("document.body.insertAdjacentHTML('beforeend','<div class=analysis-card><button id=test-paid-detail>Test fixture</button></div>');window.testPaidClick=false;document.addEventListener('click',function(e){if(e.target.id==='test-paid-detail')window.testPaidClick=true;});")
    page.locator('#test-paid-detail').click()
    assert page.evaluate('window.testPaidClick'), 'OTP subscriber trapped by legacy paid gate'
    assert page.locator('#tlm-paid-gate-modal.on').count() == 0
    page.evaluate("localStorage.setItem('tlm_plan','free')")
    page.evaluate('window.testPaidClick=false')
    page.locator('#test-paid-detail').click()
    assert not page.evaluate('window.testPaidClick'), 'Free-account detail click must be intercepted'
    assert page.locator('#tlm-paid-gate-modal.on').count() == 1, 'Free visitor must still see the gate'
    state['failure'] = True
    page.goto(BASE + '/performances', wait_until='networkidle')
    assert 'indisponibles' in page.locator('#goal05-scanner-recent').inner_text()
    assert page.locator('#k-total').inner_text() == '523'
    browser.close()
print('BROWSER_DESKTOP_MOBILE_STATS_APP_PARITY_OTP_ACCESS_AND_ERROR_OK')
