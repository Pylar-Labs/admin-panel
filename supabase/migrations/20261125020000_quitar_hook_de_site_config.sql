-- Spec 002 (paso B): se borra `site_config.vercel_deploy_hook`. El enlace de despliegue de cada sitio vive ahora en
-- `site_deploy` (solo de servidor); en `site_config` lo podía leer el propio cliente desde el navegador (RF-11).
-- ANTES de aplicarla: el paso A (20261125010000_site_deploy.sql) copió el enlace de cada sitio a `site_deploy`, y se
-- comprobó que nada en `src/`, `scripts/` ni las pruebas lee o escribe esta columna.
-- Idempotente (if exists). NO ES REVERSIBLE SIN PERDER EL DATO de esa columna: el valor que había queda solo en `site_deploy`.
--
-- REVERSA (manual; la columna vuelve vacía, hay que recargar los enlaces desde site_deploy si hiciera falta):
--   alter table public.site_config add column if not exists vercel_deploy_hook text;
--   update public.site_config c set vercel_deploy_hook = d.deploy_hook from public.site_deploy d where d.site_id = c.site_id;

alter table public.site_config drop column if exists vercel_deploy_hook;
