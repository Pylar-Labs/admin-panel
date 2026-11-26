// Spec 001 (RF-6, RF-9): la copia generada del contrato debe estar completa y al día con el template.
// Uso: npm run test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildContract, renderContract, buildVendor } from '../sync-contract.mjs'

// En Windows Git puede dejar los archivos con \r\n (core.autocrlf): el final de línea no cuenta para la frescura.
const lf = (text) => text.replace(/\r\n/g, '\n')
const SCHEMA = JSON.parse(readFileSync(new URL('../../../template-landing/docs/site.schema.json', import.meta.url), 'utf8'))
const GENERATED = new URL('../../src/lib/contract/contract.generated.ts', import.meta.url)

// Campos de texto sin tope de caracteres en el contrato (formato propio o enum): no se exige límite.
const NO_CHAR_LIMIT = new Set([
  'language', 'hero.ctaPrimary.href', 'hero.ctaSecondary.href', 'contact.whatsapp', 'contact.phone',
  'services[].icon', 'products[].id', 'products[].image', 'productGridConfig.currency',
])

// Recorre el esquema y devuelve la ruta de cada campo de texto (listas con `[]`).
function stringPaths(node, path = '') {
  if (node.type === 'string') return [path]
  if (node.type === 'array') return node.items.type === 'string' ? [`${path}[]`] : stringPaths(node.items, `${path}[]`)
  return Object.entries(node.properties ?? {}).flatMap(([k, v]) => stringPaths(v, path ? `${path}.${k}` : k))
}

test('todo campo de texto tiene límite extraído (o está en la lista de excepciones)', () => {
  const { limits } = buildContract()
  const missing = stringPaths(SCHEMA).filter((p) => !limits[p] && !NO_CHAR_LIMIT.has(p))
  assert.deepEqual(missing, [])
})

test('los límites conocidos del contrato salen con su valor', () => {
  const { limits } = buildContract()
  assert.deepEqual(limits['name'], { max: 80, singleLine: true })
  assert.deepEqual(limits['description'], { max: 500, singleLine: false })
  assert.deepEqual(limits['about.stats[].value'], { max: 10, singleLine: true })
  assert.deepEqual(limits['about.highlights[]'], { max: 40, singleLine: false })
  assert.deepEqual(limits['sections.contact.subtitle'], { max: 200, singleLine: true })
  assert.deepEqual(limits['testimonials[].role'], { max: 40, singleLine: false })
})

test('máximos de lista, íconos, idiomas, monedas y WhatsApp', () => {
  const c = buildContract()
  assert.deepEqual(c.maxItems, { 'about.stats': 3, 'about.highlights': 5, services: 8, testimonials: 9, products: 60 })
  assert.equal(c.icons.length, 11)
  assert.ok(c.icons.includes('ShoppingBag') && c.icons.includes('Facebook'))
  assert.deepEqual(c.languages, ['es', 'en', 'pt'])
  assert.deepEqual(c.currencies, ['ARS', 'USD', 'EUR', 'BRL', 'MXN', 'CLP', 'COP', 'PEN', 'UYU'])
  assert.deepEqual(c.whatsappDigits, { min: 8, max: 15 })
  assert.equal(c.version, '2.3')
})

test('la copia generada coincide con una regeneración en vivo', () => {
  assert.equal(lf(readFileSync(GENERATED, 'utf8')), renderContract(buildContract()))
})

// ── Spec 002 (RF-5, RF-14): validador copiado del template ──────────────────

const VENDOR_FILES = ['content/site.schema.ts', 'content/ui-text.ts', 'content/price-format.ts', 'lib/icons.ts']
const vendorUrl = (f) => new URL(`../../src/lib/contract/vendor/${f}`, import.meta.url)
const zodOf = (pkg) => JSON.parse(readFileSync(new URL(pkg, import.meta.url), 'utf8')).version

test('existen los cuatro archivos del validador copiado y ninguno importa astro/zod', () => {
  for (const f of VENDOR_FILES) {
    const text = readFileSync(vendorUrl(f), 'utf8')
    assert.match(text, /GENERADO/, `${f} sin marca de generado`)
    assert.doesNotMatch(text, /astro\/zod/, `${f} sigue importando astro/zod`)
  }
})

test('la copia del validador coincide con una regeneración en vivo', () => {
  const live = buildVendor()
  assert.deepEqual(Object.keys(live).sort(), [...VENDOR_FILES].sort())
  for (const f of VENDOR_FILES) assert.equal(lf(readFileSync(vendorUrl(f), 'utf8')), live[f], `${f} desactualizado: npm run contract:sync`)
})

test('la versión del contrato del validador copiado es la del template', () => {
  const schema = readFileSync(vendorUrl('content/site.schema.ts'), 'utf8')
  assert.equal(schema.match(/SCHEMA_VERSION = "([^"]+)"/)?.[1], buildContract().version)
})

test('zod del panel está fijado a la versión exacta de zod del template', () => {
  const pinned = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).dependencies.zod
  const templateZod = zodOf('../../../template-landing/node_modules/zod/package.json')
  assert.equal(pinned, templateZod, 'package.json debe fijar zod a la versión exacta del template')
  assert.equal(zodOf('../../node_modules/zod/package.json'), templateZod, 'zod instalado distinto del del template')
})
