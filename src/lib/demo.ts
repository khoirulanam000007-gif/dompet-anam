// MODE DEMO: database tiruan di memori. Tidak menyentuh Supabase, tidak ada yang tersimpan.
// Tujuannya agar calon pengguna bisa mencoba seluruh aplikasi tanpa mendaftar.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
type Res = { data: any; error: { message: string; code?: string } | null };

const FLAG = "dompetDemo";
export const isDemo = () => { try { return sessionStorage.getItem(FLAG) === "1"; } catch { return false; } };
export function enterDemo() { try { sessionStorage.setItem(FLAG, "1"); } catch { /* abaikan */ } location.reload(); }
export function exitDemo() { try { sessionStorage.removeItem(FLAG); } catch { /* abaikan */ } location.reload(); }

const INC = new Set(["income", "debt_borrow", "loan_receive", "saving_withdraw"]);
const rid = () => (typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ---------- data contoh (selalu relatif terhadap hari ini) ----------
export function seedDemo(now = new Date()): Record<string, Row[]> {
  const R = rng(now.getFullYear() * 400 + now.getMonth() * 31 + now.getDate());
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const between = (a: number, b: number, step = 1000) => Math.round((a + R() * (b - a)) / step) * step;
  const at = (off: number, h: number, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, Math.min(h, off === 0 ? now.getHours() : 23), m).toISOString();
  const day = (off: number) => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + off));
  const base = { user_id: "demo", created_at: at(-90, 8) };
  const T: Record<string, Row[]> = { profiles: [], categories: [], accounts: [], savings_goals: [], debts: [], budgets: [], recurring_rules: [], transactions: [], transaction_receipts: [], notification_settings: [], push_subscriptions: [] };

  T.profiles.push({ id: "demo", full_name: "Pengguna Demo", avatar: null, onboarded_at: base.created_at, created_at: base.created_at });

  const cid: Record<string, string> = {};
  const cats: [string, string][] = [
    ["Makanan", "expense"], ["Minuman", "expense"], ["Transportasi", "expense"], ["Belanja", "expense"], ["Pendidikan", "expense"],
    ["Kesehatan", "expense"], ["Hiburan", "expense"], ["Tagihan", "expense"], ["Kebutuhan Pribadi", "expense"], ["Lainnya", "expense"],
    ["Gaji", "income"], ["Uang Saku", "income"], ["Freelance", "income"], ["Bisnis", "income"], ["Hadiah", "income"], ["Bonus", "income"], ["Lainnya", "income"],
  ];
  cats.forEach(([name, kind]) => { const id = `c-${kind}-${name.toLowerCase().replace(/\s/g, "-")}`; cid[`${kind}:${name}`] = id; T.categories.push({ id, ...base, name, kind }); });
  const ex = (n: string) => cid[`expense:${n}`], inc = (n: string) => cid[`income:${n}`];

  T.accounts.push(
    { id: "a-kas", ...base, name: "Dompet Tunai", type: "cash", initial_balance: 350000 },
    { id: "a-bca", ...base, name: "Bank BCA", type: "bank", initial_balance: 4500000 },
    { id: "a-gopay", ...base, name: "GoPay", type: "ewallet", initial_balance: 150000 },
  );

  const tx = (type: string, amount: number, account: string, when: string, extra: Row = {}) =>
    T.transactions.push({ id: rid(), ...base, type, amount, account_id: account, to_account_id: null, category_id: null, goal_id: null, debt_id: null, recurring_rule_id: null, occurrence_date: null, occurred_at: when, source: null, note: null, ...extra });

  T.savings_goals.push(
    { id: "g-bali", ...base, name: "Liburan Bali", target_amount: 8000000, target_date: day(180) },
    { id: "g-darurat", ...base, name: "Dana Darurat", target_amount: 15000000, target_date: day(365) },
  );
  tx("saving_deposit", 1500000, "a-bca", at(-85, 10), { goal_id: "g-darurat" });
  tx("saving_deposit", 250000, "a-kas", at(-9, 19), { goal_id: "g-bali" });

  for (let off = -89; off <= 0; off++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
    const dom = d.getDate();
    const meals = R() < 0.4 ? 2 : 1;
    for (let i = 0; i < meals; i++) if (R() < 0.96) tx("expense", between(16000, 50000), pick(["a-kas", "a-gopay"]), at(off, 12 + i * 6, Math.floor(R() * 50)), { category_id: ex("Makanan"), note: pick(["Makan siang", "Nasi goreng", "Warteg", "Ayam geprek", "Bakso", "Soto ayam", "Makan malam"]) });
    if (R() < 0.5) tx("expense", between(8000, 32000), "a-gopay", at(off, 9, 15), { category_id: ex("Minuman"), note: pick(["Kopi susu", "Es teh", "Boba", "Jus alpukat"]) });
    if (R() < 0.55) tx("expense", between(10000, 60000), pick(["a-gopay", "a-kas"]), at(off, 7, 40), { category_id: ex("Transportasi"), note: pick(["Ojek online", "Bensin", "Parkir", "KRL"]) });
    if (R() < 0.17) tx("expense", between(45000, 380000), "a-bca", at(off, 16, 20), { category_id: ex("Belanja"), note: pick(["Belanja bulanan", "Alfamart", "Skincare", "Baju kerja", "Perlengkapan rumah"]) });
    if (R() < 0.11) tx("expense", between(30000, 160000), "a-gopay", at(off, 20, 5), { category_id: ex("Hiburan"), note: pick(["Nonton bioskop", "Top up game", "Karaoke"]) });
    if (R() < 0.04) tx("expense", between(20000, 130000), "a-kas", at(off, 11, 30), { category_id: ex("Kesehatan"), note: "Apotek" });
    if (dom === 5) tx("expense", 350000, "a-bca", at(off, 8, 5), { category_id: ex("Tagihan"), note: "Listrik" });
    if (dom === 10) tx("expense", 280000, "a-bca", at(off, 8, 10), { category_id: ex("Tagihan"), note: "Internet" });
    if (dom === 25) tx("income", 6500000, "a-bca", at(off, 9, 0), { category_id: inc("Gaji"), source: "PT Maju Jaya", note: "Gaji bulanan" });
    if (dom === 26) {
      tx("saving_deposit", 500000, "a-bca", at(off, 10, 0), { goal_id: "g-bali" });
      tx("saving_deposit", 300000, "a-bca", at(off, 10, 5), { goal_id: "g-darurat" });
    }
    if (off % 7 === 0) tx("transfer", 500000, "a-bca", at(off, 9, 30), { to_account_id: "a-gopay", note: "Top up GoPay" });
    if (off % 14 === 0) tx("transfer", 400000, "a-bca", at(off, 9, 35), { to_account_id: "a-kas", note: "Tarik tunai" });
  }
  tx("income", 1200000, "a-bca", at(-47, 14), { category_id: inc("Freelance"), source: "Klien desain", note: "Proyek desain logo" });
  tx("income", 2000000, "a-bca", at(-13, 15), { category_id: inc("Freelance"), source: "Klien website", note: "Proyek website" });
  tx("income", 200000, "a-kas", at(-30, 18), { category_id: inc("Hadiah"), note: "Hadiah ulang tahun" });

  T.debts.push(
    { id: "d-budi", ...base, kind: "borrowed", person_name: "Budi", amount: 500000, due_date: day(9), note: "Pinjam untuk servis motor" },
    { id: "d-sari", ...base, kind: "lent", person_name: "Sari", amount: 300000, due_date: day(5), note: "Talangan arisan" },
  );
  tx("debt_borrow", 500000, "a-kas", at(-20, 9), { debt_id: "d-budi" });
  tx("debt_repay", 200000, "a-kas", at(-6, 10), { debt_id: "d-budi" });
  tx("loan_give", 300000, "a-bca", at(-15, 14), { debt_id: "d-sari" });

  for (const mOff of [-1, 0]) {
    const m = `${new Date(now.getFullYear(), now.getMonth() + mOff, 1).getFullYear()}-${String(new Date(now.getFullYear(), now.getMonth() + mOff, 1).getMonth() + 1).padStart(2, "0")}-01`;
    ([["Makanan", 1200000], ["Transportasi", 600000], ["Hiburan", 300000], ["Belanja", 800000]] as const).forEach(([n, v]) =>
      T.budgets.push({ id: rid(), ...base, category_id: ex(n), month: m, limit_amount: v }));
  }

  T.recurring_rules.push(
    { id: "r-netflix", ...base, name: "Langganan Netflix", type: "expense", amount: 54000, account_id: "a-gopay", category_id: ex("Hiburan"), frequency: "monthly", next_run_date: day(8), active: true },
    { id: "r-cicilan", ...base, name: "Cicilan HP", type: "expense", amount: 450000, account_id: "a-bca", category_id: ex("Tagihan"), frequency: "monthly", next_run_date: day(3), active: true },
  );

  // Pastikan data contoh masuk akal: telusuri urut waktu, saldo rekening tidak pernah negatif.
  // Pengeluaran yang tidak cukup dialihkan ke rekening terkaya; bila tetap tidak cukup, dilewati.
  const bal: Record<string, number> = {};
  T.accounts.forEach((a) => { bal[a.id] = Number(a.initial_balance); });
  const richest = () => Object.keys(bal).reduce((x, y) => (bal[y] > bal[x] ? y : x));
  const keep: Row[] = [];
  for (const t of [...T.transactions].sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0))) {
    const n = Number(t.amount);
    if (INC.has(t.type)) { bal[t.account_id] += n; keep.push(t); continue; }
    if (bal[t.account_id] < n) {
      const alt = richest();
      if (bal[alt] < n || (t.type === "transfer" && t.to_account_id === alt)) continue;
      t.account_id = alt;
    }
    bal[t.account_id] -= n;
    if (t.type === "transfer") bal[t.to_account_id] += n;
    keep.push(t);
  }
  T.transactions = keep;
  return T;
}

