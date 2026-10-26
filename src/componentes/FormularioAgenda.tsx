"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { agendarSesion, type Estado } from "@/acciones";

const INICIAL: Estado = {};

export default function FormularioAgenda({
  alumnoId,
  zoom,
}: {
  alumnoId: string;
  zoom?: string | null;
}) {
  const [estado, enviar, pendiente] = useActionState(agendarSesion, INICIAL);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      toast.success(estado.ok);
      form.current?.reset();
    }
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <details className="tarjeta">
      <summary className="cursor-pointer text-lg font-bold">Agendar la siguiente sesión</summary>

      <form ref={form} action={enviar} className="mt-5 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="alumnoId" value={alumnoId} />

        <div className="campo">
          <label htmlFor="ag-fecha">Fecha</label>
          <input id="ag-fecha" name="fecha" type="date" defaultValue={hoy} required />
        </div>

        <div className="campo">
          <label htmlFor="ag-hora">Hora</label>
          <input id="ag-hora" name="hora" type="time" defaultValue="09:00" required />
        </div>

        <div className="campo">
          <label htmlFor="ag-duracion">Duración</label>
          <select id="ag-duracion" name="duracion" defaultValue="60">
            <option value="60">1 hora</option>
            <option value="90">1 hora y media</option>
            <option value="120">2 horas</option>
          </select>
        </div>

        <div className="campo">
          <label htmlFor="ag-tipo">Tipo</label>
          <select id="ag-tipo" name="tipo" defaultValue="individual">
            <option value="individual">Coaching individual</option>
            <option value="consejo">Consejo</option>
          </select>
        </div>

        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--texto-suave)]">
            {zoom ? (
            "Se usará la liga de Zoom que tienes registrada."
          ) : (
            <>
              No tienes liga de Zoom registrada.{" "}
              <a href="/cuenta" className="font-semibold underline">Agrégala aquí</a>.
            </>
          )}
          </p>
          <button type="submit" className="btn btn-suave" disabled={pendiente}>
            {pendiente ? "Agendando…" : "Agendar sesión"}
          </button>
        </div>
      </form>
    </details>
  );
}
