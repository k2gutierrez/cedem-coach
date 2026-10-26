-- ============================================================================
-- CEDEM · Centro de conocimiento y tareas (002)
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Material que sube el admin para que el agente lo use
-- ---------------------------------------------------------------------------
create table if not exists public.material (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  tipo         text not null default 'documento'
               check (tipo in ('clase', 'metodologia', 'caso', 'documento', 'transcripcion')),
  asignatura   text,
  generacion   text,
  autor        text,
  vigencia     date,
  texto        text not null,
  caracteres   integer,
  archivo_path text,
  creado_por   uuid references public.coaches (id) on delete set null,
  creado_en    timestamptz not null default now()
);

create index if not exists material_tipo_idx on public.material (tipo);
create index if not exists material_busqueda_idx
  on public.material using gin (to_tsvector('spanish', texto));

-- ---------------------------------------------------------------------------
-- Fragmentos: el material troceado para recuperar solo lo relevante
-- ---------------------------------------------------------------------------
create table if not exists public.material_fragmentos (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.material (id) on delete cascade,
  orden       integer not null default 0,
  texto       text not null,
  tsv         tsvector generated always as (to_tsvector('spanish', texto)) stored
);

create index if not exists fragmentos_tsv_idx on public.material_fragmentos using gin (tsv);
create index if not exists fragmentos_material_idx on public.material_fragmentos (material_id);

-- ---------------------------------------------------------------------------
-- Permisos: el material lo lee todo el equipo; solo el admin lo escribe
-- ---------------------------------------------------------------------------
alter table public.material enable row level security;
alter table public.material_fragmentos enable row level security;

drop policy if exists material_leer on public.material;
create policy material_leer on public.material for select
  using (auth.role() = 'authenticated');

drop policy if exists material_admin on public.material;
create policy material_admin on public.material for all
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists fragmentos_leer on public.material_fragmentos;
create policy fragmentos_leer on public.material_fragmentos for select
  using (auth.role() = 'authenticated');

drop policy if exists fragmentos_admin on public.material_fragmentos;
create policy fragmentos_admin on public.material_fragmentos for all
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------------
-- Búsqueda de fragmentos por texto (la usa el agente)
-- ---------------------------------------------------------------------------
create or replace function public.buscar_material(consulta text, limite int default 8)
returns table (material_id uuid, titulo text, tipo text, fragmento text, rank real)
language sql stable as $$
  select m.id, m.titulo, m.tipo, f.texto,
         ts_rank(f.tsv, plainto_tsquery('spanish', consulta)) as rank
  from public.material_fragmentos f
  join public.material m on m.id = f.material_id
  where f.tsv @@ plainto_tsquery('spanish', consulta)
  order by rank desc
  limit limite;
$$;
