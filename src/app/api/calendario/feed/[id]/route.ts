import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { construirCalendario } from "@/lib/ics";
import { tokenValido } from "@/lib/token";

/**
 * Liga de calendario de un coach. Google Calendar la consulta sin sesión:
 * la autorización es el token firmado de la URL.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(_req.url).searchParams.get("t") || "";

  if (!tokenValido(id, token)) {
    return NextResponse.json({ error: "no_existe" }, { status: 404 });
  }

  const { data: coach } = await db
    .from("coaches")
    .select("id, nombre, email, activo")
    .eq("id", id)
    .maybeSingle();

  if (!coach || coach.activo === false) {
    return NextResponse.json({ error: "no_existe" }, { status: 404 });
  }

  const { data: sesiones } = await db
    .from("sesiones")
    .select("id, fecha, hora, duracion_min, tipo, zoom_url, alumnos(nombre)")
    .eq("coach_id", id)
    .order("fecha", { ascending: true })
    .limit(500);

  const eventos = (sesiones ?? []).map((s) => {
    const alumno = s.alumnos as unknown as { nombre?: string } | null;
    return {
      id: s.id,
      titulo: alumno?.nombre ? `Coaching · ${alumno.nombre}` : "Sesión CEDEM",
      fecha: s.fecha,
      hora: s.hora,
      duracionMin: s.duracion_min,
      lugar: s.zoom_url || null,
      descripcion: [s.zoom_url ? `Liga de Zoom: ${s.zoom_url}` : "", "Sesión del Máster Euncet."]
        .filter(Boolean)
        .join("\n"),
      organizador: { nombre: coach.nombre, email: coach.email },
    };
  });

  const ics = construirCalendario(eventos, `CEDEM · ${coach.nombre}`);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="cedem.ics"',
      "Cache-Control": "public, max-age=900",
    },
  });
}
