-- ============================================================================
-- CEDEM · Caché de los tableros de monday (007)
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- ============================================================================

create table if not exists public.monday_cache (
  tablero_id     text primary key,
  datos          jsonb not null,
  actualizado_en timestamptz not null default now()
);

-- Solo el servidor la usa (service_role); no se expone a los coaches.
alter table public.monday_cache enable row level security;
revoke all on public.monday_cache from anon, authenticated;
