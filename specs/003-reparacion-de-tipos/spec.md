# Spec 003 — Reparación de tipos y pantallas
> Solo el QUÉ y el POR QUÉ. Nada de stack, arquitectura ni nombres de archivos (eso va en plan.md).
> Orden de trabajo (por dependencia, no por número): 004 (esquema, ya hecha) → 003 (reparar tipos y pantallas) → 005 (alta de clientes) → 001 (campos y límites) → 002 (validar y publicar). Las demás specs suponen un panel que compila y guarda bien.
> Revisada el 2026-11-24 con el esquema real de PylarLabs ya leído y endurecido por la spec 004. La versión anterior se escribió sin haberlo leído.

## Contexto y objetivo
El panel existente se escribió con pantallas y componentes que no coinciden entre sí ni con los datos. Hoy la comprobación de tipos da 13 errores, `npm run build` se detiene en ellos y `npm run lint` da 5 errores y 2 avisos. Los tipos de los datos ya son correctos: describen las cinco tablas tal como existen en la base (spec 004, RF-2). Lo que está mal son las pantallas y un componente:
- Servicios usa `name` y `price`, y la base solo tiene `title` y ningún precio.
- Imágenes lee `url` de la galería, que en la base es `image_url`, y entrega un objeto donde la función espera un texto.
- La subida de imágenes se llama con unos datos (`siteId`, `section`, `value`, `onChange`) distintos de los que el componente declara (`bucket`, `path`, `currentUrl`, `onUpload`).
- El diseño general lee la dirección web del sitio, que no existe en la base.

Además, desde la spec 004 las imágenes de cada cliente deben guardarse en una carpeta con el identificador de su sitio dentro del almacenamiento `images`, y un cliente ya no puede crear la configuración de su sitio. Las pantallas tienen que respetarlo y decirle algo claro al cliente cuando no se pueda guardar. Esta spec deja el panel actual coherente con los datos, con lint y build en verde, y con cada sección guardando y recargando bien. No agrega funcionalidad nueva: eso es la spec 001.

## Usuarios / actores
- **Cliente final**: edita en el panel los datos de SU web; hoy algunas secciones fallan al guardar o muestran datos que no existen.
- **Equipo de la agencia**: necesita lint y build en verde y pantallas fieles a los datos para construir encima las specs 005, 001 y 002.

## Historias de usuario
- H1: Como equipo de la agencia quiero que el panel pase lint y build sin errores para poder construir sobre él las specs siguientes.
- H2: Como cliente quiero que cada sección de mi panel guarde lo que escribo y lo muestre al recargar, para confiar en que mis datos no se pierden.
- H3: Como cliente quiero que el panel no me ofrezca campos que no existen en mis datos, para no cargar información que nunca se guarda.
- H4: Como cliente quiero que mis imágenes (logo, imagen principal, galería, fotos de productos) se suban y se vean, para que mi web las muestre.
- H5: Como cliente quiero un mensaje claro cuando no puedo guardar porque mi sitio todavía no está preparado, en lugar de un error genérico.

## Requisitos funcionales (criterios de aceptación en EARS)
- RF-1: EL SISTEMA describe cada tabla de datos (configuración del sitio, galería, servicios, productos, testimonios) con la forma que tienen en la base (la de la spec 004, RF-2); cuando una pantalla o un componente discrepa de esa forma, se corrige la pantalla o el componente, no los datos ni el esquema.
- RF-2: CUANDO se comprueban los tipos, se ejecuta el lint y se construye el proyecto, EL SISTEMA no muestra ninguno de los 13 errores de tipos ni de los 5 errores de lint previos ni otros nuevos, y `npm run lint` y `npm run build` terminan sin errores.
- RF-3: SI una pantalla pide, muestra o lee un dato que no existe en la base (el precio de un servicio o la dirección web del sitio en el diseño general), ENTONCES EL SISTEMA deja de ofrecerlo o leerlo en esa pantalla, sin crear campos ni columnas; el enlace «ver mi web» del encabezado desaparece.
- RF-4: CUANDO el cliente guarda una sección de `/admin` (negocio, imágenes, servicios, catálogo, testimonios, redes), EL SISTEMA guarda lo escrito y, al recargar la sección, lo muestra igual.
- RF-5: SI un guardado falla hoy por un desajuste entre pantalla y datos (p. ej. la galería que recibe un objeto donde va un texto o lee un campo que no existe), ENTONCES EL SISTEMA lo corrige de modo que el guardado funcione.
- RF-6: CUANDO el cliente sube una imagen (logo, imagen principal, galería o foto de producto), EL SISTEMA la guarda en la carpeta de SU sitio dentro del almacenamiento `images`, la muestra y permite reemplazarla o quitarla.
- RF-7: SI el sitio del cliente todavía no tiene configuración, ENTONCES EL SISTEMA muestra el aviso «Tu sitio todavía no tiene configuración. Pedile a la agencia que la cree.» al intentar guardar la configuración, y las secciones se abren sin romperse.
- RF-8: SI un guardado falla por una causa que el cliente puede entender (por ejemplo, no tener configuración), ENTONCES EL SISTEMA le muestra esa causa en español y no un «Error al guardar» genérico.
- RF-9: EL SISTEMA no modifica filas, esquema ni políticas de acceso, mantiene la interfaz en español y el aislamiento entre clientes por sitio tal como están (spec 004).
- RF-10: EL SISTEMA no cambia la forma de los datos que debe poder mapearse al contrato de `template-landing` (v2.3).

