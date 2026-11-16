import { Pdf, PAGE_W, PAGE_H, hex, fit, textWidth, type RGB } from "./pdf";

export type ReportRow = { date: Date; kind: string; category: string; account: string; note: string; amount: number; sign: 1 | -1 | 0; tone: "in" | "out" | "other" };
export type ReportInput = {
  periodLabel: string;
  userName: string;
  rows: ReportRow[];
  income: number;
  expense: number;
  totalBalance: number;
  expenseByCat: [string, number][];
  incomeByCat: [string, number][];
  byAccount: { name: string; income: number; expense: number }[];
  days: number; // jumlah hari pada periode (untuk rata-rata)
  generatedAt?: Date;
};

const NAVY = hex("#0b1f3a"), GOLD = hex("#c9a961"), GREEN = hex("#0c8a5e"), RED = hex("#b42318");
const INK = hex("#1f2430"), MUTED = hex("#6b7280"), SOFT = hex("#f3f5f8"), TRACK = hex("#e5e8ee"), ZEBRA = hex("#f8f9fb"), WHITE: RGB = [1, 1, 1];
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const rp = (n: number) => `${n < 0 ? "-" : ""}Rp ${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;
const dmy = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;

const M = 40, CW = PAGE_W - M * 2;

export function buildReportPdf(r: ReportInput): Uint8Array {
  const pdf = new Pdf();
  pdf.title = `Laporan Keuangan ${r.periodLabel}`;
  const gen = r.generatedAt ?? new Date();

  // ---------- halaman 1: kepala
  pdf.addPage();
  pdf.rect(0, 0, PAGE_W, 98, NAVY);
  pdf.rect(0, 98, PAGE_W, 3, GOLD);
  pdf.circle(M + 22, 50, 21, undefined, GOLD, 1.6);
  pdf.text("DP", M + 22, 55, { size: 14, bold: true, color: WHITE, align: "center" });
  pdf.text("LAPORAN KEUANGAN", M + 56, 44, { size: 19, bold: true, color: WHITE });
  pdf.text("DOMPETPRO", M + 56, 61, { size: 9, bold: true, color: GOLD });
  pdf.text(r.userName ? `Atas nama: ${fit(r.userName, 9, 240)}` : "Aplikasi keuangan pribadi", M + 56, 77, { size: 9, color: [0.85, 0.88, 0.93] });
  pdf.text("PERIODE", PAGE_W - M, 40, { size: 7.5, bold: true, color: GOLD, align: "right" });
  pdf.text(r.periodLabel, PAGE_W - M, 58, { size: 15, bold: true, color: WHITE, align: "right" });
  pdf.text(`Dibuat ${dmy(gen)}`, PAGE_W - M, 77, { size: 8, color: [0.85, 0.88, 0.93], align: "right" });

  // ---------- kartu ringkasan
  const net = r.income - r.expense;
  const cards: [string, string, RGB, string][] = [
    ["PEMASUKAN", rp(r.income), GREEN, "Total uang masuk"],
    ["PENGELUARAN", rp(r.expense), RED, "Total uang keluar"],
    ["SELISIH", `${net >= 0 ? "+" : "-"}${rp(Math.abs(net)).replace("Rp", "Rp")}`, net >= 0 ? GREEN : RED, net >= 0 ? "Surplus periode ini" : "Defisit periode ini"],
    ["SALDO SAAT INI", rp(r.totalBalance), NAVY, "Semua rekening"],
  ];
  const gap = 10, cw = (CW - gap * 3) / 4;
  cards.forEach(([label, value, color, sub], i) => {
    const x = M + i * (cw + gap), y = 120;
    pdf.rrect(x, y, cw, 62, 6, SOFT);
    pdf.rect(x, y + 8, 3.5, 46, color);
    pdf.text(label, x + 12, y + 18, { size: 7, bold: true, color: MUTED });
    let size = 12.5;
    while (size > 8 && textWidth(value, size, true) > cw - 20) size -= 0.5;
    pdf.text(value, x + 12, y + 37, { size, bold: true, color });
    pdf.text(sub, x + 12, y + 51, { size: 7, color: MUTED });
  });

  const avg = r.days > 0 ? r.expense / r.days : 0;
  pdf.text(`${r.rows.length} transaksi  ·  Rata-rata pengeluaran per hari ${rp(avg)}`, M, 203, { size: 8.5, color: MUTED });

  // ---------- per kategori (dua kolom)
  let y = 228;
  const colW = (CW - 24) / 2;
  const section = (title: string, x: number, yy: number) => {
    pdf.text(title, x, yy, { size: 11, bold: true, color: NAVY });
    pdf.rect(x, yy + 5, 26, 2, GOLD);
  };
  const bars = (items: [string, number][], total: number, x: number, y0: number, color: RGB) => {
    const top = items.slice(0, 6);
    if (top.length === 0) pdf.text("Tidak ada data.", x, y0 + 8, { size: 9, color: MUTED });
    top.forEach(([name, v], i) => {
      const yy = y0 + i * 27;
      const pct = total > 0 ? v / total : 0;
      pdf.text(fit(name, 9, colW - 110), x, yy + 8, { size: 9, color: INK });
      pdf.text(`${Math.round(pct * 100)}%`, x + colW - 84, yy + 8, { size: 8, color: MUTED, align: "right" });
      pdf.text(rp(v), x + colW, yy + 8, { size: 9, bold: true, color: INK, align: "right" });
      pdf.rrect(x, yy + 13, colW, 5, 2.5, TRACK);
      if (pct > 0) pdf.rrect(x, yy + 13, Math.max(5, colW * pct), 5, 2.5, color);
    });
    return y0 + Math.max(1, top.length) * 27;
  };
  section("Pengeluaran per kategori", M, y);
  section("Pemasukan per kategori", M + colW + 24, y);
  const e1 = bars(r.expenseByCat, r.expense, M, y + 18, RED);
  const e2 = bars(r.incomeByCat, r.income, M + colW + 24, y + 18, GREEN);
  y = Math.max(e1, e2) + 14;

  // ---------- per rekening
  const accRows = r.byAccount.filter((a) => a.income || a.expense).slice(0, 8);
  if (accRows.length) {
    section("Ringkasan per rekening", M, y);
    y += 16;
    pdf.rrect(M, y, CW, 20, 4, NAVY);
    pdf.text("Rekening", M + 10, y + 13.5, { size: 8, bold: true, color: WHITE });
    pdf.text("Pemasukan", M + 330, y + 13.5, { size: 8, bold: true, color: WHITE, align: "right" });
    pdf.text("Pengeluaran", M + 420, y + 13.5, { size: 8, bold: true, color: WHITE, align: "right" });
    pdf.text("Selisih", M + CW - 10, y + 13.5, { size: 8, bold: true, color: WHITE, align: "right" });
    y += 20;
    accRows.forEach((a, i) => {
      if (i % 2 === 1) pdf.rect(M, y, CW, 18, ZEBRA);
      pdf.text(fit(a.name, 8.5, 230), M + 10, y + 12.5, { size: 8.5, color: INK });
      pdf.text(rp(a.income), M + 330, y + 12.5, { size: 8.5, color: GREEN, align: "right" });
      pdf.text(rp(a.expense), M + 420, y + 12.5, { size: 8.5, color: RED, align: "right" });
      const d = a.income - a.expense;
      pdf.text(`${d >= 0 ? "+" : "-"}${rp(Math.abs(d))}`, M + CW - 10, y + 12.5, { size: 8.5, bold: true, color: d >= 0 ? GREEN : RED, align: "right" });
      y += 18;
    });
    y += 14;
  }

  // ---------- rincian transaksi
  const cols = [58, 72, 100, 80, 110, 95]; // total 515
  const cx = cols.reduce<number[]>((a, w, i) => { a.push(i === 0 ? M : a[i - 1] + cols[i - 1]); return a; }, []);
  const ROW = 17;
  const contHeader = () => {
    pdf.rect(0, 0, PAGE_W, 30, NAVY);
    pdf.rect(0, 30, PAGE_W, 2, GOLD);
    pdf.text("DOMPETPRO", M, 20, { size: 9, bold: true, color: GOLD });
    pdf.text(`Laporan ${r.periodLabel}`, PAGE_W - M, 20, { size: 9, color: WHITE, align: "right" });
  };
  const tableHead = (yy: number) => {
    pdf.rrect(M, yy, CW, 20, 4, NAVY);
    const H = ["Tanggal", "Jenis", "Kategori", "Rekening", "Catatan", "Jumlah"];
    H.forEach((h, i) => pdf.text(h, i === 5 ? cx[i] + cols[i] - 8 : cx[i] + 8, yy + 13.5, { size: 8, bold: true, color: WHITE, align: i === 5 ? "right" : "left" }));
  };

  if (y > PAGE_H - 150) { pdf.addPage(); contHeader(); y = 52; }
  section("Rincian transaksi", M, y);
  y += 16;
  if (r.rows.length === 0) {
    pdf.text("Tidak ada transaksi pada periode ini.", M, y + 12, { size: 9.5, color: MUTED });
  } else {
    tableHead(y);
    y += 20;
    r.rows.forEach((t, i) => {
      if (y + ROW > PAGE_H - 52) { pdf.addPage(); contHeader(); y = 48; tableHead(y); y += 20; }
      if (i % 2 === 1) pdf.rect(M, y, CW, ROW, ZEBRA);
      const base = y + 11.5;
      pdf.text(dmy(t.date), cx[0] + 8, base, { size: 8, color: INK });
      pdf.text(fit(t.kind, 8, cols[1] - 8), cx[1] + 8, base, { size: 8, color: INK });
      pdf.text(fit(t.category, 8, cols[2] - 8), cx[2] + 8, base, { size: 8, color: INK });
      pdf.text(fit(t.account, 8, cols[3] - 8), cx[3] + 8, base, { size: 8, color: MUTED });
      pdf.text(fit(t.note, 8, cols[4] - 8), cx[4] + 8, base, { size: 8, color: MUTED });
      const color = t.tone === "in" ? GREEN : t.tone === "out" ? RED : INK;
      pdf.text(`${t.sign > 0 ? "+" : t.sign < 0 ? "-" : ""}${rp(t.amount)}`, cx[5] + cols[5] - 8, base, { size: 8, bold: true, color, align: "right" });
      y += ROW;
    });
    pdf.line(M, y + 2, M + CW, y + 2, TRACK, 0.8);
  }

  // ---------- kaki halaman
  const n = pdf.pageCount;
  for (let p = 1; p <= n; p++) {
    pdf.goto(p);
    pdf.line(M, PAGE_H - 34, PAGE_W - M, PAGE_H - 34, TRACK, 0.8);
    pdf.text(`DOMPETPRO  ·  Laporan keuangan ${r.periodLabel}`, M, PAGE_H - 20, { size: 7.5, color: MUTED });
    pdf.text(`Halaman ${p} dari ${n}`, PAGE_W - M, PAGE_H - 20, { size: 7.5, color: MUTED, align: "right" });
  }
  return pdf.build();
}
