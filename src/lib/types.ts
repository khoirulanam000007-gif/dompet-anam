export type Account = { id: string; name: string; type: string; balance: number };
export type Category = { id: string; name: string; kind: "income" | "expense" };
export type Tx = {
  id: string;
  type: string;
  amount: number;
  account_id: string;
  category_id: string | null;
  occurred_at: string;
  source: string | null;
  note: string | null;
};
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
