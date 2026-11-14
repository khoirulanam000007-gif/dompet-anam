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
};

export default function Transactions({ txs, accounts, categories, onEdit, onChanged }: Props) {
  const acc = (id: string) => accounts.find((a) => a.id === id)?.name ?? "-";
  const cat = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";

  async function remove(t: Tx) {
    if (!window.confirm("Hapus transaksi ini? Saldo akan dihitung ulang.")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) window.alert("Gagal menghapus. Coba lagi.");
    else onChanged();
  }

  if (txs.length === 0)
    return <p className="px-5 pt-8 text-charcoal/70">Belum ada transaksi. Tekan tombol + untuk mencatat yang pertama.</p>;

  return (
    <ul className="space-y-2 px-5 pt-4">
      {txs.map((t) => {
        const plus = t.type === "income";
        const editable = t.type === "income" || t.type === "expense";
        return (
          <li key={t.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{cat(t.category_id)}</span>
              <span className={`font-semibold ${plus ? "text-emerald" : "text-charcoal"}`}>
                {plus ? "+" : "-"}{rupiah(t.amount)}
              </span>
            </div>
            <p className="text-sm text-charcoal/60">{acc(t.account_id)} · {fmtDate(t.occurred_at)}</p>
            {(t.source || t.note) && <p className="text-sm">{[t.source, t.note].filter(Boolean).join(" - ")}</p>}
            {editable && (
              <div className="mt-2 flex gap-4 text-sm">
                <button onClick={() => onEdit(t)} className="text-navy underline">Ubah</button>
                <button onClick={() => remove(t)} className="text-red-700 underline">Hapus</button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
