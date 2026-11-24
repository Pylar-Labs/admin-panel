# Spec 001 — Campos del contrato en el panel
> Solo el QUÉ y el POR QUÉ. Nada de stack, arquitectura ni nombres de archivos (eso va en plan.md).
> Primera de dos specs. La 002 (`002-publicar-datos-del-sitio`) valida y publica; depende de esta.

## Contexto y objetivo
La web de cada cliente (la landing de la agencia) solo acepta datos que cumplen un contrato estricto (versión 2.3). El panel no deja cargar varios datos que ese contrato exige (título y texto de "Quiénes somos", botón principal, ícono de cada servicio, idioma, moneda…) y guarda otros que la web no muestra (horarios, mapa, galería, logo, imagen del hero, visibilidad de precio por producto). Esta spec hace que el cliente pueda cargar en el panel todo lo que su web necesita, y le deja claro lo que hoy no se publica. No publica nada: eso es la spec 002.

## Usuarios / actores
- **Cliente final**: carga y edita los datos de SU web desde el panel, en español.

## Historias de usuario
- H1: Como cliente quiero cargar en el panel todo lo que mi web necesita (quiénes somos, botón principal, ícono de cada servicio, idioma, moneda…) para que luego se pueda publicar sin datos que nunca pude escribir.
- H2: Como cliente quiero ver los límites de cada campo mientras escribo para no pasarme de largo o de cantidad.
- H3: Como cliente quiero saber qué datos de mi panel no se muestran en mi web para no esperar algo que no se publica.

## Requisitos funcionales (criterios de aceptación en EARS)
- RF-1: EL SISTEMA permite cargar y editar por sitio: título y texto de "Quiénes somos"; cifras (hasta 3) y destacados (hasta 5), opcionales; botón principal y botón secundario (opcional) del inicio; ícono de cada servicio, elegido de la lista permitida; idioma de la web (español, inglés o portugués); moneda y opciones del catálogo (mostrar precios, agrupar por categoría, texto del botón de consulta); y título y subtítulo de cada sección (opcionales).
- RF-2: EL SISTEMA pide para el botón principal un texto y un destino obligatorios, con la sugerencia «Contactanos» hacia la sección de contacto que el cliente debe confirmar; el destino se elige entre las secciones existentes o es una URL http o https.
- RF-3: EL SISTEMA permite cargar el rol (opcional) de cada testimonio y cada campo de contacto que el contrato admite (WhatsApp, email, teléfono, dirección).
- RF-4: EL SISTEMA reemplaza la visibilidad de precio por producto por un único «mostrar precios» para todo el catálogo.
- RF-5: EL SISTEMA genera solo el identificador de cada producto a partir de su nombre al crearlo, lo mantiene estable aunque el producto se renombre y lo desambigua si hay repetidos; el cliente nunca lo escribe.
- RF-6: MIENTRAS el cliente escribe un campo, EL SISTEMA muestra los límites que el contrato fija (longitud máxima, una sola línea, cantidad máxima de elementos de cada lista, formato del WhatsApp) sin impedirle escribir.
- RF-7: CUANDO el cliente guarda una sección, EL SISTEMA guarda lo escrito aunque no cumpla el contrato; la validación que bloquea es la de la publicación (spec 002).
- RF-8: EL SISTEMA marca visiblemente, en cada campo o sección cuyo dato hoy no se publica (horarios, mapa, galería, logo, imagen del hero), el aviso «no se muestra en tu web»; esos datos siguen guardándose y no se pierden.
- RF-9: EL SISTEMA no cambia el contrato ni la web: solo el panel y los datos que guarda.
- RF-10: EL SISTEMA solo permite al cliente leer y escribir los datos de SU sitio, incluidos los campos y tablas nuevos; una prueba demuestra que otro cliente no puede leerlos ni modificarlos.
- RF-11: EL SISTEMA conserva intactos los datos que el cliente ya tenía guardados al introducir los campos nuevos, que quedan vacíos hasta que los cargue.
- RF-12: EL SISTEMA muestra los textos de la interfaz del panel en español, y el cliente escribe el contenido de su web en el idioma que elija para ella.

## Requisitos no funcionales
- Aislamiento entre clientes (principio 3) y ninguna clave privada en el navegador (principio 4).
- Los límites mostrados salen de la misma fuente que usará la validación de la spec 002; no se redactan a mano en dos lugares.
- Cambios de esquema de Supabase autorizados en esta spec, limitados a los campos y tablas que pide RF-1 a RF-5.

## Casos límite
- Textos exactamente en su límite y uno por encima (se avisa, no se bloquea el guardado).
- Cantidad exacta en el máximo de cada lista y una más.
- Contenido con emojis o caracteres combinados: el límite se cuenta como lo cuenta el contrato.
- Sitio recién creado sin fila de configuración, o usuario sin sitio asignado.
- Cliente que cambia el idioma de la web con contenido ya escrito en otro idioma.
- Producto cuyo nombre queda vacío o genera un identificador vacío o repetido.
- Moneda sin decimales con precios ya guardados con decimales.

## Fuera de alcance
- Validar contra el contrato completo, publicar, versionar el contrato, entrega a la web (spec 002).
- Cambiar el contrato o el template, o admitir en la web horarios, mapa, galería, logo o imagen del hero.
- Alta de clientes y gestión de usuarios; auditoría completa de las políticas de acceso (solo lo que esta spec toca).
- Vista previa del sitio o del archivo de datos.
- Traducción de la interfaz del panel.

## Criterios de finalización
- Cada RF con su prueba (automática donde sea posible, manual documentada en el panel donde no) en verde.
- `npm run lint` y `npm run build` sin errores.
- Con un sitio de prueba, todos los campos que exige el contrato se pueden cargar desde el panel.
- Prueba de aislamiento entre dos clientes sobre lo nuevo.
- Revisión en el navegador de cada sección afectada (escritorio y 375 px, consola sin errores).

## Dudas abiertas
- [NECESITA ACLARACIÓN] ¿Cómo obtiene el panel los límites del contrato sin copiarlos a mano (el contrato vive en el repositorio del template)? Condiciona el plan de esta spec y de la 002.
- [NECESITA ACLARACIÓN] Lista exacta de secciones del panel donde se agregan los campos nuevos (¿"Mi negocio" para quiénes somos e inicio, "Servicios" para el ícono, "Catálogo" para moneda?).
