# Memasang Aplikasi Android Gateway

## Build APK
Setiap push yang mengubah `sms-gateway/android/**` memicu workflow **Build SMS Gateway APK**
(atau jalankan manual: tab Actions > Build SMS Gateway APK > Run workflow).
Hasilnya: tab **Releases** > `apk-latest` > `sms-gateway-debug.apk` (juga ada di Artifacts).

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
