import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";
import { fichaDOCX, minutaPDF, presentacionPPTX } from "@/lib/documentos";

const FORMATOS = ["minuta", "ficha", "presentacion"] as const;
type Formato = (typeof FORMATOS)[number];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; formato: string }> }
) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });

  const { id, formato } = await params;
  if (!FORMATOS.includes(formato as Formato)) {
    return NextResponse.json({ error: "formato_no_valido" }, { status: 400 });
  }

  const { data: sesion } = await db
    .from("sesiones")
    .select("id, fecha, coach_id, alumno_id, resumen_ejecutivo, nota_coach, alumnos(id, nombre, empresa, cargo, reto)")
    .eq("id", id)
    .maybeSingle();

  if (!sesion) return NextResponse.json({ error: "no_existe" }, { status: 404 });
  if (usuario.rol !== "admin" && sesion.coach_id !== usuario.id) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  const alumno = sesion.alumnos as unknown as {
    id: string;
    nombre: string;
    empresa: string | null;
    cargo: string | null;
    reto: string | null;
  } | null;

  const base = { fecha: sesion.fecha, resumen_ejecutivo: sesion.resumen_ejecutivo, nota_coach: sesion.nota_coach };
  const coach = { nombre: usuario.nombre, email: usuario.email };
  const nombreArchivo = `cedem-${(alumno?.nombre || "sesion").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  if (formato === "minuta") {
    const [{ data: hallazgos }, { data: compromisos }] = await Promise.all([
      db.from("hallazgos").select("titulo, detalle, cita").eq("sesion_id", id),
      db.from("compromisos").select("texto, responsable, fecha").eq("sesion_id", id),
    ]);

    const pdf = await minutaPDF({
      alumno: alumno ?? { nombre: "Alumno" },
      sesion: base,
      coach,
      hallazgos: hallazgos ?? [],
      compromisos: compromisos ?? [],
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivo}-minuta.pdf"`,
      },
    });
  }

  if (formato === "ficha") {
    if (!alumno) return NextResponse.json({ error: "sesion_sin_alumno" }, { status: 400 });

    const [{ data: sesiones }, { data: compromisos }] = await Promise.all([
      db
        .from("sesiones")
        .select("fecha, resumen_ejecutivo, nota_coach")
        .eq("alumno_id", alumno.id)
        .order("fecha", { ascending: false })
        .limit(6),
      db
        .from("compromisos")
        .select("texto, responsable, fecha")
        .eq("alumno_id", alumno.id)
        .eq("estado", "abierto")
        .limit(12),
    ]);

    const docx = await fichaDOCX({
      alumno,
      coach,
      sesiones: sesiones ?? [],
      compromisos: compromisos ?? [],
    });

    return new NextResponse(new Uint8Array(docx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${nombreArchivo}-ficha.docx"`,
      },
    });
  }

  // Presentación: los casos recientes del coach (o del alumno de esta sesión).
  const { data: recientes } = await db
    .from("sesiones")
    .select("id, fecha, resumen_ejecutivo, nota_coach, alumno_id, alumnos(nombre, empresa, cargo, reto)")
    .eq("coach_id", sesion.coach_id)
    .order("fecha", { ascending: false })
    .limit(5);

  const casos = [];
  for (const s of recientes ?? []) {
    const { data: hs } = await db.from("hallazgos").select("titulo, detalle, cita").eq("sesion_id", s.id).limit(4);
    casos.push({
      alumno: (s.alumnos as unknown as { nombre: string; empresa: string | null; cargo: string | null; reto: string | null }) ?? {
        nombre: "Alumno",
      },
      sesion: { fecha: s.fecha, resumen_ejecutivo: s.resumen_ejecutivo, nota_coach: s.nota_coach },
      hallazgos: hs ?? [],
    });
  }

  const pptx = await presentacionPPTX({ coach, casos });

  return new NextResponse(new Uint8Array(pptx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="cedem-junta-tecnica.pptx"`,
    },
  });
}
