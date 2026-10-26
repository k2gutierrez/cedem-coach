import { ErrorIngesta } from "./extraer";

const URL_API = "https://api.deepseek.com/chat/completions";

export type Hallazgo = { titulo: string; detalle: string; cita?: string };
export type Compromiso = { texto: string; responsable?: string; fecha?: string | null };
export type CoberturaTarea = {
  tarea_id: string;
  abordada: boolean;
  evidencia?: string;
  confianza?: "alta" | "media" | "baja";
};

export type Analisis = {
  resumen: string;
  nota: string;
  hallazgos: Hallazgo[];
  compromisos: Compromiso[];
  tareas: CoberturaTarea[];
};

export type AlumnoParaPrompt = {
  nombre: string;
  empresa?: string | null;
  reto?: string | null;
  etapa?: string | null;
  verbo?: string | null;
};

const SISTEMA = `Eres el asistente de CEDEM (Centro de Dueñez Empresaria), una firma mexicana que
acompaña a dueños de empresa y sus familias. Trabajas para coaches del Máster, no para los alumnos.

Tu trabajo es leer la transcripción de una sesión de coaching y devolver información útil para el
coach, en español de México, con tono profesional y directo.

Reglas:
- Separa hechos de interpretaciones. Un hallazgo es algo que se dijo en la sesión, no tu opinión.
- No inventes. Si no está en la transcripción, no lo pongas.
- Los compromisos son acciones concretas que alguien aceptó hacer, con fecha si se mencionó.
- Cita textualmente cuando el dato sea importante (campo "cita").
- Devuelves SOLO un objeto JSON válido, sin texto adicional, con esta forma:
{
  "resumen": "3 a 5 líneas con lo esencial de la sesión",
  "nota": "recomendación breve para el coach sobre cómo llegar a la siguiente sesión",
  "hallazgos": [{"titulo": "...", "detalle": "...", "cita": "..."}],
  "compromisos": [{"texto": "...", "responsable": "...", "fecha": "AAAA-MM-DD o null"}],
  "tareas": [{"tarea_id": "...", "abordada": true, "evidencia": "...", "confianza": "alta|media|baja"}]
}
Sobre "tareas": solo evalúa las tareas que se te den en la lista. Marca "abordada": true únicamente
si en la conversación se habló de esa tarea; si no se mencionó, false. La evidencia es la frase que
lo sustenta.`;

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function analizarSesion({
  transcripcion,
  alumno,
  tareas,
}: {
  transcripcion: string;
  alumno: AlumnoParaPrompt;
  tareas: { id: string; titulo: string }[];
}): Promise<Analisis> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new ErrorIngesta("falta_llave_deepseek", "Falta la llave de DeepSeek en .env.local.");
  }

  const listaTareas = tareas.length
    ? tareas.map((t) => `- ${t.id}: ${t.titulo}`).join("\n")
    : "(no hay tareas de aplicación definidas este mes)";

  const usuario = `Fecha de hoy: ${hoyISO()}

Alumno: ${alumno.nombre}
${alumno.empresa ? `Empresa: ${alumno.empresa}` : ""}
${alumno.reto ? `Reto declarado: ${alumno.reto}` : ""}
${alumno.etapa ? `Etapa: ${alumno.etapa}` : ""}

Tareas de aplicación a evaluar:
${listaTareas}

Transcripción de la sesión:
"""
${transcripcion.slice(0, 24000)}
"""`;

  const r = await fetch(URL_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODELO_ANALISIS || "deepseek-v4-pro",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SISTEMA },
        { role: "user", content: usuario },
      ],
    }),
  });

  if (!r.ok) {
    const detalle = (await r.text()).slice(0, 200);
    throw new ErrorIngesta("analisis_fallo", `El agente no respondió (${r.status}). ${detalle}`);
  }

  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  const crudo = j.choices?.[0]?.message?.content || "{}";

  let datos: Partial<Analisis>;
  try {
    datos = JSON.parse(crudo);
  } catch {
    throw new ErrorIngesta("analisis_json", "El agente devolvió algo ilegible. Intenta de nuevo.");
  }

  const ids = new Set(tareas.map((t) => t.id));

  return {
    resumen: String(datos.resumen || "").trim(),
    nota: String(datos.nota || "").trim(),
    hallazgos: (datos.hallazgos || [])
      .filter((h) => h && h.titulo)
      .slice(0, 8)
      .map((h) => ({
        titulo: String(h.titulo).slice(0, 160),
        detalle: String(h.detalle || "").slice(0, 800),
        cita: h.cita ? String(h.cita).slice(0, 400) : undefined,
      })),
    compromisos: (datos.compromisos || [])
      .filter((c) => c && c.texto)
      .slice(0, 10)
      .map((c) => ({
        texto: String(c.texto).slice(0, 300),
        responsable: c.responsable ? String(c.responsable).slice(0, 80) : undefined,
        fecha: c.fecha && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha) ? c.fecha : null,
      })),
    tareas: (datos.tareas || [])
      .filter((t) => t && ids.has(String(t.tarea_id)))
      .map((t) => ({
        tarea_id: String(t.tarea_id),
        abordada: Boolean(t.abordada),
        evidencia: t.evidencia ? String(t.evidencia).slice(0, 400) : undefined,
        confianza: t.confianza === "alta" || t.confianza === "media" || t.confianza === "baja" ? t.confianza : undefined,
      })),
  };
}
