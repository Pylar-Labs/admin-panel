# MEMORY — Admin panel — Pylar Labs

## Estado actual
- Adoptado el 2026-11-19 con el flujo spec-driven de template-landing. Sin `origin` (no hay remoto). Las specs 004 y 003 están commiteadas el 2026-11-24 en la rama local `feat/004-003-esquema-y-reparacion` (3 commits: docs y specs, migración y prueba de aislamiento, panel); `master` solo tiene el commit inicial; nada se ha subido ni mergeado. Sin commitear a propósito: `.mcp.json` (lleva la clave de Context7 escrita a mano) y `.claude/settings.json`; `.claude/settings.local.json` queda ignorado.
- Orden de las specs (por dependencia): 004 ✅ → 003 ✅ → 005 ✅ (T14 pendiente) → 001 → 002.
- **004 esquema multicliente (endurecimiento): IMPLEMENTADA (2026-11-23/24).** Migración `supabase/migrations/20261123010000_endurecer_esquema_multicliente.sql` aplicada (idempotente). Prueba `npm run test:db` (`scripts/tests/aislamiento.test.mjs`) 91/91; prefijo de prueba `zz-aislamiento-`, solo escribe en PylarLabs. Es sensible a cortes de red (`fetch failed`/`ECONNRESET`): repetir antes de sospechar de las reglas.
- **003 reparación de tipos y pantallas: IMPLEMENTADA (2026-11-24).** Puerta en verde: `tsc` 0 errores, `npm run lint` 0 errores y 2 avisos (`<img>` en catálogo e imágenes, no bloquean), `npm run build` correcto, `test:db` 91/91. Verificada en el navegador (escritorio y 375 px, consola limpia) con usuarios de prueba que ya se borraron.
- **005 alta de clientes: IMPLEMENTADA, con T14 pendiente (2026-11-24).** Puerta en verde: `tsc` 0, lint 0 errores y 2 avisos, build correcto, `test:db` 114/114 (91 aislamiento + 23 alta, `scripts/tests/alta.test.mjs`, prefijo `zz-alta-`, sin enviar correos: usa `generateLink`). Navegador (escritorio y 375 px) verificado con admin y cliente. Pieza clave: `src/lib/clients/onboarding.ts` (alta con deshacer por pasos config → invitar → `app_metadata.site_id`), acciones de servidor que llaman a `requireAdmin()`, cliente elegido por el admin en `sessionStorage`, `scripts/set-admin.mjs` (`node --env-file=.env.local scripts/set-admin.mjs <email> [--quitar]`; el rol llega al token al renovar la sesión). Hallazgo: Supabase re-invita sin error a quien aún no aceptó; el alta lo detecta por su `site_id` y no lo toca. **Sin verificar (T14):** entrega real del correo, SMTP propio de Supabase (el de por defecto solo envía a miembros del equipo) y la URL de producción en las redirecciones (`localhost:3000` ya se acepta); tampoco hay prueba automática de llamar la acción de servidor por fuera de la interfaz. Hacerlo antes del primer cliente real.
- 001: spec y plan escritos y aprobados, falta `/tasks` (revisar contra lo que cambió la 003). 002: spec aprobada, sin plan.

