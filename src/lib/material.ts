import { db } from "./supabase";
import { embeddingDe } from "./embeddings";

export type FragmentoMaterial = { titulo: string; tipo: string; fragmento: string };

type Fila = { titulo: string; tipo: string; fragmento: string };

/** Búsqueda semántica: fragmentos parecidos por significado, no por palabra. */
async function buscarPorVector(consulta: string, limite: number): Promise<Fila[]> {
  try {
    const vector = await embeddingDe(consulta);
    if (!vector) return [];

    const { data, error } = await db.rpc("buscar_fragmentos_vector", {
      consulta_vector: JSON.stringify(vector),
      limite,
    });

    if (error || !Array.isArray(data)) return [];

    return (data as { texto: string; titulo: string; tipo: string; distancia: number }[])
      .filter((f) => f.distancia < 0.62)
      .map((f) => ({ titulo: f.titulo, tipo: f.tipo, fragmento: f.texto }));
  } catch {
    return [];
  }
}

/** Junta los resultados de texto y de vectores, sin repetir. */
function combinar(a: Fila[], b: Fila[], limite: number): Fila[] {
  const vistos = new Set<string>();
  const salida: Fila[] = [];
  for (const fila of [...a, ...b]) {
    const clave = `${fila.titulo}|${fila.fragmento.slice(0, 80)}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(fila);
    if (salida.length >= limite) break;
  }
  return salida;
}

/** Busca en el material de la firma los fragmentos que responden a una consulta. */
export async function buscarMaterial(consulta: string): Promise<Fila[]> {
  const [porTexto, porVector] = await Promise.all([
    buscarPorTexto(consulta),
    buscarPorVector(consulta, 8),
  ]);

  // El significado primero; el texto completa.
  const juntos = combinar(porVector, porTexto, 10);
  if (juntos.length) return juntos;
  return porTexto;
}

async function buscarPorTexto(consulta: string): Promise<Fila[]> {
  try {
    const { data, error } = await db.rpc("buscar_material", { consulta, limite: 10 });
    if (!error && Array.isArray(data) && data.length) {
      return data as { titulo: string; tipo: string; fragmento: string }[];
    }
  } catch {
    /* sigue al respaldo */
  }

  const palabras = consulta
    .toLowerCase()
    .split(/[^a-záéíóúñü0-9]+/)
    .filter((p) => p.length > 3)
    .slice(0, 8);

  if (!palabras.length) return [];

  const mapear = (data: unknown[]) =>
    data.map((d) => {
      const fila = d as { texto?: string; material?: { titulo?: string; tipo?: string } | null };
      return {
        titulo: fila.material?.titulo ?? "Material de la firma",
        tipo: fila.material?.tipo ?? "documento",
        fragmento: String(fila.texto ?? ""),
      };
    });

  const { data: porTexto, error } = await db
    .from("material_fragmentos")
    .select("texto, material:material_id(titulo, tipo)")
    .textSearch("tsv", palabras.join(" or "), { config: "spanish", type: "websearch" })
    .limit(10);

  if (!error && porTexto?.length) return mapear(porTexto);

  const { data } = await db
    .from("material_fragmentos")
    .select("texto, material:material_id(titulo, tipo)")
    .or(palabras.map((p) => `texto.ilike.%${p}%`).join(","))
    .limit(10);

  return mapear(data ?? []);
}
