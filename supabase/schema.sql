-- =====================================================================
-- DOMPET PRO — skema database (Supabase / PostgreSQL)
-- Cara pakai: Supabase > SQL Editor > New query > tempel SEMUA isi file ini > Run.
-- Aman dijalankan pada proyek Supabase yang masih baru/kosong.
-- =====================================================================

-- ---------- TABEL ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar text,                                               -- foto profil (data URL kecil hasil kompresi di aplikasi)
  created_at timestamptz not null default now(),
  constraint avatar_size check (avatar is null or length(avatar) <= 250000)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'bank' check (type in ('cash','bank','ewallet','other')),
  initial_balance numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric not null check (target_amount > 0),
  target_date date,
  created_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('borrowed','lent')),   -- borrowed = utang saya, lent = piutang
  person_name text not null,
  amount numeric not null check (amount > 0),
  due_date date,
  note text,
  created_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  month date not null,                                       -- selalu tanggal 1 tiap bulan
  limit_amount numeric not null check (limit_amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  amount numeric not null check (amount > 0),
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  frequency text not null default 'monthly' check (frequency in ('daily','weekly','monthly')),
  next_run_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','transfer','saving_deposit','saving_withdraw',
                                     'debt_borrow','debt_repay','loan_give','loan_receive')),
  amount numeric not null check (amount > 0),
  account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  goal_id uuid references public.savings_goals(id) on delete restrict,
  debt_id uuid references public.debts(id) on delete restrict,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  occurrence_date date,
  occurred_at timestamptz not null default now(),
  source text,
  note text,
  created_at timestamptz not null default now(),
  unique (recurring_rule_id, occurrence_date)               -- mencegah transaksi berulang ganda
);

create index on public.transactions (user_id, occurred_at desc);
create index on public.transactions (account_id);
create index on public.transactions (goal_id) where goal_id is not null;
create index on public.transactions (debt_id) where debt_id is not null;

-- ---------- VIEW (saldo & progres dihitung otomatis) ----------
-- security_invoker = true  → aturan keamanan (RLS) tetap berlaku, tiap pengguna hanya melihat datanya sendiri.
create view public.account_balances with (security_invoker = true) as
select a.id, a.user_id, a.name, a.type, a.initial_balance, a.created_at,
  a.initial_balance + coalesce((
    select sum(case
      when t.account_id = a.id and t.type in ('income','debt_borrow','loan_receive','saving_withdraw') then t.amount
      when t.account_id = a.id and t.type in ('expense','debt_repay','loan_give','saving_deposit','transfer') then -t.amount
      when t.to_account_id = a.id and t.type = 'transfer' then t.amount
      else 0 end)
    from public.transactions t
    where t.account_id = a.id or t.to_account_id = a.id
  ), 0) as balance
from public.accounts a;

create view public.goal_progress with (security_invoker = true) as
select g.id, g.user_id, g.name, g.target_amount, g.target_date, g.created_at,
  coalesce((select sum(case t.type when 'saving_deposit' then t.amount when 'saving_withdraw' then -t.amount else 0 end)
            from public.transactions t where t.goal_id = g.id), 0) as saved_amount
from public.savings_goals g;

create view public.debt_status with (security_invoker = true) as
select d.id, d.user_id, d.kind, d.person_name, d.amount, d.due_date, d.note, d.created_at,
  p.paid as paid_amount,
  greatest(d.amount - p.paid, 0) as remaining_amount,
  (d.amount - p.paid) <= 0 as is_paid
from public.debts d
cross join lateral (
  select coalesce(sum(t.amount), 0) as paid
  from public.transactions t
  where t.debt_id = d.id and t.type in ('debt_repay','loan_receive')
) p;

-- ---------- KEAMANAN (RLS): setiap pengguna hanya bisa mengakses datanya sendiri ----------
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.accounts        enable row level security;
alter table public.savings_goals   enable row level security;
alter table public.debts           enable row level security;
alter table public.budgets         enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.transactions    enable row level security;

create policy "milik sendiri" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array['categories','accounts','savings_goals','debts','budgets','recurring_rules','transactions']
  loop
    execute format(
      'create policy "milik sendiri" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ---------- PENGGUNA BARU: profil + kategori bawaan dibuat otomatis ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));

  insert into public.categories (user_id, name, kind)
  select new.id, c.name, c.kind from (values
    ('Makanan','expense'), ('Minuman','expense'), ('Transportasi','expense'), ('Belanja','expense'),
    ('Pendidikan','expense'), ('Kesehatan','expense'), ('Hiburan','expense'), ('Tagihan','expense'),
    ('Kebutuhan Pribadi','expense'), ('Lainnya','expense'),
    ('Gaji','income'), ('Uang Saku','income'), ('Freelance','income'), ('Bisnis','income'),
    ('Hadiah','income'), ('Bonus','income'), ('Lainnya','income')
  ) as c(name, kind);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- HAK AKSES API ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
