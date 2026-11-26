# Plan 003 — Reparación de tipos y pantallas
> El CÓMO. Debe cumplir `docs/constitution.md` y cubrir todos los RF de `spec.md`.
> No contiene código de producción: describe los cambios que se harán en `/implement`.

## Enfoque técnico
Corregir las pantallas y un componente para que coincidan con los datos, que ya son correctos (spec 004). Los tipos de los datos (`src/types/database.ts`) no cambian. El trabajo se reparte en cuatro grupos:

1. **Pantallas que no coinciden con los datos (13 errores de tipos):** Servicios, Imágenes, Catálogo y el encabezado.
2. **Lint (5 errores):** el mismo patrón de carga en cuatro pantallas y el proveedor de tema.
3. **Imágenes (RF-6):** llamar bien al componente de subida y arreglar dos fallos propios que los tipos no ven.
4. **Mensajes (RF-7, RF-8):** que el cliente vea la causa en español en lugar de «Error al guardar».

Decisiones tomadas por mi cuenta (se revisan al aprobar):
- **Se corrigen los usos del componente de subida, no el componente.** Su forma (`bucket`, `path`, `currentUrl`, `onUpload`) es genérica y correcta; las tres llamadas son las que están mal. Cada imagen va a una ruta que empieza por el `site_id` del cliente, como exige la regla del almacenamiento (spec 004).
- **El componente de subida se hace «controlado»** (muestra siempre lo que le pasa el padre) y avisa de sus errores. Hoy guarda una copia local de la imagen al montarse, así que una imagen guardada que llega después de cargar la pantalla no se ve, y traga los errores sin decir nada. Ambos fallos rompen RF-4, RF-6 y RF-8 aunque los tipos no los detecten.
- **Lint por patrón de carga, no con supresiones.** `negocio` ya carga con `getSiteConfig(...).then(...)` y pasa el lint. Las cuatro pantallas con error comparten una función `load` que a la vez carga y guarda estado, y la regla la marca. Se separa en «pedir los datos» (que los devuelve) y «aplicarlos» (que guarda estado dentro del `.then`). Se prueba primero en una pantalla; si la regla aún protesta, se usa una supresión de una sola línea con motivo, no un permiso general.
- **Tema con `next-themes`, que ya está instalado** y ya lo usa el componente de avisos (`sonner`). Sustituye al proveedor propio (45 líneas, con el error de lint), mantiene la misma clave de almacenamiento (`theme`) y el tema claro por defecto. El icono de sol/luna se alterna por CSS para no desajustar el HTML del servidor con el del cliente. Sin dependencias nuevas.
- **Un solo ayudante de mensajes** en `src/lib/utils.ts` que traduce el error de la base a una frase en español (sin configuración, permiso, genérico) y lo usan todas las pantallas y el componente de subida.
- **Se dejan los 2 avisos** de `<img>` (no bloquean y cambiar a `next/image` exige configurar dominios): no se agregan nuevos.
- **`middleware` → `proxy` queda fuera** (acordado).
- **Antes de tocar `src/app/layout.tsx` y las pantallas, leer la guía correspondiente en `node_modules/next/dist/docs/`** (regla de AGENTS.md), porque esta versión de Next.js tiene cambios.

## Archivos a crear / modificar
| Archivo | Cambio |
|---|---|
| `src/app/admin/servicios/page.tsx` | `name` → `title`; se quita el precio (formulario, guardado y lista); patrón de carga; mensajes. |
| `src/app/admin/imagenes/page.tsx` | Llamadas a la subida con `bucket`, `path`, `currentUrl`, `onUpload` y rutas `<site_id>/logo` y `<site_id>/hero`; galería con `image_url` y `addGalleryImage(siteId, url)`; patrón de carga; mensajes. |
| `src/app/admin/catalogo/page.tsx` | Llamada a la subida con ruta `<site_id>/catalogo/<clave por producto>` (una clave nueva por producto, para que una foto no pise a otra); patrón de carga; mensajes. |
| `src/app/admin/testimonios/page.tsx` | Patrón de carga; mensajes. |
| `src/app/admin/negocio/page.tsx`, `src/app/admin/redes/page.tsx` | Solo mensajes. |
| `src/components/admin/ImageUpload.tsx` | Controlado por `currentUrl`; avisa si el archivo no es imagen y si falla la subida. Misma API de props. |
| `src/app/admin/layout.tsx` | Deja de leer `site_url` y de pasar `siteUrl`. |
| `src/components/admin/Header.tsx` | Se quita `siteUrl` y el enlace «Ver mi sitio»; el tema pasa a `next-themes`, con sol/luna por CSS. |
| `src/app/layout.tsx` | Usa el proveedor de `next-themes` (claro por defecto, sin tema del sistema, etiqueta `html` con la marca de hidratación que pide esa librería). |
| `src/components/ThemeProvider.tsx` | Se elimina. |
| `src/lib/utils.ts` | Un ayudante para traducir errores de guardado a español. |
| `specs/003-reparacion-de-tipos/tasks.md`, `MEMORY.md` | Seguimiento. |

