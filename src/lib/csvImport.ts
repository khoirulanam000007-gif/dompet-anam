// Impor transaksi dari CSV / Excel (.xlsx) tanpa library tambahan.
// Semua logika murni (tanpa tampilan) supaya mudah diuji.

export type Table = { headers: string[]; rows: string[][] };
export type Field = "date" | "type" | "category" | "account" | "amount" | "note";
export type Mapping = Record<Field, number>; // indeks kolom, -1 = tidak ada

export const MAX_ROWS = 5000;
export const FIELD_LABEL: Record<Field, string> = {
  date: "Tanggal", type: "Jenis", category: "Kategori", account: "Rekening", amount: "Nominal", note: "Catatan",
};

// ---------------------------------------------------------------- CSV
export function parseCsv(input: string): Table {
  const text = input.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const cnt = (c: string) => first.split(c).length - 1;
  const delim = [";", "\t", ",", "|"].map((d) => [d, cnt(d)] as const).sort((a, b) => b[1] - a[1])[0];
  const d = delim[1] > 0 ? delim[0] : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === d) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return toTable(rows);
}

function toTable(rows: string[][]): Table {
  if (rows.length === 0) return { headers: [], rows: [] };
  const w = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => Array.from({ length: w }, (_, i) => (r[i] ?? "").trim()));
  return { headers: norm[0], rows: norm.slice(1) };
}

// ---------------------------------------------------------------- XLSX (ZIP + XML tanpa library)
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf: Uint8Array): Promise<Map<string, () => Promise<string>>> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (u32(buf, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("File Excel tidak valid.");
  const count = u16(buf, eocd + 10);
  let p = u32(buf, eocd + 16);
  const out = new Map<string, () => Promise<string>>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (u32(buf, p) !== 0x02014b50) break;
    const method = u16(buf, p + 10);
    const csize = u32(buf, p + 20);
    const nlen = u16(buf, p + 28), elen = u16(buf, p + 30), clen = u16(buf, p + 32);
    const lho = u32(buf, p + 42);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    out.set(name, async () => {
      const start = lho + 30 + u16(buf, lho + 26) + u16(buf, lho + 28);
      const raw = buf.subarray(start, start + csize);
      if (method === 0) return dec.decode(raw);
      if (method === 8) return dec.decode(await inflateRaw(raw));
      throw new Error("Format kompresi Excel tidak didukung.");
    });
    p += 46 + nlen + elen + clen;
  }
  return out;
}

const unesc = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const textOf = (xml: string) => {
  let s = "";
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += m[1];
  return unesc(s);
};

const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/[0-9]/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function serialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export async function parseXlsx(data: ArrayBuffer): Promise<Table> {
  const files = await unzip(new Uint8Array(data));
  const read = async (n: string) => (files.has(n) ? files.get(n)!() : "");

  // Lembar pertama
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  const first = wb.match(/<sheet\b[^>]*r:id="([^"]+)"/);
  if (first) {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`Id="${first[1]}"`));
    const target = rel?.match(/Target="([^"]+)"/)?.[1];
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
  }
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error("Lembar pertama Excel tidak ditemukan.");

  const sst: string[] = [];
  for (const m of (await read("xl/sharedStrings.xml")).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) sst.push(textOf(m[1]));

  // Gaya sel yang berformat tanggal
  const styles = await read("xl/styles.xml");
  const customDate = new Set<number>();
  for (const m of styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    const code = m[2].replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
    if (/[dmyh]/i.test(code) && !/[#0]/.test(code)) customDate.add(Number(m[1]));
  }
  const xfs = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  const dateStyle: boolean[] = [...xfs.matchAll(/<xf\b[^>]*>/g)].map((m) => {
    const id = Number(m[0].match(/numFmtId="(\d+)"/)?.[1] ?? 0);
    return BUILTIN_DATE.has(id) || customDate.has(id);
  });

  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], inner = cm[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const t = attrs.match(/\bt="(\w+)"/)?.[1];
      const s = Number(attrs.match(/\bs="(\d+)"/)?.[1] ?? -1);
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val = "";
      if (t === "s") val = sst[Number(v)] ?? "";
      else if (t === "inlineStr") val = textOf(inner);
      else if (t === "str" || t === "e") val = unesc(v ?? "");
      else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
      else if (v !== undefined) val = s >= 0 && dateStyle[s] && Number(v) > 1 ? serialToIso(Number(v)) : v;
      const idx = ref ? colIndex(ref) : row.length;
      while (row.length < idx) row.push("");
      row[idx] = val;
    }
    if (row.some((c) => (c ?? "").trim() !== "")) rows.push(row.map((c) => c ?? ""));
  }
  return toTable(rows);
}

