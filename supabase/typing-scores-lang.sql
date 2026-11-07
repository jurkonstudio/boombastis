-- Boombastis Typing Test: separate leaderboards per language (English + Indonesian).
-- Run ONCE in Supabase SQL Editor, BEFORE deploying the Indonesian page. Safe to run again.

alter table public.typing_scores
  add column if not exists lang text not null default 'en' check (lang in ('en', 'id'));

create index if not exists typing_scores_lang_rank on public.typing_scores (lang, duration, wpm desc);

-- English board (existing view, now limited to lang = 'en'; same columns, so the live English page keeps working).
create or replace view public.typing_leaderboard with (security_invoker = true) as
  select distinct on (duration, lower(name)) name, duration, wpm, accuracy, created_at
  from public.typing_scores
  where lang = 'en'
  order by duration, lower(name), wpm desc, accuracy desc, created_at;

-- Indonesian board.
create or replace view public.typing_leaderboard_id with (security_invoker = true) as
  select distinct on (duration, lower(name)) name, duration, wpm, accuracy, created_at
  from public.typing_scores
  where lang = 'id'
  order by duration, lower(name), wpm desc, accuracy desc, created_at;

grant select on public.typing_leaderboard    to anon, authenticated;
grant select on public.typing_leaderboard_id to anon, authenticated;
