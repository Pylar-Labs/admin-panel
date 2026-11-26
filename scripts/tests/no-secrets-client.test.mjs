// Spec 002 (RF-11, RF-13): ningún secreto de publicación llega al navegador y el sitio sale de la sesión.
// Revisión estática de src/: el enlace de despliegue y los tokens solo pueden aparecer en código de servidor.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SRC = join(ROOT, 'src')
const SECRET = /vercel_deploy_hook|deploy_hook|GITHUB_TOKEN|VERCEL_TOKEN/
const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .map((f) => ({ path: relative(ROOT, join(SRC, f)).replaceAll('\\', '/'), text: readFileSync(join(SRC, f), 'utf8') }))
const isClient = (text) => /^\s*(['"])use client\1/m.test(text.split('\n').slice(0, 5).join('\n'))

test('ningún archivo de cliente menciona el enlace de despliegue ni los tokens', () => {
  const leaks = files.filter((f) => isClient(f.text) && SECRET.test(f.text)).map((f) => f.path)
  assert.deepEqual(leaks, [], 'secretos en código que corre en el navegador')
})

test('ninguna variable NEXT_PUBLIC_ lleva secretos de publicación', () => {
  const bad = files.filter((f) => /NEXT_PUBLIC_\w*(HOOK|GITHUB|VERCEL)/i.test(f.text)).map((f) => f.path)
  assert.deepEqual(bad, [])
})

test('el enlace de despliegue ya no se pide a la base desde fuera del servidor', () => {
  const users = files.filter((f) => /vercel_deploy_hook/.test(f.text)).map((f) => f.path)
  assert.deepEqual(users, [], 'queda código que lee o escribe site_config.vercel_deploy_hook')
})

// Quien lee los tokens o toca site_deploy con la clave de servidor debe ser código solo de servidor. Los módulos puros
// (publish.ts) manejan el valor del enlace de una fila ya leída, pero no leen secretos ni la tabla.
const READS_SECRETS = /GITHUB_TOKEN|VERCEL_TOKEN|from\(['"]site_deploy['"]\)/

test('todo archivo que lee los tokens o la tabla site_deploy importa server-only', () => {
  const missing = files
    .filter((f) => READS_SECRETS.test(f.text) && !isClient(f.text))
    .filter((f) => !/import ['"]server-only['"]/.test(f.text))
    .map((f) => f.path)
  assert.deepEqual(missing, [])
})

test('la acción de publicar existe, empieza cada acción por requireSiteUser y no recibe el sitio como parámetro', () => {
  const file = join(SRC, 'app/admin/publicar/actions.ts')
  assert.ok(existsSync(file), 'falta src/app/admin/publicar/actions.ts')
  const text = readFileSync(file, 'utf8')
  assert.match(text.split('\n').slice(0, 3).join('\n'), /['"]use server['"]/)
  const actions = [...text.matchAll(/export async function (\w+)\(([^)]*)\)[^{]*\{([\s\S]*?)\n\}/g)]
  assert.ok(actions.length >= 4, 'se esperaban al menos publish, retry, getStatus y getSectionIssues')
  for (const [, name, params, body] of actions) {
    assert.doesNotMatch(params, /site_?id/i, `${name} recibe el sitio como parámetro: debe salir de la sesión`)
    assert.match(body.split('\n').slice(0, 4).join('\n'), /requireSiteUser\(\)/, `${name} no empieza por requireSiteUser()`)
  }
})
