#!/usr/bin/env node
/**
 * Genera la propuesta económica en PDF para los dueños.
 *
 *   node scripts/propuesta.mjs
 *
 * Los números se calculan aquí mismo con las tarifas oficiales de DeepSeek,
 * así que si cambian los supuestos se ajustan en un solo lugar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const SALIDA = path.join(RAIZ, "docs");
const LOGO = fs.readFileSync(path.join(RAIZ, "public", "mief.png"));

/* ------------------------- Tarifas y supuestos ------------------------- */

const MXN_POR_CNY = 2.6; // 1 yuan ≈ 2.6 pesos
const MXN_POR_USD = 18.4;

const PRECIO = {
  entrada: 2, // yuan por millón de tokens (tarifa de pico, deepseek-flash)
  salida: 8, // yuan por millón
  busqueda: 5 / 1000, // yuan por búsqueda web
};

const OPERACIONES = {
  analisis: { nombre: "Análisis de una sesión", entrada: 3408, salida: 575 },
  ajuste: { nombre: "Corrección de una minuta", entrada: 4500, salida: 800 },
  chat: { nombre: "Mensaje al agente", entrada: 5000, salida: 350 },
  consejo: { nombre: "Análisis de un Consejo", entrada: 6000, salida: 900 },
  brief: { nombre: "Brief de contexto", entrada: 30000, salida: 3000, busquedas: 3 },
};

function costoMXN({ entrada = 0, salida = 0, busquedas = 0 }) {
  const yuan =
    (entrada / 1_000_000) * PRECIO.entrada +
    (salida / 1_000_000) * PRECIO.salida +
    busquedas * PRECIO.busqueda;
  return yuan * MXN_POR_CNY;
}

const VOLUMEN = {
  analisis: 20, // 4 coaches × 5 alumnos
  ajuste: 20, // una corrección por sesión
  consejo: 4, // uno al mes por coach
  chat: 120, // ~6 mensajes por sesión
  brief: 20 / 12, // 20 alumnos al año, prorrateado
};

const COSTO_MES = Object.fromEntries(
  Object.entries(VOLUMEN).map(([clave, veces]) => [clave, veces * costoMXN(OPERACIONES[clave])])
);

const TOTAL_IA = Object.values(COSTO_MES).reduce((a, b) => a + b, 0);
const INFRA = {
  supabase: 25 * MXN_POR_USD,
  hosting: 5 * MXN_POR_USD,
  dominio: (15 * MXN_POR_USD) / 12,
};
const TOTAL_INFRA = Object.values(INFRA).reduce((a, b) => a + b, 0);
const TOTAL = TOTAL_IA + TOTAL_INFRA;
const TOTAL_3X = TOTAL_IA * 3 + TOTAL_INFRA;

const costoPorSesion = costoMXN(OPERACIONES.analisis) + costoMXN(OPERACIONES.ajuste) + 6 * costoMXN(OPERACIONES.chat);

const sinRaros = (t) =>
  String(t)
    .replace(/[≈]/g, "~")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x00-\xFF•]/g, "");