export async function readFile(file: File): Promise<Table> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return parseXlsx(await file.arrayBuffer());
  if (name.endsWith(".xls")) throw new Error("Format .xls lama belum didukung. Simpan ulang sebagai .xlsx atau .csv.");
  return parseCsv(await file.text());
}

// ---------------------------------------------------------------- Deteksi kolom
const ALIAS: Record<Field, string[]> = {
  date: ["tanggal", "tgl", "date", "waktu", "datetime", "tanggal transaksi"],
  type: ["jenis", "tipe", "type", "jenis transaksi", "dc", "kind"],
  category: ["kategori", "category", "kat"],
  account: ["rekening", "akun", "account", "dompet", "sumber dana", "wallet"],
  amount: ["nominal", "jumlah", "amount", "nilai", "total", "rp", "debit/kredit"],
  note: ["catatan", "keterangan", "note", "notes", "deskripsi", "description", "memo", "uraian"],
};

export function detectMapping(headers: string[]): Mapping {
  const m: Mapping = { date: -1, type: -1, category: -1, account: -1, amount: -1, note: -1 };
  const used = new Set<number>();
  (Object.keys(ALIAS) as Field[]).forEach((f) => {
    const i = headers.findIndex((h, k) => !used.has(k) && ALIAS[f].includes(h.trim().toLowerCase()));
    if (i >= 0) { m[f] = i; used.add(i); }
  });
  return m;
}

// ---------------------------------------------------------------- Nilai
const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12,
};

export function parseDate(raw: string): Date | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;
  let y = 0, mo = 0, d = 0, h = 12, mi = 0, sec = 0, hasTime = false;
  const time = (t?: string) => {
    if (!t) return;
    const m = t.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
    if (m) { h = Number(m[1]); mi = Number(m[2]); sec = Number(m[3] ?? 0); hasTime = true; }
  };
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T,]+(.*))?$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; time(m[4]); }
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T,]+(.*))?$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; time(m[4]); }
  else if ((m = s.match(/^(\d{1,2})[ -]([A-Za-z]+)\.?[ -,]*(\d{2,4})(?:[ T,]+(.*))?$/)) && MONTHS[m[2].toLowerCase()]) { d = +m[1]; mo = MONTHS[m[2].toLowerCase()]; y = +m[3]; if (y < 100) y += 2000; time(m[4]); }
  else if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) {
    const iso = serialToIso(+s); return parseDate(iso);
  } else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100 || h > 23 || mi > 59 || sec > 59) return null;
  const dt = new Date(y, mo - 1, d, h, mi, sec);
  if (dt.getMonth() !== mo - 1) return null; // mis. 31 Februari
  void hasTime;
  return dt;
}

export function parseAmount(raw: string): { value: number; negative: boolean } | null {
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^-|-$/.test(s)) { neg = true; s = s.replace(/^-|-$/g, ""); }
  s = s.replace(/rp\.?/gi, "").replace(/idr/gi, "").replace(/\s/g, "").replace(/^\+/, "");
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const dots = (s.match(/\./g) ?? []).length, commas = (s.match(/,/g) ?? []).length;
  let n: number;
  if (dots && commas) {
    const dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thou = dec === "." ? "," : ".";
    n = Number(s.split(thou).join("").replace(dec, "."));
  } else if (dots || commas) {
    const sep = dots ? "." : ",";
    const parts = s.split(sep);
    if (parts.length > 2) n = Number(parts.join(""));
    else n = parts[1].length === 3 ? Number(parts.join("")) : Number(parts[0] + "." + parts[1]);
  } else n = Number(s);
  if (!Number.isFinite(n)) return null;
  return { value: Math.round(n), negative: neg };
}

const INCOME = new Set(["pemasukan", "masuk", "income", "in", "kredit", "credit", "cr", "pendapatan", "uang masuk"]);
const EXPENSE = new Set(["pengeluaran", "keluar", "expense", "out", "debit", "db", "uang keluar", "belanja"]);

