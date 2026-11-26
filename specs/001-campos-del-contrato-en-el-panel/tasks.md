# Tareas 001 — Campos del contrato en el panel
> Tareas pequeñas, ordenadas, verificables. Cada una referencia sus RF y termina con la comprobación indicada en verde.
> `[P]` = puede hacerse en paralelo (archivos distintos y sin dependencia entre sí). 🛑 = puerta: no se avanza sin tu aprobación explícita.
> «Test primero»: los módulos puros (contrato, límites, identificador) y la base se prueban con `node --test` antes de implementarlos y deben fallar primero. Las pantallas no tienen pruebas automáticas (sin corredor de interfaz, fuera de alcance): su «rojo» de partida es el guion de verificación del navegador escrito antes de tocar nada, y cada una termina con `tsc` y lint en verde más el recorrido en Chrome DevTools (escritorio y 375 px, consola limpia).
> Antes de tocar código de Next.js se lee la guía correspondiente en `node_modules/next/dist/docs/` (AGENTS.md). El template (`../template-landing`) es solo de lectura: ningún cambio allá (RF-9).
> Nada va a GitHub sin tu aprobación. Las migraciones se aplican solo con tu aprobación explícita (T10).

## Ajustes al plan por lo ocurrido desde que se escribió (se revisan al aprobar estas tareas)
1. **Prerrequisitos cumplidos:** la 003 (tipos y pantallas) y la 004 (esquema multicliente) están hechas; el esquema real ya se leyó y está endurecido (`supabase/migrations/20261123010000_…`). La línea base de partida es `tsc` 0, lint 0 errores (2 avisos `<img>`), build correcto y `npm run test:db` 114/114.
2. **`scripts/isolation-check.mjs` no se crea:** la prueba de aislamiento de lo nuevo se agrega a `scripts/tests/aislamiento.test.mjs` (ya automática, con prefijo `zz-aislamiento-`). Esa prueba comprueba las columnas exactas de cada tabla, así que hay que actualizarla junto con la migración.
3. **Ubicación de las pruebas nuevas:** `scripts/tests/` (como las existentes), no `scripts/`. Nuevo script `npm run test` para las pruebas puras sin base (`contract-sync`, `limits`, `slug`); `npm run test:db` no cambia.
4. **`AGENTS.md`:** ya tiene la regla de tests y de la clave de servidor; solo se propone añadir `contract:sync`, que `contract.generated.ts` no se edita y la regla de migraciones.
5. **Las dos dudas abiertas de la spec** (fuente de los límites; secciones donde van los campos) ya las resuelve el plan, decididas contigo: extraer del JSON Schema y las descripciones, y repartir en Mi negocio, Servicios, Catálogo y Testimonios. T1 las cierra en la spec.
6. **Las tablas están vacías en la base de PylarLabs** (0 filas): el relleno de `slug` y la conservación de datos (RF-11) se prueban sembrando filas de prueba antes de aplicar la migración (T10).

## Fase 0 — Cierre de dudas y línea base
- [x] T1 (RF-9, RF-11) — Pasar a «Resueltas» las dos dudas abiertas de `spec.md` (con la fecha y la decisión del plan); leer en `node_modules/next/dist/docs/` lo que toque a formularios y componentes cliente; registrar la línea base (`tsc`, lint, build, `test:db`) y el estado limpio de `../template-landing` (`git status`). Verifica: números anotados en el scratchpad y coinciden con el punto 1 de arriba.
- [x] T2 [P] (RF-1, RF-8, RF-12) — Escribir el guion de verificación del navegador (pasos por sección, ver T22) y dos scripts locales de usuarios de prueba en el scratchpad, fuera del repo (crear con prefijo `zz-verif-`: usuario A con configuración, usuario B sin configuración; borrar con sus filas y archivos). Verifica: crear y borrar una vez y comprobar que no queda nada.

