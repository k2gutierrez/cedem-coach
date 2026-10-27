import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from "docx";
import PptxGenJS from "pptxgenjs";
import { LOGO_BLANCO, LOGO_NAVY } from "./logo";

export type Persona = { nombre: string; empresa?: string | null; cargo?: string | null; reto?: string | null };
export type SesionDoc = {
  fecha: string;
  resumen_ejecutivo?: string | null;
  nota_coach?: string | null;
  transcripcion?: string | null;
};
export type Hallazgo = { titulo: string; detalle?: string | null; cita?: string | null };
export type Compromiso = { texto: string; responsable?: string | null; fecha?: string | null };
export type Coach = { nombre: string; email: string };

const AZUL = rgb(0.043, 0.184, 0.42);
const CIAN = rgb(0.055, 0.604, 0.839);
const GRIS = rgb(0.33, 0.38, 0.48);
const NEGRO = rgb(0.09, 0.13, 0.18);


/** No repite la fecha si el texto ya la menciona. */
function conFecha(texto: string, fecha?: string | null): string {
  if (!fecha) return texto;
  if (/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|antes del|antes de|para el)/i.test(texto)) {
    return texto;
  }
  return `${texto} — ${fechaBonita(fecha)}`;
}

function fechaBonita(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/* Minuta en PDF                                                       */
/* ------------------------------------------------------------------ */

export async function minutaPDF({
  alumno,
  sesion,
  coach,
  hallazgos,
  compromisos,
  tareas = [],
}: {
  alumno: Persona;
  sesion: SesionDoc;
  coach: Coach;
  hallazgos: Hallazgo[];
  compromisos: Compromiso[];
  tareas?: { titulo: string; abordada: boolean }[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ANCHO = 595.28;
  const ALTO = 841.89;
  const MARGEN = 56;
  const UTIL = ANCHO - MARGEN * 2;

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const nuevaPagina = () => {
    pagina = pdf.addPage([ANCHO, ALTO]);
    y = ALTO - MARGEN;
  };

  const asegurar = (alto: number) => {
    if (y - alto < MARGEN) nuevaPagina();
  };

  const texto = (
    cadena: string,
    opciones: { size?: number; font?: typeof normal; color?: typeof NEGRO; salto?: number } = {}
  ) => {
    const size = opciones.size ?? 10.5;
    const font = opciones.font ?? normal;
    const salto = opciones.salto ?? size * 1.45;
    const palabras = String(cadena || "").split(/\s+/);
    let linea = "";

    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, size) > UTIL && linea) {
        asegurar(salto);
        pagina.drawText(linea, { x: MARGEN, y, size, font, color: opciones.color ?? NEGRO });
        y -= salto;
        linea = palabra;
      } else {
        linea = prueba;
      }
    }
    if (linea) {
      asegurar(salto);
      pagina.drawText(linea, { x: MARGEN, y, size, font, color: opciones.color ?? NEGRO });
      y -= salto;
    }
  };

  // Encabezado con el logotipo de CEDEM
  pagina.drawRectangle({ x: 0, y: ALTO - 84, width: ANCHO, height: 84, color: AZUL });

  const logo = await pdf.embedPng(Buffer.from(LOGO_BLANCO, "base64"));
  const altoLogo = 30;
  const anchoLogo = (logo.width / logo.height) * altoLogo;
  pagina.drawImage(logo, { x: MARGEN, y: ALTO - 54, width: anchoLogo, height: altoLogo });

  pagina.drawText("Minuta de coaching", {
    x: ANCHO - MARGEN - negrita.widthOfTextAtSize("Minuta de coaching", 12),
    y: ALTO - 46,
    size: 12,
    font: negrita,
    color: rgb(1, 1, 1),
  });

  y = ALTO - 118;

  texto(alumno.nombre, { size: 18, font: negrita, color: AZUL });
  const detalle = [alumno.cargo, alumno.empresa].filter(Boolean).join(" · ");
  if (detalle) texto(detalle, { size: 10.5, color: GRIS });
  texto(`Sesión del ${fechaBonita(sesion.fecha)} · Coach: ${coach.nombre}`, { size: 10, color: GRIS });
  y -= 10;

  const seccion = (titulo: string) => {
    asegurar(46);
    pagina.drawRectangle({ x: MARGEN, y: y - 6, width: 3, height: 16, color: CIAN });
    pagina.drawText(titulo.toUpperCase(), {
      x: MARGEN + 10,
      y,
      size: 9.5,
      font: negrita,
      color: AZUL,
    });
    y -= 24;
  };

  if (sesion.resumen_ejecutivo) {
    seccion("Resumen de la sesión");
    texto(sesion.resumen_ejecutivo);
    y -= 8;
  }

  if (hallazgos.length) {
    seccion("Hallazgos");
    hallazgos.forEach((h, i) => {
      texto(`${i + 1}. ${h.titulo}`, { font: negrita, size: 10.5 });
      if (h.detalle) texto(h.detalle, { color: NEGRO });
      if (h.cita) texto(`“${h.cita}”`, { size: 9.5, color: GRIS });
      y -= 6;
    });
  }

  if (compromisos.length) {
    seccion("Compromisos");
    compromisos.forEach((c) => {
      texto(`• ${conFecha(c.texto, c.fecha)}`, { size: 10.5 });
      if (c.responsable) texto(`   ${c.responsable}`, { size: 9.5, color: GRIS });
    });
    y -= 8;
  }

  if (tareas.length) {
    seccion("Tareas de aplicación");
    for (const t of tareas) {
      texto(` `, { size: 10.5 });
    }
    y -= 6;
  }

  if (sesion.nota_coach) {
    seccion("Seguimiento");
    texto(sesion.nota_coach);
  }

  // Pie
  const pie = "Documento confidencial · uso interno de CEDEM";
  pagina.drawText(pie, {
    x: MARGEN,
    y: 30,
    size: 8,
    font: normal,
    color: GRIS,
  });

  return pdf.save();
}

