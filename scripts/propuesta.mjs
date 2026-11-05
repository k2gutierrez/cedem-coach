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

/* Tarifas de OpenAI, en dólares por millón de tokens. */
const PRECIO = {
  entrada: 0.15, // gpt-4o-mini
  salida: 0.6,
  busqueda: 0,
};

const PRECIO_ALTO = { entrada: 2.5, salida: 10 }; // gpt-4o, para la cotización amplia

const OPERACIONES = {
  analisis: { nombre: "Análisis de una sesión", entrada: 3408, salida: 575 },
  ajuste: { nombre: "Corrección de una minuta", entrada: 4500, salida: 800 },
  chat: { nombre: "Mensaje al agente", entrada: 5000, salida: 350 },
  consejo: { nombre: "Análisis de un Consejo", entrada: 6000, salida: 900 },
  brief: { nombre: "Brief de contexto", entrada: 30000, salida: 3000, busquedas: 3 },
};

function costoUSD(precio, { entrada = 0, salida = 0 }) {
  return (entrada / 1_000_000) * precio.entrada + (salida / 1_000_000) * precio.salida;
}

function costoMXN(operacion) {
  return costoUSD(PRECIO, operacion) * MXN_POR_USD;
}

function costoMXNAlto(operacion) {
  return costoUSD(PRECIO_ALTO, operacion) * MXN_POR_USD;
}

const VOLUMEN = {
  analisis: 40, // 4 coaches × 5 alumnos × 2 sesiones al mes
  ajuste: 40, // una corrección por sesión
  consejo: 4, // uno al mes por coach
  chat: 240, // ~6 mensajes por sesión
  brief: 20 / 12, // 20 alumnos al año, prorrateado
};

const COSTO_MES = Object.fromEntries(
  Object.entries(VOLUMEN).map(([clave, veces]) => [clave, veces * costoMXN(OPERACIONES[clave])])
);

const TOTAL_IA = Object.values(COSTO_MES).reduce((a, b) => a + b, 0);
const SUPABASE = {
  planPro: 25, // incluye 10 USD de crédito de cómputo (una instancia Micro)
  computoSmall: 15, // si algún día hace falta más memoria
  credito: 10,
};
const SUPABASE_PEOR = SUPABASE.planPro + (SUPABASE.computoSmall - SUPABASE.credito); // 30 USD

const INFRA = {
  supabase: SUPABASE.planPro * MXN_POR_USD,
  hosting: 5 * MXN_POR_USD,
  dominio: (15 * MXN_POR_USD) / 12,
};
const TOTAL_INFRA = Object.values(INFRA).reduce((a, b) => a + b, 0);
const TOTAL_IA_ALTO = Object.entries(VOLUMEN).reduce(
  (suma, [clave, veces]) => suma + veces * costoMXNAlto(OPERACIONES[clave]),
  0
);
const TOTAL_ALTO = TOTAL_IA_ALTO + TOTAL_INFRA;

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
escribir("Estimación mensual de costos y lo que devuelve a la firma", { size: 12, color: GRIS });
salto(14);

escribir(
  "La plataforma no compite con lo que la firma ya usa: lee el tablero de monday, enlaza los documentos de Drive y convierte cada sesión en un expediente consultable y auditable. El valor no está en guardar más información, sino en que todo quede en una base propia, con fecha, autor y fuente, lista para explotarse."
);
salto(10);

destacado("Costo total estimado al mes", `${mxn(TOTAL)} MXN`, `≈ ${mxn(TOTAL / MXN_POR_USD)} USD · IA + infraestructura`);
destacado("Costo de IA por sesión", `${mxn(costoPorSesion)} MXN`, "análisis, minuta y la conversación del coach");

nota("Cifras calculadas con las tarifas públicas de OpenAI y precios de nube al momento de escribir. Los supuestos están en la página siguiente para poder ajustarlos.");

/* ---------------------------- Supuestos ---------------------------- */

