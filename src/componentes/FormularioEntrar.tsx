"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { accionEntrar, type Estado } from "@/acciones";

const INICIAL: Estado = {};

export default function FormularioEntrar() {
  const [estado, enviar, pendiente] = useActionState(accionEntrar, INICIAL);

  useEffect(() => {
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <div className="campo">
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="nombre@cedem.com.mx"
        />
      </div>

      <div className="campo">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      <button type="submit" className="btn btn-primario btn-grande w-full" disabled={pendiente}>
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
