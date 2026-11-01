-- =====================================================================
-- Template pesan SMS.
--   owner_id NULL  = template umum (dibuat admin, tampil untuk semua pelanggan)
--   owner_id terisi = template pribadi pelanggan
-- Variabel ditulis {nama}, {kode}, dst. dan diisi di menu Kirim.
-- Jalankan SETELAH migrasi multi_tenant. Aman dijalankan ulang.
-- =====================================================================
create table if not exists public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 60),
  body       text not null check (char_length(body) between 1 and 1000),
  category   text not null default 'umum' check (char_length(category) between 1 and 30),
  sort_order int  not null default 100,
  created_at timestamptz not null default now()
);
create index if not exists message_templates_owner_idx on public.message_templates (owner_id);

alter table public.message_templates enable row level security;
revoke all on public.message_templates from anon, authenticated;
grant select, insert, update, delete on public.message_templates to authenticated;

drop policy if exists mt_select on public.message_templates;
create policy mt_select on public.message_templates
  for select to authenticated using (owner_id is null or owner_id = auth.uid());

drop policy if exists mt_insert on public.message_templates;
create policy mt_insert on public.message_templates
  for insert to authenticated
  with check (owner_id = auth.uid() or (owner_id is null and public.is_admin()));

drop policy if exists mt_update on public.message_templates;
create policy mt_update on public.message_templates
  for update to authenticated
  using (owner_id = auth.uid() or (owner_id is null and public.is_admin()))
  with check (owner_id = auth.uid() or (owner_id is null and public.is_admin()));

drop policy if exists mt_delete on public.message_templates;
create policy mt_delete on public.message_templates
  for delete to authenticated
  using (owner_id = auth.uid() or (owner_id is null and public.is_admin()));

-- Batas template pribadi per pelanggan
create or replace function public.message_templates_limit()
returns trigger language plpgsql as $$
begin
  if new.owner_id is not null
     and (select count(*) from public.message_templates where owner_id = new.owner_id) >= 50 then
    raise exception 'Maksimal 50 template pribadi.';
  end if;
  return new;
end;
$$;
drop trigger if exists message_templates_limit_trg on public.message_templates;
create trigger message_templates_limit_trg before insert on public.message_templates
  for each row execute function public.message_templates_limit();

-- Template umum bawaan (hanya diisi bila belum ada template umum)
insert into public.message_templates (owner_id, title, category, sort_order, body)
select null, v.title, v.category, v.ord, v.body
from (values
  ('Pesanan diterima',    'pesanan',   10, 'Halo {nama}, pesanan {no_pesanan} sudah kami terima dan sedang diproses. Terima kasih sudah memesan di {toko}.'),
  ('Pesanan dikirim',     'pesanan',   20, 'Halo {nama}, pesanan {no_pesanan} sudah dikirim lewat {kurir}. Nomor resi: {resi}. Terima kasih!'),
  ('Pengingat janji',     'pengingat', 30, 'Halo {nama}, mengingatkan jadwal {acara} pada {tanggal} pukul {jam} di {toko}. Balas pesan ini jika perlu mengubah jadwal.'),
  ('Pengingat tagihan',   'tagihan',   40, 'Halo {nama}, tagihan {tagihan} sebesar Rp{jumlah} jatuh tempo pada {tanggal}. Mohon lakukan pembayaran sebelum tanggal tersebut. Terima kasih.'),
  ('Pembayaran diterima', 'tagihan',   50, 'Halo {nama}, pembayaran Rp{jumlah} sudah kami terima. Terima kasih telah membayar di {toko}.'),
  ('Kode verifikasi',     'otp',       60, 'Kode verifikasi {toko} kamu: {kode}. Berlaku {menit} menit. Jangan bagikan kode ini ke siapa pun.'),
  ('Jam buka',            'umum',      70, 'Halo! {toko} buka {jam_buka}. Silakan datang atau balas pesan ini jika ada yang ingin ditanyakan.'),
  ('Ucapan terima kasih', 'umum',      80, 'Halo {nama}, terima kasih sudah berbelanja di {toko}. Kami senang bisa melayani kamu!'),
  ('Info promo',          'promo',     90, 'Halo {nama}, {toko} ada {promo} sampai {tanggal}. Info lengkap: {link}')
) as v(title, category, ord, body)
where not exists (select 1 from public.message_templates where owner_id is null);
