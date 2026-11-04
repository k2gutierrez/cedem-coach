#!/usr/bin/env node
/**
 * Informe de revisión de seguridad.   node scripts/seguridad.mjs
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
const ROJO = rgb(0.72, 0.16, 0.12);
const AMBAR = rgb(0.68, 0.42, 0.03);
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
  pagina.drawText("Revisión de seguridad · MIEEF Coach · CEDEM", { x: MARGEN, y: 28, size: 8, font: normal, color: GRIS });
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

const COLOR = { Alto: ROJO, Medio: AMBAR, Bajo: GRIS, Bien: VERDE };

function hallazgo(titulo, severidad, cuerpo, arreglo) {
  asegurar(70);
  pagina.drawText(sinRaros(titulo), { x: MARGEN, y, size: 10.5, font: negrita, color: NEGRO });

  const etiqueta = sinRaros(severidad);
  const anchoEtiqueta = negrita.widthOfTextAtSize(etiqueta, 7.5) + 10;
  pagina.drawRectangle({
    x: ANCHO - MARGEN - anchoEtiqueta,
    y: y - 3,
    width: anchoEtiqueta,
    height: 12,
    color: COLOR[severidad] ?? GRIS,
  });
  pagina.drawText(etiqueta.toUpperCase(), {
    x: ANCHO - MARGEN - anchoEtiqueta + 5,
    y: y + 1,
    size: 7.5,
    font: negrita,
    color: rgb(1, 1, 1),
  });

  y -= 15;
  escribir(cuerpo, { size: 10 });
  escribir(`Cómo se corrige: ${arreglo}`, { size: 9.5, color: GRIS });
  salto(8);
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
escribir("Revisión de seguridad", { size: 24, font: negrita, color: AZUL });
escribir("MIEEF Coach · 3 de noviembre de 2026", { size: 11, color: GRIS });
salto(12);

escribir(
  "Revisión del código y la configuración de la aplicación: manejo de llaves, autenticación, permisos entre coaches, subida de archivos y dependencias. No es una prueba de penetración: es una auditoría de lo construido, con evidencia en el código."
);

salto(8);

escribir("Resultado general", { size: 11, font: negrita, color: AZUL });
salto(2);
tablaResumen();

function tablaResumen() {
  const filas = [
    ["Crítico", "0", "Nada que impida salir a producción."],
    ["Alto", "1", "Sin límite de intentos en el acceso y en las funciones que cuestan dinero."],
    ["Medio", "4", "Aislamiento en código, tope de texto, cabeceras, dependencias."],
    ["Bajo", "4", "Detalles de robustez y de higiene."],
  ];

  asegurar(90);
  filas.forEach(([nivel, cantidad, detalle]) => {
    pagina.drawText(sinRaros(nivel), { x: MARGEN, y, size: 9.5, font: negrita, color: COLOR[nivel] ?? GRIS });
    pagina.drawText(cantidad, { x: MARGEN + 80, y, size: 9.5, font: negrita, color: NEGRO });
    escribir(detalle, { size: 9.5, color: GRIS, sangria: 110 });
    y -= 2;
  });
  salto(6);
}

/* ------------------------------ Llaves ------------------------------ */

seccion("1 · Llaves y ambiente local");
escribir(
  "Las llaves viven en .env.local, que está fuera de Git. Lo verifiqué: ningún archivo de entorno está en el repositorio y el token de monday no aparece en el historial."
);
salto(4);