const mxn = (n) =>
  `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => n.toLocaleString("es-MX");

/* ------------------------------ Render ------------------------------ */

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

function pie() {
  pagina.drawText("Propuesta económica · MIEEF Coach · CEDEM", { x: MARGEN, y: 28, size: 8, font: normal, color: GRIS });
  pagina.drawText(String(numero), {
    x: ANCHO - MARGEN - negrita.widthOfTextAtSize(String(numero), 9),
    y: 28,
    size: 9,
    font: negrita,
    color: GRIS,
  });
}

function nueva() {
  pie();
  pagina = pdf.addPage([ANCHO, ALTO]);
  numero += 1;
  y = ALTO - MARGEN - 46;
  const a = 86;
  pagina.drawImage(logo, { x: MARGEN, y: ALTO - MARGEN - 22, width: a, height: (a * 177) / 400 });
}

function asegurar(alto) {
  if (y - alto < 60) nueva();
}

function escribir(texto, { size = 10.5, font = normal, color = NEGRO, sangria = 0, salto } = {}) {
  const limpio = sinRaros(String(texto).replace(/\*\*/g, ""));
  const palabras = limpio.split(/\s+/).filter(Boolean);
  const interlinea = salto ?? size * 1.42;
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
  salto(6);
  pagina.drawRectangle({ x: MARGEN, y: y - 5, width: 3, height: 14, color: CIAN });
  pagina.drawText(texto.toUpperCase(), { x: MARGEN + 10, y, size: 9.5, font: negrita, color: AZUL });
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
  asegurar(altoFila * (filas.length + 1) + 10);

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
      const esNumero = i > 0;
      pagina.drawText(sinRaros(celda), {
        x: x + 6,
        y,
        size: 9,
        font: esNumero ? negrita : normal,
        color: NEGRO,
      });
      x += anchos[i];
    });
    y -= altoFila - 4;
    pagina.drawLine({ start: { x: MARGEN, y: y + 8 }, end: { x: ANCHO - MARGEN, y: y + 8 }, thickness: 0.4, color: rgb(0.88, 0.9, 0.94) });
    y -= 4;
  }
  salto(6);
}

function destacado(etiqueta, valor, detalle) {
  asegurar(70);
  pagina.drawRectangle({ x: MARGEN, y: y - 56, width: UTIL, height: 64, color: rgb(0.96, 0.98, 1), borderColor: rgb(0.85, 0.9, 0.96), borderWidth: 1 });
  pagina.drawText(sinRaros(etiqueta.toUpperCase()), { x: MARGEN + 16, y: y - 14, size: 8, font: negrita, color: GRIS });
  pagina.drawText(sinRaros(valor), { x: MARGEN + 16, y: y - 42, size: 24, font: negrita, color: AZUL });
  pagina.drawText(sinRaros(detalle), { x: MARGEN + 190, y: y - 36, size: 9, font: normal, color: GRIS });
  y -= 76;
}

/* ------------------------------ Portada ------------------------------ */

pagina.drawRectangle({ x: 0, y: ALTO - 150, width: ANCHO, height: 150, color: AZUL });
const anchoPortada = 150;
const altoPortada = (anchoPortada * 177) / 400;
pagina.drawRectangle({ x: MARGEN - 10, y: ALTO - 96, width: anchoPortada + 20, height: altoPortada + 14, color: rgb(1, 1, 1) });
pagina.drawImage(logo, { x: MARGEN, y: ALTO - 90, width: anchoPortada, height: altoPortada });
pagina.drawText("Máster en Innovación y Emprendimiento en la Empresa Familiar", {
  x: MARGEN,
  y: ALTO - 132,
  size: 8.5,
  font: normal,
  color: rgb(0.8, 0.88, 0.97),
});

y = ALTO - 200;
escribir("Lo que cuesta la plataforma y lo que devuelve", { size: 22, font: negrita, color: AZUL });
escribir("Estimación mensual de costos y comparación con monday.com", { size: 12, color: GRIS });
salto(14);

escribir(
  "Una plataforma propia cuesta la mitad de lo que costarían las cinco licencias de monday.com que el equipo necesitaría, y hace lo que monday no puede: leer la sesión, escribir la minuta, seguir los compromisos y conocer la metodología de la firma."
);
salto(10);

destacado("Costo total estimado al mes", `${mxn(TOTAL)} MXN`, `≈ ${mxn(TOTAL / MXN_POR_USD)} USD · IA + infraestructura`);
destacado("Costo de IA por sesión", `${mxn(costoPorSesion)} MXN`, "análisis, minuta y la conversación del coach");

nota("Cifras calculadas con las tarifas públicas de DeepSeek y precios de nube al momento de escribir. Los supuestos están en la página siguiente para poder ajustarlos.");

/* ---------------------------- Supuestos ---------------------------- */

seccion("1 · Con qué se calculó");
tabla(
  ["Supuesto", "Valor"],
  [
    ["Coaches", "4"],
    ["Alumnos por coach", "5 (20 en total)"],
    ["Sesiones individuales", "1 al mes por alumno, 2 horas"],
    ["Consejo", "1 al mes por coach, 4 horas"],
    ["Clases del máster", "4 al mes, 11 meses"],
    ["Audio", "No se usa: todo entra como transcripción o documento"],
    ["Horizonte", "12 meses"],
  ],
  [200, 280]
);

nota(
  "Subir una clase o un documento no tiene costo de inteligencia artificial: el texto se guarda y solo se consulta cuando un coach hace una pregunta. El gasto aparece al analizar sesiones, corregir minutas y conversar con el agente."
);

/* ---------------------------- Costos por operación ---------------------------- */

seccion("2 · Qué cuesta cada operación");
tabla(
  ["Operación", "Entrada", "Salida", "Costo"],
  [
    ["Análisis de una sesión", "3,408", "575", mxn(costoMXN(OPERACIONES.analisis))],
    ["Corrección de una minuta", "4,500", "800", mxn(costoMXN(OPERACIONES.ajuste))],
    ["Mensaje al agente", "5,000", "350", mxn(costoMXN(OPERACIONES.chat))],
    ["Análisis de un Consejo", "6,000", "900", mxn(costoMXN(OPERACIONES.consejo))],
    ["Brief de contexto", "30,000", "3,000", mxn(costoMXN(OPERACIONES.brief))],
  ],
  [190, 100, 90, 100]
);
nota("Entrada y salida son tokens. Un token es más o menos tres cuartos de palabra; 12,000 caracteres de transcripción son unos 3,400 tokens.");

/* ---------------------------- Consumo mensual ---------------------------- */

seccion("3 · Consumo estimado al mes");
tabla(
  ["Concepto", "Veces al mes", "Costo"],
  [
    ["Análisis de sesiones", num(VOLUMEN.analisis), mxn(COSTO_MES.analisis)],
    ["Correcciones de minuta", num(VOLUMEN.ajuste), mxn(COSTO_MES.ajuste)],
    ["Análisis de Consejos", num(VOLUMEN.consejo), mxn(COSTO_MES.consejo)],
    ["Mensajes al agente", num(Math.round(VOLUMEN.chat)), mxn(COSTO_MES.chat)],
    ["Briefs (prorrateado)", "1.7", mxn(COSTO_MES.brief)],
  ],
  [220, 120, 120]
);

escribir(`Total de inteligencia artificial: ${mxn(TOTAL_IA)} MXN al mes.`, { font: negrita, color: VERDE });
salto(8);

/* ---------------------------- Infraestructura ---------------------------- */

seccion("4 · Infraestructura");
tabla(
  ["Concepto", "Al mes"],
  [
    ["Base de datos, archivos y cuentas (Supabase Pro)", mxn(INFRA.supabase)],
    ["Publicación de la aplicación (AWS Amplify)", mxn(INFRA.hosting)],
    ["Dominio", mxn(INFRA.dominio)],
  ],
  [330, 120]
);

destacado("Total mensual", `${mxn(TOTAL)} MXN`, "IA + infraestructura, con el uso de los supuestos");
escribir(
  `Aun si el uso se triplicara —más sesiones, más preguntas, más correcciones— el total sería de ${mxn(TOTAL_3X)} MXN al mes. La infraestructura es fija; la IA es la única parte que crece con el uso, y hoy representa ${Math.round((TOTAL_IA / TOTAL) * 100)}% del total.`,
  { size: 10 }
);

nota(
  "Precios de referencia: DeepSeek, tarifa de pico, 2 yuanes por millón de tokens de entrada y 8 por millón de salida; búsqueda web 5 yuanes por mil consultas. Tipo de cambio 2.6 MXN por yuan y 18.4 MXN por dólar."
);

/* ---------------------------- Comparación ---------------------------- */

seccion("5 · Contra monday.com");
tabla(
  ["Concepto", "monday.com", "MIEEF Coach"],
  [
    ["Costo mensual (5 personas)", "≈ $1,100 MXN", mxn(TOTAL) + " MXN"],
    ["Minutas a partir de la sesión", "No", "Sí"],
    ["Seguimiento de compromisos", "Manual", "Automático"],
    ["Metodología de la firma consultable", "No", "Sí"],
    ["Reportes de avance por alumno", "Manual", "Automático"],
    ["Datos de los alumnos", "En un tercero", "En la base de CEDEM"],
  ],
  [200, 130, 150]
);

nota("monday.com, plan Standard, ≈ 12 USD por usuario al mes. Con 4 coaches y la coordinación son 5 licencias. No incluye generación de documentos ni análisis de conversaciones.");

/* ---------------------------- Valor ---------------------------- */

seccion("6 · Lo que devuelve");
const sesionesMes = VOLUMEN.analisis + VOLUMEN.consejo;
const horasMes = (sesionesMes * 40) / 60;

escribir(
  `Al mes se generan ${sesionesMes} documentos entre sesiones y Consejos. Si cada uno le toma al coach 40 minutos —leer, resumir, redactar la minuta y dejar la ficha— son ${Math.round(
    horasMes
  )} horas de trabajo administrativo que la plataforma hace sola.`,
  { size: 10.5 }
);
salto(6);

tabla(
  ["Si la hora del coach cuesta", "Ahorro al mes", "Veces el costo de la app"],
  [
    ["$500 MXN", mxn(horasMes * 500), `${Math.round((horasMes * 500) / TOTAL)}×`],
    ["$800 MXN", mxn(horasMes * 800), `${Math.round((horasMes * 800) / TOTAL)}×`],
    ["$1,200 MXN", mxn(horasMes * 1200), `${Math.round((horasMes * 1200) / TOTAL)}×`],
  ],
  [170, 150, 150]
);

/* ---------------------------- Convencimiento ---------------------------- */

seccion("7 · Por qué conviene");
vinetas([
  "El conocimiento se queda en CEDEM. Las clases, la metodología y las transcripciones viven en una base de la firma, no en computadoras personales ni en el chat de alguien.",
  "El coach deja de ser administrador de su propio trabajo: llega a la sesión con el expediente leído y sale con la minuta hecha.",
  "Se puede demostrar el avance: compromisos, tareas de aplicación y temas vistos por alumno, con fecha y evidencia.",
  "El agente cita la fuente: cada afirmación viene de una sesión, de una clase o del material cargado. No inventa.",
  "Los datos están aislados por coach: cada quien ve a sus alumnos; la coordinación ve todo.",
  "Cuesta la mitad que las cinco licencias de monday.com y no crece con el número de alumnos: la IA se paga por uso, no por persona.",
]);

salto(4);
escribir(
  "La decisión no es entre una app y una hoja de cálculo: es entre seguir pagando horas de trabajo administrativo todos los meses, o invertir el equivalente a dos comidas de equipo en que ese trabajo lo haga el sistema.",
  { size: 10.5, font: negrita, color: AZUL }
);

/* ---------------------------- Cierre ---------------------------- */

seccion("8 · Qué falta para arrancar");
vinetas([
  "Definir quién es el administrador y crear las cuentas de los cuatro coaches.",
  "Cargar las clases y la metodología del primer semestre.",
  "Definir un tope de gasto mensual en la consola de DeepSeek, para que el costo nunca sorprenda.",
  "Capacitar a los coaches en una sesión de 30 minutos.",
]);

pie();
const bytes = await pdf.save();
fs.writeFileSync(path.join(SALIDA, "propuesta-economica.pdf"), bytes);
console.log(`propuesta-economica.pdf · ${pdf.getPageCount()} páginas · total ${mxn(TOTAL)} MXN/mes`);
