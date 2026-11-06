# DEVELOPMENT_ROADMAP.md — Boombastis Global 2.0

Satu fase dalam satu waktu. Setiap fase dikerjakan di branch terpisah dan diuji di URL preview sebelum menyentuh production.

## Fase 0 — Audit (selesai)
Hasil: PROJECT_AUDIT.md, FEATURE_INVENTORY.md, TECHNICAL_ARCHITECTURE.md, dokumen ini.

## Fase 1 — Global UI/UX redesign (diusulkan, menunggu persetujuan)

Sub-langkah:
1. **Fondasi:** branch `redesign`, URL preview (GitHub Pages/Cloudflare Pages terpisah). Production tidak disentuh.
2. **Generator halaman:** `data/tools.json`, template, `scripts/build.mjs`. Keluaran pertama harus **identik secara fungsi** dengan halaman sekarang (uji diff).
3. **Design system:** token light/dark/system, tombol tema, header sticky + menu mobile, skip link, `prefers-reduced-motion`, fokus keyboard.
4. **Home:** hero, pencarian, chip kategori, favorit, kartu 17 tool nyata dengan ikon SVG yang sudah ada.
5. **Halaman tool:** layout workspace + panel info; JS tool lama tidak diubah; About, FAQ, Related dipertahankan.
6. **SEO dasar:** judul unik (perbaiki home), hreflang untuk pasangan sah, sitemap dengan alternate, handler `?q=`.
7. **Perbaikan sisa audit:** QR offline (library lokal), CSP meta, audit `innerHTML`.
8. **Uji:** link checker, JSON-LD, smoke test semua tool, Lighthouse, cek layar 360, 768, 1280 px.

Risiko: regresi tool lama (mitigasi: JS tidak diubah + smoke test), cache SW basi (mitigasi: versi otomatis dari build), perubahan warna brand (butuh keputusan).

## Fase 2 — Internationalization
Kamus terjemahan di `data/`, routing `/<lang>/`, pemilih bahasa nyata, hreflang resiprokal, metadata lokal. Mulai dengan EN + ID, lalu 2 sampai 3 bahasa prioritas.

## Fase 3 — PDF Tools Center
Merge, split, rotate, kompres, gambar ke PDF dan sebaliknya. Pilih library lokal (mis. pdf-lib, pdf.js) yang dibundel sendiri, tanpa upload.

## Fase 4 — Advanced Image Studio
Konverter format, resize, crop, hapus metadata, kompres batch. Pakai Canvas/OffscreenCanvas; gabungkan dengan tool yang ada.

## Fase 5 — Developer Toolkit
URL encoder, JWT decoder, regex tester, diff, timestamp, UUID, minifier, dan lain-lain.

## Fase 6 — Productivity & Global Tools
Konverter unit, mata uang (butuh API: harus disetujui), zona waktu, kalkulator, pomodoro.

## Fase 7 — Personal Workspace & PWA
Favorit dan riwayat lokal (localStorage/IndexedDB), install prompt, offline penuh termasuk library vendor.

## Fase 8 — SEO, Analytics, Monetization
Analytics yang menghormati privasi + consent, structured data per jenis halaman, strategi iklan/premium/API (butuh persetujuan karena berbayar).

## Aturan lintas fase
- Jangan klaim sebuah tool "berjalan lokal" sebelum diverifikasi.
- Tidak ada tool placeholder di production; yang belum jadi tidak ditampilkan.
- Tidak ada layanan berbayar atau API pihak ketiga tanpa persetujuan.
