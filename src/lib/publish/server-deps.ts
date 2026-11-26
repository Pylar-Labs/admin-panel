import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateSite, SCHEMA_VERSION } from '@/lib/contract/vendor/content/site.schema'
import { createGithub } from '@/lib/publish/github'
import { createVercel, triggerDeploy } from '@/lib/publish/vercel'
import type { Deps, DeployRow } from '@/lib/publish/publish'
import type { SiteRows } from '@/lib/publish/build-site-data'

// Único lugar que lee los tokens (GITHUB_TOKEN, VERCEL_TOKEN) y toca `site_deploy` con la clave de servidor.
// Si falta un token, falla recién al usarlo con un error `MissingCredentials` (el flujo lo traduce a un mensaje claro).
function need(name: string): string {
  const value = process.env[name]
  if (!value) {
    const error = new Error(`Falta ${name} en el entorno del servidor`)
    error.name = 'MissingCredentials'
    throw error
  }
  return value
}
const throwOn = (error: { message: string } | null) => { if (error) throw new Error(error.message) }

// `userClient`: la sesión del usuario (las reglas de acceso por sitio aplican a lo que se lee para publicar).
export function makeDeps(userClient: SupabaseClient): Deps {
  const admin = createAdminClient()
  const deploy = () => admin.from('site_deploy')
  const github = () => createGithub({ token: need('GITHUB_TOKEN') })
  const vercel = () => createVercel({ token: need('VERCEL_TOKEN'), teamId: process.env.VERCEL_TEAM_ID || undefined })

  return {
    now: () => Date.now(),
    schemaVersion: SCHEMA_VERSION,
    validate: (data) => validateSite(data),

    async ensureRow(siteId) {
      const { error } = await deploy().upsert({ site_id: siteId }, { onConflict: 'site_id', ignoreDuplicates: true })
      if (error?.code === '23503') { // clave foránea: el sitio no tiene configuración
        const noConfig = new Error('El sitio no tiene configuración')
        noConfig.name = 'NoConfig'
        throw noConfig
      }
      throwOn(error)
    },
    // Un único UPDATE condicionado: entra solo si no hay una publicación en curso (o la anterior ya venció o perdió su hora).
    async acquire(siteId, nowIso, cutoffIso) {
      const before = await deploy().select('*').eq('site_id', siteId).maybeSingle()
      throwOn(before.error)
      const { data, error } = await deploy()
        .update({ status: 'publishing', locked_at: nowIso, updated_at: nowIso })
        .eq('site_id', siteId)
        .or(`status.neq.publishing,locked_at.is.null,locked_at.lt.${cutoffIso}`)
        .select('*')
      throwOn(error)
      if (!data?.length) return null
      return { prev: before.data as DeployRow, row: data[0] as DeployRow }
    },
    async restore(siteId, prev) {
      // Nunca se restaura «en curso»: sin hora de bloqueo quedaría trabado.
      const status = prev.status === 'publishing' ? 'idle' : prev.status
      throwOn((await deploy().update({ status, locked_at: null, updated_at: new Date().toISOString() }).eq('site_id', siteId)).error)
    },
    async update(siteId, patch) {
      throwOn((await deploy().update({ ...patch, updated_at: new Date().toISOString() }).eq('site_id', siteId)).error)
    },
    async saveVersion(siteId, patch) {
      throwOn((await deploy().update({ ...patch, updated_at: new Date().toISOString() }).eq('site_id', siteId)).error)
    },
    async getRow(siteId) {
      const { data, error } = await deploy().select('*').eq('site_id', siteId).maybeSingle()
      throwOn(error)
      return (data as DeployRow | null) ?? null
    },

    async loadRows(siteId): Promise<SiteRows | null> {
      const config = await userClient.from('site_config').select('*').eq('site_id', siteId).maybeSingle()
      throwOn(config.error)
      if (!config.data) return null
      const [services, products, testimonials] = await Promise.all(
        ['services', 'products', 'testimonials'].map((table) => userClient.from(table).select('*').eq('site_id', siteId))
      )
      for (const r of [services, products, testimonials]) throwOn(r.error)
      return { config: config.data, services: services.data ?? [], products: products.data ?? [], testimonials: testimonials.data ?? [] } as SiteRows
    },

    github: {
      readSchemaVersion: (repo, branch) => github().readSchemaVersion(repo, branch),
      writeData: (repo, branch, content, message) => github().writeData(repo, branch, content, message),
    },
    vercel: {
      latestDeployment: (projectId, opts) => vercel().latestDeployment(projectId, opts),
      trigger: (hook) => triggerDeploy(hook),
    },
  }
}
