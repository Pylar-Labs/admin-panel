// Prueba del alta de clientes (spec 005). Corre contra la base real de `.env.local`,
// y SOLO si es PylarLabs (si no, se detiene antes de escribir nada).
// No envía correos: la invitación se sustituye por `generateLink` (crea el mismo usuario sin enviar nada).
// Prefijo propio, distinto del de la prueba de aislamiento, para que ninguna limpieza borre lo de la otra.
// Uso: npm run test:db
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { onboardClient, listClients, validateInput } from '../../src/lib/clients/onboarding.ts'
import { isAdminUser } from '../../src/lib/auth/roles.ts'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EXPECTED_HOST = 'eplnsjdvjawwijokoerk.supabase.co'
const PREFIX = 'zz-alta-'
const EMAIL_DOMAIN = '@example.com'
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }

const ctx = {}
const email = (label) => `${PREFIX}${ctx.runId}-${label}${EMAIL_DOMAIN}`
const name = (label) => `${PREFIX}${ctx.runId}-${label}`

// Cliente de administración de la prueba: el real, con la invitación sin correo y fallos a pedido.
function facade(real, f = {}) {
  const a = real.auth.admin
  const boom = (m) => ({ data: null, error: { message: `fallo simulado: ${m}` } })
  return {
    from(table) {
      const q = real.from(table)
      if (table !== 'site_config') return q
      return {
        select: (...x) => q.select(...x),
        insert: (v) => (f.configInsert ? Promise.resolve({ error: { message: 'fallo simulado: crear configuración' } }) : q.insert(v)),
        delete: () => (f.configDelete ? { eq: async () => ({ error: { message: 'fallo simulado: borrar configuración' } }) } : q.delete()),
      }
    },
    auth: {
      admin: {
        listUsers: (p) => (f.noUserScan ? Promise.resolve({ data: { users: [] }, error: null }) : a.listUsers(p)),
        inviteUserByEmail: async (to) => {
          if (f.invite) return boom('invitar')
          const { data, error } = await a.generateLink({ type: 'invite', email: to })
          return { data: { user: data?.user ?? null }, error }
        },
        updateUserById: (id, attrs) => (f.assign ? Promise.resolve(boom('asignar sitio')) : a.updateUserById(id, attrs)),
        deleteUser: (id) => (f.userDelete ? Promise.resolve(boom('borrar usuario')) : a.deleteUser(id)),
      },
    },
  }
}

async function sweepUsers() {
  let removed = 0
  for (let page = 1; ; page++) {
    const { data, error } = await ctx.svc.auth.admin.listUsers({ page, perPage: 200 })
    assert.ifError(error)
    for (const u of data.users) {
      if (u.email?.startsWith(PREFIX) && u.email.endsWith(EMAIL_DOMAIN)) {
        const { error: e } = await ctx.svc.auth.admin.deleteUser(u.id)
        assert.ifError(e)
        removed++
      }
    }
    if (data.users.length < 200) return removed
  }
}

// El site_id de estas altas es un UUID: se identifican por el nombre del negocio. Los hijos se borran en cascada.
async function sweepConfigs() {
  const { data, error } = await ctx.svc.from('site_config').delete().ilike('business_name', `${PREFIX}%`).select('id')
  assert.ifError(error)
  return data.length
}

async function usersOf(mail) {
  const { data, error } = await ctx.svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
  assert.ifError(error)
  return data.users.filter((u) => u.email === mail)
}

async function configsNamed(n) {
  const { data, error } = await ctx.svc.from('site_config').select('*').ilike('business_name', n.trim())
  assert.ifError(error)
  return data
}

async function nothingLeft(mail, n) {
  assert.equal((await usersOf(mail)).length, 0, 'quedó un usuario')
  assert.equal((await configsNamed(n)).length, 0, 'quedó una configuración')
}

