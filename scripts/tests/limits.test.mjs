// Spec 001 (RF-6, RF-7): límites visibles que avisan pero nunca bloquean. Casos de grafemas = los del contrato.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkText, isOverMaxItems, isValidWhatsapp, needsFullUrl } from '../../src/lib/contract/limits.ts'

const L80 = { max: 80, singleLine: true }

test('en el límite exacto no avisa; con uno más sí', () => {
  assert.equal(checkText('a'.repeat(80), L80).over, false)
  const r = checkText('a'.repeat(81), L80)
  assert.deepEqual([r.over, r.count, r.max], [true, 81, 80])
})

test('cuenta grafemas: emoji, familia, bandera y letra combinada valen 1', () => {
  assert.equal(checkText('😀', L80).count, 1)
  assert.equal(checkText('👨‍👩‍👧', L80).count, 1)
  assert.equal(checkText('🇦🇷', L80).count, 1)
  assert.equal(checkText('é', L80).count, 1)
  assert.equal(checkText('é'.repeat(80), L80).over, false)
  assert.equal(checkText('😀'.repeat(81), L80).over, true)
})

test('una sola línea: avisa de saltos solo si el campo es de una línea', () => {
  assert.equal(checkText('a\nb', L80).hasLineBreak, true)
  assert.equal(checkText('a\nb', { max: 500, singleLine: false }).hasLineBreak, false)
})

test('texto vacío no avisa', () => {
  assert.deepEqual(checkText('', L80), { count: 0, max: 80, over: false, hasLineBreak: false })
})

test('cantidad máxima de lista: exacta no avisa, +1 sí', () => {
  assert.equal(isOverMaxItems(3, 3), false)
  assert.equal(isOverMaxItems(4, 3), true)
})

test('WhatsApp: solo dígitos, de 8 a 15', () => {
  const d = { min: 8, max: 15 }
  assert.equal(isValidWhatsapp('5491122334455', d), true)
  assert.equal(isValidWhatsapp('12345678', d), true)
  assert.equal(isValidWhatsapp('1234567', d), false)
  assert.equal(isValidWhatsapp('1'.repeat(16), d), false)
  assert.equal(isValidWhatsapp('+5491122334455', d), false)
  assert.equal(isValidWhatsapp('54 911 2233', d), false)
})

// Redes sociales: el contrato exige URL http/https completa; el aviso inmediato solo detecta lo que no la empieza bien
// (espacios, credenciales y largo los sigue juzgando el validador real tras guardar).
test('URL completa: vacío no avisa; usuario suelto, @usuario, dominio sin protocolo y otros protocolos sí', () => {
  assert.equal(needsFullUrl(''), false)
  assert.equal(needsFullUrl('   '), false)
  assert.equal(needsFullUrl('minegocio'), true)
  assert.equal(needsFullUrl('@minegocio'), true)
  assert.equal(needsFullUrl('instagram.com/minegocio'), true)
  assert.equal(needsFullUrl('ftp://instagram.com/x'), true)
  assert.equal(needsFullUrl('https://instagram.com/minegocio'), false)
  assert.equal(needsFullUrl('http://facebook.com/minegocio'), false)
  assert.equal(needsFullUrl('HTTPS://instagram.com/minegocio'), false)
  assert.equal(needsFullUrl('  https://instagram.com/minegocio  '), false)
})
