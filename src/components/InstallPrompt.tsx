import { useEffect, useState } from "react";
import { isIOS, isStandalone, useInstall } from "../lib/install";
import { isDemo } from "../lib/demo";
import Logo from "./Logo";

const SNOOZE = "installSnooze";
const snoozed = () => Date.now() - Number(localStorage.getItem(SNOOZE) ?? 0) < 7 * 86400000;

// Ajakan memasang aplikasi ke layar utama: tombol langsung (Android) atau petunjuk singkat (iPhone).
export default function InstallPrompt() {
  const { canPrompt, install } = useInstall();
  const [wait, setWait] = useState(true);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setWait(false), 6000); return () => window.clearTimeout(t); }, []);

  const ios = isIOS();
  if (wait || hidden || isDemo() || isStandalone() || snoozed() || !(canPrompt || ios)) return null;
  const later = () => { localStorage.setItem(SNOOZE, String(Date.now())); setHidden(true); };

  return (
    <div role="dialog" aria-label="Pasang aplikasi" className="no-print sheet-up fixed inset-x-4 bottom-[calc(8.25rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-2xl bg-navy p-4 text-white shadow-2xl">
      <div className="flex items-start gap-3">
        <Logo className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Pasang Dompet Pro di layar utama</p>
          <p className="mt-0.5 text-xs text-white/75">
            {canPrompt ? "Buka lebih cepat, tampil layar penuh seperti aplikasi biasa." : "Ketuk tombol Bagikan (kotak dengan panah ke atas), lalu pilih “Tambah ke Layar Utama”."}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2 text-sm">
        <button onClick={later} className="rounded-xl px-3 py-2 font-medium text-white/80">Nanti</button>
        {canPrompt && <button onClick={async () => { if (await install()) setHidden(true); }} className="rounded-xl bg-emerald px-4 py-2 font-semibold text-white">Pasang</button>}
        {!canPrompt && <button onClick={later} className="rounded-xl bg-emerald px-4 py-2 font-semibold text-white">Mengerti</button>}
      </div>
    </div>
  );
}
