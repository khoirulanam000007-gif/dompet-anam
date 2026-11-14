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

## Belum
Laporan PDF/Excel, transaksi berulang, pengaturan/tema gelap, APK (PWABuilder).

## Rencana jual (pilihan: gratis, 1 salinan per pembeli)
Pembeli pakai akun GitHub/Vercel/Supabase sendiri. Perlu paket: kode tanpa kunci penjual, schema.sql, panduan. Vercel Hobby hanya non-komersial; jangan jual akses di akun Vercel Hobby milik penjual.

## Catatan
- Tipe transaksi: income, expense, transfer, saving_deposit, saving_withdraw, debt_borrow, debt_repay, loan_give, loan_receive.
- Saldo dihitung di view account_balances. Transfer/tabungan/utang bukan pemasukan/pengeluaran biasa.
- Kode belum diuji build (jaringan sandbox mati); build pertama dicek di Vercel.
