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
insert into public.devices (name, phone_number, user_id)
values ('HP Gateway 1', null, 'GANTI-DENGAN-UUID-USER-HP');

-- 3) Tes: masukkan satu pesan ke antrean (ganti nomor tujuan)
-- insert into public.outbox (to_number, body)
-- values ('08123456789', 'Tes SMS gateway');
