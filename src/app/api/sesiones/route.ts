import { NextResponse } from "next/server";
import { procesarSesion } from "@/lib/ingesta";
import { usuarioActual } from "@/lib/sesion";

export const maxDuration = 60;

export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "Tu sesión venció. Vuelve a entrar." }, { status: 401 });
  }

  try {
    const formulario = await req.formData();
    const archivo = formulario.get("archivo");
    const alumnoId = String(formulario.get("alumnoId") || "");
    const fecha = String(formulario.get("fecha") || new Date().toISOString().slice(0, 10));

    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: "No llegó el archivo. Intenta de nuevo." }, { status: 400 });
    }

    const r = await procesarSesion({ usuario, alumnoId, fecha, archivo });

    if (!r.ok) {
      return NextResponse.json({ error: r.error, codigo: r.codigo }, { status: 400 });
    }

    return NextResponse.json(r);
  } catch (e) {
    console.error("[subir sesión] fallo inesperado:", e);
    return NextResponse.json(
      { error: "Algo falló al procesar el archivo. Intenta de nuevo o sube la transcripción en texto." },
      { status: 500 }
    );
  }
}
