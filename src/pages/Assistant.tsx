import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { rupiah } from "../lib/format";
import { catIcon } from "../lib/icons";
import type { Account, Category } from "../lib/types";
import { LIMITS, SUGGESTED, addDays, alertFor, answer, forecast, startOfDay, suggestions, summarize, type Ctx, type Level, type Row } from "../lib/assistant";

type Raw = { rows: Row[]; coverageStart: Date; truncated: boolean };
type Msg = { role: "user" | "bot"; text: string };

const COLOR: Record<Level, string> = { ok: "#0f9d6b", warn: "#d99a1e", danger: "#ea6a2a", full: "#dc2626", over: "#dc2626", nodata: "#94a3b8" };
const LIMIT_ROWS = 1000;

// Mengambil transaksi pemasukan/pengeluaran sejak tanggal tertentu. Bila terpotong, tanggal cakupan dinaikkan agar jawaban tetap jujur.
async function fetchRows(from: Date): Promise<Raw> {
  const { data, error } = await supabase.from("transactions").select("type,amount,category_id,occurred_at")
    .in("type", ["income", "expense"]).gte("occurred_at", from.toISOString())
    .order("occurred_at", { ascending: false }).limit(LIMIT_ROWS);
  if (error) throw error;
  const rows = (data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as Row[];
  const truncated = rows.length >= LIMIT_ROWS;
  const oldest = rows.length ? startOfDay(new Date(rows[rows.length - 1].occurred_at)) : from;
  return { rows, truncated, coverageStart: truncated ? addDays(oldest, 1) : from };
}

function Bubble({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {text.split("\n").map((l, i) =>
        l.startsWith("• ") ? <p key={i} className="flex gap-2"><span>•</span><span>{l.slice(2)}</span></p> : <p key={i}>{l}</p>)}
    </div>
  );
}

export default function Assistant({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
  const [now, setNow] = useState(() => new Date());
  const [raw, setRaw] = useState<Raw | null>(null);
  const [budgets, setBudgets] = useState<Ctx["budgets"]>([]);
  const [goals, setGoals] = useState<Ctx["goals"]>([]);
  const [debts, setDebts] = useState<Ctx["debts"]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [openTip, setOpenTip] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "bot", text: "Halo! Saya menjawab dari transaksi nyata Anda. Pilih pertanyaan di bawah atau ketik sendiri." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const n = new Date();
      const cov = new Date(Math.min(new Date(n.getFullYear(), n.getMonth() - 1, 1).getTime(), addDays(startOfDay(n), -90).getTime()));
      const mKey = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
      const [r, b, g, d] = await Promise.all([
        fetchRows(cov),
        supabase.from("budgets").select("category_id,limit_amount").eq("month", mKey),
        supabase.from("goal_progress").select("name,saved_amount,target_amount,target_date"),
        supabase.from("debt_status").select("kind,person_name,remaining_amount,due_date,is_paid"),
      ]);
      if (b.error || g.error || d.error) throw new Error("db");
      setNow(n);
      setRaw(r);
      setBudgets((b.data ?? []).map((x) => ({ category_id: x.category_id as string, limit: Number(x.limit_amount) })));
      setGoals((g.data ?? []).map((x) => ({ name: x.name as string, saved: Number(x.saved_amount), target: Number(x.target_amount), date: (x.target_date as string | null) ?? null })));
      setDebts((d.data ?? []).filter((x) => !x.is_paid).map((x) => ({ kind: x.kind as "borrowed" | "lent", person: x.person_name as string, remaining: Number(x.remaining_amount), due: (x.due_date as string | null) ?? null })));
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const ctx: Ctx | null = useMemo(() => raw && ({
    now, rows: raw.rows, coverageStart: raw.coverageStart, truncated: raw.truncated,
    balance: accounts.reduce((s, a) => s + a.balance, 0),
    accounts: accounts.map((a) => ({ name: a.name, balance: a.balance })),
    cats: categories, budgets, goals, debts,
  }), [raw, now, accounts, categories, budgets, goals, debts]);

  useEffect(() => { if (asked.current) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs.length, busy]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy || !ctx) return;
    asked.current = true;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    let c = ctx;
    const jan = new Date(ctx.now.getFullYear(), 0, 1);
    if (/tahun/i.test(q) && ctx.coverageStart.getTime() > jan.getTime()) {
      try { const y = await fetchRows(jan); c = { ...ctx, rows: y.rows, coverageStart: y.coverageStart, truncated: y.truncated }; } catch { /* pakai data yang ada */ }
    }
    await new Promise((r) => setTimeout(r, 350));
    setMsgs((m) => [...m, { role: "bot", text: answer(q, c) }]);
    setBusy(false);
  }

  const card = "rise rounded-2xl bg-white p-4 shadow-sm";

  if (state === "loading" && !ctx) return <p className="px-5 pt-8 text-center text-charcoal/60">Menganalisis transaksi Anda…</p>;
  if (state === "error" && !ctx)
    return (
      <div className="px-5 pt-8 text-center">
        <p className="text-4xl">📡</p>
        <p className="mt-2 font-semibold text-navy">Data belum bisa dimuat</p>
        <p className="text-sm text-charcoal/60">Periksa internet Anda lalu coba lagi.</p>
        <button onClick={load} className="mt-3 rounded-xl bg-emerald px-5 py-2.5 font-medium text-white">Coba lagi</button>
      </div>
    );
  if (!ctx) return null;

  const s = summarize(ctx);
  const a = alertFor(s.income, s.expense);
  const f = forecast(ctx);
  const tips = suggestions(ctx);
  const color = COLOR[a.level];
  const pct = a.ratio === null ? 0 : Math.min(100, a.ratio * 100);
  const monthName = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const noData = s.income === 0 && s.expense === 0;

  return (
    <section className="px-5 pb-6 pt-5">
      {/* 1. Status: pengeluaran vs pemasukan */}
      <div className={card}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-charcoal/60">Kondisi {monthName}</p>
            <p className="mt-0.5 flex items-center gap-2 text-lg font-bold" style={{ color }}>
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />{a.title}
            </p>
          </div>
          <button onClick={load} disabled={state === "loading"} className="shrink-0 rounded-full bg-charcoal/10 px-3 py-1 text-xs disabled:opacity-50">{state === "loading" ? "Memuat…" : "↻ Segarkan"}</button>
        </div>
        <p className="mt-2 text-sm">{a.text}</p>
        {a.ratio !== null && (
          <div className="mt-4">
            <div className="relative h-3 rounded-full bg-charcoal/10">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
              <span className="absolute top-0 h-3 w-px bg-charcoal/50" style={{ left: `${LIMITS.warn * 100}%` }} />
              <span className="absolute top-0 h-3 w-px bg-charcoal/50" style={{ left: `${LIMITS.danger * 100}%` }} />
            </div>
            <div className="relative mt-1 h-4 text-[10px] text-charcoal/60">
              <span className="absolute -translate-x-1/2" style={{ left: `${LIMITS.warn * 100}%` }}>70%</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${LIMITS.danger * 100}%` }}>90%</span>
              <span className="absolute right-0">100%</span>
            </div>
          </div>
        )}
        {noData && <p className="mt-3 text-sm text-charcoal/70">Catat pemasukan dan pengeluaran bulan ini, lalu asisten akan mulai menganalisis.</p>}
      </div>

      {/* 2. Ringkasan bulanan */}
      <h2 className="mt-5 text-lg font-bold text-navy">Ringkasan bulan ini</h2>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className={card}><p className="text-xs text-charcoal/60">Pemasukan</p><p className="font-bold text-emerald">{rupiah(s.income)}</p></div>
        <div className={card}><p className="text-xs text-charcoal/60">Pengeluaran</p><p className="font-bold">{rupiah(s.expense)}</p></div>
        <div className={card}><p className="text-xs text-charcoal/60">Selisih</p><p className={`font-bold ${s.net < 0 ? "text-red-700" : ""}`}>{rupiah(s.net)}</p></div>
        <div className={card}><p className="text-xs text-charcoal/60">Sisa dari pemasukan</p><p className="font-bold">{s.savingsRate === null ? "–" : `${s.savingsRate < 0 ? "−" : ""}${Math.abs(Math.round(s.savingsRate * 100))}%`}</p></div>
        <div className={card}><p className="text-xs text-charcoal/60">Rata-rata per hari</p><p className="font-bold">{rupiah(Math.round(s.avgPerDay))}</p><p className="text-[11px] text-charcoal/50">{s.expenseCount} transaksi, {s.day} hari</p></div>
        <div className={card}>
          <p className="text-xs text-charcoal/60">Pengeluaran tunggal terbesar</p>
          {s.biggest ? <><p className="font-bold">{rupiah(s.biggest.amount)}</p><p className="truncate text-[11px] text-charcoal/50">{catIcon(s.biggest.name)} {s.biggest.name}</p></> : <p className="font-bold">–</p>}
        </div>
      </div>
      <p className="mt-2 text-sm text-charcoal/70">
        {s.expenseChange === null
          ? s.hasPrev ? "Belum ada pengeluaran di tanggal yang sama bulan lalu untuk dibandingkan." : "Data bulan lalu belum dimuat."
          : `Pengeluaran ${s.expenseChange >= 0 ? "▲ naik" : "▼ turun"} ${Math.abs(Math.round(s.expenseChange * 100))}% dibanding tanggal 1–${s.day} bulan lalu (${rupiah(s.pExpense)}).`}
      </p>

      {/* 3. Pengeluaran terbesar */}
      <h2 className="mt-5 text-lg font-bold text-navy">Pengeluaran terbesar</h2>
      <div className={`${card} mt-2`}>
        {s.top.length === 0 ? <p className="text-sm text-charcoal/60">Belum ada pengeluaran bulan ini.</p> : (
          <ul className="space-y-3">
            {s.top.slice(0, 3).map((c, i) => (
              <li key={c.name}>
                <div className="flex justify-between text-sm"><span className="font-medium">{["🥇", "🥈", "🥉"][i]} {catIcon(c.name)} {c.name}</span><span>{rupiah(c.amount)} · {Math.floor((c.amount / s.expense) * 100)}%</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-charcoal/10"><div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${(c.amount / s.expense) * 100}%` }} /></div>
                <p className="mt-0.5 text-[11px] text-charcoal/50">{c.count} transaksi</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 4. Saran penghematan */}
      <h2 className="mt-5 text-lg font-bold text-navy">Saran untuk Anda</h2>
      <div className="mt-2 space-y-2">
        {tips.tips.map((t) => (
          <button key={t.id} onClick={() => setOpenTip(openTip === t.id ? null : t.id)} className={`${card} block w-full text-left`}>
            <p className="font-semibold">{t.icon} {t.title}</p>
            <p className="mt-1 text-sm">{t.body}</p>
            {openTip === t.id ? <p className="mt-2 rounded-xl bg-charcoal/5 p-2 text-xs text-charcoal/70">Dasar data: {t.basis}</p> : <p className="mt-1 text-[11px] text-charcoal/50">Ketuk untuk melihat dasar data</p>}
          </button>
        ))}
        {tips.note && <div className={card}><p className="text-sm text-charcoal/70">{tips.note}</p></div>}
      </div>

      {/* 5. Estimasi sisa saldo */}
      <h2 className="mt-5 text-lg font-bold text-navy">Estimasi sisa saldo</h2>
      <div className={`${card} mt-2`}>
        {f.sufficient ? (
          <>
            <p className="text-xs text-charcoal/60">Perkiraan saldo akhir bulan (tanpa pemasukan baru)</p>
            <p className={`text-2xl font-bold ${(f.endBalance ?? 0) < 0 ? "text-red-700" : "text-navy"}`}>{rupiah(Math.round(f.endBalance ?? 0))}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-charcoal/5 p-2"><p className="text-charcoal/60">Saldo kini</p><p className="font-semibold">{rupiah(ctx.balance)}</p></div>
              <div className="rounded-xl bg-charcoal/5 p-2"><p className="text-charcoal/60">Rata-rata/hari</p><p className="font-semibold">{rupiah(Math.round(f.avgDaily ?? 0))}</p></div>
              <div className="rounded-xl bg-charcoal/5 p-2"><p className="text-charcoal/60">Bertahan</p><p className="font-semibold">{f.coverDays === null || f.coverDays === undefined ? "–" : `≈ ${f.coverDays} hari`}</p></div>
            </div>
            <p className="mt-3 text-xs text-charcoal/60">Dihitung dari rata-rata pengeluaran {f.observedDays} hari terakhir ({f.count} transaksi) × {f.remainingDays} hari tersisa. Pengeluaran besar tak terduga atau pemasukan baru akan mengubah hasilnya.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">Data belum cukup untuk estimasi</p>
            <p className="mt-1 text-sm text-charcoal/70">{f.reason}</p>
            <div className="mt-3 space-y-2 text-xs">
              <div><div className="flex justify-between"><span>Hari pencatatan</span><span>{f.observedDays}/{LIMITS.fcDays}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-charcoal/10"><div className="h-full bg-emerald" style={{ width: `${Math.min(100, (f.observedDays / LIMITS.fcDays) * 100)}%` }} /></div></div>
              <div><div className="flex justify-between"><span>Transaksi pengeluaran</span><span>{f.count}/{LIMITS.fcTx}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-charcoal/10"><div className="h-full bg-emerald" style={{ width: `${Math.min(100, (f.count / LIMITS.fcTx) * 100)}%` }} /></div></div>
            </div>
          </>
        )}
      </div>

      {/* 6. Tanya asisten */}
      <h2 className="mt-5 text-lg font-bold text-navy">Tanya Asisten</h2>
      <div className={`${card} mt-2`}>
        <div className="chips -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {SUGGESTED.map((q) => (
            <button key={q} onClick={() => ask(q)} disabled={busy} className="shrink-0 rounded-full border border-charcoal/15 px-3 py-1.5 text-xs disabled:opacity-50">{q}</button>
          ))}
        </div>
        <div className="mt-2 max-h-[26rem] space-y-2 overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={`rise max-w-[88%] rounded-2xl px-3 py-2 ${m.role === "user" ? "ml-auto rounded-br-md bg-navy text-white" : "rounded-bl-md bg-charcoal/5"}`}>
              <Bubble text={m.text} />
            </div>
          ))}
          {busy && <div className="max-w-[40%] rounded-2xl rounded-bl-md bg-charcoal/5 px-3 py-2 text-sm text-charcoal/60">Menghitung…</div>}
          <div ref={endRef} />
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-charcoal/15 bg-white px-3 py-2.5 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30"
            placeholder="Contoh: berapa pengeluaran makanan bulan ini?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(input); }}
          />
          <button onClick={() => ask(input)} disabled={busy || !input.trim()} className="rounded-xl bg-emerald px-4 font-medium text-white disabled:opacity-50">Kirim</button>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-charcoal/50">Analisis otomatis berbasis aturan dari transaksi Anda sendiri (bukan AI generatif). Transfer, tabungan, dan utang tidak dihitung sebagai pemasukan/pengeluaran. Ini bukan nasihat keuangan profesional.</p>
    </section>
  );
}
