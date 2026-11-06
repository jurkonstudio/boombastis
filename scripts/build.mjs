// Boombastis page generator. Zero dependencies. Run: node scripts/build.mjs
// Sources: src/pages/**/index.html (fragments with <!--meta {...}--> header) + data/tools.json.
// Output: static HTML in the repo root (same URLs as before), sitemap.xml and sw.js.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ORIGIN = "https://boombastis.my.id";
const TODAY = new Date().toISOString().slice(0, 10);
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/tools.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const write = (url, html) => {
  const f = path.join(ROOT, url.replace(/\/$/, "/index.html").replace(/^\//, ""));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
};
const ver = (p) => crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, p))).digest("hex").slice(0, 8);
const asset = (p) => `/${p}?v=${ver(p)}`;

// Pairs that are true translations of each other (the only ones that get hreflang).
const PAIRS = { "/": "/id/", "/about/": "/id/tentang/", "/privacy/": "/id/privasi/", "/contact/": "/id/kontak/" };
const ALT = {};
for (const [a, b] of Object.entries(PAIRS)) { ALT[a] = { en: a, id: b }; ALT[b] = { en: a, id: b }; }

const T = {
  en: {
    skip: "Skip to content", tools: "All tools", about: "About", switchTo: "Bahasa Indonesia", switchShort: "ID",
    theme: "Theme", menu: "Menu", home: "Home", crumbs: "Breadcrumb", main: "Main navigation",
    h1: "Free online tools that stay private", sub: "Fast tools that run in your browser. Your files and passwords are never uploaded.",
    search: "Search tools", ph: "Search tools, e.g. hash", all: "All", fav: "Favorites",
    one: "tool", many: "tools", none: "No tools found", noneSub: "Try another word or pick a different category.", clear: "Clear filters",
    noFav: "You have no favorites yet. Tap the heart on a tool to save it here.",
    add: "Add to favorites", rem: "Remove from favorites", footTools: "Tools", footId: "Bahasa Indonesia", footCo: "Site",
    legal: ["About", "Privacy", "Contact"], copy: "© 2026 Boombastis. Your files and passwords never leave your browser.",
    themeNames: ["System", "Light", "Dark"],
    cats: { image: "Images", text: "Text & Developer", security: "Security & Privacy", network: "Network & Browser", utility: "Utilities", id: "Bahasa Indonesia" },
    title: "Boombastis: free online tools that run in your browser",
  },
  id: {
    skip: "Langsung ke konten", tools: "Semua alat", about: "Tentang", switchTo: "English", switchShort: "EN",
    theme: "Tema", menu: "Menu", home: "Beranda", crumbs: "Jejak halaman", main: "Navigasi utama",
    h1: "Alat online gratis, privat, dan cepat", sub: "Terbilang, THR, pace lari, umur, kompres foto, dan lainnya. Berjalan di browser, data Anda tidak diunggah.",
    search: "Cari alat", ph: "Cari alat, misalnya THR", all: "Semua", fav: "Favorit",
    one: "alat", many: "alat", none: "Alat tidak ditemukan", noneSub: "Coba kata lain atau pilih kategori yang berbeda.", clear: "Hapus filter",
    noFav: "Belum ada favorit. Ketuk ikon hati pada alat untuk menyimpannya di sini.",
    add: "Tambah ke favorit", rem: "Hapus dari favorit", footTools: "Alat", footId: "English tools", footCo: "Situs",
    legal: ["Tentang", "Privasi", "Kontak"], copy: "© 2026 Boombastis. File dan kata sandi Anda tidak pernah meninggalkan browser.",
    themeNames: ["Sistem", "Terang", "Gelap"],
    cats: { fin: "Keuangan & Pekerjaan", sport: "Olahraga", date: "Tanggal & Waktu", image: "Gambar", dev: "Developer & Data" },
    title: "Alat online gratis, privat, dan cepat | Boombastis",
  },
};
const LEGAL = { en: ["/about/", "/privacy/", "/contact/"], id: ["/id/tentang/", "/id/privasi/", "/id/kontak/"] };
const IP_HOSTS = "https://api64.ipify.org https://ipwho.is https://cloudflare-dns.com https://dns.google";
const QR_CDN = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";

