import { db } from "./supabase";
import { completarTexto } from "./ia";

export type Plantilla = {
  id: string;
  nombre: string;
  descripcion: string | null;
  instrucciones: string;
  activo: boolean;
  creado_en: string;
};

export async function listarPlantillas(soloActivas = true): Promise<Plantilla[]> {
  let consulta = db
    .from("plantillas")
    .select("id, nombre, descripcion, instrucciones, activo, creado_en")
    .order("creado_en", { ascending: false });

  if (soloActivas) consulta = consulta.eq("activo", true);

  const { data } = await consulta;
  return (data ?? []) as Plantilla[];
}

export async function plantillaPorId(id: string): Promise<Plantilla | null> {
  const { data } = await db
    .from("plantillas")
    .select("id, nombre, descripcion, instrucciones, activo, creado_en")
    .eq("id", id)
    .maybeSingle();
  return (data as Plantilla) ?? null;
}

/**
 * Genera el documento aplicando las instrucciones de la plantilla al
 * expediente del alumno (sesiones, hallazgos, compromisos, tareas y brief).
 */
export async function generarDesdePlantilla(
  plantilla: Plantilla,
  contexto: {
    alumno: string;
    empresa?: string | null;
    cargo?: string | null;
    ciudad?: string | null;
    giro?: string | null;
    reto?: string | null;
    coach?: string | null;
    sesiones: { fecha: string; resumen: string }[];
    compromisos: string[];
    tareas: string[];
    brief?: string | null;
  }
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const sistema = `Eres el asistente de CEDEM, una firma mexicana de consultoría para empresas familiares.
Escribes en español de México, con tono profesional, directo y sin adornos.
Trabajas para el equipo de la firma, no para el alumno.
Reglas:
- Usa únicamente la información del expediente que se te entrega.
- Si un dato no aparece, no lo inventes: escribe "sin información" o desarrolla el punto sin ese dato.
- No expliques lo que haces ni pidas confirmación: entrega el documento listo para copiar.`;

  const usuario = `INSTRUCCIONES DEL DOCUMENTO
${plantilla.instrucciones}

EXPEDIENTE DEL ALUMNO
Nombre: ${contexto.alumno}
Empresa: ${contexto.empresa || "sin empresa registrada"}
Puesto: ${contexto.cargo || "sin dato"}
Ciudad: ${contexto.ciudad || "sin dato"}
Giro: ${contexto.giro || "sin dato"}
Proyecto detonador: ${contexto.reto || "sin definir"}
Coach: ${contexto.coach || "sin dato"}

SESIONES (más reciente primero)
${contexto.sesiones.length ? contexto.sesiones.map((s) => `- ${s.fecha}: ${s.resumen}`).join("\n") : "sin sesiones registradas"}

COMPROMISOS ABIERTOS
${contexto.compromisos.length ? contexto.compromisos.map((c) => `- ${c}`).join("\n") : "sin compromisos abiertos"}

TAREAS DE APLICACIÓN
${contexto.tareas.length ? contexto.tareas.map((t) => `- ${t}`).join("\n") : "sin tareas registradas"}

BRIEF DE CONTEXTO
${contexto.brief ? contexto.brief.slice(0, 4000) : "sin brief"}

Escribe el documento ahora, siguiendo la estructura de las instrucciones.`;

  const r = await completarTexto({ sistema, usuario, maxTokens: 3000, temperatura: 0.3 });
  if (!r.ok) return { ok: false, error: r.error };

  return { ok: true, texto: r.texto };
}
