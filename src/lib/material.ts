import { db } from "./supabase";

export type FragmentoMaterial = { titulo: string; tipo: string; fragmento: string };

/** Busca en el material de la firma los fragmentos que responden a una consulta. */
export async function buscarMaterial(consulta: string): Promise<{ titulo: string; tipo: string; fragmento: string }[]> {
  try {
    const { data, error } = await db.rpc("buscar_material", { consulta, limite: 6 });
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
    .limit(6);

  if (!error && porTexto?.length) return mapear(porTexto);

  const { data } = await db
    .from("material_fragmentos")
    .select("texto, material:material_id(titulo, tipo)")
    .or(palabras.map((p) => `texto.ilike.%${p}%`).join(","))
    .limit(6);

  return mapear(data ?? []);
}
