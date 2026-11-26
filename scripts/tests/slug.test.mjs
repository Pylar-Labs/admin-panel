// Spec 001 (RF-5): identificador de producto automático, estable y sin repetidos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeSlug } from '../../src/lib/slug.ts'

test('crea el identificador desde el nombre', () => {
  assert.equal(makeSlug('Mate de Calabaza', []), 'mate-de-calabaza')
})

test('quita tildes y símbolos', () => {
  assert.equal(makeSlug('  ¡Café & Té — Ñandú! ', []), 'cafe-te-nandu')
})

test('nombre vacío o solo símbolos usa el respaldo producto-N', () => {
  assert.equal(makeSlug('', []), 'producto-1')
  assert.equal(makeSlug('¡¡¡', ['producto-1']), 'producto-2')
})

test('repetidos llevan sufijo numérico', () => {
  assert.equal(makeSlug('Mate', ['mate']), 'mate-2')
  assert.equal(makeSlug('Mate', ['mate', 'mate-2']), 'mate-3')
})

test('largo máximo 60 también con sufijo', () => {
  const s = makeSlug('a'.repeat(100), [])
  assert.equal(s.length, 60)
  assert.ok(makeSlug('a'.repeat(100), [s]).length <= 60)
  assert.notEqual(makeSlug('a'.repeat(100), [s]), s)
})

test('renombrar no cambia el identificador: solo se llama al crear', () => {
  // El contrato de uso: el identificador existente se conserva; makeSlug se usa únicamente al crear.
  const existing = ['mate']
  assert.equal(makeSlug('Mate', existing), 'mate-2')
  assert.deepEqual(existing, ['mate'])
})
