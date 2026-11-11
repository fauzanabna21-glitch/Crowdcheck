-- =====================================================================
-- CrowdChek — skema database Supabase
-- Cara pakai: Supabase Dashboard → SQL Editor → New query → tempel
-- seluruh isi file ini → Run. Aman dijalankan ulang.
-- =====================================================================

-- ---------- TABEL ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null,
  role       text not null default 'user' check (role in ('user', 'admin')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id         text primary key default gen_random_uuid()::text,
  name       text not null check (char_length(name) between 3 and 120),
  category   text not null check (category in ('mall', 'transport', 'pasar', 'wisata', 'kuliner')),
  address    text not null,
  x          int  not null check (x between 0 and 100),
  y          int  not null check (y between 0 and 100),
  pattern    jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id        uuid primary key default gen_random_uuid(),
  place_id  text not null references public.places(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  user_name text not null default '',
  level     int  not null check (level between 1 and 4),
  wait_min  int  check (wait_min between 0 and 240),
  tags      text[] not null default '{}' check (cardinality(tags) <= 6),
  note      text not null default '' check (char_length(note) <= 140),
  hidden    boolean not null default false,
  ts        timestamptz not null default now()
);
create index if not exists reports_ts_idx on public.reports (ts desc);
create index if not exists reports_place_idx on public.reports (place_id, ts desc);

-- ---------- FUNGSI BANTU ----------
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin' and active);
$$;

create or replace function public.active_user_count()
returns int language sql security definer stable set search_path = public as $$
  select count(*)::int from public.profiles where active;
$$;

-- Profil dibuat otomatis saat ada yang mendaftar. Peran SELALU 'user'
-- (peran dari form pendaftaran diabaikan, jadi tidak bisa jadi admin lewat daftar).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role, active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email, 'user', true
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Laporan: isi pelapor/waktu diisi server (tidak bisa dipalsukan) + batas 1 laporan / lokasi / 10 menit
create or replace function public.reports_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  last_ts timestamptz;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null or not p.active then
    raise exception 'NOT_ALLOWED';
  end if;
  new.user_id   := p.id;
  new.user_name := p.name;
  new.hidden    := false;
  new.ts        := now();
  select max(ts) into last_ts from public.reports
   where user_id = p.id and place_id = new.place_id;
  if last_ts is not null and now() - last_ts < interval '10 minutes' then
    raise exception 'COOLDOWN:%', ceil(extract(epoch from (interval '10 minutes' - (now() - last_ts))) / 60)::int;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_before_insert on public.reports;
create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

-- ---------- KEAMANAN (Row Level Security) ----------
alter table public.profiles enable row level security;
alter table public.places   enable row level security;
alter table public.reports  enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists places_select on public.places;
drop policy if exists places_write  on public.places;
create policy places_select on public.places for select using (true);
create policy places_write  on public.places for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists reports_select on public.reports;
drop policy if exists reports_insert on public.reports;
drop policy if exists reports_update on public.reports;
drop policy if exists reports_delete on public.reports;
-- Pengunjung melihat laporan yang tampil; pelapor melihat laporannya sendiri; admin melihat semua.
create policy reports_select on public.reports for select
  using (hidden = false or user_id = auth.uid() or public.is_admin());
create policy reports_insert on public.reports for insert
  to authenticated with check (user_id = auth.uid());
create policy reports_update on public.reports for update
  using (public.is_admin()) with check (public.is_admin());
create policy reports_delete on public.reports for delete
  using (public.is_admin());

-- ---------- HAK AKSES API ----------
grant usage on schema public to anon, authenticated;
grant select on public.places  to anon, authenticated;
grant insert, update, delete on public.places to authenticated;
grant select on public.reports to anon, authenticated;
grant insert, update, delete on public.reports to authenticated;
grant select, update on public.profiles to authenticated;
grant execute on function public.active_user_count() to anon, authenticated;

-- ---------- REALTIME ----------
-- Laporan (dan pengguna, untuk admin) dikirim langsung ke browser lewat Supabase Realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports') then
      alter publication supabase_realtime add table public.reports;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
      alter publication supabase_realtime add table public.profiles;
    end if;
  end if;
end $$;

-- ---------- DATA LOKASI AWAL ----------
insert into public.places (id, name, category, address, x, y, pattern) values
  ('p1', 'Grand Indonesia', 'mall', 'Jl. M.H. Thamrin No.1, Menteng', 50, 46, '[1,4,1,1,1,5,4,12,10,12,26,39,56,64,56,45,40,48,63,76,70,60,38,21]'::jsonb),
  ('p2', 'Stasiun Sudirman', 'transport', 'Jl. Jend. Sudirman, Tanah Abang', 38, 58, '[2,1,1,4,5,23,48,81,82,48,18,8,7,9,13,27,58,77,83,58,34,18,11,6]'::jsonb),
  ('p3', 'Pasar Tanah Abang', 'pasar', 'Jl. Kebon Jati, Tanah Abang', 24, 40, '[2,1,6,18,34,67,90,100,90,62,35,23,15,14,25,38,41,34,20,14,8,7,9,8]'::jsonb),
  ('p4', 'Monas (Taman Monas)', 'wisata', 'Jl. Medan Merdeka, Gambir', 60, 24, '[1,5,1,1,7,13,21,35,43,50,43,38,28,33,38,50,61,63,54,35,24,16,8,5]'::jsonb),
  ('p5', 'Blok M Square', 'mall', 'Jl. Melawai, Kebayoran Baru', 33, 82, '[1,1,2,4,5,8,5,8,14,17,29,39,57,65,61,53,47,48,63,76,78,65,44,26]'::jsonb),
  ('p6', 'Stasiun Manggarai', 'transport', 'Jl. Manggarai Utara, Tebet', 74, 66, '[1,3,1,2,2,23,49,79,80,44,18,8,7,11,12,30,57,80,84,58,27,16,7,8]'::jsonb),
  ('p7', 'Kota Tua Jakarta', 'wisata', 'Taman Fatahillah, Pinangsia', 52, 9, '[3,3,1,1,5,13,22,30,37,48,43,30,30,29,33,48,59,57,46,37,22,11,6,9]'::jsonb),
  ('p8', 'Pasar Baru', 'pasar', 'Jl. Pasar Baru, Sawah Besar', 72, 30, '[1,1,3,12,24,60,75,86,78,60,36,22,12,14,18,28,33,33,22,15,7,7,5,4]'::jsonb),
  ('p9', 'Gelora Bung Karno', 'wisata', 'Jl. Pintu Satu Senayan', 14, 64, '[1,1,1,1,3,10,20,36,43,46,45,38,32,27,37,52,63,63,53,39,20,15,7,12]'::jsonb),
  ('p10', 'Kuningan City', 'mall', 'Jl. Prof. Dr. Satrio, Setiabudi', 62, 78, '[1,1,1,5,5,4,7,7,9,16,26,42,63,69,60,54,45,53,71,81,85,70,45,24]'::jsonb),
  ('p11', 'Kawasan Kuliner Sabang', 'kuliner', 'Jl. H. Agus Salim, Menteng', 58, 38, '[1,1,1,4,1,8,12,7,6,9,15,54,91,93,49,22,17,45,73,90,73,42,23,13]'::jsonb),
  ('p12', 'Taman Menteng', 'wisata', 'Jl. HOS Cokroaminoto, Menteng', 82, 50, '[6,6,1,2,8,15,22,39,46,54,46,42,32,33,47,55,68,74,57,43,27,14,11,10]'::jsonb)
on conflict (id) do nothing;

-- =====================================================================
-- MEMBUAT ADMIN (jalankan SETELAH akun admin mendaftar lewat halaman
-- Daftar, atau dibuat di Authentication → Users). Ganti emailnya:
--
--   update public.profiles set role = 'admin' where email = 'EMAIL_ADMIN_KAMU';
--
-- =====================================================================
