// Prueba de aislamiento multicliente (spec 004). Corre contra la base real de `.env.local`,
// y SOLO si es PylarLabs (si no, se detiene antes de escribir nada).
// Crea usuarios, filas y archivos con un prefijo que ningún cliente usaría y los borra siempre al terminar (aunque falle).
// Uso: npm run test:db
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Prefijo improbable: la limpieza borra todo lo que empiece así, y un cliente real no debe poder coincidir.
const PREFIX = 'zz-aislamiento-'
const EMAIL_DOMAIN = '@example.com'
// Única base donde esta prueba puede escribir. Ya se escribió por error en la de la landing.
const EXPECTED_HOST = 'eplnsjdvjawwijokoerk.supabase.co'
// Error que devuelve la API cuando el rol no tiene permiso sobre la tabla (no solo "0 filas").
const DENIED = '42501'
// Bucket que usa el panel y que existe en PylarLabs (en la base de la landing se llama `site-images`).
const BUCKET = 'images'
// PNG de 1×1 píxel para las pruebas de almacenamiento.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const CHILD_TABLES = ['gallery', 'services', 'products', 'testimonials']
// Tabla o columna inexistente = nada que limpiar (pasa con el esquema anterior a la migración).
const NOTHING_TO_CLEAN = new Set(['PGRST205', '42703', '42P01'])
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }

const ctx = {}

// RF-2: campos exactos de cada conjunto (los del modelo actual del panel, y ninguno más).
const EXPECTED_COLUMNS = {
  site_config: ['id', 'site_id', 'business_name', 'tagline', 'description', 'phone', 'whatsapp', 'email', 'address', 'hours', 'instagram', 'facebook', 'logo_url', 'hero_image_url', 'hero_title', 'hero_subtitle', 'map_embed_url', 'active', 'created_at',
    // spec 001
    'language', 'about_title', 'about_body', 'about_stats', 'about_highlights', 'hero_cta_primary_label', 'hero_cta_primary_href', 'hero_cta_secondary_label', 'hero_cta_secondary_href', 'currency', 'show_prices', 'group_by_category', 'product_cta_label', 'section_titles'],
  gallery: ['id', 'site_id', 'image_url', 'caption', 'order', 'active'],
  services: ['id', 'site_id', 'title', 'description', 'icon', 'order', 'active'],
  products: ['id', 'site_id', 'name', 'description', 'price', 'price_visible', 'category', 'image_url', 'whatsapp_message', 'order', 'active', 'slug'],
  testimonials: ['id', 'site_id', 'author_name', 'text', 'rating', 'order', 'active', 'role'],
}
const FIVE_TABLES = Object.keys(EXPECTED_COLUMNS)

// Una fila válida mínima de cada conjunto, para sembrar datos de A y de B.
const NEW_ROW = {
  site_config: (site) => ({ site_id: site, business_name: 'Negocio de prueba' }),
  gallery: (site) => ({ site_id: site, image_url: 'https://example.com/foto.png' }),
  services: (site) => ({ site_id: site, title: 'Servicio de prueba' }),
  products: (site) => ({ site_id: site, name: 'Producto de prueba' }),
  testimonials: (site) => ({ site_id: site, author_name: 'Autor de prueba', text: 'Texto de prueba' }),
}
// Un campo inofensivo por tabla para probar cambios.
const EDIT_FIELD = { site_config: 'tagline', gallery: 'caption', services: 'description', products: 'description', testimonials: 'text' }

// Siembra con la clave de servidor una fila de cada conjunto para A y otra para B (una sola vez por corrida).
// Si el esquema no lo permite, falla con un mensaje de montaje, no de aislamiento.
let seedPromise
function seed() {
  seedPromise ??= (async () => {
    const ids = { a: {}, b: {} }
    for (const [key, site] of [['a', ctx.siteA], ['b', ctx.siteB]]) {
      for (const table of ['site_config', ...CHILD_TABLES]) {
        const { data, error } = await ctx.svc.from(table).insert(NEW_ROW[table](site)).select('id').single()
        if (error) throw new Error(`montaje: no se pudo sembrar ${table} de ${key}: ${error.message}`)
        ids[key][table] = data.id
      }
    }
    return ids
  })()
  return seedPromise
}

async function sweepUsers() {
  let removed = 0
  for (let page = 1; ; page++) {
    const { data, error } = await ctx.svc.auth.admin.listUsers({ page, perPage: 200 })
    assert.ifError(error)
    for (const u of data.users) {
      if (u.email?.startsWith(PREFIX) && u.email.endsWith(EMAIL_DOMAIN)) {
        const { error: delError } = await ctx.svc.auth.admin.deleteUser(u.id)
        assert.ifError(delError)
        removed++
      }
    }
    if (data.users.length < 200) return removed
  }
}

