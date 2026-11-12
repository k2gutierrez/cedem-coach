import { headers } from "next/headers";
import FormularioCuenta from "@/componentes/FormularioCuenta";
import { regenerarCalendario } from "@/acciones";
import { usuarioDePagina } from "@/lib/sesion";
import { tokenCalendario } from "@/lib/token";

export default async function Cuenta() {
  const usuario = await usuarioDePagina();

  const cabeceras = await headers();
  const host = cabeceras.get("host") ?? "localhost:3100";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? "http";
  const feedUrl = `${protocolo}://${host}/api/calendario/feed/${usuario.id}?t=${tokenCalendario(usuario.id, usuario.calendario_version ?? 0)}`;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="mt-1 text-[var(--texto-suave)]">
          {usuario.email} · {usuario.rol === "admin" ? "Administración" : "Coach"}
        </p>
      </header>

      <div className="tarjeta" style={{ padding: 26 }}>
        <section className="tarjeta" style={{ padding: 20 }}>
        <h2 className="text-lg font-bold">Liga de tu calendario</h2>
        <p className="mt-1 text-[var(--texto-suave)]">
          Si compartiste esta liga y quieres que deje de funcionar, regenérala. La anterior se apaga
          al instante y tendrás que volver a suscribirte con la nueva.
        </p>
        <form action={regenerarCalendario} className="mt-3">
          <button type="submit" className="btn btn-suave">
            Regenerar liga
          </button>
        </form>
      </section>

      <FormularioCuenta nombre={usuario.nombre} zoom={usuario.zoom_url} feedUrl={feedUrl} />
      </div>
    </div>
  );
}
