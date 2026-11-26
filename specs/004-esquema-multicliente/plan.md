# Plan 004 — Esquema multicliente (endurecimiento)
> El CÓMO. Debe cumplir `docs/constitution.md` y cubrir todos los RF de `spec.md`.
> No contiene código de producción: describe la migración y las pruebas que se escribirán en `/implement`.
> Revisado el 2026-11-23: la versión anterior recreaba el esquema desde cero sobre una base equivocada. PylarLabs ya tiene las cinco tablas; este plan solo cierra lo que falta.

## Enfoque técnico
Una única migración SQL **incremental e idempotente**, en una transacción, que no borra ni recrea tablas ni columnas, y la prueba de aislamiento que ya existe (`npm run test:db`) como puerta. El panel no cambia en esta spec.

Estado real de PylarLabs (lectura del 2026-11-23) y qué hace la migración con cada cosa:
| Hoy | Problema | La migración |
|---|---|---|
| Cinco tablas con los campos de RF-2, PK, `site_id` único en `site_config`, FK en cascada, RLS activa | Nada: ya cumple RF-1, RF-2, RF-3 | No las toca |
| Una política `ALL` por tabla, para el rol `public`, que compara `site_id` con el del token | No hay admin; el cliente crea y borra su configuración (RF-8, RF-9); apunta a `public` y no a `authenticated` | Reemplaza esas cinco políticas por las nuevas |
| `anon` y `authenticated` con todos los permisos, incluido `TRUNCATE` | La RLS no frena `TRUNCATE`, `REFERENCES` ni `TRIGGER` (RF-16) | Revoca todo y da solo select, insert, update y delete a `authenticated` |
| Bucket público `images`; subir y borrar abiertos a cualquier autenticado; lectura abierta a todos; sin permiso de actualizar | Sin aislamiento por sitio; un anónimo lista; no se puede reemplazar (RF-13) | Reemplaza sus tres políticas por cuatro que exigen la carpeta del sitio |
| Sin índices por `site_id` en las hijas | Las reglas filtran por `site_id` (RNF de rendimiento) | Crea los cuatro índices si no existen |

Decisiones tomadas por mi cuenta (se revisan al aprobar):
1. **Reemplazar las políticas, no sumar.** Las políticas permisivas se suman: dejar la `ALL` actual mantendría abierta la creación y el borrado de la configuración. La migración quita las cinco antiguas por nombre y crea las nuevas.
2. **Identidad desde el token, no desde la tabla.** El sitio sale de `app_metadata.site_id` (como hoy) y el rol de admin de `app_metadata.role = 'admin'`. `app_metadata` solo lo escribe la clave privada del servidor; `user_metadata` nunca se usa (AGENTS.md).
3. **Reglas inline, sin funciones auxiliares.** Cinco tablas con una condición corta se repiten; no se crean funciones ni superficie extra en la API (principio 1).
4. **Idempotente.** Cada `create` va precedido de su `drop … if exists` o lleva `if not exists`; revocar y conceder se pueden repetir. Aplicarla dos veces deja el mismo estado.
5. **Aplicación por el conector de Supabase, solo tras tu aprobación explícita.** El conector ya ve PylarLabs. El archivo queda en el repo y revisado antes (tarea T15).
6. **Sin código nuevo en el panel ni dependencias nuevas.** La prueba usa el ejecutor de Node y `@supabase/supabase-js`, ya instalado.
7. **No se capturan en el repo las tablas actuales** (ver duda abierta de la spec; recomendación: otra spec si hace falta).

## Archivos a crear / modificar
| Archivo | Cambio |
|---|---|
| `supabase/migrations/<fecha>_endurecer_esquema_multicliente.sql` | Nuevo. Una transacción: políticas de las cinco tablas, permisos, índices y políticas del bucket `images`. Sustituye al archivo anterior `20261123000000_esquema_multicliente.sql` (obsoleto, marcado «NO APLICAR»), que se elimina en T15 con tu OK. |
| `scripts/tests/aislamiento.test.mjs` | Ya escrito. Cambios: la guarda de RF-15 deja de nombrar tablas de la landing y comprueba que solo existen las cinco tablas del panel; el bucket es `images` (hecho). |
| `AGENTS.md` | Reglas de dominio nuevas (ver «Actualizaciones previstas»). Propuesto, no aplicado sin tu OK. |
| `MEMORY.md` | Estado de la 004. |

