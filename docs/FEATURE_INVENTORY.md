# FEATURE_INVENTORY.md — Boombastis

Daftar fitur yang ada di repo (versi terbaru). Semua wajib dipertahankan saat redesign.

## Tool bahasa Inggris (11)

| Tool | URL | JS | Berjalan di | Catatan |
| --- | --- | --- | --- | --- |
| Image Compressor | `/image-compressor/` | `image.js` | Browser | JPG/PNG/WebP, hasil -boom |
| QR Code Generator | `/qr-code-generator/` | `qr.js` | Browser | Library cdnjs, tanpa SRI, tidak ter-cache SW |
| Password Generator | `/password-generator/` | `password.js` | Browser | |
| Word Counter | `/word-counter/` | `words.js` | Browser | |
| IP & DNS Checker | `/ip-dns-checker/` | `ipdns.js` | Browser + API publik | ipify, ipwho.is, Cloudflare DoH, Google DoH |
| Password Strength Checker | `/password-strength-checker/` | `strength.js` | Browser | |
| Hash Generator | `/hash-generator/` | `hash.js` | Browser | MD5 (implementasi sendiri), SHA-1/256/384/512, teks atau file |
| Browser Info (User Agent) | `/user-agent-checker/` | `ua.js` | Browser | |
| JSON Formatter | `/json-formatter/` | `json.js` | Browser | |
| Base64 Encoder / Decoder | `/base64/` | `b64.js` | Browser | |
| Text Case Converter | `/case-converter/` | `case.js` | Browser | |

## Tool bahasa Indonesia (6)

| Tool | URL | JS | Kategori |
| --- | --- | --- | --- |
| Terbilang | `/id/terbilang/` | `terbilang.js` | Keuangan |
| Kalkulator THR | `/id/kalkulator-thr/` | `thr.js` | Keuangan |
| Kalkulator Pace Lari | `/id/pace-lari/` | `pace.js` | Olahraga |
| Hitung Umur dan Selisih Tanggal | `/id/hitung-umur/` | `umur.js` | Tanggal dan Waktu |
| Kompres Foto ke Ukuran KB | `/id/kompres-foto/` | `foto.js` | Gambar |
| JSON ke CSV / CSV ke JSON | `/id/json-csv/` | `jsoncsv.js` | Developer dan Data |

## Halaman pendukung

About, Privacy, Contact (EN) dan Tentang, Privasi, Kontak (ID); hub `/id/`; `404.html`.

## Infrastruktur

- PWA: `site.webmanifest`, ikon 192/512/maskable, `sw.js` v7 (offline setelah kunjungan pertama).
- SEO: canonical, OG/Twitter per halaman, `sitemap.xml` (27 URL), `robots.txt`, JSON-LD.
- Redirect hash lama di home (`#image`, `#qr`, `#password`, `#words`) ke URL tool baru. **Jangan dihapus.**
- Brand: logo, ikon duotone 17 tool (`brand/icons/`), gambar OG per tool (`og/`).

## Fitur yang diminta tapi belum ada

Tombol tema light/dark/system, pencarian dan filter kategori di home, favorit, hreflang, i18n penuh, tool PDF, image studio lanjutan, developer toolkit lebih luas, tool produktivitas, workspace pribadi, analytics.
