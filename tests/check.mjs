// Static checks on the built site. Run after build: node tests/check.mjs
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const O = (process.env.SITE_ORIGIN || JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8")).origin).replace(/\/+$/, ""); const errs = [];
const pages = []; (function w(d){for(const e of fs.readdirSync(path.join(ROOT,d),{withFileTypes:true})){const r=d?d+"/"+e.name:e.name;
 if(e.isDirectory()){if(!["src","scripts","tests","data",".git","node_modules","brand","og","assets"].includes(e.name))w(r)} else if(e.name==="index.html"||r==="404.html")pages.push(r)}})("");
const url = (f) => "/" + f.replace(/index\.html$/, "");
const html = Object.fromEntries(pages.map((f) => [url(f), fs.readFileSync(path.join(ROOT, f), "utf8")]));
const titles = new Map(), descs = new Map();
for (const [u, s] of Object.entries(html)) {
  if (u === "/404.html") continue;
  const t = (s.match(/<title>(.*?)<\/title>/s) || [])[1], d = (s.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (!t) errs.push(`${u}: no title`); else if (titles.has(t)) errs.push(`${u}: duplicate title with ${titles.get(t)}`); else titles.set(t, u);
  if (!d) errs.push(`${u}: no description`); else if (descs.has(d)) errs.push(`${u}: duplicate description with ${descs.get(d)}`); else descs.set(d, u);
  if (!s.includes(`<link rel="canonical" href="${O}${u}">`)) errs.push(`${u}: canonical missing/wrong`);
  if ((s.match(/<h1[ >]/g) || []).length !== 1) errs.push(`${u}: needs exactly one h1`);
  if (!s.includes('class="skip"')) errs.push(`${u}: no skip link`);
  for (const m of s.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) { try { JSON.parse(m[1]); } catch (e) { errs.push(`${u}: invalid JSON-LD`); } }
  // internal links and assets
  for (const m of s.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) { const h = m[1];
    const ok = html[h] || fs.existsSync(path.join(ROOT, h)) || (h.endsWith("/") && html[h]); if (!ok) errs.push(`${u}: broken ${h}`); }
  // ids used by page scripts exist in the HTML
  const body = s.replace(/<script[\s\S]*?<\/script>/g, "");
  for (const m of s.matchAll(/<script src="(\/assets\/[^"?]+)/g)) { const js = fs.readFileSync(path.join(ROOT, m[1]), "utf8");
    if (/ui\.js|home\.js|theme|legacy|sw-register|vendor/.test(m[1])) continue;
    for (const x of js.matchAll(/(?:\$|getElementById)\("([\w-]+)"\)/g)) if (!body.includes(`id="${x[1]}"`) && !js.includes(`id="${x[1]}"`) && !js.includes(`.id="${x[1]}"`)) errs.push(`${u}: ${m[1]} uses missing #${x[1]}`); }
}
// hreflang reciprocity
for (const [u, s] of Object.entries(html)) { const l = [...s.matchAll(/hreflang="(\w[\w-]*)" href="([^"]+)"/g)];
  for (const [, lang, href] of l) { if (lang === "x-default") continue; const t = html[href.replace(O, "")]; if (!t || !t.includes(`hreflang="${u === href.replace(O, "") ? lang : lang}" href="${href}"`)) errs.push(`${u}: hreflang ${lang} not reciprocal`); } }
// sitemap == pages
const sm = new Set([...fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(O, "")));
for (const u of Object.keys(html)) if (u !== "/404.html" && !sm.has(u)) errs.push(`sitemap missing ${u}`);
for (const u of sm) if (!html[u]) errs.push(`sitemap has unknown ${u}`);
// every tool in data is linked from home
const tools = JSON.parse(fs.readFileSync(path.join(ROOT, "data/tools.json"), "utf8")).tools;
for (const t of tools) { if (!html[t.slug]) errs.push(`tool page missing ${t.slug}`); if (!html["/"].includes(`data-slug="${t.slug}"`)) errs.push(`home missing card ${t.slug}`); }
// JS syntax
for (const f of fs.readdirSync(path.join(ROOT, "assets")).filter((n) => n.endsWith(".js")).concat(["../sw.js"])) { try { execFileSync("node", ["--check", path.join(ROOT, "assets", f)], { stdio: "pipe" }); } catch (e) { errs.push(`syntax error in ${f}`); } }
console.log(`${Object.keys(html).length} pages, ${tools.length} tools checked: ${errs.length ? errs.length + " problem(s)" : "OK"}`); errs.forEach((e) => console.log(" -", e)); process.exit(errs.length ? 1 : 0);