| `src/lib/supabase/queries.ts` | Añadido tras la revisión del 2026-11-23: `upsertSiteConfig` pasa de `upsert` a `update` + comprobar que se actualizó una fila. Con las reglas nuevas un `upsert` falla para el cliente aunque la fila exista (Postgres comprueba antes la regla de alta, que es solo del admin). Es el único cambio en `src/`. |

No se tocan: el resto de `src/**`, `../template-landing`, ni los datos (no hay).

## Modelo de datos / interfaces

**Claims que usa el servidor** (contrato para las specs 003 y 005):
| Claim en `app_metadata` | Significado |
|---|---|
| `site_id` (texto) | Sitio del usuario. Lo genera y asigna el alta (spec 005). |
| `role = 'admin'` | Admin de la agencia. Sin `site_id` propio. |

**Tablas:** sin cambios (columnas de RF-2 tal cual están hoy). La única adición de estructura son cuatro índices por `site_id` en `gallery`, `services`, `products` y `testimonials`.

**Reglas de acceso (RLS ya activa en las cinco)**
- Rol anónimo: sin permisos ni políticas → no lee ni escribe nada (RF-6, RF-16).
- Rol autenticado, tablas hijas: una política para lectura, alta, cambio y borrado. «Su sitio» = `site_id` de la fila igual al del token, o admin. La condición se exige también sobre la fila nueva en altas y cambios, lo que impide guardar a nombre de otro sitio o mover una fila (RF-7).
- `site_config`: leer y actualizar → su sitio o admin (RF-14: el enlace de despliegue lo lee solo su sitio). Crear y borrar → solo admin (RF-8, RF-9).
- Usuario sin `site_id` y sin ser admin: la comparación da nulo y deniega (RF-5).

**Permisos de rol:** `anon` sin ninguno; `authenticated` solo select, insert, update y delete (RF-16). `service_role` no cambia.

**Almacenamiento** (bucket `images`, público, ya existe y es el que usa el panel)
- Convención de ruta: `<site_id>/…`.
- Subir, reemplazar, leer (listar) y borrar por la API → solo si el primer segmento de la ruta es su `site_id`, o admin (RF-13). El reemplazo necesita permiso de actualizar, que hoy no existe, y de leer.
- Se elimina la lectura pública del listado; las imágenes se siguen viendo por su URL pública porque el bucket es público. Se verifica en la prueba.
- Un archivo en la raíz (sin carpeta) solo lo alcanza el admin.

**Compatibilidad hacia atrás:** no hay datos ni archivos. El panel actual sube a `images` con ruta `<site_id>/…`, que es la convención elegida, así que sigue funcionando. Salvedad: hoy el panel crea la configuración con «guardar por primera vez»; tras endurecer, un cliente sin configuración no podrá crearla (RF-8/9) hasta que la spec 005 la cree al dar de alta.

## Mapa RF → implementación → test
| RF | Dónde se implementa | Test que lo verifica | Estado hoy |
|---|---|---|---|
| RF-1 | Ya existe | Insertar fila sin `site_id` falla en las cinco | Verde |
| RF-2 | Ya existe | Descripción de la API = lista de RF-2, sin columnas de más | Verde |
| RF-3 | Ya existe | Segunda configuración y hijo sin configuración rechazados | Verde |
| RF-4 | Políticas nuevas de las cinco | A/B: no leen, crean, cambian ni borran lo ajeno; admin alcanza todo | Cliente verde; admin rojo |
| RF-5 | Condición del token | Usuario sin sitio ni rol: nada; sitio sin configuración: nada ajeno | Verde |
| RF-6 | Sin permisos para anónimo + sin políticas | Sin sesión no se lee ni escribe; no se obtiene el enlace de despliegue | Verde |
| RF-7 | Condición sobre la fila nueva | A no crea ni mueve filas hacia B | Verde |
| RF-8 | Políticas de `site_config` y de las hijas | A gestiona lo suyo; A no crea ni borra su configuración | Rojo (2) |
| RF-9 | Alta y borrado de `site_config` solo admin | El admin sí crea la configuración | Rojo |
| RF-11 | Migración incremental e idempotente | Revisión del archivo + aprobación; segunda aplicación sin cambios; columnas y tablas idénticas a la línea base | Pendiente |
| RF-12 | `scripts/tests/aislamiento.test.mjs` | Es la propia prueba; incluye autoasignarse `role: admin` en el perfil editable | Rojo (1) |
| RF-13 | Políticas del bucket `images` | A sube, reemplaza y borra en `A/…` y no en `B/…`; anónimo no sube ni lista; admin sí; la URL pública se ve sin sesión | Rojo (6) |
| RF-14 | Política de lectura de `site_config` | B no lee el enlace de A; A sí lee el suyo | Verde |
| RF-15 | La migración no crea ni altera tablas | Solo existen las cinco tablas del panel (guarda por la API) | Reformular |
| RF-16 | Revoke y grant | Consulta de solo lectura de permisos por rol (no se ve por la API) | Pendiente |

