# Plan 002 — Publicar los datos del sitio
> El CÓMO. Debe cumplir `docs/constitution.md` y cubrir todos los RF de `spec.md`.

## Prerrequisitos y decisiones (tomadas con el usuario el 2026-11-24)
- **Spec 001 hecha** (campos del contrato, `contract:sync`, `slug`, columnas nuevas, `test:db` 122/122): lo que se publica ya se puede cargar entero.
- **Entrega:** el servidor del panel hace un commit de `src/content/site.data.json` al repositorio de la web del cliente; el push dispara el build de Vercel y el `prebuild` del template vuelve a validar. El template no cambia (RF-14).
- **Confirmación (RF-10):** el servidor consulta la API de Vercel; solo marca «publicado» si el despliegue de esa publicación terminó en `READY`.
- **Validador:** un script generado trae del template `site.schema.ts` y sus tres dependencias a `src/lib/contract/vendor/` (con la versión). Cero reglas a mano.
- **Secretos por sitio:** tabla nueva solo de servidor (`site_deploy`); el enlace de despliegue sale de `site_config`.
- **Lo que el template hace hoy (leído):** lee `src/content/site.data.json` del repositorio; `scripts/prebuild.mjs` ejecuta `validateSite(data)` antes de `astro build` y corta si falla; `SCHEMA_VERSION = "2.3"`; `validateSite` devuelve `{ok, schemaVersion, errors[{path, code, message, expected?}]}`.

## Enfoque técnico
1. **Una sola fuente del validador, generada.** `scripts/sync-contract.mjs` (el de la 001) se amplía: además de límites, copia `site.schema.ts`, `ui-text.ts`, `price-format.ts` y `icons.ts` a `src/lib/contract/vendor/` cambiando una sola cosa, el import `astro/zod` → `zod/v4`, y marcándolos «generado, no editar». El test de frescura compara con una regeneración en vivo y con la versión del template local. **Dependencia nueva: `zod`** (hoy solo llega como transitiva de herramientas, v4.4.3; el template usa 4.6.7): se fija la misma versión exacta que el template para que los mensajes coincidan. Necesita tu aprobación (AGENTS.md).
2. **Armado de datos puro.** `buildSiteData(rows)` convierte lo guardado (las cinco tablas) al formato del contrato: excluye inactivos, ordena por `order` con desempate estable (`order`, luego `id`), mapea nombres (`business_name`→`name`, `hero_title`→`hero.headline`, `about_*`→`about`, `hero_cta_*`→`hero.ctaPrimary/Secondary`, `show_prices/currency/group_by_category/product_cta_label`→`productGridConfig`, `section_titles`→`sections`, `slug`→`id`, `image_url`→`image`, `author_name`→`name`, `instagram/facebook`→`social`), omite lo que el contrato no admite (horarios, mapa, galería, logo, imagen del hero, `price_visible`, `whatsapp_message`) y devuelve además un mapa «elemento del archivo → fila de origen». No corrige nada (RF-3). **Decisión a revisar:** `null` y `''` en un campo se tratan como ausentes (el panel guarda `''` en campos que el cliente nunca tocó); un texto de solo espacios sí se envía y el validador lo rechaza (`empty`).
3. **Errores ligados al panel.** `locateErrors(report, sourceMap)` traduce cada error (`products[2].price`) a `{sección del panel, campo, nombre del elemento}` usando el mapa; los errores entre campos (`missing_contact_method`, `unknown_anchor`, `duplicate_id`, `inconsistent_category`, `too_many_categories`) se ligan a todos los campos implicados con una tabla por código. Tabla de mensajes de los códigos en español: los textos ya vienen en español del template; el panel solo añade la ubicación.
4. **Flujo de publicación en el servidor.** `publishSite` (lógica pura con dependencias inyectadas: base, GitHub, Vercel) y una acción de servidor delgada que la llama:
   - `requireSiteUser()` (nuevo, junto a `requireAdmin`): toma `site_id` solo de `app_metadata` de la sesión; nunca de un parámetro (RF-13).
   - **Bloqueo atómico** con un único `update … where site_id=… and (status<>'publishing' or locked_at < now() - interval '10 minutes') returning *`; si no devuelve fila, otra publicación está en curso (RF-7).
   - Lee lo último guardado con el cliente del usuario (RLS) y arma → valida (RF-1, RF-8). Con errores: libera el bloqueo y devuelve la lista completa, sin tocar nada publicado (RF-2).
   - **Versión del contrato (RF-6):** lee `src/content/site.schema.ts` del repositorio de ESA web por la API de GitHub, extrae `SCHEMA_VERSION` y la compara con la del validador del panel; si difieren bloquea indicando ambas.
   - **Etapa 1:** guarda `published_data` (+ versión y hora) en `site_deploy`; si falla, nada cambió (RF-9). **Etapa 2:** commit del archivo a GitHub; si el contenido es idéntico al de la rama (publicar dos veces lo mismo, RF-8), no hay commit y se usa el enlace de despliegue de `site_deploy`. Estado `saved`.
   - **Confirmación (RF-10):** al consultar el estado, si está en `saved`, el servidor pregunta a Vercel por el despliegue de producción creado desde el inicio de esta publicación (y, si hubo commit, con ese commit): `READY` → `published`; `ERROR`/`CANCELED` o más de 10 minutos → `deploy_failed` («datos guardados, la web aún no se actualizó», con reintento). El reintento reutiliza `published_data` y no vuelve a validar (RF-9).
