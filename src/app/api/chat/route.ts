import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";

export const maxDuration = 60;

type Mensaje = { rol: "user" | "assistant"; texto: string };

const SISTEMA = `Eres el agente de CEDEM (Centro de Dueñez Empresaria), una firma mexicana que
acompaña a dueños de empresa y sus familias. Le hablas a un coach del Máster, no al alumno.

Reglas:
- Responde en español de México, claro y breve (máximo 8 líneas salvo que pidan detalle).
- Usa solo la información del contexto. Si no está, dilo y sugiere qué subir o revisar.
- Cita de dónde sale: "según la sesión del 12 de octubre" o "según el material: Clase 3".
- No inventes datos de alumnos ni cifras.
- Cuando te pregunten qué hacer, propón 2 o 3 acciones concretas y deja la decisión al coach.
- Si el coach te corrige o te da información nueva del caso, acéptala y tenla en cuenta en lo que
  sigue de la conversación; en la app sus correcciones se aplican a la minuta con un botón.
- Si te piden un documento, di dónde generarlo.`;

function recortar(texto: string, max: number) {
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
}

async function buscarMaterial(consulta: string): Promise<{ titulo: string; tipo: string; fragmento: string }[]> {
  try {
    const { data, error } = await db.rpc("buscar_material", { consulta, limite: 6 });
    if (!error && Array.isArray(data) && data.length) {
      return data as { titulo: string; tipo: string; fragmento: string }[];
    }
  } catch {
    /* sigue al respaldo */
  }

  const palabras = consulta
    .toLowerCase()
    .split(/[^a-záéíóúñü0-9]+/)
    .filter((p) => p.length > 3)
    .slice(0, 8);

  if (!palabras.length) return [];

  const mapear = (data: unknown[]) =>
    data.map((d) => {
      const fila = d as { texto?: string; material?: { titulo?: string; tipo?: string } | null };
      return {
        titulo: fila.material?.titulo ?? "Material de la firma",
        tipo: fila.material?.tipo ?? "documento",
        fragmento: String(fila.texto ?? ""),
      };
    });

  const { data: porTexto, error } = await db
    .from("material_fragmentos")
    .select("texto, material:material_id(titulo, tipo)")
    .textSearch("tsv", palabras.join(" or "), { config: "spanish", type: "websearch" })
    .limit(6);

  if (!error && porTexto?.length) return mapear(porTexto);

  const { data } = await db
    .from("material_fragmentos")
    .select("texto, material:material_id(titulo, tipo)")
    .or(palabras.map((p) => `texto.ilike.%${p}%`).join(","))
    .limit(6);

  return mapear(data ?? []);
}

