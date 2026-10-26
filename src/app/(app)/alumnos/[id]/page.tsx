import Link from "next/link";
import { notFound } from "next/navigation";
import FormularioAgenda from "@/componentes/FormularioAgenda";
import { alumnoPorId, sesionesDe } from "@/lib/datos";
import { usuarioDePagina } from "@/lib/sesion";

export default async function FichaAlumno({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nueva?: string }>;
}) {
  const usuario = await usuarioDePagina();
  const { id } = await params;
  const { nueva } = await searchParams;

  const alumno = await alumnoPorId(id, usuario);
  if (!alumno) notFound();

  const sesiones = await sesionesDe(alumno.id);
  const realizadas = sesiones.filter((s) => s.estado === "realizada" || s.resumen_ejecutivo);

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-[var(--texto-suave)]">
        <Link href="/alumnos" className="no-underline hover:underline">
          ← Alumnos
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{alumno.nombre}</h1>
          <p className="mt-1 text-[var(--texto-suave)]">
            {[alumno.cargo, alumno.empresa].filter(Boolean).join(" · ") || "Sin empresa registrada"}
          </p>
          {alumno.reto && <p className="mt-2 max-w-2xl">Reto: {alumno.reto}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/subir?alumno=${alumno.id}`} className="btn btn-primario">
            ↑ Subir una sesión
          </Link>
          {realizadas.length > 0 && (
            <a
              href={`/api/documentos/${realizadas[0].id}/presentacion`}
              className="btn btn-suave"
              download
            >
              ▤ Junta técnica (PPTX)
            </a>
          )}
        </div>
      </header>

      {nueva === "1" && (
        <div
          className="tarjeta"
          style={{ borderColor: "#9bd6a8", background: "#f0fbf3", color: "#14532d" }}
        >
          <strong>Sesión guardada.</strong> Ya está el resumen, los hallazgos y los compromisos.
        </div>
      )}

      <FormularioAgenda alumnoId={alumno.id} zoom={usuario.zoom_url} />

      <section>
        <h2 className="mb-3 text-xl font-bold">Sesiones</h2>

        {sesiones.length === 0 ? (
          <div className="tarjeta text-[var(--texto-suave)]">
            Aún no hay sesiones de {alumno.nombre.split(" ")[0]}. Sube la primera transcripción y el
            agente la resume.
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {sesiones.map((s) => {
              const lista = s.estado === "realizada";
              return (
                <li key={s.id} className="tarjeta">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong className="text-lg">{s.fecha}</strong>
                    <span
                      className="etiqueta"
                      style={
                        lista
                          ? { background: "#e8f4fb", color: "#0b4d70" }
                          : { background: "#fff4dc", color: "#7a5200" }
                      }
                    >
                      {lista ? "Realizada" : "Agendada"}
                    </span>
                  </div>

                  {s.resumen_ejecutivo && <p className="mt-3">{s.resumen_ejecutivo}</p>}

                  {s.nota_coach && (
                    <div className="mt-3 rounded-xl bg-[var(--fondo)] p-4">
                      <div className="text-sm font-bold uppercase tracking-wide text-[var(--texto-suave)]">
                        Para la siguiente sesión
                      </div>
                      <p className="mt-1">{s.nota_coach}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={`/api/calendario/${s.id}`} className="btn btn-suave" style={{ minHeight: 46, fontSize: "0.95rem" }} download>
                      + Calendario
                    </a>
                    {lista && (
                      <>
                        <a
                          href={`/api/documentos/${s.id}/minuta`}
                          className="btn btn-suave"
                          style={{ minHeight: 46, fontSize: "0.95rem" }}
                          download
                        >
                          Minuta PDF
                        </a>
                        <a
                          href={`/api/documentos/${s.id}/ficha`}
                          className="btn btn-suave"
                          style={{ minHeight: 46, fontSize: "0.95rem" }}
                          download
                        >
                          Ficha Word
                        </a>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
