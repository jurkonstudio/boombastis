-- =====================================================================
-- Setup awal: daftarkan admin dan HP gateway
-- Jalankan di Supabase > SQL Editor SETELAH migrasi, dan setelah
-- membuat dua user di Authentication > Users.
--
-- Ganti dua UUID di bawah (salin dari kolom "User UID").
-- =====================================================================

-- 1) Admin panel
insert into public.admins (user_id)
values ('GANTI-DENGAN-UUID-USER-ADMIN')
on conflict do nothing;

-- 2) HP gateway (boleh juga ditambah lewat tab "Perangkat" di panel)
--    phone_number = nomor SIM di HP gateway (otomatis disimpan sebagai +62...).
--    Nomor ini dipakai agar sistem tidak membalas SMS dari nomornya sendiri.
-- owner_id = UUID admin (akun admin memiliki perangkatnya sendiri)
insert into public.devices (name, phone_number, user_id, owner_id)
values ('HP Gateway 1', '08xxxxxxxxxx', 'GANTI-DENGAN-UUID-USER-HP', 'GANTI-DENGAN-UUID-USER-ADMIN');

-- 3) Tes kirim: masukkan satu pesan ke antrean (ganti nomor tujuan)
-- insert into public.outbox (to_number, body, owner_id)
-- values ('08123456789', 'Tes SMS gateway', 'GANTI-DENGAN-UUID-USER-ADMIN');

-- 4) Tes balasan otomatis TANPA HP: pura-pura ada SMS masuk
-- insert into public.inbox (from_number, body, device_id, owner_id)
-- select '08123456789', 'halo', id, owner_id from public.devices limit 1;
-- select to_number, body, source, status from public.outbox order by created_at desc limit 5;

-- 5) Atur paket, rekening, dan link APK (tampil di landing page)
-- update public.plans set price_idr = 35000 where name = 'Starter';
-- update public.site_settings set value = 'Transfer ke BCA 123456 a.n. ...' where key = 'payment_instructions';
-- update public.site_settings set value = 'https://github.com/USER/REPO/releases/download/apk-latest/sms-gateway-debug.apk' where key = 'apk_url';
-- update public.site_settings set value = '1.0.0' where key = 'apk_version';
-- update public.site_settings set value = '08xxxxxxxxxx (WhatsApp)' where key = 'support_contact';

-- 6) Beri paket manual ke pelanggan (promo / percobaan), tanpa pembayaran:
--    (jalankan sebagai admin dari panel, atau langsung:)
-- select public.activate_subscription('UUID-PELANGGAN', (select id from public.plans where name = 'Starter'));
