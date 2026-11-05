#!/usr/bin/env node
/** Especificación de plantillas, en PDF.  node scripts/plantillas.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const LOGO = fs.readFileSync(path.join(RAIZ, "public", "mief.png"));

const AZUL = rgb(0.043, 0.184, 0.42);
const CIAN = rgb(0.055, 0.604, 0.839);
const GRIS = rgb(0.33, 0.38, 0.48);
const NEGRO = rgb(0.09, 0.13, 0.18);

const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 56;
const UTIL = ANCHO - MARGEN * 2;

const pdf = await PDFDocument.create();
const normal = await pdf.embedFont(StandardFonts.Helvetica);
const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
const cursiva = await pdf.embedFont(StandardFonts.HelveticaOblique);
const logo = await pdf.embedPng(LOGO);

let pagina = pdf.addPage([ANCHO, ALTO]);
let y = ALTO - MARGEN;
let numero = 1;

const sinRaros = (t) =>
  String(t).replace(/[≈]/g, "~").replace(/[\u2013\u2014]/g, "-").replace(/[\u201C\u201D]/g, '"').replace(/[^\x00-\xFF•]/g, "");

function pie() {
  pagina.drawText("Plantillas de documentos · MIEEF Coach · CEDEM", { x: MARGEN, y: 28, size: 8, font: normal, color: GRIS });
  pagina.drawText(String(numero), { x: ANCHO - MARGEN - 8, y: 28, size: 9, font: negrita, color: GRIS });
}

function nueva() {
  pie();
  pagina = pdf.addPage([ANCHO, ALTO]);
  numero += 1;
  y = ALTO - MARGEN - 46;
  pagina.drawImage(logo, { x: MARGEN, y: ALTO - MARGEN - 22, width: 86, height: (86 * 177) / 400 });
}

function asegurar(alto) {
  if (y - alto < 60) nueva();
}

function escribir(texto, { size = 10.5, font = normal, color = NEGRO, sangria = 0, interlinea } = {}) {
  const limpio = sinRaros(texto);
  const palabras = limpio.split(/\s+/).filter(Boolean);
  const saltoLinea = interlinea ?? size * 1.42;
  let linea = "";

  for (const palabra of palabras) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(prueba, size) > UTIL - sangria && linea) {
      asegurar(saltoLinea);
      pagina.drawText(linea, { x: MARGEN + sangria, y, size, font, color });
      y -= saltoLinea;
      linea = palabra;
    } else {
      linea = prueba;
    }
  }
  if (linea) {
    asegurar(saltoLinea);
    pagina.drawText(linea, { x: MARGEN + sangria, y, size, font, color });
    y -= saltoLinea;
  }
}

const salto = (n = 8) => {
  y -= n;
};

function seccion(texto) {
  asegurar(46);
  salto(6);
  pagina.drawRectangle({ x: MARGEN, y: y - 5, width: 3, height: 13, color: CIAN });
  pagina.drawText(sinRaros(texto.toUpperCase()), { x: MARGEN + 10, y, size: 9.3, font: negrita, color: AZUL });
  y -= 20;
}

function vinetas(items) {
  for (const item of items) escribir(`•  ${item}`, { sangria: 6 });
  salto(4);
}

function codigo(lineas) {
  const alto = lineas.length * 12 + 12;
  asegurar(alto);
  pagina.drawRectangle({ x: MARGEN, y: y - alto + 6, width: UTIL, height: alto, color: rgb(0.96, 0.97, 0.99) });
  let yy = y - 6;
  for (const l of lineas) {
    pagina.drawText(sinRaros(l), { x: MARGEN + 10, y: yy, size: 8.5, font: normal, color: AZUL });
    yy -= 12;
  }
  y -= alto + 6;
}

/* Portada */
pagina.drawRectangle({ x: 0, y: ALTO - 140, width: ANCHO, height: 140, color: AZUL });
pagina.drawRectangle({ x: MARGEN - 10, y: ALTO - 92, width: 150, height: (130 * 177) / 400 + 12, color: rgb(1, 1, 1) });
pagina.drawImage(logo, { x: MARGEN, y: ALTO - 86, width: 130, height: (130 * 177) / 400 });

