-- Boombastis traffic analytics (admin panel at /admin/).
-- Run ONCE in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
--
-- What it stores per page view: path, referrer HOST only, country (from Cloudflare header, no IP stored),
-- language, timezone, device/browser/OS class, and two random ids (visitor + session) made in the browser.
-- The public (anon) key can ONLY call track_view(); it cannot read anything.
-- Only users listed in analytics_admins can read the stats (see the last section).

create table if not exists public.page_views (
  id         bigint      generated always as identity primary key,
  created_at timestamptz not null default now(),
  vid        text        not null check (vid ~ '^[A-Za-z0-9_-]{8,40}$'),
  sid        text        not null check (sid ~ '^[A-Za-z0-9_-]{8,40}$'),
  path       text        not null check (path like '/%' and length(path) <= 200),
  referrer   text        check (length(referrer) <= 100),
  country    text        check (country ~ '^[A-Z0-9]{2}$'),
  lang       text        check (length(lang) <= 12),
  tz         text        check (length(tz) <= 60),
  device     text        not null default 'desktop' check (device in ('mobile', 'tablet', 'desktop')),
  browser    text        check (length(browser) <= 20),
  os         text        check (length(os) <= 20)
);

create index if not exists page_views_time    on public.page_views (created_at desc);
create index if not exists page_views_country on public.page_views (created_at desc, country);
create index if not exists page_views_vid     on public.page_views (vid, created_at desc);

