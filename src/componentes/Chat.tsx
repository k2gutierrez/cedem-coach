"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Mensaje = { rol: "user" | "assistant"; texto: string };

const SUGERENCIAS = [
  "¿Cómo va mi grupo este mes?",
  "¿Qué compromisos están abiertos?",
  "Prepárame la siguiente sesión de un alumno",
  "¿Qué dice la metodología sobre el margen?",
];

const limpiar = (t: string) => t.replace(/\[\[ACCION:[a-z]+\]\]/gi, "").trim();

export default function Chat({
  nombre,
  alumnoId = null,
  sesionId = null,
  inicial = [],
}: {
  nombre: string;
  alumnoId?: string | null;
  sesionId?: string | null;
  inicial?: Mensaje[];
}) {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<Mensaje[]>(inicial);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, pensando]);

  const enviar = async (pregunta: string) => {
    const limpia = pregunta.trim();
    if (!limpia || pensando) return;

    const historial: Mensaje[] = [...mensajes, { rol: "user", texto: limpia }];
    setMensajes([...historial, { rol: "assistant", texto: "" }]);
    setTexto("");
    setPensando(true);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: historial, alumnoId }),
      });

      if (!r.ok || !r.body) {
        const detalle = await r.json().catch(() => ({}));
        throw new Error(detalle.error || `Error ${r.status}`);
      }

      const lector = r.body.getReader();
      const decodificador = new TextDecoder();
      let acumulado = "";

      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        acumulado += decodificador.decode(value, { stream: true });
        setMensajes((prev) => {
          const copia = [...prev];
          copia[copia.length - 1] = { rol: "assistant", texto: acumulado };
          return copia;
        });
      }

      if (/\[\[ACCION:minuta\]\]/i.test(acumulado) && sesionId) {
        toast.info("Aplicando los cambios a la minuta…");
        const ajuste = await fetch(`/api/sesiones/${sesionId}/ajustar`, { method: "POST" });
        if (ajuste.ok) {
          toast.success("Minuta actualizada con lo que platicaron.");
          router.refresh();
        } else {
          const j = (await ajuste.json().catch(() => ({}))) as { error?: string };
          toast.error(j.error || "No se pudo actualizar la minuta. Usa el botón de la sesión.");
        }
      }

      if (!acumulado.trim()) {
        setMensajes((prev) => {
          const copia = [...prev];
          copia[copia.length - 1] = {
            rol: "assistant",
            texto: "No pude responder esta vez. Intenta de nuevo en un momento.",
          };
          return copia;
        });
      }
    } catch (e) {
      toast.error("El agente no respondió. Revisa la conexión e intenta de nuevo.");
      setMensajes((prev) => prev.filter((m) => m.texto || m.rol === "user"));
      void e;
    } finally {
      setPensando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-[45vh] flex-col gap-4">
        {mensajes.length === 0 && (
          <div className="tarjeta" style={{ background: "#f7fbff", borderColor: "#cfe6f5" }}>
            <strong>Hola, {nombre.split(" ")[0]}.</strong>
            <p className="mt-1 text-[var(--texto-suave)]">
              Puedo leer tus alumnos, sus sesiones y el material de la firma. Pregúntame lo que
              necesites antes de una sesión.
            </p>
          </div>
        )}

        {mensajes.map((m, i) => {
          const mio = m.rol === "user";
          return (
            <div key={i} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[85%] rounded-2xl px-5 py-4"
                style={{
                  background: mio ? "var(--azul)" : "#fff",
                  color: mio ? "#fff" : "var(--texto)",
                  border: mio ? "none" : "1px solid var(--borde)",
                }}
              >
                {!mio && (
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--texto-suave)]">
                    Agente CEDEM
                  </div>
                )}
                <div className="whitespace-pre-wrap">{limpiar(m.texto) || (pensando ? "…" : "")}</div>
              </div>
            </div>
          );
        })}

        {pensando && (
          <div className="flex items-center gap-3 text-[var(--texto-suave)]">
            <span className="pensando-punto" />
            El agente está leyendo tus sesiones…
          </div>
        )}

        <div ref={fin} />
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            type="button"
            className="btn btn-suave"
            style={{ minHeight: 46, fontSize: "0.95rem", padding: "0 14px" }}
            onClick={() => void enviar(s)}
            disabled={pensando}
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="sticky bottom-4 flex items-end gap-3 rounded-2xl border border-[var(--borde)] bg-white p-3 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(texto);
        }}
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar(texto);
            }
          }}
          rows={2}
          placeholder="Escribe tu pregunta…"
          className="flex-1 resize-none rounded-xl border-0 bg-transparent px-3 py-2 text-[1.05rem] outline-none"
        />
        <button type="submit" className="btn btn-primario" disabled={pensando || !texto.trim()}>
          {pensando ? "Pensando…" : "Preguntar"}
        </button>
      </form>
    </div>
  );
}
