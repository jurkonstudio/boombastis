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
insert into public.devices (name, phone_number, user_id)
values ('HP Gateway 1', '082243562960', 'GANTI-DENGAN-UUID-USER-HP');

-- 3) Tes kirim: masukkan satu pesan ke antrean (ganti nomor tujuan)
-- insert into public.outbox (to_number, body)
-- values ('08123456789', 'Tes SMS gateway');

-- 4) Tes balasan otomatis TANPA HP: pura-pura ada SMS masuk
-- insert into public.inbox (from_number, body, device_id)
-- values ('08123456789', 'halo', (select id from public.devices limit 1));
-- select to_number, body, source, status from public.outbox order by created_at desc limit 5;
