import { useState } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/ui";

const field = "w-full rounded-xl border border-charcoal/15 bg-white py-3 pl-4 pr-12 text-base outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";

function Eye({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function PwField({ label, value, onChange, autoComplete, invalid }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-charcoal/80">{label}</span>
      <span className="relative block">
        <input
          className={`${field} ${invalid ? "border-red-500 focus:border-red-500 focus:ring-red-500/30" : ""}`}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-charcoal/60"
        >
          <Eye off={show} />
        </button>
      </span>
    </label>
  );
}

// Kekuatan kata sandi: 0-4
function strength(p: string) {
  let n = 0;
  if (p.length >= 8) n++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) n++;
  if (/\d/.test(p)) n++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) n++;
  return p.length < 6 ? 0 : Math.max(1, n);
}
const LEVEL = [
  { t: "Terlalu pendek", c: "#b42318" },
  { t: "Lemah", c: "#d9480f" },
  { t: "Cukup", c: "#c9a961" },
  { t: "Kuat", c: "#0f9d6b" },
  { t: "Sangat kuat", c: "#0c8a5e" },
];

export default function PasswordCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const st = strength(pw);
  const lv = LEVEL[st];
  const lenOk = pw.length >= 6;
  const matchOk = pw2.length > 0 && pw === pw2;
  const diffOk = pw.length > 0 && pw !== cur;
  const ready = cur.length > 0 && lenOk && matchOk && diffOk;

  function close() { setOpen(false); setCur(""); setPw(""); setPw2(""); setErr(""); }

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setErr("");
    // 1) pastikan kata sandi lama benar (keamanan: mencegah orang lain mengganti sandi dari HP yang terbuka)
    if (email) {
      const { error: e1 } = await supabase.auth.signInWithPassword({ email, password: cur });
      if (e1) { setBusy(false); return setErr("Kata sandi saat ini salah."); }
    }
    // 2) simpan kata sandi baru
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr("Gagal mengubah kata sandi. Periksa internet Anda lalu coba lagi.");
    toast("Kata sandi berhasil diubah", "ok");
    close();
  }

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-lg">🔑</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Keamanan akun</p>
          <p className="text-sm text-charcoal/60">Ganti kata sandi untuk menjaga akun tetap aman.</p>
        </div>
        {!open && <button onClick={() => setOpen(true)} className="shrink-0 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white">Ganti</button>}
      </div>

      {open && (
        <div className="fade-in mt-4 space-y-3 border-t border-charcoal/10 pt-4">
          <PwField label="Kata sandi saat ini" value={cur} onChange={(v) => { setCur(v); setErr(""); }} autoComplete="current-password" invalid={err.includes("saat ini")} />
          <PwField label="Kata sandi baru" value={pw} onChange={(v) => { setPw(v); setErr(""); }} autoComplete="new-password" />

          {pw.length > 0 && (
            <div>
              <div className="flex gap-1.5" aria-hidden>
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i <= st ? lv.c : "rgba(43,47,54,.15)" }} />
                ))}
              </div>
              <p className="mt-1 text-xs font-medium" style={{ color: lv.c }}>{lv.t}</p>
            </div>
          )}

          <PwField label="Ulangi kata sandi baru" value={pw2} onChange={(v) => { setPw2(v); setErr(""); }} autoComplete="new-password" invalid={pw2.length > 0 && !matchOk} />

          <ul className="space-y-1 text-xs">
            {([
              [lenOk, "Minimal 6 karakter (disarankan 8 atau lebih)"],
              [pw.length > 0 && diffOk, "Berbeda dari kata sandi saat ini"],
              [matchOk, "Kedua kata sandi baru sama"],
            ] as const).map(([ok, t]) => (
              <li key={t} className={`flex items-center gap-2 ${ok ? "text-emerald" : "text-charcoal/55"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${ok ? "bg-emerald text-white" : "bg-charcoal/15"}`}>{ok ? "✓" : ""}</span>
                {t}
              </li>
            ))}
          </ul>

          {err && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">{err}</p>}

          <div className="grid grid-cols-[1fr_1.6fr] gap-2 pt-1">
            <button onClick={close} disabled={busy} className="rounded-xl border border-charcoal/15 bg-white py-3 font-medium text-charcoal disabled:opacity-60">Batal</button>
            <button onClick={submit} disabled={!ready || busy} className="rounded-xl bg-emerald py-3 font-semibold text-white disabled:opacity-50">{busy ? "Menyimpan..." : "Simpan kata sandi"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