## Requisitos no funcionales
- Aislamiento entre clientes (principio 3) y `site_id` solo de `app_metadata`; ninguna clave privada en el navegador (principio 4).
- Cambios mínimos y revisables (principio 1): solo lo necesario para que pantallas y datos coincidan y lint y build pasen.
- Interfaz y mensajes en español.
- La prueba de aislamiento de la spec 004 (`npm run test:db`) sigue en verde.

## Casos límite
- Usuario con sitio pero sin configuración: las secciones se abren, y guardar la configuración muestra el aviso de RF-7 (los servicios, productos, testimonios y fotos no se pueden crear mientras no exista la configuración del sitio: lo impide una regla de la base; el aviso también debe cubrirlo).
- Usuario sin sitio asignado: las secciones no se rompen.
- Sección sin elementos guardados (sin servicios, sin imágenes, sin testimonios).
- Datos con campos vacíos o nulos, que los tipos ya admiten.
- Imagen que no se puede subir (formato no imagen, error de red): el cliente lo ve y no queda un dato a medias.
- Reemplazar una imagen con el mismo nombre.
- Dos secciones que comparten el mismo dato o la misma forma de dato: ambas quedan coherentes.

## Fuera de alcance
- Campos nuevos, límites de campo, ícono de servicio, idioma, moneda y demás cambios de la spec 001; validación y publicación de la spec 002.
- Crear la configuración de un sitio o dar de alta a un cliente, y el selector de cliente del admin (spec 005).
- Crear columnas, tablas o políticas nuevas, o cualquier cambio de esquema o de datos en Supabase.
- Cambiar el contrato o el template.
- Mecanismo para evitar futuros desajustes entre tipos y esquema; solo se repara lo actual y se mantiene la puerta de lint y build.
- Rediseño visual o de la navegación del panel; tests automáticos nuevos sobre las pantallas.

## Criterios de finalización
- Los 13 errores de tipos y los 5 errores de lint previos resueltos; `npm run lint` y `npm run build` sin errores (los avisos no bloquean, pero no se agregan nuevos).
- `npm run test:db` sigue en 91 de 91 en verde.
- Cada RF verificado: automáticamente donde sea posible; en el navegador con un usuario de prueba que tenga sitio y configuración, recorriendo cada sección de `/admin`, guardando y recargando para comprobar el cambio (escritorio y 375 px, consola sin errores), incluida la subida de imágenes.
- Ninguna fila ni esquema de Supabase modificados por esta spec (salvo los datos de prueba, que se borran).

## Dudas abiertas
Ninguna abierta.

Resueltas el 2026-11-24 (con tu respuesta): se puede crear con la clave de servidor un usuario de prueba con su sitio y su configuración, solo para la verificación en el navegador, y borrarlo al terminar; el aviso de `middleware` → `proxy` queda fuera de esta spec (se hará en otra, porque ese archivo protege `/admin`).
Resueltas antes el 2026-11-24: el esquema real de PylarLabs está leído y los tipos ya lo reflejan; la dirección web del sitio no existe en la base (se quita el enlace); no hay columna de precio en servicios (se quita de la pantalla); los 13 errores de tipos son todos de pantallas y del componente de subida, no de los tipos de datos; el bucket del panel (`images`) existe y es el correcto, y las imágenes van en la carpeta del sitio.
