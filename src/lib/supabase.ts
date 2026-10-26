import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !llave) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
}

/** Cliente de servidor: se salta RLS. Nunca debe llegar al navegador. */
export const db = createClient(url, llave, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const BUCKET = "sesiones";
