import { db } from "./supabase";
import type { Usuario } from "./sesion";

export type Alumno = {
  id: string;
  nombre: string;
  empresa: string | null;
  giro: string | null;
  ciudad: string | null;
  generacion: string | null;
  cargo: string | null;
  reto: string | null;
  etapa: string | null;
  coach_id: string;
  activo: boolean;
  creado_en: string;
};

export type Sesion = {
  id: string;
  alumno_id: string | null;
  fecha: string;
  tipo: string;
  estado: string;
  resumen_ejecutivo: string | null;
  nota_coach: string | null;
  entrada_tipo: string | null;
  creado_en: string;
};

export type Tarea = { id: string; titulo: string; asignatura: string | null; mes: string | null };

const CAMPOS_ALUMNO =
  "id, nombre, empresa, giro, ciudad, generacion, cargo, reto, etapa, coach_id, activo, creado_en";

/** Filtro por rol: el coach solo ve lo suyo, el admin ve todo. */

export async function alumnosDe(u: Usuario, incluirBajas = false): Promise<Alumno[]> {
  const base = db
    .from("alumnos")
    .select(CAMPOS_ALUMNO)
    .order("creado_en", { ascending: false });
  const filtrada = incluirBajas ? base : base.eq("activo", true);
  const { data } = await (u.rol === "admin" ? filtrada : filtrada.eq("coach_id", u.id));
  return (data as Alumno[]) ?? [];
}

export async function alumnoPorId(id: string, u: Usuario): Promise<Alumno | null> {
  const { data } = await db.from("alumnos").select(CAMPOS_ALUMNO).eq("id", id).maybeSingle();
  const alumno = (data as Alumno) ?? null;
  if (!alumno) return null;
  if (u.rol !== "admin" && alumno.coach_id !== u.id) return null;
  return alumno;
}

export async function sesionesDe(alumnoId: string): Promise<Sesion[]> {
  const { data } = await db
    .from("sesiones")
    .select("id, alumno_id, fecha, tipo, estado, resumen_ejecutivo, nota_coach, entrada_tipo, creado_en")
    .eq("alumno_id", alumnoId)
    .order("fecha", { ascending: false })
    .limit(30);
  return (data as Sesion[]) ?? [];
}

export async function ultimasSesiones(u: Usuario, limite = 6) {
  let consulta = db
    .from("sesiones")
    .select("id, fecha, resumen_ejecutivo, estado, alumno_id, alumnos(nombre)")
    .order("fecha", { ascending: false })
    .limit(limite);

  if (u.rol !== "admin") consulta = consulta.eq("coach_id", u.id);

  const { data } = await consulta;
  return (data ?? []) as unknown as {
    id: string;
    fecha: string;
    resumen_ejecutivo: string | null;
    estado: string;
    alumno_id: string | null;
    alumnos: { nombre: string } | null;
  }[];
}

export async function panelDe(u: Usuario) {
  const alumnos = await alumnosDe(u);

  let qSesiones = db.from("sesiones").select("id", { count: "exact", head: true });
  if (u.rol !== "admin") qSesiones = qSesiones.eq("coach_id", u.id);

  let qCompromisos = db
    .from("compromisos")
    .select("id", { count: "exact", head: true })
    .eq("estado", "abierto");

  if (u.rol !== "admin") {
    const ids = alumnos.map((a) => a.id);
    qCompromisos = ids.length ? qCompromisos.in("alumno_id", ids) : qCompromisos.eq("alumno_id", "00000000-0000-0000-0000-000000000000");
  }

  const [{ count: sesiones }, { count: compromisos }, proximas] = await Promise.all([
    qSesiones,
    qCompromisos,
    proximasSesiones(u, 5),
  ]);

  return {
    alumnos: alumnos.length,
    sesiones: sesiones ?? 0,
    compromisos: compromisos ?? 0,
    proximas,
  };
}

export async function tareasDelMes(): Promise<Tarea[]> {
  const inicio = new Date();
  inicio.setDate(1);
  const mes = inicio.toISOString().slice(0, 10);

  const { data } = await db
    .from("tareas")
    .select("id, titulo, asignatura, mes")
    .or(`mes.eq.${mes},mes.is.null`)
    .order("creado_en", { ascending: false });

  return (data as Tarea[]) ?? [];
}

