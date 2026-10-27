import Link from "next/link";
import FormularioAlumno from "@/componentes/FormularioAlumno";
import { alumnosDe, listarCoaches } from "@/lib/datos";
import { usuarioDePagina } from "@/lib/sesion";

export default async function Alumnos() {
  const usuario = await usuarioDePagina();
  const alumnos = await alumnosDe(usuario);
  const coaches = usuario.rol === "admin" ? await listarCoaches() : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alumnos</h1>
          <p className="mt-1 text-[var(--texto-suave)]">
            {alumnos.length === 0
              ? "Todavía no hay ninguno."
              : `${alumnos.length} ${alumnos.length === 1 ? "alumno" : "alumnos"} en acompañamiento.`}
          </p>
        </div>
        <Link href="/subir" className="btn btn-suave">
          ↑ Subir una sesión
        </Link>
      </header>

      <FormularioAlumno abierto={alumnos.length === 0} coaches={coaches} />

      {alumnos.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {alumnos.map((a) => (
            <li key={a.id}>
              <Link
                href={`/alumnos/${a.id}`}
                className="tarjeta block h-full no-underline transition hover:border-[var(--azul-claro)]"
              >
                <div className="text-lg font-bold">{a.nombre}</div>
                <div className="text-[var(--texto-suave)]">
                  {[a.cargo, a.empresa].filter(Boolean).join(" · ") || "Sin empresa registrada"}
                </div>
                {a.reto && (
                  <p className="mt-3 border-t border-[var(--borde)] pt-3 text-sm text-[var(--texto-suave)]">
                    Reto: {a.reto}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
