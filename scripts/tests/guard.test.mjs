// Las pruebas de base (test:db) solo pueden correr contra la base de PRUEBAS, nunca contra producción.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertTestDatabase, PROD_HOST } from './_guard.mjs'

const TEST_URL = 'https://abcdefghijklmnopqrst.supabase.co'
const ON = { PYLAR_TEST_DB: '1' }

test('acepta una base distinta de producción con la marca de pruebas y devuelve su host', () => {
  assert.equal(assertTestDatabase(TEST_URL, ON), 'abcdefghijklmnopqrst.supabase.co')
})

test('se niega a correr contra producción aunque tenga la marca de pruebas', () => {
  assert.throws(() => assertTestDatabase(`https://${PROD_HOST}`, ON), /producción/)
})

test('se niega sin la marca PYLAR_TEST_DB=1 (p. ej. si cargaron .env.local por error)', () => {
  assert.throws(() => assertTestDatabase(TEST_URL, {}), /PYLAR_TEST_DB/)
  assert.throws(() => assertTestDatabase(TEST_URL, { PYLAR_TEST_DB: '0' }), /PYLAR_TEST_DB/)
  assert.throws(() => assertTestDatabase(TEST_URL, { PYLAR_TEST_DB: 'true' }), /PYLAR_TEST_DB/)
})

test('se niega sin URL o con una URL inválida', () => {
  assert.throws(() => assertTestDatabase(undefined, ON), /URL/)
  assert.throws(() => assertTestDatabase('', ON), /URL/)
  assert.throws(() => assertTestDatabase('no es una url', ON), /URL/)
})

test('producción se reconoce sin importar mayúsculas ni el protocolo', () => {
  assert.throws(() => assertTestDatabase(`HTTPS://${PROD_HOST.toUpperCase()}/`, ON), /producción/)
  assert.throws(() => assertTestDatabase(`http://${PROD_HOST}:443`, ON), /producción/)
})
