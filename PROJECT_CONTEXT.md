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
- Tahap 12: semua halaman setara Beranda: header hero dengan kartu melayang, kontrol segmented putih melayang, donut kategori, cincin progres anggaran/tabungan, nav melayang, ringkasan di header Transaksi.

## Belum
Notifikasi push, pemulihan data dari cadangan, paket jual (schema.sql + panduan), APK (PWABuilder).

## Rencana jual (pilihan: gratis, 1 salinan per pembeli)
Pembeli pakai akun GitHub/Vercel/Supabase sendiri. Perlu paket: kode tanpa kunci penjual, schema.sql, panduan. Vercel Hobby hanya non-komersial; jangan jual akses di akun Vercel Hobby milik penjual.

## Catatan
- Tipe transaksi: income, expense, transfer, saving_deposit, saving_withdraw, debt_borrow, debt_repay, loan_give, loan_receive.
- Saldo dihitung di view account_balances. Transfer/tabungan/utang bukan pemasukan/pengeluaran biasa.
- Kode belum diuji build (jaringan sandbox mati); build pertama dicek di Vercel.
