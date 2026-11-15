import { useState } from "react";
import { supabase } from "../lib/supabase";
import { rupiah } from "../lib/format";
import type { Account } from "../lib/types";

type Props = { accounts: Account[]; onClose: () => void; onSaved: () => void };

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function TransferForm({ accounts, onClose, onSaved }: Props) {
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [digits, setDigits] = useState("");
  const [when, setWhen] = useState(nowLocal());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const amount = Number(digits || 0);
  const field = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";

  async function save() {
    setErr("");
    const src = accounts.find((a) => a.id === from);
    if (accounts.length < 2) return setErr("Buat minimal dua rekening dulu.");
    if (!from || !to || from === to) return setErr("Pilih dua rekening yang berbeda.");
    if (amount <= 0) return setErr("Isi nominal lebih dari 0.");
    if (src && amount > src.balance) return setErr(`Saldo ${src.name} hanya ${rupiah(src.balance)}.`);
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({
      type: "transfer",
      amount,
      account_id: from,
      to_account_id: to,
      occurred_at: new Date(when).toISOString(),
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return setErr("Gagal menyimpan. Coba lagi.");
    onSaved();
  }

  return (
    <div className="fade-in fixed inset-0 z-30 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="sheet-up max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">Transfer antar-rekening</h2>
          <button onClick={onClose} className="text-sm underline">Tutup</button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm text-charcoal/70">Dari</label>
            <select className={field} value={from} onChange={(e) => setFrom(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({rupiah(a.balance)})</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-charcoal/70">Ke</label>
            <select className={field} value={to} onChange={(e) => setTo(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <input
            className={`${field} text-xl font-semibold`}
            inputMode="numeric"
            placeholder="Nominal (Rp)"
            value={digits ? Number(digits).toLocaleString("id-ID") : ""}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 12))}
          />
          <input className={field} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <input className={field} placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
        <button onClick={save} disabled={busy} className="mt-5 w-full rounded-xl bg-emerald py-3 font-medium text-white disabled:opacity-60">
          {busy ? "Menyimpan..." : "Transfer"}
        </button>
      </div>
    </div>
  );
}
