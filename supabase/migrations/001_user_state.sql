-- Monetra · Supabase setup (step 1: cloud sync)
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
--
-- Each user's app data (workspaces, transactions, invoices, budgets, settings) is stored as one
-- JSON document. Row Level Security guarantees a signed-in user can only read or write their own row.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  -- guard against runaway documents (about 5 MB of JSON)
  constraint user_state_size check (pg_column_size(state) < 5242880)
);

comment on table public.user_state is 'Monetra: one JSON document of app data per user (RLS: owner only).';

-- Keep updated_at current on every write (used to detect changes made on another device).
create or replace function public.touch_user_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_state_touch on public.user_state;
create trigger user_state_touch
  before insert or update on public.user_state
  for each row execute function public.touch_user_state();

-- Row Level Security: owner-only access. Without a matching policy, nobody can read or write.
alter table public.user_state enable row level security;

drop policy if exists "Users can read their own data" on public.user_state;
create policy "Users can read their own data"
  on public.user_state for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own data" on public.user_state;
create policy "Users can create their own data"
  on public.user_state for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own data" on public.user_state;
create policy "Users can update their own data"
  on public.user_state for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own data" on public.user_state;
create policy "Users can delete their own data"
  on public.user_state for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Anonymous visitors get no access at all.
revoke all on public.user_state from anon;
grant select, insert, update, delete on public.user_state to authenticated;
