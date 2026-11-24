# Plan 001 — Campos del contrato en el panel
> El CÓMO. Debe cumplir `docs/constitution.md` y cubrir todos los RF de `spec.md`.

## Prerrequisitos (decididos con el usuario)
- **Spec 003 de reparación primero** (aún por redactar): hoy `tsc --noEmit` da 14 errores previos (`servicios` usa `name`/`price` que `Service` no tiene; `ImageUpload` recibe props no declaradas; `imagenes` usa `url` y pasa un objeto donde se espera texto; `layout` lee `site_url`). La 001 se implementa con `npm run lint` y `npm run build` en verde de partida.
- **Esquema real de Supabase sin verificar**: la base dio timeout dos veces al listar tablas. La tarea 1 es leerlo (reintento por MCP o desde el panel de Supabase) y confirmar columnas, claves y RLS antes de escribir migraciones. Todo lo de "Modelo de datos" es una propuesta contra `src/types/database.ts`.
- **Fuente de límites** (decidido): extraer del JSON Schema y de las descripciones del template, con test de cobertura. No se toca el template.

## Enfoque técnico
1. **Una sola fuente generada.** `scripts/sync-contract.mjs` lee `../template-landing/docs/site.schema.json` (máximos de lista, enums de idioma y moneda, obligatorios) y `docs/site-schema.md` (versión del contrato), y de las descripciones extrae «Máximo N caracteres», «una sola línea» y «Uno de: …» (íconos). Escribe `src/lib/contract/contract.generated.ts` (marcado «generado, no editar»). Un test falla si algún campo de texto queda sin límite extraído o si la copia no coincide con una regeneración en vivo. Sin dependencias nuevas.
2. **Límites visibles sin bloquear.** Un componente de campo con contador usa esos datos y cuenta grafemas (`Intl.Segmenter`) como el contrato; nunca usa `maxLength` nativo ni deshabilita el guardado (RF-6, RF-7).
3. **Datos nuevos en columnas y `jsonb` de las tablas actuales** (sin tablas nuevas, mínimo de piezas): `site_config` gana los campos de "Quiénes somos", botones, idioma, moneda y títulos de sección; `testimonials` gana `role`; `products` gana un identificador estable. Cambios aditivos y con valores por defecto: los datos existentes no se tocan (RF-11).
4. **Identificador de producto** (`slug`) por función pura: se genera al crear, no cambia al renombrar, se desambigua con sufijo numérico; la migración rellena los productos existentes (RF-5).
5. **Interfaz distribuida en las secciones actuales** (decidido): Mi negocio (quiénes somos, cifras, destacados, botones, idioma, títulos de sección), Servicios (ícono), Catálogo (moneda, mostrar precios, agrupar, texto del botón; sin visibilidad por producto), Testimonios (rol). Avisos «no se muestra en tu web» en horarios, mapa, galería, logo e imagen del hero (RF-8).
6. **Migraciones como archivos SQL versionados**; se aplican solo con tu aprobación explícita, nunca desde el plan.
7. **Pruebas sin dependencias nuevas**: `node --test` sobre módulos puros en `.ts` sin imports relativos ni `enum` (Node 24 quita los tipos), igual que el template. Lo que depende de Supabase o del navegador se verifica con script manual documentado y con Chrome DevTools.

Alternativas descartadas: dependencia npm hacia el template (dependencia nueva y cambios allá); constantes a mano (copia manual, choca con una sola fuente); tablas nuevas para cifras y secciones (más piezas sin necesidad); `maxLength` nativo (impediría escribir, contra RF-6).

