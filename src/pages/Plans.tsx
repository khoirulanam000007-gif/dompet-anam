import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { confirmBox, toast } from "../lib/ui";
import { rupiah } from "../lib/format";
import { fmtDate } from "../lib/types";
import type { Account, Category } from "../lib/types";
import { processRecurring } from "../lib/recurring";
import { catIcon } from "../lib/icons";

type Budget = { id: string; category_id: string; limit_amount: number };
type Goal = { id: string; name: string; target_amount: number; target_date: string | null; saved_amount: number };
type GTx = { id: string; type: string; amount: number; goal_id: string; occurred_at: string };

const field = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";
const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 12);
const money = (d: string) => (d ? Number(d).toLocaleString("id-ID") : "");
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

function Ring({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct)), C = 125.66;
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 shrink-0" role="img" aria-label={`${p} persen`}>
      <circle cx="24" cy="24" r="20" fill="none" strokeWidth="5" stroke="currentColor" className="text-charcoal/10" />
      <circle cx="24" cy="24" r="20" fill="none" strokeWidth="5" strokeLinecap="round" stroke="#0f9d6b" className="ring-arc" strokeDasharray={C} strokeDashoffset={C * (1 - p / 100)} transform="rotate(-90 24 24)" />
      <text x="24" y="27.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{p}%</text>
    </svg>
  );
}

function goalHint(g: { saved_amount: number; target_amount: number; target_date: string | null }) {
  const left = g.target_amount - g.saved_amount;
  if (left <= 0) return { text: "🎉 Target tercapai! Selamat.", cls: "text-emerald font-medium" };
  if (!g.target_date) return { text: `Sisa ${rupiah(left)} lagi.`, cls: "text-charcoal/70" };
  const days = Math.ceil((new Date(g.target_date).getTime() - Date.now()) / 86400000);
  if (days <= 0) return { text: `Tanggal target sudah lewat. Sisa ${rupiah(left)}.`, cls: "text-red-700" };
  const months = Math.max(1, Math.round(days / 30.4));
  const per = Math.ceil(left / months / 1000) * 1000;
  return { text: `Setor sekitar ${rupiah(per)} per bulan agar tepat waktu (±${months} bulan lagi).`, cls: "text-navy" };
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fade-in fixed inset-0 z-30 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="sheet-up max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5 sm:rounded-3xl">
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
    if (!(await confirmBox("Hapus anggaran ini?", { okLabel: "Hapus" }))) return;
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
              <div className="flex justify-between"><span className="font-medium">{catIcon(catName(b.category_id))} {catName(b.category_id)}</span><span>{pct}%</span></div>
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
    if (!(await confirmBox(`Hapus target ${g.name}?`, { okLabel: "Hapus" }))) return;
    const { error } = await supabase.from("savings_goals").delete().eq("id", g.id);
    if (error) toast("Target ini sudah punya setoran. Hapus dulu riwayat setorannya di menu Transaksi.", "error");
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
              <div className="flex items-center gap-3">
                <Ring pct={pct} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.name}</p>
                  <p className="text-sm text-charcoal/70">{rupiah(g.saved_amount)} dari {rupiah(g.target_amount)}</p>
                </div>
              </div>
              <p className={`mt-2 text-sm ${goalHint(g).cls}`}>{goalHint(g).text}</p>
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

type Debt = {
  id: string; kind: "borrowed" | "lent"; person_name: string; amount: number;
  due_date: string | null; note: string | null; paid_amount: number; remaining_amount: number; is_paid: boolean;
};
type DTx = { id: string; type: string; amount: number; debt_id: string; occurred_at: string };
const DLABEL: Record<string, string> = {
  debt_borrow: "Pinjaman diterima", loan_give: "Pinjaman diberikan",
  debt_repay: "Pembayaran", loan_receive: "Penerimaan pembayaran",
};

