# MEMORY — Admin panel — Pylar Labs

## Estado actual
- Adoptado el 2026-11-19 con el flujo spec-driven de template-landing. Código existente (login, `/admin/*`, Supabase) sin commitear sobre el commit inicial; sin `origin`. Las specs 004 y 003 tampoco están commiteadas.
- Orden de las specs (por dependencia): 004 ✅ → 003 ✅ → 005 → 001 → 002.
- **004 esquema multicliente (endurecimiento): IMPLEMENTADA (2026-11-23/24).** Migración `supabase/migrations/20261123010000_endurecer_esquema_multicliente.sql` aplicada (idempotente). Prueba `npm run test:db` (`scripts/tests/aislamiento.test.mjs`) 91/91; prefijo de prueba `zz-aislamiento-`, solo escribe en PylarLabs. Es sensible a cortes de red (`fetch failed`/`ECONNRESET`): repetir antes de sospechar de las reglas.
- **003 reparación de tipos y pantallas: IMPLEMENTADA (2026-11-24).** Puerta en verde: `tsc` 0 errores, `npm run lint` 0 errores y 2 avisos (`<img>` en catálogo e imágenes, no bloquean), `npm run build` correcto, `test:db` 91/91. Verificada en el navegador (escritorio y 375 px, consola limpia) con usuarios de prueba que ya se borraron.
- 005 alta de clientes: spec redactada, pendiente de aprobación; 5 dudas abiertas (publicar en nombre del cliente, invitación vencida, nombre repetido, columnas de la lista, marca de cambios del admin).
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
- Aplicar (con tu OK) las reglas nuevas en AGENTS.md (ver abajo). Siguiente spec: 005 (aprobarla, cerrar sus dudas, plan).
- Fuera de la 003, vistos al verificar: el aviso «2 imagenes agregadas» no lleva tilde; quitar una foto o el logo borra solo la referencia, el archivo queda en el almacenamiento (huérfano); `/admin/cuenta` solo se abrió, no se revisó a fondo; `middleware` → `proxy` (aviso de Next 16, ese archivo protege `/admin`) para otra spec.
- Resolver con el template cómo lee la versión publicada y cómo confirma el build (002); mover `vercel_deploy_hook` fuera del navegador.
- Commitear lo hecho (004 y 003) y crear el repo remoto; instalar el hook `SessionStart` (denegado en esta sesión).
- La prueba de base corre sobre la base real (datos de prueba que limpia); con clientes reales conviene una base de pruebas aparte.

## Propuesta para AGENTS.md (sin aplicar, espera tu OK)
- Quitar «Tests: no existen aún» (hay `npm run test:db`) y «Pendiente de revisar: `admin/layout.tsx` usa `site_url`» (resuelto).
- Dominio: `site_id` en `app_metadata.site_id` y admin en `app_metadata.role = 'admin'`; bucket `images` con ruta `<site_id>/…`; cada tabla del panel lleva `site_id` y RLS; el cliente no crea ni borra `site_config`; `npm run test:db` demuestra el aislamiento.

## Errores a evitar
- No usar `user_metadata` para `site_id` ni rol. No asumir APIs de Next.js 16: leer `node_modules/next/dist/docs/`.
- Antes de leer o migrar un esquema, comprobar a qué proyecto de Supabase apunta `.env.local` y qué ve el conector: se leyó la base de la landing creyendo que era la del panel.
- Al cambiar reglas de acceso, probar con las MISMAS consultas que usa el panel (`upsert` incluido): un `upsert` exige también el permiso de crear.
- Lint `react-hooks/set-state-in-effect`: no llamar desde un efecto a una función que guarda estado; pedir los datos en una función y aplicarlos dentro de un `.then`.
- `.single()` devuelve 406 si no hay fila: usar `.maybeSingle()` cuando «no hay» es un caso válido.
- El SQL redactado por subagentes no se valida solo: revisarlo y comprobarlo contra la base antes de darlo por bueno.
- Procesos que lanzo (servidor de desarrollo): comprobar con el puerto que se cerraron; parar la tarea no siempre mata el proceso hijo.
