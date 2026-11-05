/**
 * Punto único para hablar con el proveedor de inteligencia artificial.
 *
 * Hoy todo pasa por la API de OpenAI: los datos que se envían no se usan para
 * entrenar modelos (política de OpenAI desde marzo de 2023) y la retención de
 * registros de abuso es de 30 días.
 */

export const URL_CHAT = "https://api.openai.com/v1/chat/completions";

/** Modelo de texto. Se puede cambiar sin tocar código. */
export function modeloTexto() {
  return process.env.OPENAI_MODELO_TEXTO || "gpt-4o-mini";
}

export function iaConfigurada() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function cabecerasIA(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
    "Content-Type": "application/json",
  };
}

export type RespuestaIA =
  | { ok: true; texto: string }
  | { ok: false; error: string; estado?: number };

/** Una llamada sin streaming, para análisis y correcciones. */
export async function completarTexto({
  sistema,
  usuario,
  json = false,
  maxTokens = 2000,
  temperatura = 0.2,
}: {
  sistema: string;
  usuario: string;
  json?: boolean;
  maxTokens?: number;
  temperatura?: number;
}): Promise<RespuestaIA> {
  if (!iaConfigurada()) return { ok: false, error: "Falta la llave de OpenAI." };

  try {
    const r = await fetch(URL_CHAT, {
      method: "POST",
      headers: cabecerasIA(),
      body: JSON.stringify({
        model: modeloTexto(),
        temperature: temperatura,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: usuario },
        ],
      }),
    });

    if (!r.ok) {
      const detalle = await r.text().catch(() => "");
      console.error("[ia] error", r.status, detalle.slice(0, 300));
      return { ok: false, error: `El agente no respondió (${r.status}).`, estado: r.status };
    }

    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const texto = j.choices?.[0]?.message?.content?.trim() ?? "";
    if (!texto) return { ok: false, error: "El agente devolvió una respuesta vacía." };

    return { ok: true, texto };
  } catch (e) {
    return { ok: false, error: `No se pudo conectar con el agente: ${(e as Error).message}` };
  }
}
