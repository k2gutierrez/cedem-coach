import { NextResponse } from "next/server";
import { db, BUCKET } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";

export const maxDuration = 30;

const LIMITE = 50 * 1024 * 1024; // 50 MB

/**
 * Devuelve una URL firmada para que el navegador suba el archivo directo a
 * Supabase Storage, sin pasar por la función del servidor (que tiene un
 * límite de tamaño mucho menor).
 */
export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  try {
    const { nombre, bytes, mime, alumnoId } = (await req.json()) as {
      nombre?: string;
      bytes?: number;
      mime?: string;
      alumnoId?: string;
    };

    if (!alumnoId) return NextResponse.json({ error: "Falta el alumno." }, { status: 400 });
    if (!nombre) return NextResponse.json({ error: "Falta el nombre del archivo." }, { status: 400 });
    if (!bytes || bytes > LIMITE) {
      return NextResponse.json({ error: "El archivo pasa de 50 MB." }, { status: 413 });
    }

    // El bucket debe permitir archivos de este tamaño (idempotente).
    try {
      await db.storage.updateBucket(BUCKET, { fileSizeLimit: LIMITE, public: false });
    } catch {
      /* si no se puede cambiar, se intenta igual */
    }

    const limpio = nombre.replace(/[^\w.\-áéíóúñ ]/gi, "_").slice(-80);
    const ruta = `${usuario.id}/${Date.now()}-${limpio}`;

    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(ruta);
    if (error || !data) {
      console.error("[firma] no se pudo firmar:", error);
      return NextResponse.json({ error: "No se pudo preparar la subida." }, { status: 500 });
    }

    return NextResponse.json({
      ruta,
      url: data.signedUrl,
      token: data.token,
      mime: mime || "application/octet-stream",
    });
  } catch (e) {
    console.error("[firma] fallo:", e);
    return NextResponse.json({ error: "No se pudo preparar la subida." }, { status: 500 });
  }
}
