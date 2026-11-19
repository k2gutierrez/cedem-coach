#!/usr/bin/env node
/**
 * Genera los vectores de los fragmentos que aún no los tienen.
 *
 *   node scripts/embeddings.mjs
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

const MAX = 6000;

async function embed(textos) {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: textos.map((t) => (t || "").slice(0, MAX) || "sin texto"),
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const j = await r.json();
  return j.data.map((d) => d.embedding);
}

const { data: pendientes, error } = await db
  .from("material_fragmentos")
  .select("id, texto")
  .is("embedding", null)
  .order("orden")
  .limit(500);

if (error) {
  console.error("No se pudo leer la tabla:", error.message);
  console.error("¿Corriste sql/011-embeddings.sql?");
  process.exit(1);
}

console.log(`fragmentos sin vector: ${pendientes?.length ?? 0}`);
if (!pendientes?.length) process.exit(0);

const TANDA = 32;
let hechos = 0;

for (let i = 0; i < pendientes.length; i += TANDA) {
  const tanda = pendientes.slice(i, i + TANDA);
  const vectores = await embed(tanda.map((f) => f.texto));

  for (let j = 0; j < tanda.length; j += 1) {
    const { error: err } = await db
      .from("material_fragmentos")
      .update({ embedding: vectores[j] })
      .eq("id", tanda[j].id);
    if (err) console.error("✗", err.message);
    else hechos += 1;
  }
  console.log(`  ${hechos}/${pendientes.length}`);
}

console.log(`\nListo: ${hechos} fragmentos con vector.`);
