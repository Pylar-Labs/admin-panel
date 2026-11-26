# Tareas 005 — Alta de clientes y administración desde el panel
> Tareas pequeñas, ordenadas, verificables. Cada una referencia sus RF y termina con la comprobación indicada en verde.
> `[P]` = puede hacerse en paralelo (archivos distintos y sin dependencia entre sí). 🛑 = puerta: no se avanza sin tu aprobación explícita.
> «Test primero»: la lógica de alta y la comprobación de admin se prueban en Node contra PylarLabs (`npm run test:db`) antes de implementarlas. Las pantallas no tienen pruebas automáticas; se verifican en el navegador con Chrome DevTools (escritorio y 375 px). El correo se verifica a mano.
> Antes de tocar código de Next.js se leen las guías de acciones de servidor y seguridad de datos en `node_modules/next/dist/docs/` (AGENTS.md).
> Las pruebas escriben en la base real con prefijo `zz-alta-` y se detienen si `.env.local` no apunta a PylarLabs. Nada va a GitHub sin tu aprobación.

## Fase 0 — Línea base y guías
- [x] T1 (RF-2, RF-4) — Leer en `node_modules/next/dist/docs/` las guías de acciones de servidor, seguridad de datos y variables de entorno; registrar la línea base: `npx tsc --noEmit`, `npm run lint` (0 errores, 2 avisos), `npm run build` y `npm run test:db` (91 de 91). Verifica: números anotados en el scratchpad y coinciden con el cierre de la 003.

## Fase 1 — Pruebas primero (en rojo)
- [x] T2 (RF-1) — `scripts/set-admin.mjs`: marca una cuenta existente como admin (`app_metadata.role = 'admin'`) con la clave de servidor; se niega si `.env.local` no apunta a PylarLabs. Verifica: ejecutado sobre un usuario de prueba `zz-alta-` lo deja admin, y se borra después. 🛑 Antes de usarlo sobre una cuenta real, tu OK.
- [x] T3 (RF-3, RF-5 a RF-9, RF-16) — `scripts/tests/alta.test.mjs`: barrido y limpieza `zz-alta-`, guarda de host, y pruebas de: alta correcta (config solo con nombre, usuario con `app_metadata.site_id`), validación en tabla (vacío, espacios, formato, varias líneas, 100/101), email duplicado (y carrera simulada), nombre repetido sin/con confirmar y normalizado, fallo inyectado en cada paso (config, invitar, asignar) sin dejar nada, fallo al deshacer con detalle de lo que quedó, lista con estado pendiente/activo. Verifica: la prueba corre y falla (falta el módulo).
- [x] T4 (RF-1, RF-2) — En la misma prueba, casos de la comprobación de admin: admin con rol en `app_metadata` pasa; rol solo en `user_metadata`, cliente normal y sin sesión no. Verifica: falla (falta la pieza).

## Fase 2 — Servidor
- [x] T5 (RF-3 a RF-9, RF-16) — `src/lib/clients/onboarding.ts` con el cliente de administración inyectado: validar, buscar email y nombre repetidos, alta con deshacer por pasos (config → invitar → asignar sitio), listar con estado. Verifica: lo de T3 en verde.
- [x] T6 [P] (RF-1, RF-2) — `src/lib/supabase/admin.ts` (cliente de servicio, `server-only`) y `src/lib/supabase/require-admin.ts` (`getUser()`, rol de `app_metadata`). Verifica: T4 en verde; búsqueda de `SERVICE_ROLE` solo en archivos de servidor y scripts.
- [x] T7 (RF-2, RF-3, RF-9) — `src/app/admin/clientes/actions.ts`: `createClientAction` y `listClientsAction`, cada una empieza por la comprobación de admin y devuelve mensajes en español. Verifica: `tsc` y lint sin errores.
- [x] T8 — `package.json`: `test:db` ejecuta las dos pruebas. Verifica: `npm run test:db` en verde (91 + las nuevas).

