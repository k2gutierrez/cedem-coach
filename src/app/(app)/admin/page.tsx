import { redirect } from "next/navigation";
import FormularioMaterial from "@/componentes/FormularioMaterial";
import FormularioTarea from "@/componentes/FormularioTarea";
import { listarMaterial, tareasDelMes } from "@/lib/datos";
import { db } from "@/lib/supabase";
import { usuarioDePagina } from "@/lib/sesion";

export default async function Administracion() {
  const usuario = await usuarioDePagina();
  if (usuario.rol !== "admin") redirect("/");

  const [{ items, faltaTabla }, tareas, { data: equipo }] = await Promise.all([
    listarMaterial(),
    tareasDelMes(),
    db.from("coaches").select("id, nombre, email, rol").order("rol"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Administración</h1>
        <p className="mt-1 text-[var(--texto-suave)]">
          Lo que cargues aquí es lo que el agente usa para responderle a los coaches.
        </p>
      </header>

      {faltaTabla && (
        <div className="tarjeta" style={{ borderColor: "#f0c36d", background: "#fff8e8", color: "#6b4a00" }}>
          <strong>Falta crear la biblioteca.</strong> Corre <code>sql/002-material.sql</code> en el SQL
          Editor de Supabase y recarga esta página.
        </div>
      )}

      <section className="tarjeta" style={{ padding: 26 }}>
        <h2 className="text-xl font-bold">Material de la firma</h2>
        <p className="mb-5 mt-1 text-[var(--texto-suave)]">
          Clases, metodología, casos. Se parte en fragmentos y el agente lo consulta cuando responde.
        </p>
        <FormularioMaterial />
      </section>

      <section className="tarjeta" style={{ padding: 26 }}>
        <h2 className="text-xl font-bold">Tareas de aplicación</h2>
        <p className="mb-5 mt-1 text-[var(--texto-suave)]">
          El agente revisa en cada sesión si se habló de cada tarea.
        </p>
        <FormularioTarea />

        {tareas.length > 0 && (
          <ul className="mt-5 flex flex-col gap-2 border-t border-[var(--borde)] pt-4">
            {tareas.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span>{t.titulo}</span>
                <span className="text-sm text-[var(--texto-suave)]">
                  {[t.asignatura, t.mes?.slice(0, 7)].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tarjeta" style={{ padding: 26 }}>
        <h2 className="text-xl font-bold">Material cargado</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-[var(--texto-suave)]">Todavía no hay material.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {items.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--borde)] pb-2 last:border-0">
                <span className="font-semibold">{m.titulo}</span>
                <span className="text-sm text-[var(--texto-suave)]">
                  {[m.tipo, m.asignatura, m.generacion].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tarjeta" style={{ padding: 26 }}>
        <h2 className="text-xl font-bold">Equipo</h2>
        <p className="mt-1 text-[var(--texto-suave)]">
          Para dar de alta a alguien se corre un comando en la terminal (por ahora).
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {(equipo ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{c.nombre}</span>
              <span className="text-sm text-[var(--texto-suave)]">
                {c.email} · {c.rol}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
