"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { crearAlumno, type Estado } from "@/acciones";

const INICIAL: Estado = {};

export default function FormularioAlumno({ abierto = false }: { abierto?: boolean }) {
  const [estado, enviar, pendiente] = useActionState(crearAlumno, INICIAL);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      toast.success(estado.ok);
      form.current?.reset();
    }
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  return (
    <details className="tarjeta" open={abierto}>
      <summary className="cursor-pointer text-lg font-bold">Registrar un alumno nuevo</summary>

      <form ref={form} action={enviar} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="campo sm:col-span-2">
          <label htmlFor="nombre">Nombre completo *</label>
          <input id="nombre" name="nombre" required autoComplete="off" placeholder="María Fernanda Ruiz" />
        </div>

        <div className="campo">
          <label htmlFor="empresa">Empresa</label>
          <input id="empresa" name="empresa" placeholder="Ruiz Botánica" />
        </div>

        <div className="campo">
          <label htmlFor="cargo">Puesto</label>
          <input id="cargo" name="cargo" placeholder="Fundadora y CEO" />
        </div>

        <div className="campo sm:col-span-2">
          <label htmlFor="reto">Reto principal</label>
          <input id="reto" name="reto" placeholder="Crecer sin perder el margen" />
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn btn-primario" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar alumno"}
          </button>
        </div>
      </form>
    </details>
  );
}
