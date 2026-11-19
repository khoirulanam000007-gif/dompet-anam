import Logo from "../components/Logo";

export default function SetupNeeded() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-6 text-white">
      <div className="w-full max-w-sm rounded-2xl bg-white/10 p-6 text-center">
        <Logo className="mx-auto mb-3 h-16 w-16" />
        <h1 className="text-lg font-bold">Aplikasi belum tersambung</h1>
        <p className="mt-2 text-sm text-white/80">
          Kunci Supabase belum diisi. Buka Vercel → Settings → Environment Variables, isi
          <b> VITE_SUPABASE_URL </b> dan <b> VITE_SUPABASE_KEY</b>, lalu Redeploy.
        </p>
        <p className="mt-3 text-xs text-white/60">Langkah lengkap ada di PANDUAN_PEMBELI.md (Bagian 3).</p>
      </div>
    </div>
  );
}