/* ------------------------------------------------------------------ */
/* Ficha de preparación en Word                                        */
/* ------------------------------------------------------------------ */

export async function fichaDOCX({
  alumno,
  coach,
  sesiones,
  compromisos,
}: {
  alumno: Persona;
  coach: Coach;
  sesiones: SesionDoc[];
  compromisos: Compromiso[];
}): Promise<Buffer> {
  const titulo = (t: string) =>
    new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 100 } });

  const cuerpo: Paragraph[] = [
    new Paragraph({
      children: [
        new ImageRun({
          type: "png",
          data: Buffer.from(LOGO_NAVY, "base64"),
          transformation: { width: 150, height: (150 * 300) / 1061 },
          altText: { title: "CEDEM", description: "Logotipo CEDEM", name: "cedem" },
        }),
      ],
      spacing: { after: 220 },
    }),
    new Paragraph({ text: alumno.nombre, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({
          text: [alumno.cargo, alumno.empresa].filter(Boolean).join(" · ") || "Sin empresa registrada",
          color: "55617A",
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun({ text: `Coach: ${coach.nombre}`, color: "55617A" })] }),
  ];

  if (alumno.reto) {
    cuerpo.push(titulo("Reto declarado"), new Paragraph({ text: alumno.reto }));
  }

  if (sesiones.length) {
    cuerpo.push(titulo("Sesiones recientes"));
    for (const s of sesiones.slice(0, 6)) {
      cuerpo.push(
        new Paragraph({
          children: [
            new TextRun({ text: fechaBonita(s.fecha), bold: true }),
            new TextRun({ text: s.resumen_ejecutivo ? ` — ${s.resumen_ejecutivo}` : "" }),
          ],
          spacing: { after: 120 },
        })
      );
    }
  }

  if (compromisos.length) {
    cuerpo.push(titulo("Compromisos abiertos"));
    for (const c of compromisos) {
      cuerpo.push(
        new Paragraph({
          text: `${c.texto}${c.fecha ? ` (${fechaBonita(c.fecha)})` : ""}`,
          bullet: { level: 0 },
        })
      );
    }
  }

  cuerpo.push(
    titulo("Para la siguiente sesión"),
    new Paragraph({
      text:
        sesiones[0]?.nota_coach ||
        "Revisar compromisos abiertos y preparar la agenda con las tareas de aplicación del mes.",
    })
  );

  const doc = new Document({
    creator: "CEDEM Coach",
    title: `Ficha · ${alumno.nombre}`,
    sections: [{ properties: {}, children: cuerpo }],
  });

  return Packer.toBuffer(doc);
}

/* ------------------------------------------------------------------ */
/* Presentación de junta técnica                                       */
/* ------------------------------------------------------------------ */

