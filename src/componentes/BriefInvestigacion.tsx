"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function BriefInvestigacion({
  alumnoId,
  empresa,
  actualizado,
}: {
  alumnoId: string;
  empresa: string | null;
  actualizado?: string | null;
}) {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);

  const generar = async () => {
    if (!empresa) {
      toast.error("Primero agrega la empresa del alumno en sus datos.");
      return;
    }
    setGenerando(true);
    toast.info("Investigando la empresa y su industria. Tarda unos 30 segundos…", { duration: 30000 });
    try {
      const r = await fetch(`/api/alumnos/${alumnoId}/brief`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        toast.error(j.error || "No se pudo generar el brief.", { duration: 8000 });
        return;
      }
      toast.success("Brief listo.");
      router.refresh();
    } catch {
      toast.error("Se cortó la conexión. Intenta de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  const fecha = actualizado
    ? new Date(actualizado).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <section className="tarjeta" style={{ padding: 24 }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold">Brief de contexto</h2>
          <p className="mt-1 text-[var(--texto-suave)]">
            Investigación de la empresa y su industria para que llegues preparado a la primera
            sesión. Es contexto, no diagnóstico: no se comparte con el alumno.
          </p>
          {fecha && (
            <p className="mt-2 text-sm text-[var(--texto-suave)]">
              Última versión: <b>{fecha}</b>.{" "}
              <a href={`/api/alumnos/${alumnoId}/brief.pdf`} className="font-semibold underline" download>
                Descargar PDF
              </a>
            </p>
          )}
        </div>

        <button type="button" className="btn btn-primario" onClick={() => void generar()} disabled={generando}>
          {generando ? "Investigando…" : fecha ? "Actualizar brief" : "Generar brief"}
        </button>
      </div>
    </section>
  );
}
