-- ============================================================================
-- CEDEM · Plantillas del agente (008)
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- ============================================================================

create table if not exists public.plantillas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  descripcion   text,
  instrucciones text not null,
  activo        boolean not null default true,
  creado_por    uuid references public.coaches (id) on delete set null,
  creado_en     timestamptz not null default now()
);

create index if not exists plantillas_activo_idx on public.plantillas (activo);

alter table public.plantillas enable row level security;

drop policy if exists plantillas_leer on public.plantillas;
create policy plantillas_leer on public.plantillas for select
  using (auth.role() = 'authenticated');

drop policy if exists plantillas_admin on public.plantillas;
create policy plantillas_admin on public.plantillas for all
  using (public.es_admin()) with check (public.es_admin());