function Debts({ accounts, onChanged }: { accounts: Account[]; onChanged: () => void }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [dtx, setDtx] = useState<DTx[]>([]);
  const [hist, setHist] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [kind, setKind] = useState<"borrowed" | "lent">("borrowed");
  const [person, setPerson] = useState("");
  const [amt, setAmt] = useState("");
  const [accId, setAccId] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [pay, setPay] = useState<Debt | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [d, t] = await Promise.all([
      supabase.from("debt_status").select("id,kind,person_name,amount,due_date,note,paid_amount,remaining_amount,is_paid").order("is_paid").order("due_date", { nullsFirst: false }),
      supabase.from("transactions").select("id,type,amount,debt_id,occurred_at").not("debt_id", "is", null).order("occurred_at", { ascending: false }).limit(300),
    ]);
    setDebts((d.data ?? []).map((x) => ({ ...x, amount: Number(x.amount), paid_amount: Number(x.paid_amount), remaining_amount: Number(x.remaining_amount) })) as Debt[]);
    setDtx((t.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as DTx[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const owe = debts.filter((d) => d.kind === "borrowed").reduce((s, d) => s + d.remaining_amount, 0);
  const owed = debts.filter((d) => d.kind === "lent").reduce((s, d) => s + d.remaining_amount, 0);

  function openForm() {
    setErr(""); setKind("borrowed"); setPerson(""); setAmt(""); setDue(""); setNote(""); setAccId(accounts[0]?.id ?? ""); setForm(true);
  }

  async function saveDebt() {
    const n = Number(amt);
    const acc = accounts.find((a) => a.id === accId);
    if (!person.trim() || n <= 0 || !acc) return setErr("Isi nama, nominal, dan rekening.");
    if (kind === "lent" && n > acc.balance) return setErr(`Saldo ${acc.name} hanya ${rupiah(acc.balance)}.`);
    setBusy(true);
    const { data, error } = await supabase.from("debts")
      .insert({ kind, person_name: person.trim(), amount: n, due_date: due || null, note: note.trim() || null })
      .select("id").single();
    if (error || !data) { setBusy(false); return setErr("Gagal menyimpan. Coba lagi."); }
    const { error: e2 } = await supabase.from("transactions")
      .insert({ type: kind === "borrowed" ? "debt_borrow" : "loan_give", amount: n, account_id: accId, debt_id: data.id });
    if (e2) {
      await supabase.from("debts").delete().eq("id", data.id);
      setBusy(false);
      return setErr("Gagal menyimpan. Coba lagi.");
    }
    setBusy(false); setForm(false); load(); onChanged();
  }

  function openPay(d: Debt) { setErr(""); setPayAmt(""); setAccId(accounts[0]?.id ?? ""); setPay(d); }

  async function savePay() {
    const n = Number(payAmt);
    const acc = accounts.find((a) => a.id === accId);
    if (!pay || n <= 0 || !acc) return setErr("Isi nominal dan pilih rekening.");
    if (n > pay.remaining_amount) return setErr(`Sisa hanya ${rupiah(pay.remaining_amount)}.`);
    if (pay.kind === "borrowed" && n > acc.balance) return setErr(`Saldo ${acc.name} hanya ${rupiah(acc.balance)}.`);
    setBusy(true);
    const { error } = await supabase.from("transactions")
      .insert({ type: pay.kind === "borrowed" ? "debt_repay" : "loan_receive", amount: n, account_id: accId, debt_id: pay.id });
    setBusy(false);
    if (error) return setErr("Gagal menyimpan. Coba lagi.");
    setPay(null); load(); onChanged();
  }

  async function remove(d: Debt) {
    if (!(await confirmBox(`Hapus catatan ${d.person_name} beserta semua pembayarannya? Saldo rekening akan dihitung ulang.`, { okLabel: "Hapus" }))) return;
    const a = await supabase.from("transactions").delete().eq("debt_id", d.id);
    const b = a.error ? a : await supabase.from("debts").delete().eq("id", d.id);
    if (b.error) toast("Gagal menghapus. Coba lagi.", "error");
    load(); onChanged();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-navy p-4 text-white">
        <div><p className="text-sm text-white/70">Utang saya</p><p className="font-semibold">{rupiah(owe)}</p></div>
        <div><p className="text-sm text-white/70">Piutang saya</p><p className="font-semibold">{rupiah(owed)}</p></div>
      </div>
      <button onClick={openForm} className="mt-3 w-full rounded-xl bg-navy py-2.5 text-white">Tambah catatan</button>
      {debts.length === 0 && <p className="mt-4 text-charcoal/70">Belum ada catatan utang atau piutang.</p>}

      <ul className="mt-3 space-y-2">
        {debts.map((d) => {
          const late = !d.is_paid && d.due_date && d.due_date < today;
          const items = dtx.filter((x) => x.debt_id === d.id);
          return (
            <li key={d.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="flex justify-between">
                <span className="font-medium">{d.kind === "borrowed" ? `Utang ke ${d.person_name}` : `Piutang dari ${d.person_name}`}</span>
                <span className={d.is_paid ? "text-emerald" : late ? "text-red-700" : ""}>{d.is_paid ? "Lunas" : late ? "Terlambat" : "Belum lunas"}</span>
              </div>
              <p className="mt-1 text-sm">Total {rupiah(d.amount)} · terbayar {rupiah(d.paid_amount)}</p>
              <p className="text-sm font-medium">Sisa {rupiah(d.remaining_amount)}</p>
              {d.due_date && <p className="text-sm text-charcoal/60">Jatuh tempo: {new Date(d.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>}
              {d.note && <p className="text-sm">{d.note}</p>}
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                {!d.is_paid && <button onClick={() => openPay(d)} className="text-emerald underline">{d.kind === "borrowed" ? "Bayar" : "Terima pembayaran"}</button>}
                <button onClick={() => setHist(hist === d.id ? null : d.id)} className="underline">Riwayat</button>
                <button onClick={() => remove(d)} className="text-red-700 underline">Hapus</button>
              </div>
              {hist === d.id && (
                <ul className="mt-2 space-y-1 border-t border-charcoal/10 pt-2 text-sm">
                  {items.map((x) => (
                    <li key={x.id} className="flex justify-between"><span>{DLABEL[x.type] ?? x.type} · {fmtDate(x.occurred_at)}</span><span>{rupiah(x.amount)}</span></li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {form && (
        <Sheet title="Tambah catatan" onClose={() => setForm(false)}>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-charcoal/10 p-1">
            {([["borrowed", "Saya meminjam"], ["lent", "Saya meminjamkan"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setKind(k)} className={`rounded-lg py-2 text-sm font-medium ${kind === k ? "bg-navy text-white" : ""}`}>{l}</button>
            ))}
          </div>
          <input className={field} placeholder="Nama orang" value={person} onChange={(e) => setPerson(e.target.value)} />
          <input className={`${field} text-xl font-semibold`} inputMode="numeric" placeholder="Nominal (Rp)" value={money(amt)} onChange={(e) => setAmt(onlyDigits(e.target.value))} />
          <div>
            <label className="text-sm text-charcoal/70">{kind === "borrowed" ? "Uang masuk ke rekening" : "Uang keluar dari rekening"}</label>
            <select className={field} value={accId} onChange={(e) => setAccId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({rupiah(a.balance)})</option>)}
            </select>
          </div>
          <div><label className="text-sm text-charcoal/70">Jatuh tempo (opsional)</label>
            <input className={field} type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <input className={field} placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <p className="text-sm text-red-700">{err}</p>}
          <Save busy={busy} onClick={saveDebt} />
        </Sheet>
      )}

      {pay && (
        <Sheet title={pay.kind === "borrowed" ? `Bayar utang ke ${pay.person_name}` : `Terima dari ${pay.person_name}`} onClose={() => setPay(null)}>
          <p className="text-sm">Sisa: {rupiah(pay.remaining_amount)}</p>
          <select className={field} value={accId} onChange={(e) => setAccId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({rupiah(a.balance)})</option>)}
          </select>
          <input className={`${field} text-xl font-semibold`} inputMode="numeric" placeholder="Nominal (Rp)" value={money(payAmt)} onChange={(e) => setPayAmt(onlyDigits(e.target.value))} />
          {err && <p className="text-sm text-red-700">{err}</p>}
          <Save busy={busy} onClick={savePay} label={pay.kind === "borrowed" ? "Bayar" : "Terima"} />
        </Sheet>
      )}
    </div>
  );
}

type Rule = { id: string; name: string; type: "income" | "expense"; amount: number; account_id: string; category_id: string | null; frequency: string; next_run_date: string; active: boolean };
const FREQ: Record<string, string> = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan" };

function Recurring({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amt, setAmt] = useState("");
  const [accId, setAccId] = useState("");
  const [catId, setCatId] = useState("");
  const [freq, setFreq] = useState("monthly");
  const [date, setDate] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("recurring_rules").select("id,name,type,amount,account_id,category_id,frequency,next_run_date,active").order("next_run_date");
    setRules((data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as Rule[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  function open() {
    setErr(""); setName(""); setAmt(""); setCatId(""); setFreq("monthly"); setType("expense");
    setDate(new Date().toISOString().slice(0, 10)); setAccId(accounts[0]?.id ?? ""); setForm(true);
  }
  async function save() {
    if (!name.trim() || Number(amt) <= 0 || !accId || !date) return setErr("Isi nama, nominal, rekening, dan tanggal mulai.");
    setBusy(true);
    const { error } = await supabase.from("recurring_rules").insert({
      name: name.trim(), type, amount: Number(amt), account_id: accId, category_id: catId || null, frequency: freq, next_run_date: date,
    });
    setBusy(false);
    if (error) return setErr("Gagal menyimpan. Coba lagi.");
    setForm(false); await processRecurring(); load();
  }
  async function toggle(r: Rule) { await supabase.from("recurring_rules").update({ active: !r.active }).eq("id", r.id); load(); }
  async function remove(r: Rule) {
    if (!(await confirmBox(`Hapus jadwal ${r.name}?`, { okLabel: "Hapus" }))) return;
    const { error } = await supabase.from("recurring_rules").delete().eq("id", r.id);
    if (error) toast("Jadwal ini sudah membuat transaksi, jadi tidak bisa dihapus. Pakai tombol Jeda saja.", "error");
    else load();
  }
  const cats = categories.filter((c) => c.kind === type);

  return (
    <div className="mt-4">
      <button onClick={open} className="w-full rounded-xl bg-navy py-2.5 text-white">Tambah jadwal</button>
      <p className="mt-2 text-xs text-charcoal/60">Transaksi dibuat otomatis saat aplikasi dibuka setelah tanggal jatuh tempo, dan tidak akan tercatat ganda.</p>
      {rules.length === 0 && <p className="mt-4 text-charcoal/70">Belum ada transaksi berulang.</p>}
      <ul className="mt-3 space-y-2">
        {rules.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <div className="flex justify-between"><span className="font-medium">{r.name}</span><span className={r.type === "income" ? "text-emerald" : ""}>{r.type === "income" ? "+" : "-"}{rupiah(r.amount)}</span></div>
            <p className="text-sm text-charcoal/60">{FREQ[r.frequency]} · berikutnya {new Date(r.next_run_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}{r.active ? "" : " · dijeda"}</p>
            <div className="mt-2 flex gap-4 text-sm">
              <button onClick={() => toggle(r)} className="text-navy underline">{r.active ? "Jeda" : "Aktifkan"}</button>
              <button onClick={() => remove(r)} className="text-red-700 underline">Hapus</button>
            </div>
          </li>
        ))}
      </ul>
      {form && (
        <Sheet title="Tambah jadwal" onClose={() => setForm(false)}>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-charcoal/10 p-1">
            {([["expense", "Pengeluaran"], ["income", "Pemasukan"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setType(k); setCatId(""); }} className={`rounded-lg py-2 text-sm font-medium ${type === k ? "bg-navy text-white" : ""}`}>{l}</button>
            ))}
          </div>
          <input className={field} placeholder="Nama (contoh: Listrik, Gaji)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={`${field} text-xl font-semibold`} inputMode="numeric" placeholder="Nominal (Rp)" value={money(amt)} onChange={(e) => setAmt(onlyDigits(e.target.value))} />
          <select className={field} value={accId} onChange={(e) => setAccId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <select className={field} value={catId} onChange={(e) => setCatId(e.target.value)}>
            <option value="">Tanpa kategori</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={field} value={freq} onChange={(e) => setFreq(e.target.value)}>{Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <div><label className="text-sm text-charcoal/70">Tanggal mulai</label><input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {err && <p className="text-sm text-red-700">{err}</p>}
          <Save busy={busy} onClick={save} />
        </Sheet>
      )}
    </div>
  );
}

export default function Plans({ accounts, categories, onChanged }: { accounts: Account[]; categories: Category[]; onChanged: () => void }) {
  const [view, setView] = useState<"anggaran" | "tabungan" | "utang" | "berulang">("anggaran");
  return (
    <section className="px-5 pt-5">
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-charcoal/10 p-1">
        {(["anggaran", "tabungan", "utang", "berulang"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`rounded-lg py-2 text-sm font-medium capitalize ${view === v ? "bg-navy text-white" : ""}`}>{v}</button>
        ))}
      </div>
      {view === "anggaran" ? <Budgets categories={categories} /> : view === "tabungan" ? <Savings accounts={accounts} onChanged={onChanged} /> : view === "utang" ? <Debts accounts={accounts} onChanged={onChanged} /> : <Recurring accounts={accounts} categories={categories} />}
    </section>
  );
}
