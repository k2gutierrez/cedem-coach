#!/usr/bin/env node
/**
 * Genera los dos manuales de uso (coach y administración) en PDF.
 *
 *   node scripts/manuales.mjs
 *
 * Salen en docs/manual-coach.pdf y docs/manual-admin.pdf con la marca de CEDEM.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const SALIDA = path.join(RAIZ, "docs");
fs.mkdirSync(SALIDA, { recursive: true });

const LOGO = fs.readFileSync(path.join(RAIZ, "public", "mief.png"));
const PROGRAMA = "Máster en Innovación y Emprendimiento en la Empresa Familiar";

const AZUL = rgb(0.043, 0.184, 0.42);
const CIAN = rgb(0.055, 0.604, 0.839);
const GRIS = rgb(0.33, 0.38, 0.48);
const NEGRO = rgb(0.09, 0.13, 0.18);
const VERDE = rgb(0.1, 0.5, 0.29);

const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 56;
const UTIL = ANCHO - MARGEN * 2;

async function construir({ titulo, subtitulo, bloques, archivo }) {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(LOGO);

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;
  let numero = 1;

  const nuevaPagina = () => {
    pie();
    pagina = pdf.addPage([ANCHO, ALTO]);
    numero += 1;
    y = ALTO - MARGEN - 40;
    cabecera();
  };

  const cabecera = () => {
    const anchoLogo = 86;
    pagina.drawImage(logo, {
      x: MARGEN,
      y: ALTO - MARGEN - 22,
      width: anchoLogo,
      height: (anchoLogo * 177) / 400,
    });
  };

  const pie = () => {
    pagina.drawText(`${titulo} · CEDEM`, { x: MARGEN, y: 28, size: 8, font: normal, color: GRIS });
    pagina.drawText(String(numero), {
      x: ANCHO - MARGEN - negrita.widthOfTextAtSize(String(numero), 9),
      y: 28,
      size: 9,
      font: negrita,
      color: GRIS,
    });
  };

  const asegurar = (alto) => {
    if (y - alto < 60) nuevaPagina();
  };

  const escribir = (cadena, { size = 10.5, font = normal, color = NEGRO, sangria = 0, salto } = {}) => {
    const espacio = UTIL - sangria;
    const interlinea = salto ?? size * 1.45;
    const palabras = String(cadena ?? "").split(/\s+/).filter(Boolean);
    let linea = "";

    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, size) > espacio && linea) {
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
  };

  const salto = (n = 10) => {
    y -= n;
  };

  const seccion = (texto) => {
    asegurar(50);
    salto(6);
    pagina.drawRectangle({ x: MARGEN, y: y - 5, width: 3, height: 14, color: CIAN });
    pagina.drawText(texto.toUpperCase(), { x: MARGEN + 10, y, size: 9.5, font: negrita, color: AZUL });
    y -= 22;
  };

  const vinetas = (items) => {
    for (const item of items) {
      escribir(`•  ${item}`, { sangria: 6 });
    }
    salto(4);
  };

  const casilla = (texto) => {
    escribir(`[  ]  ${texto}`, { sangria: 6, color: NEGRO });
  };

  // Portada
  pagina.drawRectangle({ x: 0, y: ALTO - 120, width: ANCHO, height: 120, color: AZUL });
  const anchoPortada = 150;
  const altoPortada = (anchoPortada * 177) / 400;
  pagina.drawRectangle({
    x: MARGEN - 10,
    y: ALTO - 86,
    width: anchoPortada + 20,
    height: altoPortada + 14,
    color: rgb(1, 1, 1),
  });
  pagina.drawImage(logo, {
    x: MARGEN,
    y: ALTO - 80,
    width: anchoPortada,
    height: altoPortada,
  });
  pagina.drawText(PROGRAMA, {
    x: MARGEN,
    y: ALTO - 108,
    size: 8,
    font: normal,
    color: rgb(0.78, 0.87, 0.96),
  });

  y = ALTO - 168;
  escribir(titulo, { size: 24, font: negrita, color: AZUL });
  escribir(subtitulo, { size: 11, color: GRIS });
  salto(6);

  for (const bloque of bloques) {
    if (bloque.tipo === "seccion") seccion(bloque.texto);
    else if (bloque.tipo === "parrafo") {
      escribir(bloque.texto);
      salto(4);
    } else if (bloque.tipo === "vinetas") vinetas(bloque.items);
    else if (bloque.tipo === "pasos") {
      bloque.items.forEach((paso, i) => {
        escribir(`${i + 1}.  ${paso}`, { sangria: 6 });
        salto(2);
      });
      salto(4);
    } else if (bloque.tipo === "prueba") {
      escribir(bloque.texto, { font: negrita, color: VERDE, size: 10.5 });
      bloque.items.forEach((item) => casilla(item));
      salto(6);
    } else if (bloque.tipo === "nota") {
      asegurar(30);
      escribir(bloque.texto, { size: 9.5, color: GRIS, sangria: 10 });
      salto(6);
    }
  }

  pie();

  const bytes = await pdf.save();
  fs.writeFileSync(path.join(SALIDA, archivo), bytes);
  console.log(`${archivo} · ${pdf.getPageCount()} páginas`);
}

/* ------------------------------------------------------------------ */

