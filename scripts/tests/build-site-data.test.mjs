// Spec 002 (RF-3, RF-4): lo guardado en el panel se convierte en el archivo de datos del contrato, sin corregir nada.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSiteData } from '../../src/lib/publish/build-site-data.ts'
import { validateSite } from '../../src/lib/contract/vendor/content/site.schema.ts'

const config = (extra = {}) => ({
  site_id: 's', business_name: 'Negocio', tagline: 'Lema', description: 'Desc', language: 'es',
  phone: '+54 11 1234-5678', whatsapp: '5491112345678', email: 'a@b.com', address: 'Calle 1',
  instagram: 'https://instagram.com/x', facebook: null,
  hours: { lunes: '9 a 18' }, map_embed_url: 'https://maps.example/x', logo_url: 'https://x/l.png', hero_image_url: 'https://x/h.png',
  hero_title: 'Titular', hero_subtitle: 'Subtítulo',
  hero_cta_primary_label: 'Contactanos', hero_cta_primary_href: '#contacto', hero_cta_secondary_label: '', hero_cta_secondary_href: '',
  about_title: 'Quiénes somos', about_body: 'Texto', about_stats: [{ value: '+1', label: 'año' }], about_highlights: ['Uno'],
  currency: 'ARS', show_prices: true, group_by_category: false, product_cta_label: '', section_titles: {},
  ...extra,
})
const service = (id, order, extra = {}) => ({ id, site_id: 's', title: `S ${id}`, description: 'd', icon: 'Star', order, active: true, ...extra })
const product = (id, order, extra = {}) => ({ id, site_id: 's', name: `P ${id}`, description: 'd', price: 10, price_visible: true, category: null, image_url: 'https://x/p.png', whatsapp_message: 'hola', order, active: true, slug: `p-${id}`, ...extra })
const testimonial = (id, order, extra = {}) => ({ id, site_id: 's', author_name: `T ${id}`, role: null, text: 'Bien', rating: 5, order, active: true, ...extra })
const rows = (extra = {}) => ({ config: config(), services: [service('a', 1)], products: [], testimonials: [], ...extra })
const build = (extra) => buildSiteData(rows(extra))

test('arma el archivo con los nombres del contrato y es válido', () => {
  const { data } = build({ products: [product('a', 1, { category: 'Ropa' })], testimonials: [testimonial('a', 1, { role: 'Cliente' })] })
  assert.equal(data.name, 'Negocio')
  assert.deepEqual(data.hero.ctaPrimary, { label: 'Contactanos', href: '#contacto' })
  assert.equal(data.hero.headline, 'Titular')
  assert.deepEqual(data.about.stats, [{ value: '+1', label: 'año' }])
  assert.deepEqual(data.contact, { whatsapp: '5491112345678', email: 'a@b.com', phone: '+54 11 1234-5678', address: 'Calle 1' })
  assert.deepEqual(data.social, { instagram: 'https://instagram.com/x' })
  assert.deepEqual(data.products[0], { id: 'p-a', name: 'P a', description: 'd', image: 'https://x/p.png', price: 10, category: 'Ropa' })
  assert.deepEqual(data.testimonials[0], { name: 'T a', role: 'Cliente', text: 'Bien', rating: 5 })
  assert.deepEqual(data.productGridConfig, { showPrice: true, currency: 'ARS', groupByCategory: false })
  assert.deepEqual(validateSite(data).errors, [])
})

test('no incluye lo que el contrato no admite', () => {
  const { data } = build({ products: [product('a', 1)] })
  assert.deepEqual(Object.keys(data).sort(), ['about', 'contact', 'description', 'hero', 'language', 'name', 'productGridConfig', 'products', 'services', 'social', 'tagline'])
  const text = JSON.stringify(data)
  for (const leaked of ['lunes', 'maps.example', 'l.png', 'h.png', 'price_visible', 'whatsapp_message', 'hola']) assert.ok(!text.includes(leaked), `se coló ${leaked}`)
})

