"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function GeneradorFirma({ plantillas }: { plantillas: { id: string; nombre: string }[] }) {
  const [plantillaId, setPlantillaId] = useState(plantillas[0]?.id ?? "");
  const [tema, setTema] = useState("");
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [cargando, setCargando] = useState(false);

  const generar = async () => {
    if (!plantillaId) return;
    setCargando(true);
    setTexto("");
    try {
      const r = await fetch("/api/plantillas/firma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantillaId, tema }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        texto?: string;
        titulo?: string;
        error?: string;
        fragmentos?: number;
      };
      if (!r.ok || !j.texto) {
        toast.error(j.error || "No se pudo generar el documento.", { duration: 8000 });
        return;
      }
      setTexto(j.texto);
      setTitulo(j.titulo || "Documento de la firma");
      toast.success(`Documento listo · ${j.fragmentos ?? 0} fragmentos de material`);
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
    a.download = `${titulo.replace(/[^\w\-áéíóúñ ]/gi, "")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="campo">
          <label htmlFor="f-plantilla">Plantilla</label>
          <select id="f-plantilla" value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="f-tema">Tema (opcional)</label>
          <input
            id="f-tema"
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="glosario de las dos primeras clases"
          />
          <span className="text-sm text-[var(--texto-suave)]">
            Si lo dejas vacío, usa todo el material cargado.
          </span>
        </div>
      </div>

      <button type="button" className="btn btn-primario justify-self-start" onClick={() => void generar()} disabled={cargando}>
        {cargando ? "Escribiendo…" : "Generar documento"}
      </button>

      {texto && (
        <div>
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
    </div>
  );
}
