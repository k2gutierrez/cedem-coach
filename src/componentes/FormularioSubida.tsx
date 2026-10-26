"use client";

import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { archivoAtom, faseAtom } from "@/estado";

const ACEPTA = ".pdf,.docx,.txt,.md,.vtt,.srt,audio/*,image/*,.m4a,.mp3,.wav,.mp4,.heic";
const LIMITE = 50 * 1024 * 1024;
const DIRECTO_DESDE = 4 * 1024 * 1024; // arriba de esto se sube a Storage

function peso(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function subirAStorage(url: string, file: File, progreso: (p: number) => void) {
  return new Promise<void>((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progreso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolver();
      else rechazar(new Error(`subida ${xhr.status}`));
    };
    xhr.onerror = () => rechazar(new Error("red"));
    xhr.send(file);
  });
}

export default function FormularioSubida({
  alumnos,
  pendientes = [],
  alumnoInicial,
}: {
  alumnos: { id: string; nombre: string }[];
  pendientes?: { id: string; alumno_id: string | null; fecha: string; hora: string | null; tipo: string }[];
  alumnoInicial?: string;
}) {
  const router = useRouter();
  const [archivo, setArchivo] = useAtom(archivoAtom);
  const [fase, setFase] = useAtom(faseAtom);
  const [avance, setAvance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const [alumnoId, setAlumnoId] = useState(alumnoInicial ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [sesionElegida, setSesionElegida] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFase("inicio");
  }, [setFase]);

  const suyas = pendientes.filter((p) => p.alumno_id === alumnoId && p.tipo !== "consejo");

  useEffect(() => {
    setSesionElegida(suyas[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoId]);

  const elegir = (file?: File | null) => {
    if (!file) return;
    setError(null);
    setAvance(0);
    if (file.size > LIMITE) {
      setError(`"${file.name}" pesa ${peso(file.size)}. El máximo es 50 MB.`);
      setArchivo(null);
      return;
    }
    setArchivo({ nombre: file.name, bytes: file.size });
    const caja = entrada.current;
    if (caja && file !== caja.files?.[0]) {
      const dt = new DataTransfer();
      dt.items.add(file);
      caja.files = dt.files;
    }
  };

  const procesar = async (cuerpo: FormData | object, esJson: boolean) => {
    const r = await fetch("/api/sesiones", {
      method: "POST",
      ...(esJson
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }
        : { body: cuerpo as FormData }),
    });
    return { ok: r.ok, datos: (await r.json().catch(() => ({}))) as { error?: string; alumnoId?: string } };
  };

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const file = entrada.current?.files?.[0];
    if (!alumnoId) return setError("Elige el alumno o Consejo.");
    if (!file) return setError("Elige el archivo de la sesión.");

    const esConsejo = alumnoId === "__consejo";

    try {
      if (file.size > DIRECTO_DESDE) {
        // Archivo pesado: primero a Storage, luego se procesa.
        setFase("subiendo");
        setAvance(0);

        const firmaResp = await fetch("/api/subidas/firma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: file.name, bytes: file.size, mime: file.type, alumnoId }),
        });
        const firma = (await firmaResp.json().catch(() => ({}))) as {
          ruta?: string;
          url?: string;
          error?: string;
        };
        if (!firmaResp.ok || !firma.url || !firma.ruta) {
          setFase("inicio");
          return setError(firma.error || "No se pudo preparar la subida.");
        }

        await subirAStorage(firma.url, file, setAvance);
        setFase("analizando");

        const { ok, datos } = await procesar(
          {
            ruta: firma.ruta,
            nombre: file.name,
            alumnoId: esConsejo ? "" : alumnoId,
            tipo: esConsejo ? "consejo" : "individual",
            ...(sesionElegida ? { sesionId: sesionElegida } : {}),
            fecha,
          },
          true
        );
        if (!ok) {
          setFase("inicio");
          return setError(datos.error || "No se pudo procesar el archivo.");
        }
        return terminar(datos.alumnoId);
      }

      setFase("analizando");
      const datos = new FormData();
      datos.set("alumnoId", esConsejo ? "" : alumnoId);
      datos.set("tipo", esConsejo ? "consejo" : "individual");
      datos.set("fecha", fecha);
      if (sesionElegida) datos.set("sesionId", sesionElegida);
      datos.set("archivo", file);

      const { ok, datos: respuesta } = await procesar(datos, false);
      if (!ok) {
        setFase("inicio");
        return setError(respuesta.error || "No se pudo procesar el archivo.");
      }
      terminar(respuesta.alumnoId);
    } catch (err) {
      setFase("inicio");
      const mensaje = (err as Error).message === "red"
        ? "Se cortó la conexión durante la subida. Intenta de nuevo."
        : `No se pudo subir el archivo (${(err as Error).message}).`;
      setError(mensaje);
      toast.error("No se pudo subir la sesión");
    }
  };

  const terminar = (id?: string | null) => {
    setFase("listo");
    toast.success("Sesión guardada. El agente la está analizando…");
    router.push(id ? `/alumnos/?nueva=1` : "/");
  };

  const trabajando = fase === "enviando" || fase === "subiendo" || fase === "analizando" || fase === "listo";

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="campo">
          <label htmlFor="alumnoId">¿De qué alumno es la sesión?</label>
          <select
            id="alumnoId"
            value={alumnoId}
            onChange={(e) => setAlumnoId(e.target.value)}
            required
          >
            <option value="" disabled>
              Elige un alumno
            </option>
            <option value="__consejo">Consejo · todos los alumnos</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        {!sesionElegida && (
          <div className="campo">
            <label htmlFor="fecha">Fecha de la sesión</label>
            <input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        )}
      </div>

      {suyas.length > 0 && (
        <div className="campo">
          <label htmlFor="sesion">¿Es una de tus sesiones agendadas?</label>
          <select
            id="sesion"
            value={sesionElegida}
            onChange={(e) => setSesionElegida(e.target.value)}
          >
            {suyas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fecha}
                {p.hora ? ` · ${p.hora.slice(0, 5)}` : ""} · Coaching individual
              </option>
            ))}
            <option value="">Otra fecha (la de arriba)</option>
          </select>
          <span className="text-sm text-[var(--texto-suave)]">
            Si eliges una agendada, esa sesión se marca como realizada y conserva su fecha.
          </span>
        </div>
      )}

      <div
        className={`soltar ${encima ? "activo" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          elegir(e.dataTransfer.files?.[0]);
        }}
      >
        <div className="text-lg font-bold">Arrastra aquí el archivo de la sesión</div>
        <p className="mx-auto mt-1 max-w-xl text-sm text-[var(--texto-suave)]">
          Transcripción de Zoom (.vtt o .txt), PDF, Word, audio o foto de tus notas. Hasta 50 MB: los
          archivos grandes se suben directo y se procesan solos.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button type="button" className="btn btn-suave" onClick={() => entrada.current?.click()}>
            Elegir archivo
          </button>
          {archivo && (
            <span className="etiqueta" style={{ background: "#e8f4fb", color: "#0b4d70" }}>
              {archivo.nombre} · {peso(archivo.bytes)}
            </span>
          )}
        </div>

        <input
          ref={entrada}
          type="file"
          accept={ACEPTA}
          hidden
          onChange={(e) => elegir(e.target.files?.[0])}
        />
      </div>

      {error && (
        <div
          className="tarjeta"
          style={{ borderColor: "#f3b4ad", background: "#fff5f4", color: "#7a1d12" }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--texto-suave)]">
          {fase === "subiendo"
            ? `Subiendo… ${avance}%`
            : "El archivo se convierte a texto y el agente lo analiza."}
        </p>
        <button type="submit" className="btn btn-primario btn-grande" disabled={trabajando || !archivo}>
          {fase === "subiendo"
            ? `Subiendo ${avance}%`
            : fase === "analizando"
              ? "Analizando…"
              : "Analizar la sesión"}
        </button>
      </div>

      {(fase === "subiendo" || fase === "analizando") && (
        <div className="tarjeta" style={{ borderColor: "var(--cian)", background: "#f2fbff" }}>
          <strong>
            {fase === "subiendo" ? "Subiendo el archivo…" : "El agente está leyendo la sesión…"}
          </strong>
          <p className="mt-1 text-sm text-[var(--texto-suave)]">
            {fase === "subiendo"
              ? "Los archivos grandes tardan un poco más. No cierres esta página."
              : "Buscando hallazgos, compromisos y qué tareas de aplicación se tocaron."}
          </p>
        </div>
      )}
    </form>
  );
}
