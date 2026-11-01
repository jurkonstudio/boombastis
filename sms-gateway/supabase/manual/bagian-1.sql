-- =====================================================================
-- Multi-akun (SaaS): tiap pelanggan punya data sendiri
-- Jalankan SETELAH 20261101000000_init.sql, ..._auto_reply.sql, ..._improvements.sql
--
-- Isi:
--   1. Tabel baru: profiles, plans, subscriptions, payments, site_settings
--   2. Kolom owner_id di devices/outbox/inbox/auto_reply_* + isi data lama
--   3. RLS baru: pelanggan hanya melihat datanya sendiri
--   4. Kuota & masa aktif (dicek di database, bukan di panel)
--   5. Fungsi RPC: akun, pesanan, perangkat + pairing, admin
--   6. Fungsi HP gateway (claim/receive/auto-reply) dibatasi per pemilik
--
-- Keputusan desain:
--   * Admin (tabel admins) TIDAK bisa membaca isi SMS pelanggan. Admin
--     hanya melihat ringkasan lewat admin_overview(). Isi SMS bisa memuat
--     OTP / data pribadi pelanggan.
--   * Admin tidak dikenai kuota/langganan (dianggap pemilik layanan).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABEL BARU
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  email             text,
  full_name         text,
  phone             text,
  is_suspended      boolean not null default false,
  terms_accepted_at timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists public.plans (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  price_idr      int  not null check (price_idr >= 0),
  sms_quota      int  not null check (sms_quota > 0),
  duration_days  int  not null check (duration_days > 0),
  max_devices    int  not null default 1 check (max_devices >= 1),
  daily_limit    int  not null default 200 check (daily_limit >= 1),
  is_active      boolean not null default true,
  sort_order     int  not null default 100,
  created_at     timestamptz not null default now()
);

-- Satu baris per pelanggan. Diisi HANYA lewat fungsi (activate_subscription).
--   sms_quota : total SMS yang boleh dikirim pada masa aktif ini
--   sms_used  : SMS yang sudah dipakai (antre + terkirim; gagal/batal dikembalikan)
create table if not exists public.subscriptions (
  owner_id     uuid primary key references auth.users(id) on delete cascade,
  plan_id      uuid references public.plans(id) on delete set null,
  plan_name    text not null,
  sms_quota    int  not null,
  sms_used     int  not null default 0,
  max_devices  int  not null default 1,
  daily_limit  int  not null default 200,
  started_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  updated_at   timestamptz not null default now()
);

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  plan_id         uuid references public.plans(id) on delete set null,
  plan_name       text not null,
  base_price_idr  int  not null,
  unique_code     int  not null default 0,
  amount_idr      int  not null,
  status          text not null default 'pending' check (status in ('pending','paid','rejected')),
  note            text,
  created_at      timestamptz not null default now(),
  paid_at         timestamptz,
  confirmed_by    uuid
);

create index if not exists payments_owner_idx   on public.payments (owner_id, created_at desc);
create index if not exists payments_pending_idx on public.payments (status, amount_idr) where status = 'pending';

-- Pengaturan publik (dibaca landing page tanpa login).
-- JANGAN simpan rahasia di sini.
create table if not exists public.site_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);

-- Data awal (hanya jika kosong). Harga di bawah hanya CONTOH, ubah sesukamu:
--   update public.plans set price_idr = 35000 where name = 'Starter';
insert into public.plans (name, description, price_idr, sms_quota, duration_days, max_devices, daily_limit, sort_order)
select * from (values
  ('Starter', '1 HP gateway, cocok untuk usaha kecil',        29000,  500, 30, 1,  100, 10),
  ('Bisnis',  '2 HP gateway, kuota lebih besar',              79000, 2000, 30, 2,  400, 20),
  ('Pro',     '5 HP gateway untuk volume tinggi',            149000, 5000, 30, 5, 1000, 30)
) as v(name, description, price_idr, sms_quota, duration_days, max_devices, daily_limit, sort_order)
where not exists (select 1 from public.plans);

insert into public.site_settings (key, value) values
  ('payment_instructions', 'Transfer sesuai nominal PERSIS (termasuk 3 digit kode unik) ke rekening: ISI-REKENING-DI-SINI. Lalu hubungi admin untuk konfirmasi.'),
  ('apk_url',              ''),
  ('apk_version',          ''),
  ('support_contact',      '')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. KOLOM owner_id + ISI DATA LAMA
-- ---------------------------------------------------------------------
alter table public.devices             add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.outbox              add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.inbox               add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.auto_reply_rules    add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.auto_reply_settings add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- kode pairing untuk memasangkan HP tanpa email/password
alter table public.devices add column if not exists pair_code        text;
alter table public.devices add column if not exists pair_expires_at  timestamptz;
create unique index if not exists devices_pair_code_idx on public.devices (pair_code) where pair_code is not null;

-- data lama (satu pemilik) diberikan ke admin pertama
do $$
declare
  first_admin uuid;
