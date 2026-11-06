"""Browser smoke test (Playwright + Chromium). Run after build: python3 tests/smoke.py"""
import re, subprocess, sys, time, json, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "-d", str(ROOT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); B = "http://localhost:8765"; fails = []
urls = re.findall(r"<loc>https://boombastis.my.id([^<]*)</loc>", (ROOT/"sitemap.xml").read_text())
def bad(msg): fails.append(msg); print(" -", msg)
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h in [(360, 740), (768, 900), (1280, 800)]:
        ctx = br.new_context(viewport={"width": w, "height": h}); ctx.route(re.compile(r"^(?!http://localhost).*"), lambda r: r.abort())
        for u in urls:
            pg = ctx.new_page(); logs = []
            pg.on("console", lambda m, l=logs: m.type == "error" and l.append(m.text)); pg.on("pageerror", lambda e, l=logs: l.append("pageerror: " + str(e)))
            pg.goto(B + u, wait_until="load")
            if pg.evaluate("document.documentElement.scrollWidth") > w: bad(f"{u} @{w}: horizontal overflow")
            for t in logs:
                if "Content Security Policy" in t or "pageerror" in t:
                    if u == "/qr-code-generator/" and "qrcode" in t: continue  # library comes from cdnjs, blocked in this offline test
                    bad(f"{u} @{w}: {t[:140]}")
            pg.close()
        ctx.close()
    # home behaviour on a phone
    ctx = br.new_context(viewport={"width": 390, "height": 800}); ctx.route(re.compile(r"^(?!http://localhost).*"), lambda r: r.abort()); pg = ctx.new_page()
    vis = lambda: pg.locator(".tcard:visible").count()
    pg.goto(B + "/"); 
    if vis() != 17: bad(f"home shows {vis()} cards, expected 17")
    pg.fill("#q", "hash")
    if vis() != 1: bad("search 'hash' should show 1 card")
    pg.fill("#q", "xyzzy")
    if not pg.locator("#empty").is_visible(): bad("empty state not shown")
    pg.click("#reset"); pg.click('.chip[data-cat="image"]')
    if vis() != 2: bad(f"Images chip shows {vis()}, expected 2")
    pg.click('.chip[data-cat="all"]'); pg.locator(".fav").first.click()
    if not json.loads(pg.evaluate("localStorage.getItem('bb-fav')")): bad("favorite not saved")
    pg.click("#favOnly")
    if vis() != 1: bad("favorites-only should show 1")
    pg.goto(B + "/?q=json")
    if vis() != 2: bad(f"?q=json shows {vis()}, expected 2 (JSON Formatter, JSON/CSV)")
    pg.click("#menuBtn")
    if not pg.locator("#mainNav a").first.is_visible(): bad("mobile menu did not open")
    pg.click("#themeBtn")
    if pg.evaluate("document.documentElement.dataset.theme") != "light": bad("theme toggle: expected light after first click")
    pg.reload()
    if pg.evaluate("document.documentElement.dataset.theme") != "light": bad("theme not persisted")
    pg.click("#themeBtn"); pg.click("#themeBtn")
    if pg.evaluate("document.documentElement.dataset.theme") is not None: bad("third click should return to system mode")
    pg.goto(B + "/id/")
    if vis() != 6: bad(f"/id/ shows {vis()}, expected 6")
    # tool functions still work
    pg.goto(B + "/word-counter/"); pg.fill("#wt", "satu dua tiga empat")
    if pg.inner_text("#w1").strip() != "4": bad("word counter broken")
    pg.goto(B + "/json-formatter/"); pg.fill("#jin", '{"a":1}'); pg.click("#jf")
    if '"a": 1' not in pg.inner_text("#jout") and '"a": 1' not in (pg.input_value("#jout") if pg.locator("textarea#jout").count() else ""): bad("json formatter broken")
    pg.goto(B + "/base64/"); pg.fill("#bin", "hello"); pg.click("#be")
    out = pg.inner_text("#bout") if pg.locator("#bout").count() and pg.evaluate("document.getElementById('bout').tagName") != "TEXTAREA" else pg.input_value("#bout")
    if "aGVsbG8=" not in out: bad("base64 broken")
    br.close()
srv.terminate(); print("smoke:", "OK" if not fails else f"{len(fails)} failure(s)"); sys.exit(1 if fails else 0)
