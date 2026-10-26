"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function AplicarChat({ sesionId }: { sesionId: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  const aplicar = async () => {
    setCargando(true);
    try {
      const r = await fetch(`/api/sesiones/${sesionId}/ajustar`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        toast.error(j.error || "No se pudo actualizar la minuta.", { duration: 8000 });
        return;
      }
      toast.success("Minuta actualizada con la conversación.");
      router.refresh();
    } catch {
      toast.error("Se cortó la conexión.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-suave"
      style={{ minHeight: 46, fontSize: "0.95rem" }}
      onClick={() => void aplicar()}
      disabled={cargando}
    >
      {cargando ? "Actualizando…" : "Aplicar el chat a la minuta"}
    </button>
  );
}
