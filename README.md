# CrowdChek

Aplikasi web pemantau keramaian lokasi publik berbasis laporan warga. Proyek UTS Pemrograman Web B (Gasal 2026) — frontend only (HTML5, CSS3, JavaScript).

## Fitur
Dashboard · Pencarian lokasi · Laporan keramaian · Statistik keramaian (Chart.js) · Login & Register · Admin panel

## Menjalankan
Tidak perlu build. Buka `index.html` langsung, atau jalankan server statis: `python3 -m http.server 8000`.

## Akun demo
- Admin: `admin@crowdchek.id` / `admin123`
- Pengguna: `user@crowdchek.id` / `user123`

## Catatan
Data disimpan di `localStorage` (tanpa backend). Admin panel → Ringkasan → "Atur ulang data demo" untuk mengembalikan data awal.

## Deploy
GitHub Pages: Settings → Pages → Branch `main` / root. Netlify/Vercel: drag-drop folder ini.
