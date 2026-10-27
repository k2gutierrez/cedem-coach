import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";
import { tareasConCobertura } from "@/lib/datos";
import { fragmentosDeTranscripcion } from "@/lib/retrieval";

export const maxDuration = 60;

type Mensaje = { rol: "user" | "assistant"; texto: string };

const SISTEMA = `Eres el agente de CEDEM (Centro de Dueñez Empresaria), una firma mexicana que
acompaña a dueños de empresa y sus familias. Le hablas a un coach del Máster, no al alumno.

Reglas:
- Responde en español de México, claro y breve (máximo 8 líneas salvo que pidan detalle).
- Usa solo la información del contexto. Si no está, dilo y sugiere qué subir o revisar.
- Cita de dónde sale: "según la sesión del 12 de octubre" o "según el material: Clase 3".
- Cuando la pregunta sea sobre algo que se dijo en una sesión, usa los FRAGMENTOS TEXTUALES de las
  transcripciones que van en el contexto y cítalos. Si el dato no aparece ahí, di que no lo
  encontraste en lo consultado; nunca digas que el texto "está truncado".
- No inventes datos de alumnos ni cifras.
- Cuando te pregunten qué hacer, propón 2 o 3 acciones concretas y deja la decisión al coach.
- Si el coach te corrige o te da información nueva del caso, acéptala y tenla en cuenta en lo que
  sigue de la conversación; en la app sus correcciones se aplican a la minuta con un botón.
- Si te piden un documento, di dónde generarlo.
- Cuando el coach te pida ACTUALIZAR la minuta del caso (corregir, agregar o quitar algo de una
  sesión), además de responder, agrega al final una línea sola con exactamente: [[ACCION:minuta]]
  No la agregues si solo están conversando o preguntando.`;

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


/** Normaliza para comparar: minúsculas y sin acentos. */
function plano(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detecta si el coach dijo que una tarea ya se hizo. Es determinista a propósito:
 * no dependemos de que el modelo se acuerde de poner el marcador.
 */
function tareasQueSeHicieron(mensaje: string, tareas: { id: string; titulo: string }[]): string[] {
  const texto = plano(mensaje);
  const hayIntencion = /(ya (se )?(hizo|entrego|cumplio|termino|acabo|quedo|mando|envio)|marca(r)? como (hecha|completada|cumplida)|tarea (hecha|completada|cumplida)|ya la (hizo|entrego|cumplio))/.test(
    texto
  );
  if (!hayIntencion) return [];

  const encontradas: string[] = [];
  for (const t of tareas) {
    const palabras = plano(t.titulo)
      .split(" ")
      .filter((p) => p.length > 4);
    if (!palabras.length) continue;
    const coincidencias = palabras.filter((p) => texto.includes(p)).length;
    if (coincidencias >= Math.min(2, palabras.length)) encontradas.push(t.id);
  }
  return encontradas;
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

  let tareasParaMarcar: string[] = [];

  // Memoria: lo que ya se habló con este alumno (o en el chat general).
  if (alumnoId) {
    const { data: previos } = await db
      .from("chat_mensajes")
      .select("rol, texto")
      .eq("alumno_id", alumnoId)
      .order("creado_en", { ascending: false })
      .limit(6);

    const { data: ultimaSesion } = await db
      .from("sesiones")
      .select("id, fecha")
      .eq("alumno_id", alumnoId)
      .eq("estado", "realizada")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaSesion) {
      lineas.push("", `SESIÓN MÁS RECIENTE DEL ALUMNO: ${ultimaSesion.fecha} (id ${ultimaSesion.id})`);
    }

    const fragmentos = await fragmentosDeTranscripcion(alumnoId, ultima, 4);
    if (fragmentos.length) {
      lineas.push("", "FRAGMENTOS TEXTUALES DE LAS TRANSCRIPCIONES:");
      for (const f of fragmentos) {
        lineas.push(`— Sesión del ${f.fecha}:`);
        lineas.push(f.texto);
        lineas.push("");
      }
    }

    const tareas = await tareasConCobertura(alumnoId);
    if (tareas.length) {
      lineas.push("", "TAREAS DE APLICACIÓN (id: título — estado):");
      for (const t of tareas.slice(0, 20)) {
        lineas.push(`- ${t.id}: ${t.titulo} — ${t.abordada ? "marcada" : "pendiente"}`);
      }
      tareasParaMarcar = tareasQueSeHicieron(ultima, tareas).filter(
        (id) => !tareas.find((t) => t.id === id)?.abordada
      );
    }

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
              if (tareasParaMarcar.length) {
                control.enqueue(
                  codificador.encode(
                    `\n${tareasParaMarcar.map((id) => `[[TAREA:${id}]]`).join("\n")}`
                  )
                );
              }
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
        const limpio = completo.replace(/\[\[ACCION:[a-z]+\]\]/gi, "").trim();

        if (limpio) {
          try {
            await db.from("chat_mensajes").insert({
              coach_id: usuario.id,
              alumno_id: alumnoId,
              rol: "assistant",
              texto: limpio.slice(0, 8000),
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
