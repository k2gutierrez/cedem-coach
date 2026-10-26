import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";

export const maxDuration = 60;

type Minuta = {
  resumen: string;
  nota: string;
  hallazgos: { titulo: string; detalle: string; cita?: string }[];
  compromisos: { texto: string; responsable?: string; fecha?: string | null }[];
};

const SISTEMA = `Recibes la minuta de una sesión de coaching y la conversación que el coach tuvo
con el asistente. Devuelve la minuta corregida.

Reglas:
- Incorpora TODA corrección o dato nuevo que el coach haya dicho (nombres, cifras, tareas,
  compromisos, hechos mal entendidos).
- No inventes nada que no esté en la conversación o en la minuta original.
- Mantén el mismo formato: resumen, nota, hallazgos y compromisos.
- Devuelve SOLO JSON válido, sin texto adicional.`;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "Falta la llave de DeepSeek." }, { status: 500 });
  }

  const { id } = await params;

  const { data: sesion } = await db
    .from("sesiones")
    .select("id, coach_id, alumno_id, fecha, resumen_ejecutivo, nota_coach")
    .eq("id", id)
    .maybeSingle();

  if (!sesion) return NextResponse.json({ error: "Esa sesión no existe." }, { status: 404 });
  if (usuario.rol !== "admin" && sesion.coach_id !== usuario.id) {
    return NextResponse.json({ error: "Esa sesión no es tuya." }, { status: 403 });
  }

  const [{ data: hallazgos }, { data: compromisos }, { data: chat }] = await Promise.all([
    db.from("hallazgos").select("titulo, detalle, cita").eq("sesion_id", id),
    db.from("compromisos").select("texto, responsable, fecha").eq("sesion_id", id),
    db
      .from("chat_mensajes")
      .select("rol, texto")
      .eq("alumno_id", sesion.alumno_id)
      .order("creado_en", { ascending: false })
      .limit(14),
  ]);

  const conversacion = (chat ?? [])
    .reverse()
    .map((m) => `${m.rol === "user" ? "Coach" : "Agente"}: ${m.texto}`)
    .join("\n");

  if (!conversacion.trim()) {
    return NextResponse.json(
      { error: "Todavía no hay conversación sobre este alumno. Dile al agente qué corregir y vuelve a intentar." },
      { status: 400 }
    );
  }

  const minutaActual: Minuta = {
    resumen: sesion.resumen_ejecutivo ?? "",
    nota: sesion.nota_coach ?? "",
    hallazgos: (hallazgos ?? []).map((h) => ({
      titulo: h.titulo,
      detalle: h.detalle ?? "",
      ...(h.cita ? { cita: h.cita } : {}),
    })),
    compromisos: (compromisos ?? []).map((c) => ({
      texto: c.texto,
      ...(c.responsable ? { responsable: c.responsable } : {}),
      fecha: c.fecha ?? null,
    })),
  };

  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODELO_CHAT || "deepseek-flash",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SISTEMA },
        {
          role: "user",
          content: `FECHA DE LA SESIÓN: ${sesion.fecha}\n\nMINUTA ACTUAL:\n${JSON.stringify(
            minutaActual,
            null,
            2
          )}\n\nCONVERSACIÓN CON EL COACH:\n${conversacion}`,
        },
      ],
    }),
  });

  if (!r.ok) return NextResponse.json({ error: `El agente no respondió (${r.status}).` }, { status: 502 });

  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  let ajustada: Minuta;
  try {
    ajustada = JSON.parse(j.choices?.[0]?.message?.content || "{}");
  } catch {
    return NextResponse.json({ error: "El agente devolvió algo ilegible." }, { status: 500 });
  }

  // Limpieza: el modelo a veces escribe frases en el campo de fecha.
  ajustada.compromisos = (ajustada.compromisos ?? []).map((c) => ({
    texto: String(c.texto ?? "").slice(0, 300),
    ...(c.responsable ? { responsable: String(c.responsable).slice(0, 80) } : {}),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(c.fecha ?? "")) ? String(c.fecha) : null,
  }));

  const { error } = await db.from("sesiones").update({ minuta_ajustada: ajustada }).eq("id", id);
  if (error) return NextResponse.json({ error: `No se pudo guardar: ${error.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, minuta: ajustada });
}
