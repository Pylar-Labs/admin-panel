# Plan 005 — Alta de clientes y administración desde el panel
> El CÓMO. Debe cumplir `docs/constitution.md` y cubrir todos los RF de `spec.md`.
> No contiene código de producción: describe los cambios que se harán en `/implement`.

## Enfoque técnico
Tres piezas, de la más sensible a la más visible:

1. **Alta de clientes en el servidor.** Una acción de servidor (solo admin) que, con la clave de servidor, crea la configuración del sitio, invita al usuario por email y le asigna su sitio, deshaciendo todo si algún paso falla. La lógica vive en un módulo propio, sin dependencias del panel, que recibe el cliente de administración como parámetro: así se puede probar desde Node contra la base real, con fallos inyectados.
2. **Lista de clientes.** Otra acción de servidor (solo admin) que une las configuraciones con sus usuarios para mostrar nombre, email y estado.
3. **Modo admin en el panel.** El admin elige un cliente y las secciones que ya existen trabajan sobre ese sitio. La autoridad no está en la interfaz: la base ya permite al admin alcanzar cualquier sitio (spec 004) y a nadie más.

Además hace falta una página pública para que el cliente invitado ponga su contraseña, y un script local para designar al primer admin (fuera del panel, como pide RF-1).

Decisiones tomadas por mi cuenta (se revisan al aprobar):
1. **Comprobar el rol en cada acción, en el servidor.** Las guías de Next.js lo exigen: una acción de servidor se puede llamar con una petición directa y la comprobación de la página no se hereda. Se usa `getUser()` (valida el token con Supabase) y se lee `app_metadata.role`, nunca `user_metadata`.
2. **Orden del alta, pensado para no enviar un correo inútil:** (1) validar y comprobar duplicados; (2) crear la configuración; (3) invitar por email; (4) asignar el sitio al usuario en `app_metadata`. Si falla (3) o (4) se borra lo creado. El correo solo sale en (3), cuando la configuración ya existe.
3. **El sitio del usuario se asigna después de invitar**, con una segunda llamada, porque la invitación solo permite datos en `user_metadata` (que el usuario puede editar) y el sitio debe ir en `app_metadata`.
4. **Identificador del sitio generado en el servidor** (un UUID aleatorio), nunca tomado de lo que escribe el admin: va en rutas de almacenamiento y en el token.
5. **Email duplicado:** se busca recorriendo los usuarios (hay pocos clientes) y, ante una carrera entre dos altas, el rechazo de la invitación lo vuelve a detectar y se deshace. Límite conocido: el recorrido deja de ser razonable con miles de usuarios.
6. **Nombre duplicado (RF-16):** se compara en memoria el nombre normalizado (sin espacios sobrantes y sin distinguir mayúsculas) con los de todas las configuraciones; la confirmación la exige el servidor (un indicador en la petición), no solo la pantalla.
7. **Estado de la lista:** «invitación pendiente» si el usuario nunca inició sesión; «activo» si ya lo hizo. Un cliente que abre el enlace pero no llega a poner contraseña ya cuenta como «activo»; es un límite aceptado.
8. **El cliente elegido por el admin se guarda en la pestaña** (almacenamiento de sesión del navegador) y se lee con `useSyncExternalStore`, que evita el error de lint de estado en efectos. Dos pestañas pueden editar clientes distintos sin pisarse. Es solo comodidad de interfaz: cambiarlo a mano no da acceso a nada.
9. **Las pantallas existentes no se reescriben.** Leen el sitio de `useUser().siteId`; para el admin ese valor pasa a ser el cliente elegido. El diseño general bloquea las secciones si el admin no ha elegido a nadie (RF-12), lo que además impide subir imágenes a una carpeta `null`.
10. **Primer admin con un script local** (`scripts/set-admin.mjs`, con la clave de servidor, fuera del panel). No está nombrado en la spec, pero RF-1 lo exige («designadas fuera del panel») y sin él no se puede usar ni verificar la función. Se aprueba junto con este plan.
11. **Sin dependencias nuevas.** Se usan `@supabase/supabase-js`, `@supabase/ssr` y `server-only` (que Next.js ya resuelve).
12. **Antes de escribir código se leerán las guías de Next.js** de acciones de servidor y seguridad de datos (AGENTS.md), de las que ya salen los puntos 1 y 11.