// ---------- mesin query mini (meniru bagian Supabase yang dipakai aplikasi) ----------
const REFS: Record<string, [string, string][]> = {
  accounts: [["transactions", "account_id"], ["transactions", "to_account_id"], ["recurring_rules", "account_id"]],
  categories: [["transactions", "category_id"], ["budgets", "category_id"], ["recurring_rules", "category_id"]],
  savings_goals: [["transactions", "goal_id"]],
  debts: [["transactions", "debt_id"]],
};

function view(T: Record<string, Row[]>, name: string): Row[] | null {
  const tx = T.transactions;
  if (name === "account_balances")
    return T.accounts.map((a) => {
      let b = Number(a.initial_balance ?? 0);
      for (const t of tx) {
        const n = Number(t.amount);
        if (t.account_id === a.id) b += INC.has(t.type) ? n : -n;
        else if (t.to_account_id === a.id && t.type === "transfer") b += n;
      }
      return { ...a, balance: b };
    });
  if (name === "goal_progress")
    return T.savings_goals.map((g) => ({ ...g, saved_amount: tx.filter((t) => t.goal_id === g.id).reduce((s, t) => s + (t.type === "saving_deposit" ? Number(t.amount) : t.type === "saving_withdraw" ? -Number(t.amount) : 0), 0) }));
  if (name === "debt_status")
    return T.debts.map((d) => {
      const paid = tx.filter((t) => t.debt_id === d.id && (t.type === "debt_repay" || t.type === "loan_receive")).reduce((s, t) => s + Number(t.amount), 0);
      return { ...d, paid_amount: paid, remaining_amount: Math.max(Number(d.amount) - paid, 0), is_paid: Number(d.amount) - paid <= 0 };
    });
  return null;
}

