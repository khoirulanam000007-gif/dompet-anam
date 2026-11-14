import { useState } from "react";
import { supabase } from "../lib/supabase";
import { rupiah } from "../lib/format";
import { fmtDate } from "../lib/types";
import type { Account, Category, Tx } from "../lib/types";

type Props = {
  txs: Tx[];
  accounts: Account[];
  categories: Category[];
  onEdit: (t: Tx) => void;
  onChanged: () => void;
  searchable?: boolean;
};

export default function Transactions({ txs, accounts, categories, onEdit, onChanged, searchable }: Props) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "income" | "expense">("all");
  const acc = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "-";
  const cat = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";

  async function remove(t: Tx) {
    if (!window.confirm("Hapus transaksi ini? Saldo akan dihitung ulang.")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) window.alert("Gagal menghapus. Coba lagi.");
    else onChanged();
  }

  const needle = q.trim().toLowerCase();
  const shown = !searchable ? txs : txs.filter((t) =>
    (f === "all" || t.type === f) &&
    (!needle || [cat(t.category_id), acc(t.account_id), t.note ?? "", t.source ?? ""].join(" ").toLowerCase().includes(needle))
  );

  if (txs.length === 0)
    return <p className="px-5 pt-8 text-charcoal/70">Belum ada transaksi. Tekan tombol + untuk mencatat yang pertama.</p>;

  return (
    <>
      {searchable && (
        <div className="px-5 pt-3">
          <input
            className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 outline-none focus:border-emerald"
            placeholder="Cari kategori, catatan, atau rekening"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mt-2 flex gap-2 text-sm">
            {([["all", "Semua"], ["income", "Masuk"], ["expense", "Keluar"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setF(k)} className={`rounded-full px-3 py-1 ${f === k ? "bg-navy text-white" : "bg-charcoal/10"}`}>{l}</button>
            ))}
          </div>
        </div>
      )}
    <ul className="space-y-2 px-5 pt-4">
      {shown.length === 0 && <li className="text-charcoal/60">Tidak ada transaksi yang cocok.</li>}
      {shown.map((t) => {
        const isTransfer = t.type === "transfer";
        const plus = ["income", "saving_withdraw", "debt_borrow", "loan_receive"].includes(t.type);
        const label = isTransfer ? "Transfer" : t.type === "saving_deposit" ? "Setoran tabungan" : t.type === "saving_withdraw" ? "Penarikan tabungan" : ({ debt_borrow: "Pinjaman diterima", loan_give: "Pinjaman diberikan", debt_repay: "Pembayaran utang", loan_receive: "Penerimaan piutang" } as Record<string, string>)[t.type] ?? cat(t.category_id);
        const editable = plus || t.type === "expense";
        return (
          <li key={t.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{label}</span>
              <span className={`font-semibold ${plus ? "text-emerald" : "text-charcoal"}`}>
                {isTransfer ? "" : plus ? "+" : "-"}{rupiah(t.amount)}
              </span>
            </div>
            <p className="text-sm text-charcoal/60">
              {isTransfer ? `${acc(t.account_id)} → ${acc(t.to_account_id)}` : acc(t.account_id)} · {fmtDate(t.occurred_at)}
            </p>
            {(t.source || t.note) && <p className="text-sm">{[t.source, t.note].filter(Boolean).join(" - ")}</p>}
            {(
              <div className="mt-2 flex gap-4 text-sm">
                {editable && <button onClick={() => onEdit(t)} className="text-navy underline">Ubah</button>}
                <button onClick={() => remove(t)} className="text-red-700 underline">Hapus</button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
    </>
  );
}
