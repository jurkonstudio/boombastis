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

-- ---------------------------------------------------------------------
-- 4. TRIGGER KUOTA PADA OUTBOX
--    Berlaku untuk semua jalur (panel, SQL, balasan otomatis).
--    Pesan manual yang ditolak -> error jelas.
--    Balasan otomatis yang ditolak -> dilewati diam-diam (tidak boleh
--    menggagalkan penyimpanan SMS masuk).
-- ---------------------------------------------------------------------
create or replace function public.trg_outbox_quota_ins()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  err text;
begin
  if new.owner_id is null then
    new.owner_id := coalesce(auth.uid(), (select d.owner_id from public.devices d where d.id = new.device_id));
  end if;
  if new.owner_id is null then
    raise exception 'owner_id wajib diisi';
  end if;

  if new.status in ('pending', 'sending', 'sent') then
    err := public.reserve_sms(new.owner_id);
    if err is not null then
      if new.source = 'auto' then
        return null;
      end if;
      raise exception '%', err;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists outbox_quota_ins on public.outbox;
create trigger outbox_quota_ins
  before insert on public.outbox
  for each row execute function public.trg_outbox_quota_ins();

create or replace function public.trg_outbox_quota_upd()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  was_counted boolean := old.status in ('pending', 'sending', 'sent');
  is_counted  boolean := new.status in ('pending', 'sending', 'sent');
  err text;
begin
  new.owner_id := old.owner_id;   -- pemilik tidak boleh berpindah

  if new.status is distinct from old.status then
    new.updated_at := now();
    if not was_counted and is_counted then
      -- kirim ulang pesan gagal/batal: pesan kuota lagi
      err := public.reserve_sms(old.owner_id);
      if err is not null then
        raise exception '%', err;
      end if;
      if new.status = 'pending' then
        new.attempts := 0;
        new.error := null;
      end if;
    elsif was_counted and not is_counted then
      -- gagal/batal: kuota dikembalikan
      perform public.release_sms(old.owner_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists outbox_quota_upd on public.outbox;
create trigger outbox_quota_upd
  before update on public.outbox
  for each row execute function public.trg_outbox_quota_upd();

-- Batas jumlah aturan balasan per pemilik
create or replace function public.trg_rules_cap()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if (select count(*) from public.auto_reply_rules r where r.owner_id = new.owner_id) >= 50 then
    raise exception 'Maksimal 50 aturan balasan otomatis.';
  end if;
  return new;
end;
$$;

drop trigger if exists auto_rules_cap on public.auto_reply_rules;
create trigger auto_rules_cap
  before insert on public.auto_reply_rules
  for each row execute function public.trg_rules_cap();

-- ---------------------------------------------------------------------
-- 5. PROFIL OTOMATIS SAAT DAFTAR
--    Akun anonim (dipakai HP gateway) tidak dibuatkan profil.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if coalesce((to_jsonb(new) ->> 'is_anonymous')::boolean, false) then
    return new;
  end if;

  insert into public.profiles (user_id, email, full_name, phone, terms_accepted_at)
  values (
    new.id,
    new.email,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100), ''),
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 30), ''),
    case when (new.raw_user_meta_data ->> 'accepted_terms') = 'true' then now() end
  )
  on conflict (user_id) do nothing;

  insert into public.auto_reply_settings (owner_id) values (new.id)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- akun yang sudah ada (selain akun HP gateway lama)
insert into public.profiles (user_id, email)
select u.id, u.email
  from auth.users u
 where not exists (select 1 from public.devices d where d.user_id = u.id)
on conflict (user_id) do nothing;

insert into public.auto_reply_settings (owner_id)
select p.user_id from public.profiles p
on conflict (owner_id) do nothing;

-- cadangan bila trigger di atas tidak terpasang (mis. akun dibuat sebelum migrasi)
create or replace function public.ensure_profile()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  u public.profiles.user_id%type := auth.uid();
  au auth.users;
