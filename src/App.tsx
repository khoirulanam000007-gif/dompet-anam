import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { rupiah } from "./lib/format";
import type { Account, Category, Tx } from "./lib/types";
import Login from "./pages/Login";
import Transactions from "./pages/Transactions";
import TransactionForm from "./components/TransactionForm";
import TransferForm from "./components/TransferForm";
import More from "./pages/More";
import Analysis from "./pages/Analysis";
import Plans from "./pages/Plans";

function Main({ session }: { session: Session }) {
  const [tab, setTab] = useState<"beranda" | "transaksi" | "analisis" | "rencana" | "lainnya">("beranda");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [monthTx, setMonthTx] = useState<{ type: string; amount: number }[]>([]);
  const [transfer, setTransfer] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ open: boolean; editing: Tx | null }>({ open: false, editing: null });

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

  useEffect(() => { load(); }, [load]);

  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const sum = (type: string) => monthTx.filter((x) => x.type === type).reduce((s, x) => s + x.amount, 0);
  const income = sum("income");
  const expense = sum("expense");

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-28">
      <header className="flex items-center justify-between bg-navy px-5 py-4 text-white">
        <span className="font-semibold tracking-wide">DOMPET ANAM</span>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-white/80 underline">Keluar</button>
      </header>

      {error && <p className="px-5 pt-3 text-sm text-red-700">{error}</p>}

      {tab === "beranda" ? (
        <>
          <section className="bg-navy px-5 pb-6 pt-2 text-white">
            <p className="text-sm text-white/70">Total saldo</p>
            <p className="mt-1 text-4xl font-semibold">{loaded ? rupiah(total) : "..."}</p>
            <div className="mt-3 h-0.5 w-10 bg-gold" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-white/70">Pemasukan bulan ini</p>
                <p className="font-semibold text-emerald-300">{rupiah(income)}</p>
              </div>
              <div>
                <p className="text-sm text-white/70">Pengeluaran bulan ini</p>
                <p className="font-semibold">{rupiah(expense)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/70">Selisih bulan ini: {rupiah(income - expense)}</p>
          </section>

          <section className="px-5 pt-6">
            <h2 className="text-lg font-semibold text-navy">Rekening</h2>
            <ul className="mt-3 space-y-2">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <span>{a.name}</span>
                  <span className="font-medium">{rupiah(a.balance)}</span>
                </li>
              ))}
            </ul>
            <h2 className="mt-6 text-lg font-semibold text-navy">Transaksi terbaru</h2>
          </section>
          <Transactions
            txs={txs.slice(0, 5)}
            accounts={accounts}
            categories={categories}
            onEdit={(t) => setForm({ open: true, editing: t })}
            onChanged={load}
          />
          <p className="px-5 pt-6 text-xs text-charcoal/60">Masuk sebagai {session.user.email}</p>
        </>
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
        className="fixed bottom-20 right-5 z-20 h-14 w-14 rounded-full bg-emerald text-3xl leading-none text-white shadow-lg"
      >
        +
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-charcoal/10 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {([["beranda", "Beranda"], ["transaksi", "Transaksi"], ["analisis", "Analisis"], ["rencana", "Rencana"], ["lainnya", "Lainnya"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`py-4 text-xs font-medium ${tab === k ? "border-t-2 border-gold text-navy" : "text-charcoal/60"}`}
            >
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="p-6 text-charcoal/60">Memuat...</div>;
  return session ? <Main session={session} /> : <Login />;
}
