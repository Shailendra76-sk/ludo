-- System Configuration Center metadata only. Never store submitted secrets here.
-- Apply after 20261009_production_readiness.sql.

create table if not exists public.system_runtime_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.configuration_tests (
  id bigserial primary key,
  target text not null,
  status text not null check (status in ('NOT_CONFIGURED','CONFIGURED_NOT_TESTED','TEST_PASSED','TEST_FAILED','BLOCKED_EXTERNAL_SETUP','MIGRATION_REQUIRED','DISABLED','NEEDS_ATTENTION','NOT_IMPLEMENTED')),
  sanitized_message text,
  tested_by text not null,
  tested_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists configuration_tests_target_idx on public.configuration_tests(target,tested_at desc);

create table if not exists public.configuration_audit_events (
  id bigserial primary key,
  category text not null,
  setting_name text not null,
  action text not null,
  actor_id text not null,
  outcome text not null check (outcome in ('SUCCESS','FAILURE')),
  sanitized_result jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists configuration_audit_created_idx on public.configuration_audit_events(created_at desc);

alter table public.system_runtime_settings enable row level security;
alter table public.configuration_tests enable row level security;
alter table public.configuration_audit_events enable row level security;
-- Service-role/application access only. No browser policy is created for platform configuration.
