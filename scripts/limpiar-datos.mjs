#!/usr/bin/env node
/**
 * Deja la base sin datos de alumnos, sesiones ni conversaciones.
 * Conserva las cuentas de los coaches y el material de la firma.
 *
 *   node scripts/limpiar-datos.mjs              # solo cuenta lo que hay
 *   node scripts/limpiar-datos.mjs --confirmar  # borra de verdad
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(RAIZ, ".env.local"), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])
);

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// El orden importa: primero lo que depende de las sesiones.
const ORDEN = [
  "hallazgos",
  "compromisos",
  "tarea_sesion",
  "correcciones",
  "documentos",
  "archivos",
  "chat_mensajes",
  "sesiones",
  "alumnos",
];

const BUCKET = "sesiones";
const confirmar = process.argv.includes("--confirmar");

const contar = async (tabla) => {
  const { count, error } = await db.from(tabla).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${tabla}: ${error.message}`);
  return count ?? 0;
};

console.log(confirmar ? "BORRANDO\n" : "Revisión previa (no se borra nada)\n");

const antes = {};
for (const tabla of ORDEN) antes[tabla] = await contar(tabla);

for (const tabla of ORDEN) {
  console.log(`${tabla.padEnd(18)} ${String(antes[tabla]).padStart(4)} filas`);
}

const { data: archivos } = await db.storage.from(BUCKET).list("", { limit: 1000 });
const carpetas = (archivos ?? []).filter((a) => !a.id || a.id === null);
console.log(`\narchivos en Storage: ${(archivos ?? []).length} en la raíz`);

if (!confirmar) {
  console.log(`
Esto es solo la revisión. Para borrar de verdad:

  node scripts/limpiar-datos.mjs --confirmar

Se conservan las cuentas de los coaches y el material de la firma.`);
  process.exit(0);
}

// 1) Filas
for (const tabla of ORDEN) {
  const { error } = await db.from(tabla).delete().not("id", "is", null);
  if (error) {
    console.error(`✗ ${tabla}: ${error.message}`);
    process.exit(1);
  }
  const despues = await contar(tabla);
  console.log(`${despues === 0 ? "✓" : "!"} ${tabla.padEnd(18)} quedan ${despues}`);
}

// 2) Archivos del bucket (por carpeta de coach)
async function limpiarCarpeta(prefijo) {
  const { data } = await db.storage.from(BUCKET).list(prefijo, { limit: 1000 });
  for (const item of data ?? []) {
    const ruta = prefijo ? `${prefijo}/${item.name}` : item.name;
    if (!item.id) {
      await limpiarCarpeta(ruta);
    } else {
      await db.storage.from(BUCKET).remove([ruta]);
    }
  }
}

await limpiarCarpeta("");

console.log("\nListo. La base quedó sin alumnos, sesiones, hallazgos ni conversaciones.");
