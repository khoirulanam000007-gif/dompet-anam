import { supabase } from "./supabase";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

export function nextDate(s: string, freq: string) {
  const d = parse(s);
  if (freq === "daily") d.setDate(d.getDate() + 1);
  else if (freq === "weekly") d.setDate(d.getDate() + 7);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return iso(d);
}

// Membuat transaksi berulang yang sudah jatuh tempo. Aman dijalankan berkali-kali (tidak membuat ganda).
export async function processRecurring(): Promise<number> {
  const today = iso(new Date());
  const { data } = await supabase.from("recurring_rules")
    .select("id,type,amount,account_id,category_id,frequency,next_run_date,name")
    .eq("active", true).lte("next_run_date", today);
  let made = 0;
  for (const r of data ?? []) {
    let date = r.next_run_date as string;
    const rows: Record<string, unknown>[] = [];
    while (date <= today && rows.length < 400) {
      const d = parse(date);
      rows.push({
        type: r.type, amount: r.amount, account_id: r.account_id, category_id: r.category_id,
        recurring_rule_id: r.id, occurrence_date: date, note: r.name,
        occurred_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8).toISOString(),
      });
      date = nextDate(date, r.frequency);
    }
    if (rows.length === 0) continue;
    const { error } = await supabase.from("transactions")
      .upsert(rows, { onConflict: "recurring_rule_id,occurrence_date", ignoreDuplicates: true });
    if (error) continue;
    await supabase.from("recurring_rules").update({ next_run_date: date }).eq("id", r.id);
    made += rows.length;
  }
  return made;
}
