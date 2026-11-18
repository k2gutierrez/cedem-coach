#!/usr/bin/env node
/** Ficha de la aplicación para auditoría administrativa.  node scripts/dossier.mjs */
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
  pagina.drawText("MIEEF Coach · ficha de la aplicación · CEDEM", { x: MARGEN, y: 28, size: 8, font: normal, color: GRIS });
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
      pagina.drawText(sinRaros(celda), { x: x + 6, y, size: 8.8, font: i === 0 ? negrita : normal, color: NEGRO });
      x += anchos[i];
    });
    y -= 13;
    pagina.drawLine({ start: { x: MARGEN, y: y + 5 }, end: { x: ANCHO - MARGEN, y: y + 5 }, thickness: 0.4, color: rgb(0.88, 0.9, 0.94) });
    y -= 4;
  }
  salto(6);
}

/* Portada */
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
escribir("MIEEF Coach", { size: 26, font: negrita, color: AZUL });
escribir("Qué es, qué hace y para qué sirve", { size: 12, color: GRIS });
salto(10);
escribir("Documento de referencia para auditoría administrativa · noviembre de 2026", { size: 10, font: cursiva, color: GRIS });
salto(14);

escribir(
  "MIEEF Coach es la plataforma de trabajo del equipo de coaching del Máster. Concentra el expediente de cada alumno, convierte las sesiones en documentos y deja registro de lo que se acordó. No es un CRM ni un sistema de facturación: su alcance es el acompañamiento y su evidencia documental.",
  { size: 10.8 }
);

/* Qué es */
seccion("1 · Qué es");
vinetas([
  "Una aplicación web de uso interno, a la que se entra con correo y contraseña.",
  "Dos tipos de cuenta: coach y administración. Cada coach ve únicamente a sus alumnos; la administración ve a todos.",
  "El sistema de registro central: alumnos, sesiones, acuerdos, tareas, material de la firma y conversaciones con el agente.",
  "Un generador de documentos: minutas, fichas, presentaciones y documentos definidos por la coordinación.",
]);

/* Para quién */
seccion("2 · Quién la usa");
tabla(
  ["Perfil", "Qué hace en la plataforma"],
  [
    ["Coach", "Registra alumnos, sube transcripciones, revisa el análisis, corrige minutas y consulta el agente."],
    ["Administración", "Crea cuentas, carga material y tareas, define plantillas, da de baja alumnos y supervisa todo."],
    ["Alumno", "No tiene cuenta: recibe los documentos que el coach decide compartir."],
  ],
  [100, 380]
);

seccion("3 · Datos generales");
tabla(
  ["Dato", "Valor"],
  [
    ["Nombre", "MIEEF Coach"],
    ["Tipo", "Aplicación web de uso interno"],
    ["Usuarios", "Ocho cuentas: dos de administración, seis de coaching"],
    ["Acceso", "Correo y contraseña; sin registro público"],
    ["Estado", "En producción"],
    ["Alcance", "Acompañamiento a alumnos y evidencia documental del proceso"],
  ],
  [110, 370]
);

/* Qué hace */
nueva();
seccion("4 · Qué hace, módulo por módulo");
tabla(
  ["Módulo", "Función"],
  [
    ["Alumnos", "Alta, edición y baja lógica. Cada alumno guarda empresa, puesto, ciudad, giro, proyecto y coach."],
    ["Subir transcripción", "Recibe la transcripción de la sesión y la analiza: resumen, hallazgos, compromisos y tareas."],
    ["Minutas", "PDF y Word con la misma estructura. Pueden corregirse por chat y el documento se regenera."],
    ["Ficha del alumno", "Una hoja con el estado del acompañamiento y los temas vistos."],
    ["Consejo", "Sesión grupal por coach; se sube su transcripción y se analiza igual que una individual."],
    ["Tareas de aplicación", "Catálogo de tareas del programa y seguimiento de quién las abordó y cuándo."],
    ["Agente", "Responde preguntas sobre un alumno o sobre el grupo, citando la sesión de donde sale el dato."],
    ["Brief de contexto", "Investigación de la empresa y su industria antes de la primera sesión, con fuentes."],
    ["Plantillas", "La coordinación define estructuras y el equipo genera documentos con el expediente."],
    ["Monday", "Vista de solo lectura del tablero de inducción, con enlaces y documentos."],
    ["Calendario", "Cada sesión se puede agregar al calendario del coach; hay liga de suscripción."],
  ],
  [120, 360]
);

