-- ALIZZ STORE migration: remove deprecated Voucher, Push Notification, and Telegram admin bot tables/functions.
-- This is intentionally explicit because the features are removed from code/UI/API.

begin;

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
drop trigger if exists vouchers_touch_updated_at on public.vouchers;
drop function if exists public.increment_voucher_usage(text);

drop table if exists public.voucher_usages cascade;
drop table if exists public.vouchers cascade;
drop table if exists public.push_subscriptions cascade;
drop table if exists public.broadcast_notifications cascade;
drop table if exists public.telegram_bot_logs cascade;

commit;
