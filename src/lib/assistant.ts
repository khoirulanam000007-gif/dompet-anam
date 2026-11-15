// Mesin analisis Asisten Keuangan. Semua angka dihitung langsung dari transaksi pengguna (tanpa AI, tanpa data contoh).
// Hanya transaksi bertipe "income" dan "expense" yang dihitung sebagai pemasukan/pengeluaran.
// Transfer, tabungan, dan utang-piutang tidak dihitung (sesuai aturan saldo aplikasi).
import { rupiah as rp } from "./format";

export type Row = { type: string; amount: number; category_id: string | null; occurred_at: string };
export type Cat = { id: string; name: string; kind: "income" | "expense" };
export type Ctx = {
  now: Date;
  rows: Row[];
  coverageStart: Date; // data sebelum tanggal ini TIDAK dimuat
  truncated: boolean;
  balance: number;
  accounts: { name: string; balance: number }[];
  cats: Cat[];
  budgets: { category_id: string; limit: number }[];
  goals: { name: string; saved: number; target: number; date: string | null }[];
  debts: { kind: "borrowed" | "lent"; person: string; remaining: number; due: string | null }[];
};

// ---- Batas yang dipakai (semuanya terlihat di sini, tidak ada angka tersembunyi) ----
export const LIMITS = {
  warn: 0.7, danger: 0.9,       // peringatan pengeluaran vs pemasukan
  minTx: 3,                      // minimal transaksi pengeluaran bulan ini untuk memberi saran
  dominant: 0.4,                 // satu kategori dianggap dominan bila >= 40% pengeluaran
  growthPct: 0.25, growthMin: 50_000,
  smallCount: 8, smallAvg: 50_000,
  budgetWarn: 0.8,
  fcDays: 14, fcTx: 10,          // syarat data untuk estimasi sisa saldo
};

const DAY = 86400000;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const monthStart = (d: Date, off = 0) => new Date(d.getFullYear(), d.getMonth() + off, 1);
export const daysIn = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const inRange = (r: Row, a: Date, b: Date) => { const t = new Date(r.occurred_at).getTime(); return t >= a.getTime() && t < b.getTime(); };
const pc = (x: number) => Math.floor(x * 100); // dibulatkan ke bawah agar tidak mengklaim batas yang belum tercapai
const dstr = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export const total = (rows: Row[], a: Date, b: Date, type: string) =>
  rows.filter((r) => r.type === type && inRange(r, a, b)).reduce((s, r) => s + r.amount, 0);

const nameOf = (ctx: Ctx, id: string | null) => (id ? ctx.cats.find((c) => c.id === id)?.name ?? "Tanpa kategori" : "Tanpa kategori");

export function byCategory(ctx: Ctx, a: Date, b: Date, type: "income" | "expense") {
  const m = new Map<string, { id: string | null; name: string; amount: number; count: number }>();
  ctx.rows.filter((r) => r.type === type && inRange(r, a, b)).forEach((r) => {
    const k = r.category_id ?? "-";
    const e = m.get(k) ?? { id: r.category_id, name: nameOf(ctx, r.category_id), amount: 0, count: 0 };
    e.amount += r.amount; e.count += 1; m.set(k, e);
  });
  return [...m.values()].sort((x, y) => y.amount - x.amount);
}

// ================= Ringkasan bulanan =================
export function summarize(ctx: Ctx) {
  const { now, rows } = ctx;
  const ms = monthStart(now), me = monthStart(now, 1);
  const day = now.getDate(), dim = daysIn(now);
  const income = total(rows, ms, me, "income");
  const expense = total(rows, ms, me, "expense");
  const exRows = rows.filter((r) => r.type === "expense" && inRange(r, ms, me));
  const prevStart = monthStart(now, -1);
  const prevEnd = addDays(prevStart, Math.min(day, daysIn(prevStart))); // hari ke-1 sampai ke-N bulan lalu
  const hasPrev = prevStart.getTime() >= ctx.coverageStart.getTime();
  const pIncome = total(rows, prevStart, prevEnd, "income");
  const pExpense = total(rows, prevStart, prevEnd, "expense");
  let biggest: { amount: number; name: string; date: Date } | null = null;
  exRows.forEach((r) => { if (!biggest || r.amount > biggest.amount) biggest = { amount: r.amount, name: nameOf(ctx, r.category_id), date: new Date(r.occurred_at) }; });
  return {
    income, expense, net: income - expense,
    ratio: income > 0 ? expense / income : null,
    savingsRate: income > 0 ? (income - expense) / income : null,
    expenseCount: exRows.length, day, dim, daysLeft: dim - day + 1,
    avgPerDay: expense / day,
    biggest,
    hasPrev, pIncome, pExpense, prevEnd,
    expenseChange: hasPrev && pExpense > 0 ? (expense - pExpense) / pExpense : null,
    incomeChange: hasPrev && pIncome > 0 ? (income - pIncome) / pIncome : null,
    top: byCategory(ctx, ms, me, "expense"),
  };
}

