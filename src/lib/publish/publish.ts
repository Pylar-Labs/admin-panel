// Flujo de publicación (spec 002). Lógica pura con las dependencias inyectadas (base, GitHub, Vercel, reloj), para
// probarla sin red. NO importa nada del servidor: los adaptadores reales viven en `server-only` y se pasan desde la acción.
import { buildSiteData } from './build-site-data.ts'
import type { SiteRows } from './build-site-data.ts'
import { locateErrors } from './locate-errors.ts'
import type { ContractError, LocatedError } from './locate-errors.ts'

const LOCK_MS = 10 * 60_000 // una publicación sin terminar se libera a los 10 minutos (RF-7)
export const MSG_SAVED_NOT_LIVE = 'Datos guardados, la web aún no se actualizó.'

export type Status = 'idle' | 'publishing' | 'saved' | 'published' | 'deploy_failed'
export type DeployRow = {
  site_id: string; deploy_hook: string | null; github_repo: string | null; github_branch: string; vercel_project_id: string | null
  status: Status; locked_at: string | null; started_at: string | null; published_data: Record<string, unknown> | null
  published_schema_version: string | null; published_at: string | null; published_by: string | null
  last_commit_sha: string | null; last_message: string | null
}
export type Deps = {
  now: () => number
  schemaVersion: string
  validate: (data: unknown) => { ok: boolean; schemaVersion: string; errors: ContractError[] }
  ensureRow: (siteId: string) => Promise<void>
  // Toma el bloqueo con un único UPDATE condicionado; devuelve la fila anterior y la nueva, o null si hay otra en curso.
  acquire: (siteId: string, nowIso: string, cutoffIso: string) => Promise<{ prev: DeployRow; row: DeployRow } | null>
  restore: (siteId: string, prev: DeployRow) => Promise<void>
  update: (siteId: string, patch: Partial<DeployRow>) => Promise<void>
  saveVersion: (siteId: string, patch: Partial<DeployRow>) => Promise<void> // lanza si no se pudo guardar
  getRow: (siteId: string) => Promise<DeployRow | null>
  loadRows: (siteId: string) => Promise<SiteRows | null> // lo último guardado, con la sesión del usuario (RLS)
  github: {
    readSchemaVersion: (repo: string, branch: string) => Promise<string | null>
    writeData: (repo: string, branch: string, content: string, message: string) => Promise<{ changed: boolean; sha?: string }>
  }
  vercel: {
    latestDeployment: (projectId: string | null, opts: { sinceMs: number; sha: string | null }) => Promise<{ state: string } | null>
    trigger: (hook: string) => Promise<void>
  }
}

export type PublishResult =
  | { status: 'saved' }
  | { status: 'errors'; errors: LocatedError[] }
  | { status: 'busy' | 'no_config' | 'not_configured' | 'version_mismatch' | 'unavailable' | 'save_failed' | 'deploy_failed'; message: string }

const isMissingCredentials = (e: unknown) => e instanceof Error && e.name === 'MissingCredentials'

// Escribe el archivo en el repositorio de la web; si no cambió (mismos datos) fuerza el despliegue con el enlace.
// Los datos ya están guardados: una falla aquí deja «datos guardados, la web aún no se actualizó» (RF-9).
async function deliver(siteId: string, row: DeployRow, data: Record<string, unknown>, deps: Deps, startedIso: string): Promise<PublishResult> {
  try {
    const written = await deps.github.writeData(row.github_repo ?? '', row.github_branch, JSON.stringify(data, null, 2) + '\n', 'Publicar datos del sitio desde el panel')
    if (!written.changed) {
      if (!row.deploy_hook) throw new Error('sin enlace de despliegue')
      await deps.vercel.trigger(row.deploy_hook)
    }
    await deps.update(siteId, { status: 'saved', locked_at: null, started_at: startedIso, last_commit_sha: written.changed ? written.sha ?? null : null, last_message: null })
    return { status: 'saved' }
  } catch {
    await deps.update(siteId, { status: 'deploy_failed', locked_at: null, started_at: startedIso, last_message: MSG_SAVED_NOT_LIVE })
    return { status: 'deploy_failed', message: MSG_SAVED_NOT_LIVE }
  }
}

const BUSY = 'Ya hay una publicación en curso. Esperá a que termine.'
const NO_CONFIG = 'Tu sitio todavía no tiene configuración. Pedile a la agencia que la cree.'
const UNAVAILABLE = 'No se pudo publicar. Intentá de nuevo en unos minutos.'

// Crea la fila de entrega del sitio si falta. Un sitio sin configuración no puede tenerla (la base lo rechaza).
async function ensure(siteId: string, deps: Deps): Promise<PublishResult | null> {
  try {
    await deps.ensureRow(siteId)
    return null
  } catch (e) {
    return e instanceof Error && e.name === 'NoConfig'
      ? { status: 'no_config', message: NO_CONFIG }
      : { status: 'unavailable', message: UNAVAILABLE }
  }
}

