#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Buat halaman multi-bahasa (/en/, /zh/, ...), sematkan hreflang + pemilih bahasa
di halaman utama (Indonesia), dan perbarui sitemap.xml.

Jalankan dari root repo:  python3 tools/build_i18n.py
Aman dijalankan berulang kali (idempoten).
"""
import html, json, os, re, sys
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))
from translations import ORDER, NAMES, HREFLANG, T

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://boombastis.my.id"
TODAY = date.today().isoformat()
e = html.escape


def url(code):
    return BASE + "/" if code == "id" else f"{BASE}/{code}/"


def hreflang_links():
    out = []
    for c in ORDER:
        out.append(f'<link rel="alternate" hreflang="{HREFLANG[c]}" href="{url(c)}">')
    out.append(f'<link rel="alternate" hreflang="x-default" href="{url("en")}">')
    return "\n".join(out)


def lang_menu(current):
    cur = ' aria-current="true"'
    items = "".join(
        f'<a href="{url(c)}" hreflang="{HREFLANG[c]}" lang="{HREFLANG[c]}"'
        f'{cur if c == current else ""}>{e(NAMES[c][0])}</a>'
        for c in ORDER)
    return (f'<details class="lang"><summary aria-label="Language">🌐 {e(NAMES[current][0])}</summary>'
            f'<div class="lang-list">{items}</div></details>')


def lang_row():
    items = " · ".join(
        f'<a href="{url(c)}" hreflang="{HREFLANG[c]}" lang="{HREFLANG[c]}">{e(NAMES[c][0])}</a>' for c in ORDER)
    return f'<div class="langrow">🌐 {items}</div>'


EXTRA_CSS = """
  /* ---------- bahasa ---------- */
  .lang{position:relative}
  .lang summary{cursor:pointer;list-style:none;font-size:14px;color:var(--muted);padding:6px 12px;border-radius:99px;border:.5px solid var(--line);white-space:nowrap}
  .lang summary::-webkit-details-marker{display:none}
  .lang-list{position:absolute;right:0;top:38px;min-width:180px;background:var(--card);border:.5px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:6px;display:grid;z-index:40}
  .nav-links .lang-list a{display:block!important;padding:8px 12px;border-radius:10px;font-size:14.5px;color:var(--text)}
  .nav-links .lang-list a:hover,.nav-links .lang-list a[aria-current]{background:var(--bg2)}
  .langrow{display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:center;padding:0 20px 26px;font-size:13.5px;color:var(--muted)}
  .langrow a:hover{color:var(--text)}
  [dir=rtl] .lang-list{right:auto;left:0}
  [dir=rtl] .faq summary::after{float:left}
  [dir=rtl] .checks li{flex-direction:row}
  .hero.single .wrap{grid-template-columns:1fr}
  .hero.single p.lead{max-width:640px}
"""


def jsonld(code, t):
    u = url(code)
    plans = [("Starter", "29000"), ("Business", "79000"), ("Pro", "149000")]
    return json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "Organization", "@id": BASE + "/#org", "name": "Boombastis", "url": BASE + "/",
             "logo": BASE + "/icon-512.png"},
            {"@type": "WebSite", "@id": BASE + "/#web", "url": BASE + "/", "name": "Boombastis",
             "publisher": {"@id": BASE + "/#org"}},
            {"@type": "WebPage", "@id": u + "#page", "url": u, "name": t["title"], "description": t["desc"],
             "inLanguage": HREFLANG[code], "isPartOf": {"@id": BASE + "/#web"}},
            {"@type": "SoftwareApplication", "name": "Boombastis SMS Gateway",
             "applicationCategory": "BusinessApplication", "operatingSystem": "Android, Web",
             "inLanguage": HREFLANG[code], "description": t["desc"], "url": u,
             "offers": [{"@type": "Offer", "name": n, "price": p, "priceCurrency": "IDR", "url": u + "#harga"}
                        for n, p in plans]},
            {"@type": "FAQPage", "inLanguage": HREFLANG[code],
             "mainEntity": [{"@type": "Question", "name": q,
                             "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faq"][1]]},
        ]}, ensure_ascii=False)


def head_block(code, t, css):
    name, loc, _ = NAMES[code]
    alt = "".join(f'<meta property="og:locale:alternate" content="{NAMES[c][1]}">' for c in ORDER if c != code)
    return f"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(t['title'])}</title>
<meta name="description" content="{e(t['desc'])}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<link rel="canonical" href="{url(code)}">
{hreflang_links()}
<meta name="theme-color" content="#fbfbfd" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website"><meta property="og:locale" content="{loc}">{alt}<meta property="og:site_name" content="Boombastis">
<meta property="og:title" content="{e(t['title'])}"><meta property="og:description" content="{e(t['desc'])}">
<meta property="og:url" content="{url(code)}"><meta property="og:image" content="{BASE}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{e(t['title'])}"><meta name="twitter:description" content="{e(t['desc'])}"><meta name="twitter:image" content="{BASE}/og.png">
<link rel="apple-touch-icon" href="/icon-512.png">
<script type="application/ld+json">{jsonld(code, t)}</script>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%232563eb'/%3E%3Cpath d='M16 22a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H30l-9 7v-7h-1a6 6 0 0 1-4-6z' fill='%23fff'/%3E%3C/svg%3E">
<style>{css}</style>
<script src="/config.js"></script>"""


