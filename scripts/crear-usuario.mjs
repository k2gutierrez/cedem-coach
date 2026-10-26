#!/usr/bin/env node
/**
 * Crea, actualiza o lista usuarios de CEDEM Coach.
 *
 *   node scripts/crear-usuario.mjs --email ana@cedem.com.mx --nombre "Ana Lucía Robles" \
 *        --rol coach --password "ClaveLarga123" [--zoom "https://zoom.us/j/123"]
 *
 *   node scripts/crear-usuario.mjs --email ana@cedem.com.mx --rol admin      # cambia el rol
 *   node scripts/crear-usuario.mjs --email ana@cedem.com.mx --password "Nueva123"  # cambia la clave
 *   node scripts/crear-usuario.mjs --listar
 *   node scripts/crear-usuario.mjs --desactivar --email ana@cedem.com.mx   # le quita el acceso
 *   node scripts/crear-usuario.mjs --activar --email ana@cedem.com.mx
 *
 * Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local.
 * Los roles son solo dos: "coach" (ve a sus alumnos) y "admin" (ve todo y carga material).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.resolve(AQUI, "..", ".env.local");

function leerEnv() {
  const salida = {};
  try {
    for (const linea of fs.readFileSync(ENV, "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) salida[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch {
    /* sin archivo */
  }
  return salida;
}

const env = leerEnv();
const url = env.SUPABASE_URL;
const llave = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !llave) {
  console.error(`Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ${ENV}`);
  process.exit(1);
}

const db = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });

const args = process.argv.slice(2);
const opt = (nombre) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? args[i + 1] : null;
};
const tiene = (nombre) => args.includes(`--${nombre}`);

const email = (opt("email") || "").trim().toLowerCase();
const nombre = opt("nombre");
const rol = (opt("rol") || "").toLowerCase() || null;
const password = opt("password");
const zoom = opt("zoom");

async function buscarCuenta(correo) {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  return data.users.find((u) => u.email?.toLowerCase() === correo) ?? null;
}

async function desactivar(estado) {
  if (!email) throw new Error("Falta --email");
  const cuenta = await buscarCuenta(email);
  if (!cuenta) throw new Error(`No existe ${email}`);
  const { error: e1 } = await db.from("coaches").update({ activo: !estado }).eq("id", cuenta.id);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await db.auth.admin.updateUserById(cuenta.id, {
    ban_duration: estado ? "876000h" : "none",
  });
  if (e2) throw new Error(e2.message);
  console.log(`✔ ${email} · ${estado ? "desactivado, ya no puede entrar" : "reactivado"}`);
}

async function borrar() {
  if (!email) throw new Error("Falta --email");
  const cuenta = await buscarCuenta(email);
  if (!cuenta) {
    console.log(`No existe ${email}.`);
    return;
  }
  // El sitio de CEDEM crea un perfil en `profiles` por cada cuenta nueva y esa
  // fila impide borrar la cuenta de autenticación: se quita primero.
  await db.from("profiles").delete().eq("id", cuenta.id);
  await db.from("coaches").delete().eq("id", cuenta.id);
  const { error } = await db.auth.admin.deleteUser(cuenta.id);
  if (error) {
    throw new Error(
      `. En este proyecto la cuenta no se puede borrar: la auditoría del sitio lo impide. Usa --desactivar.`
    );
  }
  console.log(`✔ Borrado: ${email}`);
}

async function listar() {
  const { data, error } = await db
    .from("coaches")
    .select("nombre, email, rol, activo, zoom_url")
    .order("rol");
  if (error) throw new Error(error.message);
  if (!data.length) {
    console.log("No hay usuarios todavía.");
    return;
  }
  console.table(data);
}

async function crearOActualizar() {
  if (!email) throw new Error("Falta --email");
  if (rol && !["coach", "admin"].includes(rol)) throw new Error("--rol debe ser coach o admin");

  let cuenta = await buscarCuenta(email);

  if (!cuenta) {
    if (!nombre) throw new Error("Para crear una cuenta nueva hace falta --nombre");
    if (!password || password.length < 8) throw new Error("Para crear una cuenta nueva hace falta --password (8+ caracteres)");

    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    });
    if (error) throw new Error(error.message);
    cuenta = data.user;
    console.log(`· Cuenta creada: ${email}`);
  } else {
    const cambios = {};
    if (password) cambios.password = password;
    if (Object.keys(cambios).length) {
      const { error } = await db.auth.admin.updateUserById(cuenta.id, { ...cambios, email_confirm: true });
      if (error) throw new Error(error.message);
      if (password) console.log("· Contraseña actualizada");
    }
  }

  const perfil = {
    ...(nombre ? { nombre } : {}),
    ...(rol ? { rol } : {}),
    ...(zoom ? { zoom_url: zoom } : {}),
  };

  const { data: existente } = await db.from("coaches").select("id").eq("id", cuenta.id).maybeSingle();

  if (existente) {
    // Actualizar: no se toca lo que no se pidió.
    if (Object.keys(perfil).length) {
      const { error } = await db.from("coaches").update(perfil).eq("id", cuenta.id);
      if (error) throw new Error(`No se pudo actualizar el perfil: ${error.message}`);
    }
  } else {
    if (!nombre) throw new Error("Falta --nombre para crear el perfil");
    const { error } = await db
      .from("coaches")
      .insert({ id: cuenta.id, email, nombre, rol: rol || "coach", ...perfil });
    if (error) throw new Error(`No se pudo crear el perfil: ${error.message}`);
  }

  console.log(`✔ ${email} · rol: ${perfil.rol ?? "(sin cambio)"}`);
}

try {
  if (tiene("listar")) await listar();
  else if (tiene("desactivar")) await desactivar(true);
  else if (tiene("activar")) await desactivar(false);
  else if (tiene("borrar")) await borrar();
  else await crearOActualizar();
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