/* Cómo funciona */
seccion("5 · Cómo funciona, en lo esencial");
vinetas([
  "Aplicación web: se usa desde el navegador, sin instalar nada.",
  "Base de datos relacional con respaldo automático diario (siete días de retención).",
  "Los archivos se guardan en almacenamiento privado; se entregan con ligas firmadas que caducan.",
  "El análisis y la redacción usan la API de OpenAI. Desde marzo de 2023, el contenido enviado a esa API no se usa para entrenar modelos.",
  "La aplicación se publica en AWS Amplify y el dominio propio está pendiente.",
]);

/* Finalidad */
seccion("6 · Finalidad");
vinetas([
  "Dejar evidencia de lo que ocurre en cada sesión: qué se habló, qué se acordó y quién lo dijo.",
  "Devolverle al coach el tiempo que hoy se va en redactar, para que lo use en acompañar.",
  "Conservar el conocimiento de la firma: las clases y la metodología quedan consultables, no en computadoras personales.",
  "Permitir supervisión: la administración puede revisar avance, compromisos y documentación sin pedir archivos.",
  "Preparar el terreno para productos futuros sobre datos ordenados de consultoría.",
]);

/* Controles */
nueva();
seccion("7 · Controles administrativos");
tabla(
  ["Aspecto", "Cómo está resuelto"],
  [
    ["Acceso", "Correo y contraseña; sesión con vigencia de ocho horas."],
    ["Separación de información", "El coach solo accede a sus alumnos; la administración, a todos."],
    ["Autoría y fecha", "Cada sesión, minuta y documento conserva fecha, autor y origen."],
    ["Baja de usuarios", "Desactivar una cuenta corta el acceso de inmediato, sin borrar su historial."],
    ["Respaldo", "Automático diario, con siete días de retención."],
    ["Exportación", "Los datos pueden exportarse a CSV o Excel cuando se requiera."],
    ["Datos sensibles", "Las transcripciones viven en la base de CEDEM; a la IA solo va el fragmento necesario."],
    ["Límites de uso", "Topes por usuario para intentos de acceso, consultas y generación de documentos."],
  ],
  [140, 340]
);

/* Alcance */
seccion("8 · Alcance y límites");
escribir("Lo que la plataforma no hace, para evitar expectativas equivocadas:", { size: 10 });
vinetas([
  "No factura, no cobra ni lleva contabilidad.",
  "No sustituye al tablero de monday: lo consulta y lo complementa.",
  "No procesa audio largo: recibe transcripciones y documentos.",
  "No tiene firma electrónica ni valor legal por sí misma.",
  "No da acceso al alumno: los documentos se comparten fuera de la plataforma.",
]);

/* Estado */
seccion("9 · Estado actual");
tabla(
  ["Punto", "Situación"],
  [
    ["Publicación", "En producción y en uso por el equipo."],
    ["Cuentas", "Ocho cuentas activas: dos de administración y seis de coaching."],
    ["Datos", "Base limpia: sin alumnos ni sesiones de prueba."],
    ["Pendientes", "Plantillas definitivas de la coordinación y lectura de metodología desde Drive."],
  ],
  [140, 340]
);

nota(
  "Los nombres, montos y datos personales que aparezcan en la plataforma son propiedad de CEDEM y se resguardan conforme a sus políticas internas."
);

pie();
const bytes = await pdf.save();
fs.writeFileSync(path.join(RAIZ, "docs", "aplicacion.pdf"), bytes);
console.log(`aplicacion.pdf · ${pdf.getPageCount()} páginas`);
