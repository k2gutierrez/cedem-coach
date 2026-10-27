import { db } from "./supabase";

const URL_API = "https://api.deepseek.com/anthropic/v1/messages";

type Fuente = { titulo: string; url: string };

export type ResultadoBrief = {
  texto: string;
  fuentes: Fuente[];
};

const INSTRUCCIONES = `Actúa como analista de mercado especializado en empresas familiares. Tu tarea es
preparar a un coach ejecutivo antes de su primera sesión de coaching individual con un alumno del
Máster en Innovación y Emprendimiento en la Empresa Familiar (MIEEF).

El objetivo NO es diagnosticar la empresa ni darle recomendaciones. El objetivo es que el coach
entienda el contexto en el que trabaja su coachee: su industria, su mercado, sus competidores, los
retos del sector y las tensiones típicas de una empresa familiar como la suya.

FUENTES Y RIGOR
- Usa la búsqueda web como fuente principal para la industria, el mercado y los competidores.
- Confirma que la información corresponda a esta empresa y no a otra con un nombre parecido.
- Si no encuentras información pública confiable sobre algo, dilo; no lo inventes.
- Marca cada afirmación relevante como [Hecho, fuente] o [Supuesto].
- Cuando des cifras de mercado, indica el año y la fuente.

ESTRUCTURA DEL BRIEF
1. Ficha rápida (máximo 6 líneas): qué hace la empresa, giro, tamaño aproximado, ubicación,
   canales, años en operación y etapa generacional probable.
2. La industria: tamaño y dinámica del mercado en el país; 3 a 5 tendencias; cómo gana dinero una
   empresa de este sector y qué mueve sus márgenes.
3. Panorama competitivo: 4 a 6 competidores relevantes, con una línea sobre cada uno.
4. Tres retos críticos del sector.
5. Lente de empresa familiar: tensiones típicas de esta etapa (sucesión, profesionalización,
   gobierno, roles), escritas como posibilidades a explorar, nunca como afirmaciones.
6. El puesto del coachee: presiones típicas de ese rol y su relación con quien lidera la empresa.
7. Glosario del sector: 8 a 12 términos con definición breve.
8. Fuentes consultadas con enlace.

FORMATO DE SALIDA
- Empieza directamente en "1. Ficha rápida". Sin título propio, sin introducción.
- No narres lo que vas a hacer ni lo que encontraste ("voy a buscar", "confirmada la empresa").
- No uses separadores como --- ni bloques de código.

ESTILO
- Español claro y directo. Extensión total: 1 a 2 páginas.
- Tono neutral: no juzgues a la empresa ni a la familia.
- No hagas recomendaciones de negocio ni sugieras preguntas para la sesión.`;


/** Quita la narración previa y los separadores que el modelo a veces agrega. */
function limpiarBrief(texto: string): string {
  const lineas = texto.split(/\r?\n/);

  // Se descarta todo lo anterior al primer encabezado del brief.
  let inicio = lineas.findIndex((l) => /^(#{1,3}\s|\*\*?1\.?\s*1?\.?\s*Ficha|1\.\s*Ficha)/i.test(l.trim()));
  if (inicio < 0) inicio = 0;

  return lineas
    .slice(inicio)
    .filter((l) => !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l))
    .join("\n")
    .trim();
}

function datosDelAlumno(alumno: {
  nombre: string;
  empresa: string | null;
  cargo: string | null;
  ciudad: string | null;
  giro: string | null;
  generacion: string | null;
  reto: string | null;
  brief: string | null;
}) {
  const lineas = [
    `- Empresa: ${alumno.empresa ?? "(no registrada)"}`,
    `- Coachee: ${alumno.nombre}${alumno.cargo ? ` – ${alumno.cargo}` : ""}`,
    alumno.ciudad ? `- Ubicación: ${alumno.ciudad}` : "",
    alumno.giro ? `- Giro: ${alumno.giro}` : "",
    alumno.generacion ? `- Generación: ${alumno.generacion}` : "",
    alumno.reto ? `- Proyecto detonador declarado: ${alumno.reto}` : "",
  ].filter(Boolean);

  return lineas.join("\n");
}

/** Genera el brief con búsqueda web de DeepSeek (una sola llamada, ~20 s). */
export async function generarBrief(alumnoId: string): Promise<{ ok: true; brief: ResultadoBrief } | { ok: false; error: string }> {
  if (!process.env.DEEPSEEK_API_KEY) return { ok: false, error: "Falta la llave de DeepSeek." };

  const { data: alumno } = await db
    .from("alumnos")
    .select("id, nombre, empresa, cargo, ciudad, giro, generacion, reto, brief")
    .eq("id", alumnoId)
    .maybeSingle();

  if (!alumno) return { ok: false, error: "Ese alumno no existe." };
  if (!alumno.empresa) {
    return { ok: false, error: "Falta la empresa del alumno. Agrégala en sus datos y vuelve a intentar." };
  }

  const clave = process.env.DEEPSEEK_API_KEY;

  const respuesta = await fetch(URL_API, {
    method: "POST",
    headers: {
      authorization: `Bearer ${clave}`,
      "x-api-key": clave,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODELO_ANALISIS || "deepseek-flash",
      max_tokens: 4500,
      thinking: { type: "disabled" },
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [
        {
          role: "user",
          content: `${INSTRUCCIONES}\n\nDATOS DEL COACHEE\n${datosDelAlumno(alumno)}\n\nGenera el brief ahora.`,
        },
      ],
    }),
  });

  if (!respuesta.ok) {
    const detalle = (await respuesta.text()).slice(0, 200);
    return { ok: false, error: `El buscador no respondió (${respuesta.status}). ${detalle}` };
  }

  const j = (await respuesta.json()) as {
    content?: { type: string; text?: string; content?: { title?: string; url?: string }[] }[];
  };

  const texto = (j.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n\n")
    .trim();

  const fuentes: Fuente[] = [];
  for (const bloque of j.content ?? []) {
    if (bloque.type !== "web_search_tool_result") continue;
    for (const r of bloque.content ?? []) {
      if (r?.url && !fuentes.some((f) => f.url === r.url)) {
        fuentes.push({ titulo: r.title ?? r.url, url: r.url });
      }
    }
  }

  const limpio = limpiarBrief(texto);

  if (limpio.length < 400) {
    return { ok: false, error: "El agente no alcanzó a escribir el brief. Intenta de nuevo." };
  }

  const { error } = await db
    .from("alumnos")
    .update({ brief: limpio, brief_fuentes: fuentes, brief_actualizado: new Date().toISOString() })
    .eq("id", alumnoId);

  if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };

  return { ok: true, brief: { texto: limpio, fuentes } };
}
