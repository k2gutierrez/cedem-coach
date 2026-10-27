import { db } from "./supabase";

/** Palabras útiles de una pregunta (sin acentos, sin palabras vacías). */
function palabrasClave(texto: string): string[] {
  const vacias = new Set([
    "para", "como", "donde", "cuando", "porque", "sobre", "entre", "desde", "hasta",
    "este", "esta", "esto", "estos", "estas", "aquel", "otra", "otro", "todo", "toda",
    "hace", "hacia", "segun", "cual", "cuales", "quien", "quienes", "sabes", "dime",
    "puedes", "podrias", "quiero", "necesito", "revisa", "busca", "extrae", "menciona",
  ]);

  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length > 3 && !vacias.has(p));
}

export type Fragmento = { fecha: string; texto: string };

/**
 * Busca en las transcripciones del alumno los pasajes que responden a la pregunta.
 * Determinista: no depende del modelo para encontrar el texto.
 */
export async function fragmentosDeTranscripcion(
  alumnoId: string,
  pregunta: string,
  limite = 4
): Promise<Fragmento[]> {
  const palabras = palabrasClave(pregunta).slice(0, 10);
  if (!palabras.length) return [];

  const { data: sesiones } = await db
    .from("sesiones")
    .select("fecha, transcripcion")
    .eq("alumno_id", alumnoId)
    .not("transcripcion", "is", null)
    .order("fecha", { ascending: false })
    .limit(6);

  const encontrados: { fecha: string; texto: string; puntos: number }[] = [];

  for (const sesion of sesiones ?? []) {
    const lineas = String(sesion.transcripcion || "").split("\n");

    for (let i = 0; i < lineas.length; i += 1) {
      const plano = lineas[i]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      let puntos = 0;
      for (const palabra of palabras) if (plano.includes(palabra)) puntos += 1;
      if (!puntos) continue;

      // Contexto: la línea anterior y las dos siguientes.
      const desde = Math.max(0, i - 1);
      const hasta = Math.min(lineas.length, i + 3);
      const texto = lineas.slice(desde, hasta).join("\n").trim();
      if (texto.length < 40) continue;

      encontrados.push({ fecha: sesion.fecha, texto: texto.slice(0, 900), puntos });
    }
  }

  encontrados.sort((a, b) => b.puntos - a.puntos);

  // Sin repetir el mismo pasaje.
  const vistos = new Set<string>();
  const salida: Fragmento[] = [];
  for (const f of encontrados) {
    const clave = f.texto.slice(0, 80);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push({ fecha: f.fecha, texto: f.texto });
    if (salida.length >= limite) break;
  }

  return salida;
}

/**
 * Para resumir una transcripción larga sin mandarla completa: principio, mitad
 * y final. Así el resumen cubre toda la conversación y no solo el arranque.
 */
export function muestraTranscripcion(texto: string, maximo = 18000): string {
  const limpio = String(texto || "").trim();
  if (limpio.length <= maximo) return limpio;

  const tercio = Math.floor(maximo / 3);
  const mitad = Math.floor(limpio.length / 2 - tercio / 2);

  return [
    limpio.slice(0, tercio),
    "\n\n[…continúa…]\n\n",
    limpio.slice(mitad, mitad + tercio),
    "\n\n[…continúa…]\n\n",
    limpio.slice(-tercio),
  ].join("");
}
