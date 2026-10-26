import Link from "next/link";
import AnalizadorPendiente from "@/componentes/AnalizadorPendiente";
import { db } from "@/lib/supabase";
import { exigirUsuario } from "@/lib/sesion";

type Consejo = {
  id: string;
  fecha: string;
  estado: string;
  resumen_ejecutivo: string | null;
  nota_coach: string | null;
};

export default async function Consejos() {
  const usuario = await exigirUsuario();

  let consulta = db
    .from("sesiones")
    .select("id, fecha, estado, resumen_ejecutivo, nota_coach")
    .eq("tipo", "consejo")
    .order("fecha", { ascending: false })
    .limit(20);

  if (usuario.rol !== "admin") consulta = consulta.eq("coach_id", usuario.id);

  const { data } = await consulta;
  const consejos = (data ?? []) as Consejo[];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consejos</h1>
          <p className="mt-1 text-[var(--texto-suave)]">
            Sesiones con todos los alumnos del grupo. Sube su transcripción desde{" "}
            <Link href="/subir" className="underline">
              Subir sesión
            </Link>{" "}
            eligiendo “Consejo”.
          </p>
        </div>
      </header>

      {consejos.length === 0 ? (
        <div className="tarjeta text-[var(--texto-suave)]">Todavía no hay Consejos registrados.</div>
      ) : (
        <ul className="flex flex-col gap-4">
          {consejos.map((c) => (
            <li key={c.id} className="tarjeta">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="text-lg">{c.fecha} · Consejo</strong>
                <span className="etiqueta" style={{ background: "#e8f4fb", color: "#0b4d70" }}>
                  {c.estado === "realizada" ? "Realizado" : "Agendado"}
                </span>
              </div>

              {c.resumen_ejecutivo ? (
                <p className="mt-3">{c.resumen_ejecutivo}</p>
              ) : (
                c.estado === "realizada" && <AnalizadorPendiente sesionId={c.id} />
              )}

              {c.nota_coach && (
                <div className="mt-3 rounded-xl bg-[var(--fondo)] p-4">
                  <div className="text-sm font-bold uppercase tracking-wide text-[var(--texto-suave)]">
                    Seguimiento
                  </div>
                  <p className="mt-1">{c.nota_coach}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`/api/calendario/${c.id}`} className="btn btn-suave" style={{ minHeight: 46 }} download>
                  + Calendario
                </a>
                <a
                  href={`/api/documentos/${c.id}/minuta`}
                  className="btn btn-suave"
                  style={{ minHeight: 46 }}
                  download
                >
                  Minuta PDF
                </a>
                <a
                  href={`/api/documentos/${c.id}/minuta-word`}
                  className="btn btn-suave"
                  style={{ minHeight: 46 }}
                  download
                >
                  Minuta Word
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const instant = false;