## Riesgos y casos límite
- **Usuario existente sin configuración.** Hay uno con sitio y sin fila en ninguna tabla. Tras endurecer no podrá crearla; la crea la agencia a mano con tu aprobación, o se elimina (duda abierta de la spec). Hasta la spec 005 el «guardar por primera vez» del panel falla para cualquier cliente sin configuración.
- **Pérdida de acceso por error de reglas.** Si una política queda mal, el panel no guarda. Mitigación: transacción única, prueba antes y después, y volver atrás es reaplicar las políticas anteriores (están en la lectura del 2026-11-23, que se guarda como línea base en T2).
- **Admin por token.** Quitar el rol a una cuenta no surte efecto hasta que su token se renueve (por defecto, hasta una hora). Se documenta, no se resuelve aquí.
- **Cuenta admin = cuenta más poderosa.** Alcanza todos los sitios e imágenes. Mitigación: pocas cuentas, designadas fuera del panel (spec 005), y la prueba demuestra que un cliente no puede autoasignarse el rol.
- **Las políticas se suman.** Una política vieja olvidada abriría el acceso. Mitigación: la migración elimina las anteriores por nombre y T17 comprueba la lista final.
- **`TRUNCATE` y otros permisos retirados.** Solo se quita lo que la API REST no usa; el panel no depende de ello. `service_role` y el propietario no cambian.
- **Reemplazo de imágenes** necesita leer y actualizar; si falta alguno, la subida con reemplazo falla. Cubierto por la prueba de RF-13.
- **La prueba corre sobre la base real.** Crea y borra usuarios, filas y archivos con prefijo `test-`; la limpieza está verificada. Con clientes reales conviene una base de pruebas aparte; seguimiento.
- **Concurrencia** de dos usuarios sobre la misma fila: gana el último guardado; el modelo no lleva versión. Aceptado, igual que hoy.
- **Contradicción que descartamos:** el panel y la base no discrepan en el nombre del bucket (`images`); esa discrepancia que se anotó antes se debía a haber leído la base de la landing.

## Comprobación con la constitución
- [x] 1. Simplicidad: una migración incremental, sin funciones auxiliares, sin tablas ni columnas nuevas, sin dependencias nuevas.
- [x] 2. La spec manda: todo cuelga de un RF; lo que no está (alta, panel, definición de la base) queda fuera y se nombra.
- [x] 3. Aislamiento entre clientes: lo garantizan las reglas del servidor (RLS) y las del almacenamiento, no la interfaz, y la prueba lo demuestra.
- [x] 4. Secretos fuera del cliente: la clave privada solo se usa en la prueba local y fuera de git; `site_id` y rol salen de `app_metadata`, no de `user_metadata`.
- [x] 5. Lint y build como puerta: no se toca `src/**`; el resultado de `npm run lint` y de la comprobación de tipos debe ser igual que hoy (el build ya falla por la spec 003) y se informa tal cual.
- [x] 6. Idioma y contrato: nombres en inglés; documentación en español; los campos son los del modelo del panel, mapeables al contrato 2.3.

## Actualizaciones previstas
- AGENTS.md: reglas de dominio (`app_metadata.site_id` y `app_metadata.role = 'admin'`; bucket `images` con ruta `<site_id>/…`; cada tabla del panel con `site_id` y RLS; el cliente no crea ni borra `site_config`). Se propone, no se aplica sin tu OK.
- MEMORY.md: estado de la 004 y la lección de verificar a qué proyecto de Supabase apunta `.env.local` antes de leer el esquema.

## Orden de ejecución propuesto (para `/tasks`)
1. Guardar la línea base de PylarLabs y dejar la prueba lista (RF-15 reformulada); ejecutarla y comprobar que los rojos son los esperados.
2. Escribir la migración y revisarla contigo; aprobación explícita.
3. Aplicarla por el conector; verificar por lectura; la prueba en verde dos veces.
4. Comparar con la línea base, lint y tipos; verificación final; MEMORY.md.
