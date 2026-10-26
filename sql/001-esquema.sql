-- ============================================================================
-- CEDEM · Plataforma de coaches — esquema mínimo para el MVP
-- Pegar completo en Supabase → SQL Editor → Run.
-- Es idempotente: se puede volver a correr sin romper nada.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0 · Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 1 · Personas
-- ---------------------------------------------------------------------------
create table if not exists public.coaches (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null,
  email       text not null unique,
  rol         text not null default 'coach' check (rol in ('coach', 'admin')),
  zoom_url    text,                       -- liga fija del coach
  telefono    text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table if not exists public.alumnos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  empresa      text,
  giro         text,
  ciudad       text,
  generacion   text,
  cargo        text,
  verbo        text,
  etapa        text,
  reto         text,
  coach_id     uuid not null references public.coaches (id) on delete restrict,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists alumnos_coach_idx on public.alumnos (coach_id);

drop trigger if exists alumnos_tocar on public.alumnos;
create trigger alumnos_tocar before update on public.alumnos
  for each row execute function public.tocar_actualizado();

-- ---------------------------------------------------------------------------
-- 2 · Sesiones y archivos
-- ---------------------------------------------------------------------------
create table if not exists public.sesiones (
  id             uuid primary key default gen_random_uuid(),
  alumno_id      uuid references public.alumnos (id) on delete cascade,
  coach_id       uuid not null references public.coaches (id) on delete restrict,
  tipo           text not null default 'individual'
                 check (tipo in ('individual', 'consejo', 'junta', 'otro')),
  titulo         text,
  fecha          date not null,
  hora           time,
  duracion_min   integer not null default 60,
  estado         text not null default 'agendada'
                 check (estado in ('agendada', 'realizada', 'cancelada')),
  zoom_url       text,                    -- copiada del coach al agendar
  transcripcion  text,                    -- texto ya extraído y limpio
  resumen_ejecutivo text,
  nota_coach     text,
  entrada_tipo   text,                    -- pdf | docx | vtt | txt | audio | imagen
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists sesiones_coach_fecha_idx on public.sesiones (coach_id, fecha desc);
create index if not exists sesiones_alumno_idx on public.sesiones (alumno_id, fecha desc);

drop trigger if exists sesiones_tocar on public.sesiones;
create trigger sesiones_tocar before update on public.sesiones
  for each row execute function public.tocar_actualizado();

create table if not exists public.archivos (
  id            uuid primary key default gen_random_uuid(),
  sesion_id     uuid not null references public.sesiones (id) on delete cascade,
  nombre        text not null,
  mime          text,
  bytes         bigint,
  storage_path  text,                     -- bucket privado: sesiones/<sesion>/<archivo>
  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'extraido', 'error', 'borrado')),
  detalle_error text,
  caracteres    integer,
  creado_en     timestamptz not null default now()
);
create index if not exists archivos_sesion_idx on public.archivos (sesion_id);

-- ---------------------------------------------------------------------------
-- 3 · Lo que el agente extrae de la conversación
-- ---------------------------------------------------------------------------
create table if not exists public.hallazgos (
  id          uuid primary key default gen_random_uuid(),
  sesion_id   uuid not null references public.sesiones (id) on delete cascade,
  titulo      text not null,
  detalle     text,
  cita        text,                       -- fragmento textual que lo sustenta
  creado_en   timestamptz not null default now()
);
create index if not exists hallazgos_sesion_idx on public.hallazgos (sesion_id);

create table if not exists public.compromisos (
  id           uuid primary key default gen_random_uuid(),
  sesion_id    uuid not null references public.sesiones (id) on delete cascade,
  alumno_id    uuid references public.alumnos (id) on delete cascade,
  texto        text not null,
  responsable  text,
  fecha        date,
  estado       text not null default 'abierto'
               check (estado in ('abierto', 'cumplido', 'vencido', 'cancelado')),
  creado_en    timestamptz not null default now()
);
create index if not exists compromisos_alumno_idx on public.compromisos (alumno_id, estado);

-- Tareas de aplicación: las define el admin cada mes.
create table if not exists public.tareas (
  id          uuid primary key default gen_random_uuid(),
  asignatura  text,
  mes         date,                       -- primer día del mes al que pertenece
  titulo      text not null,
  descripcion text,
  creado_en   timestamptz not null default now()
);

-- Cobertura: ¿se abordó esa tarea en esta sesión?
create table if not exists public.tarea_sesion (
  id          uuid primary key default gen_random_uuid(),
  tarea_id    uuid not null references public.tareas (id) on delete cascade,
  sesion_id   uuid not null references public.sesiones (id) on delete cascade,
  abordada    boolean not null default false,
  evidencia   text,                       -- cita de la transcripción
  confianza   text check (confianza in ('alta', 'media', 'baja')),
  corregido_por uuid references public.coaches (id),
  creado_en   timestamptz not null default now(),
  unique (tarea_id, sesion_id)
);
create index if not exists tarea_sesion_sesion_idx on public.tarea_sesion (sesion_id);