export async function presentacionPPTX({
  coach,
  casos,
  titulo = "Junta técnica",
  subtitulo,
}: {
  coach: Coach;
  casos: { alumno: Persona; sesion: SesionDoc; hallazgos: Hallazgo[] }[];
  titulo?: string;
  subtitulo?: string;
}): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = coach.nombre;
  pptx.company = "CEDEM";

  const portada = pptx.addSlide();
  portada.background = { color: "0B2F6B" };
  portada.addImage({
    data: `image/png;base64,${LOGO_BLANCO}`,
    x: 0.7,
    y: 0.5,
    w: 2.1,
    h: (2.1 * 240) / 901,
  });
  portada.addText(titulo, {
    x: 0.7,
    y: 1.6,
    w: 8.6,
    h: 0.9,
    fontSize: 40,
    bold: true,
    color: "FFFFFF",
  });
  portada.addText(subtitulo ?? `Casos del grupo · ${coach.nombre}`, {
    x: 0.7,
    y: 2.6,
    w: 8.6,
    h: 0.6,
    fontSize: 20,
    color: "BBD3EA",
  });
  portada.addText(new Date().toLocaleDateString("es-MX", { dateStyle: "long" }), {
    x: 0.7,
    y: 4.6,
    w: 8.6,
    h: 0.4,
    fontSize: 13,
    color: "8FB4D6",
  });

  for (const caso of casos.slice(0, 8)) {
    const slide = pptx.addSlide();
    slide.addImage({
      data: `image/png;base64,${LOGO_NAVY}`,
      x: 8.65,
      y: 4.92,
      w: 1.0,
      h: (1.0 * 300) / 1061,
    });
    slide.addText(caso.alumno.nombre, {
      x: 0.6,
      y: 0.4,
      w: 8.8,
      h: 0.6,
      fontSize: 26,
      bold: true,
      color: "0B2F6B",
    });
    slide.addText(
      [caso.alumno.cargo, caso.alumno.empresa].filter(Boolean).join(" · ") || "Sin empresa registrada",
      { x: 0.6, y: 1.0, w: 8.8, h: 0.4, fontSize: 13, color: "55617A" }
    );

    const bullets = caso.hallazgos.slice(0, 4).map((h) => ({
      text: `${h.titulo}${h.detalle ? ` — ${h.detalle}` : ""}`,
      options: { bullet: true, breakLine: true },
    }));

    slide.addText(bullets.length ? bullets : [{ text: "Sin hallazgos registrados." }], {
      x: 0.6,
      y: 1.6,
      w: 8.8,
      h: 2.6,
      fontSize: 14,
      color: "16202F",
    });

    if (caso.sesion.resumen_ejecutivo) {
      slide.addText(caso.sesion.resumen_ejecutivo, {
        x: 0.6,
        y: 4.4,
        w: 8.8,
        h: 1.0,
        fontSize: 11,
        color: "55617A",
        italic: true,
      });
    }
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return buffer;
}

/* ------------------------------------------------------------------ */
/* Minuta en Word (mismo contenido que el PDF, editable)               */
/* ------------------------------------------------------------------ */