begin
  if u is null then
    raise exception 'Harus login';
  end if;
  if exists (select 1 from public.profiles where user_id = u) then
    return;
  end if;
  select * into au from auth.users where id = u;
  if au.id is null or coalesce((to_jsonb(au) ->> 'is_anonymous')::boolean, false) then
    return;
  end if;
  insert into public.profiles (user_id, email) values (u, au.email) on conflict (user_id) do nothing;
  insert into public.auto_reply_settings (owner_id) values (u) on conflict (owner_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.plans          enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.payments       enable row level security;
alter table public.site_settings  enable row level security;

-- buang kebijakan lama (khusus admin)
drop policy if exists devices_admin       on public.devices;
drop policy if exists outbox_admin        on public.outbox;
drop policy if exists inbox_admin         on public.inbox;
drop policy if exists auto_settings_admin on public.auto_reply_settings;
drop policy if exists auto_rules_admin    on public.auto_reply_rules;

drop policy if exists devices_select on public.devices;
drop policy if exists devices_insert on public.devices;
drop policy if exists devices_update on public.devices;
drop policy if exists devices_delete on public.devices;
drop policy if exists outbox_select  on public.outbox;
drop policy if exists outbox_insert  on public.outbox;
drop policy if exists outbox_update  on public.outbox;
drop policy if exists inbox_select   on public.inbox;
drop policy if exists inbox_delete   on public.inbox;
drop policy if exists auto_settings_own on public.auto_reply_settings;
drop policy if exists auto_rules_own    on public.auto_reply_rules;
drop policy if exists profiles_select   on public.profiles;
drop policy if exists profiles_update   on public.profiles;
drop policy if exists plans_select      on public.plans;
drop policy if exists plans_admin       on public.plans;
drop policy if exists subs_select       on public.subscriptions;
drop policy if exists payments_select   on public.payments;
drop policy if exists site_select       on public.site_settings;
drop policy if exists site_admin        on public.site_settings;

-- devices: pelanggan hanya melihat/ubah/hapus miliknya. Tambah lewat create_device()
-- (admin boleh insert langsung untuk akun HP model lama).
create policy devices_select on public.devices for select to authenticated using (owner_id = auth.uid());
create policy devices_insert on public.devices for insert to authenticated
  with check (public.is_admin() and owner_id = auth.uid());
create policy devices_update on public.devices for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy devices_delete on public.devices for delete to authenticated using (owner_id = auth.uid());

-- outbox: pelanggan membuat pesan "manual/pending" saja. Status sending/sent/failed
-- hanya bisa diubah oleh HP gateway lewat fungsi RPC.
create policy outbox_select on public.outbox for select to authenticated using (owner_id = auth.uid());
create policy outbox_insert on public.outbox for insert to authenticated
  with check (
    owner_id = auth.uid()
    and status = 'pending'
    and source = 'manual'
    and attempts = 0
    and (device_id is null
         or exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid()))
  );
create policy outbox_update on public.outbox for update to authenticated
  using (owner_id = auth.uid() and status in ('pending', 'failed', 'cancelled'))
  with check (owner_id = auth.uid() and status in ('pending', 'cancelled'));

-- inbox: baca dan hapus miliknya; penyimpanan hanya lewat receive_sms()
create policy inbox_select on public.inbox for select to authenticated using (owner_id = auth.uid());
create policy inbox_delete on public.inbox for delete to authenticated using (owner_id = auth.uid());

-- balasan otomatis
create policy auto_settings_own on public.auto_reply_settings for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy auto_rules_own on public.auto_reply_rules for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (device_id is null
         or exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid()))
  );

-- profil, langganan, pembayaran: baca sendiri (admin boleh baca semua, tanpa isi SMS)
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subs_select on public.subscriptions for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
create policy payments_select on public.payments for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- paket & pengaturan publik: semua orang boleh baca (landing page), hanya admin menulis
create policy plans_select on public.plans for select to anon, authenticated
  using (is_active or public.is_admin());
create policy plans_admin on public.plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy site_select on public.site_settings for select to anon, authenticated using (true);
create policy site_admin on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Hak akses tabel (lapisan kedua di bawah RLS)
revoke all on public.profiles, public.subscriptions, public.payments from anon;
revoke all on public.devices, public.outbox, public.inbox,
              public.auto_reply_rules, public.auto_reply_settings from anon;
revoke all on public.plans, public.site_settings from anon;
grant select on public.plans, public.site_settings to anon;

revoke insert, update, delete on public.subscriptions, public.payments from authenticated;
revoke insert, delete on public.profiles from authenticated;

revoke update on public.profiles from authenticated;
grant  update (full_name, phone) on public.profiles to authenticated;

revoke update on public.devices from authenticated;
grant  update (name, phone_number, is_active) on public.devices to authenticated;

revoke update on public.outbox from authenticated;
grant  update (status, scheduled_at, attempts, error) on public.outbox to authenticated;

revoke insert, update on public.inbox from authenticated;

