#!/usr/bin/env node
/**
 * Crea el Consejo mensual de cada coach.
 *
 *   node scripts/crear-consejos.mjs                 # revisa qué haría
 *   node scripts/crear-consejos.mjs --confirmar     # lo crea
 *   node scripts/crear-consejos.mjs --meses 6 --confirmar
 *
 * Es idempotente: si un coach ya tiene Consejo ese mes, no lo duplica.
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

const args = process.argv.slice(2);
const bandera = (nombre, defecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? Number(args[i + 1]) : defecto;
};

const meses = bandera("meses", 3);
const confirmar = args.includes("--confirmar");

/** Último viernes del mes, sin caer en 25 de diciembre ni 1 de enero. */
function ultimoViernes(anio, mes) {
  const fecha = new Date(Date.UTC(anio, mes, 0));
  while (fecha.getUTCDay() !== 5) fecha.setUTCDate(fecha.getUTCDate() - 1);

  const dia = fecha.toISOString().slice(0, 10);
  if (dia.endsWith("-12-25") || dia.endsWith("-01-01")) {
    fecha.setUTCDate(fecha.getUTCDate() - 7);
  }
  return fecha.toISOString().slice(0, 10);
}

const hoy = new Date();
const periodos = [];
for (let i = 0; i < meses; i += 1) {
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + i, 1));
  const anio = d.getUTCFullYear();
  const mes = d.getUTCMonth() + 1;
  const fecha = ultimoViernes(anio, mes);
  if (fecha >= hoy.toISOString().slice(0, 10)) periodos.push({ anio, mes, fecha });
}

const { data: coaches } = await db
  .from("coaches")
  .select("id, nombre, rol, zoom_url")
  .eq("activo", true)
  .order("nombre");

console.log(`${confirmar ? "CREANDO" : "Revisión previa"} · ${meses} meses · ${coaches?.length ?? 0} cuentas\n`);

let creadas = 0;
let saltadas = 0;

for (const coach of coaches ?? []) {
  for (const periodo of periodos) {
    const inicioMes = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-01`;
    const finMes = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-28`;

    const { data: existente } = await db
      .from("sesiones")
      .select("id")
      .eq("coach_id", coach.id)
      .eq("tipo", "consejo")
      .gte("fecha", inicioMes)
      .lte("fecha", finMes)
      .limit(1)
      .maybeSingle();

    if (existente) {
      saltadas += 1;
      continue;
    }

    console.log(`${coach.nombre.padEnd(28)} ${periodo.fecha}  Consejo`);
    creadas += 1;

    if (confirmar) {
      const { error } = await db.from("sesiones").insert({
        coach_id: coach.id,
        alumno_id: null,
        tipo: "consejo",
        fecha: periodo.fecha,
        hora: "16:00",
        duracion_min: 240,
        estado: "agendada",
        titulo: "Consejo CEDEM",
        zoom_url: coach.zoom_url,
      });
      if (error) console.error(`  ✗ ${error.message}`);
    }
  }
}

console.log(`\n${confirmar ? "Creadas" : "Se crearían"}: ${creadas} · ya existían: ${saltadas}`);
if (!confirmar) console.log("\nPara crearlas:\n  node scripts/crear-consejos.mjs --confirmar");
