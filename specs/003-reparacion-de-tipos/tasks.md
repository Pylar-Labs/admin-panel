# Tareas 003 — Reparación de tipos y pantallas
> Tareas pequeñas, ordenadas, verificables. Cada una referencia sus RF y termina con la comprobación indicada en verde.
> `[P]` = puede hacerse en paralelo (archivos distintos y sin dependencia entre sí). 🛑 = puerta: no se avanza sin tu aprobación explícita.
> «Test primero»: las pantallas no tienen pruebas automáticas y crearlas está fuera de alcance. Aquí el «rojo» de partida es el estado de `tsc`, lint y build, más un guion de verificación en el navegador escrito antes de tocar nada; cada tarea de código termina cuando su comprobación pasa. Ninguna se da por hecha con lint o build en rojo.
> Antes de tocar código de Next.js se lee la guía correspondiente en `node_modules/next/dist/docs/` (AGENTS.md).

## Fase 0 — Línea base y herramientas (antes de cambiar código)
- [x] T1 (RF-2, RF-9) — Registrar el estado de partida: `npx tsc --noEmit` (13 errores), `npm run lint` (5 errores y 2 avisos), `npm run build` (falla en tipos) y `npm run test:db` (91 de 91). Leer en `node_modules/next/dist/docs/` lo que toque a `layout`, componentes cliente y el uso de imágenes. Verifica: los números coinciden con la spec y quedan anotados en el scratchpad.
- [x] T2 [P] (RF-4 a RF-8) — Escribir el guion de verificación del navegador (lista de pasos por sección, ver T14) y dos scripts locales en el scratchpad, fuera del repositorio: uno que crea los usuarios de prueba y otro que los borra con sus filas y archivos. Prefijo `zz-verif-`, distinto del de `test:db`. Usuario A: sitio con configuración; usuario B: sitio sin configuración. Verifica: crear y borrar una vez, y comprobar que no queda nada.

## Fase 1 — Piezas compartidas
- [x] T3 (RF-7, RF-8) — Añadir a `src/lib/utils.ts` el ayudante que traduce el error de guardado a español (sin configuración o regla de acceso → «Tu sitio todavía no está preparado para guardar. Pedile a la agencia que cree tu configuración.»; otro → «No se pudo guardar. Intentá de nuevo.»). Verifica: `tsc` y lint sin errores nuevos; se prueba de verdad en T14.
- [x] T4 (RF-6, RF-8) — Arreglar `src/components/admin/ImageUpload.tsx`: que muestre siempre `currentUrl` (sin copia local), que avise si el archivo no es una imagen y si falla la subida, con la misma API de props. Verifica: `tsc` y lint sin errores en el archivo.

## Fase 2 — Patrón de carga y pantallas
- [x] T5 (RF-1, RF-2, RF-3, RF-5, RF-8) — Servicios, como prueba del patrón de lint: `name` → `title`, quitar el precio (formulario, guardado y lista), separar «pedir datos» de «aplicarlos», usar el ayudante de mensajes. Verifica: `tsc` y lint sin errores en `servicios/page.tsx`. 🛑 Si la regla de lint sigue protestando con este patrón, te traigo la alternativa (supresión de una línea con motivo) antes de replicarla.
- [x] T6 [P] (RF-2, RF-4, RF-8) — Testimonios: patrón de carga y ayudante de mensajes. Verifica: lint y `tsc` sin errores en `testimonios/page.tsx`.
- [x] T7 [P] (RF-2, RF-4, RF-6, RF-8) — Catálogo: llamada correcta a la subida con ruta `<site_id>/catalogo/<clave por producto>` (clave nueva al crear, identificador al editar), patrón de carga y mensajes. Verifica: lint y `tsc` sin errores en `catalogo/page.tsx`.
- [x] T8 [P] (RF-2, RF-4, RF-5, RF-6, RF-8) — Imágenes: logo y principal con las rutas `<site_id>/logo` y `<site_id>/hero`, galería con `image_url` y `addGalleryImage(siteId, url)`, patrón de carga y mensajes. Verifica: lint y `tsc` sin errores en `imagenes/page.tsx`.
- [x] T9 [P] (RF-8) — Mensajes en `negocio/page.tsx` y `redes/page.tsx` con el ayudante. Verifica: lint y `tsc` sin errores en ambas.

