-- Boombastis Typing Test leaderboard. Run once in Supabase: SQL Editor -> New query -> Run.

create table if not exists public.typing_scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (name ~ '^[A-Za-z0-9 _-]{2,16}$'),
  duration   smallint    not null check (duration in (15, 30, 60)),
  wpm        smallint    not null check (wpm between 1 and 250),
  accuracy   smallint    not null check (accuracy between 50 and 100),
  created_at timestamptz not null default now()
);

create index if not exists typing_scores_rank on public.typing_scores (duration, wpm desc, created_at);
create index if not exists typing_scores_name_time on public.typing_scores (name, created_at desc);

-- Row Level Security: anyone can read and add a score; nobody can edit or delete through the public API.
alter table public.typing_scores enable row level security;

drop policy if exists "scores are public to read" on public.typing_scores;
create policy "scores are public to read" on public.typing_scores
  for select to anon, authenticated using (true);

drop policy if exists "anyone can add a score" on public.typing_scores;
create policy "anyone can add a score" on public.typing_scores
  for insert to anon, authenticated with check (true);

-- Light rate limit: max 3 submissions per name per minute, and names are trimmed.
create or replace function public.typing_scores_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if (select count(*) from public.typing_scores
        where lower(name) = lower(new.name) and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'Too many submissions' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists typing_scores_guard on public.typing_scores;
create trigger typing_scores_guard before insert on public.typing_scores
  for each row execute function public.typing_scores_guard();

-- Public leaderboard: best score per name and test length.
create or replace view public.typing_leaderboard with (security_invoker = true) as
  select distinct on (duration, lower(name)) name, duration, wpm, accuracy, created_at
  from public.typing_scores
  order by duration, lower(name), wpm desc, accuracy desc, created_at;

grant select on public.typing_leaderboard to anon, authenticated;

-- Moderation: remove an inappropriate name from the SQL Editor (service role), for example:
-- delete from public.typing_scores where lower(name) = 'badname';
