-- LÍNEA BASE del esquema, para crear una base de datos NUEVA (p. ej. la de producción real el día que se pase a producción).
-- NO se aplica en PylarLabs: esa base ya existe (es la de desarrollo y pruebas).
-- Reproduce el estado de PylarLabs ANTERIOR a la spec 004: las cinco tablas se crearon fuera de las migraciones, y esas
-- migraciones son incrementales. Orden para armar una base nueva:
--   1. este archivo
--   2. supabase/migrations/20261123010000_endurecer_esquema_multicliente.sql   (spec 004: políticas, permisos, índices)
--   3. supabase/migrations/20261124010000_campos_del_contrato.sql              (spec 001)
--   4. supabase/migrations/20261125010000_site_deploy.sql                      (spec 002, paso A)
--   5. supabase/migrations/20261125020000_quitar_hook_de_site_config.sql       (spec 002, paso B)
-- y las migraciones nuevas que haya, en orden de fecha. Después, `npm run test:db` apuntando a esa base nueva debe dar todo en
-- verde: esa suite fija las columnas exactas de cada tabla y el comportamiento de las políticas, así que detecta cualquier
-- diferencia con PylarLabs. Idempotente (if not exists / on conflict). Extraído de PylarLabs el 2026-11-26 (columnas,
-- restricciones y bucket). SIN PROBAR todavía contra una base vacía: se prueba al crear la de producción.

create table if not exists public.site_config (
  id                 uuid primary key default gen_random_uuid(),
  site_id            text not null unique,
  business_name      text,
  tagline            text,
  description        text,
  phone              text,
  whatsapp           text,
  email              text,
  address            text,
  hours              jsonb default '{}'::jsonb,
  instagram          text,
  facebook           text,
  logo_url           text,
  hero_image_url     text,
  hero_title         text,
  hero_subtitle      text,
  map_embed_url      text,
  vercel_deploy_hook text,            -- se borra en el paso 5
  active             boolean default true,
  created_at         timestamptz default now()
);

create table if not exists public.gallery (
  id        uuid primary key default gen_random_uuid(),
  site_id   text not null references public.site_config (site_id) on delete cascade,
  image_url text,
  caption   text,
  "order"   integer default 0,
  active    boolean default true
);

create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  site_id     text not null references public.site_config (site_id) on delete cascade,
  title       text,
  description text,
  icon        text,
  "order"     integer default 0,
  active      boolean default true
);

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  site_id          text not null references public.site_config (site_id) on delete cascade,
  name             text,
  description      text,
  price            numeric,
  price_visible    boolean default true,
  category         text,
  image_url        text,
  whatsapp_message text,
  "order"          integer default 0,
  active           boolean default true
);

create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  site_id     text not null references public.site_config (site_id) on delete cascade,
  author_name text,
  text        text,
  rating      integer default 5,
  "order"     integer default 0,
  active      boolean default true
);

-- La spec 004 reemplaza las políticas pero NO activa la RLS: ya venía activa en producción.
alter table public.site_config  enable row level security;
alter table public.gallery      enable row level security;
alter table public.services     enable row level security;
alter table public.products     enable row level security;
alter table public.testimonials enable row level security;

-- Bucket de imágenes (las políticas de storage las crea la migración de la 004).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
