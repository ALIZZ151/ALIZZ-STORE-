ALIZZ STORE - SEO Preview + Push Notification V2

PASANG:
1. Extract ZIP.
2. Copy semua file/folder ke root project.
3. Replace file yang sama.
4. Commit + push GitHub.
5. Redeploy Vercel.

FILE PENTING:
- assets/alizz-store-preview-v2.jpg = gambar preview link WhatsApp/Telegram/Facebook.
- manifest.webmanifest = PWA metadata agar web lebih app-like.
- service-worker.js = handler push notification background.
- api/notifications/broadcast.js = broadcast push dengan TTL 24 jam dan urgency high.

TEST PREVIEW LINK:
1. Pastikan file bisa dibuka:
   https://alizz-shop.biz.id/assets/alizz-store-preview-v2.jpg
2. Kirim link ini dulu ke WhatsApp untuk paksa cache baru:
   https://alizz-shop.biz.id/?v=2
3. Setelah gambar muncul, link normal biasanya ikut kebaca setelah cache WhatsApp refresh.

TEST PUSH:
1. Buka website dengan Chrome Android, bukan browser bawaan/in-app browser.
2. Klik Izinkan Promo.
3. Pastikan Chrome punya izin notifikasi di Android Settings.
4. Jangan force stop Chrome.
5. Kirim dari bot Telegram:
   /notif Promo ALIZZ | Cek produk terbaru sekarang! | https://alizz-shop.biz.id/produk/

CATATAN:
- Web push tidak bisa memaksa notifikasi muncul kalau browser diblokir battery saver, background data dimatikan, atau Chrome di-force stop.
- Google indexing tetap harus submit sitemap di Google Search Console.