const sun = '<svg class="ti" data-m="1" hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>';
const moon = '<svg class="ti" data-m="2" hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>';
const auto = '<svg class="ti" data-m="0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg>';

function head(p) {
  const t = T[p.lang], alts = ALT[p.url];
  const og = ORIGIN + p.og, canon = ORIGIN + p.url;
  const hl = alts
    ? `<link rel="alternate" hreflang="en" href="${ORIGIN + alts.en}"><link rel="alternate" hreflang="id" href="${ORIGIN + alts.id}"><link rel="alternate" hreflang="x-default" href="${ORIGIN + alts.en}">`
    : "";
  const usesQr = p.scripts.some((s) => s.includes("qrcode"));
  const script = ["'self'", usesQr && !exists("assets/vendor/qrcode.min.js") ? "https://cdnjs.cloudflare.com" : ""].filter(Boolean).join(" ");
  const connect = ["'self'", p.scripts.some((s) => s.includes("ipdns")) ? IP_HOSTS : ""].filter(Boolean).join(" ");
  const csp = `default-src 'self'; script-src ${script}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src ${connect}; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'self'; worker-src 'self'`;
  return `<!doctype html>
<html lang="${p.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${canon}">${hl}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#ff3b30">
<meta property="og:type" content="website"><meta property="og:site_name" content="Boombastis"><meta property="og:locale" content="${p.lang === "id" ? "id_ID" : "en_US"}">
<meta property="og:title" content="${esc(p.title.replace(/ \| Boombastis$/, ""))}"><meta property="og:url" content="${canon}">
<meta property="og:description" content="${esc(p.description)}"><meta property="og:image" content="${og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${og}">
${p.ld.map((j) => `<script type="application/ld+json">${j}</script>`).join("\n")}
<script src="${asset("assets/theme-init.js")}"></script>
<link rel="stylesheet" href="${asset("assets/site.css")}">
</head>`;
}

function header(p) {
  const t = T[p.lang], alts = ALT[p.url];
  const home = p.lang === "id" ? "/id/" : "/";
  const other = alts ? alts[p.lang === "id" ? "en" : "id"] : p.lang === "id" ? "/" : "/id/";
  return `<body>
<a class="skip" href="#main">${t.skip}</a>
<header class="top"><div class="top-in">
<a class="brand" href="${home}"><img src="/brand/logo-mark.svg" alt="" width="32" height="32"><span>Boom<b>bastis</b></span></a>
<nav class="main-nav" id="mainNav" aria-label="${t.main}"><a href="${home}#tools">${t.tools}</a><a href="${LEGAL[p.lang][0]}">${t.about}</a><a href="${other}" hreflang="${p.lang === "id" ? "en" : "id"}" lang="${p.lang === "id" ? "en" : "id"}" class="lang">${t.switchTo}</a></nav>
<div class="top-act">
<button class="icon-btn" id="themeBtn" type="button" aria-label="${t.theme}" title="${t.theme}" data-names="${esc(t.themeNames.join("|"))}" data-label="${t.theme}">${auto}${sun}${moon}</button>
<button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="${t.menu}" aria-expanded="false" aria-controls="mainNav"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
</div></div></header>`;
}

function footer(p) {
  const t = T[p.lang], L = LEGAL[p.lang];
  const link = (x) => `<a href="${x.slug}">${esc(x.name)}</a>`;
  const mine = data.tools.filter((x) => x.lang === p.lang);
  const otherTools = data.tools.filter((x) => x.lang !== p.lang);
  return `<footer class="foot"><div class="foot-in">
<div class="foot-col"><b>${t.footTools}</b>${mine.map(link).join("")}</div>
<div class="foot-col"><b>${t.footId}</b>${otherTools.map(link).join("")}</div>
<div class="foot-col"><b>${t.footCo}</b>${t.legal.map((n, i) => `<a href="${L[i]}">${n}</a>`).join("")}</div>
</div><p class="copy">${t.copy}</p></footer>`;
}

