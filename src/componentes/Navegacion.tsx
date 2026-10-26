"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { accionSalir } from "@/acciones";
import type { Rol } from "@/lib/sesion";

const ENLACES = [
  { href: "/", texto: "Inicio", icono: "⌂" },
  { href: "/alumnos", texto: "Alumnos", icono: "☺" },
  { href: "/subir", texto: "Subir sesión", icono: "↑" },
  { href: "/chat", texto: "Agente", icono: "✦" },
];

export default function Navegacion({
  nombre,
  rol,
}: {
  nombre: string;
  rol: Rol;
}) {
  const ruta = usePathname();
  const [saliendo, empezar] = useTransition();

  const enlaces = rol === "admin" ? [...ENLACES, { href: "/admin", texto: "Administración", icono: "⚙" }] : ENLACES;

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--borde)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-5 py-3">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--azul)] text-lg font-bold text-white">
            C
          </span>
          <span className="leading-tight">
            <span className="block text-[1.05rem] font-bold tracking-tight text-[var(--azul)]">CEDEM Coach</span>
            <span className="block max-w-[240px] text-[0.66rem] leading-[1.25] text-[var(--texto-suave)]">
              Máster en Innovación y Emprendimiento en el Negocio Familiar
            </span>
          </span>
        </Link>

        <nav className="order-3 flex w-full flex-wrap gap-2 md:order-2 md:ml-4 md:w-auto" aria-label="Principal">
          {enlaces.map((e) => {
            const activo = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
            return (
              <Link
                key={e.href}
                href={e.href}
                aria-current={activo ? "page" : undefined}
                className={`inline-flex min-h-[52px] items-center gap-2 rounded-xl px-4 text-[1rem] font-semibold no-underline transition ${
                  activo
                    ? "bg-[var(--azul)] text-white"
                    : "bg-[var(--fondo)] text-[var(--texto)] hover:bg-[#e7eefb]"
                }`}
              >
                <span aria-hidden className="text-[1.1rem] opacity-80">
                  {e.icono}
                </span>
                {e.texto}
              </Link>
            );
          })}
        </nav>

        <div className="order-2 ml-auto flex items-center gap-3 md:order-3">
          <Link
            href="/cuenta"
            className="rounded-xl px-2 py-1 text-right no-underline hover:bg-[var(--fondo)]"
            title="Mi cuenta"
          >
            <div className="text-[0.95rem] font-semibold leading-tight">{nombre}</div>
            <div className="text-[0.8rem] font-semibold text-[var(--cian)]">Mi cuenta</div>
          </Link>
          <button
            type="button"
            className="btn btn-suave"
            style={{ minHeight: 48, padding: "0 16px", fontSize: "0.95rem" }}
            disabled={saliendo}
            onClick={() => empezar(() => void accionSalir())}
          >
            {saliendo ? "Saliendo…" : "Salir"}
          </button>
        </div>
      </div>
    </header>
  );
}
