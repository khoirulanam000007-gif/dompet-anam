import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { toast } from "./ui";

// Data profil (nama + foto) dipakai bersama oleh Beranda dan Pengaturan supaya selalu konsisten.
type P = { name: string; avatar: string | null; loaded: boolean; onboarded: boolean };
let state: P = { name: "", avatar: null, loaded: false, onboarded: true };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const useProfile = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);

export async function loadProfile() {
  state = { name: "", avatar: null, loaded: false, onboarded: true };
  emit();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  // onboarded_at hanya ada setelah SQL Tahap 24 dijalankan; tanpa itu panduan awal tidak ditampilkan.
  let r = await supabase.from("profiles").select("full_name,avatar,onboarded_at").eq("id", u.user.id).single();
  const hasCol = !r.error;
  if (r.error) r = (await supabase.from("profiles").select("full_name,avatar").eq("id", u.user.id).single()) as typeof r;
  if (r.error) r = (await supabase.from("profiles").select("full_name").eq("id", u.user.id).single()) as typeof r;
  const d = r.data as { full_name?: string; avatar?: string | null; onboarded_at?: string | null } | null;
  state = { name: d?.full_name ?? "", avatar: d?.avatar ?? null, loaded: true, onboarded: hasCol ? !!d?.onboarded_at : true };
  emit();
}

export function setProfileName(name: string) {
  state = { ...state, name };
  emit();
}

// Menyimpan foto (data URL kecil hasil kompresi) ke tabel profiles milik akun yang sedang masuk. null = hapus foto.
export async function saveAvatar(dataUrl: string | null): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { error } = await supabase.from("profiles").update({ avatar: dataUrl }).eq("id", u.user.id);
  if (error) {
    if (error.code === "23514") toast("Foto terlalu besar. Pilih foto lain atau perkecil.", "error");
    else if (/avatar/i.test(error.message)) toast("Fitur foto belum diaktifkan di database. Jalankan SQL foto profil dulu.", "error");
    else toast("Foto gagal disimpan. Periksa internet Anda lalu coba lagi.", "error");
    return false;
  }
  state = { ...state, avatar: dataUrl };
  emit();
  return true;
}

// Menandai panduan awal selesai (sekali seumur akun). Boleh sambil menyimpan nama.
export async function markOnboarded(name?: string): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const patch: Record<string, unknown> = { onboarded_at: new Date().toISOString() };
  if (name && name.trim()) patch.full_name = name.trim();
  const { error } = await supabase.from("profiles").update(patch).eq("id", u.user.id);
  if (error) return false;
  state = { ...state, name: name?.trim() || state.name, onboarded: true };
  emit();
  return true;
}