## Fase 3 — Modo admin
- [x] T9 (RF-10, RF-12) — `src/hooks/useActiveSite.ts` (sessionStorage con `useSyncExternalStore`) y `useUser` con `isAdmin` y `siteId` = cliente elegido para admin. Verifica: lint (`set-state-in-effect`) y `tsc` sin errores.
- [x] T10 (RF-11, RF-12) — `src/app/admin/layout.tsx`: bloqueo sin cliente elegido, franja con cliente, «Cambiar»/«Salir», recarga del nombre y reinicio por `key`; `Sidebar.tsx` con «Clientes» solo para admin. Verifica: lint y `tsc` sin errores.

## Fase 4 — Pantallas nuevas
- [x] T11 (RF-2, RF-3, RF-8, RF-9, RF-15, RF-16) — `src/app/admin/clientes/page.tsx`: lista (nombre, email, estado), formulario de alta con aviso y confirmación de nombre repetido, «Elegir» cliente; «sin permiso» para no admin. Verifica: lint y `tsc` sin errores.
- [x] T12 [P] (RF-4, RF-15) — `src/app/aceptar-invitacion/page.tsx` pública: lee la sesión del enlace, pide contraseña (≥6, mismas reglas que «Mi cuenta») y va a `/admin`. Verifica: lint y `tsc`; el `matcher` de `src/middleware.ts` no la cubre.

## Fase 5 — Puerta de calidad
- [x] T13 — `npx tsc --noEmit` 0 errores, `npm run lint` 0 errores (sin avisos nuevos), `npm run build` correcto, `npm run test:db` todo en verde; `git diff` de `supabase/`, `src/types/` y `src/middleware.ts` vacío. Verifica: las cinco pasan; si algo falla se corrige en su tarea.

## Fase 6 — Verificación manual
- [ ] T14 (RF-3, RF-4) 🛑 — Comprobar con Supabase la configuración de correo y las redirecciones permitidas (incluida la URL de producción, que debes indicarme); probar una invitación real a un correo tuyo y/o un enlace generado con la clave de servidor, y confirmar que el cliente del navegador lee la sesión del enlace. Verifica: el invitado llega a `/aceptar-invitacion`, crea contraseña y entra a un panel con su sitio. **Pendiente (decidido el 2026-11-24 cerrar sin esto):** verificado sin correo (enlace generado con la clave de servidor, `localhost:3000` aceptado como redirección); falta entrega real, SMTP propio y URL de producción.
- [x] T15 (RF-2, RF-9 a RF-12, RF-14, RF-15) — Navegador, escritorio y 375 px, consola limpia: con un admin de prueba, alta de cliente, lista (pendiente → activo), elegir cliente, recorrer las seis secciones, guardar y subir imágenes comprobando en la base que quedó en ese sitio, cambiar de cliente, sin cliente elegido; con un cliente de prueba, no ve «Clientes» y la dirección directa da «sin permiso». Verifica: cada paso marcado.
- [x] T16 — Limpiar usuarios, filas y archivos `zz-alta-`/`zz-verif-`, parar el servidor de desarrollo (comprobar el puerto) y repetir `npm run test:db`. Verifica: 0 usuarios de prueba, 0 carpetas de prueba en `images`, cinco tablas con 0 filas.

## Fase 7 — Cierre
- [x] T17 — Verificación final contra los criterios de finalización de la spec: cada RF con su prueba, qué se verificó y qué no (p. ej. llamada directa real a la acción, entrega de correo con cliente real).
- [x] T18 — Actualizar `MEMORY.md` (estado de la 005, lo comprobado sobre correo y redirecciones, siguiente: 001) y **proponerte** los cambios para `AGENTS.md` (los de la 003/004 más: clave de servidor solo en archivos solo-servidor; toda acción de servidor comprueba el rol). Sin cambiar `AGENTS.md` sin tu OK.
