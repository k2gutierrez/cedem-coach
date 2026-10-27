"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const LIMITE_MS = 60_000;

export default function AnalizadorPendiente({ sesionId }: { sesionId: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"analizando" | "error">("analizando");
  const [mensaje, setMensaje] = useState("");
  const [segundos, setSegundos] = useState(0);
  const lanzado = useRef(false);

  useEffect(() => {
    if (estado !== "analizando") return;
    const reloj = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(reloj);
  }, [estado]);

  // Si la petición se corta, se consulta si el análisis terminó de todos modos.
  const esperarResultado = async () => {
    for (let intento = 0; intento < 9; intento += 1) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const r = await fetch(`/api/sesiones/${sesionId}/estado`);
        if (!r.ok) continue;
        const j = (await r.json()) as { analizada?: boolean };
        if (j.analizada) {
          toast.success("Sesión analizada");
          router.refresh();
          return true;
        }
      } catch {
        /* siguiente intento */
      }
    }
    return false;
  };

  const analizar = async () => {
    setEstado("analizando");
    setMensaje("");
    setSegundos(0);

    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), LIMITE_MS);

    try {
      const r = await fetch("/api/sesiones/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesionId }),
        signal: control.signal,
      });

      const tipo = r.headers.get("content-type") || "";
      if (!tipo.includes("application/json")) {
        // Puede ser que el análisis sí haya terminado: se consulta antes de fallar.
        setMensaje("El servidor no respondió a tiempo; verificando si el análisis terminó…");
        if (await esperarResultado()) return;
        setEstado("error");
        setMensaje("El servidor tardó demasiado en responder. Intenta de nuevo.");
        return;
      }

      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setEstado("error");
        setMensaje(j.error || "El agente no pudo analizar la sesión.");
        return;
      }

      toast.success("Sesión analizada");
      router.refresh();
    } catch (e) {
      setMensaje("Se cortó la conexión; verificando si el análisis terminó…");
      if (await esperarResultado()) return;

      setEstado("error");
      setMensaje(
        (e as Error).name === "AbortError"
          ? "Pasó más de un minuto sin respuesta. Puede ser un corte; intenta de nuevo."
          : "Se cortó la conexión antes de terminar. Revisa tu internet."
      );
    } finally {
      clearTimeout(corte);
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
        <strong>El agente está leyendo la sesión… {segundos} s</strong>
      </div>
      <p className="mt-1 text-sm text-[var(--texto-suave)]">
        La transcripción ya quedó guardada. Esto tarda unos segundos y la página se actualiza sola.
        {segundos > 40 && " Está tardando más de lo normal; si pasa de un minuto te ofreceré reintentar."}
      </p>
    </div>
  );
}