## Decisiones
- Usuarios: cada cliente edita solo su web (`site_id` en `app_metadata`); admin = `app_metadata.role = 'admin'`, designado fuera del panel. Interfaz en español.
- 004: la configuración es el sitio (una por `site_id`); el cliente la edita pero no la crea ni la borra (la crea la agencia al dar de alta, spec 005); imágenes aisladas por carpeta `<site_id>/…` en el bucket `images`; el enlace de despliegue sigue en `site_config` (legible solo por su sitio) hasta la 002.
- 003: `upsertSiteConfig` solo actualiza (un `upsert` falla para el cliente); `getSiteConfig` usa `maybeSingle`; mensajes de guardado con `saveErrorMessage` (`src/lib/utils.ts`); `ImageUpload` controlado (muestra `currentUrl`) y con avisos; rutas de imagen `<site_id>/logo`, `/hero`, `/gallery/…`, `/catalogo/<clave por producto>`; tema con `next-themes` (claro por defecto); servicios sin precio; sin enlace «Ver mi sitio» ni `site_url`.
- Una sola fuente del contrato: script que copia de `../template-landing` a un archivo generado; límites de texto extraídos de las descripciones del JSON Schema con test de cobertura. El contrato no cambia.
- Guardar nunca se bloquea; valida la publicación. Un solo «mostrar precios» por catálogo; `slug` de producto automático y estable; datos que la web no muestra llevan aviso «no se muestra en tu web».
- 002: versión del contrato exacta o bloquea; una publicación por sitio (libera a los 10 min); dos etapas con reintento; el deploy se dispara desde el servidor.

## Supabase
- Proyecto del panel: **PylarLabs** `eplnsjdvjawwijokoerk` (org `cltjeetqtidykxvnntwd`). «Web Landings Project» `zogzzwygaaxwxendrntv` (otra cuenta/org) es la base de la landing y NO se usa. `.env.local` apunta a PylarLabs.
- Estado: cinco tablas (`site_config`, `gallery`, `services`, `products`, `testimonials`) con RLS por `site_id`/rol, 0 filas; 1 usuario de prueba con `site_id` y sin configuración; bucket `images` público, 0 archivos.
- El conector ve una cuenta u otra según con cuál se reconecte (`/mcp`). `apply_migration` funciona; `execute_sql` con DDL pide confirmación manual (expira a los 10 min). Migraciones solo con aprobación explícita.

## Pendientes
- Reglas de la 003/004/005 ya aplicadas en AGENTS.md (2026-11-24). Siguiente spec: 001 (`/tasks`, revisarla contra la 003 y la 005). Probar con un admin real: `set-admin.mjs` sobre tu cuenta y una invitación a un correo tuyo (T14 de la 005).
- Fuera de la 003, vistos al verificar: el aviso «2 imagenes agregadas» no lleva tilde; quitar una foto o el logo borra solo la referencia, el archivo queda en el almacenamiento (huérfano); `/admin/cuenta` solo se abrió, no se revisó a fondo; `middleware` → `proxy` (aviso de Next 16, ese archivo protege `/admin`) para otra spec.
- Resolver con el template cómo lee la versión publicada y cómo confirma el build (002); mover `vercel_deploy_hook` fuera del navegador.
- Crear el repo remoto, PR a `master` y merge con merge commit (cada paso con tu aprobación); sacar la clave de `.mcp.json` a una variable de entorno o ignorar el archivo antes de subir nada; instalar el hook `SessionStart` (denegado en esta sesión).
- La prueba de base corre sobre la base real (datos de prueba que limpia); con clientes reales conviene una base de pruebas aparte.

## Errores a evitar
- No usar `user_metadata` para `site_id` ni rol. No asumir APIs de Next.js 16: leer `node_modules/next/dist/docs/`.
- Antes de leer o migrar un esquema, comprobar a qué proyecto de Supabase apunta `.env.local` y qué ve el conector: se leyó la base de la landing creyendo que era la del panel.
- Al cambiar reglas de acceso, probar con las MISMAS consultas que usa el panel (`upsert` incluido): un `upsert` exige también el permiso de crear.
- Lint `react-hooks/set-state-in-effect`: no llamar desde un efecto a una función que guarda estado; pedir los datos en una función y aplicarlos dentro de un `.then`.
- `.single()` devuelve 406 si no hay fila: usar `.maybeSingle()` cuando «no hay» es un caso válido.
- El SQL redactado por subagentes no se valida solo: revisarlo y comprobarlo contra la base antes de darlo por bueno.
- Procesos que lanzo (servidor de desarrollo): comprobar con el puerto que se cerraron; parar la tarea no siempre mata el proceso hijo.