export async function publishSite(siteId: string, userId: string, deps: Deps): Promise<PublishResult> {
  const nowMs = deps.now()
  const nowIso = new Date(nowMs).toISOString()
  const missing = await ensure(siteId, deps)
  if (missing) return missing
  const got = await deps.acquire(siteId, nowIso, new Date(nowMs - LOCK_MS).toISOString())
  if (!got) return { status: 'busy', message: BUSY }
  const { prev, row } = got
  // Cualquier salida antes de guardar devuelve el sitio a su estado anterior: no queda el bloqueo tomado.
  const abort = async (result: PublishResult) => { await deps.restore(siteId, prev); return result }
  try {
    if (!row.github_repo) return await abort({ status: 'not_configured', message: 'Tu web todavía no está conectada para publicar. Pedile a la agencia que la configure.' })
    const web = await deps.github.readSchemaVersion(row.github_repo, row.github_branch)
    if (web !== deps.schemaVersion) {
      return await abort({ status: 'version_mismatch', message: `La versión del contrato del panel (${deps.schemaVersion}) no coincide con la de tu web (${web ?? 'desconocida'}). No se publicó nada: avisá a la agencia.` })
    }
    const rows = await deps.loadRows(siteId)
    if (!rows) return await abort({ status: 'no_config', message: NO_CONFIG })
    const { data, sources } = buildSiteData(rows)
    const report = deps.validate(data)
    if (!report.ok) return await abort({ status: 'errors', errors: locateErrors(report.errors, data, sources) })
    try {
      await deps.saveVersion(siteId, { published_data: data, published_schema_version: report.schemaVersion, published_at: nowIso, published_by: userId })
    } catch {
      return await abort({ status: 'save_failed', message: 'No se pudo guardar la versión. No cambió nada: intentá de nuevo.' })
    }
    return await deliver(siteId, row, data, deps, nowIso)
  } catch (e) {
    return await abort({
      status: 'unavailable',
      message: isMissingCredentials(e)
        ? 'El servidor todavía no tiene las credenciales para publicar. Avisá a la agencia.'
        : UNAVAILABLE,
    })
  }
}

// Reintenta la entrega de la última versión guardada, sin volver a validar (RF-9).
export async function retryDeploy(siteId: string, _userId: string, deps: Deps): Promise<PublishResult> {
  const nowMs = deps.now()
  const nowIso = new Date(nowMs).toISOString()
  const missing = await ensure(siteId, deps)
  if (missing) return missing
  const got = await deps.acquire(siteId, nowIso, new Date(nowMs - LOCK_MS).toISOString())
  if (!got) return { status: 'busy', message: BUSY }
  const { prev, row } = got
  if (!row.published_data || !row.github_repo) {
    await deps.restore(siteId, prev)
    return { status: 'not_configured', message: 'No hay datos guardados para reintentar. Publicá de nuevo.' }
  }
  return deliver(siteId, row, row.published_data, deps, nowIso)
}

export type PublishStatus = { status: Status; message: string | null; publishedAt: string | null }

// Estado que ven todos los usuarios del sitio. Nunca incluye enlaces, repositorio ni credenciales (RF-11).
// «Publicado» solo cuando Vercel confirma el despliegue (RF-10).
export async function getPublishStatus(siteId: string, deps: Deps): Promise<PublishStatus> {
  const row = await deps.getRow(siteId)
  if (!row) return { status: 'idle', message: null, publishedAt: null }
  const now = deps.now()
  let status = row.status
  let message = row.last_message
  if (status === 'publishing' && (!row.locked_at || Date.parse(row.locked_at) < now - LOCK_MS)) status = 'idle'
  if (status === 'saved') {
    const started = row.started_at ? Date.parse(row.started_at) : now
    let deployment: { state: string } | null = null
    try {
      deployment = await deps.vercel.latestDeployment(row.vercel_project_id, { sinceMs: started, sha: row.last_commit_sha })
    } catch {
      // Vercel no respondió: se sigue esperando (no se da por publicada ni por fallida).
    }
    if (deployment?.state === 'READY') {
      await deps.update(siteId, { status: 'published', last_message: null })
      status = 'published'
      message = null
    } else if (deployment?.state === 'ERROR' || deployment?.state === 'CANCELED' || now - started > LOCK_MS) {
      await deps.update(siteId, { status: 'deploy_failed', last_message: MSG_SAVED_NOT_LIVE })
      status = 'deploy_failed'
      message = MSG_SAVED_NOT_LIVE
    }
  }
  return { status, message: status === 'deploy_failed' ? message ?? MSG_SAVED_NOT_LIVE : null, publishedAt: status === 'published' ? row.published_at : null }
}