async function sweepRows() {
  // Hijas primero: la configuración es la que define el sitio.
  for (const table of [...CHILD_TABLES, 'site_config']) {
    const { error } = await ctx.svc.from(table).delete().like('site_id', `${PREFIX}%`)
    if (error && !NOTHING_TO_CLEAN.has(error.code)) {
      throw new Error(`No se pudo limpiar ${table}: ${error.message}`)
    }
  }
}

// Borra los archivos de prueba: carpetas `test-…` en la raíz del bucket (las pruebas suben solo un nivel).
async function sweepStorage() {
  const bucket = ctx.svc.storage.from(BUCKET)
  const { data: folders, error } = await bucket.list('', { limit: 1000 })
  if (error) throw new Error(`No se pudo listar el almacenamiento: ${error.message}`)
  const mine = folders.filter((f) => f.name.startsWith(PREFIX))
  for (const folder of mine) {
    const { data: files } = await bucket.list(folder.name, { limit: 1000 })
    if (files?.length) await bucket.remove(files.map((f) => `${folder.name}/${f.name}`))
  }
  return mine.length
}

async function makeUser(label, { siteId, role } = {}) {
  const email = `${PREFIX}${ctx.runId}-${label}${EMAIL_DOMAIN}`
  const password = randomUUID()
  const app_metadata = {}
  if (siteId) app_metadata.site_id = siteId
  if (role) app_metadata.role = role
  const { data, error } = await ctx.svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata,
  })
  assert.ifError(error)
  const client = createClient(SUPABASE_URL, ANON_KEY, clientOptions)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  assert.ifError(signInError)
  return { client, id: data.user.id, email, siteId }
}

