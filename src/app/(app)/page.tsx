import Link from "next/link";
import { panelDe } from "@/lib/datos";
import { usuarioDePagina } from "@/lib/sesion";

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function fechaLarga() {
  return new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function Inicio() {
  const usuario = await usuarioDePagina();
  const { alumnos, sesiones, compromisos, recientes } = await panelDe(usuario);
  const sinAlumnos = alumnos === 0;

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          {saludo()}, {usuario.nombre.split(" ")[0]}.
        </h1>
        <p className="mt-1 text-[var(--texto-suave)] first-letter:uppercase">{fechaLarga()}</p>
      </header>

      {sinAlumnos ? (
        <section className="tarjeta" style={{ padding: 30 }}>
          <h2 className="text-xl font-bold">Empecemos por un alumno</h2>
          <p className="mt-2 mb-6 max-w-2xl text-[var(--texto-suave)]">
            Todavía no hay nadie registrado. Da de alta a tu primer alumno y después sube la
            transcripción de su primera sesión: el agente se encarga del resto.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/alumnos" className="btn btn-primario btn-grande">
              Registrar mi primer alumno
            </Link>
            <Link href="/subir" className="btn btn-suave btn-grande">
              Ya tengo alumnos
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="flex flex-wrap gap-3">
            <Link href="/subir" className="btn btn-primario btn-grande">
              ↑ Subir una sesión
            </Link>
            <Link href="/alumnos" className="btn btn-suave btn-grande">
              ☺ Ver mis alumnos
            </Link>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="tarjeta">
              <div className="text-sm font-semibold uppercase tracking-wide text-[var(--texto-suave)]">
                Alumnos
              </div>
              <div className="mt-1 text-4xl font-bold">{alumnos}</div>
            </div>
            <div className="tarjeta">
              <div className="text-sm font-semibold uppercase tracking-wide text-[var(--texto-suave)]">
                Sesiones registradas
              </div>
              <div className="mt-1 text-4xl font-bold">{sesiones}</div>
            </div>
            <div className="tarjeta">
              <div className="text-sm font-semibold uppercase tracking-wide text-[var(--texto-suave)]">
                Compromisos abiertos
              </div>
              <div className="mt-1 text-4xl font-bold">{compromisos}</div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">Últimas sesiones</h2>
            {recientes.length === 0 ? (
              <div className="tarjeta text-[var(--texto-suave)]">
                Aún no hay sesiones. Sube la primera transcripción y aqui aparecerá el resumen.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {recientes.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={s.alumno_id ? `/alumnos/${s.alumno_id}` : "/alumnos"}
                      className="tarjeta block no-underline transition hover:border-[var(--azul-claro)]"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <strong className="text-lg">{s.alumnos?.nombre ?? "Sesión"}</strong>
                        <span className="text-sm text-[var(--texto-suave)]">{s.fecha}</span>
                      </div>
                      {s.resumen_ejecutivo && (
                        <p className="mt-1 line-clamp-2 text-[var(--texto-suave)]">{s.resumen_ejecutivo}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
