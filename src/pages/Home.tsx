import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { rupiah } from "../lib/format";
import type { Account, Category, Tx } from "../lib/types";
import Transactions from "./Transactions";

type Period = "hari" | "minggu" | "bulan" | "tahun" | "tanggal";
const PERIODS: [Period, string][] = [["hari", "Hari ini"], ["minggu", "Minggu ini"], ["bulan", "Bulan ini"], ["tahun", "Tahun ini"], ["tanggal", "Pilih tanggal"]];
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

function rangeOf(p: Period, from: string, to: string): [Date, Date] {
  const n = new Date();
  const t = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (p === "hari") return [t, new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)];
  if (p === "minggu") { const s = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7)); return [s, new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7)]; }
  if (p === "bulan") return [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 1, 1)];
  if (p === "tahun") return [new Date(n.getFullYear(), 0, 1), new Date(n.getFullYear() + 1, 0, 1)];
  const a = parse(from), b = parse(to);
  const [s, e] = a <= b ? [a, b] : [b, a];
  return [s, new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1)];
}

type Props = {
  accounts: Account[]; categories: Category[]; txs: Tx[]; total: number;
  onAdd: (k: "income" | "expense") => void; onTransfer: () => void; onEdit: (t: Tx) => void; onChanged: () => void;
};