## Archivos a crear / modificar
| Archivo | Cambio |
|---|---|
| `src/lib/clients/onboarding.ts` | Nuevo. Lógica pura, sin importar nada del panel: validar datos, buscar email y nombre repetidos, dar de alta con deshacer por pasos, listar clientes con su estado. Recibe el cliente de administración como parámetro. |
| `src/lib/supabase/admin.ts` | Nuevo. Crea el cliente con la clave de servidor; marcado solo-servidor para que no pueda llegar al navegador. |
| `src/lib/supabase/require-admin.ts` | Nuevo. Comprueba en el servidor que quien llama es admin (token validado, rol en `app_metadata`); lo usan todas las acciones. |
| `src/app/admin/clientes/actions.ts` | Nuevo. Acciones de servidor: dar de alta y listar. Cada una empieza por la comprobación de admin. |
| `src/app/admin/clientes/page.tsx` | Nuevo. Lista de clientes, formulario de alta con aviso y confirmación de nombre repetido, y botón para elegir cliente. |
| `src/app/aceptar-invitacion/page.tsx` | Nuevo, pública. El cliente invitado llega desde el correo, pone su contraseña (mismas reglas que «Mi cuenta») y entra al panel. |
| `src/hooks/useActiveSite.ts` | Nuevo. Cliente elegido por el admin en esta pestaña. |
| `src/hooks/useUser.ts` | Añade `isAdmin`; `siteId` pasa a ser el cliente elegido si el usuario es admin. |
| `src/app/admin/layout.tsx` | Bloquea las secciones si el admin no eligió cliente; franja visible con el cliente editado, «Cambiar» y «Salir»; recarga el nombre del negocio al cambiar de cliente; reinicia la sección al cambiar. |
| `src/components/admin/Sidebar.tsx` | Muestra «Clientes» solo al admin y oculta lo que no le corresponde sin cliente elegido. |
| `scripts/set-admin.mjs` | Nuevo, local. Marca una cuenta como admin con la clave de servidor, solo en PylarLabs. |
| `scripts/tests/alta.test.mjs` | Nuevo. Pruebas del módulo de alta contra la base real, con prefijo propio `zz-alta-`. |
| `package.json` | El script `test:db` ejecuta las dos pruebas. |
| `AGENTS.md`, `MEMORY.md` | Ver «Actualizaciones previstas». |

No se tocan: `supabase/**` (la base ya tiene lo necesario), `src/types/database.ts`, `src/middleware.ts` (su `matcher` solo cubre `/admin` y `/login`; la página nueva pública queda fuera a propósito), `../template-landing`.

## Modelo de datos / interfaces
- **Datos:** sin cambios de esquema. El alta crea una fila en `site_config` (`site_id`, `business_name`; el resto vacío, RF-3) y un usuario con `app_metadata.site_id`.
- **Usuario admin:** `app_metadata.role = 'admin'`, sin `site_id`.
- **Entrada del alta:** email y nombre del negocio, más un indicador de «confirmo el nombre repetido». No hay contraseña (RF-4).
- **Resultado del alta:** una de estas respuestas: creado (con el email invitado), nombre repetido que pide confirmación, error de validación, email ya registrado, o fallo con el detalle de lo que se deshizo y de lo que no pudo deshacerse (RF-5, RF-6).
- **Lista:** por cliente, nombre del negocio, email del usuario (o guion si el sitio aún no tiene usuario) y estado.
- **Cliente elegido por el admin:** identificador del sitio y nombre del negocio, guardados solo en la pestaña.
- **Compatibilidad hacia atrás:** un usuario normal ve exactamente el panel de hoy; el modo admin no cambia nada para él.

## Mapa RF → implementación → test
Las pruebas del módulo de alta corren en Node contra PylarLabs con `npm run test:db`; lo que depende del navegador o del correo se verifica a mano (AGENTS.md).

