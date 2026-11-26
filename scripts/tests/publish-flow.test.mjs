// Spec 002 (RF-1, RF-2, RF-6 a RF-10): el flujo de publicación con base, GitHub y Vercel falsos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publishSite, retryDeploy, getPublishStatus, MSG_SAVED_NOT_LIVE } from '../../src/lib/publish/publish.ts'
import { validateSite } from '../../src/lib/contract/vendor/content/site.schema.ts'

const T0 = Date.parse('2026-11-25T12:00:00.000Z')
const MIN = 60_000

const validRows = () => ({
  config: {
    site_id: 's', business_name: 'Negocio', tagline: 'Lema', description: 'Desc', language: 'es', whatsapp: '5491112345678', email: 'a@b.com',
    hero_title: 'Titular', hero_subtitle: 'Subtítulo', hero_cta_primary_label: 'Contactanos', hero_cta_primary_href: '#contacto',
    about_title: 'Quiénes somos', about_body: 'Texto', about_stats: [], about_highlights: [], currency: 'ARS', show_prices: true, group_by_category: false, section_titles: {},
  },
  services: [{ id: 'a', site_id: 's', title: 'Corte', description: 'd', icon: 'Star', order: 1, active: true }],
  products: [], testimonials: [],
})

// Fábrica de dependencias falsas: `state` permite forzar cada falla y `state.calls` registra el orden de las llamadas.
function make(over = {}) {
  const state = {
    now: T0, calls: [], webVersion: '2.3', unchanged: false, failSave: false, failCommit: false, failHook: false, deployment: null, vercelThrows: false, rows: validRows(),
    row: {
      site_id: 's', deploy_hook: 'https://hook.example/x', github_repo: 'o/r', github_branch: 'main', vercel_project_id: 'prj', status: 'published', locked_at: null,
      started_at: null, published_data: { anterior: true }, published_schema_version: '2.3', published_at: '2026-01-01T00:00:00.000Z', published_by: null, last_commit_sha: null, last_message: null,
    },
    ...over,
  }
  const log = (name) => state.calls.push(name)
  const deps = {
    now: () => state.now,
    schemaVersion: '2.3',
    validate: (data) => { log('validate'); return validateSite(data) },
    ensureRow: async () => log('ensureRow'),
    acquire: async (_site, nowIso, cutoffIso) => {
      log('acquire')
      const r = state.row
      if (r.status === 'publishing' && r.locked_at && r.locked_at >= cutoffIso) return null
      const prev = { ...r }
      state.row = { ...r, status: 'publishing', locked_at: nowIso }
      return { prev, row: state.row }
    },
    restore: async (_site, prev) => { log('restore'); state.row = { ...state.row, status: prev.status, locked_at: null } },
    update: async (_site, patch) => { log('update'); state.row = { ...state.row, ...patch } },
    saveVersion: async (_site, patch) => { log('saveVersion'); if (state.failSave) throw new Error('db'); state.row = { ...state.row, ...patch } },
    getRow: async () => { log('getRow'); return state.row },
    loadRows: async () => { log('loadRows'); return state.rows },
    github: {
      readSchemaVersion: async () => { log('readSchemaVersion'); return state.webVersion },
      writeData: async (_repo, _branch, content) => { log('writeData'); if (state.failCommit) throw new Error('409'); state.lastContent = content; return state.unchanged ? { changed: false } : { changed: true, sha: 'abc123' } },
    },
    vercel: {
      latestDeployment: async () => { log('latestDeployment'); if (state.vercelThrows) throw new Error('vercel'); return state.deployment },
      trigger: async () => { log('trigger'); if (state.failHook) throw new Error('hook') },
    },
  }
  return { state, deps }
}
const publish = (m) => publishSite('s', 'user-1', m.deps)

test('RF-1: con datos válidos guarda la versión y entrega; queda «guardado», no «publicado»', async () => {
  const m = make()
  const r = await publish(m)
  assert.equal(r.status, 'saved')
  assert.equal(m.state.row.status, 'saved')
  assert.equal(m.state.row.published_schema_version, '2.3')
  assert.equal(m.state.row.published_by, 'user-1')
  assert.equal(m.state.row.last_commit_sha, 'abc123')
  assert.equal(m.state.row.started_at, new Date(T0).toISOString())
  assert.equal(m.state.row.locked_at, null)
  assert.deepEqual(JSON.parse(m.state.lastContent), m.state.row.published_data)
  assert.ok(m.state.lastContent.endsWith('\n'))
  assert.ok(m.state.calls.indexOf('saveVersion') < m.state.calls.indexOf('writeData'), 'primero se guarda, luego se entrega')
})

