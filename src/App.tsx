import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { rupiah } from "./lib/format";
import type { Account, Category, Tx } from "./lib/types";
import Login from "./pages/Login";
import { NewPassword, LockScreen } from "./pages/Settings";
import { processRecurring } from "./lib/recurring";
import Transactions from "./pages/Transactions";
import TransactionForm from "./components/TransactionForm";
import TransferForm from "./components/TransferForm";
import More from "./pages/More";
import Analysis from "./pages/Analysis";
import Home from "./pages/Home";
import Plans from "./pages/Plans";

const ICONS: Record<string, string> = {
  beranda: "M3 11l9-8 9 8M5 10v10h14V10",
  transaksi: "M4 6h16M4 12h16M4 18h10",
  analisis: "M4 20V10M10 20V4M16 20V14M21 20H3",
  rencana: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z",
  lainnya: "M5 12h.01M12 12h.01M19 12h.01",
};

function Main({ session }: { session: Session }) {
  const [tab, setTab] = useState<"beranda" | "transaksi" | "analisis" | "rencana" | "lainnya">("beranda");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [monthTx, setMonthTx] = useState<{ type: string; amount: number }[]>([]);
  const [transfer, setTransfer] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ open: boolean; editing: Tx | null; kind?: "income" | "expense" }>({ open: false, editing: null });

  const load = useCallback(async () => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const [a, c, t, m] = await Promise.all([
      supabase.from("account_balances").select("id,name,type,balance").order("name"),
      supabase.from("categories").select("id,name,kind").order("name"),
      supabase.from("transactions").select("id,type,amount,account_id,to_account_id,category_id,occurred_at,source,note").order("occurred_at", { ascending: false }).limit(200),
      supabase.from("transactions").select("type,amount").gte("occurred_at", start.toISOString()),
    ]);
    if (a.error || c.error || t.error || m.error) setError("Data belum bisa dimuat. Coba muat ulang halaman.");
    else setError("");
    setAccounts((a.data ?? []).map((x) => ({ ...x, balance: Number(x.balance) })));
    setCategories((c.data ?? []) as Category[]);
    setTxs((t.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
    setMonthTx((m.data ?? []).map((x) => ({ type: x.type, amount: Number(x.amount) })));
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    processRecurring().then((n) => { if (n > 0) load(); });
  }, [load]);

  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const sum = (type: string) => monthTx.filter((x) => x.type === type).reduce((s, x) => s + x.amount, 0);
  const income = sum("income");
  const expense = sum("expense");

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-28">
      <header className="no-print flex items-center justify-between bg-[#0b1f3a] px-5 py-4 text-white">
        <span className="font-semibold tracking-wide">DOMPET ANAM</span>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-white/80 underline">Keluar</button>
      </header>

      {error && <p className="px-5 pt-3 text-sm text-red-700">{error}</p>}

      {tab === "beranda" ? (
        <Home
          accounts={accounts}
          categories={categories}
          txs={txs}
          total={total}
          onAdd={(k) => setForm({ open: true, editing: null, kind: k })}
          onTransfer={() => setTransfer(true)}
          onEdit={(t) => setForm({ open: true, editing: t })}
          onChanged={load}
        />
      ) : tab === "analisis" ? (
        <Analysis categories={categories} />
      ) : tab === "lainnya" ? (
        <More accounts={accounts} categories={categories} onChanged={load} onTransfer={() => setTransfer(true)} />
      ) : tab === "rencana" ? (
        <Plans accounts={accounts} categories={categories} onChanged={load} />
      ) : (
        <>
          <h2 className="px-5 pt-5 text-lg font-semibold text-navy">Riwayat transaksi</h2>
          <Transactions
            searchable
            txs={txs}
            accounts={accounts}
            categories={categories}
            onEdit={(t) => setForm({ open: true, editing: t })}
            onChanged={load}
          />
        </>
      )}

      <button
        onClick={() => setForm({ open: true, editing: null })}
        aria-label="Tambah transaksi"
        className="no-print fixed bottom-20 right-5 z-20 h-14 w-14 rounded-full bg-emerald text-3xl leading-none text-white shadow-lg"
      >
        +
      </button>

      <nav className="no-print fixed inset-x-0 bottom-0 z-10 border-t border-charcoal/10 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {([["beranda", "Beranda"], ["transaksi", "Transaksi"], ["analisis", "Analisis"], ["rencana", "Rencana"], ["lainnya", "Lainnya"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`py-2.5 text-[11px] font-medium ${tab === k ? "border-t-2 border-gold text-navy" : "text-charcoal/60"}`}
            >
              <svg viewBox="0 0 24 24" className="mx-auto mb-0.5 h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[k]} /></svg>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {transfer && (
        <TransferForm accounts={accounts} onClose={() => setTransfer(false)} onSaved={() => { setTransfer(false); load(); }} />
      )}

      {form.open && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          editing={form.editing}
          defaultKind={form.kind}
          onClose={() => setForm({ open: false, editing: null })}
          onSaved={() => { setForm({ open: false, editing: null }); load(); }}
        />
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [locked, setLocked] = useState(!!localStorage.getItem("pin"));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="p-6 text-charcoal/60">Memuat...</div>;
  if (recovery && session) return <NewPassword onDone={() => setRecovery(false)} />;
  if (session && locked) return <LockScreen onUnlock={() => setLocked(false)} />;
  return session ? <Main session={session} /> : <Login />;
}
