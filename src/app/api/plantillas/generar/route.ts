import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";
import { generarDesdePlantilla, plantillaPorId } from "@/lib/plantillas";

export const maxDuration = 30;

export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const { plantillaId, alumnoId } = (await req.json().catch(() => ({}))) as {
    plantillaId?: string;
    alumnoId?: string;
  };

  if (!plantillaId || !alumnoId) {
    return NextResponse.json({ error: "Falta la plantilla o el alumno." }, { status: 400 });
  }

  const { data: alumno } = await db
    .from("alumnos")
    .select("id, nombre, empresa, cargo, ciudad, giro, reto, brief, coach_id")
    .eq("id", alumnoId)
    .maybeSingle();

  if (!alumno) return NextResponse.json({ error: "Ese alumno no existe." }, { status: 404 });
  if (usuario.rol !== "admin" && alumno.coach_id !== usuario.id) {
    return NextResponse.json({ error: "Ese alumno no es tuyo." }, { status: 403 });
  }

  const plantilla = await plantillaPorId(plantillaId);
  if (!plantilla || !plantilla.activo) {
    return NextResponse.json({ error: "Esa plantilla no está disponible." }, { status: 404 });
  }

  const [{ data: sesiones }, { data: compromisos }, { data: tareas }] = await Promise.all([
    db
      .from("sesiones")
      .select("fecha, resumen_ejecutivo, minuta_ajustada")
      .eq("alumno_id", alumnoId)
      .eq("estado", "realizada")
      .order("fecha", { ascending: false })
      .limit(6),
    db.from("compromisos").select("texto").eq("alumno_id", alumnoId).eq("estado", "abierto").limit(20),
    db.from("tareas").select("titulo").limit(20),
  ]);

  const { data: coach } = await db
    .from("coaches")
    .select("nombre")
    .eq("id", alumno.coach_id)
    .maybeSingle();

  const r = await generarDesdePlantilla(plantilla, {
    alumno: alumno.nombre,
    empresa: alumno.empresa,
    cargo: alumno.cargo,
    ciudad: alumno.ciudad,
    giro: alumno.giro,
    reto: alumno.reto,
    coach: coach?.nombre ?? null,
    sesiones: (sesiones ?? []).map((s) => ({
      fecha: s.fecha,
      resumen:
        (s.minuta_ajustada as { resumen?: string } | null)?.resumen || s.resumen_ejecutivo || "sin resumen",
    })),
    compromisos: (compromisos ?? []).map((c) => c.texto),
    tareas: (tareas ?? []).map((t) => t.titulo),
    brief: alumno.brief,
  });

  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });

  return NextResponse.json({ ok: true, texto: r.texto, titulo: plantilla.nombre });
}