test('RF-4: los elementos inactivos quedan fuera', () => {
  const { data } = build({ services: [service('a', 1), service('b', 2, { active: false })], products: [product('a', 1, { active: false })] })
  assert.deepEqual(data.services.map((s) => s.title), ['S a'])
  assert.equal(data.products, undefined)
})

test('RF-4: ordena por `order`; repetidos y ausentes se desempatan por id, de forma estable', () => {
  const services = [service('d', null), service('c', 1), service('b', 1), service('a', 2), service('e', undefined)]
  const { data } = build({ services })
  assert.deepEqual(data.services.map((s) => s.title), ['S b', 'S c', 'S a', 'S d', 'S e'])
  assert.deepEqual(build({ services: [...services].reverse() }).data.services.map((s) => s.title), data.services.map((s) => s.title))
})

test('el mapa de origen liga cada elemento del archivo con su fila', () => {
  const { sources } = build({ services: [service('b', 2), service('a', 1)], products: [product('x', 1), product('y', 2, { active: false }), product('z', 3)] })
  assert.deepEqual(sources['services[0]'], { table: 'services', id: 'a' })
  assert.deepEqual(sources['services[1]'], { table: 'services', id: 'b' })
  assert.deepEqual(sources['products[1]'], { table: 'products', id: 'z' })
})

test('null y vacío son ausentes; el texto de solo espacios se envía tal cual', () => {
  const { data } = build({ config: config({ tagline: '', address: null, email: null, hero_cta_secondary_label: '', about_stats: [], about_highlights: [], business_name: '   ' }) })
  assert.equal(data.tagline, undefined)
  assert.equal(data.contact.address, undefined)
  assert.equal(data.contact.email, undefined)
  assert.equal(data.hero.ctaSecondary, undefined)
  assert.equal(data.about.stats, undefined)
  assert.equal(data.about.highlights, undefined)
  assert.equal(data.name, '   ')
})

test('un botón a medias se envía a medias (el validador dirá qué falta)', () => {
  const { data } = build({ config: config({ hero_cta_primary_label: 'Hola', hero_cta_primary_href: '', hero_cta_secondary_label: 'Ver', hero_cta_secondary_href: '' }) })
  assert.deepEqual(data.hero.ctaPrimary, { label: 'Hola' })
  assert.deepEqual(data.hero.ctaSecondary, { label: 'Ver' })
})

test('títulos de sección, texto del botón de consulta y categorías', () => {
  const { data } = build({ config: config({ product_cta_label: 'Preguntar', section_titles: { services: { title: 'Lo que hacemos' }, contact: { subtitle: 'Escribinos' } } }) })
  assert.deepEqual(data.sections, { services: { title: 'Lo que hacemos' }, contact: { subtitle: 'Escribinos' } })
  assert.equal(data.productGridConfig.ctaLabel, 'Preguntar')
})

test('RF-3: un dato inválido llega igual al validador, sin recortar ni completar', () => {
  const long = 'x'.repeat(81)
  const { data } = build({
    config: config({ business_name: long, hero_cta_primary_label: '', hero_cta_primary_href: '' }),
    services: Array.from({ length: 9 }, (_, i) => service(`s${i}`, i, { icon: 'Heart' })),
    testimonials: [testimonial('a', 1, { rating: 6 })],
    products: [product('a', 1, { price: 10.55555, slug: 'Mal Id' })],
  })
  assert.equal(data.name, long)
  assert.equal(data.services.length, 9)
  assert.equal(data.services[0].icon, 'Heart')
  assert.equal(data.testimonials[0].rating, 6)
  assert.equal(data.products[0].price, 10.55555)
  assert.equal(data.products[0].id, 'Mal Id')
  assert.equal(data.hero.ctaPrimary, undefined)
  const codes = validateSite(data).errors.map((e) => e.code)
  for (const c of ['too_long', 'too_many', 'unknown_icon', 'invalid_rating', 'price_too_many_decimals', 'invalid_id', 'required']) assert.ok(codes.includes(c), `falta ${c}`)
})
