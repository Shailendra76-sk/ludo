-- PrinterAuto Super Admin Control Center
-- Forward-only migration. Secrets are referenced through a secret manager/env, never stored here.

create table if not exists public.cms_site_settings (
  id text primary key default 'default',
  platform_name text not null default 'Printer Auto',
  announcement text not null default '',
  logo_media_id text,
  favicon_media_id text,
  social_image_media_id text,
  privacy_policy text not null default '',
  terms text not null default '',
  refund_policy text not null default '',
  help_content text not null default '',
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id text primary key,
  storage_key text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp')),
  bytes bigint not null check (bytes > 0 and bytes <= 10485760),
  width integer not null check (width >= 320 and width <= 8000),
  height integer not null check (height >= 80 and height <= 8000),
  checksum text,
  alt_text text not null default '',
  is_public boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.banners (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  desktop_media_id text not null references public.media_assets(id),
  mobile_media_id text not null references public.media_assets(id),
  alt_text text not null,
  cta_label text not null default '',
  destination_url text not null default '',
  position integer not null default 0,
  priority integer not null default 0,
  start_at timestamptz not null,
  end_at timestamptz,
  status text not null check (status in ('DRAFT','PUBLISHED','UNPUBLISHED','SCHEDULED','EXPIRED','ARCHIVED')),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or end_at > start_at)
);

create table if not exists public.campaigns (
  id text primary key,
  code text not null unique,
  name text not null,
  description text not null default '',
  discount_type text not null check (discount_type in ('PERCENTAGE','FIXED')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  maximum_discount numeric(12,2) not null default 0 check (maximum_discount >= 0),
  minimum_amount numeric(12,2) not null default 0 check (minimum_amount >= 0),
  eligibility jsonb not null default '{"type":"PRINTING"}',
  shop_ids jsonb not null default '[]',
  total_limit integer not null default 0 check (total_limit >= 0),
  per_customer_limit integer not null default 0 check (per_customer_limit >= 0),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null check (status in ('ACTIVE','PAUSED','EXPIRED','ARCHIVED')),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.coupon_redemptions (
  id text primary key,
  campaign_id text not null references public.campaigns(id),
  order_id text references public.orders(id),
  subscription_id text references public.subscriptions(id),
  customer_key text,
  discount numeric(12,2) not null check (discount >= 0),
  status text not null check (status in ('PENDING','REDEEMED','REVERSED','FAILED')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  reversed_at timestamptz
);

create table if not exists public.platform_provider_configs (
  id text primary key,
  provider text not null check (provider in ('cashfree','razorpay')),
  environment text not null,
  merchant_reference text,
  secret_reference text,
  status text not null check (status in ('NOT_CONFIGURED','CONFIGURED','DISABLED','ERROR')),
  last_health_check timestamptz,
  last_error text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, environment)
);

create table if not exists public.ai_provider_configs (
  id text primary key default 'default',
  provider text not null,
  model text not null,
  secret_reference text,
  enabled boolean not null default false,
  max_output_tokens integer not null default 800 check (max_output_tokens between 100 and 4000),
  timeout_ms integer not null default 12000 check (timeout_ms between 1000 and 60000),
  daily_budget numeric(12,2) not null default 0 check (daily_budget >= 0),
  allowed_tools jsonb not null default '["platform_summary"]',
  last_error text,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_records (
  id text primary key,
  admin_id text not null,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(12,6),
  is_estimate boolean not null default true,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id text primary key,
  severity text not null check (severity in ('INFO','WARNING','ERROR')),
  message text not null,
  audience jsonb not null default '{"role":"SUPER_ADMIN"}',
  read_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_change_events (
  id text primary key,
  actor_id text not null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists banners_public_window_idx on public.banners(status,start_at,end_at,position);
create index if not exists media_public_idx on public.media_assets(is_public,deleted_at);
create index if not exists campaigns_active_window_idx on public.campaigns(status,start_at,end_at);
create index if not exists coupon_redemptions_campaign_idx on public.coupon_redemptions(campaign_id,status,created_at);
create index if not exists admin_changes_created_idx on public.admin_change_events(created_at desc);

alter table public.cms_site_settings enable row level security;
alter table public.media_assets enable row level security;
alter table public.banners enable row level security;
alter table public.campaigns enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.platform_provider_configs enable row level security;
alter table public.ai_provider_configs enable row level security;
alter table public.ai_usage_records enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_change_events enable row level security;

-- Public content is exposed through the application delivery route, not direct table access.
-- No public policy is created for CMS/media/campaign tables. Server-side Super Admin service access
-- and application authorization are required. Shop/customer JWTs cannot read platform control data.
