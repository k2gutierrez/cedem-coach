import { redirect } from "next/navigation";
import FormularioEntrar from "@/componentes/FormularioEntrar";
import { usuarioActual } from "@/lib/sesion";

export default async function Login() {
  const usuario = await usuarioActual();
  if (usuario) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--azul)] text-2xl font-bold text-white">
            C
          </span>
          <div>
            <div className="text-xl font-bold tracking-tight text-[var(--azul)]">CEDEM Coach</div>
            <div className="text-sm text-[var(--texto-suave)]">Máster Euncet</div>
          </div>
        </div>

        <div className="tarjeta" style={{ padding: 30 }}>
          <h1 className="mb-1 text-2xl font-bold">Entra a tu cuenta</h1>
          <p className="mb-6 text-[var(--texto-suave)]">
            Usa el correo y la contraseña que te dio la coordinación.
          </p>
          <FormularioEntrar />
        </div>

        <p className="mt-6 text-center text-sm text-[var(--texto-suave)]">
          ¿No tienes cuenta? Pídesela a la coordinación del Máster.
        </p>
      </div>
    </main>
  );
}

export const instant = false;
