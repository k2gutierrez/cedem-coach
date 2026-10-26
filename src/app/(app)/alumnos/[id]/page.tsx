import Link from "next/link";
import { notFound } from "next/navigation";
import { AccionesSesion, BotonBajaAlumno } from "@/componentes/AccionesAlumno";
import AplicarChat from "@/componentes/AplicarChat";
import Chat from "@/componentes/Chat";
import AnalizadorPendiente from "@/componentes/AnalizadorPendiente";
import FormularioAgenda from "@/componentes/FormularioAgenda";
import FormularioAlumnoEdicion from "@/componentes/FormularioAlumnoEdicion";
import { alumnoPorId, historialChat, sesionesDetalle, tareasConCobertura } from "@/lib/datos";
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

  const [sesiones, tareas, historial] = await Promise.all([
    sesionesDetalle(alumno.id),
    tareasConCobertura(alumno.id),
    historialChat(alumno.id),
  ]);
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
          <h1 className="text-3xl font-bold tracking-tight">
            {alumno.nombre}
            {alumno.activo === false && (
              <span className="etiqueta ml-3 align-middle" style={{ background: "#fde8e6", color: "#7a1d12" }}>
                Dado de baja
              </span>
            )}
          </h1>
          <p className="mt-1 text-[var(--texto-suave)]">
            {[alumno.cargo, alumno.empresa].filter(Boolean).join(" · ") || "Sin empresa registrada"}
          </p>
          {alumno.reto && <p className="mt-2 max-w-2xl">Proyecto detonador: {alumno.reto}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/subir?alumno=${alumno.id}`} className="btn btn-primario">
            ↑ Subir una sesión
          </Link>
          {usuario.rol === "admin" && <BotonBajaAlumno id={alumno.id} activo={alumno.activo !== false} />}
        </div>
      </header>

      {nueva === "1" && (
        <div className="tarjeta" style={{ borderColor: "#9bd6a8", background: "#f0fbf3", color: "#14532d" }}>
          <strong>Sesión guardada.</strong> El agente la está analizando aquí abajo.
        </div>
      )}

      <FormularioAlumnoEdicion alumno={alumno} />

      <FormularioAgenda alumnoId={alumno.id} zoom={usuario.zoom_url} />

      <section className="tarjeta" style={{ padding: 24 }}>
        <h2 className="text-xl font-bold">Hablar del caso con el agente</h2>
        <p className="mb-4 mt-1 text-[var(--texto-suave)]">
          Cuéntale lo que quieras corregir o agregar del alumno. Cuando termines, usa{" "}
          <b>Aplicar el chat a la minuta</b> en la sesión para que la corrige.
        </p>
        <Chat
          nombre={usuario.nombre}
          alumnoId={alumno.id}
          sesionId={sesiones.find((s) => s.estado === "realizada")?.id ?? null}
          inicial={historial}
        />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Tareas de aplicación</h2>
        {tareas.length === 0 ? (
          <div className="tarjeta text-[var(--texto-suave)]">
            La administración todavía no ha cargado tareas de aplicación.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {tareas.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--borde)] bg-white px-4 py-3"
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid h-6 w-6 place-items-center rounded-md border-2 text-sm"
                    style={
                      t.abordada
                        ? { borderColor: "#1a7f4b", background: "#1a7f4b", color: "#fff" }
                        : { borderColor: "var(--borde)", background: "#fff" }
                    }
                  >
                    {t.abordada ? "✓" : ""}
                  </span>
                  {t.titulo}
                </span>
                <span className="text-sm text-[var(--texto-suave)]">
                  {t.abordada ? `Vista el ${t.fecha ?? ""}` : "Pendiente"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Sesiones</h2>

        {sesiones.length === 0 ? (
          <div className="tarjeta text-[var(--texto-suave)]">
            Aún no hay sesiones de {alumno.nombre.split(" ")[0]}. Sube la primera transcripción.
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {sesiones.map((s) => {
              const lista = s.estado === "realizada";
              return (
                <li key={s.id} className="tarjeta">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong className="text-lg">
                      {s.fecha}
                      {s.hora ? ` · ${s.hora.slice(0, 5)}` : ""}
                    </strong>
                    <span
                      className="etiqueta"
                      style={lista ? { background: "#e8f4fb", color: "#0b4d70" } : { background: "#fff4dc", color: "#7a5200" }}
                    >
                      {lista ? "Realizada" : "Agendada"}
                    </span>
                  </div>

                  {s.resumen_ejecutivo ? (
                    <p className="mt-3">{s.resumen_ejecutivo}</p>
                  ) : (
                    s.estado === "realizada" && <AnalizadorPendiente sesionId={s.id} />
                  )}

                  {s.nota_coach && (
                    <div className="mt-3 rounded-xl bg-[var(--fondo)] p-4">
                      <div className="text-sm font-bold uppercase tracking-wide text-[var(--texto-suave)]">
                        Seguimiento
                      </div>
                      <p className="mt-1">{s.nota_coach}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={`/api/calendario/${s.id}`}
                      className="btn btn-suave"
                      style={{ minHeight: 46, fontSize: "0.95rem" }}
                      download
                    >
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
                          href={`/api/documentos/${s.id}/minuta-word`}
                          className="btn btn-suave"
                          style={{ minHeight: 46, fontSize: "0.95rem" }}
                          download
                        >
                          Minuta Word
                        </a>
                        <a
                          href={`/api/documentos/${s.id}/ficha`}
                          className="btn btn-suave"
                          style={{ minHeight: 46, fontSize: "0.95rem" }}
                          download
                        >
                          Ficha del alumno
                        </a>
                        <AplicarChat sesionId={s.id} />
                      </>
                    )}
                  </div>

                  <AccionesSesion
                    id={s.id}
                    alumnoId={alumno.id}
                    fecha={s.fecha}
                    hora={s.hora}
                    duracion={s.duracion_min}
                    agendada={!lista}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
