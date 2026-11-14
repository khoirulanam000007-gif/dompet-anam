# DOMPET ANAM - Ringkasan Proyek
Aplikasi keuangan pribadi (React + Vite + Tailwind + Supabase), di-host di Vercel. Pemilik: pemula, tidak coding.
Aturan kerja: bahasa Indonesia sederhana, satu langkah per pesan, tunggu konfirmasi.

## Sudah selesai
- Akun GitHub, Vercel, Supabase (gratis). Proyek Supabase: dompet-anam (Seoul).
- Database: tabel + RLS + view account_balances, goal_progress, debt_status (SQL sudah dijalankan).
- Tahap 1 kode: kerangka proyek, login/daftar, Beranda (total saldo + daftar rekening).
- Kunci publik ada di src/lib/config.ts (URL + publishable key). Jangan pakai service_role.

## Belum
Form pemasukan/pengeluaran, riwayat, rekening, transfer, anggaran, tabungan, utang-piutang,
kalender, analisis, laporan PDF/Excel, transaksi berulang, pengaturan/tema gelap, PWA, APK.

## Catatan
- Tipe transaksi: income, expense, transfer, saving_deposit, saving_withdraw, debt_borrow, debt_repay, loan_give, loan_receive.
- Saldo dihitung di view account_balances. Transfer/tabungan/utang bukan pemasukan/pengeluaran biasa.
- Kode belum diuji build (jaringan sandbox mati); build pertama dicek di Vercel.
