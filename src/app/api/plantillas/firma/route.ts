import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";
import { generarDocumentoFirma, plantillaPorId } from "@/lib/plantillas";
import { buscarMaterial } from "@/lib/material";
import { limitar } from "@/lib/limites";

export const maxDuration = 30;

export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "Solo la coordinación genera documentos de la firma." }, { status: 403 });
  }

  const cupo = await limitar(`firma:${usuario.id}`, 20, 60);
  if (!cupo.ok) {
    return NextResponse.json(
      { error: `Llegaste al límite de documentos por hora. Intenta en ${cupo.minutos} minutos.` },
      { status: 429 }
    );
  }

  const { plantillaId, tema } = (await req.json().catch(() => ({}))) as {
    plantillaId?: string;
    tema?: string;
  };

  if (!plantillaId) return NextResponse.json({ error: "Falta la plantilla." }, { status: 400 });

  const plantilla = await plantillaPorId(plantillaId);
  if (!plantilla || !plantilla.activo) {
    return NextResponse.json({ error: "Esa plantilla no está disponible." }, { status: 404 });
  }

  // Material: por el tema si lo hay; si no, lo más reciente de la firma.
  let material = tema ? await buscarMaterial(tema) : [];

  if (!material.length) {
    const { data } = await db
      .from("material_fragmentos")
      .select("texto, material:material_id(titulo, tipo)")
      .order("id", { ascending: false })
      .limit(12);

    material = (data ?? []).map((d) => {
      const fila = d as { texto?: string; material?: { titulo?: string; tipo?: string } | null };
      return {
        titulo: fila.material?.titulo ?? "Material de la firma",
        tipo: fila.material?.tipo ?? "documento",
        fragmento: String(fila.texto ?? ""),
      };
    });
  }

  const r = await generarDocumentoFirma(plantilla, String(tema || ""), material);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });

  return NextResponse.json({
    ok: true,
    texto: r.texto,
    titulo: tema ? `${plantilla.nombre} · ${tema}` : plantilla.nombre,
    fragmentos: material.length,
  });
}
