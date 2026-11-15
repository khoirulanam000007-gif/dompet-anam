import { useSyncExternalStore } from "react";

// Menangkap tawaran "pasang aplikasi" dari browser (Android/Chrome) agar bisa dipicu lewat tombol sendiri.
type Evt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: Evt | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as Evt; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; emit(); });
}

export const isStandalone = () =>
  (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) || (navigator as unknown as { standalone?: boolean }).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function useInstall() {
  const canPrompt = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => deferred !== null, () => false);
  return {
    canPrompt,
    async install() {
      if (!deferred) return false;
      await deferred.prompt();
      const r = await deferred.userChoice;
      deferred = null; emit();
      return r.outcome === "accepted";
    },
  };
}
