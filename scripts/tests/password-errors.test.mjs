// Pulidos de la 003 (/admin/cuenta): el cliente ve el motivo real cuando falla el cambio de contraseña, en español.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { passwordErrorMessage } from '../../src/lib/auth/password-errors.ts'

test('misma contraseña que la actual', () => {
  const e = { name: 'AuthApiError', code: 'same_password', status: 422, message: 'New password should be different from the old password.' }
  assert.match(passwordErrorMessage(e), /distinta de la actual/)
})

test('contraseña débil o demasiado corta', () => {
  const e = { name: 'AuthWeakPasswordError', code: 'weak_password', status: 422, message: 'Password should be at least 6 characters.' }
  assert.match(passwordErrorMessage(e), /demasiado débil/)
  assert.match(passwordErrorMessage(e), /6 caracteres/)
})

test('sesión vencida o ausente', () => {
  assert.match(passwordErrorMessage({ name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' }), /sesión venció/)
  assert.match(passwordErrorMessage({ name: 'AuthApiError', code: 'session_not_found', status: 403, message: 'x' }), /sesión venció/)
})

test('demasiados intentos', () => {
  assert.match(passwordErrorMessage({ name: 'AuthApiError', code: 'over_request_rate_limit', status: 429, message: 'x' }), /demasiados intentos/i)
  assert.match(passwordErrorMessage({ status: 429, message: 'x' }), /demasiados intentos/i)
})

test('cualquier otro error, o ninguno: mensaje genérico en español, sin filtrar el texto técnico', () => {
  for (const e of [{ name: 'AuthApiError', code: 'unexpected_failure', status: 500, message: 'database exploded' }, null, undefined, {}]) {
    const m = passwordErrorMessage(e)
    assert.match(m, /No se pudo actualizar la contraseña/)
    assert.doesNotMatch(m, /database|exploded/)
  }
})