test('RF-2: con datos inválidos no se guarda ni se entrega, lo publicado no cambia y se devuelven todos los errores ubicados', async () => {
  const m = make()
  m.state.rows.config.business_name = ''
  m.state.rows.config.whatsapp = 'abc'
  m.state.rows.services[0].icon = 'Heart'
  m.state.rows.config.hero_cta_primary_href = '#productos'
  const r = await publish(m)
  assert.equal(r.status, 'errors')
  const codes = r.errors.map((e) => e.code)
  for (const c of ['required', 'invalid_whatsapp', 'unknown_icon', 'unknown_anchor']) assert.ok(codes.includes(c), `falta ${c}`)
  assert.ok(r.errors.every((e) => e.locations.length >= 1 && e.locations[0].section && e.locations[0].field))
  assert.ok(!m.state.calls.includes('saveVersion') && !m.state.calls.includes('writeData'))
  assert.deepEqual(m.state.row.published_data, { anterior: true })
  assert.equal(m.state.row.status, 'published', 'el estado anterior se restaura')
  assert.equal(m.state.row.locked_at, null)
})

test('RF-7: con una publicación en curso no entra otra; una vencida (10 min) sí', async () => {
  const fresh = make()
  fresh.state.row = { ...fresh.state.row, status: 'publishing', locked_at: new Date(T0 - 5 * MIN).toISOString() }
  assert.equal((await publish(fresh)).status, 'busy')
  assert.ok(!fresh.state.calls.includes('loadRows'))
  const stale = make()
  stale.state.row = { ...stale.state.row, status: 'publishing', locked_at: new Date(T0 - 11 * MIN).toISOString() }
  assert.equal((await publish(stale)).status, 'saved')
})

test('RF-6: la versión del contrato de la web distinta bloquea e indica ambas', async () => {
  const m = make({ webVersion: '2.2' })
  const r = await publish(m)
  assert.equal(r.status, 'version_mismatch')
  assert.match(r.message, /2\.3/)
  assert.match(r.message, /2\.2/)
  assert.ok(!m.state.calls.includes('saveVersion') && !m.state.calls.includes('writeData'))
  assert.equal(m.state.row.status, 'published')
})

test('RF-6: si no se puede leer la versión de la web, también bloquea', async () => {
  const m = make({ webVersion: null })
  const r = await publish(m)
  assert.equal(r.status, 'version_mismatch')
  assert.match(r.message, /2\.3/)
  assert.ok(!m.state.calls.includes('saveVersion'))
})

test('sitio sin configuración y sitio sin datos de entrega: no publican y no dejan el bloqueo tomado', async () => {
  const none = make({ rows: null })
  assert.equal((await publish(none)).status, 'no_config')
  assert.equal(none.state.row.locked_at, null)
  assert.equal(none.state.row.status, 'published')
  const noRepo = make()
  noRepo.state.row = { ...noRepo.state.row, github_repo: null }
  const r = await publish(noRepo)
  assert.equal(r.status, 'not_configured')
  assert.equal(noRepo.state.row.locked_at, null)
})

test('sitio sin fila de configuración (la base lo rechaza al crear su fila de entrega): mensaje de «sin configuración»', async () => {
  const m = make()
  m.deps.ensureRow = async () => { const e = new Error('foreign key'); e.name = 'NoConfig'; throw e }
  const r = await publish(m)
  assert.equal(r.status, 'no_config')
  assert.match(r.message, /configuración/)
  assert.ok(!m.state.calls.includes('acquire'))
  const retry = await retryDeploy('s', 'user-1', m.deps)
  assert.equal(retry.status, 'no_config')
})

test('RF-8: lee lo último guardado una sola vez, después de tomar el bloqueo', async () => {
  const m = make()
  await publish(m)
  assert.equal(m.state.calls.filter((c) => c === 'loadRows').length, 1)
  assert.ok(m.state.calls.indexOf('acquire') < m.state.calls.indexOf('loadRows'))
})

test('RF-8: publicar dos veces lo mismo es válido: sin cambios en el repositorio se usa el enlace de despliegue', async () => {
  const m = make({ unchanged: true })
  const first = await publish(m)
  assert.equal(first.status, 'saved')
  assert.ok(m.state.calls.includes('trigger'))
  assert.equal(m.state.row.last_commit_sha, null)
  const second = await publish(m)
  assert.equal(second.status, 'saved')
  assert.equal(m.state.calls.filter((c) => c === 'trigger').length, 2)
})

test('RF-9: sin cambios en el repositorio y sin enlace de despliegue: datos guardados, la web no se actualizó', async () => {
  const m = make({ unchanged: true })
  m.state.row = { ...m.state.row, deploy_hook: null }
  const r = await publish(m)
  assert.equal(r.status, 'deploy_failed')
  assert.equal(m.state.row.status, 'deploy_failed')
})

