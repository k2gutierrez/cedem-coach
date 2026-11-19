#!/usr/bin/env node
/** Recomendaciones para preguntarle al agente.  node scripts/recomendaciones.mjs */
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
const VERDE = rgb(0.1, 0.5, 0.29);
const ROJO = rgb(0.72, 0.16, 0.12);

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
  pagina.drawText("Cómo preguntarle al agente · MIEEF Coach · CEDEM", { x: MARGEN, y: 28, size: 8, font: normal, color: GRIS });
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

function escribir(texto, { size = 10.5, font = normal, color = NEGRO, sangria = 0 } = {}) {
  const palabras = sinRaros(texto).split(/\s+/).filter(Boolean);
  const interlinea = size * 1.42;
  let linea = "";

  for (const palabra of palabras) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(prueba, size) > UTIL - sangria && linea) {
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
}

const salto = (n = 8) => {
  y -= n;
};

function seccion(texto) {
  asegurar(70);
  salto(6);
  pagina.drawRectangle({ x: MARGEN, y: y - 5, width: 3, height: 13, color: CIAN });
  pagina.drawText(sinRaros(texto.toUpperCase()), { x: MARGEN + 10, y, size: 9.3, font: negrita, color: AZUL });
  y -= 20;
}

function vinetas(items) {
  for (const item of items) escribir(`•  ${item}`, { sangria: 6 });
  salto(4);
}

function pareja(malo, bueno) {
  asegurar(52);
  escribir(`En vez de: “${malo}”`, { size: 9.5, color: ROJO, sangria: 6 });
  escribir(`Pregunta: “${bueno}”`, { size: 9.8, color: VERDE, sangria: 6, font: negrita });
  salto(3);
}

function nota(texto) {
  escribir(texto, { size: 9, font: cursiva, color: GRIS, sangria: 8 });
  salto(4);
}

/* Portada */
pagina.drawRectangle({ x: 0, y: ALTO - 140, width: ANCHO, height: 140, color: AZUL });
pagina.drawRectangle({ x: MARGEN - 10, y: ALTO - 92, width: 150, height: (130 * 177) / 400 + 12, color: rgb(1, 1, 1) });
pagina.drawImage(logo, { x: MARGEN, y: ALTO - 86, width: 130, height: (130 * 177) / 400 });

y = ALTO - 186;
escribir("Cómo preguntarle al agente", { size: 22, font: negrita, color: AZUL });
escribir("Guía para Lorena y Galia", { size: 11, color: GRIS });
salto(10);

escribir(
  "No hace falta saberse los nombres exactos de las tareas ni las fechas. El agente busca por tema. Esta guía explica qué sí depende de ustedes y qué ya quedó resuelto del lado del sistema."
);

seccion("1 · De dónde saca la información");
vinetas([
  "Catálogo de tareas de aplicación — la fuente oficial para todo lo de tareas.",
  "Consejos — fecha, coach y, si ya se analizó, lo que se habló.",
  "Expediente del alumno — sesiones, resúmenes, hallazgos y compromisos.",
  "Material de la firma — clases, metodología y documentos que sube la coordinación.",
]);

nota("Si un dato no está en ninguna de esas cuatro fuentes, el agente no lo puede inventar: dirá que no lo encontró.");

seccion("2 · Cómo preguntar para que acierte");
vinetas([
  "Nombra el tema, no el nombre exacto. “Mejora discontinua” funciona; “TA03” no es necesario.",
  "Una pregunta, un tema. Si pides tres cosas a la vez, contesta una.",
  "Di de quién hablas si no es obvio: “de Dalila”, “de la sesión 2”.",
  "Si no sabe, reformula con otras palabras antes de concluir que falta información.",
  "Cuando pidas un documento, pide el documento (“genera la minuta”), no lo describas.",
]);

seccion("3 · Ejemplos");
pareja("Dame la tarea TA03 de la sesión 2", "¿Qué tareas de aplicación hay en la sesión 2?");
pareja("Info del consejo 5", "¿Qué se habló en el Consejo de Dalila de noviembre?");
pareja("Resume lo que subí", "¿Qué dice el material sobre creación de valor?");
pareja("Dime todo de los alumnos", "¿Qué compromisos tiene abiertos este alumno?");
pareja("¿Ya cargué las tareas?", "¿Qué tareas de aplicación tiene el programa?");

seccion("4 · Cómo subir material para que lo encuentre");
vinetas([
  "Título que diga el tema y la sesión: “S1 Estrategias — Base de conocimiento”.",
  "Un tema por archivo. Un archivo con seis temas se recupera mal.",
  "Si actualizas, usa el mismo título: reemplaza al anterior y borra la versión vieja.",
  "Las tareas van al catálogo (Administración → Agregar tarea), no en un archivo aparte.",
  "Antes de subir una versión nueva, borra la anterior desde Administración.",
]);

seccion("5 · Cuando dice “no encontré información”");
vinetas([
  "Revisa si el material está cargado: Administración → Material cargado.",
  "Reformula con palabras del documento (un término que aparezca en el texto).",
  "Si es de un alumno, confirma que ese alumno tenga sesiones analizadas.",
  "Si es un Consejo, verifica que esté como “Consejo” y no como sesión individual.",
]);

seccion("6 · Lo que ya no depende de ustedes");
vinetas([
  "El agente ya no mezcla coaches: si preguntas por Dalila, no te contesta con lo de otro.",
  "Ya lee las minutas de los Consejos, no solo las fechas.",
  "El catálogo de tareas tiene prioridad sobre cualquier archivo.",
  "Cada respuesta cita de dónde salió: sesión, Consejo o material.",
]);

nota(
  "El agente busca por coincidencia de palabras. Si la pregunta y el documento no comparten ningún término, puede no encontrar el fragmento aunque el tema esté ahí. Nombrar el tema es lo que más ayuda."
);

pie();
const bytes = await pdf.save();
fs.writeFileSync(path.join(RAIZ, "docs", "recomendaciones-agente.pdf"), bytes);
console.log(`recomendaciones-agente.pdf · ${pdf.getPageCount()} páginas`);
