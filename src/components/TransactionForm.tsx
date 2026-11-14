import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { Account, Category, Tx } from "../lib/types";
import { rupiahShort } from "../lib/format";
import { catIcon } from "../lib/icons";

type Props = {
  accounts: Account[];
  categories: Category[];
  editing: Tx | null;
  recent?: Tx[];
  defaultKind?: "income" | "expense";
  onClose: () => void;
  onSaved: () => void;
};

const toLocalInput = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function TransactionForm({ accounts, categories, editing, recent = [], defaultKind, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<"income" | "expense">(editing ? (editing.type === "income" ? "income" : "expense") : defaultKind ?? "expense");
  const [digits, setDigits] = useState(editing ? String(editing.amount) : "");
  const [accountId, setAccountId] = useState(editing?.account_id ?? accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [when, setWhen] = useState(toLocalInput(editing?.occurred_at));
  const [source, setSource] = useState(editing?.source ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const cats = categories.filter((c) => c.kind === kind);
  const amount = Number(digits || 0);

  // Pakai ulang transaksi terakhir (4 unik) untuk jenis yang sedang dipilih.
  const templates: Tx[] = [];
  if (!editing) {
    const seen = new Set<string>();
    for (const t of recent) {
      if (t.type !== kind) continue;
      const k = `${t.category_id ?? ""}|${(t.note ?? t.source ?? "").toLowerCase()}|${t.amount}`;
      if (seen.has(k)) continue;
      seen.add(k); templates.push(t);
      if (templates.length === 4) break;
    }
  }
  function useTemplate(t: Tx) {
    setDigits(String(t.amount));
    if (accounts.some((a) => a.id === t.account_id)) setAccountId(t.account_id);
    setCategoryId(t.category_id ?? "");
    setNote(t.note ?? "");
    setSource(t.source ?? "");
  }

  async function save() {
    setErr("");
    if (amount <= 0) return setErr("Isi nominal lebih dari 0.");
    if (!accountId) return setErr("Pilih rekening.");
    if (!when) return setErr("Isi tanggal.");
    setBusy(true);
    const row = {
      type: kind,
      amount,
      account_id: accountId,
      category_id: categoryId || null,
      occurred_at: new Date(when).toISOString(),
      source: kind === "income" ? source.trim() || null : null,
      note: note.trim() || null,
    };
    const q = editing
      ? supabase.from("transactions").update(row).eq("id", editing.id)
      : supabase.from("transactions").insert(row);
    const { error } = await q;
    setBusy(false);
    if (error) return setErr("Gagal menyimpan. Periksa isian lalu coba lagi.");
    onSaved();
  }

  const field = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";

  return (
    <div className="fade-in fixed inset-0 z-30 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="sheet-up max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">{editing ? "Ubah transaksi" : "Tambah transaksi"}</h2>
          <button onClick={onClose} className="text-sm underline">Tutup</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-charcoal/10 p-1">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              onClick={() => { setKind(k); setCategoryId(""); }}
              className={`rounded-lg py-2 font-medium ${kind === k ? (k === "income" ? "bg-emerald text-white" : "bg-navy text-white") : ""}`}
            >
              {k === "income" ? "Pemasukan" : "Pengeluaran"}
            </button>
          ))}
        </div>

        {templates.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-charcoal/60">Pakai ulang transaksi terakhir</p>
            <div className="chips mt-1.5 flex gap-2 overflow-x-auto pb-1">
              {templates.map((t) => {
                const cn = categories.find((c) => c.id === t.category_id)?.name;
                return (
                  <button key={t.id} onClick={() => useTemplate(t)} className="shrink-0 rounded-full border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium">
                    {catIcon(cn)} {t.note || t.source || cn || "Transaksi"} · {rupiahShort(t.amount)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm text-charcoal/70">Nominal (Rp)</label>
            <input
              className={`${field} text-xl font-semibold`}
              inputMode="numeric"
              placeholder="0"
              value={digits ? Number(digits).toLocaleString("id-ID") : ""}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 12))}
            />
          </div>
          <div>
            <label className="text-sm text-charcoal/70">{kind === "income" ? "Rekening tujuan" : "Rekening sumber"}</label>
            <select className={field} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-charcoal/70">Kategori</label>
            <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Tanpa kategori</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {kind === "income" && (
            <input className={field} placeholder="Sumber pemasukan (opsional)" value={source} onChange={(e) => setSource(e.target.value)} />
          )}
          <input className={field} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <input className={field} placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
        <button onClick={save} disabled={busy} className="mt-5 w-full rounded-xl bg-emerald py-3 font-medium text-white disabled:opacity-60">
          {busy ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}
