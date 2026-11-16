import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { rupiah } from "../lib/format";
import type { Account, Category } from "../lib/types";
import { useProfile } from "../lib/profile";
import { toast } from "../lib/ui";
import { buildReportPdf, type ReportRow } from "../lib/reportPdf";
import ImportWizard from "../components/ImportWizard";

type Row = { id: string; type: string; amount: number; account_id: string; to_account_id: string | null; category_id: string | null; occurred_at: string; note: string | null };
const LABEL: Record<string, string> = {
  income: "Pemasukan", expense: "Pengeluaran", transfer: "Transfer", saving_deposit: "Setoran tabungan", saving_withdraw: "Penarikan tabungan",
  debt_borrow: "Pinjaman diterima", loan_give: "Pinjaman diberikan", debt_repay: "Pembayaran utang", loan_receive: "Penerimaan piutang",
};

const PLUS = ["income", "debt_borrow", "loan_receive", "saving_withdraw"];

export default function Reports({ accounts, categories, onChanged }: { accounts: Account[]; categories: Category[]; onChanged: () => void }) {
  const profile = useProfile();
  const [importing, setImporting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [mode, setMode] = useState<"bulan" | "tahun">("bulan");
  const [off, setOff] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const n = new Date();
  const start = mode === "bulan" ? new Date(n.getFullYear(), n.getMonth() + off, 1) : new Date(n.getFullYear() + off, 0, 1);
  const end = mode === "bulan" ? new Date(n.getFullYear(), n.getMonth() + off + 1, 1) : new Date(n.getFullYear() + off + 1, 0, 1);
  const title = mode === "bulan" ? start.toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : String(start.getFullYear());

  useEffect(() => {
    supabase.from("transactions").select("id,type,amount,account_id,to_account_id,category_id,occurred_at,note")
      .gte("occurred_at", start.toISOString()).lt("occurred_at", end.toISOString()).order("occurred_at")
      .then(({ data }) => setRows((data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as Row[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, off]);

  const acc = (id: string) => accounts.find((a) => a.id === id)?.name ?? "-";
  const cat = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";
  const sum = (t: string) => rows.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0);
  const inc = sum("income"), exp = sum("expense");

  const group = (t: string, key: (r: Row) => string) => {
    const m: Record<string, number> = {};
    rows.filter((r) => r.type === t).forEach((r) => { m[key(r)] = (m[key(r)] ?? 0) + r.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  function downloadCsv() {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [["Tanggal", "Jenis", "Kategori", "Rekening", "Nominal", "Catatan"].join(";")];
    rows.forEach((r) => lines.push([
      q(new Date(r.occurred_at).toLocaleString("id-ID")), q(LABEL[r.type] ?? r.type), q(cat(r.category_id)),
      q(acc(r.account_id)), r.amount, q(r.note ?? ""),
    ].join(";")));
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `laporan-dompetpro-${title.replace(/\s/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadPdf() {
    setPdfBusy(true);
    try {
      const now = new Date();
      const last = new Date(Math.min(end.getTime(), now.getTime() + 86400000));
      const days = Math.max(1, Math.round((last.getTime() - start.getTime()) / 86400000));
      const list: ReportRow[] = rows.map((r) => {
        const tr = r.type === "transfer";
        const plus = PLUS.includes(r.type);
        return {
          date: new Date(r.occurred_at),
          kind: LABEL[r.type] ?? r.type,
          category: r.type === "income" || r.type === "expense" ? cat(r.category_id) : tr ? "Antar rekening" : "-",
          account: tr ? `${acc(r.account_id)} > ${acc(r.to_account_id ?? "")}` : acc(r.account_id),
          note: r.note ?? "",
          amount: r.amount,
          sign: tr ? 0 : plus ? 1 : -1,
          tone: r.type === "income" ? "in" : r.type === "expense" ? "out" : "other",
        };
      });
      const byAccount = accounts.map((a) => ({
        name: a.name,
        income: rows.filter((r) => r.type === "income" && r.account_id === a.id).reduce((s, r) => s + r.amount, 0),
        expense: rows.filter((r) => r.type === "expense" && r.account_id === a.id).reduce((s, r) => s + r.amount, 0),
      }));
      const bytes = buildReportPdf({
        periodLabel: title.charAt(0).toUpperCase() + title.slice(1),
        userName: profile.name,
        rows: list, income: inc, expense: exp,
        totalBalance: accounts.reduce((s, a) => s + a.balance, 0),
        expenseByCat: group("expense", (r) => cat(r.category_id)),
        incomeByCat: group("income", (r) => cat(r.category_id)),
        byAccount, days,
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      a.download = `laporan-dompetpro-${title.replace(/\s/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("Laporan PDF diunduh", "ok");
    } catch {
      toast("Gagal membuat PDF. Coba lagi.", "error");
    }
    setPdfBusy(false);
  }

  const Block = ({ name, items }: { name: string; items: [string, number][] }) => (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <p className="font-medium">{name}</p>
      {items.length === 0 && <p className="text-sm text-charcoal/60">Tidak ada data.</p>}
      {items.map(([k, v]) => <div key={k} className="mt-1 flex justify-between text-sm"><span>{k}</span><span>{rupiah(v)}</span></div>)}
    </div>
  );

  return (
    <section className="px-5 pt-4">
      <div className="no-print grid grid-cols-2 gap-2 rounded-xl bg-charcoal/10 p-1">
        {(["bulan", "tahun"] as const).map((v) => (
          <button key={v} onClick={() => { setMode(v); setOff(0); }} className={`rounded-lg py-2 font-medium capitalize ${mode === v ? "bg-navy text-white" : ""}`}>{v}an</button>
        ))}
      </div>
      <div className="no-print mt-3 flex items-center justify-between">
        <button onClick={() => setOff(off - 1)} className="px-3 py-1 text-lg">‹</button>
        <span className="font-medium">{title}</span>
        <button onClick={() => setOff(Math.min(0, off + 1))} disabled={off === 0} className="px-3 py-1 text-lg disabled:opacity-30">›</button>
      </div>
      <h2 className="mt-2 hidden text-xl font-semibold print:block">DompetPro - Laporan {title}</h2>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-charcoal/60">Pemasukan</p><p className="text-sm font-semibold text-emerald">{rupiah(inc)}</p></div>
        <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-charcoal/60">Pengeluaran</p><p className="text-sm font-semibold">{rupiah(exp)}</p></div>
        <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-charcoal/60">Selisih</p><p className="text-sm font-semibold">{rupiah(inc - exp)}</p></div>
      </div>

      <div className="no-print mt-3 grid grid-cols-2 gap-2">
        <button onClick={downloadPdf} disabled={pdfBusy} className="rounded-xl bg-navy py-2.5 font-medium text-white disabled:opacity-60">{pdfBusy ? "Membuat PDF..." : "📄 Unduh PDF"}</button>
        <button onClick={downloadCsv} className="rounded-xl bg-emerald py-2.5 font-medium text-white">📊 Unduh Excel (CSV)</button>
      </div>

      <div className="no-print mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/25 text-lg">📥</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Impor transaksi</p>
          <p className="text-xs text-charcoal/60">Dari file CSV atau Excel (.xlsx), lengkap dengan template.</p>
        </div>
        <button onClick={() => setImporting(true)} className="shrink-0 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white">Impor</button>
      </div>

      <Block name="Pengeluaran per kategori" items={group("expense", (r) => cat(r.category_id))} />
      <Block name="Pemasukan per kategori" items={group("income", (r) => cat(r.category_id))} />
      <Block name="Pengeluaran per rekening" items={group("expense", (r) => acc(r.account_id))} />
      <Block name="Pemasukan per rekening" items={group("income", (r) => acc(r.account_id))} />

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-medium">Semua transaksi ({rows.length})</p>
        {rows.map((r) => (
          <div key={r.id} className="mt-2 flex justify-between border-t border-charcoal/10 pt-2 text-sm">
            <span>{new Date(r.occurred_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · {LABEL[r.type] ?? r.type} · {r.type === "income" || r.type === "expense" ? cat(r.category_id) : acc(r.account_id)}</span>
            <span>{rupiah(r.amount)}</span>
          </div>
        ))}
      </div>
      <p className="no-print mt-3 pb-4 text-xs text-charcoal/60">PDF berisi ringkasan, grafik kategori, per rekening, dan seluruh rincian transaksi periode ini.</p>
      {importing && <ImportWizard accounts={accounts} categories={categories} onClose={() => setImporting(false)} onDone={() => { setImporting(false); onChanged(); }} />}
    </section>
  );
}
