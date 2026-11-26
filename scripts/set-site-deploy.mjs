// Carga los datos de entrega de un sitio (spec 002): repositorio de su web, rama, proyecto de Vercel y enlace de despliegue.
// Se corre a mano, fuera del panel (como set-admin.mjs). Idempotente: repetirlo no duplica nada; solo cambia lo que se pasa.
// Uso: node --env-file=.env.local scripts/set-site-deploy.mjs <site_id> [--repo propietario/nombre] [--branch main] [--project prj_xxx] [--hook https://...]
// El sitio debe tener ya su configuración (la crea el alta de clientes). No imprime el enlace.
import { createClient } from '@supabase/supabase-js'

const EXPECTED_HOST = 'eplnsjdvjawwijokoerk.supabase.co'
const [siteId, ...rest] = process.argv.slice(2)
const USAGE = 'Uso: node --env-file=.env.local scripts/set-site-deploy.mjs <site_id> [--repo propietario/nombre] [--branch main] [--project prj_xxx] [--hook https://...]'
const FLAGS = { '--repo': 'github_repo', '--branch': 'github_branch', '--project': 'vercel_project_id', '--hook': 'deploy_hook' }

const patch = {}
for (let i = 0; i < rest.length; i += 2) {
  const column = FLAGS[rest[i]]
  if (!column || !rest[i + 1] || rest[i + 1].startsWith('--')) { console.error(USAGE); process.exit(1) }
  patch[column] = rest[i + 1].trim()
}
if (!siteId || siteId.startsWith('--') || Object.keys(patch).length === 0) { console.error(USAGE); process.exit(1) }
if (patch.github_repo && !/^[\w.-]+\/[\w.-]+$/.test(patch.github_repo)) { console.error('--repo debe ser «propietario/nombre»'); process.exit(1) }
if (patch.deploy_hook && !/^https:\/\//.test(patch.deploy_hook)) { console.error('--hook debe empezar con https://'); process.exit(1) }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local'); process.exit(1) }
if (new URL(url).host !== EXPECTED_HOST) { console.error(`.env.local no apunta a PylarLabs (${EXPECTED_HOST}); no se cambia nada`); process.exit(1) }

const svc = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: config, error: configError } = await svc.from('site_config').select('site_id').eq('site_id', siteId).maybeSingle()
if (configError) throw configError
if (!config) {
  // exitCode y no process.exit: en Windows cortar justo después de una llamada de red imprime un error de libuv.
  console.error(`El sitio «${siteId}» no tiene configuración: primero hay que darlo de alta`)
  process.exitCode = 1
} else {
  const { error } = await svc.from('site_deploy').upsert({ site_id: siteId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'site_id' })
  if (error) throw error
  console.log(`Sitio ${siteId} actualizado: ${Object.keys(patch).join(', ')}`)
}