export async function minutaDOCX({
  alumno,
  sesion,
  coach,
  hallazgos,
  compromisos,
  tareas,
}: {
  alumno: Persona;
  sesion: SesionDoc;
  coach: Coach;
  hallazgos: Hallazgo[];
  compromisos: Compromiso[];
  tareas: { titulo: string; abordada: boolean }[];
}): Promise<Buffer> {
  const titulo = (t: string) =>
    new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 } });

  const cuerpo: Paragraph[] = [
    new Paragraph({
      children: [
        new ImageRun({
          type: "png",
          data: Buffer.from(LOGO_NAVY, "base64"),
          transformation: { width: 140, height: (140 * 300) / 1061 },
          altText: { title: "CEDEM", description: "Logotipo CEDEM", name: "cedem" },
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({ text: "Minuta de coaching", heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: alumno.nombre, bold: true, size: 28 })] }),
    new Paragraph({
      children: [
        new TextRun({
          text: [alumno.cargo, alumno.empresa].filter(Boolean).join(" · ") || "Sin empresa registrada",
          color: "55617A",
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Sesión del ${fechaBonita(sesion.fecha)} · Coach: ${coach.nombre}`,
          color: "55617A",
        }),
      ],
      spacing: { after: 200 },
    }),
  ];

  if (sesion.resumen_ejecutivo) {
    cuerpo.push(titulo("Resumen de la sesión"), new Paragraph({ text: sesion.resumen_ejecutivo }));
  }

  if (hallazgos.length) {
    cuerpo.push(titulo("Hallazgos"));
    hallazgos.forEach((h, i) => {
      cuerpo.push(
        new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${h.titulo}`, bold: true })] }),
        ...(h.detalle ? [new Paragraph({ text: h.detalle })] : []),
        ...(h.cita ? [new Paragraph({ children: [new TextRun({ text: `“${h.cita}”`, italics: true, color: "55617A" })] })] : [])
      );
    });
  }

  if (compromisos.length) {
    cuerpo.push(titulo("Compromisos"));
    for (const c of compromisos) {
      cuerpo.push(
        new Paragraph({
          text: conFecha(c.texto, c.fecha),
          bullet: { level: 0 },
        })
      );
    }
  }

  if (tareas.length) {
    cuerpo.push(titulo("Tareas de aplicación"));
    for (const t of tareas) {
      cuerpo.push(new Paragraph({ text: `${t.abordada ? "☑" : "☐"} ${t.titulo}` }));
    }
  }

  if (sesion.nota_coach) {
    cuerpo.push(titulo("Seguimiento"), new Paragraph({ text: sesion.nota_coach }));
  }

  const doc = new Document({
    creator: "CEDEM Coach",
    title: `Minuta · ${alumno.nombre} · ${sesion.fecha}`,
    sections: [{ properties: {}, children: cuerpo }],
  });

  return Packer.toBuffer(doc);
}

/* ------------------------------------------------------------------ */
/* Ficha corta del alumno: estado del caso en una hoja                 */
/* ------------------------------------------------------------------ */

export async function fichaCortaDOCX({
  alumno,
  coach,
  sesiones,
  compromisos,
  tareas,
}: {
  alumno: Persona;
  coach: Coach;
  sesiones: (SesionDoc & { estado?: string })[];
  compromisos: { texto: string; fecha?: string | null; estado?: string }[];
  tareas: { titulo: string; abordada: boolean }[];
}): Promise<Buffer> {
  const titulo = (t: string) =>
    new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 90 } });

  const abiertos = compromisos.filter((c) => c.estado !== "cumplido");
  const cumplidos = compromisos.filter((c) => c.estado === "cumplido");

  const cuerpo: Paragraph[] = [
    new Paragraph({
      children: [
        new ImageRun({
          type: "png",
          data: Buffer.from(LOGO_NAVY, "base64"),
          transformation: { width: 120, height: (120 * 300) / 1061 },
          altText: { title: "CEDEM", description: "Logotipo CEDEM", name: "cedem" },
        }),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({ text: `Ficha · ${alumno.nombre}`, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${new Date().toLocaleDateString("es-MX", { dateStyle: "long" })} · Coach: ${coach.nombre}`,
          color: "55617A",
        }),
      ],
    }),
  ];

  cuerpo.push(
    titulo("Proyecto detonador"),
    new Paragraph({ text: alumno.reto || "Aún no se define." })
  );

  cuerpo.push(titulo("Compromisos abiertos"));
  if (abiertos.length === 0) {
    cuerpo.push(new Paragraph({ text: "Sin compromisos pendientes." }));
  } else {
    for (const c of abiertos) {
      cuerpo.push(
        new Paragraph({
          text: c.fecha ? `${c.texto} — ${fechaBonita(c.fecha)}` : c.texto,
          bullet: { level: 0 },
        })
      );
    }
  }

  if (cumplidos.length) {
    cuerpo.push(titulo("Compromisos cumplidos"));
    for (const c of cumplidos) {
      cuerpo.push(new Paragraph({ text: c.texto, bullet: { level: 0 } }));
    }
  }

  if (tareas.length) {
    cuerpo.push(titulo("Tareas de aplicación"));
    for (const t of tareas) {
      cuerpo.push(new Paragraph({ text: `${t.abordada ? "☑" : "☐"} ${t.titulo}` }));
    }
  }

  if (sesiones.length) {
    cuerpo.push(titulo("Temas vistos por sesión"));
    for (const s of sesiones.slice(0, 10)) {
      cuerpo.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${fechaBonita(s.fecha)}: `, bold: true }),
            new TextRun({ text: (s.resumen_ejecutivo || "sin resumen").slice(0, 200) }),
          ],
          spacing: { after: 80 },
        })
      );
    }
  }

  const doc = new Document({
    creator: "CEDEM Coach",
    title: `Ficha · ${alumno.nombre}`,
    sections: [{ properties: {}, children: cuerpo }],
  });

  return Packer.toBuffer(doc);
}

