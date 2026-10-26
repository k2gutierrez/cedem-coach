"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { actualizarSesion, bajaAlumno, eliminarSesion, type Estado } from "@/acciones";

const INICIAL: Estado = {};

export function BotonBajaAlumno({ id, activo }: { id: string; activo: boolean }) {
  const [estado, enviar, pendiente] = useActionState(bajaAlumno, INICIAL);

  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  return (
    <form
      action={enviar}
      onSubmit={(e) => {
        if (activo && !confirm("¿Dar de baja a este alumno? Se conserva todo su historial y puedes reactivarlo después.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="volver" value={activo ? "0" : "1"} />
      <button type="submit" className="btn btn-suave" disabled={pendiente}>
        {pendiente ? "Guardando…" : activo ? "Dar de baja" : "Reactivar"}
      </button>
    </form>
  );
}

export function AccionesSesion({
  id,
  alumnoId,
  fecha,
  hora,
  duracion,
  agendada,
}: {
  id: string;
  alumnoId: string;
  fecha: string;
  hora: string | null;
  duracion: number;
  agendada: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(actualizarSesion, INICIAL);
  const [estadoBorrar, borrar, borrando] = useActionState(eliminarSesion, INICIAL);

  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
    if (estado.error) toast.error(estado.error);
    if (estadoBorrar.ok) toast.success(estadoBorrar.ok);
    if (estadoBorrar.error) toast.error(estadoBorrar.error);
  }, [estado, estadoBorrar]);

  if (!agendada) {
    return (
      <form
        action={borrar}
        onSubmit={(e) => {
          if (!confirm("¿Eliminar esta sesión y su análisis? No se puede deshacer.")) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="alumnoId" value={alumnoId} />
        <button type="submit" className="btn btn-suave" style={{ minHeight: 40, fontSize: "0.88rem" }} disabled={borrando}>
          {borrando ? "Eliminando…" : "Eliminar"}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-[var(--fondo)] p-4">
      <form action={enviar} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="alumnoId" value={alumnoId} />
        <div className="campo">
          <label htmlFor={`f-${id}`}>Reprogramar</label>
          <input id={`f-${id}`} name="fecha" type="date" defaultValue={fecha} />
        </div>
        <div className="campo">
          <label htmlFor={`h-${id}`}>Hora</label>
          <input id={`h-${id}`} name="hora" type="time" defaultValue={hora?.slice(0, 5) ?? "09:00"} />
        </div>
        <div className="campo">
          <label htmlFor={`d-${id}`}>Duración</label>
          <select id={`d-${id}`} name="duracion" defaultValue={String(duracion)}>
            <option value="60">1 hora</option>
            <option value="90">1 hora y media</option>
            <option value="120">2 horas</option>
          </select>
        </div>
        <button type="submit" className="btn btn-suave" style={{ minHeight: 46 }} disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar fecha"}
        </button>
      </form>

      <form
        action={borrar}
        onSubmit={(e) => {
          if (!confirm("¿Eliminar esta sesión agendada?")) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="alumnoId" value={alumnoId} />
        <button type="submit" className="btn btn-suave" style={{ minHeight: 46 }} disabled={borrando}>
          {borrando ? "Eliminando…" : "Eliminar"}
        </button>
      </form>
    </div>
  );
}
