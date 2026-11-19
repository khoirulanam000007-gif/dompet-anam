# DOMPET PRO — Panduan Pemasangan

Aplikasi keuangan pribadi (bisa dipasang di HP seperti aplikasi biasa). Datanya disimpan di akun Supabase **milik Anda sendiri**, jadi hanya Anda yang memilikinya.
Waktu pemasangan: sekitar 30–45 menit. Tidak perlu bisa coding, cukup ikuti urutan di bawah. Tampilan menu di Supabase/Vercel/GitHub kadang sedikit berbeda dari tulisan di sini, tetapi namanya mirip.

**Semua akun di bawah gratis.**

---

## Bagian 1 — Siapkan 3 akun
1. **GitHub** — daftar di github.com
2. **Supabase** (database) — daftar di supabase.com (bisa masuk dengan akun GitHub)
3. **Vercel** (tempat aplikasi tayang) — daftar di vercel.com, pilih *Continue with GitHub*

## Bagian 2 — Siapkan database (Supabase)
1. Di Supabase, klik **New project**. Isi nama (misalnya `dompet-pro`), buat **Database Password** lalu simpan, pilih wilayah terdekat (misalnya Singapore), klik **Create new project**. Tunggu 1–2 menit sampai selesai.
2. Di menu kiri pilih **SQL Editor** → **New query**.
3. Buka file `supabase/schema.sql` dari paket ini, **salin seluruh isinya**, tempel di SQL Editor, lalu klik **Run**.
   Berhasil jika muncul tulisan *Success. No rows returned*. Skema ini sudah mencakup kolom foto profil, jadi tidak ada SQL tambahan.
4. (Disarankan) Matikan konfirmasi email agar pendaftaran langsung bisa masuk: menu **Authentication** → **Sign In / Providers** → **Email** → matikan **Confirm email** → **Save**.

## Bagian 3 — Ambil 2 kunci
1. Di Supabase, buka **Project Settings** → **API Keys** (atau **Data API**).
2. Catat dua hal ini:
   - **Project URL** — bentuknya `https://xxxx.supabase.co`
   - **Publishable key** — bentuknya `sb_publishable_...` (pada tampilan lama namanya **anon public**; keduanya bisa dipakai)
3. ⚠️ Jangan pernah memakai atau membagikan kunci bernama **secret** atau **service_role**.

## Bagian 4 — Unggah ke GitHub
1. Ekstrak (*Extract All*) file zip paket ini sampai terlihat folder `src`, `public`, `supabase`, file `index.html`, `package.json`, dan lainnya.
2. Di GitHub klik **New repository**, beri nama `dompet-pro`, pilih **Private**, klik **Create repository**.
3. Klik **uploading an existing file**. Pilih **semua isi folder hasil ekstrak** (bukan file zip-nya) lalu seret ke halaman GitHub.
4. Tunggu semua file naik, lalu klik **Commit changes**.

## Bagian 5 — Tayangkan lewat Vercel
1. Di Vercel klik **Add New… → Project**, pilih repositori `dompet-pro`, klik **Import**.
2. Sebelum menekan Deploy, buka bagian **Environment Variables** dan isi dua baris:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL dari Bagian 3 |
   | `VITE_SUPABASE_KEY` | Publishable key dari Bagian 3 |
   | `VITE_ENABLE_DEMO` *(opsional)* | `false` jika Anda ingin menyembunyikan tombol "Coba demo tanpa daftar" |

3. Klik **Deploy**. Tunggu 1–2 menit sampai muncul tampilan selamat, lalu klik gambar aplikasinya untuk membuka alamatnya (`https://....vercel.app`).

## Bagian 6 — Sambungkan alamat (agar "Lupa kata sandi" berfungsi)
1. Salin alamat aplikasi Anda dari Vercel.
2. Di Supabase: **Authentication** → **URL Configuration** → isi **Site URL** dengan alamat itu → **Save**.

## Bagian 7 — Mulai memakai
1. Buka alamat aplikasi. Ingin melihat-lihat dulu? Tekan **✨ Coba demo tanpa daftar** (data contoh, tidak disimpan). Untuk memakai sungguhan, pilih **Daftar**, isi nama, email, dan kata sandi.
2. Ikuti panduan awal di aplikasi: buat rekening pertama, lalu catat transaksi.
3. **Pasang di HP:** Android (Chrome) — menu ⋮ → *Install app / Tambahkan ke layar utama*. iPhone (Safari) — tombol Bagikan → *Tambah ke Layar Utama*.

---

## Hal yang bisa Anda andalkan
- **Tetap bisa dibaca saat offline.** Data terakhir yang pernah dibuka tetap tampil tanpa internet (ada tanda "Offline" di atas layar). Mencatat atau mengubah transaksi tetap butuh internet.
- **Riwayat tanpa batas.** Menu Transaksi memuat bertahap saat digulir, dan pencarian menjangkau seluruh riwayat.
- **Ajakan pasang aplikasi** muncul otomatis beberapa detik setelah masuk (Android: tombol Pasang; iPhone: petunjuk singkat).
- **Kunci aplikasi** (PIN atau sidik jari/wajah) hanyalah kunci layar di perangkat, bukan enkripsi data.

## Masalah yang sering terjadi
- **Muncul tulisan "Aplikasi belum tersambung"** → dua Environment Variables di Bagian 5 belum diisi atau salah ketik. Perbaiki di Vercel → Settings → Environment Variables, lalu buka tab **Deployments** → titik tiga pada deploy terakhir → **Redeploy**.
- **Tidak bisa daftar/masuk** → pastikan `schema.sql` sudah dijalankan sampai *Success*, dan Project URL/key diambil dari proyek Supabase yang sama.
- **Tampilan lama setelah pembaruan** → muat ulang paksa (Ctrl+Shift+R di komputer; di HP tutup lalu buka lagi aplikasinya).
- **Lupa kata sandi** → pakai tautan *Lupa kata sandi* di halaman masuk (perlu Bagian 6).

## Catatan penting
- Data Anda aman di akun Supabase milik Anda. Rutin gunakan **Unduh cadangan** di menu Lainnya → Pengaturan. Jika pindah HP atau akun, masuk lalu pakai **Pulihkan dari cadangan** dan pilih file cadangan tadi (aman diulang, tidak membuat data ganda).
- Paket Gratis Supabase menjeda proyek yang tidak dipakai lebih dari 1 minggu. Kalau itu terjadi, buka dashboard Supabase lalu klik **Restore/Resume**, datanya tetap ada.
- Vercel paket gratis (Hobby) ditujukan untuk pemakaian pribadi. Untuk dipakai usaha atau dijual kembali, gunakan paket berbayar Vercel.
