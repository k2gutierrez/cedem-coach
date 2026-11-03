#!/usr/bin/env node
/**
 * Diagnóstico de un tablero de monday.com.
 *
 *   node scripts/monday-probar.mjs --tablero 18437953665
 *
 * Necesita el token en .env.local (MONDAY_API_TOKEN) o pasarlo con --token.
 * Solo lee: no modifica nada en monday.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");

function leerEnv() {
  const ruta = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(ruta)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(ruta, "utf8")
      .split("\n")
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])
  );
}

const args = process.argv.slice(2);
const bandera = (nombre, defecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? args[i + 1] : defecto;
};

const env = leerEnv();
const token = bandera("token", process.env.MONDAY_API_TOKEN || env.MONDAY_API_TOKEN);
const tablero = bandera("tablero", "18437953665");

if (!token) {
  console.error(
    "Falta el token.\n\n" +
      "Agrégalo a .env.local:\n  MONDAY_API_TOKEN=tu_token\n\n" +
      "O pásalo directo:\n  node scripts/monday-probar.mjs --tablero 18437953665 --token TU_TOKEN"
  );
  process.exit(1);
}

const CONSULTA = `
  query ($id: [ID!]) {
    boards(ids: $id) {
      id
      name
      description
      items_count
      columns {
        id
        title
        type
      }
      items_page(limit: 5) {
        items {
          id
          name
          column_values {
            id
            text
            type
          }
          assets {
            id
            name
            file_size
            public_url
          }
        }
      }
    }
  }
`;

const respuesta = await fetch("https://api.monday.com/v2", {
  method: "POST",
  headers: {
    Authorization: token,
    "Content-Type": "application/json",
    "API-Version": "2024-10",
  },
  body: JSON.stringify({ query: CONSULTA, variables: { id: [String(tablero)] } }),
});

const json = await respuesta.json();

if (!respuesta.ok || json.errors) {
  console.error("La API respondió con error:");
  console.error(JSON.stringify(json.errors ?? json, null, 2));
  if (respuesta.status === 401) console.error("\nEl token no es válido o no tiene permiso sobre ese tablero.");
  process.exit(1);
}

const board = json.data?.boards?.[0];
if (!board) {
  console.error("No se encontró el tablero. Revisa el id o los permisos del token.");
  process.exit(1);
}

console.log(`\nTABLERO: ${board.name}  (id ${board.id})`);
console.log(`Elementos: ${board.items_count}`);
if (board.description) console.log(`Descripción: ${board.description.slice(0, 160)}`);

console.log(`\nCOLUMNAS (${board.columns.length}):`);
for (const c of board.columns) {
  console.log(`  ${c.id.padEnd(24)} ${c.type.padEnd(18)} ${c.title}`);
}

const items = board.items_page?.items ?? [];
console.log(`\nPRIMEROS ${items.length} ELEMENTOS:`);
for (const item of items) {
  console.log(`\n  · ${item.name}`);
  for (const v of item.column_values) {
    const texto = (v.text || "").trim();
    if (!texto) continue;
    console.log(`      ${v.id}: ${texto.slice(0, 90)}`);
  }
  for (const a of item.assets ?? []) {
    console.log(`      archivo: ${a.name} (${Math.round((a.file_size || 0) / 1024)} KB)`);
  }
}

console.log("\nCon esto ya se puede definir qué columnas se importan y cómo.\n");
