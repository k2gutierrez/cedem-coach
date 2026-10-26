"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function AnalizadorPendiente({ sesionId }: { sesionId: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"analizando" | "error">("analizando");
  const [mensaje, setMensaje] = useState("");
  const lanzado = useRef(false);

  const analizar = async () => {
    setEstado("analizando");
    setMensaje("");
    try {
      const r = await fetch("/api/sesiones/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesionId }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setEstado("error");
        setMensaje(j.error || "El agente no pudo analizar la sesión.");
        return;
      }
      toast.success("Sesión analizada");
      router.refresh();
    } catch {
      setEstado("error");
      setMensaje("Se cortó la conexión antes de terminar. Revisa tu internet.");
    }
  };

  useEffect(() => {
    if (lanzado.current) return;
    lanzado.current = true;
    void analizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (estado === "error") {
    return (
      <div
        className="mt-3 rounded-xl p-4"
        style={{ background: "#fff5f4", border: "1px solid #f3b4ad", color: "#7a1d12" }}
        role="alert"
      >
        <strong>No se pudo analizar todavía.</strong>
        <p className="mt-1 text-sm">{mensaje}</p>
        <button type="button" className="btn btn-suave mt-3" onClick={() => void analizar()}>
          Reintentar análisis
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl p-4" style={{ background: "#f2fbff", border: "1px solid #b9e2f5" }}>
      <div className="flex items-center gap-3">
        <span className="pensando-punto" />
        <strong>El agente está leyendo la sesión…</strong>
      </div>
      <p className="mt-1 text-sm text-[var(--texto-suave)]">
        La transcripción ya quedó guardada. Esto tarda unos segundos y la página se actualiza sola.
      </p>
    </div>
  );
}
