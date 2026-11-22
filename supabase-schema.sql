
-- REPORTIFY 2.0 DATABASE

create extension if not exists "pgcrypto";

-- Tabel laporan PKL
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text,
  school text,
  major_id text,
  major text,
  package_name text,
  plan text,
  notes text,
  status text default 'Baru',
  created_at timestamptz default now()
);

-- Tabel administrator
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id)
);

-- Aktifkan keamanan database
alter table public.orders enable row level security;
alter table public.admin_users enable row level security;

-- Pengunjung boleh mengirim laporan
create policy "Public can submit orders"
on public.orders
for insert
to anon, authenticated
with check (true);

-- Admin dapat melihat data sendiri
create policy "Admin can view own account"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

-- Admin dapat mengelola pesanan
create policy "Admin can manage orders"
on public.orders
for all
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  )
);