| RF | Dónde se implementa | Test que lo verifica |
|---|---|---|
| RF-1 | `require-admin.ts` y `useUser` (rol solo de `app_metadata`); `set-admin.mjs` | Prueba: solo `app_metadata.role = 'admin'` cuenta; `user_metadata` no. Prueba de base: un cliente que se pone el rol en su perfil editable no gana acceso (ya en la 004). |
| RF-2 | Comprobación de admin en cada acción; «Clientes» solo para admin; la página no muestra nada a otros | Prueba de la comprobación con usuarios de ejemplo (admin, cliente, sin sesión). Navegador: un cliente no ve el enlace y, al abrir la dirección, recibe «sin permiso». |
| RF-3 | `onboarding.ts`: configuración, invitación, asignación del sitio | Prueba: un alta correcta deja una configuración solo con el nombre, y un usuario cuyo `app_metadata.site_id` es el del sitio. |
| RF-4 | El alta no recibe contraseña | Prueba: el módulo no pide contraseña ni la guarda; el usuario se crea por invitación. Navegador: la contraseña la pone el cliente en la página de aceptar. |
| RF-5 | Deshacer por pasos | Pruebas con fallo inyectado en cada paso (crear configuración, invitar, asignar sitio): no queda configuración ni usuario. |
| RF-6 | Resultado con el detalle de lo que quedó | Prueba con fallo al deshacer: el resultado dice qué quedó creado. |
| RF-7 | Búsqueda de email y rechazo de la invitación | Prueba: un email ya registrado no crea nada. Prueba de carrera simulada: el segundo rechazo también deshace. |
| RF-8 | Validación de email y nombre | Pruebas de tabla: vacío, solo espacios, formato inválido, varias líneas, 100 y 101 caracteres. |
| RF-9 | Lista con estado | Prueba: cliente invitado → «pendiente»; tras iniciar sesión → «activo». |
| RF-10 | Modo admin en `useUser` y el diseño general | Navegador: el admin elige un cliente, recorre las seis secciones, guarda, sube imágenes; se comprueba en la base que lo guardado quedó en ese sitio. |
| RF-11 | Franja con el cliente editado, «Cambiar»/«Salir» | Navegador: la franja está siempre visible; al cambiar de cliente las secciones muestran los datos del nuevo y nada se guarda en el anterior. |
| RF-12 | Bloqueo en el diseño general | Navegador: sin cliente elegido no hay formularios ni datos, solo el aviso para elegir. |
| RF-13 | Reglas de la base (spec 004) | Ya cubierto: el admin no crea elementos de un sitio que no existe (`test:db`). |
| RF-14 | Reglas de la base + comprobación de admin | `test:db` (aislamiento) más las pruebas de RF-2; navegador con un cliente real. |
| RF-15 | Todos los textos en español | Revisión en el navegador de cada mensaje. |
| RF-16 | Comparación de nombres con confirmación exigida por el servidor | Pruebas: nombre repetido sin confirmar → pide confirmar y no crea; con confirmar → crea; mayúsculas y espacios no engañan. |

