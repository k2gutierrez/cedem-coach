"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./lib/supabase";
import { analizarSesion } from "./lib/agente";
import { ErrorIngesta, extraer } from "./lib/extraer";
import { tareasDelMes } from "./lib/datos";
import { cerrarSesion, exigirAdmin, exigirUsuario, iniciarSesion } from "./lib/sesion";

export type Estado = { error?: string; ok?: string };

/* ------------------------------------------------------------------ */
/* Sesión                                                              */
/* ------------------------------------------------------------------ */

export async function accionEntrar(_prev: Estado, formData: FormData): Promise<Estado> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Escribe tu correo y tu contraseña." };

  const r = await iniciarSesion(email, password);
  if (!r.ok) return { error: r.error };
  redirect("/");
}

export async function accionSalir(): Promise<void> {
  await cerrarSesion();
  redirect("/login");
}

/* ------------------------------------------------------------------ */
/* Alumnos                                                             */
/* ------------------------------------------------------------------ */

export async function crearAlumno(_prev: Estado, formData: FormData): Promise<Estado> {
  const usuario = await exigirUsuario();
  const nombre = String(formData.get("nombre") || "").trim();
  if (nombre.length < 3) return { error: "Escribe el nombre completo del alumno." };

  const { error } = await db.from("alumnos").insert({
    nombre,
    empresa: String(formData.get("empresa") || "").trim() || null,
    cargo: String(formData.get("cargo") || "").trim() || null,
    ciudad: String(formData.get("ciudad") || "").trim() || null,
    generacion: String(formData.get("generacion") || "").trim() || null,
    reto: String(formData.get("reto") || "").trim() || null,
    coach_id: usuario.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/alumnos");
  revalidatePath("/");
  return { ok: `${nombre} quedó registrado.` };
}

/* ------------------------------------------------------------------ */
/* Sesión de coaching: archivo → texto → análisis → base               */
/* ------------------------------------------------------------------ */

function trocear(texto: string, tamano = 1200, traslape = 150): string[] {
  const limpio = texto.replace(/\s+/g, " ").trim();
  const partes: string[] = [];
  let i = 0;
  while (i < limpio.length) {
    partes.push(limpio.slice(i, i + tamano));
    i += tamano - traslape;
    if (partes.length > 400) break;
  }
  return partes;
}

export async function subirSesion(_prev: Estado, formData: FormData): Promise<Estado> {
  let destino = "";
  try {
    const usuario = await exigirUsuario();
    const alumnoId = String(formData.get("alumnoId") || "");
    const fecha = String(formData.get("fecha") || new Date().toISOString().slice(0, 10));
    const archivo = formData.get("archivo");

    if (!alumnoId) return { error: "Elige el alumno." };
    if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo de la sesión." };
    if (archivo.size > 60 * 1024 * 1024) return { error: "El archivo pasa de 60 MB. Recórtalo o expórtalo más ligero." };

    const { data: alumno } = await db
      .from("alumnos")
      .select("id, nombre, empresa, reto, etapa, coach_id")
      .eq("id", alumnoId)
      .maybeSingle();

    if (!alumno) return { error: "Ese alumno no existe." };
    if (usuario.rol !== "admin" && alumno.coach_id !== usuario.id) return { error: "Ese alumno no es tuyo." };

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const leido = await extraer(buffer, archivo.name, archivo.type);
    const tareas = await tareasDelMes();
    const analisis = await analizarSesion({
      transcripcion: leido.texto,
      alumno,
      tareas: tareas.map((t) => ({ id: t.id, titulo: t.titulo })),
    });

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

    // Si ya estaba agendada para ese día, se completa en vez de duplicar.
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
      if (error) return { error: `No se pudo guardar la sesión: ${error.message}` };
      await db.from("hallazgos").delete().eq("sesion_id", sesionId);
      await db.from("compromisos").delete().eq("sesion_id", sesionId);
      await db.from("tarea_sesion").delete().eq("sesion_id", sesionId);
    } else {
      const { data: creada, error } = await db.from("sesiones").insert(datos).select("id").single();
      if (error || !creada) return { error: `No se pudo guardar la sesión: ${error?.message}` };
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

    // Guarda el archivo original (el audio no se conserva: solo el texto).
    if (leido.tipo !== "audio") {
      const ruta = `${usuario.id}/${sesionId}/${archivo.name.replace(/[^\w.\-áéíóúñ ]/gi, "_")}`;
      const subida = await db.storage.from("sesiones").upload(ruta, buffer, {
        contentType: archivo.type || "application/octet-stream",
        upsert: true,
      });
      await db.from("archivos").insert({
        sesion_id: sesionId,
        nombre: archivo.name,
        mime: archivo.type || null,
        bytes: archivo.size,
        storage_path: subida.error ? null : ruta,
        estado: "extraido",
        caracteres: leido.caracteres,
      });
    }

    revalidatePath("/");
    revalidatePath("/alumnos");
    revalidatePath(`/alumnos/${alumnoId}`);
    destino = `/alumnos/${alumnoId}?nueva=1`;
  } catch (e) {
    if (e instanceof ErrorIngesta) return { error: e.message };
    return { error: `Algo falló: ${(e as Error).message}` };
  }

  redirect(destino);
}

/* ------------------------------------------------------------------ */
/* Material para el agente (solo admin)                                */
/* ------------------------------------------------------------------ */

export async function subirMaterial(_prev: Estado, formData: FormData): Promise<Estado> {
  try {
    const usuario = await exigirAdmin();
    const titulo = String(formData.get("titulo") || "").trim();
    const archivo = formData.get("archivo");
    const tipo = String(formData.get("tipo") || "documento");

    if (titulo.length < 3) return { error: "Ponle un título al material." };
    if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo." };

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const leido = await extraer(buffer, archivo.name, archivo.type);

    const { data, error } = await db
      .from("material")
      .insert({
        titulo,
        tipo,
        asignatura: String(formData.get("asignatura") || "").trim() || null,
        generacion: String(formData.get("generacion") || "").trim() || null,
        autor: String(formData.get("autor") || "").trim() || null,
        texto: leido.texto,
        caracteres: leido.caracteres,
        creado_por: usuario.id,
      })
      .select("id")
      .single();

    if (error) {
      const falta = error.code === "42P01" || error.code === "PGRST205";
      return {
        error: falta
          ? "Falta crear la tabla de material: corre sql/002-material.sql en Supabase."
          : `No se pudo guardar: ${error.message}`,
      };
    }

    const partes = trocear(leido.texto);
    if (partes.length) {
      await db.from("material_fragmentos").insert(
        partes.map((texto, orden) => ({ material_id: data.id, orden, texto }))
      );
    }

    revalidatePath("/admin");
    return { ok: `"${titulo}" quedó cargado (${partes.length} fragmentos).` };
  } catch (e) {
    if (e instanceof ErrorIngesta) return { error: e.message };
    return { error: `Algo falló: ${(e as Error).message}` };
  }
}

export async function crearTarea(_prev: Estado, formData: FormData): Promise<Estado> {
  try {
    await exigirAdmin();
    const titulo = String(formData.get("titulo") || "").trim();
    if (titulo.length < 3) return { error: "Escribe el nombre de la tarea." };

    const mesCrudo = String(formData.get("mes") || "");
    const mes = mesCrudo ? `${mesCrudo}-01` : null;

    const { error } = await db.from("tareas").insert({
      titulo,
      asignatura: String(formData.get("asignatura") || "").trim() || null,
      mes,
    });

    if (error) return { error: `No se pudo guardar: ${error.message}` };
    revalidatePath("/admin");
    return { ok: "Tarea agregada al catálogo." };
  } catch {
    return { error: "Solo el administrador puede crear tareas." };
  }
}

/* ------------------------------------------------------------------ */
/* Agendar una sesión futura                                           */
/* ------------------------------------------------------------------ */

export async function agendarSesion(_prev: Estado, formData: FormData): Promise<Estado> {
  try {
    const usuario = await exigirUsuario();
    const alumnoId = String(formData.get("alumnoId") || "");
    const fecha = String(formData.get("fecha") || "");
    const hora = String(formData.get("hora") || "09:00");
    const duracion = Number(formData.get("duracion") || 60);
    const tipo = String(formData.get("tipo") || "individual");

    if (!alumnoId || !fecha) return { error: "Elige el alumno y la fecha." };

    const { data: alumno } = await db
      .from("alumnos")
      .select("id, nombre, coach_id")
      .eq("id", alumnoId)
      .maybeSingle();

    if (!alumno) return { error: "Ese alumno no existe." };
    if (usuario.rol !== "admin" && alumno.coach_id !== usuario.id) return { error: "Ese alumno no es tuyo." };

    const { data: creada, error } = await db
      .from("sesiones")
      .insert({
        coach_id: usuario.id,
        alumno_id: alumnoId,
        tipo,
        fecha,
        hora,
        duracion_min: duracion,
        estado: "agendada",
        titulo: tipo === "consejo" ? "Consejo CEDEM" : `Sesión con ${alumno.nombre}`,
        zoom_url: usuario.zoom_url,
      })
      .select("id")
      .single();

    if (error || !creada) return { error: `No se pudo agendar: ${error?.message}` };

    revalidatePath("/");
    revalidatePath(`/alumnos/${alumnoId}`);
    return { ok: "Sesión agendada. Agrega el archivo cuando termines y quedará como realizada." };
  } catch {
    return { error: "No se pudo agendar la sesión." };
  }
}

/* ------------------------------------------------------------------ */
/* Mi cuenta: nombre, liga de Zoom y contraseña                        */
/* ------------------------------------------------------------------ */

export async function actualizarCuenta(_prev: Estado, formData: FormData): Promise<Estado> {
  try {
    const usuario = await exigirUsuario();
    const nombre = String(formData.get("nombre") || "").trim();
    const zoom = String(formData.get("zoom") || "").trim();
    const clave = String(formData.get("password") || "");

    if (nombre.length < 3) return { error: "Escribe tu nombre completo." };
    if (zoom && !/^https?:\/\//i.test(zoom)) {
      return { error: "La liga de Zoom debe empezar con https://" };
    }
    if (clave && clave.length < 8) {
      return { error: "La contraseña nueva necesita 8 caracteres o más." };
    }

    const { error } = await db
      .from("coaches")
      .update({ nombre, zoom_url: zoom || null })
      .eq("id", usuario.id);

    if (error) return { error: `No se pudo guardar: ${error.message}` };

    if (clave) {
      const { error: errorClave } = await db.auth.admin.updateUserById(usuario.id, { password: clave });
      if (errorClave) return { error: `No se pudo cambiar la contraseña: ${errorClave.message}` };
    }

    revalidatePath("/", "layout");
    return { ok: clave ? "Datos y contraseña actualizados." : "Datos actualizados." };
  } catch {
    return { error: "No se pudo guardar. Intenta de nuevo." };
  }
}
