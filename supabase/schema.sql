create extension if not exists pgcrypto;

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null check (char_length(query) between 1 and 200),
  source text not null default 'serpapi',
  mode text not null default 'live',
  article_count integer not null default 0 check (article_count between 0 and 10),
  entity_count integer not null default 0 check (entity_count >= 0),
  cluster_count integer not null default 0 check (cluster_count >= 0),
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analysis_runs_user_created_idx
  on public.analysis_runs (user_id, created_at desc);

alter table public.analysis_runs enable row level security;

drop policy if exists "users read their own analysis runs" on public.analysis_runs;
create policy "users read their own analysis runs"
  on public.analysis_runs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users insert their own analysis runs" on public.analysis_runs;
create policy "users insert their own analysis runs"
  on public.analysis_runs for insert
  to authenticated
  with check (auth.uid() = user_id);

comment on table public.analysis_runs is
  'SERP Entity Desk runs. payload keeps the prototype response reproducible while the UI is still evolving.';
