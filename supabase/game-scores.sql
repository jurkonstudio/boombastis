-- Boombastis leaderboards for the CPS Test and the Reaction Time Test.
-- Run ONCE in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
-- Separate from typing_scores, which is not touched.

create table if not exists public.game_scores (
  id         bigint       generated always as identity primary key,
  game       text         not null check (game in ('cps', 'reaction')),
  mode       smallint     not null,            -- cps: test length in seconds; reaction: 5 (rounds averaged)
  name       text         not null check (name ~ '^[A-Za-z0-9 _-]{2,16}$'),
  score      numeric(7,2) not null,            -- cps: clicks per second; reaction: average milliseconds
  created_at timestamptz  not null default now(),
  constraint game_scores_valid check (
    (game = 'cps'      and mode in (1, 5, 10, 30, 60) and score between 1 and 25)
    or
    (game = 'reaction' and mode = 5                   and score between 100 and 1000)
  )
);

create index if not exists game_scores_rank      on public.game_scores (game, mode, score desc, created_at);
create index if not exists game_scores_name_time on public.game_scores (game, lower(name), created_at desc);
create index if not exists game_scores_time      on public.game_scores (game, created_at desc);

-- Row Level Security: anyone can read and add a score; nobody can edit or delete through the public API.
alter table public.game_scores enable row level security;

drop policy if exists "game scores are public to read" on public.game_scores;
create policy "game scores are public to read" on public.game_scores
  for select to anon, authenticated using (true);

drop policy if exists "anyone can add a game score" on public.game_scores;
create policy "anyone can add a game score" on public.game_scores
  for insert to anon, authenticated with check (true);

-- Light spam protection (the browser can still be scripted, so treat the boards as for fun):
--   * max 3 submissions per name, per game, per minute
--   * max 60 submissions per game per minute overall (a ceiling if someone floods the endpoint)
create or replace function public.game_scores_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if (select count(*) from public.game_scores
        where game = new.game and lower(name) = lower(new.name)
          and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'Too many submissions' using errcode = 'P0001';
  end if;
  if (select count(*) from public.game_scores
        where game = new.game and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Too many submissions' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists game_scores_guard on public.game_scores;
create trigger game_scores_guard before insert on public.game_scores
  for each row execute function public.game_scores_guard();

-- Public leaderboards: best score per name and mode.
-- CPS: higher is better. Reaction time: lower (faster) is better.
create or replace view public.cps_leaderboard with (security_invoker = true) as
  select distinct on (mode, lower(name)) name, mode, score, created_at
  from public.game_scores where game = 'cps'
  order by mode, lower(name), score desc, created_at;

create or replace view public.reaction_leaderboard with (security_invoker = true) as
  select distinct on (mode, lower(name)) name, mode, score, created_at
  from public.game_scores where game = 'reaction'
  order by mode, lower(name), score asc, created_at;

grant select on public.cps_leaderboard      to anon, authenticated;
grant select on public.reaction_leaderboard to anon, authenticated;

-- Moderation: remove an entry from the SQL Editor (service role), for example:
-- delete from public.game_scores where game = 'cps' and lower(name) = 'badname';
