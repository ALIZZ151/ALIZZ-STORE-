-- ALIZZ STORE Supabase schema PHASE 1
-- Jalankan di Supabase SQL Editor.
-- Catatan keamanan:
-- 1. Semua tabel memakai RLS.
-- 2. Frontend publik tidak diberi akses tulis langsung.
-- 3. API Vercel memakai SUPABASE_SERVICE_ROLE_KEY di server-side saja.

create extension if not exists pgcrypto;

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

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  content_encoding text not null default 'aes128gcm',
  visitor_id_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_active_idx on public.push_subscriptions(is_active);
create index if not exists push_subscriptions_created_at_idx on public.push_subscriptions(created_at desc);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_no_public_access" on public.push_subscriptions;
create policy "push_subscriptions_no_public_access"
  on public.push_subscriptions
  for all
  using (false)
  with check (false);

create table if not exists public.broadcast_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_url text not null default '/produk/',
  icon_url text,
  image_url text,
  source text not null default 'admin',
  metadata jsonb not null default '{}'::jsonb,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists broadcast_notifications_created_at_idx on public.broadcast_notifications(created_at desc);

alter table public.broadcast_notifications enable row level security;

drop policy if exists "broadcast_notifications_no_public_access" on public.broadcast_notifications;
create policy "broadcast_notifications_no_public_access"
  on public.broadcast_notifications
  for all
  using (false)
  with check (false);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent', 'fixed')),
  value numeric(12,2) not null check (value > 0),
  max_uses integer,
  used_count integer not null default 0,
  min_order numeric(14,2) not null default 0,
  product_scope text not null default 'all' check (product_scope in ('all', 'category', 'product')),
  scope_value text,
  start_at timestamptz not null default now(),
  end_at timestamptz,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vouchers_code_idx on public.vouchers(code);
create index if not exists vouchers_active_idx on public.vouchers(is_active);
create index if not exists vouchers_end_at_idx on public.vouchers(end_at);

alter table public.vouchers enable row level security;

drop policy if exists "vouchers_no_public_access" on public.vouchers;
create policy "vouchers_no_public_access"
  on public.vouchers
  for all
  using (false)
  with check (false);

create table if not exists public.voucher_usages (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid references public.vouchers(id) on delete set null,
  voucher_code text not null,
  visitor_id_hash text,
  product_id text,
  product_name text,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total_after_discount numeric(14,2) not null default 0,
  status text not null default 'validated',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists voucher_usages_voucher_id_idx on public.voucher_usages(voucher_id);
create index if not exists voucher_usages_voucher_code_idx on public.voucher_usages(voucher_code);
create index if not exists voucher_usages_created_at_idx on public.voucher_usages(created_at desc);

alter table public.voucher_usages enable row level security;

drop policy if exists "voucher_usages_no_public_access" on public.voucher_usages;
create policy "voucher_usages_no_public_access"
  on public.voucher_usages
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
  'Promo produk digital ALIZZ STORE siap diproses admin.',
  'Lihat Produk',
  '/produk/',
  'Tanya Asisten',
  '/chatbot/',
  '6281914401217',
  'my_bini',
  'https://whatsapp.com/channel/0029Vb89l2E2UPBAJmqZ7D0J',
  'Promo ALIZZ STORE',
  'Mau dapet info promo panel dan produk terbaru?',
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

create table if not exists public.telegram_bot_logs (
  id uuid primary key default gen_random_uuid(),
  chat_id text,
  command text,
  message_text text,
  status text,
  response_text text,
  created_at timestamptz not null default now()
);

create index if not exists telegram_bot_logs_created_at_idx on public.telegram_bot_logs(created_at desc);
create index if not exists telegram_bot_logs_chat_id_idx on public.telegram_bot_logs(chat_id);

alter table public.telegram_bot_logs enable row level security;

drop policy if exists "telegram_bot_logs_no_public_access" on public.telegram_bot_logs;
create policy "telegram_bot_logs_no_public_access"
  on public.telegram_bot_logs
  for all
  using (false)
  with check (false);

create or replace function public.increment_voucher_usage(voucher_code_input text)
returns void
language plpgsql
security definer
as $$
begin
  update public.vouchers
  set used_count = used_count + 1,
      updated_at = now()
  where code = upper(voucher_code_input);
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

drop trigger if exists vouchers_touch_updated_at on public.vouchers;
create trigger vouchers_touch_updated_at
before update on public.vouchers
for each row execute function public.touch_updated_at();

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