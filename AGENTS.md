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
- Ejecutar: `npm run dev` (localhost:3000) · Lint: `npm run lint` · Build: `npm run build` (incluye tipos) · Tests: `npm run test:db` (aislamiento y alta de clientes, contra la base real de `.env.local`; solo escribe en PylarLabs y limpia lo suyo)

## Convenciones
- Código en inglés; documentación e interfaz en español. Archivo de referencia del estilo: `src/app/admin/layout.tsx`
- Antes de escribir código de Next.js, leer la guía en `node_modules/next/dist/docs/`.

## Reglas de dominio / trampas conocidas
- `site_id` sale SOLO de `app_metadata` (nunca `user_metadata`, que el usuario puede editar): `useUser` y el alta de clientes. El admin de la agencia es `app_metadata.role = 'admin'` (sin sitio propio), designado fuera del panel con `scripts/set-admin.mjs`.
- Imágenes: bucket `images`, ruta `<site_id>/…`. El cliente edita su `site_config` pero no la crea ni la borra: la crea el alta de clientes (`src/lib/clients/onboarding.ts`); por eso el panel hace `update`, no `upsert`.
- Toda acción de servidor (`'use server'`) empieza por `requireAdmin()` (`src/lib/supabase/require-admin.ts`): se puede llamar por fuera de la interfaz. La clave de servidor solo se usa en archivos `server-only` (`src/lib/supabase/admin.ts`) y scripts locales.
- `SUPABASE_SERVICE_ROLE_KEY` jamás en código de cliente ni en git; `.env.local` no se sube. Datos personales y claves: privados.
- El aislamiento entre clientes lo garantizan las políticas RLS de Supabase por `site_id`, no el frontend: toda tabla nueva lleva RLS.
- Las tablas son `site_config`, `gallery`, `services`, `products`, `testimonials`. Lo que guarda el panel debe poder mapearse al contrato de datos de `../template-landing` (v2.3, `docs/site-schema.md`); no cambiar su forma sin preguntar.

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
- `npm run lint` y `npm run build` sin errores.
- UI: MCP Chrome DevTools: abrir `npm run dev`, entrar con un usuario de prueba, recorrer cada sección de `/admin`, guardar y comprobar el cambio; consola sin errores y vista móvil 375 px (`emulate` con `375x812x2,mobile,touch`).
