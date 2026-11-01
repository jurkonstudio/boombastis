-- =====================================================================
-- Tambahan template umum (opsional). Jalankan SETELAH 20261101050000_templates.sql.
-- Aman dijalankan ulang: template dengan judul yang sama tidak ditambah dua kali.
-- Template umum juga bisa dikelola dari panel: Lainnya > Admin > Template.
-- =====================================================================
insert into public.message_templates (owner_id, title, category, sort_order, body)
select null, v.title, v.category, v.ord, v.body
from (values
  ('Konfirmasi pendaftaran', 'umum',      100, 'Halo {nama}, pendaftaran {acara} di {toko} sudah kami terima. Sampai jumpa pada {tanggal}.'),
  ('Konfirmasi reservasi',   'pengingat', 110, 'Halo {nama}, reservasi {jumlah_orang} orang pada {tanggal} pukul {jam} di {toko} sudah dikonfirmasi.'),
  ('Pesanan siap diambil',   'pesanan',   120, 'Halo {nama}, pesanan {no_pesanan} sudah siap diambil di {toko}. Terima kasih!'),
  ('Servis selesai',         'pesanan',   130, 'Halo {nama}, {barang} kamu sudah selesai diservis dan bisa diambil di {toko}. Biaya: Rp{jumlah}.'),
  ('Tagihan lewat jatuh tempo','tagihan', 140, 'Halo {nama}, tagihan {tagihan} sebesar Rp{jumlah} sudah melewati jatuh tempo {tanggal}. Mohon segera dibayar. Abaikan pesan ini jika sudah membayar.'),
  ('Permintaan maaf keterlambatan','umum',150, 'Halo {nama}, mohon maaf pesanan {no_pesanan} terlambat karena {alasan}. Estimasi sampai {tanggal}. Terima kasih atas pengertiannya.'),
  ('Libur / tutup sementara','umum',      160, 'Halo! {toko} tutup pada {tanggal} dan buka kembali {tanggal_buka}. Terima kasih atas pengertiannya.'),
  ('Survei kepuasan',        'umum',      170, 'Halo {nama}, terima kasih sudah memakai layanan {toko}. Bantu kami dengan mengisi survei singkat di {link}.'),
  ('Ucapan ulang tahun',     'promo',     180, 'Selamat ulang tahun, {nama}! Dari {toko}: {promo} berlaku sampai {tanggal}.')
) as v(title, category, ord, body)
where not exists (
  select 1 from public.message_templates t where t.owner_id is null and t.title = v.title
);
