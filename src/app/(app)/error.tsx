"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] error de render:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">No se pudo cargar esta pantalla</h1>
      <p className="max-w-md text-[var(--texto-suave)]">
        Puede ser un corte momentáneo. Vuelve a intentarlo; si sigue pasando, recarga la página.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primario" onClick={() => reset()}>
          Reintentar
        </button>
        <Link href="/" className="btn btn-suave">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