5. **Estado compartido (RF-7).** `site_deploy.status` (`idle | publishing | saved | published | deploy_failed`) lo leen todos los usuarios del sitio por una acción que devuelve solo estado, hora y mensaje (nunca el enlace, el repositorio ni tokens). La pantalla consulta cada ~5 s mientras haya algo en curso; la confirmación con Vercel se limita a una consulta cada 5 s por sitio.
6. **Problemas por sección (RF-12).** Cada pantalla del panel llama a una acción de servidor `getSectionIssues(section)` que arma y valida lo ya guardado y filtra por sección; muestra un aviso con los problemas. La lista completa solo se da al publicar.
7. **Interfaz:** página nueva `/admin/publicar` (enlace en la barra lateral) con el botón, el estado, la lista de errores con enlace a la sección y el reintento. **Los guardados dejan de disparar despliegues:** se quita `triggerVercelDeploy` de las seis pantallas y de `utils.ts` (RF-11). Es un cambio de comportamiento para los clientes: guardar ya no actualiza la web, publicar sí.
8. **Credenciales:** `GITHUB_TOKEN` (permiso de contenido solo sobre los repositorios de los clientes) y `VERCEL_TOKEN` solo como variables de entorno del servidor; cada sitio guarda en `site_deploy` su repositorio, rama, proyecto de Vercel y enlace. Un script local (`scripts/set-site-deploy.mjs`, como `set-admin.mjs`) carga esos datos; el alta de clientes no se toca (fuera de alcance).

Alternativas descartadas: que el template baje los datos por URL (cambia el template); webhook de Vercel al panel (endpoint público firmado, más piezas); dependencia npm hacia el template (dependencia nueva que obliga a tocar el template); ejecutar `validate-site.mjs` como proceso (exige el template en el servidor del panel); variables de entorno por sitio (no escala a altas nuevas); guardar el enlace en `site_config` con una columna oculta (el cliente la puede leer: RLS no es por columna).

## Archivos a crear / modificar
| Archivo | Cambio |
|---|---|
| `scripts/sync-contract.mjs`, `scripts/tests/contract-sync.test.mjs` | Ampliar: copiar el validador del template a `vendor/`, versión, frescura. |
| `src/lib/contract/vendor/*` | Nuevos, generados (`site.schema.ts`, `ui-text.ts`, `price-format.ts`, `icons.ts`). No se editan. |
| `src/lib/publish/build-site-data.ts` | Nuevo, puro. Filas → datos del contrato + mapa de origen. |
| `src/lib/publish/locate-errors.ts` | Nuevo, puro. Error del contrato → sección y campo del panel. |
| `src/lib/publish/publish.ts` | Nuevo, lógica del flujo con dependencias inyectadas. |
| `src/lib/publish/github.ts`, `vercel.ts` | Nuevos, `server-only`: commit del archivo, lectura de la versión del repositorio, consulta de despliegues. |
| `src/lib/supabase/require-site-user.ts` | Nuevo: sesión → `site_id` de `app_metadata`. |
| `src/app/admin/publicar/page.tsx`, `actions.ts` | Nuevos: pantalla y acciones (`publish`, `retry`, `getStatus`, `getSectionIssues`). |
| `src/components/admin/SectionIssues.tsx` | Nuevo: aviso de problemas por sección. |
| `src/components/admin/Sidebar.tsx` | Enlace «Publicar». |
| `src/app/admin/{negocio,servicios,catalogo,testimonios,imagenes,redes}/page.tsx` | Quitar `triggerVercelDeploy` y `vercel_deploy_hook`; mostrar `SectionIssues`. |
| `src/lib/utils.ts`, `src/types/database.ts` | Quitar `triggerVercelDeploy` y el campo `vercel_deploy_hook`. |
| `supabase/migrations/*_site_deploy.sql` y `*_quitar_hook_de_site_config.sql` | Nuevas (ver «Modelo de datos»). |
| `scripts/set-site-deploy.mjs` | Nuevo, local: carga repositorio, rama, proyecto y enlace de un sitio. |
| `scripts/tests/*.test.mjs` | Pruebas nuevas (ver mapa) y ajuste de `aislamiento.test.mjs`. |
| `package.json` | Dependencia `zod` (versión exacta del template); scripts `test` ampliado. |
| `.env.local` (no se sube) y `AGENTS.md`, `MEMORY.md` | Variables `GITHUB_TOKEN`, `VERCEL_TOKEN`; ver «Actualizaciones previstas». |