## Fase 3 — Encabezado y tema
- [x] T10 (RF-3) — Quitar `site_url`: `src/app/admin/layout.tsx` deja de leerlo y de pasar `siteUrl`, y `Header.tsx` pierde la propiedad y el enlace «Ver mi sitio». Verifica: `tsc` sin errores en ambos y búsqueda de `site_url` y `siteUrl` sin resultados.
- [x] T11 (RF-2) — Tema con `next-themes`: proveedor en `src/app/layout.tsx` (claro por defecto, sin tema del sistema, marca de hidratación en `html`), `Header` con sol/luna alternados por CSS, eliminar `src/components/ThemeProvider.tsx`. Verifica: lint y `tsc` sin errores; la tarea no queda hecha hasta que T14 confirme el tema en el navegador.

## Fase 4 — Puerta de calidad
- [x] T12 (RF-1, RF-2, RF-9, RF-10) — `npx tsc --noEmit` en 0 errores, `npm run lint` en 0 errores (los 2 avisos de `<img>` quedan, sin avisos nuevos), `npm run build` sin errores, `npm run test:db` en 91 de 91, `git diff` de `src/types/` vacío y de `supabase/` vacío. Verifica: las cinco comprobaciones pasan; si algo falla se corrige en su tarea, no aquí.

## Fase 5 — Verificación en el navegador (usa los scripts de T2)
- [x] T13 (RF-4 a RF-8) — Crear los usuarios de prueba, arrancar `npm run dev` y cargar los comandos de Chrome DevTools. Verifica: entrar con A y con B funciona.
- [x] T14 (RF-3 a RF-8) — Con A, en escritorio: recorrer cada sección de `/admin` (negocio, imágenes, servicios, catálogo, testimonios, redes), guardar y recargar viendo lo mismo; subir logo, imagen principal, foto de galería y de producto; reemplazar y quitar una imagen; probar un archivo que no es imagen; comprobar con la clave de servidor que los archivos están en `images/<site_id>/…` y que la URL pública carga sin sesión; confirmar que no hay precio en servicios ni enlace «Ver mi sitio»; comprobar el tema claro/oscuro. Con B: guardar en cada sección y ver el aviso en español, y que las secciones abren sin romperse. Consola sin errores. Verifica: cada paso del guion de T2 marcado.
- [x] T15 (RF-2, RF-4) — Repetir el recorrido de A en vista móvil de 375 px (`emulate` con `375x812x2,mobile,touch`). Verifica: sin desbordes ni errores de consola.
- [x] T16 (RF-9) — Borrar usuarios, filas y archivos de prueba y detener el servidor de desarrollo; repetir `npm run test:db`. Verifica: 0 usuarios `zz-verif-`, 0 carpetas de prueba en `images`, las cinco tablas con 0 filas, `test:db` 91 de 91.

## Fase 6 — Cierre
- [x] T17 — Verificación final contra los criterios de finalización de la spec: 13 errores de tipos y 5 de lint resueltos, lint y build sin errores, `test:db` en verde, cada RF verificado (automáticamente o en el navegador), ninguna fila ni esquema modificados. Informe de lo verificado y de lo que no se pudo verificar.
- [x] T18 — Actualizar `MEMORY.md` (estado de la 003, qué se verificó en el navegador, siguiente paso: spec 005) y **proponerte** los cambios para `AGENTS.md` (quitar «Tests: no existen aún» y la nota de `site_url`; añadir las reglas de la spec 004). No cambio `AGENTS.md` sin tu OK.
