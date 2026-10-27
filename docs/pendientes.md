# Pendientes de CEDEM Coach

> Última actualización: 26 de octubre de 2026, después de la reunión con Galia y Lorena.
> Lo que ya está hecho vive en el README; esto es lo que falta.

## 1 · Presentación de junta técnica

Hecho (26 oct):

- **Alcance**: el botón pregunta si es **de este alumno** o **de todo el grupo**.
- **Información actualizada**: usa la minuta corregida por chat, no los hallazgos originales.
- El nombre del archivo incluye el alcance y la fecha.

Pendiente:

- **Ajustes por chat** de la presentación (requiere guardar una versión por coach; la columna
  `coaches.presentacion_ajustada` ya está en la migración 006, falta la lógica).
- El **guión de la junta técnica** de Galia; cuando llegue, se ajusta la estructura.

## 2 · Deep research al dar de alta

Lorena ya mandó el prompt completo y un brief de ejemplo (Productos Avilés). Validado lo técnico:

- **Funciona con la llave de DeepSeek que ya tenemos**, sin proveedor nuevo: su API compatible con
  Anthropic acepta la herramienta `web_search_20250305` y devuelve resultados reales con fuentes.
- **El problema es el tiempo**: un brief completo tarda 35 a 60 segundos y Amplify corta a los 30.

Plan para que quepa en el límite, en dos pasos desde el navegador:

1. `buscar`: una llamada de búsqueda que devuelve hechos y fuentes (10-15 s).
2. `redactar`: una segunda llamada, sin búsqueda, que escribe el brief con el prompt de Lorena y
   lo guarda (10-15 s).

Guardar en `alumnos.brief` (texto), `brief_fuentes` (jsonb) y `brief_actualizado` (fecha).
Botón "Generar brief" en la ficha del alumno + descarga en PDF. No se genera solo al dar de alta
para no bloquear el registro.

## 3 · Tareas de aplicación

- **Desmarcar** una tarea por chat (hoy solo se puede marcar).
- Reporte por coach y por alumno para el administrador, con filtros.
- Que el catálogo se pueda editar y dar de baja.

## 4 · Audio largo

- Hoy se procesa de una sola vez y el límite práctico son ~7 minutos.
- Para sesiones completas hace falta un proveedor asíncrono con webhook (AssemblyAI, Deepgram) o
  un worker siempre encendido. Estimado: una tarde.

## 5 · Administración

- Filtros por coach y por alumno en las vistas del admin.
- Supervisión de tareas de aplicación por grupo.

## 6 · Menores

- Subdominio en `cedem.com.mx` en lugar de la URL de Amplify.
- Revisar si conviene que el admin pueda crear usuarios desde la app (hoy es por terminal).
- Los videos del Consejo **no** van en la app: se acordó que se quedan en la plataforma de Euncet
  y se respaldan aparte, en un drive de la firma.
