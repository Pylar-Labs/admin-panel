# Spec 004 — Esquema multicliente (endurecimiento)
> Solo el QUÉ y el POR QUÉ. Nada de stack, arquitectura ni nombres de archivos (eso va en plan.md).
> Orden de trabajo (por dependencia, no por número): 004 (esquema) → 003 (reparar tipos y pantallas) → 005 (alta de clientes en el panel) → 001 (campos y límites) → 002 (validar y publicar). Las demás specs suponen que esta existe.
> Revisada el 2026-11-23: la versión inicial suponía crear el esquema desde cero, pero se leyó la base equivocada. La base del panel (PylarLabs) ya tiene el esquema multicliente; esta spec cierra lo que le falta.

## Contexto y objetivo
El panel está pensado para que cada cliente de la agencia edite SOLO los datos de su web y para que ningún cliente vea los de otro (principio 3 de la constitución). La base del panel ya guarda los datos en cinco conjuntos (configuración del sitio, galería, servicios, productos y testimonios), cada uno con el sitio al que pertenece y con una regla de acceso por sitio; hoy está vacía de datos. Pero le faltan cosas para cumplir el principio y las specs siguientes: no existe el perfil admin de la agencia, un cliente puede crear y borrar la configuración de su propio sitio, las imágenes que sube un cliente no están separadas por sitio (cualquier usuario autenticado puede subir o borrar en cualquier carpeta, un visitante sin sesión puede listarlas y no se pueden reemplazar), y los roles anónimo y autenticado tienen permisos de sobra sobre las tablas. Esta spec endurece lo que ya existe, sin borrar ni recrear nada, y deja una prueba que demuestra el aislamiento.

## Usuarios / actores
- **Cliente final**: usuario autenticado de un sitio; lee y edita solo los datos de ese sitio. Puede haber varios usuarios por sitio y hay un solo sitio por cliente.
- **Equipo de la agencia (admin)**: crea el sitio de cada cliente y puede ayudar a editar el de cualquiera; cómo se da de alta lo define la spec 005.
- **Visitante sin sesión**: no debe leer ni escribir ningún dato del panel.

## Historias de usuario
- H1: Como cliente quiero que mis datos y mis imágenes queden separados de los de los demás clientes, para que nadie más los vea ni los modifique.
- H2: Como cliente quiero poder cargar mi información (negocio, galería, servicios, productos y testimonios) y encontrarla al volver, para trabajar con el panel con confianza.
- H3: Como equipo de la agencia quiero que solo la agencia pueda crear o borrar el sitio de un cliente, para que el cliente no se cree sitios por su cuenta.
- H4: Como equipo de la agencia quiero una prueba que demuestre que un cliente no alcanza los datos ni las imágenes de otro, para poder darlo por garantizado.

## Requisitos funcionales (criterios de aceptación en EARS)
- RF-1: EL SISTEMA guarda los datos del panel en cinco conjuntos (configuración del sitio, galería, servicios, productos y testimonios), y cada elemento guardado pertenece a exactamente un sitio. (Ya se cumple; esta spec lo verifica y no lo cambia.)
- RF-2: EL SISTEMA guarda en cada conjunto exactamente los campos que hoy describe el modelo del panel, y ninguno más; los campos nuevos del contrato los agrega la spec 001, no esta. Cuando una pantalla use un campo que no está en esta lista, la pantalla se adapta al modelo (spec 003), no al revés:
  - Configuración: nombre del negocio, eslogan, descripción, teléfono, WhatsApp, email, dirección, horarios, Instagram, Facebook, logo, imagen principal con su título y subtítulo, mapa, enlace de despliegue, activo y fecha de alta.
  - Galería: imagen, leyenda, orden y activo.
  - Servicios: título, descripción, ícono, orden y activo (sin precio).
  - Productos: nombre, descripción, precio, precio visible, categoría, imagen, mensaje de WhatsApp, orden y activo.
  - Testimonios: nombre del autor, texto, valoración, orden y activo.
