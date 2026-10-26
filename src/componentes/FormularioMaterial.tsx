"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { subirMaterial, type Estado } from "@/acciones";

const INICIAL: Estado = {};

export default function FormularioMaterial() {
  const [estado, enviar, pendiente] = useActionState(subirMaterial, INICIAL);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      toast.success(estado.ok);
      form.current?.reset();
    }
    if (estado.error) toast.error(estado.error, { duration: 8000 });
  }, [estado]);

  return (
    <form ref={form} action={enviar} className="grid gap-4">
      <div className="campo">
        <label htmlFor="titulo">¿Qué es este material?</label>
        <input id="titulo" name="titulo" required placeholder="Clase 3 · Gobierno y dueñez" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="campo">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue="clase">
            <option value="clase">Clase</option>
            <option value="metodologia">Metodología</option>
            <option value="caso">Caso</option>
            <option value="documento">Documento</option>
            <option value="transcripcion">Transcripción</option>
          </select>
        </div>

        <div className="campo">
          <label htmlFor="asignatura">Asignatura</label>
          <input id="asignatura" name="asignatura" placeholder="Estrategia" />
        </div>

        <div className="campo">
          <label htmlFor="generacion">Generación</label>
          <input id="generacion" name="generacion" placeholder="2026" />
        </div>

        <div className="campo">
          <label htmlFor="autor">Autor</label>
          <input id="autor" name="autor" placeholder="Lorena Espinoza" />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="archivo-material">Archivo</label>
        <input
          id="archivo-material"
          name="archivo"
          type="file"
          accept=".pdf,.docx,.txt,.md,.vtt,.srt,audio/*,image/*"
          required
        />
        <span className="text-sm text-[var(--texto-suave)]">
          PDF, Word o transcripción. El audio y las fotos necesitan la llave de OpenAI.
        </span>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primario" disabled={pendiente}>
          {pendiente ? "Leyendo y guardando…" : "Cargar material"}
        </button>
      </div>
    </form>
  );
}
