# Memasang Aplikasi Android Gateway

## Build APK
Setiap push yang mengubah `sms-gateway/android/**` memicu workflow **Build SMS Gateway APK**
(atau jalankan manual: tab Actions > Build SMS Gateway APK > Run workflow).
Hasilnya: tab **Releases** > `apk-latest` > `sms-gateway-debug.apk` (juga ada di Artifacts).
Nama file masih `...-debug.apk` agar link unduh di situs tidak berubah, tetapi isinya APK **release yang ditandatangani** (signed).

## Pasang di Galaxy A36
1. **Batalkan dulu** pesan tes `pending` di panel (tab Outbox > Batalkan).
2. Unduh APK dari Releases lewat Chrome, izinkan "pasang dari sumber ini".
3. Matikan sementara **Auto Blocker** (Pengaturan > Keamanan dan privasi). Play Protect: pilih "Instal saja".
4. Buka aplikasi, ketuk **Info Aplikasi** > ⋮ > **Izinkan setelan terbatas**.
5. Ketuk **Izinkan SMS, telepon & notifikasi** dan setujui semuanya.
6. Ketuk **Pengecualian baterai** > izinkan; di Samsung masukkan ke "Aplikasi yang tidak pernah tidur".
7. Isi Project URL, anon key, email + password akun HP, pilih SIM, ketuk **Simpan & Mulai**.
8. Panel > Ringkasan harus menampilkan **HP online 1/1**.

Uji sesuai bagian 9 pada HANDOFF-android-app.md.

## Pelanggan: pasang HP dengan kode pairing (APK versi 1.1+)
1. Di panel `/app/` > **Perangkat** > **Tambah perangkat** > salin kode 8 karakter (berlaku 15 menit).
2. Di aplikasi: izinkan SMS dan pengecualian baterai, ketik kode di **Pasangkan HP ini**, ketuk **Pasangkan & Mulai**.
3. Panel > Perangkat: HP tampil online. Tidak perlu mengisi URL, anon key, email, atau password.
4. Syarat: *Anonymous sign-ins* aktif di Supabase. URL dan anon key dibaca saat build dari `config.js` di root repo.
5. Sesi habis atau HP diganti: buat kode baru lewat **Kode baru** di panel, lalu pasangkan lagi.
Mode email + password lama tetap ada (tombol "Mode email & password (lama)"), dipakai HP admin yang sudah terpasang.

## Penandatanganan APK (signed release)
Workflow membangun `assembleRelease` dan menandatanganinya dengan keystore yang disimpan di **GitHub Secrets**
(Settings > Secrets and variables > Actions). Empat secret yang wajib ada:

| Secret | Isi |
|---|---|
| `KEYSTORE_BASE64` | file keystore (.jks) yang di-base64 satu baris |
| `KEYSTORE_PASSWORD` | password keystore |
| `KEY_ALIAS` | `boombastis` |
| `KEY_PASSWORD` | password key (sama dengan password keystore) |

Aturan penting:
- **Jangan pernah** menaruh keystore, password, atau nilai secret sebagai file di repo (termasuk folder `settings/`). Repo ini publik dan situsnya ikut menyajikan isinya.
- Simpan cadangan keystore dan passwordnya di tempat aman di luar repo. Jika hilang, update tidak bisa menimpa aplikasi yang sudah terpasang.
- Gunakan keystore yang sama untuk semua rilis berikutnya. Mengganti keystore berarti semua pengguna harus uninstall dulu.

## Pembaruan ke v1.3 (kunci tanda tangan baru)
APK v1.3 memakai kunci baru, jadi dari versi sebelumnya: **uninstall dulu**, pasang v1.3, lalu pasangkan ulang dengan kode pairing.
Pembaruan sesudah v1.3 bisa langsung menimpa tanpa uninstall.

## Play Protect dan Android terbaru
- Peringatan Play Protect: ketuk **Detail lainnya** > **Tetap instal**.
- Android 13+: izin SMS aplikasi di luar Play Store butuh **Izinkan setelan terbatas** (Info aplikasi > titik tiga).
- Sejak 30 September 2026 di Indonesia, Google mewajibkan app terdaftar pada developer terverifikasi. App tidak terdaftar tetap bisa dipasang lewat ADB atau "advanced flow".
  Opsional: daftarkan developer dan package `id.jurkon.smsgateway` di Android Developer Console.