const LLAVES = [
  ["SUPABASE_URL", "Dato público", "No es secreto"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Secreto crítico", "Entra a todo: lee y borra sin RLS"],
  ["DEEPSEEK_API_KEY", "Secreto de gasto", "Consume saldo si se filtra"],
  ["OPENAI_API_KEY", "Secreto de gasto", "Consume saldo si se filtra"],
  ["MONDAY_API_TOKEN", "Secreto de lectura", "Lee los tableros de CEDEM"],
];

asegurar(120);
LLAVES.forEach(([nombre, tipo, efecto]) => {
  pagina.drawText(sinRaros(nombre), { x: MARGEN, y, size: 8.5, font: negrita, color: NEGRO });
  pagina.drawText(sinRaros(tipo), { x: MARGEN + 190, y, size: 8.5, font: normal, color: AZUL });
  pagina.drawText(sinRaros(efecto), { x: MARGEN + 310, y, size: 8.5, font: normal, color: GRIS });
  y -= 16;
});
salto(6);

vinetas([
  "La llave de servicio de Supabase es la más delicada: no tiene límites ni permisos por fila. Si se filtra, hay que rotarla y revisar quién tuvo acceso.",
  "El token de monday se compartió por chat y ya se regeneró. Conviene regenerar también la llave de Supabase si alguna vez se pegó en una captura o en un mensaje.",
  "OpenAI y DeepSeek: se pueden poner topes de gasto mensual en sus paneles. Vale la pena hacerlo antes de abrir el uso a los coaches.",
  "Falta una variable propia para firmar las ligas de calendario (CALENDARIO_SECRETO). Hoy usa la llave de Supabase; si esa llave cambia, todas las ligas se rompen.",
]);

/* ------------------------------ Hallazgos ------------------------------ */

seccion("2 · Lo que conviene corregir");

hallazgo(
  "Sin límite de intentos en el acceso ni en las funciones de IA",
  "Alto",
  "No hay tope de intentos de contraseña, ni de mensajes al agente, ni de análisis por hora. Una cuenta filtrada podría vaciar el saldo de las APIs en minutos, y el acceso admite intentos ilimitados.",
  "agregar un límite por usuario y por IP (por ejemplo 10 intentos cada 15 minutos y 60 mensajes por hora), y un tope de gasto en las consolas de DeepSeek y OpenAI."
);

hallazgo(
  "El aislamiento entre coaches está en el código, no en la base",
  "Medio",
  "La aplicación entra con la llave de servicio, que se salta las reglas por fila de Supabase. Toda la separación depende de que cada consulta compare el coach. Hoy lo hace en todas las rutas que revisé, pero un descuido futuro sería una fuga silenciosa.",
  "mover la verificación a la base con reglas por fila y un token por usuario, o concentrar el acceso en una sola capa que siempre exija el coach."
);

hallazgo(
  "La extracción de archivos no tiene tope de texto",
  "Medio",
  "Un documento comprimido puede descomprimirse a cientos de megabytes y agotar la memoria del servidor. El límite de 50 MB es del archivo, no de lo que produce al abrirse.",
  "cortar el texto extraído en un máximo (por ejemplo 2 millones de caracteres) y rechazar el archivo si lo rebasa."
);

hallazgo(
  "Faltan cabeceras de seguridad",
  "Medio",
  "La aplicación no envía CSP, HSTS, X-Content-Type-Options ni Referrer-Policy. Sin ellas, el navegador queda más expuesto a contenidos incrustados y a filtraciones de la URL de origen.",
  "declararlas en next.config.ts; una CSP conservadora toma media hora y no rompe nada."
);

hallazgo(
  "Dos dependencias con vulnerabilidad alta",
  "Medio",
  "npm audit reporta image-size (usada por pptxgenjs) con bucles infinitos al leer imágenes JXL, HEIF e ICNS. En esta aplicación solo generamos presentaciones con el logotipo propio; no le pasamos imágenes de usuarios, así que el riesgo real es bajo.",
  "actualizar pptxgenjs cuando publique la versión corregida; mientras tanto, el uso actual no la expone."
);

hallazgo(
  "Las transcripciones pueden alterar al agente",
  "Bajo",
  "Un archivo subido podría contener instrucciones dirigidas al modelo. El impacto es una respuesta equivocada, no una fuga: el agente solo ve los datos de ese coach.",
  "reforzar la instrucción de que la transcripción es material a analizar, nunca órdenes."
);

hallazgo(
  "Mensajes de error con detalle interno",
  "Bajo",
  "Once respuestas muestran el mensaje crudo de la base de datos, que puede revelar nombres de columnas o de tablas.",
  "cambiar el detalle por un mensaje genérico y dejar el detalle solo en el registro del servidor."
);

hallazgo(
  "El proxy de archivos de monday acepta cualquier URL de monday.com",
  "Bajo",
  "Un usuario con sesión podría pedir por esa ruta recursos de monday ajenos al tablero. Requiere conocer la liga firmada y el token no viaja al navegador.",
  "restringir los dominios permitidos a los de archivos (cdn y files de monday)."
);

hallazgo(
  "Las ligas de calendario no caducan",
  "Bajo",
  "El feed usa una firma correcta y compara en tiempo constante, pero la liga es permanente: quien la tenga ve el calendario de ese coach para siempre.",
  "dejar la opción de revocarla desde Mi cuenta generando una firma nueva."
);

/* ------------------------------ Lo que está bien ------------------------------ */

seccion("3 · Lo que ya está bien resuelto");

vinetas([
  "La cookie de sesión es httpOnly, SameSite Lax y Secure en producción, con ocho horas de vigencia.",
  "La llave de servicio de Supabase nunca llega al navegador: no hay variables NEXT_PUBLIC ni claves en componentes de cliente.",
  "Todas las rutas revisadas exigen sesión, y las que devuelven datos de un alumno verifican que sea suyo.",
  "El almacenamiento de archivos es privado y se entrega con ligas firmadas que caducan.",
  "El token del calendario se compara en tiempo constante, sin filtrar información por el tiempo de respuesta.",
  "Desactivar a un coach le corta el acceso en la siguiente petición, sin esperar a que venza la sesión.",
  "No hay inyección de HTML: la interfaz no usa dangerouslySetInnerHTML en ningún punto.",
]);

/* ------------------------------ Plan ------------------------------ */

seccion("4 · Qué haría, en orden");
tablaPlan();

function tablaPlan() {
  const filas = [
    ["1", "Tope de intentos y de gasto", "Alto", "Media jornada"],
    ["2", "Cabeceras de seguridad", "Medio", "Media hora"],
    ["3", "Tope de texto al extraer", "Medio", "Media hora"],
    ["4", "Mensajes de error genéricos", "Bajo", "Una hora"],
    ["5", "Reglas por fila en la base", "Medio", "Un día, con pruebas"],
    ["6", "Actualizar pptxgenjs", "Medio", "Cuando publique"],
    ["7", "Revocar ligas de calendario", "Bajo", "Media jornada"],
  ];

  asegurar(30 + filas.length * 18);
  filas.forEach(([n, tarea, riesgo, esfuerzo]) => {
    pagina.drawText(n, { x: MARGEN, y, size: 9, font: negrita, color: CIAN });
    pagina.drawText(sinRaros(tarea), { x: MARGEN + 18, y, size: 9.5, font: normal, color: NEGRO });
    pagina.drawText(sinRaros(riesgo), { x: MARGEN + 250, y, size: 9, font: negrita, color: COLOR[riesgo] ?? GRIS });
    pagina.drawText(sinRaros(esfuerzo), { x: MARGEN + 330, y, size: 9, font: normal, color: GRIS });
    y -= 18;
  });
  salto(6);
}

escribir(
  "Nada de esto impide usar la aplicación hoy. Los tres primeros puntos se resuelven en una tarde y cubren lo que un atacante intentaría primero: adivinar contraseñas y gastar saldo ajeno."
);

pie();
const bytes = await pdf.save();
fs.writeFileSync(path.join(RAIZ, "docs", "seguridad.pdf"), bytes);
console.log(`seguridad.pdf · ${pdf.getPageCount()} páginas`);