export default function Home({ accounts, categories, txs, total, onAdd, onTransfer, onEdit, onChanged }: Props) {
  const today = ymd(new Date());
  const [period, setPeriod] = useState<Period>("bulan");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [hide, setHide] = useState(localStorage.getItem("hide") === "1");
  const [name, setName] = useState("");
  const [tot, setTot] = useState({ inc: 0, exp: 0 });
  const [week, setWeek] = useState<{ d: string; inc: number; exp: number }[]>([]);
  const [bud, setBud] = useState({ limit: 0, used: 0, risk: 0, count: 0 });
  const [goal, setGoal] = useState({ saved: 0, target: 0, count: 0 });
  const [debt, setDebt] = useState({ owe: 0, owed: 0 });
  const [dues, setDues] = useState<{ n: string; d: string; k: string; a: number }[]>([]);
  const [mInc, setMInc] = useState(0);
  const [mExp, setMExp] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) supabase.from("profiles").select("full_name").eq("id", data.user.id).single().then((r) => setName((r.data?.full_name ?? "").split(" ")[0]));
    });
  }, []);

  useEffect(() => {
    const [s, e] = rangeOf(period, from, to);
    supabase.from("transactions").select("type,amount").in("type", ["income", "expense"]).gte("occurred_at", s.toISOString()).lt("occurred_at", e.toISOString())
      .then(({ data }) => {
        const sum = (t: string) => (data ?? []).filter((x) => x.type === t).reduce((a, x) => a + Number(x.amount), 0);
        setTot({ inc: sum("income"), exp: sum("expense") });
      });
  }, [period, from, to, txs]);

  useEffect(() => {
    const n = new Date();
    const w0 = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 6);
    const m0 = new Date(n.getFullYear(), n.getMonth(), 1);
    const mKey = `${m0.getFullYear()}-${String(m0.getMonth() + 1).padStart(2, "0")}-01`;
    Promise.all([
      supabase.from("transactions").select("type,amount,occurred_at").in("type", ["income", "expense"]).gte("occurred_at", w0.toISOString()),
      supabase.from("budgets").select("category_id,limit_amount").eq("month", mKey),
      supabase.from("transactions").select("type,category_id,amount").in("type", ["income", "expense"]).gte("occurred_at", m0.toISOString()),
      supabase.from("goal_progress").select("saved_amount,target_amount"),
      supabase.from("debt_status").select("kind,remaining_amount,due_date,person_name,is_paid"),
    ]).then(([w, b, sp, g, d]) => {
      const days = Array.from({ length: 7 }, (_, i) => new Date(w0.getFullYear(), w0.getMonth(), w0.getDate() + i));
      setWeek(days.map((dt) => {
        const k = ymd(dt);
        const rows = (w.data ?? []).filter((x) => ymd(new Date(x.occurred_at)) === k);
        const sum = (t: string) => rows.filter((x) => x.type === t).reduce((a, x) => a + Number(x.amount), 0);
        return { d: DAYS[dt.getDay()], inc: sum("income"), exp: sum("expense") };
      }));
      const spent: Record<string, number> = {};
      (sp.data ?? []).forEach((x) => { if (x.type === "expense" && x.category_id) spent[x.category_id] = (spent[x.category_id] ?? 0) + Number(x.amount); });
      let limit = 0, used = 0, risk = 0;
      (b.data ?? []).forEach((x) => { const l = Number(x.limit_amount), u = spent[x.category_id] ?? 0; limit += l; used += u; if (u / l >= 0.8) risk++; });
      setBud({ limit, used, risk, count: (b.data ?? []).length });
      const msum = (t: string) => (sp.data ?? []).filter((x) => x.type === t).reduce((a, x) => a + Number(x.amount), 0);
      setMInc(msum("income"));
      setMExp(msum("expense"));
      setGoal({ saved: (g.data ?? []).reduce((a, x) => a + Number(x.saved_amount), 0), target: (g.data ?? []).reduce((a, x) => a + Number(x.target_amount), 0), count: (g.data ?? []).length });
      const rem = (k: string) => (d.data ?? []).filter((x) => x.kind === k).reduce((a, x) => a + Number(x.remaining_amount), 0);
      setDebt({ owe: rem("borrowed"), owed: rem("lent") });
      const soon = ymd(new Date(n.getFullYear(), n.getMonth(), n.getDate() + 3));
      setDues((d.data ?? []).filter((x) => !x.is_paid && x.due_date && x.due_date <= soon).map((x) => ({ n: x.person_name, d: x.due_date, k: x.kind, a: Number(x.remaining_amount) })));
    });
  }, [txs]);

  const h = new Date().getHours();
  const greet = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
  const max = Math.max(1, ...week.map((x) => Math.max(x.inc, x.exp)));
  const money = (v: number) => (hide ? "Rp ••••••" : rupiah(v));
  const left = tot.inc - tot.exp;
  const insight =
    tot.inc === 0 && tot.exp === 0 ? "Belum ada transaksi di periode ini. Catat yang pertama!"
    : tot.inc === 0 ? "Ada pengeluaran tanpa pemasukan di periode ini."
    : tot.exp > tot.inc ? "Pengeluaran melebihi pemasukan. Tinjau kategori terbesar di menu Analisis."
    : left / tot.inc >= 0.3 ? `Kondisi sehat: ${Math.round((left / tot.inc) * 100)}% pemasukan Anda masih tersisa.`
    : `Cukup baik: ${Math.round((left / tot.inc) * 100)}% pemasukan tersisa. Jaga pengeluaran.`;
  const card = "rise rounded-2xl bg-white p-4 shadow-sm";
  const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

  const hasData = mInc > 0 || mExp > 0;
  const sSave = mInc > 0 ? 50 * Math.max(0, Math.min(1, (mInc - mExp) / mInc / 0.3)) : 0;
  const sBud = bud.count ? (bud.used > bud.limit ? 0 : 30 * (1 - 0.5 * (bud.risk / bud.count))) : 15;
  const sDebt = debt.owe === 0 ? 20 : total > 0 ? 20 * Math.max(0, 1 - debt.owe / total) : 0;
  const score = Math.round(sSave + sBud + sDebt);
  const scoreLabel = score >= 80 ? "Sangat sehat" : score >= 60 ? "Sehat" : score >= 40 ? "Perlu perhatian" : "Waspada";
  const days = new Set(txs.map((t) => ymd(new Date(t.occurred_at))));
  let streak = 0;
  const cur = new Date();
  if (!days.has(ymd(cur))) cur.setDate(cur.getDate() - 1);
  while (days.has(ymd(cur))) { streak++; cur.setDate(cur.getDate() - 1); }

  return (
    <div>
      <section className="hero px-5 pb-6 pt-4 text-white">
        <p className="rise text-sm text-white/80">{greet}{name ? `, ${name}` : ""} 👋</p>
        <div className="rise mt-3 flex items-center justify-between" style={{ animationDelay: "60ms" }}>
          <p className="text-sm text-white/70">Total saldo</p>
          <button onClick={() => { const v = !hide; setHide(v); localStorage.setItem("hide", v ? "1" : "0"); }} className="text-xs text-white/80 underline">{hide ? "Tampilkan" : "Sembunyikan"}</button>
        </div>
        <p className="rise text-4xl font-semibold tracking-tight" style={{ animationDelay: "90ms" }}>{money(total)}</p>
        <div className="mt-2 h-0.5 w-10 bg-gold" />

        <div className="chips -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
          {PERIODS.map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)} className={`shrink-0 rounded-full px-3 py-1 text-sm ${period === k ? "bg-gold text-navy" : "bg-white/15 text-white"}`}>{l}</button>
          ))}
        </div>
        {period === "tanggal" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl bg-white/90 px-3 py-2 text-sm" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl bg-white/90 px-3 py-2 text-sm" />
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/10 p-2"><p className="text-xs text-white/70">Pemasukan</p><p className="text-sm font-semibold text-emerald-300">{money(tot.inc)}</p></div>
          <div className="rounded-xl bg-white/10 p-2"><p className="text-xs text-white/70">Pengeluaran</p><p className="text-sm font-semibold">{money(tot.exp)}</p></div>
          <div className="rounded-xl bg-white/10 p-2"><p className="text-xs text-white/70">Sisa</p><p className="text-sm font-semibold">{money(left)}</p></div>
        </div>

        <div className="mt-4 flex h-14 items-end gap-1">
          {week.map((x, i) => (
            <div key={i} className="flex h-full flex-1 items-end gap-px">
              <div className="grow w-full rounded-t bg-emerald-300" style={{ height: `${(x.inc / max) * 100}%`, minHeight: x.inc > 0 ? 2 : 0, animationDelay: `${i * 50}ms` }} />
              <div className="grow w-full rounded-t bg-white/80" style={{ height: `${(x.exp / max) * 100}%`, minHeight: x.exp > 0 ? 2 : 0, animationDelay: `${i * 50}ms` }} />
            </div>
          ))}
        </div>
        <div className="flex gap-1 text-[10px] text-white/60">{week.map((x, i) => <span key={i} className="flex-1 text-center">{x.d}</span>)}</div>
      </section>

      <section className="px-5 pt-4">
        {dues.length > 0 && (
          <div className="rise mb-3 rounded-2xl border border-red-700/40 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="font-semibold text-red-700">Pengingat jatuh tempo</p>
            {dues.map((x, i) => (
              <p key={i}>{x.k === "borrowed" ? "Bayar ke" : "Tagih dari"} {x.n}: {money(x.a)} · {new Date(x.d).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p>
            ))}
          </div>
        )}
        <div className="rise rounded-2xl border border-gold/50 bg-white px-4 py-3 text-sm shadow-sm" style={{ animationDelay: "120ms" }}>
          <span className="font-semibold text-navy">Kondisi keuangan · </span>{insight}
        </div>

        {txs.length === 0 && (
          <div className="rise mt-4 rounded-2xl bg-white p-4 text-sm shadow-sm">
            <p className="font-semibold text-navy">Mulai dalam 3 langkah</p>
            <p className="mt-1">1. Tekan Pemasukan untuk mencatat uang yang sudah Anda punya.</p>
            <p>2. Catat pengeluaran harian dengan tombol Pengeluaran.</p>
            <p>3. Buka menu Rencana untuk membuat anggaran dan target tabungan.</p>
          </div>
        )}

        {hasData && (
          <div className="rise mt-4 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm" style={{ animationDelay: "180ms" }}>
            <svg viewBox="0 0 72 72" className="h-20 w-20 shrink-0 -rotate-90">
              <circle cx="36" cy="36" r="28" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="7" />
              <circle cx="36" cy="36" r="28" fill="none" stroke="#0f9d6b" strokeWidth="7" strokeLinecap="round" strokeDasharray="175.9" strokeDashoffset={175.9 * (1 - score / 100)} />
            </svg>
            <div>
              <p className="text-xs text-charcoal/60">Skor keuangan bulan ini</p>
              <p className="text-3xl font-semibold text-navy">{score}<span className="text-base text-charcoal/60">/100</span></p>
              <p className="text-sm">{scoreLabel}</p>
              {streak > 0 && <p className="mt-1 text-xs text-charcoal/60">🔥 Streak mencatat {streak} hari</p>}
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {([["Pemasukan", "+", "bg-emerald text-white", () => onAdd("income")], ["Pengeluaran", "−", "bg-navy text-white", () => onAdd("expense")], ["Transfer", "⇄", "bg-gold text-navy", onTransfer]] as const).map(([l, ic, c, fn], i) => (
            <button key={l} onClick={fn} className={`rise rounded-2xl py-3 ${c}`} style={{ animationDelay: `${150 + i * 50}ms` }}>
              <span className="block text-xl leading-none">{ic}</span><span className="text-xs font-medium">{l}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className={card} style={{ animationDelay: "250ms" }}>
            <p className="text-xs text-charcoal/60">Anggaran bulan ini</p>
            <p className="mt-1 font-semibold">{bud.count ? `${pct(bud.used, bud.limit)}% terpakai` : "Belum diatur"}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-charcoal/10"><div className={`h-full ${bud.used > bud.limit ? "bg-red-600" : "bg-emerald"}`} style={{ width: `${pct(bud.used, bud.limit)}%` }} /></div>
            <p className="mt-1 text-xs text-charcoal/60">{bud.count ? (bud.risk ? `${bud.risk} kategori hampir habis` : "Aman") : "Menu Rencana"}</p>
          </div>
          <div className={card} style={{ animationDelay: "300ms" }}>
            <p className="text-xs text-charcoal/60">Tabungan</p>
            <p className="mt-1 font-semibold">{goal.count ? money(goal.saved) : "Belum ada target"}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-charcoal/10"><div className="h-full bg-gold" style={{ width: `${pct(goal.saved, goal.target)}%` }} /></div>
            <p className="mt-1 text-xs text-charcoal/60">{goal.count ? `${pct(goal.saved, goal.target)}% dari ${money(goal.target)}` : "Menu Rencana"}</p>
          </div>
          <div className={card} style={{ animationDelay: "350ms" }}>
            <p className="text-xs text-charcoal/60">Utang saya</p>
            <p className="mt-1 font-semibold">{money(debt.owe)}</p>
          </div>
          <div className={card} style={{ animationDelay: "400ms" }}>
            <p className="text-xs text-charcoal/60">Piutang saya</p>
            <p className="mt-1 font-semibold">{money(debt.owed)}</p>
          </div>
        </div>

        <h2 className="mt-6 text-lg font-semibold text-navy">Rekening</h2>
        <ul className="mt-2 space-y-2">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
              <span>{a.name}</span><span className="font-medium">{money(a.balance)}</span>
            </li>
          ))}
        </ul>
        <h2 className="mt-6 text-lg font-semibold text-navy">Transaksi terbaru</h2>
      </section>
      <Transactions txs={txs.slice(0, 5)} accounts={accounts} categories={categories} onEdit={onEdit} onChanged={onChanged} />
    </div>
  );
}
