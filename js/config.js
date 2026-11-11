/* Konfigurasi Supabase.
   Isi dengan nilai dari Supabase → Project Settings → API:
   - SUPABASE_URL      : "Project URL"
   - SUPABASE_ANON_KEY : "anon public" (atau "publishable") key
   Kunci ini memang publik; keamanan data dijaga oleh aturan RLS di supabase/schema.sql.
   JANGAN pernah memasukkan "service_role" key di sini. */
window.CC_CONFIG = {
  SUPABASE_URL: 'ISI_DENGAN_PROJECT_URL',
  SUPABASE_ANON_KEY: 'ISI_DENGAN_ANON_KEY'
};
