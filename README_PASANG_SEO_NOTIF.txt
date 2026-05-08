ALIZZ STORE - Catatan Update V3

Fitur notifikasi/push promo sudah dihapus dari project.
File ini dipertahankan hanya sebagai catatan migrasi agar tidak membingungkan saat deploy ulang.

Yang aktif sekarang:
- SEO dan meta preview tetap dipertahankan.
- Katalog produk memakai flow paket/group dan checkout manual WhatsApp/Telegram.
- Admin fokus ke kelola produk, import/export/reset, dan analytics aman.
- Bottom navigation mobile menggantikan hamburger/drawer.

Deploy singkat:
1. Pastikan env admin dan Supabase sesuai .env.example.
2. Deploy via Vercel/GitHub seperti biasa.
3. Cek /, /produk/, /chatbot/, dan /admin/.
4. Pastikan order WhatsApp/Telegram mengarah ke kontak order, bukan kontak developer.