/* ------------------------------------------------------------------ */
/* Brief de contexto del alumno (deep research)                        */
/* ------------------------------------------------------------------ */

export async function briefPDF({
  alumno,
  coach,
  texto,
  fuentes,
}: {
  alumno: Persona;
  coach: Coach;
  texto: string;
  fuentes: { titulo: string; url: string }[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cursiva = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const ANCHO = 595.28;
  const ALTO = 841.89;
  const MARGEN = 56;
  const UTIL = ANCHO - MARGEN * 2;

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const nueva = () => {
    pagina = pdf.addPage([ANCHO, ALTO]);
    y = ALTO - MARGEN - 20;
  };

  const asegurar = (alto: number) => {
    if (y - alto < MARGEN) nueva();
  };

  const escribir = (
    cadena: string,
    opciones: { size?: number; font?: typeof normal; color?: typeof NEGRO; sangria?: number } = {}
  ) => {
    const { size = 10.5, font = normal, color = NEGRO, sangria = 0 } = opciones;
    const espacio = UTIL - sangria;
    const interlinea = size * 1.42;
    const limpio = cadena.replace(/\*\*/g, "").replace(/`/g, "");
    const palabras = limpio.split(/\s+/).filter(Boolean);
    let linea = "";

    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, size) > espacio && linea) {
        asegurar(interlinea);
        pagina.drawText(linea, { x: MARGEN + sangria, y, size, font, color });
        y -= interlinea;
        linea = palabra;
      } else {
        linea = prueba;
      }
    }
    if (linea) {
      asegurar(interlinea);
      pagina.drawText(linea, { x: MARGEN + sangria, y, size, font, color });
      y -= interlinea;
    }
  };

  const logo = await pdf.embedPng(Buffer.from(LOGO_NAVY, "base64"));
  pagina.drawImage(logo, { x: MARGEN, y: ALTO - MARGEN - 8, width: 110, height: (110 * 300) / 1061 });
  y = ALTO - MARGEN - 46;

  escribir(`Brief de contexto · ${alumno.nombre}`, { size: 18, font: negrita, color: AZUL });
  escribir(
    [alumno.empresa, alumno.cargo].filter(Boolean).join(" · ") || "Sin empresa registrada",
    { size: 10, color: GRIS }
  );
  escribir(
    `Preparado para ${coach.nombre} · ${new Date().toLocaleDateString("es-MX", { dateStyle: "long" })}`,
    { size: 9.5, color: GRIS }
  );
  escribir("Documento interno. Contexto, no diagnóstico: no se comparte con el alumno.", {
    size: 9,
    font: cursiva,
    color: GRIS,
  });
  y -= 10;

  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea) {
      y -= 6;
      continue;
    }

    if (/^#{1,2}\s/.test(linea)) {
      asegurar(30);
      y -= 6;
      escribir(linea.replace(/^#{1,2}\s*/, ""), { size: 13, font: negrita, color: AZUL });
      y -= 2;
    } else if (/^#{3}\s/.test(linea)) {
      asegurar(24);
      escribir(linea.replace(/^#{3}\s*/, ""), { size: 11, font: negrita, color: AZUL });
    } else if (/^[-*•]\s/.test(linea)) {
      escribir(`•  ${linea.replace(/^[-*•]\s*/, "")}`, { sangria: 8 });
    } else if (/^>\s/.test(linea)) {
      escribir(linea.replace(/^>\s*/, ""), { size: 9.5, font: cursiva, color: GRIS, sangria: 8 });
    } else if (/^\d+\.\s/.test(linea)) {
      escribir(linea, { sangria: 8 });
    } else {
      escribir(linea);
    }
  }

  if (fuentes.length) {
    asegurar(40);
    y -= 8;
    escribir("Fuentes", { size: 13, font: negrita, color: AZUL });
    for (const f of fuentes.slice(0, 20)) {
      escribir(`•  ${f.titulo} — ${f.url}`, { size: 9, color: GRIS, sangria: 8 });
    }
  }

  pagina.drawText("CEDEM Coach · uso interno", { x: MARGEN, y: 30, size: 8, font: normal, color: GRIS });

  return pdf.save();
}
