import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { usuarioActual } from "@/lib/sesion";
import { fichaCortaDOCX, minutaDOCX, minutaPDF, presentacionPPTX } from "@/lib/documentos";

const FORMATOS = ["minuta", "minuta-word", "ficha", "presentacion"] as const;
type Formato = (typeof FORMATOS)[number];

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

async function tareasDeSesion(sesionId: string) {
  const { data } = await db
    .from("tarea_sesion")
    .select("abordada, tareas(titulo)")
    .eq("sesion_id", sesionId);

  return ((data ?? []) as unknown as { abordada: boolean; tareas: { titulo: string } | null }[]).map((t) => ({
    titulo: t.tareas?.titulo ?? "Tarea",
    abordada: t.abordada,
  }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; formato: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });

  const { id, formato } = await params;
  if (!FORMATOS.includes(formato as Formato)) {
    return NextResponse.json({ error: "formato_no_valido" }, { status: 400 });
  }

  const { data: sesion } = await db
    .from("sesiones")
    .select("id, fecha, coach_id, alumno_id, resumen_ejecutivo, nota_coach, minuta_ajustada, alumnos(id, nombre, empresa, cargo, reto)")
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

  type Ajustada = {
    resumen?: string;
    nota?: string;
    hallazgos?: { titulo: string; detalle: string; cita?: string }[];
    compromisos?: { texto: string; responsable?: string; fecha?: string | null }[];
  };
  const ajustada = (sesion.minuta_ajustada ?? null) as Ajustada | null;

  const base = {
    fecha: sesion.fecha,
    resumen_ejecutivo: ajustada?.resumen ?? sesion.resumen_ejecutivo,
    nota_coach: ajustada?.nota ?? sesion.nota_coach,
  };
  const coach = { nombre: usuario.nombre, email: usuario.email };
  const slug = (alumno?.nombre || "sesion").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  if (formato === "minuta" || formato === "minuta-word") {
    const [{ data: hallazgos }, { data: compromisos }, tareas] = await Promise.all([
      db.from("hallazgos").select("titulo, detalle, cita").eq("sesion_id", id),
      db.from("compromisos").select("texto, responsable, fecha").eq("sesion_id", id),
      tareasDeSesion(id),
    ]);

    if (formato === "minuta-word") {
      const docx = await minutaDOCX({
        alumno: alumno ?? { nombre: "Alumno" },
        sesion: base,
        coach,
        hallazgos: ajustada?.hallazgos ?? hallazgos ?? [],
        compromisos: ajustada?.compromisos ?? compromisos ?? [],
        tareas,
      });
      return new NextResponse(new Uint8Array(docx), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${slug}-minuta-${sesion.fecha}.docx"`,
        },
      });
    }

    const pdf = await minutaPDF({
      alumno: alumno ?? { nombre: "Alumno" },
      sesion: base,
      coach,
      hallazgos: ajustada?.hallazgos ?? hallazgos ?? [],
      compromisos: ajustada?.compromisos ?? compromisos ?? [],
      tareas,
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}-minuta-${sesion.fecha}.pdf"`,
      },
    });
  }

  if (formato === "ficha") {
    if (!alumno) return NextResponse.json({ error: "sesion_sin_alumno" }, { status: 400 });

    const [{ data: sesiones }, { data: compromisos }, tareas] = await Promise.all([
      db
        .from("sesiones")
        .select("fecha, resumen_ejecutivo, nota_coach, estado")
        .eq("alumno_id", alumno.id)
        .order("fecha", { ascending: false })
        .limit(10),
      db
        .from("compromisos")
        .select("texto, fecha, estado")
        .eq("alumno_id", alumno.id)
        .order("creado_en", { ascending: false })
        .limit(20),
      (async () => {
        const { data: t } = await db
          .from("tareas")
          .select("id, titulo")
          .order("creado_en", { ascending: false })
          .limit(30);
        const { data: c } = await db
          .from("tarea_sesion")
          .select("tarea_id, abordada, sesiones!inner(alumno_id)")
          .eq("sesiones.alumno_id", alumno.id);
        const hechas = new Set(
          ((c ?? []) as unknown as { tarea_id: string; abordada: boolean }[]).filter((x) => x.abordada).map((x) => x.tarea_id)
        );
        return (t ?? []).map((x) => ({ titulo: x.titulo, abordada: hechas.has(x.id) }));
      })(),
    ]);

    const docx = await fichaCortaDOCX({
      alumno,
      coach,
      sesiones: sesiones ?? [],
      compromisos: compromisos ?? [],
      tareas,
    });

    return new NextResponse(new Uint8Array(docx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${slug}-ficha-${hoyISO()}.docx"`,
      },
    });
  }

  // Presentación de junta técnica
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
      alumno:
        (s.alumnos as unknown as { nombre: string; empresa: string | null; cargo: string | null; reto: string | null }) ?? {
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
      "Content-Disposition": `attachment; filename="cedem-junta-tecnica-${hoyISO()}.pptx"`,
    },
  });
}