const COACH = [
  { tipo: "parrafo", texto: "Guía para probar MIEEF Coach de principio a fin. Cada sección dice qué hacer y, al final, hay una lista de verificación para marcar lo que ya funciona y reportar lo que no." },

  { tipo: "seccion", texto: "1 · Entrar" },
  { tipo: "pasos", items: [
    "Abre la liga que te mandó la coordinación.",
    "Escribe tu correo y tu contraseña. La cuenta la crea la administración; no hay registro público.",
  ]},
  { tipo: "nota", texto: "Si olvidaste la contraseña, pídele a la coordinación que te la restablezca." },

  { tipo: "seccion", texto: "2 · Mi cuenta" },
  { tipo: "parrafo", texto: "Haz clic en tu nombre, arriba a la derecha. Ahí cambias:" },
  { tipo: "vinetas", items: [
    "Tu nombre.",
    "Tu liga de Zoom: es la misma para todas tus sesiones y se usa al agendar y en el calendario.",
    "Tu contraseña.",
  ]},

  { tipo: "seccion", texto: "3 · Tus alumnos" },
  { tipo: "pasos", items: [
    "Entra a Alumnos y registra a cada uno: nombre, empresa y puesto.",
    "El “proyecto detonador” es opcional: déjalo en blanco si aún no se define y llénalo después.",
    "Para corregir cualquier dato, abre la ficha del alumno y usa “Editar los datos del alumno”.",
  ]},

  { tipo: "seccion", texto: "4 · Agendar" },
  { tipo: "pasos", items: [
    "En la ficha del alumno, abre “Agendar la siguiente sesión”.",
    "Elige fecha, hora, duración y si es coaching individual o Consejo.",
    "El Consejo del mes se agenda en la sección Consejo, no dentro de un alumno.",
    "Puedes reprogramar o eliminar una sesión desde su tarjeta.",
  ]},
  { tipo: "parrafo", texto: "En Inicio aparecen tus próximas cinco sesiones, con fecha, hora, actividad, alumno y un botón para entrar a Zoom." },

  { tipo: "seccion", texto: "5 · Subir la sesión" },
  { tipo: "pasos", items: [
    "Entra a Subir transcripción y elige al alumno.",
    "A su lado aparece el selector “Sesión sin transcripción” con las que agendaste y aún no tienen archivo. Escoge la que corresponde: se completa, conserva su fecha y no se duplica.",
    "Si no estaba agendada, elige “Otra fecha”.",
    "Sube el archivo: transcripción de Zoom (.vtt), PDF, Word, audio o foto de tus notas. Si te equivocas, quítalo con la × antes de analizar.",
    "Si ya hay una sesión de ese alumno en esa fecha, la app te pregunta si quieres reemplazarla.",
    "Pulsa Analizar la sesión. Primero se guarda el texto y después el agente lo analiza.",
  ]},
  { tipo: "nota", texto: "Límites de hoy: máximo 50 MB por archivo. El audio de más de siete minutos no se puede procesar de una vez: en ese caso sube la transcripción en texto. Cuando la sesión queda analizada, desaparece de las próximas sesiones." },

  { tipo: "seccion", texto: "6 · Revisar el resultado" },
  { tipo: "parrafo", texto: "Cada sesión muestra el resumen, los hallazgos y el seguimiento. Desde ahí puedes descargar:" },
  { tipo: "vinetas", items: [
    "Minuta en PDF y en Word, con la fecha de la sesión en el nombre. Siempre lleva las mismas secciones: resumen, hallazgos, compromisos, tareas de aplicación y seguimiento.",
    "Ficha del alumno: una hoja con su proyecto detonador, compromisos y temas vistos.",
    "+ Calendario: agrega esa sesión a tu calendario.",
    "Junta técnica en PowerPoint: pregunta si la quieres “de este alumno” o “de todo el grupo”. Usa la minuta corregida, no los hallazgos originales.",
  ]},

  { tipo: "seccion", texto: "7 · Hablar con el agente" },
  { tipo: "parrafo", texto: "En la ficha del alumno hay un chat. Sirve para preguntar por el caso y para corregir lo que el agente entendió mal." },
  { tipo: "vinetas", items: [
    "Pregunta lo que necesites: “¿qué compromisos quedaron abiertos?”, “¿qué reviso en la siguiente sesión?”.",
    "Para corregir: “actualiza la minuta: el compromiso es entregar el estado de resultados el 5 de noviembre”. El agente la reescribe y avisa.",
    "Para tareas: “la tarea del estado de resultados ya se entregó”. Queda marcada con su fecha.",
    "El chat recuerda la conversación y consulta el resumen, los hallazgos, los compromisos, las tareas y la transcripción completa: no repitas el contexto.",
    "Si el agente no aplica el cambio, cada sesión tiene el botón “Aplicar el chat a la minuta”.",
  ]},

  { tipo: "seccion", texto: "8 · Brief de contexto (deep research)" },
  { tipo: "parrafo", texto: "En la ficha del alumno hay un botón “Generar brief”. Investiga la empresa y su industria en internet y escribe un documento de una a dos páginas con fuentes, para que llegues preparado a la primera sesión." },
  { tipo: "vinetas", items: [
    "Son dos pasos —buscar y escribir— y tarda unos 20 segundos en total. No cierres la página.",
    "Necesita que el alumno tenga empresa registrada.",
    "Cuando está listo puedes descargarlo en PDF. Sirve para cambiar el foco y volver a generarlo.",
    "Es contexto, no diagnóstico: no se comparte con el alumno ni se cita en la sesión.",
  ]},

  { tipo: "seccion", texto: "9 · Tareas de aplicación" },
  { tipo: "parrafo", texto: "La ficha del alumno muestra la lista de tareas del mes con su palomita. Se marca sola cuando el agente la detecta en la transcripción, o cuando se lo dices por el chat." },

  { tipo: "seccion", texto: "10 · Tu calendario" },
  { tipo: "pasos", items: [
    "En Mi cuenta, copia la “Liga de tu calendario CEDEM”.",
    "En Google Calendar entra a Configuración (el engrane).",
    "En la barra lateral elige Añadir calendario y luego Desde URL.",
    "Pega la liga y confirma.",
  ]},
  { tipo: "nota", texto: "Google tarda entre dos y tres horas en actualizarlo, a veces más; no hay botón para forzarlo. Para algo inmediato usa “+ Calendario” en la sesión." },

  { tipo: "seccion", texto: "Prueba completa, en orden" },
  { tipo: "prueba", texto: "Marca cada punto cuando funcione", items: [
    "Entrar con tu cuenta y cambiar tu liga de Zoom en Mi cuenta.",
    "Registrar un alumno sin proyecto detonador y editarlo después.",
    "Agendar una sesión y verla en Inicio con su botón de Zoom.",
    "Subir una transcripción eligiendo esa sesión agendada.",
    "Comprobar que la sesión desaparece de “Próximas sesiones”.",
    "Leer el resumen y los hallazgos, y descargar la minuta PDF y la Word.",
    "Ver que la minuta trae tareas de aplicación y seguimiento.",
    "Descargar la ficha del alumno y la junta técnica de un alumno y del grupo.",
    "Generar el brief de contexto y abrir el PDF.",
    "Pedirle algo al agente y luego corregirle la minuta por chat.",
    "Decirle que una tarea ya se entregó y ver la palomita.",
    "Agendar un Consejo y verlo en Inicio.",
  ]},

  { tipo: "seccion", texto: "Qué observar mientras pruebas" },
  { tipo: "vinetas", items: [
    "¿El resumen refleja la sesión o inventa cosas?",
    "¿Los compromisos traen la fecha correcta?",
    "¿Las tareas que se hablaron quedaron marcadas?",
    "¿La minuta se ve presentable para mandarla al alumno?",
    "¿El brief sirve para llegar preparado, o se queda en generalidades?",
    "¿Falta algo que tú escribirías siempre en una minuta?",
  ]},
  { tipo: "nota", texto: "Si algo falla, anota qué botón, en qué alumno y qué decía la pantalla. Con eso se reproduce y se corrige." },
];