| `src/lib/supabase/queries.ts` | Añadido durante la verificación en el navegador: `getSiteConfig` usa `maybeSingle` en vez de `single`. Con un sitio sin configuración, `single` provocaba una respuesta 406 en la consola; el caso es válido (RF-7). Se mantiene el cambio de la 004 en `upsertSiteConfig`. |

No se tocan: `src/types/database.ts`, `src/middleware.ts`, `supabase/**`, `../template-landing`, ni los datos.

## Modelo de datos / interfaces
- **Datos:** sin cambios; los cinco conjuntos y sus campos son los de la spec 004, RF-2.
- **Rutas de imágenes** (todas dentro del almacenamiento `images`, y todas empiezan por el sitio, porque las reglas de la spec 004 lo exigen):
  - logo: `<site_id>/logo`; imagen principal: `<site_id>/hero` (se reemplazan al subir otra).
  - galería: `<site_id>/gallery/<fecha>-<nombre del archivo>` (ya es así).
  - producto: `<site_id>/catalogo/<clave del producto>` (clave nueva al crear; el identificador del producto al editarlo).
- **`ImageUpload`:** mismas propiedades (`bucket`, `path`, `currentUrl`, `label`, `onUpload`); cambia solo que ya no guarda una copia local de la imagen y que muestra avisos.
- **`Header`:** pierde la propiedad `siteUrl`.
- **Ayudante de mensajes:** recibe el texto de error y devuelve una frase en español. Casos: el aviso de «sitio sin configuración» (ya lo genera `queries.ts`), violación de regla de acceso o de clave foránea (el sitio no tiene configuración) → «Tu sitio todavía no está preparado para guardar. Pedile a la agencia que cree tu configuración.»; cualquier otro → «No se pudo guardar. Intentá de nuevo.».
- **Compatibilidad hacia atrás:** no hay datos ni archivos guardados; ninguna API externa cambia.

## Mapa RF → implementación → test
Las pantallas no tienen pruebas automáticas y crearlas está fuera de alcance; la verificación es la puerta de calidad (tipos, lint, build) más la prueba de base que ya existe y un recorrido en el navegador.

| RF | Dónde se implementa | Verificación |
|---|---|---|
| RF-1 | Pantallas y componente adaptados a los datos; `database.ts` intacto | `tsc` en cero errores; `git diff` de `database.ts` vacío |
| RF-2 | Todo lo anterior + patrón de carga + tema | `npx tsc --noEmit`, `npm run lint` (0 errores) y `npm run build` sin errores |
| RF-3 | Servicios sin precio; sin `site_url` ni enlace «Ver mi sitio» | `tsc`; búsqueda de `site_url`, `siteUrl` y `price` en servicios sin resultados; en el navegador no aparecen |
| RF-4 | Cada pantalla, el componente de subida y el patrón de carga | Navegador: guardar y recargar cada sección (negocio, imágenes, servicios, catálogo, testimonios, redes) y ver lo mismo |
| RF-5 | Galería (`image_url`, `addGalleryImage`) y servicios (`title`) | Navegador: subir fotos a la galería y crear un servicio, ver que se guardan; comprobar la fila en la base con la clave de servidor |
| RF-6 | Rutas por sitio, componente controlado | Navegador: subir logo, imagen principal, foto de galería y de producto; comprobar con la clave de servidor que el archivo está en `images/<site_id>/…` y que la URL pública carga sin sesión; reemplazar y quitar |
| RF-7 | Ayudante de mensajes + pantallas | Navegador con un segundo usuario sin configuración: guardar muestra el aviso y las secciones abren sin romperse |
| RF-8 | Ayudante de mensajes + `ImageUpload` | Navegador: provocar un archivo que no es imagen y, con el usuario sin configuración, un alta de servicio: se ve la causa en español |
| RF-9 | No se toca `supabase/**` ni la interfaz de acceso | `npm run test:db` sigue en 91 de 91; `git status` sin cambios en `supabase/` |
| RF-10 | `database.ts` intacto | `git diff` de `src/types/` vacío |

