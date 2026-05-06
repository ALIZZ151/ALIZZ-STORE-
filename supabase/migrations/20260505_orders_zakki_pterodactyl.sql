-- ALIZZ STORE migration: Zakki QRIS orders + encrypted Pterodactyl fulfillment
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor sebelum deploy checkout API.

create extension if not exists pgcrypto;

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

-- Backfill-safe column guards for databases that already ran older ALIZZ STORE migrations.
alter table public.orders add column if not exists public_code text;
alter table public.orders add column if not exists recovery_token_hash text;
alter table public.orders add column if not exists product_type text;
alter table public.orders add column if not exists product_name text;
alter table public.orders add column if not exists selected_plan text;
alter table public.orders add column if not exists selected_rank text;
alter table public.orders add column if not exists amount integer;
alter table public.orders add column if not exists payment_provider text default 'zakki';
alter table public.orders add column if not exists payment_status text default 'pending';
alter table public.orders add column if not exists fulfillment_status text default 'none';
alter table public.orders add column if not exists order_status text default 'pending_payment';
alter table public.orders add column if not exists zakki_id_transaksi text;
alter table public.orders add column if not exists zakki_nominal_request integer;
alter table public.orders add column if not exists zakki_kode_unik integer;
alter table public.orders add column if not exists zakki_total_bayar integer;
alter table public.orders add column if not exists zakki_qris_image text;
alter table public.orders add column if not exists zakki_qris_content text;
alter table public.orders add column if not exists zakki_expired_at timestamptz;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists fulfilled_at timestamptz;
alter table public.orders add column if not exists customer_username text;
alter table public.orders add column if not exists panel_user_id text;
alter table public.orders add column if not exists panel_server_id text;
alter table public.orders add column if not exists encrypted_panel_credentials text;
alter table public.orders add column if not exists encryption_iv text;
alter table public.orders add column if not exists encryption_auth_tag text;
alter table public.orders add column if not exists manual_note text;
alter table public.orders add column if not exists error_message text;
alter table public.orders add column if not exists created_at timestamptz default now();
alter table public.orders add column if not exists updated_at timestamptz default now();

alter table public.orders alter column payment_provider set default 'zakki';
alter table public.orders alter column payment_status set default 'pending';
alter table public.orders alter column fulfillment_status set default 'none';
alter table public.orders alter column order_status set default 'pending_payment';
alter table public.orders alter column created_at set default now();
alter table public.orders alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_public_code_key' and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_public_code_key unique (public_code);
  end if;
exception when duplicate_table then
  null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_zakki_id_transaksi_key' and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_zakki_id_transaksi_key unique (zakki_id_transaksi);
  end if;
exception when duplicate_table then
  null;
end $$;

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
create policy "orders_no_public_access"
  on public.orders
  for all
  using (false)
  with check (false);

drop policy if exists "order_events_no_public_access" on public.order_events;
create policy "order_events_no_public_access"
  on public.order_events
  for all
  using (false)
  with check (false);

drop policy if exists "payment_callbacks_no_public_access" on public.payment_callbacks;
create policy "payment_callbacks_no_public_access"
  on public.payment_callbacks
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

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

comment on table public.orders is 'ALIZZ STORE auto-order QRIS Zakki + fulfillment state. recovery_token_hash only; panel credentials encrypted with AES-256-GCM when configured.';
comment on table public.order_events is 'Audit event order; metadata must not contain token/password/API key.';
comment on table public.payment_callbacks is 'Raw payment callback storage; webhook verifies ulang ke provider before marking paid.';
