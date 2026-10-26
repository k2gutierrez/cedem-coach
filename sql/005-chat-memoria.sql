-- ============================================================================
-- CEDEM Coach · memoria del chat y minutas ajustadas (005)
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- ============================================================================

-- Conversaciones con el agente. alumno_id nulo = chat general del coach.
create table if not exists public.chat_mensajes (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.coaches (id) on delete cascade,
  alumno_id  uuid references public.alumnos (id) on delete cascade,
  rol        text not null check (rol in ('user', 'assistant')),
  texto      text not null,
  creado_en  timestamptz not null default now()
);

create index if not exists chat_coach_idx on public.chat_mensajes (coach_id, creado_en desc);
create index if not exists chat_alumno_idx on public.chat_mensajes (alumno_id, creado_en desc);

alter table public.chat_mensajes enable row level security;

drop policy if exists chat_propio on public.chat_mensajes;
create policy chat_propio on public.chat_mensajes for all
  using (coach_id = auth.uid() or public.es_admin())
  with check (coach_id = auth.uid() or public.es_admin());

-- Versión de la minuta corregida desde el chat (si existe, manda sobre la generada).
alter table public.sesiones add column if not exists minuta_ajustada jsonb;
