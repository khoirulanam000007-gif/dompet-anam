import { useState } from "react";
import { supabase } from "../lib/supabase";
import { rupiah } from "../lib/format";
import type { Account } from "../lib/types";

const TYPES: Record<string, string> = {
  cash: "Uang tunai",
  bank: "Rekening bank",
  ewallet: "E-wallet",
  other: "Rekening lainnya",
};

type Props = { accounts: Account[]; onChanged: () => void; onTransfer: () => void };

export default function Accounts({ accounts, onChanged, onTransfer }: Props) {
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [digits, setDigits] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";

  function open(a: Account | "new") {
    setErr("");
    setEditing(a);
    if (a === "new") { setName(""); setType("bank"); setDigits(""); }
    else { setName(a.name); setType(a.type); setDigits(""); }
  }

  async function save() {
    if (!name.trim()) return setErr("Isi nama rekening.");
    setBusy(true);
    const base = { name: name.trim(), type };
    const q =
      editing === "new"
        ? supabase.from("accounts").insert({ ...base, initial_balance: Number(digits || 0) })
        : supabase.from("accounts").update(base).eq("id", (editing as Account).id);
    const { error } = await q;
    setBusy(false);
    if (error) return setErr("Gagal menyimpan. Coba lagi.");
    setEditing(null);
    onChanged();
  }

  async function remove(a: Account) {
    if (!window.confirm(`Hapus rekening ${a.name}?`)) return;
    const { error } = await supabase.from("accounts").delete().eq("id", a.id);
    if (error) window.alert("Rekening ini sudah punya transaksi, jadi tidak bisa dihapus.");
    else onChanged();
  }

  return (
    <section className="px-5 pt-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">Rekening</h2>
        <div className="flex gap-2 text-sm">
          <button onClick={onTransfer} className="rounded-lg border border-navy px-3 py-1.5 text-navy">Transfer</button>
          <button onClick={() => open("new")} className="rounded-lg bg-navy px-3 py-1.5 text-white">Tambah</button>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {accounts.map((a) => (
          <li key={a.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{a.name}</span>
              <span className="font-semibold">{rupiah(a.balance)}</span>
            </div>
            <p className="text-sm text-charcoal/60">{TYPES[a.type] ?? a.type}</p>
            <div className="mt-2 flex gap-4 text-sm">
              <button onClick={() => open(a)} className="text-navy underline">Ubah</button>
              <button onClick={() => remove(a)} className="text-red-700 underline">Hapus</button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-paper p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-navy">{editing === "new" ? "Tambah rekening" : "Ubah rekening"}</h3>
              <button onClick={() => setEditing(null)} className="text-sm underline">Tutup</button>
            </div>
            <div className="mt-4 space-y-3">
              <input className={field} placeholder="Nama (contoh: BCA, DANA)" value={name} onChange={(e) => setName(e.target.value)} />
              <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {editing === "new" && (
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder="Saldo awal (Rp)"
                  value={digits ? Number(digits).toLocaleString("id-ID") : ""}
                  onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 12))}
                />
              )}
            </div>
            {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
            <button onClick={save} disabled={busy} className="mt-5 w-full rounded-xl bg-emerald py-3 font-medium text-white disabled:opacity-60">
              {busy ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
