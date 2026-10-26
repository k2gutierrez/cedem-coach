import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export type ResultadoExtraccion = {
  texto: string;
  tipo: "texto" | "docx" | "pdf" | "audio" | "imagen";
  caracteres: number;
  meta: Record<string, unknown>;
};

const AUDIO = [".m4a", ".mp3", ".wav", ".mp4", ".aac", ".ogg", ".opus", ".aiff", ".flac"];
const IMAGEN = [".png", ".jpg", ".jpeg", ".webp", ".heic", ".gif", ".tif", ".tiff"];
const TEXTO = [".txt", ".md", ".vtt", ".srt"];

export function claseDe(nombre: string): ResultadoExtraccion["tipo"] | null {
  const ext = nombre.slice(nombre.lastIndexOf(".")).toLowerCase();
  if (!ext) return null;
  if (TEXTO.includes(ext)) return "texto";
  if (ext === ".docx") return "docx";
  if (ext === ".pdf") return "pdf";
  if (AUDIO.includes(ext)) return "audio";
  if (IMAGEN.includes(ext)) return "imagen";
  return null;
}

export class ErrorIngesta extends Error {
  codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

function limpiarVTT(contenido: string): string {
  const salida: string[] = [];
  let anterior = "";
  for (const cruda of contenido.split(/\r?\n/)) {
    let t = cruda.trim();
    if (!t) continue;
    if (/^WEBVTT/i.test(t) || /^NOTE\b/i.test(t)) continue;
    if (t.includes("-->")) continue;
    if (/^\d+$/.test(t)) continue;
    const voz = t.match(/<v\s+([^>]+)>/i);
    t = t.replace(/<[^>]+>/g, "").trim();
    if (!t) continue;
    const linea = voz ? `${voz[1].trim()}: ${t}` : t;
    if (linea === anterior) continue;
    salida.push(linea);
    anterior = linea;
  }
  return salida.join("\n");
}

function normalizar(texto: string): string {
  return texto.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Une intervenciones seguidas del mismo hablante: "Ana: hola" + "Ana: qué tal" → una línea. */
function unirHablantes(texto: string): string {
  const salida: string[] = [];
  let hablante: string | null = null;
  let buffer: string[] = [];
  const cerrar = () => {
    if (!buffer.length) return;
    salida.push(hablante ? `${hablante}: ${buffer.join(" ")}` : buffer.join(" "));
    buffer = [];
  };
  for (const linea of texto.split("\n")) {
    const m = linea.match(/^([^:]{1,60}):\s*(.+)$/);
    if (m) {
      const quien = m[1].trim();
      if (quien === hablante) {
        buffer.push(m[2].trim());
        continue;
      }
      cerrar();
      hablante = quien;
      buffer = [m[2].trim()];
    } else {
      cerrar();
      hablante = null;
      buffer = [linea.trim()];
      cerrar();
    }
  }
  cerrar();
  return salida.join("\n");
}

async function transcribirAudio(buffer: Buffer, nombre: string, mime: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new ErrorIngesta(
      "falta_llave_openai",
      "El audio necesita la llave de OpenAI. Mientras tanto sube la transcripción, un PDF o un Word."
    );
  }
  const forma = new FormData();
  forma.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), nombre);
  forma.append("model", process.env.OPENAI_MODELO_AUDIO || "gpt-4o-mini-transcribe");
  forma.append("response_format", "diarized_json");
  forma.append("chunking_strategy", "auto");

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: forma,
  });

  if (!r.ok) throw new ErrorIngesta("audio_fallo", `No se pudo transcribir (${r.status}).`);

  const j = (await r.json()) as { segments?: { speaker?: string; text?: string }[]; text?: string; duration?: number };
  const texto = j.segments?.length
    ? j.segments
        .filter((s) => s.text?.trim())
        .map((s) => (s.speaker ? `${s.speaker}: ${s.text!.trim()}` : s.text!.trim()))
        .join("\n")
    : j.text || "";

  return { texto, hablantes: Boolean(j.segments?.length), duracion: j.duration ?? null };
}

async function leerImagen(buffer: Buffer, mime: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new ErrorIngesta(
      "falta_llave_openai",
      "Las fotos necesitan la llave de OpenAI. Mientras tanto sube un PDF, un Word o la transcripción."
    );
  }
  const url = `data:${mime};base64,${buffer.toString("base64")}`;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODELO_VISION || "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Eres un asistente que digitaliza notas y documentos de una firma de consultoría. " +
                "Transcribe el texto de la imagen en español, conservando el orden y los saltos de línea. " +
                'Usa "- " para viñetas. Si algo no se entiende, escribe [ilegible].',
            },
            { type: "image_url", image_url: { url } },
          ],
        },
      ],
    }),
  });
  if (!r.ok) throw new ErrorIngesta("imagen_fallo", `No se pudo leer la imagen (${r.status}).`);
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content?.trim() || "";
}

export async function extraer(buffer: Buffer, nombre: string, mime: string): Promise<ResultadoExtraccion> {
  const clase = claseDe(nombre);
  if (!clase) {
    throw new ErrorIngesta("formato_no_soportado", "Formato no admitido. Usa PDF, Word, transcripción, audio o una foto.");
  }

  let texto = "";
  const meta: Record<string, unknown> = { formato: clase };

  if (clase === "texto") {
    const crudo = buffer.toString("utf8");
    const esSubtitulo = /\.(vtt|srt)$/i.test(nombre);
    texto = unirHablantes(esSubtitulo ? limpiarVTT(crudo) : normalizar(crudo));
  } else if (clase === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    texto = unirHablantes(normalizar(value));
  } else if (clase === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    texto = unirHablantes(normalizar(Array.isArray(text) ? text.join("\n\n") : text || ""));
  } else if (clase === "audio") {
    const r = await transcribirAudio(buffer, nombre, mime || "audio/mpeg");
    texto = unirHablantes(normalizar(r.texto));
    meta.hablantes = r.hablantes;
    meta.duracion = r.duracion;
  } else if (clase === "imagen") {
    texto = normalizar(await leerImagen(buffer, mime || "image/jpeg"));
  }

  if (texto.length < 40) {
    throw new ErrorIngesta(
      "texto_vacio",
      "Se leyó el archivo pero casi no tiene texto. Revisa que no sea una foto borrosa o un PDF escaneado sin reconocimiento."
    );
  }

  return { texto, tipo: clase, caracteres: texto.length, meta };
}
