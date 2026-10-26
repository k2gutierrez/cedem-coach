import { headers } from "next/headers";
import FormularioCuenta from "@/componentes/FormularioCuenta";
import { usuarioDePagina } from "@/lib/sesion";
import { tokenCalendario } from "@/lib/token";

export default async function Cuenta() {
  const usuario = await usuarioDePagina();

  const cabeceras = await headers();
  const host = cabeceras.get("host") ?? "localhost:3100";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? "http";
  const feedUrl = `${protocolo}://${host}/api/calendario/feed/${usuario.id}?t=${tokenCalendario(usuario.id)}`;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="mt-1 text-[var(--texto-suave)]">
          {usuario.email} · {usuario.rol === "admin" ? "Administración" : "Coach"}
        </p>
      </header>

      <div className="tarjeta" style={{ padding: 26 }}>
        <FormularioCuenta nombre={usuario.nombre} zoom={usuario.zoom_url} feedUrl={feedUrl} />
      </div>
    </div>
  );
}
