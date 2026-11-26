# Spec 005 — Alta de clientes y administración desde el panel
> Solo el QUÉ y el POR QUÉ. Nada de stack, arquitectura ni nombres de archivos (eso va en plan.md).
> Depende de la 004 (`004-esquema-multicliente`): sin sitios con configuración propia no hay a quién dar de alta. Orden de trabajo: 004 → 003 → 005 → 001 → 002.

## Contexto y objetivo
Hoy no existe ninguna forma de dar de alta a un cliente: ni el usuario con su sitio ni la configuración inicial se pueden crear desde el panel, y la agencia no puede entrar a ayudar a un cliente con sus datos. Esta spec agrega, dentro del panel y solo para el perfil admin de la agencia, (1) el alta de un cliente nuevo (su sitio, su configuración inicial con el nombre del negocio y su usuario, que recibe una invitación por email) y (2) la posibilidad de elegir un cliente existente y ver y editar sus datos. Si el alta falla a mitad, no queda nada a medias. El cliente de siempre no ve nada de esto y sigue alcanzando solo SU sitio.

## Usuarios / actores
- **Admin de la agencia**: una o pocas cuentas, designadas fuera del panel. No tiene sitio propio; da de alta clientes y edita los datos de cualquier cliente.
- **Cliente nuevo**: recibe la invitación por email y crea su propia contraseña.
- **Cliente existente**: edita solo los datos de SU sitio; no ve ni puede usar nada de lo de esta spec.

## Historias de usuario
- H1: Como admin quiero dar de alta a un cliente indicando su email y el nombre de su negocio, para que reciba acceso sin que yo conozca ni maneje su contraseña.
- H2: Como admin quiero que, si algo falla durante el alta, no quede un usuario sin sitio ni un sitio sin usuario, para no limpiar datos a mano.
- H3: Como admin quiero ver la lista de mis clientes y elegir uno para ver y editar sus datos, para ayudarle sin usar su cuenta.
- H4: Como admin quiero ver siempre a qué cliente estoy editando, para no guardar datos en el sitio equivocado.
- H5: Como cliente quiero recibir una invitación por email y crear mi contraseña, para entrar a mi panel por primera vez y encontrar mi sitio listo.

## Requisitos funcionales (criterios de aceptación en EARS)
- RF-1: EL SISTEMA reconoce como admin solo a las cuentas que la agencia marcó como tales fuera del panel, con un dato que ningún usuario puede editar; el panel no ofrece forma de crear ni de nombrar admins.
- RF-2: MIENTRAS el usuario no es admin, EL SISTEMA no le muestra ni le permite usar el alta, la lista de clientes ni el selector de cliente, ni aunque conozca la dirección o intente la acción por otra vía.
- RF-3: CUANDO el admin da de alta indicando el email del cliente y el nombre de su negocio, EL SISTEMA crea el sitio nuevo con un identificador propio generado, crea la configuración inicial solo con el nombre del negocio (todo lo demás vacío), crea el usuario del cliente asociado a ese sitio con un dato que el cliente no puede editar y le envía por email una invitación para crear su contraseña.
- RF-4: EL SISTEMA no pide, muestra ni guarda la contraseña del cliente en ningún momento del alta.
- RF-5: SI algún paso del alta falla (crear la configuración, crear el usuario o enviar la invitación), ENTONCES EL SISTEMA deshace lo que ya había creado, informa al admin qué falló y no queda un usuario sin sitio ni un sitio sin usuario.
- RF-6: SI no se puede deshacer algún paso tras un fallo, ENTONCES EL SISTEMA informa al admin exactamente qué quedó creado para que pueda corregirlo.
- RF-7: SI el email ya está registrado, ENTONCES EL SISTEMA rechaza el alta sin crear nada y lo informa.
- RF-8: SI el email o el nombre del negocio están vacíos, el email no tiene un formato válido, o el nombre tiene más de una línea o más de 100 caracteres, ENTONCES EL SISTEMA rechaza el alta con un mensaje en español y no crea nada.
- RF-9: CUANDO el admin abre la lista de clientes, EL SISTEMA muestra los clientes existentes con el nombre de su negocio, el email de su usuario y su estado: «invitación pendiente» mientras el cliente no haya entrado nunca y «activo» desde que entró al menos una vez.
- RF-10: CUANDO el admin elige un cliente, EL SISTEMA le muestra las mismas secciones del panel sobre los datos de ese sitio (negocio, imágenes, servicios, catálogo, testimonios, redes) y le permite leerlos y editarlos, incluidas las imágenes.
- RF-11: MIENTRAS el admin edita un cliente, EL SISTEMA muestra de forma visible en todo momento el nombre del negocio al que está editando, le permite cambiar de cliente o volver, y lo que guarda queda solo en ese sitio.
- RF-12: SI el admin no ha elegido ningún cliente, ENTONCES EL SISTEMA no le muestra datos de ningún sitio ni le permite guardarlos.
- RF-13: EL SISTEMA no permite al admin crear ni editar datos de un sitio que no existe.
- RF-14: EL SISTEMA mantiene el aislamiento entre clientes: ningún cliente puede alcanzar los datos de otro, ni dar de alta clientes, ni ver la lista, ni hacerse pasar por admin; una prueba lo demuestra con un cliente y un admin.
- RF-15: EL SISTEMA muestra todos los textos y mensajes de esta función en español.
- RF-16: SI ya existe un cliente con el mismo nombre de negocio (sin distinguir mayúsculas), ENTONCES EL SISTEMA avisa al admin y solo crea el alta si este lo confirma; dos clientes con el mismo nombre son válidos porque cada sitio tiene su propio identificador.

