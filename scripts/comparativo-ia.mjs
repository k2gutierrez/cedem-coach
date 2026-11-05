#!/usr/bin/env node
/**
 * Comparativo interno: precios y privacidad de DeepSeek, Gemini y OpenAI.
 * No forma parte de la propuesta comercial.
 *
 *   node scripts/comparativo-ia.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const LOGO = fs.readFileSync(path.join(RAIZ, "public", "mief.png"));

const MXN_POR_USD = 18.4;

/* Precios en USD por millón de tokens (entrada / salida). */
const MODELOS = [
  { nombre: "DeepSeek flash", entrada: 0.28, salida: 1.13, nota: "2 y 8 yuanes; tarifa de pico" },
  { nombre: "Gemini 2.5 Flash-Lite", entrada: 0.1, salida: 0.4, nota: "" },
  { nombre: "Gemini 2.5 Flash", entrada: 0.3, salida: 2.5, nota: "" },
  { nombre: "GPT-4o mini", entrada: 0.15, salida: 0.6, nota: "" },
  { nombre: "GPT-4.1 mini", entrada: 0.4, salida: 1.6, nota: "" },
  { nombre: "Gemini 2.5 Pro", entrada: 1.25, salida: 10, nota: "" },
  { nombre: "GPT-4o", entrada: 2.5, salida: 10, nota: "" },
];

/* Nuestra carga mensual, con los supuestos de la propuesta. */
const TOKENS = { entrada: 1_591_320, salida: 147_700 };

for (const m of MODELOS) {
  m.costoUSD = (TOKENS.entrada / 1e6) * m.entrada + (TOKENS.salida / 1e6) * m.salida;
  m.costoMXN = m.costoUSD * MXN_POR_USD;
}

const AZUL = rgb(0.043, 0.184, 0.42);
const CIAN = rgb(0.055, 0.604, 0.839);
const GRIS = rgb(0.33, 0.38, 0.48);
const NEGRO = rgb(0.09, 0.13, 0.18);
const VERDE = rgb(0.1, 0.5, 0.29);
const AMBAR = rgb(0.68, 0.42, 0.03);

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
  pagina.drawText("Comparativo de proveedores de IA · uso interno · no se entrega al cliente", {
    x: MARGEN,
    y: 28,
    size: 7.5,
    font: normal,
    color: GRIS,
  });
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
  escribir(texto, { size: 8.8, font: cursiva, color: GRIS, sangria: 8 });
  salto(4);
}

function tabla(encabezados, filas, anchos, colores = {}) {
  const altoFila = 19;
  asegurar(altoFila * (filas.length + 1) + 8);

  let x = MARGEN;
  pagina.drawRectangle({ x: MARGEN, y: y - 6, width: UTIL, height: altoFila, color: rgb(0.94, 0.96, 0.99) });
  encabezados.forEach((h, i) => {
    pagina.drawText(sinRaros(h), { x: x + 6, y: y + 1, size: 8.3, font: negrita, color: AZUL });
    x += anchos[i];
  });
  y -= altoFila + 2;

  filas.forEach((fila, indice) => {
    asegurar(altoFila);
    x = MARGEN;
    fila.forEach((celda, i) => {
      pagina.drawText(sinRaros(celda), {
        x: x + 6,
        y,
        size: 8.8,
        font: i === 0 ? negrita : normal,
        color: colores[indice] ?? NEGRO,
      });
      x += anchos[i];
    });
    y -= 13;
    pagina.drawLine({
      start: { x: MARGEN, y: y + 5 },
      end: { x: ANCHO - MARGEN, y: y + 5 },
      thickness: 0.4,
      color: rgb(0.88, 0.9, 0.94),
    });
    y -= 4;
  });
  salto(6);
}

const mxn = (n) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ------------------------------ Portada ------------------------------ */

pagina.drawRectangle({ x: 0, y: ALTO - 150, width: ANCHO, height: 150, color: AZUL });
pagina.drawRectangle({ x: MARGEN - 10, y: ALTO - 96, width: 170, height: (150 * 177) / 400 + 14, color: rgb(1, 1, 1) });
pagina.drawImage(logo, { x: MARGEN, y: ALTO - 90, width: 150, height: (150 * 177) / 400 });
pagina.drawText("Uso interno · no forma parte de la propuesta comercial", {
  x: MARGEN,
  y: ALTO - 132,
  size: 8.5,
  font: normal,
  color: rgb(0.8, 0.88, 0.97),
});

y = ALTO - 200;
escribir("Proveedores de IA: precio y privacidad", { size: 21, font: negrita, color: AZUL });
escribir("DeepSeek, Google Gemini y OpenAI frente a nuestra carga real", { size: 11, color: GRIS });
salto(12);

