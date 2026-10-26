import Chat from "@/componentes/Chat";
import { usuarioDePagina } from "@/lib/sesion";

export default async function Agente() {
  const usuario = await usuarioDePagina();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Agente CEDEM</h1>
        <p className="mt-1 text-[var(--texto-suave)]">
          Conoce a tus alumnos, lo que se habló en sus sesiones y el material de la firma.
        </p>
      </header>

      <Chat nombre={usuario.nombre} />
    </div>
  );
}