describe('aislamiento multicliente (spec 004)', () => {
  before(async () => {
    assert.ok(SUPABASE_URL && ANON_KEY && SERVICE_KEY, 'Faltan variables de entorno de Supabase en .env.local')
    assert.equal(new URL(SUPABASE_URL).host, EXPECTED_HOST, `.env.local no apunta a PylarLabs (${EXPECTED_HOST}); no se escribe nada`)
    ctx.runId = randomUUID().slice(0, 8)
    ctx.svc = createClient(SUPABASE_URL, SERVICE_KEY, clientOptions)
    ctx.anon = createClient(SUPABASE_URL, ANON_KEY, clientOptions)
    ctx.siteA = `${PREFIX}${ctx.runId}-a`
    ctx.siteB = `${PREFIX}${ctx.runId}-b`
    // Restos de una corrida anterior que haya fallado a medias.
    await sweepStorage()
    await sweepRows()
    await sweepUsers()
    ctx.a = await makeUser('a', { siteId: ctx.siteA })
    ctx.b = await makeUser('b', { siteId: ctx.siteB })
    ctx.admin = await makeUser('admin', { role: 'admin' })
    ctx.sinSitio = await makeUser('sin-sitio')
  })

  after(async () => {
    try {
      await sweepStorage()
      await sweepRows()
    } finally {
      await sweepUsers()
    }
    // Comprobación final: no queda nada de la prueba.
    assert.equal(await sweepUsers(), 0, 'Quedaron usuarios de prueba en la base')
    assert.equal(await sweepStorage(), 0, 'Quedaron archivos de prueba en el almacenamiento')
  })

  test('montaje: cada usuario tiene sus claims y solo los que le corresponden', async () => {
    const claims = async (u) => (await u.client.auth.getUser()).data.user.app_metadata
    assert.equal((await claims(ctx.a)).site_id, ctx.siteA)
    assert.equal((await claims(ctx.b)).site_id, ctx.siteB)
    assert.equal((await claims(ctx.admin)).role, 'admin')
    assert.equal((await claims(ctx.admin)).site_id, undefined)
    const sin = await claims(ctx.sinSitio)
    assert.equal(sin.site_id, undefined)
    assert.equal(sin.role, undefined)
  })

  test('montaje: el cliente anónimo no tiene sesión', async () => {
    const { data } = await ctx.anon.auth.getSession()
    assert.equal(data.session, null)
  })

  // ── T4 · forma del esquema (RF-1, RF-2, RF-3) ──────────────────────────────

  for (const table of FIVE_TABLES) {
    test(`RF-1: ${table} no admite filas sin sitio`, async () => {
      const { error } = await ctx.svc.from(table).insert({})
      assert.ok(error, 'se aceptó una fila sin site_id')
      assert.equal(error.code, '23502', `esperaba not-null, llegó ${error.code}: ${error.message}`)
      assert.match(error.message, /site_id/, 'el not-null no es sobre site_id')
    })
  }

  test('RF-2: cada tabla tiene exactamente los campos del modelo, sin columnas heredadas', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SERVICE_KEY } })
    assert.equal(res.status, 200)
    const { definitions } = await res.json()
    for (const [table, expected] of Object.entries(EXPECTED_COLUMNS)) {
      assert.ok(definitions[table], `no existe la tabla ${table}`)
      assert.deepEqual(Object.keys(definitions[table].properties).sort(), [...expected].sort(), `columnas de ${table}`)
    }
  })

  test('RF-3: una segunda configuración para el mismo sitio se rechaza', async () => {
    const siteId = `${PREFIX}${ctx.runId}-dup`
    const first = await ctx.svc.from('site_config').insert({ site_id: siteId, business_name: 'Uno' })
    assert.ifError(first.error)
    const second = await ctx.svc.from('site_config').insert({ site_id: siteId, business_name: 'Dos' })
    assert.ok(second.error, 'se aceptó una segunda configuración')
    assert.equal(second.error.code, '23505', `esperaba unicidad, llegó ${second.error.code}`)
  })

  for (const table of CHILD_TABLES) {
    test(`RF-3: ${table} no admite un sitio sin configuración`, async () => {
      const orphan = `${PREFIX}${ctx.runId}-huerfano`
      const { error } = await ctx.svc.from(table).insert({ site_id: orphan })
      assert.ok(error, 'se aceptó una fila de un sitio sin configuración')
      assert.equal(error.code, '23503', `esperaba clave foránea, llegó ${error.code}: ${error.message}`)
    })
  }

  // ── T5 · aislamiento entre clientes (RF-4, RF-5, RF-7) ─────────────────────

  for (const table of FIVE_TABLES) {
    test(`RF-4: A lee solo lo suyo en ${table}`, async () => {
      const ids = await seed()
      const { data, error } = await ctx.a.client.from(table).select('id, site_id')
      assert.ifError(error)
      assert.ok(data.some((r) => r.id === ids.a[table]), 'A no ve su propia fila')
      assert.ok(data.every((r) => r.site_id === ctx.siteA), 'A ve filas de otro sitio')
    })

    test(`RF-4: A edita lo suyo en ${table}`, async () => {
      const ids = await seed()
      const { data, error } = await ctx.a.client.from(table).update({ [EDIT_FIELD[table]]: 'editado por A' }).eq('id', ids.a[table]).select('id')
      assert.ifError(error)
      assert.equal(data.length, 1, 'A no pudo editar su propia fila')
    })

    test(`RF-4: A no crea filas a nombre de B en ${table}`, async () => {
      await seed()
      const { error } = await ctx.a.client.from(table).insert(NEW_ROW[table](ctx.siteB))
      assert.ok(error, 'A creó una fila a nombre de B')
    })

    test(`RF-4: A no cambia filas de B en ${table}`, async () => {
      const ids = await seed()
      const { data, error } = await ctx.a.client.from(table).update({ [EDIT_FIELD[table]]: 'hackeado por A' }).eq('id', ids.b[table]).select('id')
      assert.ok(error || data.length === 0, 'A cambió una fila de B')
      const { data: after } = await ctx.svc.from(table).select(EDIT_FIELD[table]).eq('id', ids.b[table]).single()
      assert.notEqual(after[EDIT_FIELD[table]], 'hackeado por A')
    })

    test(`RF-4: A no borra filas de B en ${table}`, async () => {
      const ids = await seed()
      const { data, error } = await ctx.a.client.from(table).delete().eq('id', ids.b[table]).select('id')
      assert.ok(error || data.length === 0, 'A borró una fila de B')
      const { data: still } = await ctx.svc.from(table).select('id').eq('id', ids.b[table])
      assert.equal(still.length, 1, 'la fila de B desapareció')
    })

    test(`RF-7: A no mueve una fila suya al sitio de B en ${table}`, async () => {
      const ids = await seed()
      const { error } = await ctx.a.client.from(table).update({ site_id: ctx.siteB }).eq('id', ids.a[table]).select('id')
      assert.ok(error, 'A movió una fila suya al sitio de B')
      const { data: still } = await ctx.svc.from(table).select('site_id').eq('id', ids.a[table]).single()
      assert.equal(still.site_id, ctx.siteA, 'la fila cambió de sitio')
    })

    test(`RF-5: un usuario sin sitio ni rol no alcanza nada en ${table}`, async () => {
      await seed()
      const read = await ctx.sinSitio.client.from(table).select('id')
      assert.ifError(read.error)
      assert.equal(read.data.length, 0, 'un usuario sin sitio ve filas')
      const write = await ctx.sinSitio.client.from(table).insert(NEW_ROW[table](ctx.siteA))
      assert.ok(write.error, 'un usuario sin sitio pudo escribir')
    })
  }

  test('RF-5: un usuario cuyo sitio no tiene configuración no alcanza datos ajenos ni crea elementos', async () => {
    await seed()
    const fantasma = await makeUser('fantasma', { siteId: `${PREFIX}${ctx.runId}-fantasma` })
    for (const table of FIVE_TABLES) {
      const read = await fantasma.client.from(table).select('id')
      assert.ifError(read.error)
      assert.equal(read.data.length, 0, `ve filas en ${table}`)
    }
    const write = await fantasma.client.from('services').insert(NEW_ROW.services(fantasma.siteId))
    assert.ok(write.error, 'creó un servicio en un sitio sin configuración')
  })

  // ── T6 · sin sesión (RF-6). El enlace de despliegue ya no está en site_config: ver «site_deploy» más abajo ──

  for (const table of FIVE_TABLES) {
    test(`RF-6: sin sesión no se lee nada en ${table}`, async () => {
      await seed()
      const { error } = await ctx.anon.from(table).select('*')
      assert.equal(error?.code, DENIED, 'el visitante sin sesión no recibió "permiso denegado" al leer')
    })

    test(`RF-6: sin sesión no se escribe en ${table}`, async () => {
      const ids = await seed()
      const insert = await ctx.anon.from(table).insert(NEW_ROW[table](ctx.siteA))
      assert.equal(insert.error?.code, DENIED, 'crear sin sesión no recibió "permiso denegado"')
      const update = await ctx.anon.from(table).update({ [EDIT_FIELD[table]]: 'hackeado sin sesión' }).eq('id', ids.a[table]).select('id')
      assert.equal(update.error?.code, DENIED, 'cambiar sin sesión no recibió "permiso denegado"')
      const del = await ctx.anon.from(table).delete().eq('id', ids.a[table]).select('id')
      assert.equal(del.error?.code, DENIED, 'borrar sin sesión no recibió "permiso denegado"')
      const { data: still } = await ctx.svc.from(table).select(EDIT_FIELD[table]).eq('id', ids.a[table])
      assert.equal(still.length, 1, 'la fila desapareció')
      assert.notEqual(still[0][EDIT_FIELD[table]], 'hackeado sin sesión')
    })
  }

  test('RF-14: B lee solo la configuración de su sitio', async () => {
    await seed()
    const { data, error } = await ctx.b.client.from('site_config').select('site_id')
    assert.ifError(error)
    assert.ok(data.length >= 1 && data.every((r) => r.site_id === ctx.siteB), 'B ve la configuración de otro sitio')
  })

  test('spec 002 RF-11: site_config ya no guarda el enlace de despliegue (vive en site_deploy, solo de servidor)', async () => {
    await seed()
    for (const client of [ctx.svc, ctx.a.client]) {
      const { error } = await client.from('site_config').select('vercel_deploy_hook')
      assert.equal(error?.code, '42703', `la columna vercel_deploy_hook sigue existiendo (${error?.code})`)
    }
  })

  // ── T7 · permisos sobre la configuración y los elementos (RF-8, RF-9) ──────

  for (const table of CHILD_TABLES) {
    test(`RF-8: A crea, edita y borra sus propios elementos en ${table}`, async () => {
      await seed()
      const created = await ctx.a.client.from(table).insert(NEW_ROW[table](ctx.siteA)).select('id').single()
      assert.ifError(created.error)
      const id = created.data.id
      const updated = await ctx.a.client.from(table).update({ [EDIT_FIELD[table]]: 'cambiado' }).eq('id', id).select('id')
      assert.ifError(updated.error)
      assert.equal(updated.data.length, 1, 'A no pudo editar lo que creó')
      const removed = await ctx.a.client.from(table).delete().eq('id', id).select('id')
      assert.ifError(removed.error)
      assert.equal(removed.data.length, 1, 'A no pudo borrar lo que creó')
      const { data: gone } = await ctx.svc.from(table).select('id').eq('id', id)
      assert.equal(gone.length, 0, 'el elemento sigue existiendo')
    })
  }

  test('RF-8: el cliente no puede crear la configuración de su propio sitio', async () => {
    await seed()
    const c = await makeUser('c', { siteId: `${PREFIX}${ctx.runId}-c` })
    const { error } = await c.client.from('site_config').insert(NEW_ROW.site_config(c.siteId))
    assert.ok(error, 'un cliente creó la configuración de su sitio')
    const { data } = await ctx.svc.from('site_config').select('id').eq('site_id', c.siteId)
    assert.equal(data.length, 0, 'quedó una configuración creada por un cliente')
  })

  test('RF-8: el cliente no puede borrar la configuración de su sitio', async () => {
    const ids = await seed()
    const { data, error } = await ctx.a.client.from('site_config').delete().eq('id', ids.a.site_config).select('id')
    assert.ok(error || data.length === 0, 'un cliente borró la configuración de su sitio')
    const { data: still } = await ctx.svc.from('site_config').select('id').eq('id', ids.a.site_config)
    assert.equal(still.length, 1, 'la configuración desapareció')
  })

  test('RF-9: el admin sí puede crear la configuración de un sitio', async () => {
    await seed()
    const site = `${PREFIX}${ctx.runId}-nuevo`
    const { error } = await ctx.admin.client.from('site_config').insert(NEW_ROW.site_config(site))
    assert.ifError(error)
    const { data } = await ctx.svc.from('site_config').select('site_id').eq('site_id', site)
    assert.equal(data.length, 1)
  })

  // ── Spec 001 · campos del contrato (RF-10, RF-11) ──────────────────────────

  const NEW_FIELDS = {
    site_config: { language: 'en', about_title: 'Quiénes somos', about_body: 'Texto', about_stats: [{ value: '+14', label: 'años' }], about_highlights: ['Uno'], hero_cta_primary_label: 'Contactanos', hero_cta_primary_href: '#contacto', hero_cta_secondary_label: 'Ver', hero_cta_secondary_href: '#servicios', currency: 'USD', show_prices: false, group_by_category: true, product_cta_label: 'Consultar', section_titles: { services: { title: 'Lo que hacemos' } } },
    testimonials: { role: 'Cliente' },
    products: { slug: 'campo-nuevo' },
  }

  for (const [table, fields] of Object.entries(NEW_FIELDS)) {
    test(`RF-10: A edita los campos nuevos de lo suyo en ${table}`, async () => {
      const ids = await seed()
      const { data, error } = await ctx.a.client.from(table).update(fields).eq('id', ids.a[table]).select('id')
      assert.ifError(error)
      assert.equal(data.length, 1, 'A no pudo editar los campos nuevos de su fila')
      const { data: after } = await ctx.svc.from(table).select(Object.keys(fields).join(',')).eq('id', ids.a[table]).single()
      assert.deepEqual(after, fields)
    })

    test(`RF-10: A no lee ni edita los campos nuevos de B en ${table}`, async () => {
      const ids = await seed()
      const cols = Object.keys(fields).join(',')
      const read = await ctx.a.client.from(table).select(`site_id, ${cols}`)
      assert.ifError(read.error)
      assert.ok(read.data.every((r) => r.site_id === ctx.siteA), 'A ve campos nuevos de otro sitio')
      const { data, error } = await ctx.a.client.from(table).update(fields).eq('id', ids.b[table]).select('id')
      assert.ok(error || data.length === 0, 'A editó campos nuevos de B')
    })
  }

  test('RF-10: una fila nueva de configuración trae los valores por defecto', async () => {
    const site = `${PREFIX}${ctx.runId}-defecto`
    const { data, error } = await ctx.svc.from('site_config').insert({ site_id: site }).select('*').single()
    assert.ifError(error)
    assert.equal(data.language, 'es')
    assert.deepEqual([data.about_stats, data.about_highlights, data.section_titles], [[], [], {}])
    assert.deepEqual([data.currency, data.show_prices, data.group_by_category], ['ARS', true, false])
    assert.equal(data.about_title, null)
  })

  test('RF-5: el slug es único por sitio y puede repetirse entre sitios', async () => {
    await seed()
    const slug = 'mismo-slug'
    assert.ifError((await ctx.svc.from('products').insert({ ...NEW_ROW.products(ctx.siteA), slug })).error)
    const dup = await ctx.svc.from('products').insert({ ...NEW_ROW.products(ctx.siteA), slug })
    assert.equal(dup.error?.code, '23505', 'se aceptó un slug repetido en el mismo sitio')
    assert.ifError((await ctx.svc.from('products').insert({ ...NEW_ROW.products(ctx.siteB), slug })).error)
  })

  // ── Spec 002 · site_deploy, solo de servidor (RF-7, RF-11, RF-13) ──────────

  const SITE_DEPLOY_COLUMNS = ['site_id', 'deploy_hook', 'github_repo', 'github_branch', 'vercel_project_id', 'status', 'locked_at', 'started_at', 'published_data', 'published_schema_version', 'published_at', 'published_by', 'last_commit_sha', 'last_message', 'updated_at']
  const HOOK_SECRET = 'https://example.com/hook-site-deploy-secreto'
  let deployPromise
  function seedDeploy() {
    deployPromise ??= (async () => {
      await seed()
      for (const site of [ctx.siteA, ctx.siteB]) {
        const { error } = await ctx.svc.from('site_deploy').upsert({ site_id: site, deploy_hook: HOOK_SECRET, status: 'idle', locked_at: null })
        if (error) throw new Error(`montaje: no se pudo sembrar site_deploy de ${site}: ${error.message}`)
      }
    })()
    return deployPromise
  }
  // La toma del bloqueo del plan: un solo UPDATE condicionado (entra solo si no hay publicación en curso o ya venció).
  const acquire = (site, minutes = 10) =>
    ctx.svc.from('site_deploy')
      .update({ status: 'publishing', locked_at: new Date().toISOString() })
      .eq('site_id', site)
      .or(`status.neq.publishing,locked_at.lt.${new Date(Date.now() - minutes * 60_000).toISOString()}`)
      .select('site_id')

  test('RF-11: site_deploy tiene exactamente las columnas del modelo', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SERVICE_KEY } })
    const { definitions } = await res.json()
    assert.ok(definitions.site_deploy, 'no existe la tabla site_deploy')
    assert.deepEqual(Object.keys(definitions.site_deploy.properties).sort(), [...SITE_DEPLOY_COLUMNS].sort())
  })

  for (const [who, get] of [['A', () => ctx.a.client], ['B', () => ctx.b.client], ['admin', () => ctx.admin.client], ['sin sesión', () => ctx.anon]]) {
    test(`RF-13: ${who} no lee ni escribe site_deploy (permiso denegado)`, async () => {
      await seedDeploy()
      const client = get()
      const read = await client.from('site_deploy').select('*')
      assert.equal(read.error?.code, DENIED, `leer no recibió "permiso denegado" (${read.error?.code})`)
      assert.ok(!JSON.stringify(read.data ?? []).includes(HOOK_SECRET), 'se filtró el enlace de despliegue')
      const insert = await client.from('site_deploy').insert({ site_id: ctx.siteA })
      assert.equal(insert.error?.code, DENIED, 'crear no recibió "permiso denegado"')
      const update = await client.from('site_deploy').update({ status: 'published' }).eq('site_id', ctx.siteA).select('site_id')
      assert.equal(update.error?.code, DENIED, 'cambiar no recibió "permiso denegado"')
      const del = await client.from('site_deploy').delete().eq('site_id', ctx.siteA).select('site_id')
      assert.equal(del.error?.code, DENIED, 'borrar no recibió "permiso denegado"')
      const { data: still } = await ctx.svc.from('site_deploy').select('status, deploy_hook').eq('site_id', ctx.siteA).single()
      assert.deepEqual([still.status, still.deploy_hook], ['idle', HOOK_SECRET])
    })
  }

  test('RF-7: dos publicaciones a la vez del mismo sitio: entra solo una', async () => {
    await seedDeploy()
    await ctx.svc.from('site_deploy').update({ status: 'idle', locked_at: null }).eq('site_id', ctx.siteA)
    const results = await Promise.all([acquire(ctx.siteA), acquire(ctx.siteA)])
    results.forEach((r) => assert.ifError(r.error))
    assert.equal(results.filter((r) => r.data.length === 1).length, 1, 'entraron dos publicaciones (o ninguna)')
  })

  test('RF-7: una publicación sin terminar se libera a los 10 minutos, no antes', async () => {
    await seedDeploy()
    const lockedAgo = (minutes) => ctx.svc.from('site_deploy').update({ status: 'publishing', locked_at: new Date(Date.now() - minutes * 60_000).toISOString() }).eq('site_id', ctx.siteB)
    assert.ifError((await lockedAgo(5)).error)
    assert.equal((await acquire(ctx.siteB)).data.length, 0, 'entró otra publicación con la anterior reciente')
    assert.ifError((await lockedAgo(11)).error)
    assert.equal((await acquire(ctx.siteB)).data.length, 1, 'no se liberó una publicación vencida')
  })

  test('RF-13: el bloqueo de un sitio no afecta a otro', async () => {
    await seedDeploy()
    await ctx.svc.from('site_deploy').update({ status: 'idle', locked_at: null }).in('site_id', [ctx.siteA, ctx.siteB])
    assert.equal((await acquire(ctx.siteA)).data.length, 1)
    assert.equal((await acquire(ctx.siteB)).data.length, 1)
  })

  test('RF-11: al borrar la configuración de un sitio se borra su site_deploy', async () => {
    const site = `${PREFIX}${ctx.runId}-casc`
    assert.ifError((await ctx.svc.from('site_config').insert({ site_id: site })).error)
    assert.ifError((await ctx.svc.from('site_deploy').insert({ site_id: site })).error)
    assert.ifError((await ctx.svc.from('site_config').delete().eq('site_id', site)).error)
    const { data } = await ctx.svc.from('site_deploy').select('site_id').eq('site_id', site)
    assert.equal(data.length, 0, 'quedó un site_deploy huérfano')
  })

  test('RF-11: site_deploy no admite un sitio sin configuración', async () => {
    const { error } = await ctx.svc.from('site_deploy').insert({ site_id: `${PREFIX}${ctx.runId}-sin-config` })
    assert.equal(error?.code, '23503', `esperaba clave foránea, llegó ${error?.code}`)
  })

  // ── T8 · almacenamiento de imágenes (RF-13) ────────────────────────────────

  const store = (client) => client.storage.from(BUCKET)
  const upload = (client, path, options = {}) => store(client).upload(path, PNG, { contentType: 'image/png', ...options })
  async function objectExists(path) {
    const [folder, name] = path.split('/')
    const { data } = await store(ctx.svc).list(folder)
    return (data ?? []).some((f) => f.name === name)
  }

  test('RF-13: A sube, reemplaza y borra imágenes en el espacio de su sitio', async () => {
    const path = `${ctx.siteA}/propia.png`
    assert.ifError((await upload(ctx.a.client, path)).error)
    assert.ifError((await upload(ctx.a.client, path, { upsert: true })).error)
    assert.ifError((await store(ctx.a.client).remove([path])).error)
    assert.equal(await objectExists(path), false, 'la imagen no se borró')
  })

  test('RF-13: A no sube imágenes al espacio de B', async () => {
    const path = `${ctx.siteB}/intruso.png`
    const { error } = await upload(ctx.a.client, path)
    assert.ok(error, 'A subió una imagen al espacio de B')
    assert.equal(await objectExists(path), false)
  })

  test('RF-13: A no reemplaza ni borra imágenes de B', async () => {
    const path = `${ctx.siteB}/de-b.png`
    assert.ifError((await upload(ctx.svc, path, { upsert: true })).error)
    const replace = await upload(ctx.a.client, path, { upsert: true })
    assert.ok(replace.error, 'A reemplazó una imagen de B')
    const del = await store(ctx.a.client).remove([path])
    assert.ok(del.error || del.data.length === 0, 'A borró una imagen de B')
    assert.equal(await objectExists(path), true, 'la imagen de B desapareció')
  })

  test('RF-13: sin sesión no se suben imágenes ni se listan las de un sitio', async () => {
    const mine = `${ctx.siteA}/visible.png`
    assert.ifError((await upload(ctx.svc, mine, { upsert: true })).error)
    const { error } = await upload(ctx.anon, `${ctx.siteA}/anonimo.png`)
    assert.ok(error, 'un visitante sin sesión subió una imagen')
    const list = await store(ctx.anon).list(ctx.siteA)
    assert.ok(list.error || list.data.length === 0, 'un visitante sin sesión listó imágenes')
  })

  test('RF-13: el admin sube imágenes al espacio de cualquier sitio', async () => {
    const { error } = await upload(ctx.admin.client, `${ctx.siteB}/del-admin.png`)
    assert.ifError(error)
  })

  test('RF-13: la URL pública de una imagen se ve sin sesión', async () => {
    const path = `${ctx.siteA}/publica.png`
    assert.ifError((await upload(ctx.svc, path, { upsert: true })).error)
    const { publicUrl } = store(ctx.anon).getPublicUrl(path).data
    const res = await fetch(publicUrl)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /^image\//)
  })

  // ── T9 · admin y suplantación (RF-4, RF-12, RF-13) ─────────────────────────

  test('RF-12: un cliente que se pone rol admin y otro sitio en su perfil editable no gana acceso', async () => {
    const ids = await seed()
    const intruso = await makeUser('intruso', { siteId: ctx.siteA })
    const { error } = await intruso.client.auth.updateUser({ data: { role: 'admin', site_id: ctx.siteB } })
    assert.ifError(error)
    assert.ifError((await intruso.client.auth.refreshSession()).error)
    const claims = (await intruso.client.auth.getUser()).data.user
    assert.equal(claims.app_metadata.role, undefined, 'el perfil editable cambió el rol real')
    assert.equal(claims.app_metadata.site_id, ctx.siteA, 'el perfil editable cambió el sitio real')
    for (const table of FIVE_TABLES) {
      const read = await intruso.client.from(table).select('id, site_id')
      assert.ifError(read.error)
      assert.ok(read.data.every((r) => r.site_id === ctx.siteA), `el intruso ve filas ajenas en ${table}`)
    }
    const write = await intruso.client.from('services').update({ description: 'hackeado' }).eq('id', ids.b.services).select('id')
    assert.ok(write.error || write.data.length === 0, 'el intruso cambió una fila de B')
    const up = await upload(intruso.client, `${ctx.siteB}/intruso-perfil.png`)
    assert.ok(up.error, 'el intruso subió una imagen al espacio de B')
  })

  for (const table of FIVE_TABLES) {
    test(`RF-4: el admin lee y edita datos de cualquier sitio en ${table}`, async () => {
      const ids = await seed()
      const read = await ctx.admin.client.from(table).select('id, site_id')
      assert.ifError(read.error)
      assert.ok(read.data.some((r) => r.id === ids.a[table]), 'el admin no ve la fila de A')
      assert.ok(read.data.some((r) => r.id === ids.b[table]), 'el admin no ve la fila de B')
      for (const key of ['a', 'b']) {
        const { data, error } = await ctx.admin.client.from(table).update({ [EDIT_FIELD[table]]: 'editado por admin' }).eq('id', ids[key][table]).select('id')
        assert.ifError(error)
        assert.equal(data.length, 1, `el admin no pudo editar la fila de ${key}`)
      }
    })
  }

  test('RF-13: el admin sube y borra imágenes en el espacio de cualquier sitio', async () => {
    for (const site of [ctx.siteA, ctx.siteB]) {
      const path = `${site}/por-admin.png`
      assert.ifError((await upload(ctx.admin.client, path)).error)
      assert.ifError((await upload(ctx.admin.client, path, { upsert: true })).error)
      const del = await store(ctx.admin.client).remove([path])
      assert.ifError(del.error)
      assert.equal(await objectExists(path), false, `no se borró la imagen de ${site}`)
    }
  })

  test('RF-4: el admin no crea elementos de un sitio que no existe', async () => {
    await seed()
    const { error } = await ctx.admin.client.from('services').insert(NEW_ROW.services(`${PREFIX}${ctx.runId}-inexistente`))
    assert.ok(error, 'el admin creó un servicio en un sitio sin configuración')
  })

  // ── T10 · no se crean otras tablas (RF-15) ─────────────────────────────────
  // La estructura de las cinco se compara además con la línea base (tarea T20).

  test('RF-15: las únicas tablas del panel son los cinco conjuntos y site_deploy (spec 002, solo de servidor)', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SERVICE_KEY } })
    assert.equal(res.status, 200)
    const { definitions } = await res.json()
    assert.deepEqual(Object.keys(definitions).sort(), [...FIVE_TABLES, 'site_deploy'].sort())
  })

  // ── La forma real de guardar del panel (src/lib/supabase/queries.ts) ───────
  // Reproduce sus consultas: si cambian allí, cambiar aquí. Detecta reglas que rompen el guardado.

  test('RF-8: el panel guarda la configuración con update y funciona para el cliente', async () => {
    await seed()
    const { data, error } = await ctx.a.client.from('site_config').update({ tagline: 'guardado por el panel' }).eq('site_id', ctx.siteA).select('id')
    assert.ifError(error)
    assert.equal(data.length, 1)
  })

  test('RF-8: un upsert de la configuración no es válido para el cliente (por eso el panel usa update)', async () => {
    await seed()
    const { error } = await ctx.a.client.from('site_config').upsert({ site_id: ctx.siteA, tagline: 'upsert' }, { onConflict: 'site_id' })
    assert.equal(error?.code, DENIED)
  })

  test('RF-8: el código del panel no guarda la configuración con upsert', () => {
    const source = readFileSync(new URL('../../src/lib/supabase/queries.ts', import.meta.url), 'utf8')
    const start = source.indexOf('export async function upsertSiteConfig')
    const end = source.indexOf('export async function', start + 1)
    assert.ok(start >= 0, 'no se encontró upsertSiteConfig')
    assert.ok(!source.slice(start, end).includes('.upsert('), 'upsertSiteConfig usa upsert: fallará para los clientes')
  })

  for (const table of CHILD_TABLES) {
    test(`RF-8: el panel guarda elementos de ${table} con upsert (alta y cambio) y funciona para el cliente`, async () => {
      await seed()
      const created = await ctx.a.client.from(table).upsert({ ...NEW_ROW[table](ctx.siteA) }).select('id').single()
      assert.ifError(created.error)
      const changed = await ctx.a.client.from(table).upsert({ id: created.data.id, site_id: ctx.siteA, [EDIT_FIELD[table]]: 'cambiado por upsert' }).select('id')
      assert.ifError(changed.error)
      assert.equal(changed.data.length, 1)
    })
  }
})
