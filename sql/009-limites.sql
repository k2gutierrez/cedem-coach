-- ============================================================================
-- CEDEM · Límites de uso (009)
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- ============================================================================

create table if not exists public.limites (
  clave       text primary key,
  conteo      integer not null default 0,
  reinicia_en timestamptz not null
);

create index if not exists limites_reinicia_idx on public.limites (reinicia_en);

alter table public.limites enable row level security;
revoke all on public.limites from anon, authenticated;
