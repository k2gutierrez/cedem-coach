import Image from "next/image";
import { redirect } from "next/navigation";
import FormularioEntrar from "@/componentes/FormularioEntrar";
import { usuarioActual } from "@/lib/sesion";

const PROGRAMA = "Máster en Innovación y Emprendimiento en el Negocio Familiar";

export default async function Login() {
  const usuario = await usuarioActual();
  if (usuario) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col gap-4">
          <Image
            src="/cedem-logo-navy.png"
            alt="CEDEM · Centro de Dueñez Empresaria"
            width={190}
            height={54}
            priority
            style={{ height: 54, width: "auto" }}
          />
          <p className="text-[0.95rem] leading-snug text-[var(--texto-suave)]">{PROGRAMA}</p>
        </div>

        <div className="tarjeta" style={{ padding: 30 }}>
          <h1 className="mb-1 text-2xl font-bold">Entra a tu cuenta</h1>
          <p className="mb-6 text-[var(--texto-suave)]">
            Usa el correo y la contraseña que te dio la coordinación.
          </p>
          <FormularioEntrar />
        </div>

        <div className="mt-8 flex items-center justify-center opacity-80">
          <Image
            src="/euncet.png"
            alt="Euncet Business School · UPC"
            width={190}
            height={84}
            style={{ height: 42, width: "auto" }}
          />
        </div>

        <p className="mt-6 text-center text-sm text-[var(--texto-suave)]">
          ¿No tienes cuenta? Pídesela a la coordinación del Máster.
        </p>
      </div>
    </main>
  );
}

export const instant = false;
