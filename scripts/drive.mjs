#!/usr/bin/env node
/**
 * Propuesta: la metodología de CEDEM en Drive, consultable por el agente.
 *
 *   node scripts/drive.mjs
 */
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
  String(t)
    .replace(/[≈]/g, "~")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x00-\xFF•]/g, "");

function pie() {
  pagina.drawText("Metodología en Drive · MIEEF Coach · CEDEM", { x: MARGEN, y: 28, size: 8, font: normal, color: GRIS });
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
  const limpio = sinRaros(texto);
  const palabras = limpio.split(/\s+/).filter(Boolean);
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

const salto = (n = 10) => {
  y -= n;
};

function seccion(texto) {
  asegurar(50);
  salto(4);
  pagina.drawRectangle({ x: MARGEN, y: y - 5, width: 3, height: 14, color: CIAN });
  pagina.drawText(sinRaros(texto.toUpperCase()), { x: MARGEN + 10, y, size: 9.5, font: negrita, color: AZUL });
  y -= 22;
}

function vinetas(items) {
  for (const item of items) escribir(`•  ${item}`, { sangria: 6 });
  salto(4);
}

function nota(texto) {
  escribir(texto, { size: 9, font: cursiva, color: GRIS, sangria: 8 });
  salto(4);
}

function tabla(encabezados, filas, anchos) {
  const altoFila = 20;
  asegurar(altoFila * (filas.length + 1) + 8);

  let x = MARGEN;
  pagina.drawRectangle({ x: MARGEN, y: y - 6, width: UTIL, height: altoFila, color: rgb(0.94, 0.96, 0.99) });
  encabezados.forEach((h, i) => {
    pagina.drawText(sinRaros(h), { x: x + 6, y: y + 1, size: 8.5, font: negrita, color: AZUL });
    x += anchos[i];
  });
  y -= altoFila + 2;

  for (const fila of filas) {
    asegurar(altoFila);
    x = MARGEN;
    fila.forEach((celda, i) => {
      pagina.drawText(sinRaros(celda), { x: x + 6, y, size: 8.8, font: i === 0 ? normal : normal, color: NEGRO });
      x += anchos[i];
    });
    y -= 14;
    pagina.drawLine({
      start: { x: MARGEN, y: y + 6 },
      end: { x: ANCHO - MARGEN, y: y + 6 },
      thickness: 0.4,
      color: rgb(0.88, 0.9, 0.94),
    });
    y -= 4;
  }
  salto(6);
}

function flujo(pasos) {
  const ancho = (UTIL - 3 * 14) / 4;
  const alto = 62;
  asegurar(alto + 16);

  pasos.forEach((paso, i) => {
    const x = MARGEN + i * (ancho + 14);
    pagina.drawRectangle({
      x,
      y: y - alto,
      width: ancho,
      height: alto,
      color: rgb(0.96, 0.98, 1),
      borderColor: rgb(0.82, 0.88, 0.95),
      borderWidth: 1,
    });
    pagina.drawText(sinRaros(paso[0]), { x: x + 8, y: y - 18, size: 8.5, font: negrita, color: AZUL });
    pagina.drawText(sinRaros(paso[1]), { x: x + 8, y: y - 34, size: 7.5, font: normal, color: GRIS });
    pagina.drawText(sinRaros(paso[2]), { x: x + 8, y: y - 48, size: 7.5, font: normal, color: GRIS });

    if (i < pasos.length - 1) {
      pagina.drawText("›", { x: x + ancho + 4, y: y - 36, size: 14, font: negrita, color: CIAN });
    }
  });

  y -= alto + 16;
}

/* ------------------------------ Portada ------------------------------ */

pagina.drawRectangle({ x: 0, y: ALTO - 150, width: ANCHO, height: 150, color: AZUL });
pagina.drawRectangle({ x: MARGEN - 10, y: ALTO - 96, width: 170, height: (150 * 177) / 400 + 14, color: rgb(1, 1, 1) });
pagina.drawImage(logo, { x: MARGEN, y: ALTO - 90, width: 150, height: (150 * 177) / 400 });
pagina.drawText("Máster en Innovación y Emprendimiento en la Empresa Familiar", {
  x: MARGEN,
  y: ALTO - 132,
  size: 8.5,
  font: normal,
  color: rgb(0.8, 0.88, 0.97),
});

y = ALTO - 200;
escribir("La metodología en Drive, al alcance del agente", { size: 21, font: negrita, color: AZUL });
escribir("Propuesta para la Dirección de IA y Transformación Digital", { size: 11, color: GRIS });
salto(12);

escribir(
  "La firma ya tiene su metodología escrita: está en Drive, repartida en carpetas por programa, asignatura y generación. Hoy se consulta abriendo archivos uno por uno. La propuesta es que la aplicación la lea, la ordene y la tenga disponible para responder con la fuente a la mano."
);
salto(8);

escribir("La idea en una línea", { size: 11, font: negrita, color: AZUL });
escribir(
  "Drive sigue siendo el lugar donde se escribe y se actualiza la metodología; la aplicación la indexa y la convierte en respuestas citables dentro del expediente de cada alumno."
);
salto(6);

/* ------------------------------ Problema ------------------------------ */

seccion("1 · Qué pasa hoy");
vinetas([
  "La metodología vive en Drive, pero nadie la puede interrogar: se navega carpeta por carpeta.",
  "Cada coach resuelve sus dudas preguntándole a otro coach, no a la fuente.",
  "Cuando alguien actualiza un documento, la versión anterior sigue circulando en PDFs descargados.",
  "Lo que se produce en una sesión (minutas, compromisos) no se conecta con el material que lo sustenta.",
  "El conocimiento se va con quien se va: no hay memoria de qué se dijo, cuándo y con qué fundamento.",
]);

/* ------------------------------ Arquitectura ------------------------------ */

seccion("2 · Cómo funcionaría");

flujo([
  ["1 · Drive", "Carpeta raíz de", "metodología de CEDEM"],
  ["2 · Google", "Cuenta de servicio", "lee solo lo compartido"],
  ["3 · Aplicación", "Extrae texto, trocea", "y guarda con metadatos"],
  ["4 · Agente", "Responde y cita", "documento y página"],
]);

escribir(
  "La aplicación no copia el contenido a otro lugar para siempre: lo lee, lo indexa y lo vuelve a leer cuando el archivo cambia. Drive manda; la aplicación obedece."
);
salto(6);

tabla(
  ["Pieza", "Cómo se resuelve"],
  [
    ["Acceso", "Cuenta de servicio de Google con permiso de lectura sobre la carpeta raíz"],
    ["Tipos de archivo", "Docs, PDF, Word, PowerPoint y Sheets; escaneados con OCR"],
    ["Detección de cambios", "Consulta periódica por fecha de modificación, o avisos de Drive"],
    ["Texto", "Extracción por tipo; se guarda el texto plano, no el archivo"],
    ["Búsqueda", "Índice de texto completo en español, ya construido"],
    ["Metadatos", "Programa, asignatura, generación, autor, vigencia y ruta en Drive"],
    ["Respuesta", "El agente cita documento y fragmento; si no hay fuente, lo dice"],
  ],
  [130, 350]
);

/* ------------------------------ Estructura ------------------------------ */

seccion("3 · Cómo conviene ordenar la carpeta");
nota("La calidad de las respuestas depende más del orden de las carpetas que del modelo.");

tabla(
  ["Nivel", "Ejemplo", "Para qué sirve"],
  [
    ["Programa", "MIEEF 2026-27", "Separa generaciones y versiones"],
    ["Bloque", "01 Fundamentos", "Agrupa por etapa del máster"],
    ["Sesión", "S3 Criterios operativos", "Une material, ejercicios y guía"],
    ["Tipo", "Guía del coach, lectura, rúbrica", "Distingue qué citar a quién"],
  ],
  [90, 190, 200]
);

vinetas([
  "Un documento por idea: un archivo que mezcla seis temas se recupera mal.",
  "Nombres con fecha de versión al inicio: 2026-09 Guía del coach S3.",
  "Nada de copias con \"final\", \"final 2\", \"final buena\": el agente no sabe cuál vale.",
  "Los permisos de Drive se respetan: lo que no esté compartido con la cuenta de servicio no se lee.",
]);

/* ------------------------------ Qué gana ------------------------------ */

seccion("4 · Qué gana la firma");
vinetas([
  "Se actualiza en un solo lugar: quien edita el documento en Drive cambia la respuesta del agente.",
  "Cada respuesta trae la fuente, así el coach puede verificarla y citarla.",
  "El material nuevo entra sin subirlo a mano a otra herramienta.",
  "Se puede medir qué documentos se consultan y cuáles no sirven a nadie.",
  "El expediente del alumno queda unido al material que lo sustenta.",
]);

/* ------------------------------ Riesgos ------------------------------ */

seccion("5 · Riesgos y cómo se controlan");
tabla(
  ["Riesgo", "Control"],
  [
    ["Se indexa algo que no debía", "Solo la carpeta autorizada; la cuenta de servicio no ve el resto del Drive"],
    ["Documento desactualizado", "Se guarda la fecha de modificación y se muestra al citar"],
    ["Cambios sin revisar", "Aprobación de la coordinación antes de publicar una nueva versión"],
    ["Contenido de terceros", "Solo material propio o con derechos; se excluyen manuales de editoriales"],
    ["Dependencia de Google", "El texto indexado permite migrar; no se guardan archivos, solo texto"],
  ],
  [180, 300]
);

/* ------------------------------ Plan ------------------------------ */

nueva();
seccion("6 · Cómo lo probaría");
tabla(
  ["Etapa", "Alcance", "Tiempo"],
  [
    ["Piloto", "Una asignatura completa, entre 10 y 20 documentos", "1 semana"],
    ["Validación", "Los coaches preguntan y califican las respuestas", "2 semanas"],
    ["Despliegue", "Todas las asignaturas del semestre", "2 semanas"],
  ],
  [110, 290, 90]
);

escribir(
  "La prueba se considera buena si, ante diez preguntas reales de coaches, el agente responde con la fuente correcta en al menos ocho y no inventa en las otras dos."
);
salto(8);

nota(
  "Costo: la API de Drive no se cobra. El gasto aparece solo al consultar, y hoy la inteligencia artificial representa cerca del 2% del costo mensual de la plataforma."
);

seccion("7 · Lo que se necesita para empezar");
vinetas([
  "La autorización de la coordinación para compartir la carpeta de metodología con la cuenta de servicio.",
  "Una decisión sobre qué carpetas entran al piloto: idealmente una asignatura completa, no todo el Drive.",
  "Treinta minutos con quien mantiene esa carpeta para acordar nombres y versiones.",
]);

salto(4);
escribir(
  "El piloto no compromete nada: se puede apagar en un minuto y la carpeta se puede dejar de compartir cuando se quiera. Lo único que deja es la medición de si el agente responde con la fuente correcta.",
  { size: 10, font: negrita, color: AZUL }
);

pie();
const bytes = await pdf.save();
fs.writeFileSync(path.join(RAIZ, "docs", "metodologia-drive.pdf"), bytes);
console.log(`metodologia-drive.pdf · ${pdf.getPageCount()} páginas`);