## Riesgos y casos límite
- **Prerrequisito de correo (el más importante).** Que el cliente reciba la invitación depende de la configuración de correo de Supabase. Según la documentación que conozco, el servicio de correo incluido solo envía a miembros del equipo del proyecto y con un límite muy bajo por hora; para clientes reales hace falta un servidor de correo propio. Además la dirección de la página de aceptar debe estar en la lista de direcciones de redirección permitidas (hoy no sé cuál es la dirección de producción del panel). Hay que comprobarlo en el panel de Supabase antes de dar de alta al primer cliente real; en la verificación se probará con un correo tuyo.
- **El enlace de invitación no usa el flujo seguro por código** (Supabase no lo admite para invitaciones): llega con la sesión en la dirección. El cliente del navegador debería leerla solo, pero no está comprobado en esta versión; se verifica con un enlace de invitación real o generado desde la clave de servidor, que no necesita enviar correo.
- **Los escáneres de correo pueden consumir el enlace** antes que el cliente y dejarlo vencido. Reenviar invitaciones queda fuera de la spec; el riesgo se documenta y conviene una spec de seguimiento.
- **Fallo entre pasos** (caída del servidor a mitad): puede quedar una configuración sin usuario o un usuario sin sitio. El deshacer es de mejor esfuerzo; la lista muestra sitios sin usuario para que se vean.
- **Acción de servidor llamada por fuera de la interfaz.** Por eso cada acción comprueba el rol por sí misma; la prueba de la comprobación y la de navegador con un cliente lo cubren, pero una llamada directa real no se prueba de forma automática.
- **La clave de servidor** solo se lee en archivos marcados solo-servidor y nunca lleva el prefijo público. Hay que definirla también en el entorno del servidor donde se despliegue el panel.
- **Token del admin:** quitarle el rol no surte efecto hasta que su token se renueve (documentado en la 004).
- **Editar con la pantalla equivocada:** mitigado por la franja permanente y por el bloqueo sin cliente elegido; los cambios sin guardar se pierden al cambiar de cliente (las secciones se reinician), sin avisar: no es un requisito de la spec.
- **El admin dispara el despliegue del cliente al guardar** (el enlace de despliegue se lee y se usa desde el navegador, como hoy). Es el comportamiento actual; se resuelve en la spec 002.
- **Dos admins o un admin y el cliente editando a la vez:** gana el último guardado, igual que hoy.
- **Las pruebas escriben en la base real.** Usan el prefijo `zz-alta-`, distinto del de la prueba de aislamiento para que ninguna limpieza borre lo de la otra, y se detienen si `.env.local` no apunta a PylarLabs.
- **Escala:** recorrer usuarios y configuraciones enteras es suficiente para decenas de clientes; hay que revisarlo si crecen a cientos.

## Comprobación con la constitución
- [x] 1. Simplicidad: sin dependencias nuevas, sin tablas ni campos nuevos, lógica en un solo módulo, estado de la interfaz en la pestaña, sin historial ni reenvíos.
- [x] 2. La spec manda: todo cuelga de un RF; reenviar invitaciones, borrar clientes, marcar cambios y publicar por el cliente quedan fuera y nombrados. El script de primer admin se declara aparte para tu aprobación.
- [x] 3. Aislamiento entre clientes: lo sigue garantizando la base (spec 004); además cada acción comprueba el rol en el servidor, y la interfaz solo oculta.
- [x] 4. Secretos fuera del cliente: la clave de servidor solo vive en archivos solo-servidor y en scripts locales; la contraseña del cliente nunca pasa por la agencia; el sitio y el rol salen de `app_metadata`.
- [x] 5. Lint y build como puerta: `npm run lint` y `npm run build` sin errores antes de dar nada por hecho.
- [x] 6. Idioma y contrato: código en inglés, interfaz y mensajes en español; no cambia la forma de los datos que se mapea al contrato 2.3.

## Actualizaciones previstas
- AGENTS.md: reglas de la 004 y de la 003 ya propuestas; añadir que la clave de servidor solo se usa en archivos solo-servidor y que toda acción de servidor comprueba el rol por sí misma. Propuesto, no aplicado sin tu OK.
- MEMORY.md: estado de la 005 y lo comprobado sobre correo y redirecciones.

## Orden de ejecución propuesto (para `/tasks`)
1. Leer las guías de Next.js; escribir `scripts/set-admin.mjs` y la prueba del módulo de alta con todos los casos (validación, duplicados, deshacer por pasos) y verla fallar.
2. Escribir el módulo de alta hasta poner la prueba en verde.
3. Comprobación de admin, cliente de administración y acciones de servidor; prueba de la comprobación.
4. Modo admin: `useActiveSite`, `useUser`, diseño general y menú.
5. Página de clientes (lista, alta, elegir) y página de aceptar la invitación.
6. Puerta de calidad: tipos, lint, build y `npm run test:db`.
7. Comprobar con Supabase el correo, las redirecciones y el enlace de invitación; recorrido en el navegador con un admin y un cliente; limpieza; `MEMORY.md`.
