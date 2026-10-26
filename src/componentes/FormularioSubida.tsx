"use client";

import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { archivoAtom, faseAtom } from "@/estado";

const ACEPTA = ".pdf,.docx,.txt,.md,.vtt,.srt,audio/*,image/*,.m4a,.mp3,.wav,.mp4,.heic";
const LIMITE = 5 * 1024 * 1024;

function peso(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function FormularioSubida({
  alumnos,
  alumnoInicial,
}: {
  alumnos: { id: string; nombre: string }[];
  alumnoInicial?: string;
}) {
  const router = useRouter();
  const [archivo, setArchivo] = useAtom(archivoAtom);
  const [fase, setFase] = useAtom(faseAtom);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const [alumnoId, setAlumnoId] = useState(alumnoInicial ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFase("inicio");
  }, [setFase]);

  const elegir = (file?: File | null) => {
    if (!file) return;
    setError(null);
    if (file.size > LIMITE) {
      setError(
        `"${file.name}" pesa ${peso(file.size)}. El máximo es 5 MB: sube la transcripción en texto (.vtt o .txt) que pesa muchísimo menos.`
      );
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

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const caja = entrada.current;
    const file = caja?.files?.[0];
    if (!alumnoId) {
      setError("Elige el alumno.");
      return;
    }
    if (!file) {
      setError("Elige el archivo de la sesión.");
      return;
    }

    setFase("enviando");
    const datos = new FormData();
    datos.set("alumnoId", alumnoId);
    datos.set("fecha", fecha);
    datos.set("archivo", file);

    try {
      const r = await fetch("/api/sesiones", { method: "POST", body: datos });
      const j = (await r.json().catch(() => ({}))) as { error?: string; alumnoId?: string };

      if (!r.ok) {
        setFase("inicio");
        setError(j.error || `No se pudo subir (${r.status}).`);
        toast.error("No se pudo subir la sesión");
        return;
      }

      setFase("listo");
      toast.success("Sesión analizada y guardada");
      router.push(`/alumnos/${j.alumnoId}?nueva=1`);
    } catch {
      setFase("inicio");
      setError("Se cortó la conexión antes de terminar. Revisa tu internet e intenta de nuevo.");
      toast.error("Se cortó la conexión");
    }
  };

  const trabajando = fase === "enviando" || fase === "listo";

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="campo">
          <label htmlFor="alumnoId">¿De qué alumno es la sesión?</label>
          <select
            id="alumnoId"
            name="alumnoId"
            value={alumnoId}
            onChange={(e) => setAlumnoId(e.target.value)}
            required
          >
            <option value="" disabled>
              Elige un alumno
            </option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="fecha">Fecha de la sesión</label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>

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
          Sirve la transcripción de Zoom (.vtt o .txt), un PDF, un Word, el audio o una foto de tus
          notas. Máximo 5 MB.
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
          id="archivo"
          name="archivo"
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
          El archivo se convierte a texto y el agente lo analiza. Puede tardar hasta un minuto.
        </p>
        <button type="submit" className="btn btn-primario btn-grande" disabled={trabajando || !archivo}>
          {trabajando ? "Leyendo y analizando…" : "Analizar la sesión"}
        </button>
      </div>

      {trabajando && (
        <div className="tarjeta" style={{ borderColor: "var(--cian)", background: "#f2fbff" }}>
          <strong>El agente está leyendo la sesión…</strong>
          <p className="mt-1 text-sm text-[var(--texto-suave)]">
            Buscando hallazgos, compromisos y qué tareas de aplicación se tocaron. No cierres esta
            página.
          </p>
        </div>
      )}
    </form>
  );
}
