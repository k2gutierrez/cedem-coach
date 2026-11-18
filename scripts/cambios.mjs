#!/usr/bin/env node
/** Resumen de cambios recientes.  node scripts/cambios.mjs */
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
  String(t).replace(/[≈]/g, "~").replace(/[\u2013\u2014]/g, "-").replace(/[\u201C\u201D]/g, '"').replace(/[^\x00-\xFF•]/g, "");

function pie() {
  pagina.drawText("Cambios y correcciones · MIEEF Coach · CEDEM", { x: MARGEN, y: 28, size: 8, font: normal, color: GRIS });
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
  asegurar(46);
  salto(6);
  pagina.drawRectangle({ x: MARGEN, y: y - 5, width: 3, height: 13, color: CIAN });
  pagina.drawText(sinRaros(texto.toUpperCase()), { x: MARGEN + 10, y, size: 9.3, font: negrita, color: AZUL });
  y -= 20;
}

function cambio(titulo, detalle) {
  asegurar(34);
  escribir(`•  ${titulo}`, { font: negrita, size: 10.2 });
  escribir(detalle, { size: 9.8, color: GRIS, sangria: 12 });
  salto(2);
}

/* Portada */
pagina.drawRectangle({ x: 0, y: ALTO - 140, width: ANCHO, height: 140, color: AZUL });
pagina.drawRectangle({ x: MARGEN - 10, y: ALTO - 92, width: 150, height: (130 * 177) / 400 + 12, color: rgb(1, 1, 1) });
pagina.drawImage(logo, { x: MARGEN, y: ALTO - 86, width: 130, height: (130 * 177) / 400 });

y = ALTO - 186;
escribir("Cambios y correcciones", { size: 22, font: negrita, color: AZUL });
escribir("Lo que se arregló y lo que conviene saber", { size: 11, color: GRIS });
salto(10);

escribir(
  "Resumen de los ajustes hechos a partir de las pruebas con coaches y administración: tareas, material, Consejo y seguridad.",
  { size: 10.5 }
);

seccion("1 · Lo que cambió");
cambio("Tareas con día", "El formulario pedía solo mes y año. Ahora acepta la fecha completa, y la lista del mes usa esa fecha.");
cambio("Subir material ya no duplica", "Si subes un archivo con el mismo título, reemplaza al anterior y borra sus fragmentos viejos. Antes cada subida creaba una copia.");
cambio("Se puede eliminar material", "Botón en Administración, junto a cada archivo. Antes no había forma de quitar uno.");
cambio("Duplicados limpiados", "Se borraron las dos versiones viejas de las sesiones 1 y 2. Quedan las cuatro vigentes.");
cambio("El agente ve las tareas de aplicación", "Antes solo las cargaba al preguntar por un alumno. Ahora siempre están en su contexto.");
cambio("El agente ve los Consejos", "Con fecha, hora, estado y de qué coach son. Responde preguntas como “¿qué fechas tiene Dalila?”.");
cambio("La lista de Consejo muestra al coach", "Antes se mezclaban los de todos sin decir de quién eran, y solo traía 20 registros. Ahora trae 120 y cada tarjeta dice el coach.");
cambio("Botón de calendario más claro", "Decía “+ Calendario” y descargaba un archivo .ics, que parece un error. Ahora dice “Agregar a mi calendario (.ics)”.");
cambio("El material alimenta los documentos", "Los documentos generados con plantillas ahora consultan el material de la firma, no solo el expediente del alumno.");

seccion("2 · Seguridad");
cambio("Límites de uso", "8 intentos de contraseña cada 15 minutos; 60 mensajes al agente por hora; 20 análisis y 20 documentos por hora.");
cambio("El chat valida al alumno", "Un coach ya no puede pedir información de un alumno ajeno enviando su identificador.");
cambio("Mensajes de error sin detalles internos", "Ya no muestran nombres de tablas ni columnas; el detalle queda en el registro del servidor.");
cambio("Tope de texto al extraer archivos", "Máximo dos millones de caracteres, para que un archivo comprimido no tumbe el servidor.");
cambio("Ligas de calendario revocables", "Botón en Mi cuenta para regenerar la liga; la anterior deja de funcionar.");
cambio("Descargas de monday sin token", "La aplicación ya no envía la llave al traer archivos; la liga firmada no la necesita.");

seccion("3 · Lo que hay que saber");
cambio("La búsqueda es por palabras", "Si la pregunta nombra el tema (“mejora discontinua”, “tareas de la sesión 1”), el agente encuentra el material. Si es vaga (“resume lo que subí”), puede no encontrarlo.");
cambio("Más material no siempre es mejor", "Dos versiones del mismo documento hacen que el agente cite la equivocada. Por eso ahora se reemplaza por título: usa el mismo nombre al actualizar.");
cambio("El material no entra en las minutas", "Es a propósito: la minuta debe reflejar solo lo que se habló en la sesión, no lo que dice una clase.");
cambio("El Consejo es por coach", "Cada coach tiene el suyo, con sus alumnos. No hay uno compartido.");
cambio("El .ics depende del dispositivo", "En computadora abre el calendario y pregunta si agregas el evento; en celular a veces lo guarda en Archivos.");

seccion("4 · Pendiente");
cambio("Plantillas de CEDEM", "Falta que la coordinación defina las tres (caso individual, junta técnica y ficha global) en Administración → Plantillas.");
cambio("Metodología desde Drive", "Se puede leer el contenido de Drive, pero depende de permisos de Google. Queda para después.");
cambio("Acotar dominios de monday", "Se hará cuando exista un archivo alojado en monday para probar; hoy los documentos son ligas de Drive.");

pie();
const bytes = await pdf.save();
fs.writeFileSync(path.join(RAIZ, "docs", "cambios.pdf"), bytes);
console.log(`cambios.pdf · ${pdf.getPageCount()} páginas`);
