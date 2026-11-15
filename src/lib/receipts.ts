import { supabase } from "./supabase";

// Foto struk disimpan di tabel transaction_receipts (satu foto per transaksi, milik akun yang sedang masuk).
// Foto diperkecil dulu di perangkat (sisi terpanjang 1280 px, JPEG) agar ringan: biasanya 80-250 KB.
const MAX_LEN = 430_000; // batas panjang teks data-URL (sesuai batas di database: 450000)
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const loadImg = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Foto tidak bisa dibaca. Coba foto lain (JPG, PNG, atau WebP).")); };
    im.src = url;
  });

export async function compressReceipt(file: File): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error("Ukuran foto maksimal 15 MB.");
  const im = await loadImg(file);
  let scale = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight));
  for (let round = 0; round < 4; round++) {
    const w = Math.max(1, Math.round(im.naturalWidth * scale)), h = Math.max(1, Math.round(im.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Perangkat tidak mendukung pemrosesan foto.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(im, 0, 0, w, h);
    for (const q of [0.78, 0.66, 0.54, 0.42]) {
      const out = c.toDataURL("image/jpeg", q);
      if (out.length <= MAX_LEN) return out;
    }
    scale *= 0.75;
  }
  throw new Error("Foto terlalu besar untuk disimpan. Coba foto yang lebih sederhana.");
}

const notReady = (e: { message?: string; code?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /transaction_receipts/i.test(e.message ?? ""));

export const RECEIPT_SQL_MSG = "Fitur foto struk belum diaktifkan di database. Jalankan SQL Tahap 24 dulu.";

export async function getReceipt(txId: string): Promise<string | null> {
  const { data } = await supabase.from("transaction_receipts").select("image").eq("transaction_id", txId).maybeSingle();
  return (data as { image?: string } | null)?.image ?? null;
}

export async function saveReceipt(txId: string, image: string): Promise<string | null> {
  const { error } = await supabase.from("transaction_receipts").upsert({ transaction_id: txId, image }, { onConflict: "transaction_id" });
  if (!error) return null;
  return notReady(error) ? RECEIPT_SQL_MSG : error.code === "23514" ? "Foto struk terlalu besar." : "Foto struk gagal disimpan.";
}

export async function deleteReceipt(txId: string): Promise<string | null> {
  const { error } = await supabase.from("transaction_receipts").delete().eq("transaction_id", txId);
  return error ? (notReady(error) ? RECEIPT_SQL_MSG : "Foto struk gagal dihapus.") : null;
}

export async function receiptIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from("transaction_receipts").select("transaction_id");
  if (error || !data) return new Set();
  return new Set((data as { transaction_id: string }[]).map((r) => r.transaction_id));
}
