import { useOnline } from "../lib/offline";
import { isDemo, exitDemo } from "../lib/demo";
import { confirmBox } from "../lib/ui";

export default function StatusPills() {
  const online = useOnline();
  const demo = isDemo();
  if (online && !demo) return null;
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+6px)] z-40 flex flex-col items-center gap-1.5 px-3">
      {!online && (
        <div role="status" className="pointer-events-auto rounded-full bg-amber-400 px-3 py-1 text-center text-[11px] font-semibold text-black shadow">
          📡 Offline · menampilkan data terakhir, perubahan butuh internet
        </div>
      )}
      {demo && (
        <button onClick={async () => { if (await confirmBox("Keluar dari Mode Demo? Data contoh akan hilang.", { okLabel: "Keluar", danger: false, icon: "logOut" })) exitDemo(); }} className="pointer-events-auto rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-navy shadow">
          MODE DEMO · data contoh tidak disimpan · Keluar
        </button>
      )}
    </div>
  );
}
