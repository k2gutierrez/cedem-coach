import Link from "next/link";
import FormularioSubida from "@/componentes/FormularioSubida";
import { alumnosDe, sesionesPendientes } from "@/lib/datos";
import { usuarioDePagina } from "@/lib/sesion";

export default async function Subir({
  searchParams,
}: {
  searchParams: Promise<{ alumno?: string }>;
}) {
  const usuario = await usuarioDePagina();
  const [alumnos, pendientes] = await Promise.all([alumnosDe(usuario), sesionesPendientes(usuario)]);
  const { alumno } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Subir transcripción</h1>
        <p className="mt-1 text-[var(--texto-suave)]">
          El agente lee la conversación, saca hallazgos y compromisos y te deja la sesión lista.
        </p>
      </header>

      {alumnos.length === 0 ? (
        <div className="tarjeta" style={{ padding: 30 }}>
          <h2 className="text-xl font-bold">Primero registra a tu alumno</h2>
          <p className="mt-2 mb-5 text-[var(--texto-suave)]">
            Para subir una sesión necesitas saber de quién es. Es un paso y ya.
          </p>
          <Link href="/alumnos" className="btn btn-primario btn-grande">
            Registrar un alumno
          </Link>
        </div>
      ) : (
        <div className="tarjeta" style={{ padding: 26 }}>
          <FormularioSubida
            alumnos={alumnos.map((a) => ({ id: a.id, nombre: a.nombre }))}
            pendientes={pendientes}
            alumnoInicial={alumno}
          />
        </div>
      )}
    </div>
  );
}
