"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { actualizarCuenta, type Estado } from "@/acciones";

const INICIAL: Estado = {};

export default function FormularioCuenta({
  nombre,
  zoom,
  feedUrl,
}: {
  nombre: string;
  zoom?: string | null;
  feedUrl: string;
}) {
  const [estado, enviar, pendiente] = useActionState(actualizarCuenta, INICIAL);

  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success("Liga copiada. Pégala en Google Calendar.");
    } catch {
      toast.error("No se pudo copiar. Selecciona la liga y cópiala a mano.");
    }
  };

  return (
    <div className="flex flex-col gap-10">
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

      <section className="border-t border-[var(--borde)] pt-6">
        <h2 className="text-xl font-bold">Tu calendario</h2>
        <p className="mt-1 mb-4 text-[var(--texto-suave)]">
          Suscríbete una sola vez y todas tus sesiones aparecen en tu calendario, sin volver a
          descargar nada. Google lo actualiza solo cada cierto tiempo.
        </p>

        <div className="campo">
          <label htmlFor="feed">Liga de tu calendario CEDEM</label>
          <div className="flex flex-wrap gap-2">
            <input id="feed" readOnly value={feedUrl} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-suave" onClick={() => void copiar()}>
              Copiar liga
            </button>
          </div>
        </div>

        <ol className="mt-4 flex list-decimal flex-col gap-2 pl-6 text-[var(--texto-suave)]">
          <li>Abre Google Calendar en la computadora.</li>
          <li>
            Entra a <b>Configuración</b> (el engrane, arriba a la derecha).
          </li>
          <li>
            En la barra lateral elige <b>Añadir calendario</b> → <b>Desde URL</b>.
          </li>
          <li>Pega la liga y confirma. Tarda en aparecer: Google lo revisa cada 2 o 3 horas.</li>
        </ol>

        <p className="mt-3 text-sm text-[var(--texto-suave)]">
          Es de solo lectura: si necesitas mover una sesión, se cambia aquí y el calendario se
          actualiza. Trata la liga como privada, cualquiera que la tenga puede ver tus sesiones.
        </p>
      </section>
    </div>
  );
}
