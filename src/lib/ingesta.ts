import { db } from "./supabase";
import { analizarSesion } from "./agente";
import { ErrorIngesta, extraer } from "./extraer";
import { tareasDelMes } from "./datos";
import type { Usuario } from "./sesion";

export const LIMITE_BYTES = 5 * 1024 * 1024; // 5 MB: el límite práctico de una función SSR

/** Convierte el archivo en sesión analizada y la guarda. Devuelve el id del alumno. */
export async function procesarSesion({
  usuario,
  alumnoId,
  fecha,
  archivo,
}: {
  usuario: Usuario;
  alumnoId: string;
  fecha: string;
  archivo: File;
}): Promise<{ ok: true; alumnoId: string } | { ok: false; error: string; codigo?: string }> {
  if (!alumnoId) return { ok: false, error: "Elige el alumno.", codigo: "sin_alumno" };
  if (!archivo || archivo.size === 0) return { ok: false, error: "Elige el archivo de la sesión.", codigo: "sin_archivo" };
  if (archivo.size > LIMITE_BYTES) {
    return {
      ok: false,
      codigo: "archivo_muy_grande",
      error:
        "El archivo pasa de 5 MB. Sube la transcripción en texto (.vtt o .txt), que pesa muy poco, o exporta el audio en calidad media.",
    };
  }

  const { data: alumno } = await db
    .from("alumnos")
    .select("id, nombre, empresa, reto, etapa, coach_id")
    .eq("id", alumnoId)
    .maybeSingle();

  if (!alumno) return { ok: false, error: "Ese alumno no existe.", codigo: "alumno_inexistente" };
  if (usuario.rol !== "admin" && alumno.coach_id !== usuario.id) {
    return { ok: false, error: "Ese alumno no es tuyo.", codigo: "sin_permiso" };
  }

  let leido;
  try {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    leido = await extraer(buffer, archivo.name, archivo.type);
  } catch (e) {
    if (e instanceof ErrorIngesta) return { ok: false, error: e.message, codigo: e.codigo };
    return { ok: false, error: `No se pudo leer el archivo: ${(e as Error).message}`, codigo: "lectura" };
  }

  let analisis;
  try {
    const tareas = await tareasDelMes();
    analisis = await analizarSesion({
      transcripcion: leido.texto,
      alumno,
      tareas: tareas.map((t) => ({ id: t.id, titulo: t.titulo })),
    });
  } catch (e) {
    if (e instanceof ErrorIngesta) return { ok: false, error: e.message, codigo: e.codigo };
    return { ok: false, error: `El agente no pudo analizar la sesión: ${(e as Error).message}`, codigo: "analisis" };
  }

  const datos = {
    coach_id: usuario.id,
    alumno_id: alumnoId,
    tipo: "individual",
    fecha,
    titulo: `Sesión con ${alumno.nombre}`,
    estado: "realizada",
    transcripcion: leido.texto,
    resumen_ejecutivo: analisis.resumen,
    nota_coach: analisis.nota,
    entrada_tipo: leido.tipo,
  };

  const { data: previa } = await db
    .from("sesiones")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("fecha", fecha)
    .eq("estado", "agendada")
    .limit(1)
    .maybeSingle();

  let sesionId: string;

  if (previa?.id) {
    sesionId = previa.id;
    const { error } = await db.from("sesiones").update(datos).eq("id", sesionId);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}`, codigo: "guardado" };
    await db.from("hallazgos").delete().eq("sesion_id", sesionId);
    await db.from("compromisos").delete().eq("sesion_id", sesionId);
    await db.from("tarea_sesion").delete().eq("sesion_id", sesionId);
  } else {
    const { data: creada, error } = await db.from("sesiones").insert(datos).select("id").single();
    if (error || !creada) return { ok: false, error: `No se pudo guardar: ${error?.message}`, codigo: "guardado" };
    sesionId = creada.id;
  }

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
        alumno_id: alumnoId,
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

  return { ok: true, alumnoId };
}