-- ---------------------------------------------------------------------
-- 7. FUNGSI HP GATEWAY (dibatasi per pemilik)
-- ---------------------------------------------------------------------
create or replace function public.claim_outbox(batch int default 5)
returns setof public.outbox
language plpgsql security definer
set search_path = public
as $$
declare
  d   uuid := public.current_device_id();
  own uuid;
begin
  if d is null then
    raise exception 'Bukan perangkat gateway yang aktif';
  end if;

  select owner_id into own from public.devices where id = d;
  update public.devices set last_seen_at = now() where id = d;

  -- langganan habis / akun ditangguhkan: jangan kirim apa pun (pesan tetap antre)
  if not public.owner_can_send(own) then
    return;
  end if;

  -- pesan macet "sending" > 5 menit: tandai gagal untuk dicek manual (cegah kirim dobel)
  update public.outbox
     set status = 'failed'::public.sms_status,
         error  = 'Status macet > 5 menit. Mungkin sudah terkirim - cek dulu sebelum "Kirim ulang".',
         updated_at = now()
   where owner_id = own
     and status = 'sending' and updated_at < now() - interval '5 minutes';

  return query
  update public.outbox x
     set status = 'sending', device_id = d, attempts = x.attempts + 1, updated_at = now()
   where x.id in (
     select o.id from public.outbox o
      where o.owner_id = own
        and o.status = 'pending'
        and o.scheduled_at <= now()
        and (o.device_id is null or o.device_id = d)
      order by o.created_at
      limit greatest(1, least(batch, 20))
      for update skip locked
   )
  returning x.*;
end;
$$;

