import { supabase } from "./supabase";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const LABEL: Record<string, string> = {
  categories: "kategori", accounts: "rekening", savings_goals: "target tabungan", debts: "utang/piutang",
  recurring_rules: "transaksi berulang", budgets: "anggaran", transactions: "transaksi",
};

// user_id dibuang: database otomatis mengisinya dengan akun yang sedang masuk.
const strip = (r: Row) => { const { user_id: _u, ...rest } = r; void _u; return rest; };

async function upsertAll(table: string, rows: Row[]) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 200), { onConflict: "id" });
    if (error) throw new Error(`Gagal memulihkan ${LABEL[table] ?? table}. Pemulihan aman diulang (tidak membuat data ganda).`);
  }
}

// Memulihkan file cadangan JSON. Idempoten: id yang sama diperbarui, bukan digandakan. Tidak ada data yang dihapus.
export async function restoreBackup(text: string): Promise<string> {
  let b: Row;
  try { b = JSON.parse(text); } catch { throw new Error("File ini bukan cadangan yang valid."); }
  // Cadangan lama memakai nama "DOMPET ANAM"; keduanya diterima.
  if (!b || !["DOMPET PRO", "DOMPET ANAM"].includes(b.app)) throw new Error("File ini bukan cadangan Dompet Pro.");
  const list = (k: string): Row[] => (Array.isArray(b[k]) ? b[k] : []);

  // Kategori: pakai yang sudah ada bila nama & jenisnya sama (kategori bawaan akun baru), sisanya ditambahkan.
  const { data: cur, error } = await supabase.from("categories").select("id,name,kind");
  if (error) throw new Error("Gagal membaca kategori. Coba lagi.");
  const map = new Map<string, string>();
  const add: Row[] = [];
  for (const c of list("categories")) {
    const same = (cur ?? []).find((x) => x.id === c.id)
      ?? (cur ?? []).find((x) => x.kind === c.kind && String(x.name).toLowerCase() === String(c.name).toLowerCase());
    if (same) map.set(c.id, same.id); else { add.push(strip(c)); map.set(c.id, c.id); }
  }
  await upsertAll("categories", add);
  const withCat = (r: Row) => ({ ...strip(r), category_id: r.category_id ? (map.get(r.category_id) ?? r.category_id) : null });

  await upsertAll("accounts", list("accounts").map(strip));
  await upsertAll("savings_goals", list("savings_goals").map(strip));
  await upsertAll("debts", list("debts").map(strip));
  await upsertAll("recurring_rules", list("recurring_rules").map(withCat));
  await upsertAll("budgets", list("budgets").map(withCat));
  await upsertAll("transactions", list("transactions").map(withCat));

  return `Pemulihan selesai: ${list("accounts").length} rekening, ${list("transactions").length} transaksi, ${list("budgets").length} anggaran, ${list("savings_goals").length} target tabungan, ${list("debts").length} utang/piutang.`;
}
