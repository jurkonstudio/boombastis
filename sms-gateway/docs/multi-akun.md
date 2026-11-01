# Multi-Akun (layanan berbayar)

Migrasi: `supabase/migrations/20261101030000_multi_tenant.sql`.

## Model

- Setiap pelanggan = satu akun Supabase Auth + satu baris `profiles`.
- Semua data punya `owner_id`: `devices`, `outbox`, `inbox`, `auto_reply_rules`, `auto_reply_settings`. RLS: pelanggan hanya melihat baris miliknya.
- **Admin (tabel `admins`) tidak bisa membaca isi SMS pelanggan.** Admin hanya melihat ringkasan lewat `admin_overview()`. Admin sendiri tidak dikenai kuota.
- HP gateway tidak punya akses tabel; hanya fungsi RPC, dan hanya untuk data pemilik perangkatnya.
- Data lama otomatis menjadi milik admin pertama di tabel `admins`.

## Langganan dan kuota

| Tabel | Isi |
|---|---|
| `plans` | Paket: harga, kuota SMS, masa aktif (hari), maks. perangkat, batas harian |
| `subscriptions` | Satu baris per pelanggan: kuota, terpakai, kedaluwarsa |
| `payments` | Pesanan: `pending` → `paid` / `rejected`; nominal diberi kode unik 1–999 |
| `site_settings` | Teks publik: instruksi bayar, `apk_url`, `apk_version`, kontak |

Aturan (dicek di database, tidak bisa dilewati dari panel):

- Kirim SMS ditolak bila: akun ditangguhkan, tidak ada langganan, langganan berakhir, kuota habis, atau batas harian tercapai.
- Kuota dipesan saat pesan masuk antrean. Pesan **gagal/batal mengembalikan kuota**; kirim ulang memesan lagi.
- Balasan otomatis yang kuotanya tidak cukup dilewati diam-diam (SMS masuk tetap tersimpan).
- Langganan berakhir: HP berhenti mengirim, pesan tetap antre sampai diperpanjang.
- Perpanjang saat masih aktif: masa aktif dan kuota **ditambah**. Perpanjang setelah berakhir: mulai baru, pemakaian di-reset.
- Balasan otomatis pelanggan baru **mati** secara bawaan.

## Alur pembayaran (manual)

1. Pelanggan: `rpc('create_order', { p_plan_id })` → dapat `amount_idr` (harga + kode unik).
2. Pelanggan transfer sesuai nominal persis (instruksi ada di `site_settings.payment_instructions`).
3. Admin mencocokkan mutasi rekening, lalu `rpc('admin_confirm_payment', { p_id })` → langganan aktif.
   Ditolak: `admin_reject_payment(p_id, p_note)`.
4. Pembayaran otomatis (Tripay/Midtrans/Xendit): Edge Function memanggil `activate_subscription(owner, plan)` dengan `service_role` setelah webhook valid. Fungsi itu tidak bisa dipanggil dari panel.

## Fungsi RPC

Pelanggan (login): `my_account()`, `create_order(p_plan_id)`, `create_device(p_name, p_phone)`, `new_pair_code(p_device_id)`, `cleanup_old_inbox(days)`.

Admin: `admin_overview()`, `admin_confirm_payment(id)`, `admin_reject_payment(id, note)`, `admin_grant_plan(user, plan)`, `admin_set_suspended(user, bool)`.

HP gateway: `claim_device(code)`, lalu `claim_outbox`, `report_outbox`, `receive_sms`, `device_heartbeat` (tidak berubah bagi aplikasi).

## Memasangkan HP (untuk APK baru)

Pelanggan tidak perlu mengisi URL, anon key, email, atau password di HP.

1. Panel: pelanggan klik **Tambah perangkat** → `create_device` → kode 8 karakter (berlaku 15 menit).
2. Aplikasi HP: pelanggan memasukkan kode. Aplikasi memakai Project URL + anon key yang sudah tertanam di APK.
3. Aplikasi login anonim: `POST /auth/v1/signup` dengan body `{}` (perlu **Anonymous sign-ins** aktif), simpan `access_token` dan `refresh_token`.
4. Aplikasi memanggil `rpc('claim_device', { p_code })`. Setelah sukses, HP terhubung ke perangkat itu dan alur lama (`claim_outbox` dst.) berjalan seperti biasa.
5. Kode kedaluwarsa atau HP diganti: `new_pair_code(p_device_id)`.

Akun HP model lama (email + password, `devices.user_id` diisi manual) tetap berfungsi.

## Pengaturan Supabase setelah migrasi

1. Authentication → Sign In / Providers: **aktifkan** *Allow new users to sign up* (sebelumnya dimatikan).
2. Aktifkan **Allow anonymous sign-ins** (untuk pairing HP).
3. Pertimbangkan **Confirm email** aktif agar pendaftar memakai email asli, dan aktifkan CAPTCHA (Authentication → Attack Protection) untuk mencegah pendaftaran massal.
4. Ubah paket/harga/rekening/link APK lewat `setup_admin.sql` bagian 5.

## Yang belum dicakup migrasi ini

- Panel pelanggan dan panel admin baru (panel lama masih jalan untuk akun admin).
- Landing page dengan harga, daftar, dan tombol unduh APK.
- APK baru dengan pairing code.
- Pembayaran otomatis dan syarat layanan.
- Pembersihan otomatis `outbox` lama (saat ini hanya `inbox` yang punya retensi).
- Batas percobaan salah untuk `claim_device` (kode 8 karakter + masa berlaku 15 menit sudah menyulitkan tebak-tebakan).
