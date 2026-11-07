// Tells Bing, Yandex, Naver, Seznam and Yep (IndexNow protocol) that URLs in sitemap.xml are new or changed.
// Google does NOT use IndexNow: for Google, submit sitemap.xml in Search Console.
//   node scripts/indexnow.mjs --test   -> print what would be sent (no network)
//   node scripts/indexnow.mjs          -> send every URL in sitemap.xml
//   node scripts/indexnow.mjs --new    -> send only URLs whose <lastmod> is today
// Run it AFTER the site is deployed (the key file <32 hex>.txt in the repo root must be reachable online).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const ORIGIN = (process.env.SITE_ORIGIN || config.origin).replace(/\/+$/, "");
const HOST = new URL(ORIGIN).hostname;
const args = process.argv.slice(2);

const keyFile = fs.readdirSync(ROOT).find((f) => /^[a-f0-9]{32}\.txt$/.test(f) && fs.readFileSync(path.join(ROOT, f), "utf8").trim() === f.slice(0, -4));
if (!keyFile) {
  console.error("No IndexNow key file found in the repo root (a file named <32 hex>.txt containing the same 32 hex characters).");
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
const xml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const urls = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:<lastmod>([^<]*)<\/lastmod>)?/g)]
  .filter((m) => !args.includes("--new") || m[2] === today)
  .map((m) => m[1]);
const body = { host: HOST, key: keyFile.slice(0, -4), keyLocation: `${ORIGIN}/${keyFile}`, urlList: urls };

if (args.includes("--test") || !urls.length) {
  console.log(JSON.stringify(body, null, 1));
  if (!urls.length) console.log("No URLs to send.");
  process.exit(0);
}
const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
console.log(`IndexNow: HTTP ${r.status} (200 or 202 = accepted), ${urls.length} URLs`);
if (r.status >= 400) console.log(await r.text());
