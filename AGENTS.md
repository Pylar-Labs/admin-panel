<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Admin panel — Pylar Labs
Panel donde cada cliente de la agencia edita los datos de SU web (negocio, imágenes, servicios, catálogo, testimonios, redes). Los datos viven en Supabase; la landing es `../template-landing`.

## Stack y estructura
- Next.js 16.2 (App Router) · React 19 · TypeScript 5 · Tailwind 4 · shadcn (`@base-ui/react`, estilo base-nova) · Supabase (`@supabase/ssr`)
- `src/app/admin/*` secciones · `src/app/login` · `src/middleware.ts` protege `/admin` · `src/lib/supabase/` clientes y `queries.ts` · `src/types/database.ts` tipos de tablas · `src/components/{admin,ui}`
- `docs/constitution.md` principios · `specs/NNN-*/` specs · `MEMORY.md` memoria entre sesiones

## Comandos
- Ejecutar: `npm run dev` (localhost:3000) · Lint: `npm run lint` · Build: `npm run build` (incluye tipos) · Tests: `npm run test` (módulos puros y flujo de publicación con dependencias falsas, sin red ni base) y `npm run test:db` (aislamiento y alta de clientes: corre SOLO contra la base de PRUEBAS de `.env.test.local`, que debe declarar `PYLAR_TEST_DB=1`; se niega a correr contra producción y limpia lo suyo) · `npm run dev:test` (el panel contra la base de pruebas, para verificar la interfaz sin tocar clientes reales) · Contrato: `npm run contract:sync` regenera lo copiado de `../template-landing`

## Convenciones
- Código en inglés; documentación e interfaz en español. Archivo de referencia del estilo: `src/app/admin/layout.tsx`
- Antes de escribir código de Next.js, leer la guía en `node_modules/next/dist/docs/`.

## Reglas de dominio / trampas conocidas
- `site_id` sale SOLO de `app_metadata` (nunca `user_metadata`, que el usuario puede editar): `useUser` y el alta de clientes. El admin de la agencia es `app_metadata.role = 'admin'` (sin sitio propio), designado fuera del panel con `scripts/set-admin.mjs`.
- Imágenes: bucket `images`, ruta `<site_id>/…`. El cliente edita su `site_config` pero no la crea ni la borra: la crea el alta de clientes (`src/lib/clients/onboarding.ts`); por eso el panel hace `update`, no `upsert`.
- Toda acción de servidor (`'use server'`) empieza por `requireAdmin()` (`src/lib/supabase/require-admin.ts`) si la llama la agencia, o por `requireSiteUser()` (`src/lib/supabase/require-site-user.ts`) si la llama el cliente sobre SU sitio: se puede llamar por fuera de la interfaz. Las de cliente NO reciben el sitio como parámetro (sale de la sesión). La clave de servidor solo se usa en archivos `server-only` (`src/lib/supabase/admin.ts`, `src/lib/publish/server-deps.ts`) y scripts locales.
- `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN`, `VERCEL_TOKEN` (y `VERCEL_TEAM_ID`) solo en el servidor: jamás en código de cliente, jamás con prefijo `NEXT_PUBLIC_` ni en git; `.env.local` no se sube. El enlace de despliegue de cada sitio vive en `site_deploy`, nunca en el navegador. Datos personales y claves: privados.
- El aislamiento entre clientes lo garantizan las políticas RLS de Supabase por `site_id`, no el frontend: toda tabla nueva lleva RLS.
- Las tablas son `site_config`, `gallery`, `services`, `products`, `testimonials` (editables por su cliente) y `site_deploy` (solo de servidor: RLS sin políticas y permisos revocados a `anon` y `authenticated`). Lo que guarda el panel debe poder mapearse al contrato de datos de `../template-landing` (v2.3, `docs/site-schema.md`); no cambiar su forma sin preguntar.
- Publicar: guardar NO despliega; la pantalla `/admin/publicar` arma el archivo, lo valida y hace commit a `src/content/site.data.json` del repo de la web (`src/lib/publish/`). Los datos de entrega por sitio (repo, rama, proyecto de Vercel, enlace) se cargan con `node --env-file=.env.local scripts/set-site-deploy.mjs <site_id> --repo o/n …`.
- Los campos de URL (redes sociales, botones del inicio) guardan la URL http/https completa que exige el contrato: el panel avisa mientras se escribe (`needsFullUrl`) y recorta espacios, pero no convierte usuarios en URLs ni bloquea el guardado; el validador de la publicación juzga el resto.
- `src/lib/contract/contract.generated.ts` y `src/lib/contract/vendor/` se generan con `npm run contract:sync` desde `../template-landing`: no se editan a mano (un test falla si se desactualizan).
- Migraciones (`supabase/migrations/`): solo se aplican con aprobación explícita; aditivas siempre que se pueda, idempotentes y con la reversa documentada en comentarios. Las que borran datos o columnas van aparte. **Se aplican primero a la base de pruebas** (proyecto `PylarLabs-test`) y se corre `npm run test:db`; solo con eso en verde y con tu aprobación se aplican a producción.
- Base de pruebas (`PylarLabs-test`): `.env.test.local` (ignorado por git, nunca se sube) lleva su URL y sus claves más `PYLAR_TEST_DB=1`. Se recrea aplicando `supabase/test-baseline/01-esquema-base.sql` (las cinco tablas se crearon fuera de las migraciones) y después TODAS las migraciones en orden de fecha. `scripts/tests/_guard.mjs` impide que `test:db` y `dev:test` corran contra producción. Los scripts de operación (`set-admin`, `set-site-deploy`) siguen apuntando a producción a propósito.

## Forma de trabajar
- ANTES DE TODO: ejecuta `node scripts/check-setup.mjs`. Si falla, corre `/init-project` y no escribas código hasta que pase.
- Lee `docs/constitution.md` y la spec activa antes de tocar código. Cambio no trivial: planifica primero y espera aprobación; cambios pequeños y revisables.
- Al terminar explica qué cambiaste, cómo lo verificaste y decisiones tomadas por tu cuenta. Nada va a GitHub sin aprobación explícita.

## Memoria
- Al empezar, lee `MEMORY.md`; al terminar una tarea, actualízalo. Máximo ~50 líneas.
- Si algo es regla permanente, propón moverlo a `AGENTS.md`. Nunca guardes datos sensibles.

## Límites
- ✅ Siempre: actualizar `MEMORY.md`; correr `npm run lint` y `npm run build` antes de dar algo por hecho.
- ⚠️ Pregunta antes: dependencias nuevas, archivos fuera de la spec, cambios de esquema de Supabase o de la forma de los datos.
- 🚫 Nunca: implementar algo fuera de la spec activa; subir secretos; avanzar con lint o build en rojo.

## Verificación
- `npm run lint` y `npm run build` sin errores; `npm run test` y `npm run test:db` en verde. (El build puede fallar a veces al descargar Google Fonts: reintentar antes de investigar.)
- UI: MCP Chrome DevTools: abrir `npm run dev:test` (base de pruebas; `npm run dev` solo si hace falta producción), entrar con un usuario de prueba, recorrer cada sección de `/admin`, guardar y comprobar el cambio; consola sin errores y vista móvil 375 px (`emulate` con `375x812x2,mobile,touch`).
