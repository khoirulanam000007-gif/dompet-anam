import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Category } from "../lib/types";

const field = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";
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
    if (!window.confirm(`Hapus kategori ${c.name}?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) window.alert("Kategori ini sudah dipakai transaksi atau anggaran, jadi tidak bisa dihapus.");
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

      {msg && <p className="mt-3 text-sm text-emerald">{msg}</p>}
      <button onClick={() => supabase.auth.signOut()} className="mt-4 w-full rounded-xl border border-red-700 py-2.5 text-red-700">Keluar dari akun</button>
    </section>
  );
}
