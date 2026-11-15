import { supabase } from "./supabase";
import { isDemo } from "./demo";
import { isIOS, isStandalone } from "./install";
import { VAPID_PUBLIC_KEY } from "./config";

export type Settings = {
  tz: string;
  daily_on: boolean; daily_time: string;
  weekly_on: boolean; weekly_day: number; weekly_time: string;
  monthly_on: boolean; monthly_day: number; monthly_time: string;
};

export const DEFAULTS: Settings = {
  tz: "Asia/Jakarta",
  daily_on: true, daily_time: "20:00",
  weekly_on: true, weekly_day: 0, weekly_time: "19:00",
  monthly_on: true, monthly_day: 1, monthly_time: "08:00",
};

export const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULTS.tz; } catch { return DEFAULTS.tz; } };

export type Support = { ok: true } | { ok: false; reason: string };
export function pushSupport(): Support {
  if (isDemo()) return { ok: false, reason: "Notifikasi tidak tersedia di mode demo." };
  if (isIOS() && !isStandalone()) return { ok: false, reason: "Di iPhone/iPad, pasang dulu aplikasi ke Layar Utama (Bagikan > Tambah ke Layar Utama), lalu buka dari ikon itu." };
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return { ok: false, reason: "Browser ini belum mendukung notifikasi push. Coba Chrome, Edge, atau Safari terbaru." };
  return { ok: true };
}

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const b64u = (buf: ArrayBuffer | null) => {
  if (!buf) return "";
  let s = "";
  new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupport().ok) return null;
  try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch { return null; }
}

// Minta izin, daftarkan perangkat ini, simpan ke database. Mengembalikan pesan kesalahan atau null bila sukses.
export async function enablePush(): Promise<string | null> {
  const sup = pushSupport();
  if (!sup.ok) return sup.reason;
  const perm = await Notification.requestPermission();
  if (perm === "denied") return "Izin notifikasi diblokir. Buka pengaturan browser/HP, izinkan notifikasi untuk situs ini, lalu coba lagi.";
  if (perm !== "granted") return "Izin notifikasi belum diberikan.";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) as BufferSource }));
    const { error } = await supabase.from("push_subscriptions").upsert(
      { endpoint: sub.endpoint, p256dh: b64u(sub.getKey("p256dh")), auth: b64u(sub.getKey("auth")), user_agent: navigator.userAgent.slice(0, 200) },
      { onConflict: "endpoint" },
    );
    if (error) return /push_subscriptions/i.test(error.message) || error.code === "42P01" || error.code === "PGRST205" ? "Database belum disiapkan. Jalankan SQL Tahap 24 dulu." : "Perangkat gagal didaftarkan. Coba lagi.";
    return null;
  } catch {
    return "Gagal mengaktifkan notifikasi di perangkat ini. Coba lagi.";
  }
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}

export async function loadSettings(): Promise<{ settings: Settings; saved: boolean; missingTable: boolean }> {
  const { data, error } = await supabase.from("notification_settings").select("tz,daily_on,daily_time,weekly_on,weekly_day,weekly_time,monthly_on,monthly_day,monthly_time").maybeSingle();
  if (error) return { settings: { ...DEFAULTS, tz: deviceTz() }, saved: false, missingTable: true };
  if (!data) return { settings: { ...DEFAULTS, tz: deviceTz() }, saved: false, missingTable: false };
  return { settings: data as Settings, saved: true, missingTable: false };
}

export async function saveSettings(s: Settings): Promise<string | null> {
  const { error } = await supabase.from("notification_settings").upsert({ ...s, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return error ? "Jadwal gagal disimpan. Coba lagi." : null;
}

// Kirim notifikasi uji ke semua perangkat milik akun ini (lewat fungsi server).
export async function sendTest(): Promise<string | null> {
  const fn = (supabase as unknown as { functions?: { invoke: (n: string, o: object) => Promise<{ data: { sent?: number; error?: string } | null; error: unknown }> } }).functions;
  if (!fn) return "Fitur uji tidak tersedia.";
  const { data, error } = await fn.invoke("send-reminders", { body: { test: true } });
  if (error) return "Fungsi server belum aktif. Ikuti langkah pemasangan di panduan Tahap 24.";
  if (!data?.sent) return data?.error ?? "Belum ada perangkat yang terdaftar.";
  return null;
}
