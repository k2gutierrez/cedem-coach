import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";

/** Marca (o desmarca) una tarea de aplicación desde el chat. */
export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const { tareaId, alumnoId, hecha = true } = (await req.json()) as {
    tareaId?: string;
    alumnoId?: string;
    hecha?: boolean;
  };

  if (!tareaId || !alumnoId) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });

  const { data: alumno } = await db
    .from("alumnos")
    .select("id, coach_id")
    .eq("id", alumnoId)
    .maybeSingle();

  if (!alumno) return NextResponse.json({ error: "Ese alumno no existe." }, { status: 404 });
  if (usuario.rol !== "admin" && alumno.coach_id !== usuario.id) {
    return NextResponse.json({ error: "Ese alumno no es tuyo." }, { status: 403 });
  }

  // Se cuelga de la última sesión realizada del alumno.
  const { data: sesion } = await db
    .from("sesiones")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("estado", "realizada")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sesion) {
    return NextResponse.json(
      { error: "Todavía no hay una sesión realizada de este alumno donde registrar la tarea." },
      { status: 400 }
    );
  }

  const { error } = await db.from("tarea_sesion").upsert(
    {
      tarea_id: tareaId,
      sesion_id: sesion.id,
      abordada: hecha,
      evidencia: "Marcada por el coach en el chat.",
      corregido_por: usuario.id,
    },
    { onConflict: "tarea_id,sesion_id" }
  );

  if (error) return NextResponse.json({ error: `No se pudo guardar: ${error.message}` }, { status: 500 });

  return NextResponse.json({ ok: true });
}
