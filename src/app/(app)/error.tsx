"use client";

import Link from "next/link";
import { useEffect } from "react";

const CHUNK = /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|Unexpected token/i;

export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] error de render:", error);

    // Si el error es por una versión vieja de la app (se desplegó mientras la
    // pestaña estaba abierta), se recarga una sola vez para tomar la nueva.
    if (CHUNK.test(error?.message || "")) {
      const clave = "cedem-recarga";
      try {
        if (!sessionStorage.getItem(clave)) {
          sessionStorage.setItem(clave, "1");
          window.location.reload();
        }
      } catch {
        /* sin sessionStorage */
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">No se pudo cargar esta pantalla</h1>
      <p className="max-w-md text-[var(--texto-suave)]">
        Puede ser un corte momentáneo o que la aplicación se haya actualizado mientras la tenías
        abierta. Vuelve a intentarlo.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primario" onClick={() => reset()}>
          Reintentar
        </button>
        <button type="button" className="btn btn-suave" onClick={() => window.location.reload()}>
          Recargar la página
        </button>
        <Link href="/" className="btn btn-suave">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
