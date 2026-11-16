import { useState } from "react";
import { Logo } from "./Logo";
import { supabase } from "../lib/supabase";
import { confirmBox, toast } from "../lib/ui";
import { rupiah } from "../lib/format";
import { ACC_ICON } from "../lib/icons";
import { markOnboarded } from "../lib/profile";

type Acc = { name: string; type: string; balance: number };
type Props = { initialName: string; onFinish: () => void };

const PRESETS: { type: string; label: string; example: string }[] = [
  { type: "cash", label: "Tunai", example: "Dompet Tunai" },
  { type: "bank", label: "Bank", example: "Bank BCA" },
  { type: "ewallet", label: "E-wallet", example: "GoPay" },
  { type: "other", label: "Lainnya", example: "Rekening Lain" },
];
const field = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 text-base outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";

// Panduan awal untuk pengguna baru: nama, rekening, saldo awal. Tampil sekali (ditandai profiles.onboarded_at).
export default function Onboarding({ initialName, onFinish }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [accs, setAccs] = useState<Acc[]>([]);
  const [type, setType] = useState("cash");
  const [accName, setAccName] = useState("Dompet Tunai");
  const [digits, setDigits] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const total = accs.reduce((s, a) => s + a.balance, 0);

  function choose(p: (typeof PRESETS)[number]) { setType(p.type); setAccName(p.example); setErr(""); }

  // Menambahkan isian saat ini ke daftar. Mengembalikan daftar terbaru atau null bila isian tidak valid.
  function commit(): Acc[] | null {
    const n = accName.trim();
    if (!n) { setErr("Isi nama rekening."); return null; }
    if (accs.some((a) => a.name.toLowerCase() === n.toLowerCase())) { setErr("Nama rekening itu sudah ditambahkan."); return null; }
    const next = [...accs, { name: n, type, balance: Number(digits || 0) }];
    setAccs(next); setErr("");
    return next;
  }
  function addAnother() {
    if (!commit()) return;
    setAccName(""); setDigits(""); setType("bank");
  }

  function next() {
    setErr("");
    if (step === 0) {
      if (!name.trim()) return setErr("Isi nama Anda dulu.");
      return setStep(1);
    }
    if (step === 1) {
      // Isian yang belum ditekan "Tambah" ikut disimpan otomatis.
      if (accName.trim() || accs.length === 0) { if (!commit()) return; }
      return setStep(2);
    }
  }

  async function finish() {
    if (busy) return;
    setBusy(true); setErr("");
    if (accs.length) {
      const { error } = await supabase.from("accounts").insert(accs.map((a) => ({ name: a.name, type: a.type, initial_balance: a.balance })));
      if (error) { setBusy(false); return setErr("Rekening gagal disimpan. Periksa internet Anda lalu coba lagi."); }
    }
    const ok = await markOnboarded(name);
    setBusy(false);
    if (!ok) toast("Rekening tersimpan, tetapi penanda panduan gagal diperbarui.", "info");
    toast(`Selamat datang, ${name.trim().split(" ")[0]}!`, "ok");
    onFinish();
  }

  async function skip() {
    if (!(await confirmBox("Lewati panduan awal? Anda tetap bisa menambah rekening nanti di Lainnya > Rekening.", { danger: false, okLabel: "Lewati" }))) return;
    setBusy(true);
    await markOnboarded(name);
    setBusy(false);
    onFinish();
  }

  return (
    <main className="hero flex min-h-[100dvh] flex-col items-center justify-center px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="mb-4 flex items-center gap-2" aria-label={`Langkah ${step + 1} dari 3`}>
        {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-gold" : i < step ? "w-4 bg-gold/70" : "w-4 bg-white/30"}`} />)}
      </div>

      <div key={step} className="rise w-full max-w-sm rounded-3xl bg-paper p-6 shadow-xl">
        {step === 0 && (
          <>
            <Logo size={64} className="mx-auto" />
            <h1 className="mt-3 text-center text-2xl font-extrabold text-navy">Selamat datang!</h1>
            <p className="mt-1 text-center text-sm text-charcoal/70">Mari siapkan DompetPro dalam 2 langkah singkat. Tidak sampai satu menit.</p>
            <label className="mt-5 block">
              <span className="mb-1 block text-sm font-medium text-charcoal/80">Siapa nama Anda?</span>
              <input className={field} placeholder="Nama panggilan" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && next()} autoFocus />
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-xl font-extrabold text-navy">Rekening pertama Anda</h1>
            <p className="mt-1 text-sm text-charcoal/70">Tempat uang Anda berada, misalnya dompet, bank, atau e-wallet. Isi saldo yang ada sekarang.</p>

            {accs.length > 0 && (
              <ul className="mt-3 space-y-2">
                {accs.map((a, i) => (
                  <li key={a.name} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm">
                    <span className="text-xl">{ACC_ICON[a.type] ?? "💳"}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.name}</span><span className="block text-xs text-charcoal/60">{rupiah(a.balance)}</span></span>
                    <button onClick={() => setAccs(accs.filter((_, k) => k !== i))} aria-label={`Hapus ${a.name}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal/10 text-base leading-none">×</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.type} onClick={() => choose(p)} className={`rounded-xl border py-2 text-center text-xs font-medium ${type === p.type ? "border-emerald bg-emerald/10" : "border-charcoal/15 bg-white"}`}>
                  <span className="block text-lg leading-none">{ACC_ICON[p.type]}</span>{p.label}
                </button>
              ))}
            </div>
            <input className={`${field} mt-3`} placeholder="Nama rekening" value={accName} onChange={(e) => { setAccName(e.target.value); setErr(""); }} />
            <input className={`${field} mt-2`} inputMode="numeric" placeholder="Saldo saat ini (Rp)" value={digits ? Number(digits).toLocaleString("id-ID") : ""} onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 12))} />
            <button onClick={addAnother} className="mt-2 w-full rounded-xl border border-dashed border-charcoal/30 py-2 text-sm font-medium text-navy">+ Tambah rekening lain</button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald/15 text-2xl">🎉</div>
            <h1 className="mt-3 text-center text-xl font-extrabold text-navy">Siap, {name.trim().split(" ")[0]}!</h1>
            <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-xs text-charcoal/60">Total saldo awal</p>
              <p className="text-2xl font-extrabold text-navy">{rupiah(total)}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {accs.map((a) => <li key={a.name} className="flex justify-between"><span>{ACC_ICON[a.type] ?? "💳"} {a.name}</span><span className="font-medium">{rupiah(a.balance)}</span></li>)}
              </ul>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-charcoal/80">
              <li>➕ Tekan tombol <b>+</b> untuk mencatat pemasukan atau pengeluaran.</li>
              <li>🎯 Buat anggaran dan target tabungan di menu <b>Rencana</b>.</li>
              <li>🔔 Aktifkan pengingat di <b>Lainnya &gt; Pengaturan</b>.</li>
            </ul>
          </>
        )}

        {err && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="mt-5 grid grid-cols-[1fr_1.6fr] gap-2">
          {step > 0 ? <button onClick={() => { setErr(""); setStep(step - 1); }} disabled={busy} className="rounded-xl border border-charcoal/15 bg-white py-3 font-medium text-charcoal disabled:opacity-60">Kembali</button> : <span />}
          {step < 2 ? (
            <button onClick={next} className="rounded-xl bg-emerald py-3 font-semibold text-white">Lanjut</button>
          ) : (
            <button onClick={finish} disabled={busy} className="rounded-xl bg-emerald py-3 font-semibold text-white disabled:opacity-60">{busy ? "Menyiapkan..." : "Mulai pakai"}</button>
          )}
        </div>
        {step < 2 && <button onClick={skip} disabled={busy} className="mt-3 w-full text-center text-sm text-charcoal/60 underline">Lewati dulu</button>}
      </div>
    </main>
  );
}
