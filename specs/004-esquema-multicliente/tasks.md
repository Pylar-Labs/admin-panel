# Tareas 004 — Esquema multicliente (endurecimiento)
> Tareas pequeñas, ordenadas, verificables. Cada una referencia sus RF y termina con tests en verde.
> `[P]` = puede hacerse en paralelo. 🛑 = puerta: no se avanza sin tu aprobación explícita.
> Las pruebas viven en un solo archivo (`scripts/tests/aislamiento.test.mjs`), por eso van en serie.
> Revisado el 2026-11-23: PylarLabs ya tiene el esquema multicliente; la migración destructiva anterior (`20261123000000_esquema_multicliente.sql`) está obsoleta y NO se aplica. Las tareas hechas que siguen siendo válidas se conservan.

## Fase 0 — Preparación
- [x] T1 (RNF, prerrequisito de RF-12) — Poner la secret key de PylarLabs en `.env.local`. Verificado el 2026-11-23: la API de `eplnsjdvjawwijokoerk` responde 200 con ella, `.env.local` apunta a ese proyecto y git lo ignora.
- [x] T2 [P] (RF-11, RF-15) — Guardar en el scratchpad la línea base de PylarLabs (lectura del 2026-11-23): columnas de las cinco tablas, políticas de las cinco y del almacenamiento, permisos por rol, restricciones e índices, 0 filas y 0 archivos. Verifica: el archivo existe y coincide con la lectura.

## Fase 1 — Pruebas primero
- [x] T3 (RF-12) — Esqueleto de la prueba y script `test:db`: crea clientes A y B, un admin, un usuario sin sitio y un anónimo, con prefijo `test-`; limpieza garantizada. Verificado.
- [x] T4 (RF-1, RF-2, RF-3) — Pruebas de forma. Hoy en verde en PylarLabs (el esquema ya cumple).
- [x] T5 (RF-4, RF-5, RF-7) — Pruebas de aislamiento entre clientes. Hoy en verde.
- [x] T6 (RF-6, RF-14) — Pruebas sin sesión y del enlace de despliegue. Hoy en verde.
- [x] T7 (RF-8, RF-9) — Permisos de la configuración. Hoy en rojo (3): el cliente crea y borra su configuración y el admin no puede crearla.
- [x] T8 (RF-13) — Almacenamiento de imágenes, ya sobre el bucket `images`. Hoy en rojo (4 reales + 1 de montaje por reemplazo): sube y borra en carpeta ajena, anónimo lista, no se puede reemplazar.
- [x] T9 (RF-12) — Admin y suplantación. Hoy en rojo (7): no existe el admin.
- [x] T10 (RF-15) — Reformular la guarda: en lugar de comprobar que existen cuatro tablas de la landing (que no existen en PylarLabs), comprobar por la descripción de la API que las únicas tablas son las cinco del panel. Verifica: pasa hoy.
- [x] T11 (RF-12) — Ejecutar la suite completa en PylarLabs y comprobar que los rojos son exactamente los esperados de T7, T8 y T9 (14), que todo lo demás está en verde y que no queda ningún dato `test-`. Verifica: lista de rojos coincide con lo previsto.

## Fase 2 — Migración (solo archivo; todavía no se aplica)
- [x] T12 (RF-4, RF-8, RF-9, RF-14) — Escribir la parte de reglas de acceso de la migración incremental: quitar por nombre las cinco políticas actuales y crear las nuevas para `authenticated` (hijas: una política con admin; configuración: leer y actualizar su sitio o admin, crear y borrar solo admin). Verifica: relectura contra cada RF; ninguna política vieja sobrevive.
- [x] T13 (RF-16, RNF) — Escribir la parte de permisos e índices: revocar todo a `anon` y a `authenticated` y conceder solo select, insert, update y delete a `authenticated`; crear los cuatro índices por `site_id` con `if not exists`. Verifica: relectura contra RF-16.
- [x] T14 (RF-13) — Escribir la parte del almacenamiento: reemplazar las tres políticas abiertas del bucket `images` por las que exigen la carpeta `<site_id>/…` o ser admin, con permiso de actualizar y sin lectura pública del listado. Verifica: relectura contra RF-13.
- [x] T15 (RF-11, RF-15) — Revisión del archivo contigo. Lista de control: una sola transacción; idempotente (se puede aplicar dos veces); no crea ni borra tablas ni columnas; no toca datos; sin claves ni identificadores reales. Elimina el archivo obsoleto `20261123000000_esquema_multicliente.sql`. 🛑 **Aprobación explícita** de la migración antes de aplicarla.

## Fase 3 — Aplicar y verificar
- [x] T16 (RF-11) — Aplicar la migración a PylarLabs con el conector de Supabase (la aplico yo, tras tu aprobación de T15). Verifica: se ejecuta sin error; si falla, la transacción no cambia nada y te traigo el mensaje.
- [x] T17 (RF-2, RF-4, RF-13, RF-16) — Verificar por lectura: políticas de las cinco tablas y del almacenamiento, permisos por rol, índices, columnas y restricciones. Verifica: coinciden con el plan, no queda política antigua y los permisos de `anon` son ninguno.
- [x] T18 (RF-1 a RF-9, RF-12 a RF-15) — Ejecutar la suite hasta verla en verde. Si algo falla, se corrige la migración (vuelve a T15), nunca la prueba para que pase. Verifica: todas verdes.
- [x] T19 (RF-11, RF-12) — Aplicar la migración por segunda vez y ejecutar la suite otra vez. Verifica: sigue idempotente, en verde, y no quedan usuarios, filas ni archivos `test-`. *(Hecho el 2026-11-24: la migración se aplicó una segunda vez sin error; quedan 12 políticas, sin duplicados, 0 permisos para `anon`, 4 índices y 5 tablas; la suite pasó 91/91 y no quedan residuos. Dos corridas intermedias fallaron por cortes de red —`fetch failed`/`ECONNRESET`, no por las reglas— y la siguiente pasó entera.)*
- [x] T20 [P] (RF-2, RF-15) — Comparar tablas, columnas y restricciones con la línea base de T2. Verifica: idénticas salvo los cuatro índices nuevos.
- [x] T21 [P] (RNF) — `npm run lint` y comprobación de tipos. Verifica: el resultado no empeora respecto de hoy (los 14 errores de tipos previos son de la spec 003); se informa tal cual, sin tocar `src/**`.

## Fase 4 — Cierre
- [x] T22 — Verificación final contra los criterios de finalización de la spec: cada RF con su prueba en verde, aislamiento de dos clientes y sin sesión sobre tablas e imágenes, aprobación explícita del cambio, ninguna tabla ni columna borrada o añadida. Lo que no se haya podido verificar se dice.
- [x] T23 — Actualizar `MEMORY.md` (estado de la 004, siguiente paso: spec 003, y la lección de comprobar a qué proyecto apunta `.env.local`) y **proponerte** las reglas nuevas para `AGENTS.md` (claims `site_id` y `role`; bucket `images` con ruta `<site_id>/…`; cada tabla con `site_id` y RLS; el cliente no crea ni borra `site_config`). No cambio `AGENTS.md` sin tu OK.