// ================= Peringatan 70% / 90% / melebihi =================
export type Level = "nodata" | "ok" | "warn" | "danger" | "full" | "over";
export function alertFor(income: number, expense: number): { level: Level; title: string; text: string; ratio: number | null } {
  if (expense === 0 && income === 0) return { level: "nodata", title: "Belum ada data", text: "Belum ada pemasukan atau pengeluaran tercatat bulan ini.", ratio: null };
  if (income === 0) return { level: "nodata", title: "Belum ada pemasukan tercatat", text: `Pengeluaran bulan ini sudah ${rp(expense)}, tetapi belum ada pemasukan tercatat, jadi persentasenya belum bisa dihitung.`, ratio: null };
  const ratio = expense / income;
  const left = income - expense;
  if (ratio > 1) return { level: "over", title: "Pengeluaran melebihi pemasukan", text: `Pengeluaran ${rp(expense)} melebihi pemasukan ${rp(income)} sebesar ${rp(-left)}.`, ratio };
  if (ratio === 1) return { level: "full", title: "Pemasukan habis terpakai", text: `Pengeluaran sama dengan pemasukan (${rp(income)}). Tidak ada sisa bulan ini.`, ratio };
  if (ratio >= LIMITS.danger) return { level: "danger", title: "Pengeluaran sudah mencapai 90%", text: `Pengeluaran ${rp(expense)} sudah ${pc(ratio)}% dari pemasukan ${rp(income)}. Sisa ${rp(left)}.`, ratio };
  if (ratio >= LIMITS.warn) return { level: "warn", title: "Pengeluaran sudah mencapai 70%", text: `Pengeluaran ${rp(expense)} sudah ${pc(ratio)}% dari pemasukan ${rp(income)}. Sisa ${rp(left)}.`, ratio };
  return { level: "ok", title: "Pengeluaran masih terkendali", text: `Pengeluaran ${rp(expense)} baru ${pc(ratio)}% dari pemasukan ${rp(income)}. Sisa ${rp(left)}.`, ratio };
}

// ================= Estimasi sisa saldo =================
export function forecast(ctx: Ctx) {
  const { now, rows } = ctx;
  const t0 = startOfDay(now), from = addDays(t0, -29), to = addDays(t0, 1);
  const win = rows.filter((r) => (r.type === "income" || r.type === "expense") && inRange(r, from, to));
  const ex = win.filter((r) => r.type === "expense");
  const remainingDays = daysIn(now) - now.getDate();
  const ms = monthStart(now), me = monthStart(now, 1);
  const monthExpense = total(rows, ms, me, "expense");
  if (win.length === 0) return { sufficient: false as const, reason: "Belum ada transaksi dalam 30 hari terakhir.", observedDays: 0, count: 0, remainingDays, monthExpense };
  const first = startOfDay(new Date(Math.min(...win.map((r) => new Date(r.occurred_at).getTime()))));
  const observedDays = Math.min(30, Math.round((to.getTime() - first.getTime()) / DAY));
  const count = ex.length;
  const sufficient = observedDays >= LIMITS.fcDays && count >= LIMITS.fcTx;
  const expTotal = ex.reduce((s, r) => s + r.amount, 0);
  const avgDaily = expTotal / observedDays;
  const endBalance = ctx.balance - avgDaily * remainingDays;
  const coverDays = avgDaily > 0 ? Math.floor(Math.max(0, ctx.balance) / avgDaily) : null;
  return {
    sufficient, observedDays, count, avgDaily, remainingDays, endBalance, coverDays, monthExpense,
    projectedMonthExpense: monthExpense + avgDaily * remainingDays,
    reason: sufficient ? "" : `Data belum cukup: tercatat ${observedDays} hari (butuh minimal ${LIMITS.fcDays}) dan ${count} transaksi pengeluaran (butuh minimal ${LIMITS.fcTx}).`,
  };
}

