import { useEffect, useState } from "react";
import { toast } from "../lib/ui";
import {
  DEFAULTS, currentSubscription, deviceTz, disablePush, enablePush, loadSettings, pushSupport, saveSettings, sendTest, type Settings,
} from "../lib/push";

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const inp = "rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-emerald" : "bg-charcoal/25"}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function NotificationCard() {
  const support = pushSupport();
  const [s, setS] = useState<Settings>({ ...DEFAULTS, tz: deviceTz() });
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deviceOn, setDeviceOn] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>(typeof Notification !== "undefined" ? Notification.permission : "default");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    loadSettings().then((r) => { if (alive) { setS(r.settings); setSaved(r.saved); setMissing(r.missingTable); } });
    currentSubscription().then((sub) => { if (alive) setDeviceOn(!!sub && Notification.permission === "granted"); });
    return () => { alive = false; };
  }, []);

  const set = (p: Partial<Settings>) => { setS((x) => ({ ...x, ...p })); setDirty(true); setErr(""); };

  async function toggleDevice() {
    setBusy(true); setErr("");
    if (deviceOn) {
      await disablePush();
      setDeviceOn(false);
      toast("Notifikasi dimatikan di perangkat ini", "info");
    } else {
      const e = await enablePush();
      setPerm(typeof Notification !== "undefined" ? Notification.permission : "default");
      if (e) setErr(e);
      else {
        setDeviceOn(true);
        if (!saved) { const se = await saveSettings({ ...s, tz: deviceTz() }); if (!se) { setSaved(true); setDirty(false); } }
        toast("Notifikasi aktif di perangkat ini", "ok");
      }
    }
    setBusy(false);
  }

  async function save() {
    setBusy(true); setErr("");
    const e = await saveSettings({ ...s, tz: deviceTz() });
    setBusy(false);
    if (e) return setErr(missing ? "Database belum disiapkan. Jalankan SQL Tahap 24 dulu." : e);
    setSaved(true); setDirty(false);
    toast("Jadwal pengingat tersimpan", "ok");
  }

  async function test() {
    setBusy(true); setErr("");
    const e = await sendTest();
    setBusy(false);
    if (e) setErr(e); else toast("Notifikasi uji dikirim. Cek perangkat Anda.", "ok");
  }

  const rows: { key: "daily" | "weekly" | "monthly"; icon: string; title: string; desc: string }[] = [
    { key: "daily", icon: "📝", title: "Pengingat harian", desc: "Ingatkan mencatat transaksi hari ini." },
    { key: "weekly", icon: "📊", title: "Evaluasi mingguan", desc: "Ringkasan pemasukan dan pengeluaran 7 hari terakhir." },
    { key: "monthly", icon: "🗓️", title: "Laporan bulanan", desc: "Ringkasan lengkap bulan sebelumnya." },
  ];

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/25 text-lg">🔔</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Notifikasi &amp; pengingat</p>
          <p className="text-sm text-charcoal/60">{support.ok ? (deviceOn ? "Aktif di perangkat ini" : "Belum aktif di perangkat ini") : "Tidak tersedia"}</p>
        </div>
        {support.ok && (
          <button onClick={toggleDevice} disabled={busy} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60 ${deviceOn ? "border border-charcoal/20 bg-white" : "bg-navy text-white"}`}>
            {deviceOn ? "Matikan" : "Aktifkan"}
          </button>
        )}
      </div>

      {!support.ok && <p className="mt-3 rounded-xl bg-gold/20 px-3 py-2 text-sm">{support.reason}</p>}
      {support.ok && perm === "denied" && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">Izin notifikasi sedang diblokir. Izinkan dulu di pengaturan browser atau HP Anda.</p>}

      {support.ok && (
        <div className="mt-4 space-y-3 border-t border-charcoal/10 pt-4">
          {rows.map((r) => {
            const on = s[`${r.key}_on` as const] as boolean;
            return (
              <div key={r.key} className="rounded-2xl bg-charcoal/5 p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl" aria-hidden>{r.icon}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{r.title}</p><p className="text-xs text-charcoal/60">{r.desc}</p></div>
                  <Switch on={on} onChange={(v) => set({ [`${r.key}_on`]: v } as Partial<Settings>)} label={r.title} />
                </div>
                {on && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 pl-9 text-sm">
                    {r.key === "weekly" && (
                      <select aria-label="Hari" className={inp} value={s.weekly_day} onChange={(e) => set({ weekly_day: Number(e.target.value) })}>
                        {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                      </select>
                    )}
                    {r.key === "monthly" && (
                      <select aria-label="Tanggal" className={inp} value={s.monthly_day} onChange={(e) => set({ monthly_day: Number(e.target.value) })}>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Tanggal {d}</option>)}
                      </select>
                    )}
                    <span className="text-charcoal/60">pukul</span>
                    <input type="time" aria-label="Jam" className={inp} value={s[`${r.key}_time` as const] as string} onChange={(e) => e.target.value && set({ [`${r.key}_time`]: e.target.value } as Partial<Settings>)} />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-charcoal/60">Waktu mengikuti zona waktu perangkat ({deviceTz()}). Pengingat dikirim dari server, jadi tetap sampai walau aplikasi tertutup.</p>

          {err && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <button onClick={test} disabled={busy || !deviceOn} className="rounded-xl border border-charcoal/15 bg-white py-3 text-sm font-medium disabled:opacity-50">Kirim uji</button>
            <button onClick={save} disabled={busy || (!dirty && saved)} className="rounded-xl bg-emerald py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Menyimpan..." : saved && !dirty ? "Jadwal tersimpan ✓" : "Simpan jadwal"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
