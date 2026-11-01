# Kontrak Aplikasi Android Gateway

Aplikasi login ke Supabase memakai **akun HP** (email + password, bukan akun admin), lalu memanggil fungsi RPC berikut. Semua request membawa header `apikey: <anon key>` dan `Authorization: Bearer <access token>`.

```
POST /rest/v1/rpc/claim_outbox      {"batch": 5}
     → daftar pesan (id, to_number, body, ...) yang sudah ditandai "sending"

POST /rest/v1/rpc/report_outbox     {"p_id": "<uuid>", "p_ok": true, "p_error": null}
     → laporkan hasil kirim (p_ok=false + p_error bila gagal)

POST /rest/v1/rpc/receive_sms       {"p_from": "+62...", "p_body": "..."}
     → simpan SMS masuk ke inbox

POST /rest/v1/rpc/device_heartbeat  {}
     → tandai HP masih online
```

## Rekomendasi implementasi

- Foreground service agar tetap jalan di latar belakang.
- Berlangganan Realtime tabel `outbox` + polling `claim_outbox` tiap 30 detik sebagai cadangan.
- Heartbeat tiap 60 detik (panel menganggap HP online jika terlihat < 2 menit).
- Izin `SEND_SMS` dan `RECEIVE_SMS`; matikan optimasi baterai untuk aplikasi.
- Pesan > 160 karakter dikirim dengan `SmsManager.divideMessage()` + `sendMultipartTextMessage()`.
- Beri jeda 1–3 detik antar SMS agar tidak dianggap spam oleh operator.
