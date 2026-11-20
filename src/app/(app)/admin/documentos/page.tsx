import Link from "next/link";
import { redirect } from "next/navigation";
import GeneradorFirma from "@/componentes/GeneradorFirma";
import { listarPlantillas } from "@/lib/plantillas";
import { usuarioDePagina } from "@/lib/sesion";

export const instant = false;

export default async function DocumentosFirma() {
  const usuario = await usuarioDePagina();
  if (usuario.rol !== "admin") redirect("/");

  const plantillas = await listarPlantillas();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentos de la firma</h1>
          <p className="mt-1 text-[var(--texto-suave)]">
            Genera documentos a partir del material cargado —clases, metodología, documentos— sin
            depender de un alumno. Para documentos de un caso, usa la ficha del alumno.
          </p>
        </div>
        <Link href="/admin" className="btn btn-suave">
          ← Administración
        </Link>
      </header>

      {plantillas.length === 0 ? (
        <div className="tarjeta" style={{ padding: 22 }}>
          <strong>Todavía no hay plantillas.</strong>
          <p className="mt-1 text-[var(--texto-suave)]">
            Crea una en{" "}
            <Link href="/admin/plantillas" className="underline">
              Plantillas del agente
            </Link>{" "}
            y vuelve aquí.
          </p>
        </div>
      ) : (
        <section className="tarjeta" style={{ padding: 26 }}>
          <GeneradorFirma plantillas={plantillas.map((p) => ({ id: p.id, nombre: p.nombre }))} />
        </section>
      )}
    </div>
  );
}
