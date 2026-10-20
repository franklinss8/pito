-- Pito schema. Run once in Supabase: SQL Editor > New query > paste > Run.
-- Every table has RLS on and no policies: only the server (service_role key) reads and writes.

create extension if not exists pgcrypto;

create table if not exists machines (
  id uuid primary key default gen_random_uuid(),
  token_address text not null unique,          -- lowercased 0x address
  name text not null default '',
  symbol text not null default '',
  mission text not null,
  creator text not null,                       -- lowercased launch wallet
  router text,                                 -- Programmable stamp Router that recorded the launch
  launch_id text,
  plan jsonb,
  status text not null default 'planning',     -- planning | ready | plan_failed | running | live
  credits integer not null default 0 check (credits >= 0),
  app_html text,
  app_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines(id) on delete cascade,
  runpod_id text not null,
  status text not null default 'IN_QUEUE',     -- RunPod status: IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED | CANCELLED | TIMED_OUT
  error text,
  model text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  last_polled_at timestamptz
);
create index if not exists jobs_machine_created on jobs (machine_id, created_at desc);

create table if not exists used_nonces (
  nonce text primary key,
  created_at timestamptz not null default now()
);

create table if not exists deposits (
  tx_hash text primary key,
  machine_id uuid not null references machines(id) on delete cascade,
  from_address text not null,
  value_wei text not null,
  credits integer not null,
  created_at timestamptz not null default now()
);

alter table machines enable row level security;
alter table jobs enable row level security;
alter table used_nonces enable row level security;
alter table deposits enable row level security;

-- Atomic credit helpers
create or replace function consume_credit(p_machine uuid) returns boolean
language plpgsql as $$
declare n integer;
begin
  update machines set credits = credits - 1 where id = p_machine and credits > 0;
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function add_credits(p_machine uuid, p_amount integer) returns void
language sql as $$
  update machines set credits = credits + p_amount where id = p_machine;
$$;
