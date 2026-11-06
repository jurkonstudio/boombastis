# PROJECT_AUDIT.md — Boombastis

Tanggal audit: 2026-11-06. Sumber: `boombastis-main.zip` dan `boombastis-main_1.zip` (versi terbaru, repo GitHub) serta `boombastis-global-2-sample.zip` (sample ChatGPT).

## 1. Ringkasan

Boombastis saat ini adalah **situs statis murni**: HTML + CSS + vanilla JS, tanpa framework, tanpa build step, tanpa `package.json`, tanpa test/CI. Di-host di GitHub Pages (`CNAME` = boombastis.my.id). Sangat ringan (100 file, 1,9 MB, hampir semuanya gambar OG).

Beda zip lama vs terbaru: hanya `README.md` (bagian "mirror/unblocking" dihapus, jadi "Offline use") dan `sw.js` (cache v6 menjadi v7). Tidak ada perubahan fitur.

Tidak ada folder panel admin atau SMS gateway di zip ini; isinya hanya situs tools.

## 2. Stack dan struktur

| Aspek | Temuan |
| --- | --- |
| Framework | Tidak ada (static HTML) |
| Routing | Folder per halaman (`/tool/index.html`), URL bersih, crawlable |
| Styling | 1 file `assets/site.css` (9 KB), CSS variables, dark mode via `prefers-color-scheme` |
| JS | 19 file kecil di `assets/` (total sekitar 40 KB), 1 skrip per tool, tanpa bundler |
| PWA | `sw.js` (precache 48 URL, network-first, fallback cache) + `site.webmanifest` |
| Hosting | GitHub Pages, `.nojekyll` |
| Halaman | 27 HTML: 1 home, 11 tool EN, 3 trust EN, 1 hub ID, 6 tool ID, 3 trust ID, 404 |
| Dependency eksternal | Hanya `cdnjs` (qrcode-generator 1.4.4) di halaman QR; IP/DNS checker memanggil ipify, ipwho.is, Cloudflare DNS, Google DNS |

## 3. Yang sudah baik (pertahankan)

- Semua tool berjalan di browser (kecuali IP/DNS), sesuai klaim privasi.
- 0 link internal rusak; semua halaman ada di `sitemap.xml` dan sebaliknya.
- Canonical, OG dan Twitter card per halaman; gambar OG per tool.
- JSON-LD valid di semua halaman (WebApplication, FAQPage, WebSite, Breadcrumb di halaman ID).
- Konten About + FAQ unik per tool; halaman About, Privacy, Contact dua bahasa.
- Semua JS lolos `node --check`.
- Ikon SVG khusus dan brand asset sendiri.

## 4. Temuan dan risiko

| # | Temuan | Dampak |
| --- | --- | --- |
| 1 | **0 `hreflang`**; EN dan ID tidak saling ditautkan sebagai alternate | SEO internasional lemah |
| 2 | **Nav/footer disalin manual ke 27 file**; menambah tool berarti edit semua halaman (lihat README langkah 2) | Rawan lupa/tidak konsisten, mahal untuk skala global |
| 3 | Halaman utama tidak punya navigasi header; tidak ada skip link | Aksesibilitas dan UX |
| 4 | Dark mode hanya ikut sistem; tidak ada tombol light/dark/system (CSS sudah punya hook `data-theme`) | Fitur yang diminta belum ada |
| 5 | Halaman QR memuat skrip dari cdnjs **tanpa SRI**, dan service worker tidak meng-cache lintas origin, sehingga **QR tidak jalan offline** | Keamanan + bug PWA |
| 6 | Tidak ada test, lint, build, maupun CI | Risiko regresi saat redesign |
| 7 | Judul home duplikat brand: "Boombastis: Free Online Tools \| Boombastis" | Kecil, SEO |
| 8 | `lastmod` sitemap identik semua; tanpa `xhtml:link` alternate | SEO |
| 9 | `innerHTML` dipakai di `image.js`, `pace.js`, `thr.js`, `umur.js` (kemungkinan hanya string statis, perlu diverifikasi satu per satu) | Risiko XSS rendah, perlu dicek |
| 10 | `VERSION` service worker dan daftar `PRECACHE` diubah manual setiap rilis | Cache basi jika lupa |
| 11 | Tool ID dan EN tumpang tindih tapi bukan terjemahan (mis. `kompres-foto` vs `image-compressor`) | Menentukan pasangan hreflang |
| 12 | Tidak ada tool PDF, image studio lanjutan, developer toolkit lebih luas (target Fase 3 sampai 6) | Roadmap |

## 5. Evaluasi sample ChatGPT

Relevan **sebagai referensi desain dan interaksi saja**, bukan sebagai kode yang bisa dipakai langsung.

Layak diadopsi: header sticky dengan pencarian, filter kategori, favorit (localStorage), tombol tema, skip link, menu mobile, layout halaman detail (workspace + panel info), token warna terang/gelap, `prefers-reduced-motion`.

Tidak layak diadopsi apa adanya:
- Routing `#tool/id` berbasis hash: tidak bisa diindeks Google (README sample sendiri mengakuinya).
- Katalog 12 tool tidak cocok dengan 17 tool nyata; hanya 5 fungsional, sisanya (Merge PDF, Compress PDF, Image Converter, Unit Converter, QR, Password) hanya placeholder.
- Memuat Google Fonts (DM Sans, Manrope) = request pihak ketiga, bertentangan dengan klaim privacy-first.
- Ikon berupa karakter Unicode, lebih lemah dari set ikon SVG yang sudah ada.
- Pemilih bahasa palsu; `SearchAction` JSON-LD menunjuk `/?q=` yang tidak ada handlernya.
- Seluruh `<main>` ditimpa lewat `innerHTML` dan `location.reload()`.
- Warna aksen ungu berbeda dari brand saat ini (merah `#ff3b30` ke oranye `#ff9f0a`).
