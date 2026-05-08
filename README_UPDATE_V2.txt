ALIZZ STORE - Update V3 Cleanup

Update V3 membersihkan fitur lama yang tidak dipakai:
- Voucher/kode promo.
- Web push notification dan popup izin promo.
- Telegram bot/webhook.

Kontak yang tetap dipakai:
- WhatsApp order: 6281914401217
- Telegram order: @my_bini
- DANA: 085943502869
- WhatsApp developer/bug: 6285943502869
- Telegram developer: @Lizz12087

Catatan:
- Telegram order biasa tetap ada sebagai link kontak.
- service-worker.js sekarang no-op supaya tidak ada handler promo/background lama.
- Jalankan supabase/schema.sql hanya jika memang ingin menerapkan schema V3 dan membersihkan tabel fitur lama.
