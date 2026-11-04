import Link from "next/link";
import { consultarTablero, mondayConfigurado, tablerosConfigurados } from "@/lib/monday";
import { usuarioDePagina } from "@/lib/sesion";

export const instant = false;

const kilo = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default async function PaginaMonday({
  searchParams,
}: {
  searchParams: Promise<{ fresco?: string }>;
}) {
  await usuarioDePagina();
  const { fresco } = await searchParams;

  const configurado = mondayConfigurado();
  const ids = tablerosConfigurados();
  const tableros = configurado
    ? await Promise.all(ids.map((id) => consultarTablero(id, 100, fresco === "1")))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monday</h1>
          <p className="mt-1 text-[var(--texto-suave)]">
            Lo que está en el tablero de CEDEM, para consultarlo sin salir de la aplicación.
          </p>
        </div>
        <a href="/monday?fresco=1" className="btn btn-suave">
          Actualizar
        </a>
      </div>

      {!configurado && (
        <section className="tarjeta" style={{ padding: 24 }}>
          <h2 className="text-lg font-bold">Falta conectar monday</h2>
          <p className="mt-2 text-[var(--texto-suave)]">
            Agrega <code>MONDAY_API_TOKEN</code> en las variables de entorno de la aplicación y vuelve
            a cargar esta página. El token se genera en monday, en Administración → API.
          </p>
        </section>
      )}

      {tableros.map((tablero) => (
        <section key={tablero.id} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">{tablero.nombre}</h2>
            <span className="text-sm text-[var(--texto-suave)]">
              {tablero.total} elementos · leído{" "}
              {new Date(tablero.consultado).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {tablero.error && (
            <div className="tarjeta" style={{ padding: 20, borderColor: "#f3b4ad", background: "#fff5f4" }}>
              <strong>No se pudo leer el tablero.</strong>
              <p className="mt-1 text-sm">{tablero.error}</p>
            </div>
          )}

          {tablero.elementos.map((elemento) => (
            <article key={elemento.id} className="tarjeta" style={{ padding: 20 }}>
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold">{elemento.nombre}</h3>
                {elemento.grupo && <span className="etiqueta">{elemento.grupo}</span>}
              </header>

              <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {elemento.columnas.map((columna) => (
                  <div key={columna.id} className={columna.tipo === "file" ? "sm:col-span-2" : ""}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--texto-suave)]">
                      {columna.titulo}
                    </dt>
                    <dd className="mt-1">
                      {columna.valor && <span className="text-[0.95rem]">{columna.valor}</span>}

                      {columna.urls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 inline-flex items-center gap-1 font-semibold text-[var(--azul)] underline"
                        >
                          Abrir enlace ↗
                        </a>
                      ))}

                      {columna.archivos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {columna.archivos.map((archivo) => (
                            <a
                              key={archivo.id}
                              href={`/api/monday/archivo?url=${encodeURIComponent(archivo.url)}&nombre=${encodeURIComponent(archivo.nombre)}`}
                              className="btn btn-suave"
                              download
                            >
                              ↓ {archivo.nombre} <span className="text-[var(--texto-suave)]">({kilo(archivo.tamano)})</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}

          {!tablero.error && tablero.elementos.length === 0 && (
            <div className="tarjeta text-[var(--texto-suave)]" style={{ padding: 20 }}>
              El tablero no tiene elementos todavía.
            </div>
          )}
        </section>
      ))}

      <p className="text-sm text-[var(--texto-suave)]">
        Se lee directo del tablero cada tres minutos.{" "}
        <Link href="/chat" className="underline">
          Pregúntale al agente
        </Link>{" "}
        si quieres que cruce esto con una sesión.
      </p>
    </div>
  );
}
