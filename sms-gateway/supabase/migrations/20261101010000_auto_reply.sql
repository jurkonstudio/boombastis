-- =====================================================================
-- Balasan otomatis
-- Jalankan SETELAH 20261101000000_init.sql
--
-- Cara kerja: saat HP gateway menyimpan SMS masuk (receive_sms -> inbox),
-- trigger di bawah mencocokkan pesan dengan aturan, lalu memasukkan
-- balasan ke outbox. HP gateway mengirimnya seperti SMS biasa,
-- lewat SIM yang sama dengan SMS yang diterima.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helper: normalisasi nomor tanpa error (null bila tidak valid)
-- ---------------------------------------------------------------------
create or replace function public.try_normalize_phone(p text)
returns text
language plpgsql immutable
as $$
begin
  return public.normalize_phone(p);
exception when others then
  return null;
end;
$$;

-- nomor SIM perangkat disimpan dalam format +62...
create or replace function public.trg_normalize_device_phone()
returns trigger
language plpgsql
as $$
begin
  if new.phone_number is not null then
    new.phone_number := coalesce(public.try_normalize_phone(new.phone_number), new.phone_number);
  end if;
  return new;
end;
$$;

drop trigger if exists devices_normalize_phone on public.devices;
create trigger devices_normalize_phone
  before insert or update of phone_number on public.devices
  for each row execute function public.trg_normalize_device_phone();

-- ---------------------------------------------------------------------
-- 2. Kolom tambahan: tandai pesan hasil balasan otomatis
-- ---------------------------------------------------------------------
alter table public.outbox add column if not exists source text not null default 'manual'
  check (source in ('manual', 'auto'));
alter table public.outbox add column if not exists inbox_id uuid
  references public.inbox(id) on delete set null;

create index if not exists outbox_auto_idx on public.outbox (to_number, created_at desc)
  where source = 'auto';

-- ---------------------------------------------------------------------
-- 3. Pengaturan global (satu baris)
-- ---------------------------------------------------------------------
create table if not exists public.auto_reply_settings (
  id               int primary key default 1 check (id = 1),
  enabled          boolean not null default true,
  cooldown_minutes int not null default 60 check (cooldown_minutes >= 0),
  daily_cap        int not null default 50 check (daily_cap >= 1),
  updated_at       timestamptz not null default now()
);

insert into public.auto_reply_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. Aturan balasan
--    match_type: any (semua pesan), contains, equals, starts_with
--    priority kecil dicek lebih dulu; aturan pertama yang cocok dipakai.
-- ---------------------------------------------------------------------
create table if not exists public.auto_reply_rules (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  match_type  text not null default 'any'
              check (match_type in ('any', 'contains', 'equals', 'starts_with')),
  keyword     text,
  reply_body  text not null check (char_length(reply_body) between 1 and 1000),
  device_id   uuid references public.devices(id) on delete cascade,
  priority    int not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  check (match_type = 'any' or char_length(btrim(coalesce(keyword, ''))) > 0)
);

create index if not exists auto_reply_rules_idx on public.auto_reply_rules (is_active, priority);

-- aturan bawaan (hanya jika belum ada aturan sama sekali)
insert into public.auto_reply_rules (name, match_type, reply_body, priority)
select 'Balasan umum', 'any',
       'Terima kasih, pesan Anda sudah kami terima. Kami akan membalas secepatnya.', 1000
where not exists (select 1 from public.auto_reply_rules);

-- ---------------------------------------------------------------------
-- 5. RLS: hanya admin
-- ---------------------------------------------------------------------
alter table public.auto_reply_settings enable row level security;
alter table public.auto_reply_rules    enable row level security;

drop policy if exists auto_settings_admin on public.auto_reply_settings;
drop policy if exists auto_rules_admin    on public.auto_reply_rules;

create policy auto_settings_admin on public.auto_reply_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy auto_rules_admin on public.auto_reply_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. Trigger: SMS masuk -> balasan otomatis
-- ---------------------------------------------------------------------
create or replace function public.trg_inbox_auto_reply()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  s       public.auto_reply_settings;
  r       public.auto_reply_rules;
  sender  text;
  txt     text;
  kw      text;
  day_start timestamptz;
begin
  select * into s from public.auto_reply_settings where id = 1;
  if s.id is null or not s.enabled then
    return new;
  end if;

  -- Pengirim harus nomor telepon valid. Nama pengirim (mis. "BANK") dan
  -- kode singkat (mis. 99999) diabaikan: biasanya tidak bisa dibalas.
  sender := public.try_normalize_phone(new.from_number);
  if sender is null then
    return new;
  end if;

  -- Jangan membalas nomor milik perangkat gateway sendiri.
  if exists (select 1 from public.devices d where d.phone_number = sender) then
    return new;
  end if;

  -- Cooldown per pengirim: cegah balas-balasan antar-bot dan pemborosan pulsa.
  if s.cooldown_minutes > 0 and exists (
    select 1 from public.outbox o
     where o.source = 'auto'
       and o.to_number = sender
       and o.created_at > now() - make_interval(mins => s.cooldown_minutes)
  ) then
    return new;
  end if;

  -- Batas harian (hari berganti pukul 00.00 WIB).
  day_start := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  if (select count(*) from public.outbox o
       where o.source = 'auto' and o.created_at >= day_start) >= s.daily_cap then
    return new;
  end if;

  txt := lower(btrim(new.body));

  select * into r
    from public.auto_reply_rules x
   where x.is_active
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

  insert into public.outbox (to_number, body, device_id, source, inbox_id, created_by)
  values (sender, r.reply_body, new.device_id, 'auto', new.id, null);

  return new;
end;
$$;

drop trigger if exists inbox_auto_reply on public.inbox;
create trigger inbox_auto_reply
  after insert on public.inbox
  for each row execute function public.trg_inbox_auto_reply();

-- ---------------------------------------------------------------------
-- 7. TES TANPA HP (jalankan manual di SQL Editor setelah ada perangkat)
--
--    insert into public.inbox (from_number, body, device_id)
--    values ('08123456789', 'halo', (select id from public.devices limit 1));
--
--    select to_number, body, source, status from public.outbox order by created_at desc limit 5;
-- ---------------------------------------------------------------------
