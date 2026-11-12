import Link from "next/link";
import { redirect } from "next/navigation";
import FormularioPlantilla from "@/componentes/FormularioPlantilla";
import { alternarPlantilla, eliminarPlantilla } from "@/acciones";
import { listarPlantillas } from "@/lib/plantillas";
import { usuarioDePagina } from "@/lib/sesion";

export const instant = false;

export default async function Plantillas() {
  const usuario = await usuarioDePagina();
  if (usuario.rol !== "admin") redirect("/");

  let plantillas: Awaited<ReturnType<typeof listarPlantillas>> = [];
  let faltaTabla = false;
  try {
    plantillas = await listarPlantillas(false);
  } catch {
    faltaTabla = true;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plantillas del agente</h1>
          <p className="mt-1 text-[var(--texto-suave)]">
            Lo que escribas aquí se convierte en documentos que el equipo puede generar con un clic,
            usando el expediente de cada alumno.
          </p>
        </div>
        <Link href="/admin" className="btn btn-suave">
          ← Administración
        </Link>
      </header>

      {faltaTabla && (
        <div className="tarjeta" style={{ borderColor: "#f0c36d", background: "#fff8e8", color: "#6b4a00" }}>
          <strong>Falta crear la tabla.</strong> Corre <code>sql/008-plantillas.sql</code> en Supabase.
        </div>
      )}

      <section className="tarjeta" style={{ padding: 26 }}>
        <h2 className="text-xl font-bold">Nueva plantilla</h2>
        <p className="mb-5 mt-1 text-[var(--texto-suave)]">
          Las instrucciones son el esqueleto del documento. Sé explícito con las secciones y el tono.
        </p>
        <FormularioPlantilla />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Plantillas ({plantillas.length})</h2>

        {plantillas.length === 0 && (
          <div className="tarjeta text-[var(--texto-suave)]">Todavía no hay plantillas.</div>
        )}

        {plantillas.map((p) => (
          <article key={p.id} className="tarjeta" style={{ padding: 18 }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-bold">{p.nombre}</h3>
              <span className="etiqueta" style={{ background: p.activo ? "#e6f6ec" : "#eef1f6", color: p.activo ? "#17663a" : "#44506a" }}>
                {p.activo ? "Activa" : "Inactiva"}
              </span>
            </div>
            {p.descripcion && <p className="mt-1 text-[var(--texto-suave)]">{p.descripcion}</p>}
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--texto-suave)]">
              {p.instrucciones.slice(0, 260)}
              {p.instrucciones.length > 260 ? "…" : ""}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <form action={alternarPlantilla}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="activo" value={String(p.activo)} />
                <button type="submit" className="btn btn-suave">
                  {p.activo ? "Desactivar" : "Activar"}
                </button>
              </form>
              <form action={eliminarPlantilla}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="btn btn-suave">
                  Eliminar
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
