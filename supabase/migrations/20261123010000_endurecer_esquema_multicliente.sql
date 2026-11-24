-- Spec 004 — Endurecer el esquema multicliente (PylarLabs)
-- ============================================================================
-- Incremental e idempotente: NO crea ni borra tablas ni columnas y no toca datos.
-- Se puede aplicar más de una vez con el mismo resultado.
--
-- Identidad: el sitio del usuario sale de app_metadata.site_id y el rol de admin
-- de app_metadata.role = 'admin'. Nunca de user_metadata (el usuario lo edita).
-- Si el token no trae site_id, la comparación da NULL y deniega.
--
-- Qué cambia:
--   1. Políticas de las cinco tablas: se reemplazan las actuales (una «ALL» por
--      tabla para el rol public) por reglas para authenticated con excepción de
--      admin; solo el admin crea y borra la configuración del sitio.
--   2. Permisos de rol: anon sin nada; authenticated solo select/insert/update/delete.
--   3. Índices por site_id en las cuatro tablas hijas.
--   4. Almacenamiento (bucket `images`): una carpeta por sitio (<site_id>/archivo).
-- ============================================================================

begin;

-- ── 1. Políticas de las cinco tablas ────────────────────────────────────────
-- Las políticas se suman entre sí: por eso se quitan las actuales (y las nuevas,
-- para poder repetir la migración) antes de crear las definitivas.

drop policy if exists "Users see own site_config"  on public.site_config;
drop policy if exists "Users see own gallery"      on public.gallery;
drop policy if exists "Users see own services"     on public.services;
drop policy if exists "Users see own products"     on public.products;
drop policy if exists "Users see own testimonials" on public.testimonials;

drop policy if exists site_config_select  on public.site_config;
drop policy if exists site_config_update  on public.site_config;
drop policy if exists site_config_insert  on public.site_config;
drop policy if exists site_config_delete  on public.site_config;
drop policy if exists gallery_all         on public.gallery;
drop policy if exists services_all        on public.services;
drop policy if exists products_all        on public.products;
drop policy if exists testimonials_all    on public.testimonials;

-- Hijas: el cliente alcanza solo las filas de su sitio; el admin, todas.
-- El with check impide guardar a nombre de otro sitio o mover una fila.
create policy gallery_all on public.gallery
  for all to authenticated
  using (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy services_all on public.services
  for all to authenticated
  using (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy products_all on public.products
  for all to authenticated
  using (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy testimonials_all on public.testimonials
  for all to authenticated
  using (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Configuración: el cliente lee y edita la suya; solo el admin crea y borra.
create policy site_config_select on public.site_config
  for select to authenticated
  using (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy site_config_update on public.site_config
  for update to authenticated
  using (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    site_id = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy site_config_insert on public.site_config
  for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy site_config_delete on public.site_config
  for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Sin políticas para anon: con RLS activa, un visitante sin sesión no ve ni escribe nada.

-- ── 2. Permisos de rol ──────────────────────────────────────────────────────
-- La RLS no frena TRUNCATE, REFERENCES ni TRIGGER: se revocan explícitamente.

revoke all on table public.site_config, public.gallery, public.services, public.products, public.testimonials from anon;
revoke all on table public.site_config, public.gallery, public.services, public.products, public.testimonials from authenticated;
grant select, insert, update, delete on table public.site_config, public.gallery, public.services, public.products, public.testimonials to authenticated;

-- ── 3. Índices por site_id (todas las reglas filtran por él) ────────────────

create index if not exists gallery_site_id_idx      on public.gallery (site_id);
create index if not exists services_site_id_idx     on public.services (site_id);
create index if not exists products_site_id_idx     on public.products (site_id);
create index if not exists testimonials_site_id_idx on public.testimonials (site_id);

-- ── 4. Almacenamiento de imágenes (bucket images) ───────────────────────────
-- El bucket sigue siendo público: las imágenes se ven por su URL pública y no
-- pasan por RLS. Aquí solo se controla quién sube, cambia, lista y borra.
-- Convención de ruta: <site_id>/archivo.png

drop policy if exists "Authenticated users can delete images" on storage.objects;
drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Public read access"                    on storage.objects;

drop policy if exists "images_select" on storage.objects;
drop policy if exists "images_insert" on storage.objects;
drop policy if exists "images_update" on storage.objects;
drop policy if exists "images_delete" on storage.objects;

-- La lectura para autenticados es necesaria para que subir con reemplazo (upsert) funcione.
create policy "images_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'images'
  and (
    (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
);

create policy "images_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'images'
  and (
    (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
);

create policy "images_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'images'
  and (
    (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
)
with check (
  bucket_id = 'images'
  and (
    (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
);

create policy "images_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'images'
  and (
    (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'site_id')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
);

commit;
