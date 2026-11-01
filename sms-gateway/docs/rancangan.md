# Rancangan Sistem

## Arsitektur

```
 Panel Admin (GitHub Pages)          Supabase                    HP Android (gateway)
 ┌───────────────────────┐   insert  ┌──────────────────┐ realtime ┌────────────────────┐
 │ admin/index.html      │──────────▶│ tabel outbox     │─────────▶│ App gateway        │
 │ login, kirim, pantau  │◀──────────│ tabel inbox      │◀─────────│ SmsManager.send()  │
 └───────────────────────┘  realtime │ tabel devices    │   RPC    │ SIM = pengirim     │
                                     │ RLS + fungsi RPC │          └─────────┬──────────┘
 GitHub: kode + hosting Pages        └──────────────────┘                    │ SMS
                                                                             ▼
                                                                       Nomor penerima
```

- **Supabase**: antrean, status, keamanan, realtime.
- **Panel admin**: kirim, jadwal, pantau, kirim ulang.
- **HP Android**: mengirim SMS lewat SIM dan melaporkan hasilnya.
- **GitHub**: menyimpan kode dan meng-host panel (Pages).

## Alur pesan

1. Admin mengisi form → baris baru di `outbox` berstatus `pending`. Nomor otomatis dinormalkan ke `+62…`.
2. HP memanggil `claim_outbox(batch)` → pesan jadi `sending` (atomik, tidak terambil dua kali).
3. HP mengirim SMS dengan `SmsManager`.
4. HP memanggil `report_outbox(id, ok, error)` → `sent`, atau kembali `pending` (maks. 3 percobaan) lalu `failed`.
5. SMS balasan masuk → HP memanggil `receive_sms(from, body)` → tersimpan di `inbox`.
6. Pesan yang macet di `sending` lebih dari 5 menit dipulihkan otomatis.

## Balasan otomatis

1. SMS masuk → HP memanggil `receive_sms` → baris baru di `inbox`.
2. Trigger `inbox_auto_reply` memeriksa pengaturan, pengirim, jeda, dan batas harian.
3. Aturan aktif pertama yang cocok (urut `priority`) dipakai → baris baru di `outbox` dengan `source = 'auto'`, ditujukan ke pengirim lewat HP yang sama.
4. HP mengirimnya seperti SMS biasa (`claim_outbox` → kirim → `report_outbox`).

Pengaman: pengirim bukan nomor valid (nama/kode singkat) diabaikan, nomor perangkat sendiri diabaikan, satu pengirim hanya dibalas sekali per jeda (`cooldown_minutes`), dan ada batas harian (`daily_cap`, hari berganti 00.00 WIB).

## Tabel

| Tabel | Isi | Kolom penting |
|---|---|---|
| `admins` | siapa yang boleh memakai panel | `user_id` |
| `devices` | HP gateway | `name`, `phone_number`, `user_id` (akun Auth HP), `is_active`, `last_seen_at` |
| `outbox` | antrean SMS keluar | `to_number`, `body`, `status`, `attempts`, `error`, `scheduled_at`, `sent_at` |
| `inbox` | SMS masuk | `from_number`, `body`, `received_at` |
| `auto_reply_settings` | pengaturan global (1 baris) | `enabled`, `cooldown_minutes`, `daily_cap` |
| `auto_reply_rules` | aturan balasan | `match_type`, `keyword`, `reply_body`, `priority`, `is_active` |

Tabel `outbox` punya kolom tambahan `source` (`manual`/`auto`) dan `inbox_id`.

Status `outbox`: `pending` → `sending` → `sent` / `failed` / `cancelled`.

## Keamanan

- Panel hanya memakai **anon key**. Jangan pernah menaruh `service_role` di panel atau repo.
- RLS aktif di semua tabel: hanya user di tabel `admins` yang bisa membaca/mengubah data.
- HP gateway tidak punya akses tabel langsung, hanya 4 fungsi RPC, dan hanya untuk akun aktif di `devices`.
- Pendaftaran publik Supabase dimatikan.
- Isi SMS masuk ditampilkan dengan `textContent` (aman dari injeksi HTML).
- Batasi volume kirim agar SIM tidak diblokir operator.

## Tahap berikutnya

- [ ] Aplikasi Android gateway (Kotlin) + GitHub Actions untuk build APK
- [ ] Template pesan dan daftar kontak
- [ ] Edge Function + pg_cron untuk pengingat terjadwal berulang
- [ ] Laporan harian (terkirim/gagal)
