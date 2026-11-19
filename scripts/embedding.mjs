#!/usr/bin/env node
/** Explica la búsqueda semántica.  node scripts/embedding.mjs */
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
  pagina.drawText("El agente entiende por significado · MIEEF Coach · CEDEM", { x: MARGEN, y: 28, size: 8, font: normal, color: GRIS });
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

function cita(pregunta, respuesta) {
  asegurar(60);
  escribir(`Pregunta: “${pregunta}”`, { size: 10, font: negrita, color: AZUL });
  escribir(respuesta, { size: 9.6, font: cursiva, color: NEGRO, sangria: 8 });
  salto(6);
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
escribir("El agente ya entiende por significado", { size: 20, font: negrita, color: AZUL });
escribir("Qué cambió y cómo preguntar desde ahora", { size: 11, color: GRIS });
salto(10);

escribir(
  "Hasta ahora el agente buscaba en el material las palabras que aparecían en tu pregunta. Funcionaba cuando acertabas con el término exacto, y fallaba cuando preguntabas con tus propias palabras. Eso cambió: ahora busca por significado.",
  { size: 10.8 }
);

seccion("1 · Qué se hizo");
vinetas([
  "Cada fragmento del material cargado se convirtió en un vector: una huella del significado del texto.",
  "Se vectorizaron los 122 fragmentos que ya existían. El material que se suba de aquí en adelante se vectoriza solo.",
  "Al preguntar, el agente compara el significado de tu pregunta con el de cada fragmento, no las palabras.",
]);

nota("La búsqueda por palabras se conserva como respaldo: si el vector no encuentra nada, se usa la anterior. Nada de lo que funcionaba dejó de funcionar.");

seccion("2 · Qué significa para ti");
escribir("Ya no necesitas recordar el término exacto del documento. Puedes preguntar como hablarías en una junta.", {
  size: 10.5,
  font: negrita,
});

seccion("3 · Pruebas con tu material");
cita(
  "¿Cómo decide un dueño en qué invertir y qué debe abandonar?",
  "Encontró el fragmento de la sesión 2 que habla de las cuatro preguntas del dueño (números, querencia, riesgo y negociación) y de distinguir mejora continua de discontinua. En ese texto no aparece la palabra “invertir”."
);
cita(
  "¿Qué hace que una familia pierda el rumbo con el paso de las generaciones?",
  "Encontró el pasaje sobre renovación de la visión familiar: “los miembros de la familia propietaria habrán de revisar de vez en cuando si sigue vigente un sueño común”. Ninguna de esas palabras estaba en la pregunta."
);

seccion("4 · Lo que sigue ayudando");
vinetas([
  "Nombrar el tema: “del consejo familiar”, “de la sesión 2”. Ayuda, aunque ya no es obligatorio.",
  "Una pregunta, un tema. Si pides tres cosas, contesta una.",
  "Decir de quién hablas cuando hay varios: “de Dalila”, “del alumno X”.",
  "Pedir el documento cuando quieres un documento: “genera la minuta”.",
]);

seccion("5 · Lo que no cambió");
vinetas([
  "Sigue citando de dónde salió: sesión, Consejo o material.",
  "No inventa: si el tema no está en el material, lo dice.",
  "No mezcla coaches: si preguntas por uno, responde solo con lo suyo.",
  "Las tareas de aplicación siguen saliendo del catálogo oficial.",
]);

seccion("6 · El único requisito");
escribir(
  "Que el material esté cargado. La mejora hace que el agente encuentre mejor lo que existe; no puede responder sobre algo que nunca se subió. Si pregunta por un tema y no hay material, el aviso sigue siendo el mismo: “no encontré información”."
);

seccion("7 · Qué hacer si no encuentra algo");
vinetas([
  "Reformula con otras palabras: ahora eso sí ayuda.",
  "Revisa que el tema esté en el material cargado.",
  "Si es de un alumno, confirma que tenga sesiones analizadas.",
  "Si es un Consejo, que esté registrado como Consejo y no como sesión individual.",
]);

nota(
  "El costo de esta mejora es de centavos: vectorizar todo el material existente costó menos de un centavo, y cada archivo nuevo cuesta una fracción."
);

pie();
const bytes = await pdf.save();
fs.writeFileSync(path.join(RAIZ, "docs", "agente-significado.pdf"), bytes);
console.log(`agente-significado.pdf · ${pdf.getPageCount()} páginas`);
