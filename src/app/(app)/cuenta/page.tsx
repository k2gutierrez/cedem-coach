import FormularioCuenta from "@/componentes/FormularioCuenta";
import { usuarioDePagina } from "@/lib/sesion";

export default async function Cuenta() {
  const usuario = await usuarioDePagina();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="mt-1 text-[var(--texto-suave)]">
          {usuario.email} · {usuario.rol === "admin" ? "Administración" : "Coach"}
        </p>
      </header>

      <div className="tarjeta" style={{ padding: 26 }}>
        <FormularioCuenta nombre={usuario.nombre} zoom={usuario.zoom_url} />
      </div>
    </div>
  );
}
