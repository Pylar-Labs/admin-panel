-- Spec 001: campos del contrato (v2.3) en el panel. SOLO CAMBIOS ADITIVOS: no se borra ni se cambia ningún dato existente (RF-11).
-- Idempotente. Las políticas RLS y los permisos son por tabla (spec 004): las columnas nuevas los heredan, no se tocan.
-- `products.price_visible` queda sin uso y NO se borra.
--
-- REVERSA (manual, solo si hiciera falta; borra lo que el cliente haya cargado en esos campos):
--   drop index if exists public.products_site_id_slug_key;
--   alter table public.products drop column if exists slug;
--   alter table public.testimonials drop column if exists role;
--   alter table public.site_config
--     drop column if exists language, drop column if exists about_title, drop column if exists about_body,
--     drop column if exists about_stats, drop column if exists about_highlights,
--     drop column if exists hero_cta_primary_label, drop column if exists hero_cta_primary_href,
--     drop column if exists hero_cta_secondary_label, drop column if exists hero_cta_secondary_href,
--     drop column if exists currency, drop column if exists show_prices, drop column if exists group_by_category,
--     drop column if exists product_cta_label, drop column if exists section_titles;

alter table public.site_config
  add column if not exists language text not null default 'es',
  add column if not exists about_title text,
  add column if not exists about_body text,
  add column if not exists about_stats jsonb not null default '[]'::jsonb,
  add column if not exists about_highlights jsonb not null default '[]'::jsonb,
  add column if not exists hero_cta_primary_label text,
  add column if not exists hero_cta_primary_href text,
  add column if not exists hero_cta_secondary_label text,
  add column if not exists hero_cta_secondary_href text,
  add column if not exists currency text not null default 'ARS',
  add column if not exists show_prices boolean not null default true,
  add column if not exists group_by_category boolean not null default false,
  add column if not exists product_cta_label text,
  add column if not exists section_titles jsonb not null default '{}'::jsonb;

alter table public.testimonials
  add column if not exists role text;

alter table public.products
  add column if not exists slug text;

-- Relleno del identificador de los productos que ya existen (solo los que no lo tienen):
-- nombre sin tildes ni símbolos; repetido o vacío → sufijo numérico / `producto-N`. Máximo 60 caracteres.
with base as (
  select id, site_id,
         left(trim(both '-' from regexp_replace(
           translate(lower(coalesce(name, '')), 'áéíóúüñàèìòùâêîôûãõç', 'aeiouunaeiouaeiouaoc'),
           '[^a-z0-9]+', '-', 'g')), 50) as stem,
         "order"
  from public.products
  where slug is null
), ranked as (
  select id, site_id, stem,
         row_number() over (partition by site_id, stem order by "order" nulls last, id) as n
  from base
)
update public.products p
set slug = case
  when r.stem = '' then 'producto-' || r.n
  when r.n = 1 then r.stem
  else r.stem || '-' || r.n
end
from ranked r
where p.id = r.id;

-- Choques que queden (p. ej. un producto llamado «Mate 2» y dos llamados «Mate»): se desambiguan con parte del id.
update public.products p
set slug = left(p.slug, 50) || '-' || left(replace(p.id::text, '-', ''), 8)
where exists (
  select 1 from public.products q
  where q.site_id = p.site_id and q.slug = p.slug and q.id <> p.id and q.id::text < p.id::text
);

-- El índice único va al final, cuando ya no hay repetidos. Los productos nuevos reciben su `slug` desde el panel.
create unique index if not exists products_site_id_slug_key on public.products (site_id, slug);