## Requisitos no funcionales
- La autoridad de admin la comprueba siempre el servidor, no solo la interfaz (principio 3); ninguna clave privada llega al navegador ni se guarda en git (principio 4).
- El alta no inventa datos: no se crean valores de negocio que el admin no haya indicado (principio 1).
- Mensajes de error claros y accionables para el admin: qué falló y qué quedó creado.

## Casos límite
- Email con mayúsculas, espacios al inicio o al final, o con un formato límite.
- Dos altas simultáneas con el mismo email, o dos admins dando de alta el mismo negocio a la vez.
- Nombre del negocio repetido entre clientes distintos, vacío, de solo espacios o muy largo.
- Cierre de sesión del admin o caída de conexión a mitad del alta.
- El correo de invitación no se puede enviar, o se envía pero el cliente nunca lo acepta.
- El admin cambia de cliente con cambios sin guardar en pantalla.
- El admin edita un cliente al mismo tiempo que el propio cliente.
- Un cliente cuya invitación aún no aceptó aparece en la lista.
- Cuenta de admin que además intenta usarse como cliente (no tiene sitio propio).

## Fuera de alcance
- Baja, suspensión o borrado de clientes; cambio del email o del sitio de un cliente.
- Reenviar o gestionar invitaciones vencidas y recuperar contraseñas.
- Agregar un segundo usuario a un sitio que ya existe (cada alta crea un cliente nuevo con un usuario).
- Crear o nombrar admins desde el panel; panel de métricas o de uso de la agencia.
- Auditoría, historial o marca de qué cambios hizo el admin sobre un cliente.
- Publicar en nombre del cliente: se decide en la spec 002 cuando se planifique (hoy ahí solo se publica el sitio del usuario autenticado).
- Mostrar en la lista si el sitio ya publicó (depende de la spec 002).
- Campos nuevos del contrato (spec 001), validar y publicar (spec 002), el esquema multicliente (spec 004) y la reparación de tipos y pantallas (spec 003).

## Criterios de finalización
- Cada RF con su prueba (automática donde sea posible, manual documentada donde no) en verde.
- Un alta de prueba deja un sitio con su configuración y un usuario que recibe la invitación y entra a un panel que ya tiene su sitio.
- Pruebas de fallo en cada paso del alta (configuración, usuario, invitación) que dejan la base sin nada a medias.
- Prueba de que un cliente no puede usar nada de lo de admin ni alcanzar el sitio de otro, y de que el admin sí puede editar el de cualquier cliente.
- `npm run lint` y `npm run build` sin errores; revisión en el navegador (escritorio y 375 px, consola sin errores).

## Dudas abiertas
Ninguna abierta.

Resueltas el 2026-11-24 (con tus respuestas): publicar en nombre del cliente se decide en la 002; si el cliente no acepta la invitación, el admin la ve «pendiente» en la lista y reenviar o borrar el alta queda fuera; el nombre repetido se permite con aviso y confirmación, con el nombre en una línea, no vacío y hasta 100 caracteres (RF-8, RF-16); la lista muestra nombre, email y estado (RF-9); los cambios del admin no llevan marca.
Notas para el plan (no cambian el alcance): la base ya tiene la excepción de admin (spec 004), así que el selector del admin y el alta se apoyan en ella; la acción de alta necesita la clave de servidor y por eso debe ejecutarse solo en el servidor.
