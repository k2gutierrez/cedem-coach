import { NextResponse } from "next/server";
import { ajustarMinuta } from "@/lib/ajuste";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";

export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const { id } = await params;

  const { data: sesion } = await db.from("sesiones").select("coach_id").eq("id", id).maybeSingle();
  if (!sesion) return NextResponse.json({ error: "Esa sesión no existe." }, { status: 404 });
  if (usuario.rol !== "admin" && sesion.coach_id !== usuario.id) {
    return NextResponse.json({ error: "Esa sesión no es tuya." }, { status: 403 });
  }

  const r = await ajustarMinuta(id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  return NextResponse.json({ ok: true, minuta: r.minuta });
}