begin
  select user_id into first_admin from public.admins order by created_at limit 1;
  if first_admin is null then
    raise notice 'Belum ada admin: data lama (jika ada) belum diberi pemilik. Isi tabel admins lalu jalankan ulang file ini.';
    return;
  end if;
  update public.devices             set owner_id = first_admin where owner_id is null;
  update public.outbox              set owner_id = first_admin where owner_id is null;
  update public.inbox               set owner_id = first_admin where owner_id is null;
  update public.auto_reply_rules    set owner_id = first_admin where owner_id is null;
  update public.auto_reply_settings set owner_id = first_admin where owner_id is null;
end $$;

-- pengaturan balasan otomatis: dari "satu baris global" menjadi "satu baris per pemilik"
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'auto_reply_settings' and column_name = 'id') then
    delete from public.auto_reply_settings where owner_id is null;
    alter table public.auto_reply_settings drop column id;  -- ikut menghapus PK dan check (id = 1)
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.auto_reply_settings'::regclass and contype = 'p') then
    alter table public.auto_reply_settings add primary key (owner_id);
  end if;
end $$;

-- pelanggan baru: balasan otomatis MATI secara bawaan (hemat kuota)
alter table public.auto_reply_settings alter column enabled set default false;

-- owner_id terisi otomatis dari user yang login (aman: RLS tetap memeriksa)
alter table public.devices             alter column owner_id set default auth.uid();
alter table public.outbox              alter column owner_id set default auth.uid();
alter table public.auto_reply_rules    alter column owner_id set default auth.uid();
alter table public.auto_reply_settings alter column owner_id set default auth.uid();

-- jadikan NOT NULL bila tidak ada baris yatim
do $$
declare
  t text;
begin
  foreach t in array array['devices','outbox','inbox','auto_reply_rules','auto_reply_settings'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = t
                      and column_name = 'owner_id' and is_nullable = 'NO') then
      begin
        execute format('alter table public.%I alter column owner_id set not null', t);
      exception when not_null_violation then
        raise notice 'Tabel % punya baris tanpa owner_id; kolom dibiarkan nullable.', t;
      end;
    end if;
  end loop;
end $$;

create index if not exists devices_owner_idx      on public.devices (owner_id);
create index if not exists outbox_owner_idx       on public.outbox (owner_id, created_at desc);
create index if not exists inbox_owner_idx        on public.inbox (owner_id, received_at desc);
create index if not exists auto_rules_owner_idx   on public.auto_reply_rules (owner_id, is_active, priority);

-- ---------------------------------------------------------------------
-- 3. HELPER
-- ---------------------------------------------------------------------
create or replace function public.owner_is_admin(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = p_owner);
$$;

-- Boleh mengirim? (admin selalu; pelanggan: tidak ditangguhkan + langganan aktif)
create or replace function public.owner_can_send(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.owner_is_admin(p_owner)
      or (
           not coalesce((select p.is_suspended from public.profiles p where p.user_id = p_owner), true)
           and exists (select 1 from public.subscriptions s where s.owner_id = p_owner and s.expires_at > now())
         );
$$;

-- Pesan yang masuk hitungan kuota: pending, sending, sent.
-- Mengembalikan NULL bila boleh (dan kuota sudah dipesan), atau teks alasan penolakan.
create or replace function public.reserve_sms(p_owner uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  sub       public.subscriptions;
  day_start timestamptz;
  n         int;
begin
  if p_owner is null then
    return 'Pemilik pesan tidak diketahui.';
  end if;
  if public.owner_is_admin(p_owner) then
    return null;
  end if;
  if coalesce((select p.is_suspended from public.profiles p where p.user_id = p_owner), true) then
    return 'Akun ditangguhkan. Hubungi admin.';
  end if;

  select * into sub from public.subscriptions where owner_id = p_owner;
  if sub.owner_id is null then
    return 'Belum ada langganan aktif. Silakan beli paket dulu.';
  end if;
  if sub.expires_at <= now() then
    return 'Langganan sudah berakhir. Silakan perpanjang.';
  end if;

  day_start := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  select count(*) into n
    from public.outbox o
   where o.owner_id = p_owner
     and o.created_at >= day_start
     and o.status in ('pending', 'sending', 'sent');
  if n >= sub.daily_limit then
    return 'Batas kirim harian tercapai (' || sub.daily_limit || ' SMS). Coba lagi besok.';
  end if;

  update public.subscriptions
     set sms_used = sms_used + 1, updated_at = now()
   where owner_id = p_owner and sms_used < sms_quota;
  if not found then
    return 'Kuota SMS habis. Silakan tambah paket.';
  end if;

  return null;
end;
$$;

create or replace function public.release_sms(p_owner uuid)
returns void
language sql security definer
set search_path = public
as $$
  update public.subscriptions
     set sms_used = greatest(sms_used - 1, 0), updated_at = now()
   where owner_id = p_owner;
$$;

revoke all on function public.owner_is_admin(uuid) from public, anon, authenticated;
revoke all on function public.owner_can_send(uuid) from public, anon, authenticated;
revoke all on function public.reserve_sms(uuid)    from public, anon, authenticated;
revoke all on function public.release_sms(uuid)    from public, anon, authenticated;

