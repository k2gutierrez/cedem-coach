-- ============================================================================
-- CEDEM Coach · brief de contexto y presentación ajustada (006)
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'alumnos'
  ) then
    raise exception 'Este proyecto no tiene la tabla public.alumnos. Revisa que el SQL Editor esté en el proyecto de CEDEM.';
  end if;
end $$;

-- Brief de contexto (deep research) por alumno.
alter table public.alumnos add column if not exists brief text;
alter table public.alumnos add column if not exists brief_fuentes jsonb;
alter table public.alumnos add column if not exists brief_actualizado timestamptz;

-- Versión ajustada de la presentación de junta técnica, por coach.
alter table public.coaches add column if not exists presentacion_ajustada jsonb;
