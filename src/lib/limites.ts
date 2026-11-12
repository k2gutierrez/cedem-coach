import { db } from "./supabase";

export type Limite = { ok: true; restantes: number } | { ok: false; minutos: number };

/**
 * Cuenta intentos por clave en una ventana de tiempo.
 * Se guarda en la base para que valga entre servidores.
 */
export async function limitar(clave: string, maximo: number, ventanaMin: number): Promise<Limite> {
  const ahora = new Date();

  const { data, error } = await db
    .from("limites")
    .select("conteo, reinicia_en")
    .eq("clave", clave)
    .maybeSingle();

  // Si la tabla no existe, no se bloquea a nadie: el límite es una protección,
  // no un requisito para operar.
  if (error) return { ok: true, restantes: maximo };

  if (!data || new Date(data.reinicia_en) <= ahora) {
    await db.from("limites").upsert(
      {
        clave,
        conteo: 1,
        reinicia_en: new Date(ahora.getTime() + ventanaMin * 60_000).toISOString(),
      },
      { onConflict: "clave" }
    );
    return { ok: true, restantes: maximo - 1 };
  }

  if (data.conteo >= maximo) {
    const minutos = Math.max(1, Math.ceil((new Date(data.reinicia_en).getTime() - ahora.getTime()) / 60_000));
    return { ok: false, minutos };
  }

  await db.from("limites").update({ conteo: data.conteo + 1 }).eq("clave", clave);
  return { ok: true, restantes: maximo - data.conteo - 1 };
}
