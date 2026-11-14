import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { rupiah } from "../lib/format";
import type { Category } from "../lib/types";
import { catIcon } from "../lib/icons";

type Row = { type: string; amount: number; category_id: string | null; occurred_at: string };
type P = "minggu" | "bulan" | "tahun";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function range(p: P, off: number): [Date, Date] {
  const n = new Date();
  if (p === "tahun") return [new Date(n.getFullYear() + off, 0, 1), new Date(n.getFullYear() + off + 1, 0, 1)];
  if (p === "bulan") return [new Date(n.getFullYear(), n.getMonth() + off, 1), new Date(n.getFullYear(), n.getMonth() + off + 1, 1)];
  const s = new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7) + off * 7);
  return [s, new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7)];
}

function BalanceTrend({ total }: { total: number }) {
  const [pts, setPts] = useState<number[]>([]);
  useEffect(() => {
    const n = new Date();
    const s = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 29);
    supabase.from("transactions").select("type,amount,occurred_at").gte("occurred_at", s.toISOString()).then(({ data }) => {
      const delta = new Array(30).fill(0);
      (data ?? []).forEach((x) => {
        const d = new Date(x.occurred_at);
        const i = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - s.getTime()) / 86400000);
        const sign = ["income", "saving_withdraw", "debt_borrow", "loan_receive"].includes(x.type) ? 1 : x.type === "transfer" ? 0 : -1;
        if (i >= 0 && i < 30) delta[i] += sign * Number(x.amount);
      });
      const out: number[] = new Array(30).fill(0);
      let bal = total;
      for (let i = 29; i >= 0; i--) { out[i] = bal; bal -= delta[i]; }
      setPts(out);
    });
  }, [total]);
  if (pts.length === 0) return null;
  const lo = Math.min(...pts), hi = Math.max(...pts), span = Math.max(1, hi - lo);
  const X = (i: number) => (i / 29) * 300;
  const Y = (v: number) => 8 + (1 - (v - lo) / span) * 64;
  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  return (
    <div className="rise rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-end justify-between">
        <div><p className="text-xs text-charcoal/60">Tren saldo 30 hari</p><p className="text-xl font-bold text-navy">{rupiah(total)}</p></div>
        <p className="text-xs text-charcoal/60">{pts[29] >= pts[0] ? "▲" : "▼"} {rupiah(Math.abs(pts[29] - pts[0]))}</p>
      </div>
      <svg viewBox="0 0 300 80" className="mt-2 h-24 w-full" preserveAspectRatio="none">
        <defs><linearGradient id="bt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f9d6b" stopOpacity="0.35" /><stop offset="100%" stopColor="#0f9d6b" stopOpacity="0" /></linearGradient></defs>
        <path d={`${line} L300,80 L0,80 Z`} fill="url(#bt)" />
        <path d={line} fill="none" stroke="#0f9d6b" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export default function Analysis({ categories, total }: { categories: Category[]; total: number }) {
  const [p, setP] = useState<P>("bulan");
  const [off, setOff] = useState(0);
  const [cur, setCur] = useState<Row[]>([]);
  const [prev, setPrev] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [start, end] = range(p, off);
  const [pStart] = range(p, off - 1);

  useEffect(() => {
    setLoaded(false);
    supabase.from("transactions").select("type,amount,category_id,occurred_at")
      .in("type", ["income", "expense"])
      .gte("occurred_at", pStart.toISOString()).lt("occurred_at", end.toISOString())
      .then(({ data }) => {
        const rows = (data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as Row[];
        setCur(rows.filter((r) => new Date(r.occurred_at) >= start));
        setPrev(rows.filter((r) => new Date(r.occurred_at) < start));
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, off]);

  const sum = (rows: Row[], t: string) => rows.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0);
  const inc = sum(cur, "income"), exp = sum(cur, "expense"), pExp = sum(prev, "expense"), pInc = sum(prev, "income");

  const n = p === "minggu" ? 7 : p === "tahun" ? 12 : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const buckets = Array.from({ length: n }, () => ({ inc: 0, exp: 0 }));
  cur.forEach((r) => {
    const d = new Date(r.occurred_at);
    const i = p === "tahun" ? d.getMonth() : p === "bulan" ? d.getDate() - 1 : Math.floor((d.getTime() - start.getTime()) / 86400000);
    if (buckets[i]) buckets[i][r.type === "income" ? "inc" : "exp"] += r.amount;
  });
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.inc, b.exp)));
  const label = (i: number) => (p === "tahun" ? MONTHS[i] : p === "minggu" ? DAYS[i] : i % 5 === 0 || i === n - 1 ? String(i + 1) : "");

  const byCat: Record<string, number> = {};
  cur.filter((r) => r.type === "expense").forEach((r) => { const k = r.category_id ?? "-"; byCat[k] = (byCat[k] ?? 0) + r.amount; });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";

  const title = p === "tahun" ? String(start.getFullYear())
    : p === "bulan" ? start.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    : `${start.getDate()} ${MONTHS[start.getMonth()]} - ${new Date(end.getTime() - 86400000).getDate()} ${MONTHS[new Date(end.getTime() - 86400000).getMonth()]}`;
  const cmp = (a: number, b: number, noun: string) =>
    b === 0 ? `${noun}: belum ada data periode sebelumnya` : `${noun} ${a >= b ? "naik" : "turun"} ${Math.round((Math.abs(a - b) / b) * 100)}% dari periode sebelumnya`;

  return (
    <section className="px-5 pt-5">
      <BalanceTrend total={total} />
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-charcoal/10 p-1">
        {(["minggu", "bulan", "tahun"] as const).map((v) => (
          <button key={v} onClick={() => { setP(v); setOff(0); }} className={`rounded-lg py-2 font-medium capitalize ${p === v ? "bg-navy text-white" : ""}`}>{v}</button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => setOff(off - 1)} className="px-3 py-1 text-lg">‹</button>
        <span className="font-medium">{title}</span>
        <button onClick={() => setOff(Math.min(0, off + 1))} disabled={off === 0} className="px-3 py-1 text-lg disabled:opacity-30">›</button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-charcoal/60">Pemasukan</p><p className="text-sm font-semibold text-emerald">{rupiah(inc)}</p></div>
        <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-charcoal/60">Pengeluaran</p><p className="text-sm font-semibold">{rupiah(exp)}</p></div>
        <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-xs text-charcoal/60">Selisih</p><p className="text-sm font-semibold">{rupiah(inc - exp)}</p></div>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex gap-4 text-xs"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald" />Pemasukan</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-navy" />Pengeluaran</span></div>
        <div className="mt-3 flex h-40 items-end gap-0.5">
          {buckets.map((b, i) => (
            <div key={i} className="flex h-full flex-1 items-end gap-px">
              <div className="w-full rounded-t bg-emerald" style={{ height: `${(b.inc / max) * 100}%`, minHeight: b.inc > 0 ? 2 : 0 }} />
              <div className="w-full rounded-t bg-navy" style={{ height: `${(b.exp / max) * 100}%`, minHeight: b.exp > 0 ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-0.5 text-[10px] text-charcoal/60">
          {buckets.map((_, i) => <span key={i} className="flex-1 text-center">{label(i)}</span>)}
        </div>
        {loaded && inc + exp === 0 && <p className="mt-2 text-sm text-charcoal/60">Belum ada transaksi di periode ini.</p>}
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <p>{cmp(exp, pExp, "Pengeluaran")}</p>
        <p className="mt-1">{cmp(inc, pInc, "Pemasukan")}</p>
      </div>

      <h2 className="mt-6 text-lg font-semibold text-navy">Pengeluaran per kategori</h2>
      <ul className="mt-2 space-y-3 pb-4">
        {cats.length === 0 && <li className="text-charcoal/60">Belum ada pengeluaran.</li>}
        {cats.map(([id, v]) => (
          <li key={id}>
            <div className="flex justify-between text-sm"><span>{catIcon(catName(id))} {catName(id)}</span><span>{rupiah(v)} · {Math.round((v / exp) * 100)}%</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-charcoal/10"><div className="h-full bg-gold" style={{ width: `${(v / exp) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
}
