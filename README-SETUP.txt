REPORTIFY v2 — BACKEND STARTER (Supabase)

TEKNOLOGI
- Frontend: HTML, CSS, JavaScript.
- Backend/database: Supabase (PostgreSQL + Auth + Row Level Security).
- Hosting frontend yang disarankan: Netlify atau Cloudflare Pages (gratis untuk mulai).
- Website ini tidak memakai service_role key di browser.

LANGKAH SETUP
1. Buat project di https://supabase.com/ (Free plan cukup untuk mulai).
2. Buka SQL Editor > New query, paste seluruh isi supabase-schema.sql, lalu Run.
3. Buka Authentication > Users > Add user. Buat email/password admin.
4. Salin UUID user admin dari daftar Users.
5. Di SQL Editor jalankan:
   insert into public.admin_users (user_id) values ('UUID_ADMIN_DI_SINI');
6. Buka Project Settings > API. Salin Project URL dan anon/public key.
7. Edit config.js:
   SUPABASE_URL: "https://....supabase.co"
   SUPABASE_ANON_KEY: "eyJ..."
   Jangan pernah memasukkan service_role/secret key.
8. Tes secara lokal lewat server lokal atau deploy folder ini ke hosting static.
9. Buka website, kirim order percobaan. Klik Login admin di footer untuk masuk dashboard.

DEPLOY GRATIS (PILIH SALAH SATU)
- Netlify: https://app.netlify.com/ -> Add new site -> Deploy manually, unggah isi folder REPORTIFY-v2.
- Cloudflare Pages: https://pages.cloudflare.com/ -> Create project -> upload assets / direct upload.
  Pastikan index.html, styles.css, app.js, dan config.js berada di root hasil deploy.

FITUR V2
- Form order menulis data ke Supabase `orders`.
- Login admin memakai Supabase Auth email/password.
- Daftar pesanan, statistik, pencarian, filter, detail, ubah status, ekspor CSV.
- RLS: publik hanya boleh INSERT order; hanya admin terdaftar boleh SELECT/UPDATE.
- `admin_users` mengontrol siapa yang dianggap admin.

BATASAN / KEAMANAN
- Belum ada upload dokumen, payment gateway, notifikasi WhatsApp otomatis, atau email notifikasi.
- Jangan simpan data sensitif yang tidak diperlukan.
- Batasi pendaftaran publik admin: buat admin manual dari Supabase Dashboard saja.
- Jangan pernah membagikan service_role key. Anon key memang dirancang untuk frontend dan dilindungi oleh RLS.
- Sebelum dipakai sungguhan, tambahkan CAPTCHA/rate limiting untuk mencegah spam, kebijakan privasi, dan uji RLS.
- Data pelanggan akan tersimpan di database online project Supabase yang Anda buat; pastikan kebijakan retensi dan aksesnya sesuai.
