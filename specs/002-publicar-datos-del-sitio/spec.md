# Spec 002 — Publicar los datos del sitio
> Solo el QUÉ y el POR QUÉ. Nada de stack, arquitectura ni nombres de archivos (eso va en plan.md).
> Segunda de dos specs. Depende de la 001 (`001-campos-del-contrato-en-el-panel`): sin esos campos el contrato no se puede cumplir.

## Contexto y objetivo
Hoy "publicar" solo dispara un despliegue desde el navegador; la web del cliente no recibe los datos que el cliente cargó en el panel. La web solo acepta datos que cumplen el contrato del template (versión 2.3). Esta spec hace que, al publicar, lo cargado en el panel se convierta en un archivo de datos válido que la web de ese cliente usa al construirse; si no es válido, no se publica nada y el cliente sabe qué corregir y dónde.

## Usuarios / actores
- **Cliente final**: publica los datos de SU web; puede haber varios usuarios por sitio y todos pueden publicar. Hay un solo sitio por cliente.
- **Web del cliente (template)**: usa la última versión publicada al construirse; rechaza lo que no cumple el contrato.
- **Equipo de la agencia**: mantiene el panel y el contrato y necesita que no se desincronicen.

## Historias de usuario
- H1: Como cliente quiero publicar mis cambios y que mi web se actualice sin depender de la agencia.
- H2: Como cliente quiero ver, si algo no cumple, la lista completa de problemas en español y en qué sección del panel corregirlos.
- H3: Como cliente quiero que, si algo falla a mitad, no se pierda lo cargado y pueda reintentar.
- H4: Como equipo de la agencia quiero que el panel valide con las mismas reglas que el template y bloquee si sus versiones no coinciden.

## Requisitos funcionales (criterios de aceptación en EARS)
- RF-1: CUANDO el cliente publica, EL SISTEMA arma con lo último guardado de SU sitio el archivo de datos del template, lo valida contra el contrato y, solo si es válido, lo guarda como la versión publicada del sitio.
- RF-2: SI los datos no cumplen el contrato, ENTONCES EL SISTEMA no publica nada, la web ya publicada no cambia y se muestra la lista completa de errores en español (todos a la vez, sin tope), cada uno con la sección del panel y el campo donde corregirlo; los errores que nacen de una regla entre campos se muestran ligados a todos los campos implicados.
- RF-3: EL SISTEMA no corrige, recorta ni completa ningún dato inválido; excluir los elementos inactivos y ordenar según el orden del cliente no cuentan como corregir.
- RF-4: EL SISTEMA excluye del archivo los elementos inactivos, ordena los demás según el orden del cliente (los repetidos o ausentes se desempatan de forma estable) y no incluye los datos que el contrato no admite.
- RF-5: EL SISTEMA valida con las mismas reglas que el template, sin una copia manual de ellas, y declara contra qué versión del contrato valida.
- RF-6: SI la versión del contrato del template no es exactamente la del panel, ENTONCES EL SISTEMA bloquea la publicación con un mensaje que indique ambas versiones.
- RF-7: MIENTRAS hay una publicación en curso de un sitio, EL SISTEMA muestra su estado a todos los usuarios de ese sitio y no permite lanzar otra; una publicación sin terminar se libera a los 10 minutos.
- RF-8: EL SISTEMA publica siempre lo último guardado, nunca lo que está sin guardar en pantalla, y publicar dos veces los mismos datos es válido.
- RF-9: CUANDO la versión publicada se guardó pero el disparo del despliegue o la construcción de la web fallan, EL SISTEMA informa «datos guardados, la web aún no se actualizó», no la presenta como publicada y ofrece reintentar sin volver a validar; SI no se pudo guardar la versión publicada, ENTONCES nada cambió.
- RF-10: EL SISTEMA solo presenta un sitio como publicado cuando la web confirma que se construyó con esa versión.
- RF-11: EL SISTEMA dispara el despliegue desde el servidor; ninguna clave ni hook de despliegue se expone en el navegador.
- RF-12: CUANDO el cliente abre una sección del panel, EL SISTEMA muestra los problemas de sus datos ya guardados respecto del contrato; la lista completa se da al publicar.
- RF-13: EL SISTEMA solo arma, valida, guarda y publica los datos del sitio del cliente autenticado; una prueba demuestra que otro cliente no puede publicar ni leer la versión publicada de un sitio ajeno.
- RF-14: EL SISTEMA no cambia el contrato, su versión ni el template, salvo que este reciba la versión publicada al construirse (ver duda abierta).

## Requisitos no funcionales
- Aislamiento entre clientes (principio 3) y secretos fuera del cliente (principio 4).
- Mensajes de error y de estado en español.
- Todos los errores juntos en un solo intento.
- Las reglas del contrato y su versión salen de una única fuente: el template.

## Casos límite
- Datos ya guardados que superan límites actuales (8 servicios, 9 testimonios, 60 productos, 3 cifras, 5 destacados) y los máximos exactos.
- Listas vacías (equivalen a ausentes), salvo servicios (mínimo 1); lista cuyos elementos están todos inactivos.
- Contacto sin email ni teléfono; WhatsApp con símbolos o espacios; textos con saltos de línea o solo espacios; emojis.
- Producto con imagen faltante o URL no http(s), precio faltante con precios visibles, categorías que difieren solo en mayúsculas o más de 12, decimales en monedas sin decimales.
- Testimonio sin valoración o fuera de 1 a 5.
- Botón con destino a una sección que no existe con esos datos.
- Sitio sin configuración, usuario sin sitio, sesión vencida durante la publicación, dos pestañas o dos usuarios publicando a la vez, cambio guardado mientras otro publica.
- El despliegue se dispara pero el build falla por una causa ajena al contrato.

## Fuera de alcance
- Campos nuevos del panel (spec 001) y cambios de contrato o admitir más datos en la web.
- Vista previa o descarga del archivo; historial de publicaciones, deshacer o volver a una versión anterior.
- Alta de clientes, gestión de usuarios y auditoría completa de políticas de acceso (solo lo que esta spec toca).
- Traducción del panel.

## Criterios de finalización
- Cada RF con su prueba (automática donde sea posible, manual documentada donde no) en verde.
- Con datos válidos de un sitio de prueba, el archivo producido lo acepta el validador del template sin errores.
- Con datos inválidos (al menos un caso por cada código de error del contrato), no se publica nada y se muestran todos los errores a la vez.
- Prueba de aislamiento entre dos clientes sobre la versión publicada.
- `npm run lint` y `npm run build` sin errores; revisión en el navegador (escritorio y 375 px, consola sin errores).

## Dudas abiertas
- [NECESITA ACLARACIÓN] La web construye con la versión publicada: ¿qué cambia en el template para leerla (está fuera del repositorio del panel y RF-14 pide no tocar su contrato)? Requiere decidirlo con el template antes del plan.
- [NECESITA ACLARACIÓN] ¿Cómo confirma la web que se construyó con esa versión (RF-10)?
- [NECESITA ACLARACIÓN] ¿Cómo accede el panel a las reglas y la versión del contrato sin copiarlas (misma duda que la spec 001)?
- [NECESITA ACLARACIÓN] ¿El `vercel_deploy_hook` guardado en cada sitio sigue siendo la forma de disparar el despliegue, y dónde se guarda para que no llegue al navegador?
