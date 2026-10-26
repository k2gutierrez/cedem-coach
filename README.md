# CEDEM Coach · aplicación (Next.js)

Plataforma de coaches del Máster con Euncet. Dos roles: **coach** y **admin**.

## Correr

```bash
npm run dev     # http://127.0.0.1:3100
npm run build   # comprobación de producción
```

Variables en `.env.local` (no se versiona):

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
OPENAI_API_KEY=          # audio e imágenes; sin ella el resto funciona
```

## Desplegar en AWS Amplify

El repositorio **es esta carpeta** (`CEDEM/coach`), no el workspace completo.

1. Sube el repo a GitHub.
2. Amplify → *Hosting* → *Connect repository* → elige el repo y la rama.
3. En **Environment variables** carga, antes del primer build:

   | Variable | Valor |
   |---|---|
   | `SUPABASE_URL` | `https://…supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | la llave de servicio (secreta) |
   | `DEEPSEEK_API_KEY` | la llave de DeepSeek |
   | `OPENAI_API_KEY` | opcional, para audio y fotos |

4. `amplify.yml` ya está en la raíz: instala con `npm ci`, copia esas variables a
   `.env.production` para que el servidor las vea en cada visita, compila y publica `.next`.
   Node se fija en `.nvmrc` (22).

> Sin el paso de `.env.production` el sitio compila pero falla al entrar, porque las
> variables del panel solo existen durante la compilación.

## Seguridad del repositorio

- `.env*` está ignorado por git: ninguna llave se versiona.
- No hay documentos, PDFs ni material de la firma dentro de la carpeta.
- `sql/` solo contiene el esquema; los correos de ejemplo son marcadores.

## Qué hace

| Pantalla | Función |
|---|---|
| `/login` | Correo y contraseña contra Supabase Auth |
| `/` | Inicio: alumnos, sesiones, compromisos y accesos grandes |
| `/alumnos` | Lista y alta de alumnos |
| `/alumnos/[id]` | Ficha, sesiones, agendar, documentos y calendario |
| `/subir` | Archivo (PDF, Word, VTT, TXT, audio, foto) → texto → análisis → base |
| `/chat` | Agente con contexto de alumnos, sesiones y material de la firma |
| `/admin` | Material de la firma, tareas de aplicación y equipo |

## Documentos y calendario

| Ruta | Devuelve |
|---|---|
| `GET /api/documentos/:sesionId/minuta` | PDF de la sesión |
| `GET /api/documentos/:sesionId/ficha` | DOCX de preparación |
| `GET /api/documentos/:sesionId/presentacion` | PPTX de junta técnica |
| `GET /api/calendario/:sesionId` | `.ics` para Gmail, Outlook o Apple Calendar |

El `.ics` no requiere OAuth: se descarga y se abre en el calendario del coach.

## Base de datos

- `sql/001-esquema.sql` — tablas del MVP (ya aplicado).
- `sql/002-material.sql` — biblioteca de material y búsqueda en español (aplicado).

## Usuarios

Solo hay dos roles: **coach** (ve a sus alumnos) y **admin** (ve todo, carga material y tareas).

```bash
# admin
node scripts/crear-usuario.mjs --email tu@cedem.com.mx --nombre "Tu Nombre" \
  --rol admin --password "ClaveLarga123"

# coach (la liga de Zoom se agrega después, en "Mi cuenta")
node scripts/crear-usuario.mjs --email ana@cedem.com.mx --nombre "Ana Lucía Robles" \
  --rol coach --password "OtraClave123"

node scripts/crear-usuario.mjs --listar          # quién existe
node scripts/crear-usuario.mjs --email x@y.mx --rol admin        # cambiar rol
node scripts/crear-usuario.mjs --email x@y.mx --password "Nueva123"  # cambiar clave
node scripts/crear-usuario.mjs --desactivar --email x@y.mx      # quitarle el acceso
node scripts/crear-usuario.mjs --activar --email x@y.mx
```

Dos avisos del proyecto compartido con el sitio de CEDEM:

- Cada cuenta nueva crea también una fila en `profiles` (la usa el sitio). Es normal.
- **Borrar una cuenta falla** porque la auditoría del sitio es append-only. Para retirar a alguien se usa `--desactivar`, que le quita el acceso de inmediato.

## Calendario

Hay dos formas de llevar las sesiones al calendario:

1. **Una sesión suelta**: el botón *+ Calendario* descarga un `.ics`.
2. **Suscripción (recomendada)**: en *Mi cuenta* cada coach copia su liga
   `/api/calendario/feed/<id>?t=<token>` y la agrega en Google Calendar con
   *Otros calendarios → + → Desde una URL*. Se actualiza sola y es de solo lectura.

El token del feed es un HMAC del id del coach con `CALENDARIO_SECRETO` (o, si no
está definida, la llave de servicio). Si se rota esa llave, las ligas cambian y
hay que volver a suscribirse.

## Subida de sesiones

`POST /api/sesiones` recibe `multipart/form-data` (`alumnoId`, `fecha`, `archivo`) y devuelve
JSON. Se usa desde la pantalla **Subir sesión** con `fetch`, no con Server Action, porque así
el error real llega al usuario en vez de una página genérica.

- **Máximo 5 MB por archivo.** Es el límite práctico de una función SSR en Amplify; una
  transcripción de Zoom pesa menos de 200 KB, así que sobra. Un audio largo sí se pasa: para
  eso hace falta subir directo a Supabase Storage y procesar aparte.
- El análisis usa `deepseek-flash` y recorta la transcripción a 8 000 caracteres para
  responder en menos de 10 segundos y no chocar con el tiempo máximo de la función.

### Archivos pesados

Los archivos de más de 4 MB no pasan por la función del servidor: el navegador pide una
URL firmada (`POST /api/subidas/firma`), sube directo a Supabase Storage y luego el servidor
lo procesa desde ahí (`POST /api/sesiones` con `{ruta}`). Límite: **50 MB**.

El original se borra después de procesarlo: queda el texto, no el archivo.

### Audios: el límite real es el tiempo

Transcribir tarda. Medido con un audio de 69 segundos:

| Modelo | Tiempo | ¿Distingue hablantes? |
|---|---|---|
| `gpt-4o-transcribe-diarize` | 30 s | Sí |
| `whisper-1` | 6 s | No |
| `gpt-4o-mini-transcribe` | 4 s | No |

Por eso el modelo por defecto es el rápido. Aun así, una función SSR de Amplify corta a los
~30 segundos, así que **audio de más de ~7 minutos no se puede procesar en una sola llamada**:
para eso hace falta un proveedor asíncrono con webhook (AssemblyAI, Deepgram) o un worker
siempre encendido. La transcripción de Zoom en texto no tiene ese problema.
