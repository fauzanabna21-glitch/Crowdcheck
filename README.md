# CrowdChek

Aplikasi web pemantau keramaian lokasi publik berbasis laporan warga. Proyek UTS Pemrograman Web B (Gasal 2026).

Frontend: HTML5, CSS3, JavaScript (tanpa build). Database & login: **Supabase**. Hosting: **Vercel** (atau GitHub Pages).

Laporan yang dikirim pengguna disimpan di database online, sehingga **admin dapat melihat dan memoderasi semua laporan** dari perangkat mana pun.

## Fitur
Realtime (laporan baru langsung muncul di admin & dashboard) · Dashboard · Pencarian lokasi · Laporan keramaian · Statistik (Chart.js) · Login & Daftar · Admin panel (ringkasan, lokasi, moderasi laporan, pengguna)

## Setup (sekali saja)

### 1. Buat project Supabase
1. Daftar di https://supabase.com, klik **New project**.
2. Buka **SQL Editor → New query**, tempel seluruh isi `supabase/schema.sql`, klik **Run**.
   Ini membuat tabel, aturan keamanan (RLS), dan data lokasi awal.
3. Buka **Authentication → Providers → Email**, matikan **Confirm email** (agar pengguna bisa langsung masuk setelah daftar). Opsional kalau kamu mau verifikasi email.

> **Sudah pernah menjalankan `schema.sql` versi lama?** Jalankan `supabase/realtime.sql` sekali di SQL Editor untuk mengaktifkan Realtime.
> (Atau di Dashboard: **Database → Replication → supabase_realtime** → aktifkan tabel `reports` dan `profiles`.)

### 2. Isi konfigurasi
Buka **Project Settings → API**, lalu isi `js/config.js`:
```js
window.CC_CONFIG = {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...'   // anon public / publishable key
};
```
Kunci ini memang publik (keamanan data dijaga oleh RLS). **Jangan** memakai `service_role` key.

### 3. Buat akun admin
1. Buka situs → **Daftar** dengan email admin yang kamu inginkan.
2. Di Supabase **SQL Editor**, jalankan (ganti emailnya):
   ```sql
   update public.profiles set role = 'admin' where email = 'EMAIL_ADMIN_KAMU';
   ```
3. Keluar lalu masuk lagi. Menu **Admin** akan muncul.

Setelah ada satu admin, admin lain bisa dipromosikan dari **Admin → Pengguna**.

## Menjalankan di localhost
Jalankan server statis dari folder proyek:
```
python -m http.server 8000
```
lalu buka http://localhost:8000/login.html. (Atau pakai Live Server di VS Code / XAMPP.)

## Deploy ke Vercel
1. Push ke GitHub.
2. Vercel → **Add New → Project** → import repo ini.
3. Framework Preset: **Other**; Build Command dan Output Directory dikosongkan → **Deploy**.

Setiap `git push` ke `main` akan memperbarui situs otomatis.

## Realtime
Saat pengguna mengirim laporan, admin (halaman **Admin**) dan **Dashboard** menerimanya seketika lewat Supabase Realtime (WebSocket), tanpa refresh. Di Admin muncul notifikasi, baris baru disorot, dan ada indikator "Realtime aktif". Jika koneksi putus, aplikasi menyambung ulang otomatis dan memuat data terbaru; polling tiap 15–60 detik jadi cadangan. Hak akses tetap mengikuti RLS.

## Keamanan
- Password disimpan & di-hash oleh Supabase Auth; tidak ada kredensial di kode.
- Peran (`user`/`admin`) hanya bisa diubah admin; pendaftaran selalu menghasilkan `user`.
- Pengguna biasa hanya bisa **menambah** laporan; hanya admin yang bisa menyembunyikan/menghapus laporan, mengelola lokasi, dan melihat daftar pengguna.
- Nama pelapor dan waktu laporan diisi oleh server (tidak bisa dipalsukan); batas 1 laporan per lokasi per 10 menit dicek di server.

## Struktur
- `js/config.js` — URL & kunci publik Supabase
- `js/store.js` — lapisan data (Supabase REST/Auth/Realtime) + logika keramaian
- `js/ui.js` — komponen antarmuka bersama
- `js/auth.js`, `dashboard.js`, `report.js`, `search.js`, `stats.js`, `admin.js` — logika per halaman
- `supabase/schema.sql` — skema database, RLS, dan data awal
