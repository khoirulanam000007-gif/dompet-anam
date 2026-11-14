import { Fragment, useState } from "react";
import { supabase } from "../lib/supabase";
import { confirmBox, toast } from "../lib/ui";
import { rupiah } from "../lib/format";
import { catIcon } from "../lib/icons";
import type { Account, Category, Tx } from "../lib/types";

type Props = {
  txs: Tx[];
  accounts: Account[];
  categories: Category[];
  onEdit: (t: Tx) => void;
  onChanged: () => void;
  searchable?: boolean;
};

const NAMES: Record<string, string> = {
  transfer: "Transfer", saving_deposit: "Setoran tabungan", saving_withdraw: "Penarikan tabungan",
  debt_borrow: "Pinjaman diterima", loan_give: "Pinjaman diberikan", debt_repay: "Pembayaran utang", loan_receive: "Penerimaan piutang",
};
const PLUS = ["income", "saving_withdraw", "debt_borrow", "loan_receive"];

const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
function dayLabel(iso: string) {
  const d = new Date(iso), n = new Date();
  const diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
}

export default function Transactions({ txs, accounts, categories, onEdit, onChanged, searchable }: Props) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "income" | "expense">("all");
  const acc = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "-";
  const cat = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";

  async function remove(t: Tx) {
    if (!(await confirmBox("Hapus transaksi ini? Saldo akan dihitung ulang.", { okLabel: "Hapus" }))) return;
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) toast("Gagal menghapus. Coba lagi.", "error");
    else onChanged();
  }

  const needle = q.trim().toLowerCase();
  const shown = !searchable ? txs : txs.filter((t) =>
    (f === "all" || t.type === f) &&
    (!needle || [cat(t.category_id), acc(t.account_id), t.note ?? "", t.source ?? ""].join(" ").toLowerCase().includes(needle))
  );

  if (txs.length === 0)
    return (
      <div className="px-5 pt-8 text-center">
        <p className="text-5xl">🧾</p>
        <p className="mt-2 font-semibold text-navy">Belum ada transaksi</p>
        <p className="text-sm text-charcoal/60">Tekan tombol + untuk mencatat yang pertama.</p>
      </div>
    );

  let last = "";
  return (
    <>
      {searchable && (
        <div className="px-5 pt-4">
          <input
            className="w-full rounded-2xl border border-charcoal/15 bg-white px-4 py-3 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30"
            placeholder="🔍  Cari kategori, catatan, atau rekening"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mt-2 flex gap-2 text-sm">
            {([["all", "Semua"], ["income", "Masuk"], ["expense", "Keluar"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setF(k)} className={`rounded-full px-4 py-1.5 font-medium ${f === k ? "bg-navy text-white" : "bg-charcoal/10"}`}>{l}</button>
            ))}
          </div>
        </div>
      )}
      <ul className="space-y-2 px-5 pt-4">
        {shown.length === 0 && <li className="text-charcoal/60">Tidak ada transaksi yang cocok.</li>}
        {shown.map((t) => {
          const plus = PLUS.includes(t.type);
          const editable = t.type === "income" || t.type === "expense";
          const isTransfer = t.type === "transfer";
          const label = NAMES[t.type] ?? cat(t.category_id);
          const icon = editable ? catIcon(cat(t.category_id)) : isTransfer ? "🔁" : t.type.startsWith("saving") ? "🐖" : "🤝";
          const dk = dayKey(t.occurred_at);
          const head = searchable && dk !== last;
          last = dk;
          return (
            <Fragment key={t.id}>
              {head && <li className="pt-2 text-xs font-semibold uppercase tracking-wide text-charcoal/50">{dayLabel(t.occurred_at)}</li>}
              <li className="rise rounded-2xl bg-white px-3 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: plus ? "rgba(15,157,107,.14)" : "rgba(201,169,97,.22)" }}>{icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{label}</p>
                    <p className="truncate text-xs text-charcoal/60">
                      {isTransfer ? `${acc(t.account_id)} → ${acc(t.to_account_id)}` : acc(t.account_id)} · {new Date(t.occurred_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {(t.source || t.note) && <p className="truncate text-xs text-charcoal/70">{[t.source, t.note].filter(Boolean).join(" · ")}</p>}
                  </div>
                  <span className={`shrink-0 font-bold ${plus ? "text-emerald" : ""}`}>{isTransfer ? "" : plus ? "+" : "-"}{rupiah(t.amount)}</span>
                </div>
                <div className="ml-14 mt-1 flex gap-4 text-xs">
                  {editable && <button onClick={() => onEdit(t)} className="text-navy underline">Ubah</button>}
                  <button onClick={() => remove(t)} className="text-red-700 underline">Hapus</button>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </>
  );
}