function scripts(p, extra = []) {
  const list = p.scripts.map((s) => {
    if (s.includes("qrcode") && exists("assets/vendor/qrcode.min.js")) return `/assets/vendor/qrcode.min.js`;
    return s.startsWith("/assets/") ? asset(s.split("?")[0].slice(1)) : s;
  });
  const all = [asset("assets/ui.js"), ...extra, ...list, asset("assets/sw-register.js")];
  return all.map((s) => `<script src="${s}"></script>`).join("\n");
}

function page(p, body, { wide = false, cls = "", extra = [] } = {}) {
  return `${head(p).replace("<html", "<!-- Generated by scripts/build.mjs. Edit src/pages or data/tools.json, then run: node scripts/build.mjs -->\n<html")}\n${header(p)}\n<main id="main" class="${wide ? "wide " : ""}${cls}">\n${body}\n</main>\n${footer(p)}\n${scripts(p, extra)}\n</body>\n</html>\n`;
}

// ---------- home and hub ----------
function card(x, t) {
  const text = (x.name + " " + x.desc).toLowerCase();
  return `<div class="tcard" data-slug="${x.slug}" data-cats="${x.cats.join(" ")}" data-text="${esc(text)}"><a href="${x.slug}">${x.svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"')}<h2>${esc(x.name)}</h2><p>${esc(x.desc)}</p></a><button class="fav" type="button" aria-pressed="false" aria-label="${t.add}: ${esc(x.name)}" data-add="${t.add}: ${esc(x.name)}" data-rem="${t.rem}: ${esc(x.name)}"><svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.7c0 5.4-7.5 10-7.5 10z"/></svg></button></div>`;
}

