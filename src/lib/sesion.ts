import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./supabase";

const COOKIE = "cedem_sesion";
const OCHO_HORAS = 60 * 60 * 8;

export type Rol = "coach" | "admin";

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  zoom_url: string | null;
};

/** Entra con correo y contraseña contra Supabase Auth. */
export async function iniciarSesion(email: string, password: string) {
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!r.ok) return { ok: false as const, error: "Correo o contraseña incorrectos." };

  const j = (await r.json()) as { access_token: string };

  const store = await cookies();
  store.set(COOKIE, j.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OCHO_HORAS,
  });

  return { ok: true as const };
}

export async function cerrarSesion() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Usuario de la petición actual, o null. Se memoriza por petición. */
export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return null;

    const { data: perfil } = await db
      .from("coaches")
      .select("id, nombre, email, rol, zoom_url, activo")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!perfil || perfil.activo === false) return null;
    return (perfil as Usuario & { activo?: boolean }) ?? null;
  } catch {
    // Un fallo momentáneo de red o de la base no debe tumbar la página.
    return null;
  }
});

/** Para páginas y acciones que exigen sesión. */
export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) throw new Error("sin_sesion");
  return u;
}

export async function exigirAdmin(): Promise<Usuario> {
  const u = await exigirUsuario();
  if (u.rol !== "admin") throw new Error("sin_permiso");
  return u;
}

/** Variante para páginas: si no hay sesión, manda al login en vez de lanzar error. */
export async function usuarioDePagina(): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect("/login");
  return u;
}