- RF-3: EL SISTEMA admite una sola configuración por sitio, y esa configuración es la que define que el sitio existe; no hay una lista de sitios aparte; un elemento no puede existir sin la configuración de su sitio. (Ya se cumple; se verifica.)
- RF-4: CUANDO un usuario autenticado lee o escribe datos, EL SISTEMA solo le permite alcanzar los de SU sitio, en los cinco conjuntos; el sitio del usuario sale de un dato que el propio usuario no puede editar. La única excepción es el admin de la agencia (spec 005), que alcanza los de cualquier sitio existente y cuyo permiso sale también de un dato que ningún usuario puede editar.
- RF-5: SI un usuario no tiene sitio asignado y no es admin, ENTONCES EL SISTEMA no le permite leer ni escribir ningún dato.
- RF-6: SI no hay sesión, ENTONCES EL SISTEMA no permite leer ni escribir ningún dato de los cinco conjuntos, incluido el enlace de despliegue de la configuración.
- RF-7: SI un usuario que no es admin intenta guardar un elemento a nombre de otro sitio, o mover uno propio a otro sitio, ENTONCES EL SISTEMA lo rechaza y no cambia nada.
- RF-8: EL SISTEMA permite al cliente crear, editar y borrar sus fotos de galería, servicios, productos y testimonios, y editar la configuración de su sitio; no le permite crearla ni borrarla.
- RF-9: EL SISTEMA permite crear y borrar la configuración de un sitio solo a la agencia (admin), nunca al cliente; qué lleva esa configuración al dar de alta (solo el nombre del negocio) y cómo se crea lo define la spec 005.
- RF-10: (Movido a la spec 005: no dejar a un cliente con sitio asignado pero sin configuración si el alta falla a medias.)
- RF-11: EL SISTEMA endurece el esquema existente sin borrar ni recrear tablas ni columnas y sin perder datos; el cambio se puede aplicar más de una vez sin efectos duplicados y no se aplica a la base real sin aprobación explícita.
- RF-12: EL SISTEMA incluye una prueba con dos clientes de que ninguno puede leer, crear, modificar ni borrar datos del otro en ninguno de los cinco conjuntos ni subir, cambiar o borrar imágenes en el espacio del otro, y de que un visitante sin sesión no obtiene ningún dato ni puede subir imágenes. La prueba incluye que un cliente no puede hacerse pasar por admin y que el admin sí alcanza los datos y las imágenes de cualquier sitio existente.
- RF-13: EL SISTEMA permite a un cliente subir, reemplazar y borrar imágenes solo en el espacio de SU sitio (una carpeta por sitio en el almacenamiento de imágenes que ya usa el panel); cualquier intento sobre el espacio de otro sitio se rechaza, salvo el admin de la agencia, que puede hacerlo en el de cualquier sitio. Un visitante sin sesión no puede subir ni listar imágenes. Ver las imágenes puede seguir siendo público porque la web las muestra.
- RF-14: MIENTRAS la spec 002 no mueva el enlace de despliegue fuera del navegador, EL SISTEMA lo mantiene en la configuración y lo deja legible solo para los usuarios de ese sitio, de modo que el panel siga publicando como hoy. (Ya se cumple; se verifica.)
- RF-15: EL SISTEMA no cambia el contrato ni el template y no crea ni modifica ninguna tabla fuera de los cinco conjuntos.
- RF-16: EL SISTEMA no concede al visitante sin sesión ningún permiso sobre los cinco conjuntos, y concede al usuario autenticado solo leer, crear, cambiar y borrar sus elementos (sin vaciar las tablas ni modificar su estructura).

