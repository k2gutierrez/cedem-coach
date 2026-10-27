"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Fuente = { titulo: string; url: string };

async function leer(respuesta: Response) {
  const tipo = respuesta.headers.get("content-type") || "";
  if (!tipo.includes("application/json")) {
    return { error: "El servidor tardó demasiado (tiempo agotado). Intenta de nuevo." } as {
      error: string;
      hechos?: string;
      fuentes?: Fuente[];
    };
  }
  return (await respuesta.json().catch(() => ({ error: "Respuesta inesperada del servidor." }))) as {
    error?: string;
    hechos?: string;
    fuentes?: Fuente[];
  };
}

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
  const [paso, setPaso] = useState<"inicio" | "buscando" | "escribiendo">("inicio");

  const generar = async () => {
    if (!empresa) {
      toast.error("Primero agrega la empresa del alumno en sus datos.");
      return;
    }

    setGenerando(true);
    try {
      setPaso("buscando");
      toast.info("Investigando la empresa y su industria…", { duration: 12000 });

      const b = await fetch(`/api/alumnos/${alumnoId}/brief/buscar`, { method: "POST" });
      const jb = await leer(b);
      if (!b.ok || !jb.hechos) {
        toast.error(jb.error || "No se pudo investigar la empresa.", { duration: 8000 });
        return;
      }

      setPaso("escribiendo");
      toast.info("Escribiendo el brief…", { duration: 12000 });

      const r = await fetch(`/api/alumnos/${alumnoId}/brief/redactar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hechos: jb.hechos, fuentes: jb.fuentes ?? [] }),
      });
      const jr = await leer(r);
      if (!r.ok) {
        toast.error(jr.error || "No se pudo escribir el brief.", { duration: 8000 });
        return;
      }

      toast.success("Brief listo.");
      router.refresh();
    } catch {
      toast.error("Se cortó la conexión. Intenta de nuevo.");
    } finally {
      setGenerando(false);
      setPaso("inicio");
    }
  };

  const fecha = actualizado
    ? new Date(actualizado).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const etiqueta =
    paso === "buscando" ? "Investigando…" : paso === "escribiendo" ? "Escribiendo…" : null;

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
          {etiqueta ?? (fecha ? "Actualizar brief" : "Generar brief")}
        </button>
      </div>

      {generando && (
        <p className="mt-3 text-sm text-[var(--texto-suave)]">
          Son dos pasos: busca en la web (unos 10 segundos) y luego escribe el documento. No cierres
          la página.
        </p>
      )}
    </section>
  );
}
