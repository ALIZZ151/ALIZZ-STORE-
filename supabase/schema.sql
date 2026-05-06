-- ALIZZ STORE Supabase schema current
-- Jalankan di Supabase SQL Editor untuk database baru.
-- Semua akses publik ditolak oleh RLS; Vercel Serverless memakai SUPABASE_SERVICE_ROLE_KEY hanya server-side.

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
create policy "analytics_events_no_public_access" on public.analytics_events for all using (false) with check (false);

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
create policy "homepage_settings_no_public_access" on public.homepage_settings for all using (false) with check (false);

insert into public.homepage_settings (
  setting_key, hero_title, hero_subtitle, running_promo_text, cta_primary_text, cta_primary_url,
  cta_secondary_text, cta_secondary_url, whatsapp_order_number, telegram_order_username,
  testimonial_channel_url, promo_popup_title, promo_popup_text, promo_popup_cta_text, promo_popup_cta_url, promo_popup_active
) values (
  'default', 'ALIZZ STORE', 'Panel • Bot • Script', 'Promo produk digital ALIZZ STORE siap diproses admin.',
  'Lihat Produk', '/produk/', 'Tanya Asisten', '/chatbot/', '6281914401217', 'my_bini',
  'https://whatsapp.com/channel/0029Vb89l2E2UPBAJmqZ7D0J', 'Promo ALIZZ STORE',
  'Mau dapet info promo panel dan produk terbaru?', 'Cek Produk', '/produk/', false
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
create policy "promo_popups_no_public_access" on public.promo_popups for all using (false) with check (false);

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
create policy "product_metrics_no_public_access" on public.product_metrics for all using (false) with check (false);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_code text unique not null,
  recovery_token_hash text not null,
  product_type text not null,
  product_name text not null,
  selected_plan text,
  selected_rank text,
  amount integer not null,
  payment_provider text default 'zakki',
  payment_status text default 'pending',
  fulfillment_status text default 'none',
  order_status text default 'pending_payment',
  zakki_id_transaksi text unique,
  zakki_nominal_request integer,
  zakki_kode_unik integer,
  zakki_total_bayar integer,
  zakki_qris_image text,
  zakki_qris_content text,
  zakki_expired_at timestamptz,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  customer_username text,
  panel_user_id text,
  panel_server_id text,
  encrypted_panel_credentials text,
  encryption_iv text,
  encryption_auth_tag text,
  manual_note text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  event_type text not null,
  message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.payment_callbacks (
  id uuid primary key default gen_random_uuid(),
  provider text default 'zakki',
  provider_transaction_id text,
  payload jsonb not null,
  verified boolean default false,
  created_at timestamptz default now()
);

create index if not exists orders_public_code_idx on public.orders(public_code);
create index if not exists orders_zakki_id_transaksi_idx on public.orders(zakki_id_transaksi);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists orders_fulfillment_status_idx on public.orders(fulfillment_status);
create index if not exists orders_order_status_idx on public.orders(order_status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_events_order_id_idx on public.order_events(order_id);
create index if not exists order_events_created_at_idx on public.order_events(created_at desc);
create index if not exists payment_callbacks_provider_transaction_idx on public.payment_callbacks(provider, provider_transaction_id);
create index if not exists payment_callbacks_created_at_idx on public.payment_callbacks(created_at desc);

alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.payment_callbacks enable row level security;

drop policy if exists "orders_no_public_access" on public.orders;
create policy "orders_no_public_access" on public.orders for all using (false) with check (false);
drop policy if exists "order_events_no_public_access" on public.order_events;
create policy "order_events_no_public_access" on public.order_events for all using (false) with check (false);
drop policy if exists "payment_callbacks_no_public_access" on public.payment_callbacks;
create policy "payment_callbacks_no_public_access" on public.payment_callbacks for all using (false) with check (false);

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
create trigger homepage_settings_touch_updated_at before update on public.homepage_settings for each row execute function public.touch_updated_at();
drop trigger if exists promo_popups_touch_updated_at on public.promo_popups;
create trigger promo_popups_touch_updated_at before update on public.promo_popups for each row execute function public.touch_updated_at();
drop trigger if exists product_metrics_touch_updated_at on public.product_metrics;
create trigger product_metrics_touch_updated_at before update on public.product_metrics for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders for each row execute function public.touch_updated_at();
