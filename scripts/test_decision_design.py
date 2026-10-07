"""Browser checks for the local static preview; no production APIs or payments."""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

base = os.environ.get("TLM_PREVIEW_URL", "http://127.0.0.1:8767")
out = Path(os.environ.get("TLM_SCREENSHOT_DIR", "work/screenshots"))
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    for name, width, height in [("desktop", 1440, 1000), ("mobile", 390, 844), ("small", 360, 800)]:
        context = browser.new_context(viewport={"width": width, "height": height}, locale="fr-FR", reduced_motion="reduce")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(error.stack))
        # A local visual preview must never call production services or analytics.
        page.route("**/*", lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
        page.route("**/api/**", lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true,"matches":[],"picks":[],"history":[],"agents":[],"results":[],"total":0}'))
        page.goto(base + "/index.html")
        page.wait_for_load_state("networkidle")
        assert page.locator("h1").count() == 1, "one semantic homepage heading"
        assert page.locator("#hero-title").is_visible()
        assert "5 IA" in page.locator("#hero-title").inner_text()
        assert page.locator(".decision-actions a").count() == 2
        assert page.locator(".decision-app-link").get_attribute("href").endswith("Goal05-beta.apk")
        page.screenshot(path=str(out / f"site-{name}.png"), full_page=True)
        overflow = page.evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 && getComputedStyle(e).position!=='fixed').map(e=>[e.tagName,e.className,Math.round(e.getBoundingClientRect().right)]).slice(0,15)")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"homepage horizontal overflow: {overflow}"
        assert not errors, errors
        if page.locator("#tlm-privacy-ok").count():
            page.locator("#tlm-privacy-ok").click()
        page.screenshot(path=str(out / f"site-{name}-viewport.png"))
        page.screenshot(path=str(out / f"site-{name}.png"), full_page=True)
        if name == "desktop":
            page.keyboard.press("Tab")
            page.locator(".decision-actions a").first.focus()
            assert page.locator(".decision-actions a").first.evaluate("e => getComputedStyle(e).outlineStyle") != "none"
            page.evaluate("i18n.setLang('en')")
            assert "5 AIs" in page.locator("#hero-title").inner_text()
            assert "no guaranteed outcome" in page.locator(".decision-method-note").inner_text()
            assert "not a current signal" in page.locator(".decision-council").get_attribute("aria-label")
            page.evaluate("i18n.setLang('fr')")
        page.goto(base + "/app.html")
        page.wait_for_load_state("networkidle")
        assert page.locator(".goal05-home").is_visible(), "Goal +0.5 introduction visible"
        assert page.locator(".goal05-title").is_visible()
        assert page.locator("#s-me").is_visible(), "guest starts on account"
        page.locator('button[data-tab="pick"]').click()
        page.wait_for_load_state("networkidle")
        assert page.locator("#s-pick").is_visible()
        assert not page.locator("#s-live").is_visible(), "inactive tab must stay hidden"
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "app horizontal overflow"
        page.screenshot(path=str(out / f"app-{name}.png"), full_page=True)
        page.screenshot(path=str(out / f"app-{name}-viewport.png"))
        for tab in ["live", "perf", "me"]:
            page.locator(f'button[data-tab="{tab}"]').click()
            page.wait_for_load_state("networkidle")
            assert page.locator(f"#s-{tab}").is_visible()
            assert not page.locator("#s-pick").is_visible()
        assert not errors, errors
        for surface in ["live-ia", "performances", "dashboard", "bankroll", "faq"]:
            page.goto(base + f"/{surface}.html")
            page.wait_for_load_state("networkidle")
            assert page.locator("body.tlm-decision").count() == 1
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"{surface}: horizontal overflow"
            assert not errors, (surface, errors)
        print(f"PASS {name}: homepage/app, heading, links, layout, tabs, JS")
        context.close()
    browser.close()