ICONS = [
    '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/>',
    '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
    '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
]
PLANS = [("Starter", "Rp29.000", 500, 30, 1, 100), ("Business", "Rp79.000", 2000, 30, 2, 400),
         ("Pro", "Rp149.000", 5000, 30, 5, 1000)]


def fmt(n):
    return f"{n:,}".replace(",", ".")


def page(code, t, css):
    name, loc, direction = NAMES[code]
    feat_cards = "".join(
        f'<div class="card"><div class="ico"><svg viewBox="0 0 24 24">{ICONS[i]}</svg></div>'
        f'<h3>{e(ti)}</h3><p>{e(d)}</p></div>' for i, (ti, d) in enumerate(t["feat"][2]))
    steps = "".join(f'<div class="step"><h3>{e(a)}</h3><p>{e(b)}</p></div>' for a, b in t["how"][2])
    pe, ph, pdesc, units, choose, note = t["price"]
    plans = ""
    for i, (nm, pr, sms, days, dev, day) in enumerate(PLANS):
        lis = "".join(f"<li>{e(u.format(n=fmt(v)))}</li>" for u, v in zip(units, (sms, days, dev, day)))
        plans += (f'<div class="card plan"><h3>{nm}</h3><div class="price">{pr}</div><p>{e(pdesc[i])}</p>'
                  f'<ul>{lis}</ul><a class="btn primary" href="/app/">{e(choose)}</a></div>')
    checks = "".join(f"<li><span><b>{e(b)}</b> {e(d)}</span></li>" for b, d in t["sec"][2])
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in t["faq"][1])
    trust = "".join(f"<span>{e(x)}</span>" for x in t["trust"])
    nav = t["nav"]
    foot = t["foot"]
    apk_soon, apk_dl = t["apk"]
    return f"""<!doctype html>
<html lang="{HREFLANG[code]}" dir="{direction}">
<head>
{head_block(code, t, css)}
</head>
<body>

<a href="#main" class="skip">{e(t['skip'])}</a>
<header class="nav">
  <div class="wrap">
    <a href="{url(code)}" class="logo" aria-label="Boombastis">
      <i><svg viewBox="0 0 24 24"><path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 4v-4H7a3 3 0 0 1-3-3z"/></svg></i>
      Boombastis
    </a>
    <nav class="nav-links">
      <a href="#fitur">{e(nav[0])}</a>
      <a href="#cara-kerja">{e(nav[1])}</a>
      <a href="#harga">{e(nav[2])}</a>
      <a href="#faq">{e(nav[3])}</a>
      {lang_menu(code)}
      <a href="/app/" class="btn primary sm">{e(t['login'])}</a>
    </nav>
  </div>
</header>

<main id="main">
<div class="hero single">
  <div class="wrap">
    <div>
      <span class="pill"><b></b> {e(t['pill'])}</span>
      <h1>{e(t['h1'][0])}<span class="grad">{e(t['h1'][1])}</span></h1>
      <p class="lead">{e(t['lead'])}</p>
      <div class="cta">
        <a class="btn primary" href="/app/">{e(t['cta'][0])}</a>
        <a class="btn ghost" href="#harga">{e(t['cta'][1])}</a>
      </div>
      <div class="trust">{trust}</div>
    </div>
  </div>
</div>

<section id="fitur">
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">{e(t['feat'][0])}</span><h2>{e(t['feat'][1])}</h2></div>
    <div class="grid3">{feat_cards}</div>
  </div>
</section>

<section id="cara-kerja" class="alt">
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">{e(t['how'][0])}</span><h2>{e(t['how'][1])}</h2></div>
    <div class="flow">{steps}</div>
  </div>
</section>

<section id="harga">
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">{e(pe)}</span><h2>{e(ph)}</h2></div>
    <div class="grid3" id="plans">{plans}</div>
    <p class="note">{e(note)}</p>
    <div class="cta" style="margin-top:28px;text-align:center;justify-content:center;flex-direction:column;align-items:center">
      <a id="apk" class="btn primary" href="/app/" aria-disabled="true">{e(apk_soon)}</a>
      <p id="apkv" style="color:var(--muted);font-size:14px;margin:10px 0 0"></p>
    </div>
  </div>
</section>

<section id="keamanan" class="alt">
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">{e(t['sec'][0])}</span><h2>{e(t['sec'][1])}</h2></div>
    <ul class="checks">{checks}</ul>
  </div>
</section>

<section id="faq">
  <div class="wrap faq">
    <div class="sec-head"><h2>{e(t['faq'][0])}</h2></div>
    {faq}
  </div>
</section>

<section class="final">
  <div class="wrap">
    <h2>{e(t['fin'][0])}</h2>
    <p>{e(t['fin'][1])}</p>
    <div class="cta"><a class="btn primary" href="/app/">{e(t['fin'][2])}</a></div>
  </div>
</section>
</main>

<a class="btn primary sticky" href="/app/">{e(t['sticky'])}</a>
<footer>
  <div class="wrap">
    <span>© <span id="yr">2026</span> Boombastis · {e(foot[0])}</span>
    <span>{e(foot[1])}: <a href="https://jurkon.my.id/">Journal Connection</a> &middot; <a href="https://smartphone-empire.my.id/">Smartphone Empire</a></span>
    <span><a href="/app/">{e(t['login'].split(' /')[0])}</a> · <a href="/terms.html" hreflang="id">{e(foot[2])}</a> · <a href="/privacy.html" hreflang="id">{e(foot[3])}</a></span>
  </div>
  <div class="wrap" style="padding-top:0"><span style="font-size:12.5px">{e(foot[4])}</span></div>
  {lang_row()}
</footer>
<script>
(async()=>{{
  const C=window.CFG||{{}};
  try{{
    if(!C.key||C.key.startsWith('ISI-'))throw 0;
    const r=await fetch(C.url+'/rest/v1/site_settings?select=key,value',{{headers:{{apikey:C.key,Authorization:'Bearer '+C.key}}}});
    if(!r.ok)throw 0;
    const S=Object.fromEntries((await r.json()).map(x=>[x.key,x.value]));
    if(S.apk_url&&/^https:\\/\\//.test(S.apk_url)){{const a=document.getElementById('apk');a.href=S.apk_url;a.textContent={json.dumps(apk_dl, ensure_ascii=False)};a.removeAttribute('aria-disabled');}}
    if(S.apk_version)document.getElementById('apkv').textContent='v'+S.apk_version;
  }}catch(e){{}}
  document.getElementById('yr').textContent=new Date().getFullYear();
}})();
</script>
</body>
</html>
"""


