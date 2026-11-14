import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { rupiah } from "../lib/format";
import type { Account, Category } from "../lib/types";

type Row = { id: string; type: string; amount: number; account_id: string; category_id: string | null; occurred_at: string; note: string | null };

const LABEL: Record<string, string> = {
  transfer: "Transfer", saving_deposit: "Setoran tabungan", saving_withdraw: "Penarikan tabungan",
  debt_borrow: "Pinjaman diterima", loan_give: "Pinjaman diberikan", debt_repay: "Pembayaran utang", loan_receive: "Penerimaan piutang",
};
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Calendar({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState(key(new Date()));

  useEffect(() => {
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    supabase.from("transactions").select("id,type,amount,account_id,category_id,occurred_at,note")
      .gte("occurred_at", month.toISOString()).lt("occurred_at", end.toISOString()).order("occurred_at")
      .then(({ data }) => setRows((data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as Row[]));
  }, [month]);

  const byDay: Record<string, Row[]> = {};
  rows.forEach((r) => { const k = key(new Date(r.occurred_at)); (byDay[k] ??= []).push(r); });
  const tot = (list: Row[], t: string) => list.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0);

  const first = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const shift = (n: number) => { setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1)); setSel(""); };
  const dayList = byDay[sel] ?? [];
  const acc = (id: string) => accounts.find((a) => a.id === id)?.name ?? "-";
  const cat = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";

  return (
    <section className="px-5 pt-4">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="px-3 py-1 text-lg">‹</button>
        <span className="font-medium">{month.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</span>
        <button onClick={() => shift(1)} className="px-3 py-1 text-lg">›</button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-xs text-charcoal/60">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />;
          const k = key(new Date(month.getFullYear(), month.getMonth(), d));
          const list = byDay[k] ?? [];
          return (
            <button key={i} onClick={() => setSel(k)} className={`flex h-12 flex-col items-center justify-center rounded-xl text-sm ${sel === k ? "bg-navy text-white" : "bg-white shadow-sm"}`}>
              {d}
              <span className="mt-0.5 flex gap-0.5">
                {tot(list, "income") > 0 && <i className="h-1.5 w-1.5 rounded-full bg-emerald" />}
                {tot(list, "expense") > 0 && <i className="h-1.5 w-1.5 rounded-full bg-gold" />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-charcoal/60"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald" />Pemasukan <i className="ml-3 mr-1 inline-block h-2 w-2 rounded-full bg-gold" />Pengeluaran</p>

      {sel && (
        <div className="mt-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-charcoal/60">Pemasukan</p><p className="font-semibold text-emerald">{rupiah(tot(dayList, "income"))}</p></div>
            <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-charcoal/60">Pengeluaran</p><p className="font-semibold">{rupiah(tot(dayList, "expense"))}</p></div>
          </div>
          <ul className="mt-3 space-y-2">
            {dayList.length === 0 && <li className="text-charcoal/60">Tidak ada transaksi di tanggal ini.</li>}
            {dayList.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                <span>
                  <span className="font-medium">{LABEL[r.type] ?? cat(r.category_id)}</span>
                  <span className="block text-sm text-charcoal/60">{acc(r.account_id)}{r.note ? ` · ${r.note}` : ""}</span>
                </span>
                <span className="font-semibold">{rupiah(r.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
