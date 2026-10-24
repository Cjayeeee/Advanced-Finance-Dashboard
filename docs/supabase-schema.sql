-- Reference schema for moving Monetra from localStorage to Supabase.
-- Not used by the current build. Amounts are bigint MINOR units (paise/cents).

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 50),
  type text not null check (type in ('freelancer','startup')),
  currency text not null check (currency in ('INR','USD','EUR','GBP')),
  locale text not null default 'en-IN',
  revenue_target bigint not null default 0 check (revenue_target >= 0),
  burn_window smallint not null default 3 check (burn_window in (3,6)),
  invoice_prefix text not null default 'INV-',
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','editor','viewer')),
  primary key (workspace_id, user_id)
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null, kind text not null check (kind in ('income','expense')),
  color text not null, icon text not null,
  unique (workspace_id, kind, name)
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null, kind text not null check (kind in ('bank','card','cash','wallet')),
  opening_balance bigint not null default 0, archived boolean not null default false
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null, email text, address text, tax_id text
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  number text not null, client_id uuid not null references clients(id),
  project_id uuid references projects(id) on delete set null,
  issue_date date not null, due_date date not null check (due_date >= issue_date),
  lines jsonb not null,                      -- [{description, quantity, rate}]
  discount_type text not null default 'percent', discount_value numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100), tax_label text,
  notes text, terms text,
  state text not null default 'draft' check (state in ('draft','issued','void')),
  issued_at date, created_at timestamptz not null default now(),
  unique (workspace_id, number)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null check (type in ('income','expense','transfer')),
  amount bigint not null check (amount > 0),
  date date not null,
  description text not null check (char_length(description) between 1 and 120),
  category_id uuid references categories(id) on delete set null,
  account_id uuid not null references accounts(id),
  to_account_id uuid references accounts(id),
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  refund boolean not null default false,
  recurring jsonb, notes text, tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  check ((type = 'transfer') = (to_account_id is not null)),
  check (to_account_id is null or to_account_id <> account_id),
  check (invoice_id is null or type = 'income')
);
create index on transactions (workspace_id, date);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,  -- null = overall
  amount bigint not null check (amount > 0),
  period text not null check (period in ('monthly','custom')),
  start_date date, end_date date, alert_at smallint not null default 80
);

-- Row-level security: a user can only touch rows of workspaces they belong to.
create function is_member(ws uuid) returns boolean language sql security definer stable as $$
  select exists (select 1 from workspace_members m where m.workspace_id = ws and m.user_id = auth.uid())
$$;

alter table workspaces enable row level security;
create policy ws_rw on workspaces using (is_member(id)) with check (owner_id = auth.uid());

do $$ declare t text; begin
  foreach t in array array['categories','accounts','clients','projects','invoices','transactions','budgets'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I using (is_member(workspace_id)) with check (is_member(workspace_id))', t || '_member', t);
  end loop;
end $$;

-- TODO for production: store invoices.total and add a trigger that rejects payments
-- whose sum would exceed it (the app already enforces this client-side).
