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
