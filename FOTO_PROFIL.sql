-- DOMPET ANAM: mengaktifkan foto profil (jalankan sekali di Supabase > SQL Editor)
alter table public.profiles add column if not exists avatar text;

alter table public.profiles drop constraint if exists avatar_size;
alter table public.profiles add constraint avatar_size
  check (avatar is null or length(avatar) <= 250000);
