# SMS Gateway Mandiri

SMS dikirim lewat HP Android + SIM milikmu sendiri. Supabase jadi antrean dan database, GitHub menyimpan kode dan hosting panel admin.

## Struktur

```
sms-gateway/
├── admin/                       Panel admin (satu file HTML, di-host di GitHub Pages)
│   └── index.html
├── supabase/
│   ├── config.toml              Konfigurasi minimal untuk Supabase CLI
│   ├── migrations/
│   │   ├── 20261101000000_init.sql        Tabel, RLS, fungsi RPC, realtime
│   │   └── 20261101010000_auto_reply.sql  Balasan otomatis untuk SMS masuk
│   └── setup_admin.sql          Daftarkan admin + perangkat (isi UUID dulu)
├── docs/
│   ├── rancangan.md             Arsitektur, alur, tabel, keamanan
│   └── android-contract.md      Kontrak API untuk aplikasi HP gateway
├── scripts/
│   ├── init-git.sh              git init + commit pertama
│   └── db-push.sh               Kirim migrasi ke Supabase lewat CLI
├── .github/workflows/
│   └── deploy-admin.yml         Auto-deploy folder admin/ ke GitHub Pages
└── .gitignore
```

## Mulai cepat di Codespace

```bash
unzip sms-gateway.zip
cd sms-gateway
bash scripts/init-git.sh
```

### 1. Database Supabase

Pilih salah satu:

- **Lewat CLI** (di terminal Codespace):
  ```bash
  bash scripts/db-push.sh
  ```
  Skrip akan meminta *project ref* (kode di URL project: `https://<ref>.supabase.co`) dan password database.
- **Lewat dashboard**: buka Supabase > SQL Editor, lalu jalankan **berurutan** (tempel isi file, Run, baru file berikutnya):
  1. `supabase/migrations/20261101000000_init.sql`
  2. `supabase/migrations/20261101010000_auto_reply.sql`
  3. `supabase/migrations/20261101020000_improvements.sql`
  4. `supabase/migrations/20261101030000_multi_tenant.sql` (multi-akun, langganan, kuota; lihat `docs/multi-akun.md`)

### 2. Akun admin dan akun HP

1. Supabase > Authentication > Users > **Add user** untuk admin (email + password), salin UUID-nya.
2. Tambah satu user lagi untuk HP gateway (mis. `hp1@gateway.local`), salin UUID-nya.
3. Buka `supabase/setup_admin.sql`, ganti UUID, lalu jalankan di SQL Editor.
4. Matikan pendaftaran publik: Authentication > Sign In / Providers > nonaktifkan *Allow new users to sign up*.

### 3. Panel admin di GitHub Pages

1. Buat repo di GitHub, lalu dari Codespace:
   ```bash
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```
   (Kalau Codespace sudah terhubung ke repo, cukup `git push`.)
2. Di repo: Settings > Pages > Source: **GitHub Actions**.
3. Workflow `deploy-admin.yml` jalan otomatis, lalu alamat panel muncul di Settings > Pages.
4. Buka alamat itu di HP, isi **Project URL** dan **anon key** (Supabase > Project Settings > API), lalu login.

> Jangan pernah memakai atau menyimpan `service_role` key di panel atau di repo.

### 4. Balasan otomatis

SMS yang masuk ke nomor SIM di HP gateway dibalas otomatis. Atur di panel admin, tab **Balasan Otomatis**:

- Aktif/nonaktif, jeda per pengirim (bawaan 60 menit), dan batas balasan per hari (bawaan 50).
- Aturan: balas semua pesan, atau hanya yang mengandung / sama persis / diawali kata tertentu. Aturan bawaan: satu balasan umum untuk semua pesan.
- Nama pengirim (mis. "BANK") dan kode singkat diabaikan, begitu juga nomor milik HP gateway sendiri.

Uji tanpa HP: jalankan perintah tes di bagian 4 `supabase/setup_admin.sql`, lalu lihat tab **Outbox** (balasan otomatis diberi label "otomatis").

> Setiap balasan memakai pulsa/bonus SMS dari SIM gateway. Jeda per pengirim dan batas harian mencegah balas-balasan tanpa henti dengan nomor lain yang juga otomatis.

### 5. Aplikasi HP gateway

Belum termasuk di paket ini. Kontrak API-nya ada di `docs/android-contract.md`.

## Catatan

- SMS tetap memakai pulsa/bonus SMS dari SIM di HP gateway. Pakai SIM khusus agar nomor utama aman jika diblokir operator.
- Skrip dan migrasi belum pernah dijalankan ke project Supabase-mu. Kalau ada error, kirim pesan errornya agar bisa diperbaiki.
