import { useEffect, useRef, useState } from "react";

const V = 260;   // ukuran area potong di layar (px)
const OUT = 256; // ukuran foto hasil (px) -> file kecil

type Props = { file: File; onCancel: () => void; onSave: (dataUrl: string) => Promise<void> | void };

export default function AvatarEditor({ file, onCancel, onSave }: Props) {
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

  const P = 72;
  const img = (k: number): React.CSSProperties =>
    dim ? {
      position: "absolute", left: "50%", top: "50%", maxWidth: "none",
      width: dim.w * s * k, height: dim.h * s * k,
      transform: `translate(calc(-50% + ${pos.x * k}px), calc(-50% + ${pos.y * k}px))`,
    } : {};

  return (
    <div className="fade-in fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="sheet-up w-full max-w-sm rounded-t-3xl bg-paper p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy">Atur foto profil</h3>
          <button onClick={onCancel} className="text-sm underline">Batal</button>
        </div>
        <p className="mt-1 text-center text-xs text-charcoal/60">Geser foto untuk mengatur posisi, gunakan penggeser untuk zoom.</p>

        <div
          className="relative mx-auto mt-3 touch-none select-none overflow-hidden rounded-3xl bg-black"
          style={{ width: V, height: V, cursor: "grab" }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp({ x: d.ox + e.clientX - d.px, y: d.oy + e.clientY - d.py }, s)); }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        >
          {dim && <img ref={imgRef} src={url} alt="" draggable={false} style={img(1)} />}
          <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 400px rgba(0,0,0,.55), inset 0 0 0 2px #c9a961" }} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-charcoal/60">Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} className="flex-1 accent-[#0f9d6b]" />
          <button onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }); }} className="text-xs underline">Reset</button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="relative shrink-0 overflow-hidden rounded-full" style={{ width: P, height: P, boxShadow: "0 0 0 2px #c9a961" }}>
            {dim && <img src={url} alt="" draggable={false} style={img(P / V)} />}
          </div>
          <div className="text-sm"><p className="font-semibold">Pratinjau</p><p className="text-xs text-charcoal/60">Seperti ini foto Anda tampil di aplikasi.</p></div>
        </div>

        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
        <button onClick={save} disabled={busy || !dim} className="mt-4 w-full rounded-xl bg-emerald py-3 font-medium text-white disabled:opacity-60">
          {busy ? "Menyimpan..." : "Simpan foto"}
        </button>
      </div>
    </div>
  );
}