def patch_root(src):
    """Tambahkan hreflang, og:locale:alternate, pemilih bahasa dan tautan footer ke index.html (id)."""
    if "hreflang=" in src:
        # sudah dipatch: buang patch lama agar bisa dibangun ulang bersih
        src = re.sub(r'<link rel="alternate" hreflang="[^"]+" href="[^"]+">\n?', "", src)
        src = re.sub(r'<meta property="og:locale:alternate"[^>]*>', "", src)
        src = re.sub(r'<details class="lang">.*?</details>\s*', "", src, flags=re.S)
        src = re.sub(r'<div class="langrow">.*?</div>\s*', "", src, flags=re.S)
        src = re.sub(r"\n  /\* ---------- bahasa ---------- \*/.*?\.hero\.single p\.lead\{[^}]*\}\n", "\n", src, flags=re.S)
    alt = "".join(f'<meta property="og:locale:alternate" content="{NAMES[c][1]}">' for c in ORDER if c != "id")
    src = src.replace('<link rel="canonical" href="https://boombastis.my.id/">',
                      '<link rel="canonical" href="https://boombastis.my.id/">\n' + hreflang_links(), 1)
    src = src.replace('<meta property="og:locale" content="id_ID">',
                      '<meta property="og:locale" content="id_ID">' + alt, 1)
    src = src.replace('<a href="app/" class="btn primary sm">', lang_menu("id") + '\n      <a href="app/" class="btn primary sm">', 1)
    src = src.replace("</style>", EXTRA_CSS + "</style>", 1)
    src = src.replace("</footer>", "  " + lang_row() + "\n</footer>", 1)
    return src


def sitemap():
    alts = "".join(
        f'<xhtml:link rel="alternate" hreflang="{HREFLANG[c]}" href="{url(c)}"/>' for c in ORDER)
    alts += f'<xhtml:link rel="alternate" hreflang="x-default" href="{url("en")}"/>'
    rows = []
    for c in ORDER:
        pr = "1.0" if c == "id" else "0.9"
        rows.append(f"  <url><loc>{url(c)}</loc><lastmod>{TODAY}</lastmod><changefreq>weekly</changefreq>"
                    f"<priority>{pr}</priority>{alts}</url>")
    rows.append(f"  <url><loc>{BASE}/terms.html</loc><lastmod>{TODAY}</lastmod><priority>0.3</priority></url>")
    rows.append(f"  <url><loc>{BASE}/privacy.html</loc><lastmod>{TODAY}</lastmod><priority>0.3</priority></url>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(rows) + "\n</urlset>\n")


def main():
    idx_path = os.path.join(ROOT, "index.html")
    src = open(idx_path, encoding="utf-8").read()
    css = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
    # CSS dasar untuk halaman bahasa = CSS halaman utama tanpa blok bahasa lama, lalu tambah EXTRA_CSS
    css = re.sub(r"\n  /\* ---------- bahasa ---------- \*/.*?\.hero\.single p\.lead\{[^}]*\}\n", "\n", css, flags=re.S)
    css_full = css + EXTRA_CSS

    for code in ORDER:
        if code == "id":
            continue
        d = os.path.join(ROOT, code)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
            f.write(page(code, T[code], css_full))
        print("ok", code)

    with open(idx_path, "w", encoding="utf-8") as f:
        f.write(patch_root(src))
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap())
    print("index.html + sitemap.xml diperbarui")


if __name__ == "__main__":
    main()