class Query implements PromiseLike<Res> {
  private fs: ((r: Row) => boolean)[] = [];
  private cols = "*";
  private ord: { c: string; asc: boolean } | null = null;
  private lim: number | null = null;
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;
  private opts: any = {};
  private one: "single" | "maybe" | null = null;
  private ret = false;
  constructor(private T: Record<string, Row[]>, private table: string) {}

  select(cols = "*") { this.cols = cols; if (this.op !== "select") this.ret = true; return this; }
  eq(c: string, v: any) { this.fs.push((r) => r[c] === v); return this; }
  neq(c: string, v: any) { this.fs.push((r) => r[c] !== v); return this; }
  gt(c: string, v: any) { this.fs.push((r) => r[c] > v); return this; }
  gte(c: string, v: any) { this.fs.push((r) => r[c] >= v); return this; }
  lt(c: string, v: any) { this.fs.push((r) => r[c] < v); return this; }
  lte(c: string, v: any) { this.fs.push((r) => r[c] <= v); return this; }
  in(c: string, vs: any[]) { this.fs.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: any) { this.fs.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  not(c: string, op: string, v: any) { this.fs.push((r) => !(op === "is" ? (v === null ? r[c] == null : r[c] === v) : r[c] === v)); return this; }
  order(c: string, o: { ascending?: boolean } = {}) { this.ord = { c, asc: o.ascending !== false }; return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  insert(rows: any) { this.op = "insert"; this.payload = rows; return this; }
  update(p: any) { this.op = "update"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  upsert(rows: any, o: any = {}) { this.op = "upsert"; this.payload = rows; this.opts = o; return this; }
  then<A, B>(a?: ((v: Res) => A | PromiseLike<A>) | null, b?: ((e: any) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(a, b);
  }

  private project(rows: Row[]) {
    if (this.cols === "*") return rows.map((r) => ({ ...r }));
    const keys = this.cols.split(",").map((s) => s.trim()).filter(Boolean);
    return rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null])));
  }
  private finish(rows: Row[]): Res {
    const out = this.project(rows);
    if (this.one) {
      if (out.length === 1 || (this.one === "maybe" && out.length === 0)) return { data: out[0] ?? null, error: null };
      return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
    }
    return { data: out, error: null };
  }
  private defaults(r: Row): Row {
    const d: Row = { id: rid(), user_id: "demo", created_at: new Date().toISOString(), ...r };
    if (this.table === "transactions") { d.occurred_at ??= new Date().toISOString(); for (const k of ["to_account_id", "category_id", "goal_id", "debt_id", "recurring_rule_id", "occurrence_date", "source", "note"]) d[k] ??= null; }
    if (this.table === "accounts") { d.type ??= "bank"; d.initial_balance ??= 0; }
    if (this.table === "recurring_rules") { d.active ??= true; d.frequency ??= "monthly"; }
    return d;
  }