escribir(
  "Este documento compara lo que costaría la misma operación con cada proveedor y, sobre todo, cómo trata cada uno los datos que le enviamos. La conclusión corta: en dinero la diferencia es de centavos; en privacidad, no."
);

/* ------------------------------ Precios ------------------------------ */

seccion("1 · Precio por millón de tokens");
tabla(
  ["Modelo", "Entrada", "Salida"],
  MODELOS.map((m) => [m.nombre, `$${m.entrada.toFixed(2)}`, `$${m.salida.toFixed(2)}`]),
  [220, 110, 110]
);
nota(
  "Dólares por millón de tokens. DeepSeek publica en yuanes (2 y 8 por millón, tarifa de pico; la mitad en horario valle). El tipo de cambio usado es 7.1 yuanes por dólar."
);

seccion("2 · Nuestra carga al mes");
escribir(
  `Con los supuestos de la propuesta —40 sesiones, 4 Consejos, 240 mensajes al agente y los briefs— el consumo es de ${(
    TOKENS.entrada / 1e6
  ).toFixed(2)} millones de tokens de entrada y ${(TOKENS.salida / 1e6).toFixed(2)} de salida.`
);
salto(4);

tabla(
  ["Modelo", "Costo al mes", "En pesos"],
  MODELOS.map((m) => [m.nombre, `$${m.costoUSD.toFixed(2)} USD`, mxn(m.costoMXN)]),
  [220, 130, 130]
);

escribir(
  `La diferencia entre el más caro y el más barato es de ${mxn(
    MODELOS[MODELOS.length - 1].costoMXN - MODELOS[0].costoMXN
  )} al mes. Frente a los $575 de infraestructura, es ruido: elegir proveedor por precio no mueve la aguja.`
);
salto(6);

/* ------------------------------ Privacidad ------------------------------ */

seccion("3 · Qué hace cada uno con nuestros datos");
tabla(
  ["", "DeepSeek", "Gemini (pagado)", "OpenAI API"],
  [
    ["¿Entrena con datos?", "No lo excluye", "No", "No"],
    ["Revisión humana", "No declarada", "Solo si es gratis", "No por defecto"],
    ["Retención", "No especifica", "Tránsito y caché", "30 días"],
    ["Exclusión", "No", "No aplica", "ZDR con permiso"],
    ["Alojamiento", "China", "Cualquier país", "Estados Unidos"],
    ["Ley aplicable", "China", "California / UE", "Estados Unidos"],
  ],
  [150, 110, 115, 108]
);

vinetas([
  "OpenAI: desde el 1 de marzo de 2023, el contenido enviado a la API no se usa para entrenar ni mejorar sus modelos, salvo que uno lo autorice. Los registros de abuso se guardan hasta 30 días; la retención cero existe, con aprobación.",
  "Gemini: la cláusula de mejora aplica a la capa gratuita y a AI Studio, donde además revisores humanos pueden leer las entradas y salidas. En la capa pagada el contenido no se usa para mejorar productos, aunque puede guardarse de forma transitoria en cualquier país.",
  "DeepSeek: los términos reconocen que conservas los derechos sobre tus entradas y te ceden las salidas, pero no incluyen una cláusula que prohíba usar lo enviado para mejorar el servicio. La ley aplicable es la de China continental.",
]);

/* ------------------------------ Lectura ------------------------------ */

seccion("4 · Cómo lo leo");
vinetas([
  "Para el volumen de esta operación, el precio no decide: cualquiera de los tres cuesta menos de $30 MXN al mes.",
  "Si la privacidad es prioridad —y en consultoría con empresas familiares lo es—, DeepSeek es el eslabón débil: no promete no entrenar y su marco legal es otro.",
  "Una salida razonable: usar OpenAI o Gemini pagado para todo lo que contenga datos de alumnos, y dejar DeepSeek solo para tareas sin datos personales (por ejemplo, redactar una plantilla).",
  "El costo de mover todo a OpenAI con GPT-4o mini sería de alrededor de " + mxn(MODELOS[3].costoMXN) + " al mes: unos cuantos pesos más que hoy.",
  "Si se quiere conservar el proveedor actual, la decisión debe ser consciente y documentada: qué se envía, qué no, y con qué contrato.",
]);

nota(
  "Fuentes: página de precios y términos de la plataforma de DeepSeek; términos de la API de Gemini; guía de uso de datos de OpenAI. Consultadas en noviembre de 2026."
);

pie();
const bytes = await pdf.save();
fs.writeFileSync(path.join(RAIZ, "docs", "comparativo-ia.pdf"), bytes);
console.log(`comparativo-ia.pdf · ${pdf.getPageCount()} páginas`);
