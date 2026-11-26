// Spec 002 (RF-2, RF-5): el validador copiado del template acepta lo mismo y rechaza lo mismo que el original,
// con un caso inválido por cada código de error del contrato y todos los errores a la vez.
// Uso: npm run test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ERROR_CODES, validateSite } from '../../src/lib/contract/vendor/content/site.schema.ts'

const TEMPLATE = fileURLToPath(new URL('../../../template-landing/', import.meta.url))
const fixture = (name) => JSON.parse(readFileSync(join(TEMPLATE, 'scripts/fixtures', name), 'utf8'))
const MIN = () => fixture('site.min.json')
const MAX = () => fixture('site.max.json')
const codesOf = (data) => validateSite(data).errors.map((e) => e.code)

const prod = (i, extra = {}) => ({ id: `p-${i}`, name: `Producto ${i}`, description: 'd', image: 'https://example.com/a.png', price: 10, ...extra })
const withProducts = (products, grid) => (d) => { d.products = products; if (grid) d.productGridConfig = grid }

// Un caso inválido por código: `mutate` estropea un archivo mínimo válido.
const CASES = {
  required: (d) => { delete d.name },
  invalid_type: (d) => { d.name = 5 },
  empty: (d) => { d.name = '   ' },
  too_long: (d) => { d.name = 'x'.repeat(81) },
  line_break: (d) => { d.name = 'a\nb' },
  too_few: (d) => { d.services = [] },
  too_many: (d) => { d.services = Array.from({ length: 9 }, () => ({ ...d.services[0] })) },
  unrecognized_field: (d) => { d.extra = 1 },
  removed_field: (d) => { d.productGridConfig = { whatsappNumber: '1' } },
  invalid_whatsapp: (d) => { d.contact.whatsapp = 'abc' },
  invalid_phone: (d) => { d.contact.phone = '12' },
  invalid_email: (d) => { d.contact.email = 'no-es-email' },
  unknown_icon: (d) => { d.services[0].icon = 'Heart' },
  unknown_language: (d) => { d.language = 'fr' },
  unknown_currency: (d) => { d.productGridConfig = { currency: 'XXX' } },
  price_not_positive: withProducts([prod(1, { price: 0 })]),
  price_too_high: withProducts([prod(1, { price: 100000000 })]),
  price_too_many_decimals: withProducts([prod(1, { price: 1.234 })]),
  price_currency_decimals: withProducts([prod(1, { price: 10.5 })], { currency: 'CLP' }),
  invalid_rating: (d) => { d.testimonials = [{ name: 'Ana', text: 'Bien', rating: 6 }] },
  invalid_id: withProducts([prod(1, { id: 'Mal Id' })]),
  invalid_url: withProducts([prod(1, { image: 'no-es-url' })]),
  invalid_anchor: (d) => { d.hero.ctaPrimary.href = '#MAL' },
  missing_contact_method: (d) => { delete d.contact.email },
  duplicate_id: withProducts([prod(1, { id: 'igual' }), prod(2, { id: 'igual' })]),
  inconsistent_category: withProducts([prod(1, { category: 'Ropa' }), prod(2, { category: 'ropa' })]),
  too_many_categories: withProducts(Array.from({ length: 13 }, (_, i) => prod(i, { category: `Cat ${i}` }))),
  unknown_anchor: (d) => { d.hero.ctaPrimary.href = '#productos' },
}
// `invalid_value` es la salida de respaldo del validador para un tipo de problema de Zod que no tiene código propio:
// con datos JSON normales no se puede provocar (se probaron listas, objetos, textos y números mal tipados: todos dan
// `invalid_type`). Se declara aquí para que la cobertura sea explícita y no un hueco silencioso.
const NOT_REACHABLE = new Set(['invalid_value'])

test('el archivo mínimo y el máximo del template son válidos para el validador copiado', () => {
  assert.deepEqual(validateSite(MIN()).errors, [])
  assert.deepEqual(validateSite(MAX()).errors, [])
})

test('hay un caso inválido por cada código de error del contrato', () => {
  const uncovered = ERROR_CODES.map((e) => e.code).filter((c) => !CASES[c] && !NOT_REACHABLE.has(c))
  assert.deepEqual(uncovered, [], 'códigos sin caso: agregarlo a CASES')
  for (const code of Object.keys(CASES)) assert.ok(ERROR_CODES.some((e) => e.code === code), `${code} ya no existe en el contrato`)
})

for (const [code, mutate] of Object.entries(CASES)) {
  test(`código ${code}: se rechaza y el informe lo trae`, () => {
    const data = MIN()
    mutate(data)
    assert.ok(codesOf(data).includes(code), `esperaba ${code}, llegó ${JSON.stringify(codesOf(data))}`)
  })
}

test('todos los errores a la vez, sin tope', () => {
  const data = MIN()
  // Cada mutación toca un campo distinto: ninguna debe esconder a otra.
  CASES.too_long(data)
  data.contact.whatsapp = 'abc'
  data.services[0].icon = 'Heart'
  data.language = 'fr'
  data.testimonials = [{ name: 'Ana', text: 'Bien', rating: 6 }]
  data.hero.ctaPrimary.href = '#MAL'
  delete data.about.title
  const codes = codesOf(data)
  for (const c of ['too_long', 'invalid_whatsapp', 'unknown_icon', 'unknown_language', 'invalid_rating', 'invalid_anchor', 'required']) {
    assert.ok(codes.includes(c), `falta ${c} en ${JSON.stringify(codes)}`)
  }
})

test('el validador copiado y el del template dan el mismo informe', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zz-validator-'))
  try {
    const bad = MIN()
    CASES.invalid_whatsapp(bad)
    CASES.unknown_icon(bad)
    for (const [name, data] of [['min', MIN()], ['max', MAX()], ['bad', bad]]) {
      const file = join(dir, `${name}.json`)
      writeFileSync(file, JSON.stringify(data))
      const run = spawnSync(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', 'scripts/validate-site.mjs', file, '--json'], { cwd: TEMPLATE, encoding: 'utf8' })
      const original = JSON.parse(run.stdout)
      const copy = validateSite(data)
      assert.deepEqual(copy.errors, original.errors, `informe distinto en ${name}`)
      assert.equal(copy.ok, original.ok)
      assert.equal(copy.schemaVersion, original.schemaVersion)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