-- ---------------------------------------------------------------------------
-- 4 · Documentos y correcciones del coach
-- ---------------------------------------------------------------------------
create table if not exists public.documentos (
  id          uuid primary key default gen_random_uuid(),
  sesion_id   uuid references public.sesiones (id) on delete cascade,
  coach_id    uuid references public.coaches (id) on delete set null,
  tipo        text not null check (tipo in ('minuta', 'ficha', 'presentacion', 'agenda')),
  formato     text not null check (formato in ('pdf', 'docx', 'pptx')),
  nombre      text not null,
  storage_path text,
  creado_en   timestamptz not null default now()
);

-- "Registra que sí se revisó": el coach corrige al agente, queda con autor.
create table if not exists public.correcciones (
  id         uuid primary key default gen_random_uuid(),
  sesion_id  uuid not null references public.sesiones (id) on delete cascade,
  coach_id   uuid not null references public.coaches (id),
  campo      text not null,               -- hallazgos | compromisos | tarea_sesion | resumen
  antes      text,
  despues    text,
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5 · Permisos por fila (RLS)
-- Cada coach ve lo suyo; el admin ve todo.
-- ---------------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches c where c.id = auth.uid() and c.rol = 'admin');
$$;

alter table public.coaches      enable row level security;
alter table public.alumnos      enable row level security;
alter table public.sesiones     enable row level security;
alter table public.archivos     enable row level security;
alter table public.hallazgos    enable row level security;
alter table public.compromisos  enable row level security;
alter table public.tareas       enable row level security;
alter table public.tarea_sesion enable row level security;
alter table public.documentos   enable row level security;
alter table public.correcciones enable row level security;

drop policy if exists coaches_ver on public.coaches;
create policy coaches_ver on public.coaches for select
  using (id = auth.uid() or public.es_admin());

drop policy if exists alumnos_ver on public.alumnos;
create policy alumnos_ver on public.alumnos for select
  using (coach_id = auth.uid() or public.es_admin());
drop policy if exists alumnos_escribir on public.alumnos;
create policy alumnos_escribir on public.alumnos for all
  using (coach_id = auth.uid() or public.es_admin())
  with check (coach_id = auth.uid() or public.es_admin());

drop policy if exists sesiones_ver on public.sesiones;
create policy sesiones_ver on public.sesiones for select
  using (coach_id = auth.uid() or public.es_admin());
drop policy if exists sesiones_escribir on public.sesiones;
create policy sesiones_escribir on public.sesiones for all
  using (coach_id = auth.uid() or public.es_admin())
  with check (coach_id = auth.uid() or public.es_admin());

drop policy if exists archivos_ver on public.archivos;
create policy archivos_ver on public.archivos for select using (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
);
drop policy if exists archivos_escribir on public.archivos;
create policy archivos_escribir on public.archivos for all using (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
) with check (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
);

-- Hallazgos y compromisos heredan el permiso de su sesión.
drop policy if exists hallazgos_ver on public.hallazgos;
create policy hallazgos_ver on public.hallazgos for all using (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
) with check (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
);

drop policy if exists compromisos_ver on public.compromisos;
create policy compromisos_ver on public.compromisos for all using (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
) with check (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
);

-- La biblioteca de tareas la administra el admin; los coaches solo la leen.
drop policy if exists tareas_leer on public.tareas;
create policy tareas_leer on public.tareas for select using (true);
drop policy if exists tareas_admin on public.tareas;
create policy tareas_admin on public.tareas for all using (public.es_admin())
  with check (public.es_admin());

drop policy if exists tarea_sesion_ver on public.tarea_sesion;
create policy tarea_sesion_ver on public.tarea_sesion for all using (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
) with check (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
);

drop policy if exists documentos_ver on public.documentos;
create policy documentos_ver on public.documentos for all using (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
) with check (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (s.coach_id = auth.uid() or public.es_admin()))
);

drop policy if exists correcciones_ver on public.correcciones;
create policy correcciones_ver on public.correcciones for all using (
  coach_id = auth.uid() or public.es_admin()
) with check (
  coach_id = auth.uid() or public.es_admin()
);

-- ---------------------------------------------------------------------------
-- 6 · Almacenamiento de archivos originales (bucket privado)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('sesiones', 'sesiones', false)
on conflict (id) do nothing;

drop policy if exists sesiones_storage_leer on storage.objects;
create policy sesiones_storage_leer on storage.objects for select
  using (bucket_id = 'sesiones' and auth.role() = 'authenticated');

drop policy if exists sesiones_storage_escribir on storage.objects;
create policy sesiones_storage_escribir on storage.objects for insert
  with check (bucket_id = 'sesiones' and auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 7 · Primer usuario administrador
-- Después de crear la cuenta en Authentication → Users, corre esto una vez
-- cambiando el correo:
--
--   insert into public.coaches (id, nombre, email, rol)
--   select id, 'Carlos Gutiérrez', email, 'admin'
--   from auth.users where email = 'carlos@cedem.com.mx'
--   on conflict (id) do update set rol = 'admin';
-- ---------------------------------------------------------------------------
