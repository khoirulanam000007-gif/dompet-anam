import { useState } from "react";
import Accounts from "./Accounts";
import Calendar from "./Calendar";
import Reports from "./Reports";
import Settings from "./Settings";
import type { Account, Category } from "../lib/types";

type Props = { accounts: Account[]; categories: Category[]; onChanged: () => void; onTransfer: () => void };

export default function More({ accounts, categories, onChanged, onTransfer }: Props) {
  const [v, setV] = useState<"rekening" | "kalender" | "laporan" | "pengaturan">("rekening");
  return (
    <div>
      <div className="mx-5 mt-5 grid grid-cols-4 gap-1 no-print rounded-xl bg-charcoal/10 p-1">
        {(["rekening", "kalender", "laporan", "pengaturan"] as const).map((k) => (
          <button key={k} onClick={() => setV(k)} className={`rounded-lg py-2 text-xs font-medium capitalize ${v === k ? "bg-navy text-white" : ""}`}>{k}</button>
        ))}
      </div>
      {v === "rekening" ? <Accounts accounts={accounts} onChanged={onChanged} onTransfer={onTransfer} /> : v === "kalender" ? <Calendar accounts={accounts} categories={categories} /> : v === "laporan" ? <Reports accounts={accounts} categories={categories} /> : <Settings categories={categories} onChanged={onChanged} />}
    </div>
  );
}
