'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSiteUser } from '@/lib/supabase/require-site-user'
import { makeDeps } from '@/lib/publish/server-deps'
import { publishSite, retryDeploy, getPublishStatus } from '@/lib/publish/publish'
import type { PublishResult, PublishStatus } from '@/lib/publish/publish'
import { buildSiteData } from '@/lib/publish/build-site-data'
import { locateErrors, errorsForSection } from '@/lib/publish/locate-errors'
import type { LocatedError, Section } from '@/lib/publish/locate-errors'

// Todas las acciones empiezan por requireSiteUser(): se pueden invocar por fuera de la interfaz y NINGUNA recibe el sitio
// como parámetro (sale de la sesión). Nunca devuelven enlaces, repositorios ni tokens.
type Failed = { ok: false; message: string }
type PublishAction = { ok: true; result: PublishResult } | Failed
type StatusAction = { ok: true; status: PublishStatus } | Failed
type IssuesAction = { ok: true; issues: LocatedError[] } | Failed

const UNAVAILABLE: Failed = { ok: false, message: 'No se pudo completar la operación. Intentá de nuevo en unos minutos.' }
const SECTIONS: Section[] = ['negocio', 'servicios', 'catalogo', 'testimonios', 'imagenes', 'redes']

export async function publish(): Promise<PublishAction> {
  const auth = await requireSiteUser()
  if (!auth.ok) return auth
  try {
    return { ok: true, result: await publishSite(auth.siteId, auth.userId, makeDeps(await createClient())) }
  } catch {
    return UNAVAILABLE
  }
}

export async function retry(): Promise<PublishAction> {
  const auth = await requireSiteUser()
  if (!auth.ok) return auth
  try {
    return { ok: true, result: await retryDeploy(auth.siteId, auth.userId, makeDeps(await createClient())) }
  } catch {
    return UNAVAILABLE
  }
}

export async function getStatus(): Promise<StatusAction> {
  const auth = await requireSiteUser()
  if (!auth.ok) return auth
  try {
    return { ok: true, status: await getPublishStatus(auth.siteId, makeDeps(await createClient())) }
  } catch {
    return UNAVAILABLE
  }
}

// Problemas de lo ya guardado respecto del contrato, filtrados por la sección que se abre (RF-12).
export async function getSectionIssues(section: Section): Promise<IssuesAction> {
  const auth = await requireSiteUser()
  if (!auth.ok) return auth
  if (!SECTIONS.includes(section)) return UNAVAILABLE
  try {
    const deps = makeDeps(await createClient())
    const rows = await deps.loadRows(auth.siteId)
    if (!rows) return { ok: true, issues: [] }
    const { data, sources } = buildSiteData(rows)
    const report = deps.validate(data)
    return { ok: true, issues: errorsForSection(locateErrors(report.errors, data, sources), section) }
  } catch {
    return UNAVAILABLE
  }
}