**Cómo se hace el recorrido en el navegador** (con los comandos de Chrome DevTools de AGENTS.md): un script local crea con la clave de servidor dos usuarios de prueba con prefijo `zz-verif-` (uno con sitio y configuración, otro con sitio y sin configuración), arranca `npm run dev`, se entra con cada uno, se recorre cada sección guardando y recargando, con la consola sin errores, en escritorio y en 375 px. Al terminar, otro paso borra usuarios, filas y archivos de prueba. El prefijo `zz-verif-` es distinto del de la prueba de base para que ninguna de las dos limpiezas borre lo de la otra.

## Riesgos y casos límite
- **El patrón de lint puede no convencer a la regla.** Se prueba primero en una pantalla; si falla, supresión de una línea con motivo. No se reescribe la carga de datos del panel.
- **Tema:** `next-themes` cambia cómo se inyecta el tema y puede dar un parpadeo o un aviso de hidratación. Se comprueba en el navegador (consola sin errores) y se mantiene claro por defecto, igual que hoy.
- **Imagen del producto:** si la ruta fuera fija, la foto de un producto pisaría la de otro (la subida reemplaza). Por eso la clave es por producto.
- **Componente controlado:** al quitar la copia local, la vista previa depende de que la pantalla actualice `currentUrl` al subir; se verifica en las tres pantallas.
- **Usuario sin sitio asignado o sin configuración:** las pantallas abren, pero no pueden guardar; los avisos lo explican. Crear la configuración es de la spec 005.
- **Lo que no se ve en tipos ni en lint:** formularios que guarden bien pero muestren mal, o rutas de imagen incorrectas. Solo el recorrido en el navegador lo atrapa.
- **La verificación escribe en la base real** (usuarios, filas y archivos `zz-verif-…`) y los borra al terminar; con clientes reales conviene una base de pruebas aparte.
- **El build avisa de `middleware` obsoleto.** Es un aviso, no un error; se deja.
- **Cortes de red** en la prueba de base (`ECONNRESET`): repetir antes de sospechar de las reglas.

## Comprobación con la constitución
- [x] 1. Simplicidad: se reutilizan el componente de subida y `next-themes` ya instalados, se elimina un proveedor propio, no hay dependencias nuevas ni capas nuevas; el único código nuevo es un ayudante de mensajes.
- [x] 2. La spec manda: cada cambio cuelga de un RF; lo que no está (alta, `proxy`, `next/image`, tests de pantallas) queda fuera y se nombra.
- [x] 3. Aislamiento entre clientes: no se tocan reglas ni datos; las rutas de imagen empiezan por el sitio del cliente, como exige el servidor; `npm run test:db` lo sigue demostrando.
- [x] 4. Secretos fuera del cliente: el navegador sigue usando solo la clave pública; la clave de servidor solo se usa en los scripts locales de verificación, fuera de git.
- [x] 5. Lint y build como puerta: es el objetivo de la spec (RF-2); no se da por hecha ninguna tarea con lint o build en rojo.
- [x] 6. Idioma y contrato: código en inglés, interfaz y mensajes en español; no cambia la forma de los datos que se mapea al contrato 2.3.

## Actualizaciones previstas
- AGENTS.md: ya no son ciertos «Tests: no existen aún» ni la nota «Pendiente de revisar: `admin/layout.tsx` usa `site_url`»; además las reglas de la spec 004 (claims `site_id` y `role`, bucket `images` con ruta `<site_id>/…`, `npm run test:db`). Propuesto, no aplicado sin tu OK.
- MEMORY.md: estado de la 003 y qué quedó verificado en el navegador.

## Orden de ejecución propuesto (para `/tasks`)
1. Leer las guías de Next.js que apliquen y probar el patrón de carga en una pantalla (servicios), junto con su arreglo de `title` y precio.
2. Replicar el patrón en testimonios, catálogo e imágenes.
3. Arreglar el componente de subida y sus tres usos; después galería de imágenes y catálogo.
4. Quitar `site_url` y el enlace; pasar el tema a `next-themes`.
5. Ayudante de mensajes y uso en las pantallas.
6. Tipos, lint y build en verde; `npm run test:db`.
7. Recorrido en el navegador con los usuarios de prueba; limpieza; MEMORY.md.
