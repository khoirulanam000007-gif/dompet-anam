import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { confirmBox, toast } from "../lib/ui";
import { restoreBackup } from "../lib/restore";
import type { Category } from "../lib/types";

const field = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";
const sha = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  async function change(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4);
    setPin(d);
    if (d.length < 4) return;
    if ((await sha(d)) === localStorage.getItem("pin")) onUnlock();
    else { setErr("PIN salah."); setPin(""); }
  }
  async function forgot() {
    if (!(await confirmBox("Keluar dari akun dan hapus PIN? Anda perlu masuk lagi dengan email dan kata sandi.", { okLabel: "Keluar" }))) return;
    localStorage.removeItem("pin");
    await supabase.auth.signOut();
    onUnlock();
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy p-5">
      <div className="w-full max-w-sm rounded-3xl bg-paper p-7 text-center">
        <h1 className="text-xl font-semibold text-navy">DOMPET ANAM</h1>
        <p className="mt-1 text-sm text-charcoal/70">Masukkan PIN 4 angka</p>
        <input className={`${field} mt-4 text-center text-2xl tracking-[0.5em]`} type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => change(e.target.value)} />
        {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
        <button onClick={forgot} className="mt-4 text-sm text-navy underline">Lupa PIN?</button>
      </div>
    </main>
  );
}

const btn = "rounded-xl bg-emerald px-4 py-2.5 font-medium text-white disabled:opacity-60";

export function NewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  async function save() {
    if (pw.length < 6) return setMsg("Kata sandi minimal 6 karakter.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setMsg("Gagal mengubah kata sandi. Minta tautan baru.");
    else onDone();
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy p-5">
      <div className="w-full max-w-sm space-y-3 rounded-3xl bg-paper p-7">
        <h1 className="text-xl font-semibold text-navy">Atur kata sandi baru</h1>
        <input className={field} type="password" placeholder="Kata sandi baru" value={pw} onChange={(e) => setPw(e.target.value)} />
        {msg && <p className="text-sm text-red-700">{msg}</p>}
        <button onClick={save} className={`${btn} w-full`}>Simpan</button>
      </div>
    </main>
  );
}

