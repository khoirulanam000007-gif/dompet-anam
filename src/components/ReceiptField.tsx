import { useRef, useState } from "react";
import { toast } from "../lib/ui";
import { compressReceipt, RECEIPT_TYPES } from "../lib/receipts";
import ReceiptViewer from "./ReceiptViewer";

type Props = { value: string | null | undefined; onChange: (v: string | null) => void; disabled?: boolean };

// Bagian "Foto struk" di formulir transaksi: ambil dari kamera / galeri, lihat, ganti, hapus.
export default function ReceiptField({ value, onChange, disabled }: Props) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type && !RECEIPT_TYPES.includes(f.type)) return toast("Format foto harus JPG, PNG, atau WebP.", "error");
    setBusy(true);
    try { onChange(await compressReceipt(f)); }
    catch (err) { toast(err instanceof Error ? err.message : "Foto gagal diproses.", "error"); }
    setBusy(false);
  }

  const btn = "rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm font-medium disabled:opacity-60";
  return (
    <div>
      <label className="text-sm text-charcoal/70">Foto struk (opsional)</label>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={gal} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />

      {value === undefined ? (
        <div className="mt-1 h-16 animate-pulse rounded-xl bg-charcoal/10" />
      ) : value ? (
        <div className="mt-1 flex items-center gap-3 rounded-2xl border border-charcoal/10 bg-white p-2">
          <button type="button" onClick={() => setView(true)} aria-label="Lihat foto struk" className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/5">
            <img src={value} alt="Struk" className="h-full w-full object-cover" />
          </button>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setView(true)} className={btn}>Lihat</button>
            <button type="button" onClick={() => cam.current?.click()} disabled={busy || disabled} className={btn}>📷 Ganti</button>
            <button type="button" onClick={() => gal.current?.click()} disabled={busy || disabled} className={btn}>🖼️</button>
            <button type="button" onClick={() => onChange(null)} disabled={busy || disabled} className={`${btn} text-red-700`}>Hapus</button>
          </div>
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => cam.current?.click()} disabled={busy || disabled} className="rounded-xl border-2 border-dashed border-charcoal/25 bg-white py-3 text-sm font-medium disabled:opacity-60">{busy ? "Memproses…" : "📷 Kamera"}</button>
          <button type="button" onClick={() => gal.current?.click()} disabled={busy || disabled} className="rounded-xl border-2 border-dashed border-charcoal/25 bg-white py-3 text-sm font-medium disabled:opacity-60">🖼️ Galeri</button>
        </div>
      )}
      {view && <ReceiptViewer src={value ?? null} onClose={() => setView(false)} />}
    </div>
  );
}
