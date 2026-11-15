import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Ukuran area potong menyesuaikan tinggi/lebar layar supaya tombol Simpan selalu terlihat.
const calcV = () => Math.max(180, Math.min(280, window.innerWidth - 72, Math.round(window.innerHeight * 0.4)));
const OUT = 256; // ukuran foto hasil (px) -> file kecil

type Props = { file: File; onCancel: () => void; onSave: (dataUrl: string) => Promise<void> | void };

export default function AvatarEditor({ file, onCancel, onSave }: Props) {
  const [V] = useState(calcV);
  const [url, setUrl] = useState("");
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const im = new Image();
    im.onload = () => setDim({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => setErr("Foto tidak bisa dibaca. Coba foto lain.");
    im.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const base = dim ? V / Math.min(dim.w, dim.h) : 1;
  const s = base * zoom;

  const clamp = (p: { x: number; y: number }, sc: number) => {
    if (!dim) return p;
    const mx = Math.max(0, (dim.w * sc - V) / 2);
    const my = Math.max(0, (dim.h * sc - V) / 2);
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };
  const changeZoom = (z: number) => { setZoom(z); setPos((p) => clamp(p, base * z)); };

  async function save() {
    if (!dim || !imgRef.current) return;
    setBusy(true);
    setErr("");
    try {
      const c = document.createElement("canvas");
      c.width = OUT; c.height = OUT;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUT, OUT);
      const side = V / s;
      const sx = dim.w / 2 - pos.x / s - side / 2;
      const sy = dim.h / 2 - pos.y / s - side / 2;
      ctx.drawImage(imgRef.current, sx, sy, side, side, 0, 0, OUT, OUT);
      let out = "";
      for (const q of [0.85, 0.7, 0.55]) {
        out = c.toDataURL("image/webp", q);
        if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", q);
        if (out.length <= 120000) break;
      }
      if (out.length > 200000) throw new Error("size");
      await onSave(out);
    } catch {
      setErr("Gagal memproses foto. Coba foto lain.");
    }
    setBusy(false);
  }

  const P = 56;
  const img = (k: number): React.CSSProperties =>
    dim ? {
      position: "absolute", left: "50%", top: "50%", maxWidth: "none",
      width: dim.w * s * k, height: dim.h * s * k,
      transform: `translate(calc(-50% + ${pos.x * k}px), calc(-50% + ${pos.y * k}px))`,
    } : {};

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [busy, onCancel]);

  return createPortal(
    <div className="fade-in fixed inset-0 z-[58] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={() => !busy && onCancel()}>
      <div
        role="dialog" aria-modal="true" aria-label="Atur foto profil"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[100dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl"
      >
        {/* Kepala: tetap di atas */}
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div>
            <h3 className="text-lg font-bold text-navy">Atur foto profil</h3>
            <p className="text-xs text-charcoal/60">Geser untuk memosisikan, cubit atau pakai penggeser untuk zoom.</p>
          </div>
          <button onClick={onCancel} disabled={busy} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal/10 text-lg leading-none">×</button>
        </div>

        {/* Isi: bisa digulir bila layar sangat pendek */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3">
          <div
            className="relative mx-auto mt-2 touch-none select-none overflow-hidden rounded-3xl bg-black"
            style={{ width: V, height: V, cursor: "grab" }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y }; }}
            onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp({ x: d.ox + e.clientX - d.px, y: d.oy + e.clientY - d.py }, s)); }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
          >
            {dim && <img ref={imgRef} src={url} alt="" draggable={false} style={img(1)} />}
            <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 600px rgba(0,0,0,.55), inset 0 0 0 2px #c9a961" }} />
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
            <span className="text-base" aria-hidden>🔍</span>
            <input type="range" aria-label="Zoom" min={1} max={3} step={0.01} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} className="flex-1 accent-[#0f9d6b]" />
            <button onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }); }} className="rounded-full bg-charcoal/10 px-3 py-1 text-xs font-medium">Reset</button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="relative shrink-0 overflow-hidden rounded-full bg-black" style={{ width: P, height: P, boxShadow: "0 0 0 2px #c9a961" }}>
              {dim && <img src={url} alt="" draggable={false} style={img(P / V)} />}
            </div>
            <p className="text-xs text-charcoal/60">Pratinjau: seperti ini foto Anda tampil di Beranda dan Profil.</p>
          </div>

          {err && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">{err}</p>}
        </div>

        {/* Kaki: tombol selalu terlihat, tanpa perlu menggulir */}
        <div className="grid grid-cols-[1fr_1.6fr] gap-2 border-t border-charcoal/10 bg-paper px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button onClick={onCancel} disabled={busy} className="rounded-xl border border-charcoal/15 bg-white py-3 font-medium text-charcoal disabled:opacity-60">Batal</button>
          <button onClick={save} disabled={busy || !dim} className="rounded-xl bg-emerald py-3 font-semibold text-white disabled:opacity-60">
            {busy ? "Menyimpan..." : "Simpan foto"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
