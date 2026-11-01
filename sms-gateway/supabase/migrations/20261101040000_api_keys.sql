-- =====================================================================
-- API key: pelanggan bisa kirim SMS dari website/aplikasi mereka sendiri.
-- Jalankan SETELAH migrasi multi_tenant. Aman dijalankan ulang.
-- Aturan kuota, batas harian, dan penangguhan tetap dicek oleh trigger outbox.
-- =====================================================================
create extension if not exists pgcrypto;

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  prefix       text not null,
  key_hash     text not null unique,          -- SHA-256 dari key; key asli tidak disimpan
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists api_keys_owner_idx on public.api_keys (owner_id);

alter table public.api_keys enable row level security;
revoke all on public.api_keys from anon, authenticated;
grant select on public.api_keys to authenticated;
drop policy if exists api_keys_select_own on public.api_keys;
create policy api_keys_select_own on public.api_keys
  for select to authenticated using (owner_id = auth.uid());

-- Buat key (dipanggil panel). Key utuh hanya dikembalikan sekali di sini.
create or replace function public.create_api_key(p_name text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare k text; n int;
begin
  if auth.uid() is null then raise exception 'Harus login.'; end if;
  select count(*) into n from public.api_keys where owner_id = auth.uid() and revoked_at is null;
  if n >= 5 then raise exception 'Maksimal 5 API key aktif. Cabut yang lama dulu.'; end if;
  k := 'bb_' || encode(gen_random_bytes(24), 'hex');
  insert into public.api_keys (owner_id, name, prefix, key_hash)
  values (auth.uid(), left(coalesce(nullif(trim(p_name), ''), 'API key'), 60), left(k, 9),
          encode(digest(k, 'sha256'), 'hex'));
  return jsonb_build_object('key', k);
end;
$$;

create or replace function public.revoke_api_key(p_id uuid)
returns void
language sql security definer
set search_path = public
as $$
  update public.api_keys set revoked_at = now()
   where id = p_id and owner_id = auth.uid() and revoked_at is null;
$$;

-- Kirim SMS lewat API key. Dipanggil sistem pelanggan: POST /rest/v1/rpc/api_send_sms
create or replace function public.api_send_sms(p_key text, p_to text, p_message text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare kid uuid; own uuid; oid uuid;
begin
  select id, owner_id into kid, own from public.api_keys
   where key_hash = encode(digest(coalesce(p_key, ''), 'sha256'), 'hex') and revoked_at is null;
  if kid is null then
    raise exception 'API key tidak valid.' using errcode = '28000';
  end if;
  if p_to is null or char_length(trim(p_to)) < 8 then
    raise exception 'Nomor tujuan tidak valid.';
  end if;
  if p_message is null or char_length(trim(p_message)) = 0 or char_length(p_message) > 1000 then
    raise exception 'Pesan harus 1 sampai 1000 karakter.';
  end if;
  update public.api_keys set last_used_at = now() where id = kid;
  insert into public.outbox (owner_id, to_number, body)
  values (own, trim(p_to), trim(p_message))
  returning id into oid;
  return jsonb_build_object('ok', true, 'id', oid, 'status', 'pending');
end;
$$;

-- Cek status pesan yang dikirim lewat API
create or replace function public.api_sms_status(p_key text, p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare r public.outbox;
begin
  select o.* into r
    from public.outbox o
    join public.api_keys k on k.owner_id = o.owner_id
   where k.key_hash = encode(digest(coalesce(p_key, ''), 'sha256'), 'hex')
     and k.revoked_at is null and o.id = p_id;
  if r.id is null then raise exception 'Pesan tidak ditemukan.'; end if;
  return jsonb_build_object('id', r.id, 'status', r.status, 'sent_at', r.sent_at, 'error', r.error);
end;
$$;

revoke all on function public.create_api_key(text) from public, anon;
revoke all on function public.revoke_api_key(uuid) from public, anon;
revoke all on function public.api_send_sms(text, text, text) from public;
revoke all on function public.api_sms_status(text, uuid) from public;
grant execute on function public.create_api_key(text) to authenticated;
grant execute on function public.revoke_api_key(uuid) to authenticated;
grant execute on function public.api_send_sms(text, text, text) to anon, authenticated;
grant execute on function public.api_sms_status(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
