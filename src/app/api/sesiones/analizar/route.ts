import { NextResponse } from "next/server";
import { analizarGuardada } from "@/lib/ingesta";
import { usuarioActual } from "@/lib/sesion";

export const maxDuration = 60;

/** Analiza una sesión ya guardada. Va aparte para no mezclarlo con la subida. */
export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  try {
    const { sesionId } = (await req.json()) as { sesionId?: string };
    if (!sesionId) return NextResponse.json({ error: "Falta la sesión." }, { status: 400 });

    const r = await analizarGuardada({ usuario, sesionId });
    if (!r.ok) return NextResponse.json({ error: r.error, codigo: r.codigo }, { status: 400 });

    return NextResponse.json(r);
  } catch (e) {
    console.error("[analizar] fallo:", e);
    return NextResponse.json({ error: "El agente no pudo analizar. Intenta de nuevo." }, { status: 500 });
  }
}
