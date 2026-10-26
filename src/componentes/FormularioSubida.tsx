"use client";

import { useAtom } from "jotai";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { subirSesion, type Estado } from "@/acciones";
import { archivoAtom, faseAtom } from "@/estado";

const INICIAL: Estado = {};

const ACEPTA = ".pdf,.docx,.txt,.md,.vtt,.srt,audio/*,image/*,.m4a,.mp3,.wav,.mp4,.heic";

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
  const [estado, enviar, pendiente] = useActionState(subirSesion, INICIAL);
  const [archivo, setArchivo] = useAtom(archivoAtom);
  const [fase, setFase] = useAtom(faseAtom);
  const [encima, setEncima] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.error) {
      toast.error(estado.error, { duration: 8000 });
      setFase("inicio");
    }
  }, [estado, setFase]);

  useEffect(() => {
    setFase(pendiente ? "analizando" : archivo ? "enviando" : "inicio");
  }, [pendiente, archivo, setFase]);

  const elegir = (file?: File | null) => {
    if (!file) return;
    const caja = entrada.current;
    if (caja && file !== caja.files?.[0]) {
      const dt = new DataTransfer();
      dt.items.add(file);
      caja.files = dt.files;
    }
    setArchivo({ nombre: file.name, bytes: file.size });
  };

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form ref={form} action={enviar} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="campo">
          <label htmlFor="alumnoId">¿De qué alumno es la sesión?</label>
          <select id="alumnoId" name="alumnoId" defaultValue={alumnoInicial ?? ""} required>
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
          <input id="fecha" name="fecha" type="date" defaultValue={hoy} />
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
          notas.
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--texto-suave)]">
          El archivo se convierte a texto y el agente lo analiza. Puede tardar hasta un minuto.
        </p>
        <button type="submit" className="btn btn-primario btn-grande" disabled={pendiente || !archivo}>
          {pendiente ? "Leyendo y analizando…" : "Analizar la sesión"}
        </button>
      </div>

      {pendiente && (
        <div className="tarjeta" style={{ borderColor: "var(--cian)", background: "#f2fbff" }}>
          <strong>El agente está leyendo la sesión…</strong>
          <p className="mt-1 text-sm text-[var(--texto-suave)]">
            Buscando hallazgos, compromisos y qué tareas de aplicación se tocaron. No cierres esta
            página.
          </p>
        </div>
      )}

      {fase === "inicio" && !archivo && (
        <p className="text-sm text-[var(--texto-suave)]">Primero elige el archivo para poder analizarlo.</p>
      )}
    </form>
  );
}
