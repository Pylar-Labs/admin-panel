// Spec 002 (RF-6, RF-9, RF-10): adaptadores de GitHub y Vercel con `fetch` falso (sin red ni credenciales reales).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGithub } from '../../src/lib/publish/github.ts'
import { createVercel, triggerDeploy } from '../../src/lib/publish/vercel.ts'

// `fetch` falso: responde en orden lo que se le programa y guarda cada llamada.
function fakeFetch(...responses) {
  const calls = []
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : undefined })
    const next = responses.shift()
    if (!next) throw new Error(`llamada inesperada a ${url}`)
    return new Response(next.body === undefined ? null : typeof next.body === 'string' ? next.body : JSON.stringify(next.body), { status: next.status ?? 200 })
  }
  return { fn, calls }
}
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
const existing = (content, sha) => ({ body: { sha, content: b64(content), encoding: 'base64' } })

test('GitHub: lee SCHEMA_VERSION del repositorio de la web con el token y la rama', async () => {
  const f = fakeFetch({ body: 'export const SCHEMA_VERSION = "2.3";\n' })
  const gh = createGithub({ token: 'tok', fetch: f.fn })
  assert.equal(await gh.readSchemaVersion('o/r', 'main'), '2.3')
  assert.match(f.calls[0].url, /api\.github\.com\/repos\/o\/r\/contents\/src\/content\/site\.schema\.ts\?ref=main/)
  assert.equal(f.calls[0].headers.Authorization, 'Bearer tok')
})

test('GitHub: sin archivo o sin versión → null; error del servicio → lanza', async () => {
  assert.equal(await createGithub({ token: 't', fetch: fakeFetch({ status: 404 }).fn }).readSchemaVersion('o/r', 'main'), null)
  assert.equal(await createGithub({ token: 't', fetch: fakeFetch({ body: 'sin versión' }).fn }).readSchemaVersion('o/r', 'main'), null)
  await assert.rejects(createGithub({ token: 't', fetch: fakeFetch({ status: 500 }).fn }).readSchemaVersion('o/r', 'main'))
})

test('GitHub: archivo nuevo → PUT sin sha, contenido en base64', async () => {
  const f = fakeFetch({ status: 404 }, { body: { commit: { sha: 'c1' } }, status: 201 })
  const r = await createGithub({ token: 't', fetch: f.fn }).writeData('o/r', 'main', '{"a":1}\n', 'msg')
  assert.deepEqual(r, { changed: true, sha: 'c1' })
  assert.equal(f.calls[1].method, 'PUT')
  assert.match(f.calls[1].url, /contents\/src\/content\/site\.data\.json$/)
  assert.deepEqual(f.calls[1].body, { message: 'msg', content: b64('{"a":1}\n'), branch: 'main' })
})

test('GitHub: contenido idéntico → sin cambios y sin PUT', async () => {
  const f = fakeFetch(existing('{"a":1}\n', 's0'))
  assert.deepEqual(await createGithub({ token: 't', fetch: f.fn }).writeData('o/r', 'main', '{"a":1}\n', 'msg'), { changed: false })
  assert.equal(f.calls.length, 1)
})

test('GitHub: contenido distinto → PUT con el sha actual', async () => {
  const f = fakeFetch(existing('{"a":0}\n', 's0'), { body: { commit: { sha: 'c2' } } })
  assert.deepEqual(await createGithub({ token: 't', fetch: f.fn }).writeData('o/r', 'main', '{"a":1}\n', 'msg'), { changed: true, sha: 'c2' })
  assert.equal(f.calls[1].body.sha, 's0')
})

test('GitHub: conflicto 409 → relee y reintenta una vez; si vuelve a fallar, lanza', async () => {
  const ok = fakeFetch(existing('{"a":0}\n', 's0'), { status: 409 }, existing('{"a":0}\n', 's1'), { body: { commit: { sha: 'c3' } } })
  assert.deepEqual(await createGithub({ token: 't', fetch: ok.fn }).writeData('o/r', 'main', '{"a":1}\n', 'm'), { changed: true, sha: 'c3' })
  assert.equal(ok.calls[3].body.sha, 's1')
  const bad = fakeFetch(existing('x', 's0'), { status: 409 }, existing('x', 's1'), { status: 409 })
  await assert.rejects(createGithub({ token: 't', fetch: bad.fn }).writeData('o/r', 'main', 'y', 'm'))
})

const dep = (state, created, sha) => ({ uid: `d-${created}`, state, created, meta: sha ? { githubCommitSha: sha } : {} })

test('Vercel: pide los despliegues de producción del proyecto desde el inicio y devuelve el más nuevo', async () => {
  const f = fakeFetch({ body: { deployments: [dep('BUILDING', 2000), dep('READY', 3000), dep('ERROR', 1000)] } })
  const r = await createVercel({ token: 'tok', teamId: 'team_1', fetch: f.fn }).latestDeployment('prj_1', { sinceMs: 900, sha: null })
  assert.deepEqual(r, { state: 'READY' })
  const url = new URL(f.calls[0].url)
  assert.equal(url.hostname, 'api.vercel.com')
  assert.equal(url.searchParams.get('projectId'), 'prj_1')
  assert.equal(url.searchParams.get('target'), 'production')
  assert.equal(url.searchParams.get('since'), '900')
  assert.equal(url.searchParams.get('teamId'), 'team_1')
  assert.equal(f.calls[0].headers.Authorization, 'Bearer tok')
})

test('Vercel: con commit exige el mismo commit; sin despliegues → null; sin teamId no lo envía', async () => {
  const f = fakeFetch({ body: { deployments: [dep('READY', 3000, 'otro'), dep('BUILDING', 2000, 'abc')] } }, { body: { deployments: [] } })
  const v = createVercel({ token: 't', fetch: f.fn })
  assert.deepEqual(await v.latestDeployment('p', { sinceMs: 0, sha: 'abc' }), { state: 'BUILDING' })
  assert.equal(await v.latestDeployment('p', { sinceMs: 0, sha: null }), null)
  assert.equal(new URL(f.calls[0].url).searchParams.has('teamId'), false)
})

test('Vercel: error del servicio o proyecto sin id → lanza', async () => {
  await assert.rejects(createVercel({ token: 't', fetch: fakeFetch({ status: 403 }).fn }).latestDeployment('p', { sinceMs: 0, sha: null }))
  await assert.rejects(createVercel({ token: 't', fetch: fakeFetch().fn }).latestDeployment(null, { sinceMs: 0, sha: null }))
})

test('Vercel: el enlace de despliegue se llama con POST; si responde mal, lanza', async () => {
  const f = fakeFetch({ body: { job: {} } })
  await triggerDeploy('https://api.vercel.com/v1/integrations/deploy/prj/xyz', f.fn)
  assert.equal(f.calls[0].method, 'POST')
  await assert.rejects(triggerDeploy('https://x/y', fakeFetch({ status: 500 }).fn))
})