seccion("1 · Con qué se calculó");
tabla(
  ["Supuesto", "Valor"],
  [
    ["Coaches", "4"],
    ["Alumnos por coach", "5 (20 en total)"],
    ["Sesiones individuales", "2 al mes por alumno, 1 hora cada una"],
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

nota(
  "Precios de referencia: OpenAI, gpt-4o-mini, 0.15 USD por millón de tokens de entrada y 0.60 por millón de salida. Tipo de cambio 18.4 MXN por dólar. La búsqueda web del brief se cobra aparte, por consulta."
);


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

escribir("Dos cotizaciones, según el modelo que se elija", { size: 10.5, font: negrita, color: AZUL });
salto(3);
tabla(
  ["Modelo", "IA al mes", "Total con infraestructura"],
  [
    ["gpt-4o-mini (recomendada)", mxn(TOTAL_IA), mxn(TOTAL)],
    ["gpt-4o (máxima calidad)", mxn(TOTAL_IA_ALTO), mxn(TOTAL_ALTO)],
  ],
  [230, 110, 150]
);
nota(
  "La diferencia entre las dos cotizaciones es de " +
    mxn(TOTAL_ALTO - TOTAL) +
    " al mes. La recomendada es la primera: cubre el trabajo y deja el presupuesto para crecer."
);

/* ---------------------------- Infraestructura ---------------------------- */

seccion("4 · Infraestructura");
tabla(
  ["Concepto", "Al mes"],
  [
    ["Base de datos, archivos y cuentas (Supabase Pro, plan pagado)", mxn(INFRA.supabase)],
    ["AWS Amplify (detalle en la sección 5)", mxn(INFRA.hosting)],
    ["Dominio", mxn(INFRA.dominio)],
  ],
  [330, 120]
);

destacado("Total mensual", `${mxn(TOTAL)} MXN`, "IA + infraestructura, con el uso de los supuestos");
const ESCENARIOS = [
  ["Base (los supuestos de este documento)", TOTAL_IA, SUPABASE.planPro, 5],
  ["Uso doble y base de datos más grande", TOTAL_IA * 2, SUPABASE_PEOR, 5],
  ["Uso triple y más tráfico", TOTAL_IA * 3, SUPABASE_PEOR, 8],
].map(([nombre, ia, supabase, amplify]) => {
  const total = ia + (supabase + amplify) * MXN_POR_USD + INFRA.dominio;
  return [nombre, mxn(ia), mxn(supabase * MXN_POR_USD), mxn(total)];
});

nueva();
escribir("Escenarios de costo", { size: 12, font: negrita, color: AZUL });
salto(4);
tabla(["Escenario", "IA", "Supabase", "Total al mes"], ESCENARIOS, [190, 80, 90, 110]);

escribir(
  `Incluso en el escenario más caro -el triple de uso, más tráfico y una base de datos más grande- el total queda en ${ESCENARIOS[2][3]} MXN. La IA es la única parte que crece con el uso y hoy representa ${Math.round(
    (TOTAL_IA / TOTAL) * 100
  )}% del total; la infraestructura es prácticamente fija.`,
  { size: 10 }
);

nota(
  "Supabase Pro cuesta 25 USD al mes e incluye 10 USD de cómputo, suficiente para una instancia Micro. El escenario alto suma una instancia Small (15 USD) y aplica el crédito: 30 USD. El plan Team (599 USD) es para certificaciones y SSO, no hace falta aquí. La versión gratuita no se considera: se pausa tras una semana sin uso."
);



/* ---------------------------- AWS Amplify ---------------------------- */

const AMPLIFY = {
  compilaciones: 40 * 4, // 40 despliegues al mes, 4 minutos cada uno
  minutosGratis: 1000,
  almacenamientoGB: 1,
  transferenciaGB: 10,
  peticiones: 50_000,
};

const COSTO_AMPLIFY = {
  compilacion: Math.max(0, AMPLIFY.compilaciones - AMPLIFY.minutosGratis) * 0.01,
  almacenamiento: Math.max(0, AMPLIFY.almacenamientoGB - 5) * 0.023 + 0.02,
  transferencia: Math.max(0, AMPLIFY.transferenciaGB - 15) * 0.15,
  ssr: 0.10,
};
const AMPLIFY_REAL = Object.values(COSTO_AMPLIFY).reduce((a, b) => a + b, 0);
const AMPLIFY_MXN = AMPLIFY_REAL * MXN_POR_USD;

seccion("5 · AWS Amplify en detalle");
escribir(
  "La aplicación se publica en AWS Amplify, el servicio de Amazon para aplicaciones web. Cobra por cuatro cosas, y para este tamaño de operación casi todo cae dentro de la capa gratuita.",
  { size: 10 }
);
salto(6);

tabla(
  ["Concepto", "Uso al mes", "Costo"],
  [
    ["Compilaciones (cada publicación)", `${AMPLIFY.compilaciones} min`, mxn(COSTO_AMPLIFY.compilacion)],
    ["Almacenamiento de la aplicación", `${AMPLIFY.almacenamientoGB} GB`, mxn(COSTO_AMPLIFY.almacenamiento)],
    ["Datos servidos a los usuarios", `${AMPLIFY.transferenciaGB} GB`, mxn(COSTO_AMPLIFY.transferencia)],
    ["Renderizado del servidor", `${num(AMPLIFY.peticiones)} peticiones`, mxn(COSTO_AMPLIFY.ssr)],
  ],
  [230, 120, 110]
);

escribir(
  `Con ese uso, Amplify costaría alrededor de ${mxn(AMPLIFY_MXN)} MXN al mes. En el presupuesto se reservan ${mxn(INFRA.hosting)} MXN (5 USD) para cubrir meses con más publicaciones, más tráfico o algún pico de consumo.`,
  { size: 10 }
);
salto(6);

nota(
  "Capa gratuita de Amplify: 1,000 minutos de compilación, 5 GB de almacenamiento y 15 GB de datos servidos al mes. Cada publicación desde GitHub consume una compilación."
);

/* ---------------------------- Comparación ---------------------------- */

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
  ["Lo que el coach deja de escribir", "Al mes"],
  [
    ["Minutas de sesión, con compromisos y tareas", String(sesionesMes)],
    ["Fichas de alumno actualizadas", "20"],
    ["Resúmenes listos para la junta técnica", "4"],
    ["Horas de trabajo administrativo", `${Math.round(horasMes)} h`],
  ],
  [330, 120]
);

escribir(
  `Repartido entre los 20 alumnos, cada uno cuesta ${mxn(TOTAL / 20)} MXN al mes. Y cada sesión documentada, ${mxn(
    TOTAL / sesionesMes
  )} MXN.`,
  { size: 10.5, font: negrita, color: AZUL }
);
salto(6);

/* ---------------------------- Convencimiento ---------------------------- */

seccion("7 · Por qué conviene");
vinetas([
  "Se puede auditar: cada minuta, compromiso y tarea guarda fecha, autor y fuente. Se puede reconstruir qué se le dijo a un alumno, cuándo y con qué fundamento.",
  "Lo que monday no captura es la sesión: la conversación, el compromiso y si se cumplió. Eso es lo que aquí queda registrado y ligado al expediente.",
  "Cada coach puede abrir su propia cuenta de ChatGPT o Gemini; el problema es que lo que genera se queda ahí: no se comparte, no se liga al alumno y no se puede auditar. Aquí todo cae en la misma base, del mismo lado.",
  "El coach deja de ser administrador de su propio trabajo: llega a la sesión con el expediente leído y sale con la minuta hecha.",
  "Se puede demostrar el avance: compromisos, tareas de aplicación y temas vistos por alumno, con fecha y evidencia.",
  "El agente cita la fuente: cada afirmación viene de una sesión, de una clase o del material cargado. No inventa.",
  "Los datos están aislados por coach: cada quien ve a sus alumnos; la coordinación ve todo.",
  "El costo no crece por persona: la inteligencia artificial se paga por uso, no por licencia. Con dos sesiones al mes por alumno, la IA sigue representando menos del 2% del total.",
  "Todo vive en una base de datos propia y estructurada, lista para exportar a Excel o a otra herramienta cuando la firma quiera.",
  "Esa base es la materia prima de los siguientes productos de IA: comparar generaciones, detectar temas recurrentes y generar informes para la dirección sin volver a capturar nada.",
]);

salto(4);
escribir(
  "La decisión no es entre una aplicación y una hoja de cálculo: es entre que el trabajo administrativo siga consumiendo horas de coach todos los meses, o que lo haga el sistema y esas horas se dediquen a acompañar.",
  { size: 10.5, font: negrita, color: AZUL }
);


destacado("Costo de todo el año", `${mxn(TOTAL * 12)} MXN`, "12 meses con estos supuestos");

escribir(
  `Al mes devuelve ${Math.round(horasMes)} horas de trabajo administrativo y ${sesionesMes} documentos que hoy se escriben a mano.`,
  { size: 10.5, font: negrita, color: AZUL }
);

/* ---------------------------- Cierre ---------------------------- */

seccion("8 · Los datos y su respaldo");
vinetas([
  "La base es de CEDEM: Postgres en Supabase, plan Pro. No está en una herramienta ajena ni en la cuenta de un proveedor.",
  "El plan Pro incluye respaldo automático diario con siete días de retención. La versión gratuita no respalda nada y se pausa tras una semana sin uso: por eso el presupuesto ya contempla el plan pagado.",
  "Los archivos viven en almacenamiento privado y se entregan con ligas firmadas que caducan a la hora.",
  "Todo se puede exportar a CSV, Excel o JSON en cualquier momento. No hay candado: si mañana la firma quiere otro sistema, se lleva los datos.",
  "La inteligencia artificial es la API de OpenAI, no la versión de consumo: desde marzo de 2023 el contenido enviado a la API no se usa para entrenar ni mejorar sus modelos, y los registros de abuso se conservan 30 días.",
  "La política está publicada y es verificable: platform.openai.com/docs/guides/your-data",
]);

nota(
  "Si más adelante se quisiera recuperación al segundo (PITR), Supabase la cobra aparte, alrededor de 100 USD al mes para siete días. No hace falta al inicio: el respaldo diario cubre el caso normal."
);

seccion("9 · Lo que pedimos");
vinetas([
  "Un presupuesto mensual de $1,000 MXN para inteligencia artificial, hosting en Amplify y la base de datos con respaldo diario. El cálculo de este documento da alrededor de $600 MXN; el resto es margen para meses con más uso o más tráfico.",
  "Un subdominio de cedem.com.mx. Si no está disponible en GoDaddy, se puede registrar un dominio directo en AWS, con un costo anual aproximado de 30 a 60 USD.",
]);

salto(6);
destacado("Inversión mensual solicitada", "$1,000 MXN", "IA, hosting y base de datos con respaldo diario");

escribir("Qué recibe la firma a cambio", { size: 11, font: negrita, color: AZUL });
salto(2);
vinetas([
  "La plataforma operando, con las cuentas de los cuatro coaches y sus alumnos.",
  "La metodología indexada y consultable, con la fuente a la mano en cada respuesta.",
  "Una base de datos propia, con respaldo diario y exportable en cualquier momento.",
  "El expediente de cada alumno: sesiones, compromisos, tareas y documentos en un solo lugar.",
]);

salto(4);
escribir(
  "No es el costo de una herramienta más: es el costo de que la firma empiece a acumular datos de consultoría estructurados, que hoy se pierden en minutas sueltas.",
  { size: 10.5, font: negrita, color: AZUL }
);

pie();
const bytes = await pdf.save();
fs.writeFileSync(path.join(SALIDA, "propuesta-economica.pdf"), bytes);
console.log(`propuesta-economica.pdf · ${pdf.getPageCount()} páginas · total ${mxn(TOTAL)} MXN/mes`);
