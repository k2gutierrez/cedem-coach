import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { construirICS } from "@/lib/ics";
import { usuarioActual } from "@/lib/sesion";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });

  const { id } = await params;

  const { data: sesion } = await db
    .from("sesiones")
    .select("id, fecha, hora, duracion_min, tipo, coach_id, zoom_url, alumnos(nombre, empresa)")
    .eq("id", id)
    .maybeSingle();

  if (!sesion) return NextResponse.json({ error: "no_existe" }, { status: 404 });
  if (usuario.rol !== "admin" && sesion.coach_id !== usuario.id) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  const alumno = (sesion.alumnos as unknown as { nombre: string; empresa: string | null } | null) ?? null;
  const titulo = alumno
    ? `Coaching · ${alumno.nombre}`
    : sesion.tipo === "consejo"
      ? "Consejo CEDEM"
      : "Sesión CEDEM";

  const ics = construirICS({
    id: sesion.id,
    titulo,
    fecha: sesion.fecha,
    hora: sesion.hora,
    duracionMin: sesion.duracion_min,
    lugar: sesion.zoom_url || null,
    descripcion: [
      "Sesión del Máster Euncet.",
      sesion.zoom_url ? `Liga de Zoom: ${sesion.zoom_url}` : "",
      "Fecha y hora en tu zona horaria local.",
    ]
      .filter(Boolean)
      .join("\n"),
    organizador: { nombre: usuario.nombre, email: usuario.email },
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="cedem-${sesion.fecha}.ics"`,
    },
  });
}
