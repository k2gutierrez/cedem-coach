import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/sesion";

/** Descarga un archivo de monday sin exponer el token ni la liga firmada. */
export async function GET(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const destino = searchParams.get("url") || "";
  const nombre = searchParams.get("nombre") || "archivo";

  let url: URL;
  try {
    url = new URL(destino);
  } catch {
    return NextResponse.json({ error: "Liga inválida." }, { status: 400 });
  }

  // Solo archivos servidos por monday: evita que la ruta descargue de cualquier sitio.
  const permitido = url.protocol === "https:" && /(^|\.)monday\.com$/i.test(url.hostname);
  if (!permitido) return NextResponse.json({ error: "Esa liga no es de monday." }, { status: 400 });

  const r = await fetch(url, {
    headers: process.env.MONDAY_API_TOKEN ? { Authorization: process.env.MONDAY_API_TOKEN } : {},
    cache: "no-store",
  });

  if (!r.ok || !r.body) {
    return NextResponse.json({ error: `monday no entregó el archivo (${r.status}).` }, { status: 502 });
  }

  return new NextResponse(r.body, {
    headers: {
      "Content-Type": r.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nombre.replace(/["\\]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
