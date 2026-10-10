-- PrinterAuto production-readiness contracts.
-- Apply after the Phase 1–5 schema. Secrets and file contents are never stored in these tables.

create table if not exists public.idempotency_keys (
  scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (scope, idempotency_key)
);
create index if not exists idempotency_expiry_idx on public.idempotency_keys(expires_at);

create table if not exists public.order_state_events (
  id bigserial primary key,
  order_id text not null references public.orders(id),
  shop_id text not null references public.shops(id),
  from_status text,
  to_status text not null,
  event_type text not null,
  idempotency_key text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(order_id, event_type, idempotency_key)
);
create index if not exists order_events_shop_created_idx on public.order_state_events(shop_id,created_at desc);

create table if not exists public.storage_objects (
  upload_reference text primary key,
  shop_id text not null references public.shops(id),
  order_id text references public.orders(id),
  bucket text not null,
  object_key text not null unique,
  mime_type text not null,
  bytes bigint not null check (bytes > 0 and bytes <= 262144000),
  checksum_sha256 text not null,
  status text not null check (status in ('UPLOADED','BOUND','PRINTING','RETENTION_PENDING','DELETED','DELETE_FAILED')),
  retention_until timestamptz,
  delete_attempts integer not null default 0,
  last_delete_error text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists storage_objects_shop_idx on public.storage_objects(shop_id,status);
create index if not exists storage_objects_retention_idx on public.storage_objects(status,retention_until);

create table if not exists public.file_cleanup_jobs (
  id text primary key,
  upload_reference text not null references public.storage_objects(upload_reference),
  order_id text references public.orders(id),
  scheduled_at timestamptz not null,
  attempts integer not null default 0,
  status text not null check (status in ('PENDING','RUNNING','DELETED','RETRY','FAILED')),
  last_error text,
  updated_at timestamptz not null default now(),
  unique(upload_reference, status) deferrable initially immediate
);
create index if not exists cleanup_due_idx on public.file_cleanup_jobs(status,scheduled_at);

-- The original Phase 4 schema already creates file_cleanup_jobs with a smaller shape.
-- Expand it in place so this migration remains safe on an existing staging database.
alter table public.file_cleanup_jobs add column if not exists attempts integer not null default 0;
alter table public.file_cleanup_jobs add column if not exists last_error text;
alter table public.file_cleanup_jobs add column if not exists updated_at timestamptz not null default now();

create table if not exists public.durable_sessions (
  token_hash text primary key,
  principal_id text not null,
  principal_role text not null,
  shop_id text,
  csrf_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists durable_sessions_expiry_idx on public.durable_sessions(expires_at,revoked_at);

create table if not exists public.durable_rate_limits (
  bucket text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(bucket,subject_hash)
);

create table if not exists public.secret_references (
  id text primary key,
  owner_type text not null,
  owner_id text not null,
  purpose text not null,
  ciphertext bytea not null,
  nonce bytea not null,
  auth_tag bytea not null,
  key_version text not null,
  status text not null check (status in ('ACTIVE','REVOKED')),
  created_by text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists active_secret_purpose_idx on public.secret_references(owner_type,owner_id,purpose) where status = 'ACTIVE';

create or replace function public.claim_idempotency(p_scope text, p_key text, p_request_hash text, p_ttl interval default interval '24 hours')
returns table(is_new boolean, stored_status integer, stored_body jsonb)
language plpgsql security definer set search_path = public as $$
declare r public.idempotency_keys%rowtype;
begin
  delete from public.idempotency_keys where expires_at < now();
  insert into public.idempotency_keys(scope,idempotency_key,request_hash,expires_at)
  values(p_scope,p_key,p_request_hash,now()+p_ttl)
  on conflict (scope,idempotency_key) do nothing
  returning * into r;
  if found then return query select true, null::integer, null::jsonb; return; end if;
  select * into r from public.idempotency_keys where scope=p_scope and idempotency_key=p_key;
  if r.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'; end if;
  return query select false,r.response_status,r.response_body;
end; $$;

create or replace function public.record_idempotent_response(p_scope text, p_key text, p_status integer, p_body jsonb)
returns void language sql security definer set search_path = public as $$
  update public.idempotency_keys set response_status=p_status,response_body=p_body where scope=p_scope and idempotency_key=p_key;
$$;

alter table public.idempotency_keys enable row level security;
alter table public.order_state_events enable row level security;
alter table public.storage_objects enable row level security;
alter table public.file_cleanup_jobs enable row level security;
alter table public.durable_sessions enable row level security;
alter table public.durable_rate_limits enable row level security;
alter table public.secret_references enable row level security;

-- Tenant policies are intentionally idempotent so the migration can be re-applied safely.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='order_state_events' and policyname='shopkeepers read own order events') then
    create policy "shopkeepers read own order events" on public.order_state_events for select using (shop_id = public.current_shop_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='storage_objects' and policyname='shopkeepers read own storage metadata') then
    create policy "shopkeepers read own storage metadata" on public.storage_objects for select using (shop_id = public.current_shop_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='file_cleanup_jobs' and policyname='shopkeepers read own cleanup metadata') then
    create policy "shopkeepers read own cleanup metadata" on public.file_cleanup_jobs for select using (exists (select 1 from public.storage_objects o where o.upload_reference = public.file_cleanup_jobs.upload_reference and o.shop_id = public.current_shop_id()));
  end if;
end $$;

-- No direct browser policies are granted for service-only tables. Application/service role
-- access must enforce shop ownership; storage object access is issued as short-lived signed URLs.
