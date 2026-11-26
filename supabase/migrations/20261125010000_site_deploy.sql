-- Spec 002 (paso A): tabla `site_deploy`, solo de servidor. Guarda por sitio la versión publicada, el estado de la
-- publicación y los datos de entrega (repositorio de la web, proyecto de Vercel, enlace de despliegue).
-- ADITIVA e idempotente: no borra ni cambia nada existente. El enlace de `site_config.vercel_deploy_hook` se COPIA aquí
-- y la columna original se queda (se borra en el paso B, con su propia aprobación).
--
-- Seguridad: RLS activada SIN políticas y permisos revocados a anon y authenticated. El navegador no puede leer ni
-- escribir esta tabla (RF-11, RF-13); solo la clave de servidor, desde código `server-only`.
--
-- REVERSA (manual; borra la versión publicada y los datos de entrega cargados):
--   drop table if exists public.site_deploy;

create table if not exists public.site_deploy (
  site_id                  text primary key references public.site_config (site_id) on delete cascade,
  deploy_hook              text,
  github_repo              text,                       -- «propietario/nombre» del repositorio de la web
  github_branch            text not null default 'main',
  vercel_project_id        text,
  status                   text not null default 'idle'
                             check (status in ('idle', 'publishing', 'saved', 'published', 'deploy_failed')),
  locked_at                timestamptz,                -- inicio de la publicación en curso (se libera a los 10 minutos)
  started_at               timestamptz,                -- inicio de la última publicación (para ubicar su despliegue)
  published_data           jsonb,                      -- el archivo de datos de la última versión guardada
  published_schema_version text,
  published_at             timestamptz,
  published_by             uuid,
  last_commit_sha          text,
  last_message             text,
  updated_at               timestamptz not null default now()
);

alter table public.site_deploy enable row level security;

revoke all on table public.site_deploy from anon;
revoke all on table public.site_deploy from authenticated;

-- Una fila por cada sitio que ya existe, con el enlace de despliegue copiado (los sitios nuevos reciben su fila
-- desde el servidor la primera vez que publican).
insert into public.site_deploy (site_id, deploy_hook)
select site_id, vercel_deploy_hook from public.site_config
on conflict (site_id) do nothing;