create or replace function public.receive_sms(p_from text, p_body text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  d   uuid := public.current_device_id();
  own uuid;
begin
  if d is null then
    raise exception 'Bukan perangkat gateway yang aktif';
  end if;
  select owner_id into own from public.devices where id = d;

  -- akun ditangguhkan: abaikan diam-diam (jangan error, agar aplikasi tidak mengulang terus)
  if not public.owner_is_admin(own)
     and coalesce((select p.is_suspended from public.profiles p where p.user_id = own), false) then
    return;
  end if;

  insert into public.inbox (from_number, body, device_id, owner_id)
  values (left(p_from, 40), left(p_body, 2000), d, own);
end;
$$;

revoke all on function public.claim_outbox(int)       from public, anon;
revoke all on function public.receive_sms(text, text) from public, anon;
grant execute on function public.claim_outbox(int)       to authenticated;
grant execute on function public.receive_sms(text, text) to authenticated;

-- Balasan otomatis: pengaturan, aturan, jeda, dan batas harian per pemilik
create or replace function public.trg_inbox_auto_reply()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  s         public.auto_reply_settings;
  r         public.auto_reply_rules;
  sender    text;
  txt       text;
  day_start timestamptz;
begin
  select * into s from public.auto_reply_settings where owner_id = new.owner_id;
  if s.owner_id is null or not s.enabled then
    return new;
  end if;

  sender := public.try_normalize_phone(new.from_number);
  if sender is null then
    return new;
  end if;

  -- jangan membalas nomor milik perangkat gateway mana pun (cegah balas-balasan antar-bot)
  if exists (select 1 from public.devices d where d.phone_number = sender) then
    return new;
  end if;

  if s.cooldown_minutes > 0 and exists (
    select 1 from public.outbox o
     where o.owner_id = new.owner_id
       and o.source = 'auto'
       and o.to_number = sender
       and o.created_at > now() - make_interval(mins => s.cooldown_minutes)
  ) then
    return new;
  end if;

  day_start := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  if (select count(*) from public.outbox o
       where o.owner_id = new.owner_id and o.source = 'auto' and o.created_at >= day_start) >= s.daily_cap then
    return new;
  end if;

  txt := lower(btrim(new.body));

  select * into r
    from public.auto_reply_rules x
   where x.owner_id = new.owner_id
     and x.is_active
     and (x.device_id is null or x.device_id = new.device_id)
     and (
          x.match_type = 'any'
       or (x.match_type = 'equals'      and txt = lower(btrim(x.keyword)))
       or (x.match_type = 'contains'    and position(lower(btrim(x.keyword)) in txt) > 0)
       or (x.match_type = 'starts_with' and left(txt, char_length(btrim(x.keyword))) = lower(btrim(x.keyword)))
     )
   order by x.priority, x.created_at
   limit 1;

  if r.id is null then
    return new;
  end if;

  -- bila kuota/langganan tidak cukup, trigger outbox melewati baris ini diam-diam
  insert into public.outbox (to_number, body, device_id, source, inbox_id, created_by, owner_id)
  values (sender, r.reply_body, new.device_id, 'auto', new.id, null, new.owner_id);

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. FUNGSI UNTUK PELANGGAN
-- ---------------------------------------------------------------------
-- Ringkasan akun untuk panel (profil, langganan, jumlah perangkat)
create or replace function public.my_account()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then
    raise exception 'Harus login';
  end if;
  perform public.ensure_profile();

  return jsonb_build_object(
    'user_id',  u,
    'is_admin', public.is_admin(),
    'profile',  (select to_jsonb(p) from public.profiles p where p.user_id = u),
    'subscription', (select to_jsonb(s) || jsonb_build_object('active', s.expires_at > now())
                       from public.subscriptions s where s.owner_id = u),
    'devices',  (select count(*) from public.devices d where d.owner_id = u)
  );
end;
$$;

-- Buat pesanan paket. Nominal diberi kode unik 1-999 agar transfer mudah dicocokkan.
create or replace function public.create_order(p_plan_id uuid)
returns public.payments
language plpgsql security definer
set search_path = public
as $$
declare
  u     uuid := auth.uid();
  pl    public.plans;
  code  int;
  total int;
  tries int := 0;
  pay   public.payments;
begin
  if u is null then
    raise exception 'Harus login';
  end if;
  perform public.ensure_profile();
  if coalesce((select p.is_suspended from public.profiles p where p.user_id = u), true) then
    raise exception 'Akun ditangguhkan atau profil belum ada.';
  end if;

  select * into pl from public.plans where id = p_plan_id and is_active;
  if pl.id is null or pl.price_idr <= 0 then
    raise exception 'Paket tidak tersedia.';
  end if;

  if (select count(*) from public.payments where owner_id = u and status = 'pending') >= 3 then
    raise exception 'Masih ada 3 pesanan yang belum dibayar. Selesaikan dulu atau hubungi admin.';
  end if;

  loop
    code  := 1 + floor(random() * 999)::int;
    total := pl.price_idr + code;
    exit when not exists (select 1 from public.payments where status = 'pending' and amount_idr = total);
    tries := tries + 1;
    if tries > 50 then
      code := 0; total := pl.price_idr;
      exit;
    end if;
  end loop;

  insert into public.payments (owner_id, plan_id, plan_name, base_price_idr, unique_code, amount_idr)
  values (u, pl.id, pl.name, pl.price_idr, code, total)
  returning * into pay;

  return pay;
end;
$$;

-- Kode pairing: 8 karakter tanpa huruf/angka yang mirip (0 O 1 I)
create or replace function public.gen_pair_code()
returns text
language plpgsql volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 karakter
  b   bytea := gen_random_bytes(8);
  res text := '';
begin
  for i in 0..7 loop
    res := res || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return res;
end;
$$;
revoke all on function public.gen_pair_code() from public, anon, authenticated;

-- Tambah HP gateway + kode pairing (berlaku 15 menit)
create or replace function public.create_device(p_name text, p_phone text default null)
returns public.devices
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  u   uuid := auth.uid();
  sub public.subscriptions;
  dev public.devices;
  nm  text := btrim(coalesce(p_name, ''));
begin
  if u is null then
    raise exception 'Harus login';
  end if;
  if char_length(nm) not between 1 and 60 then
    raise exception 'Nama perangkat wajib diisi (maks. 60 karakter).';
  end if;

  if not public.owner_is_admin(u) then
    if coalesce((select p.is_suspended from public.profiles p where p.user_id = u), true) then
      raise exception 'Akun ditangguhkan atau profil belum ada.';
    end if;
    select * into sub from public.subscriptions where owner_id = u;
    if sub.owner_id is null or sub.expires_at <= now() then
      raise exception 'Perlu langganan aktif untuk menambah perangkat.';
    end if;
    if (select count(*) from public.devices where owner_id = u) >= sub.max_devices then
      raise exception 'Batas perangkat paketmu (%) sudah tercapai.', sub.max_devices;
    end if;
  end if;

  insert into public.devices (name, phone_number, owner_id, pair_code, pair_expires_at)
  values (nm, nullif(btrim(coalesce(p_phone, '')), ''), u, public.gen_pair_code(), now() + interval '15 minutes')
  returning * into dev;

  return dev;
end;
$$;

-- Kode pairing baru (mis. kode lama kedaluwarsa atau HP diganti)
create or replace function public.new_pair_code(p_device_id uuid)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  code text := public.gen_pair_code();
begin
  update public.devices
     set pair_code = code, pair_expires_at = now() + interval '15 minutes'
   where id = p_device_id and owner_id = auth.uid();
  if not found then
    raise exception 'Perangkat tidak ditemukan.';
  end if;
  return code;
end;
$$;

-- Dipanggil APLIKASI HP: tautkan akun HP (boleh login anonim) ke perangkat lewat kode pairing
create or replace function public.claim_device(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  u    uuid := auth.uid();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  dev  public.devices;
begin
  if u is null then
    raise exception 'Harus login';
  end if;

  select * into dev
    from public.devices
   where pair_code = code and pair_expires_at > now()
   for update;
  if dev.id is null then
    raise exception 'Kode tidak valid atau sudah kedaluwarsa.';
  end if;

  -- akun HP ini dulu terpasang di perangkat lain? lepaskan
  update public.devices set user_id = null where user_id = u and id <> dev.id;

  update public.devices
     set user_id = u, pair_code = null, pair_expires_at = null, is_active = true, last_seen_at = now()
   where id = dev.id;

  return jsonb_build_object('device_id', dev.id, 'name', dev.name);
end;
$$;

-- Hapus SMS masuk lama milik sendiri (retensi)
create or replace function public.cleanup_old_inbox(days_kept int default 90)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'Harus login';
  end if;
  delete from public.inbox
   where owner_id = auth.uid()
     and received_at < now() - make_interval(days => greatest(1, days_kept));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Untuk penjadwal server (pg_cron): semua pemilik. Tidak diberikan ke pengguna.
create or replace function public.cleanup_old_inbox_all(days_kept int default 90)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  n int;
begin
  delete from public.inbox
   where received_at < now() - make_interval(days => greatest(1, days_kept));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.cleanup_old_inbox_all(int) from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  begin
    perform cron.unschedule('cleanup-old-inbox');
  exception when others then null;
  end;
  perform cron.schedule('cleanup-old-inbox', '0 3 * * *', $cron$select public.cleanup_old_inbox_all(90)$cron$);
exception when others then
  raise notice 'pg_cron tidak tersedia - jalankan select public.cleanup_old_inbox_all(90); manual sesekali.';
end $$;

-- ---------------------------------------------------------------------
-- 9. LANGGANAN & FUNGSI ADMIN
-- ---------------------------------------------------------------------
-- Aktifkan / perpanjang paket.
--   Langganan masih aktif  -> masa aktif dan kuota DITAMBAH (sisa tidak hangus)
--   Sudah berakhir / baru  -> mulai dari sekarang, pemakaian di-reset
-- Hanya bisa dipanggil admin (lewat fungsi admin_*) atau service_role (webhook pembayaran).
create or replace function public.activate_subscription(p_owner uuid, p_plan_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  pl public.plans;
begin
  select * into pl from public.plans where id = p_plan_id;
  if pl.id is null then
    raise exception 'Paket tidak ditemukan.';
  end if;
  if not exists (select 1 from auth.users where id = p_owner) then
    raise exception 'Pengguna tidak ditemukan.';
  end if;

  insert into public.subscriptions as s
    (owner_id, plan_id, plan_name, sms_quota, sms_used, max_devices, daily_limit, started_at, expires_at)
  values
    (p_owner, pl.id, pl.name, pl.sms_quota, 0, pl.max_devices, pl.daily_limit,
     now(), now() + make_interval(days => pl.duration_days))
  on conflict (owner_id) do update set
    plan_id     = excluded.plan_id,
    plan_name   = excluded.plan_name,
    sms_quota   = case when s.expires_at > now() then s.sms_quota + excluded.sms_quota else excluded.sms_quota end,
    sms_used    = case when s.expires_at > now() then s.sms_used else 0 end,
    max_devices = case when s.expires_at > now() then greatest(s.max_devices, excluded.max_devices) else excluded.max_devices end,
    daily_limit = case when s.expires_at > now() then greatest(s.daily_limit, excluded.daily_limit) else excluded.daily_limit end,
    started_at  = case when s.expires_at > now() then s.started_at else now() end,
    expires_at  = case when s.expires_at > now()
                       then s.expires_at + make_interval(days => pl.duration_days)
                       else excluded.expires_at end,
    updated_at  = now();
end;
$$;

revoke all on function public.activate_subscription(uuid, uuid) from public, anon, authenticated;
do $$ begin
  grant execute on function public.activate_subscription(uuid, uuid) to service_role;
exception when undefined_object then null; end $$;

create or replace function public.admin_confirm_payment(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  pay public.payments;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;
  select * into pay from public.payments where id = p_id for update;
  if pay.id is null then
    raise exception 'Pesanan tidak ditemukan.';
  end if;
  if pay.status <> 'pending' then
    raise exception 'Pesanan sudah diproses (%).', pay.status;
  end if;
  perform public.activate_subscription(pay.owner_id, pay.plan_id);
  update public.payments
     set status = 'paid', paid_at = now(), confirmed_by = auth.uid()
   where id = p_id;
end;
$$;

create or replace function public.admin_reject_payment(p_id uuid, p_note text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;
  update public.payments
     set status = 'rejected', note = left(p_note, 300), confirmed_by = auth.uid()
   where id = p_id and status = 'pending';
  if not found then
    raise exception 'Pesanan tidak ditemukan atau sudah diproses.';
  end if;
end;
$$;

-- Beri paket tanpa pembayaran (promo / percobaan gratis)
create or replace function public.admin_grant_plan(p_user uuid, p_plan_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;
  perform public.activate_subscription(p_user, p_plan_id);
end;
$$;

create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;
  update public.profiles set is_suspended = p_suspended where user_id = p_user;
  if not found then
    raise exception 'Pelanggan tidak ditemukan.';
  end if;
end;
$$;

-- Daftar pelanggan + ringkasan pemakaian (TANPA isi SMS)
create or replace function public.admin_overview()
returns table (
  user_id        uuid,
  email          text,
  full_name      text,
  phone          text,
  is_suspended   boolean,
  joined_at      timestamptz,
  plan_name      text,
  sms_quota      int,
  sms_used       int,
  expires_at     timestamptz,
  device_count   bigint,
  last_seen_at   timestamptz,
  sent_30d       bigint
)
language sql stable security definer
set search_path = public
as $$
  select p.user_id, p.email, p.full_name, p.phone, p.is_suspended, p.created_at,
         s.plan_name, s.sms_quota, s.sms_used, s.expires_at,
         (select count(*) from public.devices d where d.owner_id = p.user_id),
         (select max(d.last_seen_at) from public.devices d where d.owner_id = p.user_id),
         (select count(*) from public.outbox o
           where o.owner_id = p.user_id and o.status = 'sent' and o.created_at > now() - interval '30 days')
    from public.profiles p
    left join public.subscriptions s on s.owner_id = p.user_id
   where public.is_admin()
   order by p.created_at desc;
$$;

-- Hak eksekusi: hanya pengguna login (fungsi admin memeriksa is_admin() sendiri)
revoke all on function public.my_account()                       from public, anon;
revoke all on function public.ensure_profile()                   from public, anon;
revoke all on function public.create_order(uuid)                 from public, anon;
revoke all on function public.create_device(text, text)          from public, anon;
revoke all on function public.new_pair_code(uuid)                from public, anon;
revoke all on function public.claim_device(text)                 from public, anon;
revoke all on function public.cleanup_old_inbox(int)             from public, anon;
revoke all on function public.admin_confirm_payment(uuid)        from public, anon;
revoke all on function public.admin_reject_payment(uuid, text)   from public, anon;
revoke all on function public.admin_grant_plan(uuid, uuid)       from public, anon;
revoke all on function public.admin_set_suspended(uuid, boolean) from public, anon;
revoke all on function public.admin_overview()                   from public, anon;

grant execute on function public.my_account()                       to authenticated;
grant execute on function public.ensure_profile()                   to authenticated;
grant execute on function public.create_order(uuid)                 to authenticated;
grant execute on function public.create_device(text, text)          to authenticated;
grant execute on function public.new_pair_code(uuid)                to authenticated;
grant execute on function public.claim_device(text)                 to authenticated;
grant execute on function public.cleanup_old_inbox(int)             to authenticated;
grant execute on function public.admin_confirm_payment(uuid)        to authenticated;
grant execute on function public.admin_reject_payment(uuid, text)   to authenticated;
grant execute on function public.admin_grant_plan(uuid, uuid)       to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;
grant execute on function public.admin_overview()                   to authenticated;

-- ---------------------------------------------------------------------
-- 10. REALTIME (sisa kuota & status langganan tampil langsung di panel)
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.subscriptions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.payments;
exception when duplicate_object then null; end $$;
