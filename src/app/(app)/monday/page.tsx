import Link from "next/link";
import { consultarTablero, ligaDeDescarga, mondayConfigurado, tablerosConfigurados } from "@/lib/monday";
import { usuarioDePagina } from "@/lib/sesion";

export const instant = false;

const hace = (iso: string) => {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "hace un momento";
  if (minutos === 1) return "hace 1 minuto";
  if (minutos < 60) return `hace ${minutos} minutos`;
  const horas = Math.round(minutos / 60);
  return horas === 1 ? "hace 1 hora" : `hace ${horas} horas`;
};

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
              {tablero.total} elementos · actualizado {hace(tablero.consultado)}
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
                  <div
                    key={columna.id}
                    className={
                      columna.tipo === "file" || columna.titulo === "Observaciones" ? "sm:col-span-2" : ""
                    }
                  >
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--texto-suave)]">
                      {columna.titulo}
                    </dt>
                    <dd className="mt-1">
                      {columna.valor &&
                        (columna.titulo === "Estado" ? (
                          <span
                            className="etiqueta"
                            style={{
                              background: /listo|complet|hecho/i.test(columna.valor)
                                ? "#e6f6ec"
                                : /curso|proceso/i.test(columna.valor)
                                  ? "#fff4e0"
                                  : "#eef1f6",
                              color: /listo|complet|hecho/i.test(columna.valor)
                                ? "#17663a"
                                : /curso|proceso/i.test(columna.valor)
                                  ? "#8a5300"
                                  : "#44506a",
                            }}
                          >
                            {columna.valor}
                          </span>
                        ) : (
                          <span className="text-[0.95rem]">
                            {columna.valor}
                            {columna.titulo === "Duración" ? " h" : ""}
                          </span>
                        ))}

                      {columna.recursos.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {columna.recursos.map((recurso, i) => {
                            const descarga = ligaDeDescarga(recurso.url);
                            return (
                              <span key={`${recurso.url}-${i}`} className="inline-flex overflow-hidden rounded-xl border border-[var(--borde)]">
                                <a
                                  href={recurso.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-suave rounded-none border-0"
                                >
                                  {columna.tipo === "file" ? "↗" : "↗"} {recurso.etiqueta}
                                </a>
                                {descarga && (
                                  <a
                                    href={descarga}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-suave rounded-none border-0 border-l border-[var(--borde)]"
                                    title="Descargar"
                                  >
                                    ↓ Descargar
                                  </a>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}

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
        Se consulta al entrar y como mucho cada 30 minutos; si necesitas lo más reciente, usa
        Actualizar.{" "}
        <Link href="/chat" className="underline">
          Pregúntale al agente
        </Link>{" "}
        si quieres que cruce esto con una sesión.
      </p>
    </div>
  );
}
