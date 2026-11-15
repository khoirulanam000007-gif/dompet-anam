import { useState } from "react";
import { supabase } from "../lib/supabase";
import { ENABLE_DEMO } from "../lib/config";
import { enterDemo } from "../lib/demo";

export default function Login() {
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function forgot() {
    if (!email.trim()) return setMsg("Isi email dulu, lalu tekan Lupa kata sandi.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setMsg(error ? "Gagal mengirim tautan. Coba lagi nanti." : "Tautan pemulihan dikirim ke email Anda.");
  }
  const [msg, setMsg] = useState("");

  async function submit() {
    setMsg("");
    if (!email.trim() || password.length < 6) {
      setMsg("Isi email dan kata sandi (minimal 6 karakter).");
      return;
    }
    setBusy(true);
    if (mode === "masuk") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg("Email atau kata sandi salah.");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Akun dibuat. Cek email Anda untuk konfirmasi, lalu masuk.");
    }
    setBusy(false);
  }

  const input =
    "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 text-base outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";

  return (
    <main className="hero flex min-h-screen flex-col items-center justify-center p-5">
      <div className="rise mb-6 text-center text-white">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold text-xl font-bold">DA</div>
        <p className="mt-3 text-sm text-white/80">Kelola uang dengan rapi, tenang, dan terarah.</p>
      </div>
      <div className="rise w-full max-w-sm rounded-3xl bg-paper p-7 shadow-xl" style={{ animationDelay: "80ms" }}>
        <h1 className="text-2xl font-semibold tracking-wide text-navy">DOMPET ANAM</h1>
        <p className="mt-1 text-sm text-charcoal/70">Catat keuangan pribadi Anda.</p>
        <div className="mt-1 h-0.5 w-10 bg-gold" />

        <div className="mt-6 space-y-3">
          {mode === "daftar" && (
            <input className={input} placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} type="password" placeholder="Kata sandi" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {msg && <p className="mt-3 text-sm text-red-700">{msg}</p>}
        {mode === "masuk" && <button onClick={forgot} className="mt-2 text-sm text-navy underline">Lupa kata sandi?</button>}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-emerald py-3 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Memproses..." : mode === "masuk" ? "Masuk" : "Buat akun"}
        </button>

        <button
          onClick={() => { setMode(mode === "masuk" ? "daftar" : "masuk"); setMsg(""); }}
          className="mt-4 w-full text-sm text-navy underline"
        >
          {mode === "masuk" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </button>

        {ENABLE_DEMO && (
          <button onClick={enterDemo} className="mt-3 w-full rounded-xl border border-gold/60 bg-gold/10 py-2.5 text-sm font-semibold text-navy">
            ✨ Coba demo tanpa daftar
          </button>
        )}
      </div>
    </main>
  );
}
