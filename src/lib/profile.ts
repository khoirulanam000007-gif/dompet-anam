import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

// Data profil (nama + foto) dipakai bersama oleh Beranda dan Pengaturan supaya selalu konsisten.
type P = { name: string; avatar: string | null; loaded: boolean };
let state: P = { name: "", avatar: null, loaded: false };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const useProfile = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);

// Cadangan di perangkat: dipakai bila kolom foto di database belum diaktifkan, supaya foto tetap bisa disimpan.
const localKey = (id: string) => `dompet_avatar_local_${id}`;
const getLocal = (id: string) => { try { return localStorage.getItem(localKey(id)); } catch { return null; } };
const setLocal = (id: string, v: string | null) => {
  try { if (v) localStorage.setItem(localKey(id), v); else localStorage.removeItem(localKey(id)); return true; } catch { return false; }
};

type DbErr = { code?: string; message?: string } | null;
const columnMissing = (e: DbErr) => !!e && (e.code === "PGRST204" || e.code === "42703" || /avatar/i.test(e.message ?? ""));

export async function loadProfile() {
  state = { name: "", avatar: null, loaded: false };
  emit();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const first = await supabase.from("profiles").select("full_name,avatar").eq("id", u.user.id).single();
  let r = first;
  if (first.error) r = (await supabase.from("profiles").select("full_name").eq("id", u.user.id).single()) as typeof r;
  const d = r.data as { full_name?: string; avatar?: string | null } | null;
  let avatar = d?.avatar ?? null;
  // Foto yang tersimpan di perangkat: bila database sudah siap, pindahkan otomatis ke akun.
  if (!avatar) {
    const local = getLocal(u.user.id);
    if (local) {
      avatar = local;
      if (!first.error) {
        const up = await supabase.from("profiles").update({ avatar: local }).eq("id", u.user.id);
        if (!up.error) setLocal(u.user.id, null);
      }
    }
  }
  state = { name: d?.full_name ?? "", avatar, loaded: true };
  emit();
}

export function setProfileName(name: string) {
  state = { ...state, name };
  emit();
}

// Menyimpan foto (data URL kecil hasil kompresi). null = hapus foto.
// Hasil: "cloud" = tersimpan di akun, "local" = tersimpan di perangkat ini saja (kolom database belum aktif), "error" = gagal.
export type AvatarResult = { status: "cloud" | "local" | "error"; message?: string };

export async function saveAvatar(dataUrl: string | null): Promise<AvatarResult> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { status: "error", message: "Sesi masuk tidak ditemukan. Keluar lalu masuk lagi, kemudian coba kembali." };
  const id = u.user.id;
  let error: DbErr = null;
  try {
    ({ error } = await supabase.from("profiles").update({ avatar: dataUrl }).eq("id", id));
  } catch {
    return { status: "error", message: "Foto gagal disimpan. Periksa internet Anda lalu coba lagi." };
  }
  if (!error) {
    setLocal(id, null);
    state = { ...state, avatar: dataUrl };
    emit();
    return { status: "cloud" };
  }
  if (error.code === "23514") return { status: "error", message: "Foto terlalu besar. Pilih foto lain atau perkecil." };
  if (columnMissing(error)) {
    // Fitur foto di database belum diaktifkan: simpan di perangkat ini agar tetap bisa dipakai.
    if (!setLocal(id, dataUrl)) return { status: "error", message: "Penyimpanan di perangkat penuh. Kosongkan ruang peramban lalu coba lagi." };
    state = { ...state, avatar: dataUrl };
    emit();
    return { status: "local" };
  }
  return { status: "error", message: "Foto gagal disimpan. Periksa internet Anda lalu coba lagi." };
}