export default function Settings({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [cName, setCName] = useState("");
  const [cKind, setCKind] = useState<"expense" | "income">("expense");
  const [msg, setMsg] = useState("");
  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(!!localStorage.getItem("pin"));
  const [busy, setBusy] = useState(false);

  async function savePin() {
    if (!/^\d{4}$/.test(pin)) return setMsg("PIN harus 4 angka.");
    localStorage.setItem("pin", await sha(pin));
    setHasPin(true); setPin(""); setMsg("Kunci PIN aktif. PIN diminta setiap aplikasi dibuka.");
  }
  function removePin() { localStorage.removeItem("pin"); setHasPin(false); setMsg("Kunci PIN dimatikan."); }

  async function backup() {
    const names = ["profiles", "accounts", "categories", "savings_goals", "debts", "recurring_rules", "budgets", "transactions"];
    const out: Record<string, unknown> = { app: "DOMPET ANAM", exported_at: new Date().toISOString() };
    for (const t of names) {
      const { data, error } = await supabase.from(t).select("*");
      if (error) return setMsg("Gagal membuat cadangan. Coba lagi.");
      out[t] = data;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    a.download = `cadangan-dompet-anam-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Cadangan diunduh. Simpan file ini di tempat aman.");
  }

  async function restore(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!(await confirmBox("Pulihkan data dari file ini? Data yang sudah ada tidak dihapus. Data dari cadangan akan ditambahkan atau diperbarui.", { danger: false, okLabel: "Pulihkan" }))) return;
    setBusy(true); setMsg("Memulihkan data…");
    try { setMsg(await restoreBackup(await f.text())); toast("Data berhasil dipulihkan", "ok"); onChanged(); }
    catch (err) { setMsg(err instanceof Error ? err.message : "Gagal memulihkan. Coba lagi."); }
    setBusy(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) supabase.from("profiles").select("full_name").eq("id", data.user.id).single().then((r) => setName(r.data?.full_name ?? ""));
    });
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }
  async function saveName() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", data.user.id);
    setMsg(error ? "Gagal menyimpan nama." : "Nama tersimpan.");
  }
  async function savePw() {
    if (pw.length < 6) return setMsg("Kata sandi minimal 6 karakter.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    setMsg(error ? "Gagal mengubah kata sandi." : "Kata sandi diubah.");
    if (!error) setPw("");
  }
  async function addCat() {
    if (!cName.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: cName.trim(), kind: cKind });
    setMsg(error ? (error.code === "23505" ? "Kategori sudah ada." : "Gagal menambah kategori.") : "Kategori ditambahkan.");
    if (!error) { setCName(""); onChanged(); }
  }
  async function delCat(c: Category) {
    if (!(await confirmBox(`Hapus kategori ${c.name}?`, { okLabel: "Hapus" }))) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) toast("Kategori ini sudah dipakai transaksi atau anggaran, jadi tidak bisa dihapus.", "error");
    else onChanged();
  }

  const card = "mt-4 rounded-2xl bg-white p-4 shadow-sm";
  return (
    <section className="px-5 pb-6 pt-2">
      <div className={card}>
        <div className="flex items-center justify-between">
          <span className="font-medium">Tema gelap</span>
          <button onClick={toggleTheme} className={`h-7 w-12 rounded-full p-0.5 ${dark ? "bg-emerald" : "bg-charcoal/30"}`} aria-label="Tema gelap">
            <span className={`block h-6 w-6 rounded-full bg-white transition-transform ${dark ? "translate-x-5" : ""}`} />
          </button>
        </div>
        <p className="mt-1 text-sm text-charcoal/60">Mata uang: Rupiah (Rp)</p>
      </div>

      <div className={card}>
        <p className="font-medium">Profil</p>
        <input className={`${field} mt-2`} placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={saveName} className={`${btn} mt-2`}>Simpan nama</button>
        <input className={`${field} mt-4`} type="password" placeholder="Kata sandi baru" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button onClick={savePw} className={`${btn} mt-2`}>Ubah kata sandi</button>
      </div>

      <div className={card}>
        <p className="font-medium">Kategori</p>
        <div className="mt-2 flex gap-2">
          <input className={field} placeholder="Nama kategori baru" value={cName} onChange={(e) => setCName(e.target.value)} />
          <select className="rounded-xl border border-charcoal/15 bg-white px-2" value={cKind} onChange={(e) => setCKind(e.target.value as "income" | "expense")}>
            <option value="expense">Keluar</option>
            <option value="income">Masuk</option>
          </select>
        </div>
        <button onClick={addCat} className={`${btn} mt-2`}>Tambah kategori</button>
        {(["expense", "income"] as const).map((k) => (
          <div key={k} className="mt-3">
            <p className="text-sm text-charcoal/60">{k === "expense" ? "Pengeluaran" : "Pemasukan"}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {categories.filter((c) => c.kind === k).map((c) => (
                <button key={c.id} onClick={() => delCat(c)} className="rounded-full border border-charcoal/20 px-3 py-1 text-sm" title="Tekan untuk menghapus">{c.name} ×</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={card}>
        <p className="font-medium">Kunci PIN</p>
        <p className="text-sm text-charcoal/60">Kunci di perangkat ini saja. Bukan pengganti kata sandi akun.</p>
        {hasPin ? (
          <button onClick={removePin} className="mt-2 rounded-xl border border-red-700 px-4 py-2.5 text-red-700">Matikan PIN</button>
        ) : (
          <>
            <input className={`${field} mt-2`} type="password" inputMode="numeric" placeholder="PIN 4 angka" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            <button onClick={savePin} className={`${btn} mt-2`}>Aktifkan PIN</button>
          </>
        )}
      </div>

      <div className={card}>
        <p className="font-medium">Cadangan data</p>
        <p className="text-sm text-charcoal/60">Unduh salinan seluruh data Anda dalam satu file.</p>
        <button onClick={backup} className={`${btn} mt-2`}>Unduh cadangan</button>
        <p className="mt-4 text-sm text-charcoal/60">Pindah HP atau akun? Pulihkan data dari file cadangan. Aman diulang, tidak membuat data ganda.</p>
        <label className={`${btn} mt-2 inline-block cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          Pulihkan dari cadangan
          <input type="file" accept="application/json,.json" className="hidden" onChange={restore} disabled={busy} />
        </label>
      </div>

      {msg && <p className="mt-3 text-sm text-emerald">{msg}</p>}
      <button onClick={() => supabase.auth.signOut()} className="mt-4 w-full rounded-xl border border-red-700 py-2.5 text-red-700">Keluar dari akun</button>
    </section>
  );
}
