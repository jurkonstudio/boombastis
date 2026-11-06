# TECHNICAL_ARCHITECTURE.md — Boombastis

## Arsitektur saat ini

```
/                      home (index.html)
/<tool>/index.html     11 tool EN, 1 skrip per tool di /assets/
/id/                   hub + 6 tool ID
/about /privacy /contact  (+ /id/tentang /id/privasi /id/kontak)
/assets/site.css       satu stylesheet untuk semua halaman
/sw.js + site.webmanifest  PWA
```

Tiap halaman adalah file HTML lengkap yang berisi salinan header/nav, footer, JSON-LD, meta, dan konten About/FAQ. Tidak ada templating.

## Keputusan: tetap static, jangan ganti framework

Alasan teknis:
- 17 tool sudah berjalan, total JS sekitar 40 KB. Framework (Next/Astro/React) menambah build, dependency, dan risiko regresi tanpa manfaat langsung.
- GitHub Pages dan URL bersih sudah mendukung SEO.
- Aturan proyek: jangan ganti framework tanpa alasan kuat.

Kelemahan nyata yang harus diselesaikan: **duplikasi HTML** (nav/footer/hreflang/sitemap diedit manual di 27 file).

## Arsitektur target (usulan)

Tetap static, ditambah **generator halaman tanpa dependency** (satu skrip Node):

```
data/tools.json        katalog: id, slug, kategori, ikon, judul/desc per bahasa, js, related
templates/             layout.html, home.html, tool.html (header, footer, skip link, tema)
content/<lang>/<slug>.html   isi khas tiap tool (form + About + FAQ), diambil dari halaman sekarang
scripts/build.mjs      menghasilkan HTML final ke root, sitemap.xml (+ xhtml:link), SW precache list
tests/                 link checker, JSON-LD validator, smoke test tiap tool
```

URL tidak berubah. JS tiap tool tidak diubah. Hasil build tetap file statis yang di-commit atau dideploy lewat GitHub Actions.

Komponen frontend baru:
- `assets/site.css`: token warna light/dark, header, kartu, layout detail tool. Font sistem atau self-host (tanpa Google Fonts).
- `assets/app.js` (modul kecil): tombol tema (light/dark/system, disimpan di localStorage dengan try/catch), pencarian + filter kategori + favorit di home. Kartu tool **dirender di HTML** (bisa diindeks), JS hanya menyaring.
- Pencarian: halaman home membaca `?q=` supaya `SearchAction` JSON-LD benar-benar berfungsi.

## SEO internasional

- `hreflang` hanya untuk pasangan yang benar-benar terjemahan: `/` ↔ `/id/`, About ↔ Tentang, Privacy ↔ Privasi, Contact ↔ Kontak, plus `x-default`.
- Tool ID yang bukan terjemahan tool EN **tidak** diberi hreflang (menghindari sinyal salah).
- Bahasa baru: struktur `/<lang>/<slug>/`, kunci terjemahan di `data/tools.json`, tiap bahasa punya canonical dan sitemap sendiri.

## Keamanan dan privasi

- Hapus ketergantungan cdnjs untuk QR dengan menyertakan library di `/assets/vendor/` (ter-cache SW, jalan offline), atau minimal SRI.
- CSP lewat `<meta http-equiv>` (GitHub Pages tidak bisa set header): `default-src 'self'`; `connect-src` hanya untuk API IP/DNS.
- Audit `innerHTML` di 4 file JS.
- Tidak ada analytics sebelum ada keputusan dan halaman consent (Fase 8).

## Pengujian

Build menjalankan: link checker internal, validasi JSON-LD, cek hreflang resiprokal, `node --check` semua JS, smoke test tiap tool (Playwright, bisa di CI), dan Lighthouse untuk home dan 2 halaman tool.
