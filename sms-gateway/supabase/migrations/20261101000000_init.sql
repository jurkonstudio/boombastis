-- =====================================================================
-- SMS Gateway Mandiri - Skema Supabase
-- Jalankan seluruh file ini di Supabase > SQL Editor
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. ADMIN
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 2. PERANGKAT (HP gateway)
--    Setiap HP login ke Supabase memakai akun Auth sendiri (user_id).
-- ---------------------------------------------------------------------
create table if not exists public.devices (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone_number  text,
  user_id       uuid unique references auth.users(id) on delete set null,
  is_active     boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. NORMALISASI NOMOR
--    08123456789 / 628123456789 / 8123456789 -> +628123456789
-- ---------------------------------------------------------------------
create or replace function public.normalize_phone(p text)
returns text
language plpgsql immutable
as $$
declare
  s text := regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g');
begin
  if s like '+%' then
    null;
  elsif s like '0%' then
    s := '+62' || substr(s, 2);
  elsif s like '62%' then
    s := '+' || s;
  elsif s like '8%' then
    s := '+62' || s;
  end if;

  if s !~ '^\+[1-9][0-9]{8,14}$' then
    raise exception 'Nomor tidak valid: %', p;
  end if;
  return s;
end;
$$;

create or replace function public.trg_normalize_to_number()
returns trigger
language plpgsql
as $$
begin
  new.to_number := public.normalize_phone(new.to_number);
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. OUTBOX (antrean SMS keluar)
-- ---------------------------------------------------------------------
do $$ begin
  create type public.sms_status as enum ('pending','sending','sent','failed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.outbox (
  id            uuid primary key default gen_random_uuid(),
  to_number     text not null,
  body          text not null check (char_length(body) between 1 and 1000),
  status        public.sms_status not null default 'pending',
  device_id     uuid references public.devices(id) on delete set null,
  attempts      int not null default 0,
  error         text,
  scheduled_at  timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  updated_at    timestamptz not null default now()
);

create index if not exists outbox_queue_idx on public.outbox (status, scheduled_at);
create index if not exists outbox_created_idx on public.outbox (created_at desc);

drop trigger if exists outbox_normalize on public.outbox;
create trigger outbox_normalize
  before insert or update of to_number on public.outbox
  for each row execute function public.trg_normalize_to_number();

-- ---------------------------------------------------------------------
-- 5. INBOX (SMS masuk / balasan)
-- ---------------------------------------------------------------------
create table if not exists public.inbox (
  id           uuid primary key default gen_random_uuid(),
  from_number  text not null,
  body         text not null,
  device_id    uuid references public.devices(id) on delete set null,
  received_at  timestamptz not null default now()
);

create index if not exists inbox_received_idx on public.inbox (received_at desc);

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
--    Admin: akses penuh. HP gateway: hanya lewat fungsi RPC di bawah.
-- ---------------------------------------------------------------------
alter table public.admins  enable row level security;
alter table public.devices enable row level security;
alter table public.outbox  enable row level security;
alter table public.inbox   enable row level security;

drop policy if exists admins_self   on public.admins;
drop policy if exists devices_admin on public.devices;
drop policy if exists outbox_admin  on public.outbox;
drop policy if exists inbox_admin   on public.inbox;

create policy admins_self   on public.admins  for select to authenticated using (user_id = auth.uid());
create policy devices_admin on public.devices for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy outbox_admin  on public.outbox  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy inbox_admin   on public.inbox   for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 7. FUNGSI RPC UNTUK APLIKASI HP GATEWAY
-- ---------------------------------------------------------------------
create or replace function public.current_device_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.devices where user_id = auth.uid() and is_active;
$$;

-- Ambil antrean (atomik, aman bila ada beberapa HP)
create or replace function public.claim_outbox(batch int default 5)
returns setof public.outbox
language plpgsql security definer
set search_path = public
as $$
declare
  d uuid := public.current_device_id();
begin
  if d is null then
    raise exception 'Bukan perangkat gateway yang aktif';
  end if;

  update public.devices set last_seen_at = now() where id = d;

  -- pulihkan pesan yang macet di status "sending" > 5 menit
  update public.outbox
     set status = case when attempts >= 3 then 'failed'::public.sms_status
                       else 'pending'::public.sms_status end,
         error  = case when attempts >= 3 then 'Timeout dari perangkat' else error end,
         updated_at = now()
   where status = 'sending' and updated_at < now() - interval '5 minutes';

  return query
  update public.outbox o
     set status = 'sending', device_id = d, attempts = o.attempts + 1, updated_at = now()
   where o.id in (
     select id from public.outbox
      where status = 'pending'
        and scheduled_at <= now()
        and (device_id is null or device_id = d)
      order by created_at
      limit greatest(1, least(batch, 20))
      for update skip locked
   )
  returning o.*;
end;
$$;

-- Laporkan hasil kirim
create or replace function public.report_outbox(p_id uuid, p_ok boolean, p_error text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  d uuid := public.current_device_id();
begin
  if d is null then
    raise exception 'Bukan perangkat gateway yang aktif';
  end if;

  update public.outbox
     set status  = case when p_ok then 'sent'::public.sms_status
                        when attempts >= 3 then 'failed'::public.sms_status
                        else 'pending'::public.sms_status end,
         sent_at = case when p_ok then now() else sent_at end,
         error   = case when p_ok then null else left(coalesce(p_error, 'Gagal'), 300) end,
         updated_at = now()
   where id = p_id and device_id = d and status = 'sending';
end;
$$;

-- Simpan SMS masuk
create or replace function public.receive_sms(p_from text, p_body text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  d uuid := public.current_device_id();
begin
  if d is null then
    raise exception 'Bukan perangkat gateway yang aktif';
  end if;
  insert into public.inbox (from_number, body, device_id)
  values (left(p_from, 40), left(p_body, 2000), d);
end;
$$;

-- Detak jantung (opsional, agar status "online" akurat)
create or replace function public.device_heartbeat()
returns void
language sql security definer
set search_path = public
as $$
  update public.devices set last_seen_at = now() where user_id = auth.uid() and is_active;
$$;

revoke all on function public.claim_outbox(int)                 from public, anon;
revoke all on function public.report_outbox(uuid, boolean, text) from public, anon;
revoke all on function public.receive_sms(text, text)           from public, anon;
revoke all on function public.device_heartbeat()                from public, anon;
grant execute on function public.claim_outbox(int)                 to authenticated;
grant execute on function public.report_outbox(uuid, boolean, text) to authenticated;
grant execute on function public.receive_sms(text, text)           to authenticated;
grant execute on function public.device_heartbeat()                to authenticated;

-- ---------------------------------------------------------------------
-- 8. REALTIME (agar panel admin & HP langsung dapat update)
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.outbox;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.inbox;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.devices;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 9. SETUP AWAL (jalankan manual SETELAH membuat user di Authentication)
--    Ganti UUID dengan id user admin kamu:
--
--    insert into public.admins (user_id) values ('UUID-USER-ADMIN');
-- ---------------------------------------------------------------------