## Modelo de datos / interfaces
**Tabla nueva `site_deploy`** (una fila por sitio): `site_id` (clave primaria, referencia a `site_config(site_id)`, borrado en cascada), `deploy_hook`, `github_repo` (`owner/nombre`), `github_branch` (por defecto `main`), `vercel_project_id`, `status` (`idle|publishing|saved|published|deploy_failed`, por defecto `idle`), `locked_at`, `started_at`, `published_data` (`jsonb`), `published_schema_version`, `published_at`, `published_by` (uuid), `last_commit_sha`, `last_message`, `updated_at`. **RLS activada, sin políticas, y `revoke all` a `anon` y `authenticated`**: el navegador no puede leerla ni escribirla; solo la clave de servidor (RF-11, RF-13). Toda tabla nueva lleva RLS (AGENTS.md).
**Migración en dos pasos, cada una con tu aprobación explícita:** (A) crear `site_deploy` y copiar el `vercel_deploy_hook` existente (hoy 0 filas de clientes reales); (B) borrar `site_config.vercel_deploy_hook` una vez verificado. B **no es reversible sin perder el dato**: reversa documentada y paso aparte.
**Archivo producido:** exactamente `SiteData` del contrato 2.3. **Compatibilidad:** `published_data` no sustituye a las tablas editables; el panel sigue guardando como hoy. `contract.generated.ts` (límites de la 001) se conserva para los contadores de pantalla.
**Interfaz de las acciones:** `publish()` → `{status:'errors', errors[{section, field, item, message, code}]} | {status:'saved'|'busy'|'version_mismatch', …}`; `getStatus()` → `{status, message, publishedAt}`. Ninguna devuelve credenciales.

## Mapa RF → implementación → test
| RF | Dónde se implementa | Test que lo verifica |
|---|---|---|
| RF-1 | `publish.ts` (arma, valida, guarda solo si es válido) | `publish-flow.test.mjs` con dependencias falsas: válido guarda y confirma; inválido no guarda |
| RF-2 | `publish.ts` + `locate-errors.ts` | `locate-errors.test.mjs` (todos los errores a la vez, sección y campo, reglas entre campos ligadas a todos los implicados); cobertura: un caso inválido por cada código de `ERROR_CODES` |
| RF-3 | `build-site-data.ts` | `build-site-data.test.mjs`: un dato inválido llega igual al validador (no se recorta ni completa) |
| RF-4 | `build-site-data.ts` | `build-site-data.test.mjs`: inactivos fuera, orden con repetidos y ausentes, campos no admitidos fuera |
| RF-5 | `vendor/*` + `sync-contract.mjs` | `contract-sync.test.mjs`: copia al día, versión declarada; el archivo producido lo acepta `../template-landing/scripts/validate-site.mjs` |
| RF-6 | `publish.ts` + `github.ts` (versión del repo web) | `publish-flow.test.mjs`: versión distinta bloquea con ambas versiones en el mensaje |
| RF-7 | bloqueo atómico + `getStatus` + `/admin/publicar` | `aislamiento.test.mjs` (bloqueo en la base real: dos intentos, solo uno entra; libera a los 10 min con la hora ajustada); manual en Chrome con dos sesiones |
| RF-8 | `publish.ts` lee de la base, no de pantalla; sin commit si es idéntico | `publish-flow.test.mjs`: lo guardado a mitad de otra publicación no se mezcla; publicar dos veces lo mismo es válido |
| RF-9 | estados `saved`/`deploy_failed`, `retry` sin revalidar | `publish-flow.test.mjs`: falla el commit o el build → «datos guardados, la web aún no se actualizó», reintento sin validar; falla el guardado → nada cambió |
| RF-10 | `vercel.ts` + `getStatus` | `publish-flow.test.mjs`: `READY` → publicado; `ERROR` o 10 min → `deploy_failed`; sin despliegue → sigue `saved` |
| RF-11 | `site_deploy` solo servidor; acciones sin credenciales en la respuesta | `no-secrets-client.test.mjs` (estático: ningún archivo `'use client'` ni `NEXT_PUBLIC_*` toca el enlace ni los tokens; la respuesta de las acciones no los incluye); `aislamiento.test.mjs`: el cliente no lee `site_deploy` |
| RF-12 | `getSectionIssues` + `SectionIssues` | `locate-errors.test.mjs` (filtro por sección); manual en Chrome en cada pantalla |
| RF-13 | `requireSiteUser` (sin parámetro de sitio) + RLS | `aislamiento.test.mjs`: A y B sin acceso a `site_deploy`; prueba de que la acción usa el sitio de la sesión aunque se pida otro |
| RF-14 | commit al repositorio de la web, ningún cambio de código del template | `git status` de `../template-landing` limpio; revisión del diff |

