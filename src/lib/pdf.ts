// Pembuat PDF kecil tanpa library: halaman A4, font Helvetica bawaan PDF, kotak, garis, lingkaran, teks.
// Koordinat memakai titik (pt) dengan pusat di KIRI-ATAS halaman (y bertambah ke bawah).

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;

const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

// Karakter di luar Latin-1 dipetakan ke kode WinAnsi bila ada, selain itu diganti.
const WIN: Record<number, number> = { 8364: 128, 8218: 130, 8222: 132, 8230: 133, 8226: 149, 8211: 150, 8212: 151, 8216: 145, 8217: 146, 8220: 147, 8221: 148, 8482: 153, 8594: 62 };

export function clean(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    const c = ch.codePointAt(0)!;
    if (c === 9 || c === 10 || c === 13) out += " ";
    else if (c >= 32 && c <= 126) out += ch;
    else if (c >= 160 && c <= 255) out += ch;
    else if (WIN[c] !== undefined) out += String.fromCharCode(WIN[c] === 62 ? 62 : WIN[c]);
    else if (c > 0xffff || (c >= 0x2190 && c <= 0x2bff) || (c >= 0x1f000)) out += ""; // emoji & simbol
    else out += "?";
  }
  return out;
}

export function textWidth(s: string, size: number, bold = false): number {
  const t = bold ? W_BOLD : W_REG;
  let w = 0;
  for (const ch of clean(s)) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 126 ? t[c - 32] : 556;
  }
  return (w * size) / 1000;
}

export function fit(s: string, size: number, maxW: number, bold = false): string {
  s = clean(s);
  if (textWidth(s, size, bold) <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textWidth(s.slice(0, mid) + "...", size, bold) <= maxW) lo = mid; else hi = mid - 1;
  }
  return s.slice(0, lo).trimEnd() + "...";
}

export type RGB = [number, number, number];
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const f = (n: number) => (Math.round(n * 100) / 100).toString();
const col = (c: RGB) => `${f(c[0])} ${f(c[1])} ${f(c[2])}`;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export class Pdf {
  private pages: string[][] = [];
  private cur: string[] = [];
  title = "Dokumen";
  author = "DOMPET ANAM";

  addPage() { this.cur = []; this.pages.push(this.cur); }
  get pageCount() { return this.pages.length; }
  /** Pindah ke halaman tertentu (1..n), berguna untuk menulis "Halaman x dari y" di akhir. */
  goto(n: number) { this.cur = this.pages[n - 1]; }

  rect(x: number, y: number, w: number, h: number, fill?: RGB, stroke?: RGB, lw = 0.6) {
    const o: string[] = [];
    if (fill) o.push(`${col(fill)} rg`);
    if (stroke) o.push(`${col(stroke)} RG ${f(lw)} w`);
    o.push(`${f(x)} ${f(PAGE_H - y - h)} ${f(w)} ${f(h)} re ${fill && stroke ? "B" : fill ? "f" : "S"}`);
    this.cur.push(o.join("\n"));
  }

  /** Persegi bersudut membulat. */
  rrect(x: number, y: number, w: number, h: number, r: number, fill?: RGB, stroke?: RGB, lw = 0.6) {
    r = Math.min(r, w / 2, h / 2);
    const k = 0.5523 * r, X = x, Y = PAGE_H - y - h; // titik kiri-bawah
    const p = [
      `${f(X + r)} ${f(Y)} m`, `${f(X + w - r)} ${f(Y)} l`,
      `${f(X + w - r + k)} ${f(Y)} ${f(X + w)} ${f(Y + r - k)} ${f(X + w)} ${f(Y + r)} c`,
      `${f(X + w)} ${f(Y + h - r)} l`,
      `${f(X + w)} ${f(Y + h - r + k)} ${f(X + w - r + k)} ${f(Y + h)} ${f(X + w - r)} ${f(Y + h)} c`,
      `${f(X + r)} ${f(Y + h)} l`,
      `${f(X + r - k)} ${f(Y + h)} ${f(X)} ${f(Y + h - r + k)} ${f(X)} ${f(Y + h - r)} c`,
      `${f(X)} ${f(Y + r)} l`,
      `${f(X)} ${f(Y + r - k)} ${f(X + r - k)} ${f(Y)} ${f(X + r)} ${f(Y)} c h`,
    ];
    const o: string[] = [];
    if (fill) o.push(`${col(fill)} rg`);
    if (stroke) o.push(`${col(stroke)} RG ${f(lw)} w`);
    o.push(p.join("\n"), fill && stroke ? "B" : fill ? "f" : "S");
    this.cur.push(o.join("\n"));
  }

  circle(cx: number, cy: number, r: number, fill?: RGB, stroke?: RGB, lw = 1) {
    const k = 0.5523 * r, X = cx, Y = PAGE_H - cy;
    const p = [
      `${f(X + r)} ${f(Y)} m`,
      `${f(X + r)} ${f(Y + k)} ${f(X + k)} ${f(Y + r)} ${f(X)} ${f(Y + r)} c`,
      `${f(X - k)} ${f(Y + r)} ${f(X - r)} ${f(Y + k)} ${f(X - r)} ${f(Y)} c`,
      `${f(X - r)} ${f(Y - k)} ${f(X - k)} ${f(Y - r)} ${f(X)} ${f(Y - r)} c`,
      `${f(X + k)} ${f(Y - r)} ${f(X + r)} ${f(Y - k)} ${f(X + r)} ${f(Y)} c h`,
    ];
    const o: string[] = [];
    if (fill) o.push(`${col(fill)} rg`);
    if (stroke) o.push(`${col(stroke)} RG ${f(lw)} w`);
    o.push(p.join("\n"), fill && stroke ? "B" : fill ? "f" : "S");
    this.cur.push(o.join("\n"));
  }

  line(x1: number, y1: number, x2: number, y2: number, c: RGB, lw = 0.6) {
    this.cur.push(`${col(c)} RG ${f(lw)} w ${f(x1)} ${f(PAGE_H - y1)} m ${f(x2)} ${f(PAGE_H - y2)} l S`);
  }

  /** y = garis dasar teks (dari atas). align: kiri / tengah / kanan terhadap x. */
  text(s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: RGB; align?: "left" | "center" | "right" } = {}) {
    const size = o.size ?? 10, bold = !!o.bold;
    const t = clean(s);
    if (!t) return;
    const w = textWidth(t, size, bold);
    const px = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    this.cur.push(`BT /${bold ? "F2" : "F1"} ${f(size)} Tf ${col(o.color ?? [0, 0, 0])} rg ${f(px)} ${f(PAGE_H - y)} Td (${esc(t)}) Tj ET`);
  }

  build(): Uint8Array {
    const objs: string[] = [];
    const add = (s: string) => { objs.push(s); return objs.length; };
    add("<< /Type /Catalog /Pages 2 0 R >>");
    add(""); // Pages, diisi nanti
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const info = add(`<< /Title (${esc(clean(this.title))}) /Author (${esc(clean(this.author))}) /Producer (DOMPET ANAM) >>`);
    const kids: number[] = [];
    for (const p of this.pages) {
      const body = p.join("\n");
      const c = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
      const pg = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(PAGE_W)} ${f(PAGE_H)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${c} 0 R >>`);
      kids.push(pg);
    }
    objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
    let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const off: number[] = [];
    objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }
}