## Archivos a crear / modificar
| Archivo | Cambio |
|---|---|
| `scripts/sync-contract.mjs` | Nuevo. Genera la copia del contrato y la versión desde el template hermano. |
| `src/lib/contract/contract.generated.ts` | Nuevo, generado. Versión, límites por campo, máximos de lista, íconos, idiomas, monedas. |
| `src/lib/contract/limits.ts` | Nuevo. Cuenta grafemas y compara contra el límite; módulo puro. |
| `src/lib/slug.ts` | Nuevo. Genera y desambigua el identificador de producto; módulo puro. |
| `src/components/admin/LimitedField.tsx` | Nuevo. Input/Textarea con contador y límite visible, sin bloquear. |
| `src/components/admin/NotPublishedNotice.tsx` | Nuevo. Aviso «no se muestra en tu web». |
| `src/app/admin/negocio/page.tsx` | Quiénes somos, cifras, destacados, botones, idioma, títulos de sección; límites; avisos en horarios y mapa. |
| `src/app/admin/servicios/page.tsx` | Selector de ícono y límites (tras la spec 003). |
| `src/app/admin/catalogo/page.tsx` | Moneda, «mostrar precios» único, agrupar, texto del botón; identificador automático; quita visibilidad por producto. |
| `src/app/admin/testimonios/page.tsx` | Rol opcional y límites. |
| `src/app/admin/imagenes/page.tsx` | Aviso «no se muestra» (galería, logo, imagen del hero). |
| `src/lib/supabase/queries.ts`, `src/types/database.ts` | Campos y tipos nuevos. |
| `supabase/migrations/*.sql` | Nuevos. Aditivos, con relleno de `slug` y reversa documentada. |
| `scripts/contract-sync.test.mjs`, `scripts/limits.test.mjs`, `scripts/slug.test.mjs` | Tests nuevos. |
| `scripts/isolation-check.mjs` | Nuevo. Prueba manual de aislamiento entre dos usuarios (credenciales por variables de entorno, nunca en el repo). |
| `package.json` | Scripts `contract:sync` y `test` (`node --test`). Sin dependencias. |
| `AGENTS.md`, `MEMORY.md` | Ver «Actualizaciones previstas». |

## Modelo de datos / interfaces (propuesta a validar contra la base real)
- `site_config`: `language` (`es`|`en`|`pt`, por defecto `es`); `about_title`, `about_body` (texto); `about_stats` (`jsonb`, lista de `{value,label}`, hasta 3); `about_highlights` (`jsonb`, lista de textos, hasta 5); `hero_cta_primary_label/href`, `hero_cta_secondary_label/href`; `currency` (por defecto `ARS`); `show_prices` (por defecto `true`); `group_by_category` (por defecto `false`); `product_cta_label`; `section_titles` (`jsonb`: por sección `title` y `subtitle`). `hero_title` y `hero_subtitle` ya existentes quedan como titular y subtítulo.
- `services.icon` (ya existe en el tipo): valores de la lista generada del contrato; el contrato no se refleja con un `CHECK` en la base para no duplicarlo.
- `testimonials.role` (texto, opcional).
- `products.slug` (texto, único por `site_id`) y `site_config.show_prices` reemplazan en la práctica a `products.price_visible`, que queda sin uso y sin borrarse (RF-11).
- Compatibilidad: todo aditivo y con valores por defecto; filas viejas siguen siendo válidas para el panel. Los límites del contrato se validan en el cliente; la validación que bloquea es de la spec 002.
- RLS: cada columna nueva hereda las políticas de su tabla; la tarea 1 comprueba que todas las tablas tienen RLS por `site_id`.

