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

