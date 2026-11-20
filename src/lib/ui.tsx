import { useEffect, useState } from "react";
import LucideIcon, { type LucideName } from "../components/LucideIcon";

type Ask = { message: string; okLabel: string; danger: boolean; icon?: LucideName; resolve: (v: boolean) => void };
type Toast = { id: number; text: string; kind: "ok" | "error" | "info" };

let setAsk: ((a: Ask | null) => void) | null = null;
let addToast: ((t: Toast) => void) | null = null;
let seq = 0;

// Pengganti window.confirm yang lebih elegan.
export function confirmBox(message: string, opts: { okLabel?: string; danger?: boolean; icon?: LucideName } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setAsk) return resolve(window.confirm(message));
    setAsk({ message, okLabel: opts.okLabel ?? "Ya, lanjutkan", danger: opts.danger ?? true, icon: opts.icon, resolve });
  });
}

// Pengganti window.alert: pesan singkat yang hilang sendiri.
export function toast(text: string, kind: Toast["kind"] = "info") {
  if (kind === "ok") navigator.vibrate?.(12);
  if (addToast) addToast({ id: ++seq, text, kind });
}

const BG = { ok: "#0c8a5e", error: "#b42318", info: "#0b1f3a" } as const;
const MARK = { ok: "✓", error: "!", info: "i" } as const;

export function UiHost() {
  const [ask, setAskState] = useState<Ask | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    setAsk = setAskState;
    addToast = (t) => {
      setToasts((x) => [...x.slice(-2), t]);
      window.setTimeout(() => setToasts((x) => x.filter((y) => y.id !== t.id)), 3200);
    };
    return () => { setAsk = null; addToast = null; };
  }, []);

  function close(v: boolean) {
    if (!ask) return;
    ask.resolve(v);
    setAskState(null);
  }

  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="toast-in pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-xl" style={{ background: BG[t.kind] }}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold">{MARK[t.kind]}</span>
            {t.text}
          </div>
        ))}
      </div>

      {ask && (
        <div className="fade-in fixed inset-0 z-[55] flex items-center justify-center bg-black/50 px-6 backdrop-blur-sm" onClick={() => close(false)}>
          <div role="alertdialog" aria-modal="true" className="pop w-full max-w-sm rounded-3xl bg-paper p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl ${ask.danger ? "bg-red-100" : "bg-emerald/15"}`}>{ask.icon ? <LucideIcon name={ask.icon} className="h-6 w-6 text-navy" /> : ask.danger ? "🗑️" : "💾"}</div>
            <p className="mt-3 text-center text-[15px] leading-relaxed text-charcoal">{ask.message}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => close(false)} className="rounded-xl border border-charcoal/15 bg-white py-3 font-medium text-charcoal">Batal</button>
              <button onClick={() => close(true)} className={`rounded-xl py-3 font-semibold text-white ${ask.danger ? "bg-red-600" : "bg-emerald"}`}>{ask.okLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
