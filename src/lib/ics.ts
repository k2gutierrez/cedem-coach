export type EventoCalendario = {
  id: string;
  titulo: string;
  descripcion?: string;
  fecha: string; // AAAA-MM-DD
  hora?: string | null; // HH:MM
  duracionMin?: number;
  lugar?: string | null;
  organizador?: { nombre: string; email: string };
};

function escapar(texto: string): string {
  return String(texto || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function sellos(fecha: string, hora: string | null | undefined, minutos: number) {
  const [a, m, d] = fecha.split("-").map(Number);
  const [h, min] = (hora || "09:00").split(":").map(Number);
  const inicio = new Date(a, m - 1, d, h, min, 0);
  const fin = new Date(inicio.getTime() + minutos * 60_000);
  const fmt = (f: Date) =>
    `${f.getFullYear()}${String(f.getMonth() + 1).padStart(2, "0")}${String(f.getDate()).padStart(2, "0")}T${String(
      f.getHours()
    ).padStart(2, "0")}${String(f.getMinutes()).padStart(2, "0")}00`;
  return { inicio: fmt(inicio), fin: fmt(fin) };
}

/** Genera un archivo .ics que abre Gmail, Outlook y Apple Calendar sin configurar nada. */
export function construirICS(evento: EventoCalendario): string {
  const minutos = evento.duracionMin || 60;
  const { inicio, fin } = sellos(evento.fecha, evento.hora, minutos);
  const ahora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CEDEM//Coach//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${evento.id}@cedem.com.mx`,
    `DTSTAMP:${ahora}`,
    `DTSTART:${inicio}`,
    `DTEND:${fin}`,
    `SUMMARY:${escapar(evento.titulo)}`,
  ];

  if (evento.descripcion) lineas.push(`DESCRIPTION:${escapar(evento.descripcion)}`);
  if (evento.lugar) lineas.push(`LOCATION:${escapar(evento.lugar)}`);
  if (evento.organizador) {
    lineas.push(`ORGANIZER;CN=${escapar(evento.organizador.nombre)}:mailto:${evento.organizador.email}`);
  }

  lineas.push(
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapar(evento.titulo)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  );

  // RFC 5545: líneas de máximo 75 octetos.
  return lineas
    .flatMap((linea) => {
      if (linea.length <= 73) return [linea];
      const trozos: string[] = [];
      let resto = linea;
      trozos.push(resto.slice(0, 73));
      resto = resto.slice(73);
      while (resto.length) {
        trozos.push(" " + resto.slice(0, 72));
        resto = resto.slice(72);
      }
      return trozos;
    })
    .join("\r\n");
}
