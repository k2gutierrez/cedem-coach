import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import PptxGenJS from "pptxgenjs";

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
}: {
  alumno: Persona;
  sesion: SesionDoc;
  coach: Coach;
  hallazgos: Hallazgo[];
  compromisos: Compromiso[];
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

  // Encabezado
  pagina.drawRectangle({ x: 0, y: ALTO - 84, width: ANCHO, height: 84, color: AZUL });
  pagina.drawText("CEDEM", { x: MARGEN, y: ALTO - 50, size: 20, font: negrita, color: rgb(1, 1, 1) });
  pagina.drawText("CENTRO DE DUEÑEZ EMPRESARIA", {
    x: MARGEN,
    y: ALTO - 66,
    size: 7.5,
    font: normal,
    color: rgb(0.78, 0.87, 0.96),
  });
  pagina.drawText("Minuta de coaching", {
    x: ANCHO - MARGEN - negrita.widthOfTextAtSize("Minuta de coaching", 12),
    y: ALTO - 52,
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
      const fecha = c.fecha ? ` — ${fechaBonita(c.fecha)}` : "";
      texto(`• ${c.texto}${fecha}`, { size: 10.5 });
      if (c.responsable) texto(`   ${c.responsable}`, { size: 9.5, color: GRIS });
    });
    y -= 8;
  }

  if (sesion.nota_coach) {
    seccion("Para la siguiente sesión");
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
}: {
  coach: Coach;
  casos: { alumno: Persona; sesion: SesionDoc; hallazgos: Hallazgo[] }[];
}): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = coach.nombre;
  pptx.company = "CEDEM";

  const portada = pptx.addSlide();
  portada.background = { color: "0B2F6B" };
  portada.addText("Junta técnica", {
    x: 0.7,
    y: 1.6,
    w: 8.6,
    h: 0.9,
    fontSize: 40,
    bold: true,
    color: "FFFFFF",
  });
  portada.addText(`Casos del grupo · ${coach.nombre}`, {
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
