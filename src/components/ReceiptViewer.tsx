import { useEffect } from "react";
import { createPortal } from "react-dom";

// Tampilan penuh foto struk. Ketuk area gelap, tombol ×, atau Esc untuk menutup.
export default function ReceiptViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return createPortal(
    <div className="fade-in fixed inset-0 z-[62] flex flex-col bg-black/90" onClick={onClose} role="dialog" aria-modal="true" aria-label="Foto struk">
      <div className="flex items-center justify-between px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white">
        <p className="font-semibold">Foto struk</p>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {src && <a href={src} download="struk-dompetpro.jpg" className="rounded-full bg-white/15 px-3 py-1.5 text-sm">Unduh</a>}
          <button onClick={onClose} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xl leading-none">×</button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {src ? <img src={src} alt="Foto struk" onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-xl object-contain" /> : <p className="text-white/70">Memuat foto…</p>}
      </div>
    </div>,
    document.body
  );
}
