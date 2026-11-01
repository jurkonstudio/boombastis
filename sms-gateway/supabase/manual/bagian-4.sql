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
