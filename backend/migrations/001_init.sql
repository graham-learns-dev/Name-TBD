-- V1 schema per contracts/backend.md. Target: Supabase Postgres.
-- Everything cascades from auth.users so account deletion is one admin call.

create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  experience text check (experience in ('beginner', 'intermediate', 'advanced')),
  goal text,
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  progress_tracking boolean not null default true,
  created_at timestamptz not null default now()
);

create table subscriptions (
  user_id uuid primary key references profiles (user_id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'paid')),
  store text check (store in ('apple', 'google')),
  original_transaction_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table programs (
  program_id text primary key,
  name text not null,
  definition jsonb not null,
  is_free boolean not null default false,
  schema_version text not null
);

create table user_programs (
  user_id uuid not null references profiles (user_id) on delete cascade,
  program_id text not null references programs (program_id),
  started_at timestamptz not null default now(),
  current_week int not null default 1 check (current_week >= 1),
  active boolean not null default true,
  primary key (user_id, program_id, started_at)
);

-- One active program per user.
create unique index user_programs_one_active
  on user_programs (user_id) where active;

create table logged_sets (
  set_id uuid primary key, -- client-generated: offline queue replays are idempotent
  user_id uuid not null references profiles (user_id) on delete cascade,
  logged_at timestamptz not null,
  program_id text references programs (program_id),
  program_week int,
  lift text not null check (lift in ('squat', 'bench', 'deadlift')),
  weight numeric not null check (weight >= 0),
  weight_unit text not null check (weight_unit in ('kg', 'lb')),
  reps int not null check (reps between 1 and 100),
  rpe numeric check (rpe between 1 and 10),
  had_video boolean not null default false,
  rep_quality_score numeric check (rep_quality_score between 0 and 1),
  flag_summary text[] not null default '{}'
);

create index logged_sets_user_recent on logged_sets (user_id, logged_at desc);

-- Entitlement surface consumed by UI and passed to Clip-Gen (watermark decision).
create view entitlements with (security_invoker = true) as
select
  p.user_id,
  coalesce(s.tier, 'free') as tier,
  (coalesce(s.tier, 'free') = 'paid' and s.expires_at > now()) as watermark_free
from profiles p
left join subscriptions s using (user_id);

-- ------------------------------------------------------------------ RLS

alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table programs enable row level security;
alter table user_programs enable row level security;
alter table logged_sets enable row level security;

create policy profiles_own on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Clients read their subscription; only the service role (IAP edge function) writes.
create policy subscriptions_read_own on subscriptions
  for select using (auth.uid() = user_id);

-- Program catalog is read-only to all signed-in users; seeded via service role.
create policy programs_read_all on programs
  for select to authenticated using (true);

create policy user_programs_own on user_programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy logged_sets_own on logged_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