y = ALTO - 186;
escribir("Plantillas de documentos", { size: 22, font: negrita, color: AZUL });
escribir("Qué necesitamos y en qué formato", { size: 11, color: GRIS });
salto(10);

escribir(
  "Para que la aplicación genere los documentos con la estructura de CEDEM necesitamos una plantilla por tipo de documento. No hace falta un formato especial: Word, Google Docs exportado a Word, o el mismo PDF."
);

seccion("1 · Qué documentos");
vinetas([
  "Presentación de caso individual.",
  "Presentación de grupo, para la junta técnica.",
  "Ficha global del alumno.",
]);

seccion("2 · Cómo llenarlas");
escribir("Llenas, no vacías.", { font: negrita });
escribir(
  "El ejemplo debe traer datos inventados pero completos de un alumno ficticio. Así se ve cuánto texto va en cada parte y con qué tono se escribe."
);
salto(4);

escribir("Con los encabezados tal como deben salir.", { font: negrita });
escribir(
  "Si la sección se llama Contexto del negocio, que se llame así en la plantilla: ese texto se copia al documento final."
);
salto(4);

escribir("Marcando lo que cambia de un alumno a otro.", { font: negrita });
escribir("Con dobles llaves alrededor del dato, así:");
salto(2);

codigo([
  "## Contexto del negocio",
  "{{empresa}} opera en {{ciudad}} y se dedica a {{giro}}.",
  "Su proyecto detonador es {{proyecto}}.",
]);

salto(2);
escribir("Marcadores disponibles. Podemos agregar los que hagan falta:", { size: 10 });
salto(2);

const MARCADORES = [
  ["{{alumno}}", "Nombre del alumno"],
  ["{{empresa}}", "Empresa"],
  ["{{cargo}}", "Puesto"],
  ["{{ciudad}}", "Ciudad"],
  ["{{giro}}", "Giro"],
  ["{{proyecto}}", "Proyecto detonador"],
  ["{{generacion}}", "Generación"],
  ["{{fecha_sesion}}", "Fecha de la sesión"],
  ["{{resumen}}", "Resumen de la sesión"],
  ["{{hallazgos}}", "Hallazgos con su cita"],
  ["{{compromisos}}", "Compromisos abiertos"],
  ["{{tareas}}", "Tareas y su estado"],
  ["{{brief}}", "Brief de contexto"],
  ["{{coach}}", "Nombre del coach"],
];

asegurar(MARCADORES.length * 14 + 8);
for (const [m, d] of MARCADORES) {
  pagina.drawText(m, { x: MARGEN + 8, y, size: 8.5, font: negrita, color: AZUL });
  pagina.drawText(sinRaros(d), { x: MARGEN + 130, y, size: 8.8, font: normal, color: NEGRO });
  y -= 14;
}
salto(6);

escribir("Y una nota por sección diciendo de dónde sale el contenido:", { font: negrita });
vinetas([
  "Dato fijo: lo escribe la plantilla y se copia tal cual.",
  "Dato del expediente: sale de la base, con uno de los marcadores.",
  "Redacción del agente: el modelo lo escribe a partir de las sesiones.",
]);

seccion("3 · Qué revisamos al recibirlas");
vinetas([
  "Que las secciones tengan un orden claro.",
  "Cuáles son fijas y cuáles dependen del alumno.",
  "Si hay tablas, cuántas columnas llevan y en qué orden.",
  "La longitud esperada de cada parte.",
  "Si llevan logo, pie de página o algún formato especial.",
]);

seccion("4 · Un detalle que evita documentos feos");
escribir(
  "Si una sección a veces no aplica —por ejemplo, Gobierno familiar cuando el alumno todavía no lo trabaja— déjenla escrita y anoten al lado: omitir si no hay información."
);
escribir(
  "Así el documento no sale con huecos vacíos, que es lo que más delata a un documento hecho por una máquina."
);

pie();
const bytes = await pdf.save();
fs.writeFileSync(path.join(RAIZ, "docs", "plantillas.pdf"), bytes);
console.log(`plantillas.pdf · ${pdf.getPageCount()} páginas`);
