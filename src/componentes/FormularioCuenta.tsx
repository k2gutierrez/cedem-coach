"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { actualizarCuenta, type Estado } from "@/acciones";

const INICIAL: Estado = {};

export default function FormularioCuenta({
  nombre,
  zoom,
}: {
  nombre: string;
  zoom?: string | null;
}) {
  const [estado, enviar, pendiente] = useActionState(actualizarCuenta, INICIAL);

  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  return (
    <form action={enviar} className="grid gap-5">
      <div className="campo">
        <label htmlFor="nombre">Tu nombre</label>
        <input id="nombre" name="nombre" defaultValue={nombre} required />
      </div>

      <div className="campo">
        <label htmlFor="zoom">Tu liga de Zoom</label>
        <input
          id="zoom"
          name="zoom"
          type="url"
          defaultValue={zoom ?? ""}
          placeholder="https://zoom.us/j/123456789"
        />
        <span className="text-sm text-[var(--texto-suave)]">
          Es la misma para todas tus sesiones. Se usa al agendar y en la invitación del calendario.
          Puedes dejarla vacía y ponerla después.
        </span>
      </div>

      <div className="campo">
        <label htmlFor="password">Contraseña nueva</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Déjala vacía para no cambiarla"
        />
        <span className="text-sm text-[var(--texto-suave)]">Mínimo 8 caracteres.</span>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primario" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