// ================= Saran penghematan (hanya dari pola nyata) =================
export type Tip = { id: string; icon: string; title: string; body: string; basis: string; prio: number };
export function suggestions(ctx: Ctx): { tips: Tip[]; enough: boolean; note: string } {
  const s = summarize(ctx);
  const { now } = ctx;
  const ms = monthStart(now), me = monthStart(now, 1);
  const tips: Tip[] = [];
  const dueSoon = ctx.debts.filter((d) => d.remaining > 0 && d.due && new Date(d.due).getTime() < addDays(startOfDay(now), 8).getTime());
  dueSoon.forEach((d) => {
    const late = new Date(d.due as string).getTime() < startOfDay(now).getTime();
    tips.push({ id: `debt-${d.person}`, icon: "⏰", prio: 0,
      title: d.kind === "borrowed" ? `Utang ke ${d.person} ${late ? "sudah lewat jatuh tempo" : "segera jatuh tempo"}` : `Piutang dari ${d.person} ${late ? "sudah lewat jatuh tempo" : "segera jatuh tempo"}`,
      body: `Sisa ${rp(d.remaining)}, jatuh tempo ${dstr(new Date(d.due as string))}.`, basis: "Dari catatan utang-piutang Anda." });
  });
  if (s.expenseCount < LIMITS.minTx)
    return { tips, enough: false, note: `Saran pengeluaran belum bisa diberikan: baru ${s.expenseCount} transaksi pengeluaran bulan ini (butuh minimal ${LIMITS.minTx}).` };

  // 1) kecepatan belanja vs pemasukan
  if (s.income > 0 && s.day >= 7) {
    const proj = s.avgPerDay * s.dim;
    if (proj > s.income) {
      const safe = s.income - s.expense > 0 ? (s.income - s.expense) / s.daysLeft : 0;
      tips.push({ id: "pace", icon: "🚦", prio: 1, title: "Kecepatan belanja berpotensi melebihi pemasukan",
        body: `Dengan rata-rata ${rp(s.avgPerDay)} per hari, pengeluaran akhir bulan ≈ ${rp(proj)} (pemasukan bulan ini ${rp(s.income)}). ${safe > 0 ? `Agar tidak melebihi pemasukan, batas aman ≈ ${rp(safe)} per hari untuk ${s.daysLeft} hari tersisa.` : "Pemasukan bulan ini sudah terpakai seluruhnya."}`,
        basis: `Pengeluaran ${rp(s.expense)} ÷ ${s.day} hari × ${s.dim} hari. Pemasukan baru yang belum dicatat tidak ikut dihitung.` });
    }
  }
  // 2) anggaran hampir habis / terlampaui
  ctx.budgets.forEach((b) => {
    const used = s.top.find((t) => t.id === b.category_id)?.amount ?? 0;
    if (b.limit > 0 && used / b.limit >= LIMITS.budgetWarn) {
      const r = used / b.limit;
      tips.push({ id: `bud-${b.category_id}`, icon: "🎯", prio: 2, title: `Anggaran ${nameOf(ctx, b.category_id)} ${r > 1 ? "terlampaui" : "hampir habis"}`,
        body: r > 1 ? `Terpakai ${rp(used)} dari batas ${rp(b.limit)} (lebih ${rp(used - b.limit)}).` : `Terpakai ${rp(used)} dari batas ${rp(b.limit)} (${pc(r)}%). Sisa ${rp(b.limit - used)}.`,
        basis: "Dari anggaran bulanan yang Anda atur." });
    }
  });
  // 3) kategori yang naik dibanding periode yang sama bulan lalu
  if (s.hasPrev) {
    const prevStart = monthStart(now, -1);
    const prevCats = byCategory(ctx, prevStart, s.prevEnd, "expense");
    let best: { name: string; cur: number; prev: number; diff: number } | null = null;
    s.top.forEach((c) => {
      const prev = prevCats.find((p) => p.id === c.id)?.amount ?? 0;
      const diff = c.amount - prev;
      if (diff >= LIMITS.growthMin && (prev === 0 || diff / prev >= LIMITS.growthPct) && (!best || diff > best.diff)) best = { name: c.name, cur: c.amount, prev, diff };
    });
    if (best) {
      const b = best as { name: string; cur: number; prev: number; diff: number };
      tips.push({ id: "growth", icon: "📈", prio: 3, title: `${b.name} naik dibanding bulan lalu`,
        body: b.prev === 0 ? `${b.name} sudah ${rp(b.cur)} bulan ini, sementara tanggal 1–${s.day} bulan lalu belum ada pengeluaran di kategori ini.` : `${b.name} ${rp(b.cur)} bulan ini, naik ${Math.round((b.diff / b.prev) * 100)}% dari ${rp(b.prev)} pada tanggal 1–${s.day} bulan lalu (+${rp(b.diff)}).`,
        basis: `Dibandingkan tanggal 1–${s.day} bulan lalu agar adil. Ambang: naik ≥ ${rp(LIMITS.growthMin)} dan ≥ ${LIMITS.growthPct * 100}%.` });
    }
  }
  // 4) satu kategori mendominasi
  const top = s.top[0];
  if (top && s.expense > 0 && top.amount / s.expense >= LIMITS.dominant) {
    tips.push({ id: "dominant", icon: "🥇", prio: 4, title: `${top.name} adalah pengeluaran terbesar`,
      body: `${top.name} menyumbang ${pc(top.amount / s.expense)}% pengeluaran bulan ini (${rp(top.amount)} dari ${rp(s.expense)}). Jika dikurangi 10%, penghematannya ≈ ${rp(Math.round(top.amount * 0.1))} per bulan.`,
      basis: `Ambang kategori dominan: ≥ ${LIMITS.dominant * 100}% dari total pengeluaran.` });
  }
  // 5) pengeluaran kecil yang sering
  let small: { name: string; n: number; avg: number; sum: number } | null = null;
  s.top.forEach((c) => {
    const avg = c.amount / c.count;
    if (c.count >= LIMITS.smallCount && avg <= LIMITS.smallAvg && (!small || c.amount > small.sum)) small = { name: c.name, n: c.count, avg, sum: c.amount };
  });
  if (small) {
    const sm = small as { name: string; n: number; avg: number; sum: number };
    tips.push({ id: "small", icon: "☕", prio: 5, title: `${sm.name}: sering, nominal kecil`,
      body: `${sm.name} dicatat ${sm.n} kali bulan ini, rata-rata ${rp(Math.round(sm.avg))}, total ${rp(sm.sum)}. Pengeluaran kecil yang sering mudah luput.`,
      basis: `Ambang: ≥ ${LIMITS.smallCount} transaksi dengan rata-rata ≤ ${rp(LIMITS.smallAvg)}.` });
  }
  // 6) kabar baik + arah sisa
  if (s.ratio !== null && s.ratio < LIMITS.warn && s.net > 0) {
    const g = ctx.goals.find((x) => x.saved < x.target);
    tips.push({ id: "good", icon: "✅", prio: 6, title: "Pengeluaran terkendali",
      body: `Pengeluaran baru ${pc(s.ratio)}% dari pemasukan, sisa ${rp(s.net)}. ${g ? `Sebagian sisa bisa dialokasikan ke target "${g.name}" (terkumpul ${rp(g.saved)} dari ${rp(g.target)}).` : "Pertimbangkan membuat target tabungan di menu Rencana."}`,
      basis: "Dari pemasukan dan pengeluaran bulan ini." });
  }
  tips.sort((a, b) => a.prio - b.prio);
  return { tips, enough: true, note: tips.length === 0 ? "Belum ada pola yang perlu disorot dari data bulan ini." : "" };
}

