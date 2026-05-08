-- ALIZZ STORE Supabase schema V3
-- Fokus aktif: analytics, homepage settings, promo popup opsional, dan product metrics.
-- Fitur voucher, web push notification, dan Telegram bot sudah dibersihkan dari schema.

create extension if not exists pgcrypto;

-- Cleanup fitur yang sudah tidak dipakai.
drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
drop trigger if exists vouchers_touch_updated_at on public.vouchers;
drop function if exists public.increment_voucher_usage(text);
drop table if exists public.voucher_usages cascade;
drop table if exists public.vouchers cascade;
drop table if exists public.broadcast_notifications cascade;
drop table if exists public.push_subscriptions cascade;
drop table if exists public.telegram_bot_logs cascade;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  visitor_id_hash text,
  session_id_hash text,
  page_path text,
  page_url text,
  referrer text,
  product_id text,
  product_name text,
  product_category text,
  metadata jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_name_idx on public.analytics_events(event_name);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_visitor_id_hash_idx on public.analytics_events(visitor_id_hash);
create index if not exists analytics_events_product_id_idx on public.analytics_events(product_id);
create index if not exists analytics_events_event_created_idx on public.analytics_events(event_name, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_no_public_access" on public.analytics_events;
create policy "analytics_events_no_public_access"
  on public.analytics_events
  for all
  using (false)
  with check (false);

create table if not exists public.homepage_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique default 'default',
  hero_title text,
  hero_subtitle text,
  running_promo_text text,
  banner_promo_text text,
  cta_primary_text text,
  cta_primary_url text,
  cta_secondary_text text,
  cta_secondary_url text,
  whatsapp_order_number text,
  telegram_order_username text,
  testimonial_channel_url text,
  promo_popup_title text,
  promo_popup_text text,
  promo_popup_cta_text text,
  promo_popup_cta_url text,
  promo_popup_active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.homepage_settings enable row level security;

drop policy if exists "homepage_settings_no_public_access" on public.homepage_settings;
create policy "homepage_settings_no_public_access"
  on public.homepage_settings
  for all
  using (false)
  with check (false);

insert into public.homepage_settings (
  setting_key,
  hero_title,
  hero_subtitle,
  running_promo_text,
  cta_primary_text,
  cta_primary_url,
  cta_secondary_text,
  cta_secondary_url,
  whatsapp_order_number,
  telegram_order_username,
  testimonial_channel_url,
  promo_popup_title,
  promo_popup_text,
  promo_popup_cta_text,
  promo_popup_cta_url,
  promo_popup_active
) values (
  'default',
  'ALIZZ STORE',
  'Panel • Bot • Script',
  'Produk digital ALIZZ STORE siap diproses admin.',
  'Lihat Produk',
  '/produk/',
  'Tanya Asisten',
  '/chatbot/',
  '6281914401217',
  'my_bini',
  'https://whatsapp.com/channel/0029Vb89l2E2UPBAJmqZ7D0J',
  'Info ALIZZ STORE',
  'Cek koleksi panel, membership, sewa bot, dan script terbaru.',
  'Cek Produk',
  '/produk/',
  false
) on conflict (setting_key) do nothing;

create table if not exists public.promo_popups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  cta_text text,
  cta_url text,
  is_active boolean not null default false,
  start_at timestamptz,
  end_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promo_popups_active_idx on public.promo_popups(is_active);

alter table public.promo_popups enable row level security;

drop policy if exists "promo_popups_no_public_access" on public.promo_popups;
create policy "promo_popups_no_public_access"
  on public.promo_popups
  for all
  using (false)
  with check (false);

create table if not exists public.product_metrics (
  id uuid primary key default gen_random_uuid(),
  product_id text not null unique,
  product_name text,
  product_category text,
  view_count integer not null default 0,
  whatsapp_order_click_count integer not null default 0,
  telegram_order_click_count integer not null default 0,
  last_event_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_metrics_order_click_idx on public.product_metrics(whatsapp_order_click_count desc);
create index if not exists product_metrics_view_count_idx on public.product_metrics(view_count desc);

alter table public.product_metrics enable row level security;

drop policy if exists "product_metrics_no_public_access" on public.product_metrics;
create policy "product_metrics_no_public_access"
  on public.product_metrics
  for all
  using (false)
  with check (false);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists homepage_settings_touch_updated_at on public.homepage_settings;
create trigger homepage_settings_touch_updated_at
before update on public.homepage_settings
for each row execute function public.touch_updated_at();

drop trigger if exists promo_popups_touch_updated_at on public.promo_popups;
create trigger promo_popups_touch_updated_at
before update on public.promo_popups
for each row execute function public.touch_updated_at();

drop trigger if exists product_metrics_touch_updated_at on public.product_metrics;
create trigger product_metrics_touch_updated_at
before update on public.product_metrics
for each row execute function public.touch_updated_at();
