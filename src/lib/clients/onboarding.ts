// Alta y lista de clientes (spec 005). Lógica sin dependencias del panel: recibe el cliente de
// administración (clave de servidor) para poder probarla desde Node. Solo debe usarse en el servidor.
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_NAME = 100
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PER_PAGE = 200

export type OnboardInput = { email: string; businessName: string; confirmDuplicateName?: boolean }

export type OnboardResult =
  | { status: 'created'; siteId: string; email: string; businessName: string }
  | { status: 'invalid'; message: string }
  | { status: 'email_taken'; message: string }
  | { status: 'confirm_name'; message: string }
  // `left`: lo que no se pudo deshacer y sigue creado (vacío si no quedó nada).
  | { status: 'failed'; message: string; left: string[] }

export type ClientRow = {
  siteId: string
  businessName: string
  email: string | null
  status: 'pendiente' | 'activo' | 'sin_usuario'
}

export function validateInput(input: { email: string; businessName: string }):
  | { ok: true; email: string; businessName: string }
  | { ok: false; message: string } {
  const email = String(input.email ?? '').trim().toLowerCase()
  const businessName = String(input.businessName ?? '').trim()
  if (!email) return { ok: false, message: 'Ingresá el email del cliente.' }
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, message: 'El email no tiene un formato válido.' }
  if (!businessName) return { ok: false, message: 'Ingresá el nombre del negocio.' }
  if (/[\r\n]/.test(businessName)) return { ok: false, message: 'El nombre del negocio tiene que estar en una sola línea.' }
  if (businessName.length > MAX_NAME) return { ok: false, message: `El nombre del negocio no puede pasar de ${MAX_NAME} caracteres.` }
  return { ok: true, email, businessName }
}

const normalizeName = (n: string) => n.trim().toLowerCase()

// Convierte una excepción en el mismo formato { error } que devuelve Supabase.
async function safe<T extends { error: { message: string } | null }>(run: () => PromiseLike<T> | T): Promise<T | { error: { message: string; code?: string } }> {
  try {
    return await run()
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : String(e) } }
  }
}

async function allUsers(admin: SupabaseClient) {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) throw new Error(error.message)
    users.push(...data.users)
    if (data.users.length < PER_PAGE) return users
  }
}

const failed = (message: string, left: string[] = []): OnboardResult => ({ status: 'failed', message, left })

export async function onboardClient(admin: SupabaseClient, input: OnboardInput, opts: { redirectTo?: string } = {}): Promise<OnboardResult> {
  const v = validateInput(input)
  if (!v.ok) return { status: 'invalid', message: v.message }
  const { email, businessName } = v

  // Aún no se creó nada: un fallo acá no deja restos.
  let users
  try {
    users = await allUsers(admin)
  } catch {
    return failed('No se pudo comprobar si el email ya está registrado. No se creó nada; intentá de nuevo.')
  }
  if (users.some((u) => u.email?.toLowerCase() === email)) {
    return { status: 'email_taken', message: 'Ese email ya está registrado. No se creó nada.' }
  }

  const { data: configs, error: listError } = await admin.from('site_config').select('business_name')
  if (listError || !configs) return failed('No se pudo comprobar si el nombre ya existe. No se creó nada; intentá de nuevo.')
  if (!input.confirmDuplicateName && configs.some((c) => normalizeName(c.business_name ?? '') === normalizeName(businessName))) {
    return { status: 'confirm_name', message: `Ya existe un cliente llamado «${businessName}». Confirmá si querés crear otro con el mismo nombre.` }
  }

  const siteId = randomUUID()
  const insert = await safe(() => admin.from('site_config').insert({ site_id: siteId, business_name: businessName }))
  if (insert.error) return failed('No se pudo crear la configuración del sitio. No quedó nada creado.')

  // Deshace lo creado y dice qué no se pudo deshacer (RF-5, RF-6).
  const undo = async (userId: string | null) => {
    const left: string[] = []
    if (userId) {
      const r = await safe(() => admin.auth.admin.deleteUser(userId))
      if (r.error) left.push(`el usuario ${email}`)
    }
    const r = await safe(() => admin.from('site_config').delete().eq('site_id', siteId))
    if (r.error) left.push(`la configuración «${businessName}» (sitio ${siteId})`)
    return left
  }
  const leftMessage = (left: string[]) =>
    left.length ? ` No se pudo deshacer y quedó creado: ${left.join(' y ')}. Corregilo a mano.` : ' No quedó nada creado.'

  const invite = await safe(() => admin.auth.admin.inviteUserByEmail(email, opts.redirectTo ? { redirectTo: opts.redirectTo } : undefined))
  const invited = 'data' in invite ? invite.data?.user ?? null : null
  if (invite.error || !invited) {
    const msg = invite.error?.message ?? ''
    const taken = (invite.error as { code?: string } | null)?.code === 'email_exists' || /already|registered|exists/i.test(msg)
    const left = await undo(null)
    if (taken && !left.length) return { status: 'email_taken', message: 'Ese email ya está registrado. No se creó nada.' }
    return failed(`No se pudo enviar la invitación.${leftMessage(left)}`, left)
  }

  // Supabase re-invita sin error a quien aún no aceptó: si ese usuario ya tiene sitio, es de otro alta; no se toca.
  if (invited.app_metadata?.site_id) {
    const left = await undo(null)
    if (!left.length) return { status: 'email_taken', message: 'Ese email ya está registrado. No se creó nada.' }
    return failed(`Ese email ya está registrado.${leftMessage(left)}`, left)
  }

  // La invitación solo guarda datos editables por el usuario; el sitio va en app_metadata.
  const assign = await safe(() => admin.auth.admin.updateUserById(invited.id, { app_metadata: { site_id: siteId } }))
  if (assign.error) {
    const left = await undo(invited.id)
    return failed(`No se pudo asignar el sitio al usuario.${leftMessage(left)}`, left)
  }

  return { status: 'created', siteId, email, businessName }
}

export async function listClients(admin: SupabaseClient): Promise<ClientRow[]> {
  const { data: configs, error } = await admin.from('site_config').select('site_id, business_name, created_at').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const bySite = new Map<string, { email: string | null; last: string | null | undefined }>()
  for (const u of await allUsers(admin)) {
    const site = u.app_metadata?.site_id
    if (typeof site === 'string' && !bySite.has(site)) bySite.set(site, { email: u.email ?? null, last: u.last_sign_in_at })
  }
  return configs.map((c) => {
    const u = bySite.get(c.site_id)
    return {
      siteId: c.site_id,
      businessName: c.business_name ?? '',
      email: u?.email ?? null,
      status: !u ? 'sin_usuario' : u.last ? 'activo' : 'pendiente',
    }
  })
}
