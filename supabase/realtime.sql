-- =====================================================================
-- CrowdChek — aktifkan Realtime (jalankan SEKALI di SQL Editor)
-- Untuk database yang sudah dibuat dari schema.sql versi lama.
-- Aman dijalankan ulang. Keamanan tetap dijaga RLS: pengunjung hanya
-- menerima laporan yang tampil, admin menerima semuanya.
-- =====================================================================
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
