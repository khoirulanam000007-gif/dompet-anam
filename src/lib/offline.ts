import { useSyncExternalStore } from "react";

// Saat internet putus, data terakhir yang pernah dimuat tetap bisa dibaca.
// Hanya permintaan BACA (GET) ke database/akun yang disimpan; perubahan tetap butuh internet.
const DATA = "dompet-data-v1";

export async function offlineFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (method !== "GET" || !/\/(rest|auth)\/v1\//.test(url)) return fetch(input, init);
  try {
    const res = await fetch(input, init);
    if (res.ok) caches.open(DATA).then((c) => c.put(url, res.clone())).catch(() => {});
    return res;
  } catch (e) {
    try {
      const hit = await (await caches.open(DATA)).match(url, { ignoreVary: true });
      if (hit) return hit;
    } catch { /* abaikan */ }
    throw e;
  }
}

// Dipanggil saat keluar akun agar data tidak tertinggal di perangkat bersama.
export async function clearOfflineCache() {
  try { await caches.delete(DATA); } catch { /* abaikan */ }
}

export const useOnline = () =>
  useSyncExternalStore(
    (cb) => { window.addEventListener("online", cb); window.addEventListener("offline", cb); return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); }; },
    () => navigator.onLine,
    () => true,
  );
