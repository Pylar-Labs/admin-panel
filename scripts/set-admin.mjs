// Designa (o quita) a un admin de la agencia. Se corre a mano, fuera del panel (spec 005, RF-1).
// Uso: node --env-file=.env.local scripts/set-admin.mjs <email> [--quitar]
// El rol va en app_metadata (solo editable con la clave de servidor); un admin no tiene sitio propio.
// El cambio llega al token del usuario cuando éste vuelve a iniciar sesión o se renueva su sesión.
import { createClient } from '@supabase/supabase-js'

const EXPECTED_HOST = 'eplnsjdvjawwijokoerk.supabase.co'
const [email, flag] = process.argv.slice(2)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!email || (flag && flag !== '--quitar')) {
  console.error('Uso: node --env-file=.env.local scripts/set-admin.mjs <email> [--quitar]')
  process.exit(1)
}
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}
if (new URL(url).host !== EXPECTED_HOST) {
  console.error(`.env.local no apunta a PylarLabs (${EXPECTED_HOST}); no se cambia nada`)
  process.exit(1)
}

const svc = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const wanted = email.trim().toLowerCase()

let found = null
for (let page = 1; !found; page++) {
  const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  found = data.users.find((u) => u.email?.toLowerCase() === wanted) ?? null
  if (data.users.length < 200) break
}
if (!found) {
  console.error(`No existe un usuario con el email ${wanted}`)
  process.exit(1)
}

// null borra la clave en app_metadata.
const app_metadata = flag === '--quitar' ? { role: null } : { role: 'admin', site_id: null }
const { error } = await svc.auth.admin.updateUserById(found.id, { app_metadata })
if (error) throw error
console.log(flag === '--quitar' ? `${wanted} ya no es admin` : `${wanted} ahora es admin (sin sitio propio)`)