## Fase 1 — Contrato y límites (módulos puros, test primero)
- [x] T3 (RF-6, RF-9) — `scripts/tests/contract-sync.test.mjs`: falla si algún campo de texto del JSON Schema queda sin límite extraído, si faltan los máximos de lista, los íconos, idiomas o monedas, o si la copia generada no coincide con una regeneración en vivo. Verifica: corre y falla (falta el generador).
- [x] T4 (RF-6, RF-9) — `scripts/sync-contract.mjs` y su salida `src/lib/contract/contract.generated.ts` (marcado «generado, no editar», con la versión del contrato); scripts `contract:sync` y `test` en `package.json`. Solo lee el template. Verifica: T3 en verde; `git status` del template sigue limpio.
- [x] T5 [P] (RF-6) — `scripts/tests/limits.test.mjs`: límite exacto, +1, emojis y caracteres combinados contados como grafemas (mismos casos del contrato), una sola línea, cantidad máxima de lista y +1, formato del WhatsApp. Verifica: corre y falla.
- [x] T6 (RF-6, RF-7) — `src/lib/contract/limits.ts` (módulo puro, sin imports relativos ni `enum`): cuenta grafemas y compara contra el límite sin bloquear nada. Verifica: T5 en verde.
- [x] T7 [P] (RF-5) — `scripts/tests/slug.test.mjs`: crear desde el nombre, tildes y símbolos, nombre vacío o solo símbolos (respaldo `producto-N`), repetidos con sufijo numérico, renombrar sin cambiar el identificador. Verifica: corre y falla.
- [x] T8 (RF-5) — `src/lib/slug.ts` (módulo puro). Verifica: T7 en verde; `npm run test` pasa completo.

## Fase 2 — Esquema (puerta de aprobación)
- [x] T9 (RF-1, RF-5, RF-10, RF-11) — Redactar `supabase/migrations/<fecha>_campos_del_contrato.sql` **sin aplicarla**: columnas aditivas con valores por defecto en `site_config` (idioma, «Quiénes somos», cifras, destacados, botones, moneda, mostrar precios, agrupar, texto del botón, títulos de sección), `testimonials.role`, `products.slug` con relleno de los existentes (respaldo `producto-N`) y el índice único por `site_id` al final; reversa documentada en comentarios; `price_visible` queda sin uso y sin borrarse. Revisar el SQL a mano (el redactado por subagentes no se da por bueno sin comprobarlo). Verifica: revisión línea a línea contra «Modelo de datos» del plan y contra la 004 (las políticas heredan por tabla; no se tocan).
- [x] T10 (RF-10, RF-11) — Ampliar `scripts/tests/aislamiento.test.mjs`: columnas esperadas de cada tabla (`EXPECTED_COLUMNS`), un cliente edita los campos nuevos de lo suyo y no puede leer ni editar los de otro, `slug` único por sitio pero repetible entre sitios, valores por defecto en una fila nueva. Verifica: corre y falla solo en lo nuevo (las 91 anteriores siguen verdes).
- [x] T11 🛑 (RF-10, RF-11) — **Con tu aprobación explícita**, sembrar filas de prueba `zz-` (productos con nombre vacío, repetido y con símbolos; configuración con datos), contar y copiar sus valores, aplicar la migración con `apply_migration` sobre PylarLabs (confirmar antes que `.env.local` y el conector apuntan a `eplnsjdvjawwijokoerk`), y comparar: mismos conteos, mismos valores y `slug` rellenado sin vacíos ni repetidos. Limpiar las filas de prueba. Verifica: T10 en verde y `npm run test:db` completo en verde.

## Fase 3 — Tipos, consultas y componentes compartidos
- [x] T12 (RF-1, RF-3, RF-4, RF-5) — `src/types/database.ts` y `src/lib/supabase/queries.ts` con los campos nuevos (el panel sigue haciendo `update` de `site_config`, nunca `upsert`; el `slug` se calcula con `slug.ts` al crear el producto y no se envía al editar). Verifica: `tsc` y lint sin errores nuevos; el chequeo de la prueba de aislamiento sobre `queries.ts` sigue verde.
- [x] T13 [P] (RF-6, RF-7, RF-12) — `src/components/admin/LimitedField.tsx`: Input/Textarea con contador de grafemas y límite visible, sin `maxLength` nativo, sin deshabilitar el guardado, en español. Verifica: `tsc` y lint sin errores.
- [x] T14 [P] (RF-8, RF-12) — `src/components/admin/NotPublishedNotice.tsx`: aviso «no se muestra en tu web». Verifica: `tsc` y lint sin errores.

