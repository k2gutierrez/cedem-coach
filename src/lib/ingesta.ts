import { db } from "./supabase";
import { analizarSesion } from "./agente";
import { ErrorIngesta, extraer } from "./extraer";
import { tareasDelMes } from "./datos";
import type { Usuario } from "./sesion";

export const LIMITE_BYTES = 50 * 1024 * 1024; // 50 MB: lo que acepta el bucket

type Fallo = { ok: false; error: string; codigo?: string };

/**
 * Paso 1: convierte el archivo en texto y guarda la sesión. Sin IA, para que
 * la función del servidor no se acerque al tiempo máximo.
 */
export async function guardarArchivo({
  usuario,
  alumnoId,
  fecha,
  archivo,
  tipo = "individual",
}: {
  usuario: Usuario;
  alumnoId: string;
  fecha: string;
  archivo: File;
  tipo?: "individual" | "consejo";
}): Promise<{ ok: true; sesionId: string; alumnoId: string | null; caracteres: number } | Fallo> {
  const esConsejo = tipo === "consejo";
  if (!alumnoId && !esConsejo) return { ok: false, error: "Elige el alumno.", codigo: "sin_alumno" };
  if (!archivo || archivo.size === 0) return { ok: false, error: "Elige el archivo de la sesión.", codigo: "sin_archivo" };
  if (archivo.size > LIMITE_BYTES) {
    return { ok: false, codigo: "archivo_muy_grande", error: "El archivo pasa de 50 MB." };
  }

  const alumno = esConsejo
    ? null
    : (await db.from("alumnos").select("id, nombre, coach_id").eq("id", alumnoId).maybeSingle()).data;

  if (!esConsejo) {
    if (!alumno) return { ok: false, error: "Ese alumno no existe.", codigo: "alumno_inexistente" };
    if (usuario.rol !== "admin" && alumno.coach_id !== usuario.id) {
      return { ok: false, error: "Ese alumno no es tuyo.", codigo: "sin_permiso" };
    }
  }

  let leido;
  try {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    leido = await extraer(buffer, archivo.name, archivo.type);
  } catch (e) {
    if (e instanceof ErrorIngesta) return { ok: false, error: e.message, codigo: e.codigo };
    return { ok: false, error: `No se pudo leer el archivo: ${(e as Error).message}`, codigo: "lectura" };
  }

  const datos = {
    coach_id: usuario.id,
    alumno_id: esConsejo ? null : alumnoId,
    tipo: esConsejo ? "consejo" : "individual",
    fecha,
    titulo: esConsejo ? "Consejo" : `Sesión con ${alumno!.nombre}`,
    estado: "realizada",
    transcripcion: leido.texto,
    entrada_tipo: leido.tipo,
  };

  const { data: previa } = await db
    .from("sesiones")
    .select("id")
    .eq("alumno_id", esConsejo ? "00000000-0000-0000-0000-000000000000" : alumnoId)
    .eq("fecha", fecha)
    .eq("estado", "agendada")
    .limit(1)
    .maybeSingle();

  if (previa?.id) {
    const { error } = await db.from("sesiones").update(datos).eq("id", previa.id);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}`, codigo: "guardado" };
    return { ok: true, sesionId: previa.id, alumnoId: esConsejo ? null : alumnoId, caracteres: leido.caracteres };
  }

  const { data: creada, error } = await db.from("sesiones").insert(datos).select("id").single();
  if (error || !creada) return { ok: false, error: `No se pudo guardar: ${error?.message}`, codigo: "guardado" };

  return { ok: true, sesionId: creada.id, alumnoId: esConsejo ? null : alumnoId, caracteres: leido.caracteres };
}

/**
 * Paso 2: analiza una sesión ya guardada. Es la parte lenta (IA), así que va en
 * su propia petición para no arrastrar a la subida.
 */
export async function analizarGuardada({
  usuario,
  sesionId,
}: {
  usuario: Usuario;
  sesionId: string;
}): Promise<{ ok: true; sesionId: string; alumnoId: string | null; resumen: string } | Fallo> {
  const { data: sesion } = await db
    .from("sesiones")
    .select("id, coach_id, alumno_id, tipo, fecha, transcripcion, resumen_ejecutivo, alumnos(id, nombre, empresa, reto, etapa)")
    .eq("id", sesionId)
    .maybeSingle();

  if (!sesion) return { ok: false, error: "Esa sesión no existe.", codigo: "no_existe" };
  if (usuario.rol !== "admin" && sesion.coach_id !== usuario.id) {
    return { ok: false, error: "Esa sesión no es tuya.", codigo: "sin_permiso" };
  }
  if (!sesion.transcripcion) {
    return { ok: false, error: "La sesión no tiene texto que analizar.", codigo: "sin_texto" };
  }
  if (sesion.resumen_ejecutivo) {
    return { ok: true, sesionId, alumnoId: sesion.alumno_id, resumen: sesion.resumen_ejecutivo };
  }

  const alumno = (sesion.alumnos as unknown as {
    nombre: string;
    empresa: string | null;
    reto: string | null;
    etapa: string | null;
  } | null);

  const contextoAlumno = alumno ?? {
    nombre: sesion.tipo === "consejo" ? "Consejo del grupo (todos los alumnos)" : "Alumno",
    empresa: null,
    reto: null,
    etapa: null,
  };

  let analisis;
  try {
    const tareas = await tareasDelMes();
    analisis = await analizarSesion({
      transcripcion: sesion.transcripcion,
      alumno: contextoAlumno,
      tareas: tareas.map((t) => ({ id: t.id, titulo: t.titulo })),
    });
  } catch (e) {
    if (e instanceof ErrorIngesta) return { ok: false, error: e.message, codigo: e.codigo };
    return { ok: false, error: `El agente no pudo analizar: ${(e as Error).message}`, codigo: "analisis" };
  }

  await db
    .from("sesiones")
    .update({ resumen_ejecutivo: analisis.resumen, nota_coach: analisis.nota })
    .eq("id", sesionId);

  await db.from("hallazgos").delete().eq("sesion_id", sesionId);
  await db.from("compromisos").delete().eq("sesion_id", sesionId);
  await db.from("tarea_sesion").delete().eq("sesion_id", sesionId);

  if (analisis.hallazgos.length) {
    await db.from("hallazgos").insert(
      analisis.hallazgos.map((h) => ({
        sesion_id: sesionId,
        titulo: h.titulo,
        detalle: h.detalle,
        cita: h.cita ?? null,
      }))
    );
  }

  if (analisis.compromisos.length) {
    await db.from("compromisos").insert(
      analisis.compromisos.map((c) => ({
        sesion_id: sesionId,
        alumno_id: sesion.alumno_id,
        texto: c.texto,
        responsable: c.responsable ?? null,
        fecha: c.fecha ?? null,
        estado: "abierto",
      }))
    );
  }

  if (analisis.tareas.length) {
    await db.from("tarea_sesion").insert(
      analisis.tareas.map((t) => ({
        sesion_id: sesionId,
        tarea_id: t.tarea_id,
        abordada: t.abordada,
        evidencia: t.evidencia ?? null,
        confianza: t.confianza ?? null,
      }))
    );
  }

  return { ok: true, sesionId, alumnoId: sesion.alumno_id, resumen: analisis.resumen };
}