function homeBody(lang) {
  const t = T[lang];
  const list = data.tools.filter((x) => (lang === "id" ? x.lang === "id" : true));
  const keys = lang === "id" ? Object.keys(t.cats) : Object.keys(t.cats);
  const used = keys.filter((k) => list.some((x) => x.cats.includes(k)));
  const chips = `<button class="chip" type="button" data-cat="all" aria-pressed="true">${t.all}</button>` + used.map((k) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="false">${t.cats[k]}</button>`).join("");
  return `<section class="hero"><h1>${t.h1}</h1><p>${t.sub}</p>
<form class="finder" id="finder" role="search" data-lbl-one="${t.one}" data-lbl-many="${t.many}" data-lbl-fav="${t.fav}" data-nofav="${esc(t.noFav)}">
<svg class="mag" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
<label class="sr" for="q">${t.search}</label><input id="q" type="search" name="q" placeholder="${t.ph}" autocomplete="off" enterkeyhint="search"><kbd aria-hidden="true">Ctrl K</kbd></form></section>
<section id="tools" class="catalog" aria-label="${t.tools}">
<div class="chips" role="group" aria-label="${t.tools}">${chips}</div>
<div class="bar"><span id="count" role="status" aria-live="polite">${list.length} ${t.many}</span><button class="favonly" id="favOnly" type="button" aria-pressed="false">${t.fav}</button></div>
<div class="grid">${list.map((x) => card(x, t)).join("")}</div>
<div class="empty" id="empty" hidden><h2>${t.none}</h2><p id="emptyMsg">${t.noneSub}</p><button class="btn alt" id="reset" type="button">${t.clear}</button></div>
</section>`;
}

function homeMeta(lang) {
  const s = data.site[lang];
  const url = lang === "id" ? "/id/" : "/";
  const ld = lang === "id"
    ? { "@context": "https://schema.org", "@type": "WebSite", name: "Boombastis", url: ORIGIN + url, inLanguage: "id" }
    : { "@context": "https://schema.org", "@type": "WebSite", name: "Boombastis", url: ORIGIN + url, inLanguage: "en",
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: ORIGIN + "/?q={search_term_string}" }, "query-input": "required name=search_term_string" } };
  return { url, lang, title: T[lang].title, description: s.description, og: s.og, ld: [JSON.stringify(ld)], scripts: [] };
}

// ---------- fragments ----------
function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(dir + "/" + e.name) : e.name.endsWith(".html") ? [dir + "/" + e.name] : []);
}
const urls = [];
function emit(p, html) { write(p.url, html); urls.push(p.url); }

for (const lang of ["en", "id"]) {
  const m = homeMeta(lang);
  emit(m, page(m, homeBody(lang), { wide: true, cls: "home", extra: [asset("assets/home.js")].concat(lang === "en" ? [asset("assets/legacy-hash.js")] : []) }));
}
for (const f of walk("src/pages")) {
  const raw = read(f);
  const mm = raw.match(/^<!--meta (.*?)-->\n/s);
  const p = JSON.parse(mm[1]);
  let body = raw.slice(mm[0].length).trim();
  const isTool = /class="about"/.test(body) && /<section/.test(body);
  if (isTool) {
    const h1 = (body.match(/<h1[^>]*>(.*?)<\/h1>/s) || [, ""])[1].replace(/<[^>]+>/g, "");
    const t = T[p.lang];
    const home = p.lang === "id" ? "/id/" : "/";
    body = `<nav class="crumbs" aria-label="${t.crumbs}"><a href="${home}">${t.home}</a><span aria-hidden="true">/</span><span aria-current="page">${h1}</span></nav>\n<div class="tool-layout">\n${body}\n</div>`;
  } else body = `<div class="prose">\n${body}\n</div>`;
  emit(p, page(p, body, { wide: isTool }));
}

// ---------- sitemap ----------
const loc = (u) => ORIGIN + u;
const sm = urls.sort().map((u) => {
  const a = ALT[u];
  const links = a ? `<xhtml:link rel="alternate" hreflang="en" href="${loc(a.en)}"/><xhtml:link rel="alternate" hreflang="id" href="${loc(a.id)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${loc(a.en)}"/>` : "";
  return `  <url><loc>${loc(u)}</loc><lastmod>${TODAY}</lastmod>${links}</url>`;
});
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sm.join("\n")}\n</urlset>\n`);

// ---------- service worker ----------
const assetFiles = fs.readdirSync(path.join(ROOT, "assets")).filter((n) => /\.(js|css)$/.test(n)).map((n) => "/assets/" + n);
if (exists("assets/vendor/qrcode.min.js")) assetFiles.push("/assets/vendor/qrcode.min.js");
const pre = ["/", "/404.html", "/site.webmanifest", ...urls.filter((u) => u !== "/"), ...assetFiles, "/brand/logo-mark.svg", "/brand/icon-192.png", "/favicon.svg"];
const hash = crypto.createHash("md5").update(pre.join() + assetFiles.map((a) => ver(a.slice(1))).join() + urls.map((u) => crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, u.replace(/\/$/, "/index.html").replace(/^\//, "")))).digest("hex")).join()).digest("hex").slice(0, 8);
fs.writeFileSync(path.join(ROOT, "sw.js"), `/* Generated by scripts/build.mjs. Offline cache for same-origin files; version changes automatically with content. */
var VERSION="v8-${hash}",CACHE="boombastis-"+VERSION,PRECACHE=${JSON.stringify(pre)};
self.addEventListener("install",function(e){e.waitUntil(caches.open(CACHE).then(function(c){return Promise.all(PRECACHE.map(function(u){return c.add(u).catch(function(){})}))}).then(function(){return self.skipWaiting()}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(n){return n!==CACHE&&n.indexOf("boombastis-")===0}).map(function(n){return caches.delete(n)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){var r=e.request;if(r.method!=="GET")return;var u=new URL(r.url);if(u.origin!==location.origin)return;
e.respondWith(fetch(r).then(function(res){if(res&&res.ok){var cp=res.clone();caches.open(CACHE).then(function(c){c.put(r,cp)})}return res}).catch(function(){return caches.match(r,{ignoreSearch:true}).then(function(m){return m||caches.match("/404.html")})}))});
`);
console.log(`built ${urls.length} pages, sitemap, sw.js (v8-${hash})${exists("assets/vendor/qrcode.min.js") ? ", QR vendored" : ", QR uses cdnjs (see README)"}`);
