-- ============================================================================
-- CEDEM · Búsqueda del material (003)
-- Corrige `buscar_material`: antes exigía TODAS las palabras de la pregunta
-- (plainto_tsquery usa AND), así que una pregunta normal nunca encontraba nada.
-- Ahora busca con CUALQUIERA de las palabras y ordena por relevancia.
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- ============================================================================

create or replace function public.buscar_material(consulta text, limite int default 8)
returns table (material_id uuid, titulo text, tipo text, fragmento text, rank real)
language sql stable as $$
  with terminos as (
    select to_tsquery(
             'spanish',
             string_agg(lexema, ' | ')
           ) as tsq
    from (
      select distinct lexema
      from unnest(tsvector_to_array(to_tsvector('spanish', coalesce(consulta, '')))) as lexema
      where length(lexema) > 2
    ) t
  )
  select m.id, m.titulo, m.tipo, f.texto,
         ts_rank_cd(f.tsv, (select tsq from terminos)) as rank
  from public.material_fragmentos f
  join public.material m on m.id = f.material_id
  where (select tsq from terminos) is not null
    and f.tsv @@ (select tsq from terminos)
  order by rank desc
  limit limite;
$$;

grant execute on function public.buscar_material(text, int) to authenticated, service_role;