-- No policies for anon/authenticated: the table cannot be read or written through the public API.
alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Tracker entry point. Country comes from the Cloudflare header that Supabase's gateway adds.
-- ---------------------------------------------------------------------------------------------
create or replace function public.track_view(
  p_vid text, p_sid text, p_path text, p_referrer text default null,
  p_lang text default null, p_tz text default null,
  p_device text default 'desktop', p_browser text default null, p_os text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  hdr json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  c   text := upper(nullif(btrim(hdr ->> 'cf-ipcountry'), ''));
begin
  if c is null or c !~ '^[A-Z0-9]{2}$' or c = 'XX' then c := null; end if;   -- 'T1' = Tor, kept
  if coalesce(p_vid, '') !~ '^[A-Za-z0-9_-]{8,40}$' or coalesce(p_sid, '') !~ '^[A-Za-z0-9_-]{8,40}$' then return; end if;
  if p_path is null or p_path not like '/%' or length(p_path) > 200 then return; end if;

  -- Silent rate limits (a tracker must never show errors): 30 views/min per visitor, 3000/min overall.
  if (select count(*) from public.page_views where vid = p_vid and created_at > now() - interval '1 minute') >= 30 then return; end if;
  if (select count(*) from public.page_views where created_at > now() - interval '1 minute') >= 3000 then return; end if;

  insert into public.page_views (vid, sid, path, referrer, country, lang, tz, device, browser, os)
  values (
    p_vid, p_sid, p_path,
    left(nullif(btrim(p_referrer), ''), 100), c,
    left(nullif(btrim(p_lang), ''), 12), left(nullif(btrim(p_tz), ''), 60),
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end,
    left(nullif(btrim(p_browser), ''), 20), left(nullif(btrim(p_os), ''), 20)
  );
end $$;

revoke all on function public.track_view(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.track_view(text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Admin access
-- ---------------------------------------------------------------------------------------------
create table if not exists public.analytics_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.analytics_admins enable row level security;
revoke all on public.analytics_admins from anon, authenticated;

create or replace function public.is_analytics_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.analytics_admins where user_id = auth.uid());
$$;
revoke all on function public.is_analytics_admin() from public, anon;
grant execute on function public.is_analytics_admin() to authenticated;

-- One call returns everything the dashboard needs.
--   p_from/p_to: range (to is exclusive), p_tz: IANA timezone for day/hour buckets, p_bucket: 'hour' | 'day'
create or replace function public.analytics_summary(
  p_from timestamptz, p_to timestamptz, p_tz text default 'UTC', p_bucket text default 'day'
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  len interval := p_to - p_from;
  b   text := case when p_bucket = 'hour' then 'hour' else 'day' end;
  res jsonb;
begin
  if not public.is_analytics_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if len <= interval '0' or len > interval '400 days' then
    raise exception 'bad range' using errcode = '22023';
  end if;

  with cur as (
    select * from public.page_views where created_at >= p_from and created_at < p_to
  ), prev as (
    select * from public.page_views where created_at >= p_from - len and created_at < p_from
  ), tot as (
    select jsonb_build_object('views', count(*), 'visitors', count(distinct vid), 'sessions', count(distinct sid)) j from cur
  ), ptot as (
    select jsonb_build_object('views', count(*), 'visitors', count(distinct vid), 'sessions', count(distinct sid)) j from prev
  ), series as (
    select coalesce(jsonb_agg(jsonb_build_object('t', to_char(g.t, 'YYYY-MM-DD"T"HH24:MI'), 'views', coalesce(x.v, 0), 'visitors', coalesce(x.u, 0)) order by g.t), '[]'::jsonb) j
    from generate_series(
           date_trunc(b, p_from at time zone p_tz),
           date_trunc(b, (p_to - interval '1 second') at time zone p_tz),
           ('1 ' || b)::interval) as g(t)
    left join (
      select date_trunc(b, created_at at time zone p_tz) t, count(*) v, count(distinct vid) u from cur group by 1
    ) x on x.t = g.t
  ), by_country as (
    select coalesce(jsonb_agg(r order by (r ->> 'views')::int desc), '[]'::jsonb) j from (
      select jsonb_build_object('k', coalesce(country, '??'), 'views', count(*), 'visitors', count(distinct vid)) r
      from cur group by country order by count(*) desc limit 50) s
  ), by_page as (
    select coalesce(jsonb_agg(r order by (r ->> 'views')::int desc), '[]'::jsonb) j from (
      select jsonb_build_object('k', path, 'views', count(*), 'visitors', count(distinct vid)) r
      from cur group by path order by count(*) desc limit 30) s
  ), by_ref as (
    select coalesce(jsonb_agg(r order by (r ->> 'views')::int desc), '[]'::jsonb) j from (
      select jsonb_build_object('k', coalesce(referrer, '(direct)'), 'views', count(*), 'visitors', count(distinct vid)) r
      from cur group by referrer order by count(*) desc limit 20) s
  ), by_device as (
    select coalesce(jsonb_agg(r order by (r ->> 'views')::int desc), '[]'::jsonb) j from (
      select jsonb_build_object('k', device, 'views', count(*), 'visitors', count(distinct vid)) r
      from cur group by device) s
  ), by_browser as (
    select coalesce(jsonb_agg(r order by (r ->> 'views')::int desc), '[]'::jsonb) j from (
      select jsonb_build_object('k', coalesce(browser, 'Other'), 'views', count(*), 'visitors', count(distinct vid)) r
      from cur group by browser order by count(*) desc limit 10) s
  ), by_os as (
    select coalesce(jsonb_agg(r order by (r ->> 'views')::int desc), '[]'::jsonb) j from (
      select jsonb_build_object('k', coalesce(os, 'Other'), 'views', count(*), 'visitors', count(distinct vid)) r
      from cur group by os order by count(*) desc limit 10) s
  ), by_lang as (
    select coalesce(jsonb_agg(r order by (r ->> 'views')::int desc), '[]'::jsonb) j from (
      select jsonb_build_object('k', coalesce(lang, '??'), 'views', count(*), 'visitors', count(distinct vid)) r
      from cur group by lang order by count(*) desc limit 10) s
  ), live as (
    select count(distinct vid) n from public.page_views where created_at > now() - interval '5 minutes'
  )
  select jsonb_build_object(
    'totals', tot.j, 'prev', ptot.j, 'series', series.j,
    'countries', by_country.j, 'pages', by_page.j, 'referrers', by_ref.j,
    'devices', by_device.j, 'browsers', by_browser.j, 'os', by_os.j, 'langs', by_lang.j,
    'live', live.n
  ) into res
  from tot, ptot, series, by_country, by_page, by_ref, by_device, by_browser, by_os, by_lang, live;

  return res;
end $$;

-- Latest hits, newest first (the live feed).
create or replace function public.analytics_recent(p_limit int default 50)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_analytics_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      't', created_at, 'path', path, 'country', country, 'device', device,
      'browser', browser, 'os', os, 'referrer', referrer, 'lang', lang, 'tz', tz) order by created_at desc)
    from (select * from public.page_views order by created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) r
  ), '[]'::jsonb);
end $$;

revoke all on function public.analytics_summary(timestamptz, timestamptz, text, text) from public, anon;
revoke all on function public.analytics_recent(int) from public, anon;
grant execute on function public.analytics_summary(timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.analytics_recent(int) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- STEP 2 (do once, after you create your admin user in Authentication -> Users):
-- replace the email below with YOUR admin email, then run just this statement.
--
--   insert into public.analytics_admins (user_id)
--   select id from auth.users where email = 'GANTI-DENGAN-EMAIL-ADMIN@contoh.com'
--   on conflict do nothing;
--
-- Optional retention (free plan has 500 MB): delete views older than 365 days, e.g. monthly by hand:
--   delete from public.page_views where created_at < now() - interval '365 days';
-- ---------------------------------------------------------------------------------------------
