import { db } from "./supabase";

/**
 * Lectura de tableros de monday.com.
 *
 * Solo lectura: se consulta con el token del servidor y se normaliza lo que
 * devuelve la API para que la vista no dependa de los ids de cada tablero.
 */

const URL_API = "https://api.monday.com/v2";

export type Columna = {
  id: string;
  titulo: string;
  tipo: string;
  valor: string;
  urls: string[];
  archivos: Archivo[];
};

export type Archivo = {
  id: string;
  nombre: string;
  tamano: number;
  /** Liga firmada; caduca, por eso se descarga al vuelo desde el servidor. */
  url: string;
};

export type Elemento = {
  id: string;
  nombre: string;
  grupo: string;
  columnas: Columna[];
};

export type Tablero = {
  id: string;
  nombre: string;
  descripcion: string | null;
  total: number;
  columnas: { id: string; title: string; type: string }[];
  elementos: Elemento[];
  consultado: string;
  error?: string;
};

type Crudo = {
  id: string;
  name: string;
  group?: { title?: string };
  column_values?: {
    id: string;
    text?: string | null;
    type?: string;
    value?: string | null;
  }[];
  assets?: { id: string; name: string; file_size?: number; public_url?: string }[];
};

const CONSULTA = `
  query ($id: [ID!], $limite: Int) {
    boards(ids: $id) {
      id
      name
      description
      items_count
      columns { id title type }
      items_page(limit: $limite) {
        items {
          id
          name
          group { title }
          column_values { id text type value }
          assets { id name file_size public_url }
        }
      }
    }
  }
`;

function enlacesDe(texto: string): string[] {
  const encontrados = texto.match(/https?:\/\/[^\s,;)]+/g) ?? [];
  return [...new Set(encontrados.map((u) => u.replace(/[.,;]$/, "")))];
}

function esDrive(url: string) {
  return /drive\.google\.com|docs\.google\.com|dropbox\.com|onedrive\.live\.com|sharepoint\.com/i.test(url);
}

export function tablerosConfigurados(): string[] {
  const crudo = process.env.MONDAY_TABLEROS || "18437953665";
  return crudo
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function mondayConfigurado(): boolean {
  return Boolean(process.env.MONDAY_API_TOKEN);
}

/**
 * Caché de 30 minutos. Vive en la base para que valga igual entre servidores:
 * monday se consulta como mucho dos veces por hora y tablero.
 */
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, { cuando: number; datos: Tablero }>();
let cacheEnBase = true;

async function leerCache(id: string): Promise<Tablero | null> {
  if (!cacheEnBase) {
    const guardado = cache.get(id);
    if (guardado && Date.now() - guardado.cuando < CACHE_MS) return guardado.datos;
    return null;
  }

  const { data, error } = await db
    .from("monday_cache")
    .select("datos, actualizado_en")
    .eq("tablero_id", id)
    .maybeSingle();

  if (error) {
    // Si la tabla todavía no existe, se sigue con la memoria.
    cacheEnBase = false;
    const guardado = cache.get(id);
    return guardado && Date.now() - guardado.cuando < CACHE_MS ? guardado.datos : null;
  }

  if (!data) return null;
  const edad = Date.now() - new Date(data.actualizado_en).getTime();
  return edad < CACHE_MS ? ({ ...(data.datos as Tablero), consultado: data.actualizado_en } as Tablero) : null;
}

async function guardarCache(id: string, datos: Tablero) {
  cache.set(id, { cuando: Date.now(), datos });
  if (!cacheEnBase) return;

  const { error } = await db
    .from("monday_cache")
    .upsert({ tablero_id: id, datos, actualizado_en: new Date().toISOString() }, { onConflict: "tablero_id" });

  if (error) cacheEnBase = false;
}

export async function consultarTablero(id: string, limite = 100, forzar = false): Promise<Tablero> {
  const token = process.env.MONDAY_API_TOKEN;
  const vacio: Tablero = {
    id,
    nombre: `Tablero ${id}`,
    descripcion: null,
    total: 0,
    columnas: [],
    elementos: [],
    consultado: new Date().toISOString(),
  };

  if (!token) return { ...vacio, error: "Falta configurar monday (MONDAY_API_TOKEN)." };

  if (!forzar) {
    const guardado = await leerCache(id);
    if (guardado) return guardado;
  }

  try {
    const r = await fetch(URL_API, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        "API-Version": "2024-10",
      },
      body: JSON.stringify({ query: CONSULTA, variables: { id: [id], limite } }),
      cache: "no-store",
    });

    const j = (await r.json()) as {
      data?: { boards?: { id: string; name: string; description?: string; items_count?: number; columns?: { id: string; title: string; type: string }[]; items_page?: { items?: Crudo[] } }[] };
      errors?: { message: string }[];
    };

    if (!r.ok || j.errors?.length) {
      return { ...vacio, error: j.errors?.[0]?.message || `monday respondió ${r.status}.` };
    }

    const board = j.data?.boards?.[0];
    if (!board) return { ...vacio, error: "No se encontró el tablero o el token no tiene permiso." };

    const columnas = board.columns ?? [];

    const elementos: Elemento[] = (board.items_page?.items ?? []).map((item) => {
      const valores = item.column_values ?? [];

      const propias: Columna[] = valores
        .map((v) => {
          const texto = (v.text || "").trim();
          const tipoColumna = columnas.find((c) => c.id === v.id)?.type ?? v.type ?? "";
          const titulo = columnas.find((c) => c.id === v.id)?.title ?? v.id;

          let urls = enlacesDe(texto);

          // Las columnas de enlace guardan el url aparte del texto.
          if (!urls.length && v.value) {
            try {
              const parseado = JSON.parse(v.value) as { url?: string; changed_at?: string };
              if (parseado.url) urls = [parseado.url];
            } catch {
              /* valor no es JSON */
            }
          }

          const archivos: Archivo[] = [];

          return { id: v.id, titulo, tipo: tipoColumna, valor: texto, urls, archivos };
        })
        .filter((c) => c.valor || c.urls.length);

      if (item.assets?.length) {
        propias.push({
          id: "archivos",
          titulo: "Archivos",
          tipo: "file",
          valor: "",
          urls: [],
          archivos: item.assets.map((a) => ({
            id: a.id,
            nombre: a.name,
            tamano: a.file_size ?? 0,
            url: a.public_url ?? "",
          })),
        });
      }

      return { id: item.id, nombre: item.name, grupo: item.group?.title ?? "", columnas: propias };
    });

    const datos: Tablero = {
      id: board.id,
      nombre: board.name,
      descripcion: board.description ?? null,
      total: board.items_count ?? elementos.length,
      columnas,
      elementos,
      consultado: new Date().toISOString(),
    };

    await guardarCache(id, datos);
    return datos;
  } catch (e) {
    return { ...vacio, error: `No se pudo consultar monday: ${(e as Error).message}` };
  }
}

export function esEnlaceDeNube(url: string) {
  return esDrive(url);
}
