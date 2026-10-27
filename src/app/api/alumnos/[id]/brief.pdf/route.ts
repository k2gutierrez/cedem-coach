import { NextResponse } from "next/server";
import { briefPDF } from "@/lib/documentos";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });

  const { id } = await params;

  const { data: alumno } = await db
    .from("alumnos")
    .select("id, nombre, empresa, cargo, coach_id, brief, brief_fuentes")
    .eq("id", id)
    .maybeSingle();

  if (!alumno) return NextResponse.json({ error: "no_existe" }, { status: 404 });
  if (usuario.rol !== "admin" && alumno.coach_id !== usuario.id) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }
  if (!alumno.brief) return NextResponse.json({ error: "sin_brief" }, { status: 404 });

  const fuentes = (alumno.brief_fuentes ?? []) as { titulo: string; url: string }[];

  const pdf = await briefPDF({
    alumno,
    coach: { nombre: usuario.nombre, email: usuario.email },
    texto: alumno.brief,
    fuentes,
  });

  const slug = alumno.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="brief-${slug}.pdf"`,
    },
  });
}
