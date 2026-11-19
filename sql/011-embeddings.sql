-- ============================================================================
-- CEDEM · Búsqueda semántica del material (011)
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- ============================================================================

create extension if not exists vector;

alter table public.material_fragmentos
  add column if not exists embedding vector(1536);

create index if not exists fragmentos_embedding_idx
  on public.material_fragmentos using hnsw (embedding vector_cosine_ops);

-- Fragmentos más parecidos al vector de una pregunta.
create or replace function public.buscar_fragmentos_vector(
  consulta_vector text,
  limite int default 10
)
returns table (
  id uuid,
  material_id uuid,
  texto text,
  titulo text,
  tipo text,
  distancia float
)
language sql
stable
as $$
  select
    f.id,
    f.material_id,
    f.texto,
    m.titulo,
    m.tipo,
    (f.embedding <=> consulta_vector::vector) as distancia
  from public.material_fragmentos f
  join public.material m on m.id = f.material_id
  where f.embedding is not null
  order by f.embedding <=> consulta_vector::vector
  limit limite;
$$;
