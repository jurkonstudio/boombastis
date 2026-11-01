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

