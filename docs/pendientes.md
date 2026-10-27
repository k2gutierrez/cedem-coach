# Pendientes de CEDEM Coach

> Última actualización: 26 de octubre de 2026, después de la reunión con Galia y Lorena.
> Lo que ya está hecho vive en el README; esto es lo que falta.

## 1 · Presentación de junta técnica

Lo que pidió Galia en la reunión, tal como quedó:

- **Preguntar el alcance antes de generarla**: ¿de un alumno o de todo el grupo?
- Si es **de un alumno**: revisar su caso completo y actualizado (todas sus sesiones, la minuta
  corregida, sus compromisos y tareas) y armar la presentación con lo más relevante.
- Si es **de todo el grupo**: un caso por diapositiva, como hoy.
- **Usar la información actualizada**, no los hallazgos originales: hoy el PPTX lee la tabla
  `hallazgos` e ignora las correcciones que el coach hizo por chat en la minuta.
- **Permitir ajustes por chat**, con el mismo mecanismo de la minuta: el agente detecta
  "actualiza la presentación…", la reescribe y el archivo sale corregido.
- Está pendiente el **guión de la junta técnica** que iba a mandar Galia. Sin él, la estructura
  de la presentación puede cambiar; conviene esperarlo antes de rehacerla.

Orden sugerido: primero el arreglo de usar la minuta corregida (es un bug), y el resto cuando
llegue el guión.

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
