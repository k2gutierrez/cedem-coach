-- ============================================================================
-- CEDEM · Ligas de calendario revocables (010)
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- ============================================================================

alter table public.coaches
  add column if not exists calendario_version integer not null default 0;