  private run(): Res {
    const T = this.T;
    const v = view(T, this.table);
    if (v) {
      if (this.op !== "select") return { data: null, error: { message: `${this.table} hanya bisa dibaca` } };
      let rows = v.filter((r) => this.fs.every((f) => f(r)));
      if (this.ord) { const { c, asc } = this.ord; rows = [...rows].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1)); }
      if (this.lim != null) rows = rows.slice(0, this.lim);
      return this.finish(rows);
    }
    const tbl = T[this.table];
    if (!tbl) return { data: null, error: { message: `Tabel ${this.table} tidak ada`, code: "42P01" } };
    const match = () => tbl.filter((r) => this.fs.every((f) => f(r)));

    if (this.op === "select") {
      let rows = match();
      if (this.ord) { const { c, asc } = this.ord; rows = [...rows].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1)); }
      if (this.lim != null) rows = rows.slice(0, this.lim);
      return this.finish(rows);
    }
    if (this.op === "insert") {
      const made = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => this.defaults(r));
      tbl.push(...made);
      return this.ret ? this.finish(made) : { data: null, error: null };
    }
    if (this.op === "upsert") {
      const keys = String(this.opts.onConflict ?? "id").split(",").map((s) => s.trim());
      const made: Row[] = [];
      for (const r of Array.isArray(this.payload) ? this.payload : [this.payload]) {
        const hit = tbl.find((x) => keys.every((k) => r[k] != null && x[k] === r[k]));
        if (hit) { if (!this.opts.ignoreDuplicates) { Object.assign(hit, r); made.push(hit); } }
        else { const d = this.defaults(r); tbl.push(d); made.push(d); }
      }
      return this.ret ? this.finish(made) : { data: null, error: null };
    }
    if (this.op === "update") {
      const rows = match();
      for (const r of rows) {
        if (this.table === "profiles" && typeof this.payload.avatar === "string" && this.payload.avatar.length > 250000)
          return { data: null, error: { message: "violates check constraint avatar_size", code: "23514" } };
        Object.assign(r, this.payload);
      }
      return this.ret ? this.finish(rows) : { data: null, error: null };
    }
    // delete
    const rows = match();
    for (const [t, col] of REFS[this.table] ?? [])
      if (rows.some((r) => T[t].some((x) => x[col] === r.id))) return { data: null, error: { message: `violates foreign key constraint on ${t}`, code: "23503" } };
    if (this.table === "recurring_rules") T.transactions.forEach((x) => { if (rows.some((r) => r.id === x.recurring_rule_id)) x.recurring_rule_id = null; });
    if (this.table === "transactions") T.transaction_receipts = T.transaction_receipts.filter((x) => !rows.some((r) => r.id === x.transaction_id));
    for (const r of rows) tbl.splice(tbl.indexOf(r), 1);
    return this.ret ? this.finish(rows) : { data: null, error: null };
  }
}

export function createDemoClient() {
  const T = seedDemo();
  const user = { id: "demo", email: "demo@dompet-anam.app", user_metadata: { full_name: "Pengguna Demo" } };
  const session = { access_token: "demo", refresh_token: "demo", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  const ok = async () => ({ data: { user, session }, error: null });
  return {
    __tables: T,
    from: (table: string) => new Query(T, table),
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() { /* kosong */ } } } }),
      signOut: async () => { exitDemo(); return { error: null }; },
      updateUser: ok, signInWithPassword: ok, signUp: ok,
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
    },
  };
}

let demoClient: ReturnType<typeof createDemoClient> | null = null;
export const getDemoClient = () => (demoClient ??= createDemoClient());