export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "falta_llave_deepseek" }, { status: 500 });
  }

  const cuerpo = (await req.json()) as { mensajes?: Mensaje[]; alumnoId?: string | null };
  const mensajes = (cuerpo.mensajes || []).slice(-12);
  if (!mensajes.length) return NextResponse.json({ error: "sin_pregunta" }, { status: 400 });

  const alumnoId = cuerpo.alumnoId || null;
  const ultima = [...mensajes].reverse().find((m) => m.rol === "user")?.texto || "";

  // Contexto: alumnos del coach, últimas sesiones y material de la firma.
  let consultaAlumnos = db.from("alumnos").select("nombre, empresa, reto").eq("activo", true).limit(20);
  if (usuario.rol !== "admin") consultaAlumnos = consultaAlumnos.eq("coach_id", usuario.id);

  let consultaSesiones = db
    .from("sesiones")
    .select("fecha, resumen_ejecutivo, nota_coach, alumnos(nombre)")
    .order("fecha", { ascending: false })
    .limit(10);
  if (usuario.rol !== "admin") consultaSesiones = consultaSesiones.eq("coach_id", usuario.id);
  if (alumnoId) consultaSesiones = consultaSesiones.eq("alumno_id", alumnoId);

  const [{ data: alumnos }, { data: sesiones }, material] = await Promise.all([
    consultaAlumnos,
    consultaSesiones,
    buscarMaterial(ultima),
  ]);

  const lineas: string[] = [
    `COACH: ${usuario.nombre} (${usuario.rol})`,
    "",
    "SUS ALUMNOS:",
    ...(alumnos ?? []).map((a) => `- ${a.nombre}${a.empresa ? ` · ${a.empresa}` : ""}${a.reto ? ` · proyecto: ${a.reto}` : ""}`),
    "",
    alumnoId ? "SESIONES DE ESTE ALUMNO:" : "SESIONES RECIENTES:",
    ...(sesiones ?? []).map(
      (s) =>
        `- ${s.fecha} · ${(s.alumnos as unknown as { nombre?: string } | null)?.nombre ?? "sesión"}: ${recortar(
          s.resumen_ejecutivo || "sin resumen",
          320
        )}`
    ),
    "",
    "MATERIAL DE LA FIRMA (fragmentos relevantes):",
    ...(material.length
      ? material.map((m) => `- [${m.tipo}] ${m.titulo}: ${recortar(m.fragmento, 700)}`)
      : ["(sin resultados para esta pregunta)"]),
  ];

  // Memoria: lo que ya se habló con este alumno (o en el chat general).
  if (alumnoId) {
    const { data: previos } = await db
      .from("chat_mensajes")
      .select("rol, texto")
      .eq("alumno_id", alumnoId)
      .order("creado_en", { ascending: false })
      .limit(12);

    if (previos?.length) {
      lineas.push("", "CONVERSACIÓN PREVIA CON ESTE ALUMNO (lo más reciente al final):");
      for (const m of [...previos].reverse()) {
        lineas.push(`${m.rol === "user" ? "Coach" : "Agente"}: ${recortar(m.texto, 400)}`);
      }
    }
  }

  // Guarda el mensaje del coach (si la tabla existe).
  try {
    await db.from("chat_mensajes").insert({
      coach_id: usuario.id,
      alumno_id: alumnoId,
      rol: "user",
      texto: ultima.slice(0, 4000),
    });
  } catch {
    /* sin memoria disponible */
  }

  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODELO_CHAT || "deepseek-flash",
      temperature: 0.3,
      stream: true,
      messages: [
        { role: "system", content: SISTEMA },
        { role: "system", content: `CONTEXTO ACTUAL:\n${lineas.join("\n")}` },
        ...mensajes.map((m) => ({ role: m.rol, content: m.texto })),
      ],
    }),
  });

  if (!r.ok || !r.body) {
    return NextResponse.json({ error: `agente_${r.status}` }, { status: 502 });
  }

  const lector = r.body.getReader();
  const decodificador = new TextDecoder();
  const codificador = new TextEncoder();
  let pendiente = "";

  const flujo = new ReadableStream({
    async start(control) {
      let completo = "";
      try {
        for (;;) {
          const { done, value } = await lector.read();
          if (done) break;
          pendiente += decodificador.decode(value, { stream: true });
          const partes = pendiente.split("\n\n");
          pendiente = partes.pop() || "";

          for (const parte of partes) {
            const linea = parte.split("\n").find((l) => l.startsWith("data: "));
            if (!linea) continue;
            const dato = linea.slice(6).trim();
            if (dato === "[DONE]") {
              control.close();
              return;
            }
            try {
              const j = JSON.parse(dato) as { choices?: { delta?: { content?: string } }[] };
              const trozo = j.choices?.[0]?.delta?.content;
              if (trozo) {
                completo += trozo;
                control.enqueue(codificador.encode(trozo));
              }
            } catch {
              /* fragmento incompleto: se ignora */
            }
          }
        }
        control.close();
      } catch {
        control.close();
      } finally {
        if (completo.trim()) {
          try {
            await db.from("chat_mensajes").insert({
              coach_id: usuario.id,
              alumno_id: alumnoId,
              rol: "assistant",
              texto: completo.slice(0, 8000),
            });
          } catch {
            /* sin memoria disponible */
          }
        }
      }
    },
    cancel() {
      void lector.cancel();
    },
  });

  return new Response(flujo, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
