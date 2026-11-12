import { createHmac, timingSafeEqual } from "node:crypto";

const SECRETO =
  process.env.CALENDARIO_SECRETO || process.env.SUPABASE_SERVICE_ROLE_KEY || "cedem-calendario";

/**
 * Firma estable por coach para su liga de calendario. No es una contraseña:
 * solo sirve para que la URL del feed no sea adivinable.
 */
export function tokenCalendario(id: string, version = 0): string {
  return createHmac("sha256", SECRETO).update(`calendario:${id}:${version}`).digest("hex").slice(0, 40);
}

export function tokenValido(id: string, recibido: string, version = 0): boolean {
  const esperado = tokenCalendario(id, version);
  if (!recibido || recibido.length !== esperado.length) return false;
  try {
    return timingSafeEqual(Buffer.from(esperado), Buffer.from(recibido));
  } catch {
    return false;
  }
}
