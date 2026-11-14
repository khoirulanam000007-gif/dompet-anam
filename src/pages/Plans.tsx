import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { rupiah } from "../lib/format";
import { fmtDate } from "../lib/types";
import type { Account, Category } from "../lib/types";

type Budget = { id: string; category_id: string; limit_amount: number };
type Goal = { id: string; name: string; target_amount: number; target_date: string | null; saved_amount: number };
type GTx = { id: string; type: string; amount: number; goal_id: string; occurred_at: string };

const field = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";
const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 12);
const money = (d: string) => (d ? Number(d).toLocaleString("id-ID") : "");
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy">{title}</h3>
          <button onClick={onClose} className="text-sm underline">Tutup</button>
        </div>
        <div className="mt-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

const Save = ({ busy, onClick, label = "Simpan" }: { busy: boolean; onClick: () => void; label?: string }) => (
  <button onClick={onClick} disabled={busy} className="w-full rounded-xl bg-emerald py-3 font-medium text-white disabled:opacity-60">
    {busy ? "Menyimpan..." : label}
  </button>
);

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-charcoal/10">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function Budgets({ categories }: { categories: Category[] }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spent, setSpent] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Budget | "new" | null>(null);
  const [catId, setCatId] = useState("");
  const [digits, setDigits] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const cats = categories.filter((c) => c.kind === "expense");

  const load = useCallback(async () => {
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const [b, t] = await Promise.all([
      supabase.from("budgets").select("id,category_id,limit_amount").eq("month", monthKey(month)),
      supabase.from("transactions").select("category_id,amount").eq("type", "expense")
        .gte("occurred_at", month.toISOString()).lt("occurred_at", end.toISOString()),
    ]);
    setBudgets((b.data ?? []).map((x) => ({ ...x, limit_amount: Number(x.limit_amount) })));
    const m: Record<string, number> = {};
    (t.data ?? []).forEach((x) => { if (x.category_id) m[x.category_id] = (m[x.category_id] ?? 0) + Number(x.amount); });
    setSpent(m);
  }, [month]);
  useEffect(() => { load(); }, [load]);

  function open(b: Budget | "new") {
    setErr(""); setEditing(b);
    if (b === "new") { setCatId(cats[0]?.id ?? ""); setDigits(""); }
    else { setCatId(b.category_id); setDigits(String(b.limit_amount)); }
  }

  async function save() {
    if (!catId || Number(digits) <= 0) return setErr("Pilih kategori dan isi batas lebih dari 0.");
    setBusy(true);
    const q = editing === "new"
      ? supabase.from("budgets").insert({ category_id: catId, month: monthKey(month), limit_amount: Number(digits) })
      : supabase.from("budgets").update({ limit_amount: Number(digits) }).eq("id", (editing as Budget).id);
    const { error } = await q;
    setBusy(false);
    if (error) return setErr(error.code === "23505" ? "Kategori ini sudah punya anggaran bulan ini." : "Gagal menyimpan. Coba lagi.");
    setEditing(null); load();
  }

  async function remove(b: Budget) {
    if (!window.confirm("Hapus anggaran ini?")) return;
    await supabase.from("budgets").delete().eq("id", b.id);
    load();
  }

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "-";

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="px-3 py-1 text-lg">‹</button>
        <span className="font-medium">{month.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</span>
        <button onClick={() => shift(1)} className="px-3 py-1 text-lg">›</button>
      </div>
      <button onClick={() => open("new")} className="mt-3 w-full rounded-xl bg-navy py-2.5 text-white">Tambah anggaran</button>

      {budgets.length === 0 && <p className="mt-4 text-charcoal/70">Belum ada anggaran bulan ini.</p>}
      <ul className="mt-3 space-y-2">
        {budgets.map((b) => {
          const used = spent[b.category_id] ?? 0;
          const pct = Math.round((used / b.limit_amount) * 100);
          const over = pct >= 100, warn = pct >= 80;
          return (
            <li key={b.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="flex justify-between"><span className="font-medium">{catName(b.category_id)}</span><span>{pct}%</span></div>
              <Bar pct={pct} color={over ? "bg-red-600" : warn ? "bg-gold" : "bg-emerald"} />
              <p className="mt-2 text-sm">Terpakai {rupiah(used)} dari {rupiah(b.limit_amount)}</p>
              <p className={`text-sm ${over ? "text-red-700" : "text-charcoal/70"}`}>
                {over ? `Melebihi ${rupiah(used - b.limit_amount)}` : `Sisa ${rupiah(b.limit_amount - used)}`}
                {warn && !over ? " · hampir habis" : ""}
              </p>
              <div className="mt-2 flex gap-4 text-sm">
                <button onClick={() => open(b)} className="text-navy underline">Ubah</button>
                <button onClick={() => remove(b)} className="text-red-700 underline">Hapus</button>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <Sheet title={editing === "new" ? "Tambah anggaran" : "Ubah anggaran"} onClose={() => setEditing(null)}>
          <select className={field} value={catId} disabled={editing !== "new"} onChange={(e) => setCatId(e.target.value)}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className={field} inputMode="numeric" placeholder="Batas pengeluaran (Rp)" value={money(digits)} onChange={(e) => setDigits(onlyDigits(e.target.value))} />
          {err && <p className="text-sm text-red-700">{err}</p>}
          <Save busy={busy} onClick={save} />
        </Sheet>
      )}
    </div>
  );
}

function Savings({ accounts, onChanged }: { accounts: Account[]; onChanged: () => void }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [gtx, setGtx] = useState<GTx[]>([]);
  const [showHist, setShowHist] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState(false);
  const [gName, setGName] = useState("");
  const [gTarget, setGTarget] = useState("");
  const [gDate, setGDate] = useState("");
  const [mv, setMv] = useState<{ goal: Goal; mode: "saving_deposit" | "saving_withdraw" } | null>(null);
  const [accId, setAccId] = useState("");
  const [amt, setAmt] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [g, t] = await Promise.all([
      supabase.from("goal_progress").select("id,name,target_amount,target_date,saved_amount").order("name"),
      supabase.from("transactions").select("id,type,amount,goal_id,occurred_at").not("goal_id", "is", null).order("occurred_at", { ascending: false }).limit(200),
    ]);
    setGoals((g.data ?? []).map((x) => ({ ...x, target_amount: Number(x.target_amount), saved_amount: Number(x.saved_amount) })));
    setGtx((t.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as GTx[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveGoal() {
    if (!gName.trim() || Number(gTarget) <= 0) return setErr("Isi nama dan target lebih dari 0.");
    setBusy(true);
    const { error } = await supabase.from("savings_goals").insert({ name: gName.trim(), target_amount: Number(gTarget), target_date: gDate || null });
    setBusy(false);
    if (error) return setErr("Gagal menyimpan. Coba lagi.");
    setGoalForm(false); load();
  }

  function openMv(goal: Goal, mode: "saving_deposit" | "saving_withdraw") {
    setErr(""); setAmt(""); setAccId(accounts[0]?.id ?? ""); setMv({ goal, mode });
  }

  async function saveMv() {
    if (!mv) return;
    const n = Number(amt);
    const acc = accounts.find((a) => a.id === accId);
    if (n <= 0 || !acc) return setErr("Isi nominal dan pilih rekening.");
    if (mv.mode === "saving_deposit" && n > acc.balance) return setErr(`Saldo ${acc.name} hanya ${rupiah(acc.balance)}.`);
    if (mv.mode === "saving_withdraw" && n > mv.goal.saved_amount) return setErr(`Tabungan hanya ${rupiah(mv.goal.saved_amount)}.`);
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({ type: mv.mode, amount: n, account_id: accId, goal_id: mv.goal.id });
    setBusy(false);
    if (error) return setErr("Gagal menyimpan. Coba lagi.");
    setMv(null); load(); onChanged();
  }

  async function removeGoal(g: Goal) {
    if (!window.confirm(`Hapus target ${g.name}?`)) return;
    const { error } = await supabase.from("savings_goals").delete().eq("id", g.id);
    if (error) window.alert("Target ini sudah punya setoran. Hapus dulu riwayat setorannya di menu Transaksi.");
    else load();
  }

  return (
    <div className="mt-4">
      <button onClick={() => { setErr(""); setGName(""); setGTarget(""); setGDate(""); setGoalForm(true); }} className="w-full rounded-xl bg-navy py-2.5 text-white">Tambah target</button>
      {goals.length === 0 && <p className="mt-4 text-charcoal/70">Belum ada target tabungan.</p>}
      <ul className="mt-3 space-y-2">
        {goals.map((g) => {
          const pct = Math.round((g.saved_amount / g.target_amount) * 100);
          const hist = gtx.filter((x) => x.goal_id === g.id);
          return (
            <li key={g.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="flex justify-between"><span className="font-medium">{g.name}</span><span>{pct}%</span></div>
              <Bar pct={pct} color="bg-emerald" />
              <p className="mt-2 text-sm">{rupiah(g.saved_amount)} dari {rupiah(g.target_amount)}</p>
              {g.target_date && <p className="text-sm text-charcoal/60">Target: {new Date(g.target_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>}
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <button onClick={() => openMv(g, "saving_deposit")} className="text-emerald underline">Setor</button>
                <button onClick={() => openMv(g, "saving_withdraw")} className="text-navy underline">Tarik</button>
                <button onClick={() => setShowHist(showHist === g.id ? null : g.id)} className="underline">Riwayat</button>
                <button onClick={() => removeGoal(g)} className="text-red-700 underline">Hapus</button>
              </div>
              {showHist === g.id && (
                <ul className="mt-2 space-y-1 border-t border-charcoal/10 pt-2 text-sm">
                  {hist.length === 0 && <li className="text-charcoal/60">Belum ada setoran.</li>}
                  {hist.map((x) => (
                    <li key={x.id} className="flex justify-between">
                      <span>{x.type === "saving_deposit" ? "Setoran" : "Penarikan"} · {fmtDate(x.occurred_at)}</span>
                      <span>{x.type === "saving_deposit" ? "+" : "-"}{rupiah(x.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {goalForm && (
        <Sheet title="Tambah target tabungan" onClose={() => setGoalForm(false)}>
          <input className={field} placeholder="Nama target (contoh: Laptop)" value={gName} onChange={(e) => setGName(e.target.value)} />
          <input className={field} inputMode="numeric" placeholder="Target nominal (Rp)" value={money(gTarget)} onChange={(e) => setGTarget(onlyDigits(e.target.value))} />
          <div><label className="text-sm text-charcoal/70">Target tanggal (opsional)</label>
            <input className={field} type="date" value={gDate} onChange={(e) => setGDate(e.target.value)} /></div>
          {err && <p className="text-sm text-red-700">{err}</p>}
          <Save busy={busy} onClick={saveGoal} />
        </Sheet>
      )}

      {mv && (
        <Sheet title={`${mv.mode === "saving_deposit" ? "Setor ke" : "Tarik dari"} ${mv.goal.name}`} onClose={() => setMv(null)}>
          <select className={field} value={accId} onChange={(e) => setAccId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({rupiah(a.balance)})</option>)}
          </select>
          <input className={`${field} text-xl font-semibold`} inputMode="numeric" placeholder="Nominal (Rp)" value={money(amt)} onChange={(e) => setAmt(onlyDigits(e.target.value))} />
          {err && <p className="text-sm text-red-700">{err}</p>}
          <Save busy={busy} onClick={saveMv} label={mv.mode === "saving_deposit" ? "Setor" : "Tarik"} />
        </Sheet>
      )}
    </div>
  );
}

export default function Plans({ accounts, categories, onChanged }: { accounts: Account[]; categories: Category[]; onChanged: () => void }) {
  const [view, setView] = useState<"anggaran" | "tabungan">("anggaran");
  return (
    <section className="px-5 pt-5">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-charcoal/10 p-1">
        {(["anggaran", "tabungan"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`rounded-lg py-2 font-medium capitalize ${view === v ? "bg-navy text-white" : ""}`}>{v}</button>
        ))}
      </div>
      {view === "anggaran" ? <Budgets categories={categories} /> : <Savings accounts={accounts} onChanged={onChanged} />}
    </section>
  );
}