// ================= Tanya jawab (berbasis aturan, bukan AI generatif) =================
export type Period = { label: string; from: Date; to: Date };
export function periodFor(q: string, now: Date): Period {
  const t = startOfDay(now);
  if (/kemarin/.test(q)) return { label: "kemarin", from: addDays(t, -1), to: t };
  if (/hari ini/.test(q)) return { label: "hari ini", from: t, to: addDays(t, 1) };
  if (/(minggu|pekan) ini/.test(q)) { const s = addDays(t, -((t.getDay() + 6) % 7)); return { label: "minggu ini", from: s, to: addDays(s, 7) }; }
  if (/bulan lalu|bulan kemarin/.test(q)) return { label: "bulan lalu", from: monthStart(now, -1), to: monthStart(now) };
  if (/30 hari/.test(q)) return { label: "30 hari terakhir", from: addDays(t, -29), to: addDays(t, 1) };
  if (/tahun ini/.test(q)) return { label: "tahun ini", from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
  return { label: "bulan ini", from: monthStart(now), to: monthStart(now, 1) };
}

export function parseAmount(q: string): number | null {
  const dots = q.match(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+)(?!\d)/);
  if (dots) return Number(dots[1].replace(/\./g, ""));
  const m = q.match(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k|miliar|m)?(?![a-z])/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  const u = m[2];
  const mult = u === "juta" || u === "jt" ? 1e6 : u === "ribu" || u === "rb" || u === "k" ? 1e3 : u === "miliar" || u === "m" ? 1e9 : 1;
  const v = Math.round(n * mult);
  return v > 0 ? v : null;
}

