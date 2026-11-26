// Spec 002 (RF-2, RF-12): cada error del contrato se liga a la sección y el campo del panel donde se corrige.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { locateErrors, errorsForSection } from '../../src/lib/publish/locate-errors.ts'
import { buildSiteData } from '../../src/lib/publish/build-site-data.ts'
import { validateSite } from '../../src/lib/contract/vendor/content/site.schema.ts'

const err = (path, code, extra = {}) => ({ path, code, message: `msg ${path}`, ...extra })
const prod = (id, extra = {}) => ({ id, name: `Producto ${id}`, description: 'd', image: 'https://x/p.png', price: 10, ...extra })
const src = (table, ids) => Object.fromEntries(ids.map((id, i) => [`${table}[${i}]`, { table, id: `row-${id}` }]))
const where = (located, i = 0) => located[i].locations.map((l) => `${l.section}:${l.field}${l.item ? `:${l.item}` : ''}`)

test('un error de un elemento de lista dice sección, campo y nombre del elemento', () => {
  const data = { products: [prod('a', { name: 'Mate' })] }
  const [e] = locateErrors([err('products[0].price', 'price_not_positive')], data, src('products', ['a']))
  assert.deepEqual(e.locations, [{ section: 'catalogo', field: 'Precio', item: 'Mate', source: { table: 'products', id: 'row-a' } }])
  assert.equal(e.code, 'price_not_positive')
  assert.equal(e.message, 'msg products[0].price')
})

test('campos sueltos de cada sección del panel', () => {
  const data = { services: [{ title: 'Corte' }], testimonials: [{ name: 'Ana' }] }
  const located = locateErrors(
    [err('name', 'empty'), err('language', 'unknown_language'), err('hero.headline', 'too_long'), err('about.stats[1].value', 'too_long'),
      err('social.instagram', 'invalid_url'), err('services[0].icon', 'unknown_icon'), err('testimonials[0].rating', 'invalid_rating'),
      err('productGridConfig.currency', 'unknown_currency'), err('sections.contact.title', 'too_long')],
    data, { ...src('services', ['s']), ...src('testimonials', ['t']) }
  )
  assert.deepEqual(located.map((l) => `${l.locations[0].section}:${l.locations[0].field}`), [
    'negocio:Nombre del negocio', 'negocio:Idioma de la web', 'negocio:Título principal', 'negocio:Cifras de «Quiénes somos»',
    'redes:Instagram', 'servicios:Ícono', 'testimonios:Estrellas', 'catalogo:Ajustes del catálogo', 'negocio:Títulos de las secciones',
  ])
  assert.equal(located[5].locations[0].item, 'Corte')
  assert.equal(located[6].locations[0].item, 'Ana')
})

test('contacto sin email ni teléfono se liga a los dos campos', () => {
  const [e] = locateErrors([err('contact', 'missing_contact_method')], {}, {})
  assert.deepEqual(where([e]), ['negocio:Email de contacto', 'negocio:Teléfono'])
})

test('identificador repetido se liga a todos los productos que lo comparten', () => {
  const data = { products: [prod('igual', { name: 'Uno' }), prod('otro', { name: 'Dos' }), prod('igual', { name: 'Tres' })] }
  const [e] = locateErrors([err('products[2].id', 'duplicate_id')], data, src('products', ['a', 'b', 'c']))
  assert.deepEqual(where([e]), ['catalogo:Identificador:Uno', 'catalogo:Identificador:Tres'])
})

test('categorías inconsistentes: todos los productos de esa categoría', () => {
  const data = { products: [prod('a', { name: 'Uno', category: 'Ropa' }), prod('b', { name: 'Dos', category: 'Hogar' }), prod('c', { name: 'Tres', category: 'ropa ' })] }
  const [e] = locateErrors([err('products[2].category', 'inconsistent_category')], data, src('products', ['a', 'b', 'c']))
  assert.deepEqual(where([e]), ['catalogo:Categoría:Uno', 'catalogo:Categoría:Tres'])
})

test('más de 12 categorías: el campo categoría de todos los productos con categoría', () => {
  const data = { products: Array.from({ length: 13 }, (_, i) => prod(`p${i}`, { category: `C${i}` })).concat(prod('sin')) }
  const [e] = locateErrors([err('products', 'too_many_categories')], data, src('products', data.products.map((p) => p.id)))
  assert.equal(e.locations.length, 13)
  assert.ok(e.locations.every((l) => l.section === 'catalogo' && l.field === 'Categoría'))
})

test('botón a una sección que no existirá: el botón y la sección que falta', () => {
  const [e] = locateErrors([err('hero.ctaPrimary.href', 'unknown_anchor')], { hero: { ctaPrimary: { href: '#productos' } } }, {})
  assert.deepEqual(where([e]), ['negocio:Botón principal', 'catalogo:Productos'])
  const [t] = locateErrors([err('hero.ctaSecondary.href', 'unknown_anchor')], { hero: { ctaSecondary: { href: '#testimonios' } } }, {})
  assert.deepEqual(where([t]), ['negocio:Botón secundario', 'testimonios:Testimonios'])
})

test('lista completa mal (mínimo de servicios) y ruta desconocida no rompen', () => {
  const located = locateErrors([err('services', 'too_few'), err('algo.raro', 'invalid_value')], {}, {})
  assert.deepEqual(where(located, 0), ['servicios:Lista de servicios'])
  assert.equal(located[1].locations.length, 1)
})

test('RF-12: se filtra por sección y un error con varias ubicaciones aparece en todas', () => {
  const data = { hero: { ctaPrimary: { href: '#productos' } } }
  const located = locateErrors([err('hero.ctaPrimary.href', 'unknown_anchor'), err('name', 'empty')], data, {})
  assert.deepEqual(errorsForSection(located, 'negocio').map((e) => e.path), ['hero.ctaPrimary.href', 'name'])
  assert.deepEqual(errorsForSection(located, 'catalogo').map((e) => e.path), ['hero.ctaPrimary.href'])
  assert.deepEqual(errorsForSection(located, 'servicios'), [])
})

test('de punta a punta: datos rotos armados desde el panel quedan todos ubicados', () => {
  const config = { site_id: 's', language: 'fr', business_name: '', whatsapp: 'abc', hero_title: 'T', hero_subtitle: 'S', about_title: 'A', about_body: 'B', about_stats: [], about_highlights: [], currency: 'ARS', show_prices: true, group_by_category: false, section_titles: {}, hero_cta_primary_label: 'Ir', hero_cta_primary_href: '#productos' }
  const products = [{ id: 'p1', site_id: 's', name: 'Mate', description: 'd', price: 0, image_url: 'no-url', order: 1, active: true, slug: 'mate' }]
  const { data, sources } = buildSiteData({ config, services: [{ id: 'v1', site_id: 's', title: 'Corte', description: 'd', icon: 'Heart', order: 1, active: true }], products: [], testimonials: [] })
  const report = validateSite(data)
  const located = locateErrors(report.errors, data, sources)
  assert.equal(located.length, report.errors.length)
  assert.ok(located.every((l) => l.locations.length >= 1 && l.locations.every((x) => x.section && x.field)))
  assert.ok(located.some((l) => l.code === 'unknown_anchor' && l.locations.some((x) => x.section === 'catalogo')))
  void products
})
