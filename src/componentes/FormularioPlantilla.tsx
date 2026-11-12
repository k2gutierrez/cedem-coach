"use client";

import { useActionState } from "react";
import { crearPlantilla, type EstadoPlantilla } from "@/acciones";

const INICIAL: EstadoPlantilla = {};

export default function FormularioPlantilla() {
  const [estado, accion, pendiente] = useActionState(crearPlantilla, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="campo">
          <label htmlFor="p-nombre">Nombre</label>
          <input id="p-nombre" name="nombre" placeholder="Resumen ejecutivo para el dueño" required />
        </div>
        <div className="campo">
          <label htmlFor="p-desc">Para qué sirve</label>
          <input id="p-desc" name="descripcion" placeholder="Una hoja que se manda antes de la junta" />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="p-instr">Instrucciones</label>
        <textarea
          id="p-instr"
          name="instrucciones"
          rows={8}
          placeholder={"Escribe el documento con esta estructura:\n1. Situación actual en tres líneas\n2. Tres riesgos, cada uno con su evidencia\n3. Tres decisiones que el dueño debe tomar este mes\n\nTono: directo, sin adjetivos. Máximo una página."}
          required
        />
        <span className="text-sm text-[var(--texto-suave)]">
          Escribe la estructura tal como debe salir. El agente usa el expediente del alumno y no
          inventa datos.
        </span>
      </div>

      {estado.error && <p className="text-sm font-semibold" style={{ color: "#a32217" }}>{estado.error}</p>}
      {estado.ok && <p className="text-sm font-semibold" style={{ color: "#17663a" }}>{estado.ok}</p>}

      <button type="submit" className="btn btn-primario justify-self-start" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar plantilla"}
      </button>
    </form>
  );
}
