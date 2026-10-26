"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { agendarConsejo, type Estado } from "@/acciones";

const INICIAL: Estado = {};

export default function FormularioConsejo() {
  const [estado, enviar, pendiente] = useActionState(agendarConsejo, INICIAL);

  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <details className="tarjeta">
      <summary className="cursor-pointer text-lg font-bold">Agendar el Consejo del mes</summary>

      <form action={enviar} className="mt-5 flex flex-wrap items-end gap-4">
        <div className="campo">
          <label htmlFor="c-fecha">Fecha</label>
          <input id="c-fecha" name="fecha" type="date" defaultValue={hoy} required />
        </div>
        <div className="campo">
          <label htmlFor="c-hora">Hora</label>
          <input id="c-hora" name="hora" type="time" defaultValue="09:00" required />
        </div>
        <div className="campo">
          <label htmlFor="c-duracion">Duración</label>
          <select id="c-duracion" name="duracion" defaultValue="120">
            <option value="90">1 hora y media</option>
            <option value="120">2 horas</option>
            <option value="180">3 horas</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primario" disabled={pendiente}>
          {pendiente ? "Agendando…" : "Agendar"}
        </button>
      </form>
    </details>
  );
}