const ADMIN = [
  { tipo: "parrafo", texto: "Guía de administración de MIEEF Coach. Desde aquí se crean las cuentas, se carga el conocimiento de la firma y se supervisa el trabajo de los coaches." },

  { tipo: "seccion", texto: "1 · Entrar" },
  { tipo: "parrafo", texto: "Entra con tu cuenta de administración. En el menú aparece una sección extra: Administración. Los coaches no la ven." },

  { tipo: "seccion", texto: "2 · Crear usuarios" },
  { tipo: "parrafo", texto: "Las cuentas se crean desde la terminal, en la carpeta de la aplicación:" },
  { tipo: "vinetas", items: [
    "Administrador: node scripts/crear-usuario.mjs --email correo --nombre \"Nombre\" --rol admin --password \"Clave12345\"",
    "Coach: lo mismo con --rol coach.",
    "Listar: --listar. Cambiar rol: --email correo --rol admin.",
    "Cambiar contraseña: --email correo --password \"Nueva123\".",
    "Quitar acceso: --desactivar --email correo (y --activar para devolvérselo).",
  ]},
  { tipo: "nota", texto: "Solo hay dos roles: coach y admin. Borrar cuentas no está disponible: la auditoría del sitio lo impide. Para retirar a alguien se desactiva." },

  { tipo: "seccion", texto: "3 · Alumnos y bajas" },
  { tipo: "vinetas", items: [
    "El admin ve los alumnos de todos los coaches.",
    "Al registrar un alumno eliges qué coach lo acompaña: el alumno queda en su cuenta, no en la tuya.",
    "Si subes o agendas una sesión como admin, queda a nombre del coach del alumno.",
    "Dar de baja: en la ficha del alumno, botón “Dar de baja”. Deja de aparecer a los coaches y conserva todo su historial.",
    "Reactivar: el mismo botón cambia a “Reactivar”.",
  ]},

  { tipo: "seccion", texto: "4 · Material de la firma" },
  { tipo: "parrafo", texto: "En Administración / Material de la firma se suben las clases, la metodología y los casos. El agente los usa para responder y citar." },
  { tipo: "pasos", items: [
    "Escribe el título tal como lo dirías: “Clase 3 · Gobierno y dueñez”.",
    "Elige el tipo: clase, metodología, caso, documento o transcripción.",
    "Llena asignatura, generación y autor. Son los datos que permiten citar bien.",
    "Sube el archivo: PDF, Word o transcripción en texto.",
  ]},
  { tipo: "nota", texto: "El audio y las fotos necesitan la llave de OpenAI. Una clase de 40 páginas tarda unos segundos en procesarse." },

  { tipo: "seccion", texto: "5 · Tareas de aplicación" },
  { tipo: "parrafo", texto: "El catálogo de tareas del mes se carga en la misma pantalla. El agente revisa cada transcripción contra esa lista y marca si la tarea se abordó." },
  { tipo: "vinetas", items: [
    "Escribe la tarea como se la pedirías al alumno.",
    "Pon la asignatura y el mes.",
    "Si no pones mes, la tarea cuenta para todos.",
  ]},

  { tipo: "seccion", texto: "6 · Supervisión" },
  { tipo: "vinetas", items: [
    "Consejos: agenda el del mes, reprograma y revisa sus minutas.",
    "Chat: pregunta por cualquier caso de cualquier coach.",
    "En la ficha de cada alumno puedes ver minutas, ficha y el checklist de tareas.",
  ]},

  { tipo: "seccion", texto: "Qué probar hoy" },
  { tipo: "prueba", texto: "Configuración y contenido", items: [
    "Entrar como admin y ver el menú completo.",
    "Revisar la lista de usuarios y sus roles.",
    "Cargar una clase real y comprobar que aparece en la lista.",
    "Crear dos tareas de aplicación del mes.",
    "Dar de baja a un alumno de prueba y reactivarlo.",
    "Agendar el Consejo del mes.",
    "Preguntarle al agente por un caso y ver si cita el material cargado.",
  ]},

  { tipo: "seccion", texto: "Qué vigilar" },
  { tipo: "vinetas", items: [
    "Que el agente cite el material con su título y no invente.",
    "Que las tareas cargadas aparezcan en la ficha del alumno.",
    "Que un coach no vea alumnos de otro (entra con una cuenta de coach y compruébalo).",
    "Que el admin no rompa nada al dar de baja: el historial debe seguir ahí.",
  ]},
];

await construir({
  titulo: "Manual del coach MIEEF",
  subtitulo: "Uso de la aplicación y qué probar · MIEEF Coach",
  bloques: COACH,
  archivo: "manual-coach.pdf",
});

await construir({
  titulo: "Manual de administración MIEEF",
  subtitulo: "Cuentas, conocimiento y supervisión · MIEEF Coach",
  bloques: ADMIN,
  archivo: "manual-admin.pdf",
});