export const SUGGESTED = [
  "Ringkas kondisi keuangan saya",
  "Kategori apa yang paling boros?",
  "Berapa pengeluaran bulan ini?",
  "Apakah saldo saya cukup sampai akhir bulan?",
  "Bandingkan dengan bulan lalu",
  "Boleh beli sepatu 500 ribu?",
];

const limitNote = (ctx: Ctx) => (ctx.truncated ? "\nCatatan: data dibatasi 1.000 transaksi terbaru, jadi angka periode lama mungkin tidak lengkap." : "");

function periodAnswer(ctx: Ctx, kind: "income" | "expense", p: Period, onlyCat?: Cat): string {
  if (p.from.getTime() < ctx.coverageStart.getTime())
    return `Saya hanya memuat transaksi sejak ${dstr(ctx.coverageStart)}, jadi ${p.label} belum bisa dijawab dengan lengkap.`;
  const rows = ctx.rows.filter((r) => r.type === kind && inRange(r, p.from, p.to) && (!onlyCat || r.category_id === onlyCat.id));
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  const word = kind === "income" ? "Pemasukan" : "Pengeluaran";
  const sub = onlyCat ? ` kategori ${onlyCat.name}` : "";
  if (rows.length === 0) return `Belum ada ${word.toLowerCase()}${sub} tercatat ${p.label}.`;
  const end = Math.min(p.to.getTime(), addDays(startOfDay(ctx.now), 1).getTime());
  const days = Math.max(1, Math.round((end - p.from.getTime()) / DAY));
  const lines = [`${word}${sub} ${p.label}: ${rp(sum)} dari ${rows.length} transaksi.`, `Rata-rata ${rp(Math.round(sum / days))} per hari (${days} hari).`];
  if (!onlyCat && kind === "expense") {
    const cats = byCategory(ctx, p.from, p.to, "expense").slice(0, 3);
    lines.push("Terbesar:", ...cats.map((c) => `• ${c.name}: ${rp(c.amount)} (${pc(c.amount / sum)}%)`));
  }
  return lines.join("\n") + limitNote(ctx);
}

function summaryText(ctx: Ctx): string {
  const s = summarize(ctx), a = alertFor(s.income, s.expense);
  const lines = [`${a.title}. ${a.text}`, `Pemasukan ${rp(s.income)} · Pengeluaran ${rp(s.expense)} · Selisih ${rp(s.net)}.`];
  if (s.savingsRate !== null) lines.push(`Sisa pemasukan: ${s.savingsRate < 0 ? "minus " : ""}${Math.abs(Math.round(s.savingsRate * 100))}%.`);
  if (s.top[0]) lines.push(`Pengeluaran terbesar: ${s.top[0].name} (${rp(s.top[0].amount)}).`);
  if (s.expenseChange !== null) lines.push(`Pengeluaran ${s.expenseChange >= 0 ? "naik" : "turun"} ${Math.abs(Math.round(s.expenseChange * 100))}% dibanding tanggal 1–${s.day} bulan lalu.`);
  return lines.join("\n");
}

