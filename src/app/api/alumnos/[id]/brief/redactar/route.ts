import { NextResponse } from "next/server";
import { redactarBrief } from "@/lib/brief";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";

export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const { id } = await params;
  const { data: alumno } = await db.from("alumnos").select("coach_id").eq("id", id).maybeSingle();
  if (!alumno) return NextResponse.json({ error: "Ese alumno no existe." }, { status: 404 });
  if (usuario.rol !== "admin" && alumno.coach_id !== usuario.id) {
    return NextResponse.json({ error: "Ese alumno no es tuyo." }, { status: 403 });
  }

  const cuerpo = (await req.json().catch(() => ({}))) as {
    hechos?: string;
    fuentes?: { titulo: string; url: string }[];
  };

  const r = await redactarBrief(id, String(cuerpo.hechos || ""), cuerpo.fuentes ?? []);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  return NextResponse.json({ ok: true, caracteres: r.brief.texto.length });
}
