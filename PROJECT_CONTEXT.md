# DOMPET ANAM - Ringkasan Proyek
Aplikasi keuangan pribadi (React + Vite + Tailwind + Supabase), di-host di Vercel. Pemilik: pemula, tidak coding.
Aturan kerja: bahasa Indonesia sederhana, satu langkah per pesan, tunggu konfirmasi.

## Sudah selesai
- Akun GitHub, Vercel, Supabase (gratis). Proyek Supabase: dompet-anam (Seoul).
- Database: tabel + RLS + view account_balances, goal_progress, debt_status (SQL sudah dijalankan).
- Tahap 1: kerangka, login/daftar, Beranda. Deploy Vercel berhasil, akun pertama sudah dibuat, konfirmasi email dimatikan.
- Tahap 2: menu bawah (Beranda/Transaksi), form tambah/ubah/hapus pemasukan & pengeluaran, riwayat, ringkasan bulan ini.
- Kunci publik ada di src/lib/config.ts (URL + publishable key). Jangan pakai service_role.
- Tahap 3: halaman Rekening (tambah/ubah/hapus, hapus diblokir bila sudah ada transaksi), transfer antar-rekening (tidak dihitung pemasukan/pengeluaran), transfer tampil di riwayat.
- Tahap 4: menu Rencana = Anggaran bulanan (per kategori, riwayat per bulan, peringatan >=80%) + Tabungan (target, setor/tarik, riwayat).
- Tahap 5: segmen Utang di menu Rencana: catat utang/piutang (otomatis memengaruhi saldo rekening, bukan pemasukan/pengeluaran), bayar/terima sebagian, sisa, lunas, jatuh tempo, riwayat, hapus beserta pembayarannya.
- Tahap 6: PWA (manifest, ikon, service worker) di folder public/ + tag di index.html. Bisa dipasang di Android/iPhone.
- Tahap 7: menu Analisis (grafik batang minggu/bulan/tahun, per kategori, banding periode) dan menu Lainnya = Rekening + Kalender. Nav 5 tab.
- Tahap 8: tema gelap, menu Lainnya = Rekening/Kalender/Laporan (Excel CSV + cetak PDF)/Pengaturan (profil, kata sandi, kategori), transaksi berulang (Rencana > Berulang, diproses saat app dibuka, anti-ganda), Lupa kata sandi di login.
- Tahap 9: Beranda baru (hero gradien, sapaan, sembunyikan saldo, filter periode hari/minggu/bulan/tahun/tanggal, grafik 7 hari, kondisi keuangan, aksi cepat, ringkasan anggaran/tabungan/utang/piutang), animasi halus, ikon menu.
- Tahap 10: skor keuangan (0-100) + streak, pengingat jatuh tempo utang, panduan awal, pencarian/filter transaksi, kunci PIN (lokal), cadangan data JSON.
- Tahap 11: desain premium merata: font Plus Jakarta Sans, header berwarna tiap halaman, ikon kategori, transaksi dikelompokkan per tanggal, kartu rekening bergradien, tren saldo 30 hari, login baru, tombol gradien, nav kaca.
- Tahap 13: Pengaturan > Pulihkan dari cadangan (file JSON dari Unduh cadangan; kategori dipetakan berdasarkan nama+jenis, data tidak dihapus, aman diulang karena upsert per id; kode di src/lib/restore.ts) + kartu Beranda "Pengeluaran terbesar bulan ini" (3 kategori teratas).
- Tahap 14 (fokus premium): dialog konfirmasi elegan + toast (src/lib/ui.tsx) menggantikan semua window.confirm/alert, toast sukses saat simpan; form naik dari bawah dengan latar blur; skeleton loading Beranda; angka saldo bergerak halus (src/lib/anim.ts); kartu Beranda "Pengeluaran terbesar" + chip banding bulan lalu (periode sama); Rencana > Tabungan: cincin progres + estimasi setoran per bulan + pesan target tercapai; Analisis: diagram donut kategori; getar halus saat tombol ditekan; detail CSS (seleksi emas, fokus, kurangi-gerakan).
- Tahap 15: diagram donut baru (src/components/Donut.tsx): interaktif (ketuk segmen/baris untuk menyorot, info di tengah), segmen bergradien dengan jeda, animasi tergambar, toggle Keluar/Masuk di Analisis, rupiahShort di format.ts; kartu Beranda "Proyeksi bulan ini" (rata-rata harian, perkiraan akhir bulan, batas aman per hari dari anggaran atau pemasukan); form transaksi: chip "Pakai ulang transaksi terakhir" (4 unik, mengisi nominal/rekening/kategori/catatan).
- Tahap 16: desain halaman dalam disamakan dengan Beranda: header hero dengan konten melayang (page-hero), kontrol segmented putih melayang, nav melayang berbentuk pil, ringkasan Masuk/Keluar di header Transaksi, cincin progres berwarna di anggaran, hari ini diberi lingkaran di Kalender, judul Pengaturan berikon. Hanya menambah di atas Tahap 13-15 (tidak mengganti donut/toast/animasi).
- Tahap 17: Beranda tanpa daftar transaksi terbaru (riwayat hanya di menu Transaksi); foto profil: pilih dari galeri/kamera, potong+geser+zoom+pratinjau (src/components/AvatarEditor.tsx), kompres 256x256 WebP/JPEG, disimpan di kolom profiles.avatar (butuh SQL: alter table profiles add column avatar text + check ukuran), avatar bundar + avatar bawaan (Avatar.tsx), store profil bersama (src/lib/profile.ts) dipakai Beranda & Pengaturan.
- Tahap 18: header atas (DOMPET ANAM + Keluar) dihapus; hero/PageHeader memanjang ke tepi atas dengan padding safe-area (status bar HP); nav & tombol + juga memakai safe-area bawah; Keluar dipindah ke Lainnya > Pengaturan > kartu Profil (kartu Profil kini paling atas), berikon + dialog konfirmasi.
- Tahap 19: perbaikan tema gelap (akar masalah: --color-white ikut diganti sehingga text-white jadi gelap; sekarang pakai --surface untuk latar kartu, text-white tetap putih; kontras chip emas/merah/hijau); kunci aplikasi 3 pilihan: tanpa kunci / PIN / sidik jari-wajah (WebAuthn platform, src/lib/lock.ts, LockScreen baru) + PIN cadangan opsional + kunci ulang setelah 30 detik di latar belakang. Belum diuji di perangkat nyata.
- Tahap 20 (siap jual): (1) riwayat transaksi tanpa batas 200: muat bertahap 200 per kali (keyset lte + dedupe), muat otomatis saat gulir, pencarian/filter memuat seluruh riwayat dulu (src/pages/Transactions.tsx). (2) Mode Demo: tombol "Coba demo tanpa daftar" di Login; database tiruan di memori dengan data contoh relatif hari ini, saldo tak pernah negatif (src/lib/demo.ts; supabase.ts dialihkan lewat Proxy bila sessionStorage dompetDemo=1; pita \"MODE DEMO\" + Keluar; ENABLE_DEMO di config.ts). (3) Offline: respons GET database/akun disimpan di Cache Storage dan dipakai saat internet putus, dibersihkan saat keluar akun (src/lib/offline.ts); pita Offline; ajakan Pasang aplikasi (Android tombol Pasang, iPhone petunjuk; tunda 7 hari) di src/lib/install.ts + components/InstallPrompt.tsx. (4) Halaman Analisis/Rencana/Lainnya dipecah (lazy) + diunduh diam-diam agar tersedia offline; chunk utama 456 kB. Tanpa SQL tambahan. Paket jual dibangun ulang dari kode ini (schema.sql kini punya kolom avatar).

## Belum
Paket jual (folder terpisah, dibangun ulang tiap beberapa tahap; terakhir dari Tahap 20): perlu uji coba di Supabase + Vercel baru. Biometrik/ajakan pasang belum diuji di perangkat nyata. Ide berikut: impor CSV/Excel, kategori kustom (ikon+warna), aset/kekayaan bersih, foto struk+label, berbagi dompet, halaman landing + kebijakan privasi, white-label (brand.ts), notifikasi push, APK (PWABuilder).

## Rencana jual (pilihan: gratis, 1 salinan per pembeli)
Pembeli pakai akun GitHub/Vercel/Supabase sendiri. Perlu paket: kode tanpa kunci penjual, schema.sql, panduan. Vercel Hobby hanya non-komersial; jangan jual akses di akun Vercel Hobby milik penjual.

## Catatan
- Tipe transaksi: income, expense, transfer, saving_deposit, saving_withdraw, debt_borrow, debt_repay, loan_give, loan_receive.
- Saldo dihitung di view account_balances. Transfer/tabungan/utang bukan pemasukan/pengeluaran biasa.
- Kode belum diuji build (jaringan sandbox mati); build pertama dicek di Vercel.
