import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Navegacion from "@/componentes/Navegacion";
import { usuarioActual } from "@/lib/sesion";

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navegacion nombre={usuario.nombre} rol={usuario.rol} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-7">{children}</main>
    </div>
  );
}

export const instant = false;