// ---------------------------------------------------------------- Baris terolah
export type Status = "ok" | "duplicate" | "dupfile" | "error";
export type ImportRow = {
  line: number;
  date: Date | null;
  type: "income" | "expense" | null;
  amount: number;
  categoryName: string;
  accountName: string;
  note: string;
  accountId: string | null;
  categoryId: string | null;
  newCategory: boolean;
  status: Status;
  errors: string[];
  include: boolean;
};

export type Ctx = {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; kind: "income" | "expense" }[];
  defaultAccountId: string;
  createCategories: boolean;
  createAccounts: boolean;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dupKey = (acc: string, type: string, amount: number, d: Date, note: string) => `${acc}|${type}|${amount}|${dayKey(d)}|${norm(note)}`;

export type ExistingTx = { account_id: string; type: string; amount: number; occurred_at: string; note: string | null };

export function buildRows(table: Table, map: Mapping, ctx: Ctx, existing: ExistingTx[]): ImportRow[] {
  const get = (r: string[], f: Field) => (map[f] >= 0 ? (r[map[f]] ?? "").trim() : "");
  const seen = new Set(existing.map((e) => dupKey(e.account_id, e.type, Number(e.amount), new Date(e.occurred_at), e.note ?? "")));
  const inFile = new Set<string>();
  return table.rows.slice(0, MAX_ROWS).map((r, i): ImportRow => {
    const errors: string[] = [];
    const date = parseDate(get(r, "date"));
    if (!date) errors.push(get(r, "date") ? "Tanggal tidak dikenali" : "Tanggal kosong");

    const amt = parseAmount(get(r, "amount"));
    if (!amt || amt.value <= 0) errors.push(get(r, "amount") ? "Nominal tidak valid" : "Nominal kosong");
    if (amt && amt.value > 999_999_999_999) errors.push("Nominal terlalu besar");

    let type: "income" | "expense" | null = null;
    const t = norm(get(r, "type"));
    if (t) { if (INCOME.has(t)) type = "income"; else if (EXPENSE.has(t)) type = "expense"; else errors.push(`Jenis "${get(r, "type")}" tidak dikenali`); }
    else if (amt) type = amt.negative ? "expense" : "income"; // tanpa kolom Jenis: negatif = keluar
    if (!type && !t) errors.push("Jenis kosong");

    const accountName = get(r, "account");
    let accountId: string | null = null;
    if (!accountName) accountId = ctx.defaultAccountId || null;
    else {
      accountId = ctx.accounts.find((a) => norm(a.name) === norm(accountName))?.id ?? null;
      if (!accountId && !ctx.createAccounts) errors.push(`Rekening "${accountName}" belum ada`);
    }
    if (!accountId && !accountName) errors.push("Rekening belum dipilih");

    const categoryName = get(r, "category");
    let categoryId: string | null = null, newCategory = false;
    if (categoryName && type) {
      const hit = ctx.categories.find((c) => c.kind === type && norm(c.name) === norm(categoryName));
      if (hit) categoryId = hit.id; else if (ctx.createCategories) newCategory = true;
    }

    let status: Status = errors.length ? "error" : "ok";
    if (status === "ok" && date && type && amt) {
      const key = dupKey(accountId ?? `new:${norm(accountName)}`, type, amt.value, date, get(r, "note"));
      if (accountId && seen.has(key)) status = "duplicate";
      else if (inFile.has(key)) status = "dupfile";
      inFile.add(key);
    }
    return {
      line: i + 2, date, type, amount: amt?.value ?? 0, categoryName, accountName, note: get(r, "note"),
      accountId, categoryId, newCategory, status, errors, include: status === "ok",
    };
  });
}

// ---------------------------------------------------------------- Template
export function templateCsv(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const day = (off: number) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - off); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
  const L = [
    "Tanggal;Jenis;Kategori;Rekening;Nominal;Catatan",
    `${day(2)} 08:30;Pengeluaran;Makanan;Dompet Tunai;25000;Sarapan`,
    `${day(1)} 12:15;Pengeluaran;Transportasi;GoPay;18000;Ojek ke kampus`,
    `${day(0)} 09:00;Pemasukan;Uang Saku;Bank BCA;1500000;Kiriman bulanan`,
  ];
  return "\uFEFF" + L.join("\r\n") + "\r\n";
}
