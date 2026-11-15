import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { confirmBox, toast } from "../lib/ui";
import { restoreBackup } from "../lib/restore";
import { getMode, setMode, clearLock, bioSupported, registerBio, verifyBio, type LockMode } from "../lib/lock";
import type { Category } from "../lib/types";
import Avatar from "../components/Avatar";
import AvatarEditor from "../components/AvatarEditor";
import { useProfile, saveAvatar, setProfileName } from "../lib/profile";

const field = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";
const sha = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const mode = getMode();
  const hasPin = !!localStorage.getItem("pin");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function bio(auto = false) {
    setBusy(true);
    setErr("");
    const ok = await verifyBio();
    setBusy(false);
    if (ok) onUnlock();
    else if (!auto) setErr(hasPin ? "Verifikasi belum berhasil. Coba lagi atau masukkan PIN." : "Verifikasi belum berhasil. Coba lagi.");
  }
  useEffect(() => { if (mode === "bio") bio(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function change(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4);
    setPin(d);
    if (d.length < 4) return;
    if ((await sha(d)) === localStorage.getItem("pin")) onUnlock();
    else { setErr("PIN salah."); setPin(""); }
  }
  async function forgot() {
    if (!(await confirmBox("Keluar dari akun dan hapus kunci aplikasi? Anda perlu masuk lagi dengan email dan kata sandi.", { okLabel: "Keluar" }))) return;
    clearLock();
    await supabase.auth.signOut();
    onUnlock();
  }
  return (
    <main className="hero flex min-h-screen items-center justify-center p-5">
      <div className="rise w-full max-w-sm rounded-3xl bg-paper p-7 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold text-lg font-bold text-navy">DA</div>
        <h1 className="mt-3 text-xl font-bold text-navy">DOMPET ANAM</h1>
        <p className="mt-1 text-sm text-charcoal/70">Aplikasi terkunci</p>
        {mode === "bio" && (
          <button onClick={() => bio()} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald py-3.5 font-semibold text-white disabled:opacity-60">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11a7 7 0 0114 0M8.5 18.5c.8-1.6 1.2-3.2 1.2-5a2.3 2.3 0 114.6 0c0 2.4-.4 4.4-1.4 6.3M12 11.2v1.3M16 20c.9-1.9 1.4-4 1.4-6.5a5.4 5.4 0 00-10.8 0c0 1.2-.1 2.2-.4 3" /></svg>
            {busy ? "Memverifikasi..." : "Buka dengan sidik jari / wajah"}
          </button>
        )}
        {hasPin && (
          <>
            <p className="mt-5 text-sm text-charcoal/70">{mode === "bio" ? "atau masukkan PIN cadangan" : "Masukkan PIN 4 angka"}</p>
            <input className={`${field} mt-2 text-center text-2xl tracking-[0.5em]`} type="password" inputMode="numeric" autoFocus={mode !== "bio"} value={pin} onChange={(e) => change(e.target.value)} />
          </>
        )}
        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
        <button onClick={forgot} className="mt-5 text-sm text-navy underline">Tidak bisa membuka? Keluar dari akun</button>
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
  const profile = useProfile();
  const [email, setEmail] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [pw, setPw] = useState("");
  const [cName, setCName] = useState("");
  const [cKind, setCKind] = useState<"expense" | "income">("expense");
  const [msg, setMsg] = useState("");
  const [pin, setPin] = useState("");
  const [lockMode, setLockMode] = useState<LockMode>(getMode());
  const [panel, setPanel] = useState<null | "pin" | "backup">(null);
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => { bioSupported().then(setBioOk); }, []);
  const [busy, setBusy] = useState(false);

  async function chooseLock(k: LockMode) {
    if (k === lockMode && k !== "pin") return;
    if (k === "none") {
      if (!(await confirmBox("Matikan kunci aplikasi? Aplikasi akan langsung terbuka tanpa PIN atau biometrik.", { okLabel: "Matikan" }))) return;
      clearLock(); setLockMode("none"); setPanel(null); toast("Kunci aplikasi dimatikan", "ok");
    } else if (k === "pin") {
      setPin(""); setPanel("pin");
    } else {
      if (await registerBio(email || name)) {
        setMode("bio"); setLockMode("bio"); setPanel("backup"); toast("Sidik jari / wajah aktif", "ok");
      } else toast("Pendaftaran dibatalkan atau tidak didukung di perangkat ini.", "error");
    }
  }
  async function savePin() {
    if (!/^\d{4}$/.test(pin)) return toast("PIN harus 4 angka.", "error");
    localStorage.setItem("pin", await sha(pin));
    if (panel === "pin") { localStorage.removeItem("bioCred"); setMode("pin"); setLockMode("pin"); }
    setPin(""); setPanel(null);
    toast(panel === "pin" ? "Kunci PIN aktif" : "PIN cadangan tersimpan", "ok");
  }

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
      if (data.user) {
        setEmail(data.user.email ?? "");
        supabase.from("profiles").select("full_name").eq("id", data.user.id).single().then((r) => setName(r.data?.full_name ?? ""));
      }
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
    if (!error) setProfileName(name.trim());
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

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return toast("Format foto harus JPG, JPEG, PNG, atau WebP.", "error");
    if (f.size > 8 * 1024 * 1024) return toast("Ukuran foto maksimal 8 MB.", "error");
    setEditFile(f);
  }
  async function removeAvatar() {
    if (!(await confirmBox("Hapus foto profil dan kembali ke avatar bawaan?", { okLabel: "Hapus" }))) return;
    if (await saveAvatar(null)) toast("Foto profil dihapus", "ok");
  }

  async function logout() {
    if (!(await confirmBox("Keluar dari akun Dompet Anam? Anda perlu masuk lagi untuk melihat data.", { okLabel: "Keluar" }))) return;
    await supabase.auth.signOut();
  }

  const card = "mt-4 rounded-2xl bg-white p-4 shadow-sm";
  return (
    <section className="px-5 pb-6 pt-2">
      {editFile && (
        <AvatarEditor
          file={editFile}
          onCancel={() => setEditFile(null)}
          onSave={async (d) => { if (await saveAvatar(d)) { toast("Foto profil tersimpan", "ok"); setEditFile(null); } }}
        />
      )}
      <div className={card}>
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatar} size={84} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">👤 Profil</p>
            <p className="truncate text-sm text-charcoal/60">{email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <button onClick={() => galRef.current?.click()} className="rounded-full bg-navy px-3 py-1.5 text-white">{profile.avatar ? "Ganti foto" : "Pilih foto"}</button>
              <button onClick={() => camRef.current?.click()} className="rounded-full bg-charcoal/10 px-3 py-1.5">📷 Kamera</button>
              {profile.avatar && <button onClick={removeAvatar} className="px-2 py-1.5 text-red-700 underline">Hapus</button>}
            </div>
          </div>
        </div>
        <input ref={galRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
        <input ref={camRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={pick} />
        <input className={`${field} mt-2`} placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={saveName} className={`${btn} mt-2`}>Simpan nama</button>
        <input className={`${field} mt-4`} type="password" placeholder="Kata sandi baru" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button onClick={savePw} className={`${btn} mt-2`}>Ubah kata sandi</button>
        <button onClick={logout} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-700 py-2.5 font-medium text-red-700">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          Keluar dari akun
        </button>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between">
          <span className="font-semibold">🌙 Tema gelap</span>
          <button onClick={toggleTheme} className={`h-7 w-12 rounded-full p-0.5 ${dark ? "bg-emerald" : "bg-charcoal/30"}`} aria-label="Tema gelap">
            <span className={`block h-6 w-6 rounded-full bg-white transition-transform ${dark ? "translate-x-5" : ""}`} />
          </button>
        </div>
        <p className="mt-1 text-sm text-charcoal/60">Mata uang: Rupiah (Rp)</p>
      </div>

      <div className={card}>
        <p className="font-semibold">🏷️ Kategori</p>
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
        <p className="font-semibold">🔒 Kunci aplikasi</p>
        <p className="text-sm text-charcoal/60">Berlaku di perangkat ini saja. Tidak menggantikan kata sandi akun.</p>
        <div className="mt-3 space-y-2">
          {([
            ["none", "Tanpa kunci", "Aplikasi langsung terbuka"],
            ["pin", "PIN 4 angka", "Masukkan PIN setiap membuka aplikasi"],
            ["bio", "Sidik jari / Wajah", bioOk ? "Memakai biometrik bawaan HP Anda" : "Belum tersedia di perangkat atau browser ini"],
          ] as const).map(([k, t, d]) => (
            <button key={k} onClick={() => chooseLock(k)} disabled={k === "bio" && !bioOk} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${lockMode === k ? "border-emerald bg-emerald/10" : "border-charcoal/15"} ${k === "bio" && !bioOk ? "opacity-50" : ""}`}>
              <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${lockMode === k ? "border-emerald bg-emerald" : "border-charcoal/40"}`} />
              <span><span className="block font-medium">{t}</span><span className="block text-xs text-charcoal/60">{d}</span></span>
            </button>
          ))}
        </div>
        {lockMode === "pin" && !panel && <button onClick={() => setPanel("pin")} className="mt-3 text-sm text-navy underline">Ganti PIN</button>}
        {lockMode === "bio" && !panel && <button onClick={() => setPanel("backup")} className="mt-3 text-sm text-navy underline">{localStorage.getItem("pin") ? "Ganti PIN cadangan" : "Tambah PIN cadangan (disarankan)"}</button>}
        {panel && (
          <div className="mt-3">
            <p className="text-sm text-charcoal/70">{panel === "pin" ? "Buat PIN 4 angka" : "PIN cadangan jika biometrik gagal (opsional)"}</p>
            <input className={`${field} mt-2`} type="password" inputMode="numeric" placeholder="PIN 4 angka" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            <div className="mt-2 flex gap-2">
              <button onClick={savePin} className={btn}>Simpan PIN</button>
              <button onClick={() => { setPanel(null); setPin(""); }} className="px-3 text-sm underline">{panel === "backup" ? "Lewati" : "Batal"}</button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-charcoal/50">Aplikasi juga terkunci lagi bila ditinggalkan lebih dari 30 detik.</p>
      </div>

      <div className={card}>
        <p className="font-semibold">💾 Cadangan data</p>
        <p className="text-sm text-charcoal/60">Unduh salinan seluruh data Anda dalam satu file.</p>
        <button onClick={backup} className={`${btn} mt-2`}>Unduh cadangan</button>
        <p className="mt-4 text-sm text-charcoal/60">Pindah HP atau akun? Pulihkan data dari file cadangan. Aman diulang, tidak membuat data ganda.</p>
        <label className={`${btn} mt-2 inline-block cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          Pulihkan dari cadangan
          <input type="file" accept="application/json,.json" className="hidden" onChange={restore} disabled={busy} />
        </label>
      </div>

      {msg && <p className="mt-3 text-sm text-emerald">{msg}</p>}
    </section>
  );
}
