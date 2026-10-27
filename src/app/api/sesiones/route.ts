import { NextResponse } from "next/server";
import { guardarArchivo } from "@/lib/ingesta";
import { usuarioActual } from "@/lib/sesion";
import { db, BUCKET } from "@/lib/supabase";

export const maxDuration = 30;

const AUDIO = /\.(m4a|mp3|wav|mp4|aac|ogg|opus|aiff|flac)$/i;
const PRESUPUESTO_AUDIO_MS = 22_000;

export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "Tu sesión venció. Vuelve a entrar." }, { status: 401 });
  }

  try {
    const tipo = req.headers.get("content-type") || "";
    let archivo: File | null = null;
    let alumnoId = "";
    let fecha = new Date().toISOString().slice(0, 10);
    let rutaStorage: string | null = null;
    let tipoSesion: "individual" | "consejo" = "individual";
    let sesionId: string | undefined;
    let reemplazar = false;

    if (tipo.includes("application/json")) {
      const cuerpo = (await req.json()) as {
        ruta?: string;
        nombre?: string;
        alumnoId?: string;
        fecha?: string;
        sesionId?: string;
        tipo?: string;
        reemplazar?: boolean;
      };
      alumnoId = String(cuerpo.alumnoId || "");
      fecha = String(cuerpo.fecha || fecha);
      if ((cuerpo as { tipo?: string }).tipo === "consejo") tipoSesion = "consejo";
      const sid = (cuerpo as { sesionId?: string }).sesionId;
      if (sid) sesionId = sid;
      if ((cuerpo as { reemplazar?: boolean }).reemplazar === true) reemplazar = true;
      rutaStorage = cuerpo.ruta || null;

      if (!rutaStorage) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });

      const { data: blob, error } = await db.storage.from(BUCKET).download(rutaStorage);
      if (error || !blob) {
        console.error("[sesiones] no se pudo bajar de Storage:", error);
        return NextResponse.json({ error: "No se encontró el archivo subido." }, { status: 400 });
      }
      const nombre = cuerpo.nombre || rutaStorage.split("/").pop() || "archivo";
      archivo = new File([blob], nombre, { type: blob.type || "application/octet-stream" });
    } else {
      const formulario = await req.formData();
      const enviado = formulario.get("archivo");
      if (!(enviado instanceof File)) {
        return NextResponse.json({ error: "No llegó el archivo. Intenta de nuevo." }, { status: 400 });
      }
      archivo = enviado;
      alumnoId = String(formulario.get("alumnoId") || "");
      fecha = String(formulario.get("fecha") || fecha);
      if (String(formulario.get("tipo") || "") === "consejo") tipoSesion = "consejo";
      const sid = String(formulario.get("sesionId") || "");
      if (sid) sesionId = sid;
      if (String(formulario.get("reemplazar") || "") === "1") reemplazar = true;
    }

    const esAudio = AUDIO.test(archivo.name);
    const trabajo = guardarArchivo({ usuario, alumnoId, fecha, archivo, tipo: tipoSesion, sesionId, reemplazar });

    const resultado = esAudio
      ? await Promise.race([
          trabajo,
          new Promise<null>((resolver) => setTimeout(() => resolver(null), PRESUPUESTO_AUDIO_MS)),
        ])
      : await trabajo;

    if (resultado === null) {
      return NextResponse.json(
        {
          error:
            "El audio es demasiado largo para transcribirlo de una vez. Sube la transcripción de Zoom (.vtt o .txt), que tarda segundos.",
          codigo: "audio_largo",
        },
        { status: 408 }
      );
    }

    if (!resultado.ok) {
      const estado = resultado.codigo === "duplicada" ? 409 : 400;
      return NextResponse.json({ error: resultado.error, codigo: resultado.codigo }, { status: estado });
    }

    if (rutaStorage) {
      await db.storage.from(BUCKET).remove([rutaStorage]).catch(() => {});
    }

    return NextResponse.json(resultado);
  } catch (e) {
    console.error("[subir sesión] fallo inesperado:", e);
    return NextResponse.json(
      { error: "Algo falló al procesar el archivo. Intenta de nuevo o sube la transcripción en texto." },
      { status: 500 }
    );
  }
}