export type Material = {
  id: string;
  titulo: string;
  tipo: string;
  asignatura: string | null;
  generacion: string | null;
  autor: string | null;
  caracteres: number | null;
  creado_en: string;
};

/** Si la tabla no existe todavía, devuelve lista vacía en vez de reventar. */
export async function listarMaterial(): Promise<{ items: Material[]; faltaTabla: boolean }> {
  const { data, error } = await db
    .from("material")
    .select("id, titulo, tipo, asignatura, generacion, autor, caracteres, creado_en")
    .order("creado_en", { ascending: false })
    .limit(50);

  if (error && (error.code === "42P01" || error.code === "PGRST205")) {
    return { items: [], faltaTabla: true };
  }
  return { items: (data as Material[]) ?? [], faltaTabla: false };
}

/* ------------------------------------------------------------------ */
/* Próximas sesiones y agenda                                          */
/* ------------------------------------------------------------------ */

export type SesionProxima = {
  id: string;
  fecha: string;
  hora: string | null;
  duracion_min: number;
  tipo: string;
  zoom_url: string | null;
  alumnos: { nombre: string } | null;
};

export async function proximasSesiones(u: Usuario, limite = 5): Promise<SesionProxima[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  let consulta = db
    .from("sesiones")
    .select("id, fecha, hora, duracion_min, tipo, zoom_url, alumnos(nombre)")
    .gte("fecha", hoy)
    .eq("estado", "agendada")
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true })
    .limit(limite);

  if (u.rol !== "admin") consulta = consulta.eq("coach_id", u.id);

  const { data } = await consulta;
  return (data ?? []) as unknown as SesionProxima[];
}

/** Sesiones del alumno, con lo necesario para reprogramar. */
export async function sesionesDetalle(alumnoId: string): Promise<
  {
    id: string;
    fecha: string;
    hora: string | null;
    duracion_min: number;
    tipo: string;
    estado: string;
    resumen_ejecutivo: string | null;
    nota_coach: string | null;
    entrada_tipo: string | null;
  }[]
> {
  const { data } = await db
    .from("sesiones")
    .select("id, fecha, hora, duracion_min, tipo, estado, resumen_ejecutivo, nota_coach, entrada_tipo")
    .eq("alumno_id", alumnoId)
    .order("fecha", { ascending: false })
    .limit(50);
  return data ?? [];
}

/* ------------------------------------------------------------------ */
/* Tareas de aplicación por alumno                                     */
/* ------------------------------------------------------------------ */

export async function tareasConCobertura(alumnoId: string) {
  const { data: tareas } = await db
    .from("tareas")
    .select("id, titulo, asignatura, mes")
    .order("creado_en", { ascending: false })
    .limit(60);

  const { data: cobertura } = await db
    .from("tarea_sesion")
    .select("tarea_id, abordada, evidencia, sesion_id, sesiones!inner(alumno_id, fecha)")
    .eq("sesiones.alumno_id", alumnoId);

  const porTarea = new Map<string, { abordada: boolean; fecha?: string; evidencia?: string | null }>();
  for (const c of (cobertura ?? []) as unknown as {
    tarea_id: string;
    abordada: boolean;
    evidencia: string | null;
    sesiones: { fecha: string };
  }[]) {
    const previo = porTarea.get(c.tarea_id);
    if (!previo || (c.abordada && !previo.abordada)) {
      porTarea.set(c.tarea_id, { abordada: c.abordada, fecha: c.sesiones?.fecha, evidencia: c.evidencia });
    }
  }

  return (tareas ?? []).map((t) => ({
    ...t,
    ...(porTarea.get(t.id) ?? { abordada: false }),
  }));
}

/* ------------------------------------------------------------------ */
/* Memoria del chat                                                    */
/* ------------------------------------------------------------------ */

export async function historialChat(
  alumnoId: string | null,
  coachId?: string,
  limite = 10
): Promise<{ rol: "user" | "assistant"; texto: string }[]> {
  let consulta = db
    .from("chat_mensajes")
    .select("rol, texto, creado_en")
    .order("creado_en", { ascending: false })
    .limit(limite);

  consulta = alumnoId ? consulta.eq("alumno_id", alumnoId) : consulta.is("alumno_id", null);
  if (coachId) consulta = consulta.eq("coach_id", coachId);

  const { data, error } = await consulta;
  if (error) return [];
  return (data ?? []).reverse().map((m) => ({ rol: m.rol as "user" | "assistant", texto: m.texto }));
}
