# Plantillas de documentos · qué necesitamos

Para que la aplicación genere los documentos con la estructura de CEDEM, necesitamos
una plantilla por tipo de documento. No hace falta que estén en un formato especial:
Word, Google Docs exportado o Markdown funcionan.

## Qué mandar

Una plantilla por cada documento:

1. **Presentación de caso individual**
2. **Presentación de grupo** (junta técnica)
3. **Ficha global del alumno**

## Cómo llenarlas

**Llenas, no vacías.** El ejemplo debe traer datos inventados pero completos, de un
alumno ficticio. Así vemos cuánto texto va en cada parte y qué tono se espera.

**Con los encabezados tal como deben salir.** Si la sección se llama "Contexto del
negocio", escríbanla así; ese texto se copia al documento final.

**Marcando lo que cambia por alumno** con dobles llaves. Ejemplo:

```
## Contexto del negocio
{{empresa}} opera en {{ciudad}} y se dedica a {{giro}}. Su proyecto detonador es
{{proyecto}}.
```

Marcadores disponibles (podemos agregar los que hagan falta):

| Marcador | Qué trae |
|---|---|
| `{{alumno}}` | Nombre del alumno |
| `{{empresa}}` | Empresa |
| `{{cargo}}` | Puesto |
| `{{ciudad}}` | Ciudad |
| `{{giro}}` | Giro |
| `{{proyecto}}` | Proyecto detonador |
| `{{generacion}}` | Generación |
| `{{fecha_sesion}}` | Fecha de la sesión |
| `{{resumen}}` | Resumen de la sesión |
| `{{hallazgos}}` | Lista de hallazgos con su cita |
| `{{compromisos}}` | Compromisos abiertos |
| `{{tareas}}` | Tareas de aplicación y su estado |
| `{{brief}}` | Brief de contexto investigado |
| `{{coach}}` | Nombre del coach |

**Con una nota por sección** diciendo de dónde sale el contenido:

- *Dato fijo* → lo escribe la plantilla.
- *Dato del expediente* → sale de la base (uno de los marcadores).
- *Redacción del agente* → el modelo lo escribe a partir de las sesiones.

## Qué revisamos al recibirlas

1. Que las secciones tengan un orden claro.
2. Cuáles son fijas y cuáles dependen del alumno.
3. Si hay tablas, cuántas columnas y en qué orden.
4. La longitud esperada de cada parte.
5. Si llevan logo, pie de página o formato especial.

## Una cosa importante

Si una plantilla tiene secciones que a veces no aplican (por ejemplo, "Gobierno
familiar" cuando el alumno aún no lo trabaja), déjenlas escritas y marquen al lado
*"omitir si no hay información"*. Así el documento no sale con huecos vacíos.
