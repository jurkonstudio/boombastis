-- =====================================================================
-- Perbaikan keandalan & kebersihan data
-- Jalankan SETELAH 20261101000000_init.sql dan 20261101010000_auto_reply.sql
-- Aman dijalankan ulang (idempotent), tidak menghapus data yang ada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cegah SMS masuk tercatat dobel -> balasan otomatis dobel
--    Jika HP mengirim ulang receive_sms() untuk SMS yang sama (karena
--    jaringan putus sebelum laporan sukses sampai ke server), baris
--    kembar (nomor pengirim + isi pesan sama, dari HP yang sama,
--    dalam 2 menit terakhir) akan DIABAIKAN diam-diam, bukan disimpan
--    lagi. Trigger balasan otomatis tidak akan pernah melihat baris
--    kembar ini, jadi tidak ada balasan dobel.
-- ---------------------------------------------------------------------
create or replace function public.trg_inbox_dedupe()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.inbox i
     where i.device_id = new.device_id
       and i.from_number = new.from_number
       and i.body = new.body
       and i.received_at > now() - interval '2 minutes'
  ) then
    return null; -- lewati, anggap sudah tersimpan
  end if;
  return new;
end;
$$;

drop trigger if exists inbox_dedupe on public.inbox;
create trigger inbox_dedupe
  before insert on public.inbox
  for each row execute function public.trg_inbox_dedupe();

-- ---------------------------------------------------------------------
-- 2. Cegah SMS keluar terkirim dobel
--    Sebelumnya: pesan yang macet di status "sending" > 5 menit otomatis
--    dikembalikan ke "pending" lalu diambil & dikirim ulang - padahal
--    bisa jadi SMS itu SUDAH terkirim fisik dan cuma laporannya yang
--    gagal sampai ke server (mis. jaringan putus pas HP mau lapor).
--    Sekarang: pesan macet ditandai "failed" dengan keterangan, TIDAK
--    dikirim ulang otomatis. Admin cek dulu di tab Outbox, baru tekan
--    "Kirim ulang" secara manual kalau memang belum terkirim.
-- ---------------------------------------------------------------------
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

  -- pesan yang macet di status "sending" > 5 menit: tandai gagal untuk
  -- dicek manual, JANGAN dikirim ulang otomatis (cegah kirim dobel).
  update public.outbox
     set status = 'failed'::public.sms_status,
         error  = 'Status macet > 5 menit. Mungkin sudah terkirim - cek dulu sebelum "Kirim ulang".',
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

revoke all on function public.claim_outbox(int) from public, anon;
grant execute on function public.claim_outbox(int) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Retensi: hapus SMS masuk lama (termasuk kemungkinan OTP)
--    Dijalankan MANUAL dari SQL Editor kapan pun kamu mau membersihkan:
--
--      select public.cleanup_old_inbox(90);   -- hapus inbox > 90 hari
--
--    Bisa diganti angka harinya. Tidak berjalan otomatis sampai kamu
--    jadwalkan sendiri (lihat catatan di bawah).
-- ---------------------------------------------------------------------
create or replace function public.cleanup_old_inbox(days_kept int default 90)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  n int;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh menghapus data';
  end if;
  delete from public.inbox
   where received_at < now() - make_interval(days => greatest(1, days_kept));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.cleanup_old_inbox(int) from public, anon;
grant execute on function public.cleanup_old_inbox(int) to authenticated;

-- Penjadwalan otomatis (opsional). Supabase Free tier biasanya TIDAK
-- menyediakan ekstensi pg_cron, jadi blok ini dibungkus agar migrasi
-- tetap sukses walau pg_cron tidak tersedia di proyekmu. Kalau gagal,
-- jalankan 'select public.cleanup_old_inbox(90);' manual sesekali saja.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'cleanup-old-inbox',
    '0 3 * * *', -- tiap hari jam 03:00 UTC
    $cron$select public.cleanup_old_inbox(90)$cron$
  );
exception when others then
  raise notice 'pg_cron tidak tersedia di proyek ini - lewati penjadwalan otomatis. Jalankan cleanup_old_inbox(90) manual bila perlu.';
end $$;