function forecastText(ctx: Ctx): string {
  const f = forecast(ctx);
  if (!f.sufficient) return `${f.reason}\nCatat transaksi lebih rutin, lalu tanyakan lagi.`;
  const lines = [
    `Saldo saat ini ${rp(ctx.balance)}.`,
    `Rata-rata pengeluaran 30 hari terakhir ≈ ${rp(Math.round(f.avgDaily ?? 0))} per hari (${f.observedDays} hari data, ${f.count} transaksi).`,
    `Perkiraan saldo akhir bulan (${f.remainingDays} hari lagi, tanpa pemasukan baru): ${rp(Math.round(f.endBalance ?? 0))}.`,
  ];
  if ((f.endBalance ?? 0) < 0) lines.push("Dengan pola ini, saldo bisa habis sebelum akhir bulan jika tidak ada pemasukan baru.");
  if (f.coverDays !== null && f.coverDays !== undefined) lines.push(`Pada kecepatan ini saldo bertahan ≈ ${f.coverDays} hari tanpa pemasukan baru.`);
  lines.push("Ini perkiraan dari pola lalu; pengeluaran besar tak terduga atau pemasukan baru akan mengubahnya.");
  return lines.join("\n");
}

function affordText(ctx: Ctx, amount: number): string {
  const lines = [`Nominal yang ditanyakan: ${rp(amount)}.`];
  if (amount > ctx.balance) lines.push(`Itu lebih besar dari total saldo Anda (${rp(ctx.balance)}); kurang ${rp(amount - ctx.balance)}.`);
  else {
    lines.push(`Saldo setelah pembelian: ${rp(ctx.balance - amount)}.`);
    const f = forecast(ctx);
    if (f.sufficient) {
      const after = Math.round((f.endBalance ?? 0) - amount);
      lines.push(after < 0
        ? `Jika pola belanja 30 hari terakhir berlanjut (≈ ${rp(Math.round(f.avgDaily ?? 0))}/hari, tanpa pemasukan baru), saldo akhir bulan diperkirakan ${rp(Math.round(f.endBalance ?? 0))}; setelah pembelian ini menjadi ${rp(after)} (kurang), artinya saldo bisa habis sebelum akhir bulan.`
        : `Jika pola belanja 30 hari terakhir berlanjut (tanpa pemasukan baru), saldo akhir bulan diperkirakan tetap ${rp(after)} setelah pembelian ini.`);
    } else lines.push(`${f.reason} Karena itu saya belum bisa memperkirakan sampai akhir bulan.`);
  }
  lines.push("Ini hanya gambaran dari data Anda; keputusan tetap di tangan Anda.");
  return lines.join("\n");
}