## Fase 4 — Pantallas (cada una usa los componentes de la Fase 3)
- [x] T15 (RF-1, RF-2, RF-6, RF-7, RF-12) — `negocio/page.tsx`, bloque 1: «Quiénes somos» (título y texto), cifras (hasta 3) y destacados (hasta 5), idioma de la web. Verifica: `tsc` y lint sin errores; guardar un texto por encima del límite guarda y avisa.
- [x] T16 (RF-1, RF-2, RF-6, RF-8) — `negocio/page.tsx`, bloque 2: botón principal (texto y destino obligatorios, sugerencia «Contactanos» a contacto que el cliente confirma; destino entre secciones existentes o URL http/https) y secundario opcional, títulos y subtítulos de sección, avisos en horarios y mapa. Verifica: `tsc` y lint sin errores.
- [x] T17 [P] (RF-1, RF-6) — `servicios/page.tsx`: selector de ícono desde la lista del contrato (un valor guardado fuera de la lista se marca «pendiente de elegir» sin tocar el dato) y límites. Verifica: `tsc` y lint.
- [x] T18 [P] (RF-1, RF-4, RF-5, RF-6) — `catalogo/page.tsx`: moneda, un solo «mostrar precios», agrupar por categoría, texto del botón de consulta; identificador automático al crear; se quita la visibilidad de precio por producto. Verifica: `tsc` y lint.
- [x] T19 [P] (RF-1, RF-3, RF-6) — `testimonios/page.tsx`: rol opcional y límites. Verifica: `tsc` y lint.
- [x] T20 [P] (RF-8) — `imagenes/page.tsx`: aviso «no se muestra en tu web» en galería, logo e imagen principal. Verifica: `tsc` y lint.

## Fase 5 — Puerta de calidad
- [x] T21 (RF-9, RF-10) — `npx tsc --noEmit` 0 errores, `npm run lint` 0 errores (sin avisos nuevos), `npm run build` correcto, `npm run test` y `npm run test:db` en verde; `git status` de `../template-landing` limpio y sin cambios en `src/middleware.ts`. Verifica: las cinco pasan; si algo falla se corrige en su tarea, no aquí.

## Fase 6 — Verificación en el navegador (usa los scripts de T2)
- [x] T22 (RF-1 a RF-8, RF-12) — Crear los usuarios de prueba, arrancar `npm run dev` y, con A en escritorio: cargar cada campo nuevo de cada sección, guardar, recargar y ver lo mismo; excederse de cada límite y comprobar que se avisa y se guarda; cantidad máxima y +1 de cifras y destacados; destino del botón con sección y con URL; cambiar el idioma con contenido escrito (solo cambia la etiqueta); producto sin nombre o repetido; ver los avisos «no se muestra»; mostrar precios y moneda sin decimales con un precio con decimales. Con B (sin configuración): guardar y ver el aviso en español. Consola sin errores. Verifica: cada paso del guion de T2 marcado.
- [x] T23 (RF-8, RF-12) — Repetir el recorrido en vista móvil de 375 px (`emulate` con `375x812x2,mobile,touch`). Verifica: sin desbordes ni errores de consola.
- [x] T24 — Borrar usuarios, filas y archivos de prueba, parar el servidor de desarrollo (comprobar que el puerto quedó libre) y repetir `npm run test:db`. Verifica: 0 usuarios `zz-`, 0 carpetas de prueba en `images`, las cinco tablas con 0 filas (las que sembró la verificación), `test:db` en verde.

## Fase 7 — Cierre
- [x] T25 — Verificación final contra los criterios de finalización de la spec: cada RF con su prueba (automática o manual documentada), «con un sitio de prueba se pueden cargar todos los campos que exige el contrato», aislamiento sobre lo nuevo, qué no se pudo verificar. Informe.
- [x] T26 — Actualizar `MEMORY.md` (estado de la 001, decisiones: fuente de límites por descripciones y su fragilidad, `slug`, `price_visible` sin uso) y **proponerte** los cambios para `AGENTS.md` (`contract:sync` y `npm run test`; `contract.generated.ts` no se edita; migraciones solo con aprobación, aditivas y con reversa). Sin cambiar `AGENTS.md` sin tu OK. Siguiente: plan de la 002.
