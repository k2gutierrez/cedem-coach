import { db } from "./supabase";

export type Minuta = {
  resumen: string;
  nota: string;
  hallazgos: { titulo: string; detalle: string; cita?: string }[];
  compromisos: { texto: string; responsable?: string; fecha?: string | null }[];
};

const SISTEMA = `Recibes la minuta de una sesión de coaching y la conversación que el coach tuvo
con el asistente. Devuelve la minuta corregida.

Reglas:
- Incorpora TODA corrección o dato nuevo que el coach haya dicho (nombres, cifras, tareas,
  compromisos, hechos mal entendidos).
- No inventes nada que no esté en la conversación o en la minuta original.
- Mantén el mismo formato: resumen, nota, hallazgos y compromisos.
- En "fecha" usa AAAA-MM-DD o null. Nunca frases.
- Devuelve SOLO JSON válido, sin texto adicional.`;


/** El modelo a veces devuelve formas raras: se normaliza antes de guardar. */
function normalizar(m: Record<string, unknown>, previa: Minuta): Minuta {
  const hallazgosCrudos = Array.isArray(m.hallazgos) ? m.hallazgos : [];
  const hallazgos = hallazgosCrudos
    .map((h) => {
      if (typeof h === "string") return { titulo: h.slice(0, 160), detalle: "" };
      const o = h as { titulo?: string; detalle?: string; cita?: string };
      return {
        titulo: String(o?.titulo ?? "").slice(0, 160),
        detalle: String(o?.detalle ?? "").slice(0, 800),
        ...(o?.cita ? { cita: String(o.cita).slice(0, 400) } : {}),
      };
    })
    .filter((h) => h.titulo);

  const compromisosCrudos = Array.isArray(m.compromisos) ? m.compromisos : [];
  const compromisos = compromisosCrudos
    .map((c) => {
      const o = c as { texto?: string; responsable?: string; fecha?: string | null };
      return {
        texto: String(o?.texto ?? "").slice(0, 300),
        ...(o?.responsable ? { responsable: String(o.responsable).slice(0, 80) } : {}),
        fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(o?.fecha ?? "")) ? String(o.fecha) : null,
      };
    })
    .filter((c) => c.texto);

  return {
    resumen: String(m.resumen ?? "").trim() || previa.resumen,
    nota: String(m.nota ?? "").trim() || previa.nota,
    hallazgos: hallazgos.length ? hallazgos : previa.hallazgos,
    compromisos: compromisos.length ? compromisos : previa.compromisos,
  };
}

/** Reescribe la minuta de una sesión con lo que se habló en el chat. */
export async function ajustarMinuta(sesionId: string): Promise<{ ok: true; minuta: Minuta } | { ok: false; error: string }> {
  if (!process.env.DEEPSEEK_API_KEY) return { ok: false, error: "Falta la llave de DeepSeek." };

  const { data: sesion } = await db
    .from("sesiones")
    .select("id, alumno_id, fecha, resumen_ejecutivo, nota_coach, minuta_ajustada")
    .eq("id", sesionId)
    .maybeSingle();

  if (!sesion) return { ok: false, error: "Esa sesión no existe." };

  const [{ data: hallazgos }, { data: compromisos }, { data: chat }] = await Promise.all([
    db.from("hallazgos").select("titulo, detalle, cita").eq("sesion_id", sesionId),
    db.from("compromisos").select("texto, responsable, fecha").eq("sesion_id", sesionId),
    db
      .from("chat_mensajes")
      .select("rol, texto")
      .eq("alumno_id", sesion.alumno_id)
      .order("creado_en", { ascending: false })
      .limit(5),
  ]);

  const conversacion = (chat ?? [])
    .reverse()
    .map((m) => `${m.rol === "user" ? "Coach" : "Agente"}: ${String(m.texto).slice(0, 400)}`)
    .join("\n");

  if (!conversacion.trim()) return { ok: false, error: "No hay conversación que aplicar." };

  // Si ya hubo ajustes previos, se parte de esa versión.
  const previaAjustada = sesion.minuta_ajustada as Partial<Minuta> | null;

  const actual: Minuta = {
    resumen: previaAjustada?.resumen ?? sesion.resumen_ejecutivo ?? "",
    nota: previaAjustada?.nota ?? sesion.nota_coach ?? "",
    hallazgos: previaAjustada?.hallazgos?.length
      ? previaAjustada.hallazgos
      : (hallazgos ?? []).map((h) => ({
          titulo: h.titulo,
          detalle: h.detalle ?? "",
          ...(h.cita ? { cita: h.cita } : {}),
        })),
    compromisos: previaAjustada?.compromisos?.length
      ? previaAjustada.compromisos
      : (compromisos ?? []).map((c) => ({
          texto: c.texto,
          ...(c.responsable ? { responsable: c.responsable } : {}),
          fecha: c.fecha ?? null,
        })),
  };

  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODELO_CHAT || "deepseek-flash",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SISTEMA },
        {
          role: "user",
          content: `FECHA DE LA SESIÓN: ${sesion.fecha}\n\nMINUTA ACTUAL:\n${JSON.stringify(
            actual,
            null,
            2
          )}\n\nCONVERSACIÓN CON EL COACH:\n${conversacion}`,
        },
      ],
    }),
  });

  if (!r.ok) return { ok: false, error: `El agente no respondió (${r.status}).` };

  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  let crudo: Record<string, unknown>;
  try {
    crudo = JSON.parse(j.choices?.[0]?.message?.content || "{}");
  } catch {
    return { ok: false, error: "El agente devolvió algo ilegible." };
  }

  const ajustada = normalizar(crudo, actual);

  if (!ajustada.resumen && !ajustada.hallazgos.length && !ajustada.compromisos.length) {
    return { ok: false, error: "El agente no devolvió cambios. Intenta de nuevo o revisa la conversación." };
  }

  const { error } = await db.from("sesiones").update({ minuta_ajustada: ajustada }).eq("id", sesionId);
  if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };

  return { ok: true, minuta: ajustada };
}
