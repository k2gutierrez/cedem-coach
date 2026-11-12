"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function GeneradorDocumento({
  alumnoId,
  plantillas,
}: {
  alumnoId: string;
  plantillas: { id: string; nombre: string }[];
}) {
  const [elegida, setElegida] = useState(plantillas[0]?.id ?? "");
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");

  const generar = async () => {
    if (!elegida) return;
    setCargando(true);
    setTexto("");
    try {
      const r = await fetch("/api/plantillas/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantillaId: elegida, alumnoId }),
      });
      const j = (await r.json().catch(() => ({}))) as { texto?: string; titulo?: string; error?: string };
      if (!r.ok || !j.texto) {
        toast.error(j.error || "No se pudo generar el documento.", { duration: 8000 });
        return;
      }
      setTexto(j.texto);
      setTitulo(j.titulo || "Documento");
      toast.success("Documento listo");
    } catch {
      toast.error("Se cortó la conexión. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado");
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  };

  const descargarPDF = async () => {
    const r = await fetch("/api/plantillas/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, texto }),
    });
    if (!r.ok) {
      toast.error("No se pudo generar el PDF.");
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/[^\w\- ]/g, "")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!plantillas.length) return null;

  return (
    <section className="tarjeta" style={{ padding: 22 }}>
      <h2 className="text-xl font-bold">Generar un documento</h2>
      <p className="mt-1 text-[var(--texto-suave)]">
        Toma el expediente de este alumno y lo escribe con la estructura que definió la coordinación.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="campo" style={{ minWidth: 260 }}>
          <label htmlFor="plantilla">Plantilla</label>
          <select id="plantilla" value={elegida} onChange={(e) => setElegida(e.target.value)}>
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primario" onClick={() => void generar()} disabled={cargando}>
          {cargando ? "Escribiendo…" : "Generar"}
        </button>
      </div>

      {texto && (
        <div className="mt-4">
          <textarea
            readOnly
            value={texto}
            rows={16}
            className="w-full rounded-xl border border-[var(--borde)] p-4 text-[0.95rem]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-suave" onClick={() => void copiar()}>
              Copiar
            </button>
            <button type="button" className="btn btn-suave" onClick={() => void descargarPDF()}>
              ↓ Descargar PDF
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
