import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { rupiah } from "./lib/format";
import type { Account, Category, Tx } from "./lib/types";
import Login from "./pages/Login";
import { NewPassword, LockScreen } from "./pages/Settings";
import { processRecurring } from "./lib/recurring";
import { loadProfile } from "./lib/profile";
import { getMode } from "./lib/lock";
import Transactions from "./pages/Transactions";
import TransactionForm from "./components/TransactionForm";
import TransferForm from "./components/TransferForm";
const Analysis = lazy(() => import("./pages/Analysis"));
const More = lazy(() => import("./pages/More"));
const Plans = lazy(() => import("./pages/Plans"));
import Home from "./pages/Home";
import PageHeader from "./components/PageHeader";
import HomeSkeleton from "./components/Skeleton";
import { toast } from "./lib/ui";
import StatusPills from "./components/StatusPills";
import InstallPrompt from "./components/InstallPrompt";
import { clearOfflineCache } from "./lib/offline";

const HEAD: Record<string, [string, string, string, [string, string]]> = {
  transaksi: ["Transaksi", "Semua catatan uang masuk dan keluar", "🧾", ["#0b1f3a", "#14527a"]],
  analisis: ["Analisis", "Pahami ke mana uang Anda pergi", "📈", ["#0b3a3a", "#0f8a63"]],
  rencana: ["Rencana", "Anggaran, tabungan, utang, dan jadwal", "🎯", ["#3a2a0b", "#9a7a2e"]],
  lainnya: ["Lainnya", "Rekening, kalender, laporan, dan pengaturan", "✨", ["#1a2236", "#3f5483"]],
};

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
    loadProfile();
    processRecurring().then((n) => { if (n > 0) load(); });
  }, [load]);

  useEffect(() => {
    if (!loaded) return;
    const t = window.setTimeout(() => { import("./pages/Analysis"); import("./pages/Plans"); import("./pages/More"); }, 1500);
    return () => window.clearTimeout(t);
  }, [loaded]);

  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const sum = (type: string) => monthTx.filter((x) => x.type === type).reduce((s, x) => s + x.amount, 0);
  const income = sum("income");
  const expense = sum("expense");

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <StatusPills />
      <InstallPrompt />
      {error && <p className="px-5 pt-3 text-sm text-red-700">{error}</p>}

      {tab !== "beranda" && <PageHeader title={HEAD[tab][0]} sub={HEAD[tab][1]} icon={HEAD[tab][2]} colors={HEAD[tab][3]}>
          {tab === "transaksi" && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/15 p-3"><p className="text-xs text-white/70">Masuk bulan ini</p><p className="font-bold text-emerald-300">{rupiah(income)}</p></div>
              <div className="rounded-2xl bg-white/15 p-3"><p className="text-xs text-white/70">Keluar bulan ini</p><p className="font-bold">{rupiah(expense)}</p></div>
            </div>
          )}
        </PageHeader>}

      {tab === "beranda" && !loaded ? (
        <HomeSkeleton />
      ) : tab === "beranda" ? (
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
        <Suspense fallback={<HomeSkeleton />}><Analysis categories={categories} total={total} /></Suspense>
      ) : tab === "lainnya" ? (
        <Suspense fallback={<HomeSkeleton />}><More accounts={accounts} categories={categories} onChanged={load} onTransfer={() => setTransfer(true)} /></Suspense>
      ) : tab === "rencana" ? (
        <Suspense fallback={<HomeSkeleton />}><Plans accounts={accounts} categories={categories} onChanged={load} /></Suspense>
      ) : (
        <>
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
        className="no-print fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-5 z-20 h-14 w-14 rounded-full bg-emerald text-3xl leading-none text-white shadow-lg"
      >
        +
      </button>

      <nav className="no-print fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-xl rounded-3xl border border-charcoal/10 bg-white/90 shadow-lg backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {([["beranda", "Beranda"], ["transaksi", "Transaksi"], ["analisis", "Analisis"], ["rencana", "Rencana"], ["lainnya", "Lainnya"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`py-2.5 text-[11px] font-medium ${tab === k ? "rounded-2xl bg-navy/10 font-bold text-navy" : "text-charcoal/60"}`}
            >
              <svg viewBox="0 0 24 24" className="mx-auto mb-0.5 h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[k]} /></svg>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {transfer && (
        <TransferForm accounts={accounts} onClose={() => setTransfer(false)} onSaved={() => { setTransfer(false); load(); toast("Transfer tersimpan", "ok"); }} />
      )}

      {form.open && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          editing={form.editing}
          recent={txs}
          defaultKind={form.kind}
          onClose={() => setForm({ open: false, editing: null })}
          onSaved={() => { setForm({ open: false, editing: null }); load(); toast(form.editing ? "Perubahan tersimpan" : "Transaksi tersimpan", "ok"); }}
        />
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [locked, setLocked] = useState(getMode() !== "none");

  useEffect(() => {
    let hiddenAt = 0;
    const f = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30000 && getMode() !== "none") setLocked(true);
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY") setRecovery(true);
      if (e === "SIGNED_OUT") clearOfflineCache();
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="p-6 text-charcoal/60">Memuat...</div>;
  if (recovery && session) return <NewPassword onDone={() => setRecovery(false)} />;
  if (session && locked) return <LockScreen onUnlock={() => setLocked(false)} />;
  return session ? <Main session={session} /> : <Login />;
}