export function answer(raw: string, ctx: Ctx): string {
  const q = raw.toLowerCase().replace(/[?!]/g, " ").replace(/\s+/g, " ").trim();
  if (!q) return "Tulis pertanyaan Anda, misalnya: “Berapa pengeluaran bulan ini?”";
  const p = periodFor(q, ctx.now);

  if (/(boleh|bisa|mampu|sanggup|cukup|aman).{0,40}(beli|bayar|belanja|ambil|cicil)|^(beli|bayar|belanja) /.test(q)) {
    const amt = parseAmount(q);
    return amt ? affordText(ctx, amt) : "Sebutkan nominalnya, misalnya: “Boleh beli HP 2 juta?”";
  }
  if (/kategori (terbesar|terbanyak|tertinggi|paling)|paling (boros|besar|banyak)|terbesar|terboros|habis untuk apa|dihabiskan untuk/.test(q)) {
    const cats = byCategory(ctx, p.from, p.to, "expense");
    if (p.from.getTime() < ctx.coverageStart.getTime()) return `Saya hanya memuat transaksi sejak ${dstr(ctx.coverageStart)}.`;
    if (cats.length === 0) return `Belum ada pengeluaran tercatat ${p.label}.`;
    const sum = cats.reduce((s, c) => s + c.amount, 0);
    return [`Pengeluaran terbesar ${p.label}:`, ...cats.slice(0, 3).map((c, i) => `${i + 1}. ${c.name}: ${rp(c.amount)} (${pc(c.amount / sum)}%, ${c.count} transaksi)`)].join("\n") + limitNote(ctx);
  }
  if (/ringkas|ringkasan|kondisi|kabar|gambaran|rangkum|bagaimana keuangan|keuangan saya/.test(q)) return summaryText(ctx);
  if (/saran|hemat|tips|kurangi|irit|efisien|boros/.test(q)) {
    const r = suggestions(ctx);
    if (!r.enough) return r.note;
    if (r.tips.length === 0) return r.note;
    return ["Saran dari pola transaksi Anda:", ...r.tips.map((t) => `• ${t.title}. ${t.body}`)].join("\n");
  }
  if (/bandingkan|dibanding|banding|\bvs\b|naik atau turun/.test(q)) {
    const s = summarize(ctx);
    if (!s.hasPrev) return `Data bulan lalu belum dimuat lengkap (data sejak ${dstr(ctx.coverageStart)}).`;
    if (s.pExpense === 0 && s.pIncome === 0) return "Belum ada transaksi bulan lalu untuk dibandingkan.";
    const ch = (v: number | null) => (v === null ? "tidak bisa dihitung (bulan lalu 0)" : `${v >= 0 ? "naik" : "turun"} ${Math.abs(Math.round(v * 100))}%`);
    return [`Dibandingkan tanggal 1–${s.day} bulan lalu:`, `• Pengeluaran ${rp(s.expense)} vs ${rp(s.pExpense)} → ${ch(s.expenseChange)}`, `• Pemasukan ${rp(s.income)} vs ${rp(s.pIncome)} → ${ch(s.incomeChange)}`].join("\n");
  }
  if (/sisa saldo|akhir bulan|estimasi|prediksi|proyeksi|perkiraan|bertahan|cukup sampai|habis kapan|berapa hari/.test(q)) return forecastText(ctx);
  if (/peringatan|persen|porsi|rasio|% /.test(q) || /apakah.*aman/.test(q)) { const s = summarize(ctx); const a = alertFor(s.income, s.expense); return `${a.title}. ${a.text}`; }
  if (/anggaran|budget/.test(q)) {
    if (ctx.budgets.length === 0) return "Belum ada anggaran bulan ini. Anda bisa membuatnya di menu Rencana.";
    const s = summarize(ctx);
    return ["Anggaran bulan ini:", ...ctx.budgets.map((b) => { const u = s.top.find((t) => t.id === b.category_id)?.amount ?? 0; return `• ${nameOf(ctx, b.category_id)}: ${rp(u)} dari ${rp(b.limit)} (${pc(u / b.limit)}%)`; })].join("\n");
  }
  if (/tabungan|target|menabung/.test(q)) {
    if (ctx.goals.length === 0) return "Belum ada target tabungan. Anda bisa membuatnya di menu Rencana.";
    return ["Target tabungan:", ...ctx.goals.map((g) => `• ${g.name}: ${rp(g.saved)} dari ${rp(g.target)} (${pc(g.saved / g.target)}%)`)].join("\n");
  }
  if (/utang|piutang|hutang|pinjam/.test(q)) {
    if (ctx.debts.length === 0) return "Tidak ada utang atau piutang yang belum lunas.";
    return ["Utang-piutang belum lunas:", ...ctx.debts.map((d) => `• ${d.kind === "borrowed" ? "Utang ke" : "Piutang dari"} ${d.person}: sisa ${rp(d.remaining)}${d.due ? `, jatuh tempo ${dstr(new Date(d.due))}` : ""}`)].join("\n");
  }
  const cat = ctx.cats.find((c) => c.name.toLowerCase() !== "lainnya" && new RegExp(`\\b${c.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(q));
  if (cat) return periodAnswer(ctx, cat.kind, p, cat);
  if (/saldo|rekening|uang saya|punya berapa/.test(q))
    return [`Total saldo ${rp(ctx.balance)}.`, ...ctx.accounts.map((a) => `• ${a.name}: ${rp(a.balance)}`)].join("\n");
  if (/pemasukan|pendapatan|gaji|uang masuk/.test(q)) return periodAnswer(ctx, "income", p);
  if (/pengeluaran|belanja|keluar|habis|jajan|spend/.test(q)) return periodAnswer(ctx, "expense", p);
  return "Maaf, saya belum paham pertanyaan itu. Saya bisa menjawab soal pemasukan, pengeluaran, kategori terbesar, saldo, anggaran, tabungan, utang, perbandingan bulan lalu, estimasi akhir bulan, dan “boleh beli … ?”.";
}
