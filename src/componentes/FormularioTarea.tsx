"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { crearTarea, type Estado } from "@/acciones";

const INICIAL: Estado = {};

export default function FormularioTarea() {
  const [estado, enviar, pendiente] = useActionState(crearTarea, INICIAL);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      toast.success(estado.ok);
      form.current?.reset();
    }
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  return (
    <form ref={form} action={enviar} className="grid gap-4">
      <div className="campo">
        <label htmlFor="titulo-tarea">Tarea de aplicación</label>
        <input
          id="titulo-tarea"
          name="titulo"
          required
          placeholder="Calcular el margen por canal del último trimestre"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="campo">
          <label htmlFor="asignatura-tarea">Asignatura</label>
          <input id="asignatura-tarea" name="asignatura" placeholder="Estrategia" />
        </div>
        <div className="campo">
          <label htmlFor="mes">Mes</label>
          <input id="mes" name="mes" type="month" />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn btn-suave" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Agregar tarea"}
        </button>
      </div>
    </form>
  );
}
