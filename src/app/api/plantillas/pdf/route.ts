import { NextResponse } from "next/server";
import { textoPDF } from "@/lib/documentos";
import { usuarioActual } from "@/lib/sesion";

export const maxDuration = 30;

export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const { titulo, texto } = (await req.json().catch(() => ({}))) as { titulo?: string; texto?: string };
  if (!texto?.trim()) return NextResponse.json({ error: "No hay texto para el documento." }, { status: 400 });
  if (texto.length > 60_000) {
    return NextResponse.json({ error: "El documento es demasiado largo." }, { status: 413 });
  }

  const bytes = await textoPDF(titulo || "Documento", texto);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${(titulo || "documento").replace(/[^\w\- ]/g, "")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
