import { useState } from "react";
import Accounts from "./Accounts";
import Calendar from "./Calendar";
import type { Account, Category } from "../lib/types";

type Props = { accounts: Account[]; categories: Category[]; onChanged: () => void; onTransfer: () => void };

export default function More({ accounts, categories, onChanged, onTransfer }: Props) {
  const [v, setV] = useState<"rekening" | "kalender">("rekening");
  return (
    <div>
      <div className="mx-5 mt-5 grid grid-cols-2 gap-2 rounded-xl bg-charcoal/10 p-1">
        {(["rekening", "kalender"] as const).map((k) => (
          <button key={k} onClick={() => setV(k)} className={`rounded-lg py-2 font-medium capitalize ${v === k ? "bg-navy text-white" : ""}`}>{k}</button>
        ))}
      </div>
      {v === "rekening" ? <Accounts accounts={accounts} onChanged={onChanged} onTransfer={onTransfer} /> : <Calendar accounts={accounts} categories={categories} />}
    </div>
  );
}
