import Link from "next/link";
import { panelDe } from "@/lib/datos";
import { usuarioDePagina } from "@/lib/sesion";

function fechaLarga() {
  return new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function fechaCorta(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function actividad(tipo: string) {
  return tipo === "consejo" ? "Consejo" : "Coaching individual";
}

export default async function Inicio() {
  const usuario = await usuarioDePagina();
  const { alumnos, sesiones, proximas } = await panelDe(usuario);
  const sinAlumnos = alumnos === 0;

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Hola, {usuario.nombre.split(" ")[0]}.
        </h1>
        <p className="mt-1 text-[var(--texto-suave)] first-letter:uppercase">{fechaLarga()}</p>
      </header>

      {sinAlumnos ? (
        <section className="tarjeta" style={{ padding: 30 }}>
          <h2 className="text-xl font-bold">Empecemos por un alumno</h2>
          <p className="mt-2 mb-6 max-w-2xl text-[var(--texto-suave)]">
            Todavía no hay nadie registrado. Da de alta a tu primer alumno; al guardarlo, el agente
            investiga su empresa e industria para que llegues preparado a la primera sesión.
          </p>
          <Link href="/alumnos" className="btn btn-primario btn-grande">
            Registrar mi primer alumno
          </Link>
        </section>
      ) : (
        <>
          <section className="flex flex-wrap gap-3">
            <Link href="/subir" className="btn btn-primario btn-grande">
              ↑ Subir transcripción
            </Link>
            <Link href="/alumnos" className="btn btn-suave btn-grande">
              ☺ Ver mis alumnos
            </Link>
            <Link href="/consejos" className="btn btn-suave btn-grande">
              ▤ Consejo
            </Link>
            {usuario.zoom_url && (
              <a
                href={usuario.zoom_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-suave btn-grande"
              >
                ▣ Abrir mi Zoom
              </a>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">Próximas sesiones</h2>

            {proximas.length === 0 ? (
              <div className="tarjeta text-[var(--texto-suave)]">
                No tienes sesiones agendadas. Entra a un alumno y agenda la siguiente, o revisa tu
                calendario.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--borde)] bg-white">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-[var(--fondo)] text-sm uppercase tracking-wide text-[var(--texto-suave)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Hora</th>
                      <th className="px-4 py-3 font-semibold">Actividad</th>
                      <th className="px-4 py-3 font-semibold">Alumno</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {proximas.map((s) => (
                      <tr key={s.id} className="border-t border-[var(--borde)]">
                        <td className="px-4 py-3 font-semibold">{fechaCorta(s.fecha)}</td>
                        <td className="px-4 py-3">{s.hora?.slice(0, 5) ?? "—"}</td>
                        <td className="px-4 py-3">{actividad(s.tipo)}</td>
                        <td className="px-4 py-3">{s.alumnos?.nombre ?? "Todo el grupo"}</td>
                        <td className="px-4 py-3 text-right">
                          {(s.zoom_url || usuario.zoom_url) && (
                            <a
                              href={(s.zoom_url || usuario.zoom_url) as string}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-suave"
                              style={{ minHeight: 40, padding: "0 14px", fontSize: "0.9rem" }}
                            >
                              Entrar a Zoom
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="tarjeta">
              <div className="text-sm font-semibold uppercase tracking-wide text-[var(--texto-suave)]">
                Alumnos activos
              </div>
              <div className="mt-1 text-4xl font-bold">{alumnos}</div>
            </div>
            <div className="tarjeta">
              <div className="text-sm font-semibold uppercase tracking-wide text-[var(--texto-suave)]">
                Sesiones registradas
              </div>
              <div className="mt-1 text-4xl font-bold">{sesiones}</div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