## Riesgos y casos límite
- **Dependencia `zod` y distinta versión** (4.4.3 transitiva frente a 4.6.7 del template): se fija exacta la del template; el test de frescura falla si divergen. Sin la aprobación de la dependencia no se puede avanzar.
- **El validador copiado** importa con extensiones `.ts` y tipos; el generador ajusta solo `astro/zod`. Si `tsc`/Next rechazan las extensiones, se reescriben en el generador (T1 lo comprueba antes de seguir).
- **Token de GitHub con acceso a todos los repositorios de clientes:** si se filtra, expone todas las webs. Permisos mínimos (contenido, solo esos repositorios), solo servidor, rotación; una App de GitHub por sitio queda como mejora futura, no se hace.
- **Commit simultáneo o archivo cambiado entre lectura y escritura:** la API pide el `sha` previo; ante 409 se relee y reintenta una vez; si persiste, `deploy_failed` con reintento.
- **Mismos datos:** no hay commit; se usa el enlace de despliegue. Sin enlace cargado, la publicación termina en `deploy_failed` con mensaje claro (la agencia debe cargarlo con `set-site-deploy.mjs`).
- **Confirmación con Vercel:** elegir «el despliegue de producción creado desde el inicio de esta publicación» puede confundirse con un despliegue ajeno que ocurre a la vez; con commit se exige además el mismo commit. Se documenta como límite.
- **Build fallido por causa ajena al contrato** (RF-9): se informa como «la web no se actualizó», sin culpar al cliente, con reintento.
- **Sesión vencida a mitad de la publicación:** el bloqueo se libera solo a los 10 minutos; la pantalla pide volver a ingresar.
- **Cambio de comportamiento:** guardar ya no despliega. Los clientes actuales deben saber que ahora hay que publicar (aviso en la pantalla y en el cierre de la spec).
- **Migración B irreversible:** separada, con tu aprobación y tras comprobar que nada lee `site_config.vercel_deploy_hook`.
- **La brecha de la 001** (rol, destacados y categoría de una sola línea no avisaban de saltos de línea en pantalla) queda cubierta aquí: el validador real devuelve `line_break` al publicar.
- **Sin corredor de pruebas de interfaz:** la pantalla se verifica a mano en Chrome (escritorio y 375 px).
- **Next.js 16 con cambios incompatibles:** leer `node_modules/next/dist/docs/` (acciones de servidor, `server-only`) antes de escribir la acción.
- **Servidor del panel sin desplegar o sin variables:** la publicación falla con un mensaje explícito si faltan `GITHUB_TOKEN` o `VERCEL_TOKEN`, sin dejar el bloqueo tomado.

## Comprobación con la constitución
- [x] 1 Simplicidad: una dependencia (`zod`), una tabla, módulos puros pequeños, sin servicios nuevos ni webhooks; el validador no se reescribe.
- [x] 2 La spec manda: solo RF-1 a RF-14; el script `set-site-deploy.mjs` es el mínimo para que los datos por sitio existan (el alta de clientes, fuera de alcance, no se toca). Se declara por si prefieres sacarlo.
- [x] 3 Aislamiento: `site_id` solo de `app_metadata`; lectura con el cliente del usuario (RLS); `site_deploy` sin acceso de cliente; prueba cruzada (RF-13).
- [x] 4 Secretos: `GITHUB_TOKEN`, `VERCEL_TOKEN` y el enlace solo en servidor; se corrige la excepción de la 001 (el enlace salía al navegador); prueba estática contra fugas.
- [x] 5 Lint y build como puerta: cada tarea cierra con `tsc`, lint y build en verde; `npm run test` y `test:db` completos.
- [x] 6 Idioma y contrato: código en inglés, interfaz y errores en español; el archivo producido valida con el validador del propio template.

## Actualizaciones previstas
- AGENTS.md (a proponerte, sin cambiar sin tu OK): comandos `npm run contract:sync` y `npm run test`; `contract.generated.ts` y `vendor/` no se editan; la regla de las acciones de servidor pasa a «`requireAdmin()` o `requireSiteUser()`» según quién la llama; variables `GITHUB_TOKEN` y `VERCEL_TOKEN` solo en servidor; migraciones solo con aprobación, aditivas y con reversa.
- MEMORY.md: estado de la 002, decisiones (entrega por commit, confirmación por Vercel, validador copiado, `site_deploy`), que guardar ya no despliega, y los pendientes (cargar repositorio/proyecto/enlace por sitio, rotación de tokens).
