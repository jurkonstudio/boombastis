# Boombastis

Free online tools for images, text, passwords, networking and privacy. Most tools run entirely
in the browser, so files and passwords are never uploaded. The IP & DNS checker is the exception:
it calls public APIs (ipify, ipwho.is, Cloudflare DNS and Google DNS).

Live site: https://boombastis.my.id (static HTML, hosted on GitHub Pages).

## Tools

| Tool | Path | Runs |
| --- | --- | --- |
| Image Compressor | `/image-compressor/` | Browser only |
| QR Code Generator | `/qr-code-generator/` | Browser only (QR library from cdnjs) |
| Password Generator | `/password-generator/` | Browser only |
| Word Counter | `/word-counter/` | Browser only |
| IP & DNS Checker | `/ip-dns-checker/` | Browser + public APIs |
| Password Strength Checker | `/password-strength-checker/` | Browser only |
| Hash Generator | `/hash-generator/` | Browser only |
| Browser Info (User Agent) | `/user-agent-checker/` | Browser only |
| JSON Formatter | `/json-formatter/` | Browser only |
| Base64 Encoder / Decoder | `/base64/` | Browser only |
| Text Case Converter | `/case-converter/` | Browser only |

## Project structure

- `index.html` is the home page; each tool lives in `<tool>/index.html`.
- `assets/site.css` holds all styles; each tool has its own script in `assets/`.
- `sitemap.xml`, `robots.txt`, `CNAME`, and `site.webmanifest` handle SEO and hosting.
- Each tool page contains an About section, a visible FAQ, FAQPage structured data and Related tools links.

## Adding a new tool

1. Copy an existing `<tool>/index.html` and its script from `assets/`.
2. Add the tool to the navigation and footer of every page, and to the cards on `index.html`.
3. Add the URL to `sitemap.xml`.
4. Write a unique About section and 5 to 6 FAQ items. Keep the FAQPage JSON-LD identical to the visible FAQ.
5. Bump the `?v=` number of `site.css` when styles change, to avoid stale cache.

## Indonesian tools (`/id/`)

Indonesian-language pages with their own hub at `/id/`, grouped by category. Logic is in `assets/` and is plain JS.

| Tool | Path | Category |
| --- | --- | --- |
| Terbilang (angka ke huruf) | `/id/terbilang/` | Keuangan |
| Kalkulator THR (Permenaker 6/2016) | `/id/kalkulator-thr/` | Keuangan |
| Kalkulator Pace Lari | `/id/pace-lari/` | Olahraga |
| Hitung Umur dan Selisih Tanggal (plus weton) | `/id/hitung-umur/` | Tanggal & Waktu |
| Kompres Foto ke Ukuran KB | `/id/kompres-foto/` | Gambar |
| Konverter JSON ke CSV / CSV ke JSON | `/id/json-csv/` | Developer & Data |

The English home page is now grouped into categories and links to the Indonesian section.

## Keeping the site reachable

- **Offline / PWA:** `sw.js` caches every page after the first visit, so returning visitors can still
  open the tools if the domain is blocked. Bump `VERSION` in `sw.js` and add new tool URLs to `PRECACHE` on every release.
- **Mirrors:** all assets use root-relative paths and the site is plain static files, so the same repo
  can be deployed unchanged to Cloudflare Pages, Netlify, GitLab Pages or a second GitHub Pages repo
  on another domain. Update `canonical`/`og:url`/`sitemap.xml` per domain.
- **Self-host / download:** the zip of this repo works from any static web server (`python3 -m http.server`).
- **Unblocking:** these are harmless client-side utilities, so ask for review. Komdigi allows normalisation requests
  through its content complaint channel (aduankonten.id) and ISPs can be asked to lift a mistaken block.
  Check the block first with the IP & DNS checker or `nslookup boombastis.my.id 1.1.1.1`: a DNS block
  (Internet Positif) is different from an IP block.

## Patch notes

### v1.4 (2026-11-06) - Indonesian tools batch 1
- Added six Indonesian tools under `/id/` plus an `/id/` hub; home page grouped by category.
- Each page has About, FAQ, FAQPage, WebApplication and BreadcrumbList structured data.
- Service worker cache is now `v4`; `site.css` is `?v=4`.

### v1.3 (2026-11-06) - More tools and offline mode
- Added JSON Formatter, Base64 Encoder / Decoder and Text Case Converter.
- Added service worker (`sw.js`) for offline use; nav, footer, home cards and sitemap updated; `site.css` is now `?v=3`.


### v1.2 (2026-11-06) - SEO content
- Rewrote the About section on all 8 tool pages (about 300 to 400 words each).
- Added 5 to 6 unique FAQ items per tool, with FAQPage structured data.
- Added "Related tools" internal links to every tool page.
- Added styles for FAQ and Related tools; bumped `site.css` to `?v=2`.
- Adjusted privacy wording: files and passwords never leave the browser (the IP & DNS checker uses public APIs).

### v1.1 (2026-11-06) - Network and privacy tools
- Added IP & DNS Checker (public IP, country, ISP, DNS records via DNS over HTTPS).
- Added Password Strength Checker, Hash Generator (MD5, SHA-1, SHA-256, SHA-384, SHA-512, text or file) and Browser Info.
- Updated navigation, footer, home page cards and sitemap.

### v1.0 - Initial release
- Image Compressor, QR Code Generator, Password Generator and Word Counter.
- Brand assets, favicon set, web manifest, sitemap and robots.txt.

## License

Brand assets are covered by `LICENSE-ASSETS.md`.