test('RF-9: falla el commit: los datos quedan guardados, «la web aún no se actualizó», y el reintento no revalida', async () => {
  const m = make({ failCommit: true })
  const r = await publish(m)
  assert.equal(r.status, 'deploy_failed')
  assert.equal(r.message, MSG_SAVED_NOT_LIVE)
  assert.equal(m.state.row.status, 'deploy_failed')
  assert.ok(m.state.row.published_data.name === 'Negocio', 'la versión quedó guardada')
  const saved = m.state.row.published_data
  m.state.failCommit = false
  const validations = m.state.calls.filter((c) => c === 'validate').length
  const retry = await retryDeploy('s', 'user-1', m.deps)
  assert.equal(retry.status, 'saved')
  assert.equal(m.state.calls.filter((c) => c === 'validate').length, validations, 'el reintento no vuelve a validar')
  assert.deepEqual(JSON.parse(m.state.lastContent), saved)
  assert.equal(m.state.row.status, 'saved')
})

test('RF-9: falla el enlace de despliegue: mismo resultado', async () => {
  const m = make({ unchanged: true, failHook: true })
  const r = await publish(m)
  assert.equal(r.status, 'deploy_failed')
  assert.equal(r.message, MSG_SAVED_NOT_LIVE)
})

test('RF-9: si no se pudo guardar la versión, nada cambió ni se entregó', async () => {
  const m = make({ failSave: true })
  const before = JSON.stringify(m.state.row.published_data)
  const r = await publish(m)
  assert.equal(r.status, 'save_failed')
  assert.ok(!m.state.calls.includes('writeData'))
  assert.equal(JSON.stringify(m.state.row.published_data), before)
  assert.equal(m.state.row.status, 'published')
  assert.equal(m.state.row.locked_at, null)
})

test('faltan las credenciales del servidor: mensaje claro y el bloqueo se libera', async () => {
  const m = make()
  m.deps.github.readSchemaVersion = async () => { const e = new Error('falta GITHUB_TOKEN'); e.name = 'MissingCredentials'; throw e }
  const r = await publish(m)
  assert.equal(r.status, 'unavailable')
  assert.equal(m.state.row.locked_at, null)
  assert.equal(m.state.row.status, 'published')
})

test('RF-10: «publicado» solo cuando Vercel confirma el despliegue (READY)', async () => {
  const m = make()
  await publish(m)
  assert.equal((await getPublishStatus('s', m.deps)).status, 'saved', 'sin despliegue todavía sigue guardado')
  m.state.deployment = { state: 'BUILDING' }
  assert.equal((await getPublishStatus('s', m.deps)).status, 'saved')
  m.state.deployment = { state: 'READY' }
  const s = await getPublishStatus('s', m.deps)
  assert.equal(s.status, 'published')
  assert.equal(s.publishedAt, new Date(T0).toISOString())
  assert.equal(m.state.row.status, 'published')
})

test('RF-10: ERROR o CANCELED, o más de 10 minutos sin confirmar → la web no se actualizó', async () => {
  for (const state of ['ERROR', 'CANCELED']) {
    const m = make()
    await publish(m)
    m.state.deployment = { state }
    const s = await getPublishStatus('s', m.deps)
    assert.equal(s.status, 'deploy_failed')
    assert.equal(s.message, MSG_SAVED_NOT_LIVE)
  }
  const slow = make()
  await publish(slow)
  slow.state.now = T0 + 11 * MIN
  assert.equal((await getPublishStatus('s', slow.deps)).status, 'deploy_failed')
})

test('RF-10: si Vercel no responde, el estado no cambia (sigue guardado)', async () => {
  const m = make()
  await publish(m)
  m.state.vercelThrows = true
  assert.equal((await getPublishStatus('s', m.deps)).status, 'saved')
})

test('RF-7: el estado compartido muestra «en curso» y lo vencido (10 min) como libre', async () => {
  const m = make()
  m.state.row = { ...m.state.row, status: 'publishing', locked_at: new Date(T0 - 2 * MIN).toISOString() }
  assert.equal((await getPublishStatus('s', m.deps)).status, 'publishing')
  m.state.row = { ...m.state.row, locked_at: new Date(T0 - 11 * MIN).toISOString() }
  assert.equal((await getPublishStatus('s', m.deps)).status, 'idle')
})

test('RF-11: el estado no devuelve el enlace, el repositorio ni credenciales', async () => {
  const m = make()
  await publish(m)
  const text = JSON.stringify(await getPublishStatus('s', m.deps))
  for (const secret of ['hook.example', 'o/r', 'prj', 'abc123']) assert.ok(!text.includes(secret), `se filtró ${secret}`)
})
