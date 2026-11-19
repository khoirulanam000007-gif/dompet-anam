// Kunci diisi lewat Environment Variables (Vercel) atau file .env.local — bukan ditulis di kode.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_KEY as string | undefined)?.trim();
export const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY);

// Tombol "Coba demo tanpa daftar" di halaman masuk. Isi VITE_ENABLE_DEMO=false untuk menyembunyikannya.
export const ENABLE_DEMO = (import.meta.env.VITE_ENABLE_DEMO as string | undefined) !== "false";