## Mapa RF → implementación → test
| RF | Dónde se implementa | Test que lo verifica |
|---|---|---|
| RF-1 | Páginas negocio, servicios, catálogo, testimonios; columnas nuevas; `queries.ts` | Manual en Chrome: cargar cada campo y releerlo tras recargar; `tsc` y `build` |
| RF-2 | Botones del inicio en negocio | Manual en Chrome: sugerencia «Contactanos» a contacto, destino elegido entre secciones o URL http(s) |
| RF-3 | Rol en testimonios; campos de contacto ya existentes | Manual en Chrome |
| RF-4 | Catálogo: interruptor único; se quita la visibilidad por producto | Manual en Chrome; revisión de `queries.ts` |
| RF-5 | `slug.ts` + migración de relleno | `scripts/slug.test.mjs` (crear, renombrar sin cambiar, duplicados, nombre vacío, tildes y símbolos) |
| RF-6 | `contract.generated.ts`, `limits.ts`, `LimitedField.tsx` | `scripts/limits.test.mjs` (límite exacto, +1, emojis y combinados, una sola línea); `scripts/contract-sync.test.mjs`; manual en Chrome |
| RF-7 | `LimitedField` sin `maxLength` nativo; guardado sin validación bloqueante | Manual: guardar un texto excedido y recargar |
| RF-8 | `NotPublishedNotice` en negocio e imágenes | Manual en Chrome, escritorio y 375 px |
| RF-9 | Ningún cambio en `../template-landing` | `git status` del template limpio; revisión del diff |
| RF-10 | Revisión de RLS (tarea 1) y `scripts/isolation-check.mjs` | Ejecución manual con dos usuarios de prueba: lectura y escritura cruzadas rechazadas |
| RF-11 | Migraciones aditivas con valores por defecto | Comparar conteos de filas antes/después en la base de prueba |
| RF-12 | Textos de interfaz en español; contenido libre del cliente | Revisión manual en Chrome |

## Riesgos y casos límite
- **Extracción por descripciones frágil**: si el template cambia la redacción, el límite se pierde. Mitigación: el test de cobertura falla si algún campo de texto queda sin límite, y la frescura de la copia se comprueba contra el template.
- **Esquema real desconocido** (timeout): la tarea 1 lo lee antes de cualquier migración; el modelo se ajusta si difiere.
- **Aplicar migraciones**: tocan una base compartida. Solo con aprobación explícita, primero en una rama o proyecto de prueba si existe; cada migración con su reversa.
- **Conteo de caracteres distinto al del template** (grafemas frente a unidades): la prueba usa los mismos casos del contrato (emojis y combinados).
- **Cambio de idioma con contenido escrito**: solo cambia la etiqueta del idioma; el contenido no se toca.
- **Relleno de `slug`** con nombres vacíos, repetidos o con símbolos: la migración usa un respaldo `producto-N` y deja el índice único para el final.
- **Deploy hook en el navegador** (`triggerVercelDeploy` en cada guardado): las secciones nuevas siguen el patrón actual sin cambiarlo; sigue incumpliendo el principio 4 hasta la spec 002, que lo quita. Se declara para que lo revises.
- **Next.js 16 con cambios incompatibles**: leer `node_modules/next/dist/docs/` antes de escribir cada componente.
- **Sin corredor de pruebas de interfaz**: la verificación visual queda manual y documentada en el cierre de la spec.
- **Lista de íconos del panel actual**: el valor guardado puede no ser uno de los 11; se marca como pendiente de elegir, sin tocar el dato.

## Comprobación con la constitución
- [x] 1 Simplicidad: sin dependencias, sin tablas nuevas, módulos puros pequeños, `jsonb` para listas cortas.
- [x] 2 La spec manda: solo RF-1 a RF-12; la reparación de tipos queda en la spec 003.
- [x] 3 Aislamiento: columnas nuevas bajo las políticas por `site_id` y prueba cruzada (RF-10).
- [x] 4 Secretos: `isolation-check.mjs` lee credenciales de variables de entorno; excepción declarada del deploy hook hasta la spec 002.
- [x] 5 Lint y build como puerta: dependen de la spec 003 previa; cada tarea cierra con ambos en verde.
- [x] 6 Idioma y contrato: código en inglés, interfaz en español, límites tomados del contrato del template.

## Actualizaciones previstas
- AGENTS.md: comandos `npm run test` y `npm run contract:sync`; regla de que `contract.generated.ts` es generado y no se edita; regla de migraciones (solo con aprobación, aditivas, con reversa).
- MEMORY.md: estado (spec 001 planificada, 003 por redactar), decisión de fuente de límites por descripciones y su fragilidad, hallazgo de los 14 errores previos y del timeout de Supabase.
