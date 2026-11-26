// Spec 001 (RF-6, RF-9): la copia generada del contrato debe estar completa y al día con el template.
// Uso: npm run test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildContract, renderContract } from '../sync-contract.mjs'

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
  assert.equal(readFileSync(GENERATED, 'utf8'), renderContract(buildContract()))
})