## Requisitos no funcionales
- Aislamiento entre clientes garantizado por el servidor y no solo por la interfaz (principio 3); datos personales y claves tratados como privados, sin claves privadas en el navegador (principio 4).
- El cambio queda como un conjunto de instrucciones revisable antes de aplicarse (principio 1: nada "por si acaso"); no agrega dependencias ni piezas nuevas al panel.
- Las consultas por sitio siguen siendo rápidas al crecer los datos de muchos clientes.
- Lo que guarda el panel debe poder mapearse al contrato de `template-landing` (v2.3) (principio 6).

## Casos límite
- Usuario autenticado sin sitio asignado, o con sitio vacío o con un valor que no corresponde a ninguna configuración.
- Usuario que edita su propio perfil para fingir otro sitio o para fingir ser admin: no cambia lo que puede alcanzar.
- Usuario que ya tiene sitio asignado pero cuyo sitio aún no tiene configuración (hoy existe uno así): al endurecer, el cliente no puede crearla; hasta la spec 005 la crea la agencia.
- Elemento guardado sin sitio, o con un sitio sin configuración.
- Dos configuraciones para el mismo sitio (se impide) y sitio con configuración pero sin elementos (listas vacías).
- Dos usuarios del mismo sitio editando a la vez el mismo elemento.
- Borrar la configuración de un sitio que tiene servicios, productos, testimonios o fotos (no la puede borrar el cliente).
- Datos de un cliente con caracteres especiales o textos muy largos.
- Cliente que intenta subir o borrar una imagen usando el espacio de otro sitio, o una imagen con nombre repetido en su propio espacio.
- Archivo en la raíz del almacenamiento, sin carpeta de sitio: no queda al alcance de ningún cliente.

## Fuera de alcance
- Campos nuevos del contrato, límites de campo y cambios de pantalla (spec 001), validar y publicar (spec 002), y reparar los tipos y las pantallas del panel (spec 003).
- Borrar o recrear tablas o datos; migrar datos (no hay datos que migrar).
- El alta de clientes y la gestión de cuentas (spec 005); baja o borrado de clientes.
- Mover fuera del navegador la clave de despliegue (pendiente de la spec 002).
- Cambiar el contrato o el template.
- Dejar por escrito en el repositorio el script que creó las tablas actuales (ver duda abierta).

## Criterios de finalización
- Cada RF con su prueba (automática donde sea posible, manual documentada donde no) en verde.
- Prueba de aislamiento entre dos clientes y de acceso sin sesión sobre los cinco conjuntos y sobre las imágenes (RF-12).
- Con dos clientes de prueba, cada uno con su sitio y su configuración creados a mano para la prueba, ambos pueden editar sus datos y ninguno alcanza los del otro.
- Aprobación explícita del cambio de esquema antes de aplicarlo; ninguna tabla ni columna borrada o añadida.
- `npm run lint` y `npm run build` sin errores si el cambio toca el código del panel.

## Dudas abiertas
Ninguna abierta.

Resueltas el 2026-11-23: el usuario existente con sitio y sin configuración es de prueba (no se modifica ni se elimina en esta spec; si hace falta su configuración la crea la agencia, spec 005); no se captura en el repositorio la definición de las tablas actuales (queda fuera de alcance).
Resueltas antes: aislamiento de imágenes (entra, RF-13); enlace de despliegue (se mantiene hasta la spec 002, RF-14); lista de campos (RF-2); alta de clientes (pasa a la spec 005); el esquema ya existe en PylarLabs (se endurece, RF-11).
Verificación previa hecha el 2026-11-23 sobre PylarLabs (`eplnsjdvjawwijokoerk`): cinco tablas con exactamente los campos de RF-2; clave primaria, `site_id` único en la configuración y claves foráneas en cascada en las otras cuatro; seguridad por filas activa con una política por tabla basada en el sitio del usuario; 0 filas en los cinco conjuntos; 1 usuario con sitio asignado y sin rol; almacenamiento de imágenes público con 0 archivos, subida y borrado abiertos a cualquier autenticado y sin permiso de actualizar; los roles anónimo y autenticado tienen todos los permisos sobre las cinco tablas.
