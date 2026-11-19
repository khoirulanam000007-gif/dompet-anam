import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config";
import { offlineFetch } from "./offline";
import { isDemo, getDemoClient } from "./demo";

// Nilai cadangan hanya agar aplikasi tidak error sebelum kunci diisi (layar panduan akan tampil).
const real = createClient(SUPABASE_URL || "https://belum-diisi.supabase.co", SUPABASE_KEY || "belum-diisi", { global: { fetch: offlineFetch } });

// Seluruh aplikasi memakai `supabase` ini. Di Mode Demo, semua panggilan dialihkan ke database tiruan di memori.
export const supabase = new Proxy(real, {
  get(target, prop) {
    const t = (isDemo() ? getDemoClient() : target) as unknown as Record<string | symbol, unknown>;
    const v = t[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
  },
}) as typeof real;
