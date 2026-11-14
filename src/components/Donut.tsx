import { useEffect, useId, useState } from "react";
import { rupiah, rupiahShort } from "../lib/format";

export type Seg = { key: string; label: string; icon: string; value: number };

const PAL: [string, string][] = [
  ["#22c58b", "#0c8a5e"], ["#e2c27a", "#b8923f"], ["#5a9ae6", "#2f6bb8"],
  ["#f08a6e", "#d0583d"], ["#a58be6", "#7556bf"], ["#4fc3d0", "#2a8f9c"],
];
const REST: [string, string] = ["#9fb0c5", "#71829a"];
const R = 42;
const C = 2 * Math.PI * R;

// Diagram donut interaktif: segmen bergradien dengan jeda, animasi tergambar, sentuh untuk menyorot.
export default function Donut({ segs, total, title }: { segs: Seg[]; total: number; title: string }) {
  const uid = useId().replace(/:/g, "");
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);

  const gap = segs.length > 1 ? 3 : 0;
  let off = 0;
  const arcs = segs.map((s, i) => {
    const len = (s.value / total) * C;
    const a = { ...s, len, off, i, col: s.key === "~" ? REST : PAL[i % PAL.length] };
    off += len;
    return a;
  });
  const cur = arcs.find((a) => a.key === sel);
  const pct = (v: number) => { const p = (v / total) * 100; return p > 0 && p < 1 ? "<1" : String(Math.round(p)); };

  return (
    <div>
      <div className="relative mx-auto h-52 w-52">
        <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label={`Diagram ${title.toLowerCase()} per kategori`}>
          <defs>
            {arcs.map((a) => (
              <linearGradient key={a.key} id={`${uid}g${a.i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={a.col[0]} /><stop offset="100%" stopColor={a.col[1]} />
              </linearGradient>
            ))}
          </defs>
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="14" stroke="currentColor" className="text-charcoal/10" />
          {arcs.map((a) => {
            const draw = Math.max(0.5, a.len - gap);
            return (
              <circle
                key={a.key} cx="60" cy="60" r={R} fill="none"
                stroke={`url(#${uid}g${a.i})`} strokeWidth={sel === a.key ? 18 : 14}
                strokeDasharray={ready ? `${draw} ${C - draw}` : `0 ${C}`}
                strokeDashoffset={-(a.off + gap / 2)}
                transform="rotate(-90 60 60)"
                opacity={sel && sel !== a.key ? 0.35 : 1}
                style={{ cursor: "pointer", transition: `stroke-dasharray 0.9s cubic-bezier(0.2,0.8,0.2,1) ${a.i * 70}ms, stroke-width 0.2s, opacity 0.2s` }}
                onClick={() => setSel(sel === a.key ? null : a.key)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
          {cur ? (
            <>
              <span className="text-2xl leading-none">{cur.icon}</span>
              <span className="mt-1 max-w-full truncate text-xs text-charcoal/70">{cur.label}</span>
              <span className="text-2xl font-bold leading-tight">{pct(cur.value)}%</span>
              <span className="text-[11px] text-charcoal/60">{rupiahShort(cur.value)}</span>
            </>
          ) : (
            <>
              <span className="text-[11px] uppercase tracking-wide text-charcoal/50">{title}</span>
              <span className="text-xl font-bold leading-tight">{rupiahShort(total)}</span>
              <span className="text-[11px] text-charcoal/50">{segs.length} kategori</span>
            </>
          )}
        </div>
      </div>

      <ul className="mt-4 space-y-1">
        {arcs.map((a) => {
          const on = sel === a.key;
          return (
            <li key={a.key}>
              <button onClick={() => setSel(on ? null : a.key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${on ? "bg-charcoal/10" : ""}`}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `linear-gradient(135deg, ${a.col[0]}, ${a.col[1]})` }} />
                <span className="min-w-0 flex-1 truncate">{a.icon} {a.label}</span>
                <span className="text-charcoal/60">{pct(a.value)}%</span>
                <span className="w-24 text-right font-medium">{rupiah(a.value)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