async function makeUser(label, { app_metadata = {}, user_metadata = {} } = {}) {
  const mail = email(label)
  const password = randomUUID()
  const { data, error } = await ctx.svc.auth.admin.createUser({ email: mail, password, email_confirm: true, app_metadata, user_metadata })
  assert.ifError(error)
  const client = createClient(SUPABASE_URL, ANON_KEY, clientOptions)
  const { error: e } = await client.auth.signInWithPassword({ email: mail, password })
  assert.ifError(e)
  return { client, id: data.user.id, email: mail }
}

describe('alta de clientes (spec 005)', () => {
  before(async () => {
    assert.ok(SUPABASE_URL && ANON_KEY && SERVICE_KEY, 'Faltan variables de entorno de Supabase en .env.local')
    assert.equal(new URL(SUPABASE_URL).host, EXPECTED_HOST, `.env.local no apunta a PylarLabs (${EXPECTED_HOST}); no se escribe nada`)
    ctx.runId = randomUUID().slice(0, 8)
    ctx.svc = createClient(SUPABASE_URL, SERVICE_KEY, clientOptions)
    ctx.ok = facade(ctx.svc)
    await sweepConfigs()
    await sweepUsers()
  })

  after(async () => {
    try {
      await sweepConfigs()
    } finally {
      await sweepUsers()
    }
    assert.equal(await sweepUsers(), 0, 'Quedaron usuarios de prueba')
    assert.equal(await sweepConfigs(), 0, 'Quedaron configuraciones de prueba')
  })

  // ── RF-8 · validación ──────────────────────────────────────────────────────

  const BAD = [
    ['email vacío', '', 'Negocio'],
    ['email de solo espacios', '   ', 'Negocio'],
    ['email sin arroba', 'cliente.example.com', 'Negocio'],
    ['email sin dominio', 'cliente@', 'Negocio'],
    ['email con espacios dentro', 'cli ente@example.com', 'Negocio'],
    ['nombre vacío', 'a@example.com', ''],
    ['nombre de solo espacios', 'a@example.com', '   '],
    ['nombre con dos líneas', 'a@example.com', 'Uno\nDos'],
    ['nombre de 101 caracteres', 'a@example.com', 'x'.repeat(101)],
  ]
  for (const [label, mail, n] of BAD) {
    test(`RF-8: rechaza ${label} y no crea nada`, async () => {
      assert.equal(validateInput({ email: mail, businessName: n }).ok, false)
      const before = (await ctx.svc.from('site_config').select('id', { count: 'exact', head: true })).count
      const res = await onboardClient(ctx.ok, { email: mail, businessName: n })
      assert.equal(res.status, 'invalid')
      assert.match(res.message, /[a-záéíóú]/i)
      const after = (await ctx.svc.from('site_config').select('id', { count: 'exact', head: true })).count
      assert.equal(after, before)
    })
  }

  test('RF-8: acepta 100 caracteres y normaliza email y nombre', () => {
    const r = validateInput({ email: '  Cliente@Example.COM ', businessName: `  ${'x'.repeat(100)}  ` })
    assert.equal(r.ok, true)
    assert.equal(r.email, 'cliente@example.com')
    assert.equal(r.businessName, 'x'.repeat(100))
  })

  // ── RF-3 · alta correcta ───────────────────────────────────────────────────

  test('RF-3, RF-4: el alta deja configuración solo con el nombre y un usuario con el sitio en app_metadata', async () => {
    const mail = email('ok')
    const n = name('ok')
    const res = await onboardClient(ctx.ok, { email: ` ${mail.toUpperCase()} `, businessName: ` ${n} ` })
    assert.equal(res.status, 'created', JSON.stringify(res))
    assert.equal(res.email, mail)
    assert.ok(!('password' in res))
    const [cfg] = await configsNamed(n)
    assert.equal(cfg.site_id, res.siteId)
    assert.equal(cfg.business_name, n)
    for (const f of ['tagline', 'description', 'phone', 'whatsapp', 'email', 'address', 'instagram', 'facebook', 'logo_url', 'hero_image_url', 'hero_title', 'hero_subtitle', 'map_embed_url', 'vercel_deploy_hook']) {
      assert.equal(cfg[f], null, `${f} debería estar vacío`)
    }
    const [user] = await usersOf(mail)
    assert.equal(user.app_metadata.site_id, res.siteId)
    assert.equal(user.user_metadata?.site_id, undefined)
    assert.match(res.siteId, /^[0-9a-f-]{36}$/)
  })

  // ── RF-7 · email repetido ──────────────────────────────────────────────────

  test('RF-7: un email ya registrado se rechaza y no crea nada', async () => {
    const first = await onboardClient(ctx.ok, { email: email('rep'), businessName: name('rep-1') })
    assert.equal(first.status, 'created')
    const second = await onboardClient(ctx.ok, { email: email('rep').toUpperCase(), businessName: name('rep-2') })
    assert.equal(second.status, 'email_taken')
    assert.equal((await configsNamed(name('rep-2'))).length, 0)
    assert.equal((await usersOf(email('rep'))).length, 1)
  })

  test('RF-7: si dos altas se cruzan (el recorrido no lo ve), el rechazo de la invitación también deshace', async () => {
    const first = await onboardClient(ctx.ok, { email: email('carrera'), businessName: name('carrera-1') })
    assert.equal(first.status, 'created')
    const second = await onboardClient(facade(ctx.svc, { noUserScan: true }), { email: email('carrera'), businessName: name('carrera-2') })
    assert.equal(second.status, 'email_taken', JSON.stringify(second))
    assert.equal((await configsNamed(name('carrera-2'))).length, 0)
    const [user] = await usersOf(email('carrera'))
    assert.equal(user.app_metadata.site_id, first.siteId, 'el usuario original no debe cambiar')
  })

  // ── RF-16 · nombre repetido ────────────────────────────────────────────────

  test('RF-16: nombre repetido (sin distinguir mayúsculas ni espacios) pide confirmar y no crea', async () => {
    const first = await onboardClient(ctx.ok, { email: email('nom-1'), businessName: name('nom') })
    assert.equal(first.status, 'created')
    const second = await onboardClient(ctx.ok, { email: email('nom-2'), businessName: `  ${name('nom').toUpperCase()}  ` })
    assert.equal(second.status, 'confirm_name')
    assert.equal((await usersOf(email('nom-2'))).length, 0)
    assert.equal((await configsNamed(name('nom'))).length, 1)
  })

  test('RF-16: con la confirmación se crea y quedan dos sitios distintos', async () => {
    const third = await onboardClient(ctx.ok, { email: email('nom-3'), businessName: name('nom'), confirmDuplicateName: true })
    assert.equal(third.status, 'created', JSON.stringify(third))
    const rows = await configsNamed(name('nom'))
    assert.equal(rows.length, 2)
    assert.notEqual(rows[0].site_id, rows[1].site_id)
  })

  // ── RF-5, RF-6 · fallos a mitad ────────────────────────────────────────────

  test('RF-5: falla crear la configuración → no queda nada', async () => {
    const res = await onboardClient(facade(ctx.svc, { configInsert: true }), { email: email('f1'), businessName: name('f1') })
    assert.equal(res.status, 'failed')
    assert.deepEqual(res.left, [])
    await nothingLeft(email('f1'), name('f1'))
  })

  test('RF-5: falla la invitación → se borra la configuración', async () => {
    const res = await onboardClient(facade(ctx.svc, { invite: true }), { email: email('f2'), businessName: name('f2') })
    assert.equal(res.status, 'failed')
    assert.deepEqual(res.left, [])
    await nothingLeft(email('f2'), name('f2'))
  })

  test('RF-5: falla asignar el sitio → se borran el usuario y la configuración', async () => {
    const res = await onboardClient(facade(ctx.svc, { assign: true }), { email: email('f3'), businessName: name('f3') })
    assert.equal(res.status, 'failed')
    assert.deepEqual(res.left, [])
    await nothingLeft(email('f3'), name('f3'))
  })

  test('RF-6: si no se puede deshacer, el resultado dice qué quedó', async () => {
    const res = await onboardClient(facade(ctx.svc, { assign: true, userDelete: true, configDelete: true }), { email: email('f4'), businessName: name('f4') })
    assert.equal(res.status, 'failed')
    assert.equal(res.left.length, 2)
    assert.ok(res.left.some((l) => l.includes(email('f4'))), 'no nombra al usuario que quedó')
    assert.ok(res.left.some((l) => l.includes(name('f4'))), 'no nombra la configuración que quedó')
    assert.equal((await usersOf(email('f4'))).length, 1)
    assert.equal((await configsNamed(name('f4'))).length, 1)
  })

  // ── RF-9 · lista ───────────────────────────────────────────────────────────

  test('RF-9: la lista muestra pendiente hasta que el cliente entra, y luego activo', async () => {
    const mail = email('lista')
    const created = await onboardClient(ctx.ok, { email: mail, businessName: name('lista') })
    assert.equal(created.status, 'created')
    const find = async () => (await listClients(ctx.ok)).find((c) => c.siteId === created.siteId)
    const pending = await find()
    assert.equal(pending.businessName, name('lista'))
    assert.equal(pending.email, mail)
    assert.equal(pending.status, 'pendiente')
    const password = randomUUID()
    const [user] = await usersOf(mail)
    const { error } = await ctx.svc.auth.admin.updateUserById(user.id, { password, email_confirm: true })
    assert.ifError(error)
    const anon = createClient(SUPABASE_URL, ANON_KEY, clientOptions)
    const { error: signInError } = await anon.auth.signInWithPassword({ email: mail, password })
    assert.ifError(signInError)
    assert.equal((await find()).status, 'activo')
  })

  test('RF-9: un sitio sin usuario aparece en la lista como tal, y los admins no aparecen', async () => {
    const { data, error } = await ctx.svc.from('site_config').insert({ site_id: randomUUID(), business_name: name('sin-usuario') }).select('site_id').single()
    assert.ifError(error)
    await makeUser('admin-lista', { app_metadata: { role: 'admin' } })
    const list = await listClients(ctx.ok)
    const row = list.find((c) => c.siteId === data.site_id)
    assert.equal(row.status, 'sin_usuario')
    assert.equal(row.email, null)
    assert.ok(!list.some((c) => c.email === email('admin-lista')))
  })

  // ── RF-1, RF-2 · quién es admin ────────────────────────────────────────────

  test('RF-1: solo app_metadata.role = admin cuenta; user_metadata, un cliente o nadie no', async () => {
    const admin = await makeUser('adm', { app_metadata: { role: 'admin' } })
    const falso = await makeUser('falso', { user_metadata: { role: 'admin' }, app_metadata: { site_id: 'x' } })
    const cliente = await makeUser('cli', { app_metadata: { site_id: 'x' } })
    const get = async (u) => (await u.client.auth.getUser()).data.user
    assert.equal(isAdminUser(await get(admin)), true)
    assert.equal(isAdminUser(await get(falso)), false)
    assert.equal(isAdminUser(await get(cliente)), false)
    assert.equal(isAdminUser(null), false)
    assert.equal(isAdminUser({}), false)
  })

  test('RF-1: un usuario no puede darse el rol a sí mismo desde su sesión', async () => {
    const cliente = await makeUser('auto', { app_metadata: { site_id: 'x' } })
    await cliente.client.auth.updateUser({ data: { role: 'admin' } })
    const { data } = await cliente.client.auth.getUser()
    assert.equal(isAdminUser(data.user), false)
  })
})
