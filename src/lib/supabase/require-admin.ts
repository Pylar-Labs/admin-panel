import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/auth/roles'

// Se llama al empezar CADA acción de servidor: las acciones se pueden invocar por fuera de la interfaz.
// getUser() valida el token con Supabase (no se confía en la cookie sola).
export async function requireAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Tu sesión venció. Volvé a iniciar sesión.' }
  if (!isAdminUser(user)) return { ok: false, message: 'No tenés permiso para hacer esto.' }
  return { ok: true }
}
