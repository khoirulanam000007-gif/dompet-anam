import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { rupiah } from "./lib/format";
import Login from "./pages/Login";

type Account = { id: string; name: string; type: string; balance: number };

function Home({ session }: { session: Session }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("account_balances")
      .select("id,name,type,balance")
      .order("name")
      .then(({ data, error }) => {
        if (error) setError("Data belum bisa dimuat. Coba muat ulang halaman.");
        else setAccounts((data ?? []).map((a) => ({ ...a, balance: Number(a.balance) })));
      });
  }, []);

  const total = (accounts ?? []).reduce((s, a) => s + a.balance, 0);

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-10">
      <header className="flex items-center justify-between bg-navy px-5 py-4 text-white">
        <span className="font-semibold tracking-wide">DOMPET ANAM</span>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-white/80 underline">
          Keluar
        </button>
      </header>

      <section className="bg-navy px-5 pb-8 pt-2 text-white">
        <p className="text-sm text-white/70">Total saldo</p>
        <p className="mt-1 text-4xl font-semibold">{accounts ? rupiah(total) : "..."}</p>
        <div className="mt-3 h-0.5 w-10 bg-gold" />
      </section>

      <section className="px-5 pt-6">
        <h2 className="text-lg font-semibold text-navy">Rekening</h2>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <ul className="mt-3 space-y-2">
          {(accounts ?? []).map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
              <span>{a.name}</span>
              <span className="font-medium">{rupiah(a.balance)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-charcoal/60">Masuk sebagai {session.user.email}</p>
      </section>
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
  return session ? <Home session={session} /> : <Login />;
}
