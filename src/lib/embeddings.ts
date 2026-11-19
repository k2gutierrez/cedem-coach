import { iaConfigurada } from "./ia";

const URL_EMBEDDINGS = "https://api.openai.com/v1/embeddings";
const MODELO = "text-embedding-3-small";

/** OpenAI acepta hasta 8,191 tokens por texto; se recorta por seguridad. */
const MAX_CARACTERES = 6000;

export function embeddingsDisponibles() {
  return iaConfigurada();
}

/** Convierte textos en vectores. Devuelve un arreglo alineado con la entrada. */
export async function generarEmbeddings(textos: string[]): Promise<number[][]> {
  if (!textos.length || !embeddingsDisponibles()) return [];

  const limpios = textos.map((t) => (t || "").slice(0, MAX_CARACTERES).trim()).map((t) => t || "sin texto");

  const r = await fetch(URL_EMBEDDINGS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODELO, input: limpios }),
  });

  if (!r.ok) {
    console.error("[embeddings]", r.status, (await r.text().catch(() => "")).slice(0, 200));
    return [];
  }

  const j = (await r.json()) as { data?: { index: number; embedding: number[] }[] };
  const salida: number[][] = new Array(textos.length);
  for (const d of j.data ?? []) salida[d.index] = d.embedding;
  return salida;
}

/** Vector de una sola consulta. */
export async function embeddingDe(texto: string): Promise<number[] | null> {
  const [v] = await generarEmbeddings([texto]);
  return v ?? null;
}
