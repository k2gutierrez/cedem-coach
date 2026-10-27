import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";

/** Estado del análisis de una sesión. Sirve para consultar sin relanzar el trabajo. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });

  const { id } = await params;

  const { data: sesion } = await db
    .from("sesiones")
    .select("coach_id, resumen_ejecutivo, estado")
    .eq("id", id)
    .maybeSingle();

  if (!sesion) return NextResponse.json({ error: "no_existe" }, { status: 404 });
  if (usuario.rol !== "admin" && sesion.coach_id !== usuario.id) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  return NextResponse.json({
    analizada: Boolean(sesion.resumen_ejecutivo),
    estado: sesion.estado,
  });
}
