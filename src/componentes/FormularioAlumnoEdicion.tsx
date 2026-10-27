"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { editarAlumno, type Estado } from "@/acciones";

const INICIAL: Estado = {};

export default function FormularioAlumnoEdicion({
  alumno,
}: {
  alumno: {
    id: string;
    nombre: string;
    empresa: string | null;
    cargo: string | null;
    ciudad: string | null;
    giro: string | null;
    reto: string | null;
  };
}) {
  const [estado, enviar, pendiente] = useActionState(editarAlumno, INICIAL);

  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  return (
    <details className="tarjeta">
      <summary className="cursor-pointer text-lg font-bold">Editar los datos del alumno</summary>

      <form action={enviar} className="mt-5 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={alumno.id} />

        <div className="campo sm:col-span-2">
          <label htmlFor="ed-nombre">Nombre completo</label>
          <input id="ed-nombre" name="nombre" defaultValue={alumno.nombre} required />
        </div>

        <div className="campo">
          <label htmlFor="ed-empresa">Empresa</label>
          <input id="ed-empresa" name="empresa" defaultValue={alumno.empresa ?? ""} />
        </div>

        <div className="campo">
          <label htmlFor="ed-cargo">Puesto</label>
          <input id="ed-cargo" name="cargo" defaultValue={alumno.cargo ?? ""} />
        </div>

        <div className="campo">
          <label htmlFor="ed-ciudad">Ciudad</label>
          <input id="ed-ciudad" name="ciudad" defaultValue={alumno.ciudad ?? ""} />
        </div>

        <div className="campo">
          <label htmlFor="ed-giro">Giro</label>
          <input id="ed-giro" name="giro" defaultValue={alumno.giro ?? ""} />
        </div>

        <div className="campo sm:col-span-2">
          <label htmlFor="ed-reto">Proyecto detonador</label>
          <input
            id="ed-reto"
            name="reto"
            defaultValue={alumno.reto ?? ""}
            placeholder="Se puede dejar en blanco y llenarlo más adelante"
          />
        </div>

        <div className="flex justify-end sm:col-span-2">
          <button type="submit" className="btn btn-primario" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </details>
  );
}
