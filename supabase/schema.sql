-- Pito schema v2. Safe to run again on an existing database (adds what is missing).
-- Supabase: SQL Editor > New query > paste > Run.
-- Every table has RLS on and no policies: only the server (service_role key) reads and writes.

create extension if not exists pgcrypto;

-- ---------- machines: one token, one computer ----------
create table if not exists machines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- token identity (bound after the Programmable launch)
  name text not null default '',
  symbol text not null default '',
  description text not null default '',
  image_url text not null default '',
  website text not null default '',
  x_handle text not null default '',
  token_address text unique,                 -- lowercased, null until bound
  creator text not null,                     -- lowercased wallet that signed the creation
  router text,
  launch_id text,
  bound_at timestamptz,
  -- what to build
  mission text not null,
  template_id text not null default 'none',
  gpu_type_id text not null default '',
  gpu_name text not null default '',
  vram_gb integer not null default 0,
  gpu_count integer not null default 1,
  ai_model text not null default 'claude-sonnet-5-5',
  cloud_type text not null default 'COMMUNITY',
  -- lifecycle: prelaunch | bound | starting | running | stopped | error
  status text not null default 'prelaunch',
  pod_id text,
  pod_status text,
  app_url text,
  last_frame_at timestamptz,
  agent_token text not null default encode(gen_random_bytes(24), 'hex'),
  agent_started_at timestamptz,
  last_seen_at timestamptz,
  plan jsonb,                                -- {summary, stage, progress, current_task, milestones:[{title,done}]}
  -- money (USD cents, credited from ETH deposits at the rate of the moment)
  budget_cents integer not null default 0,
  spent_cents integer not null default 0,
  price_cents_per_hour integer not null default 0,
  last_billed_at timestamptz,
  -- market
  market_cap_usd numeric,
  market_updated_at timestamptz,
  -- legacy (v1 single-file apps)
  app_html text,
  app_updated_at timestamptz,
  credits integer not null default 0
);
alter table machines add column if not exists description text not null default '';
alter table machines add column if not exists image_url text not null default '';
alter table machines add column if not exists website text not null default '';
alter table machines add column if not exists x_handle text not null default '';
alter table machines add column if not exists bound_at timestamptz;
alter table machines add column if not exists template_id text not null default 'none';
alter table machines add column if not exists gpu_type_id text not null default '';
alter table machines add column if not exists gpu_name text not null default '';
alter table machines add column if not exists vram_gb integer not null default 0;
alter table machines add column if not exists gpu_count integer not null default 1;
alter table machines add column if not exists ai_model text not null default 'claude-sonnet-5-5';
alter table machines add column if not exists cloud_type text not null default 'COMMUNITY';
alter table machines add column if not exists pod_id text;
alter table machines add column if not exists pod_status text;
alter table machines add column if not exists app_url text;
alter table machines add column if not exists last_frame_at timestamptz;
alter table machines add column if not exists agent_token text not null default encode(gen_random_bytes(24), 'hex');
alter table machines add column if not exists agent_started_at timestamptz;
alter table machines add column if not exists last_seen_at timestamptz;
alter table machines add column if not exists budget_cents integer not null default 0;
alter table machines add column if not exists spent_cents integer not null default 0;
alter table machines add column if not exists price_cents_per_hour integer not null default 0;
alter table machines add column if not exists last_billed_at timestamptz;
alter table machines add column if not exists market_cap_usd numeric;
alter table machines add column if not exists market_updated_at timestamptz;
alter table machines alter column token_address drop not null;
alter table machines alter column status set default 'prelaunch';
create index if not exists machines_status on machines (status);
create index if not exists machines_created on machines (created_at desc);

-- ---------- what the AI does ----------
create table if not exists steps (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines(id) on delete cascade,
  kind text not null default 'shell',        -- shell | file | note | built | audit | plan | reply | system
  command text,
  output text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists steps_machine on steps (machine_id, created_at desc);

-- ---------- holders talk to the AI ----------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines(id) on delete cascade,
  wallet text not null,                      -- lowercased; 'ai' for the machine's replies
  body text not null,
  is_ai boolean not null default false,
  reply_to uuid references messages(id) on delete set null,
  kind text not null default 'message',      -- message | idea | feature | bug
  status text not null default 'open',       -- open | approved | built | declined
  votes integer not null default 0,
  ai_replied boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_machine on messages (machine_id, created_at desc);

create table if not exists votes (
  message_id uuid not null references messages(id) on delete cascade,
  wallet text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, wallet)
);

-- ---------- money ----------
create table if not exists deposits (
  tx_hash text primary key,
  machine_id uuid references machines(id) on delete cascade,
  rental_id uuid,
  from_address text not null,
  value_wei text not null,
  cents integer not null default 0,
  credits integer not null default 0,
  created_at timestamptz not null default now()
);
alter table deposits add column if not exists cents integer not null default 0;
alter table deposits add column if not exists rental_id uuid;
alter table deposits alter column machine_id drop not null;

create table if not exists used_nonces (
  nonce text primary key,
  created_at timestamptz not null default now()
);

-- ---------- Rent: a Pito computer of your own ----------
create table if not exists rentals (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  gpu_type_id text not null,
  gpu_name text not null,
  template_id text not null default 'desktop',
  status text not null default 'pending',    -- pending | starting | running | stopped | error
  pod_id text,
  connect_url text,
  budget_cents integer not null default 0,
  spent_cents integer not null default 0,
  price_cents_per_hour integer not null default 0,
  started_at timestamptz,
  last_billed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rentals_wallet on rentals (wallet, created_at desc);

-- ---------- legacy v1 ----------
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines(id) on delete cascade,
  runpod_id text not null,
  status text not null default 'IN_QUEUE',
  error text,
  model text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  last_polled_at timestamptz
);

alter table machines enable row level security;
alter table steps enable row level security;
alter table messages enable row level security;
alter table votes enable row level security;
alter table deposits enable row level security;
alter table used_nonces enable row level security;
alter table rentals enable row level security;
alter table jobs enable row level security;

-- ---------- helpers ----------
create or replace function add_budget(p_machine uuid, p_cents integer) returns void
language sql as $$ update machines set budget_cents = budget_cents + p_cents where id = p_machine; $$;

create or replace function add_rental_budget(p_rental uuid, p_cents integer) returns void
language sql as $$ update rentals set budget_cents = budget_cents + p_cents where id = p_rental; $$;

create or replace function cast_vote(p_message uuid, p_wallet text) returns integer
language plpgsql as $$
declare n integer;
begin
  insert into votes (message_id, wallet) values (p_message, p_wallet) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 1 then update messages set votes = votes + 1 where id = p_message; end if;
  select votes into n from messages where id = p_message;
  return n;
end $$;

-- legacy
create or replace function consume_credit(p_machine uuid) returns boolean
language plpgsql as $$
declare n integer;
begin
  update machines set credits = credits - 1 where id = p_machine and credits > 0;
  get diagnostics n = row_count; return n = 1;
end $$;
create or replace function add_credits(p_machine uuid, p_amount integer) returns void
language sql as $$ update machines set credits = credits + p_amount where id = p_machine; $$;

-- ---------- live screen frames (public bucket, written by the server only) ----------
insert into storage.buckets (id, name, public) values ('frames', 'frames', true) on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'pito public frames') then
    create policy "pito public frames" on storage.objects for select using (bucket_id = 'frames');
  end if;
end $$;
