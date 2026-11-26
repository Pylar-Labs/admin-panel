'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { listClients, onboardClient, type ClientRow, type OnboardInput, type OnboardResult } from '@/lib/clients/onboarding'

const FORBIDDEN_FAIL = (message: string): OnboardResult => ({ status: 'failed', message, left: [] })

export async function createClientAction(input: OnboardInput): Promise<OnboardResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return FORBIDDEN_FAIL(auth.message)
  // Solo los tres campos esperados: lo demás que llegue por una llamada directa se ignora.
  const clean: OnboardInput = {
    email: String(input?.email ?? ''),
    businessName: String(input?.businessName ?? ''),
    confirmDuplicateName: input?.confirmDuplicateName === true,
  }
  const h = await headers()
  const origin = h.get('origin') ?? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
  return onboardClient(createAdminClient(), clean, { redirectTo: `${origin}/aceptar-invitacion` })
}

export async function listClientsAction(): Promise<{ ok: true; clients: ClientRow[] } | { ok: false; message: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth
  try {
    return { ok: true, clients: await listClients(createAdminClient()) }
  } catch {
    return { ok: false, message: 'No se pudo cargar la lista de clientes. Intentá de nuevo.' }
  }
}
